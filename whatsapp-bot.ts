import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
  proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import express from 'express';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, extname } from 'path';
import QRCode from 'qrcode-terminal';
import { AIService } from './ai-service';
import { GoogleSheetsService, autoSetupGoogleSheets } from './sheets-service';
import {
  MessageRequest,
  ApiResponse,
  HealthResponse,
  AIRequest,
  ConversationStatsRequest,
  ClearConversationRequest,
  MessageData
} from './types';
import {
  shouldTriggerAI,
  getWhatsAppMediaType,
  parseAICommand,
  generateHelpMessage,
  formatToolUsage
} from './whatsapp-utils';

class WhatsAppBot {
  private sock: WASocket | null = null;
  private app = express();
  private aiService: AIService;
  private sheetsService: GoogleSheetsService | null = null;

  constructor() {
    this.aiService = new AIService();
    this.initializeSheetsService();
    this.setupRoutes();
    this.start();
  }

  private findOAuthCredentials(): string | null {
    const credentialsFolder = './google-credentials';
    const rootFiles = ['./oauth-credentials.json'];

    if (existsSync(credentialsFolder)) {
      try {
        const files = readdirSync(credentialsFolder);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
          const filePath = `${credentialsFolder}/${file}`;
          try {
            const content = JSON.parse(readFileSync(filePath, 'utf8'));
            if ((content.web || content.installed) && (content.web?.client_id || content.installed?.client_id)) {
              console.log(`✅ Found OAuth credentials: ${file}`);
              return filePath;
            }
          } catch (error) {
              }
        }
      } catch (error) {
      }
    }

    for (const path of rootFiles) {
      if (existsSync(path)) {
        try {
          const content = JSON.parse(readFileSync(path, 'utf8'));
          if ((content.web || content.installed) && (content.web?.client_id || content.installed?.client_id)) {
            return path;
          }
        } catch (error) {
          }
      }
    }

    return null;
  }

  private async initializeSheetsService() {
    try {
      const credentialsPath = this.findOAuthCredentials();
      if (!credentialsPath) {
        console.warn('⚠️ No OAuth credentials found. Message auto-save disabled.');
        console.warn('💡 Drag your OAuth credentials JSON file into the "google-credentials" folder');
        return;
      }

      let spreadsheetId = process.env.GOOGLE_SHEETS_ID || this.loadSpreadsheetConfig();

      if (!spreadsheetId) {
        console.log('🔄 No spreadsheet configured. Creating new spreadsheet automatically...');

        try {
          const setup = await autoSetupGoogleSheets(credentialsPath, 'WhatsApp Messages Log');
          this.sheetsService = setup.sheetsService;
          console.log(setup.setupInstructions);
          return;
        } catch (autoSetupError) {
          console.error('❌ Auto-setup failed:', autoSetupError);
          return;
        }
      }

      this.sheetsService = new GoogleSheetsService(credentialsPath, spreadsheetId);
      await this.sheetsService.initialize();

      const isConnected = await this.sheetsService.testConnection();
      if (isConnected) {
        console.log('✅ Google Sheets auto-save enabled');
        console.log(`📊 Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
      } else {
        console.error('❌ Google Sheets connection test failed');
        this.sheetsService = null;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets:', error);
      this.sheetsService = null;
    }
  }

  private loadSpreadsheetConfig(): string | null {
    try {
      const configPath = './sheets-config.json';
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        return config.spreadsheetId || null;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load sheets config:', error);
    }
    return null;
  }



  private setupRoutes() {
    this.app.use(express.json());

    this.app.get('/health', async (_, res) => {
      const aiServiceConnected = await this.aiService.testConnection();
      res.json({
        status: 'ok',
        connected: !!this.sock?.user,
        user: this.sock?.user?.id || null,
        aiServiceConnected
      } as HealthResponse);
    });

    this.app.post('/api/send', async (req, res) => {
      try {
        const { recipient, message, media_path } = req.body as MessageRequest;
        if (!recipient) return res.status(400).json({ success: false, message: 'Recipient required' });
        if (!message && !media_path) return res.status(400).json({ success: false, message: 'Message or media_path required' });

        const jid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
        let messageOptions: any = { text: message };

        if (media_path) {
          if (!existsSync(media_path)) return res.status(400).json({ success: false, message: 'Media file not found' });

          const mediaBuffer = readFileSync(media_path);
          const filename = basename(media_path);
          const ext = extname(media_path).toLowerCase();

          const mediaTypes: Record<string, string> = {
            '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image',
            '.mp4': 'video', '.avi': 'video', '.mov': 'video',
            '.mp3': 'audio', '.ogg': 'audio', '.wav': 'audio', '.m4a': 'audio'
          };

          const type = mediaTypes[ext] || 'document';
          messageOptions = type === 'image' ? { image: mediaBuffer, caption: message }
            : type === 'video' ? { video: mediaBuffer, caption: message }
            : type === 'audio' ? { audio: mediaBuffer, ptt: true }
            : { document: mediaBuffer, fileName: filename, caption: message };
        }

        await this.sock!.sendMessage(jid, messageOptions);
        return res.json({ success: true, message: `Message sent to ${recipient}` } as ApiResponse);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ success: false, message: errorMsg });
      }
    });

    this.app.post('/api/ai', async (req, res) => {
      try {
        const { recipient, prompt, useSearch = false, useUrlContext = false, useCodeExecution = false, useThinking = false } = req.body as AIRequest;
        if (!recipient || !prompt) {
          return res.status(400).json({ success: false, message: 'Recipient and prompt required' });
        }

        const jid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;

        let response;
        // Extract chat ID from recipient
        const chatId = jid;

        if (useThinking) {
          response = await this.aiService.generateWithThinking(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear and concise responses.'
          }, chatId, 'API User');
        } else {
          response = await this.aiService.generateResponse(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear and concise responses.'
          }, chatId, 'API User');
        }

        await this.sock!.sendMessage(jid, { text: response.text });

        let responseData: any = {
          success: true,
          message: `AI response sent to ${recipient}`,
          response: response.text
        };

        if (response.sources && response.sources.length > 0) {
          responseData.sources = response.sources;
        }

        if (response.reasoning) {
          responseData.reasoning = response.reasoning;
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
          responseData.toolsUsed = response.toolCalls.map(tc => tc.toolName);
        }

        return res.json(responseData);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ success: false, message: errorMsg });
      }
    });

    this.app.get('/api/conversation/:chatId', (req, res) => {
      try {
        const { chatId } = req.params;
        const stats = this.aiService.getConversationSummary(chatId);
        return res.json({
          success: true,
          chatId,
          messageCount: stats.messageCount,
          lastActivity: stats.lastActivity
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ success: false, message: errorMsg });
      }
    });

    this.app.delete('/api/conversation/:chatId', (req, res) => {
      try {
        const { chatId } = req.params;
        this.aiService.clearConversation(chatId);
        return res.json({
          success: true,
          message: `Conversation history cleared for ${chatId}`
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ success: false, message: errorMsg });
      }
    });

    const port = parseInt(process.env.PORT || '8080');
    this.app.listen(port, () => console.log(`✓ API server running on port ${port}`));
  }

  private async handleMessage(messages: BaileysEventMap['messages.upsert']) {
    if (messages.type !== 'notify') return;

    for (const m of messages.messages) {
      if (!m.message) continue;

      const messageType = Object.keys(m.message)[0] as keyof proto.IMessage;
      const chatJid = m.key.remoteJid!;
      const isFromMe = m.key.fromMe || false;
      const sender = isFromMe ? this.sock!.user!.id : (m.key.participant || chatJid);
      const timestamp = new Date((m.messageTimestamp as number) * 1000);

      let content = '';
      let mediaType: string | undefined;
      let filename: string | undefined;

      const messageMap: Record<string, () => void> = {
        conversation: () => { content = m.message!.conversation!; },
        extendedTextMessage: () => { content = m.message!.extendedTextMessage!.text!; },
        imageMessage: () => {
          mediaType = 'image';
          content = m.message!.imageMessage!.caption || '[Image]';
          filename = content;
        },
        videoMessage: () => {
          mediaType = 'video';
          content = m.message!.videoMessage!.caption || '[Video]';
          filename = content;
        },
        audioMessage: () => {
          mediaType = 'audio';
          content = '[Audio]';
          filename = 'audio';
        },
        documentMessage: () => {
          mediaType = 'document';
          filename = m.message!.documentMessage!.fileName || 'document';
          content = m.message!.documentMessage!.caption || '[Document]';
        }
      };

      if (messageMap[messageType]) {
        messageMap[messageType]();
      } else {
        content = '[Unknown message type]';
      }

      // Auto-reply to ping
      if (!isFromMe && content.toLowerCase().trim() === 'ping') {
        try {
          await this.sock!.sendMessage(chatJid, { text: 'pong' });
          console.log(`✓ Auto-replied to ping from ${sender}`);
        } catch (error) {
          console.error('Failed to send auto-reply:', error);
        }
      }

      // AI-powered responses
      if (!isFromMe && shouldTriggerAI(content)) {
        try {
          // For media messages, we'll need to download the media first
          let mediaBuffer: Buffer | undefined;
          let actualMediaType: string | undefined;
          let actualFilename: string | undefined;

          if (mediaType && m.message) {
            try {
              // For now, skip media download as it requires additional Baileys setup
              // This would need proper media handling implementation
              console.log(`📎 Media message detected: ${mediaType} - ${filename}`);
              // TODO: Implement proper media download with Baileys
            } catch (error) {
              console.error('Failed to process media:', error);
            }
          }

          await this.handleAIMessage(chatJid, content, sender, mediaBuffer, actualMediaType, actualFilename);
        } catch (error) {
          console.error('Failed to process AI message:', error);
        }
      }

      // Log message to console and Google Sheets
      try {
        const direction = isFromMe ? '→' : '←';
        const logMsg = mediaType
          ? `[${timestamp.toLocaleString()}] ${direction} ${sender}: [${mediaType}: ${filename}] ${content}`
          : `[${timestamp.toLocaleString()}] ${direction} ${sender}: ${content}`;
        console.log(logMsg);

        // Save to Google Sheets if available
        await this.saveMessageToSheets({
          timestamp: timestamp.toISOString(),
          direction,
          sender: sender.split('@')[0],
          chat: chatJid.split('@')[0],
          messageType: mediaType || 'text',
          content: content || '[Media]'
        });
      } catch (error) {
        console.error('Error logging message:', error);
      }
    }
  }


  private async handleAIMessage(chatJid: string, content: string, sender: string, mediaBuffer?: Buffer, mediaType?: string, filename?: string) {
    // Parse command and options
    const { useSearch, useUrlContext, useCodeExecution, useThinking, prompt, isHelp } = parseAICommand(content);

    if (isHelp) {
      const helpMessage = generateHelpMessage(!!this.sheetsService);
      await this.sock!.sendMessage(chatJid, { text: helpMessage });
      return;
    }

    if (!prompt.trim()) {
      await this.sock!.sendMessage(chatJid, {
        text: '❌ Please provide a message after the command. Use /help for examples.'
      });
      return;
    }

    // Send typing indicator
    await this.sock!.sendPresenceUpdate('composing', chatJid);

    try {
      let response;
      const senderName = await this.getSenderName(chatJid, sender);

      if (mediaBuffer && mediaType) {
        // Handle message with media using the new media-aware method
        response = await this.aiService.generateWithMedia(prompt, [
          { data: mediaBuffer, mediaType, filename }
        ], {
          useSearch,
          useUrlContext,
          useCodeExecution,
          systemPrompt: 'You are a helpful WhatsApp assistant. Analyze images, documents, and media when provided. Provide clear, concise, and informative responses. Use emojis appropriately to make responses engaging.'
        }, chatJid, senderName);
      } else {
        // Handle text-only messages with conversation context
        if (useThinking) {
          response = await this.aiService.generateWithThinking(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear, concise, and informative responses. Use emojis appropriately to make responses engaging.'
          }, chatJid, senderName);
        } else {
          response = await this.aiService.generateResponse(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear, concise, and informative responses. Use emojis appropriately to make responses engaging.'
          }, chatJid, senderName);
        }
      }

      // Send the AI response
      let responseText = response.text;

      // Add sources information if available
      if (response.sources && response.sources.length > 0) {
        responseText += '\n\n📚 Sources:';
        response.sources.forEach((source, index) => {
          responseText += `\n${index + 1}. ${source.uri || source.url || 'Web Search'}`;
        });
      }

      // Add tool usage indicator
      const toolsUsed = formatToolUsage(response.toolCalls || []);

      if (toolsUsed.length > 0) {
        responseText += `\n\n🛠️ Tools used: ${toolsUsed.join(', ')}`;
      }

      await this.sock!.sendMessage(chatJid, { text: responseText });

      console.log(`✓ AI response sent to ${sender} (${toolsUsed.join(', ') || 'No tools'})`);
    } catch (error) {
      console.error('AI message handling error:', error);
      await this.sock!.sendMessage(chatJid, {
        text: '❌ Sorry, I encountered an error processing your request. Please try again later.'
      });
    } finally {
      // Stop typing indicator
      await this.sock!.sendPresenceUpdate('available', chatJid);
    }
  }

  private async saveMessageToSheets(messageData: {
    timestamp: string;
    direction: string;
    sender: string;
    chat: string;
    messageType: string;
    content: string;
  }) {
    if (!this.sheetsService) {
      return; // Sheets not initialized
    }

    try {
      await this.sheetsService.appendMessage(messageData);
    } catch (error) {
      console.error('Failed to save message to sheets:', error);
    }
  }


  private async getChatName(jid: string, sender: string): Promise<string> {
    if (jid.endsWith('@g.us')) {
      try {
        const groupInfo = await this.sock!.groupMetadata(jid);
        return groupInfo.subject || `Group ${jid.split('@')[0]}`;
      } catch {
        return `Group ${jid.split('@')[0]}`;
      }
    }
    return sender || jid.split('@')[0];
  }

  private async getSenderName(jid: string, sender: string): Promise<string> {
    if (jid.endsWith('@g.us')) {
      // For group chats, try to get the participant's name
      try {
        const groupInfo = await this.sock!.groupMetadata(jid);
        const participant = groupInfo.participants.find(p => p.id === sender);
        if (participant) {
          return sender.split('@')[0]; // Use phone number as fallback
        }
      } catch {
        // Fallback to sender ID
      }
      return sender.split('@')[0];
    } else {
      // For direct messages, use the contact name or phone number
      return sender.split('@')[0];
    }
  }

  private async connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('store/auth');

    this.sock = makeWASocket({ auth: state, printQRInTerminal: false });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 Scan this QR code with your WhatsApp app:');
        QRCode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed, reconnecting:', shouldReconnect);
        if (shouldReconnect) this.connectToWhatsApp();
      } else if (connection === 'open') {
        console.log('✓ WhatsApp Bot connected!');
        console.log(`✓ Logged in as: ${this.sock!.user!.name} (${this.sock!.user!.id})`);
        console.log('✓ AI Service ready with Google Gemini');
        console.log('✓ Available tools: Google Search, URL Context, Code Execution');
        console.log('✓ Send "/help" to see AI commands or "ping" to test connectivity');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('messages.upsert', (m) => this.handleMessage(m));
  }

  private async start() {
    console.log('🚀 Starting WhatsApp Bot...');
    await this.connectToWhatsApp();
  }

  cleanup = () => {
    console.log('🧹 Cleaning up...');
    // No database to cleanup - messages are not stored
  };
}

// Start bot and handle cleanup
const bot = new WhatsAppBot();
['SIGINT', 'SIGTERM'].forEach(signal =>
  process.on(signal, () => {
    console.log(`\n🛑 Shutting down bot...`);
    bot.cleanup();
    process.exit(0);
  })
);
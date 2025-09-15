import express from 'express';
import { WASocket } from '@whiskeysockets/baileys';
import { AIService } from '../ai/ai-service';
import { GoogleSheetsService } from '../sheets/sheets-service';
import {
  MessageRequest,
  ApiResponse,
  HealthResponse,
  AIRequest,
  ConversationStatsRequest,
  ClearConversationRequest
} from '../../types';

export class ApiRoutes {
  static setupRoutes(
    app: express.Application,
    aiService: AIService,
    getSock: () => WASocket | null,
    getSheetsService: () => GoogleSheetsService | null
  ): void {
    app.use(express.json());

    app.get('/health', (req, res) => {
      const response: HealthResponse = {
        status: 'ok',
        whatsapp: getSock() ? 'connected' : 'disconnected',
        ai: 'ready',
        sheets: getSheetsService() ? 'enabled' : 'disabled',
        timestamp: new Date().toISOString()
      };
      res.json(response);
    });

    app.post('/api/message', async (req, res): Promise<void> => {
      try {
        const { recipient, message } = req.body as MessageRequest;
        if (!recipient || !message) {
          res.status(400).json({ success: false, message: 'Recipient and message required' });
          return;
        }

        const sock = getSock();
        if (!sock) {
          res.status(503).json({ success: false, message: 'WhatsApp not connected' });
          return;
        }

        const jid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });

        const response: ApiResponse = {
          success: true,
          message: 'Message sent successfully'
        };
        res.json(response);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: errorMsg });
      }
    });

    app.post('/api/ai', async (req, res): Promise<void> => {
      try {
        const { recipient, prompt, useSearch = false, useUrlContext = false, useCodeExecution = false, useThinking = false } = req.body as AIRequest;
        if (!recipient || !prompt) {
          res.status(400).json({ success: false, message: 'Recipient and prompt required' });
          return;
        }

        const jid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
        const chatId = jid;

        let response;
        if (useThinking) {
          response = await aiService.generateWithThinking(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear and concise responses.'
          }, chatId, 'API User');
        } else {
          response = await aiService.generateResponse(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear and concise responses.'
          }, chatId, 'API User');
        }

        const sock = getSock();
        if (sock) {
          await sock.sendMessage(jid, { text: response.content });
        }

        res.json({ success: true, response: response.content });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: errorMsg });
      }
    });

    app.get('/api/conversation/:chatId', (req, res): void => {
      try {
        const { chatId } = req.params as ConversationStatsRequest;
        const stats = aiService.getConversationSummary(chatId);
        res.json(stats);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: errorMsg });
      }
    });

    app.delete('/api/conversation/:chatId', (req, res): void => {
      try {
        const { chatId } = req.params as ClearConversationRequest;
        aiService.clearConversation(chatId);
        res.json({ success: true, message: 'Conversation cleared' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: errorMsg });
      }
    });

    const port = parseInt(process.env.PORT || '8080');
    const server = app.listen(port)
      .on('listening', () => {
        console.log(`✅ API server ready on port ${port}`);
      })
      .on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Port ${port} is already in use.`);
          console.error(`Please stop the existing process or use a different port:`);
          console.error(`   Kill existing: lsof -ti:${port} | xargs kill`);
          console.error(`   Use different port: PORT=8081 bun run main.ts`);
          process.exit(1);
        } else {
          console.error('❌ Server error:', err.message);
          process.exit(1);
        }
      });
  }
}
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import express from 'express';
import { existsSync, readFileSync, rmSync } from 'fs';
import QRCode from 'qrcode-terminal';
import { AIService } from '../ai/ai-service';
import { GoogleSheetsService, autoSetupGoogleSheets } from '../sheets/sheets-service';
import { Logger } from '../utils/logger';
import { MessageHandler } from './message-handler';
import { ApiRoutes } from '../api/api-routes';
import { EnvironmentValidator } from './environment-validator';
import { OAuthCredentialsFinder } from './oauth-credentials-finder';
import { UserInput } from './user-input';

export class WhatsAppBot {
  private sock: WASocket | null = null;
  private app = express();
  private aiService: AIService;
  private sheetsService: GoogleSheetsService | null = null;
  private messageHandler: MessageHandler;
  private isReconnecting = false;

  constructor() {
    console.log('🤖 WhatsApp Bot constructor: Initializing AI Service...');
    try {
      this.aiService = new AIService();
      console.log('✅ AI Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error);
      throw error;
    }

    this.messageHandler = new MessageHandler(
      this.aiService,
      () => this.sock,
      () => this.sheetsService
    );
    this.initializeApp();
  }

  private setupRoutes(): void {
    ApiRoutes.setupRoutes(
      this.app,
      this.aiService,
      () => this.sock,
      () => this.sheetsService
    );
  }

  private async initializeApp(): Promise<void> {
    console.log('\n🚀 Starting WhatsApp AI Bot...');
    console.log('────────────────────────────────────────────────────────────────────────────────');

    await EnvironmentValidator.validateEnvironment();
    await this.promptGoogleSheetsSetup();

    // Start API server after OAuth setup is complete
    const port = process.env.PORT || '8080';
    console.log(`🌐 API server starting on port ${port}`);
    console.log('');
    this.setupRoutes();

    await this.start();
  }

  private async promptGoogleSheetsSetup(): Promise<void> {
    const credentialsPath = OAuthCredentialsFinder.findCredentials();

    if (!credentialsPath) {
      console.log('\n📊 Google Sheets Integration (Optional)');
      console.log('No OAuth credentials found.');
      console.log('');
      console.log('To enable message logging to Google Sheets:');
      console.log('1. Follow setup guide: docs/GOOGLE_SHEETS_SETUP.md');
      console.log('2. Download OAuth credentials from Google Cloud Console');
      console.log('3. Drop the JSON file into google-credentials/ folder');
      console.log('');

      const skipSheets = await UserInput.promptUser('Skip Google Sheets and continue with WhatsApp only? (y/n) [Ctrl+C to skip]: ');
      if (skipSheets.toLowerCase() === 'y' || skipSheets.toLowerCase() === 'yes') {
        console.log('✅ Continuing without Google Sheets integration');
        return;
      } else {
        console.log('❌ Please set up OAuth credentials first, then restart the bot.');
        process.exit(1);
      }
    }

    console.log('\n📊 Setting up Google Sheets integration...');
    console.log('OAuth credentials found! Starting authorization flow...');

    try {
      let spreadsheetId = process.env.GOOGLE_SHEETS_ID || this.loadSpreadsheetConfig();

      if (!spreadsheetId) {
        console.log('📊 Creating new spreadsheet...');
        const setup = await autoSetupGoogleSheets(credentialsPath, 'WhatsApp Messages Log');
        this.sheetsService = setup.sheetsService;
        console.log('✅ ' + setup.setupInstructions);
        console.log('🔒 Using your personal Google Drive storage via OAuth');
        return;
      }

      this.sheetsService = new GoogleSheetsService(credentialsPath, spreadsheetId);
      await this.sheetsService.initialize();

      const isConnected = await this.sheetsService.testConnection();
      if (isConnected) {
        console.log('✅ Google Sheets integration ready!');
        console.log(`🔗 Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
        console.log('📊 Google Sheets service initialized and ready for message logging');
      } else {
        console.log('❌ Google Sheets connection test failed');
        this.sheetsService = null;
      }
    } catch (error) {
      console.error('❌ Failed to set up Google Sheets:', error);
      const continueWithoutSheets = await UserInput.promptUser('Continue without Google Sheets? (y/n): ');
      if (continueWithoutSheets.toLowerCase() !== 'y' && continueWithoutSheets.toLowerCase() !== 'yes') {
        console.log('❌ Setup cancelled. Please fix the issue and restart.');
        process.exit(1);
      }
      console.log('✅ Continuing without Google Sheets integration');
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
      return null;
    } catch (error) {
      return null;
    }
  }

  private async connectToWhatsApp(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState('store/auth');
    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: {
        level: 'silent',
        child: (_obj: Record<string, unknown>) => ({
          level: 'silent',
          child: (_obj: Record<string, unknown>) => ({
            level: 'silent',
            child: (_obj: Record<string, unknown>) => ({
              level: 'silent',
              child: (_obj: Record<string, unknown>) => ({} as any),
              trace: () => {},
              debug: () => {},
              info: () => {},
              warn: () => {},
              error: () => {}
            }),
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {}
          }),
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {}
        }),
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
      }
    });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 WhatsApp QR Code:');
        console.log('────────────────────────────────────────────────────────────────────────────────');
        QRCode.generate(qr, { small: true });
        console.log('────────────────────────────────────────────────────────────────────────────────');
        console.log('📱 Open WhatsApp → Settings → Linked Devices → Link a Device → Scan this QR code');
        console.log('');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';

        // Log the disconnect reason for debugging
        Logger.connection(`Connection closed - Status: ${statusCode}, Message: ${errorMessage}`);

        // Check various disconnect reasons
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired;
        const isConnectionLost = statusCode === DisconnectReason.connectionLost;
        const isConnectionClosed = statusCode === DisconnectReason.connectionClosed;
        const isTimedOut = statusCode === DisconnectReason.timedOut;

        // Don't retry if logged out or if already reconnecting
        const shouldReconnect = !isLoggedOut && !this.isReconnecting;

        if (isLoggedOut) {
          Logger.connection('Session logged out - clearing auth and reconnecting');
          console.log('❌ WhatsApp session expired. Clearing authentication...');

          // Clear the auth store to force fresh QR code
          try {
            if (existsSync('./store')) {
              rmSync('./store', { recursive: true, force: true });
              console.log('🔄 Authentication cleared. Reconnecting...');
            }
          } catch (error) {
            Logger.error('Failed to clear auth store', error);
          }

          // Reconnect after clearing auth (will show QR code)
          this.isReconnecting = true;
          setTimeout(() => {
            this.isReconnecting = false;
            this.connectToWhatsApp();
          }, 2000);
        } else if (shouldReconnect && (isConnectionLost || isConnectionClosed || isTimedOut || isRestartRequired)) {
          // Treat restartRequired as a reconnectable issue during auth process
          Logger.connection(`Connection ${isTimedOut ? 'timed out' : isRestartRequired ? 'requires restart' : 'lost'}, reconnecting...`);
          this.isReconnecting = true;
          console.log('🔄 Connection lost. Reconnecting in 3 seconds...');
          setTimeout(() => {
            this.isReconnecting = false;
            this.connectToWhatsApp();
          }, 3000);
        } else {
          Logger.connection(`Connection closed (${statusCode}) - ${errorMessage}`);
          console.log('❌ Connection closed unexpectedly. Please restart the bot if needed.');
        }
      } else if (connection === 'open') {
        this.isReconnecting = false; // Reset reconnecting flag
        console.log('✅ WhatsApp Bot connected!');
        console.log(`✅ Logged in as: ${this.sock!.user!.name} (${this.sock!.user!.id})`);
        console.log('🤖 AI Service ready with Google Gemini');
        console.log('🤖 Available tools: Google Search, URL Context, Code Execution');
        console.log('🤖 Use /ai for questions or /search for web search');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('messages.upsert', (m) => this.messageHandler.handleMessage(m));
  }

  private async start(): Promise<void> {
    console.log('\n📱 WhatsApp Connection Setup');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('🔗 Connecting to WhatsApp... QR code will appear below if needed');
    await this.connectToWhatsApp();
  }

  cleanup = (): void => {
    Logger.system('Cleaning up...');
  };
}
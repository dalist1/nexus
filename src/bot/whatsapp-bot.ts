import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import express from 'express';
import { existsSync, readFileSync } from 'fs';
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

  constructor() {
    this.aiService = new AIService();
    this.messageHandler = new MessageHandler(
      this.aiService,
      () => this.sock,
      () => this.sheetsService
    );
    this.setupRoutes();
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
    const port = process.env.PORT || '8080';
    console.log(`🌐 API server starting on port ${port}`);
    console.log('');

    await EnvironmentValidator.validateEnvironment();
    await this.promptGoogleSheetsSetup();
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
        QRCode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        Logger.connection(`Connection closed${shouldReconnect ? ', reconnecting...' : ''}`);
        if (shouldReconnect) {
          setTimeout(() => this.connectToWhatsApp(), 3000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp Bot connected!');
        console.log(`✅ Logged in as: ${this.sock!.user!.name} (${this.sock!.user!.id})`);
        console.log('🤖 AI Service ready with Google Gemini');
        console.log('🤖 Available tools: Google Search, URL Context, Code Execution');
        console.log('🤖 Send "/help" to see AI commands or "ping" to test connectivity');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('messages.upsert', (m) => this.messageHandler.handleMessage(m));
  }

  private async start(): Promise<void> {
    console.log('\n📱 WhatsApp Connection Setup');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('🔗 Scan this QR code with your WhatsApp app:');
    await this.connectToWhatsApp();
  }

  cleanup = (): void => {
    Logger.system('Cleaning up...');
  };
}
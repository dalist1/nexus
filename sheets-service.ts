import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { MessageData } from './types';

export class GoogleSheetsService {
  private oauth2Client: OAuth2Client;
  private sheets: any;
  private drive: any;
  private tokenPath = './oauth-token.json';
  private spreadsheetId?: string;

  constructor(private credentialsPath: string, spreadsheetId?: string) {
    this.spreadsheetId = spreadsheetId;
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;

    this.oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);
  }

  async initialize(): Promise<void> {
    if (existsSync(this.tokenPath)) {
      const token = JSON.parse(readFileSync(this.tokenPath, 'utf8'));
      this.oauth2Client.setCredentials(token);
    } else {
      await this.getNewToken();
    }

    this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    if (!this.spreadsheetId) {
      this.spreadsheetId = await this.createSpreadsheet();
    }
  }

  private async getNewToken(): Promise<void> {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });

    console.log('\n🔐 OAUTH SETUP REQUIRED:');
    console.log('1. Open this URL in your browser:');
    console.log(authUrl);
    console.log('\n2. Click "Allow" and copy the code');
    console.log('3. Paste the code here and press Enter:');

    // Simple stdin reading for the code
    process.stdout.write('Enter code: ');
    const code = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    writeFileSync(this.tokenPath, JSON.stringify(tokens));
    console.log('✅ Token saved! OAuth setup complete.\n');
  }

  private async createSpreadsheet(): Promise<string> {
    console.log('📊 Creating new spreadsheet...');

    const response = await this.drive.files.create({
      requestBody: {
        name: 'WhatsApp Messages Log',
        mimeType: 'application/vnd.google-apps.spreadsheet'
      }
    });

    const spreadsheetId = response.data.id;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:F1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Timestamp', 'Direction', 'Sender', 'Chat', 'Message Type', 'Content']]
      }
    });

    console.log(`✅ Spreadsheet created: ${spreadsheetUrl}`);
    return spreadsheetId;
  }

  async appendMessage(message: MessageData): Promise<void> {
    if (!this.spreadsheetId) {
      throw new Error('No spreadsheet ID available');
    }

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Sheet1!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          message.timestamp,
          message.direction,
          message.sender,
          message.chat,
          message.messageType,
          message.content
        ]]
      }
    });
  }

  async setupHeaders(): Promise<void> {
    // Headers are set up during spreadsheet creation in OAuth flow
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.spreadsheetId) return false;
      await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export async function autoSetupGoogleSheets(credentialsPath: string, title: string = 'WhatsApp Messages Log') {
  const service = new GoogleSheetsService(credentialsPath);
  await service.initialize();

  return {
    sheetsService: service,
    setupInstructions: `✅ Spreadsheet created: ${title}\n🔒 Using your personal Google Drive storage via OAuth`
  };
}
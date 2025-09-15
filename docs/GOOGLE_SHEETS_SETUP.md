# Google Sheets Setup

This guide shows how to set up **automatic message logging to Google Sheets** using **OAuth integration** with your personal Google Drive storage.

## 🚀 Quick OAuth Setup

### 1. Create Google Cloud Project & Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. **Enable Required APIs**:
   - Go to "APIs & Services" > "Library"
   - **Search "Google Sheets API"** → Click "Enable"
   - **Search "Google Drive API"** → Click "Enable"

   **Why these APIs?**
   - **Google Sheets API**: Read/write access to spreadsheets
   - **Google Drive API**: Create new spreadsheets in your Drive

4. **Configure OAuth Consent Screen** (if first time):
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" for testing
   - Fill required fields: App name, User support email, Developer email
   - Add your email to "Test users" section

5. **Create OAuth 2.0 Client ID**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Choose "Desktop application"
   - Name it `whatsapp-bot`
   - Click "Create"

6. **Download Credentials**:
   - Click the download icon for your OAuth client
   - Save the JSON file (name doesn't matter)

### 2. Add OAuth Credentials
Simply **drag and drop** your downloaded JSON file into the `google-credentials/` folder.
- **No renaming required** - any `.json` file works
- **Auto-detection** - bot scans folder on startup
- **Secure storage** - folder is gitignored by default

**What happens after you drop the file:**
1. Bot detects your OAuth credentials automatically
2. Prompts you for browser authorization (one-time only)
3. Creates `oauth-token.json` in `google-credentials/` folder (auto-generated)
4. Token includes refresh capability for long-term use

**File organization after setup:**
```
google-credentials/
├── client_secret_*.json          # Your OAuth credentials (downloaded)
└── oauth-token.json              # Generated after authorization
```

### 3. Start the Bot (Auto-Setup with OAuth)
```bash
bun run whatsapp-bot.ts
```

**The bot will automatically:**
- ✅ Detect your OAuth credentials
- ✅ Display authorization URL
- ✅ Wait for your authorization code
- ✅ Create spreadsheet using YOUR Google Drive storage
- ✅ Set up proper headers and formatting

### 4. Complete Authorization (One-Time)
When you see the authorization prompt:

1. **Copy the URL** displayed by the bot
2. **Open in browser** and sign in with your Google account
3. **Click "Allow"** to grant permissions
4. **Copy the authorization code** from the redirect URL
5. **Paste the code** when the bot prompts for it

Example output:
```
🔐 OAUTH SETUP REQUIRED:
1. Open this URL in your browser:
https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=...

2. Click "Allow" and copy the code
3. Paste the code here and press Enter:
Enter code: 4/0AbCD...xyz123  # ← Paste your code here
```

### 5. Success!
After authorization:
```
✅ Token saved! OAuth setup complete.
📊 Creating new spreadsheet...
✅ Spreadsheet created: WhatsApp Messages Log
🔒 Using your personal Google Drive storage via OAuth
```

## 🎯 Benefits of OAuth Approach

### ✅ **Advantages:**
- **Uses your Google Drive storage** (100GB+ with Google One)
- **No quota limitations** like service accounts
- **Automatic spreadsheet creation** works perfectly
- **One-time setup** - token saved for future use
- **Your ownership** - spreadsheets appear in your Drive

### ⚠️ **Note:**
- Requires **one-time browser authorization**
- **Token stored locally** in `oauth-token.json` (auto-generated, gitignored)
- **Works offline** after initial authorization

## 🔧 Manual Spreadsheet ID (Alternative)

If you prefer to use an existing spreadsheet:

**Option A: Environment Variable**
```bash
export GOOGLE_SHEETS_ID="your-spreadsheet-id-here"
```

**Option B: Config File**
```bash
echo '{"spreadsheetId": "your-spreadsheet-id-here"}' > sheets-config.json
```

## 🧪 Testing

Test OAuth credentials detection:
```bash
bun run tests/test-oauth-detection.ts
```

Test full integration:
```bash
# After OAuth setup is complete:
bun run tests/test-sheets.ts
```

## 🔐 Security

- **OAuth credentials**: Stored in `google-credentials/` (gitignored)
- **Access tokens**: Auto-saved in `google-credentials/oauth-token.json`
- **Minimal permissions**: Only Google Sheets + Drive file creation
- **Local storage**: No cloud storage or service account keys required
- **Auto-refresh**: Tokens refresh automatically without re-authorization

Your WhatsApp messages will now be automatically logged to Google Sheets using your personal storage! 🎉
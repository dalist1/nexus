# OAuth Credentials

## 📁 Drag & Drop Zone

Simply **drag your OAuth credentials JSON file here** to enable Google Sheets integration with your personal Google Drive storage.

### ✅ What to do:
1. Create OAuth 2.0 Client ID in Google Cloud Console (Desktop application)
2. Download the credentials JSON file
3. Drag the JSON file into this folder
4. Start the bot - it will guide you through browser authorization

### 📝 Example:
```
google-credentials/
├── README.md                                    ← This file (for guidance)
└── client_secret_123456789-abc.json           ← Your dragged OAuth file
```

### 🔒 Security:
- JSON files in this folder are automatically ignored by git
- Your credentials stay local and secure
- OAuth tokens are also automatically gitignored
- No need to rename files - any valid OAuth JSON works

### 💡 Need help?
See the [Google Sheets Setup Guide](../docs/GOOGLE_SHEETS_SETUP.md) for detailed instructions.
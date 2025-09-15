# WhatsApp AI Bot 🤖

A **simple yet powerful WhatsApp bot** powered by Google's Gemini AI that can:
- 🧠 **Answer questions intelligently** using advanced AI
- 🔍 **Search the web** for real-time information
- 💻 **Execute code** and solve programming problems
- 🤔 **Think through complex problems** step-by-step
- 📊 **Log conversations** to Google Sheets (optional)
- 🌐 **REST API** for external integrations

## 🚀 Quick Start

### 1. Install Bun
```bash
# Linux & macOS
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. Install & Configure
```bash
bun install
echo "GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here" > .env
```
Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 3. Start the Bot
```bash
bun start
```

**That's it!** Scan the QR code with WhatsApp and start chatting.

## 💬 How It Works

Send messages to your bot:
- `ping` - Test connectivity
- `/help` - Show commands
- Regular messages - AI conversation
- `/search <query>` - Web search + AI analysis
- `/code <problem>` - Code execution
- `/think <problem>` - Deep reasoning mode

## 🌐 REST API

The bot runs on port **8080** with endpoints:
- `GET /api/health` - Health check
- `POST /api/message` - Send WhatsApp message
- `POST /api/ai` - AI chat with tools
- `GET|DELETE /api/conversation/:chatId` - Manage conversations

## 📊 Google Sheets (Optional)

Auto-log conversations to Google Sheets:
1. Follow setup guide: [`docs/GOOGLE_SHEETS_SETUP.md`](docs/GOOGLE_SHEETS_SETUP.md)
2. Drop OAuth credentials into `google-credentials/` folder
3. Restart bot - auto-detects and sets up everything

## 🛠️ Development

```bash
bun start         # Start the bot
bun test          # Run tests
bun run typecheck # Check TypeScript
bunx knip         # Check unused deps
```

**Built with TypeScript, Bun, Google Gemini, Baileys & Express.js**
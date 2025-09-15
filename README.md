# WhatsApp AI Bot

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
- **Any message** - AI conversation with context memory
- `/ai <question>` - Simple AI questions without tools
- `/search <query>` - Web search + AI analysis
- `/code <problem>` - Code execution + AI help
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

## 🔄 How It Works

**Data Flow:**
1. **WhatsApp** → Bot receives message via Baileys WebSocket
2. **AI Processing** → Google Gemini analyzes with context memory
3. **Tool Integration** → Optional web search, code execution, or reasoning
4. **Response** → AI generates reply sent back to WhatsApp
5. **Optional Logging** → Message data saved to Google Sheets via OAuth

**Implementation:**
- **Frontend**: WhatsApp Web protocol (Baileys)
- **Backend**: TypeScript + Bun runtime
- **AI**: Google Gemini with conversation memory
- **Storage**: In-memory (24hr) + optional Google Sheets
- **API**: Express.js REST endpoints on port 8080

## 🛠️ Development

```bash
bun start         # Start the bot
bun test          # Run tests
bun run typecheck # Check TypeScript
bunx knip         # Check unused deps
```

**Built with TypeScript, Bun, Google Gemini, Baileys & Express.js**
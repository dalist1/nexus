export function shouldTriggerAI(content: string): boolean {
  const lowerContent = content.toLowerCase().trim();
  return lowerContent.startsWith('/ai') || lowerContent.startsWith('/search');
}

export function parseAICommand(content: string): {
  useSearch: boolean;
  useUrlContext: boolean;
  useCodeExecution: boolean;
  useThinking: boolean;
  prompt: string;
  isHelp: boolean;
} {
  const lowerContent = content.toLowerCase().trim();

  let useSearch = false;
  let useUrlContext = false;
  let useCodeExecution = false;
  let useThinking = false;
  let prompt = content;
  let isHelp = false;

  if (lowerContent.startsWith('/search')) {
    useSearch = true;
    prompt = content.replace(/^\/search\s*/i, '');
  } else if (lowerContent.startsWith('/code')) {
    useCodeExecution = true;
    prompt = content.replace(/^\/code\s*/i, '');
  } else if (lowerContent.startsWith('/think')) {
    useThinking = true;
    prompt = content.replace(/^\/think\s*/i, '');
  } else if (lowerContent.startsWith('/ai')) {
    prompt = content.replace(/^\/ai\s*/i, '');
  } else if (lowerContent.startsWith('/ask')) {
    prompt = content.replace(/^\/ask\s*/i, '');
  }

  return { useSearch, useUrlContext, useCodeExecution, useThinking, prompt, isHelp: false };
}

export function generateHelpMessage(sheetsConnected: boolean): string {
  const sheetsStatus = sheetsConnected ? '✅ Connected' : '❌ Not configured';

  return `🤖 AI WhatsApp Bot Commands:

/ai [message] - Ask AI a question (with conversation context)
/search [query] - Search the web for real-time information
/code [problem] - Get help with coding problems (Python execution)
/think [complex question] - Use AI reasoning for complex problems
/help - Show this help message
ping - Test bot connectivity

📱 Media Support:
• Send images with /ai command for visual analysis
• Send documents for content analysis
• Audio messages are transcribed and analyzed

🧠 Smart Features:
• Conversation memory (remembers context)
• Real-time web search with sources
• Code execution for calculations
• Multi-modal understanding (text + images)

📊 Google Sheets Auto-save: ${sheetsStatus}
${sheetsConnected ? '• Messages are automatically saved to Google Sheets' : '• Configure service-account-key.json to enable'}

Examples:
/ai What's the weather like?
/search latest AI breakthroughs 2024
/code Calculate fibonacci sequence
/think Explain quantum computing simply

💡 Pro Tip: Send an image with "/ai analyze this" for detailed visual analysis!`;
}

export function formatToolUsage(toolCalls: any[]): string[] {
  const toolsUsed: string[] = [];
  if (toolCalls && toolCalls.length > 0) {
    toolCalls.forEach(tc => {
      const toolType = tc.type || tc.toolName;
      if (toolType === 'google_search') toolsUsed.push('🔍 Web Search');
      if (toolType === 'code_execution') toolsUsed.push('💻 Code Execution');
      if (toolType === 'url_context') toolsUsed.push('🔗 URL Context');
    });
  }
  return toolsUsed;
}
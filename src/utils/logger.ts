interface LogContext {
  sender?: string;
  chat?: string;
  messageType?: string;
  content?: string;
  toolsUsed?: string[];
  responseLength?: number;
  executionTime?: number;
}

export class Logger {
  private static getTimestamp(): string {
    return new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private static formatContext(context?: LogContext): string {
    if (!context) return '';

    const parts = [];
    if (context.sender) parts.push(`👤 ${context.sender}`);
    if (context.chat) parts.push(`💬 ${context.chat}`);
    if (context.messageType) parts.push(`📝 ${context.messageType}`);
    if (context.toolsUsed?.length) parts.push(`🛠️  [${context.toolsUsed.join(', ')}]`);
    if (context.responseLength) parts.push(`📊 ${context.responseLength} chars`);
    if (context.executionTime) parts.push(`⏱️  ${context.executionTime}ms`);

    return parts.length > 0 ? ` ${parts.join(' • ')}` : '';
  }

  // System & Connection logs
  static system(message: string): void {
    console.log(`🤖 [${this.getTimestamp()}] ${message}`);
  }

  static connection(message: string): void {
    console.log(`🔗 [${this.getTimestamp()}] ${message}`);
  }

  static auth(message: string): void {
    console.log(`🔐 [${this.getTimestamp()}] ${message}`);
  }

  // Message handling logs
  static message(message: string, context?: LogContext): void {
    const contextStr = this.formatContext(context);
    console.log(`💬 [${this.getTimestamp()}] ${message}${contextStr}`);
  }

  static ai(message: string, context?: LogContext): void {
    const contextStr = this.formatContext(context);
    console.log(`🧠 [${this.getTimestamp()}] ${message}${contextStr}`);
  }

  static tools(message: string, tools: string[]): void {
    const toolsStr = tools.length > 0 ? ` 🛠️  [${tools.join(', ')}]` : '';
    console.log(`⚡ [${this.getTimestamp()}] ${message}${toolsStr}`);
  }

  static search(query: string, results: number): void {
    console.log(`🔍 [${this.getTimestamp()}] Google Search: "${query}" → ${results} results`);
  }

  static database(message: string, context?: LogContext): void {
    const contextStr = this.formatContext(context);
    console.log(`💾 [${this.getTimestamp()}] ${message}${contextStr}`);
  }

  // Error & Warning logs
  static error(message: string, error?: any): void {
    console.error(`❌ [${this.getTimestamp()}] ${message}${error ? ` → ${error.message || error}` : ''}`);
  }

  static warn(message: string): void {
    console.warn(`⚠️  [${this.getTimestamp()}] ${message}`);
  }

  static success(message: string, context?: LogContext): void {
    const contextStr = this.formatContext(context);
    console.log(`✅ [${this.getTimestamp()}] ${message}${contextStr}`);
  }

  // API logs
  static api(message: string): void {
    console.log(`🌐 [${this.getTimestamp()}] ${message}`);
  }

  static health(message: string): void {
    console.log(`💚 [${this.getTimestamp()}] ${message}`);
  }

  // Debug (only show when needed)
  static debug(message: string): void {
    if (process.env.DEBUG === 'true') {
      console.log(`🐛 [${this.getTimestamp()}] ${message}`);
    }
  }

  // Separator for clean organization
  static separator(): void {
    console.log('─'.repeat(80));
  }

  // Start/Stop session logs
  static session(message: string): void {
    console.log(`\n🚀 [${this.getTimestamp()}] ${message}`);
    this.separator();
  }

  static shutdown(message: string): void {
    this.separator();
    console.log(`🛑 [${this.getTimestamp()}] ${message}\n`);
  }
}
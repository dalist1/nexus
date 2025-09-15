import { WhatsAppBot } from './src/bot/whatsapp-bot';
import { Logger } from './src/utils/logger';

const bot = new WhatsAppBot();
['SIGINT', 'SIGTERM'].forEach(signal =>
  process.on(signal, () => {
    Logger.shutdown('Shutting down bot...');
    bot.cleanup();
    process.exit(0);
  })
);
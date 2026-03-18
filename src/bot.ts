import { Bot } from 'grammy';
import { BotContext } from './types/index.js';
import { initNotifications } from './services/notifications.js';

// Import handlers
import { handleStart } from './handlers/start.js';
import { handleHelp } from './handlers/help.js';
import { handleCallbackQuery } from './handlers/callbacks.js';

// Import middleware
import { errorMiddleware } from './middleware/error.js';

// Validate bot token
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

// Create bot instance
export const bot = new Bot<BotContext>(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Initialize bot with all handlers and middleware
 */
export function initializeBot(): void {
  console.log('Initializing bot...');

  // Initialize notification service
  initNotifications(bot);

  // Register error handler first
  bot.catch(errorMiddleware);

  // Register command handlers
  bot.command('start', handleStart);
  bot.command('help', handleHelp);

  // Register callback query handler
  bot.on('callback_query:data', handleCallbackQuery);

  // More commands will be added in later phases:
  // bot.command('lfg', authMiddleware, handleLfg);
  // bot.command('browse', authMiddleware, handleBrowse);
  // bot.command('mygroups', authMiddleware, handleMyGroups);
  // bot.command('resources', authMiddleware, handleResources);
  // bot.command('checkout', authMiddleware, handleCheckout);
  // bot.command('admin', authMiddleware, adminMiddleware, handleAdmin);

  console.log('Bot initialized successfully');
}

import { Bot } from 'grammy';
import { BotContext } from './types/index.js';
import { initNotifications } from './services/notifications.js';

// Import handlers
import { handleStart } from './handlers/start.js';
import { handleHelp } from './handlers/help.js';
import { handleCallbackQuery } from './handlers/callbacks.js';
import {
  handleAdmin,
  handleApproveCommand,
  handleRejectCommand,
} from './handlers/admin.js';
import { handleResources } from './handlers/resources.js';
import { handleCheckout } from './handlers/checkout.js';
import {
  handleResourceCreationInput,
  isInResourceCreationFlow,
} from './handlers/adminResources.js';

// Import middleware
import { errorMiddleware } from './middleware/error.js';
import { authMiddleware } from './middleware/auth.js';
import { adminMiddleware } from './middleware/admin.js';

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

  // Resource commands (require auth middleware)
  bot.command('resources', authMiddleware, handleResources);
  bot.command('checkout', authMiddleware, handleCheckout);

  // Admin commands (require both auth and admin middleware)
  bot.command('admin', authMiddleware, adminMiddleware, handleAdmin);
  bot.command('approve', authMiddleware, adminMiddleware, handleApproveCommand);
  bot.command('reject', authMiddleware, adminMiddleware, handleRejectCommand);

  // Register callback query handler
  bot.on('callback_query:data', handleCallbackQuery);

  // Text message handler for multi-step flows (e.g., resource creation)
  bot.on('message:text', async (ctx) => {
    // Check if user is in resource creation flow
    if (ctx.from && isInResourceCreationFlow(ctx.from.id)) {
      const handled = await handleResourceCreationInput(ctx);
      if (handled) return;
    }

    // Future: Add other text input handlers here (group creation, etc.)
  });

  // More commands will be added in later phases:
  // bot.command('lfg', authMiddleware, handleLfg);
  // bot.command('browse', authMiddleware, handleBrowse);
  // bot.command('mygroups', authMiddleware, handleMyGroups);

  console.log('Bot initialized successfully');
}

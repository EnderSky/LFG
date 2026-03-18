import { Bot } from 'grammy';
import { BotContext } from './types/index.js';
import { initNotifications } from './services/notifications.js';
import { initTelegramService } from './services/telegram.js';

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
import { handleLfg, handleLfgTitleInput, isInLfgCreationFlow, getLfgCreationStep } from './handlers/lfg.js';
import { handleBrowse } from './handlers/browse.js';
import { handleMyGroups } from './handlers/groups.js';
import { handleChannelInput, isInChannelConfigFlow } from './handlers/adminSettings.js';
import { handleCategoryCreationInput, isInCategoryCreationFlow } from './handlers/adminCategories.js';

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

  // Initialize services that need bot instance
  initNotifications(bot);
  initTelegramService(bot);

  // Register error handler first
  bot.catch(errorMiddleware);

  // Register command handlers
  bot.command('start', handleStart);
  bot.command('help', handleHelp);

  // Resource commands (require auth middleware)
  bot.command('resources', authMiddleware, handleResources);
  bot.command('checkout', authMiddleware, handleCheckout);

  // Group commands (require auth middleware)
  bot.command('lfg', authMiddleware, handleLfg);
  bot.command('browse', authMiddleware, handleBrowse);
  bot.command('mygroups', authMiddleware, handleMyGroups);

  // Admin commands (require both auth and admin middleware)
  bot.command('admin', authMiddleware, adminMiddleware, handleAdmin);
  bot.command('approve', authMiddleware, adminMiddleware, handleApproveCommand);
  bot.command('reject', authMiddleware, adminMiddleware, handleRejectCommand);

  // Register callback query handler
  bot.on('callback_query:data', handleCallbackQuery);

  // Text message handler for multi-step flows
  bot.on('message:text', async (ctx) => {
    // Check if user is in channel config flow (admin)
    if (ctx.from && isInChannelConfigFlow(ctx.from.id)) {
      const handled = await handleChannelInput(ctx);
      if (handled) return;
    }

    // Check if user is in category creation flow (admin)
    if (ctx.from && isInCategoryCreationFlow(ctx.from.id)) {
      const handled = await handleCategoryCreationInput(ctx);
      if (handled) return;
    }

    // Check if user is in resource creation flow (admin)
    if (ctx.from && isInResourceCreationFlow(ctx.from.id)) {
      const handled = await handleResourceCreationInput(ctx);
      if (handled) return;
    }

    // Check if user is in LFG creation flow (title step)
    if (ctx.from && isInLfgCreationFlow(ctx.from.id)) {
      const step = getLfgCreationStep(ctx.from.id);
      if (step === 'title') {
        const handled = await handleLfgTitleInput(ctx);
        if (handled) return;
      }
    }

    // No handler matched - ignore unknown text messages
  });

  console.log('Bot initialized successfully');
}

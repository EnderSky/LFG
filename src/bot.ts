import { Bot } from 'grammy';
import { BotContext } from './types/index.js';
import { initNotifications } from './services/notifications.js';
import { initTelegramService } from './services/telegram.js';
import { log } from './utils/logger.js';

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
import {
  commandRateLimit,
  callbackRateLimit,
  adminRateLimit,
} from './middleware/rateLimit.js';

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
  log.info('Initializing bot...', { 
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
  });

  // Initialize services that need bot instance
  initNotifications(bot);
  initTelegramService(bot);

  // Register error handler first
  bot.catch(errorMiddleware);

  // Register command handlers with rate limiting
  bot.command('start', commandRateLimit, handleStart);
  bot.command('help', commandRateLimit, handleHelp);

  // Resource commands (require auth middleware + rate limiting)
  bot.command('resources', commandRateLimit, authMiddleware, handleResources);
  bot.command('checkout', commandRateLimit, authMiddleware, handleCheckout);

  // Group commands (require auth middleware + rate limiting)
  bot.command('lfg', commandRateLimit, authMiddleware, handleLfg);
  bot.command('browse', commandRateLimit, authMiddleware, handleBrowse);
  bot.command('mygroups', commandRateLimit, authMiddleware, handleMyGroups);

  // Admin commands (require auth, admin, and admin rate limit middleware)
  bot.command('admin', commandRateLimit, authMiddleware, adminMiddleware, adminRateLimit, handleAdmin);
  bot.command('approve', commandRateLimit, authMiddleware, adminMiddleware, adminRateLimit, handleApproveCommand);
  bot.command('reject', commandRateLimit, authMiddleware, adminMiddleware, adminRateLimit, handleRejectCommand);

  // Register callback query handler with rate limiting
  bot.on('callback_query:data', callbackRateLimit, handleCallbackQuery);

  // Text message handler for multi-step flows
  bot.on('message:text', commandRateLimit, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      // Check if user is in channel config flow (admin)
      if (isInChannelConfigFlow(userId)) {
        const handled = await handleChannelInput(ctx);
        if (handled) return;
      }

      // Check if user is in category creation flow (admin)
      if (isInCategoryCreationFlow(userId)) {
        const handled = await handleCategoryCreationInput(ctx);
        if (handled) return;
      }

      // Check if user is in resource creation flow (admin)
      if (isInResourceCreationFlow(userId)) {
        const handled = await handleResourceCreationInput(ctx);
        if (handled) return;
      }

      // Check if user is in LFG creation flow (title step)
      if (isInLfgCreationFlow(userId)) {
        const step = getLfgCreationStep(userId);
        if (step === 'title') {
          const handled = await handleLfgTitleInput(ctx);
          if (handled) return;
        }
      }

      // No handler matched - log unhandled text message
      log.debug('Unhandled text message', {
        userId: userId.toString(),
        telegramId: userId,
        messageLength: ctx.message?.text?.length,
        messagePreview: ctx.message?.text?.substring(0, 50),
      });
    } catch (error) {
      log.error('Error in text message handler', {
        userId: userId.toString(),
        telegramId: userId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  });

  log.info('Bot initialized successfully');
}

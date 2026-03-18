import { BotContext } from '../types/index.js';
import { BotError, GrammyError, HttpError } from 'grammy';
import { log } from '../utils/logger.js';

/**
 * Global error handler for the bot
 */
export async function errorMiddleware(err: BotError<BotContext>): Promise<void> {
  const ctx = err.ctx;
  const error = err.error;
  
  // Extract context information
  const logContext = {
    updateId: ctx.update.update_id,
    userId: ctx.from?.id?.toString(),
    telegramId: ctx.from?.id,
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    error: error instanceof Error ? error : new Error(String(error)),
  };

  if (error instanceof GrammyError) {
    log.error('Telegram API error occurred', {
      ...logContext,
      errorCode: error.error_code,
      description: error.description,
      type: 'grammy_error',
    });

    // Handle specific error types
    if (error.error_code === 403) {
      // User blocked the bot
      log.info('User blocked the bot', {
        userId: ctx.from?.id?.toString(),
        telegramId: ctx.from?.id,
      });
      return; // Don't try to send a message
    }

    if (error.error_code === 400 && error.description.includes('message is not modified')) {
      // Message content is the same - not a real error
      log.debug('Attempted to edit message with same content', logContext);
      return;
    }

    // Try to notify user of API error
    try {
      await ctx.reply('❌ Unable to process your request due to a technical issue. Please try again.');
    } catch (notifyError) {
      log.error('Failed to send error notification to user', {
        ...logContext,
        notifyError: notifyError instanceof Error ? notifyError : new Error(String(notifyError)),
      });
    }
  } else if (error instanceof HttpError) {
    log.error('Network error contacting Telegram', {
      ...logContext,
      type: 'http_error',
    });

    // Don't try to notify user for network errors
  } else {
    log.error('Unknown error occurred', {
      ...logContext,
      type: 'unknown_error',
    });

    // Try to notify user of unknown error
    try {
      await ctx.reply('❌ An unexpected error occurred. Please try again later.');
    } catch (notifyError) {
      log.error('Failed to send error notification to user', {
        ...logContext,
        notifyError: notifyError instanceof Error ? notifyError : new Error(String(notifyError)),
      });
    }
  }
}

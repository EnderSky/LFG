import { BotContext } from '../types/index.js';
import { BotError, GrammyError, HttpError } from 'grammy';

/**
 * Global error handler for the bot
 */
export async function errorMiddleware(err: BotError<BotContext>): Promise<void> {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  
  const error = err.error;
  
  if (error instanceof GrammyError) {
    console.error('Error in request:', error.description);
    
    // Try to notify user if possible
    try {
      await ctx.reply('❌ An error occurred processing your request. Please try again.');
    } catch (e) {
      console.error('Failed to send error message to user:', e);
    }
  } else if (error instanceof HttpError) {
    console.error('Could not contact Telegram:', error);
  } else {
    console.error('Unknown error:', error);
    
    // Try to notify user
    try {
      await ctx.reply('❌ An unexpected error occurred. Please try again later.');
    } catch (e) {
      console.error('Failed to send error message to user:', e);
    }
  }
}

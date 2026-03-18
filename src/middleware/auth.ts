import { BotContext } from '../types/index.js';
import { getUserByTelegramId } from '../services/users.js';

/**
 * Authentication middleware
 * Checks if user exists and is approved before allowing access to commands
 */
export async function authMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }

  try {
    // Get user from database
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('❌ You need to register first. Please use /start to begin.');
      return;
    }

    if (user.status === 'banned') {
      await ctx.reply('❌ Your access has been revoked. Please contact hostel staff.');
      return;
    }

    if (user.status === 'pending') {
      await ctx.reply('⏳ Your access request is pending approval. Please wait for an admin to approve you.');
      return;
    }

    // User is approved, attach to context
    ctx.dbUser = user;
    
    // Continue to next handler
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    await ctx.reply('❌ An error occurred. Please try again later.');
  }
}

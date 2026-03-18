import { BotContext } from '../types/index.js';
import { isUserAdmin } from '../services/admins.js';

/**
 * Admin authorization middleware
 * Verifies user is an admin before allowing access to admin commands
 * 
 * Requirements:
 * - authMiddleware must run BEFORE this middleware
 * - ctx.dbUser must be populated
 */
export async function adminMiddleware(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  // Verify authMiddleware has run
  if (!ctx.dbUser) {
    await ctx.reply('❌ Authentication required.');
    return;
  }

  try {
    // Check admin status
    const isAdmin = await isUserAdmin(ctx.dbUser.id);

    if (!isAdmin) {
      await ctx.reply('❌ This command is only available to admins.');
      return;
    }

    // Attach admin flag to context
    ctx.isAdmin = true;

    // Continue to handler
    await next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    await ctx.reply('❌ An error occurred while verifying admin status.');
  }
}

import { BotContext } from '../types/index.js';
import { isUserAdminByTelegramId } from '../services/admins.js';
import { formatHelpMessage, formatAdminHelpMessage } from '../utils/formatting.js';

/**
 * Handle /help command
 * Shows available commands based on user role
 */
export async function handleHelp(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }

  try {
    // Check if user is an admin
    const isAdmin = await isUserAdminByTelegramId(telegramId);

    if (isAdmin) {
      await ctx.reply(formatAdminHelpMessage());
    } else {
      await ctx.reply(formatHelpMessage());
    }
  } catch (error) {
    console.error('Error in /help handler:', error);
    // Fall back to regular help if there's an error
    await ctx.reply(formatHelpMessage());
  }
}

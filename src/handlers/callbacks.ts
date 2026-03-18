import { BotContext } from '../types/index.js';
import { handleHostelSelection } from './start.js';

/**
 * Central callback query router
 * Routes callback queries to appropriate handlers
 */
export async function handleCallbackQuery(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data) {
    await ctx.answerCallbackQuery({ text: '❌ Invalid callback data.' });
    return;
  }

  try {
    // Parse callback data format: "action:param1:param2..."
    const [action, ...params] = data.split(':');

    switch (action) {
      case 'hostel':
        if (params[0]) {
          await handleHostelSelection(ctx, params[0]);
        }
        break;

      // More cases will be added in later phases:
      // case 'approve_user':
      // case 'reject_user':
      // case 'join_group':
      // case 'leave_group':
      // case 'checkin_resource':
      // case 'checkout_resource':
      // etc.

      default:
        await ctx.answerCallbackQuery({ text: '❌ Unknown action.' });
        console.warn(`Unknown callback action: ${action}`);
    }
  } catch (error) {
    console.error('Error in callback query handler:', error);
    await ctx.answerCallbackQuery({ text: '❌ An error occurred.' });
  }
}

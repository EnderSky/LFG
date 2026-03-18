import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import {
  getResourcesByHostel,
  getResourceById,
  checkInResource,
  getUserActiveSessionCount,
  isResourceAvailable,
  ResourceWithStatus,
} from '../services/resources.js';
import { EMOJI, CONFIG } from '../utils/constants.js';
import { formatTimeRemaining } from '../utils/datetime.js';

/**
 * Resources handler for users
 * Allows viewing resources and checking in
 */

/**
 * /resources command - Show all resources for user's hostel
 */
export async function handleResources(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.reply('❌ Authentication required.');
    return;
  }

  try {
    const resources = await getResourcesByHostel(ctx.dbUser.hostel_id);

    if (resources.length === 0) {
      await ctx.reply('No resources available at your hostel yet.');
      return;
    }

    // Group resources by category
    const grouped = groupResourcesByCategory(resources);

    // Build message
    let message = `${EMOJI.LOCATION} Resources at your hostel\n\n`;

    const keyboard = new InlineKeyboard();

    for (const [categoryName, categoryResources] of grouped) {
      const icon = categoryResources[0]?.category_icon || '📦';
      message += `${icon} <b>${categoryName}</b>\n`;

      for (const resource of categoryResources) {
        const statusIcon = resource.is_available ? EMOJI.AVAILABLE : EMOJI.IN_USE;
        const statusText = resource.is_available ? 'Available' : 'In use';

        message += `  ${statusIcon} ${resource.name} - ${statusText}`;

        if (!resource.is_available && resource.current_session) {
          const timeLeft = formatTimeRemaining(new Date(resource.current_session.auto_checkout_at));
          message += ` (${timeLeft} left)`;
        }
        message += '\n';

        // Add button for each resource
        const buttonText = resource.is_available
          ? `${EMOJI.AVAILABLE} ${resource.name}`
          : `${EMOJI.IN_USE} ${resource.name}`;
        keyboard.text(buttonText, `resource:view:${resource.id}`).row();
      }
      message += '\n';
    }

    message += `\n${EMOJI.INFO} Tap a resource to see details or check in.`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.reply(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });
    }
  } catch (error) {
    console.error('Error showing resources:', error);
    await ctx.reply('❌ Error loading resources. Please try again.');
  }
}

/**
 * View single resource details
 */
export async function handleResourceView(ctx: BotContext, resourceId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery('❌ Authentication required.');
    return;
  }

  try {
    const resource = await getResourceById(resourceId);

    if (!resource) {
      await ctx.answerCallbackQuery('❌ Resource not found.');
      return;
    }

    // Build message
    const statusIcon = resource.is_available ? EMOJI.AVAILABLE : EMOJI.IN_USE;
    const statusText = resource.is_available ? 'Available' : 'In use';

    let message = `${resource.category_icon || '📦'} <b>${resource.name}</b>\n\n`;
    message += `Status: ${statusIcon} ${statusText}\n`;

    if (resource.description) {
      message += `\n${resource.description}\n`;
    }

    message += `\nMax duration: ${resource.max_duration_hours} hours\n`;

    if (!resource.is_available && resource.current_session) {
      const timeLeft = formatTimeRemaining(new Date(resource.current_session.auto_checkout_at));
      message += `\n${EMOJI.USER} Used by: ${resource.current_session.user_name}\n`;
      message += `${EMOJI.CLOCK} Time remaining: ${timeLeft}\n`;
    }

    // Build keyboard
    const keyboard = new InlineKeyboard();

    if (resource.is_available) {
      keyboard.text(`${EMOJI.JOIN} Check In`, `resource:checkin:${resource.id}`).row();
    } else if (resource.current_session?.user_id === ctx.dbUser.id) {
      // User is the one using this resource
      keyboard.text(`${EMOJI.LEAVE} Check Out`, `resource:checkout:${resource.id}`).row();
    }

    keyboard.text(`${EMOJI.BACK} Back to Resources`, 'resource:list');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error viewing resource:', error);
    await ctx.answerCallbackQuery('❌ Error loading resource details.');
  }
}

/**
 * Check in to a resource
 */
export async function handleResourceCheckIn(ctx: BotContext, resourceId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery('❌ Authentication required.');
    return;
  }

  try {
    // Check if user has too many active sessions
    const activeCount = await getUserActiveSessionCount(ctx.dbUser.id);
    if (activeCount >= CONFIG.MAX_ACTIVE_RESOURCE_SESSIONS) {
      await ctx.answerCallbackQuery(
        `❌ You can only have ${CONFIG.MAX_ACTIVE_RESOURCE_SESSIONS} active resource sessions.`
      );
      return;
    }

    // Check if resource is still available
    const available = await isResourceAvailable(resourceId);
    if (!available) {
      await ctx.answerCallbackQuery('❌ This resource is no longer available.');
      // Refresh the view
      await handleResourceView(ctx, resourceId);
      return;
    }

    // Check in
    await checkInResource(resourceId, ctx.dbUser.id);

    // Get resource details for confirmation
    const resource = await getResourceById(resourceId);

    await ctx.answerCallbackQuery(`✅ Checked in to ${resource?.name}!`);

    // Show updated resource view
    await handleResourceView(ctx, resourceId);
  } catch (error) {
    console.error('Error checking in to resource:', error);
    await ctx.answerCallbackQuery('❌ Error checking in. Please try again.');
  }
}

/**
 * Check out from a resource (from resource view)
 */
export async function handleResourceCheckOut(ctx: BotContext, resourceId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery('❌ Authentication required.');
    return;
  }

  try {
    const resource = await getResourceById(resourceId);

    if (!resource) {
      await ctx.answerCallbackQuery('❌ Resource not found.');
      return;
    }

    // Verify user is the one using this resource
    if (resource.current_session?.user_id !== ctx.dbUser.id) {
      await ctx.answerCallbackQuery('❌ You are not checked into this resource.');
      return;
    }

    // Import checkout function
    const { checkOutResource } = await import('../services/resources.js');
    await checkOutResource(resource.current_session.id);

    await ctx.answerCallbackQuery(`✅ Checked out of ${resource.name}!`);

    // Show updated resource view
    await handleResourceView(ctx, resourceId);
  } catch (error) {
    console.error('Error checking out from resource:', error);
    await ctx.answerCallbackQuery('❌ Error checking out. Please try again.');
  }
}

/**
 * Group resources by category
 */
function groupResourcesByCategory(resources: ResourceWithStatus[]): Map<string, ResourceWithStatus[]> {
  const grouped = new Map<string, ResourceWithStatus[]>();

  for (const resource of resources) {
    const categoryName = resource.category_name || 'Uncategorized';
    if (!grouped.has(categoryName)) {
      grouped.set(categoryName, []);
    }
    grouped.get(categoryName)!.push(resource);
  }

  return grouped;
}

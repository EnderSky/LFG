import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import {
  getResourcesByHostel,
  getResourceById,
  createResource,
  deleteResource,
  getActiveSessionsByHostel,
  forceCheckout,
} from '../services/resources.js';
import { getCategoriesForHostel } from '../services/categories.js';
import { EMOJI } from '../utils/constants.js';
import { formatTimeRemaining } from '../utils/datetime.js';

/**
 * Admin resource management handlers
 */

// Temporary storage for resource creation flow
const resourceCreationState = new Map<number, {
  step: 'name' | 'description' | 'category' | 'duration';
  name?: string;
  description?: string;
  categoryId?: string | null;
  maxDuration?: number;
}>();

/**
 * Show admin resource management panel
 */
export async function handleAdminResources(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const resources = await getResourcesByHostel(ctx.dbUser.hostel_id);

    let message = `${EMOJI.TOOLS} Resource Management\n\n`;

    if (resources.length === 0) {
      message += 'No resources configured yet.\n';
    } else {
      message += `Total: ${resources.length} resource${resources.length > 1 ? 's' : ''}\n\n`;

      // Group by availability
      const available = resources.filter(r => r.is_available);
      const inUse = resources.filter(r => !r.is_available);

      message += `${EMOJI.AVAILABLE} Available: ${available.length}\n`;
      message += `${EMOJI.IN_USE} In use: ${inUse.length}\n`;
    }

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.JOIN} Add Resource`, 'admin:resource:add')
      .row()
      .text(`📋 View All Resources`, 'admin:resource:list')
      .row()
      .text(`${EMOJI.IN_USE} Active Sessions`, 'admin:resource:sessions')
      .row()
      .text(`${EMOJI.BACK} Back to Admin Panel`, 'admin:panel');

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
    console.error('Error showing admin resources:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery('❌ Error loading resources.');
    } else {
      await ctx.reply('❌ Error loading resources.');
    }
  }
}

/**
 * List all resources with edit/delete options
 */
export async function handleAdminResourceList(ctx: BotContext, page: number = 1): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const resources = await getResourcesByHostel(ctx.dbUser.hostel_id);
    const PAGE_SIZE = 5;

    if (resources.length === 0) {
      const keyboard = new InlineKeyboard()
        .text(`${EMOJI.JOIN} Add Resource`, 'admin:resource:add')
        .row()
        .text(`${EMOJI.BACK} Back`, 'admin:resources');

      await ctx.editMessageText('No resources configured yet.', {
        reply_markup: keyboard,
      });
      return;
    }

    // Paginate
    const totalPages = Math.ceil(resources.length / PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE;
    const pageResources = resources.slice(startIdx, startIdx + PAGE_SIZE);

    let message = `📋 All Resources (${resources.length})\n\n`;

    const keyboard = new InlineKeyboard();

    for (const resource of pageResources) {
      const statusIcon = resource.is_available ? EMOJI.AVAILABLE : EMOJI.IN_USE;
      const categoryIcon = resource.category_icon || '📦';

      message += `${statusIcon} ${categoryIcon} <b>${resource.name}</b>\n`;
      if (resource.description) {
        message += `   ${resource.description}\n`;
      }
      message += `   Max: ${resource.max_duration_hours}h\n\n`;

      keyboard
        .text(`✏️ ${resource.name}`, `admin:resource:edit:${resource.id}`)
        .text(`🗑️`, `admin:resource:delete:${resource.id}`)
        .row();
    }

    // Pagination
    if (totalPages > 1) {
      if (page > 1) {
        keyboard.text(`${EMOJI.BACK} Prev`, `admin:resource:list:${page - 1}`);
      }
      keyboard.text(`${page}/${totalPages}`, 'noop');
      if (page < totalPages) {
        keyboard.text(`Next ▶️`, `admin:resource:list:${page + 1}`);
      }
      keyboard.row();
    }

    keyboard.text(`${EMOJI.BACK} Back`, 'admin:resources');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error listing resources:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading resources.');
  }
}

/**
 * Show active sessions for admin
 */
export async function handleAdminActiveSessions(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const sessions = await getActiveSessionsByHostel(ctx.dbUser.hostel_id);

    if (sessions.length === 0) {
      const keyboard = new InlineKeyboard().text(`${EMOJI.BACK} Back`, 'admin:resources');

      await ctx.editMessageText('No active sessions.', {
        reply_markup: keyboard,
      });
      return;
    }

    let message = `${EMOJI.IN_USE} Active Sessions (${sessions.length})\n\n`;

    const keyboard = new InlineKeyboard();

    for (const session of sessions) {
      const timeLeft = formatTimeRemaining(new Date(session.auto_checkout_at));
      const userName = session.users?.username
        ? `@${session.users.username}`
        : session.users?.first_name || 'Unknown';

      message += `<b>${session.resources?.name}</b>\n`;
      message += `   ${EMOJI.USER} ${userName}\n`;
      message += `   ${EMOJI.CLOCK} ${timeLeft} remaining\n\n`;

      keyboard
        .text(`Force checkout: ${session.resources?.name}`, `admin:resource:force_checkout:${session.id}`)
        .row();
    }

    keyboard.text(`${EMOJI.BACK} Back`, 'admin:resources');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing active sessions:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading sessions.');
  }
}

/**
 * Force checkout a session
 */
export async function handleAdminForceCheckout(ctx: BotContext, sessionId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    await forceCheckout(sessionId);
    await ctx.answerCallbackQuery('✅ Session force-checked out.');
    await handleAdminActiveSessions(ctx);
  } catch (error) {
    console.error('Error force checking out:', error);
    await ctx.answerCallbackQuery?.('❌ Error force checking out.');
  }
}

/**
 * Start add resource flow
 */
export async function handleAdminResourceAdd(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser || !ctx.from) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Initialize state
  resourceCreationState.set(ctx.from.id, { step: 'name' });

  const keyboard = new InlineKeyboard().text(`${EMOJI.CANCEL} Cancel`, 'admin:resources');

  await ctx.editMessageText(
    `${EMOJI.JOIN} <b>Add New Resource</b>\n\nPlease enter the resource name:`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    }
  );
}

/**
 * Handle text input during resource creation
 */
export async function handleResourceCreationInput(ctx: BotContext): Promise<boolean> {
  if (!ctx.from || !ctx.message?.text) return false;

  const state = resourceCreationState.get(ctx.from.id);
  if (!state) return false;

  const text = ctx.message.text.trim();

  if (state.step === 'name') {
    state.name = text;
    state.step = 'description';

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.SKIP} Skip`, 'admin:resource:skip_description')
      .row()
      .text(`${EMOJI.CANCEL} Cancel`, 'admin:resource:cancel');

    await ctx.reply(
      `Resource name: <b>${text}</b>\n\nEnter a description (or tap Skip):`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );
    return true;
  }

  if (state.step === 'description') {
    state.description = text;
    state.step = 'category';

    await showCategorySelection(ctx);
    return true;
  }

  if (state.step === 'duration') {
    const hours = parseInt(text);
    if (isNaN(hours) || hours < 1 || hours > 24) {
      await ctx.reply('Please enter a valid number of hours (1-24):');
      return true;
    }

    state.maxDuration = hours;

    // Create the resource
    await createResourceFromState(ctx, state);
    return true;
  }

  return false;
}

/**
 * Skip description step
 */
export async function handleSkipDescription(ctx: BotContext): Promise<void> {
  if (!ctx.from) {
    await ctx.answerCallbackQuery?.('❌ Error.');
    return;
  }

  const state = resourceCreationState.get(ctx.from.id);
  if (!state || state.step !== 'description') {
    await ctx.answerCallbackQuery?.('❌ Invalid state.');
    return;
  }

  state.description = undefined;
  state.step = 'category';

  await showCategorySelection(ctx);
}

/**
 * Show category selection
 */
async function showCategorySelection(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) return;

  const categories = await getCategoriesForHostel(ctx.dbUser.hostel_id);

  const keyboard = new InlineKeyboard();

  for (const category of categories) {
    keyboard.text(`${category.icon} ${category.name}`, `admin:resource:category:${category.id}`).row();
  }

  keyboard.text(`${EMOJI.SKIP} No Category`, 'admin:resource:category:none').row();
  keyboard.text(`${EMOJI.CANCEL} Cancel`, 'admin:resource:cancel');

  await ctx.editMessageText('Select a category for this resource:', {
    reply_markup: keyboard,
  });
}

/**
 * Handle category selection
 */
export async function handleCategorySelection(ctx: BotContext, categoryId: string): Promise<void> {
  if (!ctx.from) {
    await ctx.answerCallbackQuery?.('❌ Error.');
    return;
  }

  const state = resourceCreationState.get(ctx.from.id);
  if (!state || state.step !== 'category') {
    await ctx.answerCallbackQuery?.('❌ Invalid state.');
    return;
  }

  state.categoryId = categoryId === 'none' ? null : categoryId;
  state.step = 'duration';

  const keyboard = new InlineKeyboard()
    .text('2 hours', 'admin:resource:duration:2')
    .text('4 hours', 'admin:resource:duration:4')
    .row()
    .text('6 hours (default)', 'admin:resource:duration:6')
    .text('8 hours', 'admin:resource:duration:8')
    .row()
    .text(`${EMOJI.CANCEL} Cancel`, 'admin:resource:cancel');

  await ctx.editMessageText(
    'Select max check-in duration, or type a custom number of hours:',
    {
      reply_markup: keyboard,
    }
  );
}

/**
 * Handle duration selection
 */
export async function handleDurationSelection(ctx: BotContext, hours: number): Promise<void> {
  if (!ctx.from) {
    await ctx.answerCallbackQuery?.('❌ Error.');
    return;
  }

  const state = resourceCreationState.get(ctx.from.id);
  if (!state || state.step !== 'duration') {
    await ctx.answerCallbackQuery?.('❌ Invalid state.');
    return;
  }

  state.maxDuration = hours;

  await createResourceFromState(ctx, state);
}

/**
 * Create resource from collected state
 */
async function createResourceFromState(
  ctx: BotContext,
  state: {
    name?: string;
    description?: string;
    categoryId?: string | null;
    maxDuration?: number;
  }
): Promise<void> {
  if (!ctx.dbUser || !ctx.from) return;

  try {
    const resource = await createResource(
      ctx.dbUser.hostel_id,
      state.name!,
      state.description || null,
      state.categoryId || null,
      state.maxDuration || 6
    );

    // Clear state
    resourceCreationState.delete(ctx.from.id);

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.JOIN} Add Another`, 'admin:resource:add')
      .row()
      .text(`${EMOJI.BACK} Back to Resources`, 'admin:resources');

    const message = `${EMOJI.SUCCESS} Resource created!\n\n` +
      `<b>${resource.name}</b>\n` +
      (state.description ? `${state.description}\n` : '') +
      `Max duration: ${resource.max_duration_hours} hours`;

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
    console.error('Error creating resource:', error);
    resourceCreationState.delete(ctx.from.id);

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery?.('❌ Error creating resource.');
    } else {
      await ctx.reply('❌ Error creating resource. Please try again.');
    }
  }
}

/**
 * Cancel resource creation
 */
export async function handleCancelResourceCreation(ctx: BotContext): Promise<void> {
  if (ctx.from) {
    resourceCreationState.delete(ctx.from.id);
  }

  await handleAdminResources(ctx);
}

/**
 * Edit resource view
 */
export async function handleAdminResourceEdit(ctx: BotContext, resourceId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const resource = await getResourceById(resourceId);

    if (!resource) {
      await ctx.answerCallbackQuery?.('❌ Resource not found.');
      return;
    }

    const categoryIcon = resource.category_icon || '📦';
    const categoryName = resource.category_name || 'No category';

    let message = `✏️ <b>Edit Resource</b>\n\n`;
    message += `Name: ${resource.name}\n`;
    message += `Description: ${resource.description || 'None'}\n`;
    message += `Category: ${categoryIcon} ${categoryName}\n`;
    message += `Max duration: ${resource.max_duration_hours} hours\n`;

    // For now, simple delete option - full edit can be added later
    const keyboard = new InlineKeyboard()
      .text(`🗑️ Delete Resource`, `admin:resource:delete:${resourceId}`)
      .row()
      .text(`${EMOJI.BACK} Back`, 'admin:resource:list');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing resource edit:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading resource.');
  }
}

/**
 * Delete resource confirmation
 */
export async function handleAdminResourceDelete(ctx: BotContext, resourceId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const resource = await getResourceById(resourceId);

    if (!resource) {
      await ctx.answerCallbackQuery?.('❌ Resource not found.');
      return;
    }

    if (!resource.is_available) {
      await ctx.answerCallbackQuery?.('❌ Cannot delete resource with active session.');
      return;
    }

    const keyboard = new InlineKeyboard()
      .text(`✅ Yes, Delete`, `admin:resource:confirm_delete:${resourceId}`)
      .text(`${EMOJI.CANCEL} Cancel`, 'admin:resource:list');

    await ctx.editMessageText(
      `⚠️ Are you sure you want to delete <b>${resource.name}</b>?\n\nThis action cannot be undone.`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    console.error('Error showing delete confirmation:', error);
    await ctx.answerCallbackQuery?.('❌ Error.');
  }
}

/**
 * Confirm delete resource
 */
export async function handleAdminResourceConfirmDelete(ctx: BotContext, resourceId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    await deleteResource(resourceId);
    await ctx.answerCallbackQuery('✅ Resource deleted.');
    await handleAdminResourceList(ctx);
  } catch (error: any) {
    console.error('Error deleting resource:', error);
    if (error.message?.includes('active sessions')) {
      await ctx.answerCallbackQuery?.('❌ Cannot delete resource with active sessions.');
    } else {
      await ctx.answerCallbackQuery?.('❌ Error deleting resource.');
    }
  }
}

/**
 * Check if user is in resource creation flow
 */
export function isInResourceCreationFlow(telegramId: number): boolean {
  return resourceCreationState.has(telegramId);
}

/**
 * Get creation state step (for routing text input)
 */
export function getResourceCreationStep(telegramId: number): string | undefined {
  return resourceCreationState.get(telegramId)?.step;
}

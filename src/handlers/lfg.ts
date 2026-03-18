import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import {
  createGroup,
  getCreatorActiveGroupCount,
  getGroupById,
} from '../services/groups.js';
import { getCategoriesForHostel } from '../services/categories.js';
import { getResourcesByHostel, isResourceAvailable, checkInResource } from '../services/resources.js';
import { postGroupToChannel } from '../services/telegram.js';
import { EMOJI, CONFIG, TIME_PRESETS } from '../utils/constants.js';

/**
 * LFG (Looking For Group) handler
 * Multi-step group creation flow
 */

// State management for group creation
interface GroupCreationState {
  step: 'category' | 'title' | 'players' | 'timing' | 'resource' | 'confirm';
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  title?: string;
  maxPlayers?: number;
  scheduledMinutes?: number;
  resourceId?: string;
  resourceName?: string;
}

const groupCreationState = new Map<number, GroupCreationState>();

/**
 * /lfg command - Start group creation flow
 */
export async function handleLfg(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser || !ctx.from) {
    await ctx.reply('❌ Authentication required. Please /start first.');
    return;
  }

  try {
    // Check if user can create more groups
    const activeCount = await getCreatorActiveGroupCount(ctx.dbUser.id);
    if (activeCount >= CONFIG.MAX_ACTIVE_GROUPS_AS_CREATOR) {
      await ctx.reply(
        `${EMOJI.WARNING} You already have ${CONFIG.MAX_ACTIVE_GROUPS_AS_CREATOR} active groups.\n\n` +
        `Please wait for them to complete or cancel one before creating a new group.`
      );
      return;
    }

    // Initialize state
    groupCreationState.set(ctx.from.id, { step: 'category' });

    // Show category selection
    await showCategorySelection(ctx);
  } catch (error) {
    console.error('Error starting LFG flow:', error);
    await ctx.reply('❌ Error starting group creation. Please try again.');
  }
}

/**
 * Show category selection
 */
async function showCategorySelection(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) return;

  const categories = await getCategoriesForHostel(ctx.dbUser.hostel_id);

  const keyboard = new InlineKeyboard();

  for (const category of categories) {
    keyboard.text(`${category.icon} ${category.name}`, `lfg:category:${category.id}`).row();
  }

  keyboard.text(`${EMOJI.CANCEL} Cancel`, 'lfg:cancel');

  const message = `${EMOJI.CATEGORY} <b>Create a Group</b>\n\n` +
    `Step 1 of 5: Choose a category for your game:`;

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
}

/**
 * Handle category selection
 */
export async function handleLfgCategorySelection(ctx: BotContext, categoryId: string): Promise<void> {
  if (!ctx.from || !ctx.dbUser) return;

  const state = groupCreationState.get(ctx.from.id);
  if (!state || state.step !== 'category') {
    await ctx.answerCallbackQuery('Session expired. Please start again with /lfg');
    return;
  }

  // Get category details
  const categories = await getCategoriesForHostel(ctx.dbUser.hostel_id);
  const category = categories.find(c => c.id === categoryId);

  if (!category) {
    await ctx.answerCallbackQuery('Category not found.');
    return;
  }

  // Update state
  state.categoryId = categoryId;
  state.categoryName = category.name;
  state.categoryIcon = category.icon;
  state.step = 'title';

  await ctx.answerCallbackQuery();

  // Ask for title
  const keyboard = new InlineKeyboard()
    .text(`${EMOJI.BACK} Back`, 'lfg:back:category')
    .text(`${EMOJI.CANCEL} Cancel`, 'lfg:cancel');

  await ctx.editMessageText(
    `${state.categoryIcon} <b>Create a ${state.categoryName} Group</b>\n\n` +
    `Step 2 of 5: What game are you playing?\n\n` +
    `Please type the game name (e.g., "Mario Kart", "Texas Hold'em"):`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    }
  );
}

/**
 * Handle title text input
 */
export async function handleLfgTitleInput(ctx: BotContext): Promise<boolean> {
  if (!ctx.from || !ctx.message?.text) return false;

  const state = groupCreationState.get(ctx.from.id);
  if (!state || state.step !== 'title') return false;

  const title = ctx.message.text.trim();

  // Validate title
  if (title.length < 2) {
    await ctx.reply('Title is too short. Please enter at least 2 characters:');
    return true;
  }

  if (title.length > 50) {
    await ctx.reply('Title is too long. Please enter at most 50 characters:');
    return true;
  }

  // Update state
  state.title = title;
  state.step = 'players';

  // Show player count selection
  await showPlayerCountSelection(ctx, state);
  return true;
}

/**
 * Show player count selection
 */
async function showPlayerCountSelection(ctx: BotContext, state: GroupCreationState): Promise<void> {
  const keyboard = new InlineKeyboard();

  // Row 1: 2-4 players
  keyboard
    .text('2 players', 'lfg:players:2')
    .text('3 players', 'lfg:players:3')
    .text('4 players', 'lfg:players:4')
    .row();

  // Row 2: 5-8 players
  keyboard
    .text('5 players', 'lfg:players:5')
    .text('6 players', 'lfg:players:6')
    .row();

  keyboard
    .text('7 players', 'lfg:players:7')
    .text('8 players', 'lfg:players:8')
    .row();

  keyboard
    .text(`${EMOJI.BACK} Back`, 'lfg:back:title')
    .text(`${EMOJI.CANCEL} Cancel`, 'lfg:cancel');

  const message = `${state.categoryIcon} <b>${state.title}</b>\n\n` +
    `Step 3 of 5: How many players (including yourself)?`;

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });
}

/**
 * Handle player count selection
 */
export async function handleLfgPlayerSelection(ctx: BotContext, count: number): Promise<void> {
  if (!ctx.from) return;

  const state = groupCreationState.get(ctx.from.id);
  if (!state || state.step !== 'players') {
    await ctx.answerCallbackQuery('Session expired. Please start again with /lfg');
    return;
  }

  state.maxPlayers = count;
  state.step = 'timing';

  await ctx.answerCallbackQuery();
  await showTimingSelection(ctx, state);
}

/**
 * Show timing selection
 */
async function showTimingSelection(ctx: BotContext, state: GroupCreationState): Promise<void> {
  const keyboard = new InlineKeyboard();

  for (const preset of TIME_PRESETS) {
    if (preset.minutes >= 0) { // Skip 'Custom' for now
      keyboard.text(`${preset.emoji} ${preset.label}`, `lfg:time:${preset.minutes}`).row();
    }
  }

  keyboard
    .text(`${EMOJI.BACK} Back`, 'lfg:back:players')
    .text(`${EMOJI.CANCEL} Cancel`, 'lfg:cancel');

  await ctx.editMessageText(
    `${state.categoryIcon} <b>${state.title}</b>\n` +
    `${EMOJI.PLAYERS} ${state.maxPlayers} players\n\n` +
    `Step 4 of 5: When do you want to start?`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    }
  );
}

/**
 * Handle timing selection
 */
export async function handleLfgTimingSelection(ctx: BotContext, minutes: number): Promise<void> {
  if (!ctx.from || !ctx.dbUser) return;

  const state = groupCreationState.get(ctx.from.id);
  if (!state || state.step !== 'timing') {
    await ctx.answerCallbackQuery('Session expired. Please start again with /lfg');
    return;
  }

  state.scheduledMinutes = minutes;
  state.step = 'resource';

  await ctx.answerCallbackQuery();
  await showResourceSelection(ctx, state);
}

/**
 * Show resource selection (optional)
 */
async function showResourceSelection(ctx: BotContext, state: GroupCreationState): Promise<void> {
  if (!ctx.dbUser) return;

  const resources = await getResourcesByHostel(ctx.dbUser.hostel_id);
  const availableResources = resources.filter(r => r.is_available);

  const keyboard = new InlineKeyboard();

  // Skip if no resources available
  if (availableResources.length === 0) {
    keyboard.text(`${EMOJI.SKIP} Skip (No resources available)`, 'lfg:resource:skip').row();
  } else {
    keyboard.text(`${EMOJI.SKIP} Skip`, 'lfg:resource:skip').row();

    for (const resource of availableResources) {
      const icon = resource.category_icon || '📦';
      keyboard.text(`${icon} ${resource.name}`, `lfg:resource:${resource.id}`).row();
    }
  }

  keyboard
    .text(`${EMOJI.BACK} Back`, 'lfg:back:timing')
    .text(`${EMOJI.CANCEL} Cancel`, 'lfg:cancel');

  const timingText = state.scheduledMinutes === 0 ? 'Now' : `In ${state.scheduledMinutes} min`;

  await ctx.editMessageText(
    `${state.categoryIcon} <b>${state.title}</b>\n` +
    `${EMOJI.PLAYERS} ${state.maxPlayers} players\n` +
    `${EMOJI.CLOCK} Starting: ${timingText}\n\n` +
    `Step 5 of 5: Reserve a resource? (Optional)`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    }
  );
}

/**
 * Handle resource selection
 */
export async function handleLfgResourceSelection(ctx: BotContext, resourceId: string | null): Promise<void> {
  if (!ctx.from || !ctx.dbUser) return;

  const state = groupCreationState.get(ctx.from.id);
  if (!state || state.step !== 'resource') {
    await ctx.answerCallbackQuery('Session expired. Please start again with /lfg');
    return;
  }

  if (resourceId) {
    // Verify resource is still available
    const available = await isResourceAvailable(resourceId);
    if (!available) {
      await ctx.answerCallbackQuery('This resource is no longer available.');
      await showResourceSelection(ctx, state);
      return;
    }

    // Get resource name for confirmation
    const resources = await getResourcesByHostel(ctx.dbUser.hostel_id);
    const resource = resources.find(r => r.id === resourceId);
    state.resourceId = resourceId;
    state.resourceName = resource?.name;
  }

  state.step = 'confirm';

  await ctx.answerCallbackQuery();
  await showConfirmation(ctx, state);
}

/**
 * Show confirmation screen
 */
async function showConfirmation(ctx: BotContext, state: GroupCreationState): Promise<void> {
  const timingText = state.scheduledMinutes === 0 ? 'Now' : `In ${state.scheduledMinutes} min`;

  let message = `${EMOJI.SUCCESS} <b>Confirm Your Group</b>\n\n`;
  message += `${state.categoryIcon} <b>${state.title}</b>\n`;
  message += `${EMOJI.CATEGORY} Category: ${state.categoryName}\n`;
  message += `${EMOJI.PLAYERS} Max Players: ${state.maxPlayers}\n`;
  message += `${EMOJI.CLOCK} Starting: ${timingText}\n`;

  if (state.resourceName) {
    message += `${EMOJI.LOCATION} Resource: ${state.resourceName}\n`;
  }

  message += `\nThis group will be posted to the hostel channel.`;

  const keyboard = new InlineKeyboard()
    .text(`${EMOJI.SUCCESS} Create Group`, 'lfg:confirm')
    .row()
    .text(`${EMOJI.BACK} Back`, 'lfg:back:resource')
    .text(`${EMOJI.CANCEL} Cancel`, 'lfg:cancel');

  await ctx.editMessageText(message, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });
}

/**
 * Handle group creation confirmation
 */
export async function handleLfgConfirm(ctx: BotContext): Promise<void> {
  if (!ctx.from || !ctx.dbUser) return;

  const state = groupCreationState.get(ctx.from.id);
  if (!state || state.step !== 'confirm') {
    await ctx.answerCallbackQuery('Session expired. Please start again with /lfg');
    return;
  }

  try {
    // Create the group
    const group = await createGroup({
      hostelId: ctx.dbUser.hostel_id,
      creatorId: ctx.dbUser.id,
      categoryId: state.categoryId!,
      title: state.title!,
      maxPlayers: state.maxPlayers!,
      scheduledForMinutes: state.scheduledMinutes!,
      resourceId: state.resourceId,
    });

    // If resource selected, check it in
    if (state.resourceId) {
      try {
        await checkInResource(state.resourceId, ctx.dbUser.id, group.id);
      } catch (error) {
        console.error('Error checking in resource:', error);
        // Continue anyway - group is created
      }
    }

    // Clear state
    groupCreationState.delete(ctx.from.id);

    // Post to channel
    const groupWithDetails = await getGroupById(group.id);
    if (groupWithDetails) {
      await postGroupToChannel(groupWithDetails);
    }

    await ctx.answerCallbackQuery('Group created!');

    // Show success message
    const keyboard = new InlineKeyboard()
      .text('📋 View My Groups', 'mygroups')
      .row()
      .text(`${EMOJI.JOIN} Create Another`, 'lfg:start');

    const timingText = state.scheduledMinutes === 0 ? 'now' : `in ${state.scheduledMinutes} minutes`;

    await ctx.editMessageText(
      `${EMOJI.SUCCESS} <b>Group Created!</b>\n\n` +
      `${state.categoryIcon} <b>${state.title}</b>\n` +
      `${EMOJI.PLAYERS} Looking for ${state.maxPlayers! - 1} more player(s)\n` +
      `${EMOJI.CLOCK} Starting ${timingText}\n` +
      (state.resourceName ? `${EMOJI.LOCATION} Resource: ${state.resourceName}\n` : '') +
      `\nYour group has been posted to the hostel channel!`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    console.error('Error creating group:', error);
    await ctx.answerCallbackQuery('Error creating group');
    await ctx.editMessageText('❌ Error creating group. Please try again.');
    groupCreationState.delete(ctx.from.id);
  }
}

/**
 * Handle back navigation
 */
export async function handleLfgBack(ctx: BotContext, toStep: string): Promise<void> {
  if (!ctx.from || !ctx.dbUser) return;

  const state = groupCreationState.get(ctx.from.id);
  if (!state) {
    await ctx.answerCallbackQuery('Session expired. Please start again with /lfg');
    return;
  }

  await ctx.answerCallbackQuery();

  switch (toStep) {
    case 'category':
      state.step = 'category';
      await showCategorySelection(ctx);
      break;

    case 'title':
      state.step = 'title';
      const keyboard = new InlineKeyboard()
        .text(`${EMOJI.BACK} Back`, 'lfg:back:category')
        .text(`${EMOJI.CANCEL} Cancel`, 'lfg:cancel');

      await ctx.editMessageText(
        `${state.categoryIcon} <b>Create a ${state.categoryName} Group</b>\n\n` +
        `Step 2 of 5: What game are you playing?\n\n` +
        `Please type the game name:`,
        {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        }
      );
      break;

    case 'players':
      state.step = 'players';
      await showPlayerCountSelection(ctx, state);
      break;

    case 'timing':
      state.step = 'timing';
      await showTimingSelection(ctx, state);
      break;

    case 'resource':
      state.step = 'resource';
      await showResourceSelection(ctx, state);
      break;
  }
}

/**
 * Handle cancel
 */
export async function handleLfgCancel(ctx: BotContext): Promise<void> {
  if (ctx.from) {
    groupCreationState.delete(ctx.from.id);
  }

  await ctx.answerCallbackQuery('Cancelled');
  await ctx.editMessageText('Group creation cancelled.');
}

/**
 * Check if user is in LFG creation flow
 */
export function isInLfgCreationFlow(telegramId: number): boolean {
  return groupCreationState.has(telegramId);
}

/**
 * Get LFG creation step (for routing text input)
 */
export function getLfgCreationStep(telegramId: number): string | undefined {
  return groupCreationState.get(telegramId)?.step;
}

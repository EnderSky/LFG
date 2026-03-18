import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import {
  getCategoriesForHostel,
  getHostelCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../services/categories.js';
import { getUserByTelegramId } from '../services/users.js';
import { EMOJI } from '../utils/constants.js';

/**
 * Admin category management handlers
 */

// State for category creation/editing flow
const categoryCreationState = new Map<number, {
  step: 'name' | 'icon';
  name?: string;
  icon?: string;
  editingId?: string; // If set, we're editing instead of creating
}>();

// Common emoji options for category icons
const ICON_OPTIONS = [
  '🎮', '🎲', '🃏', '♟️', '🎯', '🎱',
  '🏓', '⚽', '🏀', '🎸', '🎬', '📺',
  '🍳', '🍕', '🍺', '☕', '🏊', '🚴',
  '🧘', '🎨', '📚', '🎤', '🎪', '🌮',
];

/**
 * Show admin category management panel
 */
export async function handleAdminCategories(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const allCategories = await getCategoriesForHostel(ctx.dbUser.hostel_id);
    const hostelCategories = allCategories.filter(c => !c.is_global);
    const globalCategories = allCategories.filter(c => c.is_global);

    let message = `${EMOJI.CATEGORY} <b>Category Management</b>\n\n`;

    if (globalCategories.length > 0) {
      message += `<b>Global Categories (${globalCategories.length}):</b>\n`;
      for (const cat of globalCategories) {
        message += `  ${cat.icon} ${cat.name}\n`;
      }
      message += `\n`;
    }

    if (hostelCategories.length > 0) {
      message += `<b>Custom Categories (${hostelCategories.length}):</b>\n`;
      for (const cat of hostelCategories) {
        message += `  ${cat.icon} ${cat.name}\n`;
      }
    } else {
      message += `<i>No custom categories yet.</i>\n`;
    }

    message += `\n💡 Custom categories are specific to your hostel.`;

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.JOIN} Add Category`, 'admin:cat:add')
      .row()
      .text(`📋 Manage Custom`, 'admin:cat:list')
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
    console.error('Error showing admin categories:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery('❌ Error loading categories.');
    } else {
      await ctx.reply('❌ Error loading categories.');
    }
  }
}

/**
 * List custom categories with edit/delete options
 */
export async function handleAdminCategoryList(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const categories = await getHostelCategories(ctx.dbUser.hostel_id);

    if (categories.length === 0) {
      const keyboard = new InlineKeyboard()
        .text(`${EMOJI.JOIN} Add Category`, 'admin:cat:add')
        .row()
        .text(`${EMOJI.BACK} Back`, 'admin:categories');

      await ctx.editMessageText(
        `${EMOJI.CATEGORY} <b>Custom Categories</b>\n\nNo custom categories yet. Add one to get started!`,
        {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        }
      );
      return;
    }

    let message = `${EMOJI.CATEGORY} <b>Custom Categories</b>\n\n`;
    message += `Select a category to edit or delete:\n\n`;

    const keyboard = new InlineKeyboard();

    for (const category of categories) {
      message += `${category.icon} ${category.name}\n`;

      keyboard
        .text(`✏️ ${category.icon} ${category.name}`, `admin:cat:edit:${category.id}`)
        .text(`🗑️`, `admin:cat:del:${category.id}`)
        .row();
    }

    keyboard
      .text(`${EMOJI.JOIN} Add Category`, 'admin:cat:add')
      .row()
      .text(`${EMOJI.BACK} Back`, 'admin:categories');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error listing categories:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading categories.');
  }
}

/**
 * Start add category flow
 */
export async function handleAdminCategoryAdd(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser || !ctx.from) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  categoryCreationState.set(ctx.from.id, { step: 'name' });

  const keyboard = new InlineKeyboard().text(`${EMOJI.CANCEL} Cancel`, 'admin:categories');

  await ctx.editMessageText(
    `${EMOJI.JOIN} <b>Add New Category</b>\n\nPlease enter the category name:`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    }
  );
}

/**
 * Handle text input during category creation
 */
export async function handleCategoryCreationInput(ctx: BotContext): Promise<boolean> {
  if (!ctx.from || !ctx.message?.text) return false;

  const state = categoryCreationState.get(ctx.from.id);
  if (!state) return false;

  // Fetch user from database (text messages don't go through auth middleware)
  const user = await getUserByTelegramId(ctx.from.id);
  if (!user) return false;

  // Attach user to context for downstream use
  ctx.dbUser = user;

  const text = ctx.message.text.trim();

  if (state.step === 'name') {
    if (text.length < 2 || text.length > 30) {
      await ctx.reply('Category name must be 2-30 characters. Please try again:');
      return true;
    }

    state.name = text;
    state.step = 'icon';

    await showIconSelection(ctx, state.editingId ? 'edit' : 'add');
    return true;
  }

  if (state.step === 'icon') {
    // User typed a custom icon (should be an emoji)
    const emoji = text.trim();
    
    // Basic emoji validation (single character or emoji sequence)
    if (emoji.length === 0 || emoji.length > 10) {
      await ctx.reply('Please enter a single emoji or select one from the buttons:');
      return true;
    }

    state.icon = emoji;
    await finishCategoryCreation(ctx, state);
    return true;
  }

  return false;
}

/**
 * Show icon selection keyboard
 */
async function showIconSelection(ctx: BotContext, mode: 'add' | 'edit'): Promise<void> {
  const keyboard = new InlineKeyboard();

  // Add icon options in rows of 6
  for (let i = 0; i < ICON_OPTIONS.length; i += 6) {
    const row = ICON_OPTIONS.slice(i, i + 6);
    for (const icon of row) {
      keyboard.text(icon, `admin:cat:icon:${icon}`);
    }
    keyboard.row();
  }

  keyboard.text(`${EMOJI.CANCEL} Cancel`, 'admin:categories');

  const message = mode === 'edit'
    ? `✏️ <b>Edit Category</b>\n\nSelect an icon for the category, or type a custom emoji:`
    : `${EMOJI.JOIN} <b>Add New Category</b>\n\nSelect an icon for the category, or type a custom emoji:`;

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
 * Handle icon selection from buttons
 */
export async function handleIconSelection(ctx: BotContext, icon: string): Promise<void> {
  if (!ctx.from || !ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Error.');
    return;
  }

  const state = categoryCreationState.get(ctx.from.id);
  if (!state || state.step !== 'icon') {
    await ctx.answerCallbackQuery?.('❌ Invalid state. Please start again.');
    return;
  }

  state.icon = icon;
  await finishCategoryCreation(ctx, state);
}

/**
 * Finish category creation or update
 */
async function finishCategoryCreation(
  ctx: BotContext,
  state: { name?: string; icon?: string; editingId?: string }
): Promise<void> {
  if (!ctx.dbUser || !ctx.from) return;

  try {
    let message: string;

    if (state.editingId) {
      // Update existing category
      await updateCategory(state.editingId, {
        name: state.name,
        icon: state.icon,
      });
      message = `${EMOJI.SUCCESS} Category updated!\n\n${state.icon} ${state.name}`;
    } else {
      // Create new category
      await createCategory(ctx.dbUser.hostel_id, state.name!, state.icon!);
      message = `${EMOJI.SUCCESS} Category created!\n\n${state.icon} ${state.name}`;
    }

    // Clear state
    categoryCreationState.delete(ctx.from.id);

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.JOIN} Add Another`, 'admin:cat:add')
      .row()
      .text(`${EMOJI.BACK} Back to Categories`, 'admin:categories');

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
    console.error('Error saving category:', error);
    categoryCreationState.delete(ctx.from.id);

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery?.('❌ Error saving category.');
    } else {
      await ctx.reply('❌ Error saving category. Please try again.');
    }
  }
}

/**
 * Show edit category view
 */
export async function handleAdminCategoryEdit(ctx: BotContext, categoryId: string): Promise<void> {
  if (!ctx.dbUser || !ctx.from) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const category = await getCategoryById(categoryId);

    if (!category) {
      await ctx.answerCallbackQuery?.('❌ Category not found.');
      return;
    }

    if (category.is_global) {
      await ctx.answerCallbackQuery?.('❌ Cannot edit global categories.');
      return;
    }

    // Start edit flow
    categoryCreationState.set(ctx.from.id, {
      step: 'name',
      editingId: categoryId,
      name: category.name,
      icon: category.icon,
    });

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.SKIP} Keep current name`, 'admin:cat:keepname')
      .row()
      .text(`${EMOJI.CANCEL} Cancel`, 'admin:categories');

    await ctx.editMessageText(
      `✏️ <b>Edit Category</b>\n\n` +
      `Current: ${category.icon} ${category.name}\n\n` +
      `Enter a new name or keep the current one:`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    console.error('Error showing category edit:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading category.');
  }
}

/**
 * Keep current name when editing
 */
export async function handleKeepCategoryName(ctx: BotContext): Promise<void> {
  if (!ctx.from) {
    await ctx.answerCallbackQuery?.('❌ Error.');
    return;
  }

  const state = categoryCreationState.get(ctx.from.id);
  if (!state || state.step !== 'name' || !state.editingId) {
    await ctx.answerCallbackQuery?.('❌ Invalid state.');
    return;
  }

  // Keep the existing name, move to icon step
  state.step = 'icon';
  await showIconSelection(ctx, 'edit');
}

/**
 * Show delete confirmation
 */
export async function handleAdminCategoryDelete(ctx: BotContext, categoryId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const category = await getCategoryById(categoryId);

    if (!category) {
      await ctx.answerCallbackQuery?.('❌ Category not found.');
      return;
    }

    if (category.is_global) {
      await ctx.answerCallbackQuery?.('❌ Cannot delete global categories.');
      return;
    }

    const keyboard = new InlineKeyboard()
      .text(`✅ Yes, Delete`, `admin:cat:confirm:${categoryId}`)
      .text(`${EMOJI.CANCEL} Cancel`, 'admin:cat:list');

    await ctx.editMessageText(
      `⚠️ <b>Delete Category?</b>\n\n` +
      `${category.icon} ${category.name}\n\n` +
      `Resources and groups using this category will keep working, but will show no category.`,
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
 * Confirm delete category
 */
export async function handleAdminCategoryConfirmDelete(ctx: BotContext, categoryId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    await deleteCategory(categoryId);
    await ctx.answerCallbackQuery('✅ Category deleted.');
    await handleAdminCategoryList(ctx);
  } catch (error: any) {
    console.error('Error deleting category:', error);
    if (error.message?.includes('global')) {
      await ctx.answerCallbackQuery?.('❌ Cannot delete global categories.');
    } else {
      await ctx.answerCallbackQuery?.('❌ Error deleting category.');
    }
  }
}

/**
 * Cancel category creation/editing
 */
export async function handleCancelCategoryCreation(ctx: BotContext): Promise<void> {
  if (ctx.from) {
    categoryCreationState.delete(ctx.from.id);
  }
  await handleAdminCategories(ctx);
}

/**
 * Check if user is in category creation flow
 */
export function isInCategoryCreationFlow(telegramId: number): boolean {
  return categoryCreationState.has(telegramId);
}

/**
 * Get creation state step
 */
export function getCategoryCreationStep(telegramId: number): string | undefined {
  return categoryCreationState.get(telegramId)?.step;
}

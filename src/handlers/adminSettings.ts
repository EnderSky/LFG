import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import { getHostelById, updateHostelChannel } from '../services/hostels.js';
import { EMOJI } from '../utils/constants.js';

/**
 * Admin settings handlers (hostel configuration)
 */

// State for channel configuration flow
const channelConfigState = new Map<number, { step: 'input' }>();

/**
 * Show hostel settings panel
 */
export async function handleAdminSettings(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const hostel = await getHostelById(ctx.dbUser.hostel_id);

    if (!hostel) {
      await ctx.answerCallbackQuery?.('❌ Hostel not found.');
      return;
    }

    let message = `${EMOJI.SETTINGS} <b>Hostel Settings</b>\n\n`;
    message += `<b>Hostel:</b> ${hostel.name}\n`;
    message += `<b>Timezone:</b> ${hostel.timezone}\n\n`;

    message += `<b>Telegram Channel:</b>\n`;
    if (hostel.telegram_channel_id) {
      message += `${EMOJI.SUCCESS} Configured: <code>${hostel.telegram_channel_id}</code>\n`;
      message += `\nNew groups will be posted to this channel.`;
    } else {
      message += `${EMOJI.WARNING} Not configured\n`;
      message += `\nSet up a channel to auto-post new groups.`;
    }

    const keyboard = new InlineKeyboard();

    if (hostel.telegram_channel_id) {
      keyboard
        .text(`✏️ Change Channel`, 'admin:settings:channel:change')
        .row()
        .text(`🗑️ Remove Channel`, 'admin:settings:channel:remove')
        .row();
    } else {
      keyboard.text(`${EMOJI.JOIN} Set Up Channel`, 'admin:settings:channel:change').row();
    }

    keyboard.text(`${EMOJI.BACK} Back to Admin Panel`, 'admin:panel');

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
    console.error('Error showing admin settings:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading settings.');
  }
}

/**
 * Start channel configuration flow
 */
export async function handleChannelChange(ctx: BotContext): Promise<void> {
  if (!ctx.from) {
    await ctx.answerCallbackQuery?.('❌ Error.');
    return;
  }

  channelConfigState.set(ctx.from.id, { step: 'input' });

  const keyboard = new InlineKeyboard()
    .text(`${EMOJI.CANCEL} Cancel`, 'admin:settings');

  const message = `${EMOJI.SETTINGS} <b>Configure Telegram Channel</b>\n\n` +
    `To set up the channel where new groups will be posted:\n\n` +
    `<b>1.</b> Create a Telegram channel (or use existing one)\n` +
    `<b>2.</b> Add this bot as an <b>admin</b> in the channel\n` +
    `<b>3.</b> Send me the channel username or ID\n\n` +
    `<b>Examples:</b>\n` +
    `• <code>@my_hostel_lfg</code> (public channel)\n` +
    `• <code>-1001234567890</code> (private channel ID)\n\n` +
    `💡 <i>To get a private channel ID: forward any message from the channel to @userinfobot</i>`;

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(message, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });
}

/**
 * Handle channel ID input
 */
export async function handleChannelInput(ctx: BotContext): Promise<boolean> {
  if (!ctx.from || !ctx.message?.text || !ctx.dbUser) return false;

  const state = channelConfigState.get(ctx.from.id);
  if (!state || state.step !== 'input') return false;

  const input = ctx.message.text.trim();

  // Validate input format
  if (!isValidChannelId(input)) {
    await ctx.reply(
      `${EMOJI.ERROR} Invalid channel format.\n\n` +
      `Please enter:\n` +
      `• A username like <code>@channel_name</code>\n` +
      `• Or a numeric ID like <code>-1001234567890</code>`,
      { parse_mode: 'HTML' }
    );
    return true;
  }

  try {
    // Try to send a test message to verify the bot has access
    const testResult = await testChannelAccess(ctx, input);

    if (!testResult.success) {
      await ctx.reply(
        `${EMOJI.ERROR} Cannot access this channel.\n\n` +
        `${testResult.error}\n\n` +
        `Please make sure:\n` +
        `• The channel exists\n` +
        `• The bot is added as an admin\n` +
        `• The channel ID/username is correct`,
        { parse_mode: 'HTML' }
      );
      return true;
    }

    // Save the channel ID
    await updateHostelChannel(ctx.dbUser.hostel_id, input);

    // Clear state
    channelConfigState.delete(ctx.from.id);

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.BACK} Back to Settings`, 'admin:settings');

    await ctx.reply(
      `${EMOJI.SUCCESS} <b>Channel configured!</b>\n\n` +
      `Channel: <code>${input}</code>\n\n` +
      `New groups will now be posted to this channel.`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );

    return true;
  } catch (error) {
    console.error('Error saving channel:', error);
    await ctx.reply(`${EMOJI.ERROR} Error saving channel. Please try again.`);
    return true;
  }
}

/**
 * Remove channel configuration
 */
export async function handleChannelRemove(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Error.');
    return;
  }

  try {
    await updateHostelChannel(ctx.dbUser.hostel_id, null);

    await ctx.answerCallbackQuery('Channel removed.');

    // Refresh settings view
    await handleAdminSettings(ctx);
  } catch (error) {
    console.error('Error removing channel:', error);
    await ctx.answerCallbackQuery?.('❌ Error removing channel.');
  }
}

/**
 * Check if user is in channel config flow
 */
export function isInChannelConfigFlow(telegramId: number): boolean {
  return channelConfigState.has(telegramId);
}

/**
 * Cancel channel config flow
 */
export function cancelChannelConfigFlow(telegramId: number): void {
  channelConfigState.delete(telegramId);
}

/**
 * Validate channel ID format
 */
function isValidChannelId(input: string): boolean {
  // Username format: @channel_name
  if (input.startsWith('@') && input.length > 1) {
    return /^@[a-zA-Z][a-zA-Z0-9_]{3,}$/.test(input);
  }

  // Numeric ID format: -100... (supergroup/channel IDs start with -100)
  if (input.startsWith('-100')) {
    return /^-100\d{10,}$/.test(input);
  }

  // Also accept plain numeric IDs
  if (/^-?\d+$/.test(input)) {
    return true;
  }

  return false;
}

/**
 * Test if bot can access the channel
 */
async function testChannelAccess(
  ctx: BotContext,
  channelId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to get chat info - this will fail if bot doesn't have access
    const chat = await ctx.api.getChat(channelId);

    // Check if it's a channel or supergroup
    if (chat.type !== 'channel' && chat.type !== 'supergroup') {
      return {
        success: false,
        error: 'This is not a channel. Please provide a channel or supergroup.',
      };
    }

    // Try to get bot's member status in the channel
    const botInfo = await ctx.api.getMe();
    const member = await ctx.api.getChatMember(channelId, botInfo.id);

    if (member.status !== 'administrator' && member.status !== 'creator') {
      return {
        success: false,
        error: 'The bot is not an admin in this channel. Please add the bot as an admin first.',
      };
    }

    // Check if bot can post messages
    if (member.status === 'administrator' && !member.can_post_messages) {
      return {
        success: false,
        error: 'The bot does not have permission to post messages. Please enable "Post Messages" permission.',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error testing channel access:', error);

    if (error.description?.includes('chat not found')) {
      return {
        success: false,
        error: 'Channel not found. Please check the channel ID/username.',
      };
    }

    if (error.description?.includes('bot is not a member')) {
      return {
        success: false,
        error: 'The bot is not a member of this channel. Please add the bot first.',
      };
    }

    return {
      success: false,
      error: error.description || 'Could not access the channel.',
    };
  }
}

import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import {
  getHostelStats,
  getPopularCategories,
  getPopularResources,
  getPeakHours,
} from '../services/statistics.js';
import { EMOJI } from '../utils/constants.js';

/**
 * Statistics dashboard handlers
 */

/**
 * Show main statistics dashboard
 * Callback: admin:stats
 */
export async function handleStatistics(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.STATS} Overview`, 'admin:stats:overview')
      .row()
      .text(`${EMOJI.CATEGORY} Top Games`, 'admin:stats:games')
      .text(`${EMOJI.LOCATION} Top Resources`, 'admin:stats:resources')
      .row()
      .text(`${EMOJI.CLOCK} Peak Hours`, 'admin:stats:hours')
      .row()
      .text(`${EMOJI.BACK} Back to Admin Panel`, 'admin:panel');

    const message = `${EMOJI.STATS} Statistics Dashboard

Select a view:`;

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error showing statistics menu:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading statistics.');
  }
}

/**
 * Show statistics overview
 * Callback: admin:stats:overview
 */
export async function handleStatsOverview(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const stats = await getHostelStats(ctx.dbUser.hostel_id);

    let message = `${EMOJI.STATS} <b>Statistics Overview</b>\n\n`;

    // Users section
    message += `<b>👥 Users</b>\n`;
    message += `  Total: ${stats.totalUsers}\n`;
    message += `  Approved: ${stats.approvedUsers}\n`;
    message += `  Pending: ${stats.pendingUsers}\n`;
    if (stats.bannedUsers > 0) {
      message += `  Banned: ${stats.bannedUsers}\n`;
    }
    message += `  New (7d): +${stats.newUsersLast7Days}\n`;
    message += `  New (30d): +${stats.newUsersLast30Days}\n\n`;

    // Groups section
    message += `<b>${EMOJI.PLAYERS} Groups</b>\n`;
    message += `  Total: ${stats.totalGroups}\n`;
    message += `  Active: ${stats.activeGroups}\n`;
    message += `  Completed: ${stats.completedGroups}\n`;
    message += `  Cancelled: ${stats.cancelledGroups}\n`;
    message += `  Created (7d): +${stats.groupsLast7Days}\n`;
    message += `  Created (30d): +${stats.groupsLast30Days}\n\n`;

    // Resources section
    message += `<b>${EMOJI.LOCATION} Resources</b>\n`;
    message += `  Total: ${stats.totalResources}\n`;
    message += `  Active sessions: ${stats.activeResourceSessions}\n`;
    message += `  Total sessions: ${stats.totalResourceSessions}\n`;
    message += `  Sessions (7d): +${stats.sessionsLast7Days}\n`;
    message += `  Sessions (30d): +${stats.sessionsLast30Days}\n\n`;

    // Admin section
    message += `<b>${EMOJI.ADMIN} Admins</b>\n`;
    message += `  Total: ${stats.totalAdmins}\n`;

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.BACK} Back to Stats`, 'admin:stats');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing stats overview:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading overview.');
  }
}

/**
 * Show top games/categories
 * Callback: admin:stats:games
 */
export async function handleStatsGames(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const categories = await getPopularCategories(ctx.dbUser.hostel_id, 10);

    let message = `${EMOJI.CATEGORY} <b>Top Games (Last 30 Days)</b>\n\n`;

    if (categories.length === 0) {
      message += `<i>No groups created yet.</i>`;
    } else {
      const maxCount = categories[0]?.groupCount || 1;

      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const barLength = Math.max(1, Math.round((cat.groupCount / maxCount) * 10));
        const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
        
        message += `${medal} ${cat.categoryIcon} ${cat.categoryName}\n`;
        message += `   ${bar} ${cat.groupCount} group${cat.groupCount !== 1 ? 's' : ''}\n`;
      }
    }

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.BACK} Back to Stats`, 'admin:stats');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing top games:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading top games.');
  }
}

/**
 * Show top resources
 * Callback: admin:stats:resources
 */
export async function handleStatsResources(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const resources = await getPopularResources(ctx.dbUser.hostel_id, 10);

    let message = `${EMOJI.LOCATION} <b>Top Resources (Last 30 Days)</b>\n\n`;

    if (resources.length === 0) {
      message += `<i>No resource sessions yet.</i>`;
    } else {
      const maxCount = resources[0]?.sessionCount || 1;

      for (let i = 0; i < resources.length; i++) {
        const res = resources[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const barLength = Math.max(1, Math.round((res.sessionCount / maxCount) * 10));
        const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
        
        message += `${medal} ${res.resourceName}\n`;
        message += `   ${bar} ${res.sessionCount} session${res.sessionCount !== 1 ? 's' : ''}\n`;
        message += `   ${EMOJI.CLOCK} ${res.totalHours}h total usage\n`;
      }
    }

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.BACK} Back to Stats`, 'admin:stats');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing top resources:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading top resources.');
  }
}

/**
 * Show peak hours chart
 * Callback: admin:stats:hours
 */
export async function handleStatsPeakHours(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const hours = await getPeakHours(ctx.dbUser.hostel_id);

    let message = `${EMOJI.CLOCK} <b>Peak Hours (Last 30 Days)</b>\n\n`;

    const totalGroups = hours.reduce((sum, h) => sum + h.groupCount, 0);

    if (totalGroups === 0) {
      message += `<i>No groups created yet.</i>`;
    } else {
      // Show condensed view - group by time blocks
      const timeBlocks = [
        { label: 'Morning (6-12)', start: 6, end: 12 },
        { label: 'Afternoon (12-18)', start: 12, end: 18 },
        { label: 'Evening (18-24)', start: 18, end: 24 },
        { label: 'Night (0-6)', start: 0, end: 6 },
      ];

      message += `<b>By Time Block:</b>\n`;
      for (const block of timeBlocks) {
        const blockCount = hours
          .filter(h => h.hour >= block.start && h.hour < block.end)
          .reduce((sum, h) => sum + h.groupCount, 0);
        const blockMax = timeBlocks.reduce((max, b) => {
          const count = hours
            .filter(h => h.hour >= b.start && h.hour < b.end)
            .reduce((sum, h) => sum + h.groupCount, 0);
          return Math.max(max, count);
        }, 1);
        const barLength = Math.max(0, Math.round((blockCount / blockMax) * 8));
        const bar = '█'.repeat(barLength) + '░'.repeat(8 - barLength);
        
        message += `  ${block.label}\n`;
        message += `  ${bar} ${blockCount}\n`;
      }

      // Find peak hour
      const peakHour = hours.reduce((peak, h) => 
        h.groupCount > peak.groupCount ? h : peak, 
        { hour: 0, groupCount: 0 }
      );

      if (peakHour.groupCount > 0) {
        const peakTimeStr = `${peakHour.hour.toString().padStart(2, '0')}:00`;
        message += `\n🔥 <b>Peak hour:</b> ${peakTimeStr} (${peakHour.groupCount} groups)`;
      }
    }

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.BACK} Back to Stats`, 'admin:stats');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing peak hours:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading peak hours.');
  }
}

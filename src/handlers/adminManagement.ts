import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import {
  isUserSuperAdmin,
  getAdminsWithUserDetails,
  getApprovedNonAdminUsers,
  addAdmin,
  removeAdmin,
  toggleSuperAdmin,
  getAdminCount,
} from '../services/admins.js';
import { getUserById } from '../services/users.js';
import { EMOJI } from '../utils/constants.js';
import { formatTimeAgo } from '../utils/formatting.js';

/**
 * Admin Management handlers (Super Admin only)
 * Allows super admins to add/remove admins and toggle super admin status
 */

const PAGE_SIZE = 5;

/**
 * Show admin management menu
 * Callback: admin:admins
 */
export async function handleAdminManagement(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check if user is super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    
    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.BACK} Back to Admin Panel`, 'admin:panel');
    
    await ctx.editMessageText(
      `${EMOJI.ERROR} Access Denied\n\nOnly super admins can manage other admins.`,
      { reply_markup: keyboard }
    );
    return;
  }

  try {
    const admins = await getAdminsWithUserDetails(ctx.dbUser.hostel_id);
    
    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.ADMIN} View Admins (${admins.length})`, 'admin:adm:list')
      .row()
      .text(`${EMOJI.JOIN} Add New Admin`, 'admin:adm:add')
      .row()
      .text(`${EMOJI.BACK} Back to Admin Panel`, 'admin:panel');

    const message = `${EMOJI.ADMIN} Admin Management

You have ${admins.length} admin${admins.length !== 1 ? 's' : ''} in your hostel.

Select an option below:`;

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error showing admin management menu:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading admin management.');
  }
}

/**
 * Show list of current admins
 * Callback: admin:adm:list or admin:adm:list:<page>
 */
export async function handleAdminList(
  ctx: BotContext,
  page: number = 1
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    return;
  }

  try {
    const allAdmins = await getAdminsWithUserDetails(ctx.dbUser.hostel_id);

    if (allAdmins.length === 0) {
      const keyboard = new InlineKeyboard()
        .text(`${EMOJI.BACK} Back`, 'admin:admins');

      await ctx.editMessageText('No admins found. This should not happen!', {
        reply_markup: keyboard,
      });
      return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(allAdmins.length / PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    const adminsOnPage = allAdmins.slice(startIdx, endIdx);

    // Build message
    let message = `${EMOJI.ADMIN} Current Admins (${allAdmins.length})\n\n`;

    const keyboard = new InlineKeyboard();

    for (const admin of adminsOnPage) {
      const adminDisplay = admin.user_username 
        ? `@${admin.user_username}` 
        : admin.user_name;
      const superBadge = admin.is_super_admin ? ' ⭐' : '';
      const timeAgo = formatTimeAgo(admin.created_at);
      
      message += `${EMOJI.ADMIN} <b>${adminDisplay}</b>${superBadge}\n`;
      message += `   Added: ${timeAgo}\n`;
      if (admin.is_super_admin) {
        message += `   ⭐ Super Admin\n`;
      }
      message += '\n';

      // Add action button (can't remove yourself or demote if you're the only super admin)
      const isCurrentUser = admin.user_id === ctx.dbUser.id;
      
      if (!isCurrentUser) {
        keyboard
          .text(`${adminDisplay.substring(0, 15)}`, `admin:adm:view:${admin.user_id}`)
          .row();
      }
    }

    // Note about current user
    message += `\n<i>Note: You cannot modify your own admin status.</i>`;

    // Add pagination controls if needed
    if (totalPages > 1) {
      if (page > 1) {
        keyboard.text(`${EMOJI.BACK} Prev`, `admin:adm:list:${page - 1}`);
      }
      keyboard.text(`Page ${page}/${totalPages}`, 'noop');
      if (page < totalPages) {
        keyboard.text(`Next ▶️`, `admin:adm:list:${page + 1}`);
      }
      keyboard.row();
    }

    // Back button
    keyboard.text(`${EMOJI.BACK} Back`, 'admin:admins');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing admin list:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading admins.');
  }
}

/**
 * Show admin details with actions
 * Callback: admin:adm:view:<userId>
 */
export async function handleAdminView(
  ctx: BotContext,
  userId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    return;
  }

  try {
    const admins = await getAdminsWithUserDetails(ctx.dbUser.hostel_id);
    const admin = admins.find(a => a.user_id === userId);

    if (!admin) {
      await ctx.answerCallbackQuery?.('❌ Admin not found.');
      return;
    }

    let message = `${EMOJI.ADMIN} Admin Details\n\n`;
    message += `<b>Name:</b> ${admin.user_name}\n`;
    if (admin.user_username) {
      message += `<b>Username:</b> @${admin.user_username}\n`;
    }
    message += `<b>Super Admin:</b> ${admin.is_super_admin ? 'Yes ⭐' : 'No'}\n`;
    message += `<b>Added:</b> ${formatTimeAgo(admin.created_at)}\n`;

    const keyboard = new InlineKeyboard();

    // Toggle super admin button
    if (admin.is_super_admin) {
      keyboard.text(`⭐ Remove Super Admin`, `admin:adm:super:${userId}`);
    } else {
      keyboard.text(`⭐ Make Super Admin`, `admin:adm:super:${userId}`);
    }
    keyboard.row();

    // Remove admin button
    keyboard.text(`${EMOJI.CANCEL} Remove as Admin`, `admin:adm:remove:${userId}`);
    keyboard.row();

    // Back button
    keyboard.text(`${EMOJI.BACK} Back to List`, 'admin:adm:list');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing admin view:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading admin details.');
  }
}

/**
 * Toggle super admin status
 * Callback: admin:adm:super:<userId>
 */
export async function handleToggleSuperAdmin(
  ctx: BotContext,
  userId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    return;
  }

  try {
    const newStatus = await toggleSuperAdmin(userId);
    const statusText = newStatus ? 'promoted to Super Admin' : 'demoted from Super Admin';
    
    await ctx.answerCallbackQuery?.(`✅ User ${statusText}!`);
    
    // Refresh view
    await handleAdminView(ctx, userId);
  } catch (error) {
    console.error('Error toggling super admin:', error);
    await ctx.answerCallbackQuery?.('❌ Error updating status.');
  }
}

/**
 * Confirm admin removal
 * Callback: admin:adm:remove:<userId>
 */
export async function handleRemoveAdminConfirm(
  ctx: BotContext,
  userId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    return;
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      await ctx.answerCallbackQuery?.('❌ User not found.');
      return;
    }

    const userDisplay = user.username ? `@${user.username}` : user.first_name;

    const message = `${EMOJI.WARNING} Are you sure you want to remove admin status from ${userDisplay}?

They will lose all admin privileges.`;

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.CANCEL} Yes, Remove Admin`, `admin:adm:confirm:${userId}`)
      .row()
      .text(`${EMOJI.BACK} No, Go Back`, `admin:adm:view:${userId}`);

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error showing remove confirmation:', error);
    await ctx.answerCallbackQuery?.('❌ Error.');
  }
}

/**
 * Execute admin removal
 * Callback: admin:adm:confirm:<userId>
 */
export async function handleRemoveAdmin(
  ctx: BotContext,
  userId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    return;
  }

  // Prevent removing yourself
  if (userId === ctx.dbUser.id) {
    await ctx.answerCallbackQuery?.('❌ You cannot remove yourself.');
    return;
  }

  try {
    // Check if this is the last admin
    const adminCount = await getAdminCount(ctx.dbUser.hostel_id);
    if (adminCount <= 1) {
      await ctx.answerCallbackQuery?.('❌ Cannot remove the last admin!');
      return;
    }

    await removeAdmin(userId);
    
    await ctx.answerCallbackQuery?.('✅ Admin removed!');
    
    // Return to admin list
    await handleAdminManagement(ctx);
  } catch (error) {
    console.error('Error removing admin:', error);
    await ctx.answerCallbackQuery?.('❌ Error removing admin.');
  }
}

/**
 * Show list of users who can be added as admins
 * Callback: admin:adm:add or admin:adm:add:<page>
 */
export async function handleAddAdminList(
  ctx: BotContext,
  page: number = 1
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    return;
  }

  try {
    const eligibleUsers = await getApprovedNonAdminUsers(ctx.dbUser.hostel_id);

    if (eligibleUsers.length === 0) {
      const keyboard = new InlineKeyboard()
        .text(`${EMOJI.BACK} Back`, 'admin:admins');

      await ctx.editMessageText(
        'No eligible users to add as admin.\n\nAll approved users are already admins, or there are no approved users yet.',
        { reply_markup: keyboard }
      );
      return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(eligibleUsers.length / PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    const usersOnPage = eligibleUsers.slice(startIdx, endIdx);

    // Build message
    let message = `${EMOJI.JOIN} Add New Admin\n\n`;
    message += `Select a user to make an admin:\n\n`;

    const keyboard = new InlineKeyboard();

    for (const user of usersOnPage) {
      const userDisplay = user.username ? `@${user.username}` : user.first_name;
      
      message += `${EMOJI.USER} ${userDisplay}\n`;

      keyboard
        .text(`${EMOJI.JOIN} ${userDisplay.substring(0, 20)}`, `admin:adm:new:${user.id}`)
        .row();
    }

    // Add pagination controls if needed
    if (totalPages > 1) {
      if (page > 1) {
        keyboard.text(`${EMOJI.BACK} Prev`, `admin:adm:add:${page - 1}`);
      }
      keyboard.text(`Page ${page}/${totalPages}`, 'noop');
      if (page < totalPages) {
        keyboard.text(`Next ▶️`, `admin:adm:add:${page + 1}`);
      }
      keyboard.row();
    }

    // Back button
    keyboard.text(`${EMOJI.BACK} Back`, 'admin:admins');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing add admin list:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading users.');
  }
}

/**
 * Confirm adding user as admin
 * Callback: admin:adm:new:<userId>
 */
export async function handleAddAdminConfirm(
  ctx: BotContext,
  userId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    return;
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      await ctx.answerCallbackQuery?.('❌ User not found.');
      return;
    }

    const userDisplay = user.username ? `@${user.username}` : user.first_name;

    const message = `${EMOJI.JOIN} Add ${userDisplay} as admin?

They will be able to:
• Approve/reject new users
• Manage resources
• Cancel groups
• View statistics`;

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.APPROVE} Yes, Add Admin`, `admin:adm:save:${userId}`)
      .row()
      .text(`${EMOJI.BACK} Cancel`, 'admin:adm:add');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error showing add confirmation:', error);
    await ctx.answerCallbackQuery?.('❌ Error.');
  }
}

/**
 * Execute adding user as admin
 * Callback: admin:adm:save:<userId>
 */
export async function handleAddAdmin(
  ctx: BotContext,
  userId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  // Check super admin
  const isSuperAdmin = await isUserSuperAdmin(ctx.dbUser.id);
  if (!isSuperAdmin) {
    await ctx.answerCallbackQuery?.('❌ Super admin access required.');
    return;
  }

  try {
    await addAdmin(userId, ctx.dbUser.hostel_id, false);
    
    await ctx.answerCallbackQuery?.('✅ Admin added!');
    
    // Return to admin management
    await handleAdminManagement(ctx);
  } catch (error) {
    console.error('Error adding admin:', error);
    await ctx.answerCallbackQuery?.('❌ Error adding admin.');
  }
}

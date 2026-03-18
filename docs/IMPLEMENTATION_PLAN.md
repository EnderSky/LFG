# LFG Bot - Implementation Plan (Local Development)

## Overview

This document outlines the implementation plan for building the LFG Telegram bot using a **local-first approach**. The bot will run on Node.js using long polling for development and testing, with a future migration path to Cloudflare Workers for production.

## Development Approach

**Strategy**: Build and test locally first, then migrate to production infrastructure

**Benefits**:
- Fast iteration and debugging
- No deployment overhead during development
- Full Node.js environment and tooling
- Easy testing and experimentation
- Simple environment setup

**Timeline**: 10-15 days for core functionality

---

## Phase 1: Project Setup & Database Schema

**Duration**: 1-2 days  
**Priority**: High

### Tasks

#### 1.1 Initialize Project Structure
- [x] Create project directory
- [ ] Initialize npm project (`npm init`)
- [ ] Install dependencies:
  - `grammy` - Telegram bot framework
  - `@supabase/supabase-js` - Database client
  - `dotenv` - Environment variables
  - `tsx` - TypeScript execution (dev)
  - `typescript` - TypeScript compiler
  - `@types/node` - Node.js type definitions
- [ ] Configure TypeScript (`tsconfig.json`)
- [ ] Create `.env.example` template
- [ ] Set up `.gitignore` (include `.env`, `node_modules`, `dist`)
- [ ] Create folder structure:
  ```
  src/
    handlers/
    services/
    types/
    utils/
    middleware/
  supabase/
    migrations/
  tests/
  ```

#### 1.2 Database Setup
- [ ] Create Supabase project (cloud)
- [ ] Design and write database migration (`001_initial_schema.sql`):
  - `hostels` table
  - `users` table with status enum
  - `admins` table
  - `categories` table (global + hostel-specific)
  - `resources` table
  - `resource_sessions` table
  - `groups` table
  - `group_members` table
  - Add indexes for performance
  - Configure RLS policies
- [ ] Create seed data (`seed.sql`):
  - Predefined global categories (Mahjong, Switch, PlayStation, etc.)
  - Test hostel
  - Test admin user
- [ ] Execute migrations and seed in Supabase
- [ ] Test database connectivity

#### 1.3 Environment Configuration
- [ ] Create `.env` file with:
  - `TELEGRAM_BOT_TOKEN`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`
  - `NODE_ENV=development`
- [ ] Create environment type definitions
- [ ] Test loading environment variables

#### 1.4 Core Infrastructure Files
- [ ] Create `src/types/database.ts` - Database type definitions
- [ ] Create `src/types/index.ts` - Common types
- [ ] Create `src/services/database.ts` - Supabase client initialization
- [ ] Create `src/utils/constants.ts` - Configuration constants
- [ ] Test Supabase connection

**Deliverables**:
- Working project structure
- Database schema deployed to Supabase
- Environment configuration complete
- Type definitions in place

---

## Phase 2: Core Bot Functionality

**Duration**: 2-3 days  
**Priority**: High

### Tasks

#### 2.1 Bot Initialization
- [ ] Create `src/bot.ts` - Grammy bot setup
- [ ] Create `src/index.ts` - Main entry point with long polling
- [ ] Add error handling middleware
- [ ] Add logging middleware
- [ ] Test bot starts and responds to `/ping` command

#### 2.2 User Service Layer
- [ ] Create `src/services/users.ts`:
  - `getUserByTelegramId()`
  - `createPendingUser()`
  - `approveUser()`
  - `rejectUser()`
  - `getUserHostel()`
  - `isUserApproved()`
- [ ] Add user-related type definitions

#### 2.3 Authentication Middleware
- [ ] Create `src/middleware/auth.ts`:
  - Check if user exists in database
  - Check if user is approved
  - Attach user context to commands
  - Handle unapproved user messages
- [ ] Register middleware on bot

#### 2.4 Start Command
- [ ] Create `src/handlers/start.ts`:
  - Welcome message
  - Hostel selection (inline keyboard)
  - Create pending user in database
  - Notify admins of pending approval
  - Handle already registered users
- [ ] Create `src/utils/formatting.ts` for message templates
- [ ] Test complete registration flow

#### 2.5 Help Command
- [ ] Create `src/handlers/help.ts`:
  - List available commands
  - Different help for users vs admins
  - Examples and usage tips
- [ ] Test help command

#### 2.6 Callback Query Handlers
- [ ] Create `src/handlers/callbacks.ts`:
  - Handle hostel selection callback
  - Generic callback router
  - Error handling for invalid callbacks
- [ ] Register callback query handlers

**Deliverables**:
- Bot running with long polling
- User registration flow working
- Authentication middleware functional
- `/start` and `/help` commands complete

---

## Phase 3: Admin Approval System

**Duration**: 1-2 days  
**Priority**: High

### Tasks

#### 3.1 Admin Service Layer
- [ ] Create `src/services/admins.ts`:
  - `isUserAdmin()`
  - `getAdminHostels()`
  - `getPendingUsers()`
  - `notifyAdmins()`
  - `getAdminList()`

#### 3.2 Admin Middleware
- [ ] Create `src/middleware/admin.ts`:
  - Check if user is admin
  - Check hostel admin permissions
  - Deny non-admins from admin commands

#### 3.3 Notification Service
- [ ] Create `src/services/notifications.ts`:
  - `notifyAdminsOfPendingUser()`
  - `notifyUserApproved()`
  - `notifyUserRejected()`
  - Error handling for failed sends

#### 3.4 Admin Panel
- [ ] Create `src/handlers/admin.ts`:
  - `/admin` command - main panel
  - Inline keyboard menu:
    - Pending Users
    - Manage Resources
    - Manage Categories
    - All Groups
    - Manage Admins
    - Statistics
  - Handle admin panel callbacks

#### 3.5 User Approval Flow
- [ ] Pending users list view
- [ ] Approve button callback
- [ ] Reject button callback
- [ ] Quick approve command: `/approve <user_id>`
- [ ] Quick reject command: `/reject <user_id>`
- [ ] Send notifications to users and admins
- [ ] Update user status in database

**Deliverables**:
- Admin panel accessible
- User approval/rejection working
- Notifications sent correctly
- Admin permissions enforced

---

## Phase 4: Resource Management

**Duration**: 2 days  
**Priority**: High

### Tasks

#### 4.1 Resource Service Layer
- [ ] Create `src/services/resources.ts`:
  - `getResourcesByHostel()`
  - `getResourceById()`
  - `getResourceStatus()` (available/in-use)
  - `checkInResource()`
  - `checkOutResource()`
  - `createResource()`
  - `updateResource()`
  - `deleteResource()`
  - `getActiveResourceSessions()`

#### 4.2 Resources Command (User)
- [ ] Create `src/handlers/resources.ts`:
  - `/resources` command
  - Display resources grouped by category
  - Show availability status
  - Show time remaining for in-use resources
  - Interactive inline keyboard
  - Resource detail view
  - Check-in button and flow
  - Handle resource callbacks

#### 4.3 Checkout Command
- [ ] Create `src/handlers/checkout.ts`:
  - `/checkout` command
  - List user's active resource sessions
  - Checkout button per resource
  - Confirmation message
  - Update database

#### 4.4 Admin Resource Management
- [ ] Add resource management to admin panel:
  - List all resources
  - Add new resource flow:
    - Name
    - Description
    - Category selection
    - Max duration
  - Edit resource
  - Delete resource (with confirmation)
  - View active sessions
  - Force checkout (admin)

#### 4.5 Validation & Constraints
- [ ] Validate user doesn't exceed max active resources
- [ ] Prevent checking into in-use resources
- [ ] Handle edge cases (concurrent check-ins)

**Deliverables**:
- Users can view and check in/out of resources
- Admins can manage resources
- Resource status accurately tracked
- Validation and error handling in place

---

## Phase 5: Group Creation & Browsing

**Duration**: 3 days  
**Priority**: High

### Tasks

#### 5.1 Group Service Layer
- [ ] Create `src/services/groups.ts`:
  - `createGroup()`
  - `getGroupById()`
  - `getGroupsByHostel()`
  - `getGroupsByCategory()`
  - `updateGroupStatus()`
  - `cancelGroup()`
  - `getGroupMembers()`
  - `incrementPlayerCount()`
  - `decrementPlayerCount()`

#### 5.2 Category Service
- [ ] Create `src/services/categories.ts`:
  - `getCategoriesByHostel()` (global + hostel-specific)
  - `getCategoryById()`
  - `createCategory()`
  - `updateCategory()`
  - `deleteCategory()`

#### 5.3 Conversation State Management
- [ ] Choose state management approach:
  - Option 1: Grammy conversations plugin
  - Option 2: Simple in-memory state map
  - Option 3: Database-backed session state
- [ ] Implement chosen approach for multi-step flows

#### 5.4 LFG Command (Create Group)
- [ ] Create `src/handlers/lfg.ts`:
  - `/lfg` command initiates flow
  - Step 1: Category selection (inline keyboard)
  - Step 2: Game name (text input)
  - Step 3: Player count (inline keyboard 2-8)
  - Step 4: Timing (Now / 30min / 1hr / 2hrs / Custom)
  - Step 5: Resource selection (optional)
  - Create group in database
  - Reserve resource if selected
  - Send confirmation to user
  - Post to hostel public channel
  - Handle cancellation at any step

#### 5.5 Browse Command
- [ ] Create `src/handlers/browse.ts`:
  - `/browse` command
  - Show category buttons with active group counts
  - Category view:
    - List groups in category
    - Show key details (title, players, time, resource)
    - Join button per group
  - Back navigation
  - Empty state messages
  - Pagination if many groups

#### 5.6 Telegram Channel Integration
- [ ] Create `src/services/telegram.ts`:
  - `postGroupToChannel()`
  - Format announcement message
  - Handle channel posting errors
  - Include join link/command

#### 5.7 Validation
- [ ] Validate max groups per user (3)
- [ ] Validate player count (2-8)
- [ ] Validate scheduled time (not in past)
- [ ] Check resource availability
- [ ] Prevent duplicate group creation (rate limit)

**Deliverables**:
- `/lfg` creates groups with full flow
- Groups posted to hostel channels
- `/browse` shows active groups
- Resource auto-reservation working
- Input validation complete

---

## Phase 6: Join/Leave Groups

**Duration**: 1-2 days  
**Priority**: High

### Tasks

#### 6.1 Group Membership Service
- [ ] Extend `src/services/groups.ts`:
  - `joinGroup()`
  - `leaveGroup()`
  - `isUserInGroup()`
  - `getUserActiveGroups()`
  - `canUserJoinGroup()` (validation)

#### 6.2 Join Functionality
- [ ] Create `src/handlers/join.ts`:
  - Handle join button from browse
  - Handle `/join <group_id>` command
  - Validate user can join:
    - Not already in group
    - Group not full
    - Under max memberships (5)
    - User is approved
  - Add user to group_members
  - Increment current_players
  - Send confirmation to user
  - Notify group creator and members
  - Update group status if now full
  - Handle resource conflicts

#### 6.3 Leave Functionality
- [ ] Create `src/handlers/leave.ts`:
  - Handle `/leave <group_id>` command
  - Remove user from group_members
  - Decrement current_players
  - Send confirmation
  - Notify remaining members
  - Special handling if creator leaves:
    - Cancel entire group
    - Notify all members
    - Free resources

#### 6.4 My Groups Command
- [ ] Create `src/handlers/mygroups.ts`:
  - `/mygroups` command
  - List user's active groups (as creator and member)
  - Show group details
  - Quick action buttons:
    - View group
    - Leave group
  - Empty state message

#### 6.5 Notifications
- [ ] Extend `src/services/notifications.ts`:
  - `notifyGroupMemberJoined()`
  - `notifyGroupFull()`
  - `notifyUserLeftGroup()`
  - `notifyGroupCancelled()`

**Deliverables**:
- Users can join groups via browse or command
- Users can leave groups
- Notifications sent to relevant parties
- Group creator leaving cancels group
- `/mygroups` shows user's active groups

---

## Phase 7: Notifications System

**Duration**: 1-2 days  
**Priority**: Medium

### Tasks

#### 7.1 Extend Notification Service
- [ ] Complete `src/services/notifications.ts`:
  - `notifyGroupStartingSoon()` (15 min before)
  - `notifyResourceAutoCheckoutWarning()` (30 min before)
  - `notifyResourceAutoCheckedOut()`
  - `notifyGroupExpired()`
  - Helper: `getUsersByGroup()`
  - Helper: `formatNotificationMessage()`

#### 7.2 DateTime Utilities
- [ ] Create `src/utils/datetime.ts`:
  - `addMinutes()`
  - `addHours()`
  - `isBefore()`
  - `isAfter()`
  - `minutesUntil()`
  - `formatTimeRemaining()`
  - `formatTimestamp()`

#### 7.3 Test Notifications
- [ ] Test notification delivery
- [ ] Test error handling (user blocked bot)
- [ ] Test message formatting
- [ ] Test timezone handling

**Deliverables**:
- Notification service complete
- All notification types implemented
- DateTime utilities working
- Error handling for blocked users

---

## Phase 8: Auto-Expiry & Cleanup Jobs

**Duration**: 2 days  
**Priority**: Medium

### Tasks

#### 8.1 Scheduler Setup
- [ ] Create `src/scheduler.ts`:
  - Initialize intervals from env vars
  - `startNotificationCheck()` - every 5 min
  - `startCleanupJob()` - every 15 min
  - `startArchivalJob()` - every hour
  - Graceful shutdown handling
  - Error handling with retry

#### 8.2 Notification Check Job
- [ ] Implement notification scheduler:
  - Find groups starting in 15 minutes
  - Send "starting soon" notifications
  - Mark as notified (add field to groups table)
  - Find resource sessions expiring in 30 minutes
  - Send auto-checkout warnings

#### 8.3 Cleanup Job
- [ ] Implement cleanup scheduler:
  - Find expired groups (past expires_at)
  - Update status to 'completed' or 'expired'
  - Free associated resources
  - Find resource sessions past auto_checkout_at
  - Auto-checkout resources
  - Send notifications
  - Update statuses

#### 8.4 Archival Job
- [ ] Implement archival scheduler:
  - Move groups older than 7 days to archive (or delete)
  - Move resource sessions older than 30 days
  - Aggregate statistics
  - Database cleanup/vacuum (if needed)

#### 8.5 Integration
- [ ] Call scheduler from `src/index.ts`
- [ ] Test all three jobs
- [ ] Test with different intervals
- [ ] Verify database updates
- [ ] Check notification delivery
- [ ] Monitor performance

**Deliverables**:
- Background scheduler running
- Groups auto-expire correctly
- Resources auto-checkout
- Notifications sent on schedule
- Old data archived
- Logging for monitoring

---

## Phase 9: Admin Dashboard & Statistics

**Duration**: 2 days  
**Priority**: Low

### Tasks

#### 9.1 Group Management (Admin)
- [ ] Extend `src/handlers/admin.ts`:
  - View all active groups
  - Filter by status (open/full/in-progress)
  - Group detail view
  - Cancel group button
  - Confirmation dialog
  - Notify all members on cancel

#### 9.2 Category Management (Admin)
- [ ] Add to admin panel:
  - List global + hostel categories
  - Add category flow (name, emoji)
  - Edit category (name, emoji, order)
  - Delete category (with usage check)
  - Reorder categories

#### 9.3 Admin Management (Super Admin)
- [ ] Add to admin panel:
  - List current admins
  - Add admin (select from approved users)
  - Remove admin
  - Toggle super admin status
  - Require super admin for these actions

#### 9.4 Statistics Service
- [ ] Create `src/services/statistics.ts`:
  - `getGroupStats()` - total, by time period
  - `getPopularGames()` - most created groups
  - `getPopularResources()` - most used
  - `getUserStats()` - total, growth
  - `getResourceUtilization()` - hours used
  - `getPeakHours()` - busiest times

#### 9.5 Statistics View
- [ ] Add to admin panel:
  - Time period selector (7/30/90 days)
  - Total users, groups, sessions
  - Growth percentages
  - Top 5 games
  - Top 5 resources
  - Peak hours chart (text-based)
  - Export data option (CSV/JSON)

#### 9.6 Admin Commands
- [ ] Quick commands:
  - `/stats` - Quick stats view
  - `/cancel <group_id>` - Cancel group
  - `/users` - User count
  - `/pending` - Pending user count

**Deliverables**:
- Admins can view all groups and cancel
- Category management complete
- Admin user management (super admin)
- Statistics dashboard functional
- Quick admin commands working

---

## Phase 10: Testing & Polish

**Duration**: 2-3 days  
**Priority**: High

### Tasks

#### 10.1 Manual Testing
- [ ] Test complete user journey:
  - Registration → Approval → Create Group → Join Group → Notifications → Leave
- [ ] Test admin journey:
  - Approve users → Manage resources → View groups → Cancel group → Stats
- [ ] Test edge cases:
  - Group becomes full while joining
  - Resource in use when checking in
  - Creator leaves group
  - User blocked bot
  - Invalid inputs
  - Concurrent operations
- [ ] Test multi-hostel isolation
- [ ] Test rate limiting
- [ ] Test all notification types

#### 10.2 Error Handling & Validation
- [ ] Review all user inputs for validation
- [ ] Add friendly error messages
- [ ] Handle database errors gracefully
- [ ] Handle Telegram API errors
- [ ] Add retry logic where appropriate
- [ ] Log errors for debugging

#### 10.3 Rate Limiting
- [ ] Create `src/middleware/ratelimit.ts`:
  - In-memory rate limit store (Map)
  - Group creation limit (1 per minute)
  - Resource check-in cooldown (30 seconds)
  - Command spam prevention
- [ ] Test rate limiting

#### 10.4 Performance Optimization
- [ ] Review database queries
- [ ] Add database indexes if needed
- [ ] Optimize inline keyboard generation
- [ ] Cache frequently accessed data (categories, hostels)
- [ ] Test with multiple concurrent users

#### 10.5 Code Quality
- [ ] Add JSDoc comments to public functions
- [ ] Ensure consistent code style
- [ ] Remove console.logs (use proper logging)
- [ ] Add input sanitization
- [ ] Security review (SQL injection, etc.)

#### 10.6 Documentation
- [ ] Update README with actual setup steps
- [ ] Document environment variables
- [ ] Add troubleshooting section
- [ ] Create admin user guide
- [ ] Add code comments for complex logic

#### 10.7 Deployment Preparation
- [ ] Create npm scripts:
  - `npm run dev` - Development with watch
  - `npm run build` - TypeScript compilation
  - `npm start` - Production start
  - `npm test` - Run tests
- [ ] Test production build
- [ ] Verify environment variables
- [ ] Create deployment checklist

**Deliverables**:
- All features tested and working
- Error handling comprehensive
- Rate limiting implemented
- Performance optimized
- Code documented
- Ready for real-world testing

---

## Timeline Summary

| Phase | Duration | Priority | Status |
|-------|----------|----------|--------|
| 1. Project Setup & Database | 1-2 days | High | Pending |
| 2. Core Bot Functionality | 2-3 days | High | Pending |
| 3. Admin Approval System | 1-2 days | High | Pending |
| 4. Resource Management | 2 days | High | Pending |
| 5. Group Creation & Browsing | 3 days | High | Pending |
| 6. Join/Leave Groups | 1-2 days | High | Pending |
| 7. Notifications System | 1-2 days | Medium | Pending |
| 8. Auto-Expiry & Cleanup | 2 days | Medium | Pending |
| 9. Admin Dashboard & Stats | 2 days | Low | Pending |
| 10. Testing & Polish | 2-3 days | High | Pending |
| **Total** | **17-23 days** | | |

**Realistic Timeline**: 3-4 weeks for complete implementation

---

## Development Environment

### Required Tools
- Node.js 18+ with npm
- Code editor (VS Code recommended)
- Git for version control
- Telegram account for testing
- Supabase account (free tier)

### Recommended VS Code Extensions
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Thunder Client (for API testing)

### Environment Variables Checklist
```env
TELEGRAM_BOT_TOKEN=           # From @BotFather
SUPABASE_URL=                 # From Supabase project settings
SUPABASE_ANON_KEY=            # From Supabase project settings  
SUPABASE_SERVICE_KEY=         # From Supabase project settings
NODE_ENV=development
NOTIFICATION_CHECK_INTERVAL=300000
CLEANUP_INTERVAL=900000
ARCHIVE_INTERVAL=3600000
```

---

## Migration to Cloudflare Workers (Future)

When ready for production, the migration will involve:

### Code Changes Required
1. **Entry Point** (`src/index.ts`):
   - Replace `bot.start()` with `webhookCallback()`
   - Export Cloudflare Worker handler

2. **Scheduler** (`src/scheduler.ts`):
   - Remove `setInterval()` calls
   - Create separate scheduled worker file
   - Use Cloudflare cron triggers

3. **Environment Variables**:
   - Move from `.env` to `wrangler.toml` and secrets
   - Update loading mechanism

### Infrastructure Setup
1. Create `wrangler.toml` configuration
2. Deploy with `wrangler deploy`
3. Set Telegram webhook URL
4. Configure cron triggers
5. Test in production

### Estimated Migration Time
- 1-2 days for code changes
- 1 day for deployment and testing

---

## Success Metrics

### Phase Completion Criteria
Each phase is complete when:
- All tasks are checked off
- Features work as designed
- Tests pass
- No critical bugs
- Code is committed

### MVP Success Criteria
The bot is ready for real users when:
- Users can register and get approved
- Users can create and join groups
- Resources can be checked in/out
- Notifications are sent correctly
- Groups auto-expire
- Admins can manage everything
- Error handling is robust
- Performance is acceptable

---

## Risk Mitigation

### Technical Risks
- **Grammy/Telegram API changes**: Pin dependency versions, monitor changelog
- **Supabase limits**: Monitor usage, optimize queries
- **Rate limiting from Telegram**: Implement queuing, batch operations
- **Concurrent operations**: Use database transactions, handle conflicts

### Development Risks
- **Scope creep**: Stick to phases, defer enhancements
- **Underestimated complexity**: Build buffer time into estimates
- **Third-party service issues**: Have backup plans, good error handling

---

## Next Steps

After this plan is approved:

1. **Start Phase 1**: Initialize project and database
2. **Daily standups**: Review progress, blockers, next tasks
3. **Test as you go**: Don't wait until Phase 10
4. **Document learnings**: Update this plan with insights
5. **Celebrate milestones**: Mark each phase completion

---

**Document Version**: 1.0 (Local Development)  
**Created**: 2026-03-19  
**Status**: Ready for Implementation

Let's build something great! 🚀

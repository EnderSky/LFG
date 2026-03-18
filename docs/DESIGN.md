# LFG Bot - Design Document

## Overview

**LFG** (Looking For Groups) is a Telegram bot designed to help hostel guests find friends to play games and use shared resources. The bot manages gaming lobbies, resource availability, and multi-hostel coordination.

## Technical Stack

- **Bot Framework**: Grammy (Telegram Bot API library)
- **Runtime**: Node.js (Local development first, Cloudflare Workers for production)
- **Database**: Supabase (PostgreSQL - Cloud)
- **Language**: TypeScript
- **Update Method**: Long polling for local, webhooks for production

## Architecture

### Development Architecture (Local)

```
Telegram Users
      ↓
Telegram Bot API (Long Polling)
      ↓
Node.js Server (localhost)
      ↓
Supabase Database (Cloud)
```

**Local Development Setup:**
1. **Main Server**: Node.js process running Grammy bot with long polling
2. **Background Jobs**: Simple `setInterval()` for cleanup and notifications
   - Every 5 minutes: Check for expiring groups and send notifications
   - Every 15 minutes: Auto-expire old groups and resource sessions
   - Every hour: Archive old data
3. **Development Mode**: Uses `tsx watch` or `nodemon` for hot reloading

### Production Architecture (Future - Cloudflare Workers)

```
Telegram Users
      ↓
Telegram Bot API (Webhook)
      ↓
Cloudflare Workers (Serverless)
      ↓
Supabase Database (Cloud)
```

**Production Setup:**
1. **Main Worker**: Handles all incoming Telegram webhook requests
2. **Scheduled Worker**: Cloudflare cron triggers for cleanup and notifications
3. **Global Distribution**: Edge deployment for low latency

**Note**: This design document focuses on the local development version first. Migration to Cloudflare Workers requires minimal code changes (mainly entry point and cron implementation).

## Database Schema

### Tables

#### `hostels`
```sql
id: uuid (PK)
name: text
slug: text (unique)
telegram_channel_id: text (for public group announcements)
timezone: text
created_at: timestamp
updated_at: timestamp
```

#### `users`
```sql
id: uuid (PK)
telegram_id: bigint (unique)
username: text
first_name: text
last_name: text
hostel_id: uuid (FK → hostels)
status: enum ('pending', 'approved', 'banned')
created_at: timestamp
updated_at: timestamp
```

#### `admins`
```sql
id: uuid (PK)
user_id: uuid (FK → users)
hostel_id: uuid (FK → hostels)
is_super_admin: boolean (can manage other admins)
created_at: timestamp
```

#### `categories`
```sql
id: uuid (PK)
hostel_id: uuid (FK → hostels, nullable for global categories)
name: text
icon: text (emoji)
is_global: boolean (predefined vs hostel-specific)
display_order: integer
created_at: timestamp
updated_at: timestamp
```

**Predefined Global Categories:**
- Mahjong
- Nintendo Switch
- PlayStation
- Xbox
- Board Games
- Card Games
- Pool/Billiards
- Table Tennis
- Other

#### `resources`
```sql
id: uuid (PK)
hostel_id: uuid (FK → hostels)
name: text
category_id: uuid (FK → categories, nullable)
description: text
max_duration_hours: integer (default 6)
created_at: timestamp
updated_at: timestamp
```

#### `resource_sessions`
```sql
id: uuid (PK)
resource_id: uuid (FK → resources)
user_id: uuid (FK → users)
group_id: uuid (FK → groups, nullable)
checked_in_at: timestamp
checked_out_at: timestamp (nullable)
auto_checkout_at: timestamp
status: enum ('active', 'completed', 'expired')
```

#### `groups`
```sql
id: uuid (PK)
hostel_id: uuid (FK → hostels)
creator_id: uuid (FK → users)
category_id: uuid (FK → categories)
title: text (e.g., "Mario Kart 8")
description: text (nullable)
max_players: integer
current_players: integer
resource_id: uuid (FK → resources, nullable)
scheduled_for: timestamp
starts_at: timestamp (nullable, when first person joins or scheduled time)
expires_at: timestamp
status: enum ('open', 'full', 'in_progress', 'completed', 'cancelled')
created_at: timestamp
updated_at: timestamp
```

#### `group_members`
```sql
id: uuid (PK)
group_id: uuid (FK → groups)
user_id: uuid (FK → users)
joined_at: timestamp
left_at: timestamp (nullable)
status: enum ('active', 'left')
UNIQUE(group_id, user_id)
```

### Indexes

```sql
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_hostel_status ON users(hostel_id, status);
CREATE INDEX idx_groups_hostel_status ON groups(hostel_id, status);
CREATE INDEX idx_groups_expires_at ON groups(expires_at);
CREATE INDEX idx_resource_sessions_status ON resource_sessions(status);
CREATE INDEX idx_resource_sessions_resource ON resource_sessions(resource_id, status);
```

### Row Level Security (RLS) Policies

All tables will have RLS enabled with policies ensuring:
- Users can only read/write data for their approved hostel
- Admins have elevated permissions for their hostel
- Super admins can manage global categories
- Service role (Cloudflare Worker) has full access

## User Workflows

### 1. New User Registration

```
User: /start
Bot: "Welcome to LFG! 🎮 Which hostel are you staying at?"
     [Hostel A] [Hostel B] [Hostel C]
     
User: Selects "Hostel A"
Bot: "Thanks! Your access request has been sent to the admins at Hostel A. 
     You'll be notified once approved!"
     
     → Notification sent to all admins of Hostel A
     
Admin: Receives message
       "New user @username (First Last) wants to join Hostel A"
       [Approve ✅] [Reject ❌]
       
Admin: Clicks [Approve ✅]
Bot → User: "You've been approved! 🎉 Use /help to see what you can do."
```

### 2. Creating a Group (LFG)

```
User: /lfg
Bot: "What would you like to play?"
     [🀄 Mahjong] [🎮 Switch] [🎮 PlayStation] [🎮 Xbox]
     [🎲 Board Games] [🃏 Card Games] [🎱 Pool] [🏓 Table Tennis]
     [➕ Other]
     
User: Selects [🎮 Switch]
Bot: "Great! What game?" (free text input)

User: "Mario Kart 8"
Bot: "How many players total (including you)? (2-8)"

User: "4"
Bot: "When would you like to play?"
     [▶️ Now] [⏰ In 30min] [⏰ In 1hr] [⏰ In 2hrs] [📅 Custom]
     
User: Selects [⏰ In 30min]
Bot: "Would you like to reserve a resource?"
     [📺 TV Lounge A - Available] 
     [📺 TV Lounge B - In use (45min left)]
     [🎮 Switch Dock 1 - Available]
     [⏭️ Skip]
     
User: Selects [📺 TV Lounge A]
Bot: "Perfect! Here's your group:
     
     🎮 Mario Kart 8
     👥 1/4 players
     📅 Starts in 30 minutes (7:30 PM)
     📺 Resource: TV Lounge A (reserved)
     
     Your group is now live! Others can join via /browse.
     
     → Group posted to hostel's public channel
     → TV Lounge A automatically checked in for this group
     → Group expires in 6 hours from scheduled time"
     
     → Group posted to hostel's public channel
     → TV Lounge A automatically checked in for this group
     → Group expires in 6 hours from scheduled time
```

### 3. Browsing Groups

```
User: /browse
Bot: "Active groups at Hostel A:
     
     🎮 Switch (2) | 🀄 Mahjong (1) | 🎲 Board Games (1)
     
     Tap a category to see groups."
     [🎮 Switch (2)] [🀄 Mahjong (1)] [🎲 Board Games (1)]
     
User: Selects [🎮 Switch (2)]
Bot: Shows:
     "🎮 Switch Groups:
     
     1️⃣ Mario Kart 8
        👤 @creator | 2/4 players
        ⏰ Starts in 25min
        📺 TV Lounge A
        [Join Group]
        
     2️⃣ Smash Bros Ultimate
        👤 @otheruser | 1/4 players  
        ▶️ Starting now!
        📺 TV Lounge B
        [Join Group]
     
     [← Back]"
     
User: Clicks [Join Group] on Mario Kart
Bot: "You've joined Mario Kart 8! 🎉
     Current players: 3/4
     Starts in 25min
     
     You'll be notified when:
     - The group is full
     - It's time to play (15min before)
     
     Use /mygroups to see all your groups"
     
     → Notification sent to group creator and other members
     → If group is now full (4/4), update status and notify all
```

### 4. Managing Your Groups

```
User: /mygroups
Bot: "Your active groups:
     
     🎮 Mario Kart 8
     👥 3/4 players | ⏰ Starts in 23min
     📺 TV Lounge A
     [View] [Leave]
     
     🀄 Mahjong Night
     👥 4/4 players FULL | ▶️ In progress
     📍 Mahjong Table 1
     [View] [Leave]
     
     [Create New Group]"
```

### 5. Resource Management

```
User: /resources
Bot: "Resources at Hostel A:
     
     📺 TV Lounges
     ✅ TV Lounge A - Available
     🔴 TV Lounge B - In use (1h 23min left)
          Used by: Mario Kart group
     
     🀄 Mahjong
     🔴 Mahjong Table 1 - In use (4h 15min left)
          Used by: @username
     ✅ Mahjong Table 2 - Available
     
     🎱 Recreation
     ✅ Pool Table - Available
     ✅ Table Tennis - Available"
     
User: Taps "🎱 Pool Table"
Bot: "🎱 Pool Table
     Status: ✅ Available
     Max duration: 6 hours
     
     [Check In] [← Back]"
     
User: Clicks [Check In]
Bot: "Checked in to 🎱 Pool Table!
     Auto-checkout: in 6 hours
     
     Please use /checkout when you're done so others can use it!
     
     Current session: /session_XYZ789"
     
     → Resource status updated in database
     → Auto-checkout scheduled for 6 hours
```

### 6. Checking Out

```
User: /checkout
Bot: "Your active resources:
     
     🎱 Pool Table
     Checked in: 45min ago
     [Check Out]
     
     📺 TV Lounge A (via Mario Kart group)
     Reserved for group
     [View Group]"
     
User: Clicks [Check Out] on Pool Table
Bot: "Checked out of 🎱 Pool Table!
     Session duration: 45 minutes
     Thanks for keeping resources available! 🙏"
     
     → Resource marked as available
     → Session marked as completed
```

## Admin Workflows

### 1. Admin Panel

```
Admin: /admin
Bot: "Admin Panel - Hostel A
     
     [👤 Pending Users (3)]
     [📦 Manage Resources]
     [🏷️ Manage Categories]
     [👥 All Groups (8)]
     [👨‍💼 Manage Admins]
     [📊 Statistics]
     [🔧 Settings]"
```

### 2. Approving Users

```
Admin: Clicks [👤 Pending Users (3)]
Bot: "Pending approval:
     
     1️⃣ @username (John Doe)
        Requested: 2 hours ago
        [✅ Approve] [❌ Reject]
        
     2️⃣ @user2 (Jane Smith)
        Requested: 5 hours ago
        [✅ Approve] [❌ Reject]
        
     3️⃣ @user3 (Bob Wilson)
        Requested: 1 day ago
        [✅ Approve] [❌ Reject]
     
     [← Back]"
     
Admin: Clicks [✅ Approve] for user 1
Bot: "@username has been approved!
     They've been notified and can now use the bot."
```

### 3. Managing Resources

```
Admin: Clicks [📦 Manage Resources]
Bot: "Resource Management
     
     📺 TV Lounges (2)
     🀄 Mahjong (2)
     🎱 Recreation (2)
     
     [➕ Add Resource] [← Back]"
     
Admin: Clicks [➕ Add Resource]
Bot: "What type of resource?"
     [📺 TV Lounge] [🎮 Gaming Console] [🀄 Mahjong Table]
     [🎱 Pool Table] [🏓 Table Tennis] [➕ Other]
     
Admin: Selects [📺 TV Lounge]
Bot: "Name for this resource? (e.g., 'TV Lounge C')"

Admin: "TV Lounge C"
Bot: "Description? (optional, or send /skip)"

Admin: "55-inch TV with Switch, PS5, and Xbox"
Bot: "Max duration in hours? (default: 6)"

Admin: "4"
Bot: "Resource created! ✅
     
     📺 TV Lounge C
     Description: 55-inch TV with Switch, PS5, and Xbox
     Max duration: 4 hours
     
     [Edit] [Delete] [← Back to Resources]"
```

### 4. Managing Categories

```
Admin: Clicks [🏷️ Manage Categories]
Bot: "Category Management
     
     Global Categories (9)
     🀄 Mahjong | 🎮 Switch | 🎮 PlayStation
     🎮 Xbox | 🎲 Board Games | 🃏 Card Games
     🎱 Pool | 🏓 Table Tennis | ➕ Other
     
     Hostel A Categories (2)
     ⚽ Football | 🎳 Bowling
     
     [➕ Add Category] [Edit Categories] [← Back]"
     
Admin: Clicks [➕ Add Category]
Bot: "Category name?"

Admin: "Poker Night"
Bot: "Choose an icon/emoji:"

Admin: "♠️"
Bot: "Category created! ✅
     ♠️ Poker Night is now available for your hostel."
```

### 5. Viewing All Groups

```
Admin: Clicks [👥 All Groups (8)]
Bot: "All Active Groups - Hostel A
     
     📅 Now / Soon (3)
     🎮 Mario Kart 8 | 3/4 players | Starts in 20min
        Created by @creator
        [View] [Cancel]
     
     🀄 Mahjong | 4/4 FULL | In progress
        Created by @user2
        [View] [Cancel]
     
     🎲 Catan | 2/4 players | Starts in 1h
        Created by @user3
        [View] [Cancel]
     
     📅 Scheduled (5)
     [View Scheduled] [← Back]"
     
Admin: Clicks [Cancel] on a group
Bot: "Are you sure you want to cancel 'Mario Kart 8'?
     This will notify all 3 members.
     [✅ Yes, Cancel] [❌ No, Go Back]"
     
Admin: Clicks [✅ Yes, Cancel]
Bot: "Group cancelled. All members have been notified.
     Associated resource (TV Lounge A) has been freed."
     
     → Notifications sent to all group members
     → Resource session ended
     → Group status set to 'cancelled'
```

### 6. Statistics Dashboard

```
Admin: Clicks [📊 Statistics]
Bot: "Statistics - Hostel A
     Last 7 days:
     
     👥 Total Users: 45 (↑12%)
     🎮 Groups Created: 67 (↑8%)
     📦 Resource Sessions: 123 (↑15%)
     
     Most Popular Games:
     1️⃣ Mahjong - 28 groups
     2️⃣ Mario Kart - 15 groups
     3️⃣ Smash Bros - 12 groups
     
     Most Used Resources:
     1️⃣ Mahjong Table 1 - 45h
     2️⃣ TV Lounge A - 38h
     3️⃣ Pool Table - 31h
     
     Peak Hours:
     🔥 8 PM - 11 PM
     
     [📥 Export Data] [← Back]"
```

## Notification System

### Notification Types

1. **User Approved/Rejected**
   - Trigger: Admin approves/rejects user
   - Recipient: The user
   - Content: Approval status

2. **Someone Joined Your Group**
   - Trigger: User joins a group
   - Recipients: Group creator + all existing members
   - Content: New member info, updated player count

3. **Group Full**
   - Trigger: Group reaches max_players
   - Recipients: All group members
   - Content: Group is ready, start time

4. **Group Starting Soon**
   - Trigger: 15 minutes before scheduled time
   - Recipients: All active group members
   - Content: Reminder with location/resource info

5. **Group Cancelled**
   - Trigger: Creator leaves OR admin cancels
   - Recipients: All group members
   - Content: Cancellation reason (if provided)

6. **Resource Available**
   - Trigger: User checks out OR auto-checkout
   - Recipients: Users who favorited this resource (future feature)
   - Content: Resource now available

7. **Auto-Checkout Warning**
   - Trigger: 30 minutes before auto-checkout
   - Recipient: User who checked in
   - Content: Reminder to checkout or extend

8. **New User Pending Approval**
   - Trigger: User requests access
   - Recipients: All admins for that hostel
   - Content: User info with approve/reject buttons

### Public Channel Posts

Each hostel has a Telegram channel where new groups are announced:

```
📢 New Group Created!

🎮 Mario Kart 8
👤 Created by @username
👥 2/4 players
⏰ Starts in 30 minutes (7:30 PM)
📺 TV Lounge A
```

## Automatic Cleanup & Expiry

### Scheduled Jobs (Cloudflare Cron)

#### Every 5 minutes: Notification Check
- Find groups starting in 15 minutes
- Send "starting soon" notifications
- Find resource sessions expiring in 30 minutes
- Send auto-checkout warnings

#### Every 15 minutes: Expiry & Cleanup
- Find groups where `expires_at < NOW()`
  - Update status to 'completed' or 'expired'
  - End associated resource sessions
  - Send completion notifications
- Find resource sessions where `auto_checkout_at < NOW()`
  - Auto-checkout users
  - Update status to 'expired'
  - Send auto-checkout notifications

#### Every hour: Archival
- Archive groups older than 7 days
- Archive resource sessions older than 30 days
- Aggregate statistics

### Group Expiry Logic

```
Default expiry: scheduled_for + 6 hours

If creator leaves before group starts:
  → Cancel group immediately
  
If group has < 50% members after 2 hours:
  → Send warning to remaining members
  → Auto-cancel if still < 50% after 1 more hour
  
If group is full and in progress:
  → Normal 6-hour expiry from start time
```

### Resource Auto-Checkout Logic

```
Default: check_in_time + max_duration_hours (default 6)

30 minutes before auto-checkout:
  → Send warning notification
  → Offer extend button (max +2 hours if resource not reserved)
  
At auto-checkout time:
  → Mark session as 'expired'
  → Free up resource
  → Send checkout notification
```

## Rate Limiting & Anti-Spam

### User Limits
- Max 3 active groups as creator
- Max 5 active group memberships
- Max 2 active resource check-ins
- Group creation cooldown: 1 minute between creates
- Resource check-in cooldown: 30 seconds

### Admin Limits
- No rate limits on admin actions
- All admin actions logged for audit

## Security Measures

### Telegram Update Validation (Local Development)
- Bot token kept secure in .env file
- Long polling automatically validates updates from Telegram
- No webhook signature needed for local development

### Supabase RLS Policies
```sql
-- Users can only see approved users in their hostel
CREATE POLICY users_select ON users
  FOR SELECT
  USING (
    hostel_id IN (
      SELECT hostel_id FROM users 
      WHERE telegram_id = current_telegram_id() 
      AND status = 'approved'
    )
  );

-- Users can only create groups in their hostel
CREATE POLICY groups_insert ON groups
  FOR INSERT
  WITH CHECK (
    hostel_id IN (
      SELECT hostel_id FROM users 
      WHERE telegram_id = current_telegram_id() 
      AND status = 'approved'
    )
  );

-- Admins can manage resources in their hostel
CREATE POLICY resources_admin ON resources
  FOR ALL
  USING (
    hostel_id IN (
      SELECT hostel_id FROM admins a
      JOIN users u ON a.user_id = u.id
      WHERE u.telegram_id = current_telegram_id()
    )
  );
```

### Environment Variables & Secrets
```
TELEGRAM_BOT_TOKEN (secret - store in .env)
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY (secret - store in .env)
NODE_ENV (development/production)
```

## Error Handling

### User-Facing Errors
All errors shown to users should be friendly and actionable:

- **Not Approved**: "You need to be approved by an admin first. Use /start to request access."
- **Group Full**: "This group is already full! Try browsing other groups with /browse"
- **Resource In Use**: "This resource is currently in use. Check back in X minutes!"
- **Rate Limited**: "Slow down! You can create another group in X seconds."
- **Invalid Input**: "Hmm, that doesn't look right. Player count should be between 2-8."

### System Errors
- Log all errors to Cloudflare Workers logs
- Graceful degradation (e.g., if channel post fails, still create group)
- Retry mechanism for failed notifications (max 3 retries)

## Testing Strategy

### Unit Tests
- Database queries and mutations
- Validation functions
- Date/time calculations
- Formatting utilities

### Integration Tests
- Full user workflows (registration → group creation → joining)
- Admin workflows
- Notification delivery
- Cleanup jobs

### Manual Testing Checklist
- [ ] New user registration and approval
- [ ] Creating groups with all timing options
- [ ] Joining and leaving groups
- [ ] Resource check-in and checkout
- [ ] Auto-expiry and notifications
- [ ] Admin panel functions
- [ ] Multi-hostel isolation
- [ ] Rate limiting
- [ ] Error handling

## Local Development & Deployment

### Prerequisites
1. Node.js 18+ installed
2. Telegram Bot created via @BotFather
3. Supabase project created (cloud)
4. Telegram channels created for each hostel
5. Git for version control

### Local Setup Steps
1. Clone repository
2. Install dependencies: `npm install`
3. Set up Supabase:
   - Run database migrations in Supabase SQL Editor
   - Seed predefined categories and test data
   - Create first hostel and super admin in database
4. Configure environment variables in `.env`
5. Start development server: `npm run dev`
6. Bot will start with long polling (no webhook needed)

### Running Locally
```bash
# Start the bot
npm run dev

# The scheduler will automatically start background jobs:
# - Notification checks (every 5 min)
# - Cleanup tasks (every 15 min)
# - Archival (every hour)

# Check logs in console for bot activity
```

### Monitoring (Local)
- Console logs for all bot activity
- Supabase dashboard for database queries
- Manual testing with Telegram client
- Error stack traces in terminal

## Future Production Deployment (Cloudflare Workers)

When ready for production, migration to Cloudflare Workers will require:

1. **Code Changes**:
   - Update `src/index.ts` to use webhook callback instead of long polling
   - Replace `setInterval()` scheduler with Cloudflare cron triggers
   - Update environment variable loading

2. **Infrastructure**:
   - Create `wrangler.toml` configuration
   - Deploy with `wrangler deploy`
   - Set webhook URL via Telegram API
   - Configure Cloudflare cron triggers

3. **Benefits of Migration**:
   - Global edge deployment (low latency)
   - Auto-scaling
   - No server maintenance
   - Generous free tier

## Future Enhancements

### Phase 2 Features (Post-MVP)
- [ ] Favorite resources for availability notifications
- [ ] Group chat creation (auto-create Telegram group chat)
- [ ] Reputation system (reliability scores)
- [ ] Resource photos and detailed info
- [ ] Calendar view for scheduled groups
- [ ] User gaming profiles and preferences
- [ ] Private groups (invite-only)
- [ ] Recurring groups (weekly Mahjong nights)
- [ ] Game library (track which games are available)
- [ ] Equipment checkout (controllers, cards, etc.)
- [ ] Feedback/rating system for groups
- [ ] Multi-language support
- [ ] Web dashboard for admins
- [ ] Analytics and insights
- [ ] **Migration to Cloudflare Workers** for production deployment

### Scalability Considerations (Future)
- Implement caching for frequently accessed data (hostels, categories)
- Use Supabase realtime subscriptions for live updates
- Database connection pooling if needed
- Monitor and optimize slow queries
- Consider Redis for rate limiting in production

## File Structure

```
/LFG
├── src/
│   ├── index.ts                 # Main entry point (long polling)
│   ├── bot.ts                   # Grammy bot initialization
│   ├── scheduler.ts             # setInterval() based jobs
│   │
│   ├── handlers/
│   │   ├── start.ts            # /start command
│   │   ├── help.ts             # /help command
│   │   ├── lfg.ts              # /lfg group creation flow
│   │   ├── browse.ts           # /browse groups
│   │   ├── mygroups.ts         # /mygroups command
│   │   ├── resources.ts        # /resources command
│   │   ├── checkout.ts         # /checkout command
│   │   ├── admin.ts            # /admin panel
│   │   └── callbacks.ts        # Inline keyboard callbacks
│   │
│   ├── services/
│   │   ├── database.ts         # Supabase client & queries
│   │   ├── telegram.ts         # Telegram API helpers
│   │   ├── notifications.ts    # Notification logic
│   │   ├── groups.ts           # Group management logic
│   │   ├── resources.ts        # Resource management logic
│   │   └── users.ts            # User management logic
│   │
│   ├── types/
│   │   ├── database.ts         # Database types (from Supabase)
│   │   ├── telegram.ts         # Telegram-specific types
│   │   └── index.ts            # Common types
│   │
│   ├── utils/
│   │   ├── validation.ts       # Input validation
│   │   ├── formatting.ts       # Message formatting
│   │   ├── datetime.ts         # Date/time utilities
│   │   └── constants.ts        # Constants and config
│   │
│   └── middleware/
│       ├── auth.ts             # Authentication middleware
│       ├── ratelimit.ts        # Rate limiting
│       └── error.ts            # Error handling
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                # Seed data (categories, test hostel)
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
└── DESIGN.md (this file)
```

## Configuration Files

### package.json scripts
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

### .env.example
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# Environment
NODE_ENV=development

# Scheduler intervals (milliseconds)
NOTIFICATION_CHECK_INTERVAL=300000  # 5 minutes
CLEANUP_INTERVAL=900000             # 15 minutes
ARCHIVE_INTERVAL=3600000            # 1 hour
```

### package.json dependencies
```json
{
  "dependencies": {
    "grammy": "^1.19.2",
    "@supabase/supabase-js": "^2.38.4",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "vitest": "^1.0.4"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Command Reference

### User Commands
- `/start` - Register and request access
- `/help` - Show help message
- `/lfg` - Create a new group
- `/browse` - Browse available groups
- `/mygroups` - View your active groups
- `/resources` - View resource availability
- `/checkout` - Check out of resources

### Admin Commands
- `/admin` - Open admin panel
- `/approve <username>` - Quick approve a user
- `/reject <username>` - Quick reject a user
- `/stats` - Quick view statistics

## Default Settings

- **Max active groups per user**: 3 as creator
- **Max group memberships**: 5
- **Max resource check-ins**: 2
- **Default group expiry**: 6 hours from scheduled time
- **Default resource duration**: 6 hours
- **Group start notification**: 15 minutes before
- **Auto-checkout warning**: 30 minutes before
- **Archive groups after**: 7 days
- **Archive sessions after**: 30 days

## Emoji Reference

- 🎮 Gaming (general)
- 🀄 Mahjong
- 🎲 Board Games
- 🃏 Card Games
- 🎱 Pool/Billiards
- 🏓 Table Tennis
- 📺 TV/Screen
- ⏰ Time/Schedule
- 👥 Players/People
- 📍 Location
- ✅ Available/Approved
- 🔴 In Use/Busy
- ⏭️ Skip
- ▶️ Now/Playing
- 📅 Schedule/Calendar
- 🔔 Notification
- 👤 User
- 👨‍💼 Admin
- 📊 Statistics
- ⚙️ Settings
- 🔧 Tools/Manage
- ➕ Add/Create
- ❌ Remove/Cancel
- 🎉 Success/Celebration
- 📢 Announcement

---

**Document Version**: 1.1 (Local Development)  
**Last Updated**: 2026-03-19  
**Status**: Ready for Implementation (Local-First Approach)

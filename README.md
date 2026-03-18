# LFG Bot - Looking For Groups

A Telegram bot designed to help hostel guests find friends for gaming and manage shared resources across multiple locations.

## What is LFG?

LFG (Looking For Groups) creates a digital lobby system for hostel common areas, making it easy for travelers to:

- **Find gaming partners** for Mahjong, Nintendo Switch, PlayStation, board games, and more
- **Check resource availability** for TVs, game consoles, pool tables, and other shared equipment
- **Reserve resources** automatically when creating groups
- **Get notified** when groups fill up, games start, or resources become available

## Key Features

### For Guests

- **Easy Group Creation**: Use `/lfg` to create a gaming session in seconds
- **Browse Active Groups**: Find and join existing groups with `/browse`
- **Resource Management**: Check availability and reserve shared equipment
- **Smart Notifications**: Get alerted 15 minutes before your game starts
- **Multi-Hostel Support**: Works across multiple hostel locations
- **Approval System**: Admin approval ensures only current guests can access

### For Admins

- **User Management**: Approve or reject access requests
- **Resource Control**: Add, edit, or remove shared resources
- **Custom Categories**: Create hostel-specific game categories beyond the defaults
- **Group Oversight**: View all active groups and cancel if needed
- **Usage Statistics**: Track popular games, peak hours, and resource utilization
- **Public Channels**: Auto-post new groups to your hostel's announcement channel

## How It Works

### For Guests

1. **Join**: Send `/start` to the bot and select your hostel
2. **Wait for Approval**: Admins will approve your access request
3. **Create or Join Groups**: Use `/lfg` to create a gaming session or `/browse` to find existing ones
4. **Get Notified**: Receive reminders when it's time to play
5. **Check Resources**: View which gaming areas and equipment are available

### For Admins

1. **Approve Users**: Review and approve guests requesting access
2. **Manage Resources**: Add TVs, consoles, tables, and other shared equipment
3. **Customize Categories**: Create categories specific to your hostel (e.g., "Poker Night")
4. **Monitor Activity**: Track groups, resource usage, and statistics
5. **Maintain Order**: Cancel problematic groups or manage user access

## Tech Stack

- **Runtime**: Node.js (Local development)
- **Database**: Supabase (PostgreSQL - Cloud)
- **Bot Framework**: Grammy (modern Telegram Bot API library)
- **Language**: TypeScript
- **Deployment**: Local-first (Cloudflare Workers migration planned for production)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project (free tier is fine)
- Telegram bot token (from [@BotFather](https://t.me/botfather))
- Telegram channels for each hostel (for group announcements)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd LFG

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials (see Configuration below)
```

### Configuration

Create a `.env` file in the project root:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Supabase Configuration (get these from your Supabase project settings)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# Environment
NODE_ENV=development

# Scheduler intervals (milliseconds) - optional, defaults provided
NOTIFICATION_CHECK_INTERVAL=300000  # 5 minutes
CLEANUP_INTERVAL=900000             # 15 minutes
ARCHIVE_INTERVAL=3600000            # 1 hour
```

### Database Setup

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Wait for the project to be ready
   - Get your project URL and keys from Settings > API

2. **Run Database Migrations**:
   - Open Supabase SQL Editor
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and execute in SQL Editor

3. **Seed Initial Data**:
   - Copy contents of `supabase/seed.sql`
   - Paste and execute in SQL Editor
   - This creates predefined game categories and a test hostel

### Running the Bot

```bash
# Start the bot in development mode (with auto-reload)
npm run dev

# The bot will:
# - Connect to Telegram using long polling
# - Start background scheduler for notifications and cleanup
# - Log all activity to console
# - Auto-reload on file changes

# You can now interact with your bot on Telegram!
```

### Testing

Once the bot is running:

1. Open Telegram and find your bot (search for the username you set with @BotFather)
2. Send `/start` to begin registration
3. You'll need to manually approve yourself in the database first (or create an admin)
4. Test creating groups, managing resources, etc.

**Quick Admin Setup** (for first-time testing):
```sql
-- Run this in Supabase SQL Editor to make yourself an admin
-- Replace with your actual telegram_id (visible after /start)
INSERT INTO admins (user_id, hostel_id, is_super_admin)
SELECT u.id, u.hostel_id, true
FROM users u
WHERE u.telegram_id = YOUR_TELEGRAM_ID;
```

## Commands

### User Commands

- `/start` - Register and request access to a hostel
- `/help` - Display help message and available commands
- `/lfg` - Create a new gaming group
- `/browse` - Browse and join available groups
- `/join <group_id>` - Join a specific group by ID
- `/leave <group_id>` - Leave a group you've joined
- `/mygroups` - View all your active groups
- `/resources` - Check availability of shared resources
- `/checkout` - Check out of resources you're using

### Admin Commands

- `/admin` - Open the admin control panel
- `/approve <user_id>` - Quick approve a pending user
- `/reject <user_id>` - Quick reject a pending user
- `/cancel <group_id>` - Cancel an active group
- `/stats` - View quick statistics

## Default Game Categories

The bot comes with these predefined categories:

- 🀄 Mahjong
- 🎮 Nintendo Switch
- 🎮 PlayStation
- 🎮 Xbox
- 🎲 Board Games
- 🃏 Card Games
- 🎱 Pool/Billiards
- 🏓 Table Tennis
- ➕ Other

Admins can add custom categories specific to their hostel (e.g., "Poker Night", "Football", "Karaoke").

## Auto-Cleanup

The bot automatically manages group and resource lifecycles:

- **Groups expire** 6 hours after their scheduled start time
- **Resources auto-checkout** after their max duration (default 6 hours)
- **Notifications sent** 15 minutes before games start
- **Warnings sent** 30 minutes before auto-checkout
- **Old data archived** after 7-30 days

## Security & Privacy

- **Admin Approval**: Only approved users can create/join groups
- **Hostel Isolation**: Users only see data for their hostel
- **Row Level Security**: Database enforces access control
- **Secure Tokens**: Bot token and keys stored in .env (never committed)
- **No Personal Data**: Only stores Telegram username and first name

## Project Structure

```
LFG/
├── src/
│   ├── handlers/          # Command handlers (/start, /lfg, etc.)
│   ├── services/          # Business logic (database, notifications)
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Helper functions
│   ├── middleware/        # Auth, rate limiting, errors
│   ├── bot.ts            # Grammy bot setup
│   ├── index.ts          # Main entry point (long polling)
│   └── scheduler.ts      # Background jobs (setInterval)
├── supabase/
│   ├── migrations/       # Database migrations
│   └── seed.sql         # Seed data
├── tests/               # Unit and integration tests
├── .env.example        # Environment template
├── tsconfig.json       # TypeScript config
└── package.json
```

## Customization

### Adjusting Defaults

Edit `src/utils/constants.ts` to change:

- Max active groups per user (default: 3)
- Max group memberships (default: 5)
- Default group expiry (default: 6 hours)
- Resource max duration (default: 6 hours)
- Notification timing (default: 15 min before)

You can also override scheduler intervals in `.env`:

```env
NOTIFICATION_CHECK_INTERVAL=600000  # Change to 10 minutes
CLEANUP_INTERVAL=1800000            # Change to 30 minutes
```

### Adding Custom Features

The modular structure makes it easy to extend:

1. Add new commands in `src/handlers/`
2. Add business logic in `src/services/`
3. Update database schema in `supabase/migrations/`
4. Register command in `src/bot.ts`

## Troubleshooting

### Bot not responding
- Check the console for error messages
- Verify `TELEGRAM_BOT_TOKEN` is correct in `.env`
- Ensure the bot is running (`npm run dev`)
- Ensure the bot is running (`npm run dev`)
- Test by sending `/start` to your bot on Telegram

### Database errors
- Verify Supabase URL and keys in `.env`
- Check RLS policies are properly configured (see migrations)
- Ensure migrations and seed data have been run
- Check Supabase logs for query errors

### Notifications not sending
- Check console for scheduler logs
- Verify scheduler is running (should see "Scheduler started" message)
- Test by creating a group with a near-future time
- Check that users have correct Telegram IDs in database

### "User not approved" errors
- Manually approve users in database, or
- Make yourself an admin first, then use `/admin` to approve users

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## Roadmap

See [DESIGN.md](./DESIGN.md) for detailed workflows and future enhancements:

- [ ] Favorite resources for availability alerts
- [ ] Auto-create Telegram group chats for gaming sessions
- [ ] Reputation/reliability system
- [ ] Calendar view for scheduled groups
- [ ] User gaming profiles and preferences
- [ ] Private/invite-only groups
- [ ] Recurring groups (weekly Mahjong nights)
- [ ] Equipment checkout system (controllers, cards)
- [ ] Multi-language support
- [ ] Web dashboard for admins
- [ ] **Production deployment to Cloudflare Workers**

## Documentation

- **[DESIGN.md](./DESIGN.md)** - Comprehensive design document with workflows, database schema, and architecture
- **[API Reference](./docs/API.md)** - Database queries and Telegram API usage (coming soon)
- **[Admin Guide](./docs/ADMIN.md)** - Guide for hostel administrators (coming soon)

## Development Status

**Current Version**: Local Development (v1.0)

This bot is currently designed for local development and testing. The architecture uses:
- Long polling for Telegram updates (no webhook needed)
- Simple `setInterval()` for background jobs
- Node.js runtime

**Future**: Migration to Cloudflare Workers for production deployment is planned, which will provide:
- Global edge deployment
- Auto-scaling
- Webhook-based updates
- Generous free tier

The codebase is designed to make this migration straightforward with minimal changes.

## Support

For issues or questions:

- Check the [DESIGN.md](./DESIGN.md) for detailed information
- Review console logs for errors
- Check Supabase dashboard for database issues
- Ensure all environment variables are set correctly

## License

MIT License - feel free to use this for your hostel or organization!

## Acknowledgments

- Built with [Grammy](https://grammy.dev/) - Modern Telegram Bot Framework
- Database by [Supabase](https://supabase.com/) - Open source Firebase alternative
- Ready for [Cloudflare Workers](https://workers.cloudflare.com/) deployment

---

**Made for travelers who love gaming together** 🎮

*Start finding your gaming crew today!*

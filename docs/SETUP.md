# LFG Bot - Setup Guide

## Current Progress

✅ **Phase 1 & 2 Complete!**

The bot is now ready for initial testing with these features:
- User registration with hostel selection
- Admin approval workflow notifications
- Help command
- Database schema
- Core infrastructure

## Prerequisites

Before starting, ensure you have:

1. **Node.js 18+** installed
2. **A Telegram bot token** from [@BotFather](https://t.me/botfather)
3. **A Supabase account** (free tier works great)

## Step-by-Step Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the instructions
3. Choose a name and username for your bot
4. Copy the bot token (looks like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: LFG Bot (or whatever you prefer)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to you
4. Wait for the project to be created (~2 minutes)

### 3. Configure Supabase

Once your project is ready:

1. Go to **Settings** → **API** in the left sidebar
2. Copy these values (you'll need them for `.env`):
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) - Click "Reveal" to see it

### 4. Run Database Migrations

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `supabase/migrations/001_initial_schema.sql` from this project
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

### 5. Seed Initial Data

1. Still in **SQL Editor**, click **New Query** again
2. Open `supabase/seed.sql` from this project
3. Copy and paste the contents
4. Click **Run**
5. You should see a success message with the hostel ID

### 6. Configure Environment Variables

1. In the project root, create a `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:
   ```env
   # Your bot token from BotFather
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

   # From Supabase Settings → API
   SUPABASE_URL=https://abcdefgh.supabase.co
   SUPABASE_ANON_KEY=eyJ... (your anon key)
   SUPABASE_SERVICE_KEY=eyJ... (your service_role key)

   # Environment
   NODE_ENV=development

   # Scheduler Intervals (optional - defaults are fine)
   NOTIFICATION_CHECK_INTERVAL=300000
   CLEANUP_INTERVAL=900000
   ARCHIVE_INTERVAL=3600000
   ```

3. **Important**: Never commit `.env` to git (it's already in `.gitignore`)

### 7. Install Dependencies

```bash
npm install
```

### 8. Start the Bot

```bash
npm run dev
```

You should see:
```
🚀 Starting LFG Bot...

Testing database connection...
✅ Database connected successfully

Initializing bot...
Bot initialized successfully
Starting bot with long polling...
Bot is running! Press Ctrl+C to stop.

✅ Bot started as @YourBotName
==================================================
Ready to accept commands!
```

## Testing the Bot

### 1. Register as a User

1. Open Telegram and search for your bot (`@YourBotName`)
2. Send `/start`
3. Select "Test Hostel" from the buttons
4. You should see: "Thanks! Your access request has been sent to the admins..."

### 2. Make Yourself an Admin

Since there are no admins yet, you need to manually approve yourself:

1. In Supabase, go to **Table Editor**
2. Open the `users` table
3. Find your user (check the `telegram_id` matches yours)
4. Copy your user `id` (UUID)

5. Go to **SQL Editor** and run:
   ```sql
   -- Replace YOUR_USER_ID with the UUID you copied
   -- Replace YOUR_TELEGRAM_ID with your actual Telegram ID
   
   -- Approve yourself
   UPDATE users
   SET status = 'approved'
   WHERE telegram_id = YOUR_TELEGRAM_ID;
   
   -- Make yourself an admin
   INSERT INTO admins (user_id, hostel_id, is_super_admin)
   SELECT id, hostel_id, true
   FROM users
   WHERE telegram_id = YOUR_TELEGRAM_ID;
   ```

6. Now send `/help` to your bot - you should see admin commands!

### 3. Test Admin Workflow

1. Have someone else (or use another account) send `/start` to the bot
2. You (the admin) should receive a notification
3. You can use `/admin` to see the admin panel (coming in Phase 3)

## Finding Your Telegram ID

If you don't know your Telegram ID:

1. Send `/start` to your bot
2. Check the `users` table in Supabase
3. Your `telegram_id` is listed there
4. Or use [@userinfobot](https://t.me/userinfobot) - just send it a message

## Troubleshooting

### "Failed to connect to database"

- Check your `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`
- Make sure you're using the **service_role key**, not the anon key
- Verify the project URL is correct (no trailing slash)

### "Error starting bot"

- Verify `TELEGRAM_BOT_TOKEN` is correct
- Make sure the bot token is active (check with BotFather)
- Check if port 443 is blocked by firewall (unlikely for long polling)

### Bot doesn't respond

- Check the console for error messages
- Make sure the bot is running (`npm run dev`)
- Try sending `/start` again

### Database errors

- Ensure you ran the migration SQL successfully
- Check the Supabase logs in **Logs** → **Postgres Logs**
- Verify RLS policies are enabled (they should be after migration)

## Next Steps

Now that the basic bot is running, you're ready for:

- ✅ Phase 3: Admin approval system (partially done - notifications work!)
- 🔄 Phase 4: Resource management
- 🔄 Phase 5: Group creation and browsing
- 🔄 Phase 6: Group participation (join/leave via inline buttons)

The bot will continue to evolve with each phase!

## Development Tips

### Hot Reload

The bot uses `tsx watch` which auto-reloads on file changes. Just edit and save - no need to restart!

### Viewing Logs

All console.log output appears in your terminal. Errors are clearly marked with ❌.

### Database Inspection

Use Supabase's **Table Editor** to view and modify data directly.

### Testing with Multiple Users

- Use Telegram web/desktop in addition to mobile
- Create test accounts
- Use different browsers for Telegram Web

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | Your bot token from BotFather |
| `SUPABASE_URL` | ✅ Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ Yes | Public anon key (for future use) |
| `SUPABASE_SERVICE_KEY` | ✅ Yes | Service role key (full access) |
| `NODE_ENV` | No | `development` or `production` |
| `NOTIFICATION_CHECK_INTERVAL` | No | Milliseconds (default: 300000 = 5min) |
| `CLEANUP_INTERVAL` | No | Milliseconds (default: 900000 = 15min) |
| `ARCHIVE_INTERVAL` | No | Milliseconds (default: 3600000 = 1hr) |

## Need Help?

- Check the error messages in the console
- Review the database schema in `supabase/migrations/001_initial_schema.sql`
- Look at the implementation plan in `IMPLEMENTATION_PLAN.md`
- Check the design document in `DESIGN.md`

Happy testing! 🎮

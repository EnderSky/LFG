import dotenv from 'dotenv';
import { bot, initializeBot } from './bot.js';
import { testConnection } from './services/database.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the LFG bot
 */
async function main() {
  console.log('🚀 Starting LFG Bot...\n');

  // Test database connection
  console.log('Testing database connection...');
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Please check your Supabase configuration.');
    process.exit(1);
  }
  
  console.log('✅ Database connected successfully\n');

  // Initialize bot with handlers
  initializeBot();

  // Start bot with long polling
  console.log('Starting bot with long polling...');
  console.log('Bot is running! Press Ctrl+C to stop.\n');
  
  try {
    await bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Bot started as @${botInfo.username}`);
        console.log('='.repeat(50));
        console.log('Ready to accept commands!\n');
      },
    });
  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT, stopping bot...');
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, stopping bot...');
  bot.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  bot.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the bot
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

import dotenv from 'dotenv';
import { bot, initializeBot } from './bot.js';
import { testConnection } from './services/database.js';
import { startScheduler, stopScheduler } from './scheduler.js';
import { log } from './utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the LFG bot
 */
async function main() {
  log.info('🚀 Starting LFG Bot...', {
    nodeVersion: process.version,
    nodeEnv: process.env.NODE_ENV,
    platform: process.platform,
  });

  // Test database connection
  log.info('Testing database connection...');
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    log.error('Failed to connect to database', {
      supabaseUrl: process.env.SUPABASE_URL ? 'configured' : 'missing',
      supabaseKey: process.env.SUPABASE_ANON_KEY ? 'configured' : 'missing',
    });
    process.exit(1);
  }
  
  log.info('Database connected successfully');

  // Initialize bot with handlers
  initializeBot();

  // Start background scheduler
  startScheduler();

  // Start bot with long polling
  log.info('Starting bot with long polling...');
  
  try {
    await bot.start({
      onStart: (botInfo) => {
        log.info('Bot started successfully', {
          username: botInfo.username,
          firstName: botInfo.first_name,
          id: botInfo.id,
        });
        console.log('='.repeat(50));
        console.log('🤖 Ready to accept commands!\n');
      },
    });
  } catch (error) {
    log.error('Error starting bot', {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log.info('Received SIGINT, stopping bot...');
  stopScheduler();
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log.info('Received SIGTERM, stopping bot...');
  stopScheduler();
  bot.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception occurred', { error });
  stopScheduler();
  bot.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection occurred', {
    reason: reason instanceof Error ? reason : new Error(String(reason)),
    promise: promise.toString(),
  });
});

// Start the bot
main().catch((error) => {
  log.error('Fatal error during startup', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
  process.exit(1);
});

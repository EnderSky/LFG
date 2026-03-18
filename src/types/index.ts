import { Context } from 'grammy';
import { User } from './database.js';

// Extended context with user data
export interface BotContext extends Context {
    dbUser?: User;
    isAdmin?: boolean;
}

// Group creation state for conversation flow
export interface GroupCreationState {
    step: 'category' | 'title' | 'players' | 'timing' | 'resource' | 'done';
    categoryId?: string;
    title?: string;
    maxPlayers?: number;
    scheduledFor?: Date;
    resourceId?: string;
}

// Conversation state storage
export type ConversationState = Map<number, GroupCreationState>;

// Environment variables
export interface Env {
    TELEGRAM_BOT_TOKEN: string;
    SUPABASE_URL: string;
    SUPABASE_KEY: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_KEY: string;
    NODE_ENV: string;
    NOTIFICATION_CHECK_INTERVAL: string;
    CLEANUP_INTERVAL: string;
    ARCHIVE_INTERVAL: string;
}

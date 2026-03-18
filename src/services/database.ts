import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Validate environment variables

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required');
}

if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}

// Create Supabase client with service role key for admin operations
export const supabase: SupabaseClient = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        db: {
            schema: 'public',
        },
    }
);

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
    try {
        // Simple query that should work with service role
        const { error } = await supabase
            .from('hostels')
            .select('id')
            .limit(1);

        if (error) {
            console.error('Database connection test failed:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Database connection error:', err);
        return false;
    }
}

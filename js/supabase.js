// Supabase Client Initialization and API Interface

const getEnv = (key, fallback) => {
    // Attempt to load from various environments (process.env, import.meta.env, window.env)
    if (typeof window !== 'undefined' && window.env && window.env[key]) {
        return window.env[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key];
    }
    return fallback;
};

// Retrieve values with fallbacks matching user instructions
const rawSupabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://kzzhqshrkkfdadggshdw.supabase.co');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_KmjQ31Ad1HIR98R5Bvw7TQ_mohBBbO7');

// Normalize url by stripping trailing /rest/v1/ if present
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '');

if (typeof supabase === 'undefined' && typeof netlify === 'undefined' && typeof window.supabaseJS === 'undefined') {
    console.error('Supabase library not loaded. Ensure script is included in HTML.');
}

// Instantiate the client globally
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

if (typeof window.logEvent === 'function') window.logEvent('info', 'Supabase client initialized');


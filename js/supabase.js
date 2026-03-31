
// Supabase Client Initialization
const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';

// Initialize Supabase Client
// Ensure window.supabase is available from the CDN script
if (!window.supabase) {
    console.error('Supabase library not loaded!');
}

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.supabaseClient = client;
export default client;

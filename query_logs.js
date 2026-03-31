const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    console.log('--- Kiwe Vehicle Logs (Last 10) ---');
    const { data, error } = await supabase
        .from('kiwe_vehicle_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error('Error:', error);
    } else if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}
check();


const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
    const { data, error } = await supabase.from('kiwe_hazard').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No data found in kiwe_hazard');
    }
}

checkSchema();

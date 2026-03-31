import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
    console.log("Fetching kiwe_hazard schema...");
    const { data, error } = await supabase.from('kiwe_hazard').select('*').limit(1);
    if (error) {
        console.error("Error fetching table:", error.message);
        return;
    }
    if (data && data.length > 0) {
        console.log("Table columns found:", Object.keys(data[0]).length);
        console.log(JSON.stringify(Object.keys(data[0]), null, 2));
    } else {
        console.log("Table is empty (or no rows found).");
    }
}

checkSchema();

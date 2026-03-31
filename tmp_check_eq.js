import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://jztrnwchgxymknjvsbkl.supabase.co', 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33');

async function check() {
    const { data, error } = await supabase.from('kiwe_equipment').select('equipment_type').distinct();
    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data));
    }
}
check();

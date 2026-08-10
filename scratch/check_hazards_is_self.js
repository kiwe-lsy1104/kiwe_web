const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('kiwe_hazard')
        .select('*');
    
    if (error) {
        console.error(error);
        return;
    }

    console.log('Total hazards count:', data.length);
    const targetNames = ['브롬화수소', '요오드'];
    const found = data.filter(h => targetNames.some(t => h.common_name && h.common_name.includes(t)));
    console.log('Found hazards for target names:');
    found.forEach(h => {
        console.log({
            hazard_id: h.hazard_id,
            common_name: h.common_name,
            legal_name: h.legal_name,
            is_self: h.is_self,
            instrument_name: h.instrument_name,
            sampling_media: h.sampling_media
        });
    });

    // Also check if any hazard common_name contains '브롬'
    const brom = data.filter(h => h.common_name && h.common_name.includes('브롬'));
    console.log('Brom hazards:', brom.map(h => ({ name: h.common_name, is_self: h.is_self })));
}

check();

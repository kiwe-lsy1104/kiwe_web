const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
    // 2026_1 컬럼
    const { data: d1, error: e1 } = await supabase.from('kiwe_sampling_2026_1').select('*').limit(1);
    if (e1) { console.error('2026_1 오류:', e1.message); }
    else if (d1 && d1.length > 0) console.log('kiwe_sampling_2026_1 컬럼:', Object.keys(d1[0]).join(', '));
    else console.log('kiwe_sampling_2026_1: 데이터 없음 (빈 행으로 조회 시도)');

    // 2026_2 컬럼
    const { data: d2, error: e2 } = await supabase.from('kiwe_sampling_2026_2').select('*').limit(1);
    if (e2) { console.error('2026_2 오류:', e2.message); }
    else if (d2 && d2.length > 0) console.log('kiwe_sampling_2026_2 컬럼:', Object.keys(d2[0]).join(', '));
    else console.log('kiwe_sampling_2026_2: 데이터 없음 (컬럼 조회 불가)');

    // 비교
    const cols1 = d1 && d1.length > 0 ? Object.keys(d1[0]) : [];
    const cols2 = d2 && d2.length > 0 ? Object.keys(d2[0]) : [];

    if (cols1.length > 0 && cols2.length > 0) {
        const missing = cols1.filter(c => !cols2.includes(c));
        const extra = cols2.filter(c => !cols1.includes(c));
        console.log('\n[2026_1에 있고 2026_2에 없는 컬럼]:', missing.join(', ') || '없음');
        console.log('[2026_2에만 있는 컬럼]:', extra.join(', ') || '없음');
    }
}

checkSchema().catch(console.error);

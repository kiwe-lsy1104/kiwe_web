const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectData() {
    // 1. kiwe_sampling_2026_1 전체 카운트
    const { count, error: countErr } = await supabase
        .from('kiwe_sampling_2026_1')
        .select('*', { count: 'exact', head: true })
        .gte('m_date', '2026-01-01')
        .lte('m_date', '2026-06-30');

    console.log('2026년 상반기 시료 총 개수:', count, countErr);

    // 2. kiwe_hazard에서 중량/오일 분석 관련 물질 확인
    const { data: hazards } = await supabase.from('kiwe_hazard').select('common_name, instrument_name, hazard_category');
    console.log('kiwe_hazard 물질 개수:', hazards ? hazards.length : 0);

    const weightHazards = hazards ? hazards.filter(h =>
        (h.instrument_name && h.instrument_name.includes('중량')) ||
        (h.hazard_category && h.hazard_category.includes('중량'))
    ) : [];
    console.log('중량 관련 kiwe_hazard:', weightHazards.map(h => `${h.common_name} (${h.instrument_name}/${h.hazard_category})`));

    const oilHazards = hazards ? hazards.filter(h =>
        (h.common_name && h.common_name.includes('금속가공유')) ||
        (h.instrument_name && h.instrument_name.includes('오일'))
    ) : [];
    console.log('오일 관련 kiwe_hazard:', oilHazards.map(h => `${h.common_name} (${h.instrument_name}/${h.hazard_category})`));

    // 3. sample_id sample 패턴 확인 (D로 시작하는 시료 개수)
    const { count: dCount } = await supabase
        .from('kiwe_sampling_2026_1')
        .select('*', { count: 'exact', head: true })
        .gte('m_date', '2026-01-01')
        .lte('m_date', '2026-06-30')
        .like('sample_id', 'D%');
    console.log("sample_id가 'D'로 시작하는 시료 개수:", dCount);

    // 4. weight_data 및 weight_blank_data 에 들어있는 2026년 시료 확인
    const { data: wData } = await supabase.from('weight_data').select('sample_id, common_name, hazard_category').limit(10);
    console.log('weight_data 샘플:', wData);

    const { count: wCount } = await supabase.from('weight_data').select('*', { count: 'exact', head: true });
    const { count: wbCount } = await supabase.from('weight_blank_data').select('*', { count: 'exact', head: true });
    console.log('weight_data 총 행 수:', wCount, 'weight_blank_data 총 행 수:', wbCount);
}

inspectData().catch(console.error);

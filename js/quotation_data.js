// quotation_data.js - 견적서 단가/상수 데이터

export const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';

export const PROVIDER = {
    name: '한국작업환경평가원㈜',
    biz_no: '856-86-02123',
    ceo: '이승용', // '대표이사 이승용'에서 '이승용'으로 수정 (표에서 '대표자'와 나란히 나오므로)
    address: '경기도 안산시 단원구 산단로 325, 리드스마트스퀘어 1261, 1262호',
    tel: '031-365-3515',
    fax: '031-365-3903',
    biz_type: '전문, 과학 및 기술서비스업',
    biz_item: '물질 성분 검사 및 분석업', // '서분' -> '성분'
    stamp_url: './images/stemp.png' // 직인 이미지 파일 경로
};

// 기본값 (fallback) - DB에 데이터가 없을 때 사용
export const DEFAULT_MANAGEMENT_COSTS = [
    { item_name: '1~49인', unit_price: 714000 },
    { item_name: '50~99인', unit_price: 1112000 },
    { item_name: '100~299인', unit_price: 1752000 },
    { item_name: '300~499인', unit_price: 2577000 },
    { item_name: '500~999인', unit_price: 3070000 },
    { item_name: '1000~1999인', unit_price: 3326000 },
    { item_name: '2000~2999인', unit_price: 3913000 },
    { item_name: '3000인 이상', unit_price: 4503000 },
];
export const MANAGEMENT_COSTS = DEFAULT_MANAGEMENT_COSTS.map(m => ({ range: m.item_name, cost: m.unit_price }));

export const DEFAULT_HAZARD_PRICES = [
    { item_name: '중량분석법(분진)', unit_price: 57000 },
    { item_name: '중량분석법(호흡성)', unit_price: 57600 },
    { item_name: '중량분석법(흡입성)', unit_price: 57900 },
    { item_name: 'ICP법', unit_price: 176200 },
    { item_name: 'GC법(다성분)', unit_price: 136500 },
    { item_name: 'GC법(단성분)', unit_price: 110000 },
    { item_name: 'HPLC법(다성분)', unit_price: 125600 },
    { item_name: 'HPLC법(단성분)', unit_price: 110300 },
    { item_name: 'IC법(다성분)', unit_price: 160300 },
    { item_name: 'IC법(단성분)', unit_price: 127500 },
    { item_name: '여과-IC법(다성분)', unit_price: 151100 },
    { item_name: '여과-IC법(단성분)', unit_price: 149500 },
    { item_name: '흡광광도법', unit_price: 90300 },
    { item_name: '여과-흡광광도법', unit_price: 100100 },
    { item_name: 'FTIR법', unit_price: 111600 },
    { item_name: '추출법', unit_price: 93000 },
    { item_name: 'GC/MS(정성)', unit_price: 438000 },
    { item_name: '소음노출량계', unit_price: 33800 },
    { item_name: 'WBGT측정기', unit_price: 37100 },
    { item_name: '전기화학식센서법', unit_price: 25000 },
    { item_name: '조도계', unit_price: 8500 },
    { item_name: '비분산적외선법(Co)', unit_price: 70000 },
    { item_name: '비분산적외선법(Co2)', unit_price: 69800 },
];
export const HAZARD_PRICES = DEFAULT_HAZARD_PRICES.map(h => ({ method: h.item_name, unit_price: h.unit_price }));

export const DEFAULT_ENGINEERING_FEES = [
    { item_name: '기술사', unit_price: 447658 },
    { item_name: '특급기술자', unit_price: 357676 },
    { item_name: '고급기술자', unit_price: 301863 },
    { item_name: '중급기술자', unit_price: 261545 },
    { item_name: '초급기술자', unit_price: 229278 },
];
export const ENGINEERING_FEES = DEFAULT_ENGINEERING_FEES.map(f => ({ grade: f.item_name, daily: f.unit_price }));

export const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
export const unf = (s) => Number((s || '').toString().replace(/,/g, '')) || 0;

export function genQuoteNo(year, seq) {
    return `KIWE-${year}-${String(seq).padStart(3, '0')}`;
}

export const DEFAULT_NOTES = {
    '측정_일반': '‡ 상기 작업환경측정 견적 산출은 기획재정부 계약예규 [제653호, 2023.6.16.)] 예정가격작성기준에 따른 표준단가표를 적용하여 작성되었습니다.\n‡ 야간 및 휴일근로 발생 시 근로기준법 제56조에 의거 가산할증이 적용됩니다.',
    '측정_지원': '‡ 최대 40만원 또는 합계의 80%, 최근 3년간 측정결과가 없으면 최대 100만원 또는 합계의 80%까지 비용지원\n‡ 상기 작업환경측정 견적 산출은 2026년 건강디딤돌사업(작업환경측정 비용지원) 수가를 적용하여 작성되었습니다.\n‡ 야간 및 휴일근로 발생 시 근로기준법 제56조에 의거 가산할증이 적용됩니다.',
    '용역': '‡ 세부내역 수수료는 산업통산자원부고시-엔지니어링사업 대가의 기준 제2장 실비정액가산방식을 적용함.\n‡ 야간 및 휴일근로 발생 시 근로기준법 제56조에 의거 가산할증이 적용됩니다.',
    '장비대여': '‡ 상기 견적은 장비 대여에 대한 단가표를 적용하여 작성되었습니다.\n‡ 장비 파손 및 분실 시 배상 책임이 발생할 수 있습니다.'
};

export const getDefaultNotes = (quoteType, supportType) => {
    if (quoteType === '용역') return DEFAULT_NOTES['용역'];
    if (quoteType === '장비대여') return DEFAULT_NOTES['장비대여'];
    if (supportType !== '일반') return DEFAULT_NOTES['측정_지원'];
    return DEFAULT_NOTES['측정_일반'];
};

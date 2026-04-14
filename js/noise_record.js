import React, { useState, useEffect, useMemo, useCallback, useRef } from 'https://esm.sh/react@18.2.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const e = React.createElement;

// ─── Supabase 공통 설정 (standalone 사용 시 fallback) ───
const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';
const _defaultSupabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================================================
// 상수 및 설정
// =====================================================
const NOISE_STANDARD = 90; // 노출기준 dB(A)
const WARN_LEVEL = 85;     // 경고 레벨

// 동적컬럼 설정 키
const DB_SETTINGS_KEY = 'noise_column_config';
const STORAGE_KEY_ORDER = 'KIWE_NOISE_COL_ORDER_V1';

const ALL_COLUMNS = [
    { key: 'm_date', label: '측정일자', width: 100, editable: false, inputType: 'date' },
    { key: 'cal_date', label: '소음보정일', width: 100, editable: true, inputType: 'date' },
    { key: 'com_name', label: '사업장명', width: 150, editable: false, inputType: 'text' },
    { key: 'work_process', label: '공정명', width: 130, editable: false, inputType: 'text' },
    { key: 'worker_name', label: '작업자명', width: 90, editable: false, inputType: 'text' },
    { key: 'noise_no', label: '소음기번호', width: 90, editable: false, inputType: 'text' },
    { key: 'calibrator_no', label: '보정기번호', width: 90, editable: true, inputType: 'select', options: ['', '1', '2', '3', '4'] },
    { key: 'start_time', label: '시작시간', width: 90, editable: false, inputType: 'text' },
    { key: 'end_time', label: '종료시간', width: 90, editable: false, inputType: 'text' },
    { key: 'lunch_time', label: '점심(분)', width: 70, editable: false, inputType: 'number' },
    { key: 'measure_time', label: '측정시간(분)', width: 90, editable: false, inputType: 'number' },
    { key: 'work_hour', label: '실근로시간(h)', width: 90, editable: true, inputType: 'number' },
    { key: 'exposure_limit', label: '노출기준(dB(A))', width: 120, editable: false, inputType: 'calc', _computed: true },
    { key: 'measured_by', label: '측정자', width: 80, editable: false, inputType: 'text' },
    { key: 'temp', label: '온도(℃)', width: 80, editable: false, inputType: 'text' },
    { key: 'humidity', label: '습도(%)', width: 80, editable: false, inputType: 'text' },
    { key: 'noise_result', label: '소음결과 dB(A)', width: 120, editable: true, inputType: 'number' },
    { key: 'memo', label: '비고', width: 150, editable: false, inputType: 'text' },
];

// 노출기준 계산: 16.61 * log10(100 / (12.5 * 실근로시간)) + 90
const calcExposureLimit = (workHour) => {
    const h = parseFloat(workHour);
    if (isNaN(h) || h <= 0) return null;
    return 16.61 * Math.log10(100 / (12.5 * h)) + 90;
};

// 노출기준 표기: trailing zero 제거, 정수면 소수점 없이, 최대 4자리
const formatExposureLimit = (val) => {
    if (val === null || val === undefined) return '-';
    return String(parseFloat(val.toFixed(4)));
};

const DEFAULT_COLS = ALL_COLUMNS.map(c => c.key);

// =====================================================
// 유틸 함수
// =====================================================

// 측정일 기준 직전 평일 계산 (소음보정일)
const getPrevWeekday = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const dow = d.getDay(); // 0=일, 1=월, ..., 6=토
        let sub = 1;
        if (dow === 1) sub = 3; // 월요일 → 3일 전(금)
        else if (dow === 0) sub = 2; // 일요일 → 2일 전(금)
        d.setDate(d.getDate() - sub);
        return d.toISOString().slice(0, 10);
    } catch { return ''; }
};

const calcMeasureTime = (start, end, lunch) => {
    if (!start || !end) return null;
    try {
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 1440;
        return Math.max(0, diff - (parseInt(lunch) || 0));
    } catch { return null; }
};

const formatTimeValue = (val) => {
    if (!val) return '';
    // 숫자만 추출
    let digits = val.replace(/\D/g, '');

    // 3자리(예: 900)면 앞에 0을 붙여 4자리(0900)로 만듦
    if (digits.length === 3) {
        digits = '0' + digits;
    }

    // 4자리(예: 0900, 1230)인 경우 HH:mm 형식으로 변환
    if (digits.length === 4) {
        return digits.substring(0, 2) + ':' + digits.substring(2, 4);
    }

    // 이미 HH:mm:ss 형태인 경우 (DB에서 불러온 경우 등)
    if (typeof val === 'string' && val.includes(':')) {
        const parts = val.split(':');
        if (parts.length >= 2) {
            const h = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            return `${h}:${m}`;
        }
    }

    return val;
};

// exposureLimit: 개별 노출기준(calcExposureLimit 결과), 없으면 NOISE_STANDARD(90) 사용
const getNoiseRowClass = (val, exposureLimit) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '';
    const lim = (exposureLimit !== null && exposureLimit !== undefined) ? exposureLimit : NOISE_STANDARD;
    if (n > lim) return 'bg-orange-100';
    if (n >= WARN_LEVEL) return 'bg-yellow-50';
    return '';
};

const getNoiseResultClass = (val, exposureLimit) => {
    const n = parseFloat(val);
    if (isNaN(n)) return 'text-slate-700';
    const lim = (exposureLimit !== null && exposureLimit !== undefined) ? exposureLimit : NOISE_STANDARD;
    if (n > lim) return 'text-red-700 font-bold';
    if (n >= WARN_LEVEL) return 'text-amber-700 font-bold';
    return 'text-slate-700';
};

const getSamplingTableName = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return `kiwe_sampling_${d.getFullYear()}_${d.getMonth() + 1 <= 6 ? 1 : 2}`;
};

const todayStr = new Date().toISOString().slice(0, 10);
const defaultStartDate = getPrevWeekday(todayStr) || todayStr; // 어제(평일)
const defaultEndDate = todayStr; // 오늘

const now = new Date();
const thisYear = now.getFullYear();
const thisMonth = now.getMonth() + 1;

// =====================================================
// 컬럼 너비 리사이즈 훅
// =====================================================
function useColumnWidths(storageKey) {
    const [widths, setWidths] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch { }
        const d = {};
        ALL_COLUMNS.forEach(c => { d[c.key] = c.width; });
        return d;
    });

    useEffect(() => {
        try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch { }
    }, [widths]);

    return [widths, setWidths];
}

// =====================================================
// 통계 모달 컴포넌트
// =====================================================
function StatsModal({ isOpen, onClose, data }) {
    if (!isOpen) return null;

    const allRecords = data.filter(r => r.noise_result !== null && r.noise_result !== '');
    const warn85 = allRecords.filter(r => parseFloat(r.noise_result) >= 85);
    // 노출기준 초과: 각 행의 실근로시간 기반 개별 노출기준과 비교
    const overLimit = allRecords.filter(r => {
        const n = parseFloat(r.noise_result);
        const lim = calcExposureLimit(r.work_hour);
        return !isNaN(n) && lim !== null && n > lim;
    });
    const results = allRecords.map(r => parseFloat(r.noise_result)).filter(n => !isNaN(n));
    const avg = results.length ? (results.reduce((s, n) => s + n, 0) / results.length).toFixed(1) : '-';
    const max = results.length ? Math.max(...results).toFixed(1) : '-';
    const min = results.length ? Math.min(...results).toFixed(1) : '-';

    // 사업장별 집계
    const byCompany = {};
    allRecords.forEach(r => {
        if (!byCompany[r.com_name]) byCompany[r.com_name] = { total: 0, warn85: 0, overLimit: 0 };
        byCompany[r.com_name].total++;
        const n = parseFloat(r.noise_result);
        const lim = calcExposureLimit(r.work_hour);
        if (n >= 85) byCompany[r.com_name].warn85++;
        if (!isNaN(n) && lim !== null && n > lim) byCompany[r.com_name].overLimit++;
    });
    const companyStats = Object.entries(byCompany).sort((a, b) => b[1].total - a[1].total);

    // 연도/반기별 집계
    const byHalf = {};
    allRecords.forEach(r => {
        if (!r.m_date) return;
        const d = new Date(r.m_date);
        const year = d.getFullYear();
        const half = d.getMonth() + 1 <= 6 ? '상반기' : '하반기';
        const key = `${year} ${half}`;
        if (!byHalf[key]) byHalf[key] = { total: 0, warn85: 0, overLimit: 0 };
        byHalf[key].total++;
        const n = parseFloat(r.noise_result);
        const lim = calcExposureLimit(r.work_hour);
        if (n >= 85) byHalf[key].warn85++;
        if (!isNaN(n) && lim !== null && n > lim) byHalf[key].overLimit++;
    });
    const halfStats = Object.entries(byHalf).sort((a, b) => b[0].localeCompare(a[0]));

    return e('div', { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm' },
        e('div', { className: 'bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden' },
            e('div', { className: 'p-6 border-b flex items-center justify-between bg-slate-50' },
                e('h2', { className: 'text-xl font-black text-slate-800' }, '📊 소음 통계'),
                e('button', { onClick: onClose, className: 'p-2 hover:bg-slate-200 rounded-lg text-slate-500' }, '✕')
            ),
            e('div', { className: 'flex-1 overflow-y-auto p-6 space-y-6' },
                // 요약 카드
                e('div', { className: 'grid grid-cols-2 md:grid-cols-5 gap-3' },
                    [
                        { label: '총 측정 건수', value: `${allRecords.length}건`, color: 'bg-slate-50 border-slate-200' },
                        { label: '85dB 이상', value: `${warn85.length}건`, sub: `${allRecords.length ? (warn85.length / allRecords.length * 100).toFixed(0) : 0}%`, color: 'bg-yellow-50 border-yellow-200' },
                        { label: '노출기준 초과', value: `${overLimit.length}건`, sub: `${allRecords.length ? (overLimit.length / allRecords.length * 100).toFixed(0) : 0}%`, color: 'bg-orange-50 border-orange-200' },
                        { label: '평균/최고', value: `${avg} / ${max}`, sub: 'dB(A)', color: 'bg-sky-50 border-sky-200' },
                        { label: '최저값', value: `${min}`, sub: 'dB(A)', color: 'bg-emerald-50 border-emerald-200' },
                    ].map((s, i) => e('div', { key: i, className: `p-4 rounded-xl border ${s.color} text-center` },
                        e('p', { className: 'text-xs font-bold text-slate-500 mb-1' }, s.label),
                        e('p', { className: 'text-lg font-black text-slate-800' }, s.value),
                        s.sub && e('p', { className: 'text-xs text-slate-400' }, s.sub)
                    ))
                ),
                // 사업장별
                e('div', null,
                    e('h3', { className: 'font-black text-slate-700 mb-3 flex items-center gap-2' }, '🏭 사업장별 현황'),
                    e('div', { className: 'overflow-x-auto rounded-xl border border-slate-200' },
                        e('table', { className: 'w-full text-sm border-collapse' },
                            e('thead', { className: 'bg-slate-50' },
                                e('tr', null,
                                    ['사업장명', '총 건수', '85dB 이상', '비율', '노출기준 초과', '비율'].map(h =>
                                        e('th', { key: h, className: 'px-4 py-2 text-xs font-bold text-slate-500 text-center border-b border-slate-200' }, h)
                                    )
                                )
                            ),
                            e('tbody', null,
                                companyStats.map(([com, s]) =>
                                    e('tr', { key: com, className: 'hover:bg-slate-50 border-b border-slate-100' },
                                        e('td', { className: 'px-4 py-2 font-bold text-slate-800' }, com),
                                        e('td', { className: 'px-4 py-2 text-center text-slate-600' }, s.total),
                                        e('td', { className: 'px-4 py-2 text-center text-amber-700 font-bold' }, s.warn85),
                                        e('td', { className: 'px-4 py-2 text-center text-slate-500' }, `${(s.warn85 / s.total * 100).toFixed(0)}%`),
                                        e('td', { className: 'px-4 py-2 text-center text-red-700 font-bold' }, s.overLimit),
                                        e('td', { className: 'px-4 py-2 text-center text-slate-500' }, `${(s.overLimit / s.total * 100).toFixed(0)}%`)
                                    )
                                )
                            )
                        )
                    )
                ),
                // 연도/반기별
                e('div', null,
                    e('h3', { className: 'font-black text-slate-700 mb-3 flex items-center gap-2' }, '📅 연도/반기별 현황'),
                    e('div', { className: 'overflow-x-auto rounded-xl border border-slate-200' },
                        e('table', { className: 'w-full text-sm border-collapse' },
                            e('thead', { className: 'bg-slate-50' },
                                e('tr', null,
                                    ['기간', '총 건수', '85dB 이상', '비율', '노출기준 초과', '비율'].map(h =>
                                        e('th', { key: h, className: 'px-4 py-2 text-xs font-bold text-slate-500 text-center border-b border-slate-200' }, h)
                                    )
                                )
                            ),
                            e('tbody', null,
                                halfStats.map(([period, s]) =>
                                    e('tr', { key: period, className: 'hover:bg-slate-50 border-b border-slate-100' },
                                        e('td', { className: 'px-4 py-2 font-bold text-slate-800' }, period),
                                        e('td', { className: 'px-4 py-2 text-center text-slate-600' }, s.total),
                                        e('td', { className: 'px-4 py-2 text-center text-amber-700 font-bold' }, s.warn85),
                                        e('td', { className: 'px-4 py-2 text-center text-slate-500' }, `${(s.warn85 / s.total * 100).toFixed(0)}%`),
                                        e('td', { className: 'px-4 py-2 text-center text-red-700 font-bold' }, s.overLimit),
                                        e('td', { className: 'px-4 py-2 text-center text-slate-500' }, `${(s.overLimit / s.total * 100).toFixed(0)}%`)
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    );
}

// =====================================================
// 인쇄 미리보기 모달
// =====================================================
function PrintPreviewModal({ isOpen, onClose, data, printYear, printHalf, comNameFilter }) {
    if (!isOpen) return null;

    const halfLabel = printHalf === '1' ? '상반기 (1월 ~ 6월)' : '하반기 (7월 ~ 12월)';
    const startM = printHalf === '1' ? 1 : 7;
    const endM = printHalf === '1' ? 6 : 12;

    const printData = data.filter(r => {
        if (!r.m_date) return false;
        const d = new Date(r.m_date);
        return d.getFullYear() === parseInt(printYear) && d.getMonth() + 1 >= startM && d.getMonth() + 1 <= endM;
    });

    const handlePrint = () => window.print();

    return e('div', { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print' },
        e('div', { className: 'bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden' },
            e('div', { className: 'p-4 border-b flex items-center justify-between bg-slate-50' },
                e('div', null,
                    e('h2', { className: 'text-lg font-black text-slate-800' }, '🖨 인쇄 미리보기'),
                    e('p', { className: 'text-sm text-slate-500' }, `${printYear}년 ${halfLabel} | ${comNameFilter || '전체 사업장'} | ${printData.length}건`)
                ),
                e('div', { className: 'flex gap-2' },
                    e('button', {
                        onClick: handlePrint,
                        className: 'px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-2'
                    }, '🖨 PDF / 인쇄'),
                    e('button', { onClick: onClose, className: 'px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200' }, '닫기')
                )
            ),
            e('div', { className: 'flex-1 overflow-auto p-6 bg-white', id: 'print-area' },
                e('div', { className: 'print-page' },
                    e('div', { className: 'text-center mb-6' },
                        e('h1', { className: 'text-2xl font-black text-slate-800' }, '소음측정 및 보정대장'),
                        e('p', { className: 'text-sm text-slate-500 mt-1' }, `${printYear}년 ${halfLabel}${comNameFilter ? ` | ${comNameFilter}` : ''}`)
                    ),
                    e('table', { className: 'w-full text-xs border-collapse print-table' },
                        e('thead', null,
                            e('tr', { className: 'bg-slate-100' },
                                ['No', '측정일자', '소음보정일', '사업장명', '공정명', '작업자명', '소음기번호', '시작', '종료', '점심(분)', '측정시간(분)', '측정자', '온도', '습도', '소음결과 dB(A)', '비고'].map(h =>
                                    e('th', { key: h, className: 'border border-slate-300 px-2 py-1.5 font-bold text-slate-700 text-center' }, h)
                                )
                            )
                        ),
                        e('tbody', null,
                            printData.length === 0
                                ? e('tr', null, e('td', { colSpan: 15, className: 'text-center py-8 text-slate-400 border' }, '해당 기간 데이터가 없습니다.'))
                                : printData.map((row, idx) => {
                                    const n = parseFloat(row.noise_result);
                                    const rowBg = n > 90 ? '#FED7AA' : n >= 85 ? '#FEF9C3' : 'white';
                                    const txtCol = n > 90 ? '#B91C1C' : 'inherit';
                                    return e('tr', { key: row.id || idx, style: { backgroundColor: rowBg, color: txtCol } },
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, idx + 1),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.m_date || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.cal_date || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1' }, row.com_name || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1' }, row.work_process || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.worker_name || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.noise_no || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.start_time || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.end_time || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.lunch_time ?? ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.measure_time ?? ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.measured_by || ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.temp ?? ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center' }, row.humidity ?? ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1 text-center font-bold', style: { color: txtCol } }, row.noise_result ?? ''),
                                        e('td', { className: 'border border-slate-200 px-2 py-1' }, row.memo || '')
                                    );
                                })
                        )
                    ),
                    e('div', { className: 'mt-4 text-xs text-slate-400 text-right' },
                        `출력일시: ${new Date().toLocaleString('ko-KR')} | 노출기준: 90 dB(A) | 🟡 85dB 이상 주의 | 🟠 90dB 초과 기준초과`
                    )
                )
            )
        )
    );
}

// =====================================================
// 메인 NoiseRecord 컴포넌트
// =====================================================
export function NoiseRecord({ user, supabase: supabaseProp }) {
    const sb = supabaseProp || _defaultSupabase;
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // 필터 상태
    const [startDate, setStartDate] = useState(defaultStartDate);
    const [endDate, setEndDate] = useState(defaultEndDate);
    const [comNameFilter, setComNameFilter] = useState('');
    const [noiseFilter, setNoiseFilter] = useState('all'); // 'all' | 'warn85' | 'over90'

    // 편집 상태: _rowKey = m_date_noise_no 기반
    const [editRows, setEditRows] = useState({}); // { _rowKey: { ...changedFields } }

    const [showStats, setShowStats] = useState(false);
    const [showPrint, setShowPrint] = useState(false);
    const [printYear, setPrintYear] = useState(String(thisYear));
    const [printHalf, setPrintHalf] = useState(thisMonth <= 6 ? '1' : '2');

    // 정렬 상태: 'desc' = 최신순(기본), 'asc' = 과거순
    const [sortOrder, setSortOrder] = useState('desc');

    // 컬럼 너비 (localStorage)
    const [colWidths, setColWidths] = useColumnWidths('KIWE_NOISE_COL_WIDTHS_V1');
    const resizingRef = useRef(null);

    // 동적컬럼 순서 상태 (키 배열)
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_ORDER);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch { }
        return DEFAULT_COLS;
    });
    const [showColSettings, setShowColSettings] = useState(false);
    const [colSettingsSaveStatus, setColSettingsSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'

    // columnOrder를 localStorage에 동기화
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(columnOrder)); } catch { }
    }, [columnOrder]);

    // DB에서 공유 컬럼 설정 로드 (마운트 시 1회)
    useEffect(() => {
        const loadColConfig = async () => {
            try {
                const { data, error } = await sb
                    .from('kiwe_app_settings')
                    .select('value')
                    .eq('key', DB_SETTINGS_KEY)
                    .single();
                if (error || !data) return;
                const parsed = data.value;
                if (parsed && Array.isArray(parsed.order) && parsed.order.length > 0) {
                    setColumnOrder(parsed.order);
                    if (parsed.widths && typeof parsed.widths === 'object') {
                        setColWidths(prev => ({ ...prev, ...parsed.widths }));
                    }
                    localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(parsed.order));
                }
            } catch (err) {
                console.warn('노이즈 컬럼 설정 DB 로드 실패:', err);
            }
        };
        loadColConfig();
    }, []);

    // DB에 공유 컬럼 설정 저장
    const saveColConfigToDB = async () => {
        setColSettingsSaveStatus('saving');
        try {
            const config = { order: columnOrder, widths: colWidths };
            const { error } = await sb
                .from('kiwe_app_settings')
                .upsert({ key: DB_SETTINGS_KEY, value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (error) throw error;
            setColSettingsSaveStatus('saved');
            setTimeout(() => setColSettingsSaveStatus(''), 2500);
        } catch (err) {
            console.error('컬럼 설정 저장 실패:', err);
            setColSettingsSaveStatus('error');
            setTimeout(() => setColSettingsSaveStatus(''), 3000);
        }
    };

    // 컬럼 이동 헬퍼
    const moveColumn = (key, dir) => {
        setColumnOrder(prev => {
            const idx = prev.indexOf(key);
            if (idx < 0) return prev;
            const next = [...prev];
            const swapIdx = idx + dir;
            if (swapIdx < 0 || swapIdx >= next.length) return prev;
            [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
            return next;
        });
    };

    // 컬럼 토글 (숨기기/보이기)
    const toggleColumn = (key) => {
        setColumnOrder(prev =>
            prev.includes(key)
                ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) // 마지막 컬럼은 숨기지 않음
                : [...prev, key]
        );
    };

    // 현재 순서대로 정렬된 표시 컬럼
    const orderedCols = useMemo(() => {
        const colMap = {};
        ALL_COLUMNS.forEach(c => { colMap[c.key] = c; });
        return columnOrder.map(k => colMap[k]).filter(Boolean);
    }, [columnOrder]);

    // 필터 + 정렬 적용
    const filteredRows = useMemo(() => {
        const filtered = records.filter(r => {
            const term = comNameFilter.toLowerCase().replace(/\s/g, '');
            const nameMatch = !comNameFilter || (r.com_name || '').toLowerCase().replace(/\s/g, '').includes(term);
            // editRows에서 최신 noise_result 가져오기
            const curNoise = editRows[r._rowKey]?.noise_result ?? r.noise_result;
            const n = parseFloat(curNoise);
            const noiseMatch =
                noiseFilter === 'all' ? true :
                    noiseFilter === 'warn85' ? (!isNaN(n) && n >= 85) :
                        noiseFilter === 'overLimit' ? (() => {
                            const lim = calcExposureLimit(r.work_hour);
                            return !isNaN(n) && lim !== null && n > lim;
                        })() : true;
            return nameMatch && noiseMatch;
        });
        filtered.sort((a, b) => {
            // 1차: 날짜 (최신순/과거순)
            const da = a.m_date || '';
            const db = b.m_date || '';
            const dateComp = sortOrder === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
            if (dateComp !== 0) return dateComp;

            // 2차: 사업장명 (가나다순 묶기)
            const ca = a.com_name || '';
            const cb = b.com_name || '';
            const comComp = ca.localeCompare(cb);
            if (comComp !== 0) return comComp;

            // 3차: 입력 순서 (시료채취대장 ID 기준)
            return (a._samplingId || 0) - (b._samplingId || 0);
        });
        return filtered;
    }, [records, editRows, comNameFilter, noiseFilter, sortOrder]);

    // 통계 요약 (editRows 최신값 반영, 노출기준 초과는 개별 노출기준 기준)
    const stats = useMemo(() => {
        const pairs = filteredRows.map(r => {
            const cur = editRows[r._rowKey]?.noise_result ?? r.noise_result;
            const n = parseFloat(cur);
            const lim = calcExposureLimit(r.work_hour);
            return { n, lim };
        });
        const withResult = pairs.filter(p => !isNaN(p.n));
        return {
            total: filteredRows.length,
            warn85: withResult.filter(p => p.n >= 85).length,
            overLimit: withResult.filter(p => p.lim !== null && p.n > p.lim).length,
            avg: withResult.length ? (withResult.reduce((s, p) => s + p.n, 0) / withResult.length).toFixed(1) : '-',
            max: withResult.length ? Math.max(...withResult.map(p => p.n)).toFixed(1) : '-',
        };
    }, [filteredRows, editRows]);

    // =====================================================
    // 데이터 조회: 시료채취대장이 원본 소스
    // kiwe_noise_records는 보정기번호 + 소음결과 lookup용
    // =====================================================
    const handleSearchAndImport = useCallback(async () => {
        setLoading(true);
        try {
            // 1. 시료채취대장에서 소음 대상자 전체 조회
            const getTableList = (start, end) => {
                if (!start || !end) return [];
                const tables = new Set();
                const startDateObj = new Date(start);
                const endDateObj = new Date(end);
                let curr = new Date(startDateObj);
                while (curr <= endDateObj) {
                    const year = curr.getFullYear();
                    const half = curr.getMonth() + 1 <= 6 ? 1 : 2;
                    tables.add(`kiwe_sampling_${year}_${half}`);
                    curr.setMonth(curr.getMonth() + 6);
                }
                const ey = endDateObj.getFullYear();
                const eh = endDateObj.getMonth() + 1 <= 6 ? 1 : 2;
                tables.add(`kiwe_sampling_${ey}_${eh}`);
                return Array.from(tables);
            };

            const tables = getTableList(startDate, endDate);
            let samplingRows = [];
            for (const table of tables) {
                const { data, error } = await sb
                    .from(table)
                    .select('*')
                    .gte('m_date', startDate)
                    .lte('m_date', endDate)
                    .eq('common_name', '소음');
                if (!error && data) samplingRows = samplingRows.concat(data);
            }

            // 2. kiwe_noise_records에서 보정기번호 + 소음결과 로드 (lookup용)
            const { data: noiseData } = await sb
                .from('kiwe_noise_records')
                .select('id, m_date, noise_no, com_name, worker_name, calibrator_no, noise_result, cal_date')
                .gte('m_date', startDate)
                .lte('m_date', endDate);

            // 3. m_date + noise_no + worker_name 키로 noise_records 맵 구성
            //    구버전 데이터(worker_name 없음)와 신버전 데이터 모두 커버하기 위해 2가지 맵 구성:
            //    - noiseMap3: 3중 키 (m_date + noise_no + worker_name) — 정확한 매칭
            //    - noiseMap2: 2중 키 (m_date + noise_no) — fallback (worker_name이 null인 구버전)
            const noiseMap3 = {};
            const noiseMap2 = {};
            (noiseData || []).forEach(r => {
                const key3 = `${r.m_date}_${(r.noise_no || '').trim()}_${(r.worker_name || '').trim()}`;
                const key2 = `${r.m_date}_${(r.noise_no || '').trim()}`;
                noiseMap3[key3] = r;
                // 2중 키는 worker_name이 비어있는 경우(구버전)만 fallback으로 등록
                if (!r.worker_name || r.worker_name.trim() === '') {
                    noiseMap2[key2] = r;
                }
            });

            // 4. 시료채취대장 기준으로 display 행 생성 → noise_records로 오버레이
            const mergedRows = samplingRows.map(emp => {
                const noiseNo = (emp.pump_no || '').trim();
                const workerName = (emp.worker_name || '').trim();
                // rowKey는 그리드 내부 상태 관리를 위해 더 유니크하게 (ID 포함)
                const rowKey = `${emp.m_date}_${noiseNo}_${workerName}_${emp.id}`;
                
                // DB 조회용 키 (검색 키)
                // 1차: 3중 키(날짜+소음기번호+작업자명) 정확 매칭
                // 2차 fallback: 2중 키(날짜+소음기번호) — worker_name이 null인 구버전 noise_records 데이터 커버
                const lookupKey3 = `${emp.m_date}_${noiseNo}_${workerName}`;
                const lookupKey2 = `${emp.m_date}_${noiseNo}`;
                const noiseRec = noiseMap3[lookupKey3] || noiseMap2[lookupKey2] || {};
                
                const mt = calcMeasureTime(emp.start_time, emp.end_time, emp.lunch_time ?? 60);
                return {
                    _rowKey: rowKey,
                    _noiseId: noiseRec.id || null,
                    _samplingId: emp.id, // 정렬용 원본 ID
                    m_date: emp.m_date || '',
                    cal_date: noiseRec.cal_date || getPrevWeekday(emp.m_date),
                    com_name: emp.com_name || '',
                    work_process: emp.work_process || '',
                    worker_name: workerName,
                    noise_no: noiseNo,
                    start_time: emp.start_time ? emp.start_time.substring(0, 5) : '',
                    end_time: emp.end_time ? emp.end_time.substring(0, 5) : '',
                    lunch_time: emp.lunch_time ?? 60,
                    measure_time: mt,
                    measured_by: emp.measured_by || '',
                    temp: emp.temp || '',
                    humidity: emp.humidity || '',
                    work_hour: emp.work_hour ?? null,
                    // noise_records 오버레이
                    calibrator_no: noiseRec.calibrator_no || '',
                    noise_result: noiseRec.noise_result ?? '',
                    memo: emp.remarks || '',
                };
            });

            setRecords(mergedRows);
            setEditRows({});

        } catch (err) {
            console.error(err);
            alert('데이터 로드 실패: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, sb]);



    // =====================================================
    // 개별 셀 수정 (보정기번호, 소음결과만 편집)
    // =====================================================
    const handleCellChange = useCallback((row, field, value) => {
        const key = row._rowKey;
        setEditRows(prev => {
            const cur = prev[key] || {};
            // 데이터가 실제로 변경되었을 때만 상태 업데이트를 최적화해도 되지만, 
            // 현재는 간단하게 모두 반영
            return { ...prev, [key]: { ...cur, [field]: value } };
        });
    }, []);

    // 키보드 네비게이션 핸들러
    const handleKeyDown = useCallback((ev, rowIdx, colKey) => {
        const { key } = ev;
        
        // 1. 위아래 화살표/엔터로 행 이동
        if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter') {
            // 숫자 입력 칸에서 화살표로 값이 변하는 것 방지 (사용자 요청)
            if (key !== 'Enter') ev.preventDefault();
            
            let nextIdx = rowIdx;
            if (key === 'ArrowDown' || key === 'Enter') nextIdx++;
            else nextIdx--;
            
            const target = document.querySelector(`input[data-row-idx="${nextIdx}"][data-col-key="${colKey}"], select[data-row-idx="${nextIdx}"][data-col-key="${colKey}"]`);
            if (target) {
                target.focus();
                if (target.select) target.select();
            }
            return;
        }
        
        // 2. 좌우 화살표로 컬럼 이동
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const currentIdx = columnOrder.indexOf(colKey);
            if (currentIdx === -1) return;
            
            let nextColIdx = key === 'ArrowRight' ? currentIdx + 1 : currentIdx - 1;
            
            // 편집 가능한 다음 컬럼 찾기
            while (nextColIdx >= 0 && nextColIdx < columnOrder.length) {
                const nextColKey = columnOrder[nextColIdx];
                const colDef = ALL_COLUMNS.find(c => c.key === nextColKey);
                if (colDef && colDef.editable) {
                    ev.preventDefault();
                    const target = document.querySelector(`input[data-row-idx="${rowIdx}"][data-col-key="${nextColKey}"], select[data-row-idx="${rowIdx}"][data-col-key="${nextColKey}"]`);
                    if (target) {
                        target.focus();
                        if (target.select) target.select();
                    }
                    break;
                }
                nextColIdx = key === 'ArrowRight' ? nextColIdx + 1 : nextColIdx - 1;
            }
        }
    }, [columnOrder]);

    // =====================================================
    // 저장: kiwe_noise_records에 보정기번호 + 소음결과만 저장
    // _noiseId 있으면 UPDATE, 없으면 INSERT
    // =====================================================
    const handleSave = async () => {
        setSaving(true);
        try {
            let hasError = false;
            const editEntries = Object.entries(editRows);

            for (const [rowKey, changes] of editEntries) {
                // 원본 행 찾기
                const origRow = records.find(r => r._rowKey === rowKey);
                if (!origRow) continue;

                const merged = { ...origRow, ...changes };

                // 저장할 필드만 추출 (시료채취대장에서 오는 필드는 제외)
                const saveData = {
                    m_date: merged.m_date || null,
                    noise_no: merged.noise_no || null,
                    worker_name: merged.worker_name || null, // 개별 식별을 위해 추가
                    work_process: merged.work_process || null,
                    com_name: merged.com_name || null,
                    cal_date: merged.cal_date || null,
                    calibrator_no: merged.calibrator_no === '' ? null : (merged.calibrator_no || null),
                    noise_result: merged.noise_result === '' ? null : (merged.noise_result !== null && merged.noise_result !== undefined ? parseFloat(merged.noise_result) : null),
                    // 필요 시 다른 필드들도 동기화 (선택 사항)
                    start_time: merged.start_time || null,
                    end_time: merged.end_time || null,
                    measure_time: merged.measure_time || null,
                };
                // NaN 방지
                if (isNaN(saveData.noise_result)) saveData.noise_result = null;

                if (merged._noiseId) {
                    const { error } = await sb.from('kiwe_noise_records').update(saveData).eq('id', merged._noiseId);
                    if (error) { alert(`저장 실패: ${error.message}`); hasError = true; }
                } else {
                    const { data: inserted, error } = await sb.from('kiwe_noise_records').insert(saveData).select('id').single();
                    if (error) { alert(`저장 실패: ${error.message}`); hasError = true; }
                    else {
                        // 방금 저장한 _noiseId를 records에 반영
                        setRecords(prev => prev.map(r =>
                            r._rowKey === rowKey ? { ...r, _noiseId: inserted.id } : r
                        ));
                    }
                }
            }

            if (!hasError) {
                setEditRows({});
                alert('저장되었습니다.');
                await handleSearchAndImport();
            }
        } catch (err) {
            alert('저장 중 오류: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // =====================================================
    // 행 삭제 (noise_records에 저장된 것만 삭제 가능)
    // =====================================================
    const handleDelete = async (row) => {
        if (!row._noiseId) {
            // 아직 저장 안 된 행 → editRows에서만 제거
            setEditRows(prev => { const n = { ...prev }; delete n[row._rowKey]; return n; });
            return;
        }
        if (!confirm(`[${row.com_name}] ${row.m_date} 소음기 ${row.noise_no} 기록(보정기/결과)을 삭제하시겠습니까?\n시료채취기록은 유지됩니다.`)) return;
        const { error } = await sb.from('kiwe_noise_records').delete().eq('id', row._noiseId);
        if (error) { alert('삭제 실패: ' + error.message); return; }
        // _noiseId 초기화 (display row는 유지, 저장 기록만 지움)
        setRecords(prev => prev.map(r => r._rowKey === row._rowKey ? { ...r, _noiseId: null, calibrator_no: '', noise_result: '' } : r));
        setEditRows(prev => { const n = { ...prev }; delete n[row._rowKey]; return n; });
    };



    // =====================================================
    // 엑셀 다운로드
    // =====================================================
    const downloadExcel = () => {
        if (!window.XLSX) { alert('Excel 라이브러리가 로드되지 않았습니다.'); return; }
        const target = filteredRows;
        if (target.length === 0) { alert('다운로드할 데이터가 없습니다.'); return; }
        const excelData = target.map((r, i) => {
            const cur = { ...r, ...(editRows[r._rowKey] || {}) };
            const expLimit = calcExposureLimit(cur.work_hour);
            return {
                'No': i + 1,
                '측정일자': cur.m_date || '',
                '소음보정일': cur.cal_date || '',
                '사업장명': cur.com_name || '',
                '공정명': cur.work_process || '',
                '작업자명': cur.worker_name || '',
                '소음기번호': cur.noise_no || '',
                '시작시간': formatTimeValue(cur.start_time),
                '종료시간': formatTimeValue(cur.end_time),
                '점심시간(분)': cur.lunch_time ?? '',
                '측정시간(분)': cur.measure_time ?? '',
                '실근로시간(h)': cur.work_hour ?? '',
                '노출기준 dB(A)': formatExposureLimit(expLimit),
                '측정자': cur.measured_by || '',
                '온도(℃)': cur.temp ?? '',
                '습도(%)': cur.humidity ?? '',
                '소음결과 dB(A)': cur.noise_result ?? '',
                '비고': cur.memo || '',
            };
        });
        const ws = window.XLSX.utils.json_to_sheet(excelData);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, '소음측정대장');
        window.XLSX.writeFile(wb, `소음측정대장_${startDate}_${endDate}.xlsx`);
    };

    // =====================================================
    // 컬럼 리사이즈
    // =====================================================
    const handleColResizeStart = useCallback((key, ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const startX = ev.clientX;
        const startW = colWidths[key] || ALL_COLUMNS.find(c => c.key === key)?.width || 100;
        resizingRef.current = { key, startX, startW };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (mv) => {
            const delta = mv.clientX - resizingRef.current.startX;
            const newW = Math.max(40, resizingRef.current.startW + delta);
            setColWidths(prev => ({ ...prev, [resizingRef.current.key]: newW }));
        };
        const onUp = () => {
            resizingRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [colWidths, setColWidths]);

    // =====================================================
    // 셀 렌더링
    // =====================================================
    const renderCell = (row, col) => {
        const rowData = { ...row, ...(editRows[row._rowKey] || {}) };
        const val = rowData[col.key];
        const displayVal = val === null || val === undefined ? '' : val;

        // 노출기준: work_hour 기반 계산 컬럼 (읽기전용)
        if (col.key === 'exposure_limit') {
            const computed = calcExposureLimit(rowData.work_hour);
            const displayText = formatExposureLimit(computed);
            const isOver = computed !== null && computed < parseFloat(rowData.noise_result);
            return e('td', {
                key: col.key,
                className: 'px-2 py-0 text-center text-xs border-r border-slate-100',
                style: { width: colWidths[col.key] || col.width, minWidth: 80 }
            },
                e('span', {
                    className: isOver ? 'font-bold text-red-600' : 'font-semibold text-indigo-700'
                }, displayText)
            );
        }

        if (!col.editable) {
            // 읽기 전용 컬럼: 배경색과 회색 글자색을 제거하여 행의 격줄 스타일(bg-white/bg-slate-100)이 보이도록 함
            const isDuration = col.key === 'measure_time' || col.key === 'lunch_time';
            return e('td', {
                key: col.key,
                className: 'px-2 py-0 text-center text-xs text-slate-800 border-r border-slate-100',
                style: { width: colWidths[col.key] || col.width, minWidth: 40 }
            }, displayVal !== '' ? (isDuration ? `${displayVal}분` : displayVal) : '-');
        }

        // 시간 입력 (0912 -> 09:12 자동 포맷)
        if (col.key === 'start_time' || col.key === 'end_time') {
            const timeVal = displayVal && typeof displayVal === 'string' && displayVal.length === 8
                ? displayVal.substring(0, 5)
                : displayVal;
            return e('td', {
                key: col.key,
                className: 'px-1 py-0 border-r border-slate-100',
                style: { width: colWidths[col.key] || col.width, minWidth: 50 }
            },
                e('input', {
                    type: 'text',
                    value: timeVal,
                    onChange: ev => handleCellChange(row, col.key, ev.target.value),
                    onBlur: ev => handleCellChange(row, col.key, formatTimeValue(ev.target.value)),
                    onKeyDown: ev => handleKeyDown(ev, row.__idx, col.key),
                    'data-row-idx': row.__idx,
                    'data-col-key': col.key,
                    placeholder: '0000',
                    className: 'w-full bg-transparent outline-none text-center text-xs focus:ring-1 focus:ring-inset focus:ring-indigo-400 rounded px-1 py-0.5',
                })
            );
        }

        // Select 입력 처리 (보정기번호 등)
        if (col.inputType === 'select') {
            return e('td', {
                key: col.key,
                className: 'px-1 py-0 border-r border-slate-100',
                style: { width: colWidths[col.key] || col.width, minWidth: 50 }
            },
                e('select', {
                    value: displayVal,
                    onChange: ev => handleCellChange(row, col.key, ev.target.value),
                    onKeyDown: ev => handleKeyDown(ev, row.__idx, col.key),
                    'data-row-idx': row.__idx,
                    'data-col-key': col.key,
                    className: 'w-full bg-transparent outline-none text-center text-xs focus:ring-1 focus:ring-inset focus:ring-indigo-400 rounded px-1 py-0.5 cursor-pointer'
                },
                    (col.options || []).map(opt =>
                        e('option', { key: opt, value: opt }, opt === '' ? '-' : opt)
                    )
                )
            );
        }

        // 소음결과 강조 (개별 노출기준 기반)
        if (col.key === 'noise_result') {
            const exposureLimit = calcExposureLimit(rowData.work_hour);
            return e('td', {
                key: col.key,
                className: `px-1 py-0 border-r border-slate-100 ${getNoiseRowClass(val, exposureLimit)}`,
                style: { width: colWidths[col.key] || col.width, minWidth: 40 }
            },
                e('div', { className: 'flex items-center gap-1' },
                    e('input', {
                        type: 'number',
                        step: '0.1',
                        value: displayVal,
                        onChange: ev => handleCellChange(row, col.key, ev.target.value),
                        onKeyDown: ev => handleKeyDown(ev, row.__idx, col.key),
                        'data-row-idx': row.__idx,
                        'data-col-key': col.key,
                        className: `w-full bg-transparent outline-none text-center text-xs font-bold ${getNoiseResultClass(val, exposureLimit)} focus:ring-1 focus:ring-inset focus:ring-indigo-400 rounded hide-spin-buttons`,
                        placeholder: '0.0',
                    }),
                    e('span', { className: 'text-[10px] text-slate-400 whitespace-nowrap' }, 'dB')
                )
            );
        }

        return e('td', {
            key: col.key,
            className: 'px-1 py-0 border-r border-slate-100',
            style: { width: colWidths[col.key] || col.width, minWidth: 40 }
        },
            e('input', {
                type: col.inputType === 'number' ? 'number' : col.inputType === 'date' ? 'date' : 'text',
                step: col.inputType === 'number' ? '0.1' : undefined,
                value: displayVal,
                onChange: ev => handleCellChange(row, col.key, ev.target.value),
                onKeyDown: ev => handleKeyDown(ev, row.__idx, col.key),
                'data-row-idx': row.__idx,
                'data-col-key': col.key,
                className: `w-full bg-transparent outline-none text-center text-xs focus:ring-1 focus:ring-inset focus:ring-indigo-400 rounded px-1 py-0.5 ${col.inputType === 'number' ? 'hide-spin-buttons' : ''}`,
                placeholder: col.label,
            })
        );
    };

    // 편집 여부 확인
    const hasChanges = Object.keys(editRows).length > 0;

    // =====================================================
    // 렌더
    // =====================================================
    return e('div', { 
        className: 'flex flex-col gap-3 h-full',
        style: { backgroundColor: '#ffffff', color: '#000000' } // 다크모드 환경 강제 흰색 배경
    },
        // ── 스타일 (Spin Buttons 제거)
        e('style', null, `
            .hide-spin-buttons::-webkit-inner-spin-button,
            .hide-spin-buttons::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .hide-spin-buttons {
                -moz-appearance: textfield;
            }
        `),

        // ── 통계 모달
        e(StatsModal, { isOpen: showStats, onClose: () => setShowStats(false), data: filteredRows }),

        // ── 인쇄 미리보기 모달
        e(PrintPreviewModal, {
            isOpen: showPrint,
            onClose: () => setShowPrint(false),
            data: records,
            printYear,
            printHalf,
            comNameFilter,
        }),


        // ── 필터 / 조회 패널
        e('div', { className: 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-3 no-print' },
            // 날짜 범위
            e('div', { className: 'space-y-1' },
                e('label', { className: 'text-xs font-bold text-slate-400' }, '조회 기간'),
                e('div', { className: 'flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3' },
                    e('input', { type: 'date', value: startDate, onChange: ev => setStartDate(ev.target.value), className: 'bg-transparent text-sm font-bold py-2 outline-none' }),
                    e('span', { className: 'text-slate-300' }, '~'),
                    e('input', { type: 'date', value: endDate, onChange: ev => setEndDate(ev.target.value), className: 'bg-transparent text-sm font-bold py-2 outline-none' })
                )
            ),
            // 사업장 필터
            e('div', { className: 'space-y-1 flex-1 min-w-[180px]' },
                e('label', { className: 'text-xs font-bold text-slate-400' }, '사업장명'),
                e('input', {
                    type: 'text',
                    value: comNameFilter,
                    onChange: ev => setComNameFilter(ev.target.value),
                    placeholder: '사업장명 검색...',
                    className: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400'
                })
            ),
            // 소음 필터 버튼
            e('div', { className: 'space-y-1' },
                e('label', { className: 'text-xs font-bold text-slate-400' }, '소음 필터'),
                e('div', { className: 'flex gap-1' },
                    [
                        { key: 'all', label: '전체' },
                        { key: 'warn85', label: '85↑ ⚠' },
                        { key: 'overLimit', label: '기준초과 🔴' },
                    ].map(f => e('button', {
                        key: f.key,
                        onClick: () => setNoiseFilter(f.key),
                        className: `px-3 py-2 rounded-lg text-xs font-bold border transition-all ${noiseFilter === f.key
                            ? (f.key === 'overLimit' ? 'bg-orange-500 text-white border-orange-500' : f.key === 'warn85' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-indigo-600 text-white border-indigo-600')
                            : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                            }`
                    }, f.label))
                )
            ),
            // 데이터 조회 및 시료채취대장 불러오기 (통합 버튼)
            e('button', {
                onClick: handleSearchAndImport, disabled: loading,
                className: 'px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-60 h-[38px] transition-all border border-indigo-700'
            }, loading ? '로딩 중...' : '🔍 소음데이터 조회'),

            // 정렬 버튼
            e('div', { className: 'flex gap-1 h-[38px] ml-auto' },
                e('button', {
                    onClick: () => setSortOrder('desc'),
                    className: `px-3 py-2 rounded-l-lg text-xs font-bold border transition-all h-full ${sortOrder === 'desc' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`
                }, '🔽 최신순'),
                e('button', {
                    onClick: () => setSortOrder('asc'),
                    className: `px-3 py-2 rounded-r-lg text-xs font-bold border-t border-r border-b transition-all h-full ${sortOrder === 'asc' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`
                }, '🔼 과거순')
            ),
            // 행 추가 (기본값 패널로 이동됨)
            // 저장
            hasChanges && e('button', {
                onClick: handleSave, disabled: saving,
                className: 'px-4 py-2 bg-amber-500 text-white font-bold rounded-lg shadow hover:bg-amber-600 flex items-center gap-2 h-[38px] animate-pulse'
            }, saving ? '저장중...' : `💾 저장 (${Object.keys(editRows).length}건 변경)`),
            // 엑셀
            e('button', {
                onClick: downloadExcel,
                className: 'px-4 py-2 bg-teal-600 text-white font-bold rounded-lg shadow hover:bg-teal-700 flex items-center gap-2 h-[38px]'
            }, '📥 엑셀'),
            // 통계
            e('button', {
                onClick: () => setShowStats(true),
                className: 'px-4 py-2 bg-purple-600 text-white font-bold rounded-lg shadow hover:bg-purple-700 flex items-center gap-2 h-[38px]'
            }, '📊 통계'),
            // 인쇄/PDF
            e('div', { className: 'flex items-end gap-1' },
                e('select', { value: printYear, onChange: ev => setPrintYear(ev.target.value), className: 'h-[38px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none' },
                    [thisYear - 1, thisYear, thisYear + 1].map(y => e('option', { key: y, value: y }, `${y}년`))
                ),
                e('select', { value: printHalf, onChange: ev => setPrintHalf(ev.target.value), className: 'h-[38px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none' },
                    [{ v: '1', l: '상반기' }, { v: '2', l: '하반기' }].map(h => e('option', { key: h.v, value: h.v }, h.l))
                ),
                e('button', {
                    onClick: () => setShowPrint(true),
                    className: 'px-4 py-2 bg-rose-600 text-white font-bold rounded-lg shadow hover:bg-rose-700 flex items-center gap-2 h-[38px]'
                }, '🖨 미리보기')
            )
        ),

        // ── 통계 요약바
        e('div', { className: 'flex gap-3 flex-wrap no-print' },
            [
                { label: '조회 건수', value: `${stats.total}건`, color: 'bg-white border-slate-200' },
                { label: '85dB 이상', value: `${stats.warn85}건`, color: 'bg-yellow-50 border-yellow-200' },
                { label: '노출기준 초과', value: `${stats.overLimit}건`, color: 'bg-orange-50 border-orange-200' },
                { label: '평균 소음', value: `${stats.avg} dB`, color: 'bg-sky-50 border-sky-200' },
                { label: '최고 소음', value: `${stats.max} dB`, color: 'bg-red-50 border-red-200' },
            ].map((s, i) => e('div', { key: i, className: `bg-white rounded-xl border ${s.color} px-4 py-2 shadow-sm flex items-center gap-3` },
                e('span', { className: 'text-xs font-bold text-slate-400' }, s.label),
                e('span', { className: 'text-base font-black text-slate-800' }, s.value)
            ))
        ),

        // ── 범례
        e('div', { className: 'flex gap-3 text-xs font-bold text-slate-500 no-print' },
            e('span', { className: 'flex items-center gap-1' }, e('span', { className: 'inline-block w-4 h-4 rounded bg-yellow-100 border border-yellow-300' }), '85dB 이상 주의'),
            e('span', { className: 'flex items-center gap-1' }, e('span', { className: 'inline-block w-4 h-4 rounded bg-orange-100 border border-orange-300' }), '노출기준(실근로시간 보정) 초과'),
            e('span', { className: 'text-slate-400' }, '노출기준: 실근로시간별 개별 적용')
        ),
        // ── 컬럼 설정 패널
        e('div', { className: 'bg-white border border-slate-200 rounded-xl shadow-sm no-print' },
            e('button', {
                onClick: () => setShowColSettings(p => !p),
                className: 'w-full px-4 py-2 flex items-center justify-between text-slate-600 font-bold text-[11px] hover:bg-slate-50 rounded-xl transition-all'
            },
                e('span', { className: 'flex items-center gap-2' }, '⚙️ 컬럼 설정 (순서・너비・표시/숨김 → DB 저장으로 전체 공유)'),
                e('span', { className: 'text-slate-400 text-[10px]' }, showColSettings ? '▲ 접기' : '▼ 펼치기')
            ),
            showColSettings && e('div', { className: 'px-4 pb-4 space-y-3' },
                // 1. 활성 컬럼 칩 (순서 변경)
                e('div', null,
                    e('p', { className: 'text-[10px] font-bold text-slate-400 uppercase mb-2' }, '현재 표시 컬럼 (◀ ▶ 로 순서 변경, ✕ 로 숨김)'),
                    e('div', { className: 'flex flex-wrap gap-1.5' },
                        orderedCols.map((col, idx) =>
                            e('div', {
                                key: col.key,
                                className: 'flex items-center gap-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md px-1.5 py-1 text-xs font-bold shadow-sm'
                            },
                                e('button', {
                                    onClick: () => moveColumn(col.key, -1),
                                    disabled: idx === 0,
                                    className: `p-0.5 rounded ${idx === 0 ? 'opacity-20' : 'hover:bg-indigo-200'}`
                                }, '◀'),
                                e('span', { className: 'px-1.5' }, col.label),
                                e('button', {
                                    onClick: () => moveColumn(col.key, 1),
                                    disabled: idx === orderedCols.length - 1,
                                    className: `p-0.5 rounded ${idx === orderedCols.length - 1 ? 'opacity-20' : 'hover:bg-indigo-200'}`
                                }, '▶'),
                                e('button', {
                                    onClick: () => toggleColumn(col.key),
                                    className: 'ml-0.5 p-0.5 rounded hover:bg-rose-100 text-rose-400 transition'
                                }, '✕')
                            )
                        )
                    )
                ),
                // 2. 숨김 컬럼 (다시 추가)
                (() => {
                    const hidden = ALL_COLUMNS.filter(c => !columnOrder.includes(c.key));
                    if (hidden.length === 0) return null;
                    return e('div', null,
                        e('p', { className: 'text-[10px] font-bold text-slate-400 uppercase mb-2' }, '숨김 컬럼 (클릭하여 추가)'),
                        e('div', { className: 'flex flex-wrap gap-1' },
                            hidden.map(col =>
                                e('button', {
                                    key: col.key,
                                    onClick: () => toggleColumn(col.key),
                                    className: 'px-2 py-1 rounded border border-dashed border-slate-300 text-slate-500 text-xs font-bold hover:bg-slate-50 hover:border-indigo-400 hover:text-indigo-600 transition flex items-center gap-1'
                                }, e('span', { className: 'text-sm opacity-70' }, '+'), col.label)
                            )
                        )
                    );
                })()
                ,
                // 3. 저장 / 초기화 버튼
                e('div', { className: 'flex gap-2 pt-1 border-t border-slate-100' },
                    e('button', {
                        onClick: saveColConfigToDB,
                        disabled: colSettingsSaveStatus === 'saving',
                        className: `px-4 py-1.5 text-xs font-bold rounded-lg transition ${colSettingsSaveStatus === 'saving' ? 'bg-slate-200 text-slate-500 cursor-wait' :
                            colSettingsSaveStatus === 'saved' ? 'bg-emerald-100 text-emerald-700' :
                                colSettingsSaveStatus === 'error' ? 'bg-rose-100 text-rose-700' :
                                    'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`
                    }, colSettingsSaveStatus === 'saving' ? '저장 중...' :
                        colSettingsSaveStatus === 'saved' ? '✓ 저장됨 (전체 공유)' :
                            colSettingsSaveStatus === 'error' ? '⚠ 저장 실패' :
                                '💾 설정 저장 (전체 공유)'),
                    e('button', {
                        onClick: () => setColumnOrder(DEFAULT_COLS),
                        className: 'px-3 py-1.5 text-xs font-bold border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-100 transition'
                    }, '↺ 초기화'),
                    e('button', {
                        onClick: () => setColumnOrder(ALL_COLUMNS.map(c => c.key)),
                        className: 'px-3 py-1.5 text-xs font-bold border border-slate-200 text-indigo-500 rounded-lg hover:bg-indigo-50 transition'
                    }, '전체 표시')
                )
            )
        ),




        // ── 데이터 그리드
        e('div', { className: 'flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col' },
            e('div', { className: 'overflow-auto flex-1', style: { minHeight: 300 } },
                e('table', { 
                    className: 'border-collapse text-xs', 
                    style: { tableLayout: 'fixed', backgroundColor: '#ffffff', color: '#000000' } 
                },
                    // 헤더
                    e('thead', { className: 'sticky top-0 z-20' },
                        e('tr', { className: 'bg-slate-700 text-white' },
                    // 삭제 컬럼
                    e('th', { 
                        className: 'px-2 py-2 text-center font-bold w-10 border-r border-slate-600 bg-slate-700 text-white', 
                        style: { minWidth: 40, borderRight: '1px solid #475569' } 
                    }, '삭제'),
                    // 동적 컬럼 (orderedCols 순서)
                    ...orderedCols.map(col =>
                        e('th', {
                            key: col.key,
                            className: 'px-2 py-2 font-bold text-center border-r border-slate-600 relative select-none whitespace-nowrap bg-slate-700 text-white',
                            style: { width: colWidths[col.key] || col.width, minWidth: 40, borderRight: '1px solid #475569' }
                        },
                                    col.label,
                                    e('div', {
                                        className: 'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 z-10',
                                        onMouseDown: ev => handleColResizeStart(col.key, ev)
                                    })
                                )
                            )
                        )
                    ),
                    // 본문
                    e('tbody', null,
                        loading
                            ? e('tr', null, e('td', { colSpan: orderedCols.length + 1, className: 'text-center py-12 text-slate-400' }, '데이터 로딩 중...'))
                            : filteredRows.map((row, idx) => {
                                const rowData = { ...row, ...(editRows[row._rowKey] || {}) };
                                const n = parseFloat(rowData.noise_result);
                                const rowBg = n > NOISE_STANDARD ? 'bg-orange-50' : n >= WARN_LEVEL ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-100';
                                const isModified = !!editRows[row._rowKey];
                                const hasSaved = !!row._noiseId;

                                return e('tr', {
                                    key: row._rowKey,
                                    className: `${rowBg} hover:bg-indigo-50/30 transition-colors border-b border-slate-100 h-[24px] ${!hasSaved ? 'ring-1 ring-inset ring-slate-300' : ''} ${isModified ? 'ring-2 ring-inset ring-amber-400' : ''}`,
                                    style: { height: 24 }
                                },
                                    // 삭제 버튼 (저장된 기록만)
                                    e('td', { className: 'px-1 py-0 text-center border-r border-slate-100 w-10', style: { minWidth: 40, height: 24 } },
                                        hasSaved
                                            ? e('button', { onClick: () => handleDelete(row), className: 'p-1 text-slate-300 hover:text-red-500 transition-colors rounded' }, '🗑')
                                            : e('span', { className: 'text-[10px] text-slate-300' }, '-')
                                    ),
                                    ...orderedCols.map(col => renderCell({ ...row, __idx: idx }, col))
                                );
                            })
                    )
                )
            )
        )
    );
}

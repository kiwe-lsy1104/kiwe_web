// analysis_grid.js - 분석 시료 데이터 그리드 (우측 2/3)
// 동적 컬럼, 기기별 계산, 공유저장(Supabase)

import React, { useState, useEffect, useMemo, useCallback } from 'https://esm.sh/react@18.2.0';
import { Search, Save, Settings2, X, ChevronLeft, ChevronRight, Cloud, CloudOff } from 'https://esm.sh/lucide-react@0.263.1';

const e = React.createElement;

// ── 기기별 컬럼 정의 ───────────────────────────────────────────────
const ALL_COLS = [
    { id: 'm_date', label: '측정일자', align: 'center', modes: ['ICP', 'GC', '외부'] },
    { id: 'com_name', label: '사업장명', align: 'left', modes: ['ICP', 'GC', '외부'] },
    { id: 'common_name', label: '유해인자', align: 'left', modes: ['ICP', 'GC', '외부'] },
    { id: 'sample_id', label: '시료번호', align: 'left', modes: ['ICP', 'GC', '외부'] },
    { id: 'work_process', label: '공정명', align: 'left', modes: ['ICP', 'GC', '외부'] },
    { id: 'worker_name', label: '작업자명', align: 'left', modes: ['ICP', 'GC', '외부'] },
    { id: 'work_hour', label: '근로시간', align: 'center', modes: ['ICP', 'GC', '외부'] },
    { id: 'unit', label: '단위', align: 'center', modes: ['ICP', 'GC', '외부'] },
    { id: 'twa_limit', label: '노출기준', align: 'right', modes: ['ICP', 'GC', '외부'] },
    { id: 'compensated_tlv', label: '보정기준', align: 'right', modes: ['ICP', 'GC', '외부'] },
    { id: 'result_val', label: '분석결과', align: 'right', modes: ['ICP', 'GC', '외부'] },
    { id: 'eval', label: '평가', align: 'center', modes: ['ICP', 'GC', '외부'] },
    { id: 'status', label: '완료', align: 'center', modes: ['ICP', 'GC', '외부'] },
    { id: 'completed_at', label: '완료날짜', align: 'center', modes: ['ICP', 'GC', '외부'] },
    { id: 'vol_l', label: '채기량(L)', align: 'right', modes: ['ICP', 'GC'] },
    { id: 'sample_area', label: 'Area', align: 'right', modes: ['GC'] },
    { id: 'conc_raw', label: '농도(µg/ml)', align: 'right', modes: ['ICP', 'GC'] },
    { id: 'desorb_vol', label: '희석액(ml)', align: 'right', modes: ['ICP'] },
    { id: 'dilution_factor', label: '희석배수', align: 'right', modes: ['ICP'] },
    { id: 'blank1_conc', label: '공시료1 농도', align: 'right', modes: ['ICP'] },
    { id: 'blank2_conc', label: '공시료2 농도', align: 'right', modes: ['ICP'] },
    { id: 'lod_row', label: 'LOD', align: 'right', modes: ['ICP', 'GC'] },
    { id: 'loq_row', label: 'LOQ', align: 'right', modes: ['ICP', 'GC'] },
];

const DEFAULT_COLS_ICP = ['m_date', 'com_name', 'work_process', 'worker_name', 'common_name', 'sample_id', 'vol_l', 'conc_raw', 'desorb_vol', 'dilution_factor', 'blank1_conc', 'blank2_conc', 'lod_row', 'unit', 'twa_limit', 'compensated_tlv', 'result_val', 'work_hour', 'status', 'eval'];
const DEFAULT_COLS_GC = ['m_date', 'com_name', 'work_process', 'worker_name', 'common_name', 'sample_id', 'vol_l', 'sample_area', 'conc_raw', 'lod_row', 'loq_row', 'unit', 'twa_limit', 'compensated_tlv', 'result_val', 'work_hour', 'status', 'eval'];
const DEFAULT_COLS_EXT = ['m_date', 'com_name', 'work_process', 'worker_name', 'common_name', 'sample_id', 'unit', 'twa_limit', 'compensated_tlv', 'result_val', 'work_hour', 'status', 'eval'];

function getDefaultCols(mode) {
    if (mode === 'ICP') return DEFAULT_COLS_ICP;
    if (mode === '외부') return DEFAULT_COLS_EXT;
    return DEFAULT_COLS_GC;
}

// ── 컬럼 모드 판별 ─────────────────────────────────────────────────
function getMode(instrumentType) {
    if (instrumentType === 'ICP') return 'ICP';
    if (instrumentType === '외부의뢰') return '외부';
    return 'GC'; // GC, UV, 중량분석 등 기본
}

// ── 결과 계산 함수 ─────────────────────────────────────────────────
function calcResult(row, protocol, mode) {
    const conc = parseFloat(row.conc_raw) || 0;

    if (mode === '외부') return { result_mg_m3: row.result_mg_m3 || 0, result_ppm: row.result_ppm || 0, display: null };

    if (conc === 0) return { result_mg_m3: 0, result_ppm: 0, display: '불검출' };

    if (mode === 'ICP') {
        const blankAvg = ((parseFloat(row.blank1_conc) || 0) + (parseFloat(row.blank2_conc) || 0)) / 2;
        const netConc = conc - blankAvg;
        const lod = parseFloat(row.lod) || 0;
        if (lod > 0 && netConc < lod) return { result_mg_m3: 0, result_ppm: 0, display: '검출한계미만' };
        const desorb = parseFloat(row.desorb_vol) || 1;
        const dil = parseFloat(row.dilution_factor) || 1;
        const oxCorr = parseFloat(protocol.oxidation_corr) || 1;
        const recovery = (parseFloat(protocol.recovery_rate) || 100) / 100;
        const volL = parseFloat(row.vol_l) || parseFloat(row.vol_m3) * 1000 || 1;
        // (농도 × 희석액 × 희석배수 × 산화보정) / (회수율 × 채기량L) → µg/L → mg/m³ (*1000/1000=*1)
        const mg_m3 = (netConc * desorb * dil * oxCorr) / (recovery * volL);
        return { result_mg_m3: mg_m3, result_ppm: 0, display: null };
    }

    // GC/UV: mg = (Area / Slope / (R/100)) × TotalVol
    if (mode === 'GC') {
        const area = parseFloat(row.sample_area) || 0;
        const slope = parseFloat(protocol.slope) || 0;
        const R = (parseFloat(protocol.desorptionRate) || 100) / 100;
        const totalVol = (parseFloat(protocol.mixing_ratio) || 0) + (parseFloat(protocol.desorption_vol) || 0);
        if (slope === 0) return { result_mg_m3: 0, result_ppm: 0, display: null };
        const mg = (area / slope / R) * totalVol;
        const lod = parseFloat(row.lod) || 0;
        const loq = lod * 3.3;
        if (loq > 0 && mg < loq) return { result_mg_m3: 0, result_ppm: 0, display: '불검출' };
        const volM3 = parseFloat(row.vol_m3) || 0;
        const mg_m3 = volM3 > 0 ? mg / volM3 : 0;
        const mw = parseFloat(protocol.mol_weight || row.hazard_info?.mol_weight) || 0;
        const ppm = mw > 0 ? (mg_m3 * 24.45) / mw : 0;
        return { result_mg_m3: mg_m3, result_ppm: ppm, display: null };
    }
    return { result_mg_m3: 0, result_ppm: 0, display: null };
}

function evalRow(res, protocol, row, mode) {
    const isPpm = mode === 'ICP' ? false : (protocol.twa_ppm || row.hazard_info?.twa_ppm ? true : false);
    const val = isPpm ? res.result_ppm : res.result_mg_m3;
    const tlv = isPpm ? (protocol.twa_ppm || row.hazard_info?.twa_ppm || 0) : (protocol.twa_mg || row.hazard_info?.twa_mg || 0);
    if (!tlv || val === 0) return '미만';
    // 노출기준 보정
    const corrTLV = tlv * (8 / (parseFloat(row.work_hour) || 8));
    return val > corrTLV ? '초과' : '미만';
}

const EVAL_COLOR = { '초과': 'text-red-600 font-black', '미만': 'text-emerald-600 font-bold', '불검출': 'text-slate-400 font-bold', '검출한계미만': 'text-blue-500 font-bold', '-': 'text-slate-300' };

// ── 공유저장 키 생성 ───────────────────────────────────────────────
function sharedKey(params) {
    return `analysis_shared_${params.hazard}_${params.startDate}_${params.endDate}`;
}

const DB_SETTINGS_KEY = 'analysis_grid_column_config_v1';

export default function AnalysisGrid({ supabase, rows, setRows, protocol, instrumentType, startDate, endDate, filterHazard, onRefresh, loading }) {
    const mode = getMode(instrumentType);

    // 동적 컬럼 설정
    const [colConfig, setColConfig] = useState(() => {
        try { const s = localStorage.getItem('KIWE_ANALYSIS_GRID_COLS_V3'); return s ? JSON.parse(s) : getDefaultCols(mode); } catch { return getDefaultCols(mode); }
    });
    const [showSettings, setShowSettings] = useState(false);
    const [settingsSaveStatus, setSettingsSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
    const [selectedIds, setSelectedIds] = useState([]);
    const [saving, setSaving] = useState(false);
    const [cloudSyncing, setCloudSyncing] = useState(false);

    // 기기모드 바뀌면 컬럼 기본값 초기화
    useEffect(() => {
        setColConfig(getDefaultCols(mode));
        setSelectedIds([]);
    }, [mode]);

    // DB에서 공유 컬럼 설정 로드
    useEffect(() => {
        const fetchColConfig = async () => {
            try {
                const { data, error } = await supabase.from('kiwe_app_settings').select('value').eq('key', DB_SETTINGS_KEY).single();
                if (error || !data) return;
                const parsed = data.value;
                if (parsed && typeof parsed === 'object') {
                    setColConfig(parsed[mode] || getDefaultCols(mode));
                }
            } catch (err) { console.warn('컬럼 설정 로드 실패:', err); }
        };
        fetchColConfig();
    }, [mode]);

    useEffect(() => { localStorage.setItem('KIWE_ANALYSIS_GRID_COLS_V3', JSON.stringify(colConfig)); }, [colConfig]);

    // 컬럼 보조 넓이 상태
    const [colWidths, setColWidths] = useState(() => {
        try { const s = localStorage.getItem('KIWE_ANALYSIS_GRID_WIDTHS'); return s ? JSON.parse(s) : {}; } catch { return {}; }
    });
    useEffect(() => { localStorage.setItem('KIWE_ANALYSIS_GRID_WIDTHS', JSON.stringify(colWidths)); }, [colWidths]);

    const handleResize = (id, width) => {
        setColWidths(prev => ({ ...prev, [id]: width }));
    };

    // DB에 컬럼 설정 공유 저장
    const saveColConfigToDB = async () => {
        setSettingsSaveStatus('saving');
        try {
            const { data: existing } = await supabase.from('kiwe_app_settings').select('value').eq('key', DB_SETTINGS_KEY).single();
            const newValue = existing?.value || {};
            newValue[mode] = colConfig;

            const { error } = await supabase.from('kiwe_app_settings').upsert({
                key: DB_SETTINGS_KEY,
                value: newValue,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) throw error;
            setSettingsSaveStatus('saved');
            setTimeout(() => setSettingsSaveStatus(''), 2000);
        } catch (err) {
            console.error('컬럼 설정 저장 실패:', err);
            setSettingsSaveStatus('error');
            setTimeout(() => setSettingsSaveStatus(''), 2000);
        }
    };

    // 각 행의 계산 결과를 메모화
    const computed = useMemo(() =>
        rows.map(row => {
            const res = calcResult(row, protocol, mode);
            return { ...res, evalStr: evalRow(res, protocol, row, mode) };
        }), [rows, protocol, mode]);

    // 셀 값 변경
    const updateRow = useCallback((id, field, val) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    }, [setRows]);

    // 완료 상태 토글 (시료대장 연계)
    const toggleStatus = async (row) => {
        const isDone = row.status === 1 || row.status === '1';
        const nextStatus = isDone ? null : 1;
        const nextDate = isDone ? null : new Date().toISOString().slice(0, 10);

        // UI 즉시 반영
        setRows(prev => prev.map(r => r.sample_id === row.sample_id ? { ...r, status: nextStatus, completed_at: nextDate } : r));

        try {
            const dt = new Date(row.m_date);
            const tbl = `kiwe_sampling_${dt.getFullYear()}_${(dt.getMonth() + 1) <= 6 ? 1 : 2}`;
            await supabase.from(tbl).update({ status: nextStatus, completed_at: nextDate }).eq('sample_id', row.sample_id);
        } catch (err) {
            console.error('상태 업데이트 실패:', err);
            // 원복 (필요시)
        }
    };

    // DB 최종 저장
    async function dbSave() {
        if (selectedIds.length === 0) return alert('저장할 시료를 선택하세요.');
        if (mode === 'GC' && (!protocol.slope || protocol.slope === 0)) return alert('검량선(Slope) 값을 입력하세요.');
        setSaving(true);
        try {
            const toSave = rows.filter(r => selectedIds.includes(r.id));
            let ok = 0;
            for (const [i, row] of toSave.entries()) {
                const ri = rows.findIndex(r => r.id === row.id);
                const res = computed[ri] || {};
                const dateParts = (row.m_date || '').split('-');
                const yr = dateParts[0]; const hy = parseInt(dateParts[1]) <= 6 ? 1 : 2;
                const tbl = `kiwe_results_${yr}_${hy}`;
                const payload = {
                    sample_id: row.sample_id, com_name: row.com_name,
                    work_process: row.work_process || '', m_date: row.m_date,
                    common_name: row.common_name, instrument_type: instrumentType || mode,
                    volume_m3: row.vol_m3, molecular_weight: protocol.mol_weight || row.hazard_info?.mol_weight,
                    tlv: protocol.twa_mg || row.hazard_info?.twa_mg, specific_gravity: protocol.sg || row.hazard_info?.sg,
                    standard_slope: protocol.slope || 0, standard_r2: protocol.r2 || 0,
                    desorption_rate: protocol.desorptionRate || 100,
                    total_sample_volume: (protocol.mixing_ratio || 0) + (protocol.desorption_vol || 0),
                    sample_area: row.sample_area || 0,
                    conc_raw: row.conc_raw || 0, desorb_vol: row.desorb_vol || 0,
                    dilution_factor: row.dilution_factor || 1,
                    oxidation_corr: protocol.oxidation_corr || 1, recovery_rate: protocol.recovery_rate || 100,
                    blank1_conc: row.blank1_conc || 0, blank2_conc: row.blank2_conc || 0,
                    lod: row.lod || 0, loq: (parseFloat(row.lod) || 0) * 3.3,
                    result_mg_m3: res.result_mg_m3 || 0, result_ppm: res.result_ppm || 0,
                    result_display: res.display || '',
                    compensated_tlv: (payload.tlv || 0) * (8 / (parseFloat(row.work_hour) || 8)),
                    updated_at: new Date().toISOString()
                };
                const { error } = await supabase.from(tbl).upsert(payload, { onConflict: 'sample_id, common_name' });
                if (error) throw new Error(`${row.sample_id} 저장 실패: ` + error.message);
                ok++;
            }
            alert(`✅ ${ok}건 저장 완료!`);
        } catch (err) { alert(err.message); }
        finally { setSaving(false); }
    }

    // 컬럼 설정 UI
    const availableCols = ALL_COLS.filter(c => c.modes.includes(mode));
    const hiddenCols = availableCols.filter(c => !colConfig.includes(c.id));

    const moveCol = (idx, dir) => {
        const n = [...colConfig]; const t = n[idx + dir]; n[idx + dir] = n[idx]; n[idx] = t; setColConfig(n);
    };

    // 입력셀 렌더링
    function renderCell(row, colId, ri) {
        const res = computed[ri] || {};
        const numInput = (field, extra = '') => e('input', {
            type: 'number', value: row[field] ?? '',
            onChange: ev => updateRow(row.id, field, ev.target.value),
            className: `w-full text-right px-2 py-1 border border-indigo-200 rounded text-xs font-mono outline-none focus:border-indigo-500 bg-white ${extra}`
        });
        const strInput = (field, extra = '') => e('input', {
            type: 'text', value: row[field] ?? '',
            onChange: ev => updateRow(row.id, field, ev.target.value),
            className: `w-full text-center px-2 py-1 border border-indigo-200 rounded text-xs outline-none focus:border-indigo-500 bg-white ${extra}`
        });
        const roNum = (val, dec = 4) => e('span', { className: 'font-mono text-xs font-bold text-indigo-900 float-right' },
            typeof val === 'number' ? val.toFixed(dec) : (val || '-'));

        switch (colId) {
            case 'm_date': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-center font-mono text-xs text-slate-600' }, row.m_date);
            case 'com_name': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 font-bold text-slate-800 text-xs text-balance break-all' }, row.com_name);
            case 'common_name': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 font-bold text-violet-700 text-xs text-balance break-all' }, row.common_name);
            case 'sample_id': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 font-mono text-xs text-slate-600' }, row.sample_id);
            case 'work_process': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-slate-600 text-xs text-center' }, row.work_process || '-');
            case 'worker_name': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-slate-600 text-xs text-center' }, row.worker_name || '-');
            case 'work_hour': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-slate-600 text-xs text-center' }, row.work_hour || '8');
            case 'unit': {
                const isPpm = mode === 'ICP' ? false : (protocol.twa_ppm || row.hazard_info?.twa_ppm ? true : false);
                return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-center text-[10px] text-slate-400 font-bold' }, isPpm ? 'ppm' : 'mg/m³');
            }
            case 'twa_limit': {
                const isPpm = mode === 'ICP' ? false : (protocol.twa_ppm || row.hazard_info?.twa_ppm ? true : false);
                const val = isPpm ? (protocol.twa_ppm || row.hazard_info?.twa_ppm) : (protocol.twa_mg || row.hazard_info?.twa_mg);
                return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-slate-600 text-xs text-right' }, val || '-');
            }
            case 'compensated_tlv': {
                const isPpm = mode === 'ICP' ? false : (protocol.twa_ppm || row.hazard_info?.twa_ppm ? true : false);
                const tlv = isPpm ? (protocol.twa_ppm || row.hazard_info?.twa_ppm || 0) : (protocol.twa_mg || row.hazard_info?.twa_mg || 0);
                if (!tlv) return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-slate-400 text-xs text-right' }, '-');
                const corrTLV = tlv * (8 / (parseFloat(row.work_hour) || 8));
                return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-indigo-600 font-bold text-xs text-right' }, corrTLV.toFixed(3));
            }
            case 'result_val': {
                const isPpm = mode === 'ICP' ? false : (protocol.twa_ppm || row.hazard_info?.twa_ppm ? true : false);
                const val = isPpm ? res.result_ppm : res.result_mg_m3;
                if (mode === '외부') return e('td', { className: 'px-2 py-1 border-r border-indigo-100 bg-indigo-50/30' }, numInput(isPpm ? 'result_ppm' : 'result_mg_m3'));
                return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-right' },
                    res.display ? e('span', { className: 'text-xs font-black text-blue-500' }, res.display) : roNum(val));
            }
            case 'status': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-center' },
                e('input', {
                    type: 'checkbox', checked: row.status === 1 || row.status === '1',
                    onChange: () => toggleStatus(row),
                    className: 'w-4 h-4 accent-violet-600 cursor-pointer'
                })
            );
            case 'completed_at': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-slate-600 text-[10px] text-center' }, row.completed_at || '-');
            case 'vol_l': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-right font-mono text-xs' }, ((row.vol_m3 || 0) * 1000).toFixed(2));
            case 'sample_area': return e('td', { className: 'px-2 py-1 border-r border-indigo-100 bg-indigo-50/30' }, numInput('sample_area'));
            case 'conc_raw': return e('td', { className: 'px-2 py-1 border-r border-indigo-100 bg-indigo-50/30' }, numInput('conc_raw'));
            case 'desorb_vol': return e('td', { className: 'px-2 py-1 border-r border-indigo-100 bg-indigo-50/30' }, numInput('desorb_vol'));
            case 'dilution_factor': return e('td', { className: 'px-2 py-1 border-r border-indigo-100 bg-indigo-50/30' }, numInput('dilution_factor'));
            case 'blank1_conc': return e('td', { className: 'px-2 py-1 border-r border-slate-100 bg-amber-50/30' }, numInput('blank1_conc'));
            case 'blank2_conc': return e('td', { className: 'px-2 py-1 border-r border-slate-100 bg-amber-50/30' }, numInput('blank2_conc'));
            case 'lod_row': return e('td', { className: 'px-2 py-1 border-r border-slate-100 bg-orange-50/30' }, numInput('lod'));
            case 'loq_row': return e('td', { className: 'px-3 py-1.5 border-r border-slate-100 text-right text-[10px] text-red-400 font-mono' }, typeof row.lod !== 'undefined' ? (parseFloat(row.lod) * 3.3).toFixed(6) : '-');
            case 'eval':
                return e('td', { className: `px-3 py-1.5 text-center text-xs ${EVAL_COLOR[res.evalStr] || ''}` }, res.evalStr);
            default: return e('td', null, '');
        }
    }

    const visibleCols = colConfig.filter(id => ALL_COLS.find(c => c.id === id && c.modes.includes(mode)));

    return e('div', { className: 'flex-1 flex flex-col bg-slate-50 min-w-0' },
        // 툴바
        e('div', { className: 'bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-sm' },
            e('div', { className: 'flex items-center gap-2 flex-wrap' },
                e('div', { className: 'text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg' }, `${rows.length}건`),
                e('div', { className: 'w-px h-5 bg-slate-300' }),
                e('button', {
                    onClick: () => setShowSettings(!showSettings),
                    className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${showSettings ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`
                },
                    e(Settings2, { size: 13 }), '컬럼')
            ),
            e('div', { className: 'flex items-center gap-2' },
                selectedIds.length > 0 && e('span', { className: 'text-xs text-slate-500 font-bold' }, `${selectedIds.length}건 선택`),
                e('button', {
                    onClick: dbSave, disabled: saving || selectedIds.length === 0,
                    className: `flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition-all ${saving || selectedIds.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}`
                },
                    e(Save, { size: 14 }), saving ? '저장 중...' : 'DB 최종저장')
            )
        ),
        // 컬럼 설정 패널
        showSettings && e('div', { className: 'bg-white border-b border-slate-200 p-3 shrink-0 shadow-sm' },
            e('div', { className: 'flex justify-between items-center mb-2' },
                e('div', { className: 'flex items-center gap-2' },
                    e('span', { className: 'text-xs font-black text-slate-700' }, '표시 컬럼 설정'),
                    e('button', { onClick: () => setColConfig(getDefaultCols(mode)), className: 'text-[10px] text-slate-500 border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-50' }, '초기화'),
                    e('button', {
                        onClick: saveColConfigToDB,
                        disabled: settingsSaveStatus === 'saving',
                        className: `text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${settingsSaveStatus === 'saved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100'}`
                    }, settingsSaveStatus === 'saving' ? '저장중...' : settingsSaveStatus === 'saved' ? '공유완료 ✓' : '설정 DB공유저장'),
                ),
                e('button', { onClick: () => setShowSettings(false) }, e(X, { size: 14, className: 'text-slate-400' }))
            ),
            e('div', { className: 'flex flex-wrap gap-1.5 mb-2' },
                colConfig.map((id, idx) => {
                    const c = ALL_COLS.find(x => x.id === id);
                    if (!c || !c.modes.includes(mode)) return null;
                    return e('div', { key: id, className: 'flex items-center bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-700 gap-1' },
                        e('button', { onClick: () => idx > 0 && moveCol(idx, -1), disabled: idx === 0, className: `${idx === 0 ? 'opacity-20' : 'hover:bg-slate-200'} rounded p-0.5` }, e(ChevronLeft, { size: 10 })),
                        e('span', null, c.label),
                        e('button', { onClick: () => idx < colConfig.length - 1 && moveCol(idx, 1), disabled: idx === colConfig.length - 1, className: `${idx === colConfig.length - 1 ? 'opacity-20' : 'hover:bg-slate-200'} rounded p-0.5` }, e(ChevronRight, { size: 10 })),
                        e('button', { onClick: () => setColConfig(colConfig.filter(x => x !== id)), className: 'hover:text-red-500' }, e(X, { size: 10 }))
                    );
                })
            ),
            hiddenCols.length > 0 && e('div', { className: 'flex flex-wrap gap-1.5 pt-2 border-t border-slate-100' },
                e('span', { className: 'text-[9px] text-slate-400 font-bold self-center' }, '숨김:'),
                hiddenCols.map(c => e('button', {
                    key: c.id, onClick: () => setColConfig([...colConfig, c.id]),
                    className: 'text-[10px] px-2 py-0.5 rounded border border-dashed border-slate-300 text-slate-500 hover:border-violet-400 hover:text-violet-600'
                }, '+ ' + c.label))
            )
        ),
        // 데이터 그리드
        e('div', { className: 'flex-1 overflow-auto p-3' },
            loading
                ? e('div', { className: 'flex items-center justify-center h-40 text-slate-400 text-sm font-bold' },
                    e('div', { className: 'w-6 h-6 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mr-3' }), '시료 조회 중...')
                : rows.length === 0
                    ? e('div', { className: 'flex flex-col items-center justify-center h-40 text-slate-400' },
                        e('p', { className: 'font-bold' }, '상단에서 기간 설정 후 [조회]를 클릭하세요.'))
                    : e('div', { className: 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden' },
                        e('table', { className: 'w-full text-xs', style: { tableLayout: 'fixed', minWidth: '100%', wordBreak: 'break-word', whiteSpace: 'normal' } },
                            e('thead', { className: 'bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0 z-10' },
                                e('tr', null,
                                    e('th', { className: 'px-3 py-2 w-8 text-center' },
                                        e('input', {
                                            type: 'checkbox', onChange: ev => setSelectedIds(ev.target.checked ? rows.map(r => r.id) : []),
                                            checked: selectedIds.length === rows.length && rows.length > 0
                                        })
                                    ),
                                    visibleCols.map(id => {
                                        const c = ALL_COLS.find(x => x.id === id);
                                        if (!c) return null;
                                        const w = colWidths[id] || (c.id === 'com_name' ? 150 : 80);
                                        return e('th', {
                                            key: id,
                                            style: { width: w, minWidth: w },
                                            className: `px-3 py-2 font-black text-center border-r border-slate-200 relative group`
                                        },
                                            c.label,
                                            e('div', {
                                                className: 'absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-violet-400 group-hover:bg-slate-200 transition-colors',
                                                onMouseDown: (e) => {
                                                    const startX = e.pageX;
                                                    const startW = w;
                                                    const move = (me) => {
                                                        const diff = me.pageX - startX;
                                                        handleResize(id, Math.max(40, startW + diff));
                                                    };
                                                    const up = () => {
                                                        window.removeEventListener('mousemove', move);
                                                        window.removeEventListener('mouseup', up);
                                                    };
                                                    window.addEventListener('mousemove', move);
                                                    window.addEventListener('mouseup', up);
                                                }
                                            })
                                        );
                                    })
                                )
                            ),
                            e('tbody', { className: 'divide-y divide-slate-100' },
                                rows.map((row, ri) => {
                                    const sel = selectedIds.includes(row.id);
                                    return e('tr', { key: row.id, className: `hover:bg-slate-50/70 ${sel ? 'bg-violet-50/30' : ''}` },
                                        e('td', { className: 'px-3 py-1.5 text-center border-r border-slate-100' },
                                            e('input', {
                                                type: 'checkbox', className: 'w-3.5 h-3.5', checked: sel,
                                                onChange: () => setSelectedIds(p => sel ? p.filter(i => i !== row.id) : [...p, row.id])
                                            })
                                        ),
                                        visibleCols.map(id => React.cloneElement(renderCell(row, id, ri), { key: id }))
                                    );
                                })
                            )
                        )
                    )
        )
    );
}

// analysis_input.js - 분석결과 입력 컨트롤러 (프로토콜 + 그리드 조합)
// 시료 조회, 필터, 상태 관리를 담당하는 최상위 컴포넌트

import React, { useState, useEffect, useMemo, useCallback } from 'https://esm.sh/react@18.2.0';
import { Search } from 'https://esm.sh/lucide-react@0.263.1';
import AnalysisProtocol from './analysis_protocol.js';
import AnalysisGrid from './analysis_grid.js';

const e = React.createElement;

// 날짜 → 테이블명
const getTable = (d) => { if (!d) return null; const dt = new Date(d); return `kiwe_sampling_${dt.getFullYear()}_${(dt.getMonth() + 1) <= 6 ? 1 : 2}`; };
const getTables = (s, en) => { const ts = new Set(); let c = new Date(s); c.setDate(1); const stop = new Date(en); while (c <= stop) { const t = getTable(c.toISOString().slice(0, 10)); if (t) ts.add(t); c.setMonth(c.getMonth() + 1); } const et = getTable(en); if (et) ts.add(et); return Array.from(ts); };
const calcDuration = (s, en, l) => { try { const [h1, m1] = s.split(':').map(Number); const [h2, m2] = en.split(':').map(Number); let d = h2 * 60 + m2 - h1 * 60 - m1; if (d < 0) d += 1440; return Math.max(0, d - (parseInt(l) || 0)); } catch { return 0; } };

const BLANK_PROTOCOL = {
    hazardName: '', mol_weight: 0, twa_mg: 0, twa_ppm: 0, sg: 0, purity: 100,
    // GC/UV
    mixing_ratio: 1, desorption_vol: 1, desorptionRate: 100, slope: 0, r2: 0, lod: 0, loq: 0,
    // ICP
    oxidation_corr: 1, recovery_rate: 100,
};

const BLANK_STD_POINTS = [
    { id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }, { id: 3, x: 0, y: 0 },
    { id: 4, x: 0, y: 0 }, { id: 5, x: 0, y: 0 }, { id: 6, x: 0, y: 0 },
];

const BLANK_DESORB = Array.from({ length: 9 }, (_, i) => ({ no: i + 1, area: 0, rate: 100 }));

export default function AnalysisInput({
    supabase, activeTab, setActiveTab,
    startDate, setStartDate,
    endDate, setEndDate,
    filterCompany, setFilterCompany,
    filterHazard, setFilterHazard,
    rawRows, setRawRows,
    hazardMap, setHazardMap,
    protocol, setProtocol,
    stdPoints, setStdPoints,
    desorptionRates, setDesorptionRates,
    desorptionSpikeMass, setDesorptionSpikeMass,
    instrumentType,
    currentHazardInfo
}) {
    const [loading, setLoading] = useState(false);
    const [icpOnly, setIcpOnly] = useState(false);

    // 유해인자 변경시 프로토콜 물질정보 자동 로드
    useEffect(() => {
        if (currentHazardInfo) {
            setProtocol(p => ({
                ...p,
                hazardName: filterHazard,
                mol_weight: currentHazardInfo.mol_weight || 0,
                twa_mg: currentHazardInfo.twa_mg || 0,
                twa_ppm: currentHazardInfo.twa_ppm || 0,
                sg: currentHazardInfo.sg || 0,
                purity: currentHazardInfo.purity || 100,
            }));
        }
    }, [filterHazard, currentHazardInfo]);

    // 시료 조회
    async function fetchSamples() {
        setLoading(true);
        try {
            // 1. 유해인자 DB
            const { data: hData } = await supabase.from('kiwe_hazard').select('*');
            const hMap = {};
            hData?.forEach(h => { hMap[h.common_name] = h; });
            setHazardMap(hMap);

            // 2. 시료 데이터 (반기별 테이블)
            const tables = getTables(startDate, endDate);
            const results = await Promise.all(tables.map(t =>
                supabase.from(t).select('*').gte('m_date', startDate).lte('m_date', endDate)
            ));
            let sData = results.flatMap(r => r.data || []);

            // 3. 유량 데이터
            const { data: flowData } = await supabase.from('kiwe_flow').select('m_date,pump_no,total_avg').gte('m_date', startDate).lte('m_date', endDate);
            const flowMap = new Map();
            flowData?.forEach(f => flowMap.set(`${f.m_date}_${f.pump_no}`, parseFloat(f.total_avg) || 0));

            // 4. 가공 (중량분석 제외, 유해인자별 행 분리)
            const processed = [];
            const weightRx = /^(DB|D)\d{3}-/;
            sData.forEach(row => {
                if (row.sample_id && weightRx.test(row.sample_id)) return;
                const subs = (row.common_name || '').split('/').map(s => s.trim()).filter(Boolean);
                subs.forEach(sub => {
                    const hz = hMap[sub];
                    if (!hz || hz.instrument_name === '추출법') return;
                    const flow = flowMap.get(`${row.m_date}_${row.pump_no}`) || 0;
                    const dur = calcDuration(row.start_time, row.end_time, row.lunch_time);
                    const vol_m3 = (flow * dur) / 1000;
                    processed.push({
                        ...row,
                        id: `${row.id}_${sub}`,
                        common_name: sub,
                        hazard_info: hz,
                        vol_m3,
                        // ICP 입력 필드 초기화
                        conc_raw: 0, desorb_vol: 1, dilution_factor: 1,
                        blank1_conc: 0, blank2_conc: 0,
                        // GC 입력 필드
                        sample_area: 0,
                        result_mg_m3: 0, result_ppm: 0,
                        // 기존 상태 보존
                        status: row.status, completed_at: row.completed_at
                    });
                });
            });
            processed.sort((a, b) => {
                // 1순위: 사업장명 (가나다순)
                const comA = a.com_name || '';
                const comB = b.com_name || '';
                if (comA !== comB) return comA.localeCompare(comB, 'ko');

                // 2순위: 공시료 여부 (일반 시료 먼저, 공시료 나중에)
                const aIsBlank = !!(a.worker_name?.includes('공시료') || a.sample_id?.startsWith('DB') || a.sample_id?.startsWith('SB'));
                const bIsBlank = !!(b.worker_name?.includes('공시료') || b.sample_id?.startsWith('DB') || b.sample_id?.startsWith('SB'));
                if (aIsBlank !== bIsBlank) return aIsBlank ? 1 : -1;

                // 3순위: 시료번호
                return (a.sample_id || '').localeCompare(b.sample_id || '');
            });
            setRawRows(processed);
        } catch (err) { alert('조회 오류: ' + err.message); }
        finally { setLoading(false); }
    }

    const companies = useMemo(() => [...new Set(rawRows.map(r => r.com_name).filter(Boolean))].sort(), [rawRows]);
    const hazards = useMemo(() => {
        const base = filterCompany ? rawRows.filter(r => r.com_name === filterCompany) : rawRows;
        return [...new Set(base.map(r => r.common_name).filter(Boolean))].sort();
    }, [rawRows, filterCompany]);

    const filteredRows = useMemo(() => rawRows.filter(r => {
        if (filterCompany && r.com_name !== filterCompany) return false;
        if (filterHazard && r.common_name !== filterHazard) return false;
        if (icpOnly) {
            const method = (r.hazard_info?.analysis_method || '').toLowerCase();
            const inst = (r.hazard_info?.instrument_name || '').toLowerCase();
            if (!method.includes('icp') && !inst.includes('icp')) return false;
        }
        return true;
    }), [rawRows, filterCompany, filterHazard, icpOnly]);

    // 외부에서 행 데이터 갱신 (분석_grid의 입력 → 이쪽에서 보존)
    const handleSetRows = useCallback((updater) => {
        setRawRows(prev => {
            const display = prev.filter(r => {
                const mC = filterCompany ? r.com_name === filterCompany : true;
                const mH = filterHazard ? r.common_name === filterHazard : true;
                return mC && mH;
            });
            const nextDisplay = typeof updater === 'function' ? updater(display) : updater;
            const idMap = new Map(nextDisplay.map(r => [r.id, r]));
            return prev.map(r => idMap.has(r.id) ? idMap.get(r.id) : r);
        });
    }, [filterCompany, filterHazard]);

    const inputCls = 'border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-violet-400';

    if (activeTab === 'protocol') {
        return e(AnalysisProtocol, {
            instrumentType, hazardInfo: currentHazardInfo,
            protocol, setProtocol,
            stdPoints, setStdPoints,
            desorptionRates, setDesorptionRates,
            desorptionSpikeMass, setDesorptionSpikeMass,
        });
    }

    return e('div', { className: 'flex-1 flex flex-col min-w-0 overflow-hidden h-full' },
        // 조회 툴바
        e('div', { className: 'bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3 shrink-0 shadow-sm' },
            e('div', { className: 'flex flex-col gap-0.5' },
                e('span', { className: 'text-[9px] text-slate-400 font-bold uppercase' }, '측정기간'),
                e('div', { className: 'flex items-center gap-1' },
                    e('input', { type: 'date', value: startDate, onChange: ev => setStartDate(ev.target.value), className: inputCls }),
                    e('span', { className: 'text-slate-400 font-bold' }, '~'),
                    e('input', { type: 'date', value: endDate, onChange: ev => setEndDate(ev.target.value), className: inputCls }),
                )
            ),
            e('div', { className: 'flex flex-col gap-0.5' },
                e('span', { className: 'text-[9px] text-slate-400 font-bold uppercase' }, '사업장'),
                e('select', { value: filterCompany, onChange: ev => { setFilterCompany(ev.target.value); setFilterHazard(''); }, className: inputCls + ' min-w-[130px]' },
                    e('option', { value: '' }, '전체'),
                    companies.map(c => e('option', { key: c, value: c }, c))
                )
            ),
            e('div', { className: 'flex flex-col gap-0.5' },
                e('span', { className: 'text-[9px] text-slate-400 font-bold uppercase' }, '유해인자'),
                e('select', { value: filterHazard, onChange: ev => setFilterHazard(ev.target.value), className: inputCls + ' min-w-[130px]' },
                    e('option', { value: '' }, '전체'),
                    hazards.map(h => e('option', { key: h, value: h }, h))
                )
            ),
            instrumentType && e('div', { className: `px-3 py-1.5 rounded-lg text-xs font-black border ${instrumentType === 'ICP' ? 'bg-blue-100 text-blue-700 border-blue-200' : instrumentType === '외부의뢰' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-violet-100 text-violet-700 border-violet-200'}` },
                instrumentType
            ),
            e('button', {
                onClick: () => setIcpOnly(!icpOnly),
                className: `px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${icpOnly ? 'bg-blue-600 text-white border-blue-700 shadow-inner' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`
            }, 'ICP만 보기'),
            e('button', {
                onClick: fetchSamples, disabled: loading,
                className: 'flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 disabled:opacity-50 ml-auto'
            },
                e(Search, { size: 13 }), loading ? '조회중...' : '조회')
        ),
        // 그리드
        e(AnalysisGrid, {
            supabase, rows: filteredRows, setRows: handleSetRows,
            protocol, instrumentType: icpOnly ? 'ICP' : instrumentType,
            startDate, endDate, filterHazard,
            onRefresh: fetchSamples, loading,
        })
    );
}

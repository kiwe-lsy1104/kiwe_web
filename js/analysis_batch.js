// js/analysis_batch.js
// 상반기/하반기 중량분석·오일분석 결과 일괄 엑셀 출력

import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
import { supabase, checkAuth } from './config.js';

const e = React.createElement;

// ─── Utilities ────────────────────────────────────────
const calcDuration = (start, end, lunch) => {
    if (!start || !end) return 0;
    try {
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 1440;
        return Math.max(0, diff - (parseInt(lunch) || 0));
    } catch { return 0; }
};

const getRowFlowAvg = (r) => {
    if (!r) return 0;
    let preAvg = parseFloat(r.pre_flow_avg);
    let postAvg = parseFloat(r.post_flow_avg);
    if (isNaN(preAvg) || preAvg <= 0) {
        const vals = [r.pre_flow_1, r.pre_flow_2, r.pre_flow_3].map(parseFloat).filter(v => !isNaN(v) && v > 0);
        preAvg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    }
    if (isNaN(postAvg) || postAvg <= 0) {
        const vals = [r.post_flow_1, r.post_flow_2, r.post_flow_3].map(parseFloat).filter(v => !isNaN(v) && v > 0);
        postAvg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    }
    const hasPre = !isNaN(preAvg) && preAvg > 0;
    const hasPost = !isNaN(postAvg) && postAvg > 0;
    if (hasPre && hasPost) return +((preAvg + postAvg) / 2).toFixed(3);
    if (hasPre) return +preAvg.toFixed(3);
    if (hasPost) return +postAvg.toFixed(3);
    return 0;
};

const formatTime = (t) => {
    if (!t) return '-';
    const p = t.split(':');
    return p.length >= 2 ? `${p[0]}:${p[1]}` : t;
};

const fmt6 = (v) => (v === null || v === undefined || isNaN(v)) ? '-' : Number(v).toFixed(6);
const fmt3 = (v) => (v === null || v === undefined || isNaN(v)) ? '-' : Number(v).toFixed(3);

// chunk array
const chunkArr = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

// ─── Main App ────────────────────────────────────────
function App() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [half, setHalf] = useState(1); // 1=상반기, 2=하반기
    const [loading, setLoading] = useState(false);
    const [loadMsg, setLoadMsg] = useState('');
    const [weightRows, setWeightRows] = useState([]);
    const [oilRows, setOilRows] = useState([]);
    const [stats, setStats] = useState(null);
    const [activeTab, setActiveTab] = useState('weight');
    const [hasData, setHasData] = useState(false);

    const startDate = `${year}-${half === 1 ? '01-01' : '07-01'}`;
    const endDate   = `${year}-${half === 1 ? '06-30' : '12-31'}`;
    const tableName = `kiwe_sampling_${year}_${half}`;
    const halfLabel = half === 1 ? '상반기' : '하반기';
    const yearRange = half === 1 ? `${year}.01.01 ~ ${year}.06.30` : `${year}.07.01 ~ ${year}.12.31`;

    // ── Fetch All ──────────────────────────────────────
    const fetchAll = async () => {
        setLoading(true);
        setHasData(false);
        setWeightRows([]);
        setOilRows([]);
        setStats(null);

        try {
            // 1. 시료채취 데이터 전체 조회 (Supabase 1000건 기본 limit 해결을 위한 루프)
            setLoadMsg('시료 데이터 전체 조회 중...');
            let samplesRaw = [];
            let page = 0;
            const pageSize = 1000;
            while (true) {
                setLoadMsg(`시료 데이터 읽는 중... (${samplesRaw.length}건 수집됨)`);
                const { data: chunk, error: sErr } = await supabase
                    .from(tableName)
                    .select('*')
                    .gte('m_date', startDate)
                    .lte('m_date', endDate)
                    .order('m_date', { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (sErr) throw new Error(`시료 조회 오류: ${sErr.message}`);
                if (!chunk || chunk.length === 0) break;

                samplesRaw.push(...chunk);
                if (chunk.length < pageSize) break;
                page++;
            }

            if (samplesRaw.length === 0) {
                alert(`${year}년 ${halfLabel} 기간에 시료 데이터가 없습니다.`);
                setHasData(false);
                return;
            }

            // 2. kiwe_hazard 유해인자 마스터 전체 조회
            setLoadMsg('유해인자 마스터 정보 조회 중...');
            const { data: hazardData } = await supabase
                .from('kiwe_hazard')
                .select('*');

            const hazardMap = new Map((hazardData || []).map(h => [h.common_name, h]));

            // 3. 중량/무게 입력 데이터 전체 조회 (weight_data & weight_blank_data)
            setLoadMsg('저장된 중량/오일 분석 데이터 조회 중...');
            const wDataMap = new Map();

            // weight_data & weight_blank_data에서 전체 가져오기
            const fetchWeightTable = async (tName) => {
                let list = [];
                let p = 0;
                while (true) {
                    const { data: c, error: err } = await supabase
                        .from(tName)
                        .select('*')
                        .range(p * pageSize, (p + 1) * pageSize - 1);
                    if (err || !c || c.length === 0) break;
                    list.push(...c);
                    if (c.length < pageSize) break;
                    p++;
                }
                return list;
            };

            const [wResults, wbResults] = await Promise.all([
                fetchWeightTable('weight_data'),
                fetchWeightTable('weight_blank_data')
            ]);

            wResults.forEach(w => wDataMap.set(w.sample_id, { ...w, _table: 'weight_data' }));
            wbResults.forEach(w => wDataMap.set(w.sample_id, { ...w, _table: 'weight_blank_data' }));

            // 4. 분류 기준 정의
            // 오일분석:
            //  - common_name에 '금속가공유' 포함
            //  - 또는 kiwe_hazard의 hazard_category / instrument_name 에 '오일' 포함
            //  - 또는 weight_data / weight_blank_data의 hazard_category가 '오일분석'인 시료
            const isOilSample = (s) => {
                if (s.common_name && s.common_name.includes('금속가공유')) return true;
                const h = hazardMap.get(s.common_name);
                if (h) {
                    if (h.instrument_name && h.instrument_name.includes('오일')) return true;
                    if (h.hazard_category && h.hazard_category.includes('오일')) return true;
                }
                const wm = wDataMap.get(s.sample_id);
                if (wm && wm.hazard_category === '오일분석') return true;
                return false;
            };

            // 중량분석:
            //  - 오일분석이 아니고,
            //  - kiwe_hazard의 instrument_name === '중량분석' 이거나 hazard_category에 '중량' 포함
            //  - 또는 common_name에 '분진', '후연', '목재', '면', '곡물', '용접', '석면', '유리' 포함
            //  - 또는 sample_id가 'D'로 시작 (중량시료 채취기록대장 관례)
            //  - 또는 weight_data / weight_blank_data에 등록된 시료 (hazard_category !== '오일분석')
            const isWeightSample = (s) => {
                if (isOilSample(s)) return false;

                const h = hazardMap.get(s.common_name);
                if (h) {
                    if (h.instrument_name && (h.instrument_name.includes('중량') || h.instrument_name.includes('광산란'))) return true;
                    if (h.hazard_category && h.hazard_category.includes('중량')) return true;
                }

                if (s.common_name && (
                    s.common_name.includes('분진') ||
                    s.common_name.includes('후연') ||
                    s.common_name.includes('목재') ||
                    s.common_name.includes('면분진') ||
                    s.common_name.includes('곡물') ||
                    s.common_name.includes('용접') ||
                    s.common_name.includes('석면') ||
                    s.common_name.includes('유리')
                )) return true;

                if (s.sample_id && s.sample_id.toUpperCase().startsWith('D')) return true;

                const wm = wDataMap.get(s.sample_id);
                if (wm && wm.hazard_category !== '오일분석') return true;

                return false;
            };

            const weightSamples = samplesRaw.filter(isWeightSample);
            const oilSamples    = samplesRaw.filter(isOilSample);

            // 5. 유량 데이터 전체 조회 (kiwe_flow)
            setLoadMsg('유량 데이터 조회 중...');
            const allDates = [...new Set(samplesRaw.map(s => s.m_date).filter(Boolean))];
            const flowMap = new Map();

            if (allDates.length > 0) {
                const dChunks = chunkArr(allDates, 200);
                const fResults = await Promise.all(
                    dChunks.map(dates =>
                        supabase.from('kiwe_flow')
                            .select('m_date, pump_no, total_avg')
                            .in('m_date', dates)
                    )
                );
                fResults.flatMap(r => r.data || []).forEach(f => {
                    if (f.m_date && f.pump_no && parseFloat(f.total_avg) > 0)
                        flowMap.set(`${f.m_date}_${f.pump_no}`, parseFloat(f.total_avg));
                });
            }
            // 시료 데이터 자체의 인라인 유량 값 반영
            samplesRaw.forEach(r => {
                const avg = getRowFlowAvg(r);
                if (avg > 0 && r.m_date && r.pump_no)
                    flowMap.set(`${r.m_date}_${r.pump_no}`, avg);
            });

            // 5. 처리 함수
            setLoadMsg('결과 계산 중...');
            const processSamples = (samples, isOil) => {
                // 기초 처리
                const processed = samples.map(s => {
                    const wm = wDataMap.get(s.sample_id) || {};
                    const flow = getRowFlowAvg(s) || flowMap.get(`${s.m_date}_${s.pump_no}`) || 0;
                    const duration = calcDuration(s.start_time, s.end_time, s.lunch_time);
                    const isBlank = !!(s.worker_name && s.worker_name.includes('공시료'));
                    const hazardInfo = hazardMap.get(s.common_name) || {};

                    // 1, 2, 3회치 무게 (g 단위)
                    const w1_1 = wm.w1_1 || 0;
                    const w1_2 = wm.w1_2 || 0;
                    const w1_3 = wm.w1_3 || 0;
                    const w2_1 = wm.w2_1 || 0;
                    const w2_2 = wm.w2_2 || 0;
                    const w2_3 = wm.w2_3 || 0;

                    const w1Vals = [w1_1, w1_2, w1_3];
                    const w2Vals = [w2_1, w2_2, w2_3];
                    const w1Valid = w1Vals.filter(v => v > 0);
                    const w2Valid = w2Vals.filter(v => v > 0);
                    const avg1 = w1Valid.length > 0 ? w1Valid.reduce((a, b) => a + b, 0) / w1Valid.length : 0; // g
                    const avg2 = w2Valid.length > 0 ? w2Valid.reduce((a, b) => a + b, 0) / w2Valid.length : 0; // g
                    const airVolume = flow * duration; // L

                    const samplingMedia = s.sampling_media || hazardInfo.sampling_media || '';
                    const analysisDate  = wm.analysis_date || '';
                    const reportDate    = wm.report_date || '';

                    return {
                        ...s,
                        flow,
                        duration,
                        isBlank,
                        samplingMedia,
                        analysisDate,
                        reportDate,
                        w1_1, w1_2, w1_3,
                        w2_1, w2_2, w2_3,
                        avg1,
                        avg2,
                        airVolume,
                        tlv: parseFloat(hazardInfo.twa_mg) || 0,
                        recovery_rate: wm.recovery_rate || 1.0,
                        analyst: wm.analyst || '',
                        hasWeight: w1Valid.length > 0 || w2Valid.length > 0,
                    };
                });

                // 6. 공시료 보정치(ΔB) 계산: 날짜 + 사업장 + 유해인자 그룹
                const blanks = processed.filter(s => s.isBlank);
                const deltaBMap = new Map();
                const blankGroups = {};
                blanks.forEach(b => {
                    const key = `${b.m_date}__${b.com_name}__${b.common_name}`;
                    if (!blankGroups[key]) blankGroups[key] = [];
                    blankGroups[key].push(b);
                });

                Object.entries(blankGroups).forEach(([key, bList]) => {
                    let sumBefore = 0, sumAfter = 0, cnt = bList.length || 1;
                    bList.forEach(b => {
                        sumBefore += b.avg1; // g
                        sumAfter  += b.avg2; // g
                    });
                    // 중량분석: ΔB = (채취후평균 - 채취전평균) * 1000  [mg]
                    // 오일분석: ΔB = (추출전평균 - 추출후평균) * 1000   [mg]
                    const deltaB = isOil
                        ? ((sumBefore / cnt) - (sumAfter / cnt)) * 1000
                        : ((sumAfter  / cnt) - (sumBefore / cnt)) * 1000;
                    deltaBMap.set(key, deltaB);
                });

                // 7. 최종 계산
                const finalRows = processed.map(s => {
                    const key = `${s.m_date}__${s.com_name}__${s.common_name}`;
                    const deltaB = deltaBMap.get(key) || 0;

                    // 분석량 계산 (mg)
                    let analysisAmount = 0;
                    if (isOil) {
                        // 오일: (추출전 - 추출후) * 1000 - ΔB
                        analysisAmount = ((s.avg1 - s.avg2) * 1000) - deltaB;
                    } else {
                        // 중량: (채취후 - 채취전) * 1000 - ΔB
                        analysisAmount = ((s.avg2 - s.avg1) * 1000) - deltaB;
                    }

                    const volM3 = s.airVolume / 1000; // m³
                    const recRate = parseFloat(s.recovery_rate) || 1.0;
                    const conc = isOil
                        ? (volM3 > 0 && recRate > 0 ? analysisAmount / (volM3 * recRate) : 0)
                        : (volM3 > 0 ? analysisAmount / volM3 : 0);

                    const corrTLV = s.tlv > 0 ? s.tlv * (8 / (s.work_hour || 8)) : 0;
                    const exceed  = corrTLV > 0 && !s.isBlank && conc > corrTLV;

                    return { ...s, deltaB, analysisAmount, volM3, conc, corrTLV, exceed };
                });

                // 정렬: 측정일 → 사업장명 → 유해인자 → 공시료 마지막 → 시료번호
                finalRows.sort((a, b) => {
                    const d = a.m_date.localeCompare(b.m_date);           if (d) return d;
                    const c = a.com_name.localeCompare(b.com_name);       if (c) return c;
                    const h = a.common_name.localeCompare(b.common_name); if (h) return h;
                    if (a.isBlank !== b.isBlank) return a.isBlank ? 1 : -1;
                    return a.sample_id.localeCompare(b.sample_id);
                });

                return finalRows;
            };

            const wRows = processSamples(weightSamples, false);
            const oRows = processSamples(oilSamples, true);

            setWeightRows(wRows);
            setOilRows(oRows);
            setHasData(true);
            setStats({
                total: samplesRaw.length,
                companies: [...new Set(samplesRaw.map(s => s.com_name).filter(Boolean))].length,
                weightMain:  wRows.filter(r => !r.isBlank).length,
                weightBlank: wRows.filter(r =>  r.isBlank).length,
                oilMain:     oRows.filter(r => !r.isBlank).length,
                oilBlank:    oRows.filter(r =>  r.isBlank).length,
            });
            setActiveTab(wRows.length > 0 ? 'weight' : 'oil');

        } catch (err) {
            console.error(err);
            alert('데이터 조회 중 오류:\n' + err.message);
        } finally {
            setLoading(false);
            setLoadMsg('');
        }
    };

    // ── TLV 포맷 헬퍼 (정수는 정수로, 소수점은 소수점으로) ──
    const formatTLV = (v) => {
        if (v === null || v === undefined || isNaN(v) || v <= 0) return '';
        const n = Number(v);
        return Number.isInteger(n) ? n : parseFloat(n.toFixed(4));
    };

    // ── Excel Export ───────────────────────────────────
    const downloadExcel = () => {
        const XLSX = window.XLSX;
        if (!XLSX) { alert('SheetJS 라이브러리가 로드되지 않았습니다.'); return; }
        if (!hasData || (weightRows.length === 0 && oilRows.length === 0)) {
            alert('다운로드할 데이터가 없습니다. 먼저 조회하세요.'); return;
        }

        const wb = XLSX.utils.book_new();

        const buildHeader = (isOil) => isOil
            ? ['측정일', '분석일자', '통보일자', '사업장명', '작업공정', '시료번호', '구분', '근로자명', '유해인자', '측정매체',
               '측정자', '분석자', '시작시간', '종료시간', '측정시간(분)',
               '평균유량(L/min)', '채기량(L)',
               '추출전(1회)', '추출전(2회)', '추출전(3회)', '추출전평균(g)',
               '추출후(1회)', '추출후(2회)', '추출후(3회)', '추출후평균(g)',
               '공시료보정치(g)', '분석량(mg)', '회수율', '농도(mg/m³)', 'TLV(mg/m³)', '판정']
            : ['측정일', '분석일자', '통보일자', '사업장명', '작업공정', '시료번호', '구분', '근로자명', '유해인자', '측정매체',
               '측정자', '분석자', '시작시간', '종료시간', '측정시간(분)',
               '평균유량(L/min)', '채기량(L)',
               '채취전(1회)', '채취전(2회)', '채취전(3회)', '채취전평균(g)',
               '채취후(1회)', '채취후(2회)', '채취후(3회)', '채취후평균(g)',
               '공시료보정치(g)', '분석량(mg)', '농도(mg/m³)', 'TLV(mg/m³)', '판정'];

        const buildRows = (rows, isOil) => rows.map(s => {
            const isBlankLabel = s.isBlank ? '공시료' : '시료';
            const judgment = s.isBlank ? '-' : (s.corrTLV > 0 ? (s.exceed ? '초과' : '적합') : '-');
            const base = [
                s.m_date || '',
                s.analysisDate || '',
                s.reportDate || '',
                s.com_name || '',
                s.work_process || '',
                s.sample_id || '',
                isBlankLabel,
                s.worker_name || '',
                s.common_name || '',
                s.samplingMedia || '',
                s.measured_by || '',
                s.analyst || '',
                formatTime(s.start_time),
                formatTime(s.end_time),
                s.duration || 0,
                s.flow > 0 ? parseFloat(s.flow.toFixed(3)) : 0,
                s.airVolume > 0 ? parseFloat(s.airVolume.toFixed(3)) : 0,

                // 3회치 전 무게
                s.w1_1 > 0 ? parseFloat(s.w1_1.toFixed(6)) : '',
                s.w1_2 > 0 ? parseFloat(s.w1_2.toFixed(6)) : '',
                s.w1_3 > 0 ? parseFloat(s.w1_3.toFixed(6)) : '',
                s.avg1 > 0 ? parseFloat(s.avg1.toFixed(6)) : 0,

                // 3회치 후 무게
                s.w2_1 > 0 ? parseFloat(s.w2_1.toFixed(6)) : '',
                s.w2_2 > 0 ? parseFloat(s.w2_2.toFixed(6)) : '',
                s.w2_3 > 0 ? parseFloat(s.w2_3.toFixed(6)) : '',
                s.avg2 > 0 ? parseFloat(s.avg2.toFixed(6)) : 0,

                parseFloat((s.deltaB / 1000).toFixed(6)),
                s.isBlank ? '' : parseFloat(s.analysisAmount.toFixed(6)),
            ];

            const tlvFormatted = formatTLV(s.corrTLV);

            if (isOil) {
                return [...base,
                    parseFloat((parseFloat(s.recovery_rate) || 1).toFixed(2)),
                    s.isBlank ? '' : parseFloat(s.conc.toFixed(6)),
                    tlvFormatted,
                    judgment
                ];
            } else {
                return [...base,
                    s.isBlank ? '' : parseFloat(s.conc.toFixed(6)),
                    tlvFormatted,
                    judgment
                ];
            }
        });

        const colWidths = (isOil) => isOil
            ? [12, 12, 12, 22, 16, 16, 7, 12, 18, 14, 8, 8, 8, 8, 10, 12, 10, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12, 8, 12, 10, 8].map(w => ({ wch: w }))
            : [12, 12, 12, 22, 16, 16, 7, 12, 18, 14, 8, 8, 8, 8, 10, 12, 10, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12, 12, 10, 8].map(w => ({ wch: w }));

        const addSheet = (rows, isOil, sheetName) => {
            if (rows.length === 0) return;
            const aoa = [buildHeader(isOil), ...buildRows(rows, isOil)];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = colWidths(isOil);

            // Header row style (행 높이)
            ws['!rows'] = [{ hpt: 22 }];

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        };

        addSheet(weightRows, false, '중량분석');
        addSheet(oilRows, true, '오일분석');

        if (wb.SheetNames.length === 0) {
            alert('중량분석/오일분석 데이터가 없어 엑셀을 생성할 수 없습니다.'); return;
        }

        const filename = `KiWE_분석결과_${year}년_${halfLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // ── Helpers ────────────────────────────────────────
    const previewRows = activeTab === 'weight' ? weightRows : oilRows;
    const isOilTab = activeTab === 'oil';

    const isGroupStart = (rows, idx) => {
        if (idx === 0) return false;
        return rows[idx - 1].m_date !== rows[idx].m_date ||
               rows[idx - 1].com_name !== rows[idx].com_name;
    };

    // ── Render ─────────────────────────────────────────
    return e('div', { style: { minHeight: '100vh', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' } },

        // ── Header ──
        e('div', { className: 'glass-card', style: { padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' } },
            e('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
                e('button', {
                    className: 'btn-secondary',
                    onClick: () => window.location.href = 'analysis_unified.html'
                }, '← 분석결과통보서'),
                e('div', null,
                    e('h1', { style: { fontSize: '1.25rem', fontWeight: 900, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' } },
                        '📊 반기 분석결과 일괄 출력'
                    ),
                    e('p', { style: { fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0' } },
                        '중량분석 · 오일분석 결과를 반기 단위로 일괄 조회하고 엑셀로 다운로드합니다'
                    )
                )
            ),
            e('div', { style: { textAlign: 'right' } },
                e('div', { style: { fontSize: '0.7rem', color: '#475569' } }, '현재 선택'),
                e('div', { style: { fontSize: '1.1rem', fontWeight: 900, color: '#818cf8' } }, `${year}년 ${halfLabel}`)
            )
        ),

        // ── Controls ──
        e('div', { className: 'glass-card', style: { padding: '20px' } },
            e('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '24px' } },

                // 연도 선택
                e('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    e('label', { style: { fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' } }, '연도'),
                    e('select', {
                        className: 'ui-select',
                        value: year,
                        onChange: ev => setYear(parseInt(ev.target.value))
                    },
                        [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y =>
                            e('option', { key: y, value: y }, `${y}년`)
                        )
                    )
                ),

                // 반기 선택 (pill)
                e('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    e('label', { style: { fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' } }, '반기'),
                    e('div', { className: 'half-pill' },
                        e('button', {
                            className: `half-pill-btn ${half === 1 ? 'active' : ''}`,
                            onClick: () => setHalf(1)
                        }, '상반기 (1 ~ 6월)'),
                        e('button', {
                            className: `half-pill-btn ${half === 2 ? 'active' : ''}`,
                            onClick: () => setHalf(2)
                        }, '하반기 (7 ~ 12월)')
                    )
                ),

                // 기간 표시
                e('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    e('label', { style: { fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' } }, '조회 기간'),
                    e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(30,41,59,0.6)', border: '1.5px solid #334155', borderRadius: '12px', padding: '10px 16px' } },
                        e('span', { style: { fontSize: '0.85rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#cbd5e1' } }, yearRange)
                    )
                ),

                // 버튼
                e('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '12px', marginLeft: 'auto' } },
                    e('button', {
                        className: 'btn-primary',
                        onClick: fetchAll,
                        disabled: loading,
                        style: { minWidth: '100px' }
                    },
                        loading
                            ? e('span', { className: 'spinner', style: { width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' } })
                            : '🔍',
                        loading ? (loadMsg || '조회 중...') : '조회'
                    ),
                    hasData && e('button', {
                        className: 'btn-excel',
                        onClick: downloadExcel,
                        style: { minWidth: '140px' }
                    }, '📥 엑셀 다운로드')
                )
            )
        ),

        // ── Stats Cards ──
        stats && e('div', { className: 'fade-in', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' } },
            [
                { label: '전체 조회 시료', value: stats.total,       icon: '🧪', color: '#e2e8f0' },
                { label: '참여 사업장',    value: `${stats.companies}개`, icon: '🏭', color: '#93c5fd' },
                { label: '중량 시료',      value: stats.weightMain,  icon: '⚖️', color: '#a5b4fc' },
                { label: '중량 공시료',    value: stats.weightBlank, icon: '⬜', color: '#64748b' },
                { label: '오일 시료',      value: stats.oilMain,     icon: '🛢️', color: '#fcd34d' },
                { label: '오일 공시료',    value: stats.oilBlank,    icon: '⬜', color: '#64748b' },
            ].map(({ label, value, icon, color }) =>
                e('div', { key: label, className: 'stat-card', style: { textAlign: 'center' } },
                    e('div', { style: { fontSize: '1.5rem', marginBottom: '4px' } }, icon),
                    e('div', { style: { fontSize: '1.6rem', fontWeight: 900, color } }, value),
                    e('div', { style: { fontSize: '0.68rem', color: '#64748b', marginTop: '4px' } }, label)
                )
            )
        ),

        // ── Preview Table ──
        hasData && e('div', { className: 'glass-card fade-in', style: { overflow: 'hidden' } },

            // Tab 헤더
            e('div', { style: { padding: '14px 16px', borderBottom: '1px solid rgba(51,65,85,0.5)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
                e('span', { style: { fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' } }, '📋 미리보기'),
                e('div', { style: { display: 'flex', gap: '8px' } },
                    weightRows.length > 0 && e('button', {
                        className: `tab-btn ${activeTab === 'weight' ? 'active-weight' : ''}`,
                        onClick: () => setActiveTab('weight')
                    }, `⚖️ 중량분석 (${weightRows.length}건)`),
                    oilRows.length > 0 && e('button', {
                        className: `tab-btn ${activeTab === 'oil' ? 'active-oil' : ''}`,
                        onClick: () => setActiveTab('oil')
                    }, `🛢️ 오일분석 (${oilRows.length}건)`)
                ),
                e('span', { style: { marginLeft: 'auto', fontSize: '0.68rem', color: '#475569' } },
                    '* 엑셀 다운로드 시 중량분석 / 오일분석 시트가 각각 포함됩니다'
                )
            ),

            // 테이블
            e('div', { style: { overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' } },
                previewRows.length === 0
                    ? e('div', { style: { padding: '48px', textAlign: 'center', color: '#475569' } },
                        e('div', { style: { fontSize: '2.5rem', marginBottom: '8px' } }, '📭'),
                        e('div', { style: { fontWeight: 700 } }, '해당 분류의 데이터가 없습니다')
                    )
                    : e('table', { className: 'preview-table' },
                        e('thead', null,
                            e('tr', null,
                                e('th', null, '측정일'),
                                e('th', null, '분석일자'),
                                e('th', null, '통보일자'),
                                e('th', null, '사업장'),
                                e('th', null, '작업공정'),
                                e('th', null, '시료번호'),
                                e('th', null, '구분'),
                                e('th', null, '근로자명'),
                                e('th', null, '유해인자'),
                                e('th', null, '측정매체'),
                                e('th', null, '측정자'),
                                e('th', null, '분석자'),
                                e('th', null, '측정(분)'),
                                e('th', null, '유량\n(L/min)'),
                                e('th', null, '채기량(L)'),

                                e('th', null, isOilTab ? '추출전(1)' : '채취전(1)'),
                                e('th', null, isOilTab ? '추출전(2)' : '채취전(2)'),
                                e('th', null, isOilTab ? '추출전(3)' : '채취전(3)'),
                                e('th', null, isOilTab ? '추출전평균(g)' : '채취전평균(g)'),

                                e('th', null, isOilTab ? '추출후(1)' : '채취후(1)'),
                                e('th', null, isOilTab ? '추출후(2)' : '채취후(2)'),
                                e('th', null, isOilTab ? '추출후(3)' : '채취후(3)'),
                                e('th', null, isOilTab ? '추출후평균(g)' : '채취후평균(g)'),

                                e('th', null, 'ΔB(g)'),
                                e('th', null, '분석량\n(mg)'),
                                ...(isOilTab ? [e('th', null, '회수율')] : []),
                                e('th', null, '농도\n(mg/m³)'),
                                e('th', null, 'TLV'),
                                e('th', null, '판정')
                            )
                        ),
                        e('tbody', null,
                            previewRows.map((s, i) => {
                                const groupStart = isGroupStart(previewRows, i);
                                const judgment = s.isBlank ? '-'
                                    : s.corrTLV > 0
                                        ? (s.exceed ? '초과' : '적합')
                                        : '-';
                                const rowClass = [
                                    s.isBlank ? 'row-blank' : '',
                                    !s.isBlank && s.exceed ? 'row-exceed' : '',
                                    groupStart ? 'group-start' : '',
                                ].filter(Boolean).join(' ');

                                const tlvDisp = formatTLV(s.corrTLV);

                                return e('tr', { key: `${s.sample_id}_${i}`, className: rowClass },
                                    e('td', null, s.m_date || '-'),
                                    e('td', null, s.analysisDate || '-'),
                                    e('td', null, s.reportDate || '-'),
                                    e('td', { style: { textAlign: 'left', paddingLeft: '8px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.com_name || '-'),
                                    e('td', { style: { textAlign: 'left', paddingLeft: '6px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.work_process || '-'),
                                    e('td', { style: { fontFamily: 'monospace', fontWeight: 700, color: '#e2e8f0' } }, s.sample_id || '-'),
                                    e('td', null, e('span', {
                                        className: `badge ${s.isBlank ? 'badge-blank' : isOilTab ? 'badge-oil' : 'badge-weight'}`
                                    }, s.isBlank ? '공시료' : '시료')),
                                    e('td', null, s.worker_name || '-'),
                                    e('td', { style: { textAlign: 'left', paddingLeft: '6px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.common_name || '-'),
                                    e('td', { style: { textAlign: 'left', paddingLeft: '6px', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.samplingMedia || '-'),
                                    e('td', null, s.measured_by || '-'),
                                    e('td', null, s.analyst || '-'),
                                    e('td', null, s.duration > 0 ? s.duration : '-'),
                                    e('td', { style: { fontFamily: 'monospace' } }, s.flow > 0 ? fmt3(s.flow) : '-'),
                                    e('td', { style: { fontFamily: 'monospace' } }, s.airVolume > 0 ? fmt3(s.airVolume) : '-'),

                                    // 1, 2, 3회치 전 무게
                                    e('td', { style: { fontFamily: 'monospace', color: '#64748b' } }, s.w1_1 > 0 ? fmt6(s.w1_1) : '-'),
                                    e('td', { style: { fontFamily: 'monospace', color: '#64748b' } }, s.w1_2 > 0 ? fmt6(s.w1_2) : '-'),
                                    e('td', { style: { fontFamily: 'monospace', color: '#64748b' } }, s.w1_3 > 0 ? fmt6(s.w1_3) : '-'),
                                    e('td', { style: { fontFamily: 'monospace', color: '#94a3b8', fontWeight: 700 } }, s.avg1 > 0 ? fmt6(s.avg1) : '-'),

                                    // 1, 2, 3회치 후 무게
                                    e('td', { style: { fontFamily: 'monospace', color: '#64748b' } }, s.w2_1 > 0 ? fmt6(s.w2_1) : '-'),
                                    e('td', { style: { fontFamily: 'monospace', color: '#64748b' } }, s.w2_2 > 0 ? fmt6(s.w2_2) : '-'),
                                    e('td', { style: { fontFamily: 'monospace', color: '#64748b' } }, s.w2_3 > 0 ? fmt6(s.w2_3) : '-'),
                                    e('td', { style: { fontFamily: 'monospace', color: '#94a3b8', fontWeight: 700 } }, s.avg2 > 0 ? fmt6(s.avg2) : '-'),

                                    e('td', { style: { fontFamily: 'monospace', color: '#64748b' } }, fmt6(s.deltaB / 1000)),
                                    e('td', { style: { fontFamily: 'monospace', fontWeight: 700, color: s.isBlank ? '#475569' : '#e2e8f0' } }, s.isBlank ? '-' : fmt6(s.analysisAmount)),
                                    ...(isOilTab ? [e('td', { style: { fontFamily: 'monospace' } }, fmt3(parseFloat(s.recovery_rate) || 1))] : []),
                                    e('td', {
                                        className: 'col-conc',
                                        style: {
                                            fontFamily: 'monospace', fontWeight: 700,
                                            color: s.isBlank ? '#374151' : s.exceed ? '#f87171' : '#34d399'
                                        }
                                    }, s.isBlank ? '-' : fmt6(s.conc)),
                                    e('td', { style: { fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 } }, tlvDisp !== '' ? tlvDisp : '-'),
                                    e('td', null,
                                        judgment === '초과'
                                            ? e('span', { style: { color: '#f87171', fontWeight: 900, fontSize: '0.72rem' } }, '초과')
                                            : judgment === '적합'
                                                ? e('span', { style: { color: '#34d399', fontWeight: 700, fontSize: '0.72rem' } }, '적합')
                                                : e('span', { style: { color: '#374151', fontSize: '0.72rem' } }, '-')
                                    )
                                );
                            })
                        )
                    )
            )
        ),

        // ── Empty state ──
        !hasData && !loading && e('div', { className: 'glass-card fade-in', style: { padding: '64px', textAlign: 'center' } },
            e('div', { style: { fontSize: '3.5rem', marginBottom: '12px' } }, '🔍'),
            e('div', { style: { fontSize: '1.1rem', fontWeight: 900, color: '#475569', marginBottom: '8px' } },
                '연도와 반기를 선택하고 조회하세요'
            ),
            e('div', { style: { fontSize: '0.8rem', color: '#334155' } },
                '해당 기간의 모든 사업장 중량분석 · 오일분석 결과를 한 번에 조회합니다'
            )
        ),

        // ── FAB Excel Button (when has data) ──
        hasData && e('div', {
            style: { position: 'fixed', bottom: '32px', right: '32px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 100 }
        },
            e('button', {
                className: 'btn-excel',
                onClick: downloadExcel,
                title: `${year}년 ${halfLabel} 엑셀 다운로드`,
                style: { borderRadius: '50px', padding: '14px 22px', fontSize: '0.9rem', fontWeight: 900, boxShadow: '0 8px 30px rgba(16,185,129,0.5)' }
            }, '📥 엑셀 다운로드')
        )
    );
}

// ─── Boot ─────────────────────────────────────────────
const user = checkAuth();
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App, null));

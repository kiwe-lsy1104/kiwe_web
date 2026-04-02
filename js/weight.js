// js/weight.js
import React, { useState, useEffect, useMemo, useRef } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
import {
    FlaskConical, Save, Search, Building2,
    Calendar, User, FileText, Beaker, Printer, Download, Plus, Trash2, CheckCircle2, AlertCircle, Table, X, ArrowLeft
} from 'https://esm.sh/lucide-react@0.263.1';
import { supabase, checkAuth } from './config.js';

const e = React.createElement;

// --- Utility Functions ---
const toGrams = (val) => {
    if (!val || val === '') return 0;
    const num = parseInt(val.toString().replace(/[^0-9]/g, ''));
    return isNaN(num) ? 0 : num / 1000000;
};

const formatGramString = (grams) => {
    if (!grams || grams === 0) return '-';
    return grams.toFixed(6) + 'g';
};

const formatLocalDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    return date.toISOString().split('T')[0];
};

const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return timeStr;
};

const formatDecimal = (val, digits) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return parseFloat(val.toFixed(digits)); // Removes trailing zeros
};

const formatWeight = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return val.toFixed(6); // Keeps trailing zeros
};

const calcDuration = (start, end, lunch) => {
    if (!start || !end) return 0;
    try {
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        const total1 = h1 * 60 + m1;
        const total2 = h2 * 60 + m2;
        let diff = total2 - total1;
        if (diff < 0) diff += 24 * 60;
        return Math.max(0, diff - (parseInt(lunch) || 0));
    } catch { return 0; }
};

// Sharding Logic
const getTableName = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const halfYear = (date.getMonth() + 1) <= 6 ? 1 : 2;
    return `kiwe_sampling_${date.getFullYear()}_${halfYear}`;
};

const getTargetTables = (start, end) => {
    if (!start || !end) return [];
    const tables = new Set();
    let curr = new Date(start);
    const stop = new Date(end);
    curr.setDate(1);
    while (curr <= stop) {
        const t = getTableName(curr.toISOString().split('T')[0]);
        if (t) tables.add(t);
        curr.setMonth(curr.getMonth() + 1);
    }
    const et = getTableName(end);
    if (et) tables.add(et);
    return Array.from(tables);
};

// --- Components ---

function WeightInput({ value, onChange, placeholder, className = "" }) {
    const [isFocused, setIsFocused] = useState(false);
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        if (!isFocused) {
            setDisplayValue(value ? (value / 1000000).toFixed(6) + 'g' : '');
        } else {
            setDisplayValue(value ? value.toString() : '');
        }
    }, [value, isFocused]);

    const handleLocalChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length <= 8) setDisplayValue(val);
    };

    return e('input', {
        className: `w-full text-center bg-transparent outline-none border-b border-transparent focus:border-indigo-500 transition-all font-mono ${className}`,
        value: displayValue,
        placeholder: isFocused ? '' : placeholder,
        onFocus: () => setIsFocused(true),
        onBlur: () => {
            setIsFocused(false);
            onChange(parseInt(displayValue) || 0);
        },
        onChange: handleLocalChange
    });
}

function VerificationModal({ isOpen, onClose, data, deltaB }) {
    if (!isOpen) return null;

    return e('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8" },
        e('div', { className: "bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden" },
            e('div', { className: "p-4 border-b flex justify-between items-center bg-slate-800 text-white" },
                e('h3', { className: "font-bold text-lg flex items-center gap-2" }, e(CheckCircle2, { size: 20 }), "데이터 입력 검증"),
                e('button', { onClick: onClose, className: "hover:bg-slate-700 p-1 rounded transition-colors" }, e(X, { size: 24 }))
            ),
            e('div', { className: "flex-1 overflow-auto p-0" },
                e('table', { className: "w-full text-xs text-left border-collapse" },
                    e('thead', { className: "bg-slate-100 sticky top-0 z-10 font-bold text-slate-700" },
                        e('tr', null,
                            e('th', { className: "p-3 border-b border-r" }, "시료번호"),
                            e('th', { className: "p-3 border-b border-r" }, "전평균(g)"),
                            e('th', { className: "p-3 border-b border-r" }, "후평균(g)"),
                            e('th', { className: "p-3 border-b border-r bg-indigo-50" }, "보정치(g)"),
                            e('th', { className: "p-3 border-b border-r font-bold text-indigo-600 bg-indigo-50" }, "분석량(mg)"),
                            e('th', { className: "p-3 border-b border-r" }, "유량(L/min)"),
                            e('th', { className: "p-3 border-b text-center" }, "입력확인")
                        )
                    ),
                    e('tbody', { className: "divide-y divide-slate-100" },
                        data.map(row => {
                            const avg1 = row.w1.filter(v => v > 0).reduce((a, b) => a + b, 0) / row.w1.length / 1000000 || 0;
                            const avg2 = row.w2.filter(v => v > 0).reduce((a, b) => a + b, 0) / row.w2.length / 1000000 || 0;
                            const amount = ((avg2 - avg1) * 1000) - deltaB;
                            const hasError = amount < 0;

                            return e('tr', { key: row.sample_id, className: hasError ? "bg-red-50" : "hover:bg-slate-50" },
                                e('td', { className: "p-3 font-mono font-bold border-r" }, row.sample_id),
                                e('td', { className: "p-3 font-mono border-r" }, avg1.toFixed(6)),
                                e('td', { className: "p-3 font-mono border-r" }, avg2.toFixed(6)),
                                e('td', { className: "p-3 font-mono border-r bg-indigo-50/30" }, (deltaB / 1000).toFixed(6)),
                                e('td', { className: "p-3 font-mono font-bold text-indigo-600 border-r bg-indigo-50/30" }, amount.toFixed(6)),
                                e('td', { className: "p-3 font-mono border-r" }, (row.flow || 0).toFixed(3)),
                                e('td', { className: "p-3 text-center" },
                                    hasError ?
                                        e('span', { className: "text-red-500 font-bold text-[10px]" }, "CHECK") :
                                        e('span', { className: "text-emerald-500 font-bold text-[10px]" }, "OK")
                                )
                            );
                        })
                    )
                )
            ),
            e('div', { className: "p-4 border-t bg-slate-50 text-right text-xs text-slate-500" },
                `* 본 화면은 중량 데이터와 보정치가 올바르게 반영되었는지 확인하는 용도입니다.`
            )
        )
    );
}

function PDFPreviewModal({ isOpen, onClose, pdfUrl }) {
    if (!isOpen || !pdfUrl) return null;

    return e('div', { className: "fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-8" },
        e('div', { className: "bg-white rounded-xl shadow-2xl w-full max-w-6xl h-full flex flex-col overflow-hidden" },
            e('div', { className: "p-4 border-b flex justify-between items-center bg-slate-800 text-white" },
                e('h3', { className: "font-bold text-lg flex items-center gap-2" }, e(FileText, { size: 20 }), "PDF 미리보기"),
                e('button', { onClick: onClose, className: "hover:bg-slate-700 p-1 rounded transition-colors" }, e(X, { size: 24 }))
            ),
            e('div', { className: "flex-1 bg-slate-100 p-4 flex justify-center overflow-hidden" },
                e('iframe', {
                    src: pdfUrl,
                    className: "w-full h-full rounded shadow-lg border-0",
                    title: "PDF Preview"
                })
            )
        )
    );
}

function App() {
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);

    // --- Meta ---
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1); return formatLocalDate(d);
    });
    const [endDate, setEndDate] = useState(formatLocalDate(new Date()));
    const [companyName, setCompanyName] = useState('');
    const [companies, setCompanies] = useState([]);

    // Header Inputs
    const [analyst, setAnalyst] = useState('');
    const [analysisDate, setAnalysisDate] = useState(formatLocalDate(new Date()));
    const [reportDate, setReportDate] = useState(formatLocalDate(new Date()));
    const [measurer, setMeasurer] = useState('');
    const [measureDate, setMeasureDate] = useState('');

    // --- State ---
    const [selectedHazard, setSelectedHazard] = useState('');
    const [hazardList, setHazardList] = useState([]);
    const [blankSamples, setBlankSamples] = useState([]);
    const [mainSamples, setMainSamples] = useState([]);
    const [tlvVal, setTlvVal] = useState(0);

    // --- Verify UI ---
    const [isVerifyOpen, setIsVerifyOpen] = useState(false);

    // --- PDF Preview State ---
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    const reportRef = useRef(null);

    // --- Calculations ---
    const deltaB = useMemo(() => {
        if (blankSamples.length === 0) return 0;
        let sumAfter = 0, sumBefore = 0;
        blankSamples.forEach(b => {
            const bAvg = b.w1.filter(v => v > 0).reduce((a, x) => a + x, 0) / b.w1.length || 0;
            const aAvg = b.w2.filter(v => v > 0).reduce((a, x) => a + x, 0) / b.w2.length || 0;
            sumBefore += bAvg;
            sumAfter += aAvg;
        });
        return (sumAfter / 1000000 - sumBefore / 1000000) * 1000;
    }, [blankSamples]);

    // --- Fetching ---
    useEffect(() => {
        const session = checkAuth();
        if (session) { setUser(session); setAnalyst(session.user_name); }
    }, []);

    useEffect(() => {
        if (startDate && endDate) fetchCompanies();
    }, [startDate, endDate]);

    const fetchCompanies = async () => {
        const tables = getTargetTables(startDate, endDate);
        const results = await Promise.all(tables.map(t =>
            // 조인이 불가능하므로 우선 기간 내 모든 시료의 com_name, common_name을 가져옴
            supabase.from(t).select('com_name, common_name').gte('m_date', startDate).lte('m_date', endDate).like('sample_id', 'D%')
        ));
        const allSamples = results.flatMap(r => r.data || []);

        // kiwe_hazard 테이블에서 중량분석(instrument_name)에 해당하는 물질명 조회
        const { data: hInfo } = await supabase.from('kiwe_hazard').select('common_name, instrument_name');
        const weightHazards = new Set((hInfo || []).filter(h => h.instrument_name === '중량분석').map(h => h.common_name));

        // 중량분석 물질을 포함하는 시료를 가진 사업장 필터링
        const filteredCompanies = allSamples.filter(s => weightHazards.has(s.common_name)).map(s => s.com_name);

        const names = [...new Set(filteredCompanies)].sort();
        setCompanies(names);
    };

    useEffect(() => {
        if (companyName && startDate && endDate) fetchHazards();
    }, [companyName, startDate, endDate]);

    const fetchHazards = async () => {
        const tables = getTargetTables(startDate, endDate);
        const results = await Promise.all(tables.map(t =>
            supabase.from(t).select('common_name').eq('com_name', companyName).gte('m_date', startDate).lte('m_date', endDate).like('sample_id', 'D%')
        ));
        const hNames = [...new Set(results.flatMap(r => r.data || []).map(d => d.common_name))].filter(Boolean);

        // ★ 필터 완화: 해당 사업장에서 측정된 모든 유해인자 표시 (hazard_category 제한 제거)
        // 단, kiwe_hazard에서 추가 정보(category) 연동하여 중량분석 우선 정렬
        const { data: hInfo } = await supabase.from('kiwe_hazard').select('common_name, hazard_category').in('common_name', hNames);
        const hMap = new Map((hInfo || []).map(h => [h.common_name, h.hazard_category]));

        // 중량분석 카테고리 우선으로 정렬, 나머지 알파벳 순
        const sorted = hNames.sort((a, b) => {
            const catA = hMap.get(a) || '';
            const catB = hMap.get(b) || '';
            if (catA === '중량분석' && catB !== '중량분석') return -1;
            if (catA !== '중량분석' && catB === '중량분석') return 1;
            return a.localeCompare(b);
        });

        setHazardList(sorted);
        // 새로운 목록이 나오면, 현재 선택된게 없거나 목록에 없으면 첫번째꺼 자동 선택
        if (sorted.length > 0) {
            if (!selectedHazard || !sorted.includes(selectedHazard)) {
                setSelectedHazard(sorted[0]);
            }
        } else {
            setSelectedHazard('');
        }
    };

    const loadData = async () => {
        if (!selectedHazard || !companyName) return;
        setLoading(true);
        try {
            const tables = getTargetTables(startDate, endDate);

            // 1. Fetch
            const sResults = await Promise.all(tables.map(t =>
                supabase.from(t).select('*')
                    .eq('com_name', companyName)
                    .eq('common_name', selectedHazard)
                    .gte('m_date', startDate)
                    .lte('m_date', endDate)
                    .like('sample_id', 'D%')
            ));
            const rawAll = sResults.flatMap(r => r.data || []);

            // 2. Flow
            const { data: flowData } = await supabase.from('kiwe_flow').select('m_date, pump_no, total_avg').gte('m_date', startDate).lte('m_date', endDate);
            const flowMap = new Map();
            flowData?.forEach(f => flowMap.set(`${f.m_date}_${f.pump_no}`, parseFloat(f.total_avg) || 0));

            // 3. TLV (Fetch twa_mg as per user request)
            const { data: hazardInfo } = await supabase.from('kiwe_hazard').select('common_name, twa_mg').eq('common_name', selectedHazard).maybeSingle();
            const _tlv = hazardInfo?.twa_mg || 0;
            setTlvVal(_tlv);

            // 4. Weight (Fetch from both weight_data and weight_blank_data)
            const sampleIds = rawAll.map(x => x.sample_id);
            const [wRes, wbRes] = await Promise.all([
                supabase.from('weight_data').select('*').in('sample_id', sampleIds),
                supabase.from('weight_blank_data').select('*').in('sample_id', sampleIds)
            ]);

            const wMap = new Map();
            (wRes.data || []).forEach(w => wMap.set(w.sample_id, w));
            (wbRes.data || []).forEach(w => wMap.set(w.sample_id, w));

            // Init Header Fields from data if available
            if (rawAll.length > 0) {
                setMeasureDate(rawAll[0].m_date || startDate);

                // Prioritize measured_by from kiwe_sampling
                if (rawAll[0].measured_by) {
                    setMeasurer(rawAll[0].measured_by);
                }

                const firstW = wMap.get(rawAll[0].sample_id);
                if (firstW) {
                    setAnalyst(firstW.analyst || analyst);
                    if (firstW.measurer) setMeasurer(firstW.measurer);
                    if (firstW.analysis_date) setAnalysisDate(firstW.analysis_date);
                    if (firstW.report_date) setReportDate(firstW.report_date);
                }
            }

            // 5. Process
            const processed = rawAll.map(s => {
                const wm = wMap.get(s.sample_id) || {};
                const flow = flowMap.get(`${s.m_date}_${s.pump_no}`) || 0;
                const duration = calcDuration(s.start_time, s.end_time, s.lunch_time);

                return {
                    ...s,
                    flow: flow,
                    duration: duration,
                    tlv: _tlv,
                    w1: [wm.w1_1 || 0, wm.w1_2 || 0, wm.w1_3 || 0].map(v => v * 1000000),
                    w2: [wm.w2_1 || 0, wm.w2_2 || 0, wm.w2_3 || 0].map(v => v * 1000000),
                };
            });

            const blanks = processed.filter(s => s.worker_name && s.worker_name.includes('공시료')).sort((a, b) => a.sample_id.localeCompare(b.sample_id));
            const main = processed.filter(s => !s.worker_name || !s.worker_name.includes('공시료')).sort((a, b) => a.sample_id.localeCompare(b.sample_id));

            setBlankSamples(blanks);
            setMainSamples(main);
        } finally {
            setLoading(false);
        }
    };

    const checkWeightDifference = (weights) => {
        const valid = weights.filter(v => typeof v === 'number' && v > 0);
        if (valid.length > 1) {
            const max = Math.max(...valid);
            const min = Math.min(...valid);
            return (max - min >= 100);
        }
        return false;
    };

    const updateWeight = (isBlank, idx, type, wIdx, val) => {
        if (isBlank) {
            const next = [...blankSamples];
            next[idx][type][wIdx] = val;
            setBlankSamples(next);
            if (type === 'w1' || type === 'w2') {
                // checkWeightDifference(next[idx][type], type === 'w1' ? '측정 전 무게' : '측정 후 무게');
            }
        } else {
            const next = [...mainSamples];
            next[idx][type][wIdx] = val;
            setMainSamples(next);
            if (type === 'w1' || type === 'w2') {
                // checkWeightDifference(next[idx][type], type === 'w1' ? '측정 전 무게' : '측정 후 무게');
            }
        }
    };

    const saveAll = async () => {
        setLoading(true);
        const projId = `${companyName}_${startDate}`;
        try {
            const blanks = blankSamples.map(s => ({
                project_id: projId,
                sample_id: s.sample_id,
                worker_name: s.worker_name,
                common_name: s.common_name,
                hazard_category: '중량분석',
                w1_1: s.w1[0] / 1000000, w1_2: s.w1[1] / 1000000, w1_3: s.w1[2] / 1000000,
                w2_1: s.w2[0] / 1000000, w2_2: s.w2[1] / 1000000, w2_3: s.w2[2] / 1000000,
                analyst, measurer, analysis_date: analysisDate, report_date: reportDate
            }));

            const mains = mainSamples.map(s => ({
                project_id: projId,
                sample_id: s.sample_id,
                worker_name: s.worker_name,
                common_name: s.common_name,
                hazard_category: '중량분석',
                w1_1: s.w1[0] / 1000000, w1_2: s.w1[1] / 1000000, w1_3: s.w1[2] / 1000000,
                w2_1: s.w2[0] / 1000000, w2_2: s.w2[1] / 1000000, w2_3: s.w2[2] / 1000000,
                analyst, measurer, analysis_date: analysisDate, report_date: reportDate
            }));

            // Parallel Upsert with Error Handling
            const results = await Promise.all([
                blanks.length > 0 ? supabase.from('weight_blank_data').upsert(blanks, { onConflict: 'sample_id' }) : Promise.resolve({ error: null }),
                mains.length > 0 ? supabase.from('weight_data').upsert(mains, { onConflict: 'sample_id' }) : Promise.resolve({ error: null })
            ]);

            const errors = results.filter(r => r.error).map(r => r.error.message);
            if (errors.length > 0) {
                throw new Error(errors.join(' / '));
            }

            alert('성공적으로 저장되었습니다.');
        } catch (e) {
            console.error('Save error:', e);
            alert('저장 중 오류가 발생했습니다: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Pagination Logic
    const ROWS_PER_PAGE = 10;
    const pages = useMemo(() => {
        if (mainSamples.length === 0) return [[]];
        const chunks = [];
        for (let i = 0; i < mainSamples.length; i += ROWS_PER_PAGE) {
            chunks.push(mainSamples.slice(i, i + ROWS_PER_PAGE).map((s, idx) => ({ ...s, globalIdx: i + idx })));
        }
        return chunks;
    }, [mainSamples]);

    const downloadPDF = () => {
        const element = reportRef.current;
        const opt = {
            margin: 0,
            filename: `중량분석보고서_${companyName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['css', 'legacy'] }
        };
        // Use output('bloburl') instead of window.open
        window.html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
            const blobUrl = pdf.output('bloburl');
            setPdfUrl(blobUrl);
            setShowPdfPreview(true);
        });
    };

    return e('div', { className: "min-h-screen bg-slate-100 p-8 flex flex-col items-center gap-8 no-scrollbar" },
        e('style', null, `
            /* STRICT Layout for PDF Engine */
            .report-wrapper table {
                table-layout: fixed !important;
                border-collapse: collapse !important;
                width: 100% !important;
                overflow: visible !important;
                border: 1px solid #1e293b !important;
            }
            .report-wrapper tr {
                height: 35px !important;
            }
            /* Cell defaults */
            .report-th, .report-td {
                display: table-cell !important;
                vertical-align: middle !important;
                text-align: center !important;
                padding: 4px 2px !important;
                border: 1px solid #1e293b !important;
                background-color: white !important;
                box-sizing: border-box !important;
                word-break: keep-all !important;
                white-space: pre-wrap !important;
                line-height: 1.1 !important;
                overflow: visible !important;
            }
            .report-th { 
                background-color: #f1f5f9 !important; 
                font-weight: bold; 
                font-size: 9.5px;
            }
            .report-td { 
                font-size: 10px; 
            }
 
            /* Alignment Wrapper - Kept for body inputs */
            .center-wrap {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                height: 100% !important;
                text-align: center !important;
            }

            @media print {
                .report-wrapper { padding: 10px !important; }
            }
        `),

        // Control Panel
        e('div', { className: "w-full max-w-[1200px] bg-white rounded-2xl shadow-xl p-6 no-print" },
            e('div', { className: "flex flex-wrap items-end gap-x-6 gap-y-4" },
                e('div', { className: "space-y-1 min-w-[300px]" },
                    e('label', { className: "text-xs font-bold text-slate-500" }, "측정 기간"),
                    e('div', { className: "flex gap-2" },
                        e('input', { type: "date", className: "input-control w-full", value: startDate, onChange: e => setStartDate(e.target.value) }),
                        e('input', { type: "date", className: "input-control w-full", value: endDate, onChange: e => setEndDate(e.target.value) })
                    )
                ),
                e('div', { className: "space-y-1 flex-1 min-w-[200px]" },
                    e('label', { className: "text-xs font-bold text-slate-500" }, "사업장 선택"),
                    e('select', { className: "input-control w-full", value: companyName, onChange: e => setCompanyName(e.target.value) },
                        e('option', { value: '' }, "사업장 선택"),
                        companies.map(c => e('option', { key: c, value: c }, c))
                    )
                ),
                e('div', { className: "space-y-1 min-w-[180px]" },
                    e('label', { className: "text-xs font-bold text-slate-500" }, "유해인자"),
                    e('select', { className: "input-control w-full", value: selectedHazard, onChange: e => setSelectedHazard(e.target.value) },
                        e('option', { value: '' }, "-- 유해인자 선택 --"),
                        hazardList.map(h => e('option', { key: h, value: h }, h))
                    )
                ),
                e('div', { className: "flex items-end gap-2 shrink-0 ml-auto" },
                    e('button', { onClick: () => window.location.href = 'sampling_manage.html', className: "btn-secondary px-6 h-[42px] justify-center bg-white border-slate-200 text-slate-600 hover:bg-slate-50 mr-2" }, e(ArrowLeft, { size: 16 }), "시료통계관리"),
                    e('button', { onClick: loadData, className: "btn-indigo px-8 h-[42px] justify-center" }, e(Search, { size: 16 }), "조회"),
                    e('button', { onClick: saveAll, className: "btn-emerald px-8 h-[42px] justify-center" }, e(Save, { size: 16 }), "저장"),
                    e('button', { onClick: () => setIsVerifyOpen(true), className: "btn-secondary px-8 h-[42px] justify-center border-slate-300 hover:bg-slate-50 text-slate-600" }, e(CheckCircle2, { size: 16 }), "검증")
                )
            )
        ),

        companyName && selectedHazard && e('div', { className: "w-full max-w-[1200px] bg-white rounded-2xl shadow-xl p-8 border-l-8 border-indigo-600 no-print" },
            e('div', { className: "flex justify-between items-center mb-6" },
                e('div', null,
                    e('h2', { className: "text-xl font-black text-slate-800" }, "공시료(Blank) 보정 제어"),
                    e('p', { className: "text-sm text-slate-500 mt-1" }, "근로자명에 '공시료'가 포함된 시료 목록")
                ),
                e('div', { className: "text-right" },
                    e('span', { className: "text-xs font-bold text-slate-400 block" }, "보정치 (g)"),
                    e('span', { className: "text-3xl font-black text-indigo-600" }, (deltaB / 1000).toFixed(6), e('small', { className: "text-base ml-1" }, "g"))
                )
            ),
            e('div', { className: "overflow-auto" },
                e('table', { className: "w-full text-sm text-left" },
                    e('thead', { className: "text-xs text-slate-700 uppercase bg-slate-50" },
                        e('tr', null, e('th', { className: "py-3 px-4" }, "시료번호"), e('th', { className: "py-3 px-4" }, "구분"), e('th', { className: "py-3 px-2 text-center" }, "1회"), e('th', { className: "py-3 px-2 text-center" }, "2회"), e('th', { className: "py-3 px-2 text-center" }, "3회"), e('th', { className: "py-3 px-2 text-center text-indigo-700 font-bold" }, "평균(g)"))
                    ),
                    e('tbody', { className: "divide-y divide-slate-100" },
                        blankSamples.length === 0 ? e('tr', null, e('td', { colSpan: 6, className: "py-6 text-center" }, "데이터 없음")) :
                            blankSamples.map((b, idx) => {
                                const w1Valid = b.w1.filter(v => v > 0);
                                const w1Avg = w1Valid.length > 0 ? (w1Valid.reduce((a, x) => a + x, 0) / w1Valid.length / 1000000).toFixed(6) : '-';
                                const w2Valid = b.w2.filter(v => v > 0);
                                const w2Avg = w2Valid.length > 0 ? (w2Valid.reduce((a, x) => a + x, 0) / w2Valid.length / 1000000).toFixed(6) : '-';
                                return [
                                    e('tr', { key: b.sample_id + '_b', className: "bg-white" },
                                        e('td', { rowSpan: 2, className: "py-3 px-4 font-bold border-r" }, b.sample_id, e('div', { className: "text-[10px] text-slate-400 font-normal" }, b.worker_name)),
                                        e('td', { className: "py-2 px-4 text-xs font-bold text-slate-500" }, "채취 전"),
                                        b.w1.map((v, i) => e('td', { key: i, className: "p-2" }, e(WeightInput, { value: v, onChange: val => updateWeight(true, idx, 'w1', i, val), className: "bg-slate-50 p-1 rounded" }))),
                                        e('td', { className: `py-2 px-2 text-center font-bold bg-indigo-50/30 ${checkWeightDifference(b.w1) ? 'text-red-500 flex items-center justify-center gap-1' : 'text-indigo-600'}` }, 
                                            checkWeightDifference(b.w1) && e(AlertCircle, { size: 12, className: "text-red-500" }),
                                            w1Avg
                                        )
                                    ),
                                    e('tr', { key: b.sample_id + '_a', className: "bg-white" },
                                        e('td', { className: "py-2 px-4 text-xs font-bold text-slate-500" }, "채취 후"),
                                        b.w2.map((v, i) => e('td', { key: i, className: "p-2" }, e(WeightInput, { value: v, onChange: val => updateWeight(true, idx, 'w2', i, val), className: "bg-slate-50 p-1 rounded" }))),
                                        e('td', { className: `py-2 px-2 text-center font-bold bg-indigo-50/30 ${checkWeightDifference(b.w2) ? 'text-red-500 flex items-center justify-center gap-1' : 'text-indigo-600'}` }, 
                                            checkWeightDifference(b.w2) && e(AlertCircle, { size: 12, className: "text-red-500" }),
                                            w2Avg
                                        )
                                    )
                                ];
                            })
                    )
                )
            )
        ),

        // Preview Controls (Title Only)
        pages.length > 0 && e('div', { className: "w-[1120px] flex justify-between items-center no-print" },
            e('h3', { className: "font-bold text-slate-700 text-xl" }, "시료 데이터")
        ),

        // Report Container
        e('div', { ref: reportRef },
            pages.map((pageData, pIdx) =>
                // A4 Landscape: 297mm x 210mm.
                e('div', {
                    key: pIdx,
                    className: "bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] flex flex-col gap-6 print:shadow-none print:m-0 print:break-after-page relative report-wrapper",
                    style: { width: '290mm', minHeight: '200mm', pageBreakAfter: 'always', padding: '10px', boxSizing: 'border-box' }
                },
                    // Header (Repeated)
                    e('div', { className: "text-center space-y-4" },
                        e('h1', { className: "text-4xl font-black border-b-4 border-slate-800 pb-2 inline-block px-12" }, "중량분석 결과 보고서"),
                        e('div', { className: "grid grid-cols-2 border-2 border-slate-800" },
                            e('div', { className: "grid grid-cols-3 border-r border-slate-800" },
                                e('div', { className: "flex flex-col border-r border-slate-800" },
                                    e('div', { className: "bg-slate-100 py-1 text-[10px] font-black border-b border-slate-800", style: { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } }, "사업장명"),
                                    e('div', { className: "flex-1 flex items-center justify-center font-bold px-2 py-2 text-xs" }, companyName)
                                ),
                                e('div', { className: "flex flex-col border-r border-slate-800" },
                                    e('div', { className: "bg-slate-100 py-1 text-[10px] font-black border-b border-slate-800", style: { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } }, "측정일자"),
                                    e('div', { className: "flex-1 flex items-center justify-center font-bold px-1" },
                                        e('input', { type: "text", className: "w-full text-center bg-transparent border-0 outline-none text-xs", value: measureDate, onChange: e => setMeasureDate(e.target.value) })
                                    )
                                ),
                                e('div', { className: "flex flex-col" },
                                    e('div', { className: "bg-slate-100 py-1 text-[10px] font-black border-b border-slate-800", style: { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } }, "측정자"),
                                    e('div', { className: "flex-1 flex items-center justify-center font-bold px-1" },
                                        e('input', { type: "text", className: "w-full text-center bg-transparent border-0 outline-none text-xs", value: measurer, onChange: e => setMeasurer(e.target.value) })
                                    )
                                )
                            ),
                            e('div', { className: "grid grid-cols-3" },
                                e('div', { className: "flex flex-col border-r border-slate-800" },
                                    e('div', { className: "bg-slate-100 py-1 text-[10px] font-black border-b border-slate-800", style: { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } }, "분석자"),
                                    e('div', { className: "flex-1 flex items-center justify-center font-bold px-1" },
                                        e('input', { type: "text", className: "w-full text-center bg-transparent border-0 outline-none text-xs", value: analyst, onChange: e => setAnalyst(e.target.value) })
                                    )
                                ),
                                e('div', { className: "flex flex-col border-r border-slate-800" },
                                    e('div', { className: "bg-slate-100 py-1 text-[10px] font-black border-b border-slate-800", style: { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } }, "분석일자"),
                                    e('div', { className: "flex-1 flex items-center justify-center font-bold px-1" },
                                        e('input', { type: "date", className: "w-full text-center bg-transparent border-0 outline-none text-xs p-0", value: analysisDate, onChange: e => setAnalysisDate(e.target.value) })
                                    )
                                ),
                                e('div', { className: "flex flex-col" },
                                    e('div', { className: "bg-slate-100 py-1 text-[10px] font-black border-b border-slate-800", style: { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } }, "통보일자"),
                                    e('div', { className: "flex-1 flex items-center justify-center font-bold px-1" },
                                        e('input', { type: "date", className: "w-full text-center bg-transparent border-0 outline-none text-xs p-0", value: reportDate, onChange: e => setReportDate(e.target.value) })
                                    )
                                )
                            )
                        )
                    ),
                    // Table (Slice)
                    e('div', { className: "flex-1" },
                        e('table', { className: "w-full border-collapse border-2 border-slate-800 text-[10px]" },
                            e('thead', null,
                                e('tr', { className: "bg-slate-100", style: { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } },
                                    e('th', { className: "report-th w-[110px]" }, "시료번호"),
                                    e('th', { className: "report-th w-[75px]" }, "작업자"),
                                    e('th', { className: "report-th w-[45px]" }, "측정시작"),
                                    e('th', { className: "report-th w-[45px]" }, "측정종료"),
                                    e('th', { className: "report-th w-[40px]" }, "측정시간\n(분)"),
                                    e('th', { className: "report-th w-[45px]" }, "유량"),
                                    e('th', { className: "report-th w-[45px]" }, "측정전\n무게(1)"),
                                    e('th', { className: "report-th w-[45px]" }, "측정전\n무게(2)"),
                                    e('th', { className: "report-th w-[45px]" }, "측정전\n무게(3)"),
                                    e('th', { className: "report-th w-[45px]" }, "측정후\n무게(1)"),
                                    e('th', { className: "report-th w-[45px]" }, "측정후\n무게(2)"),
                                    e('th', { className: "report-th w-[45px]" }, "측정후\n무게(3)"),
                                    e('th', { className: "report-th w-[65px]" }, "분석량(mg)"),
                                    e('th', { className: "report-th w-[65px]" }, "농도(mg/m³)"),
                                    e('th', { className: "report-th w-[45px]" }, "TLV"),
                                    e('th', { className: "report-th w-[40px]" }, "판정")
                                )
                            ),
                            e('tbody', null,
                                pageData.length === 0 ? e('tr', null, e('td', { colSpan: 16, className: "py-20 text-center" }, "데이터 없음")) :
                                    pageData.map((s) => {
                                        const sIdx = s.globalIdx;
                                        const avg1 = s.w1.filter(v => v > 0).reduce((a, b) => a + b, 0) / s.w1.length / 1000000;
                                        const avg2 = s.w2.filter(v => v > 0).reduce((a, b) => a + b, 0) / s.w2.length / 1000000;
                                        const amount = ((avg2 - avg1) * 1000) - deltaB;
                                        const volM3 = (s.flow || 0) * (s.duration || 0) / 1000;
                                        const conc = volM3 > 0 ? amount / volM3 : 0;

                                        const correctedTLV = (tlvVal || 0) * (8 / (s.work_hour || 8));
                                        const exceed = correctedTLV > 0 && conc > correctedTLV;

                                        return e('tr', { key: s.sample_id, className: "h-9 hover:bg-slate-50" },
                                            e('td', { className: "report-td font-bold whitespace-nowrap" }, e('div', { className: "center-wrap" }, s.sample_id)),
                                            e('td', { className: "report-td whitespace-nowrap" }, e('div', { className: "center-wrap" }, s.worker_name)),
                                            e('td', { className: "report-td text-[9px] whitespace-nowrap" }, formatTime(s.start_time)),
                                            e('td', { className: "report-td text-[9px] whitespace-nowrap" }, formatTime(s.end_time)),
                                            e('td', { className: "report-td" }, e('div', { className: "center-wrap" }, s.duration)),
                                            e('td', { className: "report-td" }, e('div', { className: "center-wrap" }, formatDecimal(s.flow, 3))),
                                            s.w1.map((v, i) => e('td', { key: i, className: `report-td p-0 ${checkWeightDifference(s.w1) ? 'bg-red-50' : ''}` },
                                                e('div', { className: "flex items-center justify-center gap-1" },
                                                    checkWeightDifference(s.w1) && i === 0 && e(AlertCircle, { size: 10, className: "text-red-500" }),
                                                    e(WeightInput, { value: v, onChange: val => updateWeight(false, sIdx, 'w1', i, val) })
                                                )
                                            )),
                                            s.w2.map((v, i) => e('td', { key: i, className: `report-td p-0 ${checkWeightDifference(s.w2) ? 'bg-red-50' : ''}` },
                                                e('div', { className: "flex items-center justify-center gap-1" },
                                                    checkWeightDifference(s.w2) && i === 0 && e(AlertCircle, { size: 10, className: "text-red-500" }),
                                                    e(WeightInput, { value: v, onChange: val => updateWeight(false, sIdx, 'w2', i, val) })
                                                )
                                            )),
                                            e('td', { className: "report-td font-bold text-slate-800" }, e('div', { className: "center-wrap" }, amount.toFixed(6))),
                                            e('td', { className: `report-td font-bold ${exceed ? 'text-red-600' : 'text-indigo-600'}` }, e('div', { className: "center-wrap" }, conc.toFixed(6))),
                                            e('td', { className: "report-td text-[9px] text-slate-500" }, e('div', { className: "center-wrap" }, correctedTLV > 0 ? correctedTLV.toFixed(3) : '-')),
                                            e('td', { className: "report-td font-bold" }, e('div', { className: "center-wrap" },
                                                exceed ? e('span', { className: "text-red-600" }, "초과") :
                                                    correctedTLV > 0 ? e('span', { className: "text-emerald-600" }, "적합") : '-'
                                            ))
                                        );
                                    })
                            )
                        )
                    ),
                    // Footer (Repeated)
                    e('div', { className: "flex justify-between items-end border-t-2 border-slate-800 pt-4" },
                        e('div', { className: "text-[10px] text-slate-500 font-serif italic" },
                            e('p', null, `* 농도 (mg/m³) = 분석량 (mg) / 총채기량 (m³)`),
                            e('p', null, `* 분석량 (mg) = ((채취후평균 - 채취전평균) × 1000) - 공시료보정치(ΔB)`),
                            e('p', null, `* 총채기량 (m³) = (평균유량(L/min) × 측정시간(min)) / 1000`)
                        ),
                        e('div', { className: "text-right" },
                            e('div', { className: "text-[10px] text-slate-400 mb-1" }, `- ${pIdx + 1} / ${pages.length} -`),
                            e('div', { className: "font-black italic text-slate-300 text-2xl" }, "KiWE System")
                        )
                    )
                )
            )
        ),

        e('div', { className: "fixed bottom-8 right-8 flex flex-col gap-3 no-print" },
            e('button', { onClick: downloadPDF, className: "w-14 h-14 rounded-full bg-slate-800 text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform" }, e(Download, { size: 24 })),
            e('button', { onClick: saveAll, className: "w-14 h-14 rounded-full bg-indigo-600 text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform" }, e(Save, { size: 24 }))
        ),

        e(VerificationModal, { isOpen: isVerifyOpen, onClose: () => setIsVerifyOpen(false), data: mainSamples, deltaB, selectedHazard, tlvVal }),
        e(PDFPreviewModal, { isOpen: showPdfPreview, onClose: () => setShowPdfPreview(false), pdfUrl })
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));

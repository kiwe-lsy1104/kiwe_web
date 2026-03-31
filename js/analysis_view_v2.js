import React, { useState, useEffect, useRef, useMemo } from 'https://esm.sh/react@18.2.0';
import { Search, Printer, FileText, Download, X, Eye, Settings2, ChevronLeft, ChevronRight } from 'https://esm.sh/lucide-react@0.263.1';

const e = React.createElement;

// Helpers
const getTableName = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const halfYear = (date.getMonth() + 1) <= 6 ? 1 : 2;
    return `kiwe_results_${date.getFullYear()}_${halfYear}`;
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

function PrintModal({ isOpen, onClose, company, date, data }) {
    if (!isOpen) return null;
    const reportRef = useRef(null);

    const downloadPDF = () => {
        const element = reportRef.current;
        const opt = {
            margin: 10,
            filename: `유기화합물_분석결과통보서_${company}_${date}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['css', 'legacy'] }
        };
        window.html2pdf().set(opt).from(element).save();
    };

    return e('div', { className: "fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-6" },
        e('div', { className: "bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-full flex flex-col overflow-hidden" },
            e('div', { className: "p-4 border-b flex justify-between items-center bg-slate-800 text-white shrink-0" },
                e('h3', { className: "font-bold text-lg flex items-center gap-2" }, e(FileText, { size: 20 }), "통보서 발행 미리보기"),
                e('div', { className: "flex gap-2" },
                    e('button', { onClick: downloadPDF, className: "flex items-center gap-1 bg-violet-600 hover:bg-violet-700 px-4 py-1.5 rounded font-bold text-sm transition" }, e(Download, { size: 16 }), "PDF 다운로드"),
                    e('button', { onClick: onClose, className: "hover:bg-slate-700 p-1.5 rounded transition" }, e(X, { size: 20 }))
                )
            ),
            e('div', { className: "flex-1 overflow-auto bg-slate-100 p-8 flex justify-center print:bg-white print:p-0" },
                e('div', {
                    ref: reportRef,
                    className: "bg-white shadow-xl w-[297mm] min-h-[210mm] p-[10mm] print:shadow-none print:w-full print:border-none relative border"
                },
                    e('style', null, `
                        .rep-table { width: 100%; border-collapse: collapse; border: 2px solid #1e293b; font-size: 11px; }
                        .rep-th, .rep-td { border: 1px solid #1e293b; padding: 6px 4px; text-align: center; vertical-align: middle; }
                        .rep-th { background-color: #f8fafc; font-weight: bold; }
                    `),
                    e('div', { className: "text-center space-y-4 mb-6" },
                        e('h1', { className: "text-4xl font-black tracking-widest decoration-4 underline underline-offset-8" }, "분석결과통보서"),
                        e('div', { className: "flex justify-between items-end mt-8 border-b-2 border-slate-800 pb-2" },
                            e('div', { className: "text-left text-sm space-y-1" },
                                e('p', null, e('span', { className: "font-bold w-16 inline-block" }, "사업장명 :"), " ", company),
                                e('p', null, e('span', { className: "font-bold w-16 inline-block" }, "측정일자 :"), " ", date)
                            ),
                            e('div', { className: "text-right text-sm space-y-1" },
                                e('p', null, e('span', { className: "font-bold w-16 inline-block text-slate-500" }, "통보일자 :"), " ", new Date().toISOString().split('T')[0])
                            )
                        )
                    ),
                    e('table', { className: "rep-table" },
                        e('thead', null,
                            e('tr', null,
                                e('th', { className: "rep-th w-[12%]" }, "시료번호"),
                                e('th', { className: "rep-th w-[12%]" }, "공정명"),
                                e('th', { className: "rep-th w-[12%]" }, "유해인자"),
                                e('th', { className: "rep-th w-[6%]" }, "분자량"),
                                e('th', { className: "rep-th w-[8%]" }, "TLV"),
                                e('th', { className: "rep-th w-[8%]" }, "채기량(m\u00B3)"),
                                e('th', { className: "rep-th w-[8%]" }, "LOQ(mg)"),
                                e('th', { className: "rep-th w-[8%]" }, "분석량(mg)"),
                                e('th', { className: "rep-th w-[8%]" }, "농도(mg/m\u00B3)"),
                                e('th', { className: "rep-th w-[8%]" }, "농도(ppm)"),
                                e('th', { className: "rep-th w-[10%]" }, "평가")
                            )
                        ),
                        e('tbody', null,
                            data.map((row, idx) => {
                                const isLoq = row.result_mg < row.loq;
                                const exceed = row.compensated_tlv > 0 && ((row.result_mg_m3 > row.compensated_tlv) || (row.result_ppm > row.compensated_tlv));
                                return e('tr', { key: row.id || idx },
                                    e('td', { className: "rep-td font-bold font-mono" }, row.sample_id),
                                    e('td', { className: "rep-td font-bold text-slate-700" }, row.work_process),
                                    e('td', { className: "rep-td font-bold text-indigo-800" }, row.common_name),
                                    e('td', { className: "rep-td" }, parseFloat(row.molecular_weight || 0).toFixed(2)),
                                    e('td', { className: "rep-td" }, parseFloat(row.tlv || 0).toFixed(2)),
                                    e('td', { className: "rep-td font-mono" }, parseFloat(row.volume_m3 || 0).toFixed(4)),
                                    e('td', { className: "rep-td font-mono text-slate-500" }, parseFloat(row.loq || 0).toFixed(4)),
                                    e('td', { className: "rep-td font-mono font-bold" }, isLoq ? '< LOQ' : parseFloat(row.result_mg || 0).toFixed(4)),
                                    e('td', { className: "rep-td font-mono font-bold" }, isLoq ? '불검출' : parseFloat(row.result_mg_m3 || 0).toFixed(4)),
                                    e('td', { className: "rep-td font-mono font-bold" }, isLoq ? '불검출' : parseFloat(row.result_ppm || 0).toFixed(4)),
                                    e('td', { className: `rep-td font-bold ${exceed ? 'text-red-600' : 'text-emerald-600'}` },
                                        isLoq ? '-' : (exceed ? '초과' : '적합')
                                    )
                                );
                            })
                        )
                    ),
                    e('div', { className: "mt-8 text-[11px] text-slate-500 font-serif space-y-1" },
                        e('p', null, `* 평가 기준: 실근로시간 보정 노출기준(TLV) 초과 여부`),
                        e('p', null, `* 농도 (mg/m\u00B3) = 분석량 (mg) / 채기량 (m\u00B3)`),
                        e('p', null, `* 농도 (ppm) = (농도(mg/m\u00B3) × 24.45) / 분자량`),
                        e('p', null, `* 분석량 (mg) = (Area / Slope / 평균 탈착율) × Total 시료량`)
                    )
                )
            )
        )
    );
}

export default function AnalysisView({ supabase }) {
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [keyword, setKeyword] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);

    const [rawResults, setRawResults] = useState([]);
    const [companies, setCompanies] = useState([]);

    // ── 컬럼 너비 상태 ──
    const [columnWidths, setColumnWidths] = useState(() => {
        try { const s = localStorage.getItem('KIWE_ANALYSIS_VIEW_WIDTHS'); return s ? JSON.parse(s) : {}; } catch { return {}; }
    });
    useEffect(() => { localStorage.setItem('KIWE_ANALYSIS_VIEW_WIDTHS', JSON.stringify(columnWidths)); }, [columnWidths]);

    const handleResize = (id, width) => setColumnWidths(prev => ({ ...prev, [id]: width }));

    const DB_SETTINGS_KEY = 'analysis_view_column_config';
    const [settingsSaveStatus, setSettingsSaveStatus] = useState('');


    // Dynamic Columns State
    const ALL_COLUMNS = [
        // From sampling ledger
        { id: 'sample_id', label: '시료번호', w: 110, align: 'center' },
        { id: 'com_name', label: '사업장명', w: 160, align: 'left' },
        { id: 'work_process', label: '단위작업장소', w: 130, align: 'left' },
        { id: 'worker_name', label: '근로자명', w: 80, align: 'center' },
        { id: 'common_name', label: '유해인자', w: 150, align: 'left' },
        { id: 'm_date', label: '측정일자', w: 90, align: 'center' },
        { id: 'blank_sample_no', label: '공시료번호', w: 100, align: 'center' },
        { id: 'pump_no', label: '펌프번호', w: 80, align: 'center' },
        { id: 'start_time', label: '시작시간', w: 80, align: 'center' },
        { id: 'end_time', label: '종료시간', w: 80, align: 'center' },
        { id: 'collection_time', label: '포집시간(분)', w: 90, align: 'center' },
        { id: 'avg_flow', label: '평균유량', w: 80, align: 'center' },
        { id: 'air_volume', label: '채기량(L)', w: 80, align: 'center' },
        { id: 'shift_type', label: '근로형태', w: 80, align: 'center' },
        { id: 'work_hour', label: '실근로', w: 70, align: 'center' },
        { id: 'lunch_time', label: '점심시간', w: 70, align: 'center' },
        { id: 'occurrence_type', label: '발생형태', w: 90, align: 'center' },
        { id: 'temp', label: '온도', w: 60, align: 'center' },
        { id: 'humidity', label: '습도', w: 60, align: 'center' },
        { id: 'sample_state', label: '시료상태', w: 80, align: 'center' },
        { id: 'measured_by', label: '측정자', w: 80, align: 'center' },
        { id: 'received_by', label: '인수자/접수자', w: 100, align: 'center' },
        { id: 'instrument_name', label: '분석방법', w: 100, align: 'center' },
        { id: 'analyzer', label: '분석자', w: 120, align: 'center' },
        { id: 'remarks', label: '비고', w: 150, align: 'left' },

        // Result appended specific columns
        { id: 'instrument_type', label: '기기', w: 80, align: 'center' },
        { id: 'unit', label: '단위', w: 60, align: 'center' },
        { id: 'tlv', label: '노출기준', w: 80, align: 'center' },
        { id: 'result_val', label: '분석결과', w: 80, align: 'center' },
        { id: 'eval', label: '평가', w: 80, align: 'center' },
        { id: 'report_btn', label: '통보서 발행', w: 100, align: 'center' }
    ];

    const [columnConfig, setColumnConfig] = useState(() => {
        const saved = localStorage.getItem('KIWE_ANALYSIS_VIEW_COLUMNS_V3');
        if (saved) { try { return JSON.parse(saved); } catch (e) { } }
        return ['m_date', 'com_name', 'sample_id', 'common_name', 'work_process', 'worker_name', 'result_val', 'unit', 'tlv', 'eval', 'report_btn'];
    });

    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        localStorage.setItem('KIWE_ANALYSIS_VIEW_COLUMNS_V3', JSON.stringify(columnConfig));
    }, [columnConfig]);

    useEffect(() => {
        const fetchColumnConfigFromDB = async () => {
            try {
                const { data, error } = await supabase
                    .from('kiwe_app_settings')
                    .select('value')
                    .eq('key', DB_SETTINGS_KEY)
                    .single();
                if (error || !data) return;
                const parsed = data.value;
                if (Array.isArray(parsed)) setColumnConfig(parsed);
            } catch (err) {
                console.warn('DB settings load logic failed:', err);
            }
        };
        fetchColumnConfigFromDB();
    }, [supabase]);

    const saveColumnConfigToDB = async (config) => {
        setSettingsSaveStatus('saving');
        try {
            const { error } = await supabase
                .from('kiwe_app_settings')
                .upsert({ key: DB_SETTINGS_KEY, value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (error) throw error;
            setSettingsSaveStatus('saved');
            setTimeout(() => setSettingsSaveStatus(''), 2500);
        } catch (err) {
            console.error('컬럼 설정 저장 실패:', err);
            setSettingsSaveStatus('error');
            setTimeout(() => setSettingsSaveStatus(''), 3000);
        }
    };

    const getSamplingTable = (d) => { if (!d) return null; const dt = new Date(d); return `kiwe_sampling_${dt.getFullYear()}_${(dt.getMonth() + 1) <= 6 ? 1 : 2}`; };

    const fetchResults = async () => {
        setLoading(true);
        try {
            const resultTables = getTargetTables(startDate, endDate);

            // 1. Fetch kiwe_results
            const resQueries = await Promise.all(resultTables.map(t =>
                supabase.from(t).select('*').gte('m_date', startDate).lte('m_date', endDate)
            ).map(p => Promise.resolve(p).catch(() => ({ data: [] }))));
            const baseResults = resQueries.flatMap(r => r.data || []);

            // 2. Fetch kiwe_sampling for matching dates to get missing columns like worker_name
            const samplingTables = new Set(baseResults.map(r => getSamplingTable(r.m_date)).filter(Boolean));
            const sampQueries = await Promise.all(Array.from(samplingTables).map(t =>
                supabase.from(t).select('*')
            ).map(p => Promise.resolve(p).catch(() => ({ data: [] }))));
            const sampData = sampQueries.flatMap(r => r.data || []);
            const sampMap = {};
            sampData.forEach(s => sampMap[s.sample_id] = s);

            const merged = baseResults.map(r => {
                const s = sampMap[r.sample_id] || {};
                const isPpm = r.instrument_type !== 'ICP' && r.result_ppm > 0; // rough heuristic
                let displayVal = r.result_display;
                if (!displayVal) displayVal = isPpm ? r.result_ppm : r.result_mg_m3;
                if (typeof displayVal === 'number') displayVal = displayVal.toFixed(4);

                let evalStr = '-';
                if (r.result_display === '불검출' || r.result_display === '검출한계미만') evalStr = '미만';
                else if (r.compensated_tlv > 0) {
                    const val = isPpm ? r.result_ppm : r.result_mg_m3;
                    evalStr = val > r.compensated_tlv ? '초과' : '미만';
                }

                return {
                    ...s,
                    ...r,
                    worker_name: s.worker_name || '-',
                    work_hour: s.work_hour || 8,
                    blank_sample_no: s.blank_sample_no || '-',
                    unit: r.instrument_type === 'ICP' ? 'mg/m³' : (r.result_ppm > 0 || r.result_display ? 'PPM_OR_MG' : 'mg/m³'), // simplify unit logic or rely on tlv
                    result_val: displayVal,
                    eval: evalStr
                };
            });

            merged.sort((a, b) => b.m_date.localeCompare(a.m_date) || (a.com_name || '').localeCompare(b.com_name || ''));
            setRawResults(merged);

            const comps = [...new Set(merged.map(r => r.com_name).filter(Boolean))].sort();
            setCompanies(comps);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const filteredData = useMemo(() => {
        return keyword ? rawResults.filter(r => r.com_name === keyword) : rawResults;
    }, [rawResults, keyword]);

    return e('div', { className: "h-full flex flex-col p-6 bg-slate-50 gap-6 overflow-hidden" },
        // Tool bar
        e('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-6 items-end shrink-0" },
            e('div', { className: "space-y-1" },
                e('label', { className: "text-xs font-bold text-slate-500" }, "조회 기간"),
                e('div', { className: "flex items-center gap-2" },
                    e('input', { type: "date", className: "border rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500", value: startDate, onChange: e => setStartDate(e.target.value) }),
                    e('span', { className: "text-slate-400 font-bold" }, "~"),
                    e('input', { type: "date", className: "border rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500", value: endDate, onChange: e => setEndDate(e.target.value) }),
                )
            ),
            e('div', { className: "space-y-1 flex-1 min-w-[200px]" },
                e('label', { className: "text-xs font-bold text-slate-500" }, "사업장명 검색"),
                e('select', { className: "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500", value: keyword, onChange: e => setKeyword(e.target.value) },
                    e('option', { value: '' }, '전체 사업장'),
                    companies.map(c => e('option', { key: c, value: c }, c))
                )
            ),
            e('div', { className: "flex items-center gap-3 shrink-0" },
                e('button', { onClick: fetchResults, disabled: loading, className: "bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition flex items-center gap-2 shadow" }, e(Search, { size: 16 }), loading ? "검색 중..." : "결과 조회"),
                e('button', {
                    onClick: () => {
                        const headers = columnConfig.filter(id => id !== 'report_btn').map(id => ALL_COLUMNS.find(c => c.id === id)?.label);
                        const rows = filteredData.map(r => columnConfig.filter(id => id !== 'report_btn').map(id => r[id] ?? ''));
                        const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
                        const wb = window.XLSX.utils.book_new();
                        window.XLSX.utils.book_append_sheet(wb, ws, 'Results');
                        window.XLSX.writeFile(wb, `분석결과_${startDate}_${endDate}.xlsx`);
                    }, className: "bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition flex items-center gap-2 shadow"
                }, e(Download, { size: 16 }), "엑셀 다운로드"),
                e('div', { className: "w-px h-8 bg-slate-200 mx-2" }),
                e('button', { onClick: () => setShowSettings(!showSettings), className: `border px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${showSettings ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}` }, e(Settings2, { size: 16 }), "컬럼설정")
            )
        ),

        showSettings && e('div', { className: "bg-white p-4 border rounded-xl border-slate-200 flex flex-col gap-3 z-20 relative shadow-sm shrink-0 animate-fade-in mx-1" },
            e('div', { className: "flex justify-between items-center" },
                e('h3', { className: "font-bold text-slate-800 text-sm flex items-center gap-2" }, e(Settings2, { size: 16, className: "text-violet-600" }), "동적 컬럼 설정 (순서 및 표시)"),
                e('div', { className: "flex gap-2" },
                    e('button', { onClick: () => saveColumnConfigToDB(columnConfig), className: `text-[11px] font-bold px-3 py-1 rounded transition ${settingsSaveStatus === 'saving' ? 'bg-slate-200 text-slate-500 cursor-wait' : settingsSaveStatus === 'saved' ? 'bg-emerald-100 text-emerald-700' : settingsSaveStatus === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}` },
                        settingsSaveStatus === 'saving' ? '저장 중...' : settingsSaveStatus === 'saved' ? '저장됨' : settingsSaveStatus === 'error' ? '오류' : '설정 저장'
                    ),
                    e('button', { onClick: () => setColumnConfig(['m_date', 'com_name', 'sample_id', 'common_name', 'work_process', 'worker_name', 'result_val', 'unit', 'tlv', 'eval', 'report_btn']), className: "text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 transition" }, "초기화"),
                    e('button', { onClick: () => setColumnConfig(ALL_COLUMNS.map(c => c.id)), className: "text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded hover:bg-violet-100 transition" }, "전체 보기"),
                    e('button', { onClick: () => setShowSettings(false), className: "p-1 rounded bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition" }, e(X, { size: 16 }))
                )
            ),
            e('div', { className: "flex flex-wrap gap-2" },
                columnConfig.map((colId, idx) => {
                    const colDef = ALL_COLUMNS.find(c => c.id === colId);
                    if (!colDef) return null;
                    return e('div', { key: colId, className: "group flex items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1 shadow-sm text-xs font-bold text-slate-700" },
                        e('button', { onClick: () => { const next = [...columnConfig]; if (idx > 0) { [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setColumnConfig(next); } }, disabled: idx === 0, className: `p-0.5 rounded mr-1 ${idx === 0 ? 'opacity-20' : 'hover:bg-slate-200'}` }, e(ChevronLeft, { size: 12 })),
                        e('span', { className: "px-1" }, colDef.label),
                        e('button', { onClick: () => { const next = [...columnConfig]; if (idx < columnConfig.length - 1) { [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setColumnConfig(next); } }, disabled: idx === columnConfig.length - 1, className: `p-0.5 rounded mx-1 ${idx === columnConfig.length - 1 ? 'opacity-20' : 'hover:bg-slate-200'}` }, e(ChevronRight, { size: 12 })),
                        e('button', { onClick: () => setColumnConfig(columnConfig.filter(id => id !== colId)), className: "p-0.5 rounded hover:bg-rose-100 text-rose-500 transition" }, e(X, { size: 12 }))
                    );
                })
            ),
            e('div', { className: "flex flex-wrap gap-2 pt-2 border-t border-slate-100 mt-1" },
                ALL_COLUMNS.filter(c => !columnConfig.includes(c.id)).map(colDef => (
                    e('button', { key: colDef.id, onClick: () => setColumnConfig([...columnConfig, colDef.id]), className: "px-2 py-1 rounded bg-white border border-dashed border-slate-300 text-slate-500 text-xs font-bold hover:bg-slate-50 hover:text-violet-600 hover:border-violet-300 transition flex items-center gap-1" }, e('span', { className: "text-lg leading-none mt-[-2px] opacity-70" }, "+"), colDef.label)
                ))
            )
        ),

        // Grid
        e('div', { className: "flex-1 overflow-auto bg-white rounded-2xl shadow-sm border border-slate-200" },
            e('table', { className: "w-full text-xs text-center", style: { tableLayout: 'fixed', minWidth: '100%', wordBreak: 'break-word', whiteSpace: 'normal' } },
                e('thead', { className: "bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-xs" },
                    e('tr', null,
                        e('th', { className: "p-3 w-12 text-center" }, "No"),
                        columnConfig.map(colId => {
                            const colDef = ALL_COLUMNS.find(c => c.id === colId);
                            if (!colDef) return null;
                            const w = columnWidths[colId] || colDef.w || 100;
                            return e('th', { key: colId, style: { width: w, minWidth: w }, className: "p-3 text-center border-r border-slate-200 relative group" },
                                colDef.label,
                                e('div', {
                                    className: 'absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-violet-400 group-hover:bg-slate-200 transition-colors',
                                    onMouseDown: (ev) => {
                                        const startX = ev.pageX;
                                        const startW = w;
                                        const move = (me) => handleResize(colId, Math.max(40, startW + (me.pageX - startX)));
                                        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                                        window.addEventListener('mousemove', move);
                                        window.addEventListener('mouseup', up);
                                    }
                                })
                            );
                        })
                    )
                ),
                e('tbody', { className: "divide-y divide-slate-100" },
                    filteredData.length === 0 ? e('tr', null, e('td', { colSpan: columnConfig.length + 1, className: "p-12 text-center text-slate-400" }, "저장된 과거 분석 결과가 없습니다.")) :
                        filteredData.map((row, idx) => e('tr', { key: row.id || idx, className: "hover:bg-slate-50 transition" },
                            e('td', { className: "p-3 text-center text-slate-400 font-bold" }, idx + 1),
                            columnConfig.map(colId => {
                                if (colId === 'report_btn') return e('td', { key: colId, className: "p-3 text-center text-slate-500" },
                                    e('button', {
                                        onClick: () => setSelectedGroup({ company: row.com_name, date: row.m_date, samples: rawResults.filter(r => r.com_name === row.com_name && r.m_date === row.m_date) }),
                                        className: "inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-bold text-xs transition"
                                    }, e(FileText, { size: 14 }), "통보서 발행")
                                );

                                let val = row[colId] ?? '-';
                                if (colId === 'unit' && val === 'PPM_OR_MG') val = row.tlv ? (row.instrument_type !== 'ICP' && row.molecular_weight > 0 ? 'ppm' : 'mg/m³') : 'mg/m³';

                                return e('td', { key: colId, className: `p-3 text-center border-r border-slate-50 ${colId === 'com_name' ? 'font-bold text-slate-800' : ''} ${colId === 'common_name' ? 'font-bold text-violet-700' : ''}` }, val);
                            })
                        ))
                )
            )
        ),

        e(PrintModal, {
            isOpen: !!selectedGroup,
            onClose: () => setSelectedGroup(null),
            company: selectedGroup?.company,
            date: selectedGroup?.date,
            data: selectedGroup?.samples || []
        })
    );
}

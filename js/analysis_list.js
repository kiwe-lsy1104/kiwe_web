import React, { useState, useEffect, useMemo, useRef } from 'https://esm.sh/react@18.2.0';
import {
    Search, Download, Settings2, X, ChevronLeft, ChevronRight, RotateCcw,
    SortAsc, SortDesc
} from 'https://esm.sh/lucide-react@0.263.1';

// Initial metadata for known columns
const INITIAL_METADATA = {
    'sample_id': { label: '시료번호', width: 100, source: 'sampling' },
    'm_date': { label: '측정일자', width: 90, source: 'sampling' },
    'com_name': { label: '사업장명', width: 150, source: 'sampling' },
    'work_process': { label: '단위작업장소', width: 120, source: 'sampling' },
    'worker_name': { label: '근로자명', width: 80, source: 'sampling' },
    'common_name': { label: '유해인자', width: 140, source: 'sampling' },
    'pump_no': { label: '펌프번호', width: 80, source: 'sampling' },
    'start_time': { label: '시작시간', width: 80, source: 'sampling' },
    'end_time': { label: '종료시간', width: 80, source: 'sampling' },
    'is_self': { label: '분석구분', width: 80, source: 'sampling' },
    'remark1': { label: '비고1', width: 100, source: 'custom' },
    'remark2': { label: '비고2', width: 100, source: 'custom' },
    'blank_sample_no': { label: '공시료번호', width: 100, source: 'sampling' },
    'corp_code': { label: '공단코드', width: 80, source: 'sampling' },
    'collection_time': { label: '측정시간(분)', width: 95, source: 'calc' },
    'avg_flow': { label: '평균유량', width: 80, source: 'calc' },
    'air_volume': { label: '채기량(L)', width: 80, source: 'calc' },
    'shift_type': { label: '근로형태', width: 80, source: 'sampling' },
    'work_hour': { label: '실근로', width: 70, source: 'sampling' },
    'lunch_time': { label: '점심시간', width: 70, source: 'sampling' },
    'occurrence_type': { label: '발생형태', width: 90, source: 'sampling' },
    'temp': { label: '온도', width: 60, source: 'sampling' },
    'humidity': { label: '습도', width: 60, source: 'sampling' },
    'sample_state': { label: '시료상태', width: 80, source: 'sampling' },
    'measured_by': { label: '측정자', width: 80, source: 'sampling' },
    'received_by': { label: '인수자/접수자', width: 90, source: 'sampling' },
    'hazard_category': { label: '유해인자분류', width: 100, source: 'sampling' },
    'instrument_name': { label: '분석방법', width: 100, source: 'sampling' },
    'sampling': { label: '채취방법', width: 120, source: 'sampling' },
    'storage': { label: '보관방법', width: 120, source: 'sampling' },
    'sampling_media': { label: '채취매체', width: 120, source: 'sampling' },
    'remarks': { label: '비고(시료)', width: 150, source: 'sampling' },
    'received_date': { label: '접수일자', width: 90, source: 'sampling' },
    // Hazard info columns
    'hazard_id': { label: '인자ID', width: 80, source: 'hazard' },
    'cas_no': { label: 'CAS No.', width: 100, source: 'hazard' },
    'unit': { label: '단위', width: 80, source: 'hazard' },
    'limit_twa': { label: 'TWA기준', width: 80, source: 'hazard' },
    'limit_stel': { label: 'STEL기준', width: 80, source: 'hazard' },
    'is_special': { label: '특수대상', width: 80, source: 'hazard' },
    'is_managed': { label: '관리대상', width: 80, source: 'hazard' },
    'status': { label: '완료상태', width: 80, source: 'sampling' },
    'completed_at': { label: '완료날짜', width: 90, source: 'sampling' },
    'analyzer': { label: '분석자', width: 120, source: 'calc' }
};

const STORAGE_KEY = 'KIWE_ANALYSIS_EXTRACTION_CONFIG_V6_STABLE';
const DB_SETTINGS_KEY = 'analysis_extraction_column_config';

export function AnalysisExtraction({
    supabase, startDate, endDate, keyword,
    onStartDateChange, onEndDateChange, onKeywordChange
}) {
    const [settingsSaveStatus, setSettingsSaveStatus] = React.useState(''); // '' | 'saving' | 'saved' | 'error'
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [columnConfig, setColumnConfig] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) { }
        }
        // 기본값 세팅
        return ['sample_id', 'm_date', 'com_name', 'worker_name', 'common_name', 'start_time', 'end_time', 'collection_time', 'avg_flow', 'air_volume', 'remark1', 'remark2'];
    });
    const [allPossibleCols, setAllPossibleCols] = useState([]);
    const [colSources, setColSources] = useState({});
    const [sortOrder, setSortOrder] = useState('asc');
    const [showSettings, setShowSettings] = useState(false);

    const hotRef = useRef(null);
    const hotInstance = useRef(null);

    const e = React.createElement;

    // ── DB에서 공유 컬럼 설정 로드
    const fetchColumnConfigFromDB = async () => {
        if (!supabase) return;
        try {
            const { data, error } = await supabase
                .from('kiwe_app_settings')
                .select('value')
                .eq('key', DB_SETTINGS_KEY)
                .single();
            if (error || !data) return;
            const parsed = data.value;
            if (Array.isArray(parsed) && parsed.length > 0) {
                setColumnConfig(parsed);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
        } catch (err) {
            console.warn('분석추출 컬럼 설정 DB 로드 실패 (localStorage 유지):', err);
        }
    };

    // ── DB에 공유 컬럼 설정 저장
    const saveColumnConfigToDB = async (config) => {
        if (!supabase) return;
        setSettingsSaveStatus('saving');
        try {
            const { error } = await supabase
                .from('kiwe_app_settings')
                .upsert({ key: DB_SETTINGS_KEY, value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (error) throw error;
            setSettingsSaveStatus('saved');
            setTimeout(() => setSettingsSaveStatus(''), 2500);
        } catch (err) {
            console.error('분석추출 컬럼 설정 저장 실패:', err);
            setSettingsSaveStatus('error');
            setTimeout(() => setSettingsSaveStatus(''), 3000);
        }
    };

    // Isolate configuration persistence
    useEffect(() => {
        fetchColumnConfigFromDB(); // ★ DB에서 공유 설정 로드
        const handleEsc = (event) => {
            if (event.key === 'Escape') setShowSettings(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    useEffect(() => {
        if (columnConfig.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(columnConfig));
        }
    }, [columnConfig]);

    useEffect(() => {
        fetchData();
    }, [startDate, endDate, keyword]);

    const getTableName = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const halfYear = month <= 6 ? 1 : 2;
        return `kiwe_sampling_${year}_${halfYear}`;
    };

    const getTableList = (start, end) => {
        if (!start || !end) return [];
        const tables = new Set();
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        let curr = new Date(startDateObj);
        while (curr <= endDateObj) {
            const name = getTableName(curr.toISOString().split('T')[0]);
            if (name) tables.add(name);
            curr.setMonth(curr.getMonth() + 6);
        }
        const endName = getTableName(end);
        if (endName) tables.add(endName);
        return Array.from(tables);
    };

    const calculateMinutes = (start, end, lunchTime) => {
        if (!start || !end) return 0;
        try {
            const parse = (t) => {
                const parts = t.split(':');
                return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            };
            const t1 = parse(start);
            const t2 = parse(end);
            let diff = t2 - t1;
            if (diff < 0) diff += 24 * 60;
            const lunch = parseInt(lunchTime) || 0;
            return Math.max(0, diff - lunch);
        } catch (e) { return 0; }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Hazard Master Data
            const { data: hazardMaster, error: hazardErr } = await supabase.from('kiwe_hazard').select('*');
            const hazardMap = {};
            const hazardKeys = new Set();
            if (!hazardErr && hazardMaster) {
                hazardMaster.forEach(h => { if (h.common_name) hazardMap[h.common_name.trim()] = h; });
                Object.keys(hazardMaster[0] || {}).forEach(k => hazardKeys.add(k));
            }

            // 1-1. 분석자 기본값 조회 (자체분석: 분석책임자 / 외부분석: 기본 외부기관)
            const [analystRes, labRes] = await Promise.all([
                supabase.from('kiwe_users').select('user_name').eq('job_title', '분석책임자').maybeSingle(),
                supabase.from('kiwe_partners').select('partner_name').eq('is_default_lab', true).maybeSingle()
            ]);
            const defaultAnalyst = analystRes.data?.user_name || '-';
            const defaultLab = labRes.data?.partner_name || '-';

            // 2. Fetch Flow Data
            const { data: flowData, error: flowErr } = await supabase.from('kiwe_flow').select('m_date, pump_no, total_avg').gte('m_date', startDate).lte('m_date', endDate);
            const flowMap = new Map();
            if (!flowErr && flowData) {
                flowData.forEach(f => {
                    if (f.m_date && f.pump_no) flowMap.set(`${f.m_date}_${f.pump_no}`, f.total_avg);
                });
            }

            // 3. Fetch Sampling Data
            const tableList = getTableList(startDate, endDate);
            const samplingQueries = tableList.map(async (tableName) => {
                const { data, error } = await supabase.from(tableName).select('*').gte('m_date', startDate).lte('m_date', endDate);
                return error ? [] : (data || []);
            });

            const results = await Promise.all(samplingQueries);
            const rawSampling = results.flat();
            const samplingKeys = new Set();
            if (rawSampling.length > 0) {
                Object.keys(rawSampling[0]).forEach(k => samplingKeys.add(k));
            }

            // 4. Dynamic Column and Source Detection
            const allKeysSet = new Set([...samplingKeys, ...hazardKeys, 'remark1', 'remark2', 'collection_time', 'avg_flow', 'air_volume', 'analyzer']);
            const sources = {};
            allKeysSet.forEach(k => {
                const meta = INITIAL_METADATA[k];
                if (meta?.source) sources[k] = meta.source;
                else if (samplingKeys.has(k)) sources[k] = 'sampling';
                else if (hazardKeys.has(k)) sources[k] = 'hazard';
                else sources[k] = 'custom';
            });
            setColSources(sources);

            const sortedKeys = Array.from(allKeysSet).sort((a, b) => {
                const srcWeight = { 'sampling': 1, 'hazard': 2, 'calc': 3, 'custom': 4 };
                if (sources[a] !== sources[b]) return (srcWeight[sources[a]] || 9) - (srcWeight[sources[b]] || 9);
                return (INITIAL_METADATA[a]?.label || a).localeCompare(INITIAL_METADATA[b]?.label || b);
            });
            setAllPossibleCols(sortedKeys);

            setAllPossibleCols(sortedKeys);

            // 5. Process and Join Data (with Regex Filtering)
            const processedData = [];
            const weightRegex = /^(DB|D)\d{3}-/; // D/DB + 3 digits + hyphen

            rawSampling.forEach(row => {
                // Regex-based gravimetric sample filtering
                if (row.sample_id && weightRegex.test(row.sample_id)) return;

                const substances = row.common_name ? row.common_name.split('/') : [''];
                substances.forEach(sub => {
                    const subTrim = sub.trim();
                    const hazardInfo = hazardMap[subTrim] || {};

                    // Filter out extraction method samples and noise samples as they are handled in their own dedicated dashboards
                    if (hazardInfo.instrument_name === '추출법') return;
                    if (subTrim === '소음') return;

                    const formatTime = (t) => {
                        if (!t) return '';
                        if (typeof t !== 'string') return t;
                        const pts = t.split(':');
                        return pts.length >= 2 ? `${pts[0].padStart(2, '0')}:${pts[1].padStart(2, '0')}` : t;
                    };

                    const rawStart = row.start_time;
                    const rawEnd = row.end_time;
                    const mins = calculateMinutes(rawStart, rawEnd, row.lunch_time);
                    const avgFlow = flowMap.get(`${row.m_date}_${row.pump_no}`) || 0;
                    const airVol = (mins * avgFlow).toFixed(3);

                    // 분석자 결정: is_self 기반
                    let analyzer = '-';
                    if (hazardInfo.is_self === '자체분석') analyzer = defaultAnalyst;
                    else if (hazardInfo.is_self === '외부의뢰') analyzer = defaultLab;

                    processedData.push({
                        ...hazardInfo,
                        ...row,
                        common_name: subTrim,
                        start_time: formatTime(rawStart),
                        end_time: formatTime(rawEnd),
                        collection_time: mins > 0 ? mins : '',
                        avg_flow: avgFlow > 0 ? avgFlow : '',
                        air_volume: airVol > 0 ? airVol : '',
                        analyzer,
                        remark1: '',
                        remark2: ''
                    });
                });
            });

            // 공시료 판별 함수 (worker_name에 '공시료' 포함 또는 sample_id가 DB/SB로 시작)
            const isBlankSample = (item) =>
                (item.worker_name || '').includes('공시료') ||
                (item.sample_id || '').startsWith('DB') ||
                (item.sample_id || '').startsWith('SB');

            // 사업장별 최소 시료번호(SEQ) 계산 (공시료 제외, com_name 원본 사용)
            const companyPriority = {};
            const getSeqNum = (id) => {
                if (!id) return 999999;
                const parts = id.split('-');
                if (parts.length < 2) return 999999;
                const seq = parseInt(parts[parts.length - 1], 10);
                return isNaN(seq) ? 999999 : seq;
            };
            processedData.forEach(item => {
                if (isBlankSample(item)) return;
                const com = item.com_name || '';
                const seq = getSeqNum(item.sample_id);
                if (!companyPriority[com] || seq < companyPriority[com]) companyPriority[com] = seq;
            });

            processedData.sort((a, b) => {
                // 1순위: 측정일자 (sortOrder 적용)
                const dateComp = (a.m_date || '').localeCompare(b.m_date || '');
                if (dateComp !== 0) return sortOrder === 'desc' ? -dateComp : dateComp;

                // 2순위: 사업장 대 사업장 비교 (com_name 원본 그대로, (주) 제거 안 함)
                const comA = a.com_name || '';
                const comB = b.com_name || '';

                // 같은 사업장이면 공시료 여부로 정렬 (공시료는 맨 뒤)
                if (comA === comB) {
                    const blankA = isBlankSample(a) ? 1 : 0;
                    const blankB = isBlankSample(b) ? 1 : 0;
                    if (blankA !== blankB) return blankA - blankB;
                    return (a.sample_id || '').localeCompare(b.sample_id || '');
                }

                // 다른 사업장: 해당 사업장의 최소 시료번호(SEQ)로 정렬
                const prioA = companyPriority[comA] ?? 999999;
                const prioB = companyPriority[comB] ?? 999999;
                if (prioA !== prioB) return prioA - prioB;
                return comA.localeCompare(comB);
            });

            let filtered = processedData;
            if (keyword) {
                const term = keyword.toLowerCase().replace(/\s/g, '');
                filtered = processedData.filter(item =>
                    (item.com_name || '').toLowerCase().includes(term) ||
                    (item.common_name || '').toLowerCase().includes(term) ||
                    (item.sample_id || '').toLowerCase().includes(term)
                );
            }
            setData(filtered);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // --- Custom Renderer for Tooltip (Truncation + Title) ---
    const mediaRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        if (value) {
            td.title = value; // Browser native tooltip
            td.style.whiteSpace = 'nowrap';
            td.style.overflow = 'hidden';
            td.style.textOverflow = 'ellipsis';
        }
        return td;
    };

    // --- Custom Renderer for Shrink-to-Fit (Analyzer, Company, etc.) ---
    const shrinkRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        if (value) {
            const strValue = String(value);
            const len = strValue.length;
            const currentWidth = instance.getColWidth(col) || 120;

            // Approximate calculation
            const estimatedWidth = len * 8.5;
            if (estimatedWidth > currentWidth - 10) {
                const ratio = (currentWidth - 10) / estimatedWidth;
                const newSize = Math.max(9, Math.floor(12 * ratio));
                td.style.fontSize = newSize + 'px';
            } else {
                td.style.fontSize = '';
            }
            td.style.whiteSpace = 'nowrap';
            td.style.overflow = 'hidden';
        }
        return td;
    };

    // Re-sort data when sortOrder changes
    useEffect(() => {
        setData(prev => {
            const next = [...prev];
            const isBlankSample = (item) =>
                (item.worker_name || '').includes('공시료') ||
                (item.sample_id || '').startsWith('DB') ||
                (item.sample_id || '').startsWith('SB');
            const companyPriority = {};
            const getSeqNum = (id) => {
                if (!id) return 999999;
                const parts = id.split('-');
                if (parts.length < 2) return 999999;
                const seq = parseInt(parts[parts.length - 1], 10);
                return isNaN(seq) ? 999999 : seq;
            };
            next.forEach(item => {
                if (isBlankSample(item)) return;
                const com = item.com_name || '';
                const seq = getSeqNum(item.sample_id);
                if (!companyPriority[com] || seq < companyPriority[com]) companyPriority[com] = seq;
            });
            next.sort((a, b) => {
                const dateComp = (a.m_date || '').localeCompare(b.m_date || '');
                if (dateComp !== 0) return sortOrder === 'desc' ? -dateComp : dateComp;
                const comA = a.com_name || '';
                const comB = b.com_name || '';
                if (comA === comB) {
                    const blankA = isBlankSample(a) ? 1 : 0;
                    const blankB = isBlankSample(b) ? 1 : 0;
                    if (blankA !== blankB) return blankA - blankB;
                    return (a.sample_id || '').localeCompare(b.sample_id || '');
                }
                const prioA = companyPriority[comA] ?? 999999;
                const prioB = companyPriority[comB] ?? 999999;
                if (prioA !== prioB) return prioA - prioB;
                return comA.localeCompare(comB);
            });
            return next;
        });
    }, [sortOrder]);

    // Initialize and sync Handsontable
    useEffect(() => {
        if (!hotRef.current) return;

        const columns = columnConfig.map(key => {
            const meta = INITIAL_METADATA[key] || {};
            const col = {
                data: key,
                title: meta.label || key,
                width: meta.width || 120,
                readOnly: true,
                className: 'htCenter htMiddle'
            };
            if (key === 'sampling_media') {
                col.renderer = mediaRenderer;
            } else if (['analyzer', 'com_name', 'work_process', 'worker_name'].includes(key)) {
                col.renderer = shrinkRenderer;
            }
            return col;
        });

        if (!hotInstance.current) {
            hotInstance.current = new Handsontable(hotRef.current, {
                data: data,
                columns: columns,
                rowHeaders: true,
                colHeaders: true,
                height: '100%',
                licenseKey: 'non-commercial-and-evaluation',
                stretchH: 'all',
                selectionMode: 'multiple',
                copyPaste: true,
                readOnly: true,
                outsideClickDeselects: false,
                fillHandle: false,
                manualColumnResize: true,
                autoColumnSize: false,
                contextMenu: ['copy'],
                className: 'htMiddle htCenter',
                afterGetColHeader: function (col, TH) {
                    const headerSpan = TH.querySelector('.colHeader');
                    if (!headerSpan) return;
                    const text = headerSpan.innerText;
                    if (!text) return;
                    const width = this.getColWidth(col) || 120;
                    const estimatedWidth = text.length * 10; // Header font is usually bolder/larger
                    if (estimatedWidth > width - 10) {
                        const ratio = (width - 10) / estimatedWidth;
                        const newSize = Math.max(8, Math.floor(12 * ratio));
                        headerSpan.style.fontSize = newSize + 'px';
                        headerSpan.style.lineHeight = 'normal';
                    } else {
                        headerSpan.style.fontSize = '';
                    }
                }
            });
        } else {
            hotInstance.current.updateSettings({
                columns: columns
            });
            hotInstance.current.loadData(data);
        }
    }, [data, columnConfig]);

    const downloadExcel = () => {
        if (data.length === 0) return alert('다운로드할 데이터가 없습니다.');
        const excelData = data.map(row => {
            const rd = {};
            columnConfig.forEach(key => {
                const label = INITIAL_METADATA[key]?.label || key;
                const val = row[key];
                rd[label] = (val === null || val === undefined) ? '' : val;
            });
            return rd;
        });
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "분석데이터가공");
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        XLSX.writeFile(wb, `분석데이터가공_${today}.xlsx`);
    };

    const getColClass = (key) => {
        const src = colSources[key];
        if (src === 'sampling') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (src === 'hazard') return 'bg-green-100 text-green-700 border-green-200';
        if (src === 'calc') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        if (src === 'custom') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        return 'bg-slate-50';
    };

    const resetColumns = () => {
        const defaults = ['sample_id', 'm_date', 'com_name', 'worker_name', 'common_name', 'start_time', 'end_time', 'collection_time', 'avg_flow', 'air_volume', 'remark1', 'remark2'];
        setColumnConfig(defaults.filter(k => allPossibleCols.includes(k)));
    };

    const unusedCols = allPossibleCols.filter(k => !columnConfig.includes(k));

    return e('div', { className: "flex-1 overflow-hidden flex flex-col pt-2" },
        e('div', { className: "flex items-center gap-3 mb-4 px-2 no-print font-sans" },
            // Filter Group (Left)
            e('div', { className: "flex items-center gap-4 mr-auto" },
                // Legend
                e('div', { className: "flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider mr-4 opacity-70" },
                    e('div', { className: "flex items-center gap-1.5" }, e('div', { className: "w-2.5 h-2.5 rounded-full bg-blue-400" }), e('span', { className: "text-blue-600" }, "시료")),
                    e('div', { className: "flex items-center gap-1.5" }, e('div', { className: "w-2.5 h-2.5 rounded-full bg-green-400" }), e('span', { className: "text-green-600" }, "인자")),
                    e('div', { className: "flex items-center gap-1.5" }, e('div', { className: "w-2.5 h-2.5 rounded-full bg-yellow-400" }), e('span', { className: "text-yellow-600" }, "계산"))
                ),
                onStartDateChange && e('div', { className: "flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm" },
                    e('input', { type: "date", value: startDate, onChange: e => onStartDateChange(e.target.value), className: "bg-transparent text-xs font-black outline-none w-32" }),
                    e('span', { className: "text-slate-400 text-xs" }, "~"),
                    e('input', { type: "date", value: endDate, onChange: e => onEndDateChange(e.target.value), className: "bg-transparent text-xs font-black outline-none w-32" })
                ),
                onKeywordChange && e('div', { className: "relative w-64" },
                    e(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400", size: 16 }),
                    e('input', {
                        type: "text",
                        value: keyword,
                        onChange: e => onKeywordChange(e.target.value),
                        placeholder: "분석 데이터 검색...",
                        className: "w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none shadow-sm focus:ring-2 focus:ring-violet-100 transition-all"
                    })
                )
            ),
            e('button', {
                onClick: () => { if (confirm('분석 데이터 추출 설정 및 필터를 초기화하시겠습니까?')) { onKeywordChange(''); onStartDateChange(new Date().toISOString().split('T')[0]); fetchData(); } },
                className: "px-3 py-2 bg-rose-50 text-rose-500 font-bold rounded-lg border border-rose-100 hover:bg-rose-100 transition-all active:scale-95 text-xs flex items-center gap-1.5"
            }, e(RotateCcw, { size: 14 }), "추출 초기화"),
            e('button', { onClick: downloadExcel, className: "px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow hover:bg-emerald-700 flex items-center gap-2 active:scale-95 transition-all text-sm" }, e(Download, { size: 16 }), "엑셀 다운로드")
        ),

        // --- New Stats & Mini Actions Bar ---
        e('div', { className: "flex items-center gap-4 px-2 mb-3 no-print" },
            e('div', { className: "flex items-center gap-2" },
                e('button', {
                    onClick: () => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'),
                    className: 'h-8 px-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg shadow-sm hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-95 text-[11px]'
                },
                    e(sortOrder === 'desc' ? SortDesc : SortAsc, { size: 13, className: 'text-indigo-600' }),
                    `정렬: ${sortOrder === 'desc' ? '최신순' : '과거순'}`
                ),
                e('button', {
                    onClick: () => setShowSettings(!showSettings),
                    className: `h-8 px-3 rounded-lg transition-all flex items-center gap-2 text-[11px] font-bold border ${showSettings ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`
                },
                    e(Settings2, { size: 13 }), "컬럼 설정"
                )
            ),
            e('div', { className: "h-4 w-px bg-slate-200 mx-1" }),
            e('span', { className: "text-xs font-bold text-slate-500" },
                `추출된 시료 데이터: `,
                e('span', { className: "text-indigo-600 ml-1" }, `${data.length.toLocaleString()}건`)
            )
        ),

        showSettings && e('div', { className: "card-custom p-6 mb-6 animate-fade-in no-print shrink-0 border-indigo-100 ring-4 ring-indigo-50/50 mx-2 shadow-xl bg-white relative z-20" },
            e('div', { className: "flex justify-between items-center mb-6" },
                e('h3', { className: "font-black text-slate-800 text-lg flex items-center gap-2" }, e(Settings2, { className: "text-indigo-600" }), "분석 데이터 추출 설정"),
                e('div', { className: "flex items-center gap-3" },
                    e('button', {
                        onClick: () => saveColumnConfigToDB(columnConfig),
                        disabled: settingsSaveStatus === 'saving',
                        className: (
                            settingsSaveStatus === 'saved' ? "px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200" :
                                settingsSaveStatus === 'error' ? "px-3 py-1.5 rounded-md text-xs font-bold bg-red-50 text-red-500 border border-red-200" :
                                    settingsSaveStatus === 'saving' ? "px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 text-slate-400" :
                                        "px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm"
                        )
                    },
                        settingsSaveStatus === 'saved' ? '✅ 저장 완료' :
                            settingsSaveStatus === 'error' ? '❌ 저장 실패' :
                                settingsSaveStatus === 'saving' ? '저장 중...' :
                                    '🌐 공유 저장'
                    ),
                    e('button', { onClick: resetColumns, className: "px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-1" }, e(RotateCcw, { size: 12 }), "초기화"),
                    e('button', { onClick: () => setColumnConfig(allPossibleCols), className: "px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors" }, "전체 컬럼 보기"),
                    e('button', { onClick: () => setShowSettings(false), className: "p-1.5 transition-colors hover:bg-slate-100 rounded-full text-slate-400" }, e(X, { size: 20 }))
                )
            ),
            e('p', { className: "text-[11px] text-indigo-500 bg-indigo-50 rounded-lg px-3 py-2 mb-4 font-bold" },
                "💡 컬럼 설정 후 [🌐 공유 저장]을 누르면 다른 컴퓨터/사용자에게도 동일하게 적용됩니다."
            ),
            e('div', { className: "mb-8" },
                e('div', { className: "flex flex-wrap gap-2.5 p-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200" },
                    columnConfig.map((key, idx) => {
                        const label = INITIAL_METADATA[key]?.label || key;
                        const srcClass = getColClass(key);
                        return e('div', { key: key, className: `group flex items-center gap-1.5 border rounded-xl px-2.5 py-2 shadow-sm transition-all hover:scale-105 active:scale-95 ${srcClass}` },
                            e('button', { onClick: () => { const next = [...columnConfig]; if (idx > 0) { [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setColumnConfig(next); } }, disabled: idx === 0, className: `p-0.5 rounded ${idx === 0 ? 'opacity-20' : 'hover:bg-black/5'}` }, e(ChevronLeft, { size: 14 })),
                            e('span', { className: "text-xs font-black px-1" }, label),
                            e('button', { onClick: () => { const next = [...columnConfig]; if (idx < columnConfig.length - 1) { [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setColumnConfig(next); } }, disabled: idx === columnConfig.length - 1, className: `p-0.5 rounded ${idx === columnConfig.length - 1 ? 'opacity-20' : 'hover:bg-black/5'}` }, e(ChevronRight, { size: 14 })),
                            e('button', { onClick: () => setColumnConfig(columnConfig.filter(k => k !== key)), className: "ml-1 p-0.5 hover:bg-red-500 hover:text-white rounded-md transition-colors" }, e(X, { size: 14 }))
                        );
                    })
                )
            ),
            e('div', { className: "pt-6 border-t border-slate-100" },
                e('div', { className: "flex flex-wrap gap-2" },
                    unusedCols.map(key => {
                        const label = INITIAL_METADATA[key]?.label || key;
                        const srcClass = getColClass(key);
                        return e('button', { key: key, onClick: () => setColumnConfig([...columnConfig, key]), className: `px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all hover:scale-105 active:scale-95 ${srcClass}` }, e('span', { className: "mr-1.5 opacity-40 text-lg leading-none" }, "+"), label);
                    })
                )
            )
        ),

        e('div', { className: "card-custom flex-1 overflow-hidden flex flex-col min-h-0 bg-white shadow-sm ring-1 ring-slate-200" },
            e('div', { className: "flex-1 overflow-hidden" },
                e('div', { ref: hotRef, className: "w-full h-full" })
            )
        )
    );
}

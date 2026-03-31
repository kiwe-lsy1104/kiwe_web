import React, { useState, useEffect, useMemo, useRef, useCallback } from 'https://esm.sh/react@18.2.0';
import {
    Search, Download, Filter, Trash2, Calendar, Settings2, RotateCcw,
    ChevronLeft, ChevronRight, X, Plus, CheckSquare, SortAsc, SortDesc, Box, AlertCircle, Printer
} from 'https://esm.sh/lucide-react@0.263.1';

// --- Virtual Scroll 설정 ---
const ROW_HEIGHT = 40; // px
const BUFFER = 10;     // 상하 버퍼 행 수

const DB_SETTINGS_KEY = 'external_request_column_config';

const ALL_COLUMNS = [
    { key: 'corp_code', label: '공단코드', width: 80, source: 'sampling' },
    { key: 'sample_id', label: '시료번호', width: 110, source: 'sampling' },
    { key: 'blank_sample_no', label: '공시료번호', width: 100, source: 'sampling' },
    { key: 'm_date', label: '측정일자', width: 90, source: 'sampling' },
    { key: 'com_name', label: '사업장명', width: 160, source: 'sampling' },
    { key: 'work_process', label: '공정명', width: 130, source: 'sampling' },
    { key: 'worker_name', label: '근로자명', width: 80, source: 'sampling' },
    { key: 'common_name', label: '유해인자', width: 150, source: 'sampling' },
    { key: 'collection_time', label: '포집시간(분)', width: 90, source: 'calc' },
    { key: 'avg_flow', label: '평균유량', width: 80, source: 'calc' },
    { key: 'air_volume', label: '채기량(L)', width: 80, source: 'calc' },
    { key: 'sampling', label: '채취방법', width: 120, source: 'hazard' },
    { key: 'sampling_media', label: '채취매체', width: 120, source: 'hazard' },
    { key: 'is_self', label: '분석구분', width: 80, source: 'sampling' },
    { key: 'remarks', label: '비고', width: 150, source: 'custom' },
];

export function ExternalRequestManager({ supabase, sessionData }) {
    const e = React.createElement;

    // View State: 'new' (당일 외부의뢰 추출 및 새 의뢰) vs 'history' (누적 의뢰 조회)
    const [viewMode, setViewMode] = useState('new');

    // --- [New Mode] State ---
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [keyword, setKeyword] = useState('');
    const [listFilter, setListFilter] = useState('');

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isExcelDownloaded, setIsExcelDownloaded] = useState(false);
    const [sortOrder, setSortOrder] = useState('asc');

    // UI & Scroll
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(500);
    const scrollContainerRef = useRef(null);
    const masterCbRef = useRef(null);
    const resizingRef = useRef(null);

    // Column Config
    const [columnConfig, setColumnConfig] = useState(['corp_code', 'sample_id', 'blank_sample_no', 'm_date', 'com_name', 'work_process', 'worker_name', 'common_name', 'collection_time', 'avg_flow', 'air_volume', 'sampling', 'sampling_media', 'is_self', 'remarks']);
    const [columnWidths, setColumnWidths] = useState({});
    const [showSettings, setShowSettings] = useState(false);
    const [settingsSaveStatus, setSettingsSaveStatus] = useState('');

    // Request Registration Modal
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [partners, setPartners] = useState([]);
    const [registerForm, setRegisterForm] = useState({
        partner_id: '',
        expected_receive_date: '',
        total_count: 0
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- [History Mode] State ---
    const currentYear = new Date().getFullYear();
    const [historyYear, setHistoryYear] = useState(currentYear);
    const [historyHalf, setHistoryHalf] = useState(new Date().getMonth() + 1 <= 6 ? 1 : 2);
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySortOrder, setHistorySortOrder] = useState('desc'); // 'desc': 최신순, 'asc': 과거순

    // --- [History Detail Modal] State ---
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailRow, setDetailRow] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);

    const historyStats = useMemo(() => {
        const total = historyData.length;
        const pending = historyData.filter(r => r.status === '의뢰중').length;
        const overdue = historyData.filter(r => {
            if (r.status !== '의뢰중' || !r.expected_receive_date) return false;
            // 오늘 날짜 00:00:00 기준 비교
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return new Date(r.expected_receive_date) < today;
        }).length;
        return { total, pending, overdue };
    }, [historyData]);


    // ==========================================
    // Lifecycle & Data Fetch (New Mode)
    // ==========================================
    useEffect(() => {
        fetchColumnConfigFromDB();
        fetchPartners();

        const handleEsc = ev => { if (ev.key === 'Escape') { setShowSettings(false); setShowRegisterModal(false); } };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    useEffect(() => {
        if (!scrollContainerRef.current) return;
        const obs = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });
        obs.observe(scrollContainerRef.current);
        return () => obs.disconnect();
    }, [viewMode]);

    // ── 컬럼 너비 기본값 ──
    useEffect(() => {
        const STORAGE_KEY_WIDTHS = 'KIWE_EXT_COL_WIDTHS';
        try {
            const saved = localStorage.getItem(STORAGE_KEY_WIDTHS);
            if (saved) {
                setColumnWidths(JSON.parse(saved));
                return;
            }
        } catch { }
        const defaults = {};
        ALL_COLUMNS.forEach(c => { defaults[c.key] = c.width; });
        setColumnWidths(defaults);
    }, []);

    const fetchColumnConfigFromDB = async () => {
        try {
            const { data: dbData, error } = await supabase.from('kiwe_app_settings').select('value').eq('key', DB_SETTINGS_KEY).single();
            if (!error && dbData && Array.isArray(dbData.value)) {
                setColumnConfig(dbData.value);
            }
        } catch (err) { console.warn('컬럼 설정 로드 실패', err); }
    };

    const saveColumnConfigToDB = async (config) => {
        setSettingsSaveStatus('saving');
        try {
            const { error } = await supabase.from('kiwe_app_settings').upsert({ key: DB_SETTINGS_KEY, value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (error) throw error;
            setSettingsSaveStatus('saved');
            setTimeout(() => setSettingsSaveStatus(''), 2500);
        } catch (err) { setSettingsSaveStatus('error'); setTimeout(() => setSettingsSaveStatus(''), 3000); }
    };

    const fetchPartners = async () => {
        const { data, error } = await supabase.from('kiwe_partners').select('partner_id, partner_name').eq('category', '분석기관').order('partner_name');
        if (!error && data) setPartners(data);
    };

    // ── Helper ──
    const getTableName = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return `kiwe_sampling_${d.getFullYear()}_${d.getMonth() + 1 <= 6 ? 1 : 2}`;
    };

    const getTableList = (start, end) => {
        if (!start || !end) return [];
        const tables = new Set();
        tables.add(getTableName(start));
        let cur = new Date(start);
        const endD = new Date(end);
        while (cur <= endD) {
            tables.add(getTableName(cur.toISOString().split('T')[0]));
            cur.setMonth(cur.getMonth() + 6);
        }
        tables.add(getTableName(end));
        return Array.from(tables);
    };

    const calculateMinutes = (start, end, lunchTime) => {
        if (!start || !end) return 0;
        try {
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diff < 0) diff += 1440;
            return Math.max(0, diff - (parseInt(lunchTime) || 0));
        } catch { return 0; }
    };

    const addBusinessDays = (date, days) => {
        const result = new Date(date);
        let added = 0;
        while (added < days) {
            result.setDate(result.getDate() + 1);
            const day = result.getDay();
            if (day !== 0 && day !== 6) { // 0: Sunday, 6: Saturday
                added++;
            }
        }
        return result;
    };

    // ── Fetch New Mode Data ──
    const fetchData = async () => {
        setLoading(true);
        setIsExcelDownloaded(false);
        try {
            const tableList = getTableList(startDate, endDate);
            const rawArrays = await Promise.all(
                tableList.map(async tn => {
                    try {
                        const { data: d, error } = await supabase.from(tn).select('*').gte('m_date', startDate).lte('m_date', endDate);
                        return error ? [] : (d || []);
                    } catch { return []; }
                })
            );
            const rawData = rawArrays.flat();

            const [flowRes, hazardRes] = await Promise.all([
                supabase.from('kiwe_flow').select('m_date, pump_no, total_avg').gte('m_date', startDate).lte('m_date', endDate),
                supabase.from('kiwe_hazard').select('*')
            ]);

            const hazardMap = new Map((hazardRes.data || []).map(h => [h.common_name, h]));
            const flowMap = new Map();
            (flowRes.data || []).forEach(f => {
                if (f.m_date && f.pump_no) flowMap.set(`${f.m_date}_${f.pump_no}`, f.total_avg);
            });

            const blankMap = new Map();
            rawData.forEach(row => {
                const isBlank = (row.worker_name?.includes('공시료')) || (row.sample_id?.startsWith('DB') || row.sample_id?.startsWith('SB'));
                if (isBlank) {
                    const gk = `${row.com_name || ''}_${row.m_date || ''}_${row.common_name || ''}`;
                    if (!blankMap.has(gk)) blankMap.set(gk, []);
                    blankMap.get(gk).push(row.sample_id);
                }
            });

            const enriched = rawData
                .filter(row => {
                    const isBlank = row.worker_name?.includes('공시료') || row.sample_id?.startsWith('DB') || row.sample_id?.startsWith('SB');
                    return !isBlank; // 공시료 제외
                })
                .map(row => {
                    const searchKey = row.common_name ? row.common_name.split('/')[0].trim() : '';
                    const hazardInfo = hazardMap.get(searchKey) || {};
                    const minutes = calculateMinutes(row.start_time, row.end_time, row.lunch_time);
                    const avgFlow = flowMap.get(`${row.m_date}_${row.pump_no}`) || 0;
                    const gk = `${row.com_name || ''}_${row.m_date || ''}_${row.common_name || ''}`;
                    return {
                        ...hazardInfo, ...row,
                        corp_code: '',
                        collection_time: minutes > 0 ? minutes : '',
                        avg_flow: avgFlow > 0 ? avgFlow : '-',
                        air_volume: (minutes > 0 && avgFlow > 0) ? (minutes * avgFlow).toFixed(3) : '-',
                        blank_sample_no: (blankMap.get(gk) || []).join('/')
                    };
                })
                .filter(r => r.is_self === '외부의뢰'); // ★ 외부의뢰만 필터링

            // 키워드 필터링
            let finalData = enriched;
            if (keyword) {
                const term = keyword.replace(/\(주\)|㈜|\s/g, '').toLowerCase();
                finalData = enriched.filter(r =>
                    (r.com_name || '').replace(/\(주\)|㈜|\s/g, '').toLowerCase().includes(term) ||
                    (r.common_name || '').toLowerCase().includes(term) ||
                    (r.sample_id || '').toLowerCase().includes(term)
                );
            }

            finalData.sort((a, b) => {
                const comp = (a.m_date || '').localeCompare(b.m_date || '');
                if (comp !== 0) return sortOrder === 'desc' ? -comp : comp;
                return (a.sample_id || '').localeCompare(b.sample_id || '');
            });

            setData(finalData);
            setSelectedIds(new Set());
            setListFilter('');
        } catch (err) { alert('데이터 조회 실패: ' + err.message); }
        finally { setLoading(false); }
    };

    // ── 리스트 내 실시간 필터 ──
    const filteredData = useMemo(() => {
        if (!listFilter.trim()) return data;
        const term = listFilter.replace(/\(주\)|㈜|\s/g, '').toLowerCase();
        return data.filter(row =>
            (row.com_name || '').replace(/\(주\)|㈜|\s/g, '').toLowerCase().includes(term) ||
            (row.common_name || '').toLowerCase().includes(term) ||
            (row.sample_id || '').toLowerCase().includes(term) ||
            (row.worker_name || '').toLowerCase().includes(term) ||
            (row.m_date || '').includes(term)
        );
    }, [data, listFilter]);

    const allFilteredIds = useMemo(() => filteredData.map(r => r.sample_id), [filteredData]);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
    const isPartial = !isAllSelected && allFilteredIds.some(id => selectedIds.has(id));

    useEffect(() => {
        if (masterCbRef.current) masterCbRef.current.indeterminate = isPartial;
    }, [isPartial, isAllSelected]);

    const toggleSelectAll = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (isAllSelected) allFilteredIds.forEach(id => next.delete(id));
            else allFilteredIds.forEach(id => next.add(id));
            return next;
        });
    };

    const toggleSelectRow = id => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // ── 엑셀 다운로드 ──
    const downloadExcel = (customRows = null, partnerName = '', requestDate = '') => {
        let target = customRows || (selectedIds.size > 0 ? filteredData.filter(r => selectedIds.has(r.sample_id)) : filteredData);
        if (target.length === 0) return alert('데이터 없음');

        const excelData = target.map(row => {
            const obj = {};
            columnConfig.forEach(key => {
                const col = ALL_COLUMNS.find(c => c.key === key);
                const label = col ? col.label : key;
                obj[label] = row[key] ?? '';
            });
            return obj;
        });
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '외부분석의뢰');

        const dateStr = requestDate || startDate;
        const namePart = partnerName ? `${partnerName}` : '외부의뢰';
        const filename = `${namePart}(${dateStr}).xlsx`;
        XLSX.writeFile(wb, filename);

        if (selectedIds.size > 0 && !customRows) {
            setIsExcelDownloaded(true);
        }
    };

    // ── 의뢰 등록 모달 열기 ──
    const openRegisterModal = () => {
        if (selectedIds.size === 0) return alert('의뢰할 시료를 선택하세요.');

        // 선택된 시료의 (사업장 + 유해인자) 조합별로 공시료 수 계산 (조합별 공시료 2개 추가)
        const selectedRows = data.filter(r => selectedIds.has(r.sample_id));
        const pairs = new Set();
        selectedRows.forEach(r => {
            if (r.com_name && r.common_name) {
                pairs.add(`${r.com_name}_${r.common_name}`);
            }
        });
        const initialTotal = selectedIds.size + (pairs.size * 2);

        const targetDate = addBusinessDays(new Date(), 16);
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');

        setRegisterForm({
            partner_id: partners.length > 0 ? partners[0].partner_id : '',
            expected_receive_date: `${yyyy}-${mm}-${dd}`,
            total_count: initialTotal
        });
        setShowRegisterModal(true);
    };

    // ── 의뢰 등록 (DB 저장) ──
    const handleRegisterRequest = async () => {
        if (!registerForm.partner_id) return alert('분석기관을 선택하세요.');
        if (!registerForm.expected_receive_date) return alert('결과수신예정일을 입력하세요.');

        setIsSubmitting(true);
        try {
            // 현재 로그인 사용자 정보 가져오기 (auth 저장소 이용 또는 세션 이용 - 여기서는 localstorage의 사용자 정보 가정)
            const localUser = localStorage.getItem('kiwe_user');
            let createdBy = 'Unknown User';
            if (localUser) {
                try {
                    const u = JSON.parse(localUser);
                    createdBy = u.user_name || u.email || 'Unknown';
                } catch (e) { }
            }

            // 1. kiwe_requests 마스터 추가
            const { data: requestRes, error: reqErr } = await supabase.from('kiwe_requests').insert({
                request_date: today,
                partner_id: registerForm.partner_id,
                expected_receive_date: registerForm.expected_receive_date,
                created_by: createdBy,
                status: '의뢰중',
                total_count: parseInt(registerForm.total_count) || 0
            }).select('id').single();

            if (reqErr) throw reqErr;
            const requestId = requestRes.id;

            // 2. kiwe_request_items 추가
            const items = Array.from(selectedIds).map(sampleId => ({
                request_id: requestId,
                sample_id: sampleId
            }));

            const { error: itemsErr } = await supabase.from('kiwe_request_items').insert(items);
            if (itemsErr) throw itemsErr;

            alert('외부의뢰가 성공적으로 등록되었습니다.');
            setShowRegisterModal(false);
            setSelectedIds(new Set());
            setIsExcelDownloaded(false);
            setViewMode('history'); // 내역으로 이동

        } catch (err) {
            alert('의뢰 등록 중 오류: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ==========================================
    // History Mode
    // ==========================================
    useEffect(() => {
        if (viewMode === 'history') {
            fetchHistory();
        }
    }, [viewMode, historyYear, historyHalf, historySortOrder]);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            // 해당 연/반기의 파티션에 맞는 기간 도출 (실제로는 request_date 기준)
            const mStart = historyHalf === 1 ? '01' : '07';
            const mEnd = historyHalf === 1 ? '06' : '12';
            const dEnd = historyHalf === 1 ? '30' : '31';

            const fromDate = `${historyYear}-${mStart}-01`;
            const toDate = `${historyYear}-${mEnd}-${dEnd}`;

            const { data, error } = await supabase
                .from('kiwe_requests')
                .select(`
                    *,
                    kiwe_partners ( partner_name ),
                    kiwe_request_items ( count )
                `)
                .gte('request_date', fromDate)
                .lte('request_date', toDate)
                .order('request_date', { ascending: historySortOrder === 'asc' })
                .order('id', { ascending: historySortOrder === 'asc' });

            if (error) throw error;
            setHistoryData(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const openDetailModal = (row) => {
        if (!row) {
            console.error('openDetailModal: row is null');
            return;
        }
        // alert('상세 내역을 불러옵니다: ' + row.request_date);
        setDetailRow(row);
        setShowDetailModal(true);
        setDetailItems([]);
        setDetailLoading(true);

        const fetchDetails = async () => {
            try {
                const { data: itemData, error: itemErr } = await supabase
                    .from('kiwe_request_items')
                    .select('sample_id')
                    .eq('request_id', row.id);
                if (itemErr) throw itemErr;

                if (!itemData || itemData.length === 0) {
                    setDetailLoading(false);
                    return;
                }

                const sampleIds = itemData.map(d => d.sample_id);

                // 시료 정보 조회 (최근 1년치 파티션 검색)
                const d = new Date(row.request_date);
                const currentY = d.getFullYear();
                const currentH = d.getMonth() + 1 <= 6 ? 1 : 2;

                const tables = [
                    `kiwe_sampling_${currentY}_${currentH}`,
                    `kiwe_sampling_${currentY}_${currentH === 1 ? 2 : 1}`
                ];

                let mainSamples = [];
                for (const tn of tables) {
                    const { data, error } = await supabase
                        .from(tn)
                        .select('sample_id, m_date, com_name, work_process, worker_name, common_name')
                        .in('sample_id', sampleIds);
                    if (!error && data) mainSamples = [...mainSamples, ...data];
                    if (mainSamples.length >= sampleIds.length) break;
                }

                // 공시료(Blank)를 포함한 전체 통계를 위해 해당 일자의 모든 시료 조회
                const uniqueDates = Array.from(new Set(mainSamples.map(s => s.m_date))).filter(d => d);
                let allSamplesForDates = [];
                for (const tn of tables) {
                    const { data, error } = await supabase
                        .from(tn)
                        .select('sample_id, m_date, com_name, worker_name, common_name')
                        .in('m_date', uniqueDates);
                    if (!error && data) allSamplesForDates = [...allSamplesForDates, ...data];
                }

                // 해당 '사업장+유해인자' 조합에 해당하는 공시료 필터링
                const combinations = new Set(mainSamples.map(s => `${s.com_name}|${s.common_name}`));
                const blanks = allSamplesForDates.filter(s => {
                    const isBlank = s.worker_name?.includes('공시료') || s.sample_id?.startsWith('DB') || s.sample_id?.startsWith('SB');
                    return isBlank && combinations.has(`${s.com_name}|${s.common_name}`);
                });

                // 상세 목록에는 의뢰된 원본 시료만 표시하되, 통계용으로 blanks 합산
                setDetailItems([...mainSamples, ...blanks]);
            } catch (err) {
                console.error('Detail fetch error:', err);
            } finally {
                setDetailLoading(false);
            }
        };

        fetchDetails();
    };

    const downloadHistoryExcel = async (row) => {
        try {
            // 해당 의뢰건의 시료 ID 목록 가져오기
            const { data: itemData, error: itemErr } = await supabase
                .from('kiwe_request_items')
                .select('sample_id')
                .eq('request_id', row.id);
            if (itemErr) throw itemErr;
            if (!itemData || itemData.length === 0) return alert('의뢰된 시료 정보가 없습니다.');

            const sampleIds = itemData.map(d => d.sample_id);

            // 1. 등록된 시료의 기본 정보 가져오기
            const year = row.request_date.split('-')[0];
            const tables = [`kiwe_sampling_${year}_1`, `kiwe_sampling_${year}_2`].filter(t => t);

            const fetchedArrays = await Promise.all(
                tables.map(async tn => {
                    const { data, error } = await supabase.from(tn).select('*').in('sample_id', sampleIds);
                    return error ? [] : (data || []);
                })
            );
            const mainSamples = fetchedArrays.flat();
            if (mainSamples.length === 0) return alert('시료 원본 데이터를 찾을 수 없습니다.');

            // 2. 공시료 조회를 위해 해당 일자의 모든 데이터 가져오기
            const uniqueDates = Array.from(new Set(mainSamples.map(s => s.m_date))).filter(d => d);
            const allSamplesArrays = await Promise.all(
                tables.map(async tn => {
                    const { data, error } = await supabase.from(tn).select('*').in('m_date', uniqueDates);
                    return error ? [] : (data || []);
                })
            );
            const allSamples = allSamplesArrays.flat();

            // 3. 공시료 맵 생성
            const blankMap = new Map();
            allSamples.forEach(r => {
                const isBlank = (r.worker_name?.includes('공시료')) || (r.sample_id?.startsWith('DB') || r.sample_id?.startsWith('SB'));
                if (isBlank) {
                    const gk = `${r.com_name || ''}_${r.m_date || ''}_${r.common_name || ''}`;
                    if (!blankMap.has(gk)) blankMap.set(gk, []);
                    blankMap.get(gk).push(r.sample_id);
                }
            });

            // 4. 유해인자 및 유량 정보 보완
            const [flowRes, hazardRes] = await Promise.all([
                supabase.from('kiwe_flow').select('m_date, pump_no, total_avg').in('m_date', uniqueDates),
                supabase.from('kiwe_hazard').select('*')
            ]);

            const hazardMap = new Map((hazardRes.data || []).map(h => [h.common_name, h]));
            const flowMap = new Map();
            (flowRes.data || []).forEach(f => flowMap.set(`${f.m_date}_${f.pump_no}`, f.total_avg));

            // 5. 데이터 병합 및 가공
            const enriched = mainSamples.map(r => {
                const searchKey = r.common_name ? r.common_name.split('/')[0].trim() : '';
                const hazardInfo = hazardMap.get(searchKey) || {};
                const minutes = calculateMinutes(r.start_time, r.end_time, r.lunch_time);
                const avgFlow = flowMap.get(`${r.m_date}_${r.pump_no}`) || 0;
                const gk = `${r.com_name || ''}_${r.m_date || ''}_${r.common_name || ''}`;

                return {
                    ...hazardInfo, ...r,
                    corp_code: '', // 공단코드는 비워둠 (필요시 추가)
                    collection_time: minutes > 0 ? minutes : '',
                    avg_flow: avgFlow > 0 ? avgFlow : '-',
                    air_volume: (minutes > 0 && avgFlow > 0) ? (minutes * avgFlow).toFixed(3) : '-',
                    blank_sample_no: (blankMap.get(gk) || []).join('/')
                };
            });

            // 6. 엑셀 생성 (New Mode와 동일한 downloadExcel 함수 사용)
            downloadExcel(enriched, row.kiwe_partners?.partner_name, row.request_date);
        } catch (err) {
            alert('히스토리 엑셀 생성 실패: ' + err.message);
        }
    };

    const updateRequest = async (id, field, value) => {
        try {
            let finalValue = value;
            let updatePayload = {};

            // 발신공문번호(document_no) 자동 포맷팅
            if (field === 'document_no' && value) {
                const trimmed = value.trim();
                // 숫자만 입력된 경우 (예: 2 -> KI-발외-26-0002)
                if (/^\d+$/.test(trimmed)) {
                    const row = historyData.find(r => r.id === id);
                    const year = row?.request_date ? new Date(row.request_date).getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);
                    finalValue = `KI-발외-${year}-${trimmed.padStart(4, '0')}`;
                } else {
                    finalValue = trimmed;
                }
            }

            updatePayload[field] = finalValue;

            // 수신일(receive_date) 변경 시 상태 자동 변경
            if (field === 'receive_date') {
                if (finalValue) updatePayload.status = '결과수령완료';
                else updatePayload.status = '의뢰중';
            }

            const { error } = await supabase.from('kiwe_requests').update(updatePayload).eq('id', id);
            if (error) throw error;

            setHistoryData(prev => prev.map(r => r.id === id ? { ...r, ...updatePayload } : r));
        } catch (err) {
            alert('업데이트 실패: ' + err.message);
        }
    };

    const deleteRequest = async (id) => {
        if (!confirm('해당 외부의뢰 내역을 삭제하시겠습니까? (관련 시료 매핑정보도 함께 삭제옵니다)')) return;
        try {
            const { error } = await supabase.from('kiwe_requests').delete().eq('id', id);
            if (error) throw error;
            setHistoryData(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert('삭제 실패: ' + err.message);
        }
    };

    // ── 컬럼 관리 ──
    const currentCols = columnConfig;
    const unusedCols = ALL_COLUMNS.filter(c => !currentCols.includes(c.key));

    const toggleColumn = key => {
        setColumnConfig(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const moveColumn = (idx, dir) => {
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= columnConfig.length) return;
        const arr = [...columnConfig];
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
        setColumnConfig(arr);
    };

    const resetColumns = () => {
        if (!confirm('컬럼 구성을 초기화하시겠습니까?')) return;
        const defaults = ['corp_code', 'sample_id', 'blank_sample_no', 'm_date', 'com_name', 'work_process', 'worker_name', 'common_name', 'collection_time', 'avg_flow', 'air_volume', 'sampling', 'sampling_media', 'is_self', 'remarks'];
        setColumnConfig(defaults);
        const defaultWidths = {};
        ALL_COLUMNS.forEach(c => { defaultWidths[c.key] = c.width; });
        setColumnWidths(defaultWidths);
        localStorage.removeItem('KIWE_EXT_COL_WIDTHS');
    };


    // ==========================================
    // UI Renderers
    // ==========================================

    // (New Mode) Virtual Scroll Calculations
    const totalRows = filteredData.length;
    const visibleCnt = Math.ceil(containerHeight / ROW_HEIGHT) + BUFFER * 2;
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
    const endIdx = Math.min(totalRows, startIdx + visibleCnt);
    const topPad = startIdx * ROW_HEIGHT;
    const bottomPad = Math.max(0, (totalRows - endIdx) * ROW_HEIGHT);

    const handleColResizeStart = useCallback((key, ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const startX = ev.clientX;
        const startW = columnWidths[key] || ALL_COLUMNS.find(c => c.key === key)?.width || 120;
        resizingRef.current = { key, startX, startW };
        document.body.classList.add('col-resizing');

        const onMove = (mv) => {
            const delta = mv.clientX - resizingRef.current.startX;
            const newW = Math.max(40, resizingRef.current.startW + delta);
            setColumnWidths(prev => ({ ...prev, [resizingRef.current.key]: newW }));
        };
        const onUp = () => {
            resizingRef.current = null;
            document.body.classList.remove('col-resizing');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            localStorage.setItem('KIWE_EXT_COL_WIDTHS', JSON.stringify(columnWidths));
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [columnWidths]);

    const getColSourceClass = key => {
        const col = ALL_COLUMNS.find(c => c.key === key);
        if (!col) return 'bg-slate-50';
        if (col.source === 'sampling') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (col.source === 'hazard') return 'bg-green-100 text-green-700 border-green-200';
        if (col.source === 'calc') return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-slate-50';
    };


    // ==========================================
    // Render
    // ==========================================
    return e('div', { className: 'h-full flex flex-col font-sans overflow-hidden relative' },
        /* ── 외부의뢰 상세 내역 모달 ── */
        showDetailModal && e('div', { className: 'fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm no-print' },
            e('div', { className: 'bg-white rounded-2xl shadow-2xl w-[850px] max-h-[85vh] flex flex-col overflow-hidden animate-fade-in ring-1 ring-black/5' },
                e('div', { className: 'px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50' },
                    e('div', null,
                        e('h2', { className: 'text-lg font-black text-slate-800 flex items-center gap-2' }, e(Plus, { className: 'text-indigo-600', size: 20 }), '의뢰 상세 내역'),
                        e('p', { className: 'text-xs text-slate-500 font-bold mt-1' }, `${detailRow?.request_date} | ${detailRow?.kiwe_partners?.partner_name || 'N/A'}`)
                    ),
                    e('button', { onClick: () => setShowDetailModal(false), className: 'text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors' }, e(X, { size: 24 }))
                ),
                e('div', { className: 'flex-1 overflow-auto p-0 scroll-custom' },
                    detailLoading ? e('div', { className: 'py-20 text-center' },
                        e('div', { className: 'flex flex-col items-center gap-3 text-slate-400' }, e('div', { className: 'w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin' }), e('span', { className: 'font-bold' }, '상세 정보를 불러오는 중...'))
                    ) :
                        e('div', { className: 'flex flex-col' },
                            /* Summary Cards Area */
                            e('div', { className: 'px-6 py-3 bg-indigo-50/30 flex flex-wrap gap-2 border-b border-indigo-100/50' },
                                (() => {
                                    const stats = {};
                                    detailItems.forEach(item => {
                                        const name = item.common_name || '미지물질';
                                        if (!stats[name]) stats[name] = { main: 0, blank: 0 };
                                        const isBlank = item.worker_name?.includes('공시료') || item.sample_id?.startsWith('DB') || item.sample_id?.startsWith('SB');
                                        if (isBlank) stats[name].blank++;
                                        else stats[name].main++;
                                    });
                                    const items = Object.entries(stats).map(([name, data]) => ({ name, ...data }));
                                    if (items.length === 0) return e('span', { className: 'text-slate-400 text-xs font-bold' }, '기록된 시료가 없습니다.');
                                    return items.map(s => e('div', { key: s.name, className: 'bg-white px-3 py-1.5 rounded-lg shadow-sm border border-indigo-100 flex items-center gap-2 whitespace-nowrap' },
                                        e('span', { className: 'text-[11px] font-black text-slate-700 border-r border-slate-200 pr-2 mr-1' }, s.name),
                                        e('span', { className: 'text-[11px] font-black text-indigo-600' }, `시료 ${s.main}`),
                                        s.blank > 0 && e('span', { className: 'text-[11px] font-black text-rose-500' }, `공시료 ${s.blank}`)
                                    ));
                                })()
                            ),
                            e('table', { className: 'w-full text-left border-collapse' },
                                e('thead', { className: 'sticky top-0 bg-slate-100/80 backdrop-blur z-10' },
                                    e('tr', null,
                                        ['시료번호', '측정일자', '사업장명', '공정/장소', '근로자명', '유해인자'].map(h =>
                                            e('th', { key: h, className: 'px-4 py-3 text-[11px] font-black text-slate-500 uppercase border-b border-slate-200 text-center' }, h)
                                        )
                                    )
                                ),
                                e('tbody', null,
                                    detailItems.filter(item => !(item.worker_name?.includes('공시료') || item.sample_id?.startsWith('DB') || item.sample_id?.startsWith('SB'))).length === 0 ? e('tr', null, e('td', { colSpan: 6, className: 'py-24 text-center text-slate-400 font-bold' }, '표시할 시료가 없습니다.')) :
                                        detailItems.filter(item => !(item.worker_name?.includes('공시료') || item.sample_id?.startsWith('DB') || item.sample_id?.startsWith('SB'))).map(item => e('tr', { key: item.sample_id, className: 'border-b border-slate-50 hover:bg-slate-50 transition-colors' },
                                            e('td', { className: 'px-4 py-3 text-center font-mono text-xs text-indigo-700 font-bold' }, item.sample_id),
                                            e('td', { className: 'px-4 py-3 text-center text-xs' }, item.m_date),
                                            e('td', { className: 'px-4 py-3 text-center text-xs font-bold' }, item.com_name),
                                            e('td', { className: 'px-4 py-3 text-center text-xs' }, item.work_process),
                                            e('td', { className: 'px-4 py-3 text-center text-xs' }, item.worker_name),
                                            e('td', { className: 'px-4 py-3 text-center text-xs' }, item.common_name),
                                        ))
                                )
                            )
                        )
                ),
                e('div', { className: 'px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end' },
                    e('button', { onClick: () => setShowDetailModal(false), className: 'px-6 py-2 rounded-xl font-black text-white bg-slate-800 hover:bg-slate-900 shadow-lg transition-all active:scale-95' }, '닫기')
                )
            )
        ),

        // ── 뷰 토글 탭 (Sub Header) ──
        e('div', { className: 'flex justify-between items-center mb-4 px-2 no-print shrink-0' },
            e('div', { className: 'flex bg-slate-200/50 p-1.5 rounded-xl gap-1 shadow-inner border border-slate-200/50' },
                e('button', {
                    onClick: () => setViewMode('new'),
                    className: `px-6 py-2.5 rounded-lg text-sm font-black transition-all duration-300 flex items-center gap-2 ${viewMode === 'new' ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`
                }, e(Plus, { size: 16 }), '신규 의뢰 추출'),
                e('button', {
                    onClick: () => setViewMode('history'),
                    className: `px-6 py-2.5 rounded-lg text-sm font-black transition-all duration-300 flex items-center gap-2 ${viewMode === 'history' ? 'bg-white text-emerald-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`
                }, e(Calendar, { size: 16 }), '외부의뢰 내역')
            )
        ),

        // ===================================
        // NEW MODE
        // ===================================
        viewMode === 'new' && e('div', { className: 'flex-1 min-h-0 flex flex-col gap-4' },
            /* ── 컨트롤 패널 ── */
            e('div', { className: 'card-custom p-4 flex flex-wrap items-end gap-3 no-print shrink-0 border border-slate-100 shadow-sm' },
                e('div', { className: 'space-y-1.5 mb-1' },
                    e('label', { className: 'text-[11px] font-black tracking-wider text-slate-500 ml-1 uppercase' }, '추출 기간 (당일 기준 권장)'),
                    e('div', { className: 'flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 shadow-inner' },
                        e('input', { type: 'date', value: startDate, onChange: ev => setStartDate(ev.target.value), className: 'bg-transparent font-black text-sm py-2.5 outline-none text-slate-700' }),
                        e('span', { className: 'text-slate-300 font-bold max-w-2' }, '~'),
                        e('input', { type: 'date', value: endDate, onChange: ev => setEndDate(ev.target.value), className: 'bg-transparent font-black text-sm py-2.5 outline-none text-slate-700' })
                    )
                ),
                e('div', { className: 'space-y-1.5 flex-1 min-w-[220px] mb-1' },
                    e('label', { className: 'text-[11px] font-black tracking-wider text-slate-500 ml-1 uppercase' }, '추출 필터'),
                    e('div', { className: 'relative' },
                        e(Search, { className: 'absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400', size: 18 }),
                        e('input', {
                            type: 'text', value: keyword, onChange: ev => setKeyword(ev.target.value),
                            placeholder: '사업장명, 유해인자 등...',
                            className: 'w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none shadow-inner focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-700'
                        })
                    )
                ),
                e('button', {
                    onClick: fetchData, disabled: loading,
                    className: 'h-[44px] mb-1 px-6 bg-slate-800 text-white font-black rounded-xl shadow-md hover:bg-slate-900 flex items-center gap-2 disabled:opacity-60 transition-all active:scale-95'
                },
                    loading ? e('div', { className: 'w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' }) : e(Search, { size: 18 }),
                    '데이터 추출'
                )
            ),

            /* ── 액션 & 툴바 ── */
            e('div', { className: 'flex items-center justify-between no-print shrink-0 px-2' },
                e('div', { className: 'flex items-center gap-3 text-sm' },
                    e('div', { className: 'relative' },
                        e(Filter, { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400', size: 15 }),
                        e('input', {
                            type: 'text', value: listFilter,
                            onChange: ev => setListFilter(ev.target.value),
                            placeholder: '리스트 내 키워드 검색...',
                            className: 'pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-300 w-64'
                        }),
                        listFilter && e('button', { onClick: () => setListFilter(''), className: 'absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600' }, e(X, { size: 13 }))
                    ),
                    e('div', { className: 'h-5 w-px bg-slate-300 mx-1' }),
                    e('span', { className: 'text-slate-500 font-bold' },
                        `추출된 시료: `,
                        e('span', { className: 'text-slate-800 font-black ml-1' }, `${data.length.toLocaleString()}건`)
                    ),
                    selectedIds.size > 0 && e('span', { className: 'px-3 py-1.5 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 rounded-full text-[11px] font-black shadow-sm flex items-center gap-1.5' },
                        e(CheckSquare, { size: 14 }), `${selectedIds.size}건 선택됨`
                    )
                ),
                e('div', { className: 'flex items-center gap-2' },
                    e('button', {
                        onClick: () => setShowSettings(!showSettings),
                        className: `h-[36px] px-3 border rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${showSettings ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`
                    },
                        e(Settings2, { size: 14 }), '컬럼 설정'
                    ),
                    e('button', {
                        onClick: () => downloadExcel(),
                        className: 'h-[36px] px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 font-black rounded-lg shadow-sm hover:bg-emerald-100 flex items-center gap-2 text-xs transition-colors'
                    }, e(Download, { size: 15 }), "선택 엑셀 (양식)"),
                    e('button', {
                        onClick: openRegisterModal,
                        className: `h-[38px] ml-2 px-5 font-black text-white rounded-xl shadow border border-transparent flex items-center gap-2 text-sm transition-all ${selectedIds.size > 0
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-500/25 active:scale-95'
                            : 'bg-slate-300 cursor-not-allowed opacity-80'
                            }`
                    }, e(Box, { size: 18 }), "의뢰 등록")
                )
            ),

            /* ── 컬럼 설정 패널 ── */
            showSettings && e('div', { className: 'card-custom p-5 animate-fade-in no-print shrink-0 border border-indigo-100 shadow-sm ring-4 ring-indigo-50/50 mx-2' },
                e('div', { className: 'flex justify-between items-center mb-3' },
                    e('h3', { className: 'font-black text-slate-700 flex items-center gap-2' }, e(Settings2, { size: 16, className: 'text-indigo-600' }), '컬럼 구성'),
                    e('div', { className: 'flex items-center gap-2' },
                        e('button', {
                            onClick: () => saveColumnConfigToDB(columnConfig),
                            disabled: settingsSaveStatus === 'saving',
                            className: (
                                settingsSaveStatus === 'saved' ? 'text-xs font-black px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200' :
                                    settingsSaveStatus === 'error' ? 'text-xs font-black px-3 py-1.5 rounded-lg bg-red-50 text-red-500 border border-red-200' :
                                        settingsSaveStatus === 'saving' ? 'text-xs font-black px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400' :
                                            'text-xs font-black px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm'
                            )
                        },
                            settingsSaveStatus === 'saved' ? '✅ 저장 완료' :
                                settingsSaveStatus === 'error' ? '❌ 저장 실패' :
                                    settingsSaveStatus === 'saving' ? '저장 중...' :
                                        '🌐 공유 저장'
                        ),
                        e('button', { onClick: resetColumns, className: 'text-xs font-black text-slate-400 hover:text-red-500 flex items-center gap-1 px-2' }, e(RotateCcw, { size: 12 }), '초기화')
                    )
                ),
                e('p', { className: 'text-[11px] text-indigo-500 bg-indigo-50 rounded-lg px-3 py-2 mb-3 font-bold' },
                    '💡 컬럼 설정 후 [🌐 공유 저장]을 누르면 다른 컴퓨터/사용자에게도 동일하게 적용됩니다.'
                ),
                e('div', { className: 'mb-4' },
                    e('div', { className: 'flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200' },
                        columnConfig.map((key, idx) => {
                            const col = ALL_COLUMNS.find(c => c.key === key);
                            if (!col) return null;
                            return e('div', { key, className: `flex items-center gap-1 border rounded-lg px-2 py-1.5 shadow-sm transition-all hover:scale-105 ${getColSourceClass(key)}` },
                                e('button', { onClick: () => moveColumn(idx, -1), disabled: idx === 0, className: `p-0.5 rounded ${idx === 0 ? 'opacity-20' : 'hover:bg-black/10'}` }, e(ChevronLeft, { size: 13 })),
                                e('span', { className: 'text-xs font-black px-1' }, col.label),
                                e('button', { onClick: () => moveColumn(idx, 1), disabled: idx === columnConfig.length - 1, className: `p-0.5 rounded ${idx === columnConfig.length - 1 ? 'opacity-20' : 'hover:bg-black/10'}` }, e(ChevronRight, { size: 13 })),
                                e('button', { onClick: () => toggleColumn(key), className: 'ml-1 p-1 hover:bg-rose-500 hover:text-white rounded-md transition-colors' }, e(X, { size: 13 }))
                            );
                        })
                    )
                ),
                e('div', { className: 'pt-3 border-t border-slate-100' },
                    e('div', { className: 'flex flex-wrap gap-2' },
                        unusedCols.map(col => e('button', {
                            key: col.key, onClick: () => toggleColumn(col.key),
                            className: `px-3 py-1.5 rounded-lg border text-xs font-black transition-all hover:scale-105 ${getColSourceClass(col.key)}`
                        },
                            '+ ' + col.label
                        ))
                    )
                )
            ),

            /* ── Data Grid ── */
            e('div', { className: 'card-custom flex-1 overflow-hidden flex flex-col min-h-0 bg-white ring-1 ring-slate-200 shadow-sm relative no-print' },
                /* 엑셀 다운로드 경고 제거 또는 변경 */
                e('div', {
                    ref: scrollContainerRef,
                    className: 'overflow-auto flex-1 scroll-custom',
                    onScroll: ev => setScrollTop(ev.currentTarget.scrollTop)
                },
                    e('table', { className: 'text-left table-fixed border-collapse', style: { minWidth: columnConfig.reduce((acc, k) => acc + (columnWidths[k] || 120), 44) } },
                        e('thead', { className: 'sticky top-0 z-10' },
                            e('tr', null,
                                e('th', { className: 'px-3 py-3 bg-slate-100 border-b border-r border-slate-200 text-center shadow-sm', style: { width: 44, minWidth: 44 } },
                                    e('input', { type: 'checkbox', ref: masterCbRef, checked: isAllSelected, onChange: toggleSelectAll, className: 'w-4 h-4 accent-indigo-600 rounded cursor-pointer' })
                                ),
                                columnConfig.map(key => {
                                    const col = ALL_COLUMNS.find(c => c.key === key);
                                    const cw = columnWidths[key] || 120;
                                    return e('th', { key, className: `px-3 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 select-none relative bg-slate-100 ${getColSourceClass(key)} shadow-sm`, style: { width: cw, minWidth: 40 } },
                                        e('div', { className: 'flex items-center justify-center truncate' }, col?.label || key),
                                        e('div', { className: 'col-resize-handle', onMouseDown: (ev) => handleColResizeStart(key, ev) })
                                    );
                                })
                            )
                        ),
                        e('tbody', { className: 'text-sm font-medium' },
                            loading ? e('tr', null, e('td', { colSpan: columnConfig.length + 1, className: 'py-20 text-center' },
                                e('div', { className: 'flex flex-col items-center gap-3 text-slate-400' }, e('div', { className: 'w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin' }), e('span', { className: 'font-bold' }, '데이터를 다듬는 중...'))
                            )) : filteredData.length === 0 ? e('tr', null, e('td', { colSpan: columnConfig.length + 1, className: 'py-20 text-center text-slate-400 font-bold' }, '조건을 변경하여 데이터를 검색해보세요.')) :
                                [
                                    topPad > 0 && e('tr', { key: '__top__', style: { height: topPad } }, e('td', { colSpan: columnConfig.length + 1 })),
                                    ...filteredData.slice(startIdx, endIdx).map((row, i) => {
                                        const isSelected = selectedIds.has(row.sample_id);
                                        return e('tr', {
                                            key: row.sample_id,
                                            className: `border-b border-slate-100 transition-colors ${isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/50'}`,
                                            style: { height: ROW_HEIGHT }
                                        },
                                            e('td', { className: 'px-3 py-2 text-center border-r border-transparent', style: { width: 44, minWidth: 44 } },
                                                e('input', { type: 'checkbox', checked: isSelected, onChange: () => toggleSelectRow(row.sample_id), className: 'w-4 h-4 accent-indigo-600 rounded cursor-pointer border-slate-300' })
                                            ),
                                            columnConfig.map(key => {
                                                const w = columnWidths[key] || 120;
                                                let content = row[key] == null ? '' : String(row[key]);
                                                let cellClass = `px-3 py-0 text-slate-600 border-r border-transparent last:border-0 overflow-hidden text-center`;
                                                if (key === 'sample_id') cellClass += ' font-mono text-indigo-700 font-black text-xs';
                                                if (key === 'common_name') cellClass += ' font-bold text-slate-800';
                                                return e('td', { key, className: cellClass, title: content, style: { width: w, maxWidth: w, height: ROW_HEIGHT, whiteSpace: 'nowrap', textOverflow: 'ellipsis' } }, content);
                                            })
                                        );
                                    }),
                                    bottomPad > 0 && e('tr', { key: '__bot__', style: { height: bottomPad } }, e('td', { colSpan: columnConfig.length + 1 }))
                                ]
                        )
                    )
                )
            )
        ),

        /* ===================================
        // HISTORY MODE
        // =================================== */
        viewMode === 'history' && e('div', { className: 'flex-1 min-h-0 flex flex-col gap-4 animate-fade-in no-print' },
            /* Statistics Cards */
            e('div', { className: 'grid grid-cols-3 gap-4 mb-2' },
                [
                    { label: '전체 의뢰건수', value: historyStats.total, icon: Box, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: '의뢰중', value: historyStats.pending, icon: RotateCcw, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: '지연건수', value: historyStats.overdue, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((s, i) => e('div', { key: i, className: 'card-custom p-4 flex items-center justify-between bg-white ring-1 ring-slate-200 shadow-sm' },
                    e('div', null,
                        e('p', { className: 'text-[10px] font-black text-slate-400 uppercase tracking-widest' }, s.label),
                        e('p', { className: `text-xl font-black ${s.color} mt-0.5` }, `${s.value}건`)
                    ),
                    e('div', { className: `w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center` }, e(s.icon, { size: 20, className: s.color }))
                ))
            ),

            /* History Controls */
            e('div', { className: 'card-custom p-4 flex flex-wrap items-center gap-4 bg-white ring-1 ring-slate-200 shadow-sm' },
                e('div', { className: 'flex items-center gap-2' },
                    e('span', { className: 'text-xs font-black text-slate-400 ml-1 tracking-widest' }, '조회 연도'),
                    e('select', { value: historyYear, onChange: e => setHistoryYear(Number(e.target.value)), className: 'px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20' },
                        Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => e('option', { key: y, value: y }, `${y}년`))
                    )
                ),
                e('div', { className: 'flex items-center gap-2' },
                    e('span', { className: 'text-xs font-black text-slate-400 ml-1 tracking-widest' }, '구분(반기)'),
                    e('select', { value: historyHalf, onChange: e => setHistoryHalf(Number(e.target.value)), className: 'px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20' },
                        e('option', { value: 1 }, '상반기'),
                        e('option', { value: 2 }, '하반기')
                    )
                ),
                e('button', { onClick: fetchHistory, className: 'h-[38px] px-5 bg-emerald-600 text-white font-black rounded-lg shadow-sm hover:bg-emerald-700 flex items-center gap-2 text-sm ml-2 transition-all active:scale-95' },
                    historyLoading ? e('div', { className: 'w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' }) : e(Search, { size: 16 }),
                    '내역 조회'
                ),
                e('div', { className: 'h-6 w-px bg-slate-200 mx-2' }),
                e('button', {
                    onClick: () => setHistorySortOrder(prev => prev === 'desc' ? 'asc' : 'desc'),
                    className: 'h-[38px] px-4 bg-white border border-slate-200 text-slate-600 font-black rounded-lg shadow-sm hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-95 text-xs'
                },
                    e(historySortOrder === 'desc' ? SortDesc : SortAsc, { size: 16, className: 'text-emerald-600' }),
                    `정렬: ${historySortOrder === 'desc' ? '최신순' : '과거순'}`
                )
            ),

            /* History Table */
            e('div', { className: 'card-custom flex-1 overflow-auto bg-white ring-1 ring-slate-200 shadow-sm scroll-custom' },
                e('table', { className: 'w-full text-left border-collapse' },
                    e('thead', { className: 'sticky top-0 bg-emerald-50 shadow-sm z-10 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-emerald-200' },
                        e('tr', null,
                            ['의뢰일자', '분석기관', '의뢰건수', '상태', '결과수신예정', '실제수신일', '발신번호', '작성자', '관리'].map(h =>
                                e('th', { key: h, className: 'px-4 py-3.5 text-xs font-black text-emerald-800 uppercase tracking-widest text-center' }, h)
                            )
                        )
                    ),
                    e('tbody', { className: 'text-sm' },
                        historyLoading ? e('tr', null, e('td', { colSpan: 9, className: 'py-20 text-center' }, e('div', { className: 'flex flex-col items-center gap-3 text-emerald-600' }, e('div', { className: 'w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin' }), e('span', { className: 'font-bold' }, '내역을 불러오는 중...'))))
                            : historyData.length === 0 ? e('tr', null, e('td', { colSpan: 9, className: 'py-24 text-center' }, e('div', { className: 'flex flex-col items-center gap-2 opacity-50' }, e(Box, { size: 48, className: 'text-slate-300' }), e('span', { className: 'text-slate-500 font-bold' }, '조회된 내역이 없습니다.'))))
                                : historyData.map(row => {
                                    const isDone = row.status === '결과수령완료';
                                    return e('tr', { key: row.id, className: `border-b border-slate-100 hover:bg-emerald-50/30 transition-colors ${isDone ? 'opacity-70 bg-slate-50/50' : ''}` },
                                        e('td', { className: 'px-4 py-3 text-center font-bold text-slate-700' }, row.request_date),
                                        e('td', { className: 'px-4 py-3 text-center font-black text-emerald-700' }, row.kiwe_partners?.partner_name),
                                        e('td', { className: 'px-4 py-3 text-center' },
                                            e('button', {
                                                onClick: (ev) => {
                                                    ev.stopPropagation();
                                                    openDetailModal(row);
                                                },
                                                className: 'inline-flex p-1.5 px-3 bg-indigo-50 rounded-full text-xs font-black text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm'
                                            }, `${row.total_count || row.kiwe_request_items?.[0]?.count || 0}건`)
                                        ),
                                        e('td', { className: 'px-4 py-3 text-center' },
                                            e('span', { className: `px-2.5 py-1 rounded-md text-[11px] font-black ${isDone ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'}` }, row.status)
                                        ),
                                        e('td', { className: 'px-4 py-3 text-center text-slate-500 font-bold text-xs' }, row.expected_receive_date),
                                        e('td', { className: 'px-4 py-3 text-center' },
                                            e('input', {
                                                type: 'date',
                                                value: row.receive_date || '',
                                                onChange: e => updateRequest(row.id, 'receive_date', e.target.value),
                                                className: `px-2 py-1.5 rounded bg-transparent border border-transparent font-black text-xs focus:bg-white focus:border-emerald-300 focus:outline-none transition-colors hover:bg-slate-100 ${isDone ? 'text-slate-600' : 'text-slate-600'}`
                                            })
                                        ),
                                        e('td', { className: 'px-4 py-3 text-center' },
                                            e('input', {
                                                type: 'text',
                                                defaultValue: row.document_no || '',
                                                placeholder: '입력...',
                                                onBlur: e => {
                                                    if (e.target.value !== (row.document_no || '')) {
                                                        updateRequest(row.id, 'document_no', e.target.value);
                                                    }
                                                },
                                                onKeyDown: e => {
                                                    if (e.key === 'Enter') {
                                                        e.target.blur();
                                                    }
                                                },
                                                className: 'w-32 px-2 py-1.5 rounded bg-transparent border border-transparent font-bold text-xs text-center focus:bg-white focus:border-emerald-300 focus:outline-none transition-colors hover:bg-slate-100'
                                            })
                                        ),
                                        e('td', { className: 'px-4 py-3 text-center font-bold text-xs text-slate-500' }, row.created_by),
                                        e('td', { className: 'px-4 py-3 text-center flex items-center justify-center gap-1' },
                                            e('button', {
                                                onClick: () => downloadHistoryExcel(row),
                                                className: 'p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors',
                                                title: '엑셀 다운로드'
                                            }, e(Download, { size: 16 })),
                                            e('button', {
                                                onClick: () => deleteRequest(row.id),
                                                className: 'p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors',
                                                title: '삭제'
                                            }, e(Trash2, { size: 16 }))
                                        )
                                    )
                                })
                    )
                )
            )
        ),


        // ===================================
        // Modals
        // ===================================
        showRegisterModal && e('div', { className: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm no-print' },
            e('div', { className: 'bg-white rounded-2xl shadow-2xl w-[460px] flex flex-col overflow-hidden animate-fade-in ring-1 ring-black/5' },
                e('div', { className: 'px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50' },
                    e('h2', { className: 'text-lg font-black text-slate-800 flex items-center gap-2' }, e(Box, { className: 'text-indigo-600' }), '외부의뢰 등록'),
                    e('button', { onClick: () => setShowRegisterModal(false), className: 'text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors' }, e(X, { size: 20 }))
                ),
                e('div', { className: 'p-6 flex flex-col gap-6' },
                    e('div', { className: 'p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-xl flex items-center justify-between shadow-inner' },
                        e('span', { className: 'text-indigo-900 font-bold' }, '선택된 의뢰 대상 시료수'),
                        e('span', { className: 'text-2xl font-black text-indigo-700' }, `${selectedIds.size} 건`)
                    ),
                    e('div', { className: 'flex flex-col gap-2' },
                        e('label', { className: 'text-xs font-black tracking-widest text-slate-500' }, '제출 분석기관'),
                        e('select', {
                            value: registerForm.partner_id,
                            onChange: e => setRegisterForm({ ...registerForm, partner_id: e.target.value }),
                            className: 'p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all'
                        },
                            partners.map(p => e('option', { key: p.partner_id, value: p.partner_id }, p.partner_name))
                        )
                    ),
                    e('div', { className: 'flex flex-col gap-2' },
                        e('label', { className: 'text-xs font-black tracking-widest text-slate-500' }, '결과수신예정일 (평일 16일 자동계산)'),
                        e('input', {
                            type: 'date',
                            value: registerForm.expected_receive_date,
                            onChange: e => setRegisterForm({ ...registerForm, expected_receive_date: e.target.value }),
                            className: 'p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all'
                        })
                    ),
                    e('div', { className: 'flex flex-col gap-2' },
                        e('label', { className: 'text-xs font-black tracking-widest text-slate-500' }, '의뢰 시료수 (공시료 포함)'),
                        e('div', { className: 'relative' },
                            e('input', {
                                type: 'number',
                                value: registerForm.total_count,
                                onChange: e => setRegisterForm({ ...registerForm, total_count: e.target.value }),
                                className: 'w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all'
                            }),
                            e('span', { className: 'absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400' }, '건')
                        ),
                        e('p', { className: 'text-[10px] text-slate-400 ml-1' }, '💡 선택된 시료 외에 사업장별/물질별 공시료(2개)가 포함된 수입니다.')
                    )
                ),
                e('div', { className: 'px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3' },
                    e('button', { onClick: () => setShowRegisterModal(false), className: 'px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-all' }, '취소'),
                    e('button', {
                        onClick: handleRegisterRequest, disabled: isSubmitting,
                        className: 'px-6 py-2.5 rounded-xl font-black text-white bg-indigo-600 shadow-md shadow-indigo-500/20 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2'
                    },
                        isSubmitting ? e('div', { className: 'w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' }) : null,
                        '등록 완료'
                    )
                )
            ),

            /* ── 인쇄 전용 영역 (Hidden in UI, Visible in Print) ── */
            e('div', { id: 'print-area', className: 'hidden' },
                e('table', { className: 'w-full border-collapse border border-slate-300 text-[10px]' },
                    e('thead', null,
                        e('tr', null,
                            columnConfig.map(key => {
                                const col = ALL_COLUMNS.find(c => c.key === key);
                                return e('th', { key, className: 'border border-slate-300 bg-slate-50 px-1 py-1 font-bold text-center' }, col?.label || key);
                            })
                        )
                    ),
                    e('tbody', null,
                        (selectedIds.size > 0 ? filteredData.filter(r => selectedIds.has(r.sample_id)) : filteredData).map((row, idx) =>
                            e('tr', { key: row.sample_id || idx },
                                columnConfig.map(key => {
                                    const content = row[key] == null ? '' : String(row[key]);
                                    return e('td', { key, className: 'border border-slate-300 px-1 py-1 text-center' }, content);
                                })
                            )
                        )
                    )
                )
            )
        )
    );
}

// 엑셀 다운로드를 위한 의존성이 전역에 있다고 가정함 (XLSX)

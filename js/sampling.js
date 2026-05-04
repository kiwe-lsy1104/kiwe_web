// js/sample.js
import React, { useState, useEffect, useMemo, useRef } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
import {
    Database, FlaskConical, Settings, BarChart3, Search,
    Plus, X, Save, Edit, Trash2, ChevronRight,
    LayoutGrid, List, Filter, Download, Info, CheckCircle2,
    Clock, Thermometer, Droplets, User, Building2, Calendar, Home, RotateCcw, HelpCircle
} from 'https://esm.sh/lucide-react@0.263.1';
import { supabase, checkAuth } from './config.js';
import { initSampleGrid, loadGridData } from './sampling_list.js';
import { setupHazardSelection, openHazardSearch } from './sample_popup_logic.js';
import HazardManagement from './hazard_management.js';
import { NoiseRecord } from './noise_record.js';

const e = React.createElement;

const STORAGE_KEY_MAIN = 'KIWE_SAMPLING_GRID_CONFIG_V6_STABLE';
const DB_SETTINGS_KEY = 'sampling_column_config';
const ALL_GRID_COLUMNS = [
    { key: 'input_seq', label: '순번' },
    { key: 'm_date', label: '측정일자' },
    { key: 'com_name', label: '사업장명' },
    { key: 'work_process', label: '작업공정' },
    { key: 'worker_name', label: '근로자명' },
    { key: 'common_name', label: '유해인자(검색)' },
    { key: 'hazard_category', label: '카테고리' },
    { key: 'pump_no', label: '펌프번호' },
    { key: 'start_time', label: '시작시간' },
    { key: 'end_time', label: '종료시간' },
    { key: 'shift_type', label: '교대형태' },
    { key: 'work_hour', label: '실근로시간(h)' },
    { key: 'lunch_time', label: '점심시간(분)' },
    { key: 'measured_min', label: '측정시간(분/계산)' },
    { key: 'occurrence_type', label: '발생형태' },
    { key: 'temp', label: '온도' },
    { key: 'humidity', label: '습도' },
    { key: 'condition', label: '시료상태' },
    { key: 'analyst', label: '분석자' },
    { key: 'measured_by', label: '측정자' },
    { key: 'received_by', label: '인수자/접수자' },
    { key: 'received_date', label: '인수일' }
];
const DEFAULT_COLS = [
    'input_seq', 'm_date', 'com_name', 'work_process', 'worker_name', 'common_name',
    'pump_no', 'start_time', 'end_time', 'measured_min', 'shift_type',
    'work_hour', 'lunch_time', 'occurrence_type', 'temp', 'humidity',
    'condition', 'analyst', 'measured_by', 'received_by', 'received_date'
];

function App() {
    const formatLocalDate = (date) => {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    };

    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState(1);
    const [startDate, setStartDate] = useState(formatLocalDate(new Date()));
    const [endDate, setEndDate] = useState(formatLocalDate(new Date()));
    const [comName, setComName] = useState('');
    const [companies, setCompanies] = useState([]);
    const [showCompanyList, setShowCompanyList] = useState(false);
    const [currentGridRow, setCurrentGridRow] = useState(null);
    const gridRowRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [receiverDefault, setReceiverDefault] = useState('이초롱');
    const [showSettings, setShowSettings] = useState(false);
    const [settingsSaveStatus, setSettingsSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
    const [allHazards, setAllHazards] = useState([]);
    const [sortType, setSortType] = useState('input'); // 정렬 방식: 'input'(입력순) | 'sample_id'(시료번호순)
    const [idFilter, setIdFilter] = useState('all'); // ID 필터: 'all' | 'sample' (S/D) | 'blank' (SB/DB)

    const hotRef = useRef(null);
    const hotInstance = useRef(null);
    const isDirtyRef = useRef(false);
    const sortableRef = useRef(null);
    const allHazardsRef = useRef([]);

    const startDateRef = useRef(startDate);
    const endDateRef = useRef(endDate);
    const comNameRef = useRef(comName);
    const userRef = useRef(user);
    const receiverDefaultRef = useRef(receiverDefault);

    useEffect(() => { startDateRef.current = startDate; }, [startDate]);
    useEffect(() => { endDateRef.current = endDate; }, [endDate]);
    useEffect(() => { comNameRef.current = comName; }, [comName]);
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { receiverDefaultRef.current = receiverDefault; }, [receiverDefault]);
    useEffect(() => { allHazardsRef.current = allHazards; }, [allHazards]);
    // localStorage에서 빠른 초기 렌더 (오프라인 fallback)
    const [columnConfig, setColumnConfig] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_MAIN);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    return { 1: [...parsed], 2: [...parsed], 3: [...parsed] };
                }
                if (parsed && typeof parsed === 'object') {
                    return {
                        1: Array.isArray(parsed[1]) ? [...parsed[1]] : [...DEFAULT_COLS],
                        2: Array.isArray(parsed[2]) ? [...parsed[2]] : [...DEFAULT_COLS],
                        3: Array.isArray(parsed[3]) ? [...parsed[3]] : [...DEFAULT_COLS],
                    };
                }
            } catch (e) {
                console.warn("Failed to parse columnConfig, using defaults");
            }
        }
        return {
            1: [...DEFAULT_COLS],
            2: [...DEFAULT_COLS],
            3: [...DEFAULT_COLS]
        };
    });

    // ── DB에서 공유 컬럼 설정 로드
    const fetchColumnConfigFromDB = async () => {
        try {
            const { data, error } = await supabase
                .from('kiwe_app_settings')
                .select('value')
                .eq('key', DB_SETTINGS_KEY)
                .single();
            if (error || !data) return; // 테이블 없거나 값 없으면 현재 상태 유지
            const parsed = data.value;
            if (parsed && typeof parsed === 'object') {
                const next = {
                    1: Array.isArray(parsed['1']) ? [...parsed['1']] : [...DEFAULT_COLS],
                    2: Array.isArray(parsed['2']) ? [...parsed['2']] : [...DEFAULT_COLS],
                    3: Array.isArray(parsed['3']) ? [...parsed['3']] : [...DEFAULT_COLS],
                };
                setColumnConfig(next);
                localStorage.setItem(STORAGE_KEY_MAIN, JSON.stringify(next));
            }
        } catch (err) {
            console.warn('컬럼 설정 DB 로드 실패 (localStorage 유지):', err);
        }
    };

    // ── DB에 공유 컬럼 설정 저장
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

    // columnConfig를 Ref로도 유지 → 그리드 콜백 내에서 최신값 참조용
    const columnConfigRef = useRef(columnConfig);
    useEffect(() => { columnConfigRef.current = columnConfig; }, [columnConfig]);

    const currentCols = columnConfig[activeTab] || DEFAULT_COLS;

    const handleColumnMove = (movedColumns, target) => {
        setColumnConfig(prev => {
            const nextConfig = { ...prev };
            const hot = hotInstance.current;
            if (!hot) return prev;

            // Handsontable이 현재 표시 중인 컬럼 순서 읽기
            const newOrder = [];
            const count = hot.countCols();
            for (let i = 0; i < count; i++) {
                const prop = hot.colToProp(i);
                if (typeof prop === 'string' && prop !== 'actions' && prop !== 'id') {
                    newOrder.push(prop);
                }
            }

            // ★ 핵심 수정: 현재 탭에서 활성화된 컬럼 목록과 교집합만 저장
            // (숨김 처리된 컬럼이 이동 이벤트로 인해 복원되는 것을 방지)
            const currentActiveCols = new Set(prev[activeTab] || DEFAULT_COLS);
            const filtered = newOrder.filter(k => currentActiveCols.has(k));

            nextConfig[activeTab] = filtered.length > 0 ? filtered : (prev[activeTab] || DEFAULT_COLS);
            return nextConfig;
        });
    };

    const handleColumnResize = (col, newSize) => {
        // Width persistence can be added here if needed in the future
    };

    // columnConfig 변경 시 localStorage에 캐시 (빠른 재방문용)
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_MAIN, JSON.stringify(columnConfig));
    }, [columnConfig]);

    // Sortable initialization
    useEffect(() => {
        if (showSettings && sortableRef.current) {
            const sortable = new Sortable(sortableRef.current, {
                animation: 150,
                ghostClass: 'bg-indigo-50',
                handle: '.drag-handle',
                onEnd: (evt) => {
                    const { oldIndex, newIndex } = evt;
                    if (oldIndex === newIndex) return;
                    setColumnConfig(prev => {
                        const nextConfig = { ...prev };
                        const tabCols = [...(nextConfig[activeTab] || DEFAULT_COLS)];
                        const [moved] = tabCols.splice(oldIndex, 1);
                        tabCols.splice(newIndex, 0, moved);
                        nextConfig[activeTab] = tabCols;
                        return nextConfig;
                    });
                }
            });
            return () => sortable.destroy();
        }
    }, [showSettings]);

    // Prevent leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirtyRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const handleTabChange = (tab) => {
        if (isDirtyRef.current) {
            if (!confirm("작성 중인 데이터가 있습니다. 저장하지 않고 이동하시겠습니까?")) return;
            isDirtyRef.current = false;
        }

        setActiveTab(tab);
    };

    // Auth and Data Init
    useEffect(() => {
        const session = checkAuth();
        if (session) setUser(session);
        fetchCompanies();
        fetchReceiverDefault();
        fetchHazards();
        fetchColumnConfigFromDB(); // ★ DB에서 공유 컬럼 설정 로드

        // Setup popup logic
        const cleanupPopup = setupHazardSelection(gridRowRef, hotInstance, calculateSampleId, getSamplePrefix);

        return () => {
            if (hotInstance.current) {
                try {
                    hotInstance.current.destroy();
                } catch (e) {
                    console.error('Error destroying hotInstance in mount cleanup:', e);
                }
                hotInstance.current = null;
            }
            cleanupPopup();
        };
    }, []);

    const handleDeleteRow = async (row) => {
        if (!hotInstance.current) return;
        if (!confirm("선택한 행을 삭제하시겠습니까?")) return;

        const hot = hotInstance.current;
        const physicalRow = hot.toPhysicalRow(row);
        const sourceData = hot.getSourceDataAtRow(physicalRow);

        if (sourceData && (sourceData.id || sourceData.sample_id)) {
            // 해당 행의 날짜를 기준으로 테이블명 결정
            const tableName = getTableName(sourceData.m_date || startDate);
            let query = supabase.from(tableName).delete();
            if (sourceData.id) query = query.eq('id', sourceData.id);
            else query = query.eq('sample_id', sourceData.sample_id);

            const { error } = await query;
            if (error) { alert('삭제 실패: ' + error.message); return; }
        }

        hot.alter('remove_row', row);
        // Deleting is a save operation in itself (per row), but grid might still have other changes?
        // Actually handleDeleteRow does direct DB delete.
        // If there were other unsaved changes in other rows, they remain unsaved.
        // So we don't necessarily reset isDirty, or we might set it?
        // Let's leave isDirty as is, or set true if the grid reflects the change?
        // alter 'remove_row' triggers afterChange? Yes. Source 'Alter'?
        // We'll handle it in the hook.
    };

    const loadSmartData = () => {
        if (!hotInstance.current) return;
        loadGridData(hotInstance.current, supabase, startDate, endDate, comName, user, sortType, idFilter);
        isDirtyRef.current = false;
    };

    // 1. Grid Initialization: Only when tab 1 is active and user is logged in
    //    ★ columnConfig를 의존성에서 제거 → 컬럼 변경 시 그리드 재생성 방지
    //       대신 columnConfigRef를 통해 초기화 시점의 최신 컬럼 목록을 참조
    useEffect(() => {
        if (activeTab === 1 && user && hotRef.current) {
            if (hotInstance.current) {
                try {
                    hotInstance.current.destroy();
                } catch (e) {
                    console.error('Error destroying old hotInstance in main effect:', e);
                }
                hotInstance.current = null;
            }
            hotInstance.current = initSampleGrid(
                hotRef.current,
                startDateRef.current,
                comNameRef.current,
                (rowIdx) => openHazardSearch(rowIdx, setCurrentGridRow, gridRowRef),
                handleDeleteRow,
                columnConfigRef.current[activeTab] || DEFAULT_COLS,
                '100%',
                handleColumnMove,
                handleColumnResize
            );

            // Attach Dirty Check Hook and Auto-Fill Logic
            hotInstance.current.addHook('afterChange', async (changes, source) => {
                if (source === 'loadData' || source === 'observeChanges' || source === 'auto') return;
                isDirtyRef.current = true;

                if (!changes) return;

                const hot = hotInstance.current;
                const rowsToProcess = new Set();

                // 1. 단순 동기 작업 (배치 적용)
                hot.batch(() => {
                    for (const [row, prop, oldVal, newVal] of changes) {
                        // ★ afterChange의 row는 피지컬(물리) 인덱스입니다.
                        // setDataAtRowProp(비주얼, ...)를 위해 변환이 필요합니다.
                        const visualRow = hot.toVisualRow(row);
                        if (visualRow === null) continue; // 필터링 등에 의해 안 보일 경우 스킵

                        if (prop === 'm_date') {
                            hot.setDataAtRowProp(visualRow, 'received_date', newVal, 'auto');
                        }
                        if (['common_name', 'worker_name', 'instrument_name'].includes(prop)) {
                            rowsToProcess.add(row); // 피지컬 인덱스 수집
                        }
                    }
                });

                // 2. 비동기 작업 (시료번호 할당) - 배치 처리는 함수 내부에서 수행
                if (rowsToProcess.size > 0) {
                    await applyBulkSampleIds(Array.from(rowsToProcess));
                }

                // 3. 유해인자 유효성 및 매체 호환성 검사 (Warning Alert)
                const hazards = allHazardsRef.current;
                if (!hazards || hazards.length === 0) return;

                const errorMessages = [];
                for (const [row, prop, oldVal, newVal] of changes) {
                    if (prop === 'common_name' && newVal) {
                        const parts = String(newVal).split('/').map(s => s.trim()).filter(Boolean);
                        if (parts.length === 0) continue;

                        const mediaSet = new Set();
                        const missing = [];
                        
                        parts.forEach(p => {
                            const base = p.split(/[/(]/)[0].trim();
                            const match = hazards.find(h => h.common_name === p || h.common_name === base);
                            if (match) {
                                if (match.sampling_media) mediaSet.add(match.sampling_media);
                            } else {
                                missing.push(p);
                            }
                        });

                        if (missing.length > 0) {
                             errorMessages.push(`[${row + 1}행] 등록되지 않은 유해인자 포함: ${missing.join(', ')}`);
                        } else if (mediaSet.size > 1) {
                             errorMessages.push(`[${row + 1}행] 채취매체 불일치 알림\n입력된 인자들의 매체가 서로 다릅니다: ${Array.from(mediaSet).join(' vs ')}\n이 조합으로는 한 셀에 입력할 수 없습니다.`);
                        }
                    }
                }

                if (errorMessages.length > 0) {
                    // 중복 알림 방지를 위해 한꺼번에 표시
                    alert("⚠️ 유해인자 입력 경고\n\n" + errorMessages.join("\n\n"));
                }
            });

            // 한글 입력을 방해하던(첫 타 영문 변환) 강제 포커스 훅 제거 완료 
            // (브라우저 Native Composition Event를 보장하기 위해 삭제)

            hotInstance.current.addHook('afterCreateRow', (index, amount) => {
                const hot = hotInstance.current;
                const currentUser = userRef.current;
                const currentMDate = startDateRef.current;
                const currentComName = comNameRef.current;
                const currentReceiver = receiverDefaultRef.current;

                for (let i = 0; i < amount; i++) {
                    const row = index + i;
                    if (currentUser) {
                        hot.setDataAtRowProp(row, 'measured_by', currentUser.user_name);
                    }
                    if (currentMDate) hot.setDataAtRowProp(row, 'm_date', currentMDate);
                    if (currentComName) hot.setDataAtRowProp(row, 'com_name', currentComName);

                    // 교대형태, 실근로시간, 점심시간, 발생형태 자동입력 해제 요청으로 제거
                    hot.setDataAtRowProp(row, 'condition', '양호');
                    hot.setDataAtRowProp(row, 'received_by', currentReceiver);
                    if (currentMDate) hot.setDataAtRowProp(row, 'received_date', currentMDate);
                }
            });

            loadSmartData();

            return () => {
                if (hotInstance.current) {
                    try {
                        hotInstance.current.destroy();
                    } catch (e) {
                        console.error('Error destroying hotInstance in main effect cleanup:', e);
                    }
                    hotInstance.current = null;
                }
            };
        }
    }, [activeTab, user]); // ★ columnConfig 제거 → 컬럼 토글 시 그리드 재생성 안 함

    // 2. Data Loading: When filters change (mDate, comName)
    useEffect(() => {
        if (activeTab === 1 && hotInstance.current) {
            // If dirty, maybe warn? But this effect runs AFTER state update.
            // React state update is already done. Too late to prevent.
            // But we can reset dirty because we are loading new data.
            loadSmartData();
        }
    }, [startDate, endDate, comName, sortType, idFilter]);



    async function fetchCompanies() {
        const { data, error } = await supabase.from('kiwe_companies').select('com_name, com_id').order('com_name');
        if (!error) setCompanies(data);
    }

    async function fetchHazards() {
        try {
            const { data, error } = await supabase
                .from('kiwe_hazard')
                .select('common_name, instrument_name, sampling_media');
            if (!error && data) {
                setAllHazards(data);
                if (hotInstance.current) {
                    hotInstance.current.updateSettings({
                        cells: (row, col) => {
                            const prop = hotInstance.current.colToProp(col);
                            if (prop === 'common_name') {
                                return { validHazards: data };
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.error("Error fetching hazards", e);
        }
    }

    async function fetchReceiverDefault() {
        try {
            const { data, error } = await supabase
                .from('kiwe_users')
                .select('user_name')
                .eq('job_title', '분석책임자')
                .limit(1);
            if (!error && data && data.length > 0) {
                setReceiverDefault(data[0].user_name);
            }
        } catch (e) {
            console.error("Error fetching receiver default", e);
        }
    }

    const addRows = (count) => {
        if (hotInstance.current) {
            hotInstance.current.alter('insert_row_below', hotInstance.current.countRows(), count);
        }
    };

    // 날짜로부터 반기별 테이블명 결정
    const getTableName = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 0-indexed
        const halfYear = month <= 6 ? 1 : 2; // 1~6월: 상반기(1), 7~12월: 하반기(2)
        return `kiwe_sampling_${year}_${halfYear}`;
    };

    const getMaxSufixFromDB = async (prefixWithHalfYear, mDateValue, excludeIds = []) => {
        try {
            const tableName = getTableName(mDateValue);
            if (!tableName) return 0;

            let query = supabase
                .from(tableName)
                .select('sample_id')
                .not('com_name', 'is', null)
                .not('common_name', 'is', null)
                .like('sample_id', `${prefixWithHalfYear}%`)
                .order('sample_id', { ascending: false })
                .limit(1);
            
            // ★ 개선: 현재 그리드에 있는 ID들은 DB 최대치 계산에서 제외 (번호 꼬임 방지)
            if (excludeIds.length > 0) {
                // excludeIds가 정수형 ID인 경우 유효함
                const validExclude = excludeIds.filter(id => id && !String(id).startsWith('temp_'));
                if (validExclude.length > 0) {
                    query = query.not('id', 'in', `(${validExclude.join(',')})`);
                }
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data || data.length === 0) return 0;

            const latestId = data[0].sample_id;
            if (latestId) {
                const parts = latestId.split('-');
                if (parts.length >= 2) {
                    const seq = parseInt(parts[parts.length - 1], 10);
                    return isNaN(seq) ? 0 : seq;
                }
            }
            return 0;
        } catch (err) {
            console.error("Error fetching max suffix:", err);
            // 긴급 상황 피드백: DB 조회 실패 시 사용자에게 알림
            if (err.message && err.message.includes('42P01')) { // Table not found
                console.warn(`Table for ${mDateValue} not created yet.`);
            }
            return 0;
        }
    };

    const applyBulkSampleIds = async (rowIndices, forceAll = false) => {
        const hot = hotInstance.current;
        if (!hot) return;

        try {
            // ★ rowIndices는 피지컬(물리) 인덱스로 가정합니다 (afterChange에서 전달됨).
            const rowsByPrefix = {};

            // 현재 그리드의 모든 ID 수집 (DB 조회 시 제외용)
            const allDataForExclude = hot.getSourceData();
            const idsInGrid = allDataForExclude.map(r => r.id).filter(Boolean);

            for (const rowIdx of rowIndices) {
                const rowData = hot.getSourceDataAtRow(rowIdx);
                if (!rowData) continue;
                if (!forceAll && rowData.id) continue;

                if (!rowData.com_name || !rowData.common_name) {
                    if (rowData.sample_id) hot.setDataAtRowProp(rowIdx, 'sample_id', null, 'auto');
                    continue;
                }

                if (rowData.common_name === '소음') {
                    if (rowData.sample_id) hot.setDataAtRowProp(rowIdx, 'sample_id', null, 'auto');
                    continue;
                }

                const instName = rowData.instrument_name || '';
                const worker = rowData.worker_name || '';
                const common = rowData.common_name || '';
                const mDate = rowData.m_date || startDate;

                const prefixAlpha = getSamplePrefix(instName, worker, common);

                const dateObj = new Date(mDate);
                if (isNaN(dateObj.getTime())) continue; // 날짜 없으면 스킵

                const year = String(dateObj.getFullYear()).substring(2);
                const month = dateObj.getMonth() + 1;
                const halfYear = month <= 6 ? 1 : 2;

                const fullPrefix = `${prefixAlpha}${year}${halfYear}-`;

                if (rowData.sample_id && rowData.sample_id.startsWith(fullPrefix)) continue;

                if (!rowsByPrefix[fullPrefix]) {
                    rowsByPrefix[fullPrefix] = { mDate: mDate, rows: [] };
                }
                rowsByPrefix[fullPrefix].rows.push(rowIdx);
            }

            for (const [fullPrefix, info] of Object.entries(rowsByPrefix)) {
                const dbMax = await getMaxSufixFromDB(fullPrefix, info.mDate, idsInGrid);

                const allData = hot.getSourceData();
                let gridMax = 0;
                allData.forEach((r) => {
                    if (r && r.sample_id && r.sample_id.startsWith(fullPrefix)) {
                        const parts = r.sample_id.split('-');
                        if (parts.length > 1) {
                            const seq = parseInt(parts[parts.length - 1]);
                            if (!isNaN(seq) && seq > gridMax) gridMax = seq;
                        }
                    }
                });

                let currentSeq = Math.max(dbMax, gridMax);

                hot.batch(() => {
                    info.rows.sort((a, b) => a - b).forEach(rowIdx => {
                        currentSeq++;
                        const newId = `${fullPrefix}${String(currentSeq).padStart(4, '0')}`;
                        const visualRow = hot.toVisualRow(rowIdx);
                        if (visualRow !== null) {
                            hot.setDataAtRowProp(visualRow, 'sample_id', newId, 'auto');
                        }
                    });
                });
            }
        } catch (err) {
            console.error("Bulk Sample ID Error:", err);
            alert("시료번호 생성 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 데이터를 확인해 주세요.\n로그: " + err.message);
        }
    };

    const calculateSampleId = async (rowIdx) => {
        // ★ AfterChange 등에서 넘어오는 rowIdx는 피지컬 인덱스입니다.
        await applyBulkSampleIds([rowIdx]);
        const visualRow = hotInstance.current.toVisualRow(rowIdx);
        return visualRow !== null ? hotInstance.current.getDataAtRowProp(visualRow, 'sample_id') : null;
    };

    const getSamplePrefix = (instrumentName, workerName = '', commonName = '') => {
        // Step 4: Guard for data load. Use Ref for latest state in closures.
        const currentHazards = allHazardsRef.current;
        let inst = instrumentName;
        
        // ★ 개선: (front), (rear) 등 부가정보가 붙은 경우에도 매칭되도록 보완
        if (!inst && commonName && currentHazards.length > 0) {
            // 1순위: 전체 일치 확인
            let h = currentHazards.find(x => x.common_name === commonName.trim());
            
            // 2순위: 괄호나 슬래시 앞부분만 일치 확인 (예: 디클로로메탄(front) -> 디클로로메탄)
            if (!h) {
                const baseName = commonName.split(/[/(]/)[0].trim();
                h = currentHazards.find(x => x.common_name === baseName);
            }
            
            if (h) inst = h.instrument_name || '';
        }

        // Final Confirmed Rule: "중량분석" -> 'D', Else -> 'S'
        let prefix = 'S';
        if (inst && inst.trim() === "중량분석") {
            prefix = 'D';
        }

        // Preserve "B" logic for blank samples (SB/DB)
        if (workerName && workerName.includes("공시료")) {
            prefix += "B";
        }
        return prefix;
    };

    // Simplified: No longer needed as we use grid-based counting
    async function getNextSampleId(prefix, offset = 0) {
        return "";
    }

    const toggleColumn = (key) => {
        setColumnConfig(prev => {
            const next = { ...prev };
            const current = [...(next[activeTab] || DEFAULT_COLS)];
            if (current.includes(key)) next[activeTab] = current.filter(k => k !== key);
            else next[activeTab] = [...current, key];
            return next;
        });
    };

    const resetColumns = () => {
        if (confirm("컬럼 설정을 초기화하시겠습니까?")) {
            setColumnConfig(prev => {
                const next = { ...prev };
                next[activeTab] = [...DEFAULT_COLS];
                return next;
            });
        }
    };

    const handleSearch = () => {
        if (hotInstance.current) {
            loadGridData(hotInstance.current, supabase, startDate, endDate, comName, user, sortType, idFilter);
        }
    };

    const handleReset = () => {
        const today = formatLocalDate(new Date());
        setStartDate(today);
        setEndDate(today);
        setComName('');
    };

    const getMaxInputSeqBeforeDB = async (date) => {
        try {
            const tableName = getTableName(date);
            if (!tableName) return 0;

            const { data, error } = await supabase
                .from(tableName)
                .select('input_seq')
                .lt('m_date', date)
                .order('input_seq', { ascending: false })
                .limit(1);

            if (error) throw error;
            if (data && data.length > 0) {
                return parseInt(data[0].input_seq, 10) || 0;
            }
            return 0;
        } catch (err) {
            console.error("Error fetching max input_seq before date:", err);
            return 0;
        }
    };

    const reassignAllSampleIds = async () => {
        const hot = hotInstance.current;
        if (!hot) return;

        const includeSaved = confirm('이미 저장된 데이터의 시료번호도 현재 순서대로 다시 매기시겠습니까?\n(취소를 누르면 미저장 데이터만 재계산합니다)');

        // ★ 개선: 화면에 보이는 데이터 중 가장 빠른 날짜를 기준으로 시작 순번을 결정합니다.
        const rowCount = hot.countRows();
        let minDate = null;
        for (let i = 0; i < rowCount; i++) {
            const date = hot.getDataAtRowProp(i, 'm_date');
            if (date && (!minDate || date < minDate)) minDate = date;
        }

        let startSeq = 0;
        if (minDate) {
            startSeq = await getMaxInputSeqBeforeDB(minDate);
        }

        const physicalIndicesToProcess = [];

        hot.batch(() => {
            let currentSeq = startSeq;
            for (let i = 0; i < rowCount; i++) {
                const physicalIdx = hot.toPhysicalRow(i);
                if (physicalIdx === null) continue;

                const rowData = hot.getSourceDataAtRow(physicalIdx);
                if (!rowData) continue;

                // 조건: 유효한 데이터이면서 (미저장이거나 사용자가 저정데이터 포함을 선택했을 때)
                if ((rowData.com_name || rowData.common_name) && (!rowData.id || includeSaved)) {
                    currentSeq++;
                    // 1. 입력순번(input_seq)을 계산된 순서대로 재설정
                    hot.setDataAtRowProp(i, 'input_seq', currentSeq, 'auto');
                    
                    // 2. 기존 번호를 지워서 applyBulkSampleIds가 새로 생성하게 유도
                    hot.setDataAtRowProp(i, 'sample_id', null, 'auto');
                    physicalIndicesToProcess.push(physicalIdx);
                }
            }
        });

        if (physicalIndicesToProcess.length > 0) {
            await applyBulkSampleIds(physicalIndicesToProcess, includeSaved);
            alert(`시료번호가 ${startSeq + 1}번부터 현재 화면 순서대로 재계산되었습니다.\n[데이터 저장]을 눌러야 최종 반영됩니다.`);
        } else {
            alert('재계산할 데이터가 없습니다.');
        }
    };

    const handleSubmit = async () => {
        const hot = hotInstance.current;
        if (!hot) return;

        // ★ 저장 전 체크: 시료번호가 빠진 신규 행이 있다면 자동 부여 시도
        const raw = hot.getSourceData();
        const missingIds = [];
        for (let i = 0; i < raw.length; i++) {
            if (!raw[i].id && (raw[i].com_name && raw[i].common_name) && !raw[i].sample_id) {
                const physicalIdx = hot.toPhysicalRow(i);
                if (physicalIdx !== null) missingIds.push(physicalIdx);
            }
        }
        if (missingIds.length > 0) {
            await applyBulkSampleIds(missingIds);
        }

        const rawLatest = hot.getSourceData();
        
        // ★ 개선: 사업장명과 유해인자가 모두 있는 데이터만 저장 대상으로 선정
        const valid = rawLatest.filter(r => (r.com_name && r.common_name));
        
        // ★ 내용이 비워진 기존 데이터 처리 
        const ghosts = rawLatest.filter(r => r.id && (!r.com_name || !r.common_name));

        if (valid.length === 0 && ghosts.length === 0) { 
            alert('저장하거나 지워진 데이터가 없습니다.'); 
            return; 
        }

        setLoading(true);
        try {
            if (ghosts.length > 0) {
                if(!confirm(`사업장명이나 유해인자가 지워진 기존 데이터가 ${ghosts.length}건 있습니다.\n이 데이터들은 데이터베이스에서도 완전히 삭제됩니다. 계속 진행하시겠습니까?`)) {
                    setLoading(false);
                    return;
                }
                // 그룹별로 삭제
                const ghostsByTable = {};
                ghosts.forEach(g => {
                    const tName = getTableName(g.m_date || startDate);
                    if(tName) {
                        if(!ghostsByTable[tName]) ghostsByTable[tName] = [];
                        ghostsByTable[tName].push(g.id);
                    }
                });
                for (const [tName, ids] of Object.entries(ghostsByTable)) {
                    const { error: delErr } = await supabase.from(tName).delete().in('id', ids);
                    if (delErr) {
                        console.error('Delete ghost error:', delErr);
                        throw new Error(`빈 행 삭제 중 오류 발생: ${delErr.message}`);
                    }
                }
            }
            // Helper: Format time to HH:mm (remove seconds)
            const formatTimeHHMM = (val) => {
                if (!val) return null;
                let digits = String(val).replace(/\D/g, '');
                if (digits.length === 3) digits = '0' + digits;
                if (digits.length === 4) {
                    return digits.substring(0, 2) + ':' + digits.substring(2, 4);
                }
                if (typeof val === 'string' && val.includes(':')) {
                    const parts = val.split(':');
                    if (parts.length >= 2) {
                        return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
                    }
                }
                return val;
            };

            // ★ DB 타입 오류 방지: 빈 문자열 → null 정제 헬퍼
            const sanitizeInt = (v) => {
                if (v === null || v === undefined || v === '') return null;
                const n = parseInt(v, 10);
                return isNaN(n) ? null : n;
            };
            const sanitizeFloat = (v) => {
                if (v === null || v === undefined || v === '') return null;
                const n = parseFloat(v);
                return isNaN(n) ? null : n;
            };
            const sanitizeStr = (v) => {
                if (v === null || v === undefined) return null;
                const s = String(v).trim();
                return s === '' ? null : s;
            };

            // ★ 저장 전 input_seq 자동 부여 ─────────────────────────────────
            // 신규 행(id 없음) 또는 기존 행 중 input_seq가 NULL인 경우
            // DB 전체 최댓값 기준으로 연속 순번을 부여합니다.
            {
                // 1. 그리드에서 현재 max input_seq 파악
                let currentMaxSeq = 0;
                for (const s of rawLatest) {
                    const v = parseInt(s.input_seq);
                    if (!isNaN(v) && v > currentMaxSeq) currentMaxSeq = v;
                }

                // 2. DB에서 전체 max input_seq 조회 (그리드에 보이는 모든 테이블 + 현재 날짜 테이블)
                const tablesInGrid = new Set();
                rawLatest.forEach(s => {
                    const tName = getTableName(s.m_date || startDate);
                    if (tName) tablesInGrid.add(tName);
                });
                const tCurrent = getTableName(startDate);
                if (tCurrent) tablesInGrid.add(tCurrent);

                let dbMaxSeq = 0;
                for (const tName of tablesInGrid) {
                    try {
                        const { data: seqData } = await supabase
                            .from(tName)
                            .select('input_seq')
                            .not('input_seq', 'is', null)
                            .order('input_seq', { ascending: false })
                            .limit(1);
                        if (seqData && seqData.length > 0) {
                            const val = parseInt(seqData[0].input_seq) || 0;
                            if (val > dbMaxSeq) dbMaxSeq = val;
                        }
                    } catch (e) { /* 테이블 없으면 무시 */ }
                }

                let nextSeq = Math.max(currentMaxSeq, dbMaxSeq);
                console.log(`[input_seq] 그리드 최대: ${currentMaxSeq}, DB 최대: ${dbMaxSeq} → 다음 순번: ${nextSeq + 1}부터 부여`);

                // 3. input_seq 없는 행(신규 또는 기존 누락)에 순서대로 부여
                const hot = hotInstance.current;
                for (let i = 0; i < rawLatest.length; i++) {
                    const s = rawLatest[i];
                    if (!(s.com_name && s.common_name)) continue; // 저장 안 되는 행 스킵
                    const hasSeq = s.input_seq !== null && s.input_seq !== undefined && s.input_seq !== '';
                    if (!hasSeq) {
                        nextSeq++;
                        s.input_seq = nextSeq; // rawLatest는 HOT 내부 참조 → 직접 수정
                        // 그리드 셀에도 반영 (UI 표시)
                        if (hot) {
                            hot.setDataAtRowProp(i, 'input_seq', nextSeq, 'auto');
                        }
                    }
                }
            }
            // ─────────────────────────────────────────────────────────────────

            const preparedData = [];

            // Helper to get valid columns from the table
            const getValidData = async (data, tableName) => {
                try {
                    // Attempt to get column list from DB to be truly dynamic
                    const { data: sampleRec } = await supabase.from(tableName).select('*').limit(1);
                    const dbCols = (sampleRec && sampleRec.length > 0) ? Object.keys(sampleRec[0]) : [];
                    const safeColumns = [
                        'm_date', 'com_name', 'work_process', 'worker_name', 'common_name',
                        'pump_no', 'start_time', 'end_time', 'shift_type', 'work_hour',
                        'lunch_time', 'occurrence_type', 'temp', 'humidity',
                        'analyst', 'measured_by', 'received_by', 'sample_id', 'condition',
                        'received_date', 'status', 'completed_at', 'instrument_name', 'hazard_category',
                        'is_self', 'remarks', 'input_seq'
                    ];

                    return data.map(item => {
                        const filtered = {};
                        Object.keys(item).forEach(key => {
                            const isAvailable = dbCols.length > 0 ? dbCols.includes(key) : safeColumns.includes(key);
                            if (isAvailable || key === 'id') {
                                const val = item[key];
                                // ★ 핵심: ID가 null, undefined, 빈 문자열, 0(신규 행의 의미일 때) 이면 전송 데이터에서 제외
                                // 이렇게 해야 Postgres의 Identity나 Default가 작동함
                                if (key === 'id') {
                                    if (val === null || val === undefined || val === '' || val === 0) {
                                        return;
                                    }
                                }
                                filtered[key] = val;
                            }
                        });
                        return filtered;
                    });
                } catch (err) {
                    console.error("Column mapping error:", err);
                    return data;
                }
            };

            for (let i = 0; i < rawLatest.length; i++) {
                const s = rawLatest[i];
                // ★ 필터링 동기화
                if (!(s.com_name && s.common_name)) continue;

                const isBlank = s.worker_name && s.worker_name.includes('공시료');

                const rowData = {
                    ...s,
                    m_date: s.m_date || startDate,
                    // ★ 개선: 신규 행(id 없음)일 때만 현재 검색 필터의 사업장명 자동 입력
                    // 기존 데이터의 사업장명을 수정하거나 지웠을 때 검색 필터값이 덮어씌워지는 현상 방지
                    com_name: (s.id ? s.com_name : (s.com_name || comName)).replace(/\(주\)/g, '㈜').trim(),
                    // 시간 HH:mm 포맷
                    start_time: formatTimeHHMM(s.start_time),
                    end_time: formatTimeHHMM(s.end_time),
                    // ★ integer/numeric/string 컬럼 — 빈 문자열 → null (DB 타입 오류 방지 및 빈칸 유지)
                    pump_no: sanitizeStr(s.pump_no),
                    work_hour: sanitizeFloat(s.work_hour),
                    lunch_time: sanitizeInt(s.lunch_time),
                    temp: sanitizeStr(s.temp),
                    humidity: sanitizeStr(s.humidity),
                    occurrence_type: sanitizeStr(s.occurrence_type),
                    shift_type: sanitizeStr(s.shift_type),
                    condition: sanitizeStr(s.condition) || '양호',
                    input_seq: sanitizeInt(s.input_seq)
                };

                delete rowData.actions;

                if (!rowData.sample_id) {
                    rowData.sample_id = await calculateSampleId(i);
                }
                preparedData.push(rowData);
            }

            // Validation: Ensure prefix matches analysis method
            const unmatchedHazards = [];
            for (const row of preparedData) {
                const text = (row.common_name || '').trim();
                if (!text) continue;
                const baseName = text.split(/[/(]/)[0].trim();
                const exists = allHazardsRef.current.some(h => h.common_name === text || h.common_name === baseName);
                if (allHazardsRef.current.length > 0 && !exists) {
                    unmatchedHazards.push(text);
                }

                const prefix = getSamplePrefix(row.instrument_name, row.worker_name, row.common_name);
                if (row.sample_id && !row.sample_id.startsWith(prefix)) {
                    if (!confirm(`시료번호 [${row.sample_id}]의 접두어가 분석방법(${row.instrument_name})과 일치하지 않습니다.\n권장 접두어: ${prefix}\n그대로 저장하시겠습니까?`)) {
                        setLoading(false);
                        return;
                    }
                }
            }

            if (unmatchedHazards.length > 0) {
                const uniqueUnmatched = Array.from(new Set(unmatchedHazards));
                if (!confirm(`다음 항목은 유해인자 목록에 없는 명칭입니다:\n[${uniqueUnmatched.join(', ')}]\n\n계속 진행하면 기본 접두어('S')가 시료번호에 적용됩니다. 그대로 저장하시겠습니까?`)) {
                    setLoading(false);
                    return;
                }
            }

            // 반기별로 데이터를 그룹화
            const dataByTable = {};
            preparedData.forEach(row => {
                const tableName = getTableName(row.m_date);
                if (!tableName) {
                    console.warn('Invalid date for row, skipping:', row);
                    return;
                }
                if (!dataByTable[tableName]) dataByTable[tableName] = [];
                dataByTable[tableName].push(row);
            });

            // 각 반기 테이블에 데이터 저장
            let totalSaved = 0;
            for (const [tableName, tableData] of Object.entries(dataByTable)) {
                const finalData = await getValidData(tableData, tableName);
                
                // ★ 핵심: 신규 행(insert)과 기존 행(upsert)을 분리하여 처리
                // 한 배치에 ID 유무가 섞이면 PostgREST가 ID에 null을 채워넣어 Identity 에러가 발생함
                const newRows = finalData.filter(r => !r.id);
                const existingRows = finalData.filter(r => r.id);

                if (newRows.length > 0) {
                    const { error: insErr } = await supabase.from(tableName).insert(newRows);
                    if (insErr) throw insErr;
                    totalSaved += newRows.length;
                }

                if (existingRows.length > 0) {
                    // ★ 고유 키 중복 방지: 업데이트할 행들의 시료번호를 먼저 NULL로 초기화
                    const existingIds = existingRows.map(r => r.id).filter(Boolean);
                    if (existingIds.length > 0) {
                        const { error: resetErr } = await supabase
                            .from(tableName)
                            .update({ sample_id: null })
                            .in('id', existingIds);
                        
                        if (resetErr) {
                            // 만약 NOT NULL 제약조건이 있다면 'TEMP_' + ID 형식으로 회피 시도
                            console.warn('Sample ID reset failed, trying TEMP prefix:', resetErr);
                            const tempUpdates = existingIds.map(id => 
                                supabase.from(tableName).update({ sample_id: 'TEMP_' + id }).eq('id', id)
                            );
                            await Promise.all(tempUpdates);
                        }
                    }

                    // 이제 새로운 시료번호로 안전하게 업데이트
                    const { error: upsErr } = await supabase.from(tableName).upsert(existingRows);
                    if (upsErr) throw upsErr;
                    totalSaved += existingRows.length;
                }
            }

            alert(totalSaved + '건 저장되었습니다.');

            isDirtyRef.current = false;

            // Reload data to reflect changes (esp generated IDs)
            loadGridData(hot, supabase, startDate, endDate, comName, user, sortType, idFilter);

        } catch (err) {
            console.error(err);
            alert('저장 중 오류: ' + err.message);
        } finally { setLoading(false); }
    };

    if (!user) return null;

    return e('div', { className: "flex flex-col h-screen" },
        e('header', { className: "glass-header h-16 flex items-center justify-between px-8 sticky top-0 z-50" },
            e('div', { className: "flex items-center gap-6" },
                e('a', { href: "main.html", className: "p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors flex items-center gap-2", title: "홈으로 이동" },
                    e(Home, { size: 22 }),
                    e('span', { className: "text-xs font-bold" }, "HOME")
                ),
                e('h1', { className: "text-xl font-extrabold text-indigo-700 tracking-tight flex items-center gap-2" }, 
                    e(FlaskConical, { size: 24 }), 
                    " KiWE 시료관리시스템",
                    e('a', { href: 'manual.html#section-sampling', target: '_blank', className: 'ml-2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors', title: '시료관리 도움말 (새창)' },
                        e(HelpCircle, { size: 18 })
                    )
                ),
                e('nav', { className: "flex gap-8 h-full items-center ml-10" },
                    e('button', { onClick: () => handleTabChange(1), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 1 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "시료채취기록대장"),
                    e('button', { onClick: () => handleTabChange(2), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 2 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "유량보정대장"),
                    e('button', { onClick: () => handleTabChange(3), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 3 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "유해인자 설정"),
                    e('button', { onClick: () => handleTabChange(4), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 4 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "시료대장(통계)"),
                    e('button', { onClick: () => handleTabChange(5), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 5 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "🎧 소음대장"),
                    e('a', {
                        href: "#",
                        onClick: (ev) => { ev.preventDefault(); window.open('sample_record_print.html', 'samplePrint', 'width=1400,height=900,resizable=yes,scrollbars=yes'); },
                        className: "text-sm font-bold pb-1 transition-all text-emerald-500 hover:text-emerald-700 flex items-center gap-1",
                        title: "시료채취기록표 출력 팝업 열기"
                    }, "🧪 시료채취기록표")
                )
            ),
            e('div', { className: "flex items-center gap-4" },
                e('div', { className: "flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full text-xs font-black text-indigo-600 border border-indigo-100 shadow-sm" },
                    e(User, { size: 14 }), user.user_name + " 님"
                )
            )
        ),
        e('main', { className: "flex-1 flex flex-col overflow-hidden bg-slate-50" },
            activeTab === 1 && e('div', { className: "flex-1 flex flex-col overflow-hidden p-4 gap-3" },
                e('div', { className: "card-custom p-4 flex-shrink-0" },
                    e('div', { className: "flex items-center gap-6" },
                        e('div', { className: "flex-1 max-w-sm" },
                            e('label', { className: "text-[11px] font-extrabold text-slate-400 mb-1 block uppercase" }, "측정일자 (Search)"),
                            e('div', { className: "flex items-center gap-2" },
                                e('div', { className: "relative flex-1" },
                                    e(Calendar, { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400", size: 16 }),
                                    e('input', { type: "date", className: "input-standard pl-10", value: startDate, onChange: (ev) => setStartDate(ev.target.value) })
                                ),
                                e('span', { className: "text-slate-400" }, "~"),
                                e('div', { className: "relative flex-1" },
                                    e('input', { type: "date", className: "input-standard px-3", value: endDate, onChange: (ev) => setEndDate(ev.target.value) })
                                )
                            )
                        ),
                        e('div', { className: "flex-1 flex items-end gap-3" },
                            e('div', { className: "flex-1 relative" },
                                e('label', { className: "text-[11px] font-extrabold text-slate-400 mb-1 block uppercase" }, "사업장명 (Search)"),
                                e('div', { className: "relative flex gap-2" },
                                    e('div', { className: "relative flex-1" },
                                        e(Building2, { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400", size: 16 }),
                                        e('input', {
                                            type: "text",
                                            placeholder: "사업장 검색...",
                                            className: "input-standard pl-10 h-[42px]",
                                            value: comName,
                                            onChange: (ev) => { setComName(ev.target.value); setShowCompanyList(true); },
                                            onKeyDown: (ev) => { if (ev.key === 'Enter') handleSearch(); },
                                            onFocus: () => setShowCompanyList(true)
                                        }),
                                        showCompanyList && comName && e('div', { className: "absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto" },
                                            companies.filter(c => {
                                                const normalizeForSearch = (str) => (str || '').replace(/\(주\)|㈜|\s/g, '').toLowerCase();
                                                const normTerm = normalizeForSearch(comName);
                                                const normName = normalizeForSearch(c.com_name);
                                                return normName.includes(normTerm);
                                            }).map(c =>
                                                e('div', { key: c.com_id, onClick: () => { setComName(c.com_name); setShowCompanyList(false); }, className: "px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold" }, c.com_name)
                                            )
                                        )
                                    ),
                                    e('button', { onClick: handleSearch, className: "btn-primary bg-indigo-500 hover:bg-indigo-600 h-[42px] px-6" }, e(Search, { size: 18 }), "검색"),
                                    e('button', { onClick: handleReset, className: "h-[42px] px-4 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap", title: "검색 초기화" },
                                        e(RotateCcw, { size: 18 }),
                                        e('span', { className: "text-xs font-bold" }, "초기화")
                                    )
                                )
                            ),
                            e('div', { className: "h-10 w-px bg-slate-200 mx-1" }),
                            e('div', { className: "flex flex-col gap-1" },
                                e('label', { className: "text-[11px] font-extrabold text-slate-400 block uppercase" }, "시료 분류 필터"),
                                e('div', { className: 'flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200' },
                                    e('button', {
                                        onClick: () => setIdFilter('all'),
                                        className: `px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${idFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`
                                    }, '전체'),
                                    e('button', {
                                        onClick: () => setIdFilter('s'),
                                        className: `px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${idFilter === 's' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`
                                    }, '🔬 시료(S)'),
                                    e('button', {
                                        onClick: () => setIdFilter('d'),
                                        className: `px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${idFilter === 'd' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`
                                    }, '🔬 시료(D)'),
                                    e('button', {
                                        onClick: () => setIdFilter('sb'),
                                        className: `px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${idFilter === 'sb' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`
                                    }, '🧪 공시료(SB)'),
                                    e('button', {
                                        onClick: () => setIdFilter('db'),
                                        className: `px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${idFilter === 'db' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`
                                    }, '🧪 공시료(DB)')
                                )
                            ),
                            e('div', { className: "flex flex-col gap-1" },
                                e('label', { className: "text-[11px] font-extrabold text-slate-400 block uppercase" }, "정렬 기준"),
                                e('div', { className: 'flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200' },
                                    e('button', {
                                        onClick: () => setSortType('input'),
                                        className: `px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${sortType === 'input' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`
                                    }, '📝 입력순'),
                                    e('button', {
                                        onClick: () => setSortType('sample_id'),
                                        className: `px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${sortType === 'sample_id' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`
                                    }, '🔢 시료번호순')
                                )
                            )
                        )
                    )
                ),
                // Column Settings Modal
                showSettings && e('div', { className: "card-custom p-4 flex-shrink-0 border-indigo-100 ring-4 ring-indigo-50/50" },
                    e('div', { className: "flex justify-between items-center mb-4" },
                        e('h3', { className: "font-bold text-slate-700 flex items-center gap-2" }, e(Settings, { size: 18, className: "text-indigo-600" }), "기록대장 컬럼 구성 및 순서 설정"),
                        e('div', { className: "flex items-center gap-2" },
                            // ★ 공유 저장 버튼
                            e('button', {
                                onClick: () => saveColumnConfigToDB(columnConfig),
                                disabled: settingsSaveStatus === 'saving',
                                className: (
                                    settingsSaveStatus === 'saved' ? "text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200" :
                                        settingsSaveStatus === 'error' ? "text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-500 border border-red-200" :
                                            settingsSaveStatus === 'saving' ? "text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 border border-slate-200" :
                                                "text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm"
                                )
                            },
                                settingsSaveStatus === 'saved' ? '✅ 저장 완료 (공유됨)' :
                                    settingsSaveStatus === 'error' ? '❌ 저장 실패' :
                                        settingsSaveStatus === 'saving' ? '저장 중...' :
                                            '🌐 공유 저장'
                            ),
                            e('button', { onClick: resetColumns, className: "text-xs font-bold text-slate-400 hover:text-red-500 px-2" }, "초기화"),
                            e('button', { onClick: () => setShowSettings(false), className: "text-slate-400 hover:text-slate-600" }, e(X, { size: 18 }))
                        )
                    ),
                    e('p', { className: "text-[11px] text-indigo-500 bg-indigo-50 rounded-lg px-3 py-2 mb-4 font-bold" },
                        "💡 컬럼 순서/표시 설정 후 [🌐 공유 저장]을 누르면 다른 컴퓨터/다른 사용자에게도 동일하게 적용됩니다."
                    ),
                    e('div', { className: "mb-6" },
                        e('div', { className: "text-xs font-bold text-indigo-600 mb-3" }, "표시 순서 (드래그하여 변경, X 클릭하여 제외)"),
                        e('div', {
                            ref: sortableRef,
                            className: "flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200"
                        },
                            currentCols.map((key) => {
                                const col = ALL_GRID_COLUMNS.find(c => c.key === key);
                                if (!col) return null;
                                return e('div', {
                                    key: key,
                                    'data-id': key,
                                    className: "group flex items-center gap-2 bg-white border border-indigo-100 rounded-lg pl-2 pr-2 py-1.5 shadow-sm hover:border-indigo-300 transition-all select-none"
                                },
                                    e('div', { className: "drag-handle p-1 cursor-grab text-slate-300 hover:text-indigo-500 active:cursor-grabbing" },
                                        e('svg', { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3" },
                                            e('circle', { cx: "9", cy: "5", r: "1" }), e('circle', { cx: "9", cy: "12", r: "1" }), e('circle', { cx: "9", cy: "19", r: "1" }),
                                            e('circle', { cx: "15", cy: "5", r: "1" }), e('circle', { cx: "15", cy: "12", r: "1" }), e('circle', { cx: "15", cy: "19", r: "1" })
                                        )
                                    ),
                                    e('span', { className: "text-sm font-bold text-slate-700" }, col.label),
                                    e('button', {
                                        onClick: (ev) => { ev.stopPropagation(); toggleColumn(key); },
                                        className: "p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 ml-1"
                                    }, e(X, { size: 14 }))
                                );
                            })
                        )
                    ),
                    e('div', { className: "pt-4 border-t border-slate-100" },
                        e('div', { className: "text-xs font-bold text-slate-400 mb-3" }, "비활성 컬럼 (클릭하여 추가)"),
                        e('div', { className: "flex flex-wrap gap-2" },
                            ALL_GRID_COLUMNS.filter(c => !currentCols.includes(c.key)).map(col =>
                                e('button', {
                                    key: col.key,
                                    onClick: () => toggleColumn(col.key),
                                    className: "px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                                }, "+ " + col.label)
                            )
                        )
                    )
                ),
                e('div', { className: "card-custom flex flex-col overflow-hidden flex-1 min-h-0" },
                    e('div', { className: "p-3 border-b bg-slate-50 flex items-center justify-between text-xs text-slate-400 font-bold flex-shrink-0" },
                        e('div', { className: "flex items-center gap-4" },
                            e('span', { className: "flex items-center gap-1" }, e(Info, { size: 14, className: "text-blue-500" }), " [유해인자] 셀 더블클릭 -> 검색"),
                        ),
                        e('div', { className: "flex gap-2" },
                            e('button', { onClick: () => setShowSettings(!showSettings), className: "px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-50 transition-all flex items-center gap-1 shadow-sm" },
                                e(Settings, { size: 14 }), "컬럼설정"
                            ),
                            e('button', { onClick: reassignAllSampleIds, className: "px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg font-bold hover:bg-amber-100 transition-all flex items-center gap-1 shadow-sm", title: "미저장 데이터의 시료번호를 다시 매깁니다." },
                                e(RotateCcw, { size: 14 }), "번호 재부여"
                            ),
                            e('button', { onClick: () => addRows(10), className: "px-4 py-2 bg-slate-500 text-white rounded-lg font-bold hover:bg-slate-600 transition-all flex items-center gap-1" },
                                e(Plus, { size: 14 }), "10줄 추가"
                            ),
                            e('button', { onClick: () => addRows(50), className: "px-4 py-2 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 transition-all flex items-center gap-1" },
                                e(Plus, { size: 14 }), "50줄 추가"
                            ),
                            e('button', { onClick: handleSubmit, disabled: loading, className: "px-6 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2" },
                                e(Save, { size: 18 }), loading ? '저장 중...' : '데이터 저장'
                            )
                        )
                    ),
                    e('div', { className: "flex-1 min-h-0" },
                        e('div', { ref: hotRef, style: { height: '100%' } })
                    )
                )
            ),
            activeTab === 2 && e('div', { className: "flex-1 flex justify-center bg-slate-100/50 overflow-auto py-6" },
                e('div', { className: "w-full max-w-[1350px] shadow-2xl border bg-white rounded-xl overflow-hidden flex flex-col h-fit mb-10" },
                    e('iframe', { src: "flow.html?mode=input&m_date=" + startDate, className: "w-full border-none", style: { height: '1200px' } })
                )
            ),
            activeTab === 3 && e(HazardManagement),
            activeTab === 4 && e('div', { className: "flex-1 flex justify-center bg-slate-100/50" },
                e('div', { className: "w-full shadow-2xl bg-white overflow-hidden" },
                    e('iframe', { src: "sampling_manage.html?iframe=true", className: "w-full h-full border-none", style: { height: 'calc(100vh - 64px)' } })
                )
            ),
            activeTab === 5 && e('div', { className: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
                e(NoiseRecord, { user: user, supabase: supabase })
            )
        )
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));


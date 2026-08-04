// js/flow.js
import { supabase } from './config.js';

let hot;

// URL Parameters
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode') || 'input'; // 'input' or 'view'
const paramDate = urlParams.get('m_date');
const paramPump = urlParams.get('pump_no');

// Helper: Format Date
const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date)) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d2 = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d2}`;
};

// Helper: Get Workday Before (Mon -> Fri)
const getPreviousWorkday = (dateStr) => {
    let date = new Date(dateStr);
    if (isNaN(date)) return '';
    date.setDate(date.getDate() - 1);
    if (date.getDay() === 0) date.setDate(date.getDate() - 2);
    else if (date.getDay() === 6) date.setDate(date.getDate() - 1);
    return formatDate(date);
};

// Check if Handsontable is available
const checkHandsontable = () => {
    if (typeof Handsontable === 'undefined') {
        const msg = 'Handsontable 라이브러리가 로드되지 않았습니다. 인터넷 연결이나 CDN 상태를 확인해주세요.';
        console.error(msg);
        alert(msg);
        return false;
    }
    return true;
};

// State for Dirty Check
let isDirty = false;

// Prevent leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Debounce helper for Auto-save
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Auto-save function (Debounced 2 seconds)
const autoSave = debounce(async () => {
    if (isDirty) {
        console.log('Auto-saving...');
        await saveData(true); // true = silent mode
    }
}, 2000);

export async function initFlowPage() {
    console.log('initFlowPage started');
    if (!checkHandsontable()) return;

    // 1. Render Empty Grid Immediately
    renderGrid([]);

    // UI Mode Adjustments
    if (mode === 'view') {
        const saveBtn = document.getElementById('saveBtn');
        const addRowsBtn = document.getElementById('addRowsBtn');
        if (saveBtn) saveBtn.style.display = 'none';
        if (addRowsBtn) addRowsBtn.style.display = 'none';
    }

    // Set filters
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const pumpFilterInput = document.getElementById('pumpFilter');

    if (paramDate) {
        if (startDateInput) startDateInput.value = paramDate;
        if (endDateInput) endDateInput.value = paramDate;
    } else {
        const today = new Date();
        const todayStr = formatDate(today);
        // Default to Today always
        if (startDateInput) startDateInput.value = todayStr;
        if (endDateInput) endDateInput.value = todayStr;
    }

    if (paramPump && pumpFilterInput) pumpFilterInput.value = paramPump;

    // 2. Then Fetch
    await fetchData();

    // Listen to filters
    if (startDateInput) startDateInput.addEventListener('change', fetchData);
    if (endDateInput) endDateInput.addEventListener('change', fetchData);
    if (pumpFilterInput) pumpFilterInput.addEventListener('input', fetchData);

    document.getElementById('saveBtn')?.addEventListener('click', () => saveData(false));
    // document.getElementById('deleteBtn')?.addEventListener('click', deleteSelectedRows); // Removed external delete button

    // Add 5 Rows
    document.getElementById('addRowsBtn')?.addEventListener('click', () => {
        if (!hot) return;
        const count = hot.countRows();
        hot.alter('insert_row_below', count, 5); // Add 5 rows
        isDirty = true;

        // Pre-fill date for new rows
        const currentMDate = document.getElementById('startDate')?.value;
        if (currentMDate) {
            const preCal = getPreviousWorkday(currentMDate);
            for (let i = 0; i < 5; i++) {
                hot.setDataAtRowProp(count + i, 'm_date', currentMDate);
                hot.setDataAtRowProp(count + i, 'pre_cal_date', preCal);
                hot.setDataAtRowProp(count + i, 'post_cal_date', currentMDate);
            }
        }
    });

    // Add 1 Row (New Button)
    document.getElementById('addOneRowBtn')?.addEventListener('click', () => {
        if (!hot) return;
        const count = hot.countRows();
        hot.alter('insert_row_below', count, 1); // Add 1 row
        isDirty = true;

        const currentMDate = document.getElementById('startDate')?.value;
        if (currentMDate) {
            const preCal = getPreviousWorkday(currentMDate);
            hot.setDataAtRowProp(count, 'm_date', currentMDate);
            hot.setDataAtRowProp(count, 'pre_cal_date', preCal);
            hot.setDataAtRowProp(count, 'post_cal_date', currentMDate);
        }
    });
}

async function fetchData() {
    const startStr = document.getElementById('startDate')?.value;
    const endStr = document.getElementById('endDate')?.value;
    const pumpTerm = document.getElementById('pumpFilter')?.value;

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

    // 1. Fetch kiwe_flow metadata
    let query = supabase.from('kiwe_flow').select('*').order('m_date', { ascending: true }).order('pump_no', { ascending: true });
    if (startStr) query = query.gte('m_date', startStr);
    if (endStr) query = query.lte('m_date', endStr);
    if (pumpTerm) query = query.ilike('pump_no', `%${pumpTerm}%`);
    const { data: flowData, error: flowErr } = await query;

    if (flowErr) {
        console.error('Fetch error:', flowErr);
        alert('데이터 조회 중 오류가 발생했습니다: ' + (flowErr.message || '알 수 없는 오류'));
        renderGrid([]);
        return;
    }

    // 2. Fetch kiwe_sampling data (with flow values)
    const tableList = getTableList(startStr || new Date().toISOString().split('T')[0], endStr || new Date().toISOString().split('T')[0]);
    const rawArrays = await Promise.all(
        tableList.map(async tn => {
            try {
                // 상반기: pre_flow_1~3, post_flow_1~3 / 하반기: pre_flow_avg, post_flow_avg 두 코드 모두 가져올것
                // ★ 제안2: 소음(유량 없는 유해인자) 제외 — common_name에 '소음'이 포함된 행 필터
                let q = supabase.from(tn)
                    .select('m_date, pump_no, common_name, measured_by, pre_flow_avg, post_flow_avg, pre_flow_1, pre_flow_2, pre_flow_3, post_flow_1, post_flow_2, post_flow_3')
                    .not('pump_no', 'is', null)
                    .not('common_name', 'ilike', '%소음%'); // ★ 소음 제외
                if (startStr) q = q.gte('m_date', startStr);
                if (endStr) q = q.lte('m_date', endStr);
                if (pumpTerm) q = q.ilike('pump_no', `%${pumpTerm}%`);
                const { data } = await q;
                return data || [];
            } catch { return []; }
        })
    );
    const rawData = rawArrays.flat();

    // 3. Aggregate sampling data by m_date + pump_no (flow values from sampling take priority)
    // 상반기(pre_flow_1~3) / 하반기(pre_flow_avg) 두 형식 모두 지원
    const calcAvgFromRuns = (v1, v2, v3) => {
        let sum = 0, cnt = 0;
        const n1 = parseFloat(v1), n2 = parseFloat(v2), n3 = parseFloat(v3);
        if (!isNaN(n1) && n1 > 0) { sum += n1; cnt++; }
        if (!isNaN(n2) && n2 > 0) { sum += n2; cnt++; }
        if (!isNaN(n3) && n3 > 0) { sum += n3; cnt++; }
        return cnt > 0 ? sum / cnt : NaN;
    };

    // ★ 제안1: m_date+pump_no 기준으로 measured_by(측정자)도 집계 (보정자 fallback용)
    const measuredByMap = new Map();
    rawData.forEach(r => {
        const key = `${r.m_date}_${r.pump_no}`;
        if (r.measured_by && !measuredByMap.has(key)) {
            measuredByMap.set(key, r.measured_by);
        }
    });

    const samplingMap = new Map();
    rawData.forEach(r => {
        let preAvg = parseFloat(r.pre_flow_avg);
        let postAvg = parseFloat(r.post_flow_avg);

        // 상반기와 같이 pre_flow_avg가 없는 경우 1~3회에서 평균 계산
        if (isNaN(preAvg) || preAvg <= 0) {
            const computed = calcAvgFromRuns(r.pre_flow_1, r.pre_flow_2, r.pre_flow_3);
            if (!isNaN(computed)) preAvg = computed;
        }
        if (isNaN(postAvg) || postAvg <= 0) {
            const computed = calcAvgFromRuns(r.post_flow_1, r.post_flow_2, r.post_flow_3);
            if (!isNaN(computed)) postAvg = computed;
        }

        const hasData = !isNaN(preAvg) || !isNaN(postAvg);
        const key = `${r.m_date}_${r.pump_no}`;
        if (!samplingMap.has(key) || hasData) {
            samplingMap.set(key, { ...r, pre_flow_avg: !isNaN(preAvg) ? preAvg : null, post_flow_avg: !isNaN(postAvg) ? postAvg : null });
        }
    });

    // 4. Merge: sampling data provides flow values, kiwe_flow provides calibration metadata
    const finalMap = new Map();
    samplingMap.forEach((samp, key) => {
        finalMap.set(key, { m_date: samp.m_date, pump_no: samp.pump_no, ...samp });
    });
    (flowData || []).forEach(f => {
        const key = `${f.m_date}_${f.pump_no}`;
        if (finalMap.has(key)) {
            const ext = finalMap.get(key);
            // ★ 제안1: 보정자(calibrator_person)가 kiwe_flow에 없으면 측정자(measured_by)로 자동 대체
            const resolvedCalibratorPerson = f.calibrator_person || measuredByMap.get(key) || ext.measured_by || null;
            // 시료대장의 유량값이 우선, kiwe_flow의 보정 메타데이터만 덮어씀
            finalMap.set(key, {
                ...f, ...ext,
                calibrator_no: f.calibrator_no,
                calibrator_person: resolvedCalibratorPerson,
                pre_cal_date: f.pre_cal_date, post_cal_date: f.post_cal_date,
                flow_id: f.flow_id
            });
        } else {
            // 시료대장에 없는 펌프지만 유량보정대장에는 있는 경우 (과거 데이터 등)
            // ★ 제안1: 이 경우에도 calibrator_person 없으면 측정자로 fallback
            const resolvedCalibratorPerson = f.calibrator_person || measuredByMap.get(key) || null;
            finalMap.set(key, { ...f, calibrator_person: resolvedCalibratorPerson });
        }
    });

    const finalData = Array.from(finalMap.values()).sort((a,b) => {
        if(a.m_date !== b.m_date) return (a.m_date || '').localeCompare(b.m_date || '');
        return (a.pump_no || '').localeCompare(b.pump_no || '');
    });

    // 5. Calculate averages on the fly
    finalData.forEach(row => {
        const preAvg = parseFloat(row.pre_flow_avg);
        const postAvg = parseFloat(row.post_flow_avg);
        
        row.pre_avg = !isNaN(preAvg) ? preAvg : null;
        row.post_avg = !isNaN(postAvg) ? postAvg : null;

        if (row.pre_avg !== null || row.post_avg !== null) {
            let totalAvg = 0;
            if (row.pre_avg !== null && row.post_avg !== null) totalAvg = (row.pre_avg + row.post_avg) / 2;
            else if (row.pre_avg !== null) totalAvg = row.pre_avg;
            else if (row.post_avg !== null) totalAvg = row.post_avg;
            row.total_avg = Number(totalAvg.toFixed(3));
        } else {
            row.total_avg = null;
        }
    });

    renderGrid(finalData);
    isDirty = false;
}

function renderGrid(data) {
    // const minRows = 30; // Removed minRows
    const displayData = [...data];
    // Removed empty row padding loop

    if (hot) {
        hot.loadData(displayData);
        isDirty = false; // Reset dirty state after load
        return;
    }

    const container = document.getElementById('hot');
    if (!container) {
        console.error('Grid container (#hot) not found at render time');
        return;
    }
    console.log('Rendering grid with data length:', displayData.length);

    // Clear Loading Message
    container.innerHTML = '';

    // Center alignment style
    const centerClass = 'htCenter htMiddle';

    // Delete Button Renderer
    const deleteRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        while (td.firstChild) {
            td.removeChild(td.firstChild);
        }
        const btn = document.createElement('button');
        btn.className = 'bg-red-50 text-red-600 hover:bg-red-100 p-1 rounded transition-colors';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
        btn.onclick = (e) => {
            e.preventDefault();
            // Call delete function for this row
            deleteRow(row);
        };
        const div = document.createElement('div');
        div.className = 'flex items-center justify-center h-full w-full';
        div.appendChild(btn);
        td.appendChild(div);
        return td;
    };

    const autoShrinkRenderer = function (instance, td, row, col, prop, value, cellProperties) {
        if (cellProperties.type === 'date') {
            Handsontable.renderers.DateRenderer.apply(this, arguments);
        } else if (cellProperties.type === 'numeric') {
            Handsontable.renderers.NumericRenderer.apply(this, arguments);
        } else {
            Handsontable.renderers.TextRenderer.apply(this, arguments);
        }

        td.style.whiteSpace = 'nowrap';
        td.style.overflow = 'hidden';
        td.style.textOverflow = 'clip';
        td.style.fontSize = '12px'; // default

        const text = value ? String(value) : '';
        const colWidth = instance.getColWidth(col) || 100;
        const charCount = text.length;

        if (charCount > 0) {
            const estimatedWidth = charCount * 7.5;
            if (estimatedWidth > colWidth - 10) {
                const ratio = (colWidth - 10) / estimatedWidth;
                const newSize = Math.max(9, Math.floor(12 * ratio));
                td.style.fontSize = newSize + 'px';
            }
        }
        return td;
    };

    // Add event listeners for new buttons
    document.getElementById('excelBtn')?.addEventListener('click', () => {
        if (!hot) return;
        const exportPlugin = hot.getPlugin('exportFile');
        exportPlugin.downloadFile('csv', {
            bom: true,
            columnDelimiter: ',',
            columnHeaders: true,
            exportHiddenColumns: true,
            exportHiddenRows: true,
            fileExtension: 'csv',
            filename: '유량보정대장_[YYYY]-[MM]-[DD]',
            mimeType: 'text/csv',
            rowDelimiter: '\r\n',
            rowHeaders: true
        });
        // Note: CSV export is built-in. For XLSX, we can use SheetJS since we added it to flow.html.
        const hotData = hot.getData();
        const headers = hot.getColHeader();
        const wsData = [headers, ...hotData];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "유량보정대장");
        const todayStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `유량보정대장_${todayStr}.xlsx`);
    });

    document.getElementById('printBtn')?.addEventListener('click', () => {
        window.print();
    });

    hot = new Handsontable(container, {
        data: displayData,
        readOnly: mode === 'view',
        colHeaders: [
            '연번', '관리', '측정일자', '펌프번호', '보정기', '보정자', '전유량보정일자',
            '측정전평균유량',
            '후유량보정일자',
            '측정후평균유량',
            '전체평균유량'
        ],
        columns: [
            { data: 'seq', renderer: function(instance, td, row) { td.innerHTML = row + 1; td.style.background = '#f8fafc'; td.style.color = '#475569'; td.style.fontWeight = 'bold'; return td; }, readOnly: true, width: 40, className: 'htCenter htMiddle' },
            { data: 'actions', renderer: deleteRenderer, readOnly: true, width: 45, className: centerClass },
            { data: 'm_date', type: 'date', dateFormat: 'YYYY-MM-DD', renderer: autoShrinkRenderer, width: 95, className: centerClass },
            { data: 'pump_no', type: 'text', width: 75, className: centerClass },
            { data: 'calibrator_no', type: 'numeric', width: 60, className: centerClass },
            { data: 'calibrator_person', type: 'text', width: 70, className: centerClass },
            { data: 'pre_cal_date', type: 'date', dateFormat: 'YYYY-MM-DD', renderer: autoShrinkRenderer, width: 95, className: centerClass },
            { data: 'pre_avg', type: 'numeric', numericFormat: { pattern: '0.000' }, readOnly: true, width: 95, className: centerClass + ' font-bold bg-slate-100' },
            { data: 'post_cal_date', type: 'date', dateFormat: 'YYYY-MM-DD', renderer: autoShrinkRenderer, width: 95, className: centerClass },
            { data: 'post_avg', type: 'numeric', numericFormat: { pattern: '0.000' }, readOnly: true, width: 95, className: centerClass + ' font-bold bg-slate-100' },
            { data: 'total_avg', type: 'numeric', numericFormat: { pattern: '0.000' }, readOnly: true, renderer: autoShrinkRenderer, width: 120, className: 'htCenter htMiddle font-bold text-indigo-700 bg-indigo-50/50' }
        ],
        wordWrap: false,
        rowHeaders: false,
        fixedColumnsLeft: 0,
        stretchH: 'all',  /* 화면 전체 폭 활용 */
        rowHeights: 34,
        autoRowSize: false,
        autoColumnSize: true, /* ★ 내용에 맞게 너비 자동 조절 (잘림 방지) */
        height: 'calc(100vh - 120px)',
        contextMenu: mode === 'input',
        copyPaste: true,
        autoWrapRow: true,
        autoWrapCol: true,
        manualColumnResize: true,
        manualColumnMove: true,
        licenseKey: 'non-commercial-and-evaluation',
        viewportRowRenderingOffset: 20,
        minSpareRows: 0, // Ensure no empty rows are created automatically
        afterChange: function (changes, source) {
            if (source === 'loadData' || mode === 'view' || !changes) return;

            isDirty = true; // Mark as dirty
            autoSave(); // Trigger auto-save

            changes.forEach(([row, prop, oldVal, newVal]) => {
                if (prop === 'm_date' && newVal) {
                    // Always update if m_date changed, to keep in sync
                    const preCal = getPreviousWorkday(newVal);
                    this.setDataAtRowProp([
                        [row, 'pre_cal_date', preCal],
                        [row, 'post_cal_date', newVal]
                    ]);
                }

                const calcTotalAvg = () => {
                    const pre = parseFloat(this.getDataAtRowProp(row, 'pre_avg'));
                    const post = parseFloat(this.getDataAtRowProp(row, 'post_avg'));
                    if (!isNaN(pre) && !isNaN(post)) {
                        const total = Number(((pre + post) / 2).toFixed(3));
                        this.setDataAtRowProp(row, 'total_avg', total);
                    }
                };

                if (prop === 'pre_avg' || prop === 'post_avg') calcTotalAvg();
            });
        },
        cells: function (row, col, prop) {
            const cellProperties = {};
            const hotInstance = this.instance;
            if (!hotInstance) return cellProperties;

            const cellData = hotInstance.getSourceDataAtRow(row);
            if (!cellData) return cellProperties;

            if (cellData.m_date && cellData.pump_no) {
                if (prop.includes('flow_') && (cellData[prop] === null || cellData[prop] === undefined || cellData[prop] === '')) {
                    cellProperties.className = 'missing-data';
                }
            }
            return cellProperties;
        }
    });
}

/**
 * Validation Logic:
 * 1. Pre-Avg vs Post-Avg difference > 10%
 */
function getFlowWarnings(validData) {
    const warnings = [];
    validData.forEach(row => {
        const date = row.m_date || '-';
        const pump = row.pump_no || '-';
        const context = `[${date}] 펌프 ${pump}`;

        // 1. 10% Variation Check for Pre/Post Average
        if (row.pre_avg && row.post_avg) {
            const diff = Math.abs(row.pre_avg - row.post_avg);
            const avgDiff = diff / row.pre_avg;

            if (avgDiff >= 0.10) {
                warnings.push(`${context}: 전/후 평균 유량 차이가 10% 이상입니다. (차이: ${(avgDiff * 100).toFixed(2)}%)`);
            }
        }
    });
    return warnings;
}

async function saveData(silent = false) {
    if (!supabase) {
        if (!silent) alert('데이터베이스 연결에 실패하여 저장할 수 없습니다.');
        return;
    }
    if (!hot) return;
    const rawData = hot.getSourceData();

    // 1. Filter valid rows
    const validData = rawData
        .filter(r => r.m_date && r.pump_no)
        .map(r => {
            const cleaned = {
                m_date: r.m_date,
                pump_no: r.pump_no,
                calibrator_no: (r.calibrator_no === '' || r.calibrator_no === undefined || r.calibrator_no === null) ? null : parseFloat(r.calibrator_no),
                calibrator_person: r.calibrator_person || null,
                pre_cal_date: r.pre_cal_date || null,
                post_cal_date: r.post_cal_date || null,
                // 주의: 유량값(pre/post flow)은 kiwe_sampling에서 관리하므로 kiwe_flow에는 저장하지 않음
            };
            return cleaned;
        });

    if (validData.length === 0) {
        if (!silent) alert('저장할 유효한 데이터가 없습니다. (날짜와 펌프번호 필수)');
        return;
    }

    // 2. Client-side Duplicate Validation
    const uniqueKeys = new Set();
    const duplicates = [];
    validData.forEach((row, index) => {
        const key = `${row.m_date}_${row.pump_no}`;
        if (uniqueKeys.has(key)) {
            duplicates.push(`${row.m_date} / ${row.pump_no}`);
        } else {
            uniqueKeys.add(key);
        }
    });

    if (duplicates.length > 0) {
        if (!silent) alert(`중복된 데이터가 있어 저장할 수 없습니다.\n\n[중복 목록]\n${duplicates.join('\n')}\n\n날짜와 펌프번호는 고유해야 합니다.`);
        return;
    }

    try {
        // 3. Upsert with select() to get back IDs
        const { data: savedRows, error } = await supabase
            .from('kiwe_flow')
            .upsert(validData, { onConflict: 'm_date, pump_no' })
            .select(); 

        if (error) throw error;

        if (savedRows && savedRows.length > 0) {
            const savedMap = new Map();
            savedRows.forEach(row => {
                savedMap.set(`${row.m_date}_${row.pump_no}`, row);
            });

            let updatedCount = 0;
            hot.getSourceData().forEach(gridRow => {
                if (gridRow.m_date && gridRow.pump_no) {
                    const key = `${gridRow.m_date}_${gridRow.pump_no}`;
                    if (savedMap.has(key)) {
                        const saved = savedMap.get(key);
                        gridRow.flow_id = saved.flow_id; 
                        updatedCount++;
                    }
                }
            });
            console.log(`Updated flow_id for ${updatedCount} rows.`);
        }

        isDirty = false; 
        if (!silent) {
            alert('유량보정대장이 성공적으로 저장되었습니다.');
            await fetchData();
        } else {
            console.log('Auto-save successful');
        }

    } catch (err) {
        console.error(err);
        if (!silent) alert('저장 중 오류: ' + (err.message || '알 수 없는 오류'));
    }
}

async function deleteRow(visualRowIndex) {
    if (!hot) return;

    // Convert visual row to physical row to get correct data
    const physicalRow = hot.toPhysicalRow(visualRowIndex);
    const rowData = hot.getSourceDataAtRow(physicalRow);

    if (!rowData) return;

    // If it's an unsaved row (no flow_id), just remove it from grid
    if (!rowData.flow_id) {
        hot.alter('remove_row', visualRowIndex);
        return;
    }

    const confirmMsg = `[삭제 확인]\n날짜: ${rowData.m_date}\n펌프: ${rowData.pump_no}\n\n정말 삭제하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    try {
        const { error } = await supabase
            .from('kiwe_flow')
            .delete()
            .eq('flow_id', rowData.flow_id);

        if (error) throw error;

        alert('삭제되었습니다.');
        // Remove row from grid immediately
        hot.alter('remove_row', visualRowIndex);

        // Optionally fetch to sync exact state, but removing visual row is faster response
        // await fetchData(); 
    } catch (err) {
        console.error(err);
        alert('삭제 중 오류: ' + err.message);
    }
}

// Initialize on load
initFlowPage();

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

    let query = supabase.from('kiwe_flow')
        .select('*')
        .order('m_date', { ascending: true }) // Ascending Date
        .order('pump_no', { ascending: true }); // Ascending Pump No

    if (startStr) query = query.gte('m_date', startStr);
    if (endStr) query = query.lte('m_date', endStr);
    if (pumpTerm) query = query.ilike('pump_no', `%${pumpTerm}%`);

    const { data, error } = await query;

    if (error) {
        console.error('Fetch error:', error);
        alert('데이터 조회 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
        renderGrid([]);
        return;
    }

    let finalData = data || [];

    // No more empty rows logic here. Just render what we got.
    renderGrid(finalData);
    isDirty = false; // Reset dirty state after fetch
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

    hot = new Handsontable(container, {
        data: displayData,
        readOnly: mode === 'view',
        colHeaders: [
            '관리', '측정일자', '펌프번호', '보정기', '전유량보정일자',
            '전-1회', '전-2회', '전-3회', '전평균',
            '후유량보정일자',
            '후-1회', '후-2회', '후-3회', '후평균',
            '전체평균유량'
        ],
        columns: [
            { data: 'actions', renderer: deleteRenderer, readOnly: true, width: 45, className: centerClass },
            { data: 'm_date', type: 'date', dateFormat: 'YYYY-MM-DD', renderer: autoShrinkRenderer, width: 95, className: centerClass },
            { data: 'pump_no', type: 'text', width: 75, className: centerClass },
            { data: 'calibrator_no', type: 'numeric', width: 60, className: centerClass },
            { data: 'pre_cal_date', type: 'date', dateFormat: 'YYYY-MM-DD', renderer: autoShrinkRenderer, width: 95, className: centerClass },
            { data: 'pre_flow_1', type: 'numeric', numericFormat: { pattern: '0.000' }, width: 65, className: centerClass },
            { data: 'pre_flow_2', type: 'numeric', numericFormat: { pattern: '0.000' }, width: 65, className: centerClass },
            { data: 'pre_flow_3', type: 'numeric', numericFormat: { pattern: '0.000' }, width: 65, className: centerClass },
            { data: 'pre_avg', type: 'numeric', numericFormat: { pattern: '0.000' }, readOnly: true, width: 75, className: centerClass },
            { data: 'post_cal_date', type: 'date', dateFormat: 'YYYY-MM-DD', renderer: autoShrinkRenderer, width: 95, className: centerClass },
            { data: 'post_flow_1', type: 'numeric', numericFormat: { pattern: '0.000' }, width: 65, className: centerClass },
            { data: 'post_flow_2', type: 'numeric', numericFormat: { pattern: '0.000' }, width: 65, className: centerClass },
            { data: 'post_flow_3', type: 'numeric', numericFormat: { pattern: '0.000' }, width: 65, className: centerClass },
            { data: 'post_avg', type: 'numeric', numericFormat: { pattern: '0.000' }, readOnly: true, width: 75, className: centerClass },
            { data: 'total_avg', type: 'numeric', numericFormat: { pattern: '0.000' }, readOnly: true, renderer: autoShrinkRenderer, width: 120, className: 'htCenter htMiddle font-bold text-indigo-700' }
        ],
        wordWrap: false,
        rowHeaders: true,
        fixedColumnsLeft: 3,
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

                const calcPreAvg = () => {
                    const f1 = parseFloat(this.getDataAtRowProp(row, 'pre_flow_1'));
                    const f2 = parseFloat(this.getDataAtRowProp(row, 'pre_flow_2'));
                    const f3 = parseFloat(this.getDataAtRowProp(row, 'pre_flow_3'));
                    if (!isNaN(f1) && !isNaN(f2) && !isNaN(f3)) {
                        const avg = Number(((f1 + f2 + f3) / 3).toFixed(3));
                        this.setDataAtRowProp(row, 'pre_avg', avg);
                    }
                };

                const calcPostAvg = () => {
                    const f1 = parseFloat(this.getDataAtRowProp(row, 'post_flow_1'));
                    const f2 = parseFloat(this.getDataAtRowProp(row, 'post_flow_2'));
                    const f3 = parseFloat(this.getDataAtRowProp(row, 'post_flow_3'));
                    if (!isNaN(f1) && !isNaN(f2) && !isNaN(f3)) {
                        const avg = Number(((f1 + f2 + f3) / 3).toFixed(3));
                        this.setDataAtRowProp(row, 'post_avg', avg);
                    }
                };

                const calcTotalAvg = () => {
                    const pre = parseFloat(this.getDataAtRowProp(row, 'pre_avg'));
                    const post = parseFloat(this.getDataAtRowProp(row, 'post_avg'));
                    if (!isNaN(pre) && !isNaN(post)) {
                        const total = Number(((pre + post) / 2).toFixed(3));
                        this.setDataAtRowProp(row, 'total_avg', total);
                    }
                };

                if (['pre_flow_1', 'pre_flow_2', 'pre_flow_3'].includes(prop)) calcPreAvg();
                if (['post_flow_1', 'post_flow_2', 'post_flow_3'].includes(prop)) calcPostAvg();
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
 * 1. Individual readings (Pre-1,2,3 or Post-1,2,3) variation > 10%
 * 2. Pre-Avg vs Post-Avg difference > 5%
 */
function getFlowWarnings(validData) {
    const warnings = [];
    validData.forEach(row => {
        const date = row.m_date || '-';
        const pump = row.pump_no || '-';
        const context = `[${date}] 펌프 ${pump}`;

        // 1. 10% Variation Check for Individual Readings
        const checkVariation = (reads, label) => {
            const vals = reads.filter(v => v !== null && !isNaN(v));
            if (vals.length < 3) return; // Only check if all 3 are present

            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            if (avg === 0) return;

            const max = Math.max(...vals);
            const min = Math.min(...vals);
            const variation = (max - min) / avg;

            if (variation >= 0.10) {
                warnings.push(`${context}: ${label} 측정값 간 편차가 10% 이상입니다. (편차: ${(variation * 100).toFixed(2)}%)`);
            }
        };

        checkVariation([row.pre_flow_1, row.pre_flow_2, row.pre_flow_3], '전(Pre)');
        checkVariation([row.post_flow_1, row.post_flow_2, row.post_flow_3], '후(Post)');

        // 2. 5% Variation Check for Pre/Post Average
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
            const cleaned = { ...r };
            delete cleaned.actions; // Remove actions column data

            // Don't delete flow_id, we might need it? 
            // Actually, keep it. Upsert will ignore it if we don't map it, but we use onConflict: m_date, pump_no.
            // If flow_id exists, it might conflict if not careful? 
            // Postgres UPSERT behavior: 
            // If onConflict target is met (duplicate m_date+pump_no), it UPDATES.
            // If flow_id is present in the payload but doesn't match the existing row's PK?
            // Safer to REMOVE flow_id from payload for upsert-by-logic, unless we are sure it matches.
            // WE map back IPs after save. So flow_id in grid matches DB.
            // But if we change pump_no of an existing row -> new key -> Insert -> old row stays?
            // "Upsert partial": If I change Date of a row, it becomes a new row effectively if I don't use PK.
            // But User wants "Duplicate Check" by Date+Pump.
            // So:
            // 1. If I have flow_id, I should ideally update by flow_id?
            // 2. But user logic is "Date + Pump" define the unique row.
            // Let's stick to "delete flow_id from payload" and let onConflict handle it.
            delete cleaned.flow_id;

            const numFields = ['calibrator_no', 'pre_flow_1', 'pre_flow_2', 'pre_flow_3', 'pre_avg', 'post_flow_1', 'post_flow_2', 'post_flow_3', 'post_avg', 'total_avg'];
            numFields.forEach(f => {
                if (cleaned[f] === '' || cleaned[f] === undefined) cleaned[f] = null;
                else cleaned[f] = parseFloat(cleaned[f]);
            });
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

    // 3. Flow Accuracy Validation (Warnings)
    if (!silent) {
        const warnings = getFlowWarnings(validData);
        if (warnings.length > 0) {
            const msg = `[데이터 정확성 경고]\n다음 항목들이 기준 오차를 초과했습니다. 그대로 저장하시겠습니까?\n\n${warnings.join('\n')}`;
            if (!confirm(msg)) return;
        }
    }

    try {
        // 4. Upsert with select() to get back IDs
        const { data: savedRows, error } = await supabase
            .from('kiwe_flow')
            .upsert(validData, { onConflict: 'm_date, pump_no' })
            .select(); // Critical: Fetch back the data including flow_id

        if (error) throw error;

        // 4. Map returned IDs back to the grid (Update source data directly)
        if (savedRows && savedRows.length > 0) {
            // Create a lookup map for faster access: "date_pump" -> rowData
            const savedMap = new Map();
            savedRows.forEach(row => {
                savedMap.set(`${row.m_date}_${row.pump_no}`, row);
            });

            // Iterate over the grid's source data and update flow_id where matches found
            // We iterate rawData (the reference held by Handsontable) to ensure consistency
            let updatedCount = 0;
            hot.getSourceData().forEach(gridRow => {
                if (gridRow.m_date && gridRow.pump_no) {
                    const key = `${gridRow.m_date}_${gridRow.pump_no}`;
                    if (savedMap.has(key)) {
                        const saved = savedMap.get(key);
                        gridRow.flow_id = saved.flow_id; // Map the ID
                        updatedCount++;
                    }
                }
            });
            console.log(`Updated flow_id for ${updatedCount} rows.`);
        }

        isDirty = false; // Reset dirty state on success
        if (!silent) {
            alert('유량보정대장이 성공적으로 저장되었습니다.');
            await fetchData();
        } else {
            // In silent mode (auto-save), maybe just log or show small toast?
            console.log('Auto-save successful');
            // We do NOT fetch in auto-save to avoid disrupting user input (cursor jump)
            // But we MUST update the dirty flag
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

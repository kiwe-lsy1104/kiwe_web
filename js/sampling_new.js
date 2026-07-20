// js/sampling_new.js — 하반기 통합 시료채취기록대장
// 기반: sampling.js + 유량보정 통합 컬럼 + 공시료 2건 누락방지 팝업
import React, { useState, useEffect, useMemo, useRef } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
import {
    Database, FlaskConical, Settings, BarChart3, Search,
    Plus, X, Save, Edit, Trash2, ChevronRight,
    LayoutGrid, List, Filter, Download, Info, CheckCircle2,
    Clock, Thermometer, Droplets, User, Building2, Calendar, Home, RotateCcw, HelpCircle,
    AlertTriangle, Droplet
} from 'https://esm.sh/lucide-react@0.263.1';
import { supabase, checkAuth } from './config.js';
import { setupHazardSelection, openHazardSearch } from './sample_popup_logic.js';
import HazardManagement from './hazard_management.js';
import { NoiseRecord } from './noise_record.js';

const e = React.createElement;

// ★ 하반기 전용 고정 테이블
const FIXED_TABLE = 'kiwe_sampling_2026_2';

const STORAGE_KEY_MAIN = 'KIWE_SAMPLING_NEW_GRID_CONFIG_V1';
const DB_SETTINGS_KEY = 'sampling_new_column_config';

// ── 컬럼 정의 (유량보정 컬럼 포함)
const ALL_GRID_COLUMNS = [
    { key: 'input_seq',    label: '순번' },
    { key: 'm_date',       label: '측정일자' },
    { key: 'com_name',     label: '사업장명' },
    { key: 'work_process', label: '작업공정' },
    { key: 'worker_name',  label: '근로자명' },
    { key: 'common_name',  label: '유해인자(검색)' },
    { key: 'hazard_category', label: '카테고리' },
    { key: 'pump_no',      label: '펌프번호' },
    { key: 'start_time',   label: '시작시간' },
    { key: 'end_time',     label: '종료시간' },
    { key: 'shift_type',   label: '교대형태' },
    { key: 'work_hour',    label: '실근로시간(h)' },
    { key: 'lunch_time',   label: '점심시간(분)' },
    { key: 'measured_min', label: '측정시간(분/계산)' },
    { key: 'occurrence_type', label: '발생형태' },
    { key: 'temp',         label: '온도' },
    { key: 'humidity',     label: '습도' },
    { key: 'condition',    label: '시료상태' },
    { key: 'analyst',      label: '분석자' },
    { key: 'measured_by',  label: '측정자' },
    { key: 'received_by',  label: '인수자/접수자' },
    { key: 'received_date', label: '인수일' },
    // ★ 유량보정 컬럼 (측정전/후 평균 각 1회)
    { key: 'pre_flow_avg',  label: '측정전평균유량' },
    { key: 'post_flow_avg', label: '측정후평균유량' },
];

const DEFAULT_COLS = [
    'input_seq', 'm_date', 'com_name', 'work_process', 'worker_name', 'common_name',
    'pump_no', 'start_time', 'end_time', 'measured_min', 'shift_type',
    'work_hour', 'lunch_time', 'occurrence_type', 'temp', 'humidity',
    'condition', 'analyst', 'measured_by', 'received_by', 'received_date',
    'pre_flow_avg', 'post_flow_avg'
];

// ──────────────────────────────────────────────────────────────────
// 그리드 초기화 함수 (sampling_list.js를 인라인으로 확장하여 유량 컬럼 추가)
// ──────────────────────────────────────────────────────────────────
function initSampleGridNew(container, mDate, comName, onHazardDoubleClick, onDeleteRow, dynamicColumns = [], height = 'calc(100vh - 350px)', onColumnMove, onColumnResize) {
    if (!container) return null;

    const deleteRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        while (td.firstChild) td.removeChild(td.firstChild);
        const btn = document.createElement('button');
        btn.className = 'bg-red-50 text-red-600 hover:bg-red-100 p-1 rounded transition-colors';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
        btn.onclick = (ev) => { ev.preventDefault(); onDeleteRow(row); };
        const div = document.createElement('div');
        div.className = 'flex items-center justify-center h-full w-full';
        div.appendChild(btn);
        td.appendChild(div);
        return td;
    };

    const autoShrinkRenderer = function (instance, td, row, col, prop, value, cellProperties) {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        td.style.whiteSpace = 'nowrap';
        td.style.overflow = 'hidden';
        td.style.textOverflow = 'clip';
        td.style.fontSize = '12px';

        if (prop === 'common_name' && value) {
            const validHazards = cellProperties.validHazards || [];
            if (validHazards.length > 0) {
                const parts = String(value).split('/').map(s => s.trim()).filter(Boolean);
                const mediaSet = new Set();
                const missing = [];
                parts.forEach(p => {
                    const base = p.split(/[/(]/)[0].trim();
                    const match = validHazards.find(h => h.common_name === p || h.common_name === base);
                    if (match) { if (match.sampling_media) mediaSet.add(match.sampling_media); }
                    else { missing.push(p); }
                });
                if (missing.length > 0) {
                    td.style.color = '#e11d48';
                    td.style.backgroundColor = '#fff1f2';
                    td.title = `등록되지 않은 인자 포함: ${missing.join(', ')}`;
                } else if (mediaSet.size > 1) {
                    td.style.color = '#d97706';
                    td.style.backgroundColor = '#fffbeb';
                    td.title = `채취매체 불일치: ${Array.from(mediaSet).join(' vs ')}`;
                } else {
                    td.style.color = '';
                    td.style.backgroundColor = '';
                    td.title = '';
                }
            }
        }

        const text = value ? String(value) : '';
        const colWidth = instance.getColWidth(col) || 100;
        const charCount = text.length;
        if (charCount > 0) {
            const estimatedWidth = charCount * 7;
            if (estimatedWidth > colWidth - 10) {
                const ratio = (colWidth - 10) / estimatedWidth;
                const newSize = Math.max(8, Math.floor(12 * ratio));
                td.style.fontSize = newSize + 'px';
            }
        }
        return td;
    };

    // 유량 컬럼 전용 렌더러 (녹색 계열 강조)
    const flowRenderer = function (instance, td, row, col, prop, value, cellProperties) {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        td.style.backgroundColor = '#f0fdf4';
        td.style.color = '#15803d';
        td.style.fontWeight = '700';
        td.style.textAlign = 'center';
        return td;
    };

    const statusRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        while (td.firstChild) td.removeChild(td.firstChild);
        const div = document.createElement('div');
        div.className = 'flex items-center justify-center gap-1 h-full w-full';
        if (value === '완료') {
            const badge = document.createElement('span');
            badge.className = 'px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200';
            badge.innerText = '완료';
            div.appendChild(badge);
        } else {
            const btn = document.createElement('button');
            btn.className = 'px-1.5 py-0.5 bg-purple-50 text-purple-600 hover:bg-purple-100 text-[10px] font-bold rounded border border-purple-200 transition-colors active:scale-95';
            btn.innerText = '완료처리';
            btn.onclick = (ev) => {
                ev.preventDefault();
                instance.setDataAtRowProp(row, 'status', '완료');
                instance.setDataAtRowProp(row, 'completed_at', new Date().toISOString().split('T')[0]);
            };
            div.appendChild(btn);
        }
        td.appendChild(div);
        return td;
    };

    const measuredTimeRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        const startTime = instance.getDataAtRowProp(row, 'start_time');
        const endTime = instance.getDataAtRowProp(row, 'end_time');
        if (startTime && endTime) {
            const [sH, sM] = startTime.split(':').map(Number);
            const [eH, eM] = endTime.split(':').map(Number);
            if (!isNaN(sH) && !isNaN(sM) && !isNaN(eH) && !isNaN(eM)) {
                let startTotal = sH * 60 + sM;
                let endTotal = eH * 60 + eM;
                if (endTotal < startTotal) endTotal += 24 * 60;
                const diff = endTotal - startTotal;
                const lunchTime = parseInt(instance.getDataAtRowProp(row, 'lunch_time')) || 0;
                td.innerText = Math.max(0, diff - lunchTime);
                td.style.fontWeight = 'bold';
                td.style.color = '#7c3aed';
            } else { td.innerText = '-'; }
        } else { td.innerText = '-'; }
        td.className = 'htCenter htMiddle';
        return td;
    };

    const rowNumberRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, row + 1, cellProperties]);
        td.style.backgroundColor = '#f8fafc';
        td.style.fontWeight = '700';
        td.style.color = '#475569';
        td.style.textAlign = 'center';
        td.style.verticalAlign = 'middle';
    };

    // 컬럼 정의 맵
    const columnDefinitions = {
        'm_date':          { data: 'm_date', label: '측정일자', type: 'date', dateFormat: 'YYYY-MM-DD', width: 90, className: 'htCenter htMiddle' },
        'com_name':        { data: 'com_name', label: '사업장명', renderer: autoShrinkRenderer, width: 130, className: 'htCenter htMiddle font-bold' },
        'work_process':    { data: 'work_process', label: '작업공정', renderer: autoShrinkRenderer, width: 100, className: 'htCenter htMiddle' },
        'worker_name':     { data: 'worker_name', label: '근로자명', width: 80, className: 'htCenter htMiddle' },
        'common_name':     { data: 'common_name', label: '유해인자(검색)', renderer: autoShrinkRenderer, width: 160, className: 'htCenter htMiddle font-bold' },
        'hazard_category': { data: 'hazard_category', label: '카테고리', width: 1, className: 'hidden' },
        'pump_no':         { data: 'pump_no', label: '펌프번호', width: 65, className: 'htCenter htMiddle font-bold' },
        'start_time':      { data: 'start_time', label: '시작시간', width: 60, className: 'htCenter htMiddle' },
        'end_time':        { data: 'end_time', label: '종료시간', width: 60, className: 'htCenter htMiddle' },
        'shift_type':      { data: 'shift_type', label: '교대형태', type: 'autocomplete', source: ['1교대', '2조2교대', '4조3교대', '직접입력'], strict: false, width: 90, className: 'htCenter htMiddle' },
        'work_hour':       { data: 'work_hour', label: '실근로시간(h)', type: 'numeric', width: 65, className: 'htCenter htMiddle' },
        'lunch_time':      { data: 'lunch_time', label: '점심시간(분)', type: 'numeric', width: 75, className: 'htCenter htMiddle' },
        'measured_min':    { data: 'measured_min', label: '측정시간(분/계산)', renderer: measuredTimeRenderer, readOnly: true, width: 110, className: 'htCenter htMiddle' },
        'occurrence_type': { data: 'occurrence_type', label: '발생형태', type: 'dropdown', source: ['연속적', '불규칙'], width: 80, className: 'htCenter htMiddle' },
        'temp':            { data: 'temp', label: '온도', width: 50, className: 'htCenter htMiddle' },
        'humidity':        { data: 'humidity', label: '습도', width: 50, className: 'htCenter htMiddle' },
        'condition':       { data: 'condition', label: '시료상태', type: 'dropdown', source: ['양호', '파과', '기타'], width: 70, className: 'htCenter htMiddle' },
        'analyst':         { data: 'analyst', label: '분석자', width: 80, className: 'htCenter htMiddle' },
        'measured_by':     { data: 'measured_by', label: '측정자', width: 80, className: 'htCenter htMiddle' },
        'received_by':     { data: 'received_by', label: '인수자/접수자', width: 90, className: 'htCenter htMiddle' },
        'received_date':   { data: 'received_date', label: '인수일', type: 'date', dateFormat: 'YYYY-MM-DD', width: 90, className: 'htCenter htMiddle' },
        'status':          { data: 'status', label: '완료상태', renderer: statusRenderer, width: 80, className: 'htCenter htMiddle' },
        'completed_at':    { data: 'completed_at', label: '완료날짜', type: 'date', dateFormat: 'YYYY-MM-DD', width: 90, className: 'htCenter htMiddle' },
        // ★ 유량보정 컬럼 — 측정전/후 평균유량 각 1회 입력
        'pre_flow_avg':    { data: 'pre_flow_avg',  label: '측정전\n평균유량', renderer: flowRenderer, type: 'numeric', numericFormat: { pattern: '0.000' }, width: 80, className: 'htCenter htMiddle' },
        'post_flow_avg':   { data: 'post_flow_avg', label: '측정후\n평균유량', renderer: flowRenderer, type: 'numeric', numericFormat: { pattern: '0.000' }, width: 80, className: 'htCenter htMiddle' },

    };

    const baseCols = [
        { data: 'actions',   label: '관리', renderer: deleteRenderer, readOnly: true, width: 50, className: 'htCenter htMiddle' },
        { data: 'id',        label: 'ID', readOnly: true, width: 1, className: 'hidden' },
        { data: 'input_seq', label: '순번', readOnly: false, width: 50, className: 'htCenter htMiddle' },
        { data: 'sample_id', label: '시료번호', readOnly: false, width: 110, className: 'htCenter htMiddle font-bold' },
    ];

    const activeColsRaw = dynamicColumns.length > 0 ? dynamicColumns : DEFAULT_COLS;
    const finalCols = [
        { data: null, label: 'No', width: 40, readOnly: true, renderer: rowNumberRenderer, className: 'htCenter htMiddle' },
        ...baseCols
    ];
    activeColsRaw.forEach(key => {
        if (columnDefinitions[key]) finalCols.push(columnDefinitions[key]);
    });

    const hot = new Handsontable(container, {
        data: [],
        colHeaders: finalCols.map(c => c.label),
        columns: finalCols,
        hiddenColumns: {
            columns: finalCols.map((c, i) => (c.className && c.className.includes('hidden')) ? i : -1).filter(i => i !== -1),
            indicators: false,
            copyPasteEnabled: false
        },
        imeFastEdit: true,
        wordWrap: false,
        rowHeaders: false,
        rowHeights: 24,
        stretchH: 'none',
        height: height,
        fixedColumnsStart: 0,
        renderAllRows: false,
        className: 'htMiddle',
        cells: (row) => {
            return { className: row % 2 === 0 ? 'htCenter htMiddle' : 'htCenter htMiddle hot-row-odd' };
        },
        manualColumnMove: true,
        manualColumnResize: true,
        afterColumnMove: (movedColumns, target) => { if (onColumnMove) onColumnMove(movedColumns, target); },
        afterColumnResize: (newSize, column, isDoubleClick) => { if (onColumnResize) onColumnResize(column, newSize); },
        autoWrapRow: true,
        autoWrapCol: true,
        manualRowResize: true,
        autoColumnSize: false,
        autoRowSize: false,
        filters: true,
        columnSorting: true,
        viewportColumnRenderingOffset: 20,
        viewportRowRenderingOffset: 20,
        dropdownMenu: {
            items: {
                'filter_by_condition': { name: '조건별 필터' },
                'filter_operators': { name: '필터 방식' },
                'filter_by_value': { name: '값으로 필터' },
                'filter_action_bar': { name: '필터 메뉴' },
                'sep1': '---------',
                'sort_asc': { name: '오름차순 정렬' },
                'sort_desc': { name: '내림차순 정렬' }
            }
        },
        contextMenu: {
            items: {
                'row_above': { name: '위에 행 삽입' },
                'row_below': { name: '아래에 행 삽입' },
                'hsep1': '---------',
                'remove_row': { name: '선택한 행 삭제' },
                'hsep2': '---------',
                'copy': { name: '복사' },
                'cut': { name: '잘라내기' },
                'alignment': { name: '정렬' },
                'undo': { name: '실행 취소' },
                'redo': { name: '다시 실행' }
            }
        },
        licenseKey: 'non-commercial-and-evaluation',
        beforeCopy: (data) => {
            for (let r = 0; r < data.length; r++) {
                for (let c = 0; c < data[r].length; c++) {
                    const val = data[r][c];
                    if (typeof val === 'string' && /^(\d+[~\-]\d+|\d{1,2}:\d{2})$/.test(val)) {
                        data[r][c] = val + ' ';
                    }
                }
            }
        },
        beforeChange: (changes, source) => {
            if (source === 'loadData') return;
            for (let i = 0; i < changes.length; i++) {
                let newVal = changes[i][3];
                if (typeof newVal === 'string') {
                    newVal = newVal.replace(/^\?*/, '').trim();
                    changes[i][3] = newVal;
                }
            }
        },
        beforePaste: (data) => {
            for (let r = 0; r < data.length; r++) {
                for (let c = 0; c < data[r].length; c++) {
                    if (typeof data[r][c] === 'string') {
                        data[r][c] = data[r][c].replace(/^\?*/, '').trim();
                    }
                }
            }
        },
        afterOnCellMouseDown: (ev, coords) => {
            const commonNameIdx = finalCols.findIndex(c => c.data === 'common_name');
            if (ev.detail === 2 && coords.col === commonNameIdx) {
                onHazardDoubleClick(coords.row);
            }
        }
    });

    window.addEventListener('resize', () => {
        if (hot && !hot.isDestroyed) hot.render();
    });

    return hot;
}

// ──────────────────────────────────────────────────────────────────
// 그리드 데이터 로드 (FIXED_TABLE만 사용)
// ──────────────────────────────────────────────────────────────────
async function loadGridDataNew(hot, supabase, startDate, endDate, comName, user, sortType = 'input', idFilter = 'all') {
    if (!hot || !supabase) return;
    try {
        const formatTimeHHMM = (val) => {
            if (!val) return '';
            let digits = String(val).replace(/\D/g, '');
            if (digits.length === 3) digits = '0' + digits;
            if (digits.length === 4) return digits.substring(0, 2) + ':' + digits.substring(2, 4);
            if (typeof val === 'string' && val.includes(':')) {
                const parts = val.split(':');
                if (parts.length >= 2) return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
            }
            return val;
        };

        const fetchAllRows = async (start, end) => {
            let results = [];
            let from = 0;
            const limit = 1000;
            let hasMore = true;
            while (hasMore) {
                let q = supabase
                    .from(FIXED_TABLE)
                    .select('*')
                    .order('id', { ascending: true })
                    .range(from, from + limit - 1);
                if (start) q = q.gte('m_date', start);
                if (end)   q = q.lte('m_date', end);
                const { data, error } = await q;
                if (error) throw error;
                if (data && data.length > 0) {
                    results = results.concat(data);
                    if (data.length < limit) hasMore = false;
                    else from += limit;
                } else { hasMore = false; }
            }
            return results;
        };

        let allData = [];
        try {
            allData = await fetchAllRows(startDate, endDate);
        } catch (err) {
            console.warn(`테이블 ${FIXED_TABLE} 조회 오류:`, err);
        }

        if (comName && comName.trim() !== '') {
            const query = comName.trim().toLowerCase();
            allData = allData.filter(item => {
                const com = (item.com_name || '').toLowerCase();
                const worker = (item.worker_name || '').toLowerCase();
                const hazard = (item.common_name || '').toLowerCase();
                const process = (item.work_process || '').toLowerCase();
                return com.includes(query) || worker.includes(query) || hazard.includes(query) || process.includes(query);
            });
        }

        const isBlankSample = (item) => !!(item.worker_name && item.worker_name.includes('공시료'));
        const getSeqNum = (id) => {
            if (!id) return 999999;
            const parts = id.split('-');
            if (parts.length < 2) return 999999;
            const seq = parseInt(parts[parts.length - 1], 10);
            return isNaN(seq) ? 999999 : seq;
        };

        if (sortType === 'sample_id') {
            allData.sort((a, b) => {
                if (a.m_date !== b.m_date) return a.m_date > b.m_date ? 1 : -1;
                const comA = a.com_name || '', comB = b.com_name || '';
                if (comA !== comB) return comA.localeCompare(comB);
                const sidA = a.sample_id || '', sidB = b.sample_id || '';
                if (sidA !== sidB) return sidA.localeCompare(sidB, undefined, { numeric: true, sensitivity: 'base' });
                const seqA = a.input_seq ?? a.id ?? 9999999, seqB = b.input_seq ?? b.id ?? 9999999;
                return seqA - seqB;
            });
        } else {
            allData.sort((a, b) => {
                if (a.m_date !== b.m_date) return a.m_date > b.m_date ? 1 : -1;
                const seqA = a.input_seq ?? a.id ?? 9999999, seqB = b.input_seq ?? b.id ?? 9999999;
                if (seqA !== seqB) return seqA - seqB;
                return (a.id || 0) - (b.id || 0);
            });
        }

        const allCommonNames = allData.map(d => d.common_name).filter(Boolean);
        const searchNames = Array.from(new Set(allCommonNames.map(name => name.split('/')[0].trim())));
        let hazardsMap = {};
        if (searchNames.length > 0) {
            const { data: hazards } = await supabase
                .from('kiwe_hazard')
                .select('common_name, hazard_category, instrument_name, sampling_media, sampling, storage, is_self')
                .in('common_name', searchNames);
            if (hazards) hazards.forEach(h => { hazardsMap[h.common_name] = h; });
        }

        let newData = allData.map(d => {
            const searchKey = d.common_name ? d.common_name.split('/')[0].trim() : '';
            const hazardInfo = hazardsMap[searchKey] || {};
            const isBlank = d.worker_name && d.worker_name.includes('공시료');
            return {
                ...hazardInfo,
                ...d,
                start_time: formatTimeHHMM(d.start_time),
                end_time: formatTimeHHMM(d.end_time),
                condition: d.condition || d.sample_state || '양호',
                work_hour:  isBlank ? (d.work_hour || null)  : (d.work_hour  == null || d.work_hour  === '' ? null : parseFloat(d.work_hour)),
                lunch_time: isBlank ? (d.lunch_time || null) : (d.lunch_time == null || d.lunch_time === '' ? null : parseFloat(d.lunch_time)),
            };
        });

        if (idFilter === 's') {
            newData = newData.filter(d => { const p = (d.sample_id || '').match(/^[A-Z]+/)?.[0] || ''; return p === 'S'; });
        } else if (idFilter === 'd') {
            newData = newData.filter(d => { const p = (d.sample_id || '').match(/^[A-Z]+/)?.[0] || ''; return p === 'D'; });
        } else if (idFilter === 'sb') {
            newData = newData.filter(d => { const p = (d.sample_id || '').match(/^[A-Z]+/)?.[0] || ''; return p === 'SB'; });
        } else if (idFilter === 'db') {
            newData = newData.filter(d => { const p = (d.sample_id || '').match(/^[A-Z]+/)?.[0] || ''; return p === 'DB'; });
        }

        hot.loadData(newData);
    } catch (err) {
        console.error('Grid data load error (new):', err);
    }
}

// ──────────────────────────────────────────────────────────────────
// 공시료 경고 모달 제어 (바닐라 DOM — React 외부)
// ──────────────────────────────────────────────────────────────────
function showBlankWarningModal({ missingList, comName, onAddBlanks, onIgnore, onCancel }) {
    const modal = document.getElementById('blank-warning-modal');
    const subtitle = document.getElementById('blank-modal-subtitle');
    const body = document.getElementById('blank-modal-body');
    const addBtn = document.getElementById('blank-modal-add-btn');
    const ignoreBtn = document.getElementById('blank-modal-ignore-btn');
    const cancelBtn = document.getElementById('blank-modal-cancel-btn');

    subtitle.textContent = `현재 공시료 부족 — ${comName || '해당 사업장'}`;
    body.innerHTML = missingList.map(item => `<div>⚠ ${item}</div>`).join('');

    modal.style.display = 'flex';

    const cleanup = () => {
        modal.style.display = 'none';
        addBtn.onclick = null;
        ignoreBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    addBtn.onclick = () => { cleanup(); onAddBlanks(); };
    ignoreBtn.onclick = () => { cleanup(); onIgnore(); };
    cancelBtn.onclick = () => { cleanup(); onCancel(); };
}

// ──────────────────────────────────────────────────────────────────
// 메인 App 컴포넌트
// ──────────────────────────────────────────────────────────────────
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
    const [settingsSaveStatus, setSettingsSaveStatus] = useState('');
    const [allHazards, setAllHazards] = useState([]);
    const [sortType, setSortType] = useState('input');
    const [idFilter, setIdFilter] = useState('all');

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

    const [columnConfig, setColumnConfig] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_MAIN);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return { 1: [...parsed], 2: [...parsed], 3: [...parsed] };
                if (parsed && typeof parsed === 'object') {
                    return {
                        1: Array.isArray(parsed[1]) ? [...parsed[1]] : [...DEFAULT_COLS],
                        2: Array.isArray(parsed[2]) ? [...parsed[2]] : [...DEFAULT_COLS],
                        3: Array.isArray(parsed[3]) ? [...parsed[3]] : [...DEFAULT_COLS],
                    };
                }
            } catch (e) { console.warn("컬럼 설정 파싱 오류"); }
        }
        return { 1: [...DEFAULT_COLS], 2: [...DEFAULT_COLS], 3: [...DEFAULT_COLS] };
    });

    const fetchColumnConfigFromDB = async () => {
        try {
            const { data, error } = await supabase.from('kiwe_app_settings').select('value').eq('key', DB_SETTINGS_KEY).single();
            if (error || !data) return;
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
        } catch (err) { console.warn('컬럼 설정 DB 로드 실패:', err); }
    };

    const saveColumnConfigToDB = async (config) => {
        setSettingsSaveStatus('saving');
        try {
            const { error } = await supabase.from('kiwe_app_settings')
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

    const columnConfigRef = useRef(columnConfig);
    useEffect(() => { columnConfigRef.current = columnConfig; }, [columnConfig]);
    const currentCols = columnConfig[activeTab] || DEFAULT_COLS;

    const handleColumnMove = (movedColumns, target) => {
        setColumnConfig(prev => {
            const nextConfig = { ...prev };
            const hot = hotInstance.current;
            if (!hot) return prev;
            const newOrder = [];
            const count = hot.countCols();
            for (let i = 0; i < count; i++) {
                const prop = hot.colToProp(i);
                if (typeof prop === 'string' && prop !== 'actions' && prop !== 'id') newOrder.push(prop);
            }
            const currentActiveCols = new Set(prev[activeTab] || DEFAULT_COLS);
            const filtered = newOrder.filter(k => currentActiveCols.has(k));
            nextConfig[activeTab] = filtered.length > 0 ? filtered : (prev[activeTab] || DEFAULT_COLS);
            return nextConfig;
        });
    };

    useEffect(() => { localStorage.setItem(STORAGE_KEY_MAIN, JSON.stringify(columnConfig)); }, [columnConfig]);

    useEffect(() => {
        if (showSettings && sortableRef.current) {
            const sortable = new Sortable(sortableRef.current, {
                animation: 150,
                ghostClass: 'bg-purple-50',
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

    useEffect(() => {
        const handleBeforeUnload = (ev) => {
            if (isDirtyRef.current) { ev.preventDefault(); ev.returnValue = ''; }
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

    useEffect(() => {
        const session = checkAuth();
        if (session) setUser(session);
        fetchCompanies();
        fetchReceiverDefault();
        fetchHazards();
        fetchColumnConfigFromDB();

        const cleanupPopup = setupHazardSelection(gridRowRef, hotInstance, async () => null, getSamplePrefix);
        return () => {
            if (hotInstance.current) {
                try { hotInstance.current.destroy(); } catch (e) {}
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
            let query = supabase.from(FIXED_TABLE).delete();
            if (sourceData.id) query = query.eq('id', sourceData.id);
            else query = query.eq('sample_id', sourceData.sample_id);
            const { error } = await query;
            if (error) { alert('삭제 실패: ' + error.message); return; }
        }
        hot.alter('remove_row', row);
    };

    const loadSmartData = () => {
        if (!hotInstance.current) return;
        loadGridDataNew(hotInstance.current, supabase, startDate, endDate, comName, user, sortType, idFilter);
        isDirtyRef.current = false;
    };

    // 그리드 초기화
    useEffect(() => {
        if (activeTab === 1 && user && hotRef.current) {
            if (hotInstance.current) {
                try { hotInstance.current.destroy(); } catch (e) {}
                hotInstance.current = null;
            }
            hotInstance.current = initSampleGridNew(
                hotRef.current,
                startDateRef.current,
                comNameRef.current,
                (rowIdx) => openHazardSearch(rowIdx, setCurrentGridRow, gridRowRef),
                handleDeleteRow,
                columnConfigRef.current[activeTab] || DEFAULT_COLS,
                '100%',
                handleColumnMove,
                null
            );

            hotInstance.current.addHook('afterChange', async (changes, source) => {
                if (source === 'loadData' || source === 'observeChanges' || source === 'auto') return;
                isDirtyRef.current = true;
                if (!changes) return;
                const hot = hotInstance.current;
                const rowsToProcess = new Set();
                hot.batch(() => {
                    for (const [row, prop, oldVal, newVal] of changes) {
                        const visualRow = hot.toVisualRow(row);
                        if (visualRow === null) continue;
                        if (prop === 'm_date') hot.setDataAtRowProp(visualRow, 'received_date', newVal, 'auto');
                        if (['common_name', 'worker_name', 'instrument_name'].includes(prop)) rowsToProcess.add(row);
                    }
                });
                // if (rowsToProcess.size > 0) await applyBulkSampleIds(Array.from(rowsToProcess)); // 실시간 시료번호 자동 부여 비활성화 (저장 시 일괄 처리)
            });

            hotInstance.current.addHook('afterCreateRow', (index, amount) => {
                const hot = hotInstance.current;
                const currentUser = userRef.current;
                const currentMDate = startDateRef.current;
                const currentComName = comNameRef.current;
                const currentReceiver = receiverDefaultRef.current;

                // ★ 성능 최적화: hot.batch()로 단 1번만 렌더링
                hot.batch(() => {
                    for (let i = 0; i < amount; i++) {
                        const row = index + i;
                        if (currentUser) hot.setDataAtRowProp(row, 'measured_by', currentUser.user_name);
                        if (currentMDate) hot.setDataAtRowProp(row, 'm_date', currentMDate);
                        if (currentComName) {
                            const isRealCompany = companies.some(c => c.com_name === currentComName);
                            if (isRealCompany) hot.setDataAtRowProp(row, 'com_name', currentComName);
                        }
                        hot.setDataAtRowProp(row, 'condition', '양호');
                        hot.setDataAtRowProp(row, 'received_by', currentReceiver);
                        if (currentMDate) hot.setDataAtRowProp(row, 'received_date', currentMDate);
                    }
                });
            });

            loadSmartData();
            return () => {
                if (hotInstance.current) {
                    try { hotInstance.current.destroy(); } catch (e) {}
                    hotInstance.current = null;
                }
            };
        }
    }, [activeTab, user]);

    useEffect(() => {
        if (activeTab === 1 && hotInstance.current) loadSmartData();
    }, [startDate, endDate, comName, sortType, idFilter]);

    async function fetchCompanies() {
        const { data, error } = await supabase.from('kiwe_companies').select('com_name, com_id').order('com_name');
        if (!error) setCompanies(data);
    }

    async function fetchHazards() {
        try {
            const { data, error } = await supabase.from('kiwe_hazard').select('common_name, instrument_name, sampling_media, is_self');
            if (!error && data) {
                setAllHazards(data);
                if (hotInstance.current) {
                    hotInstance.current.updateSettings({
                        cells: (row, col) => {
                            const prop = hotInstance.current.colToProp(col);
                            if (prop === 'common_name') return { validHazards: data };
                        }
                    });
                }
            }
        } catch (e) { console.error("유해인자 로드 오류", e); }
    }

    async function fetchReceiverDefault() {
        try {
            const { data, error } = await supabase.from('kiwe_users').select('user_name').eq('job_title', '분석책임자').limit(1);
            if (!error && data && data.length > 0) setReceiverDefault(data[0].user_name);
        } catch (e) { console.error("인수자 기본값 오류", e); }
    }

    const addRows = (count) => {
        if (hotInstance.current) {
            hotInstance.current.alter('insert_row_below', hotInstance.current.countRows(), count);
        }
    };

    const getMaxSufixFromDB = async (prefixWithHalfYear, excludeIds = []) => {
        try {
            let query = supabase.from(FIXED_TABLE).select('sample_id')
                .not('com_name', 'is', null)
                .not('common_name', 'is', null)
                .like('sample_id', `${prefixWithHalfYear}%`)
                .order('sample_id', { ascending: false })
                .limit(1);
            const validExclude = excludeIds.filter(id => id && !String(id).startsWith('temp_'));
            if (validExclude.length > 0) query = query.not('id', 'in', `(${validExclude.join(',')})`);
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
        } catch (err) { console.error("Max suffix 조회 오류:", err); return 0; }
    };

    const applyBulkSampleIds = async (rowIndices, forceAll = false) => {
        const hot = hotInstance.current;
        if (!hot) return;
        try {
            const rowsByPrefix = {};
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
                if (isNaN(dateObj.getTime())) continue;
                const year = String(dateObj.getFullYear()).substring(2);
                const month = dateObj.getMonth() + 1;
                const halfYear = month <= 6 ? 1 : 2;
                const fullPrefix = `${prefixAlpha}${year}${halfYear}-`;
                if (rowData.sample_id && rowData.sample_id.startsWith(fullPrefix)) continue;
                if (!rowsByPrefix[fullPrefix]) rowsByPrefix[fullPrefix] = { rows: [] };
                rowsByPrefix[fullPrefix].rows.push(rowIdx);
            }

            for (const [fullPrefix, info] of Object.entries(rowsByPrefix)) {
                const dbMax = await getMaxSufixFromDB(fullPrefix, idsInGrid);
                const allData = hot.getSourceData();
                let gridMax = 0;
                allData.forEach(r => {
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
                    info.rows.sort((a, b) => {
                        const visA = hot.toVisualRow(a), visB = hot.toVisualRow(b);
                        if (visA === null) return 1;
                        if (visB === null) return -1;
                        return visA - visB;
                    }).forEach(rowIdx => {
                        currentSeq++;
                        const newId = `${fullPrefix}${String(currentSeq).padStart(4, '0')}`;
                        const visualRow = hot.toVisualRow(rowIdx);
                        if (visualRow !== null) hot.setDataAtRowProp(visualRow, 'sample_id', newId, 'auto');
                    });
                });
            }
        } catch (err) {
            console.error("Bulk Sample ID 오류:", err);
            alert("시료번호 생성 중 오류: " + err.message);
        }
    };

    const calculateSampleId = async (rowIdx) => {
        await applyBulkSampleIds([rowIdx]);
        const visualRow = hotInstance.current.toVisualRow(rowIdx);
        return visualRow !== null ? hotInstance.current.getDataAtRowProp(visualRow, 'sample_id') : null;
    };

    const getSamplePrefix = (instrumentName, workerName = '', commonName = '') => {
        const currentHazards = allHazardsRef.current;
        let inst = instrumentName;
        let isSelf = '자체분석';
        
        if (commonName && currentHazards.length > 0) {
            let h = currentHazards.find(x => x.common_name === commonName.trim());
            if (!h) {
                const baseName = commonName.split(/[/(]/)[0].trim();
                h = currentHazards.find(x => x.common_name === baseName);
            }
            if (h) {
                inst = h.instrument_name || inst || '';
                isSelf = h.is_self || '자체분석';
            }
        }
        
        const isExternal = isSelf === '외부의뢰';
        let prefix = isExternal ? 'R' : (inst && inst.trim() === '중량분석' ? 'D' : 'S');
        if (workerName && workerName.includes('공시료')) prefix += 'B';
        return prefix;
    };

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
            setColumnConfig(prev => { const next = { ...prev }; next[activeTab] = [...DEFAULT_COLS]; return next; });
        }
    };

    const handleSearch = () => {
        if (hotInstance.current) loadGridDataNew(hotInstance.current, supabase, startDate, endDate, comName, user, sortType, idFilter);
    };

    const handleReset = () => {
        const today = formatLocalDate(new Date());
        setStartDate(today); setEndDate(today); setComName('');
    };

    const downloadExcel = () => {
        const hot = hotInstance.current;
        if (!hot) return;
        const colCount = hot.countCols();
        const headers = [], keys = [];
        for (let i = 0; i < colCount; i++) {
            const prop = hot.colToProp(i);
            if (prop === 'actions' || prop === 'id') continue;
            headers.push(hot.getColHeader(i));
            keys.push(prop);
        }
        const rowCount = hot.countRows();
        const exportRows = [headers];
        for (let r = 0; r < rowCount; r++) {
            const physicalRowIdx = hot.toPhysicalRow(r);
            if (physicalRowIdx === null) continue;
            const row = hot.getSourceDataAtRow(physicalRowIdx);
            if (!row) continue;
            if (!row.com_name && !row.common_name && !row.sample_id) continue;
            exportRows.push(keys.map(key => key === null ? r + 1 : row[key] ?? ''));
        }
        if (exportRows.length <= 1) { alert('다운로드할 데이터가 없습니다.'); return; }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportRows);
        XLSX.utils.book_append_sheet(wb, ws, '시료채취기록대장(하반기통합)');
        XLSX.writeFile(wb, `시료채취기록대장_하반기통합_${startDate}_${endDate}.xlsx`);
    };

    // ─── 공시료 일괄 생성 (혼합 유해인자 고도화) ───────────────────────────────────────
    const addBlankSamplesAdvanced = (groupsToAdd) => {
        const hot = hotInstance.current;
        if (!hot) return;
        let totalCount = 0;
        groupsToAdd.forEach(g => { if (g.blanksFound < 2) totalCount += (2 - g.blanksFound); });
        if (totalCount <= 0) return;

        const currentReceiver = receiverDefaultRef.current;
        let addedCount = 0;
        
        for (const g of groupsToAdd) {
            const needed = 2 - g.blanksFound;
            if (needed <= 0) continue;
            const combinedHazard = Array.from(g.hazardSet).sort().join('/');
            
            // 해당 사업장/날짜의 가장 마지막 행 찾기
            let targetIdx = -1;
            const rowCount = hot.countRows();
            for (let i = 0; i < rowCount; i++) {
                const rowDate = hot.getDataAtRowProp(i, 'm_date');
                const rowCom = hot.getDataAtRowProp(i, 'com_name');
                if (rowDate === g.date && rowCom === g.comName) {
                    targetIdx = i;
                }
            }
            
            const insertVisualIdx = targetIdx !== -1 ? targetIdx + 1 : rowCount;
            
            if (insertVisualIdx === 0) {
                hot.alter('insert_row_above', 0, needed);
            } else {
                hot.alter('insert_row_below', insertVisualIdx - 1, needed);
            }
            
            hot.batch(() => {
                for (let i = 0; i < needed; i++) {
                    const row = insertVisualIdx + i;
                    hot.setDataAtRowProp(row, 'm_date', g.date || startDate);
                    hot.setDataAtRowProp(row, 'com_name', g.comName);
                    hot.setDataAtRowProp(row, 'worker_name', `공시료${g.blanksFound + i + 1}`);
                    hot.setDataAtRowProp(row, 'common_name', combinedHazard);
                    hot.setDataAtRowProp(row, 'condition', '양호');
                    hot.setDataAtRowProp(row, 'received_by', currentReceiver);
                    hot.setDataAtRowProp(row, 'received_date', g.date || startDate);
                    if (userRef.current) hot.setDataAtRowProp(row, 'measured_by', userRef.current.user_name);
                }
            });
            addedCount += needed;
        }

        if (addedCount > 0) {
            isDirtyRef.current = true;
            setTimeout(() => {
                alert(`공시료 총 ${addedCount}건을 각각의 사업장 데이터 바로 밑에 추가했습니다.\n확인 후 [데이터 저장]을 눌러주세요.`);
            }, 100);
        }
    };

    // ─── 저장 ────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        const hot = hotInstance.current;
        if (!hot) return;

        const raw = hot.getSourceData();
        const newRowPhysicalIndices = [];
        for (let i = 0; i < raw.length; i++) {
            if (!raw[i].id && (raw[i].com_name && raw[i].common_name)) {
                const physicalIdx = hot.toPhysicalRow(i);
                if (physicalIdx !== null) {
                    hot.setDataAtRowProp(i, 'sample_id', null, 'auto');
                    newRowPhysicalIndices.push(physicalIdx);
                }
            }
        }
        if (newRowPhysicalIndices.length > 0) await applyBulkSampleIds(newRowPhysicalIndices, true);

        const rawLatest = hot.getSourceData();
        const valid = rawLatest.filter(r => r.com_name && r.common_name);
        const ghosts = rawLatest.filter(r => r.id && (!r.com_name || !r.common_name));

        if (valid.length === 0 && ghosts.length === 0) { alert('저장하거나 지워진 데이터가 없습니다.'); return; }

        // ★ 공시료 2건 누락 체크 (화학적 혼합 측정 고도화 로직 적용)
        const allHazardsInGrid = new Set();
        rawLatest.forEach(r => {
            if (!r.com_name || !r.common_name) return;
            const hList = r.common_name.split('/').map(s => s.split('(')[0].trim()).filter(Boolean);
            hList.forEach(h => allHazardsInGrid.add(h));
        });

        let hazardProps = {};
        if (allHazardsInGrid.size > 0) {
            const { data } = await supabase
                .from('kiwe_hazard')
                .select('common_name, hazard_category, sampling_media, desorption_solvent')
                .in('common_name', Array.from(allHazardsInGrid));
            if (data) data.forEach(h => { hazardProps[h.common_name] = h; });
        }

        const blankGroups = {};
        rawLatest.forEach(r => {
            if (!r.com_name || !r.common_name) return;
            
            const isBlank = r.worker_name && r.worker_name.includes('공시료');
            const hList = r.common_name.split('/').map(s => s.split('(')[0].trim()).filter(Boolean);
            const mDate = r.m_date || startDate;
            
            const groupsInRow = new Set();
            hList.forEach(h => {
                if (h.includes('소음') || h.includes('조도')) return;
                const props = hazardProps[h] || {};
                const cat = props.hazard_category || '미분류';
                const media = props.sampling_media || '없음';
                const solvent = props.desorption_solvent || '없음';
                
                // 완벽히 일치해야 혼합 가능
                const key = `${mDate}|${r.com_name}|${cat}|${media}|${solvent}`;
                if (!blankGroups[key]) {
                    blankGroups[key] = {
                        date: mDate,
                        comName: r.com_name,
                        category: cat,
                        media: media,
                        solvent: solvent,
                        totalCount: 0,
                        blanksFound: 0,
                        hazardSet: new Set()
                    };
                }
                groupsInRow.add(key);
                if (!isBlank) blankGroups[key].hazardSet.add(h); // 일반 유해인자만 수집
            });
            
            groupsInRow.forEach(key => {
                blankGroups[key].totalCount++;
                if (isBlank) blankGroups[key].blanksFound++;
            });
        });

        const missingBlanks = [];
        for (const [key, info] of Object.entries(blankGroups)) {
            // 해당 조건에 측정된 유해인자가 실제로 존재할 때만 체크
            if (info.hazardSet.size > 0 && info.blanksFound < 2) {
                const details = [info.category, info.media, info.solvent].filter(x => x !== '없음').join('-');
                missingBlanks.push(`[${info.date}] ${info.comName} : ${details} 공시료 ${info.blanksFound}건 (최소 2건 필요)`);
            }
        }

        if (missingBlanks.length > 0) {
            return new Promise((resolve) => {
                showBlankWarningModal({
                    missingList: missingBlanks,
                    comName: '', // 개별 사업장 명시 제거
                    onAddBlanks: () => {
                        const groupsToAdd = Object.values(blankGroups).filter(info => info.hazardSet.size > 0 && info.blanksFound < 2);
                        addBlankSamplesAdvanced(groupsToAdd);
                        resolve('cancel');
                    },
                    onIgnore: () => { resolve('proceed'); },
                    onCancel:  () => { resolve('cancel'); }
                });
            }).then(async (decision) => {
                if (decision === 'proceed') await doSave(rawLatest, valid, ghosts, hot);
            });
        }

        await doSave(rawLatest, valid, ghosts, hot);
    };

    const doSave = async (rawLatest, valid, ghosts, hot) => {
        setLoading(true);
        try {
            if (ghosts.length > 0) {
                if (!confirm(`사업장명이나 유해인자가 지워진 기존 데이터가 ${ghosts.length}건 있습니다.\n이 데이터들은 데이터베이스에서도 완전히 삭제됩니다. 계속 진행하시겠습니까?`)) {
                    setLoading(false);
                    return;
                }
                const ghostIds = ghosts.map(g => g.id).filter(Boolean);
                if (ghostIds.length > 0) {
                    const { error: delErr } = await supabase.from(FIXED_TABLE).delete().in('id', ghostIds);
                    if (delErr) throw new Error(`빈 행 삭제 오류: ${delErr.message}`);
                }
            }

            const formatTimeHHMM = (val) => {
                if (!val) return null;
                let digits = String(val).replace(/\D/g, '');
                if (digits.length === 3) digits = '0' + digits;
                if (digits.length === 4) return digits.substring(0, 2) + ':' + digits.substring(2, 4);
                if (typeof val === 'string' && val.includes(':')) {
                    const parts = val.split(':');
                    if (parts.length >= 2) return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
                }
                return val;
            };

            const sanitizeInt   = (v) => { if (v === null || v === undefined || v === '') return null; const n = parseInt(v, 10);  return isNaN(n) ? null : n; };
            const sanitizeFloat = (v) => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(v);    return isNaN(n) ? null : n; };
            const sanitizeStr   = (v) => { if (v === null || v === undefined) return null; const s = String(v).trim(); return s === '' ? null : s; };

            // input_seq 부여
            let currentMaxSeq = 0;
            for (const s of rawLatest) {
                const v = parseInt(s.input_seq);
                if (!isNaN(v) && v > currentMaxSeq) currentMaxSeq = v;
            }
            let dbMaxSeq = 0;
            try {
                const { data: seqData } = await supabase.from(FIXED_TABLE).select('input_seq').not('input_seq', 'is', null).order('input_seq', { ascending: false }).limit(1);
                if (seqData && seqData.length > 0) dbMaxSeq = parseInt(seqData[0].input_seq) || 0;
            } catch (e) {}
            let nextSeq = Math.max(currentMaxSeq, dbMaxSeq);
            const rowCount = hot.countRows();
            for (let v = 0; v < rowCount; v++) {
                const physicalIdx = hot.toPhysicalRow(v);
                if (physicalIdx === null) continue;
                const s = rawLatest[physicalIdx];
                if (!s || !(s.com_name && s.common_name)) continue;
                const hasSeq = s.input_seq !== null && s.input_seq !== undefined && s.input_seq !== '';
                if (!hasSeq) { nextSeq++; s.input_seq = nextSeq; hot.setDataAtRowProp(v, 'input_seq', nextSeq, 'auto'); }
            }

            // 저장할 행 준비
            const preparedData = [];
            for (let i = 0; i < rawLatest.length; i++) {
                const s = rawLatest[i];
                if (!(s.com_name && s.common_name)) continue;
                if (!s.sample_id) s.sample_id = await calculateSampleId(i);
                // ★ measured_min 자동 계산 (start_time, end_time, lunch_time 기반)
                let calcMeasuredMin = sanitizeInt(s.measured_min);
                const st = formatTimeHHMM(s.start_time);
                const et = formatTimeHHMM(s.end_time);
                if (st && et) {
                    const [sH, sM] = st.split(':').map(Number);
                    const [eH, eM] = et.split(':').map(Number);
                    if (!isNaN(sH) && !isNaN(sM) && !isNaN(eH) && !isNaN(eM)) {
                        let startTotal = sH * 60 + sM;
                        let endTotal = eH * 60 + eM;
                        if (endTotal < startTotal) endTotal += 24 * 60;
                        const lunchMin = sanitizeInt(s.lunch_time) || 0;
                        calcMeasuredMin = Math.max(0, endTotal - startTotal - lunchMin);
                    }
                }

                const rowData = {
                    ...s,
                    m_date: s.m_date || startDate,
                    com_name: (s.com_name || '').replace(/\(주\)/g, '㈜').trim(),
                    start_time: st,
                    end_time:   et,
                    pump_no:         sanitizeStr(s.pump_no),
                    work_hour:       sanitizeFloat(s.work_hour),
                    lunch_time:      sanitizeInt(s.lunch_time),
                    measured_min:    calcMeasuredMin,
                    temp:            sanitizeStr(s.temp),
                    humidity:        sanitizeStr(s.humidity),
                    occurrence_type: sanitizeStr(s.occurrence_type),
                    shift_type:      sanitizeStr(s.shift_type),
                    condition:       sanitizeStr(s.condition) || '양호',
                    input_seq:       sanitizeInt(s.input_seq),
                    // ★ 유량보정 필드 (측정전/후 평균 각 1회)
                    pre_flow_avg:  sanitizeFloat(s.pre_flow_avg),
                    post_flow_avg: sanitizeFloat(s.post_flow_avg),
                };
                
                // ★ 수동 입력 시 is_self 누락 방지
                if (!rowData.is_self) {
                    const text = (rowData.common_name || '').trim();
                    if (text && allHazardsRef.current && allHazardsRef.current.length > 0) {
                        const baseName = text.split(/[/(]/)[0].trim();
                        const h = allHazardsRef.current.find(x => x.common_name === text || x.common_name === baseName);
                        if (h && h.is_self) {
                            rowData.is_self = h.is_self;
                        } else {
                            rowData.is_self = '자체분석'; // 기본값
                        }
                    }
                }
                delete rowData.actions;
                preparedData.push(rowData);
            }

            // DB 컬럼 기준 필터링
            const getValidData = async (data) => {
                try {
                    const { data: sampleRec } = await supabase.from(FIXED_TABLE).select('*').limit(1);
                    const dbCols = (sampleRec && sampleRec.length > 0) ? Object.keys(sampleRec[0]) : [];
                    const safeColumns = [
                        'm_date', 'com_name', 'work_process', 'worker_name', 'common_name',
                        'pump_no', 'start_time', 'end_time', 'shift_type', 'work_hour',
                        'lunch_time', 'measured_min', 'occurrence_type', 'temp', 'humidity',
                        'analyst', 'measured_by', 'received_by', 'sample_id', 'condition',
                        'received_date', 'status', 'completed_at', 'instrument_name', 'hazard_category',
                        'remarks', 'input_seq',
                        'pre_flow_avg', 'post_flow_avg'
                    ];
                    return data.map(item => {
                        const filtered = {};
                        Object.keys(item).forEach(key => {
                            const isAvailable = dbCols.length > 0 ? dbCols.includes(key) : safeColumns.includes(key);
                            if (isAvailable || key === 'id') {
                                const val = item[key];
                                if (key === 'id' && (val === null || val === undefined || val === '' || val === 0)) return;
                                filtered[key] = val;
                            }
                        });
                        return filtered;
                    });
                } catch (err) { console.error("컬럼 매핑 오류:", err); return data; }
            };

            const finalData = await getValidData(preparedData);
            const newRows = finalData.filter(r => !r.id);
            const existingRows = finalData.filter(r => r.id);
            let totalSaved = 0;

            if (newRows.length > 0) {
                const { error: insErr } = await supabase.from(FIXED_TABLE).insert(newRows);
                if (insErr) throw insErr;
                totalSaved += newRows.length;
            }

            if (existingRows.length > 0) {
                const existingIds = existingRows.map(r => r.id).filter(Boolean);
                if (existingIds.length > 0) {
                    const { error: resetErr } = await supabase.from(FIXED_TABLE).update({ sample_id: null }).in('id', existingIds);
                    if (resetErr) {
                        console.warn('Sample ID 초기화 실패, TEMP prefix 시도:', resetErr);
                        const tempUpdates = existingIds.map(id => supabase.from(FIXED_TABLE).update({ sample_id: 'TEMP_' + id }).eq('id', id));
                        await Promise.all(tempUpdates);
                    }
                }
                const { error: upsErr } = await supabase.from(FIXED_TABLE).upsert(existingRows);
                if (upsErr) throw upsErr;
                totalSaved += existingRows.length;
            }

            alert(totalSaved + '건 저장되었습니다.');
            isDirtyRef.current = false;
            loadGridDataNew(hot, supabase, startDate, endDate, comName, user, sortType, idFilter);

        } catch (err) {
            console.error(err);
            alert('저장 중 오류: ' + err.message);
        } finally { setLoading(false); }
    };

    if (!user) return null;

    // ─── 렌더 ────────────────────────────────────────────────────────
    return e('div', { className: "flex flex-col h-screen" },
        // 헤더
        e('header', { className: "glass-header h-16 flex items-center justify-between px-8 sticky top-0 z-50" },
            e('div', { className: "flex items-center gap-6" },
                e('a', { href: "main.html", className: "p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors flex items-center gap-2", title: "홈으로 이동" },
                    e(Home, { size: 22 }),
                    e('span', { className: "text-xs font-bold" }, "HOME")
                ),
                e('h1', { className: "text-xl font-extrabold text-purple-700 tracking-tight flex items-center gap-2" },
                    e(FlaskConical, { size: 24 }),
                    " KiWE 시료관리 (하반기 통합)",
                    e('span', { className: "ml-2 px-2 py-0.5 bg-purple-100 text-purple-600 text-xs font-black rounded-full border border-purple-200 animate-pulse" }, "NEW")
                ),
                e('nav', { className: "flex gap-8 h-full items-center ml-10" },
                    e('button', { onClick: () => handleTabChange(1), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 1 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "📋 시료채취기록대장"),
                    e('button', { onClick: () => handleTabChange(2), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 2 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "⚗️ 유해인자 설정"),
                    e('button', { onClick: () => handleTabChange(3), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 3 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "📊 시료대장(통계)"),
                    e('button', { onClick: () => handleTabChange(4), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 4 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "🔊 소음대장"),
                    e('button', { onClick: () => handleTabChange(5), className: "text-sm font-bold pb-1 transition-all " + (activeTab === 5 ? 'tab-active' : 'text-slate-400 hover:text-slate-600') }, "💧 유량보정대장"),
                    e('a', {
                        href: "#",
                        onClick: (ev) => { ev.preventDefault(); window.open('sample_record_print.html', 'samplePrint', 'width=1400,height=900,resizable=yes,scrollbars=yes'); },
                        className: "text-sm font-bold pb-1 transition-all text-emerald-500 hover:text-emerald-700 flex items-center gap-1"
                    }, "🧪 시료채취기록표")
                )
            ),
            e('div', { className: "flex items-center gap-4" },
                e('div', { className: "flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-lg text-xs font-black text-purple-600 border border-purple-100" },
                    e(Database, { size: 12 }), " DB: ", e('code', { className: "ml-1 font-mono" }, FIXED_TABLE)
                ),
                e('div', { className: "flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full text-xs font-black text-indigo-600 border border-indigo-100 shadow-sm" },
                    e(User, { size: 14 }), user.user_name + " 님"
                )
            )
        ),

        // 메인
        e('main', { className: "flex-1 flex flex-col overflow-hidden bg-slate-50" },

            // Tab 1: 시료채취기록대장 (유량보정 통합)
            activeTab === 1 && e('div', { className: "flex-1 flex flex-col overflow-hidden p-4 gap-3" },

                // 검색 패널
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
                                e('label', { className: "text-[11px] font-extrabold text-slate-400 mb-1 block uppercase" }, "통합 검색 (사업장/근로자/유해인자)"),
                                e('div', { className: "relative flex gap-2" },
                                    e('div', { className: "relative flex-1" },
                                        e(Building2, { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400", size: 16 }),
                                        e('input', {
                                            type: "text",
                                            placeholder: "검색어 입력 (사업장, 근로자, 유해인자, 공정 등)...",
                                            className: "input-standard pl-10 h-[42px]",
                                            value: comName,
                                            onChange: (ev) => { setComName(ev.target.value); setShowCompanyList(true); },
                                            onKeyDown: (ev) => { if (ev.key === 'Enter') handleSearch(); },
                                            onFocus: () => setShowCompanyList(true)
                                        }),
                                        showCompanyList && comName && e('div', { className: "absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto" },
                                            companies.filter(c => {
                                                const norm = (str) => (str || '').replace(/\(주\)|㈜|\s/g, '').toLowerCase();
                                                return norm(c.com_name).includes(norm(comName));
                                            }).map(c =>
                                                e('div', { key: c.com_id, onClick: () => { setComName(c.com_name); setShowCompanyList(false); }, className: "px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold" }, c.com_name)
                                            )
                                        )
                                    ),
                                    e('button', { onClick: handleSearch, className: "btn-primary bg-purple-600 hover:bg-purple-700 h-[42px] px-6" }, e(Search, { size: 18 }), "검색"),
                                    e('button', { onClick: handleReset, className: "h-[42px] px-4 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap" },
                                        e(RotateCcw, { size: 18 }),
                                        e('span', { className: "text-xs font-bold" }, "초기화")
                                    )
                                )
                            ),
                            e('div', { className: "h-10 w-px bg-slate-200 mx-1" }),
                            e('div', { className: "flex flex-col gap-1" },
                                e('label', { className: "text-[11px] font-extrabold text-slate-400 block uppercase" }, "시료 분류 필터"),
                                e('div', { className: "flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200" },
                                    ['all','s','d','sb','db'].map(f =>
                                        e('button', {
                                            key: f,
                                            onClick: () => setIdFilter(f),
                                            className: `px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${idFilter === f ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`
                                        }, f === 'all' ? '전체' : f === 'sb' ? '🧪 공시료(SB)' : f === 'db' ? '🧪 공시료(DB)' : `🔬 시료(${f.toUpperCase()})`)
                                    )
                                )
                            ),
                            e('div', { className: "flex flex-col gap-1" },
                                e('label', { className: "text-[11px] font-extrabold text-slate-400 block uppercase" }, "정렬"),
                                e('div', { className: "flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200" },
                                    e('button', { onClick: () => setSortType('input'), className: `px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${sortType === 'input' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'}` }, '📝 입력순'),
                                    e('button', { onClick: () => setSortType('sample_id'), className: `px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${sortType === 'sample_id' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'}` }, '🔢 번호순')
                                )
                            )
                        )
                    )
                ),

                // 유량 컬럼 안내 배너
                e('div', { className: "flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl flex items-center gap-3" },
                    e(Droplet, { size: 16, className: "text-green-600 flex-shrink-0" }),
                    e('p', { className: "text-xs font-bold text-green-700" },
                        "✅ 유량보정 통합 모드 — 각 행에 [측정전평균유량] · [측정후평균유량] 컬럼이 포함됩니다. 오른쪽으로 스크롤하면 확인할 수 있습니다."
                    ),
                    e('div', { className: "ml-auto flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded border border-green-200" }, `테이블: ${FIXED_TABLE}`)
                ),

                // 컬럼 설정 패널
                showSettings && e('div', { className: "card-custom p-4 flex-shrink-0 border-purple-100 ring-4 ring-purple-50/50" },
                    e('div', { className: "flex justify-between items-center mb-4" },
                        e('h3', { className: "font-bold text-slate-700 flex items-center gap-2" }, e(Settings, { size: 18, className: "text-purple-600" }), "기록대장 컬럼 구성"),
                        e('div', { className: "flex items-center gap-2" },
                            e('button', { onClick: () => saveColumnConfigToDB(columnConfig), disabled: settingsSaveStatus === 'saving', className: settingsSaveStatus === 'saved' ? "text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200" : "text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-sm" },
                                settingsSaveStatus === 'saved' ? '✅ 저장 완료' : '🌐 공유 저장'
                            ),
                            e('button', { onClick: resetColumns, className: "text-xs font-bold text-slate-400 hover:text-red-500 px-2" }, "초기화"),
                            e('button', { onClick: () => setShowSettings(false), className: "text-slate-400 hover:text-slate-600" }, e(X, { size: 18 }))
                        )
                    ),
                    e('div', { ref: sortableRef, className: "flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200" },
                        currentCols.map(key => {
                            const col = ALL_GRID_COLUMNS.find(c => c.key === key);
                            if (!col) return null;
                            const isFlow = false;
                            return e('div', { key, 'data-id': key, className: `group flex items-center gap-2 ${isFlow ? 'bg-green-50 border-green-200' : 'bg-white border-indigo-100'} border rounded-lg pl-2 pr-2 py-1.5 shadow-sm hover:border-purple-300 transition-all select-none` },
                                e('div', { className: "drag-handle p-1 cursor-grab text-slate-300 hover:text-purple-500 active:cursor-grabbing" },
                                    e('svg', { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3" },
                                        e('circle', { cx: "9", cy: "5", r: "1" }), e('circle', { cx: "9", cy: "12", r: "1" }), e('circle', { cx: "9", cy: "19", r: "1" }),
                                        e('circle', { cx: "15", cy: "5", r: "1" }), e('circle', { cx: "15", cy: "12", r: "1" }), e('circle', { cx: "15", cy: "19", r: "1" })
                                    )
                                ),
                                e('span', { className: `text-sm font-bold ${isFlow ? 'text-green-700' : 'text-slate-700'}` }, col.label),
                                e('button', { onClick: (ev) => { ev.stopPropagation(); toggleColumn(key); }, className: "p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 ml-1" }, e(X, { size: 14 }))
                            );
                        })
                    ),
                    e('div', { className: "pt-4 border-t border-slate-100" },
                        e('div', { className: "text-xs font-bold text-slate-400 mb-3" }, "비활성 컬럼 (클릭하여 추가)"),
                        e('div', { className: "flex flex-wrap gap-2" },
                            ALL_GRID_COLUMNS.filter(c => !currentCols.includes(c.key)).map(col => {
                                const isFlow = false;
                                return e('button', { key: col.key, onClick: () => toggleColumn(col.key), className: `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isFlow ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600'} border` }, "+ " + col.label);
                            })
                        )
                    )
                ),

                // 그리드 패널
                e('div', { className: "card-custom flex flex-col overflow-hidden flex-1 min-h-0" },
                    e('div', { className: "p-3 border-b bg-slate-50 flex items-center justify-between text-xs text-slate-400 font-bold flex-shrink-0" },
                        e('div', { className: "flex items-center gap-4" },
                            e('span', { className: "flex items-center gap-1" }, e(Info, { size: 14, className: "text-blue-500" }), " [유해인자] 셀 더블클릭 → 검색"),
                            e('span', { className: "flex items-center gap-1 text-green-600" }, e(Droplet, { size: 14 }), " 녹색 컬럼 = 유량보정(전/후)"),
                        ),
                        e('div', { className: "flex gap-2" },
                            e('button', { onClick: () => setShowSettings(!showSettings), className: "px-4 py-2 bg-white text-purple-600 border border-purple-200 rounded-lg font-bold hover:bg-purple-50 transition-all flex items-center gap-1 shadow-sm" },
                                e(Settings, { size: 14 }), "컬럼설정"
                            ),
                            e('button', { onClick: downloadExcel, className: "px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm" },
                                e(Download, { size: 14 }), "엑셀 다운로드"
                            ),
                            e('button', { onClick: () => addRows(10), className: "px-4 py-2 bg-slate-500 text-white rounded-lg font-bold hover:bg-slate-600 transition-all flex items-center gap-1" },
                                e(Plus, { size: 14 }), "10줄 추가"
                            ),
                            e('button', { onClick: () => addRows(50), className: "px-4 py-2 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 transition-all flex items-center gap-1" },
                                e(Plus, { size: 14 }), "50줄 추가"
                            ),
                            e('button', { onClick: handleSubmit, disabled: loading, className: "px-6 py-2 bg-purple-600 text-white rounded-lg font-black shadow-lg hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center gap-2" },
                                e(Save, { size: 18 }), loading ? '저장 중...' : '데이터 저장'
                            )
                        )
                    ),
                    e('div', { className: "flex-1 min-h-0" },
                        e('div', { ref: hotRef, style: { height: '100%' } })
                    )
                )
            ),

            activeTab === 2 && e(HazardManagement),
            activeTab === 3 && e('div', { className: "flex-1 flex justify-center bg-slate-100/50" },
                e('div', { className: "w-full shadow-2xl bg-white overflow-hidden" },
                    e('iframe', { src: "sampling_manage.html?iframe=true", className: "w-full h-full border-none", style: { height: 'calc(100vh - 64px)' } })
                )
            ),
            activeTab === 4 && e('div', { className: "flex-1 flex flex-col min-h-0 overflow-hidden" },
                e(NoiseRecord, { user: user, supabase: supabase })
            ),
            activeTab === 5 && e('div', { className: "flex-1 flex justify-center bg-slate-100/50 overflow-auto py-6" },
                e('div', { className: "w-full max-w-[1350px] shadow-2xl border bg-white rounded-xl overflow-hidden flex flex-col h-fit mb-10" },
                    e('iframe', { src: "flow.html?mode=input&m_date=" + startDate, className: "w-full border-none", style: { height: '1200px' } })
                )
            )
        )
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));

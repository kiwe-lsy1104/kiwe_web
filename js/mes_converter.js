/**
 * ============================================================
 *  mes_converter.js  v2.4
 *  시료채취기록표 (MES변환용) - 독립 모듈
 *
 *  [핵심 개발 목적]
 *  측정 전 유해인자 및 시료번호를 미리 뽑아 인쇄한 후,
 *  현장에서 기기번호, Cal no., 유량, 시간을 수기로 작성하는 양식
 *
 *  [v2.4 주요 해결 과제]
 *  1. 인쇄 페이지 분할 완전 해결 (Pagination Engine):
 *     - 첫 페이지 빈 공간 및 3페이지 1줄 밀림 현상 원천 차단.
 *     - 페이지당 행 수(기본 20행, 선택 가능) 기준으로 A4 용지 블록(.mes-paper) 완전 분할.
 *     - 각 페이지마다 상단 문서 헤더, 테이블 헤더(thead), 푸터, 페이지 번호(1/2 page) 완벽 세트 렌더링.
 *  2. 소음 시료번호 공란 보장 (물리적 인자 분리).
 *  3. 컬럼 순서 Drag & Drop 재배열 및 너비 리사이즈 (localStorage 자동 보관).
 *  4. 복수 엑셀 양식 스마트 헤더 감지 (시화한일도금, 삼화정밀 등).
 *  5. 구형 XLS 손상 바이너리(Bad ExternSheet) 클라이언트 자동 패치.
 * ============================================================
 */

'use strict';

// ──────────────────────────────────────────
// 0. 컬럼 정의 메타데이터
// ──────────────────────────────────────────
const COLUMNS_DEF = {
    no:         { id: 'no',         label: 'No',         defaultWidth: 28,  align: 'center' },
    proc:       { id: 'proc',       label: '단위작업공정', defaultWidth: 85,  align: 'center', isGroupSpan: 'proc' },
    workerName: { id: 'workerName', label: '근로자명',   defaultWidth: 60,  align: 'center', isGroupSpan: 'worker' },
    location:   { id: 'location',   label: '측정위치',   defaultWidth: 50,  align: 'center', isGroupSpan: 'worker' },
    hazard:     { id: 'hazard',     label: '유해인자',   defaultWidth: 95,  align: 'left' },
    deviceNo:   { id: 'deviceNo',   label: '기기번호',   defaultWidth: 55,  align: 'center', isBlankHandwriting: true },
    calNo:      { id: 'calNo',      label: 'Cal no.',    defaultWidth: 50,  align: 'center', isBlankHandwriting: true },
    sampleId:   { id: 'sampleId',   label: '시료번호',   defaultWidth: 70,  align: 'center' },
    flowBefore: { id: 'flowBefore', label: '전유량',     defaultWidth: 50,  align: 'center', isBlankHandwriting: true },
    flowAfter:  { id: 'flowAfter',  label: '후유량',     defaultWidth: 50,  align: 'center', isBlankHandwriting: true },
    startTime:  { id: 'startTime',  label: '시작시간',   defaultWidth: 50,  align: 'center', isBlankHandwriting: true },
    endTime:    { id: 'endTime',    label: '종료시간',   defaultWidth: 50,  align: 'center', isBlankHandwriting: true },
    remark:     { id: 'remark',     label: '비고',       defaultWidth: 70,  align: 'left' },
};

const DEFAULT_COL_ORDER = [
    'no', 'proc', 'workerName', 'location', 'hazard',
    'deviceNo', 'calNo', 'sampleId',
    'flowBefore', 'flowAfter', 'startTime', 'endTime', 'remark'
];

const STORAGE_KEYS = {
    ORDER:       'MES_COL_ORDER_V2_4',
    WIDTHS:      'MES_COL_WIDTHS_V2_4',
    ROWS_PAGE:   'MES_ROWS_PER_PAGE_V2_4',
};

// ──────────────────────────────────────────
// 1. 전역 상태 (모듈 범위)
// ──────────────────────────────────────────
let MES = {
    raw: null,
    parsedRows: [],
    meta: { companyName: '', year: '', halfYear: '', measureDate: '' },
    colOrder: [...DEFAULT_COL_ORDER],
    colWidths: {},
    rowsPerPage: 20, // 기본 페이지당 20행
    draggedColId: null,
};

// ──────────────────────────────────────────
// 2. 초기화 – DOMContentLoaded
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initDropzone();
    initPrintButton();
    initResetButton();
    initResetColBtn();
    initResetOrderBtn();
    initRowsPerPageSelect();

    // 검증용 자동 로드 지원 (?autoTest=true)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoTest') === 'true') {
        const testFile = urlParams.get('file') || '시화한일도금공업사업협동조합_2026_하반기.xlsx';
        fetch(encodeURIComponent(testFile))
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], testFile, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                processFile(file);
            })
            .catch(err => console.log('[Auto-test] 로드 건너뜀:', err));
    }
});

// ──────────────────────────────────────────
// 3. 설정 관리 (순서, 너비, 페이지당 행 수)
// ──────────────────────────────────────────
function loadSettings() {
    // 1. 순서
    try {
        const savedOrder = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDER));
        if (Array.isArray(savedOrder) && savedOrder.length === DEFAULT_COL_ORDER.length) {
            const allExist = DEFAULT_COL_ORDER.every(id => savedOrder.includes(id));
            if (allExist) MES.colOrder = savedOrder;
        }
    } catch {}

    // 2. 너비
    MES.colWidths = {};
    DEFAULT_COL_ORDER.forEach(id => {
        MES.colWidths[id] = COLUMNS_DEF[id].defaultWidth;
    });
    try {
        const savedWidths = JSON.parse(localStorage.getItem(STORAGE_KEYS.WIDTHS));
        if (savedWidths && typeof savedWidths === 'object') {
            Object.keys(savedWidths).forEach(id => {
                if (COLUMNS_DEF[id]) {
                    MES.colWidths[id] = Number(savedWidths[id]) || COLUMNS_DEF[id].defaultWidth;
                }
            });
        }
    } catch {}

    // 3. 페이지당 행 수
    try {
        const savedRows = parseInt(localStorage.getItem(STORAGE_KEYS.ROWS_PAGE), 10);
        if (savedRows >= 10 && savedRows <= 35) {
            MES.rowsPerPage = savedRows;
        }
    } catch {}
}

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEYS.ORDER, JSON.stringify(MES.colOrder));
        localStorage.setItem(STORAGE_KEYS.WIDTHS, JSON.stringify(MES.colWidths));
        localStorage.setItem(STORAGE_KEYS.ROWS_PAGE, String(MES.rowsPerPage));
    } catch {}
}

// ──────────────────────────────────────────
// 4. 구형 XLS 바이너리 자동 복구 (Bad ExternSheet)
// ──────────────────────────────────────────
function autoFixBiffExternSheet(uint8) {
    if (uint8.length < 512 || uint8[0] !== 0xD0 || uint8[1] !== 0xCF) {
        return uint8;
    }
    for (let i = 0; i < uint8.length - 8; i++) {
        if (uint8[i] === 0x17 && uint8[i+1] === 0x00 && uint8[i+2] === 0x08 && uint8[i+3] === 0x00) {
            const cxt = uint8[i+4] | (uint8[i+5] << 8);
            if (cxt > 1) {
                console.log(`[MES Converter] XLS EXTERNSHEET 손상 자동 복구 (cxt=${cxt} -> 1)`);
                uint8[i+4] = 0x01;
                uint8[i+5] = 0x00;
            }
        }
    }
    return uint8;
}

// ──────────────────────────────────────────
// 5. 드래그 앤 드롭 업로드
// ──────────────────────────────────────────
function initDropzone() {
    const zone = document.getElementById('mes-dropzone');
    const fileInput = document.getElementById('mes-file-input');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
        fileInput.value = '';
    });

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!/\.(xlsx|xls)$/i.test(file.name)) {
            showError('xlsx 또는 xls 파일만 업로드할 수 있습니다.');
            return;
        }
        processFile(file);
    });
}

// ──────────────────────────────────────────
// 6. 파일명 파싱: 사업장명_연도_반기.xlsx
// ──────────────────────────────────────────
function parseFileName(fileName) {
    const base = fileName.replace(/\.(xlsx|xls)$/i, '');
    const parts = base.split('_');
    let companyName = '', year = '', halfYear = '';

    if (parts.length >= 3) {
        halfYear    = parts[parts.length - 1];
        year        = parts[parts.length - 2];
        companyName = parts.slice(0, parts.length - 2).join('_');
    } else if (parts.length === 2) {
        companyName = parts[0];
        year        = parts[1];
    } else {
        companyName = base;
    }
    return { companyName, year, halfYear, measureDate: '' };
}

// ──────────────────────────────────────────
// 7. 파일 처리 (SheetJS 파싱)
// ──────────────────────────────────────────
function processFile(file) {
    setStatus('loading', `📂 "${file.name}" 읽는 중...`);
    hideResult();

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            let data = new Uint8Array(e.target.result);
            data = autoFixBiffExternSheet(data);

            const wb = XLSX.read(data, {
                type: 'array',
                cellStyles: true,
                cellDates: true,
                sheetRows: 0,
            });

            MES.raw  = wb;
            MES.meta = parseFileName(file.name);

            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            if (!ws) { showError('엑셀 파일에 시트가 없습니다.'); return; }

            const { rows, measureDate } = parseWorksheet(ws);
            MES.parsedRows = rows;
            MES.meta.measureDate = measureDate || '';

            if (MES.parsedRows.length === 0) {
                showError('유효한 측정 데이터를 찾을 수 없습니다. 파일 양식을 확인해주세요.');
                return;
            }

            renderAllPages(MES.parsedRows, MES.meta);
            setStatus('success', `✅ ${MES.meta.companyName || '파일'} 파싱 완료 — 총 ${MES.parsedRows.length}개 유효 인자 추출`);

        } catch (err) {
            console.error('[MES Converter v2.4] 파싱 오류:', err);
            showError(`파싱 오류: ${err.message}`);
        }
    };
    reader.onerror = () => showError('파일 읽기 오류가 발생했습니다.');
    reader.readAsArrayBuffer(file);
}

// ──────────────────────────────────────────
// 8. 워크시트 파싱 및 헤더 자동 감지
// ──────────────────────────────────────────
function parseWorksheet(ws) {
    const ref = ws['!ref'];
    if (!ref) return { rows: [], measureDate: '' };

    const range = XLSX.utils.decode_range(ref);
    const maxRow = range.e.r;
    const maxCol = Math.max(range.e.c, 45);

    const grid = [];
    for (let r = 0; r <= maxRow; r++) {
        const row = [];
        for (let c = 0; c <= maxCol; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            row.push(cell ? getCellValue(cell) : '');
        }
        grid.push(row);
    }

    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(grid.length, 5); r++) {
        const rowStr = grid[r].join(' ');
        if (rowStr.includes('유해인자') || rowStr.includes('단위작업장소') || rowStr.includes('측정위치') || rowStr.includes('근로자명')) {
            headerRowIdx = r;
            break;
        }
    }

    const COL = detectColumns(grid, headerRowIdx);
    const measureDate = extractMeasureDate(grid, headerRowIdx, COL);

    const rows = [];
    let lastProc     = '';
    let lastWorker   = '';
    let lastLocation = '';
    let lastSampleId = '';

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
        const row = grid[r];
        const hazardRaw = getCellStr(row, COL.hazard);

        // 유해인자 빈 값이면 즉시 절단 (Break)
        if (!hazardRaw || hazardRaw.trim() === '') {
            break;
        }

        const rowHead = row.slice(0, 10).join('').trim();
        if (/^(합계|총계|소계|계|total)/i.test(rowHead)) continue;

        const hazardClean = hazardRaw.trim();
        const isNoise = /소음/i.test(hazardClean);

        const location   = getCellStr(row, COL.location)   || lastLocation;
        const proc       = getCellStr(row, COL.proc)       || lastProc;
        const workerName = getCellStr(row, COL.workerName) || lastWorker;

        let sampleId = '';
        if (isNoise) {
            sampleId = ''; // 소음은 항상 빈칸
        } else {
            const rawSid = getCellStr(row, COL.sampleId);
            if (rawSid) {
                sampleId = rawSid;
                lastSampleId = rawSid;
            } else {
                sampleId = lastSampleId;
            }
        }

        lastLocation = location   || lastLocation;
        lastProc     = proc       || lastProc;
        lastWorker   = workerName || lastWorker;

        rows.push({
            _rowIdx: r,
            proc: proc || '(공정미지정)',
            hazard: hazardClean,
            workerName: workerName || '—',
            location: location || '—',
            sampleId: sampleId,
            isNoise: isNoise,
        });
    }

    return { rows, measureDate };
}

function detectColumns(grid, headerRowIdx) {
    const headerRow = grid[headerRowIdx] || [];
    const colMap = {
        measureDate: -1, proc: -1, hazard: -1, location: -1, workerName: -1,
        deviceNo: -1, calNo: -1, sampleId: -1,
    };

    headerRow.forEach((cellText, c) => {
        const text = String(cellText || '').trim().replace(/\s+/g, '');
        if (/^측정일자|^측정일/.test(text) && colMap.measureDate === -1) colMap.measureDate = c;
        else if (/단위작업장소|단위작업공정|^공정명/.test(text) && colMap.proc === -1) colMap.proc = c;
        else if (/^유해인자|^측정인자/.test(text) && colMap.hazard === -1) colMap.hazard = c;
        else if (/^측정위치/.test(text) && colMap.location === -1) colMap.location = c;
        else if (/^근로자명|^성명|^근로자$/.test(text) && colMap.workerName === -1) colMap.workerName = c;
        else if (/^시료번호|^sampleid/i.test(text) && colMap.sampleId === -1) colMap.sampleId = c;
        else if (/^기기번호|^펌프번호/.test(text) && colMap.deviceNo === -1) colMap.deviceNo = c;
        else if (/^calno|^cal/i.test(text) && colMap.calNo === -1) colMap.calNo = c;
    });

    if (colMap.hazard === -1) {
        colMap.hazard = (headerRow[5] && headerRow[5].includes('유해인자')) ? 5 : 6;
    }
    if (colMap.proc === -1) {
        colMap.proc = (colMap.hazard === 5) ? 3 : 5;
    }
    if (colMap.sampleId === -1) {
        colMap.sampleId = (colMap.hazard === 5) ? 7 : 33;
    }
    if (colMap.location === -1) {
        colMap.location = (colMap.hazard === 5) ? 16 : 17;
    }
    if (colMap.workerName === -1) {
        colMap.workerName = (colMap.hazard === 5) ? 18 : 19;
    }

    return colMap;
}

function extractMeasureDate(grid, headerRowIdx, COL) {
    if (COL.measureDate !== -1) {
        for (let r = headerRowIdx + 1; r < grid.length; r++) {
            const d = formatDateStr(getCellStr(grid[r], COL.measureDate));
            if (d) return d;
        }
    }
    for (let c of [0, 1]) {
        for (let r = headerRowIdx + 1; r < grid.length; r++) {
            const d = formatDateStr(getCellStr(grid[r], c));
            if (d) return d;
        }
    }
    return '';
}

function formatDateStr(val) {
    if (!val) return '';
    val = String(val).trim();
    const m = val.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const mNum = val.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (mNum) return `${mNum[1]}-${mNum[2]}-${mNum[3]}`;
    const num = Number(val);
    if (!isNaN(num) && num > 35000 && num < 65000) {
        try {
            const date = new Date((num - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        } catch {}
    }
    return '';
}

function getCellValue(cell) {
    if (!cell) return '';
    if (cell.t === 'd') {
        if (cell.v instanceof Date) {
            const y = cell.v.getFullYear();
            const m = String(cell.v.getMonth() + 1).padStart(2, '0');
            const d = String(cell.v.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return String(cell.w || cell.v || '');
    }
    return String(cell.w !== undefined ? cell.w : (cell.v !== undefined ? cell.v : '')).trim();
}

function getCellStr(row, colIndex) {
    if (colIndex === undefined || colIndex < 0 || colIndex >= row.length) return '';
    return String(row[colIndex] ?? '').trim();
}

// ──────────────────────────────────────────
// 9. 핵심: 정밀 페이지 분할 (Pagination Engine)
//    - 첫 페이지 공백 및 3페이지 1줄 밀림 원천 차단
//    - 각 페이지마다 정확한 행 수 분할 및 페이지 내 rowspan 재계산
// ──────────────────────────────────────────
function paginateRows(rows, maxRows) {
    if (!rows || rows.length === 0) return [];

    const pages = [];
    const total = rows.length;

    for (let startIdx = 0; startIdx < total; startIdx += maxRows) {
        const pageSlice = rows.slice(startIdx, startIdx + maxRows);

        // 페이지 내부에서 rowspan 재계산
        // procSpans: 각 행별 proc rowspan (첫 번째 행에만 숫자, 나머지는 0)
        // workerSpans: 각 행별 workerName+location rowspan
        const pageRows = pageSlice.map((r, i) => ({
            ...r,
            globalNo: startIdx + i + 1,
            procSpan: 0,
            workerSpan: 0,
        }));

        // 1. 공정(proc) span 계산
        let pStart = 0;
        while (pStart < pageRows.length) {
            let pEnd = pStart + 1;
            while (pEnd < pageRows.length && pageRows[pEnd].proc === pageRows[pStart].proc) {
                pEnd++;
            }
            pageRows[pStart].procSpan = pEnd - pStart;
            pStart = pEnd;
        }

        // 2. 근로자명+위치 span 계산
        let wStart = 0;
        while (wStart < pageRows.length) {
            const wKey = `${pageRows[wStart].workerName}__${pageRows[wStart].location}`;
            let wEnd = wStart + 1;
            while (wEnd < pageRows.length && `${pageRows[wEnd].workerName}__${pageRows[wEnd].location}` === wKey) {
                wEnd++;
            }
            pageRows[wStart].workerSpan = wEnd - wStart;
            wStart = wEnd;
        }

        pages.push(pageRows);
    }

    return pages;
}

// ──────────────────────────────────────────
// 10. 다중 페이지 렌더링
// ──────────────────────────────────────────
function renderAllPages(rows, meta) {
    const container = document.getElementById('mes-result-container');
    if (!container) return;

    const pages = paginateRows(rows, MES.rowsPerPage);
    const totalPages = pages.length;
    const order = MES.colOrder;
    const printDate = new Date().toLocaleDateString('ko-KR');
    const metaStr = [meta.companyName, meta.year, meta.halfYear].filter(Boolean).join(' · ');

    // 공통 colgroup
    function buildColgroup() {
        const cols = order.map((colId, i) => {
            const w = MES.colWidths[colId] || COLUMNS_DEF[colId].defaultWidth;
            return i === order.length - 1
                ? '<col>'
                : `<col data-col-id="${colId}" style="width:${w}px">`;
        }).join('');
        return `<colgroup>${cols}</colgroup>`;
    }

    // 공통 thead
    const thCellsHtml = order.map((colId) => {
        const def = COLUMNS_DEF[colId];
        return `
        <th draggable="true"
            data-col-id="${colId}"
            class="mes-th-draggable"
            title="드래그하여 컬럼 순서 변경">
            <span class="mes-th-drag-grip">⋮⋮</span>
            <span class="mes-th-text">${def.label}</span>
        </th>`;
    }).join('');

    const theadHtml = `<thead><tr>${thCellsHtml}</tr></thead>`;

    // 각 페이지 HTML 빌드
    const pagesHtml = pages.map((pageRows, pageIdx) => {
        const pageNum = pageIdx + 1;
        const isFirst = (pageIdx === 0);
        const breakCls = isFirst ? '' : 'print-break';

        // tbody 행들
        const tbodyRowsHtml = pageRows.map(row => {
            const tds = order.map(colId => {
                const def = COLUMNS_DEF[colId];

                // 공정 span
                if (def.isGroupSpan === 'proc') {
                    if (row.procSpan === 0) return ''; // 이전 행에 병합됨
                    return `<td class="mes-td-center mes-td-proc" rowspan="${row.procSpan}">${esc(row.proc)}</td>`;
                }
                // 근로자/위치 span
                if (def.isGroupSpan === 'worker') {
                    if (row.workerSpan === 0) return ''; // 이전 행에 병합됨
                    if (colId === 'workerName') {
                        return `<td class="mes-td-center mes-td-worker" rowspan="${row.workerSpan}">${esc(row.workerName)}</td>`;
                    } else if (colId === 'location') {
                        return `<td class="mes-td-center mes-td-loc" rowspan="${row.workerSpan}">${esc(row.location)}</td>`;
                    }
                }

                // 일반 컬럼
                if (colId === 'no') {
                    return `<td class="mes-td-center mes-td-no">${row.globalNo}</td>`;
                }
                if (colId === 'hazard') {
                    return `<td class="mes-td-hazard ${row.isNoise ? 'mes-td-noise' : ''}">${esc(row.hazard)}</td>`;
                }
                if (colId === 'sampleId') {
                    if (row.isNoise || !row.sampleId) {
                        return `<td class="mes-td-center mes-td-empty"></td>`;
                    }
                    return `<td class="mes-td-center mes-td-sid">${esc(row.sampleId)}</td>`;
                }
                if (def.isBlankHandwriting) {
                    return `<td class="mes-td-center mes-td-empty"></td>`;
                }
                if (colId === 'remark') {
                    return `<td></td>`;
                }

                return `<td></td>`;
            }).join('');

            return `<tr>${tds}</tr>`;
        }).join('');

        return `
        <!-- 페이지 ${pageNum} / ${totalPages} -->
        <div class="mes-paper ${breakCls}">
            <!-- 문서 헤더 -->
            <div class="mes-doc-header">
                <div class="mes-doc-header-left">
                    <div class="mes-title-main">
                        시료채취기록표<span class="mes-title-tag">MES변환용</span>
                        <span class="mes-page-badge">(${pageNum} / ${totalPages} page)</span>
                    </div>
                    <div class="mes-title-sub">${esc(metaStr)}</div>
                </div>
                <div class="mes-doc-header-right">
                    <div class="mes-info-box">
                        <div class="mes-info-row">
                            <span class="mes-info-label">사업장</span>
                            <span class="mes-info-value">${esc(meta.companyName) || '—'}</span>
                        </div>
                        <div class="mes-info-row mes-info-split">
                            <div class="mes-info-sub-item">
                                <span class="mes-info-label">연도</span>
                                <span class="mes-info-value">${esc(meta.year) || '—'}</span>
                            </div>
                            <div class="mes-info-sub-item">
                                <span class="mes-info-label">반기</span>
                                <span class="mes-info-value">${esc(meta.halfYear) || '—'}</span>
                            </div>
                        </div>
                        <div class="mes-info-row">
                            <span class="mes-info-label">측정일자</span>
                            <span class="mes-info-value">${esc(meta.measureDate) || '—'}</span>
                        </div>
                    </div>
                    <div class="mes-info-box">
                        <div class="mes-info-row">
                            <span class="mes-info-label">온도</span>
                            <span class="mes-info-blank"></span>
                            <span class="mes-info-unit">℃</span>
                        </div>
                        <div class="mes-info-row">
                            <span class="mes-info-label">습도</span>
                            <span class="mes-info-blank"></span>
                            <span class="mes-info-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 데이터 테이블 -->
            <div class="mes-table-wrapper">
                <table class="mes-table">
                    ${buildColgroup()}
                    ${theadHtml}
                    <tbody>
                        ${tbodyRowsHtml}
                    </tbody>
                </table>
            </div>

            <!-- 문서 푸터 -->
            <div class="mes-doc-footer">
                <span>페이지 ${pageNum}/${totalPages} · 총 ${rows.length}건 · 현장 수기작성 양식</span>
                <span>출력일: ${printDate} · 한국작업환경평가원(주)</span>
            </div>
        </div>`;
    }).join('\n');

    container.innerHTML = pagesHtml;

    showResult();
    attachResizeHandlers();
    attachReorderHandlers();
}

// ──────────────────────────────────────────
// 11. 컬럼 드래그 앤 드롭 순서 변경 (Reorder)
// ──────────────────────────────────────────
function attachReorderHandlers() {
    const tables = document.querySelectorAll('.mes-table');
    if (tables.length === 0) return;

    tables.forEach(table => {
        const thCells = table.querySelectorAll('thead th.mes-th-draggable');

        thCells.forEach(th => {
            th.addEventListener('dragstart', (e) => {
                MES.draggedColId = th.getAttribute('data-col-id');
                e.dataTransfer.setData('text/plain', MES.draggedColId);
                e.dataTransfer.effectAllowed = 'move';
                th.classList.add('mes-dragging');
            });

            th.addEventListener('dragend', () => {
                th.classList.remove('mes-dragging');
                document.querySelectorAll('thead th').forEach(el => el.classList.remove('mes-drag-over-left', 'mes-drag-over-right'));
                MES.draggedColId = null;
            });

            th.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const targetId = th.getAttribute('data-col-id');
                if (targetId === MES.draggedColId) return;

                const rect = th.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                const isRight = relX > (rect.width / 2);

                th.classList.toggle('mes-drag-over-left', !isRight);
                th.classList.toggle('mes-drag-over-right', isRight);
            });

            th.addEventListener('dragleave', () => {
                th.classList.remove('mes-drag-over-left', 'mes-drag-over-right');
            });

            th.addEventListener('drop', (e) => {
                e.preventDefault();
                th.classList.remove('mes-drag-over-left', 'mes-drag-over-right');

                const sourceId = MES.draggedColId || e.dataTransfer.getData('text/plain');
                const targetId = th.getAttribute('data-col-id');

                if (!sourceId || !targetId || sourceId === targetId) return;

                const rect = th.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                const insertAfter = relX > (rect.width / 2);

                const newOrder = MES.colOrder.filter(id => id !== sourceId);
                let targetIdx = newOrder.indexOf(targetId);
                if (insertAfter) targetIdx++;

                newOrder.splice(targetIdx, 0, sourceId);
                MES.colOrder = newOrder;

                saveSettings();
                renderAllPages(MES.parsedRows, MES.meta);
            });
        });
    });
}

// ──────────────────────────────────────────
// 12. 컬럼 너비 리사이즈 (Resize)
// ──────────────────────────────────────────
function attachResizeHandlers() {
    const tables = document.querySelectorAll('.mes-table');
    if (tables.length === 0) return;

    tables.forEach(table => {
        const thCells = table.querySelectorAll('thead th');

        thCells.forEach((th, idx) => {
            if (idx >= MES.colOrder.length - 1) return;

            const colId = th.getAttribute('data-col-id');
            th.querySelector('.mes-resize-handle')?.remove();
            th.style.position = 'relative';

            const handle = document.createElement('div');
            handle.className = 'mes-resize-handle';
            handle.title = '드래그하여 열 너비 조절';

            handle.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();

                const startX = ev.clientX;
                const startW = MES.colWidths[colId] || COLUMNS_DEF[colId].defaultWidth;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                const onMove = (mv) => {
                    const newW = Math.max(20, startW + (mv.clientX - startX));
                    MES.colWidths[colId] = Math.round(newW);

                    // 모든 페이지 테이블의 해당 컬럼 너비 동시 반영
                    document.querySelectorAll(`.mes-table colgroup col:nth-child(${idx + 1})`).forEach(c => {
                        c.style.width = MES.colWidths[colId] + 'px';
                    });
                };

                const onUp = () => {
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    saveSettings();
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });

            th.appendChild(handle);
        });
    });
}

// ──────────────────────────────────────────
// 13. UI 상태 관리 및 컨트롤
// ──────────────────────────────────────────
function setStatus(type, message) {
    const el = document.getElementById('mes-status');
    if (!el) return;
    el.className = `mes-status mes-status-${type}`;
    el.textContent = message;
    el.style.display = 'block';
}

function showError(msg) { setStatus('error', `❌ ${msg}`); }
function showResult() { const r = document.getElementById('mes-result-wrapper'); if (r) r.style.display = 'block'; }
function hideResult() { const r = document.getElementById('mes-result-wrapper'); if (r) r.style.display = 'none'; }

function initPrintButton() {
    document.getElementById('mes-print-btn')?.addEventListener('click', () => window.print());
}

function initResetButton() {
    document.getElementById('mes-reset-btn')?.addEventListener('click', () => {
        MES.raw = null;
        MES.parsedRows = [];
        MES.meta = { companyName: '', year: '', halfYear: '', measureDate: '' };
        hideResult();
        const statusEl = document.getElementById('mes-status');
        if (statusEl) statusEl.style.display = 'none';
        document.getElementById('mes-dropzone')?.classList.remove('drag-over', 'has-file');
    });
}

function initResetColBtn() {
    document.querySelectorAll('.mes-btn-reset-col').forEach(btn => {
        btn.addEventListener('click', () => {
            MES.colOrder.forEach(id => {
                MES.colWidths[id] = COLUMNS_DEF[id].defaultWidth;
            });
            saveSettings();
            if (MES.parsedRows.length > 0) {
                renderAllPages(MES.parsedRows, MES.meta);
            }
        });
    });
}

function initResetOrderBtn() {
    document.querySelectorAll('.mes-btn-reset-order').forEach(btn => {
        btn.addEventListener('click', () => {
            MES.colOrder = [...DEFAULT_COL_ORDER];
            saveSettings();
            if (MES.parsedRows.length > 0) {
                renderAllPages(MES.parsedRows, MES.meta);
            }
        });
    });
}

function initRowsPerPageSelect() {
    document.querySelectorAll('.mes-select-rows').forEach(sel => {
        sel.value = String(MES.rowsPerPage);
        sel.addEventListener('change', (e) => {
            MES.rowsPerPage = parseInt(e.target.value, 10) || 20;
            saveSettings();
            // 다른 셀렉트 동기화
            document.querySelectorAll('.mes-select-rows').forEach(s => s.value = String(MES.rowsPerPage));
            if (MES.parsedRows.length > 0) {
                renderAllPages(MES.parsedRows, MES.meta);
            }
        });
    });
}

// ──────────────────────────────────────────
// 14. 공통 유틸
// ──────────────────────────────────────────
function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

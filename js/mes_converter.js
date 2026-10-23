/**
 * ============================================================
 *  mes_converter.js  v2.6
 *  시료채취기록표 (MES변환용) - 독립 모듈
 *
 *  [핵심 개발 목적]
 *  측정 전 유해인자 및 시료번호를 미리 뽑아 인쇄한 후,
 *  현장에서 기기번호, Cal no., 유량, 시간을 수기로 작성하는 양식
 *
 *  [v2.6 주요 개선]
 *  1. Pagination Engine v2: proc(공정) 그룹 단위 페이지 분배
 *     - 공정 그룹이 페이지 경계에서 쪼개지지 않아
 *       '머리말/바닥글만 있는 빈 페이지' 현상 원천 차단
 *     - 단일 공정이 maxRows를 초과할 때만 강제 분할
 *  2. 인쇄 방향 전환: 세로(portrait) ↔ 가로(landscape)
 *     - 결과 툴바 버튼으로 즉시 전환
 *     - <style id="mes-page-style"> 동적 교체 방식 (@page 재정의)
 *  3. 페이지당 행 수 선택 확장: 28행, 30행 추가
 *
 *  [v2.5 주요 개선]
 *  1. 인쇄 페이지 분할 완전 해결 (Pagination Engine)
 *  2. 소음 시료번호 공란 보장
 *  3. 컬럼 순서 Drag & Drop 재배열 및 너비 리사이즈
 *  4. 복수 엑셀 양식 스마트 헤더 감지
 *  5. 구형 XLS 손상 바이너리(Bad ExternSheet) 클라이언트 자동 패치
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
    initOrientButtons();

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
//    - BIFF8 EXTERNSHEET(0x0017): type(2)+len(2)+cxt(2)+firstEntry(6) = len=8
//    - 손상된 파일은 cxt 필드만 잘못된 큰 값(ex: 174)이고 실제 데이터는 8바이트뿐
//    - cxt를 1로 패치하면 len=8이 유효한 레코드(cxt=1, entry=1개)가 됨
// ──────────────────────────────────────────
function autoFixBiffExternSheet(uint8) {
    // OLE2 Compound Document 시그니처 확인 (D0 CF 11 E0)
    if (uint8.length < 512 ||
        uint8[0] !== 0xD0 || uint8[1] !== 0xCF ||
        uint8[2] !== 0x11 || uint8[3] !== 0xE0) {
        return uint8;
    }

    // 패치를 위해 복사본 생성
    const buf = new Uint8Array(uint8);
    let fixCount = 0;

    for (let i = 0; i < buf.length - 8; i++) {
        // BIFF8 EXTERNSHEET record: type=0x0017, len=0x0008 (고정 = cxt(2)+entry(6))
        if (buf[i]   === 0x17 && buf[i+1] === 0x00 &&
            buf[i+2] === 0x08 && buf[i+3] === 0x00) {
            const cxt = buf[i+4] | (buf[i+5] << 8);
            if (cxt > 1) {
                console.log(`[MES Converter] XLS EXTERNSHEET 복구 @ offset=${i} (cxt=${cxt} -> 1)`);
                // cxt를 1로 설정 — len=8은 이미 올바름(cxt=1일 때 8바이트가 정확)
                buf[i+4] = 0x01;
                buf[i+5] = 0x00;
                fixCount++;
            }
            // 실제 레코드 크기(type 2바이트 + len 2바이트 + data 8바이트 = 12바이트)를
            // 정확히 건너뜀 (len=8 고정이므로 항상 +11로 건너뜀)
            i += 11;
        }
    }
    if (fixCount > 0) {
        console.log(`[MES Converter] 총 ${fixCount}개 EXTERNSHEET 레코드 패치 완료`);
    }
    return buf;
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
// 7. 파일 처리 (SheetJS 파싱 — 다중 Fallback 전략)
//    1차: cellStyles+cellDates (풀옵션)
//    2차: 옵션 최소화 (type:'array'만)
//    3차: FileReader binary → type:'binary' 재시도
// ──────────────────────────────────────────
function processFile(file) {
    setStatus('loading', `📂 "${file.name}" 읽는 중...`);
    hideResult();

    const isXls = /\.xls$/i.test(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
        const arrayBuf = e.target.result;

        // ── 1차 시도: Uint8Array + BIFF 자동 패치 + 풀옵션 ──
        let wb = null;
        let lastErr = null;
        try {
            let data = new Uint8Array(arrayBuf);
            data = autoFixBiffExternSheet(data);
            wb = XLSX.read(data, {
                type: 'array',
                cellStyles: true,
                cellDates: true,
                sheetRows: 0,
            });
            console.log('[MES Converter] 1차 파싱 성공 (array+cellDates)');
        } catch (err1) {
            console.warn('[MES Converter] 1차 파싱 실패, 2차 시도:', err1.message);
            lastErr = err1;
        }

        // ── 2차 시도: 옵션 최소화 ──
        if (!wb) {
            try {
                let data = new Uint8Array(arrayBuf);
                data = autoFixBiffExternSheet(data);
                wb = XLSX.read(data, {
                    type: 'array',
                    sheetRows: 0,
                    WTF: false,
                    bookVBA: false,
                });
                console.log('[MES Converter] 2차 파싱 성공 (array, 옵션 최소화)');
                lastErr = null;
            } catch (err2) {
                console.warn('[MES Converter] 2차 파싱 실패, 3차 시도:', err2.message);
                lastErr = err2;
            }
        }

        // ── 3차 시도: binary string 모드 (XLS 전용) ──
        if (!wb && isXls) {
            try {
                const binaryStr = new Uint8Array(arrayBuf)
                    .reduce((acc, byte) => acc + String.fromCharCode(byte), '');
                wb = XLSX.read(binaryStr, {
                    type: 'binary',
                    sheetRows: 0,
                    WTF: false,
                    bookVBA: false,
                });
                console.log('[MES Converter] 3차 파싱 성공 (binary 모드)');
                lastErr = null;
            } catch (err3) {
                console.warn('[MES Converter] 3차 파싱도 실패:', err3.message);
                lastErr = err3;
            }
        }

        if (!wb) {
            const errMsg = lastErr ? lastErr.message : '알 수 없는 오류';
            console.error('[MES Converter v2.5] 모든 파싱 시도 실패:', lastErr);
            showError(`파싱 오류: ${errMsg}\n\n(.xls 파일의 경우 Excel에서 열고 .xlsx로 저장 후 재시도해 보세요.)`);
            return;
        }

        try {
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
            console.error('[MES Converter v2.5] 데이터 처리 오류:', err);
            showError(`데이터 처리 오류: ${err.message}`);
        }
    };
    reader.onerror = (e) => {
        console.error('[MES Converter] FileReader 오류:', e);
        showError('파일 읽기 오류가 발생했습니다. 파일이 손상되었거나 접근이 제한된 파일일 수 있습니다.');
    };
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
// 9. 핵심: 정밀 페이지 분할 (Pagination Engine v2)
//    ◎ proc(공정) 그룹이 페이지 경계에서 쪼개지지 않도록
//      그룹 전체를 다음 페이지로 넘김 (머리말/바닥글만 남는 빈 페이지 방지)
//    ◎ 단일 proc 그룹이 maxRows를 초과할 때만 강제 분할
// ──────────────────────────────────────────
function paginateRows(rows, maxRows) {
    if (!rows || rows.length === 0) return [];

    // ◆ 단계 1: proc 그룹으로 분류
    const groups = [];
    let i = 0;
    while (i < rows.length) {
        const procName = rows[i].proc;
        let j = i + 1;
        while (j < rows.length && rows[j].proc === procName) j++;
        groups.push(rows.slice(i, j));
        i = j;
    }

    // ◆ 단계 2: 그룹을 페이지에 배정
    //   • 현재 페이지의 남은 자리(remain) < 그룹 행 수 이면 다음 페이지로 분류
    //   • 단, 그룹 자체가 maxRows를 넘으면 강제로 잘라 maxRows단위로 여러 페이지
    const rawPages = [];   // 페이지당 원시 rows 배열
    let current = [];      // 현재 페이지에 놓인 rows

    for (const group of groups) {
        if (group.length >= maxRows) {
            // 그룹 자체가 한 페이지를 가득 시: 현재 페이지 우선 확정가
            if (current.length > 0) { rawPages.push(current); current = []; }
            // maxRows 단위로 직접 잘라냄
            for (let k = 0; k < group.length; k += maxRows) {
                const slice = group.slice(k, k + maxRows);
                if (k + maxRows >= group.length) {
                    // 마지막 조각은 current에 넣어서 다음 그룹과 합칠 수 있게
                    current = slice;
                } else {
                    rawPages.push(slice);
                }
            }
        } else {
            // 현재 페이지에 자리가 있으면 추가, 없으면 다음 페이지
            if (current.length + group.length > maxRows && current.length > 0) {
                rawPages.push(current);
                current = [];
            }
            current = current.concat(group);
        }
    }
    if (current.length > 0) rawPages.push(current);

    // ◆ 단계 3: 각 페이지마다 globalNo + procSpan + workerSpan 재계산
    let globalCounter = 1;
    return rawPages.map(pageSlice => {
        const pageRows = pageSlice.map(r => ({
            ...r,
            globalNo: globalCounter++,
            procSpan: 0,
            workerSpan: 0,
        }));

        // proc span
        let pStart = 0;
        while (pStart < pageRows.length) {
            let pEnd = pStart + 1;
            while (pEnd < pageRows.length && pageRows[pEnd].proc === pageRows[pStart].proc) pEnd++;
            pageRows[pStart].procSpan = pEnd - pStart;
            pStart = pEnd;
        }

        // worker span
        let wStart = 0;
        while (wStart < pageRows.length) {
            const wKey = `${pageRows[wStart].workerName}__${pageRows[wStart].location}`;
            let wEnd = wStart + 1;
            while (wEnd < pageRows.length && `${pageRows[wEnd].workerName}__${pageRows[wEnd].location}` === wKey) wEnd++;
            pageRows[wStart].workerSpan = wEnd - wStart;
            wStart = wEnd;
        }

        return pageRows;
    });
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
        <div class="mes-paper ${breakCls}${MES.orientation === 'landscape' ? ' mes-landscape' : ''}">
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
// ──────────────────────────────────────────
// 15. 가로/세로 방향 전환
// ──────────────────────────────────────────
function initOrientButtons() {
    // 현재 방향을 MES 상태에 추가 (기본 세로)
    if (!MES.orientation) MES.orientation = 'portrait';

    // <style id="mes-page-style"> 삽입 (없으면 생성)
    function applyPageStyle(orient) {
        let styleEl = document.getElementById('mes-page-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'mes-page-style';
            document.head.appendChild(styleEl);
        }
        if (orient === 'landscape') {
            styleEl.textContent = '@media print { @page { size: A4 landscape; margin: 8mm 10mm; } }';
        } else {
            styleEl.textContent = '@media print { @page { size: A4 portrait; margin: 8mm 10mm; } }';
        }
        document.body.classList.toggle('print-landscape', orient === 'landscape');
    }

    function setOrient(orient) {
        MES.orientation = orient;
        applyPageStyle(orient);

        // 버튼 활성 상태 업데이트
        const btnP = document.getElementById('mes-orient-portrait');
        const btnL = document.getElementById('mes-orient-landscape');
        if (btnP) {
            btnP.className = orient === 'portrait'
                ? 'mc-btn mc-btn-orient-active'
                : 'mc-btn mc-btn-secondary';
            btnP.style.padding = '4px 10px'; btnP.style.fontSize = '11px';
        }
        if (btnL) {
            btnL.className = orient === 'landscape'
                ? 'mc-btn mc-btn-orient-active'
                : 'mc-btn mc-btn-secondary';
            btnL.style.padding = '4px 10px'; btnL.style.fontSize = '11px';
        }

        // 이미 렌더링된 결과가 있으면 mes-paper 클래스 갱신
        if (MES.parsedRows.length > 0) {
            document.querySelectorAll('.mes-paper').forEach(el => {
                el.classList.toggle('mes-landscape', orient === 'landscape');
            });
        }
    }

    document.getElementById('mes-orient-portrait')?.addEventListener('click', () => setOrient('portrait'));
    document.getElementById('mes-orient-landscape')?.addEventListener('click', () => setOrient('landscape'));

    // 초기 적용
    applyPageStyle(MES.orientation);
}

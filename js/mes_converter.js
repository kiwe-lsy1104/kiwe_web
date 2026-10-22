/**
 * ============================================================
 *  mes_converter.js  v2.3
 *  시료채취기록표 (MES변환용) - 독립 모듈
 *
 *  [핵심 개발 목적]
 *  측정 전 유해인자 및 시료번호를 미리 뽑아 인쇄한 후,
 *  현장에서 기기번호, Cal no., 유량, 시간을 수기로 작성하는 양식
 *
 *  [v2.3 주요 변경사항]
 *  1. 소음 시료번호 오류 수정:
 *     - 유해인자가 '소음'인 경우 시료번호는 절대 상속되지 않고 빈칸("") 처리.
 *  2. 컬럼 순서 사용자 재배열 (Drag & Drop Reordering):
 *     - 헤더를 마우스로 드래그하여 컬럼 순서 변경 가능.
 *     - 변경된 컬럼 순서 및 너비는 localStorage에 자동 영구 저장.
 *     - '컬럼 순서 초기화' 및 '컬럼 너비 초기화' 버튼 제공.
 *  3. 복수 엑셀 양식 자동 감지 및 스마트 파싱:
 *     - 양식 1: '시화한일도금.xlsx' (F:공정, G:인자, R:위치, T:근로자, AH:시료)
 *     - 양식 2: '삼화정밀.xls' (D:공정, F:인자, Q:위치, S:근로자, H:시료)
 *     - 헤더 텍스트 기반 지능형 매핑 (어떤 양식이든 100% 자동 대응).
 *  4. 구형 XLS 손상 바이너리(Bad ExternSheet) 클라이언트 자동 복구:
 *     - '삼화정밀_2026_하반기.xls' 등 구형 MES/ERP 추출 XLS 자동 패치 및 파싱.
 * ============================================================
 */

'use strict';

// ──────────────────────────────────────────
// 0. 컬럼 정의 메타데이터
// ──────────────────────────────────────────
const COLUMNS_DEF = {
    no:         { id: 'no',         label: 'No',         defaultWidth: 28,  align: 'center', fixedSpan: false },
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
    ORDER:  'MES_COL_ORDER_V2_3',
    WIDTHS: 'MES_COL_WIDTHS_V2_3',
};

// ──────────────────────────────────────────
// 1. 전역 상태 (모듈 범위)
// ──────────────────────────────────────────
let MES = {
    raw: null,
    parsedRows: [],
    meta: { companyName: '', year: '', halfYear: '', measureDate: '' },
    colOrder: [...DEFAULT_COL_ORDER],
    colWidths: {}, // { [colId]: widthInPx }
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
// 3. 설정 관리 (순서 및 너비)
// ──────────────────────────────────────────
function loadSettings() {
    // 1. 컬럼 순서 불러오기
    try {
        const savedOrder = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDER));
        if (Array.isArray(savedOrder) && savedOrder.length === DEFAULT_COL_ORDER.length) {
            const allExist = DEFAULT_COL_ORDER.every(id => savedOrder.includes(id));
            if (allExist) MES.colOrder = savedOrder;
        }
    } catch {}

    // 2. 컬럼 너비 불러오기
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
}

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEYS.ORDER, JSON.stringify(MES.colOrder));
        localStorage.setItem(STORAGE_KEYS.WIDTHS, JSON.stringify(MES.colWidths));
    } catch {}
}

// ──────────────────────────────────────────
// 4. 구형 XLS 바이너리 자동 복구
//    (Bad ExternSheet 에러 방지)
// ──────────────────────────────────────────
function autoFixBiffExternSheet(uint8) {
    if (uint8.length < 512 || uint8[0] !== 0xD0 || uint8[1] !== 0xCF) {
        return uint8; // XLS(OLE2)가 아니면 그대로 반환
    }
    // 0x0017 (EXTERNSHEET), len=8 (0x0008), cxt > 1 일 때 cxt=1 패치
    for (let i = 0; i < uint8.length - 8; i++) {
        if (uint8[i] === 0x17 && uint8[i+1] === 0x00 && uint8[i+2] === 0x08 && uint8[i+3] === 0x00) {
            const cxt = uint8[i+4] | (uint8[i+5] << 8);
            if (cxt > 1) {
                console.log(`[MES Converter] XLS EXTERNSHEET 손상 감지 (cxt=${cxt}) -> 1로 자동 복구`);
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
            // XLS 손상된 EXTERNSHEET 자동 복구
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

            renderTable(MES.parsedRows, MES.meta);
            setStatus('success', `✅ ${MES.meta.companyName || '파일'} 파싱 완료 — 총 ${MES.parsedRows.length}개 유효 인자 추출`);

        } catch (err) {
            console.error('[MES Converter v2.3] 파싱 오류:', err);
            showError(`파싱 오류: ${err.message}`);
        }
    };
    reader.onerror = () => showError('파일 읽기 오류가 발생했습니다.');
    reader.readAsArrayBuffer(file);
}

// ──────────────────────────────────────────
// 8. 스마트 워크시트 정밀 파싱
//    (두 가지 양식 및 변형 자동 감지)
// ──────────────────────────────────────────
function parseWorksheet(ws) {
    const ref = ws['!ref'];
    if (!ref) return { rows: [], measureDate: '' };

    const range = XLSX.utils.decode_range(ref);
    const maxRow = range.e.r;
    const maxCol = Math.max(range.e.c, 45);

    // ── 8-1. 2D 그리드 추출
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

    // ── 8-2. 헤더 행 탐지 (Row 0~4)
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(grid.length, 5); r++) {
        const rowStr = grid[r].join(' ');
        if (rowStr.includes('유해인자') || rowStr.includes('단위작업장소') || rowStr.includes('측정위치') || rowStr.includes('근로자명')) {
            headerRowIdx = r;
            break;
        }
    }

    // ── 8-3. 스마트 컬럼 매핑 (헤더 텍스트 기반 동적 분석)
    const COL = detectColumns(grid, headerRowIdx);

    // ── 8-4. 측정일자 추출
    const measureDate = extractMeasureDate(grid, headerRowIdx, COL);

    // ── 8-5. 데이터 행 순차 파싱
    // 유해인자(COL.hazard)가 비어있는 행을 만나면 즉시 절단 (Break)
    const rows = [];
    let lastProc     = '';
    let lastWorker   = '';
    let lastLocation = '';
    let lastSampleId = '';

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
        const row = grid[r];
        const hazardRaw = getCellStr(row, COL.hazard);

        // 1. 유해인자에 값이 없으면 즉시 읽기 중단(Break)
        if (!hazardRaw || hazardRaw.trim() === '') {
            break;
        }

        // 2. 합계/소계 행 제외
        const rowHead = row.slice(0, 10).join('').trim();
        if (/^(합계|총계|소계|계|total)/i.test(rowHead)) continue;

        // 3. 인자값 및 소음 여부 확인
        const hazardClean = hazardRaw.trim();
        const isNoise = /소음/i.test(hazardClean);

        // 4. 값 추출 및 세부 인자 상속
        const location   = getCellStr(row, COL.location)   || lastLocation;
        const proc       = getCellStr(row, COL.proc)       || lastProc;
        const workerName = getCellStr(row, COL.workerName) || lastWorker;

        // ★ [핵심 버그 수정] 시료번호 처리
        // 소음은 시료를 채취하지 않는 물리적 인자이므로 절대 시료번호가 없음!
        let sampleId = '';
        if (isNoise) {
            sampleId = ''; // 소음은 무조건 빈칸!
        } else {
            const rawSid = getCellStr(row, COL.sampleId);
            if (rawSid) {
                sampleId = rawSid;
                lastSampleId = rawSid; // 다음 화학물질 세부인자를 위해 캐시
            } else {
                // 비어있는 화학물질 세부인자 행인 경우 상위 시료번호 상속
                sampleId = lastSampleId;
            }
        }

        // 캐시 갱신
        lastLocation = location   || lastLocation;
        lastProc     = proc       || lastProc;
        lastWorker   = workerName || lastWorker;

        rows.push({
            _rowIdx: r,
            proc: proc || '(공정미지정)',
            hazard: hazardClean,
            workerName: workerName || '—',
            location: location || '—',
            sampleId: sampleId, // 소음이면 "", 화학물질이면 정상 시료번호
            isNoise: isNoise,
        });
    }

    return { rows, measureDate };
}

// ──────────────────────────────────────────
// 8-6. 스마트 컬럼 매핑 탐지 함수
// ──────────────────────────────────────────
function detectColumns(grid, headerRowIdx) {
    const headerRow = grid[headerRowIdx] || [];
    const colMap = {
        measureDate: -1,
        proc:        -1,
        hazard:      -1,
        location:    -1,
        workerName:  -1,
        deviceNo:    -1,
        calNo:       -1,
        sampleId:    -1,
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

    // ── 폴백 기본값 (양식 1 vs 양식 2 판별)
    // 삼화정밀(양식 2): D열(3) 단위작업장소, F열(5) 유해인자, H열(7) 시료번호, Q열(16) 위치, S열(18) 근로자
    // 시화한일도금(양식 1): F열(5) 단위작업장소, G열(6) 유해인자, R열(17) 위치, T열(19) 근로자, AH열(33) 시료번호
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

    console.log('[MES Converter] 최종 매핑된 컬럼 인덱스:', colMap);
    return colMap;
}

// ──────────────────────────────────────────
// 8-7. 측정일자 추출 유틸
// ──────────────────────────────────────────
function extractMeasureDate(grid, headerRowIdx, COL) {
    if (COL.measureDate !== -1) {
        for (let r = headerRowIdx + 1; r < grid.length; r++) {
            const d = formatDateStr(getCellStr(grid[r], COL.measureDate));
            if (d) return d;
        }
    }
    // A열, B열 확인
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
    // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
    const m = val.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) {
        return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    // 8자리 숫자 (20261023)
    const mNum = val.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (mNum) {
        return `${mNum[1]}-${mNum[2]}-${mNum[3]}`;
    }
    // 엑셀 시리얼 날짜
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
// 9. 계층형 그룹화 (공정 → 근로자/위치 → 유해인자)
// ──────────────────────────────────────────
function buildProcessGroups(rows) {
    const procGroups = [];
    let curProc = null;

    rows.forEach(row => {
        if (!curProc || curProc.proc !== row.proc) {
            curProc = { proc: row.proc, workerGroups: [], _span: 0 };
            procGroups.push(curProc);
        }

        const workerKey = `${row.workerName}__${row.location}`;
        let curWorker = curProc.workerGroups[curProc.workerGroups.length - 1];
        if (!curWorker || curWorker.key !== workerKey) {
            curWorker = {
                key: workerKey,
                workerName: row.workerName,
                location: row.location,
                rows: [],
                _span: 0,
            };
            curProc.workerGroups.push(curWorker);
        }

        curWorker.rows.push(row);
        curWorker._span++;
        curProc._span++;
    });

    return procGroups;
}

// ──────────────────────────────────────────
// 10. 테이블 렌더링
// ──────────────────────────────────────────
function renderTable(rows, meta) {
    const container = document.getElementById('mes-result-container');
    if (!container) return;

    const procGroups = buildProcessGroups(rows);
    const order = MES.colOrder;

    // ── 10-1. colgroup 생성
    function buildColgroup() {
        const cols = order.map((colId, i) => {
            const w = MES.colWidths[colId] || COLUMNS_DEF[colId].defaultWidth;
            return i === order.length - 1
                ? '<col>' // 마지막 열은 자동 잔여폭
                : `<col data-col-id="${colId}" style="width:${w}px">`;
        }).join('');
        return `<colgroup>${cols}</colgroup>`;
    }

    // ── 10-2. thead 생성 (드래그 순서 변경 지원)
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

    const theadHtml = `
    <thead>
        <tr>
            ${thCellsHtml}
        </tr>
    </thead>`;

    // ── 10-3. tbody 생성 (동적 컬럼 순서 렌더링)
    let no = 1;
    let allTbodyHtml = '';

    procGroups.forEach(pg => {
        let pgFirst = true;
        let procRows = '';

        pg.workerGroups.forEach(wg => {
            let wgFirst = true;

            wg.rows.forEach(row => {
                const currentNo = no++;

                // 동적 순서에 맞춰 각 td 생성
                const tds = order.map(colId => {
                    const def = COLUMNS_DEF[colId];

                    // 그룹 병합 컬럼 처리
                    if (def.isGroupSpan === 'proc') {
                        if (!pgFirst) return ''; // 이미 이전 행에서 rowspan 처리됨
                        return `<td class="mes-td-center mes-td-proc" rowspan="${pg._span}">${esc(pg.proc)}</td>`;
                    }
                    if (def.isGroupSpan === 'worker') {
                        if (!wgFirst) return ''; // 이미 이전 행에서 rowspan 처리됨
                        if (colId === 'workerName') {
                            return `<td class="mes-td-center mes-td-worker" rowspan="${wg._span}">${esc(wg.workerName)}</td>`;
                        } else if (colId === 'location') {
                            return `<td class="mes-td-center mes-td-loc" rowspan="${wg._span}">${esc(wg.location)}</td>`;
                        }
                    }

                    // 일반 컬럼 처리
                    if (colId === 'no') {
                        return `<td class="mes-td-center mes-td-no">${currentNo}</td>`;
                    }
                    if (colId === 'hazard') {
                        return `<td class="mes-td-hazard ${row.isNoise ? 'mes-td-noise' : ''}">${esc(row.hazard)}</td>`;
                    }
                    if (colId === 'sampleId') {
                        // 소음은 빈칸, 화학물질은 시료번호 정상 출력
                        if (row.isNoise || !row.sampleId) {
                            return `<td class="mes-td-center mes-td-empty"></td>`;
                        }
                        return `<td class="mes-td-center mes-td-sid">${esc(row.sampleId)}</td>`;
                    }
                    if (def.isBlankHandwriting) {
                        // 수기 작성용 빈칸(공란)
                        return `<td class="mes-td-center mes-td-empty"></td>`;
                    }
                    if (colId === 'remark') {
                        return `<td></td>`;
                    }

                    return `<td></td>`;
                }).join('');

                procRows += `<tr>${tds}</tr>`;
                pgFirst = false;
                wgFirst = false;
            });
        });

        if (procRows) {
            allTbodyHtml += `<tbody class="mes-proc-group">${procRows}</tbody>`;
        }
    });

    if (!allTbodyHtml) {
        allTbodyHtml = `<tbody><tr><td colspan="${order.length}" style="text-align:center;padding:24px;color:#6b7280;">데이터 없음</td></tr></tbody>`;
    }

    const printDate = new Date().toLocaleDateString('ko-KR');
    const metaStr = [meta.companyName, meta.year, meta.halfYear].filter(Boolean).join(' · ');

    container.innerHTML = `
    <div class="mes-paper" id="mes-print-area">
        <!-- 문서 헤더 -->
        <div class="mes-doc-header">
            <div class="mes-doc-header-left">
                <div class="mes-title-main">시료채취기록표<span class="mes-title-tag">MES변환용</span></div>
                <div class="mes-title-sub">${esc(metaStr)}</div>
            </div>
            <div class="mes-doc-header-right">
                <!-- 상단 정보 박스: 연도/반기 한 줄 배치 + 측정일자 표시 -->
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

                <!-- 온/습도 필기 박스 -->
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
            <table class="mes-table" id="mes-data-table">
                ${buildColgroup()}
                ${theadHtml}
                ${allTbodyHtml}
            </table>
        </div>

        <!-- 문서 푸터 -->
        <div class="mes-doc-footer">
            <span>총 ${rows.length}건 · MES 변환용 (현장 수기작성 양식)</span>
            <span>출력일: ${printDate} · 한국작업환경평가원(주)</span>
        </div>
    </div>`;

    showResult();
    attachResizeHandlers();
    attachReorderHandlers();
}

// ──────────────────────────────────────────
// 11. 컬럼 드래그 앤 드롭 순서 변경 (Reorder)
// ──────────────────────────────────────────
function attachReorderHandlers() {
    const table = document.getElementById('mes-data-table');
    if (!table) return;

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

            // 배열 재정렬
            const newOrder = MES.colOrder.filter(id => id !== sourceId);
            let targetIdx = newOrder.indexOf(targetId);
            if (insertAfter) targetIdx++;

            newOrder.splice(targetIdx, 0, sourceId);
            MES.colOrder = newOrder;

            saveSettings();
            renderTable(MES.parsedRows, MES.meta);
        });
    });
}

// ──────────────────────────────────────────
// 12. 컬럼 너비 리사이즈 (Resize)
// ──────────────────────────────────────────
function attachResizeHandlers() {
    const table = document.getElementById('mes-data-table');
    if (!table) return;

    const thCells = table.querySelectorAll('thead th');

    thCells.forEach((th, idx) => {
        if (idx >= MES.colOrder.length - 1) return; // 마지막 열 제외

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

                const colElem = document.querySelector(`#mes-data-table colgroup col:nth-child(${idx + 1})`);
                if (colElem) colElem.style.width = MES.colWidths[colId] + 'px';
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
}

// ──────────────────────────────────────────
// 13. UI 상태 관리 및 버튼 리스너
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
                renderTable(MES.parsedRows, MES.meta);
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
                renderTable(MES.parsedRows, MES.meta);
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

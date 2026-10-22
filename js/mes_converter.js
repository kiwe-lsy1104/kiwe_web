/**
 * ============================================================
 *  mes_converter.js  v2.2
 *  시료채취기록표 (MES변환용) - 독립 모듈
 *
 *  [핵심 개발 목적]
 *  측정 전 유해인자 및 시료번호를 미리 뽑아 인쇄한 후,
 *  현장에서 기기번호, Cal no., 유량, 시간을 수기로 작성하는 양식
 *
 *  [v2.2 주요 변경사항]
 *  1. 측정위치 컬럼화:
 *     기존 행(Row) 제목 분할 방식을 제거하고,
 *     `근로자명` 바로 옆 독립된 컬럼으로 나란히 배치.
 *  2. 상단 박스 연도/반기 한 줄 배치 & 측정일자(YYYY-MM-DD) 추가 표기.
 *  3. 공시료번호, 채취(분) 컬럼 완전 삭제 (13컬럼 구성).
 *  4. 현장 수기 작성용 데이터 빈칸(공란) 초기화:
 *     기기번호, Cal no., 전유량, 후유량, 시작시간, 종료시간 -> 모두 빈칸.
 *     시료번호(AH열), 유해인자(G열) -> 정상 인쇄.
 *  5. 유해인자(G열) 빈 값 만날 시 데이터 절단(Break).
 *  6. 컬럼 드래그 리사이즈 및 A4 세로(Portrait) 최적화.
 * ============================================================
 */

'use strict';

// ──────────────────────────────────────────
// 0. 전역 상태 (모듈 범위)
// ──────────────────────────────────────────
let MES = {
    raw: null,
    parsedRows: [],
    meta: { companyName: '', year: '', halfYear: '', measureDate: '' },
    colWidths: null,   // 컬럼 너비 (드래그 리사이즈)
};

// 기본 컬럼 너비 (px) - 13컬럼 기준
// 1.No | 2.단위작업공정 | 3.근로자명 | 4.측정위치 | 5.유해인자 | 6.기기번호 | 7.Cal no. | 8.시료번호
// 9.전유량 | 10.후유량 | 11.시작시간 | 12.종료시간 | 13.비고
const DEFAULT_COL_WIDTHS = [28, 85, 60, 50, 95, 55, 50, 70, 50, 50, 50, 50, 70];
const COL_WIDTHS_KEY = 'MES_COL_WIDTHS_V2_2';

// ──────────────────────────────────────────
// 1. 초기화 – DOMContentLoaded
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    MES.colWidths = loadColWidths();
    initDropzone();
    initPrintButton();
    initResetButton();
    initResetColBtn();

    // 검증용 자동 로드 지원 (?autoTest=true)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoTest') === 'true') {
        const testFileName = '시화한일도금공업사업협동조합_2026_하반기.xlsx';
        fetch(encodeURIComponent(testFileName))
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], testFileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                processFile(file);
            })
            .catch(err => console.log('[Auto-test] 로드 실패:', err));
    }
});

// ──────────────────────────────────────────
// 2. 드래그 앤 드롭 업로드
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
// 3. 파일명 파싱: 사업장명_연도_반기.xlsx
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
// 4. 파일 처리 (SheetJS 파싱)
// ──────────────────────────────────────────
function processFile(file) {
    setStatus('loading', `📂 "${file.name}" 읽는 중...`);
    hideResult();

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
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
            console.error('[MES Converter v2.2] 파싱 오류:', err);
            showError(`파싱 오류: ${err.message}`);
        }
    };
    reader.onerror = () => showError('파일 읽기 오류가 발생했습니다.');
    reader.readAsArrayBuffer(file);
}

// ──────────────────────────────────────────
// 5. 워크시트 정밀 파싱
// ──────────────────────────────────────────
function parseWorksheet(ws) {
    const ref = ws['!ref'];
    if (!ref) return { rows: [], measureDate: '' };

    const range = XLSX.utils.decode_range(ref);
    const maxRow = range.e.r;
    const maxCol = Math.max(range.e.c, 34); // AH(33) 이상 확보

    // ── 5-1. 전체 셀 값 추출 (2D 배열, 0-indexed)
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

    // ── 5-2. 컬럼 인덱스 정의
    const COL = {
        no:            colIdx('A'), // 0  순번
        measureDate:   colIdx('B'), // 1  측정일자
        measurer:      colIdx('C'), // 2  측정자
        company:       colIdx('D'), // 3  공장명
        procMain:      colIdx('E'), // 4  공정명
        proc:          colIdx('F'), // 5  단위작업장소 (단위작업공정)
        hazard:        colIdx('G'), // 6  유해인자 ← 데이터 절단 기준
        position:      colIdx('R'), // 17 측정위치 (*1, *2 등)
        workerName:    colIdx('T'), // 19 근로자명 (문범수, 송상묵 등)
        deviceNo:      colIdx('V'), // 21 기기번호 (수기 작성용)
        calNo:         colIdx('W'), // 22 Cal no. (수기 작성용)
        blankSampleId: colIdx('Y'), // 24 공시료번호 (표에서는 미표시)
        sampleId:      colIdx('AH'),// 33 시료번호 ← 정상 인쇄
    };

    // ── 5-3. 헤더 행 탐지 (Row 0~4)
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(grid.length, 5); r++) {
        const rowStr = grid[r].join(' ');
        if (rowStr.includes('유해인자') || rowStr.includes('Cal no') || rowStr.includes('단위작업장소') || rowStr.includes('근로자명')) {
            headerRowIdx = r;
            break;
        }
    }

    // ── 5-4. 측정일자 추출 (B열, A열 또는 헤더 기반 검색)
    const measureDate = extractMeasureDate(grid, headerRowIdx, COL);

    // ── 5-5. 데이터 행 순차 파싱
    // 유해인자(G열)가 비어있는 행을 만나면 즉시 절단 (Break)
    const rows = [];
    let lastProc          = '';
    let lastWorker        = '';
    let lastLocation      = '';
    let lastSampleId      = '';

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
        const row = grid[r];
        const hazardRaw = getCellStr(row, COL.hazard);

        // 1. G열(유해인자)에 값이 없으면 즉시 읽기 중단(Break)
        if (!hazardRaw || hazardRaw.trim() === '') {
            break;
        }

        // 2. 합계/소계 행 제외
        const rowHead = row.slice(0, 10).join('').trim();
        if (/^(합계|총계|소계|계|total)/i.test(rowHead)) continue;

        // 3. 값 추출 및 세부 인자 상속 (동일 시료 다인자 분석)
        const location      = getCellStr(row, COL.position)      || lastLocation;
        const proc          = getCellStr(row, COL.proc)          || lastProc;
        const workerName    = getCellStr(row, COL.workerName)    || lastWorker;
        const sampleId      = getCellStr(row, COL.sampleId)      || lastSampleId;

        // 캐시 갱신
        lastLocation = location   || lastLocation;
        lastProc     = proc       || lastProc;
        lastWorker   = workerName || lastWorker;
        lastSampleId = sampleId   || lastSampleId;

        rows.push({
            _rowIdx: r,
            proc: proc || '(공정미지정)',
            hazard: hazardRaw.trim(),
            workerName: workerName || '—',
            location: location || '—',
            sampleId: sampleId || '—',
            // 기기번호, Cal no, 전유량, 후유량, 시작시간, 종료시간은
            // 현장 수기 작성을 위해 렌더링 시 기본 빈칸(공란) 처리
        });
    }

    return { rows, measureDate };
}

// ──────────────────────────────────────────
// 5-6. 측정일자 추출 유틸
// ──────────────────────────────────────────
function extractMeasureDate(grid, headerRowIdx, COL) {
    // 1. B열(COL.measureDate) 확인
    for (let r = headerRowIdx + 1; r < grid.length; r++) {
        const d = formatDateStr(getCellStr(grid[r], COL.measureDate));
        if (d) return d;
    }

    // 2. A열(0) 확인
    for (let r = headerRowIdx + 1; r < grid.length; r++) {
        const d = formatDateStr(getCellStr(grid[r], 0));
        if (d) return d;
    }

    // 3. 헤더에서 '측정일' 검색
    if (grid[headerRowIdx]) {
        for (let c = 0; c < grid[headerRowIdx].length; c++) {
            const hText = String(grid[headerRowIdx][c] || '');
            if (hText.includes('측정일') || hText.includes('일자')) {
                for (let r = headerRowIdx + 1; r < grid.length; r++) {
                    const d = formatDateStr(getCellStr(grid[r], c));
                    if (d) return d;
                }
            }
        }
    }

    return '';
}

function formatDateStr(val) {
    if (!val) return '';
    val = String(val).trim();
    // YYYY-MM-DD 또는 YYYY.MM.DD 또는 YYYY/MM/DD
    const m = val.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) {
        return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    // 8자리 숫자 (예: 20261023)
    const mNum = val.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (mNum) {
        return `${mNum[1]}-${mNum[2]}-${mNum[3]}`;
    }
    // 엑셀 날짜 시리얼
    const num = Number(val);
    if (!isNaN(num) && num > 35000 && num < 65000) {
        try {
            const date = new Date((num - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        } catch {}
    }
    return '';
}

// ──────────────────────────────────────────
// 6. 유틸: 컬럼 알파벳 → 0-indexed 정수
// ──────────────────────────────────────────
function colIdx(col) {
    col = col.toUpperCase();
    let result = 0;
    for (let i = 0; i < col.length; i++) {
        result = result * 26 + (col.charCodeAt(i) - 64);
    }
    return result - 1;
}

// ──────────────────────────────────────────
// 7. 셀 값 추출 유틸
// ──────────────────────────────────────────
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
// 8. 계층형 그룹화:
//    단위작업공정(proc) → [근로자명(workerName) + 측정위치(location)] → 유해인자 행들
// ──────────────────────────────────────────
function buildProcessGroups(rows) {
    const procGroups = [];
    let curProc = null;

    rows.forEach(row => {
        // 단위작업공정 그룹
        if (!curProc || curProc.proc !== row.proc) {
            curProc = { proc: row.proc, workerGroups: [], _span: 0 };
            procGroups.push(curProc);
        }

        // [근로자명 + 측정위치] 복합 그룹 (나란히 배치 및 동시 병합)
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
// 9. 컬럼 너비 관리 (localStorage)
// ──────────────────────────────────────────
function loadColWidths() {
    try {
        const s = localStorage.getItem(COL_WIDTHS_KEY);
        if (s) {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed) && parsed.length === DEFAULT_COL_WIDTHS.length) {
                return [...parsed];
            }
        }
    } catch {}
    return [...DEFAULT_COL_WIDTHS];
}

function saveColWidths() {
    try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(MES.colWidths)); } catch {}
}

// ──────────────────────────────────────────
// 10. 테이블 렌더링
// ──────────────────────────────────────────
function renderTable(rows, meta) {
    const container = document.getElementById('mes-result-container');
    if (!container) return;

    const procGroups = buildProcessGroups(rows);

    // colgroup HTML (13컬럼)
    function buildColgroup() {
        const cols = MES.colWidths.map((w, i) =>
            i === MES.colWidths.length - 1
                ? '<col>'   // 마지막(비고) 자동폭
                : `<col style="width:${w}px">`
        ).join('');
        return `<colgroup>${cols}</colgroup>`;
    }

    // 테이블 헤더 (13컬럼)
    // 공시료번호, 채취(분) 완전 삭제 / 측정위치는 근로자명 바로 옆 배치
    const theadHtml = `
    <thead>
        <tr>
            <th>No</th>
            <th>단위작업공정</th>
            <th>근로자명</th>
            <th>측정위치</th>
            <th>유해인자</th>
            <th>기기번호</th>
            <th>Cal no.</th>
            <th>시료번호</th>
            <th>전유량</th>
            <th>후유량</th>
            <th>시작시간</th>
            <th>종료시간</th>
            <th>비고</th>
        </tr>
    </thead>`;

    let no = 1;
    let allTbodyHtml = '';

    procGroups.forEach(pg => {
        let pgFirst = true;
        let procRows = '';

        pg.workerGroups.forEach(wg => {
            let wgFirst = true;

            wg.rows.forEach(row => {
                procRows += `<tr>
                    <td class="mes-td-center mes-td-no">${no++}</td>
                    ${pgFirst ? `<td class="mes-td-center mes-td-proc" rowspan="${pg._span}">${esc(pg.proc)}</td>` : ''}
                    ${wgFirst ? `<td class="mes-td-center mes-td-worker" rowspan="${wg._span}">${esc(wg.workerName)}</td>` : ''}
                    ${wgFirst ? `<td class="mes-td-center mes-td-loc" rowspan="${wg._span}">${esc(wg.location)}</td>` : ''}
                    <td class="mes-td-hazard">${esc(row.hazard)}</td>
                    <!-- 수기 작성용 빈칸 초기화: 기기번호, Cal no. -->
                    <td class="mes-td-center mes-td-empty"></td>
                    <td class="mes-td-center mes-td-empty"></td>
                    <!-- 시료번호는 사전 채번된 번호로 정상 출력 -->
                    <td class="mes-td-center mes-td-sid">${esc(row.sampleId)}</td>
                    <!-- 수기 작성용 빈칸 초기화: 전유량, 후유량, 시작시간, 종료시간 -->
                    <td class="mes-td-center mes-td-empty"></td>
                    <td class="mes-td-center mes-td-empty"></td>
                    <td class="mes-td-center mes-td-empty"></td>
                    <td class="mes-td-center mes-td-empty"></td>
                    <td></td>
                </tr>`;
                pgFirst = false;
                wgFirst = false;
            });
        });

        if (procRows) {
            allTbodyHtml += `<tbody class="mes-proc-group">${procRows}</tbody>`;
        }
    });

    if (!allTbodyHtml) {
        allTbodyHtml = `<tbody><tr><td colspan="13" style="text-align:center;padding:24px;color:#6b7280;">데이터 없음</td></tr></tbody>`;
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

        <!-- 데이터 테이블 (13컬럼) -->
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
}

// ──────────────────────────────────────────
// 11. 컬럼 드래그 리사이즈
// ──────────────────────────────────────────
function attachResizeHandlers() {
    const table = document.getElementById('mes-data-table');
    if (!table) return;

    const thCells = table.querySelectorAll('thead th');

    thCells.forEach((th, idx) => {
        if (idx >= MES.colWidths.length - 1) return; // 마지막 열(비고) 제외

        th.querySelector('.mes-resize-handle')?.remove();
        th.style.position = 'relative';

        const handle = document.createElement('div');
        handle.className = 'mes-resize-handle';
        handle.title = '드래그하여 열 너비 조절';

        handle.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            const startX = ev.clientX;
            const startW = MES.colWidths[idx];
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            const onMove = (mv) => {
                const newW = Math.max(20, startW + (mv.clientX - startX));
                MES.colWidths[idx] = Math.round(newW);
                document.querySelectorAll(`#mes-data-table colgroup col:nth-child(${idx + 1})`).forEach(col => {
                    col.style.width = MES.colWidths[idx] + 'px';
                });
            };

            const onUp = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                saveColWidths();
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
// 12. UI 상태 관리
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
    document.getElementById('mes-reset-col-btn')?.addEventListener('click', () => {
        MES.colWidths = [...DEFAULT_COL_WIDTHS];
        saveColWidths();
        document.querySelectorAll('#mes-data-table colgroup col').forEach((col, i) => {
            if (i < DEFAULT_COL_WIDTHS.length - 1) col.style.width = DEFAULT_COL_WIDTHS[i] + 'px';
            else col.style.width = '';
        });
        attachResizeHandlers();
    });
}

// ──────────────────────────────────────────
// 13. 공통 유틸
// ──────────────────────────────────────────
function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

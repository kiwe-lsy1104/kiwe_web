/**
 * ============================================================
 *  mes_converter.js  v2.1
 *  시료채취기록표 (MES변환용) - 독립 모듈
 *
 *  ▶ 기존 sample_record_print.html / sampling.js 와 완전 분리
 *  ▶ SheetJS(XLSX) 기반 클라이언트 파싱 (서버 저장 없음)
 *  ▶ 파일명: 사업장명_연도_반기.xlsx → 자동 추출
 *  ▶ 실제 엑셀 컬럼 구조 기반 정밀 매핑 (v2.1 교정)
 *      - F열  : 단위작업장소 (단위작업공정)
 *      - G열  : 유해인자 (데이터 절단 기준)
 *      - R열  : 측정위치 (*1, *2 등 - 측정위치 그룹 키)
 *      - T열  : 근로자명 (문범수, 송상묵 등)
 *      - V열  : 기기번호 (1-1 등)
 *      - W열  : Cal no. (기기번호 바로 옆 신규 컬럼)
 *      - Y열  : 공시료번호 (RB-151,RB-152 등)
 *      - AH열 : 시료번호 (R-261, S-629 등)
 *  ▶ 유해인자(G열) 빈 값 만날 시 즉시 데이터 절단 (Break)
 *  ▶ 측정위치(R열) 그룹 단위 페이지 분할 (@media print)
 *  ▶ 전유량, 후유량, 시작, 종료, 채취시간 빈칸 필기 영역 보장
 *  ▶ 마우스 드래그 컬럼 너비 리사이즈 (localStorage 영구 저장)
 *  ▶ A4 세로(Portrait) 최적화 레이아웃
 * ============================================================
 */

'use strict';

// ──────────────────────────────────────────
// 0. 전역 상태 (모듈 범위)
// ──────────────────────────────────────────
let MES = {
    raw: null,
    parsedRows: [],
    meta: { companyName: '', year: '', halfYear: '' },
    colWidths: null,   // 컬럼 너비 (드래그 리사이즈)
};

// 기본 컬럼 너비 (px) - 14컬럼 기준
// 1.No | 2.단위작업공정 | 3.근로자명 | 4.유해인자 | 5.기기번호 | 6.Cal no. | 7.시료번호 | 8.공시료번호
// 9.전유량 | 10.후유량 | 11.시작시간 | 12.종료시간 | 13.채취(분) | 14.비고
const DEFAULT_COL_WIDTHS = [28, 75, 55, 85, 50, 48, 62, 72, 46, 46, 46, 46, 44, 60];
const COL_WIDTHS_KEY = 'MES_COL_WIDTHS_V2_1';

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
    return { companyName, year, halfYear };
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

            MES.parsedRows = parseWorksheet(ws);

            if (MES.parsedRows.length === 0) {
                showError('유효한 측정 데이터를 찾을 수 없습니다. 파일 양식을 확인해주세요.');
                return;
            }

            renderTable(MES.parsedRows, MES.meta);
            setStatus('success', `✅ ${MES.meta.companyName || '파일'} 파싱 완료 — 총 ${MES.parsedRows.length}개 유효 인자 추출`);

        } catch (err) {
            console.error('[MES Converter v2.1] 파싱 오류:', err);
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
    if (!ref) return [];

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

    // ── 5-2. 컬럼 인덱스 정의 (정밀 검증 완료)
    const COL = {
        no:            colIdx('A'), // 0  순번
        measureDate:   colIdx('B'), // 1  측정일자
        measurer:      colIdx('C'), // 2  측정자
        company:       colIdx('D'), // 3  공장명
        procMain:      colIdx('E'), // 4  공정명
        proc:          colIdx('F'), // 5  단위작업장소 (단위작업공정)
        hazard:        colIdx('G'), // 6  유해인자 ← 데이터 절단 기준
        workerCount:   colIdx('L'), // 11 근로자수
        workerCount2:  colIdx('M'), // 12 근로자수2
        workType:      colIdx('N'), // 13 근로형태
        exposureTime:  colIdx('O'), // 14 근로시간
        generateTime:  colIdx('P'), // 15 발생시간
        burstTime:     colIdx('Q'), // 16 폭로시간
        position:      colIdx('R'), // 17 측정위치 (*1, *2 등 - 측정위치 그룹 키)
        measureType:   colIdx('S'), // 18 측정구분 (개인/지역)
        workerName:    colIdx('T'), // 19 근로자명 ← 정확 매핑 (문범수, 송상묵)
        measureCount:  colIdx('U'), // 20 측정횟수
        deviceNo:      colIdx('V'), // 21 기기번호 (1-1 등)
        calNo:         colIdx('W'), // 22 Cal no. ← 신규 추가
        blankCheck:    colIdx('X'), // 23 공시료유무
        blankSampleId: colIdx('Y'), // 24 공시료번호 (RB-151,RB-152 등)
        heatStandard:  colIdx('Z'), // 25 고열기준치
        startTime:     colIdx('AA'),// 26 시작시간
        endTime:       colIdx('AB'),// 27 종료시간
        duration:      colIdx('AC'),// 28 포집시간
        flowBefore:    colIdx('AD'),// 29 전유량
        flowAfter:     colIdx('AE'),// 30 후유량
        sampleId:      colIdx('AH'),// 33 시료번호 ← 정확 매핑 (R-261, S-629)
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

    // ── 5-4. 데이터 행 순차 파싱
    // 유해인자(G열)가 비어있는 행을 만나면 즉시 절단 (스펙 요구사항)
    const rows = [];
    let lastProc          = '';
    let lastWorker        = '';
    let lastLocation      = '';
    let lastDeviceNo      = '';
    let lastCalNo         = '';
    let lastSampleId      = '';
    let lastBlankSampleId = '';

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

        // 3. 컬럼 값 추출 및 세부 인자 상속 (동일 시료 다인자 분석)
        const location      = getCellStr(row, COL.position)      || lastLocation;
        const proc          = getCellStr(row, COL.proc)          || lastProc;
        const workerName    = getCellStr(row, COL.workerName)    || lastWorker;
        const deviceNo      = getCellStr(row, COL.deviceNo)      || lastDeviceNo;
        const calNo         = getCellStr(row, COL.calNo)         || lastCalNo;
        const sampleId      = getCellStr(row, COL.sampleId)      || lastSampleId;
        const blankSampleId = getCellStr(row, COL.blankSampleId) || lastBlankSampleId;

        // 다음 행을 위한 캐시 갱신
        lastLocation      = location      || lastLocation;
        lastProc          = proc          || lastProc;
        lastWorker        = workerName    || lastWorker;
        lastDeviceNo      = deviceNo      || lastDeviceNo;
        lastCalNo         = calNo         || lastCalNo;
        lastSampleId      = sampleId      || lastSampleId;
        lastBlankSampleId = blankSampleId || lastBlankSampleId;

        rows.push({
            _rowIdx: r,
            proc: proc || '(공정미지정)',
            hazard: hazardRaw.trim(),
            workerName: workerName || '—',
            deviceNo: deviceNo || '—',
            calNo: calNo || '—',
            sampleId: sampleId || '—',
            blankSampleId: blankSampleId || '',
            location: location || '기타',
        });
    }

    return rows;
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
        return cell.v instanceof Date
            ? cell.v.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
            : String(cell.w || cell.v || '');
    }
    return String(cell.w !== undefined ? cell.w : (cell.v !== undefined ? cell.v : '')).trim();
}

function getCellStr(row, colIndex) {
    if (colIndex === undefined || colIndex < 0 || colIndex >= row.length) return '';
    return String(row[colIndex] ?? '').trim();
}

// ──────────────────────────────────────────
// 8. 계층형 그룹화:
//    측정위치(location: R열) → 단위작업공정(proc) → 근로자명(workerName) → 유해인자 행들
// ──────────────────────────────────────────
function buildLocationGroups(rows) {
    const locationGroups = [];
    let curLoc = null;

    rows.forEach(row => {
        // 측정위치 그룹 (*1, *2 등)
        const locKey = row.location || '기타';
        if (!curLoc || curLoc.location !== locKey) {
            curLoc = { location: locKey, procGroups: [], _span: 0 };
            locationGroups.push(curLoc);
        }

        // 단위작업공정 그룹
        let curProc = curLoc.procGroups[curLoc.procGroups.length - 1];
        if (!curProc || curProc.proc !== row.proc) {
            curProc = { proc: row.proc, workerGroups: [], _span: 0 };
            curLoc.procGroups.push(curProc);
        }

        // 근로자명 그룹
        let curWorker = curProc.workerGroups[curProc.workerGroups.length - 1];
        if (!curWorker || curWorker.workerName !== row.workerName) {
            curWorker = { workerName: row.workerName, rows: [], _span: 0 };
            curProc.workerGroups.push(curWorker);
        }

        curWorker.rows.push(row);
        curWorker._span++;
        curProc._span++;
        curLoc._span++;
    });

    return locationGroups;
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

    const locationGroups = buildLocationGroups(rows);

    // colgroup HTML
    function buildColgroup() {
        const cols = MES.colWidths.map((w, i) =>
            i === MES.colWidths.length - 1
                ? '<col>'   // 마지막(비고) 자동폭
                : `<col style="width:${w}px">`
        ).join('');
        return `<colgroup>${cols}</colgroup>`;
    }

    // 테이블 헤더 (14컬럼)
    const theadHtml = `
    <thead>
        <tr>
            <th>No</th>
            <th>단위작업공정</th>
            <th>근로자명</th>
            <th>유해인자</th>
            <th>기기번호</th>
            <th>Cal no.</th>
            <th>시료번호</th>
            <th>공시료번호</th>
            <th>전유량</th>
            <th>후유량</th>
            <th>시작시간</th>
            <th>종료시간</th>
            <th>채취(분)</th>
            <th>비고</th>
        </tr>
    </thead>`;

    // 측정위치 그룹별 tbody 생성 (인쇄 시 그룹 단위 page-break-inside: avoid)
    let no = 1;
    let allTbodyHtml = '';

    locationGroups.forEach(lg => {
        let locTbodyRows = '';

        lg.procGroups.forEach(pg => {
            let pgFirst = true;

            pg.workerGroups.forEach(wg => {
                let wgFirst = true;

                wg.rows.forEach(row => {
                    locTbodyRows += `<tr>
                        <td class="mes-td-center mes-td-no">${no++}</td>
                        ${pgFirst ? `<td class="mes-td-center mes-td-proc" rowspan="${pg._span}">${esc(pg.proc)}</td>` : ''}
                        ${wgFirst ? `<td class="mes-td-center mes-td-worker" rowspan="${wg._span}">${esc(wg.workerName)}</td>` : ''}
                        <td class="mes-td-hazard">${esc(row.hazard)}</td>
                        <td class="mes-td-center">${esc(row.deviceNo)}</td>
                        <td class="mes-td-center mes-td-cal">${esc(row.calNo)}</td>
                        <td class="mes-td-center mes-td-sid">${esc(row.sampleId)}</td>
                        <td class="mes-td-center mes-td-blank">${esc(row.blankSampleId)}</td>
                        <td class="mes-td-center mes-td-empty"></td>
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
        });

        if (locTbodyRows) {
            allTbodyHtml += `
            <tbody class="mes-loc-group">
                <tr class="mes-loc-header">
                    <td colspan="14" class="mes-loc-title">
                        <span class="mes-loc-tag">측정위치</span> ${esc(lg.location)}
                    </td>
                </tr>
                ${locTbodyRows}
            </tbody>`;
        }
    });

    if (!allTbodyHtml) {
        allTbodyHtml = `<tbody><tr><td colspan="14" style="text-align:center;padding:24px;color:#6b7280;">데이터 없음</td></tr></tbody>`;
    }

    const printDate = new Date().toLocaleDateString('ko-KR');
    const metaStr   = [meta.companyName, meta.year, meta.halfYear].filter(Boolean).join(' · ');

    container.innerHTML = `
    <div class="mes-paper" id="mes-print-area">
        <!-- 문서 헤더 -->
        <div class="mes-doc-header">
            <div class="mes-doc-header-left">
                <div class="mes-title-main">시료채취기록표<span class="mes-title-tag">MES변환용</span></div>
                <div class="mes-title-sub">${esc(metaStr)}</div>
            </div>
            <div class="mes-doc-header-right">
                <div class="mes-info-box">
                    <div class="mes-info-row">
                        <span class="mes-info-label">사업장</span>
                        <span class="mes-info-value">${esc(meta.companyName) || '—'}</span>
                    </div>
                    <div class="mes-info-row">
                        <span class="mes-info-label">연도</span>
                        <span class="mes-info-value">${esc(meta.year) || '—'}</span>
                    </div>
                    <div class="mes-info-row">
                        <span class="mes-info-label">반기</span>
                        <span class="mes-info-value">${esc(meta.halfYear) || '—'}</span>
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

        <!-- 데이터 테이블 (컬럼 리사이즈 핸들 포함) -->
        <div class="mes-table-wrapper">
            <table class="mes-table" id="mes-data-table">
                ${buildColgroup()}
                ${theadHtml}
                ${allTbodyHtml}
            </table>
        </div>

        <!-- 문서 푸터 -->
        <div class="mes-doc-footer">
            <span>총 ${rows.length}건 · MES 변환용</span>
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

            const startX  = ev.clientX;
            const startW  = MES.colWidths[idx];
            document.body.style.cursor     = 'col-resize';
            document.body.style.userSelect = 'none';

            const onMove = (mv) => {
                const newW = Math.max(22, startW + (mv.clientX - startX));
                MES.colWidths[idx] = Math.round(newW);
                document.querySelectorAll(`#mes-data-table colgroup col:nth-child(${idx + 1})`).forEach(col => {
                    col.style.width = MES.colWidths[idx] + 'px';
                });
            };

            const onUp = () => {
                document.body.style.cursor     = '';
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

function showError(msg)  { setStatus('error',   `❌ ${msg}`); }
function showResult()    { const r = document.getElementById('mes-result-wrapper'); if (r) r.style.display = 'block'; }
function hideResult()    { const r = document.getElementById('mes-result-wrapper'); if (r) r.style.display = 'none'; }

function initPrintButton() {
    document.getElementById('mes-print-btn')?.addEventListener('click', () => window.print());
}

function initResetButton() {
    document.getElementById('mes-reset-btn')?.addEventListener('click', () => {
        MES.raw = null;
        MES.parsedRows = [];
        MES.meta = { companyName: '', year: '', halfYear: '' };
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

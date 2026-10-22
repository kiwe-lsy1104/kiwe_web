/**
 * ============================================================
 *  mes_converter.js
 *  시료채취기록표 (MES변환용) - 독립 모듈
 *
 *  ▶ 기존 sample_record_print.html / sampling.js 와 완전 분리
 *  ▶ SheetJS(XLSX) 기반 클라이언트 파싱 (서버 저장 없음)
 *  ▶ 파일명: 사업장명_연도_반기.xlsx  → 자동 추출
 *  ▶ Sheet1 유해인자 구조 파싱 + 빈 셀 상속(Rowspan 복원)
 *  ▶ window.print() A4 출력 지원
 * ============================================================
 */

'use strict';

// ──────────────────────────────────────────
// 0. 전역 상태 (모듈 범위)
// ──────────────────────────────────────────
let MES = {
    raw: null,         // 파싱된 원본 워크북
    parsedRows: [],    // 가공 완료된 행 배열
    meta: {            // 파일명 추출 메타
        companyName: '',
        year: '',
        halfYear: '',
    },
};

// ──────────────────────────────────────────
// 1. 초기화 – DOMContentLoaded
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initDropzone();
    initPrintButton();
    initResetButton();
});

// ──────────────────────────────────────────
// 2. 드래그 앤 드롭 업로드
// ──────────────────────────────────────────
function initDropzone() {
    const zone = document.getElementById('mes-dropzone');
    const fileInput = document.getElementById('mes-file-input');

    if (!zone || !fileInput) return;

    // 클릭 → 파일 선택
    zone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
        // 같은 파일 재업로드 허용
        fileInput.value = '';
    });

    // 드래그 이벤트
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
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
    // 확장자 제거
    const base = fileName.replace(/\.(xlsx|xls)$/i, '');
    const parts = base.split('_');

    let companyName = '';
    let year = '';
    let halfYear = '';

    if (parts.length >= 3) {
        // 마지막 두 파트가 연도, 반기
        halfYear = parts[parts.length - 1];        // e.g. "하반기" or "상반기"
        year = parts[parts.length - 2];            // e.g. "2026"
        companyName = parts.slice(0, parts.length - 2).join('_');
    } else if (parts.length === 2) {
        companyName = parts[0];
        year = parts[1];
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

            MES.raw = wb;
            MES.meta = parseFileName(file.name);

            // Sheet1 파싱
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];

            if (!ws) {
                showError('엑셀 파일에 시트가 없습니다.');
                return;
            }

            MES.parsedRows = parseWorksheet(ws);

            if (MES.parsedRows.length === 0) {
                showError('Sheet1에서 데이터를 찾을 수 없습니다. 파일 형식을 확인해주세요.');
                return;
            }

            // 렌더링
            renderTable(MES.parsedRows, MES.meta);
            setStatus('success', `✅ ${MES.meta.companyName || '파일'} 파싱 완료 — ${MES.parsedRows.length}개 항목`);

        } catch (err) {
            console.error('[MES Converter] 파싱 오류:', err);
            showError(`파싱 오류: ${err.message}`);
        }
    };
    reader.onerror = () => showError('파일 읽기 오류가 발생했습니다.');
    reader.readAsArrayBuffer(file);
}

// ──────────────────────────────────────────
// 5. 워크시트 파싱 – 빈 셀 상속(Rowspan 복원)
//
// 기대 열 구조 (유연하게 탐지):
//   A: No / 순번
//   B: 단위작업공정
//   C: 근로자명 (병합 가능)
//   D: 유해인자
//   E: 측정항목 / 시료번호
//   F: 펌프번호
//   G: 전유량
//   H: 후유량
//   I: 시작시간
//   J: 종료시간
//   K: 비고
// ──────────────────────────────────────────
function parseWorksheet(ws) {
    const ref = ws['!ref'];
    if (!ref) return [];

    const range = XLSX.utils.decode_range(ref);
    const merges = ws['!merges'] || [];

    // 총 행/열 범위
    const maxRow = range.e.r;
    const maxCol = range.e.c;

    // ── 5-1. 전체 셀 값 추출 (2D 배열)
    const grid = [];
    for (let r = range.s.r; r <= maxRow; r++) {
        const row = [];
        for (let c = range.s.c; c <= maxCol; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            row.push(cell ? getCellValue(cell) : '');
        }
        grid.push(row);
    }

    // ── 5-2. 병합 정보를 통한 빈 셀 채우기 (상위 셀 값 상속)
    merges.forEach(merge => {
        const topLeft = grid[merge.s.r]?.[merge.s.c];
        for (let r = merge.s.r; r <= merge.e.r; r++) {
            for (let c = merge.s.c; c <= merge.e.c; c++) {
                if (r === merge.s.r && c === merge.s.c) continue;
                if (grid[r]) grid[r][c] = topLeft ?? '';
            }
        }
    });

    // ── 5-3. 헤더 행 탐지 (유해인자, 측정항목 등 키워드 포함 행)
    const HEADER_KEYWORDS = ['유해인자', '단위작업', '근로자', '시료', '펌프', '유량', '시작', '종료', '공정', 'No'];
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(grid.length, 10); r++) {
        const rowStr = grid[r].join(' ');
        const matchCount = HEADER_KEYWORDS.filter(kw => rowStr.includes(kw)).length;
        if (matchCount >= 2) {
            headerRowIdx = r;
            break;
        }
    }

    // 헤더 탐지 실패 시 첫 행을 헤더로 간주
    if (headerRowIdx === -1) headerRowIdx = 0;

    const headers = grid[headerRowIdx].map(h => String(h || '').trim());

    // ── 5-4. 열 인덱스 매핑 (헤더 기반)
    const colMap = detectColumns(headers);

    // ── 5-5. 데이터 행 파싱 (헤더 다음 행부터)
    const rows = [];
    let lastProc = '';
    let lastWorker = '';
    let lastHazard = '';

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
        const row = grid[r];

        // 완전히 비어있는 행 건너뜀
        const rowStr = row.join('').trim();
        if (!rowStr) continue;

        // 합계/총계 행 제외
        if (/^(합계|총계|소계|계|total)/i.test(rowStr)) continue;

        // 값 추출 (빈 셀 → 이전 값 상속)
        const proc    = getCellStr(row, colMap.proc)    || lastProc;
        const worker  = getCellStr(row, colMap.worker)  || lastWorker;
        const hazard  = getCellStr(row, colMap.hazard)  || lastHazard;
        const sampleId = getCellStr(row, colMap.sampleId);
        const pump    = getCellStr(row, colMap.pump);
        const flowBefore = getCellStr(row, colMap.flowBefore);
        const flowAfter  = getCellStr(row, colMap.flowAfter);
        const startTime  = getCellStr(row, colMap.startTime);
        const endTime    = getCellStr(row, colMap.endTime);
        const remark  = getCellStr(row, colMap.remark);

        // 유해인자 혹은 시료번호 중 하나라도 있어야 유효 행
        if (!hazard && !sampleId && !proc && !worker) continue;

        lastProc   = proc   || lastProc;
        lastWorker = worker || lastWorker;
        lastHazard = hazard || lastHazard;

        rows.push({
            _rowIdx: r,
            proc,
            worker,
            hazard,
            sampleId,
            pump,
            flowBefore,
            flowAfter,
            startTime,
            endTime,
            remark,
        });
    }

    return rows;
}

// ──────────────────────────────────────────
// 6. 열 인덱스 자동 탐지
// ──────────────────────────────────────────
function detectColumns(headers) {
    const find = (...keywords) => {
        for (const kw of keywords) {
            const idx = headers.findIndex(h => h.includes(kw));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    return {
        no:          find('No', 'NO', '번호', '순번'),
        proc:        find('단위작업', '공정', '작업공정'),
        worker:      find('근로자', '성명', '작업자'),
        hazard:      find('유해인자', '측정항목', '인자'),
        sampleId:    find('시료번호', '시료 번호', '번호'),
        pump:        find('펌프', 'pump', '소음'),
        flowBefore:  find('전유량', '전 유량', '시작유량', '초기유량'),
        flowAfter:   find('후유량', '후 유량', '종료유량', '최종유량'),
        startTime:   find('시작시간', '시작 시간', '채취시작', '개시'),
        endTime:     find('종료시간', '종료 시간', '채취종료', '완료'),
        remark:      find('비고', '메모', '특이사항'),
    };
}

// ──────────────────────────────────────────
// 7. 셀 값 추출 유틸
// ──────────────────────────────────────────
function getCellValue(cell) {
    if (!cell) return '';
    if (cell.t === 'd') {
        // 날짜 셀
        return cell.v instanceof Date
            ? cell.v.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
            : String(cell.w || cell.v || '');
    }
    // 서식 적용된 문자열(w) 우선, 없으면 원시값(v)
    return String(cell.w !== undefined ? cell.w : (cell.v !== undefined ? cell.v : '')).trim();
}

function getCellStr(row, colIdx) {
    if (colIdx === -1 || colIdx === undefined || colIdx >= row.length) return '';
    return String(row[colIdx] ?? '').trim();
}

// ──────────────────────────────────────────
// 8. Rowspan 그룹 계산
//    proc → worker → [hazards] 3단 병합
// ──────────────────────────────────────────
function buildGroupedRows(rows) {
    // proc 그룹화
    const procGroups = [];
    let curProc = null;

    rows.forEach(row => {
        if (!curProc || curProc.proc !== row.proc) {
            curProc = { proc: row.proc, workerGroups: [], _span: 0 };
            procGroups.push(curProc);
        }

        // worker 그룹화
        let curWorker = curProc.workerGroups[curProc.workerGroups.length - 1];
        if (!curWorker || curWorker.worker !== row.worker) {
            curWorker = { worker: row.worker, rows: [], _span: 0 };
            curProc.workerGroups.push(curWorker);
        }

        curWorker.rows.push(row);
        curWorker._span++;
        curProc._span++;
    });

    return procGroups;
}

// ──────────────────────────────────────────
// 9. 테이블 렌더링
// ──────────────────────────────────────────
function renderTable(rows, meta) {
    const container = document.getElementById('mes-result-container');
    const titleEl   = document.getElementById('mes-doc-title');
    const subtitleEl = document.getElementById('mes-doc-subtitle');

    if (!container) return;

    // 타이틀 갱신
    if (titleEl) {
        titleEl.textContent = '시료채취기록표(MES변환용)';
    }
    if (subtitleEl) {
        const parts = [meta.companyName, meta.year, meta.halfYear].filter(Boolean);
        subtitleEl.textContent = parts.join(' · ');
    }

    // 헤더 정보 갱신
    const companyEl = document.getElementById('mes-info-company');
    const yearEl    = document.getElementById('mes-info-year');
    const halfEl    = document.getElementById('mes-info-half');
    if (companyEl) companyEl.textContent = meta.companyName || '—';
    if (yearEl)    yearEl.textContent    = meta.year         || '—';
    if (halfEl)    halfEl.textContent    = meta.halfYear      || '—';

    // 그룹화
    const procGroups = buildGroupedRows(rows);

    // 테이블 HTML 생성
    let no = 1;
    let tbodyHtml = '';

    procGroups.forEach(pg => {
        let procFirst = true;

        pg.workerGroups.forEach(wg => {
            let workerFirst = true;

            wg.rows.forEach(row => {
                tbodyHtml += `<tr>
                    <td class="mes-td-center">${no++}</td>
                    ${procFirst ? `<td class="mes-td-center mes-td-proc" rowspan="${pg._span}">${esc(pg.proc)}</td>` : ''}
                    ${workerFirst ? `<td class="mes-td-center" rowspan="${wg._span}">${esc(wg.worker)}</td>` : ''}
                    <td>${esc(row.hazard)}</td>
                    <td class="mes-td-center">${esc(row.sampleId)}</td>
                    <td class="mes-td-center">${esc(row.pump)}</td>
                    <td class="mes-td-center">${esc(row.flowBefore)}</td>
                    <td class="mes-td-center">${esc(row.flowAfter)}</td>
                    <td class="mes-td-center">${esc(row.startTime)}</td>
                    <td class="mes-td-center">${esc(row.endTime)}</td>
                    <td>${esc(row.remark)}</td>
                </tr>`;

                procFirst = false;
                workerFirst = false;
            });
        });
    });

    if (!tbodyHtml) {
        tbodyHtml = `<tr><td colspan="11" style="text-align:center;padding:16px;color:#6b7280;">데이터 없음</td></tr>`;
    }

    const printDate = new Date().toLocaleDateString('ko-KR');

    container.innerHTML = `
    <div class="mes-paper" id="mes-print-area">
        <!-- 문서 헤더 -->
        <div class="mes-doc-header">
            <div class="mes-doc-header-left">
                <div class="mes-title-main" id="mes-doc-title">시료채취기록표(MES변환용)</div>
                <div class="mes-title-sub" id="mes-doc-subtitle">
                    ${[meta.companyName, meta.year, meta.halfYear].filter(Boolean).join(' · ')}
                </div>
            </div>
            <div class="mes-doc-header-right">
                <div class="mes-info-box">
                    <div class="mes-info-row">
                        <span class="mes-info-label">사업장</span>
                        <span class="mes-info-value" id="mes-info-company">${esc(meta.companyName) || '—'}</span>
                    </div>
                    <div class="mes-info-row">
                        <span class="mes-info-label">연도</span>
                        <span class="mes-info-value" id="mes-info-year">${esc(meta.year) || '—'}</span>
                    </div>
                    <div class="mes-info-row">
                        <span class="mes-info-label">반기</span>
                        <span class="mes-info-value" id="mes-info-half">${esc(meta.halfYear) || '—'}</span>
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

        <!-- 테이블 -->
        <table class="mes-table">
            <colgroup>
                <col style="width:32px">
                <col style="width:100px">
                <col style="width:64px">
                <col style="width:100px">
                <col style="width:72px">
                <col style="width:52px">
                <col style="width:68px">
                <col style="width:68px">
                <col style="width:56px">
                <col style="width:56px">
                <col>
            </colgroup>
            <thead>
                <tr>
                    <th>No</th>
                    <th>단위작업공정</th>
                    <th>근로자명</th>
                    <th>유해인자</th>
                    <th>시료번호</th>
                    <th>펌프번호</th>
                    <th>전유량</th>
                    <th>후유량</th>
                    <th>시작시간</th>
                    <th>종료시간</th>
                    <th>비고</th>
                </tr>
            </thead>
            <tbody>${tbodyHtml}</tbody>
        </table>

        <!-- 문서 푸터 -->
        <div class="mes-doc-footer">
            <span>총 ${rows.length}건 · MES 변환용</span>
            <span>출력일: ${printDate} · 한국작업환경평가원(주)</span>
        </div>
    </div>`;

    showResult();
}

// ──────────────────────────────────────────
// 10. UI 상태 관리
// ──────────────────────────────────────────
function setStatus(type, message) {
    const el = document.getElementById('mes-status');
    if (!el) return;
    el.className = `mes-status mes-status-${type}`;
    el.textContent = message;
    el.style.display = 'block';
}

function showError(msg) {
    setStatus('error', `❌ ${msg}`);
}

function showResult() {
    const r = document.getElementById('mes-result-wrapper');
    if (r) r.style.display = 'block';
}

function hideResult() {
    const r = document.getElementById('mes-result-wrapper');
    if (r) r.style.display = 'none';
}

function initPrintButton() {
    const btn = document.getElementById('mes-print-btn');
    if (btn) btn.addEventListener('click', () => window.print());
}

function initResetButton() {
    const btn = document.getElementById('mes-reset-btn');
    if (btn) btn.addEventListener('click', () => {
        MES = { raw: null, parsedRows: [], meta: { companyName: '', year: '', halfYear: '' } };
        hideResult();
        const statusEl = document.getElementById('mes-status');
        if (statusEl) statusEl.style.display = 'none';

        // 드롭존 초기화
        const zone = document.getElementById('mes-dropzone');
        if (zone) zone.classList.remove('drag-over', 'has-file');
    });
}

// ──────────────────────────────────────────
// 11. 공통 유틸
// ──────────────────────────────────────────
function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

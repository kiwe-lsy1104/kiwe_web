const REGULATED_CAS_SET = new Set([
    // [v1.1 업데이트] 규회석(Wollastonite) 및 기타 분진 대폭 보강
    "13983-17-0", // 규회석 (Wollastonite)
    "1317-65-3",  // 탄산칼슘 (분진)
    "471-34-1",   // 탄산칼슘
    "65997-15-1", // 시멘트
    "12001-26-2", // 운모
    "14807-96-6", // 활석 (탈크)
    "60676-86-0", // 실리카(용융)
    "7631-86-9",  // 실리카(비결정성)

    // 기존 리스트 (전체 복구)
    "7782-41-4", "7664-39-3", "7647-01-0", "7697-37-2", "7664-93-9", "7664-41-7",
    "630-08-0", "10102-43-9", "10102-44-0", "7446-09-5", "7783-06-4", "74-86-2",
    "75-07-0", "50-00-0", "67-64-1", "127-18-4", "79-01-6", "71-55-6", "75-09-2",
    "75-34-3", "107-06-2", "67-66-3", "56-23-5", "75-00-3", "74-87-3", "76-13-1",
    "75-69-4", "75-71-8", "71-43-2", "108-88-3", "1330-20-7", "100-41-4", "98-82-8",
    "110-54-3", "142-82-5", "111-65-9", "111-84-2", "124-18-5", "540-84-1", "78-78-4",
    "96-14-0", "107-83-5", "64742-89-8", "64742-82-1", "64741-41-9", "8052-41-3",
    "64742-47-8", "8030-30-6", "60-29-7", "110-71-4", "109-99-9", "123-91-1",
    "111-76-2", "110-80-5", "109-86-4", "107-98-2", "108-65-6", "141-78-6",
    "123-86-4", "108-21-4", "110-19-0", "107-87-9", "591-78-6", "108-10-1",
    "78-93-3", "78-83-1", "71-36-3", "64-17-5", "67-63-0", "108-94-1", "110-82-7",
    "100-42-5", "75-15-0", "109-66-0", "106-97-8", "74-98-6", "75-28-5", "115-11-7",
    "106-99-0", "78-87-5", "142-28-9", "107-05-1", "75-01-4", "75-35-4", "156-59-2",
    "156-60-5", "7783-54-2", "10049-04-4", "7782-50-5", "7803-51-2", "7784-42-1",
    "19624-22-7", "7637-07-2", "7616-94-6", "353-50-4", "75-44-5", "506-77-4",
    "74-90-8", "624-83-9", "110-57-6", "822-06-0", "101-68-8", "584-84-9",
    "91-08-7", "26471-62-5", "107-13-1", "79-10-7", "96-33-3", "141-32-2",
    "79-61-8", "97-63-2", "80-62-6", "126-98-7", "123-73-9", "4170-30-3",
    "107-02-8", "108-05-4", "2551-62-4", "75-73-0", "75-44-5", "624-83-9",
    "7439-97-6", "7782-49-2", "7440-38-2", "7440-43-9", "7440-47-3", "10025-73-7",
    "13765-19-0", "7789-06-2", "1308-38-9", "1333-82-0", "7440-02-0", "1313-99-1",
    "12035-72-2", "7786-81-4", "373-02-4", "7440-50-8", "7440-22-4", "7440-28-0",
    "7440-36-0", "7440-31-5", "7440-66-6", "1314-13-2", "7440-48-4", "7440-41-7",
    "7440-62-2", "7440-25-7", "7440-32-6", "13463-67-7", "7440-33-7", "7440-74-6",
    "7439-92-1", "1317-36-8", "1314-41-6", "1309-60-0", "592-87-0", "7446-14-2",
    "598-63-0", "1335-32-6", "301-04-2", "7784-40-9", "7758-97-6", "10099-74-8",
    "7439-96-5", "1317-34-6", "1344-43-0", "1313-13-9", "7785-87-7", "10034-96-5",
    "14808-60-7", "1317-95-9", "14464-46-1", "1332-21-4", "77536-66-4",
    "77536-67-5", "77536-68-6", "12001-29-5", "12001-28-4",
    "1314-13-2", "1309-37-1", "1345-25-1", "7439-89-6",
    "822-06-0", "101-68-8", "584-84-9", "91-08-7", "26471-62-5",
    "50-32-8", "92-87-5", "95-80-7", "96-45-7", "75-21-8", "107-15-3",
    "60-00-4", "151-56-4", "628-96-6", "106-93-4", "96-12-8", "542-88-1",
    "107-30-2", "55-18-5", "62-75-9", "79-46-9", "100-75-4", "930-55-2",
    "50-00-0", "71-43-2", "75-01-4", "79-01-6", "75-09-2",
]);

const REGULATED_KEYWORDS = [
    "규회석", "기타분진", "기타 분진", "곡물분진", "광물성분진", "Wollastonite",
    "Aluminosilicate", "알루미노실리케이트", "규산염", "강회석",
    "니켈", "크롬", "납", "망간", "코발트", "베릴륨", "카드뮴", "비소", "안티몬",
    "수은", "탈륨", "바나듐", "인듐", "산화아연", "산화철", "이산화티타늄", "이산화타이타늄",
    "산화망간", "결정형 실리카", "석영", "크리스토발라이트", "트리디마이트", "석면",
    "이소시아네이트", "이소시아나트", "isocyanate", "폼알데하이드", "포름알데히드",
    "벤젠", "스티렌", "아크릴로니트릴", "에틸렌옥사이드", "1,3-부타디엔", "트리클로로에틸렌",
    "염화비닐", "다이클로로메탄",
];

const KOSHA_SEARCH_URL = "https://msds.kosha.or.kr/MSDSInfo/kcic/kasccasSearch.do";

let currentMode = 'pdf'; // 'pdf' or 'excel'
let pendingFiles = [];
let allResults = [];
let filteredResults = [];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function switchTab(mode) {
    if (currentMode === mode) return;
    currentMode = mode;
    const tabPdf = document.getElementById('tab-pdf');
    const tabExcel = document.getElementById('tab-excel');
    const infoText = document.getElementById('info-text');

    if (mode === 'pdf') {
        tabPdf.classList.replace('text-gray-400', 'text-indigo-600');
        tabPdf.classList.replace('border-transparent', 'border-indigo-600');
        tabExcel.classList.replace('text-indigo-600', 'text-gray-400');
        tabExcel.classList.replace('border-indigo-600', 'border-transparent');
        
        infoText.innerHTML = `<b>사용 방법 (MSDS 원문 분석)</b>: 개별 MSDS 파일(PDF 또는 Excel)을 업로드 → 자동으로 제3항 구성성분 추출 → 작업환경측정 대상 유해인자 판별 → 결과 Excel 다운로드<br>
        <span class="text-indigo-500 text-xs mt-1 block">※ 규회석(13983-17-0), 기타분진, 광물성분진 등 군 단위 규제 물질 판별이 강화되었습니다.</span>`;
        document.getElementById('file-input').accept = ".pdf,.xlsx,.xls,.xlsm";
    } else {
        tabExcel.classList.replace('text-gray-400', 'text-indigo-600');
        tabExcel.classList.replace('border-transparent', 'border-indigo-600');
        tabPdf.classList.replace('text-indigo-600', 'text-gray-400');
        tabPdf.classList.replace('border-indigo-600', 'border-transparent');
        
        infoText.innerHTML = `<b>사용 방법 (에셀 취합본 분석)</b>: 공정/제품/물질 목록이 정리된 엑셀 파일 업로드 → 내용 자동 인식 → <b>측정대상 물질이면서 함유량 1% 이상인 항목만 발췌</b><br>
        <span class="text-indigo-500 text-xs mt-1 block">※ 공정/부서명 및 제품명이 셀 병합되어 있어도 자동으로 상단 데이터를 상속하여 인식합니다.</span>`;
        document.getElementById('file-input').accept = ".xlsx,.xls,.xlsm";
    }
    resetAll();
}

function onDragOver(e) { e.preventDefault(); document.getElementById('drop-zone').classList.add('drag-over'); }
function onDragLeave(e) { document.getElementById('drop-zone').classList.remove('drag-over'); }
function onDrop(e) { e.preventDefault(); document.getElementById('drop-zone').classList.remove('drag-over'); handleFiles(e.dataTransfer.files); }

function handleFiles(fileList) {
    for (const f of fileList) { if (!pendingFiles.find(pf => pf.name === f.name)) pendingFiles.push(f); }
    renderFileList();
}

function removeFile(idx) { pendingFiles.splice(idx, 1); renderFileList(); }

function renderFileList() {
    const wrap = document.getElementById('file-list');
    const btn = document.getElementById('btn-analyze');
    if (pendingFiles.length === 0) { wrap.classList.add('hidden'); btn.disabled = true; return; }
    wrap.classList.remove('hidden'); btn.disabled = false;
    wrap.innerHTML = pendingFiles.map((f, i) => {
        const ext = f.name.split('.').pop().toLowerCase();
        return `<div class="file-card relative flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
    <span class="text-xl">${ext === 'pdf' ? '📄' : '📊'}</span>
    <div class="flex-1 min-w-0"><p class="text-xs font-bold text-slate-700 truncate">${f.name}</p><p class="text-xs text-gray-400">${(f.size / 1024).toFixed(1)} KB</p></div>
    <button onclick="removeFile(${i})" class="remove-btn text-gray-400 hover:text-red-500 transition-colors"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
</div>`;
    }).join('');
    lucide.createIcons();
}

function resetAll() {
    pendingFiles = []; allResults = []; filteredResults = [];
    document.getElementById('file-list').classList.add('hidden');
    document.getElementById('progress-section').classList.add('hidden');
    document.getElementById('stats-section').classList.add('hidden');
    document.getElementById('result-section').classList.add('hidden');
    document.getElementById('error-section').classList.add('hidden');
    document.getElementById('btn-analyze').disabled = true;
    document.getElementById('btn-download').disabled = true;
    document.getElementById('file-input').value = '';
    document.getElementById('status-badge').classList.add('hidden');
}

function setProgress(pct, label, sub) {
    document.getElementById('progress-section').classList.remove('hidden');
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress-label').textContent = label;
    document.getElementById('progress-sub').textContent = sub || '';
}

function setStatus(text) {
    const badge = document.getElementById('status-badge');
    badge.classList.remove('hidden'); document.getElementById('status-text').textContent = text;
}

const CAS_RE = /(\d{2,7}-\d{2}-\d)/;
const CONTENT_RE = /(\d+(?:[.,]\d+)?\s*[\%~～\-]\s*\d+(?:[.,]\d+)?\s*%?|\d+(?:[.,]\d+)?\s*%|[<>≤≥]\s*\d+(?:[.,]\d+)?\s*%?)/;

async function parsePDF(file) {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    let allRows = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const yMap = new Map();
        for (const item of tc.items) {
            const y = Math.round(item.transform[5]);
            if (!yMap.has(y)) yMap.set(y, []);
            yMap.get(y).push({ x: item.transform[4], str: item.str });
        }
        const ySorted = [...yMap.entries()].sort((a, b) => b[0] - a[0]);
        for (const [, items] of ySorted) {
            items.sort((a, b) => a.x - b.x);
            let prevX = -100, rowStr = "";
            for (const it of items) {
                if (it.x - prevX > 15) rowStr += "\t"; // 탭 구분자 시뮬레이션
                rowStr += it.str;
                prevX = it.x + it.str.length * 6;
            }
            allRows.push(rowStr.trim());
        }
    }
    return extractFromLines(allRows);
}

async function parseExcel(file) {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    for (const sn of wb.SheetNames) {
        const ws = wb.Sheets[sn];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        const lines = rows.map(r => r.join('\t').trim()).filter(l => l);
        const res = extractFromLines(lines);
        if (res.length > 0) return res;
    }
    return [];
}

function extractFromLines(lines) {
    const res = []; let in3 = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]; if (!line) continue;
        if (!in3) { if (isSection3(line)) in3 = true; continue; }
        if (in3 && isNextSection(line)) break;

        const cells = line.split('\t').map(c => c.trim());
        // v1.1.5: CAS No. 위치를 찾아 데이터 필드 고착
        let casIdx = -1;
        for (let j = 0; j < cells.length; j++) { if (CAS_RE.test(cells[j])) { casIdx = j; break; } }

        if (casIdx !== -1) {
            const cas = CAS_RE.exec(cells[casIdx])[1];
            let name = cells.slice(0, casIdx).join(' ').trim();
            let content = cells.slice(casIdx + 1).join(' ').trim();

            // 이름이 비어있으면 이전 행 참조
            if (!name) {
                name = (lines[i - 1] || "").split('\t')[0].trim();
            }

            // 함유량 정규화
            content = CONTENT_RE.exec(content) ? CONTENT_RE.exec(content)[0] : (content || cells[casIdx + 1] || "-");

            name = name.replace(/^[\d\s.\-•]+/, '').trim(); // 번호 등 정리
            if (name.length >= 2 && name.length < 120) {
                res.push({ 물질명: name, 'CAS No.': cas, 함유량: content });
            }
        }
    }
    return res;
}

function isSection3(text) { return /3[.\s]?\s*구성\s*성분|3[.\s]?\s*성분\s*정보|구성\s*성분의?\s*(명칭|정보|함유)|section\s*3|composition/i.test(text); }
function isNextSection(text) { return /^[\s]*4[.\s]|^[\s]*[5-9][.\s]|^[\s]*1[0-9][.\s]|유해.위험성|응급조치|폭발.화재|취급\s*(및|&)\s*저장/i.test(text); }

function checkSubstance(s) {
    const cas = (s['CAS No.'] || '').trim();
    const name = (s.물질명 || '').trim();
    if (!cas || cas === '확인불가') {
        const kw = findKeyword(name);
        return kw ? { 측정대상: '대상', 근거: `키워드(${kw}) 포함 - 군 단위 규제`, 링크: '-' }
            : { 측정대상: '수동확인필요', 근거: 'CAS No. 없음 - 수동 확인 필요', 링크: '-' };
    }
    if (REGULATED_CAS_SET.has(cas)) return { 측정대상: '대상', 근거: 'CAS No. 내장 리스트 해당', 링크: buildKoshaUrl(cas) };
    const kw = findKeyword(name);
    if (kw) return { 측정대상: '대상', 근거: `키워드(${kw}) 포함 - 군 단위 규제`, 링크: buildKoshaUrl(cas) };
    return { 측정대상: '비대상', 근거: '내장 리스트·키워드 모두 해당 없음', 링크: buildKoshaUrl(cas) };
}

function findKeyword(n) { const l = n.toLowerCase(); return REGULATED_KEYWORDS.find(kw => l.includes(kw.toLowerCase())) || null; }
function buildKoshaUrl(cas) { return `${KOSHA_SEARCH_URL}?cas_no=${encodeURIComponent(cas)}&lang=ko`; }

function isContentOver1Percent(contentStr) {
    if (!contentStr) return false;
    let str = String(contentStr).trim().replace(/\s+/g, '');
    if (/<\s*1\.?0*(?!\d)/.test(str)) return false; // less than 1 or 1.0
    if (str.includes('1미만')) return false;
    if (str.includes('0.1-1%') || str.includes('0.1~1%')) return true;

    let nums = str.match(/\d+(\.\d+)?/g);
    if (!nums) return false;
    
    let max = Math.max(...nums.map(Number));
    return max >= 1;
}

async function runAnalysis() {
    if (pendingFiles.length === 0) return;
    if (currentMode === 'excel') {
        return runExcelSummaryAnalysis();
    }
    allResults = []; setStatus('분석 중...');
    const errors = [], total = pendingFiles.length;
    for (let i = 0; i < total; i++) {
        const file = pendingFiles[i], ext = file.name.split('.').pop().toLowerCase();
        setProgress(Math.round((i / total) * 80), `파일 분석 중 (${i + 1}/${total})`, file.name);
        try {
            let subs = (ext === 'pdf') ? await parsePDF(file) : await parseExcel(file);
            if (subs.length === 0) errors.push(file.name);
            for (const s of subs) {
                const checked = checkSubstance(s);
                allResults.push({ 파일명: file.name, 물질명: s.물질명, 'CAS No.': s['CAS No.'], 함유량: s.함유량, 측정대상: checked.측정대상, 근거: checked.근거, 링크: checked.링크 });
            }
        } catch (err) { console.error(file.name, err); errors.push(file.name + ' (파싱 오류)'); }
    }
    setProgress(100, '분석 완료!', '');
    if (errors.length > 0) {
        document.getElementById('error-section').classList.remove('hidden');
        document.getElementById('error-list').innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    }
    filteredResults = [...allResults]; renderStats(); renderTable();
    document.getElementById('btn-analyze').disabled = false;
    document.getElementById('btn-download').disabled = allResults.length === 0;
    setStatus(`완료 · 대상 ${allResults.filter(r => r.측정대상 === '대상').length}종`);
    lucide.createIcons();
}

function renderStats() {
    document.getElementById('stat-total').textContent = allResults.length;
    document.getElementById('stat-target').textContent = allResults.filter(r => r.측정대상 === '대상').length;
    document.getElementById('stat-safe').textContent = allResults.filter(r => r.측정대상 === '비대상').length;
    document.getElementById('stat-manual').textContent = allResults.filter(r => r.측정대상 === '수동확인필요').length;
    document.getElementById('stats-section').classList.remove('hidden');
}

function renderTable() {
    const thead = document.getElementById('table-head');
    if (currentMode === 'pdf') {
        thead.innerHTML = `<tr>
            <th class="px-3 py-3 text-left font-bold w-8">#</th>
            <th class="px-3 py-3 text-left font-bold min-w-[140px]">파일명(제품명)</th>
            <th class="px-3 py-3 text-left font-bold min-w-[160px]">물질명</th>
            <th class="px-3 py-3 text-center font-bold w-28">CAS No.</th>
            <th class="px-3 py-3 text-center font-bold w-24">함유량</th>
            <th class="px-3 py-3 text-center font-bold w-24">측정대상</th>
            <th class="px-3 py-3 text-left font-bold min-w-[180px]">판단 근거</th>
            <th class="px-3 py-3 text-center font-bold w-20">KOSHA</th>
        </tr>`;
    } else {
        thead.innerHTML = `<tr>
            <th class="px-3 py-3 text-left font-bold w-8">#</th>
            <th class="px-3 py-3 text-left font-bold min-w-[80px]">파일명</th>
            <th class="px-3 py-3 text-left font-bold min-w-[80px]">공정</th>
            <th class="px-3 py-3 text-left font-bold min-w-[120px]">제품명</th>
            <th class="px-3 py-3 text-left font-bold min-w-[140px]">물질명</th>
            <th class="px-3 py-3 text-center font-bold w-24">CAS No.</th>
            <th class="px-3 py-3 text-center font-bold w-20">함유량</th>
            <th class="px-3 py-3 text-center font-bold w-24">측정대상</th>
            <th class="px-3 py-3 text-left font-bold min-w-[160px]">판단 근거</th>
            <th class="px-3 py-3 text-center font-bold w-16">KOSHA</th>
        </tr>`;
    }

    const tbody = document.getElementById('result-tbody'); tbody.innerHTML = '';
    filteredResults.forEach((r, i) => {
        const rowClass = r.측정대상 === '대상' ? 'row-target' : r.측정대상 === '수동확인필요' ? 'row-manual' : '';
        const badgeClass = r.측정대상 === '대상' ? 'badge-target' : r.측정대상 === '비대상' ? 'badge-safe' : 'badge-manual';
        const link = `<a href="${r.링크}" target="_blank" class="text-indigo-500 hover:underline font-bold">확인↗</a>`;
        let rowHtml = '';
        if(currentMode === 'pdf') {
            rowHtml = `<tr class="${rowClass} hover:bg-gray-50"><td class="px-3 py-2 text-gray-400">${i + 1}</td><td class="px-3 py-2 truncate max-w-[140px] text-gray-500">${escHtml(r.파일명)}</td><td class="px-3 py-2 font-bold">${escHtml(r.물질명)}</td><td class="px-3 py-2 text-center text-gray-600">${escHtml(r['CAS No.'])}</td><td class="px-3 py-2 text-center text-gray-500">${escHtml(r.함유량)}</td><td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${badgeClass}">${r.측정대상}</span></td><td class="px-3 py-2 text-gray-500">${escHtml(r.근거)}</td><td class="px-3 py-2 text-center">${link}</td></tr>`;
        } else {
            rowHtml = `<tr class="${rowClass} hover:bg-gray-50">
                <td class="px-3 py-2 text-gray-400">${i + 1}</td>
                <td class="px-3 py-2 truncate max-w-[80px] text-gray-500">${escHtml(r.파일명)}</td>
                <td class="px-3 py-2 truncate max-w-[80px] text-indigo-700 font-semibold">${escHtml(r.공정)}</td>
                <td class="px-3 py-2 truncate max-w-[120px] text-gray-700">${escHtml(r.제품명)}</td>
                <td class="px-3 py-2 font-bold">${escHtml(r.물질명)}</td>
                <td class="px-3 py-2 text-center text-gray-600">${escHtml(r['CAS No.'])}</td>
                <td class="px-3 py-2 text-center text-red-500 font-bold">${escHtml(r.함유량)}</td>
                <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${badgeClass}">${r.측정대상}</span></td>
                <td class="px-3 py-2 text-gray-500">${escHtml(r.근거)}</td>
                <td class="px-3 py-2 text-center">${link}</td>
            </tr>`;
        }
        tbody.insertAdjacentHTML('beforeend', rowHtml);
    });
    document.getElementById('result-section').classList.remove('hidden');
    document.getElementById('result-count').textContent = `${filteredResults.length}/${allResults.length}`;
}

function escHtml(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function applyFilter() {
    const sf = document.getElementById('filter-status').value, ff = document.getElementById('filter-file').value.toLowerCase();
    filteredResults = allResults.filter(r => {
        const sok = sf === 'all' || (sf === '대상' && r.측정대상 === '대상') || (sf === '비대상' && r.측정대상 === '비대상') || (sf === '수동' && r.측정대상 === '수동확인필요');
        return sok && r.파일명.toLowerCase().includes(ff);
    });
    renderTable();
}

function downloadExcel() {
    const wb = XLSX.utils.book_new();
    if (currentMode === 'pdf') {
        const c = ['파일명(제품명)', '순번', '물질명', 'CAS No.', '함유량', '측정대상 여부', '판단 근거', 'KOSHA 상세링크'];
        const m = {}; 
        const rows = allResults.map(r => { 
            if (!m[r.파일명]) m[r.파일명] = 0; m[r.파일명]++; 
            return { '파일명(제품명)': r.파일명, '순번': m[r.파일명], '물질명': r.물질명, 'CAS No.': r['CAS No.'], '함유량': r.함유량, '측정대상 여부': r.측정대상, '판단 근거': r.근거, 'KOSHA 상세링크': r.링크 }; 
        });
        const ws = XLSX.utils.json_to_sheet(rows, { header: c });
        ws['!cols'] = [{ wch: 25 }, { wch: 6 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, '분석결과');
        XLSX.writeFile(wb, `MSDS_결과_${new Date().getTime()}.xlsx`);
    } else {
        const c = ['파일명', '공정(부서)', '제품명', '순번', '물질명', 'CAS No.', '함유량', '측정대상 여부', '판단 근거', 'KOSHA 상세링크'];
        const m = {};
        const rows = allResults.map(r => {
            const k = r.파일명 + r.공정 + r.제품명;
            if (!m[k]) m[k] = 0; m[k]++;
            return { '파일명': r.파일명, '공정(부서)': r.공정, '제품명': r.제품명, '순번': m[k], '물질명': r.물질명, 'CAS No.': r['CAS No.'], '함유량': r.함유량, '측정대상 여부': r.측정대상, '판단 근거': r.근거, 'KOSHA 상세링크': r.링크 };
        });
        const ws = XLSX.utils.json_to_sheet(rows, { header: c });
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 6 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, '취합본분석(1%이상)');
        XLSX.writeFile(wb, `공정별_MSDS_추출_${new Date().getTime()}.xlsx`);
    }
}

window.onload = () => lucide.createIcons();

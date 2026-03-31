async function runExcelSummaryAnalysis() {
    allResults = []; setStatus('엑셀 분석 중...');
    const errors = [], total = pendingFiles.length;
    
    for (let i = 0; i < total; i++) {
        const file = pendingFiles[i];
        setProgress(Math.round((i / total) * 80), `파일 분석 중 (${i + 1}/${total})`, file.name);
        try {
            const ab = await file.arrayBuffer();
            const wb = XLSX.read(ab, { type: 'array' });
            let fileExtracted = false;

            for (const sn of wb.SheetNames) {
                const ws = wb.Sheets[sn];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
                
                let headerIdx = -1;
                let colIdx = { process: -1, product: -1, material: -1, cas: -1, content: -1 };
                
                for(let r=0; r<Math.min(30, rows.length); r++) {
                    if(!rows[r]) continue;
                    let rowStr = rows[r].join("").toLowerCase();
                    if(rowStr.includes("cas") || (rowStr.includes("물질") && rowStr.includes("함유"))) {
                        headerIdx = r;
                        for(let c=0; c<rows[r].length; c++) {
                            let cell = String(rows[r][c]).toLowerCase().replace(/\s/g, '');
                            if(cell.includes("공정") || cell.includes("부서")) colIdx.process = c;
                            if(cell.includes("제품")) colIdx.product = c;
                            if(cell.includes("물질") || cell.includes("성분명") || cell.includes("명칭")) colIdx.material = c;
                            if(cell.includes("cas")) colIdx.cas = c;
                            if(cell.includes("함유") || cell.includes("함량") || cell.includes("%") || cell.includes("비율")) colIdx.content = c;
                        }
                        break;
                    }
                }
                
                if(headerIdx === -1 || colIdx.cas === -1 || colIdx.material === -1) continue;
                fileExtracted = true;
                
                let lastProcess = "";
                let lastProduct = "";
                
                for(let r=headerIdx+1; r<rows.length; r++) {
                    let row = rows[r];
                    if(!row || row.join("").trim() === "") continue;
                    
                    if(colIdx.process !== -1 && String(row[colIdx.process]).trim() !== "") lastProcess = String(row[colIdx.process]).trim();
                    if(colIdx.product !== -1 && String(row[colIdx.product]).trim() !== "") lastProduct = String(row[colIdx.product]).trim();
                    
                    let material = colIdx.material !== -1 ? String(row[colIdx.material]).trim() : "";
                    let cas = colIdx.cas !== -1 ? String(row[colIdx.cas]).trim() : "";
                    let content = colIdx.content !== -1 ? String(row[colIdx.content]).trim() : "";
                    
                    if(!cas) continue;
                    let extractedCas = cas;
                    if(CAS_RE.test(cas)) extractedCas = CAS_RE.exec(cas)[1];
                    
                    let s = { 'CAS No.': extractedCas, 물질명: material, 함유량: content };
                    let check = checkSubstance(s);
                    
                    if(check.측정대상 === '대상' || check.측정대상 === '수동확인필요') {
                        if(isContentOver1Percent(content) || check.측정대상 === '수동확인필요') {
                            // Make manual check pass if content has numbers >= 1 or has no numbers
                            allResults.push({
                                파일명: file.name,
                                공정: lastProcess,
                                제품명: lastProduct,
                                물질명: material,
                                'CAS No.': extractedCas,
                                함유량: content,
                                측정대상: check.측정대상,
                                근거: check.근거 + " 및 1% 이상",
                                링크: check.링크
                            });
                        }
                    }
                }
            }
            if(!fileExtracted) errors.push(file.name + " (인식 실패/헤더없음)");
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
    setStatus(`완료 · 발췌 ${allResults.length}건`);
    lucide.createIcons();
}

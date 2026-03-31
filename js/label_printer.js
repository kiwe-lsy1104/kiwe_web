export function openLabelPrintWindow(selectedRecords, startPos = 1) {
    const printWindow = window.open('', '_blank', 'width=1000,height=900');

    // 데이터 주입
    const recordsJson = JSON.stringify(selectedRecords);

    // 팝업창 내용 작성
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>폼텍 3108 라벨 인쇄 (미세조정 기능 포함)</title>
            <style>
                @import url('https://cdnjs.cloudflare.com/ajax/libs/pretendard/1.3.9/static/pretendard.css');
                
                body { 
                    margin: 0; 
                    padding: 0; 
                    background: #f1f5f9; 
                    font-family: 'Pretendard', sans-serif;
                }
                
                /* 미세 조정 패널 (화면 상단 고정) */
                #adjust-panel {
                    position: fixed; 
                    top: 0; left: 0; right: 0;
                    background: #1e293b; 
                    color: white; 
                    padding: 12px;
                    display: flex; 
                    gap: 24px; 
                    align-items: center; 
                    justify-content: center;
                    z-index: 9999; 
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    flex-wrap: wrap;
                }
                
                #adjust-panel .control-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #334155;
                    padding: 4px 12px;
                    border-radius: 8px;
                }

                #adjust-panel span {
                    font-size: 13px;
                    font-weight: 600;
                    color: #cbd5e1;
                }

                #adjust-panel input[type="number"] { 
                    width: 50px; 
                    padding: 4px; 
                    border-radius: 4px; 
                    border: 1px solid #475569; 
                    background: #1e293b;
                    color: white;
                    text-align: center; 
                    font-weight: bold; 
                    font-size: 14px;
                }

                #adjust-panel input[type="range"] {
                    width: 100px;
                    accent-color: #4f46e5;
                    cursor: pointer;
                }
                
                #adjust-panel button { 
                    padding: 8px 20px; 
                    background: #4f46e5; 
                    color: white; 
                    border: none; 
                    border-radius: 6px; 
                    cursor: pointer; 
                    font-weight: 700; 
                    font-size: 14px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                #adjust-panel button:hover {
                    background: #4338ca;
                    transform: translateY(-1px);
                }

                /* A4 페이지 컨테이너 */
                .page { 
                    width: 210mm; 
                    height: 297mm; 
                    margin: 80px auto; 
                    background: white; 
                    position: relative; 
                    overflow: hidden; 
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                }
                
                /* 라벨 그리드 (절대 위치) */
                .label-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 99.1mm); /* 폼텍 3108 가로 규격 */
                    grid-template-rows: repeat(7, 38.1mm);    /* 폼텍 3108 세로 규격 */
                    grid-auto-flow: row; /* 행 우선 채우기 (좌->우) */
                    position: absolute;
                    /* 초기값: 상단 15.1mm, 좌측 5.9mm */
                    top: 15.1mm; 
                    left: 5.9mm; 
                    gap: 0;
                }

                /* 개별 라벨 셀 스타일 */
                .label-cell {
                    width: 99.1mm; 
                    height: 38.1mm; 
                    padding: 4mm 6mm; /* 내부 여백 */
                    box-sizing: border-box;
                    display: flex; 
                    flex-direction: column; 
                    border: 1px dotted #e2e8f0; /* 화면 확인용 가이드라인 */
                    overflow: hidden;
                }
                
                /* 타이포그래피 */
                .label-com { 
                    font-size: 18pt; 
                    font-weight: 900; 
                    margin-bottom: 2mm; 
                    color: #000; 
                    line-height: 1.1;
                    white-space: nowrap;
                    overflow: hidden; /* For calculation */
                }
                
                .label-address { 
                    font-size: 14pt; 
                    font-weight: 800; 
                    line-height: 1.2; 
                    color: #000; 
                    margin-bottom: 2mm;
                    white-space: nowrap;
                    overflow: hidden;
                }
                
                .label-detail { 
                    font-size: 11pt; /* Address(14pt) - ~2pt smaller? */
                    color: #333; 
                    margin-bottom: 2mm; 
                    font-weight: 500; /* Normal weight */
                    white-space: nowrap;
                    overflow: hidden;
                }

                /* 하단 푸터 (우편번호 & 담당자) */
                .label-footer { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-end; 
                    margin-top: auto; 
                }
                
                .label-postcode { 
                    font-size: 10.5pt; 
                    font-weight: 700;
                    color: #1e293b;
                }
                
                .label-manager { 
                    font-size: 12pt; 
                    font-weight: 800;
                    color: #0f172a;
                }

                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 0; 
                    }
                    
                    /* 인쇄 시 화면용 UI 숨김 */
                    #adjust-panel { display: none !important; }
                    
                    html, body {
                        width: 210mm;
                        height: 297mm;
                        background: #fff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .page { 
                        margin: 0 !important; 
                        padding: 0 !important;
                        box-shadow: none !important; 
                        border: none !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        overflow: visible !important; /* 중요: 잘림 방지 */
                        position: relative !important;
                    }
                    
                    /* 인쇄 시 가이드라인 제거 */
                    .label-cell { 
                        border: none !important; 
                    }
                }
            </style>
        </head>
        <body>
            <div id="adjust-panel">
                <div class="control-group">
                    <span>시작위치:</span>
                    <input type="number" id="start-pos" value="${startPos}" min="1" max="14" oninput="render()">
                </div>

                <div class="control-group">
                    <span>상단(Top):</span>
                    <input type="range" id="r-top" min="0" max="50" step="0.1" value="15.1" oninput="sync('top', this.value)">
                    <input type="number" id="v-top" value="15.1" step="0.1" oninput="sync('top', this.value)">
                    <span>mm</span>
                </div>

                <div class="control-group">
                    <span>좌측(Left):</span>
                    <input type="range" id="r-left" min="0" max="30" step="0.1" value="5.9" oninput="sync('left', this.value)">
                    <input type="number" id="v-left" value="5.9" step="0.1" oninput="sync('left', this.value)">
                    <span>mm</span>
                </div>

                <button onclick="window.print()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    인쇄하기
                </button>
            </div>
            
            <div class="page">
                <div class="label-grid" id="grid-container"></div>
            </div>
            
            <script>
                const RAW_DATA = ${recordsJson};

                window.onload = function() { render(); };

                function sync(type, val) {
                    document.getElementById('r-' + type).value = val;
                    document.getElementById('v-' + type).value = val;
                    adj();
                }

                function adj() {
                    const grid = document.getElementById('grid-container');
                    const topVal = document.getElementById('v-top').value;
                    const leftVal = document.getElementById('v-left').value;
                    grid.style.top = topVal + 'mm';
                    grid.style.left = leftVal + 'mm';
                }

                function adjustAutoShrink() {
                    const targets = document.querySelectorAll('.label-com, .label-address, .label-detail, .label-postcode, .label-manager');
                    targets.forEach(el => {
                        el.style.fontSize = '';
                        let size = parseFloat(window.getComputedStyle(el).fontSize); 
                        while (el.scrollWidth > el.clientWidth && size > 8) {
                            size -= 0.5; 
                            el.style.fontSize = size + 'px';
                        }
                    });
                }

                function render() {
                    let startPos = parseInt(document.getElementById('start-pos').value, 10);
                    if (isNaN(startPos) || startPos < 1) startPos = 1;
                    if (startPos > 14) startPos = 14;

                    const labels = Array(14).fill(null);
                    RAW_DATA.forEach((rec, idx) => {
                        const pos = (startPos - 1) + idx;
                        if (pos < 14) labels[pos] = rec;
                    });

                    const html = labels.map(rec => {
                        if (!rec) return '<div class="label-cell"></div>';
                        const comName = rec.com_name || '';
                        const address = rec.address || '';
                        const block = rec.block_address || '';
                        const postCode = rec.post_code ? '우편번호 : ' + rec.post_code : '';
                        const manager = rec.manager_name ? rec.manager_name + ' 귀하' : '';
                        return '<div class="label-cell"><div class="label-com">' + comName + '</div><div class="label-address">' + address + '</div><div class="label-detail">' + block + '</div><div class="label-footer"><div class="label-postcode">' + postCode + '</div><div class="label-manager">' + manager + '</div></div></div>';
                    }).join('');

                    document.getElementById('grid-container').innerHTML = html;
                    adj();
                    setTimeout(adjustAutoShrink, 0);
                }
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

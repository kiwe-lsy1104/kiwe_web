// js/sampling_list.js
export function initSampleGrid(container, mDate, comName, onHazardDoubleClick, onDeleteRow, dynamicColumns = [], height = 'calc(100vh - 350px)', onColumnMove, onColumnResize) {
    if (!container) return null;

    const deleteRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        while (td.firstChild) {
            td.removeChild(td.firstChild);
        }
        const btn = document.createElement('button');
        btn.className = 'bg-red-50 text-red-600 hover:bg-red-100 p-1 rounded transition-colors';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
        btn.onclick = (e) => {
            e.preventDefault();
            onDeleteRow(row);
        };
        const div = document.createElement('div');
        div.className = 'flex items-center justify-center h-full w-full';
        div.appendChild(btn);
        td.appendChild(div);
        return td;
    };

    // Base Fixed Columns
    const baseCols = [
        { data: 'actions', label: '관리', renderer: deleteRenderer, readOnly: true, width: 50, className: 'htCenter htMiddle' },
        { data: 'id', label: 'ID', readOnly: true, width: 1, className: 'hidden' },
        { data: 'sample_id', label: '시료번호', readOnly: false, width: 110, className: 'htCenter htMiddle font-bold' },
    ];

    const autoShrinkRenderer = function (instance, td, row, col, prop, value, cellProperties) {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        td.style.whiteSpace = 'nowrap';
        td.style.overflow = 'hidden';
        td.style.textOverflow = 'clip';
        td.style.fontSize = '12px'; // default

        // ★ 유해인자 매칭 및 매체 호환성 체크 (Multi-Hazard Validation)
        if (prop === 'common_name' && value) {
            const validHazards = cellProperties.validHazards || [];
            if (validHazards.length > 0) {
                const parts = String(value).split('/').map(s => s.trim()).filter(Boolean);
                const mediaSet = new Set();
                const missing = [];
                
                parts.forEach(p => {
                    const base = p.split(/[/(]/)[0].trim();
                    const match = validHazards.find(h => h.common_name === p || h.common_name === base);
                    if (match) {
                        if (match.sampling_media) mediaSet.add(match.sampling_media);
                    } else {
                        missing.push(p);
                    }
                });

                if (missing.length > 0) {
                    td.style.color = '#e11d48'; // rose-600
                    td.style.backgroundColor = '#fff1f2'; // rose-50
                    td.title = `등록되지 않은 인자 포함: ${missing.join(', ')}`;
                } else if (mediaSet.size > 1) {
                    td.style.color = '#d97706'; // amber-600
                    td.style.backgroundColor = '#fffbeb'; // amber-50
                    td.title = `채취매체 불일치: ${Array.from(mediaSet).join(' vs ')}`;
                } else {
                    // 정상인 경우 스타일 초기화 (다른 셀과 동일하게)
                    td.style.color = '';
                    td.style.backgroundColor = '';
                    td.title = '';
                }
            }
        }

        // Simple logic to shrink font if text is long
        const text = value ? String(value) : '';
        const colWidth = instance.getColWidth(col) || 100;
        const charCount = text.length;

        if (charCount > 0) {
            const estimatedWidth = charCount * 7; // rough estimate for 12px font
            if (estimatedWidth > colWidth - 10) {
                const ratio = (colWidth - 10) / estimatedWidth;
                const newSize = Math.max(8, Math.floor(12 * ratio));
                td.style.fontSize = newSize + 'px';
            }
        }
        return td;
    };

    const statusRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        while (td.firstChild) {
            td.removeChild(td.firstChild);
        }
        const div = document.createElement('div');
        div.className = 'flex items-center justify-center gap-1 h-full w-full';

        if (value === '완료') {
            const badge = document.createElement('span');
            badge.className = 'px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200';
            badge.innerText = '완료';
            div.appendChild(badge);
        } else {
            const btn = document.createElement('button');
            btn.className = 'px-1.5 py-0.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-[10px] font-bold rounded border border-indigo-200 transition-colors active:scale-95';
            btn.innerText = '완료처리';
            btn.onclick = (e) => {
                e.preventDefault();
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

                // Handle day crossing if necessary
                if (endTotal < startTotal) {
                    endTotal += 24 * 60;
                }

                const diff = endTotal - startTotal;
                const lunchTime = parseInt(instance.getDataAtRowProp(row, 'lunch_time')) || 0;
                const finalDiff = Math.max(0, diff - lunchTime);

                td.innerText = finalDiff;
                td.style.fontWeight = 'bold';
                td.style.color = '#4f46e5'; // indigo-600
            } else {
                td.innerText = '-';
            }
        } else {
            td.innerText = '-';
        }

        td.className = 'htCenter htMiddle';
        return td;
    };

    // Map of all possible dynamic columns
    const columnDefinitions = {
        'm_date': { data: 'm_date', label: '측정일자', type: 'date', dateFormat: 'YYYY-MM-DD', width: 90, className: 'htCenter htMiddle' },
        'com_name': { data: 'com_name', label: '사업장명', renderer: autoShrinkRenderer, width: 130, className: 'htCenter htMiddle font-bold' },
        'work_process': { data: 'work_process', label: '작업공정', renderer: autoShrinkRenderer, width: 100, className: 'htCenter htMiddle' },
        'worker_name': { data: 'worker_name', label: '근로자명', width: 80, className: 'htCenter htMiddle' },
        'common_name': { data: 'common_name', label: '유해인자(검색)', renderer: autoShrinkRenderer, width: 160, className: 'htCenter htMiddle font-bold' },
        'hazard_category': { data: 'hazard_category', label: '카테고리', width: 1, className: 'hidden' },
        'pump_no': { data: 'pump_no', label: '펌프번호', width: 70, className: 'htCenter htMiddle font-bold' },
        'start_time': { data: 'start_time', label: '시작시간', width: 60, className: 'htCenter htMiddle' },
        'end_time': { data: 'end_time', label: '종료시간', width: 60, className: 'htCenter htMiddle' },
        'shift_type': {
            data: 'shift_type',
            label: '교대형태',
            type: 'autocomplete',
            source: ['1교대', '2조2교대', '4조3교대', '직접입력'],
            strict: false,
            width: 90,
            className: 'htCenter htMiddle'
        },
        'work_hour': { data: 'work_hour', label: '실근로시간(h)', type: 'numeric', width: 65, className: 'htCenter htMiddle' },
        'lunch_time': { data: 'lunch_time', label: '점심시간(분)', type: 'numeric', width: 75, className: 'htCenter htMiddle' },
        'measured_min': { data: 'measured_min', label: '측정시간(분/계산)', renderer: measuredTimeRenderer, readOnly: true, width: 110, className: 'htCenter htMiddle' },
        'occurrence_type': { data: 'occurrence_type', label: '발생형태', type: 'dropdown', source: ['연속적', '불규칙'], width: 80, className: 'htCenter htMiddle' },
        'temp': { data: 'temp', label: '온도', width: 50, className: 'htCenter htMiddle' },
        'humidity': { data: 'humidity', label: '습도', width: 50, className: 'htCenter htMiddle' },
        'condition': { data: 'condition', label: '시료상태', type: 'dropdown', source: ['양호', '파과', '기타'], width: 70, className: 'htCenter htMiddle' },
        'analyst': { data: 'analyst', label: '분석자', width: 80, className: 'htCenter htMiddle' },
        'measured_by': { data: 'measured_by', label: '측정자', width: 80, className: 'htCenter htMiddle' },
        'received_by': { data: 'received_by', label: '인수자/접수자', width: 90, className: 'htCenter htMiddle' },
        'received_date': { data: 'received_date', label: '인수일', type: 'date', dateFormat: 'YYYY-MM-DD', width: 90, className: 'htCenter htMiddle' },
        'status': { data: 'status', label: '완료상태', renderer: statusRenderer, width: 80, className: 'htCenter htMiddle' },
        'completed_at': { data: 'completed_at', label: '완료날짜', type: 'date', dateFormat: 'YYYY-MM-DD', width: 90, className: 'htCenter htMiddle' }
    };

    const activeColsRaw = dynamicColumns.length > 0 ? dynamicColumns : [
        'm_date', 'com_name', 'work_process', 'worker_name', 'common_name',
        'hazard_category', 'pump_no', 'start_time', 'end_time', 'measured_min', 'shift_type',
        'work_hour', 'lunch_time', 'occurrence_type', 'temp', 'humidity',
        'condition', 'analyst', 'measured_by', 'received_by'
    ];

    // 연번 전용 렌더러 (1, 2, 3...)
    const rowNumberRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, row + 1, cellProperties]);
        td.style.backgroundColor = '#f8fafc';
        td.style.fontWeight = '700';
        td.style.color = '#475569';
        td.style.textAlign = 'center';
        td.style.verticalAlign = 'middle';
    };

    const finalCols = [
        { data: null, label: 'No', width: 40, readOnly: true, renderer: rowNumberRenderer, className: 'htCenter htMiddle' },
        ...baseCols
    ];
    activeColsRaw.forEach(key => {
        if (columnDefinitions[key]) {
            finalCols.push(columnDefinitions[key]);
        }
    });

    const hot = new Handsontable(container, {
        data: [],
        colHeaders: finalCols.map(c => c.label),
        columns: finalCols,
        hiddenColumns: {
            columns: finalCols.map((c, i) => (c.className && c.className.includes('hidden')) ? i : -1).filter(i => i !== -1),
            indicators: false,
            // 숨김 열이 복사/붙여넣기 영역에 포함되어 데이터가 밀리는 오류를 방지합니다.
            copyPasteEnabled: false
        },
        // Handsontable 한글 IME 활성화(첫 글자 누락 방지 - 일부 구버전 및 브라우저 보완)
        imeFastEdit: true,
        wordWrap: false,
        rowHeaders: false, // 행 번호 비활성화 (컬럼으로 대체)
        rowHeights: 24,    // 행 높이 축소
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
        afterColumnMove: (movedColumns, target) => {
            if (onColumnMove) {
                onColumnMove(movedColumns, target);
            }
        },
        afterColumnResize: (newSize, column, isDoubleClick) => {
            if (onColumnResize) {
                onColumnResize(column, newSize);
            }
        },
        autoWrapRow: true,
        autoWrapCol: true,
        manualRowResize: true,
        manualColumnResize: true,
        autoColumnSize: false,
        autoRowSize: false, // 행높이 24px 강제 고정을 위해 비활성화
        filters: true,
        columnSorting: true, // ★ 헤더 클릭 시 즉시 정렬 활성화
        viewportColumnRenderingOffset: 20, // 렌더링 오프셋으로 스크롤/확대 시 틀어짐 방지
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
        // ★ 엑셀 붙여넣기 시 날짜 자동 변환 방지 (25-1 -> Jan-25 방지)
        // 폭이 없는 공백(\u200B)을 접두어로 추가하여 엑셀이 텍스트로 인식하게 합니다.
        beforeCopy: (data) => {
            for (let r = 0; r < data.length; r++) {
                for (let c = 0; c < data[r].length; c++) {
                    const val = data[r][c];
                    // ★ 엑셀 날짜 변환 방지: 뒤에 공백(Space) 하나를 추가 (호환성 보장)
                    if (typeof val === 'string' && /^(\d+[~\-]\d+|\d{1,2}:\d{2})$/.test(val)) {
                        data[r][c] = val + ' ';
                    }
                }
            }
        },
        // ★ 엑셀에서 다시 붙여넣을 때 제어문자 및 물음표(?) 제거
        beforeChange: (changes, source) => {
            if (source === 'loadData') return;
            
            for (let i = 0; i < changes.length; i++) {
                let newVal = changes[i][3];
                if (typeof newVal === 'string') {
                    // 1. 선행 물음표 제거 (인코딩 오류 방지)
                    // 2. 모든 제어 문자 및 공백 제거(trim)
                    newVal = newVal.replace(/^\?*/, '').trim();
                    changes[i][3] = newVal;
                }
            }
        },
        beforePaste: (data) => {
            for (let r = 0; r < data.length; r++) {
                for (let c = 0; c < data[r].length; c++) {
                    if (typeof data[r][c] === 'string') {
                        // 붙여넣는 모든 데이터에 대해 선행 물음표 및 공백 제거
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
    
    // ★ 브라우저 Zoom(확대/축소) 시 연번과 데이터 그리드가 틀어지는 현상 방지
    // 창 크기가 변할 때마다 그리드를 다시 렌더링하여 위치를 보정합니다.
    window.addEventListener('resize', () => {
        if (hot && !hot.isDestroyed) {
            hot.render();
        }
    });

    return hot;
}

export async function loadGridData(hot, supabase, startDate, endDate, comName, user, sortType = 'input', idFilter = 'all') {
    if (!hot || !supabase) return;
    try {
        const formatTimeHHMM = (val) => {
            if (!val) return '';
            let digits = String(val).replace(/\D/g, '');
            if (digits.length === 3) digits = '0' + digits;
            if (digits.length === 4) {
                return digits.substring(0, 2) + ':' + digits.substring(2, 4);
            }
            if (typeof val === 'string' && val.includes(':')) {
                const parts = val.split(':');
                if (parts.length >= 2) {
                    return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
                }
            }
            return val;
        };

        const getTableName = (dateStr) => {
            if (!dateStr) return null;
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const halfYear = month <= 6 ? 1 : 2;
            return `kiwe_sampling_${year}_${halfYear}`;
        };

        const getTableList = (start, end) => {
            if (!start || !end) return [];
            const tables = new Set();
            const startDateObj = new Date(start);
            const endDateObj = new Date(end);

            tables.add(getTableName(start));

            let currentDate = new Date(startDateObj);
            while (currentDate <= endDateObj) {
                tables.add(getTableName(currentDate.toISOString().split('T')[0]));
                currentDate.setMonth(currentDate.getMonth() + 6);
            }

            tables.add(getTableName(end));

            return Array.from(tables);
        };

        let allData = [];

        if (startDate && endDate) {
            const tableList = getTableList(startDate, endDate);
            const queries = tableList.map(async (tableName) => {
                try {
                    let query = supabase
                        .from(tableName)
                        .select('*')
                        .gte('m_date', startDate)
                        .lte('m_date', endDate)
                        .order('id', { ascending: true });

                    if (comName) {
                        query = query.eq('com_name', comName);
                    }

                    const { data, error } = await query;
                    if (error) {
                        console.warn(`테이블 ${tableName} 조회 실패:`, error.message);
                        return [];
                    }
                    return data || [];
                } catch (err) {
                    console.warn(`테이블 ${tableName} 조회 오류:`, err);
                    return [];
                }
            });

            const results = await Promise.all(queries);
            allData = results.flat();
        } else if (startDate) {
            const tableName = getTableName(startDate);
            let query = supabase
                .from(tableName)
                .select('*')
                .gte('m_date', startDate)
                .lte('m_date', endDate)
                .order('id', { ascending: true });

            if (comName) {
                query = query.eq('com_name', comName);
            }

            const { data, error } = await query;
            if (error) {
                console.warn(`테이블 ${tableName} 조회 실패:`, error.message);
            } else if (data) {
                allData = allData.concat(data);
            }
        }

        // 1. 공시료 여부 판별 헬퍼
        const isBlankSample = (item) => !!(item.worker_name && item.worker_name.includes('공시료'));

        // 2. 시료번호 숫자 부분(SEQ) 추출 헬퍼
        const getSeqNum = (id) => {
            if (!id) return 999999;
            const parts = id.split('-');
            if (parts.length < 2) return 999999;
            const seq = parseInt(parts[parts.length - 1], 10);
            return isNaN(seq) ? 999999 : seq;
        };

        // 3. 사업장별 최소 시료번호(SEQ) 계산 — 공시료 제외한 일반시료 기준
        const companyPriority = {};
        allData.forEach(item => {
            if (isBlankSample(item)) return; // 공시료는 우선순위 계산에서 제외
            const com = item.com_name || 'unknown';
            const seq = getSeqNum(item.sample_id);
            if (companyPriority[com] === undefined || seq < companyPriority[com]) {
                companyPriority[com] = seq;
            }
        });
        // 공시료만 있는 사업장은 fallback으로 공시료 포함해서 계산
        allData.forEach(item => {
            const com = item.com_name || 'unknown';
            if (companyPriority[com] === undefined) {
                const seq = getSeqNum(item.sample_id);
                companyPriority[com] = seq;
            }
        });

        if (sortType === 'sample_id') {
            // ★ 시료번호순: 측정일자 → 시료번호(자연 정렬)
            allData.sort((a, b) => {
                if (a.m_date !== b.m_date) return a.m_date > b.m_date ? 1 : -1;
                const sidA = a.sample_id || '';
                const sidB = b.sample_id || '';
                if (sidA !== sidB) {
                    return sidA.localeCompare(sidB, undefined, { numeric: true, sensitivity: 'base' });
                }
                return (a.id || 9999999) - (b.id || 9999999);
            });
        } else {
            // ★ 입력순 (ID순): 측정일자 → DB ID순
            // 사용자가 입력한 순서(ID)를 최우선으로 하여 정렬합니다.
            allData.sort((a, b) => {
                if (a.m_date !== b.m_date) return a.m_date > b.m_date ? 1 : -1;
                return (a.id || 9999999) - (b.id || 9999999);
            });
        }

        // 정렬이 완료된 후에 화면의 행번호(index)를 데이터에 심어서, 나중에 UI에서 안전하게 보게 할 수 있음 (선택)
        // 하지만 rowHeaders: true 이므로 Handsontable이 자체적으로 1, 2, 3..을 그려줌.

        const allCommonNames = allData.map(d => d.common_name).filter(Boolean);
        const searchNames = Array.from(new Set(allCommonNames.map(name => name.split('/')[0].trim())));

        let hazardsMap = {};

        if (searchNames.length > 0) {
            const { data: hazards } = await supabase
                .from('kiwe_hazard')
                .select('common_name, hazard_category, instrument_name, sampling_media, sampling, storage, is_self')
                .in('common_name', searchNames);

            if (hazards) {
                hazards.forEach(h => {
                    hazardsMap[h.common_name] = h;
                });
            }
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
                work_hour: (isBlank) ? (d.work_hour || null) : ((d.work_hour === null || d.work_hour === undefined || d.work_hour === '') ? null : parseFloat(d.work_hour)),
                lunch_time: (isBlank) ? (d.lunch_time || null) : ((d.lunch_time === null || d.lunch_time === undefined || d.lunch_time === '') ? null : parseFloat(d.lunch_time)),
            };
        });

        if (idFilter === 's') {
            newData = newData.filter(d => {
                const isNoise = d.common_name && d.common_name.includes('소음');
                if (isNoise) return false; // 소음은 필터링 시 무조건 제외
                if (!d.sample_id) return true; // 번호 없는 건 일단 보여줌
                const prefixMatch = d.sample_id.match(/^[A-Z]+/);
                const prefix = prefixMatch ? prefixMatch[0] : '';
                return prefix === 'S';
            });
        } else if (idFilter === 'd') {
            newData = newData.filter(d => {
                const isNoise = d.common_name && d.common_name.includes('소음');
                if (isNoise) return false;
                if (!d.sample_id) return true;
                const prefixMatch = d.sample_id.match(/^[A-Z]+/);
                const prefix = prefixMatch ? prefixMatch[0] : '';
                return prefix === 'D';
            });
        } else if (idFilter === 'sb') {
            newData = newData.filter(d => {
                const isNoise = d.common_name && d.common_name.includes('소음');
                if (isNoise) return false;
                if (!d.sample_id) return false;
                const prefixMatch = d.sample_id.match(/^[A-Z]+/);
                const prefix = prefixMatch ? prefixMatch[0] : '';
                return prefix === 'SB';
            });
        } else if (idFilter === 'db') {
            newData = newData.filter(d => {
                const isNoise = d.common_name && d.common_name.includes('소음');
                if (isNoise) return false;
                if (!d.sample_id) return false;
                const prefixMatch = d.sample_id.match(/^[A-Z]+/);
                const prefix = prefixMatch ? prefixMatch[0] : '';
                return prefix === 'DB';
            });
        }

        hot.loadData(newData);
    } catch (err) {
        console.error('Grid data load error:', err);
    }
}

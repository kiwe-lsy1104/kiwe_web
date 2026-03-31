// excel_importer.js - 견적서 엑셀 대량 업로드 컴포넌트
import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { SUPABASE_URL, SUPABASE_KEY, fmt, getDefaultNotes } from './quotation_data.js';
import { X, Upload, Check, AlertCircle, Loader2, FileSpreadsheet } from 'https://esm.sh/lucide-react@0.263.1';

const e = React.createElement;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function ExcelImporter({ onClose, onComplete }) {
    const [file, setFile] = useState(null);
    const [rawRows, setRawRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [mapping, setMapping] = useState({});
    const [step, setStep] = useState(1); // 1: Select, 2: Mapping, 3: Preview, 4: Uploading
    const [mode, setMode] = useState('standard'); // 'standard' or 'vba'
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const REQUIRED_FIELDS = [
        { key: 'quote_date', label: '견적일자', example: '2025-01-01' },
        { key: 'client_name', label: '거래처명', example: '(주)키위' },
        { key: 'workplace_size', label: '사업장규모', example: '50인이상' },
        { key: 'sampling_days', label: '측정일수', example: '1' },
        { key: 'management_fee', label: '기본관리비', example: '714000' },
        { key: 'work_process', label: '공정/장소', example: '도장공정' },
        { key: 'hazard_name', label: '유해인자/항목', example: '톨루엔' },
        { key: 'unit_price', label: '단가', example: '50000' },
        { key: 'quantity', label: '수량', example: '1' },
        { key: 'author', label: '작성자', example: '홍길동' },
        { key: 'discount_rate', label: '할인율(%)', example: '10' },
        { key: 'discount_amount', label: '할인금액', example: '5000' }
    ];

    const VBA_MAPPING = {
        quote_no: 0,       // A열
        quote_date: 1,     // B열
        year_half: 2,      // C열
        type_code: 5,      // F열 (유형 코드 - 1:지원, 2~9:일반)
        support_kind: 6,   // G열 (지원 구분 - 1:기존, 2:신규)
        client_name: 7,    // H열 (사업장명)
        client_manager: 8, // I열 (수신처 담당자)
        author: 9,         // J열 (견적작성자)
        total_amount: 10,  // K열 (최종견적금액 - 최종 합계)
        actual_amount: 11, // L열 (실금액 - 기본관리비+분석수수료)
        support_amount: 12, // M열 (공단지원금)
        discount_rate: 13, // N열 (할인율)
        discount_amount: 14, // O열 (희망금액 - 수동 입력 시)
        mgmt_fee: 18,      // S열 (기본관리비 총액)
        sampling_days: 19  // T열 (측정일수)
    };

    // 엑셀 날짜(44532 등)를 JS 날짜 문자열로 변환
    const excelDateToJSDate = (serial) => {
        if (!serial) return null;
        if (typeof serial === 'string') {
            const s = serial.trim();
            if (s === '' || s.includes('일자') || s.includes('날짜') || s.includes('Date')) return null;
            if (s.includes('-') || s.includes('.')) return s.replace(/\./g, '-');
            return null; // 숫자도 아니고 유효한 날짜 포맷도 아니면 null
        }
        if (isNaN(serial) || serial < 30000 || serial > 60000) return null;

        try {
            const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
            if (isNaN(date.getTime())) return null;
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        } catch (e) { return null; }
    };

    const handleFile = async (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        setLoading(true);
        try {
            const data = await f.arrayBuffer();
            const workbook = XLSX.read(data, { cellDates: false });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (rows.length === 0) throw new Error('엑셀에 데이터가 없습니다.');

            const maxCols = Math.max(...rows.slice(0, 10).map(r => r.length));
            if (maxCols > 25) {
                if (confirm('엑셀 데이터 구조가 VBA 전용 시트(가로 나열)인 것으로 보입니다.\n가로로 나열된 상세내역을 자동으로 분리하여 업로드하시겠습니까?')) {
                    setMode('vba');
                    setRawRows(rows);
                    setStep(3);
                    setLoading(false);
                    return;
                }
            }

            setMode('standard');
            // 헤더 행 찾기
            let headerIdx = 0;
            for (let i = 0; i < rows.length; i++) {
                const rowStr = rows[i].join('');
                if (rowStr.includes('거래처') || rowStr.includes('항목') || rowStr.includes('견적')) {
                    headerIdx = i;
                    break;
                }
                if (rows[i].filter(c => String(c).trim() !== '').length > 3) {
                    headerIdx = i;
                    break;
                }
            }

            const headerRow = rows[headerIdx];
            // 데이터 행 추출 (헤더 이후부터 & 날짜 유효성 체크는 doImport에서)
            const dataRows = rows.slice(headerIdx + 1).filter(row => {
                const isHeader = row.every((cell, i) => String(cell).trim() === String(headerRow[i]).trim());
                const isEmpty = row.every(cell => String(cell).trim() === '');
                return !isHeader && !isEmpty;
            });

            const cols = headerRow.map((h, i) => {
                const letter = String.fromCharCode(65 + (i % 26));
                const prefix = i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '';
                const colLetter = prefix + letter;
                const name = String(h || `(빈 열 ${colLetter})`).trim();
                let exVal = dataRows[0]?.[i];
                if (typeof exVal === 'number' && exVal > 30000 && exVal < 60000) exVal = excelDateToJSDate(exVal);
                const example = exVal ? ` (예: ${String(exVal).substring(0, 10)})` : '';
                return { key: i, label: `${colLetter}열: ${name}${example}`, originalName: name };
            });

            setColumns(cols);

            const json = dataRows.map(row => {
                const obj = {};
                cols.forEach(c => {
                    let val = row[c.key];
                    if (typeof val === 'number' && val > 30000 && val < 60000) val = excelDateToJSDate(val);
                    obj[c.key] = val;
                });
                return obj;
            });
            setRawRows(json);

            const initialMap = {};
            REQUIRED_FIELDS.forEach(f => {
                const match = cols.find(c => c.originalName === f.label || c.originalName.toLowerCase().includes(f.key));
                if (match) initialMap[f.key] = match.key;
            });
            setMapping(initialMap);
            setStep(2);
        } catch (err) {
            alert('파일 읽기 실패: ' + err.message);
        }
        setLoading(false);
    };

    const parseVbaRows = () => {
        const results = [];
        rawRows.forEach((row, rIdx) => {
            // 헤더(B2) 위치 확인 및 유효 데이터 체크
            if (rIdx < 2) return; // 1, 2행은 제목/헤더일 가능성 큼
            const qDate = excelDateToJSDate(row[VBA_MAPPING.quote_date]);
            const cName = String(row[VBA_MAPPING.client_name] || '').trim();
            // 날짜가 없거나, "거래처" 같은 헤더 문구면 제외
            if (!qDate || !cName || cName.includes('거래처') || cName.includes('Client')) return;

            const typeCode = parseInt(row[VBA_MAPPING.type_code]) || 2; // F열
            const supportKind = parseInt(row[VBA_MAPPING.support_kind]) || 1; // G열
            const sDays = (row[VBA_MAPPING.sampling_days] !== undefined && row[VBA_MAPPING.sampling_days] !== '') ? Number(row[VBA_MAPPING.sampling_days]) : 0; // T열
            const dRate = Number(row[VBA_MAPPING.discount_rate] || 0); // N열
            const tAmt = Number(row[VBA_MAPPING.total_amount] || 0);    // K열
            const aAmt = Number(row[VBA_MAPPING.actual_amount] || 0);  // L열
            const dAmt = Number(row[VBA_MAPPING.discount_amount] || 0); // O열
            const cManager = String(row[VBA_MAPPING.client_manager] || '').trim();
            const author = String(row[VBA_MAPPING.author] || '').trim();
            const rawMgmtFee = (row[VBA_MAPPING.mgmt_fee] !== undefined && row[VBA_MAPPING.mgmt_fee] !== '') ? Number(row[VBA_MAPPING.mgmt_fee]) : 0; // S열
            const sAmount = (row[VBA_MAPPING.support_amount] !== undefined && row[VBA_MAPPING.support_amount] !== '') ? Number(row[VBA_MAPPING.support_amount]) : 0; // M열 (지원금)

            // 코드에 따른 타입 및 사업장규모 판별
            let qType = '일반';
            let isSupport = false;
            let supportType = '일반';
            let workplaceSize = '';

            if (typeCode === 1) {
                qType = '일반';
                isSupport = true;
                supportType = supportKind === 2 ? '신규지원' : '기존지원'; // G열: 1=>기존, 2=>신규
                workplaceSize = '비용지원';
            } else if (typeCode >= 2 && typeCode <= 9) {
                qType = '일반';
                isSupport = false;
                const sizes = ['1~49인', '50~99인', '100~299인', '300~499인', '500~999인', '1000~1999인', '2000~2999인', '3000인 이상'];
                workplaceSize = sizes[typeCode - 2];
            } else if (typeCode >= 10 && typeCode <= 12) {
                qType = '용역';
                isSupport = false;
                workplaceSize = '용역견적서';
            } else if (typeCode === 13) {
                qType = '일반';
                isSupport = false;
                workplaceSize = '대여견적서';
            }

            // 우리 시스템의 management_fee는 '단가' 기준이므로 총액(S열)을 일수로 나눔
            const mgmtFee = sDays > 0 ? Math.round(rawMgmtFee / sDays) : rawMgmtFee;

            const yHStr = String(row[VBA_MAPPING.year_half] || '');
            let year = new Date(qDate).getFullYear() || 2025;
            let half = '상반기';
            if (yHStr.includes('하반기')) half = '하반기';
            if (yHStr.match(/\d{4}/)) year = parseInt(yHStr.match(/\d{4}/)[0]);

            const items = [];
            // U열(Index 20)부터 7개씩 반복 (0:공정, 1:인자, 2:방법, 3:수량, 4:단가, 5:합계, 6:비고)
            for (let i = 20; i < row.length; i += 7) {
                const hazard = row[i + 1];
                if (!hazard || String(hazard).trim() === '') continue;

                items.push({
                    work_process: String(row[i] || '').trim(),
                    hazard_name: String(hazard).trim(),
                    analysis_method: String(row[i + 2] || '').trim(),
                    unit_type: workplaceSize || '', // F열 기반 사업장 규모/유형 정보
                    quantity: (row[i + 3] !== undefined && row[i + 3] !== '') ? Number(row[i + 3]) || 0 : 0, // X열, 0 허용
                    unit_price: Number(row[i + 4]) || 0, // 5번째(index+4)가 단가
                    remarks: String(row[i + 6] || '').trim() // 7번째(index+6)가 비고
                });
            }

            if (items.length > 0) {
                results.push({
                    quote_no: String(row[VBA_MAPPING.quote_no] || ''),
                    quote_date: qDate,
                    client_name: String(row[VBA_MAPPING.client_name] || '').trim(),
                    quote_type: qType,
                    is_cost_support: isSupport,
                    support_type: supportType,
                    workplace_size: workplaceSize,
                    management_fee: mgmtFee,
                    sampling_days: sDays,
                    discount_rate: dRate,
                    discount_amount: dAmt,
                    total_amount: tAmt,
                    actual_amount: aAmt,
                    client_manager: cManager,
                    author: author,
                    year: year,
                    half_year: half,
                    support_amount: sAmount || 0, // M열 공단지원금
                    notes: getDefaultNotes(qType, supportType),
                    items
                });
            }
        });
        return results;
    };

    // 명칭 정규화 함수 ((주) -> ㈜, 공백 제거)
    const normalizeName = (name) => {
        if (!name) return '';
        return String(name).replace(/\(주\)/g, '㈜').replace(/\s+/g, '').trim();
    };

    const doImport = async () => {
        setStep(4);
        setLoading(true);
        try {
            // 사업장 데이터 미리 로드 (매칭용)
            const { data: companyList } = await sb.from('kiwe_companies').select('com_id, com_name, com_reg_no, ceo_name, address, tel, fax, biz_type');
            const companyMap = new Map();
            companyList?.forEach(c => {
                const norm = normalizeName(c.com_name);
                if (norm) companyMap.set(norm, c);
            });

            let processedData = [];
            if (mode === 'vba') {
                processedData = parseVbaRows();
            } else {
                const groups = {};
                rawRows.forEach(row => {
                    const cName = row[mapping.client_name];
                    let qDate = row[mapping.quote_date];

                    // 날짜 유효성 체크 (문자열인 경우 다시 한번 변환 시도)
                    if (typeof qDate === 'string') qDate = excelDateToJSDate(qDate);
                    else if (typeof qDate === 'number') qDate = excelDateToJSDate(qDate);

                    if (!cName || !qDate) return;

                    const key = `${cName}_${qDate}`;
                    if (!groups[key]) {
                        groups[key] = {
                            client_name: String(cName).trim(),
                            quote_date: qDate,
                            year: new Date(qDate).getFullYear(),
                            half_year: new Date(qDate).getMonth() < 6 ? '상반기' : '하반기',
                            author: String(row[mapping.author] || '').trim(),
                            workplace_size: String(row[mapping.workplace_size] || '').trim(),
                            sampling_days: (row[mapping.sampling_days] !== undefined && row[mapping.sampling_days] !== '') ? Number(row[mapping.sampling_days]) : 0,
                            management_fee: (row[mapping.management_fee] !== undefined && row[mapping.management_fee] !== '') ? Number(row[mapping.management_fee]) : 0,
                            discount_rate: Number(row[mapping.discount_rate]) || 0,
                            discount_amount: Number(row[mapping.discount_amount]) || 0,
                            items: []
                        };
                    }
                    groups[key].items.push({
                        work_process: String(row[mapping.work_process] || ''),
                        hazard_name: String(row[mapping.hazard_name] || ''),
                        unit_price: Number(row[mapping.unit_price]) || 0,
                        quantity: (row[mapping.quantity] !== undefined && row[mapping.quantity] !== '') ? Number(row[mapping.quantity]) : 0,
                        remarks: String(row[mapping.remarks] || '')
                    });
                });
                processedData = Object.values(groups);
            }

            setProgress({ current: 0, total: processedData.length });

            for (let i = 0; i < processedData.length; i++) {
                const g = processedData[i];
                const normName = normalizeName(g.client_name);
                const matchedOrg = companyMap.get(normName);

                // 거래처 확인 또는 생성
                let { data: clients } = await sb.from('kiwe_quotation_clients').select('id').eq('client_name', g.client_name).limit(1);
                let clientId = clients?.[0]?.id;

                if (!clientId) {
                    const clientPayload = {
                        client_name: g.client_name,
                        com_id: matchedOrg?.com_id || null,
                        biz_reg_no: matchedOrg?.com_reg_no || null,
                        ceo_name: matchedOrg?.ceo_name || null,
                        address: matchedOrg?.address || null,
                        tel: matchedOrg?.tel || matchedOrg?.manager_contact || null,
                        fax: matchedOrg?.fax || null
                    };
                    const { data: newC } = await sb.from('kiwe_quotation_clients').insert(clientPayload).select();
                    clientId = newC?.[0]?.id;
                }

                // 견적 헤더 생성
                const { data: q, error: qErr } = await sb.from('kiwe_quotations').insert({
                    quote_no: g.quote_no || undefined,
                    client_id: clientId,
                    client_name: g.client_name,
                    quote_date: g.quote_date,
                    year: g.year || 2025,
                    half_year: g.half_year || '상반기',
                    workplace_size: g.workplace_size || null,
                    management_fee: g.management_fee || 0,
                    sampling_days: g.sampling_days || 1,
                    discount_rate: g.discount_rate || 0,
                    discount_amount: g.discount_amount || 0,
                    actual_amount: g.actual_amount || 0,
                    support_amount: g.support_amount || 0,
                    total_amount: g.total_amount || 0,
                    client_manager: g.client_manager || null,
                    notes: (g.notes && g.notes.trim() !== '' && !g.notes.includes('발행일로부터 30일간 유효'))
                        ? g.notes
                        : getDefaultNotes(g.quote_type || '일반', g.support_type || '일반'),
                    created_by: g.author || null,
                    quote_type: g.quote_type || '일반',
                    is_cost_support: g.is_cost_support || false,
                    support_type: g.support_type || '일반',
                    status: '완료'
                }).select();

                if (qErr) throw qErr;
                const qId = q[0].id;

                // 아이템 생성
                const itemPayloads = g.items.map((it, idx) => ({
                    quotation_id: qId,
                    sort_order: idx + 1,
                    ...it
                }));
                await sb.from('kiwe_quotation_items').insert(itemPayloads);

                setProgress(p => ({ ...p, current: i + 1 }));
            }

            alert(`${processedData.length}건의 견적서 업로드 완료!`);
            onComplete && onComplete();
            onClose();
        } catch (err) {
            alert('업로드 중 오류: ' + err.message);
            setStep(3);
        }
        setLoading(false);
    };

    const renderStep1 = () => e('div', { className: 'flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50' },
        e(FileSpreadsheet, { size: 64, className: 'text-emerald-500 mb-4' }),
        e('h4', { className: 'text-xl font-black text-slate-700 mb-2' }, '엑셀 파일 선택'),
        e('p', { className: 'text-slate-400 text-sm mb-6 text-center leading-relaxed' },
            mode === 'vba' ? 'VBA 전용 [견적데이터] 시트를 선택하셨습니다.\n수백 건의 데이터를 자동으로 분석하여 이관합니다.' : '업로드할 견적서 리스트 엑셀 파일을 선택하세요.'
        ),
        e('label', { className: 'px-8 py-3 bg-blue-600 text-white rounded-xl font-bold cursor-pointer hover:bg-blue-700 shadow-lg' },
            '파일 찾기',
            e('input', { type: 'file', accept: '.xlsx, .xls, .csv', onChange: handleFile, className: 'hidden' })
        ),
        e('div', { className: 'mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100' },
            e('p', { className: 'text-xs text-emerald-600 font-bold' }, '💡 TIP: 기존 엑셀의 [견적데이터] 시트 전체를 그대로 업로드하시면 됩니다.')
        )
    );

    const renderStep2 = () => e('div', { className: 'space-y-6' },
        e('h4', { className: 'text-lg font-black text-slate-700' }, '내역 매핑 설정'),
        e('div', { className: 'grid grid-cols-2 gap-4' },
            REQUIRED_FIELDS.map(f => e('div', { key: f.key, className: 'space-y-1' },
                e('label', { className: 'text-xs font-bold text-slate-500' }, f.label),
                e('select', {
                    value: mapping[f.key] || '',
                    onChange: ev => setMapping(p => ({ ...p, [f.key]: ev.target.value })),
                    className: 'w-full p-3 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white font-bold'
                },
                    e('option', { value: '' }, '-- 엑셀 컬럼 선택 --'),
                    columns.map(c => e('option', { key: c.key, value: c.key }, c.label))
                )
            ))
        ),
        e('div', { className: 'pt-6 flex gap-3' },
            e('button', { onClick: () => setStep(1), className: 'flex-1 py-4 bg-slate-100 font-bold rounded-2xl transition-colors' }, '이전'),
            e('button', {
                disabled: !REQUIRED_FIELDS.filter(f => !f.key.includes('discount')).every(f => mapping[f.key] !== undefined),
                onClick: () => setStep(3),
                className: 'flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all'
            }, '미리보기 확인')
        )
    );

    const renderStep3 = () => {
        const previewData = mode === 'vba' ? parseVbaRows().slice(0, 20) : rawRows.slice(0, 50);
        return e('div', { className: 'space-y-6' },
            e('div', { className: 'flex justify-between items-center' },
                e('h4', { className: 'text-lg font-black text-slate-700' }, mode === 'vba' ? 'VBA 데이터 변환 미리보기' : '데이터 미리보기'),
                e('span', { className: 'text-sm font-bold text-blue-600' }, `총 ${rawRows.length}개 행 감지`)
            ),
            e('div', { className: 'max-h-[300px] overflow-auto border border-slate-200 rounded-2xl bg-white' },
                e('table', { className: 'w-full text-[10px] text-left border-collapse' },
                    e('thead', { className: 'sticky top-0 bg-slate-50 border-b' },
                        e('tr', null,
                            (mode === 'vba' ? ['결과', '번호', '날짜', '연도/반기', '거래처', '작성자', '타입/일수', '항목수', '할인', '비고'] : REQUIRED_FIELDS.map(f => f.label))
                                .map(label => e('th', { key: label, className: 'px-3 py-2 font-black text-slate-400 uppercase tracking-wider' }, label))
                        )
                    ),
                    e('tbody', { className: 'divide-y' },
                        previewData.map((row, idx) => e('tr', { key: idx, className: 'hover:bg-blue-50/30 transition-colors' },
                            mode === 'vba'
                                ? [
                                    e('span', { className: 'text-emerald-500 font-bold' }, 'OK'),
                                    row.quote_no,
                                    row.quote_date,
                                    `${row.year} ${row.half_year}`,
                                    e('span', { className: 'font-black text-slate-700' }, row.client_name),
                                    row.author || '-',
                                    e('div', { className: 'flex flex-col gap-0.5' },
                                        e('span', { className: `px-1.5 py-0.5 rounded text-[9px] font-black border w-fit ${row.quote_type === '용역' ? 'bg-purple-50 text-purple-600 border-purple-100' : row.is_cost_support ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}` },
                                            row.quote_type + (row.is_cost_support ? '(지원)' : '')),
                                        e('span', { className: 'text-[10px] text-slate-400' }, `${row.sampling_days || 1}일`)
                                    ),
                                    `${row.items.length}건`,
                                    `${row.discount_rate}% / ${fmt(row.discount_amount)}`,
                                    e('span', { className: 'text-slate-400 max-w-[150px] truncate block' }, row.notes || '-')
                                ].map((v, i) => e('td', { key: i, className: 'px-3 py-2 whitespace-nowrap text-[11px]' }, v))
                                : REQUIRED_FIELDS.map(f => e('td', { key: f.key, className: 'px-3 py-2 tabular-nums text-[11px]' },
                                    f.key === 'unit_price' ? fmt(row[mapping[f.key]]) : row[mapping[f.key]]
                                ))
                        ))
                    )
                )
            ),
            e('div', { className: 'p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 items-start' },
                e(AlertCircle, { className: 'text-amber-500 shrink-0', size: 18 }),
                e('p', { className: 'text-xs text-amber-700 leading-relaxed font-bold' },
                    mode === 'vba'
                        ? 'VBA 데이터 시트 형식이 감지되어 자동으로 행을 분리했습니다. 위 표는 한 견적서로 통합된 결과의 일부입니다.'
                        : '최대 50개의 행만 미리 보여집니다. 저장 시 전체 데이터가 처리되며, 동일한 거래처와 날짜를 가진 항목들은 하나의 견적서로 자동 통합됩니다.'
                )
            ),
            e('div', { className: 'pt-6 flex gap-3' },
                e('button', { onClick: () => setStep(mode === 'vba' ? 1 : 2), className: 'flex-1 py-4 bg-slate-100 font-bold rounded-2xl transition-colors' }, '이전/수정'),
                e('button', {
                    onClick: doImport,
                    className: 'flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-700 transition-all'
                }, `데이터 일괄 업로드 (총 ${rawRows.length}개)`)
            )
        );
    };

    const renderStep4 = () => e('div', { className: 'flex flex-col items-center justify-center p-12' },
        e(Loader2, { className: 'text-blue-600 animate-spin mb-6', size: 48 }),
        e('h4', { className: 'text-xl font-black text-slate-700 mb-2' }, '데이터 업로드 중...'),
        e('p', { className: 'text-slate-400 text-sm mb-6' }, `${progress.current} / ${progress.total} 건 처리 완료`),
        e('div', { className: 'w-full max-w-xs h-3 bg-slate-100 rounded-full overflow-hidden' },
            e('div', { className: 'h-full bg-blue-600 transition-all duration-300', style: { width: `${(progress.current / progress.total) * 100}%` } })
        )
    );

    return e('div', { className: 'fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6' },
        e('div', { className: 'bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-slideUp' },
            e('div', { className: 'px-8 py-6 border-b flex justify-between items-center bg-slate-50' },
                e('div', null,
                    e('h3', { className: 'text-xl font-black text-slate-800' }, '엑셀 대량 업로드 마법사'),
                    e('p', { className: 'text-xs text-slate-500 mt-1 font-bold' }, '기존 엑셀 데이터를 시스템으로 일관성 있게 마이그레이션합니다.')
                ),
                e('button', { onClick: onClose, className: 'p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors' }, e(X, { size: 24 }))
            ),
            e('div', { className: 'p-8' },
                step === 1 && renderStep1(),
                step === 2 && renderStep2(),
                step === 3 && renderStep3(),
                step === 4 && renderStep4()
            )
        )
    );
}

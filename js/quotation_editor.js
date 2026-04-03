// quotation_editor.js - 견적서 작성/수정 탭 (개선판)
import React, { useState, useEffect, useMemo, useCallback } from 'https://esm.sh/react@18.2.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY, fmt, unf, PROVIDER, DEFAULT_MANAGEMENT_COSTS, DEFAULT_HAZARD_PRICES, DEFAULT_ENGINEERING_FEES, getDefaultNotes } from './quotation_data.js';
import { Plus, Trash2, Search, Printer, Save, X, Eye, HelpCircle } from 'https://esm.sh/lucide-react@0.263.1';

const e = React.createElement;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const today = () => new Date().toISOString().split('T')[0];
const thisYear = () => new Date().getFullYear();

const BLANK_HDR = {
    year: thisYear(), half_year: '상반기', quote_date: today(), valid_days: 30,
    client_id: null, client_name: '', client_manager: '', client_tel: '', client_fax: '', client_address: '', client_ceo: '',
    quote_type: '일반', support_type: '일반', // '일반', '신규지원', '기존지원', '계약'
    workplace_size: '', management_fee: 0, sampling_days: 1,
    discount_rate: 0, discount_amount: 0, round_unit: 0, // 0:없음, 1:1,000원, 2:10,000원
    payment_terms: '현금',
    support_amount: 0, // M열: 공단지원금 (전용 컬럼)
    actual_amount: 0,  // L열: 합계금액(기본관리비+분석수수료)
    preliminary_fee: 0,   // 예비조사 단가 (계약단가 모드에서만 사용)
    preliminary_days: 1,  // 예비조사 횟수
    contract_client_id: null, // 계약단가 적용 시 거래처 ID
    status: '작성중',
    manager_name: '', // 공급처 견적담당자
    title: '작업환경측정 견적서',
    is_discount: false,
    notes: getDefaultNotes('일반', '일반')
};
const BLANK_ITEM = (ord) => ({ _id: Date.now() + ord, sort_order: ord, work_process: '', hazard_name: '', analysis_method: '', unit_type: '식', quantity: 1, unit_price: 0, remarks: '' });

const YONGYEOK_DEFAULTS = [
    { work_process: '기술사', hazard_name: '기술사', unit_type: 1 },
    { work_process: '기사 10년, 산업기사 13년', hazard_name: '특급기술자', unit_type: 1 },
    { work_process: '기사 7년, 산업기사 10년', hazard_name: '고급기술자', unit_type: 1 },
    { work_process: '기사 4년, 산업기사 7년', hazard_name: '중급기술자', unit_type: 1 },
    { work_process: '기사 초임, 산업기사 2년', hazard_name: '초급기술자', unit_type: 1 }
];

// ── 출력 미리보기 (일반/용역) ─────────────────────────────────────
/**
 * 견적서 미리보기 팝업창을 여는 함수 (A4 용지 가시화 및 인쇄 최적화)
 */
export function openPrintPreview(hdr, items, mgmtFee, itemsTotal, sub, disc, vat, total, supportInfo) {
    const isYongYeok = hdr.quote_type === '용역';
    const isRental = hdr.quote_type === '장비대여';
    const isMeasurement = hdr.quote_type === '측정' || hdr.quote_type === '일반';
    const isSupport = isMeasurement && hdr.support_type !== '일반';
    const isTaxable = isYongYeok; // 용역에는 VAT가 포함됩니다. 장비대여도 포함할지는 선택적으로 구성
    const popup = window.open('', '_blank', 'width=1000,height=900,scrollbars=yes');
    if (!popup) {
        alert('팝업창이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
        return;
    }

    const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
    const validUntil = new Date(new Date(hdr.quote_date).getTime() + (hdr.valid_days * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // 할인율 계산
    const baseBeforeDisc = isSupport ? supportInfo.userPay : sub;
    const discRate = baseBeforeDisc > 0 ? Math.round((disc / baseBeforeDisc) * 100) : 0;

    let formattedDate = '-';
    let fileDate = '';
    if (hdr.quote_date) {
        const d = new Date(hdr.quote_date);
        formattedDate = `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
        fileDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const getAbsUrl = (path) => (!path) ? '' : (path.startsWith('http') || path.startsWith('data:')) ? path : (path.startsWith('/') ? window.location.origin + path : baseUrl + path);

    const fileNameSuffix = isSupport ? '(비용지원)' : '';
    const fileNameTitle = isYongYeok ? '용역견적서' : isRental ? '장비대여 견적서' : '작업환경측정 견적서';
    // 지정된 형식: 견적날짜_사업장명_년도 상/하반기 견적서(비용지원).pdf
    const downloadFileName = `${fileDate}_${hdr.client_name || '미지정'}_${isMeasurement ? `${hdr.year}년 ${hdr.half_year} ` : ''}${fileNameTitle}${fileNameSuffix}.pdf`;

    const styles = `
        @media print {
            body { background: none !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            .kiwe-page {
                box-shadow: none !important;
                margin: 0 !important;
                page-break-after: always;
                page-break-inside: avoid;
            }
            @page {
                size: A4;
                margin: 0; /* Important: The margins are inside the kiwe-page via padding! */
            }
        }
        body { 
            background: #e2e8f0; 
            margin: 0; 
            padding: 40px 0; 
            font-family: 'Malgun Gothic', 'Dotum', sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
        }
        .toolbar {
            width: 210mm;
            background: #1e293b;
            color: white;
            padding: 12px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            border-radius: 12px 12px 0 0;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            position: sticky;
            top: 20px;
            z-index: 100;
            box-sizing: border-box;
        }
        .toolbar button {
            padding: 8px 18px;
            border-radius: 8px;
            border: none;
            font-weight: 900;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }
        .btn-print { background: #475569; color: white; }
        .btn-print:hover { background: #334155; transform: translateY(-1px); }
        .btn-pdf { background: #2563eb; color: white; }
        .btn-pdf:hover { background: #1d4ed8; transform: translateY(-1px); }
        .btn-close { background: #dc2626; color: white; margin-left: auto; }
        .btn-close:hover { background: #b91c1c; }
        
        .margin-tool { display: flex; align-items: center; gap: 8px; margin: 0 15px; padding: 0 15px; border-left: 1px solid #475569; border-right: 1px solid #475569; font-size: 12px; height: 30px; }
        .margin-tool input { width: 35px; padding: 2px 4px; border: 1px solid #475569; background: #334155; color: white; border-radius: 3px; text-align: center; }
        .margin-tool label { color: #94a3b8; }
        
        /* A4 Page Layout */
        .kiwe-page {
            width: 210mm;
            height: 296.5mm; /* 297mm에서 미세하게 하향하여 잘림 방지 */
            padding: 10mm; /* Updated via JS */
            box-sizing: border-box;
            background: #fff;
            margin-bottom: 20px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
            border: 1px solid transparent;
            display: flex;
            flex-direction: column;
        }
        
        h1 { text-align: center; font-size: 24pt; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 3mm; margin-top:0; text-decoration: underline; text-underline-offset: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 0; table-layout: fixed; }
        th, td { border: 1px solid #000; padding: 2px 4px; font-size: 8.5pt; height: 7.2mm; box-sizing: border-box; }
        .content-table th, .content-table td { height: ${isYongYeok ? '9.5mm' : '7.2mm'}; }
        .label { background: #f2f2f2; font-weight: bold; text-align: center; width: 55px; }
        .side-title { width: 25px; text-align: center; font-weight: bold; background: #f2f2f2; font-size: 8.5pt; letter-spacing: 2px; }
        .stamp-box { position: relative; text-align: center; font-size: 10pt; }
        .logo-top { position:absolute; right:0; top:-5px; height:50px; }
        .sum-box { width: 400px; margin-left: auto; border: 2px solid #000; margin-bottom: 2mm; margin-top: 2mm; }
        .sum-box th { background: #f5f5f5; width: 200px; text-align: center; padding: 2px 4px; height: ${isYongYeok ? '9.5mm' : 'auto'}; }
        .sum-box td { height: ${isYongYeok ? '9.5mm' : 'auto'}; }
        .total-row { height: ${isYongYeok ? '45px' : '40px'}; background: #eee; font-size: 11pt; font-weight: 900; }
        
        .bold-border { border: 2px solid #000 !important; }
        .bold-border th, .bold-border td { border: 1px solid #000; }
        .fit-cell { white-space: nowrap; overflow: hidden; text-overflow: clip; }
    `;

    const THEAD = isYongYeok ? `
        <tr style="background:#f2f2f2; font-weight:bold;">
            <th style="width:5%;">No</th>
            <th style="width:25%;">항목</th>
            <th style="width:15%;">구분</th>
            <th style="width:10%;">인원</th>
            <th style="width:10%;">조사일수</th>
            <th style="width:12%;">단가</th>
            <th style="width:13%;">금액</th>
            <th style="width:10%;">비고</th>
        </tr>
    ` : isRental ? `
        <tr style="background:#f2f2f2; font-weight:bold;">
            <th style="width:5%;">No</th>
            <th style="width:25%;">대여장비</th>
            <th style="width:20%;">구분(등급/장비명)</th>
            <th style="width:10%;">수량</th>
            <th style="width:10%;">대여일수</th>
            <th style="width:10%;">단가</th>
            <th style="width:12%;">금액</th>
            <th style="width:8%;">비고</th>
        </tr>
    ` : `
        <tr style="background:#f2f2f2; font-weight:bold;">
            <th style="width:4%;">No</th>
            <th style="width:15%;">단위작업장소</th>
            <th style="width:23%;">유해인자</th>
            <th style="width:12%;">분석방법</th>
            <th style="width:7%;">수량</th>
            <th style="width:10%;">단가</th>
            <th style="width:12%;">금액</th>
            <th style="width:8%;">비고</th>
        </tr>
    `;

    // 페이징 처리: 페이지 위치에 따라 수용 가능한 최대 행수 동적 할당
    // 10mm 여백(상하) 기준 최적화된 행 수 (여유 공간 확보)
    const P1_WITH_FOOTER = isYongYeok ? 5 : 14;  // 1페이지 (합계 포함) - 15에서 14로 하향 (여백 10mm 기준)
    const P1_NO_FOOTER = isYongYeok ? 15 : 21; // 1페이지 (합계 미포함)
    const PN_WITH_FOOTER = isYongYeok ? 18 : 29; // 이후페이지 (합계 포함)
    const PN_NO_FOOTER = isYongYeok ? 25 : 35; // 이후페이지 (합계 미포함)

    let remainingItems = [...items];
    const chunks = [];
    let pageIdxCounter = 0;
    let needFooter = true;

    while (needFooter) {
        let isFirstPage = pageIdxCounter === 0;
        let capWithFooter = isFirstPage ? P1_WITH_FOOTER : PN_WITH_FOOTER;
        let capNoFooter = isFirstPage ? P1_NO_FOOTER : PN_NO_FOOTER;

        if (remainingItems.length <= capWithFooter) {
            chunks.push({
                items: remainingItems.splice(0, remainingItems.length),
                isLastPage: true,
                padTo: capWithFooter
            });
            needFooter = false;
        } else {
            chunks.push({
                items: remainingItems.splice(0, capNoFooter),
                isLastPage: false,
                padTo: capNoFooter
            });
        }
        pageIdxCounter++;
    }

    let cumulativeItems = 0;
    const pagesHtml = chunks.map((chunk, pageIdx) => {
        const chunkItems = chunk.items;
        const isFirstPage = pageIdx === 0;
        const isLastPage = chunk.isLastPage;
        const startIndex = cumulativeItems;
        cumulativeItems += chunkItems.length;

        const getRowSpan = (idx, field) => {
            if (idx > 0 && chunkItems[idx - 1][field] === chunkItems[idx][field] && chunkItems[idx][field] !== '') return 0;
            let span = 1;
            for (let i = idx + 1; i < chunkItems.length; i++) {
                if (chunkItems[i][field] === chunkItems[idx][field] && chunkItems[idx][field] !== '') span++;
                else break;
            }
            return span;
        };

        const tbodyHtml = chunkItems.map((it, i) => {
            const wpSpan = getRowSpan(i, 'work_process');
            const rmSpan = getRowSpan(i, 'remarks');
            const absoluteIndex = startIndex + i;
            if (isYongYeok) {
                const wpSpan = getRowSpan(i, 'work_process');
                const rmSpan = getRowSpan(i, 'remarks');
                const amt = it.quantity * (Number(it.unit_type) || 1) * it.unit_price;
                return `
                    <tr>
                        <td style="text-align:center;">${absoluteIndex + 1}</td>
                        ${wpSpan > 0 ? `<td rowspan="${wpSpan}" style="text-align:center; vertical-align:middle; font-size: ${it.work_process?.length > 15 ? '6.5pt' : '8pt'}; letter-spacing: -0.5px;">${it.work_process || ''}</td>` : ''}
                        <td style="text-align:center; font-size: 8pt; letter-spacing: -0.5px;">${it.hazard_name || ''}</td>
                        <td style="text-align:center;">${it.quantity}</td>
                        <td style="text-align:center;">${it.unit_type}</td>
                        <td style="text-align:right;">${fmt(it.unit_price)}</td>
                        <td style="text-align:right; font-weight:bold;">${fmt(amt)}</td>
                        ${rmSpan > 0 ? `<td rowspan="${rmSpan}" style="text-align:center; vertical-align:middle; font-size: 7.5pt;">${it.remarks || ''}</td>` : ''}
                    </tr>
                `;
            } else if (isRental) {
                const wpSpan = getRowSpan(i, 'work_process');
                const rmSpan = getRowSpan(i, 'remarks');
                const amt = it.quantity * (Number(it.unit_type) || 1) * it.unit_price;
                return `
                    <tr>
                        <td style="text-align:center;">${absoluteIndex + 1}</td>
                        ${wpSpan > 0 ? `<td rowspan="${wpSpan}" style="text-align:center; vertical-align:middle; font-size: ${it.work_process?.length > 15 ? '6.5pt' : '8pt'}; letter-spacing: -0.5px;">${it.work_process || ''}</td>` : ''}
                        <td class="fit-cell" style="font-size: ${it.hazard_name?.length > 20 ? '6.5pt' : '8pt'}; letter-spacing: -0.5px;">${it.hazard_name || ''}</td>
                        <td style="text-align:center;">${it.quantity}</td>
                        <td style="text-align:center;">${it.unit_type}</td>
                        <td style="text-align:right;">${fmt(it.unit_price)}</td>
                        <td style="text-align:right; font-weight:bold;">${fmt(amt)}</td>
                        ${rmSpan > 0 ? `<td rowspan="${rmSpan}" style="text-align:center; vertical-align:middle; font-size: 7.5pt;">${it.remarks || ''}</td>` : ''}
                    </tr>
                `;
            } else {
                const wpSpan = getRowSpan(i, 'work_process');
                const rmSpan = getRowSpan(i, 'remarks');
                return `
                    <tr>
                        <td style="text-align:center;">${absoluteIndex + 1}</td>
                        ${wpSpan > 0 ? `<td rowspan="${wpSpan}" style="text-align:center; vertical-align:middle; font-size: ${it.work_process?.length > 15 ? (it.work_process.length > 25 ? '5.5pt' : '6.5pt') : '8pt'}; letter-spacing: -0.5px;">${it.work_process || ''}</td>` : ''}
                        <td class="fit-cell" style="font-size: ${it.hazard_name?.length > 20 ? (it.hazard_name.length > 35 ? '5pt' : '6.5pt') : '8pt'}; letter-spacing: -0.5px;">${it.hazard_name || ''}</td>
                        <td class="fit-cell" style="font-size: ${it.analysis_method?.length > 10 ? '6pt' : '7.5pt'}; text-align:center;">${it.analysis_method || '-'}</td>
                        <td style="text-align:center;">${it.quantity}</td>
                        <td style="text-align:right;">${fmt(it.unit_price)}</td>
                        <td style="text-align:right; font-weight:bold;">${fmt(it.unit_price * it.quantity)}</td>
                        ${rmSpan > 0 ? `<td rowspan="${rmSpan}" style="text-align:center; vertical-align:middle; font-size: 7.5pt;">${it.remarks || ''}</td>` : ''}
                    </tr>
                `;
            }
        }).join('');

        const paddingRows = chunk.padTo - chunkItems.length;
        const padCols = isYongYeok ? 7 : (isRental ? 8 : 8);
        const paddingHtml = Array(paddingRows > 0 ? paddingRows : 0).fill(0).map(() => `
            <tr>
                <td style="height:${isYongYeok ? '9.5mm' : '7.2mm'};"></td>${'<td></td>'.repeat(padCols - 1)}
            </tr>
        `).join('');

        let indirectCostsHtml = '';
        if (isLastPage && isYongYeok) {
            const laborCost = items.reduce((s, it) => s + (it.quantity * (Number(it.unit_type) || 1) * it.unit_price), 0);
            const directExp = Math.floor(laborCost * 0.1);
            const overhead = Math.floor(laborCost * 1.1);
            const techFee = Math.floor((laborCost + overhead) * 0.2);
            indirectCostsHtml = `
            <div style="font-weight:bold; margin-top:2mm; margin-bottom:1.5mm; font-size:9pt;">2. 간접비</div>
            <table class="bold-border content-table" style="margin-bottom:3mm;">
                <thead>
                    <tr style="background:#f2f2f2; font-weight:bold;">
                        <th style="width:30%;">구분</th>
                        <th style="width:40%;">계산식</th>
                        <th style="width:30%;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td style="text-align:center;">직접경비</td><td style="text-align:center;">인건비의 10%</td><td style="text-align:right;">${fmt(directExp)}</td></tr>
                    <tr><td style="text-align:center;">제경비</td><td style="text-align:center;">인건비의 110%</td><td style="text-align:right;">${fmt(overhead)}</td></tr>
                    <tr><td style="text-align:center;">기술료</td><td style="text-align:center;">(인건비+제경비)의 20%</td><td style="text-align:right;">${fmt(techFee)}</td></tr>
                </tbody>
            </table>
            `;
        }

        let sumBoxHtml = '';
        if (isLastPage) {
            if (isYongYeok) {
                const laborCost = items.reduce((s, it) => s + (it.quantity * (Number(it.unit_type) || 1) * it.unit_price), 0);
                const directExp = Math.floor(laborCost * 0.1);
                const overhead = Math.floor(laborCost * 1.1);
                const techFee = Math.floor((laborCost + overhead) * 0.2);
                const indirectSum = directExp + overhead + techFee;
                const subTotal = laborCost + indirectSum;
                sumBoxHtml = `
                        <table class="sum-box" style="margin-bottom:2mm; margin-top:0;">
                            <tr><th style="text-align:center;">인건비 소계</th><td style="text-align:right; font-weight:bold;">${fmt(laborCost)}</td></tr>
                            <tr><th style="text-align:center;">간접비 소계</th><td style="text-align:right; font-weight:bold;">${fmt(indirectSum)}</td></tr>
                            <tr><th style="text-align:center;">합계금액(인건비+간접비)</th><td style="text-align:right; font-weight:bold;">${fmt(subTotal)}</td></tr>
                            ${disc > 0 ? `<tr><th>할인(조정)액</th><td style="text-align:right; color:#c00;">- ${fmt(disc)}</td></tr>` : ''}
                            <tr><th style="text-align:center;">부가가치세(10%)</th><td style="text-align:right; font-weight:bold;">${fmt(vat)}</td></tr>
                            <tr class="total-row"><th>최종견적금액 (VAT포함)</th><td style="text-align:right; font-size:15pt; padding:0 10px;">₩ ${fmt(total)}</td></tr>
                        </table>
                `;
            } else if (isRental) {
                sumBoxHtml = `
                        <table class="sum-box" style="margin-bottom:2mm; margin-top:0;">
                            <tr><th style="text-align:center;">합계금액</th><td style="text-align:right; font-weight:bold;">${fmt(sub)}</td></tr>
                            ${disc > 0 ? `<tr><th>할인액</th><td style="text-align:right; color:#c00;">- ${fmt(disc)}</td></tr>` : ''}
                            <tr class="total-row"><th>최종견적금액</th><td style="text-align:right; font-size:15pt; padding:0 10px;">₩ ${fmt(total)}</td></tr>
                        </table>
                `;
            } else {
                const isContractMode = hdr.support_type === '계약';
                const prelimAmt = isContractMode ? ((hdr.preliminary_fee || 0) * (hdr.preliminary_days || 1)) : 0;
                const sumLabel = isContractMode ? '합계금액(예비조사+기본관리비+분석수수료)' : '합계금액(기본관리비+분석수수료)';
                sumBoxHtml = `
                        <table class="sum-box" style="margin-bottom:2mm; margin-top:0;">
                            ${isContractMode && prelimAmt > 0 ? `<tr><th style="text-align:center;">예비조사 소계</th><td style="text-align:right; font-weight:bold;">${fmt(prelimAmt)}</td></tr>` : ''}
                            <tr><th style="text-align:center;">기본관리비 소계</th><td style="text-align:right; font-weight:bold;">${fmt(mgmtFee)}</td></tr>
                            <tr><th style="text-align:center;">분석수수료 합계</th><td style="text-align:right; font-weight:bold;">${fmt(itemsTotal)}</td></tr>
                            <tr><th style="text-align:center;">${sumLabel}</th><td style="text-align:right; font-weight:bold;">${fmt(sub)}</td></tr>
                            ${isSupport ? `<tr><th style="color:#059669;">공단지원금</th><td style="text-align:right; color:#059669; font-weight:bold;">- ${fmt(supportInfo.amount)}</td></tr>` : ''}
                            ${discRate > 0 ? `<tr><th>할인율(${discRate}%)</th><td style="text-align:right; color:#c00;">- ${fmt(disc)}</td></tr>` : ''}
                            <tr class="total-row"><th>최종견적금액 ${isTaxable ? '(VAT포함)' : ''}</th><td style="text-align:right; font-size:15pt; padding:0 10px;">₩ ${fmt(total)}</td></tr>
                        </table>
                `;
            }
        }

        const footerHtml = isLastPage ? `
            <div style="margin-top: auto; display: flex; flex-direction: column;">
                ${indirectCostsHtml ? `<div>${indirectCostsHtml}</div>` : ''}
                <div style="display:flex; justify-content:flex-end; margin-top: 2mm;">
                    ${sumBoxHtml}
                </div>
                <div style="margin-top: 2mm; border:1.5px solid #000; padding:8px 10px; font-size:8.5pt; line-height:1.4; box-sizing:border-box; min-height:15mm; flex-shrink: 0; overflow: visible;">
                    <p style="font-weight:bold; margin-bottom:4px; text-decoration:underline;">[ 특기사항 및 안내 ]</p>
                    <div style="white-space: pre-wrap; word-break: break-all;">${hdr.notes || getDefaultNotes(hdr.quote_type, hdr.support_type)}</div>
                </div>
            </div>
        ` : '';

        const page1HeaderHtml = isFirstPage ? `
            <div style="position:relative; text-align:center; margin-bottom:3mm;">
                <h1>${hdr.title || (isYongYeok ? '용역견적서' : '작업환경측정 견적서')}</h1>
                <img src="${getAbsUrl('images/logo_up.png')}" class="logo-top" alt="CI" crossorigin="anonymous">
            </div>

            <div style="display:flex; justify-content:space-between; gap:2mm; margin-bottom:3mm;">
                <!-- 수신처 -->
                <div style="width:46%;">
                    <table class="bold-border">
                        <colgroup>
                            <col style="width: 28px;">
                            <col style="width: 60px;">
                            <col style="width: auto;">
                            <col style="width: 60px;">
                            <col style="width: auto;">
                        </colgroup>
                        <tr>
                            <td rowspan="6" class="side-title">수<br>신<br>처</td>
                            <td class="label">견적일자</td>
                            <td colspan="3" class="fit-cell" style="text-align:center; font-size:${hdr.client_name?.length > 15 ? '8pt' : '10.5pt'};">${formattedDate}</td>
                        </tr>
                        <tr>
                            <td class="label">사업장명</td>
                            <td colspan="3" style="text-align:center; font-size:${hdr.client_name?.length > 25 ? '8.5pt' : (hdr.client_name?.length > 15 ? '9.5pt' : '11pt')}; font-weight:bold; line-height: 1.1; padding: 2px 6px; height: 12mm; vertical-align: middle; white-space: normal; word-break: keep-all;">${hdr.client_name || ''}</td>
                        </tr>
                        <tr>
                            <td class="label">전 화</td>
                            <td class="fit-cell" style="text-align:center; font-size:${hdr.client_tel?.length > 13 ? '6.5pt' : '8.5pt'}; padding:5px 2px;">${hdr.client_tel || '-'}</td>
                            <td class="label">팩 스</td>
                            <td class="fit-cell" style="text-align:center; font-size:${hdr.client_fax?.length > 13 ? '6.5pt' : '8.5pt'}; padding:5px 2px;">${hdr.client_fax || '-'}</td>
                        </tr>
                        <tr>
                            <td class="label">담당자</td>
                            <td colspan="2" class="fit-cell" style="text-align:center; font-weight:bold; font-size:10pt; border-right:none;">${hdr.client_manager || ''}</td>
                            <td style="text-align:right; border-left:none; font-size:9pt;">귀하</td>
                        </tr>
                        <tr>
                            <td class="label">주 소</td>
                            <td colspan="3" class="fit-cell" style="font-size:${hdr.client_address?.length > 25 ? '7pt' : '8pt'};">${hdr.client_address || ''}</td>
                        </tr>
                        <tr>
                            <td class="label">견적정보</td>
                            <td colspan="3" class="fit-cell">${hdr.quote_no || '(신규)'} (유효기간: ${hdr.valid_days}일)</td>
                        </tr>
                    </table>
                </div>
                  <!-- 공급처 -->
                <div style="width:51%;">
                    <table class="bold-border">
                        <colgroup>
                            <col style="width: 28px;">
                            <col style="width: 60px;">
                            <col style="width: auto;">
                            <col style="width: 60px;">
                            <col style="width: auto;">
                        </colgroup>
                        <tr>
                            <td rowspan="6" class="side-title">공<br>급<br>자</td>
                            <td class="label">기 관 명</td>
                            <td colspan="3" class="fit-cell" style="text-align:center; font-weight:bold; font-size:10pt;">${PROVIDER.name}</td>
                        </tr>
                        <tr>
                            <td class="label">등록번호</td>
                            <td class="fit-cell" style="text-align:center; font-size:9pt; font-weight:bold;">${PROVIDER.biz_no}</td>
                            <td class="label">대표자</td>
                            <td class="stamp-box fit-cell" style="overflow:visible;">
                                ${PROVIDER.ceo}
                                ${PROVIDER.stamp_url ? `<img src="${getAbsUrl(PROVIDER.stamp_url)}" style="position:absolute; right:0px; top:-25px; height:65px; mix-blend-mode:multiply; pointer-events:none; z-index:10;" crossorigin="anonymous">` : '<span style="position:absolute; right:0px; top:-10px; border:2px solid #c00; border-radius:50%; width:30px; height:30px; line-height:30px; color:#c00; font-weight:bold;">인</span>'}
                            </td>
                        </tr>
                        <tr>
                            <td class="label">주 소</td>
                            <td colspan="3" style="font-size: 8pt; line-height: 1.2; padding: 4px 6px; height: 12mm; vertical-align: middle;">
                                ${PROVIDER.address.replace('산단로 325,', '산단로 325,<br>')}
                            </td>
                        </tr>
                        <tr>
                            <td class="label">업 태</td>
                            <td style="font-size: 7.5pt; white-space: normal; line-height: 1.1;">${PROVIDER.biz_type}</td>
                            <td class="label">업 종</td>
                            <td style="font-size: 7.5pt; white-space: normal; line-height: 1.1;">${PROVIDER.biz_item}</td>
                        </tr>
                        <tr>
                            <td class="label">전 화</td>
                            <td class="fit-cell" style="text-align:center; font-size:${PROVIDER.tel?.length > 13 ? '7.5pt' : '8.5pt'};">${PROVIDER.tel}</td>
                            <td class="label">팩 스</td>
                            <td class="fit-cell" style="text-align:center; font-size:${PROVIDER.fax?.length > 13 ? '7.5pt' : '8.5pt'};">${PROVIDER.fax}</td>
                        </tr>
                        <tr>
                            <td class="label">견적담당</td>
                            <td colspan="3" class="fit-cell" style="text-align:center; font-weight:bold;">${hdr.manager_name || '이승용'}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <p style="font-weight:bold; margin-bottom:4px; text-align:center; font-size:10pt;">${isMeasurement ? `${hdr.year}년 ${hdr.half_year} ` : ''}${hdr.title || fileNameTitle}${(() => {
                const t = hdr.title || fileNameTitle;
                if (!t) return '을';
                const lastChar = t.charCodeAt(t.length - 1);
                if (lastChar < 0xAC00 || lastChar > 0xD7A3) return '을';
                const jong = (lastChar - 0xAC00) % 28;
                return jong > 0 ? '을' : '를';
            })()
            } 아래와 같이 작성합니다.</p>

            ${isMeasurement ? `
            <div style="font-weight:bold; margin-bottom:2mm; font-size:10pt;">1. 기본관리비</div>
            <table class="bold-border" style="margin-bottom:3mm;">
                <colgroup>
                    <col style="width: 15%;">
                    <col style="width: 35%;">
                    <col style="width: 15%;">
                    <col style="width: 35%;">
                </colgroup>
                <tr>
                    <td class="label">규 격</td>
                    <td style="text-align:center;">${hdr.workplace_size || '-'}</td>
                    <td class="label">측정일수</td>
                    <td style="text-align:center;">${hdr.sampling_days || 1}일</td>
                </tr>
                <tr>
                    <td class="label">기본단가</td>
                    <td style="text-align:right; padding-right:10px;">₩ ${fmt(hdr.management_fee)}</td>
                    <td class="label">소 계</td>
                    <td style="text-align:right; padding-right:10px; font-weight:bold; background:#f2f2f2;">₩ ${fmt(mgmtFee)}</td>
                </tr>
            </table>
            ` : ''}
        ` : '';

        const tableTitle = isFirstPage ?
            (isRental ? `<div style="text-align:center; font-weight:bold; font-size:12pt; margin-bottom:1.5mm;">세부사항</div>`
                : isYongYeok ? `<div style="font-weight:bold; margin-bottom:1.5mm; font-size:9pt;">1. 인건비</div>`
                    : `<div style="font-weight:bold; margin-bottom:1.5mm; font-size:9pt;">2. 분석수수료</div>`)
            : (isRental ? `<div style="text-align:center; font-weight:bold; font-size:12pt; margin-bottom:1.5mm;">세부사항 (계속)</div>`
                : isYongYeok ? `<div style="font-weight:bold; margin-bottom:1.5mm; font-size:9pt;">1. 인건비 (계속)</div>`
                    : `<div style="font-weight:bold; margin-bottom:1.5mm; font-size:9pt;">2. 분석수수료 (계속)</div>`);

        return `
            <div class="kiwe-page" id="page-${pageIdx}">
                ${page1HeaderHtml}
                ${tableTitle}
                <div>
                    <table class="bold-border content-table">
                        <thead>${THEAD}</thead>
                        <tbody>
                            ${tbodyHtml}
                            ${paddingHtml}
                        </tbody>
                    </table>
                </div>
                ${footerHtml}
            </div>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${hdr.client_name || '견적서'} - 미리보기</title>
            <style>${styles}</style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <script>
                function updateMargins() {
                    const top = document.getElementById('m-top').value || 10;
                    const bottom = document.getElementById('m-bottom').value || 10;
                    const left = document.getElementById('m-left').value || 10;
                    const right = document.getElementById('m-right').value || 10;
                    
                    document.querySelectorAll('.kiwe-page').forEach(page => {
                        page.style.padding = top + 'mm ' + right + 'mm ' + bottom + 'mm ' + left + 'mm';
                    });
                    
                    localStorage.setItem('kiwe_quote_margins', JSON.stringify({ top, bottom, left, right }));
                }
                
                window.onload = function() {
                    const saved = localStorage.getItem('kiwe_quote_margins');
                    if(saved) {
                        const m = JSON.parse(saved);
                        // 혹시 10mm보다 너무 작거나 비어있으면 10mm로 자동 보정
                        document.getElementById('m-top').value = m.top || 10;
                        document.getElementById('m-bottom').value = m.bottom || 10;
                        document.getElementById('m-left').value = m.left || 10;
                        document.getElementById('m-right').value = m.right || 10;
                    } else {
                        // 저장된 값이 없으면 상하 10mm 강제 적용
                        document.getElementById('m-top').value = 10;
                        document.getElementById('m-bottom').value = 10;
                    }
                    updateMargins();
                };

                async function saveAsPdf() {
                    const btnPdf = document.querySelector('.btn-pdf');
                    const originalText = btnPdf.innerText;
                    btnPdf.innerText = '저장 중...';
                    btnPdf.disabled = true;

                    // 스크롤 상단 이동 (html2canvas 빈 스크린 렌더링 방지)
                    window.scrollTo(0, 0);

                    const pages = document.querySelectorAll('.kiwe-page');
                    const originalStyles = [];
                    
                    // html2pdf can render the container with multiple pages.
                    // 화면에 이미 보이는 요소를 활용해 PDF 생성 (빈 페이지 문제 해결)
                    pages.forEach((page, i) => {
                        originalStyles.push(page.style.cssText);
                        // 확실한 렌더링을 위해 배경색 명시 및 레이아웃 정리
                        page.style.backgroundColor = 'white';
                        page.style.margin = '0';
                        page.style.boxShadow = 'none';
                        page.style.border = 'none';
                        
                        // html2pdf 렌더링 시 픽셀 계산 오차로 마지막에 빈 페이지가 삽입되는 것을 막기 위한 미세 높이 조절
                        page.style.height = '296.5mm';
                        page.style.overflow = 'hidden';

                        // 마지막 페이지가 아닐 때만 강제 페이지 분할 옵션 적용
                        if (i < pages.length - 1) {
                            page.style.pageBreakAfter = 'always';
                        } else {
                            page.style.pageBreakAfter = 'auto';
                        }
                    });
                    
                    const opt = {
                        margin:       0, // 내부 패딩 사용
                        filename:     '${downloadFileName}',
                        image:        { type: 'jpeg', quality: 1.0 },
                        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0, windowWidth: 1024 },
                        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    try {
                        const targetElement = document.getElementById('pages-container');
                        // 기본 save() 메서드를 호출하여 브라우저 설정에 따라 다운로드 폴더 자동 저장
                        await html2pdf().set(opt).from(targetElement).save();
                    } catch (err) {
                        alert('PDF 저장 중 오류가 발생했습니다.');
                        console.error(err);
                    } finally {
                        // 원래 스타일 복구
                        pages.forEach((page, i) => {
                            page.style.cssText = originalStyles[i];
                        });
                        btnPdf.innerText = originalText;
                        btnPdf.disabled = false;
                    }
                }
            </script>
        </head>
        <body>
            <div class="toolbar no-print">
                <span style="font-weight:900; font-size:14px; white-space:nowrap;">📄 ${isYongYeok ? '용역' : '일반'} 견적서</span>
                
                <div class="margin-tool">
                    <span style="font-weight:bold; color:#fff; margin-right:5px;">여백(mm):</span>
                    <label>상</label><input type="number" id="m-top" value="10" oninput="updateMargins()">
                    <label>하</label><input type="number" id="m-bottom" value="10" oninput="updateMargins()">
                    <label>좌</label><input type="number" id="m-left" value="10" oninput="updateMargins()">
                    <label>우</label><input type="number" id="m-right" value="10" oninput="updateMargins()">
                </div>

                <div style="display: flex; gap: 8px;">
                    <button class="btn-print" onclick="window.print()">🖨️ 일반 인쇄</button>
                    <button class="btn-pdf" onclick="saveAsPdf()">💾 PDF 저장</button>
                    <button class="btn-close" onclick="window.close()">✕ 닫기</button>
                </div>
            </div>
            
            <div id="pages-container">
                ${pagesHtml}
            </div>
        </body>
        </html>
    `;

    popup.document.write(html);
    popup.document.close();
}


// ── 메인 에디터 ─────────────────────────────────────────────────
export function QuotationEditor({ editId, onSave, onCancel }) {
    const [hdr, setHdr] = useState(BLANK_HDR);
    const [items, setItems] = useState([BLANK_ITEM(0)]);
    const [clients, setClients] = useState([]);
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDrop, setShowClientDrop] = useState(false);
    const [saving, setSaving] = useState(false);

    // DB 단가 목록 (복구됨)
    const [mgmtPrices, setMgmtPrices] = useState(DEFAULT_MANAGEMENT_COSTS);
    const [supportMgmtPrices, setSupportMgmtPrices] = useState([]);
    const [analysisPrices, setAnalysisPrices] = useState(DEFAULT_HAZARD_PRICES);
    const [engPrices, setEngPrices] = useState(DEFAULT_ENGINEERING_FEES);
    const [rentalPrices, setRentalPrices] = useState([]);
    const [supportPolicies, setSupportPolicies] = useState({});

    useEffect(() => {
        loadClients();
        if (editId) loadEdit(editId);
        else {
            // 새 견기서인 경우 로그인 사용자명 세팅
            const user = JSON.parse(localStorage.getItem('kiwe_user') || '{}');
            const userNameWithTitle = user.user_name ? `${user.user_name}${user.user_title ? ' ' + user.user_title : ''}` : '이승용';
            setH('manager_name', userNameWithTitle);
        }
    }, [editId]);

    // year 또는 비용지원 유형 바뀌면 단가 재로드 (인자 명시로 stale state 방지)
    useEffect(() => { loadDBPrices(hdr.year, hdr.support_type, hdr.contract_client_id); }, [hdr.year, hdr.support_type, hdr.contract_client_id, hdr.is_discount]);


    async function loadDBPrices(year, supportType, contractClientId) {
        // year/supportType이 없으면 현재 hdr에서 읽음 (초기 로드 시)
        const yr = year !== undefined ? year : hdr.year;
        const sType = supportType !== undefined ? supportType : hdr.support_type;
        const cClientId = contractClientId !== undefined ? contractClientId : hdr.contract_client_id;
        const isContract = sType === '계약';
        try {
            const isSupport = sType !== '일반';
            const pt = isSupport ? '비용지원' : '일반';
            // 모든 price_type을 가져와 기본관리비를 함께 로드
            const { data } = await sb.from('kiwe_price_settings').select('*')
                .eq('year', yr).order('sort_order');

            const nextMgmt = [...DEFAULT_MANAGEMENT_COSTS];
            const nextSupportMgmt = [];
            const nextAna = [...DEFAULT_HAZARD_PRICES];
            const nextEng = [...DEFAULT_ENGINEERING_FEES];
            const nextRental = [];
            const policies = {};
            let nextPrelimFee = 0; // 계약단가 모드일 때 예비조사 단가

            // 계약단가 모드: 해당 거래체 price_type='계약_[id]' 데이터 로드
            if (isContract && cClientId) {
                const pt = `계약_${cClientId}`;
                const { data: cData } = await sb.from('kiwe_price_settings').select('*')
                    .eq('price_type', pt).order('sort_order');
                if (cData && cData.length > 0) {
                    const cMgmt = cData.filter(d => d.category === '기본관리비');
                    const cPrelim = cData.filter(d => d.category === '예비조사');
                    const cAna = cData.filter(d => d.category === '분석수수료');
                    if (cMgmt.length > 0) nextMgmt.splice(0, nextMgmt.length, ...cMgmt.map(d => ({ item_name: d.item_name, unit_price: d.unit_price })));
                    if (cPrelim.length > 0) nextPrelimFee = cPrelim[0].unit_price || 0;
                    if (cAna.length > 0) nextAna.splice(0, nextAna.length, ...cAna.map(d => ({ item_name: d.item_name, unit_price: d.unit_price })));
                }
                setMgmtPrices(nextMgmt);
                setAnalysisPrices(nextAna);
                setEngPrices(nextEng);
                setRentalPrices(nextRental);
                setSupportPolicies({});
                // 예비조사 단가 자동세팅
                setHdr(p => ({
                    ...p,
                    preliminary_fee: nextPrelimFee,
                    management_fee: (() => {
                        const norm = s => (s || '').toString().trim().replace(/사업장/g, '').replace(/\s+/g, '');
                        const found = nextMgmt.find(m => norm(m.item_name) === norm(p.workplace_size));
                        return found ? Number(found.unit_price) || 0 : p.management_fee;
                    })()
                }));
                setItems(prevItems => prevItems.map(it => {
                    const found = nextAna.find(h => h.item_name === it.analysis_method);
                    return found ? { ...it, unit_price: found.unit_price } : it;
                }));
                return; // 계약단가 로드 완료, 이하 일반 로직 실행 안함
            }

            if (data && data.length > 0) {
                const dbMgmtGen = data.filter(d => d.price_type === '일반' && d.category === '기본관리비');
                const dbMgmtSup = data.filter(d => d.price_type === '비용지원' && d.category === '기본관리비');
                // 분석수수료는 현재 선택된 pt에 맞게
                const dbAna = data.filter(d => d.price_type === pt && d.category === '분석수수료');
                const dbEng = data.filter(d => d.category === '엔지니어링노임');
                const dbRental = data.filter(d => d.category === '장비대여');
                const dbPol = data.filter(d => d.category === '지원정책');

                if (dbMgmtGen.length > 0) nextMgmt.splice(0, nextMgmt.length, ...dbMgmtGen.map(d => ({ item_name: d.item_name, unit_price: d.unit_price })));
                if (dbMgmtSup.length > 0) nextSupportMgmt.push(...dbMgmtSup.map(d => ({ item_name: d.item_name, unit_price: d.unit_price })));
                if (dbAna.length > 0) nextAna.splice(0, nextAna.length, ...dbAna.map(d => ({ item_name: d.item_name, unit_price: d.unit_price })));
                if (dbEng.length > 0) nextEng.splice(0, nextEng.length, ...dbEng.map(d => ({ item_name: d.item_name, unit_price: d.unit_price })));
                if (dbRental.length > 0) nextRental.push(...dbRental.map(d => ({ item_name: d.item_name, unit_price: d.unit_price })));
                dbPol.forEach(p => policies[p.item_name] = p.unit_price);
            }

            // ★ 할인단가 (정액할인) 덮어쓰기 로직
            if (hdr.is_discount) {
                const { data: dData } = await sb.from('kiwe_price_settings').select('*')
                    .eq('price_type', '할인단가').eq('year', 0).order('sort_order');
                if (dData && dData.length > 0) {
                    const dMgmt = dData.filter(d => d.category === '기본관리비');
                    const dAna = dData.filter(d => d.category === '분석수수료');

                    const applyDiscount = (list, dList) => {
                        list.forEach(item => {
                            const hit = dList.find(d => d.item_name === item.item_name);
                            if (hit && hit.unit_price > 0) item.unit_price = hit.unit_price;
                        });
                    };
                    applyDiscount(nextMgmt, dMgmt);
                    applyDiscount(nextSupportMgmt, dMgmt);
                    applyDiscount(nextAna, dAna);
                }
            }

            setMgmtPrices(nextMgmt);
            // 비용지원 기본관리비가 DB에 없으면 일반 기본관리비라도 사용하도록 보충
            setSupportMgmtPrices(nextSupportMgmt.length > 0 ? nextSupportMgmt : nextMgmt);
            setAnalysisPrices(nextAna);
            setEngPrices(nextEng);
            setRentalPrices(nextRental);
            setSupportPolicies(policies);

            // ★ 연도나 지원유형이 바뀌었을 때 기존 데이터들을 최신 단가로 갱신
            setHdr(p => {
                const currentSize = p.workplace_size;
                if (!currentSize) return p;

                // 정규화 함수: 공백 제거, '사업장' 제거 등 (더 강력하게)
                const norm = (s) => (s || '').toString().trim().replace(/사업장/g, '').replace(/\s+/g, '');
                const target = norm(currentSize);

                let found = null;
                // 비용지원인 경우 지원단가(supportMgmtPrices)에서 먼저 찾음 (이미 보충됨)
                if (sType !== '일반') {
                    found = nextSupportMgmt.find(m => norm(m.item_name) === target);
                }
                // 못 찾았거나 일반인 경우 일반단가(nextMgmt)에서 찾음
                if (!found) {
                    found = nextMgmt.find(m => norm(m.item_name) === target);
                }

                if (found) {
                    const nextFee = Number(found.unit_price) || 0;
                    if (nextFee !== p.management_fee) {
                        return { ...p, management_fee: nextFee };
                    }
                }
                return p;
            });

            setItems(prevItems => prevItems.map(it => {
                let newPrice = it.unit_price;
                // 용역인 경우 엔지니어링 노임 우선, 장비대여는 장비대여, 일반/측정인 경우 분석방법 기반
                if (hdr.quote_type === '용역') {
                    const found = nextEng.find(f => f.item_name === it.hazard_name);
                    if (found) newPrice = found.unit_price;
                } else if (hdr.quote_type === '장비대여') {
                    const found = nextRental.find(f => f.item_name === it.hazard_name);
                    if (found) newPrice = found.unit_price;
                } else {
                    // 분석방법(analysis_method)이 우선 순위, 없으면 유해인자명(hazard_name)으로 찾기 시도
                    const foundAna = nextAna.find(h => h.item_name === it.analysis_method);
                    if (foundAna) newPrice = foundAna.unit_price;
                    else {
                        const foundEng = nextEng.find(f => f.item_name === (it.analysis_method || it.hazard_name));
                        if (foundEng) newPrice = foundEng.unit_price;
                    }
                }
                return { ...it, unit_price: newPrice };
            }));

        } catch (err) { console.warn('단가 DB 로드 실패:', err.message); }
    }

    async function loadClients() {
        const { data } = await sb.from('kiwe_quotation_clients').select('*').order('client_name');
        setClients(data || []);
    }

    async function loadEdit(id) {
        try {
            const [{ data: q }, { data: its }] = await Promise.all([
                sb.from('kiwe_quotations').select('*').eq('id', id).single(),
                sb.from('kiwe_quotation_items').select('*').eq('quotation_id', id).order('sort_order')
            ]);
            if (q) {
                // 거래처 상세 정보가 q에 없는 경우(구버전) 거래처 테이블에서 가져오기 시도
                let cInfo = {};
                if (q.client_id && (!q.client_address || !q.client_tel)) {
                    const { data: c } = await sb.from('kiwe_quotation_clients').select('*').eq('id', q.client_id).single();
                    if (c) {
                        cInfo = {
                            client_tel: q.client_tel || c.tel || '',
                            client_fax: q.client_fax || c.fax || '',
                            client_address: q.client_address || c.address || '',
                            client_ceo: q.client_ceo || c.ceo_name || '',
                            client_manager: q.client_manager || c.manager_name || c.ceo_name || ''
                        };
                    }
                }

                let real_support = q.support_type || '일반';
                let is_disc = false;
                if (real_support.endsWith('_할인')) {
                    is_disc = true;
                    real_support = real_support.replace('_할인', '');
                }

                setHdr({
                    ...BLANK_HDR,
                    ...q,
                    ...cInfo,
                    support_type: real_support,
                    is_discount: is_disc,
                    management_fee: Number(q.management_fee) || 0,
                    manager_name: q.manager_name || q.created_by || '이승용',
                    title: q.title || '작업환경측정 견적서',
                    total_amount: Number(q.total_amount) || 0
                });
                setClientSearch(q.client_name || '');
            }
            if (its && its.length > 0) {
                setItems(its.map(it => ({
                    ...it,
                    _id: it.id,
                    quantity: Number(it.quantity) || 0,
                    unit_price: Number(it.unit_price) || 0
                })));
            }
        } catch (err) { console.error('로드 실패:', err); }
    }

    const isYongYeok = hdr.quote_type === '용역';
    const isRental = hdr.quote_type === '장비대여';
    const isMeasurement = hdr.quote_type === '측정' || hdr.quote_type === '일반';
    const isContract = isMeasurement && hdr.support_type === '계약'; // 계약단가 모드

    const prelimSub = isContract ? (hdr.preliminary_fee || 0) * (hdr.preliminary_days || 1) : 0;
    const mgmtFee = isMeasurement ? (hdr.management_fee || 0) * (hdr.sampling_days || 1) : 0;
    const itemsTotal = useMemo(() => items.reduce((s, it) => {
        if (isYongYeok || isRental) return s + (it.quantity * (Number(it.unit_type) || 1) * it.unit_price);
        return s + it.quantity * it.unit_price;
    }, 0), [items, isYongYeok, isRental]);

    let sub = 0;
    if (isYongYeok) {
        const laborCost = itemsTotal;
        const directExp = Math.floor(laborCost * 0.1);
        const overhead = Math.floor(laborCost * 1.1);
        const techFee = Math.floor((laborCost + overhead) * 0.2);
        sub = laborCost + directExp + overhead + techFee;
    } else {
        sub = prelimSub + mgmtFee + itemsTotal; // 계약단가에서는 prelimSub가 합산됨 (일반에서는 0이므로 무시)
    }
    const isSupport = isMeasurement && hdr.support_type !== '일반' && hdr.support_type !== '계약';

    // ── 비용지원 정보 및 기초 금액 계산 ──────────────────────────
    const supportInfo = useMemo(() => {
        if (!isSupport) return { rate: 0, amount: 0, limit: 0, userPay: sub, actualAmt: sub };

        const prefix = hdr.support_type === '신규지원' ? '신규' : '기존';
        const rate = supportPolicies[`${prefix}_지원율`] || (hdr.support_type === '신규지원' ? 100 : 80);
        const limit = supportPolicies[`${prefix}_한도`] || (hdr.support_type === '신규지원' ? 1000000 : 400000);

        let calcAmt = Math.floor(sub * (rate / 100));
        if (calcAmt > limit) calcAmt = limit;

        // 사용자가 명시적으로 M열 값을 입력했다면 그 값을 우선, 아니면 자동 계산값 사용
        const finalAmt = (hdr.support_amount && hdr.support_amount > 0) ? hdr.support_amount : calcAmt;
        const afterSubsidy = sub - finalAmt;
        const actualRate = sub > 0 ? Math.round((finalAmt / sub) * 100) : 0;

        return { rate: actualRate, amount: finalAmt, limit, userPay: afterSubsidy, actualAmt: sub };
    }, [sub, isSupport, hdr.support_type, hdr.support_amount, supportPolicies]);

    // ── 최종 견적금액 및 할인 계산 ──────────────────────────────
    // 1. 기초 금액 (지원금 제외 후 금액)
    const baseAmtAfterSubsidy = supportInfo.userPay;

    // 2. 최종 견적금액 (희망금액 우선 -> 할인율 -> 원본)
    let targetTotal = baseAmtAfterSubsidy;
    if (hdr.discount_amount > 0) {
        targetTotal = hdr.discount_amount;
    } else if (hdr.discount_rate > 0) {
        targetTotal = Math.round(baseAmtAfterSubsidy * (1 - hdr.discount_rate / 100));
    }

    // 3. 절삭 적용
    let roundedTotal = targetTotal;
    if (hdr.round_unit === 1) roundedTotal = Math.floor(targetTotal / 1000) * 1000;
    else if (hdr.round_unit === 2) roundedTotal = Math.floor(targetTotal / 10000) * 10000;

    const selectable = roundedTotal;
    // 용역은 VAT 포함 (10% 부가가치세 별도 항목이 명시적으로 존재하나 합계표에 표기)
    const isTaxable = isYongYeok;
    const vat = isTaxable ? Math.round(selectable * 0.1) : 0;
    const total = selectable + (isTaxable ? vat : 0);

    // 4. 실제 할인액 및 할인율 (문구 표시용)
    const discAmt = baseAmtAfterSubsidy - selectable;

    function setH(k, v) {
        setHdr(p => {
            const next = { ...p, [k]: v };
            // quote_date가 변경되면 year 필드도 자동 동기화
            if (k === 'quote_date' && v) {
                const parsed = parseInt(v.slice(0, 4), 10);
                if (!isNaN(parsed)) next.year = parsed;
            }
            // quote_type 이나 support_type이 변경되었을 때, notes가 비어있거나 기존 기본값 중 하나라면 새 기본값으로 업데이트
            if (k === 'quote_type' || k === 'support_type') {
                const currentDefault = getDefaultNotes(p.quote_type, p.support_type);
                const isOldDefault = p.notes && (p.notes.includes('발행일로부터 30일간 유효') || p.notes.includes('건강디딤돌사업'));
                if (!p.notes || p.notes.trim() === '' || p.notes === currentDefault || isOldDefault) {
                    if ((k === 'support_type' && v === '계약') || (k !== 'support_type' && next.support_type === '계약')) {
                        next.notes = '‡ 본 견적서는 별도 계약에 의한 단가를 적용하여 작성되었습니다.\n‡ 예비조사 후 측정이 진행됩니다.\n‡ 야간 및 휴일근로 발생 시 근로기준법 제56조에 의거 가산할증이 적용됩니다.';
                    } else {
                        next.notes = getDefaultNotes(next.quote_type, next.support_type);
                    }
                }
            }
            // 계약 → 다른 타입으로 전환 시 계약 관련 필드 초기화
            if (k === 'support_type' && v !== '계약') {
                next.contract_client_id = null;
                next.preliminary_fee = 0;
                next.preliminary_days = 1;
            }
            return next;
        });
    }

    function selectMgmt(name) {
        if (hdr.workplace_size === name) {
            setHdr(p => ({ ...p, workplace_size: '', management_fee: 0 }));
            return;
        }
        const found = mgmtPrices.find(m => m.item_name === name) || supportMgmtPrices.find(m => m.item_name === name);
        setHdr(p => ({ ...p, workplace_size: name, management_fee: found ? found.unit_price : 0 }));
    }

    function selectClient(c) {
        setHdr(p => ({
            ...p,
            client_id: c.id,
            client_name: c.client_name,
            client_tel: c.tel || '',
            client_fax: c.fax || '',
            client_address: c.address || '',
            client_ceo: c.ceo_name || '',
            client_manager: c.manager_name || c.ceo_name || ''
        }));
        setClientSearch(c.client_name);
        setShowClientDrop(false);
    }

    function addItem() { setItems(p => [...p, BLANK_ITEM(p.length)]); }
    function insertItem(idx) {
        setItems(p => {
            const next = [...p];
            next.splice(idx + 1, 0, BLANK_ITEM(Date.now()));
            return next;
        });
    }
    function delItem(idx) { setItems(p => p.filter((_, i) => i !== idx)); }
    function copyItem(idx) {
        const it = items[idx];
        const newItem = { ...it, _id: Date.now() + Math.random() };
        const next = [...items];
        next.splice(idx + 1, 0, newItem);
        setItems(next);
    }
    function setItem(idx, k, v) {
        setItems(p => p.map((it, i) => {
            if (i !== idx) return it;
            let u = { ...it, [k]: v };
            if (k === 'analysis_method') {
                const found = analysisPrices.find(h => h.item_name === v);
                if (found) u.unit_price = found.unit_price;
                else {
                    const ef = engPrices.find(f => f.item_name === v);
                    if (ef) u.unit_price = ef.unit_price;
                }
            }
            if (k === 'hazard_name' && hdr.quote_type === '용역') {
                const ef = engPrices.find(f => f.item_name === v);
                if (ef) u.unit_price = ef.unit_price;
            } else if (k === 'hazard_name' && hdr.quote_type === '장비대여') {
                const ef = rentalPrices.find(f => f.item_name === v);
                if (ef) u.unit_price = ef.unit_price;
            }
            return u;
        }));
    }

    // 엑셀 스타일 붙여넣기 기능
    function handlePaste(idx, field, ev) {
        const text = ev.clipboardData.getData('text');
        if (!text.includes('\t') && !text.includes('\n')) return; // 단순 텍스트는 기본 동작 유지

        ev.preventDefault();
        const rows = text.split(/\r?\n/).filter(r => r.trim() !== '');
        const newItems = [...items];

        const fieldsOrder = hdr.quote_type === '용역'
            ? ['quantity', 'unit_type', 'unit_price', 'remarks']
            : hdr.quote_type === '장비대여'
                ? ['work_process', 'hazard_name', 'quantity', 'unit_type', 'unit_price', 'remarks']
                : ['work_process', 'hazard_name', 'analysis_method', 'quantity', 'unit_price', 'remarks'];

        const startFieldIdx = fieldsOrder.indexOf(field);
        if (startFieldIdx === -1) return;

        rows.forEach((row, rowOffset) => {
            const cols = row.split('\t');
            const targetIdx = idx + rowOffset;

            if (!newItems[targetIdx]) {
                newItems[targetIdx] = { ...BLANK_ITEM(targetIdx), _id: Date.now() + targetIdx };
            }

            cols.forEach((val, colOffset) => {
                const currentField = fieldsOrder[startFieldIdx + colOffset];
                if (currentField) {
                    let finalVal = val.trim();
                    if (currentField === 'quantity' || currentField === 'unit_price') {
                        finalVal = Number(finalVal.replace(/[^0-9.-]+/g, "")) || 0;
                    }
                    newItems[targetIdx][currentField] = finalVal;
                }
            });
        });
        setItems(newItems);
    }

    // 키보드 네비게이션 (엑셀 스타일)
    function handleKeyDown(idx, field, ev) {
        const fieldsOrder = hdr.quote_type === '용역'
            ? ['quantity', 'unit_type', 'unit_price', 'remarks']
            : hdr.quote_type === '장비대여'
                ? ['work_process', 'hazard_name', 'quantity', 'unit_type', 'unit_price', 'remarks']
                : ['work_process', 'hazard_name', 'analysis_method', 'quantity', 'unit_price', 'remarks'];
        const colIdx = fieldsOrder.indexOf(field);

        if (ev.key === 'ArrowDown' || (ev.key === 'Enter' && !ev.shiftKey)) {
            ev.preventDefault();
            const targetIdx = idx + 1;
            const target = document.querySelector(`[data-idx="${targetIdx}"][data-field="${field}"]`);
            if (target) target.focus();
            else if (ev.key === 'Enter') addItem(); // 마지막 줄에서 엔터 시 행 추가
        } else if (ev.key === 'ArrowUp' || (ev.key === 'Enter' && ev.shiftKey)) {
            ev.preventDefault();
            const targetIdx = idx - 1;
            const target = document.querySelector(`[data-idx="${targetIdx}"][data-field="${field}"]`);
            if (target) target.focus();
        } else if (ev.key === 'ArrowRight' || (ev.key === 'Tab' && !ev.shiftKey)) {
            // 입력창 커서가 끝에 있거나 Tab인 경우 다음 셀로
            let isAtEnd = false;
            try {
                isAtEnd = ev.target.type === 'number' ? true : ev.target.selectionEnd === ev.target.value.length;
            } catch (e) {
                isAtEnd = true;
            }
            if (ev.key === 'Tab' || isAtEnd) {
                ev.preventDefault();
                let nextCol = colIdx + 1;
                let nextRow = idx;
                if (nextCol >= fieldsOrder.length) {
                    nextCol = 0;
                    nextRow++;
                }
                const target = document.querySelector(`[data-idx="${nextRow}"][data-field="${fieldsOrder[nextCol]}"]`);
                if (target) target.focus();
                else if (ev.key === 'Tab' && nextRow >= items.length) addItem();
            }
        } else if (ev.key === 'ArrowLeft' || (ev.key === 'Tab' && ev.shiftKey)) {
            let isAtStart = false;
            try {
                isAtStart = ev.target.type === 'number' ? true : ev.target.selectionStart === 0;
            } catch (e) {
                isAtStart = true;
            }
            if (ev.key === 'Tab' || isAtStart) {
                ev.preventDefault();
                let nextCol = colIdx - 1;
                let nextRow = idx;
                if (nextCol < 0) {
                    nextCol = fieldsOrder.length - 1;
                    nextRow--;
                }
                const target = document.querySelector(`[data-idx="${nextRow}"][data-field="${fieldsOrder[nextCol]}"]`);
                if (target) target.focus();
            }
        }
    }

    // 저장: 기존 editId와 관계없이 항상 신규 INSERT → 해당 연도의 새 KIWE 번호 부여
    async function doSave() {
        if (!hdr.client_name.trim()) return alert('거래처명을 입력하세요.');
        setSaving(true);
        try {
            const user = JSON.parse(localStorage.getItem('kiwe_user') || '{}');

            // 1. 해당 연도 기준 최대 시퀀스 및 번호 문자열 조회 (INSERT 전 채번)
            // quote_seq뿐만 아니라 quote_no 문자열에서도 숫자를 추출하여 합산 비교 (사용자 수동 수정 대응)
            const { data: qData } = await sb.from('kiwe_quotations')
                .select('quote_seq, quote_no')
                .eq('year', hdr.year);

            let maxSeq = 0;
            if (qData && qData.length > 0) {
                qData.forEach(q => {
                    const s = q.quote_seq || 0;
                    if (s > maxSeq) maxSeq = s;

                    // 문자열 기반 파싱 (KIWE-2026-054 등)
                    // ★ 반드시 현재 연도와 일치하는 quote_no만 파싱 (다른 연도 번호로 오염 방지)
                    if (q.quote_no) {
                        const yearMatch = q.quote_no.match(/KIWE-(\d{4})-(\d+)/);
                        if (yearMatch && parseInt(yearMatch[1], 10) === hdr.year) {
                            const num = parseInt(yearMatch[2], 10);
                            if (!isNaN(num) && num > maxSeq) maxSeq = num;
                        }
                    }
                });
            }
            const nextSeq = maxSeq + 1;
            const qno = `KIWE-${hdr.year}-${String(nextSeq).padStart(3, '0')}`;

            const payload = {
                year: hdr.year, half_year: hdr.half_year, quote_date: hdr.quote_date,
                valid_days: hdr.valid_days, client_id: hdr.client_id, client_name: hdr.client_name,
                client_tel: hdr.client_tel, client_fax: hdr.client_fax, client_address: hdr.client_address,
                client_ceo: hdr.client_ceo, client_manager: hdr.client_manager,
                quote_type: hdr.quote_type,
                support_type: hdr.is_discount ? `${hdr.support_type}_할인` : hdr.support_type,
                workplace_size: hdr.workplace_size,
                management_fee: hdr.management_fee,
                sampling_days: hdr.sampling_days || 1,
                preliminary_fee: hdr.preliminary_fee || 0,
                preliminary_days: hdr.preliminary_days || 1,
                contract_client_id: hdr.contract_client_id || null,
                discount_rate: hdr.discount_rate,
                discount_amount: hdr.discount_amount,
                round_unit: hdr.round_unit || 0,
                support_amount: supportInfo.amount || 0,
                title: hdr.title || '작업환경측정 견적서',
                actual_amount: sub,
                total_amount: total,
                payment_terms: hdr.payment_terms, notes: hdr.notes, status: hdr.status,
                manager_name: hdr.manager_name || (user.user_name ? `${user.user_name}${user.user_title ? ' ' + user.user_title : ''}` : ''),
                created_by: user.user_name ? `${user.user_name}${user.user_title ? ' ' + user.user_title : ''}` : '',
                updated_at: new Date().toISOString(),
                quote_no: qno,
                quote_seq: nextSeq
            };

            // 2. 신규 INSERT (채번된 번호 포함하여 저장)
            const { data: ins, error: insErr } = await sb.from('kiwe_quotations').insert(payload).select().single();
            if (insErr) throw insErr;
            const qid = ins.id;

            // 아이템 저장
            if (items.length > 0) {
                await sb.from('kiwe_quotation_items').insert(items.map((it, i) => ({
                    quotation_id: qid, sort_order: i,
                    work_process: it.work_process, hazard_name: it.hazard_name,
                    analysis_method: it.analysis_method, unit_type: it.unit_type || '식',
                    quantity: Number(it.quantity), unit_price: Number(it.unit_price), remarks: it.remarks
                })));
            }

            alert(`저장되었습니다.\n새 견적번호: ${qno}`);
            await loadEdit(qid);
            if (onSave) onSave();
        } catch (err) { alert('저장 실패: ' + err.message); }
        finally { setSaving(false); }
    }

    const fClients = clients.filter(c => c.client_name.includes(clientSearch));
    const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50';
    const labelCls = 'block text-xs font-bold text-slate-500 mb-1';

    if (!hdr || items.length === 0) return null;

    return e('div', { className: 'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 overflow-hidden no-print' },
        e('datalist', { id: 'eng-list' }, engPrices.map(f => e('option', { key: f.item_name, value: f.item_name }))),
        e('datalist', { id: 'hz-list' }, analysisPrices.map(p => e('option', { key: p.item_name, value: p.item_name }))),
        e('datalist', { id: 'ana-list' }, [
            ...analysisPrices.map(p => e('option', { key: 'ana-' + p.item_name, value: p.item_name })),
            ...engPrices.map(f => e('option', { key: 'eng-' + f.item_name, value: f.item_name }))
        ]),
        e('datalist', { id: 'rental-list' }, rentalPrices.map(f => e('option', { key: f.item_name, value: f.item_name }))),
        e('div', { className: 'bg-slate-50 w-full max-w-[98vw] h-[95vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden' },
            // 툴바
            e('div', { className: 'flex items-center justify-between px-6 py-3 border-b bg-white shrink-0 gap-2' },
                e('div', { className: 'flex items-center gap-3' },
                    e('span', { className: 'text-lg font-black text-slate-700 flex items-center gap-2' },
                        editId ? `견적서 편집(${hdr.quote_no || '#' + editId})` : '새 견적서 작성',
                        e('a', { href: 'manual.html#section-quotations', target: '_blank', className: 'p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors', title: '견적 관리 도움말 (새창)' },
                            e(HelpCircle, { size: 18 })
                        )
                    ),
                    hdr.support_type !== '일반' && e('span', { className: 'px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold' }, hdr.support_type === '신규지원' ? '신규지원' : '기존지원'),
                    e('select', {
                        value: hdr.status, onChange: ev => setH('status', ev.target.value),
                        className: 'px-3 py-1 border rounded-lg text-sm font-bold ' +
                            (hdr.status === '계약' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                hdr.status === '완료' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200')
                    }, ['작성중', '완료', '계약'].map(s => e('option', { key: s, value: s }, s)))
                ),
                e('div', { className: 'flex gap-2' },
                    e('button', {
                        onClick: () => openPrintPreview(hdr, items, mgmtFee, itemsTotal, sub, discAmt, vat, total, supportInfo),
                        className: 'flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200'
                    }, e(Eye, { size: 15 }), '미리보기'),
                    e('button', {
                        onClick: doSave, disabled: saving,
                        className: 'flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700'
                    }, e(Save, { size: 15 }), saving ? '저장 중...' : '견적서 저장'),
                    e('button', { onClick: onCancel, className: 'p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg ml-2' }, e(X, { size: 22 }))
                )
            ),

            e('div', { className: 'flex-1 flex overflow-x-auto overflow-y-hidden bg-slate-100' },
                // 왼쪽 패널 (설정/합계) - 폭 가변적(min 500px, max 800px)
                e('div', { className: 'flex-[2] min-w-[500px] max-w-[800px] flex flex-col gap-6 p-6 pb-20 overflow-y-auto bg-slate-50 border-r border-slate-200 shadow-inner' },
                    // 섹션1: 기본정보 (4열 그리드 복구)
                    e('div', { className: 'bg-white rounded-xl border border-slate-200 p-5 shadow-sm shrink-0' },
                        e('h3', { className: 'text-sm font-black text-slate-700 mb-4 pb-1 border-b flex items-center gap-2' },
                            e('span', { className: 'w-5 h-5 bg-blue-600 text-white rounded text-xs flex items-center justify-center font-black' }, '1'),
                            '기본 정보'
                        ),
                        e('div', { className: 'grid grid-cols-4 gap-4' },
                            e('div', { className: 'col-span-2' },
                                e('label', { className: labelCls + ' mb-1' }, '거래처명 *'),
                                e('div', { className: 'relative' },
                                    e('input', {
                                        type: 'text', value: clientSearch,
                                        onChange: ev => { setClientSearch(ev.target.value); setH('client_name', ev.target.value); setShowClientDrop(true); },
                                        onFocus: () => setShowClientDrop(true),
                                        onBlur: () => setTimeout(() => setShowClientDrop(false), 200),
                                        placeholder: '거래처 정보 검색 또는 직접 입력', className: inputCls
                                    }),
                                    showClientDrop && fClients.length > 0 && e('div', { className: 'absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mt-1' },
                                        fClients.map(c => e('div', {
                                            key: c.id, onClick: () => selectClient(c),
                                            className: 'px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm font-bold'
                                        }, c.client_name))
                                    )
                                )
                            ),
                            e('div', null, e('label', { className: labelCls }, '견적일자'), e('input', { type: 'date', value: hdr.quote_date, onChange: ev => setH('quote_date', ev.target.value), className: inputCls })),
                            e('div', null, e('label', { className: labelCls }, '유효기간(일)'), e('input', { type: 'number', value: hdr.valid_days, onChange: ev => setH('valid_days', Number(ev.target.value)), className: inputCls })),

                            e('div', null, e('label', { className: labelCls }, '연도'), e('input', { type: 'number', value: hdr.year, onChange: ev => setH('year', Number(ev.target.value)), className: inputCls })),
                            e('div', null, e('label', { className: labelCls }, '반기'),
                                e('select', { value: hdr.half_year, onChange: ev => setH('half_year', ev.target.value), className: inputCls },
                                    ['상반기', '하반기', '연간', '1분기', '2분기', '3분기', '4분기'].map(h => e('option', { key: h, value: h }, h)))),
                            e('div', { className: 'col-span-1' }, e('label', { className: labelCls }, '견적서 제목'), e('input', { type: 'text', value: hdr.title, onChange: ev => setH('title', ev.target.value), className: inputCls, placeholder: '견적서 제목' })),
                            e('div', { className: 'col-span-1' }, e('label', { className: labelCls }, '수신처 담당자명'), e('input', { type: 'text', value: hdr.client_manager || '', onChange: ev => setH('client_manager', ev.target.value), className: inputCls, placeholder: '수신처 담당자명' })),

                            // 연락처 정보 추가 노출
                            e('div', { className: 'col-span-1' }, e('label', { className: labelCls }, '전화번호'), e('input', { type: 'text', value: hdr.client_tel || '', onChange: ev => setH('client_tel', ev.target.value), className: inputCls, placeholder: '전화번호' })),
                            e('div', { className: 'col-span-1' }, e('label', { className: labelCls }, '팩스번호'), e('input', { type: 'text', value: hdr.client_fax || '', onChange: ev => setH('client_fax', ev.target.value), className: inputCls, placeholder: '팩스번호' })),
                            e('div', { className: 'col-span-2' }, e('label', { className: labelCls }, '사업장 주소'), e('input', { type: 'text', value: hdr.client_address || '', onChange: ev => setH('client_address', ev.target.value), className: inputCls, placeholder: '사업장 주소' })),

                            e('div', { className: 'col-span-2' }, e('label', { className: labelCls }, '비용지원 유형 / 계약단가'),
                                e('div', { className: 'flex gap-2 flex-wrap' },
                                    [['일반', '일반'], ['신규지원', '신규'], ['기존지원', '기존']].map(([v, l]) => e('button', {
                                        key: v, onClick: () => { setH('support_type', v); },
                                        className: `flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${hdr.support_type === v ? (v === '일반' ? 'bg-slate-700 text-white border-slate-700' : 'bg-emerald-600 text-white border-emerald-600') : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`
                                    }, l)),
                                    e('button', {
                                        onClick: () => { setH('support_type', '계약'); },
                                        className: `flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${hdr.support_type === '계약' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-400 border-rose-200 hover:border-rose-400 hover:bg-rose-50'}`
                                    }, `계약단가${hdr.support_type !== '계약' ? ' ⚡' : ' ✅'}`)
                                ),
                                hdr.support_type !== '계약' && e('div', { className: 'mt-3 flex items-center justify-between bg-teal-50 border border-teal-200 p-2.5 rounded-xl cursor-pointer hover:bg-teal-100/50 transition-colors', onClick: () => setH('is_discount', !hdr.is_discount) },
                                    e('div', null,
                                        e('span', { className: 'text-xs font-black text-teal-800 flex items-center gap-1.5' }, '🎉 할인단가 (정액할인) 일괄 적용'),
                                        e('p', { className: 'text-[10px] text-teal-600 mt-0.5 font-bold' }, '기본관리비 및 분석수수료 기본 단가를 별도 설정된 할인가로 덮어씁니다.')
                                    ),
                                    e('div', { className: 'relative inline-flex items-center' },
                                        e('div', { className: `w-11 h-6 rounded-full transition-all shadow-inner flex items-center justify-between px-1 ${hdr.is_discount ? 'bg-teal-500' : 'bg-slate-300'}` },
                                            e('div', { className: `w-4 h-4 rounded-full bg-white shadow transform transition-transform ${hdr.is_discount ? 'translate-x-5' : 'translate-x-0'}` })
                                        )
                                    )
                                )
                            ),
                            isContract && e('div', { className: 'col-span-2 bg-rose-50 rounded-xl p-3 border border-rose-200' },
                                e('label', { className: 'block text-xs font-black text-rose-600 mb-1.5' }, '🏢 계약 사업장 선택 (계약단가 적용)'),
                                e('div', { className: 'relative' },
                                    e('select', {
                                        value: hdr.contract_client_id || '',
                                        onChange: ev => {
                                            const cid = ev.target.value ? Number(ev.target.value) : null;
                                            setH('contract_client_id', cid);
                                        },
                                        className: 'w-full px-3 py-2 border-2 border-rose-200 rounded-lg text-sm font-bold outline-none focus:border-rose-500 bg-white'
                                    },
                                        e('option', { value: '' }, '-- 거래처 선택 (계약단가 로드) --'),
                                        clients.map(c => e('option', { key: c.id, value: c.id }, c.client_name))
                                    )
                                ),
                                hdr.contract_client_id && e('div', { className: 'mt-1.5 text-[10px] text-rose-500 font-bold' }, `ℹ️ 계약단가 로드됨: ${clients.find(c => c.id === hdr.contract_client_id)?.client_name || ''} (price_type=계약_${hdr.contract_client_id})`)
                            ),
                            e('div', null, e('label', { className: labelCls }, '견적 종류'),
                                e('div', { className: 'flex gap-2' },
                                    ['일반', '용역', '장비대여'].map(t => e('button', {
                                        key: t, onClick: () => {
                                            if (t === '용역' && hdr.quote_type !== '용역') {
                                                setItems(YONGYEOK_DEFAULTS.map((d, i) => {
                                                    const price = engPrices.find(f => f.item_name === d.hazard_name)?.unit_price || 0;
                                                    return { _id: Date.now() + i, sort_order: i, work_process: d.work_process, hazard_name: d.hazard_name, analysis_method: '', unit_type: d.unit_type, quantity: 0, unit_price: price, remarks: '' };
                                                }));
                                            } else if (hdr.quote_type === '용역' && t !== '용역') {
                                                setItems([BLANK_ITEM(0)]);
                                            }
                                            setH('quote_type', t);
                                        },
                                        className: `flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${hdr.quote_type === t || (hdr.quote_type === '측정' && t === '일반') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`
                                    }, t === '일반' ? '측정' : t))
                                )
                            ),
                            e('div', null, e('label', { className: labelCls }, '결제조건'),
                                e('select', { value: hdr.payment_terms, onChange: ev => setH('payment_terms', ev.target.value), className: inputCls },
                                    ['현금', '30일', '60일', '어음'].map(p => e('option', { key: p, value: p }, p))))
                        )
                    ),
                    // 계약 모드: 예비조사 섹션 (1. 예비조사)
                    isContract && isMeasurement && e('div', { className: 'bg-white rounded-xl border border-rose-200 overflow-hidden shadow-sm shrink-0' },
                        e('div', { className: 'bg-rose-50 px-5 py-3 border-b flex items-center justify-between' },
                            e('h3', { className: 'text-sm font-black text-rose-700 flex items-center gap-2' },
                                e('span', { className: 'w-5 h-5 bg-rose-600 text-white rounded text-[10px] flex items-center justify-center font-black shadow-sm' }, '1'),
                                '예비조사'
                            ),
                            e('div', { className: 'text-[9px] font-bold text-rose-400 bg-white px-2 py-1 rounded-full border border-rose-200' }, '실제 예비조사 횟수를 입력하세요')
                        ),
                        e('div', { className: 'p-5' },
                            e('div', { className: 'flex items-center gap-6' },
                                e('div', null,
                                    e('label', { className: 'block text-[9px] font-black text-rose-400 mb-1.5 uppercase' }, '예비조사 단가 (₩)'),
                                    e('input', {
                                        type: 'text',
                                        value: fmt(hdr.preliminary_fee),
                                        onChange: ev => setH('preliminary_fee', unf(ev.target.value)),
                                        className: 'w-32 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-right bg-slate-50 focus:bg-white focus:ring-4 focus:ring-rose-100 focus:border-rose-500 outline-none transition-all'
                                    })
                                ),
                                e('div', { className: 'flex items-center pt-5 text-slate-300 font-black text-lg' }, '×'),
                                e('div', null,
                                    e('label', { className: 'block text-[9px] font-black text-rose-400 mb-1.5 uppercase' }, '횟수 (Times)'),
                                    e('input', {
                                        type: 'number',
                                        value: hdr.preliminary_days || 1,
                                        min: 1,
                                        onChange: ev => setH('preliminary_days', Number(ev.target.value)),
                                        className: 'w-20 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-center bg-slate-50 focus:bg-white focus:ring-4 focus:ring-rose-100 focus:border-rose-500 outline-none transition-all'
                                    })
                                ),
                                e('div', { className: 'text-right min-w-[150px]' },
                                    e('label', { className: 'block text-[10px] font-black text-rose-400 mb-1 uppercase tracking-tighter' }, '예비조사 소계'),
                                    e('div', { className: 'text-3xl font-black text-rose-600 tracking-tight' },
                                        e('span', { className: 'text-lg mr-1 opacity-50' }, '₩'),
                                        fmt(prelimSub)
                                    )
                                )
                            )
                        )
                    ),
                    // 기본관리비 섹션 (계약모드: 1-1, 일반모드: 2)
                    isMeasurement && e('div', { className: 'bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow shrink-0' },
                        e('div', { className: 'bg-slate-50 px-5 py-3 border-b flex items-center justify-between' },
                            e('h3', { className: 'text-sm font-black text-slate-700 flex items-center gap-2' },
                                e('span', { className: `w-6 h-5 ${isContract ? 'bg-rose-500' : 'bg-emerald-600'} text-white rounded text-[9px] flex items-center justify-center font-black shadow-sm` }, isContract ? '1-1' : '2'),
                                isContract ? '기본관리비 (측정)' : '기본관리비 (사업장 단위)'
                            ),
                            e('div', { className: 'text-[9px] font-bold text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-200' }, '규격 선택 시 자동 입력')
                        ),
                        e('div', { className: 'p-5 flex flex-col gap-5' },
                            e('div', { className: isContract ? 'flex' : 'grid grid-cols-2 gap-8' },
                                // 일반/계약 규격 버튼
                                e('div', { className: 'space-y-3 flex-1' },
                                    e('div', { className: 'flex items-center gap-2' },
                                        e('span', { className: `w-1 h-3 ${isContract ? 'bg-rose-400' : 'bg-emerald-400'} rounded-full` }),
                                        e('div', { className: 'text-[10px] font-black text-slate-500 uppercase tracking-widest' }, isContract ? '계약단가 규격' : '일반 사업장')
                                    ),
                                    e('div', { className: 'grid grid-cols-4 gap-1.5' },
                                        mgmtPrices.map(m => e('button', {
                                            key: m.item_name, onClick: () => selectMgmt(m.item_name),
                                            className: `px-1 py-2.5 rounded-lg text-[10px] font-bold border transition-all ${hdr.workplace_size === m.item_name ? (isContract ? 'bg-rose-600 text-white border-rose-600 shadow-md transform -translate-y-0.5' : 'bg-emerald-600 text-white border-emerald-600 shadow-md transform -translate-y-0.5') : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'}`
                                        }, m.item_name.replace('사업장', '').trim()))
                                    )
                                ),
                                // 비용지원 사업장 (일반모드에서만)
                                !isContract && e('div', { className: 'space-y-3 border-l border-slate-100 pl-8' },
                                    e('div', { className: 'flex items-center gap-2' },
                                        e('span', { className: 'w-1 h-3 bg-slate-400 rounded-full' }),
                                        e('div', { className: 'text-[10px] font-black text-slate-500 uppercase tracking-widest' }, '비용지원 사업장')
                                    ),
                                    e('div', { className: 'grid grid-cols-4 gap-1.5' },
                                        supportMgmtPrices.map(m => e('button', {
                                            key: m.item_name, onClick: () => selectMgmt(m.item_name),
                                            className: `px-1 py-2.5 rounded-lg text-[10px] font-bold border transition-all ${hdr.workplace_size === m.item_name ? 'bg-slate-700 text-white border-slate-700 shadow-md transform -translate-y-0.5' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`
                                        }, m.item_name.replace('사업장', '').trim()))
                                    )
                                )
                            ),
                            // 단가 및 일수 입력 영역
                            e('div', { className: 'flex items-center justify-between pt-5 border-t border-slate-100 mt-1' },
                                e('div', { className: 'flex items-center gap-5' },
                                    e('div', null,
                                        e('label', { className: 'block text-[9px] font-black text-slate-400 mb-1.5 ml-1 uppercase' }, '기본단가 (₩)'),
                                        e('input', {
                                            type: 'text',
                                            value: fmt(hdr.management_fee),
                                            onChange: ev => setH('management_fee', unf(ev.target.value)),
                                            className: 'w-32 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-right bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all'
                                        })
                                    ),
                                    e('div', { className: 'flex items-center pt-5 text-slate-300' }, e(Plus, { size: 14, className: 'rotate-45 opacity-50' })),
                                    e('div', null,
                                        e('label', { className: 'block text-[9px] font-black text-slate-400 mb-1.5 ml-1 uppercase' }, '측정일수 (Day)'),
                                        e('input', {
                                            type: 'number',
                                            value: hdr.sampling_days || 1,
                                            min: 1,
                                            onChange: ev => setH('sampling_days', Number(ev.target.value)),
                                            className: 'w-20 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-center bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all'
                                        })
                                    )
                                ),
                                e('div', { className: 'text-right min-w-[180px]' },
                                    e('label', { className: 'block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter' }, 'Selected Management Fee TOTAL'),
                                    e('div', { className: 'text-3xl font-black text-emerald-600 tracking-tight' },
                                        e('span', { className: 'text-lg mr-1 opacity-50' }, '₩'),
                                        fmt(mgmtFee)
                                    )
                                )
                            )
                        )
                    ),
                    // 섹션4: 금액합계 및 설정 (레이아웃 최적화)
                    e('div', { className: 'bg-blue-50 rounded-xl border border-blue-200 p-5 shadow-sm shrink-0' },
                        e('h3', { className: 'text-sm font-black text-slate-700 mb-4 pb-1 border-b border-blue-200 flex items-center gap-2' },
                            e('span', { className: 'w-5 h-5 bg-blue-600 text-white rounded text-xs flex items-center justify-center font-black' }, '4'),
                            '금액 합계 및 할인 설정'
                        ),
                        e('div', { className: 'grid grid-cols-2 gap-8' },
                            e('div', { className: 'space-y-4' },
                                e('div', { className: 'grid grid-cols-2 gap-4' },
                                    e('div', null,
                                        e('label', { className: labelCls + ' text-emerald-600 flex items-center gap-1.5' }, '합계금액 (L열)', e('span', { className: 'px-1 py-0.5 bg-emerald-600 text-white text-[8px] rounded' }, '자동')),
                                        e('input', {
                                            type: 'text',
                                            value: fmt(sub),
                                            readOnly: true,
                                            className: 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right font-black bg-slate-100 text-slate-600'
                                        })
                                    ),
                                    e('div', null,
                                        e('label', { className: labelCls + ' text-slate-500' }, '기본관리비'),
                                        e('div', { className: 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right font-bold bg-slate-100 text-slate-600' }, fmt(mgmtFee))
                                    )
                                ),
                                e('div', { className: 'grid grid-cols-2 gap-4' },
                                    e('div', null,
                                        e('label', { className: labelCls + ' text-blue-600' }, '공단지원금 (M열)'),
                                        e('input', { type: 'text', value: fmt(supportInfo.amount), onChange: ev => setH('support_amount', unf(ev.target.value)), className: 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right font-black bg-white focus:ring-2 focus:ring-blue-300' })
                                    ),
                                    e('div', null,
                                        e('label', { className: labelCls + ' text-slate-500' }, '분석수수료'),
                                        e('div', { className: 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right font-bold bg-slate-100 text-slate-600' }, fmt(itemsTotal))
                                    )
                                ),
                                e('div', { className: 'grid grid-cols-2 gap-4' },
                                    e('div', null,
                                        e('label', { className: labelCls + ' text-blue-800 font-black' }, '최종 희망금액 (O열)'),
                                        e('input', { type: 'text', value: hdr.discount_amount ? fmt(hdr.discount_amount) : '', onChange: ev => setHdr(p => ({ ...p, discount_amount: unf(ev.target.value), discount_rate: 0 })), placeholder: '할인율 무시 금액', className: 'w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm text-right font-black text-blue-700 bg-white focus:border-blue-500 outline-none' })
                                    ),
                                    e('div', null,
                                        e('label', { className: labelCls }, '할인율 (%)'),
                                        e('div', { className: 'flex items-center gap-2' },
                                            e('input', { type: 'number', value: hdr.discount_rate || '', min: 0, max: 100, step: 0.1, onChange: ev => setHdr(p => ({ ...p, discount_rate: Number(ev.target.value) || 0, discount_amount: 0 })), className: 'flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center font-black bg-white focus:ring-2 focus:ring-blue-300' }),
                                            e('span', { className: 'text-[9px] text-slate-400 font-bold' }, '자동\n계산')
                                        )
                                    )
                                ),
                                e('div', null,
                                    e('label', { className: labelCls }, '최종금액 절삭 단위'),
                                    e('div', { className: 'flex bg-white p-1 rounded-lg border border-slate-200' },
                                        [{ val: 0, lab: 'X' }, { val: 1, lab: '1천원' }, { val: 2, lab: '1만원' }].map(opt => e('button', { key: opt.val, onClick: () => setH('round_unit', opt.val), className: `flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${hdr.round_unit === opt.val ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}` }, opt.lab))
                                    )
                                )
                            ),
                            e('div', { className: 'space-y-3 flex flex-col justify-between py-2 border-l border-blue-200 pl-8' },
                                e('div', null,
                                    e('div', { className: 'flex justify-between items-center text-xs text-slate-500 mb-1' }, e('span', null, '총 합계금액 (N)'), e('span', null, '₩ ' + fmt(isSupport && supportInfo.actualAmt > 0 ? supportInfo.actualAmt : sub))),
                                    e('div', { className: 'flex justify-between items-center text-xs text-red-500' }, e('span', null, '총 차감금액 (지원+할인)'), e('span', null, `- ₩ ${fmt(supportInfo.amount + discAmt)}`))
                                ),
                                e('div', { className: 'pt-6 border-t border-blue-200' },
                                    e('div', { className: 'flex justify-between items-end' },
                                        e('div', null,
                                            e('div', { className: 'text-[11px] font-bold text-blue-600 mb-0.5' }, isSupport ? '최종 견적 금액 (자부담)' : '최종 견적 금액'),
                                            hdr.round_unit > 0 && e('div', { className: 'text-[9px] text-blue-400 font-bold italic' }, `(${hdr.round_unit === 1 ? '천원' : '만원'} 단위 절삭 적용됨)`)
                                        ),
                                        e('div', { className: 'text-4xl font-black text-blue-900 leading-none' }, '₩ ' + fmt(total))
                                    )
                                )
                            )
                        ),
                        e('div', { className: 'mt-5 pt-4 border-t border-blue-200' },
                            e('label', { className: labelCls + ' mb-2' }, '특기사항 및 안내 (미리보기 하단 표시)'),
                            e('textarea', { value: hdr.notes || '', onChange: ev => setH('notes', ev.target.value), placeholder: '미리보기 하단에 표시될 내용을 입력하세요.', className: 'w-full h-28 px-4 py-3 border border-blue-200 rounded-xl text-xs font-medium resize-none focus:ring-2 focus:ring-blue-300 bg-white leading-relaxed' })
                        )
                    )
                ),
                // 오른쪽 패널 (분석수수료 그리드) - 최소폭 보장
                e('div', { className: 'flex-[3] min-w-[700px] flex flex-col p-5 overflow-hidden' },
                    e('div', { className: 'flex items-center justify-between mb-3 shrink-0' },
                        e('h3', { className: 'text-lg font-black text-slate-700 flex items-center gap-2' },
                            e('span', { className: 'w-6 h-6 bg-slate-700 text-white rounded text-sm flex items-center justify-center font-black' }, '3'),
                            (hdr.quote_type === '장비대여' ? '세부사항 (장비대여 내역)' : hdr.quote_type === '용역' ? '세부사항 (인건비)' : '분석수수료 (측정 세부내역)')
                        ),
                        hdr.quote_type !== '용역' && e('button', { onClick: addItem, className: 'flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg' }, e(Plus, { size: 16 }), '항목 추가')
                    ),
                    e('div', { className: 'flex-1 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xl flex flex-col' },
                        e('div', { className: 'flex-1 overflow-auto relative p-1' },
                            e('table', { className: 'w-full border-collapse border-t border-l border-slate-400' },
                                e('thead', { className: 'sticky top-0 z-10' },
                                    e('tr', { className: 'bg-slate-200' },
                                        e('th', { className: 'p-1 text-[11px] font-black text-slate-700 border-b border-r border-slate-400 w-10 text-center' }, 'No'),
                                        (hdr.quote_type === '용역'
                                            ? ['항목', '구분', '인원', '조사일수', '단가', '금액', '비고']
                                            : hdr.quote_type === '장비대여'
                                                ? ['대여장비', '구분(등급/장비명)', '수량', '대여일수', '단가', '금액', '비고']
                                                : ['단위작업장소', '유해인자', '분석방법', '수량', '단가', '금액', '비고']
                                        ).map(h => e('th', { key: h, className: 'p-1 text-[11px] font-black text-slate-700 border-b border-r border-slate-400 text-center' }, h)),
                                        e('th', { className: 'p-1 border-b border-r border-slate-400 w-16' }, '')
                                    )
                                ),
                                e('tbody', null,
                                    items.map((it, idx) => {
                                        const common = (f) => ({
                                            'data-idx': idx,
                                            'data-field': f,
                                            onKeyDown: (ev) => handleKeyDown(idx, f, ev),
                                            onPaste: (ev) => handlePaste(idx, f, ev),
                                            className: 'w-full h-full p-1 bg-transparent text-xs text-slate-800 shadow-none outline-none border-none rounded-none focus:bg-white focus:ring-inset focus:ring-2 focus:ring-blue-500 transition-none'
                                        });

                                        const itemTotal = it.quantity * (hdr.quote_type === '용역' || hdr.quote_type === '장비대여' ? (Number(it.unit_type) || 1) : 1) * it.unit_price;

                                        return e('tr', { key: it._id, className: 'group hover:bg-blue-50/20' },
                                            e('td', { className: 'p-0 text-center text-[10px] font-bold text-slate-500 border-b border-r border-slate-400 bg-slate-100' }, idx + 1),

                                            e('td', { className: 'p-0 border-b border-r border-slate-400 relative' },
                                                hdr.quote_type === '용역' ? e('div', { className: 'w-full h-full p-1 text-xs text-center font-bold text-slate-700 bg-slate-50 flex items-center justify-center' }, it.work_process)
                                                    : e('input', {
                                                        value: it.work_process,
                                                        onChange: ev => setItem(idx, 'work_process', ev.target.value),
                                                        placeholder: '',
                                                        ...common('work_process'),
                                                        className: common('work_process').className + ' text-center'
                                                    })
                                            ),

                                            e('td', { className: 'p-0 border-b border-r border-slate-400 relative' },
                                                hdr.quote_type === '용역' ? e('div', { className: 'w-full h-full p-1 text-xs text-center font-bold text-slate-700 bg-slate-50 flex items-center justify-center' }, it.hazard_name)
                                                    : e('input', {
                                                        value: it.hazard_name || '',
                                                        onChange: ev => setItem(idx, 'hazard_name', ev.target.value),
                                                        list: hdr.quote_type === '장비대여' ? 'rental-list' : undefined,
                                                        ...common('hazard_name'),
                                                        className: common('hazard_name').className + ' font-bold text-center'
                                                    })
                                            ),

                                            (hdr.quote_type === '일반' || hdr.quote_type === '측정') && e('td', { className: 'p-0 border-b border-r border-slate-400 relative' }, e('input', {
                                                value: it.analysis_method || '',
                                                onChange: ev => setItem(idx, 'analysis_method', ev.target.value),
                                                list: 'ana-list',
                                                ...common('analysis_method'),
                                                className: common('analysis_method').className + ' text-center'
                                            })),

                                            e('td', { className: 'p-0 border-b border-r border-slate-400 relative w-16' }, e('input', { type: 'number', value: it.quantity, onChange: ev => setItem(idx, 'quantity', Number(ev.target.value) || 0), ...common('quantity'), className: common('quantity').className + ' text-center' })),

                                            (hdr.quote_type === '용역' || hdr.quote_type === '장비대여') && e('td', { className: 'p-0 border-b border-r border-slate-400 relative w-16' }, e('input', { type: 'number', value: it.unit_type || 1, onChange: ev => setItem(idx, 'unit_type', Number(ev.target.value) || 0), ...common('unit_type'), className: common('unit_type').className + ' text-center' })),

                                            e('td', { className: 'p-0 border-b border-r border-slate-400 relative w-24' }, e('input', { type: 'text', value: fmt(it.unit_price), onChange: ev => setItem(idx, 'unit_price', unf(ev.target.value)), ...common('unit_price'), className: common('unit_price').className + ' text-right font-bold' })),
                                            e('td', { className: 'p-1 border-b border-r border-slate-400 text-right text-[11px] font-black text-slate-700 bg-slate-50 w-28' }, fmt(itemTotal)),

                                            // 비고
                                            e('td', { className: 'p-0 border-b border-r border-slate-400 relative' },
                                                e('input', {
                                                    value: it.remarks,
                                                    onChange: ev => setItem(idx, 'remarks', ev.target.value),
                                                    placeholder: '',
                                                    ...common('remarks')
                                                })
                                            ),

                                            e('td', { className: 'p-1 w-16' },
                                                hdr.quote_type !== '용역' && e('div', { className: 'flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity' },
                                                    e('button', { onClick: () => insertItem(idx), className: 'p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded', title: '아래에 행 삽입' }, e(Plus, { size: 14 })),
                                                    e('button', { onClick: () => delItem(idx), className: 'p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded', title: '행 삭제' }, e(Trash2, { size: 14 }))
                                                )
                                            )
                                        );
                                    })
                                )
                            )
                        ),
                        e('div', { className: 'px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between shrink-0' },
                            e('div', { className: 'text-xs text-slate-400 font-bold flex items-center gap-4' },
                                e('span', null, `항목: ${items.length}개`),
                                e('span', null, 'Tip: 엑셀 복사/붙여넣기 및 방향키 이동 가능')
                            ),
                            e('div', { className: 'text-base font-black text-slate-800' }, '세부항목 합계: ', e('span', { className: 'text-blue-600' }, fmt(itemsTotal)), ' 원')
                        )
                    )
                )
            )
        )
    );
}

// quotation_list.js - 견적서 목록 탭 (개선판)
import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY, fmt } from './quotation_data.js';
import { Plus, Edit3, Trash2, Copy, Search, FileText, Download } from 'https://esm.sh/lucide-react@0.263.1';
import ExcelImporter from './excel_importer.js';

const e = React.createElement;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUS_COLOR = {
    '작성중': 'bg-amber-100 text-amber-700 border-amber-200',
    '완료': 'bg-blue-100 text-blue-700 border-blue-200',
    '계약': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export function QuotationList({ onNew, onEdit }) {
    const [quotes, setQuotes] = useState([]);
    const [yearF, setYearF] = useState(String(new Date().getFullYear()));
    const [typeF, setTypeF] = useState('전체');
    const [supportF, setSupportF] = useState('전체');
    const [statusF, setStatusF] = useState('전체');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showImporter, setShowImporter] = useState(false);

    useEffect(() => {
        load();
        window.addEventListener('reloadQuotes', load);
        return () => window.removeEventListener('reloadQuotes', load);
    }, []);

    async function load() {
        setLoading(true);
        try {
            const [{ data: qData }, { data: iData }] = await Promise.all([
                sb.from('kiwe_quotations').select('*').order('id', { ascending: false }),
                sb.from('kiwe_quotation_items').select('quotation_id, quantity, unit_price')
            ]);

            // 견적별 아이템 그룹화
            const itemMap = {};
            iData?.forEach(it => {
                if (!itemMap[it.quotation_id]) itemMap[it.quotation_id] = [];
                itemMap[it.quotation_id].push(it);
            });

            // 금액 계산 포함하여 저장
            const enriched = (qData || []).map(q => {
                const { total, final } = calcQuoteTotals(q, itemMap[q.id] || []);
                return { ...q, _total: total, _final: final };
            });

            setQuotes(enriched);
        } finally { setLoading(false); }
    }


    async function del(q) {
        if (!confirm(`[${q.quote_no || q.id}] 견적서를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
        await sb.from('kiwe_quotation_items').delete().eq('quotation_id', q.id);
        await sb.from('kiwe_quotations').delete().eq('id', q.id);
        load();
    }

    const yr = new Set(quotes.map(q => String(q.year)));
    const years = ['전체', ...Array.from(yr).sort().reverse()];

    const filtered = (quotes || []).filter(q => {
        if (yearF !== '전체' && String(q.year) !== yearF) return false;
        if (typeF !== '전체') {
            const isMeasurement = q.quote_type === '측정' || q.quote_type === '일반';
            if (typeF === '측정' && !isMeasurement) return false;
            if (typeF !== '측정' && q.quote_type !== typeF) return false;
        }
        if (supportF === '비용지원' && !q.is_cost_support) return false;
        if (supportF === '일반' && q.is_cost_support) return false;
        if (statusF !== '전체' && q.status !== statusF) return false;
        if (search && !q.client_name?.includes(search) && !q.quote_no?.includes(search)) return false;
        return true;
    });

    const Tab = ({ label, val, cur, set }) => e('button', {
        onClick: () => set(val),
        className: `px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${cur === val ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`
    }, label);

    return e('div', { className: 'flex flex-col h-full' },
        // 툴바
        e('div', { className: 'flex items-center gap-3 p-4 border-b bg-white shrink-0 flex-wrap' },
            e('div', { className: 'relative' },
                e(Search, { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400', size: 14 }),
                e('input', {
                    type: 'text', value: search, onChange: ev => setSearch(ev.target.value),
                    placeholder: '거래처명, 견적번호 검색...',
                    className: 'pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none w-52'
                })
            ),
            e('div', { className: 'flex items-center gap-1.5' },
                e('span', { className: 'text-xs text-slate-400 font-bold' }, '연도:'),
                years.map(y => e(Tab, { key: y, label: y, val: y, cur: yearF, set: setYearF }))
            ),
            e('div', { className: 'flex items-center gap-1.5' },
                e('span', { className: 'text-xs text-slate-400 font-bold' }, '종류:'),
                ['전체', '측정', '용역', '장비대여'].map(t => e(Tab, { key: t, label: t, val: t, cur: typeF, set: setTypeF }))
            ),
            e('div', { className: 'flex items-center gap-1.5' },
                e('span', { className: 'text-xs text-slate-400 font-bold' }, '비용지원:'),
                ['전체', '일반', '비용지원'].map(s => e(Tab, { key: s, label: s, val: s, cur: supportF, set: setSupportF }))
            ),
            e('div', { className: 'flex items-center gap-1.5' },
                e('span', { className: 'text-xs text-slate-400 font-bold' }, '상태:'),
                ['전체', '작성중', '완료', '계약'].map(s => e(Tab, { key: s, label: s, val: s, cur: statusF, set: setStatusF }))
            ),
            e('button', {
                onClick: () => setShowImporter(true),
                className: 'ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700'
            }, e(Download, { size: 15 }), '엑셀 대량 업로드'),
            e('button', {
                onClick: onNew,
                className: 'flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700'
            }, e(Plus, { size: 15 }), '새 견적서')
        ),
        showImporter && e(ExcelImporter, {
            onClose: () => setShowImporter(false),
            onComplete: load
        }),
        // 목록
        e('div', { className: 'flex-1 overflow-auto p-4' },
            loading ? e('div', { className: 'py-20 text-center text-slate-400' },
                e('div', { className: 'w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3' }),
                '불러오는 중...'
            ) :
                e('div', { className: 'bg-white rounded-2xl border border-slate-200 overflow-hidden' },
                    e('div', { className: 'overflow-x-auto' },
                        e('table', { className: 'w-full text-left border-collapse' },
                            e('thead', { className: 'bg-slate-50 border-b border-slate-200' },
                                e('tr', null,
                                    ['견적번호', '연도/반기', '견적일자', '상태', '사업장명', '담당자', '구분', '작성자', '최종금액(K)', '합계금액(L)', '지원금(M)', '할인율/희망금액', '관리'].map(h =>
                                        e('th', { key: h, className: 'px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider' }, h))
                                )
                            ),
                            e('tbody', { className: 'divide-y divide-slate-100' },
                                filtered.length === 0 ? e('tr', null, e('td', { colSpan: 11, className: 'py-20 text-center text-slate-400 font-bold' }, '견적서가 없습니다.')) :
                                    filtered.map(q => {
                                        const isSupport = q.is_cost_support || q.support_type !== '일반';
                                        const qt = q.quote_type === '일반' ? '측정' : q.quote_type;
                                        const typeStr = qt + (isSupport ? '(지원)' : '');

                                        return e('tr', {
                                            key: q.id,
                                            onDoubleClick: () => onEdit(q.id),
                                            className: 'hover:bg-blue-50/30 transition-colors group text-[13px] cursor-pointer'
                                        },
                                            e('td', { className: 'px-4 py-3' }, e('span', { className: 'font-mono text-xs font-black text-slate-500' }, q.quote_no || `#${q.id}`)),
                                            e('td', { className: 'px-4 py-3 font-bold' }, `${q.year} ${q.half_year}`),
                                            e('td', { className: 'px-4 py-3 text-slate-500' }, q.quote_date),
                                            e('td', { className: 'px-4 py-3' },
                                                e('span', { className: `px-2 py-0.5 rounded text-[10px] font-black border ${STATUS_COLOR[q.status] || 'bg-slate-100 text-slate-600'}` }, q.status || '작성중')),
                                            e('td', { className: 'px-4 py-3 font-black text-slate-800' }, q.client_name),
                                            e('td', { className: 'px-4 py-3 text-slate-600' }, q.client_manager || '-'),
                                            e('td', { className: 'px-4 py-3 font-bold text-blue-600' }, typeStr),
                                            e('td', { className: 'px-4 py-3 text-slate-500 font-bold' }, q.manager_name || q.created_by || '-'),
                                            e('td', { className: 'px-4 py-3 font-black text-blue-800 tabular-nums' }, fmt(q.total_amount || q._total)),
                                            e('td', { className: 'px-4 py-3 font-black text-slate-500 tabular-nums' }, fmt(q.actual_amount || q._final)),
                                            e('td', { className: 'px-4 py-3 font-black text-emerald-600 tabular-nums' }, q.support_amount ? fmt(q.support_amount) : '-'),
                                            e('td', { className: 'px-4 py-3 text-[11px] text-rose-500 font-bold' },
                                                q.discount_rate > 0 || q.discount_amount > 0 ? `${q.discount_rate}% / ${fmt(q.discount_amount)}` : '-'),
                                            e('td', { className: 'px-4 py-3' },
                                                e('div', { className: 'flex items-center gap-1.5' },
                                                    e('button', {
                                                        onClick: (e) => { e.stopPropagation(); onEdit(q.id); },
                                                        className: 'p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition-all', title: '편집'
                                                    }, e(Edit3, { size: 14 })),
                                                    e('button', {
                                                        onClick: (ev) => { ev.stopPropagation(); del(q); },
                                                        className: 'p-1.5 bg-slate-50 text-slate-400 rounded-md hover:bg-red-600 hover:text-white transition-all', title: '삭제'
                                                    }, e(Trash2, { size: 14 }))
                                                )
                                            )
                                        );
                                    })

                            )
                        )
                    )
                )
        )
    );
}

// 금액 계산 헬퍼 (목록용) — quotation_editor.js의 계산 로직과 동일하게 유지
function calcQuoteTotals(q, items = []) {
    if (Number(q.total_amount || 0) > 0) {
        return { total: q.total_amount, final: q.total_amount };
    }
    const isSupport = q.support_type !== '일반' || q.is_cost_support;
    const mgmtFee = Number(q.management_fee || 0) * (Number(q.sampling_days) || 1);
    const itemsTotal = items.reduce((acc, it) => acc + (Number(it.unit_price) * Number(it.quantity)), 0);
    const sub = mgmtFee + itemsTotal;

    let baseTotal;
    if (isSupport && Number(q.actual_amount || 0) > 0) {
        // 비용지원 + 실금액 있음: 실금액 - 공단지원금 → 할인율 적용
        const afterSubsidy = Number(q.actual_amount) - Number(q.support_amount || 0);
        baseTotal = q.discount_rate > 0
            ? Math.round(afterSubsidy * (1 - Number(q.discount_rate) / 100))
            : afterSubsidy;
    } else {
        // 일반: 희망금액 우선, 없으면 할인율
        baseTotal = sub;
        if (Number(q.discount_amount) > 0) {
            baseTotal = Number(q.discount_amount);
        } else if (Number(q.discount_rate) > 0) {
            baseTotal = Math.round(sub * (1 - Number(q.discount_rate) / 100));
        }
    }

    // 절삭
    let total = baseTotal;
    if (q.round_unit === 1) total = Math.floor(baseTotal / 1000) * 1000;
    else if (q.round_unit === 2) total = Math.floor(baseTotal / 10000) * 10000;

    const vat = (q.quote_type === '용역' && !isSupport) ? Math.round(total * 0.1) : 0;
    total += vat;

    // 실금액 = L열 actual_amount (없으면 계산된 total)
    const final = Number(q.actual_amount || 0) > 0 ? Number(q.actual_amount) : total;

    return { total, final };
}


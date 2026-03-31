// quotation_clients.js - 거래처 관리 탭

import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY, fmt } from './quotation_data.js';
import { Plus, Edit3, Trash2, X, Save, Search } from 'https://esm.sh/lucide-react@0.263.1';

const e = React.createElement;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const BLANK = { client_name: '', manager_name: '', ceo_name: '', biz_reg_no: '', tel: '', fax: '', address: '', biz_type: '', biz_item: '', worker_count: '', notes: '' };

export function ClientsTab() {
    const [clients, setClients] = useState([]);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null); // null | 'new' | client obj
    const [form, setForm] = useState(BLANK);
    const [saving, setSaving] = useState(false);
    const [companies, setCompanies] = useState([]); // 사업장 검색용
    const [showCompanySearch, setShowCompanySearch] = useState(false);
    const [subSearch, setSubSearch] = useState('');

    useEffect(() => { load(); loadCompanies(); }, []);

    async function loadCompanies() {
        const { data } = await sb.from('kiwe_companies').select('com_id, com_name, com_reg_no, address, manage_status');
        setCompanies(data || []);
    }

    // 위 loadCompanies를 다시 정의 (이름 겹침 주의)
    async function fetchCompanies() {
        const { data } = await sb.from('kiwe_companies').select('com_id, com_name, com_reg_no, address, manage_status, ceo_name, tel, fax, biz_type, main_product');
        setCompanies(data || []);
    }

    useEffect(() => { load(); fetchCompanies(); }, []);

    async function load() {
        // kiwe_quotation_clients와 kiwe_companies를 조인하여 가져옴
        // com_id가 있으면 kiwe_companies에서 최신 manage_status를 가져옴
        const { data } = await sb.from('kiwe_quotation_clients').select(`
            *,
            kiwe_companies:com_id (manage_status)
        `).order('client_name');

        const processed = (data || []).map(c => ({
            ...c,
            // 조인된 데이터가 있으면 해당 상태 사용, 없으면 '미등록'
            status: c.kiwe_companies?.manage_status || '미등록'
        }));
        setClients(processed);
    }

    function openNew() { setForm(BLANK); setModal('new'); }
    function openEdit(c) { setForm({ ...c }); setModal(c); }

    async function save() {
        if (!form.client_name.trim()) return alert('거래처명을 입력하세요.');
        setSaving(true);
        try {
            const payload = { ...form, updated_at: new Date().toISOString() };
            delete payload.id; delete payload.created_at; delete payload.status; delete payload.kiwe_companies;
            
            // com_id가 빈 문자열이면 null로 변경하여 외래키 또는 UUID 제약조건 오류 방지
            if (!payload.com_id) payload.com_id = null;

            if (modal === 'new') {
                const { error } = await sb.from('kiwe_quotation_clients').insert(payload);
                if (error) throw error;
            } else {
                const { error } = await sb.from('kiwe_quotation_clients').update(payload).eq('id', modal.id);
                if (error) throw error;
            }
            setModal(null); await load();
        } catch (err) { alert('저장 실패: ' + err.message); }
        finally { setSaving(false); }
    }

    async function del(c) {
        if (!confirm(`[${c.client_name}] 거래처를 삭제하시겠습니까?`)) return;
        const { error } = await sb.from('kiwe_quotation_clients').delete().eq('id', c.id);
        if (error) alert('삭제 실패: ' + error.message);
        else load();
    }

    const filtered = clients.filter(c =>
        c.client_name?.includes(search) || c.biz_reg_no?.includes(search) || c.com_id?.includes(search)
    );

    const Field = ({ label, field, type = 'text', half, readOnly }) =>
        e('div', { className: half ? 'col-span-1' : 'col-span-2' },
            e('label', { className: 'block text-xs font-bold text-slate-500 mb-1' }, label),
            e('input', {
                type, value: form[field] || '',
                readOnly,
                onChange: ev => setForm(p => ({ ...p, [field]: ev.target.value })),
                className: `w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300 ${readOnly ? 'bg-slate-100 text-slate-500' : 'bg-slate-50'}`
            })
        );

    // 사업장 선택 처리
    const handleSelectCompany = (c) => {
        setForm(p => ({
            ...p,
            com_id: c.com_id,
            client_name: c.com_name,
            ceo_name: c.ceo_name,
            manager_name: c.ceo_name, // 초기값으로 대표자명을 넣어주되, 필요시 수정 가능하도록 함
            biz_reg_no: c.com_reg_no,
            address: c.address,
            tel: c.tel,
            fax: c.fax,
            biz_type: c.biz_type,
            biz_item: c.main_product
        }));
        setShowCompanySearch(false);
        setSubSearch('');
    };

    return e('div', { className: 'flex flex-col h-full' },
        // 툴바
        e('div', { className: 'flex items-center gap-3 p-4 border-b bg-white shrink-0' },
            e('div', { className: 'relative flex-1 max-w-xs' },
                e(Search, { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400', size: 15 }),
                e('input', {
                    type: 'text', value: search, onChange: ev => setSearch(ev.target.value),
                    placeholder: '거래처명, 사업자번호, ID 검색...',
                    className: 'w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none'
                })
            ),
            e('button', {
                onClick: openNew,
                className: 'flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700'
            },
                e(Plus, { size: 16 }), '거래처 추가')
        ),
        // 목록
        e('div', { className: 'flex-1 overflow-auto p-4' },
            e('table', { className: 'w-full text-sm' },
                e('thead', null, e('tr', { className: 'bg-slate-100 text-xs text-slate-500' },
                    ['상태', '거래처명', '사업장ID', '사업자번호', '전화', '주소', '작업'].map(h =>
                        e('th', { key: h, className: 'px-3 py-2 text-left font-bold' }, h)
                    )
                )),
                e('tbody', null,
                    filtered.length === 0
                        ? e('tr', null, e('td', { colSpan: 7, className: 'py-12 text-center text-slate-400' }, '거래처 없음'))
                        : filtered.map(c => e('tr', { key: c.id, className: 'border-b hover:bg-slate-50' },
                            e('td', { className: 'px-3 py-2' },
                                e('span', {
                                    className: `px-2 py-0.5 rounded text-[10px] font-black ${c.status === '정상' ? 'bg-emerald-100 text-emerald-700' :
                                        c.status === '관리중지' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                                        }`
                                }, c.status)
                            ),
                            e('td', { className: 'px-3 py-2 font-bold text-blue-700' }, c.client_name),
                            e('td', { className: 'px-3 py-2 font-mono text-xs text-slate-400' }, c.com_id || '-'),
                            e('td', { className: 'px-3 py-2 font-mono text-xs' }, c.biz_reg_no || '-'),
                            e('td', { className: 'px-3 py-2 text-xs' }, c.tel || '-'),
                            e('td', { className: 'px-3 py-2 max-w-xs truncate text-slate-500 text-[11px]' }, c.address || '-'),
                            e('td', { className: 'px-3 py-2' },
                                e('div', { className: 'flex gap-1' },
                                    e('button', { onClick: () => openEdit(c), className: 'p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded' }, e(Edit3, { size: 14 })),
                                    e('button', { onClick: () => del(c), className: 'p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded' }, e(Trash2, { size: 14 }))
                                )
                            )
                        ))
                )
            )
        ),
        // 모달
        modal && e('div', { className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' },
            e('div', { className: 'bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slideUp' },
                e('div', { className: 'flex items-center justify-between px-6 py-4 border-b bg-slate-50' },
                    e('div', { className: 'flex items-center gap-3' },
                        e('h3', { className: 'font-black text-slate-800' }, modal === 'new' ? '거래처 추가' : '거래처 수정'),
                        e('button', {
                            onClick: () => setShowCompanySearch(true),
                            className: 'px-3 py-1 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 flex items-center gap-1'
                        }, e(Search, { size: 12 }), '사업장 정보 불러오기')
                    ),
                    e('button', { onClick: () => setModal(null) }, e(X, { size: 20, className: 'text-slate-400' }))
                ),
                e('div', { className: 'p-6 grid grid-cols-2 gap-x-4 gap-y-3' },
                    Field({ label: '거래처명 *', field: 'client_name' }),
                    Field({ label: '사업장 관리 ID (연동용)', field: 'com_id', half: true, readOnly: true }),
                    Field({ label: '대표자', field: 'ceo_name', half: true }),
                    Field({ label: '담당자 (견적수신)', field: 'manager_name', half: true }),
                    Field({ label: '사업자번호', field: 'biz_reg_no', half: true }),
                    Field({ label: '전화', field: 'tel', half: true }),
                    Field({ label: '팩스', field: 'fax', half: true }),
                    Field({ label: '주소', field: 'address' }),
                    Field({ label: '업태', field: 'biz_type', half: true }),
                    Field({ label: '업종', field: 'biz_item', half: true }),
                    Field({ label: '근로자수', field: 'worker_count', type: 'number', half: true }),
                    Field({ label: '비고', field: 'notes', half: true }),
                ),
                e('div', { className: 'flex justify-end gap-2 px-6 py-4 border-t bg-slate-50' },
                    e('button', { onClick: () => setModal(null), className: 'px-4 py-2 border rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100' }, '취소'),
                    e('button', { onClick: save, disabled: saving, className: 'px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center gap-2' },
                        e(Save, { size: 15 }), saving ? '저장 중...' : '저장')
                )
            ),

            // 사업장 검색 서브 모달
            showCompanySearch && e('div', { className: 'fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-8' },
                e('div', { className: 'bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[500px] flex flex-col overflow-hidden border' },
                    e('div', { className: 'p-4 border-b bg-slate-50 flex justify-between items-start' },
                        e('div', { className: 'flex-1' },
                            e('h4', { className: 'font-bold text-sm mb-2' }, '사업장 관리 데이터 검색'),
                            e('input', { autoFocus: true, type: 'text', placeholder: '사업장명 검색...', value: subSearch, onChange: ev => setSubSearch(ev.target.value), className: 'w-full px-3 py-1.5 text-sm border border-slate-300 rounded outline-none focus:border-blue-500' })
                        ),
                        e('button', { onClick: () => { setShowCompanySearch(false); setSubSearch(''); }, className: 'ml-4 mt-1 text-slate-400 hover:text-slate-700' }, e(X, { size: 18 }))
                    ),
                    e('div', { className: 'p-4 flex-1 overflow-auto' },
                        e('div', { className: 'space-y-2' },
                            companies.filter(c => c.com_name.includes(subSearch)).map(c =>
                                e('div', {
                                    key: c.com_id,
                                    onClick: () => handleSelectCompany(c),
                                    className: 'p-3 border rounded-xl hover:bg-blue-50 cursor-pointer transition-colors'
                                },
                                    e('div', { className: 'flex justify-between items-start mb-1' },
                                        e('span', { className: 'font-bold text-sm text-blue-700' }, c.com_name),
                                        e('span', { className: `text-[10px] px-2 py-0.5 rounded font-black ${c.manage_status === '정상' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}` }, c.manage_status)
                                    ),
                                    e('div', { className: 'text-[11px] text-slate-500' },
                                        e('p', null, `ID: ${c.com_id} | 원장번호: ${c.com_reg_no}`),
                                        e('p', null, `주소: ${c.address}`)
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    );
}

import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
import { openLabelPrintWindow } from './label_printer.js';
import { openReportCover } from './report_cover.js';
import {
    ClipboardList, Home, Plus, Search, Filter, Download as DownloadIcon,
    Edit3, Trash2, X, ChevronRight, Calculator, PieChart, Wallet,
    ArrowLeft, Save, Calendar, UserCheck, AlertCircle, Lock, Unlock, Printer,
    CheckCircle2, ListFilter, AlertTriangle, Loader2, Check, CreditCard, BarChart3, HelpCircle
} from 'https://esm.sh/lucide-react@0.263.1';
import { supabase, checkAuth } from './config.js';

const e = React.createElement;

const isCompleteStatus = (status) =>
    status === 1 || status === '1' || status === '완료' || status === 'completed';

// ==== Components: AnalysisStatusBadge ====
function AnalysisStatusBadge({ total, completed, onClick, size = 'sm' }) {
    if (total === 0) return null;
    const isAllComplete = total === completed;

    return e('button', {
        onClick: (ev) => { ev.stopPropagation(); if (onClick) onClick(); },
        className: `flex items-center gap-1 px-2 py-0.5 rounded-full font-black transition-all border ${isAllComplete
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
            : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
            } ${size === 'lg' ? 'text-sm px-4 py-1.5' : 'text-[10px]'}`
    },
        e(isAllComplete ? CheckCircle2 : ListFilter, { size: size === 'lg' ? 18 : 12 }),
        `${completed} / ${total} 완료`
    );
}

// ==== Components: IncompleteSamplesModal ====
function IncompleteSamplesModal({ isOpen, onClose, record, samples }) {
    if (!isOpen) return null;

    const incompleteList = samples.filter(s => !isCompleteStatus(s.status));

    return e('div', { className: "fixed inset-0 z-[60] flex items-center justify-center p-4" },
        e('div', { className: "absolute inset-0 bg-slate-900/60 backdrop-blur-sm", onClick: onClose }),
        e('div', { className: "bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] z-20 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200" },
            e('div', { className: "p-6 border-b flex items-center justify-between bg-slate-50" },
                e('div', null,
                    e('h2', { className: "text-xl font-black text-slate-800 flex items-center gap-2" },
                        e(AlertTriangle, { size: 24, className: "text-amber-500" }),
                        "미완료 시료 리스트"
                    ),
                    e('p', { className: "text-sm text-slate-500 font-bold mt-1" }, record.com_name)
                ),
                e('button', { onClick: onClose, className: "p-2 hover:bg-slate-200 rounded-lg text-slate-400" }, e(X, { size: 24 }))
            ),
            e('div', { className: "flex-1 overflow-y-auto p-6" },
                incompleteList.length === 0 ?
                    e('div', { className: "flex flex-col items-center justify-center py-12 text-slate-400 gap-4" },
                        e(CheckCircle2, { size: 48, className: "text-emerald-500" }),
                        e('p', { className: "font-black" }, "모든 분석이 완료되었습니다!")
                    ) :
                    e('div', { className: "space-y-3" },
                        incompleteList.map((s, idx) =>
                            e('div', { key: idx, className: "p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between" },
                                e('div', { className: "flex flex-col gap-1" },
                                    e('div', { className: "flex items-center gap-2" },
                                        e('span', { className: "text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded" }, s.sample_id || 'ID 미배정'),
                                        e('span', { className: "text-sm font-bold text-slate-700" }, s.common_name)
                                    ),
                                    e('div', { className: "text-xs text-slate-500" },
                                        e('span', null, `측정일: ${s.m_date}`),
                                        e('span', { className: "mx-2 text-slate-300" }, "|"),
                                        e('span', null, `근로자: ${s.worker_name || '-'}`)
                                    )
                                ),
                                e('span', { className: "text-xs font-black text-amber-600 bg-white border border-amber-200 px-3 py-1 rounded-full" }, "분석 중")
                            )
                        )
                    )
            ),
            e('div', { className: "p-4 border-t bg-slate-50 flex justify-end" },
                e('button', { onClick: onClose, className: "px-6 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-800 transition-all" }, "확인")
            )
        )
    );
}

const getOfficeCode = (name) => {
    if (!name) return 'ansan';
    const clean = name.replace(/\s+/g, '');
    if (clean.includes('경기')) return 'gyeonggi';
    if (clean.includes('평택')) return 'pyeongtaek';
    if (clean.includes('서울서부')) return 'seoul_w';
    return 'ansan';
};


// ==== Components: RecordModal ====
function RecordModal({
    isOpen, onClose, onSave, editingId,
    formData, setFormData, companies, users,
    selectedCompany, handleCompanySelect,
    handleRecordChange, loading,
    analysisStatus, onShowIncomplete
}) {
    const [companySearchTerm, setCompanySearchTerm] = useState('');
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

    useEffect(() => {
        if (formData.com_name) setCompanySearchTerm(formData.com_name);
        else setCompanySearchTerm('');
    }, [formData.com_name]);

    if (!isOpen) return null;

    const formatNumber = (num) => {
        if (!num && num !== 0) return '';
        return Number(num).toLocaleString();
    };

    const parseNumber = (str) => {
        if (!str) return 0;
        return Number(str.replace(/,/g, ''));
    };

    return e('div', { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl" },
        e('div', { className: "bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300" },
            e('div', { className: "p-6 border-b flex items-center justify-between bg-white sticky top-0 z-10" },
                e('div', { className: "flex items-center gap-4" },
                    e('div', { className: "p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100" },
                        e(ClipboardList, { size: 24 })
                    ),
                    e('div', null,
                        e('div', { className: "flex items-center gap-3" },
                            e('h2', { className: "text-xl font-black text-slate-800" }, editingId ? '측정기록 상세/수정' : '신규 측정기록 등록'),
                            editingId && analysisStatus && e(AnalysisStatusBadge, {
                                total: analysisStatus.total,
                                completed: analysisStatus.completed,
                                onClick: onShowIncomplete,
                                size: 'lg'
                            })
                        ),
                        e('p', { className: "text-sm text-slate-400 font-bold mt-0.5" }, editingId ? `No. ${editingId}` : '새로운 측정 계획을 등록합니다.')
                    )
                ),
                e('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors" }, e(X, { size: 24 }))
            ),
            e('div', { className: "flex-1 overflow-y-auto p-6 bg-slate-50" },
                e('div', { className: "grid grid-cols-3 gap-6" },
                    e('div', { className: "p-4 bg-white rounded-lg shadow-sm border border-slate-200" },
                        e('h3', { className: "text-sm font-bold text-slate-800 mb-6 flex items-center gap-2" },
                            e('div', { className: "w-1 h-4 bg-indigo-500 rounded-full" }),
                            "1. 사업장 개요"
                        ),
                        e('div', { className: "space-y-4" },
                            e('div', { className: "relative" },
                                e('label', { className: "text-[12px] font-extrabold text-slate-600 block mb-1" }, "사업장 검색/선택 *"),
                                e('div', { className: "relative" },
                                    e(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-300", size: 14 }),
                                    e('input', {
                                        type: "text",
                                        value: companySearchTerm,
                                        onChange: (ev) => { setCompanySearchTerm(ev.target.value); setShowCompanyDropdown(true); },
                                        onFocus: () => setShowCompanyDropdown(true),
                                        onBlur: () => setTimeout(() => setShowCompanyDropdown(false), 200),
                                        placeholder: "사업장명 입력...",
                                        className: "w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold",
                                        disabled: !!editingId
                                    })
                                ),
                                showCompanyDropdown && !editingId && e('div', { className: "absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto" },
                                    companies.filter(c => {
                                        const normalizeForSearch = (str) => (str || '').replace(/\(주\)|㈜|\s/g, '').toLowerCase();
                                        const normTerm = normalizeForSearch(companySearchTerm);
                                        const normName = normalizeForSearch(c.com_name);
                                        const normId = normalizeForSearch(c.com_id);
                                        return normName.includes(normTerm) || normId.includes(normTerm);
                                    }).map(c =>
                                        e('div', { key: c.com_id, onClick: () => { handleCompanySelect(c); setShowCompanyDropdown(false); }, className: "px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm" },
                                            e('p', { className: "font-bold" }, c.com_name),
                                            e('p', { className: "text-[10px] text-slate-400" }, c.office_name + " | " + c.com_id)
                                        )
                                    )
                                )
                            ),
                            selectedCompany && e('div', { className: "bg-indigo-50/30 p-4 rounded-xl text-xs space-y-2 border border-indigo-100" },
                                e('div', { className: "grid grid-cols-2 gap-x-2 gap-y-1" },
                                    e('div', { className: "col-span-2 pb-2 mb-2 border-b border-indigo-100" },
                                        e('p', { className: "text-slate-400 font-bold text-[10px]" }, "관할지청"),
                                        e('p', { className: "font-bold text-indigo-700 text-sm" }, selectedCompany.office_name)
                                    ),
                                    e('div', null, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "대표자"), e('p', { className: "font-bold" }, selectedCompany.ceo_name)),
                                    e('div', null, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "관리번호"), e('p', { className: "font-bold" }, selectedCompany.com_reg_no)),
                                    e('div', { className: "col-span-2 pt-1" }, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "소재지"), e('p', { className: "font-bold" }, selectedCompany.address)),
                                    e('div', { className: "col-span-2 pb-1" }, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "블럭 소재지"), e('p', { className: "font-bold text-slate-600" }, selectedCompany.block_address || '-')),
                                    e('div', null, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "담당자"), e('p', { className: "font-bold" }, selectedCompany.manager_name)),
                                    e('div', null, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "연락처"), e('p', { className: "font-bold" }, selectedCompany.manager_contact)),
                                    e('div', null, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "전화"), e('p', { className: "font-bold" }, selectedCompany.tel)),
                                    e('div', null, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "팩스"), e('p', { className: "font-bold" }, selectedCompany.fax)),
                                    e('div', { className: "col-span-2 pt-1" }, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "업종"), e('p', { className: "font-bold truncate" }, selectedCompany.biz_type)),
                                    e('div', { className: "col-span-2" }, e('p', { className: "text-slate-400 font-bold text-[10px]" }, "주생산품"), e('p', { className: "font-bold truncate" }, selectedCompany.main_product))
                                )
                            ),
                            e('div', { className: "pt-4 border-t border-slate-100" },
                                e('label', { className: "text-[12px] font-extrabold text-slate-600 block mb-2" }, "업무 구분 *"),
                                e('div', { className: "flex gap-2" },
                                    ['측정', '기타용역'].map(type =>
                                        e('button', {
                                            key: type,
                                            type: "button",
                                            onClick: () => {
                                                if (type === '측정') {
                                                    handleRecordChange('work_type', '측정');
                                                } else {
                                                    // Only reset if it was '측정' before, otherwise keep the detail
                                                    if (formData.work_type === '측정') {
                                                        handleRecordChange('work_type', '');
                                                    }
                                                }
                                            },
                                            className: `flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${(formData.work_type === '측정' && type === '측정') || (formData.work_type !== '측정' && type === '기타용역')
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'
                                                }`
                                        }, type)
                                    )
                                ),
                                formData.work_type !== '측정' && e('div', { className: "mt-3 animate-in fade-in slide-in-from-top-1 px-1" },
                                    e('label', { className: "text-[11px] font-bold text-slate-400 block mb-1" }, "상세 용역명 입력"),
                                    e('input', {
                                        type: "text",
                                        list: "common-services",
                                        value: formData.work_type === '측정' ? '' : formData.work_type,
                                        onChange: (ev) => handleRecordChange('work_type', ev.target.value),
                                        placeholder: "용역명을 입력하세요 (예: 위험성평가)",
                                        className: "w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                                    }),
                                    e('datalist', { id: "common-services" },
                                        ['근골격계 평가', '위험성평가', '국소배기장치 효율측정', '청력보존 프로그램', '호흡기보존 프로그램', '화학물질 관리지원'].map(serv =>
                                            e('option', { key: serv, value: serv })
                                        )
                                    )
                                )
                            ),
                            formData.work_type === '측정' && e('div', { className: "pt-4 border-t border-slate-100" },
                                e('div', { className: "flex justify-between items-center mb-1" },
                                    e('label', { className: "text-[11px] font-bold text-slate-400 block mb-2 uppercase" }, "일련번호 (자동생성)"),
                                    (formData.is_fixed === 'y' || formData.report_date) && e('div', { className: "flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded" },
                                        e(Lock, { size: 10 }), "번호 고정됨"
                                    )
                                ),
                                e('div', { className: "space-y-2" },
                                    e('div', { className: "flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100" },
                                        e('span', { className: "text-[10px] font-bold text-slate-400" }, "반기(전체/5인)"),
                                        (formData.is_fixed === 'y' || formData.report_date) ?
                                            e('span', { className: "text-xs font-mono font-bold text-slate-500 flex items-center gap-1" },
                                                e(Lock, { size: 10, className: "text-slate-400" }),
                                                (formData.half_all || '000') + " / " + (formData.half_o5 || '000')
                                            ) :
                                            e('div', { className: "flex gap-1" },
                                                e('input', {
                                                    value: formData.half_all || '',
                                                    onChange: (e) => handleRecordChange('half_all', e.target.value),
                                                    className: "w-10 text-center text-xs font-mono font-bold text-indigo-600 bg-white border border-slate-200 rounded",
                                                    placeholder: "전체"
                                                }),
                                                e('span', { className: "text-slate-300" }, "/"),
                                                e('input', {
                                                    value: formData.half_o5 || '',
                                                    onChange: (e) => handleRecordChange('half_o5', e.target.value),
                                                    className: "w-10 text-center text-xs font-mono font-bold text-indigo-600 bg-white border border-slate-200 rounded",
                                                    placeholder: "5인"
                                                })
                                            )
                                    ),
                                    e('div', { className: "flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100" },
                                        e('span', { className: "text-[10px] font-bold text-slate-400" }, "연간(전체/5인)"),
                                        (formData.is_fixed === 'y' || formData.report_date) ?
                                            e('span', { className: "text-xs font-mono font-bold text-slate-500 flex items-center gap-1" },
                                                e(Lock, { size: 10, className: "text-slate-400" }),
                                                (formData.year_all || '000') + " / " + (formData.year_o5 || '000')
                                            ) :
                                            e('div', { className: "flex gap-1" },
                                                e('input', {
                                                    value: formData.year_all || '',
                                                    onChange: (e) => handleRecordChange('year_all', e.target.value),
                                                    className: "w-10 text-center text-xs font-mono font-bold text-indigo-600 bg-white border border-slate-200 rounded",
                                                    placeholder: "전체"
                                                }),
                                                e('span', { className: "text-slate-300" }, "/"),
                                                e('input', {
                                                    value: formData.year_o5 || '',
                                                    onChange: (e) => handleRecordChange('year_o5', e.target.value),
                                                    className: "w-10 text-center text-xs font-mono font-bold text-indigo-600 bg-white border border-slate-200 rounded",
                                                    placeholder: "5인"
                                                })
                                            )
                                    )
                                )
                            )
                        )
                    ),
                    e('div', { className: "p-4 bg-white rounded-lg shadow-sm border border-slate-200" },
                        e('h3', { className: "text-sm font-bold text-slate-800 mb-6 flex items-center gap-2" },
                            e('div', { className: "w-1 h-4 bg-blue-500 rounded-full" }),
                            "2. 측정 기본 정보"
                        ),
                        e('div', { className: "space-y-4" },
                            e('div', { className: "grid grid-cols-2 gap-2" },
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "대상연도"),
                                    e('input', { type: "number", value: formData.target_year, onChange: (ev) => handleRecordChange('target_year', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold" })
                                ),
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "반기구분"),
                                    e('select', { value: formData.half_year, onChange: (ev) => handleRecordChange('half_year', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold" },
                                        e('option', { value: "상반기" }, "상반기"),
                                        e('option', { value: "하반기" }, "하반기"),
                                        e('option', { value: "연간" }, "연간")
                                    )
                                )
                            ),
                            e('div', { className: "space-y-1" },
                                e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "측정자 (최대 6명)"),
                                e('div', { className: "flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-[100px] overflow-y-auto" },
                                    users.map(u => {
                                        const selected = (formData.inspector || '').split(',').map(s => s.trim()).includes(u.user_name);
                                        return e('button', {
                                            key: u.user_id,
                                            type: "button",
                                            onClick: () => {
                                                const current = (formData.inspector || '').split(',').map(s => s.trim()).filter(Boolean);
                                                let updated;
                                                if (selected) {
                                                    updated = current.filter(name => name !== u.user_name);
                                                } else {
                                                    if (current.length >= 6) {
                                                        alert('측정자는 최대 6명까지 선택 가능합니다.');
                                                        return;
                                                    }
                                                    updated = [...current, u.user_name];
                                                }
                                                handleRecordChange('inspector', updated.join(', '));
                                            },
                                            className: `px-2 py-1 rounded text-[11px] font-bold transition-all ${selected
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-300'
                                                }`
                                        }, u.user_name);
                                    })
                                )
                            ),
                            e('div', { className: "space-y-1" },
                                e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "근로자수"),
                                e('input', { type: "number", placeholder: "인원", value: formData.worker_cnt, onChange: (ev) => handleRecordChange('worker_cnt', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold" })
                            ),
                            e('div', { className: "space-y-1" },
                                e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "측정 기간 *"),
                                e('div', { className: "grid grid-cols-2 gap-2" },
                                    e('input', { required: true, type: "date", value: formData.start_date, onChange: (ev) => handleRecordChange('start_date', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center font-bold" }),
                                    e('input', { required: true, type: "date", value: formData.end_date, onChange: (ev) => handleRecordChange('end_date', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center font-bold" })
                                )
                            ),
                            e('div', { className: "space-y-1 pt-2" },
                                e('div', { className: "grid grid-cols-2 gap-2" },
                                    e('div', null,
                                        e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "신규여부"),
                                        e('select', { value: formData.is_new, onChange: (ev) => handleRecordChange('is_new', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold" },
                                            e('option', { value: "기존" }, "기존"),
                                            e('option', { value: "신규" }, "신규")
                                        )
                                    ),
                                    e('div', null,
                                        e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "CMR취급"),
                                        e('select', { value: formData.is_cmr, onChange: (ev) => handleRecordChange('is_cmr', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold" },
                                            e('option', { value: "n" }, "없음"),
                                            e('option', { value: "y" }, "있음")
                                        )
                                    )
                                )
                            ),
                            e('div', { className: "space-y-1" },
                                e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "예비조사일"),
                                e('input', { type: "date", value: formData.survey_date, onChange: (ev) => handleRecordChange('survey_date', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold" })
                            ),
                            e('div', { className: "pt-2" },
                                e('label', { className: "text-[11px] font-bold text-slate-400 block mb-2 uppercase" }, "차기 측정 예정일"),
                                e('div', { className: "grid grid-cols-2 gap-2" },
                                    e('div', { className: "space-y-1" },
                                        e('label', { className: "text-[10px] font-bold text-slate-400 ml-1 font-mono" }, "소음"),
                                        e('select', { value: formData.noise_cycle, onChange: (ev) => handleRecordChange('noise_cycle', ev.target.value), className: "w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold" },
                                            e('option', { value: "3" }, "3개월"),
                                            e('option', { value: "6" }, "6개월"),
                                            e('option', { value: "12" }, "12개월"),
                                            e('option', { value: "없음" }, "없음")
                                        ),
                                        e('p', { className: "text-lg font-mono text-indigo-600 text-center font-bold" }, formData.next_noise_date || '---- -- --')
                                    ),
                                    e('div', { className: "space-y-1" },
                                        e('label', { className: "text-[10px] font-bold text-slate-400 ml-1 font-mono" }, "소음외"),
                                        e('select', { value: formData.noise_excl_cycle, onChange: (ev) => handleRecordChange('noise_excl_cycle', ev.target.value), className: "w-full px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center font-bold outline-none" },
                                            e('option', { value: "3" }, "3개월"),
                                            e('option', { value: "6" }, "6개월"),
                                            e('option', { value: "12" }, "12개월"),
                                            e('option', { value: "없음" }, "없음")
                                        ),
                                        e('p', { className: "text-lg font-mono text-indigo-600 text-center font-bold" }, formData.next_excl_date || '---- -- --')
                                    )
                                )
                            )
                        )
                    ),
                    e('div', { className: "p-4 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col gap-6" },
                        e('div', null,
                            e('h3', { className: "text-sm font-bold text-slate-800 mb-6 flex items-center gap-2" },
                                e('div', { className: "w-1 h-4 bg-emerald-500 rounded-full" }),
                                "3. 주기 및 지원 현황"
                            ),
                            e('div', { className: "space-y-4" },
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "지원 여부"),
                                    e('select', { value: formData.is_funded, onChange: (ev) => handleRecordChange('is_funded', ev.target.value), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold" },
                                        e('option', { value: "비대상" }, "비대상"),
                                        e('option', { value: "대상" }, "대상")
                                    )
                                ),
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[12px] font-extrabold text-slate-600 ml-1" }, "실금액 (단가) *"),
                                    e('input', {
                                        required: true,
                                        type: "text",
                                        value: formatNumber(formData.actual_amt),
                                        onChange: (ev) => handleRecordChange('actual_amt', parseNumber(ev.target.value)),
                                        className: "w-full px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-bold outline-none text-center text-indigo-700"
                                    })
                                ),
                                e('div', { className: "grid grid-cols-2 gap-2" },
                                    e('div', { className: "space-y-1" },
                                        e('label', { className: "text-[11px] font-extrabold text-slate-600 ml-1" }, "공단 지원금"),
                                        e('input', { readOnly: true, value: Math.floor(Number(formData.subsidy) || 0).toLocaleString(), className: "w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-emerald-600 outline-none text-center" })
                                    ),
                                    e('div', { className: "space-y-1" },
                                        e('label', { className: "text-[11px] font-extrabold text-indigo-600 ml-1" }, "사업장 청구금"),
                                        e('input', {
                                            type: "text",
                                            value: formatNumber(formData.billing_amt),
                                            onChange: (ev) => handleRecordChange('billing_amt', parseNumber(ev.target.value)),
                                            className: "w-full px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-center text-indigo-800 outline-none"
                                        })
                                    )
                                )
                            )
                        ),
                        e('div', { className: "pt-4 border-t border-slate-100" },
                            e('h3', { className: "text-sm font-bold text-slate-800 mb-6 flex items-center gap-2" },
                                e('div', { className: "w-1 h-4 bg-amber-500 rounded-full" }),
                                "4. 공단보고 및 입금"
                            ),
                            e('div', { className: "grid grid-cols-2 gap-3" },
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[11px] font-extrabold text-slate-600 ml-1" }, "전산보고 일자"),
                                    e('input', { type: "date", value: formData.report_date, onChange: (ev) => handleRecordChange('report_date', ev.target.value), className: "w-full px-2 py-1.5 bg-amber-50/30 border border-amber-100 rounded-lg text-[11px] text-center font-bold" })
                                ),
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[11px] font-extrabold text-slate-600 ml-1" }, "실 발송일"),
                                    e('input', { type: "date", value: formData.shipping_date, onChange: (ev) => handleRecordChange('shipping_date', ev.target.value), className: "w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-center font-bold" })
                                ),
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[11px] font-extrabold text-slate-600 ml-1" }, "청구서 발행일"),
                                    e('input', { type: "date", value: formData.billing_date, onChange: (ev) => handleRecordChange('billing_date', ev.target.value), className: "w-full px-2 py-1.5 bg-blue-50/30 border border-blue-100 rounded-lg text-[11px] text-center font-bold" })
                                ),
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[11px] font-extrabold text-slate-600 ml-1" }, "지원금 입금일"),
                                    e('input', { type: "date", value: formData.subsidy_date, onChange: (ev) => handleRecordChange('subsidy_date', ev.target.value), className: "w-full px-2 py-1.5 bg-emerald-50/30 border border-emerald-100 rounded-lg text-[11px] text-center font-bold" })
                                ),
                                e('div', { className: "space-y-1 col-span-2" },
                                    e('label', { className: "text-[11px] font-extrabold text-slate-600 ml-1" }, "사업장 입금 처리일"),
                                    e('input', { type: "date", value: formData.deposit_date, onChange: (ev) => handleRecordChange('deposit_date', ev.target.value), className: "w-full px-2 py-1.5 bg-emerald-50/30 border border-emerald-100 rounded-lg text-[11px] font-bold text-center" })
                                ),
                                e('div', { className: "space-y-1" },
                                    e('label', { className: "text-[11px] font-extrabold text-slate-600 ml-1" }, "보고서 작성일"),
                                    e('input', { type: "date", value: formData.document_date || '', onChange: (ev) => handleRecordChange('document_date', ev.target.value), className: "w-full px-2 py-1.5 bg-indigo-50/30 border border-indigo-100 rounded-lg text-[11px] font-bold text-center" })
                                )
                            )
                        )
                    )
                )
            ),
            e('div', { className: "p-4 border-t bg-slate-50 flex gap-3 justify-end" },
                e('button', { type: "button", onClick: onClose, className: "px-6 py-2 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-all" }, "취소"),
                e('button', { onClick: () => onSave(), disabled: loading, className: "px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2" },
                    e(Save, { size: 18 }),
                    editingId ? '기록 업데이트' : '측정기록 저장'
                )
            )
        ));
}

// ----------------------------------------------------------------------
// 라벨 인쇄 스크립트 연결 (독립 팝업)
// ----------------------------------------------------------------------
function handleLabelPrintDisplay(selectedRecords) {
    if (selectedRecords.length === 0) {
        alert('라벨을 출력할 항목을 선택해주세요.');
        return;
    }

    // 초기 시작 위치는 1로 설정 (팝업 내부에서 조정 가능)
    openLabelPrintWindow(selectedRecords, 1);
}




function UnreportedModal({ isOpen, onClose, unreportedRecords }) {
    if (!isOpen) return null;

    return e('div', { className: "fixed inset-0 z-50 flex items-center justify-center p-4" },
        e('div', { className: "absolute inset-0 bg-slate-900/40 backdrop-blur-sm", onClick: onClose }),
        e('div', { className: "bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] z-20 overflow-hidden flex flex-col" },
            e('div', { className: "p-6 border-b flex items-center justify-between bg-amber-50" },
                e('h2', { className: "text-xl font-black text-amber-800 flex items-center gap-2" },
                    e(AlertCircle, { size: 24, className: "text-amber-600" }),
                    `전산미보고 사업장 (${unreportedRecords.length}건)`
                ),
                e('button', { onClick: onClose, className: "p-2 hover:bg-amber-100 rounded-lg text-slate-400" },
                    e(X, { size: 24 })
                )
            ),
            e('div', { className: "flex-1 overflow-y-auto p-6" },
                unreportedRecords.length === 0 ?
                    e('div', { className: "text-center py-12 text-slate-400 font-bold" }, "조건에 맞는 미보고 기록이 없습니다.") :
                    e('div', { className: "space-y-3" },
                        unreportedRecords.map((rec, idx) =>
                            e('div', {
                                key: rec.id,
                                className: "bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                            },
                                e('div', { className: "flex items-start justify-between" },
                                    e('div', { className: "flex-1" },
                                        e('div', { className: "flex items-center gap-3 mb-2" },
                                            e('span', { className: "inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded" }, `#${idx + 1}`),
                                            e('h3', { className: "text-base font-black text-slate-800" }, rec.com_name)
                                        ),
                                        e('div', { className: "grid grid-cols-2 gap-x-4 gap-y-1 text-sm" },
                                            e('div', { className: "flex items-center gap-2" },
                                                e('span', { className: "text-slate-400 font-bold text-xs" }, "측정기간:"),
                                                e('span', { className: "text-slate-700 font-bold" }, `${rec.start_date || '-'} ~ ${rec.end_date || '-'}`)
                                            ),
                                            e('div', { className: "flex items-center gap-2" },
                                                e('span', { className: "text-slate-400 font-bold text-xs" }, "담당자:"),
                                                e('span', { className: "text-slate-700 font-bold" }, rec.inspector || '-')
                                            ),
                                            e('div', { className: "flex items-center gap-2" },
                                                e('span', { className: "text-slate-400 font-bold text-xs" }, "연도/반기:"),
                                                e('span', { className: "text-slate-700 font-bold" }, `${rec.target_year}년 ${rec.half_year}`)
                                            ),
                                            e('div', { className: "flex items-center gap-2" },
                                                e('span', { className: "text-slate-400 font-bold text-xs" }, "관할지청:"),
                                                e('span', { className: "text-slate-700 font-bold" }, rec.office_name)
                                            )
                                        )
                                    ),
                                    e('div', { className: "flex flex-col items-end gap-1" },
                                        e('span', { className: "text-red-600 font-black text-sm" }, "미보고"),
                                        rec.shipping_date && e('span', { className: "text-xs text-slate-400 font-bold" }, `발송: ${rec.shipping_date}`)
                                    )
                                )
                            )
                        )
                    )
            ),
            e('div', { className: "p-4 border-t bg-slate-50 flex justify-end" },
                e('button', { onClick: onClose, className: "px-6 py-2 bg-slate-600 text-white font-bold rounded-xl hover:bg-slate-700 transition-all" }, "닫기")
            )
        )
    );
}

// ==== Components: RecordsManagement ====
// ==== Components: UnpaidDetailsModal ====
function UnpaidDetailsModal({ isOpen, onClose, title, items }) {
    if (!isOpen) return null;
    return e('div', { className: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" },
        e('div', { className: "bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col z-10 overflow-hidden animate-in fade-in zoom-in duration-200" },
            e('div', { className: "p-6 border-b flex items-center justify-between bg-slate-50" },
                e('h2', { className: "text-xl font-black text-slate-800" }, title, e('span', { className: "ml-2 text-slate-400 font-bold" }, `(${items.length}건)`)),
                e('button', { onClick: onClose, className: "p-2 hover:bg-slate-200 rounded-lg text-slate-400" },
                    e(X, { size: 24 })
                )
            ),
            e('div', { className: "flex-1 overflow-y-auto p-6" },
                e('table', { className: "w-full text-left" },
                    e('thead', { className: "bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest" },
                        e('tr', null,
                            e('th', { className: "p-3" }, "사업장명"),
                            e('th', { className: "p-3 text-center" }, "지청"),
                            e('th', { className: "p-3 text-center" }, "측정종료일"),
                            e('th', { className: "p-3 text-center" }, "청구발행일"),
                            e('th', { className: "p-3 text-right" }, "사업장 청구금"),
                            e('th', { className: "p-3 text-right" }, "공단지원금"),
                            e('th', { className: "p-3 text-center" }, "입금상태")
                        )
                    ),
                    e('tbody', { className: "divide-y text-[13px]" },
                        items.length === 0 ? e('tr', null, e('td', { colSpan: "7", className: "p-12 text-center text-slate-400" }, "해당하는 기록이 없습니다.")) :
                            items.map((r, idx) => {
                                const isBizPaid = !!r.deposit_date;
                                const isSubPaid = !!r.subsidy_date;
                                const isFunded = r.is_funded === '대상';

                                return e('tr', { key: r.id || idx, className: "hover:bg-slate-50" },
                                    e('td', { className: "p-3" }, e('div', { className: "font-bold text-slate-800" }, r.com_name), e('div', { className: "text-[10px] text-slate-400" }, r.com_id)),
                                    e('td', { className: "p-3 text-center" }, e('span', { className: "px-2 py-1 bg-slate-100 rounded text-[11px] font-bold" }, r.office_name)),
                                    e('td', { className: "p-3 text-center font-mono text-slate-500" }, r.end_date || '-'),
                                    e('td', { className: "p-3 text-center font-mono text-slate-500" }, r.billing_date || '-'),
                                    e('td', { className: "p-3 text-right font-bold text-rose-600" }, (Number(r.billing_amt) || 0).toLocaleString(), "원"),
                                    e('td', { className: "p-3 text-right font-bold text-blue-600" }, (Number(r.subsidy) || 0).toLocaleString(), "원"),
                                    e('td', { className: "p-3 text-center" },
                                        e('div', { className: "flex flex-col gap-1 items-center" },
                                            e('span', { className: `px-2 py-0.5 rounded-[4px] text-[10px] font-black ${isBizPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}` }, isBizPaid ? '사업장:완료' : '사업장:미납'),
                                            isFunded && e('span', { className: `px-2 py-0.5 rounded-[4px] text-[10px] font-black ${isSubPaid ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}` }, isSubPaid ? '공단:완료' : '공단:미납')
                                        )
                                    )
                                );
                            })
                    )
                )
            )
        )
    );
}

// ==== Components: UnpaidManagementTab ====
function UnpaidManagementTab({ records, companies }) {
    const { useState, useMemo, useEffect } = React;
    const [search, setSearch] = useState('');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterMonth, setFilterMonth] = useState('all');
    const [filterHalf, setFilterHalf] = useState('all');
    const [filterOffice, setFilterOffice] = useState('all');
    const [modal, setModal] = useState({ isOpen: false, title: '', items: [] });

    // Stats calculations
    const statsBaseData = useMemo(() => {
        let data = records;
        if (filterYear) data = data.filter(r => (r.end_date || '').startsWith(String(filterYear)));
        if (filterOffice !== 'all') {
            const targetCode = getOfficeCode(filterOffice);
            data = data.filter(r => getOfficeCode(r.office_name) === targetCode);
        }
        return data;
    }, [records, filterYear, filterOffice]);

    const stats = useMemo(() => {
        return statsBaseData.reduce((acc, r) => {
            const amt = Number(r.billing_amt) || 0;
            const subsidy = Number(r.subsidy) || 0;
            acc.billed += r.billing_date ? amt : 0;
            acc.unbilled += !r.billing_date ? amt : 0;
            acc.unpaid += (r.billing_date && !r.deposit_date) ? amt : 0;
            acc.noReport += !r.report_date ? 1 : 0;
            acc.totalSubsidy += r.is_funded === '대상' ? subsidy : 0;
            acc.unpaidSubsidy += (r.is_funded === '대상' && !r.subsidy_date) ? subsidy : 0;
            return acc;
        }, { totalCount: statsBaseData.length, billed: 0, unbilled: 0, unpaid: 0, noReport: 0, totalSubsidy: 0, unpaidSubsidy: 0 });
    }, [statsBaseData]);

    const filteredTableData = useMemo(() => {
        let data = statsBaseData;
        if (search) {
            const normalize = (val) => (val || '').replace(/\(주\)|㈜|\s/g, '').toLowerCase();
            const term = normalize(search);
            data = data.filter(r => normalize(r.com_name).includes(term));
        }
        if (filterMonth !== 'all') {
            data = data.filter(r => r.end_date && new Date(r.end_date).getMonth() + 1 === parseInt(filterMonth));
        } else if (filterHalf !== 'all') {
            data = data.filter(r => {
                if (!r.end_date) return false;
                const m = new Date(r.end_date).getMonth() + 1;
                return filterHalf === '1' ? m <= 6 : m > 6;
            });
        }
        return data;
    }, [statsBaseData, search, filterMonth, filterHalf]);

    const openModal = (type) => {
        let items = [];
        let title = '';
        const enrich = (list) => list.map(r => {
            const company = companies.find(c => c.com_id === r.com_id);
            return { ...r, ceo_name: company?.ceo_name, contact: company?.manager_contact || company?.tel };
        });

        if (type === 'all') { items = enrich(statsBaseData); title = '조회된 기록 목록'; }
        else if (type === 'unbilled') { items = enrich(statsBaseData.filter(r => !r.billing_date)); title = '미청구 목록'; }
        else if (type === 'unpaid') { items = enrich(statsBaseData.filter(r => r.billing_date && !r.deposit_date)); title = '사업장 미수금 목록'; }
        else if (type === 'noReport') { items = enrich(statsBaseData.filter(r => !r.report_date)); title = '전산미보고 목록'; }
        else if (type === 'unpaidSubsidy') { items = enrich(statsBaseData.filter(r => r.is_funded === '대상' && !r.subsidy_date)); title = '지원금 미수금액 목록'; }

        setModal({ isOpen: true, title, items });
    };

    return e('div', { className: "animate-in fade-in slide-in-from-bottom-2" },
        e('div', { className: "grid grid-cols-4 gap-6 mb-6" },
            e('div', { onClick: () => openModal('all'), className: "p-6 rounded-2xl shadow-sm border bg-white border-slate-100 transition-all cursor-pointer hover:-translate-y-1" },
                e('span', { className: "text-xs font-bold block mb-2 text-slate-400" }, "조회된 기록"),
                e('span', { className: "text-2xl font-black text-slate-800" }, `${stats.totalCount.toLocaleString()}건`)
            ),
            e('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center opacity-80" },
                e('span', { className: "text-xs font-bold text-slate-400 block mb-2" }, "총 청구"),
                e('span', { className: "text-2xl font-black text-slate-800" }, `${(stats.billed / 10000).toLocaleString()}만`)
            ),
            e('div', { onClick: () => openModal('unbilled'), className: "p-6 rounded-2xl shadow-sm border bg-amber-50 border-amber-100 transition-all cursor-pointer hover:-translate-y-1" },
                e('span', { className: "text-xs font-bold text-amber-500 block mb-2" }, "미청구"),
                e('span', { className: "text-2xl font-black text-amber-600" }, `${(stats.unbilled / 10000).toLocaleString()}만`)
            ),
            e('div', { onClick: () => openModal('unpaid'), className: "p-6 rounded-2xl shadow-sm border bg-rose-50 border-rose-100 transition-all cursor-pointer hover:-translate-y-1" },
                e('span', { className: "text-xs font-bold text-rose-400 block mb-2" }, "사업장 미수금"),
                e('span', { className: "text-2xl font-black text-rose-600" }, `${(stats.unpaid / 10000).toLocaleString()}만`)
            )
        ),
        e('div', { className: "grid grid-cols-4 gap-6 mb-8" },
            e('div', { onClick: () => openModal('noReport'), className: "p-6 rounded-2xl shadow-sm border bg-slate-50 border-slate-100 transition-all cursor-pointer hover:-translate-y-1" },
                e('span', { className: "text-xs font-bold text-slate-400 block mb-2" }, "전산미보고"),
                e('span', { className: "text-2xl font-black text-slate-600" }, `${stats.noReport.toLocaleString()}건`)
            ),
            e('div', { className: "bg-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-center opacity-80" },
                e('span', { className: "text-xs font-bold text-blue-400 block mb-2" }, "총 지원금 금액"),
                e('span', { className: "text-2xl font-black text-blue-600" }, `${(stats.totalSubsidy / 10000).toLocaleString()}만`)
            ),
            e('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center opacity-50" },
                e('span', { className: "text-xs font-extrabold text-slate-400 px-2" }, "미수금 제로를 향하여! 🚀")
            ),
            e('div', { onClick: () => openModal('unpaidSubsidy'), className: "p-6 rounded-2xl shadow-sm border bg-purple-50 border-purple-100 transition-all cursor-pointer hover:-translate-y-1" },
                e('span', { className: "text-xs font-bold text-purple-400 block mb-2" }, "지원금 미수금액"),
                e('span', { className: "text-2xl font-black text-purple-600" }, `${(stats.unpaidSubsidy / 10000).toLocaleString()}만`)
            )
        ),
        e('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center mb-6" },
            e('div', { className: "flex bg-slate-100 p-1 rounded-xl" },
                e('select', { value: filterOffice, onChange: ev => setFilterOffice(ev.target.value), className: "bg-transparent font-bold p-2 text-sm outline-none cursor-pointer" },
                    e('option', { value: "all" }, "전체 지청"),
                    ['안산', '경기', '평택', '서울서부'].map(o => e('option', { key: o, value: o }, o))
                ),
                e('select', { value: filterYear, onChange: ev => setFilterYear(ev.target.value), className: "bg-transparent font-bold p-2 text-sm outline-none cursor-pointer" },
                    [2024, 2025, 2026, 2027].map(y => e('option', { key: y, value: y }, `${y}년`))
                ),
                e('select', { value: filterHalf, onChange: ev => { setFilterHalf(ev.target.value); setFilterMonth('all'); }, className: "bg-transparent font-bold p-2 text-sm outline-none cursor-pointer" },
                    e('option', { value: "all" }, "전체 반기"),
                    e('option', { value: "1" }, "상반기"), e('option', { value: "2" }, "하반기")
                ),
                e('select', { value: filterMonth, onChange: ev => { setFilterMonth(ev.target.value); setFilterHalf('all'); }, className: "bg-transparent font-bold p-2 text-sm outline-none cursor-pointer" },
                    e('option', { value: "all" }, "전체 월"),
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => e('option', { key: m, value: m }, `${m}월`))
                )
            ),
            e('div', { className: "relative flex-1" },
                e(Search, { className: "absolute left-3 top-2.5 w-4 h-4 text-slate-400" }),
                e('input', { placeholder: "사업장명으로 상세 검색...", value: search, onChange: ev => setSearch(ev.target.value), className: "w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold" })
            )
        ),
        e('div', { className: "bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" },
            e('table', { className: "w-full text-left" },
                e('thead', { className: "bg-slate-50 border-b text-xs font-bold text-slate-400 uppercase tracking-widest" },
                    e('tr', null,
                        e('th', { className: "p-6" }, "사업장명"), e('th', { className: "p-6" }, "종료일/발송일"), e('th', { className: "p-6 text-right" }, "사업장 청구"), e('th', { className: "p-6 text-right" }, "지원금 금액"), e('th', { className: "p-6 text-center" }, "지원금 상태"), e('th', { className: "p-6 text-center" }, "입금상태")
                    )
                ),
                e('tbody', { className: "divide-y text-sm" },
                    filteredTableData.length === 0 ? e('tr', null, e('td', { colSpan: "6", className: "p-12 text-center text-slate-400" }, "데이터가 없습니다.")) :
                        filteredTableData.map(r => {
                            const isSubPaid = !!r.subsidy_date; const isPaid = !!r.deposit_date;
                            return e('tr', { key: r.id, className: "hover:bg-slate-50 transition-colors" },
                                e('td', { className: "p-6" }, e('div', { className: "font-bold text-slate-800 text-lg" }, r.com_name), e('div', { className: "text-xs text-slate-400" }, r.com_id)),
                                e('td', { className: "p-6" }, e('div', { className: "font-bold" }, r.end_date), e('div', { className: "text-xs text-slate-400" }, `발송: ${r.shipping_date || '-'}`)),
                                e('td', { className: "p-6 text-right font-bold" }, (Number(r.billing_amt) || 0).toLocaleString()),
                                e('td', { className: "p-6 text-right font-bold text-blue-600" }, (Number(r.subsidy) || 0).toLocaleString()),
                                e('td', { className: "p-6 text-center" }, r.is_funded !== '대상' ? '-' : isSubPaid ? e('span', { className: "text-emerald-500 font-bold" }, "완료") : e('span', { className: "text-purple-500 font-bold animate-pulse" }, "미수")),
                                e('td', { className: "p-6 text-center" }, isPaid ? e('span', { className: "bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold" }, `완료 (${r.deposit_date})`) : e('span', { className: "bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-bold" }, "미납"))
                            );
                        })
                )
            )
        ),
        e(UnpaidDetailsModal, { isOpen: modal.isOpen, onClose: () => setModal({ ...modal, isOpen: false }), title: modal.title, items: modal.items })
    );
}

const INITIAL_RECORD = {
    com_id: '', com_name: '', office_name: '안산', target_year: String(new Date().getFullYear()),
    half_year: '상반기', is_new: '기존', is_cmr: 'n', start_date: '', end_date: '',
    survey_date: '', worker_cnt: 0, inspector: '', noise_cycle: '6', noise_excl_cycle: '6',
    next_noise_date: '', next_excl_date: '', is_funded: '대상', actual_amt: 0, billing_amt: 0,
    subsidy: 0, half_all: '', half_o5: '', year_all: '', year_o5: '', report_date: '',
    shipping_date: '', subsidy_date: '', billing_date: '', deposit_date: '', is_fixed: 'n',
    work_type: '측정', document_date: ''
};

function RecordsManagement() {
    const [user, setUser] = useState(null);
    const [records, setRecords] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [agencies, setAgencies] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedIds, setSelectedIds] = useState([]);
    const [isUnreportedModalOpen, setIsUnreportedModalOpen] = useState(false);
    const [analysisStatuses, setAnalysisStatuses] = useState({}); // { [recordId]: { total, completed, samples } }
    const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);
    const [selectedStatusRecord, setSelectedStatusRecord] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (최신순) or 'asc' (과거순)

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const defaultHalf = currentMonth <= 6 ? '상반기' : '하반기';

    const [yearFilter, setYearFilter] = useState(String(currentYear));
    const [halfYearFilter, setHalfYearFilter] = useState(defaultHalf);
    const [officeFilter, setOfficeFilter] = useState('전체');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(INITIAL_RECORD);
    const [editingId, setEditingId] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [activeTab, setActiveTab] = useState('records'); // 'records' or 'unpaid'

    const isAdmin = useMemo(() => {
        if (!user) return false;
        const userName = (user.user_name || '').trim();
        return user.is_admin === true || user.role === '관리자' || userName === '이승용' || userName === '강경호';
    }, [user]);

    useEffect(() => {
        const session = checkAuth();
        if (session) {
            setUser(session);
            fetchData();

        }
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [resRecords, resCompany, resAgencies, resUsers] = await Promise.all([
                supabase.from('kiwe_records').select('*').order('end_date', { ascending: false }),
                supabase.from('kiwe_companies').select('*'),
                supabase.from('kiwe_agencies').select('*'),
                supabase.from('kiwe_users').select('*').is('resign_date', null).eq('job_title', '측정자').order('user_name')
            ]);
            if (resRecords.error) throw resRecords.error;
            if (resCompany.error) throw resCompany.error;
            if (resAgencies.error) throw resAgencies.error;
            if (resUsers.error) throw resUsers.error;

            setRecords(resRecords.data || []);
            setCompanies(resCompany.data || []);
            setAgencies(resAgencies.data || []);
            setUsers(resUsers.data || []);

            // Fetch analysis statuses for these records
            if (resRecords.data) {
                fetchAnalysisStatuses(resRecords.data);
            }
        } catch (err) { alert('데이터를 불러오는데 실패했습니다.'); }
        finally { setLoading(false); }
    }

    async function fetchAnalysisStatuses(recordList) {
        if (!recordList || recordList.length === 0) return;

        const statusMap = {};
        const tablesToQuery = new Set();

        const getTables = (start, end) => {
            const tabs = new Set();
            if (!start || !end) return [];
            const s = new Date(start);
            const e = new Date(end);
            let curr = new Date(s);
            while (curr <= e) {
                const year = curr.getFullYear();
                const half = (curr.getMonth() + 1) <= 6 ? 1 : 2;
                tabs.add(`kiwe_sampling_${year}_${half}`);
                curr.setMonth(curr.getMonth() + 6);
                curr.setDate(1);
            }
            const ey = e.getFullYear();
            const eh = (e.getMonth() + 1) <= 6 ? 1 : 2;
            tabs.add(`kiwe_sampling_${ey}_${eh}`);
            return Array.from(tabs);
        };

        recordList.forEach(r => {
            getTables(r.start_date, r.end_date).forEach(t => tablesToQuery.add(t));
        });

        for (const tableName of tablesToQuery) {
            try {
                // Sharded tables use com_name, not com_id.
                const comNames = [...new Set(recordList.map(r => r.com_name))];

                // Chunk to fix 400 error (too many names in single filter)
                const CHUNK_SIZE = 30;
                for (let i = 0; i < comNames.length; i += CHUNK_SIZE) {
                    const chunk = comNames.slice(i, i + CHUNK_SIZE);
                    const { data, error } = await supabase
                        .from(tableName)
                        .select('com_name, m_date, status, common_name, sample_id, worker_name')
                        .in('com_name', chunk);

                    if (error) {
                        // Fix 404 error: Relation not found (Future/Past shards might not exist)
                        if (error.code === '42P01' || error.message?.includes('not found') || error.status === 404) {
                            console.warn(`Shard table ${tableName} missing. skipping.`);
                            break;
                        }
                        console.error(`Error fetching statuses from ${tableName}:`, error);
                        continue;
                    }

                    if (data) {
                        data.forEach(sample => {
                            // Match sample to records using normalized com_name
                            const normalize = (val) => (val || '').replace(/\(주\)|㈜|\s/g, '');
                            const normSampleName = normalize(sample.com_name);

                            recordList.forEach(r => {
                                const normRecordName = normalize(r.com_name);
                                if (normRecordName === normSampleName && sample.m_date >= r.start_date && sample.m_date <= r.end_date) {
                                    if (!statusMap[r.id]) statusMap[r.id] = { total: 0, completed: 0, samples: [] };
                                    
                                    // Skip noise records completely from progress statistics
                                    if (sample.common_name === '소음') return;

                                    statusMap[r.id].total++;
                                    if (isCompleteStatus(sample.status)) statusMap[r.id].completed++;
                                    statusMap[r.id].samples.push(sample);
                                }
                            });
                        });
                    }
                }
            } catch (e) {
                console.error(`Table ${tableName} unexpected error:`, e);
            }
        }
        setAnalysisStatuses(statusMap);
    }

    const handleCompanySelect = (company) => {
        setSelectedCompany(company);
        setFormData(prev => ({ ...prev, com_id: company.com_id, com_name: company.com_name, office_name: company.office_name }));
    };

    const calculateSupport = (record) => {
        const cost = Number(record.actual_amt) || 0;
        if (record.is_funded === '비대상') return 0;
        if (record.is_new === '신규') return Math.min(cost, 1000000);
        return Math.min(cost * 0.8, 400000);
    };

    const calculateNextDate = (endDate, cycle) => {
        if (!endDate || cycle === '없음') return '';
        const date = new Date(endDate);
        const months = parseInt(cycle);
        if (isNaN(months)) return '';

        // Add months
        date.setMonth(date.getMonth() + months);

        // Subtract 1 day (First day inclusion principle)
        // Ensure this works correctly by creating a new date object if needed, 
        // but setDate handles month rollback automatically.
        date.setDate(date.getDate() - 1);

        return date.toISOString().split('T')[0];
    };

    const handleRecordChange = (field, value) => {
        setFormData(prev => {
            let updated = { ...prev, [field]: value };
            if (['is_funded', 'is_new', 'actual_amt'].includes(field)) {
                updated.subsidy = calculateSupport(updated);
            }
            if (['end_date', 'noise_cycle'].includes(field)) {
                updated.next_noise_date = calculateNextDate(updated.end_date, updated.noise_cycle);
            }
            if (['end_date', 'noise_excl_cycle'].includes(field)) {
                updated.next_excl_date = calculateNextDate(updated.end_date, updated.noise_excl_cycle);
            }
            // Auto-lock if report_date is set
            if (field === 'report_date' && value) {
                updated.is_fixed = 'y';
            }
            return updated;
        });
    };

    const recalculateSequences = async (office, year, half) => {
        const targetGroupCode = getOfficeCode(office);
        const searchYear = String(year);
        const searchHalf = String(half);

        console.log(`[Recalc] Request - Group: ${targetGroupCode}, Year: ${searchYear}, Half: ${searchHalf}`);

        // Fetch ALL records for the year/half (ignore work_type here to capture nulls)
        const { data: allRecords, error } = await supabase
            .from('kiwe_records')
            .select('*')
            .eq('target_year', searchYear)
            .eq('half_year', searchHalf)
            .order('start_date', { ascending: true });

        if (error || !allRecords) {
            console.error('[Recalc] Fetch error:', error);
            return;
        }

        console.log(`[Recalc] Raw Data Count: ${allRecords.length}`);

        // Filter group by code mapping AND work_type (treat null/empty as '측정')
        const groupRecords = allRecords.filter(r => {
            const wType = r.work_type || '측정';
            const oCode = getOfficeCode(r.office_name);
            const isMatch = wType === '측정' && oCode === targetGroupCode;

            // Debug each potential match
            if (oCode === targetGroupCode) {
                console.log(`[Recalc Detail] Match Check: ${r.com_name} | work_type: ${r.work_type} | Match: ${isMatch}`);
            }
            return isMatch;
        });

        console.log(`[Recalc] FINAL GROUP MEMBERS:`, groupRecords.map(r => r.com_name));
        console.log(`[Recalc] Group size: ${groupRecords.length}`);

        if (groupRecords.length === 0) return;

        let updates = [];

        // 1. Identify used slots from Locked Records
        const lockedRecords = groupRecords.filter(r => (r.is_fixed === 'y' || r.report_date));
        const usedHalfAll = new Set(lockedRecords.map(r => Number(r.half_all)).filter(n => n > 0));
        const usedHalfO5 = new Set(lockedRecords.map(r => Number(r.half_o5)).filter(n => n > 0));
        const usedYearAll = new Set(lockedRecords.map(r => Number(r.year_all)).filter(n => n > 0));
        const usedYearO5 = new Set(lockedRecords.map(r => Number(r.year_o5)).filter(n => n > 0));

        let h_all_ctr = 1;
        let h_o5_ctr = 1;
        let y_all_ctr = 1;
        let y_o5_ctr = 1;

        // 동기화된 "가장 최근 O5 번호"를 추적 (5인 미만일 경우 가져다 쓰기 위함)
        let last_h_o5 = 0;
        let last_y_o5 = 0;

        // 2. 전체 측정기록을 시작일자순으로 순회하며 지정번호 배정
        for (let rec of groupRecords) {
            const workers = Number(rec.worker_cnt) || 0;
            const isO5 = workers >= 5;
            const isLocked = rec.is_fixed === 'y' || rec.report_date;

            // 만약 현재 기록이 고정(Lock)된 상태라면 번호를 소비하고 추적 변수만 갱신
            if (isLocked) {
                const cur_h_o5 = Number(rec.half_o5) || 0;
                const cur_y_o5 = Number(rec.year_o5) || 0;
                if (cur_h_o5 > last_h_o5) last_h_o5 = cur_h_o5;
                if (cur_y_o5 > last_y_o5) last_y_o5 = cur_y_o5;
                continue;
            }

            // 고정이 안 된 기록의 경우 번호를 순차적으로 배정
            while (usedHalfAll.has(h_all_ctr)) h_all_ctr++;
            while (usedYearAll.has(y_all_ctr)) y_all_ctr++;
            if (isO5) {
                while (usedHalfO5.has(h_o5_ctr)) h_o5_ctr++;
                while (usedYearO5.has(y_o5_ctr)) y_o5_ctr++;
            }

            let apply_h_o5, apply_y_o5;

            if (isO5) {
                // 5인 이상: 새 O5 카운터 소비 및 Last 업데이트
                apply_h_o5 = String(h_o5_ctr).padStart(3, '0');
                apply_y_o5 = String(y_o5_ctr).padStart(3, '0');
                last_h_o5 = h_o5_ctr;
                last_y_o5 = y_o5_ctr;
                h_o5_ctr++;
                y_o5_ctr++;
            } else {
                // 5인 미만: 5인 단위 번호는 소진하지 않고 가장 마지막 번호를 그대로 가져온다
                apply_h_o5 = String(last_h_o5).padStart(3, '0');
                apply_y_o5 = String(last_y_o5).padStart(3, '0');
            }

            const newVals = {
                half_all: String(h_all_ctr).padStart(3, '0'),
                year_all: String(y_all_ctr).padStart(3, '0'),
                half_o5: apply_h_o5,
                year_o5: apply_y_o5
            };

            h_all_ctr++;
            y_all_ctr++;

            if (rec.half_all !== newVals.half_all || rec.year_all !== newVals.year_all || rec.half_o5 !== newVals.half_o5 || rec.year_o5 !== newVals.year_o5) {
                updates.push({ ...newVals, target_id: rec.id });
            }
        }

        console.log(`[Recalc] Updates to be sent: ${updates.length}`);
        // 3. Batch Update
        if (updates.length > 0) {
            for (let u of updates) {
                const { target_id, ...payload } = u;
                console.log(`[Recalc] Updating ID ${target_id}:`, payload);
                const { error: updErr } = await supabase.from('kiwe_records').update(payload).eq('id', target_id);
                if (updErr) console.error(`[Recalc] Update failed for ID ${target_id}:`, updErr);
            }
            console.log(`[Recalc] Successfully processed ${updates.length} updates.`);
        } else {
            console.log('[Recalc] No changes needed for any records in this group.');
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            let recordToSave = { ...formData };
            if (recordToSave.com_name) {
                recordToSave.com_name = recordToSave.com_name.replace(/\(주\)/g, '㈜').trim();
            }
            if (!recordToSave.com_id) { alert('사업장을 선택해주세요.'); setLoading(false); return; }
            if (!recordToSave.start_date || !recordToSave.end_date) { alert('측정 시작일과 종료일을 입력해주세요.'); setLoading(false); return; }

            // New: Check for incomplete analysis
            if (editingId) {
                const status = analysisStatuses[editingId];
                if (status && status.total > 0 && status.completed < status.total) {
                    if (!confirm(`분석 미완료 시료가 존재합니다 (${status.completed}/${status.total} 완료).\n진행하시겠습니까?`)) {
                        setLoading(false);
                        return;
                    }
                }
            }

            // Force recalculate next dates to ensure consistency in DB
            // (Even if user didn't change end_date, we want to save the correct next date)
            if (recordToSave.noise_cycle && recordToSave.noise_cycle !== '없음') {
                recordToSave.next_noise_date = calculateNextDate(recordToSave.end_date, recordToSave.noise_cycle);
            }
            if (recordToSave.noise_excl_cycle && recordToSave.noise_excl_cycle !== '없음') {
                recordToSave.next_excl_date = calculateNextDate(recordToSave.end_date, recordToSave.noise_excl_cycle);
            }

            // Clean up numbers before saving if they are empty
            // Actually, we don't need to generate serials here MANUALLY if we rely on recalculation, 
            // BUT for the very first save of a new record (which is floating), we can just save it with dummy or 000, 
            // then run recalculate to assign it properly along with others.
            // OR we can keep the 'generateSerialNumbers' for initial display/UX, and then recalculate corrects it.
            // Let's rely on recalculation for correctness.

            delete recordToSave.id;

            // Sanitize date fields: convert empty strings to null for DB compatibility
            const dateFields = [
                'start_date', 'end_date', 'survey_date', 'report_date', 'shipping_date',
                'subsidy_date', 'billing_date', 'deposit_date', 'next_noise_date',
                'next_excl_date', 'document_date'
            ];
            dateFields.forEach(field => {
                if (recordToSave[field] === '') {
                    recordToSave[field] = null;
                }
            });

            let error;
            let savedId = editingId;

            if (editingId) {
                const res = await supabase.from('kiwe_records').update(recordToSave).eq('id', editingId);
                error = res.error;
            } else {
                // For new insert, we might not have serial headers. 
                // We'll insert, then the recalculate will pick it up (since it's floating).
                const res = await supabase.from('kiwe_records').insert([recordToSave]).select();
                error = res.error;
                if (res.data && res.data[0]) savedId = res.data[0].id;
            }

            if (error) throw error;

            // Trigger Recalculation for the group
            await recalculateSequences(recordToSave.office_name, recordToSave.target_year, recordToSave.half_year);

            alert(editingId ? '기록이 수정되었습니다.' : '기록이 저장되었습니다.');
            setIsModalOpen(false); fetchData();
        } catch (err) {
            console.error('Error saving record:', err);
            alert('저장에 실패했습니다. 원인: ' + (err.message || '알 수 없는 오류'));
        } finally { setLoading(false); }
    };

    const toggleFix = async (rec) => {
        const newVal = rec.is_fixed === 'y' ? 'n' : 'y';
        // If unlocking, and report_date exists, maybe warn? User said "is_fixed 'y' OR report_date". 
        // If report_date exists, it's effectively locked regardless of is_fixed. 
        // But we'll allow toggling the flag.

        const { error } = await supabase.from('kiwe_records').update({ is_fixed: newVal }).eq('id', rec.id);
        if (error) {
            alert('변경 실패');
        } else {
            // If we just UNLOCKED it, maybe we should trigger recalc? 
            // The user didn't explicitly ask for recalc on toggle, but it makes sense. 
            // However, to be safe, let's just refresh data. Recalc happens on SAVE.
            fetchData();
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('정말로 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('kiwe_records').delete().eq('id', id);
            if (error) throw error;
            alert('삭제되었습니다.'); fetchData();
        }
        catch (err) {
            console.error('Error deleting record:', err);
            alert('삭제 실패: ' + (err.message || '알 수 없는 오류'));
        }
    };

    const openEdit = (rec) => {
        setFormData(rec);
        const company = companies.find(c => c.com_id === rec.com_id);
        setSelectedCompany(company || null);
        setEditingId(rec.id);
        setIsModalOpen(true);
    };

    const downloadBackup = () => {
        const data = JSON.stringify(records, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'kiwe_records_backup_' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
    };

    const filteredRecords = records.filter(rec => {
        const normalizeForSearch = (str) => (str || '').replace(/\(주\)|㈜|\s/g, '').toLowerCase();
        const normTerm = normalizeForSearch(searchTerm);

        const normName = normalizeForSearch(rec.com_name);
        const normId = normalizeForSearch(rec.com_id);
        const normInspector = normalizeForSearch(rec.inspector);

        const matchesSearch = normName.includes(normTerm) || normId.includes(normTerm) || normInspector.includes(normTerm);
        const matchesYear = yearFilter === '전체' || rec.target_year == yearFilter;
        const matchesHalf = halfYearFilter === '전체' || rec.half_year === halfYearFilter;

        let matchesOffice = false;
        if (officeFilter === '전체') {
            matchesOffice = true;
        } else if (officeFilter === '기타') {
            // [기타] 선택 시 '측정'이 아닌 모든 건을 출력 (기타용역)
            matchesOffice = rec.work_type !== '측정';
        } else {
            // [경기, 평택, 서울서부, 안산] 선택 시
            // 1. 업무구분이 '측정'이어야 함
            // 2. 선택된 필터 지청의 영문코드와 데이터의 영문코드가 일치해야 함
            const filterCode = getOfficeCode(officeFilter);
            matchesOffice = rec.work_type === '측정' && getOfficeCode(rec.office_name) === filterCode;
        }

        return matchesSearch && matchesYear && matchesHalf && matchesOffice;
    });

    const sortedRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            // 1. Compare Measurement End Date (Priority 1)
            const dateA = a.end_date || '';
            const dateB = b.end_date || '';
            if (dateA !== dateB) {
                if (sortOrder === 'desc') return dateB.localeCompare(dateA);
                return dateA.localeCompare(dateB);
            }

            // 2. Compare half_all (Designation Number) (Priority 2)
            const serialA = parseInt(a.half_all) || 0;
            const serialB = parseInt(b.half_all) || 0;
            if (serialA !== serialB) {
                return sortOrder === 'desc' ? serialB - serialA : serialA - serialB;
            }

            // 3. Compare id for stable sort if everything else is equal
            return b.id - a.id;
        });
    }, [filteredRecords, sortOrder]);

    const officeFilterOptions = ['안산', '경기', '평택', '서울서부', '기타'];

    const stats = useMemo(() => {
        const unreported = filteredRecords.filter(r => r.end_date && !r.report_date).length;

        let serialInfo = { h_all: 0, h_o5: 0, y_all: 0, y_o5: 0, label: '조건을 선택하세요' };
        if (officeFilter !== '전체') {
            const targetYear = yearFilter === '전체' ? new Date().getFullYear() : yearFilter;

            const relevantRecords = records.filter(r => {
                if (officeFilter === '기타') return r.work_type !== '측정' && r.target_year == targetYear;
                const filterCode = getOfficeCode(officeFilter);
                return r.work_type === '측정' && getOfficeCode(r.office_name) === filterCode && r.target_year == targetYear;
            });

            if (relevantRecords.length > 0) {
                serialInfo.h_all = Math.max(...relevantRecords.map(r => Number(r.half_all) || 0));
                serialInfo.h_o5 = Math.max(...relevantRecords.map(r => Number(r.half_o5) || 0));
                serialInfo.y_all = Math.max(...relevantRecords.map(r => Number(r.year_all) || 0));
                serialInfo.y_o5 = Math.max(...relevantRecords.map(r => Number(r.year_o5) || 0));

                let groupLabel = officeFilter;
                if (officeFilter === '안산') groupLabel = '안산/기타지청 통합';
                if (officeFilter === '기타') groupLabel = '기타용역';
                serialInfo.label = groupLabel + " (" + targetYear + "년) 마지막 번호";
            } else {
                serialInfo.label = officeFilter + " (" + targetYear + "년) - 기록 없음";
            }
        } else {
            serialInfo.label = "관할지청을 선택하면 표시됩니다";
        }

        return { totalCount: filteredRecords.length, unreported, serialInfo };
    }, [filteredRecords, records, officeFilter, yearFilter]);


    if (!user) return null;

    return e('div', { className: "flex flex-col min-h-screen" },
        e('header', { className: "bg-white h-16 border-b flex items-center justify-between px-6 sticky top-0 z-40 bg-white/90 backdrop-blur-md" },
            e('div', { className: "flex items-center gap-4" },
                e('a', { href: "main.html", className: "p-2 hover:bg-slate-100 rounded-lg text-slate-500" }, e(Home, { size: 20 })),
                e('div', { className: "h-6 w-px bg-slate-200" }),
                e('h1', { className: "text-lg font-bold flex items-center gap-2" }, 
                    e(ClipboardList, { size: 20, className: "text-indigo-600" }), 
                    " 측정기록 카드",
                    e('a', { href: 'manual.html#section-records', target: '_blank', className: 'ml-2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors', title: '측정기록 관리 도움말 (새창)' },
                        e(HelpCircle, { size: 18 })
                    )
                ),
                e('div', { className: "h-6 w-px bg-slate-200 mx-1" }),
                e('a', { href: "companies.html", className: "flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors" },
                    e(ArrowLeft, { size: 14 }),
                    "사업장관리"
                )
            ),

            e('div', { className: "flex items-center gap-3" },
                e('div', { className: "flex bg-slate-100 p-1 rounded-xl mr-4" },
                    e('button', {
                        onClick: () => setActiveTab('records'),
                        className: `px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'records' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
                    }, e(ClipboardList, { size: 16 }), "측정기록"),
                    isAdmin && e('button', {
                        onClick: () => setActiveTab('unpaid'),
                        className: `px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'unpaid' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
                    }, e(CreditCard, { size: 16 }), "미수금 현황")
                ),
                e('button', { onClick: downloadBackup, className: "px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2" }, e(DownloadIcon, { size: 18 }), " [백업다운] "),
                e('button', { onClick: () => { setEditingId(null); setFormData({ ...INITIAL_RECORD, inspector: user.user_name }); setSelectedCompany(null); setIsModalOpen(true); }, className: "bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-md shadow-indigo-100" }, e(Plus, { size: 18 }), " 측정기록 입력 ")
            )
        ),
        e('main', { className: "flex-1 p-6" },
            activeTab === 'unpaid' ?
                e(UnpaidManagementTab, { records, companies }) :
                e(React.Fragment, null,
                    e('div', { className: "grid gap-6 mb-6 grid-cols-1 md:grid-cols-3" },
                        e('div', { className: "bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5" },
                            e('div', { className: "bg-indigo-50 p-3 rounded-xl text-indigo-600" }, e(ClipboardList, { size: 24 })),
                            e('div', { className: "truncate" }, e('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "조회된 기록"), e('p', { className: "text-2xl font-extrabold text-slate-800" }, stats.totalCount.toLocaleString(), "건"))
                        ),
                        e('div', {
                            onClick: () => setIsUnreportedModalOpen(true),
                            className: "bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all"
                        },
                            e('div', { className: "bg-amber-50 p-3 rounded-xl text-amber-600" }, e(AlertCircle, { size: 24 })),
                            e('div', { className: "truncate" }, e('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "전산 미보고"), e('p', { className: "text-2xl font-extrabold text-red-600" }, (stats.unreported || 0).toLocaleString(), "건"))
                        ),
                        e('div', { className: "bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center gap-2" },
                            e('p', { className: "text-sm font-bold text-slate-400 uppercase flex items-center gap-2" }, e('div', { className: "w-2 h-2 rounded-full bg-emerald-500" }), stats.serialInfo.label),
                            e('div', { className: "grid grid-cols-2 gap-4" },
                                e('div', { className: "flex justify-between items-center border-b border-slate-50 pb-1" },
                                    e('span', { className: "text-xs font-bold text-slate-400" }, "반기(전체/5인)"),
                                    e('span', { className: "text-base font-mono font-bold text-indigo-600" }, String(stats.serialInfo.h_all).padStart(3, '0') + " / " + String(stats.serialInfo.h_o5).padStart(3, '0'))
                                ),
                                e('div', { className: "flex justify-between items-center border-b border-slate-50 pb-1" },
                                    e('span', { className: "text-xs font-bold text-slate-400" }, "연간(전체/5인)"),
                                    e('span', { className: "text-base font-mono font-bold text-indigo-600" }, String(stats.serialInfo.y_all).padStart(3, '0') + " / " + String(stats.serialInfo.y_o5).padStart(3, '0'))
                                )
                            )
                        )
                    ),
                    e('div', { className: "bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-center gap-4" },
                        e('select', { value: yearFilter, onChange: (ev) => setYearFilter(ev.target.value), className: "px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" },
                            e('option', { value: "전체" }, "전체 연도"),
                            [2024, 2025, 2026, 2027].map(y => e('option', { key: y, value: y }, y + "년"))
                        ),
                        e('select', { value: halfYearFilter, onChange: (ev) => setHalfYearFilter(ev.target.value), className: "px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" }, e('option', { value: "전체" }, "전체 반기"), e('option', { value: "상반기" }, "상반기"), e('option', { value: "하반기" }, "하반기"), e('option', { value: "연간" }, "연간")),
                        e('select', { value: officeFilter, onChange: (ev) => setOfficeFilter(ev.target.value), className: "px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none font-bold text-indigo-600" },
                            e('option', { value: "전체" }, "관할지청 선택(필수)"),
                            officeFilterOptions.map(o => e('option', { key: o, value: o }, o))
                        ),
                        e('div', { className: "relative w-64" }, e(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400", size: 18 }), e('input', { type: "text", placeholder: "사업장명, 측정자 검색...", value: searchTerm, onChange: (ev) => setSearchTerm(ev.target.value), className: "w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" })),
                        e('button', {
                            onClick: () => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'),
                            className: "flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
                        },
                            e(ListFilter, { size: 16 }),
                            sortOrder === 'desc' ? "최신순" : "과거순"
                        ),
                        e('div', { className: "flex-1" }),
                        e('button', {
                            disabled: selectedIds.length === 0,
                            onClick: () => {
                                const selectedRecs = records
                                    .filter(rec => selectedIds.includes(rec.id))
                                    .map(rec => {
                                        const company = companies.find(c => c.com_id === rec.com_id);
                                        return {
                                            ...rec,
                                            address: company?.address,
                                            block_address: company?.block_address,
                                            post_code: company?.post_code,
                                            manager_name: company?.manager_name
                                        };
                                    });
                                handleLabelPrintDisplay(selectedRecs);
                            },
                            className: `px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${selectedIds.length > 0 ? 'bg-rose-500 text-white shadow-lg shadow-rose-100 hover:bg-rose-600' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`
                        }, e(Printer, { size: 16 }), `선택한 ${selectedIds.length}개 라벨 인쇄`)
                    ),
                    e('div', { className: "bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto" },
                        e('table', { className: "w-full text-left border-collapse min-w-[1000px]" },
                            e('thead', { className: "bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold" },
                                e('tr', null,
                                    e('th', { className: "px-4 py-4 w-12" },
                                        e('input', {
                                            type: "checkbox",
                                            className: "w-4 h-4 rounded accent-rose-500",
                                            checked: selectedIds.length > 0 && selectedIds.length === sortedRecords.length,
                                            onChange: (ev) => {
                                                if (ev.target.checked) setSelectedIds(sortedRecords.map(r => r.id));
                                                else setSelectedIds([]);
                                            }
                                        })
                                    ),
                                    e('th', { className: "px-4 py-4" }, "ID"), e('th', { className: "px-4 py-4" }, "지청"), e('th', { className: "px-4 py-4" }, "측정기간"), e('th', { className: "px-4 py-4 max-w-[200px] truncate text-ellipsis overflow-hidden" }, "사업장명"), e('th', { className: "px-4 py-4" }, "고정"), e('th', { className: "px-4 py-4" }, "지정번호(반기/연간)"), e('th', { className: "px-4 py-4 text-right" }, "청구액"), e('th', { className: "px-4 py-4" }, "상태"), e('th', { className: "px-4 py-4 text-right" }, "관리")
                                )
                            ),
                            e('tbody', { className: "divide-y divide-slate-100 text-[13px]" },
                                loading ? e('tr', null, e('td', { colSpan: "10", className: "px-6 py-12 text-center text-slate-400" }, "데이터 로딩 중...")) : sortedRecords.length === 0 ? e('tr', null, e('td', { colSpan: "10", className: "px-6 py-12 text-center text-slate-400" }, "조회된 기록이 없습니다.")) : sortedRecords.map((rec) => {
                                    const serialH = (rec.half_all || '-') + "/" + (rec.half_o5 || '-'); const serialY = (rec.year_all || '-') + "/" + (rec.year_o5 || '-');
                                    const isLocked = rec.is_fixed === 'y' || rec.report_date;
                                    const isSelected = selectedIds.includes(rec.id);
                                    const analysisStatus = analysisStatuses[rec.id];
                                    return e('tr', { key: rec.id, className: `hover:bg-indigo-50/30 transition-colors group cursor-pointer ${isSelected ? 'bg-rose-50/50' : ''}`, onDoubleClick: () => openEdit(rec) },
                                        e('td', { className: "px-4 py-4" },
                                            e('input', {
                                                type: "checkbox",
                                                className: "w-4 h-4 rounded accent-rose-500",
                                                checked: isSelected,
                                                onChange: (ev) => {
                                                    ev.stopPropagation();
                                                    if (ev.target.checked) setSelectedIds(prev => [...prev, rec.id]);
                                                    else setSelectedIds(prev => prev.filter(id => id !== rec.id));
                                                }
                                            })
                                        ),
                                        e('td', { className: "px-4 py-4 font-mono text-slate-400" }, rec.id),
                                        e('td', { className: "px-4 py-4 font-bold text-slate-600" }, rec.office_name),
                                        e('td', { className: "px-4 py-4 text-slate-500 font-mono" }, rec.start_date + " / " + rec.end_date),
                                        e('td', { className: "px-4 py-4 font-black text-slate-800 text-sm" },
                                            e('div', { className: "flex flex-col" },
                                                e('span', null, rec.com_name),
                                                e('span', { className: "text-[10px] text-slate-300 font-bold" }, rec.com_id)
                                            )
                                        ),
                                        e('td', { className: "px-4 py-4" },
                                            e('button', {
                                                onClick: (ev) => { ev.stopPropagation(); toggleFix(rec); },
                                                className: `p-1.5 rounded-lg transition-all ${isLocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`
                                            }, isLocked ? e(Lock, { size: 14 }) : e(Unlock, { size: 14 }))
                                        ),
                                        e('td', { className: "px-4 py-4" },
                                            e('div', { className: "flex flex-col gap-1" },
                                                e('span', { className: "text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full w-fit font-bold" }, "H: " + serialH),
                                                e('span', { className: "text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-full w-fit font-bold" }, "Y: " + serialY)
                                            )
                                        ),
                                        e('td', { className: "px-4 py-4 text-right font-bold text-slate-700 font-mono" }, (Number(rec.billing_amt) || 0).toLocaleString()),
                                        e('td', { className: "px-4 py-4" },
                                            e('div', { className: "flex flex-col gap-1" },
                                                analysisStatus && e(AnalysisStatusBadge, {
                                                    total: analysisStatus.total,
                                                    completed: analysisStatus.completed,
                                                    onClick: () => {
                                                        setSelectedStatusRecord(rec);
                                                        setIsIncompleteModalOpen(true);
                                                    }
                                                }),
                                                rec.report_date && e('span', { className: "px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded w-fit" }, "보고완료"),
                                                rec.deposit_date && e('span', { className: "px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded w-fit" }, "사업장 완")
                                            )
                                        ),
                                        e('td', { className: "px-4 py-4 text-right" },
                                            e('div', { className: "flex justify-end gap-2" },
                                                e('button', {
                                                    onClick: (ev) => {
                                                        ev.stopPropagation();
                                                        const company = companies.find(c => c.com_id === rec.com_id);
                                                        // Prepare full record for report cover
                                                        const fullRec = {
                                                            ...rec,
                                                            address: company?.address || '',
                                                            tel: company?.tel || '',
                                                            fax: company?.fax || '',
                                                            manager_name: company?.manager_name || ''
                                                        };
                                                        openReportCover(fullRec);
                                                    },
                                                    className: "px-2 py-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                                                }, "표지출력"),
                                                e('button', { onClick: (ev) => { ev.stopPropagation(); openEdit(rec); }, className: "p-2 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" }, e(Edit3, { size: 18 })),
                                                e('button', { onClick: (ev) => { ev.stopPropagation(); handleDelete(rec.id); }, className: "p-2 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-lg transition-colors" }, e(Trash2, { size: 18 }))
                                            )
                                        )
                                    );
                                })
                            )
                        )
                    )
                ),
            e(RecordModal, {
                isOpen: isModalOpen,
                onClose: () => setIsModalOpen(false),
                onSave: handleSubmit,
                editingId: editingId,
                formData: formData,
                setFormData: setFormData,
                companies: companies,
                users: users,
                selectedCompany: selectedCompany,
                handleCompanySelect: handleCompanySelect,
                handleRecordChange: handleRecordChange,
                loading: loading,
                analysisStatus: analysisStatuses[editingId],
                onShowIncomplete: () => {
                    setSelectedStatusRecord(records.find(r => r.id === editingId));
                    setIsIncompleteModalOpen(true);
                }
            }),
            e(UnreportedModal, {
                isOpen: isUnreportedModalOpen,
                onClose: () => setIsUnreportedModalOpen(false),
                unreportedRecords: filteredRecords.filter(r => r.end_date && !r.report_date)
            }),
            e(IncompleteSamplesModal, {
                isOpen: isIncompleteModalOpen,
                onClose: () => setIsIncompleteModalOpen(false),
                record: selectedStatusRecord || {},
                samples: (selectedStatusRecord && analysisStatuses[selectedStatusRecord.id]?.samples) || []
            }))
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(RecordsManagement));

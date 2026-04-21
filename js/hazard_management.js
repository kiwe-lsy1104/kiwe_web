/* eslint-disable react/prop-types */
import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { Search, X, Plus, Copy } from 'https://esm.sh/lucide-react@0.263.1';
import { supabase } from './config.js';

const e = React.createElement;

const initialFormState = {
    hazard_id: '', common_name: '', hazard_category: '', cas_no: '', chem_formula: '', 
    synonyms: '', legal_name: '', analyte: '', cat_no: '', is_permissible: '', 
    is_cmr_material: '', twa_ppm: '', twa_mg: '', stel_ppm: '', stel_mg: '', 
    mol_weight: '', purity: '', flash: '', melting: '', boiling: '', sg: '', 
    analysis_method: '', sampling_media: '', flow_rate: '', sampling: '', 
    max_volume: '', min_volume: '', storage: '', instrument_name: '', 
    desorption_solvent: '', column_info: '', kosha_method: '', niosh_method: '', 
    osha_method: '', is_self: '', remarks: ''
};

export default function HazardManagement() {
    const [hazards, setHazards] = useState([]);
    const [filteredHazards, setFilteredHazards] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState(initialFormState);
    const [isEdit, setIsEdit] = useState(false);

    useEffect(() => { fetchHazards(); }, []);

    useEffect(() => {
        const handleEsc = (ev) => {
            if (ev.key === 'Escape') setIsModalOpen(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    useEffect(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) {
            setFilteredHazards(hazards);
        } else {
            const filtered = hazards.filter(h =>
                (h.common_name || '').toLowerCase().includes(term) ||
                (h.cas_no || '').toLowerCase().includes(term)
            );
            setFilteredHazards(filtered);
        }
    }, [searchTerm, hazards]);

    const fetchHazards = async () => {
        try {
            const { data, error } = await supabase
                .from('kiwe_hazard')
                .select('*')
                .order('hazard_id');
            if (error) throw error;
            setHazards(data || []);
            setFilteredHazards(data || []);
        } catch (err) {
            console.error('Fetch error:', err);
            alert('데이터를 가져오는데 실패했습니다: ' + err.message);
        }
    };

    const generateNextId = async () => {
        try {
            const { data } = await supabase
                .from('kiwe_hazard')
                .select('hazard_id')
                .order('hazard_id', { ascending: false })
                .limit(1);
            
            let nextNum = 1;
            if (data && data.length > 0) {
                const lastId = data[0].hazard_id;
                if (lastId && lastId.startsWith('HZ-')) {
                    const numPart = parseInt(lastId.split('-')[1]);
                    if (!isNaN(numPart)) nextNum = numPart + 1;
                }
            }
            return `HZ-${String(nextNum).padStart(4, '0')}`;
        } catch (err) {
            console.error('ID Gen Error:', err);
            return 'HZ-temp-' + Date.now();
        }
    };

    const openNew = async () => {
        const nextId = await generateNextId();
        setFormData({ ...initialFormState, hazard_id: nextId });
        setIsEdit(false);
        setIsModalOpen(true);
    };

    const openEdit = (hazard) => {
        const mapped = {};
        Object.keys(initialFormState).forEach(k => {
            mapped[k] = hazard[k] ?? '';
        });
        setFormData(mapped);
        setIsEdit(true);
        setIsModalOpen(true);
    };

    const handleDuplicate = async () => {
        const nextId = await generateNextId();
        setFormData(prev => ({
            ...prev,
            hazard_id: nextId,
            common_name: (prev.common_name || '') + ' (복제본)',
        }));
        setIsEdit(false);
        alert('현재 정보가 복제되어 새로운 ID(' + nextId + ')가 부여되었습니다.\n내용을 수정한 뒤 [저장하기]를 눌러주세요.');
    };

    const closeModal = () => setIsModalOpen(false);

    const handleSave = async (ev) => {
        ev.preventDefault();
        try {
            if (!formData.common_name) return alert('유해인자명(common_name)은 필수항목입니다.');
            
            const sanitizedData = { ...formData };
            // All-field empty-to-null conversion for DB integrity
            Object.keys(sanitizedData).forEach(key => {
                if (sanitizedData[key] === '' || (typeof sanitizedData[key] === 'string' && sanitizedData[key].trim() === '')) {
                    sanitizedData[key] = null;
                }
            });

            if (!isEdit) {
                // INSERT
                const { error } = await supabase.from('kiwe_hazard').insert([sanitizedData]);
                if (error) throw error;
                alert('새로운 유해인자가 추가되었습니다.');
            } else {
                // UPDATE
                const id = sanitizedData.hazard_id;
                delete sanitizedData.hazard_id;
                const { error } = await supabase.from('kiwe_hazard').update(sanitizedData).eq('hazard_id', id);
                if (error) throw error;
                alert('수정되었습니다.');
            }
            closeModal();
            fetchHazards();
        } catch (err) {
            console.error('Save error:', err);
            alert('저장 오류: ' + err.message);
        }
    };

    const handleDelete = async () => {
        if (!formData.hazard_id) {
            alert('새로 추가 중인 데이터는 삭제할 수 없습니다.');
            return;
        }
        if (confirm('데이터를 영구 삭제하시겠습니까?')) {
            try {
                const { error } = await supabase
                    .from('kiwe_hazard')
                    .delete()
                    .eq('hazard_id', formData.hazard_id);
                if (error) throw error;
                alert('삭제되었습니다.');
                closeModal();
                fetchHazards();
            } catch (err) {
                console.error('Delete error:', err);
                alert('삭제 오류: ' + err.message);
            }
        }
    };

    const handleRowDelete = async (hazard, ev) => {
        ev.stopPropagation();
        if (confirm(`"${hazard.common_name}" 데이터를 영구 삭제하시겠습니까?`)) {
            try {
                const { error } = await supabase
                    .from('kiwe_hazard')
                    .delete()
                    .eq('hazard_id', hazard.hazard_id);
                if (error) throw error;
                alert('삭제되었습니다.');
                fetchHazards();
            } catch (err) {
                console.error('Delete error:', err);
                alert('삭제 오류: ' + err.message);
            }
        }
    };

    const InputField = (label, fieldKey, type="text", rows=1) => {
        if (rows > 1) {
            return e('div', { className: "space-y-2" },
                e('label', { className: "text-[11px] font-bold text-slate-500" }, label),
                e('textarea', { 
                    value: formData[fieldKey], 
                    onChange: (ev) => setFormData({ ...formData, [fieldKey]: ev.target.value }), 
                    className: "w-full p-2.5 border rounded-lg outline-none focus:border-purple-500 bg-slate-50 focus:bg-white text-xs font-medium transition-colors string-area", 
                    rows: rows 
                })
            );
        }
        return e('div', { className: "space-y-2" },
            e('label', { className: "text-[11px] font-bold text-slate-500" }, label),
            e('input', { 
                type: type,
                value: formData[fieldKey], 
                onChange: (ev) => setFormData({ ...formData, [fieldKey]: ev.target.value }), 
                className: "w-full p-2.5 border rounded-lg outline-none focus:border-purple-500 bg-slate-50 focus:bg-white text-xs font-bold transition-colors" 
            })
        );
    };

    return e('div', { className: "max-w-7xl mx-auto space-y-6" },
        // Search bar & Add Button
        e('div', { className: "card-custom p-6" },
            e('div', { className: "flex items-center gap-4" },
                e('div', { className: "relative flex-1" },
                    e(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400", size: 20 }),
                    e('input', {
                        type: "text",
                        placeholder: "물질명 또는 CAS No 검색...",
                        className: "input-standard pl-10",
                        value: searchTerm,
                        onChange: (ev) => setSearchTerm(ev.target.value)
                    })
                ),
                e('div', { className: "text-sm font-bold text-slate-500" }, `총 ${filteredHazards.length}건`),
                e('button', { 
                    onClick: openNew,
                    className: "btn-primary ring-2 ring-purple-100 flex items-center gap-2 px-5 py-2.5" 
                }, 
                    e(Plus, { size: 18 }), "새 유해인자 추가"
                )
            )
        ),

        // Main content table
        e('div', { className: "card-custom overflow-hidden" },
            e('div', { className: "overflow-x-auto" },
                e('table', { className: "w-full text-left table-fixed" },
                    e('thead', { className: "bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]" },
                        e('tr', null,
                            e('th', { className: "px-2 py-3 w-36" }, "인자명(국문)"),
                            e('th', { className: "px-2 py-3 w-32" }, "법적명칭"),
                            e('th', { className: "px-2 py-3 w-24" }, "CAS No"),
                            e('th', { className: "px-2 py-3 w-24" }, "채취매체"),
                            e('th', { className: "px-2 py-3 w-32" }, "노출기준"),
                            e('th', { className: "px-2 py-3 w-16 text-center" }, "유량"),
                            e('th', { className: "px-2 py-3 w-16 text-center" }, "Max"),
                            e('th', { className: "px-2 py-3 w-16 text-center" }, "Min"),
                            e('th', { className: "px-2 py-3 w-24 text-center" }, "탈착용매"),
                            e('th', { className: "px-2 py-3 w-20 text-right" }, "자체여부"),
                            e('th', { className: "px-2 py-3 w-32 text-right" }, "관리")
                        )
                    ),
                    e('tbody', { className: "divide-y divide-slate-100 text-sm" },
                        filteredHazards.length === 0 ?
                            e('tr', null,
                                e('td', { colSpan: "7", className: "px-3 py-8 text-center text-slate-400 font-medium" },
                                    "검색 결과가 없습니다."
                                )
                            ) :
                            filteredHazards.map((h, idx) => {
                                const limitTextParts = [];
                                if (h.twa_ppm) limitTextParts.push(`TWA ${h.twa_ppm}ppm`);
                                else if (h.twa_mg) limitTextParts.push(`TWA ${h.twa_mg}mg/m³`);
                                if (h.stel_ppm) limitTextParts.push(`STEL ${h.stel_ppm}ppm`);
                                else if (h.stel_mg) limitTextParts.push(`STEL ${h.stel_mg}mg/m³`);
                                const limitText = limitTextParts.join(', ');

                                return e('tr', {
                                    key: h.hazard_id || idx,
                                    className: "data-row hover:bg-purple-50/50 transition-colors cursor-pointer",
                                    onDoubleClick: () => openEdit(h),
                                    title: "더블클릭하여 수정"
                                },
                                    e('td', { className: "px-2 py-2 font-bold text-slate-800 text-[13px]" }, h.common_name || '-'),
                                    e('td', { className: "px-2 py-2 text-slate-600 text-[10px]" }, h.legal_name || '-'),
                                    e('td', { className: "px-2 py-2 font-mono text-slate-500 text-[10px]" }, h.cas_no || '-'),
                                    e('td', { className: "px-2 py-2 text-slate-600 text-[10px]" }, h.sampling_media || '-'),
                                    e('td', { className: "px-2 py-2 text-[10px] text-emerald-600 font-semibold" }, limitText || '-'),
                                    e('td', { className: "px-2 py-2 text-slate-700 text-center text-[10px]" }, h.flow_rate || '-'),
                                    e('td', { className: "px-2 py-2 text-slate-700 text-center font-bold text-[10px]" }, h.max_volume || '-'),
                                    e('td', { className: "px-2 py-2 text-slate-700 text-center text-[10px]" }, h.min_volume || '-'),
                                    e('td', { className: "px-2 py-2 text-indigo-500 text-center text-[10px]" }, h.desorption_solvent || '-'),
                                    e('td', { className: "px-2 py-2 text-right" },
                                        e('span', { className: `px-2 py-0.5 rounded-full text-[10px] font-black ${h.is_self === '자체분석' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}` },
                                            h.is_self === '자체분석' ? '자체분석' : '외부의뢰'
                                        )
                                    ),
                                    e('td', { className: "px-2 py-2 text-right" },
                                        e('div', { className: "flex gap-1 justify-end" },
                                            e('button', {
                                                onClick: (ev) => { ev.stopPropagation(); openEdit(h); },
                                                className: "px-2 py-1 bg-blue-50 text-blue-600 font-bold rounded hover:bg-blue-100 transition-colors text-[10px]",
                                            }, "수정"),
                                            e('button', {
                                                onClick: (ev) => handleRowDelete(h, ev),
                                                className: "px-2 py-1 bg-red-50 text-red-600 font-bold rounded hover:bg-red-100 transition-colors text-[10px]",
                                            }, "삭제")
                                        )
                                    )
                                );
                            })
                    )
                )
            )
        ),

        // Modal Form Expanded
        isModalOpen && e('div', { className: "fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-6", onClick: closeModal },
            e('div', { className: "bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col", onClick: (ev) => ev.stopPropagation() },
                e('div', { className: "p-6 border-b bg-slate-50 shrink-0 flex justify-between items-start" },
                    e('div', null,
                        e('h3', { className: "text-xl font-black text-slate-800 flex items-center gap-3" }, 
                            isEdit ? '유해인자 정보 수정' : '신규 유해인자 등록',
                            formData.hazard_id && e('span', {className: "text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-bold"}, `ID: ${formData.hazard_id}`)
                        ),
                        e('p', { className: "text-slate-500 mt-1 font-medium text-xs" }, "비어 있는 필드는 가급적 정확하게 기입해 주시기 바랍니다. 물질명(필수)을 확인하여 저장하세요.")
                    ),
                    e('button', { onClick: closeModal, className: "p-2 hover:bg-slate-200 rounded-full" }, e(X, { size: 24, className: "text-slate-500" }))
                ),
                e('form', { onSubmit: handleSave, className: "p-6 space-y-5 overflow-y-auto bg-slate-50/50" }, 
                    // Basics
                    e('div', {className: "bg-white p-4 rounded-xl shadow-sm border border-slate-100"},
                        e('h4', {className: "text-xs font-black text-slate-800 mb-3 uppercase tracking-wide"}, "기본 정보"),
                        e('div', { className: "grid grid-cols-4 gap-3" },
                            InputField("물질명(필수)", "common_name"),
                            InputField("CAS No", "cas_no"),
                            InputField("유해인자구분", "hazard_category"),
                            InputField("법적명칭", "legal_name")
                        ),
                        e('div', { className: "grid grid-cols-4 gap-3 mt-3" },
                            InputField("이명(Synonyms)", "synonyms"),
                            InputField("분자식", "chem_formula"),
                            InputField("허가대상물질", "is_permissible"),
                            InputField("특별관리물질", "is_cmr_material")
                        )
                    ),
                    // Exposure Limits
                    e('div', {className: "bg-white p-4 rounded-xl shadow-sm border border-slate-100"},
                        e('h4', {className: "text-xs font-black text-slate-800 mb-3 uppercase tracking-wide"}, "노출 기준 및 물리화학적 특성"),
                        e('div', { className: "grid grid-cols-4 gap-3" },
                            InputField("TWA (ppm)", "twa_ppm"),
                            InputField("TWA (mg/m³)", "twa_mg"),
                            InputField("STEL (ppm)", "stel_ppm"),
                            InputField("STEL (mg/m³)", "stel_mg")
                        ),
                        e('div', { className: "grid grid-cols-6 gap-3 mt-3" },
                            InputField("분자량", "mol_weight"),
                            InputField("순도", "purity"),
                            InputField("인화점", "flash"),
                            InputField("녹는점", "melting"),
                            InputField("끓는점", "boiling"),
                            InputField("비중", "sg")
                        )
                    ),
                    // Analysis & Sampling Method
                    e('div', {className: "bg-white p-4 rounded-xl shadow-sm border border-slate-100"},
                        e('h4', {className: "text-xs font-black text-slate-800 mb-3 uppercase tracking-wide"}, "채취 및 분석 정보"),
                        e('div', { className: "grid grid-cols-4 gap-3" },
                            InputField("Analyte", "analyte"),
                            InputField("Cat No", "cat_no"),
                            InputField("분석장비", "instrument_name"),
                            InputField("분석방법", "analysis_method")
                        ),
                        e('div', { className: "grid grid-cols-6 gap-3 mt-3" },
                            e('div', {className: "col-span-2"}, InputField("채취매체", "sampling_media")),
                            e('div', {className: "col-span-1"}, InputField("채취방법", "sampling")),
                            e('div', {className: "col-span-1"}, InputField("유량(Flow)", "flow_rate")),
                            e('div', {className: "col-span-1"}, InputField("Max Vol", "max_volume")),
                            e('div', {className: "col-span-1"}, InputField("Min Vol", "min_volume"))
                        ),
                        e('div', { className: "grid grid-cols-4 gap-3 mt-3" },
                            InputField("보관방법", "storage"),
                            InputField("탈착용매", "desorption_solvent"),
                            e('div', {className: "col-span-2"}, InputField("컬럼정보", "column_info"))
                        ),
                        e('div', { className: "grid grid-cols-4 gap-3 mt-3" },
                            InputField("KOSHA Method", "kosha_method"),
                            InputField("NIOSH Method", "niosh_method"),
                            InputField("OSHA Method", "osha_method"),
                            InputField("자체분석", "is_self")
                        )
                    ),
                    // Remarks
                    e('div', {className: "bg-white p-4 rounded-xl shadow-sm border border-slate-100"},
                        InputField("비고 / 상세메모", "remarks", "text", 2)
                    ),
                    
                    // Button Bar
                    e('div', { className: "pt-4 pb-2 flex gap-3 shrink-0" },
                        e('button', { type: "button", onClick: closeModal, className: "flex-1 py-3.5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors" }, "취소"),
                        isEdit ? e('button', { type: "button", onClick: handleDuplicate, className: "flex-1 py-3.5 bg-orange-100 text-orange-700 font-bold rounded-xl hover:bg-orange-200 transition-colors flex items-center justify-center gap-2" }, e(Copy, {size: 18}), "복제하여 새로 추가") : null,
                        isEdit ? e('button', { type: "button", onClick: handleDelete, className: "flex-1 py-3.5 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors" }, "삭제") : null,
                        e('button', { type: "submit", className: "flex-[2] py-3.5 bg-purple-600 text-white font-bold rounded-xl shadow-md cursor-pointer hover:bg-purple-700 hover:shadow-lg transition-all" }, "저장하기")
                    )
                )
            )
        )
    );
}

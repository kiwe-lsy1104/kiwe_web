
import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { supabase, checkAuth } from './config.js';
import {
    Calendar, Filter, Search, User, Briefcase, Plus, X,
    ChevronLeft, ChevronRight, Save, Clock, AlertCircle, CheckCircle2,
    CalendarClock, LayoutList, GripVertical, AlertTriangle, Building2, Download
} from 'https://esm.sh/lucide-react@0.263.1';

const e = React.createElement;

// ==========================================
// Utility Components
// ==========================================

const MultiUserSelect = ({ users, selected, onChange }) => {
    const [localUsers, setLocalUsers] = useState(users);
    const [isOpen, setIsOpen] = useState(false);

    const selectedNames = selected ? selected.split(',').map(s => s.trim()).filter(Boolean) : [];

    const toggleUser = (name) => {
        let newSelected;
        if (selectedNames.includes(name)) {
            newSelected = selectedNames.filter(n => n !== name);
        } else {
            newSelected = [...selectedNames, name];
        }
        onChange(newSelected.join(', '));
    };

    return e('div', { className: "relative space-y-2" },
        e('div', { className: "flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px] items-center" },
            selectedNames.map(name =>
                e('span', { key: name, className: "bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1" },
                    name,
                    e('button', { type: 'button', onClick: () => toggleUser(name), className: "hover:text-indigo-900" }, e(X, { size: 12 }))
                )
            ),
            e('button', { type: 'button', onClick: () => setIsOpen(!isOpen), className: "px-2 py-1 text-xs font-bold text-slate-400 border border-dashed border-slate-300 rounded hover:bg-white hover:text-indigo-600 transition" }, "+ 추가")
        ),
        isOpen && e('div', { className: "absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-2 grid grid-cols-2 gap-1 animate-fadeIn" },
            localUsers.map(u =>
                e('button', {
                    key: u.user_id,
                    type: 'button',
                    onClick: () => toggleUser(u.user_name),
                    className: `text-left px-3 py-2 rounded-lg text-xs font-bold ${selectedNames.includes(u.user_name) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`
                }, u.user_name)
            )
        ),
        isOpen && e('div', { className: "fixed inset-0 z-40", onClick: () => setIsOpen(false) })
    );
};

// ==========================================
// Company DB Modal Component
// ==========================================

const CompanyDBModal = ({ isOpen, onClose, comId, onSaved }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(null);

    useEffect(() => {
        if (isOpen && comId) {
            fetchCompanyDetails();
        }
    }, [isOpen, comId]);

    const fetchCompanyDetails = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('kiwe_companies')
                .select('*')
                .eq('com_id', comId)
                .single();
            if (error) throw error;
            setFormData(data);
        } catch (err) {
            console.error(err);
            alert('사업장 정보를 불러오는데 실패했습니다.');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (ev) => {
        ev.preventDefault();
        setSaving(true);
        try {
            const { id, created_at, ...updateData } = formData;
            const { error } = await supabase
                .from('kiwe_companies')
                .update(updateData)
                .eq('com_id', comId);
            if (error) throw error;
            alert('저장되었습니다.');
            onSaved();
            onClose();
        } catch (err) {
            alert('저장 실패: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !formData) return null;

    const set = (field) => (event) => setFormData({ ...formData, [field]: event.target.value });

    return e('div', { className: "fixed inset-0 z-[60] flex items-center justify-center p-4" },
        e('div', { className: "absolute inset-0 bg-slate-900/60 backdrop-blur-sm", onClick: onClose }),
        e('div', { className: "bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col z-10 overflow-hidden" },
            // Header
            e('div', { className: "p-4 border-b flex items-center justify-between bg-slate-50" },
                e('h2', { className: "text-lg font-bold flex items-center gap-2" },
                    e(Building2, { size: 20, className: "text-blue-600" }),
                    '사업장 정보 수정'
                ),
                e('div', { className: "flex items-center gap-4" },
                    // Status Toggle (identical to companies.html)
                    e('div', { className: "flex bg-slate-200 p-1 rounded-lg" },
                        e('button', {
                            type: 'button',
                            onClick: () => setFormData({ ...formData, manage_status: '정상' }),
                            className: `px-3 py-1.5 rounded-md text-xs font-bold transition-all ${formData.manage_status !== '관리중지' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
                        }, "정상"),
                        e('button', {
                            type: 'button',
                            onClick: () => setFormData({ ...formData, manage_status: '관리중지' }),
                            className: `px-3 py-1.5 rounded-md text-xs font-bold transition-all ${formData.manage_status === '관리중지' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
                        }, "관리중지")
                    ),
                    e('button', { onClick: onClose, className: "p-1.5 hover:bg-slate-200 rounded-lg text-slate-400" },
                        e(X, { size: 20 })
                    )
                )
            ),
            // Form Body
            e('form', { onSubmit: handleSave, className: "flex-1 overflow-y-auto p-5" },
                e('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3" },
                    // 관리중지 사유 (conditional)
                    formData.manage_status === '관리중지' && e('div', { className: "col-span-2 bg-red-50 border border-red-100 p-3 rounded-xl mb-2" },
                        e('label', { className: "text-xs font-bold text-red-500 ml-1 block mb-1" }, "관리 중지 사유 (필수)"),
                        e('input', {
                            required: true,
                            value: formData.manage_remark || '',
                            onChange: set('manage_remark'),
                            className: "w-full px-3 py-2 bg-white border border-red-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm",
                            placeholder: "예: 폐업, 거래 중단 등"
                        })
                    ),
                    // Section Header: 필수
                    e('div', { className: "col-span-2 text-xs font-bold text-blue-600 flex items-center gap-2 mb-1 uppercase tracking-widest" },
                        e('div', { className: "w-1.5 h-3 bg-blue-600 rounded-full" }),
                        "사업장 기본 정보 (필수)"
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "사업장 관리번호 *"),
                        e('input', { required: true, value: formData.com_reg_no || '', onChange: set('com_reg_no'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm", placeholder: "관리공단 등록 번호" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "사업장명 *"),
                        e('input', { required: true, value: formData.com_name || '', onChange: set('com_name'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "관할지청 * (경기, 평택, 서울서부, 안산 추천)"),
                        e('input', {
                            required: true,
                            list: "office-list-db",
                            value: formData.office_name || '',
                            onChange: set('office_name'),
                            className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm",
                            placeholder: "지청명 입력 또는 선택"
                        }),
                        e('datalist', { id: "office-list-db" },
                            e('option', { value: "안산" }),
                            e('option', { value: "경기" }),
                            e('option', { value: "평택" }),
                            e('option', { value: "서울서부" })
                        )
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "대표자명 *"),
                        e('input', { required: true, value: formData.ceo_name || '', onChange: set('ceo_name'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "담당자명 *"),
                        e('input', { required: true, value: formData.manager_name || '', onChange: set('manager_name'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "우편번호 *"),
                        e('input', { required: true, value: formData.post_code || '', onChange: set('post_code'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "col-span-2 space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "소재지 *"),
                        e('input', { required: true, value: formData.address || '', onChange: set('address'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    // Section Header: 선택
                    e('div', { className: "col-span-2 text-xs font-bold text-slate-400 flex items-center gap-2 mt-2 mb-1 uppercase tracking-widest" },
                        e('div', { className: "w-1.5 h-3 bg-slate-200 rounded-full" }),
                        "추가 파트너 정보 (선택)"
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "담당자 연락처"),
                        e('input', { value: formData.manager_contact || '', onChange: set('manager_contact'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "블럭 소재지"),
                        e('input', { value: formData.block_address || '', onChange: set('block_address'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "전화번호"),
                        e('input', { value: formData.tel || '', onChange: set('tel'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "팩스번호"),
                        e('input', { value: formData.fax || '', onChange: set('fax'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "업종"),
                        e('input', { value: formData.biz_type || '', onChange: set('biz_type'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "주생산품"),
                        e('input', { value: formData.main_product || '', onChange: set('main_product'), className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" })
                    ),
                    e('div', { className: "col-span-2 space-y-1" },
                        e('label', { className: "text-xs font-bold text-slate-400 ml-1" }, "비고"),
                        e('textarea', { value: formData.remarks || '', onChange: set('remarks'), rows: "2", className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl resize-none text-sm" })
                    )
                ),
                e('div', { className: "mt-6 flex gap-3 sticky bottom-0 bg-white pt-4 border-t border-slate-100" },
                    e('button', { type: "button", onClick: onClose, className: "flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm" }, "취소"),
                    e('button', { type: "submit", disabled: saving, className: "flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2" },
                        saving ? e('div', { className: "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" }) : null,
                        '정보 업데이트'
                    )
                )
            )
        )
    );
};

// ==========================================
// Main Application
// ==========================================


function PlanApp() {
    const [user, setUser] = useState(null);
    const [rawData, setRawData] = useState({ records: [], companies: [], schedules: [], users: [], equipments: [] });
    const [processedPlans, setProcessedPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const today = new Date();
    const [filterYear, setFilterYear] = useState(String(today.getFullYear()));
    const [filterHalf, setFilterHalf] = useState(today.getMonth() < 6 ? '상반기' : '하반기');
    const [filterMonth, setFilterMonth] = useState(String(today.getMonth() + 1));
    const [filterInspector, setFilterInspector] = useState('전체');
    const [filterStatus, setFilterStatus] = useState('전체'); // 전체, 예정, 확정, 완료, 지연

    const [visibleColumns, setVisibleColumns] = useState([
        'office_name', 'com_name', 'com_db', 'rep_inspector', 'rep_date', 'cycle_info'
    ]);

    const DB_SETTINGS_KEY = 'plan_column_config';

    const ALL_COLUMNS = [
        { id: 'office_name', label: '관할지청' },
        { id: 'com_name', label: '사업장명' },
        { id: 'com_db', label: '사업장 DB' },
        { id: 'worker_cnt', label: '근로자수' },
        { id: 'is_funded', label: '지원여부' },
        { id: 'rep_inspector', label: '대표측정자' },
        { id: 'rep_date', label: '대표예정일' },
        { id: 'next_noise_date', label: '소음차기일' },
        { id: 'next_excl_date', label: '소음제외차기일' },
        { id: 'cycle_info', label: '주기정보' }
    ];

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [modalData, setModalData] = useState({
        id: null,
        sche_date: '',
        com_name: '',
        inspector: '',
        activity_type: '정기측정',
        equipment_used: {}
    });

    useEffect(() => {
        const session = checkAuth();
        if (session) {
            setUser(session);
            fetchData();
            loadSettings();
        }
    }, []);

    const loadSettings = async () => {
        try {
            const { data, error } = await supabase.from('kiwe_app_settings').select('value').eq('key', DB_SETTINGS_KEY).single();
            if (data && data.value) {
                setVisibleColumns(data.value);
            }
        } catch (err) { console.warn('Settings load failed'); }
    };

    const saveSettings = async (cols) => {
        try {
            await supabase.from('kiwe_app_settings').upsert({
                key: DB_SETTINGS_KEY,
                value: cols,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (err) { console.error('Settings save failed'); }
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [processedPlans, isModalOpen, visibleColumns, filterStatus]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resRecords, resCompanies, resSchedules, resUsers, resEquip] = await Promise.all([
                supabase.from('kiwe_records').select('*').order('end_date', { ascending: false }),
                supabase.from('kiwe_companies').select('com_id, com_name, manage_status'),
                supabase.from('kiwe_schedule').select('*').gte('sche_date', new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString()), // Fetch last 1 year+
                supabase.from('kiwe_users').select('user_name, user_id').order('user_name'),
                supabase.from('kiwe_equipments').select('*').order('eq_name')
            ]);

            if (resRecords.error) throw resRecords.error;
            if (resCompanies.error) throw resCompanies.error;

            setRawData({
                records: resRecords.data || [],
                companies: resCompanies.data || [],
                schedules: resSchedules.data || [],
                users: resUsers.data || [],
                equipments: resEquip.data || []
            });

        } catch (err) {
            console.error(err);
            alert('데이터 로딩 실패');
        } finally {
            setLoading(false);
        }
    };

    // Process Data whenever Raw Data changes
    useEffect(() => {
        if (!rawData.records.length) return;
        processPlans();
    }, [rawData]);

    const processPlans = () => {
        const { records, companies, schedules } = rawData;
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Identification of Active Companies
        // Key: com_id (or com_name fallback), Value: manage_status
        const companyStatusMap = {};
        const activeCompanyNames = new Set();
        companies.forEach(c => {
            companyStatusMap[c.com_id] = c.manage_status;
            if (c.manage_status !== '관리중지') {
                activeCompanyNames.add(c.com_name.replace(/\(주\)|㈜|\s/g, ''));
            }
        });

        // 3. Process Records to generate "Plans"
        // We iterate records. Each record generates a "Plan" for the NEXT cycle.
        const plans = records.map(rec => {
            // Filter Suspended Companies
            let isSuspended = false;
            // Only strictly exclude if found as '관리중지'. If not found, assume Normal (Legacy)
            if (rec.com_id && companyStatusMap[rec.com_id]) {
                if (companyStatusMap[rec.com_id] === '관리중지') isSuspended = true;
            } else {
                // Fallback to name match
                const normName = rec.com_name.replace(/\(주\)|㈜|\s/g, '');
                const comp = companies.find(c => c.com_name.replace(/\(주\)|㈜|\s/g, '') === normName);
                if (comp && comp.manage_status === '관리중지') isSuspended = true;
            }

            if (isSuspended) return null;

            // Calculate Dates
            const dates = [];
            if (rec.next_noise_date) dates.push(rec.next_noise_date);
            if (rec.next_excl_date) dates.push(rec.next_excl_date);
            dates.sort();

            let repDate = null;
            const futureDates = dates.filter(d => d >= todayStr);
            if (futureDates.length > 0) repDate = futureDates[0];
            else if (dates.length > 0) repDate = dates[0]; // All past

            if (!repDate) return null; // No plan

            // Determine Status
            let status = '예정'; // Default
            let statusColor = 'bg-slate-100 text-slate-500'; // Gray
            let isComplete = false;
            let isConfirmed = false;

            const repD = new Date(repDate);

            // Check "Complete": Is there a NEWER record for this company with end_date close to repDate?
            const completionRecord = records.find(r => {
                if (r.id === rec.id) return false; // Self
                const normalize = (n) => n.replace(/\(주\)|㈜|\s/g, '');
                if (normalize(r.com_name) !== normalize(rec.com_name)) return false;

                // We use end_date to guess.
                const rEnd = new Date(r.end_date);
                if (Math.abs(rEnd - repD) < 1000 * 60 * 60 * 24 * 60) return true; // Within 60 days
                return false;
            });

            if (completionRecord) {
                status = '완료';
                statusColor = 'bg-emerald-100 text-emerald-600';
                isComplete = true;
            } else {
                // Check "Confirmed": Is there a Schedule?
                const confirmedSchedule = schedules.find(s => {
                    const normalize = (n) => n.replace(/\(주\)|㈜|\s/g, '');
                    if (normalize(s.com_name) !== normalize(rec.com_name)) return false;

                    const sDate = new Date(s.sche_date);
                    // Match if schedule is within +/- 45 days
                    if (Math.abs(sDate - repD) < 1000 * 60 * 60 * 24 * 45) return true;
                    return false;
                });

                if (confirmedSchedule) {
                    status = '확정';
                    statusColor = 'bg-blue-100 text-blue-600';
                    isConfirmed = true;
                } else {
                    // Overdue vs Scheduled
                    if (repDate < todayStr) {
                        status = '지연';
                        statusColor = 'bg-red-100 text-red-600';
                    } else if ((new Date(repDate) - new Date(todayStr)) / (1000 * 60 * 60 * 24) <= 7) {
                        status = '임박';
                        statusColor = 'bg-amber-100 text-amber-600';
                    } else {
                        status = '예정';
                        statusColor = 'bg-slate-100 text-slate-500';
                    }
                }
            }

            // Representative Inspector (First name only)
            const repInspector = (rec.inspector || '').split(',')[0].trim();

            return {
                ...rec, // Base record (Previous cycle)
                rep_date: repDate,
                rep_inspector: repInspector,
                plan_status: status,
                status_color: statusColor,
                is_complete: isComplete,
                is_confirmed: isConfirmed
            };

        }).filter(Boolean); // Remove nulls (suspended/no date)

        // Deduplication to pick LATEST plan only
        const uniquePlans = [];
        const seenCom = new Set();
        // Sort by rep_date desc first to pick latest
        plans.sort((a, b) => new Date(b.rep_date) - new Date(a.rep_date));

        for (const p of plans) {
            if (!seenCom.has(p.com_name)) {
                seenCom.add(p.com_name);
                uniquePlans.push(p);
            }
        }

        setProcessedPlans(uniquePlans);
    };

    const toggleColumn = (id) => {
        let nextRows;
        if (visibleColumns.includes(id)) {
            nextRows = visibleColumns.filter(c => c !== id);
        } else {
            const newSet = new Set([...visibleColumns, id]);
            nextRows = ALL_COLUMNS.filter(c => newSet.has(c.id)).map(c => c.id);
        }
        setVisibleColumns(nextRows);
        saveSettings(nextRows);
    };

    // Filter Logic
    const filteredRecords = useMemo(() => {
        return processedPlans.filter(rec => {
            const d = new Date(rec.rep_date);
            const y = String(d.getFullYear());
            const m = String(d.getMonth() + 1);

            if (filterYear !== '전체' && y !== filterYear) return false;

            if (filterHalf !== '전체') {
                const isFirstHalf = d.getMonth() < 6;
                if (filterHalf === '상반기' && !isFirstHalf) return false;
                if (filterHalf === '하반기' && isFirstHalf) return false;
            }

            if (filterMonth !== '전체' && m !== filterMonth) return false;

            if (filterInspector !== '전체' && rec.rep_inspector !== filterInspector) return false;

            if (filterStatus !== '전체') {
                // Mapping complex statuses to filter categories
                // '예정' includes '임박'
                if (filterStatus === '예정' && (rec.plan_status === '예정' || rec.plan_status === '임박')) return true;
                if (rec.plan_status !== filterStatus && filterStatus !== '예정') return false;
            }

            return true;
        }).sort((a, b) => new Date(a.rep_date) - new Date(b.rep_date));
    }, [processedPlans, filterYear, filterHalf, filterMonth, filterInspector, filterStatus]);

    // Modal Logic
    const openScheduleModal = (rec) => {
        setModalData({
            id: null,
            sche_date: rec.rep_date || new Date().toISOString().split('T')[0],
            com_name: rec.com_name,
            inspector: rec.rep_inspector,
            activity_type: '정기측정',
            equipment_used: {}
        });
        setIsModalOpen(true);
    };

    const openCompanyModal = (comId) => {
        setSelectedCompanyId(comId);
        setIsCompanyModalOpen(true);
    };

    const saveSchedule = async (ev) => {
        ev.preventDefault();
        try {
            const payload = { ...modalData };
            if (!payload.sche_date || !payload.com_name) return alert('날짜와 사업장명은 필수입니다.');

            delete payload.id;

            const { error } = await supabase.from('kiwe_schedule').insert([payload]);
            if (error) throw error;

            alert('일정이 등록되었습니다.');
            setIsModalOpen(false);
            fetchData(); // Refresh to update status to "Confirm"

        } catch (err) {
            alert('저장 실패: ' + err.message);
        }
    };

    const downloadExcel = () => {
        if (filteredRecords.length === 0) return alert('다운로드할 데이터가 없습니다.');

        const excelData = filteredRecords.map((rec, idx) => {
            const row = { 'No': idx + 1 };
            
            // 상태 컬럼은 항상 포함 시도
            row['상태'] = rec.plan_status;

            // 체크된 컬럼만 엑셀에 포함
            visibleColumns.forEach(cid => {
                const colDef = ALL_COLUMNS.find(c => c.id === cid);
                if (!colDef) return;

                if (cid === 'cycle_info') {
                    row['주기정보(소음)'] = rec.noise_cycle && rec.noise_cycle !== '없음' ? `${rec.noise_cycle}개월` : '-';
                    row['주기정보(제외)'] = rec.noise_excl_cycle && rec.noise_excl_cycle !== '없음' ? `${rec.noise_excl_cycle}개월` : '-';
                } else if (cid === 'com_db') {
                    row['사업장 ID'] = rec.com_id;
                } else {
                    row[colDef.label] = (rec[cid] !== undefined && rec[cid] !== null) ? rec[cid] : '-';
                }
            });

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "측정계획");

        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        XLSX.writeFile(wb, `측정계획관리_${dateStr}.xlsx`);
    };

    return e('div', { className: "min-h-screen bg-slate-50 flex flex-col font-sans" },
        // Header
        e('header', { className: "bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-30" },
            e('div', { className: "flex items-center gap-3" },
                e('a', { href: "main.html", className: "p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" },
                    e(ChevronLeft, { size: 24 })
                ),
                e('h1', { className: "text-xl font-black text-slate-800 flex items-center gap-2" },
                    e(CalendarClock, { className: "text-indigo-600" }),
                    "측정 계획 관리"
                ),
                e('div', { className: "w-px h-6 bg-slate-200 mx-1" }),
                e('a', { href: "schedule.html", className: "flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors" },
                    e(Calendar, { size: 14 }),
                    "일정및장비관리"
                ),
                e('a', { href: "records.html", className: "flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors" },
                    e(LayoutList, { size: 14 }),
                    "측정기록관리"
                ),
                e('button', {
                    onClick: downloadExcel,
                    className: "flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors ml-2"
                },
                    e(Download, { size: 14 }),
                    "엑셀 다운로드"
                )
            ),
            e('div', { className: "flex items-center gap-4 text-sm font-bold text-slate-500" },
                // Status Legend (Optional, but nice)
                e('div', { className: "flex items-center gap-1.5" }, e('div', { className: "w-2.5 h-2.5 rounded-full bg-emerald-500" }), "완료"),
                e('div', { className: "flex items-center gap-1.5" }, e('div', { className: "w-2.5 h-2.5 rounded-full bg-blue-500" }), "확정"),
                e('div', { className: "flex items-center gap-1.5" }, e('div', { className: "w-2.5 h-2.5 rounded-full bg-slate-400" }), "예정"),
                e('div', { className: "flex items-center gap-1.5" }, e('div', { className: "w-2.5 h-2.5 rounded-full bg-red-500" }), "지연")
            )
        ),

        // Controls
        e('div', { className: "bg-white border-b border-slate-200 px-6 py-4 sticky top-16 z-20 shadow-sm space-y-4" },
            // Filters
            e('div', { className: "flex flex-wrap gap-3 items-center" },
                e('div', { className: "flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200" },
                    e(Filter, { size: 16, className: "text-slate-400 ml-2" }),
                    e('select', { value: filterYear, onChange: e => setFilterYear(e.target.value), className: "bg-transparent font-bold text-slate-700 outline-none text-sm p-1" },
                        ['전체', '2024', '2025', '2026', '2027'].map(y => e('option', { key: y, value: y }, y + '년'))
                    ),
                    e('div', { className: "w-px h-4 bg-slate-300" }),
                    e('select', { value: filterHalf, onChange: e => setFilterHalf(e.target.value), className: "bg-transparent font-bold text-slate-700 outline-none text-sm p-1" },
                        ['전체', '상반기', '하반기'].map(h => e('option', { key: h, value: h }, h))
                    ),
                    e('div', { className: "w-px h-4 bg-slate-300" }),
                    e('select', { value: filterMonth, onChange: e => setFilterMonth(e.target.value), className: "bg-transparent font-bold text-slate-700 outline-none text-sm p-1" },
                        ['전체', ...Array.from({ length: 12 }, (_, i) => String(i + 1))].map(m =>
                            e('option', { key: m, value: m }, m === '전체' ? '전체 월' : `${m}월`)
                        )
                    )
                ),
                e('div', { className: "flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200" },
                    e(AlertCircle, { size: 16, className: "text-slate-400 ml-1" }),
                    e('select', { value: filterStatus, onChange: e => setFilterStatus(e.target.value), className: "bg-transparent font-bold text-slate-700 outline-none text-sm p-1 min-w-[80px]" },
                        ['전체', '예정', '확정', '완료', '지연'].map(s => e('option', { key: s, value: s }, s))
                    )
                ),
                e('div', { className: "flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200" },
                    e(User, { size: 16, className: "text-slate-400 ml-1" }),
                    e('select', { value: filterInspector, onChange: e => setFilterInspector(e.target.value), className: "bg-transparent font-bold text-slate-700 outline-none text-sm p-1 min-w-[100px]" },
                        e('option', { value: "전체" }, "전체 측정자"),
                        rawData.users.map(u => e('option', { key: u.user_id, value: u.user_name }, u.user_name))
                    )
                ),
                e('div', { className: "ml-auto text-xs font-bold text-slate-400" },
                    `검색 결과: ${filteredRecords.length}건`
                )
            ),
            // Column Selector
            e('div', { className: "flex flex-wrap gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-100" },
                e('span', { className: "text-xs font-black text-slate-500 mr-2 flex items-center gap-1" },
                    e(LayoutList, { className: 'w-3 h-3' }), "조회 항목 선택:"
                ),
                ALL_COLUMNS.map(col =>
                    e('label', { key: col.id, className: "flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded border border-slate-200 hover:border-indigo-300 transition-colors select-none" },
                        e('input', {
                            type: "checkbox",
                            checked: visibleColumns.includes(col.id),
                            onChange: () => toggleColumn(col.id),
                            className: "accent-indigo-600 w-3 h-3"
                        }),
                        e('span', { className: "text-xs font-bold text-slate-600" }, col.label)
                    )
                )
            )
        ),

        // Table
        e('div', { className: "flex-1 overflow-auto bg-white" },
            e('table', { className: "w-full text-left border-collapse" },
                e('thead', { className: "bg-slate-50 sticky top-0 z-10 shadow-sm" },
                    e('tr', null,
                        e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200 w-16 text-center" }, "No"),
                        visibleColumns.includes('office_name') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200" }, "관할지청"),
                        visibleColumns.includes('com_name') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200" }, "사업장명"),
                        visibleColumns.includes('com_db') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200 text-center" }, "DB"),
                        visibleColumns.includes('worker_cnt') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200 text-center" }, "근로자수"),
                        visibleColumns.includes('is_funded') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200 text-center" }, "지원여부"),
                        visibleColumns.includes('rep_inspector') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200" }, "대표측정자"),
                        visibleColumns.includes('cycle_info') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200" }, "주기 정보"),
                        visibleColumns.includes('rep_date') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200" }, "대표예정일"),
                        visibleColumns.includes('next_noise_date') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200" }, "소음차기일"),
                        visibleColumns.includes('next_excl_date') && e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200" }, "소음제외차기일"),
                        e('th', { className: "p-3 text-xs font-black text-slate-500 border-b border-slate-200 text-center w-24" }, "관리")
                    )
                ),
                e('tbody', { className: "divide-y divide-slate-100" },
                    loading ? e('tr', null, e('td', { colSpan: "9", className: "p-10 text-center text-slate-400 font-bold" }, "데이터 로딩 중...")) :
                        filteredRecords.length === 0 ? e('tr', null, e('td', { colSpan: "9", className: "p-10 text-center text-slate-400 font-bold" }, "검색 결과가 없습니다.")) :
                            filteredRecords.map((rec, idx) => {
                                return e('tr', { key: rec.id, className: "hover:bg-slate-50 transition-colors group" },
                                    e('td', { className: "p-3 text-xs font-bold text-slate-400 text-center" }, idx + 1),

                                    visibleColumns.includes('office_name') && e('td', { className: "p-3 text-xs font-bold text-slate-600" }, rec.office_name),

                                    visibleColumns.includes('com_name') && e('td', { className: "p-3 text-sm font-black text-slate-800" },
                                        e('div', { className: "flex items-center gap-2" },
                                            rec.com_name,
                                            e('span', { className: `px-1.5 py-0.5 rounded text-[10px] font-bold ${rec.status_color}` }, rec.plan_status)
                                        )
                                    ),

                                    visibleColumns.includes('com_db') && e('td', { className: "p-3 text-center" },
                                        e('button', {
                                            onClick: () => openCompanyModal(rec.com_id),
                                            className: "px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                        }, "DB")
                                    ),

                                    visibleColumns.includes('worker_cnt') && e('td', { className: "p-3 text-xs font-bold text-slate-600 text-center" }, rec.worker_cnt || '0'),

                                    visibleColumns.includes('is_funded') && e('td', { className: "p-3 text-center" },
                                        e('span', { className: `px-2 py-0.5 rounded text-[10px] font-bold ${rec.is_funded === '대상' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}` }, rec.is_funded || '비대상')
                                    ),

                                    visibleColumns.includes('rep_inspector') && e('td', { className: "p-3 text-xs font-bold text-slate-600" }, rec.rep_inspector || '-'),

                                    visibleColumns.includes('cycle_info') && e('td', { className: "p-3" },
                                        e('div', { className: "flex flex-col gap-1 items-start" },
                                            rec.noise_cycle && rec.noise_cycle !== '없음' && e('span', { className: "px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100" },
                                                `소음 ${rec.noise_cycle}개월`
                                            ),
                                            rec.noise_excl_cycle && rec.noise_excl_cycle !== '없음' && e('span', { className: "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100" },
                                                `제외 ${rec.noise_excl_cycle}개월`
                                            )
                                        )
                                    ),

                                    visibleColumns.includes('rep_date') && e('td', { className: "p-3 text-sm font-black text-indigo-600" }, rec.rep_date),

                                    visibleColumns.includes('next_noise_date') && e('td', { className: "p-3 text-xs font-mono text-slate-500" }, rec.next_noise_date || '-'),

                                    visibleColumns.includes('next_excl_date') && e('td', { className: "p-3 text-xs font-mono text-slate-500" }, rec.next_excl_date || '-'),

                                    // Action Column
                                    e('td', { className: "p-3 text-center" },
                                        !rec.is_complete && !rec.is_confirmed ? e('button', {
                                            onClick: () => openScheduleModal(rec),
                                            className: "px-3 py-1.5 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-xs font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm whitespace-nowrap"
                                        }, "일정등록") :
                                            rec.is_confirmed ? e('span', { className: "text-[10px] font-bold text-blue-500" }, "일정확정됨") :
                                                e('span', { className: "text-[10px] font-bold text-emerald-500" }, "측정완료")
                                    )
                                );
                            })
                )
            )
        ),

        // Modal
        isModalOpen && e('div', { className: "fixed inset-0 z-50 flex items-center justify-center p-6" },
            e('div', { className: "absolute inset-0 bg-slate-900/60 backdrop-blur-sm", onClick: () => setIsModalOpen(false) }),
            e('div', { className: "bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl z-10 p-10 animate-fadeIn border border-slate-200" },
                e('div', { className: "flex items-center justify-between mb-8" },
                    e('h2', { className: "text-2xl font-black text-slate-800 flex items-center gap-2" },
                        e(Calendar, { className: "text-indigo-600" }),
                        "일정 등록"
                    ),
                    e('button', { onClick: () => setIsModalOpen(false), className: "p-2 hover:bg-slate-100 rounded-xl text-slate-400" },
                        e(X, { className: "w-6 h-6" })
                    )
                ),
                e('form', { onSubmit: saveSchedule, className: "grid grid-cols-2 gap-8" },
                    // Left Column: Basic Info
                    e('div', { className: "space-y-6" },
                        e('div', { className: "grid grid-cols-2 gap-4" },
                            e('div', { className: "space-y-1" },
                                e('label', { className: "text-xs font-black text-slate-400 ml-1" }, "날짜"),
                                e('input', { required: true, type: "date", value: modalData.sche_date, onChange: ev => setModalData({ ...modalData, sche_date: ev.target.value }), className: "w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500" })
                            ),
                            e('div', { className: "space-y-1" },
                                e('label', { className: "text-xs font-black text-slate-400 ml-1" }, "업무 구분"),
                                e('select', { value: modalData.activity_type, onChange: ev => setModalData({ ...modalData, activity_type: ev.target.value }), className: "w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500" },
                                    e('option', { value: "정기측정" }, "정기측정"),
                                    e('option', { value: "예비조사" }, "예비조사"),
                                    e('option', { value: "보고서" }, "보고서"),
                                    e('option', { value: "재측정" }, "재측정"),
                                    e('option', { value: "회사행사" }, "회사행사"),
                                    e('option', { value: "공휴일" }, "공휴일"),
                                    e('option', { value: "기타" }, "기타")
                                )
                            )
                        ),
                        e('div', { className: "space-y-1" },
                            e('label', { className: "text-xs font-black text-slate-400 ml-1" }, "사업장명 / 업무내용"),
                            e('input', { required: true, value: modalData.com_name, onChange: ev => setModalData({ ...modalData, com_name: ev.target.value }), className: "w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500" })
                        ),
                        e('div', { className: "space-y-1" },
                            e('label', { className: "text-xs font-black text-slate-400 ml-1" }, "측정자 (다중 선택 가능)"),
                            e(MultiUserSelect, {
                                users: rawData.users,
                                selected: modalData.inspector,
                                onChange: (newVal) => setModalData({ ...modalData, inspector: newVal })
                            })
                        ),
                        e('button', { type: "submit", className: "w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition transform hover:scale-[1.02] flex items-center justify-center gap-2 mt-8" },
                            e(Save, { className: "w-5 h-5" }),
                            "일정 확정 및 저장"
                        )
                    ),
                    // Right Column: Equipment (same style as schedule.html)
                    e('div', { className: `bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col h-full ${modalData.activity_type === '공휴일' ? 'opacity-50 pointer-events-none grayscale' : ''}` },
                        e('label', { className: "block text-xs font-black text-indigo-600 mb-4 flex items-center gap-2 shrink-0" },
                            e(Briefcase, { className: "w-4 h-4" }),
                            "장비 수량 입력",
                            modalData.activity_type === '공휴일' && e('span', { className: "text-red-500 ml-auto" }, "* 공휴일은 입력 불가")
                        ),
                        e('div', { className: "grid grid-cols-2 gap-3 overflow-y-auto pr-2 scrollbar-hide flex-1 content-start" },
                            (() => {
                                // Calculate usage for the modal's selected date (others' usage)
                                const getUsageForModalDate = () => {
                                    if (!modalData.sche_date) return {};
                                    const dailyEvents = rawData.schedules.filter(ev => ev.sche_date === modalData.sche_date);
                                    const usageMap = {};
                                    dailyEvents.forEach(evt => {
                                        if (evt.id === modalData.id) return; // Exclude self if editing
                                        const usage = typeof evt.equipment_used === 'string' ? JSON.parse(evt.equipment_used) : (evt.equipment_used || {});
                                        Object.entries(usage).forEach(([eid, count]) => {
                                            usageMap[eid] = (usageMap[eid] || 0) + Number(count);
                                        });
                                    });
                                    return usageMap;
                                };
                                const modalUsageMap = getUsageForModalDate();

                                // Group equipment by type (same as schedule.html)
                                const grouped = {};
                                const individualCards = [];
                                rawData.equipments.forEach(eq => {
                                    const type = eq.equipment_type || '기타';
                                    if (type === '유량보정기' || type === '소음보정기') return;
                                    if (type === '기타') {
                                        individualCards.push({ id: eq.id, eq_name: eq.eq_name, equipment_type: type, limit_count: eq.limit_count, isGroup: false });
                                    } else {
                                        if (!grouped[type]) {
                                            grouped[type] = { id: type, eq_name: type, equipment_type: type, limit_count: 0, isGroup: true, equipmentIds: [] };
                                        }
                                        grouped[type].limit_count += eq.limit_count;
                                        grouped[type].equipmentIds.push(eq.id);
                                    }
                                });

                                const typeOrder = ['고유량', '소음기', '길에어', '7L', '저유량'];
                                const allModalCards = [];
                                typeOrder.forEach(type => {
                                    if (grouped[type]) {
                                        const displayCard = { ...grouped[type] };
                                        if (type === '고유량') displayCard.eq_name = '고유량 (에어빌+카인에어)';
                                        allModalCards.push(displayCard);
                                    }
                                });
                                individualCards.forEach(card => allModalCards.push(card));

                                return allModalCards.map(card => {
                                    const limit = Number(card.limit_count) || 0;
                                    const othersUsage = card.isGroup
                                        ? card.equipmentIds.reduce((sum, eid) => sum + (modalUsageMap[eid] || 0), 0)
                                        : (modalUsageMap[card.id] || 0);
                                    const available = Math.max(0, limit - othersUsage);
                                    const myUsage = card.isGroup
                                        ? card.equipmentIds.reduce((sum, eid) => sum + (Number(modalData.equipment_used[eid]) || 0), 0)
                                        : (Number(modalData.equipment_used[card.id]) || 0);

                                    return e('div', { key: card.isGroup ? `group-${card.id}` : card.id, className: "bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 transition-colors" },
                                        // Header
                                        e('div', { className: "flex justify-between items-center mb-2" },
                                            e('span', { className: "text-sm font-black text-slate-700" }, card.eq_name),
                                            available <= 0 && e('span', { className: "text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full" }, "품절")
                                        ),
                                        // Metrics Grid
                                        e('div', { className: "grid grid-cols-3 gap-1" },
                                            e('div', { className: "flex flex-col items-center justify-center p-1.5 bg-slate-50 rounded-lg border border-slate-100" },
                                                e('span', { className: "text-[10px] font-bold text-slate-400" }, "보유"),
                                                e('span', { className: "text-xs font-black text-slate-600" }, limit)
                                            ),
                                            e('div', { className: "flex flex-col items-center justify-center p-1.5 bg-slate-50 rounded-lg border border-slate-100" },
                                                e('span', { className: "text-[10px] font-bold text-slate-400" }, "잔여"),
                                                e('span', { className: `text-xs font-black ${available === 0 ? 'text-red-500' : 'text-emerald-500'}` }, available)
                                            ),
                                            e('div', { className: "relative" },
                                                e('input', {
                                                    type: "number",
                                                    min: "0",
                                                    max: available,
                                                    value: myUsage === 0 ? '' : myUsage,
                                                    placeholder: "0",
                                                    onChange: ev => {
                                                        const val = Math.max(0, parseInt(ev.target.value) || 0);
                                                        const newUsage = { ...modalData.equipment_used };
                                                        if (card.isGroup) {
                                                            card.equipmentIds.forEach(eid => delete newUsage[eid]);
                                                            if (val > 0) newUsage[card.equipmentIds[0]] = val;
                                                        } else {
                                                            if (val === 0) delete newUsage[card.id];
                                                            else newUsage[card.id] = val;
                                                        }
                                                        setModalData({ ...modalData, equipment_used: newUsage });
                                                    },
                                                    className: "w-full h-full text-center font-black text-indigo-600 bg-indigo-50 border-2 border-indigo-100 rounded-lg outline-none focus:border-indigo-500 focus:bg-white transition-colors p-0 text-sm"
                                                }),
                                                e('span', { className: "absolute top-0.5 right-1 pointer-events-none text-[8px] font-bold text-indigo-300" }, "신청")
                                            )
                                        )
                                    );
                                });
                            })()
                        )
                    )
                )
            )
        ),

        // Company DB Modal
        e(CompanyDBModal, {
            isOpen: isCompanyModalOpen,
            onClose: () => setIsCompanyModalOpen(false),
            comId: selectedCompanyId,
            onSaved: fetchData
        })
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(PlanApp));

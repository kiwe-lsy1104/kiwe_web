// m_schedule.js - Mobile Exclusive Logic
import * as VehicleAPI from './vehicle.js';

const SUPABASE_URL = 'https://jztrnwchgxymknjvsbkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z8oriOCik8fZlnAMgznUMg_IhmmFQ33';

let _supabase = null;
function getSupabase() {
    if (_supabase) return _supabase;
    if (window.supabase) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return _supabase;
    }
    return null;
}

// Global State
let selectedCompany = null;

// ==========================================
// Utility Functions
// ==========================================

// Address Cleaner for Navigation
function getCleanAddress(fullAddress) {
    if (!fullAddress) return '';
    // Remove typical detail address patterns (floor, room, parenthesized details)
    // Example: "123 Main St, 3rd Floor (Bldg A)" -> "123 Main St"
    // Heuristic: Split by commas, take first part, or remove parenthesized content.
    // Korean specific: often "Road Name Address (Dong Name) Detail"
    // We want "Road Name Address"

    // 1. Remove (...) content
    let clean = fullAddress.replace(/\(.*\)/g, '').trim();
    // 2. Remove detailed parts often separated by commas or widely known detailed markers
    // Simplest approach: Use the address as is but stripped of parens which often contain extra info
    // Adjust if needed based on user feedback.

    // Creating a more aggressive cleaner for "detailed address" if it has specific keywords like "floor", "ho", "cheung"
    // For now, removing parens is the safest first step for map APIs.
    return clean;
}

// Navigation Launcher
window.launchNavi = function (type, address) {
    const cleanAddress = getCleanAddress(address);
    const encodedAddress = encodeURIComponent(cleanAddress);

    let url = '';

    switch (type) {
        case 'tmap':
            // Tmap URL Scheme
            // Tmap uses 'rgo' for route guidance, usually requires lat/long but name search is supported via web or app specific schemes.
            // Documentation varies, but 'tmap://search?name=...' is common.
            url = `tmap://search?name=${encodedAddress}`;
            // Fallback to TMap web? TMap doesn't have a direct simple web URL for search universally linkable like others, 
            // but we can try the store link if it fails (handled by OS usually).
            break;

        case 'kakao':
            // KakaoNavi
            // kakaonavi://search?q=...
            url = `kakaonavi://search?q=${encodedAddress}`;
            break;

        case 'naver':
            // Naver Map
            // nmap://search?query=...
            url = `nmap://search?query=${encodedAddress}&appname=kiwe_mobile`;
            break;
    }

    // Try to open the app
    window.location.href = url;

    // Note: Fallback to web browser or store for mobile requires more complex logic (checking if app opened).
    // Simple alert for now if it doesn't do anything (browser handles unknown scheme).
    setTimeout(() => {
        // Only if we suspect it failed (hard to detect in simple JS without page visibility API tricks)
        // We will add a "Web Search" button in the UI as a manual fallback.
    }, 1500);
}

// ==========================================
// Tab 1: Business Search Logic
// ==========================================

window.searchBusiness = async function () {
    const term = document.getElementById('searchInput').value.trim();
    if (!term) {
        alert('검색어를 입력해주세요.');
        return;
    }

    const sb = getSupabase();
    if (!sb) { alert('DB 연결 중.. 잠시 후 다시 시도해 주세요.'); return; }

    const { data: companies, error } = await sb
        .from('kiwe_companies')
        .select('*')
        .ilike('com_name', `%${term}%`);

    if (error) {
        console.error('Search Error:', error);
        alert('검색 중 오류가 발생했습니다.');
        return;
    }

    const resultList = document.getElementById('searchResultList');
    resultList.innerHTML = ''; // Clear previous

    if (!companies || companies.length === 0) {
        resultList.innerHTML = '<div class="text-center text-slate-400 py-10">검색 결과가 없습니다.</div>';
        return;
    }

    companies.forEach(comp => {
        const item = document.createElement('div');
        item.className = 'bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 mb-3';

        // Address Handling
        const address = comp.address || '주소 미입력';
        const contact = comp.manager_contact || comp.tel || '';
        const manager = comp.manager_name || '담당자 미정';

        item.innerHTML = `
            <div class="flex justify-between items-start">
                <h3 class="text-lg font-bold text-slate-800">${comp.com_name}</h3>
                <span class="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-bold">${comp.office_name || '지청'}</span>
            </div>
            
            <div class="flex items-center gap-2 mt-1">
                <i data-lucide="map-pin" class="w-4 h-4 text-slate-400"></i>
                <button onclick="openNavModal('${address.replace(/'/g, "\\'")}')" class="text-left text-sm text-slate-600 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-600">
                    ${address}
                </button>
            </div>
            
            <div class="flex items-center gap-2">
                <i data-lucide="user" class="w-4 h-4 text-slate-400"></i>
                <span class="text-sm text-slate-700 font-medium">${manager}</span>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-2">
                ${comp.tel || comp.com_phone ? `
                <a href="tel:${comp.tel || comp.com_phone}" class="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-700 rounded-xl font-bold border border-slate-100 active:scale-95 transition-transform text-xs">
                    <i data-lucide="phone" class="w-3 h-3 text-indigo-500"></i>
                    사업장 통화
                </a>
                ` : `
                <div class="flex items-center justify-center py-3 bg-slate-50 text-slate-300 rounded-xl font-bold border border-slate-100 text-xs">
                    사업장 번호 없음
                </div>
                `}

                ${comp.manager_contact ? `
                <a href="tel:${comp.manager_contact}" class="flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold border border-indigo-100 active:scale-95 transition-transform text-xs">
                    <i data-lucide="user" class="w-3 h-3 text-indigo-500"></i>
                    담당자 통화
                </a>
                ` : `
                <div class="flex items-center justify-center py-3 bg-slate-50 text-slate-300 rounded-xl font-bold border border-slate-100 text-xs">
                    담당자 번호 없음
                </div>
                `}
            </div>
        `;
        resultList.appendChild(item);
    });

    if (window.lucide) window.lucide.createIcons();
};

window.openNavModal = function (address) {
    if (!address || address === '주소 미입력' || address.trim() === '') {
        alert('등록된 주소가 없습니다.');
        return;
    }

    const modal = document.getElementById('navModal');
    const addressDisplay = document.getElementById('navAddressDisplay');
    const tmapBtn = document.getElementById('btnTmap');
    const kakaoBtn = document.getElementById('btnKakao');
    const naverBtn = document.getElementById('btnNaver');

    addressDisplay.textContent = address;

    tmapBtn.onclick = () => window.launchNavi('tmap', address);
    kakaoBtn.onclick = () => window.launchNavi('kakao', address);
    naverBtn.onclick = () => window.launchNavi('naver', address);

    modal.classList.remove('hidden');
    // Animate up
    modal.querySelector('.bottom-sheet').classList.remove('translate-y-full');
};

window.closeNavModal = function () {
    const modal = document.getElementById('navModal');
    modal.querySelector('.bottom-sheet').classList.add('translate-y-full');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
};

// ==========================================
// Tab 2: Schedule Logic (React Calendar)
// ==========================================
window.initScheduleTab = function () {
    if (window.scheduleAppMounted) return;
    window.scheduleAppMounted = true;

    const { useState, useEffect, useMemo, useCallback } = React;
    const e = React.createElement;

    // Use global getSupabase() defined at the top of m_schedule.js

    function MobileScheduleUI() {
        const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
        const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
        const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
        
        const [equipments, setEquipments] = useState([]);
        const [schedules, setSchedules] = useState([]);
        const [companies, setCompanies] = useState([]);
        
        const [showInput, setShowInput] = useState(false);
        const [schedComSearch, setSchedComSearch] = useState('');
        const [companyResults, setCompanyResults] = useState([]);
        const [activityType, setActivityType] = useState('정기측정');
        const [memo, setMemo] = useState('');
        
        // Logged-in User Info Pre-fill
        const getLoggedUser = () => {
            try {
                const u = JSON.parse(localStorage.getItem('kiwe_user') || '{}');
                return u.user_name || '';
            } catch(e) { return ''; }
        };
        const [inspector, setInspector] = useState(getLoggedUser());

        const sb = getSupabase();

        useEffect(() => {
            if (!sb) return;
            sb.from('kiwe_equipments').select('*').then(({data}) => {
                if (data) setEquipments(data);
            });
        }, [sb]);

        const loadSchedules = useCallback(async () => {
             if (!sb) return;
             const startDate = `${currentYear}-${String(currentMonth).padStart(2,'0')}-01`;
             const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
             const { data } = await sb.from('kiwe_schedule').select('*')
                .gte('sche_date', startDate)
                .lte('sche_date', endDate);
             if (data) {
                 setSchedules(data);
                 const comNames = [...new Set(data.map(d => d.com_name))];
                 if(comNames.length>0) {
                     const { data: comp } = await sb.from('kiwe_companies').select('com_name, tel, manager_contact, address').in('com_name', comNames);
                     if(comp) setCompanies(comp);
                 }
             }
        }, [currentYear, currentMonth, sb]);

        useEffect(() => {
            loadSchedules();
        }, [loadSchedules]);

        const selectedDaySchedules = useMemo(() => {
            return schedules.filter(s => s.sche_date === selectedDate).sort((a,b) => {
                const ta = a.equipment_used?.visit_time || '99:99';
                const tb = b.equipment_used?.visit_time || '99:99';
                return ta.localeCompare(tb);
            });
        }, [schedules, selectedDate]);

        const equipmentUsage = useMemo(() => {
            const usage = {};
            selectedDaySchedules.forEach(s => {
                if (s.equipment_used && typeof s.equipment_used === 'object') {
                    Object.entries(s.equipment_used).forEach(([k, v]) => {
                        if (typeof v === 'number' && k !== 'visit_time') {
                            usage[k] = (usage[k] || 0) + v;
                        }
                    });
                }
            });
            return usage;
        }, [selectedDaySchedules]);

        const formatRemainingArray = () => {
            const req = [];
            if (equipments.length === 0) return ['확인중...'];
            equipments.forEach(eq => {
                const used = equipmentUsage[eq.eq_name] || 0;
                const remain = (eq.limit_count || 0) - used;
                req.push(`${eq.eq_name}(${remain})`);
            });
            return req;
        };

        const renderCalendar = () => {
            const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
            const startDay = new Date(currentYear, currentMonth - 1, 1).getDay();
            
            const weeks = [];
            let currentWeek = [];
            
            for(let i=0; i<startDay; i++) currentWeek.push(null);
            
            for(let d=1; d<=daysInMonth; d++) {
                const dateStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dayScheds = schedules.filter(s => s.sche_date === dateStr);
                currentWeek.push({ day: d, dateStr, dot: dayScheds.length > 0, count: dayScheds.length });
                if(currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            }
            if(currentWeek.length > 0) {
                while(currentWeek.length < 7) currentWeek.push(null);
                weeks.push(currentWeek);
            }

            return e('div', { className: 'bg-white rounded-3xl shadow-sm p-4 text-sm font-bold border border-slate-100 flex-shrink-0' },
                e('div', { className: 'flex justify-between items-center mb-4' },
                    e('button', { onClick: () => prevMonth(), className: 'p-2 text-slate-400 hit-area hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-colors' }, '◀'),
                    e('span', { className: 'text-lg text-slate-800 font-black' }, `${currentYear}년 ${currentMonth}월`),
                    e('button', { onClick: () => nextMonth(), className: 'p-2 text-slate-400 hit-area hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-colors' }, '▶')
                ),
                e('div', { className: 'grid grid-cols-7 gap-1 text-center mb-2 text-[11px] text-slate-400 tracking-widest' },
                    ['일','월','화','수','목','금','토'].map((wd, i) => e('div', { key: wd, className: i===0?'text-red-400':(i===6?'text-blue-400':'') }, wd))
                ),
                e('div', { className: 'space-y-1' },
                    weeks.map((wk, wi) => e('div', { key: wi, className: 'grid grid-cols-7 gap-1' },
                        wk.map((dObj, di) => {
                            if(!dObj) return e('div', { key: di, className: 'h-10 text-center flex flex-col items-center justify-center p-1' });
                            
                            const isSelected = dObj.dateStr === selectedDate;
                            const isToday = dObj.dateStr === new Date().toISOString().split('T')[0];
                            const textColor = isToday ? 'text-indigo-600 font-black' : (di===0 ? 'text-red-500' : (di===6?'text-blue-500':'text-slate-700'));
                            
                            return e('button', {
                                key: di,
                                onClick: () => { setSelectedDate(dObj.dateStr); setShowInput(false); setSchedComSearch(''); },
                                className: `h-12 w-full text-center flex flex-col items-center justify-start py-1.5 rounded-xl transition-all relative outline-none
                                    ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 z-10 scale-[1.05]' : 'hover:bg-slate-50 active:bg-slate-100'}`
                            }, 
                                e('span', { className: `${isSelected ? 'text-white' : textColor}` }, dObj.day),
                                dObj.dot && e('div', { className: 'flex gap-0.5 mt-1' },
                                    Array(Math.min(dObj.count, 3)).fill(0).map((_, idx) => 
                                        e('span', { key: idx, className: `w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-200' : 'bg-indigo-500'}` })
                                    ),
                                    dObj.count > 3 && e('span', { className: `text-[8px] leading-[6px] ml-px font-bold ${isSelected?'text-indigo-200':'text-indigo-500'}` }, '+')
                                )
                            )
                        })
                    ))
                )
            );
        };

        const prevMonth = () => {
            if(currentMonth === 1) { setCurrentYear(y=>y-1); setCurrentMonth(12); }
            else { setCurrentMonth(m=>m-1); }
        };
        const nextMonth = () => {
            if(currentMonth === 12) { setCurrentYear(y=>y+1); setCurrentMonth(1); }
            else { setCurrentMonth(m=>m+1); }
        };

        let searchTimeout;
        const handleSearch = (q) => {
             setSchedComSearch(q);
             clearTimeout(searchTimeout);
             if(!q || q.length < 1) { setCompanyResults([]); return; }
             
             searchTimeout = setTimeout(async () => {
                 const { data } = await sb.from('kiwe_companies').select('com_name, address').ilike('com_name', `%${q}%`).limit(10);
                 if(data) setCompanyResults(data);
             }, 300);
        };

        const handleSaveSchedule = async () => {
             if(!schedComSearch || !selectedDate) {
                 alert('사업장을 검색해서 선택해주세요.');
                 return;
             }
             
             const payload = {
                 com_name: schedComSearch,
                 sche_date: selectedDate,
                 inspector: inspector || '모바일입력',
                 activity_type: activityType,
                 equipment_used: memo ? { mobile_entry: true, memo: memo } : { mobile_entry: true }
             };
             
             const { error } = await sb.from('kiwe_schedule').insert([payload]);
             if(error) {
                 console.error(error);
                 alert('저장 실패: ' + error.message);
             } else {
                 alert('일정이 등록되었습니다.');
                 setShowInput(false);
                 setSchedComSearch('');
                 setActivityType('정기측정');
                 setMemo('');
                 loadSchedules();
             }
        };

        return e('div', { className: 'flex flex-col h-full bg-slate-50 gap-4 overflow-y-auto no-scrollbar outline-none pb-32' },
            renderCalendar(),
            
            // Selected Day Details
            e('div', { className: 'flex flex-col gap-3' },
                e('div', { className: 'bg-white text-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-2' },
                    e('div', { className: 'flex items-center gap-2 mb-2' },
                        e('span', { className: 'text-sm font-black' }, selectedDate),
                        e('span', { className: 'text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold' }, `일정 ${selectedDaySchedules.length}건`)
                    ),
                    e('div', { className: 'bg-indigo-50/50 rounded-xl p-3 flex flex-col gap-2' },
                        e('div', { className: 'text-[11px] font-black text-indigo-800 flex items-center gap-1' }, '🎒 잔여장비 현황'),
                        e('div', { className: 'flex flex-wrap gap-1.5' }, 
                            formatRemainingArray().map(txt => e('span', { key: txt, className: 'bg-white text-indigo-700 border border-indigo-100/50 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm opacity-90' }, txt))
                        )
                    )
                ),
                
                selectedDaySchedules.map(sch => {
                     const cInfo = companies.find(c => c.com_name === sch.com_name) || {};
                     return e('div', { key: sch.id, className: 'bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-3' },
                          e('div', { className: 'flex justify-between items-center' },
                               e('span', { className: 'font-black text-slate-800 text-[15px]' }, sch.com_name),
                               e('span', { className: 'text-[10px] text-indigo-600 font-black bg-indigo-50 px-2 py-1 rounded-lg uppercase' }, sch.activity_type || '지정안됨')
                          ),
                          e('div', { className: 'text-xs font-bold text-slate-500 flex justify-between' },
                               e('span', { className: 'pt-1 flex items-center gap-1.5' }, 
                                    e('i', { 'data-lucide': 'user', className: 'w-3 h-3 text-indigo-400' }),
                                    `측정자: ${sch.inspector}`
                               ),
                               e('span', null)
                          ),
                          (() => {
                               const usg = typeof sch.equipment_used === 'string' ? JSON.parse(sch.equipment_used || '{}') : (sch.equipment_used || {});
                               return usg.memo ? e('div', { className: 'text-[11px] font-bold text-slate-500 bg-slate-50 p-2.5 rounded-lg mt-1 whitespace-pre-wrap leading-relaxed' }, `💬 ${usg.memo}`) : null;
                          })(),
                          e('div', { className: 'grid grid-cols-2 gap-2 mt-1' },
                               (cInfo.tel || cInfo.manager_contact) ? e('a', { href: `tel:${cInfo.tel || cInfo.manager_contact}`, className: 'flex-1 py-3 bg-slate-50 text-slate-600 font-bold text-[11px] rounded-xl border border-slate-100 flex justify-center items-center gap-1.5 active:bg-slate-100 transition-colors' },
                                    e('i', { 'data-lucide': 'phone', className: 'w-3.5 h-3.5 text-indigo-500' }), '전화걸기'
                               ) : e('div', { className: 'flex-1 py-3 bg-slate-50 text-slate-300 font-bold text-[11px] rounded-xl border border-slate-100 flex justify-center items-center' },
                                    '연락처 없음'
                               ),
                               e('button', { onClick: () => window.openNavModal(cInfo.address || ''), className: 'flex-1 py-3 bg-blue-50 text-blue-600 font-bold text-[11px] rounded-xl border border-blue-100 flex justify-center items-center gap-1.5 active:bg-blue-100 transition-colors pointer-cursor hit-area' },
                                    e('i', { 'data-lucide': 'map-pin', className: 'w-3.5 h-3.5' }), '길찾기 안내'
                               )
                          )
                     );
                }),
                
                !showInput ? e('button', { 
                    onClick: () => setShowInput(true),
                    className: 'w-full py-4 bg-white border-2 border-dashed border-indigo-200 text-indigo-500 rounded-[24px] font-black flex justify-center items-center gap-2 active:bg-indigo-50 transition-colors mt-2 mb-4 shadow-sm shadow-indigo-50'
                }, 
                    e('span', { className: 'text-2xl leading-none font-normal mb-0.5' }, '+'), 
                    '해당 날짜에 새 일정 등록'
                ) : e('div', { className: 'bg-white p-5 rounded-3xl shadow-lg shadow-indigo-100/50 border border-indigo-100 flex flex-col gap-4 animate-fadeIn mt-2 mb-4' },
                    e('h4', { className: 'font-black text-slate-700 text-sm flex items-center gap-2 mb-1' }, 
                        e('span', { className: 'w-2 h-2 rounded-full bg-indigo-500' }),
                        '새 방문 일정 입력'
                    ),
                    e('div', { className: 'relative' },
                        e('input', { 
                             type: 'text', placeholder: '방문할 사업장명 검색...', value: schedComSearch, 
                             onChange: e => handleSearch(e.target.value),
                             className: 'w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 focus:bg-white transition-colors text-sm'
                        }),
                        companyResults.length > 0 && e('div', { className: 'absolute top-full left-0 right-0 max-h-48 overflow-y-auto bg-white border border-slate-200 mt-2 rounded-xl shadow-xl z-20' },
                             companyResults.map(cr => e('div', { 
                                  key: cr.com_name, 
                                  onClick: () => { setSchedComSearch(cr.com_name); setCompanyResults([]); },
                                  className: 'p-4 hover:bg-slate-50 border-b border-slate-50 font-bold text-sm text-slate-700 cursor-pointer active:bg-indigo-50'
                             }, cr.com_name))
                        )
                    ),
                    e('div', { className: 'space-y-3' },
                        e('div', null,
                            e('label', { className: 'block text-[10px] font-bold text-slate-400 mb-1 ml-1' }, '방문 목적'),
                            e('select', { 
                                value: activityType, 
                                onChange: e => setActivityType(e.target.value), 
                                className: 'w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 transition-colors text-sm text-slate-700 cursor-pointer appearance-none' 
                            },
                                ['정기측정', '예비조사', '보고서', '재측정', '회사행사', '공휴일', '기타'].map(t => e('option', { key: t, value: t }, t))
                            )
                        ),
                        e('div', null,
                            e('label', { className: 'block text-[10px] font-bold text-slate-400 mb-1 ml-1' }, '측정자/작성자 (선택)'),
                            e('input', { type: 'text', placeholder: '이름', value: inspector, onChange: e => setInspector(e.target.value), className: 'w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 transition-colors text-sm text-slate-700' })
                        ),
                        e('div', null,
                            e('label', { className: 'block text-[10px] font-bold text-slate-400 mb-1 ml-1' }, '메모/특이사항 (선택)'),
                            e('input', { type: 'text', placeholder: '필요한 메모가 있다면 자유롭게 입력해주세요', value: memo, onChange: e => setMemo(e.target.value), className: 'w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 transition-colors text-sm text-slate-700 outline-none' })
                        )
                    ),
                    e('div', { className: 'flex gap-2 mt-2' },
                        e('button', { onClick: () => { setShowInput(false); setSchedComSearch(''); setCompanyResults([]); setMemo(''); }, className: 'flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl active:bg-slate-200 transition-colors text-sm' }, '취소'),
                        e('button', { onClick: handleSaveSchedule, className: 'flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl active:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors text-sm' }, '일정 확실히 등록하기')
                    )
                )
            )
        );

        useEffect(() => {
            if (window.lucide) window.lucide.createIcons();
        }, [currentYear, currentMonth, selectedDate, showInput, schedules]);

    }

    const root = ReactDOM.createRoot(document.getElementById('scheduleRoot'));
    root.render(e(MobileScheduleUI));
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all
            tabs.forEach(t => {
                t.classList.remove('text-indigo-600', 'border-indigo-600');
                t.classList.add('text-slate-400', 'border-transparent');
            });
            contents.forEach(c => c.classList.add('hidden'));

            // Add active to clicked
            tab.classList.remove('text-slate-400', 'border-transparent');
            tab.classList.add('text-indigo-600', 'border-indigo-600');

            // Show content
            const targetId = tab.dataset.target;
            document.getElementById(targetId).classList.remove('hidden');

            // Lazy load tab data
            if (targetId === 'tabSchedule') {
                initScheduleTab();
            } else if (targetId === 'tabVehicle') {
                if (window.initVehicleTab) window.initVehicleTab();
            }
        });
    });

    // Icons
    if (window.lucide) window.lucide.createIcons();
});

// ==========================================
// Tab 3: Vehicle Mobile UI (React)
// ==========================================

window.initVehicleTab = function () {
    if (window.vehicleAppMounted) return; // Prevent double mount
    window.vehicleAppMounted = true;

    const { useState, useEffect, useMemo } = React;
    const e = React.createElement;

    // We can't use Lucide React icons easily without a builder unless we use standard elements, 
    // so we will just render typical HTML tags and call lucide.createIcons().
    // Or we use basic emojis/HTML unicode for simplicity in this React tree.
    
// --- 최상위 분리 컴포넌트: 운행 기록 카드 ---
    const DrivingCard = React.memo(({ log, activeVehicle, onChange, onDelete, onSave }) => {
        const dist = (Number(log.afterDist) || 0) - (Number(log.beforeDist) || 0);
        return e('div', { className: 'bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4' },
            e('div', { className: 'flex justify-between items-center mb-3 border-b pb-2' },
                e('input', { type: 'date', value: log.date, onChange: ev => onChange('date', ev.target.value), className: 'font-bold text-slate-700 bg-transparent outline-none w-36 text-lg' }),
                e('div', { className: 'flex items-center gap-2' },
                    e('span', { className: 'text-xs px-2 py-1 bg-slate-100 rounded-lg font-bold text-slate-500' }, dist > 0 ? `${dist.toLocaleString()}km` : '입력중'),
                    e('button', { onClick: onDelete, className: 'p-1 text-slate-300 hover:text-red-500 transition-colors' }, '🗑️')
                )
            ),
            e('div', { className: 'space-y-3' },
                e('div', { className: 'flex gap-2' },
                    e('div', { className: 'flex-1 bg-slate-50 p-3 rounded-lg border border-slate-100' },
                        e('label', { className: 'block text-[11px] text-slate-400 font-bold mb-1' }, '운행 전 (km)'),
                        e('input', { type: 'number', value: log.beforeDist, onChange: ev => onChange('beforeDist', ev.target.value), className: 'w-full bg-transparent font-bold text-lg outline-none' })
                    ),
                    e('div', { className: 'flex-1 bg-blue-50 p-3 rounded-lg border border-blue-100' },
                        e('label', { className: 'block text-[11px] text-blue-500 font-bold mb-1' }, '운행 후 (km)'),
                        e('input', { type: 'number', value: log.afterDist, onChange: ev => onChange('afterDist', ev.target.value), className: 'w-full bg-transparent font-black text-blue-700 text-lg outline-none' })
                    )
                ),
                e('div', { className: 'grid grid-cols-2 gap-2' },
                    e('div', { className: 'p-3 border border-slate-100 bg-slate-50 rounded-lg' },
                        e('label', { className: 'block text-[11px] text-slate-400 font-bold mb-1' }, '목적/기타'),
                        e('select', { value: log.purpose, onChange: ev => onChange('purpose', ev.target.value), className: 'w-full bg-transparent font-bold outline-none text-sm' },
                            e('option', { value: '업무용' }, '업무용'),
                            e('option', { value: '출퇴근' }, '출퇴근용'),
                            e('option', { value: '비업무용' }, '비업무용')
                        )
                    ),
                    e('div', { className: 'p-3 border border-slate-100 bg-slate-50 rounded-lg' },
                        e('label', { className: 'block text-[11px] text-slate-400 font-bold mb-1' }, '운전자'),
                        e('input', { type: 'text', value: log.driver, onChange: ev => onChange('driver', ev.target.value), className: 'w-full bg-transparent font-bold outline-none' })
                    )
                ),
                e('button', { onClick: onSave, className: 'w-full py-3.5 bg-slate-800 text-white font-bold rounded-xl mt-2 active:scale-95 transition-transform' }, '기록 저장하기')
            )
        );
    });

    // --- 최상위 분리 컴포넌트: 충전/주유 전용 카드 ---
    const ChargeCard = React.memo(({ log, activeVehicle, onChange, onDelete, onSave }) => {
        const isEV = activeVehicle?.type === 'EV';
        return e('div', { className: 'bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-200 mb-4' },
            e('div', { className: 'flex justify-between items-center mb-3 border-b border-emerald-200 pb-2' },
                e('div', { className: 'flex items-center gap-2' },
                    e('span', { className: 'text-xl' }, '🔋'),
                    e('input', { type: 'date', value: log.date, onChange: ev => onChange('date', ev.target.value), className: 'font-black text-emerald-800 bg-transparent outline-none w-32 text-lg' })
                ),
                e('button', { onClick: onDelete, className: 'p-1 text-emerald-300 hover:text-red-500 transition-colors' }, '🗑️')
            ),
            e('div', { className: 'space-y-3' },
                e('div', { className: 'flex gap-2' },
                    e('div', { className: 'flex-1 bg-white p-3 rounded-lg border border-emerald-100 shadow-sm' },
                        e('label', { className: 'block text-[11px] text-emerald-600 font-bold mb-1' }, '현재 계기판 (km)'),
                        e('input', { type: 'number', value: log.beforeDist, onChange: ev => { onChange('beforeDist', ev.target.value); onChange('afterDist', ev.target.value); }, className: 'w-full bg-transparent font-black text-lg outline-none text-slate-700' })
                    )
                ),
                e('div', { className: 'grid grid-cols-2 gap-2' },
                    e('div', { className: 'p-3 border border-emerald-100 bg-white rounded-lg shadow-sm' },
                        e('label', { className: 'block text-[11px] text-emerald-600 font-bold mb-1' }, isEV ? '충전량 (kWh)' : '주유량 (L)'),
                        e('input', { type: 'number', value: log.chargeKwh, onChange: ev => onChange('chargeKwh', ev.target.value), className: 'w-full bg-transparent font-black text-emerald-700 text-lg outline-none', placeholder: '0' })
                    ),
                    e('div', { className: 'p-3 border border-slate-200 bg-slate-100 rounded-lg shadow-sm opacity-70' },
                        e('label', { className: 'block text-[11px] text-slate-500 font-bold mb-1 bg-slate-200 px-1 rounded inline-block text-[9px]' }, '비용 (관리비내역)'),
                        e('input', { type: 'number', value: 0, disabled: true, className: 'w-full bg-transparent font-bold text-slate-400 outline-none', title: '충전 금액은 현재 아파트 관리비에서 자동 차감됩니다.' })
                    )
                ),
                e('div', { className: 'p-3 border border-emerald-100 bg-white rounded-lg shadow-sm' },
                    e('label', { className: 'block text-[11px] text-emerald-600 font-bold mb-1' }, '충전/주유자 (운전자)'),
                    e('input', { type: 'text', value: log.driver, onChange: ev => onChange('driver', ev.target.value), className: 'w-full bg-transparent font-bold outline-none' })
                ),
                e('button', { onClick: onSave, className: 'w-full py-3.5 bg-emerald-600 text-white font-black rounded-xl mt-2 active:scale-95 transition-transform hover:bg-emerald-700 shadow-md shadow-emerald-200' }, '충전/주유 기록 완성하기')
            )
        );
    });

    function MobileVehicleUI() {
        const [vehicles, setVehicles] = useState([]);
        const [selectedVid, setSelectedVid] = useState('');
        const [logs, setLogs] = useState([]);
        const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
        const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
        const { useRef, useCallback } = React;
        const scrollRef = useRef(null);

        useEffect(() => {
            VehicleAPI.fetchVehicles().then(data => {
                setVehicles(data);
                if (data.length > 0) setSelectedVid(data[0].id);
            });
        }, []);

        useEffect(() => {
            if (selectedVid) {
                VehicleAPI.fetchLogs(selectedVid, currentYear, currentMonth).then(setLogs);
            }
        }, [selectedVid, currentYear, currentMonth]);

        const activeVehicle = useMemo(() => vehicles.find(v => v.id === selectedVid) || null, [vehicles, selectedVid]);
        const stats = useMemo(() => VehicleAPI.calculateStats(logs), [logs]);

        const handleAddRow = useCallback(async (type = 'drive') => {
            const userStr = localStorage.getItem('kiwe_user');
            const currentUser = userStr ? JSON.parse(userStr).user_name : '';
            
            const savedLogs = logs.filter(l => !String(l.id).startsWith('temp_'));
            const prevDist = savedLogs.length > 0 ? (Number(savedLogs[0].afterDist) || Number(savedLogs[0].beforeDist) || 0) : 0;
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;

            const newRow = {
                id: 'temp_' + Date.now(),
                vehicleId: selectedVid,
                date: dateStr,
                driver: currentUser,
                purpose: type === 'charge' ? '충전' : '업무용',
                beforeDist: prevDist,
                afterDist: type === 'charge' ? prevDist : '',
                chargeCost: 0,
                chargeKwh: '',
                tollFee: 0,
                remarks: ''
            };
            
            // 맨 위에 추가
            setLogs(prev => [newRow, ...prev]);
            
            // 맨 위로 스크롤
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                else window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 80);
        }, [logs, selectedVid, currentYear, currentMonth]);

        const handleDeleteLog = useCallback(async (id) => {
            if (String(id).startsWith('temp_')) {
                setLogs(prev => prev.filter(l => l.id !== id));
                return;
            }
            if (!confirm('정말 삭제하시겠습니까?')) return;
            const success = await VehicleAPI.deleteLog(id);
            if (success) {
                setLogs(prev => prev.filter(l => l.id !== id));
                alert('삭제되었습니다.');
            } else {
                alert('삭제 중 오류가 발생했습니다.');
            }
        }, []);

        const handleRefresh = useCallback(() => {
            if (selectedVid) {
                VehicleAPI.fetchLogs(selectedVid, currentYear, currentMonth).then(setLogs);
            }
        }, [selectedVid, currentYear, currentMonth]);

        const handleChange = useCallback((id, field, value) => {
            setLogs(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
        }, []);

        const handleSave = useCallback((id) => {
            const log = logs.find(l => l.id === id);
            if (!log || !log.date) return alert('날짜를 입력하세요.');
            
            // DB 저장을 위한 복사본 생성
            const logToSave = { ...log };
            if (String(logToSave.id).startsWith('temp_')) {
                delete logToSave.id; // 임시 ID 제거 (DB에서 자동 생성 혹은 insert 처리를 위함)
            }

            VehicleAPI.upsertLog(logToSave).then(savedLog => {
                setLogs(prev => prev.map(l => l.id === id ? savedLog : l));
                alert('저장되었습니다.');
            }).catch(err => {
                console.error(err);
                alert('저장 중 오류가 발생했습니다: ' + err.message);
            });
        }, [logs]);

        const fmtNum = (n) => Number(n||0).toLocaleString();

        const HeaderSelector = () => e('div', { className: 'bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 flex gap-2' },
            e('select', { value: selectedVid, onChange: e => setSelectedVid(e.target.value), className: 'flex-1 bg-slate-50 border border-slate-200 font-bold text-slate-700 text-sm rounded-lg px-3 py-3 outline-none' },
                vehicles.map(v => e('option', { key: v.id, value: v.id }, `[${v.type}] ${v.name}`))
            ),
            e('input', { type: 'month', value: `${currentYear}-${String(currentMonth).padStart(2,'0')}`, onChange: ev => {
                const [y, m] = ev.target.value.split('-');
                setCurrentYear(Number(y)); setCurrentMonth(Number(m));
            }, className: 'w-32 bg-slate-50 border border-slate-200 font-bold text-slate-700 text-sm rounded-lg px-3 py-3 outline-none' })
        );

        return e('div', { className: 'flex flex-col h-full bg-slate-50 relative' },
            e(HeaderSelector),
            e('div', { className: 'grid grid-cols-2 gap-3 mb-6 relative z-10' },
                e('button', { onClick: () => handleAddRow('drive'), className: 'flex flex-col items-center justify-center p-4 bg-blue-600 text-white rounded-2xl shadow-lg gap-2 active:scale-95 transition-transform' },
                    e('span', { className: 'text-2xl' }, '🚗'),
                    e('span', { className: 'font-black text-sm' }, '운행 기록 추가')
                ),
                e('button', { onClick: () => handleAddRow('charge'), className: 'flex flex-col items-center justify-center p-4 bg-emerald-600 text-white rounded-2xl shadow-lg gap-2 active:scale-95 transition-transform' },
                    e('span', { className: 'text-2xl' }, '🔋'),
                    e('span', { className: 'font-black text-sm' }, '충전/주유 기록')
                )
            ),
            e('h3', { className: 'font-black text-slate-700 mb-3 ml-1 flex items-center justify-between' }, 
                `${currentMonth}월 상세 내역 (v4)`,
                e('div', { className: 'flex items-center gap-2' },
                    e('button', { onClick: handleRefresh, className: 'p-2 text-indigo-500 bg-indigo-50 rounded-lg active:scale-95 transition-all' }, '🔄'),
                    e('span', { className: 'text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md' }, `총 ${logs.length}건`)
                )
            ),
            e('div', { ref: scrollRef, className: 'flex-1 overflow-y-auto pb-40 no-scrollbar relative z-0' },
                logs.length === 0 
                  ? e('div', { className: 'text-center text-slate-400 py-10' }, '해당 월의 운행 내역이 없습니다.') 
                  : logs.map(log => 
                      log.purpose === '충전' 
                          ? e(ChargeCard, { key: log.id, log, activeVehicle, onChange: (field, val) => handleChange(log.id, field, val), onDelete: () => handleDeleteLog(log.id), onSave: () => handleSave(log.id) })
                          : e(DrivingCard, { key: log.id, log, activeVehicle, onChange: (field, val) => handleChange(log.id, field, val), onDelete: () => handleDeleteLog(log.id), onSave: () => handleSave(log.id) })
                  )
            ),
            // Footer Stats Stick to bottom
            e('div', { className: 'fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 text-white p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-20 pb-8 pt-4 rounded-t-3xl max-w-lg mx-auto' },
                e('div', { className: 'flex gap-6 overflow-x-auto justify-between items-center px-2' },
                    e('div', { className: 'flex flex-col items-center' }, 
                        e('div', { className: 'text-[10px] text-slate-400 font-bold mb-1' }, '당월 주행'), 
                        e('div', { className: 'text-xl font-black text-blue-400' }, fmtNum(stats.totalDist), e('span', { className: 'text-xs ml-0.5 font-normal text-slate-300' }, 'km'))
                    ),
                    e('div', { className: 'flex flex-col items-center' }, 
                        e('div', { className: 'text-[10px] text-slate-400 font-bold mb-1' }, activeVehicle?.type==='EV'?'충전금액':'유류금액'), 
                        e('div', { className: 'text-xl font-black text-emerald-400' }, '₩', fmtNum(stats.totalCharge))
                    ),
                    activeVehicle?.type === 'EV' && e('div', { className: 'flex flex-col items-center' }, 
                        e('div', { className: 'text-[10px] text-slate-400 font-bold mb-1' }, '전비(km/kWh)'), 
                        e('div', { className: 'text-xl font-black text-amber-300' }, stats.efficiency)
                    )
                )
            )
        );
    }

    const root = ReactDOM.createRoot(document.getElementById('vehicleRoot'));
    root.render(e(MobileVehicleUI));
};

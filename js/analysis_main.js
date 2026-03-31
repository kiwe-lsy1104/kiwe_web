import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
import { supabase } from './config.js';
import { FlaskConical, BarChart4, ArrowLeft, FileSpreadsheet, Home } from 'https://esm.sh/lucide-react@0.263.1';
import AnalysisInput from './analysis_input.js?v=4';
import AnalysisView from './analysis_view_v2.js';

const e = React.createElement;

const BLANK_PROTOCOL = {
    hazardName: '', mol_weight: 0, twa_mg: 0, twa_ppm: 0, sg: 0, purity: 100,
    // GC/UV
    mixing_ratio: 1, desorption_vol: 1, desorptionRate: 100, slope: 0, r2: 0, lod: 0, loq: 0,
    // ICP
    oxidation_corr: 1, recovery_rate: 100,
};

const BLANK_STD_POINTS = [
    { id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }, { id: 3, x: 0, y: 0 },
    { id: 4, x: 0, y: 0 }, { id: 5, x: 0, y: 0 }, { id: 6, x: 0, y: 0 },
];

const BLANK_DESORB = Array.from({ length: 9 }, (_, i) => ({ no: i + 1, area: 0, rate: 100 }));

function App() {
    const [activeTab, setActiveTab] = useState('input');

    // Shared State moved from AnalysisInput
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [filterCompany, setFilterCompany] = useState('');
    const [filterHazard, setFilterHazard] = useState('');
    const [rawRows, setRawRows] = useState([]);
    const [hazardMap, setHazardMap] = useState({});

    const [protocol, setProtocol] = useState(BLANK_PROTOCOL);
    const [stdPoints, setStdPoints] = useState(BLANK_STD_POINTS);
    const [desorptionRates, setDesorptionRates] = useState(BLANK_DESORB);
    const [desorptionSpikeMass, setDesorptionSpikeMass] = useState(1);

    const TABS = [
        { id: 'protocol', name: '분석 프로토콜', icon: FlaskConical },
        { id: 'input', name: '결과 입력 및 계산', icon: FileSpreadsheet },
        { id: 'view', name: '결과 조회 및 통보서', icon: BarChart4 },
    ];

    const instrumentType = React.useMemo(() => {
        if (!filterHazard) return '';
        return hazardMap[filterHazard]?.instrument_name || 'GC';
    }, [filterHazard, hazardMap]);

    const currentHazardInfo = hazardMap[filterHazard] || null;

    return e('div', { className: "h-screen bg-slate-50 flex flex-col font-sans overflow-hidden" },
        // Header
        e('header', { className: "bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between no-print z-50 shadow-sm shrink-0" },
            e('div', { className: "flex items-center gap-4" },
                e('a', { href: "main.html", className: "p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" }, e(ArrowLeft, { size: 20 })),
                e('div', { className: "flex items-center gap-2" },
                    e(FlaskConical, { className: "text-violet-600", size: 22 }),
                    e('h1', { className: "text-lg font-black text-slate-800" }, "분석결과 입력 시스템")
                ),
                e('div', { className: "flex bg-slate-100 p-1 rounded-lg ml-6 space-x-1" },
                    TABS.map(tab => e('button', {
                        key: tab.id,
                        onClick: () => setActiveTab(tab.id),
                        className: `flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
                    }, e(tab.icon, { size: 16 }), tab.name)),
                    e('div', { className: "w-px h-6 bg-slate-300 mx-2 self-center" }),
                    e('a', {
                        href: 'analysis_unified.html',
                        className: "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                    }, e(FileSpreadsheet, { size: 16 }), "전체 통보서(기존)"),
                    e('a', {
                        href: 'main.html',
                        className: "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                    }, e(Home, { size: 16 }), "메인화면")
                )
            ),
        ),

        // Main Content Area
        e('main', { className: "flex-1 overflow-hidden relative" },
            activeTab === 'input' || activeTab === 'protocol' ? e(AnalysisInput, {
                supabase,
                activeTab,
                setActiveTab,
                startDate, setStartDate,
                endDate, setEndDate,
                filterCompany, setFilterCompany,
                filterHazard, setFilterHazard,
                rawRows, setRawRows,
                hazardMap, setHazardMap,
                protocol, setProtocol,
                stdPoints, setStdPoints,
                desorptionRates, setDesorptionRates,
                desorptionSpikeMass, setDesorptionSpikeMass,
                instrumentType,
                currentHazardInfo
            }) : e(AnalysisView, { supabase })
        )
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));

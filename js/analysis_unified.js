// js/analysis_unified.js
import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
import {
    ArrowLeft, FileText, FlaskConical, BarChart3, Search, Settings2, Download
} from 'https://esm.sh/lucide-react@0.263.1';
import { supabase, checkAuth } from './config.js';
import { AnalysisExtraction } from './analysis_list.js';

const e = React.createElement;

function App() {
    const [activeTab, setActiveTab] = useState('extraction');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [keyword, setKeyword] = useState('');

    const TABS = [
        { id: 'extraction', name: '분석용 데이터 가공', icon: BarChart3 },
        { id: 'weight', name: '중량분석(필터) 결과', icon: FileText },
        { id: 'oil', name: '오일분석(추출) 결과', icon: FlaskConical },
    ];

    return e('div', { className: "h-screen bg-slate-50 flex flex-col font-sans overflow-hidden" },
        // Header
        e('header', { className: "bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between no-print sticky top-0 z-50 shadow-sm" },
            e('div', { className: "flex items-center gap-6" },
                e('a', { href: "main.html", className: "p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" }, e(ArrowLeft, { size: 22 })),
                e('div', { className: "flex items-center gap-2" },
                    e(FileText, { className: "text-violet-600", size: 24 }),
                    e('h1', { className: "text-lg font-black text-slate-800" }, "분석결과통보서 시스템")
                ),
                e('div', { className: "flex bg-slate-100 p-1 rounded-xl ml-4 space-x-1" },
                    TABS.map(tab => e('button', {
                        key: tab.id,
                        onClick: () => setActiveTab(tab.id),
                        className: `flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
                    }, e(tab.icon, { size: 16 }), tab.name)),
                    e('div', { className: "w-px h-6 bg-slate-300 mx-2 self-center" }),
                    e('a', {
                        href: 'analysis.html',
                        className: "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                    }, e(FlaskConical, { size: 16 }), "분석결과 입력 시스템"),
                    e('a', {
                        href: 'sampling_manage.html',
                        className: "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                    }, e(BarChart3, { size: 16 }), "시료통계관리")
                )
            ),
        ),

        // Main Content
        e('main', { className: "flex-1 overflow-hidden relative" },
            activeTab === 'extraction' ? (
                e('div', { className: "h-full p-4 flex flex-col" },
                    e(AnalysisExtraction, {
                        supabase, startDate, endDate, keyword,
                        onStartDateChange: setStartDate,
                        onEndDateChange: setEndDate,
                        onKeywordChange: setKeyword
                    })
                )
            ) : activeTab === 'weight' ? (
                e('iframe', {
                    src: "weight.html",
                    className: "w-full h-full border-none",
                    title: "Weight Analysis"
                })
            ) : (
                e('iframe', {
                    src: "oil_weight.html",
                    className: "w-full h-full border-none",
                    title: "Oil Analysis"
                })
            )
        )
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));

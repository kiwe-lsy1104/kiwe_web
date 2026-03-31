// analysis_protocol.js - 분석 프로토콜 패널 (좌측 1/3)
// instrument_type에 따라 ICP / GC / UV 모드 전환

import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { Calculator, AlertCircle, LineChart as LineChartIcon, Trash2, ChevronUp, ChevronDown } from 'https://esm.sh/lucide-react@0.263.1';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'https://esm.sh/recharts@2.7.2';

const e = React.createElement;

export function computeLinearRegression(points) {
    const valid = points.filter(p => !isNaN(p.x) && !isNaN(p.y) && p.x !== '' && p.y !== '' && (p.x > 0 || p.y > 0));
    const n = valid.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    valid.forEach(p => { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x; sumY2 += p.y * p.y; });
    const den = (n * sumX2 - sumX * sumX);
    if (den === 0) return { slope: 0, intercept: 0, r2: 0 };
    const slope = (n * sumXY - sumX * sumY) / den;
    const intercept = (sumY - slope * sumX) / n;
    const yMean = sumY / n;
    let ssTot = 0, ssRes = 0;
    valid.forEach(p => { ssTot += Math.pow(p.y - yMean, 2); ssRes += Math.pow(p.y - (slope * p.x + intercept), 2); });
    const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
    return { slope, intercept, r2 };
}

const BLANK_STD = () => ({ id: Date.now() + Math.random(), conc: 0, area: 0 });
const BLANK_DESORB = (no) => ({ no, area: 0, rate: 100 });

const inputCls = 'w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono outline-none focus:border-violet-400 bg-white';
const readCls = 'w-full px-2 py-1.5 border border-slate-100 rounded text-xs font-mono outline-none bg-slate-50 text-slate-500';
const sectionHCls = 'text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200 pb-1 mb-3 flex items-center gap-1';

export default function AnalysisProtocol({ instrumentType, hazardInfo, protocol, setProtocol, stdPoints, setStdPoints, desorptionRates, setDesorptionRates, desorptionSpikeMass, setDesorptionSpikeMass }) {
    // instrumentType: 'ICP' | 'GC' | 'UV' | '외부의뢰' | ''
    const isICP = instrumentType === 'ICP';
    const isExternal = instrumentType === '외부의뢰';
    const isGCUV = !isICP && !isExternal;

    // 검량선 slope/R² 자동계산 (GC/UV only)
    useEffect(() => {
        if (!isGCUV) return;
        const { slope, r2 } = computeLinearRegression(stdPoints);
        setProtocol(p => ({ ...p, slope: Number(slope.toFixed(6)), r2: Number(r2.toFixed(4)) }));
    }, [stdPoints]);

    // 탈착률 평균 자동계산 (GC/UV only)
    useEffect(() => {
        if (!isGCUV || !protocol.slope) return;
        const totalVol = (parseFloat(protocol.mixing_ratio) || 0) + (parseFloat(protocol.desorption_vol) || 0);
        let validRates = [];
        const newRates = desorptionRates.map(d => {
            let r = d.rate;
            if (d.area > 0 && protocol.slope > 0 && desorptionSpikeMass > 0) {
                const recovered = (d.area / protocol.slope) * totalVol;
                r = Math.min(100, Math.max(0, (recovered / desorptionSpikeMass) * 100));
            }
            if (d.area > 0) validRates.push(r);
            return { ...d, rate: isNaN(r) ? 100 : r };
        });
        const avg = validRates.length > 0 ? validRates.reduce((a, b) => a + b, 0) / validRates.length : 100;
        if (Math.abs(protocol.desorptionRate - avg) > 0.001) {
            setProtocol(p => ({ ...p, desorptionRate: Number(avg.toFixed(2)) }));
        }
        // Only update if rates actually changed
        const changed = newRates.some((r, i) => Math.abs(r.rate - desorptionRates[i].rate) > 0.001);
        if (changed) setDesorptionRates(newRates);
    }, [desorptionRates.map(d => d.area).join(','), protocol.slope, desorptionSpikeMass]);

    const totalVol = useMemo(() => (parseFloat(protocol.mixing_ratio) || 0) + (parseFloat(protocol.desorption_vol) || 0), [protocol.mixing_ratio, protocol.desorption_vol]);

    const setP = (k, v) => setProtocol(p => ({ ...p, [k]: v }));
    const setLOD = (val) => { const lod = parseFloat(val) || 0; setProtocol(p => ({ ...p, lod, loq: Number((lod * 3.3).toFixed(6)) })); };

    const Row = ({ label, children, full }) => e('div', { className: full ? 'col-span-2' : '' },
        e('label', { className: 'block text-[10px] font-bold text-slate-500 mb-0.5' }, label),
        children
    );

    return e('div', { className: 'w-full h-full bg-slate-50 flex flex-col overflow-y-auto p-6 items-center' },
        // 헤더
        e('div', { className: 'w-full max-w-4xl px-4 py-4 border-b bg-white rounded-t-xl flex items-center justify-between shrink-0 shadow-sm' },
            e('div', { className: 'flex items-center gap-3' },
                e('div', { className: 'p-2 bg-violet-100 text-violet-700 rounded-lg' }, e(Calculator, { size: 20 })),
                e('div', null,
                    e('p', { className: 'text-sm font-black text-slate-800' }, '분석 프로토콜 설정'),
                    e('p', { className: 'text-xs text-violet-600 font-bold' },
                        isICP ? '🔬 ICP 모드' : isExternal ? '📨 외부의뢰' : '⚗️ GC/UV 모드')
                )
            ),
            e('div', { className: 'text-xs text-slate-400 font-medium' },
                '유해인자를 선택하면 해당 물질의 기본 정보가 자동으로 로드됩니다.'
            )
        ),
        e('div', { className: 'w-full max-w-4xl bg-white rounded-b-xl shadow-sm overflow-y-auto p-8 space-y-8 mb-10' },

            // ── 물질 기본정보 (공통) ──────────────────────────
            e('section', null,
                e('h3', { className: sectionHCls }, e(AlertCircle, { size: 11 }), '물질 기본정보'),
                e('div', { className: 'grid grid-cols-2 gap-2' },
                    Row({
                        label: '유해인자', full: true, children:
                            e('input', { className: readCls, value: protocol.hazardName || '-', readOnly: true })
                    }),
                    Row({
                        label: '분자량 (MW)', children:
                            e('input', { className: readCls, value: hazardInfo?.mol_weight || 0, readOnly: true })
                    }),
                    Row({
                        label: '비중 (SG)', children:
                            e('input', { className: readCls, value: hazardInfo?.sg || 0, readOnly: true })
                    }),
                    Row({
                        label: 'TLV (mg/m³)', children:
                            e('input', { className: readCls, value: hazardInfo?.twa_mg || 0, readOnly: true })
                    }),
                    Row({
                        label: 'TLV (ppm)', children:
                            e('input', { className: readCls, value: hazardInfo?.twa_ppm || 0, readOnly: true })
                    }),
                )
            ),

            // ── ICP 전용 ──────────────────────────────────────
            isICP && e('section', null,
                e('h3', { className: sectionHCls }, '🔬 ICP 분석 조건'),
                e('div', { className: 'grid grid-cols-2 gap-2' },
                    Row({
                        label: '산화보정값', children:
                            e('input', {
                                type: 'number', step: '0.01', className: inputCls,
                                value: protocol.oxidation_corr ?? 1,
                                onChange: ev => setP('oxidation_corr', parseFloat(ev.target.value) || 1)
                            })
                    }),
                    Row({
                        label: '회수율 (%)', children:
                            e('input', {
                                type: 'number', step: '0.1', className: inputCls,
                                value: protocol.recovery_rate ?? 100,
                                onChange: ev => setP('recovery_rate', parseFloat(ev.target.value) || 100)
                            })
                    }),
                    Row({
                        label: 'LOD (ug/ml)', children:
                            e('input', {
                                type: 'number', step: '0.0001', className: inputCls + ' text-orange-600 font-bold',
                                value: protocol.lod, onChange: ev => setLOD(ev.target.value)
                            })
                    }),
                    Row({
                        label: 'LOQ (LOD×3.3)', children:
                            e('input', { className: readCls + ' text-red-600 font-bold', value: protocol.loq, readOnly: true })
                    }),
                ),
                e('div', { className: 'mt-3 p-2 bg-blue-50 rounded text-[10px] text-blue-700 font-bold' },
                    '산출식: (농도×희석액×산화보정값) ÷ (회수율×채기량)'
                )
            ),

            // ── GC / UV 전용 ──────────────────────────────────
            isGCUV && e('section', null,
                e('h3', { className: sectionHCls }, '🔬 시료량 정의'),
                e('div', { className: 'grid grid-cols-3 gap-2 items-end' },
                    Row({
                        label: '혼합비율(µL)', children:
                            e('input', {
                                type: 'number', step: '0.1', className: inputCls,
                                value: protocol.mixing_ratio,
                                onChange: ev => setP('mixing_ratio', parseFloat(ev.target.value) || 0)
                            })
                    }),
                    e('div', { className: 'text-center text-slate-400 font-bold text-sm pb-1' }, '+'),
                    Row({
                        label: '탈착액양(µL)', children:
                            e('input', {
                                type: 'number', step: '0.1', className: inputCls,
                                value: protocol.desorption_vol,
                                onChange: ev => setP('desorption_vol', parseFloat(ev.target.value) || 0)
                            })
                    }),
                ),
                e('div', { className: 'flex justify-between bg-indigo-50 border border-indigo-100 rounded px-3 py-1.5 mt-2' },
                    e('span', { className: 'text-[10px] font-bold text-indigo-700' }, 'Total 시료량 (µL)'),
                    e('span', { className: 'font-mono text-indigo-700 font-bold text-xs' }, totalVol.toFixed(1))
                )
            ),

            isGCUV && e('section', null,
                e('div', { className: 'flex justify-between items-center border-b border-slate-200 pb-1 mb-3' },
                    e('h3', { className: 'text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1' },
                        e(LineChartIcon, { size: 11 }), '검량선 (Standard Curve)'),
                    e('button', {
                        onClick: () => setStdPoints(p => [...p, BLANK_STD()]),
                        className: 'text-[10px] font-bold text-indigo-600 hover:text-indigo-800'
                    }, '+ 추가')
                ),
                e('div', { className: 'grid grid-cols-[1fr_1fr_28px] gap-1 text-[9px] font-bold text-slate-400 mb-1 px-1' },
                    e('span', { className: 'text-center' }, '농도 (X)'), e('span', { className: 'text-center' }, 'Area (Y)'), e('span')
                ),
                e('div', { className: 'space-y-1' },
                    stdPoints.map((pt, idx) => e('div', { key: pt.id, className: 'grid grid-cols-[1fr_1fr_28px] gap-1' },
                        e('input', {
                            type: 'number', className: inputCls + ' !text-center', value: pt.x,
                            onChange: ev => { const n = [...stdPoints]; n[idx].x = parseFloat(ev.target.value) || 0; setStdPoints(n); }
                        }),
                        e('input', {
                            type: 'number', className: inputCls + ' !text-center', value: pt.y,
                            onChange: ev => { const n = [...stdPoints]; n[idx].y = parseFloat(ev.target.value) || 0; setStdPoints(n); }
                        }),
                        e('button', {
                            onClick: () => setStdPoints(stdPoints.filter((_, i) => i !== idx)),
                            className: 'flex items-center justify-center text-red-300 hover:text-red-500'
                        }, e(Trash2, { size: 12 }))
                    ))
                ),
                e('div', { className: 'grid grid-cols-2 gap-2 mt-3 bg-slate-100 p-2 rounded' },
                    e('div', null,
                        e('p', { className: 'text-[9px] font-bold text-slate-500' }, 'Slope'),
                        e('p', { className: 'font-mono font-bold text-slate-800 text-xs' }, protocol.slope?.toFixed(6) || '0')
                    ),
                    e('div', { className: 'text-right' },
                        e('p', { className: 'text-[9px] font-bold text-slate-500' }, 'R²'),
                        e('p', { className: 'font-mono font-bold text-slate-800 text-xs' }, protocol.r2?.toFixed(4) || '0')
                    )
                )
            ),

            isGCUV && e('section', null,
                e('div', { className: 'flex justify-between items-center border-b border-slate-200 pb-1 mb-3' },
                    e('h3', { className: 'text-[10px] font-black text-slate-600 uppercase tracking-wider' }, '탈착률 (Desorption %)'),
                    e('div', { className: 'flex items-center gap-1 text-[10px]' },
                        e('span', { className: 'text-slate-500 font-bold' }, '첨가량(mg)'),
                        e('input', {
                            type: 'number', className: 'w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-center outline-none',
                            value: desorptionSpikeMass, onChange: ev => setDesorptionSpikeMass(parseFloat(ev.target.value) || 1)
                        })
                    )
                ),
                e('div', { className: 'grid grid-cols-3 gap-1.5' },
                    desorptionRates.map((d, idx) => e('div', { key: d.no, className: 'flex flex-col gap-0.5' },
                        e('input', {
                            type: 'number', className: inputCls + ' !text-center', placeholder: 'Area',
                            value: d.area || '',
                            onChange: ev => { const n = [...desorptionRates]; n[idx].area = parseFloat(ev.target.value) || 0; setDesorptionRates(n); }
                        }),
                        e('span', { className: 'text-[9px] text-center text-indigo-500 font-bold' },
                            d.area > 0 ? d.rate.toFixed(1) + '%' : '-')
                    ))
                ),
                e('div', { className: 'flex justify-between bg-slate-100 border border-slate-200 rounded px-3 py-1.5 mt-2' },
                    e('span', { className: 'text-[10px] font-bold text-slate-600' }, '평균 탈착률 (R)'),
                    e('span', { className: 'font-mono font-bold text-slate-800 text-xs' }, (protocol.desorptionRate || 100).toFixed(2) + '%')
                )
            ),

            // ── LOD/LOQ (GC/UV) ──────────────────────────────
            isGCUV && e('section', { className: 'pb-6' },
                e('h3', { className: sectionHCls }, 'LOD / LOQ'),
                e('div', { className: 'grid grid-cols-2 gap-2' },
                    Row({
                        label: 'LOD (수동입력)', children:
                            e('input', {
                                type: 'number', step: '0.0001', className: inputCls + ' text-orange-600 font-bold',
                                value: protocol.lod, onChange: ev => setLOD(ev.target.value)
                            })
                    }),
                    Row({
                        label: 'LOQ (LOD×3.3)', children:
                            e('input', { className: readCls + ' text-red-600 font-bold', value: protocol.loq, readOnly: true })
                    })
                )
            ),

            isExternal && e('div', { className: 'p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-bold' },
                '📨 외부의뢰 시료입니다.',
                e('br'),
                '우측 그리드에서 mg/m³ 또는 ppm 값을 직접 입력하세요.'
            )
        )
    );
}

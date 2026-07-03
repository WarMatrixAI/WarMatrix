'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal, Cpu, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = 'INFO' | 'PROC' | 'OK' | 'ERR' | 'SYS' | 'DATA';

export interface LogEntry {
    id: string;
    ts: string;
    level: LogLevel;
    msg: string;
}

interface AITerminalProps {
    logs: LogEntry[];
    isRunning: boolean;
    title?: string;
    modelName?: string;
    isGemini?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const levelStyles: Record<LogLevel, { color: string; bg: string; tag: string }> = {
    SYS: { color: '#60A5FA', bg: 'rgba(37,99,235,0.12)', tag: 'SYS ' },
    INFO: { color: '#94A3B8', bg: 'transparent', tag: 'INFO' },
    PROC: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', tag: 'PROC' },
    OK: { color: '#22C55E', bg: 'rgba(34,197,94,0.08)', tag: ' OK ' },
    ERR: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', tag: 'ERR ' },
    DATA: { color: '#A78BFA', bg: 'rgba(139,92,246,0.08)', tag: 'DATA' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AITerminalConsole({ logs, isRunning, title = 'AI ENGINE TERMINAL', modelName, isGemini }: AITerminalProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to latest entry
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs.length]);

    return (
        <div
            className="flex flex-col rounded-sm overflow-hidden"
            style={{
                background: 'rgba(4,6,12,0.97)',
                border: '1px solid rgba(31,111,235,0.25)',
                boxShadow: '0 0 30px rgba(31,111,235,0.08), inset 0 0 40px rgba(0,0,0,0.5)',
                fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            }}
        >
            {/* ── Header bar ── */}
            <div
                className="flex items-center justify-between px-3 py-2 shrink-0"
                style={{
                    background: 'rgba(8,15,30,0.95)',
                    borderBottom: '1px solid rgba(31,111,235,0.18)',
                }}
            >
                <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-[#1F6FEB]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#1F6FEB]">
                        {title}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isRunning ? (
                        <div className="flex items-center gap-1.5">
                            <Loader2 className="w-2.5 h-2.5 text-[#F59E0B] animate-spin" />
                            <span className="text-[9px] font-mono text-[#F59E0B] uppercase tracking-wider">PROCESSING</span>
                        </div>
                    ) : logs.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                            <span className="text-[9px] font-mono text-[#22C55E] uppercase tracking-wider">READY</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#374151]" />
                            <span className="text-[9px] font-mono text-[#374151] uppercase tracking-wider">IDLE</span>
                        </div>
                    )}
                    <Cpu className="w-3 h-3 text-[#1F6FEB]/40" />
                </div>
            </div>

            {/* ── Log output ── */}
            <div
                className="flex-1 overflow-y-auto py-1.5 px-2"
                style={{ minHeight: 0 }}
            >
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-6">
                        <span className="text-[10px] font-mono text-[#374151] uppercase tracking-widest">
                            Awaiting scenario generation request...
                        </span>
                    </div>
                ) : (
                    <>
                        {logs.map(entry => {
                            const s = levelStyles[entry.level];
                            return (
                                <div
                                    key={entry.id}
                                    className="flex items-start gap-2 px-1 py-0.5 rounded-sm mb-0.5 transition-all"
                                    style={{ background: s.bg }}
                                >
                                    {/* Timestamp */}
                                    <span className="text-[8.5px] font-mono text-[#374151] shrink-0 mt-0.5 tabular-nums">
                                        {entry.ts}
                                    </span>
                                    {/* Level tag */}
                                    <span
                                        className="text-[8.5px] font-bold shrink-0 mt-0.5 tabular-nums"
                                        style={{ color: s.color, minWidth: '3rem' }}
                                    >
                                        [{entry.level}]
                                    </span>
                                    {/* Message */}
                                    <span
                                        className="text-[10px] font-mono leading-relaxed break-all"
                                        style={{ color: s.color === '#94A3B8' ? '#9CA3AF' : s.color }}
                                    >
                                        {entry.msg}
                                    </span>
                                </div>
                            );
                        })}
                        {/* Running cursor */}
                        {isRunning && (
                            <div className="flex items-center gap-2 px-1 py-0.5">
                                <span className="text-[8.5px] font-mono text-[#374151] tabular-nums">
                                    {new Date().toLocaleTimeString('en-GB', { hour12: false })}
                                </span>
                                <span className="text-[8.5px] font-bold text-[#F59E0B]">[PROC]</span>
                                <span className="text-[10px] font-mono text-[#F59E0B] animate-pulse">
                                    █
                                </span>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </>
                )}
            </div>

            {/* ── Footer ── */}
            <div
                className="flex items-center justify-between px-3 py-1.5 shrink-0"
                style={{ borderTop: '1px solid rgba(31,111,235,0.12)', background: 'rgba(4,8,18,0.9)' }}
            >
                <span className="text-[8px] font-mono text-[#4D637F] uppercase tracking-widest">
                    {isGemini ? `GEMINI CLOUD // ${modelName ?? 'GEMINI'}` : `LOCAL LLM // ${modelName ?? 'LOCAL CORE'}`}
                </span>
                <span className="text-[8px] font-mono text-[#2D3748] tabular-nums">
                    {logs.length} LINES
                </span>
            </div>
        </div>
    );
}

// ─── Log factory helper (use in parent) ──────────────────────────────────────

export function makeLog(level: LogLevel, msg: string): LogEntry {
    return {
        id: Math.random().toString(36).slice(2),
        ts: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        level,
        msg,
    };
}

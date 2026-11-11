import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatBaseUnitsToDecimal } from '../../packages/shared/constants';
import { AppStateBundle, AuthModalView } from '../types/api';

interface CosmicHeroStageProps {
  state: AppStateBundle | null;
  onOpenAuth: (view: AuthModalView) => void;
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

const DAILY_SUMMARIES = [
  'Initialized NEAR Policy Guard Contract v1 ($500 max invoice / $2,000 daily cap).',
  'Registered VENDOR-001 (Acme Dev Labs) & VENDOR-002 (ZK Security DAO) onchain.',
  'Verified GitHub PR #42 commit SHA & linked Purchase Order PO-2026-001.',
  'Provisioned restricted 4-method Function Call Key (0 NEAR transfer allowance).',
  'Executed 42 adversarial security gates across Custody, TEE Attestation & Intents.',
  'Blocked $10,000 prompt-injection attack attempting to override treasury limits.',
  'Settled INV-001 ($250.00 USDC) to Base via NEAR Intents 1Click with verified tx proof.',
];

const STAR_COORDS = [
  { top: '12%', left: '18%', size: 2, opacity: 0.55 },
  { top: '18%', left: '24%', size: 1.5, opacity: 0.35 },
  { top: '10%', left: '74%', size: 2, opacity: 0.65 },
  { top: '22%', left: '81%', size: 1.5, opacity: 0.45 },
  { top: '28%', left: '68%', size: 2.5, opacity: 0.7 },
  { top: '34%', left: '72%', size: 1.5, opacity: 0.5 },
  { top: '38%', left: '29%', size: 2, opacity: 0.6 },
  { top: '44%', left: '22%', size: 1.5, opacity: 0.4 },
  { top: '42%', left: '64%', size: 2, opacity: 0.75 },
  { top: '49%', left: '76%', size: 1.5, opacity: 0.5 },
  { top: '52%', left: '34%', size: 2, opacity: 0.65 },
  { top: '15%', left: '42%', size: 1.5, opacity: 0.3 },
];

export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatFullLiveDate(date: Date): string {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
  const dayWithOrdinal = getOrdinalSuffix(date.getDate());
  const year = date.getFullYear();
  return `${weekday}, ${month} ${dayWithOrdinal}, ${year}`;
}

export const CosmicHeroStage: React.FC<CosmicHeroStageProps> = ({ state, onOpenAuth }) => {
  const [now, setNow] = useState<Date>(() => new Date());

  // Sync with live system clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Compute the 7 days (Monday -> Sunday) of the current live week
  const weekDays = useMemo(() => {
    const current = new Date(now);
    const jsDay = current.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
    const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(current);
    monday.setDate(current.getDate() + mondayOffset);

    return DAY_LABELS.map((label, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      return {
        day: label,
        dateNum: String(d.getDate()),
        fullDate: d,
        formattedNote: formatFullLiveDate(d),
        summary: DAILY_SUMMARIES[idx % DAILY_SUMMARIES.length],
        isToday,
      };
    });
  }, [now]);

  const todayIndex = useMemo(() => {
    const idx = weekDays.findIndex((d) => d.isToday);
    return idx >= 0 ? idx : 0;
  }, [weekDays]);

  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(todayIndex);

  useEffect(() => {
    setSelectedDayIdx(todayIndex);
  }, [todayIndex]);

  const selectedDay = weekDays[selectedDayIdx] || weekDays[todayIndex];

  const monthYearHeader = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(selectedDay.fullDate);
  }, [selectedDay]);

  const totalUsdc = state
    ? formatBaseUnitsToDecimal(state.balancesBaseUnits.USDC || '0', 6)
    : '124,750.00';
  const remainingDaily = state
    ? formatBaseUnitsToDecimal(state.spendingUsage.remainingAvailableBaseUnits || '0', 6)
    : '1,430.00';

  return (
    <section className="relative w-full overflow-hidden pt-12 pb-16 px-4 sm:px-8 select-none">
      {/* Deep Cosmic Background & Subtle Concentric Radar Rings */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 54%, rgba(139, 92, 246, 0.22) 0%, rgba(76, 29, 149, 0.1) 36%, rgba(5, 2, 13, 0) 70%)',
        }}
      />

      {/* Starfield Specks */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {STAR_COORDS.map((star, idx) => (
          <span
            key={idx}
            className="absolute rounded-full bg-purple-100"
            style={{
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              boxShadow: '0 0 6px rgba(216, 180, 254, 0.8)',
            }}
          />
        ))}
      </div>

      {/* Centered Hero Copy Stack */}
      <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center pt-6 pb-8">
        {/* Monumental 2-Line Headline */}
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08] bg-gradient-to-b from-white via-white to-purple-200/85 bg-clip-text text-transparent mb-4">
          Think &amp; settle safer
          <br />
          with VaultGuard
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-[#A89EC4] max-w-xl font-normal tracking-wide">
          Never miss an invoice anomaly, prompt injection, or unauthorized treasury transfer.
        </p>
      </div>

      {/* THE SINGULARITY EVENT-HORIZON ARC & RISING GLASSMORPHIC LIVE-DATE CALENDAR CARD */}
      <div className="relative max-w-4xl mx-auto mt-2">
        {/* Radiant Purple Black-Hole / Event-Horizon Light Sculpture */}
        <div
          className="relative w-full h-44 sm:h-52 flex items-end justify-center pointer-events-none"
          aria-hidden="true"
        >
          {/* Outer Ambient Violet Aura */}
          <div
            className="absolute bottom-0 w-[520px] sm:w-[720px] h-[240px] rounded-t-full blur-3xl opacity-90"
            style={{
              background:
                'radial-gradient(ellipse at 50% 100%, #E9D5FF 0%, #A855F7 32%, #581C87 65%, transparent 100%)',
            }}
          />

          {/* Secondary Concentric Swirl Halo */}
          <div
            className="absolute bottom-0 w-[320px] sm:w-[410px] h-[175px] rounded-t-full blur-xl opacity-95"
            style={{
              background:
                'radial-gradient(ellipse at 50% 100%, #FFFFFF 0%, #F3E8FF 40%, #A855F7 72%, transparent 100%)',
            }}
          />

          {/* Luminous White-Violet Plasma Arch Ring */}
          <div
            className="relative bottom-0 w-[220px] sm:w-[270px] h-[118px] sm:h-[138px] rounded-t-full"
            style={{
              background:
                'radial-gradient(circle at 50% 100%, #2E1065 0%, #6B21A8 42%, #D8B4FE 74%, #FFFFFF 92%, #E9D5FF 100%)',
              boxShadow:
                '0 -10px 35px rgba(255, 255, 255, 0.95), 0 -24px 75px rgba(168, 85, 247, 0.95)',
            }}
          >
            {/* Inner Dark Singularity Core */}
            <div
              className="absolute inset-x-6 bottom-0 h-[84px] sm:h-[98px] rounded-t-full blur-[1px]"
              style={{
                background:
                  'radial-gradient(circle at 50% 100%, #190733 0%, #4C1D95 62%, #A855F7 100%)',
              }}
            />
          </div>

          {/* Seamless Horizontal Accretion Light-Beam Flare Across the Horizon */}
          <div
            className="absolute bottom-[2px] w-full max-w-3xl h-[4px] rounded-full blur-[1px]"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(168,85,247,0) 8%, rgba(192,132,252,0.75) 32%, #FFFFFF 50%, rgba(192,132,252,0.75) 68%, rgba(168,85,247,0) 92%, transparent 100%)',
            }}
          />
          <div
            className="absolute bottom-[-6px] w-full max-w-3xl h-7 rounded-full blur-xl opacity-85"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(147,51,234,0) 10%, rgba(168,85,247,0.85) 35%, #FFFFFF 50%, rgba(168,85,247,0.85) 65%, rgba(147,51,234,0) 90%, transparent 100%)',
            }}
          />
        </div>

        {/* RISING GLASSMORPHIC LIVE CALENDAR CARD */}
        <div
          className="relative z-20 -mt-2 mx-auto max-w-2xl rounded-2xl border border-purple-300/25 bg-[#0B061A]/90 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_-15px_70px_rgba(139,92,246,0.35)]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.24) 0%, rgba(11, 6, 26, 0.94) 55%)',
          }}
        >
          {/* Card Header: Glowing Purple Avatar + Live Month/Year Title + Plus Action */}
          <div className="flex items-center justify-between pb-5">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              title="Sign in to VaultGuard Workspace"
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-700 via-fuchsia-500 to-indigo-300 p-0.5 shadow-[0_0_18px_rgba(168,85,247,0.65)] hover:scale-105 transition-transform cursor-pointer flex items-center justify-center"
            >
              <div className="w-full h-full rounded-full bg-[#150934] flex items-center justify-center text-xs font-bold text-purple-200">
                VG
              </div>
            </button>

            <div className="text-center">
              <div className="text-sm sm:text-base font-semibold text-white tracking-tight">
                {monthYearHeader}
              </div>
              <div className="text-[11px] font-mono text-purple-300/80">
                USDC Vault: ${totalUsdc} · Daily Avail: ${remainingDaily}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              title="Sign in to submit or inspect invoices"
              aria-label="Sign in to submit or inspect invoices"
              className="w-8 h-8 rounded-lg text-purple-200/80 hover:text-white hover:bg-purple-500/20 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* 7-Day Live Week Calendar Strip (Synced with Current Real Week) */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center pb-5 border-b border-purple-400/15">
            {weekDays.map((d, idx) => {
              const isSelected = idx === selectedDayIdx;
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setSelectedDayIdx(idx)}
                  className="group flex flex-col items-center gap-2 py-1 rounded-xl cursor-pointer transition-all"
                >
                  <span className="text-[11px] font-medium text-[#7C719B] group-hover:text-purple-200">
                    {d.day}
                  </span>
                  <span
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xs font-semibold font-mono transition-all ${
                      isSelected
                        ? 'bg-[#7C3AED] text-white shadow-[0_0_20px_rgba(139,92,246,0.75)] scale-105'
                        : 'text-[#8E84AD] hover:bg-purple-500/15 hover:text-white'
                    }`}
                  >
                    {d.dateNum}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Daily Treasury Journal Entry (Synced with Live Date) */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-1 h-5 rounded-full bg-purple-500 shadow-[0_0_10px_#A855F7]" />
                <span className="text-sm sm:text-base font-semibold text-purple-100">
                  {selectedDay.formattedNote}
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 42/42 Security Gates Active
              </span>
            </div>

            <p className="text-xs text-[#B3A8D1] pl-3.5 leading-relaxed">
              {selectedDay.summary}
            </p>

            {/* Live Preview Cards (Clicking prompts Login to enter Dashboard) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="p-2.5 rounded-xl bg-[#140B2E]/90 border border-purple-400/20 hover:border-purple-400/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> INV-001 SETTLED
                  </span>
                  <ArrowRight className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-semibold text-white mt-0.5 font-mono">
                  $250.00 USDC → Base
                </div>
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="p-2.5 rounded-xl bg-[#140B2E]/90 border border-purple-400/20 hover:border-purple-400/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-amber-300">
                  <span>INV-002 RESERVED</span>
                  <ArrowRight className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-semibold text-white mt-0.5 font-mono">
                  $320.00 USDC → Arbitrum
                </div>
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="p-2.5 rounded-xl bg-[#140B2E]/90 border border-rose-500/30 hover:border-rose-400/60 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-rose-400">
                  <span className="flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> ATTACK BLOCKED
                  </span>
                  <ArrowRight className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-semibold text-white mt-0.5 font-mono">
                  $10,000 Prompt Injection
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

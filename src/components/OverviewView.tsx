import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatBaseUnitsToDecimal } from '../../packages/shared/constants';
import { ActiveTab, AppStateBundle } from '../types/api';

interface OverviewViewProps {
  state: AppStateBundle;
  onNavigate: (tab: ActiveTab) => void;
  onOpenDemo: () => void;
  onSelectInvoice: (invoiceId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  state,
  onNavigate,
  onOpenDemo,
  onSelectInvoice,
}) => {
  const usdcBalance = formatBaseUnitsToDecimal(state.balancesBaseUnits.USDC || '0', 6);
  const usdtBalance = formatBaseUnitsToDecimal(state.balancesBaseUnits.USDT || '0', 6);
  const dailyLimit = formatBaseUnitsToDecimal(state.spendingUsage.dailyLimitBaseUnits, 6);
  const dailyUsed = formatBaseUnitsToDecimal(state.spendingUsage.dailyUsedBaseUnits, 6);
  const activeReserved = formatBaseUnitsToDecimal(state.spendingUsage.activeReservedBaseUnits, 6);
  const remainingAllowance = formatBaseUnitsToDecimal(
    state.spendingUsage.remainingAvailableBaseUnits,
    6
  );

  const settledCount = state.invoices.filter((i) => i.state === 'SETTLED').length;
  const reservedCount = state.invoices.filter(
    (i) => i.state === 'RESERVED' || i.state === 'POLICY_APPROVED' || i.state === 'QUOTE_RECEIVED'
  ).length;
  const blockedCount = state.invoices.filter((i) => i.state === 'REJECTED').length;
  const activeVendorsCount = state.vendors.filter((v) => v.status === 'ACTIVE').length;

  const limitNum = Number(dailyLimit) || 2000;
  const usedPct = Math.min(100, (Number(dailyUsed) / limitNum) * 100);
  const reservedPct = Math.min(100 - usedPct, (Number(activeReserved) / limitNum) * 100);

  return (
    <div className="space-y-8">
      {/* Top Executive Banner */}
      <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-mono text-[#00EC97] tracking-wide">
            NEAR PROTOCOL · PRIVATE AI VERIFICATION · TRUSTLESS SPENDING CONTROLS
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Autonomous B2B Treasury Guardrail Engine
          </h1>
          <p className="text-sm text-[#A7B0AC] leading-relaxed">
            AI privately interprets vendor invoices and GitHub proof-of-work. A deterministic NEAR
            smart contract independently verifies Ed25519 attestations, enforces atomic spending
            caps, and orchestrates cross-chain settlement through NEAR Intents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={onOpenDemo}
            className="px-4 py-2.5 bg-[#00EC97] hover:bg-[#70FFC5] text-[#080B0A] font-semibold text-sm rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Run 60s Live Demo
          </button>
          <button
            onClick={() => onNavigate('invoices')}
            className="px-4 py-2.5 bg-[#202824] hover:bg-[#28322D] text-white font-medium text-sm rounded-lg border border-white/[0.08] transition-colors whitespace-nowrap cursor-pointer"
          >
            Submit / Inspect Invoices
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-5 space-y-2">
          <div className="text-xs text-[#A7B0AC]">Treasury Custody Balance</div>
          <div className="text-xl xl:text-2xl font-bold font-mono tabular-nums text-white whitespace-nowrap">
            ${Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
          </div>
          <div className="text-xs text-[#727D77] font-mono tabular-nums truncate">
            + ${Number(usdtBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT ·{' '}
            {state.policy.treasuryCustodyAccount}
          </div>
        </div>

        <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-5 space-y-2">
          <div className="text-xs text-[#A7B0AC]">Daily Spending & Allowance</div>
          <div className="text-xl xl:text-2xl font-bold font-mono tabular-nums text-[#00EC97] whitespace-nowrap">
            ${remainingAllowance} USDC
          </div>
          <div className="text-xs text-[#727D77] font-mono tabular-nums truncate">
            Used: ${dailyUsed} · Reserved: ${activeReserved} / ${dailyLimit}
          </div>
        </div>

        <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-5 space-y-2">
          <div className="text-xs text-[#A7B0AC]">Approved & Settled Invoices</div>
          <div className="text-xl xl:text-2xl font-bold font-mono tabular-nums text-[#00EC97] whitespace-nowrap">
            {settledCount} Settled · {reservedCount} Reserved
          </div>
          <div className="text-xs text-[#727D77] truncate">
            {activeVendorsCount} Active Whitelisted Vendors · Policy v{state.policy.policyVersion}
          </div>
        </div>

        <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-5 space-y-2">
          <div className="text-xs text-[#A7B0AC]">Blocked Malicious & Adversarial</div>
          <div className="text-xl xl:text-2xl font-bold font-mono tabular-nums text-[#FF5C68] whitespace-nowrap">
            {blockedCount} Blocked · {state.gateSummary.passedAttacks}/42 Gates
          </div>
          <div className="text-xs text-[#727D77] truncate">
            $0.00 Unauthorized Transfers ·{' '}
            {state.policy.emergencyPaused ? 'PAUSED' : 'Contract Nominal'}
          </div>
        </div>
      </div>

      {/* Daily Spend Capacity Meter & Architecture Trust Separation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                24-Hour Onchain Spending Capacity & Atomic Reservations
              </h2>
              <p className="text-xs text-[#A7B0AC] mt-0.5">
                Enforced by {state.policy.policyContractAccount} · Max Single Invoice: $
                {formatBaseUnitsToDecimal(state.policy.maxInvoiceAmountBaseUnits, 6)} USDC
              </p>
            </div>
            <button
              onClick={() => onNavigate('policies')}
              className="text-xs font-medium text-[#00EC97] hover:text-[#70FFC5] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              Configure Policy <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-full h-3 bg-[#0D1210] rounded-full overflow-hidden flex border border-white/[0.08]">
            <div
              style={{ width: `${usedPct}%` }}
              className="bg-[#00EC97] transition-all duration-300"
              title={`Settled Today: $${dailyUsed} USDC`}
            />
            <div
              style={{ width: `${reservedPct}%` }}
              className="bg-[#F5B942] transition-all duration-300"
              title={`Active Reservations: $${activeReserved} USDC`}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/[0.08] text-xs">
            <div>
              <div className="text-[#A7B0AC]">Settled Today</div>
              <div className="text-sm font-mono font-semibold text-[#00EC97] tabular-nums mt-0.5">
                ${dailyUsed} USDC ({usedPct.toFixed(1)}%)
              </div>
            </div>
            <div>
              <div className="text-[#A7B0AC]">Active Reservations</div>
              <div className="text-sm font-mono font-semibold text-[#F5B942] tabular-nums mt-0.5">
                ${activeReserved} USDC ({reservedPct.toFixed(1)}%)
              </div>
            </div>
            <div>
              <div className="text-[#A7B0AC]">Remaining Unreserved</div>
              <div className="text-sm font-mono font-semibold text-white tabular-nums mt-0.5">
                ${remainingAllowance} USDC
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Security Boundaries</h2>
            <button
              onClick={() => onNavigate('security')}
              className="text-xs font-medium text-[#00EC97] hover:text-[#70FFC5] cursor-pointer"
            >
              Security Center
            </button>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
              <div>
                <div className="font-medium text-white">AI Intelligence Layer</div>
                <div className="text-[#A7B0AC]">Zero signing keys · Untrusted PDF isolation</div>
              </div>
              <span className="font-mono text-[#00EC97] shrink-0">ISOLATED</span>
            </div>
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
              <div>
                <div className="font-medium text-white">Restricted Function Call Key</div>
                <div className="text-[#A7B0AC]">4 methods · 0 NEAR transfer allowance</div>
              </div>
              <span className="font-mono text-[#00EC97] shrink-0">
                {state.agentFunctionCallKey.revoked ? 'REVOKED' : 'ENFORCED'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-white">NEAR Intents Mode</div>
                <div className="text-[#A7B0AC]">Destination tx verification mandatory</div>
              </div>
              <span className="font-mono text-[#83DCFF] uppercase shrink-0">
                {state.paymentMode}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices & Live Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#171D1B] border border-white/[0.08] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Invoice Verification Queue</h2>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-medium text-[#00EC97] hover:text-[#70FFC5] cursor-pointer"
            >
              View All ({state.invoices.length})
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-[#A7B0AC]">
                  <th className="py-3 px-4 font-medium">Invoice</th>
                  <th className="py-3 px-4 font-medium">Vendor</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium">Chain · PO</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08] text-sm">
                {state.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#202824]/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-white whitespace-nowrap">
                      <div>{inv.id}</div>
                      <div className="text-[#727D77]">{inv.invoiceNumber}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#A7B0AC] whitespace-nowrap">
                      {inv.vendorId}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-white whitespace-nowrap">
                      ${inv.amountDecimal} {inv.requestedToken}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#A7B0AC] whitespace-nowrap">
                      {inv.destinationChain} · {inv.purchaseOrderRef}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono whitespace-nowrap">
                      {inv.state === 'SETTLED' && (
                        <span className="text-[#00EC97] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SETTLED
                        </span>
                      )}
                      {inv.state === 'RESERVED' && (
                        <span className="text-[#83DCFF] flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" /> RESERVED
                        </span>
                      )}
                      {inv.state === 'REJECTED' && (
                        <span className="text-[#FF5C68] flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> REJECTED
                        </span>
                      )}
                      {inv.state !== 'SETTLED' &&
                        inv.state !== 'RESERVED' &&
                        inv.state !== 'REJECTED' && (
                          <span className="text-[#F5B942]">{inv.state}</span>
                        )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          onSelectInvoice(inv.id);
                          onNavigate('invoices');
                        }}
                        className="text-xs font-medium text-[#00EC97] hover:text-[#70FFC5] cursor-pointer"
                      >
                        Inspect {inv.id}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Events Feed (Single-elevation with hairline dividers) */}
        <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-base font-semibold text-white">Blocked Security Threats</h2>
            <ShieldCheck className="w-4 h-4 text-[#00EC97]" />
          </div>
          <div className="divide-y divide-white/[0.08]">
            {state.securityEvents.slice(0, 4).map((ev) => (
              <div key={ev.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#FF5C68] font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {ev.errorCode}
                  </span>
                  <span className="text-[#727D77]">BLOCKED</span>
                </div>
                <p className="text-xs text-[#A7B0AC] leading-relaxed">{ev.description}</p>
                <div className="text-[11px] text-[#727D77] font-mono">
                  {ev.category} · {ev.invoiceId || ev.actor}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

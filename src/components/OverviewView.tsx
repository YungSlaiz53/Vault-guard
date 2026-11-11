import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatBaseUnitsToDecimal } from '../../packages/shared/constants';
import { ActiveTab, AppStateBundle } from '../types/api';
import { formatFullLiveDate } from './CosmicHeroStage';
import { InvoicesView } from './InvoicesView';

interface OverviewViewProps {
  state: AppStateBundle;
  selectedInvoiceId: string | null;
  onNavigate: (tab: ActiveTab) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onRefresh: () => Promise<void>;
  liveDate: Date;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  state,
  selectedInvoiceId,
  onNavigate,
  onSelectInvoice,
  onRefresh,
  liveDate,
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
      {/* Top Executive Banner with Live Synced Date */}
      <div className="vg-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-purple-300 tracking-wide">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>{formatFullLiveDate(liveDate)}</span>
            <span className="text-purple-500">·</span>
            <span>NEAR TREASURY GUARDRAIL ENGINE</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Autonomous B2B Treasury Guardrail Engine
          </h1>
          <p className="text-sm text-[#B4A8D4] leading-relaxed">
            AI privately interprets vendor invoices and GitHub proof-of-work. A deterministic NEAR
            smart contract independently verifies Ed25519 attestations, enforces atomic spending
            caps, and orchestrates cross-chain settlement through NEAR Intents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('invoices')}
            className="vg-btn-primary px-4 py-2.5 font-semibold text-sm rounded-xl whitespace-nowrap cursor-pointer"
          >
            Submit / Inspect Invoices
          </button>
        </div>
      </div>

      {/* Primary KPI Grid with Interactive Hover Lift */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('treasury')}
          className="vg-card-interactive p-5 space-y-2 overflow-hidden text-left cursor-pointer"
        >
          <div className="text-xs text-[#B4A8D4]">Treasury Custody Balance</div>
          <div className="text-base xl:text-lg font-bold font-mono tabular-nums text-white whitespace-nowrap">
            ${Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
          </div>
          <div className="text-xs text-[#8E84AD] font-mono tabular-nums truncate">
            + ${Number(usdtBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT ·{' '}
            {state.policy.treasuryCustodyAccount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('policies')}
          className="vg-card-interactive p-5 space-y-2 overflow-hidden text-left cursor-pointer"
        >
          <div className="text-xs text-[#B4A8D4]">Daily Spending & Allowance</div>
          <div className="text-base xl:text-lg font-bold font-mono tabular-nums text-purple-300 whitespace-nowrap">
            ${remainingAllowance} USDC
          </div>
          <div className="text-xs text-[#8E84AD] font-mono tabular-nums truncate">
            Used: ${dailyUsed} · Reserved: ${activeReserved} / ${dailyLimit}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settlements')}
          className="vg-card-interactive p-5 space-y-2 overflow-hidden text-left cursor-pointer"
        >
          <div className="text-xs text-[#B4A8D4]">Approved & Settled Invoices</div>
          <div className="text-base xl:text-lg font-bold font-mono tabular-nums text-emerald-400 whitespace-nowrap">
            {settledCount} Settled · {reservedCount} Active
          </div>
          <div className="text-xs text-[#8E84AD] truncate">
            {activeVendorsCount} Active Whitelisted Vendors · Policy v{state.policy.policyVersion}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('security')}
          className="vg-card-interactive p-5 space-y-2 overflow-hidden text-left cursor-pointer"
        >
          <div className="text-xs text-[#B4A8D4]">Blocked Malicious & Adversarial</div>
          <div className="text-base xl:text-lg font-bold font-mono tabular-nums text-rose-400 whitespace-nowrap">
            {blockedCount} Blocked · {state.gateSummary.passedAttacks}/42 Pass
          </div>
          <div className="text-xs text-[#8E84AD] truncate">
            $0.00 Unauthorized Transfers ·{' '}
            {state.policy.emergencyPaused ? 'PAUSED' : 'Contract Nominal'}
          </div>
        </button>
      </div>

      {/* Submit Vendor Invoice & 5-Step Cryptographic Verification Pipeline (Inside Dashboard After Login) */}
      <InvoicesView
        state={state}
        selectedInvoiceId={selectedInvoiceId}
        onSelectInvoice={onSelectInvoice}
        onRefresh={onRefresh}
        onNavigate={onNavigate}
      />

      {/* Daily Spend Capacity Meter & Architecture Trust Separation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 vg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                24-Hour Onchain Spending Capacity & Atomic Reservations
              </h2>
              <p className="text-xs text-[#B4A8D4] mt-0.5">
                Enforced by {state.policy.policyContractAccount} · Max Single Invoice: $
                {formatBaseUnitsToDecimal(state.policy.maxInvoiceAmountBaseUnits, 6)} USDC
              </p>
            </div>
            <button
              onClick={() => onNavigate('policies')}
              className="group text-xs font-medium text-purple-300 hover:text-white flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
            >
              <span>Configure Policy</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          <div className="w-full h-3 bg-[#080316] rounded-full overflow-hidden flex border border-purple-500/20">
            <div
              style={{ width: `${usedPct}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Settled Today: $${dailyUsed} USDC`}
            />
            <div
              style={{ width: `${reservedPct}%` }}
              className="bg-amber-400 transition-all duration-300"
              title={`Active Reservations: $${activeReserved} USDC`}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-purple-500/15 text-xs">
            <div>
              <div className="text-[#B4A8D4]">Settled Today</div>
              <div className="text-sm font-mono font-semibold text-emerald-400 tabular-nums mt-0.5">
                ${dailyUsed} USDC ({usedPct.toFixed(1)}%)
              </div>
            </div>
            <div>
              <div className="text-[#B4A8D4]">Active Reservations</div>
              <div className="text-sm font-mono font-semibold text-amber-400 tabular-nums mt-0.5">
                ${activeReserved} USDC ({reservedPct.toFixed(1)}%)
              </div>
            </div>
            <div>
              <div className="text-[#B4A8D4]">Remaining Unreserved</div>
              <div className="text-sm font-mono font-semibold text-white tabular-nums mt-0.5">
                ${remainingAllowance} USDC
              </div>
            </div>
          </div>
        </div>

        <div className="vg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Security Boundaries</h2>
            <button
              onClick={() => onNavigate('security')}
              className="text-xs font-medium text-purple-300 hover:text-white transition-colors cursor-pointer"
            >
              Security Center →
            </button>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-purple-500/15">
              <div>
                <div className="font-medium text-white">AI Intelligence Layer</div>
                <div className="text-[#B4A8D4]">Zero signing keys · Untrusted PDF isolation</div>
              </div>
              <span className="font-mono text-emerald-400 shrink-0">ISOLATED</span>
            </div>
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-purple-500/15">
              <div>
                <div className="font-medium text-white">Restricted Function Call Key</div>
                <div className="text-[#B4A8D4]">4 methods · 0 NEAR transfer allowance</div>
              </div>
              <span className="font-mono text-emerald-400 shrink-0">
                {state.agentFunctionCallKey.revoked ? 'REVOKED' : 'ENFORCED'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-white">NEAR Intents Mode</div>
                <div className="text-[#B4A8D4]">Destination tx verification mandatory</div>
              </div>
              <span className="font-mono text-purple-300 uppercase shrink-0">
                {state.paymentMode}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices & Live Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 vg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-500/15 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Invoice Verification Queue</h2>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-medium text-purple-300 hover:text-white transition-colors cursor-pointer"
            >
              View All ({state.invoices.length}) →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-purple-500/15 text-xs text-[#B4A8D4]">
                  <th className="py-3 px-3 font-medium">Invoice</th>
                  <th className="py-3 px-3 font-medium">Vendor</th>
                  <th className="py-3 px-3 font-medium text-right">Amount</th>
                  <th className="py-3 px-3 font-medium">Chain · PO</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/15 text-sm">
                {state.invoices.map((inv) => (
                  <tr key={inv.id} className="vg-row-hover">
                    <td className="py-3 px-3 font-mono text-xs text-white whitespace-nowrap">
                      <div>{inv.id}</div>
                      <div className="text-[#8E84AD]">{inv.invoiceNumber}</div>
                    </td>
                    <td className="py-3 px-3 text-xs text-purple-100 whitespace-nowrap">
                      {inv.vendorId}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-white whitespace-nowrap">
                      ${inv.amountDecimal} {inv.requestedToken}
                    </td>
                    <td className="py-3 px-3 text-xs text-[#B4A8D4] whitespace-nowrap">
                      {inv.destinationChain} · {inv.purchaseOrderRef}
                    </td>
                    <td className="py-3 px-3 text-xs font-mono whitespace-nowrap">
                      {inv.state === 'SETTLED' && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SETTLED
                        </span>
                      )}
                      {inv.state === 'RESERVED' && (
                        <span className="text-purple-300 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" /> RESERVED
                        </span>
                      )}
                      {inv.state === 'REJECTED' && (
                        <span className="text-rose-400 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> REJECTED
                        </span>
                      )}
                      {inv.state !== 'SETTLED' &&
                        inv.state !== 'RESERVED' &&
                        inv.state !== 'REJECTED' && (
                          <span className="text-amber-400">{inv.state}</span>
                        )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        aria-label={`Inspect ${inv.id}`}
                        onClick={() => {
                          onSelectInvoice(inv.id);
                        }}
                        className="group text-xs font-medium text-purple-300 hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Inspect</span>
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Events Feed */}
        <div className="vg-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-purple-500/15 pb-3">
            <h2 className="text-base font-semibold text-white">Blocked Security Threats</h2>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="divide-y divide-purple-500/15">
            {state.securityEvents.slice(0, 4).map((ev) => (
              <div
                key={ev.id}
                className="py-3 first:pt-0 last:pb-0 space-y-1.5 rounded px-1.5 -mx-1.5 transition-colors hover:bg-purple-500/[0.08]"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {ev.errorCode}
                  </span>
                  <span className="text-[#8E84AD]">BLOCKED</span>
                </div>
                <p className="text-xs text-purple-100 leading-relaxed">{ev.description}</p>
                <div className="text-[11px] text-[#8E84AD] font-mono">
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

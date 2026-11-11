import React, { useState } from 'react';
import { ArrowRightLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatBaseUnitsToDecimal } from '../../packages/shared/constants';
import { apiRequest, AppStateBundle, IntentsQuote, SettlementRecord } from '../types/api';

interface SettlementsViewProps {
  state: AppStateBundle;
  onRefresh: () => Promise<void>;
}

export const SettlementsView: React.FC<SettlementsViewProps> = ({ state, onRefresh }) => {
  const reservedInvoices = state.invoices.filter(
    (i) => i.state === 'RESERVED' || i.state === 'QUOTE_RECEIVED'
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    reservedInvoices[0]?.id || ''
  );
  const [slippageBps, setSlippageBps] = useState('20');
  const [activeQuote, setActiveQuote] = useState<IntentsQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRequestQuote = async (invoiceId: string) => {
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ quote: IntentsQuote }>('/api/settlements/quote', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId,
          slippageBps: Number(slippageBps),
        }),
      });
      setActiveQuote(res.quote);
      await onRefresh();
      setStatusMsg(
        `Generated 1Click Quote ${res.quote.quoteId} bound to deposit address ${res.quote.depositAddress}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Quote request failed');
    } finally {
      setBusy(false);
    }
  };

  const handleExecuteSettlement = async () => {
    if (!activeQuote) return;
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ settlement: SettlementRecord }>('/api/settlements/execute', {
        method: 'POST',
        callerAccount: 'ai-executor.vaultguard.testnet',
        body: JSON.stringify({
          invoiceId: activeQuote.invoiceId,
          quoteId: activeQuote.quoteId,
          idempotencyKey: `idem-${activeQuote.quoteId}`,
        }),
      });
      setActiveQuote(null);
      await onRefresh();
      setStatusMsg(
        `Settlement ${res.settlement.settlementId} verified on ${res.settlement.destinationChain}: ${res.settlement.destinationTxHash}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Settlement execution failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Mode Banner */}
      <div className="vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-indigo-400">
            NEAR INTENTS · 1CLICK CROSS-CHAIN SETTLEMENT ORCHESTRATOR
          </div>
          <h2 className="text-lg font-bold text-white">
            Active Payment Mode: {state.paymentMode.toUpperCase()} (Deterministic Local Simulation)
          </h2>
          <p className="text-xs text-slate-400">
            NEAR Intents has no public testnet. Local Simulation exercises every real quote,
            slippage, deposit-address, and destination verification check with clearly labelled{' '}
            <code className="text-sky-400">sim-dest-tx-*</code> receipts. Mainnet mode is disabled
            by default and requires explicit human signature per transaction.
          </p>
        </div>
        <ArrowRightLeft className="w-6 h-6 text-indigo-400 shrink-0" />
      </div>

      {/* Quote & Execution Orchestrator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-white">
            Orchestrate Cross-Chain Settlement
          </h3>

          {reservedInvoices.length === 0 ? (
            <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400">
              No currently RESERVED invoices awaiting settlement. Submit and authorize a new invoice
              in the Invoices tab first.
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="set-inv" className="block text-slate-400 mb-1">
                  Select Authorized & Reserved Invoice
                </label>
                <select
                  id="set-inv"
                  value={selectedInvoiceId || reservedInvoices[0]?.id}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800/80 rounded-md text-white font-mono"
                >
                  {reservedInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.id} — ${inv.amountDecimal} {inv.requestedToken} to {inv.destinationChain}{' '}
                      ({inv.reservationId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="set-slip" className="block text-slate-400 mb-1">
                  Requested Slippage Tolerance (bps, Max Policy = {state.policy.maxSlippageBps} bps)
                </label>
                <input
                  id="set-slip"
                  type="number"
                  value={slippageBps}
                  onChange={(e) => setSlippageBps(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800/80 rounded-md text-white font-mono tabular-nums"
                />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleRequestQuote(selectedInvoiceId || reservedInvoices[0].id)}
                className="vg-btn-secondary w-full py-2.5 px-4 bg-[#1A243B] hover:bg-[#222F4D] text-white font-semibold rounded-lg border border-slate-700/70 hover:border-indigo-500/40 cursor-pointer"
              >
                1. Request & Verify 1Click Quote
              </button>

              {activeQuote && (
                <div className="pt-4 border-t border-slate-800/80 space-y-2 font-mono">
                  <div className="text-emerald-400 font-semibold">
                    Verified Quote: {activeQuote.quoteId}
                  </div>
                  <div className="text-slate-400">Source Asset: {activeQuote.sourceAssetId}</div>
                  <div className="text-slate-400">
                    Destination Asset: {activeQuote.destinationAssetId}
                  </div>
                  <div className="text-white">
                    Amount In: ${formatBaseUnitsToDecimal(activeQuote.amountInBaseUnits, 6)} → Out: $
                    {formatBaseUnitsToDecimal(activeQuote.amountOutBaseUnits, 6)} (
                    {activeQuote.slippageBps} bps)
                  </div>
                  <div className="text-slate-500 break-all">
                    1Click Deposit Address: {activeQuote.depositAddress}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleExecuteSettlement}
                    className="vg-btn-primary w-full mt-2 py-2.5 px-4 bg-indigo-500 hover:bg-indigo-400 text-white font-sans font-semibold rounded-lg cursor-pointer shadow-sm shadow-indigo-950/50"
                  >
                    2. Execute Deposit & Verify Destination Tx
                  </button>
                </div>
              )}
            </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-lg bg-[#0B0F17] border border-emerald-500/40 text-emerald-400 text-xs font-mono">
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#0B0F17] border border-rose-500/40 text-rose-400 text-xs font-mono flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Completed & Historical Settlements Table */}
        <div className="lg:col-span-7 vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80">
            <h3 className="text-base font-semibold text-white">Cross-Chain Settlement Ledger</h3>
            <p className="text-xs text-slate-400">
              Only marked SETTLED after destination-chain transaction proof is independently
              verified.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs text-slate-400 bg-[#0E1420]/50">
                  <th className="py-3 px-4 font-medium">Settlement · Invoice</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium">Route · Recipient</th>
                  <th className="py-3 px-4 font-medium">Destination Proof</th>
                  <th className="py-3 px-4 font-medium">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs font-mono">
                {state.settlements.map((s) => (
                  <tr key={s.settlementId} className="vg-row-hover">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-white font-semibold">{s.settlementId}</div>
                      <div className="text-slate-400">
                        {s.invoiceId} · Mode: {s.paymentMode}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-white whitespace-nowrap">
                      ${formatBaseUnitsToDecimal(s.amountBaseUnits, 6)} {s.destinationToken}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 break-all max-w-[190px]">
                      <div>NEAR → {s.destinationChain.toUpperCase()}</div>
                      <div className="text-slate-500">{s.recipient}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 break-all max-w-[200px]">
                      <div>{s.destinationTxHash || 'None'}</div>
                      <div className="text-slate-500">Deposit: {s.nearDepositTxHash}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {s.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { FileCheck2, Search } from 'lucide-react';
import { formatBaseUnitsToDecimal } from '../../packages/shared/constants';
import { AppStateBundle } from '../types/api';

interface AuditViewProps {
  state: AppStateBundle;
}

export const AuditView: React.FC<AuditViewProps> = ({ state }) => {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('ALL');

  const filtered = state.auditEvents.filter((ev) => {
    const matchesState = stateFilter === 'ALL' || ev.settlementState === stateFilter;
    const q = query.trim().toLowerCase();
    if (!q) return matchesState;
    return (
      matchesState &&
      (ev.invoiceId.toLowerCase().includes(q) ||
        ev.invoiceHash.toLowerCase().includes(q) ||
        ev.vendorId.toLowerCase().includes(q) ||
        ev.action.toLowerCase().includes(q) ||
        (ev.reservationId && ev.reservationId.toLowerCase().includes(q)) ||
        (ev.txHash && ev.txHash.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="space-y-6">
      <div className="vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            Cryptographic Onchain & Offchain Audit Ledger
          </h2>
          <p className="text-xs text-slate-400">
            Full lifecycle traceability binding SHA-256 invoice hashes, Ed25519 attestation nonces,
            reservations, and settlement receipts while keeping confidential documents offchain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search audit records"
              placeholder="Search hash, invoice, vendor..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#0B0F17] border border-slate-800/80 rounded-md text-xs text-white font-mono w-64"
            />
          </div>

          <select
            aria-label="Filter audit records by state"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#0B0F17] border border-slate-800/80 rounded-md text-xs text-white font-mono"
          >
            <option value="ALL">All States</option>
            <option value="SETTLED">SETTLED</option>
            <option value="RESERVED">RESERVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="SUBMITTED">SUBMITTED</option>
          </select>
        </div>
      </div>

      <div className="vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-xs text-slate-400 bg-[#0E1420]/50">
                <th className="py-3 px-4 font-medium">Audit ID · Time</th>
                <th className="py-3 px-4 font-medium">Invoice · SHA-256 Hash</th>
                <th className="py-3 px-4 font-medium">Vendor · Recipient</th>
                <th className="py-3 px-4 font-medium text-right">Amount</th>
                <th className="py-3 px-4 font-medium">Attestation · Reservation</th>
                <th className="py-3 px-4 font-medium">Action · Settlement Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filtered.map((ev) => (
                  <tr key={ev.id} className="vg-row-hover">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-white flex items-center gap-1">
                        <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" /> {ev.id}
                      </div>
                      <div className="text-slate-500">{ev.timestamp.slice(0, 19)}Z</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-white font-semibold">
                        {ev.invoiceId} (Policy v{ev.policyVersion})
                      </div>
                      <div className="text-slate-500">{ev.invoiceHash.slice(0, 20)}...</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      <div>
                        {ev.vendorId} → {ev.destinationChain.toUpperCase()}
                      </div>
                      <div className="text-slate-500">{ev.recipient.slice(0, 22)}...</div>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-white whitespace-nowrap">
                      ${formatBaseUnitsToDecimal(ev.amountBaseUnits, 6)} {ev.token}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      <div>Nonce: {ev.attestationNonce || 'none'}</div>
                      <div className="text-slate-500">Res: {ev.reservationId || 'none'}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div
                        className={
                          ev.settlementState === 'REJECTED'
                            ? 'text-rose-400 font-semibold'
                            : ev.settlementState === 'SETTLED'
                              ? 'text-emerald-400 font-semibold'
                              : 'text-sky-400 font-semibold'
                        }
                      >
                        {ev.action}
                      </div>
                      <div className="text-slate-500">
                        {ev.txHash ? `Tx: ${ev.txHash}` : `Actor: ${ev.actor}`}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

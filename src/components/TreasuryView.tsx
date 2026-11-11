import React, { useState } from 'react';
import { Landmark, Lock, Unlock } from 'lucide-react';
import { formatBaseUnitsToDecimal } from '../../packages/shared/constants';
import { apiRequest, AppStateBundle } from '../types/api';

interface TreasuryViewProps {
  state: AppStateBundle;
  callerAccount: string;
  onRefresh: () => Promise<void>;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({ state, callerAccount, onRefresh }) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReleaseReservation = async (reservationId: string) => {
    setFeedback(null);
    setErrorMsg(null);
    try {
      await apiRequest(`/api/treasury/reservations/${reservationId}/release`, {
        method: 'POST',
        callerAccount,
        body: JSON.stringify({ reason: 'Released via Treasury Custody console' }),
      });
      await onRefresh();
      setFeedback(`Released reservation ${reservationId} and restored daily spending capacity.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to release reservation');
    }
  };

  return (
    <div className="space-y-8">
      {/* Custody Separation Matrix */}
      <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Four-Layer Treasury Custody & Authorization Separation
            </h2>
            <p className="text-xs text-[#A7B0AC]">
              VaultGuard strictly separates policy evaluation, asset custody, restricted execution,
              and destination settlement verification.
            </p>
          </div>
          <Landmark className="w-5 h-5 text-[#00EC97]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs font-mono divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
          <div className="pt-3 md:pt-0 md:pr-4 space-y-1.5">
            <div className="text-[#83DCFF] font-semibold">1. Policy Authority</div>
            <div className="text-white break-all">{state.policy.policyContractAccount}</div>
            <div className="text-[#A7B0AC] font-sans leading-relaxed">
              Verifies Ed25519 attestations & issues bounded reservations. Holds 0 fungible tokens.
            </div>
          </div>
          <div className="pt-3 md:pt-0 md:px-4 space-y-1.5">
            <div className="text-[#00EC97] font-semibold">2. Asset Custody</div>
            <div className="text-white break-all">{state.policy.treasuryCustodyAccount}</div>
            <div className="text-[#A7B0AC] font-sans leading-relaxed">
              Holds USDC/USDT reserves. Releases funds ONLY against an active bounded contract
              authorization.
            </div>
          </div>
          <div className="pt-3 md:pt-0 md:px-4 space-y-1.5">
            <div className="text-[#F5B942] font-semibold">3. Restricted Executor</div>
            <div className="text-white break-all">{state.agentFunctionCallKey.accountId}</div>
            <div className="text-[#A7B0AC] font-sans leading-relaxed">
              Uses restricted Function Call Key. Cannot alter recipient, amount, chain, or deposit
              address.
            </div>
          </div>
          <div className="pt-3 md:pt-0 md:pl-4 space-y-1.5">
            <div className="text-white font-semibold">4. Treasury Admin</div>
            <div className="text-white break-all">{state.policy.treasuryAdminAccount}</div>
            <div className="text-[#A7B0AC] font-sans leading-relaxed">
              Controls vendor registry, policy caps, emergency pause, and mainnet human confirmation.
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-[#0D1210] border border-[#00EC97]/40 text-[#00EC97] text-xs font-mono">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-[#0D1210] border border-[#FF5C68]/40 text-[#FF5C68] text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {/* Active & Historical Atomic Spending Reservations */}
      <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Atomic Onchain Spending Reservations
            </h2>
            <p className="text-xs text-[#A7B0AC]">
              Each reservation locks daily spending capacity atomically to prevent concurrent
              race-condition overspending.
            </p>
          </div>
          <Lock className="w-4 h-4 text-[#00EC97]" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs text-[#A7B0AC]">
                <th className="py-3 px-4 font-medium">Reservation ID</th>
                <th className="py-3 px-4 font-medium">Invoice · Vendor</th>
                <th className="py-3 px-4 font-medium text-right">Amount</th>
                <th className="py-3 px-4 font-medium">Bounded Recipient · Chain</th>
                <th className="py-3 px-4 font-medium">Execution Nonce</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08] text-xs font-mono">
              {state.reservations.map((res) => (
                <tr key={res.reservationId} className="hover:bg-[#202824]/60">
                  <td className="py-3.5 px-4 text-white whitespace-nowrap">{res.reservationId}</td>
                  <td className="py-3.5 px-4 text-[#A7B0AC] whitespace-nowrap">
                    {res.invoiceId} · {res.vendorId}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-white whitespace-nowrap">
                    ${formatBaseUnitsToDecimal(res.amountBaseUnits, 6)} {res.token}
                  </td>
                  <td className="py-3.5 px-4 text-[#727D77] break-all max-w-[220px]">
                    {res.recipient} ({res.destinationChain})
                  </td>
                  <td className="py-3.5 px-4 text-[#727D77] whitespace-nowrap">
                    {res.executionNonce}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={
                        res.status === 'CONSUMED'
                          ? 'text-[#00EC97]'
                          : res.status === 'ACTIVE'
                            ? 'text-[#F5B942]'
                            : 'text-[#727D77]'
                      }
                    >
                      {res.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    {res.status === 'ACTIVE' ? (
                      <button
                        onClick={() => handleReleaseReservation(res.reservationId)}
                        className="px-2.5 py-1 bg-[#202824] hover:bg-[#28322D] text-white rounded border border-white/[0.08] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Unlock className="w-3 h-3 text-[#00EC97]" /> Release
                      </button>
                    ) : (
                      <span className="text-[#727D77]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

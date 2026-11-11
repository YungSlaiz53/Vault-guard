import React, { useState } from 'react';
import { KeyRound, Lock, PauseOctagon, PlayCircle, ShieldCheck } from 'lucide-react';
import { formatBaseUnitsToDecimal } from '../../packages/shared/constants';
import { apiRequest, AppStateBundle } from '../types/api';

interface PoliciesViewProps {
  state: AppStateBundle;
  callerAccount: string;
  onRefresh: () => Promise<void>;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({ state, callerAccount, onRefresh }) => {
  const [maxInvoice, setMaxInvoice] = useState(
    formatBaseUnitsToDecimal(state.policy.maxInvoiceAmountBaseUnits, 6)
  );
  const [dailyLimit, setDailyLimit] = useState(
    formatBaseUnitsToDecimal(state.policy.dailySpendLimitBaseUnits, 6)
  );
  const [slippageBps, setSlippageBps] = useState(String(state.policy.maxSlippageBps));
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await apiRequest('/api/policies', {
        method: 'PATCH',
        callerAccount,
        body: JSON.stringify({
          maxInvoiceAmountDecimal: maxInvoice,
          dailySpendLimitDecimal: dailyLimit,
          maxSlippageBps: Number(slippageBps),
        }),
      });
      await onRefresh();
      setStatusMsg('Updated onchain spending policy parameters and incremented policy version.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Policy update failed');
    }
  };

  const handleToggleEmergencyPause = async () => {
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await apiRequest('/api/policies', {
        method: 'PATCH',
        callerAccount,
        body: JSON.stringify({
          emergencyPaused: !state.policy.emergencyPaused,
        }),
      });
      await onRefresh();
      setStatusMsg(
        !state.policy.emergencyPaused
          ? 'Emergency Pause ACTIVATED on NEAR contract. All authorizations and settlements halted.'
          : 'Operations RESUMED on NEAR contract.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Emergency pause toggle failed');
    }
  };

  const handleToggleFunctionCallKey = async () => {
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await apiRequest('/api/keys/agent/toggle', {
        method: 'POST',
        callerAccount,
      });
      await onRefresh();
      setStatusMsg(
        state.agentFunctionCallKey.revoked
          ? 'Restored AI Agent restricted Function Call Key.'
          : 'Revoked AI Agent restricted Function Call Key.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Function Call Key operation failed');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Policy Configuration Form */}
        <div className="lg:col-span-6 bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Onchain Spending Policy (v{state.policy.policyVersion})
              </h2>
              <p className="text-xs text-[#A7B0AC]">
                Contract: {state.policy.policyContractAccount} · Integer Base Units (6 decimals)
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#00EC97]" />
          </div>

          <form onSubmit={handleUpdatePolicy} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="pol-max" className="block text-[#A7B0AC] mb-1">
                  Max Single Invoice (USDC)
                </label>
                <input
                  id="pol-max"
                  type="text"
                  value={maxInvoice}
                  onChange={(e) => setMaxInvoice(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0D1210] border border-white/[0.08] rounded-md text-white font-mono tabular-nums"
                />
                <div className="text-[11px] text-[#727D77] font-mono mt-1">
                  Base units: {state.policy.maxInvoiceAmountBaseUnits}
                </div>
              </div>
              <div>
                <label htmlFor="pol-daily" className="block text-[#A7B0AC] mb-1">
                  24h Daily Spending Limit (USDC)
                </label>
                <input
                  id="pol-daily"
                  type="text"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0D1210] border border-white/[0.08] rounded-md text-white font-mono tabular-nums"
                />
                <div className="text-[11px] text-[#727D77] font-mono mt-1">
                  Base units: {state.policy.dailySpendLimitBaseUnits}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="pol-slippage" className="block text-[#A7B0AC] mb-1">
                Max Permitted 1Click Quote Slippage (Basis Points, 50 bps = 0.50%)
              </label>
              <input
                id="pol-slippage"
                type="number"
                value={slippageBps}
                onChange={(e) => setSlippageBps(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D1210] border border-white/[0.08] rounded-md text-white font-mono tabular-nums"
              />
            </div>

            <div className="pt-2 border-t border-white/[0.08] space-y-1.5 font-mono">
              <div className="text-[#A7B0AC]">
                Approved Destination Chains: <span className="text-white">{state.policy.approvedChains.join(' · ')}</span>
              </div>
              <div className="text-[#A7B0AC]">
                Approved Tokens: <span className="text-white">{state.policy.approvedTokens.join(' · ')}</span>
              </div>
              <div className="text-[#727D77] break-all">
                Trusted Verifier Ed25519 Key: {state.policy.trustedVerifierPublicKeys[0]}
              </div>
            </div>

            {statusMsg && (
              <div className="p-3 rounded bg-[#0D1210] border border-[#00EC97]/40 text-[#00EC97] font-mono">
                {statusMsg}
              </div>
            )}
            {errorMsg && (
              <div className="p-3 rounded bg-[#0D1210] border border-[#FF5C68]/40 text-[#FF5C68] font-mono">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#00EC97] hover:bg-[#70FFC5] text-[#080B0A] font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Update Onchain Policy (v{state.policy.policyVersion + 1})
              </button>

              <button
                type="button"
                onClick={handleToggleEmergencyPause}
                className={`px-4 py-2.5 font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  state.policy.emergencyPaused
                    ? 'bg-[#00EC97] hover:bg-[#70FFC5] text-[#080B0A]'
                    : 'bg-[#FF5C68] hover:bg-[#ff737d] text-[#080B0A]'
                }`}
              >
                {state.policy.emergencyPaused ? (
                  <>
                    <PlayCircle className="w-4 h-4" /> Resume Contract Operations
                  </>
                ) : (
                  <>
                    <PauseOctagon className="w-4 h-4" /> Trigger Emergency Pause
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Restricted NEAR Function Call Key Inspector */}
        <div className="lg:col-span-6 bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Restricted NEAR Function Call Key Security
              </h2>
              <p className="text-xs text-[#A7B0AC]">
                The AI executor never holds a FullAccess key or treasury custody authority.
              </p>
            </div>
            <KeyRound className="w-5 h-5 text-[#00EC97]" />
          </div>

          <div className="space-y-4 text-xs font-mono">
            <div className="divide-y divide-white/[0.08]">
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#A7B0AC]">Executor Account:</span>
                <span className="text-white">{state.agentFunctionCallKey.accountId}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#A7B0AC]">Bound Receiver Contract:</span>
                <span className="text-[#00EC97]">{state.agentFunctionCallKey.receiverId}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#A7B0AC]">Gas-Only Allowance:</span>
                <span className="text-white">
                  {state.agentFunctionCallKey.allowanceNear} NEAR (0 Transfer)
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#A7B0AC]">Key Status:</span>
                <span
                  className={
                    state.agentFunctionCallKey.revoked
                      ? 'text-[#FF5C68] font-bold'
                      : 'text-[#00EC97] font-bold'
                  }
                >
                  {state.agentFunctionCallKey.revoked ? 'REVOKED' : 'ACTIVE (RESTRICTED)'}
                </span>
              </div>
              <div className="py-2 text-[#727D77] break-all">
                Public Key: {state.agentFunctionCallKey.publicKey}
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.08] space-y-1.5">
              <div className="text-white font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#00EC97]" />
                Permitted Contract Methods Only:
              </div>
              <div className="text-[#00EC97]">
                {state.agentFunctionCallKey.methodNames.join(' · ')}
              </div>
              <div className="text-[#727D77] pt-1">
                Blocked Methods: set_policy · register_vendor · suspend_vendor · register_verifier ·
                emergency_pause · ft_transfer
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleFunctionCallKey}
              className="w-full py-2.5 px-4 bg-[#202824] hover:bg-[#28322D] text-white font-sans font-medium rounded-lg border border-white/[0.08] transition-colors cursor-pointer"
            >
              {state.agentFunctionCallKey.revoked
                ? 'Restore Restricted Agent Function Call Key'
                : 'Revoke Agent Function Call Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

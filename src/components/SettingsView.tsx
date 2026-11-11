import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, RefreshCw, Server, Settings, ShieldCheck } from 'lucide-react';
import { apiRequest, AppStateBundle } from '../types/api';

interface SettingsViewProps {
  state: AppStateBundle;
  callerAccount: string;
  onChangeCallerAccount: (account: string) => void;
  onRefresh: () => Promise<void>;
}

interface HealthResponse {
  status: string;
  service: string;
  nearNetwork: string;
  paymentMode: 'simulation' | 'mainnet';
  policyContractId: string;
  treasuryCustodyAccountId: string;
  emergencyPaused: boolean;
  policyVersion: number;
  timestamp: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  callerAccount,
  onChangeCallerAccount,
  onRefresh,
}) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<HealthResponse>('/api/health')
      .then((res) => setHealth(res))
      .catch(() => null);
  }, [state]);

  const handleSyncState = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      await onRefresh();
      const h = await apiRequest<HealthResponse>('/api/health');
      setHealth(h);
      setNotice('Synchronized live contract state, verifier keys, and health diagnostics.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-[#00EC97]">
            SYSTEM CONFIGURATION · ENVIRONMENT & INTEGRATION DIAGNOSTICS
          </div>
          <h2 className="text-lg font-bold text-white">
            VaultGuard Runtime Environment & Account Bindings
          </h2>
          <p className="text-xs text-[#A7B0AC]">
            Inspect active NEAR Protocol accounts, trusted verifier Ed25519 keys, integration modes,
            and role-based session permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSyncState}
          disabled={syncing}
          className="px-4 py-2.5 bg-[#202824] hover:bg-[#28322D] text-white border border-white/[0.08] font-medium text-xs rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#00EC97] ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Synchronizing...' : 'Refresh Diagnostics'}
        </button>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-[#0D1210] border border-[#00EC97]/40 text-[#00EC97] text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* NEAR Account & Contract Bindings */}
        <div className="lg:col-span-6 bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div>
              <h3 className="text-base font-semibold text-white">
                NEAR Protocol Account & Contract Bindings
              </h3>
              <p className="text-xs text-[#A7B0AC]">
                Four-account separation of authority enforced across policy and custody
              </p>
            </div>
            <Server className="w-4 h-4 text-[#00EC97]" />
          </div>

          <div className="divide-y divide-white/[0.08] text-xs font-mono">
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-[#A7B0AC] font-sans">NEAR Network</span>
              <span className="text-[#00EC97] uppercase">
                {health?.nearNetwork || 'testnet'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-[#A7B0AC] font-sans">Policy Guard Contract</span>
              <span className="text-white break-all">{state.policy.policyContractAccount}</span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-[#A7B0AC] font-sans">Treasury Custody Account</span>
              <span className="text-white break-all">{state.policy.treasuryCustodyAccount}</span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-[#A7B0AC] font-sans">Treasury Administrator</span>
              <span className="text-white break-all">{state.policy.treasuryAdminAccount}</span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-[#A7B0AC] font-sans">Restricted AI Executor</span>
              <span className="text-white break-all">{state.agentFunctionCallKey.accountId}</span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-[#A7B0AC] font-sans">Trusted Verifier Ed25519 Key</span>
              <span className="text-[#70FFC5] break-all max-w-[260px] text-right">
                ed25519:{state.policy.trustedVerifierPublicKeys[0]?.slice(0, 24)}...
              </span>
            </div>
          </div>
        </div>

        {/* Active Session Role & Integration Matrix */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Active Operator Role & Wallet Session
                </h3>
                <p className="text-xs text-[#A7B0AC]">
                  Sent via <code className="text-[#83DCFF]">x-near-account-id</code> header on
                  state-changing API requests
                </p>
              </div>
              <KeyRound className="w-4 h-4 text-[#00EC97]" />
            </div>

            <div className="space-y-3 text-xs">
              <label htmlFor="settings-role-select" className="block text-[#A7B0AC]">
                Select Active NEAR Account Context
              </label>
              <select
                id="settings-role-select"
                value={callerAccount}
                onChange={(e) => onChangeCallerAccount(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0D1210] border border-white/[0.08] rounded-md text-white font-mono text-xs"
              >
                <option value="admin.vaultguard.testnet">
                  admin.vaultguard.testnet — TREASURY_ADMIN (Full Policy & Vendor Control)
                </option>
                <option value="ai-executor.vaultguard.testnet">
                  ai-executor.vaultguard.testnet — AI_AGENT (Restricted 4-Method Function Call Key)
                </option>
                <option value="operator.vaultguard.testnet">
                  operator.vaultguard.testnet — FINANCE_OPERATOR (Invoice & Quote Operations)
                </option>
                <option value="auditor.vaultguard.testnet">
                  auditor.vaultguard.testnet — AUDITOR (Read-Only Compliance & Audit Ledger)
                </option>
              </select>
              <div className="text-[#727D77] font-mono">
                Active Caller: <span className="text-[#00EC97]">{callerAccount}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  External Integration & Verification Status
                </h3>
                <p className="text-xs text-[#A7B0AC]">
                  Transparent disclosure of real vs. deterministic simulation components
                </p>
              </div>
              <Settings className="w-4 h-4 text-[#00EC97]" />
            </div>

            <div className="divide-y divide-white/[0.08] text-xs">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-white font-medium">Ed25519 Signature & AES-256-GCM</div>
                  <div className="text-[#727D77]">Real node:crypto cryptographic primitives</div>
                </div>
                <span className="font-mono text-[#00EC97] flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" /> ACTIVE (REAL CRYPTO)
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-white font-medium">NEAR AI Cloud / Prompt Scanner</div>
                  <div className="text-[#727D77]">
                    Uses NEAR AI API when NEAR_AI_API_KEY is set; deterministic local fallback active
                  </div>
                </div>
                <span className="font-mono text-[#83DCFF] shrink-0">HYBRID / READY</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-white font-medium">GitHub Proof-of-Work Verifier</div>
                  <div className="text-[#727D77]">
                    Queries GitHub REST API or deterministic PR fixtures
                  </div>
                </div>
                <span className="font-mono text-[#83DCFF] shrink-0">HYBRID / READY</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-white font-medium">NEAR Intents 1Click Settlement</div>
                  <div className="text-[#727D77]">
                    Mode: {state.paymentMode.toUpperCase()} (Mainnet guarded by $25 cap &amp; human
                    sig)
                  </div>
                </div>
                <span className="font-mono text-[#F5B942] uppercase shrink-0">
                  {state.paymentMode}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

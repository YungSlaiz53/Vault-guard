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
      <div className="vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-indigo-400">
            SYSTEM CONFIGURATION · ENVIRONMENT & INTEGRATION DIAGNOSTICS
          </div>
          <h2 className="text-lg font-bold text-white">
            VaultGuard Runtime Environment & Account Bindings
          </h2>
          <p className="text-xs text-slate-400">
            Inspect active NEAR Protocol accounts, trusted verifier Ed25519 keys, integration modes,
            and role-based session permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSyncState}
          disabled={syncing}
          className="vg-btn-secondary px-4 py-2.5 bg-[#1A243B] hover:bg-[#222F4D] text-white border border-slate-700/70 hover:border-indigo-500/40 font-medium text-xs rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Synchronizing...' : 'Refresh Diagnostics'}
        </button>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-[#0B0F17] border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* NEAR Account & Contract Bindings */}
        <div className="lg:col-span-6 vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-base font-semibold text-white">
                NEAR Protocol Account & Contract Bindings
              </h3>
              <p className="text-xs text-slate-400">
                Four-account separation of authority enforced across policy and custody
              </p>
            </div>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="divide-y divide-slate-800/70 text-xs font-mono">
            <div className="py-3 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
              <span className="text-slate-400 font-sans">NEAR Network</span>
              <span className="text-emerald-400 uppercase">
                {health?.nearNetwork || 'testnet'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
              <span className="text-slate-400 font-sans">Policy Guard Contract</span>
              <span className="text-white break-all">{state.policy.policyContractAccount}</span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
              <span className="text-slate-400 font-sans">Treasury Custody Account</span>
              <span className="text-white break-all">{state.policy.treasuryCustodyAccount}</span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
              <span className="text-slate-400 font-sans">Treasury Administrator</span>
              <span className="text-white break-all">{state.policy.treasuryAdminAccount}</span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
              <span className="text-slate-400 font-sans">Restricted AI Executor</span>
              <span className="text-white break-all">{state.agentFunctionCallKey.accountId}</span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
              <span className="text-slate-400 font-sans">Trusted Verifier Ed25519 Key</span>
              <span className="text-indigo-300 break-all max-w-[260px] text-right">
                ed25519:{state.policy.trustedVerifierPublicKeys[0]?.slice(0, 24)}...
              </span>
            </div>
          </div>
        </div>

        {/* Active Session Role & Integration Matrix */}
        <div className="lg:col-span-6 space-y-6">
          <div className="vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Active Operator Role & Wallet Session
                </h3>
                <p className="text-xs text-slate-400">
                  Sent via <code className="text-sky-400">x-near-account-id</code> header on
                  state-changing API requests
                </p>
              </div>
              <KeyRound className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="space-y-3 text-xs">
              <label htmlFor="settings-role-select" className="block text-slate-400">
                Select Active NEAR Account Context
              </label>
              <select
                id="settings-role-select"
                value={callerAccount}
                onChange={(e) => onChangeCallerAccount(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B0F17] border border-slate-800/80 rounded-md text-white font-mono text-xs"
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
              <div className="text-slate-500 font-mono">
                Active Caller: <span className="text-indigo-400">{callerAccount}</span>
              </div>
            </div>
          </div>

          <div className="vg-card bg-[#131B2E] border border-slate-800/80 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  External Integration & Verification Status
                </h3>
                <p className="text-xs text-slate-400">
                  Transparent disclosure of real vs. deterministic simulation components
                </p>
              </div>
              <Settings className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="divide-y divide-slate-800/70 text-xs">
              <div className="py-2.5 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
                <div>
                  <div className="text-white font-medium">Ed25519 Signature & AES-256-GCM</div>
                  <div className="text-slate-500">Real node:crypto cryptographic primitives</div>
                </div>
                <span className="font-mono text-emerald-400 flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" /> ACTIVE (REAL CRYPTO)
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
                <div>
                  <div className="text-white font-medium">NEAR AI Cloud / Prompt Scanner</div>
                  <div className="text-slate-500">
                    Uses NEAR AI API when NEAR_AI_API_KEY is set; deterministic local fallback active
                  </div>
                </div>
                <span className="font-mono text-sky-400 shrink-0">HYBRID / READY</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
                <div>
                  <div className="text-white font-medium">GitHub Proof-of-Work Verifier</div>
                  <div className="text-slate-500">
                    Queries GitHub REST API or deterministic PR fixtures
                  </div>
                </div>
                <span className="font-mono text-sky-400 shrink-0">HYBRID / READY</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4 hover:bg-[#19233A]/40 px-2 rounded transition-colors">
                <div>
                  <div className="text-white font-medium">NEAR Intents 1Click Settlement</div>
                  <div className="text-slate-500">
                    Mode: {state.paymentMode.toUpperCase()} (Mainnet guarded by $25 cap &amp; human
                    sig)
                  </div>
                </div>
                <span className="font-mono text-amber-400 uppercase shrink-0">
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

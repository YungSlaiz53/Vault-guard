import React, { useState } from 'react';
import { CheckCircle2, Plus, ShieldOff, Users } from 'lucide-react';
import { apiRequest, AppStateBundle, VendorRecord } from '../types/api';

interface VendorsViewProps {
  state: AppStateBundle;
  callerAccount: string;
  onRefresh: () => Promise<void>;
}

export const VendorsView: React.FC<VendorsViewProps> = ({ state, callerAccount, onRefresh }) => {
  const [vendorId, setVendorId] = useState('VENDOR-004');
  const [name, setName] = useState('Aurora Cross-Chain Relayer Co.');
  const [walletAddress, setWalletAddress] = useState('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65');
  const [githubRepo, setGithubRepo] = useState('aurora-relayer/intents-bridge');
  const [poList, setPoList] = useState('PO-2026-010, PO-2026-011');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegisterVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setErrorMsg(null);
    try {
      await apiRequest('/api/vendors', {
        method: 'POST',
        callerAccount,
        body: JSON.stringify({
          id: vendorId.trim(),
          name: name.trim(),
          walletAddress: walletAddress.trim(),
          approvedChains: ['base', 'arbitrum', 'near'],
          approvedTokens: ['USDC', 'USDT'],
          allowedPurchaseOrders: poList
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          githubRepo: githubRepo.trim() || undefined,
        }),
      });
      await onRefresh();
      setFeedback(`Registered whitelisted vendor ${vendorId} on NEAR policy contract.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register vendor');
    }
  };

  const handleToggleStatus = async (vendor: VendorRecord) => {
    setFeedback(null);
    setErrorMsg(null);
    const nextStatus = vendor.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiRequest(`/api/vendors/${vendor.id}`, {
        method: 'PATCH',
        callerAccount,
        body: JSON.stringify({ status: nextStatus }),
      });
      await onRefresh();
      setFeedback(`Updated vendor ${vendor.id} status to ${nextStatus}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update vendor status');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Vendor Table */}
        <div className="lg:col-span-8 bg-[#171D1B] border border-white/[0.08] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Onchain Whitelisted Vendors</h2>
              <p className="text-xs text-[#A7B0AC]">
                Only ACTIVE vendors with exact matching recipient wallets and chains can receive
                treasury funds.
              </p>
            </div>
            <Users className="w-4 h-4 text-[#00EC97]" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-[#A7B0AC]">
                  <th className="py-3 px-4 font-medium">Vendor ID · Name</th>
                  <th className="py-3 px-4 font-medium">Whitelisted Wallet</th>
                  <th className="py-3 px-4 font-medium">Approved Chains · Tokens</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08] text-xs">
                {state.vendors.map((v) => {
                  const invCount = state.invoices.filter((i) => i.vendorId === v.id).length;
                  return (
                    <tr key={v.id} className="hover:bg-[#202824]/60">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-semibold text-white">{v.id}</div>
                        <div className="text-[#A7B0AC]">{v.name}</div>
                        <div className="text-[#727D77] font-mono mt-0.5">
                          {v.githubRepo || 'no-repo'} · {invCount} invoices
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#A7B0AC] break-all max-w-[210px]">
                        {v.walletAddress}
                      </td>
                      <td className="py-3.5 px-4 text-[#A7B0AC] font-mono">
                        <div>{v.approvedChains.join(' · ')}</div>
                        <div className="text-[#727D77]">
                          {v.approvedTokens.join(' / ')} · POs:{' '}
                          {v.allowedPurchaseOrders.join(', ') || 'none'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        {v.status === 'ACTIVE' ? (
                          <span className="text-[#00EC97] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE
                          </span>
                        ) : (
                          <span className="text-[#FF5C68] flex items-center gap-1">
                            <ShieldOff className="w-3.5 h-3.5" /> SUSPENDED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(v)}
                          className="px-3 py-1.5 rounded bg-[#202824] hover:bg-[#28322D] text-white border border-white/[0.08] transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {v.status === 'ACTIVE' ? `Suspend ${v.id}` : `Activate ${v.id}`}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Register New Vendor Form */}
        <div className="lg:col-span-4 bg-[#171D1B] border border-white/[0.08] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Register Vendor</h2>
              <p className="text-xs text-[#A7B0AC]">
                Requires Treasury Administrator role ({state.policy.treasuryAdminAccount})
              </p>
            </div>
            <Plus className="w-4 h-4 text-[#00EC97]" />
          </div>

          <form onSubmit={handleRegisterVendor} className="space-y-3 text-xs">
            <div>
              <label htmlFor="v-id" className="block text-[#A7B0AC] mb-1">
                Vendor Identifier
              </label>
              <input
                id="v-id"
                type="text"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D1210] border border-white/[0.08] rounded-md text-white font-mono"
                required
              />
            </div>
            <div>
              <label htmlFor="v-name" className="block text-[#A7B0AC] mb-1">
                Legal / Organization Name
              </label>
              <input
                id="v-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D1210] border border-white/[0.08] rounded-md text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="v-wallet" className="block text-[#A7B0AC] mb-1">
                Approved Recipient Wallet Address
              </label>
              <input
                id="v-wallet"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D1210] border border-white/[0.08] rounded-md text-white font-mono"
                required
              />
            </div>
            <div>
              <label htmlFor="v-repo" className="block text-[#A7B0AC] mb-1">
                GitHub Proof-of-Work Repository
              </label>
              <input
                id="v-repo"
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D1210] border border-white/[0.08] rounded-md text-white font-mono"
              />
            </div>
            <div>
              <label htmlFor="v-pos" className="block text-[#A7B0AC] mb-1">
                Approved Purchase Orders (comma-separated)
              </label>
              <input
                id="v-pos"
                type="text"
                value={poList}
                onChange={(e) => setPoList(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D1210] border border-white/[0.08] rounded-md text-white font-mono"
              />
            </div>

            {feedback && (
              <div className="p-2.5 rounded bg-[#0D1210] border border-[#00EC97]/40 text-[#00EC97] font-mono">
                {feedback}
              </div>
            )}
            {errorMsg && (
              <div className="p-2.5 rounded bg-[#0D1210] border border-[#FF5C68]/40 text-[#FF5C68] font-mono">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#00EC97] hover:bg-[#70FFC5] text-[#080B0A] font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Register Vendor Onchain
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

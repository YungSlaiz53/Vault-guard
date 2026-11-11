import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  FileCheck2,
  FileText,
  Landmark,
  LayoutDashboard,
  Play,
  Settings,
  Shield,
  Sliders,
  Users,
  Wallet,
} from 'lucide-react';
import { AuditView } from './components/AuditView';
import { DemoWalkthroughModal } from './components/DemoWalkthroughModal';
import { InvoicesView } from './components/InvoicesView';
import { OverviewView } from './components/OverviewView';
import { PoliciesView } from './components/PoliciesView';
import { SecurityCenterView } from './components/SecurityCenterView';
import { SettingsView } from './components/SettingsView';
import { SettlementsView } from './components/SettlementsView';
import { TreasuryView } from './components/TreasuryView';
import { VendorsView } from './components/VendorsView';
import { ActiveTab, apiRequest, AppStateBundle } from './types/api';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices & AI Verifier', icon: FileText },
  { id: 'vendors', label: 'Vendor Whitelist', icon: Users },
  { id: 'policies', label: 'Onchain Policies & Keys', icon: Sliders },
  { id: 'treasury', label: 'Treasury Custody', icon: Landmark },
  { id: 'settlements', label: 'NEAR Intents 1Click', icon: ArrowRightLeft },
  { id: 'security', label: 'Security Center (42 Gates)', icon: Shield },
  { id: 'audit', label: 'Audit Logs', icon: FileCheck2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>('INV-001');
  const [callerAccount, setCallerAccount] = useState<string>('admin.vaultguard.testnet');
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [state, setState] = useState<AppStateBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchFullState = useCallback(async () => {
    try {
      const [invRes, venRes, polRes, trsRes, setRes, audRes, secRes] = await Promise.all([
        apiRequest<{ invoices: AppStateBundle['invoices'] }>('/api/invoices'),
        apiRequest<{ vendors: AppStateBundle['vendors'] }>('/api/vendors'),
        apiRequest<{
          policy: AppStateBundle['policy'];
          spendingUsage: AppStateBundle['spendingUsage'];
          agentFunctionCallKey: AppStateBundle['agentFunctionCallKey'];
        }>('/api/policies'),
        apiRequest<{
          balancesBaseUnits: AppStateBundle['balancesBaseUnits'];
          reservations: AppStateBundle['reservations'];
        }>('/api/treasury'),
        apiRequest<{
          paymentMode: AppStateBundle['paymentMode'];
          settlements: AppStateBundle['settlements'];
        }>('/api/settlements'),
        apiRequest<{ auditEvents: AppStateBundle['auditEvents'] }>('/api/audit'),
        apiRequest<{
          securityEvents: AppStateBundle['securityEvents'];
          gateSummary: AppStateBundle['gateSummary'];
        }>('/api/security/events'),
      ]);

      setState({
        invoices: invRes.invoices,
        vendors: venRes.vendors,
        policy: polRes.policy,
        spendingUsage: polRes.spendingUsage,
        agentFunctionCallKey: polRes.agentFunctionCallKey,
        balancesBaseUnits: trsRes.balancesBaseUnits,
        reservations: trsRes.reservations,
        settlements: setRes.settlements,
        paymentMode: setRes.paymentMode,
        auditEvents: audRes.auditEvents,
        securityEvents: secRes.securityEvents,
        gateSummary: secRes.gateSummary,
      });
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load VaultGuard state');
    }
  }, []);

  useEffect(() => {
    fetchFullState();
  }, [fetchFullState]);

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#080B0A] text-white flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0D1210] border-b md:border-b-0 md:border-r border-white/[0.08] shrink-0 flex flex-col justify-between">
        <div>
          <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-lg font-bold tracking-tight text-white flex items-center gap-2.5 whitespace-nowrap cursor-pointer"
            >
              {/* Custom Shield-Inspired Security Wordmark Icon (White + #00EC97 Mint Accent) */}
              <svg
                className="w-6 h-6 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 2.25L4.5 5.25V11.25C4.5 16.55 7.68 21.38 12 22.75C16.32 21.38 19.5 16.55 19.5 11.25V5.25L12 2.25Z"
                  stroke="#FFFFFF"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.25 12.25L11.25 14.25L15.25 9.75"
                  stroke="#00EC97"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>
                Vault<span className="text-[#00EC97]">Guard</span>
              </span>
            </button>
          </div>

          <nav aria-label="Main workspace navigation" className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#202824] text-[#00EC97] border border-[#00EC97]/30 font-semibold'
                      : 'text-[#A7B0AC] hover:text-white hover:bg-[#171D1B]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#00EC97]' : 'text-[#727D77]'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Wallet / Role Context Switcher */}
        <div className="p-4 border-t border-white/[0.08] space-y-2 text-xs">
          <label htmlFor="near-wallet-role" className="flex items-center gap-1.5 text-[#A7B0AC]">
            <Wallet className="w-3.5 h-3.5 text-[#00EC97]" />
            <span>NEAR Wallet Session Role</span>
          </label>
          <select
            id="near-wallet-role"
            value={callerAccount}
            onChange={(e) => setCallerAccount(e.target.value)}
            className="w-full px-2.5 py-2 bg-[#171D1B] border border-white/[0.08] rounded-md text-white font-mono text-[11px]"
          >
            <option value="admin.vaultguard.testnet">
              admin.vaultguard.testnet (TREASURY_ADMIN)
            </option>
            <option value="ai-executor.vaultguard.testnet">
              ai-executor.vaultguard.testnet (AI_AGENT)
            </option>
            <option value="operator.vaultguard.testnet">
              operator.vaultguard.testnet (OPERATOR)
            </option>
            <option value="auditor.vaultguard.testnet">
              auditor.vaultguard.testnet (AUDITOR)
            </option>
          </select>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, 1 Primary Action on Right */}
        <header className="px-6 py-4 bg-[#0D1210] border-b border-white/[0.08] flex items-center justify-between gap-8">
          <div className="text-xs font-mono text-[#A7B0AC] truncate">
            VaultGuard Treasury / <span className="text-white">{activeNavLabel}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setDemoModalOpen(true)}
              className="px-3.5 py-2 bg-[#00EC97] hover:bg-[#70FFC5] text-[#080B0A] font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              60s Guided Demo
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {loadError ? (
            <div className="p-6 bg-[#171D1B] border border-[#FF5C68]/40 rounded-lg text-[#FF5C68] text-sm font-mono">
              Error loading application state: {loadError}
            </div>
          ) : !state ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-28 bg-[#171D1B] border border-white/[0.08] rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <OverviewView
                  state={state}
                  onNavigate={setActiveTab}
                  onOpenDemo={() => setDemoModalOpen(true)}
                  onSelectInvoice={setSelectedInvoiceId}
                />
              )}
              {activeTab === 'invoices' && (
                <InvoicesView
                  state={state}
                  selectedInvoiceId={selectedInvoiceId}
                  onSelectInvoice={setSelectedInvoiceId}
                  onRefresh={fetchFullState}
                  onNavigate={setActiveTab}
                />
              )}
              {activeTab === 'vendors' && (
                <VendorsView
                  state={state}
                  callerAccount={callerAccount}
                  onRefresh={fetchFullState}
                />
              )}
              {activeTab === 'policies' && (
                <PoliciesView
                  state={state}
                  callerAccount={callerAccount}
                  onRefresh={fetchFullState}
                />
              )}
              {activeTab === 'treasury' && (
                <TreasuryView
                  state={state}
                  callerAccount={callerAccount}
                  onRefresh={fetchFullState}
                />
              )}
              {activeTab === 'settlements' && (
                <SettlementsView state={state} onRefresh={fetchFullState} />
              )}
              {activeTab === 'security' && (
                <SecurityCenterView state={state} onRefresh={fetchFullState} />
              )}
              {activeTab === 'audit' && <AuditView state={state} />}
              {activeTab === 'settings' && (
                <SettingsView
                  state={state}
                  callerAccount={callerAccount}
                  onChangeCallerAccount={setCallerAccount}
                  onRefresh={fetchFullState}
                />
              )}
            </>
          )}
        </main>
      </div>

      <DemoWalkthroughModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onRefresh={fetchFullState}
      />
    </div>
  );
}

export default App;

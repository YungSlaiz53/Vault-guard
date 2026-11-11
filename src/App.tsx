import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  FileCheck2,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Sliders,
  Users,
  X,
} from 'lucide-react';
import { AuditView } from './components/AuditView';
import { AuthViews } from './components/AuthViews';
import { CosmicHeroStage, formatFullLiveDate } from './components/CosmicHeroStage';
import { DemoWalkthroughModal } from './components/DemoWalkthroughModal';
import { InvoicesView } from './components/InvoicesView';
import { OverviewView } from './components/OverviewView';
import { PoliciesView } from './components/PoliciesView';
import { SecurityCenterView } from './components/SecurityCenterView';
import { SettingsView } from './components/SettingsView';
import { SettlementsView } from './components/SettlementsView';
import { TreasuryView } from './components/TreasuryView';
import { VendorsView } from './components/VendorsView';
import {
  ActiveTab,
  apiRequest,
  AppStateBundle,
  AuthenticatedUser,
  AuthModalView,
} from './types/api';

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
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [authModal, setAuthModal] = useState<AuthModalView>('none');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [state, setState] = useState<AppStateBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveDate, setLiveDate] = useState<Date>(() => new Date());

  // Keep live date synced across the entire application
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveDate(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

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

  const handleAuthenticated = (user: AuthenticatedUser) => {
    setCurrentUser(user);
    setCallerAccount(user.accountId);
    setActiveTab('dashboard');
    setAuthModal('none');
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setCallerAccount('admin.vaultguard.testnet');
    setDrawerOpen(false);
  };

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#05020D] text-[#F8F7FF] flex flex-col relative selection:bg-purple-500/30 selection:text-purple-100">
      {/* Top Cosmic Navigation Bar */}
      <header className="sticky top-0 z-40 px-4 sm:px-8 py-4 bg-[#05020D]/80 backdrop-blur-xl border-b border-purple-500/15 flex items-center justify-between gap-4">
        {/* Left: Glowing Purple Constellation Emblem + VaultGuard Wordmark */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="group flex items-center gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/40 via-purple-800/50 to-[#14072E] border border-purple-400/50 shadow-[0_0_22px_rgba(168,85,247,0.5)] flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  stroke="#E9D5FF"
                  strokeWidth="1.4"
                  strokeDasharray="3 2"
                />
                <path
                  d="M12 3.5L18.5 8V16L12 20.5L5.5 16V8L12 3.5Z"
                  stroke="#C084FC"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
                <path
                  d="M12 3.5V9.5M18.5 8L14.2 10.8M18.5 16L14.2 13.2M12 20.5V14.5M5.5 16L9.8 13.2M5.5 8L9.8 10.8"
                  stroke="#A855F7"
                  strokeWidth="1.1"
                />
              </svg>
            </div>
            <span className="text-base sm:text-lg font-semibold tracking-tight text-white">
              VaultGuard
            </span>
          </button>

          {currentUser && (
            <span className="hidden lg:inline-flex items-center gap-2 text-xs font-mono text-purple-300/80 pl-3 border-l border-purple-400/20">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>{formatFullLiveDate(liveDate)}</span>
              <span className="text-purple-400/40">·</span>
              <span className="text-purple-200 font-semibold">{activeNavLabel}</span>
            </span>
          )}
        </div>

        {/* Right: Login & Sign up (when logged out) OR Active User Session (when logged in) */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[#120829] border border-purple-400/35 px-3 py-1.5 rounded-xl text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  currentUser.isAdminPortal
                    ? 'bg-fuchsia-400 shadow-[0_0_8px_#E879F9]'
                    : 'bg-emerald-400 shadow-[0_0_8px_#34D399]'
                }`}
              />
              <span className="font-mono text-purple-100 font-medium truncate max-w-[160px]">
                {currentUser.name.split(' ')[0]} ({currentUser.accountId})
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-200">
                {currentUser.role}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="text-purple-300 hover:text-white pl-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAuthModal('login')}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-purple-100/90 hover:text-white transition-colors cursor-pointer"
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => setAuthModal('register')}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-white rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-400/40 shadow-[0_0_24px_rgba(147,51,234,0.35)] transition-all cursor-pointer"
              >
                Sign up
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                setAuthModal('login');
              } else {
                setDrawerOpen((prev) => !prev);
              }
            }}
            aria-label="Toggle navigation menu"
            className="p-2 rounded-xl text-purple-100 hover:text-white hover:bg-purple-500/20 border border-transparent hover:border-purple-400/30 transition-colors cursor-pointer"
          >
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* BEFORE LOGIN: Show ONLY the Reflect-inspired Cosmic Hero Stage with Live Date Calendar */}
      {!currentUser ? (
        <main className="flex-1 flex flex-col justify-between">
          <CosmicHeroStage state={state} onOpenAuth={setAuthModal} />
        </main>
      ) : (
        /* AFTER LOGIN: Full Authenticated Dashboard Workspace containing all 9 VaultGuard Modules */
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Authenticated Sidebar Navigation */}
          <aside className="w-full md:w-64 bg-[#090418]/90 border-b md:border-b-0 md:border-r border-purple-500/15 shrink-0 flex flex-col justify-between p-4">
            <div className="space-y-4">
              {/* Live Date Card inside Authenticated Sidebar */}
              <div className="p-3.5 rounded-xl bg-[#120829]/90 border border-purple-400/25 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-purple-300">
                  <span>LIVE TREASURY CLOCK</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
                </div>
                <div className="text-xs font-semibold text-white">
                  {formatFullLiveDate(liveDate)}
                </div>
                <div className="text-[11px] font-mono text-[#9E93BD] truncate">
                  {currentUser.accountId}
                </div>
              </div>

              <nav aria-label="Main workspace navigation" className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/30 text-white border border-purple-400/45 font-semibold shadow-[0_0_18px_rgba(147,51,234,0.25)]'
                          : 'text-[#B4A8D4] hover:text-white hover:bg-purple-500/15 hover:translate-x-0.5'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-purple-300'
                            : 'text-[#8E84AD] group-hover:text-purple-300'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-purple-500/15">
              <button
                type="button"
                onClick={handleSignOut}
                className="vg-btn-secondary w-full py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out ({currentUser.name.split(' ')[0]})</span>
              </button>
            </div>
          </aside>

          {/* Authenticated Workspace Content Area */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            {loadError ? (
              <div className="p-6 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-200 text-sm font-mono">
                Error loading application state: {loadError}
              </div>
            ) : !state ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 bg-[#120829] border border-purple-500/20 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <OverviewView
                    state={state}
                    selectedInvoiceId={selectedInvoiceId}
                    onNavigate={setActiveTab}
                    onSelectInvoice={setSelectedInvoiceId}
                    onRefresh={fetchFullState}
                    liveDate={liveDate}
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
      )}

      {/* Unified Authentication Modal (Login with ADMIN01 / 1234567890 or Operator, and Sign up) */}
      <AuthViews
        view={authModal}
        onChangeView={setAuthModal}
        onAuthenticated={handleAuthenticated}
      />

      <DemoWalkthroughModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onRefresh={fetchFullState}
      />
    </div>
  );
}

export default App;

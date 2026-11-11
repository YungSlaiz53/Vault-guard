import React, { useState } from 'react';
import { CheckCircle2, ShieldAlert, UserPlus, X } from 'lucide-react';
import { apiRequest, AuthenticatedUser, AuthModalView } from '../types/api';

interface AuthViewsProps {
  view: AuthModalView;
  onChangeView: (view: AuthModalView) => void;
  onAuthenticated: (user: AuthenticatedUser) => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  view,
  onChangeView,
  onAuthenticated,
}) => {
  // Unified Login Form State (Supports ADMIN01 / 1234567890 as well as Operator/Auditor accounts)
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAccount, setRegAccount] = useState('');
  const [regRole, setRegRole] = useState<'FINANCE_OPERATOR' | 'AUDITOR'>('FINANCE_OPERATOR');
  const [regPassword, setRegPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (view === 'none') return null;

  const activeMode = view === 'register' ? 'register' : 'login';

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleUnifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    resetMessages();
    try {
      const res = await apiRequest<{ user: AuthenticatedUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: loginId, password: loginPassword }),
      });
      setSuccessMsg(`Authenticated as ${res.user.name} (${res.user.accountId})`);
      onAuthenticated(res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    resetMessages();
    try {
      const res = await apiRequest<{ user: AuthenticatedUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          accountId: regAccount,
          password: regPassword,
          role: regRole,
        }),
      });
      setSuccessMsg(`Registered & bound NEAR key for ${res.user.accountId}`);
      onAuthenticated(res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="VaultGuard Authentication Portal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04010A]/85 backdrop-blur-xl overflow-y-auto"
    >
      {/* Background Singularity Glow inside Auth Modal */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 h-80 opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, #C084FC 0%, #7C3AED 45%, transparent 80%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-purple-400/30 bg-[#0D0620]/95 p-6 sm:p-7 shadow-[0_0_80px_rgba(147,51,234,0.4)] space-y-5">
        {/* Top Mode Switcher Tabs (Login & Sign up) + Close Button */}
        <div className="flex items-center justify-between border-b border-purple-400/20 pb-4">
          <div className="flex items-center gap-1.5 bg-[#070312] p-1 rounded-xl border border-purple-400/20">
            <button
              type="button"
              onClick={() => {
                resetMessages();
                onChangeView('login');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'login'
                  ? 'bg-purple-600 text-white font-semibold shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                  : 'text-[#A89EC4] hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                resetMessages();
                onChangeView('register');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'register'
                  ? 'bg-purple-600 text-white font-semibold shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                  : 'text-[#A89EC4] hover:text-white'
              }`}
            >
              Sign up
            </button>
          </div>

          <button
            type="button"
            onClick={() => onChangeView('none')}
            aria-label="Close authentication portal"
            className="p-1.5 rounded-lg text-[#A89EC4] hover:text-white hover:bg-purple-500/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. UNIFIED LOGIN VIEW */}
        {activeMode === 'login' && (
          <form onSubmit={handleUnifiedLogin} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="auth-login-id" className="block text-[#B4A8D4] mb-1">
                  Username, Email, or NEAR Account ID
                </label>
                <input
                  id="auth-login-id"
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070312] border border-purple-400/25 text-white font-mono"
                />
              </div>

              <div>
                <label htmlFor="auth-login-pass" className="block text-[#B4A8D4] mb-1">
                  Password
                </label>
                <input
                  id="auth-login-pass"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070312] border border-purple-400/25 text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="vg-btn-primary w-full py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              {busy ? 'Authenticating Session...' : 'Sign In to Dashboard'}
            </button>

            <div className="pt-2 border-t border-purple-400/15 flex items-center justify-between text-xs text-[#A89EC4]">
              <span>Need a new operator account?</span>
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  onChangeView('register');
                }}
                className="text-purple-300 hover:text-white font-semibold cursor-pointer"
              >
                Create Account →
              </button>
            </div>
          </form>
        )}

        {/* 2. OPERATOR & AUDITOR REGISTRATION VIEW */}
        {activeMode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-purple-300">
                <UserPlus className="w-3.5 h-3.5" />
                <span>NEW NEAR WORKSPACE REGISTRATION</span>
              </div>
              <h2 className="text-xl font-bold text-white">Create VaultGuard Account</h2>
              <p className="text-xs text-[#A89EC4]">
                Register an operator or compliance auditor identity and automatically provision an
                Ed25519 session public key.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="reg-name" className="block text-[#B4A8D4] mb-1">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  placeholder="Aria Lin"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#070312] border border-purple-400/25 text-white"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-[#B4A8D4] mb-1">
                  Work Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  placeholder="aria@vaultguard.near"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#070312] border border-purple-400/25 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="reg-account" className="block text-[#B4A8D4] mb-1">
                    NEAR Testnet Account ID
                  </label>
                  <input
                    id="reg-account"
                    type="text"
                    required
                    placeholder="aria.vaultguard.testnet"
                    value={regAccount}
                    onChange={(e) => setRegAccount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070312] border border-purple-400/25 text-white font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="reg-role" className="block text-[#B4A8D4] mb-1">
                    Workspace Role
                  </label>
                  <select
                    id="reg-role"
                    value={regRole}
                    onChange={(e) =>
                      setRegRole(e.target.value as 'FINANCE_OPERATOR' | 'AUDITOR')
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#070312] border border-purple-400/25 text-white font-mono"
                  >
                    <option value="FINANCE_OPERATOR">FINANCE_OPERATOR</option>
                    <option value="AUDITOR">AUDITOR (Read-Only)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="reg-pass" className="block text-[#B4A8D4] mb-1">
                  Password (min. 6 characters)
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#070312] border border-purple-400/25 text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="vg-btn-primary w-full py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              {busy ? 'Provisioning NEAR Identity...' : 'Register & Enter Dashboard'}
            </button>
          </form>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};

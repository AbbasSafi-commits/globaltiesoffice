import { AlertCircle, Globe, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Private office split-layout login screen with Google Sign-In only.
 */
export function LoginPage() {
  const { signInWithGoogle, signingIn, authError, clearAuthError } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFC] grid lg:grid-cols-2">
      {/* Left Brand Panel */}
      <div className="bg-[#0F172A] text-white px-8 py-10 sm:px-12 lg:px-16 lg:py-14 flex flex-col justify-between">
        <div className="inline-flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-xs">
            <Globe className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            Global Ties Office
          </span>
        </div>

        <div className="my-12 lg:my-0 max-w-md space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
            <Lock className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
            <span>Private Office Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-snug">
            Client operations, case tracking, and office records in one calm place.
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Built exclusively for authorized Global Ties Office personnel to manage client
            profiles, immigration &amp; business services, ledgers, and compliance documents.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" aria-hidden="true" />
          <span>Protected by verified Google workspace authentication and role permissions.</span>
        </div>
      </div>

      {/* Right Sign-In Card */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8 sm:p-10">
          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Use your approved Google account to access Global Ties Office.
            </p>
          </div>

          {authError && (
            <div
              className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
              <div className="flex-1">
                <p>{authError}</p>
              </div>
              <button
                type="button"
                onClick={clearAuthError}
                className="text-xs font-medium text-red-700 hover:text-red-900 underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={signingIn}
            className="w-full inline-flex items-center justify-center gap-3 rounded-lg bg-[#2563EB] px-5 py-3 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shrink-0">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
            </span>
            <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          <p className="mt-6 text-center text-xs text-slate-400">
            Access is restricted to invited staff profiles.
          </p>
        </div>
      </div>
    </div>
  );
}

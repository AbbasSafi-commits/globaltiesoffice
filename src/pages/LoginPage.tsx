import { AlertCircle, Globe, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Private office login screen with Google Sign-In only.
 */
export function LoginPage() {
  const { signInWithGoogle, signingIn, authError, clearAuthError } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-[#0F2942] px-8 py-8 text-white">
            <div className="inline-flex items-center justify-center rounded-lg bg-white/10 p-2.5 ring-1 ring-white/15 mb-5">
              <Globe className="h-6 w-6 text-blue-200" strokeWidth={1.85} aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
              Global Ties Office
            </h1>
            <p className="mt-1.5 text-sm text-blue-100/90 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Authorized staff only</span>
            </p>
          </div>

          <div className="px-8 py-8">
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Sign in with your approved Google workspace account to access office records and client operations.
            </p>

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
              className="w-full inline-flex items-center justify-center gap-3 rounded-lg bg-[#0F2942] px-5 py-3 text-sm font-medium text-white hover:bg-[#163859] disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] cursor-pointer"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
              <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

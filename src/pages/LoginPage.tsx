import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Private office login screen on a clean white background featuring the full Global Ties logo,
 * a blue-to-orange gradient divider, and Google Sign-In.
 */
export function LoginPage() {
  const { signInWithGoogle, signingIn, authError, clearAuthError } = useAuth();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-sm p-8 sm:p-10 text-center">
        {/* Full Brand Logo */}
        <div className="flex justify-center">
          <img
            src="/logo.png"
            alt="Global Ties (Private) Limited"
            className="h-32 sm:h-36 w-auto object-contain"
          />
        </div>

        {/* Thin Blue-to-Orange Brand Gradient Divider */}
        <div
          aria-hidden="true"
          className="mx-auto my-6 h-0.5 w-44 rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
        />

        <div className="mb-7">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Global Ties
          </h1>
          <p className="mt-1 text-sm font-medium text-muted">
            Authorized staff only
          </p>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Use your approved Google account to access the workspace.
          </p>
        </div>

        {authError && (
          <div
            className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger" aria-hidden="true" />
            <div className="flex-1">
              <p>{authError}</p>
            </div>
            <button
              type="button"
              onClick={clearAuthError}
              className="text-xs font-medium text-danger hover:text-red-900 underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={signingIn}
          className="w-full inline-flex items-center justify-center gap-3 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary cursor-pointer"
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

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-secondary shrink-0" aria-hidden="true" />
          <span>Access is restricted to invited staff profiles.</span>
        </div>
      </div>
    </div>
  );
}

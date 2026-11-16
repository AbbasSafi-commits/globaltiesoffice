import { LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Full-page screen rendered when a signed-in Google account lacks an active staff profile.
 */
export function AccessDeniedPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-700 border border-red-200">
          <ShieldAlert className="h-6 w-6" strokeWidth={1.85} aria-hidden="true" />
        </div>

        <h1 className="font-display text-xl font-semibold text-slate-900">
          Access Denied
        </h1>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Your account has not been given access. Contact your administrator.
        </p>

        {user?.email && (
          <p className="mt-4 text-xs text-slate-500 font-mono truncate">
            {user.email.toLowerCase()}
          </p>
        )}

        <div className="mt-7">
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#163859] transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] cursor-pointer"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

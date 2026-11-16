interface LoadingScreenProps {
  message?: string;
}

/**
 * Full-screen skeleton loading state shown while verifying the active session and profile.
 */
export function LoadingScreen({ message = 'Verifying authorized access...' }: LoadingScreenProps) {
  return (
    <div
      className="min-h-screen bg-[#F8FAFC] flex"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {/* Sidebar skeleton on desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#0F172A] p-4">
        <div className="flex items-center gap-2.5 px-2 py-2.5 mb-6">
          <div className="h-8 w-8 rounded-lg bg-white/15 animate-pulse" />
          <div className="h-4 w-32 rounded bg-white/15 animate-pulse" />
        </div>
        <div className="space-y-2 flex-1">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-9 rounded-lg bg-white/8 animate-pulse"
              style={{ opacity: 1 - item * 0.12 }}
            />
          ))}
        </div>
        <div className="pt-4 border-t border-white/10 flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-white/15 animate-pulse" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-24 rounded bg-white/15 animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      </aside>

      {/* Main shell skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between">
          <div className="h-4 w-44 rounded bg-slate-200 animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-200 animate-pulse hidden sm:block" />
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-2">
              <div className="h-7 w-48 rounded-md bg-slate-200 animate-pulse" />
              <div className="h-4 w-72 rounded bg-slate-200/80 animate-pulse" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((card) => (
                <div
                  key={card}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-24 rounded bg-slate-200 animate-pulse" />
                    <div className="h-8 w-8 rounded-lg bg-slate-100 animate-pulse" />
                  </div>
                  <div className="h-7 w-16 rounded bg-slate-200 animate-pulse" />
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-36 rounded bg-slate-200 animate-pulse" />
                <span className="text-xs font-medium text-slate-400">{message}</span>
              </div>
              <div className="space-y-3 pt-2">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

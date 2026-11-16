import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { ExpiryAlertItem } from './dashboardTypes';

interface ExpiryAlertsCardProps {
  alerts: ExpiryAlertItem[];
  loading: boolean;
}

/**
 * Displays clients whose CNIC or Passport has expired or expires within 60 days,
 * sorted by nearest date first with colored urgency badges and profile links.
 */
export function ExpiryAlertsCard({ alerts, loading }: ExpiryAlertsCardProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-display text-sm font-semibold text-[#0F2942]">
              Expiry Alerts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              CNIC or Passport expired or expiring within 60 days
            </p>
          </div>
        </div>
        {!loading && alerts.length > 0 && (
          <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 font-mono text-xs font-medium text-amber-800">
            {alerts.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 w-full rounded-md bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-900">
            No upcoming expiry alerts
          </p>
          <p className="mt-1 text-xs text-slate-500">
            All recorded CNIC and passport expiry dates are valid beyond 60 days.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
          {alerts.map((alert) => {
            const isExpired = alert.level === 'expired';
            return (
              <Link
                key={alert.id}
                to={`/clients/${alert.clientId}`}
                className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {alert.clientName}
                    </span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 text-slate-400 shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                    {alert.documentLabel} · Exp {alert.expiryDate}
                  </div>
                </div>

                <span
                  className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                    isExpired
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  {alert.badgeText}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { ExpiryAlertItem } from './dashboardTypes';

interface ExpiryAlertsCardProps {
  alerts: ExpiryAlertItem[];
  loading: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Displays clients whose CNIC or Passport has expired or expires within 60 days,
 * sorted by nearest date first with soft-tinted urgency pills and profile links.
 */
export function ExpiryAlertsCard({ alerts, loading }: ExpiryAlertsCardProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Expiry Alerts</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              CNIC or Passport expired or expiring within 60 days
            </p>
          </div>
        </div>
        {!loading && alerts.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-amber-700">
            {alerts.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
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
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {alerts.map((alert) => {
            const isExpired = alert.level === 'expired';
            return (
              <Link
                key={alert.id}
                to={`/clients/${alert.clientId}`}
                className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {getInitials(alert.clientName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
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
                </div>

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                    isExpired
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-800'
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

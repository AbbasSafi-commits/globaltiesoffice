import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { ActivityLogRecord } from '../permissions/ActivityLog';
import { formatDashboardActionLabel, formatTimestampCompact } from './dashboardTypes';

interface RecentActivityCardProps {
  entries: ActivityLogRecord[];
  loading: boolean;
}

/**
 * Displays the last 10 activityLog audit entries. Rendered ONLY for super admins.
 */
export function RecentActivityCard({ entries, loading }: RecentActivityCardProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Latest 10 office audit events (Super Admin only)
          </p>
        </div>
        <Link
          to="/permissions"
          className="text-xs font-medium text-primary hover:text-primary-hover whitespace-nowrap"
        >
          Full log
        </Link>
      </div>

      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-900">No recent activity</p>
          <p className="mt-1 text-xs text-slate-500">
            Staff actions across clients, ledger, logins, and documents will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.id} className="px-6 py-3.5 hover:bg-slate-50/80 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-900">
                  {formatDashboardActionLabel(entry.action)}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-slate-500 shrink-0">
                  {formatTimestampCompact(entry.createdAt)}
                </span>
              </div>
              {entry.details && (
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{entry.details}</p>
              )}
              <div className="mt-1 text-[11px] font-mono text-slate-400 truncate">
                {entry.userEmail}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

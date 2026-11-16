import { PieChart } from 'lucide-react';
import { ClientTypeSlice } from './dashboardTypes';

interface ClientsByTypeChartProps {
  slices: ClientTypeSlice[];
  totalClients: number;
  loading: boolean;
}

/**
 * Clean horizontal distribution chart of clients across Business Registration,
 * Land Registry, Student Visa, and Other.
 */
export function ClientsByTypeChart({
  slices,
  totalClients,
  loading,
}: ClientsByTypeChartProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Clients by Type</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribution across primary service categories
          </p>
        </div>
        <span className="text-xs font-medium tabular-nums text-slate-500">
          {loading ? '—' : `${totalClients} total`}
        </span>
      </div>

      {loading ? (
        <div className="p-6 space-y-4" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="space-y-2">
              <div className="h-3.5 w-40 rounded bg-slate-100 animate-pulse" />
              <div className="h-2 w-full rounded-full bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : totalClients === 0 ? (
        <div className="px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <PieChart className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-900">No clients yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Client category breakdown will appear once clients are added.
          </p>
        </div>
      ) : (
        <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
          {/* Stacked Proportion Strip */}
          <div
            className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex gap-0.5"
            role="img"
            aria-label="Stacked bar showing client breakdown by type"
          >
            {slices.map((slice) =>
              slice.count > 0 ? (
                <div
                  key={slice.label}
                  className={`${slice.barColor} h-full transition-all duration-300`}
                  style={{ width: `${(slice.count / totalClients) * 100}%` }}
                  title={`${slice.label}: ${slice.count} (${slice.percentage}%)`}
                />
              ) : null
            )}
          </div>

          {/* Individual Category Bars */}
          <div className="space-y-4">
            {slices.map((slice) => (
              <div key={slice.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${slice.dotColor} shrink-0`}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-slate-700">{slice.label}</span>
                  </div>
                  <div className="tabular-nums text-slate-600">
                    <span className="font-semibold text-slate-900">{slice.count}</span>
                    <span className="text-slate-400 ml-1.5">({slice.percentage}%)</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${slice.barColor} transition-all duration-300`}
                    style={{
                      width: `${totalClients > 0 ? (slice.count / totalClients) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

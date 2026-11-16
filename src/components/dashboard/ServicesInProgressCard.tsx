import { Link } from 'react-router-dom';
import { ArrowUpRight, Briefcase } from 'lucide-react';
import { CaseRecord, CaseStatus } from '../clients/clientTypes';

export interface DashboardCaseItem extends CaseRecord {
  clientName: string;
}

interface ServicesInProgressCardProps {
  cases: DashboardCaseItem[];
  loading: boolean;
}

function getCaseBadgeClass(status: CaseStatus): string {
  switch (status) {
    case 'In Progress':
      return 'bg-blue-50 text-[#1D4ED8] border-blue-200';
    case 'Submitted':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Not Started':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Rejected':
    default:
      return 'bg-red-50 text-red-700 border-red-200';
  }
}

/**
 * Shows the latest 10 active/in-progress client services with client name and status.
 */
export function ServicesInProgressCard({ cases, loading }: ServicesInProgressCardProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-[#0F2942]">
            Services in Progress
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Latest active client cases awaiting completion
          </p>
        </div>
        <Link
          to="/clients"
          className="text-xs font-medium text-[#1D4ED8] hover:text-[#0F2942] whitespace-nowrap"
        >
          All clients
        </Link>
      </div>

      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 w-full rounded-md bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-900">
            No services in progress
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Active client services will appear here as cases are opened.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Service</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {cases.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-900">{item.serviceName}</div>
                    {(item.expectedDate || item.startDate) && (
                      <div className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                        {item.expectedDate
                          ? `Due ${item.expectedDate}`
                          : `Started ${item.startDate}`}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <Link
                      to={`/clients/${item.clientId}?tab=services`}
                      className="inline-flex items-center gap-1 text-sm text-[#1D4ED8] hover:text-[#0F2942] hover:underline"
                    >
                      <span>{item.clientName}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${getCaseBadgeClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

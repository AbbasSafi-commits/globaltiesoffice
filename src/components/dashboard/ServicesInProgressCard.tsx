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
      return 'bg-blue-50 text-[#2563EB]';
    case 'Submitted':
      return 'bg-amber-50 text-amber-700';
    case 'Not Started':
      return 'bg-slate-100 text-slate-600';
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700';
    case 'Rejected':
    default:
      return 'bg-red-50 text-red-700';
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Shows the latest 10 active/in-progress client services with client name and status pill.
 */
export function ServicesInProgressCard({ cases, loading }: ServicesInProgressCardProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Services in Progress
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Latest active client cases awaiting completion
          </p>
        </div>
        <Link
          to="/clients"
          className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap"
        >
          All clients
        </Link>
      </div>

      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
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
        <div className="overflow-auto max-h-96">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">
              <tr className="text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Service</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-medium text-slate-900">{item.serviceName}</div>
                    {(item.expectedDate || item.startDate) && (
                      <div className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                        {item.expectedDate
                          ? `Due ${item.expectedDate}`
                          : `Started ${item.startDate}`}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <Link
                      to={`/clients/${item.clientId}?tab=services`}
                      className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-[#2563EB] group"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 group-hover:bg-blue-50 group-hover:text-[#2563EB]">
                        {getInitials(item.clientName)}
                      </span>
                      <span className="font-medium">{item.clientName}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-[#2563EB]" aria-hidden="true" />
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCaseBadgeClass(
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

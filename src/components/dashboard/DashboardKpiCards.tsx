import { Link } from 'react-router-dom';
import { Briefcase, Users, UserCheck, Wallet } from 'lucide-react';
import { formatPkr } from '../ledger/ledgerTypes';

interface DashboardKpiCardsProps {
  showClients: boolean;
  showLedger: boolean;
  totalClients: number;
  activeClients: number;
  pendingCases: number;
  totalBalanceDue: number;
  loadingClients: boolean;
  loadingCases: boolean;
  loadingLedger: boolean;
}

/**
 * Top KPI summary row showing only cards the staff member has permission to view.
 */
export function DashboardKpiCards({
  showClients,
  showLedger,
  totalClients,
  activeClients,
  pendingCases,
  totalBalanceDue,
  loadingClients,
  loadingCases,
  loadingLedger,
}: DashboardKpiCardsProps) {
  if (!showClients && !showLedger) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {showClients && (
        <Link
          to="/clients"
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all block"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Total Clients</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          {loadingClients ? (
            <div className="mt-3 h-8 w-16 rounded-md bg-slate-100 animate-pulse" />
          ) : (
            <div className="mt-2.5 text-2xl font-semibold tabular-nums text-slate-900">
              {totalClients.toLocaleString()}
            </div>
          )}
          <div className="mt-1 text-xs text-slate-500">Registered client profiles</div>
        </Link>
      )}

      {showClients && (
        <Link
          to="/clients"
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all block"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Active Clients</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserCheck className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          {loadingClients ? (
            <div className="mt-3 h-8 w-16 rounded-md bg-slate-100 animate-pulse" />
          ) : (
            <div className="mt-2.5 text-2xl font-semibold tabular-nums text-slate-900">
              {activeClients.toLocaleString()}
            </div>
          )}
          <div className="mt-1 text-xs text-slate-500">Currently active files</div>
        </Link>
      )}

      {showClients && (
        <Link
          to="/clients"
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all block"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Pending Cases</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Briefcase className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          {loadingCases ? (
            <div className="mt-3 h-8 w-16 rounded-md bg-slate-100 animate-pulse" />
          ) : (
            <div className="mt-2.5 text-2xl font-semibold tabular-nums text-slate-900">
              {pendingCases.toLocaleString()}
            </div>
          )}
          <div className="mt-1 text-xs text-slate-500">Services in progress</div>
        </Link>
      )}

      {showLedger && (
        <Link
          to="/ledger"
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all block"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Total Balance Due</span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                !loadingLedger && totalBalanceDue > 0
                  ? 'bg-red-50 text-red-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          {loadingLedger ? (
            <div className="mt-3 h-8 w-28 rounded-md bg-slate-100 animate-pulse" />
          ) : (
            <div
              className={`mt-2.5 text-2xl font-semibold tabular-nums ${
                totalBalanceDue > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {formatPkr(totalBalanceDue)}
            </div>
          )}
          <div className="mt-1 text-xs text-slate-500">
            {loadingLedger
              ? 'Calculating receivables...'
              : totalBalanceDue > 0
                ? 'Outstanding across clients'
                : 'All client balances settled'}
          </div>
        </Link>
      )}
    </div>
  );
}

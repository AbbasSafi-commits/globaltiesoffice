import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FolderOpen, Plus, X } from 'lucide-react';
import {
  collection,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { CaseRecord, ClientRecord } from '../components/clients/clientTypes';
import { ClientsByTypeChart } from '../components/dashboard/ClientsByTypeChart';
import { DashboardKpiCards } from '../components/dashboard/DashboardKpiCards';
import {
  computeClientTypeBreakdown,
  computeExpiryAlerts,
} from '../components/dashboard/dashboardTypes';
import { ExpiryAlertsCard } from '../components/dashboard/ExpiryAlertsCard';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard';
import { RecentPaymentsCard } from '../components/dashboard/RecentPaymentsCard';
import {
  DashboardCaseItem,
  ServicesInProgressCard,
} from '../components/dashboard/ServicesInProgressCard';
import { LedgerEntryRecord } from '../components/ledger/ledgerTypes';
import { ActivityLogRecord } from '../components/permissions/ActivityLog';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

/**
 * Main Global Ties Office dashboard displaying only the KPI cards and sections
 * that the signed-in staff member has permission to view.
 */
export function DashboardPage() {
  const { profile, isSuperAdmin, can } = useAuth();

  const canClientsView = can('clients', 'view');
  const canClientsAdd = can('clients', 'add');
  const canLedgerView = can('ledger', 'view');
  const canDocumentsView = can('documents', 'view');

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [totalClientsCount, setTotalClientsCount] = useState(0);
  const [activeClientsCount, setActiveClientsCount] = useState(0);
  const [loadingClients, setLoadingClients] = useState(canClientsView);

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [pendingCasesCount, setPendingCasesCount] = useState(0);
  const [loadingCases, setLoadingCases] = useState(canClientsView);

  const [totalBalanceDue, setTotalBalanceDue] = useState(0);
  const [recentPayments, setRecentPayments] = useState<LedgerEntryRecord[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(canLedgerView);

  const [recentActivity, setRecentActivity] = useState<ActivityLogRecord[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(isSuperAdmin);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Clients summary + chart + expiry alerts (only if can('clients', 'view'))
  useEffect(() => {
    if (!canClientsView) {
      setLoadingClients(false);
      return;
    }

    let isMounted = true;
    setLoadingClients(true);

    // Aggregate count reads for exact totals even if office grows beyond 500 clients
    Promise.all([
      getCountFromServer(collection(db, 'clients')),
      getCountFromServer(
        query(collection(db, 'clients'), where('status', '==', 'Active'))
      ),
    ])
      .then(([totalSnap, activeSnap]) => {
        if (!isMounted) return;
        setTotalClientsCount(totalSnap.data().count);
        setActiveClientsCount(activeSnap.data().count);
      })
      .catch(() => {
        // Live bounded snapshot below will populate fallback counts
      });

    const clientsQuery = query(
      collection(db, 'clients'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const list: ClientRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClientRecord, 'id'>),
        }));
        setClients(list);
        if (list.length < 500) {
          setTotalClientsCount(list.length);
          setActiveClientsCount(list.filter((c) => c.status === 'Active').length);
        }
        setLoadingClients(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'clients');
        } catch {
          setErrorMsg('Unable to load client metrics. Please check your permissions.');
          setLoadingClients(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [canClientsView]);

  // 2. Pending cases count + latest active services (only if can('clients', 'view'))
  useEffect(() => {
    if (!canClientsView) {
      setLoadingCases(false);
      return;
    }

    let isMounted = true;
    setLoadingCases(true);

    getCountFromServer(
      query(
        collection(db, 'cases'),
        where('status', 'in', ['Not Started', 'In Progress', 'Submitted'])
      )
    )
      .then((snap) => {
        if (!isMounted) return;
        setPendingCasesCount(snap.data().count);
      })
      .catch(() => {
        // Fallback count derived from bounded snapshot if needed
      });

    // Single-field orderBy avoids composite index requirements
    const casesQuery = query(
      collection(db, 'cases'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      casesQuery,
      (snapshot) => {
        const list: CaseRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CaseRecord, 'id'>),
        }));
        setCases(list);
        setLoadingCases(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'cases');
        } catch {
          setErrorMsg('Unable to load service cases. Please check your permissions.');
          setLoadingCases(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [canClientsView]);

  // 3. Total Balance Due + Latest 10 Credit Payments (only if can('ledger', 'view'))
  useEffect(() => {
    if (!canLedgerView) {
      setLoadingLedger(false);
      return;
    }

    setLoadingLedger(true);
    let balanceLoaded = false;
    let paymentsLoaded = false;

    const markReady = () => {
      if (balanceLoaded && paymentsLoaded) {
        setLoadingLedger(false);
      }
    };

    const balanceQuery = query(collection(db, 'ledger'), limit(1000));
    const unsubBalance = onSnapshot(
      balanceQuery,
      (snapshot) => {
        let netBalance = 0;
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data() as Partial<LedgerEntryRecord>;
          const amount = Number(data.amount) || 0;
          if (data.type === 'Debit') {
            netBalance += amount;
          } else if (data.type === 'Credit') {
            netBalance -= amount;
          }
        }
        setTotalBalanceDue(netBalance);
        balanceLoaded = true;
        markReady();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'ledger');
        } catch {
          setErrorMsg('Unable to load ledger balance. Please check your permissions.');
          balanceLoaded = true;
          markReady();
        }
      }
    );

    // Filter by type == 'Credit' with a bounded limit and sort client-side (no composite index needed)
    const creditsQuery = query(
      collection(db, 'ledger'),
      where('type', '==', 'Credit'),
      limit(100)
    );
    const unsubCredits = onSnapshot(
      creditsQuery,
      (snapshot) => {
        const list: LedgerEntryRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<LedgerEntryRecord, 'id'>),
        }));

        list.sort((a, b) => {
          const dateCompare = (b.date || '').localeCompare(a.date || '');
          if (dateCompare !== 0) return dateCompare;
          const aTime =
            a.createdAt && typeof a.createdAt.toDate === 'function'
              ? a.createdAt.toDate().getTime()
              : 0;
          const bTime =
            b.createdAt && typeof b.createdAt.toDate === 'function'
              ? b.createdAt.toDate().getTime()
              : 0;
          return bTime - aTime;
        });

        setRecentPayments(list.slice(0, 10));
        paymentsLoaded = true;
        markReady();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'ledger');
        } catch {
          paymentsLoaded = true;
          markReady();
        }
      }
    );

    return () => {
      unsubBalance();
      unsubCredits();
    };
  }, [canLedgerView]);

  // 4. Recent Activity Log (ONLY for super admins)
  useEffect(() => {
    if (!isSuperAdmin) {
      setLoadingActivity(false);
      return;
    }

    setLoadingActivity(true);
    const logQuery = query(
      collection(db, 'activityLog'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      logQuery,
      (snapshot) => {
        const items: ActivityLogRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ActivityLogRecord, 'id'>),
        }));
        setRecentActivity(items);
        setLoadingActivity(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'activityLog');
        } catch {
          setLoadingActivity(false);
        }
      }
    );

    return () => unsubscribe();
  }, [isSuperAdmin]);

  const clientsById = useMemo(() => {
    const map: Record<string, ClientRecord> = {};
    for (const c of clients) {
      map[c.id] = c;
    }
    return map;
  }, [clients]);

  const clientTypeSlices = useMemo(
    () => computeClientTypeBreakdown(clients),
    [clients]
  );

  const expiryAlerts = useMemo(() => computeExpiryAlerts(clients), [clients]);

  const servicesInProgress = useMemo<DashboardCaseItem[]>(() => {
    return cases
      .filter((c) => c.status !== 'Completed' && c.status !== 'Rejected')
      .slice(0, 10)
      .map((c) => ({
        ...c,
        clientName: clientsById[c.clientId]?.name || 'Client',
      }));
  }, [cases, clientsById]);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const hasAnyDashboardModule = canClientsView || canLedgerView || isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#0F2942] tracking-tight">
            Welcome back, {profile?.fullName?.split(' ')[0] || 'Staff'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {todayFormatted} · Global Ties Office overview
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {canClientsAdd && (
            <Link
              to="/clients"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163859] transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Manage Clients</span>
            </Link>
          )}
          {canDocumentsView && (
            <Link
              to="/documents"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              <span>Documents</span>
            </Link>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-700 hover:text-red-900 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <DashboardKpiCards
        showClients={canClientsView}
        showLedger={canLedgerView}
        totalClients={totalClientsCount}
        activeClients={activeClientsCount}
        pendingCases={pendingCasesCount}
        totalBalanceDue={totalBalanceDue}
        loadingClients={loadingClients}
        loadingCases={loadingCases}
        loadingLedger={loadingLedger}
      />

      {/* Fallback card when a staff role has no Clients / Ledger / Super Admin access */}
      {!hasAnyDashboardModule && (
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <h2 className="font-display text-base font-semibold text-[#0F2942]">
            Active Staff Workspace
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Your dashboard shows only the sections enabled for your account role ({profile?.role || 'Staff'}). Use the sidebar navigation to open your assigned modules.
          </p>
        </div>
      )}

      {/* Clients Overview: Chart + Expiry Alerts */}
      {canClientsView && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClientsByTypeChart
            slices={clientTypeSlices}
            totalClients={clients.length}
            loading={loadingClients}
          />
          <ExpiryAlertsCard alerts={expiryAlerts} loading={loadingClients} />
        </div>
      )}

      {/* Operations & Financial Feeds */}
      {(canClientsView || canLedgerView || isSuperAdmin) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {canClientsView && (
            <ServicesInProgressCard
              cases={servicesInProgress}
              loading={loadingCases || loadingClients}
            />
          )}

          {canLedgerView && (
            <RecentPaymentsCard
              payments={recentPayments}
              loading={loadingLedger}
            />
          )}

          {isSuperAdmin && (
            <RecentActivityCard
              entries={recentActivity}
              loading={loadingActivity}
            />
          )}
        </div>
      )}
    </div>
  );
}

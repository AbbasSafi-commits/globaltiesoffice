import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Pencil, Phone, X } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { ClientAvatar } from '../components/clients/ClientAvatar';
import { ClientBusinessTab } from '../components/clients/ClientBusinessTab';
import { ClientDetailsTab } from '../components/clients/ClientDetailsTab';
import { ClientFormModal } from '../components/clients/ClientFormModal';
import { ClientServicesTab } from '../components/clients/ClientServicesTab';
import { ClientRecord, ClientStatus } from '../components/clients/clientTypes';
import { ClientDocumentsTab } from '../components/documents/ClientDocumentsTab';
import { ClientLedgerTab } from '../components/ledger/ClientLedgerTab';
import { ClientLoginsTab } from '../components/logins/ClientLoginsTab';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

type ProfileTabKey =
  | 'details'
  | 'business'
  | 'services'
  | 'logins'
  | 'ledger'
  | 'documents';

interface ToastState {
  id: number;
  type: 'success' | 'error';
  message: string;
}

function getStatusBadgeClass(status: ClientStatus): string {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700';
    case 'Pending':
      return 'bg-amber-50 text-amber-800';
    case 'Completed':
      return 'bg-blue-50 text-primary';
    case 'On Hold':
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Detailed client profile page at /clients/:id with permission-filtered tabs
 * for Details, Business, Services, Logins, Ledger, and Documents.
 */
export function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, can } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canEditClient = can('clients', 'edit');
  const canViewBusiness = can('business_details', 'view');
  const canViewLogins = can('portal_logins', 'view');
  const canViewLedger = can('ledger', 'view');
  const canViewDocuments = can('documents', 'view');

  const initialTabParam = searchParams.get('tab') as ProfileTabKey | null;
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>(initialTabParam || 'details');
  const [showEditModal, setShowEditModal] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    const clientPath = `clients/${id}`;

    const unsubscribe = onSnapshot(
      doc(db, 'clients', id),
      (snap) => {
        if (!snap.exists()) {
          setClient(null);
          setNotFound(true);
        } else {
          setClient({
            id: snap.id,
            ...(snap.data() as Omit<ClientRecord, 'id'>),
          });
          setNotFound(false);
        }
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, clientPath);
        } catch {
          showToast('error', 'Unable to load client profile. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [id, showToast]);

  const tabs: { key: ProfileTabKey; label: string; visible: boolean }[] = [
    { key: 'details', label: 'Details', visible: true },
    { key: 'business', label: 'Business', visible: canViewBusiness },
    { key: 'documents', label: 'Documents', visible: canViewDocuments },
    { key: 'logins', label: 'Logins', visible: canViewLogins },
    { key: 'services', label: 'Services', visible: true },
    { key: 'ledger', label: 'Ledger', visible: canViewLedger },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);
  const currentTab = visibleTabs.some((t) => t.key === activeTab)
    ? activeTab
    : 'details';

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading client profile">
        <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
          <div className="h-7 w-64 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-48 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-56 animate-pulse" />
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="space-y-4">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to clients</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-xs">
          <h1 className="text-lg font-semibold text-slate-900">Client not found</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            This client record may have been deleted or the link is invalid.
          </p>
          <Link
            to="/clients"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors shadow-xs"
          >
            Return to Clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="print:hidden">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to clients</span>
        </Link>
      </div>

      {/* Profile Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="flex items-start gap-4">
          <ClientAvatar name={client.name} photoData={client.photoData} size="md" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                {client.name}
              </h1>
              {client.clientType && (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                  {client.clientType}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                  client.status
                )}`}
              >
                {client.status}
              </span>
            </div>

            {(client.mobile || client.fatherName) && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                {client.mobile && (
                  <>
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span className="font-mono tabular-nums text-slate-700">{client.mobile}</span>
                  </>
                )}
                {client.mobile && client.fatherName && (
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                )}
                {client.fatherName && <span>S/O {client.fatherName}</span>}
              </div>
            )}
          </div>
        </div>

        {canEditClient && (
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto shadow-xs cursor-pointer"
          >
            <Pencil className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200 overflow-x-auto print:hidden">
        <nav className="flex items-center gap-1" aria-label="Client profile tabs">
          {visibleTabs.map((tab) => {
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchParams(tab.key === 'details' ? {} : { tab: tab.key }, { replace: true });
                }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {currentTab === 'details' && <ClientDetailsTab client={client} />}

        {currentTab === 'business' && canViewBusiness && (
          <ClientBusinessTab
            clientId={client.id}
            clientName={client.name}
            onSuccess={(msg) => showToast('success', msg)}
            onError={(msg) => showToast('error', msg)}
          />
        )}

        {currentTab === 'services' && (
          <ClientServicesTab
            clientId={client.id}
            clientName={client.name}
            onSuccess={(msg) => showToast('success', msg)}
            onError={(msg) => showToast('error', msg)}
          />
        )}

        {currentTab === 'logins' && canViewLogins && (
          <ClientLoginsTab
            clientId={client.id}
            clientName={client.name}
            onSuccess={(msg) => showToast('success', msg)}
            onError={(msg) => showToast('error', msg)}
          />
        )}

        {currentTab === 'ledger' && canViewLedger && (
          <ClientLedgerTab
            clientId={client.id}
            clientName={client.name}
            clientMobile={client.mobile}
            onSuccess={(msg) => showToast('success', msg)}
            onError={(msg) => showToast('error', msg)}
          />
        )}

        {currentTab === 'documents' && canViewDocuments && (
          <ClientDocumentsTab
            clientId={client.id}
            clientName={client.name}
            onSuccess={(msg) => showToast('success', msg)}
            onError={(msg) => showToast('error', msg)}
          />
        )}
      </div>

      {/* Edit Client Modal */}
      {showEditModal && canEditClient && (
        <ClientFormModal
          existingClient={client}
          currentUserEmail={currentUserEmail}
          onClose={() => setShowEditModal(false)}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-[60] max-w-md rounded-lg border px-4 py-3 shadow-lg flex items-start gap-3 print:hidden ${
            toast.type === 'success'
              ? 'bg-white border-emerald-200 text-slate-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2
              className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          )}
          <p className="text-sm flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

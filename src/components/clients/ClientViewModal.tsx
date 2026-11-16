import { Pencil, X } from 'lucide-react';
import { ClientRecord, formatClientDate } from './clientTypes';

interface ClientViewModalProps {
  client: ClientRecord;
  canEdit: boolean;
  onClose: () => void;
  onEditClick: () => void;
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div
        className={`mt-1 text-sm text-slate-900 break-words ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value && value.trim().length > 0 ? value : '—'}
      </div>
    </div>
  );
}

/**
 * Read-only modal displaying full client personal, identity, and audit details.
 */
export function ClientViewModal({
  client,
  canEdit,
  onClose,
  onEditClick,
}: ClientViewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-view-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2
              id="client-view-title"
              className="font-display text-base font-semibold text-[#0F2942]"
            >
              {client.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {client.clientType}{' '}
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>{' '}
              {client.status}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
            aria-label="Close client details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="font-display text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <DetailField label="Full Name" value={client.name} />
              <DetailField label="Father Name" value={client.fatherName} />
              <DetailField label="Mobile No" value={client.mobile} mono />
              <DetailField label="Email Address" value={client.email} />
              <div className="sm:col-span-2">
                <DetailField label="Address" value={client.address} />
              </div>
            </div>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="font-display text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Identity &amp; Tax Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <DetailField label="CNIC Number" value={client.cnic} mono />
              <DetailField label="CNIC Issue Date" value={client.cnicIssueDate} mono />
              <DetailField label="CNIC Expiry Date" value={client.cnicExpiryDate} mono />
              <DetailField label="Passport Number" value={client.passportNumber} mono />
              <DetailField label="Passport Issue Date" value={client.passportIssueDate} mono />
              <DetailField label="Passport Expiry Date" value={client.passportExpiryDate} mono />
              <DetailField label="NTN" value={client.ntn} mono />
            </div>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="font-display text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Notes &amp; Audit Trail
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {client.notes?.trim() ? client.notes : 'No notes recorded.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs text-slate-500">
              <div>
                Added: <span className="font-mono text-slate-700">{formatClientDate(client.createdAt)}</span>
                {client.createdBy ? ` by ${client.createdBy}` : ''}
              </div>
              <div>
                Updated: <span className="font-mono text-slate-700">{formatClientDate(client.updatedAt)}</span>
                {client.updatedBy ? ` by ${client.updatedBy}` : ''}
              </div>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Close
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={onEditClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163859] transition-colors cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit Client</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

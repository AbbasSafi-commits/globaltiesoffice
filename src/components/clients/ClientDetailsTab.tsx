import { AlertTriangle } from 'lucide-react';
import { ClientRecord, formatClientDate, getExpiryWarning } from './clientTypes';

interface ClientDetailsTabProps {
  client: ClientRecord;
}

function ReadOnlyField({
  label,
  value,
  mono = false,
  badge,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  badge?: { level: 'expired' | 'soon' | null; label: string };
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span
          className={`text-sm text-slate-900 break-words ${
            mono ? 'font-mono tabular-nums' : ''
          }`}
        >
          {value && value.trim().length > 0 ? value : '—'}
        </span>

        {badge && badge.level && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              badge.level === 'expired'
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{badge.label}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Read-only cards displaying client personal, identity (with CNIC/Passport expiry warnings),
 * and notes metadata.
 */
export function ClientDetailsTab({ client }: ClientDetailsTabProps) {
  const cnicWarning = getExpiryWarning(client.cnicExpiryDate);
  const passportWarning = getExpiryWarning(client.passportExpiryDate);

  return (
    <div className="space-y-6">
      {/* Personal Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Personal Information
        </h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <ReadOnlyField label="Full Name" value={client.name} />
          <ReadOnlyField label="Father Name" value={client.fatherName} />
          <ReadOnlyField label="Mobile No" value={client.mobile} mono />
          <ReadOnlyField label="Email Address" value={client.email} />
          <ReadOnlyField label="Client Type" value={client.clientType} />
          <ReadOnlyField label="Status" value={client.status} />
          <div className="sm:col-span-2 lg:col-span-3">
            <ReadOnlyField label="Address" value={client.address} />
          </div>
        </div>
      </section>

      {/* Identity Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Identity &amp; Tax Information
        </h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <ReadOnlyField label="CNIC Number" value={client.cnic} mono />
          <ReadOnlyField label="CNIC Issue Date" value={client.cnicIssueDate} mono />
          <ReadOnlyField
            label="CNIC Expiry Date"
            value={client.cnicExpiryDate}
            mono
            badge={cnicWarning}
          />
          <ReadOnlyField label="Passport Number" value={client.passportNumber} mono />
          <ReadOnlyField label="Passport Issue Date" value={client.passportIssueDate} mono />
          <ReadOnlyField
            label="Passport Expiry Date"
            value={client.passportExpiryDate}
            mono
            badge={passportWarning}
          />
          <ReadOnlyField label="NTN" value={client.ntn} mono />
          <ReadOnlyField label="INC No" value={client.incNo} mono />
          <ReadOnlyField label="Tax Year" value={client.taxYear} mono />
          <ReadOnlyField label="INC Date" value={client.incDate} mono />
          <ReadOnlyField label="Registration Date" value={client.registrationDate} mono />
          <ReadOnlyField label="Tax Filing Date" value={client.taxFilingDate} mono />
        </div>
      </section>

      {/* Notes & Audit Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Notes &amp; Record Info
        </h2>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {client.notes?.trim() ? client.notes : 'No notes recorded for this client.'}
          </p>
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-x-8 gap-y-2 text-xs text-slate-500">
            <div>
              Added:{' '}
              <span className="font-mono text-slate-700">
                {formatClientDate(client.createdAt)}
              </span>
              {client.createdBy ? ` (${client.createdBy})` : ''}
            </div>
            <div>
              Last Updated:{' '}
              <span className="font-mono text-slate-700">
                {formatClientDate(client.updatedAt)}
              </span>
              {client.updatedBy ? ` (${client.updatedBy})` : ''}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

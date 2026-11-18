import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { DocumentListSection } from './DocumentListSection';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentRecord } from './documentTypes';

interface ClientDocumentsTabProps {
  clientId: string;
  clientName: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Client Documents tab inside /clients/:id displaying uploaded documents
 * and multi-file upload controls gated by can('documents', action).
 */
export function ClientDocumentsTab({
  clientId,
  clientName,
  onSuccess,
  onError,
}: ClientDocumentsTabProps) {
  const { profile, can } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canAdd = can('documents', 'add');
  const canDelete = can('documents', 'delete');

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    const docsQuery = query(
      collection(db, 'documents'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(
      docsQuery,
      (snapshot) => {
        const list: DocumentRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<DocumentRecord, 'id'>),
        }));
        setDocuments(list);
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'documents');
        } catch {
          onError('Unable to load client documents. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [clientId, onError]);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Client Documents</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Securely archived JPG, PNG, and PDF files for {clientName}. Files are loaded on demand.
          </p>
        </div>

        {canAdd && (
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto shadow-xs cursor-pointer"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Upload Documents</span>
          </button>
        )}
      </div>

      {/* Document Archive Table / Grid */}
      <DocumentListSection
        documents={documents}
        loading={loading}
        currentUserEmail={currentUserEmail}
        canDelete={canDelete}
        emptyTitle="No documents uploaded for this client"
        emptySubtitle={
          canAdd
            ? 'Click "Upload Documents" to add CNIC scans, passports, photos, or PDF files.'
            : 'No documents have been uploaded for this client yet.'
        }
        onSuccess={onSuccess}
        onError={onError}
      />

      {/* Upload Modal */}
      {showUploadModal && canAdd && (
        <DocumentUploadModal
          clientId={clientId}
          clientName={clientName}
          currentUserEmail={currentUserEmail}
          onClose={() => setShowUploadModal(false)}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </div>
  );
}

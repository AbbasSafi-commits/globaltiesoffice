import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

export const DOCUMENT_CATEGORIES = [
  'CNIC',
  'Passport',
  'Photo',
  'Business Registration',
  'Land Documents',
  'Visa Documents',
  'Bank Statement',
  'Other',
] as const;

/**
 * Storage rule enforces `request.resource.size < 10 * 1024 * 1024`.
 */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export interface DocumentRecord {
  id: string;
  clientId: string;
  clientName?: string;
  fileName: string;
  storagePath: string;
  category: string;
  note?: string;
  fileType: string;
  size: number;
  uploadedBy: string;
  createdAt?: { toDate?: () => Date } | null;
}

export type DocumentActivityAction =
  | 'uploaded_document'
  | 'viewed_document'
  | 'downloaded_document'
  | 'deleted_document';

/**
 * Normalizes and validates allowed document file types (JPG, PNG, PDF) and 10 MB max size.
 */
export function validateDocumentFile(file: File): {
  valid: boolean;
  normalizedType: string;
  error?: string;
} {
  const lowerName = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();

  let normalizedType = '';
  if (mime === 'image/jpeg' || mime === 'image/jpg' || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    normalizedType = 'image/jpeg';
  } else if (mime === 'image/png' || lowerName.endsWith('.png')) {
    normalizedType = 'image/png';
  } else if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    normalizedType = 'application/pdf';
  }

  if (!normalizedType) {
    return {
      valid: false,
      normalizedType: '',
      error: `"${file.name}" is not a supported format. Only JPG, PNG, and PDF files are allowed.`,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      normalizedType,
      error: `"${file.name}" appears to be empty.`,
    };
  }

  if (file.size >= MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      normalizedType,
      error: `"${file.name}" exceeds the 10 MB maximum file size.`,
    };
  }

  return {
    valid: true,
    normalizedType,
  };
}

/**
 * Sanitizes a filename for safe Firebase Storage paths while keeping its extension.
 */
export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  const rawBase = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const rawExt = lastDot > 0 ? trimmed.slice(lastDot + 1) : '';

  const safeBase = rawBase
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);

  const finalBase = safeBase || 'document';
  return safeExt ? `${finalBase}.${safeExt}` : finalBase;
}

/**
 * Formats byte count into readable B / KB / MB units.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Formats a Firestore timestamp for document lists.
 */
export function formatDocumentDate(ts?: { toDate?: () => Date } | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Returns true if the document is an image (JPG or PNG) suitable for modal preview.
 */
export function isImageDocument(fileType: string, fileName = ''): boolean {
  const lowerType = (fileType || '').toLowerCase();
  const lowerName = fileName.toLowerCase();
  return (
    lowerType === 'image/jpeg' ||
    lowerType === 'image/jpg' ||
    lowerType === 'image/png' ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png')
  );
}

/**
 * Translates Firebase Storage / Firestore errors into clear, actionable office toast messages.
 */
export function getFriendlyDocumentError(err: unknown, context: string): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return `Network offline: unable to ${context}. Check your internet connection and try again.`;
  }

  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const message = err instanceof Error ? err.message : String(err || '');

  if (
    code === 'storage/unauthorized' ||
    code === 'permission-denied' ||
    message.toLowerCase().includes('permission') ||
    message.toLowerCase().includes('unauthorized')
  ) {
    return `Permission denied: you do not have access to ${context}. Note: if using non-owner accounts with Firebase Storage rules, ensure Storage rules allow access.`;
  }

  if (code === 'storage/object-not-found') {
    return 'The requested file could not be found in Firebase Storage.';
  }

  if (code === 'storage/quota-exceeded') {
    return 'Storage quota exceeded. Please contact the system administrator.';
  }

  if (
    code === 'storage/retry-limit-exceeded' ||
    code === 'storage/canceled' ||
    code === 'unavailable' ||
    message.toLowerCase().includes('network')
  ) {
    return `Network error while trying to ${context}. Please try again.`;
  }

  return `Could not ${context}. ${message || 'Please try again.'}`;
}

/**
 * Triggers a browser file download from a temporary Firebase Storage URL.
 * Attempts a Blob download first to preserve the exact filename, falling back to anchor download.
 */
export async function triggerBrowserFileDownload(url: string, fileName: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback if bucket CORS prevents fetch()
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Opens a temporary Storage URL in a new browser tab without calling window.open().
 */
export function openDocumentInNewTab(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Appends an audit entry to Firestore's activityLog collection for document actions.
 */
export async function logDocumentActivity(params: {
  userEmail: string;
  action: DocumentActivityAction;
  clientId: string;
  targetId: string;
  details: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'activityLog'), {
      userEmail: params.userEmail.toLowerCase(),
      action: params.action,
      module: 'documents',
      clientId: params.clientId,
      targetId: params.targetId,
      details: params.details,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'activityLog');
  }
}

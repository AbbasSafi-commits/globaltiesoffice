import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
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
 * Max allowed file size per uploaded document (5 MB).
 */
export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Max base64 characters per chunk stored in Firestore subcollection `documents/{docId}/chunks/{index}`.
 */
export const CHUNK_SIZE_CHARS = 700_000;

/**
 * Max pixel dimension on the longest side when compressing uploaded images in the browser.
 */
const MAX_IMAGE_DIMENSION_PX = 1600;
const JPEG_COMPRESSION_QUALITY = 0.8;

export interface DocumentRecord {
  id: string;
  clientId: string;
  clientName?: string;
  fileName: string;
  category: string;
  note?: string;
  fileType: string;
  size: number;
  chunkCount?: number;
  uploadedBy: string;
  createdAt?: { toDate?: () => Date } | null;
}

export type DocumentActivityAction =
  | 'uploaded_document'
  | 'viewed_document'
  | 'downloaded_document'
  | 'deleted_document';

/**
 * Normalizes and validates allowed document file types (JPG, PNG, PDF) and 5 MB max size.
 */
export function validateDocumentFile(file: File): {
  valid: boolean;
  normalizedType: string;
  error?: string;
} {
  const lowerName = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();

  let normalizedType = '';
  if (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg')
  ) {
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

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      normalizedType,
      error: `"${file.name}" exceeds the 5 MB maximum file size.`,
    };
  }

  return {
    valid: true,
    normalizedType,
  };
}

/**
 * Compresses and resizes JPG/PNG images in the browser using an HTML5 canvas
 * (max 1600px on longest side, JPEG quality 0.8). PDFs are returned unmodified.
 */
export async function prepareDocumentBlob(
  file: File,
  normalizedType: string
): Promise<{ blob: Blob; fileType: string; size: number }> {
  if (normalizedType === 'application/pdf') {
    return {
      blob: file,
      fileType: 'application/pdf',
      size: file.size,
    };
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error(`Unable to read image "${file.name}" for compression.`));
      element.src = imageUrl;
    });

    const srcWidth = img.naturalWidth || img.width;
    const srcHeight = img.naturalHeight || img.height;
    const longestSide = Math.max(srcWidth, srcHeight);

    const scale =
      longestSide > MAX_IMAGE_DIMENSION_PX
        ? MAX_IMAGE_DIMENSION_PX / longestSide
        : 1;
    const targetWidth = Math.max(1, Math.round(srcWidth * scale));
    const targetHeight = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas is unavailable for image compression.');
    }

    // Fill white background so transparent PNGs encode cleanly as JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error(`Failed to compress image "${file.name}".`));
          }
        },
        'image/jpeg',
        JPEG_COMPRESSION_QUALITY
      );
    });

    return {
      blob: compressedBlob,
      fileType: 'image/jpeg',
      size: compressedBlob.size,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

/**
 * Converts a Blob into a raw base64 string (without the data URL prefix).
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error('Failed to encode file to base64.'));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read file bytes.'));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Splits a base64 string into fixed-size chunks for Firestore subcollection storage.
 */
export function splitBase64IntoChunks(
  base64Data: string,
  chunkSize = CHUNK_SIZE_CHARS
): string[] {
  if (!base64Data) return [''];
  const chunks: string[] = [];
  for (let offset = 0; offset < base64Data.length; offset += chunkSize) {
    chunks.push(base64Data.slice(offset, offset + chunkSize));
  }
  return chunks;
}

/**
 * Converts a joined base64 string back into a Blob using the stored MIME type.
 */
export function base64ToBlob(base64Data: string, fileType: string): Blob {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: fileType || 'application/octet-stream' });
}

/**
 * Reads all chunks from `documents/{docId}/chunks` ordered by `index`,
 * joins their base64 payloads, and returns a Blob with the stored `fileType`.
 */
export async function readDocumentChunksToBlob(
  docId: string,
  fileType: string
): Promise<Blob> {
  const chunksQuery = query(
    collection(db, 'documents', docId, 'chunks'),
    orderBy('index', 'asc')
  );
  const snapshot = await getDocs(chunksQuery);
  if (snapshot.empty) {
    throw new Error('Document data chunks were not found in Firestore.');
  }

  const orderedParts: string[] = snapshot.docs.map((chunkDoc) => {
    const data = chunkDoc.data() as { data?: string };
    return typeof data.data === 'string' ? data.data : '';
  });

  return base64ToBlob(orderedParts.join(''), fileType);
}

/**
 * Deletes every chunk in `documents/{docId}/chunks` first,
 * then deletes the parent metadata document in `documents/{docId}`.
 */
export async function deleteDocumentWithChunks(docId: string): Promise<void> {
  const chunksSnapshot = await getDocs(collection(db, 'documents', docId, 'chunks'));
  for (const chunkDoc of chunksSnapshot.docs) {
    await deleteDoc(doc(db, 'documents', docId, 'chunks', chunkDoc.id));
  }
  await deleteDoc(doc(db, 'documents', docId));
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
 * Smartly truncates long file names while preserving the end of the name and extension
 * (e.g. "WhatsApp Image 2026-1...24 AM.jpeg").
 */
export function formatSmartFileName(fileName: string, maxLength = 34): string {
  const clean = (fileName || '').trim();
  if (clean.length <= maxLength) return clean;

  const dotIdx = clean.lastIndexOf('.');
  const extLen = dotIdx > 0 ? clean.length - dotIdx : 0;
  const tailLength = Math.max(8, Math.min(extLen + 4, 14));
  const headLength = Math.max(8, maxLength - tailLength - 3);

  if (headLength + tailLength + 3 >= clean.length) {
    return clean;
  }

  return `${clean.slice(0, headLength)}...${clean.slice(-tailLength)}`;
}

/**
 * Returns a short uppercase file type label (e.g. "JPEG", "PNG", "PDF") for secondary metadata.
 */
export function getDocumentTypeLabel(fileType: string, fileName = ''): string {
  const lowerType = (fileType || '').toLowerCase();
  const lowerName = fileName.toLowerCase();
  if (lowerType === 'application/pdf' || lowerName.endsWith('.pdf')) return 'PDF';
  if (lowerType === 'image/png' || lowerName.endsWith('.png')) return 'PNG';
  if (
    lowerType === 'image/jpeg' ||
    lowerType === 'image/jpg' ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg')
  ) {
    return 'JPEG';
  }
  const dotIdx = lowerName.lastIndexOf('.');
  if (dotIdx > 0 && dotIdx < lowerName.length - 1) {
    return lowerName.slice(dotIdx + 1).toUpperCase();
  }
  return 'FILE';
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

export function extractFirebaseErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code?: unknown }).code || '').trim();
  }
  return '';
}

/**
 * Translates Firestore document errors into clear office toast messages
 * while always preserving the real Firebase error code when present.
 */
export function getFriendlyDocumentError(err: unknown, context: string): string {
  const code = extractFirebaseErrorCode(err);
  const codeSuffix = code ? ` (${code})` : '';
  const message = err instanceof Error ? err.message : String(err || '');

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return `Network offline${codeSuffix}: unable to ${context}. Check your internet connection and try again.`;
  }

  if (
    code === 'permission-denied' ||
    message.toLowerCase().includes('permission') ||
    message.toLowerCase().includes('unauthorized')
  ) {
    return `Permission denied${codeSuffix}: you do not have access to ${context}.`;
  }

  if (code === 'not-found') {
    return `The requested document could not be found in Firestore${codeSuffix}.`;
  }

  if (code === 'resource-exhausted') {
    return `Firestore quota or size limit exceeded${codeSuffix}.`;
  }

  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    message.toLowerCase().includes('network')
  ) {
    return `Network error${codeSuffix} while trying to ${context}. Please try again.`;
  }

  return `Could not ${context}${codeSuffix}. ${message || 'Please try again.'}`;
}

/**
 * Triggers a browser download from an Object URL with the original fileName,
 * then revokes the Object URL once the download starts.
 */
export function triggerBrowserObjectUrlDownload(
  objectUrl: string,
  fileName: string
): void {
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Opens an Object URL in a new browser tab without calling window.open(),
 * then revokes the Object URL after giving the browser tab time to load it.
 */
export function openDocumentObjectUrlInNewTab(objectUrl: string): void {
  const link = document.createElement('a');
  link.href = objectUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
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

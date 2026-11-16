import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

interface LogPermissionEventParams {
  userEmail: string;
  action: 'invited_user' | 'updated_permissions' | 'disabled_user' | 'enabled_user' | 'deleted_user';
  targetEmail: string;
  details: string;
}

/**
 * Appends an immutable audit log entry to the Firestore activityLog collection.
 */
export async function logPermissionActivity({
  userEmail,
  action,
  targetEmail,
  details,
}: LogPermissionEventParams): Promise<void> {
  try {
    await addDoc(collection(db, 'activityLog'), {
      userEmail: userEmail.toLowerCase(),
      action,
      module: 'permissions',
      targetEmail: targetEmail.toLowerCase(),
      details,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'activityLog');
  }
}

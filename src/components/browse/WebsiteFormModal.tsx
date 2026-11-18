import React, { useState } from 'react';
import { X } from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  isValidHttpsUrl,
  logBrowseActivity,
  PRESET_WEBSITE_CATEGORIES,
  WebsiteRecord,
} from './browseTypes';

interface WebsiteFormModalProps {
  existingWebsite?: WebsiteRecord | null;
  defaultSortOrder: number;
  currentUserEmail: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function resolveInitialCategory(category?: string): {
  dropdown: string;
  custom: string;
} {
  if (!category) {
    return { dropdown: 'Tax', custom: '' };
  }
  const isPreset = (PRESET_WEBSITE_CATEGORIES as readonly string[]).includes(category);
  if (isPreset && category !== 'Other') {
    return { dropdown: category, custom: '' };
  }
  if (category === 'Other') {
    return { dropdown: 'Other', custom: '' };
  }
  return { dropdown: 'Other', custom: category };
}

/**
 * Super Admin modal for adding or editing a website entry in Firestore's websites collection.
 */
export function WebsiteFormModal({
  existingWebsite,
  defaultSortOrder,
  currentUserEmail,
  onClose,
  onSuccess,
  onError,
}: WebsiteFormModalProps) {
  const isEditMode = Boolean(existingWebsite);
  const initialCat = resolveInitialCategory(existingWebsite?.category);

  const [name, setName] = useState(existingWebsite?.name || '');
  const [url, setUrl] = useState(existingWebsite?.url || 'https://');
  const [categoryDropdown, setCategoryDropdown] = useState(initialCat.dropdown);
  const [customCategory, setCustomCategory] = useState(initialCat.custom);
  const [description, setDescription] = useState(existingWebsite?.description || '');
  const [sortOrder, setSortOrder] = useState(
    existingWebsite?.sortOrder !== undefined ? String(existingWebsite.sortOrder) : String(defaultSortOrder)
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanUrl = url.trim();
    const cleanDescription = description.trim();
    const resolvedCategory =
      categoryDropdown === 'Other'
        ? customCategory.trim() || 'Other'
        : categoryDropdown;
    const parsedSortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;

    if (!cleanName) {
      setValidationError('Website name is required.');
      return;
    }
    if (cleanName.length > 120) {
      setValidationError('Website name must be 120 characters or fewer.');
      return;
    }
    if (!cleanUrl) {
      setValidationError('Website URL is required.');
      return;
    }
    if (!isValidHttpsUrl(cleanUrl)) {
      setValidationError('URL must start with https:// and be a valid web address (e.g. https://iris.fbr.gov.pk).');
      return;
    }
    if (resolvedCategory.length > 60) {
      setValidationError('Category must be 60 characters or fewer.');
      return;
    }

    setValidationError(null);
    setSubmitting(true);

    try {
      if (isEditMode && existingWebsite) {
        const path = `websites/${existingWebsite.id}`;
        try {
          await updateDoc(doc(db, 'websites', existingWebsite.id), {
            name: cleanName,
            url: cleanUrl,
            category: resolvedCategory,
            description: cleanDescription,
            sortOrder: parsedSortOrder,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserEmail.toLowerCase(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }

        try {
          await logBrowseActivity({
            userEmail: currentUserEmail,
            action: 'updated_website',
            websiteName: cleanName,
            targetId: existingWebsite.id,
            details: `Updated website "${cleanName}" (${resolvedCategory})`,
          });
        } catch {
          // Non-fatal
        }

        onSuccess(`Website "${cleanName}" updated successfully.`);
      } else {
        let createdId = '';
        try {
          const docRef = await addDoc(collection(db, 'websites'), {
            name: cleanName,
            url: cleanUrl,
            category: resolvedCategory,
            description: cleanDescription,
            sortOrder: parsedSortOrder,
            createdAt: serverTimestamp(),
            createdBy: currentUserEmail.toLowerCase(),
          });
          createdId = docRef.id;
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'websites');
        }

        try {
          await logBrowseActivity({
            userEmail: currentUserEmail,
            action: 'added_website',
            websiteName: cleanName,
            targetId: createdId,
            details: `Added website "${cleanName}" (${resolvedCategory})`,
          });
        } catch {
          // Non-fatal
        }

        onSuccess(`Website "${cleanName}" added successfully.`);
      }

      onClose();
    } catch (err) {
      console.error('Failed to save website:', err);
      onError('Unable to save website. Please check your permissions and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="website-form-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h2 id="website-form-title" className="text-base font-semibold text-slate-900">
              {isEditMode ? 'Edit Website' : 'Add Website'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditMode
                ? 'Update website details and category.'
                : 'Add a frequently used portal or official website for staff.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close website form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {validationError && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {validationError}
              </div>
            )}

            <div>
              <label
                htmlFor="website-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Website Name <span className="text-red-600">*</span>
              </label>
              <input
                id="website-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                placeholder="e.g. FBR IRIS Portal"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>

            <div>
              <label
                htmlFor="website-url"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                URL (must start with https://) <span className="text-red-600">*</span>
              </label>
              <input
                id="website-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                maxLength={500}
                required
                placeholder="https://iris.fbr.gov.pk"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="website-category"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  id="website-category"
                  value={categoryDropdown}
                  onChange={(e) => setCategoryDropdown(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                >
                  {PRESET_WEBSITE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="website-sort"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Sort Order
                </label>
                <input
                  id="website-sort"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>

            {categoryDropdown === 'Other' && (
              <div>
                <label
                  htmlFor="website-custom-category"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Custom Category (optional)
                </label>
                <input
                  id="website-custom-category"
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Chambers, Excise, Utilities"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="website-description"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Description (optional)
              </label>
              <textarea
                id="website-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                placeholder="Short note on what this portal is used for..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
            >
              {submitting
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Add Website'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

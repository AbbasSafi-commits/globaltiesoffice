import React, { useRef, useState } from 'react';
import { Link2, Trash2, Upload, X } from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  isValidHttpsUrl,
  logBrowseActivity,
  PRESET_WEBSITE_CATEGORIES,
  resizeIconToDataUrl,
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

const MAX_ICON_FILE_BYTES = 500 * 1024; // 500 KB
const ALLOWED_ICON_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.ico'];

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
 * Super Admin modal for adding or editing a website shortcut in Firestore's websites collection,
 * including optional custom icon upload (resized to 128x128 PNG data URL) or image link.
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
  const [iconMode, setIconMode] = useState<'upload' | 'link'>(
    existingWebsite?.iconUrl && !existingWebsite?.iconData ? 'link' : 'upload'
  );
  const [iconData, setIconData] = useState(existingWebsite?.iconData || '');
  const [iconUrl, setIconUrl] = useState(existingWebsite?.iconUrl || '');
  const [processingIcon, setProcessingIcon] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const [categoryDropdown, setCategoryDropdown] = useState(initialCat.dropdown);
  const [customCategory, setCustomCategory] = useState(initialCat.custom);
  const [description, setDescription] = useState(existingWebsite?.description || '');
  const [sortOrder, setSortOrder] = useState(
    existingWebsite?.sortOrder !== undefined
      ? String(existingWebsite.sortOrder)
      : String(defaultSortOrder)
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const hasAllowedExt = ALLOWED_ICON_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasAllowedExt) {
      setValidationError('Please select a PNG, JPG, SVG, or ICO image file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_ICON_FILE_BYTES) {
      setValidationError('Icon file must be 500 KB or smaller.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setValidationError(null);
    setProcessingIcon(true);
    try {
      const resizedPng = await resizeIconToDataUrl(file, 128);
      setIconData(resizedPng);
      setIconUrl('');
      setPreviewFailed(false);
    } catch (err) {
      console.error('Failed to process icon image:', err);
      setValidationError('Could not process that image. Please try another PNG, JPG, SVG, or ICO.');
    } finally {
      setProcessingIcon(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveCustomIcon = () => {
    setIconData('');
    setIconUrl('');
    setPreviewFailed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanUrl = url.trim();
    const cleanIconData = iconMode === 'upload' ? iconData.trim() : '';
    const cleanIconUrl = iconMode === 'link' ? iconUrl.trim() : '';
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
      setValidationError(
        'URL must start with https:// and be a valid web address (e.g. https://iris.fbr.gov.pk).'
      );
      return;
    }
    if (cleanIconUrl && !isValidHttpsUrl(cleanIconUrl)) {
      setValidationError('Icon link must start with https:// and be a valid image URL.');
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
            iconData: cleanIconData,
            iconUrl: cleanIconUrl,
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
            iconData: cleanIconData,
            iconUrl: cleanIconUrl,
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

  const activePreviewSrc = iconMode === 'upload' ? iconData : iconUrl.trim();
  const hasCustomIcon = Boolean(iconData || iconUrl.trim());

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
              {isEditMode ? 'Edit Shortcut' : 'Add Shortcut'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditMode
                ? 'Update shortcut details and optional custom icon.'
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

            {/* Custom Icon Section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">
                  Icon <span className="text-slate-400 font-normal">(optional)</span>
                </span>

                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIconMode('upload');
                      setPreviewFailed(false);
                    }}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                      iconMode === 'upload'
                        ? 'bg-[#2563EB] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="h-3 w-3" aria-hidden="true" />
                    <span>Upload image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIconMode('link');
                      setPreviewFailed(false);
                    }}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                      iconMode === 'link'
                        ? 'bg-[#2563EB] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Link2 className="h-3 w-3" aria-hidden="true" />
                    <span>Paste image link</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Live Preview Circle */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/10 p-3 overflow-hidden border border-slate-200/80">
                  {activePreviewSrc && !previewFailed ? (
                    <img
                      src={activePreviewSrc}
                      alt="Icon preview"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain"
                      onError={() => setPreviewFailed(true)}
                    />
                  ) : (
                    <span className="text-base font-semibold text-[#2563EB]">
                      {name.trim() ? name.trim()[0].toUpperCase() : '?'}
                    </span>
                  )}
                </div>

                {/* Upload or Paste Input */}
                <div className="flex-1 min-w-0 space-y-2">
                  {iconMode === 'upload' ? (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.svg,.ico,image/png,image/jpeg,image/svg+xml,image/x-icon"
                        onChange={handleIconFileChange}
                        disabled={processingIcon || submitting}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={processingIcon || submitting}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>
                          {processingIcon
                            ? 'Resizing...'
                            : iconData
                              ? 'Replace image'
                              : 'Choose PNG, JPG, SVG, or ICO'}
                        </span>
                      </button>
                      <p className="text-[11px] text-slate-500">
                        Max 500 KB. Automatically resized to 128×128 PNG.
                      </p>
                    </>
                  ) : (
                    <input
                      id="website-icon-url"
                      type="url"
                      value={iconUrl}
                      onChange={(e) => {
                        setIconUrl(e.target.value);
                        setPreviewFailed(false);
                      }}
                      maxLength={500}
                      placeholder="https://example.com/logo.png"
                      aria-label="Paste image link"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  )}

                  {hasCustomIcon && (
                    <button
                      type="button"
                      onClick={handleRemoveCustomIcon}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      <span>Remove custom icon</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="website-category"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Category
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
                rows={2}
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
              disabled={submitting || processingIcon}
              className="rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
            >
              {submitting
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Add Shortcut'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

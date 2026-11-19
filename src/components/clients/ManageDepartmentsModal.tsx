import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ServiceDepartmentRecord } from './clientTypes';

interface ManageDepartmentsModalProps {
  departments: ServiceDepartmentRecord[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Super-admin modal for managing Firestore "serviceDepartments":
 * add, rename, reorder, and delete departments and their sub categories.
 */
export function ManageDepartmentsModal({
  departments,
  onClose,
  onSuccess,
  onError,
}: ManageDepartmentsModalProps) {
  const [newDeptName, setNewDeptName] = useState('');
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(
    departments[0]?.id || null
  );
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [newSubInputs, setNewSubInputs] = useState<Record<string, string>>({});
  const [editingSub, setEditingSub] = useState<{
    deptId: string;
    index: number;
    value: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDeptName.trim();
    if (!clean) return;

    const duplicate = departments.some(
      (d) => d.name.toLowerCase() === clean.toLowerCase()
    );
    if (duplicate) {
      onError(`Department "${clean}" already exists.`);
      return;
    }

    setBusy(true);
    try {
      const nextOrder =
        departments.length > 0
          ? Math.max(...departments.map((d) => d.sortOrder ?? 0)) + 1
          : 0;
      const ref = await addDoc(collection(db, 'serviceDepartments'), {
        name: clean,
        subCategories: [],
        sortOrder: nextOrder,
      });
      setNewDeptName('');
      setExpandedDeptId(ref.id);
      onSuccess(`Department "${clean}" added.`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, 'serviceDepartments');
      } catch {
        onError('Unable to add department.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRenameDepartment = async (dept: ServiceDepartmentRecord) => {
    const clean = editingDeptName.trim();
    if (!clean || clean === dept.name) {
      setEditingDeptId(null);
      return;
    }

    setBusy(true);
    try {
      await updateDoc(doc(db, 'serviceDepartments', dept.id), { name: clean });
      setEditingDeptId(null);
      onSuccess(`Department renamed to "${clean}".`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `serviceDepartments/${dept.id}`);
      } catch {
        onError('Unable to rename department.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleMoveDepartment = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= departments.length) return;

    const current = departments[index];
    const target = departments[targetIndex];
    setBusy(true);
    try {
      await Promise.all([
        updateDoc(doc(db, 'serviceDepartments', current.id), {
          sortOrder: targetIndex,
        }),
        updateDoc(doc(db, 'serviceDepartments', target.id), {
          sortOrder: index,
        }),
      ]);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, 'serviceDepartments');
      } catch {
        onError('Unable to reorder departments.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDepartment = async (dept: ServiceDepartmentRecord) => {
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'serviceDepartments', dept.id));
      if (expandedDeptId === dept.id) setExpandedDeptId(null);
      onSuccess(`Department "${dept.name}" deleted.`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `serviceDepartments/${dept.id}`);
      } catch {
        onError('Unable to delete department.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddSubCategory = async (dept: ServiceDepartmentRecord) => {
    const clean = (newSubInputs[dept.id] || '').trim();
    if (!clean) return;

    const existing = dept.subCategories || [];
    if (existing.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      onError(`Sub category "${clean}" already exists under ${dept.name}.`);
      return;
    }

    setBusy(true);
    try {
      await updateDoc(doc(db, 'serviceDepartments', dept.id), {
        subCategories: [...existing, clean],
      });
      setNewSubInputs((prev) => ({ ...prev, [dept.id]: '' }));
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `serviceDepartments/${dept.id}`);
      } catch {
        onError('Unable to add sub category.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSubRename = async (dept: ServiceDepartmentRecord, index: number) => {
    if (!editingSub) return;
    const clean = editingSub.value.trim();
    if (!clean) {
      setEditingSub(null);
      return;
    }

    const updated = [...(dept.subCategories || [])];
    updated[index] = clean;

    setBusy(true);
    try {
      await updateDoc(doc(db, 'serviceDepartments', dept.id), {
        subCategories: updated,
      });
      setEditingSub(null);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `serviceDepartments/${dept.id}`);
      } catch {
        onError('Unable to rename sub category.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleMoveSubCategory = async (
    dept: ServiceDepartmentRecord,
    index: number,
    direction: -1 | 1
  ) => {
    const list = [...(dept.subCategories || [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    setBusy(true);
    try {
      await updateDoc(doc(db, 'serviceDepartments', dept.id), {
        subCategories: list,
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `serviceDepartments/${dept.id}`);
      } catch {
        onError('Unable to reorder sub categories.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSubCategory = async (
    dept: ServiceDepartmentRecord,
    index: number
  ) => {
    const updated = (dept.subCategories || []).filter((_, i) => i !== index);
    setBusy(true);
    try {
      await updateDoc(doc(db, 'serviceDepartments', dept.id), {
        subCategories: updated,
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `serviceDepartments/${dept.id}`);
      } catch {
        onError('Unable to remove sub category.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-departments-title"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h3
              id="manage-departments-title"
              className="text-base font-semibold text-slate-900"
            >
              Manage Service Departments
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add, rename, reorder, or delete departments and their sub categories. &ldquo;Other&rdquo; is always shown at the end of both dropdowns.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close manage departments modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-page/50">
          {/* Add Department Form */}
          <form onSubmit={handleAddDepartment} className="flex items-center gap-2">
            <input
              type="text"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              maxLength={80}
              placeholder="New department name (e.g. PRA, KPRA, IPO)..."
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={busy || !newDeptName.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Department</span>
            </button>
          </form>

          {/* Departments List */}
          <div className="space-y-2.5">
            {departments.map((dept, index) => {
              const isExpanded = expandedDeptId === dept.id;
              const isEditing = editingDeptId === dept.id;
              const subs = dept.subCategories || [];

              return (
                <div
                  key={dept.id}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                >
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDeptId(isExpanded ? null : dept.id)
                        }
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
                        aria-label={`Toggle ${dept.name} sub categories`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingDeptName}
                            onChange={(e) => setEditingDeptName(e.target.value)}
                            maxLength={80}
                            className="flex-1 rounded border border-primary px-2 py-1 text-sm text-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameDepartment(dept)}
                            disabled={busy}
                            className="rounded bg-primary p-1.5 text-white hover:bg-primary-hover cursor-pointer"
                            aria-label="Save department name"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDeptId(null)}
                            className="rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 cursor-pointer"
                            aria-label="Cancel rename"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDeptId(isExpanded ? null : dept.id)
                          }
                          className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                        >
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {dept.name}
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">
                            ({subs.length} sub {subs.length === 1 ? 'category' : 'categories'})
                          </span>
                        </button>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveDepartment(index, -1)}
                          disabled={busy || index === 0}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDepartment(index, 1)}
                          disabled={busy || index === departments.length - 1}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDeptId(dept.id);
                            setEditingDeptName(dept.name);
                          }}
                          disabled={busy}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary cursor-pointer"
                          title="Rename department"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDepartment(dept)}
                          disabled={busy}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          title="Delete department"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sub Categories Panel */}
                  {isExpanded && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newSubInputs[dept.id] || ''}
                          onChange={(e) =>
                            setNewSubInputs((prev) => ({
                              ...prev,
                              [dept.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSubCategory(dept);
                            }
                          }}
                          maxLength={100}
                          placeholder={`Add sub category for ${dept.name}...`}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSubCategory(dept)}
                          disabled={busy || !(newSubInputs[dept.id] || '').trim()}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add</span>
                        </button>
                      </div>

                      {subs.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          No sub categories yet. Only &ldquo;Other&rdquo; will appear in the dropdown until you add some.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {subs.map((sub, subIdx) => {
                            const isSubEditing =
                              editingSub?.deptId === dept.id &&
                              editingSub.index === subIdx;

                            return (
                              <li
                                key={`${dept.id}-sub-${subIdx}`}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                              >
                                {isSubEditing ? (
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <input
                                      type="text"
                                      value={editingSub.value}
                                      onChange={(e) =>
                                        setEditingSub({
                                          ...editingSub,
                                          value: e.target.value,
                                        })
                                      }
                                      className="flex-1 rounded border border-primary px-2 py-0.5 text-xs text-slate-900 focus:outline-none"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveSubRename(dept, subIdx)}
                                      disabled={busy}
                                      className="rounded bg-primary p-1 text-white hover:bg-primary-hover cursor-pointer"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSub(null)}
                                      className="rounded border border-slate-200 p-1 text-slate-500 cursor-pointer"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-slate-800 truncate">{sub}</span>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMoveSubCategory(dept, subIdx, -1)
                                        }
                                        disabled={busy || subIdx === 0}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                        title="Move up"
                                      >
                                        <ArrowUp className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMoveSubCategory(dept, subIdx, 1)
                                        }
                                        disabled={busy || subIdx === subs.length - 1}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                        title="Move down"
                                      >
                                        <ArrowDown className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingSub({
                                            deptId: dept.id,
                                            index: subIdx,
                                            value: sub,
                                          })
                                        }
                                        disabled={busy}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary cursor-pointer"
                                        title="Rename"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteSubCategory(dept, subIdx)
                                        }
                                        disabled={busy}
                                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                        title="Remove"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

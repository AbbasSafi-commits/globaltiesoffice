import { ActionKey, ModuleKey } from '../../context/AuthContext';
import { ACTIONS, FullPermissionsGrid, MODULES } from './permissionPresets';

interface PermissionGridProps {
  permissions: FullPermissionsGrid;
  onChange: (nextPermissions: FullPermissionsGrid) => void;
  disabled?: boolean;
}

/**
 * Interactive 5x4 permission matrix with automatic View dependency logic
 * and per-row Select all / Clear all controls.
 */
export function PermissionGrid({
  permissions,
  onChange,
  disabled = false,
}: PermissionGridProps) {
  const handleToggle = (
    moduleKey: ModuleKey,
    actionKey: ActionKey,
    checked: boolean,
    viewOnly?: boolean
  ) => {
    if (viewOnly && actionKey !== 'view') return;

    const currentRow = permissions[moduleKey];
    let updatedRow = { ...currentRow, [actionKey]: checked };

    if (viewOnly) {
      updatedRow = { view: checked, add: false, edit: false, delete: false };
    } else {
      // If Add, Edit, or Delete is enabled, View must automatically be enabled.
      if (actionKey !== 'view' && checked) {
        updatedRow.view = true;
      }

      // If View is turned off, all other actions on that module are turned off.
      if (actionKey === 'view' && !checked) {
        updatedRow = { view: false, add: false, edit: false, delete: false };
      }
    }

    onChange({
      ...permissions,
      [moduleKey]: updatedRow,
    });
  };

  const handleRowSetAll = (moduleKey: ModuleKey, value: boolean, viewOnly?: boolean) => {
    onChange({
      ...permissions,
      [moduleKey]: viewOnly
        ? {
            view: value,
            add: false,
            edit: false,
            delete: false,
          }
        : {
            view: value,
            add: value,
            edit: value,
            delete: value,
          },
    });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Module</th>
              {ACTIONS.map((action) => (
                <th key={action.key} className="px-3 py-3 text-center w-20">
                  {action.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right whitespace-nowrap">Quick Row</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MODULES.map((mod) => {
              const row = permissions[mod.key];
              const allChecked = mod.viewOnly
                ? row.view
                : row.view && row.add && row.edit && row.delete;
              const noneChecked = mod.viewOnly
                ? !row.view
                : !row.view && !row.add && !row.edit && !row.delete;

              return (
                <tr key={mod.key} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                    {mod.label}
                  </td>

                  {ACTIONS.map((action) => {
                    const isActionDisabled = disabled || (Boolean(mod.viewOnly) && action.key !== 'view');
                    return (
                      <td key={action.key} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isActionDisabled && mod.viewOnly && action.key !== 'view' ? false : Boolean(row[action.key])}
                          disabled={isActionDisabled}
                          onChange={(e) =>
                            handleToggle(mod.key, action.key, e.target.checked, mod.viewOnly)
                          }
                          aria-label={`${mod.label} - ${action.label}`}
                          className="h-4 w-4 rounded border-slate-300 accent-[#2563EB] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                    );
                  })}

                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        disabled={disabled || allChecked}
                        onClick={() => handleRowSetAll(mod.key, true, mod.viewOnly)}
                        className="font-medium text-[#2563EB] hover:text-[#1D4ED8] disabled:text-slate-300 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Select all
                      </button>
                      <span className="text-slate-300" aria-hidden="true">
                        /
                      </span>
                      <button
                        type="button"
                        disabled={disabled || noneChecked}
                        onClick={() => handleRowSetAll(mod.key, false, mod.viewOnly)}
                        className="font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

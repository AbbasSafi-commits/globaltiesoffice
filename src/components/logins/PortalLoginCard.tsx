import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  logPortalLoginActivity,
  normalizeSafeUrl,
  PortalLoginRecord,
} from './loginTypes';

interface PortalLoginCardProps {
  login: PortalLoginRecord;
  clientId: string;
  clientName: string;
  currentUserEmail: string;
  canEdit: boolean;
  canDelete: boolean;
  onEditClick: (login: PortalLoginRecord) => void;
  onDeleteClick: (login: PortalLoginRecord) => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const REVEAL_DURATION_SECONDS = 10;
const CLIPBOARD_CLEAR_MS = 30_000;
const EXTENSION_ACK_TIMEOUT_MS = 1_500;

function extractSafeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Displays a single portal login card with:
 * - "Copy ID" & "Copy Password" buttons (copies without revealing, clears clipboard after 30s, logs to activityLog)
 * - "Open & Autofill" button (opens link in new tab with noopener,noreferrer and posts GT_AUTOFILL to same-origin extension)
 * - Masked Password & PIN fields with 10-second timed Reveal
 */
export function PortalLoginCard({
  login,
  clientId,
  clientName,
  currentUserEmail,
  canEdit,
  canDelete,
  onEditClick,
  onDeleteClick,
  onSuccess,
  onError,
}: PortalLoginCardProps) {
  const [passwordCountdown, setPasswordCountdown] = useState<number>(0);
  const [pinCountdown, setPinCountdown] = useState<number>(0);

  const passwordTimerRef = useRef<number | null>(null);
  const pinTimerRef = useRef<number | null>(null);
  const clipboardTimerRef = useRef<number | null>(null);
  const autofillTimerRef = useRef<number | null>(null);

  const clearIntervalRef = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current !== null) {
      window.clearInterval(ref.current);
      ref.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearIntervalRef(passwordTimerRef);
      clearIntervalRef(pinTimerRef);
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
      if (autofillTimerRef.current !== null) {
        window.clearTimeout(autofillTimerRef.current);
      }
    };
  }, []);

  /**
   * Schedules a best-effort clipboard clear after 30 seconds.
   */
  const scheduleClipboardClear = () => {
    if (clipboardTimerRef.current !== null) {
      window.clearTimeout(clipboardTimerRef.current);
    }
    clipboardTimerRef.current = window.setTimeout(() => {
      clipboardTimerRef.current = null;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText('').catch(() => {
          // Browsers may block clipboard write if tab is unfocused; ignore silently
        });
      }
    }, CLIPBOARD_CLEAR_MS);
  };

  const handleToggleReveal = async (field: 'password' | 'pin') => {
    const isPassword = field === 'password';
    const currentCount = isPassword ? passwordCountdown : pinCountdown;
    const setCount = isPassword ? setPasswordCountdown : setPinCountdown;
    const timerRef = isPassword ? passwordTimerRef : pinTimerRef;

    if (currentCount > 0) {
      clearIntervalRef(timerRef);
      setCount(0);
      return;
    }

    clearIntervalRef(timerRef);
    setCount(REVEAL_DURATION_SECONDS);
    timerRef.current = window.setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearIntervalRef(timerRef);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      await logPortalLoginActivity({
        userEmail: currentUserEmail,
        action: 'revealed_password',
        clientId,
        websiteName: login.departmentName,
        targetId: login.id,
        details: `Revealed ${isPassword ? 'password' : 'PIN code'} for "${login.departmentName}" (${clientName})`,
      });
    } catch {
      // Non-blocking
    }
  };

  const handleCopySecret = async (field: 'password' | 'pin') => {
    const isPassword = field === 'password';
    const secretValue = isPassword ? login.password : login.pinCode;
    const label = isPassword ? 'Password' : 'PIN code';

    if (!secretValue) return;

    try {
      await navigator.clipboard.writeText(secretValue);
      scheduleClipboardClear();
      // Never include the secret value itself in the toast
      onSuccess(`${label} for ${login.departmentName} copied. Clipboard clears in 30s.`);
    } catch {
      onError('Unable to copy to clipboard. Please check browser clipboard permissions.');
      return;
    }

    try {
      await logPortalLoginActivity({
        userEmail: currentUserEmail,
        action: 'copied_password',
        clientId,
        websiteName: login.departmentName,
        targetId: login.id,
        details: `Copied ${label.toLowerCase()} for "${login.departmentName}" (${clientName})`,
      });
    } catch {
      // Non-blocking
    }
  };

  const handleCopyLoginId = async () => {
    if (!login.loginId) return;
    try {
      await navigator.clipboard.writeText(login.loginId);
      scheduleClipboardClear();
      onSuccess(`Login ID for ${login.departmentName} copied. Clipboard clears in 30s.`);
    } catch {
      onError('Unable to copy Login ID to clipboard.');
      return;
    }

    try {
      await logPortalLoginActivity({
        userEmail: currentUserEmail,
        action: 'copied_login_id',
        clientId,
        websiteName: login.departmentName,
        targetId: login.id,
        details: `Copied login ID for "${login.departmentName}" (${clientName})`,
      });
    } catch {
      // Non-blocking
    }
  };

  const handleOpenAndAutofill = async () => {
    if (!safeHref) return;

    // 1. Open saved website link in a new tab with noopener,noreferrer (no credentials in URL)
    window.open(safeHref, '_blank', 'noopener,noreferrer');

    // 2. Send credentials only to the same page origin where "Global Ties Autofill" content script listens
    const host = extractSafeHost(safeHref);
    let extensionResponded = false;

    const handleExtensionAck = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const msgType = event.data && typeof event.data === 'object' ? event.data.type : '';
      if (
        msgType === 'GT_AUTOFILL_ACK' ||
        msgType === 'GT_AUTOFILL_OK' ||
        msgType === 'GT_AUTOFILL_RESPONSE'
      ) {
        extensionResponded = true;
        window.removeEventListener('message', handleExtensionAck);
        if (autofillTimerRef.current !== null) {
          window.clearTimeout(autofillTimerRef.current);
          autofillTimerRef.current = null;
        }
      }
    };

    window.addEventListener('message', handleExtensionAck);

    window.postMessage(
      {
        type: 'GT_AUTOFILL',
        host,
        username: login.loginId || '',
        password: login.password || '',
        pin: login.pinCode || '',
      },
      window.location.origin
    );

    if (autofillTimerRef.current !== null) {
      window.clearTimeout(autofillTimerRef.current);
    }
    autofillTimerRef.current = window.setTimeout(() => {
      window.removeEventListener('message', handleExtensionAck);
      autofillTimerRef.current = null;
      if (!extensionResponded) {
        onError('Autofill extension not found. Use Copy ID and Copy Password instead.');
      }
    }, EXTENSION_ACK_TIMEOUT_MS);

    // 3. Log autofill action (never log credentials)
    try {
      await logPortalLoginActivity({
        userEmail: currentUserEmail,
        action: 'opened_autofill',
        clientId,
        websiteName: login.departmentName,
        targetId: login.id,
        details: `Opened & triggered autofill for "${login.departmentName}" (${clientName})`,
      });
    } catch {
      // Non-blocking
    }
  };

  const safeHref = normalizeSafeUrl(login.websiteUrl);
  const passwordRevealed = passwordCountdown > 0;
  const pinRevealed = pinCountdown > 0;

  return (
    <article className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 truncate">
            {login.departmentName}
          </h3>
          {safeHref ? (
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary-hover hover:underline break-all"
            >
              <span>{safeHref}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <p className="mt-1 text-xs text-slate-400">No website link saved</p>
          )}
        </div>

        <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
          <div className="inline-flex items-center gap-2 flex-wrap">
            {login.loginId && (
              <button
                type="button"
                onClick={handleCopyLoginId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Copy ID</span>
              </button>
            )}

            {login.password && (
              <button
                type="button"
                onClick={() => handleCopySecret('password')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Copy Password</span>
              </button>
            )}

            {safeHref && (
              <button
                type="button"
                onClick={handleOpenAndAutofill}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors shadow-xs cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Open &amp; Autofill</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => onEditClick(login)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Edit</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => onDeleteClick(login)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            )}
          </div>

          {safeHref && (
            <p className="text-[11px] text-slate-500">
              Captcha and OTP codes must be entered manually.
            </p>
          )}
        </div>
      </div>

      {/* Credentials Grid */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Login ID */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Login ID / Username</div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="font-mono text-sm text-slate-900 truncate">
              {login.loginId || '—'}
            </span>
            {login.loginId && (
              <button
                type="button"
                onClick={handleCopyLoginId}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 shrink-0 cursor-pointer"
                title="Copy ID"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy ID</span>
              </button>
            )}
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Password</span>
            {passwordRevealed && (
              <span className="text-xs font-mono tabular-nums text-amber-700">
                Hides in {passwordCountdown}s
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="font-mono text-sm text-slate-900 truncate select-all">
              {login.password
                ? passwordRevealed
                  ? login.password
                  : '••••••••'
                : '—'}
            </span>
            {login.password && (
              <div className="inline-flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleReveal('password')}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200/70 cursor-pointer"
                  aria-label={passwordRevealed ? 'Hide password' : 'Reveal password'}
                >
                  {passwordRevealed ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reveal</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopySecret('password')}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-blue-50 cursor-pointer"
                  aria-label="Copy Password"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Password</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PIN Code */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">PIN Code</span>
            {pinRevealed && (
              <span className="text-xs font-mono tabular-nums text-amber-700">
                Hides in {pinCountdown}s
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="font-mono text-sm text-slate-900 truncate select-all">
              {login.pinCode ? (pinRevealed ? login.pinCode : '••••••••') : '—'}
            </span>
            {login.pinCode && (
              <div className="inline-flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleReveal('pin')}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200/70 cursor-pointer"
                  aria-label={pinRevealed ? 'Hide PIN code' : 'Reveal PIN code'}
                >
                  {pinRevealed ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reveal</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopySecret('pin')}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-blue-50 cursor-pointer"
                  aria-label="Copy PIN code"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Optional Notes */}
      {login.notes && login.notes.trim().length > 0 && (
        <div className="px-5 pb-4 pt-1 border-t border-slate-100">
          <div className="text-xs font-medium text-slate-500 mt-3">Notes</div>
          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {login.notes}
          </p>
        </div>
      )}
    </article>
  );
}

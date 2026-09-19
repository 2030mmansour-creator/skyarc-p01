import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  AlertTriangle,
  Trash2,
  Info,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirmDialog, alertDialog, closeAlertDialog } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDialog && !isProcessing) {
          confirmDialog.onCancel?.();
          closeConfirmDialog();
        } else if (alertDialog) {
          alertDialog.onClose?.();
          closeAlertDialog();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, closeConfirmDialog, alertDialog, closeAlertDialog, isProcessing]);

  if (!confirmDialog && !alertDialog) return null;

  // Handle Confirm Dialog
  if (confirmDialog) {
    const isDanger = confirmDialog.type === 'danger' || !confirmDialog.type;
    const isWarning = confirmDialog.type === 'warning';

    const handleConfirm = async () => {
      try {
        setIsProcessing(true);
        await confirmDialog.onConfirm();
      } catch (err) {
        console.error('Action confirmation error:', err);
      } finally {
        setIsProcessing(false);
        closeConfirmDialog();
      }
    };

    const handleCancel = () => {
      if (isProcessing) return;
      confirmDialog.onCancel?.();
      closeConfirmDialog();
    };

    return (
      <div
        id="confirm-modal-overlay"
        className="fixed inset-0 z-[100] overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
        onClick={handleCancel}
      >
        <div
          id="confirm-modal-card"
          className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden p-5 sm:p-6 animate-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 ring-8 ring-rose-50 dark:ring-rose-950/20'
                  : isWarning
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 ring-8 ring-amber-50 dark:ring-amber-950/20'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 ring-8 ring-blue-50 dark:ring-blue-950/20'
              }`}
            >
              {isDanger ? (
                <Trash2 className="w-6 h-6" />
              ) : isWarning ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <Info className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                {confirmDialog.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {confirmDialog.message}
              </p>
              {confirmDialog.details && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  {confirmDialog.details}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              id="confirm-modal-cancel-btn"
              type="button"
              disabled={isProcessing}
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
            >
              {confirmDialog.cancelText || 'إلغاء'}
            </button>

            <button
              id="confirm-modal-submit-btn"
              type="button"
              disabled={isProcessing}
              onClick={handleConfirm}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  : isWarning
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التنفيذ...</span>
                </>
              ) : (
                <>
                  {isDanger && <Trash2 className="w-4 h-4" />}
                  <span>{confirmDialog.confirmText || 'تأكيد الحذف'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle Alert Dialog (Info / Warning / Error popup)
  if (alertDialog) {
    const isError = alertDialog.type === 'error';
    const isWarning = alertDialog.type === 'warning';

    const handleDismiss = () => {
      alertDialog.onClose?.();
      closeAlertDialog();
    };

    return (
      <div
        id="alert-modal-overlay"
        className="fixed inset-0 z-[100] overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
        onClick={handleDismiss}
      >
        <div
          id="alert-modal-card"
          className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden p-5 sm:p-6 animate-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isError
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 ring-8 ring-rose-50 dark:ring-rose-950/20'
                  : isWarning
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 ring-8 ring-amber-50 dark:ring-amber-950/20'
                  : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 ring-8 ring-emerald-50 dark:ring-emerald-950/20'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-6 h-6" />
              ) : isWarning ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                {alertDialog.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {alertDialog.message}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
            <button
              id="alert-modal-close-btn"
              type="button"
              onClick={handleDismiss}
              className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {alertDialog.buttonText || 'حسناً، فهمت'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle2,
  Database,
  Cloud,
  RefreshCw,
  X,
  Sparkles,
  ArrowLeft,
  Check
} from 'lucide-react';

export const OperationStatusBanner: React.FC = () => {
  const { lastOperationStatus, clearLastOperationStatus, isCloudSyncing, isOnline } = useApp();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (lastOperationStatus) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [lastOperationStatus]);

  if (!lastOperationStatus || !isVisible) {
    return null;
  }

  const isSyncing = isCloudSyncing || !lastOperationStatus.synced;
  const isSynced = lastOperationStatus.synced;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 max-w-md w-full sm:w-auto animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto"
    >
      <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-emerald-500/30 backdrop-blur-md flex items-start gap-3 text-right">
        {/* Success Icon */}
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
              <span>{lastOperationStatus.action}</span>
            </h4>
            <button
              onClick={() => {
                setIsVisible(false);
                clearLastOperationStatus();
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {lastOperationStatus.title && (
            <p className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
              {lastOperationStatus.title}
            </p>
          )}

          {/* Status Badges */}
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] font-bold">
            {/* Local Save Status */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-2xs">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>💾 تم الحفظ محلياً</span>
            </span>

            {/* Cloud Sync Status */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border shadow-2xs ${
                isSynced
                  ? 'bg-teal-950/80 text-teal-300 border-teal-800/80'
                  : isOnline
                  ? 'bg-blue-950/80 text-blue-300 border-blue-800/80'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
              }`}
            >
              {isSynced ? (
                <>
                  <Cloud className="w-3 h-3 text-teal-400" />
                  <span>☁️ تمت المزامنة السحابية</span>
                </>
              ) : isOnline ? (
                <>
                  <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                  <span>🔄 جاري المزامنة السحابية...</span>
                </>
              ) : (
                <>
                  <Database className="w-3 h-3 text-amber-400" />
                  <span>⏳ محفوظ أوفلاين (في انتظار الاتصال)</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

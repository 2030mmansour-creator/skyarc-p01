import React from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  Clock,
  RefreshCw,
  WifiOff,
  Check,
  HardDrive
} from 'lucide-react';

export interface SaveSyncBadgeProps {
  saved?: boolean;
  savedLocally?: boolean;
  synced?: boolean;
  isSyncing?: boolean;
  showLabel?: boolean;
  lastSavedAt?: string;
  variant?: 'compact' | 'pill' | 'detailed' | 'table-cell' | 'icon' | 'badge';
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export const SaveSyncBadge: React.FC<SaveSyncBadgeProps> = ({
  saved = true,
  savedLocally,
  synced = true,
  isSyncing = false,
  showLabel,
  lastSavedAt,
  variant = 'compact',
  size = 'xs',
  onClick,
  className = ''
}) => {
  const isSaved = savedLocally !== undefined ? savedLocally : saved;
  // Format last saved time if provided
  const formattedTime = React.useMemo(() => {
    if (!lastSavedAt) return '';
    try {
      const d = new Date(lastSavedAt);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [lastSavedAt]);

  if (variant === 'icon') {
    return (
      <div
        className={`inline-flex items-center gap-1 ${className}`}
        title={`الحفظ المحلي: ${isSaved ? 'تم الحفظ بنجاح' : 'غير محفوظ'} | المزامنة السحابية: ${
          isSyncing ? 'جاري المزامنة...' : synced ? 'تمت المزامنة السحابية' : 'في انتظار المزامنة (أوفلاين)'
        }`}
        onClick={onClick}
      >
        {/* Local Save Icon */}
        <span
          className={`p-1 rounded-md flex items-center justify-center ${
            isSaved
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <HardDrive className="w-3 h-3" />
        </span>

        {/* Cloud Sync Icon */}
        <span
          className={`p-1 rounded-md flex items-center justify-center ${
            isSyncing
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800 animate-spin'
              : synced
              ? 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 border border-teal-200 dark:border-teal-800'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
          }`}
        >
          {isSyncing ? (
            <RefreshCw className="w-3 h-3" />
          ) : synced ? (
            <Cloud className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
        </span>
      </div>
    );
  }

  if (variant === 'table-cell' || variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 flex-wrap ${onClick ? 'cursor-pointer hover:opacity-90' : ''} ${className}`}
        onClick={onClick}
      >
        {/* Local Save Pill */}
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
            isSaved
              ? 'bg-emerald-50/90 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
          }`}
          title={`تم الحفظ محلياً في الذاكرة التخزينية ${formattedTime ? `(${formattedTime})` : ''}`}
        >
          <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="shrink-0">تم الحفظ</span>
        </span>

        {/* Cloud Sync Pill */}
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
            isSyncing
              ? 'bg-blue-50/90 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              : synced
              ? 'bg-teal-50/90 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800/80'
              : 'bg-amber-50/90 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/80'
          }`}
          title={
            isSyncing
              ? 'جاري المزامنة مع الخادم السحابي...'
              : synced
              ? 'تمت المزامنة السحابية بنجاح'
              : 'محفوظ محلياً - بانتظار المزامنة السحابية'
          }
        >
          {isSyncing ? (
            <RefreshCw className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
          ) : synced ? (
            <Cloud className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400 shrink-0" />
          ) : (
            <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="shrink-0">
            {isSyncing ? 'جاري المزامنة' : synced ? 'تمت المزامنة' : 'بانتظار المزامنة'}
          </span>
        </span>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <div
        className={`inline-flex items-center divide-x divide-x-reverse rounded-lg border text-[11px] font-bold overflow-hidden shadow-2xs ${
          synced && saved
            ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 divide-emerald-200 dark:divide-emerald-800'
            : 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 divide-amber-200 dark:divide-amber-800'
        } ${onClick ? 'cursor-pointer hover:opacity-90' : ''} ${className}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-1 px-2 py-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>تم الحفظ</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1">
          {isSyncing ? (
            <>
              <RefreshCw className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
              <span>جاري المزامنة</span>
            </>
          ) : synced ? (
            <>
              <Cloud className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>تمت المزامنة</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>أوفلاين (محفوظ محلياً)</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // 'detailed' or 'badge' variant
  return (
    <div
      className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs ${
        synced && saved
          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
          : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
            saved
              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="font-bold block">
            {saved ? '💾 تم الحفظ محلياً' : '⚠️ غير محفوظ'}
          </span>
          {formattedTime && (
            <span className="text-[10px] opacity-75 block">آخر تحديث: {formattedTime}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-start sm:self-auto">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
            isSyncing
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
              : synced
              ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
          }`}
        >
          {isSyncing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : synced ? (
            <Cloud className="w-3 h-3" />
          ) : (
            <Clock className="w-3 h-3" />
          )}
          <span>
            {isSyncing ? 'جاري المزامنة السحابية...' : synced ? '☁️ تمت المزامنة السحابية' : '⏳ بانتظار المزامنة (أوفلاين)'}
          </span>
        </span>
      </div>
    </div>
  );
};

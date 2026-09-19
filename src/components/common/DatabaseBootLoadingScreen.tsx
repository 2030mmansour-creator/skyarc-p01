import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';

interface DatabaseBootLoadingScreenProps {
  onBypass?: () => void;
  loadSource?: 'cloud' | 'server' | 'offline' | null;
}

export const DatabaseBootLoadingScreen: React.FC<DatabaseBootLoadingScreenProps> = ({
  onBypass,
  loadSource
}) => {
  const [showBypassButton, setShowBypassButton] = useState<boolean>(false);

  useEffect(() => {
    // Show bypass button after 3.5 seconds if connection is slow/offline
    const timer = setTimeout(() => {
      setShowBypassButton(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      id="database-boot-loading-screen"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 text-slate-100 backdrop-blur-md p-4 transition-all duration-300"
    >
      <div
        id="database-boot-card"
        className="w-full max-w-lg bg-slate-850/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 text-center"
      >
        {/* Animated Brand Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-60" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 border border-emerald-400/40">
            <Database className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>

        {/* System Title & Scope */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>حماية وتأكيد تكامل قاعدة البيانات</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            جاري جلب أحدث البيانات من قاعدة البيانات المركزية
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
            وفقاً لبروتوكول الأمان الصارم، يتم استرجاع البيانات المعتمدة مباشرة وتجاهل أي بيانات مؤقتة مسجلة على المتصفح المحلي لمنع رفع أي بيانات غير مطلوبة.
          </p>
        </div>

        {/* Verification Checklist */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-right space-y-3 text-xs sm:text-sm">
          <div className="flex items-center gap-3 text-emerald-400">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
            <span className="font-medium">
              الاتصال بقاعدة البيانات السحابية المركزية (Firebase Firestore)...
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>إهمال وحجب أي بيانات مخزنة محلياً غير مطابقة للسيرفر</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>حظر الرفع التلقائي حتى يتم التحقق واعتماد حالة البيانات</span>
          </div>
        </div>

        {/* Dynamic Fallback / Bypass Option */}
        {showBypassButton && onBypass && (
          <div className="pt-2 border-t border-slate-800 animate-fadeIn">
            <p className="text-xs text-slate-400 mb-3">
              إذا استغرق الاتصال وقتاً أطول بسبب بطء الشبكة، يمكنك المتابعة للاطلاع فقط:
            </p>
            <button
              id="btn-bypass-boot-loading"
              type="button"
              onClick={onBypass}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm cursor-pointer"
            >
              <span>المتابعة إلى النظام (وضع آمن دون رفع محلي)</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

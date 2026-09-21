import React from 'react';
import { ShieldAlert, LogIn, Laptop, Clock, User, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SessionEvictedInfo } from '../../types';

interface ConcurrentSessionModalProps {
  info: SessionEvictedInfo | null;
  onDismiss: () => void;
}

export const ConcurrentSessionModal: React.FC<ConcurrentSessionModalProps> = ({ info, onDismiss }) => {
  if (!info || !info.isOpen) return null;

  const formattedTime = (() => {
    try {
      return new Date(info.loginTime).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return info.loginTime;
    }
  })();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200 text-right relative overflow-hidden">
        
        {/* Subtle Decorative Background Glow */}
        <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-rose-500/10 dark:bg-rose-600/15 rounded-full blur-2xl pointer-events-none" />

        {/* Header Icon and Title */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800 shadow-lg shadow-rose-500/10">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              تم إنهاء الجلسة لتسجيل الدخول من جهاز آخر
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>سياسة الأمان: يُسمح بجلسة نشطة واحدة فقط لكل حساب في نفس الوقت</span>
            </p>
          </div>
        </div>

        {/* Explanatory Banner */}
        <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
          <p>
            تم تسجيل الدخول إلى حسابك من جهاز أو متصفح جديد. للحفاظ على سرية وسلامة البيانات ومنع التضارب، تم تسجيل الخروج فوراً من هذا المتصفح.
          </p>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs pt-1 border-t border-rose-200/50 dark:border-rose-900/40">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>تم تفريغ كافة البيانات المؤقتة وبيانات الجلسة المحفوظة من هذا المتصفح.</span>
          </div>
        </div>

        {/* Eviction Details Card */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 text-xs">
          
          <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>اسم الحساب:</span>
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {info.userName}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>الجهاز الجديد:</span>
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-left dir-ltr">
              {info.newDevice || 'متصفح/جهاز جديد'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>توقيت الدخول الجديد:</span>
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300 text-left dir-ltr">
              {formattedTime}
            </span>
          </div>

        </div>

        {/* Action Button */}
        <button
          onClick={onDismiss}
          className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>تسجيل الدخول من هذا الجهاز مجدداً</span>
        </button>

      </div>
    </div>
  );
};

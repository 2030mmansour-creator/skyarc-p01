import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import {
  RotateCcw,
  X,
  Users,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';

interface BatchResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchResetPasswordModal: React.FC<BatchResetPasswordModalProps> = ({
  isOpen,
  onClose
}) => {
  const { users, resetAllUsersPasswordByManager, showAlert } = useApp();

  const [password, setPassword] = useState('Password@2026');
  const [showPassword, setShowPassword] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = `بيانات الدخول الموحدة لكافة أعضاء فريق العمل:\nكلمة المرور الافتراضية: ${password}\nيمكن لكل عضو تسجيل الدخول باسم المستخدم الخاص به وكلمة المرور المحددة أعلاه.\nرابط النظام: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 4) {
      showAlert('كلمة مرور قصيرة', 'يرجى إدخال كلمة مرور تتكون من 4 خانات على الأقل.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await resetAllUsersPasswordByManager(password);
      if (ok) {
        showAlert(
          'تمت إعادة الضبط الجماعية بنجاح',
          `تم بنجاح تعيين كلمة المرور (${password}) لكافة مستخدمي النظام (${users.length} مستخدمين). أصبح بإمكان الجميع الدخول بها فوراً.`,
          'success'
        );
        onClose();
      } else {
        showAlert('فشلت العملية', 'تعذر تحديث كلمات المرور لجميع المستخدمين.', 'error');
      }
    } catch {
      showAlert('خطأ', 'حدث خطأ أثناء تنفيذ عملية إعادة الضبط الجماعية.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-center animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/40 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>إعادة ضبط كلمات المرور للجميع</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-medium">
                  {users.length} مستخدمين
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تعيين كلمة مرور موحدة جديدة لكافة أعضاء النظام دفعة واحدة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">تنبيه هام للإدارة العليا</p>
              <p className="leading-relaxed">
                هذا الإجراء سيقوم بتغيير كلمة المرور لجميع حسابات الموظفين والمشرفين والمحاسبين المسجلين في النظام ({users.length} حساب) إلى كلمة المرور المحددة أدناه.
              </p>
            </div>
          </div>

          {/* New Uniform Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>كلمة المرور الموحدة الجديدة</span>
              <span className="text-[11px] text-slate-400 font-mono">الافتراضي: Password@2026</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الموحدة"
                required
                className="w-full pr-10 pl-11 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPassword('Password@2026')}
              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              استخدام: Password@2026
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="py-1.5 px-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer flex items-center gap-1 mr-auto"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ التعميم للموظفين'}</span>
            </button>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm shadow-rose-600/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>جاري التنفيذ...</span>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>تأكيد إعادة الضبط لجميع المستخدمين</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
};

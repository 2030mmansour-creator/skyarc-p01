import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  KeyRound,
  X,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Send
} from 'lucide-react';

interface ResetUserPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  onSuccess?: () => void;
}

export const ResetUserPasswordModal: React.FC<ResetUserPasswordModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess
}) => {
  const { resetUserPasswordByManager, showAlert } = useApp();

  const [newPassword, setNewPassword] = useState('Password@2026');
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !targetUser) return null;

  const defaultPassword = 'Password@2026';

  const handleGenerateRandom = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let rand = 'SkyArc#';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(rand);
  };

  const handleSetDefault = () => {
    setNewPassword(defaultPassword);
  };

  const handleCopyCredentials = () => {
    const username = targetUser.username || targetUser.email.split('@')[0];
    const text = `بيانات الدخول لنظام العهد والمصروفات:\nاسم المستخدم: ${username}\nكلمة المرور الجديدة: ${newPassword}\nالرابط: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 4) {
      showAlert('كلمة مرور قصيرة', 'يرجى إدخال كلمة مرور تتكون من 4 خانات على الأقل.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await resetUserPasswordByManager(targetUser.id, newPassword);
      if (ok) {
        showAlert(
          'تمت إعادة الضبط بنجاح',
          `تم تعيين كلمة المرور الجديدة للعضو (${targetUser.name}) بنجاح. لا تنسَ مشاركة بيانات الدخول معه.`,
          'success'
        );
        onSuccess?.();
        onClose();
      } else {
        showAlert('فشلت العملية', 'تعذر تحديث كلمة المرور، يرجى المحاولة مرة أخرى.', 'error');
      }
    } catch {
      showAlert('خطأ', 'حدث خطأ أثناء إعادة ضبط كلمة المرور.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const usernameDisplay = targetUser.username || targetUser.email.split('@')[0];

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
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>إعادة ضبط كلمة المرور</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">
                  صلاحية الإدارة
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تعديل كلمة السر وتفعيل الدخول للمستخدم فوراً بدون معرفة كلمته السابقة
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
        <form onSubmit={handleConfirmReset} className="p-6 space-y-5">
          
          {/* User Preview Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={targetUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                alt={targetUser.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {targetUser.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                    @{usernameDisplay}
                  </span>
                  <span>•</span>
                  <span>{targetUser.role}</span>
                </div>
              </div>
            </div>

            <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              إعادة ضبط
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>خيارات التعيين السريع:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSetDefault}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  newPassword === defaultPassword
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                الافتراضية: Password@2026
              </button>
              <button
                type="button"
                onClick={handleGenerateRandom}
                className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>توليد كلمة سر عشوائية</span>
              </button>
            </div>
          </div>

          {/* New Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>كلمة المرور الجديدة</span>
              <span className="text-[11px] text-slate-400 font-normal">يمكنك كتابة كلمة مرور مخصصة أو استخدام المولد</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
                required
                className="w-full pr-10 pl-11 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
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

          {/* Copy Message Banner */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-emerald-800 dark:text-emerald-300 truncate">
                نسخ بيانات الدخول لإرسالها للعضو عبر الواتساب أو الرسائل
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCredentials}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تم النسخ!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ البيانات</span>
                </>
              )}
            </button>
          </div>

          {/* Manager Confirmation Notice */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              بصفتك مدير النظام، سيتم تفعيل كلمة المرور الجديدة فوراً وسيتمكن العضو من تسجيل الدخول بها مباشرة في شاشة الدخول الموحدة.
            </p>
          </div>

          {/* Form Actions */}
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
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold shadow-sm shadow-amber-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>تأكيد وحفظ كلمة المرور الجديدة</span>
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

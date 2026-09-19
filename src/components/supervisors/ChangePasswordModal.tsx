import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  X,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Check,
  Sparkles,
  ShieldCheck,
  Copy,
  CheckCircle2,
  AlertCircle,
  AtSign
} from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess
}) => {
  const { currentUser, users, updateUser, showAlert, addNotification } = useApp();

  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isSelf = targetUser && currentUser ? targetUser.id === currentUser.id : true;
  const currentSavedPassword = targetUser?.password || 'Password@2026';
  const [showSavedPassword, setShowSavedPassword] = useState(false);

  useEffect(() => {
    if (isOpen && targetUser) {
      const initialUser =
        targetUser.username ||
        (typeof targetUser.email === 'string' && targetUser.email.includes('@') ? targetUser.email.split('@')[0] : '') ||
        (targetUser.id ? `user_${targetUser.id.toLowerCase().replace(/[^a-z0-9]/g, '')}` : 'user');
      setUsername(initialUser);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setShowSavedPassword(false);
      setCopied(false);
      setIsSaving(false);
    }
  }, [isOpen, targetUser]);

  const cleanUsername = useMemo(() => {
    return (username || '').trim().replace(/\s+/g, '');
  }, [username]);

  const originalUsername = useMemo(() => {
    if (!targetUser) return '';
    return (
      targetUser.username ||
      (typeof targetUser.email === 'string' && targetUser.email.includes('@') ? targetUser.email.split('@')[0] : '') ||
      (targetUser.id ? `user_${targetUser.id.toLowerCase().replace(/[^a-z0-9]/g, '')}` : 'user')
    ).trim();
  }, [targetUser]);

  const hasUsernameChanged = cleanUsername !== originalUsername;
  const isChangingPassword = newPassword.length > 0;

  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: '' };
    let score = 0;
    if (newPassword.length >= 4) score += 1;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword) || /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 2) return { score: 1, label: 'مقبولة', color: 'bg-amber-500 text-amber-500' };
    if (score <= 3) return { score: 2, label: 'جيدة جداً', color: 'bg-emerald-500 text-emerald-500' };
    return { score: 3, label: 'قوية وممتازة', color: 'bg-emerald-600 text-emerald-600' };
  }, [newPassword]);

  const isMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNewPassword(true);
    setShowConfirmPassword(true);
  };

  const handleCopyCredentials = () => {
    if (!targetUser) return;
    const userToCopy = cleanUsername || originalUsername || targetUser.name;
    const passToCopy = newPassword || currentSavedPassword;
    const text = `بيانات الدخول لنظام العهد والمصروفات:\nاسم المستخدم: ${userToCopy}\nكلمة المرور: ${passToCopy}\nالرابط: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Username
    if (!cleanUsername) {
      showAlert('اسم المستخدم مطلوب', 'يرجى إدخال اسم مستخدم صالح بدون مسافات.', 'warning');
      return;
    }

    if (cleanUsername.length < 3) {
      showAlert('اسم مستخدم قصير', 'يجب ألا يقل اسم المستخدم عن 3 خانات.', 'warning');
      return;
    }

    // Check username uniqueness
    if (hasUsernameChanged) {
      const isTaken = users.some(
        u => u.id !== targetUser.id && (
          (Boolean(u.username) && u.username!.toLowerCase() === cleanUsername.toLowerCase()) ||
          (typeof u.email === 'string' && u.email.toLowerCase() === cleanUsername.toLowerCase())
        )
      );
      if (isTaken) {
        showAlert(
          'اسم المستخدم محجوز',
          `اسم المستخدم (@${cleanUsername}) مسجل مسبقاً لعضو آخر، يرجى اختيار اسم مستخدم مختلف.`,
          'warning'
        );
        return;
      }
    }

    // 2. Validate Password if entered
    if (isChangingPassword) {
      if (newPassword.length < 4) {
        showAlert('كلمة المرور قصيرة', 'يجب أن تتكون كلمة المرور الجديدة من 4 خانات على الأقل.', 'warning');
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert('عدم تطابق كلمة المرور', 'يرجى التأكد من تطابق كلمة المرور الجديدة مع خانة التأكيد.', 'error');
        return;
      }
    }

    // 3. Ensure at least one field changed
    if (!hasUsernameChanged && !isChangingPassword) {
      showAlert('لا توجد تغييرات', 'لم تقم بتعديل اسم المستخدم أو إدخال كلمة مرور جديدة لحفظها.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<User> = {};

      if (hasUsernameChanged) {
        payload.username = cleanUsername;
      }

      if (isChangingPassword) {
        payload.password = newPassword;
        payload.passwordChangedAt = new Date().toISOString();
        payload.passwordResetByAdmin = !isSelf;
      }

      const success = await updateUser(targetUser.id, payload);

      if (success) {
        let msg = '';
        if (hasUsernameChanged && isChangingPassword) {
          msg = `تم تحديث اسم المستخدم إلى (@${cleanUsername}) وتعيين كلمة المرور الجديدة بنجاح.`;
        } else if (hasUsernameChanged) {
          msg = `تم تحديث اسم المستخدم إلى (@${cleanUsername}) بنجاح.`;
        } else {
          msg = isSelf
            ? 'تم تحديث كلمة المرور الخاصة بحسابك بنجاح.'
            : `تم تعيين كلمة المرور الجديدة للعضو (${targetUser.name}) بنجاح.`;
        }

        addNotification(
          'تحديث بيانات الدخول',
          msg,
          'system'
        );

        showAlert('تم الحفظ بنجاح', msg, 'success');
        onSuccess?.();
        onClose();
      } else {
        showAlert('فشلت العملية', 'تعذر تحديث بيانات الحساب، يرجى المحاولة مرة أخرى.', 'error');
      }
    } catch {
      showAlert('خطأ', 'حدث خطأ أثناء حفظ التعديلات.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = useMemo(() => {
    if (!cleanUsername || cleanUsername.length < 3) return false;
    if (isChangingPassword) {
      return newPassword.length >= 4 && isMatch;
    }
    return hasUsernameChanged;
  }, [cleanUsername, isChangingPassword, newPassword.length, isMatch, hasUsernameChanged]);

  if (!isOpen || !targetUser) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start sm:items-center animate-in fade-in duration-200"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        className="relative my-4 sm:my-auto w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Sticky shrink-0 */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {isSelf ? 'تعديل بيانات الدخول وكلمة المرور' : 'تعديل بيانات الدخول للعضو'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isSelf
                  ? 'قم بتحديث اسم المستخدم أو تعيين كلمة مرور جديدة لحسابك'
                  : `تعديل اسم المستخدم أو كلمة السر لـ: ${targetUser.name}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Target Member Quick Identity Card */}
          <div className="p-3.5 mx-4 sm:mx-5 mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={targetUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                alt={targetUser.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {targetUser.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {targetUser.role} • <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">@{originalUsername}</span>
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 shrink-0">
              {targetUser.id}
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4">
          
          {/* 1. Username Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>اسم المستخدم (اسم الدخول)</span>
                <span className="text-rose-500">*</span>
              </label>
              {hasUsernameChanged && (
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                  تم التعديل
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs select-none">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="أدخل اسم المستخدم بالإنجليزية أو أرقام"
                className="w-full pr-8 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono font-bold"
                dir="ltr"
                autoComplete="username"
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              اسم الدخول الشخصي بدون مسافات (أحرف إنجليزية أو أرقام).
            </p>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              كلمة المرور
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* Current Registered Credentials Card */}
          <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>بيانات الدخول المسجلة حالياً بالنظام:</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSavedPassword(!showSavedPassword)}
                className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showSavedPassword ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    <span>إخفاء كلمة المرور</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    <span>كشف كلمة المرور الحالية</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-amber-200/50 dark:border-amber-800/40">
              <span className="text-slate-600 dark:text-slate-400">
                اسم المستخدم: <strong className="font-mono text-slate-800 dark:text-slate-200 font-bold">@{originalUsername || cleanUsername}</strong>
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                كلمة السر: <strong className="font-mono text-amber-800 dark:text-amber-300 font-bold">{showSavedPassword ? currentSavedPassword : '••••••••'}</strong>
              </span>
            </div>
          </div>

          {/* 3. New Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                كلمة المرور الجديدة {hasUsernameChanged ? '(اختياري)' : <span className="text-rose-500">*</span>}
              </label>
              <button
                type="button"
                onClick={generateSecurePassword}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>توليد كلمة سر قوية</span>
              </button>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={hasUsernameChanged ? 'اتركها فارغة إذا أردت تغيير اسم المستخدم فقط' : 'أدخل كلمة المرور الجديدة (4 خانات فأكثر)'}
                className="w-full pr-9 pl-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono tracking-wider"
                dir="ltr"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 flex-1 max-w-[140px]">
                  <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.score >= 1 ? passwordStrength.color.split(' ')[0] : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.score >= 2 ? passwordStrength.color.split(' ')[0] : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.score >= 3 ? passwordStrength.color.split(' ')[0] : 'bg-slate-200 dark:bg-slate-700'}`} />
                </div>
                <span className={`font-bold ${passwordStrength.color.split(' ')[1]}`}>
                  قوة كلمة السر: {passwordStrength.label}
                </span>
              </div>
            )}
          </div>

          {/* 4. Confirm New Password (only when new password is entered) */}
          {isChangingPassword && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                تأكيد كلمة المرور الجديدة <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور الجديدة للتأكيد"
                  className={`w-full pr-9 pl-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 font-mono tracking-wider ${
                    confirmPassword.length > 0
                      ? isMatch
                        ? 'border-emerald-500 focus:ring-emerald-500/20'
                        : 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-amber-500/20 focus:border-amber-500'
                  }`}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {confirmPassword.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px]">
                  {isMatch ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      كلمتا المرور متطابقتان بنجاح
                    </span>
                  ) : (
                    <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      كلمتا المرور غير متطابقتين
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Copy credentials quick action */}
          {(hasUsernameChanged || isChangingPassword) && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                نسخ بيانات الدخول المحدثة:
              </span>
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSaving ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>تأكيد وحفظ التعديلات</span>
                </>
              )}
            </button>
          </div>

        </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

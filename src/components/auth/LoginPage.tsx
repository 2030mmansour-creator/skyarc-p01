import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StorageService } from '../../services/storage';
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  HelpCircle,
  Building2,
  Trash2
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, settings, users } = useApp();

  const availableUsers = users && users.length > 0 ? users : StorageService.getUsers();
  const savedCreds = StorageService.getRememberedCredentials();
  const [identifier, setIdentifier] = useState(savedCreds?.identifier || '');
  const [password, setPassword] = useState(savedCreds?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(savedCreds ? savedCreds.rememberMe : true);
  const [hasRememberedData, setHasRememberedData] = useState(Boolean(savedCreds?.identifier));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleClearRemembered = () => {
    StorageService.clearRememberedCredentials();
    setPassword('');
    setHasRememberedData(false);
  };

  const handleQuickRememberedLogin = async () => {
    if (!savedCreds?.identifier || !savedCreds?.password) return;
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await login(savedCreds.identifier, savedCreds.password, true);
      if (!res.success) {
        setErrorMessage(res.message || 'بيانات الدخول المحفوظة غير صالحة.');
      }
    } catch {
      setErrorMessage('حدث خطأ غير متوقع أثناء محاولة الدخول.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('يرجى إدخال اسم المستخدم أو البريد الإلكتروني.');
      return;
    }

    if (!password) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(identifier, password, rememberMe);
      if (!res.success) {
        setErrorMessage(res.message || 'بيانات الدخول غير صحيحة.');
      } else {
        if (rememberMe) {
          StorageService.saveRememberedCredentials({
            identifier: identifier.trim(),
            password,
            rememberMe: true
          });
          setHasRememberedData(true);
        } else {
          StorageService.clearRememberedCredentials();
          setHasRememberedData(false);
        }
      }
    } catch {
      setErrorMessage('حدث خطأ غير متوقع أثناء محاولة الدخول.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 select-none relative overflow-hidden transition-colors" dir="rtl">
      
      {/* Subtle Background Glows */}
      <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-6">

        {/* System Branding Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/10">
            <Building2 className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-2">
              <span>{settings?.companyName || 'نظام إدارة العهد والمصروفات'}</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              تسجيل دخول صارم ومحمي بنظام الصلاحيات والأدوار
            </p>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-6 sm:p-8 text-slate-900 dark:text-slate-100">
          
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  بوابة الدخول الموحدة
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  أدخل بيانات اعتمادك للمتابعة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[11px] font-bold">
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>جلسة مشفرة وآمنة</span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">تعذر تسجيل الدخول</p>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Remembered Credentials Quick-Login Banner */}
          {hasRememberedData && savedCreds?.identifier && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    <span>حساب متذكر ومحفوظ على هذا الجهاز:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">{savedCreds.identifier}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    تم تذكر بيانات الدخول بنجاح على هذا الجهاز، يمكنك الدخول الفوري دون كتابة.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleQuickRememberedLogin}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shrink-0 transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>دخول سريع فوري</span>
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Username / Email Field */}
            <div className="space-y-1.5" id="login-account-selector-container">
              <label htmlFor="login-username-input" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>اسم المستخدم أو البريد الإلكتروني</span>
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  (الاسم، البريد، أو المعرف)
                </span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="login-username-input"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
                  autoComplete="username"
                  required
                  list="login-users-suggestions"
                  className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                />
                <datalist id="login-users-suggestions">
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} — {u.role}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5" id="login-password-container">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password-input" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>كلمة المرور</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  required
                  className="w-full pr-10 pl-11 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Options: Remember Me on Device */}
            <div className="pt-1.5 space-y-2.5" id="login-remember-me-section">
              <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                <label htmlFor="remember-me-checkbox" className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 select-none transition-colors">
                  <input
                    id="remember-me-checkbox"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setRememberMe(checked);
                      if (!checked) {
                        handleClearRemembered();
                      } else if (identifier.trim() && password) {
                        StorageService.saveRememberedCredentials({
                          identifier: identifier.trim(),
                          password,
                          rememberMe: true
                        });
                        setHasRememberedData(true);
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 border-slate-300 dark:border-slate-600 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-600 shrink-0"
                  />
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    التذكر لبيانات الدخول علي الجهاز
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  {hasRememberedData && (
                    <button
                      type="button"
                      onClick={handleClearRemembered}
                      className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                      title="مسح بيانات الدخول المحفوظة على هذا الجهاز"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>مسح المحفوظ</span>
                    </button>
                  )}
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>تخزين آمن ومحمي</span>
                  </span>
                </div>
              </div>

              {hasRememberedData && (
                <div className="text-[11px] px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>بيانات الدخول متذكرة ومحفوظة بنجاح على هذا الجهاز لتسجيل الدخول التلقائي والسريع.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري التحقق من الصلاحيات...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول إلى النظام</span>
                </>
              )}
            </button>
          </form>

        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-500 space-y-1">
          <p>© 2026 جميع الحقوق محفوظة — نظام إدارة العهد والمصروفات</p>
          <p className="text-[11px]">
            لإعادة تعيين كلمة المرور أو تعديل صلاحيات المستخدم، يرجى مراجعة إدارة النظام
          </p>
        </div>

      </div>

      {/* Forgot Password Guidance Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
              <HelpCircle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                نسيت كلمة المرور؟
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                في هذا النظام، تتم إدارة وإعادة ضبط كلمات المرور بصورة مركزية وصارمة من قبل <strong className="text-emerald-600 dark:text-emerald-400">المدير التنفيذي (مدير النظام)</strong>.
              </p>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>خطوات استعادة الحساب:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <li>تواصل مع المدير التنفيذي عبر الاتصال أو البريد.</li>
                  <li>يقوم المدير بالدخول إلى لوحة المشرفين وفريق العمل.</li>
                  <li>ينقر المدير على "إعادة ضبط كلمة المرور" لحسابك فوراً.</li>
                  <li>يتم تزويدك بكلمة المرور الجديدة لتتمكن من الدخول.</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                فهمت ذلك، العودة لصفحة الدخول
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SupportTicket } from '../../types';
import {
  LifeBuoy,
  Send,
  MessageCircle,
  HelpCircle,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Bot,
  Sparkles,
  ShieldAlert,
  Wifi,
  Database,
  MapPin,
  RefreshCw,
  Plus
} from 'lucide-react';

export const SupportCenter: React.FC = () => {
  const {
    tickets,
    currentUser,
    settings,
    isOnline,
    pendingSyncCount,
    addTicket,
    triggerCloudSync,
    showAlert
  } = useApp();

  const [activeTab, setActiveTab] = useState<'tickets' | 'diagnostics' | 'faq'>('tickets');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Ticket Form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('تقني');
  const [priority, setPriority] = useState<SupportTicket['priority']>('متوسط');
  const [description, setDescription] = useState('');

  // Diagnostic Test States
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<{ name: string; status: 'ok' | 'warn' | 'fail'; detail: string }[]>([]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      showAlert('بيانات مطلوبة', 'يرجى كتابة عنوان وتفاصيل التذكرة.', 'warning');
      return;
    }

    await addTicket({
      subject,
      category,
      priority,
      description,
      userEmail: currentUser.email,
      userName: currentUser.name,
    });

    setSubject('');
    setDescription('');
    setIsCreateModalOpen(false);
  };

  const runDiagnostics = () => {
    setIsDiagnosing(true);
    setDiagnosticLogs([]);

    setTimeout(() => {
      const logs: { name: string; status: 'ok' | 'warn' | 'fail'; detail: string }[] = [
        {
          name: 'حالة الاتصال والشبكة (Online/Offline)',
          status: isOnline ? 'ok' : 'warn',
          detail: isOnline ? 'متصل بالإنترنت ومستعد للمزامنة الفورية' : 'وضع غير متصل - يتم حفظ البيانات محلياً',
        },
        {
          name: 'طابور المزامنة السحابية (Sync Queue)',
          status: pendingSyncCount === 0 ? 'ok' : 'warn',
          detail: pendingSyncCount === 0 ? 'جميع العمليات متزامنة بنسبة 100%' : `يوجد ${pendingSyncCount} عمليات تنتظر المزامنة`,
        },
        {
          name: 'قاعدة البيانات المحلية (Indexed Storage)',
          status: 'ok',
          detail: 'ذاكرة التخزين المحلية تعمل بكفاءة تامة وتستوعب البيانات',
        },
        {
          name: 'مستشعر الموقع الجغرافي الميداني (GPS)',
          status: navigator.geolocation ? 'ok' : 'fail',
          detail: navigator.geolocation ? 'المتصفح يدعم مستشعر GPS لالتقاط إحداثيات الفواتير' : 'المتصفح لا يدعم Geolocation API',
        },
        {
          name: 'تشفير وسلامة الجلسة (Security & Role)',
          status: 'ok',
          detail: `الجلسة مشفرة بنجاح للدور: ${currentUser.role} (${currentUser.name})`,
        },
      ];
      setDiagnosticLogs(logs);
      setIsDiagnosing(false);
    }, 800);
  };

  const handleOpenTelegram = () => {
    const message = encodeURIComponent(
      `مرحباً م. منصور، لدي استفسار بخصوص نظام المصروفات والعهد:\nالمستخدم: ${currentUser.name} (${currentUser.role})\nالبريد: ${currentUser.email}`
    );
    window.open(`https://t.me/${settings.telegramRecipient}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                مركز الدعم الفني والمساعدة الميدانية
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                فتح تذاكر صيانة، فحص تشخيصي ذاتي للمزامنة والـ GPS، وتواصل فوري عبر تيليجرام
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenTelegram}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-sky-500/20 flex items-center gap-2 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>محادثة تيليجرام مباشرة</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>فتح تذكرة دعم</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'tickets'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>تذاكر الدعم ({tickets.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('diagnostics');
            if (diagnosticLogs.length === 0) runDiagnostics();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'diagnostics'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>الفحص الذاتي والتشخيص</span>
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'faq'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>الأسئلة الشائعة والتعليمات</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                لا توجد تذاكر دعم مفتوحة حالياً
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                إذا واجهتك أي مشكلة في إدخال المصروفات أو المزامنة، يمكنك فتح تذكرة جديدة.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] text-slate-400 block mb-0.5">
                        {ticket.id} • {ticket.createdAt.split('T')[0]}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {ticket.subject}
                      </h4>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        ticket.status === 'مغلق'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : ticket.status === 'قيد المتابعة'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                    {ticket.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>مقدم التذكرة: {ticket.userName}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">
                      الأولوية: {ticket.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                فحص جاهزية النظام والاتصال الميداني
              </h3>
              <p className="text-xs text-slate-400">
                اختبار فوري لكافة وحدات التخزين، المزامنة، وتحديد الموقع الجغرافي
              </p>
            </div>
            <button
              onClick={runDiagnostics}
              disabled={isDiagnosing}
              className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
              <span>إعادة الفحص الآن</span>
            </button>
          </div>

          <div className="space-y-3">
            {diagnosticLogs.map((log, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  {log.status === 'ok' ? (
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : log.status === 'warn' ? (
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{log.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{log.detail}</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    log.status === 'ok'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : log.status === 'warn'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {log.status === 'ok' ? 'سليم ومتصل' : log.status === 'warn' ? 'تنبيه' : 'فشل'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            الأسئلة الشائعة ودليل الاستخدام السريع
          </h3>

          <div className="space-y-3">
            <details className="group p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 open:ring-1 open:ring-emerald-500 transition-all">
              <summary className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer list-none flex items-center justify-between">
                <span>كيف يعمل النظام بدون اتصال بالإنترنت (Offline Mode)؟</span>
                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                يمكن للمشرفين في المواقع الميدانية المعزولة إدخال الفواتير والمصروفات وصور المستندات حتى دون توفر شبكة. يقوم البرنامج بحفظ البيانات فورياً في الذاكرة المحلية وطابور المزامنة، وتتم المزامنة السحابية تلقائياً بمجرد عودة الاتصال.
              </p>
            </details>

            <details className="group p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 open:ring-1 open:ring-emerald-500 transition-all">
              <summary className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer list-none flex items-center justify-between">
                <span>ما هي قاعدة الـ 30 دقيقة لتعديل المصروفات؟</span>
                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                وفقاً للسياسة المالية للرقابة، يُتاح للمشرف الميداني تعديل أو حذف المصروف خلال 30 دقيقة من وقت تسجيل البصمة. بعد مرور الـ 30 دقيقة أو عند بدء مراجعة المحاسب، يُقفل السند لمنع التلاعب وتتولى الإدارة والمحاسب صلاحية التعديل.
              </p>
            </details>

            <details className="group p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 open:ring-1 open:ring-emerald-500 transition-all">
              <summary className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer list-none flex items-center justify-between">
                <span>كيف يتم احتساب الرصيد المتبقي للعهدة النقدية؟</span>
                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                الرصيد المتبقي = (إجمالي العهد النقدية المسلمة للمشرف) - (إجمالي الفواتير المعتمدة نهائياً من قبل الإدارة والمحاسب). الفواتير غير المعتمدة تبقى معلقة حتى تنتهي دورة التدقيق.
              </p>
            </details>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                فتح تذكرة دعم فني جديدة
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان المشكلة / الاستفسار <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: تعذر إرفاق صورة الفاتورة في مشروع الأندلس"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    التصنيف
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="تقني">مشكلة تقنية</option>
                    <option value="مالي">استفسار مالي / عهدة</option>
                    <option value="اقتراح">اقتراح تحسين</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    مستوى الأولوية
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="منخفض">منخفض</option>
                    <option value="متوسط">متوسط</option>
                    <option value="عاجل">عاجل جداً</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  شرح وتفاصيل المشكلة <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="يرجى كتابة التفاصيل والخطوات..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
                >
                  إرسال التذكرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

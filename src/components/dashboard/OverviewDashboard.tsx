import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Wallet,
  ReceiptText,
  Clock,
  Briefcase,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  Send,
  MessageCircle,
  Plus,
  FileSpreadsheet,
  CheckCircle,
  Eye,
  ShieldAlert,
  Building2,
  Printer,
  Settings
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { WhatsAppService } from '../../services/whatsappService';

export const OverviewDashboard: React.FC = () => {
  const {
    expenses,
    custodies,
    projects,
    accessibleProjects,
    supervisorsSummary,
    currentSupervisorSummary,
    currentUser,
    currentUserPermissions,
    settings,
    totalCompanyExpenses,
    totalCompanyCustody,
    totalPendingApprovalsCount,
    activeProjectsCount,
    setCurrentView,
    setSelectedExpenseForDetail,
    setIsExpenseModalOpen,
    setEditingExpense,
    exportAllToExcel,
    isExpenseApprovedByPrecedingStages,
    isDarkMode,
  } = useApp();

  const isSupervisor =
    currentUser.role === 'مشرف' ||
    currentUser.role === 'مشرف موقع' ||
    currentUser.roleId === 'role_supervisor' ||
    currentUser.role.includes('مشرف');

  const isAccountant =
    currentUser.role === 'محاسب' ||
    currentUser.role === 'محاسب مالي' ||
    currentUser.roleId === 'role_accountant' ||
    currentUser.role.includes('محاسب');

  // Low balance supervisors filter
  const lowBalanceSupervisors = React.useMemo(() => {
    return supervisorsSummary.filter(s => {
      if (s.remainingBalance > settings.lowBalanceThreshold || s.totalCustody <= 0) return false;
      if (isAccountant) {
        const allowedPrjIds = new Set(accessibleProjects.map(p => p.id));
        const supAssigned = s.assignedProjects || [];
        const hasCommon = supAssigned.some(id => allowedPrjIds.has(id));
        if (!hasCommon) return false;
      }
      return true;
    });
  }, [supervisorsSummary, settings.lowBalanceThreshold, isAccountant, accessibleProjects]);

  const COLORS = [
    '#10b981', // emerald
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#14b8a6', // teal
    '#6366f1', // indigo
    '#84cc16', // lime
  ];

  // Category breakdown for chart with percentages and matching colors
  const categoryStatsWithPercent = React.useMemo(() => {
    const map: Record<string, number> = {};
    const allowedPrjIds = new Set(accessibleProjects.map(p => p.id));
    expenses
      .filter(e => e.status === 'معتمد' && ((!isAccountant && !isSupervisor) || allowedPrjIds.has(e.projectId)))
      .forEach(e => {
        map[e.category] = (map[e.category] || 0) + e.amount;
      });

    const list = Object.entries(map).map(([name, value]) => ({
      name,
      value,
    }));

    // Sort descending by value so highest spending appears first
    list.sort((a, b) => b.value - a.value);

    const total = list.reduce((sum, item) => sum + item.value, 0);

    return list.map((item, index) => {
      const percent = total > 0 ? (item.value / total) * 100 : 0;
      return {
        ...item,
        percent: Number(percent.toFixed(1)),
        formattedPercent: `${percent.toFixed(1)}%`,
        color: COLORS[index % COLORS.length],
      };
    });
  }, [expenses, isAccountant, isSupervisor, accessibleProjects]);

  const totalCategoryExpenses = React.useMemo(() => {
    return categoryStatsWithPercent.reduce((sum, item) => sum + item.value, 0);
  }, [categoryStatsWithPercent]);

  // Recent 5 expenses filtered appropriately by role and workflow stages
  const recentExpenses = React.useMemo(() => {
    const allowedPrjIds = new Set(accessibleProjects.map(p => p.id));
    return expenses
      .filter(e => {
        if (isSupervisor) {
          if (!allowedPrjIds.has(e.projectId)) return false;
          const isMyExpense =
            e.supervisorEmail.toLowerCase() === currentUser.email.toLowerCase() ||
            e.supervisorName.toLowerCase().includes(currentUser.name.split(' ')[0].toLowerCase()) ||
            (Array.isArray(currentUser.assignedProjects) && currentUser.assignedProjects.includes(e.projectId));
          if (!isMyExpense) return false;
        }
        if (isAccountant) {
          return allowedPrjIds.has(e.projectId) && isExpenseApprovedByPrecedingStages(e, currentUser);
        }
        return true;
      })
      .slice(0, 5);
  }, [expenses, isSupervisor, isAccountant, currentUser, isExpenseApprovedByPrecedingStages, accessibleProjects]);

  const handleRequestCustody = () => {
    if (!currentSupervisorSummary) return;
    const managerPhone = settings.whatsappRecipient || settings.supportPhone || '+966 50 123 4567';
    const assignedProjectNames = currentSupervisorSummary.assignedProjects
      .map(pid => projects.find(p => p.id === pid)?.name || pid)
      .join('، ');

    WhatsAppService.sendCustodyTopUpRequest({
      supervisorName: currentSupervisorSummary.name,
      remainingBalance: currentSupervisorSummary.actualRemainingBalance ?? currentSupervisorSummary.remainingBalance,
      pendingExpenses: currentSupervisorSummary.totalPendingExpenses,
      approvedBalance: currentSupervisorSummary.approvedBookBalance,
      projects: assignedProjectNames || undefined,
      currencySymbol: settings.currencySymbol,
      managerPhone,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Enterprise Executive Brand Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center justify-center p-1.5 overflow-hidden shrink-0">
            {settings.companyLogo ? (
              <img
                src={settings.companyLogo}
                alt={settings.companyName}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center">
                <Building2 className="w-7 h-7" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {settings.companyName}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                لوحة الرقابة التنفيذية
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {settings.companySubtitle || 'منظومة إدارة العهد والمصروفات الميدانية والرقابة المالية'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => setCurrentView('reports')}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة تقرير معتمد</span>
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>إعدادات الشعار والهوية</span>
          </button>
        </div>
      </div>

      {/* Low Balance Alert Banner for Supervisor or Manager */}
      {isSupervisor && currentSupervisorSummary && currentSupervisorSummary.remainingBalance <= settings.lowBalanceThreshold && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                تنبيه هام: رصيد عهدتك التشغيلية منخفض جداً!
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                رصيدك الحالي هو{' '}
                <span className="font-extrabold underline">
                  {currentSupervisorSummary.remainingBalance.toLocaleString()} {settings.currencySymbol}
                </span>{' '}
                (أقل من الحد الموصى به {settings.lowBalanceThreshold.toLocaleString()} {settings.currencySymbol}).
              </p>
            </div>
          </div>
          <button
            onClick={handleRequestCustody}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
            title="إرسال طلب تعزيز عهدة للمدير عبر واتساب"
          >
            <MessageCircle className="w-4 h-4" />
            <span>طلب تعزيز عهدة للمدير (واتساب)</span>
          </button>
        </div>
      )}

      {/* Manager Notification about any Supervisor with Low Balance */}
      {!isSupervisor && lowBalanceSupervisors.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold">تنبيه الإدارة:</span> يوجد {lowBalanceSupervisors.length} مشرفين برصيد عهدة أقل من الحد المعتمد.
            </div>
          </div>
          <button
            onClick={() => setCurrentView('custodies')}
            className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1"
          >
            <span>عرض العهد وتسليم دفعات</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Custody */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isSupervisor ? 'إجمالي عهدتك المستلمة' : 'إجمالي العهد المسلمة'}
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
            {(isSupervisor && currentSupervisorSummary ? currentSupervisorSummary.totalCustody : totalCompanyCustody).toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">{settings.currencySymbol}</span>
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-500">
            {isSupervisor && currentSupervisorSummary ? (
              <>
                <span>رصيدك الفعلي المتبقي:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {currentSupervisorSummary.actualRemainingBalance.toLocaleString()} {settings.currencySymbol}
                </span>
              </>
            ) : (
              <>
                <span>عدد سندات العهد:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{custodies.length} سندات</span>
              </>
            )}
          </div>
        </div>

        {/* Total Approved Expenses */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isSupervisor ? 'مصروفاتك المعتمدة' : 'المصروفات المعتمدة'}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <ReceiptText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {(isSupervisor && currentSupervisorSummary ? currentSupervisorSummary.totalApprovedExpenses : totalCompanyExpenses).toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">{settings.currencySymbol}</span>
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-500">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>منصرف ومعتمد نظامياً</span>
          </div>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={!isSupervisor ? () => setCurrentView('approvals') : () => setCurrentView('expenses')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">فواتير بانتظار الاعتماد</span>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {totalPendingApprovalsCount}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
            <span>{isSupervisor ? 'الانتقال لقائمة الفواتير' : 'اضغط للدخول لشاشة الاعتماد'}</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        {/* Active Projects */}
        <div
          onClick={!isSupervisor ? () => setCurrentView('projects') : undefined}
          className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all ${
            !isSupervisor ? 'cursor-pointer hover:border-blue-400 hover:shadow-md' : 'cursor-default'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isSupervisor ? 'المشاريع المسندة لك' : 'المشاريع النشطة'}
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
            {isSupervisor
              ? accessibleProjects.length
              : activeProjectsCount}{' '}
            <span className="text-xs font-normal text-slate-500">
              {isSupervisor ? 'مشروع مسند' : `من إجمالي ${projects.length}`}
            </span>
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-500">
            <span>{isSupervisor ? 'مشاريعك الميدانية النشطة' : 'مشاريع جارية قيد التنفيذ'}</span>
          </div>
        </div>

      </div>

      {/* Visual Analytics Section: Category Breakdown */}
      <div>
        {/* Expenses by Category (Donut Chart) */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">توزيع المصروفات حسب البند</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">النسب المئوية والمبالغ المالية لكل تصنيف</p>
            </div>
            <span className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
              {totalCategoryExpenses.toLocaleString()} {settings.currencySymbol}
            </span>
          </div>

          {categoryStatsWithPercent.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              {/* Donut Chart (Enlarged for Clear Data Visibility) */}
              <div className="w-[220px] h-[250px] sm:w-[260px] sm:h-[280px] shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStatsWithPercent}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={98}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryStatsWithPercent.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          className="transition-all duration-200 hover:opacity-85"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${Number(val).toLocaleString()} ${settings.currencySymbol}`, 'المبلغ']}
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        borderRadius: '14px',
                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                        textAlign: 'right',
                        direction: 'rtl',
                        fontSize: '12px',
                        padding: '10px 14px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Donut center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-xs text-slate-400 font-medium leading-none">إجمالي المنصرف</span>
                  <span className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 font-mono mt-1">
                    {totalCategoryExpenses >= 1000000
                      ? `${(totalCategoryExpenses / 1000000).toFixed(2)}M`
                      : totalCategoryExpenses >= 1000
                      ? `${(totalCategoryExpenses / 1000).toFixed(1)}k`
                      : totalCategoryExpenses.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">{settings.currencySymbol}</span>
                </div>
              </div>

              {/* Names & Percentages List with Matching Colors (Expanded so all data appears) */}
              <div className="flex-1 w-full space-y-2 max-h-[340px] overflow-y-auto pl-1.5 pr-0.5 custom-scrollbar">
                {categoryStatsWithPercent.map((cat) => (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between gap-3 p-2.5 px-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/70 dark:border-slate-800/80 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span
                        className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate"
                        title={cat.name}
                      >
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                        {cat.value.toLocaleString()} {settings.currencySymbol}
                      </span>
                      <span
                        className="px-2.5 py-1 rounded-xl text-xs font-black font-mono shadow-2xs inline-flex items-center justify-center min-w-[52px]"
                        style={{
                          color: cat.color,
                          backgroundColor: `${cat.color}15`,
                          borderColor: `${cat.color}35`,
                          borderWidth: 1,
                        }}
                      >
                        {cat.formattedPercent}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-56 text-xs text-slate-400">
              لا توجد مصروفات معتمدة بعد للرسم البياني
            </div>
          )}
        </div>
      </div>

      {/* Supervisors Custody Health Table (Hidden for Supervisors to protect financial privacy) */}
      {!isSupervisor && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">متابعة أرصدة عهد المشرفين الميدانيين</h3>
              <p className="text-xs text-slate-400">الرقابة الفورية على العهد المتبقية والتنبيهات الآلية</p>
            </div>
            <button
              onClick={() => setCurrentView('custodies')}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="الانتقال إلى شاشة إدارة العهد النقدية ومتابعة الأرصدة"
            >
              <span>إدارة العهد بالكامل</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-y border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">المشرف</th>
                  <th className="py-2.5 px-3 font-semibold">المشاريع المسندة</th>
                  <th className="py-2.5 px-3 font-semibold">إجمالي العهد المسلمة</th>
                  <th className="py-2.5 px-3 font-semibold">المصروفات المعتمدة</th>
                  <th className="py-2.5 px-3 font-semibold text-amber-700 dark:text-amber-400">فواتير قيد التدقيق</th>
                  <th className="py-2.5 px-3 font-semibold text-emerald-700 dark:text-emerald-400">الرصيد الفعلي المتبقي</th>
                  <th className="py-2.5 px-3 font-semibold">الرصيد الدفتري</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {supervisorsSummary.map((sup, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      {sup.name}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {sup.assignedProjects.length > 0 ? (
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {sup.assignedProjects.join(', ')}
                        </span>
                      ) : (
                        'كافة المشاريع'
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      {sup.totalCustody.toLocaleString()} {settings.currencySymbol}
                    </td>
                    <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-medium">
                      {sup.totalApprovedExpenses.toLocaleString()} {settings.currencySymbol}
                    </td>
                    <td className="py-3 px-3 text-amber-600 dark:text-amber-400 font-bold">
                      {sup.totalPendingExpenses > 0 ? (
                        <span>{sup.totalPendingExpenses.toLocaleString()} {settings.currencySymbol} ({sup.pendingCount})</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-black">
                      <span className={sup.actualRemainingBalance <= settings.lowBalanceThreshold ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-900 dark:text-white font-black'}>
                        {sup.actualRemainingBalance.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-purple-700 dark:text-purple-300 font-bold">
                      {sup.approvedBookBalance.toLocaleString()} {settings.currencySymbol}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          sup.actualRemainingBalance < 0
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                            : sup.actualRemainingBalance <= settings.lowBalanceThreshold
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 animate-pulse'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                        }`}
                      >
                        {sup.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity / Invoices */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">آخر الفواتير والمصروفات المسجلة</h3>
            <p className="text-xs text-slate-400">قائمة بأحدث المعاملات مع تتبع حالة الاعتماد والوقت</p>
          </div>
          <button
            onClick={() => setCurrentView('expenses')}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>عرض كل المصروفات</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {recentExpenses.map(expense => (
            <div
              key={expense.id}
              onClick={() => setSelectedExpenseForDetail(expense)}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                  {expense.category.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {expense.details}
                    </p>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {expense.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {expense.projectName} • بواسطة {expense.supervisorName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-left">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {expense.amount.toLocaleString()} {settings.currencySymbol}
                  </p>
                  <p className="text-[10px] text-slate-400">{expense.date}</p>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    expense.status === 'معتمد'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : expense.status === 'مرفوض'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {expense.status}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedExpenseForDetail(expense);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title="عرض التفاصيل"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

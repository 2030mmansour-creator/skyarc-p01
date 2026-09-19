import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { CustodyRecord, SupervisorSummary, Expense } from '../../types';
import {
  Wallet,
  Plus,
  Send,
  AlertTriangle,
  CheckCircle,
  Printer,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CreditCard,
  User,
  Calendar,
  X,
  Search,
  Filter,
  Eye,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Building,
  HelpCircle,
  ShieldCheck,
  Edit2,
  Trash2,
  Receipt,
  FileSpreadsheet,
  Check,
  ArrowRight,
  MessageCircle
} from 'lucide-react';
import { WhatsAppService } from '../../services/whatsappService';
import { SaveSyncBadge } from '../common/SaveSyncBadge';

export const CustodyManagement: React.FC = () => {
  const {
    custodies,
    expenses,
    projects,
    supervisorsSummary,
    users,
    currentUser,
    settings,
    addCustody,
    updateCustody,
    deleteCustody,
    setPrintData,
    setIsPrintModalOpen,
    setSelectedExpenseForDetail,
    hasPermission,
    confirmAction,
    showAlert,
    accessibleProjects,
    isUserAssignedToProject,
  } = useApp();

  const isAccountant =
    currentUser.role === 'محاسب' ||
    currentUser.role === 'محاسب مالي' ||
    currentUser.roleId === 'role_accountant' ||
    currentUser.role.includes('محاسب');

  const isSupervisor =
    currentUser.role === 'مشرف' ||
    currentUser.role === 'مشرف موقع' ||
    currentUser.roleId === 'role_supervisor' ||
    currentUser.role.includes('مشرف');

  // Mode & Filter States
  const [balanceDisplayMode, setBalanceDisplayMode] = useState<'actual' | 'book' | 'both'>('both');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'adequate' | 'deficit'>('all');
  const [activeTab, setActiveTab] = useState<'supervisors' | 'history'>('supervisors');

  // Modal States
  const [isAddCustodyModalOpen, setIsAddCustodyModalOpen] = useState(false);
  const [editingCustody, setEditingCustody] = useState<CustodyRecord | null>(null);
  const [selectedSupervisorForLedger, setSelectedSupervisorForLedger] = useState<SupervisorSummary | null>(null);

  // Form State for Add / Edit Custody
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'تحويل بنكي' | 'بطاقة مصروفات بنكية' | 'نقداً' | 'شيك' | 'سند صرف خزينة'>('تحويل بنكي');
  const [bankName, setBankName] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sendWhatsAppNotice, setSendWhatsAppNotice] = useState(true);
  const [supervisorPhone, setSupervisorPhone] = useState('');
  const [disbursedNoticeModal, setDisbursedNoticeModal] = useState<{
    custody: CustodyRecord;
    supervisorName: string;
    phone?: string;
  } | null>(null);

  const supervisorUsers = useMemo(() => {
    const list = users.filter(u => u.role === 'مشرف' || u.role === 'مشرف موقع' || u.roleId === 'role_supervisor');
    if (isAccountant) {
      return list.filter(sup => accessibleProjects.some(p => isUserAssignedToProject(sup, p)));
    }
    return list;
  }, [users, isAccountant, accessibleProjects, isUserAssignedToProject]);

  // Selected supervisor details for live calculation preview inside Add Custody Modal
  const selectedSupervisorData = useMemo(() => {
    return supervisorsSummary.find(s => s.email === supervisorEmail) || null;
  }, [supervisorEmail, supervisorsSummary]);

  // Handle open add modal
  const handleOpenAdd = (presetEmail?: string) => {
    const defaultEmail = presetEmail || supervisorUsers[0]?.email || '';
    const initialUser = users.find(u => u.email === defaultEmail);
    setEditingCustody(null);
    setSupervisorEmail(defaultEmail);
    setSupervisorPhone(initialUser?.phone || '');
    setSendWhatsAppNotice(true);
    setAmount('');
    setPaymentMethod('تحويل بنكي');
    setBankName('مصرف الراجحي');
    setReceiptNumber('');
    setProjectId('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    setIsAddCustodyModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (cust: CustodyRecord) => {
    setEditingCustody(cust);
    setSupervisorEmail(cust.supervisorEmail);
    const targetUser = users.find(u => u.email === cust.supervisorEmail);
    setSupervisorPhone(targetUser?.phone || '');
    setSendWhatsAppNotice(false);
    setAmount(cust.amount);
    setPaymentMethod((cust.paymentMethod as any) || 'تحويل بنكي');
    setBankName(cust.bankName || '');
    setReceiptNumber(cust.receiptNumber || '');
    setProjectId(cust.projectId || '');
    setNotes(cust.notes || '');
    setDate(cust.date);
    setIsAddCustodyModalOpen(true);
  };

  // Handle form submission
  const handleSaveCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      showAlert('بيانات غير مكتملة', 'يرجى تحديد مبلغ العهدة المسلمة بشكل صحيح.', 'warning');
      return;
    }
    const sup = users.find(u => u.email === supervisorEmail);
    if (!sup) {
      showAlert('بيانات غير مكتملة', 'يرجى اختيار المشرف المستلم.', 'warning');
      return;
    }

    const matchedProject = projects.find(p => p.id === projectId);

    if (editingCustody) {
      await updateCustody(editingCustody.id, {
        supervisorEmail: sup.email,
        supervisorName: sup.name,
        amount: Number(amount),
        date,
        paymentMethod,
        bankName: bankName.trim() || undefined,
        receiptNumber: receiptNumber.trim() || undefined,
        projectId: projectId || undefined,
        projectName: matchedProject?.name,
        notes: notes.trim() || undefined,
      });
      setIsAddCustodyModalOpen(false);
    } else {
      const newCust = await addCustody({
        supervisorEmail: sup.email,
        supervisorName: sup.name,
        amount: Number(amount),
        date,
        paymentMethod,
        bankName: bankName.trim() || undefined,
        receiptNumber: receiptNumber.trim() || undefined,
        projectId: projectId || undefined,
        projectName: matchedProject?.name,
        notes: notes.trim() || undefined,
        issuedBy: currentUser.email,
      });

      setIsAddCustodyModalOpen(false);

      if (sendWhatsAppNotice) {
        const targetPhone = supervisorPhone.trim() || sup.phone;
        WhatsAppService.sendCustodyDisbursedNotice({
          custodyId: newCust.id,
          supervisorName: sup.name,
          supervisorPhone: targetPhone,
          amount: Number(amount),
          paymentMethod,
          receiptNumber: receiptNumber.trim() || undefined,
          bankName: bankName.trim() || undefined,
          projectName: matchedProject?.name,
          date,
          issuedByName: currentUser.name,
          currencySymbol: settings.currencySymbol,
          notes: notes.trim() || undefined,
        });

        setDisbursedNoticeModal({
          custody: newCust,
          supervisorName: sup.name,
          phone: targetPhone,
        });
      }
    }
  };

  // WhatsApp Custody Request to Manager
  const handleRequestCustodyWhatsApp = (sup: SupervisorSummary) => {
    const managerPhone = settings.whatsappRecipient || settings.supportPhone || '+966 50 123 4567';
    const assignedProjectNames = sup.assignedProjects
      .map(pid => projects.find(p => p.id === pid)?.name || pid)
      .join('، ');

    WhatsAppService.sendCustodyTopUpRequest({
      supervisorName: sup.name,
      remainingBalance: sup.actualRemainingBalance,
      pendingExpenses: sup.totalPendingExpenses,
      approvedBalance: sup.approvedBookBalance,
      projects: assignedProjectNames || undefined,
      currencySymbol: settings.currencySymbol,
      managerPhone,
    });
  };

  // Re-send or send instant WhatsApp notice to supervisor for any custody record
  const handleSendWhatsAppToSupervisor = (cust: CustodyRecord) => {
    const targetUser = users.find(u => u.email.toLowerCase() === cust.supervisorEmail.toLowerCase() || u.name === cust.supervisorName);
    const phone = targetUser?.phone;
    WhatsAppService.sendCustodyDisbursedNotice({
      custodyId: cust.id,
      supervisorName: cust.supervisorName,
      supervisorPhone: phone,
      amount: cust.amount,
      paymentMethod: cust.paymentMethod,
      receiptNumber: cust.receiptNumber,
      bankName: cust.bankName,
      projectName: cust.projectName,
      date: cust.date,
      issuedByName: currentUser.name,
      currencySymbol: settings.currencySymbol,
      notes: cust.notes,
    });
  };

  const handlePrintStatement = (sup: SupervisorSummary) => {
    setPrintData({ type: 'custody_statement', data: sup });
    setIsPrintModalOpen(true);
  };

  // Filter supervisors
  const filteredSupervisors = useMemo(() => {
    return supervisorsSummary.filter(sup => {
      if (isAccountant) {
        // Only show supervisors who share at least one project with the accountant
        const targetUser = users.find(u => u.email.toLowerCase() === sup.email.toLowerCase() || u.id === sup.id);
        const hasCommonProject = accessibleProjects.some(p => targetUser ? isUserAssignedToProject(targetUser, p) : false);
        if (!hasCommonProject) return false;
      }

      const matchSearch =
        sup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sup.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sup.phone && sup.phone.includes(searchQuery));

      if (!matchSearch) return false;

      if (statusFilter === 'low') {
        return sup.actualRemainingBalance <= settings.lowBalanceThreshold && sup.actualRemainingBalance >= 0;
      }
      if (statusFilter === 'deficit') {
        return sup.actualRemainingBalance < 0;
      }
      if (statusFilter === 'adequate') {
        return sup.actualRemainingBalance > settings.lowBalanceThreshold;
      }

      return true;
    });
  }, [supervisorsSummary, searchQuery, statusFilter, settings.lowBalanceThreshold, isAccountant, accessibleProjects, users, isUserAssignedToProject]);

  // Displayed custodies filtered for accountant
  const displayedCustodies = useMemo(() => {
    if (isAccountant) {
      const allowedPrjIds = new Set(accessibleProjects.map(p => p.id));
      return custodies.filter(c => !c.projectId || allowedPrjIds.has(c.projectId));
    }
    return custodies;
  }, [custodies, isAccountant, accessibleProjects]);

  // Aggregate Company Custody Figures
  const companyAggregates = useMemo(() => {
    const targetCustodies = isAccountant ? displayedCustodies : custodies;
    const allowedPrjIds = new Set(accessibleProjects.map(p => p.id));
    const targetExpenses = isAccountant ? expenses.filter(e => allowedPrjIds.has(e.projectId)) : expenses;

    const totalIssuedCustody = targetCustodies.reduce((sum, c) => sum + c.amount, 0);
    const totalApproved = targetExpenses
      .filter(e => e.status === 'معتمد')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalPending = targetExpenses
      .filter(e => e.status !== 'معتمد' && e.status !== 'مرفوض')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalAllRegistered = totalApproved + totalPending;
    const totalBookRemaining = totalIssuedCustody - totalApproved;
    const totalActualRemaining = totalIssuedCustody - totalAllRegistered;
    const lowCount = filteredSupervisors.filter(s => s.actualRemainingBalance <= settings.lowBalanceThreshold).length;

    return {
      totalIssuedCustody,
      totalApproved,
      totalPending,
      totalAllRegistered,
      totalBookRemaining,
      totalActualRemaining,
      lowCount,
    };
  }, [custodies, expenses, filteredSupervisors, settings.lowBalanceThreshold, isAccountant, displayedCustodies, accessibleProjects]);

  // Quick Amount Presets for Add Custody Modal
  const amountPresets = [5000, 10000, 20000, 50000, 100000];

  // Ledger items for the selected supervisor drawer
  const supervisorLedgerItems = useMemo(() => {
    if (!selectedSupervisorForLedger) return [];

    const supEmail = selectedSupervisorForLedger.email;
    const supCusts = custodies
      .filter(c => c.supervisorEmail === supEmail)
      .map(c => ({
        id: c.id,
        date: c.date,
        type: 'custody' as const,
        title: `دفعة عهدة مستلمة (${c.paymentMethod})`,
        details: c.notes || (c.receiptNumber ? `رقم السند/الحوالة: ${c.receiptNumber}` : 'إيداع عهدة نقدية'),
        credit: c.amount, // وارد (+)
        debit: 0,
        status: 'مستلمة' as const,
        raw: c,
      }));

    const supExps = expenses
      .filter(e => e.supervisorEmail === supEmail && e.status !== 'مرفوض')
      .map(e => ({
        id: e.id,
        date: e.date,
        type: 'expense' as const,
        title: `${e.category} - ${e.projectName}`,
        details: e.details,
        credit: 0,
        debit: e.amount, // منصرف (-)
        status: e.status,
        raw: e,
      }));

    // Merge and sort chronologically
    const all = [...supCusts, ...supExps].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute cumulative running balance
    let runningActual = 0;
    let runningBook = 0;

    return all.map(item => {
      if (item.type === 'custody') {
        runningActual += item.credit;
        runningBook += item.credit;
      } else {
        runningActual -= item.debit;
        if (item.status === 'معتمد') {
          runningBook -= item.debit;
        }
      }
      return {
        ...item,
        runningActualBalance: runningActual,
        runningBookBalance: runningBook,
      };
    });
  }, [selectedSupervisorForLedger, custodies, expenses]);

  // Export Custody Log to CSV/Excel
  const handleExportCustodyCSV = () => {
    const headers = ['رقم السند', 'التاريخ', 'المشرف', 'البريد', 'المبلغ', 'طريقة الدفع', 'البنك', 'رقم الحوالة', 'المشروع', 'البيان'];
    const rows = custodies.map(c => [
      c.id,
      c.date,
      c.supervisorName,
      c.supervisorEmail,
      c.amount,
      c.paymentMethod,
      c.bankName || '-',
      c.receiptNumber || '-',
      c.projectName || 'عهدة عامة',
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `سجل_العهد_النقدية_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canManage = hasPermission('canManageCustody') || currentUser.role === 'مدير عام' || currentUser.role === 'محاسب مالي';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Wallet className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                إدارة العهد النقدية ومتابعة أرصدة المشرفين
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                تدقيق مزدوج للأرصدة
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              احتساب الرصيد الفعلي المتبقي بعد الفواتير المسجلة قيد التدقيق والرصيد الدفتري المعتمد، مع تسليم دفعات العهد لحظياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto self-end sm:self-center">
          <button
            onClick={handleExportCustodyCSV}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
            title="تصدير سجل العهد إلى ملف Excel/CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">تصدير السجل</span>
          </button>

          {canManage && (
            <button
              onClick={() => handleOpenAdd()}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>تسليم عهدة لمشرف</span>
            </button>
          )}
        </div>
      </div>

      {/* Aggregate KPI Financial Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* Total Custody Issued */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">إجمالي العهد المسلمة</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {companyAggregates.totalIssuedCustody.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">{settings.currencySymbol}</span>
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block font-medium">
            {custodies.length} سندات تسليم مسجلة
          </span>
        </div>

        {/* Approved Expenses (Book Deduction) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">المصروفات المعتمدة نهائياً</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
            {companyAggregates.totalApproved.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">{settings.currencySymbol}</span>
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block font-medium">
            الرصيد الدفتري المتبقي: {companyAggregates.totalBookRemaining.toLocaleString()} {settings.currencySymbol}
          </span>
        </div>

        {/* Pending Expenses (Field Committed) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/90 dark:border-amber-900/50 shadow-sm relative overflow-hidden bg-gradient-to-b from-amber-50/40 to-transparent dark:from-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 dark:text-amber-300 font-bold">فواتير مسجلة قيد التدقيق</span>
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5 tabular-nums">
            {companyAggregates.totalPending.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">{settings.currencySymbol}</span>
          </p>
          <span className="text-[11px] text-amber-700 dark:text-amber-300 font-bold mt-1 block">
            مسحوبة ميدانياً وبانتظار الاعتماد
          </span>
        </div>

        {/* Actual Field Balance in Hand */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">السيولة المتبقية فعلياً</span>
            <div className={`p-2 rounded-xl border ${companyAggregates.totalActualRemaining <= settings.lowBalanceThreshold ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-900' : 'bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-900'}`}>
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-lg sm:text-2xl font-black mt-1.5 tabular-nums ${companyAggregates.totalActualRemaining <= settings.lowBalanceThreshold ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {companyAggregates.totalActualRemaining.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">{settings.currencySymbol}</span>
          </p>
          <div className="flex items-center gap-1 mt-1 text-[11px]">
            {companyAggregates.lowCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {companyAggregates.lowCount} مشرفين برصيد منخفض
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />
                كافة أرصدة المشرفين كافية
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Main Controls & Dual Balance Mode Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Tabs: Supervisors Balances vs Custody History Log */}
          <div className="flex items-center bg-slate-100/90 dark:bg-slate-800 p-1 rounded-2xl w-full sm:w-auto border border-slate-200/60 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('supervisors')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'supervisors'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>بطاقات أرصدة المشرفين ({filteredSupervisors.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>سجل سندات العهد المسلمة ({displayedCustodies.length})</span>
            </button>
          </div>

          {/* Dual Balance Visual Switcher */}
          {activeTab === 'supervisors' && (
            <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/70 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 px-2">عرض الرصيد:</span>
              <button
                onClick={() => setBalanceDisplayMode('both')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  balanceDisplayMode === 'both'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                المقارن (الفعلي + الدفتري)
              </button>
              <button
                onClick={() => setBalanceDisplayMode('actual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  balanceDisplayMode === 'actual'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
                title="الرصيد المتبقي فعلياً بعد خصم جميع الفواتير المسجلة قيد التدقيق"
              >
                الفعلي الميداني (شامل المسجل)
              </button>
              <button
                onClick={() => setBalanceDisplayMode('book')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  balanceDisplayMode === 'book'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
                title="الرصيد الدفتري المعتمد بعد خصم الفواتير المعتمدة فقط"
              >
                الدفتري (المعتمد فقط)
              </button>
            </div>
          )}

        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث باسم المشرف، البريد الإلكتروني، أو رقم الهاتف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">حالة الرصيد:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
              }`}
            >
              الكل ({supervisorsSummary.length})
            </button>
            <button
              onClick={() => setStatusFilter('low')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === 'low'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              رصيد منخفض ({supervisorsSummary.filter(s => s.actualRemainingBalance <= settings.lowBalanceThreshold && s.actualRemainingBalance >= 0).length})
            </button>
            <button
              onClick={() => setStatusFilter('deficit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === 'deficit'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              عجز في العهدة ({supervisorsSummary.filter(s => s.actualRemainingBalance < 0).length})
            </button>
            <button
              onClick={() => setStatusFilter('adequate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === 'adequate'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              رصيد كافي ({supervisorsSummary.filter(s => s.actualRemainingBalance > settings.lowBalanceThreshold).length})
            </button>
          </div>

        </div>

      </div>

      {/* Main Tab 1: Supervisors Balances Cards Grid */}
      {activeTab === 'supervisors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSupervisors.map((sup, idx) => {
            const isLow = sup.actualRemainingBalance <= settings.lowBalanceThreshold && sup.actualRemainingBalance >= 0;
            const isDeficit = sup.actualRemainingBalance < 0;

            // Calculate percentage breakdown of custody consumption
            const totalCust = sup.totalCustody || 1;
            const approvedPercent = Math.min(100, Math.round((sup.totalApprovedExpenses / totalCust) * 100));
            const pendingPercent = Math.min(100 - approvedPercent, Math.round((sup.totalPendingExpenses / totalCust) * 100));
            const remainingPercent = Math.max(0, 100 - approvedPercent - pendingPercent);

            return (
              <div
                key={idx}
                className={`rounded-3xl p-5 border bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                  isDeficit
                    ? 'border-rose-300 dark:border-rose-800 ring-1 ring-rose-400/30'
                    : isLow
                    ? 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-400/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  
                  {/* Supervisor Identity Header */}
                  <div className="flex items-start justify-between gap-2 mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm shadow-inner">
                        {sup.name.slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{sup.name}</span>
                          {currentUser.email === sup.email && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                              أنت
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate max-w-[170px]">{sup.email}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap ${
                        isDeficit
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : isLow
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {sup.status}
                    </span>
                  </div>

                  {/* Custody Consumption Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      <span>نسبة استهلاك العهدة:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {approvedPercent + pendingPercent}% مستهلك
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${approvedPercent}%` }}
                        className="bg-emerald-500 h-full transition-all"
                        title={`معتمد: ${sup.totalApprovedExpenses.toLocaleString()} ${settings.currencySymbol} (${approvedPercent}%)`}
                      />
                      <div
                        style={{ width: `${pendingPercent}%` }}
                        className="bg-amber-500 h-full transition-all"
                        title={`قيد التدقيق: ${sup.totalPendingExpenses.toLocaleString()} ${settings.currencySymbol} (${pendingPercent}%)`}
                      />
                      <div
                        style={{ width: `${remainingPercent}%` }}
                        className="bg-blue-500/40 h-full transition-all"
                        title={`متبقي متاح: ${sup.actualRemainingBalance.toLocaleString()} ${settings.currencySymbol} (${remainingPercent}%)`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> معتمد
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> قيد الاعتماد
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> متاح فعلياً
                      </span>
                    </div>
                  </div>

                  {/* Dual Balances Highlights */}
                  <div className="space-y-2 mb-4">
                    
                    {/* 1. Actual Available Balance (Cash in hand considering ALL registered expenses) */}
                    {(balanceDisplayMode === 'both' || balanceDisplayMode === 'actual') && (
                      <div className={`p-3 rounded-2xl border transition-all ${
                        isDeficit
                          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
                          : isLow
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-100 dark:border-slate-700/60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>الرصيد الفعلي المتبقي في الميدان:</span>
                          </span>
                          <span className="text-[10px] text-slate-400">بعد كل المسجل</span>
                        </div>
                        <p className={`text-xl font-black mt-1 ${
                          isDeficit
                            ? 'text-rose-600 dark:text-rose-400'
                            : isLow
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {sup.actualRemainingBalance.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-slate-500">{settings.currencySymbol}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          (المبلغ الفعلي المتبقي نقداً بعد خصم المعتمد وغير المعتمد)
                        </p>
                      </div>
                    )}

                    {/* 2. Approved Book Balance (Official Audited Accounting Balance) */}
                    {(balanceDisplayMode === 'both' || balanceDisplayMode === 'book') && (
                      <div className="p-3 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>الرصيد الدفتري المعتمد رسمياً:</span>
                          </span>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">المحاسبي</span>
                        </div>
                        <p className="text-lg font-black text-purple-950 dark:text-purple-100 mt-1">
                          {sup.approvedBookBalance.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-purple-600 dark:text-purple-400">{settings.currencySymbol}</span>
                        </p>
                        <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-0.5">
                          (الرصيد المحاسبي المعتمد بعد خصم الفواتير المعتمدة فقط)
                        </p>
                      </div>
                    )}

                  </div>

                  {/* Detailed Financial Breakdown & Invoices Impact */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>إجمالي دفعات العهد المستلمة:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {sup.totalCustody.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle className="w-3 h-3" />
                        <span>فواتير معتمدة نهائياً ({sup.approvedCount}):</span>
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        - {sup.totalApprovedExpenses.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>فواتير مسجلة قيد التدقيق ({sup.pendingCount}):</span>
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        - {sup.totalPendingExpenses.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>

                    {/* Dynamic Impact Simulation Note */}
                    {sup.totalPendingExpenses > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
                        <TrendingDown className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                        <span>
                          <strong>أثر الاعتماد:</strong> عند اعتماد الفواتير المعلقة ({sup.totalPendingExpenses.toLocaleString()} {settings.currencySymbol})، سيصبح الرصيد الدفتري النهائي مساوياً للرصيد الفعلي وهو <strong>({sup.actualRemainingBalance.toLocaleString()} {settings.currencySymbol})</strong>.
                        </span>
                      </div>
                    )}

                  </div>

                </div>

                {/* Card Actions Bottom Toolbar */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* View Detailed Ledger */}
                    <button
                      onClick={() => setSelectedSupervisorForLedger(sup)}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      title="سجل الحركات وكشف العهدة التفصيلي"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>كشف الحركات</span>
                    </button>

                    {/* Print Statement */}
                    <button
                      onClick={() => handlePrintStatement(sup)}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                      title="طباعة كشف الحساب الرسمي"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Add Custody Quick Button for this supervisor */}
                    {canManage && (
                      <button
                        onClick={() => handleOpenAdd(sup.email)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition-all"
                        title="تسليم دفعة عهدة جديدة لهذا المشرف"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>تسليم عهدة</span>
                      </button>
                    )}

                    {/* WhatsApp Custody Request */}
                    {isLow && (
                      <button
                        onClick={() => handleRequestCustodyWhatsApp(sup)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition-all"
                        title="طلب تعزيز عهدة عاجل للمدير عبر واتساب"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>تعزيز (واتساب)</span>
                      </button>
                    )}
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Main Tab 2: Custody Delivery History Log Table */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">سجل سندات وتحويلات العهد المسلمة</h3>
              <p className="text-xs text-slate-400">توثيق كامل لكافة الدفعات النقدية والتحويلات البنكية للمشرفين</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              إجمالي السندات: {displayedCustodies.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3.5 font-semibold">رقم السند</th>
                  <th className="py-3 px-3.5 font-semibold">التاريخ</th>
                  <th className="py-3 px-3.5 font-semibold">المشرف المستلم</th>
                  <th className="py-3 px-3.5 font-semibold">المشروع المرتبط</th>
                  <th className="py-3 px-3.5 font-semibold">المبلغ المسلم</th>
                  <th className="py-3 px-3.5 font-semibold">طريقة الدفع</th>
                  <th className="py-3 px-3.5 font-semibold">البنك / المرجع</th>
                  <th className="py-3 px-3.5 font-semibold">البيان والملاحظات</th>
                  {canManage && (
                    <th className="py-3 px-3.5 font-semibold text-center">إجراءات</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedCustodies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      لا توجد سندات عهد مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  displayedCustodies.map(cust => (
                    <tr key={cust.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <span>{cust.id}</span>
                          <SaveSyncBadge
                            savedLocally={cust.savedLocally ?? true}
                            synced={cust.synced}
                            size="sm"
                            showLabel={false}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">{cust.date}</td>
                      <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                        {cust.supervisorName}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">
                        {cust.projectName || <span className="text-slate-400">عهدة عامة تشغيلية</span>}
                      </td>
                      <td className="py-3 px-3.5 font-extrabold text-emerald-600 dark:text-emerald-400">
                        {cust.amount.toLocaleString()} {settings.currencySymbol}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          cust.paymentMethod === 'بطاقة مصروفات بنكية'
                            ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : cust.paymentMethod === 'تحويل بنكي'
                            ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                            : cust.paymentMethod === 'نقداً'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {cust.paymentMethod === 'بطاقة مصروفات بنكية' && (
                            <CreditCard className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                          )}
                          <span>{cust.paymentMethod}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 font-mono">
                        {cust.bankName ? `${cust.bankName} ` : ''}
                        {cust.receiptNumber ? `(#${cust.receiptNumber})` : '-'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                        {cust.notes || '-'}
                      </td>
                      {canManage && (
                        <td className="py-3 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSendWhatsAppToSupervisor(cust)}
                              className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                              title="إرسال إشعار تسليم العهدة للمشرف عبر واتساب"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(cust)}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors"
                              title="تعديل سند العهدة"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                confirmAction({
                                  title: 'تأكيد حذف سند العهدة',
                                  message: `هل أنت متأكد من حذف سند العهدة رقم (${cust.id})؟ سيتم خصم هذا المبلغ من إجمالي العهد المستلمة للمشرف (${cust.supervisorName}).`,
                                  details: `المبلغ: ${cust.amount.toLocaleString()} ${settings.currencySymbol} | طريقة الدفع: ${cust.paymentMethod} | التاريخ: ${cust.date}`,
                                  confirmText: 'نعم، حذف سند العهدة',
                                  cancelText: 'إلغاء',
                                  type: 'danger',
                                  onConfirm: () => {
                                    deleteCustody(cust.id);
                                  }
                                });
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                              title="حذف سند العهدة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Add / Edit Custody Modal with Live Balance Preview */}
      {isAddCustodyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
          <div className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingCustody ? `تعديل سند العهدة (${editingCustody.id})` : 'تسليم دفعة عهدة جديدة لمشرف'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    توثيق استلام العهدة واحتساب الأثر المالي الفوري على رصيد المشرف
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddCustodyModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustody} className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-1 pl-1">
              
              {/* Supervisor Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  المشرف المستلم <span className="text-rose-500">*</span>
                </label>
                <select
                  value={supervisorEmail}
                  onChange={e => {
                    const newEmail = e.target.value;
                    setSupervisorEmail(newEmail);
                    const foundUser = users.find(u => u.email === newEmail);
                    if (foundUser?.phone) {
                      setSupervisorPhone(foundUser.phone);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {supervisorUsers.map(u => (
                    <option key={u.id} value={u.email}>
                      {u.name} — {u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Live Balance Preview Box */}
              {selectedSupervisorData && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">الرصيد الفعلي الحالي قبل التسليم:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {selectedSupervisorData.actualRemainingBalance.toLocaleString()} {settings.currencySymbol}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">الرصيد الدفتري المعتمد الحالي:</span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">
                      {selectedSupervisorData.approvedBookBalance.toLocaleString()} {settings.currencySymbol}
                    </span>
                  </div>

                  {amount && Number(amount) > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>الرصيد الفعلي المتوقع بعد التسليم:</span>
                      </span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {(selectedSupervisorData.actualRemainingBalance + Number(amount)).toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Amount Input & Quick Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  المبلغ المسلم ({settings.currencySymbol}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="مثال: 50000"
                  value={amount}
                  onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />

                {/* Quick Amount Buttons */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">مبالغ سريعة:</span>
                  {amountPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap"
                    >
                      +{preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project Linkage & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    المشروع المرتبط
                  </label>
                  <select
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="">-- عهدة عامة تشغيلية --</option>
                    {((isAccountant || isSupervisor) ? accessibleProjects : projects).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>طريقة استلام / تسليم العهدة</span>
                    {paymentMethod === 'بطاقة مصروفات بنكية' && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> بطاقة بنكية
                      </span>
                    )}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="تحويل بنكي">تحويل بنكي (حساب المشرف)</option>
                    <option value="بطاقة مصروفات بنكية">بطاقات المصروفات البنكية (Corporate Card)</option>
                    <option value="نقداً">نقداً (خزينة الموقع)</option>
                    <option value="شيك">شيك مصرفي</option>
                    <option value="سند صرف خزينة">سند صرف خزينة</option>
                  </select>
                </div>
              </div>

              {/* Informative helper when Corporate Expense Card is selected */}
              {paymentMethod === 'بطاقة مصروفات بنكية' && (
                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-850 text-purple-900 dark:text-purple-200 flex items-start gap-2.5 text-xs animate-in fade-in">
                  <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-purple-950 dark:text-purple-200">
                      طريقة الاستلام: بطاقة مصروفات بنكية (Corporate Expense Card)
                    </p>
                    <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed">
                      يتم شحن أو تخصيص رصيد العهدة على بطاقة مصرفية مخصصة لمصروفات الموقع (مثل بطاقات الشركات، الراجحي للأعمال، أو مدى مسبقة الدفع) لتمكين المشرف من الشراء المباشر عبر أجهزة نقاط البيع (POS).
                    </p>
                  </div>
                </div>
              )}

              {/* Bank Name & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {paymentMethod === 'بطاقة مصروفات بنكية' ? 'البنك المصدر / نوع البطاقة' : 'اسم البنك / الحساب'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      paymentMethod === 'بطاقة مصروفات بنكية'
                        ? 'مثال: بطاقة الراجحي للمصروفات / مدى للأعمال'
                        : 'مثال: الراجحي / الأهلي'
                    }
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {paymentMethod === 'بطاقة مصروفات بنكية' ? 'رقم البطاقة / آخر 4 أرقام' : 'رقم الحوالة / السند'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      paymentMethod === 'بطاقة مصروفات بنكية'
                        ? 'مثال: **** 5241 أو الرقم المرجعي'
                        : 'TRX-102938'
                    }
                    value={receiptNumber}
                    onChange={e => setReceiptNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاريخ التسليم
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  البيان والغرض من العهدة
                </label>
                <textarea
                  rows={2}
                  placeholder="عهدة لتغطية مشتريات ومصروفات الموقع..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Instant WhatsApp Notification on Custody Delivery */}
              {!editingCustody && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 dark:text-emerald-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendWhatsAppNotice}
                        onChange={e => setSendWhatsAppNotice(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span className="flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        إرسال رسالة واتساب فورية للمشرف عند اعتماد التسليم
                      </span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                      فوري ومباشر
                    </span>
                  </div>

                  {sendWhatsAppNotice && (
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <label className="text-[11px] text-emerald-900 dark:text-emerald-300 font-medium whitespace-nowrap">
                        رقم واتساب المشرف:
                      </label>
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder="+966 5X XXX XXXX"
                        value={supervisorPhone}
                        onChange={e => setSupervisorPhone(e.target.value)}
                        className="w-full sm:w-56 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left"
                      />
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        (سيتم فتح محادثة الواتساب مع المشرف معبأة بكافة تفاصيل السند فور الحفظ)
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustodyModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  {editingCustody ? 'حفظ التعديلات' : 'اعتماد وتسليم العهدة'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Instant WhatsApp Custody Delivery Confirmation Modal */}
      {disbursedNoticeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-4 flex justify-center items-center animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl border border-emerald-200 dark:border-emerald-800 shadow-2xl p-6 w-full max-w-lg space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    تم تسليم العهدة وتجهيز إشعار الواتساب
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    تم إنشاء السند وإعداد رسالة الواتساب الفورية للمشرف
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDisbursedNoticeModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-2.5 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">رقم سند العهدة:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{disbursedNoticeModal.custody.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">المشرف المستلم:</span>
                <span className="font-bold text-slate-900 dark:text-white">{disbursedNoticeModal.supervisorName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">المبلغ المسلم:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {disbursedNoticeModal.custody.amount.toLocaleString()} {settings.currencySymbol}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">رقم واتساب المشرف:</span>
                <span className="font-mono font-bold dir-ltr">{disbursedNoticeModal.phone || 'غير محدد (اختيار من جهات الاتصال)'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  WhatsAppService.sendCustodyDisbursedNotice({
                    custodyId: disbursedNoticeModal.custody.id,
                    supervisorName: disbursedNoticeModal.supervisorName,
                    supervisorPhone: disbursedNoticeModal.phone,
                    amount: disbursedNoticeModal.custody.amount,
                    paymentMethod: disbursedNoticeModal.custody.paymentMethod,
                    receiptNumber: disbursedNoticeModal.custody.receiptNumber,
                    bankName: disbursedNoticeModal.custody.bankName,
                    projectName: disbursedNoticeModal.custody.projectName,
                    date: disbursedNoticeModal.custody.date,
                    issuedByName: currentUser.name,
                    currencySymbol: settings.currencySymbol,
                    notes: disbursedNoticeModal.custody.notes,
                  });
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إعادة فتح رسالة الواتساب للمشرف</span>
              </button>
              <button
                onClick={() => setDisbursedNoticeModal(null)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                تم ومتابعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Detailed Ledger Drawer / Modal */}
      {selectedSupervisorForLedger && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-5 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
          <div className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 w-full max-w-4xl max-h-[92vh] flex flex-col space-y-4 overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    كشف حركة العهدة والمسحوبات للمشرف: {selectedSupervisorForLedger.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    {selectedSupervisorForLedger.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  سجل متكامل يوضح كافة الدفعات المستلمة والمصروفات المسجلة وحساب الأرصدة المتبقية
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintStatement(selectedSupervisorForLedger)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة كشف الحساب</span>
                </button>
                <button
                  onClick={() => setSelectedSupervisorForLedger(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Balances Summary Cards inside Drawer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
                <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium block">إجمالي العهد المستلمة</span>
                <span className="text-base font-black text-blue-900 dark:text-blue-100 mt-0.5 block">
                  {selectedSupervisorForLedger.totalCustody.toLocaleString()} {settings.currencySymbol}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium block">المصروفات المعتمدة</span>
                <span className="text-base font-black text-emerald-800 dark:text-emerald-200 mt-0.5 block">
                  {selectedSupervisorForLedger.totalApprovedExpenses.toLocaleString()} {settings.currencySymbol}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900">
                <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium block">فواتير قيد الاعتماد</span>
                <span className="text-base font-black text-amber-800 dark:text-amber-200 mt-0.5 block">
                  {selectedSupervisorForLedger.totalPendingExpenses.toLocaleString()} {settings.currencySymbol}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold block">الرصيد الفعلي المتاح</span>
                <span className={`text-base font-black mt-0.5 block ${selectedSupervisorForLedger.actualRemainingBalance <= settings.lowBalanceThreshold ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                  {selectedSupervisorForLedger.actualRemainingBalance.toLocaleString()} {settings.currencySymbol}
                </span>
              </div>
            </div>

            {/* Ledger Transactions Table */}
            <div className="flex-1 overflow-y-auto min-h-[250px] border rounded-2xl border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">التاريخ</th>
                    <th className="py-2.5 px-3 font-semibold">نوع الحركة / الرقم</th>
                    <th className="py-2.5 px-3 font-semibold">البيان والتفاصيل</th>
                    <th className="py-2.5 px-3 font-semibold text-emerald-600">وارد (+)</th>
                    <th className="py-2.5 px-3 font-semibold text-rose-600">منصرف (-)</th>
                    <th className="py-2.5 px-3 font-semibold">الحالة</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">الرصيد الفعلي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {supervisorLedgerItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        لا توجد حركات مسجلة لهذا المشرف حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    supervisorLedgerItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{item.date}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {item.id}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">{item.details}</p>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600 whitespace-nowrap">
                          {item.credit > 0 ? `+${item.credit.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-rose-600 whitespace-nowrap">
                          {item.debit > 0 ? `-${item.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'معتمد' || item.status === 'مستلمة'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white whitespace-nowrap font-mono">
                          {item.runningActualBalance.toLocaleString()} {settings.currencySymbol}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Note */}
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
              <span>* يتم احتساب الرصيد الفعلي التراكمي بخصم كافة الفواتير المصروفة ميدانياً سواء اعتمدت أو قيد الاعتماد.</span>
              <button
                onClick={() => setSelectedSupervisorForLedger(null)}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

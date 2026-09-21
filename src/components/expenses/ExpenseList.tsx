import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Expense, ExpenseCategory, ApprovalStatus } from '../../types';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Printer,
  Download,
  ShieldAlert,
  WifiOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  MinusSquare,
  Layers,
  X,
  AlertOctagon,
  Lock,
  Calendar,
  RotateCcw,
  UserCheck,
  User,
  ShieldCheck,
  Upload,
  Paperclip,
  Zap,
  Globe,
  Cloud,
  Receipt,
  Image as ImageIcon,
  Link2
} from 'lucide-react';
import { BulkEditModal } from './BulkEditModal';
import { ImportExpensesModal } from './ImportExpensesModal';
import { BulkAttachModal } from './BulkAttachModal';
import { ColumnVisibilityDropdown, useColumnVisibility, ColumnDefinition } from '../common/ColumnVisibilityDropdown';
import { SaveSyncBadge } from '../common/SaveSyncBadge';

const EXPENSE_TABLE_COLUMNS: ColumnDefinition[] = [
  { id: 'id', label: 'رقم السند', defaultVisible: true, alwaysVisible: true, description: 'كود السند المميز وحالة المزامنة' },
  { id: 'dateAndProject', label: 'التاريخ والمشروع', defaultVisible: true, description: 'تاريخ الصرف واسم المشروع' },
  { id: 'categoryAndDesc', label: 'البند والبيان', defaultVisible: true, description: 'تصنيف المصروف والشرح والتفاصيل' },
  { id: 'supervisor', label: 'المشرف المسجل', defaultVisible: true, description: 'اسم المشرف الذي سجل المصروف' },
  { id: 'amount', label: 'المبلغ الإجمالي', defaultVisible: true, alwaysVisible: true, description: 'قيمة المصروف والعملة' },
  { id: 'locationAndReceipt', label: 'الموقع والمرفق', defaultVisible: true, description: 'موقع GPS ومستند/صورة الفاتورة' },
  { id: 'status', label: 'حالة الاعتماد', defaultVisible: true, description: 'حالة السند في مسار الاعتماد' },
  { id: 'lockTimer', label: 'مهلة التعديل', defaultVisible: true, description: 'النافذة الزمنية المتبقية للتعديل (30 دقيقة)' },
  { id: 'actions', label: 'الإجراءات والخيارات', defaultVisible: true, alwaysVisible: true, description: 'أزرار العرض والطباعة والتعديل والحذف' }
];

// Helper to format local date YYYY-MM-DD avoiding UTC timezone shifts
const getLocalDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper for comprehensive amount matching in search queries
const checkAmountMatch = (amount: number, taxAmount: number | undefined, rawTerm: string): boolean => {
  if (!rawTerm) return false;

  // Normalize Arabic-Indic digits: ٠١٢٣٤٥٦٧٨٩ -> 0123456789
  const clean = rawTerm
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[,،]/g, '') // strip thousands commas
    .replace(/(ريال|ر\.س|رس|sar)/gi, '') // strip currency keywords
    .trim();

  if (!clean) return false;

  // Check comparison operators: >=, <=, >, <
  const gteMatch = clean.match(/^>=\s*(\d+(\.\d+)?)$/);
  if (gteMatch) return amount >= parseFloat(gteMatch[1]);

  const lteMatch = clean.match(/^<=\s*(\d+(\.\d+)?)$/);
  if (lteMatch) return amount <= parseFloat(lteMatch[1]);

  const gtMatch = clean.match(/^>\s*(\d+(\.\d+)?)$/);
  if (gtMatch) return amount > parseFloat(gtMatch[1]);

  const ltMatch = clean.match(/^<\s*(\d+(\.\d+)?)$/);
  if (ltMatch) return amount < parseFloat(ltMatch[1]);

  // Check range query: e.g. 500-1000 or 500 - 1000
  const rangeMatch = clean.match(/^(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[3]);
    return amount >= min && amount <= max;
  }

  // Exact number or numeric substring match
  const amountStr = amount.toString();
  const amountFixed = amount.toFixed(2);
  const amountInt = Math.round(amount).toString();
  const taxStr = taxAmount !== undefined ? taxAmount.toString() : '';

  if (/^\d+(\.\d+)?$/.test(clean)) {
    const searchNum = parseFloat(clean);
    // Exact match
    if (Math.abs(amount - searchNum) < 0.001) return true;
    // Substring match in amount string
    if (amountStr.includes(clean) || amountFixed.includes(clean) || amountInt.includes(clean)) {
      return true;
    }
    // Substring in tax
    if (taxStr && taxStr.includes(clean)) return true;
  } else {
    // If not pure numeric, check if clean substring is in amount string
    if (amountStr.includes(clean)) return true;
  }

  return false;
};

export const ExpenseList: React.FC = () => {
  const {
    expenses,
    projects,
    accessibleProjects,
    users,
    supervisorsSummary,
    currentUser,
    currentUserRole,
    currentUserPermissions,
    hasPermission,
    isUserAssignedToProject,
    currentSupervisorSummary,
    settings,
    deleteExpense,
    bulkDeleteExpenses,
    setSelectedExpenseForDetail,
    setIsExpenseModalOpen,
    setEditingExpense,
    setPrintData,
    setIsPrintModalOpen,
    canEditExpense,
    canDeleteExpenseCheck,
    isExpenseApprovedStage1OrMore,
    isExpenseApprovedByPrecedingStages,
    getExpenseElapsedMinutes,
    confirmAction,
    showAlert,
    addNotification,
    approveByAccountant,
    approveByManagement,
    openAttachmentPreview
  } = useApp();

  // Periodic ticker to re-evaluate 30-minute countdown in real-time
  const [, setTimeTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(prev => prev + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Supervisor status and supervisor users list
  const isSupervisor =
    currentUser.role === 'مشرف' ||
    currentUser.role === 'مشرف موقع' ||
    currentUser.roleId === 'role_supervisor' ||
    currentUser.role.includes('مشرف');

  // Accountant status
  const isAccountant =
    currentUser.role === 'محاسب' ||
    currentUser.role === 'محاسب مالي' ||
    currentUser.roleId === 'role_accountant' ||
    currentUser.role.includes('محاسب');

  // Manager or Executive Management status (المدير أو الإدارة العليا)
  const isExecutiveOrManager = useMemo(() => {
    const roleStr = (currentUser.role || '').toLowerCase();
    const roleId = currentUser.roleId || '';
    const roleName = (currentUserRole?.name || '').toLowerCase();

    return (
      currentUser.id === 'USR-01' ||
      roleId === 'role_admin' ||
      roleId === 'role_manager' ||
      roleId === 'role_management' ||
      roleStr.includes('مدير عام') ||
      roleStr.includes('إدارة عليا') ||
      roleStr.includes('ادارة عليا') ||
      roleStr.includes('مدير تنفيذي') ||
      roleStr === 'مدير' ||
      roleStr === 'admin' ||
      roleName.includes('مدير عام') ||
      roleName.includes('إدارة عليا') ||
      roleName.includes('ادارة عليا') ||
      roleName.includes('مدير تنفيذي') ||
      roleName === 'مدير' ||
      roleName === 'admin'
    );
  }, [currentUser, currentUserRole]);

  const supervisorUsers = useMemo(() => {
    return users.filter(u => u.role.includes('مشرف') || u.roleId === 'role_supervisor');
  }, [users]);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'offline'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Dynamic Column Visibility preferences (saved in localStorage)
  const expenseColumns = useColumnVisibility('expense_list_visible_columns_v1', EXPENSE_TABLE_COLUMNS);

  // Detailed Date Filter State ('last_30_days' | 'month' | 'week' | 'today' | 'all' | 'custom')
  // Defaults to 'last_30_days' for instant page opening and high rendering performance
  const [dateFilterType, setDateFilterType] = useState<'last_30_days' | 'month' | 'week' | 'today' | 'all' | 'custom'>('last_30_days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Date range pre-computations (optimized for timezone and locale)
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const last30DaysRange = useMemo(() => {
    const now = new Date();
    const past30 = new Date(now);
    past30.setDate(now.getDate() - 30);
    return {
      start: getLocalDateString(past30),
      end: getLocalDateString(now)
    };
  }, []);

  const weekRange = useMemo(() => {
    const now = new Date();
    // Sunday as start of business week in the region
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    const startOfWeek = getLocalDateString(sunday);

    // Saturday as end of the calendar week
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const endOfWeek = getLocalDateString(saturday);

    // Rolling 7 days ago
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo);

    // Earliest of Sunday or 7 days ago guarantees all recent expenses are captured
    const effectiveStart = startOfWeek < sevenDaysAgoStr ? startOfWeek : sevenDaysAgoStr;
    return { start: effectiveStart, end: endOfWeek };
  }, []);

  const monthRange = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: getLocalDateString(startOfMonth),
      end: getLocalDateString(endOfMonth),
      monthName: now.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })
    };
  }, []);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkAttachModalOpen, setIsBulkAttachModalOpen] = useState(false);

  // Pagination State (Prevents UI freezing when viewing large datasets)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  // Base visible expenses for role-specific tab counts and statistics
  const baseVisibleExpenses = useMemo(() => {
    const hasAccountantPrjFilter = isAccountant && Array.isArray(currentUser.assignedProjects) && currentUser.assignedProjects.length > 0 && !currentUserPermissions?.canViewAllProjects;
    const allowedPrjIds = (hasAccountantPrjFilter || isSupervisor) ? new Set(accessibleProjects.map(p => p.id)) : null;

    return expenses.filter(exp => {
      // Supervisor isolation: Site supervisor only sees expenses belonging to their assigned projects
      if (isSupervisor) {
        if (allowedPrjIds && !allowedPrjIds.has(exp.projectId)) return false;
        const isMyExpense =
          exp.supervisorEmail.toLowerCase() === currentUser.email.toLowerCase() ||
          exp.supervisorName.toLowerCase().includes(currentUser.name.split(' ')[0].toLowerCase()) ||
          (Array.isArray(currentUser.assignedProjects) && currentUser.assignedProjects.includes(exp.projectId));
        if (!isMyExpense) return false;
      }

      // Accountant workflow rule: Financial accountant must NOT see expenses before they are approved by preceding stages (Stage 1 / Supervisor)
      // and only see expenses belonging to projects assigned to the accountant (if project restrictions are configured)
      if (isAccountant) {
        if (allowedPrjIds && !allowedPrjIds.has(exp.projectId)) return false;
        if (!isExpenseApprovedByPrecedingStages(exp)) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, isSupervisor, isAccountant, currentUser, currentUserPermissions, isExpenseApprovedByPrecedingStages, accessibleProjects]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const hasAccountantPrjFilter = isAccountant && Array.isArray(currentUser.assignedProjects) && currentUser.assignedProjects.length > 0 && !currentUserPermissions?.canViewAllProjects;
    const allowedPrjIds = (hasAccountantPrjFilter || isSupervisor) ? new Set(accessibleProjects.map(p => p.id)) : null;

    return expenses.filter(exp => {
      // Supervisor isolation: Site supervisor only sees expenses belonging to their assigned projects
      if (isSupervisor) {
        if (allowedPrjIds && !allowedPrjIds.has(exp.projectId)) return false;
        const isMyExpense =
          exp.supervisorEmail.toLowerCase() === currentUser.email.toLowerCase() ||
          exp.supervisorName.toLowerCase().includes(currentUser.name.split(' ')[0].toLowerCase()) ||
          (Array.isArray(currentUser.assignedProjects) && currentUser.assignedProjects.includes(exp.projectId));
        if (!isMyExpense) return false;
      }

      // Accountant workflow rule: Financial accountant must NOT see expenses before they are approved by preceding stages (Stage 1 / Supervisor)
      // and only see expenses belonging to projects assigned to the accountant (if project restrictions are configured)
      if (isAccountant) {
        if (allowedPrjIds && !allowedPrjIds.has(exp.projectId)) return false;
        if (!isExpenseApprovedByPrecedingStages(exp)) {
          return false;
        }
      }

      // Supervisor filter for Management / Accounting
      if (selectedSupervisor !== 'all') {
        const matchesSup =
          exp.supervisorEmail.toLowerCase() === selectedSupervisor.toLowerCase() ||
          exp.supervisorName.toLowerCase().includes(selectedSupervisor.toLowerCase());
        if (!matchesSup) return false;
      }

      // Project-based access control:
      // If user cannot view all projects, restrict strictly to their assigned projects
      if (!currentUserPermissions.canViewAllProjects) {
        const prj = projects.find(p => p.id === exp.projectId);
        if (prj && !isUserAssignedToProject(currentUser, prj)) {
          return false;
        }
      }

      // Search term (Matches: Details, ID, Supervisor, Project, Invoice, and AMOUNT)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesDetails = exp.details.toLowerCase().includes(term);
        const matchesId = exp.id.toLowerCase().includes(term);
        const matchesSupervisor = exp.supervisorName.toLowerCase().includes(term);
        const matchesProject = exp.projectName.toLowerCase().includes(term);
        const matchesInvoice = exp.invoiceNumber?.toLowerCase().includes(term);
        const matchesAmount = checkAmountMatch(exp.amount, exp.taxAmount, term);

        if (!matchesDetails && !matchesId && !matchesSupervisor && !matchesProject && !matchesInvoice && !matchesAmount) {
          return false;
        }
      }

      // Project filter
      if (selectedProject !== 'all' && exp.projectId !== selectedProject) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) {
        return false;
      }

      // Date Filter
      if (dateFilterType !== 'all') {
        const expDate = (exp.date || '').split('T')[0];
        if (!expDate) return false;

        if (dateFilterType === 'last_30_days') {
          if (expDate < last30DaysRange.start || expDate > last30DaysRange.end) return false;
        } else if (dateFilterType === 'today') {
          if (expDate !== todayStr) return false;
        } else if (dateFilterType === 'week') {
          if (expDate < weekRange.start || expDate > weekRange.end) return false;
        } else if (dateFilterType === 'month') {
          if (expDate < monthRange.start || expDate > monthRange.end) return false;
        } else if (dateFilterType === 'custom') {
          if (customStartDate && expDate < customStartDate) return false;
          if (customEndDate && expDate > customEndDate) return false;
        }
      }

      // Status Tab
      if (selectedStatusTab === 'pending') {
        if (exp.status !== 'بانتظار الاعتماد' && (exp.status as string) !== 'بانتظار اعتماد الادارة' && exp.status !== 'بانتظار مراجعة وترحيل المحاسب المالي' && exp.status !== 'بانتظار اعتماد الإدارة العليا') return false;
      } else if (selectedStatusTab === 'approved') {
        if (exp.status !== 'معتمد') return false;
      } else if (selectedStatusTab === 'rejected') {
        if (exp.status !== 'مرفوض') return false;
      } else if (selectedStatusTab === 'offline') {
        if (exp.synced) return false;
      }

      return true;
    });
  }, [
    expenses,
    currentUser,
    currentUserPermissions,
    isSupervisor,
    selectedSupervisor,
    projects,
    isUserAssignedToProject,
    searchTerm,
    selectedProject,
    selectedCategory,
    dateFilterType,
    customStartDate,
    customEndDate,
    todayStr,
    last30DaysRange,
    weekRange,
    monthRange,
    selectedStatusTab
  ]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedSupervisor,
    selectedProject,
    selectedCategory,
    selectedStatusTab,
    dateFilterType,
    customStartDate,
    customEndDate,
    pageSize
  ]);

  // Total pages and paginated slices for high rendering performance
  const totalPages = useMemo(() => {
    if (pageSize === 'all' || pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  }, [filteredExpenses.length, pageSize]);

  const paginatedExpenses = useMemo(() => {
    if (pageSize === 'all') return filteredExpenses;
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  const handleCreateNew = () => {
    if (isAccountant) {
      showAlert(
        'شاشة للاطلاع فقط',
        'شاشة المصروفات مخصصة للمحاسب المالي للاطلاع والتدقيق فقط، ولا تملك صلاحية إضافة أي مصروف.',
        'warning'
      );
      return;
    }

    if (isSupervisor && currentSupervisorSummary && currentSupervisorSummary.actualRemainingBalance <= 0) {
      showAlert(
        'رصيد العهدة مستنفذ بالكامل',
        `لا يمكنك تسجيل مصروف جديد نظراً لعدم وجود رصيد متبقي في عهدتك (الرصيد الحالي: ${currentSupervisorSummary.actualRemainingBalance.toLocaleString()} ${settings.currencySymbol}). يرجى طلب صرف دفعة عهدة جديدة من الإدارة المالية للمتابعة.`,
        'error'
      );
      return;
    }
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const handleEdit = (exp: Expense) => {
    if (isAccountant) {
      showAlert(
        'شاشة للاطلاع فقط',
        'شاشة المصروفات مخصصة للمحاسب المالي للاطلاع والتدقيق فقط، ولا تملك صلاحية تعديل السندات.',
        'warning'
      );
      return;
    }

    const editCheck = canEditExpense(exp);
    if (!editCheck.canEdit) {
      showAlert('تنبيه تعديل المصروف', editCheck.reason || 'لا يمكنك تعديل هذا المصروف بعد انقضاء المهلة المسموحة.', 'warning');
      return;
    }
    setEditingExpense(exp);
    setIsExpenseModalOpen(true);
  };

  const handleDelete = (exp: Expense) => {
    if (isAccountant) {
      showAlert(
        'شاشة للاطلاع فقط',
        'شاشة المصروفات مخصصة للمحاسب المالي للاطلاع والتدقيق فقط، ولا تملك صلاحية حذف السندات.',
        'warning'
      );
      return;
    }

    const deleteCheck = canDeleteExpenseCheck(exp);
    if (!deleteCheck.canDelete) {
      showAlert('لا يمكن حذف هذا المصروف', deleteCheck.reason || 'ليس لديك صلاحية لحذف هذا المصروف.', 'warning');
      return;
    }

    confirmAction({
      title: 'تأكيد حذف المصروف نهائياً',
      message: `هل أنت متأكد من حذف سند المصروف رقم (${exp.id})؟ سيتم حذفه من كافة السجلات وتحديث أرصدة المشروع والعهدة.`,
      details: `المبلغ: ${exp.amount.toLocaleString()} ${settings.currencySymbol} | البند: ${exp.category} | المشروع: ${exp.projectName}`,
      confirmText: 'نعم، حذف المصروف',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: async () => {
        const success = await deleteExpense(exp.id);
        if (success) {
          addNotification(
            'تم حذف المصروف بنجاح',
            `تم حذف سند المصروف رقم ${exp.id} بمبلغ ${exp.amount.toLocaleString()} ${settings.currencySymbol}.`,
            'info'
          );
        }
      }
    });
  };

  const handlePrintVoucher = (exp: Expense) => {
    setPrintData({ type: 'expense', data: exp });
    setIsPrintModalOpen(true);
  };

  // Selection Memos & Handlers
  const selectedExpenses = useMemo(() => {
    const set = new Set(selectedIds);
    return expenses.filter(e => set.has(e.id));
  }, [expenses, selectedIds]);

  const selectedTotalAmount = useMemo(() => {
    return selectedExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [selectedExpenses]);

  const isAllFilteredSelected = filteredExpenses.length > 0 && filteredExpenses.every(e => selectedIds.includes(e.id));
  const isSomeFilteredSelected = filteredExpenses.some(e => selectedIds.includes(e.id)) && !isAllFilteredSelected;

  const toggleSelectExpense = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredExpenses.map(e => e.id));
      setSelectedIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...filteredExpenses.map(e => e.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  const handleBulkDelete = () => {
    if (selectedExpenses.length === 0) return;

    if (!hasPermission('canDeleteExpense')) {
      showAlert(
        'شاشة للاطلاع والتدقيق فقط',
        `دورك الحالي (${currentUserRole?.name || currentUser.role}) لا يملك صلاحية حذف السندات وفقاً لمصفوفة الصلاحيات (RBAC).`,
        'warning'
      );
      return;
    }

    const deletable: Expense[] = [];
    const blocked: Expense[] = [];

    selectedExpenses.forEach(exp => {
      const check = canDeleteExpenseCheck(exp);
      if (check.canDelete) {
        deletable.push(exp);
      } else {
        blocked.push(exp);
      }
    });

    if (deletable.length === 0) {
      showAlert(
        'تعذر الحذف الجماعي',
        'كافة السندات المحددة معتمدة نهائياً أو خارج مهلة الحذف المسموحة لك.',
        'warning'
      );
      return;
    }

    const deletableTotal = deletable.reduce((sum, e) => sum + e.amount, 0);

    let confirmMsg = `هل أنت متأكد من حذف كافة السندات المحددة (${deletable.length} سند) نهائياً؟ سيتم حذفها من السجلات وتحديث أرصدة المشروعات والعهد المرتبطة.`;
    if (blocked.length > 0) {
      confirmMsg = `تم تحديد (${selectedExpenses.length}) سند، منها (${deletable.length}) سند متاح للحذف، وعدد (${blocked.length}) سند لا يمكن حذفها (معتمدة نهائياً أو خارج الصلاحية). هل تود المتابعة وحذف السندات المتاحة (${deletable.length})؟`;
    }

    confirmAction({
      title: `تأكيد الحذف الجماعي (${deletable.length} سند)`,
      message: confirmMsg,
      details: `إجمالي المبلغ المراد حذفه: ${deletableTotal.toLocaleString()} ${settings.currencySymbol} • أرقام السندات: ${deletable.map(e => e.id).slice(0, 8).join(', ')}${deletable.length > 8 ? '...' : ''}`,
      confirmText: 'نعم، حذف السندات المحددة',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: async () => {
        const count = await bulkDeleteExpenses(deletable.map(e => e.id));
        addNotification(
          'تم الحذف الجماعي بنجاح',
          `تم حذف (${count}) سندات مصروفات بنجاح.`,
          'info'
        );
        setSelectedIds(prev => prev.filter(id => !deletable.some(d => d.id === id)));
      }
    });
  };

  const handleExportSelectedCSV = () => {
    if (selectedExpenses.length === 0) return;
    const headers = ['رقم السند', 'المشروع', 'البند والتصنيف', 'المشرف', 'المبلغ', 'الضريبة', 'رقم الفاتورة', 'التاريخ', 'الحالة', 'البيان'];
    const rows = selectedExpenses.map(e => [
      e.id,
      `"${(e.projectName || '').replace(/"/g, '""')}"`,
      `"${(e.category || '').replace(/"/g, '""')}"`,
      `"${(e.supervisorName || '').replace(/"/g, '""')}"`,
      e.amount,
      e.taxAmount || 0,
      `"${(e.invoiceNumber || '').replace(/"/g, '""')}"`,
      e.date,
      `"${(e.status || '').replace(/"/g, '""')}"`,
      `"${(e.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `سندات_محددة_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintSelectedExpenses = () => {
    if (selectedExpenses.length === 0) return;
    const totalAmount = selectedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalTax = selectedExpenses.reduce((sum, e) => sum + (e.taxAmount || 0), 0);
    setPrintData({
      type: 'expense_list',
      data: {
        title: `كشف السندات المحددة (${selectedExpenses.length} سند)`,
        subtitle: `كشف مالي بالسندات المختارة`,
        expenses: selectedExpenses,
        totalAmount,
        totalTax,
        visibleColumns: expenseColumns.visibleColumns,
      }
    });
    setIsPrintModalOpen(true);
  };

  const handlePrintFilteredExpenses = () => {
    if (filteredExpenses.length === 0) return;
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalTax = filteredExpenses.reduce((sum, e) => sum + (e.taxAmount || 0), 0);
    setPrintData({
      type: 'expense_list',
      data: {
        title: `كشف سندات المصروفات المعروضة (${filteredExpenses.length} سند)`,
        subtitle: `كشف تفصيلي بمطابقة فلاتر البحث الحالية`,
        expenses: filteredExpenses,
        totalAmount,
        totalTax,
        visibleColumns: expenseColumns.visibleColumns,
      }
    });
    setIsPrintModalOpen(true);
  };

  // Remaining edit & delete status badge calculation
  const renderEditBadge = (exp: Expense) => {
    if (exp.status === 'معتمد') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg font-bold border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          معتمد نهائياً (مقفل)
        </span>
      );
    }

    // Check Stage 1 approval (strictly excludes initial supervisor submission)
    const isApprovedStage1 = isExpenseApprovedStage1OrMore(exp);

    if (isApprovedStage1) {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-lg font-bold border border-purple-200 dark:border-purple-800"
          title="معتمد كمرحلة أولى - مقفل رقابياً لمنع التلاعب في المدخلات"
        >
          <Lock className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          معتمد مرحلياً (مقفل)
        </span>
      );
    }

    // Dynamic check on grace period based on active role permissions
    const graceMinutes = currentUserRole?.permissions.expenseEditGraceMinutes ?? (isSupervisor ? 30 : 9999);
    if (graceMinutes >= 9000) {
      return null;
    }

    // Calculate elapsed time from registration
    const { elapsedMinutes } = getExpenseElapsedMinutes(exp);
    const effectiveRemaining = Math.max(0, graceMinutes - elapsedMinutes);

    if (graceMinutes === 0) {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg font-bold border border-rose-200 dark:border-rose-800"
          title="مقفل فور الحفظ حسب إعدادات الصلاحيات"
        >
          <Lock className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          مقفل فور الحفظ
        </span>
      );
    }

    if (effectiveRemaining > 0 && elapsedMinutes <= graceMinutes) {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg font-bold border border-blue-200 dark:border-blue-800 animate-pulse font-mono"
          title={`مهلة التعديل أو الحذف المتاحة (${graceMinutes} دقيقة من وقت التسجيل)`}
        >
          <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          متبقي: {effectiveRemaining} دقيقة
        </span>
      );
    } else {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg font-bold border border-rose-200 dark:border-rose-800"
          title={`انتهت مهلة الـ ${graceMinutes} دقيقة - الفاتورة مقفلة رقابياً عن التعديل والحذف لمنع التلاعب`}
        >
          <Lock className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          مقفل (مضت {graceMinutes} دقيقة)
        </span>
      );
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Dedicated Operational Banner for Site Supervisor */}
      {isSupervisor && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/30 dark:border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
              👷
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                  شاشة المشرف الميداني
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {currentUser.name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                المشاريع المسندة:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {accessibleProjects.length > 0 ? accessibleProjects.map(p => p.name).join('، ') : 'كافة المشاريع'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-right">
              <span className="text-[10px] text-slate-400 block font-medium">رصيد العهدة المتاح</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {(currentSupervisorSummary?.actualRemainingBalance ?? 0).toLocaleString()} {settings.currencySymbol}
              </span>
            </div>
            <div className="bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-right">
              <span className="text-[10px] text-slate-400 block font-medium">مصروفاتي الميدانية</span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {filteredExpenses.length} سند
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter By Supervisor Indicator */}
      {selectedSupervisor !== 'all' && (
        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-900 dark:text-blue-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-xs font-bold">
                عرض شاشة وعمليات المشرف:{' '}
                <span className="text-blue-700 dark:text-blue-300 underline font-extrabold">
                  {supervisorUsers.find(s => s.email.toLowerCase() === selectedSupervisor.toLowerCase())?.name || selectedSupervisor}
                </span>
              </p>
              <p className="text-[11px] text-blue-600 dark:text-blue-300">
                يتم الآن حصر المصروفات والسجلات المعروضة في شاشة هذا المشرف فقط.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedSupervisor('all')}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء التصفية
            </button>
          </div>
        </div>
      )}

      {/* Zero Custody Balance Warning Banner for Supervisor */}
      {isSupervisor && currentSupervisorSummary && currentSupervisorSummary.actualRemainingBalance <= 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 dark:text-rose-100 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold">
                تنبيه: رصيد عهدتك المالية مستنفذ بالكامل ({currentSupervisorSummary.actualRemainingBalance.toLocaleString()} {settings.currencySymbol})
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                لا يمكنك تسجيل مصروفات جديدة حتى يتم صرف دفعة عهدة جديدة لك من الإدارة المالية تجنباً لحدوث عجز مالي.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-200 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100">
              تسجيل المصروفات مقفل
            </span>
          </div>
        </div>
      )}

      {/* Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              سجل المصروفات والفواتير
            </h2>
            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
              {filteredExpenses.length} سندات
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            إجمالي قيمة المصروفات المعروضة:{' '}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {totalFilteredAmount.toLocaleString()} {settings.currencySymbol}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ColumnVisibilityDropdown
            columns={EXPENSE_TABLE_COLUMNS}
            visibleColumns={expenseColumns.visibleColumns}
            onToggleColumn={expenseColumns.toggleColumn}
            onShowAll={expenseColumns.showAll}
            onResetToDefault={expenseColumns.resetToDefault}
            onHideOptional={expenseColumns.hideOptional}
          />

          <button
            type="button"
            onClick={handlePrintFilteredExpenses}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="طباعة كشف المصروفات المعروضة وفقاً للفلاتر الحالية"
          >
            <Printer className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>طباعة الكشف</span>
          </button>

          {isExecutiveOrManager && (
            <>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="استيراد مصروفات سابقة من ملف إكسيل أو CSV وتنزيل نموذج إكسيل جاهز"
              >
                <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>استيراد إكسيل</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBulkAttachModalOpen(true)}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="ربط صور ومستندات الفواتير تلقائياً عبر مطابقة كود السند (ID) في بداية اسم الملف"
              >
                <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>ربط صور الفواتير (بالـ ID)</span>
              </button>
            </>
          )}

          {!hasPermission('canCreateExpense') ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200/90 dark:border-blue-800/80 text-blue-800 dark:text-blue-300 text-xs font-bold shadow-2xs">
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>شاشة للاطلاع والتدقيق فقط ({currentUserRole?.name || 'مخصص'})</span>
            </div>
          ) : (
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مصروف</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic View-Only Notice Banner for Roles without canCreateExpense and canEditExpense */}
      {!hasPermission('canCreateExpense') && !hasPermission('canEditExpense') && (
        <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            <span className="font-bold block text-[13px] mb-0.5">وضع الاطلاع والتدقيق الرقابي ({currentUserRole?.name || currentUser.role} - شاشة للعرض فقط):</span>
            شاشة المصروفات مخصصة لدورك للاطلاع والتدقيق المالي والطباعة والتصدير فقط وفقاً لمصفوفة الصلاحيات (RBAC). تم تعطيل إضافة أو تعديل أو حذف أي مصروف في هذا الدور.
          </div>
        </div>
      )}

      {/* Dynamic Workflow Engine Notice for Financial Accountant */}
      {isAccountant && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950 dark:text-emerald-100 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-200/70 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs leading-relaxed">
              <span className="font-bold block text-[13px] mb-0.5">محرك دورة الاعتماد والمطابقة (المحاسب المالي):</span>
              تخضع السندات المعروضة هنا لقواعد الترتيب التسلسلي للدورة؛ لا تظهر المصروفات المسجلة حديثاً من المشرفين إلا بعد اعتمادها من المرحلة السابقة (اعتماد المشرف الميداني) لتكون جاهزة للمراجعة المحاسبية والترحيل.
            </div>
          </div>
          <span className="shrink-0 self-start sm:self-auto px-2.5 py-1 rounded-xl bg-emerald-200/80 dark:bg-emerald-900/90 text-emerald-900 dark:text-emerald-200 text-[11px] font-bold">
            مطابقة متسلسلة نشطة
          </span>
        </div>
      )}

      {/* Tabs & Search & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Quick Scope Quick-Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs border-b border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-1">النطاق السريع:</span>
          <button
            type="button"
            onClick={() => {
              setDateFilterType('last_30_days');
              setCustomStartDate('');
              setCustomEndDate('');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              dateFilterType === 'last_30_days'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>آخر 30 يوماً (الافتراضي السريع)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFilterType('month');
              setCustomStartDate(monthRange.start);
              setCustomEndDate(monthRange.end);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              dateFilterType === 'month'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>هذا الشهر</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFilterType('week');
              setCustomStartDate(weekRange.start);
              setCustomEndDate(weekRange.end);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              dateFilterType === 'week'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>هذا الأسبوع</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFilterType('today');
              setCustomStartDate(todayStr);
              setCustomEndDate(todayStr);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              dateFilterType === 'today'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span>اليوم</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFilterType('all');
              setCustomStartDate('');
              setCustomEndDate('');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              dateFilterType === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
            title="عرض كافة المصروفات بدون أي تحديد زمني"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>كافة المصروفات (الكل)</span>
          </button>
        </div>

        {/* Status & Date Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0">
                <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>حالة السند:</span>
              </span>

              <div className="relative min-w-[190px]">
                <select
                  value={selectedStatusTab}
                  onChange={e => setSelectedStatusTab(e.target.value as any)}
                  className="w-full pl-7 pr-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs appearance-none cursor-pointer"
                >
                  <option value="all">كافة الحالات ({baseVisibleExpenses.length})</option>
                  <option value="pending">⏳ بانتظار الاعتماد ({baseVisibleExpenses.filter(e => e.status !== 'معتمد' && e.status !== 'مرفوض').length})</option>
                  <option value="approved">✅ معتمدة نهائياً ({baseVisibleExpenses.filter(e => e.status === 'معتمد').length})</option>
                  <option value="rejected">❌ مرفوضة ({baseVisibleExpenses.filter(e => e.status === 'مرفوض').length})</option>
                  <option value="offline">📡 سجلات معلقة أوفلاين ({baseVisibleExpenses.filter(e => !e.synced).length})</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Separator */}
            <div className="hidden md:block h-5 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Date Filter (Placed directly next to Status Filter) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>فلتر التاريخ:</span>
              </span>

              <div className="relative min-w-[190px]">
                <select
                  value={dateFilterType}
                  onChange={e => {
                    const val = e.target.value as any;
                    setDateFilterType(val);
                    if (val === 'last_30_days') {
                      setCustomStartDate(last30DaysRange.start);
                      setCustomEndDate(last30DaysRange.end);
                    } else if (val === 'today') {
                      setCustomStartDate(todayStr);
                      setCustomEndDate(todayStr);
                    } else if (val === 'week') {
                      setCustomStartDate(weekRange.start);
                      setCustomEndDate(weekRange.end);
                    } else if (val === 'month') {
                      setCustomStartDate(monthRange.start);
                      setCustomEndDate(monthRange.end);
                    } else if (val === 'all') {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }
                  }}
                  className="w-full pl-7 pr-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs appearance-none cursor-pointer"
                >
                  <option value="last_30_days">⚡ آخر 30 يوماً (الافتراضي فائق السرعة)</option>
                  <option value="month">📅 هذا الشهر ({monthRange.monthName})</option>
                  <option value="week">📅 هذا الأسبوع</option>
                  <option value="today">📅 اليوم ({todayStr})</option>
                  <option value="all">🌐 كافة المصروفات (بدون حد زمني)</option>
                  <option value="custom">⚙️ فترة زمنية محددة...</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Custom Date Inputs (Appears inline when custom period is selected) */}
              {dateFilterType === 'custom' && (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-200 flex-wrap">
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold shrink-0">من:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                      title="تاريخ البداية (من)"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold shrink-0">إلى:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                      title="تاريخ النهاية (إلى)"
                    />
                  </div>
                </div>
              )}

              {(dateFilterType !== 'last_30_days' || customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilterType('last_30_days');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  title="إعادة تعيين إلى آخر 30 يوماً الافتراضي"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة للافتراضي</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              المعروض: <span className="font-bold text-slate-900 dark:text-white">{filteredExpenses.length}</span> سند بمبلغ{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{totalFilteredAmount.toLocaleString()} {settings.currencySymbol}</span>
            </div>

            {(dateFilterType !== 'last_30_days' || selectedStatusTab !== 'all' || searchTerm || selectedProject !== 'all' || selectedCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedProject('all');
                  setSelectedCategory('all');
                  setSelectedStatusTab('all');
                  setDateFilterType('last_30_days');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                title="إعادة ضبط كافة الفلاتر والبحث"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة ضبط الفلاتر</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${(!isAccountant && currentUserPermissions.canViewAllExpenses) ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
          
          {/* Search Input (Supports Details, ID, Supervisor, Project, Invoice, and AMOUNT) */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالسند، البيان، المشرف، أو المبلغ (مثال: 500 أو >1000)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition-all"
              title="يمكنك البحث برقم السند، البيان، اسم المشرف، اسم المشروع، أو المبلغ بدقة أو بنطاق (مثال: 500 أو >1000 أو 100-500)"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Supervisor Filter (Available for Managers to inspect supervisor screens, disabled for accountants) */}
          {!isAccountant && currentUserPermissions.canViewAllExpenses && (
            <div className="relative">
              <select
                value={selectedSupervisor}
                onChange={e => setSelectedSupervisor(e.target.value)}
                className={`w-full pr-8 pl-3 py-2 rounded-xl bg-white dark:bg-slate-800 border text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                  selectedSupervisor !== 'all'
                    ? 'border-blue-500 ring-2 ring-blue-500/20 font-bold text-blue-700 dark:text-blue-300'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
                title="تصفية وعرض شاشة مصروفات مشرف محدد"
              >
                <option value="all">👷 كافة المشرفين الميدانيين</option>
                {supervisorUsers.map(s => {
                  const sum = supervisorsSummary.find(sm => sm.email.toLowerCase() === s.email.toLowerCase() || sm.id === s.id);
                  return (
                    <option key={s.id} value={s.email}>
                      {s.name} {sum ? `(${sum.actualRemainingBalance.toLocaleString()} ${settings.currencySymbol})` : ''}
                    </option>
                  );
                })}
              </select>
              <UserCheck className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Project Filter */}
          <div>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition-all"
            >
              <option value="all">
                {isSupervisor || isAccountant || !currentUserPermissions.canViewAllProjects ? 'كافة مشاريعي المسندة' : 'كافة المشاريع'}
              </option>
              {accessibleProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition-all"
            >
              <option value="all">كافة البنود والتصنيفات</option>
              {(settings.customCategories || []).map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle (Table / Grid) */}
          <div className="flex items-center justify-end gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700">
            <button
              onClick={() => setViewMode('table')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              عرض جدول
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              عرض بطاقات
            </button>
          </div>

        </div>

        {/* Active Filter Summary Bar */}
        {(dateFilterType !== 'all' || selectedStatusTab !== 'all' || searchTerm || selectedProject !== 'all' || selectedCategory !== 'all') && (
          <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-300">الفلاتر المطبقة:</span>
            
            {selectedStatusTab !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 font-bold">
                <span>
                  الحالة:{' '}
                  {selectedStatusTab === 'pending'
                    ? 'بانتظار الاعتماد'
                    : selectedStatusTab === 'approved'
                    ? 'معتمدة نهائياً'
                    : selectedStatusTab === 'rejected'
                    ? 'مرفوضة'
                    : 'أوفلاين'}
                </span>
              </span>
            )}

            {dateFilterType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 font-bold">
                <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {dateFilterType === 'today' && `اليوم (${todayStr})`}
                  {dateFilterType === 'week' && `هذا الأسبوع (${weekRange.start} إلى ${weekRange.end})`}
                  {dateFilterType === 'month' && `هذا الشهر (${monthRange.monthName})`}
                  {dateFilterType === 'custom' && `فترة محددة (${customStartDate || 'البداية'} إلى ${customEndDate || 'الآن'})`}
                </span>
              </span>
            )}

            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 font-bold">
                <Search className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>بحث: "{searchTerm}"</span>
              </span>
            )}

            {selectedProject !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800 font-bold">
                <span>مشروع: {projects.find(p => p.id === selectedProject)?.name}</span>
              </span>
            )}

            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 font-bold">
                <span>بند: {selectedCategory}</span>
              </span>
            )}

            <span className="text-slate-400 dark:text-slate-500 font-medium">
              ({filteredExpenses.length} سندات تطابق الفلترة بمبلغ {totalFilteredAmount.toLocaleString()} {settings.currencySymbol})
            </span>
          </div>
        )}

      </div>

      {/* Smart Performance Banner for Default 30 Days view */}
      {dateFilterType === 'last_30_days' && baseVisibleExpenses.length > filteredExpenses.length && (
        <div className="p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-amber-200/80 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0 font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span>
                يتم حالياً عرض مصروفات <strong>آخر 30 يوماً فقط</strong> لتسريع فتح الشاشة واستجابتها الفورية ({filteredExpenses.length} سند).
              </span>
              <span className="block text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                يوجد {baseVisibleExpenses.length - filteredExpenses.length} سند إضافي مسجل في فترات سابقة.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDateFilterType('all');
              setCustomStartDate('');
              setCustomEndDate('');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
            title="عرض كافة المصروفات المسجلة بدون تقييد زمني"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>عرض كافة المصروفات السابقة ({baseVisibleExpenses.length})</span>
          </button>
        </div>
      )}

      {/* Notice when viewing all expenses */}
      {dateFilterType === 'all' && baseVisibleExpenses.length > 50 && (
        <div className="p-3 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950 dark:text-indigo-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-indigo-200/80 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200 flex items-center justify-center shrink-0 font-bold">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span>
                يتم حالياً عرض <strong>كافة المصروفات المسجلة</strong> ({filteredExpenses.length} سند).
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDateFilterType('last_30_days');
              setCustomStartDate('');
              setCustomEndDate('');
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
            title="الرجوع إلى وضع السرعة (آخر 30 يوماً)"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>تفعيل العرض السريع (آخر 30 يوماً)</span>
          </button>
        </div>
      )}

      {/* Expenses Table or Cards */}
      {filteredExpenses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد مصروفات تطابق خيارات البحث</h3>
          <p className="text-xs text-slate-400 mt-1">جرّب تغيير كلمات البحث أو إعادة ضبط الفلاتر.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors inline-flex items-center justify-center cursor-pointer"
                      title={isAllFilteredSelected ? 'إلغاء تحديد الكل' : 'تحديد كل السندات المعروضة'}
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : isSomeFilteredSelected ? (
                        <MinusSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  {expenseColumns.isVisible('id') && <th className="py-3 px-3.5 font-semibold">رقم السند</th>}
                  {expenseColumns.isVisible('dateAndProject') && <th className="py-3 px-3.5 font-semibold">التاريخ والمشروع</th>}
                  {expenseColumns.isVisible('categoryAndDesc') && <th className="py-3 px-3.5 font-semibold">البند والبيان</th>}
                  {expenseColumns.isVisible('supervisor') && <th className="py-3 px-3.5 font-semibold">المشرف</th>}
                  {expenseColumns.isVisible('amount') && <th className="py-3 px-3.5 font-semibold">المبلغ</th>}
                  {expenseColumns.isVisible('locationAndReceipt') && <th className="py-3 px-3.5 font-semibold">الموقع والمرفق</th>}
                  {expenseColumns.isVisible('status') && <th className="py-3 px-3.5 font-semibold">حالة الاعتماد</th>}
                  {expenseColumns.isVisible('lockTimer') && <th className="py-3 px-3.5 font-semibold">مهلة التعديل</th>}
                  {expenseColumns.isVisible('actions') && <th className="py-3 px-3.5 font-semibold text-center">الإجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedExpenses.map(exp => {
                  const isSelected = selectedIds.includes(exp.id);
                  const editCheck = canEditExpense(exp);
                  const deleteCheck = canDeleteExpenseCheck(exp);
                  return (
                    <tr
                      key={exp.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="py-3 px-3 w-10 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSelectExpense(exp.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors inline-flex items-center justify-center cursor-pointer"
                          title={isSelected ? 'إلغاء التحديد' : 'تحديد هذا السند'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                      </td>

                      {/* ID */}
                      {expenseColumns.isVisible('id') && (
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span>{exp.id}</span>
                            <SaveSyncBadge
                              savedLocally={exp.savedLocally ?? true}
                              synced={exp.synced}
                              size="sm"
                              showLabel={false}
                            />
                          </div>
                        </td>
                      )}

                      {/* Date & Project */}
                      {expenseColumns.isVisible('dateAndProject') && (
                        <td className="py-3 px-3.5">
                          <p className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                            {exp.projectName}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{exp.date}</p>
                        </td>
                      )}

                      {/* Category & Details */}
                      {expenseColumns.isVisible('categoryAndDesc') && (
                        <td className="py-3 px-3.5">
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium text-[10px] mb-1">
                            {exp.category}
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px]" title={exp.details}>
                            {exp.details}
                          </p>
                        </td>
                      )}

                      {/* Supervisor */}
                      {expenseColumns.isVisible('supervisor') && (
                        <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          {exp.supervisorName.split(' ')[0]} {exp.supervisorName.split(' ')[1] || ''}
                        </td>
                      )}

                      {/* Amount */}
                      {expenseColumns.isVisible('amount') && (
                        <td className="py-3 px-3.5 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                          {exp.amount.toLocaleString()} {settings.currencySymbol}
                        </td>
                      )}

                      {/* Location & Invoice */}
                      {expenseColumns.isVisible('locationAndReceipt') && (
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {exp.gpsLocation && (
                              <span
                                title={exp.gpsLocation.address || `GPS: ${exp.gpsLocation.lat.toFixed(3)}, ${exp.gpsLocation.lng.toFixed(3)}`}
                                className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 inline-flex items-center shadow-2xs border border-blue-200/60 dark:border-blue-900/60"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {(() => {
                              const attCount = exp.attachments?.length || (exp.invoicePhoto ? 1 : 0);
                              if (attCount === 0) {
                                return (
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                    <span>بدون مستند</span>
                                  </span>
                                );
                              }
                              const firstAtt = exp.attachments?.[0];
                              const url = firstAtt?.url || exp.invoicePhoto!;
                              const isPdf = firstAtt
                                ? (firstAtt.fileType === 'pdf' || (firstAtt.url && firstAtt.url.startsWith('data:application/pdf')) || (firstAtt.fileName && firstAtt.fileName.toLowerCase().endsWith('.pdf')))
                                : (exp.invoicePhoto?.startsWith('data:application/pdf') || exp.invoicePhoto?.toLowerCase().includes('.pdf'));
                              const isFromPCloud = firstAtt?.source === 'pcloud' || Boolean(firstAtt?.pcloudFileId) || (url && url.includes('/api/pcloud/'));
                              const fileName = firstAtt?.fileName || (isPdf ? 'مستند_الفاتورة.pdf' : 'صورة_الفاتورة.jpg');

                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAttachmentPreview({
                                      url,
                                      title: fileName,
                                      subtitle: `${exp.projectName} • ${exp.category} • ${exp.amount.toLocaleString()} ${settings.currencySymbol}`
                                    }, exp);
                                  }}
                                  title={
                                    attCount > 1
                                      ? `يوجد ${attCount} مستندات ومرفقات - اضغط لفتح المعاينة`
                                      : (isPdf ? `مستند PDF: ${fileName} - اضغط لفتح المعاينة` : `مستند الفاتورة: ${fileName} - اضغط لفتح المعاينة`)
                                  }
                                  className={`group relative inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border font-bold text-xs transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer ${
                                    isPdf
                                      ? 'bg-rose-50/90 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 hover:border-rose-400'
                                      : isFromPCloud
                                      ? 'bg-sky-50/90 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 border-sky-200 dark:border-sky-800/80 text-sky-700 dark:text-sky-300 hover:border-sky-400'
                                      : 'bg-emerald-50/90 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 hover:border-emerald-400'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                                    isPdf
                                      ? 'bg-rose-200/80 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300'
                                      : isFromPCloud
                                      ? 'bg-sky-200/80 dark:bg-sky-900/80 text-sky-700 dark:text-sky-300'
                                      : 'bg-emerald-200/80 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300'
                                  }`}>
                                    {isPdf ? (
                                      <FileText className="w-3.5 h-3.5" />
                                    ) : isFromPCloud ? (
                                      <Cloud className="w-3.5 h-3.5" />
                                    ) : (
                                      <Receipt className="w-3.5 h-3.5" />
                                    )}
                                  </div>

                                  <span className="truncate max-w-[100px] text-[11px]">
                                    {attCount > 1
                                      ? `${attCount} مستندات`
                                      : (isPdf ? 'مستند PDF' : isFromPCloud ? 'مستند pCloud' : 'مستند الفاتورة')}
                                  </span>

                                  {attCount > 1 ? (
                                    <span className="w-4 h-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-extrabold flex items-center justify-center shrink-0">
                                      {attCount}
                                    </span>
                                  ) : (
                                    <Eye className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all shrink-0" />
                                  )}
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                      )}

                      {/* Status Badge */}
                      {expenseColumns.isVisible('status') && (
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              exp.status === 'معتمد'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                : exp.status === 'مرفوض'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                                : (exp.status as string) === 'بانتظار اعتماد الادارة' || exp.status === 'بانتظار اعتماد الإدارة العليا'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                            }`}
                          >
                            {exp.status}
                          </span>
                        </td>
                      )}

                      {/* 30-min Edit Window Badge */}
                      {expenseColumns.isVisible('lockTimer') && (
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {renderEditBadge(exp)}
                        </td>
                      )}

                      {/* Actions */}
                      {expenseColumns.isVisible('actions') && (
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedExpenseForDetail(exp)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="عرض السند بالتفصيل"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handlePrintVoucher(exp)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              title="طباعة سند صرف رسمي"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {!isAccountant && (
                              <>
                                <button
                                  onClick={() => handleEdit(exp)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    !editCheck.canEdit
                                      ? 'text-slate-300 dark:text-slate-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer'
                                      : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950'
                                  }`}
                                  title={!editCheck.canEdit ? (editCheck.reason || 'التعديل مقفل رقابياً') : 'تعديل السند'}
                                >
                                  {!editCheck.canEdit ? <Lock className="w-4 h-4 text-amber-500/80" /> : <Edit2 className="w-4 h-4" />}
                                </button>

                                <button
                                  onClick={() => handleDelete(exp)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    !deleteCheck.canDelete
                                      ? 'text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer'
                                      : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950'
                                  }`}
                                  title={!deleteCheck.canDelete ? (deleteCheck.reason || 'الحذف مقفل رقابياً') : 'حذف السند'}
                                >
                                  {!deleteCheck.canDelete ? <Lock className="w-4 h-4 text-rose-400/80" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedExpenses.map(exp => {
            const isSelected = selectedIds.includes(exp.id);
            const editCheck = canEditExpense(exp);
            const deleteCheck = canDeleteExpenseCheck(exp);
            return (
              <div
                key={exp.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelectExpense(exp.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors inline-flex items-center justify-center cursor-pointer"
                        title={isSelected ? 'إلغاء التحديد' : 'تحديد هذا السند'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                        {exp.id}
                      </span>
                      <SaveSyncBadge
                        savedLocally={exp.savedLocally ?? true}
                        synced={exp.synced}
                        size="sm"
                        showLabel={false}
                      />
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        exp.status === 'معتمد'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : exp.status === 'مرفوض'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {exp.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {exp.details}
                  </h4>

                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                    {exp.projectName}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">المبلغ:</span>
                      <span className="font-extrabold text-base text-slate-900 dark:text-white">
                        {exp.amount.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="text-slate-400 block text-[10px]">البند:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {exp.category}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>المشرف: {exp.supervisorName.split(' ')[0]}</span>
                    <span>{exp.date}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>{renderEditBadge(exp)}</div>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const attCount = exp.attachments?.length || (exp.invoicePhoto ? 1 : 0);
                      if (attCount === 0) return null;
                      const firstAtt = exp.attachments?.[0];
                      const firstUrl = firstAtt?.url || exp.invoicePhoto!;
                      const isPdf = firstAtt
                        ? (firstAtt.fileType === 'pdf' || (firstAtt.url && firstAtt.url.startsWith('data:application/pdf')) || (firstAtt.fileName && firstAtt.fileName.toLowerCase().endsWith('.pdf')))
                        : (exp.invoicePhoto?.startsWith('data:application/pdf') || exp.invoicePhoto?.toLowerCase().includes('.pdf'));
                      const fileName = firstAtt?.fileName || (isPdf ? 'مستند_الفاتورة.pdf' : 'صورة_الفاتورة.jpg');

                      return (
                        <button
                          onClick={() => openAttachmentPreview({
                            url: firstUrl,
                            title: fileName,
                            subtitle: `${exp.projectName} • ${exp.category} • ${exp.amount.toLocaleString()} ${settings.currencySymbol}`
                          }, exp)}
                          className="relative p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                          title={`معاينة المرفقات (${attCount} مرفق)`}
                        >
                          <Paperclip className="w-4 h-4" />
                          {attCount > 1 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[8px] font-bold flex items-center justify-center">
                              {attCount}
                            </span>
                          )}
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => setSelectedExpenseForDetail(exp)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="معاينة تفاصيل السند"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePrintVoucher(exp)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600"
                      title="طباعة"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {!isAccountant && (
                      <>
                        <button
                          onClick={() => handleEdit(exp)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            !editCheck.canEdit
                              ? 'text-slate-300 dark:text-slate-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer'
                              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600'
                          }`}
                          title={!editCheck.canEdit ? (editCheck.reason || 'التعديل مقفل رقابياً') : 'تعديل'}
                        >
                          {!editCheck.canEdit ? <Lock className="w-4 h-4 text-amber-500/80" /> : <Edit2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(exp)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            !deleteCheck.canDelete
                              ? 'text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer'
                              : 'text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600'
                          }`}
                          title={!deleteCheck.canDelete ? (deleteCheck.reason || 'الحذف مقفل رقابياً') : 'حذف'}
                        >
                          {!deleteCheck.canDelete ? <Lock className="w-4 h-4 text-rose-400/80" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar (Ensures smooth, instantaneous responsiveness even on thousands of records) */}
      {filteredExpenses.length > 0 && (
        <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
            <span>
              عرض <strong className="text-slate-900 dark:text-white font-mono">{pageSize === 'all' ? 1 : ((currentPage - 1) * pageSize) + 1}</strong> - <strong className="text-slate-900 dark:text-white font-mono">{pageSize === 'all' ? filteredExpenses.length : Math.min(currentPage * pageSize, filteredExpenses.length)}</strong> من إجمالي <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{filteredExpenses.length}</strong> سند
            </span>

            <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700 pr-3">
              <span className="text-[11px]">عدد السجلات بالصفحة:</span>
              <select
                value={pageSize}
                onChange={e => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(val as any);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value="all">عرض الكل ({filteredExpenses.length})</option>
              </select>
            </div>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-1 cursor-pointer"
                title="الصفحة السابقة"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5) {
                    if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-1 cursor-pointer"
                title="الصفحة التالية"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-5 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border border-slate-750 flex flex-wrap items-center justify-between gap-3 max-w-2xl w-full animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              {selectedIds.length}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white">
                  تم تحديد {selectedIds.length} سند
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold hidden sm:inline">
                  ({selectedTotalAmount.toLocaleString()} {settings.currencySymbol})
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="hover:text-white underline transition-colors cursor-pointer"
                >
                  {isAllFilteredSelected ? 'إلغاء التحديد' : `تحديد الكل (${filteredExpenses.length})`}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isAccountant && (
              <>
                {/* Bulk Edit Button */}
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="تعديل جماعي لكافة السندات المحددة"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل جماعي</span>
                </button>

                {/* Bulk Delete Button */}
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="حذف جماعي للسندات المحددة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف جماعي</span>
                </button>
              </>
            )}

            {/* Print Selected Button */}
            <button
              type="button"
              onClick={handlePrintSelectedExpenses}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
              title="طباعة السندات المحددة"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">طباعة ({selectedExpenses.length})</span>
              <span className="sm:hidden">طباعة</span>
            </button>

            {/* Export Selected Button */}
            <button
              type="button"
              onClick={handleExportSelectedCSV}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1 transition-all cursor-pointer"
              title="تصدير السندات المحددة إلى ملف CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تصدير</span>
            </button>

            {/* Clear Selection Button */}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="إلغاء التحديد"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedExpenses={selectedExpenses}
        onSuccess={() => setSelectedIds([])}
      />

      {/* Import Historical Expenses Modal */}
      {isImportModalOpen && (
        <ImportExpensesModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onOpenBulkAttach={() => {
            setIsImportModalOpen(false);
            setIsBulkAttachModalOpen(true);
          }}
        />
      )}

      {/* Bulk Attach Photos / Documents Modal */}
      {isBulkAttachModalOpen && (
        <BulkAttachModal
          isOpen={isBulkAttachModalOpen}
          onClose={() => setIsBulkAttachModalOpen(false)}
        />
      )}

    </div>
  );
};

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Expense, WorkflowStage } from '../../types';
import {
  ColumnVisibilityDropdown,
  useColumnVisibility,
  ColumnDefinition
} from '../common/ColumnVisibilityDropdown';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  CheckCheck,
  XCircle,
  Eye,
  AlertTriangle,
  UserCheck,
  Filter,
  Layers,
  MapPin,
  Building2,
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
  FileCheck2,
  Send,
  Database,
  Briefcase,
  FileText,
  LayoutGrid,
  Table,
  CheckSquare,
  Square,
  Tag,
  Calendar,
  Search,
  Zap,
  Globe,
  X,
  RotateCcw,
  ChevronDown
} from 'lucide-react';

const APPROVAL_TABLE_COLUMNS: ColumnDefinition[] = [
  { id: 'idAndDate', label: 'رقم السند والتاريخ', defaultVisible: true, alwaysVisible: true, description: 'كود السند المميز وتاريخ الصرف' },
  { id: 'projectAndCategory', label: 'المشروع والبند', defaultVisible: true, description: 'اسم المشروع الميداني وبند المصروف' },
  { id: 'descAndSupervisor', label: 'البيان والمشرف', defaultVisible: true, description: 'شرح المصروف واسم المشرف المسجل' },
  { id: 'amount', label: 'المبلغ المطلوب', defaultVisible: true, alwaysVisible: true, description: 'قيمة المصروف والعملة' },
  { id: 'currentStage', label: 'المرحلة الحالية / الحالة', defaultVisible: true, description: 'المرحلة الحالية في مسار الاعتماد' },
  { id: 'erpStatus', label: 'حالة ترحيل ERP', defaultVisible: true, description: 'حالة الترحيل إلى النظام المحاسبي' },
  { id: 'actions', label: 'إجراء الاعتماد والخيارات', defaultVisible: true, alwaysVisible: true, description: 'أزرار الاعتماد والرفض ومعاينة المرفق' }
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

export const ApprovalWorkflow: React.FC = () => {
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
    roles,
    workflowStages,
    settings,
    approveWorkflowStage,
    postToExternalERP,
    rejectExpense,
    batchApprove,
    setSelectedExpenseForDetail,
    openAttachmentPreview,
    confirmAction,
    showAlert
  } = useApp();

  const approvalColumns = useColumnVisibility(
    'approval_table_columns_visibility',
    APPROVAL_TABLE_COLUMNS
  );

  const activeWorkflowStages = useMemo(() => {
    return [...workflowStages].filter(s => s.isActive).sort((a, b) => a.order - b.order);
  }, [workflowStages]);

  const isAccountant = useMemo(() => {
    return (
      currentUser.role === 'محاسب' ||
      currentUser.role === 'محاسب مالي' ||
      currentUser.roleId === 'role_accountant' ||
      currentUser.role.includes('محاسب')
    );
  }, [currentUser]);

  const isSupervisor = useMemo(() => {
    return (
      currentUser.role === 'مشرف' ||
      currentUser.role === 'مشرف موقع' ||
      currentUser.roleId === 'role_supervisor' ||
      currentUser.role.includes('مشرف')
    );
  }, [currentUser]);

  const accountantStageObj = useMemo(() => {
    return (
      activeWorkflowStages.find(
        s =>
          s.requiredRoleId === 'role_accountant' ||
          s.roleId === 'role_accountant' ||
          s.id === 'stage_accountant' ||
          s.title?.includes('محاسب') ||
          s.order === 2
      ) || null
    );
  }, [activeWorkflowStages]);

  const accountantStageId = accountantStageObj?.id || 'stage_accountant';
  const accountantStageIndex = accountantStageObj ? activeWorkflowStages.indexOf(accountantStageObj) : 1;

  // Stages displayed in tabs: for accountant, hide stages preceding accountant stage (e.g. stage 1 / supervisor)
  const displayWorkflowStages = useMemo(() => {
    if (!isAccountant) return activeWorkflowStages;
    return activeWorkflowStages.filter((stage, idx) => {
      if (accountantStageIndex !== -1 && idx < accountantStageIndex) {
        return false;
      }
      return true;
    });
  }, [activeWorkflowStages, isAccountant, accountantStageIndex]);

  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const isAcc =
      currentUser.role === 'محاسب' ||
      currentUser.role === 'محاسب مالي' ||
      currentUser.roleId === 'role_accountant' ||
      currentUser.role.includes('محاسب');
    if (isAcc) {
      const accStage = activeWorkflowStages.find(
        s =>
          s.requiredRoleId === 'role_accountant' ||
          s.roleId === 'role_accountant' ||
          s.id === 'stage_accountant' ||
          s.title?.includes('محاسب')
      );
      if (accStage) return accStage.id;
      return 'stage_accountant';
    }
    if (activeWorkflowStages.length > 0) return activeWorkflowStages[0].id;
    return 'stage_supervisor';
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // View Mode: 'table' or 'cards' (optimized for mobile)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    const saved = localStorage.getItem('approval_workflow_view_mode');
    if (saved === 'table' || saved === 'cards') return saved;
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'table';
  });

  const handleSetViewMode = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    localStorage.setItem('approval_workflow_view_mode', mode);
  };

  // Filter States (matching ExpenseList.tsx)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [dateFilterType, setDateFilterType] = useState<'all' | 'last_30_days' | 'month' | 'week' | 'today' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

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
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    const startOfWeek = getLocalDateString(sunday);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const endOfWeek = getLocalDateString(saturday);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo);

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

  const supervisorUsers = useMemo(() => {
    return (users || []).filter(u => u.role.includes('مشرف') || u.roleId === 'role_supervisor');
  }, [users]);

  const [rejectionModalExp, setRejectionModalExp] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // ERP Posting Modal State
  const [erpModalExp, setErpModalExp] = useState<Expense | null>(null);
  const [erpStageId, setErpStageId] = useState<string>('');
  const [erpSystemName, setErpSystemName] = useState(() => settings.erpSystemName || (settings.customErpSystems && settings.customErpSystems[0]) || 'Odoo ERP');
  const [erpReferenceNumber, setErpReferenceNumber] = useState('');
  const [erpNotes, setErpNotes] = useState('');

  // Quick Approval notes modal
  const [approvalNotesModalExp, setApprovalNotesModalExp] = useState<{ exp: Expense; stage: WorkflowStage } | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  // Current stage object
  const currentStageObj = useMemo(() => {
    return activeWorkflowStages.find(s => s.id === selectedTab) || null;
  }, [activeWorkflowStages, selectedTab]);

  // Sync selectedTab if activeWorkflowStages changes or if accountant is on a preceding stage
  useEffect(() => {
    if (isAccountant) {
      const isCurrentTabPreceding = activeWorkflowStages.some(
        (stg, idx) => stg.id === selectedTab && idx < accountantStageIndex
      );
      if (isCurrentTabPreceding) {
        setSelectedTab(accountantStageId);
        return;
      }
    }

    if (
      selectedTab !== 'erp_queue' &&
      selectedTab !== 'history' &&
      activeWorkflowStages.length > 0 &&
      !activeWorkflowStages.some(s => s.id === selectedTab)
    ) {
      setSelectedTab(isAccountant ? accountantStageId : activeWorkflowStages[0].id);
    }
  }, [activeWorkflowStages, selectedTab, isAccountant, accountantStageId, accountantStageIndex]);

  // Robust stage categorization helper (1: Supervisor, 2: Accountant, 3: Management, 0: Custom)
  const getStageCategory = useCallback((stageId: string): number => {
    if (stageId === 'stage_supervisor') return 1;
    if (stageId === 'stage_accountant') return 2;
    if (stageId === 'stage_management') return 3;

    const stageIdx = activeWorkflowStages.findIndex(s => s.id === stageId);
    const stageObj = stageIdx !== -1 ? activeWorkflowStages[stageIdx] : null;

    if (
      stageObj?.order === 1 ||
      stageIdx === 0 ||
      stageObj?.id.includes('supervisor') ||
      stageObj?.roleId === 'role_supervisor' ||
      stageObj?.requiredRoleId === 'role_supervisor' ||
      stageObj?.title?.includes('مشرف') ||
      stageObj?.title?.includes('المرحلة 1')
    ) {
      return 1;
    }

    if (
      stageObj?.order === 2 ||
      stageIdx === 1 ||
      stageObj?.id.includes('accountant') ||
      stageObj?.roleId === 'role_accountant' ||
      stageObj?.requiredRoleId === 'role_accountant' ||
      stageObj?.title?.includes('محاسب') ||
      stageObj?.title?.includes('المرحلة 2')
    ) {
      return 2;
    }

    if (
      stageObj?.order === 3 ||
      stageIdx === 2 ||
      stageObj?.id.includes('management') ||
      stageObj?.roleId === 'role_admin' ||
      stageObj?.roleId === 'role_management' ||
      stageObj?.requiredRoleId === 'role_admin' ||
      stageObj?.title?.includes('إدارة') ||
      stageObj?.title?.includes('المرحلة 3')
    ) {
      return 3;
    }

    return 0; // custom stage
  }, [activeWorkflowStages]);

  // Dynamic Stage Approval helper for any stage in the active ordered workflow stages
  const isStageIndexApproved = useCallback((exp: Expense, stageIdx: number) => {
    if (exp.status === 'معتمد') return true;
    if (exp.status === 'مرفوض') return false;
    if (typeof exp.currentStageIndex === 'number' && exp.currentStageIndex > stageIdx) {
      return true;
    }
    const stage = activeWorkflowStages[stageIdx];
    if (!stage) return false;

    if (Array.isArray(exp.workflowHistory)) {
      const isApprovedInHistory = exp.workflowHistory.some(
        h => h.status === 'approved' && h.stageId === stage.id
      );
      if (isApprovedInHistory) return true;
    }

    // Legacy fallback mappings
    const category = getStageCategory(stage.id);
    if (category === 1 || stageIdx === 0) {
      if (
        exp.supervisorApproval === 'تم اعتماد المشرف' ||
        exp.projectManagerApproval === 'تم اعتماد مدير المشروع' ||
        exp.projectManagerApproval === 'تم اعتماد المشرف' ||
        (typeof exp.supervisorApproval === 'string' &&
          (exp.supervisorApproval as string) !== 'غير معتمد' &&
          (exp.supervisorApproval as string) !== 'مرفوض' &&
          ((exp.supervisorApproval as string).includes('تم اعتماد') || (exp.supervisorApproval as string).includes('تم الاعتماد')))
      ) {
        return true;
      }
    }
    if (category === 2) {
      if (
        exp.accountantApproval === 'تم الاعتماد' ||
        (typeof exp.accountantApproval === 'string' &&
          (exp.accountantApproval as string) !== 'غير معتمد' &&
          (exp.accountantApproval as string) !== 'مرفوض' &&
          ((exp.accountantApproval as string).includes('تم الاعتماد') || (exp.accountantApproval as string).includes('تم اعتماد')))
      ) {
        return true;
      }
    }
    if (category === 3) {
      if (
        exp.managementApproval === 'تم اعتماد الادارة' ||
        (typeof exp.managementApproval === 'string' &&
          (exp.managementApproval as string) !== 'غير معتمد' &&
          (exp.managementApproval as string) !== 'مرفوض' &&
          ((exp.managementApproval as string).includes('تم اعتماد') || (exp.managementApproval as string).includes('تم الاعتماد')))
      ) {
        return true;
      }
    }

    return false;
  }, [activeWorkflowStages, getStageCategory]);

  const isStage1Approved = useCallback((exp: Expense) => {
    return isStageIndexApproved(exp, 0);
  }, [isStageIndexApproved]);

  const isStage2Approved = useCallback((exp: Expense) => {
    return isStageIndexApproved(exp, 1);
  }, [isStageIndexApproved]);

  const isStage3Approved = useCallback((exp: Expense) => {
    return isStageIndexApproved(exp, 2);
  }, [isStageIndexApproved]);

  // Helper to determine if an expense belongs to a specific stage in the sequence
  const isExpenseInStage = useCallback((exp: Expense, stageId: string) => {
    if (exp.status === 'معتمد' || exp.status === 'مرفوض') return false;

    const stageIdx = activeWorkflowStages.findIndex(s => s.id === stageId);
    if (stageIdx === -1) {
      return exp.currentStageId === stageId;
    }

    // Accountant restriction check: Accountant must only see expenses for assigned projects (if project restrictions exist)
    if (isAccountant) {
      const hasSpecificProjectFilter = Array.isArray(currentUser.assignedProjects) && currentUser.assignedProjects.length > 0 && !currentUserPermissions?.canViewAllProjects;
      if (hasSpecificProjectFilter) {
        const allowedPrjIds = new Set(accessibleProjects.map(p => p.id));
        if (!allowedPrjIds.has(exp.projectId)) return false;
      }
    }

    // Supervisor restriction check: Supervisor must only see expenses for assigned projects
    if (isSupervisor) {
      const allowedPrjIds = new Set(accessibleProjects.map(p => p.id));
      if (!allowedPrjIds.has(exp.projectId)) return false;
    }

    // Check direct matching with currentStageId
    if (exp.currentStageId === stageId) return true;

    // Sequential top-to-bottom rule: ALL preceding stages (0 ... stageIdx - 1) MUST be approved
    for (let i = 0; i < stageIdx; i++) {
      if (!isStageIndexApproved(exp, i)) {
        return false;
      }
    }

    // Current stage must NOT be approved yet
    if (isStageIndexApproved(exp, stageIdx)) {
      return false;
    }

    return true;
  }, [activeWorkflowStages, isStageIndexApproved, isAccountant, isSupervisor, accessibleProjects, currentUser, currentUserPermissions]);

  // Expenses filtered per stage or history
  const stageExpenses = useMemo(() => {
    const hasAccountantPrjFilter = isAccountant && Array.isArray(currentUser.assignedProjects) && currentUser.assignedProjects.length > 0 && !currentUserPermissions?.canViewAllProjects;
    const allowedPrjIds = (hasAccountantPrjFilter || isSupervisor) ? new Set(accessibleProjects.map(p => p.id)) : null;

    if (selectedTab === 'history') {
      return expenses.filter(e => {
        if (isAccountant) {
          if (allowedPrjIds && !allowedPrjIds.has(e.projectId)) return false;
          if (!isStage1Approved(e)) return false;
        }
        if (isSupervisor) {
          if (allowedPrjIds && !allowedPrjIds.has(e.projectId)) return false;
        }
        return e.status === 'معتمد' || e.status === 'مرفوض' || isStage3Approved(e);
      });
    }

    if (selectedTab === 'erp_queue') {
      return expenses.filter(
        e =>
          (!isAccountant || ((!allowedPrjIds || allowedPrjIds.has(e.projectId)) && isStage1Approved(e))) &&
          (!isSupervisor || !allowedPrjIds || allowedPrjIds.has(e.projectId)) &&
          (e.erpPostingStatus === 'بانتظار الترحيل' || (!e.erpReferenceNumber && e.accountantApproval === 'تم الاعتماد'))
      );
    }

    // Strictly filter by sequential stage
    return expenses.filter(e => {
      if (isSupervisor && allowedPrjIds && !allowedPrjIds.has(e.projectId)) return false;
      return isExpenseInStage(e, selectedTab);
    });
  }, [expenses, selectedTab, isExpenseInStage, isStage3Approved, isStage1Approved, isAccountant, isSupervisor, accessibleProjects, currentUser, currentUserPermissions]);

  // Filtered expenses based on all active filter criteria (matching ExpenseList.tsx)
  const filteredExpenses = useMemo(() => {
    return stageExpenses.filter(exp => {
      // Supervisor filter
      if (selectedSupervisor !== 'all') {
        const matchesSup =
          exp.supervisorEmail?.toLowerCase() === selectedSupervisor.toLowerCase() ||
          exp.supervisorName?.toLowerCase().includes(selectedSupervisor.toLowerCase());
        if (!matchesSup) return false;
      }

      // Search term (Matches: Details, ID, Supervisor, Project, Invoice, and AMOUNT with operators)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesDetails = exp.details?.toLowerCase().includes(term);
        const matchesId = exp.id?.toLowerCase().includes(term);
        const matchesSupervisor = exp.supervisorName?.toLowerCase().includes(term);
        const matchesProject = exp.projectName?.toLowerCase().includes(term);
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

      // History tab status filter
      if (selectedTab === 'history' && historyStatusFilter !== 'all') {
        if (historyStatusFilter === 'approved' && exp.status !== 'معتمد') return false;
        if (historyStatusFilter === 'rejected' && exp.status !== 'مرفوض') return false;
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

      return true;
    });
  }, [
    stageExpenses,
    selectedSupervisor,
    searchTerm,
    selectedProject,
    selectedCategory,
    selectedTab,
    historyStatusFilter,
    dateFilterType,
    customStartDate,
    customEndDate,
    todayStr,
    last30DaysRange,
    weekRange,
    monthRange
  ]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const isFilterActive =
    searchTerm.trim() !== '' ||
    selectedSupervisor !== 'all' ||
    selectedProject !== 'all' ||
    selectedCategory !== 'all' ||
    (selectedTab === 'history' && historyStatusFilter !== 'all') ||
    dateFilterType !== 'all' ||
    customStartDate !== '' ||
    customEndDate !== '';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedSupervisor('all');
    setSelectedProject('all');
    setSelectedCategory('all');
    setHistoryStatusFilter('all');
    setDateFilterType('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredExpenses.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchApprove = () => {
    if (selectedIds.length === 0 || !currentStageObj) return;
    confirmAction({
      title: 'تأكيد الاعتماد الجماعي',
      message: `هل أنت متأكد من اعتماد (${selectedIds.length}) فواتير دفعة واحدة لمرحلة (${currentStageObj.title})؟`,
      type: 'info',
      confirmText: 'نعم، اعتماد الكل',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        await batchApprove(selectedIds, currentStageObj.id);
        setSelectedIds([]);
      }
    });
  };

  const handleOpenApprove = (exp: Expense, stage: WorkflowStage) => {
    if (stage.requiresExternalErpPosting) {
      setErpModalExp(exp);
      setErpStageId(stage.id);
      setErpSystemName(settings.erpSystemName || (settings.customErpSystems && settings.customErpSystems[0]) || 'Odoo ERP');
      setErpReferenceNumber(exp.erpReferenceNumber || `JV-${Date.now().toString().slice(-5)}`);
      setErpNotes(`تم التدقيق والمطابقة وترحيل القيد المحاسبي بنجاح.`);
    } else {
      setApprovalNotesModalExp({ exp, stage });
      setApprovalNotes(`معتمد بمرحلة ${stage.title}.`);
    }
  };

  const handleConfirmApprovalWithNotes = async () => {
    if (!approvalNotesModalExp) return;
    await approveWorkflowStage(approvalNotesModalExp.exp.id, approvalNotesModalExp.stage.id, approvalNotes);
    setApprovalNotesModalExp(null);
    setApprovalNotes('');
  };

  const handleConfirmERPPosting = async () => {
    if (!erpModalExp) return;
    if (!erpReferenceNumber.trim()) {
      showAlert('بيانات مطلوبة', 'يرجى إدخال رقم القيد أو السند المحاسبي المرجعي.', 'warning');
      return;
    }
    
    // Perform stage approval and ERP link
    await approveWorkflowStage(erpModalExp.id, erpStageId, erpNotes, {
      erpSystemName,
      erpReferenceNumber: erpReferenceNumber.trim(),
    });

    setErpModalExp(null);
    setErpStageId('');
  };

  const handleConfirmReject = async () => {
    if (!rejectionModalExp || !rejectionReason.trim()) {
      showAlert('بيانات مطلوبة', 'يرجى كتابة سبب الرفض.', 'warning');
      return;
    }
    await rejectExpense(rejectionModalExp.id, rejectionReason);
    setRejectionModalExp(null);
    setRejectionReason('');
  };

  // Check if current user can approve in the active tab (RBAC for 3 roles)
  const canUserApproveInTab = useMemo(() => {
    if (!currentStageObj) return false;
    const isExecutive =
      currentUser.role.includes('مدير') ||
      currentUser.role.includes('عليا') ||
      currentUser.roleId === 'role_admin' ||
      currentUser.roleId === 'role_management' ||
      currentUserRole?.id === 'role_management';

    // Management/Executive or Admin can approve any stage
    if (isExecutive || hasPermission('canManageRolesAndPermissions')) return true;

    const category = getStageCategory(currentStageObj.id);

    // Stage 1: Supervisor (مشرف موقع)
    if (category === 1 || currentStageObj.id === 'stage_supervisor' || currentStageObj.order === 1) {
      return (
        hasPermission('canApproveAsSupervisor') ||
        currentUser.role.includes('مشرف') ||
        currentUser.roleId === 'role_supervisor' ||
        currentUserRole?.id === 'role_supervisor'
      );
    }

    // Stage 2: Accountant (محاسب مالي)
    if (category === 2 || currentStageObj.id === 'stage_accountant' || currentStageObj.order === 2) {
      return (
        hasPermission('canApproveAsAccountant') ||
        currentUser.role.includes('محاسب') ||
        currentUser.roleId === 'role_accountant' ||
        currentUserRole?.id === 'role_accountant'
      );
    }

    // Stage 3: Management (مدير تنفيذي / إدارة عليا)
    if (category === 3 || currentStageObj.id === 'stage_management' || currentStageObj.order === 3) {
      return hasPermission('canApproveAsManagement') || isExecutive;
    }

    // Check by role title/id assignment
    if (currentStageObj.roleId === currentUser.roleId || currentStageObj.roleId === currentUser.role) return true;

    return false;
  }, [currentStageObj, hasPermission, currentUser, currentUserRole, getStageCategory]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-l from-emerald-50/80 via-slate-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                دورة الاعتمادات الذكية المتسلسلة والترحيل المحاسبي
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              المسار التسلسلي الصارم: 1️⃣ مراجعة واعتماد المشرف ➔ 2️⃣ مراجعة وترحيل المحاسب المالي ➔ 3️⃣ اعتماد الإدارة العليا والخصم النهائي.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/90 dark:bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shrink-0 shadow-2xs">
            {displayWorkflowStages.map((stg, i) => {
              const count = expenses.filter(e => isExpenseInStage(e, stg.id)).length;
              return (
                <React.Fragment key={stg.id}>
                  {i > 0 && <div className="w-px h-7 bg-slate-200 dark:bg-white/20" />}
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-300 block">{stg.title.split(' ')[0]} {stg.title.split(' ')[1] || ''}</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{count}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Accountant Multi-Stage Workflow Gating Notice */}
      {isAccountant && (
        <div className="p-3.5 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-950 dark:text-blue-100 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-200/70 dark:bg-blue-900/80 text-blue-800 dark:text-blue-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs leading-relaxed">
              <span className="font-bold block text-[13px] mb-0.5">ضوابط التدقيق المالي ومحرك دورة الاعتماد (المحاسب المالي):</span>
              لا يتم إظهار المصروفات المسجلة من قبل المشرف أو أي شخص آخر في صندوق التدقيق المحاسبي إلا بعد اعتمادها ومطابقتها رسمياً من المراحل السابقة (اعتماد المشرف الميداني). تظهر لك هنا فقط المعاملات المؤهلة للمراجعة المالية والترحيل.
            </div>
          </div>
          <span className="shrink-0 self-start sm:self-auto px-2.5 py-1 rounded-xl bg-blue-200/80 dark:bg-blue-900/90 text-blue-900 dark:text-blue-200 text-[11px] font-bold">
            تسلسل المراحل مفعل
          </span>
        </div>
      )}

      {/* Dynamic Workflow Stages Navigation Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {displayWorkflowStages.map((stage, idx) => {
            const count = expenses.filter(e => isExpenseInStage(e, stage.id)).length;
            const isSelected = selectedTab === stage.id;
            const originalStageIdx = activeWorkflowStages.findIndex(s => s.id === stage.id);

            return (
              <button
                key={stage.id}
                onClick={() => {
                  setSelectedTab(stage.id);
                  setSelectedIds([]);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-black/15 flex items-center justify-center text-[10px]">
                  {originalStageIdx !== -1 ? originalStageIdx + 1 : idx + 1}
                </span>
                <span>{stage.title}</span>
                {stage.requiresExternalErpPosting && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-400/30 text-[9px] font-mono">
                    ERP
                  </span>
                )}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => {
              setSelectedTab('erp_queue');
              setSelectedIds([]);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              selectedTab === 'erp_queue'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            <Database className="w-4 h-4 text-blue-500" />
            <span>فواتير بانتظار الترحيل المحاسبي</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${selectedTab === 'erp_queue' ? 'bg-white/20 text-white' : 'bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
              {expenses.filter(e => (!isAccountant || isStage1Approved(e)) && !e.erpReferenceNumber && e.accountantApproval === 'تم الاعتماد').length}
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedTab('history');
              setSelectedIds([]);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedTab === 'history'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            سجل القرارات المعتمدة والمرفوضة
          </button>
        </div>

        {/* Right Actions: View Mode Switcher, Column Visibility & Batch Approval */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle: Table / Cards */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="عرض جدول تفصيلي"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">جدول</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('cards')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="عرض بطاقات ذكية (مناسب للموبايل)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">بطاقات (موبايل)</span>
            </button>
          </div>

          {viewMode === 'table' && (
            <ColumnVisibilityDropdown
              columns={APPROVAL_TABLE_COLUMNS}
              visibleColumns={approvalColumns.visibleColumns}
              onToggleColumn={approvalColumns.toggleColumn}
              onResetToDefault={approvalColumns.resetToDefault}
              onShowAll={approvalColumns.showAll}
              align="right"
            />
          )}

          {/* Batch Approval Action Button */}
          {selectedIds.length > 0 && selectedTab !== 'history' && selectedTab !== 'erp_queue' && canUserApproveInTab && (
            <button
              onClick={handleBatchApprove}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>اعتماد المختار ({selectedIds.length}) دفعة واحدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search Bar (matching ExpenseList.tsx) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
        {/* Quick Date Scope Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1 shrink-0">النطاق السريع:</span>
          
          <button
            type="button"
            onClick={() => { setDateFilterType('all'); setCustomStartDate(''); setCustomEndDate(''); }}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              dateFilterType === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>كافة الفواتير (الكل)</span>
          </button>

          <button
            type="button"
            onClick={() => { setDateFilterType('last_30_days'); setCustomStartDate(''); setCustomEndDate(''); }}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              dateFilterType === 'last_30_days'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-300" />
            <span>آخر 30 يوماً</span>
          </button>

          <button
            type="button"
            onClick={() => { setDateFilterType('month'); setCustomStartDate(''); setCustomEndDate(''); }}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              dateFilterType === 'month'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>هذا الشهر</span>
          </button>

          <button
            type="button"
            onClick={() => { setDateFilterType('week'); setCustomStartDate(''); setCustomEndDate(''); }}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              dateFilterType === 'week'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>هذا الأسبوع</span>
          </button>

          <button
            type="button"
            onClick={() => { setDateFilterType('today'); setCustomStartDate(''); setCustomEndDate(''); }}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              dateFilterType === 'today'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>اليوم</span>
          </button>
        </div>

        {/* Date Filter & Status Dropdowns Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status filter if on history tab */}
            {selectedTab === 'history' && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500">القرار:</span>
                <select
                  value={historyStatusFilter}
                  onChange={e => setHistoryStatusFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">كافة القرارات</option>
                  <option value="approved">معتمدة فقط</option>
                  <option value="rejected">مرفوضة فقط</option>
                </select>
              </div>
            )}

            {/* Date filter dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={dateFilterType}
                onChange={e => setDateFilterType(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">🌐 كافة الفواتير (بدون حد زمني)</option>
                <option value="last_30_days">⚡ آخر 30 يوماً</option>
                <option value="month">📅 هذا الشهر ({monthRange.monthName})</option>
                <option value="week">📅 هذا الأسبوع</option>
                <option value="today">📅 اليوم ({todayStr})</option>
                <option value="custom">⚙️ فترة زمنية محددة...</option>
              </select>
            </div>

            {/* Custom Date Inputs if custom selected */}
            {dateFilterType === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-[10px] text-slate-400">من:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none font-mono"
                />
                <span className="text-[10px] text-slate-400">إلى:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none font-mono"
                />
              </div>
            )}

            {dateFilterType !== 'all' && (
              <button
                type="button"
                onClick={() => { setDateFilterType('all'); setCustomStartDate(''); setCustomEndDate(''); }}
                className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
              >
                إلغاء التحديد الزمني
              </button>
            )}
          </div>

          {/* Counts & Clear Filters */}
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              المعروض: <strong className="text-slate-900 dark:text-white font-mono">{filteredExpenses.length}</strong> من <span className="font-mono">{stageExpenses.length}</span> فاتورة • بمبلغ <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{totalFilteredAmount.toLocaleString()}</strong> {settings.currencySymbol}
            </span>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط الفلاتر</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Term */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالسند، البيان، المشرف، المشروع، أو المبلغ (500 أو >1000)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Supervisor Filter */}
          <div className="relative">
            <select
              value={selectedSupervisor}
              onChange={e => setSelectedSupervisor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">👷 كافة المشرفين الميدانيين</option>
              {supervisorUsers.map(u => {
                const summary = supervisorsSummary?.find(s => s.email?.toLowerCase() === u.email?.toLowerCase() || s.id === u.id);
                const balanceStr = summary ? ` (العهدة: ${summary.actualRemainingBalance.toLocaleString()} ${settings.currencySymbol})` : '';
                return (
                  <option key={u.id} value={u.email || u.name}>
                    {u.name}{balanceStr}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Project Filter */}
          <div className="relative">
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">🏢 كافة المشاريع</option>
              {accessibleProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">🏷️ كافة البنود والتصنيفات</option>
              {(settings.customCategories && settings.customCategories.length > 0
                ? settings.customCategories
                : ['مواد بناء', 'نثريات وضيافة', 'محروقات ونقل', 'أجور عمالة', 'صيانة وتشغيل', 'أخرى']
              ).map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main List Display: Table or Cards */}
      {stageExpenses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {selectedTab === 'history'
              ? 'لا توجد فواتير في سجل القرارات'
              : selectedTab === 'erp_queue'
              ? 'لا توجد فواتير بانتظار الترحيل المحاسبي'
              : 'رائع! لا توجد فواتير معلقة في هذه المرحلة'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {selectedTab === 'history'
              ? 'لم يتم اعتماد أو رفض أي فواتير حتى الآن.'
              : selectedTab === 'erp_queue'
              ? 'كافة الفواتير المعتمدة مرحلة إلى النظام المحاسبي أو لا توجد فواتير جاهزة للترحيل.'
              : 'كافة المصروفات المدرجة في هذه المرحلة تم تدقيقها واعتمادها بنجاح.'}
          </p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              لا توجد فواتير تطابق خيارات التصفية أو البحث في هذه المرحلة
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              يوجد ({stageExpenses.length}) فاتورة في هذه المرحلة ولكن لا تنطبق عليها معايير التصفية الحالية.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إلغاء التصفية وعرض كافة فواتير المرحلة ({stageExpenses.length})</span>
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* --- CARDS VIEW (OPTIMIZED FOR MOBILE & TOUCH) --- */
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Card Selection Header Bar (if selectable) */}
          {selectedTab !== 'history' && canUserApproveInTab && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-2xs">
              <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>تحديد كافة البطاقات المعروضة ({filteredExpenses.length})</span>
              </label>

              {selectedIds.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold font-mono">
                  تم تحديد {selectedIds.length} من {filteredExpenses.length}
                </span>
              )}
            </div>
          )}

          {/* Grid of Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredExpenses.map(exp => {
              const isSelected = selectedIds.includes(exp.id);
              const isSelectable = selectedTab !== 'history' && canUserApproveInTab;

              return (
                <div
                  key={exp.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all relative flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2">
                      {isSelectable && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(exp.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                            #{exp.id}
                          </span>
                          {exp.invoiceNumber && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              (ف: {exp.invoiceNumber})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{exp.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stage / Status Pill */}
                    <div>
                      {exp.status === 'معتمد' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>معتمد نهائياً</span>
                        </span>
                      ) : exp.status === 'مرفوض' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>مرفوض</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>
                            {activeWorkflowStages.find(s => s.id === exp.currentStageId)?.title ||
                              (getStageCategory(exp.currentStageId || '') === 1 ? activeWorkflowStages[0]?.title : undefined) ||
                              (getStageCategory(exp.currentStageId || '') === 2 ? activeWorkflowStages[1]?.title : undefined) ||
                              (getStageCategory(exp.currentStageId || '') === 3 ? activeWorkflowStages[2]?.title : undefined) ||
                              'بانتظار الاعتماد'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3 flex-1">
                    {/* Amount & Project Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">المبلغ المطلوب</span>
                        <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {exp.amount.toLocaleString()} {settings.currencySymbol}
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {exp.category}
                        </span>
                      </div>
                    </div>

                    {/* Project & Supervisor Info */}
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{exp.projectName}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>المشرف: <strong className="text-slate-700 dark:text-slate-300">{exp.supervisorName}</strong></span>
                      </div>
                    </div>

                    {/* Statement Details */}
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium mb-0.5">البيان والشرح:</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed font-medium">
                        {exp.details || 'لا يوجد بيان إضافي'}
                      </p>
                    </div>

                    {/* ERP Reference Status (if any) */}
                    {exp.erpReferenceNumber && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px]">
                        <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-bold">مرحل لـ {exp.erpSystemName || 'ERP'}:</span>
                        <span className="font-mono font-bold">قيد #{exp.erpReferenceNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {/* Primary Stage Action Button */}
                    <div className="flex items-center gap-1.5 flex-1">
                      {selectedTab !== 'history' && currentStageObj && canUserApproveInTab && (
                        <button
                          onClick={() => handleOpenApprove(exp, currentStageObj)}
                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          title={`اعتماد مرحلة ${currentStageObj.title}`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>اعتماد المرحلة</span>
                        </button>
                      )}

                      {selectedTab === 'erp_queue' && hasPermission('canExportToExternalERP') && (
                        <button
                          onClick={() => {
                            setErpModalExp(exp);
                            setErpStageId('erp_posting');
                            setErpReferenceNumber(`JV-${Date.now().toString().slice(-5)}`);
                          }}
                          className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Database className="w-4 h-4" />
                          <span>ترحيل لـ ERP</span>
                        </button>
                      )}

                      {selectedTab !== 'history' && canUserApproveInTab && (
                        <button
                          onClick={() => setRejectionModalExp(exp)}
                          className="py-2 px-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="رفض الفاتورة"
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">رفض</span>
                        </button>
                      )}
                    </div>

                    {/* Secondary Quick Action Icons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {((exp.attachments && exp.attachments.length > 0) || exp.invoicePhoto) && (
                        <button
                          onClick={() => {
                            const firstUrl = exp.attachments?.[0]?.url || exp.invoicePhoto || '';
                            openAttachmentPreview(firstUrl, exp);
                          }}
                          className="p-2 rounded-xl text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 hover:bg-emerald-200 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer relative flex items-center gap-1"
                          title="معاينة مرفقات ومستندات الفاتورة فوراً"
                        >
                          <FileText className="w-4 h-4" />
                          {exp.attachments && exp.attachments.length > 1 && (
                            <span className="text-[10px] font-black font-mono bg-emerald-600 text-white rounded-full px-1">
                              {exp.attachments.length}
                            </span>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedExpenseForDetail(exp)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title="معاينة التفاصيل ومسار الاعتماد بالكامل"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* --- TABLE VIEW (STANDARD DESKTOP) --- */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {selectedTab !== 'history' && canUserApproveInTab && (
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                  )}
                  {approvalColumns.isVisible('idAndDate') && <th className="py-3 px-3.5 font-semibold">رقم السند والتاريخ</th>}
                  {approvalColumns.isVisible('projectAndCategory') && <th className="py-3 px-3.5 font-semibold">المشروع والبند</th>}
                  {approvalColumns.isVisible('descAndSupervisor') && <th className="py-3 px-3.5 font-semibold">البيان والمشرف</th>}
                  {approvalColumns.isVisible('amount') && <th className="py-3 px-3.5 font-semibold">المبلغ المطلوب</th>}
                  {approvalColumns.isVisible('currentStage') && <th className="py-3 px-3.5 font-semibold">المرحلة الحالية</th>}
                  {approvalColumns.isVisible('erpStatus') && <th className="py-3 px-3.5 font-semibold">حالة ترحيل ERP</th>}
                  {approvalColumns.isVisible('actions') && <th className="py-3 px-3.5 font-semibold text-center">إجراء الاعتماد</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredExpenses.map(exp => (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {selectedTab !== 'history' && canUserApproveInTab && (
                      <td className="py-3 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(exp.id)}
                          onChange={() => handleToggleSelect(exp.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                    )}

                    {approvalColumns.isVisible('idAndDate') && (
                      <td className="py-3 px-3.5">
                        <p className="font-mono font-bold text-slate-900 dark:text-white">{exp.id}</p>
                        <p className="text-[10px] text-slate-400">{exp.date}</p>
                      </td>
                    )}

                    {approvalColumns.isVisible('projectAndCategory') && (
                      <td className="py-3 px-3.5">
                        <p className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                          {exp.projectName}
                        </p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold rounded text-slate-600 dark:text-slate-300">
                          {exp.category}
                        </span>
                      </td>
                    )}

                    {approvalColumns.isVisible('descAndSupervisor') && (
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <p className="font-medium text-slate-700 dark:text-slate-300 line-clamp-1" title={exp.details}>
                          {exp.details}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">بواسطة: {exp.supervisorName}</p>
                      </td>
                    )}

                    {approvalColumns.isVisible('amount') && (
                      <td className="py-3 px-3.5 font-extrabold text-slate-900 dark:text-white whitespace-nowrap font-mono">
                        {exp.amount.toLocaleString()} {settings.currencySymbol}
                      </td>
                    )}

                    {approvalColumns.isVisible('currentStage') && (
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {exp.status === 'معتمد' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>معتمد نهائياً</span>
                          </span>
                        ) : exp.status === 'مرفوض' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>مرفوض</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>
                              {activeWorkflowStages.find(s => s.id === exp.currentStageId)?.title ||
                                (getStageCategory(exp.currentStageId || '') === 1 ? activeWorkflowStages[0]?.title : undefined) ||
                                (getStageCategory(exp.currentStageId || '') === 2 ? activeWorkflowStages[1]?.title : undefined) ||
                                (getStageCategory(exp.currentStageId || '') === 3 ? activeWorkflowStages[2]?.title : undefined) ||
                                'بانتظار مراجعة واعتماد المشرف'}
                            </span>
                          </span>
                        )}
                      </td>
                    )}

                    {approvalColumns.isVisible('erpStatus') && (
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {exp.erpReferenceNumber ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 w-fit">
                              <Database className="w-3 h-3" />
                              <span>مرحل: {exp.erpSystemName || 'ERP'}</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 mt-0.5">قيد #{exp.erpReferenceNumber}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">غير مرحل</span>
                        )}
                      </td>
                    )}

                    {approvalColumns.isVisible('actions') && (
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {selectedTab !== 'history' && currentStageObj && canUserApproveInTab && (
                            <button
                              onClick={() => handleOpenApprove(exp, currentStageObj)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                              title={`اعتماد مرحلة ${currentStageObj.title}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>اعتماد المرحلة</span>
                            </button>
                          )}

                          {selectedTab === 'erp_queue' && hasPermission('canExportToExternalERP') && (
                            <button
                              onClick={() => {
                                setErpModalExp(exp);
                                setErpStageId('erp_posting');
                                setErpReferenceNumber(`JV-${Date.now().toString().slice(-5)}`);
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                            >
                              <Database className="w-3.5 h-3.5" />
                              <span>ترحيل لـ ERP</span>
                            </button>
                          )}

                          {selectedTab !== 'history' && canUserApproveInTab && (
                            <button
                              onClick={() => setRejectionModalExp(exp)}
                              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="رفض الفاتورة"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {((exp.attachments && exp.attachments.length > 0) || exp.invoicePhoto) && (
                            <button
                              onClick={() => {
                                const firstUrl = exp.attachments?.[0]?.url || exp.invoicePhoto || '';
                                openAttachmentPreview(firstUrl, exp);
                              }}
                              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer relative flex items-center gap-1"
                              title="معاينة مرفقات ومستندات الفاتورة فوراً"
                            >
                              <FileText className="w-4 h-4" />
                              {exp.attachments && exp.attachments.length > 1 && (
                                <span className="text-[9px] font-black font-mono bg-emerald-600 text-white rounded-full px-1">
                                  {exp.attachments.length}
                                </span>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedExpenseForDetail(exp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                            title="معاينة التفاصيل ومسار الاعتماد"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ERP External Posting Modal */}
      {erpModalExp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
          <div className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
              <Database className="w-6 h-6" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  الترحيل وإدخال السند على برنامج المحاسبة الخارجي (ERP)
                </h3>
                <p className="text-xs text-slate-500">
                  سند المصروف: #{erpModalExp.id} • المبلغ: {erpModalExp.amount.toLocaleString()} {settings.currencySymbol}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نظام المحاسبة الخارجي
                </label>
                <select
                  value={erpSystemName}
                  onChange={e => setErpSystemName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {(settings.customErpSystems && settings.customErpSystems.length > 0
                    ? settings.customErpSystems
                    : [
                        'Odoo ERP (أودو)',
                        'SAP S/4HANA (ساب)',
                        'Oracle NetSuite (أوراكل)',
                        'QuickBooks Online (كويك بوكس)',
                        'Daftra (دفترة)',
                        'Qoyod (قيود)',
                        'Al-Ameen (الأمين)',
                        'SMACC (سماك)',
                        'Microsoft Dynamics 365 (مايكروسوفت)'
                      ]
                  ).map((sys, idx) => (
                    <option key={idx} value={sys}>
                      {sys} {sys === (settings.erpSystemName || 'Odoo ERP (أودو)') ? '★ (المعتمد في الإعدادات)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رقم القيد المحاسبي / السند المرجعي في النظام الخارجي *
                </label>
                <input
                  type="text"
                  placeholder="مثال: JV-2026-0891 أو PV-4491"
                  value={erpReferenceNumber}
                  onChange={e => setErpReferenceNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">يضمن هذا الرقم الربط المالي المزدوج بين التطبيق ودفاتر الحسابات العامة.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات وتوجيهات المحاسب المالي
                </label>
                <textarea
                  rows={2}
                  value={erpNotes}
                  onChange={e => setErpNotes(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setErpModalExp(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmERPPosting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>تأكيد الترحيل والاعتماد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval with Notes Modal */}
      {approvalNotesModalExp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
          <div className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 w-full max-w-md space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  اعتماد: {approvalNotesModalExp.stage.title}
                </h3>
                <p className="text-xs text-slate-500">
                  سند #{approvalNotesModalExp.exp.id} لمشروع {approvalNotesModalExp.exp.projectName}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ملاحظات أو توجيهات الاعتماد (اختياري)
              </label>
              <textarea
                rows={3}
                placeholder="أدخل أي ملاحظات فنية أو إدارية..."
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setApprovalNotesModalExp(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmApprovalWithNotes}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-emerald-600/20"
              >
                تأكيد الاعتماد والمتابعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalExp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
          <div className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 w-full max-w-md space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                رفض المصروف رقم: {rejectionModalExp.id}
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              يرجى كتابة سبب رفض هذا المصروف ليتم توجيه المشرف وإشعاره فوراً بالملاحظات.
            </p>
            <textarea
              rows={3}
              placeholder="اكتب سبب الرفض بدقة..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionModalExp(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

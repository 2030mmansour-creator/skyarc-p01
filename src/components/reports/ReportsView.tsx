import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { StorageService } from '../../services/storage';
import {
  ColumnVisibilityDropdown,
  useColumnVisibility,
  ColumnDefinition
} from '../common/ColumnVisibilityDropdown';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Printer,
  PieChart as PieChartIcon,
  TrendingUp,
  Receipt,
  Wallet,
  CheckCircle,
  FileText,
  RotateCcw,
  FileDown,
  Bookmark,
  BookmarkPlus,
  Trash2,
  Users,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  BarChart3,
  Clock,
  Layers,
  ArrowUpDown,
  Tag,
  Check,
  X,
  Plus
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import { SavedReportPreset, Expense } from '../../types';

const REPORT_TABLE_COLUMNS: ColumnDefinition[] = [
  { id: 'id', label: 'رقم السند', defaultVisible: true, alwaysVisible: true, description: 'كود السند المميز' },
  { id: 'date', label: 'التاريخ', defaultVisible: true, description: 'تاريخ الصرف المسجل' },
  { id: 'projectName', label: 'المشروع', defaultVisible: true, description: 'اسم المشروع الميداني' },
  { id: 'supervisor', label: 'المشرف المسؤول', defaultVisible: true, description: 'اسم المشرف الذي سجل المصروف' },
  { id: 'category', label: 'البند والتصنيف', defaultVisible: true, description: 'بند المصروف الرئيسي والفرعي' },
  { id: 'details', label: 'البيان والشرح', defaultVisible: true, description: 'تفاصيل وبيان الفاتورة' },
  { id: 'amount', label: 'المبلغ', defaultVisible: true, alwaysVisible: true, description: 'المبلغ الإجمالي للمصروف' },
  { id: 'taxAmount', label: 'الضريبة (VAT)', defaultVisible: true, description: 'مبلغ ضريبة القيمة المضافة' },
  { id: 'invoiceNumber', label: 'رقم الفاتورة', defaultVisible: true, description: 'الرقم الضريبي أو رقم فاتورة المورد' },
  { id: 'status', label: 'الحالة', defaultVisible: true, description: 'حالة اعتماد المصروف' },
  { id: 'actions', label: 'طباعة', defaultVisible: true, description: 'طباعة سند الصرف الفردي' }
];

type DatePresetType = 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
type AnalyticsTabType = 'categories' | 'supervisors' | 'timeline';

const SAVED_REPORTS_STORAGE_KEY = 'sys_financial_saved_reports_presets_v2';

const SYSTEM_DEFAULT_PRESETS: SavedReportPreset[] = [
  {
    id: 'sys_current_month',
    name: 'تقرير مصروفات الشهر الحالي',
    description: 'كافة مصروفات وسندات المشاريع خلال الشهر الجاري',
    projectId: 'all',
    supervisorEmail: 'all',
    category: 'all',
    status: 'all',
    datePreset: 'this_month',
    createdAt: new Date().toISOString(),
    isSystem: true,
    color: '#10b981',
  },
  {
    id: 'sys_pending_audit',
    name: 'السندات المعلقة قيد المراجعة والتدقيق',
    description: 'فواتير وسندات بانتظار اعتماد المشرف أو المحاسب أو الإدارة',
    projectId: 'all',
    supervisorEmail: 'all',
    category: 'all',
    status: 'معلق',
    datePreset: 'all',
    createdAt: new Date().toISOString(),
    isSystem: true,
    color: '#f59e0b',
  },
  {
    id: 'sys_approved_custody',
    name: 'المصروفات المعتمدة للمشرفين',
    description: 'كافة السندات المعتمدة نهائياً للمشرفين الميدانيين هذا الشهر',
    projectId: 'all',
    supervisorEmail: 'all',
    category: 'all',
    status: 'معتمد',
    datePreset: 'this_month',
    createdAt: new Date().toISOString(),
    isSystem: true,
    color: '#3b82f6',
  },
  {
    id: 'sys_quarter_vat',
    name: 'إقرار ضريبة القيمة المضافة (الربع الحالي)',
    description: 'كشف المبالغ الخاضعة للضريبة وقيمة الـ VAT 15%',
    projectId: 'all',
    supervisorEmail: 'all',
    category: 'all',
    status: 'معتمد',
    datePreset: 'this_quarter',
    createdAt: new Date().toISOString(),
    isSystem: true,
    color: '#8b5cf6',
  },
];

// Helper to compute date range from preset
const computeDatesFromPreset = (preset: DatePresetType): { start: string; end: string } => {
  const now = new Date();
  const format = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today': {
      const todayStr = format(now);
      return { start: todayStr, end: todayStr };
    }
    case 'this_week': {
      const dayOfWeek = now.getDay(); // 0 is Sunday
      // In Saudi / Arab week, Sunday is start
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: format(start), end: format(end) };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: format(start), end: format(end) };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: format(start), end: format(end) };
    }
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      return { start: format(start), end: format(end) };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start: format(start), end: format(end) };
    }
    case 'all':
    case 'custom':
    default:
      return { start: '', end: '' };
  }
};

export const ReportsView: React.FC = () => {
  const {
    projects,
    accessibleProjects,
    expenses,
    custodies,
    supervisorsSummary,
    settings,
    currentUser,
    isExpenseApprovedByPrecedingStages,
    exportAllToExcel,
    setPrintData,
    setIsPrintModalOpen,
    showAlert,
    isDarkMode,
  } = useApp();

  const reportColumns = useColumnVisibility(
    'reports_table_columns_visibility',
    REPORT_TABLE_COLUMNS
  );

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

  // Filter States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePresetType>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Active Tab for Analytics Breakdown
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTabType>('categories');

  // Saved Presets
  const [savedPresets, setSavedPresets] = useState<SavedReportPreset[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_REPORTS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return SYSTEM_DEFAULT_PRESETS;
  });

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [newPresetColor, setNewPresetColor] = useState('#10b981');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Save to localStorage whenever user presets change
  const persistPresets = (presets: SavedReportPreset[]) => {
    setSavedPresets(presets);
    try {
      localStorage.setItem(SAVED_REPORTS_STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.warn('Failed to save presets to localStorage:', e);
    }
  };

  // Distinct Field Supervisors List (combined from supervisorsSummary + expenses)
  const supervisorsList = useMemo(() => {
    const map = new Map<string, { name: string; email: string; phone?: string; totalAssigned?: number }>();

    // 1. From supervisors summary
    supervisorsSummary.forEach(s => {
      if (s.email) {
        map.set(s.email.toLowerCase(), {
          name: s.name,
          email: s.email,
          phone: s.phone,
          totalAssigned: s.totalCustody || 0,
        });
      }
    });

    // 2. From expenses history if missing
    expenses.forEach(e => {
      if (e.supervisorEmail && !map.has(e.supervisorEmail.toLowerCase())) {
        map.set(e.supervisorEmail.toLowerCase(), {
          name: e.supervisorName || e.supervisorEmail.split('@')[0],
          email: e.supervisorEmail,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [supervisorsSummary, expenses]);

  const displayedProjects = useMemo(() => {
    return isAccountant || isSupervisor ? accessibleProjects : projects;
  }, [isAccountant, isSupervisor, accessibleProjects, projects]);

  // Handle Preset Date changes
  const handleDatePresetSelect = (preset: DatePresetType) => {
    setDatePreset(preset);
    setActivePresetId(null);
    if (preset === 'custom') {
      // keep current or clear
    } else {
      const { start, end } = computeDatesFromPreset(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Apply a Saved Preset
  const handleApplyPreset = (preset: SavedReportPreset) => {
    setActivePresetId(preset.id);
    setSelectedProjectId(preset.projectId || 'all');
    setSelectedSupervisor(preset.supervisorEmail || 'all');
    setSelectedCategory(preset.category || 'all');
    setSelectedStatus(preset.status || 'all');
    setDatePreset(preset.datePreset || 'all');

    if (preset.datePreset === 'custom') {
      setStartDate(preset.startDate || '');
      setEndDate(preset.endDate || '');
    } else {
      const { start, end } = computeDatesFromPreset(preset.datePreset || 'all');
      setStartDate(start);
      setEndDate(end);
    }

    if (preset.minAmount) setMinAmount(String(preset.minAmount));
    else setMinAmount('');
    if (preset.maxAmount) setMaxAmount(String(preset.maxAmount));
    else setMaxAmount('');
  };

  // Save Current Filter Combination as a Preset
  const handleSaveCurrentFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) {
      showAlert('تنبيه', 'يرجى كتابة اسم مناسب للتقرير المحفوظ.', 'warning');
      return;
    }

    const newPreset: SavedReportPreset = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || undefined,
      projectId: selectedProjectId,
      supervisorEmail: selectedSupervisor,
      category: selectedCategory,
      status: selectedStatus,
      datePreset: datePreset,
      startDate: datePreset === 'custom' ? startDate : undefined,
      endDate: datePreset === 'custom' ? endDate : undefined,
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      color: newPresetColor,
      createdAt: new Date().toISOString(),
      isSystem: false,
    };

    const updated = [newPreset, ...savedPresets];
    persistPresets(updated);
    setActivePresetId(newPreset.id);
    setIsSaveModalOpen(false);
    setNewPresetName('');
    setNewPresetDesc('');

    showAlert('تم حفظ التقرير بنجاح', `تم حفظ تقرير "${newPreset.name}" في قائمة التقارير الجاهزة للاستخدام السريع.`, 'success');
  };

  // Delete a Custom Preset
  const handleDeletePreset = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedPresets.filter(p => p.id !== id);
    persistPresets(updated);
    if (activePresetId === id) setActivePresetId(null);
    showAlert('تم حذف التقرير', `تمت إزالة تقرير "${name}" من القائمة.`, 'info');
  };

  // Filtered expenses for reporting
  const reportExpenses = useMemo(() => {
    const allowedPrjIds = (isAccountant || isSupervisor) ? new Set(accessibleProjects.map(p => p.id)) : null;

    return expenses.filter(e => {
      // 1. Role-based security access check
      if (isAccountant) {
        if (!isExpenseApprovedByPrecedingStages(e, currentUser)) return false;
        if (allowedPrjIds && !allowedPrjIds.has(e.projectId)) return false;
      }
      if (isSupervisor) {
        if (allowedPrjIds && !allowedPrjIds.has(e.projectId)) return false;
        const isMyExpense =
          e.supervisorEmail.toLowerCase() === currentUser.email.toLowerCase() ||
          e.supervisorName.toLowerCase().includes(currentUser.name.split(' ')[0].toLowerCase()) ||
          (Array.isArray(currentUser.assignedProjects) && currentUser.assignedProjects.includes(e.projectId));
        if (!isMyExpense) return false;
      }

      // 2. Project filter
      if (selectedProjectId !== 'all' && e.projectId !== selectedProjectId) return false;

      // 3. Supervisor filter
      if (selectedSupervisor !== 'all') {
        const supMatch =
          e.supervisorEmail.toLowerCase() === selectedSupervisor.toLowerCase() ||
          e.supervisorName.toLowerCase() === selectedSupervisor.toLowerCase();
        if (!supMatch) return false;
      }

      // 4. Category filter
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;

      // 5. Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'معتمد' && e.status !== 'معتمد') return false;
        if (selectedStatus === 'معلق' && (e.status === 'معتمد' || e.status === 'مرفوض')) return false;
        if (selectedStatus === 'مرفوض' && e.status !== 'مرفوض') return false;
      }

      // 6. Date Range filter
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;

      // 7. Amount range
      if (minAmount && e.amount < Number(minAmount)) return false;
      if (maxAmount && e.amount > Number(maxAmount)) return false;

      // 8. Keyword search in details, invoice, or supplier
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const detailsMatch = e.details?.toLowerCase().includes(q);
        const invMatch = e.invoiceNumber?.toLowerCase().includes(q);
        const prjMatch = e.projectName?.toLowerCase().includes(q);
        const supMatch = e.supervisorName?.toLowerCase().includes(q);
        const idMatch = e.id?.toLowerCase().includes(q);
        if (!detailsMatch && !invMatch && !prjMatch && !supMatch && !idMatch) return false;
      }

      return true;
    });
  }, [
    expenses,
    isAccountant,
    isSupervisor,
    isExpenseApprovedByPrecedingStages,
    accessibleProjects,
    currentUser,
    selectedProjectId,
    selectedSupervisor,
    selectedCategory,
    selectedStatus,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    searchKeyword
  ]);

  // Financial KPI Calculations
  const totalSpent = useMemo(() => {
    return reportExpenses.filter(e => e.status === 'معتمد').reduce((sum, e) => sum + e.amount, 0);
  }, [reportExpenses]);

  const totalTax = useMemo(() => {
    return reportExpenses.filter(e => e.status === 'معتمد').reduce((sum, e) => sum + (e.taxAmount || 0), 0);
  }, [reportExpenses]);

  const pendingAmount = useMemo(() => {
    return reportExpenses.filter(e => e.status !== 'معتمد' && e.status !== 'مرفوض').reduce((sum, e) => sum + e.amount, 0);
  }, [reportExpenses]);

  const averageTicket = useMemo(() => {
    return reportExpenses.length > 0 ? Math.round(reportExpenses.reduce((sum, e) => sum + e.amount, 0) / reportExpenses.length) : 0;
  }, [reportExpenses]);

  const activeSupervisorsCount = useMemo(() => {
    return new Set(reportExpenses.map(e => e.supervisorEmail || e.supervisorName)).size;
  }, [reportExpenses]);

  const activeProjectsCount = useMemo(() => {
    return new Set(reportExpenses.map(e => e.projectId || e.projectName)).size;
  }, [reportExpenses]);

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

  // 1. Expenses by Category Breakdown
  const categoryDataWithPercent = useMemo(() => {
    const map: Record<string, number> = {};
    reportExpenses
      .filter(e => e.status === 'معتمد')
      .forEach(e => {
        map[e.category] = (map[e.category] || 0) + e.amount;
      });

    const list = Object.entries(map).map(([name, value]) => ({ name, value }));
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
  }, [reportExpenses]);

  // 2. Expenses by Field Supervisor Breakdown
  const supervisorData = useMemo(() => {
    const map: Record<string, number> = {};
    reportExpenses
      .filter(e => e.status === 'معتمد')
      .forEach(e => {
        const supName = e.supervisorName || e.supervisorEmail.split('@')[0];
        map[supName] = (map[supName] || 0) + e.amount;
      });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [reportExpenses]);

  // 3. Monthly Timeline Progression
  const monthlyTimelineData = useMemo(() => {
    const map: Record<string, { month: string; approved: number; pending: number }> = {};
    reportExpenses.forEach(e => {
      const monthKey = e.date ? e.date.substring(0, 7) : 'غير محدد';
      if (!map[monthKey]) {
        map[monthKey] = { month: monthKey, approved: 0, pending: 0 };
      }
      if (e.status === 'معتمد') {
        map[monthKey].approved += e.amount;
      } else if (e.status !== 'مرفوض') {
        map[monthKey].pending += e.amount;
      }
    });

    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [reportExpenses]);

  // Export to Excel with custom report name
  const handleExportFilteredExcel = () => {
    const exportData = reportExpenses.map(e => ({
      'رقم السند': e.id,
      'التاريخ': e.date,
      'المشروع الميداني': e.projectName,
      'المشرف المسؤول': e.supervisorName,
      'البند والتصنيف': e.category,
      'البيان والشرح': e.details,
      [`المبلغ (${settings.currencySymbol})`]: e.amount,
      [`الضريبة 15% (${settings.currencySymbol})`]: e.taxAmount || 0,
      'رقم الفاتورة': e.invoiceNumber || '-',
      'حالة الاعتماد': e.status,
    }));

    StorageService.exportToCSV(exportData, `تقرير_مخصص_${new Date().toISOString().split('T')[0]}.csv`);
    showAlert('تم التصدير بنجاح', `تم تصدير كشف السندات المفلترة (${reportExpenses.length} سند) كملف جدول بيانات.`, 'success');
  };

  // Comprehensive Print & PDF Action
  const handlePrintSummary = () => {
    const proj = selectedProjectId !== 'all' ? projects.find(p => p.id === selectedProjectId) : null;
    const sup = selectedSupervisor !== 'all' ? supervisorsList.find(s => s.email === selectedSupervisor || s.name === selectedSupervisor) : null;

    let title = 'تقرير المصروفات والرقابة المالية الشامل للمشاريع';
    if (proj && sup) {
      title = `تقرير مصروفات مشروع (${proj.name}) - المشرف (${sup.name})`;
    } else if (proj) {
      title = `تقرير المصروفات والرقابة المالية لمشروع: ${proj.name}`;
    } else if (sup) {
      title = `كشف مصروفات وسندات المشرف الميداني: ${sup.name}`;
    }

    setPrintData({
      type: 'filtered_report',
      data: {
        title,
        reportSubtitle: 'كشف مالي معتمد بمصروفات وعهد المشاريع الميدانية مع توزيع البنود والمشرفين',
        generatedBy: `${currentUser.name} (${currentUser.role})`,
        dateRange: {
          from: startDate || 'البداية',
          to: endDate || 'حتى تاريخه',
        },
        selectedProjectName: proj ? `${proj.name} (${proj.code})` : 'كافة المشاريع',
        selectedSupervisorName: sup ? sup.name : (selectedSupervisor !== 'all' ? selectedSupervisor : 'كافة المشرفين'),
        selectedCategoryName: selectedCategory !== 'all' ? selectedCategory : 'كافة البنود',
        totalSpent,
        pendingAmount,
        totalTax,
        totalExpensesCount: reportExpenses.length,
        categoryBreakdown: categoryDataWithPercent,
        supervisorBreakdown: supervisorData,
        expensesList: reportExpenses,
        visibleColumns: reportColumns.visibleColumns,
      }
    });
    setIsPrintModalOpen(true);
  };

  // Reset All Filters
  const handleResetFilters = () => {
    setSelectedProjectId('all');
    setSelectedSupervisor('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setSearchKeyword('');
    setMinAmount('');
    setMaxAmount('');
    setActivePresetId(null);
  };

  const hasActiveFilters =
    selectedProjectId !== 'all' ||
    selectedSupervisor !== 'all' ||
    selectedCategory !== 'all' ||
    selectedStatus !== 'all' ||
    datePreset !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    searchKeyword !== '' ||
    minAmount !== '' ||
    maxAmount !== '';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Header Banner & Quick Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                مركز التقارير المتقدمة واستخراج البيانات
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                فلترة متعددة الأبعاد حسب التاريخ، المشروع، والمشرف الميداني مع حفظ التقارير السريعة والطباعة المباشرة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setIsSaveModalOpen(true)}
            className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="حفظ معايير الفلترة الحالية كتقرير سريع محفوظ للرجوع إليه بضغطة واحدة"
          >
            <BookmarkPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>حفظ كتقرير جاهز</span>
          </button>

          <button
            type="button"
            onClick={handleExportFilteredExcel}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="تصدير السندات المفلترة إلى جدول CSV"
          >
            <Download className="w-4 h-4" />
            <span>تصدير البيانات المفلترة</span>
          </button>

          <button
            type="button"
            onClick={handlePrintSummary}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer"
            title="معاينة وطباعة التقرير الشامل أو حفظه كـ PDF"
          >
            <Printer className="w-4 h-4" />
            <span>معاينة وطباعة التقرير (PDF)</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Presets Bar (التقارير الجاهزة والمحفوظة للاستخدام السريع) */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              التقارير الجاهزة والمحفوظة للاستخدام السريع
            </h3>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              (انقر على أي تقرير لتطبيقه وتحديث البيانات فوراً)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsSaveModalOpen(true)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة تقرير جديد</span>
          </button>
        </div>

        {/* Presets Horizontal Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {savedPresets.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`relative group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/70 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30'
                    : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: preset.color || '#10b981' }}
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={preset.name}>
                      {preset.name}
                    </span>
                  </div>

                  {!preset.isSystem && (
                    <button
                      type="button"
                      onClick={(e) => handleDeletePreset(preset.id, preset.name, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 dark:hover:bg-rose-950 rounded-md transition-all cursor-pointer"
                      title="حذف هذا التقرير المحفوظ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {preset.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    {preset.description}
                  </p>
                )}

                <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono">
                    {preset.datePreset === 'this_month' ? 'الشهر الحالي' : preset.datePreset === 'this_quarter' ? 'الربع الحالي' : preset.datePreset === 'today' ? 'اليوم' : 'كافة الفترات'}
                  </span>
                  {isSelected && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> نشط
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Advanced Multi-Dimension Filtering Studio */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Filter Title & Quick Reset */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              محرك الفلترة والتخصيص المالي المتقدم
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إلغاء وإعادة تعيين الفلاتر</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-xs text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-bold flex items-center gap-1 cursor-pointer bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg"
            >
              <span>{showAdvancedFilters ? 'إخفاء الفلاتر الإضافية' : 'خيارات فلترة إضافية'}</span>
              {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Date Presets Quick Pills */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-500">
            النطاق الزمني والفترة المالية:
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'كافة الفترات' },
              { id: 'today', label: 'اليوم' },
              { id: 'this_week', label: 'هذا الأسبوع' },
              { id: 'this_month', label: 'هذا الشهر' },
              { id: 'last_month', label: 'الشهر السابق' },
              { id: 'this_quarter', label: 'الربع الحالي' },
              { id: 'this_year', label: 'هذا العام' },
              { id: 'custom', label: 'فترة مخصصة' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePresetSelect(p.id as DatePresetType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  datePreset === p.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main 4-Column Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* 1. Project Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-emerald-600" />
              <span>المشروع الميداني</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={e => {
                setSelectedProjectId(e.target.value);
                setActivePresetId(null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500 cursor-pointer"
            >
              <option value="all">{isAccountant || isSupervisor ? 'كافة المشاريع المسندة' : 'كافة المشاريع'}</option>
              {displayedProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `(${p.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Field Supervisor Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-emerald-600" />
              <span>المشرف الميداني المسؤول</span>
            </label>
            <select
              value={selectedSupervisor}
              onChange={e => {
                setSelectedSupervisor(e.target.value);
                setActivePresetId(null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500 cursor-pointer"
            >
              <option value="all">كافة المشرفين الميدانيين</option>
              {supervisorsList.map(s => (
                <option key={s.email} value={s.email}>
                  {s.name} ({s.email.split('@')[0]})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Category Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-600" />
              <span>البند المالي / التصنيف</span>
            </label>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
                setActivePresetId(null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500 cursor-pointer"
            >
              <option value="all">كافة البنود المالية</option>
              {(settings.customCategories || []).map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Approval Status Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span>حالة الاعتماد المالي</span>
            </label>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setActivePresetId(null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500 cursor-pointer"
            >
              <option value="all">كافة الحالات (معتمد + معلق + مرفوض)</option>
              <option value="معتمد">معتمد نهائياً فقط</option>
              <option value="معلق">معلق قيد المراجعة والتدقيق</option>
              <option value="مرفوض">مرفوض</option>
            </select>
          </div>

        </div>

        {/* Custom Start / End Dates if selected */}
        {(datePreset === 'custom' || startDate || endDate) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                من تاريخ (تاريخ البداية):
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                  setActivePresetId(null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                إلى تاريخ (تاريخ النهاية):
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                  setActivePresetId(null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Advanced Collapsible Filters: Search Keyword & Min/Max Amount */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-150">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                بحث بالكلمة المفتاحية أو رقم الفاتورة:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث في البيان، رقم الفاتورة، أو السند..."
                  value={searchKeyword}
                  onChange={e => {
                    setSearchKeyword(e.target.value);
                    setActivePresetId(null);
                  }}
                  className="w-full pl-3 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                الحد الأدنى للمبلغ ({settings.currencySymbol}):
              </label>
              <input
                type="number"
                placeholder="0"
                value={minAmount}
                onChange={e => {
                  setMinAmount(e.target.value);
                  setActivePresetId(null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                الحد الأقصى للمبلغ ({settings.currencySymbol}):
              </label>
              <input
                type="number"
                placeholder="بدون حد"
                value={maxAmount}
                onChange={e => {
                  setMaxAmount(e.target.value);
                  setActivePresetId(null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Results Counter Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              تم العثور على <strong>{reportExpenses.length}</strong> سند مطابق لمعايير التقرير (من أصل {expenses.length} سند في النظام)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>المشاريع المشمولة: <strong className="text-slate-800 dark:text-slate-200">{activeProjectsCount}</strong></span>
            <span>•</span>
            <span>المشرفين النشطين: <strong className="text-slate-800 dark:text-slate-200">{activeSupervisorsCount}</strong></span>
          </div>
        </div>

      </div>

      {/* 4. Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 block">إجمالي المنصرف المعتمد</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {totalSpent.toLocaleString()}{' '}
            <span className="text-xs font-normal font-sans text-slate-500">{settings.currencySymbol}</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {reportExpenses.filter(e => e.status === 'معتمد').length} سندات معتمدة نهائياً
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 block">فواتير قيد التدقيق والمراجعة</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {pendingAmount.toLocaleString()}{' '}
            <span className="text-xs font-normal font-sans text-slate-500">{settings.currencySymbol}</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {reportExpenses.filter(e => e.status !== 'معتمد' && e.status !== 'مرفوض').length} سندات معلقة
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 block">إجمالي الضريبة المقتطعة (15%)</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
            {totalTax.toLocaleString()}{' '}
            <span className="text-xs font-normal font-sans text-slate-500">{settings.currencySymbol}</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">ضريبة القيمة المضافة المعتمدة</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 block">متوسط قيمة السند المالي</span>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 font-mono">
            {averageTicket.toLocaleString()}{' '}
            <span className="text-xs font-normal font-sans text-slate-500">{settings.currencySymbol}</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">لكل عملية صرف مسجلة</span>
        </div>

      </div>

      {/* 5. Visual Analytical Charts & Breakdown Tabs */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Analytics Tab Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>التحليل البياني المتقدم للمصروفات</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              استكشف توزيع النفقات حسب البند المالي، المشرف الميداني، أو التطور الزمني
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setAnalyticsTab('categories')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                analyticsTab === 'categories'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>حسب البند المالي</span>
            </button>

            <button
              type="button"
              onClick={() => setAnalyticsTab('supervisors')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                analyticsTab === 'supervisors'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>حسب المشرف الميداني</span>
            </button>

            <button
              type="button"
              onClick={() => setAnalyticsTab('timeline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                analyticsTab === 'timeline'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>التطور الزمني</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Category Breakdown */}
        {analyticsTab === 'categories' && (
          <div>
            {categoryDataWithPercent.length > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-6 pt-2">
                {/* Donut Chart */}
                <div className="w-[200px] h-[220px] sm:w-[240px] sm:h-[240px] shrink-0 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDataWithPercent}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryDataWithPercent.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            className="transition-all duration-200 hover:opacity-80"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`${Number(val).toLocaleString()} ${settings.currencySymbol}`, 'المبلغ']}
                        contentStyle={{
                          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                          borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                          borderRadius: '12px',
                          color: isDarkMode ? '#f8fafc' : '#0f172a',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          textAlign: 'right',
                          direction: 'rtl',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Categories List */}
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pl-1 pr-0.5 custom-scrollbar">
                  {categoryDataWithPercent.map((cat) => (
                    <div
                      key={cat.name}
                      className="flex items-center justify-between gap-2 p-2.5 px-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800/80"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={cat.name}>
                          {cat.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                          {cat.value.toLocaleString()} {settings.currencySymbol}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-lg text-xs font-black font-mono shadow-2xs inline-flex items-center justify-center min-w-[48px]"
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
              <div className="flex items-center justify-center h-44 text-xs text-slate-400">
                لا توجد بيانات مصروفات معتمدة مطابقة للفلتر
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Supervisor Spending Breakdown */}
        {analyticsTab === 'supervisors' && (
          <div>
            {supervisorData.length > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={supervisorData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val.toLocaleString()}`} />
                      <Tooltip
                        formatter={(val: any) => [`${Number(val).toLocaleString()} ${settings.currencySymbol}`, 'إجمالي المنصرف']}
                        contentStyle={{
                          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                          borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                          borderRadius: '12px',
                          color: isDarkMode ? '#f8fafc' : '#0f172a',
                          textAlign: 'right',
                          direction: 'rtl',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  {supervisorData.slice(0, 6).map((sup, idx) => (
                    <div key={sup.name} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{sup.name}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {sup.value.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-44 text-xs text-slate-400">
                لا توجد بيانات مشرفين مطابقة للفلتر
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Monthly Timeline Trend */}
        {analyticsTab === 'timeline' && (
          <div>
            {monthlyTimelineData.length > 0 ? (
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTimelineData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val.toLocaleString()}`} />
                    <Tooltip
                      formatter={(val: any) => [`${Number(val).toLocaleString()} ${settings.currencySymbol}`]}
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        borderRadius: '12px',
                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                        textAlign: 'right',
                        direction: 'rtl',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="approved" name="المنصرف المعتمد" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="pending" name="المعلق قيد التدقيق" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-44 text-xs text-slate-400">
                لا توجد بيانات شهرية كافية لعرض التطور الزمني
              </div>
            )}
          </div>
        )}

      </div>

      {/* 6. Detailed Itemized Ledger Table */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                كشف وسجل السندات والفواتير المطابقة للتقرير ({reportExpenses.length} سند)
              </h3>
              <p className="text-[11px] text-slate-400">
                مراجعة وتدقيق كافة السندات المطابقة لمعايير الفلترة المحددة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ColumnVisibilityDropdown
              columns={REPORT_TABLE_COLUMNS}
              visibleColumns={reportColumns.visibleColumns}
              onToggleColumn={reportColumns.toggleColumn}
              onResetToDefault={reportColumns.resetToDefault}
              onShowAll={reportColumns.showAll}
              align="left"
            />
            <button
              type="button"
              onClick={handlePrintSummary}
              className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة كشف هذا الجدول</span>
            </button>
          </div>
        </div>

        {reportExpenses.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {reportColumns.isVisible('id') && <th className="p-3 font-bold">رقم السند</th>}
                  {reportColumns.isVisible('date') && <th className="p-3 font-bold">التاريخ</th>}
                  {reportColumns.isVisible('projectName') && <th className="p-3 font-bold">المشروع</th>}
                  {reportColumns.isVisible('supervisor') && <th className="p-3 font-bold">المشرف المسؤول</th>}
                  {reportColumns.isVisible('category') && <th className="p-3 font-bold">البند والتصنيف</th>}
                  {reportColumns.isVisible('details') && <th className="p-3 font-bold">البيان والشرح</th>}
                  {reportColumns.isVisible('amount') && <th className="p-3 font-bold">المبلغ</th>}
                  {reportColumns.isVisible('taxAmount') && <th className="p-3 font-bold">الضريبة</th>}
                  {reportColumns.isVisible('invoiceNumber') && <th className="p-3 font-bold">رقم الفاتورة</th>}
                  {reportColumns.isVisible('status') && <th className="p-3 font-bold">الحالة</th>}
                  {reportColumns.isVisible('actions') && <th className="p-3 font-bold text-center">طباعة</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportExpenses.slice(0, 50).map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    {reportColumns.isVisible('id') && (
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{exp.id}</td>
                    )}
                    {reportColumns.isVisible('date') && (
                      <td className="p-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{exp.date}</td>
                    )}
                    {reportColumns.isVisible('projectName') && (
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{exp.projectName}</td>
                    )}
                    {reportColumns.isVisible('supervisor') && (
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{exp.supervisorName}</td>
                    )}
                    {reportColumns.isVisible('category') && (
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{exp.category}</td>
                    )}
                    {reportColumns.isVisible('details') && (
                      <td className="p-3 truncate max-w-[200px] text-slate-700 dark:text-slate-300" title={exp.details}>{exp.details}</td>
                    )}
                    {reportColumns.isVisible('amount') && (
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {exp.amount.toLocaleString()} {settings.currencySymbol}
                      </td>
                    )}
                    {reportColumns.isVisible('taxAmount') && (
                      <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                        {exp.taxAmount ? `${exp.taxAmount.toLocaleString()}` : '-'}
                      </td>
                    )}
                    {reportColumns.isVisible('invoiceNumber') && (
                      <td className="p-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">{exp.invoiceNumber || '-'}</td>
                    )}
                    {reportColumns.isVisible('status') && (
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          exp.status === 'معتمد'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : exp.status === 'مرفوض'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {exp.status}
                        </span>
                      </td>
                    )}
                    {reportColumns.isVisible('actions') && (
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setPrintData({ type: 'expense', data: exp });
                            setIsPrintModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                          title="طباعة سند الصرف الفردي"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 font-bold">
                <tr>
                  {(() => {
                    const beforeCols = ['id', 'date', 'projectName', 'supervisor', 'category', 'details'].filter(id => reportColumns.isVisible(id)).length;
                    const afterCols = ['invoiceNumber', 'status', 'actions'].filter(id => reportColumns.isVisible(id)).length;
                    return (
                      <>
                        {beforeCols > 0 && (
                          <td colSpan={beforeCols} className="p-3 text-right font-black text-slate-900 dark:text-white">
                            إجمالي السندات المعروضة ({Math.min(reportExpenses.length, 50)} من {reportExpenses.length}):
                          </td>
                        )}
                        {reportColumns.isVisible('amount') && (
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400 font-black whitespace-nowrap">
                            {reportExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} {settings.currencySymbol}
                          </td>
                        )}
                        {reportColumns.isVisible('taxAmount') && (
                          <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-black whitespace-nowrap">
                            {reportExpenses.reduce((sum, e) => sum + (e.taxAmount || 0), 0).toLocaleString()} {settings.currencySymbol}
                          </td>
                        )}
                        {afterCols > 0 && <td colSpan={afterCols}></td>}
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            لا توجد سندات مصروفات مطابقة لمعايير الفلتر الحالية
          </div>
        )}
      </div>

      {/* 7. Save Custom Report Preset Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <BookmarkPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    حفظ الفلتر كتقرير جاهز للاستخدام السريع
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    سيتم حفظ الإعدادات والفلاتر الحالية لفتحها لاحقاً بضغطة زر واحدة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCurrentFilter} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم التقرير <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مصروفات مشروع الرياض - م. أحمد"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وصف مختصر (اختياري):
                </label>
                <input
                  type="text"
                  placeholder="مثال: التقرير الأسبوعي لمتابعة بنود المواد الخام"
                  value={newPresetDesc}
                  onChange={e => setNewPresetDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              {/* Color Tag Selection */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  لون تمييز التقرير:
                </label>
                <div className="flex items-center gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewPresetColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        newPresetColor === c ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Summary of what will be saved */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                <div className="font-bold text-slate-800 dark:text-slate-200">ملخص معايير التقرير الحالية:</div>
                <div>• المشروع: {selectedProjectId === 'all' ? 'كافة المشاريع' : projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId}</div>
                <div>• المشرف: {selectedSupervisor === 'all' ? 'كافة المشرفين' : supervisorsList.find(s => s.email === selectedSupervisor)?.name || selectedSupervisor}</div>
                <div>• البند: {selectedCategory === 'all' ? 'كافة البنود' : selectedCategory}</div>
                <div>• الفترة: {datePreset === 'all' ? 'كافة الفترات' : datePreset}</div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  حفظ التقرير في القائمة
                </button>
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseArchiveCriteria, ArchivedExpense, Project } from '../../types';
import { AttachmentArchiver } from '../../services/attachmentArchiver';
import {
  Archive,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Zap,
  HardDrive,
  Database,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  Info,
  Briefcase,
  CheckCircle,
  FolderCheck,
  Building2,
  Clock,
  Download,
  FileArchive,
  Paperclip,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon
} from 'lucide-react';

export const ExpenseArchiveManager: React.FC = () => {
  const {
    expenses,
    projects,
    settings,
    archivedExpenses,
    archiveExpenses,
    restoreArchivedExpenses,
    deleteArchivedExpensesPermanently,
    exportArchivedExpensesToExcel,
    updateProject,
    confirmAction,
    showAlert,
    currentUserRole
  } = useApp();

  // Current year start as default (e.g. 2026-01-01)
  const currentYear = new Date().getFullYear();
  const defaultFiscalStart = `${currentYear}-01-01`;

  // Archive Target Strategy: 'by_date' (dates/fiscal years) | 'completed_projects' (finished projects) | 'specific_project'
  const [archiveMode, setArchiveMode] = useState<'by_date' | 'completed_projects' | 'specific_project'>('by_date');

  // Criteria State for Date Mode
  const [beforeDate, setBeforeDate] = useState<string>(defaultFiscalStart);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [onlyApproved, setOnlyApproved] = useState<boolean>(true);
  
  // Attachment Handling Strategy:
  // 'keep_all': Archive with all documents and attachments intact (Default & Recommended)
  // 'download_then_strip': Requires generating direct download link and downloading ZIP first with document names, then strips
  const [attachmentHandling, setAttachmentHandling] = useState<'keep_all' | 'download_then_strip'>('keep_all');
  const [downloadedAttachmentsPackage, setDownloadedAttachmentsPackage] = useState<boolean>(false);
  const [isGeneratingPackage, setIsGeneratingPackage] = useState<boolean>(false);
  const [attachmentPackageInfo, setAttachmentPackageInfo] = useState<{
    fileName: string;
    filesCount: number;
    downloadUrl: string;
  } | null>(null);

  const [isArchiving, setIsArchiving] = useState<boolean>(false);
  const [archiveFeedback, setArchiveFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Completed & Terminated Projects Archive Options
  const [archiveProjectCardToo, setArchiveProjectCardToo] = useState<boolean>(true);
  const [includeStoppedProjects, setIncludeStoppedProjects] = useState<boolean>(false);

  // List of all completed/finished projects in system
  const completedProjects = useMemo(() => {
    if (includeStoppedProjects) {
      return projects.filter(p => p.status === 'مكتمل' || p.status === 'متوقف');
    }
    return projects.filter(p => p.status === 'مكتمل');
  }, [projects, includeStoppedProjects]);

  // Selected completed projects for archiving (defaults to all completed projects)
  const [selectedCompletedProjectNames, setSelectedCompletedProjectNames] = useState<string[]>([]);

  // Project statistics map for fast lookup
  const projectStats = useMemo(() => {
    const stats: Record<string, { count: number; approvedCount: number; amount: number; approvedAmount: number }> = {};
    expenses.forEach(e => {
      const pName = e.projectName;
      if (!stats[pName]) {
        stats[pName] = { count: 0, approvedCount: 0, amount: 0, approvedAmount: 0 };
      }
      stats[pName].count += 1;
      stats[pName].amount += e.amount;
      if (e.status === 'معتمد') {
        stats[pName].approvedCount += 1;
        stats[pName].approvedAmount += e.amount;
      }
    });
    return stats;
  }, [expenses]);

  // Archive Table Management State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<string[]>([]);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Calculate qualifying active expenses based on active mode & criteria
  const qualifyingExpenses = useMemo(() => {
    return expenses.filter(e => {
      // 1. Completed Projects Mode
      if (archiveMode === 'completed_projects') {
        // If specific completed projects are checked, use them; otherwise all completed projects
        const targetProjects = selectedCompletedProjectNames.length > 0
          ? selectedCompletedProjectNames
          : completedProjects.map(p => p.name);
        
        const matchesProject = targetProjects.includes(e.projectName) || (e.projectId && targetProjects.includes(e.projectId));
        if (!matchesProject) return false;

        if (onlyApproved && e.status !== 'معتمد') return false;
        return true;
      }

      // 2. Specific Project Mode
      if (archiveMode === 'specific_project') {
        if (selectedProject === 'all') return false;
        const matchesProject = e.projectName === selectedProject || e.projectId === selectedProject;
        if (!matchesProject) return false;
        if (beforeDate && (e.date || '').slice(0, 10) >= beforeDate) return false;
        if (onlyApproved && e.status !== 'معتمد') return false;
        return true;
      }

      // 3. Date / Fiscal Year Range Mode
      if (beforeDate && (e.date || '').slice(0, 10) >= beforeDate) return false;
      if (onlyApproved && e.status !== 'معتمد') return false;
      if (selectedProject !== 'all' && e.projectName !== selectedProject && e.projectId !== selectedProject) return false;
      return true;
    });
  }, [expenses, archiveMode, selectedCompletedProjectNames, completedProjects, beforeDate, onlyApproved, selectedProject]);

  const qualifyingAmount = useMemo(() => {
    return qualifyingExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [qualifyingExpenses]);

  // Qualifying expenses that have documents / invoice attachments
  const qualifyingWithAttachments = useMemo(() => {
    return qualifyingExpenses.filter(e => Boolean(e.invoicePhoto && e.invoicePhoto.trim().length > 0));
  }, [qualifyingExpenses]);

  // Handler for creating & downloading the attachments ZIP package before archiving
  const handleGenerateAndDownloadAttachmentsPackage = async () => {
    if (qualifyingWithAttachments.length === 0) {
      showAlert('لا توجد مرفقات', 'السندات المطابقة لا تحتوي على أي ملفات أو فواتير مرفقة لتنزيلها.', 'info');
      return;
    }

    setIsGeneratingPackage(true);
    try {
      let archiveTitle = 'مرفقات_المصروفات_المؤرشفة';
      if (archiveMode === 'completed_projects') {
        const count = selectedCompletedProjectNames.length > 0 ? selectedCompletedProjectNames.length : completedProjects.length;
        archiveTitle = `مشاريع_منتهية_${count}_مشروع`;
      } else if (archiveMode === 'specific_project') {
        archiveTitle = `مشروع_${selectedProject}`;
      } else {
        archiveTitle = `سندات_قبل_${beforeDate || 'التاريخ'}`;
      }

      const res = await AttachmentArchiver.downloadBatchExpensesAttachmentsZip(
        qualifyingWithAttachments,
        archiveTitle
      );

      setDownloadedAttachmentsPackage(true);
      setAttachmentPackageInfo({
        fileName: res.fileName,
        filesCount: res.filesCount,
        downloadUrl: res.downloadUrl,
      });

      showAlert(
        'تم إنشاء وتنزيل حزمة المرفقات بنجاح',
        `تم ضغط وتنزيل (${res.filesCount}) مستند مرفق بأسماء السندات والمستندات في الملف (${res.fileName}). الرابط متاح للتنزيل مجدداً، ويمكنك الآن متابعة الأرشفة بأمان.`,
        'success'
      );
    } catch (err) {
      console.error('Error generating attachments package:', err);
      showAlert('فشل التنزيل', 'حدث خطأ أثناء تجميع وضغط المرفقات، يرجى المحاولة ثانية.', 'error');
    } finally {
      setIsGeneratingPackage(false);
    }
  };

  const totalActiveAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const totalArchivedAmount = useMemo(() => {
    return archivedExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [archivedExpenses]);

  // Total active expenses in completed projects
  const totalCompletedProjectsExpensesCount = useMemo(() => {
    const completedNames = completedProjects.map(p => p.name);
    return expenses.filter(e => completedNames.includes(e.projectName) || (e.projectId && completedProjects.some(cp => cp.id === e.projectId))).length;
  }, [expenses, completedProjects]);

  const totalCompletedProjectsExpensesAmount = useMemo(() => {
    const completedNames = completedProjects.map(p => p.name);
    return expenses
      .filter(e => completedNames.includes(e.projectName) || (e.projectId && completedProjects.some(cp => cp.id === e.projectId)))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, completedProjects]);

  // Filter archived expenses for display in the table
  const filteredArchived = useMemo(() => {
    let list = [...archivedExpenses];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e => 
        e.id.toLowerCase().includes(q) ||
        e.projectName.toLowerCase().includes(q) ||
        e.supervisorName.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q) ||
        (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(q))
      );
    }
    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [archivedExpenses, searchQuery]);

  // Set Preset Date
  const applyPreset = (preset: 'fiscal_year' | 'six_months' | 'one_year' | 'two_years' | 'completed_projects') => {
    if (preset === 'completed_projects') {
      setArchiveMode('completed_projects');
      setSelectedCompletedProjectNames([]);
      return;
    }
    setArchiveMode('by_date');
    const now = new Date();
    if (preset === 'fiscal_year') {
      setBeforeDate(`${now.getFullYear()}-01-01`);
    } else if (preset === 'six_months') {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      setBeforeDate(d.toISOString().slice(0, 10));
    } else if (preset === 'one_year') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      setBeforeDate(d.toISOString().slice(0, 10));
    } else if (preset === 'two_years') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 2);
      setBeforeDate(d.toISOString().slice(0, 10));
    }
  };

  // Toggle completed project selection
  const handleToggleCompletedProject = (projectName: string) => {
    setSelectedCompletedProjectNames(prev => {
      // If currently all were implicitly selected (empty array), explicit check starts with all except clicked
      const currentList = prev.length === 0 ? completedProjects.map(p => p.name) : prev;
      if (currentList.includes(projectName)) {
        return currentList.filter(n => n !== projectName);
      } else {
        return [...currentList, projectName];
      }
    });
  };

  const handleSelectAllCompletedProjects = () => {
    if (selectedCompletedProjectNames.length === completedProjects.length) {
      setSelectedCompletedProjectNames([]);
    } else {
      setSelectedCompletedProjectNames(completedProjects.map(p => p.name));
    }
  };

  // Handle Archive Execution
  const handleExecuteArchive = () => {
    if (qualifyingExpenses.length === 0) {
      showAlert('لا توجد سندات مطابقة', 'لا توجد أي مصروفات نشطة تطابق المعايير والمشاريع المحددة للأرشفة.', 'warning');
      return;
    }

    // Safety enforcement: If user chose to strip attachments after downloading, require generating and downloading link first!
    if (attachmentHandling === 'download_then_strip' && qualifyingWithAttachments.length > 0 && !downloadedAttachmentsPackage) {
      showAlert(
        'مطلوب تنزيل رابط المرفقات أولاً',
        `تنبيه حماية البيانات: يوجد (${qualifyingWithAttachments.length}) سند يحتوي على مستندات وفواتير مرفقة. لحماية ملفاتك من الفقدان، لا يتم تنفيذ الأرشفة إلا بعد إنشاء وتنزيل رابط المرفقات مكودة بأسماء السندات، أو تفعيل خيار "الأرشفة مع كامل المستندات والمرفقات".`,
        'warning'
      );
      return;
    }

    let targetTitle = 'تأكيد أرشفة المصروفات التاريخية';
    let targetDesc = '';

    if (archiveMode === 'completed_projects') {
      const targetCount = selectedCompletedProjectNames.length > 0 ? selectedCompletedProjectNames.length : completedProjects.length;
      targetTitle = 'تأكيد أرشفة مصروفات المشاريع المنتهية (المكتملة)';
      targetDesc = `هل أنت متأكد من أرشفة (${qualifyingExpenses.length}) سند مصروف بإجمالي (${qualifyingAmount.toLocaleString()} ${settings.currencySymbol || 'ر.س'}) تخص (${targetCount}) مشروع منتهي ومكتمل؟`;
    } else if (archiveMode === 'specific_project') {
      targetTitle = `تأكيد أرشفة مصروفات مشروع "${selectedProject}"`;
      targetDesc = `هل أنت متأكد من أرشفة (${qualifyingExpenses.length}) سند مصروف بإجمالي (${qualifyingAmount.toLocaleString()} ${settings.currencySymbol || 'ر.س'}) لمشروع "${selectedProject}"؟`;
    } else {
      targetDesc = `هل أنت متأكد من نقل (${qualifyingExpenses.length}) سند مصروف مؤرخة قبل (${beforeDate}) بإجمالي (${qualifyingAmount.toLocaleString()} ${settings.currencySymbol || 'ر.س'}) إلى الأرشيف المنفصل؟`;
    }

    const attachmentNote = qualifyingWithAttachments.length > 0
      ? (attachmentHandling === 'keep_all'
          ? `\n\n📁 خيار المرفقات: تم اختيار "الأرشفة مع كامل المستندات والمرفقات" — سيتم الحفاظ على (${qualifyingWithAttachments.length}) مستند ومرفق داخل الأرشيف دون أي حذف.`
          : `\n\n📥 خيار المرفقات: تم تنزيل حزمة المرفقات (${qualifyingWithAttachments.length} مستند مكود باسم السند والمستند) وسيتم تجريد الصور لتوفير المساحة.`)
      : '\n\n(لا توجد مرفقات بالسندات المحددة).';

    confirmAction({
      title: targetTitle,
      message: `${targetDesc}${attachmentNote}\n\nستتم إزالة هذه السندات من الشاشات التشغيلية النشطة وقاعدة البيانات الرئيسية لتسريع الأداء مع إمكانية مراجعتها أو استعادتها أو تصديرها لإكسل في أي وقت.`,
      confirmText: 'نعم، أرشفة السندات الآن',
      cancelText: 'إلغاء',
      type: 'warning',
      onConfirm: async () => {
        setIsArchiving(true);
        setArchiveFeedback(null);
        try {
          let criteria: ExpenseArchiveCriteria;

          const isStripping = attachmentHandling === 'download_then_strip';
          const isKeeping = attachmentHandling === 'keep_all';

          if (archiveMode === 'completed_projects') {
            const projectNames = selectedCompletedProjectNames.length > 0 
              ? selectedCompletedProjectNames 
              : completedProjects.map(p => p.name);

            criteria = {
              mode: 'completed_projects',
              projectIds: projectNames,
              onlyApproved,
              stripAttachments: isStripping,
              keepAttachments: isKeeping,
              reason: `أرشفة مشاريع مكتملة (${projectNames.length} مشروع) بواسطة ${currentUserRole?.name || 'مدير النظام'}`
            };
          } else if (archiveMode === 'specific_project') {
            criteria = {
              mode: 'before_date',
              beforeDate: beforeDate || undefined,
              projectIds: [selectedProject],
              onlyApproved,
              stripAttachments: isStripping,
              keepAttachments: isKeeping,
              reason: `أرشفة مشروع ${selectedProject} بواسطة ${currentUserRole?.name || 'مدير النظام'}`
            };
          } else {
            criteria = {
              mode: 'before_date',
              beforeDate: beforeDate || undefined,
              onlyApproved,
              projectIds: selectedProject !== 'all' ? [selectedProject] : undefined,
              stripAttachments: isStripping,
              keepAttachments: isKeeping,
              reason: `أرشفة دورية بواسطة ${currentUserRole?.name || 'مدير النظام'}`
            };
          }

          const res = await archiveExpenses(criteria);
          if (res.success) {
            let archivedProjectsCount = 0;
            if (archiveMode === 'completed_projects' && archiveProjectCardToo) {
              const projectNames = selectedCompletedProjectNames.length > 0 
                ? selectedCompletedProjectNames 
                : completedProjects.map(p => p.name);
              
              const matchedProjects = projects.filter(p => projectNames.includes(p.name));
              for (const proj of matchedProjects) {
                if (proj.status !== 'مؤرشف') {
                  try {
                    await updateProject(proj.id, { ...proj, status: 'مؤرشف' });
                    archivedProjectsCount++;
                  } catch (pErr) {
                    console.warn(`[Archive] Could not update project ${proj.name}:`, pErr);
                  }
                }
              }
            }

            setArchiveFeedback({
              type: 'success',
              message: `تم بنجاح أرشفة (${res.count}) سند مصروف بقيمة إجمالية (${res.amount.toLocaleString()} ${settings.currencySymbol || 'ر.س'}).${archivedProjectsCount > 0 ? ` وتم أيضاً نقل (${archivedProjectsCount}) مشروع إلى الأرشيف وتحويل حالته إلى "مؤرشف".` : ''} تم تخفيف حجم قاعدة البيانات وتسريع الأداء.`
            });
            setTimeout(() => setArchiveFeedback(null), 8000);
          } else {
            setArchiveFeedback({
              type: 'info',
              message: res.message || 'لم تتم أرشفة أي سندات.'
            });
          }
        } catch {
          setArchiveFeedback({
            type: 'error',
            message: 'حدث خطأ أثناء محاولة أرشفة المصروفات.'
          });
        } finally {
          setIsArchiving(false);
        }
      }
    });
  };

  // Restore Selected
  const handleRestoreSelected = () => {
    if (selectedArchivedIds.length === 0) {
      showAlert('تحديد السندات', 'يرجى تحديد سند واحد على الأقل لاستعادته.', 'info');
      return;
    }

    confirmAction({
      title: 'استعادة السندات من الأرشيف',
      message: `هل أنت متأكد من استعادة (${selectedArchivedIds.length}) سند مصروف من الأرشيف وإعادتها إلى قائمة المصروفات النشطة والشاشات الرئيسية؟`,
      confirmText: 'نعم، استعادة السندات',
      cancelText: 'إلغاء',
      type: 'warning',
      onConfirm: async () => {
        setIsRestoring(true);
        try {
          const res = await restoreArchivedExpenses(selectedArchivedIds);
          if (res.success) {
            setSelectedArchivedIds([]);
            showAlert('تمت الاستعادة بنجاح', `تمت استعادة (${res.count}) سند مصروف إلى القائمة النشطة بنجاح.`, 'success');
          }
        } catch {
          showAlert('خطأ في الاستعادة', 'حدث خطأ أثناء استعادة السندات المؤرشفة.', 'error');
        } finally {
          setIsRestoring(false);
        }
      }
    });
  };

  // Delete Permanently
  const handleDeletePermanently = () => {
    if (selectedArchivedIds.length === 0) {
      showAlert('تحديد السندات', 'يرجى تحديد سند واحد على الأقل لحذفه.', 'info');
      return;
    }

    confirmAction({
      title: 'حذف نهائي لا رجعة فيه',
      message: `تحذير: هل أنت متأكد من حذف (${selectedArchivedIds.length}) سند من الأرشيف نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`,
      confirmText: 'نعم، حذف نهائي',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const res = await deleteArchivedExpensesPermanently(selectedArchivedIds);
          if (res.success) {
            setSelectedArchivedIds([]);
            showAlert('تم الحذف النهائي', `تم حذف (${res.count}) سند من الأرشيف نهائياً.`, 'success');
          }
        } catch {
          showAlert('خطأ في الحذف', 'تعذر حذف السندات المحددة من الأرشيف.', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  // Select all toggler
  const handleToggleSelectAll = () => {
    if (selectedArchivedIds.length === filteredArchived.length) {
      setSelectedArchivedIds([]);
    } else {
      setSelectedArchivedIds(filteredArchived.map(e => e.id));
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedArchivedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* 1. Header Banner & Performance Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>تسريع أداء قاعدة البيانات والشاشات بنسبة تصل إلى 80%</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <Archive className="w-6 h-6 text-emerald-400" />
              <span>أرشفة المصروفات والمشاريع والسنوات السابقة</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              تتيح لك هذه الميزة نقل السندات والمصروفات القديمة المنتهية ومصروفات المشاريع المكتملة من قاعدة البيانات التشغيلية النشطة إلى أرشيف سحابي ومحلي منفصل، مما يقلل استهلاك حصص وحجم Firestore، ويمنع بطء الشاشات والتقارير عند تضخم البيانات.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
              <span className="text-[11px] text-slate-300 block font-medium">المصروفات النشطة</span>
              <span className="text-xl font-black text-white font-mono">{expenses.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                {totalActiveAmount.toLocaleString()} {settings.currencySymbol || 'ر.س'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 text-center">
              <span className="text-[11px] text-indigo-300 block font-medium">مشاريع منتهية</span>
              <span className="text-xl font-black text-indigo-300 font-mono">{completedProjects.length}</span>
              <span className="text-[10px] text-indigo-200/80 block mt-0.5 font-mono">
                {totalCompletedProjectsExpensesCount} سند ({totalCompletedProjectsExpensesAmount.toLocaleString()} {settings.currencySymbol || 'ر.س'})
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-emerald-300 block font-medium">المصروفات المؤرشفة</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{archivedExpenses.length}</span>
              <span className="text-[10px] text-emerald-300/80 block mt-0.5 font-mono">
                {totalArchivedAmount.toLocaleString()} {settings.currencySymbol || 'ر.س'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {archiveFeedback && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in ${
          archiveFeedback.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : archiveFeedback.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {archiveFeedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {archiveFeedback.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            {archiveFeedback.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <span>{archiveFeedback.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setArchiveFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* 2. Archiving Wizard & Strategy Selection */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        
        {/* Mode Selector Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>طريقة ومعايير أرشفة المصروفات</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              اختر نوع الأرشفة: حسب المشاريع المنتهية والمكتملة، أو حسب التاريخ والسنوات المالية.
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setArchiveMode('completed_projects')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                archiveMode === 'completed_projects'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <FolderCheck className="w-4 h-4" />
              <span>أرشفة المشاريع المنتهية</span>
              {completedProjects.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                  archiveMode === 'completed_projects' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {completedProjects.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setArchiveMode('by_date')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                archiveMode === 'by_date'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>حسب التاريخ والسنوات</span>
            </button>

            <button
              type="button"
              onClick={() => setArchiveMode('specific_project')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                archiveMode === 'specific_project'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>مشروع مخصص</span>
            </button>
          </div>
        </div>

        {/* --- OPTION A: COMPLETED PROJECTS ARCHIVE --- */}
        {archiveMode === 'completed_projects' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
                  <FolderCheck className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>أرشفة مصروفات المشاريع المنتهية (المكتملة)</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 text-xs font-mono font-bold">
                      {completedProjects.length} مشروع منتهي
                    </span>
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    نقل كافة السندات والفواتير التابعة للمشاريع التي تم إنجازها وتغيير حالتها إلى "مكتمل" لإخفائها من الشاشات التشغيلية وحفظها في الأرشيف.
                  </p>
                </div>
              </div>

              {completedProjects.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllCompletedProjects}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  {selectedCompletedProjectNames.length === completedProjects.length || selectedCompletedProjectNames.length === 0 ? (
                    <>
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                      <span>تحديد كافة المشاريع المنتهية</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 text-slate-400" />
                      <span>تحديد الكل ({completedProjects.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Completed Projects Grid / Cards */}
            {completedProjects.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
                <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  لا توجد مشاريع بحالة "مكتمل" حالياً
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  يمكنك تحويل حالة أي مشروع انتهت أعماله إلى "مكتمل" من شاشة <strong>المشاريع والمواقع</strong> ليظهر هنا تلقائياً، أو يمكنك استخدام خيار <strong>مشروع مخصص</strong> لأرشفة أي مشروع مباشرة.
                </p>
                <button
                  type="button"
                  onClick={() => setArchiveMode('specific_project')}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>الانتقال لأرشفة مشروع محدد يدوياً</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                  <span>حدد المشاريع المنتهية المراد نقل مصروفاتها إلى الأرشيف:</span>
                  <span>
                    (المحدد: {selectedCompletedProjectNames.length === 0 ? completedProjects.length : selectedCompletedProjectNames.length} من {completedProjects.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {completedProjects.map(proj => {
                    const isSelected = selectedCompletedProjectNames.length === 0 || selectedCompletedProjectNames.includes(proj.name);
                    const stats = projectStats[proj.name] || { count: 0, amount: 0, approvedCount: 0, approvedAmount: 0 };
                    
                    return (
                      <div
                        key={proj.id}
                        onClick={() => handleToggleCompletedProject(proj.name)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-700 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                              isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <h6 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                {proj.name}
                              </h6>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                كود: {proj.code} {proj.clientName ? `• ${proj.clientName}` : ''}
                              </span>
                            </div>
                          </div>

                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold shrink-0">
                            مكتمل
                          </span>
                        </div>

                        {/* Project Expense Summary */}
                        <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">
                            السندات النشطة: <strong className="text-slate-800 dark:text-slate-200 font-mono">{stats.count}</strong>
                          </span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {stats.amount.toLocaleString()} {settings.currencySymbol || 'ر.س'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Projects Options */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-start sm:items-center gap-2.5 cursor-pointer text-xs font-bold text-indigo-950 dark:text-indigo-100">
                  <input
                    type="checkbox"
                    checked={archiveProjectCardToo}
                    onChange={(e) => setArchiveProjectCardToo(e.target.checked)}
                    className="w-4 h-4 mt-0.5 sm:mt-0 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                  <div>
                    <span>أرشفة بطاقات وسجلات المشاريع المحددة بالكامل أيضاً</span>
                    <span className="block text-[11px] font-normal text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                      تحويل حالة هذه المشاريع إلى "مؤرشف" وإخفائها تلقائياً من قائمة المشاريع النشطة اليومية لتنظيم واجهات العمل.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  <input
                    type="checkbox"
                    checked={includeStoppedProjects}
                    onChange={(e) => setIncludeStoppedProjects(e.target.checked)}
                    className="w-4 h-4 rounded text-slate-600 focus:ring-slate-500 cursor-pointer"
                  />
                  <span>إظهار المشاريع المتوقفة أيضاً</span>
                </label>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={onlyApproved}
                    onChange={(e) => setOnlyApproved(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>أرشفة السندات المعتمدة فقط من المشاريع المنتهية (موصى به)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* --- OPTION B: DATE & FISCAL YEARS ARCHIVE --- */}
        {archiveMode === 'by_date' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold ml-1">فترات سريعة:</span>
              <button
                type="button"
                onClick={() => applyPreset('fiscal_year')}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                title={`أرشفة ما قبل بداية السنة المالية الحالية (${currentYear})`}
              >
                قبل سنة {currentYear}
              </button>
              <button
                type="button"
                onClick={() => applyPreset('one_year')}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                أقدم من سنة
              </button>
              <button
                type="button"
                onClick={() => applyPreset('six_months')}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                أقدم من 6 أشهر
              </button>
              <button
                type="button"
                onClick={() => applyPreset('completed_projects')}
                className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-300 text-xs font-bold transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer flex items-center gap-1 mr-auto"
              >
                <FolderCheck className="w-3.5 h-3.5" />
                <span>المشاريع المنتهية ({completedProjects.length})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Before Date Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>أرشفة كافة المصروفات المؤرخة قبل تاريخ:</span>
                </label>
                <input
                  type="date"
                  value={beforeDate}
                  onChange={(e) => setBeforeDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:outline-emerald-500"
                />
                <p className="text-[10px] text-slate-400">
                  سيتم نقل السندات التي تاريخها يسبق هذا اليوم.
                </p>
              </div>

              {/* Project Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تخصيص لمشروع محدد (اختياري):</span>
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-emerald-500"
                >
                  <option value="all">كافة المشاريع والمواقع</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name} {p.status === 'مكتمل' ? '(مكتمل)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  يمكنك تركها لكافة المشاريع أو حصرها بمشروع معين.
                </p>
              </div>

              {/* Options & Flags */}
              <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={onlyApproved}
                    onChange={(e) => setOnlyApproved(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>أرشفة السندات المعتمدة فقط (موصى به)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* --- OPTION C: SPECIFIC PROJECT ARCHIVE --- */}
        {archiveMode === 'specific_project' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                  <span>اختر المشروع المراد أرشفة كافة مصروفاته:</span>
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-emerald-500"
                >
                  <option value="all">-- يرجى اختيار المشروع --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.status}) - {p.code}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  اختر المشروع لنقل كافة سنداته ومصروفاته المسجلة إلى الأرشيف.
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={onlyApproved}
                    onChange={(e) => setOnlyApproved(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>أرشفة السندات المعتمدة فقط (موصى به)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* --- DEDICATED ATTACHMENTS HANDLING & LINK GENERATION SECTION --- */}
        {qualifyingExpenses.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-50 via-emerald-50/20 to-slate-50 dark:from-slate-800/60 dark:via-emerald-950/20 dark:to-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Paperclip className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>خيارات المستندات والمرفقات المصاحبة للأرشفة</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
                      {qualifyingWithAttachments.length} سند بمرفقات
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    حدد طريقة التعامل مع ملفات الفواتير والمستندات قبل نقل السندات إلى الأرشيف
                  </p>
                </div>
              </div>

              {qualifyingWithAttachments.length > 0 && (
                <button
                  type="button"
                  onClick={handleGenerateAndDownloadAttachmentsPackage}
                  disabled={isGeneratingPackage}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto"
                  title="تنزيل حزمة ZIP لكافة المستندات والمرفقات بأسماء السندات"
                >
                  {isGeneratingPackage ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>تنزيل حزمة المرفقات (ZIP)</span>
                </button>
              )}
            </div>

            {/* Two Choices Radio Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: Keep All Attachments */}
              <div
                onClick={() => setAttachmentHandling('keep_all')}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  attachmentHandling === 'keep_all'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  id="opt_keep_all"
                  name="attachment_handling"
                  checked={attachmentHandling === 'keep_all'}
                  onChange={() => setAttachmentHandling('keep_all')}
                  className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="opt_keep_all" className="space-y-1 cursor-pointer">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>الأرشفة مع كامل المستندات والمرفقات (موصى به)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    يتم حفظ كافة صور الفواتير والمستندات الأصلية داخل الأرشيف المنفصل، بحيث تظل متوفرة للاستعراض والتحميل والاسترجاع في أي وقت دون حذف أي ملف.
                  </p>
                </label>
              </div>

              {/* Option 2: Download link first, then strip */}
              <div
                onClick={() => setAttachmentHandling('download_then_strip')}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  attachmentHandling === 'download_then_strip'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  id="opt_download_then_strip"
                  name="attachment_handling"
                  checked={attachmentHandling === 'download_then_strip'}
                  onChange={() => setAttachmentHandling('download_then_strip')}
                  className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="opt_download_then_strip" className="space-y-1 cursor-pointer">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>إنشاء رابط وتنزيل المرفقات بأسماء المستندات أولاً ثم التجريد</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    لا تتم الأرشفة إلا بعد إنشاء وتنزيل رابط المرفقات مسمّاة بأرقام وأسماء السندات، مع إزالة المرفقات من السحابة بعد التنزيل لتوفير مساحة التخزين.
                  </p>
                </label>
              </div>
            </div>

            {/* Dynamic Link & Enforcement Status Banner when Option 2 is selected */}
            {attachmentHandling === 'download_then_strip' && qualifyingWithAttachments.length > 0 && (
              <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                downloadedAttachmentsPackage
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    {downloadedAttachmentsPackage ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-emerald-900 dark:text-emerald-200">
                          تم إنشاء وتنزيل حزمة المرفقات بنجاح ({attachmentPackageInfo?.filesCount} مستند مكود باسم السند)
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-amber-900 dark:text-amber-200">
                          تنبيه أمان: يلزم إنشاء وتنزيل رابط المرفقات أولاً قبل تفعيل الأرشفة
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {downloadedAttachmentsPackage ? (
                      <span>
                        اسم الحزمة المنزلة: <code className="font-mono font-bold text-emerald-800 dark:text-emerald-300">{attachmentPackageInfo?.fileName}</code> • كل ملف مسمى برقم السند واسم المشروع.
                      </span>
                    ) : (
                      <span>
                        كل ملف مرفق سينزل باسم: <code className="font-mono text-emerald-700 dark:text-emerald-300">مستند_سند_[رقم_السند]_[اسم_المشروع]_[رقم_الفاتورة].ext</code>
                      </span>
                    )}
                  </p>
                  {attachmentPackageInfo?.downloadUrl && (
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">رابط التحميل المباشر:</span>
                      <a
                        href={attachmentPackageInfo.downloadUrl}
                        download={attachmentPackageInfo.fileName}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>تحميل الحزمة مرة أخرى ({attachmentPackageInfo.fileName})</span>
                      </a>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAndDownloadAttachmentsPackage}
                  disabled={isGeneratingPackage}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-sm ${
                    downloadedAttachmentsPackage
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 border border-slate-300 dark:border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                  {isGeneratingPackage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري تجميع الملفات...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {downloadedAttachmentsPackage ? 'إعادة تنزيل الحزمة (ZIP)' : 'إنشاء رابط وتنزيل المرفقات الآن'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live Matching Summary & Action */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>السندات المطابقة للأرشفة:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-mono font-black text-xs">
                  {qualifyingExpenses.length} سند
                </span>
                {archiveMode === 'completed_projects' && completedProjects.length > 0 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    (من {selectedCompletedProjectNames.length > 0 ? selectedCompletedProjectNames.length : completedProjects.length} مشروع منتهي)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                إجمالي المبالغ المطابقة: <strong className="text-emerald-800 dark:text-emerald-300">{qualifyingAmount.toLocaleString()} {settings.currencySymbol || 'ر.س'}</strong>
                {expenses.length > 0 && ` (${Math.round((qualifyingExpenses.length / expenses.length) * 100)}% من السجلات النشطة)`}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={qualifyingExpenses.length === 0 || isArchiving}
            onClick={handleExecuteArchive}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0 ${
              attachmentHandling === 'download_then_strip' && qualifyingWithAttachments.length > 0 && !downloadedAttachmentsPackage
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md shadow-emerald-600/20'
            }`}
            title={
              attachmentHandling === 'download_then_strip' && qualifyingWithAttachments.length > 0 && !downloadedAttachmentsPackage
                ? 'يلزم تنزيل رابط المرفقات أولاً قبل الأرشفة'
                : undefined
            }
          >
            {isArchiving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري النقل للأرشيف...</span>
              </>
            ) : (
              <>
                {attachmentHandling === 'download_then_strip' && qualifyingWithAttachments.length > 0 && !downloadedAttachmentsPackage ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                <span>
                  {archiveMode === 'completed_projects'
                    ? `أرشفة مشاريع منتهية (${qualifyingExpenses.length} سند)`
                    : `تنفيذ أرشفة (${qualifyingExpenses.length}) سند الآن`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Archived Expenses Ledger & Records Management */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>سجل المصروفات المؤرشفة ({archivedExpenses.length} سند محفوظ)</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              يمكنك البحث في الأرشيف وتصديره لإكسل بالكامل أو استرجاع سندات محددة إلى النظام النشط عند الحاجة.
            </p>
          </div>

          {/* Archive Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={archivedExpenses.length === 0}
              onClick={exportArchivedExpensesToExcel}
              className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title="تصدير كافة السندات المؤرشفة إلى مصنف إكسل احترافي"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير الأرشيف (.xlsx)</span>
            </button>

            {selectedArchivedIds.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleRestoreSelected}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  title="استعادة السندات المحددة إلى المصروفات النشطة"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة ({selectedArchivedIds.length}) سند</span>
                </button>

                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeletePermanently}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  title="حذف السندات المحددة نهائياً من الأرشيف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف نهائي ({selectedArchivedIds.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search & Selection Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث في الأرشيف (رقم السند، المشروع، المشرف، البيان)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-emerald-500 font-bold"
            />
          </div>

          {filteredArchived.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-600 dark:text-slate-400">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 font-bold hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {selectedArchivedIds.length === filteredArchived.length ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>تحديد الكل ({filteredArchived.length})</span>
              </button>
              {selectedArchivedIds.length > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  (تم تحديد {selectedArchivedIds.length})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Archived Table */}
        {archivedExpenses.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <Archive className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">الأرشيف فارغ حالياً</h5>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              كافة المصروفات متواجدة حالياً في قاعدة البيانات النشطة. يمكنك استخدام خيار <strong>أرشفة المشاريع المنتهية</strong> أو تحديد التواريخ بالأعلى لتخفيف حجم النظام.
            </p>
          </div>
        ) : filteredArchived.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            لا توجد سندات في الأرشيف تطابق كلمة البحث "{searchQuery}".
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedArchivedIds.length === filteredArchived.length && filteredArchived.length > 0}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">رقم السند</th>
                    <th className="p-3">تاريخ السند</th>
                    <th className="p-3">المشروع</th>
                    <th className="p-3">المشرف</th>
                    <th className="p-3">البند والتصنيف</th>
                    <th className="p-3">البيان</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3 text-center">المرفق</th>
                    <th className="p-3">تاريخ الأرشفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredArchived.map(exp => {
                    const isSelected = selectedArchivedIds.includes(exp.id);
                    return (
                      <tr 
                        key={exp.id} 
                        className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                          isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                        }`}
                        onClick={() => handleToggleItem(exp.id)}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleItem(exp.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {exp.id}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {exp.date}
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          {exp.projectName}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {exp.supervisorName}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {exp.category}
                        </td>
                        <td className="p-3 text-slate-800 dark:text-slate-200 max-w-xs truncate" title={exp.details}>
                          {exp.details}
                        </td>
                        <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {exp.amount.toLocaleString()} {settings.currencySymbol || 'ر.س'}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {exp.invoicePhoto ? (
                            <button
                              type="button"
                              onClick={() => AttachmentArchiver.downloadSingleDocumentAttachment(exp)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer border border-emerald-200 dark:border-emerald-800/60"
                              title="تنزيل المرفق باسم السند والمستند"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>تنزيل</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-[11px] font-mono">-</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {exp.archivedAt ? new Date(exp.archivedAt).toLocaleDateString('ar-SA') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

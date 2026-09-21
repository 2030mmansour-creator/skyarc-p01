import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { PCloudService } from '../../services/pcloudService';
import { PCloudItem, PCloudFolderResult, ExpenseAttachment } from '../../types';
import {
  Cloud,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  FileText,
  Search,
  RefreshCw,
  Check,
  CheckCircle2,
  X,
  ExternalLink,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  AlertCircle,
  Link2,
  Download,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  Maximize2,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  ArrowUpDown,
  SlidersHorizontal
} from 'lucide-react';

interface PCloudMediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAttachments: (attachments: ExpenseAttachment[]) => void;
  initialLink?: string;
  projectId?: string;
  allowMultiple?: boolean;
  filterType?: 'all' | 'images' | 'pdfs';
  title?: string;
}

interface BreadcrumbItem {
  id: number | string;
  name: string;
}

export type PCloudDateFilter = 'all' | 'today' | 'week' | 'custom';
export type PCloudSortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

/**
 * Parses pCloud creation or modification date into a JavaScript Date object
 */
export const parsePCloudDate = (item: PCloudItem): Date | null => {
  const raw = item.created || item.modified;
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') {
    return new Date(raw < 1e11 ? raw * 1000 : raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return new Date(num < 1e11 ? num * 1000 : num);
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
    const withT = new Date(trimmed.replace(' ', 'T'));
    if (!isNaN(withT.getTime())) return withT;
  }
  return null;
};

/**
 * Formats pCloud item date into a readable string (YYYY-MM-DD HH:mm)
 */
export const formatFileDate = (item: PCloudItem): string | null => {
  const d = parsePCloudDate(item);
  if (!d) return null;
  try {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return null;
  }
};

/**
 * Formats relative date for quick scanning (e.g. اليوم، منذ ساعتين، أمس)
 */
export const formatRelativeDate = (item: PCloudItem): string | null => {
  const d = parsePCloudDate(item);
  if (!d) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return diffMins <= 1 ? 'الآن' : `منذ ${diffMins} د`;
  if (diffHours < 24) return `منذ ${diffHours} س`;
  if (diffDays === 1) return 'أمس';
  if (diffDays > 1 && diffDays < 7) return `منذ ${diffDays} أيام`;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const PCloudMediaPickerModal: React.FC<PCloudMediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectAttachments,
  initialLink,
  projectId,
  allowMultiple = true,
  filterType: initialFilterType = 'all',
  title = 'اختيار الصور والمستندات من مجلد pCloud المشترك'
}) => {
  const { settings, projects, updateSettings, showAlert } = useApp();

  // Find project pCloud link if available, fallback to settings default
  const project = useMemo(() => {
    return projects.find(p => p.id === projectId);
  }, [projects, projectId]);

  const defaultLink = useMemo(() => {
    return (
      initialLink ||
      project?.pcloudPublicFolderUrl ||
      settings.pcloudPublicFolderUrl ||
      ''
    );
  }, [initialLink, project, settings.pcloudPublicFolderUrl]);

  const [publicLink, setPublicLink] = useState<string>(defaultLink);
  const [activeCode, setActiveCode] = useState<string>('');
  const [activeRegion, setActiveRegion] = useState<'us' | 'eu'>('us');
  const [folderData, setFolderData] = useState<PCloudFolderResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Navigation & Filtering
  const [currentFolderId, setCurrentFolderId] = useState<number | string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'images' | 'pdfs'>(initialFilterType);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Date Filter & Sorting States
  const [dateFilter, setDateFilter] = useState<PCloudDateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<PCloudSortOption>('date-desc');

  // Selection
  const [selectedItems, setSelectedItems] = useState<Map<string | number, PCloudItem>>(new Map());
  const [isAttaching, setIsAttaching] = useState<boolean>(false);

  // Quick Preview Lightbox
  const [previewItem, setPreviewItem] = useState<PCloudItem | null>(null);

  // Link bar visibility (hidden by default to keep the interface clean)
  const [showLinkBar, setShowLinkBar] = useState<boolean>(false);

  // Sync initial link when modal opens
  useEffect(() => {
    if (isOpen) {
      const linkToUse = initialLink || project?.pcloudPublicFolderUrl || settings.pcloudPublicFolderUrl || '';
      setPublicLink(linkToUse);
      setShowLinkBar(!linkToUse);
      if (linkToUse) {
        loadFolder(linkToUse, undefined, true);
      }
    } else {
      setSelectedItems(new Map());
      setPreviewItem(null);
      setSearchQuery('');
      setDateFilter('all');
      setCustomStartDate('');
      setCustomEndDate('');
      setShowLinkBar(false);
    }
  }, [isOpen, initialLink, project, settings.pcloudPublicFolderUrl]);

  // Load public folder from pCloud
  const loadFolder = useCallback(async (link: string, folderId?: number | string, isRoot: boolean = false) => {
    if (!link || !link.trim()) {
      setErrorMessage('يرجى إدخال رابط المجلد المشترك من pCloud للبدء');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await PCloudService.listFolder(link, folderId);
      if (result.success) {
        setFolderData(result);
        setActiveCode(result.code);
        setActiveRegion(result.region);
        setCurrentFolderId(folderId);

        if (isRoot) {
          setBreadcrumbs([{ id: result.folderId, name: result.folderName || 'المجلد الرئيسي' }]);
        }
      } else {
        setErrorMessage(result.error || 'تعذر جلب ملفات المجلد. يرجى التحقق من صحة الرابط العام.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء الاتصال بـ pCloud');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Navigate to subfolder
  const handleOpenSubfolder = (subfolder: PCloudItem) => {
    if (!publicLink) return;
    const newBreadcrumbs = [...breadcrumbs, { id: subfolder.folderId || subfolder.id, name: subfolder.name }];
    setBreadcrumbs(newBreadcrumbs);
    loadFolder(publicLink, subfolder.folderId || subfolder.id);
  };

  // Navigate via breadcrumb
  const handleBreadcrumbClick = (crumbIndex: number) => {
    const targetCrumb = breadcrumbs[crumbIndex];
    if (!targetCrumb) return;

    const newBreadcrumbs = breadcrumbs.slice(0, crumbIndex + 1);
    setBreadcrumbs(newBreadcrumbs);

    const folderId = crumbIndex === 0 ? undefined : targetCrumb.id;
    loadFolder(publicLink, folderId);
  };

  // Toggle single item selection
  const handleToggleSelectItem = (item: PCloudItem) => {
    if (item.isFolder) {
      handleOpenSubfolder(item);
      return;
    }

    const newMap = new Map(selectedItems);
    const key = item.fileId || item.id;
    if (newMap.has(key)) {
      newMap.delete(key);
    } else {
      if (!allowMultiple) {
        newMap.clear();
      }
      newMap.set(key, item);
    }
    setSelectedItems(newMap);
  };

  // Counts for date filter pills (Today, This Week, Custom)
  const dateCounts = useMemo(() => {
    if (!folderData || !folderData.files) {
      return { total: 0, today: 0, week: 0, custom: 0 };
    }
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    let today = 0;
    let week = 0;
    let custom = 0;

    const startCustom = customStartDate ? new Date(customStartDate) : null;
    if (startCustom) startCustom.setHours(0, 0, 0, 0);
    const endCustom = customEndDate ? new Date(customEndDate) : null;
    if (endCustom) endCustom.setHours(23, 59, 59, 999);

    folderData.files.forEach(f => {
      if (activeFilter === 'images' && !f.isImage) return;
      if (activeFilter === 'pdfs' && !f.isPdf) return;

      const d = parsePCloudDate(f);
      if (!d) return;

      const isCalToday = d >= startOfToday && d <= endOfToday;
      const is24h = (now.getTime() - d.getTime()) >= 0 && (now.getTime() - d.getTime()) <= 24 * 60 * 60 * 1000;
      if (isCalToday || is24h) today++;

      if (d.getTime() >= sevenDaysAgo.getTime() && d.getTime() <= now.getTime() + 60 * 60 * 1000) week++;

      if (startCustom || endCustom) {
        let match = true;
        if (startCustom && d.getTime() < startCustom.getTime()) match = false;
        if (endCustom && d.getTime() > endCustom.getTime()) match = false;
        if (match) custom++;
      }
    });

    return {
      total: folderData.files.length,
      today,
      week,
      custom
    };
  }, [folderData, activeFilter, customStartDate, customEndDate]);

  // Filtered files list by type, search query, and upload date
  const filteredFiles = useMemo(() => {
    if (!folderData || !folderData.files) return [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const startCustom = customStartDate ? new Date(customStartDate) : null;
    if (startCustom) startCustom.setHours(0, 0, 0, 0);
    const endCustom = customEndDate ? new Date(customEndDate) : null;
    if (endCustom) endCustom.setHours(23, 59, 59, 999);

    return folderData.files.filter(file => {
      // Filter by type
      if (activeFilter === 'images' && !file.isImage) return false;
      if (activeFilter === 'pdfs' && !file.isPdf) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!file.name.toLowerCase().includes(query)) return false;
      }

      // Filter by upload date on pCloud
      if (dateFilter !== 'all') {
        const fileDate = parsePCloudDate(file);
        if (!fileDate) return false;

        if (dateFilter === 'today') {
          const isCalToday = fileDate >= startOfToday && fileDate <= endOfToday;
          const is24h = (now.getTime() - fileDate.getTime()) >= 0 && (now.getTime() - fileDate.getTime()) <= 24 * 60 * 60 * 1000;
          if (!isCalToday && !is24h) return false;
        } else if (dateFilter === 'week') {
          if (fileDate.getTime() < sevenDaysAgo.getTime() || fileDate.getTime() > now.getTime() + 60 * 60 * 1000) {
            return false;
          }
        } else if (dateFilter === 'custom') {
          if (startCustom && fileDate.getTime() < startCustom.getTime()) return false;
          if (endCustom && fileDate.getTime() > endCustom.getTime()) return false;
        }
      }

      return true;
    });
  }, [folderData, activeFilter, searchQuery, dateFilter, customStartDate, customEndDate]);

  // Sorted files based on user preference (newest upload first by default)
  const sortedFiles = useMemo(() => {
    const list = [...filteredFiles];
    list.sort((a, b) => {
      if (sortBy === 'date-desc') {
        const dateA = parsePCloudDate(a)?.getTime() || 0;
        const dateB = parsePCloudDate(b)?.getTime() || 0;
        return dateB - dateA;
      }
      if (sortBy === 'date-asc') {
        const dateA = parsePCloudDate(a)?.getTime() || 0;
        const dateB = parsePCloudDate(b)?.getTime() || 0;
        return dateA - dateB;
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name, 'ar', { numeric: true });
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name, 'ar', { numeric: true });
      }
      if (sortBy === 'size-desc') {
        return (b.size || 0) - (a.size || 0);
      }
      if (sortBy === 'size-asc') {
        return (a.size || 0) - (b.size || 0);
      }
      return 0;
    });
    return list;
  }, [filteredFiles, sortBy]);

  // Filtered subfolders list
  const filteredSubfolders = useMemo(() => {
    if (!folderData || !folderData.subfolders) return [];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return folderData.subfolders.filter(f => f.name.toLowerCase().includes(query));
    }

    return folderData.subfolders;
  }, [folderData, searchQuery]);

  // Select all visible files
  const handleSelectAllVisible = () => {
    const newMap = new Map(selectedItems);
    sortedFiles.forEach(file => {
      const key = file.fileId || file.id;
      newMap.set(key, file);
    });
    setSelectedItems(newMap);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedItems(new Map());
  };

  // Save current public link as default in settings
  const handleSaveAsDefault = async () => {
    if (!publicLink) return;
    await updateSettings({ pcloudPublicFolderUrl: publicLink.trim() });
    showAlert('تم الحفظ', 'تم تعيين هذا الرابط كرابط مجلد pCloud الافتراضي للمنظومة بنجاح.', 'success');
  };

  // Confirm selection and attach items
  const handleConfirmAttach = async () => {
    if (selectedItems.size === 0) {
      showAlert('تنبيه', 'يرجى تحديد صورة أو مستند واحد على الأقل للإرفاق.', 'warning');
      return;
    }

    setIsAttaching(true);
    try {
      const selectedList = Array.from(selectedItems.values());
      const attachments: ExpenseAttachment[] = [];

      for (const item of selectedList) {
        const attachment = await PCloudService.createAttachmentFromPCloudItem(
          item,
          activeCode,
          activeRegion
        );
        attachments.push(attachment);
      }

      onSelectAttachments(attachments);
      onClose();
    } catch (err: any) {
      showAlert('خطأ أثناء تجهيز المرفقات', err?.message || 'حدث خطأ أثناء معالجة الملفات', 'error');
    } finally {
      setIsAttaching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 overflow-hidden text-right">
        
        {/* Modal Header */}
        <div className="p-3 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-sky-50/50 via-slate-50 to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-inner shrink-0">
              <Cloud className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {title}
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
                  pCloud Public Folder
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                استعراض واختيار صور الفواتير وسندات الصرف مباشرة عبر رابط المشاركة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {publicLink && (
              <button
                type="button"
                onClick={() => loadFolder(publicLink, currentFolderId, false)}
                disabled={isLoading}
                className="p-2 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="تحديث محتويات المجلد"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowLinkBar(!showLinkBar)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                showLinkBar
                  ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-800'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={showLinkBar ? 'إخفاء شريط رابط المجلد' : 'تعديل أو إظهار رابط المجلد'}
            >
              <Link2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Public Link Control Bar (Hidden by default to keep the interface clean) */}
        {showLinkBar && (
          <div className="p-2.5 sm:p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-2.5 sm:gap-3 justify-between shrink-0 animate-in fade-in duration-150">
            <div className="w-full flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <Link2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <input
                  type="text"
                  value={publicLink}
                  onChange={(e) => setPublicLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadFolder(publicLink, undefined, true);
                    }
                  }}
                  placeholder="أدخل رابط مجلد pCloud المشترك (مثال: https://u.pcloud.link/publink/show?code=...)"
                  className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  dir="ltr"
                />
              </div>

              <button
                type="button"
                onClick={() => loadFolder(publicLink, undefined, true)}
                disabled={isLoading || !publicLink.trim()}
                className="px-3 sm:px-3.5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isLoading ? 'جاري الفحص...' : 'فحص وتحديث'}</span>
                <span className="sm:hidden">{isLoading ? 'فحص...' : 'فحص'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-between sm:justify-end">
              {folderData && (
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shrink-0">
                  <FolderOpen className="w-3.5 h-3.5 text-sky-600" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]" title={folderData.folderName}>
                    {folderData.folderName}
                  </span>
                  <span className="text-[10px] text-slate-400">({folderData.totalFiles})</span>
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveAsDefault}
                disabled={!publicLink.trim()}
                className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium transition-colors shrink-0"
                title="تعيين هذا الرابط كرابط افتراضي للمنظومة في الإعدادات"
              >
                حفظ كافتراضي
              </button>
            </div>
          </div>
        )}

        {/* Toolbar: Breadcrumbs, Search, Filters & Selection Bar */}
        {folderData && (
          <div className="p-2 sm:p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0">
            {/* Unified Top Bar: Breadcrumbs + Search Box + View Mode Toggle */}
            <div className="flex items-center gap-2">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 overflow-x-auto py-0.5 shrink-0 max-w-[110px] sm:max-w-[200px]">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id || idx}>
                    {idx > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                    <button
                      type="button"
                      onClick={() => handleBreadcrumbClick(idx)}
                      className={`hover:text-sky-600 font-semibold px-1.5 py-0.5 rounded transition-colors whitespace-nowrap truncate ${
                        idx === breadcrumbs.length - 1
                          ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-950/60'
                          : ''
                      }`}
                      title={crumb.name}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Search Box in Center */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث باسم الملف أو الفاتورة..."
                  className="w-full pr-8 pl-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1 focus:ring-sky-500 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* View toggle (Grid / List) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="عرض شبكي"
                >
                  <Layers className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="عرض قائمة"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3 Dropdown Filters: Type, Date, Sort */}
            <div className="grid grid-cols-3 gap-1.5">
              {/* 1. File Type Dropdown */}
              <div className="relative">
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as any)}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer truncate"
                >
                  <option value="all">📁 الكل ({folderData.totalFiles})</option>
                  <option value="images">🖼️ صور ({folderData.totalImages})</option>
                  <option value="pdfs">📄 مستندات ({folderData.totalPdfs})</option>
                </select>
              </div>

              {/* 2. Upload Date Dropdown */}
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer truncate"
                >
                  <option value="all">📅 كل التواريخ</option>
                  <option value="today">⏱️ اليوم ({dateCounts.today})</option>
                  <option value="week">🗓️ هذا الأسبوع ({dateCounts.week})</option>
                  <option value="custom">⚙️ فترة مخصصة...</option>
                </select>
              </div>

              {/* 3. Sorting Dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as PCloudSortOption)}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer truncate"
                >
                  <option value="date-desc">⬇️ الأحدث رفعاً</option>
                  <option value="date-asc">⬆️ الأقدم رفعاً</option>
                  <option value="name-asc">🔤 الاسم (أ - ي)</option>
                  <option value="name-desc">🔤 الاسم (ي - أ)</option>
                  <option value="size-desc">📦 الأكبر حجماً</option>
                  <option value="size-asc">📦 الأصغر حجماً</option>
                </select>
              </div>
            </div>

            {/* Custom Date Pickers (Shown only when 'custom' is selected) */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-sky-50/80 dark:bg-sky-950/40 p-1.5 px-2.5 rounded-xl border border-sky-200 dark:border-sky-800/60 text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">من:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden font-mono"
                />
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">إلى:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden font-mono"
                />
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer ml-auto"
                    title="تفريغ التواريخ"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Selection Quick Actions */}
            <div className="flex flex-wrap items-center justify-between text-xs pt-1 gap-2 text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2 flex-wrap">
                {allowMultiple && sortedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                  >
                    تحديد كل المعروض ({sortedFiles.length})
                  </button>
                )}

                {selectedItems.size > 0 && (
                  <>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-rose-500 hover:underline cursor-pointer"
                    >
                      إلغاء تحديد الكل
                    </button>
                  </>
                )}

                {/* Date filter active indicator */}
                {dateFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[11px] font-medium">
                    <Clock className="w-3 h-3" />
                    <span>
                      {dateFilter === 'today' && 'ملفات رُفعت اليوم'}
                      {dateFilter === 'week' && 'ملفات رُفعت هذا الأسبوع'}
                      {dateFilter === 'custom' && (
                        customStartDate || customEndDate
                          ? `رفع بين ${customStartDate || 'البداية'} إلى ${customEndDate || 'الآن'}`
                          : 'فترة مخصصة'
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter('all');
                        setCustomStartDate('');
                        setCustomEndDate('');
                      }}
                      className="hover:text-rose-600 dark:hover:text-rose-400 font-bold p-0.5 cursor-pointer"
                      title="إلغاء فلتر التاريخ"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              {selectedItems.size > 0 && (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  تم تحديد {selectedItems.size} ملف
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 bg-slate-50/50 dark:bg-slate-950/50">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center animate-bounce">
                <Cloud className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                جاري الاتصال بـ pCloud وجلب محتويات المجلد المشترك...
              </p>
              <p className="text-xs text-slate-400">يرجى الانتظار بضع ثوانٍ</p>
            </div>
          ) : errorMessage ? (
            <div className="p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 text-center space-y-3 my-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                تعذر قراءة مجلد pCloud
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 max-w-md mx-auto leading-relaxed">
                {errorMessage}
              </p>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-800/80 text-[11px] text-slate-600 dark:text-slate-400 text-right max-w-lg mx-auto space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-500" />
                  <span>طريقة الحصول على رابط المجلد المشترك من pCloud:</span>
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-500">
                  <li>افتح موقع أو تطبيق pCloud.</li>
                  <li>انقر بزر الفأرة الأيمن على مجلد الفواتير أو الصور.</li>
                  <li>اختر <strong>Share</strong> ثم <strong>Share Link</strong> أو <strong>Get Public Link</strong>.</li>
                  <li>انسخ الرابط والصقه في الحقل أعلاه واضغط "فحص وتحديث".</li>
                </ol>
              </div>
            </div>
          ) : !folderData ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-center p-6">
              <div className="w-16 h-16 rounded-3xl bg-sky-50 dark:bg-sky-950/60 text-sky-500 flex items-center justify-center border border-sky-100 dark:border-sky-900">
                <Cloud className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                أدخل رابط مجلد pCloud المشترك
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                قم بلصق رابط مجلد pCloud العام لعرض الصور والمستندات واختيارها مباشرة لإرفاقها بالسند.
              </p>
              {!showLinkBar && (
                <button
                  type="button"
                  onClick={() => setShowLinkBar(true)}
                  className="mt-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                  <span>إدخال رابط المجلد</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Subfolders Grid */}
              {filteredSubfolders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                    <span>المجلدات الفرعية ({filteredSubfolders.length}):</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {filteredSubfolders.map(subfolder => (
                      <div
                        key={subfolder.id}
                        onClick={() => handleOpenSubfolder(subfolder)}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 cursor-pointer transition-all flex items-center gap-2.5 shadow-2xs group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Folder className="w-5 h-5 fill-amber-500/20 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={subfolder.name}>
                            {subfolder.name}
                          </p>
                          <span className="text-[10px] text-slate-400">مجلد</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-sky-500 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files Grid or List */}
              {sortedFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
                      <span>الملفات المعروضة ({sortedFiles.length}):</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      انقر على الصورة لتحديدها أو على أيقونة المعاينة لتكبيرها
                    </span>
                  </div>

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {sortedFiles.map(file => {
                        const isSelected = selectedItems.has(file.fileId || file.id);
                        const fileDateStr = formatFileDate(file);
                        const relativeDateStr = formatRelativeDate(file);

                        return (
                          <div
                            key={file.id}
                            className={`group relative rounded-2xl border transition-all overflow-hidden flex flex-col bg-white dark:bg-slate-900 cursor-pointer ${
                              isSelected
                                ? 'border-sky-500 ring-2 ring-sky-500/30 dark:ring-sky-500/50 shadow-md'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                            }`}
                            onClick={() => handleToggleSelectItem(file)}
                          >
                            {/* Thumbnail container */}
                            <div className="h-32 sm:h-36 w-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden flex items-center justify-center">
                              {file.isImage ? (
                                <img
                                  src={file.thumbUrl || file.downloadUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  loading="lazy"
                                />
                              ) : file.isPdf ? (
                                <div className="flex flex-col items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400">
                                  <FileText className="w-10 h-10" />
                                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/80 rounded">
                                    PDF Document
                                  </span>
                                </div>
                              ) : (
                                <FileText className="w-8 h-8 text-slate-400" />
                              )}

                              {/* Selection indicator checkbox */}
                              <div className="absolute top-2 right-2 z-10">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'bg-sky-600 text-white shadow-md'
                                    : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-300 dark:border-slate-600 text-transparent hover:border-sky-400'
                                }`}>
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              </div>

                              {/* Quick zoom preview button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewItem(file);
                                }}
                                className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                                title="معاينة وتكبير"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* File info footer */}
                            <div className="p-2.5 flex-1 flex flex-col justify-between gap-1.5">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={file.name}>
                                {file.name}
                              </p>
                              
                              <div className="flex items-center justify-between text-[10px] text-slate-400 gap-1">
                                <span
                                  className="truncate flex items-center gap-1 text-slate-500 dark:text-slate-400"
                                  title={fileDateStr ? `تاريخ الرفع: ${fileDateStr}` : undefined}
                                >
                                  {relativeDateStr ? (
                                    <>
                                      <Clock className="w-3 h-3 text-sky-500 shrink-0" />
                                      <span className="truncate">{relativeDateStr}</span>
                                    </>
                                  ) : (
                                    <span>{(file.size / 1024).toFixed(0)} ك.ب</span>
                                  )}
                                </span>
                                
                                <span className={`px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                  file.isPdf
                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                    : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                                }`}>
                                  {file.isPdf ? 'PDF' : 'صورة'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                      {sortedFiles.map(file => {
                        const isSelected = selectedItems.has(file.fileId || file.id);
                        const fileDateStr = formatFileDate(file);
                        const relativeDateStr = formatRelativeDate(file);

                        return (
                          <div
                            key={file.id}
                            onClick={() => handleToggleSelectItem(file)}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                              isSelected ? 'bg-sky-50/60 dark:bg-sky-950/40' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-sky-600 text-white' : 'border border-slate-300 dark:border-slate-600'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>

                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                {file.isImage ? (
                                  <img src={file.thumbUrl || file.downloadUrl} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                  <FileText className="w-5 h-5 text-rose-500" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span>{(file.size / 1024).toFixed(0)} ك.ب</span>
                                  {fileDateStr && (
                                    <>
                                      <span>•</span>
                                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                        <Clock className="w-3 h-3 text-sky-500 shrink-0" />
                                        <span>تاريخ الرفع: {fileDateStr}</span>
                                        {relativeDateStr && (
                                          <span className="text-sky-600 dark:text-sky-400 font-medium">({relativeDateStr})</span>
                                        )}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewItem(file);
                              }}
                              className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 rounded-lg transition-colors cursor-pointer"
                              title="معاينة"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-56 flex flex-col items-center justify-center gap-3 text-slate-400 text-center p-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                      {dateFilter !== 'all'
                        ? 'لا توجد ملفات مرفوعة في هذه الفترة المحددة'
                        : 'لا توجد ملفات تطابق الفلتر أو البحث في هذا المجلد'}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      {dateFilter !== 'all'
                        ? 'جرّب اختيار فترة زمنية أخرى أو عرض جميع التواريخ لاستعراض كافة المستندات.'
                        : 'تأكد من اختيار نوع الملف المناسب أو مسح عبارة البحث.'}
                    </p>
                  </div>
                  
                  {dateFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter('all');
                        setCustomStartDate('');
                        setCustomEndDate('');
                      }}
                      className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/80 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      عرض جميع الملفات (إلغاء فلتر التاريخ)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-2.5 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0 z-20 shadow-lg">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            {selectedItems.size > 0 && (
              <span className="text-[10px] sm:text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 rounded-lg border border-sky-200 dark:border-sky-800 shrink-0">
                {selectedItems.size} محدد
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end min-w-0">
            <button
              type="button"
              onClick={handleConfirmAttach}
              disabled={selectedItems.size === 0 || isAttaching}
              className="w-full sm:w-auto px-3.5 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap sm:hidden">
                {isAttaching ? 'جاري الإرفاق...' : `إرفاق (${selectedItems.size})`}
              </span>
              <span className="hidden sm:inline whitespace-nowrap">
                {isAttaching
                  ? 'جاري إرفاق وتجهيز الملفات...'
                  : `إرفاق المستندات المحددة (${selectedItems.size}) للمصروف`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="relative max-w-4xl w-full h-[90dvh] sm:h-auto sm:max-h-[90vh] flex flex-col items-center justify-center">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-full sm:h-auto sm:max-h-[85vh] w-full flex flex-col shadow-2xl">
              {/* Lightbox Header with Visible Close Button */}
              <div className="p-3 bg-slate-950 w-full flex items-center justify-between text-white text-xs px-4 border-b border-slate-800 shrink-0 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1 pl-2 flex-wrap">
                  <span className="font-bold truncate max-w-xs">{previewItem.name}</span>
                  <span className="text-slate-400 text-[11px] shrink-0 font-mono">
                    {((previewItem.size || 0) / 1024).toFixed(0)} ك.ب
                  </span>
                  {formatFileDate(previewItem) && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded-lg border border-sky-800/80 shrink-0">
                      <Clock className="w-3 h-3 text-sky-400" />
                      <span>رفع: {formatFileDate(previewItem)}</span>
                      {formatRelativeDate(previewItem) && (
                        <span className="text-slate-400 font-sans">({formatRelativeDate(previewItem)})</span>
                      )}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                  title="إغلاق المعاينة"
                >
                  <X className="w-4 h-4" />
                  <span className="text-[11px] font-semibold sm:hidden">إغلاق</span>
                </button>
              </div>

              {/* Lightbox Body */}
              <div className="p-3 sm:p-4 flex items-center justify-center w-full flex-1 min-h-0 overflow-auto bg-slate-950/60">
                {previewItem.isImage ? (
                  <img
                    src={previewItem.downloadUrl || previewItem.thumbUrl}
                    alt={previewItem.name}
                    className="max-h-[60vh] sm:max-h-[68vh] max-w-full object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="p-6 text-center text-white space-y-4 max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{previewItem.name}</p>
                      <p className="text-xs text-slate-400 mt-1">مستند PDF مخزن في pCloud</p>
                    </div>
                    <a
                      href={previewItem.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-md shadow-sky-600/30 w-full"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>فتح وقراءة ملف PDF في تبويب جديد</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Lightbox Footer */}
              <div className="p-3 bg-slate-950 w-full flex items-center justify-between gap-2 px-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  رجوع للمجلد
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleToggleSelectItem(previewItem);
                    setPreviewItem(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    selectedItems.has(previewItem.fileId || previewItem.id)
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-sky-600 hover:bg-sky-700 text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {selectedItems.has(previewItem.fileId || previewItem.id)
                      ? 'إلغاء تحديد هذا المرفق'
                      : 'تحديد هذا المرفق للإرفاق'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

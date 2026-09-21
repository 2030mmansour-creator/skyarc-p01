import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Expense } from '../../types';
import { AttachmentArchiver } from '../../services/attachmentArchiver';
import { compressImageFile, estimateDataUrlSize } from '../../utils/imageCompressor';
import {
  X,
  Upload,
  FolderArchive,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Eye,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronDown
} from 'lucide-react';

interface BulkAttachModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProcessedAttachmentItem {
  id: string; // unique item id
  file: File;
  fileName: string;
  fileSize: number;
  dataUrl: string;
  isPdf: boolean;
  detectedId: string;
  matchedExpenseId: string | null;
  matchedExpense: Expense | null;
  status: 'matched' | 'unmatched';
  isOverwriting: boolean;
}

export const BulkAttachModal: React.FC<BulkAttachModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    expenses,
    settings,
    currentUser,
    bulkAttachExpensesPhotos,
    openAttachmentPreview,
    showAlert
  } = useApp();

  const [items, setItems] = useState<ProcessedAttachmentItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Settings & Filter states
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingStrategy, setMatchingStrategy] = useState<
    'smart' | 'legacy_id' | 'prefix_id' | 'invoice_no'
  >('smart');

  // Manual expense selector popover
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Helper: Extract ID candidate from filename
  const extractIdFromFilename = (filename: string): string => {
    // Strip extension
    const baseName = filename.replace(/\.[^/.]+$/, '').trim();

    // 1. If starts with EXP- prefix (e.g. EXP-1001 or EXP-HIST-200)
    const expMatch = baseName.match(/^(EXP-[A-Za-z0-9_-]+)/i);
    if (expMatch) return expMatch[1].trim();

    // 2. If starts with INV- prefix (e.g. INV-9021)
    const invMatch = baseName.match(/^(INV-[A-Za-z0-9_-]+)/i);
    if (invMatch) return invMatch[1].trim();

    // 3. Delimiter split: split by _, -, space, #, dot
    const parts = baseName.split(/[_ \-#]/);
    if (parts.length > 0 && parts[0].trim()) {
      return parts[0].trim();
    }

    return baseName;
  };

  // Helper: Find matching expense
  const findMatchingExpense = (
    filename: string,
    extractedId: string,
    expensesList: Expense[],
    strategy: 'smart' | 'legacy_id' | 'prefix_id' | 'invoice_no'
  ): Expense | null => {
    const cleanExtracted = extractedId.trim().toLowerCase();
    const cleanBaseName = filename.replace(/\.[^/.]+$/, '').trim().toLowerCase();
    const digitsExtracted = cleanExtracted.replace(/\D/g, '');

    // 1. Only Invoice Number strategy
    if (strategy === 'invoice_no') {
      return expensesList.find(e => {
        if (!e.invoiceNumber) return false;
        const inv = e.invoiceNumber.trim().toLowerCase();
        return inv === cleanExtracted || cleanBaseName.startsWith(inv) || inv === digitsExtracted;
      }) || null;
    }

    // 2. Only Legacy ID (Excel id column) strategy
    if (strategy === 'legacy_id') {
      return expensesList.find(e => {
        if (!e.legacyId) return false;
        const leg = e.legacyId.trim().toLowerCase();
        const legDigits = leg.replace(/\D/g, '');
        return (
          leg === cleanExtracted ||
          cleanBaseName === leg ||
          cleanBaseName.startsWith(leg + '_') ||
          cleanBaseName.startsWith(leg + '-') ||
          cleanBaseName.startsWith(leg + ' ') ||
          cleanBaseName.startsWith(leg) ||
          (digitsExtracted && legDigits && digitsExtracted === legDigits && digitsExtracted.length >= 1)
        );
      }) || null;
    }

    // 3. Only System Bond ID (EXP-...) strategy
    if (strategy === 'prefix_id') {
      return expensesList.find(e => {
        const idLower = e.id.toLowerCase();
        if (idLower === cleanExtracted) return true;
        if (cleanBaseName.startsWith(idLower)) return true;
        // Check number equality (e.g. 1001 vs EXP-1001)
        const expDigits = idLower.replace(/\D/g, '');
        if (digitsExtracted && expDigits && digitsExtracted === expDigits && digitsExtracted.length >= 2) {
          return true;
        }
        return false;
      }) || null;
    }

    // Default: SMART strategy (Prioritizes Excel legacyId column, then System ID, then Invoice Number)
    
    // Priority 1: Match against Excel legacyId (column 'id' in imported excel)
    const legacyMatch = expensesList.find(e => {
      if (!e.legacyId) return false;
      const leg = e.legacyId.trim().toLowerCase();
      const legDigits = leg.replace(/\D/g, '');
      return (
        leg === cleanExtracted ||
        cleanBaseName === leg ||
        cleanBaseName.startsWith(leg + '_') ||
        cleanBaseName.startsWith(leg + '-') ||
        cleanBaseName.startsWith(leg + ' ') ||
        cleanBaseName.startsWith(leg) ||
        (digitsExtracted && legDigits && digitsExtracted === legDigits && digitsExtracted.length >= 1)
      );
    });
    if (legacyMatch) return legacyMatch;

    // Priority 2: Exact ID match on system id
    const exactId = expensesList.find(e => e.id.toLowerCase() === cleanExtracted);
    if (exactId) return exactId;

    // Priority 3: Filename starts with expense.id
    const startsWithId = expensesList.find(e => cleanBaseName.startsWith(e.id.toLowerCase()));
    if (startsWithId) return startsWithId;

    // Priority 4: Number-only match on ID (e.g. filename has 1001, expense is EXP-1001 or EXP-HIST-1001)
    if (digitsExtracted && digitsExtracted.length >= 2) {
      const digitMatch = expensesList.find(e => {
        const expDigits = e.id.replace(/\D/g, '');
        return expDigits === digitsExtracted;
      });
      if (digitMatch) return digitMatch;
    }

    // Priority 5: Match by invoiceNumber
    const invoiceMatch = expensesList.find(e => {
      if (!e.invoiceNumber) return false;
      const invLower = e.invoiceNumber.trim().toLowerCase();
      return (
        invLower === cleanExtracted ||
        cleanBaseName.startsWith(invLower) ||
        (digitsExtracted && invLower.replace(/\D/g, '') === digitsExtracted)
      );
    });
    if (invoiceMatch) return invoiceMatch;

    // Priority 6: Match by ERP Reference Number
    const erpMatch = expensesList.find(e => {
      if (!e.erpReferenceNumber) return false;
      const erpLower = e.erpReferenceNumber.trim().toLowerCase();
      return erpLower === cleanExtracted || cleanBaseName.startsWith(erpLower);
    });
    if (erpMatch) return erpMatch;

    // Priority 7: Substring match: expense ID appears anywhere in filename
    const containsId = expensesList.find(e => {
      return cleanBaseName.includes(e.id.toLowerCase());
    });
    if (containsId) return containsId;

    return null;
  };

  // Helper: Image optimization & base64 reading
  const processFileToDataUrl = async (
    file: File
  ): Promise<{ dataUrl: string; isPdf: boolean; size: number }> => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            dataUrl: reader.result as string,
            isPdf: true,
            size: file.size
          });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // Compress images using smart client compressor
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.75,
        maxSizeBytes: 180 * 1024
      });
      return {
        dataUrl: compressed,
        isPdf: false,
        size: estimateDataUrlSize(compressed) || file.size
      };
    } catch {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
          resolve({
            dataUrl: (e.target?.result as string) || '',
            isPdf: false,
            size: file.size
          });
        };
        reader.onerror = () =>
          resolve({
            dataUrl: '',
            isPdf: false,
            size: file.size
          });
        reader.readAsDataURL(file);
      });
    }
  };

  // Main file processing handler
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList).filter(f => {
      const name = f.name.toLowerCase();
      return (
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp') ||
        name.endsWith('.pdf') ||
        f.type.startsWith('image/') ||
        f.type === 'application/pdf'
      );
    });

    if (rawFiles.length === 0) {
      showAlert('ملفات غير مدعومة', 'يرجى اختيار صور (JPG, PNG, WEBP) أو مستندات (PDF).', 'warning');
      return;
    }

    setIsProcessingFiles(true);
    setProcessingProgress({ current: 0, total: rawFiles.length });

    const newItems: ProcessedAttachmentItem[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      setProcessingProgress({ current: i + 1, total: rawFiles.length });

      try {
        const { dataUrl, isPdf, size } = await processFileToDataUrl(file);
        const extractedId = extractIdFromFilename(file.name);
        const matched = findMatchingExpense(file.name, extractedId, expenses, matchingStrategy);

        newItems.push({
          id: `attach_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
          file,
          fileName: file.name,
          fileSize: size,
          dataUrl,
          isPdf,
          detectedId: extractedId,
          matchedExpenseId: matched ? matched.id : null,
          matchedExpense: matched,
          status: matched ? 'matched' : 'unmatched',
          isOverwriting: matched ? Boolean(matched.invoicePhoto) : false
        });
      } catch (err) {
        console.error('Error reading file:', file.name, err);
      }
    }

    setItems(prev => [...prev, ...newItems]);
    setIsProcessingFiles(false);
    setProcessingProgress(null);
  };

  // Re-run matching if user switches strategy
  const handleReRunMatching = (strategy: 'smart' | 'legacy_id' | 'prefix_id' | 'invoice_no') => {
    setMatchingStrategy(strategy);
    setItems(prev =>
      prev.map(item => {
        const extractedId = extractIdFromFilename(item.fileName);
        const matched = findMatchingExpense(item.fileName, extractedId, expenses, strategy);
        return {
          ...item,
          detectedId: extractedId,
          matchedExpenseId: matched ? matched.id : null,
          matchedExpense: matched,
          status: matched ? 'matched' : 'unmatched',
          isOverwriting: matched ? Boolean(matched.invoicePhoto) : false
        };
      })
    );
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // Clear all items
  const handleClearAll = () => {
    setItems([]);
    setEditingItemId(null);
  };

  // Manually link an expense to an item
  const handleManualLink = (itemId: string, expense: Expense) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === itemId) {
          return {
            ...it,
            matchedExpenseId: expense.id,
            matchedExpense: expense,
            status: 'matched',
            isOverwriting: Boolean(expense.invoicePhoto)
          };
        }
        return it;
      })
    );
    setEditingItemId(null);
    setExpenseSearchQuery('');
  };

  // Unlink an item
  const handleUnlink = (itemId: string) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === itemId) {
          return {
            ...it,
            matchedExpenseId: null,
            matchedExpense: null,
            status: 'unmatched',
            isOverwriting: false
          };
        }
        return it;
      })
    );
  };

  // Save / Apply all matched attachments
  const handleSaveAttachments = async () => {
    const validItems = items.filter(it => it.status === 'matched' && it.matchedExpense);

    if (validItems.length === 0) {
      showAlert('لا توجد ملفات مطابقة', 'يرجى التأكد من مطابقة ملف واحد على الأقل مع سند مصروفات.', 'warning');
      return;
    }

    // If overwrite is false, filter out items that already have photos
    const itemsToApply = overwriteExisting
      ? validItems
      : validItems.filter(it => !it.matchedExpense?.invoicePhoto);

    if (itemsToApply.length === 0) {
      showAlert(
        'تم تخطي السندات',
        'كافة السندات المطابقة تحتوي مسبقاً على صور فواتير، وخيار "استبدال المرفقات الحالية" غير مفعل.',
        'info'
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload = itemsToApply.map(it => {
        const exp = it.matchedExpense!;
        const codedName = AttachmentArchiver.generateCodedFileName({
          bondNumber: exp.id,
          projectCode: exp.projectId,
          projectName: exp.projectName,
          invoiceNumber: exp.invoiceNumber,
          originalFileName: it.fileName,
          isPdf: it.isPdf
        });

        const projectFolder = `مجلد_مشروع_${AttachmentArchiver.sanitizeName(exp.projectId)}_${AttachmentArchiver.sanitizeName(exp.projectName)}`;

        return {
          expenseId: exp.id,
          invoicePhoto: it.dataUrl,
          fileName: codedName,
          attachmentMeta: {
            codedName,
            originalName: it.fileName,
            bondNumber: exp.id,
            projectCode: exp.projectId,
            projectName: exp.projectName,
            projectFolder,
            fileType: it.isPdf ? 'pdf' : 'image',
            savedAt: new Date().toISOString()
          }
        };
      });

      const res = await bulkAttachExpensesPhotos(payload);

      setIsSaving(false);

      if (res.success) {
        showAlert(
          'تم ربط المرفقات بنجاح',
          `تم بنجاح حفظ وتثبيت (${res.count}) مرفق مع سندات المصروفات المطابقة.`,
          'success'
        );
        onClose();
      } else {
        showAlert('تنبيه', res.message || 'حدث خطأ أثناء حفظ المرفقات.', 'error');
      }
    } catch (err) {
      console.error(err);
      setIsSaving(false);
      showAlert('خطأ', 'حدث خطأ غير متوقع أثناء ربط المرفقات.', 'error');
    }
  };

  // Calculations & Filters
  const totalFiles = items.length;
  const matchedItems = useMemo(() => items.filter(it => it.status === 'matched'), [items]);
  const unmatchedItems = useMemo(() => items.filter(it => it.status === 'unmatched'), [items]);

  const totalMatchedAmount = useMemo(() => {
    return matchedItems.reduce((sum, it) => sum + (it.matchedExpense?.amount || 0), 0);
  }, [matchedItems]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeTab === 'matched') list = matchedItems;
    if (activeTab === 'unmatched') list = unmatchedItems;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        it =>
          it.fileName.toLowerCase().includes(q) ||
          it.detectedId.toLowerCase().includes(q) ||
          it.matchedExpense?.id.toLowerCase().includes(q) ||
          (it.matchedExpense?.legacyId && it.matchedExpense.legacyId.toLowerCase().includes(q)) ||
          it.matchedExpense?.projectName.toLowerCase().includes(q) ||
          it.matchedExpense?.details.toLowerCase().includes(q) ||
          it.matchedExpense?.invoiceNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeTab, matchedItems, unmatchedItems, searchQuery]);

  // Expenses filtered for manual selector
  const availableExpensesForSelector = useMemo(() => {
    if (!expenseSearchQuery.trim()) return expenses.slice(0, 15);
    const q = expenseSearchQuery.trim().toLowerCase();
    return expenses
      .filter(
        e =>
          e.id.toLowerCase().includes(q) ||
          (e.legacyId && e.legacyId.toLowerCase().includes(q)) ||
          e.projectName.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.details.toLowerCase().includes(q) ||
          e.invoiceNumber?.toLowerCase().includes(q) ||
          e.amount.toString().includes(q)
      )
      .slice(0, 20);
  }, [expenses, expenseSearchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>ربط صور ومستندات الفواتير تلقائياً (بالـ ID)</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                  معالج ذكي
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                اختر مجلد الصور من جهازك وسيقوم النظام بمطابقة كود السند أو الفاتورة في بداية اسم الصورة تلقائياً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5">
          {/* File Picker / Drag & Drop Strip */}
          <div className="bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-slate-50/60 dark:from-indigo-950/30 dark:via-blue-950/20 dark:to-slate-900/40 p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    كيف يتم الربط التلقائي بواسطة الـ id؟
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    إذا كان اسم ملف الصورة يبدأ برقم عمود الـ <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-indigo-400">id</code> المستورد من الإكسيل (مثال: <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-indigo-400">1001_فاتورة.jpg</code> أو <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-indigo-400">1001.png</code> أو <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-indigo-400">EXP-1001.pdf</code>)، سيتعرف النظام عليه مباشرة ويربط الصورة بالسند بدقة تامة!
                  </p>
                </div>
              </div>

              {/* Action Buttons: Pick Folder or Files */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Hidden Inputs */}
                <input
                  type="file"
                  ref={folderInputRef}
                  /* @ts-ignore: webkitdirectory attribute */
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isProcessingFiles}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <FolderArchive className="w-4 h-4" />
                  <span>اختيار مجلد الصور بالكامل</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFiles}
                  className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>اختيار صور / ملفات متعددة</span>
                </button>
              </div>
            </div>

            {/* Processing Progress Bar */}
            {isProcessingFiles && processingProgress && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span>جاري قراءة وضغط الصور ومطابقة السندات...</span>
                  </div>
                  <span>
                    {processingProgress.current} من {processingProgress.total} ملف (
                    {Math.round((processingProgress.current / processingProgress.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-indigo-100 dark:bg-indigo-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-200"
                    style={{
                      width: `${(processingProgress.current / processingProgress.total) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stats Bar (if files uploaded) */}
          {items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  إجمالي الملفات المحددة
                </span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {totalFiles}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  تم مطابقتها بنجاح
                </span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{matchedItems.length}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  ملفات غير مطابقة
                </span>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                  <AlertCircle className="w-5 h-5" />
                  <span>{unmatchedItems.length}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  إجمالي مبالغ الفواتير
                </span>
                <div className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                  {totalMatchedAmount.toLocaleString()} {settings.currencySymbol}
                </div>
              </div>
            </div>
          )}

          {/* Controls Bar: Strategy, Tabs, Search & Clear */}
          {items.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  الكل ({totalFiles})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('matched')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'matched'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>المطابقة ({matchedItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('unmatched')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'unmatched'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>غير المطابقة ({unmatchedItems.length})</span>
                </button>
              </div>

              {/* Matching Strategy Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold shrink-0">طريقة المطابقة:</span>
                <select
                  value={matchingStrategy}
                  onChange={e =>
                    handleReRunMatching(
                      e.target.value as 'smart' | 'legacy_id' | 'prefix_id' | 'invoice_no'
                    )
                  }
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-hidden"
                >
                  <option value="smart">مطابقة ذكية شاملة (عمود id بالإكسيل + كود السند + رقم الفاتورة)</option>
                  <option value="legacy_id">عمود id المستورد من الإكسيل فقط</option>
                  <option value="prefix_id">معرف السند في البرنامج (EXP-...) فقط</option>
                  <option value="invoice_no">رقم الفاتورة الضريبية فقط</option>
                </select>
              </div>

              {/* Search input & Clear */}
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="بحث في الملفات أو السندات..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pr-9 pl-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-hidden"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors cursor-pointer"
                  title="مسح كافة الملفات المحددة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Files List / Table */}
          {items.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                لم يتم اختيار أي صور أو مجلد بعد
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                اضغط على زر «اختيار مجلد الصور بالكامل» أو «اختيار ملفات متعددة» أعلاه لتحديد صور الفواتير وسيتولى النظام مطابقتها تلقائياً.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                  لا توجد نتائج مطابقة لبحثك أو الفلتر المحدد.
                </div>
              ) : (
                filteredItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      item.status === 'matched'
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
                        : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/60'
                    }`}
                  >
                    {/* File Info & Thumbnail */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Thumbnail with preview click */}
                      <button
                        type="button"
                        onClick={() => openAttachmentPreview(item.dataUrl, item.matchedExpense || undefined)}
                        className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden relative group shrink-0 cursor-pointer shadow-2xs"
                        title="انقر لمعاينة الصورة بالحجم الكامل"
                      >
                        {item.isPdf ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-red-500">
                            <FileText className="w-6 h-6" />
                            <span className="text-[9px] font-bold mt-0.5">PDF</span>
                          </div>
                        ) : (
                          <img
                            src={item.dataUrl}
                            alt={item.fileName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        )}
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </button>

                      {/* Filename & Detected ID */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[240px]"
                            title={item.fileName}
                          >
                            {item.fileName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({(item.fileSize / 1024).toFixed(0)} KB)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold border border-slate-200 dark:border-slate-700">
                            ID المستخرج: {item.detectedId}
                          </span>

                          {item.status === 'matched' ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>تمت المطابقة</span>
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                              <AlertCircle className="w-3 h-3" />
                              <span>غير مطابق</span>
                            </span>
                          )}

                          {item.isOverwriting && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              سيستبدل المرفق الحالي
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Matched Expense Card or Manual Assign */}
                    <div className="flex items-center gap-3 shrink-0">
                      {item.matchedExpense ? (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1 min-w-[240px]">
                          <div className="flex items-center justify-between font-bold">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                                #{item.matchedExpense.id}
                              </span>
                              {item.matchedExpense.legacyId && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800" title="معرف السند المستورد من ملف الإكسيل">
                                  id: {item.matchedExpense.legacyId}
                                </span>
                              )}
                            </div>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {item.matchedExpense.amount.toLocaleString()} {settings.currencySymbol}
                            </span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 truncate font-semibold">
                            {item.matchedExpense.projectName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {item.matchedExpense.category} - {item.matchedExpense.details}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 max-w-[240px]">
                          لم يتم العثور على سند يطابق هذا المعرف. يمكنك اختياره يدوياً.
                        </div>
                      )}

                      {/* Manual picker or Unlink */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(editingItemId === item.id ? null : item.id);
                            setExpenseSearchQuery(item.detectedId);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          {item.matchedExpense ? 'تغيير' : 'اختيار السند'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors cursor-pointer"
                          title="حذف هذا الملف من القائمة"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Manual Expense Selector Popover */}
                    {editingItemId === item.id && (
                      <div className="w-full mt-3 p-4 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-300 dark:border-slate-700 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            اختر السند الذي ترغب بربط الملف ({item.fileName}) معه:
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            إلغاء
                          </button>
                        </div>

                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="ابحث برقم السند، اسم المشروع، المبلغ، أو البيان..."
                            value={expenseSearchQuery}
                            onChange={e => setExpenseSearchQuery(e.target.value)}
                            className="w-full pr-9 pl-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-hidden"
                            autoFocus
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
                          {availableExpensesForSelector.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-500">
                              لا توجد سندات مطابقة للبحث
                            </div>
                          ) : (
                            availableExpensesForSelector.map(exp => (
                              <button
                                key={exp.id}
                                type="button"
                                onClick={() => handleManualLink(item.id, exp)}
                                className="w-full text-right p-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                                      #{exp.id}
                                    </span>
                                    {exp.legacyId && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                                        id: {exp.legacyId}
                                      </span>
                                    )}
                                    <span className="text-slate-600 dark:text-slate-300 font-semibold">
                                      {exp.projectName}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-normal">
                                      ({exp.date})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {exp.category} - {exp.details}
                                  </div>
                                </div>

                                <div className="text-left shrink-0">
                                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {exp.amount.toLocaleString()} {settings.currencySymbol}
                                  </div>
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    ربط الآن ←
                                  </span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={e => setOverwriteExisting(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
              />
              <span>استبدال المرفق إذا كان السند يحتوي على صورة سابقة</span>
            </label>
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSaveAttachments}
              disabled={isSaving || matchedItems.length === 0}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري ربط وحفظ المرفقات...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد ربط ({matchedItems.length}) مرفق بالسندات</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { Expense, Project, ExpenseCategory } from '../../types';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Building2,
  FolderPlus,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Info,
  HelpCircle,
  Clock,
  Paperclip,
  SlidersHorizontal,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  'مواد بناء',
  'عمالة',
  'مقاولين',
  'نثريات ومشتريات',
  'نقل ومحروقات',
  'صيانة ومعدات',
  'رواتب',
  'مصروفات بفواتير ضريبية'
];

interface ImportExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenBulkAttach?: () => void;
}

interface ParsedExpenseRow {
  index: number;
  originalId?: string;
  rawDate: any;
  date: string;
  rawProject: string;
  projectId: string;
  projectName: string;
  isNewProject: boolean;
  category: ExpenseCategory;
  details: string;
  amount: number;
  taxAmount: number;
  invoiceNumber: string;
  supervisorName: string;
  supervisorEmail: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

export const ImportExpensesModal: React.FC<ImportExpensesModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenBulkAttach
}) => {
  const {
    projects,
    settings,
    currentUser,
    bulkImportExpenses,
    showAlert,
    addNotification
  } = useApp();

  const allCategories = useMemo(() => {
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...(settings.customCategories || [])]));
  }, [settings.customCategories]);

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedExpenseRow[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload');
  const [filterPreview, setFilterPreview] = useState<'all' | 'valid' | 'errors'>('all');

  // Multi-sheet and column mapping state
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{
    amount: string;
    date: string;
    project: string;
    category: string;
    details: string;
    tax: string;
    invoiceNumber: string;
    supervisor: string;
    id: string;
    notes: string;
  }>({
    amount: '',
    date: '',
    project: '',
    category: '',
    details: '',
    tax: '',
    invoiceNumber: '',
    supervisor: '',
    id: '',
    notes: ''
  });
  const [showMappingSettings, setShowMappingSettings] = useState(false);
  const workbookRef = useRef<XLSX.WorkBook | null>(null);

  // Import options
  const [autoApproveHistorical, setAutoApproveHistorical] = useState(true);
  const [autoCreateProjects, setAutoCreateProjects] = useState(true);
  const [fallbackProjectId, setFallbackProjectId] = useState<string>(projects[0]?.id || '');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Format Date from various Excel formats (Arabic numerals, serial numbers, strings)
  const parseExcelDate = (val: any): string => {
    if (!val) {
      return new Date().toISOString().split('T')[0];
    }

    // If it's an Excel numeric serial date (e.g. 45123)
    if (typeof val === 'number') {
      try {
        const parsed = XLSX.SSF.parse_date_code(val);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          const y = parsed.y;
          const m = String(parsed.m).padStart(2, '0');
          const d = String(parsed.d).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      } catch (e) {
        // fallback
      }
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }

    let str = String(val).trim();

    // Convert Arabic and Persian numbers to Western digits
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    for (let i = 0; i < 10; i++) {
      str = str.replaceAll(arabicDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
    }

    // If YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    if (/^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/.test(str)) {
      const parts = str.split(/[\/\-.]/);
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    // If DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(str)) {
      const parts = str.split(/[\/\-.]/);
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    // Try standard JS Date parse
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
  };

  // Helper: Clean Numeric Amount (supports Arabic digits, Persian digits, currency strings, commas)
  const parseNumeric = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;

    let str = String(val).trim();

    // Convert Arabic and Persian numbers to Western digits
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    for (let i = 0; i < 10; i++) {
      str = str.replaceAll(arabicDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
    }

    // Replace Arabic decimal separators (٫ or ،) with standard dot (.)
    str = str.replace(/[٫،]/g, '.');

    // Remove currency letters, SAR, $, commas, spaces, keeping only numbers, minus, and dot
    str = str.replace(/[^\d.-]/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Auto-detect best matching column header for each field
  const autoDetectMapping = (headers: string[]) => {
    const findMatch = (positiveKeywords: string[], negativeKeywords: string[] = []): string => {
      // 1. Exact match (highest priority)
      for (const h of headers) {
        const norm = h.trim().toLowerCase().replace(/[\s_\-()]/g, '');
        const hasNegative = negativeKeywords.some(nk => norm.includes(nk.trim().toLowerCase().replace(/[\s_\-()]/g, '')));
        if (hasNegative) continue;

        for (const pk of positiveKeywords) {
          const normPk = pk.trim().toLowerCase().replace(/[\s_\-()]/g, '');
          if (norm === normPk) return h;
        }
      }
      // 2. Starts with or Ends with
      for (const h of headers) {
        const norm = h.trim().toLowerCase().replace(/[\s_\-()]/g, '');
        const hasNegative = negativeKeywords.some(nk => norm.includes(nk.trim().toLowerCase().replace(/[\s_\-()]/g, '')));
        if (hasNegative) continue;

        for (const pk of positiveKeywords) {
          const normPk = pk.trim().toLowerCase().replace(/[\s_\-()]/g, '');
          if (norm.startsWith(normPk) || norm.endsWith(normPk)) return h;
        }
      }
      // 3. Substring match
      for (const h of headers) {
        const norm = h.trim().toLowerCase().replace(/[\s_\-()]/g, '');
        const hasNegative = negativeKeywords.some(nk => norm.includes(nk.trim().toLowerCase().replace(/[\s_\-()]/g, '')));
        if (hasNegative) continue;

        for (const pk of positiveKeywords) {
          const normPk = pk.trim().toLowerCase().replace(/[\s_\-()]/g, '');
          if (norm.includes(normPk)) return h;
        }
      }
      return '';
    };

    return {
      amount: findMatch(
        ['المبلغ الصافي', 'صافي المبلغ', 'المبلغ الإجمالي', 'إجمالي المبلغ', 'الإجمالي', 'اجمالي', 'المبلغ', 'مبلغ', 'المجموع', 'مجموع', 'التكلفة', 'تكلفة', 'المدفوع', 'مدفوع', 'مدين', 'قيمة المصروف', 'قيمة الفاتورة', 'القيمة', 'قيمة', 'amount', 'total', 'debit', 'cost', 'net', 'price'],
        ['ضريبة', 'tax', 'vat', 'نسبة', 'rate', 'تاريخ', 'date']
      ),
      tax: findMatch(
        ['قيمة الضريبة', 'مبلغ الضريبة', 'ضريبة القيمة المضافة', 'الضريبة', 'ضريبة', 'vat', 'tax', 'vat amount'],
        ['بدون', 'غير شامل', 'قبل الضريبة', 'without']
      ),
      date: findMatch(
        ['تاريخ الصرف', 'تاريخ الفاتورة', 'تاريخ السند', 'تاريخ المصروف', 'التاريخ', 'تاريخ', 'date', 'expense_date', 'invoice_date', 'tx_date']
      ),
      project: findMatch(
        ['كود المشروع', 'اسم المشروع', 'رمز المشروع', 'رقم المشروع', 'المشروع', 'مشروع', 'project_name', 'project_code', 'project_id', 'project', 'prj'],
        ['مشرف', 'supervisor']
      ),
      category: findMatch(
        ['بند الصرف', 'بند المصروف', 'اسم البند', 'البند', 'بند', 'التصنيف', 'تصنيف', 'الفئة', 'فئة', 'نوع المصروف', 'category', 'item', 'type']
      ),
      details: findMatch(
        ['البيان والتفاصيل', 'بيان المصروف', 'تفاصيل المصروف', 'البيان', 'بيان', 'التفاصيل', 'تفاصيل', 'الوصف', 'وصف', 'الشرح', 'شرح', 'الغرض', 'غرض', 'details', 'description', 'desc', 'statement', 'purpose'],
        ['ملاحظات', 'notes']
      ),
      invoiceNumber: findMatch(
        ['رقم الفاتورة', 'رقم السند', 'رقم الإيصال', 'الفاتورة', 'فاتورة', 'السند', 'سند', 'رقم القيد', 'مرجع', 'المرجع', 'invoice_no', 'invoice_number', 'inv_no', 'bill_no', 'receipt_no', 'ref'],
        ['تاريخ', 'date', 'مبلغ', 'amount']
      ),
      supervisor: findMatch(
        ['المشرف المسؤول', 'اسم المشرف', 'القائم بالصرف', 'المشرف', 'مشرف', 'الموظف', 'المستخدم', 'supervisor', 'user', 'created_by', 'spent_by'],
        ['مشروع', 'project']
      ),
      id: findMatch(
        ['كود السند', 'رقم السند', 'كود المصروف', 'معرف المصروف', 'رقم المصروف', 'المعرف', 'معرف', 'الكود', 'كود', 'المسلسل', 'مسلسل', 'الرقم', 'id', 'expense_id', 'code', 'ref_id'],
        ['مشروع', 'تاريخ']
      ),
      notes: findMatch(
        ['ملاحظات إضافية', 'ملاحظات', 'ملاحظة', 'ملاحظه', 'تعليق', 'تعليقات', 'notes', 'note', 'comments', 'remark', 'remarks']
      )
    };
  };

  // Process Worksheet Data with smart header detection and custom mapping
  const processSheet = (ws: XLSX.WorkSheet, customMapping?: any) => {
    // 1. Read sheet as 2D array of rows
    const raw2D: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!raw2D || raw2D.length === 0) {
      throw new Error('ورقة العمل فارغة تماماً ولا تحتوي على بيانات.');
    }

    // 2. Scan first 15 rows to automatically detect header row index
    const keywordsToScore = [
      'تاريخ', 'date', 'مبلغ', 'amount', 'إجمالي', 'اجمالي', 'مشروع', 'project',
      'بيان', 'تفاصيل', 'details', 'بند', 'تصنيف', 'category', 'فاتورة', 'invoice',
      'سند', 'مدين', 'قيمة', 'ضريبة', 'tax', 'مشرف', 'supervisor'
    ];

    let bestHeaderRowIndex = 0;
    let highestScore = 0;

    const maxScanRows = Math.min(15, raw2D.length);
    for (let r = 0; r < maxScanRows; r++) {
      const row = raw2D[r];
      if (!Array.isArray(row)) continue;
      let score = 0;
      for (const cell of row) {
        const str = String(cell || '').trim().toLowerCase();
        if (!str) continue;
        if (keywordsToScore.some(kw => str.includes(kw))) {
          score += 2;
        } else if (str.length > 1 && str.length < 30) {
          score += 0.5;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestHeaderRowIndex = r;
      }
    }

    // 3. Extract and sanitize column headers
    const rawHeaderRow = raw2D[bestHeaderRowIndex] || [];
    const detectedHeaders: string[] = [];
    const usedHeaders = new Set<string>();

    for (let c = 0; c < rawHeaderRow.length; c++) {
      let title = String(rawHeaderRow[c] || '').trim();
      if (!title) {
        title = `عمود_${c + 1}`;
      }
      let finalTitle = title;
      let dupCount = 1;
      while (usedHeaders.has(finalTitle)) {
        finalTitle = `${title}_${dupCount++}`;
      }
      usedHeaders.add(finalTitle);
      detectedHeaders.push(finalTitle);
    }

    // 4. Determine or update column mapping
    const mapping = customMapping ? { ...customMapping } : autoDetectMapping(detectedHeaders);

    // Fallback: If amount is still not mapped, pick the first non-date non-project column
    if (!mapping.amount && detectedHeaders.length > 0) {
      mapping.amount = detectedHeaders.find(h => !h.includes('تاريخ') && !h.includes('مشروع')) || detectedHeaders[0];
    }

    setSheetHeaders(detectedHeaders);
    setColumnMapping(mapping);

    // 5. Helper to get cell value from row array
    const getRowVal = (rowArr: any[], colName: string) => {
      if (!colName) return '';
      const colIdx = detectedHeaders.indexOf(colName);
      if (colIdx === -1 || colIdx >= rowArr.length) return '';
      return rowArr[colIdx];
    };

    // 6. Parse Data Rows
    const dataRows = raw2D.slice(bestHeaderRowIndex + 1);
    const parsed: ParsedExpenseRow[] = [];

    dataRows.forEach((rowArr) => {
      if (!Array.isArray(rowArr)) return;
      // Skip completely blank rows
      const hasAnyValue = rowArr.some(cell => String(cell || '').trim() !== '');
      if (!hasAnyValue) return;

      const rawAmount = getRowVal(rowArr, mapping.amount);
      const rawTax = getRowVal(rowArr, mapping.tax);
      const rawDate = getRowVal(rowArr, mapping.date);
      const rawPrj = String(getRowVal(rowArr, mapping.project) || '').trim();
      const rawCat = String(getRowVal(rowArr, mapping.category) || '').trim();
      const rawDetails = String(getRowVal(rowArr, mapping.details) || '').trim();
      const rawInv = String(getRowVal(rowArr, mapping.invoiceNumber) || '').trim();
      const rawId = String(getRowVal(rowArr, mapping.id) || '').trim();
      const rawSup = String(getRowVal(rowArr, mapping.supervisor) || '').trim();
      const rawNotes = String(getRowVal(rowArr, mapping.notes) || '').trim();

      const errors: string[] = [];

      // Process Amount
      const amount = parseNumeric(rawAmount);
      if (amount <= 0) {
        errors.push('المبلغ غير صالح أو صفر');
      }

      // Process Tax
      const taxAmount = mapping.tax ? parseNumeric(rawTax) : 0;

      // Process Date
      const date = parseExcelDate(rawDate);

      // Match Project
      let matchedProject = projects.find(
        p =>
          (p.code && p.code.trim().toLowerCase() === rawPrj.toLowerCase()) ||
          p.id.toLowerCase() === rawPrj.toLowerCase() ||
          p.name.trim().toLowerCase() === rawPrj.toLowerCase()
      );

      if (!matchedProject && rawPrj) {
        matchedProject = projects.find(
          p =>
            p.name.trim().toLowerCase().includes(rawPrj.toLowerCase()) ||
            rawPrj.toLowerCase().includes(p.name.trim().toLowerCase())
        );
      }

      let isNewProject = false;
      let prjId = '';
      let prjName = '';

      if (matchedProject) {
        prjId = matchedProject.id;
        prjName = matchedProject.name;
      } else if (rawPrj) {
        isNewProject = true;
        prjId = `PRJ-${rawPrj.replace(/[\s]/g, '_').substring(0, 12).toUpperCase()}`;
        prjName = rawPrj;
      } else {
        const fallback = projects.find(p => p.id === fallbackProjectId) || projects[0];
        if (fallback) {
          prjId = fallback.id;
          prjName = fallback.name;
        } else {
          errors.push('لم يتم تحديد مشروع صالح');
        }
      }

      // Match Category
      let category: ExpenseCategory = 'نثريات ومشتريات';
      if (rawCat) {
        const catMatch = allCategories.find(
          c => c.trim().toLowerCase() === rawCat.toLowerCase() || c.includes(rawCat) || rawCat.includes(c)
        );
        category = catMatch || rawCat;
      }

      // Details
      const details = rawDetails || (rawCat ? `مصروف ${rawCat}` : 'مصروف مستورد من نظام سابق');

      // Supervisor
      const supervisorName = rawSup || currentUser.name;
      const supervisorEmail = currentUser.email;

      parsed.push({
        index: parsed.length + 1,
        originalId: rawId || undefined,
        rawDate,
        date,
        rawProject: rawPrj,
        projectId: prjId,
        projectName: prjName,
        isNewProject,
        category,
        details,
        amount,
        taxAmount,
        invoiceNumber: rawInv,
        supervisorName,
        supervisorEmail,
        notes: rawNotes,
        isValid: errors.length === 0,
        errors
      });
    });

    if (parsed.length === 0) {
      throw new Error('لم يتم العثور على أي صفوف صالحة للبيانات في ورقة العمل هذه.');
    }

    setParsedRows(parsed);
  };

  // Change worksheet and re-parse
  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (!workbookRef.current) return;
    const ws = workbookRef.current.Sheets[newSheet];
    if (!ws) return;
    try {
      setIsProcessing(true);
      processSheet(ws);
      setIsProcessing(false);
    } catch (err: any) {
      setIsProcessing(false);
      showAlert('خطأ في ورقة العمل', err.message, 'warning');
    }
  };

  // Change column mapping manually and re-evaluate
  const handleMappingChange = (field: string, colName: string) => {
    const updatedMapping = { ...columnMapping, [field]: colName };
    setColumnMapping(updatedMapping);
    if (!workbookRef.current || !selectedSheet) return;
    const ws = workbookRef.current.Sheets[selectedSheet];
    if (!ws) return;
    try {
      processSheet(ws, updatedMapping);
    } catch (err: any) {
      showAlert('تنبيه في المطابقة', err.message, 'warning');
    }
  };

  // 1. Download Sample Excel Template with current projects and guidelines
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sample rows
      const templateData = [
        {
          'id': '1001',
          'التاريخ': '2025-06-15',
          'كود أو اسم المشروع': projects[0]?.code || projects[0]?.name || 'PRJ-01',
          'البند': 'مواد بناء',
          'البيان والتفاصيل': 'شراء حديد تسليح وأسمنت للموقع',
          'المبلغ': 15000,
          'الضريبة': 2250,
          'رقم الفاتورة': 'INV-2025-010',
          'اسم المشرف القائم بالصرف': currentUser.name,
          'ملاحظات': 'فاتورة قديمة مستوردة'
        },
        {
          'id': '1002',
          'التاريخ': '2025-06-20',
          'كود أو اسم المشروع': projects[1]?.code || projects[1]?.name || 'برج الأمل التجاري',
          'البند': 'عمالة',
          'البيان والتفاصيل': 'أجور عمالة تشطيبات أسبوعية',
          'المبلغ': 4800,
          'الضريبة': 0,
          'رقم الفاتورة': 'PAY-8821',
          'اسم المشرف القائم بالصرف': currentUser.name,
          'ملاحظات': 'سند صرف أجور عمال'
        },
        {
          'id': '1003',
          'التاريخ': '2025-07-02',
          'كود أو اسم المشروع': projects[0]?.code || projects[0]?.name || 'PRJ-01',
          'البند': 'نثريات ومشتريات',
          'البيان والتفاصيل': 'أدوات سلامة وخوذات وأحذية للموقع',
          'المبلغ': 1250,
          'الضريبة': 187.5,
          'رقم الفاتورة': 'INV-3342',
          'اسم المشرف القائم بالصرف': currentUser.name,
          'ملاحظات': 'مشتريات سلامة مهنية'
        }
      ];

      const wsTemplate = XLSX.utils.json_to_sheet(templateData);

      // Set column widths
      wsTemplate['!cols'] = [
        { wch: 14 }, // id
        { wch: 14 }, // التاريخ
        { wch: 25 }, // المشروع
        { wch: 18 }, // البند
        { wch: 35 }, // البيان
        { wch: 14 }, // المبلغ
        { wch: 12 }, // الضريبة
        { wch: 18 }, // رقم الفاتورة
        { wch: 25 }, // المشرف
        { wch: 25 }, // ملاحظات
      ];

      XLSX.utils.book_append_sheet(wb, wsTemplate, 'المصروفات_المستوردة');

      // Add Reference Sheet for existing Projects & Categories
      const refProjects = projects.map(p => ({
        'كود المشروع': p.code || p.id,
        'اسم المشروع': p.name,
        'العميل / المالك': p.clientName || '-',
        'الموقع': p.location || '-'
      }));
      const wsRefProjects = XLSX.utils.json_to_sheet(refProjects);
      wsRefProjects['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsRefProjects, 'قائمة_المشاريع_الحالية');

      const refCategories = allCategories.map(c => ({
        'اسم البند في النظام': c
      }));
      const wsRefCategories = XLSX.utils.json_to_sheet(refCategories);
      wsRefCategories['!cols'] = [{ wch: 28 }];
      XLSX.utils.book_append_sheet(wb, wsRefCategories, 'بنود_وتصنيفات_النظام');

      // Export file
      XLSX.writeFile(wb, `نموذج_استيراد_مصروفات_${settings.companyName || 'النظام'}.xlsx`);

      addNotification(
        'تنزيل نموذج إكسيل',
        'تم تنزيل نموذج استيراد المصروفات الجاهز بنجاح مع قائمة المشاريع والبنود.',
        'system'
      );
    } catch (err) {
      showAlert('خطأ', 'تعذر تنزيل ملف النموذج، يرجى المحاولة مرة أخرى.', 'error');
    }
  };

  // 2. Parse uploaded file with multi-sheet detection
  const handleFileUpload = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      workbookRef.current = wb;

      const sheets = wb.SheetNames;
      if (!sheets || sheets.length === 0) {
        throw new Error('لم يتم العثور على أوراق عمل صالحة في الملف.');
      }
      setAvailableSheets(sheets);

      // Pick default sheet (favoring names with 'مصروف', 'expense', 'حساب', 'فواتير')
      const defaultSheet = sheets.find(n =>
        n.includes('مصروف') || n.includes('expense') || n.includes('حساب') || n.includes('فواتير')
      ) || sheets[0];

      setSelectedSheet(defaultSheet);

      const ws = wb.Sheets[defaultSheet];
      if (!ws) {
        throw new Error('ورقة العمل المحددة غير صالحة.');
      }

      processSheet(ws);
      setActiveTab('preview');
      setIsProcessing(false);
    } catch (err: any) {
      setIsProcessing(false);
      showAlert('فشل قراءة الملف', err.message || 'تعذر تحليل محتويات ملف الإكسيل. تأكد من أن الملف سليم وبصيغة xlsx أو csv.', 'error');
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileUpload(droppedFile);
    }
  };

  // Metrics
  const totalRows = parsedRows.length;
  const validRows = parsedRows.filter(r => r.isValid);
  const errorRows = parsedRows.filter(r => !r.isValid);
  const totalAmount = validRows.reduce((sum, r) => sum + r.amount, 0);
  const totalTax = validRows.reduce((sum, r) => sum + r.taxAmount, 0);

  // New projects detected
  const uniqueNewProjects = useMemo(() => {
    const map = new Map<string, string>();
    parsedRows.forEach(r => {
      if (r.isNewProject && r.projectName && !projects.some(p => p.id === r.projectId || p.name.trim().toLowerCase() === r.projectName.trim().toLowerCase())) {
        map.set(r.projectId, r.projectName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [parsedRows, projects]);

  // Filtered rows for preview table
  const displayedRows = useMemo(() => {
    if (filterPreview === 'valid') return validRows;
    if (filterPreview === 'errors') return errorRows;
    return parsedRows;
  }, [filterPreview, parsedRows, validRows, errorRows]);

  // 3. Confirm & Execute Import
  const handleConfirmImport = async () => {
    if (validRows.length === 0) {
      showAlert('لا توجد بيانات صالحة', 'لا توجد صفوف صالحة للاستيراد في الملف.', 'warning');
      return;
    }

    setIsImporting(true);

    try {
      // 1. Prepare new projects if auto-create enabled
      const newProjectsToCreate: Project[] = [];
      if (autoCreateProjects && uniqueNewProjects.length > 0) {
        uniqueNewProjects.forEach(np => {
          newProjectsToCreate.push({
            id: np.id,
            name: np.name,
            code: np.id.replace('PRJ-', ''),
            budget: 0,
            status: 'جاري',
            emails: currentUser.email,
            clientName: 'مستورد من نظام خارجي',
            location: 'الموقع الميداني',
            description: 'تم إنشاء المشروع تلقائياً أثناء استيراد المصروفات السابقة',
            createdAt: new Date().toISOString()
          });
        });
      }

      // 2. Prepare Expense Objects
      const nowIso = new Date().toISOString();
      const createdExpenses: Expense[] = validRows.map((row, idx) => {
        const expenseId = row.originalId
          ? (row.originalId.toUpperCase().startsWith('EXP-') ? row.originalId.toUpperCase() : `EXP-${row.originalId.toUpperCase()}`)
          : `EXP-HIST-${Date.now().toString().slice(-4)}${idx + 1}`;

        // Determine final project ID & name
        let finalPrjId = row.projectId;
        let finalPrjName = row.projectName;

        if (row.isNewProject && !autoCreateProjects) {
          // Fallback to selected project
          const fb = projects.find(p => p.id === fallbackProjectId) || projects[0];
          if (fb) {
            finalPrjId = fb.id;
            finalPrjName = fb.name;
          }
        }

        const isApproved = autoApproveHistorical;

        return {
          id: expenseId,
          legacyId: row.originalId || undefined,
          date: row.date,
          fingerprintTime: `${row.date}T10:00:00.000Z`,
          supervisorEmail: row.supervisorEmail || currentUser.email,
          supervisorName: row.supervisorName || currentUser.name,
          projectId: finalPrjId,
          projectName: finalPrjName,
          category: row.category,
          details: row.details,
          amount: row.amount,
          taxAmount: row.taxAmount || 0,
          invoiceNumber: row.invoiceNumber || undefined,
          updatedAt: nowIso,
          status: isApproved ? 'معتمد' : 'بانتظار مراجعة وترحيل المحاسب المالي',
          accountantApproval: isApproved ? 'تم الاعتماد' : 'غير معتمد',
          accountantNotes: isApproved ? 'معتمد تلقائياً كرصيد تاريخي سابق مستورد من برنامج آخر' : undefined,
          managementApproval: isApproved ? 'تم اعتماد الادارة' : 'غير معتمد',
          managementNotes: isApproved ? 'اعتماد تاريخي مستورد' : undefined,
          projectManagerApproval: isApproved ? 'تم اعتماد المشرف' : 'غير معتمد',
          erpPostingStatus: isApproved ? 'تم الترحيل للبرنامج المحاسبي' : 'بانتظار الترحيل',
          erpReferenceNumber: row.invoiceNumber || `HIST-${expenseId}`,
          erpSystemName: 'نظام محاسبي سابق',
          synced: true,
          workflowHistory: [
            {
              stageId: 'historical_import',
              stageTitle: 'استيراد مصروفات سابقة من نظام آخر',
              status: isApproved ? 'approved' : 'pending',
              actionByEmail: currentUser.email,
              actionByName: currentUser.name,
              actionRole: currentUser.role,
              actionTime: nowIso,
              notes: isApproved
                ? `تم استيراد هذا المصروف كسجل تاريخي معتمد مسبقاً بمبلغ ${row.amount.toLocaleString()} ${settings.currencySymbol}.`
                : `تم استيراد المصروف بانتظار استكمال مسار الاعتماد.`
            }
          ]
        };
      });

      // Execute bulk import
      const result = await bulkImportExpenses(createdExpenses, newProjectsToCreate);

      setIsImporting(false);

      if (result.success) {
        showAlert(
          'تم الاستيراد بنجاح',
          `تم بنجاح إضافة (${createdExpenses.length}) سند مصروف إلى النظام${newProjectsToCreate.length > 0 ? ` وتأسيس (${newProjectsToCreate.length}) مشروع جديد` : ''}.`,
          'success'
        );
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showAlert('تنبيه في الاستيراد', result.message, 'warning');
      }
    } catch (err: any) {
      setIsImporting(false);
      showAlert('خطأ أثناء الاستيراد', err.message || 'حدث خطأ غير متوقع أثناء حفظ البيانات.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>استيراد مصروفات سابقة (Excel / CSV)</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                  ذكي وسريع
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تنزيل نموذج إكسيل موثق، رفع ملفك القديم، والتحقق التلقائي من المشاريع والمبالغ
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-6">

          {/* Quick Guide & Download Template Strip */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/60 to-blue-50/40 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-blue-950/20 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  هل تريد تنزيل نموذج شيت إكسيل جاهز يحتوي على قائمة مشاريعك الحالية؟
                </h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  قم بتحميل النموذج المرفق؛ فهو مهيأ مسبقاً بالأعمدة المطلوبة، وأمثلة استرشادية، وقائمة بكافة مشاريعك وبنودك الحالية في النظام لمنع الأخطاء الإملائية.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل نموذج إكسيل فارغ (.xlsx)</span>
            </button>
          </div>

          {/* Bulk Attach Photos Hint */}
          {onOpenBulkAttach && (
            <div className="bg-indigo-50/70 dark:bg-indigo-950/30 px-4 py-3 rounded-2xl border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>لديك مجلد صور للفواتير على جهازك يبدأ اسم كل صورة برقم السند (ID) وتريد ربطها؟</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBulkAttach();
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl shadow-xs shrink-0 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>فتح معالج ربط الصور</span>
                <span className="font-mono">←</span>
              </button>
            </div>
          )}

          {/* Upload / File Picker Zone */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-8 sm:p-12 text-center bg-slate-50/50 dark:bg-slate-800/30 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>

                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                    اضغط هنا لاختيار ملف الإكسيل، أو اسحب الملف وأفلته مباشرة
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    يدعم ملفات Microsoft Excel (.xlsx, .xls) وملفات القيم المفصولة بفواصل (.csv)
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-3 py-1 rounded-full font-medium mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>التعرف الذكي التلقائي على أسماء الأعمدة العربية والإنجليزية</span>
                </div>
              </div>

              {/* Instructions / Mapping Guide */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>الأعمدة التي يتعرف عليها النظام في ملفك القديم:</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                    <span className="font-bold block text-indigo-700 dark:text-indigo-300">المعرف (id)</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">كود يطابق بداية اسم ملفات الصور</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">التاريخ (Date)</span>
                    <span className="text-slate-400 text-[10px]">YYYY-MM-DD أو DD/MM/YYYY</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">المشروع (Project)</span>
                    <span className="text-slate-400 text-[10px]">كود المشروع أو اسم المشروع</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">البند (Category)</span>
                    <span className="text-slate-400 text-[10px]">مواد بناء، عمالة، مقاولين...</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">المبلغ (Amount)</span>
                    <span className="text-slate-400 text-[10px]">أرقام فقط (القيمة الصافية)</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">الضريبة (Tax)</span>
                    <span className="text-slate-400 text-[10px]">قيمة الضريبة إن وجدت</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">رقم الفاتورة (Invoice)</span>
                    <span className="text-slate-400 text-[10px]">رقم السند أو الفاتورة القديمة</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">البيان (Details)</span>
                    <span className="text-slate-400 text-[10px]">شرح وتفاصيل الصرف</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">المشرف (Supervisor)</span>
                    <span className="text-slate-400 text-[10px]">اسم القائم بالصرف</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">ملاحظات (Notes)</span>
                    <span className="text-slate-400 text-[10px]">أي ملاحظات إضافية</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview & Confirmation View */}
          {activeTab === 'preview' && (
            <div className="space-y-5">
              {/* Top Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block font-medium">إجمالي السجلات المقروءة</span>
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {totalRows.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block font-medium">السجلات الصالحة</span>
                  <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {validRows.length.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60">
                  <span className="text-[11px] text-blue-700 dark:text-blue-300 block font-medium">إجمالي المبالغ</span>
                  <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                    {totalAmount.toLocaleString()} {settings.currencySymbol}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60">
                  <span className="text-[11px] text-purple-700 dark:text-purple-300 block font-medium">إجمالي الضرائب</span>
                  <span className="text-lg font-extrabold text-purple-600 dark:text-purple-400">
                    {totalTax.toLocaleString()} {settings.currencySymbol}
                  </span>
                </div>
              </div>

              {/* Multi-Sheet Selector if workbook has more than 1 sheet */}
              {availableSheets.length > 1 && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      يحتوي الملف على {availableSheets.length} أوراق عمل:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">اختر الورقة المطلوبة:</span>
                    <select
                      value={selectedSheet}
                      onChange={e => handleSheetChange(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-xs font-bold text-indigo-900 dark:text-indigo-200 shadow-2xs cursor-pointer"
                    >
                      {availableSheets.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Interactive Column Mapping Panel */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>مطابقة وتعيين أعمدة الإكسيل</span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                          تعرف ذكي تلقائي
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        تم ربط عمود المبلغ بـ <strong className="text-slate-700 dark:text-slate-200">({columnMapping.amount || 'غير محدد'})</strong> وعمود المشروع بـ <strong className="text-slate-700 dark:text-slate-200">({columnMapping.project || 'تلقائي'})</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMappingSettings(!showMappingSettings)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{showMappingSettings ? 'إخفاء تخصيص الأعمدة' : 'تعديل تخصيص الأعمدة'}</span>
                    {showMappingSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showMappingSettings && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                    {/* Field: Amount (Required) */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span className="text-rose-500 font-bold">*</span>
                        <span>عمود المبلغ (صافي/إجمالي):</span>
                      </label>
                      <select
                        value={columnMapping.amount}
                        onChange={e => handleMappingChange('amount', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">-- اختر عمود المبلغ --</option>
                        {sheetHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Field: Date */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">عمود التاريخ:</label>
                      <select
                        value={columnMapping.date}
                        onChange={e => handleMappingChange('date', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">-- اختر عمود التاريخ --</option>
                        {sheetHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Field: Project */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">عمود المشروع:</label>
                      <select
                        value={columnMapping.project}
                        onChange={e => handleMappingChange('project', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">-- اختر عمود المشروع --</option>
                        {sheetHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Field: Category */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">عمود البند / الفئة:</label>
                      <select
                        value={columnMapping.category}
                        onChange={e => handleMappingChange('category', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">-- اختر عمود البند --</option>
                        {sheetHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Field: Details */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">عمود البيان / الشرح:</label>
                      <select
                        value={columnMapping.details}
                        onChange={e => handleMappingChange('details', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">-- اختر عمود البيان --</option>
                        {sheetHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Field: Tax */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">عمود الضريبة:</label>
                      <select
                        value={columnMapping.tax}
                        onChange={e => handleMappingChange('tax', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">-- بدون ضريبة / اختياري --</option>
                        {sheetHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Field: Invoice Number */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">عمود رقم الفاتورة / السند:</label>
                      <select
                        value={columnMapping.invoiceNumber}
                        onChange={e => handleMappingChange('invoiceNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">-- اختياري --</option>
                        {sheetHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Field: Supervisor */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">عمود المشرف / الموظف:</label>
                      <select
                        value={columnMapping.supervisor}
                        onChange={e => handleMappingChange('supervisor', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">-- المشرف الحالي تلقائياً --</option>
                        {sheetHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Import Configuration Switches */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>خيارات الترحيل والاعتماد للمصروفات المستوردة:</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Option 1: Auto Approve Historical */}
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-emerald-500 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoApproveHistorical}
                      onChange={e => setAutoApproveHistorical(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        اعتماد السندات تلقائياً (بيانات تاريخية سابقة منتهية)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                        تُسجل كفواتير معتمدة نهائياً من المشرف والمحاسب والإدارة العليا ومرحلة محاسبياً دون الحاجة لتمريرها على دورة الاعتماد من جديد.
                      </span>
                    </div>
                  </label>

                  {/* Option 2: Auto Create Missing Projects */}
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-emerald-500 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoCreateProjects}
                      onChange={e => setAutoCreateProjects(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        إنشاء المشاريع غير المسجلة تلقائياً ({uniqueNewProjects.length} مشروع جديد)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                        إذا تم رصد أسماء مشاريع قديمة غير مسجلة في النظام الحالي، سيتم إنشاؤها تلقائياً وربط المصروفات بها.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Fallback Project selector if needed */}
                {(!autoCreateProjects && uniqueNewProjects.length > 0) && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>مشروع بديل لإسناد المصروفات التي لم يُعثر على مشروع مطابق لها:</span>
                    </div>
                    <select
                      value={fallbackProjectId}
                      onChange={e => setFallbackProjectId(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code || p.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Table Toolbar / Filters */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFilterPreview('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      filterPreview === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    كافة السجلات ({parsedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPreview('valid')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      filterPreview === 'valid'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    الصحيحة فقط ({validRows.length})
                  </button>
                  {errorRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterPreview('errors')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        filterPreview === 'errors'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      تحتاج مراجعة ({errorRows.length})
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsedRows([]);
                    setActiveTab('upload');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>اختيار ملف آخر</span>
                </button>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 sticky top-0 font-bold border-b border-slate-200 dark:border-slate-700 z-10">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5">المعرف (id)</th>
                        <th className="p-2.5">التاريخ</th>
                        <th className="p-2.5">المشروع</th>
                        <th className="p-2.5">البند</th>
                        <th className="p-2.5">البيان</th>
                        <th className="p-2.5 text-left">المبلغ</th>
                        <th className="p-2.5 text-left">الضريبة</th>
                        <th className="p-2.5">الفاتورة</th>
                        <th className="p-2.5">المشرف</th>
                        <th className="p-2.5 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-slate-400">
                            لا توجد صفوف لعرضها وفقاً للتصفية الحالية.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map(row => (
                          <tr
                            key={row.index}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                              !row.isValid ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                            }`}
                          >
                            <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                              {row.index}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap text-[11px]">
                              {row.originalId || '-'}
                            </td>
                            <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {row.date}
                            </td>
                            <td className="p-2.5 font-medium whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[140px] text-slate-900 dark:text-white" title={row.projectName}>
                                  {row.projectName}
                                </span>
                                {row.isNewProject && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold">
                                    جديد
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px]">
                                {row.category}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={row.details}>
                              {row.details}
                            </td>
                            <td className="p-2.5 text-left font-bold font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {row.amount.toLocaleString()} {settings.currencySymbol}
                            </td>
                            <td className="p-2.5 text-left font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {row.taxAmount > 0 ? `${row.taxAmount.toLocaleString()} ${settings.currencySymbol}` : '-'}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {row.invoiceNumber || '-'}
                            </td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {row.supervisorName}
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  جاهز
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full font-bold border border-rose-200 dark:border-rose-800" title={row.errors.join('، ')}>
                                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                                  {row.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'preview' && (
              <span>
                سيتم استيراد <strong className="text-slate-900 dark:text-white font-bold">{validRows.length}</strong> سند مصروفات بقيمة إجمالية <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalAmount.toLocaleString()} {settings.currencySymbol}</strong>.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            {activeTab === 'preview' && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || validRows.length === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ وتثبيت السندات...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد استيراد ({validRows.length}) مصروف الآن</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

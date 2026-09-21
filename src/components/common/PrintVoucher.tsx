import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { exportElementToPdf, PaperSize, PageOrientation } from '../../utils/pdfExport';
import {
  Printer,
  X,
  Building2,
  MapPin,
  Check,
  CheckCircle2,
  Clock,
  FileDown,
  Loader2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Settings2,
  Droplet,
  FileText,
  Sparkles,
  QrCode,
  ShieldCheck,
  Layers,
  Maximize,
  LayoutTemplate,
  Move,
  Lock,
  Unlock,
  Crosshair,
  Maximize as StretchIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { LogoPosition, LogoSize, Expense } from '../../types';

export type PrintMarginOption = 'standard' | 'compact' | 'wide' | 'none' | 'custom';
export type PrintFontSizeOption = 'sm' | 'md' | 'lg' | 'xl';
export type PrintColorMode = 'full' | 'grayscale' | 'bw';

export interface PrintTableColumnDef {
  id: string;
  label: string;
  alwaysVisible?: boolean;
}

export const REPORT_PRINT_COLUMNS: PrintTableColumnDef[] = [
  { id: 'id', label: 'رقم السند', alwaysVisible: true },
  { id: 'date', label: 'التاريخ' },
  { id: 'projectName', label: 'المشروع' },
  { id: 'supervisor', label: 'المشرف المسؤول' },
  { id: 'category', label: 'البند والتصنيف' },
  { id: 'details', label: 'البيان والشرح' },
  { id: 'amount', label: 'المبلغ', alwaysVisible: true },
  { id: 'taxAmount', label: 'الضريبة (VAT)' },
  { id: 'invoiceNumber', label: 'رقم الفاتورة' },
  { id: 'status', label: 'الحالة' },
];

export interface LogoTransform {
  x: number; // offset X in pixels from reference
  y: number; // offset Y in pixels from reference
  width: number; // width in pixels
  height: number; // height in pixels
  lockAspectRatio: boolean;
}

interface PrintCustomizationSettings {
  paperSize: PaperSize;
  orientation: PageOrientation;
  scalePercent: number; // 50 to 150
  marginOption: PrintMarginOption;
  customMarginMm: number; // 0 to 25
  fontSize: PrintFontSizeOption;
  colorMode: PrintColorMode;
  logoPosition: LogoPosition;
  logoSize: LogoSize;
  logoTransform: LogoTransform;
  showSignatures: boolean;
  showAuditTrail: boolean;
  showGpsStamp: boolean;
  showQrCode: boolean;
  showTaxDetails: boolean;
  showFooterPageNum: boolean;
}

const DEFAULT_LOGO_TRANSFORM: LogoTransform = {
  x: 0,
  y: 0,
  width: 90,
  height: 65,
  lockAspectRatio: false,
};

const DEFAULT_PRINT_SETTINGS: PrintCustomizationSettings = {
  paperSize: 'a4',
  orientation: 'portrait',
  scalePercent: 100,
  marginOption: 'standard',
  customMarginMm: 8,
  fontSize: 'md',
  colorMode: 'full',
  logoPosition: 'right',
  logoSize: 'md',
  logoTransform: DEFAULT_LOGO_TRANSFORM,
  showSignatures: true,
  showAuditTrail: true,
  showGpsStamp: true,
  showQrCode: true,
  showTaxDetails: true,
  showFooterPageNum: true,
};

const STORAGE_KEY = 'sys_financial_print_preferences_v3';

export const PrintVoucher: React.FC = () => {
  const {
    printData,
    isPrintModalOpen,
    setIsPrintModalOpen,
    settings,
    expenses,
    currentUser,
    updateSettings,
    showAlert
  } = useApp();

  // Load saved preferences or defaults
  const [printConfig, setPrintConfig] = useState<PrintCustomizationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_PRINT_SETTINGS,
          ...parsed,
          logoTransform: {
            ...DEFAULT_LOGO_TRANSFORM,
            ...(parsed.logoTransform || {})
          }
        };
      }
    } catch {
      // ignore
    }
    return {
      ...DEFAULT_PRINT_SETTINGS,
      logoPosition: settings.defaultLogoPosition || 'right',
      logoSize: settings.defaultLogoSize || 'md',
    };
  });

  const [isOptionsDrawerOpen, setIsOptionsDrawerOpen] = useState(false);
  const [savedAsDefaultNotice, setSavedAsDefaultNotice] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'typography' | 'elements' | 'columns'>('elements');
  const [isLogoSelected, setIsLogoSelected] = useState(true);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isResizingLogo, setIsResizingLogo] = useState<string | null>(null);
  const [customPrintColumns, setCustomPrintColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('reports_table_columns_visibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((c: string) => c !== 'actions');
        }
      }
    } catch {
      // ignore
    }
    return REPORT_PRINT_COLUMNS.map(c => c.id);
  });

  // Synchronize column visibility from printData or localStorage
  useEffect(() => {
    if (!isPrintModalOpen || !printData) return;

    if (printData.type === 'filtered_report') {
      if (Array.isArray(printData.data?.visibleColumns) && printData.data.visibleColumns.length > 0) {
        setCustomPrintColumns(printData.data.visibleColumns.filter((c: string) => c !== 'actions'));
      } else {
        try {
          const saved = localStorage.getItem('reports_table_columns_visibility');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCustomPrintColumns(parsed.filter((c: string) => c !== 'actions'));
              return;
            }
          }
        } catch {
          // ignore
        }
        setCustomPrintColumns(REPORT_PRINT_COLUMNS.map(c => c.id));
      }
    } else if (printData.type === 'expense_list') {
      if (Array.isArray(printData.data?.visibleColumns) && printData.data.visibleColumns.length > 0) {
        const raw = printData.data.visibleColumns;
        const mapped: string[] = [];
        if (raw.includes('id')) mapped.push('id');
        if (raw.includes('dateAndProject') || raw.includes('date')) {
          mapped.push('date');
          mapped.push('projectName');
        }
        if (raw.includes('categoryAndDesc') || raw.includes('category')) {
          mapped.push('category');
          mapped.push('details');
        }
        if (raw.includes('supervisor')) mapped.push('supervisor');
        if (raw.includes('amount')) mapped.push('amount');
        if (raw.includes('taxAmount') || raw.includes('tax')) mapped.push('taxAmount');
        if (raw.includes('invoiceNumber') || raw.includes('locationAndReceipt')) mapped.push('invoiceNumber');
        if (raw.includes('status')) mapped.push('status');
        setCustomPrintColumns(mapped.length > 0 ? mapped : REPORT_PRINT_COLUMNS.map(c => c.id));
      } else {
        try {
          const saved = localStorage.getItem('reports_table_columns_visibility');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCustomPrintColumns(parsed.filter((c: string) => c !== 'actions'));
              return;
            }
          }
        } catch {
          // ignore
        }
        setCustomPrintColumns(REPORT_PRINT_COLUMNS.map(c => c.id));
      }
    } else if (printData.type === 'project_report') {
      try {
        const saved = localStorage.getItem('reports_table_columns_visibility');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomPrintColumns(parsed.filter((c: string) => c !== 'actions'));
            return;
          }
        }
      } catch {
        // ignore
      }
      setCustomPrintColumns(REPORT_PRINT_COLUMNS.map(c => c.id));
    }
  }, [isPrintModalOpen, printData]);

  const isColVisible = useCallback((colId: string) => {
    if (!customPrintColumns || customPrintColumns.length === 0) return true;
    return customPrintColumns.includes(colId);
  }, [customPrintColumns]);

  const handleTogglePrintColumn = (colId: string) => {
    const colDef = REPORT_PRINT_COLUMNS.find(c => c.id === colId);
    if (colDef?.alwaysVisible) return;
    setCustomPrintColumns(prev => {
      let updated: string[];
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev;
        updated = prev.filter(c => c !== colId);
      } else {
        updated = [...prev, colId];
      }
      try {
        localStorage.setItem('reports_table_columns_visibility', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleShowAllPrintColumns = () => {
    const all = REPORT_PRINT_COLUMNS.map(c => c.id);
    setCustomPrintColumns(all);
    try {
      localStorage.setItem('reports_table_columns_visibility', JSON.stringify(all));
    } catch {
      // ignore
    }
  };

  const handleShowEssentialColumns = () => {
    const essential = ['id', 'date', 'projectName', 'amount', 'status'];
    setCustomPrintColumns(essential);
    try {
      localStorage.setItem('reports_table_columns_visibility', JSON.stringify(essential));
    } catch {
      // ignore
    }
  };

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const printableSheetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; initialW: number; initialH: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    initialW: 90,
    initialH: 65
  });

  // Auto-adapt default orientation if table is wide
  useEffect(() => {
    if (printData && (printData.type === 'filtered_report' || printData.type === 'expense_list')) {
      setPrintConfig(prev => ({
        ...prev,
        orientation: prev.orientation || 'landscape'
      }));
    }
  }, [printData]);

  // Stable reference code and print date
  const refNumber = useMemo(() => Math.floor(100000 + Math.random() * 900000), [printData]);
  const printDateStr = useMemo(() => {
    return `${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}`;
  }, [printData]);

  // Calculate actual margin in mm
  const effectiveMarginMm = useMemo(() => {
    switch (printConfig.marginOption) {
      case 'none':
        return 0;
      case 'compact':
        return 4;
      case 'wide':
        return 16;
      case 'custom':
        return printConfig.customMarginMm;
      case 'standard':
      default:
        return 8;
    }
  }, [printConfig.marginOption, printConfig.customMarginMm]);

  // Update dynamic CSS for print media
  useEffect(() => {
    if (!isPrintModalOpen) return;

    let styleEl = document.getElementById('dynamic-print-page-style') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-print-page-style';
      document.head.appendChild(styleEl);
    }

    const { paperSize, orientation, scalePercent, colorMode } = printConfig;
    const isLandscape = orientation === 'landscape' && paperSize !== 'receipt';
    const zoomFactor = scalePercent / 100;

    let pageCssSize = 'A4 portrait';
    if (paperSize === 'receipt') {
      pageCssSize = '80mm 200mm';
    } else {
      pageCssSize = `${paperSize.toUpperCase()} ${isLandscape ? 'landscape' : 'portrait'}`;
    }

    styleEl.innerHTML = `
      @media print {
        @page {
          size: ${pageCssSize};
          margin: ${effectiveMarginMm}mm;
        }
        #printable-voucher-content {
          zoom: ${zoomFactor} !important;
          transform-origin: top center !important;
          ${colorMode === 'grayscale' ? 'filter: grayscale(100%) !important;' : ''}
          ${colorMode === 'bw' ? 'filter: grayscale(100%) contrast(150%) !important;' : ''}
        }
        .logo-interactive-controls,
        .logo-resize-handle,
        .logo-dimension-tooltip {
          display: none !important;
        }
      }
    `;

    return () => {
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [isPrintModalOpen, printConfig, effectiveMarginMm]);

  // Construct readable file name for downloads
  const getDocumentFileName = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    if (!printData) return `مستند_${dateStamp}.pdf`;
    switch (printData.type) {
      case 'expense':
        return `سند_صرف_${printData.data.id || 'مصروف'}_${dateStamp}.pdf`;
      case 'custody_statement':
        return `كشف_حساب_عهدة_${printData.data.name || 'مشرف'}_${dateStamp}.pdf`;
      case 'project_report':
        return `تقرير_مشروع_${printData.data.name || 'مشروع'}_${dateStamp}.pdf`;
      case 'filtered_report':
        return `تقرير_مصروفات_شامل_${dateStamp}.pdf`;
      case 'expense_list':
        return `كشف_سندات_مصروفات_${dateStamp}.pdf`;
      default:
        return `مستند_${dateStamp}.pdf`;
    }
  };

  // Keyboard shortcut listener for Ctrl+P / Escape
  useEffect(() => {
    if (!isPrintModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleTriggerPrint();
      }
      if (e.key === 'Escape') {
        setIsPrintModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintModalOpen, printData, printConfig]);

  // Handle Logo Drag Start (Moving logo anywhere on the document)
  const handleLogoDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Switch to custom/free position mode immediately on drag
    if (printConfig.logoPosition !== 'custom' && printConfig.logoPosition !== 'free') {
      setPrintConfig(prev => ({
        ...prev,
        logoPosition: 'custom'
      }));
    }

    setIsDraggingLogo(true);
    setIsResizingLogo(null);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: printConfig.logoTransform.x,
      initialY: printConfig.logoTransform.y,
      initialW: printConfig.logoTransform.width,
      initialH: printConfig.logoTransform.height,
    };
  };

  // Handle Logo Multi-Directional Resize Start (Stretching in any direction)
  const handleLogoResizeStart = (handle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (printConfig.logoPosition !== 'custom' && printConfig.logoPosition !== 'free') {
      setPrintConfig(prev => ({
        ...prev,
        logoPosition: 'custom'
      }));
    }

    setIsResizingLogo(handle);
    setIsDraggingLogo(false);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: printConfig.logoTransform.x,
      initialY: printConfig.logoTransform.y,
      initialW: printConfig.logoTransform.width,
      initialH: printConfig.logoTransform.height,
    };
  };

  // Global Mouse Move and Up for Dragging & Stretching
  useEffect(() => {
    if (!isDraggingLogo && !isResizingLogo) return;

    const handleMouseMove = (e: MouseEvent) => {
      const zoomFactor = (printConfig.scalePercent || 100) / 100;
      const dx = (e.clientX - dragStartRef.current.startX) / zoomFactor;
      const dy = (e.clientY - dragStartRef.current.startY) / zoomFactor;

      if (isDraggingLogo) {
        // Move logo freely
        setPrintConfig(prev => ({
          ...prev,
          logoPosition: 'custom',
          logoTransform: {
            ...prev.logoTransform,
            x: Math.round(dragStartRef.current.initialX + dx),
            y: Math.round(dragStartRef.current.initialY + dy),
          }
        }));
      } else if (isResizingLogo) {
        // Multi-directional stretch calculation
        const handle = isResizingLogo;
        let newW = dragStartRef.current.initialW;
        let newH = dragStartRef.current.initialH;
        let newX = dragStartRef.current.initialX;
        let newY = dragStartRef.current.initialY;

        // Horizontal stretch
        if (handle.includes('e')) {
          newW = Math.max(30, Math.min(500, Math.round(dragStartRef.current.initialW + dx)));
        } else if (handle.includes('w')) {
          const deltaW = -dx;
          newW = Math.max(30, Math.min(500, Math.round(dragStartRef.current.initialW + deltaW)));
          newX = Math.round(dragStartRef.current.initialX + (dragStartRef.current.initialW - newW));
        }

        // Vertical stretch
        if (handle.includes('s')) {
          newH = Math.max(20, Math.min(400, Math.round(dragStartRef.current.initialH + dy)));
        } else if (handle.includes('n')) {
          const deltaH = -dy;
          newH = Math.max(20, Math.min(400, Math.round(dragStartRef.current.initialH + deltaH)));
          newY = Math.round(dragStartRef.current.initialY + (dragStartRef.current.initialH - newH));
        }

        // Lock aspect ratio constraint if enabled
        if (printConfig.logoTransform.lockAspectRatio) {
          const initialRatio = dragStartRef.current.initialW / dragStartRef.current.initialH;
          if (handle.includes('e') || handle.includes('w')) {
            newH = Math.round(newW / initialRatio);
          } else {
            newW = Math.round(newH * initialRatio);
          }
        }

        setPrintConfig(prev => ({
          ...prev,
          logoPosition: 'custom',
          logoTransform: {
            ...prev.logoTransform,
            width: newW,
            height: newH,
            x: newX,
            y: newY,
          }
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLogo(false);
      setIsResizingLogo(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLogo, isResizingLogo, printConfig.scalePercent, printConfig.logoTransform.lockAspectRatio]);

  if (!isPrintModalOpen || !printData) return null;

  // Programmatic PDF Generation and Direct Download
  const handleDownloadPdf = async () => {
    const contentEl = document.getElementById('printable-voucher-content');
    if (!contentEl) {
      showAlert('تنبيه', 'تعذر العثور على محتوى المستند للتحميل.', 'warning');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const fileName = getDocumentFileName();
      
      await exportElementToPdf(contentEl, {
        fileName,
        marginMm: effectiveMarginMm,
        scale: 2,
        quality: 0.98,
        orientation: printConfig.orientation,
        paperSize: printConfig.paperSize,
        colorMode: printConfig.colorMode
      });

      showAlert(
        'تم حفظ وتنزيل الـ PDF بنجاح',
        `تم تنزيل المستند بمقاس (${printConfig.paperSize.toUpperCase()}) واتجاه (${printConfig.orientation === 'landscape' ? 'أفقي' : 'عمودي'}) وموضع الشعار المخصص بنجاح باسم: (${fileName}).`,
        'success'
      );
    } catch (error) {
      console.error('PDF export error:', error);
      showAlert(
        'تعذر التحميل المباشر للـ PDF',
        'حدث خطأ غير متوقع أثناء معالجة المستند. يمكنك النقر على "طباعة المستند" واختيار "حفظ كـ PDF" كبديل.',
        'error'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Smart Native System Print
  const handleTriggerPrint = () => {
    try {
      const printContent = document.getElementById('printable-voucher-content');
      if (!printContent) {
        window.focus();
        window.print();
        return;
      }

      document.body.classList.add('printing-voucher-active');

      const cleanupPrintStyles = () => {
        document.body.classList.remove('printing-voucher-active');
        window.removeEventListener('afterprint', cleanupPrintStyles);
      };

      window.addEventListener('afterprint', cleanupPrintStyles);

      window.focus();
      window.print();

      setTimeout(cleanupPrintStyles, 2500);
    } catch (error) {
      console.warn('Direct window.print error, fallback:', error);
      handleOpenPrintWindow();
    }
  };

  // Dedicated Standalone Print Window Fallback
  const handleOpenPrintWindow = () => {
    const printContent = document.getElementById('printable-voucher-content');
    if (!printContent) return;

    try {
      const printWin = window.open('', '_blank', 'width=1000,height=850,menubar=yes,toolbar=yes');
      if (printWin) {
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
          .map(el => el.outerHTML)
          .join('\n');

        const { paperSize, orientation, scalePercent, colorMode } = printConfig;
        const isLandscape = orientation === 'landscape' && paperSize !== 'receipt';
        const pageCssSize = paperSize === 'receipt' ? '80mm 200mm' : `${paperSize.toUpperCase()} ${isLandscape ? 'landscape' : 'portrait'}`;

        printWin.document.open();
        printWin.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <meta charset="utf-8" />
              <title>${getDocumentFileName().replace('.pdf', '')}</title>
              ${styles}
              <style>
                @page { size: ${pageCssSize}; margin: ${effectiveMarginMm}mm; }
                body {
                  background-color: #ffffff !important;
                  color: #0f172a !important;
                  font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
                  padding: ${effectiveMarginMm}mm !important;
                  margin: 0 !important;
                  direction: rtl !important;
                  zoom: ${scalePercent / 100} !important;
                  ${colorMode === 'grayscale' ? 'filter: grayscale(100%) !important;' : ''}
                  ${colorMode === 'bw' ? 'filter: grayscale(100%) contrast(150%) !important;' : ''}
                }
                .print\\:hidden, button, .logo-interactive-controls, .logo-resize-handle, .logo-dimension-tooltip { display: none !important; }
                table { width: 100%; border-collapse: collapse; }
                tr { break-inside: avoid; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              </style>
            </head>
            <body class="bg-white text-slate-900">
              <div style="margin-bottom: 16px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: left;" class="print:hidden">
                <button onclick="window.focus(); window.print();" style="background:#0f172a; color:#ffffff; border:none; padding:10px 22px; border-radius:8px; font-weight:bold; cursor:pointer; font-size: 14px; display: inline-flex; align-items: center; gap: 8px;">
                  🖨️ فتح نافذة اختيار الطابعة الآن
                </button>
              </div>
              ${printContent.innerHTML}
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 300);
                };
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
      } else {
        window.focus();
        window.print();
      }
    } catch (e) {
      console.warn('Fallback window open failed:', e);
      window.focus();
      window.print();
    }
  };

  // Save current settings as default
  const handleSaveAsDefault = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(printConfig));
      updateSettings({
        defaultLogoPosition: printConfig.logoPosition,
        defaultLogoSize: printConfig.logoSize,
      });
      setSavedAsDefaultNotice(true);
      setTimeout(() => setSavedAsDefaultNotice(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Reset to initial defaults
  const handleResetDefaults = () => {
    const isWideTable = printData?.type === 'filtered_report' || printData?.type === 'expense_list';
    setPrintConfig({
      ...DEFAULT_PRINT_SETTINGS,
      orientation: isWideTable ? 'landscape' : 'portrait',
      logoPosition: settings.defaultLogoPosition || 'right',
      logoSize: settings.defaultLogoSize || 'md',
      logoTransform: DEFAULT_LOGO_TRANSFORM,
    });
  };

  // Reset only logo size and coordinates
  const handleResetLogoTransform = () => {
    setPrintConfig(prev => ({
      ...prev,
      logoPosition: 'right',
      logoTransform: DEFAULT_LOGO_TRANSFORM
    }));
  };

  // Auto-fit to 1 page
  const handleFitToSinglePage = () => {
    const el = document.getElementById('printable-voucher-content');
    if (!el) return;
    
    const scrollHeight = el.scrollHeight;
    const targetHeight = printConfig.orientation === 'landscape' ? 700 : 1000;
    
    if (scrollHeight > targetHeight) {
      const calculatedScale = Math.max(55, Math.min(100, Math.floor((targetHeight / scrollHeight) * 100)));
      setPrintConfig(prev => ({
        ...prev,
        scalePercent: calculatedScale,
        marginOption: 'compact',
        fontSize: 'sm'
      }));
    } else {
      setPrintConfig(prev => ({
        ...prev,
        scalePercent: 100
      }));
    }
  };

  // Zoom step handlers
  const handleZoomChange = (delta: number) => {
    setPrintConfig(prev => ({
      ...prev,
      scalePercent: Math.max(50, Math.min(150, prev.scalePercent + delta))
    }));
  };

  // Interactive Draggable & Multi-Directional Stretchable Logo Component
  const renderInteractiveLogo = () => {
    if (printConfig.logoPosition === 'hidden') return null;

    const isCustom = printConfig.logoPosition === 'custom' || printConfig.logoPosition === 'free';
    const { width, height, x, y, lockAspectRatio } = printConfig.logoTransform;

    const containerStyle: React.CSSProperties = isCustom
      ? {
          position: 'relative',
          transform: `translate(${x}px, ${y}px)`,
          width: `${width}px`,
          height: `${height}px`,
          zIndex: 40,
          cursor: isDraggingLogo ? 'grabbing' : 'grab',
          touchAction: 'none'
        }
      : {
          width: `${width}px`,
          height: `${height}px`,
          position: 'relative',
          cursor: isDraggingLogo ? 'grabbing' : 'grab',
          touchAction: 'none'
        };

    return (
      <div
        id="interactive-report-logo"
        className={`group select-none transition-shadow rounded-xl ${
          isLogoSelected ? 'ring-2 ring-emerald-500/70 shadow-lg' : 'hover:ring-1 hover:ring-emerald-400/50'
        } ${isDraggingLogo ? 'opacity-90 ring-2 ring-emerald-600 shadow-2xl' : ''}`}
        style={containerStyle}
        onClick={() => setIsLogoSelected(true)}
        onMouseDown={handleLogoDragStart}
        title="اسحب بالماوس لنقل الشعار لأي مكان، أو اسحب من المقابض للتكبير والاستطالة في كافة الاتجاهات"
      >
        {/* Actual Image / Fallback Logo */}
        <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center bg-white/90 border border-slate-200/80 p-1 pointer-events-none">
          {settings.companyLogo ? (
            <img
              src={settings.companyLogo}
              alt={settings.companyName}
              className="w-full h-full object-contain pointer-events-none"
              style={{ objectFit: lockAspectRatio ? 'contain' : 'fill' }}
            />
          ) : (
            <div className="w-full h-full border-2 border-slate-800 rounded-lg flex flex-col items-center justify-center font-black text-slate-800 bg-slate-50 p-1">
              <Building2 className="w-5 h-5 text-slate-700" />
              <span className="text-[8px] font-bold mt-0.5">شعار المنشأة</span>
            </div>
          )}
        </div>

        {/* Floating Quick Action Overlay & Stretch Tooltips (Only in interactive view, hidden in print/PDF) */}
        <div className="logo-interactive-controls print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
          
          {/* Top-Right Drag Indicator Badge */}
          <div className="absolute -top-7 right-0 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md pointer-events-none whitespace-nowrap z-50">
            <Move className="w-3 h-3 text-emerald-400" />
            <span>اسحب لنقل الشعار ({Math.round(width)} × {Math.round(height)} px)</span>
          </div>

          {/* Quick Mini Toolbar under the logo */}
          <div 
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-xl border border-slate-700 text-[10px] z-50 whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPrintConfig(prev => ({
                ...prev,
                logoTransform: {
                  ...prev.logoTransform,
                  lockAspectRatio: !prev.logoTransform.lockAspectRatio
                }
              }))}
              className={`p-1 rounded hover:bg-slate-800 cursor-pointer flex items-center gap-1 ${
                lockAspectRatio ? 'text-emerald-400' : 'text-slate-400'
              }`}
              title={lockAspectRatio ? 'تناسق الأبعاد مفعل (مقفل)' : 'استطالة حرة (غير مقفل)'}
            >
              {lockAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{lockAspectRatio ? 'أبعاد متناسقة' : 'استطالة حرة'}</span>
            </button>

            <div className="w-[1px] h-3 bg-slate-700" />

            <button
              type="button"
              onClick={handleResetLogoTransform}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer flex items-center gap-0.5"
              title="استعادة موضع وحجم الشعار الأصلي"
            >
              <RotateCcw className="w-3 h-3" />
              <span>إعادة ضبط</span>
            </button>
          </div>
        </div>

        {/* 8-Point Multi-Directional Stretch Handles (North, South, East, West, NW, NE, SW, SE) */}
        <div className="logo-resize-handle print:hidden">
          {/* NW - Top Left */}
          <div
            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow cursor-nwse-resize z-50 hover:scale-125 transition-transform"
            onMouseDown={(e) => handleLogoResizeStart('nw', e)}
            title="استطالة وتكبير من أعلى اليسار"
          />

          {/* N - Top Center */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-2.5 bg-emerald-600 border border-white rounded-xs shadow cursor-ns-resize z-50 hover:scale-125 transition-transform"
            onMouseDown={(e) => handleLogoResizeStart('n', e)}
            title="استطالة رأسية للأعلى"
          />

          {/* NE - Top Right */}
          <div
            className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow cursor-nesw-resize z-50 hover:scale-125 transition-transform"
            onMouseDown={(e) => handleLogoResizeStart('ne', e)}
            title="استطالة وتكبير من أعلى اليمين"
          />

          {/* E - Right Center */}
          <div
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-3.5 bg-emerald-600 border border-white rounded-xs shadow cursor-ew-resize z-50 hover:scale-125 transition-transform"
            onMouseDown={(e) => handleLogoResizeStart('e', e)}
            title="استطالة أفقية لليمين"
          />

          {/* SE - Bottom Right */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow cursor-nwse-resize z-50 hover:scale-125 transition-transform"
            onMouseDown={(e) => handleLogoResizeStart('se', e)}
            title="استطالة وتكبير من أسفل اليمين"
          />

          {/* S - Bottom Center */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-2.5 bg-emerald-600 border border-white rounded-xs shadow cursor-ns-resize z-50 hover:scale-125 transition-transform"
            onMouseDown={(e) => handleLogoResizeStart('s', e)}
            title="استطالة رأسية للأسفل"
          />

          {/* SW - Bottom Left */}
          <div
            className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow cursor-nesw-resize z-50 hover:scale-125 transition-transform"
            onMouseDown={(e) => handleLogoResizeStart('sw', e)}
            title="استطالة وتكبير من أسفل اليسار"
          />

          {/* W - Left Center */}
          <div
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-3.5 bg-emerald-600 border border-white rounded-xs shadow cursor-ew-resize z-50 hover:scale-125 transition-transform"
            onMouseDown={(e) => handleLogoResizeStart('w', e)}
            title="استطالة أفقية لليسار"
          />
        </div>

      </div>
    );
  };

  // QR Code & Verification Stamp
  const renderVerificationBadge = () => {
    if (!printConfig.showQrCode) return null;
    return (
      <div className="flex items-center gap-2 p-1.5 px-2.5 rounded-xl border border-slate-300 bg-slate-50/80 shrink-0">
        <div className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center shrink-0">
          <QrCode className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-[9px] leading-tight text-right font-mono">
          <span className="font-bold text-slate-800 block">سند مالي رقمي موثق</span>
          <span className="text-slate-500">REF-{refNumber}</span>
        </div>
      </div>
    );
  };

  // Signatures Footer Component
  const renderSignaturesFooter = (supervisorTitle = 'المشرف الميداني المسؤول', auditorTitle = 'المحاسب المالي المدقق', managerTitle = 'اعتماد الإدارة المالية / التنفيذية') => {
    if (!printConfig.showSignatures) return null;
    return (
      <div className="pt-6 mt-6 border-t-2 border-slate-300 grid grid-cols-3 gap-4 text-center text-xs avoid-page-break">
        <div className="p-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
          <p className="font-bold text-slate-900 mb-1">{supervisorTitle}</p>
          <p className="text-[10px] text-slate-500">التوقيع والتاريخ</p>
          <div className="h-10 flex items-end justify-center">
            <span className="text-[9px] text-slate-400 font-mono">........................................</span>
          </div>
        </div>

        <div className="p-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
          <p className="font-bold text-slate-900 mb-1">{auditorTitle}</p>
          <p className="text-[10px] text-slate-500">المراجعة والتدقيق المالي</p>
          <div className="h-10 flex items-end justify-center">
            <span className="text-[9px] text-slate-400 font-mono">........................................</span>
          </div>
        </div>

        <div className="p-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
          <p className="font-bold text-slate-900 mb-1">{managerTitle}</p>
          <p className="text-[10px] text-slate-500">الختم والاعتماد النهائي</p>
          <div className="h-10 flex items-end justify-center">
            <span className="text-[9px] text-slate-400 font-mono">........................................</span>
          </div>
        </div>
      </div>
    );
  };

  // Typography font size modifier
  const getFontSizeStyle = () => {
    switch (printConfig.fontSize) {
      case 'sm':
        return { fontSize: '11px', lineHeight: '1.4' };
      case 'lg':
        return { fontSize: '14.5px', lineHeight: '1.6' };
      case 'xl':
        return { fontSize: '16px', lineHeight: '1.7' };
      case 'md':
      default:
        return { fontSize: '13px', lineHeight: '1.5' };
    }
  };

  // Paper preview aspect ratio
  const getPaperDimensionsStyle = () => {
    const isLandscape = printConfig.orientation === 'landscape';
    if (printConfig.paperSize === 'receipt') {
      return { maxWidth: '400px', margin: '0 auto' };
    }
    if (isLandscape) {
      return { maxWidth: '1100px', width: '100%' };
    }
    return { maxWidth: '850px', width: '100%' };
  };

  return (
    <div className="print-voucher-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 md:p-6 flex justify-center items-start print:p-0 print:bg-white print:static print:overflow-visible print:block animate-in fade-in duration-200">
      <div 
        className="print-voucher-card relative bg-white text-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full my-auto print:my-0 print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none flex flex-col max-h-[96vh] print:max-h-none overflow-hidden animate-in zoom-in-95 duration-150"
        style={getPaperDimensionsStyle()}
      >
        
        {/* 1. Modal Top Header & Primary Action Bar */}
        <div className="sticky top-0 z-30 px-3 sm:px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-900 text-white shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-white">
                  معاينة واستوديو إعدادات الطباعة والشعار
                </h3>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  <Move className="w-3 h-3" />
                  سحب الشعار واستطالته بالماوس في أي اتجاه
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                يمكنك تحريك الشعار وسحبه وتكبيره وتصغيره بالماوس، واختيار مقاس الورقة والاتجاه والهوامش
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Toggle Settings Drawer */}
            <button
              type="button"
              id="btn-toggle-print-settings"
              onClick={() => setIsOptionsDrawerOpen(!isOptionsDrawerOpen)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isOptionsDrawerOpen 
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="تعديل المقاس، الاتجاه، الهوامش، موضع الشعار والألوان"
            >
              <Settings2 className="w-4 h-4 text-emerald-400" />
              <span>خيارات الورقة والشعار</span>
              {isOptionsDrawerOpen ? <Minimize2 className="w-3.5 h-3.5 opacity-70" /> : <Maximize2 className="w-3.5 h-3.5 opacity-70" />}
            </button>

            {/* Quick Columns Customization Button */}
            {(printData?.type === 'filtered_report' || printData?.type === 'expense_list' || printData?.type === 'project_report') && (
              <button
                type="button"
                id="btn-quick-toggle-columns"
                onClick={() => {
                  setIsOptionsDrawerOpen(true);
                  setActiveTab('columns');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isOptionsDrawerOpen && activeTab === 'columns'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="تخصيص وإظهار وإخفاء أعمدة الجدول عند الطباعة"
              >
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <span>أعمدة الطباعة ({customPrintColumns.length}/{REPORT_PRINT_COLUMNS.length})</span>
              </button>
            )}

            {/* Download PDF Button */}
            <button
              type="button"
              id="btn-download-pdf-voucher"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              title="تصدير وحفظ المستند كملف PDF على جهازك"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden xs:inline">جاري إنشاء PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>تنزيل PDF</span>
                </>
              )}
            </button>

            {/* Print Button */}
            <button
              type="button"
              id="btn-print-voucher-dialog"
              onClick={handleTriggerPrint}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer ring-1 ring-white/20"
              title="فتح نافذة اختيار الطابعة والطباعة الفورية (Ctrl + P)"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden xs:inline">طباعة المستند</span>
              <span className="xs:hidden">طباعة</span>
            </button>

            {/* Standalone Window Fallback */}
            <button
              type="button"
              id="btn-open-print-standalone-window"
              onClick={handleOpenPrintWindow}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
              title="فتح المستند في نافذة متصفح مستقلة للطباعة المباشرة"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              id="btn-close-print-voucher-modal"
              onClick={() => setIsPrintModalOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-rose-600/80 transition-colors cursor-pointer"
              title="إغلاق المعاينة (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Interactive Quick Zoom & Format Bar */}
        <div className="sticky top-[57px] z-20 px-3 sm:px-6 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden">
          
          {/* Zoom & Scaling Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
              <span className="font-bold text-slate-700 px-1 flex items-center gap-1">
                <ZoomIn className="w-3.5 h-3.5 text-emerald-600" />
                <span>التحجيم:</span>
              </span>
              
              <button
                type="button"
                onClick={() => handleZoomChange(-5)}
                disabled={printConfig.scalePercent <= 50}
                className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-600 disabled:opacity-30 cursor-pointer"
                title="تصغير (-5%)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono font-bold text-slate-900 px-1 min-w-[42px] text-center text-xs">
                {printConfig.scalePercent}%
              </span>

              <button
                type="button"
                onClick={() => handleZoomChange(5)}
                disabled={printConfig.scalePercent >= 150}
                className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-600 disabled:opacity-30 cursor-pointer"
                title="تكبير (+5%)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-[1px] bg-slate-200 mx-0.5" />

              {/* Quick Preset Buttons */}
              <div className="hidden sm:flex items-center gap-1">
                {[75, 90, 100, 115, 125].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPrintConfig(prev => ({ ...prev, scalePercent: pct }))}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                      printConfig.scalePercent === pct 
                        ? 'bg-emerald-600 text-white' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPrintConfig(prev => ({ ...prev, scalePercent: 100 }))}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                title="استعادة 100%"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Fit to Single Page Button */}
            <button
              type="button"
              onClick={handleFitToSinglePage}
              className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 hover:text-emerald-900 border border-emerald-200 hover:border-emerald-300 rounded-xl font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
              title="ملاءمة التقرير تلقائياً ليناسب صفحة واحدة دون انقسام"
            >
              <Maximize className="w-3.5 h-3.5 text-emerald-600" />
              <span>ملاءمة في صفحة واحدة</span>
            </button>
          </div>

          {/* Quick Orientation & Paper Size Toggles */}
          <div className="flex items-center gap-2">
            {/* Orientation Toggle */}
            <div className="inline-flex rounded-xl bg-white border border-slate-200 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setPrintConfig(prev => ({ ...prev, orientation: 'portrait' }))}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                  printConfig.orientation === 'portrait'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="طباعة رأسية عمودية"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>عمودي (Portrait)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintConfig(prev => ({ ...prev, orientation: 'landscape' }))}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                  printConfig.orientation === 'landscape'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="طباعة أفقية بالعرض للتقارير والجداول الكبيرة"
              >
                <LayoutTemplate className="w-3.5 h-3.5 rotate-90" />
                <span>أفقي (Landscape)</span>
              </button>
            </div>

            {/* Paper Size Selector */}
            <select
              value={printConfig.paperSize}
              onChange={(e) => setPrintConfig(prev => ({ ...prev, paperSize: e.target.value as PaperSize }))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl font-bold text-[11px] text-slate-800 shadow-2xs cursor-pointer focus:outline-emerald-500"
              title="تحديد مقاس الورقة"
            >
              <option value="a4">A4 (210×297 مم)</option>
              <option value="a3">A3 (297×420 مم - كبير)</option>
              <option value="a5">A5 (148×210 مم - نصف ورقة)</option>
              <option value="letter">Letter (خطاب أمريكي)</option>
              <option value="legal">Legal (سندات طويلة)</option>
              <option value="receipt">إيصال حراري (80 مم)</option>
            </select>
          </div>
        </div>

        {/* 3. Comprehensive Settings Drawer */}
        {isOptionsDrawerOpen && (
          <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 text-xs animate-in slide-in-from-top-2 duration-200 shrink-0 print:hidden">
            
            {/* Drawer Navigation Tabs */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('elements')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'elements'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <Move className="w-3.5 h-3.5 text-emerald-200" />
                  <span>الشعار وموضعه والاستطالة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('layout')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'layout'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>الورقة والهوامش</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('typography')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'typography'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <Droplet className="w-3.5 h-3.5" />
                  <span>الألوان وتوفير الحبر والخطوط</span>
                </button>
                {(printData?.type === 'filtered_report' || printData?.type === 'expense_list' || printData?.type === 'project_report') && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('columns')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'columns'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>تخصيص أعمدة الجدول ({customPrintColumns.length}/{REPORT_PRINT_COLUMNS.length})</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-slate-500 hover:text-slate-800 font-bold text-[11px] underline cursor-pointer"
                >
                  استعادة الافتراضي
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsDefault}
                  className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  title="حفظ هذه الإعدادات وموضع الشعار لتكون الافتراضية لكافة الطباعات القادمة"
                >
                  {savedAsDefaultNotice ? (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Check className="w-3.5 h-3.5" /> تم الحفظ بنجاح
                    </span>
                  ) : (
                    <span>حفظ كإعداد افتراضي دائم</span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab: Logo Drag, Stretch, Placement & Elements */}
            {activeTab === 'elements' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Logo Position & Drag Mode */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Move className="w-3.5 h-3.5 text-emerald-600" />
                      <span>موضع الشعار:</span>
                    </span>
                    {(printConfig.logoPosition === 'custom' || printConfig.logoPosition === 'free') && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        موضع حر بالسحب
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'right', label: 'أعلى اليمين' },
                      { id: 'center', label: 'في الوسط' },
                      { id: 'left', label: 'أعلى اليسار' },
                      { id: 'custom', label: 'موضع حر (بالماوس)' },
                      { id: 'hidden', label: 'إخفاء الشعار' },
                    ].map(lp => (
                      <button
                        key={lp.id}
                        type="button"
                        onClick={() => {
                          setPrintConfig(prev => ({
                            ...prev,
                            logoPosition: lp.id as LogoPosition
                          }));
                        }}
                        className={`p-2 rounded-xl text-center font-bold text-xs transition-all cursor-pointer border ${
                          printConfig.logoPosition === lp.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/20'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {lp.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>التحريك المباشر بالماوس:</span>
                    </p>
                    <p className="text-[10px] text-emerald-800 leading-relaxed">
                      انقر واسحب الشعار مباشرة فوق ورقة التقرير لنقله إلى أي مكان، واسحب من المقابض الـ 8 لتكبيره وتمديده في كافة الاتجاهات.
                    </p>
                  </div>
                </div>

                {/* 2. Logo Size & Stretch Controls */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <StretchIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>أبعاد واستطالة الشعار:</span>
                    </span>
                    <span className="font-mono text-emerald-700 font-bold text-xs">
                      {Math.round(printConfig.logoTransform.width)} × {Math.round(printConfig.logoTransform.height)} px
                    </span>
                  </div>

                  {/* Width Slider */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                      <span>عرض الشعار (Width):</span>
                      <span className="font-mono font-bold text-slate-900">{Math.round(printConfig.logoTransform.width)} px</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={350}
                      step={2}
                      value={printConfig.logoTransform.width}
                      onChange={(e) => {
                        const newW = Number(e.target.value);
                        setPrintConfig(prev => ({
                          ...prev,
                          logoPosition: prev.logoPosition === 'hidden' ? 'right' : prev.logoPosition,
                          logoTransform: {
                            ...prev.logoTransform,
                            width: newW,
                            height: prev.logoTransform.lockAspectRatio 
                              ? Math.round(newW * (prev.logoTransform.height / prev.logoTransform.width))
                              : prev.logoTransform.height
                          }
                        }));
                      }}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Height Slider */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                      <span>ارتفاع الشعار (Height):</span>
                      <span className="font-mono font-bold text-slate-900">{Math.round(printConfig.logoTransform.height)} px</span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={250}
                      step={2}
                      value={printConfig.logoTransform.height}
                      onChange={(e) => {
                        const newH = Number(e.target.value);
                        setPrintConfig(prev => ({
                          ...prev,
                          logoPosition: prev.logoPosition === 'hidden' ? 'right' : prev.logoPosition,
                          logoTransform: {
                            ...prev.logoTransform,
                            height: newH,
                            width: prev.logoTransform.lockAspectRatio 
                              ? Math.round(newH * (prev.logoTransform.width / prev.logoTransform.height))
                              : prev.logoTransform.width
                          }
                        }));
                      }}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Aspect Ratio Lock Toggle */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={printConfig.logoTransform.lockAspectRatio}
                        onChange={(e) => setPrintConfig(prev => ({
                          ...prev,
                          logoTransform: {
                            ...prev.logoTransform,
                            lockAspectRatio: e.target.checked
                          }
                        }))}
                        className="rounded text-emerald-600 accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">قفل تناسق الأبعاد أثناء التكبير</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleResetLogoTransform}
                      className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      إعادة ضبط
                    </button>
                  </div>
                </div>

                {/* 3. Section Toggles */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">إظهار/إخفاء أقسام المستند:</span>
                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <span className="text-xs text-slate-700">جدول التوقيعات والاعتمادات</span>
                      <input
                        type="checkbox"
                        checked={printConfig.showSignatures}
                        onChange={(e) => setPrintConfig(prev => ({ ...prev, showSignatures: e.target.checked }))}
                        className="rounded text-emerald-600 accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <span className="text-xs text-slate-700">مسار التدقيق المالي اللحظي</span>
                      <input
                        type="checkbox"
                        checked={printConfig.showAuditTrail}
                        onChange={(e) => setPrintConfig(prev => ({ ...prev, showAuditTrail: e.target.checked }))}
                        className="rounded text-emerald-600 accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <span className="text-xs text-slate-700">رمز الاستجابة السريعة (QR للتحقق)</span>
                      <input
                        type="checkbox"
                        checked={printConfig.showQrCode}
                        onChange={(e) => setPrintConfig(prev => ({ ...prev, showQrCode: e.target.checked }))}
                        className="rounded text-emerald-600 accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <span className="text-xs text-slate-700">تفاصيل الضريبة والفواتير</span>
                      <input
                        type="checkbox"
                        checked={printConfig.showTaxDetails}
                        onChange={(e) => setPrintConfig(prev => ({ ...prev, showTaxDetails: e.target.checked }))}
                        className="rounded text-emerald-600 accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

              </div>
            )}

            {/* Tab: Paper & Margins */}
            {activeTab === 'layout' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Paper Size */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">مقاس الورقة (Paper Size):</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['a4', 'a3', 'a5', 'letter', 'legal', 'receipt'] as PaperSize[]).map(ps => (
                      <button
                        key={ps}
                        type="button"
                        onClick={() => setPrintConfig(prev => ({ ...prev, paperSize: ps }))}
                        className={`p-2 rounded-xl text-right font-bold transition-all cursor-pointer border ${
                          printConfig.paperSize === ps
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/20'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="uppercase">{ps}</span>
                          {printConfig.paperSize === ps && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal block">
                          {ps === 'a4' ? '210×297 مم' : ps === 'a3' ? '297×420 مم' : ps === 'a5' ? '148×210 مم' : ps === 'letter' ? '216×279 مم' : ps === 'legal' ? '216×356 مم' : 'إيصال 80 مم'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Margins */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">هوامش الصفحة (Margins):</span>
                    <span className="font-mono text-emerald-700 font-bold">{effectiveMarginMm} مم</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'standard', label: 'قياسي (8 مم)', desc: 'متوازن لكافة الطابعات' },
                      { id: 'compact', label: 'ضيق (4 مم)', desc: 'أقصى مساحة للجداول' },
                      { id: 'wide', label: 'عريض (16 مم)', desc: 'مناسب للتخريم والأرشفة' },
                      { id: 'none', label: 'بدون هوامش (0)', desc: 'كامل مساحة الورقة' },
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPrintConfig(prev => ({ ...prev, marginOption: m.id as PrintMarginOption }))}
                        className={`p-2 rounded-xl text-right font-bold transition-all cursor-pointer border ${
                          printConfig.marginOption === m.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/20'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-[11px]">{m.label}</span>
                        <span className="text-[9px] text-slate-400 font-normal block">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>هامش مخصص:</span>
                      <span className="font-mono font-bold text-slate-800">{printConfig.customMarginMm} مم</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      step={1}
                      value={printConfig.customMarginMm}
                      onChange={(e) => setPrintConfig(prev => ({
                        ...prev,
                        marginOption: 'custom',
                        customMarginMm: Number(e.target.value)
                      }))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Scale */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">نسبة التحجيم الكلية:</span>
                    <span className="font-mono text-emerald-700 font-black text-sm">{printConfig.scalePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={150}
                    step={1}
                    value={printConfig.scalePercent}
                    onChange={(e) => setPrintConfig(prev => ({ ...prev, scalePercent: Number(e.target.value) }))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>50%</span>
                    <span>100%</span>
                    <span>150%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Colors & Font */}
            {activeTab === 'typography' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Color Mode */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">نمط الألوان وتوفير الحبر:</span>
                  <div className="space-y-1.5">
                    {[
                      { id: 'full', title: 'ألوان رسمية كاملة (Full Color)', desc: 'تدرجات الألوان الخضراء والشعارات والبطاقات كاملة الجودة' },
                      { id: 'grayscale', title: 'تدرج رمادي موفر للحبر (Eco Grayscale)', desc: 'طباعة اقتصادية لتوفير الحبر وتسهيل تصوير المستند' },
                      { id: 'bw', title: 'أبيض وأسود عالي التباين (High Contrast B&W)', desc: 'حدود واضحة مناسب لطابعات الماتريكس والفاكس' },
                    ].map(cm => (
                      <button
                        key={cm.id}
                        type="button"
                        onClick={() => setPrintConfig(prev => ({ ...prev, colorMode: cm.id as PrintColorMode }))}
                        className={`w-full p-2.5 rounded-xl text-right font-bold transition-all cursor-pointer border ${
                          printConfig.colorMode === cm.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/20'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">{cm.title}</span>
                          {printConfig.colorMode === cm.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal block mt-0.5">{cm.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Scaling */}
                <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">حجم خطوط ونصوص التقرير:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'sm', label: 'دقيق / صغير (Compact)', size: '11px' },
                      { id: 'md', label: 'قياسي / متوازن (Normal)', size: '13px' },
                      { id: 'lg', label: 'متوسط / مريح (Medium)', size: '14.5px' },
                      { id: 'xl', label: 'كبير وواضح (Large)', size: '16px' },
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPrintConfig(prev => ({ ...prev, fontSize: f.id as PrintFontSizeOption }))}
                        className={`p-2.5 rounded-xl text-right font-bold transition-all cursor-pointer border ${
                          printConfig.fontSize === f.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/20'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-xs">{f.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-normal">حجم الخط: {f.size}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Column Visibility for Reports */}
            {activeTab === 'columns' && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">
                      تخصيص الأعمدة المطبوعة في جدول التقرير:
                    </span>
                    <p className="text-[11px] text-slate-500">
                      حدد الأعمدة التي ترغب في إظهارها أو إخفائها في النسخة المطبوعة وملف PDF لتلائم حجم الورقة وتنسيقها.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleShowAllPrintColumns}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      إظهار كافة الأعمدة
                    </button>
                    <button
                      type="button"
                      onClick={handleShowEssentialColumns}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      الأعمدة الأساسية فقط
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                  {REPORT_PRINT_COLUMNS.map(col => {
                    const checked = isColVisible(col.id);
                    const isAlways = col.alwaysVisible;
                    return (
                      <label
                        key={col.id}
                        className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                          checked
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        } ${isAlways ? 'opacity-90 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isAlways}
                            onChange={() => handleTogglePrintColumn(col.id)}
                            className="rounded text-emerald-600 accent-emerald-600 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="text-xs">{col.label}</span>
                        </div>
                        {isAlways && (
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">ثابت</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* 4. Live Printable Canvas Container */}
        <div 
          ref={previewContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-200/50 dark:bg-slate-900/40 custom-scrollbar print:p-0 print:overflow-visible print:bg-white print:h-auto"
        >
          {/* Printable White Sheet */}
          <div 
            ref={printableSheetRef}
            id="printable-voucher-content" 
            className="bg-white text-slate-900 mx-auto shadow-md border border-slate-200/80 rounded-xl print:rounded-none print:border-none print:shadow-none transition-all relative overflow-hidden"
            style={{
              padding: `${effectiveMarginMm}mm`,
              zoom: `${printConfig.scalePercent}%`,
              ...getFontSizeStyle(),
              ...(printConfig.colorMode === 'grayscale' ? { filter: 'grayscale(100%)' } : {}),
              ...(printConfig.colorMode === 'bw' ? { filter: 'grayscale(100%) contrast(150%)' } : {})
            }}
          >
            
            {/* Dynamic Header according to logoPosition */}
            {printConfig.logoPosition === 'center' ? (
              /* Center Layout */
              <div className="border-b-2 border-slate-800 pb-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>تاريخ الطباعة: {printDateStr}</span>
                  <div className="flex items-center gap-2">
                    {renderVerificationBadge()}
                    <span className="font-bold text-slate-700">REF: #{refNumber}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center text-center space-y-1.5">
                  {renderInteractiveLogo()}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                      {settings.companyName}
                    </h1>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">
                      {settings.companySubtitle || 'نظام إدارة المصروفات والعهد للمشاريع الميدانية والرقابة المالية'}
                    </p>
                  </div>
                </div>
              </div>
            ) : printConfig.logoPosition === 'left' ? (
              /* Left Layout */
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    {settings.companyName}
                  </h1>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    {settings.companySubtitle || 'نظام إدارة المصروفات والعهد للمشاريع الميدانية والرقابة المالية'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    تاريخ الطباعة: {printDateStr}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  {renderInteractiveLogo()}
                  <div className="flex items-center gap-2">
                    {renderVerificationBadge()}
                    <span className="text-[10px] text-slate-500 font-mono">
                      REF: #{refNumber}
                    </span>
                  </div>
                </div>
              </div>
            ) : printConfig.logoPosition === 'custom' || printConfig.logoPosition === 'free' ? (
              /* Custom / Free-form Floating Layout */
              <div className="border-b-2 border-slate-800 pb-4 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {renderInteractiveLogo()}
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                        {settings.companyName}
                      </h1>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        {settings.companySubtitle || 'نظام إدارة المصروفات والعهد للمشاريع الميدانية والرقابة المالية'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">
                        تاريخ الطباعة: {printDateStr}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-left font-mono">
                    {renderVerificationBadge()}
                    <div>
                      <div className="px-3 py-1.5 border-2 border-slate-800 rounded-xl text-center bg-slate-50">
                        <span className="text-xs font-bold text-slate-900">REF: #{refNumber}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans block mt-1 text-center">
                        سند مالي معتمد
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : printConfig.logoPosition === 'right' ? (
              /* Right Layout (Default) */
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
                <div className="flex items-start gap-3.5">
                  {renderInteractiveLogo()}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                      {settings.companyName}
                    </h1>
                    <p className="text-xs font-semibold text-slate-600 mt-1">
                      {settings.companySubtitle || 'نظام إدارة المصروفات والعهد للمشاريع الميدانية والرقابة المالية'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      تاريخ الطباعة: {printDateStr}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-left">
                  {renderVerificationBadge()}
                  <div>
                    <div className="px-3 py-1.5 border-2 border-slate-800 rounded-xl flex flex-col items-center justify-center font-mono text-slate-800 bg-slate-50">
                      <span className="text-[9px] uppercase font-sans font-bold text-slate-500">سند معتمد</span>
                      <span className="text-xs font-bold">REF: #{refNumber}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block mt-1 text-center">
                      نظام الرقابة المالية
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Hidden Layout */
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    {settings.companyName}
                  </h1>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    {settings.companySubtitle || 'نظام إدارة المصروفات والعهد للمشاريع الميدانية والرقابة المالية'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    تاريخ الطباعة: {printDateStr}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-left font-mono">
                  {renderVerificationBadge()}
                  <div>
                    <div className="px-3 py-1.5 border-2 border-slate-800 rounded-xl text-center bg-slate-50">
                      <span className="text-xs font-bold text-slate-900">REF: #{refNumber}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans block mt-1 text-center">
                      سند مالي رسمي
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Document Body by Type */}
            <div className="py-4 space-y-4">
              
              {/* 1. Expense Voucher */}
              {printData.type === 'expense' && (
                <div className="space-y-4">
                  <div className="text-center py-2.5 bg-slate-100 rounded-xl border border-slate-200">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      سند صرف واستعاضة عهدة نقدية معتمد رقم: ({printData.data.id})
                    </h2>
                    <span className="text-xs text-slate-500">إشعار قيد مالي معتمد بموجب المستندات والفواتير المرفقة</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 border rounded-xl space-y-0.5 bg-slate-50/70">
                      <span className="text-slate-500 block text-[11px]">المشروع الميداني:</span>
                      <p className="font-bold text-slate-900 text-sm">{printData.data.projectName}</p>
                    </div>
                    <div className="p-2.5 border rounded-xl space-y-0.5 bg-slate-50/70">
                      <span className="text-slate-500 block text-[11px]">المشرف المسؤول:</span>
                      <p className="font-bold text-slate-900 text-sm">{printData.data.supervisorName}</p>
                    </div>
                    <div className="p-2.5 border rounded-xl space-y-0.5 bg-slate-50/70">
                      <span className="text-slate-500 block text-[11px]">البند والتصنيف:</span>
                      <p className="font-bold text-slate-900">{printData.data.category}</p>
                    </div>
                    <div className="p-2.5 border rounded-xl space-y-0.5 bg-slate-50/70">
                      <span className="text-slate-500 block text-[11px]">تاريخ الصرف:</span>
                      <p className="font-bold text-slate-900 font-mono">{printData.data.date}</p>
                    </div>
                  </div>

                  {/* Statement Details */}
                  <div className="p-3.5 border rounded-xl bg-slate-50">
                    <span className="text-xs font-bold text-slate-700 block mb-1">البيان والشرح التفصيلي للنفقة:</span>
                    <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                      {printData.data.details}
                    </p>
                    {printConfig.showTaxDetails && printData.data.invoiceNumber && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                        <span><strong>رقم الفاتورة الضريبية المرفقة:</strong> <span className="font-mono">{printData.data.invoiceNumber}</span></span>
                        {printData.data.invoiceDate && <span><strong>تاريخ الفاتورة:</strong> <span className="font-mono">{printData.data.invoiceDate}</span></span>}
                      </div>
                    )}
                  </div>

                  {/* Financial Box */}
                  <div className="p-3.5 border-2 border-emerald-600 rounded-2xl bg-emerald-50/40 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs text-emerald-800 font-bold block">إجمالي المبلغ المستحق للصرف والاستعاضة:</span>
                      <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
                        {printData.data.amount.toLocaleString()} <span className="text-base font-bold">{settings.currencySymbol}</span>
                      </span>
                    </div>

                    {printConfig.showTaxDetails && (
                      <div className="text-left text-xs space-y-1 bg-white p-2.5 rounded-xl border border-emerald-200 font-mono">
                        {printData.data.taxAmount ? (
                          <>
                            <div className="flex justify-between gap-3 text-slate-600">
                              <span>المبلغ قبل الضريبة:</span>
                              <span className="font-bold">{(printData.data.amount - printData.data.taxAmount).toLocaleString()} {settings.currencySymbol}</span>
                            </div>
                            <div className="flex justify-between gap-3 text-blue-700">
                              <span>ضريبة القيمة المضافة (15%):</span>
                              <span className="font-bold">{printData.data.taxAmount.toLocaleString()} {settings.currencySymbol}</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-500">سند غير مشمول بالضريبة المقتطعة</span>
                        )}
                        <div className="border-t pt-1 flex justify-between gap-3 font-bold text-emerald-800">
                          <span>صافي الإجمالي:</span>
                          <span>{printData.data.amount.toLocaleString()} {settings.currencySymbol}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Workflow Audit Trail Status */}
                  {printConfig.showAuditTrail && (
                    <div className="p-3 border rounded-xl bg-slate-50 text-xs">
                      <span className="font-bold text-slate-700 block mb-2">سجل ومسار الاعتماد والتدقيق المالي:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="block text-[10px] text-slate-500">اعتماد المشرف الميداني</span>
                            <span className="font-bold text-slate-900">{printData.data.supervisorName || 'معتمد'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                          {printData.data.accountantApproval === 'تم الاعتماد' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <div>
                            <span className="block text-[10px] text-slate-500">تدقيق المحاسب المالي</span>
                            <span className="font-bold text-slate-900">{printData.data.accountantApproval || 'قيد المراجعة'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                          {printData.data.status === 'معتمد' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <div>
                            <span className="block text-[10px] text-slate-500">الاعتماد النهائي للإدارة</span>
                            <span className="font-bold text-slate-900">{printData.data.managementApproval || printData.data.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Location Stamp */}
                  {printConfig.showGpsStamp && printData.data.gpsLocation && (
                    <div className="text-[11px] text-slate-500 border-t pt-2 flex items-center gap-1.5 font-mono">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        بصمة الإحداثيات الجغرافية لموقع الصرف: Lat {printData.data.gpsLocation.lat.toFixed(4)}, Lng {printData.data.gpsLocation.lng.toFixed(4)}
                      </span>
                    </div>
                  )}

                  {/* Signatures */}
                  {renderSignaturesFooter('المشرف الميداني (مقدم السند)', 'المحاسب المالي (المدقق)', 'المدير المالي / التنفيذي')}
                </div>
              )}

              {/* 2. Custody Statement */}
              {printData.type === 'custody_statement' && (
                <div className="space-y-4">
                  <div className="text-center py-2.5 bg-slate-100 rounded-xl border border-slate-200">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      كشف حساب حركة العهدة النقدية ومطابقة الأرصدة للمشرف: {printData.data.name}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      البريد: <span className="font-mono">{printData.data.email}</span> {printData.data.phone ? `| هاتف: ${printData.data.phone}` : ''} | تاريخ الاستخراج: {printDateStr}
                    </p>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 bg-slate-50 border rounded-xl">
                      <span className="text-[11px] text-slate-500 block">إجمالي العهدة المسلّمة</span>
                      <span className="text-base font-bold font-mono text-slate-900 mt-1 block">
                        {printData.data.totalCustody.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[11px] text-emerald-800 block">المنصرف المعتمد نهائياً</span>
                      <span className="text-base font-bold font-mono text-emerald-700 mt-1 block">
                        {printData.data.totalApprovedExpenses.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-[11px] text-amber-800 block">معلق قيد المراجعة</span>
                      <span className="text-base font-bold font-mono text-amber-700 mt-1 block">
                        {printData.data.totalPendingExpenses.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-[11px] text-blue-800 block font-bold">الرصيد الفعلي المتبقي بالعهدة</span>
                      <span className="text-base font-bold font-mono text-blue-700 mt-1 block">
                        {(printData.data.actualRemainingBalance ?? printData.data.remainingBalance).toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                  </div>

                  {/* Balance Notice */}
                  <div className="p-3 bg-slate-50 border rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 block">الرصيد الدفتري المعتمد:</span>
                      <span className="font-mono font-bold text-slate-900">{(printData.data.approvedBookBalance ?? (printData.data.totalCustody - printData.data.totalApprovedExpenses)).toLocaleString()} {settings.currencySymbol}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">الرصيد النقدي الفعلي المتاح:</span>
                      <span className="font-mono font-bold text-blue-700">{(printData.data.actualRemainingBalance ?? printData.data.remainingBalance).toLocaleString()} {settings.currencySymbol}</span>
                    </div>
                  </div>

                  {/* Expenses Ledger */}
                  <div>
                    <div className="font-bold text-xs text-slate-800 mb-2">سجل حركات وسندات العهدة للمشرف:</div>
                    <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                        <tr>
                          <th className="p-2">رقم السند</th>
                          <th className="p-2">التاريخ</th>
                          <th className="p-2">المشروع</th>
                          <th className="p-2">البند</th>
                          <th className="p-2">البيان</th>
                          <th className="p-2">المبلغ</th>
                          <th className="p-2">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expenses
                          .filter(e => e.supervisorEmail === printData.data.email || (e.supervisorName && e.supervisorName === printData.data.name))
                          .slice(0, 25)
                          .map(e => (
                            <tr key={e.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-slate-800">{e.id}</td>
                              <td className="p-2 font-mono text-slate-600">{e.date}</td>
                              <td className="p-2 font-semibold text-slate-900">{e.projectName}</td>
                              <td className="p-2 text-slate-700">{e.category}</td>
                              <td className="p-2 truncate max-w-[150px] text-slate-800">{e.details}</td>
                              <td className="p-2 font-mono font-bold text-emerald-700">{e.amount.toLocaleString()} {settings.currencySymbol}</td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  e.status === 'معتمد' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {e.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures */}
                  {renderSignaturesFooter('توقيع المشرف (صاحب العهدة)', 'المحاسب المالي (المراجع)', 'المدير المالي (الاعتماد)')}
                </div>
              )}

              {/* 3. Project Report */}
              {printData.type === 'project_report' && (
                <div className="space-y-4">
                  <div className="text-center py-2.5 bg-slate-100 rounded-xl border border-slate-200">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      تقرير المتابعة والرقابة المالية للمشروع: {printData.data.name} ({printData.data.code})
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      حالة المشروع: <span className="font-bold text-slate-800">{printData.data.status || 'جاري'}</span> | العميل: <span className="font-bold text-slate-800">{printData.data.clientName || 'غير محدد'}</span> | تاريخ الاستخراج: {printDateStr}
                    </p>
                  </div>

                  {(() => {
                    const projExpenses = expenses.filter(e => e.projectId === printData.data.id || e.projectName === printData.data.name);
                    const spent = projExpenses.filter(e => e.status === 'معتمد').reduce((sum, e) => sum + e.amount, 0);
                    const pending = projExpenses.filter(e => e.status !== 'معتمد' && e.status !== 'مرفوض').reduce((sum, e) => sum + e.amount, 0);
                    const budget = Number(printData.data.budget) || 0;
                    const remaining = Math.max(0, budget - spent);
                    const consumptionRate = budget > 0 ? ((spent / budget) * 100).toFixed(1) : '0';

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                          <div className="p-2.5 border rounded-xl bg-slate-50">
                            <span className="text-slate-500 block text-[11px]">الميزانية المرصودة</span>
                            <p className="text-base font-black text-slate-900 mt-1 font-mono">
                              {budget.toLocaleString()} {settings.currencySymbol}
                            </p>
                          </div>
                          <div className="p-2.5 border rounded-xl bg-emerald-50 border-emerald-200">
                            <span className="text-emerald-700 block text-[11px] font-bold">المنصرف الفعلي المعتمد</span>
                            <p className="text-base font-black text-emerald-700 mt-1 font-mono">
                              {spent.toLocaleString()} {settings.currencySymbol}
                            </p>
                          </div>
                          <div className="p-2.5 border rounded-xl bg-amber-50 border-amber-200">
                            <span className="text-amber-700 block text-[11px] font-bold">معلق قيد المراجعة</span>
                            <p className="text-base font-black text-amber-700 mt-1 font-mono">
                              {pending.toLocaleString()} {settings.currencySymbol}
                            </p>
                          </div>
                          <div className="p-2.5 border rounded-xl bg-blue-50 border-blue-200">
                            <span className="text-blue-700 block text-[11px] font-bold">المتبقي من الميزانية</span>
                            <p className="text-base font-black text-blue-900 mt-1 font-mono">
                              {remaining.toLocaleString()} {settings.currencySymbol}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="p-3 bg-slate-50 border rounded-xl">
                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                            <span>معدل استهلاك الميزانية:</span>
                            <span className="font-mono text-emerald-700">{consumptionRate}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${Number(consumptionRate) > 90 ? 'bg-rose-500' : Number(consumptionRate) > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, Number(consumptionRate))}%` }}
                            />
                          </div>
                        </div>

                        {/* Recent Expenses List */}
                        <div>
                          <div className="font-bold text-xs text-slate-800 mb-2">بيان سندات ومصروفات المشروع:</div>
                          <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                              <tr>
                                {isColVisible('id') && <th className="p-2">رقم السند</th>}
                                {isColVisible('date') && <th className="p-2">التاريخ</th>}
                                {isColVisible('supervisor') && <th className="p-2">المشرف المسؤول</th>}
                                {isColVisible('category') && <th className="p-2">البند والتصنيف</th>}
                                {isColVisible('details') && <th className="p-2">البيان</th>}
                                {isColVisible('amount') && <th className="p-2">المبلغ</th>}
                                {isColVisible('status') && <th className="p-2">الحالة</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {projExpenses.slice(0, 20).map(e => (
                                <tr key={e.id} className="hover:bg-slate-50">
                                  {isColVisible('id') && <td className="p-2 font-mono font-bold text-slate-800">{e.id}</td>}
                                  {isColVisible('date') && <td className="p-2 font-mono text-slate-600">{e.date}</td>}
                                  {isColVisible('supervisor') && <td className="p-2 font-semibold text-slate-900">{e.supervisorName}</td>}
                                  {isColVisible('category') && <td className="p-2 text-slate-700">{e.category}</td>}
                                  {isColVisible('details') && <td className="p-2 truncate max-w-[150px] text-slate-800">{e.details}</td>}
                                  {isColVisible('amount') && <td className="p-2 font-mono font-bold text-emerald-700">{e.amount.toLocaleString()} {settings.currencySymbol}</td>}
                                  {isColVisible('status') && (
                                    <td className="p-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        e.status === 'معتمد' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {e.status}
                                      </span>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Signatures */}
                  {renderSignaturesFooter('مدير المشروع / المشرف الميداني', 'المحاسب المالي للشركة', 'الإدارة العامة')}
                </div>
              )}

              {/* 4. Filtered / Comprehensive Report */}
              {printData.type === 'filtered_report' && (
                <div className="space-y-4">
                  <div className="text-center py-2.5 bg-slate-100 rounded-xl border border-slate-200">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      {printData.data.title || 'تقرير المصروفات والرقابة المالية الشامل للمشاريع'}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      المشروع: <span className="font-bold text-slate-800">{printData.data.selectedProjectName || 'كافة المشاريع'}</span>
                      {printData.data.selectedSupervisorName && printData.data.selectedSupervisorName !== 'كافة المشرفين' && (
                        <span> | المشرف: <span className="font-bold text-slate-800">{printData.data.selectedSupervisorName}</span></span>
                      )}
                      <span> | البند: <span className="font-bold text-slate-800">{printData.data.selectedCategoryName || 'كافة البنود'}</span></span>
                      {printData.data.dateRange?.from && printData.data.dateRange?.to && (
                        <span> | الفترة: <span className="font-mono text-slate-700">{printData.data.dateRange.from} إلى {printData.data.dateRange.to}</span></span>
                      )}
                      <span> | تاريخ الاستخراج: {printDateStr}</span>
                    </p>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 border rounded-xl bg-slate-50">
                      <span className="text-slate-500 block text-[11px]">عدد السندات</span>
                      <p className="text-base font-black text-slate-900 mt-1 font-mono">
                        {printData.data.totalExpensesCount} سند
                      </p>
                    </div>
                    <div className="p-2.5 border rounded-xl bg-emerald-50 border-emerald-200">
                      <span className="text-emerald-700 block text-[11px] font-bold">إجمالي المنصرف</span>
                      <p className="text-base font-black text-emerald-700 mt-1 font-mono">
                        {printData.data.totalSpent.toLocaleString()} {settings.currencySymbol}
                      </p>
                    </div>
                    <div className="p-2.5 border rounded-xl bg-amber-50 border-amber-200">
                      <span className="text-amber-700 block text-[11px] font-bold">معلق قيد التدقيق</span>
                      <p className="text-base font-black text-amber-700 mt-1 font-mono">
                        {printData.data.pendingAmount.toLocaleString()} {settings.currencySymbol}
                      </p>
                    </div>
                    <div className="p-2.5 border rounded-xl bg-blue-50 border-blue-200">
                      <span className="text-blue-700 block text-[11px] font-bold">إجمالي الضرائب (15%)</span>
                      <p className="text-base font-black text-blue-900 mt-1 font-mono">
                        {printData.data.totalTax.toLocaleString()} {settings.currencySymbol}
                      </p>
                    </div>
                  </div>

                  {/* Itemized Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                        <tr>
                          {isColVisible('id') && <th className="p-2 font-bold">رقم السند</th>}
                          {isColVisible('date') && <th className="p-2 font-bold">التاريخ</th>}
                          {isColVisible('projectName') && <th className="p-2 font-bold">المشروع</th>}
                          {isColVisible('supervisor') && <th className="p-2 font-bold">المشرف</th>}
                          {isColVisible('category') && <th className="p-2 font-bold">البند والتصنيف</th>}
                          {isColVisible('details') && <th className="p-2 font-bold">البيان</th>}
                          {isColVisible('amount') && <th className="p-2 font-bold">المبلغ</th>}
                          {isColVisible('taxAmount') && <th className="p-2 font-bold">الضريبة</th>}
                          {isColVisible('invoiceNumber') && <th className="p-2 font-bold">رقم الفاتورة</th>}
                          {isColVisible('status') && <th className="p-2 font-bold">الحالة</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {printData.data.expensesList.map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-50/80">
                            {isColVisible('id') && <td className="p-2 font-mono font-bold text-slate-900">{e.id}</td>}
                            {isColVisible('date') && <td className="p-2 font-mono text-slate-600 whitespace-nowrap">{e.date}</td>}
                            {isColVisible('projectName') && <td className="p-2 font-semibold text-slate-900 whitespace-nowrap">{e.projectName}</td>}
                            {isColVisible('supervisor') && <td className="p-2 text-slate-700 whitespace-nowrap">{e.supervisorName}</td>}
                            {isColVisible('category') && <td className="p-2 text-slate-600 whitespace-nowrap">{e.category}</td>}
                            {isColVisible('details') && <td className="p-2 truncate max-w-[180px] text-slate-800">{e.details}</td>}
                            {isColVisible('amount') && <td className="p-2 font-bold font-mono text-slate-900 whitespace-nowrap">{e.amount.toLocaleString()} {settings.currencySymbol}</td>}
                            {isColVisible('taxAmount') && <td className="p-2 font-mono text-slate-500 whitespace-nowrap">{e.taxAmount ? `${e.taxAmount.toLocaleString()}` : '-'}</td>}
                            {isColVisible('invoiceNumber') && <td className="p-2 font-mono text-slate-500 text-[10px] whitespace-nowrap">{e.invoiceNumber || '-'}</td>}
                            {isColVisible('status') && (
                              <td className="p-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  e.status === 'معتمد' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {e.status}
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          {(() => {
                            const beforeCols = ['id', 'date', 'projectName', 'supervisor', 'category', 'details'].filter(isColVisible).length;
                            const afterCols = ['invoiceNumber', 'status'].filter(isColVisible).length;
                            return (
                              <>
                                {beforeCols > 0 && (
                                  <td colSpan={beforeCols} className="p-2.5 text-right font-black">إجمالي الكشف:</td>
                                )}
                                {isColVisible('amount') && (
                                  <td className="p-2.5 font-mono text-emerald-800 font-black whitespace-nowrap">
                                    {printData.data.expensesList.reduce((sum: number, e: any) => sum + e.amount, 0).toLocaleString()} {settings.currencySymbol}
                                  </td>
                                )}
                                {isColVisible('taxAmount') && (
                                  <td className="p-2.5 font-mono text-blue-800 font-black whitespace-nowrap">
                                    {printData.data.expensesList.reduce((sum: number, e: any) => sum + (e.taxAmount || 0), 0).toLocaleString()} {settings.currencySymbol}
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

                  {/* Signatures */}
                  {renderSignaturesFooter('المشرف الميداني', 'المحاسب المالي', 'الاعتماد النهائي')}
                </div>
              )}

              {/* 5. Expense List / Batch */}
              {printData.type === 'expense_list' && (
                <div className="space-y-4">
                  <div className="text-center py-2.5 bg-slate-100 rounded-xl border border-slate-200">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      {printData.data.title || 'كشف ومحضر سندات المصروفات والفواتير'}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      {printData.data.subtitle || 'سجل رسمي بكافة السندات المحددة'} • تاريخ الاستخراج: <span className="font-mono">{printDateStr}</span>
                    </p>
                  </div>

                  {/* KPI Bar */}
                  <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="p-2.5 border rounded-xl bg-slate-50">
                      <span className="text-slate-500 block text-[11px]">عدد السندات المشمولة</span>
                      <p className="text-base font-black text-slate-900 mt-1 font-mono">
                        {printData.data.expenses.length} سند
                      </p>
                    </div>
                    <div className="p-2.5 border rounded-xl bg-emerald-50 border-emerald-200">
                      <span className="text-emerald-700 block text-[11px] font-bold">إجمالي المبالغ</span>
                      <p className="text-base font-black text-emerald-700 mt-1 font-mono">
                        {printData.data.totalAmount.toLocaleString()} {settings.currencySymbol}
                      </p>
                    </div>
                    <div className="p-2.5 border rounded-xl bg-blue-50 border-blue-200">
                      <span className="text-blue-700 block text-[11px] font-bold">إجمالي الضرائب (15%)</span>
                      <p className="text-base font-black text-blue-900 mt-1 font-mono">
                        {printData.data.totalTax.toLocaleString()} {settings.currencySymbol}
                      </p>
                    </div>
                  </div>

                  {/* Expenses Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                        <tr>
                          {isColVisible('id') && <th className="p-2 font-bold">رقم السند</th>}
                          {isColVisible('date') && <th className="p-2 font-bold">التاريخ</th>}
                          {isColVisible('projectName') && <th className="p-2 font-bold">المشروع</th>}
                          {isColVisible('supervisor') && <th className="p-2 font-bold">المشرف</th>}
                          {isColVisible('category') && <th className="p-2 font-bold">البند</th>}
                          {isColVisible('details') && <th className="p-2 font-bold">البيان</th>}
                          {isColVisible('amount') && <th className="p-2 font-bold">المبلغ</th>}
                          {isColVisible('taxAmount') && <th className="p-2 font-bold">الضريبة</th>}
                          {isColVisible('invoiceNumber') && <th className="p-2 font-bold">الفاتورة</th>}
                          {isColVisible('status') && <th className="p-2 font-bold">الحالة</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {printData.data.expenses.map((e: Expense) => (
                          <tr key={e.id} className="hover:bg-slate-50/80">
                            {isColVisible('id') && <td className="p-2 font-mono font-bold text-slate-900">{e.id}</td>}
                            {isColVisible('date') && <td className="p-2 font-mono text-slate-600 whitespace-nowrap">{e.date}</td>}
                            {isColVisible('projectName') && <td className="p-2 font-semibold text-slate-900 whitespace-nowrap">{e.projectName}</td>}
                            {isColVisible('supervisor') && <td className="p-2 text-slate-700 whitespace-nowrap">{e.supervisorName}</td>}
                            {isColVisible('category') && <td className="p-2 text-slate-600 whitespace-nowrap">{e.category}</td>}
                            {isColVisible('details') && <td className="p-2 truncate max-w-[180px] text-slate-800">{e.details}</td>}
                            {isColVisible('amount') && <td className="p-2 font-bold font-mono text-slate-900 whitespace-nowrap">{e.amount.toLocaleString()} {settings.currencySymbol}</td>}
                            {isColVisible('taxAmount') && <td className="p-2 font-mono text-slate-500 whitespace-nowrap">{e.taxAmount ? `${e.taxAmount.toLocaleString()}` : '-'}</td>}
                            {isColVisible('invoiceNumber') && <td className="p-2 font-mono text-slate-500 text-[10px] whitespace-nowrap">{e.invoiceNumber || '-'}</td>}
                            {isColVisible('status') && (
                              <td className="p-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  e.status === 'معتمد' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {e.status}
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          {(() => {
                            const beforeCols = ['id', 'date', 'projectName', 'supervisor', 'category', 'details'].filter(isColVisible).length;
                            const afterCols = ['invoiceNumber', 'status'].filter(isColVisible).length;
                            return (
                              <>
                                {beforeCols > 0 && (
                                  <td colSpan={beforeCols} className="p-2.5 text-right font-black">إجمالي الكشف:</td>
                                )}
                                {isColVisible('amount') && (
                                  <td className="p-2.5 font-mono text-emerald-800 font-black whitespace-nowrap">
                                    {printData.data.totalAmount.toLocaleString()} {settings.currencySymbol}
                                  </td>
                                )}
                                {isColVisible('taxAmount') && (
                                  <td className="p-2.5 font-mono text-blue-800 font-black whitespace-nowrap">
                                    {printData.data.totalTax.toLocaleString()} {settings.currencySymbol}
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

                  {/* Signatures */}
                  {renderSignaturesFooter('المسؤول عن الكشف', 'المحاسب المالي', 'الاعتماد النهائي')}
                </div>
              )}

            </div>

            {/* Document Footer */}
            {printConfig.showFooterPageNum && (
              <div className="pt-3 mt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>تم الاستخراج بواسطة منظومة الرقابة المالية وإدارة المشاريع</span>
                <span>المستخدم: {currentUser.name} | التاريخ: {printDateStr}</span>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

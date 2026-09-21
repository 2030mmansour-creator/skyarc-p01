import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Expense, ExpenseAttachment, GPSLocation } from '../../types';
import { generateSampleInvoice } from '../../utils/sampleInvoices';
import { compressImageFile } from '../../utils/imageCompressor';
import { StorageService } from '../../services/storage';
import { IndexedDBVault } from '../../services/indexedDbVault';
import {
  X,
  MapPin,
  ImageIcon,
  Upload,
  Clock,
  Sparkles,
  Calculator,
  Check,
  AlertTriangle,
  AlertOctagon,
  Info,
  Building2,
  Wallet,
  CheckCircle2,
  Coins,
  Calendar,
  Lock,
  FileText,
  ExternalLink,
  Eye,
  FolderArchive,
  Camera,
  Plus,
  Trash2,
  Paperclip,
  Cloud,
  Link2
} from 'lucide-react';
import { PCloudMediaPickerModal } from '../common/PCloudMediaPickerModal';

export const ExpenseModal: React.FC = () => {
  const {
    isExpenseModalOpen,
    setIsExpenseModalOpen,
    editingExpense,
    setEditingExpense,
    addExpense,
    updateExpense,
    projects,
    accessibleProjects,
    getProjectsForUser,
    canUserOperateOnProject,
    currentUser,
    currentUserPermissions,
    users,
    supervisorsSummary,
    settings,
    showAlert,
    openAttachmentPreview
  } = useApp();

  const isSupervisor =
    currentUser.role === 'مشرف' ||
    currentUser.role === 'مشرف موقع' ||
    currentUser.roleId === 'role_supervisor' ||
    currentUser.role.includes('مشرف');

  const supervisorUsers = useMemo(() => {
    return users.filter(
      u => u.role === 'مشرف' || u.role === 'مشرف موقع' || u.roleId === 'role_supervisor' || u.role.includes('مشرف')
    );
  }, [users]);

  const [supervisorEmail, setSupervisorEmail] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');

  const targetSupervisorEmail = isSupervisor ? currentUser.email : (supervisorEmail || currentUser.email);

  // Projects available specifically for the active supervisor/user
  const availableProjects = useMemo(() => {
    return getProjectsForUser(targetSupervisorEmail);
  }, [getProjectsForUser, targetSupervisorEmail]);

  const hasNoAssignedProjects = availableProjects.length === 0;
  const [category, setCategory] = useState<string>('عمالة');
  const [amount, setAmount] = useState<number | ''>('');
  const [taxAmount, setTaxAmount] = useState<number | ''>('');
  const [details, setDetails] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
  const [invoicePhoto, setInvoicePhoto] = useState<string>('');
  const [invoiceFileName, setInvoiceFileName] = useState<string>('');
  const [isPCloudPickerOpen, setIsPCloudPickerOpen] = useState<boolean>(false);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | undefined>(undefined);
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Helper functions for VAT logic
  const isTaxInvoiceCategory = (cat: string): boolean => {
    const trimmed = (cat || '').trim();
    return trimmed === 'مصروفات بفواتير ضريبية' || trimmed.includes('فواتير ضريبية');
  };

  const calcVatFromInclusive = (totalAmount: number): number => {
    if (!totalAmount || isNaN(totalAmount) || totalAmount <= 0) return 0;
    // Saudi VAT 15% from tax-inclusive total: (total * 15) / 115
    return parseFloat(((totalAmount * 15) / 115).toFixed(2));
  };

  const isCurrentCategoryTaxable = isTaxInvoiceCategory(category);

  // Check if primary attachment is a PDF document
  const isPdf = Boolean(
    (attachments.length > 0 && attachments[0].fileType === 'pdf') ||
    (invoicePhoto && (
      invoicePhoto.startsWith('data:application/pdf') ||
      invoicePhoto.toLowerCase().includes('.pdf') ||
      invoiceFileName.toLowerCase().endsWith('.pdf')
    ))
  );

  // Helper to sync primary photo and filename with attachments
  const syncAttachments = (updatedList: ExpenseAttachment[]) => {
    setAttachments(updatedList);
    if (updatedList.length > 0) {
      setInvoicePhoto(updatedList[0].url);
      setInvoiceFileName(updatedList[0].fileName);
    } else {
      setInvoicePhoto('');
      setInvoiceFileName('');
    }
  };

  const addAttachments = (newItems: ExpenseAttachment[]) => {
    const combined = [...attachments, ...newItems];
    syncAttachments(combined);
  };

  const removeAttachment = (idToRemove: string) => {
    const filtered = attachments.filter(a => a.id !== idToRemove);
    syncAttachments(filtered);
  };

  // Initialize form
  useEffect(() => {
    if (editingExpense) {
      setSupervisorEmail(editingExpense.supervisorEmail);
      setProjectId(editingExpense.projectId);
      setCategory(editingExpense.category);
      setAmount(editingExpense.amount);
      if (isTaxInvoiceCategory(editingExpense.category)) {
        if (typeof editingExpense.taxAmount === 'number' && editingExpense.taxAmount > 0) {
          setTaxAmount(editingExpense.taxAmount);
        } else if (editingExpense.amount > 0) {
          setTaxAmount(calcVatFromInclusive(editingExpense.amount));
        } else {
          setTaxAmount('');
        }
      } else {
        setTaxAmount('');
      }
      setDetails(editingExpense.details);
      setInvoiceNumber(editingExpense.invoiceNumber || '');

      // Load existing attachments or legacy single photo with vault hydration
      let initialAttachments: ExpenseAttachment[] = [];
      const vaultItem = IndexedDBVault.getAttachmentSync(editingExpense.id);

      if (Array.isArray(editingExpense.attachments) && editingExpense.attachments.length > 0) {
        initialAttachments = editingExpense.attachments.map((att, i) => {
          if (!att.url && vaultItem) {
            const vaultAtt = Array.isArray(vaultItem.attachments) ? vaultItem.attachments[i] : null;
            const fallbackUrl = vaultAtt?.url || vaultItem.dataUrl || '';
            if (fallbackUrl) {
              return { ...att, url: fallbackUrl };
            }
          }
          return att;
        });
      } else if (vaultItem?.attachments && Array.isArray(vaultItem.attachments) && vaultItem.attachments.length > 0) {
        initialAttachments = vaultItem.attachments;
      } else if (editingExpense.invoicePhoto && editingExpense.invoicePhoto.trim()) {
        const isOldPdf = Boolean(
          editingExpense.invoicePhoto.startsWith('data:application/pdf') ||
          editingExpense.invoicePhoto.toLowerCase().includes('.pdf') ||
          editingExpense.attachmentFileName?.toLowerCase().endsWith('.pdf')
        );
        initialAttachments = [{
          id: `att-${Date.now()}-legacy`,
          url: editingExpense.invoicePhoto,
          fileName: editingExpense.attachmentFileName || (isOldPdf ? 'مستند_الفاتورة.pdf' : 'صورة_الفاتورة.jpg'),
          fileType: isOldPdf ? 'pdf' : 'image',
          uploadedAt: editingExpense.fingerprintTime || new Date().toISOString()
        }];
      } else if (vaultItem?.dataUrl) {
        const isPdf = vaultItem.fileType === 'pdf';
        initialAttachments = [{
          id: `att-${Date.now()}-vault`,
          url: vaultItem.dataUrl,
          fileName: vaultItem.fileName || editingExpense.attachmentFileName || (isPdf ? 'مستند_الفاتورة.pdf' : 'صورة_الفاتورة.jpg'),
          fileType: isPdf ? 'pdf' : 'image',
          uploadedAt: vaultItem.updatedAt || editingExpense.fingerprintTime || new Date().toISOString()
        }];
      }
      syncAttachments(initialAttachments);

      // Async fallback check
      if (initialAttachments.some(a => !a.url) || initialAttachments.length === 0) {
        IndexedDBVault.getAttachment(editingExpense.id).then((asyncRecord) => {
          if (!asyncRecord) return;
          if (Array.isArray(asyncRecord.attachments) && asyncRecord.attachments.length > 0) {
            syncAttachments(asyncRecord.attachments);
          } else if (asyncRecord.dataUrl && initialAttachments.length === 0) {
            syncAttachments([{
              id: `att-${Date.now()}-async-vault`,
              url: asyncRecord.dataUrl,
              fileName: asyncRecord.fileName || editingExpense.attachmentFileName || 'مرفق_الفاتورة.jpg',
              fileType: asyncRecord.fileType || 'image',
              uploadedAt: asyncRecord.updatedAt || new Date().toISOString()
            }]);
          }
        }).catch(() => {});
      }

      setDate(editingExpense.date);
      setGpsLocation(editingExpense.gpsLocation);
    } else {
      // New expense defaults
      if (isSupervisor) {
        setSupervisorEmail(currentUser.email);
      } else {
        setSupervisorEmail(supervisorUsers[0]?.email || currentUser.email);
      }
      setProjectId(availableProjects[0]?.id || '');
      const defaultCat = (settings.customCategories && settings.customCategories[0]) || 'عمالة';
      setCategory(defaultCat);
      setAmount('');
      setTaxAmount('');
      setDetails('');
      setInvoiceNumber('');
      syncAttachments([]);
      setDate(new Date().toISOString().split('T')[0]);
      
      // Auto-fetch GPS if enabled in settings
      if (settings.autoGpsCapture && navigator.geolocation) {
        setIsCapturingGps(true);
        navigator.geolocation.getCurrentPosition(
          pos => {
            setGpsLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
              address: 'موقع ميداني مسجل تلقائياً عبر المستشعر',
            });
            setIsCapturingGps(false);
          },
          err => {
            console.log('GPS error:', err.message);
            // Default location
            setGpsLocation({
              lat: 24.7136,
              lng: 46.6753,
              address: 'الرياض (موقع افتراضي)',
            });
            setIsCapturingGps(false);
          },
          { timeout: 5000 }
        );
      }
    }
  }, [editingExpense, isExpenseModalOpen, projects, settings, isSupervisor, currentUser.email, supervisorUsers]);

  // Keep projectId in sync with projects available to the active supervisor
  useEffect(() => {
    if (!editingExpense && availableProjects.length > 0) {
      if (!projectId || !availableProjects.some(p => p.id === projectId)) {
        setProjectId(availableProjects[0].id);
      }
    }
  }, [availableProjects, editingExpense, projectId]);

  // Active supervisor determination and custody balance tracking
  const activeSupervisorEmail = isSupervisor
    ? currentUser.email
    : (supervisorEmail || supervisorUsers[0]?.email || currentUser.email);

  const activeSupervisor = useMemo(() => {
    return users.find(u => u.email === activeSupervisorEmail) || currentUser;
  }, [users, activeSupervisorEmail, currentUser]);

  const activeSupervisorSummary = useMemo(() => {
    return supervisorsSummary.find(s => s.email === activeSupervisorEmail) || null;
  }, [supervisorsSummary, activeSupervisorEmail]);

  // Available remaining balance in custody for this supervisor
  const baseBalance = activeSupervisorSummary ? activeSupervisorSummary.actualRemainingBalance : 0;
  // If editing an existing expense, credit back the current amount so the user can adjust without artificial restriction
  const effectiveAvailableBalance = editingExpense && editingExpense.supervisorEmail === activeSupervisorEmail
    ? baseBalance + editingExpense.amount
    : baseBalance;

  const numAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const isZeroOrNegativeBalance = effectiveAvailableBalance <= 0;
  const isExceedingBalance = numAmount > effectiveAvailableBalance;
  const isInsufficientCustody = isZeroOrNegativeBalance || (numAmount > 0 && isExceedingBalance);
  const deficitAmount = isExceedingBalance
    ? numAmount - effectiveAvailableBalance
    : (isZeroOrNegativeBalance ? numAmount : 0);

  const selectedProject = useMemo(() => {
    return availableProjects.find(p => p.id === projectId) || projects.find(p => p.id === projectId);
  }, [availableProjects, projects, projectId]);

  if (!isExpenseModalOpen) return null;

  // Handle Category change & Auto Tax
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (isTaxInvoiceCategory(newCat)) {
      if (typeof amount === 'number' && amount > 0) {
        setTaxAmount(calcVatFromInclusive(amount));
      }
    } else {
      // Strictly clear and lock tax for all other categories
      setTaxAmount('');
    }
  };

  // Handle Amount change & Auto Tax 15% inclusive calculation
  const handleAmountChange = (val: string) => {
    if (val === '') {
      setAmount('');
      if (isTaxInvoiceCategory(category)) {
        setTaxAmount('');
      }
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
      setAmount('');
      setTaxAmount('');
      return;
    }
    setAmount(num);
    if (isTaxInvoiceCategory(category)) {
      setTaxAmount(calcVatFromInclusive(num));
    } else {
      setTaxAmount('');
    }
  };

  // Manual GPS capture
  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('المتصفح لا يدعم تحديد الموقع الجغرافي.');
      return;
    }
    setIsCapturingGps(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          address: 'إحداثيات ميدانية دقيقة للمشروع',
        });
        setIsCapturingGps(false);
      },
      err => {
        setGpsError('تعذر الحصول على الموقع، تم تثبيت إحداثيات المشروع.');
        setGpsLocation({
          lat: 24.7136,
          lng: 46.6753,
          address: 'الرياض (موقع افتراضي)',
        });
        setIsCapturingGps(false);
      }
    );
  };

  // Handle Camera Capture (Single live photo)
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.72);
        const newAtt: ExpenseAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: compressed,
          fileName: file.name || `صورة_كاميرا_${new Date().toISOString().slice(0, 10)}.jpg`,
          fileType: 'image',
          fileSize: file.size,
          uploadedAt: new Date().toISOString()
        };
        addAttachments([newAtt]);
      } catch (err) {
        console.warn('Compression fallback:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          const newAtt: ExpenseAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            url: reader.result as string,
            fileName: file.name || `صورة_كاميرا_${new Date().toISOString().slice(0, 10)}.jpg`,
            fileType: 'image',
            fileSize: file.size,
            uploadedAt: new Date().toISOString()
          };
          addAttachments([newAtt]);
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  // Handle Multiple Images Upload (Gallery or Files)
  const handleMultipleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachmentsList: ExpenseAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressed = await compressImageFile(file, 1280, 1280, 0.72);
        newAttachmentsList.push({
          id: `att-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          url: compressed,
          fileName: file.name,
          fileType: 'image',
          fileSize: file.size,
          uploadedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Compression fallback:', err);
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            newAttachmentsList.push({
              id: `att-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
              url: reader.result as string,
              fileName: file.name,
              fileType: 'image',
              fileSize: file.size,
              uploadedAt: new Date().toISOString()
            });
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
    }

    if (newAttachmentsList.length > 0) {
      addAttachments(newAttachmentsList);
    }
    e.target.value = '';
  };

  // Handle PDF Documents Upload (single or multiple PDFs)
  const handlePdfFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachmentsList: ExpenseAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showAlert('صيغة ملف غير صحيحة', `الملف "${file.name}" ليس بصيغة PDF. يرجى اختيار ملفات PDF فقط.`, 'warning');
        continue;
      }
      if (file.size > 650 * 1024) {
        showAlert('حجم ملف PDF كبير', `حجم ملف PDF "${file.name}" هو ${(file.size / 1024).toFixed(0)} ك.ب. لضمان المزامنة السحابية السريعة وعدم تجاوز حجم السجل، يرجى رفع ملف PDF أقل من 600 ك.ب أو التقاط صورة واضحة للمستند بالكاميرا (حيث يتم ضغطها وتحسينها فوراً).`, 'warning');
        continue;
      }

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newAttachmentsList.push({
            id: `att-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            url: reader.result as string,
            fileName: file.name || `مستند_${new Date().toISOString().slice(0, 10)}.pdf`,
            fileType: 'pdf',
            fileSize: file.size,
            uploadedAt: new Date().toISOString()
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    if (newAttachmentsList.length > 0) {
      addAttachments(newAttachmentsList);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      showAlert('بيانات مطلوبة', 'يرجى كتابة مبلغ المصروف بشكل صحيح.', 'warning');
      return;
    }

    // MANDATORY REQUIREMENT: Uploading invoice / receipt image or PDF is mandatory to complete expense registration
    if (attachments.length === 0 && (!invoicePhoto || !invoicePhoto.trim())) {
      showAlert(
        'مرفق الفاتورة إلزامي',
        'لابد من رفع صورة الفاتورة أو إرفاق مستند PDF (أو أكثر) كشرط أساسي لاكتمال تسجيل المصروف وقيده بالنظام.',
        'warning'
      );
      return;
    }

    // STRICT CHECK: Insufficient Supervisor Custody Balance
    if (effectiveAvailableBalance <= 0) {
      showAlert(
        'لا يمكن تسجيل المصروف - رصيد العهدة غير كافٍ',
        `المشرف (${activeSupervisor.name}) ليس لديه رصيد متبقي في العهدة المالية (${effectiveAvailableBalance.toLocaleString()} ${settings.currencySymbol}). لا يمكن تسجيل أي مصروف جديد حتى يتم صرف دفعة عهدة جديدة له لتفادي حدوث عجز مالي.`,
        'error'
      );
      return;
    }

    if (Number(amount) > effectiveAvailableBalance) {
      showAlert(
        'لا يمكن تسجيل المصروف - تجاوز رصيد العهدة',
        `مبلغ المصروف (${Number(amount).toLocaleString()} ${settings.currencySymbol}) يتجاوز الرصيد المتاح من عهدة المشرف (${effectiveAvailableBalance.toLocaleString()} ${settings.currencySymbol}) بعجز قدره (${(Number(amount) - effectiveAvailableBalance).toLocaleString()} ${settings.currencySymbol}). يرجى تخفيض المبلغ أو شحن رصيد العهدة أولاً.`,
        'error'
      );
      return;
    }

    if (!details.trim()) {
      showAlert('بيانات مطلوبة', 'يرجى كتابة بيان وتفاصيل المصروف.', 'warning');
      return;
    }

    if (hasNoAssignedProjects) {
      showAlert(
        'المشرف غير مسند على أي مشروع',
        `المشرف (${activeSupervisor.name}) غير مسند على أي مشروع حالياً. نظام الرقابة يمنع تسجيل فواتير حتى يتم تعيينه على مشروع من شاشة المشاريع.`,
        'error'
      );
      return;
    }

    const selectedProj = availableProjects.find(p => p.id === projectId) || projects.find(p => p.id === projectId);
    if (!selectedProj) {
      showAlert('المشروع غير محدد أو غير مسند', 'يرجى اختيار مشروع مسند لهذا المشرف.', 'warning');
      return;
    }

    const opCheck = canUserOperateOnProject(selectedProj.id, currentUser);
    if (!opCheck.canOperate) {
      showAlert('عملية غير مصرح بها على هذا المشروع', opCheck.reason || 'المشروع غير مسند إليك.', 'error');
      return;
    }

    const isTaxCat = isTaxInvoiceCategory(category);
    const finalTaxAmount = isTaxCat && taxAmount !== '' && Number(taxAmount) > 0
      ? Number(taxAmount)
      : undefined;

    // Automatic date: always determined automatically without manual input
    const automaticDate = editingExpense ? editingExpense.date : new Date().toISOString().split('T')[0];

    setIsSubmitting(true);

    try {
      const finalPhotoUrl = invoicePhoto || undefined;

      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          projectId: selectedProj.id,
          projectName: selectedProj.name,
          supervisorEmail: activeSupervisor.email,
          supervisorName: activeSupervisor.name,
          category,
          amount: Number(amount),
          taxAmount: finalTaxAmount,
          details,
          invoiceNumber: invoiceNumber.trim() || undefined,
          invoicePhoto: finalPhotoUrl,
          attachments,
          attachmentFileName: invoiceFileName || undefined,
          date: automaticDate,
          gpsLocation,
        });
      } else {
        await addExpense({
          projectId: selectedProj.id,
          projectName: selectedProj.name,
          supervisorEmail: activeSupervisor.email,
          supervisorName: activeSupervisor.name,
          category,
          amount: Number(amount),
          taxAmount: finalTaxAmount,
          details,
          invoiceNumber: invoiceNumber.trim() || undefined,
          invoicePhoto: finalPhotoUrl,
          attachments,
          attachmentFileName: invoiceFileName || undefined,
          date: automaticDate,
          gpsLocation,
        });
      }

      setIsExpenseModalOpen(false);
      setEditingExpense(null);
    } catch (err: any) {
      console.error('Failed to submit expense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
      <div className="relative my-auto w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 shrink-0 z-10">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {editingExpense ? `تعديل المصروف (${editingExpense.id})` : 'تسجيل مصروف / فاتورة جديدة'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              إدخال المستند المالي وربطه بالمشروع وخصمه من العهدة بعد الاعتماد
            </p>
          </div>
          <button
            onClick={() => {
              setIsExpenseModalOpen(false);
              setEditingExpense(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 30-minute Notice Banner */}
        <div className="px-4 sm:px-6 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 shrink-0">
          <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>تذكير نظامي:</strong> يُتاح للمشرف تعديل أو حذف الفاتورة خلال {settings.editGracePeriodMinutes} دقيقة من وقت البصمة، وبعدها تُقفل للاعتماد المحاسبي.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* Supervisor Custody Status & Balance Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  effectiveAvailableBalance > 0
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                }`}>
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    المشرف صاحب العهدة:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {activeSupervisor.name}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      ({activeSupervisor.email})
                    </span>
                  </div>
                </div>
              </div>

              {/* Custody Balance Display */}
              <div className="flex items-center justify-between sm:justify-end gap-3 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">
                    الرصيد المتاح بالعهدة:
                  </span>
                  <span className={`text-sm sm:text-base font-black font-mono ${
                    effectiveAvailableBalance > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {effectiveAvailableBalance.toLocaleString()} {settings.currencySymbol}
                  </span>
                </div>
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                  effectiveAvailableBalance > 0
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 animate-pulse'
                }`}>
                  {effectiveAvailableBalance > 0 ? 'رصيد متاح' : 'رصيد مستنفذ'}
                </span>
              </div>
            </div>

            {/* If user is manager/accountant, allow picking the supervisor */}
            {!isSupervisor && (
              <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 shrink-0">
                  قيد المصروف على عهدة المشرف:
                </label>
                <select
                  value={activeSupervisorEmail}
                  onChange={e => setSupervisorEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {supervisorUsers.map(s => {
                    const sum = supervisorsSummary.find(sm => sm.email === s.email);
                    const bal = sum ? sum.actualRemainingBalance : 0;
                    return (
                      <option key={s.id} value={s.email}>
                        {s.name} — (الرصيد المتاح: {bal.toLocaleString()} {settings.currencySymbol})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Zero or Negative Custody Balance Warning */}
            {isZeroOrNegativeBalance && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100 flex items-start gap-2.5 text-xs animate-in fade-in">
                <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-rose-800 dark:text-rose-200">
                    لا يمكن تسجيل أي مصروف - رصيد عهدة المشرف غير كافٍ!
                  </p>
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                    رصيد العهدة المتبقي للمشرف ({activeSupervisor.name}) هو <strong className="font-mono font-black">{effectiveAvailableBalance.toLocaleString()} {settings.currencySymbol}</strong>.
                    نظام الرقابة المالية يمنع قيد وتسجيل أي فواتير أو مصاريف جديدة عند عدم توفر رصيد كافٍ في العهدة منعاً لحدوث عجز مالي.
                  </p>
                  <div className="text-[11px] font-semibold text-rose-950 dark:text-rose-200 pt-1">
                    * الإجراء المطلوب: صرف دفعة عهدة نقدية جديدة للمشرف من قسم المحاسبة.
                  </div>
                </div>
              </div>
            )}

            {/* No Assigned Projects Warning */}
            {hasNoAssignedProjects && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 flex items-start gap-2.5 text-xs animate-in fade-in">
                <AlertOctagon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-amber-800 dark:text-amber-200">
                    المشرف غير مسند على أي مشروع ميداني!
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    المشرف المختار ({activeSupervisor.name}) لم يتم تعيينه على أي مشروع حتى الآن. بناءً على سياسة الرقابة الميدانية، تمنع المنظومة قيد أي سندات أو فواتير حتى يتم إسناد المشرف على المشروع من شاشة المشاريع.
                  </p>
                  <div className="text-[11px] font-semibold text-amber-950 dark:text-amber-200 pt-1">
                    * الإجراء المطلوب: الانتقال لشاشة المشاريع وتعيين المشرف على المشروع المطلوب.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Project & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  المشروع المسند <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                  ({availableProjects.length} مشاريع متاحة)
                </span>
              </div>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                disabled={hasNoAssignedProjects}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                required
              >
                {hasNoAssignedProjects ? (
                  <option value="">لا توجد مشاريع مسندة لهذا المشرف</option>
                ) : (
                  availableProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                البند / التصنيف <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={e => handleCategoryChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              >
                {(settings.customCategories || []).map((c, i) => (
                  <option key={i} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount & Tax Calculator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                المبلغ الإجمالي شامل الضريبة ({settings.currencySymbol}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                المبلغ النهائي المسدد شاملاً ضريبة القيمة المضافة.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  قيمة الضريبة المضافة (15%)
                </label>
                {isCurrentCategoryTaxable ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-lg">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    <span>احتساب آلي 15%</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg">
                    <span>معفي / بدون ضريبة</span>
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder={isCurrentCategoryTaxable ? '0.00' : 'غير متاح لهذا البند (بدون ضريبة)'}
                  value={isCurrentCategoryTaxable ? taxAmount : ''}
                  onChange={e => {
                    if (!isCurrentCategoryTaxable) return;
                    setTaxAmount(e.target.value === '' ? '' : parseFloat(e.target.value));
                  }}
                  disabled={!isCurrentCategoryTaxable}
                  readOnly={!isCurrentCategoryTaxable}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold focus:outline-none transition-all ${
                    isCurrentCategoryTaxable
                      ? 'bg-slate-50 dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500'
                      : 'bg-slate-100/90 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none'
                  }`}
                />
                {!isCurrentCategoryTaxable && (
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                    مقفل (بدون ضريبة)
                  </div>
                )}
              </div>

              {isCurrentCategoryTaxable ? (
                <div className="mt-1.5 space-y-1">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" />
                    <span>المبلغ شامل الضريبة: يتم استخراج الضريبة تلقائياً بالمعادلة (الإجمالي × 15 ÷ 115).</span>
                  </p>
                  {typeof amount === 'number' && amount > 0 && typeof taxAmount === 'number' && taxAmount > 0 && (
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-slate-400 block text-[10px]">المبلغ قبل الضريبة (الصافي):</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {(amount - taxAmount).toFixed(2)} {settings.currencySymbol}
                        </span>
                      </div>
                      <div>
                        <span className="text-emerald-600 dark:text-emerald-400 block text-[10px]">قيمة الضريبة المضافة (15%):</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                          {taxAmount.toFixed(2)} {settings.currencySymbol}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  * لا يتم احتساب أي ضريبة ولا يمكن إدخال أي رقم إلا عند اختيار بند "مصروفات بفواتير ضريبية".
                </p>
              )}
            </div>
          </div>

          {/* Real-time Custody Balance Evaluation & Overdraft Alert */}
          {numAmount > 0 && (
            <div>
              {isExceedingBalance ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-sm block text-rose-800 dark:text-rose-200">
                      تنبيه مالي: مبلغ المصروف يتجاوز رصيد العهدة المتاح!
                    </span>
                    <span className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed block">
                      المبلغ المدخل (<strong className="font-mono">{numAmount.toLocaleString()} {settings.currencySymbol}</strong>) أكبر من الرصيد المتبقي في عهدة المشرف (<strong className="font-mono">{effectiveAvailableBalance.toLocaleString()} {settings.currencySymbol}</strong>) بعجز قدره (<strong className="font-mono text-rose-950 dark:text-white underline">{deficitAmount.toLocaleString()} {settings.currencySymbol}</strong>).
                      لا يمكن تسجيل أو قيد هذا المصروف حتى يتم تخفيض المبلغ ليطابق رصيد العهدة أو صرف عهدة تعزيزية.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">رصيد العهدة كافٍ لتغطية المصروف.</span>
                  </div>
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    الرصيد المتبقي المتوقع بعد الصرف: <span className="font-bold font-mono text-emerald-900 dark:text-emerald-200">{(effectiveAvailableBalance - numAmount).toLocaleString()} {settings.currencySymbol}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Details / Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              البيان والتفاصيل <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="مثال: شراء كوابل كهربائية وأنابيب تمديد نحاسية من شركة الفنار..."
              value={details}
              onChange={e => setDetails(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          {/* Invoice Number & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                رقم الفاتورة الضريبية / السند
              </label>
              <input
                type="text"
                placeholder="INV-XXXX (إن وجد)"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>

            {/* AUTOMATIC EXPENSE DATE - LOCKED / READ-ONLY AS REQUESTED */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  تاريخ الصرف
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg">
                  <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>تسجيل أوتوماتيكي</span>
                </span>
              </div>
              <div className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{date}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                  <span>تثبيت آلي</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                * يتم توثيق تاريخ الصرف آلياً وفقاً للوقت الفعلي بدون إدخال يدوي لضمان دقة الرقابة المالية.
              </p>
            </div>
          </div>

          {/* GPS Location Component */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  إحداثيات الموقع الميداني (GPS)
                </span>
              </div>
              <button
                type="button"
                onClick={captureGps}
                disabled={isCapturingGps}
                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 transition-colors"
              >
                {isCapturingGps ? 'جاري التقاط الإحداثيات...' : 'تحديث الموقع الآن'}
              </button>
            </div>

            {gpsLocation ? (
              <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 font-mono">
                <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  خط العرض: {gpsLocation.lat.toFixed(5)}
                </span>
                <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  خط الطول: {gpsLocation.lng.toFixed(5)}
                </span>
                {gpsLocation.accuracy && (
                  <span className="text-emerald-600 text-[10px]">دقة: {gpsLocation.accuracy}م</span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">لم يتم التقاط الموقع بعد.</p>
            )}
            {gpsError && <p className="text-[10px] text-rose-500 mt-1">{gpsError}</p>}
          </div>

          {/* Invoice Document / Image Upload (MANDATORY REQUIREMENT - Supports pCloud Public Folder & Multiple Files) */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border-2 border-dashed border-sky-200 dark:border-sky-900/60 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>مرفقات الفاتورة وسندات الصرف (عبر مجلد pCloud المشترك)</span>
                  <span className="text-rose-500 font-extrabold text-xs">* (شرط إلزامي للإكمال)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                {attachments.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-full shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>تم إرفاق ({attachments.length}) مستند/صورة</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 px-2.5 py-0.5 rounded-full animate-pulse shadow-2xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>مرفق إلزامي مطلوب</span>
                  </span>
                )}
              </div>
            </div>

            {/* PRIMARY PCLOUD ACTION BUTTON */}
            <div className="p-3 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-emerald-500/10 border border-sky-300 dark:border-sky-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    استعراض واختيار الصور والمستندات من مجلد pCloud
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تصفح مجلد صور وسندات المشروع على pCloud واختيار الفاتورة المطلوبة مباشرة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPCloudPickerOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
              >
                <Cloud className="w-4 h-4" />
                <span>فتح مستعرض مجلد pCloud</span>
              </button>
            </div>

            {attachments.length > 0 ? (
              <div className="space-y-3">
                {/* List of uploaded attachments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {attachments.map((att, idx) => {
                    const isAttPdf = att.fileType === 'pdf' || att.url.startsWith('data:application/pdf') || att.fileName.toLowerCase().endsWith('.pdf');
                    const isFromPCloud = att.source === 'pcloud' || Boolean(att.pcloudFileId);
                    const currentExpenseSnapshot: any = {
                      id: editingExpense?.id || 'EXP-NEW',
                      projectId: projectId || '',
                      projectName: projects.find(p => p.id === projectId)?.name || 'مشروع',
                      category: category || 'مصروف',
                      amount: Number(amount) || 0,
                      date: date || new Date().toISOString().split('T')[0],
                      status: editingExpense?.status || 'pending',
                      attachments: attachments,
                      invoicePhoto: attachments[0]?.url || invoicePhoto || '',
                      ...(editingExpense || {})
                    };

                    return (
                      <div
                        key={att.id || idx}
                        className={`relative rounded-xl border p-2.5 flex items-center justify-between gap-2.5 shadow-2xs group transition-all ${
                          isFromPCloud
                            ? 'bg-sky-50/40 dark:bg-sky-950/20 border-sky-200/90 dark:border-sky-800/80 hover:border-sky-400 dark:hover:border-sky-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 hover:border-emerald-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {isAttPdf ? (
                            <button
                              type="button"
                              onClick={() => openAttachmentPreview({
                                url: att.url,
                                title: att.fileName || `مستند PDF (${idx + 1})`,
                                subtitle: `سند المصروف - مرفق رقم ${idx + 1} من ${attachments.length}`,
                                attachments,
                                initialIndex: idx,
                                codedFileName: att.fileName
                              }, currentExpenseSnapshot)}
                              className="w-11 h-11 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 flex items-center justify-center shrink-0 cursor-pointer transition-transform group-hover:scale-105"
                              title="معاينة مستند PDF"
                            >
                              <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAttachmentPreview({
                                url: att.url,
                                title: att.fileName || `مرفق صورة (${idx + 1})`,
                                subtitle: `سند المصروف - مرفق رقم ${idx + 1} من ${attachments.length}`,
                                attachments,
                                initialIndex: idx,
                                codedFileName: att.fileName
                              }, currentExpenseSnapshot)}
                              className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 cursor-pointer relative group-hover:scale-105 transition-transform"
                              title="معاينة الصورة"
                            >
                              <img
                                src={att.url}
                                alt={att.fileName || 'صورة مرفقة'}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          )}

                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => openAttachmentPreview({
                                url: att.url,
                                title: att.fileName || `مرفق (${idx + 1})`,
                                subtitle: isAttPdf ? 'مستند PDF' : 'صورة مرفقة',
                                attachments,
                                initialIndex: idx,
                                codedFileName: att.fileName
                              }, currentExpenseSnapshot)}
                              className="text-left rtl:text-right w-full block cursor-pointer group/title"
                            >
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover/title:text-sky-600 dark:group-hover/title:text-sky-400 transition-colors" title={att.fileName}>
                                {att.fileName || (isAttPdf ? `مستند_${idx + 1}.pdf` : `صورة_${idx + 1}.jpg`)}
                              </p>
                              {isFromPCloud && (
                                <p className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <Link2 className="w-3 h-3 shrink-0" />
                                  <span>رابط pCloud (اضغط لفتح المعاينة)</span>
                                </p>
                              )}
                            </button>

                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {isFromPCloud && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-0.5">
                                  <Cloud className="w-2.5 h-2.5" />
                                  <span>pCloud Link</span>
                                </span>
                              )}
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                isAttPdf
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                  : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              }`}>
                                {isAttPdf ? 'مستند PDF' : 'صورة'}
                              </span>
                              {att.fileSize && (
                                <span className="text-[10px] text-slate-400">
                                  {(att.fileSize / 1024).toFixed(0)} ك.ب
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openAttachmentPreview({
                              url: att.url,
                              title: att.fileName || `معاينة مرفق (${idx + 1})`,
                              subtitle: isAttPdf ? 'مستند PDF' : 'صورة مرفقة',
                              attachments,
                              initialIndex: idx,
                              codedFileName: att.fileName
                            }, currentExpenseSnapshot)}
                            className="px-2 py-1 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/60 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold border border-sky-200 dark:border-sky-800/80 shadow-2xs"
                            title="معاينة المرفق"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">معاينة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                            title="حذف هذا المرفق"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Additional upload buttons for adding more attachments */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-sky-600" />
                    <span>إضافة المزيد من المرفقات والصور:</span>
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsPCloudPickerOpen(true)}
                      className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>اختيار من pCloud</span>
                    </button>

                    <label className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      <span>كاميرا</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleCameraCapture}
                        className="hidden"
                      />
                    </label>

                    <label className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع صور</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleMultipleImagesUpload}
                        className="hidden"
                      />
                    </label>

                    <label className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>رفع PDF</span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        multiple
                        onChange={handlePdfFilesUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-sky-300 dark:border-sky-800/80 rounded-2xl p-4 sm:p-5 text-center bg-sky-50/40 dark:bg-sky-950/20 space-y-3 transition-colors">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 flex items-center justify-center shadow-xs">
                    <Cloud className="w-7 h-7" />
                  </div>
                </div>

                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-sky-950 dark:text-sky-200">
                    اختر صور ومستندات الفاتورة من مجلد pCloud المشترك
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 max-w-lg mx-auto">
                    يتم قراءة محتويات مجلد المشروع على pCloud مباشرة واختيار صور الفواتير وسندات الصرف بسهولة وسرعة.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsPCloudPickerOpen(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold cursor-pointer shadow-md shadow-sky-600/20 transition-all flex items-center gap-2"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>تصفح واختيار من pCloud الآن</span>
                  </button>

                  <label className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>التقاط بالكاميرا</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraCapture}
                      className="hidden"
                    />
                  </label>

                  <label className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>رفع ملف محلي</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleMultipleImagesUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Coded File & Project Folder Confirmation Banner */}
            {attachments.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs animate-in fade-in duration-150">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <FolderArchive className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>المجلد المنفصل للمشروع:</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800 text-[11px] truncate">
                      {selectedProject ? `مجلد_مشروع_${selectedProject.code || selectedProject.id}_${selectedProject.name}` : 'مجلد المشروع'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                    <span>عدد المرفقات المؤرشفة:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 select-all">
                      {attachments.length} ملفات مؤرشفة بسند المصروف
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>تكويد وفصل تلقائي بالسيرفر</span>
                </span>
              </div>
            )}
          </div>

          {/* Modal Actions Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">إرفاق الفاتورة أو السند إلزامي للرقابة المالية</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-modal-cancel"
                type="button"
                onClick={() => {
                  setIsExpenseModalOpen(false);
                  setEditingExpense(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isInsufficientCustody || !amount || amount <= 0 || hasNoAssignedProjects || !invoicePhoto || !invoicePhoto.trim()}
                className={`px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
                  isInsufficientCustody || !amount || amount <= 0 || hasNoAssignedProjects || !invoicePhoto || !invoicePhoto.trim()
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-emerald-600/30 cursor-pointer'
                }`}
                title={
                  !invoicePhoto || !invoicePhoto.trim()
                    ? 'لابد من رفع صورة الفاتورة أو سند الاستلام كشرط أساسي لإكمال تسجيل المصروف'
                    : hasNoAssignedProjects
                    ? 'لا يمكن التسجيل: المشرف غير مسند على أي مشروع'
                    : isZeroOrNegativeBalance
                    ? 'لا يمكن التسجيل: رصيد العهدة مستنفذ بالكامل'
                    : isExceedingBalance
                    ? 'لا يمكن التسجيل: المبلغ يتجاوز رصيد العهدة المتاح'
                    : ''
                }
              >
                {!invoicePhoto || !invoicePhoto.trim() ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>مطلوب إرفاق صورة الفاتورة</span>
                  </>
                ) : hasNoAssignedProjects ? (
                  <>
                    <AlertOctagon className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>المشرف غير مسند لمشروع</span>
                  </>
                ) : isZeroOrNegativeBalance ? (
                  <>
                    <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>رصيد العهدة غير كافٍ (مقفل)</span>
                  </>
                ) : isExceedingBalance ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>المبلغ يتجاوز رصيد العهدة</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{editingExpense ? 'حفظ التعديلات' : 'تسجيل وحفظ المصروف'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>

      {/* pCloud Public Folder Media Picker Modal */}
      <PCloudMediaPickerModal
        isOpen={isPCloudPickerOpen}
        onClose={() => setIsPCloudPickerOpen(false)}
        projectId={projectId}
        allowMultiple={true}
        onSelectAttachments={(newAttachments) => {
          addAttachments(newAttachments);
        }}
      />
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Printer,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  FileText,
  User,
  ShieldCheck,
  Building,
  Calendar,
  DollarSign,
  AlertCircle,
  Lock,
  Eye,
  Paperclip,
  Image as ImageIcon,
  Cloud,
  Link2
} from 'lucide-react';
import { SaveSyncBadge } from '../common/SaveSyncBadge';
import { IndexedDBVault } from '../../services/indexedDbVault';

export const ExpenseDetailModal: React.FC = () => {
  const {
    selectedExpenseForDetail,
    setSelectedExpenseForDetail,
    currentUser,
    currentUserRole,
    hasPermission,
    settings,
    approveBySupervisor,
    approveByAccountant,
    approveByManagement,
    rejectExpense,
    deleteExpense,
    setEditingExpense,
    setIsExpenseModalOpen,
    setPrintData,
    setIsPrintModalOpen,
    canEditExpense,
    canDeleteExpenseCheck,
    confirmAction,
    showAlert,
    openAttachmentPreview
  } = useApp();

  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [accountantNotes, setAccountantNotes] = useState('');
  const [managementNotes, setManagementNotes] = useState('');
  const [vaultAttachments, setVaultAttachments] = useState<any[]>([]);

  const exp = selectedExpenseForDetail;

  useEffect(() => {
    if (!exp) return;
    let isCancelled = false;

    // Check synchronous memory cache first
    const syncItem = IndexedDBVault.getAttachmentSync(exp.id);
    if (syncItem?.attachments && Array.isArray(syncItem.attachments) && syncItem.attachments.length > 0) {
      setVaultAttachments(syncItem.attachments);
    } else if (syncItem?.dataUrl) {
      setVaultAttachments([{
        id: 'vault-sync-1',
        url: syncItem.dataUrl,
        fileName: syncItem.fileName || exp.attachmentFileName,
        fileType: syncItem.fileType || 'image',
        uploadedAt: syncItem.updatedAt || exp.fingerprintTime
      }]);
    }

    // Check asynchronous IndexedDB vault
    IndexedDBVault.getAttachment(exp.id).then((vaultRecord) => {
      if (isCancelled || !vaultRecord) return;
      if (Array.isArray(vaultRecord.attachments) && vaultRecord.attachments.length > 0) {
        setVaultAttachments(vaultRecord.attachments);
      } else if (vaultRecord.dataUrl) {
        const isPdf = vaultRecord.fileType === 'pdf';
        setVaultAttachments([{
          id: 'vault-async-1',
          url: vaultRecord.dataUrl,
          fileName: vaultRecord.fileName || exp.attachmentFileName,
          fileType: isPdf ? 'pdf' : 'image',
          uploadedAt: vaultRecord.updatedAt || exp.fingerprintTime
        }]);
      }
    }).catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [exp?.id, exp?.projectId]);

  const allAttachments = useMemo(() => {
    if (!exp) return [];
    const list: any[] = [];
    const seenUrls = new Set<string>();
    const seenNames = new Set<string>();

    const addAtt = (att: any) => {
      if (!att) return;
      const url = att.url || att.dataUrl || '';
      const name = att.fileName || '';
      const key = (url && url.length > 30) ? url.substring(0, 50) : (att.id || name);
      if (key && (seenUrls.has(key) || (name && seenNames.has(name) && url))) {
        // Update empty url if new one is valid
        const idx = list.findIndex(item => (item.id && item.id === att.id) || (name && item.fileName === name));
        if (idx >= 0 && !list[idx].url && url) {
          list[idx] = { ...list[idx], url };
        }
        return;
      }
      if (key) seenUrls.add(key);
      if (name) seenNames.add(name);

      const isPdf = Boolean(
        att.fileType === 'pdf' ||
        url.startsWith('data:application/pdf') ||
        url.toLowerCase().includes('.pdf') ||
        name.toLowerCase().endsWith('.pdf')
      );

      list.push({
        id: att.id || `att-${list.length + 1}`,
        url: url,
        fileName: name || (isPdf ? `مستند_رقم_${list.length + 1}.pdf` : `صورة_مرفقة_${list.length + 1}.jpg`),
        fileType: isPdf ? 'pdf' : 'image',
        fileSize: att.fileSize,
        uploadedAt: att.uploadedAt || exp.fingerprintTime
      });
    };

    // 1. Add attachments from expense object
    if (Array.isArray(exp.attachments)) {
      exp.attachments.forEach(addAtt);
    }

    // 2. Add attachments from vault
    if (Array.isArray(vaultAttachments)) {
      vaultAttachments.forEach(addAtt);
    }

    // 3. Fallback to invoicePhoto if present
    if (exp.invoicePhoto && exp.invoicePhoto.trim()) {
      addAtt({
        id: 'legacy-invoice-photo',
        url: exp.invoicePhoto,
        fileName: exp.attachmentFileName || (exp.invoicePhoto.startsWith('data:application/pdf') || exp.invoicePhoto.toLowerCase().includes('.pdf') ? 'مستند_الفاتورة.pdf' : 'صورة_الفاتورة.jpg'),
        fileType: (exp.invoicePhoto.startsWith('data:application/pdf') || exp.invoicePhoto.toLowerCase().includes('.pdf')) ? 'pdf' : 'image',
        uploadedAt: exp.fingerprintTime
      });
    }

    return list;
  }, [exp, vaultAttachments]);

  if (!exp) return null;

  const editCheck = canEditExpense(exp);
  const deleteCheck = canDeleteExpenseCheck(exp);

  const isStage1Done =
    exp.supervisorApproval === 'تم اعتماد المشرف' ||
    exp.projectManagerApproval === 'تم اعتماد مدير المشروع' ||
    (exp.workflowHistory?.some(h => (h.stageId === 'stage_supervisor' || h.stageId === 'stage_pm') && h.status === 'approved' && (h.stageId as string) !== 'submission') ?? false);

  const isStage2Done =
    isStage1Done &&
    (exp.accountantApproval === 'تم الاعتماد' ||
      (exp.workflowHistory?.some(h => h.stageId === 'stage_accountant' && h.status === 'approved' && (h.stageId as string) !== 'submission') ?? false));

  const isStage3Done =
    isStage2Done &&
    (exp.managementApproval === 'تم اعتماد الادارة' ||
      exp.status === 'معتمد' ||
      (exp.workflowHistory?.some(h => h.stageId === 'stage_management' && h.status === 'approved' && (h.stageId as string) !== 'submission') ?? false));

  const handlePrint = () => {
    setPrintData({ type: 'expense', data: exp });
    setIsPrintModalOpen(true);
  };

  const handleEdit = () => {
    if (!editCheck.canEdit) {
      showAlert('لا يمكن تعديل هذا المصروف', editCheck.reason || 'ليس لديك صلاحية لتعديل هذا المصروف.', 'warning');
      return;
    }
    setSelectedExpenseForDetail(null);
    setEditingExpense(exp);
    setIsExpenseModalOpen(true);
  };

  const handleDelete = () => {
    if (!deleteCheck.canDelete) {
      showAlert('لا يمكن حذف هذا المصروف', deleteCheck.reason || 'ليس لديك صلاحية لحذف هذا المصروف.', 'warning');
      return;
    }

    confirmAction({
      title: 'تأكيد حذف المصروف نهائياً',
      message: `هل أنت متأكد من حذف هذا السند (${exp.id})؟ سيتم حذفه من كافة السجلات وتحديث أرصدة المشروع والعهدة.`,
      details: `المبلغ: ${exp.amount.toLocaleString()} ${settings.currencySymbol} | البند: ${exp.category} | المشروع: ${exp.projectName}`,
      confirmText: 'نعم، حذف المصروف',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: async () => {
        await deleteExpense(exp.id);
        setSelectedExpenseForDetail(null);
      }
    });
  };

  const handleSupervisorApprove = async () => {
    await approveBySupervisor(exp.id, supervisorNotes || undefined);
    setSelectedExpenseForDetail(null);
  };

  const handleAccountantApprove = async () => {
    await approveByAccountant(exp.id, accountantNotes || undefined);
    setSelectedExpenseForDetail(null);
  };

  const handleManagementApprove = async () => {
    await approveByManagement(exp.id, managementNotes || undefined);
    setSelectedExpenseForDetail(null);
  };

  const handleReject = async () => {
    if (!rejectionNotes.trim()) {
      showAlert('تنبيه مطلوب', 'يرجى كتابة سبب الرفض لتوجيه المشرف.', 'warning');
      return;
    }
    await rejectExpense(exp.id, rejectionNotes);
    setSelectedExpenseForDetail(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
      <div className="relative my-auto w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-mono font-bold text-xs">
              EXP
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  سند صرف رقم: {exp.id}
                </h3>
                <SaveSyncBadge
                  savedLocally={exp.savedLocally ?? true}
                  synced={exp.synced}
                  size="sm"
                  showLabel={true}
                />
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                وقت البصمة: {new Date(exp.fingerprintTime).toLocaleString('ar-SA')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="طباعة السند"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedExpenseForDetail(null)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* Main Key Figures */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block">المبلغ الإجمالي</span>
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                {exp.amount.toLocaleString()} <span className="text-xs">{settings.currencySymbol}</span>
              </p>
              {exp.taxAmount ? (
                <p className="text-[11px] text-emerald-600 mt-0.5">
                  شامل ضريبة 15%: {exp.taxAmount.toLocaleString()} {settings.currencySymbol}
                </p>
              ) : null}
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">المشروع</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                {exp.projectName}
              </p>
              <span className="text-[11px] text-slate-400 block mt-0.5">البند: {exp.category}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">المشرف المسؤول</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {exp.supervisorName}
              </p>
              <span className="text-[11px] text-slate-400 block mt-0.5">{exp.date}</span>
            </div>
          </div>

          {/* Details & Statement */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              البيان وتفاصيل المصروف
            </span>
            <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
              {exp.details}
            </p>
            {exp.invoiceNumber && (
              <p className="text-xs text-slate-500 font-mono mt-2">
                رقم الفاتورة الضريبية / السند: <strong>{exp.invoiceNumber}</strong>
              </p>
            )}
          </div>

          {/* Location and Invoice Image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* GPS Location Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  الموقع الميداني للبصمة (GPS)
                </span>
              </div>
              {exp.gpsLocation ? (
                <div className="space-y-1 text-xs">
                  <p className="text-slate-600 dark:text-slate-300">
                    {exp.gpsLocation.address || 'موقع مسجل'}
                  </p>
                  <p className="font-mono text-[11px] text-slate-400">
                    Lat: {exp.gpsLocation.lat.toFixed(5)}, Lng: {exp.gpsLocation.lng.toFixed(5)}
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${exp.gpsLocation.lat},${exp.gpsLocation.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    عرض على خرائط Google ↗
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-400">لا توجد إحداثيات مسجلة لهذا المصروف.</p>
              )}
            </div>

            {/* Invoice Attachments Gallery (Supports multiple images and PDFs) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    مرفقات وسندات الفاتورة الرسمية ({allAttachments.length})
                  </span>
                </div>
                {allAttachments.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                    {allAttachments.length === 1 ? 'مرفق واحد' : `${allAttachments.length} مرفقات`}
                  </span>
                )}
              </div>

              {allAttachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {allAttachments.map((att, idx) => {
                    const isAttPdf = att.fileType === 'pdf' || (att.url && att.url.startsWith('data:application/pdf')) || (att.fileName && att.fileName.toLowerCase().endsWith('.pdf'));
                    const isFromPCloud = att.source === 'pcloud' || Boolean(att.pcloudFileId) || (att.url && att.url.includes('/api/pcloud/'));
                    const previewTitle = att.fileName || (isAttPdf ? `مستند PDF (${idx + 1})` : `مرفق صورة (${idx + 1})`);
                    const previewSubtitle = `${exp.projectName} • ${exp.category} • ${exp.amount.toLocaleString()} ${settings.currencySymbol} • مرفق ${idx + 1} من ${allAttachments.length}`;

                    const handleOpen = () => {
                      openAttachmentPreview({
                        url: att.url,
                        title: previewTitle,
                        subtitle: previewSubtitle,
                        codedFileName: att.fileName,
                        expenseId: exp.id,
                        expense: exp,
                        initialIndex: idx
                      }, exp);
                    };

                    return isAttPdf ? (
                      <button
                        key={att.id || idx}
                        type="button"
                        onClick={handleOpen}
                        className="w-full p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 transition-all text-right cursor-pointer group shadow-2xs hover:scale-[1.01] flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px]" title={att.fileName}>
                              {att.fileName || `مستند_رقم_${idx + 1}.pdf`}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isFromPCloud && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-0.5">
                                  <Cloud className="w-2.5 h-2.5" />
                                  <span>pCloud</span>
                                </span>
                              )}
                              <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold">
                                مستند PDF • اضغط للمعاينة
                              </span>
                            </div>
                          </div>
                        </div>
                        <Eye className="w-4 h-4 text-rose-500 shrink-0" />
                      </button>
                    ) : (
                      <button
                        key={att.id || idx}
                        type="button"
                        onClick={handleOpen}
                        className={`w-full rounded-xl overflow-hidden border transition-all cursor-pointer group text-right shadow-2xs hover:scale-[1.01] bg-white dark:bg-slate-900 ${
                          isFromPCloud
                            ? 'border-sky-300 dark:border-sky-800 hover:border-sky-500'
                            : 'border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                        }`}
                      >
                        <div className="relative h-24 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          {att.url ? (
                            <img
                              src={att.url}
                              alt={att.fileName || 'صورة الفاتورة'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-all"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                              <ImageIcon className="w-6 h-6 text-slate-400" />
                              <span className="text-[10px]">مرفق في الخزينة</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-bold">
                            <Eye className="w-4 h-4" />
                            <span>معاينة الفاتورة</span>
                          </div>
                        </div>
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between text-[10px]">
                          <div className="min-w-0 flex items-center gap-1">
                            {isFromPCloud && (
                              <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-0.5 shrink-0">
                                <Link2 className="w-2.5 h-2.5" />
                                <span>pCloud</span>
                              </span>
                            )}
                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[130px]" title={att.fileName}>
                              {att.fileName || `صورة_مرفقة_${idx + 1}.jpg`}
                            </span>
                          </div>
                          <span className="text-sky-600 dark:text-sky-400 font-semibold shrink-0 flex items-center gap-0.5">
                            <Eye className="w-3 h-3" />
                            <span>معاينة</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="h-24 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400">
                  لا توجد صور أو مستندات مرفقة بهذا المصروف
                </div>
              )}
            </div>

          </div>

          {/* Approval Workflow Progression Timeline */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3">
              دورة الاعتماد والمراجعة الرقابية المتسلسلة (3 مراحل إجبارية)
            </h4>

            <div className="space-y-3">
              {/* Submission Info */}
              <div className="flex items-start gap-3 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  📝
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">
                    تسجيل وقيد المصروف الميداني ({exp.supervisorName})
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    {new Date(exp.fingerprintTime).toLocaleString('ar-SA')}
                  </p>
                </div>
              </div>

              {/* Stage 1: Supervisor Review & Approval */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                    isStage1Done
                      ? 'bg-emerald-500 text-white'
                      : exp.status === 'مرفوض' && exp.supervisorApproval === 'مرفوض'
                      ? 'bg-rose-500 text-white'
                      : 'bg-amber-400 text-amber-950 font-bold'
                  }`}
                >
                  {isStage1Done ? '✓' : exp.supervisorApproval === 'مرفوض' ? '✗' : '1'}
                </div>
                <div className="text-xs flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">
                    المرحلة 1: مراجعة المصروف والاعتماد للمشرف (مشرف الموقع)
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    الحالة: <strong>{isStage1Done ? 'تم اعتماد المشرف' : (exp.status === 'مرفوض' ? 'مرفوض' : 'بانتظار الاعتماد')}</strong>
                    {isStage1Done && (exp.supervisorApproverName || exp.projectManagerName) && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400"> • المعتمد: {exp.supervisorApproverName || exp.projectManagerName}</span>
                    )}
                    {exp.supervisorActionTime && ` • ${new Date(exp.supervisorActionTime).toLocaleString('ar-SA')}`}
                  </p>
                  {exp.supervisorNotes && (
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 mt-1">
                      ملاحظات المشرف: {exp.supervisorNotes}
                    </p>
                  )}
                </div>
              </div>

              {/* Stage 2: Accountant Review & Posting */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                    isStage2Done
                      ? 'bg-emerald-500 text-white'
                      : exp.accountantApproval === 'مرفوض'
                      ? 'bg-rose-500 text-white'
                      : isStage1Done
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {isStage2Done ? '✓' : exp.accountantApproval === 'مرفوض' ? '✗' : '2'}
                </div>
                <div className="text-xs flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">
                    المرحلة 2: مراجعة وترحيل المحاسب المالي (المحاسب المالي)
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    الحالة: <strong>{isStage2Done ? 'تم الاعتماد والترحيل' : (!isStage1Done ? 'معلق بانتظار اعتماد المشرف' : 'بانتظار مراجعة المحاسب')}</strong>
                    {isStage2Done && exp.accountantName && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400"> • المحاسب المعتمد: {exp.accountantName}</span>
                    )}
                    {exp.accountantActionTime && ` • ${new Date(exp.accountantActionTime).toLocaleString('ar-SA')}`}
                  </p>
                  {exp.erpReferenceNumber && (
                    <p className="text-blue-700 dark:text-blue-400 text-[11px] font-mono mt-0.5">
                      قيد محاسبي: #{exp.erpReferenceNumber} ({exp.erpSystemName || 'ERP'})
                    </p>
                  )}
                  {exp.accountantNotes && (
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 mt-1">
                      ملاحظات المحاسب: {exp.accountantNotes}
                    </p>
                  )}
                </div>
              </div>

              {/* Stage 3: Management Final Approval */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                    isStage3Done
                      ? 'bg-emerald-500 text-white'
                      : exp.managementApproval === 'مرفوض'
                      ? 'bg-rose-500 text-white'
                      : isStage2Done
                      ? 'bg-amber-400 text-amber-950 font-bold'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {isStage3Done ? '✓' : exp.managementApproval === 'مرفوض' ? '✗' : '3'}
                </div>
                <div className="text-xs flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">
                    المرحلة 3: اعتماد الإدارة العليا 0 (مدير تنفيذي / إدارة عليا)
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    الحالة: <strong>{isStage3Done ? 'معتمد نهائياً' : (!isStage2Done ? 'معلق بانتظار ترحيل المحاسب المالي' : 'بانتظار الاعتماد النهائي')}</strong>
                    {isStage3Done && exp.managementName && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400"> • معتمد الإدارة: {exp.managementName}</span>
                    )}
                    {exp.managementActionTime && ` • ${new Date(exp.managementActionTime).toLocaleString('ar-SA')}`}
                  </p>
                  {exp.managementNotes && (
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 mt-1">
                      ملاحظات الإدارة: {exp.managementNotes}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Rejection reason display if rejected */}
          {exp.status === 'مرفوض' && exp.rejectionReason && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs">
              <span className="font-bold text-rose-800 dark:text-rose-300 block mb-1">
                سبب الرفض المسجل:
              </span>
              <p className="text-rose-700 dark:text-rose-200">{exp.rejectionReason}</p>
            </div>
          )}

          {/* Interactive Approval Controls */}
          {exp.status !== 'معتمد' && exp.status !== 'مرفوض' && (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>إجراءات الرقابة والاعتماد المتسلسل (بصفتك: {currentUser.role})</span>
              </h4>

              {/* Stage 1 action for Supervisor */}
              {(currentUser.role.includes('مشرف') || currentUser.roleId === 'role_supervisor') && !isStage1Done && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">المرحلة 1: مراجعة المصروف والاعتماد للمشرف</p>
                  <input
                    type="text"
                    placeholder="ملاحظات المشرف على المصروف (اختياري)..."
                    value={supervisorNotes}
                    onChange={e => setSupervisorNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSupervisorApprove}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>اعتماد المشرف ونقل المصروف للمحاسب المالي</span>
                    </button>
                    <button
                      onClick={() => setShowRejectBox(!showRejectBox)}
                      className="px-3 py-2 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 rounded-xl text-xs font-bold transition-all"
                    >
                      رفض المصروف
                    </button>
                  </div>
                </div>
              )}

              {/* Stage 2 action for Accountant */}
              {(currentUser.role.includes('محاسب') || currentUser.roleId === 'role_accountant') && !isStage2Done && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">المرحلة 2: مراجعة وترحيل المحاسب المالي</p>
                  {!isStage1Done ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>لا يمكن اعتماد هذا المصروف في المرحلة 2 قبل أن يعتمده المشرف في المرحلة 1.</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="ملاحظات المحاسب المالي على الفاتورة (اختياري)..."
                        value={accountantNotes}
                        onChange={e => setAccountantNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleAccountantApprove}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>اعتماد المحاسب المالي ونقله للإدارة العليا</span>
                        </button>
                        <button
                          onClick={() => setShowRejectBox(!showRejectBox)}
                          className="px-3 py-2 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 rounded-xl text-xs font-bold transition-all"
                        >
                          رفض الفاتورة
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Stage 3 action for Executive / Management */}
              {(currentUser.role.includes('مدير') || currentUser.role.includes('عليا') || currentUser.roleId === 'role_management' || currentUser.roleId === 'role_admin') && !isStage3Done && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">المرحلة 3: اعتماد الإدارة العليا النهائي</p>
                  {!isStage1Done ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>لا يمكن اعتماد هذا المصروف من الإدارة العليا قبل استكمال المرحلة 1 (المشرف) والمرحلة 2 (المحاسب المالي).</span>
                    </div>
                  ) : !isStage2Done ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>لا يمكن اعتماد هذا المصروف من الإدارة العليا قبل أن يقوم المحاسب المالي بالمراجعة والترحيل في المرحلة 2.</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="ملاحظات الإدارة العليا والخصم النهائي من العهدة..."
                        value={managementNotes}
                        onChange={e => setManagementNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleManagementApprove}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>اعتماد الإدارة العليا النهائي 0</span>
                        </button>
                        <button
                          onClick={() => setShowRejectBox(!showRejectBox)}
                          className="px-3 py-2 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 rounded-xl text-xs font-bold transition-all"
                        >
                          رفض الفاتورة
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Rejection input box */}
              {showRejectBox && (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900 space-y-2 animate-in fade-in">
                  <label className="block text-xs font-bold text-rose-700 dark:text-rose-300">
                    سبب رفض الفاتورة <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="اكتب سبب الرفض (مثال: الفاتورة غير واضحة، تجاوز السعر السوقي...)"
                    value={rejectionNotes}
                    onChange={e => setRejectionNotes(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-rose-300 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    onClick={handleReject}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                  >
                    تأكيد الرفض وإشعار المشرف
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            {!hasPermission('canEditExpense') && !hasPermission('canDeleteExpense') ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-semibold">
                <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>شاشة للاطلاع والتدقيق المالي فقط ({currentUserRole?.name || 'مخصص'})</span>
              </div>
            ) : (
              <>
                {editCheck.canEdit && (
                  <button
                    onClick={handleEdit}
                    className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                )}
                {deleteCheck.canDelete && (
                  <button
                    onClick={handleDelete}
                    className="px-3.5 py-2 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                )}
                {editCheck.canEdit && editCheck.remainingMinutes > 0 && editCheck.remainingMinutes < 9000 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold animate-pulse">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>متبقي للتعديل: {editCheck.remainingMinutes} دقيقة</span>
                  </span>
                )}
                {!editCheck.canEdit && !deleteCheck.canDelete && (editCheck.reason || deleteCheck.reason) && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-bold"
                    title={editCheck.reason || deleteCheck.reason}
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{editCheck.reason || deleteCheck.reason || 'المصروف مقفل رقابياً لمنع التلاعب'}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السند</span>
            </button>
            <button
              onClick={() => setSelectedExpenseForDetail(null)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

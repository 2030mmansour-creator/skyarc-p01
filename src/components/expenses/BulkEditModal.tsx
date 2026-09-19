import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Expense } from '../../types';
import {
  Layers,
  X,
  CheckSquare,
  Square,
  AlertCircle,
  FolderKanban,
  Tag,
  Calendar,
  CreditCard,
  FileText,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedExpenses: Expense[];
  onSuccess: () => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedExpenses,
  onSuccess
}) => {
  const {
    projects,
    accessibleProjects,
    settings,
    currentUser,
    currentUserPermissions,
    bulkUpdateExpenses,
    canEditExpense,
    confirmAction,
    showAlert,
    addNotification
  } = useApp();

  const isSupervisor =
    currentUser.role === 'مشرف' ||
    currentUser.role === 'مشرف موقع' ||
    currentUser.roleId === 'role_supervisor' ||
    currentUser.role.includes('مشرف');

  const isAccountant =
    currentUser.role === 'محاسب' ||
    currentUser.role === 'محاسب مالي' ||
    currentUser.roleId === 'role_accountant' ||
    currentUser.role.includes('محاسب');

  const availableProjects = useMemo(() => {
    if (isSupervisor || isAccountant || !currentUserPermissions.canViewAllProjects) {
      return accessibleProjects;
    }
    return projects;
  }, [isSupervisor, isAccountant, currentUserPermissions.canViewAllProjects, accessibleProjects, projects]);

  // Field Selection Toggles
  const [applyProject, setApplyProject] = useState(false);
  const [newProjectId, setNewProjectId] = useState(availableProjects[0]?.id || projects[0]?.id || '');

  const [applyCategory, setApplyCategory] = useState(false);
  const [newCategory, setNewCategory] = useState(settings.customCategories?.[0] || 'نثريات ومشتريات');

  const [applyDate, setApplyDate] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const [applyInvoiceNumber, setApplyInvoiceNumber] = useState(false);
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');

  const [applyDetails, setApplyDetails] = useState(false);
  const [detailsMode, setDetailsMode] = useState<'replace' | 'append'>('append');
  const [newDetailsText, setNewDetailsText] = useState('');

  const [applyStatus, setApplyStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<Expense['status']>('بانتظار الاعتماد');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Separate editable from non-editable based on permissions
  const { editableExpenses, blockedExpenses } = useMemo(() => {
    const editable: Expense[] = [];
    const blocked: Expense[] = [];

    selectedExpenses.forEach(exp => {
      const check = canEditExpense(exp);
      if (check.canEdit) {
        editable.push(exp);
      } else {
        blocked.push(exp);
      }
    });

    return { editableExpenses: editable, blockedExpenses: blocked };
  }, [selectedExpenses, canEditExpense]);

  const totalAmount = useMemo(() => {
    return selectedExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [selectedExpenses]);

  const canChangeStatus = currentUser.role === 'مدير' || currentUser.role === 'محاسب' || currentUser.permissions?.canApproveExpenses;

  if (!isOpen) return null;

  const handleApply = () => {
    // Validate that at least one field is selected
    if (!applyProject && !applyCategory && !applyDate && !applyInvoiceNumber && !applyDetails && !applyStatus) {
      showAlert('تنبيه', 'يرجى تفعيل وتحديد حقل واحد على الأقل ترغب في تعديله بشكل جماعي.', 'warning');
      return;
    }

    if (applyDetails && !newDetailsText.trim()) {
      showAlert('بيانات مطلوبة', 'يرجى إدخال نص البيان أو الملاحظة الإضافية المراد تطبيقها.', 'warning');
      return;
    }

    if (editableExpenses.length === 0) {
      showAlert(
        'تعذر التعديل',
        'كافة السندات المحددة معتمدة نهائياً أو خارج مهلة التعديل المسموحة لك.',
        'error'
      );
      return;
    }

    const changesSummary: string[] = [];
    if (applyProject) {
      const p = projects.find(proj => proj.id === newProjectId);
      changesSummary.push(`المشروع الجديد: "${p?.name || newProjectId}"`);
    }
    if (applyCategory) {
      changesSummary.push(`البند والتصنيف: "${newCategory}"`);
    }
    if (applyDate) {
      changesSummary.push(`تاريخ الصرف: ${newDate}`);
    }
    if (applyInvoiceNumber) {
      changesSummary.push(`رقم الفاتورة: "${newInvoiceNumber.trim() || 'بدون رقم'}"`);
    }
    if (applyDetails) {
      changesSummary.push(
        detailsMode === 'replace'
          ? `استبدال البيان إلى: "${newDetailsText}"`
          : `إلحاق بالنص الحالي: "${newDetailsText}"`
      );
    }
    if (applyStatus) {
      changesSummary.push(`حالة الاعتماد: "${newStatus}"`);
    }

    confirmAction({
      title: `تأكيد التعديل الجماعي (${editableExpenses.length} سند)`,
      message: `هل أنت متأكد من تطبيق التغييرات التالية على (${editableExpenses.length}) سند مصروف محدد؟`,
      details: changesSummary.join(' • '),
      confirmText: 'نعم، تطبيق التعديلات الآن',
      cancelText: 'تراجع',
      type: 'info',
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const commonUpdates: Partial<Expense> = {};

          if (applyProject) {
            const p = projects.find(proj => proj.id === newProjectId);
            commonUpdates.projectId = newProjectId;
            commonUpdates.projectName = p ? p.name : '';
          }
          if (applyCategory) {
            commonUpdates.category = newCategory;
            const isTax = newCategory.trim() === 'مصروفات بفواتير ضريبية' || newCategory.includes('فواتير ضريبية');
            if (!isTax) {
              commonUpdates.taxAmount = undefined;
            }
          }
          if (applyDate) {
            commonUpdates.date = newDate;
          }
          if (applyInvoiceNumber) {
            commonUpdates.invoiceNumber = newInvoiceNumber.trim();
          }
          if (applyStatus) {
            commonUpdates.status = newStatus;
          }

          if (applyDetails) {
            // Apply individually if mode is append, or set common if replace
            if (detailsMode === 'replace') {
              commonUpdates.details = newDetailsText.trim();
              await bulkUpdateExpenses(editableExpenses.map(e => e.id), commonUpdates);
            } else {
              // Append to each
              for (const exp of editableExpenses) {
                const updatedDetails = `${exp.details} - ${newDetailsText.trim()}`;
                await bulkUpdateExpenses([exp.id], { ...commonUpdates, details: updatedDetails });
              }
            }
          } else {
            await bulkUpdateExpenses(editableExpenses.map(e => e.id), commonUpdates);
          }

          addNotification(
            'تم التعديل الجماعي بنجاح',
            `تم تحديث بيانات (${editableExpenses.length}) سند مصروفات بنجاح.`,
            'system'
          );

          onSuccess();
          onClose();
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
      <div className="relative my-auto w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تعديل جماعي للمصروفات والفواتير
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تعديل وتوحيد الحقول لعدد ({selectedExpenses.length}) سند محدد
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          
          {/* Summary Box */}
          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                  عدد السندات المحددة:
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-bold text-xs">
                  {selectedExpenses.length} سند
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                إجمالي القيمة:{' '}
                <span className="font-extrabold text-indigo-700 dark:text-indigo-400">
                  {totalAmount.toLocaleString()} {settings.currencySymbol}
                </span>
              </div>
            </div>

            {/* List of IDs pills */}
            <div className="mt-2.5 flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-1">
              {selectedExpenses.map(exp => (
                <span
                  key={exp.id}
                  className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-indigo-200/60 dark:border-indigo-800/40 text-[10px] font-mono text-slate-700 dark:text-slate-300 font-semibold"
                >
                  {exp.id}
                </span>
              ))}
            </div>

            {blockedExpenses.length > 0 && (
              <div className="mt-2 pt-2 border-t border-indigo-200/40 dark:border-indigo-800/40 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  ملاحظة: عدد ({blockedExpenses.length}) سند غير قابل للتعديل (معتمد نهائياً أو انتهت مهلته للمشرف)، وسيتم تطبيق التعديلات حصراً على ({editableExpenses.length}) سند المتاحة.
                </span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            قم بتفعيل الحقول التي ترغب في تعديلها فقط (الحقول غير المفعلة ستحافظ على قيمتها الأصلية لكل سند دون تغيير):
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            
            {/* 1. Project */}
            <div className={`p-3 rounded-xl border transition-all ${
              applyProject
                ? 'bg-white dark:bg-slate-800 border-indigo-500 dark:border-indigo-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 opacity-70'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label
                  onClick={() => setApplyProject(!applyProject)}
                  className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200 text-xs"
                >
                  {applyProject ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                  <span>تغيير وتوحيد المشروع</span>
                </label>
                {applyProject && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">مفعل</span>
                )}
              </div>

              {applyProject && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <select
                    value={newProjectId}
                    onChange={e => setNewProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {availableProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 2. Category */}
            <div className={`p-3 rounded-xl border transition-all ${
              applyCategory
                ? 'bg-white dark:bg-slate-800 border-indigo-500 dark:border-indigo-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 opacity-70'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label
                  onClick={() => setApplyCategory(!applyCategory)}
                  className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200 text-xs"
                >
                  {applyCategory ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <Tag className="w-3.5 h-3.5 text-emerald-500" />
                  <span>تغيير بند وتصنيف المصروف</span>
                </label>
                {applyCategory && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">مفعل</span>
                )}
              </div>

              {applyCategory && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {(settings.customCategories || []).map((cat, i) => (
                      <option key={i} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 3. Date */}
            <div className={`p-3 rounded-xl border transition-all ${
              applyDate
                ? 'bg-white dark:bg-slate-800 border-indigo-500 dark:border-indigo-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 opacity-70'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label
                  onClick={() => setApplyDate(!applyDate)}
                  className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200 text-xs"
                >
                  {applyDate ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>تغيير تاريخ الصرف</span>
                </label>
                {applyDate && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">مفعل</span>
                )}
              </div>

              {applyDate && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* 4. Invoice Number */}
            <div className={`p-3 rounded-xl border transition-all ${
              applyInvoiceNumber
                ? 'bg-white dark:bg-slate-800 border-indigo-500 dark:border-indigo-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 opacity-70'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label
                  onClick={() => setApplyInvoiceNumber(!applyInvoiceNumber)}
                  className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200 text-xs"
                >
                  {applyInvoiceNumber ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <FileText className="w-3.5 h-3.5 text-purple-500" />
                  <span>تعديل أو توحيد رقم الفاتورة الضريبية</span>
                </label>
                {applyInvoiceNumber && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">مفعل</span>
                )}
              </div>

              {applyInvoiceNumber && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <input
                    type="text"
                    value={newInvoiceNumber}
                    onChange={e => setNewInvoiceNumber(e.target.value)}
                    placeholder="أدخل رقم الفاتورة أو المرجع الضريبي..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* 5. Details and Notes */}
            <div className={`p-3 rounded-xl border transition-all ${
              applyDetails
                ? 'bg-white dark:bg-slate-800 border-indigo-500 dark:border-indigo-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 opacity-70'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label
                  onClick={() => setApplyDetails(!applyDetails)}
                  className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200 text-xs"
                >
                  {applyDetails ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  <span>تعديل أو إلحاق بالبيان / الملاحظات</span>
                </label>
                {applyDetails && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">مفعل</span>
                )}
              </div>

              {applyDetails && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="detailsMode"
                        checked={detailsMode === 'append'}
                        onChange={() => setDetailsMode('append')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>إلحاق نص بنهاية البيان الحالي</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="detailsMode"
                        checked={detailsMode === 'replace'}
                        onChange={() => setDetailsMode('replace')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>استبدال البيان بالكامل</span>
                    </label>
                  </div>

                  <textarea
                    rows={2}
                    value={newDetailsText}
                    onChange={e => setNewDetailsText(e.target.value)}
                    placeholder={
                      detailsMode === 'append'
                        ? 'اكتب النص المراد إضافته في نهاية بيان كل سند...'
                        : 'اكتب نص البيان الجديد الموحد لكافة السندات...'
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              )}
            </div>

            {/* 6. Status (Restricted to Authorized Roles) */}
            {canChangeStatus && (
              <div className={`p-3 rounded-xl border transition-all ${
                applyStatus
                  ? 'bg-white dark:bg-slate-800 border-indigo-500 dark:border-indigo-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 opacity-70'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label
                    onClick={() => setApplyStatus(!applyStatus)}
                    className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200 text-xs"
                  >
                    {applyStatus ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                    <span>تعديل حالة الاعتماد (صلاحية إدارية)</span>
                  </label>
                  {applyStatus && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">مفعل</span>
                  )}
                </div>

                {applyStatus && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 grid grid-cols-3 gap-2">
                    {(['بانتظار الاعتماد', 'معتمد', 'مرفوض'] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setNewStatus(status)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                          newStatus === status
                            ? status === 'معتمد'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : status === 'مرفوض'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            إلغاء وتراجع
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isSubmitting || editableExpenses.length === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تطبيق التعديلات على ({editableExpenses.length}) سند</span>
          </button>
        </div>

      </div>
    </div>
  );
};

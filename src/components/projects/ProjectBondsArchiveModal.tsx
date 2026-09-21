import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Project, Expense } from '../../types';
import { AttachmentArchiver } from '../../services/attachmentArchiver';
import {
  FolderArchive,
  Download,
  FileText,
  Image as ImageIcon,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Receipt,
  Search,
  Filter,
  Layers,
  FileArchive
} from 'lucide-react';

interface ProjectBondsArchiveModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectBondsArchiveModal: React.FC<ProjectBondsArchiveModalProps> = ({
  project,
  isOpen,
  onClose,
}) => {
  const { expenses, settings, openAttachmentPreview, showAlert } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pdf' | 'image' | 'has_attachment'>('all');
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  if (!isOpen || !project) return null;

  const projectExpenses = expenses.filter(e => e.projectId === project.id);
  const folderName = AttachmentArchiver.getProjectFolderName(project);

  const expensesWithMeta = projectExpenses.map(exp => {
    const hasAttachment = Boolean(exp.invoicePhoto && exp.invoicePhoto.trim().length > 0);
    const isPdf = Boolean(
      exp.invoicePhoto && (
        exp.invoicePhoto.startsWith('data:application/pdf') ||
        exp.invoicePhoto.toLowerCase().includes('.pdf') ||
        exp.attachmentFileName?.toLowerCase().endsWith('.pdf')
      )
    );
    const codedName = exp.attachmentFileName || AttachmentArchiver.generateCodedFileName({
      bondNumber: exp.id,
      projectCode: project.code || project.id,
      projectName: project.name,
      invoiceNumber: exp.invoiceNumber,
      isPdf
    });

    return {
      ...exp,
      hasAttachment,
      isPdf,
      codedName,
    };
  });

  const filteredExpenses = expensesWithMeta.filter(exp => {
    if (filterType === 'has_attachment' && !exp.hasAttachment) return false;
    if (filterType === 'pdf' && (!exp.hasAttachment || !exp.isPdf)) return false;
    if (filterType === 'image' && (!exp.hasAttachment || exp.isPdf)) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        exp.id.toLowerCase().includes(q) ||
        exp.codedName.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        exp.details.toLowerCase().includes(q) ||
        exp.supervisorName.toLowerCase().includes(q) ||
        (exp.invoiceNumber && exp.invoiceNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalAttachmentsCount = expensesWithMeta.filter(e => e.hasAttachment).length;
  const totalPdfsCount = expensesWithMeta.filter(e => e.hasAttachment && e.isPdf).length;
  const totalImagesCount = expensesWithMeta.filter(e => e.hasAttachment && !e.isPdf).length;
  const totalAmount = projectExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleDownloadZip = async () => {
    if (totalAttachmentsCount === 0) {
      showAlert(
        'لا توجد مرفقات للتحميل',
        'لم يتم إرفاق أي صور أو ملفات PDF في سندات هذا المشروع بعد.',
        'warning'
      );
      return;
    }

    setIsDownloadingZip(true);
    try {
      const res = await AttachmentArchiver.downloadProjectBondsArchive(project, projectExpenses);
      showAlert(
        'تم تحميل الأرشيف بنجاح',
        `تم ضغط وتحميل (${res.filesCount}) ملف مرفق مكود برقم السند في ملف الأرشيف (${res.fileName}) بنجاح.`,
        'info'
      );
    } catch (err: any) {
      console.error('Error downloading zip:', err);
      showAlert('خطأ أثناء التنزيل', 'تعذر ضغط ملفات المشروع، يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadSingleFile = (exp: typeof expensesWithMeta[0]) => {
    if (!exp.invoicePhoto) return;
    try {
      const a = document.createElement('a');
      a.href = exp.invoicePhoto;
      a.download = exp.codedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(exp.invoicePhoto, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6 flex justify-center items-center animate-in fade-in duration-200" dir="rtl">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  {project.code || project.id}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  أرشيف ومجلد سندات مشروع: {project.name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تكويد الملفات برقم السند وحفظ سندات المشروع في مجلد منفصل
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Top Info Banner & Actions */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <FileArchive className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>المجلد المنفصل للمشروع:</span>
                <code className="font-mono bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs select-all">
                  {folderName}/
                </code>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                <span>إجمالي السندات: <strong className="text-slate-900 dark:text-white font-bold">{projectExpenses.length} سند</strong></span>
                <span>•</span>
                <span>المرفقات المحفوظة: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalAttachmentsCount} ملف مكود</strong></span>
                <span>({totalPdfsCount} مستند PDF • {totalImagesCount} صورة)</span>
                <span>•</span>
                <span>إجمالي المصروفات: <strong className="text-slate-900 dark:text-white font-bold">{totalAmount.toLocaleString()} {settings.currencySymbol}</strong></span>
              </p>
            </div>

            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip || totalAttachmentsCount === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              {isDownloadingZip ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري تجميع وضغط الأرشيف...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تحميل ملف أرشيف المشروع (ZIP)</span>
                </>
              )}
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث برقم السند، الفاتورة، البند..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  filterType === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                الكل ({projectExpenses.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('has_attachment')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  filterType === 'has_attachment'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                بمرفقات ({totalAttachmentsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('pdf')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  filterType === 'pdf'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                مستندات PDF ({totalPdfsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('image')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  filterType === 'image'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                صور ({totalImagesCount})
              </button>
            </div>
          </div>

          {/* Bonds Table / List */}
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6">
              <FolderArchive className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد سندات مطابقة</h4>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm ? 'جرّب البحث بكلمة أخرى أو إعادة تعيين التصفية.' : 'لم يتم تسجيل أي سندات لهذا المشروع بعد.'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold">
                    <tr>
                      <th className="py-3 px-4">رقم السند</th>
                      <th className="py-3 px-4">اسم الملف المكود بالحفظ</th>
                      <th className="py-3 px-4">البند والتفاصيل</th>
                      <th className="py-3 px-4">المشرف والتاريخ</th>
                      <th className="py-3 px-4 text-left">المبلغ</th>
                      <th className="py-3 px-4 text-center">نوع المرفق</th>
                      <th className="py-3 px-4 text-center">إجراءات الملف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Bond Number */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            {exp.id}
                          </span>
                          {exp.invoiceNumber && (
                            <span className="block text-[10px] text-slate-400 mt-1">
                              فاتورة: {exp.invoiceNumber}
                            </span>
                          )}
                        </td>

                        {/* Coded File Name */}
                        <td className="py-3 px-4 max-w-xs">
                          {exp.hasAttachment ? (
                            <div className="flex items-center gap-1.5">
                              {exp.isPdf ? (
                                <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                              )}
                              <span
                                className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate select-all"
                                title={exp.codedName}
                              >
                                {exp.codedName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">
                              بدون مرفق
                            </span>
                          )}
                        </td>

                        {/* Category & Details */}
                        <td className="py-3 px-4 max-w-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {exp.category}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block max-w-[180px]" title={exp.details}>
                            {exp.details}
                          </span>
                        </td>

                        {/* Supervisor & Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-slate-800 dark:text-slate-200 block font-semibold">
                            {exp.supervisorName}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {exp.date}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 text-left whitespace-nowrap">
                          <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {exp.amount.toLocaleString()} {settings.currencySymbol}
                          </span>
                        </td>

                        {/* Attachment Type Badge */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {exp.hasAttachment ? (
                            exp.isPdf ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                <FileText className="w-3 h-3" />
                                <span>مستند PDF</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                <ImageIcon className="w-3 h-3" />
                                <span>صورة</span>
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {exp.hasAttachment && exp.invoicePhoto ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openAttachmentPreview(exp.invoicePhoto!, exp)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer"
                                title="معاينة المرفق"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadSingleFile(exp)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                                title={`تحميل الملف المكود: ${exp.codedName}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Informational Guidance Note */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                نظام التكويد التلقائي والفصل الرقابي للمشاريع:
              </p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400 leading-relaxed">
                كل صورة أو ملف مستند PDF يتم رفعه على النظام يتم تكويده تلقائياً برقم السند (<span className="font-mono font-bold text-emerald-600">EXP-XXXX</span>) ومتبوعاً بكود المشروع ورقم الفاتورة، مع حفظ ملفات وسندات كل مشروع على حدة في مجلد تخزين منفصل لتسهيل الفرز المالي، والمراجعة الضريبية، والأرشفة السحابية.
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            مشروع: <strong className="text-slate-800 dark:text-slate-200">{project.name}</strong> • الكود: <span className="font-mono font-bold">{project.code || project.id}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};

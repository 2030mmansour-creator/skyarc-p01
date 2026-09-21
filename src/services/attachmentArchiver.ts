import JSZip from 'jszip';
import { Expense, Project } from '../types';
import { FirebaseService } from './firebase';
import { IndexedDBVault } from './indexedDbVault';

export interface AttachmentArchiveItem {
  expenseId: string; // رقم السند
  bondNumber: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  dataUrl: string;
  amount: number;
  date: string;
  category: string;
  invoiceNumber?: string;
  supervisorName: string;
}

export const AttachmentArchiver = {
  /**
   * Cleans names for safe file and directory naming
   */
  sanitizeName(name: string): string {
    return (name || '')
      .trim()
      .replace(/[\\/*?:"<>|]/g, '_')
      .replace(/\s+/g, '_');
  },

  /**
   * Generates a standardized, coded filename for an attachment using the bond number (رقم السند)
   * Format: [كود_المشروع]_[رقم_السند]_[رقم_الفاتورة].[ext]
   * Example: PRJ-01_EXP-1042_INV-7721.pdf
   */
  generateCodedFileName(params: {
    bondNumber: string;
    projectCode?: string;
    projectName?: string;
    invoiceNumber?: string;
    originalFileName?: string;
    isPdf?: boolean;
    mimeType?: string;
  }): string {
    const bond = this.sanitizeName(params.bondNumber || 'EXP-0000');
    const prj = this.sanitizeName(params.projectName || params.projectCode || 'مشروع');
    const inv = params.invoiceNumber ? `_فاتورة_${this.sanitizeName(params.invoiceNumber)}` : '';
    
    // Determine extension
    let ext = 'jpg';
    if (params.isPdf || params.originalFileName?.toLowerCase().endsWith('.pdf') || params.mimeType?.includes('pdf')) {
      ext = 'pdf';
    } else if (params.originalFileName?.toLowerCase().endsWith('.png') || params.mimeType?.includes('png')) {
      ext = 'png';
    } else if (params.originalFileName?.toLowerCase().endsWith('.webp') || params.mimeType?.includes('webp')) {
      ext = 'webp';
    }

    return `مستند_سند_${bond}_${prj}${inv}.${ext}`;
  },

  /**
   * Gets the dedicated project folder name for storing that project's bonds
   */
  getProjectFolderName(project: { code?: string; name: string; id: string }): string {
    const code = this.sanitizeName(project.code || project.id);
    const name = this.sanitizeName(project.name || 'مشروع');
    return `مجلد_مشروع_${code}_${name}`;
  },

  /**
   * Storage key for this specific project's separate attachments store (legacy key reference)
   */
  getProjectStorageKey(projectId: string): string {
    return `sic_project_attachments_${projectId}`;
  },

  /**
   * Saves or updates a project's separate bond attachments file in high-capacity IndexedDB vault
   */
  saveProjectAttachmentRecord(projectId: string, expense: Expense): void {
    const hasPhoto = Boolean(expense.invoicePhoto && expense.invoicePhoto.trim() !== '');
    const hasAttachments = Boolean(Array.isArray(expense.attachments) && expense.attachments.length > 0);
    if (!projectId || (!hasPhoto && !hasAttachments)) return;
    try {
      const primaryUrl = expense.invoicePhoto || expense.attachments?.[0]?.url || '';
      const isPdf = Boolean(
        primaryUrl.startsWith('data:application/pdf') ||
        primaryUrl.toLowerCase().includes('.pdf') ||
        expense.attachmentFileName?.toLowerCase().endsWith('.pdf') ||
        expense.attachments?.[0]?.fileType === 'pdf'
      );

      const codedName = expense.attachmentFileName || this.generateCodedFileName({
        bondNumber: expense.id,
        projectCode: expense.projectId,
        projectName: expense.projectName,
        invoiceNumber: expense.invoiceNumber,
        isPdf
      });

      const record = {
        expenseId: expense.id,
        bondNumber: expense.id,
        projectId,
        projectName: expense.projectName,
        category: expense.category,
        amount: expense.amount,
        date: expense.date,
        supervisorName: expense.supervisorName,
        invoiceNumber: expense.invoiceNumber,
        fileName: codedName,
        fileType: isPdf ? 'pdf' : 'image',
        dataUrl: primaryUrl,
        attachments: expense.attachments || (primaryUrl ? [{
          id: `att-${Date.now()}`,
          url: primaryUrl,
          fileName: codedName,
          fileType: isPdf ? 'pdf' : 'image'
        }] : []),
        updatedAt: new Date().toISOString()
      };

      // Save to IndexedDB vault asynchronously and update fast memory cache
      IndexedDBVault.setAttachment(expense.id, record);

      // Save attachment content to dedicated Firestore document for server and cross-device access
      if (primaryUrl || (Array.isArray(record.attachments) && record.attachments.length > 0)) {
        FirebaseService.saveExpenseAttachment(expense.id, projectId, {
          dataUrl: primaryUrl,
          attachments: record.attachments,
          fileName: codedName,
          fileType: isPdf ? 'pdf' : 'image'
        }).catch((err) => console.warn('[AttachmentArchiver] Cloud attachment save warning:', err));
      }

      // Clean up any legacy localStorage key to prevent quota overflow
      const legacyKey = this.getProjectStorageKey(projectId);
      try {
        localStorage.removeItem(legacyKey);
      } catch {}

      // Debounced safe cloud sync for project attachments
      FirebaseService.syncProjectAttachmentsDebounced(projectId, {
        [expense.id]: {
          expenseId: expense.id,
          bondNumber: expense.id,
          fileName: codedName,
          fileType: isPdf ? 'pdf' : 'image',
          amount: expense.amount,
          date: expense.date,
          supervisorName: expense.supervisorName,
          invoiceNumber: expense.invoiceNumber,
          hasPhoto: true,
          attachmentsCount: record.attachments.length,
          updatedAt: record.updatedAt
        }
      });
    } catch (e) {
      console.warn('Failed to save project attachment record:', e);
    }
  },

  /**
   * Saves a batch of attachments in one efficient call
   */
  saveBatchProjectAttachments(projectId: string, expenses: Expense[]): void {
    if (!projectId || !expenses || expenses.length === 0) return;
    const records = expenses
      .filter((e) => (e.invoicePhoto && e.invoicePhoto.trim() !== '') || (Array.isArray(e.attachments) && e.attachments.length > 0))
      .map((expense) => {
        const primaryUrl = expense.invoicePhoto || expense.attachments?.[0]?.url || '';
        const isPdf = Boolean(
          primaryUrl.startsWith('data:application/pdf') ||
          primaryUrl.toLowerCase().includes('.pdf') ||
          expense.attachmentFileName?.toLowerCase().endsWith('.pdf') ||
          expense.attachments?.[0]?.fileType === 'pdf'
        );

        const codedName = expense.attachmentFileName || this.generateCodedFileName({
          bondNumber: expense.id,
          projectCode: expense.projectId,
          projectName: expense.projectName,
          invoiceNumber: expense.invoiceNumber,
          isPdf
        });

        return {
          expenseId: expense.id,
          bondNumber: expense.id,
          projectId,
          projectName: expense.projectName,
          category: expense.category,
          amount: expense.amount,
          date: expense.date,
          supervisorName: expense.supervisorName,
          invoiceNumber: expense.invoiceNumber,
          fileName: codedName,
          fileType: isPdf ? 'pdf' : 'image',
          dataUrl: primaryUrl,
          attachments: expense.attachments || (primaryUrl ? [{
            id: `att-${Date.now()}`,
            url: primaryUrl,
            fileName: codedName,
            fileType: isPdf ? 'pdf' : 'image'
          }] : []),
          updatedAt: new Date().toISOString()
        };
      });

    if (records.length > 0) {
      IndexedDBVault.batchSetAttachments(projectId, records);

      // Send metadata sync to cloud debounced
      const metadataMap: Record<string, any> = {};
      records.forEach((r) => {
        metadataMap[r.expenseId] = {
          expenseId: r.expenseId,
          bondNumber: r.bondNumber,
          fileName: r.fileName,
          fileType: r.fileType,
          amount: r.amount,
          date: r.date,
          supervisorName: r.supervisorName,
          hasPhoto: true,
          attachmentsCount: r.attachments?.length || 1,
          updatedAt: r.updatedAt
        };
      });
      FirebaseService.syncProjectAttachmentsDebounced(projectId, metadataMap);

      // Save individual attachments to Firestore dedicated collection
      records.forEach((r) => {
        if (r.dataUrl || (Array.isArray(r.attachments) && r.attachments.length > 0)) {
          FirebaseService.saveExpenseAttachment(r.expenseId, projectId, {
            dataUrl: r.dataUrl,
            attachments: r.attachments,
            fileName: r.fileName,
            fileType: r.fileType
          }).catch(() => {});
        }
      });
    }
  },

  /**
   * Retrieves an attachment for a specific expense from memory or vault
   */
  getAttachmentByExpenseId(projectId: string, expenseId: string): any | null {
    if (!expenseId) return null;
    const memoryItem = IndexedDBVault.getAttachmentSync(expenseId);
    if (memoryItem) return memoryItem;

    if (projectId) {
      const prjItems = IndexedDBVault.getProjectAttachmentsSync(projectId);
      if (prjItems[expenseId]) return prjItems[expenseId];
    }

    return null;
  },

  /**
   * Retrieves all attachments saved in the separate file for a given project
   */
  getProjectAttachments(projectId: string): Record<string, any> {
    if (!projectId) return {};
    return IndexedDBVault.getProjectAttachmentsSync(projectId);
  },

  /**
   * Converts dataUrl (base64) to raw Uint8Array / binary for zip bundling
   */
  dataUrlToBinary(dataUrl: string): Uint8Array | null {
    try {
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return null;
      const base64 = dataUrl.substring(commaIdx + 1);
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.warn('Error converting dataUrl to binary:', e);
      return null;
    }
  },

  /**
   * Generates a dedicated ZIP archive containing all bonds & attachments
   * for a single project, each coded with its bond number and organized in a separate folder.
   */
  async exportProjectBondsZip(
    project: Project,
    projectExpenses: Expense[]
  ): Promise<{ blob: Blob; fileName: string; filesCount: number }> {
    const zip = new JSZip();
    const folderName = this.getProjectFolderName(project);
    const prjFolder = zip.folder(folderName) || zip;
    const bondsFolder = prjFolder.folder('سندات_ومرفقات_المشروع') || prjFolder;

    let filesCount = 0;
    const manifestRows: string[] = [
      `فهرس مرفقات وسندات مشروع: ${project.name} (${project.code || project.id})`,
      `تاريخ تصدير الأرشيف: ${new Date().toLocaleString('ar-SA')}`,
      `إجمالي السندات بالمشروع: ${projectExpenses.length}`,
      '------------------------------------------------------------------------------------------------------------------------',
      'رقم السند | تاريخ السند | البند | المبلغ (ريال) | المشرف | رقم الفاتورة | اسم ملف المرفق المكود',
      '------------------------------------------------------------------------------------------------------------------------'
    ];

    projectExpenses.forEach((exp) => {
      const hasPhoto = Boolean(exp.invoicePhoto && exp.invoicePhoto.trim().length > 0);
      const hasMultipleAttachments = Boolean(Array.isArray(exp.attachments) && exp.attachments.length > 0);
      const isPdf = Boolean(
        (exp.invoicePhoto && (
          exp.invoicePhoto.startsWith('data:application/pdf') ||
          exp.invoicePhoto.toLowerCase().includes('.pdf')
        )) ||
        exp.attachmentFileName?.toLowerCase().endsWith('.pdf') ||
        exp.attachments?.[0]?.fileType === 'pdf'
      );

      const codedName = exp.attachmentFileName || this.generateCodedFileName({
        bondNumber: exp.id,
        projectCode: project.code || project.id,
        projectName: project.name,
        invoiceNumber: exp.invoiceNumber,
        isPdf
      });

      manifestRows.push(
        `${exp.id} | ${exp.date} | ${exp.category} | ${exp.amount.toLocaleString()} | ${exp.supervisorName} | ${exp.invoiceNumber || '-'} | ${hasPhoto || hasMultipleAttachments ? codedName : 'لا يوجد مرفق'}`
      );

      if (hasMultipleAttachments && exp.attachments) {
        exp.attachments.forEach((att, idx) => {
          if (att.url) {
            const bin = this.dataUrlToBinary(att.url);
            if (bin) {
              const fileSuffix = exp.attachments!.length > 1 ? `_مرفق_${idx + 1}` : '';
              const ext = att.fileType === 'pdf' ? '.pdf' : (att.fileName.includes('.') ? att.fileName.slice(att.fileName.lastIndexOf('.')) : '.jpg');
              const attCodedName = att.fileName || `${codedName.replace(/\.[^/.]+$/, '')}${fileSuffix}${ext}`;
              bondsFolder.file(attCodedName, bin);
              filesCount++;
            }
          }
        });
      } else if (hasPhoto && exp.invoicePhoto) {
        const bin = this.dataUrlToBinary(exp.invoicePhoto);
        if (bin) {
          bondsFolder.file(codedName, bin);
          filesCount++;
        }
      }
    });

    // Add manifest text file to the project zip
    prjFolder.file('فهرس_سندات_المشروع.txt', manifestRows.join('\n'));

    const zipFileName = `ارشيف_سندات_${this.sanitizeName(project.code || project.id)}_${this.sanitizeName(project.name)}.zip`;
    const blob = await zip.generateAsync({ type: 'blob' });

    return { blob, fileName: zipFileName, filesCount };
  },

  /**
   * Triggers download of the project's dedicated bonds archive ZIP
   */
  async downloadProjectBondsArchive(
    project: Project,
    projectExpenses: Expense[]
  ): Promise<{ success: boolean; filesCount: number; fileName: string; downloadUrl: string }> {
    const { blob, fileName, filesCount } = await this.exportProjectBondsZip(project, projectExpenses);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { success: true, filesCount, fileName, downloadUrl: url };
  },

  /**
   * Generates and downloads a unified ZIP package containing all attachments
   * for a batch of expenses (before archiving expenses or completed projects).
   * Each attachment inside the ZIP is strictly named after the document/bond.
   */
  async downloadBatchExpensesAttachmentsZip(
    expenses: Expense[],
    archiveTitle: string = 'مرفقات_المصروفات_والمشاريع'
  ): Promise<{ success: boolean; filesCount: number; fileName: string; downloadUrl: string }> {
    const zip = new JSZip();
    const safeTitle = this.sanitizeName(archiveTitle);
    const mainFolder = zip.folder(`مستندات_${safeTitle}`) || zip;

    let filesCount = 0;
    const manifestRows: string[] = [
      `فهرس مرفقات ومستندات الأرشيف: ${archiveTitle}`,
      `تاريخ تصدير الملفات: ${new Date().toLocaleString('ar-SA')}`,
      `إجمالي السندات: ${expenses.length}`,
      '------------------------------------------------------------------------------------------------------------------------',
      'رقم السند | اسم المشروع | تاريخ السند | المبلغ (ريال) | المشرف | رقم الفاتورة | اسم ملف المرفق بعد التنزيل',
      '------------------------------------------------------------------------------------------------------------------------'
    ];

    expenses.forEach((exp) => {
      const hasPhoto = Boolean(exp.invoicePhoto && exp.invoicePhoto.trim().length > 0);
      const isPdf = Boolean(
        exp.invoicePhoto && (
          exp.invoicePhoto.startsWith('data:application/pdf') ||
          exp.invoicePhoto.toLowerCase().includes('.pdf') ||
          exp.attachmentFileName?.toLowerCase().endsWith('.pdf')
        )
      );

      const codedName = this.generateCodedFileName({
        bondNumber: exp.id,
        projectCode: exp.projectId,
        projectName: exp.projectName,
        invoiceNumber: exp.invoiceNumber,
        originalFileName: exp.attachmentFileName,
        isPdf
      });

      manifestRows.push(
        `${exp.id} | ${exp.projectName} | ${exp.date} | ${exp.amount.toLocaleString()} | ${exp.supervisorName} | ${exp.invoiceNumber || '-'} | ${hasPhoto ? codedName : 'لا يوجد مرفق'}`
      );

      if (hasPhoto && exp.invoicePhoto) {
        const bin = this.dataUrlToBinary(exp.invoicePhoto);
        if (bin) {
          mainFolder.file(codedName, bin);
          filesCount++;
        }
      }
    });

    // Add manifest index text file
    mainFolder.file('فهرس_المستندات_والمرفقات.txt', manifestRows.join('\n'));

    const zipFileName = `مرفقات_مستندات_${safeTitle}_${new Date().toISOString().slice(0, 10)}.zip`;
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = zipFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return {
      success: true,
      filesCount,
      fileName: zipFileName,
      downloadUrl: url
    };
  },

  /**
   * Downloads a single expense attachment directly, strictly named after the document
   */
  downloadSingleDocumentAttachment(exp: Expense): boolean {
    if (!exp.invoicePhoto) return false;
    try {
      const isPdf = Boolean(
        exp.invoicePhoto.startsWith('data:application/pdf') ||
        exp.invoicePhoto.toLowerCase().includes('.pdf') ||
        exp.attachmentFileName?.toLowerCase().endsWith('.pdf')
      );
      const codedName = this.generateCodedFileName({
        bondNumber: exp.id,
        projectCode: exp.projectId,
        projectName: exp.projectName,
        invoiceNumber: exp.invoiceNumber,
        originalFileName: exp.attachmentFileName,
        isPdf
      });

      const a = document.createElement('a');
      a.href = exp.invoicePhoto;
      a.download = codedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch {
      window.open(exp.invoicePhoto, '_blank');
      return true;
    }
  }
};

import { PCloudFolderResult, PCloudItem, ExpenseAttachment } from '../types';

export const PCloudService = {
  /**
   * Extracts the public code from any pCloud public link or string
   */
  extractCode(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const urlObj = new URL(trimmed);
        const codeParam = urlObj.searchParams.get('code');
        if (codeParam) return codeParam.trim();

        // Check hash parameter (e.g. #/puplink?code=... or #page=file_request&code=...)
        if (urlObj.hash) {
          const hashMatch = urlObj.hash.match(/[#&?]code=([a-zA-Z0-9_-]+)/i);
          if (hashMatch) return hashMatch[1].trim();
        }

        // Check pathname segments (e.g. https://filein.pcloud.com/kXZabc or https://u.pcloud.link/publink/show?code=...)
        const segments = urlObj.pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
          const lastSeg = segments[segments.length - 1];
          if (lastSeg !== 'show' && lastSeg !== 'upload' && lastSeg !== 'publink' && lastSeg !== 'puplink' && lastSeg.length >= 6) {
            return lastSeg.trim();
          }
        }
      }
    } catch {}
    const match = trimmed.match(/[?&#]code=([a-zA-Z0-9_-]+)/i);
    if (match) return match[1].trim();
    return trimmed;
  },

  /**
   * Direct Browser check for a pCloud Upload Link (File Request / طلب ملفات)
   */
  async testUploadLinkDirect(link: string): Promise<{
    success: boolean;
    isUploadLink?: boolean;
    isPubLink?: boolean;
    folderName?: string;
    region?: 'us' | 'eu';
    message?: string;
    error?: string;
  }> {
    const code = this.extractCode(link);
    if (!code) {
      return { success: false, error: 'الرابط لا يحتوي على كود pCloud صالح' };
    }

    // 1. Try showuploadlink across US & EU
    for (const reg of ['us', 'eu'] as const) {
      const baseApi = reg === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
      try {
        const res = await fetch(`${baseApi}/showuploadlink?code=${encodeURIComponent(code)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.result === 0) {
            const folderName = json.name || json.mail || 'مجلد pCloud (طلب ملفات)';
            return {
              success: true,
              isUploadLink: true,
              isPubLink: false,
              folderName,
              region: reg,
              message: `تم التحقق بنجاح! الرابط صالح لطلب الملفات (Request files) في مجلد: ${folderName}`
            };
          }
        }
      } catch (err) {
        console.warn(`[PCloud Direct] showuploadlink on ${reg} failed:`, err);
      }
    }

    // 2. Check if it's a PubLink (Read-only share link)
    for (const reg of ['us', 'eu'] as const) {
      const baseApi = reg === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
      try {
        const res = await fetch(`${baseApi}/showpublink?code=${encodeURIComponent(code)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.result === 0 && json.metadata) {
            const meta = json.metadata;
            return {
              success: true,
              isUploadLink: false,
              isPubLink: true,
              folderName: meta.name || 'مجلد مشاركة',
              region: reg,
              message: `هذا الرابط هو رابط مشاركة وتنزيل فقط (Share link) لمجلد "${meta.name}". pCloud يمنع الرفع عبر روابط المشاركة لحماية المجلد. يرجى اختيار "Request files (طلب ملفات)" بدلاً من Share link.`
            };
          }
        }
      } catch (err) {
        console.warn(`[PCloud Direct] showpublink on ${reg} failed:`, err);
      }
    }

    return {
      success: false,
      error: 'تعذر التحقق من رابط pCloud. يرجى التأكد من أن الرابط هو رابط طلب ملفات (Request files / File Request) سارٍ.'
    };
  },

  /**
   * Directly upload a file blob to pCloud File Request upload link from browser
   */
  async uploadFileToLinkDirect(
    code: string,
    fileName: string,
    blob: Blob
  ): Promise<{ success: boolean; data?: any; region?: 'us' | 'eu'; error?: string }> {
    const cleanCode = this.extractCode(code);
    if (!cleanCode) return { success: false, error: 'كود pCloud غير صالح' };

    for (const reg of ['us', 'eu'] as const) {
      const baseApi = reg === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
      try {
        const formData = new FormData();
        formData.append('file', blob, fileName);
        formData.append('names', 'SIC_Auto_Backup');

        const res = await fetch(`${baseApi}/uploadtolink?code=${encodeURIComponent(cleanCode)}&names=SIC_Auto_Backup`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const json = await res.json();
          if (json.result === 0) {
            return { success: true, data: json, region: reg };
          }
        }
      } catch (err) {
        console.warn(`[PCloud Direct Upload] ${reg} upload error:`, err);
      }
    }

    return { success: false, error: 'فشل رفع الملف إلى مجلد pCloud مباشرة من المتصفح.' };
  },

  /**
   * Lists the contents of a pCloud public folder (files, images, documents, subfolders)
   */
  async listFolder(linkOrCode: string, folderId?: number | string): Promise<PCloudFolderResult> {
    const code = this.extractCode(linkOrCode);
    if (!code) {
      return {
        success: false,
        code: '',
        region: 'us',
        folderName: '',
        folderId: 0,
        currentPath: '',
        items: [],
        subfolders: [],
        files: [],
        totalFiles: 0,
        totalImages: 0,
        totalPdfs: 0,
        error: 'يرجى إدخال رابط أو كود مجلد pCloud صالح'
      };
    }

    // 1. Try fetching through server endpoint (handles proxying, US/EU failover, thumbs)
    try {
      const response = await fetch('/api/pcloud/list-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, link: linkOrCode, folderId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return data;
        }
      }
    } catch (err) {
      console.warn('[PCloudService] Server list-folder call failed, trying direct browser fetch fallback:', err);
    }

    // 2. Direct browser fallback using pCloud Public API
    try {
      const folderParam = folderId ? `&folderid=${folderId}` : '';
      let res = await fetch(`https://api.pcloud.com/showpublink?code=${encodeURIComponent(code)}${folderParam}`);
      let region: 'us' | 'eu' = 'us';
      
      if (!res.ok) {
        res = await fetch(`https://eapi.pcloud.com/showpublink?code=${encodeURIComponent(code)}${folderParam}`);
        region = 'eu';
      }

      const json = await res.json();
      if (json.result === 0 && json.metadata) {
        const meta = json.metadata;
        const baseApi = region === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
        const rawContents: any[] = meta.contents || [];

        const items: PCloudItem[] = rawContents.map((item: any) => {
          const isFolder = Boolean(item.isfolder);
          const isImage = !isFolder && ((item.contenttype && item.contenttype.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif|bmp|heic|svg)$/i.test(item.name));
          const isPdf = !isFolder && (item.contenttype === 'application/pdf' || /\.pdf$/i.test(item.name));

          const thumbUrl = !isFolder && isImage
            ? `${baseApi}/getpubthumb?code=${encodeURIComponent(code)}&fileid=${item.fileid}&size=320x320`
            : undefined;

          const downloadUrl = !isFolder
            ? `/api/pcloud/file-proxy?code=${encodeURIComponent(code)}&fileid=${item.fileid}&region=${region}&filename=${encodeURIComponent(item.name)}`
            : undefined;

          return {
            id: isFolder ? `folder-${item.folderid}` : `file-${item.fileid}`,
            name: item.name,
            isFolder,
            folderId: isFolder ? item.folderid : undefined,
            fileId: !isFolder ? item.fileid : undefined,
            size: item.size || 0,
            contentType: item.contenttype || (isPdf ? 'application/pdf' : isImage ? 'image/jpeg' : 'application/octet-stream'),
            isImage,
            isPdf,
            thumbUrl,
            downloadUrl,
            modified: item.modified,
            created: item.created,
            parentFolderId: meta.folderid
          };
        });

        const subfolders = items.filter(it => it.isFolder);
        const files = items.filter(it => !it.isFolder);

        return {
          success: true,
          code,
          region,
          folderName: meta.name || 'مجلد pCloud المشترك',
          folderId: meta.folderid || 0,
          currentPath: meta.name || '',
          items,
          subfolders,
          files,
          totalFiles: files.length,
          totalImages: files.filter(f => f.isImage).length,
          totalPdfs: files.filter(f => f.isPdf).length
        };
      } else {
        return {
          success: false,
          code,
          region: 'us',
          folderName: '',
          folderId: 0,
          currentPath: '',
          items: [],
          subfolders: [],
          files: [],
          totalFiles: 0,
          totalImages: 0,
          totalPdfs: 0,
          error: json.error || 'تعذر قراءة المجلد من pCloud'
        };
      }
    } catch (fallbackErr: any) {
      return {
        success: false,
        code,
        region: 'us',
        folderName: '',
        folderId: 0,
        currentPath: '',
        items: [],
        subfolders: [],
        files: [],
        totalFiles: 0,
        totalImages: 0,
        totalPdfs: 0,
        error: fallbackErr?.message || 'تعذر الاتصال بـ pCloud. يرجى التحقق من اتصال الإنترنت وصلاحية الرابط.'
      };
    }
  },

  /**
   * Tests and validates that a public folder link is working and accessible
   */
  async testLink(link: string): Promise<{
    success: boolean;
    folderName?: string;
    totalFiles?: number;
    totalImages?: number;
    totalPdfs?: number;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/pcloud/test-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      // Fallback to listFolder directly
      const result = await this.listFolder(link);
      if (result.success) {
        return {
          success: true,
          folderName: result.folderName,
          totalFiles: result.totalFiles,
          totalImages: result.totalImages,
          totalPdfs: result.totalPdfs,
          message: `تم التحقق بنجاح! المجلد "${result.folderName}" يحتوي على ${result.totalFiles} ملف (${result.totalImages} صورة).`
        };
      }
      return {
        success: false,
        error: result.error || 'تعذر فحص رابط pCloud'
      };
    }
  },

  /**
   * Converts a pCloud file into a data URL for offline caching & local storage
   */
  async convertToDataUrl(item: PCloudItem, code: string, region: 'us' | 'eu' = 'us'): Promise<string> {
    try {
      const res = await fetch('/api/pcloud/download-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          fileId: item.fileId,
          region,
          downloadUrl: item.downloadUrl,
          fileName: item.name
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.dataUrl) {
          return json.dataUrl;
        }
      }
    } catch (err) {
      console.warn('[PCloudService] Server base64 conversion failed, falling back to direct stream:', err);
    }

    // Fallback: return the direct download/proxy URL
    return item.downloadUrl || item.thumbUrl || '';
  },

  /**
   * Creates an ExpenseAttachment object from a selected PCloudItem
   * Stored directly as a lightweight URL link for instant preview and access
   */
  async createAttachmentFromPCloudItem(
    item: PCloudItem,
    code: string,
    region: 'us' | 'eu' = 'us'
  ): Promise<ExpenseAttachment> {
    const fileType: 'pdf' | 'image' = item.isPdf ? 'pdf' : 'image';
    
    // Direct stream proxy URL / link
    const proxyUrl = `/api/pcloud/file-proxy?code=${encodeURIComponent(code)}&fileid=${item.fileId}&region=${region}&filename=${encodeURIComponent(item.name)}`;
    const thumbUrl = item.thumbUrl || `/api/pcloud/file-proxy?code=${encodeURIComponent(code)}&fileid=${item.fileId}&region=${region}&size=320x320&filename=${encodeURIComponent(item.name)}`;
    const directWebUrl = `https://u.pcloud.link/publink/show?code=${encodeURIComponent(code)}${item.fileId ? `&fileid=${item.fileId}` : ''}`;

    return {
      id: `pcloud-${item.fileId || Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      url: proxyUrl,
      fileName: item.name,
      fileType,
      fileSize: item.size,
      uploadedAt: new Date().toISOString(),
      source: 'pcloud',
      pcloudFileId: item.fileId,
      pcloudPublicCode: code,
      pcloudDownloadUrl: proxyUrl,
      pcloudThumbUrl: thumbUrl,
      pcloudWebUrl: directWebUrl
    };
  }
};

/**
 * Google Drive Cloud Storage Integration Service with Auto-Refresh Token Support
 * Uploads expense attachments and invoices directly to Google Drive and generates direct public share links (https://drive.google.com/...)
 */

export interface GoogleDriveUploadResult {
  success: boolean;
  url?: string;
  fileId?: string;
  error?: string;
}

export interface GoogleDriveSettingsInput {
  googleDriveAccessToken?: string;
  googleDriveRefreshToken?: string;
  googleDriveClientId?: string;
  googleDriveClientSecret?: string;
}

export const GoogleDriveService = {
  /**
   * Obtains a valid access token. If Refresh Token, Client ID, and Client Secret are available,
   * it automatically requests a fresh Access Token from Google OAuth endpoint.
   * Falls back to manual Access Token if provided.
   */
  async getValidAccessToken(settings: GoogleDriveSettingsInput): Promise<{ success?: boolean; accessToken?: string; error?: string }> {
    const { googleDriveAccessToken, googleDriveRefreshToken, googleDriveClientId, googleDriveClientSecret } = settings;

    // 1. Try refreshing token if credentials are provided
    if (googleDriveRefreshToken && googleDriveRefreshToken.trim() &&
        googleDriveClientId && googleDriveClientId.trim() &&
        googleDriveClientSecret && googleDriveClientSecret.trim()) {
      try {
        const params = new URLSearchParams();
        params.append('client_id', googleDriveClientId.trim());
        params.append('client_secret', googleDriveClientSecret.trim());
        params.append('refresh_token', googleDriveRefreshToken.trim());
        params.append('grant_type', 'refresh_token');

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });

        const tokenJson = await tokenRes.json();
        if (tokenRes.ok && tokenJson.access_token) {
          return { success: true, accessToken: tokenJson.access_token };
        } else {
          console.warn('Auto-refresh token failed, falling back to manual access token:', tokenJson);
        }
      } catch (err) {
        console.warn('Exception during Google Drive token auto-refresh:', err);
      }
    }

    // 2. Fall back to manual Access Token
    if (googleDriveAccessToken && googleDriveAccessToken.trim()) {
      return { success: true, accessToken: googleDriveAccessToken.trim() };
    }

    return { success: false, error: 'لم يتم العثور على رمز وصول أو بيانات اعتماد صالحة لجوجل دريف. يرجى إدخال Refresh Token مع Client ID و Client Secret أو Access Token يدوي.' };
  },

  /**
   * Uploads a base64 file or data URL to Google Drive and returns a public web view link.
   */
  async uploadFile(
    dataUrl: string,
    fileName: string,
    settings: GoogleDriveSettingsInput,
    folderId?: string
  ): Promise<GoogleDriveUploadResult> {
    const tokenResult = await this.getValidAccessToken(settings);
    if (!tokenResult.success || !tokenResult.accessToken) {
      return { success: false, error: tokenResult.error || 'رمز وصول Google Drive غير متوفر أو غير صالح' };
    }
    let accessToken = tokenResult.accessToken;

    try {
      // 1. Convert base64 data URL to Blob
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1] || arr[0]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });

      // 2. Prepare metadata and multipart upload to Google Drive v3 API
      const metadata: any = {
        name: fileName || `invoice_${Date.now()}.png`
      };
      if (folderId && folderId.trim()) {
        metadata.parents = [folderId.trim()];
      }

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      let uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: form
        }
      );

      let uploadJson = await uploadRes.json();

      // If unauthorized (401) due to expired access token, automatically refresh and retry once
      if (uploadRes.status === 401 && settings.googleDriveRefreshToken && settings.googleDriveClientId && settings.googleDriveClientSecret) {
        console.warn('Google Drive Access Token expired (401), automatically refreshing token and retrying upload...');
        const freshTokenResult = await this.getValidAccessToken({
          ...settings,
          googleDriveAccessToken: undefined
        });
        if (freshTokenResult.success && freshTokenResult.accessToken) {
          const newAccessToken = freshTokenResult.accessToken;
          const retryForm = new FormData();
          retryForm.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          retryForm.append('file', blob);

          uploadRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${newAccessToken}`
              },
              body: retryForm
            }
          );
          uploadJson = await uploadRes.json();
          accessToken = newAccessToken;
        }
      }

      if (!uploadRes.ok || !uploadJson.id) {
        return {
          success: false,
          error: uploadJson?.error?.message || 'فشل رفع الملف إلى Google Drive (تحقق من صلاحيات الرمز أو بيانات الاعتماد)'
        };
      }

      const fileId = uploadJson.id;
      let webViewLink = uploadJson.webViewLink || uploadJson.webContentLink;

      // 3. Make file public so it's accessible across all devices/accounts
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
          })
        });
      } catch (permErr) {
        console.warn('Could not set public permission on Google Drive file:', permErr);
      }

      if (!webViewLink) {
        try {
          const detailRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,webContentLink`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            }
          );
          const detailJson = await detailRes.json();
          webViewLink = detailJson.webViewLink || detailJson.webContentLink;
        } catch {}
      }

      if (!webViewLink) {
        webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
      }

      return {
        success: true,
        url: webViewLink,
        fileId
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'حدث خطأ غير متوقع أثناء الرفع إلى Google Drive' };
    }
  },

  /**
   * Test connection and token validity with Google Drive (with auto-refresh support)
   */
  async testConnection(settings: GoogleDriveSettingsInput): Promise<{ success: boolean; message: string; userInfo?: any }> {
    const tokenResult = await this.getValidAccessToken(settings);
    if (!tokenResult.success || !tokenResult.accessToken) {
      return { success: false, message: tokenResult.error || 'الرجاء إدخال بيانات اعتماد صالحة لجوجل دريف' };
    }
    const accessToken = tokenResult.accessToken;

    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const json = await res.json();
      if (res.ok && json.user) {
        return {
          success: true,
          message: `تم الاتصال بنجاح بـ Google Drive (حساب المستخدم: ${json.user.displayName || json.user.emailAddress || 'نشط'} - تم التجديد التلقائي بنجاح)`,
          userInfo: json
        };
      } else {
        return { success: false, message: json?.error?.message || 'رمز الوصول (Access Token) أو Refresh Token غير صالح' };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'تعذر الاتصال بخوادم Google Drive' };
    }
  }
};

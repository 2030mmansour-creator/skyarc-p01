/**
 * WhatsApp Integration Service for Custody Top-Up & Disbursal Notifications
 * نظام الربط مع واتساب لطلبات تعزيز العهد وإشعارات تسليم الدفعات الفورية
 */

export interface CustodyTopUpParams {
  supervisorName: string;
  remainingBalance: number;
  pendingExpenses?: number;
  approvedBalance?: number;
  projects?: string;
  currencySymbol?: string;
  customNote?: string;
  managerPhone?: string;
}

export interface CustodyDisbursedParams {
  custodyId: string;
  supervisorName: string;
  supervisorPhone?: string;
  amount: number;
  paymentMethod: string;
  receiptNumber?: string;
  bankName?: string;
  projectName?: string;
  date: string;
  issuedByName?: string;
  currencySymbol?: string;
  notes?: string;
}

export class WhatsAppService {
  /**
   * Sanitizes and cleans a phone number for WhatsApp wa.me link
   * Handles local Saudi numbers (e.g. 0501234567 -> 966501234567)
   */
  static cleanPhoneNumber(phone?: string): string {
    if (!phone) return '';
    // Strip everything except digits
    let digits = phone.replace(/\D/g, '');

    // If starts with 00, strip the 00 prefix
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }

    // If it's a Saudi local number starting with 05 (10 digits) -> convert to 9665...
    if (digits.startsWith('05') && digits.length === 10) {
      digits = '966' + digits.slice(1);
    } else if (digits.startsWith('5') && digits.length === 9) {
      digits = '966' + digits;
    }

    return digits;
  }

  /**
   * Generates a wa.me or api.whatsapp.com URL with prefilled text
   */
  static generateWhatsAppUrl(phone?: string, text?: string): string {
    const cleanPhone = this.cleanPhoneNumber(phone);
    const encoded = encodeURIComponent(text || '');

    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encoded}`;
    }
    return `https://api.whatsapp.com/send?text=${encoded}`;
  }

  /**
   * Directly opens WhatsApp in a new tab or app window
   */
  static openWhatsApp(phone?: string, text?: string): Window | null {
    const url = this.generateWhatsAppUrl(phone, text);
    return window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Generates structured text for supervisor's Custody Top-Up Request to manager
   */
  static formatTopUpMessage(params: CustodyTopUpParams): string {
    const sym = params.currencySymbol || 'ر.س';
    const lines = [
      'السلام عليكم ورحمة الله وبركاته،',
      '📌 *طلب تعزيز عهدة مالية عاجلة*',
      '─────────────────────',
      `👤 *المشرف الميداني:* ${params.supervisorName}`,
      `💰 *الرصيد الفعلي المتبقي في الميدان:* ${params.remainingBalance.toLocaleString()} ${sym}`,
    ];

    if (params.pendingExpenses !== undefined && params.pendingExpenses > 0) {
      lines.push(`⏳ *المصروفات المسجلة قيد التدقيق:* ${params.pendingExpenses.toLocaleString()} ${sym}`);
    }

    if (params.approvedBalance !== undefined) {
      lines.push(`📑 *الرصيد الدفتري المعتمد:* ${params.approvedBalance.toLocaleString()} ${sym}`);
    }

    if (params.projects) {
      lines.push(`🏢 *المشاريع:* ${params.projects}`);
    }

    lines.push(`📅 *تاريخ ووقت الطلب:* ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`);

    if (params.customNote) {
      lines.push(`📝 *ملاحظات إضافية:* ${params.customNote}`);
    }

    lines.push('─────────────────────');
    lines.push('نأمل التكرم باعتماد دفعة عهدة جديدة لمواصلة الأعمال الميدانية وتغطية النفقات دون انقطاع.');

    return lines.join('\n');
  }

  /**
   * Generates structured text for instant Custody Disbursal Notice to supervisor
   */
  static formatCustodyDisbursedMessage(params: CustodyDisbursedParams): string {
    const sym = params.currencySymbol || 'ر.س';
    const lines = [
      `السلام عليكم م. ${params.supervisorName}،`,
      '🎉 *إشعار اعتماد وتسليم دفعة عهدة مالية جديدة*',
      '─────────────────────',
      'تم تسليم دفعة عهدة نقدية جديدة لحسابكم بالتفاصيل التالية:',
      `💵 *المبلغ المسلم:* ${params.amount.toLocaleString()} ${sym}`,
      `🔖 *رقم سند العهدة:* ${params.custodyId}`,
      `💳 *طريقة التسليم:* ${params.paymentMethod}`,
    ];

    if (params.bankName) {
      lines.push(`🏦 *البنك المحول منه/إليه:* ${params.bankName}`);
    }

    if (params.receiptNumber) {
      lines.push(`🧾 *رقم الحوالة / الإيصال:* ${params.receiptNumber}`);
    }

    if (params.projectName) {
      lines.push(`🏢 *المشروع المخصص:* ${params.projectName}`);
    } else {
      lines.push('🏢 *التخصيص:* عهدة عامة تشغيلية للمشاريع');
    }

    lines.push(`📅 *تاريخ التسليم:* ${params.date}`);

    if (params.issuedByName) {
      lines.push(`✍️ *سُلمت بواسطة:* ${params.issuedByName}`);
    }

    if (params.notes) {
      lines.push(`📝 *ملاحظات:* ${params.notes}`);
    }

    lines.push('─────────────────────');
    lines.push('يرجى الاطلاع وتأكيد الاستلام ومطابقة الرصيد الميداني في منظومة العهد والمصروفات.');

    return lines.join('\n');
  }

  /**
   * Helper to send top-up request to manager via WhatsApp
   */
  static sendCustodyTopUpRequest(params: CustodyTopUpParams): void {
    const text = this.formatTopUpMessage(params);
    this.openWhatsApp(params.managerPhone, text);
  }

  /**
   * Helper to send instant disbursal notice to supervisor via WhatsApp
   */
  static sendCustodyDisbursedNotice(params: CustodyDisbursedParams): void {
    const text = this.formatCustodyDisbursedMessage(params);
    this.openWhatsApp(params.supervisorPhone, text);
  }
}

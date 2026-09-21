/**
 * Helper utility to generate realistic, offline-safe invoice document images (data URIs)
 * for testing and demonstration of the AI Invoice OCR Scanner & Expense forms.
 */

export interface SampleInvoiceInfo {
  dataUrl: string;
  merchantName: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  netAmount: number;
  taxAmount: number;
  hasTax: boolean;
  taxNumber: string;
  suggestedCategory: string;
  description: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
}

export function generateSampleInvoice(type: 'materials' | 'fuel' | 'electrical' = 'materials'): SampleInvoiceInfo {
  const today = new Date().toISOString().split('T')[0];

  if (type === 'fuel') {
    const net = 400.00;
    const vat = 60.00;
    const total = 460.00;
    const invNum = 'DSL-77391';
    const taxNum = '310928471600003';
    const merchant = 'شركة محطات الوقود المتحدة (نفط)';
    const desc = 'تعبئة وقود ديزل 91 للمعدات الثقيلة والشاحنات في موقع المشروع';
    const items = [
      { name: 'وقود ديزل شاحنات ومولدات', quantity: 200, unitPrice: 2.00, total: 400 },
    ];

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="950" viewBox="0 0 700 950" style="background:#fff;font-family:sans-serif;direction:rtl;">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <rect x="25" y="25" width="650" height="900" rx="16" fill="#fdfdfe" stroke="#e2e8f0" stroke-width="3"/>
  <rect x="25" y="25" width="650" height="130" rx="16" fill="#059669"/>
  <text x="350" y="75" fill="#ffffff" font-size="24" font-weight="bold" text-anchor="middle">فاتورة ضريبية مبسطة (سند استلام وقود)</text>
  <text x="350" y="110" fill="#a7f3d0" font-size="16" text-anchor="middle">${merchant}</text>
  <text x="350" y="135" fill="#ffffff" font-size="12" text-anchor="middle">الرقم الضريبي: ${taxNum}</text>

  <!-- Meta Info -->
  <g transform="translate(50, 180)" font-size="14" fill="#334155">
    <text x="600" y="20" font-weight="bold">رقم الفاتورة: <tspan font-family="monospace" fill="#0f172a">${invNum}</tspan></text>
    <text x="600" y="50" font-weight="bold">تاريخ السند: <tspan font-family="monospace">${today}</tspan></text>
    <text x="600" y="80">طريقة الدفع: <tspan font-weight="bold">نقد / عهدة المشرف</tspan></text>
    <text x="600" y="110">المشروع المستلم: مشروع الإنشاءات الميداني</text>
  </g>

  <!-- Items Table Header -->
  <rect x="50" y="320" width="600" height="40" fill="#f1f5f9" rx="8"/>
  <text x="620" y="345" font-size="13" font-weight="bold" fill="#475569">الصنف / البيان</text>
  <text x="350" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">الكمية</text>
  <text x="220" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">سعر اللتر</text>
  <text x="90" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">الإجمالي (ر.س)</text>

  <!-- Row 1 -->
  <line x1="50" y1="410" x2="650" y2="410" stroke="#e2e8f0"/>
  <text x="620" y="390" font-size="13" font-weight="bold" fill="#1e293b">تعبئة وقود ديزل للشاحنات والمولدات</text>
  <text x="350" y="390" font-size="13" fill="#334155" text-anchor="middle">200 لتر</text>
  <text x="220" y="390" font-size="13" fill="#334155" text-anchor="middle">2.00</text>
  <text x="90" y="390" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">400.00</text>

  <!-- Totals Box -->
  <rect x="50" y="550" width="600" height="180" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="620" y="590" font-size="14" fill="#64748b">المجموع الخاضع للضريبة (قبل الضريبة):</text>
  <text x="90" y="590" font-size="15" font-weight="bold" fill="#334155" text-anchor="middle">400.00 ر.س</text>

  <text x="620" y="630" font-size="14" fill="#64748b">ضريبة القيمة المضافة (15% VAT):</text>
  <text x="90" y="630" font-size="15" font-weight="bold" fill="#059669" text-anchor="middle">60.00 ر.س</text>

  <line x1="60" y1="655" x2="640" y2="655" stroke="#cbd5e1" stroke-dasharray="4"/>
  <text x="620" y="695" font-size="17" font-weight="bold" fill="#0f172a">المبلغ الإجمالي شامل الضريبة:</text>
  <text x="90" y="695" font-size="20" font-weight="black" fill="#059669" text-anchor="middle">460.00 ر.س</text>

  <!-- Stamp & Verification QR -->
  <g transform="translate(100, 760)">
    <rect width="130" height="130" fill="#ffffff" stroke="#94a3b8" rx="8"/>
    <text x="65" y="70" font-size="11" fill="#64748b" text-anchor="middle">رمز الفاتورة ZATCA QR</text>
    <rect x="20" y="20" width="90" height="90" fill="none" stroke="#059669" stroke-width="2" stroke-dasharray="6,4"/>
  </g>
  <g transform="translate(420, 790)">
    <circle cx="60" cy="50" r="50" fill="none" stroke="#059669" stroke-width="3" stroke-dasharray="5,3"/>
    <text x="60" y="45" font-size="11" font-weight="bold" fill="#059669" text-anchor="middle">ختم المحطة المعتمد</text>
    <text x="60" y="65" font-size="10" fill="#059669" text-anchor="middle">تم السداد نقداً</text>
  </g>
</svg>
`.trim();

    return {
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      merchantName: merchant,
      invoiceNumber: invNum,
      date: today,
      totalAmount: total,
      netAmount: net,
      taxAmount: vat,
      hasTax: true,
      taxNumber: taxNum,
      suggestedCategory: 'نقل ومحروقات',
      description: desc,
      items,
    };
  }

  if (type === 'electrical') {
    const net = 2000.00;
    const vat = 300.00;
    const total = 2300.00;
    const invNum = 'ELC-84920';
    const taxNum = '300481928400003';
    const merchant = 'شركة الفنار للتوريدات الكهربائية';
    const desc = 'شراء كابلات تمديد كهربائي نحاس وقواطع أوتوماتيكية للوحة التوزيع';
    const items = [
      { name: 'كابلات نحاسية معزولة 16 ملم', quantity: 1, unitPrice: 1200, total: 1200 },
      { name: 'قواطع تيار رئيسية وفرعية شنايدر', quantity: 4, unitPrice: 200, total: 800 },
    ];

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="950" viewBox="0 0 700 950" style="background:#fff;font-family:sans-serif;direction:rtl;">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <rect x="25" y="25" width="650" height="900" rx="16" fill="#fdfdfe" stroke="#e2e8f0" stroke-width="3"/>
  <rect x="25" y="25" width="650" height="130" rx="16" fill="#2563eb"/>
  <text x="350" y="75" fill="#ffffff" font-size="24" font-weight="bold" text-anchor="middle">فاتورة ضريبية إلكترونية معتمدة</text>
  <text x="350" y="110" fill="#bfdbfe" font-size="16" text-anchor="middle">${merchant}</text>
  <text x="350" y="135" fill="#ffffff" font-size="12" text-anchor="middle">الرقم الضريبي: ${taxNum}</text>

  <!-- Meta Info -->
  <g transform="translate(50, 180)" font-size="14" fill="#334155">
    <text x="600" y="20" font-weight="bold">رقم الفاتورة: <tspan font-family="monospace" fill="#0f172a">${invNum}</tspan></text>
    <text x="600" y="50" font-weight="bold">تاريخ الفاتورة: <tspan font-family="monospace">${today}</tspan></text>
    <text x="600" y="80">طريقة الدفع: <tspan font-weight="bold">شبكة / مدى</tspan></text>
    <text x="600" y="110">المشروع: مشروع الأبراج والتشييد</text>
  </g>

  <!-- Items Table Header -->
  <rect x="50" y="320" width="600" height="40" fill="#f1f5f9" rx="8"/>
  <text x="620" y="345" font-size="13" font-weight="bold" fill="#475569">الصنف / البيان</text>
  <text x="350" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">الكمية</text>
  <text x="220" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">سعر الوحدة</text>
  <text x="90" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">الإجمالي (ر.س)</text>

  <!-- Row 1 -->
  <line x1="50" y1="410" x2="650" y2="410" stroke="#e2e8f0"/>
  <text x="620" y="390" font-size="13" font-weight="bold" fill="#1e293b">كابلات نحاسية معزولة 16 ملم</text>
  <text x="350" y="390" font-size="13" fill="#334155" text-anchor="middle">1 لفة</text>
  <text x="220" y="390" font-size="13" fill="#334155" text-anchor="middle">1,200.00</text>
  <text x="90" y="390" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">1,200.00</text>

  <!-- Row 2 -->
  <line x1="50" y1="470" x2="650" y2="470" stroke="#e2e8f0"/>
  <text x="620" y="445" font-size="13" font-weight="bold" fill="#1e293b">قواطع تيار رئيسية وفرعية شنايدر</text>
  <text x="350" y="445" font-size="13" fill="#334155" text-anchor="middle">4 حبات</text>
  <text x="220" y="445" font-size="13" fill="#334155" text-anchor="middle">200.00</text>
  <text x="90" y="445" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">800.00</text>

  <!-- Totals Box -->
  <rect x="50" y="550" width="600" height="180" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="620" y="590" font-size="14" fill="#64748b">المجموع الخاضع للضريبة:</text>
  <text x="90" y="590" font-size="15" font-weight="bold" fill="#334155" text-anchor="middle">2,000.00 ر.س</text>

  <text x="620" y="630" font-size="14" fill="#64748b">ضريبة القيمة المضافة (15% VAT):</text>
  <text x="90" y="630" font-size="15" font-weight="bold" fill="#2563eb" text-anchor="middle">300.00 ر.س</text>

  <line x1="60" y1="655" x2="640" y2="655" stroke="#cbd5e1" stroke-dasharray="4"/>
  <text x="620" y="695" font-size="17" font-weight="bold" fill="#0f172a">المبلغ الإجمالي المستحق:</text>
  <text x="90" y="695" font-size="20" font-weight="black" fill="#2563eb" text-anchor="middle">2,300.00 ر.س</text>

  <!-- Stamp & Verification QR -->
  <g transform="translate(100, 760)">
    <rect width="130" height="130" fill="#ffffff" stroke="#94a3b8" rx="8"/>
    <text x="65" y="70" font-size="11" fill="#64748b" text-anchor="middle">رمز الفاتورة ZATCA QR</text>
    <rect x="20" y="20" width="90" height="90" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="6,4"/>
  </g>
  <g transform="translate(420, 790)">
    <circle cx="60" cy="50" r="50" fill="none" stroke="#2563eb" stroke-width="3" stroke-dasharray="5,3"/>
    <text x="60" y="45" font-size="11" font-weight="bold" fill="#2563eb" text-anchor="middle">قسم المبيعات والمستودع</text>
    <text x="60" y="65" font-size="10" fill="#2563eb" text-anchor="middle">تم الاستلام والمطابقة</text>
  </g>
</svg>
`.trim();

    return {
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      merchantName: merchant,
      invoiceNumber: invNum,
      date: today,
      totalAmount: total,
      netAmount: net,
      taxAmount: vat,
      hasTax: true,
      taxNumber: taxNum,
      suggestedCategory: 'مصروفات بفواتير ضريبية',
      description: desc,
      items,
    };
  }

  // Default: materials (مواد بناء وإنشاءات)
  const net = 1000.00;
  const vat = 150.00;
  const total = 1150.00;
  const invNum = 'MAT-49102';
  const taxNum = '300582914800003';
  const merchant = 'مؤسسة الرواد لمواد البناء والمقاولات';
  const desc = 'شراء أكياس أسمنت بورتلاندي ورمل مغسول وحديد رباط لتسليح القواعد';
  const items = [
    { name: 'أكياس أسمنت بورتلاندي مقاوم', quantity: 40, unitPrice: 15, total: 600 },
    { name: 'رمل بناء مغسول تريلا', quantity: 1, unitPrice: 250, total: 250 },
    { name: 'حديد تسليح ورباط مجلفن', quantity: 3, unitPrice: 50, total: 150 },
  ];

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="950" viewBox="0 0 700 950" style="background:#fff;font-family:sans-serif;direction:rtl;">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <rect x="25" y="25" width="650" height="900" rx="16" fill="#fdfdfe" stroke="#e2e8f0" stroke-width="3"/>
  <rect x="25" y="25" width="650" height="130" rx="16" fill="#0f766e"/>
  <text x="350" y="75" fill="#ffffff" font-size="24" font-weight="bold" text-anchor="middle">فاتورة ضريبية مبسطة (سند استلام مواد)</text>
  <text x="350" y="110" fill="#99f6e4" font-size="16" text-anchor="middle">${merchant}</text>
  <text x="350" y="135" fill="#ffffff" font-size="12" text-anchor="middle">الرقم الضريبي: ${taxNum}</text>

  <!-- Meta Info -->
  <g transform="translate(50, 180)" font-size="14" fill="#334155">
    <text x="600" y="20" font-weight="bold">رقم الفاتورة: <tspan font-family="monospace" fill="#0f172a">${invNum}</tspan></text>
    <text x="600" y="50" font-weight="bold">تاريخ الفاتورة: <tspan font-family="monospace">${today}</tspan></text>
    <text x="600" y="80">طريقة الدفع: <tspan font-weight="bold">نقد / عهدة المشرف</tspan></text>
    <text x="600" y="110">المشروع المستلم: مشروع صيانة وبناء المجمع السكني</text>
  </g>

  <!-- Items Table Header -->
  <rect x="50" y="320" width="600" height="40" fill="#f1f5f9" rx="8"/>
  <text x="620" y="345" font-size="13" font-weight="bold" fill="#475569">الصنف / البيان</text>
  <text x="350" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">الكمية</text>
  <text x="220" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">سعر الوحدة</text>
  <text x="90" y="345" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">الإجمالي (ر.س)</text>

  <!-- Row 1 -->
  <line x1="50" y1="410" x2="650" y2="410" stroke="#e2e8f0"/>
  <text x="620" y="390" font-size="13" font-weight="bold" fill="#1e293b">أكياس أسمنت بورتلاندي مقاوم</text>
  <text x="350" y="390" font-size="13" fill="#334155" text-anchor="middle">40 كيس</text>
  <text x="220" y="390" font-size="13" fill="#334155" text-anchor="middle">15.00</text>
  <text x="90" y="390" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">600.00</text>

  <!-- Row 2 -->
  <line x1="50" y1="470" x2="650" y2="470" stroke="#e2e8f0"/>
  <text x="620" y="445" font-size="13" font-weight="bold" fill="#1e293b">رمل بناء مغسول تريلا</text>
  <text x="350" y="445" font-size="13" fill="#334155" text-anchor="middle">1 رد</text>
  <text x="220" y="445" font-size="13" fill="#334155" text-anchor="middle">250.00</text>
  <text x="90" y="445" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">250.00</text>

  <!-- Row 3 -->
  <line x1="50" y1="530" x2="650" y2="530" stroke="#e2e8f0"/>
  <text x="620" y="505" font-size="13" font-weight="bold" fill="#1e293b">حديد تسليح ورباط مجلفن</text>
  <text x="350" y="505" font-size="13" fill="#334155" text-anchor="middle">3 ربطة</text>
  <text x="220" y="505" font-size="13" fill="#334155" text-anchor="middle">50.00</text>
  <text x="90" y="505" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">150.00</text>

  <!-- Totals Box -->
  <rect x="50" y="560" width="600" height="180" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="620" y="600" font-size="14" fill="#64748b">المجموع الخاضع للضريبة (قبل الضريبة):</text>
  <text x="90" y="600" font-size="15" font-weight="bold" fill="#334155" text-anchor="middle">1,000.00 ر.س</text>

  <text x="620" y="640" font-size="14" fill="#64748b">ضريبة القيمة المضافة (15% VAT):</text>
  <text x="90" y="640" font-size="15" font-weight="bold" fill="#0f766e" text-anchor="middle">150.00 ر.س</text>

  <line x1="60" y1="665" x2="640" y2="665" stroke="#cbd5e1" stroke-dasharray="4"/>
  <text x="620" y="705" font-size="17" font-weight="bold" fill="#0f172a">المبلغ الإجمالي شامل الضريبة:</text>
  <text x="90" y="705" font-size="20" font-weight="black" fill="#0f766e" text-anchor="middle">1,150.00 ر.س</text>

  <!-- Stamp & Verification QR -->
  <g transform="translate(100, 770)">
    <rect width="130" height="130" fill="#ffffff" stroke="#94a3b8" rx="8"/>
    <text x="65" y="70" font-size="11" fill="#64748b" text-anchor="middle">رمز الفاتورة ZATCA QR</text>
    <rect x="20" y="20" width="90" height="90" fill="none" stroke="#0f766e" stroke-width="2" stroke-dasharray="6,4"/>
  </g>
  <g transform="translate(420, 800)">
    <circle cx="60" cy="50" r="50" fill="none" stroke="#0f766e" stroke-width="3" stroke-dasharray="5,3"/>
    <text x="60" y="45" font-size="11" font-weight="bold" fill="#0f766e" text-anchor="middle">ختم التوريد المعتمد</text>
    <text x="60" y="65" font-size="10" fill="#0f766e" text-anchor="middle">تم السداد والتسليم</text>
  </g>
</svg>
`.trim();

  return {
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    merchantName: merchant,
    invoiceNumber: invNum,
    date: today,
    totalAmount: total,
    netAmount: net,
    taxAmount: vat,
    hasTax: true,
    taxNumber: taxNum,
    suggestedCategory: 'مصروفات بفواتير ضريبية',
    description: desc,
    items,
  };
}

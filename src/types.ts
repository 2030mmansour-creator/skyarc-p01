export type UserRole =
  | 'مشرف موقع'
  | 'محاسب مالي'
  | 'مدير تنفيذي أو مدير عام / إدارة عليا'
  | 'مشرف'
  | 'محاسب'
  | 'مدير'
  | 'مدير عام'
  | 'مدير تنفيذي'
  | 'إدارة عليا'
  | string;

export type UpdateMode = 'ALL_CHANGES' | 'UPDATES_ONLY' | 'READ_ONLY';

export type AppScreenId =
  | 'dashboard'
  | 'expenses'
  | 'approvals'
  | 'custodies'
  | 'projects'
  | 'supervisors'
  | 'reports'
  | 'settings'
  | 'support';

export interface ScreenDefinition {
  id: AppScreenId;
  name: string;
  description: string;
  iconName: string;
  category: 'core' | 'operations' | 'management';
}

export const APP_SCREENS: ScreenDefinition[] = [
  {
    id: 'dashboard',
    name: 'نظرة عامة والتحليلات',
    description: 'المؤشرات المالية العامة، توزيع المصروفات، وأداء المشاريع',
    iconName: 'LayoutDashboard',
    category: 'core',
  },
  {
    id: 'expenses',
    name: 'المصروفات والفواتير',
    description: 'سجل السندات، المسح الذكي بالكاميرا، والتحقق الميداني',
    iconName: 'ReceiptText',
    category: 'core',
  },
  {
    id: 'approvals',
    name: 'دورة الاعتمادات والترحيل',
    description: 'اعتماد مدير المشروع، مراجعة المحاسب، والترحيل لبرامج المحاسبة (ERP)',
    iconName: 'CheckCircle2',
    category: 'operations',
  },
  {
    id: 'custodies',
    name: 'العهد وأرصدة المشرفين',
    description: 'إدارة العهد النقدية، السجلات، وتتبع رصيد كل مشرف ميداني',
    iconName: 'Wallet',
    category: 'operations',
  },
  {
    id: 'projects',
    name: 'المشاريع والمواقع',
    description: 'بيانات المشاريع، الميزانيات المعتمدة، ونسب الصرف والإنجاز',
    iconName: 'Briefcase',
    category: 'operations',
  },
  {
    id: 'supervisors',
    name: 'المشرفين وفريق العمل',
    description: 'سجل المشرفين، مواقع العمل الميدانية، والمشاريع المسندة',
    iconName: 'Users',
    category: 'operations',
  },
  {
    id: 'reports',
    name: 'التقارير والتصدير',
    description: 'التقارير التحليلية، كشوفات الحسابات، والتصدير إلى Excel',
    iconName: 'FileSpreadsheet',
    category: 'management',
  },
  {
    id: 'settings',
    name: 'الإعدادات والصلاحيات (RBAC)',
    description: 'إدارة الأدوار والمستخدمين، دورة الاعتماد، والربط المحاسبي',
    iconName: 'Settings',
    category: 'management',
  },
  {
    id: 'support',
    name: 'الدعم الفني والمساعدة',
    description: 'مركز الدعم، الأسئلة الشائعة، ووسائل التواصل السريع',
    iconName: 'Headphones',
    category: 'core',
  },
];

export interface RolePermission {
  // شاشات وواجهات النظام المسموحة (Screen Navigation Permissions)
  allowedScreens: string[]; // معرفات الشاشات التي يحق لهذا الدور الدخول إليها ورؤيتها في القائمة

  // صلاحيات الرؤية والاطلاع
  canViewAllProjects: boolean; // رؤية كافة المشاريع في النظام
  canViewAllExpenses: boolean; // رؤية كافة المصروفات أو المصروفات الخاصة به/بمشاريعه فقط
  canViewFinancialReports: boolean; // الاطلاع على التقارير المالية والتحليلات
  canViewCustodies: boolean; // الاطلاع على أرصدة وكشوفات العهد
  canViewTeamMembers: boolean; // الاطلاع على المشرفين وفريق العمل

  // صلاحيات العمليات والتحكم في التعديلات والحذف
  canCreateExpense: boolean; // تسجيل وإضافة مصروف جديد
  canEditExpense: boolean; // تعديل المصروفات
  canDeleteExpense: boolean; // حذف المصروفات
  expenseEditGraceMinutes?: number; // مهلة التعديل المسموحة بالدقائق (30 دقيقة للمشرف، 0 مقفل فوراً، 9999 مفتوح بدون قيود للمدير)
  canManageCustody: boolean; // تسليم وتعديل العهد النقدية
  canManageProjects: boolean; // إضافة وتعديل المشاريع والميزانيات

  // صلاحيات دورة الاعتماد والترحيل
  canApproveAsSupervisor?: boolean; // مراجعة واعتماد مشرف الموقع (المرحلة 1)
  canApproveAsProjectManager: boolean; // اعتماد مدير المشروع
  canApproveAsAccountant: boolean; // مراجعة وتدقيق المحاسب المالي (المرحلة 2)
  canExportToExternalERP: boolean; // الترحيل والإدخال على برنامج المحاسبة الخارجي
  canApproveAsManagement: boolean; // اعتماد الإدارة العليا والمدير المالي (المرحلة 3)
  canBatchApprove: boolean; // الاعتماد الجماعي للفواتير
  canApproveFinalManagement?: boolean; // توافق إضافي
  canApproveAccounting?: boolean; // توافق إضافي
  canSubmitExpenses?: boolean; // توافق إضافي
  canApproveExpenses?: boolean; // توافق إضافي
 
  // صلاحيات التحكم والإدارة
  canManageRolesAndPermissions: boolean; // إضافة وتعديل وحذف الأدوار ومصفوفة الصلاحيات
  canConfigureWorkflow: boolean; // تعديل مراحل دورة الاعتماد وإعداداتها
  canExportExcelAndBackup: boolean; // تصدير البيانات والنسخ الاحتياطي
}

export interface CustomRole {
  id: string; // e.g. 'role_pm', 'role_accountant', 'role_management', 'role_supervisor', 'role_custom_1'
  name: string; // e.g. 'مدير المشروع', 'محاسب مالي', 'إدارة عليا'
  description: string;
  color?: string; // Badge color (emerald, blue, purple, amber, indigo, rose, teal)
  badgeColor?: string; // Optional custom styling class
  isSystem?: boolean; // هل هو دور نظام أساسي
  permissions: RolePermission;
}

export interface WorkflowStage {
  id: string; // e.g. 'stage_supervisor', 'stage_accountant', 'stage_management'
  title: string; // e.g. 'المرحلة 1: مراجعة المصروف والاعتماد للمشرف'
  subtitle?: string;
  description?: string;
  order: number; // 1, 2, 3...
  requiredRoleId?: string; // Role ID permitted to approve this stage
  requiredRoleName?: string;
  roleId?: string; // Alias for requiredRoleId
  requiresExternalErpPosting?: boolean; // هل تتطلب هذه المرحلة تأكيد الإدخال على برنامج المحاسبة الخارجي ورقم القيد
  minAmountThreshold?: number;
  allowReject?: boolean;
  isActive: boolean;
  iconName?: string;
}

export interface ExpenseWorkflowAction {
  stageId: string;
  stageTitle: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  actionByEmail?: string;
  actionByName?: string;
  actionRole?: string;
  actionTime?: string;
  notes?: string;
  erpSystemName?: string; // اسم البرنامج المحاسبي الخارجي
  erpReferenceNumber?: string; // رقم القيد / السند في برنامج المحاسبة
  erpPostedDate?: string;
}

export interface User {
  id: string;
  email: string;
  username?: string; // اسم المستخدم
  password?: string; // كلمة المرور
  passwordChangedAt?: string; // تاريخ آخر تغيير لكلمة المرور
  passwordResetByAdmin?: boolean; // هل تم عمل إعادة ضبط بواسطة المدير
  name: string;
  role: UserRole;
  roleId?: string; // Ref to CustomRole
  phone?: string;
  avatar?: string;
  updateMode: UpdateMode;
  assignedProjects?: string[]; // Projects this user is allowed to access
  permissions?: RolePermission;
  themePreference?: 'system' | 'light' | 'dark'; // تفضيل الوضع الليلي/النهاري الخاص بالمستخدم
  currentSessionId?: string; // المعرف الفريد للجلسة النشطة الحالية (لمنع الدخول من أكثر من جهاز في نفس الوقت)
  lastLoginAt?: string; // توقيت آخر تسجيل دخول
  lastLoginDevice?: string; // مواصفات المتصفح والجهاز الذي تم تسجيل الدخول منه
  lastLoginIp?: string;
}

export interface AuthSession {
  isAuthenticated: boolean;
  userId: string;
  sessionId?: string; // معرف الجلسة الخاص بهذا المتصفح
  lastLoginAt: string;
  deviceInfo?: string;
  rememberMe?: boolean;
}

export interface SessionEvictedInfo {
  isOpen: boolean;
  userName: string;
  newDevice: string;
  loginTime: string;
}

export interface Project {
  id: string;
  name: string; // اسم المشروع
  code: string; // كود المشروع
  status: 'جاري' | 'مكتمل' | 'متوقف' | 'مؤرشف'; // الحالة
  emails: string; // المشرفين المسندين (نص مفصول بفواصل للتوافقية)
  assignedUserIds?: string[]; // معرفات المشرفين وفريق العمل المسندين للمشروع
  assignedEmails?: string[]; // إيميلات المشرفين وفريق العمل المسندين للمشروع
  budget: number; // الميزانية التقديرية بالريال
  clientName?: string; // اسم العميل / المالك
  location?: string; // موقع المشروع
  startDate?: string;
  endDate?: string;
  description?: string;
  createdAt: string;
  savedLocally?: boolean;
  lastSavedAt?: string;
  synced?: boolean;
  pcloudPublicFolderUrl?: string; // رابط مجلد pCloud المشترك الخاص بهذا المشروع
}

export type ExpenseCategory =
  | 'عمالة'
  | 'مصروفات بفواتير ضريبية'
  | 'اعمال على'
  | 'مقاولين'
  | 'المالك'
  | 'رواتب'
  | 'نثريات ومشتريات'
  | 'نقل ومحروقات'
  | 'صيانة ومعدات'
  | 'مواد بناء'
  | string;

export interface GPSLocation {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
}

export type ApprovalStatus = 'غير معتمد' | 'بانتظار الاعتماد' | 'معلق' | 'معتمد' | 'مرفوض' | 'بانتظار مراجعة وترحيل المحاسب المالي' | 'بانتظار اعتماد الإدارة العليا';
export type AccountantApproval = 'تم الاعتماد' | 'غير معتمد' | 'مرفوض';
export type ManagementApproval = 'تم اعتماد الادارة' | 'غير معتمد' | 'مرفوض';
export type ProjectManagerApproval = 'تم اعتماد مدير المشروع' | 'تم اعتماد المشرف' | 'غير معتمد' | 'مرفوض';
export type ERPPostingStatus = 'غير مرحل' | 'بانتظار الترحيل' | 'تم الترحيل للبرنامج المحاسبي';

export interface ExpenseAttachment {
  id: string;
  url: string; // رابط المرفق أو Base64 أو رابط pCloud
  fileName: string; // اسم الملف
  fileType: 'pdf' | 'image'; // نوع الملف
  fileSize?: number; // حجم الملف بالبايت
  uploadedAt?: string; // وقت الإرفاق
  source?: 'pcloud' | 'upload' | 'camera' | 'gdrive'; // مصدر المرفق
  pcloudFileId?: number | string; // معرف الملف في pCloud
  pcloudPublicCode?: string; // كود الرابط العام في pCloud
  pcloudDownloadUrl?: string; // رابط التحميل المباشر
  pcloudThumbUrl?: string; // رابط المعاينة المصغرة
  pcloudWebUrl?: string; // الرابط الخارجي المباشر لفتح المستند في صفحة أو نافذة جديدة
}

export interface PCloudItem {
  id: string | number;
  name: string;
  isFolder: boolean;
  folderId?: number | string;
  fileId?: number | string;
  size?: number;
  contentType?: string;
  isImage?: boolean;
  isPdf?: boolean;
  thumbUrl?: string;
  downloadUrl?: string;
  modified?: string;
  created?: string;
  parentFolderId?: number | string;
}

export interface PCloudFolderResult {
  success: boolean;
  code: string;
  region: 'us' | 'eu';
  folderName: string;
  folderId: number | string;
  currentPath: string;
  items: PCloudItem[];
  subfolders: PCloudItem[];
  files: PCloudItem[];
  totalFiles: number;
  totalImages: number;
  totalPdfs: number;
  error?: string;
}

export interface Expense {
  id: string; // Unique ID (e.g. EXP-1001)
  legacyId?: string; // المعرف أو الكود الأصلي من شيت الإكسيل (عمود id) لمطابقة وربط صور الفواتير القديمة
  date: string; // التاريخ (YYYY-MM-DD)
  fingerprintTime: string; // وقت_البصمة (ISO Timestamp when submitted)
  supervisorEmail: string; // المشرف
  supervisorName: string;
  projectId: string; // المشروع (Ref to Projects)
  projectName: string;
  category: ExpenseCategory; // البند
  details: string; // التفاصيل
  amount: number; // المبلغ
  taxAmount?: number; // قيمة الضريبة إن وجدت
  invoiceNumber?: string; // رقم الفاتورة الضريبية
  invoicePhoto?: string; // صورة_الفاتورة (URL or Base64) - المرفق الرئيسي الأول للتوافق
  attachments?: ExpenseAttachment[]; // قائمة المرفقات المتعددة (صور متعددة ومستندات PDF)
  gpsLocation?: GPSLocation; // الموقع_GPS
  updatedAt: string; // وقت_التعديل
  status: ApprovalStatus; // حالة الاعتماد النهائية

  // Workflow Pipeline Tracking
  currentStageId?: string; // المعرف للمرحلة الحالية بانتظار الإجراء
  currentStageIndex?: number;
  workflowHistory?: ExpenseWorkflowAction[];

  // Supervisor Review & Approval (Stage 1)
  supervisorApproval?: 'تم اعتماد المشرف' | 'غير معتمد' | 'مرفوض';
  supervisorNotes?: string;
  supervisorActionTime?: string;
  supervisorApproverName?: string; // اسم المدير أو المحاسب أو المعتمد الذي قام باعتماد مرحلة المشرف

  // Project Manager Approval (Legacy / Synchronized with Stage 1)
  projectManagerApproval?: ProjectManagerApproval;
  projectManagerNotes?: string;
  projectManagerActionTime?: string;
  projectManagerName?: string;

  // Accountant Approval & External ERP Posting (Stage 2)
  accountantApproval: AccountantApproval;
  accountantNotes?: string;
  accountantActionTime?: string;
  accountantName?: string;
  erpPostingStatus?: ERPPostingStatus;
  erpSystemName?: string; // e.g. 'قيود', 'دفترة', 'Odoo', 'SAP', 'SMACC', 'Excel'
  erpReferenceNumber?: string; // رقم القيد بالبرنامج الخارجي
  erpPostedDate?: string;

  // Executive Management Approval (Stage 3)
  managementApproval: ManagementApproval;
  managementNotes?: string;
  managementActionTime?: string;
  managementName?: string;

  rejectionReason?: string;
  synced: boolean; // هل تم المزامنة السحابية
  savedLocally?: boolean; // هل تم الحفظ بنجاح محلياً
  lastSavedAt?: string; // وقت وتاريخ الحفظ المحلي
  offlineCreated?: boolean;

  // Attachment Coded Metadata & Project Storage Separation
  attachmentFileName?: string; // اسم الملف المكود برقم السند e.g. PRJ-01_EXP-1001_فاتورة_2901.pdf
  attachmentProjectFolder?: string; // المجلد المنفصل للمشروع e.g. مجلد_مشروع_PRJ-01
  attachmentMeta?: {
    codedName: string;
    originalName?: string;
    bondNumber: string; // رقم السند
    projectCode?: string;
    projectName?: string;
    projectFolder: string;
    fileType: 'pdf' | 'image' | string;
    storagePath?: string;
    savedAt?: string;
  };

  // Archive Metadata (When moved to separate historical archive)
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archivedReason?: string;
  fiscalYear?: number;
}

export interface ArchivedExpense extends Expense {
  isArchived: boolean;
  archivedAt: string;
  archivedBy: string;
  archivedReason?: string;
  fiscalYear: number;
}

export interface ExpenseArchiveCriteria {
  mode: 'prior_fiscal_years' | 'specific_year' | 'before_date' | 'completed_projects' | 'custom_selection';
  currentFiscalYear?: number; // e.g. 2026
  targetFiscalYear?: number; // e.g. 2024 or 2025
  beforeDate?: string; // YYYY-MM-DD
  onlyApproved?: boolean; // Only status === 'معتمد' or posted to ERP
  projectIds?: string[];
  expenseIds?: string[];
  reason?: string;
  stripAttachments?: boolean; // If true, removes invoicePhoto to save space. Default is false (attachments are preserved)
  keepAttachments?: boolean; // When true, explicitly retains all document attachments inside the archive
}

export interface CustodyRecord {
  id: string;
  supervisorEmail: string;
  supervisorName: string;
  amount: number; // المبلغ المسلم
  date: string; // التاريخ
  paymentMethod: 'تحويل بنكي' | 'نقداً' | 'شيك' | 'سند صرف خزينة' | 'بطاقة مصروفات بنكية' | string;
  receiptNumber?: string;
  bankName?: string; // اسم البنك المحول منه/إليه
  projectId?: string; // المشروع المرتبط به إن وجد أو عهدة عامة
  projectName?: string;
  notes?: string;
  issuedBy?: string; // سلمت بواسطة
  synced: boolean;
  savedLocally?: boolean; // هل تم الحفظ بنجاح محلياً
  lastSavedAt?: string; // وقت وتاريخ الحفظ المحلي
}

export interface OperationStatusInfo {
  id: string;
  action: string; // e.g. 'إضافة مصروف', 'تعديل سند', 'اعتماد المحاسب', 'إضافة عهدة'
  title: string; // e.g. 'سند EXP-1001'
  savedLocally: boolean;
  synced: boolean;
  timestamp: string;
  details?: string;
}

export interface SupervisorSummary {
  id?: string;
  email: string;
  name: string;
  phone: string;
  assignedProjects: string[];
  totalCustody: number; // إجمالي العهد المسلمة
  totalApprovedExpenses: number; // إجمالي المصروفات المعتمدة نهائياً
  totalPendingExpenses: number; // إجمالي المصروفات بانتظار الاعتماد (مسجلة وغير معتمدة)
  totalAllExpenses: number; // إجمالي المصروفات المسجلة (معتمدة + قيد الاعتماد)
  approvedBookBalance: number; // الرصيد الدفتري المعتمد (العهد - المعتمد فقط)
  actualRemainingBalance: number; // الرصيد الفعلي الميداني المتبقي (العهد - كل المصروفات المسجلة)
  remainingBalance: number; // الرصيد المتبقي الفعلي المعتمد كمرجع افتراضي
  pendingCount: number; // عدد الفواتير قيد الاعتماد
  approvedCount: number; // عدد الفواتير المعتمدة
  custodyCount: number; // عدد دفعات العهد المستلمة
  lastCustodyDate?: string;
  lastExpenseDate?: string;
  status: 'رصيد كافي' | 'تحذير رصيد منخفض' | 'رصيد حرج' | 'عجز في العهدة';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type:
    | 'expense_added'
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'custody_issued'
    | 'custody_replenishment'
    | 'low_balance'
    | 'edit_window'
    | 'sync'
    | 'system'
    | 'info'
    | 'alert';
  category?: 'expense' | 'approval' | 'custody' | 'replenishment' | 'other';
  timestamp: string;
  createdAt?: string;
  read: boolean;
  relatedId?: string; // related expense ID, custody ID, or supervisor email
  actionLink?: string;
  authorEmail?: string;
  authorName?: string;
  readBy?: string[]; // Array of user emails/IDs who have marked this notification as read
  deletedBy?: string[]; // Array of user emails/IDs who have deleted/hidden this notification
}

export type LogoPosition = 'right' | 'center' | 'left' | 'hidden' | 'custom' | 'free';
export type LogoSize = 'sm' | 'md' | 'lg' | 'custom';

export interface AppSettings {
  companyName: string;
  companySubtitle: string;
  companyLogo?: string;
  defaultLogoPosition?: LogoPosition; // موضع الشعار الافتراضي في التقارير (يمين / وسط / يسار / مخفي)
  defaultLogoSize?: LogoSize; // حجم الشعار الافتراضي في التقارير (صغير / متوسط / كبير)
  currency: string;
  currencySymbol: string;
  lowBalanceThreshold: number; // default: 10,000 SAR
  editGracePeriodMinutes: number; // default: 30 minutes rule from PDF spec
  autoGpsCapture: boolean;
  requireInvoicePhoto: boolean;
  theme: 'system' | 'light' | 'dark';
  accentColor: 'emerald' | 'blue' | 'indigo' | 'amber' | 'teal';
  compactView: boolean;
  enableSoundEffects: boolean;
  autoCloudSync: boolean;
  telegramRecipient: string;
  whatsappRecipient?: string; // رقم واتساب المدير أو الإدارة لاستقبال طلبات تعزيز العهدة
  supportPhone: string;
  supportEmail: string;
  customCategories: string[];
  customErpSystems?: string[];
  erpSystemName?: string;
  securityPinEnabled: boolean;
  securityPin?: string;
  googleDriveAccessToken?: string;
  googleDriveRefreshToken?: string;
  googleDriveClientId?: string;
  googleDriveClientSecret?: string;
  googleDriveFolderId?: string;
  pcloudPublicFolderUrl?: string; // رابط مجلد pCloud المشترك الافتراضي للمنظومة
  dailyBackupEnabled?: boolean; // تفعيل النسخ الاحتياطي التلقائي اليومي
  lastDailyBackupSentAt?: string; // تاريخ ووقت آخر تنفيذ للنسخ الاحتياطي اليومي
  pcloudBackupFolderUrl?: string; // رابط مجلد pCloud للنسخ الاحتياطي السحابي التلقائي (رابط طلب ملفات File Request / Upload Link)
  pcloudAccessToken?: string; // رمز وصول pCloud اختياري للربط والرفع المباشر لحساب pCloud
  lastPCloudBackupAt?: string; // تاريخ ووقت آخر رفع للنسخة الاحتياطية إلى pCloud
}

export interface SupportTicket {
  id: string;
  title?: string;
  subject?: string;
  category: 'استفسار مالي' | 'مشكلة فنية' | 'طلب صلاحية' | 'اقتراح تطوير' | 'تقني' | 'أخرى';
  priority: 'عادي' | 'متوسط' | 'عاجل';
  status: 'مفتوحة' | 'قيد المعالجة' | 'تم الحل' | 'مغلق' | 'قيد المتابعة';
  userEmail: string;
  userName: string;
  message?: string;
  description?: string;
  createdAt: string;
  responses?: {
    id: string;
    sender: string;
    message: string;
    timestamp: string;
    isAdmin: boolean;
  }[];
}

export interface SavedReportPreset {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  projectId: string;
  supervisorEmail: string;
  category: string;
  status: string;
  datePreset: 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  createdAt: string;
  isSystem?: boolean;
}

export interface FilteredReportPrintData {
  title: string;
  reportSubtitle?: string;
  generatedBy?: string;
  dateRange?: { from: string; to: string };
  selectedProjectName?: string;
  selectedCategoryName?: string;
  selectedSupervisorName?: string;
  totalSpent: number;
  pendingAmount: number;
  totalTax: number;
  totalExpensesCount: number;
  categoryBreakdown: { name: string; value: number; formattedPercent: string; color: string }[];
  supervisorBreakdown: { name: string; value: number }[];
  expensesList: Expense[];
}

export type PrintData =
  | { type: 'expense'; data: Expense }
  | { type: 'custody_statement'; data: SupervisorSummary }
  | { type: 'project_report'; data: any }
  | { type: 'filtered_report'; data: FilteredReportPrintData }
  | { type: 'expense_list'; data: { title: string; subtitle?: string; expenses: Expense[]; totalAmount: number; totalTax: number } };

export interface SyncProgressInfo {
  isSyncing: boolean;
  percent: number;
  remainingSeconds: number;
  statusText: string;
  itemsSynced: number;
  totalItems: number;
  remainingItems: number;
  currentBatch?: number;
  totalBatches?: number;
  isDifferential?: boolean;
  activeCategory?: string;
}


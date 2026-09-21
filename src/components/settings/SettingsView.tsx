import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { StorageService } from '../../services/storage';
import { CustomRole, WorkflowStage, RolePermission, APP_SCREENS, AppScreenId, LogoPosition, LogoSize } from '../../types';
import { CompanyLogoManager } from './CompanyLogoManager';
import { ExpenseArchiveManager } from './ExpenseArchiveManager';
import {
  Settings,
  Moon,
  Sun,
  Laptop,
  Shield,
  Bell,
  MapPin,
  Clock,
  DollarSign,
  Send,
  Mail,
  MailX,
  Database,
  Download,
  Upload,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  Lock,
  Link2,
  Layers,
  Sparkles,
  Users,
  ShieldCheck,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Edit3,
  KeyRound,
  CheckSquare,
  Square,
  Building2,
  FileSpreadsheet,
  PhoneCall,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Pencil,
  ShieldAlert,
  LayoutDashboard,
  ReceiptText,
  CheckCircle2,
  Wallet,
  Briefcase,
  Eye,
  Sliders,
  Timer,
  CheckCircle,
  FileJson,
  Archive,
  HardDrive,
  History,
  FileText,
  Info,
  HelpCircle,
  ArrowRight,
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  Server,
  MessageCircle,
  Terminal,
  Activity,
  Globe,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Copy
} from 'lucide-react';
import { WhatsAppService } from '../../services/whatsappService';
import { ServerSyncService, ServerDiagnosticResult } from '../../services/serverSync';
import { FirebaseService } from '../../services/firebase';
import { GoogleDriveService } from '../../services/googleDriveService';
import { PCloudService } from '../../services/pcloudService';
import { WorkspaceInfo, sanitizeWorkspaceId } from '../../services/workspace';

const isExecutiveManagerRole = (role: { id?: string; name?: string } | null | undefined): boolean => {
  if (!role) return false;
  const id = role.id || '';
  return id === 'role_admin' || id === 'role_management';
};

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    renameCategory,
    deleteCategory,
    getCategoryUsageCount,
    renameErpSystem,
    deleteErpSystem,
    getErpUsageCount,
    expenses,
    projects,
    custodies,
    users,
    roles,
    addRole,
    updateRole,
    deleteRole,
    workflowStages,
    addWorkflowStage,
    updateWorkflowStage,
    deleteWorkflowStage,
    reorderWorkflowStages,
    currentUser,
    currentUserRole,
    hasPermission,
    confirmAction,
    showAlert,
    exportAllToExcel,
    downloadBackup,
    validateBackup,
    validateBackupExcel,
    importBackupData,
    isCloudConnected,
    isCloudSyncing,
    syncProgress,
    lastCloudSyncTime,
    syncWithCloud,
    loadFromCloud,
    createCloudSnapshot,
    listCloudSnapshots,
    restoreCloudSnapshot,
    runDailyBackup,
    uploadDailyBackupToPCloud,
    testPCloudUploadLink,
    getDailyBackupStatus,
    archivedExpenses,
    setCurrentView,
    theme,
    isDarkMode,
    setTheme,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'general' | 'roles' | 'workflow' | 'erp' | 'archive' | 'backup'>('general');

  // General Settings state
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [companySubtitle, setCompanySubtitle] = useState(settings.companySubtitle || '');
  const [companyLogo, setCompanyLogo] = useState(settings.companyLogo || '');
  const [defaultLogoPosition, setDefaultLogoPosition] = useState<LogoPosition>(settings.defaultLogoPosition || 'right');
  const [defaultLogoSize, setDefaultLogoSize] = useState<LogoSize>(settings.defaultLogoSize || 'md');
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(settings.lowBalanceThreshold);
  const [editGracePeriodMinutes, setEditGracePeriodMinutes] = useState(settings.editGracePeriodMinutes);
  const [telegramRecipient, setTelegramRecipient] = useState(settings.telegramRecipient);
  const [whatsappRecipient, setWhatsappRecipient] = useState(settings.whatsappRecipient || settings.supportPhone || '+966 50 123 4567');
  const [autoGpsCapture, setAutoGpsCapture] = useState(settings.autoGpsCapture);
  const [securityPin, setSecurityPin] = useState(settings.securityPin || '');

  const [googleDriveAccessToken, setGoogleDriveAccessToken] = useState<string>(settings.googleDriveAccessToken || '');
  const [googleDriveRefreshToken, setGoogleDriveRefreshToken] = useState<string>(settings.googleDriveRefreshToken || '');
  const [googleDriveClientId, setGoogleDriveClientId] = useState<string>(settings.googleDriveClientId || '');
  const [googleDriveClientSecret, setGoogleDriveClientSecret] = useState<string>(settings.googleDriveClientSecret || '');
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState<string>(settings.googleDriveFolderId || '');
  const [googleDriveTestStatus, setGoogleDriveTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [googleDriveTestMessage, setGoogleDriveTestMessage] = useState<string>('');

  const [pcloudPublicFolderUrl, setPcloudPublicFolderUrl] = useState<string>(settings.pcloudPublicFolderUrl || '');
  const [pcloudTestStatus, setPcloudTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [pcloudTestMessage, setPcloudTestMessage] = useState<string>('');

  const handleTestPCloudConnection = async () => {
    if (!pcloudPublicFolderUrl.trim()) {
      setPcloudTestStatus('error');
      setPcloudTestMessage('الرجاء إدخال رابط المجلد المشترك من pCloud أولاً.');
      return;
    }
    setPcloudTestStatus('testing');
    setPcloudTestMessage('جاري الاتصال بـ pCloud وفحص المجلد المشترك...');
    const result = await PCloudService.testLink(pcloudPublicFolderUrl.trim());
    if (result.success) {
      setPcloudTestStatus('success');
      setPcloudTestMessage(result.message || `تم التحقق بنجاح! المجلد: ${result.folderName}`);
      updateSettings({ pcloudPublicFolderUrl: pcloudPublicFolderUrl.trim() });
    } else {
      setPcloudTestStatus('error');
      setPcloudTestMessage(result.error || 'تعذر قراءة المجلد المشترك من pCloud.');
    }
  };

  const handleTestGoogleDriveConnection = async () => {
    if (!googleDriveAccessToken.trim() && !googleDriveRefreshToken.trim()) {
      setGoogleDriveTestStatus('error');
      setGoogleDriveTestMessage('الرجاء إدخال Access Token أو Refresh Token على الأقل.');
      return;
    }
    setGoogleDriveTestStatus('testing');
    setGoogleDriveTestMessage('جاري اختبار الاتصال وتجديد الرمز تلقائياً بجوجل دريف...');
    const result = await GoogleDriveService.testConnection({
      googleDriveAccessToken,
      googleDriveRefreshToken,
      googleDriveClientId,
      googleDriveClientSecret
    });
    if (result.success) {
      setGoogleDriveTestStatus('success');
      setGoogleDriveTestMessage(result.message);
      updateSettings({
        googleDriveAccessToken: googleDriveAccessToken.trim(),
        googleDriveRefreshToken: googleDriveRefreshToken.trim(),
        googleDriveClientId: googleDriveClientId.trim(),
        googleDriveClientSecret: googleDriveClientSecret.trim(),
        googleDriveFolderId: googleDriveFolderId.trim(),
      });
    } else {
      setGoogleDriveTestStatus('error');
      setGoogleDriveTestMessage(result.message);
    }
  };
  const [categories, setCategories] = useState<string[]>(settings.customCategories || []);
  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState<{ oldName: string; newName: string } | null>(null);
  const [catFeedback, setCatFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize categories with app settings if changed
  useEffect(() => {
    if (settings.customCategories && Array.isArray(settings.customCategories)) {
      setCategories(settings.customCategories);
    }
  }, [settings.customCategories]);

  // ERP Systems State
  const defaultErpList = [
    'Odoo ERP (أودو)',
    'SAP S/4HANA (ساب)',
    'Oracle NetSuite (أوراكل)',
    'QuickBooks Online (كويك بوكس)',
    'Daftra (دفترة)',
    'Qoyod (قيود)',
    'Al-Ameen (الأمين)',
    'SMACC (سماك)',
    'Microsoft Dynamics 365 (مايكروسوفت)'
  ];

  const [erpSystems, setErpSystems] = useState<string[]>(
    settings.customErpSystems && settings.customErpSystems.length > 0
      ? settings.customErpSystems
      : defaultErpList
  );
  const [selectedErp, setSelectedErp] = useState<string>(
    settings.erpSystemName || 'Odoo ERP (أودو)'
  );
  const [newErpName, setNewErpName] = useState<string>('');
  const [erpFeedback, setErpFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (settings.customErpSystems && settings.customErpSystems.length > 0) {
      setErpSystems(settings.customErpSystems);
    }
    if (settings.erpSystemName) {
      setSelectedErp(settings.erpSystemName);
    }
  }, [settings.customErpSystems, settings.erpSystemName]);

  const handleSelectErp = (systemName: string) => {
    setSelectedErp(systemName);
    updateSettings({
      erpSystemName: systemName,
      customErpSystems: erpSystems
    });
    setErpFeedback({
      type: 'success',
      message: `تم اعتماد "${systemName}" كنظام محاسبي رئيسي معتمد للشركة بنجاح.`
    });
    setTimeout(() => setErpFeedback(null), 3500);
  };

  const handleAddCustomErp = () => {
    const trimmed = newErpName.trim();
    if (!trimmed) {
      setErpFeedback({ type: 'error', message: 'يرجى كتابة اسم البرنامج المحاسبي الخارجي أولاً.' });
      return;
    }
    if (erpSystems.some(s => s.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErpFeedback({ type: 'error', message: 'هذا البرنامج المحاسبي موجود بالفعل في القائمة المعتمدة.' });
      return;
    }
    const updated = [trimmed, ...erpSystems];
    setErpSystems(updated);
    setSelectedErp(trimmed);
    setNewErpName('');
    updateSettings({
      customErpSystems: updated,
      erpSystemName: trimmed,
    });
    setErpFeedback({
      type: 'success',
      message: `تم إضافة برنامج "${trimmed}" واعتماده كنظام محاسبي رئيسي للشركة بنجاح.`
    });
    setTimeout(() => setErpFeedback(null), 4000);
  };

  // ERP Systems Edit State
  const [editingErp, setEditingErp] = useState<{ oldName: string; newName: string } | null>(null);

  const handleStartEditErp = (sys: string) => {
    setEditingErp({ oldName: sys, newName: sys });
    setErpFeedback(null);
  };

  const handleSaveEditErp = () => {
    if (!editingErp) return;
    const { oldName, newName } = editingErp;
    const result = renameErpSystem(oldName, newName);
    if (!result.success) {
      setErpFeedback({ type: 'error', message: result.message });
      return;
    }
    setEditingErp(null);
    setErpFeedback({
      type: 'success',
      message: result.message,
    });
    setTimeout(() => setErpFeedback(null), 4000);
  };

  const handleCancelEditErp = () => {
    setEditingErp(null);
  };

  const handleDeleteErp = (systemName: string) => {
    const usageCount = getErpUsageCount(systemName);
    if (usageCount > 0) {
      confirmAction({
        title: 'لا يمكن حذف هذا البرنامج المحاسبي',
        message: `البرنامج المحاسبي "${systemName}" مسجل ومرتبط به (${usageCount}) عملية صرف في المنظومة. حفاظاً على سلامة القيود وسندات الصرف والتقارير الرقابية، يمنع حذفه. ولكن يمكنك تعديل اسمه ليتم تحديثه في كافة السجلات والمصروفات المرتبطة به تلقائياً.`,
        type: 'warning',
        confirmText: 'تعديل اسم البرنامج الآن',
        cancelText: 'إلغاء',
        onConfirm: () => {
          handleStartEditErp(systemName);
        }
      });
      return;
    }

    if (erpSystems.length <= 1) {
      setErpFeedback({ type: 'error', message: 'يجب الإبقاء على نظام محاسبي واحد على الأقل في القائمة.' });
      return;
    }

    confirmAction({
      title: 'تأكيد حذف البرنامج المحاسبي',
      message: `هل أنت متأكد من حذف "${systemName}" من قائمة البرامج المحاسبية المعتمدة؟`,
      type: 'danger',
      confirmText: 'نعم، حذف البرنامج',
      cancelText: 'إلغاء',
      onConfirm: () => {
        const res = deleteErpSystem(systemName);
        if (!res.success) {
          setErpFeedback({ type: 'error', message: res.message });
        } else {
          setErpFeedback({ type: 'success', message: res.message });
        }
        setTimeout(() => setErpFeedback(null), 3000);
      }
    });
  };

  const handleResetErpList = () => {
    setErpSystems(defaultErpList);
    setSelectedErp(defaultErpList[0]);
    updateSettings({
      customErpSystems: defaultErpList,
      erpSystemName: defaultErpList[0],
    });
    setErpFeedback({
      type: 'success',
      message: 'تمت استعادة قائمة الأنظمة المحاسبية القياسية بنجاح.'
    });
    setTimeout(() => setErpFeedback(null), 3000);
  };

  // Backup & Restore State
  const [backupValidationModal, setBackupValidationModal] = useState<{
    isOpen: boolean;
    fileName: string;
    fileSizeKb: number;
    stats: any;
    data: any;
    mode: 'replace' | 'merge';
  } | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Cloud Backups & Sync State
  const [cloudBackupsList, setCloudBackupsList] = useState<any[]>([]);
  const [isLoadingCloudBackups, setIsLoadingCloudBackups] = useState(false);
  const [isCloudBackupsModalOpen, setIsCloudBackupsModalOpen] = useState(false);
  const [cloudBackupNote, setCloudBackupNote] = useState('');
  const [isCreatingCloudSnapshot, setIsCreatingCloudSnapshot] = useState(false);
  const [cloudFeedback, setCloudFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [serverDiagnostic, setServerDiagnostic] = useState<ServerDiagnosticResult | null>(null);
  const [isDiagnosingServer, setIsDiagnosingServer] = useState(false);

  // Multi-Tenant Workspace & Branch Isolation State
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo>(FirebaseService.getWorkspaceInfo());
  const [customWorkspaceInput, setCustomWorkspaceInput] = useState('');
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);

  useEffect(() => {
    const unsub = FirebaseService.subscribeToWorkspace((info) => {
      setWorkspaceInfo(info);
      if (info.source === 'custom') {
        setCustomWorkspaceInput(info.name);
      }
    });
    return unsub;
  }, []);

  const handleSaveCustomWorkspace = () => {
    if (!customWorkspaceInput.trim()) {
      FirebaseService.setCustomWorkspaceId(null);
    } else {
      FirebaseService.setCustomWorkspaceId(customWorkspaceInput.trim());
    }
    setIsEditingWorkspace(false);
    setCloudFeedback({
      type: 'success',
      message: 'تم تعيين مساحة العمل وعزل قاعدة البيانات بنجاح! سيتم حفظ وجلب البيانات ضمن هذه المساحة المعزولة.'
    });
    setTimeout(() => setCloudFeedback(null), 4000);
  };

  const handleResetWorkspace = () => {
    FirebaseService.setCustomWorkspaceId(null);
    setCustomWorkspaceInput('');
    setIsEditingWorkspace(false);
    setCloudFeedback({
      type: 'success',
      message: 'تمت استعادة التحديد التلقائي لمساحة العمل وفقاً لرابط النطاق (Domain).'
    });
    setTimeout(() => setCloudFeedback(null), 4000);
  };

  const handleDiagnoseServer = async () => {
    setIsDiagnosingServer(true);
    try {
      const res = await ServerSyncService.diagnoseServerConnection();
      setServerDiagnostic(res);
    } finally {
      setIsDiagnosingServer(false);
    }
  };

  const handleSyncToCloud = async () => {
    const res = await syncWithCloud();
    if (res.success) {
      setCloudFeedback({ type: 'success', message: 'تم حفظ ومزامنة كافة البيانات مع السيرفر السحابي بنجاح!' });
    } else {
      setCloudFeedback({ type: 'error', message: res.message || 'فشلت المزامنة مع السيرفر' });
    }
    setTimeout(() => setCloudFeedback(null), 4000);
  };

  const handlePullFromCloud = async () => {
    confirmAction({
      title: 'استرجاع وتحديث البيانات من السيرفر',
      message: 'سيتم جلب وتحديث كافة سجلات النظام (المشاريع، المصروفات، العهد) من السيرفر السحابي المركزي. هل ترغب في المتابعة؟',
      confirmText: 'تحديث من السيرفر',
      type: 'warning',
      onConfirm: async () => {
        const res = await loadFromCloud();
        if (res.success) {
          setCloudFeedback({ type: 'success', message: 'تم استرجاع وتحديث كافة البيانات من السيرفر بنجاح!' });
        } else {
          setCloudFeedback({ type: 'error', message: res.message || 'تعذر جلب البيانات من السيرفر' });
        }
        setTimeout(() => setCloudFeedback(null), 4000);
      }
    });
  };

  const handleCreateCloudBackup = async () => {
    setIsCreatingCloudSnapshot(true);
    try {
      const note = cloudBackupNote.trim() || `نسخة احتياطية بواسطة ${currentUser?.name || 'المدير'}`;
      const res = await createCloudSnapshot(note);
      if (res.success) {
        setCloudBackupNote('');
        setCloudFeedback({ type: 'success', message: 'تم حفظ نسخة احتياطية مؤرشفة على السيرفر السحابي بأمان!' });
        const list = await listCloudSnapshots();
        setCloudBackupsList(list);
      } else {
        setCloudFeedback({ type: 'error', message: 'فشل حفظ النسخة السحابية' });
      }
    } catch {
      setCloudFeedback({ type: 'error', message: 'حدث خطأ أثناء حفظ النسخة السحابية' });
    } finally {
      setIsCreatingCloudSnapshot(false);
      setTimeout(() => setCloudFeedback(null), 4000);
    }
  };

  const handleLoadCloudBackups = async () => {
    setIsLoadingCloudBackups(true);
    try {
      const list = await listCloudSnapshots();
      setCloudBackupsList(list);
      setIsCloudBackupsModalOpen(true);
    } catch {
      showAlert('خطأ', 'تعذر جلب النسخ من السيرفر السحابي.', 'error');
    } finally {
      setIsLoadingCloudBackups(false);
    }
  };

  const handleRestoreCloudSnapshot = async (backupId: string) => {
    confirmAction({
      title: 'تأكيد استرجاع النسخة السحابية المؤرشفة',
      message: 'سيتم استبدال بيانات النظام الحالية بالبيانات المحفوظة في هذه النسخة السحابية. هل أنت متأكد؟',
      confirmText: 'استرجاع النسخة الآن',
      type: 'danger',
      onConfirm: async () => {
        const ok = await restoreCloudSnapshot(backupId);
        if (ok) {
          setIsCloudBackupsModalOpen(false);
          setCloudFeedback({ type: 'success', message: 'تمت استعادة النسخة السحابية بنجاح!' });
        } else {
          setCloudFeedback({ type: 'error', message: 'فشل استرجاع النسخة السحابية' });
        }
        setTimeout(() => setCloudFeedback(null), 4000);
      }
    });
  };

  // Role Management State
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [roleModalSubTab, setRoleModalSubTab] = useState<'screens' | 'crud' | 'workflow' | 'basic'>('basic');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [roleNameError, setRoleNameError] = useState('');
  const [newRoleBadgeColor, setNewRoleBadgeColor] = useState('bg-indigo-100 text-indigo-800 border-indigo-300');
  const [newRolePermissions, setNewRolePermissions] = useState<RolePermission>({
    canViewAllProjects: false,
    canViewAllExpenses: false,
    canViewFinancialReports: false,
    canViewCustodies: false,
    canViewTeamMembers: false,
    canCreateExpense: true,
    canEditExpense: true,
    canDeleteExpense: false,
    canManageCustody: false,
    canManageProjects: false,
    canApproveAsProjectManager: false,
    canApproveAsAccountant: false,
    canExportToExternalERP: false,
    canApproveAsManagement: false,
    canBatchApprove: false,
    canManageRolesAndPermissions: false,
    canConfigureWorkflow: false,
    canExportExcelAndBackup: false,
    allowedScreens: ['dashboard', 'expenses', 'support'],
    expenseEditGraceMinutes: 30,
  });

  const getScreenIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard': return <LayoutDashboard className="w-4 h-4" />;
      case 'ReceiptText': return <ReceiptText className="w-4 h-4" />;
      case 'CheckCircle2': return <CheckCircle2 className="w-4 h-4" />;
      case 'Wallet': return <Wallet className="w-4 h-4" />;
      case 'Briefcase': return <Briefcase className="w-4 h-4" />;
      case 'Users': return <Users className="w-4 h-4" />;
      case 'FileSpreadsheet': return <FileSpreadsheet className="w-4 h-4" />;
      case 'Settings': return <Settings className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const openEditRoleModal = (role: CustomRole) => {
    const isManager = isExecutiveManagerRole(role);
    const allScreens = APP_SCREENS.map(s => s.id) as AppScreenId[];
    const allowed = isManager ? allScreens : (role.permissions.allowedScreens && role.permissions.allowedScreens.length > 0
      ? role.permissions.allowedScreens
      : allScreens);
    const grace = isManager ? 9999 : (role.permissions.expenseEditGraceMinutes !== undefined
      ? role.permissions.expenseEditGraceMinutes
      : (role.id === 'role_supervisor' || role.name.includes('مشرف') ? 30 : 9999));

    setEditingRole({
      ...role,
      permissions: {
        ...role.permissions,
        allowedScreens: allowed,
        expenseEditGraceMinutes: grace,
        ...(isManager ? {
          canViewAllProjects: true,
          canViewAllExpenses: true,
          canViewFinancialReports: true,
          canViewCustodies: true,
          canViewTeamMembers: true,
          canCreateExpense: true,
          canEditExpense: true,
          canDeleteExpense: true,
          canManageCustody: true,
          canManageProjects: true,
          canApproveAsProjectManager: true,
          canApproveAsAccountant: true,
          canExportToExternalERP: true,
          canApproveAsManagement: true,
          canBatchApprove: true,
          canManageRolesAndPermissions: true,
          canConfigureWorkflow: true,
          canExportExcelAndBackup: true,
        } : {})
      },
    });
    setRoleModalSubTab('screens');
  };

  const openNewRoleModal = () => {
    setEditingRole(null);
    setNewRoleName('');
    setNewRoleDescription('');
    setRoleNameError('');
    setNewRoleBadgeColor('bg-indigo-100 text-indigo-800 border-indigo-300');
    setNewRolePermissions({
      canViewAllProjects: false,
      canViewAllExpenses: false,
      canViewFinancialReports: false,
      canViewCustodies: false,
      canViewTeamMembers: false,
      canCreateExpense: true,
      canEditExpense: true,
      canDeleteExpense: false,
      canManageCustody: false,
      canManageProjects: false,
      canApproveAsProjectManager: false,
      canApproveAsAccountant: false,
      canExportToExternalERP: false,
      canApproveAsManagement: false,
      canBatchApprove: false,
      canManageRolesAndPermissions: false,
      canConfigureWorkflow: false,
      canExportExcelAndBackup: false,
      allowedScreens: ['dashboard', 'expenses', 'support'],
      expenseEditGraceMinutes: 30,
    });
    setRoleModalSubTab('basic');
    setIsNewRoleModalOpen(true);
  };

  const toggleScreenForActiveRole = (screenId: AppScreenId) => {
    if (editingRole) {
      // Sovereign protection: The Manager role has all screens permanently visible and cannot be hidden
      const isManager = isExecutiveManagerRole(editingRole);
      if (isManager) {
        showAlert(
          'صلاحية سيادية للمدير العام / التنفيذي',
          'كافة الشاشات مفتوحة وظاهرة للمدير العام ولا تقبل الخفاء أو الإلغاء، لكونه المتحكم في النظام ولضمان عدم حدوث إغلاق إداري واستمرار القدرة على تعديل الصلاحيات.',
          'info'
        );
        return;
      }

      const currentScreens = editingRole.permissions.allowedScreens || [];
      const newScreens = currentScreens.includes(screenId)
        ? currentScreens.filter(s => s !== screenId)
        : [...currentScreens, screenId];
      setEditingRole({
        ...editingRole,
        permissions: {
          ...editingRole.permissions,
          allowedScreens: newScreens,
        },
      });
    } else {
      const currentScreens = newRolePermissions.allowedScreens || [];
      const newScreens = currentScreens.includes(screenId)
        ? currentScreens.filter(s => s !== screenId)
        : [...currentScreens, screenId];
      setNewRolePermissions(prev => ({
        ...prev,
        allowedScreens: newScreens,
      }));
    }
  };

  const setAllScreensForActiveRole = (selectAll: boolean) => {
    if (editingRole) {
      const isManager = isExecutiveManagerRole(editingRole);
      if (isManager && !selectAll) {
        showAlert(
          'إلغاء التحديد محظور',
          'لا يمكن إخفاء شاشات المنظومة عن دور المدير العام / التنفيذي، حيث يمثل المتحكم الأعلى في النظام.',
          'warning'
        );
        return;
      }

      const allIds = selectAll ? (APP_SCREENS.map(s => s.id) as AppScreenId[]) : [];
      setEditingRole({
        ...editingRole,
        permissions: {
          ...editingRole.permissions,
          allowedScreens: isManager ? (APP_SCREENS.map(s => s.id) as AppScreenId[]) : allIds,
        },
      });
    } else {
      const allIds = selectAll ? (APP_SCREENS.map(s => s.id) as AppScreenId[]) : [];
      setNewRolePermissions(prev => ({
        ...prev,
        allowedScreens: allIds,
      }));
    }
  };

  const applyRolePreset = (preset: 'accountant' | 'supervisor' | 'financial_manager') => {
    if (editingRole && (editingRole.id === 'role_admin' || editingRole.name === 'مدير عام' || editingRole.name === 'مدير')) {
      showAlert(
        'دور المدير العام محمي رقابياً',
        'دور المدير العام يمتلك وصولاً كاملاً وشاملاً لجميع الشاشات والصلاحيات بصورة دائمة ولا يخضع للأنماط المحدودة.',
        'info'
      );
      return;
    }
    if (preset === 'accountant') {
      const screens: AppScreenId[] = ['dashboard', 'expenses', 'approvals', 'reports', 'support'];
      if (editingRole) {
        setEditingRole({
          ...editingRole,
          permissions: {
            ...editingRole.permissions,
            allowedScreens: screens,
            canCreateExpense: false,
            canEditExpense: false,
            canDeleteExpense: false,
            expenseEditGraceMinutes: 0,
            canApproveAsAccountant: true,
            canExportToExternalERP: true,
            canViewFinancialReports: true,
            canViewAllExpenses: true,
            canViewAllProjects: true,
            canBatchApprove: true,
          },
        });
      } else {
        setNewRolePermissions(prev => ({
          ...prev,
          allowedScreens: screens,
          canCreateExpense: false,
          canEditExpense: false,
          canDeleteExpense: false,
          expenseEditGraceMinutes: 0,
          canApproveAsAccountant: true,
          canExportToExternalERP: true,
          canViewFinancialReports: true,
          canViewAllExpenses: true,
          canViewAllProjects: true,
          canBatchApprove: true,
        }));
      }
    } else if (preset === 'supervisor') {
      const screens: AppScreenId[] = ['expenses', 'custodies', 'projects', 'support'];
      if (editingRole) {
        setEditingRole({
          ...editingRole,
          permissions: {
            ...editingRole.permissions,
            allowedScreens: screens,
            canCreateExpense: true,
            canEditExpense: true,
            canDeleteExpense: true,
            expenseEditGraceMinutes: 30,
            canApproveAsAccountant: false,
            canExportToExternalERP: false,
            canApproveAsManagement: false,
            canManageCustody: false,
          },
        });
      } else {
        setNewRolePermissions(prev => ({
          ...prev,
          allowedScreens: screens,
          canCreateExpense: true,
          canEditExpense: true,
          canDeleteExpense: true,
          expenseEditGraceMinutes: 30,
          canApproveAsAccountant: false,
          canExportToExternalERP: false,
          canApproveAsManagement: false,
          canManageCustody: false,
        }));
      }
    } else if (preset === 'financial_manager') {
      const screens = APP_SCREENS.map(s => s.id);
      if (editingRole) {
        setEditingRole({
          ...editingRole,
          permissions: {
            ...editingRole.permissions,
            allowedScreens: screens,
            canCreateExpense: true,
            canEditExpense: true,
            canDeleteExpense: true,
            expenseEditGraceMinutes: 9999,
            canApproveAsAccountant: true,
            canApproveAsManagement: true,
            canExportToExternalERP: true,
            canManageCustody: true,
            canManageProjects: true,
            canViewFinancialReports: true,
            canViewAllExpenses: true,
            canViewAllProjects: true,
            canBatchApprove: true,
            canExportExcelAndBackup: true,
          },
        });
      } else {
        setNewRolePermissions(prev => ({
          ...prev,
          allowedScreens: screens,
          canCreateExpense: true,
          canEditExpense: true,
          canDeleteExpense: true,
          expenseEditGraceMinutes: 9999,
          canApproveAsAccountant: true,
          canApproveAsManagement: true,
          canExportToExternalERP: true,
          canManageCustody: true,
          canManageProjects: true,
          canViewFinancialReports: true,
          canViewAllExpenses: true,
          canViewAllProjects: true,
          canBatchApprove: true,
          canExportExcelAndBackup: true,
        }));
      }
    }
  };

  // Workflow Stage Management State
  const [editingStage, setEditingStage] = useState<WorkflowStage | null>(null);
  const [isNewStageModalOpen, setIsNewStageModalOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageDescription, setNewStageDescription] = useState('');
  const [newStageRoleId, setNewStageRoleId] = useState(roles[0]?.id || 'role_supervisor');
  const [newStageRequiresErp, setNewStageRequiresErp] = useState(false);
  const [newStageMinAmount, setNewStageMinAmount] = useState<number>(0);

  // Save General Settings
  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      companyName,
      companySubtitle,
      companyLogo,
      defaultLogoPosition,
      defaultLogoSize,
      currencySymbol,
      lowBalanceThreshold: Number(lowBalanceThreshold) || 10000,
      editGracePeriodMinutes: Number(editGracePeriodMinutes) || 30,
      telegramRecipient,
      whatsappRecipient,
      autoGpsCapture,
      securityPin: securityPin.trim() || undefined,
      customCategories: categories,
      pcloudPublicFolderUrl: pcloudPublicFolderUrl.trim(),
      pcloudBackupFolderUrl: pcloudBackupFolderUrl.trim(),
      googleDriveAccessToken: googleDriveAccessToken.trim(),
      googleDriveRefreshToken: googleDriveRefreshToken.trim(),
      googleDriveClientId: googleDriveClientId.trim(),
      googleDriveClientSecret: googleDriveClientSecret.trim(),
      googleDriveFolderId: googleDriveFolderId.trim(),
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleUpdateLogoDirectly = (newLogo: string) => {
    setCompanyLogo(newLogo);
    updateSettings({ companyLogo: newLogo });
  };

  const handleUpdateLogoPositionDirectly = (newPos: LogoPosition) => {
    setDefaultLogoPosition(newPos);
    updateSettings({ defaultLogoPosition: newPos });
  };

  const handleUpdateLogoSizeDirectly = (newSize: LogoSize) => {
    setDefaultLogoSize(newSize);
    updateSettings({ defaultLogoSize: newSize });
  };

  const handleAddCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed) {
      setCatFeedback({ type: 'error', message: 'يرجى كتابة اسم البند المراد إضافته في الحقل أولاً.' });
      return;
    }
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setCatFeedback({ type: 'error', message: `البند "${trimmed}" موجود بالفعل في قائمة التصنيفات.` });
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    setNewCat('');
    updateSettings({ customCategories: updated });
    setCatFeedback({ type: 'success', message: `تمت إضافة بند "${trimmed}" بنجاح وإتاحته في كافة نماذج المصروفات.` });
    setTimeout(() => {
      setCatFeedback(prev => (prev?.message.includes(trimmed) ? null : prev));
    }, 3500);
  };

  const handleStartEditCategory = (cat: string) => {
    setEditingCat({ oldName: cat, newName: cat });
    setCatFeedback(null);
  };

  const handleSaveEditCategory = () => {
    if (!editingCat) return;
    const { oldName, newName } = editingCat;
    const result = renameCategory(oldName, newName);
    if (!result.success) {
      setCatFeedback({ type: 'error', message: result.message });
      return;
    }
    setEditingCat(null);
    setCatFeedback({
      type: 'success',
      message: result.message,
    });
    setTimeout(() => setCatFeedback(null), 4000);
  };

  const handleCancelEditCategory = () => {
    setEditingCat(null);
  };

  const handleRemoveCategory = (cat: string) => {
    const usageCount = getCategoryUsageCount(cat);
    if (usageCount > 0) {
      confirmAction({
        title: 'لا يمكن حذف هذا البند',
        message: `البند "${cat}" مسجل عليه (${usageCount}) عملية صرف سابقة. حفاظاً على دقة القيود المحاسبية، لا يمكن حذفه، ولكن يمكنك تعديل اسمه ليتم تحديثه في كافة السجلات السابقة تلقائياً.`,
        type: 'warning',
        confirmText: 'تعديل اسم البند',
        cancelText: 'إلغاء',
        onConfirm: () => {
          handleStartEditCategory(cat);
        }
      });
      return;
    }

    confirmAction({
      title: 'تأكيد حذف بند المصروف',
      message: `هل أنت متأكد من حذف بند "${cat}" من قائمة التصنيفات؟`,
      confirmText: 'نعم، حذف البند',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: () => {
        const result = deleteCategory(cat);
        if (!result.success) {
          showAlert('تعذر الحذف', result.message, 'warning');
        } else {
          setCatFeedback({ type: 'success', message: result.message });
          setTimeout(() => setCatFeedback(null), 3000);
        }
      }
    });
  };

  const handleResetDefaultCategories = () => {
    confirmAction({
      title: 'استعادة البنود الافتراضية',
      message: 'هل أنت متأكد من إعادة تعيين قائمة بنود المصروفات إلى القائمة القياسية المعتمدة؟',
      type: 'warning',
      confirmText: 'استعادة البنود',
      cancelText: 'إلغاء',
      onConfirm: () => {
        const defaults = [
          'عمالة',
          'مصروفات بفواتير ضريبية',
          'اعمال على',
          'مقاولين',
          'المالك',
          'رواتب',
          'نثريات ومشتريات',
          'نقل ومحروقات',
          'صيانة ومعدات',
          'مواد بناء'
        ];
        setCategories(defaults);
        updateSettings({ customCategories: defaults });
        setCatFeedback({ type: 'success', message: 'تمت استعادة قائمة بنود التصنيفات الافتراضية بنجاح.' });
        setTimeout(() => setCatFeedback(null), 3000);
      }
    });
  };

  // Roles CRUD
  const handleCreateRole = async () => {
    const trimmedName = newRoleName.trim();
    if (!trimmedName) {
      setRoleModalSubTab('basic');
      setRoleNameError('يرجى كتابة اسم الدور الوظيفي أولاً لحفظ الدور.');
      showAlert('بيانات مطلوبة', 'يرجى كتابة اسم الدور الوظيفي في حقل (اسم الدور الوظيفي) قبل المتابعة.', 'warning');
      setTimeout(() => {
        const input = document.getElementById('new-role-name-input-top') || document.getElementById('new-role-name-input');
        input?.focus();
      }, 100);
      return;
    }
    setRoleNameError('');
    try {
      const created = await addRole({
        name: trimmedName,
        description: newRoleDescription.trim() || 'دور وظيفي مخصص',
        badgeColor: newRoleBadgeColor,
        permissions: newRolePermissions,
      });
      setIsNewRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      showAlert('تم إنشاء الدور بنجاح', `تمت إضافة الدور الوظيفي "${created.name}" وتخصيص صلاحياته بنجاح، ويمكنك الآن إسناده للمستخدمين أو ربطه بمراحل الاعتماد.`, 'success');
    } catch (err: any) {
      showAlert('خطأ', err?.message || 'حدث خطأ أثناء حفظ الدور الوظيفي.', 'error');
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;
    const trimmedName = editingRole.name.trim();
    if (!trimmedName) {
      setRoleModalSubTab('basic');
      setRoleNameError('يرجى كتابة اسم الدور الوظيفي.');
      showAlert('بيانات مطلوبة', 'يرجى كتابة اسم الدور الوظيفي.', 'warning');
      return;
    }
    setRoleNameError('');
    const isManagerRole = isExecutiveManagerRole(editingRole);
    const allScreens = APP_SCREENS.map(s => s.id) as AppScreenId[];

    const finalPermissions = isManagerRole
      ? {
          ...editingRole.permissions,
          allowedScreens: allScreens,
          canViewAllProjects: true,
          canViewAllExpenses: true,
          canViewFinancialReports: true,
          canViewCustodies: true,
          canViewTeamMembers: true,
          canCreateExpense: true,
          canEditExpense: true,
          canDeleteExpense: true,
          expenseEditGraceMinutes: 9999,
          canManageCustody: true,
          canManageProjects: true,
          canApproveAsProjectManager: true,
          canApproveAsAccountant: true,
          canExportToExternalERP: true,
          canApproveAsManagement: true,
          canBatchApprove: true,
          canManageRolesAndPermissions: true,
          canConfigureWorkflow: true,
          canExportExcelAndBackup: true,
        }
      : editingRole.permissions;

    await updateRole(editingRole.id, {
      name: isManagerRole ? 'مدير تنفيذي أو مدير عام / إدارة عليا' : trimmedName,
      description: editingRole.description,
      badgeColor: editingRole.badgeColor,
      permissions: finalPermissions,
    });
    setEditingRole(null);
    showAlert('تم حفظ التعديلات', `تم تحديث وحفظ إعدادات وصلاحيات الدور "${editingRole.name}" بنجاح.`, 'success');
  };

  const handleDeleteRole = (id: string, name: string) => {
    if (isExecutiveManagerRole({ id, name })) {
      showAlert('إجراء محظور رقابياً', 'لا يمكن حذف دور المدير التنفيذي / العام نهائياً لأنه الحساب المتحكم في النظام.', 'error');
      return;
    }
    if (id === 'role_accountant' || id === 'role_supervisor' || name.includes('محاسب') || name.includes('مشرف')) {
      showAlert('إجراء محظور رقابياً', 'هذا الدور من الأدوار الأساسية الثلاثة للنظام ولا يمكن حذفه للحفاظ على تكامل الصلاحيات.', 'warning');
      return;
    }
    confirmAction({
      title: 'تأكيد حذف الدور الوظيفي',
      message: `هل أنت متأكد من حذف الدور (${name})؟`,
      type: 'danger',
      confirmText: 'نعم، حذف الدور',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        await deleteRole(id);
      }
    });
  };

  // Workflow Stage CRUD
  const handleCreateStage = async () => {
    if (!newStageTitle.trim()) {
      showAlert('بيانات مطلوبة', 'يرجى كتابة عنوان مرحلة الاعتماد.', 'warning');
      return;
    }
    const selectedRole = roles.find(r => r.id === newStageRoleId) || roles[0];
    const roleIdToUse = newStageRoleId || selectedRole?.id || 'role_supervisor';
    const roleNameToUse = selectedRole?.name || 'مشرف موقع';

    await addWorkflowStage({
      title: newStageTitle.trim(),
      description: newStageDescription.trim() || '',
      roleId: roleIdToUse,
      requiredRoleId: roleIdToUse,
      requiredRoleName: roleNameToUse,
      order: workflowStages.length + 1,
      requiresExternalErpPosting: newStageRequiresErp,
      minAmountThreshold: Number(newStageMinAmount) || undefined,
      isActive: true,
    });
    setIsNewStageModalOpen(false);
    setNewStageTitle('');
    setNewStageDescription('');
    setNewStageRequiresErp(false);
    setNewStageMinAmount(0);
    showAlert('تمت الإضافة بنجاح', `تمت إضافة مرحلة الاعتماد "${newStageTitle.trim()}" إلى مسار دورة الاعتماد بالتسلسل المحدد.`, 'success');
  };

  const handleUpdateStage = async () => {
    if (!editingStage) return;
    if (!editingStage.title.trim()) {
      showAlert('بيانات مطلوبة', 'يرجى إدخال عنوان مرحلة الاعتماد.', 'warning');
      return;
    }
    const roleIdToUse = editingStage.roleId || editingStage.requiredRoleId || roles[0]?.id || 'role_supervisor';
    const selectedRole = roles.find(r => r.id === roleIdToUse);
    const roleNameToUse = selectedRole?.name || editingStage.requiredRoleName || 'الدور المعتمد';

    await updateWorkflowStage(editingStage.id, {
      title: editingStage.title.trim(),
      description: editingStage.description?.trim() || '',
      roleId: roleIdToUse,
      requiredRoleId: roleIdToUse,
      requiredRoleName: roleNameToUse,
      requiresExternalErpPosting: Boolean(editingStage.requiresExternalErpPosting),
      minAmountThreshold: editingStage.minAmountThreshold ? Number(editingStage.minAmountThreshold) : undefined,
      isActive: editingStage.isActive !== false,
    });
    setEditingStage(null);
    showAlert('تم حفظ التعديلات', `تم تحديث بيانات مرحلة الاعتماد "${editingStage.title.trim()}" بنجاح.`, 'success');
  };

  const handleMoveStage = async (index: number, direction: 'up' | 'down') => {
    const newStages = [...workflowStages];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newStages.length) return;

    const temp = newStages[index];
    newStages[index] = newStages[targetIdx];
    newStages[targetIdx] = temp;
    await reorderWorkflowStages(newStages);
    showAlert('تم تعديل الترتيب التسلسلي', `تم نقل مرحلة (${temp.title}) ${direction === 'up' ? 'للأعلى (أولوية أسبق)' : 'للأسفل'} بنجاح. الاعتماد يسير من الأعلى إلى الأسفل.`, 'success');
  };

  const handleDeleteStage = (id: string, title: string) => {
    if (workflowStages.length <= 1) {
      showAlert('تنبيه', 'يجب أن تحتوي دورة الاعتماد على مرحلة واحدة نشطة على الأقل.', 'warning');
      return;
    }
    confirmAction({
      title: 'تأكيد حذف مرحلة الاعتماد',
      message: `هل أنت متأكد من حذف مرحلة الاعتماد (${title})؟ سيتم إعادة ترقيم المراحل المتبقية تلقائياً من الأعلى إلى الأسفل.`,
      type: 'danger',
      confirmText: 'نعم، حذف المرحلة',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        await deleteWorkflowStage(id);
        showAlert('تم حذف المرحلة', `تم حذف مرحلة (${title}) بنجاح وتحديث التسلسل الهرمي.`, 'success');
      }
    });
  };

  // Backup / Import Handlers
  const handleExportJSON = () => {
    try {
      const res = downloadBackup();
      showAlert(
        'تم تصدير النسخة الاحتياطية بنجاح',
        `تم تنزيل ملف النسخة الاحتياطية الشاملة على جهازك (${res.filename}).\nيتضمن الملف: ${res.stats.projectsCount} مشروع، ${res.stats.expensesCount} مصروف، ${res.stats.custodiesCount} عهدة مالية، ${res.stats.usersCount} مستخدم.`,
        'success'
      );
    } catch {
      showAlert('خطأ في التصدير', 'حدث خطأ أثناء محاولة إنشاء وتنزيل ملف النسخة الاحتياطية.', 'error');
    }
  };

  const handleExportExcel = () => {
    try {
      exportAllToExcel();
      showAlert(
        'تم تصدير حزمة إكسل المتكاملة',
        'تم توليد وتحميل مصنف إكسل الشامل المكون من 7 أوراق عمل تشمل: المصروفات، العهد المسلمة، أرصدة المشرفين، المشاريع، المستخدمين، الأدوار، وبيانات التصدير.',
        'success'
      );
    } catch {
      showAlert('خطأ في التصدير', 'حدث خطأ أثناء تصدير ملف إكسل.', 'error');
    }
  };

  // Daily Backup to pCloud & Local Server Disk state
  const [dailyBackupEnabled, setDailyBackupEnabled] = useState(
    settings.dailyBackupEnabled !== false
  );
  const [isSendingDailyBackup, setIsSendingDailyBackup] = useState(false);
  const [dailyBackupStatus, setDailyBackupStatus] = useState<any>(null);
  const [isLoadingDailyStatus, setIsLoadingDailyStatus] = useState(false);

  // pCloud Daily Backup Link State (Direct Upload without passwords)
  const [pcloudBackupFolderUrl, setPcloudBackupFolderUrl] = useState<string>(
    settings.pcloudBackupFolderUrl || settings.pcloudPublicFolderUrl || ''
  );
  const [pcloudAccessToken, setPcloudAccessToken] = useState<string>(
    settings.pcloudAccessToken || ''
  );
  const [showPCloudTokenField, setShowPCloudTokenField] = useState(false);
  const [isTestingPCloudBackup, setIsTestingPCloudBackup] = useState(false);
  const [pcloudBackupTestMsg, setPcloudBackupTestMsg] = useState<string>('');
  const [pcloudBackupTestSuccess, setPcloudBackupTestSuccess] = useState<boolean | null>(null);
  const [isUploadingPCloudBackup, setIsUploadingPCloudBackup] = useState(false);

  useEffect(() => {
    if (activeTab === 'backup') {
      setIsLoadingDailyStatus(true);
      getDailyBackupStatus()
        .then(res => {
          if (res?.status) setDailyBackupStatus(res.status);
        })
        .finally(() => setIsLoadingDailyStatus(false));
    }
  }, [activeTab]);

  const handleSaveDailyBackupSettings = () => {
    const pcloudUrlToSave = pcloudBackupFolderUrl.trim();
    const tokenToSave = pcloudAccessToken.trim();
    updateSettings({
      dailyBackupEnabled,
      pcloudBackupFolderUrl: pcloudUrlToSave,
      pcloudAccessToken: tokenToSave
    });
    showAlert(
      'تم حفظ إعدادات النسخ الاحتياطي',
      `تم تحديث الإعدادات بنجاح${pcloudUrlToSave ? ' • تم حفظ رابط مجلد pCloud' : ''}.`,
      'success'
    );
  };

  const handleTestPCloudBackupLink = async () => {
    const url = pcloudBackupFolderUrl.trim();
    if (!url) {
      setPcloudBackupTestSuccess(false);
      setPcloudBackupTestMsg('يرجى إدخال رابط مجلد pCloud أولاً (رابط طلب ملفات File Request أو رابط المشاركة).');
      return;
    }

    setIsTestingPCloudBackup(true);
    setPcloudBackupTestMsg('جاري التحقق من الرابط والاتصال بسحابة pCloud...');
    setPcloudBackupTestSuccess(null);

    try {
      const res = await testPCloudUploadLink(url);
      if (res.success && res.isUploadLink) {
        setPcloudBackupTestSuccess(true);
        setPcloudBackupTestMsg(res.message || `تم التحقق بنجاح! مجلد الاستقبال: ${res.folderName || 'pCloud Folder'}`);
        updateSettings({ pcloudBackupFolderUrl: url });
      } else if (res.isPubLink) {
        setPcloudBackupTestSuccess(false);
        setPcloudBackupTestMsg(res.message || 'هذا الرابط هو رابط مشاركة للعرض والتنزيل فقط (Share Link). يلزم استخدام رابط طلب ملفات (Request files) للرفع.');
        showAlert(
          'تنبيه: نوع الرابط مخصص للتنزيل وليس للرفع',
          res.message || 'الرابط المدخل هو رابط مشاركة (Share link). موقع pCloud يمنع الرفع عبر روابط المشاركة لحماية المجلد.\n\nالحل البسيط:\n1. افتح pCloud واضغط على خيارات المجلد (...)\n2. اختر "Request files (طلب ملفات)" وليس Share link\n3. انسخ الرابط والصقه هنا.',
          'warning'
        );
      } else {
        setPcloudBackupTestSuccess(false);
        setPcloudBackupTestMsg(res.error || 'تعذر التحقق من الرابط في pCloud.');
      }
    } catch (err: any) {
      setPcloudBackupTestSuccess(false);
      setPcloudBackupTestMsg(err?.message || 'خطأ في الاتصال بسيرفر pCloud.');
    } finally {
      setIsTestingPCloudBackup(false);
    }
  };

  const handleUploadToPCloudNow = async () => {
    const url = pcloudBackupFolderUrl.trim();
    if (!url) {
      showAlert('تنبيه', 'يرجى لصق رابط مجلد pCloud أولاً للرفع إليه.', 'warning');
      return;
    }

    setIsUploadingPCloudBackup(true);
    try {
      const res = await uploadDailyBackupToPCloud(url);
      if (res.success) {
        showAlert(
          'تم الرفع إلى pCloud بنجاح',
          res.message || 'تم رفع حزمة إكسل والنسخة الاحتياطية بنجاح إلى مجلد pCloud السحابي الخاص بك!',
          'success'
        );
        const statusRes = await getDailyBackupStatus();
        if (statusRes?.status) setDailyBackupStatus(statusRes.status);
      } else if (res.isPubLink) {
        showAlert(
          'تنبيه بخصوص نوع رابط pCloud',
          res.error || res.message || 'الرابط الذي قمت بلصقه هو رابط مشاركة وتنزيل فقط (Share Link). موقع pCloud يمنع رفع الملفات عبر روابط المشاركة لحماية بيانات المجلد.\n\nلحل المشكلة:\n1. في موقع pCloud، اضغط على خيارات المجلد (...).\n2. اختر "Request files (طلب ملفات)" وليس Share folder.\n3. انسخ الرابط الذي سيظهر والصقه هنا وسيعمل الرفع فورياً بدون كلمة سر.',
          'warning'
        );
      } else {
        showAlert('خطأ أثناء الرفع إلى pCloud', res.message || res.error || 'فشل رفع الملفات إلى pCloud.', 'error');
      }
    } catch (err: any) {
      showAlert('خطأ', err?.message || 'تعذر رفع النسخة الاحتياطية إلى pCloud.', 'error');
    } finally {
      setIsUploadingPCloudBackup(false);
    }
  };

  const handleSendDailyBackupNow = async () => {
    setIsSendingDailyBackup(true);
    try {
      const pcloudUrl = pcloudBackupFolderUrl.trim();
      const res = await runDailyBackup(pcloudUrl);
      if (res.success) {
        if (res.pcloudUploaded) {
          showAlert(
            'تم الرفع بنجاح إلى pCloud',
            `تم توليد حزمة مصنف إكسل والنسخة الاحتياطية ورفعهما تلقائياً إلى مجلد pCloud السحابي وحفظهما على الخادم بنجاح!`,
            'success'
          );
        } else {
          showAlert(
            'تم حفظ النسخة اليومية بنجاح على السيرفر',
            res.message || 'تم تجهيز وحفظ حزمة مصنف إكسل والنسخة الاحتياطية بنجاح على الخادم.',
            'info'
          );
        }
        const statusRes = await getDailyBackupStatus();
        if (statusRes?.status) setDailyBackupStatus(statusRes.status);
      } else {
        showAlert('تنبيه', res.message || 'فشل تنفيذ النسخ الاحتياطي اليومي.', 'error');
      }
    } catch (err: any) {
      showAlert('خطأ', err?.message || 'تعذر تنفيذ النسخة الاحتياطية اليومية.', 'error');
    } finally {
      setIsSendingDailyBackup(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const csvData = expenses.map(e => ({
        'رقم السند': e.id,
        'التاريخ': e.date,
        'المشروع': e.projectName,
        'المشرف': e.supervisorName,
        'البند': e.category,
        'البيان': e.details,
        'المبلغ': e.amount,
        'الضريبة': e.taxAmount || 0,
        'الحالة': e.status,
        'الفاتورة': e.invoiceNumber || '-',
      }));
      StorageService.exportToCSV(csvData, `سندات_المصروفات_${new Date().toISOString().slice(0, 10)}.csv`);
      showAlert('تم تصدير ملف CSV', 'تم تصدير وتنزيل كشف سندات المصروفات بصيغة CSV بنجاح.', 'success');
    } catch {
      showAlert('خطأ في التصدير', 'تعذر تصدير ملف CSV.', 'error');
    }
  };

  const processBackupFile = (file: File) => {
    const fileNameLower = file.name.toLowerCase();
    const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');
    const isJson = fileNameLower.endsWith('.json');

    if (!isJson && !isExcel) {
      showAlert('صيغة غير مدعومة', 'يرجى اختيار ملف نسخة احتياطية بصيغة JSON (.json) أو مصنف إكسل (.xlsx / .xls).', 'warning');
      return;
    }

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const buffer = ev.target?.result as ArrayBuffer;
          const validation = validateBackupExcel(buffer);
          if (!validation.isValid || !validation.data) {
            showAlert(
              'ملف غير صالح',
              validation.error || 'تعذر استخراج بيانات النسخة الاحتياطية من مصنف إكسيل المختار.',
              'error'
            );
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          setBackupValidationModal({
            isOpen: true,
            fileName: file.name,
            fileSizeKb: validation.stats?.fileSizeKb || Math.round(file.size / 1024),
            stats: validation.stats,
            data: validation.data,
            mode: 'replace',
          });
        } catch (err: any) {
          showAlert('خطأ في قراءة الملف', err?.message || 'حدث خطأ غير متوقع أثناء معالجة ملف إكسيل.', 'error');
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const validation = validateBackup(content);
        if (!validation.isValid || !validation.data) {
          showAlert(
            'ملف غير صالح',
            validation.error || 'الملف المختار تالف أو لا يتطابق مع بنية النسخ الاحتياطي لنظام SkyArc.',
            'error'
          );
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setBackupValidationModal({
          isOpen: true,
          fileName: file.name,
          fileSizeKb: validation.stats?.fileSizeKb || Math.round(file.size / 1024),
          stats: validation.stats,
          data: validation.data,
          mode: 'replace',
        });
      } catch {
        showAlert('خطأ في قراءة الملف', 'حدث خطأ غير متوقع أثناء معالجة ملف النسخة الاحتياطية.', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processBackupFile(file);
    }
  };

  const handleConfirmImport = () => {
    if (!backupValidationModal?.data) return;

    try {
      const mode = backupValidationModal.mode;
      const success = importBackupData(backupValidationModal.data, mode);
      if (success) {
        const stats = backupValidationModal.stats;
        showAlert(
          'تمت استعادة البيانات بنجاح',
          mode === 'replace'
            ? `تم استبدال واسترجاع كافة سجلات المنظومة بنجاح (${stats?.projectsCount || 0} مشروع، ${stats?.expensesCount || 0} مصروف، ${stats?.custodiesCount || 0} عهدة، ${stats?.usersCount || 0} مستخدم).`
            : `تم دمج وتحديث سجلات المنظومة بنجاح بدون حذف أي سجلات سابقة.`,
          'success'
        );
        setBackupValidationModal(null);
      } else {
        showAlert('خطأ في الاستيراد', 'تعذر تطبيق محتويات النسخة الاحتياطية على قاعدة البيانات.', 'error');
      }
    } catch {
      showAlert('خطأ غير متوقع', 'حدث خطأ أثناء محاولة استرجاع البيانات.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              لوحة التحكم والإعدادات المتقدمة
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              إدارة الصلاحيات والأدوار (RBAC)، مسار دورة الاعتماد، والربط المحاسبي السحابي
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="px-3.5 py-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>تم حفظ كافة الإعدادات بنجاح</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>الإعدادات العامة والسياسات</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'roles'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>الأدوار والصلاحيات (RBAC)</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">
            {roles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'workflow'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>دورة الاعتماد والمراحل</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">
            {workflowStages.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('erp')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'erp'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>الربط مع البرامج المحاسبية (ERP)</span>
        </button>

        <button
          onClick={() => setActiveTab('archive')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'archive'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>أرشفة المصروفات والسنوات السابقة</span>
          {archivedExpenses.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-mono">
              {archivedExpenses.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'backup'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>النسخ الاحتياطي والاستعادة</span>
        </button>
      </div>

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6 animate-in fade-in">
          
          {/* Visual Appearance & Theme (Per-User Isolated Theme) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Moon className="w-4 h-4 text-emerald-600" />
                <span>المظهر والوضع الليلي لراحة العين</span>
              </h3>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>إعداد شخصي مستقل لحسابك فقط</span>
              </span>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              يتم حفظ الوضع المختار لحسابك الحالي (<strong className="text-slate-800 dark:text-slate-200">{currentUser?.name || currentUser?.username}</strong>) بشكل مستقل تماماً على جهازك دون التأثير على إعدادات أو شاشات باقي المستخدمين في المنظومة.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Mode */}
              <div
                onClick={() => setTheme('light')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  theme === 'light'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">الوضع النهاري</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">مريح تحت أشعة الشمس</p>
                  </div>
                </div>
                {theme === 'light' && <Check className="w-5 h-5 text-emerald-600" />}
              </div>

              {/* Dark Mode */}
              <div
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  theme === 'dark'
                    ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">الوضع الليلي</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">تقليل إجهاد العين</p>
                  </div>
                </div>
                {theme === 'dark' && <Check className="w-5 h-5 text-emerald-500" />}
              </div>

              {/* System / Auto Mode */}
              <div
                onClick={() => setTheme('system')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  theme === 'system'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">تلقائي (حسب الجهاز)</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">يتكيف مع نظام جهازك</p>
                  </div>
                </div>
                {theme === 'system' && <Check className="w-5 h-5 text-emerald-600" />}
              </div>
            </div>
          </div>

          {/* Company Branding & Logo Section */}
          <CompanyLogoManager
            companyLogo={companyLogo}
            onChangeLogo={handleUpdateLogoDirectly}
            defaultPosition={defaultLogoPosition}
            onChangePosition={handleUpdateLogoPositionDirectly}
            defaultSize={defaultLogoSize}
            onChangeSize={handleUpdateLogoSizeDirectly}
            companyName={companyName}
            companySubtitle={companySubtitle}
            currencySymbol={currencySymbol}
          />

          {/* Built-in Cloud Database Storage Notice */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-6 rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  التخزين السحابي المدمج لقاعدة البيانات (Built-in Cloud Storage)
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  يعمل التطبيق على تخزين ومزامنة كافة المرفقات والبيانات سحابياً عبر قاعدة بيانات التطبيق المركزية.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
              يتم حفظ صور الفواتير والمستندات مباشرة مع كل سند مصروف، ويراها جميع المستخدمين الآخرين لحظياً وبشكل آمن ومستقر دون أي انقطاع.
            </p>
          </div>

          {/* pCloud Public Folder Integration Section */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-sky-200 dark:border-sky-800/60 shadow-sm space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>مجلد سحابة pCloud العام الافتراضي (pCloud Public Folder)</span>
                    <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                      مستعرض المرفقات
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ربط مجلد صور الفواتير والمستندات عبر رابط مشاركة pCloud العام للاختيار المباشر أثناء تسجيل المصروفات.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestPCloudConnection}
                disabled={pcloudTestStatus === 'testing' || !pcloudPublicFolderUrl.trim()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {pcloudTestStatus === 'testing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الفحص...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>اختبار والتحقق من الرابط</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                رابط المجلد المشترك من pCloud (Public Folder Share Link)
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={pcloudPublicFolderUrl}
                  onChange={e => {
                    setPcloudPublicFolderUrl(e.target.value);
                    if (pcloudTestStatus !== 'idle') setPcloudTestStatus('idle');
                  }}
                  placeholder="https://u.pcloud.link/publink/show?code=XZ... أو https://e.pcloud.link/publink/show?code=..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                💡 للحصول على الرابط: ادخل إلى حسابك في pCloud ➔ انقر بزر الماوس الأيمن على مجلد الصور/الفواتير ➔ اختر <strong className="text-slate-600 dark:text-slate-300">Share Link</strong> ثم انسخ الرابط والصقه هنا.
              </p>
            </div>

            {pcloudTestMessage && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 ${
                  pcloudTestStatus === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : pcloudTestStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                }`}
              >
                {pcloudTestStatus === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : pcloudTestStatus === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                ) : (
                  <RefreshCw className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400 animate-spin" />
                )}
                <span>{pcloudTestMessage}</span>
              </div>
            )}
          </div>

          {/* Business & Field Rules */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>السياسات المالية والرقابية</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم المنشأة / المؤسسة
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان الفرعي / الوصف
                </label>
                <input
                  type="text"
                  value={companySubtitle}
                  onChange={e => setCompanySubtitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  رمز العملة المعتمدة
                </label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={e => setCurrencySymbol(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  حد إنذار العهدة المنخفضة ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={lowBalanceThreshold}
                  onChange={e => setLowBalanceThreshold(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">يطلق النظام تنبيهاً ذكياً عند انخفاض رصيد المشرف عن هذا الحد.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  مهلة التعديل المسموحة للمشرف (بالدقائق)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={editGracePeriodMinutes}
                  onChange={e => setEditGracePeriodMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">قاعدة الـ 30 دقيقة: بعد انقضائها تُقفل الفاتورة للاعتماد المحاسبي فقط.</p>
              </div>

              {/* WhatsApp Recipient for Custody Requests */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>رقم واتساب الإدارة / المدير (لاستقبال طلبات تعزيز العهدة)</span>
                  </label>
                  {whatsappRecipient && (
                    <button
                      type="button"
                      onClick={() => {
                        const clean = WhatsAppService.cleanPhoneNumber(whatsappRecipient);
                        const testUrl = `https://wa.me/${clean}?text=${encodeURIComponent('تجربة اتصال بنظام العهد والمصروفات عبر واتساب.')}`;
                        window.open(testUrl, '_blank');
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>تجربة محادثة واتساب</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={whatsappRecipient}
                    onChange={e => setWhatsappRecipient(e.target.value)}
                    placeholder="+966 50 123 4567 أو 0501234567"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  رقم الواتساب الذي يتم توجيه رسائل المشرفين إليه تلقائياً عند النقر على "طلب تعزيز عهدة" في لوحة التحكم والشريط الجانبي.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  رمز الحماية السري (PIN Code)
                </label>
                <input
                  type="password"
                  value={securityPin}
                  onChange={e => setSecurityPin(e.target.value)}
                  placeholder="1234 (اختياري)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGpsCapture}
                  onChange={e => setAutoGpsCapture(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>التقاط إحداثيات الموقع الجغرافي الميداني (GPS) تلقائياً عند تسجيل أي فاتورة</span>
              </label>
            </div>
          </div>

          {/* Custom Categories Manager */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>إدارة بنود وتصنيفات المصروفات المخصصة ({categories.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  البنود المسجل عليها عمليات صرف محمية من الحذف للحفاظ على سلامة التقارير المحاسبية، وتعديل الاسم يحدّث كافة المصروفات السابقة تلقائياً.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetDefaultCategories}
                className="text-[11px] font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700"
                title="استعادة البنود القياسية المعتمدة"
              >
                <RefreshCw className="w-3 h-3" />
                <span>استعادة البنود الافتراضية</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="input-new-category"
                type="text"
                placeholder="أدخل اسم بند جديد ثم اضغط إضافة أو Enter (مثال: محروقات وديزل)..."
                value={newCat}
                onChange={e => {
                  setNewCat(e.target.value);
                  if (catFeedback) setCatFeedback(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                className={`flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                  catFeedback?.type === 'error'
                    ? 'border-rose-400 ring-2 ring-rose-400/20'
                    : 'border-slate-200 dark:border-slate-700'
                } text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`}
              />
              <button
                id="btn-add-category"
                type="button"
                onClick={handleAddCategory}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة البند</span>
              </button>
            </div>

            {catFeedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 ${
                  catFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : catFeedback.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {catFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : catFeedback.type === 'warning' ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{catFeedback.message}</span>
              </div>
            )}

            {/* Editing Category Active Banner */}
            {editingCat && (
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    <Pencil className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>تعديل مسمى البند: <strong className="text-slate-900 dark:text-white font-mono">"{editingCat.oldName}"</strong></span>
                  </div>
                  <span className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-lg font-medium">
                    مسجل عليه ({getCategoryUsageCount(editingCat.oldName)}) عملية صرف
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingCat.newName}
                    onChange={e => setEditingCat({ ...editingCat, newName: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEditCategory();
                      } else if (e.key === 'Escape') {
                        handleCancelEditCategory();
                      }
                    }}
                    placeholder="الاسم الجديد للبند..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveEditCategory}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>تحديث وتطبيق</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditCategory}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
                <p className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                  💡 ملاحظة: عند حفظ الاسم الجديد، سيتم تحديث جميع الفواتير والمصروفات ({getCategoryUsageCount(editingCat.oldName)}) المسجلة مسبقاً بهذا البند فوراً.
                </p>
              </div>
            )}

            {/* Categories List Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
              {categories.map((cat, idx) => {
                const usageCount = getCategoryUsageCount(cat);
                const isBeingEdited = editingCat?.oldName === cat;

                return (
                  <div
                    key={idx}
                    className={`px-3.5 py-2 rounded-2xl flex items-center justify-between gap-2 border transition-all ${
                      isBeingEdited
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-400/20 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/70 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={cat}>
                        {cat}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${
                          usageCount > 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                            : 'bg-slate-200/70 dark:bg-slate-700/70 text-slate-500 dark:text-slate-400'
                        }`}
                        title={usageCount > 0 ? `مسجل عليه ${usageCount} مصروفات سابقة` : 'لم يتم تسجيل أي مصروفات عليه بعد'}
                      >
                        {usageCount > 0 ? `${usageCount} مصروف` : 'غير مستخدم'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Rename / Edit Category Button */}
                      <button
                        type="button"
                        onClick={() => handleStartEditCategory(cat)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={`تعديل مسمى بند "${cat}" (يحدّث جميع المصروفات السابقة)`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Category Button */}
                      {usageCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="p-1 rounded-lg text-amber-500/70 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                          title={`لا يمكن الحذف: مسجل عليه ${usageCount} عملية صرف سابقة للحفاظ على سلامة القيود. يمكنك تعديل الاسم.`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title={`حذف بند "${cat}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>حفظ الإعدادات المخصصة</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Roles & Permissions (RBAC) */}
      {activeTab === 'roles' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>نظام التحكم في الأدوار والصلاحيات (RBAC)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تحديد دقيق لمن يرى ماذا، ومن يحق له الاعتماد، الترحيل المحاسبي، أو إدارة المشاريع والعهد.
              </p>
            </div>

            <button
              onClick={openNewRoleModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة دور وظيفي مخصص</span>
            </button>
          </div>

          {/* Manager Governance Policy Banner */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-start sm:items-center gap-3.5 shadow-xs">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shrink-0 shadow-sm shadow-emerald-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center flex-wrap gap-2">
                <span>حوكمة صلاحيات المدير التنفيذي / العام (المتحكم بالنظام):</span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-200/70 dark:bg-emerald-800/70 text-emerald-900 dark:text-emerald-100 text-[10px] font-extrabold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  مفتوح وظاهر دائماً ولا يقبل الخفاء
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed font-medium">
                بالنسبة للمدير التنفيذي أو المدير العام / الإدارة العليا: كافة الشاشات والصلاحيات الإدارية والرقابية مفتوحة وظاهرة بالكامل ولا تقبل الخفاء أو التعطيل، لكونه المتحكم في المنظومة، وضماناً لعدم فقدان القدرة على تعديل الصلاحيات أو التسبب في إغلاق إداري ذاتي.
              </p>
            </div>
          </div>

          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map(role => {
              const isManagerRole = isExecutiveManagerRole(role);
              const permCount = isManagerRole ? 16 : Object.values(role.permissions).filter(val => typeof val === 'boolean' && val).length;
              const allowedScreens = isManagerRole ? APP_SCREENS.map(s => s.id) : (role.permissions.allowedScreens || APP_SCREENS.map(s => s.id));
              const graceMinutes = isManagerRole ? 9999 : (role.permissions.expenseEditGraceMinutes ?? (role.id === 'role_supervisor' || role.name.includes('مشرف') ? 30 : 9999));

              return (
                <div
                  key={role.id}
                  className={`bg-white dark:bg-slate-900 p-5 rounded-3xl border shadow-sm flex flex-col justify-between transition-all space-y-4 ${
                    isManagerRole
                      ? 'border-emerald-300 dark:border-emerald-800/80 ring-2 ring-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {role.name}
                            {isManagerRole && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                          </h4>
                          {isManagerRole ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              المتحكم بالنظام (وصول شامل دائم)
                            </span>
                          ) : role.isSystem ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              نظامي أساسي
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {isManagerRole
                            ? 'المتحكم الأساسي في النظام؛ يمتلك وصولاً كاملاً وشاملاً لجميع الشاشات والصلاحيات الإدارية والرقابية ولا تقبل الخفاء أو الإلغاء لضمان استقرار المنظومة وعدم الإغلاق الذاتي.'
                            : role.description}
                        </p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border shrink-0 ${role.badgeColor}`}>
                        {role.name}
                      </span>
                    </div>

                    {/* Allowed Screens Preview */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Eye className="w-3 h-3 text-emerald-600" />
                          <span>الشاشات المسموحة:</span>
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                          {isManagerRole
                            ? '9 من 9 شاشات (جميع الشاشات مفتوحة وظاهرة ولا تقبل الخفاء 🔒)'
                            : `${allowedScreens.length} من ${APP_SCREENS.length} شاشات`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {APP_SCREENS.filter(s => allowedScreens.includes(s.id)).map(s => (
                          <span
                            key={s.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              isManagerRole
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                            }`}
                          >
                            {getScreenIcon(s.iconName)}
                            <span>{s.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* CRUD & Grace Period Summary */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Sliders className="w-3 h-3 text-emerald-600" />
                          <span>صلاحيات المصروفات والمهلة:</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {isManagerRole
                            ? 'مهلة مفتوحة دائماً (صلاحية سيادية)'
                            : graceMinutes === 9999
                            ? 'مهلة مفتوحة دائماً'
                            : graceMinutes === 0
                            ? 'مقفل فور الحفظ'
                            : `مهلة: ${graceMinutes} دقيقة`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <span className="px-2 py-0.5 rounded font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                          {isManagerRole ? 'إضافة: مسموح دائماً 🔒' : role.permissions.canCreateExpense ? 'إضافة: مسموح' : 'إضافة: معطل (للاطلاع)'}
                        </span>
                        <span className="px-2 py-0.5 rounded font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                          {isManagerRole ? 'تعديل: مسموح دائماً 🔒' : role.permissions.canEditExpense ? `تعديل: مسموح` : 'تعديل: محظور'}
                        </span>
                        <span className="px-2 py-0.5 rounded font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                          {isManagerRole ? 'حذف: مسموح دائماً 🔒' : role.permissions.canDeleteExpense ? 'حذف: مسموح' : 'حذف: محظور'}
                        </span>
                      </div>
                    </div>

                    {/* Operational Approvals */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1">
                      {(isManagerRole || role.permissions.canApproveAsSupervisor || role.permissions.canApproveAsProjectManager) && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                          اعتماد المشرف (م 1)
                        </span>
                      )}
                      {(isManagerRole || role.permissions.canApproveAsAccountant) && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                          ترحيل المحاسب (م 2)
                        </span>
                      )}
                      {(isManagerRole || role.permissions.canExportToExternalERP) && (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold font-mono">
                          ترحيل ERP
                        </span>
                      )}
                      {(isManagerRole || role.permissions.canApproveAsManagement) && (
                        <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                          اعتماد الإدارة العليا (م 3)
                        </span>
                      )}
                      {(isManagerRole || role.permissions.canManageCustody) && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                          صرف العهد
                        </span>
                      )}
                      {(isManagerRole || role.permissions.canViewFinancialReports) && (
                        <span className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[10px] font-semibold">
                          التقارير المالية
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => openEditRoleModal(role)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                        isManagerRole
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 border-emerald-600'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {isManagerRole ? <ShieldCheck className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                      <span>{isManagerRole ? 'عرض الصلاحيات والحوكمة 🔒' : 'التحكم في الشاشات والصلاحيات'}</span>
                    </button>

                    {!role.isSystem && !isManagerRole && (
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="حذف الدور المخصص"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Workflow Pipeline Configuration */}
      {activeTab === 'workflow' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-600" />
                <span>محرك دورة الاعتماد والمطابقة متعددة المراحل</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تخصيص ترتيب مراحل الاعتماد، تحديد الدور المسؤول عن كل مرحلة، وربط مرحلة الترحيل الخارجي لـ ERP.
              </p>
            </div>

            <button
              onClick={() => setIsNewStageModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مرحلة اعتماد جديدة</span>
            </button>
          </div>

          {/* Workflow Stages List */}
          <div className="space-y-3">
            {workflowStages.map((stage, idx) => {
              const assignedRole = roles.find(r => r.id === stage.roleId || r.name === stage.roleId);

              return (
                <div
                  key={stage.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between flex-wrap gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold flex items-center justify-center text-sm shadow-inner">
                      {idx + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{stage.title}</h4>
                        {stage.requiresExternalErpPosting && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold font-mono">
                            ترحيل ERP إلزامي
                          </span>
                        )}
                        {!stage.isActive && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px]">
                            معطلة
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {stage.description || 'مرحلة تدقيق نظامية'} • الدور المخول: <strong className="text-slate-800 dark:text-slate-200">{assignedRole?.name || stage.roleId}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Reordering */}
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveStage(idx, 'up')}
                      className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      title="تقديم المرحلة للأعلى"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={idx === workflowStages.length - 1}
                      onClick={() => handleMoveStage(idx, 'down')}
                      className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      title="تأخير المرحلة للأسفل"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setEditingStage(stage)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>

                    {workflowStages.length > 1 && (
                      <button
                        onClick={() => handleDeleteStage(stage.id, stage.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="حذف المرحلة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: ERP Integration Settings */}
      {activeTab === 'erp' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  إعدادات الربط مع البرامج المحاسبية الخارجية (ERP Integration)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ربط دورة فواتير المشاريع تلقائياً مع قيود اليومية وسندات الصرف في النظام المحاسبي للشركة.
                </p>
              </div>
            </div>

            {erpFeedback && (
              <div className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in ${
                erpFeedback.type === 'success'
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
              }`}>
                {erpFeedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{erpFeedback.message}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
              <div>
                <label htmlFor="erp-system-select" className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                  نظام المحاسبة المعتمد لدى الشركة
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  اختر المنظومة المحاسبية الرئيسية لتوليد نماذج القيود أو أضف برنامجك المفضل واختاره مباشرة:
                </p>
                <select
                  id="erp-system-select"
                  value={selectedErp}
                  onChange={e => handleSelectErp(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
                >
                  {erpSystems.map((sys, idx) => (
                    <option key={idx} value={sys}>
                      {sys} {sys === selectedErp ? '✓ (المعتمد حالياً)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add custom software directly */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  إضافة برنامج محاسبي خارجي مخصص
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newErpName}
                    onChange={e => setNewErpName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomErp();
                      }
                    }}
                    placeholder="اكتب اسم البرنامج الخارجي بنفسك (مثال: دفترة، قيود، الأصيل، إيراد...)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomErp}
                    className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                    title="إضافة واعتماد كبرنامج رئيسي"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة واعتماد</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  سيتم حفظ البرنامج المضاف تلقائياً وإدراجه في قائمة الاختيار واعتماده كخيار مباشر في دورة ترحيل القيود.
                </p>
              </div>

              {/* Active System confirmation badge */}
              <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                    البرنامج المعتمد حالياً: <span className="underline font-black">{selectedErp}</span>
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-200/80 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold">
                  نشط
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>قائمة البرامج المحاسبية المعتمدة ({erpSystems.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleResetErpList}
                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    title="استعادة القائمة الافتراضية"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>استعادة الافتراضي</span>
                  </button>
                </div>

                {/* Active ERP Edit Banner */}
                {editingErp && (
                  <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 space-y-2 animate-in fade-in shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                        <Pencil className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>تعديل اسم البرنامج: <strong className="font-mono underline font-black">"{editingErp.oldName}"</strong></span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${
                        getErpUsageCount(editingErp.oldName) > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {getErpUsageCount(editingErp.oldName) > 0
                          ? `مرتبط بـ (${getErpUsageCount(editingErp.oldName)}) مصروف`
                          : 'غير مرتبط بمصروفات'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingErp.newName}
                        onChange={e => setEditingErp({ ...editingErp, newName: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEditErp();
                          } else if (e.key === 'Escape') {
                            handleCancelEditErp();
                          }
                        }}
                        placeholder="اكتب الاسم الجديد للبرنامج المحاسبي..."
                        className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveEditErp}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                        title="حفظ التعديل وتحديث المصروفات المرتبطة"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditErp}
                        className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                    <p className="text-[10px] text-blue-700/90 dark:text-blue-300/90 leading-relaxed">
                      💡 ملاحظة: عند حفظ الاسم الجديد، سيتم تحديثه في القائمة وتحديث كافة المصروفات السابقة ({getErpUsageCount(editingErp.oldName)}) المرتبطة بهذا البرنامج تلقائياً.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  اضغط على أي برنامج لاعتماده كنظام رئيسي. يمكنك تعديل أسماء البرامج، ويمنع حذف البرامج المرتبطة بمصروفات لحماية سلامة القيود:
                </p>

                <div className="space-y-1.5 max-h-60 overflow-y-auto p-0.5">
                  {erpSystems.map((sys, idx) => {
                    const isSelected = sys === selectedErp;
                    const usageCount = getErpUsageCount(sys);
                    const isBeingEdited = editingErp?.oldName === sys;

                    return (
                      <div
                        key={idx}
                        className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2 border transition-all ${
                          isBeingEdited
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 ring-2 ring-blue-400/20 shadow-xs'
                            : isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 text-blue-950 dark:text-blue-100 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {/* Select & Title */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleSelectErp(sys)}
                            className="cursor-pointer flex items-center gap-1.5 text-xs font-bold truncate text-right hover:text-blue-600 transition-colors"
                            title="اضغط لاعتماده كنظام رئيسي حالي للشركة"
                          >
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </span>
                            <span className="truncate">{sys}</span>
                          </button>

                          {/* Usage Badge */}
                          {usageCount > 0 ? (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40 shrink-0 flex items-center gap-1"
                              title={`مرتبط بـ ${usageCount} مصروف - يمنع حذفه للحفاظ على القيود`}
                            >
                              <Link2 className="w-2.5 h-2.5" />
                              <span>{usageCount} مصروف</span>
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 shrink-0">
                              غير مرتبط
                            </span>
                          )}
                        </div>

                        {/* Actions: Edit Name & Delete/Lock */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleStartEditErp(sys)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
                            title={`تعديل اسم برنامج (${sys})`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete or Protected Lock Button */}
                          {usageCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteErp(sys)}
                              className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer flex items-center gap-0.5"
                              title={`مرتبط بـ (${usageCount}) مصروف - محمي من الحذف (اضغط للاطلاع على التفاصيل أو تعديل الاسم)`}
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteErp(sys)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title={`حذف (${sys}) من القائمة`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>الجسر المالي النشط جاهز لتسجيل القيود المرجعية فور اعتماد المحاسب</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  عند قيام المحاسب باعتماد أي فاتورة، تظهر له نافذة الترحيل المباشر إلى <strong className="text-slate-700 dark:text-slate-300 font-bold">{selectedErp}</strong> مع توليد رقم سند القيد (JV) تلقائياً.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Expense Archiving */}
      {activeTab === 'archive' && (
        <ExpenseArchiveManager />
      )}

      {/* TAB 5: Backup & Export */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Permission Notice if user lacks export permission */}
          {!isExecutiveManagerRole(currentUserRole) && !hasPermission('canExportExcelAndBackup') && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
              <span>
                تنبيه رقابي: صلاحيات حسابك الحالي محددة؛ قد تتطلب بعض إجراءات التصدير أو الاستعادة موافقة الإدارة العليا.
              </span>
            </div>
          )}

          {/* Database Overview Banner */}
          <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold">حالة قاعدة البيانات ومخزن النظام</h3>
                </div>
                <p className="text-xs text-slate-300">
                  كافة المعاملات المالية، العهد، سندات الصرف، والمستخدمين محفوظة محلياً ومتزامنة سحابياً بأمان.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  قاعدة البيانات نشطة ومؤمّنة
                </span>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-700/60 text-center">
              <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/40">
                <div className="text-lg font-black text-white">{projects.length}</div>
                <div className="text-[11px] text-slate-400">المشاريع المسجلة</div>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/40">
                <div className="text-lg font-black text-emerald-400">{expenses.length}</div>
                <div className="text-[11px] text-slate-400">سندات المصروفات</div>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/40">
                <div className="text-lg font-black text-blue-400">{custodies.length}</div>
                <div className="text-[11px] text-slate-400">سجلات العهد المسلمة</div>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/40">
                <div className="text-lg font-black text-purple-400">{users.length}</div>
                <div className="text-[11px] text-slate-400">المستخدمين والأدوار</div>
              </div>
            </div>
          </div>

          {/* Section: Firebase Cloud Server & Realtime Synchronization */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>السيرفر السحابي المركزي والتزامن المباشر (Cloud Server)</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ربط المنظومة بقاعدة بيانات سحابية مركزية تتيح العمل المتزامن من عدة أجهزة وحفظ النسخ الاحتياطية تلقائياً.
                </p>
              </div>

              {/* Server Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
                  isCloudConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{isCloudConnected ? 'متصل بالسيرفر السحابي (نشط)' : 'جاري الفحص أو بدون اتصال'}</span>
                </div>
              </div>
            </div>

            {/* Cloud Feedback Alert */}
            {cloudFeedback && (
              <div className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2 animate-in fade-in ${
                cloudFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}>
                {cloudFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{cloudFeedback.message}</span>
              </div>
            )}

            {/* Multi-Tenant Workspace & Project Isolation Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-l from-indigo-50/70 via-slate-50 to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">عزل مساحات العمل والفروع (Multi-Tenant Workspace)</h5>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {workspaceInfo.source === 'hostname' && `عزل تلقائي حسب الرابط (${workspaceInfo.rawHostname || 'Vercel'})`}
                        {workspaceInfo.source === 'env' && 'محدد عبر متغير بيئة Vercel'}
                        {workspaceInfo.source === 'custom' && 'محدد يدوياً من الإعدادات'}
                        {workspaceInfo.source === 'default' && 'مساحة افتراضية'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      يضمن عزل البيانات تماماً عند تشغيل عدة مستودعات أو روابط Vercel منفصلة (مثل khema-masrya-2 و skyarc-p01) على نفس مشروع Firebase.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isEditingWorkspace ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomWorkspaceInput(workspaceInfo.source === 'custom' ? workspaceInfo.name : workspaceInfo.id);
                        setIsEditingWorkspace(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تخصيص المساحة</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingWorkspace(false)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>

              {/* Active Workspace Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">معرف مساحة العمل النشطة (Active Workspace ID):</div>
                  <div className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 mt-0.5 break-all">
                    {workspaceInfo.id}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">اسم الفرع / التسمية:</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {workspaceInfo.name}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 sm:col-span-2 lg:col-span-1">
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">نطاق الاستضافة الحالي:</div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1">
                    <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{workspaceInfo.rawHostname || 'localhost (بيئة التطوير)'}</span>
                  </div>
                </div>
              </div>

              {/* Edit Mode Controls */}
              {isEditingWorkspace && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 space-y-3 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      تخصيص اسم مساحة العمل / الفرع (Workspace Name):
                    </label>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      <strong>ماذا تكتب هنا؟</strong> اكتب اسماً يُمثل فرعك، شركتك، أو مشروعك المستقل (بالعربية أو بالإنجليزية). يعمل هذا الاسم كمعرّف عزل مستقل لجميع بيانات المصروفات والمشاريع والعهد بحيث لا تتداخل بيانات الفروع أو المشاريع الأخرى مع بعضها.
                    </p>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">أمثلة سريعة مقترحة:</span>
                    {[
                      { id: 'khema_masrya', label: 'الخيمة المصرية' },
                      { id: 'riyadh_branch', label: 'فرع الرياض' },
                      { id: 'cairo_branch', label: 'فرع القاهرة' },
                      { id: 'project_alpha', label: 'المشروع الرئيسي' },
                    ].map(ex => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => setCustomWorkspaceInput(ex.id)}
                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer shadow-2xs"
                      >
                        {ex.label} ({ex.id})
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      value={customWorkspaceInput}
                      onChange={(e) => setCustomWorkspaceInput(e.target.value)}
                      placeholder="اكتب هنا، مثال: khema_masrya أو فرع_الرياض"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleSaveCustomWorkspace}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تطبيق وحفظ المساحة</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetWorkspace}
                        className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="استعادة التحديد التلقائي بحسب عنوان الرابط أو النطاق"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استعادة التلقائي</span>
                      </button>
                    </div>
                  </div>

                  {customWorkspaceInput.trim() && (
                    <div className="text-[11px] text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5 font-medium">
                      <span>المعرّف البرمجي النهائي المعتمد في السحابة:</span>
                      <code className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 font-mono font-bold text-indigo-900 dark:text-indigo-200">
                        {sanitizeWorkspaceId(customWorkspaceInput)}
                      </code>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    💡 تلميح: في حال مسح الحقل والضغط على "استعادة التلقائي"، سيتعرف النظام تلقائياً على كل فرع وفقاً لرابط النطاق (Subdomain).
                  </p>
                </div>
              )}
            </div>

            {/* Status & Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Push / Save to Cloud */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 text-emerald-700 dark:text-emerald-400">
                    <CloudUpload className="w-4 h-4" />
                    <span className="text-xs font-bold">مزامنة وحفظ على السيرفر</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    إرسال وحفظ كافة السجلات الحالية من هذا الجهاز إلى قاعدة البيانات السحابية المركزية.
                  </p>
                  <div className="mt-2 text-[10px] text-slate-400">
                    آخر مزامنة: {lastCloudSyncTime ? new Date(lastCloudSyncTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'لم تتم بعد'}
                  </div>
                  {isCloudSyncing && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <span>{syncProgress.statusText}</span>
                        <span className="font-mono tabular-nums">{syncProgress.percent}% ({syncProgress.remainingSeconds > 0 ? `متبقي ${syncProgress.remainingSeconds}ث` : 'لحظات'})</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-150"
                          style={{ width: `${syncProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isCloudSyncing}
                  onClick={handleSyncToCloud}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {isCloudSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isCloudSyncing
                      ? `جاري المزامنة ${syncProgress.percent}% (متبقي ${syncProgress.remainingSeconds}ث)`
                      : 'مزامنة وحفظ الآن'}
                  </span>
                </button>
              </div>

              {/* Pull / Fetch from Cloud */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 text-blue-700 dark:text-blue-400">
                    <CloudDownload className="w-4 h-4" />
                    <span className="text-xs font-bold">استرجاع وتحديث من السيرفر</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    جلب وتحديث آخر نسخة بيانات تم تعديلها وحفظها بواسطة موظفين آخرين أو من فرع آخر.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isCloudSyncing}
                  onClick={handlePullFromCloud}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {isCloudSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CloudDownload className="w-3.5 h-3.5" />
                  )}
                  <span>تحديث البيانات من السيرفر</span>
                </button>
              </div>

              {/* Cloud Archives & Backup Snapshots */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 text-purple-700 dark:text-purple-400">
                    <Archive className="w-4 h-4" />
                    <span className="text-xs font-bold">أرشيف النسخ السحابية</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    إنشاء نقاط استعادة مؤرشفة سحابياً والرجوع لأي نقطة استعادة سابقة بضغطة زر.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isCreatingCloudSnapshot}
                    onClick={handleCreateCloudBackup}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    {isCreatingCloudSnapshot ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>نسخة مؤرشفة</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoadingCloudBackups}
                    onClick={handleLoadCloudBackups}
                    className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                    title="عرض الأرشيف السحابي"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>سجل النسخ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Google Cloud Firebase Firestore Connection & Speed Diagnostic Tool */}
            <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                    <CloudUpload className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">أداة فحص واختبار السحابة المركزية (Google Cloud Firestore)</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">فحص فوري للاتصال بقاعدة البيانات السحابية الموحدة واختبار سرعة الاستجابة اللحظية (تم إلغاء التخزين على هوستنجر لمنع التضارب)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isDiagnosingServer}
                    onClick={async () => {
                      setIsDiagnosingServer(true);
                      try {
                        const start = Date.now();
                        const isConnected = await FirebaseService.testConnection(true);
                        const latency = Date.now() - start;
                        setServerDiagnostic({
                          success: isConnected,
                          workingUrl: 'https://firestore.googleapis.com',
                          storageFile: 'Google Cloud Firestore',
                          latencyMs: latency,
                          engine: 'Google Cloud Firestore (NoSQL)',
                          isWritable: isConnected,
                          details: isConnected
                            ? `الاتصال السحابي المباشر فائق السرعة ويعمل بكفاءة عالية (زمن الاستجابة: ${latency}ms). تم إلغاء الحفظ على هوستنجر بالكامل وتوحيد الحفظ على السحابة لمنع أي تضارب أو إحياء للبيانات المحذوفة.`
                            : 'تعذر الاتصال بقاعدة بيانات Firebase السحابية، يرجى التحقق من اتصال الإنترنت.'
                        });
                      } catch (err: any) {
                        setServerDiagnostic({
                          success: false,
                          workingUrl: 'https://firestore.googleapis.com',
                          storageFile: 'Google Cloud Firestore',
                          latencyMs: 0,
                          engine: 'Google Cloud Firestore',
                          isWritable: false,
                          details: `حدث خطأ أثناء فحص السحابة: ${err?.message || 'تعذر الاتصال'}`
                        });
                      } finally {
                        setIsDiagnosingServer(false);
                      }
                    }}
                    className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isDiagnosingServer ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>{isDiagnosingServer ? 'جاري الفحص...' : 'فحص الاتصال السحابي'}</span>
                  </button>
                </div>
              </div>

              {serverDiagnostic && (
                <div className={`p-3.5 rounded-xl text-xs space-y-2 border animate-in fade-in ${
                  serverDiagnostic.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {serverDiagnostic.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span>{serverDiagnostic.success ? 'الاتصال السحابي نشط وقاعدة البيانات السحابية موحدة ومحدثة' : 'تنبيه: تعذر إتمام الفحص السحابي'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                    <div className="p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-400 block text-[10px]">المحرك السحابي:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">Google Firestore</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-400 block text-[10px]">نوع التخزين:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">سحابي موحد (Single Authority)</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-400 block text-[10px]">حالة سيرفر هوستنجر:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">ملغي ومحمي من التضارب ✅</span>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed pt-1 text-slate-600 dark:text-slate-300">
                    {serverDiagnostic.details}
                  </p>
                </div>
              )}
            </div>

            {/* Hidden Diagnostic & Sync Logs Quick Link */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>صفحة تشخيص الشبكة وسجلات المزامنة السحابية (Sync Logs)</span>
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-md font-mono">نشط</span>
                  </h5>
                  <p className="text-[11px] text-slate-300">
                    عرض سجلات الأخطاء ومحاولات المزامنة مع خوادم Google Cloud Firestore المركزية.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('diagnostics')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                <span>فتح سجلات التشخيص (Sync Logs)</span>
              </button>
            </div>
          </div>

          {/* Section 0: Daily Automated Backup to Manager Email & pCloud */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <CloudUpload className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>النسخ السحابي والاحتياطي اليومي التلقائي (سحابة pCloud + السيرفر)</span>
                      <span className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-bold">
                        تلقائي مجدول
                      </span>
                    </h4>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  توليد وحفظ حزمتين كاملتين يومياً: <strong>مصنف إكسل الشامل (.xlsx)</strong> المحتوي على كافة الجداول المحاسبية، و <strong>النسخة الاحتياطية الرقمية الكاملة (JSON)</strong>، مع الرفع المباشر لسحابة pCloud وحفظ النسخ محلياً على السيرفر.
                </p>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {dailyBackupStatus?.pcloudUploaded && (
                  <span className="px-2.5 py-1 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 text-[11px] font-bold flex items-center gap-1.5">
                    <Cloud className="w-3 h-3 text-sky-500" />
                    مرفوع إلى pCloud
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3 text-emerald-500" />
                  محفوظ على السيرفر ({dailyBackupStatus?.lastSentDate || 'اليوم'})
                </span>
              </div>
            </div>

            {/* Feature 1: pCloud Direct Upload Link (Zero Password / Link-Only) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-50/70 via-blue-50/40 to-slate-50 dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900 border border-sky-200/80 dark:border-sky-800/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CloudUpload className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>النسخ السحابي المباشر إلى pCloud (برابط المجلد فقط دون كلمات سر)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/20">
                        موصى به لسهولة الإعداد
                      </span>
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      احفظ نسخك الاحتياطية وملفات إكسل على pCloud بمجرد لصق رابط المجلد (رابط طلب ملفات File Request أو رابط مشاركة).
                    </p>
                  </div>
                </div>
                {settings.lastPCloudBackupAt && (
                  <span className="text-[10px] text-sky-700 dark:text-sky-300 bg-sky-100/60 dark:bg-sky-950/60 px-2 py-1 rounded-lg self-start sm:self-auto font-mono">
                    آخر رفع سحابي: {new Date(settings.lastPCloudBackupAt).toLocaleDateString('ar-SA')}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-sky-500" />
                    <input
                      type="url"
                      value={pcloudBackupFolderUrl}
                      onChange={(e) => {
                        setPcloudBackupFolderUrl(e.target.value);
                        if (pcloudBackupTestSuccess !== null) setPcloudBackupTestSuccess(null);
                      }}
                      placeholder="https://filein.pcloud.com/... أو https://u.pcloud.link/publink/show?code=..."
                      className="w-full pr-9 pl-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-left"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isTestingPCloudBackup || !pcloudBackupFolderUrl.trim()}
                      onClick={handleTestPCloudBackupLink}
                      className="px-3.5 py-2 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/50 dark:hover:bg-sky-900 text-sky-800 dark:text-sky-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {isTestingPCloudBackup ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>فحص الرابط</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUploadingPCloudBackup || !pcloudBackupFolderUrl.trim()}
                      onClick={handleUploadToPCloudNow}
                      className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                    >
                      {isUploadingPCloudBackup ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CloudUpload className="w-3.5 h-3.5" />
                      )}
                      <span>رفع النسخة لـ pCloud الآن</span>
                    </button>
                  </div>
                </div>

                {/* Test Feedback */}
                {pcloudBackupTestMsg && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    pcloudBackupTestSuccess
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                  }`}>
                    {pcloudBackupTestSuccess ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{pcloudBackupTestMsg}</span>
                  </div>
                )}

                {/* Step-by-step Guide for pCloud Link */}
                <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-sky-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-2">
                  <div className="font-bold text-sky-800 dark:text-sky-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-sky-600" />
                      <span className="text-xs">طريقة الحصول على رابط الرفع من pCloud بدون أي كلمة سر (خلال 30 ثانية):</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPCloudTokenField(!showPCloudTokenField)}
                      className="text-[10px] text-sky-600 hover:text-sky-800 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                    >
                      {showPCloudTokenField ? 'إخفاء الربط برمز الوصول' : 'أو استخدم رمز وصول pCloud (Access Token)'}
                    </button>
                  </div>
                  
                  <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
                    <strong className="text-amber-800 dark:text-amber-300 block mb-0.5">⚠️ تنبيه هام لمنع أي خطأ:</strong>
                    يجب اختيار <strong>Request files (طلب ملفات)</strong> وليس (Share folder / Share link).
                    روابط المشاركة العادية مخصصة للتنزيل فقط ومحمية لمنع التعديل، بينما روابط <strong>طلب الملفات</strong> مخصصة رسمياً من pCloud لرفع النسخ الاحتياطية وإكسل تلقائياً ومباشرة دون طلب اسم مستخدم أو كلمة مرور!
                  </div>

                  <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 pr-1">
                    <li>افتح حسابك في <a href="https://my.pcloud.com" target="_blank" rel="noreferrer" className="text-sky-600 hover:underline font-bold">my.pcloud.com</a> وأنشئ مجلداً باسم (نسخ المنظومة المالية).</li>
                    <li>انقر على زر الخيارات الثلاثية <strong>(...)</strong> للمجلد أو انقر بزر الفأرة الأيمن، واختر <strong>Request files (طلب ملفات)</strong>.</li>
                    <li>انسخ الرابط الذي سيظهر (يبدأ غالباً بـ <code className="text-sky-700 dark:text-sky-300 font-mono">filein.pcloud.com</code> أو يحتوي على <code className="text-sky-700 dark:text-sky-300 font-mono">code=...</code>)، ثم الصقه في الحقل أعلاه واضغط (فحص الرابط).</li>
                  </ol>

                  {showPCloudTokenField && (
                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        رمز وصول pCloud (Access Token) اختياري للربط المباشر:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={pcloudAccessToken}
                          onChange={(e) => setPcloudAccessToken(e.target.value)}
                          placeholder="pCloud OAuth Access Token..."
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-left"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={handleSaveDailyBackupSettings}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-xs font-bold"
                        >
                          حفظ الرمز
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        إذا تم إدخال رمز الوصول، سيتمكن النظام من الرفع المباشر لحسابك حتى بدون روابط طلب الملفات.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scheduling & Instant Trigger Controls (pCloud + Server) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    الجدولة اليومية التلقائية لسحابة pCloud
                  </h5>
                  {dailyBackupEnabled ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                      تعمل يومياً تلقائياً
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-bold">
                      معطلة
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  توليد حزمة إكسل والنسخة الاحتياطية ورفعهما تلقائياً إلى مجلد pCloud وحفظهما على السيرفر يومياً بدون أي تدخل يدوي.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dailyBackupEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setDailyBackupEnabled(enabled);
                      updateSettings({ dailyBackupEnabled: enabled });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-sky-600"></div>
                </label>

                <button
                  type="button"
                  disabled={isSendingDailyBackup}
                  onClick={handleSendDailyBackupNow}
                  className="py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:scale-98 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {isSendingDailyBackup ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CloudUpload className="w-4 h-4" />
                  )}
                  <span>تنفيذ النسخ والرفع السحابي لـ pCloud الآن</span>
                </button>
              </div>
            </div>



            {/* Included Content Highlight Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Package 1: Excel Workbook */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      1. حزمة مصنف إكسل الشامل (.xlsx)
                    </h5>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                      title="تحميل نسخة إكسل الآن"
                    >
                      <Download className="w-3 h-3" />
                      <span>تحميل</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    يضم كافة أوراق العمل: المصروفات مع بيانات التدقيق، العهد المسلمة، أرصدة المشرفين، المشاريع والميزانيات، والمستخدمين.
                  </p>
                </div>
              </div>

              {/* Package 2: Full JSON Backup */}
              <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <FileJson className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      2. نسخة احتياطية كاملة (JSON)
                    </h5>
                    <button
                      type="button"
                      onClick={handleExportJSON}
                      className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                      title="تحميل نسخة JSON الآن"
                    >
                      <Download className="w-3 h-3" />
                      <span>تحميل</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    ملف رقمي موثق وشامل لكافة قواعد النظام، جاهز للاسترجاع الفوري التام عند أي طارئ من شاشة الاستعادة.
                  </p>
                </div>
              </div>
            </div>

            {/* Audit & Last Backup Status */}
            {dailyBackupStatus && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-4">
                  <span><strong>آخر نسخ سحابي:</strong> {dailyBackupStatus.lastSentAt ? new Date(dailyBackupStatus.lastSentAt).toLocaleString('ar-SA') : (dailyBackupStatus.lastSentDate || 'اليوم')}</span>
                  <span><strong>حالة النسخ:</strong> {
                    dailyBackupStatus.pcloudUploaded
                      ? 'تم الرفع لسحابة pCloud بنجاح وحفظها على السيرفر ☁️'
                      : 'تم الحفظ الآمن في مجلد النسخ اليومية على السيرفر'
                  }</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span>إكسل: {dailyBackupStatus.excelSizeKb || 0} KB</span>
                  <span>JSON: {dailyBackupStatus.jsonSizeKb || 0} KB</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 1: Export Hub */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>مركز تصدير البيانات والنسخ الاحتياطي (Export Hub)</span>
              </h4>
              <span className="text-xs text-slate-400">3 صيغ تصدير معتمدة</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              اختر صيغة التصدير المطلوبة لحفظ البيانات خارجياً أو مشاركتها مع المحاسبين والمدققين.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Export JSON Backup */}
              <div className="p-5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <FileJson className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">نسخة احتياطية كاملة (JSON)</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    ملف مشفر وشامل لكافة قواعد النظام (المشاريع، المصروفات، العهد، الإعدادات، والمستخدمين) جاهز للاسترجاع الفوري.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل النسخة الاحتياطية</span>
                </button>
              </div>

              {/* Export Full Excel */}
              <div className="p-5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/50 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-300">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">حزمة مصنف إكسل الشامل (.xlsx)</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    مصنف محاسبي احترافي بـ 7 جداول مستقلة (المصروفات، العهد، أرصدة المشرفين، المشاريع، المستخدمين، ومعلومات النسخة).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير حزمة إكسل المتكاملة</span>
                </button>
              </div>

              {/* Export CSV Table */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">كشف المصروفات (CSV)</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    ملف نصي جدولي مفتوح متوافق مع كافة برامج الحسابات الخارجية وأنظمة ERP ومستندات Google Sheets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير جدول (CSV)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Import & Restore Zone */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>استيراد واسترجاع نسخة احتياطية (Smart Restore)</span>
              </h4>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                فحص ومعاينة آمنة قبل التطبيق
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              قم برفع ملف النسخة الاحتياطية (.json) أو مصنف إكسل الشامل (.xlsx) لاستعادة البيانات أو نقلها من جهاز أو فرع آخر.
            </p>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  processBackupFile(file);
                }
              }}
              className={`p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center space-y-3 cursor-pointer ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/60 dark:bg-slate-800/40'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  اسحب وأفلت ملف النسخة الاحتياطية هنا، أو انقر للاستعراض
                </div>
                <div className="text-xs text-slate-400">
                  يدعم ملفات JSON (.json) ومصنفات إكسل الشاملة لكافة الأقسام (.xlsx, .xls)
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json, .xlsx, .xls"
                onChange={handleImportFileChange}
                className="hidden"
              />
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm pointer-events-none"
              >
                اختيار ملف من الجهاز
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Inspection & Restore Modal */}
      {backupValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-2xl space-y-5 my-6 max-h-[90vh] flex flex-col justify-between">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                  <FileJson className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    معاينة محتويات النسخة الاحتياطية وتأكيد الاسترجاع
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تم فحص بنية الملف بنجاح وهو متوافق وموثوق مع نظام SkyArc
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBackupValidationModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File Info Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  اسم الملف: {backupValidationModal.fileName}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  الحجم: {backupValidationModal.fileSizeKb} ك.ب
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                <span>تاريخ التصدير: {backupValidationModal.stats?.exportedAt ? new Date(backupValidationModal.stats.exportedAt).toLocaleString('ar-SA') : 'غير مسجل'}</span>
                <span>بواسطة: {backupValidationModal.stats?.exportedBy || 'النظام'}</span>
                <span>إصدار النظام: {backupValidationModal.stats?.appVersion || 'v10'}</span>
              </div>
            </div>

            {/* Records Breakdown Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                السجلات المكتشفة داخل هذا الملف:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">المشاريع:</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{backupValidationModal.stats?.projectsCount || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">سندات المصروفات:</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{backupValidationModal.stats?.expensesCount || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">سجلات العهد:</span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{backupValidationModal.stats?.custodiesCount || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">المستخدمين:</span>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{backupValidationModal.stats?.usersCount || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">الأدوار الوظيفية:</span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{backupValidationModal.stats?.rolesCount || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">مسارات الاعتماد:</span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{backupValidationModal.stats?.workflowStagesCount || 0}</span>
                </div>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                طريقة التطبيق والاسترجاع المطلوبة:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setBackupValidationModal(prev => prev ? { ...prev, mode: 'replace' } : null)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                    backupValidationModal.mode === 'replace'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={backupValidationModal.mode === 'replace'}
                      onChange={() => {}}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold">استبدال شامل (Full Restore)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                    مسح السجلات الحالية واستبدالها بالكامل بسجلات النسخة الاحتياطية (موصى به للاسترجاع المتطابق).
                  </p>
                </label>

                <label
                  onClick={() => setBackupValidationModal(prev => prev ? { ...prev, mode: 'merge' } : null)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                    backupValidationModal.mode === 'merge'
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={backupValidationModal.mode === 'merge'}
                      onChange={() => {}}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold">دمج وتحديث (Smart Merge)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                    إضافة السجلات الجديدة وتحديث السجلات المشتركة بدون حذف أي من المشروعات أو المصروفات الحالية.
                  </p>
                </label>
              </div>
            </div>

            {/* Warning if replace mode */}
            {backupValidationModal.mode === 'replace' && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  تنبيه: نمط الاستبدال الشامل سيعيد تهيئة قاعدة البيانات بالكامل إلى حالة هذا الملف.
                </span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBackupValidationModal(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
              >
                إلغاء الأمر
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>تأكيد الاستيراد والاستعادة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Backups Archive Modal */}
      {isCloudBackupsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400">
                <Archive className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">أرشيف النسخ الاحتياطية السحابية</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCloudBackupsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              قائمة بالنسخ الاحتياطية المحفوظة بأمان على السيرفر المركزي. يمكنك استرجاع أي نسخة سابقة في أي وقت.
            </p>

            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {cloudBackupsList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <Archive className="w-8 h-8 mx-auto stroke-[1.5]" />
                  <p className="text-xs">لا توجد نسخ مؤرشفة على السيرفر حتى الآن.</p>
                </div>
              ) : (
                cloudBackupsList.map((backup) => (
                  <div
                    key={backup.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {backup.note || 'نسخة احتياطية سحابية'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold">
                          سحابي
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>{new Date(backup.createdAt).toLocaleString('ar-SA')}</span>
                        {backup.data?.expenses && (
                          <span>({backup.data.expenses.length} مصروف • {backup.data.projects?.length || 0} مشروع)</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestoreCloudSnapshot(backup.id)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>استرجاع</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCloudBackupsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Edit / Add Modal */}
      {(editingRole || isNewRoleModalOpen) && (() => {
        const isEditingAdminRole = !!editingRole && isExecutiveManagerRole(editingRole);

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-3xl space-y-5 my-6 max-h-[90vh] flex flex-col justify-between">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{editingRole ? `التحكم في صلاحيات: ${editingRole.name}` : 'إنشاء دور وظيفي مخصص جديد'}</span>
                    {isEditingAdminRole && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isEditingAdminRole
                      ? 'المدير التنفيذي / العام هو المتحكم في النظام، كل شيء مفتوح وظاهر ولا يقبل الخفاء لضمان استمرار القدرة على إدارة الصلاحيات.'
                      : 'التحكم الكامل في الشاشات المصرح برؤيتها، صلاحيات الإضافة والتعديل والحذف، ومهلة القفل الرقابي.'}
                  </p>
                </div>
              </div>

              {isEditingAdminRole ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-extrabold shadow-xs">
                  <Lock className="w-3.5 h-3.5" />
                  <span>المتحكم بالنظام (كافة الصلاحيات مفتوحة دائماً)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 ml-1">تطبيق نمط سريع:</span>
                  <button
                    type="button"
                    onClick={() => applyRolePreset('accountant')}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold transition-colors cursor-pointer"
                    title="شاشات الاطلاع والاعتماد والترحيل فقط بدون إضافة أو تعديل"
                  >
                    محاسب مالي
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRolePreset('supervisor')}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold transition-colors cursor-pointer"
                    title="تسجيل وتعديل وحذف خلال مهلة 30 دقيقة وشاشات ميدانية"
                  >
                    مشرف موقع
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRolePreset('financial_manager')}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-bold transition-colors cursor-pointer"
                    title="كافة الشاشات والصلاحيات بمهلة تعديل مفتوحة دائماً"
                  >
                    مدير تنفيذي / إدارة عليا
                  </button>
                </div>
              )}
            </div>

            {/* Sovereign Manager Alert Banner */}
            {isEditingAdminRole && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-200 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="leading-relaxed">
                  <strong>قاعدة الحوكمة الرقابية (RBAC):</strong> بالنسبة للمدير العام، كل شيء مفتوح وظاهر ولا يقبل الخفاء أو الإلغاء لكونه المتحكم في النظام، وفي حال الإخفاء لن تتوفر القدرة على إدارة الصلاحيات لاحقاً أو معالجة الانسدادات الإدارية.
                </div>
              </div>
            )}

            {/* Quick Role Name Input Header (Always visible when creating a new custom role) */}
            {!editingRole && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="new-role-name-input-top" className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5 text-emerald-600" />
                    <span>اسم الدور الوظيفي الجديد</span>
                    <span className="text-rose-500 font-black text-sm">*</span>
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                    حقل مطلوب لإنشاء وحفظ الدور
                  </span>
                </div>
                <input
                  id="new-role-name-input-top"
                  type="text"
                  value={newRoleName}
                  onChange={e => {
                    setNewRoleName(e.target.value);
                    if (roleNameError) setRoleNameError('');
                  }}
                  placeholder="اكتب اسم الدور هنا... مثال: مدقق جودة ميداني، مسؤول مستودعات، مدير عقود..."
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border text-xs font-bold text-slate-900 dark:text-white focus:outline-none transition-all ${
                    roleNameError
                      ? 'border-rose-500 focus:border-rose-600 ring-2 ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'
                  }`}
                  autoFocus
                />
                {roleNameError && (
                  <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{roleNameError}</span>
                  </p>
                )}
              </div>
            )}

            {/* Sub-Tabs Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-1">
              <button
                type="button"
                onClick={() => {
                  setRoleModalSubTab('basic');
                  if (roleNameError) setRoleNameError('');
                }}
                className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  roleModalSubTab === 'basic'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Pencil className="w-4 h-4" />
                <span>بيانات ومظهر الدور</span>
                {(!editingRole ? !newRoleName.trim() : !editingRole.name.trim()) && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="يتطلب اسم الدور"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRoleModalSubTab('screens')}
                className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  roleModalSubTab === 'screens'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>الشاشات المسموحة</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">
                  {(editingRole ? editingRole.permissions.allowedScreens?.length : newRolePermissions.allowedScreens?.length) || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoleModalSubTab('crud')}
                className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  roleModalSubTab === 'crud'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>المصروفات والتعديل والمهلة</span>
              </button>

              <button
                type="button"
                onClick={() => setRoleModalSubTab('workflow')}
                className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  roleModalSubTab === 'workflow'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>الاعتمادات والنظام</span>
              </button>
            </div>

            {/* Sub-Tab Content */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-4 max-h-[55vh]">
              {/* TAB: Allowed Screens Matrix */}
              {roleModalSubTab === 'screens' && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      حدد الشاشات والأقسام المسموح لهذا الدور برؤيتها والوصول إليها عبر القائمة والتنقل المباشر:
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAllScreensForActiveRole(true)}
                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/60 hover:bg-emerald-200 rounded-lg cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllScreensForActiveRole(false)}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-300 rounded-lg cursor-pointer"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {APP_SCREENS.map(screen => {
                      const currentScreens = editingRole
                        ? (editingRole.permissions.allowedScreens || [])
                        : (newRolePermissions.allowedScreens || []);
                      const isAllowed = currentScreens.includes(screen.id);

                      return (
                        <div
                          key={screen.id}
                          onClick={() => toggleScreenForActiveRole(screen.id)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                            isAllowed
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            isAllowed
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}>
                            {getScreenIcon(screen.iconName)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-bold ${
                                isAllowed ? 'text-emerald-950 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'
                              }`}>
                                {screen.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isAllowed
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                              }`}>
                                {isAllowed ? 'مسموح' : 'محجوب'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              {screen.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: CRUD and Grace Controls */}
              {roleModalSubTab === 'crud' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    <strong>سياسة الإضافة والتعديل والحذف:</strong> يمكنك تخصيص ما إذا كان يحق لهذا الدور تسجيل فواتير جديدة أو تعديل وحذف السندات، وتحديد المهلة الزمنية المسموحة قبل القفل الرقابي.
                  </div>

                  {/* CRUD Switches */}
                  <div className="space-y-3">
                    {/* Can Create */}
                    {(() => {
                      const canCreate = editingRole ? editingRole.permissions.canCreateExpense : newRolePermissions.canCreateExpense;
                      const toggleCreate = () => {
                        if (editingRole) {
                          setEditingRole({
                            ...editingRole,
                            permissions: { ...editingRole.permissions, canCreateExpense: !canCreate },
                          });
                        } else {
                          setNewRolePermissions(prev => ({ ...prev, canCreateExpense: !canCreate }));
                        }
                      };

                      return (
                        <div
                          onClick={toggleCreate}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            canCreate
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${canCreate ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              <Plus className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                السماح بتسجيل وإضافة مصروفات وفواتير جديدة
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                للمحاسب المالي: يُعطل هذا الخيار لتكون شاشة المصروفات للاطلاع والتدقيق والاعتماد فقط.
                              </div>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                            canCreate
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            {canCreate ? 'مفعل (يمكنه الإضافة)' : 'معطل (للاطلاع فقط)'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Can Edit */}
                    {(() => {
                      const canEdit = editingRole ? editingRole.permissions.canEditExpense : newRolePermissions.canEditExpense;
                      const toggleEdit = () => {
                        if (editingRole) {
                          setEditingRole({
                            ...editingRole,
                            permissions: { ...editingRole.permissions, canEditExpense: !canEdit },
                          });
                        } else {
                          setNewRolePermissions(prev => ({ ...prev, canEditExpense: !canEdit }));
                        }
                      };

                      return (
                        <div
                          onClick={toggleEdit}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            canEdit
                              ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${canEdit ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              <Edit3 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                السماح بتعديل بيانات ومرفقات المصروفات
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                يخضع لمهلة التعديل المحددة أدناه وحالة الاعتماد الخاصة بالسند.
                              </div>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                            canEdit
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            {canEdit ? 'مفعل (يمكنه التعديل)' : 'معطل'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Can Delete */}
                    {(() => {
                      const canDelete = editingRole ? editingRole.permissions.canDeleteExpense : newRolePermissions.canDeleteExpense;
                      const toggleDelete = () => {
                        if (editingRole) {
                          setEditingRole({
                            ...editingRole,
                            permissions: { ...editingRole.permissions, canDeleteExpense: !canDelete },
                          });
                        } else {
                          setNewRolePermissions(prev => ({ ...prev, canDeleteExpense: !canDelete }));
                        }
                      };

                      return (
                        <div
                          onClick={toggleDelete}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            canDelete
                              ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${canDelete ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              <Trash2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                السماح بحذف المصروفات والسندات
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                يخضع للمهلة المحددة أيضاً ولا يمكن الحذف إذا دخل السند دورة الاعتماد.
                              </div>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                            canDelete
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            {canDelete ? 'مفعل (يمكنه الحذف)' : 'معطل'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Grace Period Configuration */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                        <Timer className="w-4 h-4 text-emerald-600" />
                        <span>مهلة التعديل والحذف المسموحة بعد تسجيل السند:</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {(() => {
                          const grace = editingRole
                            ? editingRole.permissions.expenseEditGraceMinutes ?? 30
                            : newRolePermissions.expenseEditGraceMinutes ?? 30;
                          if (grace === 9999) return 'مفتوح دائماً (بدون قيد زمني)';
                          if (grace === 0) return 'مقفل فور الحفظ (بدون مهلة)';
                          return `${grace} دقيقة`;
                        })()}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      تحدد هذه المهلة الوقت المسموح به للمشرف أو المستخدم لتصحيح أو إلغاء السند. بعد هذه الفترة يتم قفل السند تلقائياً لمنع التلاعب الرقابي.
                    </p>

                    {/* Quick presets for grace */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { label: '30 دقيقة (الافتراضي للمشرف)', value: 30 },
                        { label: 'ساعة كاملة (60 د)', value: 60 },
                        { label: 'ساعتين (120 د)', value: 120 },
                        { label: 'مفتوح دائماً (الإدارة والمدير المالي)', value: 9999 },
                        { label: 'مقفل فور الحفظ (0 دقيقة)', value: 0 },
                      ].map(item => {
                        const currentGrace = editingRole
                          ? editingRole.permissions.expenseEditGraceMinutes ?? 30
                          : newRolePermissions.expenseEditGraceMinutes ?? 30;
                        const isSelected = currentGrace === item.value;

                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              if (editingRole) {
                                setEditingRole({
                                  ...editingRole,
                                  permissions: { ...editingRole.permissions, expenseEditGraceMinutes: item.value },
                                });
                              } else {
                                setNewRolePermissions(prev => ({ ...prev, expenseEditGraceMinutes: item.value }));
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Input */}
                    <div className="flex items-center gap-3 pt-2">
                      <label className="text-xs text-slate-600 dark:text-slate-400">
                        أو تخصيص عدد الدقائق يدوياً:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={
                          editingRole
                            ? (editingRole.permissions.expenseEditGraceMinutes ?? 30)
                            : (newRolePermissions.expenseEditGraceMinutes ?? 30)
                        }
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          const sanitized = isNaN(val) ? 0 : Math.max(0, val);
                          if (editingRole) {
                            setEditingRole({
                              ...editingRole,
                              permissions: { ...editingRole.permissions, expenseEditGraceMinutes: sanitized },
                            });
                          } else {
                            setNewRolePermissions(prev => ({ ...prev, expenseEditGraceMinutes: sanitized }));
                          }
                        }}
                        className="w-24 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white text-center focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-xs text-slate-500">دقيقة</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Workflow & Operations Permissions */}
              {roleModalSubTab === 'workflow' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    صلاحيات دورة الاعتمادات والعمليات الميدانية والإدارية:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.entries({
                      canApproveAsSupervisor: 'اعتماد مرحلة مشرف الموقع (المرحلة 1)',
                      canApproveAsAccountant: 'اعتماد وترحيل مرحلة المحاسب المالي (المرحلة 2)',
                      canExportToExternalERP: 'ترحيل السندات لبرنامج المحاسبة (ERP)',
                      canApproveAsManagement: 'الاعتماد النهائي للإدارة العليا والخصم (المرحلة 3)',
                      canBatchApprove: 'الاعتماد الجماعي السريع لعدة فواتير دفعة واحدة',
                      canManageCustody: 'صرف وتسليم عهد مالية جديدة للمشرفين',
                      canManageProjects: 'إضافة وتعديل بيانات المشاريع والميزانيات',
                      canViewFinancialReports: 'الاطلاع على التقارير المالية والإحصائيات',
                      canViewAllExpenses: 'مشاهدة كافة المصروفات (ليس فقط مسجلاته)',
                      canViewAllProjects: 'مشاهدة كافة المشاريع',
                      canViewCustodies: 'مشاهدة سجلات وأرصدة العهد المالية',
                      canViewTeamMembers: 'مشاهدة فريق العمل والمشرفين',
                      canManageRolesAndPermissions: 'إدارة وتعديل الأدوار والصلاحيات (RBAC)',
                      canConfigureWorkflow: 'تعديل وترتيب مراحل دورة الاعتماد',
                      canExportExcelAndBackup: 'تصدير إكسل والنسخ الاحتياطي لقاعدة البيانات',
                    }).map(([key, label]) => {
                      const isChecked = editingRole
                        ? !!editingRole.permissions[key as keyof RolePermission]
                        : !!newRolePermissions[key as keyof RolePermission];

                      const togglePerm = () => {
                        if (editingRole) {
                          setEditingRole({
                            ...editingRole,
                            permissions: {
                              ...editingRole.permissions,
                              [key]: !isChecked,
                            },
                          });
                        } else {
                          setNewRolePermissions(prev => ({
                            ...prev,
                            [key]: !isChecked,
                          }));
                        }
                      };

                      return (
                        <label
                          key={key}
                          onClick={togglePerm}
                          className={`p-3 rounded-2xl border flex items-center gap-2.5 cursor-pointer text-xs transition-colors select-none ${
                            isChecked
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: Basic Info */}
              {roleModalSubTab === 'basic' && (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      اسم الدور الوظيفي <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="new-role-name-input"
                      type="text"
                      value={editingRole ? editingRole.name : newRoleName}
                      onChange={e => {
                        if (editingRole) {
                          setEditingRole({ ...editingRole, name: e.target.value });
                          if (roleNameError) setRoleNameError('');
                        } else {
                          setNewRoleName(e.target.value);
                          if (roleNameError) setRoleNameError('');
                        }
                      }}
                      placeholder="مثال: مدقق جودة ميداني، محاسب مشاريع أول"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs text-slate-900 dark:text-white font-bold focus:outline-none transition-all ${
                        roleNameError
                          ? 'border-rose-500 focus:border-rose-600 ring-2 ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'
                      }`}
                    />
                    {roleNameError && (
                      <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{roleNameError}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      الوصف والمهام الوظيفية
                    </label>
                    <input
                      type="text"
                      value={editingRole ? editingRole.description : newRoleDescription}
                      onChange={e => {
                        if (editingRole) setEditingRole({ ...editingRole, description: e.target.value });
                        else setNewRoleDescription(e.target.value);
                      }}
                      placeholder="وصف مختصر لمسؤوليات هذا الدور"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      لون الشارة المميزة:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'أزرق سماوي', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                        { label: 'أخضر زمردي', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
                        { label: 'كهرماني / برتقالي', color: 'bg-amber-100 text-amber-800 border-amber-300' },
                        { label: 'بنفسجي ملكي', color: 'bg-purple-100 text-purple-800 border-purple-300' },
                        { label: 'نيلي داكن', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
                        { label: 'وردي ياقوتي', color: 'bg-rose-100 text-rose-800 border-rose-300' },
                        { label: 'رمادي حجري', color: 'bg-slate-100 text-slate-800 border-slate-300' },
                      ].map(c => {
                        const currentColor = editingRole ? editingRole.badgeColor : newRoleBadgeColor;
                        const isSelected = currentColor === c.color;

                        return (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => {
                              if (editingRole) setEditingRole({ ...editingRole, badgeColor: c.color });
                              else setNewRoleBadgeColor(c.color);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${c.color} ${
                              isSelected ? 'ring-2 ring-offset-2 ring-emerald-500 scale-105' : 'opacity-80 hover:opacity-100'
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 font-medium">
                {isEditingAdminRole ? (
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    * دور المدير العام محمي ومحصن رقابياً لضمان سلامة واستمرار النظام.
                  </span>
                ) : editingRole && editingRole.isSystem ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    * دور أساسي في النظام: يمكنك تعديل شاشاته وصلاحياته بالكامل بحرية.
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRole(null);
                    setIsNewRoleModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={editingRole ? handleUpdateRole : handleCreateRole}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingRole ? 'حفظ إعدادات الصلاحيات والشاشات' : 'إنشاء وحفظ الدور'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Workflow Stage Edit / Add Modal */}
      {(editingStage || isNewStageModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <GitBranch className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingStage ? `تعديل مرحلة الاعتماد: ${editingStage.title}` : 'إضافة مرحلة اعتماد جديدة للمسار'}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان المرحلة *
                </label>
                <input
                  type="text"
                  value={editingStage ? editingStage.title : newStageTitle}
                  onChange={e => {
                    if (editingStage) setEditingStage({ ...editingStage, title: e.target.value });
                    else setNewStageTitle(e.target.value);
                  }}
                  placeholder="مثال: تدقيق مدير القطاع، فحص المكتب الفني"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الدور الوظيفي المخول بالاعتماد
                </label>
                <select
                  value={editingStage ? editingStage.roleId : newStageRoleId}
                  onChange={e => {
                    if (editingStage) setEditingStage({ ...editingStage, roleId: e.target.value });
                    else setNewStageRoleId(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وصف الإجراء المطلوب في هذه المرحلة
                </label>
                <input
                  type="text"
                  value={editingStage ? (editingStage.description || '') : newStageDescription}
                  onChange={e => {
                    if (editingStage) setEditingStage({ ...editingStage, description: e.target.value });
                    else setNewStageDescription(e.target.value);
                  }}
                  placeholder="مثال: مطابقة كميات المشتريات الميدانية مع الفاتورة"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStage ? editingStage.requiresExternalErpPosting : newStageRequiresErp}
                    onChange={e => {
                      if (editingStage) setEditingStage({ ...editingStage, requiresExternalErpPosting: e.target.checked });
                      else setNewStageRequiresErp(e.target.checked);
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>تتطلب هذه المرحلة إدخال رقم القيد والترحيل لبرنامج المحاسبة الخارجي (ERP)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setEditingStage(null);
                  setIsNewStageModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={editingStage ? handleUpdateStage : handleCreateStage}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
              >
                {editingStage ? 'حفظ التعديلات' : 'إضافة المرحلة'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

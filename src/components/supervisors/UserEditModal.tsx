import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { User, UserRole, UpdateMode } from '../../types';
import { compressImageFile } from '../../utils/imageCompressor';
import {
  X,
  Check,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  User as UserIcon,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Shield,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Phone,
  Mail,
  AtSign,
  Sliders,
  Sparkles
} from 'lucide-react';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null; // null means adding a new user
  isSelfEdit?: boolean;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
];

export const UserEditModal: React.FC<UserEditModalProps> = ({
  isOpen,
  onClose,
  user,
  isSelfEdit = false
}) => {
  const {
    currentUser,
    currentUserPermissions,
    projects,
    isUserAssignedToProject,
    roles,
    addUser,
    updateUser,
    showAlert
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine manager authority
  const isManager = Boolean(
    currentUser.role?.includes('مدير') ||
    currentUser.role?.includes('تنفيذي') ||
    currentUser.role?.includes('عليا') ||
    currentUser.role?.includes('عام') ||
    currentUser.roleId === 'role_admin' ||
    currentUser.roleId === 'role_management' ||
    currentUserPermissions?.canManageRolesAndPermissions ||
    currentUser.email?.toLowerCase() === '2030m.mansour@gmail.com'
  );

  const canManageRolesAndProjects = isManager && !isSelfEdit;

  // Available roles (system + custom)
  const availableRoles = useMemo(() => {
    if (roles && roles.length > 0) return roles;
    return [
      {
        id: 'role_admin',
        name: 'مدير تنفيذي أو مدير عام / إدارة عليا',
        description: 'المتحكم الكامل في النظام وصاحب الصلاحيات السيادية؛ تشمل الاعتماد النهائي وتعديل الصلاحيات والمشاريع.',
        color: 'emerald',
        permissions: {
          canViewAllProjects: true,
          canManageProjects: true,
          canApproveFinalManagement: true,
          canApproveAccounting: true,
          canSubmitExpenses: true,
          canManageCustody: true,
          canManageRolesAndPermissions: true,
          canConfigureWorkflow: true,
          canExportExcelAndBackup: true,
        }
      },
      {
        id: 'role_accountant',
        name: 'محاسب مالي',
        description: 'مراجعة وتدقيق المصروفات وإدارة العهد وترحيل القيود واعتماد المرحلة المحاسبية.',
        color: 'blue',
        permissions: {
          canViewAllProjects: true,
          canManageProjects: false,
          canApproveFinalManagement: false,
          canApproveAccounting: true,
          canSubmitExpenses: true,
          canManageCustody: true,
          canManageRolesAndPermissions: false,
          canConfigureWorkflow: false,
          canExportExcelAndBackup: true,
        }
      },
      {
        id: 'role_supervisor',
        name: 'مشرف موقع',
        description: 'تسجيل المصروفات الميدانية وإرفاق الفواتير للمشاريع المسندة ومتابعة العهدة المستلمة.',
        color: 'amber',
        permissions: {
          canViewAllProjects: false,
          canManageProjects: false,
          canApproveFinalManagement: false,
          canApproveAccounting: false,
          canSubmitExpenses: true,
          canManageCustody: false,
          canManageRolesAndPermissions: false,
          canConfigureWorkflow: false,
          canExportExcelAndBackup: false,
        }
      }
    ];
  }, [roles]);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [role, setRole] = useState<UserRole>('مشرف موقع');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role_supervisor');
  const [updateMode, setUpdateMode] = useState<UpdateMode>('ALL_CHANGES');
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);

  // Password Handling States
  // 1) When adding a new user:
  const [initialPassword, setInitialPassword] = useState('Password@2026');
  const [showInitialPassword, setShowInitialPassword] = useState(false);

  // 2) When user changes their own password:
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showSelfPassword, setShowSelfPassword] = useState(false);

  // 3) When manager resets another member's password:
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Avatar selector tab / mode
  const [showAvatarPresets, setShowAvatarPresets] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  // Active sub-tab in modal (for rich tabs on larger edits)
  const [activeTab, setActiveTab] = useState<'profile' | 'credentials' | 'permissions'>('profile');

  // Initialize form when opened or user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setUsername(user.username || (user.email ? user.email.split('@')[0] : `user_${user.id.toLowerCase()}`));
      setPhone(user.phone || '');
      setAvatar(user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80');
      setRole(user.role || 'مشرف موقع');

      const matchedRole = availableRoles.find(r => r.id === user.roleId || r.name === user.role) || availableRoles[0];
      setSelectedRoleId(matchedRole.id);
      setUpdateMode(user.updateMode || 'ALL_CHANGES');

      const userPids = projects.filter(p => isUserAssignedToProject(user, p)).map(p => p.id);
      setAssignedProjectIds(userPids);
    } else {
      // Adding new user
      setName('');
      setEmail('');
      setUsername('');
      setPhone('+966 ');
      setAvatar(AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)]);
      const defaultRoleId = 'role_supervisor';
      const matchedRole = availableRoles.find(r => r.id === defaultRoleId) || availableRoles[0];
      setSelectedRoleId(matchedRole.id);
      setRole(matchedRole.name as UserRole);
      setUpdateMode('ALL_CHANGES');
      setAssignedProjectIds([]);
      setInitialPassword(generateSecurePassword());
    }

    // Reset password sub-states
    setIsChangingPassword(false);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setIsResettingPassword(false);
    setResetPasswordInput('');
    setCopiedCredentials(false);
    setShowAvatarPresets(false);
    setShowUrlInput(false);
    setCustomAvatarUrl('');
    setActiveTab('profile');
  }, [user, isOpen, availableRoles, projects, isUserAssignedToProject]);

  // Selected role configuration
  const currentRoleConfig = useMemo(() => {
    return availableRoles.find(r => r.id === selectedRoleId || r.name === role) || availableRoles[0];
  }, [availableRoles, selectedRoleId, role]);

  function generateSecurePassword(): string {
    const specials = ['@', '#', '$', '!', '&'];
    const randomSpecial = specials[Math.floor(Math.random() * specials.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `Sic${randomSpecial}${randomNum}`;
  }

  // Handle local image file upload (converts to base64 Data URL)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('ملف غير صالح', 'يرجى اختيار ملف صورة صالح (PNG, JPG, WebP).', 'warning');
      return;
    }

    // Maximum 3MB check
    if (file.size > 3 * 1024 * 1024) {
      showAlert('حجم الصورة كبير', 'يرجى اختيار صورة بحجم أقل من 3 ميجابايت لضمان سرعة التحميل.', 'warning');
      return;
    }

    try {
      const compressed = await compressImageFile(file, 400, 400, 0.8);
      setAvatar(compressed);
      showAlert('تم رفع الصورة', 'تم تحديث الصورة الشخصية بنجاح.', 'success');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
          showAlert('تم رفع الصورة', 'تم تحديث الصورة الشخصية بنجاح.', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = () => {
    if (!customAvatarUrl.trim()) return;
    setAvatar(customAvatarUrl.trim());
    setShowUrlInput(false);
    setCustomAvatarUrl('');
  };

  const handleToggleProject = (projectId: string) => {
    setAssignedProjectIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const handleSelectAllProjects = () => {
    setAssignedProjectIds(projects.map(p => p.id));
  };

  const handleClearAllProjects = () => {
    setAssignedProjectIds([]);
  };

  const handleRoleSelectionChange = (rId: string) => {
    setSelectedRoleId(rId);
    const found = availableRoles.find(r => r.id === rId);
    if (found) {
      setRole(found.name as UserRole);
    }
  };

  const handleCopyCredentials = () => {
    const finalUser = username.trim() || email.trim();
    const finalPass = isResettingPassword ? resetPasswordInput : (user?.password || '••••••••');
    const text = `بيانات تسجيل الدخول لنظام العهد والمصروفات:\nاسم المستخدم: ${finalUser}\nكلمة المرور: ${finalPass}\nالرابط: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showAlert('بيانات ناقصة', 'يرجى إدخال الاسم الكامل للعضو.', 'warning');
      return;
    }

    if (!email.trim()) {
      showAlert('بيانات ناقصة', 'يرجى إدخال البريد الإلكتروني للعضو.', 'warning');
      return;
    }

    const cleanUsername = username.trim() || email.split('@')[0].trim();

    // Password validation for self-change
    if (user && isSelfEdit && isChangingPassword) {
      if (!newPasswordInput || newPasswordInput.length < 4) {
        showAlert('كلمة مرور قصيرة', 'يجب ألا تقل كلمة المرور الجديدة عن 4 خانات لضمان أمان الحساب.', 'warning');
        return;
      }
      if (newPasswordInput !== confirmPasswordInput) {
        showAlert('عدم تطابق كلمة المرور', 'كلمة المرور الجديدة وتأكيدها غير متطابقين، يرجى إعادة التأكد.', 'warning');
        return;
      }
    }

    // Password validation for manager reset
    if (user && !isSelfEdit && isResettingPassword) {
      if (!resetPasswordInput || resetPasswordInput.length < 6) {
        showAlert('كلمة مرور غير صالحة', 'يرجى إدخال كلمة مرور جديدة لا تقل عن 6 خانات أو توليد كلمة مرور مؤقتة.', 'warning');
        return;
      }
    }

    const matchedRole = availableRoles.find(r => r.id === selectedRoleId);
    const finalRole = (matchedRole ? matchedRole.name : role) as UserRole;
    const finalRoleId = matchedRole ? matchedRole.id : selectedRoleId;

    if (user) {
      // Prepare update payload
      const payload: Partial<User> = {
        name: name.trim(),
        email: email.trim(),
        username: cleanUsername,
        phone: phone.trim(),
        avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
      };

      // Handle Self Password Change
      if (isSelfEdit && isChangingPassword) {
        payload.password = newPasswordInput;
        payload.passwordChangedAt = new Date().toISOString();
        payload.passwordResetByAdmin = false;
      }

      // Handle Manager Password Reset
      if (!isSelfEdit && isResettingPassword) {
        payload.password = resetPasswordInput;
        payload.passwordChangedAt = new Date().toISOString();
        payload.passwordResetByAdmin = true;
      }

      // Handle Role & Project updates if manager
      if (canManageRolesAndProjects) {
        payload.role = finalRole;
        payload.roleId = finalRoleId;
        payload.updateMode = updateMode;
        payload.assignedProjects = assignedProjectIds;
        if (matchedRole?.permissions) {
          payload.permissions = matchedRole.permissions as any;
        }
      }

      await updateUser(user.id, payload);

      if (isSelfEdit && isChangingPassword) {
        showAlert(
          'تم تحديث البيانات وكلمة المرور',
          'تم حفظ بياناتك وتغيير كلمة المرور الخاصة بك بنجاح والحفاظ على خصوصيتها.',
          'success'
        );
      } else if (!isSelfEdit && isResettingPassword) {
        showAlert(
          'تمت إعادة ضبط كلمة المرور بنجاح',
          `تمت إعادة ضبط كلمة المرور للعضو "${name}". اسم المستخدم: (${cleanUsername}) | كلمة المرور الجديدة: (${resetPasswordInput}). يمكنك تزويده بها الآن.`,
          'success'
        );
      } else {
        showAlert('تم التحديث بنجاح', `تم حفظ وتحديث بيانات العضو "${name}" بنجاح في النظام.`, 'success');
      }
    } else {
      // Adding new user
      const finalInitialPass = initialPassword.trim() || 'Password@2026';
      await addUser({
        name: name.trim(),
        email: email.trim(),
        username: cleanUsername,
        password: finalInitialPass,
        passwordChangedAt: new Date().toISOString(),
        phone: phone.trim(),
        avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        role: finalRole,
        roleId: finalRoleId,
        updateMode,
        assignedProjects: assignedProjectIds,
      });

      showAlert(
        'تمت إضافة العضو بنجاح',
        `تم إنشاء حساب للعضو "${name}". اسم المستخدم: (${cleanUsername})، كلمة المرور الأولية: (${finalInitialPass}). يستطيع العضو تغيير كلمة المرور لاحقاً للحفاظ على خصوصيته.`,
        'success'
      );
    }

    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/80 backdrop-blur-md p-2 sm:p-6 flex justify-center items-start sm:items-center animate-in fade-in duration-200"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        className="relative my-4 sm:my-auto w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {user
                  ? isSelfEdit
                    ? 'الملف الشخصي وكلمة المرور'
                    : 'تعديل بيانات وصلاحيات العضو'
                  : 'إضافة عضو جديد إلى النظام'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isSelfEdit
                  ? 'يمكنك تعديل صورتك الشخصية واسم المستخدم وتغيير كلمة المرور الخاصة بك'
                  : 'إدارة الصورة، بيانات الدخول، الصلاحيات الرقابية، وإعادة ضبط كلمة المرور'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs (Profile, Credentials, Permissions) */}
        <div className="px-6 pt-3 pb-0 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>البيانات والصورة الشخصية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'credentials'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>اسم المستخدم وكلمة المرور</span>
            {(isChangingPassword || isResettingPassword) && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {canManageRolesAndProjects && (
            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'permissions'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>الصلاحيات والمشاريع</span>
            </button>
          )}
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* TAB 1: Profile & Photo */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Member Photo Section (Avatar with Upload / Presets / URL) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>صورة العضو الشخصية</span>
                  </label>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                    يمكن للعضو أو المدير تعديلها
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pt-1">
                  {/* Avatar Preview */}
                  <div className="relative group shrink-0">
                    <img
                      src={avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                      alt={name || 'صورة العضو'}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-2 border-purple-300 dark:border-purple-700 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 text-white rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-[10px] font-bold cursor-pointer"
                      title="رفع صورة جديدة من جهازك"
                    >
                      <Camera className="w-5 h-5" />
                      <span>تغيير</span>
                    </button>
                  </div>

                  {/* Photo Actions */}
                  <div className="flex-1 space-y-2 text-right w-full">
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      الصورة الشخصية تظهر في ترويسة البرنامج، وبطاقة العضو، وتوقيع سندات الصرف والاعتمادات الرقابية.
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-purple-600/20 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>رفع صورة من الجهاز</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAvatarPresets(!showAvatarPresets)}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>اختيار من النماذج الجاهزة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>رابط صورة</span>
                      </button>

                      {avatar && (
                        <button
                          type="button"
                          onClick={() => setAvatar('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                          title="استعادة الصورة الافتراضية"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* URL Input Bar */}
                    {showUrlInput && (
                      <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                        <input
                          type="url"
                          placeholder="https://example.com/avatar.jpg"
                          value={customAvatarUrl}
                          onChange={e => setCustomAvatarUrl(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={handleApplyUrl}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                        >
                          تطبيق
                        </button>
                      </div>
                    )}

                    {/* Presets Gallery */}
                    {showAvatarPresets && (
                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                          اختر صورة رمزية جاهزة:
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {AVATAR_PRESETS.map((presetUrl, idx) => (
                            <button
                              type="button"
                              key={idx}
                              onClick={() => {
                                setAvatar(presetUrl);
                                setShowAvatarPresets(false);
                              }}
                              className={`w-10 h-10 rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${
                                avatar === presetUrl
                                  ? 'border-purple-600 scale-105 shadow-md'
                                  : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              <img src={presetUrl} alt={`نموذج ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Name & Email Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الاسم الكامل <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="مثال: م. أحمد خالد"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    البريد الإلكتروني <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="user@project-sic.sa"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Phone and Username Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الجوال
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="+966 50 000 0000"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المستخدم (Username)
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="مثال: ahmed.supervisor"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يُستخدم لتسجيل الدخول والتعريف السريع للعضو
                  </span>
                </div>
              </div>

              {/* Informative Current Role preview if self-edit */}
              {isSelfEdit && (
                <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-slate-700 dark:text-slate-300">
                      الدور الوظيفي الحالي: <strong>{user?.role}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    (تعديل الصلاحيات مقتصر على الإدارة العليا)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Username & Password with Privacy Engine */}
          {activeTab === 'credentials' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Username Control Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <AtSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>اسم المستخدم للعضو (Username)</span>
                  </label>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold font-mono">
                    @{username || 'user'}
                  </span>
                </div>

                <div className="relative">
                  <AtSign className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="مثال: ahmed.supervisor"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono font-bold"
                    dir="ltr"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  في حال نسي العضو اسم المستخدم الخاص به، يمكن للمدير الاطلاع عليه هنا أو تحديثه وتزويد العضو به.
                </p>
              </div>

              {/* Password Engine */}

              {/* CASE A: ADDING A NEW USER */}
              {!user && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>تعيين كلمة المرور الأولية للعضو</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setInitialPassword(generateSecurePassword())}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>توليد كلمة سر جديدة</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showInitialPassword ? 'text' : 'password'}
                      value={initialPassword}
                      onChange={e => setInitialPassword(e.target.value)}
                      className="w-full pr-9 pl-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none font-mono font-bold tracking-wider"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInitialPassword(!showInitialPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showInitialPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold block">مبدأ الخصوصية والأمان:</span>
                        <p className="text-[11px] leading-relaxed">
                          يتم تزويد العضو بهذه الكلمة الأولية لتسجيل الدخول لأول مرة. بعد ذلك يستطيع العضو بنفسه تغيير كلمة المرور للحفاظ على خصوصيته التامة، ولن يتمكن أي شخص آخر من قراءتها.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CASE B: MEMBER EDITING THEIR OWN PASSWORD (SELF EDIT) */}
              {user && isSelfEdit && (
                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>تغيير كلمة المرور الخاصة بك (حماية الخصوصية)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        كلمة المرور مشفرة وخاصة بك فقط ولا يمكن للمدير أو لأي مستخدم آخر الاطلاع عليها.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsChangingPassword(!isChangingPassword)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isChangingPassword
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                      }`}
                    >
                      {isChangingPassword ? 'إلغاء التغيير' : 'تغيير كلمة المرور الآن'}
                    </button>
                  </div>

                  {isChangingPassword ? (
                    <div className="space-y-3 pt-2 border-t border-purple-200/70 dark:border-purple-800/60 animate-in fade-in">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          كلمة المرور الحالية <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showSelfPassword ? 'text' : 'password'}
                            placeholder="أدخل كلمة المرور الحالية للتأكيد"
                            value={currentPasswordInput}
                            onChange={e => setCurrentPasswordInput(e.target.value)}
                            className="w-full pr-9 pl-10 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                            dir="ltr"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSelfPassword(!showSelfPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showSelfPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            كلمة المرور الجديدة <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type={showSelfPassword ? 'text' : 'password'}
                            placeholder="6 خانات على الأقل"
                            value={newPasswordInput}
                            onChange={e => setNewPasswordInput(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                            dir="ltr"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            تأكيد كلمة المرور الجديدة <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type={showSelfPassword ? 'text' : 'password'}
                            placeholder="أعد كتابة كلمة المرور الجديدة"
                            value={confirmPasswordInput}
                            onChange={e => setConfirmPasswordInput(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-purple-700 dark:text-purple-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>سيتم حفظ كلمة المرور وتشفيرها مباشرة عند النقر على حفظ.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/60 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>حالة كلمة المرور: <strong>مفعلة وخاصة بحسابك الشخصي 🔒</strong></span>
                      </div>
                      {user.passwordChangedAt && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          آخر تغيير: {new Date(user.passwordChangedAt).toLocaleDateString('ar-SA')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CASE C: MANAGER EDITING ANOTHER MEMBER'S PASSWORD (PRIVACY + RESET ONLY) */}
              {user && !isSelfEdit && (
                <div className="space-y-4">
                  
                  {/* Privacy Box: Password is NOT exposed */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          حماية الخصوصية الرقمية للعضو:
                        </h4>
                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-relaxed mt-0.5">
                          كلمة المرور الحالية خاصة بالعضو ومشفرة لحماية خصوصيته، ولا يمكن لأي مدير أو مستخدم آخر قراءتها أو الاطلاع عليها.
                          <strong> في حال نسيان العضو لكلمة المرور أو اسم المستخدم، يُتاح لك كمدير فقط عمل &quot;إعادة ضبط لكلمة المرور&quot; وتزويده بكلمة مرور جديدة.</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Manager Password Reset Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span>إعادة ضبط كلمة المرور بواسطة المدير (Password Reset)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          استخدم هذا الخيار إذا نسي العضو كلمة السر لتوليد كلمة مرور جديدة له
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!isResettingPassword) {
                            setIsResettingPassword(true);
                            setResetPasswordInput(generateSecurePassword());
                          } else {
                            setIsResettingPassword(false);
                            setResetPasswordInput('');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isResettingPassword
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                        }`}
                      >
                        {isResettingPassword ? 'إلغاء إعادة الضبط' : 'إعادة ضبط كلمة المرور الآن'}
                      </button>
                    </div>

                    {isResettingPassword && (
                      <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            كلمة المرور الجديدة / المؤقتة للعضو:
                          </label>
                          <button
                            type="button"
                            onClick={() => setResetPasswordInput(generateSecurePassword())}
                            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>توليد كلمة عشوائية أخرى</span>
                          </button>
                        </div>

                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showResetPassword ? 'text' : 'password'}
                            value={resetPasswordInput}
                            onChange={e => setResetPasswordInput(e.target.value)}
                            className="w-full pr-9 pl-24 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 text-xs text-slate-900 dark:text-white focus:outline-none font-mono font-bold tracking-wider"
                            dir="ltr"
                          />
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setShowResetPassword(!showResetPassword)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              title={showResetPassword ? 'إخفاء' : 'إظهار'}
                            >
                              {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyCredentials}
                              className="px-2 py-1 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-purple-200 transition-colors"
                              title="نسخ بيانات الدخول"
                            >
                              {copiedCredentials ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedCredentials ? 'تم النسخ' : 'نسخ'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                          <span className="font-bold block">ملخص بيانات دخول العضو بعد الحفظ:</span>
                          <div className="font-mono text-[11px] space-y-0.5 text-slate-700 dark:text-slate-300">
                            <div>• اسم المستخدم: <strong>@{username || email.split('@')[0]}</strong></div>
                            <div>• البريد الإلكتروني: <strong>{email}</strong></div>
                            <div>• كلمة المرور الجديدة: <strong>{resetPasswordInput}</strong></div>
                          </div>
                          <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-1">
                            يمكنك نسخ هذه البيانات وإرسالها للعضو عبر الواتساب أو البريد ليدخل بها ويغيرها بنفسه لاحقاً.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Permissions & Assigned Projects (For Managers only) */}
          {activeTab === 'permissions' && canManageRolesAndProjects && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Mode of operation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وضع العمليات والصلاحيات
                </label>
                <select
                  value={updateMode}
                  onChange={e => setUpdateMode(e.target.value as UpdateMode)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
                >
                  <option value="ALL_CHANGES">كامل الصلاحيات (إضافة وتعديل وحفظ)</option>
                  <option value="UPDATES_ONLY">تعديل القيود القائمة فقط</option>
                  <option value="READ_ONLY">قراءة وتدقيق فقط (بدون إضافة/تعديل)</option>
                </select>
              </div>

              {/* Role and RBAC Selector */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>تحديد الدور والصلاحية (نظام RBAC)</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    إدارة سيادية
                  </span>
                </div>

                <select
                  value={selectedRoleId}
                  onChange={e => handleRoleSelectionChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none font-bold"
                >
                  {availableRoles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.id === 'role_admin' ? '⭐ (إدارة عليا)' : ''}
                    </option>
                  ))}
                </select>

                {/* Selected Role Permissions Breakdown */}
                {currentRoleConfig && (
                  <div className="mt-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 text-[11px]">
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      {currentRoleConfig.description}
                    </p>

                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>نطاق المشاريع: <strong>{currentRoleConfig.permissions?.canViewAllProjects ? 'كافة المشاريع' : 'المشاريع المسندة'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>الاعتماد: <strong>{currentRoleConfig.permissions?.canApproveFinalManagement ? 'اعتماد نهائي' : currentRoleConfig.permissions?.canApproveAccounting ? 'مراجعة محاسبية' : 'رفع إدخالات'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>إدارة العهد: <strong>{currentRoleConfig.permissions?.canManageCustody ? 'صرف وتصفية' : 'استلام العهد'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>إدارة الفريق: <strong>{currentRoleConfig.permissions?.canManageRolesAndPermissions ? 'تحكم كامل' : 'مستخدم عادي'}</strong></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Project Assignment Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-purple-500" />
                    <span>المشاريع المسندة لهذا العضو</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllProjects}
                      className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllProjects}
                      className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                    >
                      إلغاء التحديد
                    </button>
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold font-mono mr-1">
                      ({assignedProjectIds.length})
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  وفقاً لنظام الرقابة: يرى المشرف فقط المشاريع المعين عليها، ولا يمكنه تسجيل أي مصروفات على مشاريع غير مسندة.
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  {projects.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-2">لا توجد مشاريع مضافة في النظام</div>
                  ) : (
                    projects.map(p => {
                      const isSelected = assignedProjectIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleToggleProject(p.id)}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 font-bold border border-purple-300 dark:border-purple-700'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="truncate">{p.name} ({p.code})</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 pointer-events-none"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              إلغاء
            </button>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {user
                    ? isSelfEdit
                      ? 'حفظ التعديلات وكلمة المرور'
                      : isResettingPassword
                      ? 'إعادة ضبط كلمة المرور وحفظ التعديلات'
                      : 'حفظ وتحديث بيانات العضو'
                    : 'إنشاء حساب العضو وتفعيل الدخول'}
                </span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
};

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { UserEditModal } from './UserEditModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ResetUserPasswordModal } from './ResetUserPasswordModal';
import { BatchResetPasswordModal } from './BatchResetPasswordModal';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  HardHat,
  Phone,
  Mail,
  Printer,
  X,
  Check,
  Briefcase,
  AlertTriangle,
  Lock,
  Activity,
  Shield,
  KeyRound,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Camera,
  AtSign
} from 'lucide-react';

export const SupervisorsView: React.FC = () => {
  const {
    users,
    projects,
    isUserAssignedToProject,
    supervisorsSummary,
    currentUser,
    currentUserPermissions,
    roles,
    expenses,
    custodies,
    settings,
    deleteUser,
    setPrintData,
    setIsPrintModalOpen,
    confirmAction,
    showAlert
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [isResetUserModalOpen, setIsResetUserModalOpen] = useState(false);
  const [isBatchResetModalOpen, setIsBatchResetModalOpen] = useState(false);

  const handleOpenChangePassword = (u: User) => {
    setPasswordModalUser(u);
    setIsPasswordModalOpen(true);
  };

  const handleOpenResetUser = (u: User) => {
    setResetModalUser(u);
    setIsResetUserModalOpen(true);
  };

  // Executive / Senior Management / Admin full authority check
  const canManageTeam = Boolean(
    currentUser.role?.includes('مدير') ||
    currentUser.role?.includes('تنفيذي') ||
    currentUser.role?.includes('عليا') ||
    currentUser.role?.includes('عام') ||
    currentUser.roleId === 'role_admin' ||
    currentUserPermissions?.canManageRolesAndPermissions
  );

  // Available roles (system + custom)
  const availableRoles = useMemo(() => {
    if (roles && roles.length > 0) return roles;
    return [
      {
        id: 'role_admin',
        name: 'مدير تنفيذي أو مدير عام / إدارة عليا',
        description: 'المتحكم الكامل في النظام وصاحب الصلاحيات السيادية؛ تشمل الاعتماد النهائي، وتعديل الصلاحيات والمشاريع.',
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
        description: 'تسجيل المصروفات الميدانية وإرفاق الفواتير للمشاريع المسندة له ومتابعة العهدة المستلمة.',
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


  // Check if a member has performed any operations in the program
  const getUserOperations = (u: User) => {
    const uEmail = u.email?.toLowerCase().trim();
    const uName = u.name?.trim();

    // Expenses created or approved by this user
    const linkedExpenses = expenses.filter(e =>
      (uEmail && e.supervisorEmail?.toLowerCase().trim() === uEmail) ||
      e.supervisorName?.trim() === uName ||
      e.accountantName?.trim() === uName ||
      e.managementName?.trim() === uName ||
      e.projectManagerName?.trim() === uName ||
      e.workflowHistory?.some(h =>
        (uEmail && h.actionByEmail?.toLowerCase().trim() === uEmail) ||
        h.actionByName?.trim() === uName
      )
    );

    // Custodies received or issued by this user
    const linkedCustodies = custodies.filter(c =>
      (uEmail && c.supervisorEmail?.toLowerCase().trim() === uEmail) ||
      c.supervisorName?.trim() === uName ||
      c.issuedBy?.trim() === uName ||
      (uEmail && c.issuedBy?.toLowerCase().trim() === uEmail)
    );

    const totalOps = linkedExpenses.length + linkedCustodies.length;
    const hasOps = totalOps > 0;

    const parts: string[] = [];
    if (linkedExpenses.length > 0) parts.push(`${linkedExpenses.length} سند صرف / اعتماد`);
    if (linkedCustodies.length > 0) parts.push(`${linkedCustodies.length} حركة عهدة`);

    return {
      hasOps,
      totalOps,
      expenseCount: linkedExpenses.length,
      custodyCount: linkedCustodies.length,
      details: parts.join(' و ') || 'لا توجد عمليات'
    };
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setIsModalOpen(true);
  };

  const handleDelete = (u: User) => {
    if (u.id === currentUser.id) {
      showAlert('إجراء غير مسموح', 'لا يمكنك حذف حساب المستخدم الحالي المسجل به في النظام.', 'warning');
      return;
    }

    const ops = getUserOperations(u);
    if (ops.hasOps) {
      showAlert(
        'لا يمكن حذف هذا العضو',
        `لا يمكن حذف العضو "${u.name}" من فريق العمل نهائياً لوجود (${ops.totalOps}) عملية مسجلة باسمه في البرنامج (${ops.details}). وفقاً لقواعد الرقابة والتدقيق المالي، يُمنع حذف أي عضو قام بعمليات على النظام لحماية القيود، ويُتاح فقط للمدير التنفيذي والإدارة العليا التعديل على بياناته أو إزالة تعيينات مشاريعه.`,
        'warning'
      );
      return;
    }

    confirmAction({
      title: 'تأكيد حذف العضو نهائياً',
      message: `هل أنت متأكد من حذف العضو "${u.name}" نهائياً من فريق العمل؟ لم يقم بأي عمليات مالية على النظام.`,
      details: `البريد: ${u.email} | الدور الوظيفي: ${u.role}`,
      confirmText: 'نعم، حذف العضو',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: async () => {
        await deleteUser(u.id);
      }
    });
  };

  const getRoleIcon = (r: UserRole | string, rId?: string) => {
    if (rId === 'role_admin' || r.includes('مدير') || r.includes('عليا') || r.includes('تنفيذي') || r.includes('عام')) {
      return <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
    if (rId === 'role_accountant' || r.includes('محاسب')) {
      return <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (rId === 'role_supervisor' || r === 'مشرف' || r === 'مشرف موقع' || r.includes('مشرف')) {
      return <HardHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
    return <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner with Executive Authority Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                فريق العمل والمشرفين الميدانيين
              </h2>
              {canManageTeam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  تحكم إداري كامل
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {canManageTeam
                ? 'يحق للمدير التنفيذي والإدارة العليا التحكم الكامل في تعديل أعضاء الفريق وتحديد صلاحياتهم وإسناد المشاريع مع حماية أصحاب العمليات من الحذف.'
                : 'استعراض بيانات فريق العمل والمشرفين الميدانيين ومشاريعهم المسندة.'}
            </p>
          </div>
        </div>

        {canManageTeam && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsBatchResetModalOpen(true)}
              className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs flex items-center gap-2 transition-all shrink-0 cursor-pointer"
              title="إعادة ضبط كلمات المرور لكافة مستخدمي وموظفي النظام دفعة واحدة"
            >
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>إعادة ضبط كلمة المرور للجميع</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عضو جديد للفريق</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        <Users className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="البحث باسم العضو، البريد الإلكتروني، أو الدور الوظيفي..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredUsers.map(u => {
          const supSummary = supervisorsSummary.find(s => s.email === u.email);
          const ops = getUserOperations(u);
          const assignedList = projects.filter(p => isUserAssignedToProject(u, p));
          const isUserSupervisor = u.role === 'مشرف' || u.role.includes('مشرف') || u.roleId === 'role_supervisor';

          return (
            <div
              key={u.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all gap-4"
            >
              <div>
                {/* Header: Avatar, Name, Role Badge, ID */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div className="relative group shrink-0">
                      <img
                        src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                        alt={u.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                      />
                      {(canManageTeam || u.id === currentUser.id) && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="absolute inset-0 bg-black/45 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer shadow-xs"
                          title="تعديل الصورة الشخصية"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {u.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        {getRoleIcon(u.role, u.roleId)}
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                            u.roleId === 'role_admin' || u.role?.includes('مدير') || u.role?.includes('عليا')
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : u.roleId === 'role_accountant' || u.role?.includes('محاسب')
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : u.roleId === 'role_supervisor' || u.role === 'مشرف' || u.role === 'مشرف موقع'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 shrink-0">
                    {u.id}
                  </span>
                </div>

                {/* Username & Privacy / Password Status Bar */}
                <div className="mb-3 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">اسم المستخدم:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 font-mono font-bold text-[11px] border border-purple-200 dark:border-purple-800">
                      @{u.username || (u.email ? u.email.split('@')[0] : 'user')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] flex-wrap">
                    {u.id === currentUser.id ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1" title="كلمة المرور خاصة بحسابك الشخصي">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>كلمة السر: مفعلة وخاصة بك 🔒</span>
                      </span>
                    ) : u.passwordResetByAdmin ? (
                      <span className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1" title="تم عمل إعادة ضبط لكلمة المرور بواسطة المدير">
                        <KeyRound className="w-3 h-3 text-amber-600" />
                        <span>تمت إعادة ضبط كلمة السر 🔑</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1" title="كلمة المرور خاصة بالعضو">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>كلمة السر: خاصة بالعضو 🔒</span>
                      </span>
                    )}

                    {/* Quick Button to Change Password & Username */}
                    <button
                      type="button"
                      onClick={() => handleOpenChangePassword(u)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                      title={u.id === currentUser.id ? 'تغيير كلمة المرور واسم المستخدم لحسابك' : `تعيين / تغيير كلمة المرور واسم المستخدم لـ ${u.name}`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{u.id === currentUser.id ? 'تعديل الدخول والسر' : 'تغيير كلمة السر'}</span>
                    </button>

                    {/* Direct Manager Reset Password Action */}
                    {canManageTeam && u.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => handleOpenResetUser(u)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                        title={`إعادة ضبط وتعيين كلمة المرور للعضو ${u.name} كمدير للنظام`}
                      >
                        <RotateCcw className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>ريسيت كلمة المرور</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Operations Status Badge */}
                <div className="mb-3">
                  {ops.hasOps ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-medium">
                      <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="truncate">
                        قام بـ <strong className="font-bold">{ops.totalOps}</strong> عملية بالبرنامج ({ops.details})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[11px]">
                      <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>لم يقم بعمليات مالية حتى الآن</span>
                    </div>
                  )}
                </div>

                {/* Contact Information */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-mono">{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span dir="ltr" className="font-mono">{u.phone}</span>
                    </div>
                  )}
                </div>

                {/* Supervisor financial quick balance if supervisor */}
                {supSummary && (
                  <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">الرصيد المتبقي:</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {supSummary.remainingBalance.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                      <span>إجمالي العهد: {supSummary.totalCustody.toLocaleString()}</span>
                      <span>معتمد: {supSummary.totalApprovedExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Assigned Projects */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-purple-500" />
                      <span>المشاريع المسندة:</span>
                    </span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400 font-mono text-[11px]">
                      ({assignedList.length})
                    </span>
                  </div>
                  {assignedList.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {assignedList.map(p => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-medium border border-purple-200 dark:border-purple-800"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  ) : isUserSupervisor ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>غير مسند على أي مشروع (لن يظهر له أي مشروع)</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">يملك وصولاً إدارياً ورقابياً عاماً</span>
                  )}
                </div>
              </div>

               {/* Actions Bottom Bar */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {supSummary && (
                    <button
                      type="button"
                      onClick={() => {
                        setPrintData({ type: 'custody_statement', data: supSummary });
                        setIsPrintModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="طباعة كشف حركات العهدة"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>كشف حساب</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Dedicated Change Password & Username Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenChangePassword(u)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-all cursor-pointer shadow-2xs active:scale-95"
                    title={u.id === currentUser.id ? 'تغيير كلمة المرور واسم المستخدم لحسابك' : `تعيين / تغيير كلمة المرور واسم المستخدم لـ ${u.name}`}
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>تغيير كلمة السر واسم المستخدم</span>
                  </button>

                  {/* Edit button: Managers can edit anyone; member can edit their own card */}
                  {(canManageTeam || u.id === currentUser.id) && (
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                        u.id === currentUser.id && !canManageTeam
                          ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50'
                      }`}
                      title={
                        u.id === currentUser.id
                          ? 'تعديل صورتك الشخصية واسم المستخدم وبيانات الحساب'
                          : 'تعديل الصورة واسم المستخدم والصلاحيات والمشاريع المسندة'
                      }
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{u.id === currentUser.id ? 'تعديل بياناتي' : 'تعديل الصلاحيات'}</span>
                    </button>
                  )}

                  {/* Quick Password Reset button for Manager on other members */}
                  {canManageTeam && u.id !== currentUser.id && (
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 rounded-xl text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50 border border-transparent hover:border-amber-200 dark:hover:border-amber-800 transition-colors cursor-pointer"
                      title="إعادة ضبط كلمة المرور للعضو في حال نسيان كلمة السر أو اسم المستخدم"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {canManageTeam && (
                    <>
                      {ops.hasOps ? (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                            title={`لا يمكن حذف العضو لوجود (${ops.totalOps}) عملية مسجلة باسمه في البرنامج (يُتاح التعديل فقط)`}
                            aria-label="حذف العضو مقفل لوجود عمليات مسجلة"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          </button>
                          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg shadow-lg whitespace-nowrap z-20 pointer-events-none border border-slate-700">
                            قام بعمليات بالبرنامج ({ops.totalOps}) - لا يمكن حذفه
                          </div>
                        </div>
                      ) : u.id === currentUser.id ? (
                        <div className="relative group">
                          <button
                            disabled
                            className="p-1.5 rounded-xl text-slate-300 dark:text-slate-600 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40"
                            title="لا يمكنك حذف حسابك الشخصي الحالي"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                          title="حذف العضو نهائياً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User Add / Edit Modal with Photo, Username & Password Privacy/Reset Engine */}
      <UserEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={editingUser}
        isSelfEdit={editingUser?.id === currentUser.id}
      />

      {/* Direct Dedicated Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        targetUser={passwordModalUser}
      />

      {/* Dedicated Manager Reset Password Modal for Single User */}
      <ResetUserPasswordModal
        isOpen={isResetUserModalOpen}
        onClose={() => {
          setIsResetUserModalOpen(false);
          setResetModalUser(null);
        }}
        targetUser={resetModalUser}
      />

      {/* Dedicated Manager Batch Reset Password Modal for All Users */}
      <BatchResetPasswordModal
        isOpen={isBatchResetModalOpen}
        onClose={() => setIsBatchResetModalOpen(false)}
      />

    </div>
  );
};

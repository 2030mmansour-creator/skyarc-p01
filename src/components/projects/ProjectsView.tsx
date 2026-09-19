import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Project, User } from '../../types';
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Users,
  Printer,
  X,
  Check,
  Search,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  HardHat,
  Filter,
  Layers,
  UserPlus,
  Lock,
  FolderArchive
} from 'lucide-react';
import { ProjectBondsArchiveModal } from './ProjectBondsArchiveModal';
import { SaveSyncBadge } from '../common/SaveSyncBadge';

export const ProjectsView: React.FC = () => {
  const {
    projects,
    accessibleProjects,
    expenses,
    users,
    currentUser,
    currentUserPermissions,
    hasPermission,
    isUserAssignedToProject,
    settings,
    addProject,
    updateProject,
    deleteProject,
    setPrintData,
    setIsPrintModalOpen,
    confirmAction,
    showAlert
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [archiveProject, setArchiveProject] = useState<Project | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'جاري' | 'مكتمل' | 'متوقف' | 'مؤرشف'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'my_assigned'>('all');
  const [filterSupervisorId, setFilterSupervisorId] = useState<string>('all');

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'جاري' | 'مكتمل' | 'متوقف' | 'مؤرشف'>('جاري');
  const [budget, setBudget] = useState<number | ''>('');
  const [clientName, setClientName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [pcloudPublicFolderUrl, setPcloudPublicFolderUrl] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  // Team Member Picker filter state in modal
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamRoleFilter, setTeamRoleFilter] = useState<'all' | 'supervisors' | 'pms' | 'others'>('all');

  // Permission Checks
  const canManageProjects =
    hasPermission('canManageProjects') ||
    currentUser.role?.includes('مدير') ||
    currentUser.role?.includes('تنفيذي') ||
    currentUser.role?.includes('عليا') ||
    currentUser.role?.includes('عام') ||
    currentUser.roleId === 'role_admin' ||
    currentUser.roleId === 'role_management';

  const isAccountant =
    currentUser.role === 'محاسب' ||
    currentUser.role === 'محاسب مالي' ||
    currentUser.roleId === 'role_accountant' ||
    currentUser.role.includes('محاسب');

  const canViewAllProjects = !isAccountant && !!currentUserPermissions.canViewAllProjects;

  // List of all supervisors and potential team members
  const supervisorUsers = useMemo(() => {
    return users.filter(u => u.role === 'مشرف' || u.role === 'مشرف موقع' || u.roleId === 'role_supervisor');
  }, [users]);

  const handleOpenAdd = () => {
    setEditingProject(null);
    setName('');
    setCode(`SIC-PRJ-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`);
    setStatus('جاري');
    setBudget('');
    setClientName('');
    setLocation('');
    setDescription('');
    setPcloudPublicFolderUrl('');
    // Default assign current user if supervisor, or empty
    if (!canViewAllProjects) {
      setAssignedUserIds([currentUser.id]);
    } else {
      setAssignedUserIds([]);
    }
    setTeamSearchQuery('');
    setTeamRoleFilter('all');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Project) => {
    setEditingProject(p);
    setName(p.name);
    setCode(p.code);
    setStatus(p.status);
    setBudget(p.budget);
    setClientName(p.clientName || '');
    setLocation(p.location || '');
    setDescription(p.description || '');
    setPcloudPublicFolderUrl(p.pcloudPublicFolderUrl || '');

    // Resolve initial assigned user IDs
    let initialIds: string[] = [];
    if (Array.isArray(p.assignedUserIds) && p.assignedUserIds.length > 0) {
      initialIds = [...p.assignedUserIds];
    } else {
      // Fallback matching by email
      const emailList = (p.emails || '').split(',').map(e => e.trim().toLowerCase());
      initialIds = users
        .filter(u => emailList.includes(u.email.toLowerCase()) || (p.assignedEmails && p.assignedEmails.some(ae => ae.toLowerCase() === u.email.toLowerCase())))
        .map(u => u.id);
    }
    setAssignedUserIds(initialIds);
    setTeamSearchQuery('');
    setTeamRoleFilter('all');
    setIsModalOpen(true);
  };

  const toggleUserAssignment = (userId: string) => {
    setAssignedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllSupervisors = () => {
    const supervisorIds = supervisorUsers.map(s => s.id);
    setAssignedUserIds(prev => Array.from(new Set([...prev, ...supervisorIds])));
  };

  const handleClearAllAssigned = () => {
    setAssignedUserIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      showAlert('بيانات مطلوبة', 'يرجى ملء اسم وكود المشروع بشكل صحيح.', 'warning');
      return;
    }

    // Derive assigned emails from selected user objects
    const assignedEmails = users
      .filter(u => assignedUserIds.includes(u.id))
      .map(u => u.email);
    const emailsString = assignedEmails.join(', ');

    if (editingProject) {
      await updateProject(editingProject.id, {
        name,
        code,
        status,
        budget: Number(budget) || 0,
        clientName,
        location,
        assignedUserIds,
        assignedEmails,
        emails: emailsString,
        description,
        pcloudPublicFolderUrl: pcloudPublicFolderUrl.trim() || undefined,
      });
      showAlert('تم التحديث بنجاح', `تم تحديث بيانات مشروع "${name}" وتعيين (${assignedUserIds.length}) من فريق العمل والمشرفين.`, 'info');
    } else {
      await addProject({
        name,
        code,
        status,
        budget: Number(budget) || 0,
        clientName,
        location,
        assignedUserIds,
        assignedEmails,
        emails: emailsString,
        description,
        pcloudPublicFolderUrl: pcloudPublicFolderUrl.trim() || undefined,
      });
      showAlert('تمت إضافة المشروع', `تم إنشاء مشروع "${name}" بنجاح وتعيين فريق العمل عليه.`, 'info');
    }
    setIsModalOpen(false);
  };

  const handleDelete = (p: Project) => {
    const linkedExpenses = expenses.filter(e => e.projectId === p.id);
    const count = linkedExpenses.length;
    const totalSpent = linkedExpenses.reduce((sum, e) => sum + e.amount, 0);

    if (count > 0) {
      showAlert(
        'لا يمكن حذف المشروع',
        `لا يمكن حذف مشروع "${p.name}" لوجود (${count}) عملية صرف مسجلة عليه بإجمالي (${totalSpent.toLocaleString()} ${settings.currencySymbol}). وفقاً لقواعد الرقابة المالية، يُمنع حذف أي مشروع بعد الصرف عليه لحماية القيود، ويُتاح لك فقط التعديل على بياناته.`,
        'warning'
      );
      return;
    }

    confirmAction({
      title: 'تأكيد حذف المشروع نهائياً',
      message: `هل أنت متأكد من حذف مشروع "${p.name}"؟ سيتم حذفه نهائياً وإزالته من تعيينات كافة المشرفين.`,
      details: `كود المشروع: ${p.code} | الميزانية: ${p.budget.toLocaleString()} ${settings.currencySymbol} | الحالة: ${p.status}`,
      confirmText: 'نعم، حذف المشروع',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: async () => {
        await deleteProject(p.id);
      }
    });
  };

  const handlePrintProjectReport = (p: Project) => {
    setPrintData({ type: 'project_report', data: p });
    setIsPrintModalOpen(true);
  };

  // Filtered Projects for Display
  const displayedProjects = useMemo(() => {
    // 1. Base list: if user has canViewAllProjects, use all projects; otherwise strictly accessibleProjects
    let list = canViewAllProjects ? projects : accessibleProjects;

    // 2. Scope filter (if admin chooses to see only their assigned projects)
    if (canViewAllProjects && scopeFilter === 'my_assigned') {
      list = list.filter(p => isUserAssignedToProject(currentUser, p));
    }

    // 3. Supervisor filter
    if (filterSupervisorId !== 'all') {
      list = list.filter(p => {
        const sup = users.find(u => u.id === filterSupervisorId);
        return sup ? isUserAssignedToProject(sup, p) : false;
      });
    }

    // 4. Status filter
    if (statusFilter !== 'all') {
      list = list.filter(p => p.status === statusFilter);
    } else {
      // By default in 'all', exclude archived projects to keep active screen clean
      list = list.filter(p => p.status !== 'مؤرشف');
    }

    // 5. Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.clientName && p.clientName.toLowerCase().includes(q)) ||
          (p.location && p.location.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.emails && p.emails.toLowerCase().includes(q))
      );
    }

    return list;
  }, [
    canViewAllProjects,
    projects,
    accessibleProjects,
    scopeFilter,
    filterSupervisorId,
    statusFilter,
    searchTerm,
    currentUser,
    users,
    isUserAssignedToProject
  ]);

  // Filtered users for the modal assignment list
  const filteredTeamMembers = useMemo(() => {
    return users.filter(u => {
      // Role filter
      if (teamRoleFilter === 'supervisors') {
        if (u.role !== 'مشرف' && u.role !== 'مشرف موقع' && u.roleId !== 'role_supervisor') return false;
      } else if (teamRoleFilter === 'pms') {
        if (u.role !== 'مدير مشروع' && u.roleId !== 'role_pm') return false;
      } else if (teamRoleFilter === 'others') {
        if (u.role === 'مشرف' || u.role === 'مشرف موقع' || u.role === 'مدير مشروع') return false;
      }

      // Search query
      if (teamSearchQuery.trim()) {
        const q = teamSearchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q))
        );
      }

      return true;
    });
  }, [users, teamRoleFilter, teamSearchQuery]);

  // Helper to get assigned users for a project card
  const getAssignedMembersForProject = (p: Project): User[] => {
    return users.filter(u => isUserAssignedToProject(u, p));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                دليل المشاريع والرقابة الميدانية
              </h2>
              {!canViewAllProjects ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  المشاريع المسندة إليك ({accessibleProjects.length})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  إدارة شاملة ({projects.length} مشاريع)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {canViewAllProjects
                ? 'تعيين المشرفين وفريق العمل للمشاريع والرقابة على الصرف الفعلي والميزانيات'
                : 'استعراض المشاريع المسندة إليك فقط لمتابعة النطاق الميداني وميزانيات الصرف'}
            </p>
          </div>
        </div>

        {canManageProjects && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مشروع وتعيين فريق العمل</span>
          </button>
        )}
      </div>

      {/* Access Restriction Notice for Supervisors/Team Members */}
      {!canViewAllProjects && (
        <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">
              سياسة حماية المشاريع والرقابة (Project-Based Access Control)
            </span>
            <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
              وفقاً لقواعد الأمان والرقابة المالية، تظهر لك فقط المشاريع التي تم إسنادك إليها رسمياً من قِبل إدارة المشاريع. المشاريع غير المسندة إليك لا تظهر في دليلك ولا يمكنك قيد أو تعديل أي فواتير أو سندات عليها.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث باسم المشروع، الكود، العميل، الموقع..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">كافة المشاريع النشطة (جاري، مكتمل، متوقف)</option>
              <option value="جاري">المشاريع الجارية فقط</option>
              <option value="مكتمل">المشاريع المكتملة</option>
              <option value="متوقف">المشاريع المتوقفة</option>
              <option value="مؤرشف">المشاريع المؤرشفة ({projects.filter(p => p.status === 'مؤرشف').length})</option>
            </select>
          </div>

          {/* Supervisor Filter (Visible to managers) */}
          {canViewAllProjects && (
            <div>
              <select
                value={filterSupervisorId}
                onChange={e => setFilterSupervisorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">تصفية حسب المشرف المسند (الكل)</option>
                {supervisorUsers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scope Filter for Managers */}
          {canViewAllProjects && (
            <div>
              <select
                value={scopeFilter}
                onChange={e => setScopeFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">نطاق الرؤية: كافة مشاريع الشركة ({projects.length})</option>
                <option value="my_assigned">مشاريعي المسندة فقط ({projects.filter(p => isUserAssignedToProject(currentUser, p)).length})</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Empty State if No Projects Accessible */}
      {displayedProjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-lg mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {!canViewAllProjects
                ? 'لا توجد مشاريع مسندة إليك حالياً'
                : 'لا توجد مشاريع مطابقة للبحث أو التصفية'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {!canViewAllProjects
                ? 'لم يتم تعيين حسابك على أي مشروع حتى الآن. نظام الرقابة يمنع استعراض المشاريع غير المسندة إليك أو قيد مصاريف عليها حتى يتم تعيينك من قِبل إدارة المشاريع.'
                : 'يرجى مراجعة معايير البحث أو تصفية المشرفين، أو إضافة مشروع جديد وتعيين المشرفين عليه.'}
            </p>
          </div>
          {canManageProjects && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مشروع جديد الآن</span>
            </button>
          )}
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {displayedProjects.map(p => {
            const prjExpenses = expenses.filter(e => e.projectId === p.id && e.status === 'معتمد');
            const totalLinkedExpensesCount = expenses.filter(e => e.projectId === p.id).length;
            const hasExpenses = totalLinkedExpensesCount > 0;
            const spent = prjExpenses.reduce((sum, e) => sum + e.amount, 0);
            const percent = Math.min(100, Math.round((spent / (p.budget || 1)) * 100));
            const remaining = Math.max(0, p.budget - spent);
            const assignedMembers = getAssignedMembersForProject(p);
            const isCurrentAssigned = isUserAssignedToProject(currentUser, p);

            return (
              <div
                key={p.id}
                className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border shadow-sm flex flex-col justify-between hover:shadow-md transition-all gap-4 ${
                  isCurrentAssigned
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-slate-200 dark:border-slate-800 opacity-90'
                }`}
              >
                <div>
                  {/* Top Bar: Code, Name, Status & Current User Assignment Tag */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          {p.code}
                        </span>
                        <SaveSyncBadge
                          savedLocally={p.savedLocally ?? true}
                          synced={p.synced ?? true}
                          size="sm"
                          showLabel={false}
                        />
                        {isCurrentAssigned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            أنت مسند للمشروع
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                        {p.name}
                      </h3>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                        p.status === 'جاري'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : p.status === 'مكتمل'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : p.status === 'مؤرشف'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  {/* Client & Location */}
                  <div className="space-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {p.clientName && (
                      <p>
                        العميل / المالك: <strong className="text-slate-700 dark:text-slate-300">{p.clientName}</strong>
                      </p>
                    )}
                    {p.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.location}</span>
                      </div>
                    )}
                  </div>

                  {p.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      {p.description}
                    </p>
                  )}

                  {/* Budget Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">استهلاك الميزانية:</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {percent}% ({spent.toLocaleString()} / {p.budget.toLocaleString()} {settings.currencySymbol})
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percent >= 90
                            ? 'bg-rose-500'
                            : percent >= 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>المتبقي من الميزانية: {remaining.toLocaleString()} {settings.currencySymbol}</span>
                      <span>عدد السندات المعتمدة: {prjExpenses.length}</span>
                    </div>
                  </div>

                  {/* Assigned Team & Supervisors Visual Section */}
                  <div className="mt-4 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>فريق العمل والمشرفين المسندين ({assignedMembers.length})</span>
                      </div>
                      {canManageProjects && (
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>تعيين / تعديل</span>
                        </button>
                      )}
                    </div>

                    {assignedMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedMembers.map(member => (
                          <div
                            key={member.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-semibold border ${
                              member.id === currentUser.id
                                ? 'bg-purple-50 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-[10px] font-bold">
                              {member.name.charAt(0)}
                            </div>
                            <span>{member.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({member.role})
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 p-2 rounded-xl">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>لم يتم تعيين أي مشرف أو مسؤول على هذا المشروع حتى الآن. لن يظهر لأحد من المشرفين!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handlePrintProjectReport(p)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>تقرير المشروع</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchiveProject(p)}
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200 dark:border-emerald-800 cursor-pointer shadow-2xs"
                      title="استعراض مجلد سندات المشروع وتحميل ملف الأرشيف المنفصل"
                    >
                      <FolderArchive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>أرشيف السندات ({expenses.filter(e => e.projectId === p.id && e.invoicePhoto).length})</span>
                    </button>
                  </div>

                  {canManageProjects && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="px-2.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 text-xs font-bold flex items-center gap-1 transition-colors"
                        title="تعديل المشروع وتعيين المشرفين"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                      {hasExpenses ? (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                            title={`لا يمكن حذف هذا المشروع لوجود (${totalLinkedExpensesCount}) عملية صرف مسجلة عليه (يُسمح بالتعديل فقط)`}
                            aria-label="المشروع مقفل ضد الحذف"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg shadow-lg whitespace-nowrap z-20 pointer-events-none border border-slate-700">
                            مرتبط بعمليات صرف ({totalLinkedExpensesCount}) - تعديل فقط
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                          title="حذف المشروع"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Project Modal with Team Assignment */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 flex justify-center items-start sm:items-center animate-in fade-in duration-200">
          <div className="relative my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingProject ? 'تعديل بيانات المشروع وتعيين فريق العمل' : 'إضافة مشروع وتعيين المشرفين المسؤولين'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    التحكم في الأشخاص المصرح لهم بالاطلاع وقيد المصاريف على هذا المشروع
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* Basic Project Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المشروع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: مشروع برج الأندلس الإداري"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    كود المشروع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الميزانية التقديرية المرصودة ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    placeholder="500000"
                    value={budget}
                    onChange={e => setBudget(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حالة المشروع
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="جاري">جاري (مفتوح لقيد المصروفات)</option>
                    <option value="مكتمل">مكتمل (منتهي)</option>
                    <option value="متوقف">متوقف (مغلق مؤقتاً)</option>
                    <option value="مؤرشف">مؤرشف (خارج الخدمة النشطة)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المالك / العميل
                  </label>
                  <input
                    type="text"
                    placeholder="شركة الأندلس القابضة"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    موقع المشروع الميداني
                  </label>
                  <input
                    type="text"
                    placeholder="الرياض - حي العليا"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نطاق الأعمال وملاحظات المشروع
                </label>
                <textarea
                  rows={2}
                  placeholder="أعمال المقاولات والتشطيبات الكهروميكانيكية..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Optional Project pCloud Public Folder */}
              <div className="p-3.5 rounded-2xl bg-sky-50/50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  رابط مجلد pCloud المشترك الخاص بهذا المشروع (اختياري)
                </label>
                <input
                  type="url"
                  placeholder="https://u.pcloud.link/publink/show?code=... (إن ترك فارغاً سيتم استخدام المجلد العام في الإعدادات)"
                  value={pcloudPublicFolderUrl}
                  onChange={e => setPcloudPublicFolderUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-left"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400">
                  يمكنك تخصيص مجلد pCloud مستقل لكل مشروع، أو تركه فارغاً للاعتماد على المجلد الافتراضي في إعدادات النظام.
                </p>
              </div>

              {/* Dedicated Interactive Section: Assigning Supervisors and Team Members */}
              <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border-2 border-purple-200 dark:border-purple-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-700 dark:text-purple-300" />
                      <label className="text-xs font-extrabold text-purple-950 dark:text-purple-100">
                        تعيين المشرفين وفريق العمل المسؤول عن المشروع
                      </label>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100">
                        {assignedUserIds.length} محدد
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                      أي مشرف أو عضو فريق عمل غير محدد هنا لن يظهر له المشروع ولن يتمكن من تسجيل أو تنفيذ أي عملية عليه.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllSupervisors}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 transition-colors"
                    >
                      تحديد كل المشرفين
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllAssigned}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                {/* Team Search and Tabs */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <div className="relative w-full sm:w-1/2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="بحث في المشرفين وفريق العمل..."
                      value={teamSearchQuery}
                      onChange={e => setTeamSearchQuery(e.target.value)}
                      className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setTeamRoleFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                        teamRoleFilter === 'all'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/80 dark:bg-slate-800 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800'
                      }`}
                    >
                      الكل ({users.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamRoleFilter('supervisors')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                        teamRoleFilter === 'supervisors'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/80 dark:bg-slate-800 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800'
                      }`}
                    >
                      المشرفين ({supervisorUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamRoleFilter('pms')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                        teamRoleFilter === 'pms'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/80 dark:bg-slate-800 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800'
                      }`}
                    >
                      مدراء المشاريع
                    </button>
                  </div>
                </div>

                {/* Team Members Selection Grid */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-purple-100 dark:border-purple-900">
                  {filteredTeamMembers.map(u => {
                    const isSelected = assignedUserIds.includes(u.id);

                    return (
                      <div
                        key={u.id}
                        onClick={() => toggleUserAssignment(u.id)}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-100/90 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-700 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 hover:bg-purple-50/50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                          />
                          <div className="w-7 h-7 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 flex items-center justify-center text-xs font-bold">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {u.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                                {u.role}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {u.email}
                            </span>
                          </div>
                        </div>

                        <div>
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                              <Check className="w-3 h-3" />
                              مسند للمشروع
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              غير مسند
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Members Preview Chips */}
                {assignedUserIds.length > 0 && (
                  <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/60 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200">
                      الأشخاص المختارون ({assignedUserIds.length}):
                    </span>
                    {users
                      .filter(u => assignedUserIds.includes(u.id))
                      .map(u => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-200/80 dark:bg-purple-900 text-purple-900 dark:text-purple-100"
                        >
                          <span>{u.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleUserAssignment(u.id);
                            }}
                            className="hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingProject ? 'حفظ التعديلات وتعيين الفريق' : 'إضافة المشروع وتثبيت الفريق'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Bonds & Coded Attachments Archive Modal */}
      <ProjectBondsArchiveModal
        project={archiveProject}
        isOpen={Boolean(archiveProject)}
        onClose={() => setArchiveProject(null)}
      />

    </div>
  );
};

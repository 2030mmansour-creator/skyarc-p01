import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Check,
  Sparkles,
  Link,
  Eye,
  AlignRight,
  AlignCenter,
  AlignLeft,
  EyeOff,
  Sun,
  Moon,
  Building2,
  FileText
} from 'lucide-react';
import { LogoPosition, LogoSize } from '../../types';
import { PRESET_LOGOS } from '../../utils/sampleLogos';
import { compressImageFile } from '../../utils/imageCompressor';

interface CompanyLogoManagerProps {
  companyLogo: string;
  onChangeLogo: (logo: string) => void;
  defaultPosition: LogoPosition;
  onChangePosition: (pos: LogoPosition) => void;
  defaultSize: LogoSize;
  onChangeSize: (size: LogoSize) => void;
  companyName: string;
  companySubtitle: string;
  currencySymbol: string;
}

export const CompanyLogoManager: React.FC<CompanyLogoManagerProps> = ({
  companyLogo,
  onChangeLogo,
  defaultPosition,
  onChangePosition,
  defaultSize,
  onChangeSize,
  companyName,
  companySubtitle,
  currencySymbol,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewBg, setPreviewBg] = useState<'light' | 'dark'>('light');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يفضل اختيار صورة أقل من 2 ميجابايت لضمان سرعة التحميل والحفظ.');
    }

    try {
      const compressed = await compressImageFile(file, 600, 300, 0.85);
      onChangeLogo(compressed);
      setActivePreset(null);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onChangeLogo(reader.result);
          setActivePreset(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    onChangeLogo(urlInput.trim());
    setUrlInput('');
    setIsUrlModalOpen(false);
    setActivePreset(null);
  };

  const handleSelectPreset = (preset: typeof PRESET_LOGOS[0]) => {
    onChangeLogo(preset.dataUri);
    setActivePreset(preset.id);
  };

  const handleRemoveLogo = () => {
    onChangeLogo('');
    setActivePreset(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getSizePx = (size: LogoSize) => {
    switch (size) {
      case 'sm':
        return 'h-10 w-10 sm:h-12 sm:w-12';
      case 'lg':
        return 'h-18 w-18 sm:h-20 sm:w-20';
      case 'md':
      default:
        return 'h-14 w-14 sm:h-16 sm:w-16';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>هوية وشعار المنشأة (Company Logo & Branding)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            يتم تطبيق هذا الشعار تلقائياً على كافة شاشات البرنامج، الترويسة، القائمة الجانبية، وكافة التقارير المطبوعة
          </p>
        </div>

        {companyLogo && (
          <button
            type="button"
            onClick={handleRemoveLogo}
            className="self-start sm:self-auto px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>إزالة الشعار</span>
          </button>
        )}
      </div>

      {/* Main Grid: Upload & Presets vs Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Upload & Settings): 7 cols */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500/80 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                اسحب وأفلت صورة شعار الشركة هنا، أو <span className="text-emerald-600 dark:text-emerald-400 underline">تصفح ملفات جهازك</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                يدعم صيغ PNG, JPG, SVG, WebP (يُفضل صورة بخلفية شفافة بدقة عالية)
              </p>
            </div>

            <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(!isUrlModalOpen)}
                className="px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 flex items-center gap-1"
              >
                <Link className="w-3 h-3 text-slate-500" />
                <span>إدخال رابط صورة مباشرة (URL)</span>
              </button>
            </div>
          </div>

          {/* URL Input collapse */}
          {isUrlModalOpen && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/company-logo.png"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0"
              >
                تطبيق
              </button>
            </div>
          )}

          {/* Preset Logos for 1-click test */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>أو اختر من النماذج الاحترافية الجاهزة (تجربة فورية):</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRESET_LOGOS.map((preset) => {
                const isSelected = activePreset === preset.id || companyLogo === preset.dataUri;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      <img
                        src={preset.dataUri}
                        alt={preset.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 text-center line-clamp-1">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                        ✓ مفعّل
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Report Defaults Controls */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                الموضع الافتراضي للشعار في التقارير وسندات الطباعة:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'right' as LogoPosition, label: 'أعلى اليمين', icon: AlignRight },
                  { id: 'center' as LogoPosition, label: 'الوسط', icon: AlignCenter },
                  { id: 'left' as LogoPosition, label: 'أعلى اليسار', icon: AlignLeft },
                  { id: 'hidden' as LogoPosition, label: 'بدون شعار', icon: EyeOff },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = defaultPosition === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangePosition(item.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 font-bold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ملاحظة: يمكنك دائماً تغيير موضع الشعار لكل تقرير على حدة من داخل نافذة الطباعة مباشرة.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                الحجم الافتراضي للشعار في التقارير:
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'sm' as LogoSize, label: 'صغير (48px)' },
                  { id: 'md' as LogoSize, label: 'متوسط (64px)' },
                  { id: 'lg' as LogoSize, label: 'كبير (80px)' },
                ].map((item) => {
                  const isSelected = defaultSize === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeSize(item.id)}
                      className={`flex-1 py-1.5 px-3 rounded-xl border text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 font-bold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Interactive Live Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/80 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>المعاينة الحية لهوية الشركة</span>
              </span>

              {/* Theme Toggle for Preview */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewBg('light')}
                  className={`p-1 rounded text-xs ${
                    previewBg === 'light'
                      ? 'bg-slate-100 text-slate-800 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="معاينة على خلفية فاتحة"
                >
                  <Sun className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('dark')}
                  className={`p-1 rounded text-xs ${
                    previewBg === 'dark'
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="معاينة على خلفية داكنة"
                >
                  <Moon className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 1. App Header Preview */}
            <div className="space-y-1 mb-4">
              <span className="text-[10px] font-bold text-slate-400">1. المظهر في شريط العنوان (Header & Nav)</span>
              <div
                className={`p-3 rounded-xl border transition-colors flex items-center justify-between ${
                  previewBg === 'light'
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-slate-800 text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center shrink-0 p-1">
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Building2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-none">{companyName || 'اسم المنشأة'}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[170px]">
                      {companySubtitle || 'إدارة المصروفات والعهد'}
                    </p>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                  PRO
                </span>
              </div>
            </div>

            {/* 2. Official Printed Report Header Preview */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400">2. المظهر في ترويسة التقارير الرسمية المطبوعة</span>
              <div className="p-4 rounded-xl border-2 border-slate-300 bg-white text-slate-900 shadow-sm text-xs font-sans">
                
                {/* Header preview based on defaultPosition */}
                {defaultPosition === 'center' ? (
                  <div className="text-center space-y-2 pb-3 border-b-2 border-slate-800">
                    {companyLogo && (
                      <div className="flex justify-center">
                        <img
                          src={companyLogo}
                          alt="Logo"
                          className={`${getSizePx(defaultSize)} object-contain`}
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-black text-sm text-slate-900">{companyName}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">{companySubtitle}</p>
                      <span className="text-[9px] text-slate-400 font-mono">سند رسمي رقم #1029</span>
                    </div>
                  </div>
                ) : defaultPosition === 'left' ? (
                  <div className="flex items-start justify-between pb-3 border-b-2 border-slate-800">
                    <div>
                      <h3 className="font-black text-sm text-slate-900">{companyName}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">{companySubtitle}</p>
                      <span className="text-[9px] text-slate-400 font-mono">تاريخ الطباعة: اليوم</span>
                    </div>
                    {companyLogo && (
                      <div className="shrink-0">
                        <img
                          src={companyLogo}
                          alt="Logo"
                          className={`${getSizePx(defaultSize)} object-contain`}
                        />
                      </div>
                    )}
                  </div>
                ) : defaultPosition === 'right' ? (
                  <div className="flex items-start justify-between pb-3 border-b-2 border-slate-800">
                    <div className="flex items-start gap-2.5">
                      {companyLogo && (
                        <div className="shrink-0">
                          <img
                            src={companyLogo}
                            alt="Logo"
                            className={`${getSizePx(defaultSize)} object-contain`}
                          />
                        </div>
                      )}
                      <div>
                        <h3 className="font-black text-sm text-slate-900">{companyName}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">{companySubtitle}</p>
                      </div>
                    </div>
                    <div className="text-left text-[9px] text-slate-400 font-mono">
                      <span>REF: #883910</span>
                      <span className="block mt-0.5">سند معتمد</span>
                    </div>
                  </div>
                ) : (
                  /* Hidden */
                  <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800">
                    <div>
                      <h3 className="font-black text-sm text-slate-900">{companyName}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">{companySubtitle}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">سند رسمي</span>
                  </div>
                )}

                {/* Sample summary voucher content */}
                <div className="pt-2 flex justify-between text-[10px] text-slate-500">
                  <span>سند صرف واستعاضة</span>
                  <span className="font-bold text-emerald-700">15,400 {currencySymbol}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>يتم تخزين الشعار محلياً وسحابياً ليكون متاحاً دائماً لكافة المستخدمين.</span>
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SlidersHorizontal,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Search,
  X,
  CheckSquare,
  Square,
  Columns3
} from 'lucide-react';

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
  description?: string;
  category?: string;
}

export interface UseColumnVisibilityProps {
  storageKey: string;
  columns: ColumnDefinition[];
}

export function useColumnVisibility(storageKey: string, initialColumns: ColumnDefinition[]) {
  // Compute default visible IDs
  const defaultVisibleIds = useMemo(() => {
    return initialColumns
      .filter(c => c.defaultVisible !== false || c.alwaysVisible)
      .map(c => c.id);
  }, [initialColumns]);

  // Load from localStorage or fallback to defaults
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure alwaysVisible columns are always present
          const alwaysVisibleIds = initialColumns.filter(c => c.alwaysVisible).map(c => c.id);
          const combined = Array.from(new Set([...parsed, ...alwaysVisibleIds]));
          return combined;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return defaultVisibleIds;
  });

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
    } catch {
      // ignore storage full error
    }
  }, [storageKey, visibleColumns]);

  const isVisible = (columnId: string) => {
    return visibleColumns.includes(columnId);
  };

  const toggleColumn = (columnId: string) => {
    const colDef = initialColumns.find(c => c.id === columnId);
    if (colDef?.alwaysVisible) return; // Cannot toggle always visible columns

    setVisibleColumns(prev => {
      if (prev.includes(columnId)) {
        // Prevent hiding ALL columns: must keep at least 1 column visible
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== columnId);
      } else {
        return [...prev, columnId];
      }
    });
  };

  const showAll = () => {
    setVisibleColumns(initialColumns.map(c => c.id));
  };

  const resetToDefault = () => {
    setVisibleColumns(defaultVisibleIds);
  };

  const hideOptional = () => {
    // Keep only essential columns (alwaysVisible or first 4 default)
    const essential = initialColumns.filter(c => c.alwaysVisible).map(c => c.id);
    if (essential.length > 0) {
      setVisibleColumns(essential);
    } else {
      setVisibleColumns(initialColumns.slice(0, 4).map(c => c.id));
    }
  };

  return {
    visibleColumns,
    isVisible,
    toggleColumn,
    showAll,
    resetToDefault,
    hideOptional,
    setVisibleColumns,
  };
}

interface ColumnVisibilityDropdownProps {
  columns: ColumnDefinition[];
  visibleColumns: string[];
  onToggleColumn: (columnId: string) => void;
  onShowAll: () => void;
  onResetToDefault: () => void;
  onHideOptional?: () => void;
  buttonLabel?: string;
  className?: string;
  align?: 'left' | 'right';
}

export const ColumnVisibilityDropdown: React.FC<ColumnVisibilityDropdownProps> = ({
  columns,
  visibleColumns,
  onToggleColumn,
  onShowAll,
  onResetToDefault,
  onHideOptional,
  buttonLabel = 'تخصيص الأعمدة',
  className = '',
  align = 'left'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return columns;
    const query = searchQuery.toLowerCase().trim();
    return columns.filter(c =>
      c.label.toLowerCase().includes(query) ||
      (c.description && c.description.toLowerCase().includes(query))
    );
  }, [columns, searchQuery]);

  const visibleCount = visibleColumns.length;
  const totalCount = columns.length;
  const allVisible = visibleCount === totalCount;

  return (
    <div className={`relative inline-block text-right ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
          isOpen
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
            : visibleCount < totalCount
            ? 'bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
            : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
        }`}
        title="إظهار أو إخفاء أعمدة الجدول لتسهيل القراءة وتوفير مساحة العرض"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{buttonLabel}</span>
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
            visibleCount < totalCount
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          {visibleCount}/{totalCount}
        </span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'left' ? 'left-0 sm:left-auto sm:right-0' : 'right-0'
          } mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col`}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                <Columns3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  تخصيص أعمدة الجدول
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {visibleCount} من {totalCount} عمود معروضة حالياً
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Search within Columns */}
          {columns.length > 5 && (
            <div className="relative shrink-0">
              <input
                type="text"
                placeholder="ابحث عن عمود..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5 shrink-0 text-[11px]">
            <button
              type="button"
              onClick={onShowAll}
              disabled={allVisible}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3 h-3 text-emerald-600" />
              <span>إظهار الكل</span>
            </button>

            <button
              type="button"
              onClick={onResetToDefault}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors flex items-center gap-1 cursor-pointer"
              title="إعادة التعيين للشكل الافتراضي"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>الافتراضي</span>
            </button>

            {onHideOptional && (
              <button
                type="button"
                onClick={onHideOptional}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="عرض الأعمدة الأساسية فقط لتوفير المساحة"
              >
                <EyeOff className="w-3 h-3 text-amber-600" />
                <span>مختصر</span>
              </button>
            )}
          </div>

          {/* Column Toggles List */}
          <div className="overflow-y-auto space-y-1 pr-0.5 max-h-60 custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredColumns.map(col => {
              const isChecked = visibleColumns.includes(col.id);
              const isLocked = col.alwaysVisible;

              return (
                <label
                  key={col.id}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 opacity-70'
                  } ${isLocked ? 'cursor-not-allowed opacity-90' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLocked}
                      onChange={() => onToggleColumn(col.id)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                    />
                    <div className="truncate">
                      <span className={`block font-bold truncate ${isChecked ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {col.label}
                      </span>
                      {col.description && (
                        <span className="block text-[10px] text-slate-400 truncate">
                          {col.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 mr-2">
                    {isLocked ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        أساسي
                      </span>
                    ) : isChecked ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                    )}
                  </div>
                </label>
              );
            })}

            {filteredColumns.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">
                لا توجد أعمدة مطابقة للبحث
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
            <span>تُحفظ خياراتك تلقائياً لهذا المتصفح</span>
            <span className="font-mono">{visibleCount}/{totalCount}</span>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface SlideOverDrawerProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  widthClass?: string;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  id,
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footerActions,
  widthClass = 'max-w-xl',
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id={id}
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={`w-screen ${widthClass} bg-white shadow-2xl flex flex-col border-l border-[#E3E4E6] animate-in slide-in-from-right duration-250`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#E3E4E6] flex items-center justify-between bg-[#F8F9FA]">
            <div>
              <h2 className="text-base font-extrabold text-[#171717]">{title}</h2>
              {subtitle && (
                <p className="text-xs text-[#666666] mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#666666] hover:text-[#171717] hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {children}
          </div>

          {/* Optional Footer Actions */}
          {footerActions && (
            <div className="px-6 py-4 border-t border-[#E3E4E6] bg-[#F8F9FA] flex items-center justify-end gap-3">
              {footerActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

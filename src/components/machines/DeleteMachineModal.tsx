import React from 'react';
import { Loader2 } from 'lucide-react';
import type { Machine } from '../../types';

export interface DeleteMachineModalProps {
  isOpen: boolean;
  machine: Machine | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteMachineModal: React.FC<DeleteMachineModalProps> = ({
  isOpen,
  machine,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen || !machine) return null;

  const isAssigned = Boolean(machine.organization_id);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={isDeleting ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-[#E5E7EB] p-6 text-left transform transition-all animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <h3 className="text-base font-bold text-[#171717]">
            Delete {machine.serial_number || machine.machine_code}?
          </h3>

          {/* Description */}
          <p className="text-xs text-[#666666] mt-2.5 leading-relaxed">
            This will archive the machine from active fleet inventory.
          </p>

          {isAssigned && (
            <div className="mt-3.5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              This machine is currently assigned to a client. Only unassigned available machines can be removed from fleet inventory.
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-[#F3F4F6]">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#171717] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting || isAssigned}
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#E32032] hover:bg-[#C1121F] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete machine</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

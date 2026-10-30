import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { orgsApi } from '../../services/api';
import type { Organization } from '../../types';

export interface DeleteClientModalProps {
  isOpen: boolean;
  client?: Organization | null;
  selectedClients?: Organization[];
  onClose: () => void;
  onSuccess: (deletedIds: string[]) => void;
}

export const DeleteClientModal: React.FC<DeleteClientModalProps> = ({
  isOpen,
  client,
  selectedClients,
  onClose,
  onSuccess,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Determine if single or multiple deletion
  const clientsToDelete = selectedClients && selectedClients.length > 0
    ? selectedClients
    : client
    ? [client]
    : [];

  if (clientsToDelete.length === 0) return null;

  const isMultiple = clientsToDelete.length > 1;
  const title = isMultiple
    ? `Delete ${clientsToDelete.length} clients?`
    : `Delete ${clientsToDelete[0].company_name}?`;

  const buttonLabel = isMultiple ? 'Delete clients' : 'Delete client';

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const ids = clientsToDelete.map((c) => c.id);
      if (ids.length === 1) {
        await orgsApi.delete(ids[0]);
      } else {
        await orgsApi.bulkDelete(ids);
      }
      onSuccess(ids);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete client record(s).');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Confirmation Dialog Card */}
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E3E4E6] overflow-hidden z-10 animate-in zoom-in-95 duration-200 p-6 sm:p-7">
        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-[#171717] tracking-tight">
          {title}
        </h3>

        {/* Explanatory Text */}
        <p className="text-xs sm:text-[13px] text-[#4B5563] mt-3 leading-relaxed">
          The client record is archived for 30 days and then permanently removed, along with its contacts. Machines and their history stay with PowerTech Energy and are unassigned. Every deletion is recorded in the audit log.
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#E32032] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions (Right aligned) */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#D1D5DB] bg-white text-[#171717] hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>{buttonLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

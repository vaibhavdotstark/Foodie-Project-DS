import React, { useState } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { usersApi } from '../../services/api';
import type { User } from '../../types';

export interface DeleteUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: (deletedUserId: string) => void;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const roleLabel =
    user.role === 'SITE_MANAGER'
      ? 'Site Manager'
      : user.role === 'OPERATOR'
      ? 'Operator'
      : user.role === 'ORGANISATION_OWNER' || user.role === 'SITE_ADMIN'
      ? 'Organisation Owner'
      : 'User';

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await usersApi.delete(user.id);
      onSuccess(user.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setError(err?.message || 'Failed to delete user. Please try again.');
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
        className="fixed inset-0 bg-black/50 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={() => !isDeleting && onClose()}
        aria-hidden="true"
      />

      {/* Confirmation Dialog Card */}
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#E5E7EB] overflow-hidden z-10 animate-in zoom-in-95 duration-200 p-6">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-[#E32032] shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#111827] tracking-tight">
              Delete {roleLabel.toLowerCase()}?
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {user.email}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#E32032] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-xs text-[#4B5563] leading-relaxed mb-6">
          Are you sure you want to delete <span className="font-semibold text-[#111827]">{user.first_name} {user.last_name}</span> ({roleLabel})? This account will be deactivated and removed from this organisation.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete user</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


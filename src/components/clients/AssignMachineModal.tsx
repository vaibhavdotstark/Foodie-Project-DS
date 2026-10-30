import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { machinesApi } from '../../services/api';
import type { Organization, Machine } from '../../types';

export interface AssignMachineRow {
  machine_id: string;
  location: string;
  lease_start_date: string;
  lease_end_date: string;
}

const calculateFiveYearsLater = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const targetYear = y + 5;
  if (m === 2 && d === 29) {
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    const targetDay = isLeap ? 29 : 28;
    return `${targetYear}-02-${String(targetDay).padStart(2, '0')}`;
  }
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

export interface AssignMachineModalProps {
  isOpen: boolean;
  client: Organization | null;
  assignedMachinesCount?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignMachineModal: React.FC<AssignMachineModalProps> = ({
  isOpen,
  client,
  assignedMachinesCount = 0,
  onClose,
  onSuccess,
}) => {
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];
  const [rows, setRows] = useState<AssignMachineRow[]>([
    {
      machine_id: '',
      location: '',
      lease_start_date: todayStr,
      lease_end_date: calculateFiveYearsLater(todayStr),
    },
  ]);

  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all unassigned machines from PostgreSQL
  useEffect(() => {
    if (isOpen) {
      setIsLoadingMachines(true);
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      setRows([
        {
          machine_id: '',
          location: '',
          lease_start_date: today,
          lease_end_date: calculateFiveYearsLater(today),
        },
      ]);

      machinesApi
        .getAll()
        .then((allMachines) => {
          // Assign Machine: Assign only available machines (not assigned to any client)
          const unassigned = allMachines.filter((m) => !m.organization_id);
          setAvailableMachines(unassigned);
        })
        .catch((err) => {
          console.error('Failed to load available machines:', err);
          setError('Failed to load available fleet machines.');
        })
        .finally(() => {
          setIsLoadingMachines(false);
        });
    }
  }, [isOpen, client]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
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

  if (!isOpen || !client) return null;

  const handleRowChange = (index: number, field: keyof AssignMachineRow, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      if (field === 'lease_start_date') {
        copy[index] = {
          ...copy[index],
          lease_start_date: value,
          lease_end_date: calculateFiveYearsLater(value),
        };
      } else {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
    if (error) setError(null);
  };

  const handleAddRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setRows((prev) => [
      ...prev,
      {
        machine_id: '',
        location: '',
        lease_start_date: today,
        lease_end_date: calculateFiveYearsLater(today),
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    const today = new Date().toISOString().split('T')[0];
    if (rows.length === 1) {
      setRows([
        {
          machine_id: '',
          location: '',
          lease_start_date: today,
          lease_end_date: calculateFiveYearsLater(today),
        },
      ]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedRows = rows.filter((r) => r.machine_id.trim());
    if (selectedRows.length === 0) {
      setError('Please select at least one machine to assign.');
      return;
    }

    // Check duplicate machine selections in form
    const ids = selectedRows.map((r) => r.machine_id);
    const hasDuplicates = new Set(ids).size !== ids.length;
    if (hasDuplicates) {
      setError('You have selected the same machine multiple times.');
      return;
    }

    // Validate lease end date is not earlier than lease start date
    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      if (row.lease_start_date && row.lease_end_date && row.lease_end_date < row.lease_start_date) {
        setError(`Row #${i + 1}: Lease end date cannot be earlier than lease start date.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await Promise.all(
        selectedRows.map((row) =>
          machinesApi.update(row.machine_id, {
            organization_id: client.id,
            location_label: row.location.trim() || undefined,
            lease_start_date: row.lease_start_date || undefined,
            lease_end_date: row.lease_end_date || undefined,
            lease_status: 'Active',
          })
        )
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to assign machines.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
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

      {/* Slide-over Drawer (Right to Left) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col pointer-events-auto transform transition-transform duration-200 ease-in-out animate-in slide-in-from-right">
          {/* Header */}
          <div className="px-8 py-6 border-b border-[#E5E7EB] flex items-start justify-between bg-white shrink-0">
            <div>
              <h2 className="text-xl font-bold text-[#111827] tracking-tight">
                Assign machine
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Lease Foodie machines to {client.company_name}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-[#E32032] font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Top Summary Card (Matching screenshot) */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-2xs">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[#6B7280] block text-[11px] mb-1">Client</span>
                  <span className="font-semibold text-[#111827] truncate block">
                    {client.company_name}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px] mb-1">Client ID</span>
                  <span className="font-semibold text-[#111827]">
                    {client.client_code}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px] mb-1">Machines assigned</span>
                  <span className="font-semibold text-[#111827]">
                    {assignedMachinesCount}
                  </span>
                </div>
              </div>
            </div>

            <form id="assign-machine-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Section Header */}
              <div>
                <h3 className="text-sm font-bold text-[#111827] tracking-tight">
                  Machines to assign
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5 mb-3">
                  Only machines that are not mapped to another client are listed.
                </p>
              </div>

              {/* Table of Rows */}
              <div className="space-y-3">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-[#6B7280] px-1">
                  <div className="col-span-4">Serial Number</div>
                  <div className="col-span-3">Location</div>
                  <div className="col-span-2">Lease start date</div>
                  <div className="col-span-2">Lease end date (if applicable)</div>
                  <div className="col-span-1 text-right"></div>
                </div>

                {/* Rows */}
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center bg-white"
                  >
                    {/* Machine Selector */}
                    <div className="col-span-4 relative">
                      <select
                        value={row.machine_id}
                        onChange={(e) => handleRowChange(idx, 'machine_id', e.target.value)}
                        disabled={isLoadingMachines}
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-2.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all appearance-none pr-7 cursor-pointer"
                      >
                        <option value="">Select available / unmapped machine</option>
                        {availableMachines.map((m) => {
                          const isAlreadySelected = rows.some(
                            (r, i) => i !== idx && r.machine_id === m.id
                          );
                          return (
                            <option
                              key={m.id}
                              value={m.id}
                              disabled={isAlreadySelected}
                            >
                              {m.machine_code || m.serial_number} · {m.model}
                            </option>
                          );
                        })}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#6B7280]">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={row.location}
                        onChange={(e) => handleRowChange(idx, 'location', e.target.value)}
                        placeholder="Enter text"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-2.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>

                    {/* Lease Start Date */}
                    <div className="col-span-2">
                      <input
                        type="date"
                        value={row.lease_start_date}
                        onChange={(e) =>
                          handleRowChange(idx, 'lease_start_date', e.target.value)
                        }
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-2 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer"
                      />
                    </div>

                    {/* Lease End Date */}
                    <div className="col-span-2">
                      <input
                        type="date"
                        value={row.lease_end_date}
                        onChange={(e) =>
                          handleRowChange(idx, 'lease_end_date', e.target.value)
                        }
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-2 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer"
                      />
                    </div>

                    {/* Remove Action */}
                    <div className="col-span-1 text-right">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1.5 text-[#9CA3AF] hover:text-[#E32032] rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* + Add another machine Button */}
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-full py-2.5 rounded-lg border border-[#D1D5DB] text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-3"
                >
                  <Plus className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Add another machine</span>
                </button>
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="px-8 py-4 border-t border-[#E5E7EB] bg-white flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="assign-machine-form"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-[#E32032] hover:bg-[#C1121F] text-white transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <span>Assign machines</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


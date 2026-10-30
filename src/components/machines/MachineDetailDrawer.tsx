import React, { useEffect } from 'react';
import { X, Cpu, MapPin, Wrench, Edit2, Trash2 } from 'lucide-react';
import type { Machine } from '../../types';

export interface MachineDetailDrawerProps {
  isOpen: boolean;
  machine: Machine | null;
  onClose: () => void;
  onEdit: (machine: Machine) => void;
  onDelete: (machine: Machine) => void;
}

export const MachineDetailDrawer: React.FC<MachineDetailDrawerProps> = ({
  isOpen,
  machine,
  onClose,
  onEdit,
  onDelete,
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

  // Lock body scroll while open
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

  if (!isOpen || !machine) return null;

  const isOnline = machine.connectivity_status?.toLowerCase() === 'online';
  const opStatus = machine.operational_status || 'Idle';
  const isAssigned = Boolean(machine.organization_id);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-2xs transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer (Right to Left) */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col pointer-events-auto transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF5F5] border border-[#FEE2E2] flex items-center justify-center text-[#E32032]">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#171717] tracking-tight">
                    {machine.serial_number || machine.machine_code}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      isOnline
                        ? 'bg-[#EAFBF1] text-[#0A7135] border-[#B7F4CE]'
                        : 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOnline ? 'bg-[#00C951]' : 'bg-[#9CA3AF]'
                      }`}
                    />
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      opStatus === 'Running'
                        ? 'bg-[#EAFBF1] text-[#0A7135] border-[#B7F4CE]'
                        : opStatus === 'Idle'
                        ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                        : opStatus === 'Maintenance'
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                        : 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
                    }`}
                  >
                    <span>{opStatus}</span>
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {machine.model}{machine.capacity ? ` · ${machine.capacity}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#6B7280] hover:text-[#171717] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Section 1: Machine Specifications */}
            <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[#E5E7EB]">
              <h4 className="text-xs font-bold text-[#171717] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-[#E32032]" />
                <span>Machine Specifications</span>
              </h4>
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Serial Number</span>
                  <span className="font-mono font-semibold text-[#171717]">{machine.serial_number || machine.machine_code}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Model & Capacity</span>
                  <span className="font-semibold text-[#171717]">
                    {machine.model}{machine.capacity ? ` (${machine.capacity})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Hardware Version</span>
                  <span className="font-semibold text-[#171717]">{machine.hardware_version || '—'}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Fleet Assignment</span>
                  <span className="font-semibold text-[#171717]">
                    {machine.company_name ? `${machine.company_name} (${machine.client_code || 'Assigned'})` : 'Available (Unassigned)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Location */}
            <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[#E5E7EB]">
              <h4 className="text-xs font-bold text-[#171717] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#E32032]" />
                <span>Location</span>
              </h4>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Installation Location</span>
                  <span className="font-semibold text-[#171717]">{machine.location_label || '—'}</span>
                </div>
                {machine.location_description && (
                  <div>
                    <span className="text-[#6B7280] block text-[11px]">Location Description</span>
                    <span className="text-[#374151] leading-relaxed">{machine.location_description}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Hardware & Software */}
            <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[#E5E7EB]">
              <h4 className="text-xs font-bold text-[#171717] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#E32032]" />
                <span>Hardware & Software</span>
              </h4>
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div>
                  <span className="text-[#6B7280] block text-[11px]">PLC Software Version</span>
                  <span className="font-semibold text-[#171717]">{machine.plc_software_version || '—'}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Energy Meter Model</span>
                  <span className="font-semibold text-[#171717]">{machine.energy_meter_model || '—'}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Deodor Model</span>
                  <span className="font-semibold text-[#171717]">{machine.deodor_model || '—'}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Extractor Model</span>
                  <span className="font-semibold text-[#171717]">{machine.extractor_model || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[#6B7280] block text-[11px]">Stairs Access Required</span>
                  <span className="font-semibold text-[#171717]">{machine.has_stairs ? 'Yes' : 'No'}</span>
                </div>
                {machine.notes && (
                  <div className="col-span-2">
                    <span className="text-[#6B7280] block text-[11px]">Notes</span>
                    <span className="text-[#374151] leading-relaxed">{machine.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Docked Action Footer */}
          <div className="px-6 py-4 bg-white border-t border-[#E5E7EB] flex items-center justify-between shrink-0">
            {/* Delete button: only enabled for available (unassigned) machines */}
            <button
              type="button"
              onClick={() => onDelete(machine)}
              disabled={isAssigned}
              title={isAssigned ? 'Only available unassigned machines can be deleted' : 'Delete machine'}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                isAssigned
                  ? 'text-[#9CA3AF] cursor-not-allowed opacity-60'
                  : 'text-[#E32032] hover:bg-red-50 cursor-pointer'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isAssigned ? 'Assigned (Cannot Delete)' : 'Delete machine'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#D1D5DB] text-[#171717] bg-white hover:bg-[#F9FAFB] transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => onEdit(machine)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#171717] hover:bg-[#333333] text-white transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-white" />
                <span>Edit machine</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

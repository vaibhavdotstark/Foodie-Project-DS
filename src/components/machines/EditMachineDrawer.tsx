import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Save } from 'lucide-react';
import { machinesApi } from '../../services/api';
import type { Machine, MachineModel } from '../../types';

export interface EditMachineDrawerProps {
  isOpen: boolean;
  machine: Machine | null;
  onClose: () => void;
  onSuccess: (updated: Machine) => void;
}

export const EditMachineDrawer: React.FC<EditMachineDrawerProps> = ({
  isOpen,
  machine,
  onClose,
  onSuccess,
}) => {
  const [machineModels, setMachineModels] = useState<MachineModel[]>([]);
  const [formData, setFormData] = useState({
    serial_number: '',
    model: 'Foodie F25',
    version: '',
    capacity: '',
    location: '',
    location_description: '',
    plc_software_version: '',
    energy_meter_model: '',
    deodor_model: '',
    extractor_model: '',
    has_stairs: false,
    notes: '',
    connectivity_status: 'Offline',
    operational_status: 'Idle',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load machine models and populate form when drawer opens
  useEffect(() => {
    if (isOpen && machine) {
      setError(null);
      setIsSubmitting(false);

      machinesApi
        .getModels()
        .then((data) => {
          const order = ['F25', 'F100', 'F500', 'F1000'];
          const sorted = [...data].sort((a, b) => {
            const idxA = order.indexOf(a.model_code);
            const idxB = order.indexOf(b.model_code);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            return a.model_code.localeCompare(b.model_code);
          });
          setMachineModels(sorted);
        })
        .catch((err) => console.error('Failed to load machine models:', err));

      setFormData({
        serial_number: machine.serial_number || machine.machine_code || '',
        model: machine.model || 'Foodie F25',
        version: machine.hardware_version || '',
        capacity: machine.capacity || '',
        location: machine.location_label || '',
        location_description: machine.location_description || '',
        plc_software_version: machine.plc_software_version || '',
        energy_meter_model: machine.energy_meter_model || '',
        deodor_model: machine.deodor_model || '',
        extractor_model: machine.extractor_model || '',
        has_stairs: Boolean(machine.has_stairs),
        notes: machine.notes || '',
        connectivity_status: machine.connectivity_status || 'Offline',
        operational_status: machine.operational_status || 'Idle',
      });
    }
  }, [isOpen, machine]);

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === 'model') {
      setFormData((prev) => ({
        ...prev,
        model: value,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.model.trim()) {
      setError('Model is required.');
      return;
    }
    if (!formData.version.trim()) {
      setError('Version is required.');
      return;
    }
    if (!formData.location.trim()) {
      setError('Location is required.');
      return;
    }
    if (!formData.plc_software_version.trim()) {
      setError('PLC software version is required.');
      return;
    }
    if (!formData.energy_meter_model.trim()) {
      setError('Energy meter model is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await machinesApi.update(machine.id, {
        model: formData.model,
        capacity: formData.capacity.trim() ? formData.capacity.trim() : null,
        hardware_version: formData.version.trim() || undefined,
        location_label: formData.location.trim() || undefined,
        location_description: formData.location_description.trim() || undefined,
        plc_software_version: formData.plc_software_version.trim() || undefined,
        energy_meter_model: formData.energy_meter_model.trim() || undefined,
        deodor_model: formData.deodor_model.trim() || undefined,
        extractor_model: formData.extractor_model.trim() || undefined,
        has_stairs: Boolean(formData.has_stairs),
        notes: formData.notes.trim() || undefined,
        connectivity_status: formData.connectivity_status,
        operational_status: formData.operational_status,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update machine.');
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
                Edit machine
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                {machine.machine_code || machine.serial_number} · {machine.model}
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
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-7">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-[#E32032] font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form id="edit-machine-form" onSubmit={handleSubmit} className="space-y-7">
              {/* ---------------------------------------------------- */}
              {/* Section 1: Machine */}
              {/* ---------------------------------------------------- */}
              <div>
                <h3 className="text-sm font-bold text-[#111827] tracking-tight">
                  Machine
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5 mb-4">
                  Serial number is permanently registered and non-editable.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  {/* Serial number (Disabled) */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Serial number
                    </label>
                    <input
                      type="text"
                      name="serial_number"
                      value={formData.serial_number}
                      disabled
                      className="w-full bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#6B7280] font-mono font-semibold uppercase cursor-not-allowed"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Model
                    </label>
                    <div className="relative">
                      <select
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all appearance-none cursor-pointer pr-9"
                      >
                        {machineModels.length > 0 ? (
                          machineModels.map((m) => (
                            <option key={m.id} value={m.display_name}>
                              {m.model_code}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Foodie F25">F25</option>
                            <option value="Foodie F100">F100</option>
                            <option value="Foodie F500">F500</option>
                            <option value="Foodie F1000">F1000</option>
                          </>
                        )}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#6B7280]">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Version (optional) */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Version (optional)
                    </label>
                    <input
                      type="text"
                      name="version"
                      value={formData.version}
                      onChange={handleChange}
                      placeholder="e.g. v1"
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                    />
                  </div>

                  {/* Capacity */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Capacity
                    </label>
                    <input
                      type="text"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleChange}
                      placeholder="e.g. 500 kg/day"
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* Section 2: Location */}
              {/* ---------------------------------------------------- */}
              <div>
                <h3 className="text-sm font-bold text-[#111827] tracking-tight mb-4">
                  Location
                </h3>

                <div className="space-y-4">
                  {/* Location */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="e.g. 2 Discovery Way, Mawson Lakes 5095"
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      required
                    />
                  </div>

                  {/* Location description */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Location description (optional)
                    </label>
                    <textarea
                      name="location_description"
                      value={formData.location_description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="e.g. Installed at the carpark shed of the client's location"
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all resize-y min-h-[72px]"
                    />
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* Section 3: Hardware & software */}
              {/* ---------------------------------------------------- */}
              <div>
                <h3 className="text-sm font-bold text-[#111827] tracking-tight mb-4">
                  Hardware & software
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                    {/* PLC software version */}
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        PLC software version
                      </label>
                      <input
                        type="text"
                        name="plc_software_version"
                        value={formData.plc_software_version}
                        onChange={handleChange}
                        placeholder="e.g. v20251201"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                        required
                      />
                    </div>

                    {/* Energy meter model */}
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Energy meter model
                      </label>
                      <input
                        type="text"
                        name="energy_meter_model"
                        value={formData.energy_meter_model}
                        onChange={handleChange}
                        placeholder="e.g. Victron Energy Meter ET340 - 3 phase"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                        required
                      />
                    </div>

                    {/* Deodor model */}
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Deodor model (optional)
                      </label>
                      <input
                        type="text"
                        name="deodor_model"
                        value={formData.deodor_model}
                        onChange={handleChange}
                        placeholder="e.g. BioFilter 3000"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>

                    {/* Extractor model */}
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Extractor model (optional)
                      </label>
                      <input
                        type="text"
                        name="extractor_model"
                        value={formData.extractor_model}
                        onChange={handleChange}
                        placeholder="e.g. AirFlow EX-500"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>
                  </div>

                  {/* Has stairs (optional) */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Has stairs (optional)
                    </label>
                    <div className="inline-flex rounded-lg border border-[#D1D5DB] p-0.5 bg-[#F9FAFB]">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, has_stairs: true }))
                        }
                        className={`px-5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                          formData.has_stairs
                            ? 'bg-white text-[#111827] font-semibold shadow-xs border border-[#D1D5DB]'
                            : 'text-[#6B7280] hover:text-[#111827]'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, has_stairs: false }))
                        }
                        className={`px-5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                          !formData.has_stairs
                            ? 'bg-white text-[#111827] font-semibold shadow-xs border border-[#D1D5DB]'
                            : 'text-[#6B7280] hover:text-[#111827]'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Notes (optional)
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Add any specific installation, maintenance, or commissioning notes..."
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all resize-y min-h-[72px]"
                    />
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* Section 4: Operational & Connectivity Status */}
              {/* ---------------------------------------------------- */}
              <div>
                <h3 className="text-sm font-bold text-[#111827] tracking-tight mb-4">
                  Operational status
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Connectivity
                    </label>
                    <select
                      name="connectivity_status"
                      value={formData.connectivity_status}
                      onChange={handleChange}
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                    >
                      <option value="Offline">Offline</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Machine status
                    </label>
                    <select
                      name="operational_status"
                      value={formData.operational_status}
                      onChange={handleChange}
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                    >
                      <option value="Idle">Idle</option>
                      <option value="Running">Running</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Docked Action Footer */}
          <div className="px-8 py-4 bg-white border-t border-[#E5E7EB] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-machine-form"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#111827] hover:bg-[#27272A] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

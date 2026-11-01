import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { machinesApi } from '../../services/api';
import type { Machine, MachineModel } from '../../types';

export interface AddMachineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMachine: Machine) => void;
}

export const AddMachineDrawer: React.FC<AddMachineDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [machineModels, setMachineModels] = useState<MachineModel[]>([]);
  const [formData, setFormData] = useState({
    serial_number: '',
    model: 'F25',
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

  // Load next serial number and models dynamically from DB
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);

      machinesApi
        .getNextCode()
        .then((res) => {
          if (res?.next_code) {
            setFormData((prev) => ({ ...prev, serial_number: res.next_code }));
          }
        })
        .catch((err) => console.error('Failed to get next machine code:', err));

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
          if (sorted.length > 0) {
            setFormData((prev) => ({
              ...prev,
              model: prev.model || sorted[0].model_code,
            }));
          }
        })
        .catch((err) => console.error('Failed to load machine models:', err));
    }
  }, [isOpen]);

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

  // Lock body scroll while drawer is open
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'model') {
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

    // Required fields validation
    if (!formData.serial_number.trim()) {
      setError('Serial number is required.');
      return;
    }
    if (!formData.model.trim()) {
      setError('Model is required.');
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

    // Map model display to canonical standard
    const modelMap: Record<string, string> = {
      F1000: 'Foodie F1000',
      F500: 'Foodie F500',
      F100: 'Foodie F100',
      F25: 'Foodie F25',
    };
    const canonicalModel = modelMap[formData.model] || formData.model;

    // Capacity is strictly an optional input; leave empty unless user explicitly filled it
    const capacityValue = formData.capacity.trim() ? formData.capacity.trim() : undefined;

    const payload = {
      serial_number: formData.serial_number.trim().toUpperCase(),
      machine_code: formData.serial_number.trim().toUpperCase(),
      model: canonicalModel,
      hardware_version: formData.version.trim() || undefined,
      capacity: capacityValue,
      location_label: formData.location.trim(),
      location_description: formData.location_description.trim() || undefined,
      plc_software_version: formData.plc_software_version.trim(),
      energy_meter_model: formData.energy_meter_model.trim(),
      deodor_model: formData.deodor_model.trim() || undefined,
      extractor_model: formData.extractor_model.trim() || undefined,
      has_stairs: Boolean(formData.has_stairs),
      notes: formData.notes.trim() || undefined,
      connectivity_status: formData.connectivity_status || 'Offline',
      operational_status: formData.operational_status || 'Idle',
    };

    try {
      const created = await machinesApi.create(payload);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to onboard machine.');
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
                Add machine
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Register a new Foodie machine to the PowerTech fleet.
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

            <form id="add-machine-form" onSubmit={handleSubmit} className="space-y-7">
              {/* ---------------------------------------------------- */}
              {/* Section 1: Machine */}
              {/* ---------------------------------------------------- */}
              <div>
                <h3 className="text-sm font-bold text-[#111827] tracking-tight">
                  Machine
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5 mb-4">
                  Fields marked (optional) can be left blank.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  {/* Serial number (Auto-generated & Disabled) */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Serial number
                    </label>
                    <input
                      type="text"
                      name="serial_number"
                      value={formData.serial_number}
                      readOnly
                      disabled
                      placeholder="Auto-generating..."
                      className="w-full bg-[#F9FAFB] border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#6B7280] cursor-not-allowed uppercase font-mono"
                    />
                  </div>

                  {/* Model (Ordered F25, F100, F500, F1000) */}
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
                            <option key={m.id} value={m.model_code}>
                              {m.model_code}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="F25">F25</option>
                            <option value="F100">F100</option>
                            <option value="F500">F500</option>
                            <option value="F1000">F1000</option>
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

                  {/* Capacity (optional) */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Capacity (optional)
                    </label>
                    <input
                      type="text"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleChange}
                      placeholder="e.g. 500 Kg/Day"
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

                  {/* Location description (optional) */}
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

                    {/* Deodor model (optional) */}
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Deodor model (optional)
                      </label>
                      <input
                        type="text"
                        name="deodor_model"
                        value={formData.deodor_model}
                        onChange={handleChange}
                        placeholder="e.g. D-180"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>

                    {/* Extractor model (optional) */}
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Extractor model (optional)
                      </label>
                      <input
                        type="text"
                        name="extractor_model"
                        value={formData.extractor_model}
                        onChange={handleChange}
                        placeholder="e.g. DC-1200P"
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

                  {/* Notes (optional) */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Notes (optional)
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                      placeholder="e.g. Client wanted more training for their new staff"
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all resize-y min-h-[72px]"
                    />
                  </div>
                </div>
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
              form="add-machine-form"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-[#E32032] hover:bg-[#C1121F] text-white transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding machine...</span>
                </>
              ) : (
                <span>Add machine</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { orgsApi, machinesApi } from '../../services/api';
import type { Organization, Machine } from '../../types';

export interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newOrg: Organization) => void;
}

interface MachineRow {
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

export const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Section 1: Client details
  const [clientCode, setClientCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [onboardingDate, setOnboardingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [businessType, setBusinessType] = useState<'Corporate' | 'Individual'>('Corporate');
  const [taxId, setTaxId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 days');
  const [commsPreference, setCommsPreference] = useState('Email');

  // Section 2: Contact details
  const [contactPoc, setContactPoc] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  // Section 3: Add Foodie to the client
  const todayStr = new Date().toISOString().split('T')[0];
  const [machineRows, setMachineRows] = useState<MachineRow[]>([
    {
      machine_id: '',
      location: '',
      lease_start_date: todayStr,
      lease_end_date: calculateFiveYearsLater(todayStr),
    },
  ]);

  // Available / Unmapped Machines from Fleet
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Prevent background body scrolling when open
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

  // Load next client code and available (unassigned) machines
  useEffect(() => {
    if (isOpen) {
      setIsLoadingMachines(true);
      setError(null);
      // Ensure fields start clean
      setClientCode('');
      setCompanyName('');
      setTaxId('');
      setContactPoc('');
      setPhoneNumber('');
      setEmail('');
      setWebsite('');
      setBillingAddress('');
      setShippingAddress('');
      setPaymentTerms('30 days');
      setCommsPreference('Email');

      // Fetch next auto-generated client code (e.g. CL-0015)
      orgsApi
        .getNextCode()
        .then((res) => {
          if (res?.next_code) {
            setClientCode(res.next_code);
          }
        })
        .catch((err) => {
          console.error('Failed to get next client code:', err);
        });

      machinesApi
        .getAll()
        .then((all) => {
          // Assign Machine: Assign ONLY available machines (not assigned)
          const unassigned = all.filter((m) => !m.organization_id);
          setAvailableMachines(unassigned);
        })
        .catch((err) => {
          console.error('Failed to load available machines:', err);
        })
        .finally(() => {
          setIsLoadingMachines(false);
        });
    } else {
      setClientCode('');
      setError(null);
    }
  }, [isOpen]);


  if (!isOpen) return null;

  // Add another machine row
  const handleAddMachineRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setMachineRows((prev) => [
      ...prev,
      {
        machine_id: '',
        location: '',
        lease_start_date: today,
        lease_end_date: calculateFiveYearsLater(today),
      },
    ]);
  };

  // Remove a machine row
  const handleRemoveMachineRow = (index: number) => {
    const today = new Date().toISOString().split('T')[0];
    if (machineRows.length === 1) {
      // Clear row values instead of removing the single row
      setMachineRows([
        {
          machine_id: '',
          location: '',
          lease_start_date: today,
          lease_end_date: calculateFiveYearsLater(today),
        },
      ]);
      return;
    }
    setMachineRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update a machine row field
  const handleUpdateMachineRow = (
    index: number,
    field: keyof MachineRow,
    value: string
  ) => {
    setMachineRows((prev) => {
      const updated = [...prev];
      if (field === 'lease_start_date') {
        updated[index] = {
          ...updated[index],
          lease_start_date: value,
          lease_end_date: calculateFiveYearsLater(value),
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientCode.trim()) {
      setError('Account number / Client ID is required.');
      return;
    }
    if (!companyName.trim()) {
      setError('Full name / Company name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }
    if (phoneNumber.trim()) {
      const digitsOnly = phoneNumber.replace(/\D/g, '');
      if (digitsOnly.length < 7) {
        setError('Please enter a valid phone number with at least 7 digits.');
        return;
      }
    }

    // Validate lease end date is not earlier than lease start date
    for (let i = 0; i < machineRows.length; i++) {
      const row = machineRows[i];
      if (row.machine_id.trim() && row.lease_start_date && row.lease_end_date) {
        if (row.lease_end_date < row.lease_start_date) {
          setError(`Machine #${i + 1}: Lease end date cannot be earlier than lease start date.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setError(null);

    // Format assigned machines: filter out rows with no machine selected
    const validAssignedMachines = machineRows
      .filter((m) => m.machine_id.trim() !== '')
      .map((m) => ({
        machine_id: m.machine_id.trim(),
        location: m.location.trim() || undefined,
        lease_start_date: m.lease_start_date.trim() || undefined,
        lease_end_date: m.lease_end_date.trim() || undefined,
      }));

    // If shipping address is empty or "Same as billing", sync with billing address
    const resolvedShipping =
      !shippingAddress.trim() ||
        shippingAddress.trim().toLowerCase() === 'same as billing'
        ? billingAddress.trim() || undefined
        : shippingAddress.trim();

    try {
      const created = await orgsApi.create({
        client_code: clientCode.trim().toUpperCase(),
        company_name: companyName.trim(),
        onboarding_date: onboardingDate || undefined,
        business_type: businessType,
        tax_id: taxId.trim() || undefined,
        contact_poc: contactPoc.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        email: email.trim(),
        website: website.trim() || undefined,
        billing_address: billingAddress.trim() || undefined,
        shipping_address: resolvedShipping,
        payment_terms: paymentTerms,
        comms_preference: commsPreference,
        assigned_machines:
          validAssignedMachines.length > 0 ? validAssignedMachines : undefined,
        is_active: true,
      });

      onSuccess(created);
      onClose();

      // Reset form states
      setClientCode('');
      setCompanyName('');
      setTaxId('');
      setContactPoc('');
      setPhoneNumber('');
      setEmail('');
      setWebsite('');
      setBillingAddress('');
      setShippingAddress('');
      const resetToday = new Date().toISOString().split('T')[0];
      setMachineRows([
        {
          machine_id: '',
          location: '',
          lease_start_date: resetToday,
          lease_end_date: calculateFiveYearsLater(resetToday),
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Failed to create client organization.');
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
        className="fixed inset-0 bg-black/45 backdrop-blur-2xs transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Container: docked to the right edge and opens from right to left */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div className="w-screen max-w-4xl bg-white shadow-2xl flex flex-col border-l border-[#E3E4E6] animate-in slide-in-from-right duration-300">
          {/* Header (Docked at top) */}
          <div className="px-8 py-5 border-b border-[#E3E4E6] flex items-center justify-between bg-white flex-shrink-0">
            <div>
              <h3 className="text-xl font-bold text-[#171717] tracking-tight">
                Add new client
              </h3>
              <p className="text-xs text-[#666666] mt-0.5">
                Create the client record and assign Foodie machines to it.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#888888] hover:text-[#171717] hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mx-8 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-[#E32032] flex items-center gap-2.5 flex-shrink-0">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Body (Scrollable from top to bottom) */}
          <form
            id="add-new-client-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-8 space-y-6 text-xs"
          >
            {/* ====================================================================
                SECTION 1: CLIENT DETAILS
                ==================================================================== */}
            <div>
              <h4 className="text-sm font-bold text-[#171717] mb-3.5">
                Client details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Account number / Client ID */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={clientCode || ''}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-[#F3F4F6] text-[#374151] text-xs font-mono font-semibold uppercase cursor-not-allowed"
                  />
                </div>

                {/* Full name / Company name */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Full name / Company name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                    required
                  />
                </div>

                {/* Onboarding date */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Onboarding date
                  </label>
                  <input
                    type="date"
                    value={onboardingDate}
                    onChange={(e) => setOnboardingDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer"
                  />
                </div>

                {/* Business type (Individual / Corporate) */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Business type (Individual / Corporate)
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) =>
                      setBusinessType(e.target.value as 'Corporate' | 'Individual')
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium"
                  >
                    <option value="Corporate">Corporate</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>

                {/* Tax ID (ABN / GST) */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Tax ID (ABN / GST)
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="e.g. 12 345 678 901"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                  />
                </div>

                {/* Payment terms */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Payment terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium"
                  >
                    <option value="15 days">15 days</option>
                    <option value="30 days">30 days</option>
                    <option value="60 days">60 days</option>
                  </select>
                </div>

                {/* Comms preference */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Comms preference
                  </label>
                  <select
                    value={commsPreference}
                    onChange={(e) => setCommsPreference(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium"
                  >
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E7EB]" />

            {/* ====================================================================
                SECTION 2: CONTACT DETAILS
                ==================================================================== */}
            <div>
              <h4 className="text-sm font-bold text-[#171717] mb-3.5">
                Contact details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Point of contact */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Point of contact
                  </label>
                  <input
                    type="text"
                    value={contactPoc}
                    onChange={(e) => setContactPoc(e.target.value)}
                    placeholder="Jordan Smith"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                  />
                </div>

                {/* Phone number */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9+\s()-]/g, '');
                      setPhoneNumber(clean);
                    }}
                    onKeyDown={(e) => {
                      if (
                        ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(e.key) ||
                        e.ctrlKey ||
                        e.metaKey
                      ) {
                        return;
                      }
                      if (!/^[0-9+\s()-]$/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="+61 400 000 000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan@greenvalley.example"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                    required
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Website
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="www.greenvalley.example"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                  />
                </div>

                {/* Billing address */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Billing address
                  </label>
                  <input
                    type="text"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="Street, suburb, state, postcode"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                  />
                </div>

                {/* Shipping address */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Shipping address
                  </label>
                  <input
                    type="text"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Same as billing"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E7EB]" />

            {/* ====================================================================
                SECTION 3: ADD FOODIE TO THE CLIENT
                ==================================================================== */}
            <div>
              <div className="mb-3">
                <h4 className="text-sm font-bold text-[#171717]">
                  Add Foodie to the client
                </h4>
                <p className="text-xs text-[#666666] mt-0.5">
                  Assign a new machine to a new row for this client.
                </p>
              </div>

              {/* Machines Assignment Grid */}
              <div className="border border-[#E3E4E6] rounded-xl overflow-hidden bg-white">
                {/* Table Header */}
                <div className="bg-[#F8F9FA] border-b border-[#E3E4E6] px-4 py-2.5 grid grid-cols-12 gap-3 text-xs font-semibold text-[#374151]">
                  <div className="col-span-4">Serial Number</div>
                  <div className="col-span-3">Location</div>
                  <div className="col-span-2">Lease start date</div>
                  <div className="col-span-2">Lease end date (if applicable)</div>
                  <div className="col-span-1 text-right"></div>
                </div>

                {/* Dynamic Rows */}
                <div className="divide-y divide-[#F2F2F2] p-2 space-y-2">
                  {machineRows.map((row, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-3 items-center px-2 py-1"
                    >
                      {/* Serial Number Dropdown */}
                      <div className="col-span-4">
                        <select
                          value={row.machine_id}
                          onChange={(e) =>
                            handleUpdateMachineRow(index, 'machine_id', e.target.value)
                          }
                          disabled={isLoadingMachines}
                          className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] text-xs focus:outline-none focus:border-[#171717] cursor-pointer"
                        >
                          <option value="">Select available / unmapped machine</option>
                          {availableMachines.map((m) => (
                            <option key={m.id} value={m.serial_number || m.machine_code}>
                              {m.serial_number} · {m.model} ({m.machine_code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Location */}
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={row.location}
                          onChange={(e) =>
                            handleUpdateMachineRow(index, 'location', e.target.value)
                          }
                          placeholder="Enter text"
                          className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] text-xs focus:outline-none focus:border-[#171717]"
                        />
                      </div>

                      {/* Lease start date */}
                      <div className="col-span-2">
                        <input
                          type="date"
                          value={row.lease_start_date}
                          onChange={(e) =>
                            handleUpdateMachineRow(index, 'lease_start_date', e.target.value)
                          }
                          placeholder="Date"
                          className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] text-xs focus:outline-none focus:border-[#171717] cursor-pointer"
                        />
                      </div>

                      {/* Lease end date */}
                      <div className="col-span-2">
                        <input
                          type="date"
                          value={row.lease_end_date}
                          onChange={(e) =>
                            handleUpdateMachineRow(index, 'lease_end_date', e.target.value)
                          }
                          placeholder="Date"
                          className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] text-xs focus:outline-none focus:border-[#171717] cursor-pointer"
                        />
                      </div>

                      {/* Remove Action */}
                      <div className="col-span-1 text-right">
                        {machineRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMachineRow(index)}
                            className="p-1.5 rounded-lg text-[#888888] hover:text-[#E32032] hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Another Machine Button */}
                <div className="p-3 border-t border-[#F2F2F2] bg-[#FAFAFA]">
                  <button
                    type="button"
                    onClick={handleAddMachineRow}
                    className="w-full py-2.5 border border-dashed border-[#D1D5DB] rounded-xl text-xs font-semibold text-[#171717] hover:bg-white hover:border-[#171717] transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-white"
                  >
                    <Plus className="w-4 h-4 text-[#171717]" />
                    <span>Add another machine</span>
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Footer Actions (Docked at bottom right) */}
          <div className="px-8 py-4 border-t border-[#E3E4E6] bg-white flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-[#D1D5DB] bg-white text-[#171717] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-new-client-form"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

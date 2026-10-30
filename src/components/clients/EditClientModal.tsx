import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { orgsApi } from '../../services/api';
import type { Organization } from '../../types';

export interface EditClientModalProps {
  isOpen: boolean;
  client: Organization | null;
  onClose: () => void;
  onSuccess: (updatedOrg: Organization) => void;
}

export const EditClientModal: React.FC<EditClientModalProps> = ({
  isOpen,
  client,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    company_name: '',
    business_type: 'Corporate' as 'Corporate' | 'Individual',
    tax_id: '',
    onboarding_date: '',
    comms_preference: 'Phone',
    payment_terms: '14 days',
    contact_poc: '',
    email: '',
    website: '',
    billing_address: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setFormData({
        company_name: client.company_name || '',
        business_type: (client.business_type as any) || 'Corporate',
        tax_id: client.tax_id || '',
        onboarding_date: client.onboarding_date || (client.created_at ? client.created_at.split('T')[0] : ''),
        comms_preference: client.comms_preference || 'Phone',
        payment_terms: client.payment_terms || '14 days',
        contact_poc: client.contact_poc || '',
        email: client.email || '',
        website: client.website || '',
        billing_address: client.billing_address || '',
      });
      setError(null);
    }
  }, [client]);

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Primary contact email is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await orgsApi.update(client.id, {
        company_name: formData.company_name.trim(),
        business_type: formData.business_type,
        tax_id: formData.tax_id.trim() || undefined,
        onboarding_date: formData.onboarding_date || undefined,
        comms_preference: formData.comms_preference,
        payment_terms: formData.payment_terms,
        contact_poc: formData.contact_poc.trim() || undefined,
        email: formData.email.trim(),
        website: formData.website.trim() || undefined,
        billing_address: formData.billing_address.trim() || undefined,
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update client organization.');
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
                Edit client
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                {client.client_code} · {client.company_name}
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

            <form id="edit-client-form" onSubmit={handleSubmit} className="space-y-7">
              {/* Section 1: Client details */}
              <div>
                <h3 className="text-sm font-bold text-[#111827] tracking-tight mb-4">
                  Client details
                </h3>

                <div className="space-y-4">
                  {/* Row 1: Full name, Business type, Tax ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Full name / Company name
                      </label>
                      <input
                        type="text"
                        name="company_name"
                        value={formData.company_name}
                        onChange={handleChange}
                        placeholder="e.g. Coastal Café Group"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Business type (Individual / Corporate)
                      </label>
                      <div className="relative">
                        <select
                          name="business_type"
                          value={formData.business_type}
                          onChange={handleChange}
                          className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all appearance-none cursor-pointer pr-9"
                        >
                          <option value="Corporate">Corporate</option>
                          <option value="Individual">Individual</option>
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

                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Tax ID (ABN / GST)
                      </label>
                      <input
                        type="text"
                        name="tax_id"
                        value={formData.tax_id}
                        onChange={handleChange}
                        placeholder="11 222 333 444"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2: Onboarding date, Comms preference, Payment terms */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Onboarding date
                      </label>
                      <input
                        type="date"
                        name="onboarding_date"
                        value={formData.onboarding_date}
                        onChange={handleChange}
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Comms preference
                      </label>
                      <div className="relative">
                        <select
                          name="comms_preference"
                          value={formData.comms_preference}
                          onChange={handleChange}
                          className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all appearance-none cursor-pointer pr-9"
                        >
                          <option value="Email">Email</option>
                          <option value="Phone">Phone</option>
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

                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Payment terms
                      </label>
                      <div className="relative">
                        <select
                          name="payment_terms"
                          value={formData.payment_terms}
                          onChange={handleChange}
                          className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all appearance-none cursor-pointer pr-9"
                        >
                          <option value="15 days">15 days</option>
                          <option value="30 days">30 days</option>
                          <option value="60 days">60 days</option>
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
                  </div>
                </div>
              </div>

              {/* Section 2: Contact details */}
              <div>
                <h3 className="text-sm font-bold text-[#111827] tracking-tight mb-4">
                  Contact details
                </h3>

                <div className="space-y-4">
                  {/* Row 1: Point of contact, Email, Website */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Point of contact
                      </label>
                      <input
                        type="text"
                        name="contact_poc"
                        value={formData.contact_poc}
                        onChange={handleChange}
                        placeholder="M. Chen"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        disabled
                        className="w-full bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs font-medium cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Website
                      </label>
                      <input
                        type="text"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        placeholder="coastal.example"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2: Billing address */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">
                        Billing address
                      </label>
                      <input
                        type="text"
                        name="billing_address"
                        value={formData.billing_address}
                        onChange={handleChange}
                        placeholder="Glenelg SA"
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>
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
              form="edit-client-form"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-[#E32032] hover:bg-[#C1121F] text-white transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save changes</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

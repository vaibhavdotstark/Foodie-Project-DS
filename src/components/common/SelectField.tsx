import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  options,
  error,
  helperText,
  required = false,
  id,
  className = '',
  ...props
}) => {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-xs font-bold text-[#171717]">
        {label} {required && <span className="text-[#E32032]">*</span>}
      </label>

      <select
        id={selectId}
        className={`w-full px-3.5 py-2.5 text-xs bg-white border rounded-lg transition-colors outline-none font-medium cursor-pointer ${
          error
            ? 'border-[#E32032] focus:ring-1 focus:ring-[#E32032] bg-red-50/20'
            : 'border-[#E3E4E6] focus:border-[#171717] focus:ring-1 focus:ring-[#171717]'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error ? (
        <span className="text-[11px] font-semibold text-[#E32032] flex items-center gap-1 mt-0.5 animate-fadeIn">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </span>
      ) : helperText ? (
        <span className="text-[11px] text-[#666666] mt-0.5">{helperText}</span>
      ) : null}
    </div>
  );
};

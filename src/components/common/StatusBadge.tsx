import React from 'react';

export type BadgeStatus = 'running' | 'idle' | 'maintenance' | 'fault' | 'offline' | 'active' | 'inactive';

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const configMap: Record<BadgeStatus, { text: string; bg: string; dot: string; defaultLabel: string }> = {
    running: {
      text: 'text-[#0A7135]',
      bg: 'bg-[#D7FFE6]',
      dot: 'bg-[#04913E]',
      defaultLabel: 'Running',
    },
    active: {
      text: 'text-[#0A7135]',
      bg: 'bg-[#D7FFE6]',
      dot: 'bg-[#04913E]',
      defaultLabel: 'Active',
    },
    idle: {
      text: 'text-[#7A5C00]',
      bg: 'bg-[#FFF6D1]',
      dot: 'bg-[#E0B000]',
      defaultLabel: 'Idle',
    },
    maintenance: {
      text: 'text-[#1F4FB8]',
      bg: 'bg-[#E8EFFD]',
      dot: 'bg-[#3B6FE0]',
      defaultLabel: 'Maintenance',
    },
    fault: {
      text: 'text-[#9D1717]',
      bg: 'bg-[#FFE2E2]',
      dot: 'bg-[#E32020]',
      defaultLabel: 'Fault',
    },
    offline: {
      text: 'text-[#4B5563]',
      bg: 'bg-[#EEEFF1]',
      dot: 'bg-[#9AA1AB]',
      defaultLabel: 'Offline',
    },
    inactive: {
      text: 'text-[#4B5563]',
      bg: 'bg-[#EEEFF1]',
      dot: 'bg-[#9AA1AB]',
      defaultLabel: 'Inactive',
    },
  };

  const current = configMap[status] || configMap.offline;
  const displayLabel = label || current.defaultLabel;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${current.bg} ${current.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      <span>{displayLabel}</span>
    </span>
  );
};

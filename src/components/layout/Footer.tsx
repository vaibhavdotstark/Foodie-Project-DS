import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-[#E3E4E6] py-3.5 px-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#666666] gap-2 mt-auto">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#00C951]" />
        <span>Telemetry Gateway Active</span>
        <span className="text-[#E3E4E6]">|</span>
        <span>Connected to AWS IoT Core (ap-southeast-2)</span>
      </div>

      <div>
        © 2026 PowerTech Energy Pty Ltd. All rights reserved. Commercial in Confidence.
      </div>
    </footer>
  );
};

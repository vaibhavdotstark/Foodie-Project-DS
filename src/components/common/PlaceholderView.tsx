import React from 'react';
import { ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface PlaceholderViewProps {
  title: string;
  subtitle: string;
  tag?: string;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  title,
  subtitle,
  tag = 'Phase 2 Milestone',
}) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl border border-[#E3E4E6] p-12 text-center max-w-2xl mx-auto shadow-xs my-8">
      <div className="w-12 h-12 rounded-xl bg-red-50 text-[#E32032] border border-red-200 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-6 h-6" />
      </div>

      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-[#666666] border border-slate-200 mb-3">
        {tag}
      </span>

      <h1 className="text-xl font-extrabold text-[#171717]">{title}</h1>
      <p className="text-xs text-[#666666] mt-2 max-w-md mx-auto leading-relaxed">
        {subtitle}
      </p>

      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-[#171717] text-white hover:bg-black transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-[#F2F2F2] flex items-center justify-center gap-1.5 text-[11px] text-[#888888]">
        <Clock className="w-3.5 h-3.5" />
        <span>Scheduled in the PowerTech Energy product development roadmap.</span>
      </div>
    </div>
  );
};

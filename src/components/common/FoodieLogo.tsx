import React from 'react';
import { BRAND_ASSETS } from '../../config/brandConfig';

interface FoodieLogoProps {
  className?: string;
  showEndorsement?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'image' | 'svg';
}

export const FoodieLogo: React.FC<FoodieLogoProps> = ({
  className = '',
  showEndorsement = true,
  size = 'md',
  variant = 'image',
}) => {
  const heightMap = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  };

  if (variant === 'image') {
    return (
      <div className={`flex items-center gap-1.5 sm:gap-2 select-none shrink-0 ${className}`}>
        <img
          src={BRAND_ASSETS.foodieLogo}
          alt="Foodie Logo"
          className={`${heightMap[size]} w-auto object-contain shrink-0`}
        />
        {showEndorsement && (
          <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-2.5 border-l border-[#E3E4E6] shrink-0">
            <span className="text-[11px] text-[#6B7280] font-medium hidden sm:inline">by</span>
            {/* Full banner logo on desktop (>= md) */}
            <img
              src={BRAND_ASSETS.powertechFullLogo}
              alt="PowerTech Energy"
              className="h-5 sm:h-5.5 md:h-6 w-auto object-contain opacity-95 hidden md:block shrink-0"
            />
            {/* Compact swirl icon on mobile (< md) */}
            <img
              src={BRAND_ASSETS.powertechIcon}
              alt="PowerTech Energy"
              className="h-5 w-5 sm:h-6 sm:w-6 object-contain opacity-95 md:hidden shrink-0"
            />
          </div>
        )}
      </div>
    );
  }

  // Fallback SVG representation
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black shadow-sm flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #00C951 0%, #04913E 100%)',
        }}
      >
        <span className="text-sm font-bold text-white">F</span>
      </div>
      <div className="flex flex-col">
        <span className="font-extrabold tracking-tight text-[#171717] leading-none text-lg">
          Foodie
        </span>
        {showEndorsement && (
          <span className="font-bold uppercase tracking-wider text-[#E32032] mt-1 text-[10px]">
            POWERTECH ENERGY
          </span>
        )}
      </div>
    </div>
  );
};

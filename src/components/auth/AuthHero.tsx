import React from 'react';
import { BRAND_ASSETS, BRAND_COPY } from '../../config/brandConfig';

interface AuthHeroProps {
  headline?: string;
  subHeadline?: string;
  descriptor?: string;
  bgImage?: string;
}

export const AuthHero: React.FC<AuthHeroProps> = ({
  headline = BRAND_COPY.authHeroHeadline,
  subHeadline = BRAND_COPY.appName,
  descriptor = BRAND_COPY.appTagline,
  bgImage = BRAND_ASSETS.authHeroBg,
}) => {
  return (
    <div className="relative hidden lg:flex lg:w-1/2 h-full max-h-screen flex-col justify-between p-8 xl:p-12 overflow-hidden bg-neutral-900 select-none flex-shrink-0">
      {/* Background Image with optimized scaling */}
      <img
        src={bgImage}
        alt="Foodie Ecosystem"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Dark Vignette Overlay for Crisp Readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85" />
      <div className="absolute inset-0 bg-black/20" />

      {/* Top Left Branding */}
      <div className="relative z-10">
        <img
          src={BRAND_ASSETS.foodieLogo}
          alt="Foodie Logo"
          className="h-8 xl:h-9 w-auto object-contain brightness-0 invert drop-shadow-sm"
        />
      </div>

      {/* Bottom Left Hero Copy */}
      <div className="relative z-10 max-w-lg">
        <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3 drop-shadow-md">
          {headline}
        </h1>
        <div className="text-xs sm:text-sm font-bold text-white tracking-wide drop-shadow-sm">
          {subHeadline}
        </div>
        <p className="text-[11px] sm:text-xs text-white/80 mt-1 font-medium leading-relaxed drop-shadow-sm">
          {descriptor}
        </p>
      </div>
    </div>
  );
};

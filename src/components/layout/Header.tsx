import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  HelpCircle,
  Building2,
  Users,
  Cpu,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  User as UserIcon,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FoodieLogo } from '../common/FoodieLogo';
import { searchApi } from '../../services/api';
import type { SearchResults } from '../../services/api';
import type { UserRole } from '../../types';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // User Profile Dropdown & FAQ Modal State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const userMenuContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults(null);
      setIsSearching(false);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.query(searchQuery.trim());
        setResults(res);
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener to dismiss search dropdown and user menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (userMenuContainerRef.current && !userMenuContainerRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsUserMenuOpen(false);
        setIsFaqOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const totalResultsCount =
    (results?.sites.length || 0) +
    (results?.users.length || 0) +
    (results?.machines.length || 0);

  const handleSelectResult = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults(null);
    setIsOpen(false);
  };

  return (
    <header className="h-16 bg-white border-b border-[#E3E4E6] px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs select-none gap-2 sm:gap-4">
      {/* Brand & Workspace Indicator */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0 min-w-0">
        {user?.role === 'OEM_MANAGER' ? (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <FoodieLogo size="md" showEndorsement={true} />
            <div className="h-6 w-px bg-[#E3E4E6] hidden lg:block" />
            <div className="hidden lg:flex flex-col">
              <span className="text-[10px] text-[#888888] font-bold uppercase leading-tight">
                Workspace
              </span>
              <span className="text-xs font-extrabold text-[#171717] leading-tight">
                OEM Asset Manager
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[#E3E4E6] px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#171717] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#00C951] shrink-0" />
            <span className="text-[#666666] font-normal hidden sm:inline">Client:</span>
            <span className="font-bold text-[#171717] truncate max-w-[140px] sm:max-w-[200px]">Green Valley Foods Pty Ltd</span>
          </div>
        )}
      </div>

      {/* Global Search Input */}
      <div ref={searchContainerRef} className="relative hidden md:block flex-1 max-w-xs lg:max-w-sm mx-2 md:mx-4 lg:mx-6 min-w-0">
        <div className="relative">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-[#E32032] absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length > 0) setIsOpen(true);
            }}
            placeholder="Search"
            className="bg-[#F8F9FA] border border-[#E3E4E6] rounded-lg pl-9 pr-8 py-1.5 text-xs text-[#171717] focus:outline-none focus:border-[#171717] focus:bg-white transition-all w-full placeholder-[#888888]"
          />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#171717] p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown Overlay */}
          {isOpen && searchQuery.trim().length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-[#E3E4E6] rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-[#F2F2F2]">
              {/* Header summary */}
              <div className="px-3.5 py-2 bg-[#F8F9FA] flex items-center justify-between text-[11px] font-semibold text-[#666666]">
                <span>Search Results</span>
                <span>{isSearching ? 'Querying database...' : `${totalResultsCount} found`}</span>
              </div>

              {/* No Results State */}
              {!isSearching && totalResultsCount === 0 && (
                <div className="p-5 text-center">
                  <p className="text-xs font-semibold text-[#171717]">No records matching "{searchQuery}"</p>
                  <p className="text-[11px] text-[#666666] mt-1">
                    Try searching by Site Code (e.g. SITE-A), user email, or machine ID.
                  </p>
                </div>
              )}

              {/* Category 1: Sites & Facilities */}
              {results && results.sites.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-[#E32032]" />
                      Facilities ({results.sites.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectResult('/sites')}
                      className="text-[#E32032] hover:underline normal-case font-semibold text-[11px]"
                    >
                      View all
                    </button>
                  </div>
                  <div className="mt-1">
                    {results.sites.map((site) => (
                      <div
                        key={site.id}
                        onClick={() => handleSelectResult('/sites')}
                        className="px-3 py-2 hover:bg-[#F8F9FA] cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#171717] group-hover:text-[#E32032] transition-colors truncate">
                              {site.site_name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 border border-[#E3E4E6] text-[#666666] shrink-0">
                              {site.site_code}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#666666] truncate mt-0.5">
                            {site.address}
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#CCCCCC] group-hover:text-[#171717] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 2: Registered Users (Scoped: hide OEM Manager from Site Admin / Operators) */}
              {(() => {
                const isOem = user?.role === 'OEM_MANAGER';
                const filteredUsers = results
                  ? results.users.filter((u) => isOem || u.role !== 'OEM_MANAGER')
                  : [];
                if (filteredUsers.length === 0) return null;

                return (
                  <div className="py-2">
                    <div className="px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-[#00C951]" />
                        {isOem ? 'Users & Staff' : 'Facility Operators'} ({filteredUsers.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectResult('/users')}
                        className="text-[#00C951] hover:underline normal-case font-semibold text-[11px]"
                      >
                        View all
                      </button>
                    </div>
                    <div className="mt-1">
                      {filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => handleSelectResult('/users')}
                          className="px-3 py-2 hover:bg-[#F8F9FA] cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#171717] group-hover:text-[#00C951] transition-colors truncate">
                                {u.first_name} {u.last_name}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-slate-50 border-[#E3E4E6] text-[#666666] shrink-0">
                                {u.role.replace('_', ' ')}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#666666] truncate mt-0.5">
                              {u.email}
                            </span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#CCCCCC] group-hover:text-[#171717] shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Category 3: Composter Telemetry Units */}
              {results && results.machines.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-[#171717]" />
                      Composter Units ({results.machines.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectResult('/')}
                      className="text-[#171717] hover:underline normal-case font-semibold text-[11px]"
                    >
                      Telemetry
                    </button>
                  </div>
                  <div className="mt-1">
                    {results.machines.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => handleSelectResult('/')}
                        className="px-3 py-2 hover:bg-[#F8F9FA] cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#171717] group-hover:text-[#E32032] transition-colors">
                              {m.id} — {m.model}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {m.status} ({m.temp})
                            </span>
                          </div>
                          <span className="text-[11px] text-[#666666] truncate mt-0.5">
                            {m.location}
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#CCCCCC] group-hover:text-[#171717] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0">
          {/* FAQ Pill Button */}
          <button
            type="button"
            onClick={() => setIsFaqOpen(true)}
            className="px-2.5 sm:px-3.5 py-1.5 rounded-full border border-[#D1D5DB] bg-white text-[#171717] hover:bg-[#F9FAFB] transition-all flex items-center gap-1.5 text-xs font-bold shadow-2xs cursor-pointer shrink-0"
          >
            <span>FAQ</span>
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#171717] shrink-0" />
          </button>

          {/* Notifications Alert Bell with red 2 badge */}
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="relative p-1.5 sm:p-2 rounded-full text-[#171717] hover:bg-[#F3F4F6] transition-colors cursor-pointer shrink-0"
            title="Active Telemetry Alerts (2)"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-[#171717]" />
            <span className="absolute top-0.5 right-0.5 bg-[#E32032] text-white text-[9px] sm:text-[10px] font-extrabold w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center leading-none">
              2
            </span>
          </button>

          {/* Vertical Divider */}
          <div className="h-5 sm:h-6 w-px bg-[#E5E7EB] mx-0.5 shrink-0 hidden xs:block sm:block" />

          {/* User Profile Pill & Dropdown */}
          <div ref={userMenuContainerRef} className="relative shrink-0">
            {(() => {
              const userInitials = user
                ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
                : 'PS';
              const displayName = user
                ? `${user.first_name} ${user.last_name}`
                : 'Priya Shah';
              const displayEmail = user?.email || 'priya.shah@greenvalley.example';
              const roleTitleMap: Record<UserRole, string> = {
                OEM_MANAGER: 'OEM Asset Manager',
                SITE_ADMIN: 'Site Admin',
                OPERATOR: 'Operator',
              };
              const displayRole = user ? roleTitleMap[user.role] : 'Operator';
              const displayCompany = user?.role === 'OEM_MANAGER' ? 'PowerTech Energy' : 'Green Valley Foods Pty Ltd';
              const displayRoleCompany = `${displayRole} · ${displayCompany}`;

              return (
                <>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 sm:gap-2.5 p-1 rounded-xl hover:bg-[#F9FAFB] transition-colors cursor-pointer select-none text-left shrink-0"
                    aria-expanded={isUserMenuOpen}
                  >
                    {/* Soft pink/red avatar circle with dark red initials */}
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFEBEB] text-[#991B1B] text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {userInitials}
                    </div>
                    <div className="hidden lg:flex flex-col text-left">
                      <span className="text-xs font-bold text-[#171717] leading-tight">
                        {displayName}
                      </span>
                      <span className="text-[11px] text-[#6B7280] leading-tight mt-0.5">
                        {displayRole}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-[#6B7280] transition-transform duration-150 shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu Overlay matching the image */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-[#E5E7EB] shadow-xl py-3 z-50 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Top User Identity Section */}
                      <div className="px-4 py-1.5">
                        <div className="text-sm font-bold text-[#171717]">
                          {displayName}
                        </div>
                        <div className="text-xs text-[#6B7280] mt-0.5 truncate">
                          {displayEmail}
                        </div>
                        <div className="text-xs text-[#6B7280] mt-0.5 truncate">
                          {displayRoleCompany}
                        </div>
                      </div>

                      <div className="border-t border-[#E5E7EB] my-2" />

                      {/* Menu Items */}
                      <div className="px-1.5 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            navigate('/users');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer text-left"
                        >
                          <UserIcon className="w-4 h-4 text-[#171717]" />
                          <span>Profile</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            navigate('/settings');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer text-left"
                        >
                          <Settings className="w-4 h-4 text-[#171717]" />
                          <span>Settings</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsFaqOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer text-left"
                        >
                          <HelpCircle className="w-4 h-4 text-[#171717]" />
                          <span>FAQ</span>
                        </button>
                      </div>

                      <div className="border-t border-[#E5E7EB] my-2" />

                      {/* Sign Out Link in Red */}
                      <div className="px-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-[#E32032] hover:bg-red-50 transition-colors cursor-pointer text-left"
                        >
                          <LogOut className="w-4 h-4 text-[#E32032]" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* FAQ Modal Dialog */}
        {isFaqOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-[#E3E4E6] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E3E4E6] flex items-center justify-between bg-[#FAFAFA]">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#E32032]" />
                  <h3 className="text-sm font-bold text-[#171717]">Foodie Composter Knowledge & FAQ</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFaqOpen(false)}
                  className="p-1.5 rounded-lg text-[#666666] hover:text-[#171717] hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E3E4E6]">
                  <h4 className="font-bold text-[#171717] mb-1">
                    What is the target operating temperature for the composter?
                  </h4>
                  <p className="text-[#666666] leading-relaxed">
                    Foodie composting chambers operate between 55°C and 70°C. This thermophilic temperature range ensures rapid microbial digestion and complete pasteurization, eliminating food-borne pathogens.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E3E4E6]">
                  <h4 className="font-bold text-[#171717] mb-1">
                    How does the Victron ET340 meter monitor power?
                  </h4>
                  <p className="text-[#666666] leading-relaxed">
                    The Victron ET340 3-phase meter records real-time voltage across L1, L2, and L3, current amperage, line frequency (50 Hz nominal), and cumulative kWh consumption over an RS485 Modbus link to the edge gateway.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E3E4E6]">
                  <h4 className="font-bold text-[#171717] mb-1">
                    What happens when facility Wi-Fi or cellular drops?
                  </h4>
                  <p className="text-[#666666] leading-relaxed">
                    The local Raspberry Pi edge controller enters Store-and-Forward mode, buffering sensor records into a local SQLite queue. Once network access returns, all buffered batches replay in chronological order with zero data loss.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E3E4E6]">
                  <h4 className="font-bold text-[#171717] mb-1">
                    How do I resolve safety interlock alerts?
                  </h4>
                  <p className="text-[#666666] leading-relaxed">
                    When the door safety switch or high-temperature threshold triggers an alert, inspect the machine physical latch and biological bin level, then press "Resolve" in the Alerts screen to acknowledge the event in the audit log.
                  </p>
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-[#E3E4E6] bg-[#FAFAFA] flex items-center justify-between">
                <span className="text-[11px] text-[#888888]">PowerTech Energy Operations Support</span>
                <button
                  type="button"
                  onClick={() => setIsFaqOpen(false)}
                  className="px-4 py-2 bg-[#171717] hover:bg-black text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    );
  };


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User, Menu, X, Globe } from 'lucide-react';
import { getAppSettings } from '../utils/configManager';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Header({ activeTab, setActiveTab }: HeaderProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [settings, setSettings] = React.useState(getAppSettings());

  React.useEffect(() => {
    const handleTrigger = () => {
      setSettings(getAppSettings());
    };
    window.addEventListener("caogia_settings_updated", handleTrigger);
    return () => {
      window.removeEventListener("caogia_settings_updated", handleTrigger);
    };
  }, []);

  const tabs = [
    { id: 'tin-tuc', label: settings.tabTintucLabel },
    { id: 'gia-pha', label: settings.tabGiaphaLabel },
    { id: 'pha-ky', label: settings.tabPhakyLabel },
    { id: 'toc-uoc', label: settings.tabTocuocLabel },
    { id: 'lich-gio', label: settings.tabLichgioLabel },
    { id: 'lich-am', label: settings.tabLichamLabel },
    { id: 'admin-dashboard', label: settings.tabDashboardLabel },
  ];

  return (
    <header className="sticky top-0 z-50 bg-silk-paper/90 backdrop-blur-md border-b border-ink-charcoal/5 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo / Branding */}
        <div 
          className="flex items-center space-x-2 cursor-pointer group"
          onClick={() => setActiveTab('tin-tuc')}
          id="branding-logo"
        >
          <div className="w-9 h-9 bg-primary flex items-center justify-center rounded-sm text-silk-paper font-serif font-bold text-lg select-none shadow-md">
            {settings.brandChar}
          </div>
          <span className="font-serif text-xl font-bold text-primary tracking-tight transition-colors duration-200 group-hover:text-primary-hover">
            {settings.homeTitle}
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-8" id="desktop-nav">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-1 pr-1 font-sans text-[15px] font-medium tracking-wide transition-colors duration-300 ${
                  isActive 
                    ? 'text-primary font-semibold' 
                    : 'text-ink-charcoal/70 hover:text-primary'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side Utility */}
        <div className="hidden lg:flex items-center space-x-4" id="header-right-utility">
          <div className="flex items-center text-xs text-ink-charcoal/50 space-x-1.5 font-mono bg-ink-charcoal/5 py-1 px-2.5 rounded-sm">
            <Globe className="w-3.5 h-3.5 text-secondary" />
            <span>Ninh Bình</span>
          </div>
          <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center bg-primary/5 text-primary cursor-pointer hover:bg-primary hover:text-silk-paper transition-all duration-300">
            <User className="w-4 h-4" />
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="lg:hidden flex items-center space-x-4">
          <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center bg-primary/5 text-primary cursor-pointer">
            <User className="w-4 h-4" />
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-ink-charcoal hover:text-primary focus:outline-none transition-colors duration-200"
            aria-label="Toggle menu"
            id="mobile-menu-toggle"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isOpen && (
        <div className="lg:hidden mt-4 pt-4 border-t border-ink-charcoal/5 bg-silk-paper animate-fade-in" id="mobile-nav-drawer">
          <div className="flex flex-col space-y-4 pb-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`mobile-tab-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsOpen(false);
                  }}
                  className={`text-left pl-2 py-2 text-[15px] font-medium transition-colors duration-300 ${
                    isActive 
                      ? 'border-l-4 border-primary text-primary font-semibold bg-primary/5' 
                      : 'text-ink-charcoal/70 hover:text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
            <div className="pt-2 border-t border-ink-charcoal/5 flex items-center space-x-2 pl-2">
              <Globe className="w-4 h-4 text-secondary" />
              <span className="font-mono text-xs text-ink-charcoal/60">Ban trị sự họ Cao Ninh Bình</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

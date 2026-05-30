/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Newspaper, Network, BookOpen, ScrollText, CalendarDays, Moon, Sliders } from 'lucide-react';
import { getAppSettings } from '../utils/configManager';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
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

  const menuItems = [
    { id: 'tin-tuc', icon: Newspaper, label: settings.tabTintucLabel },
    { id: 'gia-pha', icon: Network, label: settings.tabGiaphaLabel },
    { id: 'pha-ky', icon: BookOpen, label: settings.tabPhakyLabel },
    { id: 'toc-uoc', icon: ScrollText, label: settings.tabTocuocLabel },
    { id: 'lich-gio', icon: CalendarDays, label: settings.tabLichgioLabel },
    { id: 'lich-am', icon: Moon, label: settings.tabLichamLabel },
    { id: 'admin-dashboard', icon: Sliders, label: settings.tabDashboardLabel },
  ];

  return (
    <aside 
      className="hidden md:flex flex-col items-center w-16 bg-silk-paper border-r border-ink-charcoal/5 py-8 space-y-6"
      id="left-slim-sidebar"
    >
      <div className="flex flex-col items-center space-y-5 w-full">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-item-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`relative group flex items-center justify-center w-11 h-11 rounded-sm transition-all duration-300 ${
                isActive 
                  ? 'bg-primary text-silk-paper shadow-md' 
                  : 'text-ink-charcoal/60 hover:text-primary hover:bg-primary/5'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              
              {/* Active Indicator Bar on left sidebar */}
              {isActive && (
                <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-secondary rounded-r-md" />
              )}

              {/* Tooltip on Hover */}
              <span className="absolute left-16 scale-0 transition-transform duration-200 origin-left group-hover:scale-100 bg-ink-charcoal text-silk-paper text-xs py-1 px-2.5 rounded-sm shadow-lg whitespace-nowrap z-50 pointer-events-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      
      <div className="mt-auto flex flex-col items-center">
        {/* Ancient lineage stamp style */}
        <div className="w-6 h-6 border border-primary/40 rounded-sm flex items-center justify-center text-[10px] font-serif font-bold text-primary opacity-60 select-none">
          印
        </div>
      </div>
    </aside>
  );
}

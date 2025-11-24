"use client"

import { Package, Users, Settings, Grid, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TabConfig {
  id: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabs?: TabConfig[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  grid: Grid,
  users: Users,
  settings: Settings,
  file: FileText,
  package: Package,
};

const defaultTabs: TabConfig[] = [
  { id: 'elements', label: 'Elements', icon: 'package' },
  { id: 'customers', label: 'Customers', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];

export default function Sidebar({ children, activeTab = 'elements', onTabChange, tabs = defaultTabs }: SidebarProps) {

  return (
    <div className="w-80 bg-background border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-base font-semibold text-foreground">Packing Slip Generator</h1>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => {
          const IconComponent = iconMap[tab.icon] || Package;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => onTabChange?.(tab.id)}
              className={`flex-1 rounded-none border-b-2 border-transparent h-12 text-xs px-1 ${
                isActive 
                  ? 'border-b-primary text-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
            >
              <IconComponent className="w-4 h-4 mr-1" />
              <span className="truncate">{tab.label}</span>
            </Button>
          );
        })}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </div>
  );
}
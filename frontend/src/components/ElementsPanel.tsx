"use client";

import { Type, Building, User, Table, BarChart3, Image, PenTool, Minus, LucideIcon } from "lucide-react";
import { DraggableElement } from "./template-editor/DraggableElement";

interface ElementItem {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  category: string;
}

const elementItems: ElementItem[] = [
  { id: 'text', name: 'Text', icon: Type, description: 'Add text content', category: 'Content' },
  { id: 'company-header', name: 'Company Header', icon: Building, description: 'Company information', category: 'Headers' },
  { id: 'customer-info', name: 'Customer Info', icon: User, description: 'Customer details', category: 'Content' },
  { id: 'item-table', name: 'Item Table', icon: Table, description: 'Items list table', category: 'Tables' },
  { id: 'order-summary', name: 'Order Summary', icon: BarChart3, description: 'Order totals', category: 'Content' },
  { id: 'logo', name: 'Logo', icon: Image, description: 'Company logo', category: 'Media' },
  { id: 'signature', name: 'Signature', icon: PenTool, description: 'Signature field', category: 'Content' },
  { id: 'divider', name: 'Divider', icon: Minus, description: 'Horizontal line', category: 'Layout' }
];

export default function ElementsPanel() {
  const categories = [...new Set(elementItems.map(item => item.category))];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Elements</h2>
        <p className="text-sm text-muted-foreground">Drag elements onto the canvas to build your packing slip</p>
      </div>

      <div className="space-y-6">
        {categories.map(category => (
          <div key={category}>
            <h3 className="text-sm font-medium text-foreground mb-3">{category}</h3>
            <div className="space-y-2">
              {elementItems.filter(item => item.category === category).map(element => (
                <DraggableElement
                  key={element.id}
                  {...element}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
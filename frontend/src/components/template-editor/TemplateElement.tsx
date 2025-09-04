"use client";

import { useState, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTemplateStore } from "@/store/templateStore";
import { TemplateElement as TemplateElementType } from "@/types/template";
import { cn } from "@/lib/utils";
import { 
  Type, Building, User, Table, BarChart3, 
  Image, PenTool, Minus, Trash2, Copy 
} from "lucide-react";

interface TemplateElementProps {
  element: TemplateElementType;
  isSelected: boolean;
  zoom: number;
}

const elementIcons = {
  'text': Type,
  'company-header': Building,
  'customer-info': User,
  'item-table': Table,
  'order-summary': BarChart3,
  'logo': Image,
  'signature': PenTool,
  'divider': Minus,
};

export function TemplateElement({ element, isSelected, zoom }: TemplateElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  
  const { 
    selectElement, 
    updateElement, 
    deleteElement, 
    duplicateElement,
    moveElement,
    resizeElement 
  } = useTemplateStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: element.id,
    data: {
      ...element,
      isNew: false, // Mark as existing element
    },
    disabled: isEditing || isResizing,
  });

  const style = {
    position: 'absolute' as const,
    left: element.position.x,
    top: element.position.y,
    width: element.size.width,
    height: element.size.height,
    // Apply transform normally - dnd-kit handles the drag transform properly
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
    ...element.styles,
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectElement(element.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.type === 'text') {
      setIsEditing(true);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElement(element.id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateElement(element.id);
  };

  const handleResize = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.size.width;
    const startHeight = element.size.height;
    const scale = zoom / 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale;
      const deltaY = (moveEvent.clientY - startY) / scale;

      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction.includes('right')) {
        newWidth = Math.max(50, startWidth + deltaX);
      }
      if (direction.includes('bottom')) {
        newHeight = Math.max(30, startHeight + deltaY);
      }

      resizeElement(element.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const renderContent = () => {
    const Icon = elementIcons[element.type];
    
    switch (element.type) {
      case 'text':
        return isEditing ? (
          <textarea
            className="w-full h-full p-2 resize-none border-none outline-none bg-transparent"
            defaultValue={element.content.text}
            autoFocus
            onBlur={(e) => {
              updateElement(element.id, { 
                content: { ...element.content, text: e.target.value } 
              });
              setIsEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="p-2">{element.content.text}</div>
        );
        
      case 'company-header':
        return (
          <div className="p-4">
            <h2 className="font-bold text-lg">{element.content.companyName}</h2>
            <p className="text-sm">{element.content.address}</p>
            <p className="text-sm">{element.content.city}</p>
            <p className="text-sm">{element.content.phone}</p>
          </div>
        );
        
      case 'customer-info':
        return (
          <div className="p-4">
            <p className="font-semibold">Ship To:</p>
            <p>{element.content.name}</p>
            <p>{element.content.company}</p>
            <p>{element.content.address}</p>
          </div>
        );
        
      case 'item-table':
        return (
          <div className="p-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {element.content.columns.map((col: string) => (
                    <th key={col} className="text-left p-1">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-1" colSpan={element.content.columns.length}>
                    <span className="text-muted-foreground">Items will appear here</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
        
      case 'divider':
        return (
          <div 
            className="w-full" 
            style={{ 
              borderTop: `${element.content.thickness}px ${element.content.style} currentColor`,
              height: element.content.thickness 
            }}
          />
        );
        
      case 'logo':
        return (
          <div className="flex items-center justify-center w-full h-full border-2 border-dashed border-gray-300">
            <Icon className="w-8 h-8 text-gray-400" />
          </div>
        );
        
      default:
        return (
          <div className="flex items-center justify-center w-full h-full">
            <Icon className="w-6 h-6 text-gray-500" />
          </div>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-move bg-white border transition-all",
        isSelected ? "border-primary shadow-md" : "border-gray-200 hover:border-gray-400",
        isDragging && "opacity-50"
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      {...attributes}
      {...listeners}
    >
      {renderContent()}
      
      {/* Selection Controls */}
      {isSelected && !isDragging && (
        <>
          {/* Action Buttons */}
          <div className="absolute -top-8 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDuplicate}
              className="p-1 bg-white rounded shadow-sm hover:bg-gray-50"
              title="Duplicate"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 bg-white rounded shadow-sm hover:bg-red-50 text-red-500"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          
          {/* Resize Handles */}
          <div
            className="absolute -right-1 -bottom-1 w-3 h-3 bg-primary rounded-full cursor-se-resize"
            onMouseDown={(e) => handleResize(e, 'bottom-right')}
          />
          <div
            className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full cursor-e-resize"
            onMouseDown={(e) => handleResize(e, 'right')}
          />
          <div
            className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-3 h-3 bg-primary rounded-full cursor-s-resize"
            onMouseDown={(e) => handleResize(e, 'bottom')}
          />
        </>
      )}
    </div>
  );
}
"use client";

import { useRef, useState, useCallback } from "react";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { useTemplateStore } from "@/store/templateStore";
import { TemplateElement } from "./TemplateElement";
import { cn } from "@/lib/utils";
import { Position } from "@/types/template";

interface TemplateCanvasProps {
  className?: string;
}

export function TemplateCanvas({ className }: TemplateCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [dragPreview, setDragPreview] = useState<Position | null>(null);
  
  const { template, selectedElement, selectElement } = useTemplateStore();
  const { active } = useDndContext();
  
  const { setNodeRef, isOver } = useDroppable({
    id: "template-canvas",
  });

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only deselect if clicking directly on canvas
    if (e.target === e.currentTarget) {
      selectElement(null);
    }
  };

  const getCanvasPosition = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  return (
    <div className={cn("flex-1 bg-muted/30 overflow-auto p-8", className)}>
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-4 bg-background rounded-lg p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={cn(
              "px-3 py-1 rounded text-sm",
              showGrid ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            Grid
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(25, zoom - 25))}
            className="px-2 py-1 rounded bg-muted hover:bg-muted/80"
          >
            -
          </button>
          <span className="text-sm w-12 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 25))}
            className="px-2 py-1 rounded bg-muted hover:bg-muted/80"
          >
            +
          </button>
        </div>
        
        <div className="ml-auto text-sm text-muted-foreground">
          {template.elements.length} elements
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex justify-center">
        <div
          ref={setNodeRef}
          className={cn(
            "relative bg-white shadow-xl transition-all",
            isOver && "ring-2 ring-primary ring-offset-2"
          )}
          data-canvas-container="true"
          data-zoom={zoom}
          style={{
            width: template.pageSettings.width,
            height: template.pageSettings.height,
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
          }}
        >
          {/* Grid Overlay */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                  linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            />
          )}

          {/* Page Margins Guide */}
          <div
            className="absolute border border-dashed border-gray-300 pointer-events-none"
            style={{
              top: template.pageSettings.margins.top,
              left: template.pageSettings.margins.left,
              right: template.pageSettings.margins.right,
              bottom: template.pageSettings.margins.bottom,
              width: `calc(100% - ${template.pageSettings.margins.left + template.pageSettings.margins.right}px)`,
              height: `calc(100% - ${template.pageSettings.margins.top + template.pageSettings.margins.bottom}px)`,
            }}
          />

          {/* Canvas Content */}
          <div
            ref={canvasRef}
            className="absolute inset-0"
            onClick={handleCanvasClick}
            data-canvas="true"
          >
            {/* Render Template Elements */}
            {template.elements.map((element) => (
              <TemplateElement
                key={element.id}
                element={element}
                isSelected={selectedElement === element.id}
                zoom={zoom}
              />
            ))}
          </div>

          {/* Enhanced Drop Indicator */}
          {isOver && (
            <>
              {/* Drop zone highlight */}
              <div className="absolute inset-0 bg-primary/5 pointer-events-none border-2 border-primary border-dashed animate-pulse" />
              
              {/* Drop guidance */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary-foreground rounded-full animate-bounce" />
                  <span className="text-sm font-medium">
                    {active?.data.current?.isNew 
                      ? `Drop to add ${active.data.current.type.replace('-', ' ')}`
                      : 'Drop to place element'}
                  </span>
                </div>
              </div>
              
              {/* Grid snap indicators - show snap points when dragging */}
              {showGrid && active && (
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `
                        radial-gradient(circle at center, #3b82f6 2px, transparent 2px)
                      `,
                      backgroundSize: "20px 20px",
                      opacity: 0.3,
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
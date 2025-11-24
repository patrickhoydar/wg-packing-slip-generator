"use client"

import { useRef, useState, useCallback } from "react"
import { useDroppable } from "@dnd-kit/core"
import { useTemplateStore } from "@/store/templateStore"
import { TemplateElement } from "./TemplateElement"
import { cn } from "@/lib/utils"

interface TemplateCanvasProps {
  className?: string
}

export function TemplateCanvas({ className }: TemplateCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(100)
  const gridSize = 20 // Grid size in pixels

  const { template, selectedElement, selectElement } = useTemplateStore()

  const { setNodeRef, isOver } = useDroppable({
    id: "template-canvas",
    data: {
      accepts: ['element', 'new-element'],
    }
  })

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only deselect if clicking directly on canvas
    if (e.target === e.currentTarget) {
      selectElement(null)
    }
  }

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
          data-droppable-canvas="true"
          className={cn(
            "relative bg-white shadow-xl transition-all",
            isOver && "ring-2 ring-primary ring-offset-2"
          )}
          style={{
            width: template.pageSettings.width,
            height: template.pageSettings.height,
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
          }}
        >
          {/* Grid Overlay - aligned with margins */}
          {showGrid && (
            <div
              className="absolute pointer-events-none"
              style={{
                top: template.pageSettings.margins.top,
                left: template.pageSettings.margins.left,
                right: template.pageSettings.margins.right,
                bottom: template.pageSettings.margins.bottom,
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0",
              }}
            />
          )}

          {/* Page Margins Guide */}
          <div
            className="absolute border-2 border-dashed border-blue-300 pointer-events-none"
            style={{
              top: template.pageSettings.margins.top - 1,
              left: template.pageSettings.margins.left - 1,
              right: template.pageSettings.margins.right - 1,
              bottom: template.pageSettings.margins.bottom - 1,
              width: `calc(100% - ${template.pageSettings.margins.left + template.pageSettings.margins.right - 2}px)`,
              height: `calc(100% - ${template.pageSettings.margins.top + template.pageSettings.margins.bottom - 2}px)`,
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

          {/* Simple Drop Indicator */}
          {isOver && (
            <div className="absolute inset-0 bg-primary/10 pointer-events-none border-2 border-primary border-dashed" />
          )}
        </div>
      </div>
    </div>
  )
}

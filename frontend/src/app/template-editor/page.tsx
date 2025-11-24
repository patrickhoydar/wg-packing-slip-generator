"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  Modifier
} from "@dnd-kit/core";
import { createSnapModifier } from "@dnd-kit/modifiers";
import { useTemplateStore } from "@/store/templateStore";
import { TemplateCanvas } from "@/components/template-editor/TemplateCanvas";
import ElementsPanel from "@/components/ElementsPanel";
import Sidebar from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { templatesApi } from "@/lib/api/templates";
import { 
  Save, Download, Upload, Undo, Redo, 
  FileText, Loader2
} from "lucide-react";

export default function TemplateEditor() {
  const [activeTab, setActiveTab] = useState<"elements" | "properties" | "settings">("elements");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [gridSize] = useState(20); // 20px grid
  
  const { 
    template, 
    selectedElement,
    addElement, 
    moveElement,
    updateTemplate,
    loadTemplate,
    undo,
    redo,
    saveToHistory,
  } = useTemplateStore();

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await templatesApi.findAll();
      if (response.success && Array.isArray(response.data)) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      let response;
      if (template.id && !template.id.startsWith('temp-')) {
        // Update existing template
        response = await templatesApi.update(template.id, template);
      } else {
        // Create new template
        const { id, ...templateData } = template;
        response = await templatesApi.create(templateData);
      }

      if (response.success) {
        alert('Template saved successfully!');
        // Update the template with the saved ID
        if (response.data && !Array.isArray(response.data)) {
          updateTemplate({ id: response.data.id });
        }
        loadTemplates(); // Refresh templates list
      } else {
        alert('Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    setIsLoading(true);
    try {
      const response = await templatesApi.findOne(templateId);
      if (response.success && response.data && !Array.isArray(response.data)) {
        loadTemplate(response.data as any);
        setShowLoadModal(false);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
      alert('Failed to load template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportTemplate = async () => {
    try {
      const dataStr = JSON.stringify(template, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `${template.name.replace(/\s+/g, '-')}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Failed to export template:', error);
      alert('Failed to export template');
    }
  };

  const handleImportTemplate = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const templateData = JSON.parse(text);
        loadTemplate(templateData);
        alert('Template imported successfully!');
      } catch (error) {
        console.error('Failed to import template:', error);
        alert('Failed to import template. Please check the file format.');
      }
    };
    
    input.click();
  };

  // Configure drag sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,
      tolerance: 5,
    },
  });
  
  const sensors = useSensors(mouseSensor, touchSensor);
  
  // Create snap-to-grid modifier
  const snapToGridModifier = useMemo(
    () => createSnapModifier(gridSize),
    [gridSize]
  );
  
  // Helper function to calculate canvas position (temporarily unused)
  // const getCanvasPosition = useCallback((clientX: number, clientY: number) => {
  //   const canvasContainer = document.querySelector('[data-canvas-container="true"]') as HTMLElement;
  //   const canvasElement = document.querySelector('[data-canvas="true"]') as HTMLElement;
  //   
  //   if (!canvasContainer || !canvasElement) {
  //     return { x: 0, y: 0 };
  //   }
  //   
  //   const containerRect = canvasContainer.getBoundingClientRect();
  //   const zoom = parseInt(canvasContainer.getAttribute('data-zoom') || '100') / 100;
  //   
  //   // Calculate position relative to the canvas container, accounting for zoom
  //   const x = (clientX - containerRect.left) / zoom;
  //   const y = (clientY - containerRect.top) / zoom;
  //   
  //   return { x: Math.max(0, x), y: Math.max(0, y) };
  // }, []);
  
  // Snap to grid helper (temporarily unused)
  // const snapToGrid = useCallback((position: { x: number; y: number }, gridSize = 20) => {
  //   return {
  //     x: Math.round(position.x / gridSize) * gridSize,
  //     y: Math.round(position.y / gridSize) * gridSize,
  //   };
  // }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  // Helper function to check if two rectangles overlap
  const checkCollision = (rect1: { x: number; y: number; width: number; height: number },
                         rect2: { x: number; y: number; width: number; height: number }) => {
    return !(
      rect1.x + rect1.width <= rect2.x ||
      rect2.x + rect2.width <= rect1.x ||
      rect1.y + rect1.height <= rect2.y ||
      rect2.y + rect2.height <= rect1.y
    );
  };

  // Helper function to check if position is valid (no overlaps)
  const isValidPosition = (id: string | null, position: { x: number; y: number }, size: { width: number; height: number }) => {
    const newRect = { x: position.x, y: position.y, ...size };
    
    // Check collision with all other elements
    for (const element of template.elements) {
      if (element.id === id) continue; // Skip self
      
      const elementRect = {
        x: element.position.x,
        y: element.position.y,
        width: element.size.width,
        height: element.size.height
      };
      
      if (checkCollision(newRect, elementRect)) {
        return false;
      }
    }
    
    return true;
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over, delta } = event;
    
    if (!over || over.id !== "template-canvas") {
      setActiveDragId(null);
      return;
    }

    // Check if this is a new element being added
    if (active.data.current?.isNew) {
      // Get canvas element to calculate relative position
      const canvasElement = document.querySelector('[data-droppable-canvas="true"]');
      if (canvasElement) {
        const rect = canvasElement.getBoundingClientRect();
        // Get the zoom scale if any
        const zoomScale = parseFloat(canvasElement.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1');
        
        // Get the pointer position from the event
        const pointer = (event as any).activatorEvent;
        if (pointer && pointer.clientX && pointer.clientY) {
          // Add delta to get final position
          const finalX = pointer.clientX + delta.x;
          const finalY = pointer.clientY + delta.y;
          
          // Calculate position relative to canvas, accounting for zoom
          const x = (finalX - rect.left) / zoomScale;
          const y = (finalY - rect.top) / zoomScale;
          
          // Get the default size for this element type
          const elementType = active.data.current.type;
          const defaultSize = { width: 200, height: 100 }; // Default fallback
          
          // Calculate the position where element should be placed (cursor minus half size)
          const rawPositionX = x - defaultSize.width / 2;
          const rawPositionY = y - defaultSize.height / 2;
          
          // Snap the TOP-LEFT corner of the element to the grid (not the center)
          const snappedX = Math.round(rawPositionX / gridSize) * gridSize;
          const snappedY = Math.round(rawPositionY / gridSize) * gridSize;
          
          // Final position with grid alignment
          const position = {
            x: Math.max(40, snappedX), // Start at margin (40px = 2 grid units)
            y: Math.max(40, snappedY)  // Start at margin
          };
          
          // Check if position is valid (no overlaps)
          if (isValidPosition(null, position, defaultSize)) {
            console.log('Drop with snap:', { raw: {x, y}, snapped: {x: snappedX, y: snappedY}, final: position });
            addElement(elementType, position);
          } else {
            // Try to find a nearby valid position
            let found = false;
            const offsets = [
              { x: 0, y: gridSize },    // Below
              { x: gridSize, y: 0 },    // Right
              { x: 0, y: -gridSize },   // Above
              { x: -gridSize, y: 0 },   // Left
              { x: gridSize, y: gridSize },     // Diagonal
              { x: -gridSize, y: gridSize },
              { x: gridSize, y: -gridSize },
              { x: -gridSize, y: -gridSize },
            ];
            
            for (const offset of offsets) {
              const altPosition = {
                x: Math.max(0, position.x + offset.x),
                y: Math.max(0, position.y + offset.y)
              };
              
              if (isValidPosition(null, altPosition, defaultSize)) {
                addElement(elementType, altPosition);
                found = true;
                break;
              }
            }
            
            if (!found) {
              // Place at first available position from top-left
              for (let y = 40; y < template.pageSettings.height - defaultSize.height; y += gridSize) {
                for (let x = 40; x < template.pageSettings.width - defaultSize.width; x += gridSize) {
                  const testPos = { x, y };
                  if (isValidPosition(null, testPos, defaultSize)) {
                    addElement(elementType, testPos);
                    found = true;
                    break;
                  }
                }
                if (found) break;
              }
            }
          }
        } else {
          // Fallback
          addElement(active.data.current.type, { x: 100, y: 100 });
        }
      } else {
        // Fallback if canvas not found
        addElement(active.data.current.type, { x: 100, y: 100 });
      }
    } 
    // Check if this is an existing element being moved
    else {
      const element = template.elements.find(el => el.id === active.id);
      if (element && delta) {
        // Apply the drag delta to move the element with grid snapping
        const rawX = element.position.x + delta.x;
        const rawY = element.position.y + delta.y;
        
        // Snap to grid
        const newPosition = {
          x: Math.max(0, Math.round(rawX / gridSize) * gridSize),
          y: Math.max(0, Math.round(rawY / gridSize) * gridSize)
        };
        
        // Check if new position is valid (no overlaps)
        if (isValidPosition(element.id, newPosition, element.size)) {
          moveElement(element.id, newPosition);
          saveToHistory();
        } else {
          // Revert to original position if collision detected
          console.log('Collision detected, keeping original position');
        }
      }
    }
    
    setActiveDragId(null);
  }, [addElement, template.elements, moveElement, saveToHistory, gridSize, isValidPosition]);

  const selectedElementData = template.elements.find(el => el.id === selectedElement);

  const renderSidebarContent = () => {
    switch (activeTab) {
      case "elements":
        return <ElementsPanel />;
        
      case "properties":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Properties</h2>
            {selectedElementData ? (
              <>
                <div>
                  <label className="text-sm font-medium">Element Type</label>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedElementData.type.replace('-', ' ')}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Position</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Input
                      type="number"
                      value={selectedElementData.position.x}
                      onChange={(e) => moveElement(selectedElementData.id, {
                        x: parseInt(e.target.value) || 0,
                        y: selectedElementData.position.y
                      })}
                      placeholder="X"
                    />
                    <Input
                      type="number"
                      value={selectedElementData.position.y}
                      onChange={(e) => moveElement(selectedElementData.id, {
                        x: selectedElementData.position.x,
                        y: parseInt(e.target.value) || 0
                      })}
                      placeholder="Y"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Size</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Input
                      type="number"
                      value={selectedElementData.size.width}
                      placeholder="Width"
                    />
                    <Input
                      type="number"
                      value={selectedElementData.size.height}
                      placeholder="Height"
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select an element to edit its properties
              </p>
            )}
          </div>
        );
        
      case "settings":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Template Settings</h2>
            
            <div>
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={template.name}
                onChange={(e) => updateTemplate({ name: e.target.value })}
                placeholder="Enter template name"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Page Size</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  type="number"
                  value={template.pageSettings.width}
                  placeholder="Width"
                />
                <Input
                  type="number"
                  value={template.pageSettings.height}
                  placeholder="Height"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Margins</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  type="number"
                  value={template.pageSettings.margins.top}
                  placeholder="Top"
                />
                <Input
                  type="number"
                  value={template.pageSettings.margins.right}
                  placeholder="Right"
                />
                <Input
                  type="number"
                  value={template.pageSettings.margins.bottom}
                  placeholder="Bottom"
                />
                <Input
                  type="number"
                  value={template.pageSettings.margins.left}
                  placeholder="Left"
                />
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
      modifiers={[snapToGridModifier]}
    >
      <div className="h-screen flex flex-col bg-muted/30">
        {/* Header Toolbar */}
        <div className="bg-background border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Template Editor
              </h1>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  title="Undo"
                >
                  <Undo className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  title="Redo"
                >
                  <Redo className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowLoadModal(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Load
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleImportTemplate}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportTemplate}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button 
                size="sm"
                onClick={handleSaveTemplate}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as any)}
            tabs={[
              { id: "elements", label: "Elements", icon: "grid" },
              { id: "properties", label: "Properties", icon: "settings" },
              { id: "settings", label: "Settings", icon: "file" },
            ]}
          >
            {renderSidebarContent()}
          </Sidebar>
          
          <TemplateCanvas className="flex-1" />
        </div>
      </div>
      
      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragId ? (
          <div className="pointer-events-none">
            {activeDragId.startsWith('new-') ? (
              // Preview for new element
              <Card className="p-3 opacity-80 shadow-2xl bg-white border-primary border-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm font-medium">
                    Adding {activeDragId.replace('new-', '').replace('-', ' ')}
                  </span>
                </div>
              </Card>
            ) : (
              // Preview for existing element being moved
              (() => {
                const draggedElement = template.elements.find(el => el.id === activeDragId);
                return draggedElement ? (
                  <div 
                    className="bg-white border-2 border-primary shadow-lg opacity-80 p-2"
                    style={{
                      width: draggedElement.size.width,
                      height: draggedElement.size.height,
                      minWidth: '100px',
                      minHeight: '30px',
                    }}
                  >
                    <div className="text-xs font-medium text-gray-600 capitalize">
                      {draggedElement.type.replace('-', ' ')}
                    </div>
                    {draggedElement.type === 'text' && (
                      <div className="text-sm truncate">{draggedElement.content.text}</div>
                    )}
                  </div>
                ) : (
                  <Card className="p-3 opacity-80 shadow-2xl bg-white border-primary">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Moving element</span>
                    </div>
                  </Card>
                );
              })()
            )}
          </div>
        ) : null}
      </DragOverlay>

      {/* Load Template Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 max-h-[70vh] overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Load Template</h2>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates found</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((tmpl) => (
                    <Card
                      key={tmpl.id}
                      className="p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => handleLoadTemplate(tmpl.id)}
                    >
                      <div className="font-medium">{tmpl.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {tmpl.customerCode || 'Generic'} • {tmpl.elements?.length || 0} elements
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowLoadModal(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </DndContext>
  );
}
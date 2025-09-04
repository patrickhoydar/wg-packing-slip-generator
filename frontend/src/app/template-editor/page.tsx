"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent, 
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragMoveEvent
} from "@dnd-kit/core";
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
  FileText, Settings, Eye, Loader2
} from "lucide-react";

export default function TemplateEditor() {
  const [activeTab, setActiveTab] = useState<"elements" | "properties" | "settings">("elements");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  
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
  
  // Helper function to calculate canvas position
  const getCanvasPosition = useCallback((clientX: number, clientY: number) => {
    const canvasContainer = document.querySelector('[data-canvas-container="true"]') as HTMLElement;
    const canvasElement = document.querySelector('[data-canvas="true"]') as HTMLElement;
    
    if (!canvasContainer || !canvasElement) {
      return { x: 0, y: 0 };
    }
    
    const containerRect = canvasContainer.getBoundingClientRect();
    const zoom = parseInt(canvasContainer.getAttribute('data-zoom') || '100') / 100;
    
    // Calculate position relative to the canvas container, accounting for zoom
    const x = (clientX - containerRect.left) / zoom;
    const y = (clientY - containerRect.top) / zoom;
    
    return { x: Math.max(0, x), y: Math.max(0, y) };
  }, []);
  
  // Snap to grid helper
  const snapToGrid = useCallback((position: { x: number; y: number }, gridSize = 20) => {
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize,
    };
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || over.id !== "template-canvas") {
      setActiveDragId(null);
      return;
    }

    // Get the canvas container for position calculations
    const canvasContainer = document.querySelector('[data-canvas-container="true"]') as HTMLElement;
    const canvasElement = document.querySelector('[data-canvas="true"]') as HTMLElement;
    
    if (!canvasContainer || !canvasElement) {
      setActiveDragId(null);
      return;
    }

    const containerRect = canvasContainer.getBoundingClientRect();
    const zoom = parseInt(canvasContainer.getAttribute('data-zoom') || '100') / 100;

    // Check if this is a new element being added
    if (active.data.current?.isNew) {
      // Use the current mouse position from the drag event
      const mouseX = (event.activatorEvent as MouseEvent).clientX;
      const mouseY = (event.activatorEvent as MouseEvent).clientY;
      
      // Calculate position relative to canvas, accounting for zoom
      const x = (mouseX - containerRect.left) / zoom;
      const y = (mouseY - containerRect.top) / zoom;
      
      // Snap to grid and add element
      const snappedPosition = snapToGrid({
        x: Math.max(0, x - 50), // Offset to center element on cursor
        y: Math.max(0, y - 25)
      });
      
      addElement(active.data.current.type, snappedPosition);
    } 
    // Check if this is an existing element being moved
    else {
      const element = template.elements.find(el => el.id === active.id);
      if (element && event.delta) {
        // Simple calculation - use the delta directly with zoom compensation
        const deltaX = event.delta.x / zoom;
        const deltaY = event.delta.y / zoom;
        
        const newPosition = {
          x: Math.max(0, element.position.x + deltaX),
          y: Math.max(0, element.position.y + deltaY),
        };
        
        // Snap to grid
        const snappedPosition = snapToGrid(newPosition);
        moveElement(element.id, snappedPosition);
        saveToHistory();
      }
    }
    
    setActiveDragId(null);
  }, [snapToGrid, addElement, template.elements, moveElement, saveToHistory]);

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
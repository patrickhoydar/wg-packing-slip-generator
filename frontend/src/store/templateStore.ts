import { create } from 'zustand';
import { TemplateElement, Template, Position, Size } from '@/types/template';
import { nanoid } from 'nanoid';

interface TemplateStore {
  template: Template;
  selectedElement: string | null;
  isDragging: boolean;
  draggedElementId: string | null;
  history: Template[];
  historyIndex: number;
  
  // Actions
  addElement: (type: string, position: Position) => void;
  updateElement: (id: string, updates: Partial<TemplateElement>) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  moveElement: (id: string, position: Position) => void;
  resizeElement: (id: string, size: Size) => void;
  duplicateElement: (id: string) => void;
  
  // Template actions
  loadTemplate: (template: Template) => void;
  updateTemplate: (updates: Partial<Template>) => void;
  clearTemplate: () => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // Drag state
  setIsDragging: (isDragging: boolean) => void;
  setDraggedElementId: (id: string | null) => void;
}

const defaultTemplate: Template = {
  id: nanoid(),
  name: 'Untitled Template',
  elements: [],
  pageSettings: {
    width: 816, // 8.5 inches at 96 DPI
    height: 1056, // 11 inches at 96 DPI  
    margins: {
      top: 40,    // 2 grid units (20px * 2)
      right: 40,   // 2 grid units
      bottom: 40,  // 2 grid units  
      left: 40,    // 2 grid units
    },
  },
};

const createDefaultContent = (type: string) => {
  switch (type) {
    case 'text':
      return { text: 'Click to edit text' };
    case 'company-header':
      return {
        companyName: 'Your Company Name',
        address: '123 Main St',
        city: 'City, State ZIP',
        phone: '(555) 123-4567',
      };
    case 'customer-info':
      return {
        name: '{{customer.name}}',
        company: '{{customer.company}}',
        address: '{{customer.address}}',
      };
    case 'item-table':
      return {
        columns: ['Item', 'SKU', 'Quantity'],
        showHeader: true,
      };
    case 'order-summary':
      return {
        showSubtotal: true,
        showTax: false,
        showShipping: true,
        showTotal: true,
      };
    case 'logo':
      return {
        src: null,
        alt: 'Company Logo',
      };
    case 'signature':
      return {
        label: 'Authorized Signature',
        showLine: true,
      };
    case 'divider':
      return {
        style: 'solid',
        thickness: 1,
      };
    default:
      return {};
  }
};

const createDefaultSize = (type: string): Size => {
  switch (type) {
    case 'text':
      return { width: 200, height: 30 };
    case 'company-header':
      return { width: 300, height: 100 };
    case 'customer-info':
      return { width: 300, height: 120 };
    case 'item-table':
      return { width: 720, height: 300 };
    case 'order-summary':
      return { width: 250, height: 150 };
    case 'logo':
      return { width: 150, height: 75 };
    case 'signature':
      return { width: 200, height: 60 };
    case 'divider':
      return { width: 720, height: 2 };
    default:
      return { width: 200, height: 100 };
  }
};

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  template: defaultTemplate,
  selectedElement: null,
  isDragging: false,
  draggedElementId: null,
  history: [defaultTemplate],
  historyIndex: 0,

  addElement: (type, position) => {
    const newElement: TemplateElement = {
      id: nanoid(),
      type: type as TemplateElement['type'],
      position,
      size: createDefaultSize(type),
      content: createDefaultContent(type),
      visible: true,
    };

    set((state) => ({
      template: {
        ...state.template,
        elements: [...state.template.elements, newElement],
      },
      selectedElement: newElement.id,
    }));
    
    get().saveToHistory();
  },

  updateElement: (id, updates) => {
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === id ? { ...el, ...updates } : el
        ),
      },
    }));
    get().saveToHistory();
  },

  deleteElement: (id) => {
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.filter((el) => el.id !== id),
      },
      selectedElement: state.selectedElement === id ? null : state.selectedElement,
    }));
    get().saveToHistory();
  },

  selectElement: (id) => {
    set({ selectedElement: id });
  },

  moveElement: (id, position) => {
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === id ? { ...el, position } : el
        ),
      },
    }));
  },

  resizeElement: (id, size) => {
    set((state) => ({
      template: {
        ...state.template,
        elements: state.template.elements.map((el) =>
          el.id === id ? { ...el, size } : el
        ),
      },
    }));
    get().saveToHistory();
  },

  duplicateElement: (id) => {
    const element = get().template.elements.find((el) => el.id === id);
    if (!element) return;

    const newElement: TemplateElement = {
      ...element,
      id: nanoid(),
      position: {
        x: element.position.x + 20,
        y: element.position.y + 20,
      },
    };

    set((state) => ({
      template: {
        ...state.template,
        elements: [...state.template.elements, newElement],
      },
      selectedElement: newElement.id,
    }));
    get().saveToHistory();
  },

  loadTemplate: (template) => {
    set({ template, selectedElement: null });
    get().saveToHistory();
  },

  updateTemplate: (updates) => {
    set((state) => ({
      template: { ...state.template, ...updates },
    }));
  },

  clearTemplate: () => {
    set({ 
      template: defaultTemplate, 
      selectedElement: null,
      history: [defaultTemplate],
      historyIndex: 0,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        historyIndex: newIndex,
        template: history[newIndex],
        selectedElement: null,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        historyIndex: newIndex,
        template: history[newIndex],
        selectedElement: null,
      });
    }
  },

  saveToHistory: () => {
    const { template, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(template);
    
    // Limit history to 50 items
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  setIsDragging: (isDragging) => {
    set({ isDragging });
  },

  setDraggedElementId: (id) => {
    set({ draggedElementId: id });
  },
}));
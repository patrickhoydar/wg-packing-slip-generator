interface ElementItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
}

const elementItems: ElementItem[] = [
  { id: 'text', name: 'Text', icon: '📝', description: 'Add text content', category: 'Content' },
  { id: 'company-header', name: 'Company Header', icon: '🏢', description: 'Company information', category: 'Headers' },
  { id: 'customer-info', name: 'Customer Info', icon: '👤', description: 'Customer details', category: 'Content' },
  { id: 'item-table', name: 'Item Table', icon: '📋', description: 'Items list table', category: 'Tables' },
  { id: 'order-summary', name: 'Order Summary', icon: '📊', description: 'Order totals', category: 'Content' },
  { id: 'logo', name: 'Logo', icon: '🖼️', description: 'Company logo', category: 'Media' },
  { id: 'signature', name: 'Signature', icon: '✍️', description: 'Signature field', category: 'Content' },
  { id: 'divider', name: 'Divider', icon: '➖', description: 'Horizontal line', category: 'Layout' }
];

export default function ElementsPanel() {
  const categories = [...new Set(elementItems.map(item => item.category))];

  const handleDragStart = (e: React.DragEvent, element: ElementItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(element));
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Elements</h3>
        <p className="text-sm text-gray-600">Drag elements onto the canvas to build your packing slip</p>
      </div>

      <div className="space-y-4">
        {categories.map(category => (
          <div key={category}>
            <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
            <div className="grid grid-cols-1 gap-2">
              {elementItems.filter(item => item.category === category).map(element => (
                <div
                  key={element.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, element)}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-300 cursor-move transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{element.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{element.name}</div>
                      <div className="text-xs text-gray-500">{element.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
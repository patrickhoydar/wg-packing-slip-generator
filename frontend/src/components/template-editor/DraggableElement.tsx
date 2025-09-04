"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableElementProps {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  category: string;
}

export function DraggableElement({ 
  id, 
  name, 
  icon: Icon, 
  description 
}: DraggableElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `new-${id}`,
    data: {
      type: id,
      name,
      isNew: true,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          "p-3 cursor-move transition-all duration-200",
          isDragging 
            ? "opacity-50 scale-105 shadow-lg" 
            : "hover:bg-muted/50 hover:border-primary/20"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">{name}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
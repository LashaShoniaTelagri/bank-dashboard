import { GripVertical } from "lucide-react";
import { PALETTE, type AleNodeType, type PaletteGroup } from "./graphTypes";

const GROUPS: PaletteGroup[] = ["Input", "Source", "Algorithm", "Output"];

/** Left sidebar of draggable component cards. Drag → drop onto the canvas. */
export const NodePalette = () => {
  const onDragStart = (e: React.DragEvent, type: AleNodeType) => {
    e.dataTransfer.setData("application/ale-node", type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-52 shrink-0 space-y-3 overflow-y-auto border-r bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-body-secondary">Drag onto canvas</p>
      {GROUPS.map((g) => (
        <div key={g} className="space-y-1.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-body-secondary">{g}</h4>
          {PALETTE.filter((p) => p.group === g).map((item) => (
            <div
              key={item.type}
              draggable={!item.disabled}
              onDragStart={(e) => !item.disabled && onDragStart(e, item.type)}
              className={`flex items-start gap-1.5 rounded-md border bg-card p-2 text-left ${
                item.disabled ? "cursor-not-allowed opacity-50" : "cursor-grab hover:border-emerald-500 active:cursor-grabbing"
              }`}
              title={item.disabled ? "Coming soon" : `Drag to add ${item.label}`}
            >
              <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-body-secondary" />
              <div>
                <div className="text-xs font-medium text-heading-primary">{item.label}</div>
                <div className="text-[10px] text-body-secondary">{item.description}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
};

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SeriesColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  availableColors: string[];
}

export const SeriesColorPicker = ({ color, onChange, availableColors }: SeriesColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(color);

  useEffect(() => {
    setCustomColor(color);
  }, [color]);

  const handleColorSelect = (selectedColor: string) => {
    onChange(selectedColor);
    setIsOpen(false);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-10 h-10 p-0 border-2"
          style={{ backgroundColor: color, borderColor: color }}
          title="Change color"
        >
          <span className="sr-only">Pick color</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Preset Colors</div>
          <div className="grid grid-cols-6 gap-2">
            {availableColors.map((presetColor) => (
              <button
                key={presetColor}
                type="button"
                onClick={() => handleColorSelect(presetColor)}
                className="w-8 h-8 rounded-md border-2 hover:scale-110 transition-transform"
                style={{
                  backgroundColor: presetColor,
                  borderColor: color === presetColor ? 'hsl(var(--foreground))' : 'transparent',
                }}
                title={presetColor}
              />
            ))}
          </div>
          
          <div className="space-y-2 pt-2 border-t">
            <div className="text-sm font-medium">Custom Color</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                className="w-12 h-12 rounded border cursor-pointer"
              />
              <Input
                type="text"
                value={customColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setCustomColor(newColor);
                  if (/^#[0-9A-F]{6}$/i.test(newColor)) {
                    onChange(newColor);
                  }
                }}
                placeholder="#22c55e"
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};


import { forwardRef, useRef } from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ 
    value, 
    onChange, 
    placeholder = "Pick a date",
    minDate,
    maxDate,
    disabled = false,
    className
  }, forwardedRef) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const ref = forwardedRef || inputRef;
    
    const formatDateForInput = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    const handleContainerClick = () => {
      if (!disabled) {
        const input = typeof ref === 'function' ? inputRef.current : ref?.current;
        if (input && input.showPicker) {
          input.showPicker();
        }
      }
    };

    return (
      <div 
        className={cn("relative cursor-pointer", className)}
        onClick={handleContainerClick}
      >
        <input
          ref={ref}
          type="date"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          min={minDate ? formatDateForInput(minDate) : undefined}
          max={maxDate ? formatDateForInput(maxDate) : undefined}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            // Hide the native calendar icon to prevent duplication
            "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
            "pr-10", // Add padding for our custom icon
            disabled && "opacity-50 cursor-not-allowed"
          )}
          placeholder={placeholder}
        />
        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
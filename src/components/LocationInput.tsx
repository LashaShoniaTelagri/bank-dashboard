import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Edit3 } from "lucide-react";
import LocationPickerModal from "./LocationPickerModal";

interface LocationData {
  name: string;
  lat?: number;
  lng?: number;
}

interface LocationInputProps {
  label?: string;
  value?: LocationData;
  onChange: (location: LocationData) => void;
  placeholder?: string;
}

const LocationInput = memo(function LocationInput({ 
  label = 'Location', 
  value, 
  onChange, 
  placeholder = 'Click to select location' 
}: LocationInputProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLocationSelect = (location: LocationData) => {
    onChange(location);
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">
        {label} <span className="text-red-500">*</span>
      </Label>
      
      <Button
        type="button"
        variant="outline"
        onClick={openModal}
        className="w-full h-10 justify-start text-left font-normal border-border hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        aria-label={value?.name ? `Selected location: ${value.name}. Click to change location` : "Click to select farm location"}
      >
        <MapPin className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span className={`flex-1 truncate ${value?.name ? "text-foreground" : "text-muted-foreground"}`}>
          {value?.name || placeholder}
        </span>
        <Edit3 className="ml-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
      </Button>

      {value?.lat && value?.lng && (
        <p className="text-xs text-muted-foreground mt-1">
          Coordinates: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </p>
      )}

      <LocationPickerModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onLocationSelect={handleLocationSelect}
        initialLocation={value}
      />
    </div>
  );
});

export default LocationInput;
export type { LocationData };

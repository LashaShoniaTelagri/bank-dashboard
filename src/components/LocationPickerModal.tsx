import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, X } from "lucide-react";

interface LocationData {
  name: string;
  lat?: number;
  lng?: number;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
  initialLocation?: LocationData;
}

declare global {
  interface Window { 
    google?: any;
    initLocationPicker?: () => void;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();
    
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }
    
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
}

export default function LocationPickerModal({ 
  isOpen, 
  onClose, 
  onLocationSelect, 
  initialLocation 
}: LocationPickerModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(initialLocation?.name || '');
  const [selectedLocation, setSelectedLocation] = useState<LocationData>(
    initialLocation || { name: '', lat: 41.7151, lng: 44.8271 } // Default to Tbilisi, Georgia
  );
  const isSelectingFromAutocomplete = useRef(false);

  // Initialize Google Maps
  const initializeMap = useCallback(async () => {
    if (!mapRef.current || !window.google) return;

    try {
      // Use initial location or default to Tbilisi
      const center = { 
        lat: initialLocation?.lat || 41.7151, 
        lng: initialLocation?.lng || 44.8271 
      };

      // Create map
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center,
        mapTypeId: window.google.maps.MapTypeId.SATELLITE,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ]
      });

      mapInstanceRef.current = map;

      // Create draggable marker with default red pin
      const marker = new window.google.maps.Marker({
        position: center,
        map,
        draggable: true,
        title: 'Drag to select location'
        // Using default red pin icon (no custom icon specified)
      });

      markerRef.current = marker;

      // Handle marker drag - preserve zoom level
      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        if (position) {
          const lat = position.lat();
          const lng = position.lng();
          
          // Reverse geocode to get address (don't change map zoom or center)
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              const address = results[0].formatted_address;
              setSelectedLocation({ name: address, lat, lng });
              setSearchValue(address);
            } else {
              setSelectedLocation({ name: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng });
              setSearchValue(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
          });
        }
      });

      // Handle map click - preserve zoom level
      map.addListener('click', (event: any) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        // Only move marker, don't change map zoom or center
        marker.setPosition({ lat, lng });
        
        // Reverse geocode to get address
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results[0]) {
            const address = results[0].formatted_address;
            setSelectedLocation({ name: address, lat, lng });
            setSearchValue(address);
          } else {
            setSelectedLocation({ name: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng });
            setSearchValue(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
        });
      });

      // Initialize autocomplete for search input
      if (searchInputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ['formatted_address', 'geometry', 'name'],
          types: ['establishment', 'geocode']
        });

        autocompleteRef.current = autocomplete;

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place && place.geometry) {
            isSelectingFromAutocomplete.current = true;
            
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const name = place.formatted_address || place.name || '';
            
            
            // Update state
            setSelectedLocation({ name, lat, lng });
            setSearchValue(name);
            
            // Update map and marker position
            const newPosition = { lat, lng };
            map.setCenter(newPosition);
            
            // Only zoom in if we're currently zoomed out (to avoid disrupting user's zoom choice)
            const currentZoom = map.getZoom();
            if (currentZoom < 13) {
              map.setZoom(15);
            }
            
            marker.setPosition(newPosition);
            
            // Reset flag after a delay
            setTimeout(() => {
              isSelectingFromAutocomplete.current = false;
            }, 100);
          }
        });
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing map:', error);
      setError('Failed to initialize map. Please check your internet connection and try again.');
      setIsLoading(false);
    }
  }, [initialLocation]);

  // Load Google Maps when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      
      loadGoogleMaps(import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY)
        .then(() => {
          // Small delay to ensure DOM is ready
          setTimeout(initializeMap, 100);
        })
        .catch((error) => {
          console.error('Failed to load Google Maps:', error);
          setError('Failed to load Google Maps. Please check your API key and internet connection.');
          setIsLoading(false);
        });
    }
  }, [isOpen, initializeMap]);

  // Add global styles for Google Places dropdown in modal
  useEffect(() => {
    if (!isOpen) return;

    const style = document.createElement('style');
    style.id = 'location-picker-styles';
    style.textContent = `
      .pac-container {
        z-index: 9999 !important;
        position: absolute !important;
        pointer-events: auto !important;
        background: white !important;
        border: 1px solid #d1d5db !important;
        border-radius: 8px !important;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
        margin-top: 4px !important;
      }
      .pac-item {
        cursor: pointer !important;
        padding: 12px 16px !important;
        border-bottom: 1px solid #f3f4f6 !important;
        pointer-events: auto !important;
        font-size: 14px !important;
      }
      .pac-item:hover {
        background-color: #f9fafb !important;
      }
      .pac-item-selected {
        background-color: #ecfdf5 !important;
      }
      .pac-matched {
        font-weight: 600 !important;
        color: #059669 !important;
      }
    `;
    document.head.appendChild(style);

    // Add event listeners to prevent modal closing when clicking Google Places
    const handleDocumentClick = (e: Event) => {
      const target = e.target as HTMLElement
      if (target && target.closest('.pac-container')) {
        e.stopPropagation()
        e.stopImmediatePropagation()
      }
    }

    const handleDocumentMouseDown = (e: Event) => {
      const target = e.target as HTMLElement
      if (target && target.closest('.pac-container')) {
        e.stopPropagation()
        e.stopImmediatePropagation()
      }
    }

    // Use capture phase to intercept events before they reach the Dialog
    document.addEventListener('click', handleDocumentClick, { capture: true })
    document.addEventListener('mousedown', handleDocumentMouseDown, { capture: true })

    return () => {
      const existingStyle = document.getElementById('location-picker-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
      document.removeEventListener('click', handleDocumentClick, { capture: true })
      document.removeEventListener('mousedown', handleDocumentMouseDown, { capture: true })
    };
  }, [isOpen]);

  // Update search value when initial location changes
  useEffect(() => {
    if (initialLocation?.name) {
      setSearchValue(initialLocation.name);
      setSelectedLocation(initialLocation);
    }
  }, [initialLocation]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Clear any pending timeouts and reset state
      setError(null);
      setIsLoading(true);
    }
  }, [isOpen]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't update if we're selecting from autocomplete
    if (isSelectingFromAutocomplete.current) {
      return;
    }
    setSearchValue(e.target.value);
  };

  const handleConfirm = () => {
    onLocationSelect(selectedLocation);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Custom handler to prevent closing when clicking on Google Places
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Check if any Google Places dropdown is currently visible
      const pacContainers = document.querySelectorAll('.pac-container')
      const hasVisiblePacContainer = Array.from(pacContainers).some(container => {
        const style = window.getComputedStyle(container)
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
      })
      
      // If Google Places dropdown is visible, don't close the modal
      if (hasVisiblePacContainer) {
        return
      }
      
      handleCancel()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col p-0" aria-describedby="location-picker-desc">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-600" />
            Select Location
          </DialogTitle>
          <p id="location-picker-desc" className="sr-only">Select a location on the map for the farmer</p>
        </DialogHeader>

        {/* Search Input */}
        <div className="flex-shrink-0 p-4 border-b bg-muted/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Search for a location..."
              className="pl-10 pr-4 h-12 text-base"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
                <p className="text-body-secondary">Loading map...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <div className="text-center max-w-md p-6">
                <div className="text-red-500 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-heading-primary mb-2">Map Loading Error</h3>
                <p className="text-body-secondary mb-4">{error}</p>
                <Button 
                  onClick={() => {
                    setError(null);
                    setIsLoading(true);
                    setTimeout(initializeMap, 100);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
          
          {/* Instructions overlay */}
          <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
            <p className="text-sm text-foreground">
              <strong>How to select:</strong><br />
              • Search in the box above<br />
              • Click anywhere on the map<br />
              • Drag the red pin to adjust
            </p>
          </div>
        </div>

        {/* Selected Location Display */}
        {selectedLocation.name && (
          <div className="flex-shrink-0 px-4 py-3 bg-emerald-50 border-t">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800">Selected Location:</p>
                <p className="text-sm text-emerald-700 truncate">{selectedLocation.name}</p>
                {selectedLocation.lat && selectedLocation.lng && (
                  <p className="text-xs text-emerald-600">
                    {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end gap-3 p-4 border-t bg-card">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedLocation.name}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Confirm Location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

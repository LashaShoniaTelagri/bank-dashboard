import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Maximize2 } from 'lucide-react';

interface InlineMapPreviewProps {
  location: {
    name: string;
    lat: number;
    lng: number;
  };
  onExpandClick: () => void;
}

export const InlineMapPreview: React.FC<InlineMapPreviewProps> = ({
  location,
  onExpandClick
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location.lat || !location.lng) return;

    const initMap = () => {
      if (!mapRef.current) {
        setTimeout(initMap, 100);
        return;
      }

      try {
        
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: location.lat, lng: location.lng },
          zoom: 14,
          mapTypeId: google.maps.MapTypeId.HYBRID,
          disableDefaultUI: true, // Remove all controls for clean preview
          draggable: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          keyboardShortcuts: false,
          clickableIcons: false,
        });

        // Add marker at the exact location
        new google.maps.Marker({
          position: { lat: location.lat, lng: location.lng },
          map: map,
          title: location.name,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(24, 24),
          },
        });

        mapInstanceRef.current = map;
        setIsLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error initializing inline map:', err);
        setError('Failed to load map preview');
        setIsLoading(false);
      }
    };

    // Add a small delay to ensure the DOM is ready
    const initializeWithDelay = () => {
      setTimeout(() => {
        // Check if Google Maps is loaded
        if (typeof google !== 'undefined' && google.maps) {
          initMap();
        } else {
          // Load Google Maps if not already loaded
          const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
          
          if (!existingScript) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
            script.async = true;
            script.onload = () => {
              initMap();
            };
            script.onerror = (err) => {
              console.error('Failed to load Google Maps script:', err);
              setError('Failed to load Google Maps');
              setIsLoading(false);
            };
            document.head.appendChild(script);
          } else {
            // Script exists, wait for it to load
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            const checkGoogleMaps = () => {
              attempts++;
              if (typeof google !== 'undefined' && google.maps) {
                initMap();
              } else if (attempts < maxAttempts) {
                setTimeout(checkGoogleMaps, 100);
              } else {
                console.error('Timeout waiting for Google Maps API');
                setError('Timeout loading Google Maps');
                setIsLoading(false);
              }
            };
            checkGoogleMaps();
          }
        }
      }, 100);
    };

    initializeWithDelay();

    return () => {
      mapInstanceRef.current = null;
    };
  }, [location]);

  if (error) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
        <label className="text-xs font-bold text-foreground uppercase tracking-wide underline block mb-2">Location</label>
        <div className="flex items-center gap-2 text-red-600">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {location.name} ({location.lat.toFixed(5)}, {location.lng.toFixed(5)})
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
      <label className="text-xs font-bold text-foreground uppercase tracking-wide underline block mb-2">Location</label>
      
      {/* Location Text */}
      <p className="text-sm font-semibold text-gray-900 mb-3">
        {location.name} ({location.lat.toFixed(5)}, {location.lng.toFixed(5)})
      </p>

      {/* Map Preview Container */}
      <div className="relative group">
        <div 
          className="w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100 relative"
        >
          {/* Map container - always rendered */}
          <div
            ref={mapRef}
            className="w-full h-full cursor-pointer"
            onClick={onExpandClick}
            title="Click to view full map"
            style={{ visibility: isLoading ? 'hidden' : 'visible' }}
          />
          
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="flex items-center gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                <span className="text-sm">Loading map...</span>
              </div>
            </div>
          )}
        </div>

        {/* Expand Button Overlay */}
        {!isLoading && !error && (
          <button
            onClick={onExpandClick}
            className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-lg p-2 shadow-md transition-all duration-200 opacity-0 group-hover:opacity-100"
            title="View full map"
          >
            <Maximize2 className="h-4 w-4 text-foreground" />
          </button>
        )}

        {/* Click to expand hint */}
        {!isLoading && !error && (
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Click to expand
          </div>
        )}
      </div>
    </div>
  );
};

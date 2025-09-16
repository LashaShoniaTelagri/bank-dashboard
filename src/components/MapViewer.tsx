import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface MapViewerProps {
  isOpen: boolean;
  onClose: () => void;
  location: {
    name: string;
    lat: number;
    lng: number;
  };
}

export const MapViewer: React.FC<MapViewerProps> = ({
  isOpen,
  onClose,
  location
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!isOpen || !mapRef.current || !location.lat || !location.lng) return;

    // Initialize Google Maps
    const initMap = () => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: location.lat, lng: location.lng },
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        scaleControl: true,
        streetViewControl: true,
        rotateControl: true,
        fullscreenControl: true,
        // Disable interaction for view-only mode
        draggable: false,
        scrollwheel: false,
        disableDoubleClickZoom: true,
        keyboardShortcuts: false,
      });

      // Add marker at the exact location
      new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: map,
        title: location.name,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new google.maps.Size(32, 32),
        },
      });

      // Add info window with location details
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: system-ui;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${location.name}</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">
              ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
            </p>
          </div>
        `,
        position: { lat: location.lat, lng: location.lng },
      });

      // Show info window by default
      infoWindow.open(map);

      mapInstanceRef.current = map;
    };

    // Check if Google Maps is loaded
    if (typeof google !== 'undefined' && google.maps) {
      initMap();
    } else {
      // Load Google Maps if not already loaded
      const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      mapInstanceRef.current = null;
    };
  }, [isOpen, location]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const mapViewerContent = (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center" style={{ zIndex: 2147483647 }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 p-4" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold">Farm Location</h3>
            <span className="text-gray-400">-</span>
            <span className="text-gray-300">{location.name}</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors cursor-pointer"
            style={{ pointerEvents: 'auto' }}
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Map content */}
      <div className="flex-1 flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          <div className="w-[95vw] h-[85vh] bg-white rounded-lg overflow-hidden">
            <div
              ref={mapRef}
              className="w-full h-full"
              style={{ minHeight: '85vh', minWidth: '95vw' }}
            />
          </div>
        </div>
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />
    </div>
  );

  return typeof document !== 'undefined' && document.body 
    ? createPortal(mapViewerContent, document.body)
    : null;
};

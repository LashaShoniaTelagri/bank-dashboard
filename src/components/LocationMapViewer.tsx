import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LocationMapViewerProps {
  locationName?: string;
  lat?: number;
  lng?: number;
}

declare global {
  interface Window {
    google?: any;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();
    
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null;
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      }
      return;
    }
    
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
}

export const LocationMapViewer = ({ locationName, lat, lng }: LocationMapViewerProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initAttemptRef = useRef(0);

  useEffect(() => {
    if (!lat || !lng) {
      setIsLoading(false);
      return;
    }

    const apiKey = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('🗺️ Google Maps API key not found in environment variables');
      console.error('🗺️ Looking for: VITE_APP_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY');
      setError('Google Maps API key not configured');
      setIsLoading(false);
      return;
    }
    console.log('🗺️ API Key found:', apiKey.substring(0, 10) + '...');

    let mounted = true;
    initAttemptRef.current = 0;

    const initMap = async () => {
      try {
        console.log('🗺️ Loading Google Maps API...');
        await loadGoogleMaps(apiKey);

        if (!mounted || !window.google || !mapRef.current) {
          console.log('🗺️ Component unmounted or Google Maps not available');
          return;
        }

        console.log('🗺️ Google Maps API loaded, initializing map...');

        // Wait for container to be rendered with dimensions
        const checkAndInitialize = () => {
          initAttemptRef.current++;
          
          if (!mounted || !mapRef.current) {
            console.log('🗺️ Component unmounted during initialization');
            return;
          }

          const rect = mapRef.current.getBoundingClientRect();
          console.log(`🗺️ Map container dimensions: ${rect.width}x${rect.height} (attempt ${initAttemptRef.current})`);
          
          if ((rect.width === 0 || rect.height === 0) && initAttemptRef.current < 50) {
            // Container not ready, try again (max 5 seconds)
            setTimeout(checkAndInitialize, 100);
            return;
          }

          if (rect.width === 0 || rect.height === 0) {
            console.error('🗺️ Map container has zero dimensions after multiple attempts');
            if (mounted) {
              setError('Map container not visible. Please ensure the section is expanded.');
              setIsLoading(false);
            }
            return;
          }

          try {
            console.log('🗺️ Creating map instance...');
            // Create map centered on the location
            const map = new window.google.maps.Map(mapRef.current, {
              center: { lat, lng },
              zoom: 15,
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
            console.log('🗺️ Map instance created successfully');

            // Add marker
            const marker = new window.google.maps.Marker({
              position: { lat, lng },
              map: map,
              title: locationName || 'Farm Location',
            });

            markerRef.current = marker;
            console.log('🗺️ Marker added to map');

            // Add info window if location name exists
            if (locationName) {
              const infoWindow = new window.google.maps.InfoWindow({
                content: `<div class="p-2"><strong>${locationName}</strong><br/>${lat.toFixed(6)}, ${lng.toFixed(6)}</div>`,
              });

              marker.addListener('click', () => {
                infoWindow.open(map, marker);
              });
            }

            // Trigger resize after initialization
            setTimeout(() => {
              if (window.google && window.google.maps && mapInstanceRef.current && mounted) {
                window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
                mapInstanceRef.current.setCenter({ lat, lng });
                console.log('🗺️ Map resize triggered');
              }
            }, 200);

            if (mounted) {
              setIsLoading(false);
              setError(null);
            }
          } catch (err) {
            console.error('🗺️ Error creating map:', err);
            if (mounted) {
              setError('Failed to create map instance');
              setIsLoading(false);
            }
          }
        };

        // Start checking for container dimensions with a longer initial delay
        setTimeout(checkAndInitialize, 300);
      } catch (error) {
        console.error('🗺️ Error initializing map:', error);
        if (mounted) {
          setError('Failed to load Google Maps');
          setIsLoading(false);
        }
      }
    };

    // Initialize map
    initMap();

    // Cleanup
    return () => {
      mounted = false;
      console.log('🗺️ Cleaning up map...');
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, locationName]);

  if (!lat || !lng) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Location Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        {locationName && (
          <p className="text-sm text-muted-foreground mb-3">
            {locationName}
          </p>
        )}
        
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <div
            ref={mapRef}
            className="w-full rounded-lg border border-border overflow-hidden bg-muted/20"
            style={{ width: '100%', height: '400px', minHeight: '400px' }}
          />
          
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading map...</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      </CardContent>
    </Card>
  );
};


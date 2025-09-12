import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  label?: string
  value?: { name: string; lat?: number; lng?: number }
  onChange: (val: { name: string; lat?: number; lng?: number }) => void
  placeholder?: string
}

declare global {
  interface Window { google?: any }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve()
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')))
      return
    }
    const script = document.createElement('script')
    script.id = 'google-maps-script'
    const key = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(script)
  })
}

export default function GooglePlacesAutocomplete({ label = 'Location', value, onChange, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadGoogleMaps(import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY).then(() => {
      setReady(true)
    }).catch(() => setReady(false))
  }, [])

  useEffect(() => {
    if (!ready || !inputRef.current || !window.google) return
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry'],
    })
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const name: string = place.formatted_address || inputRef.current?.value || ''
      const lat = place.geometry?.location?.lat?.()
      const lng = place.geometry?.location?.lng?.()
      onChange({ name, lat, lng })
    })
    return () => {
      // no official cleanup for Autocomplete instance
    }
  }, [ready, onChange])

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label} <span className="text-red-500">*</span></Label>
      <Input
        ref={inputRef}
        defaultValue={value?.name || ''}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder={placeholder || 'Search and select a location'}
        className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
      />
    </div>
  )
}


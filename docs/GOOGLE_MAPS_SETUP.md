# Google Maps Setup Guide

## Issue: Location Map Not Displaying

If the location map is showing a dark/blank area, follow these steps to diagnose and fix the issue:

### 1. Check API Key Configuration

The application requires a Google Maps API key to display maps. 

**Environment Variable Required:**
```bash
VITE_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 2. Where to Add the API Key

Create or update your `.env` or `.env.local` file in the project root:

```bash
# File: .env or .env.local
VITE_APP_GOOGLE_MAPS_API_KEY=AIza...your_actual_key_here
```

**Note:** The component also supports the alternative name `VITE_GOOGLE_MAPS_API_KEY` for backward compatibility.

### 3. Get a Google Maps API Key

If you don't have a Google Maps API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
4. Go to "Credentials" section
5. Create an API key
6. **Important:** Restrict the API key to your domains for security

### 4. Restart Development Server

After adding the API key, restart your development server:

```bash
npm run dev
```

### 5. Debugging

The `LocationMapViewer` component now includes extensive logging. Open your browser's console and look for messages starting with 🗺️:

- `🗺️ Loading Google Maps API...` - API is being loaded
- `🗺️ Google Maps API loaded, initializing map...` - API loaded successfully
- `🗺️ Map container dimensions: WxH (attempt N)` - Checking container size
- `🗺️ Creating map instance...` - Creating the map
- `🗺️ Map instance created successfully` - Map created
- `🗺️ Marker added to map` - Marker placed
- `🗺️ Map resize triggered` - Final resize and centering

### 6. Common Issues

#### API Key Missing
**Console Error:** `🗺️ Google Maps API key not found in environment variables`  
**UI Message:** "Google Maps API key not configured"  
**Solution:** Add `VITE_APP_GOOGLE_MAPS_API_KEY` to your `.env` or `.env.local` file

#### Container Not Visible
**Console Error:** `🗺️ Map container has zero dimensions after multiple attempts`  
**UI Message:** "Map container not visible. Please ensure the section is expanded."  
**Solution:** Make sure the "Full Farmer Details" collapsible section is expanded

#### API Load Failure
**Console Error:** `🗺️ Error initializing map: ...`  
**UI Message:** "Failed to load Google Maps"  
**Solution:** Check your API key, network connection, and that the Maps JavaScript API is enabled

### 7. API Key Restrictions (Production)

For production deployment, configure API key restrictions:

1. **HTTP referrers** (for websites):
   - Add your production domain(s)
   - Example: `https://yourdomain.com/*`

2. **API restrictions**:
   - Restrict key to only:
     - Maps JavaScript API
     - Places API

### 8. Environment Variables for Different Environments

For production, use environment-specific keys:

```bash
# Development (.env.local or .env.development)
VITE_APP_GOOGLE_MAPS_API_KEY=your_dev_key

# Production (.env.production)
VITE_APP_GOOGLE_MAPS_API_KEY=your_production_key
```

## Testing the Map

After setup, the map should:
1. Show a loading spinner initially
2. Display a satellite view of the location
3. Show a marker at the exact coordinates
4. Allow zoom, pan, and satellite/map toggle
5. Display coordinates below the map

## Support

If issues persist after following these steps:
1. Check the browser console for 🗺️ log messages
2. Verify the API key has no usage restrictions preventing it from working
3. Check that billing is enabled in Google Cloud (required for Maps API)
4. Ensure the Maps JavaScript API is enabled in your Google Cloud project


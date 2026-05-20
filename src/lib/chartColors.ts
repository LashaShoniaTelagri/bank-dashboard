// Brand color palette for charts - optimized for both light and dark modes
// Based on TelAgri's emerald/green theme

export const getChartColors = (isDark: boolean = false) => {
  if (isDark) {
    // Dark mode colors - brighter and more saturated for visibility
    return {
      primary: '#22c55e',      // emerald-500 - main brand color
      secondary: '#4ade80',    // emerald-400 - lighter variant
      accent: '#16a34a',       // emerald-600 - darker variant
      tertiary: '#10b981',     // emerald-500 alternative
      quaternary: '#34d399',   // emerald-400 alternative
      quinary: '#059669',      // emerald-600 alternative
    };
  } else {
    // Light mode colors - slightly darker for contrast
    return {
      primary: '#16a34a',      // emerald-600 - darker for light bg
      secondary: '#15803d',    // emerald-700 - even darker
      accent: '#22c55e',       // emerald-500 - medium
      tertiary: '#166534',     // emerald-800 - dark variant
      quaternary: '#4ade80',   // emerald-400 - lighter
      quinary: '#10b981',      // emerald-500 - alternative
    };
  }
};

// Get color array for multi-series charts
// Optimized for both light and dark modes with good contrast and visual distinction
export const getChartColorArray = (isDark: boolean = false): string[] => {
  if (isDark) {
    // Dark mode: brighter, more saturated colors for visibility
    return [
      '#22c55e', // emerald-500 - primary green (bright for dark bg)
      '#3b82f6', // blue-500 - good contrast
      '#f59e0b', // amber-500 - warm accent
      '#ef4444', // red-500 - attention
      '#8b5cf6', // violet-500 - distinct
      '#06b6d4', // cyan-500 - fresh
      '#f97316', // orange-500 - vibrant
      '#84cc16', // lime-500 - bright
    ];
  } else {
    // Light mode: slightly darker, more muted for readability
    return [
      '#16a34a', // emerald-600 - primary green (darker for contrast)
      '#2563eb', // blue-600 - good contrast
      '#d97706', // amber-600 - warm accent
      '#dc2626', // red-600 - attention
      '#7c3aed', // violet-600 - distinct
      '#0891b2', // cyan-600 - fresh
      '#ea580c', // orange-600 - vibrant
      '#65a30d', // lime-600 - bright
    ];
  }
};

// Get HSL format colors for theme-aware charts
export const getChartColorsHSL = (isDark: boolean = false) => {
  if (isDark) {
    return {
      primary: 'hsl(142, 71%, 45%)',      // emerald-500
      secondary: 'hsl(142, 76%, 55%)',    // emerald-400
      accent: 'hsl(142, 76%, 36%)',       // emerald-600
      tertiary: 'hsl(142, 72%, 50%)',    // emerald-500 alt
      quaternary: 'hsl(142, 81%, 60%)',   // emerald-400 alt
      quinary: 'hsl(142, 85%, 40%)',     // emerald-600 alt
    };
  } else {
    return {
      primary: 'hsl(142, 76%, 36%)',      // emerald-600
      secondary: 'hsl(142, 72%, 30%)',    // emerald-700
      accent: 'hsl(142, 71%, 45%)',       // emerald-500
      tertiary: 'hsl(142, 70%, 25%)',     // emerald-800
      quaternary: 'hsl(142, 76%, 55%)',   // emerald-400
      quinary: 'hsl(142, 72%, 50%)',      // emerald-500 alt
    };
  }
};

// Get color array in HSL format
export const getChartColorArrayHSL = (isDark: boolean = false): string[] => {
  const colors = getChartColorsHSL(isDark);
  return [
    colors.primary,
    colors.secondary,
    colors.accent,
    colors.tertiary,
    colors.quaternary,
    colors.quinary,
  ];
};


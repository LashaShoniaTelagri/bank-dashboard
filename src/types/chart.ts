// Chart types and interfaces for the chart builder system

export type ChartType = 'line' | 'bar' | 'bar-horizontal' | 'area' | 'pie' | 'donut' | 'scatter' | 'radar' | 'gauge';

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number; // Allow additional fields for multi-series charts
}

export type ChartValueType = 'numeric' | 'percentage';

export interface ChartTemplate {
  id?: string;
  name: string;
  chart_type: ChartType;
  chart_data: {
    data: ChartDataPoint[];
    xAxisKey?: string;
    yAxisKey?: string;
    dataKeys?: string[]; // For multi-series charts
    seriesColors?: Record<string, string>; // Color mapping for each series
    dataPointColors?: Record<string, string>; // Color mapping for individual data points (by name) - useful for pie/donut
    minScore?: number; // Minimum Y-axis value
    maxScore?: number; // Maximum Y-axis value
    xAxisLabelAngle?: number; // X-axis label rotation angle (0, -30, -45, -60, -90)
    valueType?: ChartValueType; // 'numeric' (0-10) or 'percentage' (0%-100%)
  };
  annotation?: string;
  bottom_description?: string; // Rich text HTML description displayed at the bottom of the chart
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  farmer_id?: string; // Associate chart with specific farmer
  phase_number?: number | null; // Optional: Associate chart with specific phase (1-12)
  display_order?: number; // Order for drag and drop arrangement
}


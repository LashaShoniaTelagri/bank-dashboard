import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { X, Plus, Trash2, AlertCircle, Eye, BarChart3, TrendingUp, AreaChart as AreaChartIcon, PieChart as PieChartIcon, ScatterChart as ScatterChartIcon, Radar as RadarIcon, ArrowLeft, Gauge } from "lucide-react";
import { getChartColorArrayHSL, getChartColorArray } from "@/lib/chartColors";
import { useTheme } from "@/hooks/useTheme";
import { SeriesColorPicker } from "@/components/SeriesColorPicker";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import { ChartType, ChartDataPoint, ChartTemplate } from "@/types/chart";

const chartTypeOptions: { value: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'bar', label: 'Bar Chart (Vertical)', icon: BarChart3 },
  { value: 'bar-horizontal', label: 'Bar Chart (Horizontal)', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: TrendingUp },
  { value: 'area', label: 'Area Chart', icon: AreaChartIcon },
  { value: 'pie', label: 'Pie Chart', icon: PieChartIcon },
  { value: 'donut', label: 'Donut Chart', icon: PieChartIcon },
  { value: 'scatter', label: 'Scatter Plot', icon: ScatterChartIcon },
  { value: 'radar', label: 'Radar Chart', icon: RadarIcon },
  { value: 'gauge', label: 'Gauge Chart', icon: Gauge },
];

export const ChartBuilderPage = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const farmerIdFromUrl = searchParams.get('farmerId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const isDark = theme === 'dark';
  
  const [name, setName] = useState('');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [annotation, setAnnotation] = useState('');
  const [farmerId, setFarmerId] = useState<string | null>(farmerIdFromUrl);
  const [phaseNumber, setPhaseNumber] = useState<number | null>(null);
  const [dataPoints, setDataPoints] = useState<ChartDataPoint[]>([
    { name: '', value: 0 }
  ]);
  const [dataKeys, setDataKeys] = useState<string[]>(['value']);
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>({});
  const [dataPointColors, setDataPointColors] = useState<Record<string, string>>({});
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null);
  const [editingKeyValue, setEditingKeyValue] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);

  // Fetch chart if editing
  const { data: existingChart, isLoading: loadingChart } = useQuery({
    queryKey: ['chart-template', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('chart_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as ChartTemplate;
    },
    enabled: !!id,
  });

  // Initialize form when chart is loaded
  useEffect(() => {
    if (existingChart) {
      setName(existingChart.name);
      setChartType(existingChart.chart_type);
      setAnnotation(existingChart.annotation || '');
      setFarmerId((existingChart as any).farmer_id || null);
      setPhaseNumber((existingChart as any).phase_number || null);
      setDataPoints(existingChart.chart_data.data || [{ name: '', value: 0 }]);
      const keys = existingChart.chart_data.dataKeys || ['value'];
      setDataKeys(keys);
      // Initialize colors from saved chart or use defaults
      const savedColors = existingChart.chart_data.seriesColors || {};
      const savedDataPointColors = existingChart.chart_data.dataPointColors || {};
      const defaultColors = getChartColorArray(isDark);
      const initializedColors: Record<string, string> = {};
      keys.filter(k => k !== 'name').forEach((key, index) => {
        initializedColors[key] = savedColors[key] || defaultColors[index % defaultColors.length];
      });
      setSeriesColors(initializedColors);
      
      // Initialize data point colors - use saved colors or assign defaults for pie/donut
      const initializedDataPointColors: Record<string, string> = { ...savedDataPointColors };
      if ((existingChart.chart_type === 'pie' || existingChart.chart_type === 'donut') && existingChart.chart_data.data) {
        existingChart.chart_data.data.forEach((point, index) => {
          if (point.name && !initializedDataPointColors[point.name]) {
            initializedDataPointColors[point.name] = defaultColors[index % defaultColors.length];
          }
        });
      }
      setDataPointColors(initializedDataPointColors);
    } else {
      // Initialize default color for 'value' series
      const defaultColors = getChartColorArray(isDark);
      setSeriesColors({ value: defaultColors[0] });
      setDataPointColors({});
    }
  }, [existingChart, isDark]);

  const addDataPoint = () => {
    const newPoint: ChartDataPoint = { name: '', value: 0 };
    dataKeys.forEach(key => {
      if (key !== 'name') {
        newPoint[key] = 0;
      }
    });
    setDataPoints([...dataPoints, newPoint]);
    
    // For pie/donut charts, assign default color when name is set
    // Color will be assigned when user enters the name
  };

  const removeDataPoint = (index: number) => {
    if (dataPoints.length > 1) {
      setDataPoints(dataPoints.filter((_, i) => i !== index));
    }
  };

  const updateDataPoint = (index: number, field: string, value: string | number) => {
    const updated = [...dataPoints];
    updated[index] = { ...updated[index], [field]: value };
    setDataPoints(updated);
  };

  const addDataKey = () => {
    const newKey = `series${dataKeys.filter(k => k !== 'name').length + 1}`;
    setDataKeys([...dataKeys, newKey]);
    setDataPoints(dataPoints.map(point => ({ ...point, [newKey]: 0 })));
    
    // Assign a unique default color to the new series
    const defaultColors = getChartColorArray(isDark);
    const usedColors = Object.values(seriesColors);
    const availableColor = defaultColors.find(c => !usedColors.includes(c)) || defaultColors[dataKeys.filter(k => k !== 'name').length % defaultColors.length];
    setSeriesColors({ ...seriesColors, [newKey]: availableColor });
  };

  const startEditingKey = (index: number, currentKey: string) => {
    setEditingKeyIndex(index);
    setEditingKeyValue(currentKey);
  };

  const finishEditingKey = (index: number, oldKey: string) => {
    const newKey = editingKeyValue.trim();
    
    if (newKey && newKey !== oldKey && !dataKeys.includes(newKey) && newKey !== 'name') {
      // Update the key in dataKeys array
      const updatedKeys = [...dataKeys];
      updatedKeys[index] = newKey;
      setDataKeys(updatedKeys);
      
      // Update all data points to use the new key
      setDataPoints(dataPoints.map(point => {
        const updatedPoint = { ...point };
        if (oldKey in updatedPoint) {
          updatedPoint[newKey] = updatedPoint[oldKey];
          delete updatedPoint[oldKey];
        }
        return updatedPoint;
      }));
      
      // Update series colors to use the new key
      if (seriesColors[oldKey]) {
        const { [oldKey]: _, ...rest } = seriesColors;
        setSeriesColors({ ...rest, [newKey]: seriesColors[oldKey] });
      }
    } else {
      // Reset to old value if invalid
      setEditingKeyValue(oldKey);
    }
    
    setEditingKeyIndex(null);
  };

  const cancelEditingKey = (oldKey: string) => {
    setEditingKeyValue(oldKey);
    setEditingKeyIndex(null);
  };

  const removeDataKey = (keyToRemove: string) => {
    if (dataKeys.length > 1 && keyToRemove !== 'name') {
      setDataKeys(dataKeys.filter(k => k !== keyToRemove));
      setDataPoints(dataPoints.map(point => {
        const { [keyToRemove]: _, ...rest } = point;
        return rest;
      }));
      // Remove color for deleted series
      const { [keyToRemove]: _, ...restColors } = seriesColors;
      setSeriesColors(restColors);
    }
  };

  const updateSeriesColor = (seriesKey: string, color: string) => {
    setSeriesColors({ ...seriesColors, [seriesKey]: color });
  };

  const updateDataPointColor = (dataPointName: string, color: string) => {
    setDataPointColors({ ...dataPointColors, [dataPointName]: color });
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Chart name is required');
    }

    if (dataPoints.length === 0) {
      newErrors.push('At least one data point is required');
    }

    dataPoints.forEach((point, index) => {
      if (!point.name || point.name.trim() === '') {
        newErrors.push(`Data point ${index + 1} must have a name`);
      }
      
      dataKeys.forEach(key => {
        if (key !== 'name') {
          const value = point[key];
          if (typeof value !== 'number' || isNaN(value)) {
            newErrors.push(`Data point ${index + 1}, ${key} must be a valid number`);
          }
        }
      });
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async (chartData: Omit<ChartTemplate, 'id'>) => {
      const { error } = await supabase
        .from('chart_templates')
        .insert([{
          ...chartData,
          created_by: user?.id,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-templates'] });
      queryClient.invalidateQueries({ queryKey: ['f100-charts'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-charts'] });
      toast({
        title: "Chart created successfully",
        description: "The chart template has been saved and will appear on farmer profiles.",
      });
      // Navigate back to farmer profile if farmerId exists, otherwise go back in history
      if (farmerId) {
        navigate(`/farmers/${farmerId}`);
      } else {
        navigate(-1);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error creating chart",
        description: error.message || "Failed to create chart template",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...chartData }: ChartTemplate & { id: string }) => {
      const { error } = await supabase
        .from('chart_templates')
        .update(chartData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-templates'] });
      queryClient.invalidateQueries({ queryKey: ['f100-charts'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-charts'] });
      toast({
        title: "Chart updated successfully",
        description: "The chart template has been updated.",
      });
      // Navigate back to farmer profile if farmerId exists, otherwise go back in history
      if (farmerId) {
        navigate(`/farmers/${farmerId}`);
      } else {
        navigate(-1);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error updating chart",
        description: error.message || "Failed to update chart template",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const chartData: any = {
      name: name.trim(),
      chart_type: chartType,
      chart_data: {
        data: dataPoints,
        xAxisKey: 'name',
        yAxisKey: dataKeys.find(k => k !== 'name') || 'value',
        dataKeys: dataKeys.filter(k => k !== 'name'),
        seriesColors: seriesColors, // Save custom series colors
        dataPointColors: dataPointColors, // Save custom data point colors
      },
      annotation: annotation.trim() || undefined,
      is_active: true,
      farmer_id: farmerId, // Associate chart with specific farmer
      phase_number: phaseNumber, // Optional: Associate chart with specific phase
    };

    if (id) {
      // When updating, preserve existing display_order if it exists
      updateMutation.mutate({ 
        ...chartData, 
        id,
        display_order: existingChart?.display_order ?? chartData.display_order,
      });
    } else {
      // When creating, set display_order to a high number so it appears at the end
      // Admin can then drag it to the desired position
      createMutation.mutate({ ...chartData, display_order: 999999 });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || loadingChart;

  // Prepare preview data
  const previewData = useMemo(() => {
    return dataPoints
      .filter(point => point.name && point.name.trim() !== '')
      .map((point, index) => {
        const cleanPoint: ChartDataPoint = { 
          name: point.name,
          // Add unique identifier for pie/donut charts to handle duplicate names
          _index: index 
        };
        dataKeys.forEach(key => {
          if (key !== 'name') {
            const value = point[key];
            cleanPoint[key] = typeof value === 'number' && !isNaN(value) ? value : 0;
          }
        });
        return cleanPoint;
      });
  }, [dataPoints, dataKeys]);

  // Chart config with custom or brand colors
  const chartConfig = useMemo(() => {
    const brandColors = getChartColorArray(isDark); // Use hex colors for better compatibility
    return dataKeys
      .filter(k => k !== 'name')
      .reduce((acc, key, index) => {
        // Use custom color if available, otherwise use brand color
        const customColor = seriesColors[key];
        const color = customColor || brandColors[index % brandColors.length];
        
        acc[key] = {
          label: key.charAt(0).toUpperCase() + key.slice(1),
          color: color,
        };
        return acc;
      }, {} as Record<string, { label: string; color: string }>);
  }, [dataKeys, seriesColors, isDark]);

  // Render preview chart (same as ChartBuilderModal)
  const renderPreview = () => {
    if (previewData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground">
          <div className="text-center">
            <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Add data points to see preview</p>
          </div>
        </div>
      );
    }

    // Base margins for preview
    const baseMargin = { top: 20, right: 30, left: 20, bottom: 5 };
    
    // Extra top margin for charts with labels to prevent cutoff
    const marginWithLabels = { top: 40, right: 30, left: 20, bottom: 5 };
    
    // Extra right margin for horizontal bar charts
    const marginWithRightLabels = { top: 20, right: 50, left: 20, bottom: 5 };

    const commonProps = {
      data: previewData,
      margin: baseMargin,
    };

    const previewDataKeys = dataKeys.filter(k => k !== 'name');
    const brandColors = getChartColorArray(isDark); // Use hex colors for better compatibility

    switch (chartType) {
      case 'bar':
        return (
          <ChartContainer config={chartConfig}>
            <BarChart data={previewData} margin={marginWithLabels}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis dataKey="name" stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <YAxis stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              {previewDataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Bar key={key} dataKey={key} fill={color}>
                    <LabelList 
                      dataKey={key} 
                      position="top" 
                      style={{ 
                        fill: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
                        fontSize: '12px',
                        fontWeight: 500
                      }} 
                    />
                  </Bar>
                );
              })}
            </BarChart>
          </ChartContainer>
        );

      case 'bar-horizontal':
        return (
          <ChartContainer config={chartConfig}>
            <BarChart data={previewData} margin={marginWithRightLabels} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis type="number" stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <YAxis dataKey="name" type="category" stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              {previewDataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Bar key={key} dataKey={key} fill={color}>
                    <LabelList 
                      dataKey={key} 
                      position="right" 
                      style={{ 
                        fill: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
                        fontSize: '12px',
                        fontWeight: 500
                      }} 
                    />
                  </Bar>
                );
              })}
            </BarChart>
          </ChartContainer>
        );

      case 'line':
        return (
          <ChartContainer config={chartConfig}>
            <LineChart data={previewData} margin={marginWithLabels}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis dataKey="name" stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <YAxis stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              {previewDataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                  >
                    <LabelList 
                      dataKey={key} 
                      position="top" 
                      style={{ 
                        fill: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
                        fontSize: '12px',
                        fontWeight: 500
                      }} 
                    />
                  </Line>
                );
              })}
            </LineChart>
          </ChartContainer>
        );

      case 'area':
        return (
          <ChartContainer config={chartConfig}>
            <AreaChart data={previewData} margin={marginWithLabels}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis dataKey="name" stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <YAxis stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              {previewDataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.6}
                  >
                    <LabelList 
                      dataKey={key} 
                      position="top" 
                      style={{ 
                        fill: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
                        fontSize: '12px',
                        fontWeight: 500
                      }} 
                    />
                  </Area>
                );
              })}
            </AreaChart>
          </ChartContainer>
        );

      case 'pie':
        const pieDataKey = previewDataKeys[0] || 'value';
        return (
          <ChartContainer config={chartConfig}>
            <PieChart>
              <Pie
                data={previewData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => {
                  // Show name and value for better clarity, especially for duplicate names
                  const displayName = previewData.filter(p => p.name === name).length > 1 
                    ? `${name} (${value})` 
                    : name;
                  return `${displayName}: ${(percent * 100).toFixed(1)}%`;
                }}
                outerRadius={100}
                fill="#8884d8"
                dataKey={pieDataKey}
              >
                {previewData.map((entry, index) => {
                  // For pie charts, use unique color per data point (by index if same name)
                  // Priority: data point color (by name) > index-based color > series color > brand color
                  const uniqueKey = `${entry.name}_${index}`;
                  const color = dataPointColors[entry.name] 
                    || dataPointColors[uniqueKey]
                    || brandColors[index % brandColors.length]
                    || seriesColors[pieDataKey] 
                    || chartConfig[pieDataKey]?.color;
                  return (
                    <Cell key={`cell-${index}`} fill={color} />
                  );
                })}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number, name: string, props: any) => {
                  // Show both value and percentage in tooltip
                  const total = previewData.reduce((sum, p) => sum + ((p[pieDataKey] as number) || 0), 0);
                  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return [`${value} (${percent}%)`, pieDataKey];
                }}
              />
            </PieChart>
          </ChartContainer>
        );

      case 'donut':
        const donutDataKey = previewDataKeys[0] || 'value';
        return (
          <ChartContainer config={chartConfig}>
            <PieChart>
              <Pie
                data={previewData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => {
                  // Show name and value for better clarity, especially for duplicate names
                  const displayName = previewData.filter(p => p.name === name).length > 1 
                    ? `${name} (${value})` 
                    : name;
                  return `${displayName}: ${(percent * 100).toFixed(1)}%`;
                }}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey={donutDataKey}
              >
                {previewData.map((entry, index) => {
                  // For donut charts, use unique color per data point (by index if same name)
                  // Priority: data point color (by name) > index-based color > series color > brand color
                  const uniqueKey = `${entry.name}_${index}`;
                  const color = dataPointColors[entry.name] 
                    || dataPointColors[uniqueKey]
                    || brandColors[index % brandColors.length]
                    || seriesColors[donutDataKey] 
                    || chartConfig[donutDataKey]?.color;
                  return (
                    <Cell key={`cell-${index}`} fill={color} />
                  );
                })}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number, name: string, props: any) => {
                  // Show both value and percentage in tooltip
                  const total = previewData.reduce((sum, p) => sum + ((p[donutDataKey] as number) || 0), 0);
                  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return [`${value} (${percent}%)`, donutDataKey];
                }}
              />
            </PieChart>
          </ChartContainer>
        );

      case 'gauge':
        // Gauge chart: semi-circular with needle pointing to value
        const gaugeDataKey = previewDataKeys[0] || 'value';
        const gaugeValue = previewData.length > 0 ? (previewData[0][gaugeDataKey] as number || 0) : 0;
        const maxValue = 10; // Default max, could be configurable
        const percentage = Math.min(Math.max((gaugeValue / maxValue) * 100, 0), 100);
        // Needle angle: starts at -90 (pointing left), rotates clockwise to 90 (pointing right)
        // 0% = -90 degrees, 100% = 90 degrees
        const needleAngle = -90 + (percentage / 100) * 180;
        
        // Create segments for the gauge (red, orange, green zones)
        // Arc goes from 180 degrees (left) to 0 degrees (right)
        const gaugeSegments = [
          { start: 0, end: 60, color: isDark ? '#ef4444' : '#dc2626' }, // Red: 0-60%
          { start: 60, end: 80, color: isDark ? '#f97316' : '#ea580c' }, // Orange: 60-80%
          { start: 80, end: 100, color: isDark ? '#22c55e' : '#16a34a' }, // Green: 80-100%
        ];

        // Helper function to convert percentage to angle (180 = left, 0 = right)
        const percentageToAngle = (pct: number) => 180 - (pct / 100) * 180;
        
        // Helper function to get point on arc
        const getArcPoint = (angleDeg: number, radius: number) => {
          const angleRad = (angleDeg * Math.PI) / 180;
          return {
            x: 100 + radius * Math.cos(angleRad),
            y: 100 - radius * Math.sin(angleRad),
          };
        };

        return (
          <ChartContainer config={chartConfig}>
            <div className="relative w-full h-full flex items-center justify-center min-h-[200px]">
              <svg width="100%" height="100%" viewBox="0 0 200 120" className="overflow-visible" preserveAspectRatio="xMidYMid meet">
                {/* Gauge background arc (from left to right) */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                  strokeWidth="20"
                  strokeLinecap="round"
                />
                
                {/* Colored segments */}
                {gaugeSegments.map((segment, index) => {
                  const startAngle = percentageToAngle(segment.end); // Reverse: end is closer to left
                  const endAngle = percentageToAngle(segment.start); // Reverse: start is closer to right
                  const startPoint = getArcPoint(startAngle, 80);
                  const endPoint = getArcPoint(endAngle, 80);
                  const sweepFlag = 0; // Clockwise
                  
                  return (
                    <path
                      key={index}
                      d={`M ${startPoint.x} ${startPoint.y} A 80 80 0 0 ${sweepFlag} ${endPoint.x} ${endPoint.y}`}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                  );
                })}
                
                {/* Needle */}
                <g transform="translate(100, 100)">
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="-70"
                    stroke={isDark ? '#ffffff' : '#000000'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    transform={`rotate(${needleAngle})`}
                  />
                  <circle cx="0" cy="0" r="6" fill={isDark ? '#ffffff' : '#000000'} />
                </g>
              </svg>
              
              {/* Value display */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
                <div className="text-2xl font-bold text-foreground">{gaugeValue} / {maxValue}</div>
              </div>
            </div>
          </ChartContainer>
        );

      case 'scatter':
        return (
          <ChartContainer config={chartConfig}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis dataKey="name" stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <YAxis stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              {previewDataKeys.map((key, index) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[index];
                return (
                  <Scatter
                    key={key}
                    dataKey={key}
                    fill={color}
                  />
                );
              })}
            </ScatterChart>
          </ChartContainer>
        );

      case 'radar':
        return (
          <ChartContainer config={chartConfig}>
            <RadarChart data={previewData}>
              <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
              <PolarAngleAxis dataKey="name" tick={{ fill: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }} />
              <PolarRadiusAxis tick={{ fill: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              {previewDataKeys.map((key, index) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[index];
                return (
                  <Radar
                    key={key}
                    name={key}
                    dataKey={key}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.6}
                  />
                );
              })}
            </RadarChart>
          </ChartContainer>
        );

      default:
        return null;
    }
  };

  const selectedChartType = chartTypeOptions.find(opt => opt.value === chartType);

  if (loadingChart) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              if (farmerId) {
                navigate(`/farmers/${farmerId}`);
              } else {
                navigate(-1);
              }
            }}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {farmerId ? 'Back to Farmer Profile' : 'Back'}
          </Button>
          <h1 className="text-3xl font-bold text-heading-primary">
            {id ? 'Edit Chart Template' : 'Create Chart Template'}
          </h1>
        </div>

        {/* Split View */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Side - Form */}
          <div className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle>Chart Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Chart Name */}
                  <div className="space-y-2">
                    <Label htmlFor="chart-name">Chart Name *</Label>
                    <Input
                      id="chart-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Crop Yield Over Time"
                      required
                    />
                  </div>

                  {/* Chart Type with Icons */}
                  <div className="space-y-2">
                    <Label htmlFor="chart-type">Chart Type *</Label>
                    <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                      <SelectTrigger id="chart-type">
                        <div className="flex items-center gap-2">
                          {selectedChartType && (
                            <>
                              <selectedChartType.icon className="h-4 w-4" />
                              <span>{selectedChartType.label}</span>
                            </>
                          )}
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {chartTypeOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Phase Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="phase-number">Associated Phase (Optional)</Label>
                    <Select 
                      value={phaseNumber?.toString() || "none"} 
                      onValueChange={(value) => setPhaseNumber(value === "none" ? null : parseInt(value))}
                    >
                      <SelectTrigger id="phase-number">
                        <SelectValue placeholder="Select a phase or leave unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">No specific phase</span>
                        </SelectItem>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((phase) => (
                          <SelectItem key={phase} value={phase.toString()}>
                            Phase {phase}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Associate this chart with a specific monitoring phase (1-12), or leave unassigned to show it for all phases.
                    </p>
                  </div>

                  {/* Annotation */}
                  <div className="space-y-2">
                    <Label htmlFor="annotation">Annotation (Optional)</Label>
                    <Textarea
                      id="annotation"
                      value={annotation}
                      onChange={(e) => setAnnotation(e.target.value)}
                      placeholder="This annotation will appear on every chart instance..."
                      rows={3}
                    />
                  </div>

                  {/* Data Series Configuration */}
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle className="text-lg">Data Series</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Define what you're measuring (e.g., Loan Amount, Crop Yield, Revenue). Each series appears as a different color on the chart.
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Series List</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addDataKey}
                          disabled={dataKeys.filter(k => k !== 'name').length >= 5}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Series
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        {dataKeys.map((key, index) => (
                          <div key={`series-${index}`} className="flex items-center gap-2 p-3 border rounded-lg bg-card">
                            {key === 'name' ? (
                              <>
                                <Badge variant="secondary" className="flex-1 justify-center py-2">
                                  <span className="text-sm font-medium">Name (X-axis)</span>
                                </Badge>
                                <p className="text-xs text-muted-foreground ml-2">
                                  Used for labels
                                </p>
                              </>
                            ) : (
                              <>
                                {editingKeyIndex === index ? (
                                  <Input
                                    value={editingKeyValue}
                                    onChange={(e) => setEditingKeyValue(e.target.value)}
                                    onBlur={() => finishEditingKey(index, key)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        finishEditingKey(index, key);
                                      } else if (e.key === 'Escape') {
                                        cancelEditingKey(key);
                                      }
                                    }}
                                    className="flex-1"
                                    placeholder="e.g., Loan Amount, Crop Yield, Revenue, Temperature"
                                    autoFocus
                                  />
                                ) : (
                                  <div
                                    className="flex-1 px-3 py-2 border rounded-md bg-background cursor-text hover:bg-muted/50 transition-colors"
                                    onClick={() => startEditingKey(index, key)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-3 h-3 rounded-full border-2 border-border flex-shrink-0" 
                                        style={{ backgroundColor: seriesColors[key] || getChartColorArray(isDark)[dataKeys.filter(k => k !== 'name').indexOf(key) % getChartColorArray(isDark).length] }}
                                        title="Series color"
                                      />
                                      <span className="text-sm font-medium">{key}</span>
                                    </div>
                                  </div>
                                )}
                                {editingKeyIndex !== index && (
                                  <SeriesColorPicker
                                    color={seriesColors[key] || getChartColorArray(isDark)[dataKeys.filter(k => k !== 'name').indexOf(key) % getChartColorArray(isDark).length]}
                                    onChange={(newColor) => updateSeriesColor(key, newColor)}
                                    availableColors={getChartColorArray(isDark)}
                                  />
                                )}
                                {dataKeys.filter(k => k !== 'name').length > 1 && editingKeyIndex !== index && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeDataKey(key)}
                                    title="Remove series"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {dataKeys.filter(k => k !== 'name').length === 0 && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Add at least one data series to create your chart. Examples: Loan Amount, Crop Yield, Revenue, Soil pH, Temperature.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Data Points */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">Chart Data</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            Add your data values. Each row represents one data point (e.g., one farmer, one crop type, one time period).
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addDataPoint}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Row
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Help text for different chart types */}
                      {(chartType === 'pie' || chartType === 'donut') && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            For {chartType === 'pie' ? 'pie' : 'donut'} charts, each row becomes a separate segment. 
                            Use unique names (e.g., "Wheat", "Corn", "Soybeans") for distinct segments, or customize colors for each segment.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="space-y-3">
                        {dataPoints.map((point, index) => {
                          const isPieOrDonut = chartType === 'pie' || chartType === 'donut';
                          const dataPointColor = dataPointColors[point.name] || getChartColorArray(isDark)[index % getChartColorArray(isDark).length];
                          
                          return (
                            <div key={index} className="border rounded-lg p-4 bg-card space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Badge variant="outline" className="text-xs">
                                    Row {index + 1}
                                  </Badge>
                                  {isPieOrDonut && point.name && (
                                    <SeriesColorPicker
                                      color={dataPointColor}
                                      onChange={(newColor) => updateDataPointColor(point.name, newColor)}
                                      availableColors={getChartColorArray(isDark)}
                                    />
                                  )}
                                </div>
                                {dataPoints.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // Remove color when data point is deleted
                                      if (point.name) {
                                        const { [point.name]: _, ...rest } = dataPointColors;
                                        setDataPointColors(rest);
                                      }
                                      removeDataPoint(index);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                              
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label htmlFor={`point-${index}-name`} className="text-sm font-medium">
                                    Data Point Name <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    id={`point-${index}-name`}
                                    placeholder={chartType === 'pie' || chartType === 'donut' 
                                      ? "e.g., Wheat, Corn, Soybeans" 
                                      : chartType === 'gauge'
                                      ? "e.g., Crop Health Score, Soil Quality Index"
                                      : "e.g., Q1 2024, January, Phase 1"}
                                    value={point.name}
                                    onChange={(e) => {
                                      const oldName = point.name;
                                      const newName = e.target.value.trim();
                                      updateDataPoint(index, 'name', e.target.value);
                                      
                                      // Update color mapping if name changed
                                      // Use unique key for pie/donut to handle duplicate names
                                      const oldUniqueKey = `${oldName}_${index}`;
                                      const newUniqueKey = `${newName}_${index}`;
                                      
                                      if (oldName && oldName !== newName) {
                                        const { [oldName]: oldColor, [oldUniqueKey]: oldUniqueColor, ...rest } = dataPointColors;
                                        if (newName) {
                                          // If new name doesn't have a color, assign default
                                          const defaultColor = oldColor || oldUniqueColor || getChartColorArray(isDark)[index % getChartColorArray(isDark).length];
                                          if (chartType === 'pie' || chartType === 'donut') {
                                            // Store both by name and by unique key for pie/donut
                                            setDataPointColors({ ...rest, [newName]: defaultColor, [newUniqueKey]: defaultColor });
                                          } else {
                                            setDataPointColors({ ...rest, [newName]: defaultColor });
                                          }
                                        } else {
                                          setDataPointColors(rest);
                                        }
                                      } else if (newName && !dataPointColors[newName] && (chartType === 'pie' || chartType === 'donut')) {
                                        // Assign default color for new data point names in pie/donut charts
                                        const defaultColor = getChartColorArray(isDark)[index % getChartColorArray(isDark).length];
                                        setDataPointColors({ ...dataPointColors, [newName]: defaultColor, [newUniqueKey]: defaultColor });
                                      }
                                    }}
                                    required
                                    className="font-medium"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    {chartType === 'pie' || chartType === 'donut' 
                                      ? "Each row becomes a segment. Use unique names for distinct segments, or same names to group related data."
                                      : chartType === 'gauge'
                                      ? "Label for the gauge value being measured."
                                      : "This name appears on the chart (X-axis labels, legend, etc.)"}
                                  </p>
                                </div>
                                
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Values for Each Series</Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {dataKeys.filter(k => k !== 'name').map((key) => {
                                      const seriesColor = seriesColors[key] || getChartColorArray(isDark)[dataKeys.filter(k => k !== 'name').indexOf(key) % getChartColorArray(isDark).length];
                                      return (
                                        <div key={key} className="space-y-1.5">
                                          <div className="flex items-center gap-2">
                                            <div 
                                              className="w-3 h-3 rounded-full border-2 border-border" 
                                              style={{ backgroundColor: seriesColor }}
                                              title={`Color for ${key} series`}
                                            />
                                            <Label htmlFor={`point-${index}-${key}`} className="text-sm font-medium">
                                              {key} <span className="text-destructive">*</span>
                                            </Label>
                                          </div>
                                          <Input
                                            id={`point-${index}-${key}`}
                                            type="number"
                                            step="0.01"
                                            placeholder={chartType === 'pie' || chartType === 'donut' 
                                              ? "e.g., 1500" 
                                              : chartType === 'gauge'
                                              ? "0-100"
                                              : "0"}
                                            value={point[key] || ''}
                                            onChange={(e) => updateDataPoint(index, key, parseFloat(e.target.value) || 0)}
                                            required
                                            className="w-full"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {dataKeys.filter(k => k !== 'name').length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Add at least one data series above to enter values.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {dataPoints.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">No data points yet. Click "Add Row" to get started.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        if (farmerId) {
                          navigate(`/farmers/${farmerId}`);
                        } else {
                          navigate(-1);
                        }
                      }} 
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Saving...' : id ? 'Update Chart' : 'Create Chart'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Live Preview */}
          <div className="w-full lg:w-1/2">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Preview
                </CardTitle>
                {name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {name}
                  </p>
                )}
                {annotation && (
                  <Alert className="mt-2">
                    <AlertDescription className="text-xs">{annotation}</AlertDescription>
                  </Alert>
                )}
              </CardHeader>
              <CardContent>
                <div className="h-[600px]">
                  {renderPreview()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};


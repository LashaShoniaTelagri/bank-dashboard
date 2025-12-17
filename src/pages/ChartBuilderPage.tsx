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
import { RichTextEditor } from "@/components/RichTextEditor";
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
  const [bottomDescription, setBottomDescription] = useState('');
  const [farmerId, setFarmerId] = useState<string | null>(farmerIdFromUrl);
  const [phaseNumber, setPhaseNumber] = useState<number | null>(null);
  const [minScore, setMinScore] = useState<number>(0); // CROSS-45: Default min score
  const [maxScore, setMaxScore] = useState<number>(10); // CROSS-45: Default max score
  const [xAxisLabelAngle, setXAxisLabelAngle] = useState<number>(0); // X-axis label rotation angle - default horizontal
  const [valueType, setValueType] = useState<'numeric' | 'percentage'>('numeric'); // Chart value type: numeric (0-10) or percentage (0-100%)
  const [dataPoints, setDataPoints] = useState<ChartDataPoint[]>([
    { name: '', value: null } // CROSS-51: Allow null values
  ]);
  const [dataKeys, setDataKeys] = useState<string[]>(['value']);
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>({});
  const [dataPointColors, setDataPointColors] = useState<Record<string, string>>({});
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null);
  const [editingKeyValue, setEditingKeyValue] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // Track field-level errors: "pointIndex-key" => error message
  
  // Adjust min/max when value type changes
  useEffect(() => {
    if (valueType === 'percentage') {
      // Switch to percentage mode
      if (maxScore === 10) setMaxScore(100);
      if (minScore === 0) setMinScore(0);
    } else {
      // Switch to numeric mode
      if (maxScore === 100) setMaxScore(10);
      if (minScore === 0) setMinScore(0);
    }
  }, [valueType]);

  // Clear field errors when min/max scores change
  useEffect(() => {
    // Re-validate all data points when min/max changes
    const newFieldErrors: Record<string, string> = {};
    dataPoints.forEach((point, index) => {
      dataKeys.forEach(key => {
        if (key !== 'name') {
          const value = point[key];
          if (value !== null && value !== undefined && value !== '') {
            const numValue = typeof value === 'number' ? value : parseFloat(value as string);
            if (!isNaN(numValue)) {
              if (numValue > maxScore) {
                newFieldErrors[`${index}-${key}`] = `Value cannot exceed maximum score of ${maxScore}${valueType === 'percentage' ? '%' : ''}`;
              } else if (numValue < minScore) {
                newFieldErrors[`${index}-${key}`] = `Value cannot be less than minimum score of ${minScore}${valueType === 'percentage' ? '%' : ''}`;
              }
            }
          }
        }
      });
    });
    setFieldErrors(newFieldErrors);
  }, [minScore, maxScore, dataPoints, dataKeys, valueType]);

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
      setBottomDescription(existingChart.bottom_description || '');
      setFarmerId((existingChart as any).farmer_id || null);
      setPhaseNumber((existingChart as any).phase_number || null);
      // Load value type, default to numeric
      const loadedValueType = existingChart.chart_data.valueType ?? 'numeric';
      setValueType(loadedValueType);
      
      // CROSS-45: Load min/max scores from chart data, with defaults based on value type
      const defaultMax = loadedValueType === 'percentage' ? 100 : 10;
      setMinScore(existingChart.chart_data.minScore ?? 0);
      setMaxScore(existingChart.chart_data.maxScore ?? defaultMax);
      // Load X-axis label angle, default to 0 degrees (horizontal)
      setXAxisLabelAngle(existingChart.chart_data.xAxisLabelAngle ?? 0);
      setDataPoints(existingChart.chart_data.data || [{ name: '', value: null }]);
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
    const newPoint: ChartDataPoint = { name: '', value: null }; // CROSS-51: Default to null
    dataKeys.forEach(key => {
      if (key !== 'name') {
        newPoint[key] = null; // CROSS-51: Default to null instead of 0
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

  const updateDataPoint = (index: number, field: string, value: string | number | null) => {
    const updated = [...dataPoints];
    const errorKey = `${index}-${field}`;
    
    // CROSS-51: Handle empty string as null for numeric fields
    if (field !== 'name' && (value === '' || value === null)) {
      updated[index] = { ...updated[index], [field]: null };
      // Clear error when field is cleared
      setFieldErrors(prev => {
        const { [errorKey]: _, ...rest } = prev;
        return rest;
      });
    } else {
      updated[index] = { ...updated[index], [field]: value };
      
      // Validate against maxScore/minScore for numeric fields (only when value is a number)
      if (field !== 'name' && value !== null && value !== undefined && value !== '') {
        // Allow string values during editing, only validate when it's a number
        if (typeof value === 'number') {
          if (value > maxScore) {
            setFieldErrors(prev => ({
              ...prev,
              [errorKey]: `Value cannot exceed maximum score of ${maxScore}`
            }));
          } else if (value < minScore) {
            setFieldErrors(prev => ({
              ...prev,
              [errorKey]: `Value cannot be less than minimum score of ${minScore}`
            }));
          } else {
            // Clear error if value is valid
            setFieldErrors(prev => {
              const { [errorKey]: _, ...rest } = prev;
              return rest;
            });
          }
        } else {
          // String value during editing - clear errors, will validate on blur
          setFieldErrors(prev => {
            const { [errorKey]: _, ...rest } = prev;
            return rest;
          });
        }
      }
    }
    setDataPoints(updated);
  };

  const addDataKey = () => {
    const newKey = `series${dataKeys.filter(k => k !== 'name').length + 1}`;
    setDataKeys([...dataKeys, newKey]);
    setDataPoints(dataPoints.map(point => ({ ...point, [newKey]: null }))); // CROSS-51: Default to null instead of 0
    
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

    // CROSS-45: Validate min/max scores
    if (typeof minScore !== 'number' || isNaN(minScore)) {
      newErrors.push('Minimum score must be a valid number');
    }
    if (typeof maxScore !== 'number' || isNaN(maxScore)) {
      newErrors.push('Maximum score must be a valid number');
    }
    if (minScore >= maxScore) {
      newErrors.push('Minimum score must be less than maximum score');
    }

    dataPoints.forEach((point, index) => {
      if (!point.name || point.name.trim() === '') {
        newErrors.push(`Data point ${index + 1} must have a name`);
      }
      
      // CROSS-51: Allow null/empty values - only validate if value is provided
      dataKeys.forEach(key => {
        if (key !== 'name') {
          const value = point[key];
          // Allow null/undefined (empty scores)
          if (value !== null && value !== undefined && value !== '') {
            // If a value is provided, it must be a valid number
            if (typeof value !== 'number' || isNaN(value)) {
              newErrors.push(`Data point ${index + 1}, ${key} must be a valid number or left empty`);
            } else {
              // Validate against maxScore
              if (value > maxScore) {
                newErrors.push(`Data point ${index + 1}, ${key} cannot exceed maximum score of ${maxScore}`);
              }
              // Validate against minScore
              if (value < minScore) {
                newErrors.push(`Data point ${index + 1}, ${key} cannot be less than minimum score of ${minScore}`);
              }
            }
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
    
    // Check for field-level errors first
    if (Object.keys(fieldErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix all errors before saving the chart.",
        variant: "destructive",
      });
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    // Convert string values to numbers before saving
    const cleanedDataPoints = dataPoints.map(point => {
      const cleanedPoint: ChartDataPoint = { name: point.name };
      dataKeys.forEach(key => {
        if (key !== 'name') {
          const value = point[key];
          if (value === null || value === undefined || value === '') {
            cleanedPoint[key] = null;
          } else if (typeof value === 'string') {
            // Convert string to number for saving
            const numValue = parseFloat(value);
            cleanedPoint[key] = isNaN(numValue) ? null : numValue;
          } else {
            cleanedPoint[key] = value;
          }
        }
      });
      return cleanedPoint;
    });

    const chartData: any = {
      name: name.trim(),
      chart_type: chartType,
      chart_data: {
        data: cleanedDataPoints, // Use cleaned data points with numbers
        xAxisKey: 'name',
        yAxisKey: dataKeys.find(k => k !== 'name') || 'value',
        dataKeys: dataKeys.filter(k => k !== 'name'),
        seriesColors: seriesColors, // Save custom series colors
        dataPointColors: dataPointColors, // Save custom data point colors
        minScore: minScore, // CROSS-45: Save min/max scores
        maxScore: maxScore,
        xAxisLabelAngle: xAxisLabelAngle, // X-axis label rotation angle
        valueType: valueType, // Chart value type: numeric or percentage
      },
      annotation: annotation.trim() || undefined,
      bottom_description: bottomDescription.trim() || undefined,
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
            // CROSS-51: Preserve null values, handle string values during editing, convert to number for preview
            if (value === null || value === undefined || value === '') {
              cleanPoint[key] = null;
            } else if (typeof value === 'string') {
              // String value during editing - try to parse it
              const numValue = parseFloat(value);
              cleanPoint[key] = isNaN(numValue) ? null : numValue;
            } else if (typeof value === 'number' && !isNaN(value)) {
              cleanPoint[key] = value;
            } else {
              cleanPoint[key] = null; // Fallback for invalid values
            }
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

    // Generate evenly spaced ticks (0-2-4-6-8-10 for max=10)
    const generateTicks = (min: number, max: number) => {
      const range = max - min;
      const tickInterval = range <= 10 ? 2 : Math.ceil(range / 5);
      const ticks: number[] = [];
      for (let i = min; i <= max; i += tickInterval) {
        ticks.push(i);
      }
      if (ticks[ticks.length - 1] !== max) {
        ticks.push(max);
      }
      return ticks;
    };
    
    const yAxisTicks = generateTicks(minScore, maxScore);
    
    // Percentage symbol suffix
    const valueSuffix = valueType === 'percentage' ? '%' : '';

    // Base margins for preview - legend now at top
    const baseMargin = { top: 40, right: 30, left: 20, bottom: 80 };
    
    // Extra top margin for charts with labels to prevent cutoff
    const marginWithLabels = { top: 50, right: 30, left: 20, bottom: 80 };
    
    // Extra right margin for horizontal bar charts
    const marginWithRightLabels = { top: 40, right: 50, left: 20, bottom: 80 };

    const commonProps = {
      data: previewData,
      margin: baseMargin,
    };

    const previewDataKeys = dataKeys.filter(k => k !== 'name');
    const brandColors = getChartColorArray(isDark); // Use hex colors for better compatibility

    switch (chartType) {
      case 'bar': {
        // CROSS-51: Filter out null values for preview
        const filteredPreviewData = previewData.filter(point => {
          return dataKeys.filter(k => k !== 'name').some(key => {
            const value = point[key];
            return value !== null && value !== undefined && value !== '';
          });
        });
        
        return (
          <ChartContainer config={chartConfig}>
            <BarChart data={filteredPreviewData} margin={marginWithLabels}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                dataKey="name" 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                angle={xAxisLabelAngle}
                textAnchor={xAxisLabelAngle === 0 ? "middle" : "end"}
                height={60}
                interval={0}
              />
              <YAxis 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} 
                domain={[minScore, maxScore]} // CROSS-45: Use configured min/max scores
                ticks={yAxisTicks}
                tickFormatter={(value) => `${value}${valueSuffix}`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />
              {previewDataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Bar key={key} dataKey={key} fill={color}>
                    <LabelList 
                      dataKey={key} 
                      position="top"
                      formatter={(value: number) => `${value}${valueSuffix}`}
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
      }

      case 'bar-horizontal': {
        // CROSS-51: Filter out null values for preview
        const filteredPreviewData = previewData.filter(point => {
          return dataKeys.filter(k => k !== 'name').some(key => {
            const value = point[key];
            return value !== null && value !== undefined && value !== '';
          });
        });
        
        return (
          <ChartContainer config={chartConfig}>
            <BarChart data={filteredPreviewData} margin={marginWithRightLabels} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                type="number" 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} 
                domain={[minScore, maxScore]} // CROSS-45: Use configured min/max scores for horizontal bar charts
                ticks={yAxisTicks}
                tickFormatter={(value) => `${value}${valueSuffix}`}
              />
              <YAxis dataKey="name" type="category" stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />
              {previewDataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Bar key={key} dataKey={key} fill={color}>
                    <LabelList 
                      dataKey={key} 
                      position="right"
                      formatter={(value: number) => `${value}${valueSuffix}`}
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
      }

      case 'line': {
        // CROSS-51: Filter out null values for preview
        const filteredPreviewData = previewData.filter(point => {
          return dataKeys.filter(k => k !== 'name').some(key => {
            const value = point[key];
            return value !== null && value !== undefined && value !== '';
          });
        });
        
        return (
          <ChartContainer config={chartConfig}>
            <LineChart data={filteredPreviewData} margin={marginWithLabels}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                dataKey="name" 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                angle={xAxisLabelAngle}
                textAnchor={xAxisLabelAngle === 0 ? "middle" : "end"}
                height={60}
                interval={0}
              />
              <YAxis 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} 
                domain={[minScore, maxScore]} // CROSS-45: Use configured min/max scores
                ticks={yAxisTicks}
                tickFormatter={(value) => `${value}${valueSuffix}`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />
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
                      formatter={(value: number) => `${value}${valueSuffix}`}
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
      }

      case 'area': {
        // CROSS-51: Filter out null values for preview
        const filteredPreviewData = previewData.filter(point => {
          return dataKeys.filter(k => k !== 'name').some(key => {
            const value = point[key];
            return value !== null && value !== undefined && value !== '';
          });
        });
        
        return (
          <ChartContainer config={chartConfig}>
            <AreaChart data={filteredPreviewData} margin={marginWithLabels}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                dataKey="name" 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                angle={xAxisLabelAngle}
                textAnchor={xAxisLabelAngle === 0 ? "middle" : "end"}
                height={60}
                interval={0}
              />
              <YAxis 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} 
                domain={[minScore, maxScore]} // CROSS-45: Use configured min/max scores
                ticks={yAxisTicks}
                tickFormatter={(value) => `${value}${valueSuffix}`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />
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
                      formatter={(value: number) => `${value}${valueSuffix}`}
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
      }

      case 'pie': {
        const pieDataKey = previewDataKeys[0] || 'value';
        // CROSS-51: Filter out null values for pie charts
        const filteredPreviewData = previewData.filter(point => {
          const value = point[pieDataKey];
          return value !== null && value !== undefined && value !== '';
        });
        
        return (
          <ChartContainer config={chartConfig}>
            <PieChart>
              <Pie
                data={filteredPreviewData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => {
                  // Show name and value for better clarity, especially for duplicate names
                  const displayName = filteredPreviewData.filter(p => p.name === name).length > 1 
                    ? `${name} (${value})` 
                    : name;
                  return `${displayName}: ${(percent * 100).toFixed(1)}%`;
                }}
                outerRadius={100}
                fill="#8884d8"
                dataKey={pieDataKey}
              >
                {filteredPreviewData.map((entry, index) => {
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
                  const total = filteredPreviewData.reduce((sum, p) => {
                    const val = p[pieDataKey];
                    return sum + ((val !== null && val !== undefined && val !== '') ? (val as number) : 0);
                  }, 0);
                  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return [`${value} (${percent}%)`, pieDataKey];
                }}
              />
            </PieChart>
          </ChartContainer>
        );
      }

      case 'donut': {
        const donutDataKey = previewDataKeys[0] || 'value';
        // CROSS-51: Filter out null values for donut charts
        const filteredPreviewData = previewData.filter(point => {
          const value = point[donutDataKey];
          return value !== null && value !== undefined && value !== '';
        });
        
        return (
          <ChartContainer config={chartConfig}>
            <PieChart>
              <Pie
                data={filteredPreviewData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => {
                  // Show name and value for better clarity, especially for duplicate names
                  const displayName = filteredPreviewData.filter(p => p.name === name).length > 1
                    ? `${name} (${value})` 
                    : name;
                  return `${displayName}: ${(percent * 100).toFixed(1)}%`;
                }}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey={donutDataKey}
              >
                {filteredPreviewData.map((entry, index) => {
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
                  const total = filteredPreviewData.reduce((sum, p) => {
                    const val = p[donutDataKey];
                    return sum + ((val !== null && val !== undefined && val !== '') ? (val as number) : 0);
                  }, 0);
                  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return [`${value} (${percent}%)`, donutDataKey];
                }}
              />
            </PieChart>
          </ChartContainer>
        );
      }

      case 'gauge': {
        // Gauge chart: semi-circular with needle pointing to value
        const gaugeDataKey = previewDataKeys[0] || 'value';
        // CROSS-51: Handle null values for gauge
        const firstDataPoint = previewData.length > 0 ? previewData[0] : null;
        const gaugeValue = firstDataPoint && firstDataPoint[gaugeDataKey] !== null && firstDataPoint[gaugeDataKey] !== undefined
          ? (firstDataPoint[gaugeDataKey] as number || 0)
          : 0;
        const maxValue = maxScore; // CROSS-45: Use configured max score
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
      }

      case 'scatter': {
        return (
          <ChartContainer config={chartConfig}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                dataKey="name" 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                angle={xAxisLabelAngle}
                textAnchor={xAxisLabelAngle === 0 ? "middle" : "end"}
                height={60}
                interval={0}
              />
              <YAxis 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} 
                domain={[minScore, maxScore]} // CROSS-45: Use configured min/max scores
                ticks={yAxisTicks}
                tickFormatter={(value) => `${value}${valueSuffix}`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />
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
      }

      case 'radar': {
        return (
          <ChartContainer config={chartConfig}>
            <RadarChart data={previewData}>
              <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
              <PolarAngleAxis dataKey="name" tick={{ fill: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }} />
              <PolarRadiusAxis tick={{ fill: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />
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
      }

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

                  {/* Bottom Description */}
                  <div className="space-y-2">
                    <Label htmlFor="bottom-description">Bottom Description (Optional)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Add formatted text that will appear at the bottom of the chart, after the data points.
                    </p>
                    <RichTextEditor
                      value={bottomDescription}
                      onChange={setBottomDescription}
                      placeholder="Add detailed description, notes, or additional context for this chart..."
                    />
                  </div>

                  {/* Value Type Selector */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Value Type</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose whether your chart displays numbers (0-10) or percentages (0%-100%).
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label htmlFor="value-type">Display Format</Label>
                        <Select
                          value={valueType}
                          onValueChange={(value: 'numeric' | 'percentage') => setValueType(value)}
                        >
                          <SelectTrigger id="value-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="numeric">Numbers (0-10)</SelectItem>
                            <SelectItem value="percentage">Percentages (0%-100%)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {valueType === 'numeric' 
                            ? 'Chart will display numeric values from 0 to 10' 
                            : 'Chart will display percentage values from 0% to 100%'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CROSS-45: Min/Max Score Configuration */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Score Range Configuration</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Set the minimum and maximum values for the Y-axis scale. {valueType === 'percentage' ? 'Range: 0% to 100%' : 'Range: typically 0 to 10'}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="min-score">
                            Minimum {valueType === 'percentage' ? 'Percentage' : 'Score'}
                          </Label>
                          <div className="relative">
                            <Input
                              id="min-score"
                              type="text"
                              inputMode="decimal"
                              value={minScore}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string, numbers, decimals, and negative sign
                                if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                                  if (value === '') {
                                    setMinScore(0); // Default to 0 if cleared
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue)) {
                                      setMinScore(numValue);
                                    }
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value === '') {
                                  setMinScore(0);
                                } else {
                                  const numValue = parseFloat(value);
                                  setMinScore(isNaN(numValue) ? 0 : numValue);
                                }
                              }}
                              placeholder={valueType === 'percentage' ? '0%' : '0'}
                              className={valueType === 'percentage' ? 'pr-8' : ''}
                            />
                            {valueType === 'percentage' && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Default: 0{valueType === 'percentage' ? '%' : ''}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="max-score">
                            Maximum {valueType === 'percentage' ? 'Percentage' : 'Score'}
                          </Label>
                          <div className="relative">
                            <Input
                              id="max-score"
                              type="text"
                              inputMode="decimal"
                              value={maxScore}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string, numbers, decimals, and negative sign
                                if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                                  if (value === '') {
                                    const defaultMax = valueType === 'percentage' ? 100 : 10;
                                    setMaxScore(defaultMax);
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue)) {
                                      setMaxScore(numValue);
                                    }
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                const defaultMax = valueType === 'percentage' ? 100 : 10;
                                if (value === '') {
                                  setMaxScore(defaultMax);
                                } else {
                                  const numValue = parseFloat(value);
                                  setMaxScore(isNaN(numValue) ? defaultMax : numValue);
                                }
                              }}
                              placeholder={valueType === 'percentage' ? '100%' : '10'}
                              className={valueType === 'percentage' ? 'pr-8' : ''}
                            />
                            {valueType === 'percentage' && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Default: {valueType === 'percentage' ? '100%' : '10'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* X-Axis Label Angle Configuration */}
                  {(chartType === 'bar' || chartType === 'line' || chartType === 'area' || chartType === 'scatter') && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">X-Axis Label Rotation</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Adjust the angle of X-axis labels to prevent overlap with long text.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="xaxis-angle">Label Angle (degrees)</Label>
                          <Select
                            value={xAxisLabelAngle.toString()}
                            onValueChange={(value) => setXAxisLabelAngle(parseInt(value))}
                          >
                            <SelectTrigger id="xaxis-angle">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Horizontal (0°) - Default</SelectItem>
                              <SelectItem value="-30">Slight Angle (-30°)</SelectItem>
                              <SelectItem value="-45">Medium Angle (-45°)</SelectItem>
                              <SelectItem value="-60">Steep Angle (-60°)</SelectItem>
                              <SelectItem value="-90">Vertical (-90°)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Use 0° for short labels. For labels with 10+ characters, try -45° to -60° to prevent overlap.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

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
                                          <div className="space-y-1">
                                            <Input
                                              id={`point-${index}-${key}`}
                                              type="text"
                                              inputMode="decimal"
                                              placeholder={chartType === 'pie' || chartType === 'donut' 
                                                ? `e.g., 1500 (max: ${maxScore})` 
                                                : chartType === 'gauge'
                                                ? `${minScore}-${maxScore} (or leave empty)`
                                                : `${minScore}-${maxScore} (or leave empty)`}
                                              value={point[key] === null || point[key] === undefined ? '' : String(point[key])}
                                              onChange={(e) => {
                                                // Allow user to type freely - store as string during editing
                                                const value = e.target.value;
                                                // Allow empty string, numbers, decimals, and negative sign
                                                if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                                                  // Store as string while editing, will be converted on blur
                                                  updateDataPoint(index, key, value === '' ? null : value);
                                                }
                                              }}
                                              onBlur={(e) => {
                                                // Convert to number when user finishes editing
                                                const value = e.target.value.trim();
                                                if (value === '') {
                                                  updateDataPoint(index, key, null);
                                                } else {
                                                  const numValue = parseFloat(value);
                                                  if (!isNaN(numValue)) {
                                                    updateDataPoint(index, key, numValue);
                                                  } else {
                                                    // Invalid number, clear the field
                                                    updateDataPoint(index, key, null);
                                                  }
                                                }
                                              }}
                                              className={`w-full ${
                                                fieldErrors[`${index}-${key}`] 
                                                  ? 'border-destructive focus-visible:ring-destructive' 
                                                  : ''
                                              }`}
                                            />
                                            {fieldErrors[`${index}-${key}`] ? (
                                              <p className="text-xs text-destructive font-medium">
                                                {fieldErrors[`${index}-${key}`]}
                                              </p>
                                            ) : (
                                              <p className="text-xs text-muted-foreground">
                                                Range: {minScore} - {maxScore}. Leave empty if no score for this phase.
                                              </p>
                                            )}
                                          </div>
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
              <CardContent className="space-y-4">
                <div className="h-[600px]">
                  {renderPreview()}
                </div>
                
                {/* Bottom Description Preview */}
                {bottomDescription && (
                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-semibold text-heading-primary mb-2">
                      Bottom Description Preview:
                    </div>
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground bg-muted/30 p-4 rounded-lg border border-border"
                      dangerouslySetInnerHTML={{ __html: bottomDescription }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};


import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Loader2, AlertCircle, Download, FileText } from "lucide-react";
import { ChartCard } from "@/components/ChartCard";
import { toast } from "@/components/ui/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getChartColorArrayHSL, getChartColorArray } from "@/lib/chartColors";
import { useTheme } from "@/hooks/useTheme";
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
import { ChartType, ChartTemplate } from "@/types/chart";
import { useAuth } from "@/hooks/useAuth";

interface ChartDisplayProps {
  farmerId?: string; // Optional, for future farmer-specific data filtering
}

// Sortable Chart Card Component
interface SortableChartCardProps {
  chart: ChartTemplate;
  renderChart: (chart: ChartTemplate, isFullscreen?: boolean) => React.ReactNode;
  isAdmin: boolean;
}

const SortableChartCard = ({ chart, renderChart, isAdmin }: SortableChartCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chart.id || '' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // Disable transition during drag for smoother experience
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ChartCard 
        chart={chart} 
        renderChart={renderChart}
        dragHandleProps={isAdmin ? { attributes, listeners } : undefined}
        isAdmin={isAdmin}
      >
        <div data-chart-card className="h-full w-full">
          {renderChart(chart, false)}
        </div>
      </ChartCard>
    </div>
  );
};

export const ChartDisplay = ({ farmerId }: ChartDisplayProps) => {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isDark = theme === 'dark';
  const isAdmin = profile?.role === 'admin';
  const [isExporting, setIsExporting] = useState(false);
  const chartsContainerRef = useRef<HTMLDivElement>(null);
  
  // Label tooltip state for truncated axis labels
  const [labelTooltip, setLabelTooltip] = useState<{
    visible: boolean;
    text: string;
    x: number;
    y: number;
  }>({ visible: false, text: '', x: 0, y: 0 });
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const { data: charts = [], isLoading, error } = useQuery({
    queryKey: ['chart-templates', farmerId],
    queryFn: async () => {
      let query = supabase
        .from('chart_templates' as any)
        .select('*')
        .eq('is_active', true);
      
      // Filter by farmer_id if provided
      if (farmerId) {
        query = query.eq('farmer_id', farmerId);
      }
      
      const { data, error } = await query.order('display_order', { ascending: true });
      
      if (error) throw error;
      // Sort by display_order, then by created_at as fallback
      const charts = (data || []) as unknown as ChartTemplate[];
      return charts.sort((a, b) => {
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        // Fallback to created_at if display_order is the same
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      });
    },
  });

  // Mutation to update chart display order with optimistic updates
  const updateOrderMutation = useMutation({
    mutationFn: async (reorderedCharts: ChartTemplate[]) => {
      // Update display_order for all charts
      const updates = reorderedCharts.map((chart, index) => ({
        id: chart.id,
        display_order: index,
      }));

      // Batch update all charts
      const promises = updates.map((update) =>
        supabase
          .from('chart_templates' as any)
          .update({ display_order: update.display_order })
          .eq('id', update.id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error('Failed to update chart order');
      }
    },
    onMutate: async (reorderedCharts: ChartTemplate[]) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['chart-templates', farmerId] });

      // Snapshot the previous value
      const previousCharts = queryClient.getQueryData<ChartTemplate[]>(['chart-templates', farmerId]);

      // Optimistically update to the new value
      queryClient.setQueryData<ChartTemplate[]>(['chart-templates', farmerId], () => {
        return reorderedCharts.map((chart, index) => ({
          ...chart,
          display_order: index,
        }));
      });

      // Return a context object with the snapshotted value
      return { previousCharts };
    },
    onError: (error: any, reorderedCharts, context) => {
      // Rollback to the previous value on error
      if (context?.previousCharts) {
        queryClient.setQueryData(['chart-templates', farmerId], context.previousCharts);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update chart order",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Don't invalidate immediately - optimistic update already applied
      // Just show success message, data will refresh naturally on next query
      toast({
        title: "Chart order updated",
        description: "Charts have been reordered successfully.",
      });
    },
  });

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    if (!isAdmin) {
      return; // Only admins can reorder
    }

    const oldIndex = charts.findIndex((chart) => chart.id === active.id);
    const newIndex = charts.findIndex((chart) => chart.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedCharts = arrayMove(charts, oldIndex, newIndex);
    updateOrderMutation.mutate(reorderedCharts);
  };

  const exportAllChartsAsPDF = async () => {
    if (!chartsContainerRef.current || charts.length === 0) return;
    
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const chartElements = chartsContainerRef.current.querySelectorAll("[data-chart-card]");
      
      if (chartElements.length === 0) {
        throw new Error("No charts found to export");
      }

      for (let i = 0; i < chartElements.length; i++) {
        const element = chartElements[i] as HTMLElement;
        
        if (i > 0) {
          pdf.addPage();
        }

        // Wait for any animations to complete
        await new Promise(resolve => setTimeout(resolve, 300));

        // Force all SVG elements to be fully rendered
        const svgElements = element.querySelectorAll('svg');
        svgElements.forEach((svg) => {
          window.getComputedStyle(svg).getPropertyValue('width');
        });
        
        // Enhanced html2canvas configuration for cross-platform compatibility
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: false, // Better SVG compatibility on Windows
          imageTimeout: 15000,
          removeContainer: true,
          onclone: (clonedDoc) => {
            // Force light theme for consistent rendering
            const clonedElement = clonedDoc.querySelector("[data-chart-card]");
            if (clonedElement) {
              clonedElement.classList.remove('dark');
              clonedDoc.documentElement.classList.remove('dark');
              clonedDoc.body.classList.remove('dark');

              // Fix SVG text colors
              const svgTexts = clonedElement.querySelectorAll('svg text');
              svgTexts.forEach((text: Element) => {
                const svgText = text as SVGTextElement;
                const fill = svgText.getAttribute('fill');
                if (!fill || fill === 'currentColor' || fill.includes('var(')) {
                  svgText.setAttribute('fill', '#000000');
                }
              });

              // Fix SVG shape colors
              const svgShapes = clonedElement.querySelectorAll('svg path, svg rect, svg circle, svg line');
              svgShapes.forEach((shape: Element) => {
                const svgShape = shape as SVGElement;
                const stroke = svgShape.getAttribute('stroke');
                
                if (stroke && (stroke === 'currentColor' || stroke.includes('var('))) {
                  svgShape.setAttribute('stroke', '#666666');
                }
              });
            }
          },
        });

        // Verify canvas has content
        if (canvas.width === 0 || canvas.height === 0) {
          console.warn(`Chart ${i + 1} generated empty canvas, skipping...`);
          continue;
        }
        
        const imgData = canvas.toDataURL("image/png", 1.0);
        
        if (!imgData || imgData === 'data:,') {
          console.warn(`Chart ${i + 1} failed to generate image data, skipping...`);
          continue;
        }

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Set white background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        
        // Calculate dimensions to fit page while maintaining aspect ratio
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const width = imgWidth * ratio;
        const height = imgHeight * ratio;
        
        // Center the image on the page
        const x = (pdfWidth - width) / 2;
        const y = (pdfHeight - height) / 2;
        
        pdf.addImage(imgData, "PNG", x, y, width, height, undefined, 'FAST');
      }
      
      pdf.save(`farmer_analytics_${new Date().toISOString().split("T")[0]}.pdf`);
      
      toast({
        title: "Charts Exported",
        description: `All ${charts.length} charts have been exported to PDF successfully.`,
      });
    } catch (error) {
      console.error("❌ Error exporting charts:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Unable to export charts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load charts. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (charts.length === 0) {
    return null; // Don't show anything if no charts
  }

  const renderChart = (chart: ChartTemplate, isFullscreen: boolean = false) => {
    const { chart_type, chart_data, name, annotation } = chart;
    const { data, dataKeys = ['value'], xAxisKey = 'name', yAxisKey = 'value', seriesColors = {}, dataPointColors = {}, minScore, maxScore, xAxisLabelAngle } = chart_data;
    
    // CROSS-45: Use configured min/max scores or defaults
    const yAxisMin = minScore ?? 0;
    const yAxisMax = maxScore ?? 10;
    
    // Use configured X-axis label angle or default to 0 (horizontal)
    const labelAngle = xAxisLabelAngle ?? 0;
    const labelTextAnchor = labelAngle === 0 ? "middle" : "end";
    
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
    
    const yAxisTicks = generateTicks(yAxisMin, yAxisMax);
    
    // CROSS-51: Filter out null values for charts that don't support them, or handle them gracefully
    // For pie/donut charts, we'll filter out null values
    // For other charts, we'll keep them but they won't render (which is fine)
    const processedData = chart_type === 'pie' || chart_type === 'donut' 
      ? data.filter(point => {
          const value = point[yAxisKey];
          return value !== null && value !== undefined && value !== '';
        })
      : data;

    const brandColors = getChartColorArray(isDark); // Use hex colors for better compatibility
    const chartConfig = dataKeys.reduce((acc, key, index) => {
      // Use custom color if available, otherwise use brand color
      const customColor = seriesColors[key];
      const color = customColor || brandColors[index % brandColors.length];
      
      acc[key] = {
        label: key.charAt(0).toUpperCase() + key.slice(1),
        color: color,
      };
      return acc;
    }, {} as Record<string, { label: string; color: string }>);

    // Responsive sizing based on fullscreen mode and screen size
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const isTablet = typeof window !== 'undefined' && window.innerWidth >= 640 && window.innerWidth < 1024;
    
    const chartHeight = isFullscreen ? 600 : (isMobile ? 350 : isTablet ? 400 : 350);
    const outerRadius = isFullscreen ? 180 : (isMobile ? 80 : 100);
    const innerRadius = isFullscreen ? 110 : (isMobile ? 50 : 60);
    // CROSS-48: Improved font sizing for better readability - responsive to screen size
    const fontSize = isFullscreen ? 16 : (isMobile ? 11 : isTablet ? 12 : 13);
    const labelFontSize = isFullscreen ? 14 : (isMobile ? 10 : isTablet ? 11 : 12);
    const strokeWidth = isFullscreen ? 3 : 2;
    
    // Hide labels on very small screens to prevent overlap
    const showLabels = !isMobile || isFullscreen;

    // Optimized margins for maximum space utilization while ensuring labels are fully visible
    // Chart cards: legend at top, generous bottom margin for angled X-axis labels
    const baseMargin = isFullscreen
      ? { top: 50, right: 40, left: 40, bottom: 60 }
      : { top: 35, right: 5, left: 5, bottom: 80 }; // Top margin for legend, bottom for angled X-axis labels
    
    // Extra top margin for charts with value labels on bars
    const marginWithLabels = isFullscreen
      ? { top: 60, right: 40, left: 40, bottom: 60 }
      : { top: 45, right: 5, left: 5, bottom: 80 }; // More top margin for legend + bar labels
    
    // Extra right margin for horizontal bar charts with labels
    const marginWithRightLabels = isFullscreen
      ? { top: 50, right: 60, left: 40, bottom: 60 }
      : { top: 35, right: 50, left: 5, bottom: 80 }; // Top margin for legend, bottom for X-axis

    const commonProps = {
      data: processedData, // CROSS-51: Use processed data
      margin: baseMargin,
      minHeight: isFullscreen ? 500 : 250, // Ensure minimum height to prevent 0-height errors
    };

    switch (chart_type) {
      case 'bar':
        return (
          <ChartContainer 
            config={chartConfig} 
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <BarChart data={processedData} margin={marginWithLabels} height={chartHeight}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                dataKey={xAxisKey} 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${labelFontSize}px`, fontWeight: 500 }}
                angle={labelAngle}
                textAnchor={labelTextAnchor}
                height={isFullscreen ? undefined : 50}
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const fullText = String(payload.value);
                  const maxLen = isFullscreen ? 100 : 20;
                  const truncated = fullText.length > maxLen ? fullText.substring(0, maxLen) + '...' : fullText;
                  const isTruncated = fullText.length > maxLen;
                  const dy = labelAngle === 0 ? 16 : 8;
                  const dx = labelAngle === 0 ? 0 : -2;
                  return (
                    <g 
                      transform={`translate(${x},${y})`}
                      onMouseEnter={(e) => {
                        if (isTruncated) {
                          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                          setLabelTooltip({ visible: true, text: fullText, x: rect.left + rect.width / 2, y: rect.top - 8 });
                        }
                      }}
                      onMouseLeave={() => setLabelTooltip(prev => ({ ...prev, visible: false }))}
                    >
                      <text x={0} y={0} dy={dy} dx={dx} textAnchor={labelTextAnchor} transform={`rotate(${labelAngle})`} fill={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} fontSize={labelFontSize} fontWeight={500} style={{ cursor: isTruncated ? 'pointer' : 'default' }}>
                        {truncated}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${fontSize}px` }}
                domain={[yAxisMin, yAxisMax]}
                ticks={yAxisTicks}
                width={isMobile ? 40 : isTablet ? 50 : 60}
                tick={{ fontSize: fontSize }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: `${fontSize}px`, paddingBottom: '20px' }} 
                iconSize={isMobile ? 12 : 14}
                wrapperClass={isMobile ? "!text-xs" : ""}
              />
              {dataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Bar key={key} dataKey={key} fill={color}>
                    {showLabels && (
                      <LabelList 
                        dataKey={key} 
                        position="top" 
                        style={{ 
                          fill: isDark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)', // Full opacity for better visibility
                          fontSize: `${Math.max(labelFontSize, 11)}px`, // Ensure minimum readable size
                          fontWeight: 700, // Increased font weight for better readability
                          textShadow: isDark 
                            ? '0 1px 3px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)' 
                            : '0 1px 3px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.7)' // Stronger shadow for visibility
                        }} 
                      />
                    )}
                  </Bar>
                );
              })}
            </BarChart>
          </ChartContainer>
        );

      case 'bar-horizontal':
        return (
          <ChartContainer 
            config={chartConfig}
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <BarChart data={processedData} margin={marginWithRightLabels} layout="vertical" height={chartHeight}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                type="number" 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${fontSize}px` }}
                domain={[yAxisMin, yAxisMax]} // CROSS-45: Use configured min/max scores for horizontal bar charts
                ticks={yAxisTicks}
                width={isFullscreen ? 60 : 50} // Adequate width for X-axis labels
                tick={{ fontSize: fontSize }}
              />
              <YAxis 
                dataKey={xAxisKey} 
                type="category" 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${labelFontSize}px`, fontWeight: 500 }}
                angle={0}
                width={isFullscreen ? undefined : 160}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const fullText = String(payload.value);
                  const maxLen = isFullscreen ? 100 : 25;
                  const truncated = fullText.length > maxLen ? fullText.substring(0, maxLen) + '...' : fullText;
                  const isTruncated = fullText.length > maxLen;
                  return (
                    <g 
                      transform={`translate(${x},${y})`}
                      onMouseEnter={(e) => {
                        if (isTruncated) {
                          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                          setLabelTooltip({ visible: true, text: fullText, x: rect.left + rect.width / 2, y: rect.top - 8 });
                        }
                      }}
                      onMouseLeave={() => setLabelTooltip(prev => ({ ...prev, visible: false }))}
                    >
                      <text x={-8} y={0} dy={4} textAnchor="end" fill={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} fontSize={labelFontSize} fontWeight={500} style={{ cursor: isTruncated ? 'pointer' : 'default' }}>
                        {truncated}
                      </text>
                    </g>
                  );
                }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: `${fontSize}px`, paddingBottom: '20px' }} 
                iconSize={isMobile ? 12 : 14}
                wrapperClass={isMobile ? "!text-xs" : ""}
              />
              {dataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Bar key={key} dataKey={key} fill={color}>
                    {showLabels && (
                      <LabelList 
                        dataKey={key} 
                        position="right" 
                        style={{ 
                          fill: isDark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)', // Full opacity for better visibility
                          fontSize: `${Math.max(labelFontSize, 11)}px`, // Ensure minimum readable size
                          fontWeight: 700, // Increased font weight for better readability
                          textShadow: isDark 
                            ? '0 1px 3px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)' 
                            : '0 1px 3px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.7)' // Stronger shadow for visibility
                        }} 
                      />
                    )}
                  </Bar>
                );
              })}
            </BarChart>
          </ChartContainer>
        );

      case 'line':
        return (
          <ChartContainer 
            config={chartConfig}
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <LineChart data={processedData} margin={marginWithLabels} height={chartHeight}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                dataKey={xAxisKey} 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${labelFontSize}px`, fontWeight: 500 }}
                angle={labelAngle}
                textAnchor={labelTextAnchor}
                height={isFullscreen ? undefined : 50}
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const fullText = String(payload.value);
                  const maxLen = isFullscreen ? 100 : 20;
                  const truncated = fullText.length > maxLen ? fullText.substring(0, maxLen) + '...' : fullText;
                  const isTruncated = fullText.length > maxLen;
                  const dy = labelAngle === 0 ? 16 : 8;
                  const dx = labelAngle === 0 ? 0 : -2;
                  return (
                    <g 
                      transform={`translate(${x},${y})`}
                      onMouseEnter={(e) => {
                        if (isTruncated) {
                          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                          setLabelTooltip({ visible: true, text: fullText, x: rect.left + rect.width / 2, y: rect.top - 8 });
                        }
                      }}
                      onMouseLeave={() => setLabelTooltip(prev => ({ ...prev, visible: false }))}
                    >
                      <text x={0} y={0} dy={dy} dx={dx} textAnchor={labelTextAnchor} transform={`rotate(${labelAngle})`} fill={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} fontSize={labelFontSize} fontWeight={500} style={{ cursor: isTruncated ? 'pointer' : 'default' }}>
                        {truncated}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${fontSize}px` }}
                domain={[yAxisMin, yAxisMax]} // CROSS-45: Use configured min/max scores
                ticks={yAxisTicks}
                width={isMobile ? 40 : isTablet ? 50 : 60} // Responsive width for Y-axis labels
                tick={{ fontSize: fontSize }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: `${fontSize}px`, paddingBottom: '20px' }} 
                iconSize={isMobile ? 12 : 14}
                wrapperClass={isMobile ? "!text-xs" : ""}
              />
              {dataKeys.map((key) => {
                const color = chartConfig[key]?.color || seriesColors[key] || brandColors[0];
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    dot={{ r: isFullscreen ? 5 : 3 }}
                    activeDot={{ r: isFullscreen ? 8 : 5 }}
                  >
                    {showLabels && (
                      <LabelList 
                        dataKey={key} 
                        position="top" 
                        style={{ 
                          fill: isDark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)', // Full opacity for better visibility
                          fontSize: `${Math.max(labelFontSize, 11)}px`, // Ensure minimum readable size
                          fontWeight: 700, // Increased font weight for better readability
                          textShadow: isDark 
                            ? '0 1px 3px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)' 
                            : '0 1px 3px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.7)' // Stronger shadow for visibility
                        }} 
                      />
                    )}
                  </Line>
                );
              })}
            </LineChart>
          </ChartContainer>
        );

      case 'area':
        return (
          <ChartContainer 
            config={chartConfig}
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <AreaChart data={processedData} margin={marginWithLabels} height={chartHeight}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                dataKey={xAxisKey} 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${labelFontSize}px`, fontWeight: 500 }}
                angle={labelAngle}
                textAnchor={labelTextAnchor}
                height={isFullscreen ? undefined : 50}
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const fullText = String(payload.value);
                  const maxLen = isFullscreen ? 100 : 20;
                  const truncated = fullText.length > maxLen ? fullText.substring(0, maxLen) + '...' : fullText;
                  const isTruncated = fullText.length > maxLen;
                  const dy = labelAngle === 0 ? 16 : 8;
                  const dx = labelAngle === 0 ? 0 : -2;
                  return (
                    <g 
                      transform={`translate(${x},${y})`}
                      onMouseEnter={(e) => {
                        if (isTruncated) {
                          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                          setLabelTooltip({ visible: true, text: fullText, x: rect.left + rect.width / 2, y: rect.top - 8 });
                        }
                      }}
                      onMouseLeave={() => setLabelTooltip(prev => ({ ...prev, visible: false }))}
                    >
                      <text x={0} y={0} dy={dy} dx={dx} textAnchor={labelTextAnchor} transform={`rotate(${labelAngle})`} fill={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} fontSize={labelFontSize} fontWeight={500} style={{ cursor: isTruncated ? 'pointer' : 'default' }}>
                        {truncated}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${fontSize}px` }}
                domain={[yAxisMin, yAxisMax]} // CROSS-45: Use configured min/max scores
                ticks={yAxisTicks}
                width={isMobile ? 40 : isTablet ? 50 : 60} // Responsive width for Y-axis labels
                tick={{ fontSize: fontSize }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: `${fontSize}px`, paddingBottom: '20px' }} 
                iconSize={isMobile ? 12 : 14}
                wrapperClass={isMobile ? "!text-xs" : ""}
              />
              {dataKeys.map((key) => {
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
                    {showLabels && (
                      <LabelList 
                        dataKey={key} 
                        position="top" 
                        style={{ 
                          fill: isDark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)', // Full opacity for better visibility
                          fontSize: `${Math.max(labelFontSize, 11)}px`, // Ensure minimum readable size
                          fontWeight: 700, // Increased font weight for better readability
                          textShadow: isDark 
                            ? '0 1px 3px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)' 
                            : '0 1px 3px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.7)' // Stronger shadow for visibility
                        }} 
                      />
                    )}
                  </Area>
                );
              })}
            </AreaChart>
          </ChartContainer>
        );

      case 'pie':
        return (
          <ChartContainer 
            config={chartConfig}
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <PieChart height={chartHeight}>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={showLabels}
                label={showLabels ? ({ name, value, percent }) => {
                  // CROSS-48: Improved label readability with better font size
                  // Show name and value for better clarity, especially for duplicate names
                  const displayName = processedData.filter(p => p.name === name).length > 1
                    ? `${name} (${value})`
                    : name;
                  return `${displayName}: ${(percent * 100).toFixed(1)}%`;
                } : false} // Hide labels on mobile, show tooltip instead
                labelLine={showLabels} // Hide label lines on mobile
                outerRadius={outerRadius}
                fill="#8884d8"
                dataKey={yAxisKey}
                style={{ fontSize: `${labelFontSize}px`, fontWeight: 600 }} // CROSS-48: Better readability
              >
                {data.map((entry, index) => {
                  // For pie charts, use unique color per data point (by index if same name)
                  // Priority: data point color (by name) > index-based color > series color > brand color
                  const uniqueKey = `${entry.name}_${index}`;
                  const color = dataPointColors[entry.name] 
                    || dataPointColors[uniqueKey]
                    || brandColors[index % brandColors.length]
                    || seriesColors[yAxisKey] 
                    || chartConfig[yAxisKey]?.color;
                  return (
                    <Cell key={`cell-${index}`} fill={color} />
                  );
                })}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => {
                  // Show both value and percentage in tooltip
                  const total = processedData.reduce((sum, p) => {
                    const val = p[yAxisKey];
                    return sum + ((val !== null && val !== undefined && val !== '') ? (val as number) : 0);
                  }, 0);
                  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return [`${value} (${percent}%)`, yAxisKey];
                }}
              />
            </PieChart>
          </ChartContainer>
        );

      case 'donut':
        return (
          <ChartContainer 
            config={chartConfig}
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <PieChart height={chartHeight}>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => {
                  // Show name and value for better clarity, especially for duplicate names
                  const displayName = processedData.filter(p => p.name === name).length > 1 
                    ? `${name} (${value})` 
                    : name;
                  return `${displayName}: ${(percent * 100).toFixed(1)}%`;
                }}
                outerRadius={outerRadius}
                innerRadius={innerRadius}
                fill="#8884d8"
                dataKey={yAxisKey}
                style={{ fontSize: `${fontSize}px` }}
              >
                {data.map((entry, index) => {
                  // For donut charts, use unique color per data point (by index if same name)
                  // Priority: data point color (by name) > index-based color > series color > brand color
                  const uniqueKey = `${entry.name}_${index}`;
                  const color = dataPointColors[entry.name] 
                    || dataPointColors[uniqueKey]
                    || brandColors[index % brandColors.length]
                    || seriesColors[yAxisKey] 
                    || chartConfig[yAxisKey]?.color;
                  return (
                    <Cell key={`cell-${index}`} fill={color} />
                  );
                })}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => {
                  // Show both value and percentage in tooltip
                  const total = processedData.reduce((sum, p) => {
                    const val = p[yAxisKey];
                    return sum + ((val !== null && val !== undefined && val !== '') ? (val as number) : 0);
                  }, 0);
                  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return [`${value} (${percent}%)`, yAxisKey];
                }}
              />
            </PieChart>
          </ChartContainer>
        );

      case 'gauge': {
        // Gauge chart: semi-circular with needle pointing to value
        // CROSS-51: Handle null values for gauge
        const firstDataPoint = processedData.length > 0 ? processedData[0] : null;
        const gaugeValue = firstDataPoint && firstDataPoint[yAxisKey] !== null && firstDataPoint[yAxisKey] !== undefined 
          ? (firstDataPoint[yAxisKey] as number || 0) 
          : 0;
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
          <ChartContainer 
            config={chartConfig}
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <div className={`relative w-full flex items-center justify-center overflow-visible ${isFullscreen ? 'h-full min-h-[600px]' : 'h-full min-h-[280px]'}`}>
              <svg 
                width="100%" 
                height="100%" 
                viewBox="0 0 200 150" 
                className="overflow-visible max-w-[300px] [@media(min-width:1400px)]:max-w-full" 
                preserveAspectRatio="xMidYMid meet"
              >
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
                
                {/* Needle (smaller height: 55 to prevent overlap) */}
                <g transform="translate(100, 100)">
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="-55"
                    stroke="hsl(var(--foreground))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    transform={`rotate(${needleAngle})`}
                  />
                  <circle cx="0" cy="0" r="5" fill="hsl(var(--foreground))" />
                </g>
                {/* Value display inside SVG for consistent scaling */}
                <text 
                  x="100" 
                  y="130" 
                  textAnchor="middle" 
                  className="fill-foreground font-bold"
                  style={{ fontSize: isFullscreen ? '20px' : '16px' }}
                >
                  {gaugeValue} / {maxValue}
                </text>
              </svg>
            </div>
          </ChartContainer>
        );
      }

      case 'scatter':
        return (
          <ChartContainer 
            config={chartConfig}
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <ScatterChart {...commonProps} height={chartHeight}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <XAxis 
                dataKey={xAxisKey} 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${labelFontSize}px`, fontWeight: 500 }}
                angle={labelAngle}
                textAnchor={labelTextAnchor}
                height={isFullscreen ? undefined : 50}
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const fullText = String(payload.value);
                  const maxLen = isFullscreen ? 100 : 20;
                  const truncated = fullText.length > maxLen ? fullText.substring(0, maxLen) + '...' : fullText;
                  const isTruncated = fullText.length > maxLen;
                  const dy = labelAngle === 0 ? 16 : 8;
                  const dx = labelAngle === 0 ? 0 : -2;
                  return (
                    <g 
                      transform={`translate(${x},${y})`}
                      onMouseEnter={(e) => {
                        if (isTruncated) {
                          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                          setLabelTooltip({ visible: true, text: fullText, x: rect.left + rect.width / 2, y: rect.top - 8 });
                        }
                      }}
                      onMouseLeave={() => setLabelTooltip(prev => ({ ...prev, visible: false }))}
                    >
                      <text x={0} y={0} dy={dy} dx={dx} textAnchor={labelTextAnchor} transform={`rotate(${labelAngle})`} fill={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} fontSize={labelFontSize} fontWeight={500} style={{ cursor: isTruncated ? 'pointer' : 'default' }}>
                        {truncated}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis 
                stroke={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                style={{ fontSize: `${fontSize}px` }}
                domain={[yAxisMin, yAxisMax]}
                ticks={yAxisTicks}
                width={isFullscreen ? 60 : 50}
                tick={{ fontSize: fontSize }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: `${fontSize}px`, paddingBottom: '20px' }} 
                iconSize={isMobile ? 12 : 14}
                wrapperClass={isMobile ? "!text-xs" : ""}
              />
              {dataKeys.map((key, index) => {
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
          <ChartContainer 
            config={chartConfig}
            className={isFullscreen ? "w-full h-full !aspect-auto" : undefined}
          >
            <RadarChart data={processedData} height={chartHeight}>
              <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
              <PolarAngleAxis 
                dataKey={xAxisKey} 
                tick={{ 
                  fill: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)', // Better contrast
                  fontSize: labelFontSize,
                  fontWeight: 500
                }}
                // Truncate long labels for radar charts
                tickFormatter={(value) => {
                  const str = String(value);
                  return str.length > 12 ? str.substring(0, 12) + '...' : str;
                }}
              />
              <PolarRadiusAxis 
                tick={{ 
                  fill: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                  fontSize: fontSize
                }} 
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: `${fontSize}px`, paddingBottom: '20px' }} 
                iconSize={isMobile ? 12 : 14}
                wrapperClass={isMobile ? "!text-xs" : ""}
              />
              {dataKeys.map((key, index) => {
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

  return (
    <div className="space-y-4 relative">
      {/* Floating Label Tooltip */}
      {labelTooltip.visible && (
        <div
          className="fixed z-[9999] px-3 py-2 text-sm font-medium rounded-md shadow-lg pointer-events-none"
          style={{
            left: labelTooltip.x,
            top: labelTooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: isDark ? 'hsl(var(--card))' : 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            maxWidth: '300px',
            wordWrap: 'break-word',
          }}
        >
          {labelTooltip.text}
        </div>
      )}

      {/* Export All Charts Button */}
      {charts.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-heading-primary">
            Analytics
          </h2>
        </div>
      )}

      {/* Charts Grid with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={charts.map((chart) => chart.id || '')}
          strategy={rectSortingStrategy}
        >
          <div 
            ref={chartsContainerRef}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-auto"
          >
            {charts.map((chart) => (
              <SortableChartCard
                key={chart.id}
                chart={chart}
                renderChart={renderChart}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};


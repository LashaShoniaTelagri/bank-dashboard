import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download, Loader2, X } from "lucide-react";
import { ChartTemplate } from "@/types/chart";
import { MonitoredIssue } from "@/types/phase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  ResponsiveContainer,
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
  Tooltip,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { getChartColorArray } from "@/lib/chartColors";

interface OnePagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
  farmerName: string;
  phaseNumber: number;
}

export const OnePagerModal = ({
  isOpen,
  onClose,
  farmerId,
  farmerName,
  phaseNumber,
}: OnePagerModalProps) => {
  const [isExporting, setIsExporting] = useState(false);

  // Debug logging when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('📋 OnePager Modal Opened with props:', {
        farmerId,
        farmerName,
        phaseNumber,
      });
    }
  }, [isOpen, farmerId, farmerName, phaseNumber]);

  // Fetch charts for this farmer and phase
  // Include: charts with no phase assignment (null) OR charts assigned to this specific phase
  const { data: charts = [] } = useQuery<ChartTemplate[]>({
    queryKey: ['one-pager-charts', farmerId, phaseNumber],
    queryFn: async () => {
      console.log('🔍 OnePager - Fetching charts for farmer:', farmerId, 'phase:', phaseNumber);
      
      const { data, error } = await (supabase
        .from('chart_templates' as any)
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('is_active', true)
        .or(`phase_number.is.null,phase_number.eq.${phaseNumber}`)
        .order('created_at', { ascending: true }) as any);

      if (error) {
        console.error('❌ OnePager - Error fetching charts:', error);
        throw error;
      }
      
      console.log('✅ OnePager - Found charts:', data?.length || 0, 'for farmer:', farmerId, 'phase:', phaseNumber);
      return (data as ChartTemplate[]) || [];
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
  });

  // Fetch phase data to get the issue_date
  const { data: phaseData } = useQuery({
    queryKey: ['farmer-phase', farmerId, phaseNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_phases')
        .select('issue_date, score')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .maybeSingle();

      if (error) {
        console.error('❌ OnePagerModal - Error fetching phase data:', error);
        return null;
      }

      return data;
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
  });

  // Fetch phase-specific monitored issues with phase-specific descriptions
  // Join phase_monitored_data with monitored_issues to get phase-specific descriptions
  interface PhaseSpecificIssue extends MonitoredIssue {
    phase_description?: string | null; // Description from phase_monitored_data
  }

  const { data: monitoredIssues = [] } = useQuery<PhaseSpecificIssue[]>({
    queryKey: ['phase-monitored-issues', farmerId, phaseNumber],
    queryFn: async () => {
      console.log('🔍 OnePager - Fetching phase-specific monitored issues:', { farmerId, phaseNumber });
      
      // Fetch phase_monitored_data with issue details joined
      const { data: phaseData, error: phaseError } = await (supabase
        .from('phase_monitored_data' as any)
        .select(`
          issue_id,
          description,
          monitored_issues (
            id,
            name,
            display_order,
            is_active,
            created_at
          )
        `)
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber) as any);

      if (phaseError) {
        console.error('❌ OnePager - Error fetching phase monitored data:', phaseError);
        return [];
      }

      // If no phase data exists, return empty array
      if (!phaseData || phaseData.length === 0) {
        console.log('✅ OnePager - No phase-specific data found for phase:', phaseNumber);
        return [];
      }

      // Transform the data to combine issue info with phase-specific description
      const issues: PhaseSpecificIssue[] = phaseData
        .map((item: any) => {
          const issue = item.monitored_issues;
          if (!issue || !issue.is_active) return null;
          
          return {
            ...issue,
            phase_description: item.description || null, // Phase-specific description
          };
        })
        .filter((item: any) => item !== null)
        .sort((a: any, b: any) => a.display_order - b.display_order);

      console.log('✅ OnePager - Found phase-specific issues:', issues?.length || 0, 'for phase:', phaseNumber);
      return issues;
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
  });

  // Render chart function
  const renderChart = (chart: ChartTemplate) => {
    const data = chart.chart_data.data || [];
    const xAxisKey = chart.chart_data.xAxisKey || 'name';
    const yAxisKey = chart.chart_data.yAxisKey || 'value';
    const dataKeys = chart.chart_data.dataKeys || [yAxisKey];
    const seriesColors = chart.chart_data.seriesColors || {};
    const dataPointColors = chart.chart_data.dataPointColors || {};
    const brandColors = getChartColorArray(false); // Always use light mode colors for PDF

    // Create chart config for recharts
    const chartConfig: any = {};
    dataKeys.forEach((key, index) => {
      chartConfig[key] = {
        label: key,
        color: seriesColors[key] || brandColors[index % brandColors.length],
      };
    });

    const commonProps = {
      width: 450,
      height: 250,
      data,
      margin: { top: 10, right: 10, left: 10, bottom: 5 },
    };

    switch (chart.chart_type) {
      case 'bar':
        return (
          <ChartContainer config={chartConfig}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey={xAxisKey} fontSize={11} />
              <YAxis fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {dataKeys.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={chartConfig[key]?.color}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        );

      case 'line':
        return (
          <ChartContainer config={chartConfig}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey={xAxisKey} fontSize={11} />
              <YAxis fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {dataKeys.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={chartConfig[key]?.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        );

      case 'area':
        return (
          <ChartContainer config={chartConfig}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey={xAxisKey} fontSize={11} />
              <YAxis fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {dataKeys.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={chartConfig[key]?.color}
                  fill={chartConfig[key]?.color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        );

      case 'bar-horizontal':
        return (
          <ChartContainer config={chartConfig}>
            <BarChart {...commonProps} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" fontSize={11} />
              <YAxis dataKey={xAxisKey} type="category" fontSize={11} width={80} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {dataKeys.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={chartConfig[key]?.color}
                  radius={[0, 4, 4, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        );

      case 'pie':
      case 'donut': {
        const isDonut = chart.chart_type === 'donut';
        return (
          <ChartContainer config={chartConfig}>
            <div className="w-full h-[280px] flex items-center justify-center p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={isDonut ? 80 : 90}
                    innerRadius={isDonut ? 50 : 0}
                    fill="#8884d8"
                    dataKey={yAxisKey}
                  >
                    {data.map((entry, index) => {
                      const color = dataPointColors[entry.name]
                        || brandColors[index % brandColors.length]
                        || seriesColors[yAxisKey]
                        || chartConfig[yAxisKey]?.color;
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartContainer>
        );
      }

      case 'scatter':
        return (
          <ChartContainer config={chartConfig}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey={xAxisKey} fontSize={11} type="number" />
              <YAxis dataKey={yAxisKey} fontSize={11} type="number" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Scatter
                name={yAxisKey}
                data={data}
                fill={chartConfig[yAxisKey]?.color || brandColors[0]}
              />
            </ScatterChart>
          </ChartContainer>
        );

      case 'radar':
        return (
          <ChartContainer config={chartConfig}>
            <RadarChart cx="50%" cy="50%" outerRadius={80} width={450} height={250} data={data}>
              <PolarGrid opacity={0.3} />
              <PolarAngleAxis dataKey={xAxisKey} fontSize={10} />
              <PolarRadiusAxis fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {dataKeys.map((key) => (
                <Radar
                  key={key}
                  name={key}
                  dataKey={key}
                  stroke={chartConfig[key]?.color}
                  fill={chartConfig[key]?.color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ChartContainer>
        );

      case 'gauge': {
        // Gauge chart: semi-circular with needle pointing to value
        const gaugeValue = data.length > 0 ? (data[0][yAxisKey] as number || 0) : 0;
        const maxValue = 10; // Default max, could be configurable
        const gaugePercentage = Math.min(Math.max((gaugeValue / maxValue) * 100, 0), 100);
        // Needle angle: starts at -90 (pointing left), rotates clockwise to 90 (pointing right)
        const needleAngle = -90 + (gaugePercentage / 100) * 180;
        
        // Create segments for the gauge (red, orange, green zones)
        const gaugeSegments = [
          { start: 0, end: 60, color: '#dc2626' }, // Red: 0-60%
          { start: 60, end: 80, color: '#ea580c' }, // Orange: 60-80%
          { start: 80, end: 100, color: '#16a34a' }, // Green: 80-100%
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
          <div className="relative w-full h-[220px] flex items-center justify-center pb-8">
            <svg width="100%" height="100%" viewBox="0 0 200 120" className="overflow-visible" preserveAspectRatio="xMidYMid meet" style={{ marginBottom: '30px' }}>
              {/* Gauge background arc (from left to right) */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="20"
                strokeLinecap="round"
                opacity="0.5"
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
            </svg>
            
            {/* Value display positioned below with proper spacing to avoid overlap */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
              <div className="text-xl font-bold text-foreground">{gaugeValue} / {maxValue}</div>
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="h-[200px] flex items-center justify-center bg-muted/30 rounded-md">
            <p className="text-sm text-muted-foreground">Chart type: {chart.chart_type}</p>
          </div>
        );
    }
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById('one-pager-content');
      if (!element) {
        throw new Error('Content element not found');
      }

      // Wait for all content to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force all SVG elements to be fully rendered
      const svgElements = element.querySelectorAll('svg');
      svgElements.forEach((svg) => {
        window.getComputedStyle(svg).getPropertyValue('width');
      });

      // Enhanced html2canvas configuration for Windows compatibility
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        foreignObjectRendering: false,
        imageTimeout: 15000,
        removeContainer: true,
        onclone: (clonedDoc) => {
          // Force light theme for consistent rendering
          const clonedElement = clonedDoc.getElementById('one-pager-content');
          if (clonedElement) {
            clonedElement.classList.remove('dark');
            clonedDoc.documentElement.classList.remove('dark');
            clonedDoc.body.classList.remove('dark');

            // Fix text colors
            const allElements = clonedElement.querySelectorAll('*');
            allElements.forEach((el: Element) => {
              const htmlEl = el as HTMLElement;
              if (window.getComputedStyle(htmlEl).color === 'rgb(255, 255, 255)' ||
                  window.getComputedStyle(htmlEl).color.includes('rgba(255, 255, 255')) {
                htmlEl.style.color = '#000000';
              }
            });

            // Fix SVG colors
            const svgTexts = clonedElement.querySelectorAll('svg text');
            svgTexts.forEach((text: Element) => {
              const svgText = text as SVGTextElement;
              const fill = svgText.getAttribute('fill');
              if (!fill || fill === 'currentColor' || fill.includes('var(')) {
                svgText.setAttribute('fill', '#000000');
              }
            });

            const svgShapes = clonedElement.querySelectorAll('svg path, svg rect, svg circle, svg line');
            svgShapes.forEach((shape: Element) => {
              const svgShape = shape as SVGElement;
              const stroke = svgShape.getAttribute('stroke');
              const fill = svgShape.getAttribute('fill');
              
              if (stroke && (stroke === 'currentColor' || stroke.includes('var('))) {
                svgShape.setAttribute('stroke', '#666666');
              }
              if (fill && fill.includes('var(')) {
                svgShape.setAttribute('fill', '#3b82f6');
              }
            });
          }
        },
      });

      // Verify canvas has content
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Generated canvas is empty');
      }

      const imgData = canvas.toDataURL('image/png', 1.0);

      if (!imgData || imgData === 'data:,') {
        throw new Error('Failed to generate image data from canvas');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Set white background for first page
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, imgWidth, pageHeight, 'F');

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        // Set white background for each page
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, imgWidth, pageHeight, 'F');
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(`${farmerName}_Phase${phaseNumber}_OnePager.pdf`);
      
      toast({
        title: "PDF Downloaded",
        description: `One-pager for ${farmerName} Phase ${phaseNumber} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      toast({
        title: "PDF Export Failed",
        description: error instanceof Error ? error.message : "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden"
        aria-describedby="one-pager-description"
      >
        <DialogHeader className="sticky top-0 bg-background z-20 pb-4 border-b px-6 pt-6 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold">
                Phase {phaseNumber} - One Pager
              </DialogTitle>
              <DialogDescription id="one-pager-description" className="mt-1">
                {farmerName} - Comprehensive phase overview
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="flex items-center gap-2"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div id="one-pager-content" className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-background">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-heading-primary">{farmerName}</h1>
            <h2 className="text-xl text-muted-foreground">Phase {phaseNumber} Overview</h2>
            <p className="text-sm text-muted-foreground">
              {phaseData?.issue_date ? (
                <>Generated on {new Date(phaseData.issue_date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</>
              ) : (
                <>Report Date Not Set</>
              )}
            </p>
          </div>

          <Separator />

          {/* Charts Section */}
          {charts.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-heading-primary">Analytics & Charts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {charts.map((chart) => (
                  <Card key={chart.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{chart.name}</CardTitle>
                      {chart.annotation && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {chart.annotation}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="w-full">
                        {renderChart(chart)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {charts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No charts available for this farmer</p>
            </div>
          )}

          <Separator />

          {/* Monitored Issues Section - Phase Specific */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-heading-primary">
              Phase {phaseNumber} - Monitoring Details
            </h3>
            {monitoredIssues.length > 0 ? (
              <div className="space-y-6">
                {monitoredIssues.map((issue, index) => (
                  <Card key={issue.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-sm">
                          {index + 1}.
                        </span>
                        {issue.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {(issue as PhaseSpecificIssue).phase_description ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: (issue as PhaseSpecificIssue).phase_description || '' }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No description available for this monitoring issue in Phase {phaseNumber}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No monitoring data available for Phase {phaseNumber}. 
                  Monitoring issues will appear here once data is added for this phase.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


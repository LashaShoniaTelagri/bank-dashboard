  import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, X, Edit, Map as MapIcon, ExternalLink, ChevronDown, ChevronRight, FileText as FileTextIcon, Image as ImageIcon, FileImage, Link as LinkIcon, Save } from "lucide-react";
import { ChartTemplate } from "@/types/chart";
import { MonitoredIssue } from "@/types/phase";
import { useToast } from "@/hooks/use-toast";
import { MonitoredIssueEditor } from "@/components/MonitoredIssueEditor";
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

interface F100ModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
  farmerName: string;
  phaseNumber: number;
}

export const F100Modal = ({
  isOpen,
  onClose,
  farmerId,
  farmerName,
  phaseNumber,
}: F100ModalProps) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const isDark = theme === 'dark';
  
  // Monitored issue editor state
  const [issueEditorOpen, setIssueEditorOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<MonitoredIssue | null>(null);
  
  // Used Data display state
  const [collapsedIframes, setCollapsedIframes] = useState<Set<string>>(new Set());
  
  // F100 URL state (admin only)
  const [f100Url, setF100Url] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  // Debug logging when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('📋 F100Modal Opened with props:', {
        farmerId,
        farmerName,
        phaseNumber,
      });
    }
  }, [isOpen, farmerId, farmerName, phaseNumber]);

  // Fetch charts for this farmer and phase
  // Include: charts with no phase assignment (null) OR charts assigned to this specific phase
  const { data: charts = [] } = useQuery<ChartTemplate[]>({
    queryKey: ['f100-charts', farmerId, phaseNumber],
    queryFn: async () => {
      console.log('🔍 F100Modal - Fetching charts for farmer:', farmerId, 'phase:', phaseNumber);
      
      const { data, error } = await (supabase
        .from('chart_templates' as any)
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('is_active', true)
        .or(`phase_number.is.null,phase_number.eq.${phaseNumber}`)
        .order('display_order', { ascending: true }) as any);

      if (error) {
        console.error('❌ F100Modal - Error fetching charts:', error);
        throw error;
      }
      
      // Sort by display_order, then by created_at as fallback
      const charts = (data || []) as unknown as ChartTemplate[];
      const sortedCharts = charts.sort((a, b) => {
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        // Fallback to created_at if display_order is the same
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      });
      
      console.log('✅ F100Modal - Found charts:', sortedCharts?.length || 0, 'for farmer:', farmerId, 'phase:', phaseNumber);
      return sortedCharts;
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
    staleTime: 0, // Always refetch when modal opens
    refetchOnMount: 'always', // Ensure fresh data
  });

  // Fetch phase-specific monitored issues with phase-specific descriptions
  // Join phase_monitored_data with monitored_issues to get phase-specific descriptions
  interface PhaseSpecificIssue extends MonitoredIssue {
    phase_description?: string | null; // Description from phase_monitored_data
    show_iframes?: boolean; // Whether to show Interactive Maps in Used Data section
  }

  // Fetch phase data to get the issue_date and f100_url
  const { data: phaseData } = useQuery({
    queryKey: ['farmer-phase', farmerId, phaseNumber],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('farmer_phases' as any)
        .select('issue_date, score, f100_url')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .maybeSingle() as any);

      if (error) {
        console.error('❌ F100Modal - Error fetching phase data:', error);
        return null;
      }

      return data;
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
  });

  // Load F100 URL when phaseData changes
  useEffect(() => {
    if (phaseData?.f100_url) {
      setF100Url(phaseData.f100_url);
    } else {
      setF100Url('');
    }
    setIsEditingUrl(false);
  }, [phaseData]);

  // Save F100 URL mutation
  const saveF100UrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await (supabase
        .from('farmer_phases' as any)
        .update({ f100_url: url.trim() || null })
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber) as any);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "F-100 URL saved successfully",
      });
      setIsEditingUrl(false);
      queryClient.invalidateQueries({ queryKey: ['farmer-phase', farmerId, phaseNumber] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save F-100 URL",
        variant: "destructive",
      });
    },
  });

  const handleSaveUrl = async () => {
    setIsSavingUrl(true);
    await saveF100UrlMutation.mutateAsync(f100Url);
    setIsSavingUrl(false);
  };

  const handleDownload = () => {
    if (phaseData?.f100_url) {
      // If F100 URL is specified, open it in new tab
      window.open(phaseData.f100_url, '_blank', 'noopener,noreferrer');
    } else {
      // Otherwise, generate PDF
      handleDownloadPDF();
    }
  };

  // Fetch phase iframe URLs for Used Data section
  const { data: phaseIframes = [] } = useQuery({
    queryKey: ['farmer-phase-iframes-f100', farmerId, phaseNumber],
    queryFn: async () => {
      console.log('🗺️ F100Modal - Fetching iframes for farmer:', farmerId, 'phase:', phaseNumber);
      const { data, error } = await (supabase
        .from('farmer_phases' as any)
        .select('iframe_urls')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .single() as any);
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ F100Modal - Error fetching iframes:', error);
        return [];
      }
      
      const iframes = ((data as any)?.iframe_urls as Array<{ url: string; name: string; annotation?: string }>) || [];
      console.log('✅ F100Modal - Loaded', iframes.length, 'iframe(s) for phase', phaseNumber);
      return iframes;
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
    staleTime: 0,
    refetchOnMount: 'always',
  }) as { data: Array<{ url: string; name: string; annotation?: string }> };

  // Fetch uploaded maps for Used Data section with signed URLs
  const { data: uploadedMaps = [] } = useQuery({
    queryKey: ['phase-used-data-maps-f100', farmerId, phaseNumber],
    queryFn: async () => {
      console.log('📁 F100Modal - Fetching uploaded maps for farmer:', farmerId, 'phase:', phaseNumber);
      const { data, error } = await (supabase
        .from('phase_used_data_maps' as any)
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }) as any);
      
      if (error) {
        console.error('❌ F100Modal - Error fetching uploaded maps:', error);
        return [];
      }
      
      // Generate signed URLs for each file
      const mapsWithUrls = await Promise.all(
        (data || []).map(async (map: any) => {
          const { data: signedData, error: signError } = await supabase.storage
            .from('farmer-documents')
            .createSignedUrl(map.file_path, 3600); // 1 hour expiry
          
          return {
            ...map,
            signedUrl: signError ? null : signedData?.signedUrl,
          };
        })
      );
      
      console.log('✅ F100Modal - Loaded', mapsWithUrls.length, 'uploaded map(s) with signed URLs');
      return mapsWithUrls;
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
    staleTime: 0,
    refetchOnMount: 'always',
  }) as { data: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_mime: string;
    file_size_bytes: number;
    annotation?: string;
    display_order: number;
    created_at: string;
    signedUrl?: string | null;
  }> };

  // Toggle iframe collapse
  const toggleIframeCollapse = (url: string) => {
    setCollapsedIframes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  // Helper functions for uploaded files
  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <FileTextIcon className="h-5 w-5 text-red-600 dark:text-red-400" />;
    } else if (mimeType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
    return <FileImage className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const openFileInViewer = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('farmer-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open file",
        variant: "destructive",
      });
    }
  };

  const { data: monitoredIssues = [] } = useQuery<PhaseSpecificIssue[]>({
    queryKey: ['phase-monitored-issues', farmerId, phaseNumber],
    queryFn: async () => {
      console.log('🔍 F100Modal - Fetching monitored issues for phase:', { farmerId, phaseNumber });
      
      // First, fetch all active monitored issues
      const { data: allIssues, error: issuesError } = await supabase
        .from('monitored_issues')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (issuesError) {
        console.error('❌ F100Modal - Error fetching monitored issues:', issuesError);
        return [];
      }

      if (!allIssues || allIssues.length === 0) {
        console.log('✅ F100Modal - No monitored issues found');
        return [];
      }

      // Then, fetch phase-specific descriptions for this farmer and phase
      const { data: phaseData, error: phaseError } = await (supabase
        .from('phase_monitored_data' as any)
        .select('issue_id, description, show_iframes')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber) as any);

      if (phaseError) {
        console.error('❌ F100Modal - Error fetching phase monitored data:', phaseError);
        // Continue with issues even if phase data fetch fails
      }

      // Create maps for issue_id -> phase_description and show_iframes
      const phaseDescriptionMap = new Map<string, string | null>();
      const showIframesMap = new Map<string, boolean>();
      if (phaseData) {
        phaseData.forEach((item: any) => {
          phaseDescriptionMap.set(item.issue_id, item.description || null);
          showIframesMap.set(item.issue_id, item.show_iframes || false);
        });
      }

      // Combine all issues with phase-specific descriptions and show_iframes flag
      const issues: PhaseSpecificIssue[] = allIssues.map((issue) => ({
        ...issue,
        phase_description: phaseDescriptionMap.get(issue.id) || null,
        show_iframes: showIframesMap.get(issue.id) || false,
      }));

      console.log('✅ F100Modal - Found', issues.length, 'monitored issues for phase', phaseNumber);
      return issues;
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
    staleTime: 0, // Always refetch when modal opens
    refetchOnMount: 'always', // Ensure fresh data
  });

  // Render chart function
  const renderChart = (chart: ChartTemplate) => {
    const data = chart.chart_data.data || [];
    const xAxisKey = chart.chart_data.xAxisKey || 'name';
    const yAxisKey = chart.chart_data.yAxisKey || 'value';
    const dataKeys = chart.chart_data.dataKeys || [yAxisKey];
    const seriesColors = chart.chart_data.seriesColors || {};
    const dataPointColors = chart.chart_data.dataPointColors || {};
    const valueType = chart.chart_data.valueType || 'numeric';
    const brandColors = getChartColorArray(false); // Always use light mode colors for PDF
    
    // Percentage symbol suffix
    const valueSuffix = valueType === 'percentage' ? '%' : '';
    
    // Use configured min/max scores
    const yAxisMin = chart.chart_data.minScore ?? 0;
    const yAxisMax = chart.chart_data.maxScore ?? (valueType === 'percentage' ? 100 : 10);

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
              <YAxis fontSize={11} domain={[yAxisMin, yAxisMax]} tickFormatter={(value) => `${value}${valueSuffix}`} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
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
              <YAxis fontSize={11} domain={[yAxisMin, yAxisMax]} tickFormatter={(value) => `${value}${valueSuffix}`} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
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
              <YAxis fontSize={11} domain={[yAxisMin, yAxisMax]} tickFormatter={(value) => `${value}${valueSuffix}`} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
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
              <XAxis type="number" fontSize={11} domain={[yAxisMin, yAxisMax]} tickFormatter={(value) => `${value}${valueSuffix}`} />
              <YAxis dataKey={xAxisKey} type="category" fontSize={11} width={80} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
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
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => `${value}${valueSuffix}`}
                  />
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
              <XAxis dataKey={xAxisKey} fontSize={11} type="number" domain={[yAxisMin, yAxisMax]} tickFormatter={(value) => `${value}${valueSuffix}`} />
              <YAxis dataKey={yAxisKey} fontSize={11} type="number" domain={[yAxisMin, yAxisMax]} tickFormatter={(value) => `${value}${valueSuffix}`} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
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
              <PolarRadiusAxis fontSize={10} domain={[yAxisMin, yAxisMax]} tickFormatter={(value) => `${value}${valueSuffix}`} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => `${value}${valueSuffix}`}
              />
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
        const maxValue = chart.chart_data.maxScore ?? (valueType === 'percentage' ? 100 : 10);
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
              <div className="text-xl font-bold text-foreground">{gaugeValue}{valueSuffix} / {maxValue}{valueSuffix}</div>
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
    console.log('📊 PDF Export: Starting with', charts.length, 'charts');
    
    // Show informative toast for large reports
    if (charts.length >= 5) {
      toast({
        title: "Generating Large PDF",
        description: `Processing ${charts.length} charts. This may take a moment, please wait...`,
      });
    }
    
    try {
      const element = document.getElementById('one-pager-content');
      if (!element) {
        throw new Error('Content element not found');
      }

      // Store original scroll position
      const scrollContainer = element.closest('.overflow-y-auto');
      const originalScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

      // Scroll to top to ensure we capture from the beginning
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }

      // Wait for scroll to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Temporarily remove height restrictions on the original element
      const originalStyles = {
        height: element.style.height,
        maxHeight: element.style.maxHeight,
        overflow: element.style.overflow,
      };

      // Get the parent container to understand full dimensions
      const parentContainer = element.parentElement;
      const containerWidth = parentContainer?.offsetWidth || element.offsetWidth;

      // Set element to full height for capture
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
      element.style.overflow = 'visible';
      element.style.width = containerWidth + 'px';

      // Wait for layout to recalculate and all images/charts to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force all SVG elements to be fully rendered
      const svgElements = element.querySelectorAll('svg');
      console.log('📊 PDF Export: Found', svgElements.length, 'SVG elements');
      svgElements.forEach((svg) => {
        // Trigger re-render of SVG by accessing computed styles
        window.getComputedStyle(svg).getPropertyValue('width');
      });

      // Yield control back to browser to prevent "page unresponsive" warning
      await new Promise(resolve => setTimeout(resolve, 0));

      // Always use white background for PDFs (best compatibility across platforms)
      const backgroundColor = '#ffffff';
      
      console.log('📊 PDF Export: Starting html2canvas conversion...');
      
      // Optimized html2canvas configuration for high-quality text rendering
      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for crisp text rendering
        useCORS: true, // Allow cross-origin images
        logging: false, // Disable console logs
        backgroundColor: backgroundColor, // Force white background
        allowTaint: true, // Allow cross-origin content (needed for charts)
        foreignObjectRendering: false, // Disable foreign object rendering (better SVG compatibility)
        imageTimeout: 15000, // Wait longer for images to load
        removeContainer: true, // Clean up after rendering
        height: element.scrollHeight,
        width: element.scrollWidth,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          // Force light theme in cloned document for consistent rendering
          const clonedElement = clonedDoc.getElementById('one-pager-content');
          if (clonedElement) {
            // Remove dark theme classes
            clonedElement.classList.remove('dark');
            clonedDoc.documentElement.classList.remove('dark');
            clonedDoc.body.classList.remove('dark');
            
            // Hide all buttons marked for PDF hiding
            const buttonsToHide = clonedElement.querySelectorAll('.pdf-hide-button');
            buttonsToHide.forEach((btn: Element) => {
              (btn as HTMLElement).style.display = 'none';
            });
            
            // Force light theme colors and improve text rendering
            const allElements = clonedElement.querySelectorAll('*');
            allElements.forEach((el: Element) => {
              const htmlEl = el as HTMLElement;
              
              // Ensure all text is black and backgrounds are light for PDF
              if (window.getComputedStyle(htmlEl).color === 'rgb(255, 255, 255)' ||
                  window.getComputedStyle(htmlEl).color.includes('rgba(255, 255, 255')) {
                htmlEl.style.color = '#000000';
              }
              
              // Improve text rendering for better quality
              (htmlEl.style as any).webkitFontSmoothing = 'antialiased';
              (htmlEl.style as any).mozOsxFontSmoothing = 'grayscale';
              
              const computedStyle = window.getComputedStyle(htmlEl);
              const tagName = htmlEl.tagName.toLowerCase();
              
              // Apply to all text-containing elements
              htmlEl.style.letterSpacing = '0.02em';
              htmlEl.style.wordSpacing = '0.15em';
              htmlEl.style.whiteSpace = 'normal';
              htmlEl.style.textRendering = 'optimizeLegibility';
              
              // Specific handling for text elements
              if (['p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'strong', 'em', 'a', 'label', 'button'].includes(tagName)) {
                // Set consistent line-height
                htmlEl.style.lineHeight = '1.6';
                
                // Force display to ensure proper rendering
                if (computedStyle.display === 'inline') {
                  htmlEl.style.display = 'inline-block';
                }
              }
              
              // Special handling for headings and titles to prevent splitting
              if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) || htmlEl.classList.contains('font-bold') || htmlEl.classList.contains('font-semibold')) {
                htmlEl.style.letterSpacing = '0.03em';
                htmlEl.style.wordSpacing = '0.2em';
                htmlEl.style.fontWeight = computedStyle.fontWeight;
                htmlEl.style.display = 'block';
                htmlEl.style.width = '100%';
              }
            });

            // Ensure all SVG text elements are visible
            const svgTexts = clonedElement.querySelectorAll('svg text');
            svgTexts.forEach((text: Element) => {
              const svgText = text as SVGTextElement;
              const fill = svgText.getAttribute('fill');
              if (!fill || fill === 'currentColor' || fill.includes('var(')) {
                svgText.setAttribute('fill', '#000000');
              }
            });

            // Ensure all SVG paths and shapes have proper colors
            const svgPaths = clonedElement.querySelectorAll('svg path, svg rect, svg circle, svg line');
            svgPaths.forEach((shape: Element) => {
              const svgShape = shape as SVGElement;
              const stroke = svgShape.getAttribute('stroke');
              const fill = svgShape.getAttribute('fill');
              
              if (stroke && (stroke === 'currentColor' || stroke.includes('var('))) {
                svgShape.setAttribute('stroke', '#666666');
              }
              if (fill && (fill === 'currentColor' || fill.includes('var('))) {
                // Don't change fill if it's already set to a specific color
                if (fill.includes('var(')) {
                  svgShape.setAttribute('fill', '#3b82f6'); // Default chart color
                }
              }
            });
          }
        },
      });
      
      console.log('📊 PDF Export: Canvas generated', canvas.width, 'x', canvas.height);

      // Yield control back to browser after heavy canvas operation
      await new Promise(resolve => setTimeout(resolve, 0));

      // Restore original styles
      element.style.height = originalStyles.height;
      element.style.maxHeight = originalStyles.maxHeight;
      element.style.overflow = originalStyles.overflow;
      element.style.width = '';

      // Restore scroll position
      if (scrollContainer) {
        scrollContainer.scrollTop = originalScrollTop;
      }

      // Verify canvas has content
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Generated canvas is empty');
      }

      console.log('📊 PDF Export: Converting canvas to JPEG...');
      
      // Use JPEG for reliable cross-platform PDF generation
      // High quality (98%) to preserve text sharpness and prevent compression artifacts
      // White background already set via backgroundColor option
      const imgData = canvas.toDataURL('image/jpeg', 0.98); // 98% quality for crisp text rendering
      
      // Verify image data is valid
      if (!imgData || imgData === 'data:,' || !imgData.startsWith('data:image/jpeg')) {
        throw new Error('Failed to generate JPEG data from canvas');
      }
      
      console.log('📊 PDF Export: JPEG data ready, size:', (imgData.length / 1024 / 1024).toFixed(2), 'MB');
      
      // Yield control back to browser before PDF creation
      await new Promise(resolve => setTimeout(resolve, 0));

      console.log('📊 PDF Export: Creating PDF with smart page breaks...');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      const margin = 10; // Margin in mm
      const contentHeight = pdfHeight - (margin * 2); // Usable height per page
      
      // Calculate scaling
      const imgWidth = pdfWidth - (margin * 2);
      const scaleFactor = imgWidth / canvas.width;
      const totalContentHeight = canvas.height * scaleFactor;
      
      console.log('📊 PDF Export: Content dimensions:', {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        pdfContentHeight: totalContentHeight,
        estimatedPages: Math.ceil(totalContentHeight / contentHeight)
      });

      // Split content into pages with intelligent breaks
      let currentY = 0; // Current position in mm
      let pageCount = 0;
      
      // Get all major sections to determine break points
      const chartGrid = element.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
      const monitoringSection = element.querySelector('.space-y-6');
      const sectionHeaders = element.querySelectorAll('.pdf-section-header');
      const separators = element.querySelectorAll('.pdf-section-break');
      const breakPoints: number[] = [0]; // Start of document
      
      // Add section headers and separators
      const majorElements = [...Array.from(sectionHeaders), ...Array.from(separators)];
      majorElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const relativeTop = rect.top - elementRect.top + element.scrollTop;
        const topInMm = relativeTop * scaleFactor;
        
        if (topInMm > 10) {
          breakPoints.push(topInMm);
        }
      });
      
      // For chart grid: Track chart boundaries to prevent splitting
      const chartBoundaries: Array<{ start: number; end: number; index: number }> = [];
      if (chartGrid) {
        const chartCards = chartGrid.querySelectorAll('.pdf-chart-card');
        
        chartCards.forEach((card, index) => {
          const rect = card.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const relativeTop = rect.top - elementRect.top + element.scrollTop;
          const relativeBottom = relativeTop + rect.height;
          
          const topInMm = relativeTop * scaleFactor;
          const bottomInMm = relativeBottom * scaleFactor;
          
          if (topInMm > 10) {
            chartBoundaries.push({
              start: topInMm,
              end: bottomInMm,
              index: index
            });
            
            // Only add break points BEFORE charts and after groups of 4
            if (index % 4 === 0) {
              // Before chart 1, 5, 9, etc (start of group)
              breakPoints.push(topInMm - 5);
            }
            
            if ((index + 1) % 4 === 0 || index === chartCards.length - 1) {
              // After chart 4, 8, 12, etc (end of group) or last chart
              breakPoints.push(bottomInMm + 5);
              console.log(`📊 PDF Export: Break after chart #${index + 1} at ${(bottomInMm + 5).toFixed(0)}mm`);
            }
          }
        });
        
        console.log(`📊 PDF Export: Detected ${chartCards.length} charts in groups of 4`);
      }
      
      // For monitoring section: add break points before AND after each card
      if (monitoringSection) {
        const monitoringCards = monitoringSection.querySelectorAll('.pdf-monitoring-card');
        monitoringCards.forEach((card, index) => {
          const rect = card.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const relativeTop = rect.top - elementRect.top + element.scrollTop;
          const relativeBottom = relativeTop + rect.height;
          
          const topInMm = relativeTop * scaleFactor;
          const bottomInMm = relativeBottom * scaleFactor;
          
          if (topInMm > 10) {
            // Break BEFORE monitoring card
            breakPoints.push(topInMm);
            // Break AFTER monitoring card
            breakPoints.push(bottomInMm + 3); // 3mm gap
          }
        });
        console.log(`📊 PDF Export: Detected ${monitoringCards.length} monitoring issue cards`);
      }
      
      // Add end point
      breakPoints.push(totalContentHeight);
      
      // Remove duplicates and sort
      const uniqueBreakPoints = Array.from(new Set(breakPoints.map(bp => Math.round(bp * 10) / 10))).sort((a, b) => a - b);
      
      console.log('📊 PDF Export: Found', uniqueBreakPoints.length - 1, 'content sections for intelligent page breaks');
      
      // Generate pages
      while (currentY < totalContentHeight) {
        if (pageCount > 0) {
          pdf.addPage();
        }
        pageCount++;
        
        // Set white background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        
        // Determine how much content to include on this page
        let nextBreak = currentY + contentHeight;
        
        // Find all break points that fit on this page
        const idealBreaks = uniqueBreakPoints.filter(bp => 
          bp > currentY && bp <= currentY + contentHeight
        );
        
        if (idealBreaks.length > 0) {
          // Check each break point from last to first to find one that doesn't split a chart
          let safeBreak = null;
          
          for (let i = idealBreaks.length - 1; i >= 0; i--) {
            const breakPoint = idealBreaks[i];
            let wouldSplitChart = false;
            
            // Check if this break point would split any chart
            for (const chart of chartBoundaries) {
              // A break is unsafe if it's in the middle of a chart
              if (breakPoint > chart.start && breakPoint < chart.end) {
                wouldSplitChart = true;
                console.log(`📊 PDF Export: Break at ${breakPoint.toFixed(0)}mm would split chart #${chart.index + 1}, trying earlier...`);
                break;
              }
            }
            
            if (!wouldSplitChart) {
              safeBreak = breakPoint;
              break;
            }
          }
          
          if (safeBreak !== null) {
            nextBreak = safeBreak;
            console.log(`📊 PDF Export: Page ${pageCount + 1} safe break at ${nextBreak.toFixed(0)}mm`);
          } else {
            // No safe break found, use first break point (will be before any charts)
            nextBreak = idealBreaks[0];
            console.log(`📊 PDF Export: Page ${pageCount + 1} using first available break`);
          }
        } else {
          console.log(`📊 PDF Export: Page ${pageCount + 1} using full page height`);
        }
        
        // Calculate how much of the canvas to show
        const sourceY = currentY / scaleFactor; // Convert back to canvas pixels
        const sourceHeight = Math.min(
          (nextBreak - currentY) / scaleFactor,
          canvas.height - sourceY
        );
        
        if (sourceHeight <= 0) break;
        
        // Create a temporary canvas for this page's content
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const pageCtx = pageCanvas.getContext('2d');
        
        if (pageCtx) {
          // Fill with white background
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          
          // Draw the slice from the main canvas
          pageCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight, // Source rectangle
            0, 0, canvas.width, sourceHeight         // Destination rectangle
          );
          
          // Convert to JPEG and add to PDF with high quality for text preservation
          const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98);
          const pageImgHeight = sourceHeight * scaleFactor;
          
          pdf.addImage(
            pageImgData,
            'JPEG',
            margin,
            margin,
            imgWidth,
            pageImgHeight,
            undefined,
            'FAST'
          );
        }
        
        console.log('📊 PDF Export: Page', pageCount, 'added (', currentY.toFixed(0), 'mm -', nextBreak.toFixed(0), 'mm )');
        
        currentY = nextBreak;
        
        // Yield control back to browser between pages
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      console.log('📊 PDF Export: Saving file with', pageCount, 'pages...');

      pdf.save(`${farmerName}_Phase${phaseNumber}_F100.pdf`);
      
      console.log('✅ PDF Export: Complete!', pageCount, 'pages saved successfully');
      
      toast({
        title: "PDF Downloaded",
        description: `F-100 report for ${farmerName} Phase ${phaseNumber} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('❌ PDF Export Error:', error);
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
        aria-describedby="f100-description"
      >
        <DialogHeader className="sticky top-0 bg-background z-20 pb-4 border-b px-6 pt-6 flex-shrink-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold">
                  Phase {phaseNumber} - F-100 Report
                </DialogTitle>
                <DialogDescription id="f100-description" className="mt-1">
                  {farmerName} - Comprehensive phase overview with charts and monitoring details
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* View Full Page Button */}
                <Button
                  onClick={() => {
                    navigate(`/farmers/${farmerId}/f100/${phaseNumber}`);
                    onClose();
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  title="Open in full page view"
                >
                  <ExternalLink className="h-4 w-4" />
                  Full Page
                </Button>
                
                {/* F100 URL Toggle (Admin only) */}
                {isAdmin && (
                  <Button
                    onClick={() => setIsEditingUrl(!isEditingUrl)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    title="Set F-100 URL"
                  >
                    <LinkIcon className="h-4 w-4" />
                    {phaseData?.f100_url ? 'Edit URL' : 'Set URL'}
                  </Button>
                )}
                
                {/* TODO: Temporarily hidden until PDF generation is fixed and rendering issues are resolved */}
                {/* <Button
                  onClick={handleDownload}
                  disabled={isExporting}
                  className="flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      {phaseData?.f100_url ? (
                        <>
                          <ExternalLink className="h-4 w-4" />
                          Open F-100
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Download PDF
                        </>
                      )}
                    </>
                  )}
                </Button> */}
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

            {/* F100 URL Editor (Admin only) */}
            {isAdmin && isEditingUrl && (
              <div className="space-y-2 p-4 bg-muted/30 rounded-lg border animate-in slide-in-from-top-2 duration-200">
                <Label htmlFor="f100-url" className="text-sm font-medium">
                  F-100 Report URL
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enter an external URL (e.g., Google Docs link) for bank viewers to access the F-100 report. 
                  If specified, the "Download PDF" button will use this URL instead of generating a PDF.
                </p>
                <div className="flex gap-2">
                  <Input
                    id="f100-url"
                    type="url"
                    placeholder="https://docs.google.com/document/d/..."
                    value={f100Url}
                    onChange={(e) => setF100Url(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveUrl}
                    disabled={isSavingUrl}
                    className="flex items-center gap-2"
                  >
                    {isSavingUrl ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditingUrl(false);
                      setF100Url(phaseData?.f100_url || '');
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
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

          <Separator className="pdf-section-break" />

          {/* Charts Section */}
          {charts.length > 0 && (
            <div className="space-y-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="flex items-center justify-between pdf-section-header">
                <h3 className="text-xl font-semibold text-heading-primary">Analytics & Charts</h3>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="pdf-hide-button"
                    onClick={() => {
                      navigate(`/admin/charts/new?farmerId=${farmerId}&phaseNumber=${phaseNumber}`);
                      onClose();
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Add Chart
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {charts.map((chart, chartIndex) => (
                  <Card key={chart.id} className="overflow-hidden pdf-chart-card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{chart.name}</CardTitle>
                          {chart.annotation && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {chart.annotation}
                            </p>
                          )}
                        </div>
                        {isAdmin && chart.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 pdf-hide-button"
                            onClick={() => {
                              navigate(`/admin/charts/${chart.id}?farmerId=${farmerId}&phaseNumber=${phaseNumber}`);
                              onClose();
                            }}
                            title="Edit chart"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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

          <Separator className="pdf-section-break" />

          {/* Monitored Issues Section - Phase Specific (ALL issues including Used Data) */}
          <div className="space-y-4" style={{ pageBreakBefore: 'auto' }}>
            <h3 className="text-xl font-semibold text-heading-primary pdf-section-header">
              Phase {phaseNumber} - Monitoring Details
            </h3>
            {monitoredIssues.length > 0 ? (
              <div className="space-y-6">
                {monitoredIssues.map((issue, index) => {
                  const isUsedData = issue.name === 'Used Data';
                  const showIframes = (issue as PhaseSpecificIssue).show_iframes || false;
                  
                  return (
                    <Card key={issue.id} className="overflow-hidden pdf-monitoring-card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <CardHeader className="bg-muted/30 border-b">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg flex items-center gap-2 flex-1">
                            <span className="text-muted-foreground font-mono text-sm">
                              {index + 1}.
                            </span>
                            {issue.name}
                          </CardTitle>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0 pdf-hide-button"
                              onClick={() => {
                                setSelectedIssue(issue);
                                setIssueEditorOpen(true);
                              }}
                              title="Edit issue description"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {!isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0 pdf-hide-button"
                              onClick={() => {
                                setSelectedIssue(issue);
                                setIssueEditorOpen(true);
                              }}
                              title="View issue details"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        {/* Description */}
                        {(issue as PhaseSpecificIssue).phase_description ? (
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none rich-text-preview"
                            dangerouslySetInnerHTML={{ __html: (issue as PhaseSpecificIssue).phase_description || '' }}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            No description available for this monitoring issue in Phase {phaseNumber}
                          </p>
                        )}

                        {/* Interactive Maps Display (only for Used Data when enabled) */}
                        {isUsedData && showIframes && phaseIframes.length > 0 && (
                          <div className="mt-6 space-y-4 border-t pt-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-base font-bold text-heading-primary flex items-center gap-2">
                                <MapIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                Interactive Maps (Phase {phaseNumber})
                              </h4>
                              <span className="text-xs text-muted-foreground">
                                {phaseIframes.length} map{phaseIframes.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            <div className="space-y-4">
                              {phaseIframes.map((iframe, idx) => {
                                const isCollapsed = collapsedIframes.has(iframe.url);
                                return (
                                  <div key={idx} className="border dark:border-dark-border rounded-lg overflow-hidden bg-card dark:bg-dark-card shadow-sm">
                                    <div 
                                      className="p-4 bg-muted/30 dark:bg-muted/10 border-b border-border/30 cursor-pointer hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors"
                                      onClick={() => toggleIframeCollapse(iframe.url)}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 space-y-1">
                                          <h5 className="text-sm font-bold text-foreground flex items-center gap-2">
                                            {isCollapsed ? (
                                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            )}
                                            <MapIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                            {iframe.name}
                                          </h5>
                                          {iframe.annotation && !isCollapsed && (
                                            <p className="text-xs text-muted-foreground leading-relaxed ml-10">
                                              {iframe.annotation}
                                            </p>
                                          )}
                                        </div>
                                        <a
                                          href={iframe.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                          Open
                                        </a>
                                      </div>
                                    </div>
                                    
                                    {!isCollapsed && (
                                      <div className="w-full bg-white dark:bg-gray-950 animate-in slide-in-from-top-2 duration-300">
                                        <iframe
                                          src={iframe.url}
                                          className="w-full h-[500px]"
                                          title={iframe.name}
                                          loading="lazy"
                                          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Uploaded Maps Display (only for Used Data) */}
                        {isUsedData && uploadedMaps.length > 0 && (
                          <div className="mt-6 space-y-4 border-t pt-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-base font-bold text-heading-primary flex items-center gap-2">
                                <FileImage className="h-5 w-5 text-green-600 dark:text-green-400" />
                                Uploaded Maps & Documents
                              </h4>
                              <span className="text-xs text-muted-foreground">
                                {uploadedMaps.length} file{uploadedMaps.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {uploadedMaps.map((map) => {
                                const isImage = map.file_mime.startsWith('image/');
                                const isPDF = map.file_mime === 'application/pdf';
                                
                                return (
                                  <div 
                                    key={map.id} 
                                    className="group border rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer bg-card"
                                    onClick={() => openFileInViewer(map.file_path, map.file_name)}
                                  >
                                    {/* Thumbnail or Icon */}
                                    <div className="relative aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                                {isImage && map.signedUrl ? (
                                  <img
                                    src={map.signedUrl}
                                    alt={map.file_name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                    onError={(e) => {
                                      // Fallback to icon on image load error
                                      e.currentTarget.style.display = 'none';
                                      const parent = e.currentTarget.parentElement;
                                      if (parent) {
                                        parent.innerHTML = '<div class="flex flex-col items-center justify-center gap-2 p-4"><svg class="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span class="text-xs text-muted-foreground">Image unavailable</span></div>';
                                      }
                                    }}
                                  />
                                ) : isPDF ? (
                                        <div className="flex flex-col items-center justify-center gap-2 p-6">
                                          <FileTextIcon className="h-16 w-16 text-red-600 dark:text-red-400" />
                                          <span className="text-xs text-muted-foreground font-medium">PDF Document</span>
                                        </div>
                                      ) : (
                                        <FileImage className="h-16 w-16 text-gray-600 dark:text-gray-400" />
                                      )}
                                      
                                      {/* Overlay on hover */}
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="flex items-center gap-2 text-white">
                                          <ExternalLink className="h-5 w-5" />
                                          <span className="text-sm font-medium">Open</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* File Info */}
                                    <div className="p-3 space-y-1 bg-card">
                                      <p className="text-sm font-medium text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {map.file_name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatFileSize(map.file_size_bytes)} • {new Date(map.created_at).toLocaleDateString()}
                                      </p>
                                      {map.annotation && (
                                        <p className="text-xs text-muted-foreground italic">{map.annotation}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
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

        {/* Monitored Issue Editor (Admin can edit, Bank Viewer can view) */}
        <MonitoredIssueEditor
          isOpen={issueEditorOpen}
          onClose={() => {
            setIssueEditorOpen(false);
            setSelectedIssue(null);
            // Refresh monitored issues after editing
            queryClient.invalidateQueries({ queryKey: ['phase-monitored-issues', farmerId, phaseNumber] });
          }}
          issue={selectedIssue}
          farmerId={farmerId}
          phaseNumber={phaseNumber}
          readOnly={!isAdmin}
        />
      </DialogContent>
      {/* Rich Text Preview Styles */}
      <style>{`
        .rich-text-preview h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.67em;
          margin-bottom: 0.67em;
          line-height: 1.2;
          color: hsl(var(--foreground));
        }
        
        .rich-text-preview h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.83em;
          margin-bottom: 0.83em;
          line-height: 1.3;
          color: hsl(var(--foreground));
        }
        
        .rich-text-preview h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 1em;
          color: hsl(var(--foreground));
        }
        
        .rich-text-preview p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          color: hsl(var(--foreground));
        }
        
        .rich-text-preview ul,
        .rich-text-preview ol {
          padding-left: 1.5em;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        
        .rich-text-preview ul {
          list-style-type: disc;
        }
        
        .rich-text-preview ol {
          list-style-type: decimal;
        }
        
        .rich-text-preview li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
          color: hsl(var(--foreground));
        }
        
        .rich-text-preview strong {
          font-weight: bold;
        }
        
        .rich-text-preview em {
          font-style: italic;
        }
        
        .rich-text-preview s {
          text-decoration: line-through;
        }
        
        .rich-text-preview hr {
          border: none;
          border-top: 2px solid hsl(var(--border));
          margin: 1.5em 0;
        }
        
        .rich-text-preview table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1em 0;
          overflow: hidden;
        }
        
        .rich-text-preview table td,
        .rich-text-preview table th {
          min-width: 1em;
          border: 2px solid hsl(var(--border));
          padding: 0.5em 0.75em;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          background-color: hsl(var(--background));
          color: hsl(var(--foreground));
        }
        
        .rich-text-preview table th {
          font-weight: bold;
          text-align: left;
          background-color: hsl(var(--muted));
        }
        
        .rich-text-preview blockquote {
          border-left: 4px solid hsl(var(--border));
          padding-left: 1em;
          margin: 1em 0;
          color: hsl(var(--muted-foreground));
          font-style: italic;
        }
      `}</style>
    </Dialog>
  );
};


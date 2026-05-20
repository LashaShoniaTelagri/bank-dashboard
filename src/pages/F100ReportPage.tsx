import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Download, 
  Loader2, 
  ArrowLeft, 
  Edit, 
  Map as MapIcon, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  FileText as FileTextIcon, 
  Image as ImageIcon, 
  FileImage,
  Link as LinkIcon,
  Save
} from "lucide-react";
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

interface PhaseSpecificIssue extends MonitoredIssue {
  phase_description?: string | null;
  show_iframes?: boolean;
}

export const F100ReportPage = () => {
  const { farmerId, phaseNumber } = useParams<{ farmerId: string; phaseNumber: string }>();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const isDark = theme === 'dark';
  const phase = parseInt(phaseNumber || '1');
  
  // Monitored issue editor state
  const [issueEditorOpen, setIssueEditorOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<MonitoredIssue | null>(null);
  
  // Used Data display state
  const [collapsedIframes, setCollapsedIframes] = useState<Set<string>>(new Set());
  
  // F100 URL state (admin only)
  const [f100Url, setF100Url] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/auth');
    }
  }, [authLoading, profile, navigate]);

  // Fetch farmer data
  const { data: farmer } = useQuery({
    queryKey: ['farmer', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmers')
        .select('name')
        .eq('id', farmerId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!farmerId,
  });

  const farmerName = farmer?.name || 'Farmer';

  // Fetch phase data
  const { data: phaseData } = useQuery({
    queryKey: ['farmer-phase', farmerId, phase],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('farmer_phases' as any)
        .select('issue_date, score, f100_url')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phase)
        .maybeSingle() as any);

      if (error) {
        console.error('Error fetching phase data:', error);
        return null;
      }

      return data;
    },
    enabled: !!farmerId && !!phase,
  });

  // Load F100 URL
  useEffect(() => {
    if (phaseData?.f100_url) {
      setF100Url(phaseData.f100_url);
    } else {
      setF100Url('');
    }
  }, [phaseData]);

  // Save F100 URL mutation
  const saveF100UrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await (supabase
        .from('farmer_phases' as any)
        .update({ f100_url: url.trim() || null })
        .eq('farmer_id', farmerId)
        .eq('phase_number', phase) as any);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "F-100 URL saved successfully",
      });
      setIsEditingUrl(false);
      queryClient.invalidateQueries({ queryKey: ['farmer-phase', farmerId, phase] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save F-100 URL",
        variant: "destructive",
      });
    },
  });

  const handleSaveUrl = () => {
    saveF100UrlMutation.mutate(f100Url);
  };

  // Fetch charts
  const { data: charts = [] } = useQuery<ChartTemplate[]>({
    queryKey: ['f100-charts', farmerId, phase],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('chart_templates' as any)
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('is_active', true)
        .or(`phase_number.is.null,phase_number.eq.${phase}`)
        .order('display_order', { ascending: true }) as any);

      if (error) throw error;
      
      const charts = (data || []) as unknown as ChartTemplate[];
      return charts.sort((a, b) => {
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });
    },
    enabled: !!farmerId && !!phase,
  });

  // Fetch monitored issues
  const { data: monitoredIssues = [] } = useQuery<PhaseSpecificIssue[]>({
    queryKey: ['phase-monitored-issues', farmerId, phase],
    queryFn: async () => {
      const { data: allIssues, error } = await supabase
        .from('monitored_issues')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) return [];
      if (!allIssues) return [];

      const { data: phaseData } = await (supabase
        .from('phase_monitored_data' as any)
        .select('issue_id, description, show_iframes')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phase) as any);

      const descriptionMap = new Map<string, string | null>();
      const iframesMap = new Map<string, boolean>();
      
      if (phaseData) {
        phaseData.forEach((item: any) => {
          descriptionMap.set(item.issue_id, item.description || null);
          iframesMap.set(item.issue_id, item.show_iframes || false);
        });
      }

      return allIssues.map((issue) => ({
        ...issue,
        phase_description: descriptionMap.get(issue.id) || null,
        show_iframes: iframesMap.get(issue.id) || false,
      }));
    },
    enabled: !!farmerId && !!phase,
  });

  // Fetch phase iframes
  const { data: phaseIframes = [] } = useQuery({
    queryKey: ['farmer-phase-iframes', farmerId, phase],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('farmer_phases' as any)
        .select('iframe_urls')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phase)
        .single() as any);
      
      if (error && error.code !== 'PGRST116') return [];
      
      return ((data as any)?.iframe_urls as Array<{ url: string; name: string; annotation?: string }>) || [];
    },
    enabled: !!farmerId && !!phase,
  }) as { data: Array<{ url: string; name: string; annotation?: string }> };

  // Fetch uploaded maps
  const { data: uploadedMaps = [] } = useQuery({
    queryKey: ['phase-used-data-maps', farmerId, phase],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('phase_used_data_maps' as any)
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phase)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true}) as any);
      
      if (error) return [];
      
      const mapsWithUrls = await Promise.all(
        (data || []).map(async (map: any) => {
          const { data: signedData } = await supabase.storage
            .from('farmer-documents')
            .createSignedUrl(map.file_path, 3600);
          
          return { ...map, signedUrl: signedData?.signedUrl };
        })
      );
      
      return mapsWithUrls;
    },
    enabled: !!farmerId && !!phase,
  }) as { data: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_mime: string;
    file_size_bytes: number;
    annotation?: string;
    signedUrl?: string | null;
  }> };

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

  const openFileInViewer = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('farmer-documents')
        .createSignedUrl(filePath, 3600);
      
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

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    toast({
      title: "Generating PDF",
      description: "Please wait while we generate your F-100 report...",
    });

    try {
      const element = document.getElementById('f100-report-content');
      if (!element) throw new Error('Content element not found');

      // Store scroll position
      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 300));

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
          const clonedElement = clonedDoc.getElementById('f100-report-content');
          if (clonedElement) {
            // Remove dark theme
            clonedElement.classList.remove('dark');
            clonedDoc.documentElement.classList.remove('dark');
            clonedDoc.body.classList.remove('dark');
            
            // Hide buttons
            const buttons = clonedElement.querySelectorAll('.pdf-hide-button');
            buttons.forEach((btn: Element) => {
              (btn as HTMLElement).style.display = 'none';
            });
            
            // Fix text spacing
            const allElements = clonedElement.querySelectorAll('*');
            allElements.forEach((el: Element) => {
              const htmlEl = el as HTMLElement;
              const computedStyle = window.getComputedStyle(htmlEl);
              const tagName = htmlEl.tagName.toLowerCase();
              
              htmlEl.style.letterSpacing = '0.02em';
              htmlEl.style.wordSpacing = '0.15em';
              htmlEl.style.whiteSpace = 'normal';
              htmlEl.style.textRendering = 'optimizeLegibility';
              
              if (['p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tagName)) {
                htmlEl.style.lineHeight = '1.6';
                if (computedStyle.display === 'inline') {
                  htmlEl.style.display = 'inline-block';
                }
              }
              
              if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                htmlEl.style.letterSpacing = '0.03em';
                htmlEl.style.wordSpacing = '0.2em';
                htmlEl.style.display = 'block';
                htmlEl.style.width = '100%';
              }
            });
          }
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const imgWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        pdf.addImage(imgData, 'JPEG', margin, position + margin, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pdfHeight - margin * 2);
      }

      pdf.save(`${farmerName}_Phase${phase}_F100.pdf`);
      
      // Restore scroll
      window.scrollTo(0, originalScrollY);
      
      toast({
        title: "PDF Downloaded",
        description: `F-100 report for ${farmerName} Phase ${phase} downloaded successfully.`,
      });
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast({
        title: "PDF Export Failed",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (phaseData?.f100_url) {
      window.open(phaseData.f100_url, '_blank', 'noopener,noreferrer');
    } else {
      handleDownloadPDF();
    }
  };

  // Render chart - full implementation with all chart types
  const renderChart = (chart: ChartTemplate) => {
    const data = chart.chart_data.data || [];
    const xAxisKey = chart.chart_data.xAxisKey || 'name';
    const yAxisKey = chart.chart_data.yAxisKey || 'value';
    const dataKeys = chart.chart_data.dataKeys || [yAxisKey];
    const seriesColors = chart.chart_data.seriesColors || {};
    const dataPointColors = chart.chart_data.dataPointColors || {};
    const valueType = chart.chart_data.valueType || 'numeric';
    const brandColors = getChartColorArray(false);
    
    const valueSuffix = valueType === 'percentage' ? '%' : '';
    const yAxisMin = chart.chart_data.minScore ?? 0;
    const yAxisMax = chart.chart_data.maxScore ?? (valueType === 'percentage' ? 100 : 10);

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
        const gaugeValue = data.length > 0 ? (data[0][yAxisKey] as number || 0) : 0;
        const maxValue = chart.chart_data.maxScore ?? (valueType === 'percentage' ? 100 : 10);
        const gaugePercentage = Math.min(Math.max((gaugeValue / maxValue) * 100, 0), 100);
        const needleAngle = -90 + (gaugePercentage / 100) * 180;
        
        const gaugeSegments = [
          { start: 0, end: 60, color: '#dc2626' },
          { start: 60, end: 80, color: '#ea580c' },
          { start: 80, end: 100, color: '#16a34a' },
        ];

        const percentageToAngle = (pct: number) => 180 - (pct / 100) * 180;
        
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
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="20"
                strokeLinecap="round"
                opacity="0.5"
              />
              
              {gaugeSegments.map((segment, index) => {
                const startAngle = percentageToAngle(segment.end);
                const endAngle = percentageToAngle(segment.start);
                const startPoint = getArcPoint(startAngle, 80);
                const endPoint = getArcPoint(endAngle, 80);
                const sweepFlag = 0;
                
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <Button
                  onClick={() => navigate(`/farmers/${farmerId}`)}
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-heading-primary truncate">
                    Phase {phase} - F-100 Report
                  </h1>
                  <p className="text-sm text-muted-foreground truncate">
                    {farmerName}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin && (
                  <Button
                    onClick={() => setIsEditingUrl(!isEditingUrl)}
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                  >
                    <LinkIcon className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{f100Url ? 'Edit URL' : 'Set URL'}</span>
                  </Button>
                )}
                
                {/* TODO: Temporarily hidden until PDF generation is fixed and rendering issues are resolved */}
                {/* <Button
                  onClick={handleDownload}
                  disabled={isExporting}
                  size="sm"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                      <span className="hidden sm:inline">Generating...</span>
                    </>
                  ) : (
                    <>
                      {phaseData?.f100_url ? (
                        <>
                          <ExternalLink className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Open F-100</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Download PDF</span>
                        </>
                      )}
                    </>
                  )}
                </Button> */}
              </div>
            </div>

            {/* URL Editor */}
            {isAdmin && isEditingUrl && (
              <div className="p-4 bg-muted/30 rounded-lg border animate-in slide-in-from-top-2">
                <Label className="text-sm font-medium mb-2 block">F-100 Report URL</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Enter an external URL for bank viewers to access instead of PDF.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://docs.google.com/document/d/..."
                    value={f100Url}
                    onChange={(e) => setF100Url(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveUrl}
                    disabled={saveF100UrlMutation.isPending}
                    size="sm"
                  >
                    {saveF100UrlMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
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
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div id="f100-report-content" className="container mx-auto px-4 sm:px-6 py-8 space-y-8 max-w-7xl">
        {/* Title Section */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-heading-primary">{farmerName}</h2>
          <h3 className="text-xl text-muted-foreground">Phase {phase} Overview</h3>
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
          <div className="space-y-4">
            <div className="flex items-center justify-between pdf-section-header">
              <h3 className="text-xl font-semibold text-heading-primary">Analytics & Charts</h3>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="pdf-hide-button"
                  onClick={() => navigate(`/admin/charts/new?farmerId=${farmerId}&phaseNumber=${phase}`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Add Chart
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {charts.map((chart) => (
                <Card key={chart.id} className="overflow-hidden pdf-chart-card">
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
                          onClick={() => navigate(`/admin/charts/${chart.id}?farmerId=${farmerId}&phaseNumber=${phase}`)}
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

        <Separator className="pdf-section-break" />

        {/* Monitored Issues Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-heading-primary pdf-section-header">
            Phase {phase} - Monitoring Details
          </h3>
          {monitoredIssues.length > 0 ? (
            <div className="space-y-6">
              {monitoredIssues.map((issue, index) => {
                const isUsedData = issue.name === 'Used Data';
                const showIframes = (issue as PhaseSpecificIssue).show_iframes || false;
                
                return (
                  <Card key={issue.id} className="overflow-hidden pdf-monitoring-card">
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
                            title="Edit issue"
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
                            title="View issue"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      {(issue as PhaseSpecificIssue).phase_description ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: (issue as PhaseSpecificIssue).phase_description || '' }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No description available
                        </p>
                      )}

                      {/* Interactive Maps */}
                      {isUsedData && showIframes && phaseIframes.length > 0 && (
                        <div className="mt-6 space-y-4 border-t pt-4">
                          <h4 className="text-base font-bold flex items-center gap-2">
                            <MapIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            Interactive Maps
                          </h4>
                          <div className="space-y-4">
                            {phaseIframes.map((iframe, idx) => {
                              const isCollapsed = collapsedIframes.has(iframe.url);
                              return (
                                <div key={idx} className="border rounded-lg overflow-hidden">
                                  <div 
                                    className="p-4 bg-muted/30 cursor-pointer hover:bg-muted/40"
                                    onClick={() => toggleIframeCollapse(iframe.url)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-bold flex items-center gap-2">
                                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        {iframe.name}
                                      </h5>
                                      <a
                                        href={iframe.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Open
                                      </a>
                                    </div>
                                  </div>
                                  {!isCollapsed && (
                                    <iframe
                                      src={iframe.url}
                                      className="w-full h-[500px]"
                                      title={iframe.name}
                                      loading="lazy"
                                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Uploaded Maps */}
                      {isUsedData && uploadedMaps.length > 0 && (
                        <div className="mt-6 space-y-4 border-t pt-4">
                          <h4 className="text-base font-bold flex items-center gap-2">
                            <FileImage className="h-5 w-5 text-green-600 dark:text-green-400" />
                            Uploaded Maps & Documents
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {uploadedMaps.map((map) => {
                              const isImage = map.file_mime.startsWith('image/');
                              const isPDF = map.file_mime === 'application/pdf';
                              
                              return (
                                <div 
                                  key={map.id} 
                                  className="group border rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                                  onClick={() => openFileInViewer(map.file_path, map.file_name)}
                                >
                                  <div className="relative aspect-video bg-muted/30 flex items-center justify-center">
                                    {isImage && map.signedUrl ? (
                                      <img
                                        src={map.signedUrl}
                                        alt={map.file_name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        loading="lazy"
                                      />
                                    ) : isPDF ? (
                                      <div className="flex flex-col items-center gap-2">
                                        <FileTextIcon className="h-16 w-16 text-red-600 dark:text-red-400" />
                                        <span className="text-xs text-muted-foreground">PDF</span>
                                      </div>
                                    ) : (
                                      <FileImage className="h-16 w-16 text-gray-600" />
                                    )}
                                    
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <div className="flex items-center gap-2 text-white">
                                        <ExternalLink className="h-5 w-5" />
                                        <span>Open</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-3">
                                    <p className="text-sm font-medium truncate">{map.file_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(map.file_size_bytes)}
                                    </p>
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
              <p className="text-muted-foreground">No monitoring data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Monitored Issue Editor */}
      <MonitoredIssueEditor
        isOpen={issueEditorOpen}
        onClose={() => {
          setIssueEditorOpen(false);
          setSelectedIssue(null);
          queryClient.invalidateQueries({ queryKey: ['phase-monitored-issues'] });
        }}
        issue={selectedIssue}
        farmerId={farmerId}
        phaseNumber={phase}
        readOnly={!isAdmin}
      />
    </div>
  );
};

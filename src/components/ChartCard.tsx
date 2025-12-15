import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, MoreVertical, Maximize2, Edit, GripVertical, Trash2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ChartTemplate } from "@/types/chart";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { ChartFullscreenModal } from "@/components/ChartFullscreenModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type ChartSize = "small" | "medium" | "large" | "full";

const CHART_SIZES = {
  small: { height: "h-[250px]", span: "col-span-1" },
  medium: { height: "h-[300px] [@media(min-height:780px)]:h-[450px]", span: "col-span-1" },
  large: { height: "h-[550px]", span: "col-span-1 lg:col-span-2" },
  full: { height: "h-[650px]", span: "col-span-1 lg:col-span-2" },
};

interface ChartCardProps {
  chart: ChartTemplate;
  children: React.ReactNode;
  defaultSize?: ChartSize;
  renderChart?: (chart: ChartTemplate, isFullscreen?: boolean) => React.ReactNode;
  dragHandleProps?: {
    attributes: any;
    listeners: any;
  };
  isAdmin?: boolean;
}

export const ChartCard = ({ chart, children, defaultSize = "medium", renderChart, dragHandleProps, isAdmin }: ChartCardProps) => {
  const [size, setSize] = useState<ChartSize>(defaultSize);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Use prop isAdmin if provided, otherwise check auth (for backward compatibility)
  const effectiveIsAdmin = isAdmin !== undefined ? isAdmin : profile?.role === 'admin';

  // CROSS-47: Delete chart mutation
  const deleteMutation = useMutation({
    mutationFn: async (chartId: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('chart_templates')
        .update({ is_active: false })
        .eq('id', chartId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-templates'] });
      queryClient.invalidateQueries({ queryKey: ['f100-charts'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-charts'] });
      toast({
        title: "Chart deleted successfully",
        description: "The chart has been removed.",
      });
      setDeleteConfirmOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting chart",
        description: error.message || "Failed to delete chart",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (chart.id) {
      deleteMutation.mutate(chart.id);
    }
  };

  const exportAsImage = async () => {
    if (!chartRef.current) return;

    try {
      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Force SVG elements to render
      const svgElements = chartRef.current.querySelectorAll('svg');
      svgElements.forEach((svg) => {
        window.getComputedStyle(svg).getPropertyValue('width');
      });

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        logging: false,
        onclone: (clonedDoc) => {
          // Force light theme for consistent rendering
          const clonedElements = clonedDoc.querySelectorAll('*');
          clonedElements.forEach((el) => {
            el.classList.remove('dark');
          });
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');

          // Fix SVG colors
          const svgTexts = clonedDoc.querySelectorAll('svg text');
          svgTexts.forEach((text: Element) => {
            const svgText = text as SVGTextElement;
            const fill = svgText.getAttribute('fill');
            if (!fill || fill === 'currentColor' || fill.includes('var(')) {
              svgText.setAttribute('fill', '#000000');
            }
          });

          const svgShapes = clonedDoc.querySelectorAll('svg path, svg rect, svg circle, svg line');
          svgShapes.forEach((shape: Element) => {
            const svgShape = shape as SVGElement;
            const stroke = svgShape.getAttribute('stroke');
            if (stroke && (stroke === 'currentColor' || stroke.includes('var('))) {
              svgShape.setAttribute('stroke', '#666666');
            }
          });
        },
      });

      const link = document.createElement("a");
      link.download = `${chart.name.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png", 1.0);
      link.click();

      toast({
        title: "Chart exported",
        description: `${chart.name} has been downloaded as an image.`,
      });
    } catch (error) {
      console.error("❌ Error exporting chart:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export chart as image.",
        variant: "destructive",
      });
    }
  };

  const exportAsPDF = async () => {
    if (!chartRef.current) return;

    try {
      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Force SVG elements to render
      const svgElements = chartRef.current.querySelectorAll('svg');
      svgElements.forEach((svg) => {
        window.getComputedStyle(svg).getPropertyValue('width');
      });

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        imageTimeout: 15000,
        removeContainer: true,
        logging: false,
        onclone: (clonedDoc) => {
          // Force light theme for consistent rendering
          const clonedElements = clonedDoc.querySelectorAll('*');
          clonedElements.forEach((el) => {
            el.classList.remove('dark');
          });
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');

          // Fix SVG colors
          const svgTexts = clonedDoc.querySelectorAll('svg text');
          svgTexts.forEach((text: Element) => {
            const svgText = text as SVGTextElement;
            const fill = svgText.getAttribute('fill');
            if (!fill || fill === 'currentColor' || fill.includes('var(')) {
              svgText.setAttribute('fill', '#000000');
            }
          });

          const svgShapes = clonedDoc.querySelectorAll('svg path, svg rect, svg circle, svg line');
          svgShapes.forEach((shape: Element) => {
            const svgShape = shape as SVGElement;
            const stroke = svgShape.getAttribute('stroke');
            if (stroke && (stroke === 'currentColor' || stroke.includes('var('))) {
              svgShape.setAttribute('stroke', '#666666');
            }
          });
        },
      });

      // Verify canvas has content
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Generated canvas is empty');
      }

      const imgData = canvas.toDataURL("image/png", 1.0);

      if (!imgData || imgData === 'data:,') {
        throw new Error('Failed to generate image data');
      }

      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true,
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height, undefined, 'FAST');
      pdf.save(`${chart.name.replace(/\s+/g, "_")}.pdf`);

      toast({
        title: "Chart exported",
        description: `${chart.name} has been downloaded as a PDF.`,
      });
    } catch (error) {
      console.error("❌ Error exporting chart:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export chart as PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card className={`${CHART_SIZES[size].span} transition-all duration-300 hover:shadow-lg`}>
        <CardHeader className="pb-2 px-4 py-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold text-heading-primary truncate flex-1">
            {chart.name}
          </CardTitle>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Drag Handle - Admin Only */}
            {effectiveIsAdmin && dragHandleProps && (
              <div
                {...dragHandleProps.attributes}
                {...dragHandleProps.listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            )}

            {/* Fullscreen Button */}
            {renderChart && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setFullscreenOpen(true)}
                title="View fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}

            {/* More Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportAsImage}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>

                {effectiveIsAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate(`/admin/charts/${chart.id}`)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Chart
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDeleteClick}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Chart
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="flex flex-col px-1 pb-4 overflow-hidden">
          {/* Top Annotation */}
          {chart.annotation && (
            <p className="text-xs text-muted-foreground mb-1 px-2 line-clamp-2">
              {chart.annotation}
            </p>
          )}
          
          {/* Chart Area */}
          <div className={`${CHART_SIZES[size].height} overflow-hidden`}>
            <div ref={chartRef} className="h-full w-full overflow-visible" style={{ minHeight: '280px', padding: '4px 4px 40px 4px' }}>
              {children}
            </div>
          </div>
          
          {/* Bottom Description */}
          {chart.bottom_description && (
            <div className="mt-2 px-4 overflow-auto max-h-[200px]">
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground"
                dangerouslySetInnerHTML={{ __html: chart.bottom_description }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fullscreen Modal */}
      {renderChart && (
        <ChartFullscreenModal
          isOpen={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          chart={chart}
          renderChart={renderChart}
        />
      )}

      {/* CROSS-47: Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{chart.name}"? This action cannot be undone.
              The chart will be removed from all farmer profiles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

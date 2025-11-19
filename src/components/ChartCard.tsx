import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Download, MoreVertical, Maximize2, Edit, GripVertical } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ChartTemplate } from "@/types/chart";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { ChartFullscreenModal } from "@/components/ChartFullscreenModal";

type ChartSize = "small" | "medium" | "large" | "full";

const CHART_SIZES = {
  small: { height: "h-[280px]", span: "col-span-1" },
  medium: { height: "h-[350px]", span: "col-span-1" },
  large: { height: "h-[450px]", span: "col-span-1 sm:col-span-2" },
  full: { height: "h-[500px]", span: "col-span-1 sm:col-span-2 lg:col-span-3" },
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
  const chartRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // Use prop isAdmin if provided, otherwise check auth (for backward compatibility)
  const effectiveIsAdmin = isAdmin !== undefined ? isAdmin : profile?.role === 'admin';

  const exportAsImage = async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: null,
        scale: 2,
      });

      const link = document.createElement("a");
      link.download = `${chart.name.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast({
        title: "Chart exported",
        description: `${chart.name} has been downloaded as an image.`,
      });
    } catch (error) {
      console.error("Error exporting chart:", error);
      toast({
        title: "Export failed",
        description: "Failed to export chart as image.",
        variant: "destructive",
      });
    }
  };

  const exportAsPDF = async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${chart.name.replace(/\s+/g, "_")}.pdf`);

      toast({
        title: "Chart exported",
        description: `${chart.name} has been downloaded as a PDF.`,
      });
    } catch (error) {
      console.error("Error exporting chart:", error);
      toast({
        title: "Export failed",
        description: "Failed to export chart as PDF.",
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
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className={`${CHART_SIZES[size].height} overflow-hidden px-2 py-1`}>
          {chart.annotation && (
            <p className="text-xs text-muted-foreground mb-2 px-2">
              {chart.annotation}
            </p>
          )}
          <div ref={chartRef} className="h-full w-full" style={{ minHeight: '200px' }}>
            {children}
          </div>
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
    </>
  );
};

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChartTemplate } from "@/types/chart";
import { useEffect } from "react";

interface ChartFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  chart: ChartTemplate;
  renderChart: (chart: ChartTemplate, isFullscreen?: boolean) => React.ReactNode;
}

export const ChartFullscreenModal = ({ 
  isOpen, 
  onClose, 
  chart, 
  renderChart 
}: ChartFullscreenModalProps) => {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body scroll
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        aria-describedby="fullscreen-chart-description"
      >
        {/* Header - Compact */}
        <div className="px-6 pt-4 pb-3 border-b border-border flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-heading-primary">
              {chart.name}
            </DialogTitle>
            {chart.annotation && (
              <DialogDescription id="fullscreen-chart-description" className="text-xs text-muted-foreground mt-1">
                {chart.annotation}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        {/* Chart Content - No Scroll, Fit to View */}
        <div className="flex-1 px-6 py-4 overflow-hidden flex flex-col">
          {/* Chart - Takes available space */}
          <div className="flex-1 w-full min-h-0 flex items-center justify-center">
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ 
                zoom: chart.chart_type === 'pie' || chart.chart_type === 'donut' ? 0.8 : 1
              }}
            >
              {renderChart(chart, true)}
            </div>
          </div>
          
          {/* Bottom Description - Compact, always visible */}
          {chart.bottom_description && (
            <div className="w-full max-w-4xl mx-auto mt-3 flex-shrink-0">
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground line-clamp-3"
                dangerouslySetInnerHTML={{ __html: chart.bottom_description }}
              />
            </div>
          )}
        </div>

        {/* Footer - Compact */}
        <div className="px-6 py-2 border-t border-border bg-muted/30 text-center flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs font-mono">Esc</kbd> to exit
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

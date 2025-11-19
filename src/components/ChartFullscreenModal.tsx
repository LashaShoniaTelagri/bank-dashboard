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
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-heading-primary">
              {chart.name}
            </DialogTitle>
            <DialogDescription id="fullscreen-chart-description" className="text-sm text-muted-foreground mt-2">
              {chart.annotation || "Fullscreen view of the chart for detailed analysis"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Chart Content - Fixed Size Container */}
        <div className="flex-1 px-6 py-4 overflow-auto flex items-center justify-center">
          <div 
            className="w-full"
            style={{ height: '600px', maxWidth: '100%' }}
          >
            <div className="h-full w-full">
              {renderChart(chart, true)}
            </div>
          </div>
        </div>

        {/* Footer with hint */}
        <div className="px-6 py-3 border-t border-border bg-muted/30 text-center flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-2 py-1 bg-background border border-border rounded text-xs font-mono">Esc</kbd> or click the close button (×) to exit fullscreen
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

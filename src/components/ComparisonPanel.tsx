import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  X,
  GitCompare,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  PanelRightOpen,
} from "lucide-react";
import { ComparisonSelection, MonitoredIssue } from "@/types/phase";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { OrchardMapViewer } from "@/components/OrchardMapViewer";

type PanelWidth = 'compact' | 'half' | 'full';

const PANEL_WIDTHS: Record<PanelWidth, string> = {
  compact: 'w-80',    // 320px - default
  half: 'w-1/2',      // 50% - side-by-side comparison
  full: 'w-[90%]',    // 90% - full content view
};

interface ComparisonPanelProps {
  selections: ComparisonSelection[];
  monitoredIssues: MonitoredIssue[];
  farmerId?: string;
  onRemove: (phaseNumber: number, issueId: string) => void;
  onClear: () => void;
  onViewDetails: (issueId: string) => void;
}

export const ComparisonPanel = ({
  selections,
  monitoredIssues,
  farmerId,
  onRemove,
  onClear,
  onViewDetails,
}: ComparisonPanelProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [panelWidth, setPanelWidth] = useState<PanelWidth>('compact');
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  // Fetch phase-specific descriptions for all selected phase-issue combinations
  const { data: phaseDescriptions = {} } = useQuery({
    queryKey: ['phase-descriptions', farmerId, selections],
    queryFn: async () => {
      if (!farmerId || selections.length === 0) return {};
      
      const descriptions: Record<string, string> = {};
      
      for (const selection of selections) {
        const { data, error } = await supabase
          .from('phase_monitored_data')
          .select('description')
          .eq('farmer_id', farmerId)
          .eq('phase_number', selection.phaseNumber)
          .eq('issue_id', selection.issueId)
          .maybeSingle();
        
        if (!error && data?.description) {
          const key = `${selection.phaseNumber}-${selection.issueId}`;
          descriptions[key] = data.description;
        }
      }
      
      return descriptions;
    },
    enabled: !!farmerId && selections.length > 0,
  });

  const toggleIssueExpansion = (issueId: string) => {
    setExpandedIssues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(issueId)) {
        newSet.delete(issueId);
      } else {
        newSet.add(issueId);
      }
      return newSet;
    });
  };

  const cycleWidth = () => {
    setPanelWidth(current => {
      if (current === 'compact') return 'half';
      if (current === 'half') return 'full';
      return 'compact';
    });
  };

  const getWidthIcon = () => {
    if (panelWidth === 'compact') return <PanelRightOpen className="h-4 w-4" />;
    if (panelWidth === 'half') return <Maximize2 className="h-4 w-4" />;
    return <Minimize2 className="h-4 w-4" />;
  };

  const getWidthLabel = () => {
    if (panelWidth === 'compact') return 'Expand to Half';
    if (panelWidth === 'half') return 'Expand to Full';
    return 'Compact View';
  };

  // Auto-expand descriptions and set half-width when comparing 2+ items
  useEffect(() => {
    if (selections.length >= 2 && !hasAutoExpanded) {
      // Expand all issues
      const allIssueIds = new Set(selections.map(s => s.issueId));
      setExpandedIssues(allIssueIds);
      
      // Set panel to half width
      setPanelWidth('half');
      
      // Mark as auto-expanded to prevent re-triggering
      setHasAutoExpanded(true);
    } else if (selections.length < 2) {
      // Reset when selections drop below 2
      setHasAutoExpanded(false);
      setExpandedIssues(new Set());
      setPanelWidth('compact');
    }
  }, [selections.length, hasAutoExpanded]);

  const getIssueDetails = (issueId: string) => {
    return monitoredIssues.find((issue) => issue.id === issueId);
  };

  const groupedByIssue = selections.reduce((acc, selection) => {
    if (!acc[selection.issueId]) {
      acc[selection.issueId] = [];
    }
    acc[selection.issueId].push(selection);
    return acc;
  }, {} as Record<string, ComparisonSelection[]>);

  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
    if (score >= 8) return "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200";
    if (score >= 6) return "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200";
    return "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200";
  };

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ease-in-out">
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsCollapsed(false)}
          className="rounded-r-none rounded-l-lg shadow-lg bg-emerald-600 hover:bg-emerald-700 transition-all duration-200 hover:scale-105"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Compare ({selections.length})
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "fixed right-0 top-20 bottom-0 z-40 bg-background border-l border-border shadow-2xl transition-all duration-300 ease-in-out",
        PANEL_WIDTHS[panelWidth]
      )}
      style={{
        animation: 'slideInFromRight 0.3s ease-out'
      }}
    >
      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <Card className="h-full rounded-none border-0">
        <CardHeader className="border-b border-border flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">
                Comparison Panel
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {panelWidth === 'compact' ? 'Compact' : panelWidth === 'half' ? 'Half Screen' : 'Full Width'}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleWidth}
                className="h-8 w-8 transition-all duration-200 hover:scale-110"
                title={getWidthLabel()}
              >
                {getWidthIcon()}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(true)}
                className="h-8 w-8 transition-all duration-200 hover:scale-110"
                title="Collapse panel"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <Badge variant="secondary" className="text-xs">
              {selections.length} {selections.length === 1 ? 'item' : 'items'} selected
            </Badge>
            {selections.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 hover:scale-105"
              >
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-200px)]">
          <CardContent className="p-4 space-y-4">
            {selections.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  No items selected for comparison
                </p>
                <p className="text-xs text-muted-foreground">
                  Click on monitored issues in phase cards to compare
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedByIssue).map(([issueId, items]) => {
                  const issue = getIssueDetails(issueId);
                  if (!issue) return null;

                  return (
                    <Card 
                      key={issueId} 
                      className="overflow-hidden transition-all duration-200 hover:shadow-md"
                    >
                      <CardHeader className="pb-3 pt-3 px-3 bg-muted/30 transition-colors duration-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                              {issue.name}
                            </h4>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => toggleIssueExpansion(issueId)}
                              className="h-auto p-0 text-xs text-emerald-600 hover:text-emerald-700 transition-all duration-200 hover:underline flex items-center gap-1"
                            >
                              {expandedIssues.has(issueId) ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  View Details
                                </>
                              )}
                            </Button>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {items.length} {items.length === 1 ? 'phase' : 'phases'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-2 space-y-2">
                        {/* Phase list */}
                        {items.sort((a, b) => a.phaseNumber - b.phaseNumber).map((item, index) => {
                          return (
                            <div
                              key={`${item.phaseNumber}-${item.issueId}`}
                              className="flex items-center justify-between gap-2 p-2 rounded-md bg-background hover:bg-muted/50 transition-all duration-200"
                              style={{
                                animation: `fadeIn 0.3s ease-out ${index * 0.05}s both`
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant="outline" className="text-xs font-mono flex-shrink-0 transition-all duration-200">
                                  P{item.phaseNumber}
                                </Badge>
                                <Badge
                                  className={cn(
                                    "text-xs font-bold flex-shrink-0 transition-all duration-200",
                                    getScoreColor(item.phaseScore)
                                  )}
                                >
                                  {item.phaseScore ? item.phaseScore.toFixed(1) : 'N/A'}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onRemove(item.phaseNumber, item.issueId)}
                                className="h-6 w-6 flex-shrink-0 transition-all duration-200 hover:scale-125 hover:text-red-600"
                                title="Remove from comparison"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                        
                        {/* Side-by-side descriptions when expanded */}
                        {expandedIssues.has(issueId) && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h5 className="text-xs font-semibold text-foreground mb-3">Phase Descriptions:</h5>
                            <div className={cn(
                              "grid gap-3 overflow-y-auto",
                              panelWidth === 'compact' && "max-h-[400px] grid-cols-1",
                              panelWidth === 'half' && "max-h-[600px]",
                              panelWidth === 'full' && "max-h-[800px]",
                              (panelWidth === 'half' || panelWidth === 'full') && (
                                items.length === 1 ? 'grid-cols-1' : 
                                items.length === 2 ? 'grid-cols-2' : 
                                items.length === 3 ? 'grid-cols-3' :
                                'grid-cols-4'
                              )
                            )}>
                              {items.sort((a, b) => a.phaseNumber - b.phaseNumber).map((item) => {
                                const descriptionKey = `${item.phaseNumber}-${item.issueId}`;
                                const description = phaseDescriptions[descriptionKey];
                                
                                return (
                                  <div 
                                    key={`desc-${item.phaseNumber}-${item.issueId}`}
                                    className={cn(
                                      "p-3 rounded-md bg-muted/50 border border-border min-w-0 flex flex-col",
                                      panelWidth === 'compact' && "min-h-[100px]",
                                      (panelWidth === 'half' || panelWidth === 'full') && "min-h-[200px]"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <Badge variant="outline" className="text-xs font-mono">
                                        Phase {item.phaseNumber}
                                      </Badge>
                                      <Badge
                                        className={cn(
                                          "text-xs font-bold",
                                          getScoreColor(item.phaseScore)
                                        )}
                                      >
                                        {item.phaseScore ? item.phaseScore.toFixed(1) : 'N/A'}
                                      </Badge>
                                    </div>
                                    {description ? (
                                      <div 
                                        className={cn(
                                          "prose dark:prose-invert max-w-none flex-1 overflow-y-auto",
                                          panelWidth === 'compact' && "prose-xs text-xs",
                                          panelWidth === 'half' && "prose-sm text-sm",
                                          panelWidth === 'full' && "prose-base text-base"
                                        )}
                                        dangerouslySetInnerHTML={{ __html: description }}
                                      />
                                    ) : (
                                      <p className={cn(
                                        "text-muted-foreground italic",
                                        panelWidth === 'compact' && "text-xs",
                                        panelWidth === 'half' && "text-sm",
                                        panelWidth === 'full' && "text-base"
                                      )}>No description available</p>
                                    )}
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
            )}
            
            {/* Orchard Maps Section */}
            {farmerId && selections.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <GitCompare className="h-4 w-4 text-emerald-600" />
                    Orchard Sector Maps
                  </h3>
                  <OrchardMapViewer farmerId={farmerId} isAdmin={false} compactMode={true} />
                </div>
              </>
            )}
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
};


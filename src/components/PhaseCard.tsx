import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FarmerPhase, MonitoredIssue } from "@/types/phase";
import { Edit, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { getPhaseScoreColors } from "@/lib/phaseColors";

interface PhaseCardProps {
  phase: FarmerPhase | null;
  phaseNumber: number;
  monitoredIssues: MonitoredIssue[];
  onEditPhase?: () => void;
  onViewF100?: () => void;
  onEditIssue?: (issue: MonitoredIssue, phaseNumber: number) => void;
  onToggleSelection?: (issueId: string) => void;
  selectedIssues?: Set<string>;
  isAdmin: boolean;
  hasF100: boolean;
}

export const PhaseCard = ({
  phase,
  phaseNumber,
  monitoredIssues,
  onEditPhase,
  onViewF100,
  onEditIssue,
  onToggleSelection,
  selectedIssues = new Set(),
  isAdmin,
  hasF100
}: PhaseCardProps) => {
  const score = phase?.score ?? null;
  const scoreColors = getPhaseScoreColors(score);

  const getF100ButtonColor = () => {
    // Always use red styling for F-100 button with proper dark/light theme hover
    return "border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 dark:hover:text-white";
  };

  return (
    <div className="flex-shrink-0 w-[280px]">
      <Card className={cn("h-full transition-colors", scoreColors.bg)}>
        <CardContent className="p-4 space-y-4">
          {/* Score Badge */}
          {score !== null && score !== undefined ? (
            <div className="flex justify-center">
              <Badge 
                className={cn(
                  "px-4 py-2 text-2xl font-bold rounded-lg border-2",
                  scoreColors.badge,
                  scoreColors.border
                )}
              >
                {score}
              </Badge>
            </div>
          ) : (
            <div className="flex justify-center">
              <Badge variant="outline" className="px-4 py-2 text-2xl font-bold rounded-lg border-2 text-muted-foreground">
                No Score
              </Badge>
            </div>
          )}

          {/* Phase Title */}
          <div className="text-center">
            <h3 className={cn(
              "text-lg font-semibold text-foreground",
              (phaseNumber === 1 || phaseNumber === 4) && "underline"
            )}>
              Phase: {phaseNumber}
            </h3>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditPhase}
                className="mt-1"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {/* Monitored Issues List */}
          <div className="bg-muted/30 dark:bg-muted/10 rounded-lg p-3 space-y-2">
            {monitoredIssues.map((issue, index) => {
              const selectionKey = `${phaseNumber}-${issue.id}`;
              const isSelected = selectedIssues.has(selectionKey);
              
              return (
                <div
                  key={`${phaseNumber}-${issue.id}`}
                  className={cn(
                    "group flex items-start gap-2 p-2 -m-2 rounded-md transition-all",
                    "hover:bg-background/80 cursor-pointer",
                    isSelected && "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
                  )}
                  onClick={() => onToggleSelection && onToggleSelection(issue.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelection && onToggleSelection(issue.id)}
                    className="mt-0.5 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    disabled={score === null || score === undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                        {index + 1}.
                      </span>
                      <span className="text-sm text-foreground">
                        {issue.name}
                      </span>
                      {isAdmin && onEditIssue && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditIssue(issue, phaseNumber);
                          }}
                          title="Edit issue details"
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* F-100 Button */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className={cn(
                "rounded-full px-8 py-2 border-2 font-semibold",
                getF100ButtonColor(),
                (!onViewF100 || score === null || score === undefined) && "opacity-50 cursor-not-allowed"
              )}
              onClick={onViewF100}
              disabled={!onViewF100 || score === null || score === undefined}
              title={score === null || score === undefined ? "Set a phase score to view F-100" : "View F-100 Report"}
            >
              F - 100
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


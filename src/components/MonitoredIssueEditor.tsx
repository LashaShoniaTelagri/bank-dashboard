import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye } from "lucide-react";
import { MonitoredIssue } from "@/types/phase";
import { RichTextEditor } from "@/components/RichTextEditor";

interface MonitoredIssueEditorProps {
  isOpen: boolean;
  onClose: () => void;
  issue: MonitoredIssue | null;
  farmerId?: string;
  phaseNumber?: number;
  readOnly?: boolean;
}

export const MonitoredIssueEditor = ({
  isOpen,
  onClose,
  issue,
  farmerId,
  phaseNumber,
  readOnly = false,
}: MonitoredIssueEditorProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [activeTab, setActiveTab] = useState("edit");

  const isPhaseSpecific = !!farmerId && !!phaseNumber && !!issue;

  // Fetch phase-specific description if editing for a specific phase
  const { data: phaseData } = useQuery({
    queryKey: ['phase-monitored-data', farmerId, phaseNumber, issue?.id],
    queryFn: async () => {
      if (!farmerId || !phaseNumber || !issue?.id) return null;

      const { data, error } = await (supabase
        .from('phase_monitored_data' as any)
        .select('description')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .eq('issue_id', issue.id)
        .maybeSingle() as any);

      if (error) {
        console.error('Error fetching phase data:', error);
        return null;
      }

      return data;
    },
    enabled: isPhaseSpecific && isOpen,
    staleTime: 0, // Always refetch when modal opens
    refetchOnMount: 'always', // Ensure fresh data
  });

  useEffect(() => {
    if (isOpen && issue) {
      setName(issue.name);
      // Use phase-specific description if available, otherwise fallback to global description
      if (isPhaseSpecific) {
        // Wait for phaseData to load before setting description
        if (phaseData !== undefined) {
          setDescription(phaseData?.description || "");
        }
      } else {
        setDescription(issue.description || "");
      }
    } else if (!isOpen) {
      // Reset state when modal closes
      setName("");
      setDescription("");
      setActiveTab("edit");
    }
  }, [issue, isOpen, phaseData, isPhaseSpecific]);

  const updateIssueMutation = useMutation({
    mutationFn: async () => {
      if (!issue) throw new Error("No issue selected");

      // If phase-specific, save description to phase_monitored_data
      if (isPhaseSpecific && farmerId && phaseNumber) {
        // First, ensure phase_monitored_data entry exists (upsert)
        const { data: existingData, error: checkError } = await (supabase
          .from('phase_monitored_data' as any)
          .select('id')
          .eq('farmer_id', farmerId)
          .eq('phase_number', phaseNumber)
          .eq('issue_id', issue.id)
          .maybeSingle() as any);

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingData) {
          // Update existing entry
          const { data, error } = await (supabase
            .from('phase_monitored_data' as any)
            .update({
              description: description.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingData.id)
            .select()
            .single() as any);

          if (error) throw error;
          return data;
        } else {
          // Create new entry
          const { data, error } = await (supabase
            .from('phase_monitored_data' as any)
            .insert({
              farmer_id: farmerId,
              phase_number: phaseNumber,
              issue_id: issue.id,
              description: description.trim() || null,
            })
            .select()
            .single() as any);

          if (error) throw error;
          return data;
        }
      } else {
        // Global update (fallback for non-phase-specific editing)
        const { data, error } = await supabase
          .from('monitored_issues')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', issue.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitored-issues'] });
      queryClient.invalidateQueries({ queryKey: ['phase-monitored-issues'] });
      queryClient.invalidateQueries({ queryKey: ['phase-monitored-data'] });
      toast({
        title: "Success",
        description: isPhaseSpecific 
          ? `Phase ${phaseNumber} description has been saved successfully`
          : "Monitored issue has been updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save description",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only validate name if not phase-specific (phase-specific only saves description)
    if (!isPhaseSpecific && !name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a name for the monitored issue",
        variant: "destructive",
      });
      return;
    }
    updateIssueMutation.mutate();
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setActiveTab("edit");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0"
        aria-describedby="monitored-issue-editor-description"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">
            {readOnly 
              ? (isPhaseSpecific ? `View Phase ${phaseNumber} - ${issue?.name}` : 'View Monitored Issue')
              : (isPhaseSpecific ? `Edit Phase ${phaseNumber} - ${issue?.name}` : 'Edit Monitored Issue')}
          </DialogTitle>
          <DialogDescription id="monitored-issue-editor-description">
            {readOnly 
              ? (isPhaseSpecific 
                  ? `View the description for this monitoring issue specific to Phase ${phaseNumber}.`
                  : 'View the description for this monitored issue.')
              : (isPhaseSpecific 
                  ? `Add or update the description for this monitoring issue specific to Phase ${phaseNumber}. This description will only appear in the One Pager for Phase ${phaseNumber}.`
                  : 'Update the name and description for this monitored issue. Use the rich text editor to format content and add tables.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="space-y-6">
              {/* Name Input - Only editable when not phase-specific */}
              {!isPhaseSpecific && (
                <div className="space-y-2">
                  <Label htmlFor="issue-name" className="text-base font-semibold">
                    Issue Name *
                  </Label>
                  <Input
                    id="issue-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Irrigation, Soil and plant fertility"
                    className="text-base"
                    disabled={updateIssueMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will be displayed on all phase cards
                  </p>
                </div>
              )}

              {/* Rich Text Editor with Preview */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">
                  Description
                </Label>
                {readOnly ? (
                  // Read-only mode - show only content without tabs
                  <div className="mt-4">
                    <div className="border rounded-lg p-6 min-h-[300px] bg-background overflow-auto">
                      {description ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none rich-text-preview"
                          dangerouslySetInnerHTML={{ __html: description }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-12">
                          No description has been added for this monitoring issue yet.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="edit">Edit</TabsTrigger>
                      <TabsTrigger value="preview">
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="edit" className="mt-4 border rounded-lg">
                      <RichTextEditor
                        value={description}
                        onChange={setDescription}
                        placeholder="Add detailed description, best practices, guidelines, or any relevant information about this monitored issue..."
                      />
                    </TabsContent>
                    
                    <TabsContent value="preview" className="mt-4">
                    <div className="border rounded-lg p-6 min-h-[300px] bg-background overflow-auto">
                      {description ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none rich-text-preview"
                          dangerouslySetInnerHTML={{ __html: description }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-12">
                          No description added yet. Switch to Edit tab to add content.
                        </p>
                      )}
                    </div>
                    {/* Preview Styles - Match RichTextEditor styles */}
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
                  </TabsContent>
                </Tabs>
                )}
                {!readOnly && (
                  <p className="text-xs text-muted-foreground">
                    {isPhaseSpecific
                      ? `This description will appear in the One Pager for Phase ${phaseNumber} for this farmer. Bank viewers will see this when they view the Phase ${phaseNumber} One Pager.`
                      : 'Bank viewers will see this description when they click "View Details" on comparison items'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 border-t border-border px-6 py-4 bg-muted/30">
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={!readOnly && updateIssueMutation.isPending}
              >
                {readOnly ? 'Close' : 'Cancel'}
              </Button>
              {!readOnly && (
                <Button
                  type="submit"
                  disabled={updateIssueMutation.isPending || (!isPhaseSpecific && !name.trim())}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {updateIssueMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};


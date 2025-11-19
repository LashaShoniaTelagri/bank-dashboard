import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, X } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/hooks/useAuth";

interface OnePagerSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
  farmerName: string;
  phaseNumber: number;
}

export const OnePagerSummaryModal = ({
  isOpen,
  onClose,
  farmerId,
  farmerName,
  phaseNumber,
}: OnePagerSummaryModalProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';

  const [summary, setSummary] = useState("");
  const [activeTab, setActiveTab] = useState("edit");

  // Fetch existing one pager summary for this phase
  const { data: phaseData, isLoading } = useQuery({
    queryKey: ['farmer-phase', farmerId, phaseNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_phases')
        .select('one_pager_summary')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!farmerId && !!phaseNumber,
  });

  useEffect(() => {
    if (phaseData) {
      setSummary(phaseData.one_pager_summary || "");
    } else if (!isLoading) {
      setSummary("");
    }
  }, [phaseData, isLoading, isOpen]);

  // Save summary mutation
  const saveMutation = useMutation({
    mutationFn: async (summaryText: string) => {
      // Upsert farmer_phases entry
      const { data, error } = await supabase
        .from('farmer_phases')
        .upsert({
          farmer_id: farmerId,
          phase_number: phaseNumber,
          one_pager_summary: summaryText.trim() || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'farmer_id,phase_number'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-phase', farmerId, phaseNumber] });
      queryClient.invalidateQueries({ queryKey: ['farmer-phases', farmerId] });
      toast({
        title: "Summary Saved",
        description: `One Pager summary for Phase ${phaseNumber} has been saved successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save summary",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!isAdmin) return;
    saveMutation.mutate(summary);
  };

  const handleClose = () => {
    setActiveTab("edit");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0"
        aria-describedby="one-pager-summary-description"
      >
        <DialogHeader className="sticky top-0 bg-background z-20 pb-4 border-b px-6 pt-6 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold">
                Phase {phaseNumber} - One Pager Summary
              </DialogTitle>
              <DialogDescription id="one-pager-summary-description" className="mt-1">
                {farmerName} - {isAdmin ? 'Add or edit a brief summary for this phase' : 'View phase summary'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Summary"
                  )}
                </Button>
              )}
              <Button
                onClick={handleClose}
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

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isAdmin ? (
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
                  value={summary}
                  onChange={setSummary}
                  placeholder={`Add a brief summary for Phase ${phaseNumber}. This summary will appear in the One Pager for this phase...`}
                />
              </TabsContent>
              
              <TabsContent value="preview" className="mt-4">
                <div className="border rounded-lg p-6 min-h-[400px] bg-background overflow-auto">
                  {summary ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none rich-text-preview"
                      dangerouslySetInnerHTML={{ __html: summary }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No summary added yet. Switch to Edit tab to add content.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            // Bank viewer - read-only mode
            <div className="border rounded-lg p-6 min-h-[400px] bg-background overflow-auto">
              {summary ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rich-text-preview"
                  dangerouslySetInnerHTML={{ __html: summary }}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No summary available for Phase {phaseNumber} yet.
                </p>
              )}
            </div>
          )}
        </div>
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


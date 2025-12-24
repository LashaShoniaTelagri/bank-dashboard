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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, Map, ExternalLink, ChevronDown, ChevronRight, Upload, Trash2, FileImage, FileText, Image as ImageIcon } from "lucide-react";
import { MonitoredIssue } from "@/types/phase";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  
  // Interactive Maps state (for "Used Data" issue only)
  const [showIframes, setShowIframes] = useState(false);
  const [collapsedIframes, setCollapsedIframes] = useState<Set<string>>(new Set());
  
  // File upload state (for "Used Data" issue only)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileAnnotations, setFileAnnotations] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [deleteMapDialog, setDeleteMapDialog] = useState<{ open: boolean; mapId?: string; fileName?: string }>({ open: false });

  const isPhaseSpecific = !!farmerId && !!phaseNumber && !!issue;
  const isUsedDataIssue = issue?.name === 'Used Data';

  // Fetch phase-specific description if editing for a specific phase
  const { data: phaseData } = useQuery({
    queryKey: ['phase-monitored-data', farmerId, phaseNumber, issue?.id],
    queryFn: async () => {
      if (!farmerId || !phaseNumber || !issue?.id) return null;

      const { data, error } = await (supabase
        .from('phase_monitored_data' as any)
        .select('description, show_iframes')
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

  // Fetch phase iframe URLs (only for "Used Data" issue)
  const { data: phaseIframes = [] } = useQuery<Array<{ url: string; name: string; annotation?: string }>>({
    queryKey: ['farmer-phase-iframes-editor', farmerId, phaseNumber],
    queryFn: async () => {
      if (!farmerId || !phaseNumber) return [];
      
      console.log('🗺️ MonitoredIssueEditor - Fetching iframes for farmer:', farmerId, 'phase:', phaseNumber);
      const { data, error } = await supabase
        .from('farmer_phases' as any)
        .select('iframe_urls')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ MonitoredIssueEditor - Error fetching iframes:', error);
        return [];
      }
      
      const iframes = ((data as any)?.iframe_urls as Array<{ url: string; name: string; annotation?: string }>) || [];
      console.log('✅ MonitoredIssueEditor - Loaded', iframes.length, 'iframe(s) for phase', phaseNumber);
      return iframes;
    },
    enabled: isPhaseSpecific && isUsedDataIssue && isOpen,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const hasInteractiveMaps = phaseIframes.length > 0;
  
  // Fetch uploaded maps for Used Data section with signed URLs
  const { data: uploadedMaps = [], refetch: refetchMaps } = useQuery<Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_mime: string;
    file_size_bytes: number;
    annotation?: string;
    display_order: number;
    created_at: string;
    signedUrl?: string | null;
  }>>({
    queryKey: ['phase-used-data-maps', farmerId, phaseNumber],
    queryFn: async () => {
      if (!farmerId || !phaseNumber) return [];
      
      console.log('🗺️ MonitoredIssueEditor - Fetching uploaded maps for farmer:', farmerId, 'phase:', phaseNumber);
      const { data, error } = await supabase
        .from('phase_used_data_maps' as any)
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('❌ MonitoredIssueEditor - Error fetching maps:', error);
        throw error;
      }
      
      // Generate signed URLs for thumbnails
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
      
      console.log('✅ MonitoredIssueEditor - Loaded', mapsWithUrls.length, 'uploaded map(s) with signed URLs');
      return mapsWithUrls;
    },
    enabled: isPhaseSpecific && isUsedDataIssue && isOpen,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  
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

  // File upload mutation
  const uploadMapMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!farmerId || !phaseNumber) throw new Error('Missing farmer or phase info');
      
      setIsUploading(true);
      const uploadedRecords = [];
      
      for (const file of files) {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${file.name}`;
        const storagePath = `phase_used_data_maps/${farmerId}/${phaseNumber}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('farmer-documents')
          .upload(storagePath, file);
        
        if (uploadError) throw uploadError;
        
        // Save metadata to database
        const { data, error: dbError } = await (supabase
          .from('phase_used_data_maps' as any)
          .insert({
            farmer_id: farmerId,
            phase_number: phaseNumber,
            file_name: file.name,
            file_path: storagePath,
            file_mime: file.type,
            file_size_bytes: file.size,
            annotation: fileAnnotations[file.name] || null,
            display_order: uploadedMaps.length + uploadedRecords.length,
          })
          .select()
          .single() as any);
        
        if (dbError) throw dbError;
        uploadedRecords.push(data);
      }
      
      return uploadedRecords;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Uploaded ${uploadedFiles.length} map file(s) successfully`,
      });
      setUploadedFiles([]);
      setFileAnnotations({});
      refetchMaps();
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload map files",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Delete map mutation
  const deleteMapMutation = useMutation({
    mutationFn: async (mapId: string) => {
      const mapToDelete = uploadedMaps.find(m => m.id === mapId);
      if (!mapToDelete) throw new Error('Map not found');
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('farmer-documents')
        .remove([mapToDelete.file_path]);
      
      if (storageError) throw storageError;
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('phase_used_data_maps' as any)
        .delete()
        .eq('id', mapId);
      
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Map file deleted successfully",
      });
      setDeleteMapDialog({ open: false });
      refetchMaps();
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete map file",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Filter for PDF and image files only
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    
    if (validFiles.length !== files.length) {
      toast({
        title: "Invalid Files",
        description: "Only PDF and image files are allowed",
        variant: "destructive",
      });
    }
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
    // Reset input
    e.target.value = '';
  };

  const handleUploadFiles = () => {
    if (uploadedFiles.length === 0) return;
    uploadMapMutation.mutate(uploadedFiles);
  };

  const handleDeleteMap = (mapId: string, fileName: string) => {
    setDeleteMapDialog({ open: true, mapId, fileName });
  };

  const confirmDeleteMap = () => {
    if (deleteMapDialog.mapId) {
      deleteMapMutation.mutate(deleteMapDialog.mapId);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />;
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

  useEffect(() => {
    if (isOpen && issue) {
      setName(issue.name);
      // Use phase-specific description if available, otherwise fallback to global description
      if (isPhaseSpecific) {
        // Wait for phaseData to load before setting description
        if (phaseData !== undefined) {
          setDescription(phaseData?.description || "");
          // Load show_iframes preference for Used Data issue
          if (isUsedDataIssue) {
            setShowIframes(phaseData?.show_iframes || false);
          }
        }
      } else {
        setDescription(issue.description || "");
      }
    } else if (!isOpen) {
      // Reset state when modal closes
      setName("");
      setDescription("");
      setActiveTab("edit");
      setShowIframes(false);
      setCollapsedIframes(new Set());
      setUploadedFiles([]);
      setFileAnnotations({});
    }
  }, [issue, isOpen, phaseData, isPhaseSpecific, isUsedDataIssue]);

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
          const updateData: any = {
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          };
          
          // Include show_iframes for Used Data issue
          if (issue.name === 'Used Data') {
            updateData.show_iframes = showIframes;
          }
          
          const { data, error } = await (supabase
            .from('phase_monitored_data' as any)
            .update(updateData)
            .eq('id', existingData.id)
            .select()
            .single() as any);

          if (error) throw error;
          return data;
        } else {
          // Create new entry
          const insertData: any = {
            farmer_id: farmerId,
            phase_number: phaseNumber,
            issue_id: issue.id,
            description: description.trim() || null,
          };
          
          // Include show_iframes for Used Data issue
          if (issue.name === 'Used Data') {
            insertData.show_iframes = showIframes;
          }
          
          const { data, error } = await (supabase
            .from('phase_monitored_data' as any)
            .insert(insertData)
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

              {/* Interactive Maps Section (only for "Used Data" issue in phase-specific mode) */}
              {isPhaseSpecific && isUsedDataIssue && !readOnly && hasInteractiveMaps && (
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Map className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Interactive Maps for Phase {phaseNumber}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Toggle to display these maps in the Used Data section of the F-100 report
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="show-iframes-toggle"
                        checked={showIframes}
                        onCheckedChange={setShowIframes}
                      />
                      <Label 
                        htmlFor="show-iframes-toggle" 
                        className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap"
                      >
                        {showIframes ? 'Showing' : 'Hidden'}
                      </Label>
                    </div>
                  </div>

                  {showIframes && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                          <Map className="h-4 w-4 flex-shrink-0" />
                          <span>
                            {phaseIframes.length} interactive map{phaseIframes.length !== 1 ? 's' : ''} will be displayed in the Used Data section
                          </span>
                        </p>
                      </div>

                      {phaseIframes.map((iframe, idx) => {
                        const isCollapsed = collapsedIframes.has(iframe.url);
                        return (
                          <div key={idx} className="border dark:border-dark-border rounded-lg overflow-hidden bg-card dark:bg-dark-card shadow-sm">
                            {/* Map Header */}
                            <div 
                              className="p-3 bg-muted/30 dark:bg-muted/10 border-b border-border/30 cursor-pointer hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors"
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
                                    <Map className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
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
                            
                            {/* Iframe Preview */}
                            {!isCollapsed && (
                              <div className="w-full bg-white dark:bg-gray-950 animate-in slide-in-from-top-2 duration-300">
                                <iframe
                                  src={iframe.url}
                                  className="w-full h-[400px]"
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
                  )}
                </div>
              )}

              {/* Interactive Maps Section (for bank viewer when admin enabled it) */}
              {isPhaseSpecific && isUsedDataIssue && readOnly && hasInteractiveMaps && showIframes && (
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Map className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Interactive Maps for Phase {phaseNumber}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {phaseIframes.length} interactive map{phaseIframes.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {phaseIframes.map((iframe, idx) => {
                      const isCollapsed = collapsedIframes.has(iframe.url);
                      return (
                        <div key={idx} className="border dark:border-dark-border rounded-lg overflow-hidden bg-card dark:bg-dark-card shadow-sm">
                          {/* Map Header */}
                          <div 
                            className="p-3 bg-muted/30 dark:bg-muted/10 border-b border-border/30 cursor-pointer hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors"
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
                                  <Map className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
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
                          
                          {/* Iframe Preview */}
                          {!isCollapsed && (
                            <div className="w-full bg-white dark:bg-gray-950 animate-in slide-in-from-top-2 duration-300">
                              <iframe
                                src={iframe.url}
                                className="w-full h-[400px]"
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

              {/* No message for bank viewers when maps are disabled - they shouldn't know maps exist */}

              {/* Uploaded Maps Section (for "Used Data" issue) */}
              {isPhaseSpecific && isUsedDataIssue && (
                <div className="space-y-4 border-t pt-6">
                  <div>
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Upload className="h-5 w-5 text-green-600 dark:text-green-400" />
                      Uploaded Maps & Documents
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload PDF files or images related to data sources for Phase {phaseNumber}
                    </p>
                  </div>

                  {/* Upload Section (Admin only) */}
                  {!readOnly && (
                    <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center hover:border-green-400 dark:hover:border-green-600 transition-colors">
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="map-upload"
                        />
                        <label htmlFor="map-upload" className="cursor-pointer">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-body-secondary">Click to upload maps or documents</p>
                          <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, JPEG accepted</p>
                        </label>
                      </div>

                      {/* Selected files to upload */}
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-foreground">Files to upload:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {uploadedFiles.map((file, index) => {
                              const isImage = file.type.startsWith('image/');
                              const isPDF = file.type === 'application/pdf';
                              const previewUrl = isImage ? URL.createObjectURL(file) : null;
                              
                              return (
                                <div key={index} className="group relative border rounded-lg overflow-hidden bg-card">
                                  {/* Thumbnail Preview */}
                                  <div className="relative aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                                    {isImage && previewUrl ? (
                                      <img
                                        src={previewUrl}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    ) : isPDF ? (
                                      <div className="flex flex-col items-center justify-center gap-2 p-4">
                                        <FileText className="h-12 w-12 text-red-600 dark:text-red-400" />
                                        <span className="text-xs text-muted-foreground font-medium">PDF Document</span>
                                      </div>
                                    ) : (
                                      <FileImage className="h-12 w-12 text-gray-600 dark:text-gray-400" />
                                    )}
                                    
                                    {/* Delete button overlay */}
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      onClick={() => {
                                        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                                        const newAnnotations = { ...fileAnnotations };
                                        delete newAnnotations[file.name];
                                        setFileAnnotations(newAnnotations);
                                        // Cleanup preview URL
                                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                                      }}
                                      className="absolute top-2 right-2 h-8 w-8 shadow-lg"
                                      title="Remove file"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  
                                  {/* File Info */}
                                  <div className="p-3 space-y-1">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(file.size)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <Button
                            type="button"
                            onClick={handleUploadFiles}
                            disabled={isUploading}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload {uploadedFiles.length} File{uploadedFiles.length !== 1 ? 's' : ''}
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Existing Uploaded Maps List with Thumbnails */}
                  {uploadedMaps.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">
                        {uploadedMaps.length} uploaded file{uploadedMaps.length !== 1 ? 's' : ''}:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {uploadedMaps.map((map) => {
                          const isImage = map.file_mime.startsWith('image/');
                          const isPDF = map.file_mime === 'application/pdf';
                          
                          return (
                            <div 
                              key={map.id} 
                              className="group relative border rounded-lg overflow-hidden hover:shadow-lg transition-all bg-card"
                            >
                              {/* Thumbnail or Icon */}
                              <div 
                                className="relative aspect-video bg-muted/30 flex items-center justify-center overflow-hidden cursor-pointer"
                                onClick={() => openFileInViewer(map.file_path, map.file_name)}
                              >
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
                                  <div className="flex flex-col items-center justify-center gap-2 p-4">
                                    <FileText className="h-12 w-12 text-red-600 dark:text-red-400" />
                                    <span className="text-xs text-muted-foreground font-medium text-center">PDF Document</span>
                                  </div>
                                ) : (
                                  <FileImage className="h-12 w-12 text-gray-600 dark:text-gray-400" />
                                )}
                                
                                {/* Overlay on hover */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="flex items-center gap-2 text-white">
                                    <ExternalLink className="h-5 w-5" />
                                    <span className="text-sm font-medium">Open</span>
                                  </div>
                                </div>
                                
                                {/* Delete button overlay (admin only) */}
                                {!readOnly && (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMap(map.id, map.file_name);
                                    }}
                                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    title="Delete map"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              
                              {/* File Info */}
                              <div className="p-3 space-y-1">
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

                  {uploadedMaps.length === 0 && readOnly && (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No maps uploaded for this phase yet.
                    </div>
                  )}
                </div>
              )}
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
      
      {/* Delete Map Confirmation Dialog */}
      <AlertDialog open={deleteMapDialog.open} onOpenChange={(open) => setDeleteMapDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Map File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteMapDialog.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMapMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMap}
              disabled={deleteMapMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMapMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};


import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Image as ImageIcon,
  Download,
  Eye,
  MoreVertical,
  Trash2,
  Calendar,
  FileType,
  HardDrive,
  Loader2,
  MapIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OrchardMap {
  id: string;
  farmer_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string | null;
  created_at: string;
  notes?: string;
}

interface OrchardMapViewerProps {
  farmerId: string;
  isAdmin?: boolean;
  compactMode?: boolean;
}

export const OrchardMapViewer = ({ farmerId, isAdmin = false, compactMode = false }: OrchardMapViewerProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMap, setSelectedMap] = useState<OrchardMap | null>(null);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mapToDelete, setMapToDelete] = useState<OrchardMap | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch orchard maps for this farmer
  const { data: maps = [], isLoading, error } = useQuery<OrchardMap[]>({
    queryKey: ['farmerOrchardMaps', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_orchard_maps')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to ensure file_url is set (use file_path if file_url doesn't exist)
      return (data || []).map((map: any) => ({
        ...map,
        file_url: map.file_url || map.file_path || '',
        file_name: map.file_name || map.name || 'Unknown',
      }));
    },
    enabled: !!farmerId,
  });

  const getFileUrl = (fileUrlOrPath: string | undefined, map?: OrchardMap) => {
    if (fileUrlOrPath) {
      // If it's already a full URL, return it
      if (fileUrlOrPath.startsWith('http://') || fileUrlOrPath.startsWith('https://')) {
        return fileUrlOrPath;
      }
      // Otherwise, construct the public URL from storage
      const { data } = supabase.storage
        .from('orchard-maps')
        .getPublicUrl(fileUrlOrPath);
      return data.publicUrl;
    }
    // Fallback: try to use file_path if file_url doesn't exist
    if (map && (map as any).file_path) {
      const { data } = supabase.storage
        .from('orchard-maps')
        .getPublicUrl((map as any).file_path);
      return data.publicUrl;
    }
    return '';
  };

  const handleView = (map: OrchardMap) => {
    const index = maps.findIndex(m => m.id === map.id);
    setCurrentMapIndex(index);
    setSelectedMap(map);
    setViewerOpen(true);
  };

  const handlePreviousMap = () => {
    if (currentMapIndex > 0) {
      const newIndex = currentMapIndex - 1;
      setCurrentMapIndex(newIndex);
      setSelectedMap(maps[newIndex]);
    }
  };

  const handleNextMap = () => {
    if (currentMapIndex < maps.length - 1) {
      const newIndex = currentMapIndex + 1;
      setCurrentMapIndex(newIndex);
      setSelectedMap(maps[newIndex]);
    }
  };

  const handleDownload = async (map: OrchardMap) => {
    try {
      // Extract file path from file_url or file_path
      let filePath: string | undefined;
      
      if (map.file_url) {
        // If file_url contains the full URL, extract the path
        if (map.file_url.includes('orchard-maps/')) {
          filePath = map.file_url.split('orchard-maps/')[1];
        } else if (map.file_url.includes('/')) {
          // If it's just a path, use it directly
          filePath = map.file_url.startsWith('/') 
            ? map.file_url.slice(1) 
            : map.file_url;
        } else {
          // If it's just the filename, use it directly
          filePath = map.file_url;
        }
      } else if ((map as any).file_path) {
        // Fallback to file_path if file_url doesn't exist
        filePath = (map as any).file_path;
      }

      if (!filePath) {
        throw new Error('Unable to determine file path for download');
      }
      
      const { data, error } = await supabase.storage
        .from('orchard-maps')
        .download(filePath);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${map.file_name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading ${map.file_name}`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download map",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (map: OrchardMap) => {
    setMapToDelete(map);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!mapToDelete) return;

    setIsDeleting(true);

    try {
      // 1. Extract file path from file_url or file_path
      let filePath: string | undefined;
      
      if (mapToDelete.file_url) {
        // If file_url contains the full URL, extract the path
        if (mapToDelete.file_url.includes('orchard-maps/')) {
          filePath = mapToDelete.file_url.split('orchard-maps/')[1];
        } else if (mapToDelete.file_url.includes('/')) {
          // If it's just a path, use it directly
          filePath = mapToDelete.file_url.startsWith('/') 
            ? mapToDelete.file_url.slice(1) 
            : mapToDelete.file_url;
        } else {
          // If it's just the filename, use it directly
          filePath = mapToDelete.file_url;
        }
      } else if ((mapToDelete as any).file_path) {
        // Fallback to file_path if file_url doesn't exist
        filePath = (mapToDelete as any).file_path;
      }

      if (!filePath) {
        throw new Error('Unable to determine file path for deletion');
      }

      // 2. Delete from storage
      const { error: storageError } = await supabase.storage
        .from('orchard-maps')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage deletion fails
        // (file might already be deleted or not exist)
      }

      // 3. Delete from database
      const { error: dbError } = await supabase
        .from('farmer_orchard_maps')
        .delete()
        .eq('id', mapToDelete.id);

      if (dbError) throw dbError;

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['farmerOrchardMaps', farmerId] });

      toast({
        title: "Map Deleted",
        description: `${mapToDelete.file_name} has been deleted`,
      });

      setDeleteConfirmOpen(false);
      setMapToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete map",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
        <p className="text-red-600">Error loading maps: {error.message}</p>
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
        <MapIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">No orchard maps uploaded yet</p>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Click "Upload Map" to add the first map.' : 'No maps available for this farmer.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={compactMode ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
        {maps.map((map) => (
          <Card key={map.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            {/* Map Preview */}
            <div className="aspect-video bg-muted relative group cursor-pointer" onClick={() => handleView(map)}>
              {map.file_type.includes('pdf') || map.file_type === 'application/pdf' ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText className="h-16 w-16 text-red-600" />
                </div>
              ) : (
                <img
                  src={getFileUrl(map.file_url, map)}
                  alt={map.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleView(map);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Button>
              </div>
            </div>

            {/* Map Info */}
            <CardContent className={cn("space-y-3", compactMode ? "p-3" : "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <h4 className={cn("font-semibold text-foreground line-clamp-1", compactMode ? "text-sm" : "")}>{map.file_name}</h4>
                {!compactMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(map)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(map)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(map)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {map.notes && !compactMode && (
                <p className="text-xs text-muted-foreground line-clamp-2">{map.notes}</p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {map.file_type.includes('pdf') || map.file_type === 'application/pdf' ? (
                    <FileText className="h-3 w-3 mr-1 text-red-600" />
                  ) : (
                    <ImageIcon className="h-3 w-3 mr-1 text-emerald-600" />
                  )}
                  {map.file_type.includes('pdf') ? 'PDF' : 'IMAGE'}
                </Badge>
              </div>

              {!compactMode && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(map.created_at)}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleView(map)}
              >
                <Eye className={cn(compactMode ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
                {compactMode ? "View" : "View Map"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent
          className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col gap-0"
          aria-describedby="map-viewer-description"
        >
          <DialogHeader className="px-6 pt-6 pb-4 pr-16 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-bold text-heading-primary truncate">
                  {selectedMap?.file_name}
                </DialogTitle>
                <DialogDescription id="map-viewer-description" className="text-sm text-muted-foreground">
                  {selectedMap?.notes || "Orchard sector map for detailed viewing"}
                </DialogDescription>
              </div>
              {maps.length > 1 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePreviousMap}
                    disabled={currentMapIndex === 0}
                    title="Previous map"
                    className="h-9 w-9"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[70px] text-center font-medium">
                    {currentMapIndex + 1} of {maps.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextMap}
                    disabled={currentMapIndex === maps.length - 1}
                    title="Next map"
                    className="h-9 w-9"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 p-6 overflow-auto relative">
            {selectedMap && (
              <>
                <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-lg">
                  {selectedMap.file_type.includes('pdf') || selectedMap.file_type === 'application/pdf' ? (
                    <iframe
                      src={getFileUrl(selectedMap.file_url, selectedMap)}
                      className="w-full h-full rounded-lg"
                      title={selectedMap.file_name}
                    />
                  ) : (
                    <img
                      src={getFileUrl(selectedMap.file_url, selectedMap)}
                      alt={selectedMap.file_name}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                </div>
                {/* Navigation arrows overlay for images (not PDFs) */}
                {maps.length > 1 && !(selectedMap.file_type.includes('pdf') || selectedMap.file_type === 'application/pdf') && (
                  <>
                    {currentMapIndex > 0 && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-8 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg opacity-70 hover:opacity-100 transition-opacity"
                        onClick={handlePreviousMap}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                    )}
                    {currentMapIndex < maps.length - 1 && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-8 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg opacity-70 hover:opacity-100 transition-opacity"
                        onClick={handleNextMap}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileType className="h-4 w-4" />
                {selectedMap?.file_type}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {selectedMap && formatDate(selectedMap.created_at)}
              </span>
            </div>
            <Button
              onClick={() => selectedMap && handleDownload(selectedMap)}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orchard Map</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{mapToDelete?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};


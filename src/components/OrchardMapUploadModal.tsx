import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Image as ImageIcon, Loader2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrchardMapUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
}

export const OrchardMapUploadModal = ({
  isOpen,
  onClose,
  farmerId,
}: OrchardMapUploadModalProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF or image file (JPEG, PNG, WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    // Auto-populate name from filename if empty
    if (!name) {
      const fileName = file.name.split('.').slice(0, -1).join('.');
      setName(fileName);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and select a file",
        variant: "destructive",
      });
      return;
    }

    if (!profile?.user_id) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to upload maps",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${farmerId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('orchard-maps')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 2. Determine file type
      const fileType = selectedFile.type.startsWith('image/') ? 'image' : 'pdf';

      // 3. Get display order (highest + 1)
      const { data: existingMaps } = await supabase
        .from('farmer_orchard_maps')
        .select('display_order')
        .eq('farmer_id', farmerId)
        .order('display_order', { ascending: false })
        .limit(1);

      const displayOrder = existingMaps && existingMaps.length > 0 
        ? existingMaps[0].display_order + 1 
        : 0;

      // 4. Create database record
      const { error: dbError } = await supabase
        .from('farmer_orchard_maps')
        .insert({
          farmer_id: farmerId,
          name: name.trim(),
          file_path: filePath,
          file_type: fileType,
          mime_type: selectedFile.type,
          file_size_bytes: selectedFile.size,
          uploaded_by: profile.user_id,
          notes: notes.trim() || null,
          display_order: displayOrder,
          is_active: true,
        });

      if (dbError) {
        // Cleanup: delete uploaded file if database insert fails
        await supabase.storage.from('orchard-maps').remove([filePath]);
        throw new Error(`Database error: ${dbError.message}`);
      }

      // 5. Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['farmer-orchard-maps', farmerId] });

      toast({
        title: "Upload Successful",
        description: `${name} has been uploaded successfully`,
      });

      // Reset form and close modal
      setName("");
      setNotes("");
      setSelectedFile(null);
      onClose();
    } catch (error: any) {
      console.error('Orchard map upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload orchard map",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setName("");
      setNotes("");
      setSelectedFile(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-2xl"
        aria-describedby="orchard-map-upload-desc"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-heading-primary">
            Upload Orchard Map
          </DialogTitle>
          <DialogDescription id="orchard-map-upload-desc">
            Upload a PDF or image file showing the farmer's orchard layout and sectors
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Area */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Map File (PDF or Image)</Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isUploading}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {selectedFile ? selectedFile.name : "Click to select file"}
                  </span>
                </div>
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                {selectedFile.type.startsWith('image/') ? (
                  <ImageIcon className="h-5 w-5 text-emerald-600" />
                ) : (
                  <FileText className="h-5 w-5 text-red-600" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Alert>
              <AlertDescription className="text-xs">
                Accepted formats: PDF, JPEG, PNG, WebP (max 10MB)
              </AlertDescription>
            </Alert>
          </div>

          {/* Map Name */}
          <div className="space-y-2">
            <Label htmlFor="map-name">Map Name <span className="text-destructive">*</span></Label>
            <Input
              id="map-name"
              placeholder="e.g., Main Orchard Layout 2024, Sector A Map"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUploading}
              maxLength={200}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="map-notes">Notes (Optional)</Label>
            <Textarea
              id="map-notes"
              placeholder="Add any relevant notes about this map (e.g., recent changes, specific areas of interest)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isUploading}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/500 characters
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || !selectedFile || !name.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Map
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


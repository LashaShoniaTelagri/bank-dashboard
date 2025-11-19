import React, { useState, useCallback, useRef, useEffect } from "react";
import { useAuth, UserProfile } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Progress } from "./ui/progress";
import { 
  Upload, 
  FileText, 
  Image, 
  MapPin, 
  Video, 
  File,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sun,
  Trash2
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "./ui/use-toast";
import { DataUploadForm, DataType, F100Phase, UploadProgress, getPhaseLabel } from "../types/specialist";
import { DATA_TYPES } from "../types/specialist";

interface DataUploadModalProps {
  farmerId: string;
  farmerName: string;
  bankId: string; // required to avoid invalid UUID
  onUploadComplete?: () => void;
}

type UploadRow = {
  id: string;
  file_name: string;
  file_path: string;
  file_mime: string;
  file_size_bytes: number;
  created_at: string;
  phase: number;
  data_type: DataType;
  metadata: Record<string, unknown> | null;
  updated_at?: string;
};

export const DataUploadModal: React.FC<DataUploadModalProps> = ({
  farmerId,
  farmerName,
  bankId,
  onUploadComplete
}) => {
  const { profile } = useAuth();
  const userProfile = profile as UserProfile | null;
  const [isOpen, setIsOpen] = useState(false);
  const [uploadData, setUploadData] = useState<DataUploadForm>({
    farmer_id: farmerId,
    data_type: 'photo',
    file: null,
    description: '',
    tags: [],
    phase: 1 as F100Phase
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [uploadToDelete, setUploadToDelete] = useState<null | {
    id: string;
    file_name: string;
    file_path: string;
  }>(null);
  const [f100Phase, setF100Phase] = useState<F100Phase | null>(1 as F100Phase);

  useEffect(() => {
    setUploadData(prev => ({ ...prev, phase: (f100Phase ?? prev.phase) as F100Phase }));
  }, [f100Phase]);

  // Reset success message when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowSuccessMessage(false);
    }
  }, [isOpen]);

  // Controls for filtering previously uploaded list
  const [existingPhaseFilter, setExistingPhaseFilter] = useState<string>('all');

  // Load previously uploaded data for this farmer
  const { data: existingUploads = [], isLoading: uploadsLoading } = useQuery({
    queryKey: ['farmer-data-uploads', farmerId, existingPhaseFilter],
    queryFn: async (): Promise<UploadRow[]> => {
      let query = supabase
        .from('farmer_data_uploads')
        .select('id, file_name, file_path, file_mime, file_size_bytes, created_at, phase, data_type, metadata')
        .eq('farmer_id', farmerId)
        .eq('bank_id', bankId)
        .order('created_at', { ascending: false });
      if (existingPhaseFilter !== 'all') {
        query = query.eq('phase', Number(existingPhaseFilter));
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as UploadRow[]) ?? [];
    },
    enabled: isOpen,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const queryClient = useQueryClient();

  // Generate a small thumbnail (PNG) for image files in-browser (common formats)
  const generateImageThumbnail = useCallback(async (file: File): Promise<Blob | null> => {
    try {
      // Try to decode via browser (JPEG/PNG/WebP/GIF/BMP/TIFF). HEIC/HEIF may fail and return null.
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const im = new window.Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      }).catch(() => null);

      if (!img) return null; // Unsupported format for client-side decoding

      const targetSize = 128;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      canvas.width = targetSize;
      canvas.height = targetSize;

      const srcW = img.width || targetSize;
      const srcH = img.height || targetSize;
      const scale = Math.max(targetSize / srcW, targetSize / srcH);
      const drawW = Math.round(srcW * scale);
      const drawH = Math.round(srcH * scale);
      const dx = Math.round((targetSize - drawW) / 2);
      const dy = Math.round((targetSize - drawH) / 2);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);
      ctx.drawImage(img, dx, dy, drawW, drawH);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 0.8)
      );
      return blob;
    } catch (e) {
      console.warn('Thumbnail generation failed:', e);
      return null;
    }
  }, []);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file size
      const maxSize = parseInt(DATA_TYPES[uploadData.data_type].maxSize.replace('MB', '')) * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(`File size exceeds maximum allowed size of ${DATA_TYPES[uploadData.data_type].maxSize}`);
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `farmer-data/${farmerId}/${uploadData.phase}/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('farmer-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Insert record into database (admin via RPC to bypass RLS; others direct insert)
      let dbResponse: UploadRow | null = null;
      let dbError: Error | null = null;
      if (userProfile?.role === 'admin') {
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_insert_farmer_data_upload', {
          p_farmer_id: farmerId,
          p_bank_id: bankId,
          p_data_type: uploadData.data_type,
          p_file_name: file.name,
          p_file_path: filePath,
          p_file_mime: file.type,
          p_file_size: file.size,
          p_description: uploadData.description,
          p_tags: uploadData.tags,
          p_phase: f100Phase,
          p_metadata: {
            original_name: file.name,
            upload_timestamp: new Date().toISOString(),
            uploader_role: userProfile?.role,
            f100_phase: f100Phase
          }
        });
        dbResponse = rpcData as unknown as UploadRow ?? null;
        dbError = rpcError ? new Error(rpcError.message) : null;
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('farmer_data_uploads')
          .insert({
            farmer_id: farmerId,
            bank_id: bankId,
            uploaded_by: userProfile?.user_id ?? '',
            data_type: uploadData.data_type,
            file_name: file.name,
            file_path: filePath,
            file_mime: file.type,
            file_size_bytes: file.size,
            description: uploadData.description,
            tags: uploadData.tags,
            phase: f100Phase,
            metadata: {
              original_name: file.name,
              upload_timestamp: new Date().toISOString(),
              uploader_role: userProfile?.role,
              f100_phase: f100Phase
            }
          })
          .select()
          .single();
        dbResponse = insertData as UploadRow ?? null;
        dbError = insertError ? new Error(insertError.message) : null;
      }

      if (dbError) {
        await supabase.storage.from('farmer-documents').remove([filePath]);
        throw dbError;
      }

      // Best-effort: create and upload a small public thumbnail for images
      if (file.type.startsWith('image/')) {
        try {
          const thumbBlob = await generateImageThumbnail(file);
          if (thumbBlob) {
            const withoutExt = filePath.replace(/\.[^/.]+$/, '');
            const thumbPath = `thumbs/${withoutExt}.png`;
            await supabase.storage
              .from('farmer-thumbs')
              .upload(thumbPath, thumbBlob, {
                upsert: true,
                contentType: 'image/png',
              });
          }
        } catch (e) {
          console.warn('Failed to upload thumbnail:', e);
          // Non-blocking
        }
      }

      // Generate AI description for image files
      if (uploadData.data_type === 'photo' && file.type.startsWith('image/')) {
        try {
          console.log(`🖼️ Generating AI description for image: ${file.name}`);
          const { error: descriptionError } = await supabase.functions.invoke('generate-image-description', {
            body: {
              filePath,
              fileName: file.name,
              farmerId,
              farmerName: farmerName || 'Unknown Farmer'
            }
          });
          
          if (descriptionError) {
            console.error('Failed to generate image description:', descriptionError);
            // Don't fail the upload if description generation fails
          } else {
            console.log(`✅ AI description generated for: ${file.name}`);
          }
        } catch (error) {
          console.error('Error generating image description:', error);
          // Don't fail the upload if description generation fails
        }
      }

      return dbResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: `Data uploaded successfully for ${farmerName}`,
      });
      
      // Show success message in modal
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000); // Hide after 5 seconds
      
      // Reset form but keep modal open
      setUploadData(prev => ({
        ...prev,
        file: null as any
      }));
      setSelectedFiles([]);
      setUploadProgress(null);
      
      // Invalidate queries to refresh the "Previously Uploaded" section
      queryClient.invalidateQueries({ queryKey: ['farmer-data-uploads', farmerId] });
      queryClient.invalidateQueries({ queryKey: ['farmer-data-uploads', farmerId, existingPhaseFilter] });
      queryClient.invalidateQueries({ queryKey: ['specialist-assignments'] });
      
      onUploadComplete?.();
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(null);
    }
  });

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    // Validate file type based on data type
    const allowedTypes = {
      photo: [
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/tif', 'image/heic', 'image/heif',
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
        // Videos
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/quicktime',
        // Archives
        'application/zip', 'application/x-zip-compressed'
      ],
      analysis: [
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv', 'application/json',
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/tif',
        // Videos
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/quicktime',
        // Archives
        'application/zip', 'application/x-zip-compressed'
      ],
      maps: [
        // Geospatial formats
        'application/json', 'application/xml', 'text/xml',
        'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz',
        'image/tiff', 'image/tif',
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
        // Videos
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/quicktime',
        // Archives
        'application/zip', 'application/x-zip-compressed'
      ],
      climate: [
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv', 'application/json',
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/tif',
        // Videos
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/quicktime',
        // Archives
        'application/zip', 'application/x-zip-compressed'
      ],
      text: [
        'text/plain', 'text/csv', 'application/json',
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/tif',
        // Videos
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/quicktime',
        // Archives
        'application/zip', 'application/x-zip-compressed'
      ],
      document: [
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/tif',
        // Videos
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/quicktime',
        // Archives
        'application/zip', 'application/x-zip-compressed'
      ],
      video: [
        // Videos
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/quicktime',
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/tif',
        // Archives
        'application/zip', 'application/x-zip-compressed'
      ]
    } as const;

    const typeAllowed = allowedTypes[uploadData.data_type]?.includes(file.type as any);
    if (!typeAllowed) {
      toast({
        title: "Invalid file type",
        description: `This file type is not allowed for ${DATA_TYPES[uploadData.data_type].name} data`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(prev => [...prev, file]);
  }, [uploadData.data_type]);

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((f) => handleFileSelect(f));
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((f) => handleFileSelect(f));
      e.currentTarget.value = '';
    }
  }, [handleFileSelect]);

  // Handle tag addition
  const handleAddTag = useCallback(() => {
    if (tagInput.trim() && !uploadData.tags.includes(tagInput.trim())) {
      setUploadData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  }, [tagInput, uploadData.tags]);

  // Handle tag removal
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setUploadData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    
    // Hide success message when starting new upload
    setShowSuccessMessage(false);
    
    try {
      // Validate session
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userErr || !userId) {
        toast({
          title: 'Session expired',
          description: 'Please sign in again to upload files.',
          variant: 'destructive',
        });
        return;
      }

      if (!f100Phase) {
        toast({
          title: 'Phase required',
          description: 'Please select a Phase (1-12) before uploading.',
          variant: 'destructive',
        });
        return;
      }

      for (const file of selectedFiles) {
        setUploadProgress({ file_name: file.name, progress: 0, status: 'uploading' });
        await uploadMutation.mutateAsync(file);
      }
    } finally {
      setUploadProgress(null);
    }
  }, [selectedFiles, uploadMutation]);

  // Get data type icon
  const getDataTypeIcon = (type: DataType) => {
    switch (type) {
      case 'photo':
        return <Image className="h-4 w-4" />;
      case 'analysis':
        return <FileText className="h-4 w-4" />;
      case 'maps':
        return <MapPin className="h-4 w-4" />;
      case 'climate':
        return <Sun className="h-4 w-4" />;
      case 'text':
        return <FileText className="h-4 w-4" />;
      case 'document':
        return <File className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Upload Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="data-upload-modal-desc">
        <DialogHeader>
          <DialogTitle>Upload Data for {farmerName}</DialogTitle>
          <DialogDescription id="data-upload-modal-desc">
            Upload photos, analysis files, geospatial data, and other documents for specialist analysis
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Data Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="data-type">Data Type</Label>
            <Select
              value={uploadData.data_type}
              onValueChange={(value) => setUploadData(prev => ({ ...prev, data_type: value as DataType }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DATA_TYPES).map(([key, type]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {getDataTypeIcon(key as DataType)}
                      <div>
                        <div className="font-medium">{type.name}</div>
                        <div className="text-xs text-gray-500">Max: {type.maxSize}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* F-100 Phase Selection */}
          <div className="space-y-2">
            <Label htmlFor="f100-phase">Phase</Label>
            <Select
              value={f100Phase ? String(f100Phase) : ''}
              onValueChange={(value) => setF100Phase(Number(value) as F100Phase)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Phases (1-12)" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Phase {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>File Upload</Label>
            {/* Always-mounted hidden input to support both initial select and Add more files */}
            <Input
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
              ref={fileInputRef}
              multiple
              accept={uploadData.data_type === 'photo' ? 'image/*' : undefined}
            />
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="max-h-40 overflow-auto space-y-2">
                    {selectedFiles.map((f, idx) => (
                      <div key={`${f.name}-${idx}`} className="flex items-center justify-between border rounded p-2">
                        <div>
                          <p className="text-sm font-medium">{f.name}</p>
                          <p className="text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Add more files
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Drop your file here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500">
                      Max file size: {DATA_TYPES[uploadData.data_type].maxSize}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the data being uploaded..."
              value={uploadData.description}
              onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                Add
              </Button>
            </div>
            {uploadData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploadProgress && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{uploadProgress.file_name}</span>
                    <span className="text-sm text-gray-500">{uploadProgress.progress}%</span>
                  </div>
                  <Progress value={uploadProgress.progress} className="w-full" />
                  <div className="flex items-center gap-2">
                    {uploadProgress.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {uploadProgress.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {uploadProgress.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm text-gray-600">
                      {uploadProgress.status === 'uploading' && 'Uploading...'}
                      {uploadProgress.status === 'processing' && 'Processing...'}
                      {uploadProgress.status === 'completed' && 'Completed'}
                      {uploadProgress.status === 'error' && uploadProgress.error}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Message */}
          {showSuccessMessage && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Data uploaded successfully! You can upload more files or close this dialog.
              </span>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={selectedFiles.length === 0 || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Data
                </>
              )}
            </Button>
          </div>

          {/* Existing Uploads */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Previously Uploaded</Label>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Phase:</div>
                <select
                  value={existingPhaseFilter}
                  onChange={(e) => setExistingPhaseFilter(e.target.value)}
                  className="h-8 rounded-md border px-2 text-sm bg-background"
                >
                  <option value="all">All</option>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(p => (
                    <option key={p} value={p}>Phase {p}</option>
                  ))}
                </select>
                {(existingPhaseFilter !== 'all') && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExistingPhaseFilter('all')}>
                    Reset
                  </Button>
                )}
              </div>
            </div>
            {uploadsLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (existingUploads as UploadRow[]).length === 0 ? (
              <div className="text-sm text-gray-500">No files uploaded yet.</div>
            ) : (
              <div className="max-h-48 overflow-auto border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Size</th>
                      <th className="text-left p-2">Phase</th>
                      <th className="text-left p-2">Uploaded</th>
                      <th className="text-left p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(existingUploads as UploadRow[]).map((u: UploadRow) => (
                      <tr key={u.id} className="border-t">
                        <td className="p-2 break-all">{u.file_name}</td>
                        <td className="p-2">{u.data_type}</td>
                        <td className="p-2">{(u.file_size_bytes / 1024 / 1024).toFixed(2)} MB</td>
                        <td className="p-2">
                          {getPhaseLabel((u.metadata?.f100_phase as F100Phase | undefined) ?? (u.phase as F100Phase))}
                        </td>
                        <td className="p-2">{new Date(u.created_at).toLocaleString()}</td>
                        <td className="p-2 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Download"
                            onClick={async () => {
                              const { data } = await supabase
                                .storage
                                .from('farmer-documents')
                                .createSignedUrl(u.file_path, 3600);
                              if (data?.signedUrl) {
                                window.open(data.signedUrl, '_blank');
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                              <path fillRule="evenodd" d="M11.25 3a.75.75 0 0 1 1.5 0v9.19l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0L6.72 10.78a.75.75 0 1 1 1.06-1.06l2.47 2.47V3z" clipRule="evenodd" />
                              <path d="M4.5 15.75a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 .75.75V18A2.25 2.25 0 0 1 17.25 20.25H6.75A2.25 2.25 0 0 1 4.5 18v-2.25z" />
                            </svg>
                          </Button>
                          {userProfile?.role === 'admin' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Delete"
                              onClick={() => {
                                setUploadToDelete({
                                  id: u.id,
                                  file_name: u.file_name,
                                  file_path: u.file_path
                                });
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => {
        setDeleteConfirmOpen(open);
        if (!open) {
          setUploadToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Uploaded File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this uploaded file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!uploadToDelete) {
                  setDeleteConfirmOpen(false);
                  return;
                }
                try {
                  const { error: delErr } = await supabase
                    .from('farmer_data_uploads')
                    .delete()
                    .eq('id', uploadToDelete.id);
                  if (delErr) {
                    toast({ title: 'Delete failed', description: delErr.message, variant: 'destructive' });
                    return;
                  }
                  await supabase.storage.from('farmer-documents').remove([uploadToDelete.file_path]);
                  queryClient.invalidateQueries({ queryKey: ['farmer-data-uploads', farmerId] });
                  toast({ title: 'Deleted', description: `${uploadToDelete.file_name} removed.` });
                } finally {
                  setUploadToDelete(null);
                  setDeleteConfirmOpen(false);
                }
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
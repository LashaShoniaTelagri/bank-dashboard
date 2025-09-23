import React, { useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Progress } from "./ui/progress";
import { 
  Upload, 
  FileText, 
  Image, 
  MapPin, 
  Video, 
  Music, 
  File,
  X,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "./ui/use-toast";
import { DataUploadForm, DataType, AnalysisPhase, UploadProgress } from "../types/specialist";
import { DATA_TYPES, ANALYSIS_PHASES } from "../types/specialist";

interface DataUploadModalProps {
  farmerId: string;
  farmerName: string;
  onUploadComplete?: () => void;
}

export const DataUploadModal: React.FC<DataUploadModalProps> = ({
  farmerId,
  farmerName,
  onUploadComplete
}) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [uploadData, setUploadData] = useState<DataUploadForm>({
    farmer_id: farmerId,
    data_type: 'photo',
    file: null as any,
    description: '',
    tags: [],
    phase: 'initial_assessment'
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const queryClient = useQueryClient();

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: DataUploadForm) => {
      if (!formData.file) {
        throw new Error('No file selected');
      }

      // Validate file size
      const maxSize = parseInt(DATA_TYPES[formData.data_type].maxSize.replace('MB', '')) * 1024 * 1024;
      if (formData.file.size > maxSize) {
        throw new Error(`File size exceeds maximum allowed size of ${DATA_TYPES[formData.data_type].maxSize}`);
      }

      // Generate unique file path
      const fileExt = formData.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `farmer-data/${farmerId}/${formData.phase}/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('farmer-documents')
        .upload(filePath, formData.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Insert record into database
      const { data, error } = await supabase
        .from('farmer_data_uploads')
        .insert({
          farmer_id: formData.farmer_id,
          bank_id: profile?.bank_id || '',
          uploaded_by: profile?.user_id || '',
          data_type: formData.data_type,
          file_name: formData.file.name,
          file_path: filePath,
          file_mime: formData.file.type,
          file_size_bytes: formData.file.size,
          description: formData.description,
          tags: formData.tags,
          phase: formData.phase,
          metadata: {
            original_name: formData.file.name,
            upload_timestamp: new Date().toISOString(),
            uploader_role: profile?.role
          }
        })
        .select()
        .single();

      if (error) {
        // Clean up uploaded file if database insert fails
        await supabase.storage
          .from('farmer-documents')
          .remove([filePath]);
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: `Data uploaded successfully for ${farmerName}`,
      });
      
      // Reset form
      setUploadData({
        farmer_id: farmerId,
        data_type: 'photo',
        file: null as any,
        description: '',
        tags: [],
        phase: 'initial_assessment'
      });
      setUploadProgress(null);
      setIsOpen(false);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['farmer-data-uploads', farmerId] });
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
      photo: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      analysis: ['application/pdf', 'text/plain', 'application/json'],
      geospatial: ['application/json', 'text/csv', 'application/zip'],
      text: ['text/plain', 'application/pdf', 'text/csv'],
      document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
      audio: ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg']
    };

    const typeAllowed = allowedTypes[uploadData.data_type]?.includes(file.type);
    if (!typeAllowed) {
      toast({
        title: "Invalid file type",
        description: `This file type is not allowed for ${DATA_TYPES[uploadData.data_type].name} data`,
        variant: "destructive",
      });
      return;
    }

    setUploadData(prev => ({ ...prev, file }));
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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
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
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate(uploadData);
  }, [uploadData, uploadMutation]);

  // Get data type icon
  const getDataTypeIcon = (type: DataType) => {
    switch (type) {
      case 'photo':
        return <Image className="h-4 w-4" />;
      case 'analysis':
        return <FileText className="h-4 w-4" />;
      case 'geospatial':
        return <MapPin className="h-4 w-4" />;
      case 'text':
        return <FileText className="h-4 w-4" />;
      case 'document':
        return <File className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Data for {farmerName}</DialogTitle>
          <DialogDescription>
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

          {/* Phase Selection */}
          <div className="space-y-2">
            <Label htmlFor="phase">Analysis Phase</Label>
            <Select
              value={uploadData.phase}
              onValueChange={(value) => setUploadData(prev => ({ ...prev, phase: value as AnalysisPhase }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select analysis phase" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ANALYSIS_PHASES).map(([key, phase]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <div className="font-medium">{phase.name}</div>
                      <div className="text-xs text-gray-500">{phase.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>File Upload</Label>
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
              {uploadData.file ? (
                <div className="space-y-2">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                  <p className="font-medium text-green-700">{uploadData.file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(uploadData.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadData(prev => ({ ...prev, file: null as any }))}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Drop your file here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500">
                      Max file size: {DATA_TYPES[uploadData.data_type].maxSize}
                    </p>
                  </div>
                  <Input
                    type="file"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="file-upload"
                    accept={uploadData.data_type === 'photo' ? 'image/*' : undefined}
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm">
                      Choose File
                    </Button>
                  </Label>
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
              disabled={!uploadData.file || uploadMutation.isPending}
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
        </form>
      </DialogContent>
    </Dialog>
  );
};
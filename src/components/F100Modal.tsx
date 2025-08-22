import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, Eye, Edit, FileText } from "lucide-react";

interface F100ModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
  farmerName: string;
  editMode?: boolean;
  phaseData?: {
    phase: number;
    issue_date: string;
    score: number;
    file_path: string;
  };
}

export const F100Modal = ({ isOpen, onClose, farmerId, farmerName, editMode = false, phaseData }: F100ModalProps) => {
  const [formData, setFormData] = useState({
    phase: '',
    issue_date: '',
    score: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const queryClient = useQueryClient();

  // Initialize form data when in edit mode
  useEffect(() => {
    if (editMode && phaseData) {
      setFormData({
        phase: phaseData.phase.toString(),
        issue_date: phaseData.issue_date,
        score: phaseData.score.toString(),
      });
    } else {
      // Reset form when not in edit mode
      setFormData({
        phase: '',
        issue_date: '',
        score: '',
      });
      setFile(null);
    }
  }, [editMode, phaseData]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      // In edit mode, file is optional (only if they want to replace it)
      if (!editMode && !file) throw new Error('No file selected');
      if (!formData.phase || !formData.issue_date || !formData.score) {
        throw new Error('All fields are required');
      }

      const score = parseFloat(formData.score);
      if (score < 0 || score > 10) {
        throw new Error('Score must be between 0 and 10');
      }

      // Get farmer details to determine bank_id
      const { data: farmer, error: farmerError } = await supabase
        .from('farmers')
        .select('bank_id')
        .eq('id', farmerId)
        .single();

      if (farmerError) throw farmerError;

      let filePath = phaseData?.file_path; // Keep existing file path if no new file
      let fileMime = '';
      let fileSize = 0;

      // Only upload new file if one is selected
      if (file) {
        // Create file path
        const fileExtension = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExtension}`;
        filePath = `bank/${farmer.bank_id}/farmer/${farmerId}/phase-${formData.phase}/${fileName}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('f100')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        
        fileMime = file.type;
        fileSize = file.size;

        // Delete old file if updating
        if (editMode && phaseData?.file_path) {
          await supabase.storage
            .from('f100')
            .remove([phaseData.file_path]);
        }
      }

      if (editMode) {
        // Update existing F100 record
        const updateData: any = {
          issue_date: formData.issue_date,
          score: score,
        };
        
        // Only update file-related fields if new file was uploaded
        if (file && filePath) {
          updateData.file_path = filePath;
          updateData.file_mime = fileMime;
          updateData.file_size_bytes = fileSize;
        }

        const { error: updateError } = await supabase
          .from('f100')
          .update(updateData)
          .eq('farmer_id', farmerId)
          .eq('phase', parseInt(formData.phase));

        if (updateError) throw updateError;
      } else {
        // Create new F100 record
        const { error: insertError } = await supabase.from('f100').insert({
          farmer_id: farmerId,
          bank_id: farmer.bank_id,
          phase: parseInt(formData.phase),
          issue_date: formData.issue_date,
          score: score,
          file_path: filePath!,
          file_mime: fileMime,
          file_size_bytes: fileSize,
        });

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      toast({ 
        title: editMode ? "F-100 report updated successfully" : "F-100 report uploaded successfully" 
      });
      onClose();
      // Reset form
      setFormData({ phase: '', issue_date: '', score: '' });
      setFile(null);
    },
    onError: (error) => {
      toast({
        title: editMode ? "Error updating F-100 report" : "Error uploading F-100 report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type (PDF)
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const phases = Array.from({ length: 12 }, (_, i) => i + 1);

  // Check if this is view-only mode (editMode false with existing data)
  const isViewOnly = !editMode && phaseData;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isViewOnly ? (
              <>
                <Eye className="h-5 w-5 text-emerald-600" />
                View F-100 Report - Phase {phaseData?.phase}
              </>
            ) : editMode ? (
              <>
                <Edit className="h-5 w-5 text-emerald-600" />
                Edit F-100 Report - Phase {phaseData?.phase}
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 text-emerald-600" />
                Upload F-100 Report
              </>
            )}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            For farmer: {farmerName}
            {isViewOnly && <span className="ml-2 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">(Read-only)</span>}
          </p>
        </DialogHeader>

        {isViewOnly ? (
          // Read-only view for bank viewers
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Phase</Label>
              <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                Phase {phaseData?.phase}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Issue Date</Label>
              <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                {phaseData?.issue_date ? new Date(phaseData.issue_date).toLocaleDateString() : 'Not set'}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Score (0-10)</Label>
              <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                {phaseData?.score || 'Not set'}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">PDF File</Label>
              <div className="mt-2">
                {phaseData?.file_path ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-2 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-lg transform transition-all duration-200 hover:scale-[1.02] shadow-md"
                    onClick={() => {
                      try {
                        const { data } = supabase.storage.from('f100').getPublicUrl(phaseData.file_path);
                        window.open(data.publicUrl, '_blank');
                      } catch (err) {
                        toast({
                          title: "Error opening file",
                          description: "Storage bucket may not be configured. Please check if 'f100' bucket exists.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    📄 View PDF File
                  </Button>
                ) : (
                  <div className="p-2 bg-muted rounded-md text-sm text-muted-foreground">
                    No file uploaded
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                className="flex-1 border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transform transition-all duration-200 hover:scale-[1.02] shadow-md"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          // Editable form for admins
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phase">Phase *</Label>
            <Select
              value={formData.phase}
              onValueChange={(value) => setFormData({ ...formData, phase: value })}
              disabled={editMode}
            >
              <SelectTrigger className="focus:ring-emerald-400">
                <SelectValue placeholder="Select phase" />
              </SelectTrigger>
              <SelectContent>
                {phases.map((phase) => (
                  <SelectItem 
                    key={phase} 
                    value={phase.toString()}
                    className="focus:bg-slate-100 focus:text-slate-900 hover:bg-slate-50 hover:text-slate-900"
                  >
                    Phase {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="issue_date">Issue Date *</Label>
            <Input
              id="issue_date"
              type="date"
              value={formData.issue_date}
              onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="score">Score (0-10) *</Label>
            <Input
              id="score"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={formData.score}
              onChange={(e) => setFormData({ ...formData, score: e.target.value })}
              placeholder="Enter score"
              required
            />
          </div>

          <div>
            <Label htmlFor="file">
              PDF File {editMode ? '(optional - only if replacing current file)' : '*'}
            </Label>
            <div className="mt-2">
              <input
                id="file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transform transition-all duration-200 hover:scale-[1.02] shadow-md"
                onClick={() => document.getElementById('file')?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {file ? file.name : 'Select PDF file'}
              </Button>
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
              {editMode && phaseData?.file_path && !file && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-2 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-lg transform transition-all duration-200 hover:scale-[1.02] shadow-md"
                  onClick={() => {
                    try {
                      const { data } = supabase.storage.from('f100').getPublicUrl(phaseData.file_path);
                      window.open(data.publicUrl, '_blank');
                    } catch (err) {
                      toast({
                        title: "Error opening file",
                        description: "Storage bucket may not be configured. Please check if 'f100' bucket exists.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  📄 View Current File
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={
                uploadMutation.isPending || 
                (!editMode && !file) || 
                !formData.phase || 
                !formData.issue_date || 
                !formData.score
              }
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
            >
              {uploadMutation.isPending 
                ? (editMode ? 'Updating...' : 'Uploading...') 
                : (editMode ? 'Update F-100' : 'Upload F-100')
              }
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transform transition-all duration-200 hover:scale-[1.02] shadow-md"
            >
              Cancel
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
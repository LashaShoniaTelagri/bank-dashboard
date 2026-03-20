import { useState, useRef, useCallback } from "react";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { UnderwritingLayout } from "@/components/UnderwritingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, FileArchive, X, CheckCircle2, Loader2, AlertCircle, FileText, Plus, Link } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useSubmitApplication, useActiveCropTypes, useSubmitCropRequest } from "@/hooks/useUnderwriting";
import { CROP_TYPES, MAX_FILE_SIZE, formatAppNumber, getScoringCountdown } from "@/types/underwriting";

export const UnderwritingSubmit = () => {
  const { profile } = useAuth();
  const userProfile = profile as UserProfile | null;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitMutation = useSubmitApplication();
  const { data: dbCrops } = useActiveCropTypes();
  const cropRequestMutation = useSubmitCropRequest();

  const cropOptions = dbCrops && dbCrops.length > 0
    ? dbCrops.map((c) => ({ value: c.value, label: c.label }))
    : [...CROP_TYPES];

  const [cropType, setCropType] = useState<string>("");
  const [farmStatus, setFarmStatus] = useState<string>("Planted");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submittedApp, setSubmittedApp] = useState<{ id: string; submittedAt: string } | null>(null);
  const [showCropRequest, setShowCropRequest] = useState(false);
  const [newCropName, setNewCropName] = useState("");
  const [shapefileUrls, setShapefileUrls] = useState<string[]>([]);

  const validateFile = useCallback((f: File): string | null => {
    if (f.size > MAX_FILE_SIZE) {
      return `File is too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.`;
    }
    const ext = f.name.toLowerCase().split(".").pop();
    if (!["zip", "shp", "kml", "kmz"].includes(ext || "")) {
      return "Invalid file format. Please upload a .zip, .shp, .kml, or .kmz file.";
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const selectedFile = files[0];
      const error = validateFile(selectedFile);
      if (error) {
        toast({ title: "Invalid File", description: error, variant: "destructive" });
        return;
      }
      setFile(selectedFile);
    },
    [validateFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleSubmit = async () => {
    if (!userProfile?.bank_id) {
      toast({ title: "Error", description: "Bank information not found.", variant: "destructive" });
      return;
    }
    if (!cropType) {
      toast({ title: "Missing Information", description: "Please select a crop type.", variant: "destructive" });
      return;
    }
    if (!farmStatus) {
      toast({ title: "Missing Information", description: "Please select a farm status.", variant: "destructive" });
      return;
    }

    const cleanUrls = shapefileUrls.filter((u) => u.trim());
    if (!file && cleanUrls.length === 0) {
      toast({ title: "Missing Location Data", description: "Please upload a shapefile or attach at least one link.", variant: "destructive" });
      return;
    }

    const invalidUrl = cleanUrls.find((u) => !/^https?:\/\/.+/.test(u.trim()));
    if (invalidUrl) {
      toast({ title: "Invalid URL", description: "All links must start with http:// or https://", variant: "destructive" });
      return;
    }

    setUploadProgress(10);
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 5, 90));
    }, 200);

    try {
      const result = await submitMutation.mutateAsync({
        bankId: userProfile.bank_id,
        cropType,
        farmStatus,
        notes: notes || undefined,
        file: file || undefined,
        shapefileUrls: cleanUrls.length > 0 ? cleanUrls : undefined,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setSubmittedApp({
        id: result.id,
        submittedAt: result.submitted_at,
      });

      toast({ title: "Application Submitted", description: `Application ${formatAppNumber(result.id)} created successfully.` });
    } catch (error: any) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (submittedApp) {
    return (
      <UnderwritingLayout title="Submit Application">
        <div className="max-w-lg mx-auto mt-8">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Application Submitted</h2>
              <p className="text-muted-foreground mb-6">Your underwriting application has been received.</p>

              <div className="bg-muted rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Application Number</span>
                  <span className="font-mono font-bold text-foreground">{formatAppNumber(submittedApp.id)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Submitted At</span>
                  <span className="text-foreground">
                    {new Date(submittedApp.submittedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expected Score</span>
                  <span className="text-foreground font-medium">
                    {getScoringCountdown(submittedApp.submittedAt, false).label}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 hover:bg-muted dark:hover:bg-muted/80"
                  onClick={() => {
                    setSubmittedApp(null);
                    setCropType("");
                    setFarmStatus("Planted");
                    setNotes("");
                    setFile(null);
                    setShapefileUrls([]);
                    setUploadProgress(0);
                  }}
                >
                  Submit Another
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white"
                  onClick={() => navigate("/underwriting/applications")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Applications
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </UnderwritingLayout>
    );
  }

  return (
    <UnderwritingLayout title="Submit Application">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">New Application</CardTitle>
           
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Crop Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Crop Type <span className="text-destructive">*</span>
              </label>
              <Select value={cropType} onValueChange={(v) => {
                if (v === '__request_new__') {
                  setShowCropRequest(true);
                  return;
                }
                setCropType(v);
              }}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select crop type" />
                </SelectTrigger>
                <SelectContent>
                  {cropOptions.map((crop) => (
                    <SelectItem key={crop.value} value={crop.value}>
                      {crop.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="__request_new__" className="text-primary font-medium border-t border-border mt-1 pt-1">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Request New Crop
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Request New Crop inline form */}
              {showCropRequest && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-muted/50 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Can't find your crop? Submit a request and an admin will review it.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter crop name..."
                      value={newCropName}
                      onChange={(e) => setNewCropName(e.target.value)}
                      className="bg-background flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!newCropName.trim() || cropRequestMutation.isPending}
                      onClick={async () => {
                        try {
                          await cropRequestMutation.mutateAsync({
                            cropName: newCropName.trim(),
                            bankId: userProfile?.bank_id,
                          });
                          toast({
                            title: "Request Submitted",
                            description: `Your request for "${newCropName.trim()}" has been sent to the admin for review.`,
                          });
                          setNewCropName("");
                          setShowCropRequest(false);
                        } catch (error: any) {
                          toast({
                            title: "Request Failed",
                            description: error.message || "Could not submit crop request.",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="hover:bg-muted dark:hover:bg-muted/80"
                    >
                      {cropRequestMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Submit Request"
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowCropRequest(false); setNewCropName(""); }}
                    className="text-xs text-muted-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Farm Status */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Farm Status <span className="text-destructive">*</span>
              </label>
              <Select value={farmStatus} onValueChange={setFarmStatus}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select farm status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planted">Planted</SelectItem>
                  <SelectItem value="Not Planted">Not Planted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Upload the location data
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/10"
                    : file
                    ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".zip,.shp,.kml,.kmz"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileArchive className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div className="text-left">
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 hover:bg-muted dark:hover:bg-muted/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-foreground font-medium">Drop your file here, or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Accepts .zip, .shp, .kml, or .kmz files up to 50MB
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Shapefile URLs */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or attach a link</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {shapefileUrls.map((url, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={url}
                        onChange={(e) => {
                          const updated = [...shapefileUrls];
                          updated[idx] = e.target.value;
                          setShapefileUrls(updated);
                        }}
                        placeholder="https://drive.google.com/..."
                        className="bg-background pl-8 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShapefileUrls(shapefileUrls.filter((_, i) => i !== idx))}
                      className="shrink-0 hover:bg-muted dark:hover:bg-muted/80"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {shapefileUrls.length < 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShapefileUrls([...shapefileUrls, ""])}
                    className="text-xs hover:bg-muted dark:hover:bg-muted/80"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add link
                  </Button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Note <span className="text-muted-foreground">(optional, max 500 characters)</span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                placeholder="Additional information about the land parcel..."
                className="bg-background resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{notes.length}/500</p>
            </div>

            {/* Upload Progress */}
            {submitMutation.isPending && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Uploading...</span>
                  <span className="text-foreground font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Error Display */}
            {submitMutation.isError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{submitMutation.error?.message || "An error occurred"}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!cropType || !farmStatus || (!file && shapefileUrls.filter((u) => u.trim()).length === 0) || submitMutation.isPending}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-400/40 transform transition-all duration-200 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Application
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </UnderwritingLayout>
  );
};

export default UnderwritingSubmit;

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Save, Users } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useSubmitScore, useApplicationScores, useAssignedSpecialists, useListSpecialists, useActiveCropTypes } from "@/hooks/useUnderwriting";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { UnderwritingApplication } from "@/types/underwriting";
import { formatAppNumber, STATUS_LABELS, STATUS_COLORS, CROP_TYPES } from "@/types/underwriting";

interface ScoringModalProps {
  application: UnderwritingApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ScoringModal = ({ application, open, onOpenChange }: ScoringModalProps) => {
  const { profile } = useAuth();
  const userProfile = profile as UserProfile | null;
  const canScore = userProfile?.role === 'admin' || userProfile?.role === 'specialist';

  const submitScore = useSubmitScore();
  const { data: existingScores } = useApplicationScores(application?.id || "");
  const { data: assignedSpecialists } = useAssignedSpecialists(application?.id || "");
  const { data: specialistsList } = useListSpecialists(application?.bank_id);
  const { data: dbCrops } = useActiveCropTypes();

  const [overallScore, setOverallScore] = useState(50);
  const [landSuitability, setLandSuitability] = useState(50);
  const [cropViability, setCropViability] = useState(50);
  const [riskAssessment, setRiskAssessment] = useState(50);
  const [historicalData, setHistoricalData] = useState(50);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (existingScores && existingScores.length > 0) {
      const latest = existingScores[0];
      setOverallScore(Number(latest.overall_score));
      setLandSuitability(Number(latest.land_suitability ?? 50));
      setCropViability(Number(latest.crop_viability ?? 50));
      setRiskAssessment(Number(latest.risk_assessment ?? 50));
      setHistoricalData(Number(latest.historical_data ?? 50));
      setNotes(latest.notes || "");
    } else {
      setOverallScore(50);
      setLandSuitability(50);
      setCropViability(50);
      setRiskAssessment(50);
      setHistoricalData(50);
      setNotes("");
    }
  }, [existingScores, application?.id]);

  const handleDownloadShapefile = async () => {
    if (!application?.shapefile_path) {
      toast({ title: "No File", description: "No shapefile attached to this application.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.storage
      .from("underwriting-files")
      .createSignedUrl(application.shapefile_path, 300);
    if (error) {
      toast({ title: "Download Failed", description: error.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleSubmitScore = async (isDraft: boolean) => {
    if (!application) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await submitScore.mutateAsync({
        application_id: application.id,
        overall_score: overallScore,
        land_suitability: landSuitability,
        crop_viability: cropViability,
        risk_assessment: riskAssessment,
        historical_data: historicalData,
        notes: notes || null,
        scored_by: user.id,
        is_draft: isDraft,
      });

      toast({
        title: isDraft ? "Draft Saved" : "Score Submitted",
        description: isDraft
          ? "Your scoring progress has been saved."
          : `Application ${formatAppNumber(application.id)} has been scored.`,
      });

      if (!isDraft) {
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Scoring Failed",
        description: error.message || "Failed to submit score.",
        variant: "destructive",
      });
    }
  };

  if (!application) return null;

  const cropLabel = (dbCrops && dbCrops.length > 0
    ? dbCrops.find((c) => c.value === application.crop_type)?.label
    : CROP_TYPES.find((c) => c.value === application.crop_type)?.label
  ) || application.crop_type;

  const scoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono">{formatAppNumber(application.id)}</span>
            <Badge className={STATUS_COLORS[application.status]}>
              {STATUS_LABELS[application.status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {cropLabel} - Submitted {new Date(application.submitted_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Application Details */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted">
            <div>
              <p className="text-xs text-muted-foreground">Crop Type</p>
              <p className="font-medium text-foreground">{cropLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{STATUS_LABELS[application.status]}</p>
            </div>
            {application.notes && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm text-foreground">{application.notes}</p>
              </div>
            )}
          </div>

          {/* Assigned Specialists */}
          {assignedSpecialists && assignedSpecialists.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Assigned Specialists ({assignedSpecialists.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignedSpecialists.map((a) => {
                  const spec = specialistsList?.find((s) => s.user_id === a.specialist_id);
                  const email = spec?.email ?? a.specialist_id.slice(0, 8);
                  return (
                    <Badge
                      key={a.id}
                      variant="secondary"
                      className="text-xs gap-1"
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        {email.charAt(0).toUpperCase()}
                      </span>
                      {email}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Download Shapefile */}
          {application.shapefile_path && (
            <Button
              variant="outline"
              onClick={handleDownloadShapefile}
              className="w-full hover:bg-muted dark:hover:bg-muted/80"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Shapefile
            </Button>
          )}

          {/* Scoring - admin/specialist only */}
          {canScore ? (
            <>
              <div className="space-y-5">
                <h3 className="font-semibold text-foreground">Score Assessment</h3>

                <ScoreSlider
                  label="Overall Score"
                  value={overallScore}
                  onChange={setOverallScore}
                  colorFn={scoreColor}
                />
                {/* <ScoreSlider
                  label="Land Suitability"
                  value={landSuitability}
                  onChange={setLandSuitability}
                  colorFn={scoreColor}
                />
                <ScoreSlider
                  label="Crop Viability"
                  value={cropViability}
                  onChange={setCropViability}
                  colorFn={scoreColor}
                />
                <ScoreSlider
                  label="Risk Assessment"
                  value={riskAssessment}
                  onChange={setRiskAssessment}
                  colorFn={scoreColor}
                />
                <ScoreSlider
                  label="Historical Data"
                  value={historicalData}
                  onChange={setHistoricalData}
                  colorFn={scoreColor}
                /> */}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Scoring Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Assessment notes and observations..."
                  className="bg-background resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => handleSubmitScore(true)}
                  disabled={submitScore.isPending}
                  className="flex-1 hover:bg-muted dark:hover:bg-muted/80"
                >
                  {submitScore.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSubmitScore(false)}
                  disabled={submitScore.isPending}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white"
                >
                  {submitScore.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Submit Score
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Read-only score display for bank viewers */}
              {existingScores && existingScores.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Score Results</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <ScoreDisplay label="Overall Score" value={Number(existingScores[0].overall_score)} colorFn={scoreColor} />
                    {/* <ScoreDisplay label="Land Suitability" value={Number(existingScores[0].land_suitability)} colorFn={scoreColor} />
                    <ScoreDisplay label="Crop Viability" value={Number(existingScores[0].crop_viability)} colorFn={scoreColor} />
                    <ScoreDisplay label="Risk Assessment" value={Number(existingScores[0].risk_assessment)} colorFn={scoreColor} />
                    <ScoreDisplay label="Historical Data" value={Number(existingScores[0].historical_data)} colorFn={scoreColor} /> */}
                  </div>
                  {existingScores[0].notes && (
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-xs text-muted-foreground mb-1">Scoring Notes</p>
                      <p className="text-sm text-foreground">{existingScores[0].notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    This application is awaiting review. You will be able to see the score once it has been assessed.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

function ScoreSlider({
  label,
  value,
  onChange,
  colorFn,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  colorFn: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${colorFn(value)}`}>{value}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={0}
        max={100}
        step={0.5}
        className="w-full"
      />
    </div>
  );
}

function ScoreDisplay({
  label,
  value,
  colorFn,
}: {
  label: string;
  value: number | null;
  colorFn: (v: number) => string;
}) {
  if (value == null) return null;
  return (
    <div className="p-3 rounded-lg bg-muted">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${colorFn(value)}`}>{value}</p>
    </div>
  );
}

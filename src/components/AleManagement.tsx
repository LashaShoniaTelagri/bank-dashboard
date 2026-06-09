import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Sprout, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { CropListView } from "./ale/CropListView";
import { CropDetailView } from "./ale/CropDetailView";
import { GraphBuilder } from "./ale/builder/GraphBuilder";
import type { Crop } from "./ale/aleShared";

// Classic underline-style tab header: muted by default, emerald underline +
// label when active, connecting visually to the bordered panel below.
const CLASSIC_TAB =
  "gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 font-medium text-muted-foreground shadow-none " +
  "data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-700 " +
  "data-[state=active]:shadow-none dark:data-[state=active]:text-emerald-400";

/**
 * ALE — Agronomical Logic Engine. Shell for the two ALE modules:
 *  - Crop Management: catalogue of crops + their agronomic parameters.
 *  - Run Analysis: location + crop → frost-risk result (built in Phase 2).
 * Mounted unchanged in AdminDashboard and (access-gated) SpecialistDashboard.
 * See specs/modules/ale.md.
 */
export const AleManagement = () => {
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);

  const { data: crops, isLoading, error } = useQuery({
    queryKey: ["ale-crops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ale_crops")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return data as Crop[];
    },
  });

  const selectedCrop = selectedCropId ? crops?.find((c) => c.id === selectedCropId) : undefined;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-full bg-amber-100 dark:bg-amber-950/30 p-2">
          <FlaskConical className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-heading-primary">Agronomical Logic Engine</h2>
          <p className="text-xs text-body-secondary">
            Manage crops and run frost-risk analysis. Spec: <code className="text-[11px]">specs/modules/ale.md</code>
          </p>
        </div>
      </header>

      <Tabs defaultValue="crops">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="crops" className={CLASSIC_TAB}>
            <Sprout className="h-4 w-4" /> Crop Management
          </TabsTrigger>
          <TabsTrigger value="run" className={CLASSIC_TAB}>
            <Play className="h-4 w-4" /> Run Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crops" className="mt-0 rounded-b-lg border border-t-0 bg-card p-4 sm:p-6">
          {selectedCrop
            ? <CropDetailView crop={selectedCrop} onBack={() => setSelectedCropId(null)} />
            : <CropListView crops={crops} isLoading={isLoading} error={error as Error | null} onSelect={setSelectedCropId} />}
        </TabsContent>

        <TabsContent value="run" className="mt-0 rounded-b-lg border border-t-0 bg-card p-4 sm:p-6">
          <GraphBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
};

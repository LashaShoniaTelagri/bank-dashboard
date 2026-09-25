import { useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useQuery } from "@tanstack/react-query";
import { Sprout, CloudSun, Satellite, Snowflake, Flame, ThermometerSnowflake, BarChart3, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import LocationPickerModal from "../../LocationPickerModal";
import { NODE_ACCENT, type AleNodeType, type InputsNodeData, type LocationValue, type HeatStressNodeData, type InsufficientChillNodeData } from "./graphTypes";

// Shared shell: accent-bordered card + title. Handles are added per node.
const NodeShell = ({ type, icon: Icon, title, subtitle, children, dim }: {
  type: AleNodeType;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  dim?: boolean;
}) => (
  <div className={`min-w-[180px] rounded-md border border-l-4 bg-card shadow-sm ${NODE_ACCENT[type]} ${dim ? "opacity-60" : ""}`}>
    <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-body-secondary" />
      <span className="text-xs font-semibold text-heading-primary">{title}</span>
      {subtitle && <span className="ml-auto text-[10px] text-body-secondary">{subtitle}</span>}
    </div>
    {children && <div className="px-2.5 py-2">{children}</div>}
  </div>
);

const handleStyle = { width: 9, height: 9, background: "#10b981" };

function InputsNode({ id, data }: NodeProps) {
  const d = (data ?? {}) as InputsNodeData;
  const { updateNodeData } = useReactFlow();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: crops } = useQuery({
    queryKey: ["ale-crops-run"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ale_crops").select("slug, display_name").eq("is_active", true).order("display_name");
      if (error) throw error;
      return data;
    },
  });
  const { data: varieties } = useQuery({
    queryKey: ["ale-run-varieties", d.crop],
    enabled: !!d.crop,
    queryFn: async () => {
      const { data: crop } = await supabase.from("ale_crops").select("id").eq("slug", d.crop).maybeSingle();
      if (!crop) return [];
      const { data, error } = await supabase.from("ale_crop_varieties").select("display_name, gdh_to_bloom").eq("crop_id", crop.id).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <NodeShell type="inputs" icon={Sprout} title="Inputs">
      <div className="nodrag space-y-2" style={{ width: 200 }}>
        <Select value={d.crop ?? ""} onValueChange={(v) => updateNodeData(id, { crop: v, variety: undefined })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Crop" /></SelectTrigger>
          <SelectContent>{crops?.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.display_name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={d.variety ?? ""} onValueChange={(v) => updateNodeData(id, { variety: v })} disabled={!d.crop}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Variety" /></SelectTrigger>
          <SelectContent>
            {varieties?.map((v) => (
              <SelectItem key={v.display_name} value={v.display_name} disabled={v.gdh_to_bloom == null}>
                {v.display_name}{v.gdh_to_bloom == null ? " (no GDH)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-1.5 text-xs font-normal" onClick={() => setPickerOpen(true)}>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{d.location ? (d.location.name || `${d.location.lat.toFixed(3)}, ${d.location.lng.toFixed(3)}`) : "Pick location"}</span>
        </Button>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <LocationPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialLocation={d.location ?? undefined}
        onLocationSelect={(loc) => {
          if (loc.lat != null && loc.lng != null) updateNodeData(id, { location: { name: loc.name, lat: loc.lat, lng: loc.lng } as LocationValue });
          setPickerOpen(false);
        }}
      />
    </NodeShell>
  );
}

function WeatherNode() {
  return (
    <NodeShell type="weather" icon={CloudSun} title="Weather" subtitle="Open-Meteo">
      <p className="text-[11px] text-body-secondary">Hourly temperature series</p>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </NodeShell>
  );
}

function SatelliteNode() {
  return (
    <NodeShell type="satellite" icon={Satellite} title="Satellite" subtitle="soon" dim>
      <p className="text-[11px] text-body-secondary">Image-based analysis (coming soon)</p>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: "#94a3b8" }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: "#94a3b8" }} />
    </NodeShell>
  );
}

function FrostRiskNode() {
  return (
    <NodeShell type="frost-risk" icon={Snowflake} title="Frost-risk" subtitle="algorithm">
      <p className="text-[11px] text-body-secondary">Chill · bloom · frost damage</p>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </NodeShell>
  );
}

function HeatStressNode({ id, data }: NodeProps) {
  const d = (data ?? {}) as HeatStressNodeData;
  const { updateNodeData } = useReactFlow();
  // Heat-stress analyses a COMPLETED season (needs weather through Sep 30), so
  // the latest selectable year is the most recent season whose Sep 30 has passed.
  const now = new Date();
  const maxYear = (now.getUTCMonth() > 8 || (now.getUTCMonth() === 8 && now.getUTCDate() >= 30))
    ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return (
    <NodeShell type="heat-stress" icon={Flame} title="Heat-stress" subtitle="algorithm">
      <div className="nodrag space-y-2" style={{ width: 180 }}>
        <p className="text-[10px] text-body-secondary">Crop &amp; variety come from the Inputs node.</p>
        <Input
          type="number" placeholder={`Season year (≤ ${maxYear})`} className="h-8 text-xs"
          max={maxYear}
          value={d.year ?? ""}
          onChange={(e) => updateNodeData(id, { year: e.target.value === "" ? undefined : Number(e.target.value) })}
        />
        <p className="text-[10px] text-body-secondary">Completed seasons only — needs data through Sep 30.</p>
      </div>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </NodeShell>
  );
}

function InsufficientChillNode({ id, data }: NodeProps) {
  const d = (data ?? {}) as InsufficientChillNodeData;
  const { updateNodeData } = useReactFlow();
  return (
    <NodeShell type="insufficient-chill" icon={ThermometerSnowflake} title="Insufficient-chill" subtitle="algorithm">
      <div className="nodrag space-y-2" style={{ width: 190 }}>
        <p className="text-[10px] text-body-secondary">Crop &amp; variety come from the Inputs node.</p>
        <Input
          type="number" placeholder="Seasons (default 5)" className="h-8 text-xs"
          value={d.n_years ?? ""}
          onChange={(e) => updateNodeData(id, { n_years: e.target.value === "" ? undefined : Number(e.target.value) })}
        />
        <Select value={d.climate_type ?? "continental"} onValueChange={(v) => updateNodeData(id, { climate_type: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Climate" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="continental">continental</SelectItem>
            <SelectItem value="warm">warm</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </NodeShell>
  );
}

function ResultNode() {
  return (
    <NodeShell type="result" icon={BarChart3} title="Result">
      <p className="text-[11px] text-body-secondary">Run to view output below</p>
      <Handle type="target" position={Position.Left} style={handleStyle} />
    </NodeShell>
  );
}

export const nodeTypes = {
  inputs: InputsNode,
  weather: WeatherNode,
  satellite: SatelliteNode,
  "frost-risk": FrostRiskNode,
  "heat-stress": HeatStressNode,
  "insufficient-chill": InsufficientChillNode,
  result: ResultNode,
};

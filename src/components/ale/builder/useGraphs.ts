import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PersistedGraph } from "./graphTypes";

// CRUD for analysis graph "templates" in ale_logic_graphs. A save inserts a new
// version under the name and promotes it to active (demoting the prior active,
// since idx_ale_logic_graphs_name_active allows one active per name).
export function useGraphs() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const list = useQuery({
    queryKey: ["ale-graphs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ale_logic_graphs")
        .select("id, name, version, status, updated_at")
        .eq("status", "active")
        .not("name", "is", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async ({ name, graph }: { name: string; graph: PersistedGraph }) => {
      const { data: existing, error: exErr } = await supabase
        .from("ale_logic_graphs").select("id, version, status").eq("name", name);
      if (exErr) throw exErr;

      const maxV = (existing ?? []).reduce((m, r) => Math.max(m, r.version), 0);
      const activeIds = (existing ?? []).filter((r) => r.status === "active").map((r) => r.id);
      if (activeIds.length) {
        const { error } = await supabase.from("ale_logic_graphs").update({ status: "archived" }).in("id", activeIds);
        if (error) throw error;
      }

      const { data, error } = await supabase.from("ale_logic_graphs").insert({
        name,
        version: maxV + 1,
        status: "active",
        graph_jsonb: graph,
        schema_version: graph.schema_version,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
        published_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ale-graphs"] }),
  });

  const loadGraph = async (id: string): Promise<PersistedGraph> => {
    const { data, error } = await supabase.from("ale_logic_graphs").select("graph_jsonb").eq("id", id).single();
    if (error) throw error;
    return data.graph_jsonb as PersistedGraph;
  };

  return { list, save, loadGraph };
}

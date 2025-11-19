import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChartType, ChartTemplate } from "@/types/chart";

export const ChartManagement = () => {
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [chartToDelete, setChartToDelete] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const { data: charts = [], isLoading } = useQuery({
    queryKey: ['chart-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ChartTemplate[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('chart_templates')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-templates'] });
      toast({
        title: "Chart deleted successfully",
        description: "The chart template has been removed from farmer profiles.",
      });
      setDeleteConfirmOpen(false);
      setChartToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting chart",
        description: error.message || "Failed to delete chart template",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (chartId: string) => {
    setChartToDelete(chartId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (chartToDelete) {
      deleteMutation.mutate(chartToDelete);
    }
  };

  const getChartTypeLabel = (type: ChartType): string => {
    const labels: Record<ChartType, string> = {
      bar: 'Bar Chart',
      line: 'Line Chart',
      area: 'Area Chart',
      pie: 'Pie Chart',
      scatter: 'Scatter Plot',
      radar: 'Radar Chart',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading charts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-heading-primary">Chart Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage chart templates that appear on farmer profiles
          </p>
        </div>
        <Button
          onClick={() => navigate('/admin/charts/new')}
          className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Chart
        </Button>
      </div>

      {charts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No charts yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Create your first chart template to display data on farmer profiles
            </p>
            <Button onClick={() => navigate('/admin/charts/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Chart
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {charts.map((chart) => (
            <Card key={chart.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{chart.name}</CardTitle>
                    <Badge variant="secondary">{getChartTypeLabel(chart.chart_type)}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Data Points:</span> {chart.chart_data.data.length}
                  </div>
                  {chart.annotation && (
                    <div>
                      <span className="font-medium">Annotation:</span> {chart.annotation.substring(0, 50)}
                      {chart.annotation.length > 50 ? '...' : ''}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(chart.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/admin/charts/${chart.id}`)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(chart.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chart template? This action cannot be undone.
              The chart will be removed from all farmer profiles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


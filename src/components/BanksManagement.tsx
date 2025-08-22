import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Bank {
  id: string;
  name: string;
  logo_url: string;
  created_at: string;
}

export const BanksManagement = () => {
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", logo_url: "" });
  
  const queryClient = useQueryClient();

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Bank[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (bankData: { name: string; logo_url: string }) => {
      const { error } = await supabase.from('banks').insert([bankData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      setIsCreating(false);
      setFormData({ name: "", logo_url: "" });
      toast({ title: "Bank created successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error creating bank", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; logo_url: string }) => {
      const { error } = await supabase.from('banks').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      setEditingBank(null);
      setFormData({ name: "", logo_url: "" });
      toast({ title: "Bank updated successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error updating bank", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('banks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      toast({ title: "Bank deleted successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error deleting bank", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBank) {
      updateMutation.mutate({ id: editingBank.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const startEdit = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({ name: bank.name, logo_url: bank.logo_url });
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingBank(null);
    setFormData({ name: "", logo_url: "" });
  };

  const cancel = () => {
    setIsCreating(false);
    setEditingBank(null);
    setFormData({ name: "", logo_url: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Banks Management</h2>
        <Button 
          onClick={startCreate} 
          disabled={isCreating || editingBank !== null}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Bank
        </Button>
      </div>

      {(isCreating || editingBank) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingBank ? 'Edit Bank' : 'Create New Bank'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Bank Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter bank name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Logo URL</label>
                <Input
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="Enter logo URL"
                  type="url"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
                >
                  {editingBank ? 'Update' : 'Create'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={cancel}
                  className="border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transform transition-all duration-200 hover:scale-[1.02] shadow-md"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Banks ({banks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading banks...</div>
          ) : (
            <div className="space-y-4">
              {banks.map((bank) => (
                <div key={bank.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {bank.logo_url && (
                      <img src={bank.logo_url} alt={`${bank.name} logo`} className="h-10 w-10 object-contain" />
                    )}
                    <div>
                      <h3 className="font-medium">{bank.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(bank.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(bank)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteMutation.mutate(bank.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
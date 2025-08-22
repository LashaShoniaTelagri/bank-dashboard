import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Bank {
  id: string;
  name: string;
}

interface Farmer {
  id?: string;
  bank_id: string;
  type: 'person' | 'company';
  name: string;
  id_number: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
}

interface FarmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer?: Farmer;
}

export const FarmerModal = ({ isOpen, onClose, farmer }: FarmerModalProps) => {
  const [formData, setFormData] = useState<Farmer>({
    bank_id: '',
    type: 'person',
    name: '',
    id_number: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
  });
  const [newBankName, setNewBankName] = useState('');
  const [isCreatingBank, setIsCreatingBank] = useState(false);

  const queryClient = useQueryClient();

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Bank[];
    },
  });

  const createBankMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('banks')
        .insert([{ name, logo_url: '' }])
        .select('id, name')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (newBank) => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      setFormData({ ...formData, bank_id: newBank.id });
      setIsCreatingBank(false);
      setNewBankName('');
      toast({ title: "Bank created successfully" });
    },
  });

  const farmerMutation = useMutation({
    mutationFn: async (data: Farmer) => {
      if (farmer?.id) {
        const { error } = await supabase
          .from('farmers')
          .update(data)
          .eq('id', farmer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('farmers').insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      toast({ 
        title: farmer?.id ? "Farmer updated successfully" : "Farmer created successfully" 
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error saving farmer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (farmer) {
      setFormData(farmer);
    } else {
      setFormData({
        bank_id: '',
        type: 'person',
        name: '',
        id_number: '',
        contact_phone: '',
        contact_email: '',
        contact_address: '',
      });
    }
  }, [farmer, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.bank_id) {
      toast({
        title: "Please select a bank",
        variant: "destructive",
      });
      return;
    }

    farmerMutation.mutate(formData);
  };

  const handleNewBank = () => {
    if (newBankName.trim()) {
      createBankMutation.mutate(newBankName.trim());
    }
  };

  const updateFormData = (field: keyof Farmer, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {farmer?.id ? 'Edit Farmer' : 'Add New Farmer'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Bank</Label>
            <Select
              value={formData.bank_id}
              onValueChange={(value) => {
                if (value === 'new') {
                  setIsCreatingBank(true);
                } else {
                  updateFormData('bank_id', value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
                <SelectItem value="new">+ New Bank</SelectItem>
              </SelectContent>
            </Select>
            
            {isCreatingBank && (
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Bank name"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNewBank}
                  disabled={!newBankName.trim() || createBankMutation.isPending}
                >
                  Create
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreatingBank(false);
                    setNewBankName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Farmer Type</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(value: 'person' | 'company') => updateFormData('type', value)}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="person" id="person" />
                <Label htmlFor="person">Person</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="company" id="company" />
                <Label htmlFor="company">Company</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="id_number">ID Number *</Label>
            <Input
              id="id_number"
              value={formData.id_number}
              onChange={(e) => updateFormData('id_number', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="contact_phone">Phone</Label>
            <Input
              id="contact_phone"
              value={formData.contact_phone || ''}
              onChange={(e) => updateFormData('contact_phone', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email || ''}
              onChange={(e) => updateFormData('contact_email', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="contact_address">Address</Label>
            <Input
              id="contact_address"
              value={formData.contact_address || ''}
              onChange={(e) => updateFormData('contact_address', e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={farmerMutation.isPending || !formData.bank_id}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
            >
              {farmer?.id ? 'Update' : 'Create'} Farmer
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
      </DialogContent>
    </Dialog>
  );
};
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Plus, Trash2 } from "lucide-react";

interface Bank {
  id: string;
  name: string;
}

interface CropVariety {
  id: string;
  name: string;
  plantingYear: number;
  areaHectares: number;
}

interface ReservoirVolume {
  id: string;
  volume: number;
}

interface ComprehensiveFarmer {
  id?: string;
  bank_id: string;
  type: 'person' | 'company';
  name: string;
  id_number: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  // New comprehensive fields
  company_name?: string;
  first_name?: string;
  last_name?: string;
  farm_location?: string;
  total_area_hectares?: number;
  crop_type?: string;
  crop_varieties?: CropVariety[];
  irrigation_type?: string;
  has_reservoir?: boolean;
  reservoir_count?: number;
  reservoir_volumes?: ReservoirVolume[];
  water_source?: string;
  last_year_harvest_quantity?: number;
  last_year_harvest_unit?: string;
  irrigation_sectors_count?: number;
  irrigation_system_schema_path?: string;
  equipment_list?: string;
  lab_analysis_path?: string;
}

interface ComprehensiveFarmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer?: ComprehensiveFarmer;
}

const CROP_TYPES = [
  "ხორბალი", "ვაშლი", "ყურძენი", "მარცვლეული", "ბოსტნეული", 
  "ტექნიკური კულტურები", "სხვა"
];

const IRRIGATION_TYPES = [
  "წვეთოვანი", "სპრინკლერი", "ზედაპირული", "ქვედაპირული", "სხვა"
];

const WATER_SOURCES = [
  "მდინარე", "წყალსაცავი", "ჭა", "წყლის ქსელი", "სხვა"
];

const HARVEST_UNITS = [
  "ტონა", "კილოგრამი", "ცენტნერი", "ლიტრი", "სხვა"
];

export const ComprehensiveFarmerModal = ({ isOpen, onClose, farmer }: ComprehensiveFarmerModalProps) => {
  const [formData, setFormData] = useState<ComprehensiveFarmer>({
    bank_id: '',
    type: 'person',
    name: '',
    id_number: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    company_name: '',
    first_name: '',
    last_name: '',
    farm_location: '',
    total_area_hectares: 0,
    crop_type: '',
    crop_varieties: [],
    irrigation_type: '',
    has_reservoir: false,
    reservoir_count: 0,
    reservoir_volumes: [],
    water_source: '',
    last_year_harvest_quantity: 0,
    last_year_harvest_unit: 'ტონა',
    irrigation_sectors_count: 0,
    irrigation_system_schema_path: '',
    equipment_list: '',
    lab_analysis_path: '',
  });

  const [newBankName, setNewBankName] = useState('');
  const [isCreatingBank, setIsCreatingBank] = useState(false);
  const [uploadingSchema, setUploadingSchema] = useState(false);
  const [uploadingLabAnalysis, setUploadingLabAnalysis] = useState(false);

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
      toast({ title: "ბანკი წარმატებით შეიქმნა" });
    },
  });

  const farmerMutation = useMutation({
    mutationFn: async (data: ComprehensiveFarmer) => {
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
        title: farmer?.id ? "ფერმერი წარმატებით განახლდა" : "ფერმერი წარმატებით დაემატა" 
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "ფერმერის შენახვის შეცდომა",
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
        company_name: '',
        first_name: '',
        last_name: '',
        farm_location: '',
        total_area_hectares: 0,
        crop_type: '',
        crop_varieties: [],
        irrigation_type: '',
        has_reservoir: false,
        reservoir_count: 0,
        reservoir_volumes: [],
        water_source: '',
        last_year_harvest_quantity: 0,
        last_year_harvest_unit: 'ტონა',
        irrigation_sectors_count: 0,
        irrigation_system_schema_path: '',
        equipment_list: '',
        lab_analysis_path: '',
      });
    }
  }, [farmer, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.bank_id) {
      toast({
        title: "გთხოვთ აირჩიოთ ბანკი",
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

  const updateFormData = (field: keyof ComprehensiveFarmer, value: string | number | boolean | CropVariety[] | ReservoirVolume[]) => {
    setFormData({ ...formData, [field]: value });
  };

  const addCropVariety = () => {
    const newVariety: CropVariety = {
      id: Date.now().toString(),
      name: '',
      plantingYear: new Date().getFullYear(),
      areaHectares: 0,
    };
    setFormData({
      ...formData,
      crop_varieties: [...(formData.crop_varieties || []), newVariety]
    });
  };

  const updateCropVariety = (id: string, field: keyof CropVariety, value: string | number) => {
    setFormData({
      ...formData,
      crop_varieties: formData.crop_varieties?.map(v => 
        v.id === id ? { ...v, [field]: value } : v
      )
    });
  };

  const removeCropVariety = (id: string) => {
    setFormData({
      ...formData,
      crop_varieties: formData.crop_varieties?.filter(v => v.id !== id)
    });
  };

  const addReservoirVolume = () => {
    const newVolume: ReservoirVolume = {
      id: Date.now().toString(),
      volume: 0,
    };
    setFormData({
      ...formData,
      reservoir_volumes: [...(formData.reservoir_volumes || []), newVolume]
    });
  };

  const updateReservoirVolume = (id: string, volume: number) => {
    setFormData({
      ...formData,
      reservoir_volumes: formData.reservoir_volumes?.map(v => 
        v.id === id ? { ...v, volume } : v
      )
    });
  };

  const removeReservoirVolume = (id: string) => {
    setFormData({
      ...formData,
      reservoir_volumes: formData.reservoir_volumes?.filter(v => v.id !== id)
    });
  };

  const handleFileUpload = async (file: File, type: 'schema' | 'labAnalysis') => {
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `bank/${formData.bank_id}/${type}/${fileName}`;

    try {
      if (type === 'schema') {
        setUploadingSchema(true);
      } else {
        setUploadingLabAnalysis(true);
      }

      const { error } = await supabase.storage
        .from('farmer-documents')
        .upload(filePath, file);

      if (error) throw error;

      const field = type === 'schema' ? 'irrigation_system_schema_path' : 'lab_analysis_path';
      updateFormData(field as keyof ComprehensiveFarmer, filePath);

      toast({ title: "ფაილი წარმატებით ატვირთულია" });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "ფაილის ატვირთვის შეცდომა",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (type === 'schema') {
        setUploadingSchema(false);
      } else {
        setUploadingLabAnalysis(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {farmer?.id ? 'ფერმერის რედაქტირება' : 'ახალი ფერმერის დამატება'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">ძირითადი ინფო</TabsTrigger>
              <TabsTrigger value="farm">ფერმის მონაცემები</TabsTrigger>
              <TabsTrigger value="irrigation">ირიგაცია</TabsTrigger>
              <TabsTrigger value="documents">დოკუმენტები</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>ბანკის ინფორმაცია</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>ბანკი *</Label>
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
                        <SelectValue placeholder="აირჩიეთ ბანკი" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="new">+ ახალი ბანკი</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {isCreatingBank && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          placeholder="ბანკის სახელი"
                          value={newBankName}
                          onChange={(e) => setNewBankName(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleNewBank}
                          disabled={!newBankName.trim() || createBankMutation.isPending}
                        >
                          შექმნა
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
                          გაუქმება
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>ფერმერის ტიპი</Label>
                    <RadioGroup
                      value={formData.type}
                      onValueChange={(value: 'person' | 'company') => updateFormData('type', value)}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="person" id="person" />
                        <Label htmlFor="person">ფიზიკური პირი</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="company" id="company" />
                        <Label htmlFor="company">კომპანია</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {formData.type === 'company' ? (
                    <div>
                      <Label htmlFor="company_name">შპს დასახელება *</Label>
                      <Input
                        id="company_name"
                        value={formData.company_name || ''}
                        onChange={(e) => updateFormData('company_name', e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name">სახელი *</Label>
                        <Input
                          id="first_name"
                          value={formData.first_name || ''}
                          onChange={(e) => updateFormData('first_name', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name">გვარი *</Label>
                        <Input
                          id="last_name"
                          value={formData.last_name || ''}
                          onChange={(e) => updateFormData('last_name', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="id_number">პირადი ნომერი *</Label>
                    <Input
                      id="id_number"
                      value={formData.id_number}
                      onChange={(e) => updateFormData('id_number', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="contact_phone">საკონტაქტო ტელეფონი</Label>
                    <Input
                      id="contact_phone"
                      value={formData.contact_phone || ''}
                      onChange={(e) => updateFormData('contact_phone', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="contact_email">ელ-ფოსტა</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email || ''}
                      onChange={(e) => updateFormData('contact_email', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="contact_address">მისამართი</Label>
                    <Input
                      id="contact_address"
                      value={formData.contact_address || ''}
                      onChange={(e) => updateFormData('contact_address', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Farm Data Tab */}
            <TabsContent value="farm" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>ფერმის მონაცემები</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="farm_location">ფერმის მდებარეობა</Label>
                    <Input
                      id="farm_location"
                      value={formData.farm_location || ''}
                      onChange={(e) => updateFormData('farm_location', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="total_area_hectares">ფართობი (ჰექტარი)</Label>
                    <Input
                      id="total_area_hectares"
                      type="number"
                      step="0.01"
                      value={formData.total_area_hectares || ''}
                      onChange={(e) => updateFormData('total_area_hectares', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <Label>კულტურა</Label>
                    <Select
                      value={formData.crop_type || ''}
                      onValueChange={(value) => updateFormData('crop_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="აირჩიეთ კულტურა" />
                      </SelectTrigger>
                      <SelectContent>
                        {CROP_TYPES.map((crop) => (
                          <SelectItem key={crop} value={crop}>
                            {crop}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>ჯიშები და ფართობები</Label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={addCropVariety}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        დამატება
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {formData.crop_varieties?.map((variety) => (
                        <div key={variety.id} className="flex gap-2 items-center p-2 border rounded">
                          <Input
                            placeholder="ჯიშის სახელი"
                            value={variety.name}
                            onChange={(e) => updateCropVariety(variety.id, 'name', e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="წელი"
                            value={variety.plantingYear}
                            onChange={(e) => updateCropVariety(variety.id, 'plantingYear', parseInt(e.target.value) || 0)}
                            className="w-24"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="ფართობი (ჰა)"
                            value={variety.areaHectares}
                            onChange={(e) => updateCropVariety(variety.id, 'areaHectares', parseFloat(e.target.value) || 0)}
                            className="w-32"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => removeCropVariety(variety.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="last_year_harvest_quantity">შარშანდელი მოსავლის რაოდენობა</Label>
                      <Input
                        id="last_year_harvest_quantity"
                        type="number"
                        step="0.01"
                        value={formData.last_year_harvest_quantity || ''}
                        onChange={(e) => updateFormData('last_year_harvest_quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>ერთეული</Label>
                      <Select
                        value={formData.last_year_harvest_unit || 'ტონა'}
                        onValueChange={(value) => updateFormData('last_year_harvest_unit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HARVEST_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="equipment_list">ტექნიკის ჩამონათვალი</Label>
                    <Textarea
                      id="equipment_list"
                      value={formData.equipment_list || ''}
                      onChange={(e) => updateFormData('equipment_list', e.target.value)}
                      placeholder="ჩამოთვალეთ ფერმზე არსებული ტექნიკა..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Irrigation Tab */}
            <TabsContent value="irrigation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>ირიგაციის სისტემა</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>ირიგაციის ტიპი</Label>
                    <Select
                      value={formData.irrigation_type || ''}
                      onValueChange={(value) => updateFormData('irrigation_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="აირჩიეთ ირიგაციის ტიპი" />
                      </SelectTrigger>
                      <SelectContent>
                        {IRRIGATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>წყლის წყარო</Label>
                    <Select
                      value={formData.water_source || ''}
                      onValueChange={(value) => updateFormData('water_source', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="აირჩიეთ წყლის წყარო" />
                      </SelectTrigger>
                      <SelectContent>
                        {WATER_SOURCES.map((source) => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="irrigation_sectors_count">საირიგაციო სექტორების რაოდენობა</Label>
                    <Input
                      id="irrigation_sectors_count"
                      type="number"
                      value={formData.irrigation_sectors_count || ''}
                      onChange={(e) => updateFormData('irrigation_sectors_count', parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_reservoir"
                      checked={formData.has_reservoir || false}
                      onCheckedChange={(checked) => updateFormData('has_reservoir', checked)}
                    />
                    <Label htmlFor="has_reservoir">რეზერვუარი აქვს</Label>
                  </div>

                  {formData.has_reservoir && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="reservoir_count">რეზერვუარების რაოდენობა</Label>
                        <Input
                          id="reservoir_count"
                          type="number"
                          value={formData.reservoir_count || ''}
                          onChange={(e) => updateFormData('reservoir_count', parseInt(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>რეზერვუარების მოცულობები (მ³)</Label>
                          <Button
                            type="button"
                            size="sm"
                            onClick={addReservoirVolume}
                            className="flex items-center gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            დამატება
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          {formData.reservoir_volumes?.map((volume) => (
                            <div key={volume.id} className="flex gap-2 items-center p-2 border rounded">
                              <Input
                                type="number"
                                placeholder="მოცულობა (მ³)"
                                value={volume.volume}
                                onChange={(e) => updateReservoirVolume(volume.id, parseFloat(e.target.value) || 0)}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => removeReservoirVolume(volume.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>დოკუმენტების ატვირთვა</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>საირიგაციო სისტემის სქემა</Label>
                    <div className="mt-2">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'schema');
                        }}
                        className="hidden"
                        id="schema-upload"
                      />
                      <label
                        htmlFor="schema-upload"
                        className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                      >
                        {uploadingSchema ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span>იტვირთება...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-gray-400" />
                            <span className="text-sm text-gray-500">
                              {formData.irrigation_system_schema_path ? 'ფაილი ატვირთულია' : 'დააჭირეთ ატვირთვისთვის'}
                            </span>
                          </div>
                        )}
                      </label>
                      {formData.irrigation_system_schema_path && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="secondary">ატვირთული</Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => updateFormData('irrigation_system_schema_path', '')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label>ლაბორატორიული ანალიზები</Label>
                    <div className="mt-2">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'labAnalysis');
                        }}
                        className="hidden"
                        id="lab-analysis-upload"
                      />
                      <label
                        htmlFor="lab-analysis-upload"
                        className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                      >
                        {uploadingLabAnalysis ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span>იტვირთება...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-gray-400" />
                            <span className="text-sm text-gray-500">
                              {formData.lab_analysis_path ? 'ფაილი ატვირთულია' : 'დააჭირეთ ატვირთვისთვის'}
                            </span>
                          </div>
                        )}
                      </label>
                      {formData.lab_analysis_path && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="secondary">ატვირთული</Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => updateFormData('lab_analysis_path', '')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={farmerMutation.isPending || !formData.bank_id}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
            >
              {farmerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {farmer?.id ? 'განახლება' : 'ფერმერის დამატება'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transform transition-all duration-200 hover:scale-[1.02] shadow-md"
            >
              გაუქმება
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
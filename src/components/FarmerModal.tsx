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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCrops } from "@/hooks/useCrops";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Upload, X, FileText, Image, MapPin } from "lucide-react";

interface Bank {
  id: string;
  name: string;
}

interface Crop {
  id: string;
  name: string;
  image_url: string;
  country_code: string;
}

interface FarmerDocument {
  id?: string;
  document_type: 'irrigation_diagram' | 'current_analysis' | 'other';
  file_name: string;
  file_path: string;
  file_mime: string;
  file_size_bytes: number;
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
  // New agricultural fields
  ltd_name?: string;
  full_name?: string;
  mobile?: string;
  farmer_location?: string;
  area?: number;
  crop?: string;
  variety?: string;
  variety_cultivation_year?: number;
  variety_cultivation_area?: number;
  irrigation_type?: string;
  has_reservoir?: boolean;
  reservoir_amount?: number;
  reservoir_capacity?: number;
  water_source?: string;
  last_year_harvest_amount?: number;
  irrigation_sectors_count?: number;
  equipment_list?: string;
}

interface FarmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer?: Farmer;
}

export const FarmerModal = ({ isOpen, onClose, farmer }: FarmerModalProps) => {
  const { profile } = useAuth();
  const { data: crops = [], isLoading: cropsLoading, error: cropsError } = useCrops() as { data: Crop[], isLoading: boolean, error: Error | null };
  const [formData, setFormData] = useState<Farmer>({
    bank_id: '',
    type: 'person',
    name: '',
    id_number: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    ltd_name: '',
    full_name: '',
    mobile: '',
    farmer_location: '',
    area: undefined,
    crop: '',
    variety: '',
    variety_cultivation_year: undefined,
    variety_cultivation_area: undefined,
    irrigation_type: '',
    has_reservoir: false,
    reservoir_amount: undefined,
    reservoir_capacity: undefined,
    water_source: '',
    last_year_harvest_amount: undefined,
    irrigation_sectors_count: undefined,
    equipment_list: '',
  });
  const [newBankName, setNewBankName] = useState('');
  const [isCreatingBank, setIsCreatingBank] = useState(false);
  const [irrigationFiles, setIrrigationFiles] = useState<File[]>([]);
  const [analysisFiles, setAnalysisFiles] = useState<File[]>([]);

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
      let farmerId: string;
      
      if (farmer?.id) {
        // Update existing farmer
        const { error } = await supabase
          .from('farmers')
          .update(data)
          .eq('id', farmer.id);
        if (error) throw error;
        farmerId = farmer.id;
      } else {
        // Create new farmer
        const { data: newFarmer, error } = await supabase
          .from('farmers')
          .insert([data])
          .select('id')
          .single();
        if (error) throw error;
        farmerId = newFarmer.id;
      }
      
      // Upload irrigation diagram files
      if (irrigationFiles.length > 0) {
        await uploadFiles(farmerId, irrigationFiles, 'irrigation_diagram');
      }
      
      // Upload current analysis files
      if (analysisFiles.length > 0) {
        await uploadFiles(farmerId, analysisFiles, 'current_analysis');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      toast({ 
        title: farmer?.id ? "Farmer updated successfully" : "Farmer created successfully" 
      });
      onClose();
      // Reset files
      setIrrigationFiles([]);
      setAnalysisFiles([]);
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
      setFormData({
        ...farmer,
        // Ensure all new fields have default values if not present
        ltd_name: farmer.ltd_name || '',
        full_name: farmer.full_name || '',
        mobile: farmer.mobile || '',
        farmer_location: farmer.farmer_location || '',
        area: farmer.area || undefined,
        crop: farmer.crop || '',
        variety: farmer.variety || '',
        variety_cultivation_year: farmer.variety_cultivation_year || undefined,
        variety_cultivation_area: farmer.variety_cultivation_area || undefined,
        irrigation_type: farmer.irrigation_type || '',
        has_reservoir: farmer.has_reservoir || false,
        reservoir_amount: farmer.reservoir_amount || undefined,
        reservoir_capacity: farmer.reservoir_capacity || undefined,
        water_source: farmer.water_source || '',
        last_year_harvest_amount: farmer.last_year_harvest_amount || undefined,
        irrigation_sectors_count: farmer.irrigation_sectors_count || undefined,
        equipment_list: farmer.equipment_list || '',
      });
    } else {
      // Auto-select bank for bank users, leave empty for admins
      const defaultBankId = profile?.role === 'bank_viewer' ? (profile.bank_id || '') : '';
      
      setFormData({
        bank_id: defaultBankId,
        type: 'person',
        name: '',
        id_number: '',
        contact_phone: '',
        contact_email: '',
        contact_address: '',
        ltd_name: '',
        full_name: '',
        mobile: '',
        farmer_location: '',
        area: undefined,
        crop: '',
        variety: '',
        variety_cultivation_year: undefined,
        variety_cultivation_area: undefined,
        irrigation_type: '',
        has_reservoir: false,
        reservoir_amount: undefined,
        reservoir_capacity: undefined,
        water_source: '',
        last_year_harvest_amount: undefined,
        irrigation_sectors_count: undefined,
        equipment_list: '',
      });
    }
    // Reset files when modal opens/closes
    setIrrigationFiles([]);
    setAnalysisFiles([]);
  }, [farmer, isOpen, profile]);

  const validateForm = (): boolean => {
    const errors: string[] = [];

    // Basic validation
    if (!formData.bank_id) errors.push("Bank selection is required");
    if (!formData.name.trim()) errors.push("Name is required");
    if (!formData.id_number.trim()) errors.push("ID Number is required");
    
    // New required fields validation
    if (!formData.full_name?.trim()) errors.push("Full name and lastname is required");
    if (!formData.mobile?.trim()) errors.push("Mobile number is required");
    if (!formData.farmer_location?.trim()) errors.push("Farmer location is required");
    if (!formData.area || formData.area <= 0) errors.push("Area must be greater than 0");
    if (!formData.crop?.trim()) errors.push("Crop is required");
    if (!formData.variety?.trim()) errors.push("Variety is required");
    if (!formData.irrigation_type?.trim()) errors.push("Irrigation type is required");
    if (!formData.water_source?.trim()) errors.push("Water source is required");

    // Conditional validation for reservoir
    if (formData.has_reservoir) {
      if (!formData.reservoir_capacity || formData.reservoir_capacity <= 0) {
        errors.push("Reservoir capacity is required when reservoir is selected");
      }
    }

    // Year validation
    if (formData.variety_cultivation_year) {
      const currentYear = new Date().getFullYear();
      if (formData.variety_cultivation_year < 1900 || formData.variety_cultivation_year > currentYear + 10) {
        errors.push("Variety cultivation year must be between 1900 and " + (currentYear + 10));
      }
    }

    // Numeric validations
    if (formData.variety_cultivation_area && formData.variety_cultivation_area <= 0) {
      errors.push("Variety cultivation area must be greater than 0");
    }
    if (formData.reservoir_amount && formData.reservoir_amount <= 0) {
      errors.push("Reservoir amount must be greater than 0");
    }
    if (formData.last_year_harvest_amount && formData.last_year_harvest_amount < 0) {
      errors.push("Last year's harvest amount cannot be negative");
    }
    if (formData.irrigation_sectors_count && formData.irrigation_sectors_count <= 0) {
      errors.push("Number of irrigation sectors must be greater than 0");
    }

    // Mobile number validation (basic)
    if (formData.mobile && !/^\+?[\d\s\-\(\)]+$/.test(formData.mobile)) {
      errors.push("Please enter a valid mobile number");
    }

    // Email validation if provided
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      errors.push("Please enter a valid email address");
    }

    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(". "),
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    farmerMutation.mutate(formData);
  };

  const handleNewBank = () => {
    if (newBankName.trim()) {
      createBankMutation.mutate(newBankName.trim());
    }
  };

  const uploadFiles = async (farmerId: string, files: File[], documentType: 'irrigation_diagram' | 'current_analysis') => {
    // Get farmer's bank_id first
    const { data: farmer, error: farmerError } = await supabase
      .from('farmers')
      .select('bank_id')
      .eq('id', farmerId)
      .single();
    
    if (farmerError) {
      throw new Error(`Failed to get farmer details: ${farmerError.message}`);
    }
    
    for (const file of files) {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const filePath = `farmer/${farmerId}/${documentType}/${fileName}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('farmer-documents')
        .upload(filePath, file);
      
      if (uploadError) {
        console.error('File upload error:', uploadError);
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }
      
      // Save document record to database
      const { error: dbError } = await supabase
        .from('farmer_documents')
        .insert({
          farmer_id: farmerId,
          bank_id: farmer.bank_id,
          document_type: documentType,
          file_name: file.name,
          file_path: filePath,
          file_mime: file.type,
          file_size_bytes: file.size,
        });
      
      if (dbError) {
        console.error('Database insert error:', dbError);
        throw new Error(`Failed to save ${file.name} record: ${dbError.message}`);
      }
    }
  };

  const updateFormData = (field: keyof Farmer, value: string | number | boolean | undefined) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleFileChange = (files: FileList | null, type: 'irrigation' | 'analysis') => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    
    // Validate file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.google-earth.kml+xml',
      'application/vnd.google-earth.kmz'
    ];
    
    for (const file of fileArray) {
      if (allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.kml') || file.name.toLowerCase().endsWith('.kmz')) {
        if (file.size <= 10 * 1024 * 1024) { // 10MB limit
          validFiles.push(file);
        } else {
          toast({
            title: "File too large",
            description: `${file.name} is larger than 10MB`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
      }
    }
    
    if (type === 'irrigation') {
      setIrrigationFiles(prev => [...prev, ...validFiles]);
    } else {
      setAnalysisFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number, type: 'irrigation' | 'analysis') => {
    if (type === 'irrigation') {
      setIrrigationFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setAnalysisFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="farmer-modal-description">
        <DialogHeader>
          <DialogTitle>
            {farmer?.id ? 'Edit Farmer' : 'Add New Farmer'}
          </DialogTitle>
          <div id="farmer-modal-description" className="sr-only">
            Form to {farmer?.id ? 'edit existing' : 'add new'} farmer with agricultural information
          </div>
        </DialogHeader>

        <ErrorBoundary
          fallback={
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <h3 className="text-red-800 font-semibold mb-2">Form Error</h3>
              <p className="text-red-600 text-sm mb-3">
                There was an error loading the farmer form. This might be due to network issues or API problems.
              </p>
              <button
                onClick={onClose}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Close and try again
              </button>
            </div>
          }
        >

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bank Selection - Only show for admins */}
          {profile?.role === 'admin' && (
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
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Farmer Type</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(value: 'person' | 'company') => updateFormData('type', value)}
              className="flex gap-6 mt-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="person" id="person" />
                <Label htmlFor="person" className="text-sm font-normal cursor-pointer">Person</Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="company" id="company" />
                <Label htmlFor="company" className="text-sm font-normal cursor-pointer">Company</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="Enter farmer name"
              className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_number" className="text-sm font-medium text-gray-700">
              ID Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="id_number"
              value={formData.id_number}
              onChange={(e) => updateFormData('id_number', e.target.value)}
              placeholder="Enter ID number"
              className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone" className="text-sm font-medium text-gray-700">Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              value={formData.contact_phone || ''}
              onChange={(e) => updateFormData('contact_phone', e.target.value)}
              placeholder="Enter phone number"
              className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email" className="text-sm font-medium text-gray-700">Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email || ''}
              onChange={(e) => updateFormData('contact_email', e.target.value)}
              placeholder="Enter email address"
              className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_address" className="text-sm font-medium text-gray-700">Address</Label>
            <Input
              id="contact_address"
              value={formData.contact_address || ''}
              onChange={(e) => updateFormData('contact_address', e.target.value)}
              placeholder="Enter address"
              className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </div>

          <Separator className="my-6" />
          
          {/* Agricultural Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-emerald-700 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Agricultural Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="ltd_name" className="text-sm font-medium text-gray-700">LTD Name</Label>
                  <Input
                    id="ltd_name"
                    value={formData.ltd_name || ''}
                    onChange={(e) => updateFormData('ltd_name', e.target.value)}
                    placeholder="Company LTD name"
                    className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-sm font-medium text-gray-700">
                  Full Name and Lastname <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name || ''}
                  onChange={(e) => updateFormData('full_name', e.target.value)}
                  placeholder="Full name and lastname"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-sm font-medium text-gray-700">
                  Mobile <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={formData.mobile || ''}
                  onChange={(e) => updateFormData('mobile', e.target.value)}
                  placeholder="Mobile phone number"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="farmer_location" className="text-sm font-medium text-gray-700">
                  Farmer Location <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="farmer_location"
                  value={formData.farmer_location || ''}
                  onChange={(e) => updateFormData('farmer_location', e.target.value)}
                  placeholder="Geographic location of the farm"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="area" className="text-sm font-medium text-gray-700">
                  Area (hectares) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="area"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.area || ''}
                  onChange={(e) => updateFormData('area', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Total farm area"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="crop" className="text-sm font-medium text-gray-700">
                  Crop <span className="text-red-500">*</span>
                </Label>
                {cropsError || (!cropsLoading && crops.length === 0) ? (
                  // Fallback to text input if crops API fails
                  <Input
                    id="crop"
                    value={formData.crop || ''}
                    onChange={(e) => updateFormData('crop', e.target.value)}
                    placeholder="Enter primary crop type"
                    className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    required
                  />
                ) : (
                  <Select
                    value={formData.crop || undefined}
                    onValueChange={(value) => {
                      if (value && value !== 'loading' && value !== 'no-crops') {
                        updateFormData('crop', value);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors">
                      <SelectValue placeholder={cropsLoading ? "Loading crops..." : "Select crop type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {cropsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading crops...
                        </SelectItem>
                      ) : crops.length > 0 ? (
                        crops.map((crop) => (
                          <SelectItem key={crop.id} value={crop.name}>
                            <div className="flex items-center gap-3">
                              <img 
                                src={crop.image_url} 
                                alt={crop.name}
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  // Fallback to a default icon if image fails to load
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <span>{crop.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-crops" disabled>
                          No crops available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="variety" className="text-sm font-medium text-gray-700">
                  Variety <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="variety"
                  value={formData.variety || ''}
                  onChange={(e) => updateFormData('variety', e.target.value)}
                  placeholder="Crop variety"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="variety_cultivation_year" className="text-sm font-medium text-gray-700">Variety Cultivation Year</Label>
                <Input
                  id="variety_cultivation_year"
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 10}
                  value={formData.variety_cultivation_year || ''}
                  onChange={(e) => updateFormData('variety_cultivation_year', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Year cultivation started"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="variety_cultivation_area" className="text-sm font-medium text-gray-700">Variety Cultivation Area (hectares)</Label>
                <Input
                  id="variety_cultivation_area"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.variety_cultivation_area || ''}
                  onChange={(e) => updateFormData('variety_cultivation_area', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Area for variety cultivation"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="irrigation_type" className="text-sm font-medium text-gray-700">
                  Irrigation Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.irrigation_type || ''}
                  onValueChange={(value) => updateFormData('irrigation_type', value)}
                >
                  <SelectTrigger className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors">
                    <SelectValue placeholder="Select irrigation type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drip">Drip Irrigation</SelectItem>
                    <SelectItem value="sprinkler">Sprinkler Irrigation</SelectItem>
                    <SelectItem value="surface">Surface Irrigation</SelectItem>
                    <SelectItem value="subsurface">Subsurface Irrigation</SelectItem>
                    <SelectItem value="center_pivot">Center Pivot</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Reservoir Section */}
            <div className="space-y-4 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="has_reservoir"
                  checked={formData.has_reservoir || false}
                  onCheckedChange={(checked) => updateFormData('has_reservoir', checked as boolean)}
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <Label htmlFor="has_reservoir" className="text-sm font-medium text-blue-800 cursor-pointer">
                  Has Reservoir
                </Label>
              </div>
              
              {formData.has_reservoir && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="reservoir_amount" className="text-sm font-medium text-gray-700">Reservoir Amount (cubic meters)</Label>
                    <Input
                      id="reservoir_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.reservoir_amount || ''}
                      onChange={(e) => updateFormData('reservoir_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Current water amount"
                      className="mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reservoir_capacity" className="text-sm font-medium text-gray-700">Reservoir Capacity (cubic meters)</Label>
                    <Input
                      id="reservoir_capacity"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.reservoir_capacity || ''}
                      onChange={(e) => updateFormData('reservoir_capacity', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Total reservoir capacity"
                      className="mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="water_source" className="text-sm font-medium text-gray-700">
                  Water Source <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="water_source"
                  value={formData.water_source || ''}
                  onChange={(e) => updateFormData('water_source', e.target.value)}
                  placeholder="Primary water source"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="last_year_harvest_amount" className="text-sm font-medium text-gray-700">Last Year's Harvest (tons)</Label>
                <Input
                  id="last_year_harvest_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.last_year_harvest_amount || ''}
                  onChange={(e) => updateFormData('last_year_harvest_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Amount of last year's harvest"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="irrigation_sectors_count" className="text-sm font-medium text-gray-700">Number of Irrigation Sectors</Label>
                <Input
                  id="irrigation_sectors_count"
                  type="number"
                  min="1"
                  value={formData.irrigation_sectors_count || ''}
                  onChange={(e) => updateFormData('irrigation_sectors_count', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Number of irrigation sectors"
                  className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="equipment_list" className="text-sm font-medium text-gray-700">Equipment List</Label>
              <Textarea
                id="equipment_list"
                value={formData.equipment_list || ''}
                onChange={(e) => updateFormData('equipment_list', e.target.value)}
                placeholder="List of agricultural equipment (e.g., tractors, harvesters, irrigation systems...)"
                rows={4}
                className="mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
              />
            </div>
          </div>
          
          <Separator className="my-6" />
          
          {/* File Upload Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-emerald-700 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Uploads
            </h3>
            
            {/* Irrigation System Diagram */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">Irrigation System Diagram</Label>
                <p className="text-xs text-gray-500">Upload images, PDF, KMZ, or KML files (max 10MB each)</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-emerald-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.kml,.kmz"
                  onChange={(e) => handleFileChange(e.target.files, 'irrigation')}
                  className="hidden"
                  id="irrigation-files"
                />
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('irrigation-files')?.click()}
                    className="mb-2 hover:bg-emerald-50 hover:border-emerald-300"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Select Irrigation Diagram Files
                  </Button>
                  <p className="text-xs text-gray-500">or drag and drop files here</p>
                </div>
                
                {irrigationFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected files:</p>
                    {irrigationFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                        <div className="flex items-center gap-3">
                          {file.type.startsWith('image/') ? 
                            <Image className="h-5 w-5 text-emerald-600" /> : 
                            <FileText className="h-5 w-5 text-emerald-600" />
                          }
                          <div>
                            <span className="text-sm font-medium text-gray-900">{file.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index, 'irrigation')}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Current Analysis Documents */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">Current Analysis Documents</Label>
                <p className="text-xs text-gray-500">Upload multiple documents and images for current analysis (max 10MB each)</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                  onChange={(e) => handleFileChange(e.target.files, 'analysis')}
                  className="hidden"
                  id="analysis-files"
                />
                <div className="text-center">
                  <FileText className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('analysis-files')?.click()}
                    className="mb-2 hover:bg-blue-50 hover:border-blue-300"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Select Analysis Documents
                  </Button>
                  <p className="text-xs text-gray-500">or drag and drop files here</p>
                </div>
                
                {analysisFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected files:</p>
                    {analysisFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                          {file.type.startsWith('image/') ? 
                            <Image className="h-5 w-5 text-blue-600" /> : 
                            <FileText className="h-5 w-5 text-blue-600" />
                          }
                          <div>
                            <span className="text-sm font-medium text-gray-900">{file.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index, 'analysis')}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <Button 
              type="submit" 
              disabled={farmerMutation.isPending}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {farmerMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {farmer?.id ? 'Updating Farmer...' : 'Creating Farmer...'}
                </>
              ) : (
                <>
                  {farmer?.id ? 'Update Farmer' : 'Create Farmer'}
                </>
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={farmerMutation.isPending}
              className="px-6 border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transform transition-all duration-200 hover:scale-[1.02] shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Cancel
            </Button>
          </div>
        </form>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
};
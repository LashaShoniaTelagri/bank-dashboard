import { useState, useEffect, type FormEvent } from "react";
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
import ServiceCostCalculator from "@/components/ServiceCostCalculator";
import { calculate, type Selection } from "@/lib/serviceCost";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Upload, X, FileText, Image, MapPin } from "lucide-react";
import GooglePlacesAutocomplete from "@/components/GooglePlacesAutocomplete";
import LoansEditor, { type Loan } from "@/components/LoansEditor";

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
  // New calculator + location fields
  service_cost_tariff?: string;
  service_cost_total_eur?: number;
  service_cost_breakdown?: Record<string, number>;
  service_cost_selections?: Selection;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  cadastral_codes?: string[];
  bank_comment?: string;
  other_comment?: string;
  registration_date?: string;
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
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [step, setStep] = useState<'calculator' | 'details'>('calculator');
  const [calcSelection, setCalcSelection] = useState<Selection>({
    crop: '',
    area: '',
    reservoirs: '',
    outermostDistance: '',
    plantAges: '',
    varieties: '',
    roadDistance: ''
  });
  const [calcTotal, setCalcTotal] = useState<number | null>(null);
  const [calcTariff, setCalcTariff] = useState<string | null>(null);
  const [cadastralCodes, setCadastralCodes] = useState<string[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

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
        title: farmer?.id ? "Farmer updated successfully" : "Farmer registration completed successfully. We will review the submitted information and contact you shortly" 
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
      // Preload calculator if existing
      if (farmer.service_cost_selections) {
        setCalcSelection(farmer.service_cost_selections);
        const res = calculate(farmer.service_cost_selections);
        setCalcTotal(res.total);
        setCalcTariff(res.tariff);
      }
      setStep('details');
    } else {
      // Auto-select bank for bank users, leave empty for admins
      const defaultBankId = profile?.role === 'bank_viewer' ? (profile.bank_id || '') : '';
      
      setFormData({
        bank_id: defaultBankId,
        type: 'company',
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
        service_cost_tariff: undefined,
        service_cost_total_eur: undefined,
        service_cost_breakdown: undefined,
        service_cost_selections: undefined,
        location_name: '',
        location_lat: undefined,
        location_lng: undefined,
        cadastral_codes: [],
        bank_comment: '',
        other_comment: '',
        registration_date: undefined,
      });
      setCalcSelection({ crop: '', area: '', reservoirs: '', outermostDistance: '', plantAges: '', varieties: '', roadDistance: '' });
      setCalcTotal(null);
      setCalcTariff(null);
      setStep('calculator');
      setCadastralCodes([]);
      setLoans([]);
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
    if (!formData.location_name?.trim()) errors.push("Location is required");
    if (!formData.area || formData.area <= 0) errors.push("Area must be greater than 0");
    if (!formData.crop?.trim()) errors.push("Crop is required");
    // Calculator completeness
    if (!calcTotal || !calcTariff) {
      errors.push("Please complete the service cost calculator");
    }
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
    if (formData.mobile && !/^\+?[\d\s\-()]+$/.test(formData.mobile)) {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 'calculator') {
      if (!calcTotal || !calcTariff) {
        toast({ title: 'Please complete the calculator', variant: 'destructive' });
        return;
      }
      setStep('details');
      return;
    }
    if (!validateForm()) return;
    const payload: Farmer = {
      ...formData,
      service_cost_tariff: calcTariff || undefined,
      service_cost_total_eur: calcTotal || undefined,
      service_cost_breakdown: formData.service_cost_breakdown,
      service_cost_selections: calcSelection,
      cadastral_codes: cadastralCodes,
    };
    try {
      let currentFarmerId = farmer?.id as string | undefined;
      if (currentFarmerId) {
        const { error } = await supabase.from('farmers').update(payload).eq('id', currentFarmerId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from('farmers').insert([payload]).select('id').single();
        if (error) throw error;
        currentFarmerId = inserted.id;
      }
      if (irrigationFiles.length > 0) await uploadFiles(currentFarmerId!, irrigationFiles, 'irrigation_diagram');
      if (analysisFiles.length > 0) await uploadFiles(currentFarmerId!, analysisFiles, 'current_analysis');
      if (otherFiles.length > 0) await uploadFiles(currentFarmerId!, otherFiles, 'other');
      if (currentFarmerId) {
        if (farmer?.id) {
          await supabase.from('farmer_loans').delete().eq('farmer_id', currentFarmerId);
        }
        const rows = loans
          .filter(l => l.amount !== '' && l.currency && l.start_date && l.end_date && l.issuance_date)
          .map(l => ({
            farmer_id: currentFarmerId!,
            amount: l.amount as number,
            currency: l.currency,
            start_date: l.start_date,
            end_date: l.end_date,
            issuance_date: l.issuance_date,
          }));
        if (rows.length > 0) {
          const { error: loanErr } = await supabase.from('farmer_loans').insert(rows);
          if (loanErr) throw loanErr;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      toast({ 
        title: farmer?.id ? "Farmer updated successfully" : "Farmer created successfully" 
      });
      onClose();
      setIrrigationFiles([]);
      setAnalysisFiles([]);
    } catch (err: any) {
      toast({ title: 'Error saving farmer', description: err.message, variant: 'destructive' });
    }
  };

  const handleNewBank = () => {
    if (newBankName.trim()) {
      createBankMutation.mutate(newBankName.trim());
    }
  };

  const uploadFiles = async (farmerId: string, files: File[], documentType: 'irrigation_diagram' | 'current_analysis' | 'other') => {
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

  const handleFileChange = (files: FileList | null, type: 'irrigation' | 'analysis' | 'other') => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    
    // Validate file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.google-earth.kml+xml',
      'application/vnd.google-earth.kmz'
    ];
    
    for (const file of fileArray) {
      if (
        allowedTypes.includes(file.type) ||
        file.name.toLowerCase().endsWith('.kml') || file.name.toLowerCase().endsWith('.kmz') ||
        file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx') ||
        file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.xlsx')
      ) {
        if (file.size <= 100 * 1024 * 1024) { // 100MB limit
          validFiles.push(file);
        } else {
          toast({
            title: "File too large",
            description: `${file.name} is larger than 100MB`,
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
    } else if (type === 'analysis') {
      setAnalysisFiles(prev => [...prev, ...validFiles]);
    } else {
      setOtherFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number, type: 'irrigation' | 'analysis' | 'other') => {
    if (type === 'irrigation') {
      setIrrigationFiles(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'analysis') {
      setAnalysisFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setOtherFiles(prev => prev.filter((_, i) => i !== index));
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
          {/* Step switcher */}
          {!farmer?.id && (
            <div className="space-y-4">
              {step === 'calculator' && (
                <ServiceCostCalculator
                  value={calcSelection}
                  onChange={(next, res) => {
                    setCalcSelection(next);
                    if (res) {
                      setCalcTariff(res.tariff);
                      setCalcTotal(res.total);
                      // mirror into formData for submission
                      setFormData(prev => ({
                        ...prev,
                        service_cost_tariff: res.tariff,
                        service_cost_total_eur: res.total,
                        service_cost_breakdown: calculate(next).parts,
                        service_cost_selections: next,
                        crop: next.crop,
                      }));
                    }
                  }}
                  onNext={() => setStep('details')}
                />
              )}
            </div>
          )}

          {step === 'details' && (
          <>
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

          {/* Farmer Type is removed per spec; assume company */}

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
              
              <GooglePlacesAutocomplete
                label="Location"
                value={{ name: formData.location_name || '', lat: formData.location_lat, lng: formData.location_lng }}
                onChange={(loc) => {
                  updateFormData('location_name', loc.name);
                  updateFormData('location_lat', loc.lat);
                  updateFormData('location_lng', loc.lng);
                }}
              />
              
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
              
              {/* Crop is selected in calculator step; keep read-only value here */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Crop</Label>
                <Input value={formData.crop || ''} readOnly />
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
          {/* Cadastral Codes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Cadastral Codes</Label>
            <div className="flex gap-2">
              <Input placeholder="Enter code and press Enter" onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) {
                    setCadastralCodes(prev => Array.from(new Set([...prev, val])));
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }} />
              <Button type="button" variant="outline" onClick={() => setCadastralCodes([])}>Clear</Button>
            </div>
            {cadastralCodes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {cadastralCodes.map((c, i) => (
                  <div key={i} className="px-2 py-1 rounded border text-xs flex items-center gap-2">
                    <span>{c}</span>
                    <button type="button" onClick={() => setCadastralCodes(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Loans and Comments */}
          <LoansEditor loans={loans} onChange={setLoans} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Bank’s Comment on Farmer</Label>
              <Textarea rows={4} value={formData.bank_comment || ''} onChange={(e) => updateFormData('bank_comment', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Other (Upload files or add a comment)</Label>
              <Textarea rows={4} value={formData.other_comment || ''} onChange={(e) => updateFormData('other_comment', e.target.value)} />
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
                <p className="text-xs text-gray-500">Upload images, PDF, KMZ, or KML files (max 100MB each)</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-emerald-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.kml,.kmz,.doc,.docx,.xls,.xlsx"
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
                <p className="text-xs text-gray-500">Upload multiple documents and images (PDF, Word, Excel, Images) (max 100MB each)</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx"
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
            {/* Other Files */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">Other Files</Label>
                <p className="text-xs text-gray-500">Upload any additional files (PDF, Word, Excel, Images) (max 100MB each)</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => handleFileChange(e.target.files, 'other')}
                  className="hidden"
                  id="other-files"
                />
                <div className="text-center">
                  <FileText className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('other-files')?.click()}
                    className="mb-2 hover:bg-gray-50 hover:border-gray-300"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Select Other Files
                  </Button>
                  <p className="text-xs text-gray-500">or drag and drop files here</p>
                </div>
                {otherFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected files:</p>
                    {otherFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {file.type.startsWith('image/') ? 
                            <Image className="h-5 w-5 text-gray-600" /> : 
                            <FileText className="h-5 w-5 text-gray-600" />
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
                          onClick={() => removeFile(index, 'other')}
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
          </>
          )}

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
                  {farmer?.id ? 'Update Farmer' : step === 'calculator' ? 'Next' : 'Register Farmer'}
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
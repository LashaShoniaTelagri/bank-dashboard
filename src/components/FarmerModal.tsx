import { useState, useEffect, useRef, type FormEvent } from "react";
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
import { FileViewer } from "@/components/FileViewer";
import { useAuth } from "@/hooks/useAuth";

// Extended file type for farmer files
interface FarmerFile {
  id: string;
  file_name: string;
  file_path: string;
  file_mime: string;
  file_size_bytes: number;
  created_at: string;
  isExisting?: boolean;
}
import ServiceCostCalculator from "@/components/ServiceCostCalculator";
import { calculate, type Selection } from "@/lib/serviceCost";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Upload, X, FileText, Image, MapPin } from "lucide-react";
import LocationInput, { type LocationData } from "@/components/LocationInput";
import LoansEditor, { type Loan } from "@/components/LoansEditor";

interface Bank {
  id: string;
  name: string;
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
  const [kmzFiles, setKmzFiles] = useState<File[]>([]);
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

  // Track if modal has been initialized to prevent unnecessary resets
  const isInitialized = useRef(false);
  const lastFarmerId = useRef<string | undefined>(undefined);

  const queryClient = useQueryClient();


  // Function to save farmer with all related data
  const saveFarmer = async (payload: Farmer) => {
    let currentFarmerId = farmer?.id as string | undefined;
    
    if (currentFarmerId) {
      const { error } = await supabase.from('farmers').update(payload).eq('id', currentFarmerId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase.from('farmers').insert([payload]).select('id').single();
      if (error) throw error;
      currentFarmerId = inserted.id;
    }
    
    // Only upload new files (not existing ones)
    const newIrrigationFiles = irrigationFiles.filter((f: FarmerFile) => !f.isExisting);
    const newAnalysisFiles = analysisFiles.filter((f: FarmerFile) => !f.isExisting);
    const newOtherFiles = otherFiles.filter((f: FarmerFile) => !f.isExisting);
    const newKmzFiles = kmzFiles.filter((f: FarmerFile) => !f.isExisting);
    
    if (newIrrigationFiles.length > 0) await uploadFiles(currentFarmerId!, newIrrigationFiles, 'irrigation_diagram');
    if (newAnalysisFiles.length > 0) await uploadFiles(currentFarmerId!, newAnalysisFiles, 'current_analysis');
    if (newOtherFiles.length > 0) await uploadFiles(currentFarmerId!, newOtherFiles, 'other');
    if (newKmzFiles.length > 0) await uploadFiles(currentFarmerId!, newKmzFiles, 'other');
    
    if (currentFarmerId) {
      console.log('💾 Saving loans for farmer:', currentFarmerId);
      console.log('📋 Current loans state:', loans);
      
      // Get current loans from database to compare
      const { data: existingLoans, error: fetchError } = await supabase
        .from('farmer_loans')
        .select('id')
        .eq('farmer_id', currentFarmerId);
      
      if (fetchError) {
        console.error('❌ Error fetching existing loans:', fetchError);
        throw fetchError;
      }
      
      const existingLoanIds = new Set(existingLoans?.map(l => l.id) || []);
      console.log('🔍 Existing loan IDs in database:', existingLoanIds);
      
      // Filter valid loans
      const validLoans = loans.filter(l => 
        l.amount !== '' && 
        l.currency && 
        ['GEL', 'USD', 'EUR'].includes(l.currency) && 
        l.start_date && 
        l.end_date && 
        l.issuance_date
      );
      
      console.log('✅ Valid loans to process:', validLoans);
      
      // Separate new loans (no id) from existing loans (with id)
      const newLoans = validLoans.filter(l => !l.id);
      const existingLoansToUpdate = validLoans.filter(l => l.id && existingLoanIds.has(l.id));
      const currentLoanIds = new Set(validLoans.filter(l => l.id).map(l => l.id));
      
      console.log('➕ New loans to insert:', newLoans);
      console.log('🔄 Existing loans to update:', existingLoansToUpdate);
      
      // Delete loans that are no longer in the current list
      const loansToDelete = Array.from(existingLoanIds).filter(id => !currentLoanIds.has(id));
      if (loansToDelete.length > 0) {
        console.log('🗑️ Deleting removed loans:', loansToDelete);
        const { error: deleteError } = await supabase
          .from('farmer_loans')
          .delete()
          .in('id', loansToDelete);
        if (deleteError) {
          console.error('❌ Error deleting loans:', deleteError);
          throw deleteError;
        }
      }
      
      // Insert new loans
      if (newLoans.length > 0) {
        const newLoanRows = newLoans.map(l => ({
          farmer_id: currentFarmerId!,
          bank_id: profile?.bank_id || '',
          amount: l.amount as number,
          currency: l.currency as 'GEL' | 'USD' | 'EUR',
          start_date: l.start_date,
          end_date: l.end_date,
          issuance_date: l.issuance_date,
        }));
        
        console.log('➕ Inserting new loans:', newLoanRows);
        const { error: insertError } = await supabase.from('farmer_loans').insert(newLoanRows);
        if (insertError) {
          console.error('❌ Error inserting new loans:', insertError);
          throw insertError;
        }
        console.log('✅ New loans inserted successfully');
      }
      
      // Update existing loans
      for (const loan of existingLoansToUpdate) {
        console.log('🔄 Updating loan:', loan.id);
        const { error: updateError } = await supabase
          .from('farmer_loans')
          .update({
            amount: loan.amount as number,
            currency: loan.currency as 'GEL' | 'USD' | 'EUR',
            start_date: loan.start_date,
            end_date: loan.end_date,
            issuance_date: loan.issuance_date,
          })
          .eq('id', loan.id);
        
        if (updateError) {
          console.error('❌ Error updating loan:', loan.id, updateError);
          throw updateError;
        }
      }
      
      console.log('✅ All loan operations completed successfully');
    }
    
    return currentFarmerId;
  };

  // Function to load existing loans for a farmer
  const loadFarmerLoans = async (farmerId: string) => {
    try {
      console.log('🔍 Loading loans for farmer:', farmerId);
      const { data, error } = await supabase
        .from('farmer_loans')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      console.log('📊 Loaded loans from database:', data);
      
      if (data && data.length > 0) {
        const formattedLoans = data.map(loan => ({
          id: loan.id,
          amount: loan.amount,
          currency: loan.currency as 'GEL' | 'USD' | 'EUR',
          start_date: loan.start_date || '',
          end_date: loan.end_date || '',
          issuance_date: loan.issuance_date || '',
        }));
        console.log('✅ Setting formatted loans:', formattedLoans);
        setLoans(formattedLoans);
      } else {
        console.log('📝 No loans found, clearing loans state');
        setLoans([]);
      }
    } catch (error) {
      console.error('❌ Error loading farmer loans:', error);
    }
  };

  // Function to load existing documents for a farmer
  const loadFarmerDocuments = async (farmerId: string) => {
    try {
      const { data, error } = await supabase
        .from('farmer_documents')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Create File objects from the document data for display purposes
        const irrigationDocs: File[] = [];
        const analysisDocs: File[] = [];
        const otherDocs: File[] = [];
        const kmzDocs: File[] = [];
        
        data.forEach(doc => {
          // Infer MIME type from file extension for correct viewing in FileViewer
          const lower = doc.file_name.toLowerCase();
          const inferredType =
            lower.endsWith('.pdf') ? 'application/pdf' :
            lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' :
            lower.endsWith('.png') ? 'image/png' :
            lower.endsWith('.doc') ? 'application/msword' :
            lower.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
            lower.endsWith('.xls') ? 'application/vnd.ms-excel' :
            lower.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
            lower.endsWith('.kml') ? 'application/vnd.google-earth.kml+xml' :
            lower.endsWith('.kmz') ? 'application/vnd.google-earth.kmz' :
            'application/octet-stream';

          // Create a mock File object for display (we can't recreate the actual File object)
          const mockFile = new File([''], doc.file_name, { type: inferredType });
          
          // Add a property to track that this is an existing file
          const extendedFile = mockFile as FarmerFile & { documentId: string; filePath: string };
          extendedFile.isExisting = true;
          extendedFile.documentId = doc.id;
          extendedFile.filePath = doc.file_path;
          
          if (doc.document_type === 'irrigation_diagram') {
            irrigationDocs.push(extendedFile);
          } else if (doc.document_type === 'current_analysis') {
            analysisDocs.push(extendedFile);
          } else if (doc.document_type === 'other') {
            if (doc.file_name.toLowerCase().endsWith('.kml') || doc.file_name.toLowerCase().endsWith('.kmz')) {
              kmzDocs.push(extendedFile);
            } else {
              otherDocs.push(extendedFile);
            }
          }
        });
        
        setIrrigationFiles(irrigationDocs);
        setAnalysisFiles(analysisDocs);
        setOtherFiles(otherDocs);
        setKmzFiles(kmzDocs);
      }
    } catch (error) {
      console.error('Error loading farmer documents:', error);
    }
  };

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
      toast({ 
        title: "Bank created successfully",
        variant: "success"
      });
    },
  });

  const farmerMutation = useMutation({
    mutationFn: async (data: Farmer) => {
      return await saveFarmer(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      toast({ 
        title: farmer?.id ? "Farmer updated successfully" : "You have successfully registered the farmer. The Telagri team will review the information you provided and confirm receipt of the request.",
        variant: "success"
      });
      onClose();
      // Reset files
      setIrrigationFiles([]);
      setAnalysisFiles([]);
      setOtherFiles([]);
      setKmzFiles([]);
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
    // Only reset if farmer actually changed or modal is opening for the first time
    const farmerChanged = farmer?.id !== lastFarmerId.current;
    
    console.log('FarmerModal useEffect triggered:', {
      farmer: farmer?.id,
      lastFarmerId: lastFarmerId.current,
      farmerChanged,
      isInitialized: isInitialized.current,
      profileRole: profile?.role
    });
    
    if (farmer && farmerChanged) {
      lastFarmerId.current = farmer.id;
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
        last_year_harvest_amount: farmer.last_year_harvest_amount !== undefined ? farmer.last_year_harvest_amount : undefined,
        irrigation_sectors_count: farmer.irrigation_sectors_count !== undefined ? farmer.irrigation_sectors_count : undefined,
        equipment_list: farmer.equipment_list || '',
        // Include location and other new fields
        location_name: farmer.location_name || '',
        location_lat: farmer.location_lat || undefined,
        location_lng: farmer.location_lng || undefined,
        cadastral_codes: farmer.cadastral_codes || [],
        bank_comment: farmer.bank_comment || '',
        other_comment: farmer.other_comment || '',
      });
      // Preload calculator if existing
      if (farmer.service_cost_selections) {
        setCalcSelection(farmer.service_cost_selections);
        const res = calculate(farmer.service_cost_selections);
        setCalcTotal(res.total);
        setCalcTariff(res.tariff);
      }
      
      // Set cadastral codes if they exist
      if (farmer.cadastral_codes) {
        setCadastralCodes(farmer.cadastral_codes);
      }
      
      // Load existing loans and documents for this farmer
      if (farmer.id) {
        loadFarmerLoans(farmer.id);
        loadFarmerDocuments(farmer.id);
      }
      
      // For editing, default to details but allow access to calculator
      setStep('details');
      isInitialized.current = true;
    } else if (!farmer && (!isInitialized.current || farmerChanged)) {
      lastFarmerId.current = undefined;
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
      
      // Clear file states for new farmer
      setIrrigationFiles([]);
      setAnalysisFiles([]);
      setOtherFiles([]);
      setKmzFiles([]);
      
      isInitialized.current = true;
    }
  }, [farmer, profile]);

  // Separate effect for modal open/close - reset initialization when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Reset files and initialization flag when modal closes
    setIrrigationFiles([]);
    setAnalysisFiles([]);
      setKmzFiles([]);
      setOtherFiles([]);
      isInitialized.current = false;
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const errors: string[] = [];

    // Basic validation
    // Bank selection is only required for admins, bank viewers auto-assign to their bank
    if (profile?.role === 'admin' && !formData.bank_id) {
      errors.push("Bank selection is required");
    }
    if (!formData.name.trim()) errors.push("Name is required");
    if (!formData.id_number.trim()) errors.push("ID Number is required");
    
    // Required fields validation based on current form structure
    if (!formData.full_name?.trim()) errors.push("Director first/last name is required");
    if (!formData.mobile?.trim()) errors.push("Director mobile number is required");
    if (!formData.ltd_name?.trim()) errors.push("Contact person first/last name is required");
    if (!formData.contact_phone?.trim()) errors.push("Contact person mobile is required");
    if (!formData.contact_email?.trim()) errors.push("Company email is required");
    if (!formData.location_name?.trim()) errors.push("Location is required");
    
    // Calculator completeness
    if (!calcTotal || !calcTariff) {
      errors.push("Please complete the service cost calculator");
    }

    // Optional field validation (only validate if provided)
    if (formData.last_year_harvest_amount && formData.last_year_harvest_amount < 0) {
      errors.push("Last year's harvest amount cannot be negative");
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

  // Check if calculator is complete
  const isCalculatorComplete = Boolean(
    calcSelection.crop && 
    calcSelection.area && 
    calcSelection.reservoirs && 
    calcSelection.outermostDistance && 
    calcSelection.plantAges && 
    calcSelection.varieties && 
    calcSelection.roadDistance
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 'calculator') {
      if (!isCalculatorComplete || !calcTotal || !calcTariff) {
        toast({ title: 'Please complete all calculator fields', variant: 'destructive' });
        return;
      }
      setStep('details');
      return;
    }
    if (!validateForm()) return;
    
    // Ensure bank_id is set for bank viewers
    const finalBankId = profile?.role === 'bank_viewer' ? (profile.bank_id || formData.bank_id) : formData.bank_id;
    
    const payload: Farmer = {
      ...formData,
      bank_id: finalBankId,
      service_cost_tariff: calcTariff || undefined,
      service_cost_total_eur: calcTotal || undefined,
      service_cost_breakdown: formData.service_cost_breakdown,
      service_cost_selections: calcSelection,
      cadastral_codes: cadastralCodes.length > 0 ? cadastralCodes : undefined,
    };
    
    // Use the mutation for proper loading states
    farmerMutation.mutate(payload);
  };

  const handleNewBank = () => {
    if (newBankName.trim()) {
      createBankMutation.mutate(newBankName.trim());
    }
  };

  const uploadFiles = async (farmerId: string, files: File[], documentType: 'irrigation_diagram' | 'current_analysis' | 'other') => {
    // Use the current user's bank_id (for bank viewers) or the farmer's bank_id (for admins)
    const bankId = profile?.role === 'bank_viewer' ? profile.bank_id : formData.bank_id;
    
    if (!bankId) {
      throw new Error('Bank ID is required for file upload');
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
      
      // Save document record to database with the correct bank_id
      const insertData = {
          farmer_id: farmerId,
        bank_id: bankId, // Use the determined bank_id
          document_type: documentType,
          file_name: file.name,
          file_path: filePath,
          file_mime: file.type,
          file_size_bytes: file.size,
      };
      
      const { error: dbError } = await supabase
        .from('farmer_documents')
        .insert(insertData);
      
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

  // Simple handler for modal close
  const handleOpenChange = (open: boolean) => {
    // Prevent closing parent modal if file viewer is open
    if (!open && fileViewerOpen) {
      return;
    }
    if (!open) {
      onClose()
    }
  }

  // FileViewer state and helpers for consistent UX with profile modal
  const [fileViewerOpen, setFileViewerOpen] = useState(false)
  const [fileViewerFiles, setFileViewerFiles] = useState<FarmerFile[]>([])
  const [fileViewerInitialIndex, setFileViewerInitialIndex] = useState(0)
  const [fileViewerSectionName, setFileViewerSectionName] = useState('')

  const buildViewerDocsFromFiles = (files: File[]) => {
    return files.map((f, idx) => {
      const farmerFile = f as FarmerFile & { documentId?: string; filePath?: string };
      const isExisting = farmerFile.isExisting
      const fileName = f.name
      const lower = fileName.toLowerCase()
      const derivedMime =
        lower.endsWith('.pdf') ? 'application/pdf' :
        lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' :
        lower.endsWith('.png') ? 'image/png' :
        lower.endsWith('.doc') ? 'application/msword' :
        lower.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
        lower.endsWith('.xls') ? 'application/vnd.ms-excel' :
        lower.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
        lower.endsWith('.kml') ? 'application/vnd.google-earth.kml+xml' :
        lower.endsWith('.kmz') ? 'application/vnd.google-earth.kmz' :
        'application/octet-stream'
      const fileMime = f.type || derivedMime
      const filePath = isExisting ? farmerFile.filePath : `local/${fileName}`
      const id = isExisting ? `existing-${farmerFile.documentId}` : `local-${idx}-${fileName}`
      const createdAt = new Date().toISOString()
      const size = f.size ?? 0
      const base: FarmerFile = {
        id,
        file_name: fileName,
        file_path: filePath,
        file_mime: fileMime,
        file_size_bytes: size,
        created_at: createdAt,
      }
      if (!isExisting) {
        try {
          base.signedUrl = URL.createObjectURL(f)
        } catch (error) {
          console.warn('Failed to create preview URL for file', fileName, error)
        }
      }
      return base
    })
  }

  const openFilesInViewer = (files: File[], clickedIndex: number, sectionName: string) => {
    const docs = buildViewerDocsFromFiles(files)
    setFileViewerFiles(docs)
    setFileViewerInitialIndex(clickedIndex >= 0 ? clickedIndex : 0)
    setFileViewerSectionName(sectionName)
    setFileViewerOpen(true)
  }

  const handleFileViewerClose = () => {
    setFileViewerOpen(false)
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-7xl w-[95vw] h-[95vh] flex flex-col p-0" 
        aria-describedby="farmer-modal-description"
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-card border-b border-border px-6 py-4 rounded-t-lg">
        <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-heading-primary">
            {farmer?.id ? 'Edit Farmer' : 'Add New Farmer'}
          </DialogTitle>
          <p id="farmer-modal-description" className="text-sm text-muted-foreground sr-only">
            Form to {farmer?.id ? 'edit existing' : 'add new'} farmer with agricultural information
          </p>
        </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

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
          {/* Hidden submit button to prevent browser from creating its own */}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          
          {/* Professional Wizard Navigation - Banking Grade - Mobile Responsive */}
          <div className="mb-6 sm:mb-8">
            <div className="relative px-2 sm:px-6">
              {/* Step Indicators - 2-Step Layout - Responsive */}
              <div className="flex flex-col sm:flex-row items-center justify-between w-full relative gap-4 sm:gap-0">
                {/* Progress Line - Hidden on mobile, horizontal on desktop */}
                <div className="hidden sm:block absolute top-1/2 left-0 right-0 transform -translate-y-1/2 z-0">
                  <div className="mx-[120px] h-0.5 bg-border rounded-full">
                    <div 
                      className="h-full bg-gradient-to-r from-primary via-primary to-primary/90 rounded-full transition-all duration-700 ease-out shadow-sm"
                      style={{ width: step === 'calculator' ? '0%' : '100%' }}
                    />
                  </div>
                </div>
                
                {/* Vertical Progress Line - Mobile only */}
                <div className="sm:hidden absolute left-1/2 top-0 bottom-0 transform -translate-x-1/2 z-0">
                  <div className="my-[80px] w-0.5 h-full bg-border rounded-full">
                    <div 
                      className="w-full bg-gradient-to-b from-primary via-primary to-primary/90 rounded-full transition-all duration-700 ease-out shadow-sm"
                      style={{ height: step === 'calculator' ? '0%' : '100%' }}
                    />
                  </div>
                </div>
                {/* Step 1: Service Cost */}
                <div className="flex flex-col items-center bg-card rounded-lg p-4 sm:p-6 w-full sm:w-60 relative z-10">
                  <button
                    type="button"
                    onClick={() => setStep('calculator')}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 font-bold text-sm transition-all duration-300 relative ${
                      step === 'calculator'
                        ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                        : 'bg-background border-primary text-primary hover:bg-primary/5 hover:scale-105 hover:shadow-md'
                    }`}
                  >
                    <span className="relative z-10">1</span>
                    {step === 'calculator' && (
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse" />
                    )}
                  </button>
                  <div className="mt-2 sm:mt-3 text-center">
                    <p className={`text-sm font-semibold transition-colors ${
                      step === 'calculator' ? 'text-primary' : 'text-foreground'
                    }`}>
                      Service Cost
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Calculate pricing</p>
                  </div>
                </div>

                {/* Step 2: Farmer Details */}
                <div className="flex flex-col items-center bg-card rounded-lg p-4 sm:p-6 w-full sm:w-60 relative z-10">
                  <button
                    type="button"
                    onClick={() => setStep('details')}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 font-bold text-sm transition-all duration-300 relative ${
                      step === 'details'
                        ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                        : calcTotal || farmer?.id
                          ? 'bg-background border-primary text-primary hover:bg-primary/5 hover:scale-105 hover:shadow-md'
                          : 'bg-muted border-muted-foreground text-muted-foreground cursor-not-allowed'
                    }`}
                    disabled={!farmer?.id && !calcTotal}
                  >
                    <span className="relative z-10">2</span>
                    {step === 'details' && (
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse" />
                    )}
                  </button>
                  <div className="mt-2 sm:mt-3 text-center">
                    <p className={`text-sm font-semibold transition-colors ${
                      step === 'details' ? 'text-primary' : 
                      calcTotal || farmer?.id ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      Farmer Details
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Personal & agricultural info</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Step Summary - Only show for Farmer Details step */}
            {step !== 'calculator' && (
              <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">Farmer Information</h4>
                    <p className="text-sm text-muted-foreground">
                      Complete farmer profile and agricultural details
                    </p>
                  </div>
                  {calcTotal && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Calculated Cost</p>
                      <p className="text-lg font-bold text-emerald-600">€{calcTotal.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Service Cost Calculator - Available for both new and existing farmers */}
          <div className="space-y-4">
            {step === 'calculator' && (
              <div className="wizard-step-enter">
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
              </div>
            )}
          </div>

          {step === 'details' && (
          <div className="wizard-step-enter">
          {/* Bank Selection - Only show for admins */}
          {profile?.role === 'admin' && (
          <div className="space-y-2 mb-6">
            <Label className="text-sm font-medium text-foreground">Bank <span className="text-red-500">*</span></Label>
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

           {/* 1. Personal Information */}
           <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
             <div className="flex items-center gap-3 pb-4 border-b border-border">
               <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                 <span className="text-primary font-bold text-sm">1</span>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-heading-primary">
                   Personal Information <span className="text-destructive">*</span>
                 </h3>
                 <p className="text-sm text-body-secondary">Company and director details</p>
               </div>
             </div>
            
            <div className="pt-6 space-y-4">
              <h4 className="text-md font-medium text-heading-secondary">About Company</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-sm font-medium text-foreground">
                    Company Name <span className="text-red-500">*</span>
            </Label>
            <Input
                    id="company_name"
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
                    placeholder="Enter company name"
                    className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          <div className="space-y-2">
                  <Label htmlFor="identification_code" className="text-sm font-medium text-foreground">
                    Identification Code <span className="text-red-500">*</span>
            </Label>
            <Input
                    id="identification_code"
              value={formData.id_number}
              onChange={(e) => updateFormData('id_number', e.target.value)}
                    placeholder="Enter identification code"
                    className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          <div className="space-y-2">
                  <Label htmlFor="company_email" className="text-sm font-medium text-foreground">
                    Company Email <span className="text-red-500">*</span>
                  </Label>
            <Input
                    id="company_email"
              type="email"
              value={formData.contact_email || ''}
              onChange={(e) => updateFormData('contact_email', e.target.value)}
                    placeholder="Enter company email"
                    className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
            />
          </div>
          </div>

              <h4 className="text-md font-medium text-heading-secondary mt-6">Company Director</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="director_name" className="text-sm font-medium text-foreground">
                    First/Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="director_name"
                  value={formData.full_name || ''}
                  onChange={(e) => updateFormData('full_name', e.target.value)}
                    placeholder="Director first and last name"
                    className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                  <Label htmlFor="director_mobile" className="text-sm font-medium text-foreground">
                  Mobile <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="director_mobile"
                  type="tel"
                  value={formData.mobile || ''}
                  onChange={(e) => updateFormData('mobile', e.target.value)}
                    placeholder="Director mobile number"
                    className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
                </div>
              </div>
              
              <h4 className="text-md font-medium text-heading-secondary mt-6">Contact Person</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label htmlFor="contact_name" className="text-sm font-medium text-foreground">
                    First/Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="contact_name"
                    value={formData.ltd_name || ''}
                    onChange={(e) => updateFormData('ltd_name', e.target.value)}
                    placeholder="Contact person first and last name"
                    className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                  <Label htmlFor="contact_mobile" className="text-sm font-medium text-foreground">
                    Mobile <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="contact_mobile"
                    type="tel"
                    value={formData.contact_phone || ''}
                    onChange={(e) => updateFormData('contact_phone', e.target.value)}
                    placeholder="Contact person mobile number"
                    className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              </div>
              </div>
            </div>

           {/* 2. Farm Overview */}
           <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mt-6">
             <div className="flex items-center gap-3 pb-4 border-b border-border">
               <div className="flex items-center justify-center w-8 h-8 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                 <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">2</span>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-heading-primary">
                   Farm Overview <span className="text-destructive">*</span>
                 </h3>
                 <p className="text-sm text-body-secondary">Location and agricultural details</p>
               </div>
             </div>
            
            <div className="pt-6 space-y-4">
              <LocationInput
                label="Location"
                value={{ name: formData.location_name || '', lat: formData.location_lat, lng: formData.location_lng }}
                onChange={(loc) => {
                  setFormData(prev => ({
                    ...prev,
                    location_name: loc.name || '',
                    location_lat: loc.lat || undefined,
                    location_lng: loc.lng || undefined
                  }));
                }}
                placeholder="Click to select farm location"
              />
            
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Cadastral Codes</Label>
            <div className="flex gap-2">
                <Input 
                  placeholder="Enter code and press Enter" 
                  onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) {
                    setCadastralCodes(prev => Array.from(new Set([...prev, val])));
                    (e.target as HTMLInputElement).value = '';
                  }
                }
                  }} 
                  className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              <Button type="button" variant="outline" onClick={() => setCadastralCodes([])}>Clear</Button>
            </div>
            {cadastralCodes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {cadastralCodes.map((c, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
                    <span>{c}</span>
                    <button 
                      type="button" 
                      onClick={() => setCadastralCodes(prev => prev.filter((_, idx) => idx !== i))}
                      className="hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Upload (KML/KMZ Files)</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
                <input
                  type="file"
                  accept=".kml,.kmz"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setKmzFiles(prev => [...prev, ...files]);
                    // Reset the input so the same file can be selected again if needed
                    e.target.value = '';
                  }}
                  className="hidden"
                  id="kml-upload"
                />
                <label htmlFor="kml-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-body-secondary">Click to upload KML/KMZ files</p>
                  <p className="text-xs text-muted-foreground">Supports .kml and .kmz formats</p>
                </label>
                </div>
                
              {kmzFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Selected files:</p>
                  {kmzFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => openFilesInViewer(kmzFiles, index, 'Farm Overview')}>
                          {file.name}
                        </button>
                        {(file as any).isExisting && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Uploaded</span>
                        )}
                      </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                        onClick={async () => {
                          const file = kmzFiles[index];
                          if ((file as any).isExisting) {
                            // Delete existing file from database
                            try {
                              const { error } = await supabase
                                .from('farmer_documents')
                                .delete()
                                .eq('id', (file as any).documentId);
                              if (error) throw error;
                              
                              // Also delete from storage
                              const { error: storageError } = await supabase.storage
                                .from('farmer-documents')
                                .remove([(file as any).filePath]);
                              if (storageError) console.warn('Storage deletion failed:', storageError);
                              
                              toast({ 
                                title: "File deleted successfully",
                                variant: "success"
                              });
                            } catch (error) {
                              console.error('Error deleting file:', error);
                              toast({ title: "Error deleting file", variant: "destructive" });
                              return;
                            }
                          }
                          setKmzFiles(prev => prev.filter((_, i) => i !== index));
                        }}
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

           {/* 3. Historical soil Analyses */}
           <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mt-6">
             <div className="flex items-center gap-3 pb-4 border-b border-border">
               <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                 <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">3</span>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-heading-primary">
                   Historical Soil Analyses <span className="text-destructive">*</span>
                 </h3>
                 <p className="text-sm text-body-secondary">Previous soil analysis data</p>
               </div>
             </div>
            
            <div className="pt-6 space-y-2">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAnalysisFiles(prev => [...prev, ...files]);
                    // Reset the input so the same file can be selected again if needed
                    e.target.value = '';
                  }}
                  className="hidden"
                  id="analysis-upload"
                />
                <label htmlFor="analysis-upload" className="cursor-pointer">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-body-secondary">Click to upload soil analysis documents</p>
                  <p className="text-xs text-muted-foreground">Supports PDF, Word, Excel, and Image formats</p>
                </label>
                </div>
                {analysisFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Selected files:</p>
                    {analysisFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => openFilesInViewer(analysisFiles, index, 'Historical soil Analyses')}>
                          {file.name}
                        </button>
                        {(file as any).isExisting && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Uploaded</span>
                        )}
                      </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                        onClick={async () => {
                          const file = analysisFiles[index];
                          if ((file as any).isExisting) {
                            // Delete existing file from database
                            try {
                              const { error } = await supabase
                                .from('farmer_documents')
                                .delete()
                                .eq('id', (file as any).documentId);
                              if (error) throw error;
                              
                              // Also delete from storage
                              const { error: storageError } = await supabase.storage
                                .from('farmer-documents')
                                .remove([(file as any).filePath]);
                              if (storageError) console.warn('Storage deletion failed:', storageError);
                              
                              toast({ 
                                title: "File deleted successfully",
                                variant: "success"
                              });
                            } catch (error) {
                              console.error('Error deleting file:', error);
                              toast({ title: "Error deleting file", variant: "destructive" });
                              return;
                            }
                          }
                          setAnalysisFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

           {/* 4. Last Yield */}
           <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mt-6">
             <div className="flex items-center gap-3 pb-4 border-b border-border">
               <div className="flex items-center justify-center w-8 h-8 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                 <span className="text-amber-600 dark:text-amber-400 font-bold text-sm">4</span>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-heading-primary">
                   Last Yield <span className="text-destructive">*</span>
                 </h3>
                 <p className="text-sm text-body-secondary">Previous harvest information</p>
               </div>
             </div>
            
            <div className="pt-6 space-y-2">
              <Label htmlFor="last_yield" className="text-sm font-medium text-foreground">
                Last Yield Amount <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="last_yield"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.last_year_harvest_amount !== undefined ? formData.last_year_harvest_amount : ''}
                  onChange={(e) => updateFormData('last_year_harvest_amount', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                  placeholder="Enter yield amount"
                  className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
                <span className="text-sm font-medium text-body-secondary bg-muted px-3 py-2 rounded border">Tone</span>
              </div>
            </div>
          </div>

           {/* 5. Loan Details */}
           <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mt-6">
             <div className="flex items-center gap-3 pb-4 border-b border-border">
               <div className="flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                 <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">5</span>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-heading-primary">
                   Loan Details
                 </h3>
                 <p className="text-sm text-body-secondary">Financial arrangements and terms</p>
               </div>
             </div>
            
            <div className="pt-6">
              <LoansEditor
              loans={loans}
              onChange={setLoans}
            />
            </div>
          </div>

           {/* 6. Comment about the farm */}
           <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mt-6">
             <div className="flex items-center gap-3 pb-4 border-b border-border">
               <div className="flex items-center justify-center w-8 h-8 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                 <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">6</span>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-heading-primary">
                   Farm Comments
                 </h3>
                 <p className="text-sm text-body-secondary">Additional observations and notes</p>
               </div>
             </div>
            
            <div className="pt-6">
              <Textarea
              id="bank_comment"
              value={formData.bank_comment || ''}
              onChange={(e) => updateFormData('bank_comment', e.target.value)}
              placeholder="Enter comments about the farm..."
              rows={4}
              className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
            </div>
          </div>

           {/* 7. Other (Upload files) */}
           <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mt-6">
             <div className="flex items-center gap-3 pb-4 border-b border-border">
               <div className="flex items-center justify-center w-8 h-8 bg-slate-100 dark:bg-slate-900/20 rounded-lg">
                 <span className="text-slate-600 dark:text-slate-400 font-bold text-sm">7</span>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-heading-primary">
                   Supporting Documents
                 </h3>
                 <p className="text-sm text-body-secondary">Additional files and documentation</p>
               </div>
             </div>
            
            <div className="pt-6 space-y-2">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setOtherFiles(prev => [...prev, ...files]);
                    // Reset the input so the same file can be selected again if needed
                    e.target.value = '';
                  }}
                  className="hidden"
                  id="other-upload"
                />
                <label htmlFor="other-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-body-secondary">Click to upload additional files</p>
                  <p className="text-xs text-muted-foreground">Any file format accepted</p>
                </label>
                </div>
                {otherFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Selected files:</p>
                    {otherFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => openFilesInViewer(otherFiles, index, 'Supporting Documents')}>
                          {file.name}
                        </button>
                        {(file as any).isExisting && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Uploaded</span>
                        )}
                      </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                        onClick={async () => {
                          const file = otherFiles[index];
                          if ((file as any).isExisting) {
                            // Delete existing file from database
                            try {
                              const { error } = await supabase
                                .from('farmer_documents')
                                .delete()
                                .eq('id', (file as any).documentId);
                              if (error) throw error;
                              
                              // Also delete from storage
                              const { error: storageError } = await supabase.storage
                                .from('farmer-documents')
                                .remove([(file as any).filePath]);
                              if (storageError) console.warn('Storage deletion failed:', storageError);
                              
                              toast({ 
                                title: "File deleted successfully",
                                variant: "success"
                              });
                            } catch (error) {
                              console.error('Error deleting file:', error);
                              toast({ title: "Error deleting file", variant: "destructive" });
                              return;
                            }
                          }
                          setOtherFiles(prev => prev.filter((_, i) => i !== index));
                        }}
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
          )}

        </form>
        </ErrorBoundary>
        </div>

        {/* Professional Wizard Footer */}
        <div className="flex-shrink-0 bg-card border-t border-border px-6 py-4 rounded-b-lg">
          <div className="flex justify-between items-center">
            {/* Previous Button */}
            <div>
              {step === 'details' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('calculator')}
                  className="px-6 py-2 flex items-center gap-2"
                >
                  ← Previous
                </Button>
              )}
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Step {step === 'calculator' ? '1' : '2'} of 2
              </span>
              {calcTotal && step !== 'calculator' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/20 rounded-full">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    Cost: €{calcTotal.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Next/Submit Button */}
            <div>
              {step === 'calculator' ? (
                <Button
                  type="button"
                  disabled={!isCalculatorComplete || (!calcTotal && !farmer?.id)}
                  onClick={() => setStep('details')}
                  className="px-6 py-2 bg-primary hover:bg-primary/90 flex items-center gap-2"
                >
                  Next →
                </Button>
              ) : (
                <Button 
                  type="button" 
                  disabled={farmerMutation.isPending}
                  className="px-8 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                  onClick={() => {
                    const form = document.querySelector('form') as HTMLFormElement;
                    if (form) form.requestSubmit();
                  }}
                >
                  {farmerMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {farmer?.id ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      ✓ {farmer?.id ? 'Update Farmer' : 'Create Farmer'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <FileViewer
      isOpen={fileViewerOpen}
      onClose={handleFileViewerClose}
      files={fileViewerFiles}
      initialFileIndex={fileViewerInitialIndex}
      sectionName={fileViewerSectionName}
    />
    </>
  );
};

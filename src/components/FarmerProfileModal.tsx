import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Droplets, 
  Wheat, 
  Calendar,
  FileText,
  Image,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FileViewer } from "./FileViewer";
import { MapViewer } from "./MapViewer";
import { InlineMapPreview } from "./InlineMapPreview";

interface FarmerDocument {
  id: string;
  document_type: 'irrigation_diagram' | 'current_analysis' | 'other';
  file_name: string;
  file_path: string;
  file_mime: string;
  file_size_bytes: number;
  created_at: string;
}

interface F100Report {
  id: string;
  phase: number;
  issue_date: string;
  score: number;
  file_path: string;
  file_mime: string;
  file_size_bytes: number;
  created_at: string;
}

interface Farmer {
  id: string;
  bank_id: string;
  type: 'person' | 'company';
  name: string;
  id_number: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  // Agricultural fields
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
  created_at: string;
  // new fields
  service_cost_tariff?: string;
  service_cost_total_eur?: number;
  service_cost_breakdown?: Record<string, number>;
  service_cost_selections?: Record<string, string>;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  cadastral_codes?: string[];
  bank_comment?: string;
  other_comment?: string;
}

interface FarmerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
  farmerName: string;
}

export const FarmerProfileModal = ({ isOpen, onClose, farmerId, farmerName }: FarmerProfileModalProps) => {
  const { profile } = useAuth();
  
  // File viewer state
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerFiles, setFileViewerFiles] = useState<FarmerDocument[]>([]);
  const [fileViewerInitialIndex, setFileViewerInitialIndex] = useState(0);
  const [fileViewerSectionName, setFileViewerSectionName] = useState<string>('');

  // Map viewer state
  const [mapViewerOpen, setMapViewerOpen] = useState(false);
  const [mapLocation, setMapLocation] = useState<{name: string; lat: number; lng: number} | null>(null);
  
  // F-100 loading state
  const [isLoadingF100, setIsLoadingF100] = useState<string | null>(null);
  
  // Fetch farmer details
  const { data: farmer, isLoading: farmerLoading } = useQuery({
    queryKey: ['farmer-profile', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmers')
        .select('*')
        .eq('id', farmerId)
        .single();
      
      if (error) throw error;
      return data as Farmer;
    },
    enabled: isOpen && !!farmerId,
  });

  // Fetch loans
  const { data: loans = [] } = useQuery({
    queryKey: ['farmer-loans', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_loans')
        .select('amount,currency,start_date,end_date,issuance_date')
        .eq('farmer_id', farmerId)
        .order('issuance_date', { ascending: false })
      if (error) return []
      return data as { amount: number; currency: string; start_date: string; end_date: string; issuance_date: string }[]
    },
    enabled: isOpen && !!farmerId,
  });

  // Fetch farmer documents
  const { data: documents = [], isLoading: documentsLoading, error: documentsError } = useQuery({
    queryKey: ['farmer-documents', farmerId],
    queryFn: async () => {
      console.log('🔍 Fetching documents for farmer:', farmerId);
      const { data, error } = await supabase
        .from('farmer_documents')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching documents:', error);
        throw error;
      }
      console.log('📄 Documents fetched:', data?.length || 0, 'documents');
      return data as FarmerDocument[];
    },
    enabled: isOpen && !!farmerId,
  });

  // Fetch F-100 reports
  const { data: f100Reports = [] } = useQuery({
    queryKey: ['farmer-f100', farmerId],
    queryFn: async () => {
      console.log('🔍 Fetching F-100 reports for farmer:', farmerId);
      const { data, error } = await supabase
        .from('f100')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('phase', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching F-100 reports:', error);
        throw error;
      }
      console.log('📊 F-100 reports fetched:', data?.length || 0, 'reports');
      return data as F100Report[];
    },
    enabled: isOpen && !!farmerId,
  });

  // Debug logging
  useEffect(() => {
    if (isOpen && farmerId) {
      console.log('📋 FarmerProfileModal opened for farmer:', farmerId);
      console.log('📄 Documents:', documents?.length || 0);
      console.log('🔄 Documents loading:', documentsLoading);
      if (documentsError) {
        console.error('❌ Documents error:', documentsError);
      }
    }
  }, [isOpen, farmerId, documents, documentsLoading, documentsError]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const openFileViewer = (clickedDocument: FarmerDocument, documentsGroup: FarmerDocument[], sectionName: string) => {
    console.log('🎯 Opening file viewer for:', clickedDocument.file_name, 'in section:', sectionName);
    const index = documentsGroup.findIndex(doc => doc.id === clickedDocument.id);
    setFileViewerFiles(documentsGroup);
    setFileViewerInitialIndex(index >= 0 ? index : 0);
    setFileViewerSectionName(sectionName);
    setFileViewerOpen(true);
  };

  const openF100InLightbox = async (report: F100Report) => {
    try {
      console.log('🔍 Opening F-100 report in lightbox:', report.file_path);
      
      // Set loading state for this specific file
      setIsLoadingF100(report.file_path);
      
      // Generate signed URL for the F-100 report
      const { data, error } = await supabase.storage.from('f100').createSignedUrl(report.file_path, 3600);
      
      if (error) {
        console.error('❌ Storage error:', error);
        toast({
          title: "Access Error",
          description: `Could not access F-100 report: ${error.message}`,
          variant: "destructive",
        });
        return;
      }
      
      if (data?.signedUrl) {
        console.log('✅ Successfully generated signed URL for F-100 report');
        
        // Create a mock document object for the FileViewer
        const fileName = `F-100_Phase_${report.phase}_${farmerName}.pdf`;
        const mockDocument = {
          id: `f100-${report.file_path}`,
          file_name: fileName,
          file_path: report.file_path,
          file_mime: 'application/pdf',
          file_size_bytes: report.file_size_bytes || 0,
          created_at: report.created_at,
          signedUrl: data.signedUrl // Add the signed URL directly
        };
        
        // Open in FileViewer
        setFileViewerFiles([mockDocument as any]);
        setFileViewerInitialIndex(0);
        setFileViewerSectionName(`F-100 Report - Phase ${report.phase}`);
        setFileViewerOpen(true);
      } else {
        console.error('❌ No signed URL returned');
        toast({
          title: "Error opening file",
          description: "Could not generate file URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast({
        title: "Error opening F-100 report",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingF100(null);
    }
  };

  const handleFileViewerClose = () => {
    console.log('🔒 Closing file viewer');
    setFileViewerOpen(false);
    // Don't close the main modal, just the file viewer
  };

  const openMapViewer = (locationName: string, lat: number, lng: number) => {
    console.log('🗺️ Opening map viewer for:', locationName);
    setMapLocation({ name: locationName, lat, lng });
    setMapViewerOpen(true);
  };

  const handleMapViewerClose = () => {
    console.log('🔒 Closing map viewer');
    setMapViewerOpen(false);
    setMapLocation(null);
  };

  const downloadFile = async (document: FarmerDocument) => {
    try {
      const { data } = await supabase.storage
        .from('farmer-documents')
        .createSignedUrl(document.file_path, 3600);
      
      if (data?.signedUrl) {
        const linkEl = window.document.createElement('a');
        linkEl.href = data.signedUrl;
        linkEl.download = document.file_name;
        window.document.body.appendChild(linkEl);
        linkEl.click();
        window.document.body.removeChild(linkEl);
      }
    } catch (error) {
      toast({
        title: "Error downloading file",
        description: "Could not download the file",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        // Don't close the modal if the file viewer or map viewer is open
        if (!open && (fileViewerOpen || mapViewerOpen)) {
          console.log('🚫 Preventing modal close because viewer is open');
          return;
        }
        onClose();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 border-b bg-white">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {farmerName} - Profile Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6">

        {farmerLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : farmer ? (
          <div className="space-y-6">
            {/* Debug info - remove in production */}
            {documentsError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">
                  <strong>Documents Error:</strong> {documentsError.message}
                </p>
              </div>
            )}
            
            {documentsLoading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>Loading documents...</strong>
                </p>
              </div>
            )}
            
            {!documentsLoading && documents && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">
                  <strong>Documents loaded:</strong> {documents.length} total documents
                </p>
              </div>
            )}
            {/* About Company */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  About Company
                </CardTitle>
              </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Company Information */}
          <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-2">Company Name</label>
                <p className="text-sm font-semibold text-gray-900">{farmer.name}</p>
                  </div>
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-2">Identification Code</label>
                <p className="text-sm font-semibold text-gray-900">{farmer.id_number}</p>
                </div>
              {farmer.contact_email && (
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-2">Company Email</label>
                  <a 
                    href={`mailto:${farmer.contact_email}`}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                    title="Send email"
                  >
                    {farmer.contact_email}
                  </a>
                </div>
              )}
            </div>
                  </div>

          {/* Company Director */}
          {(farmer.full_name || farmer.mobile) && (
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Company Director</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {farmer.full_name && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-1">First/Last Name</label>
                    <p className="text-sm font-semibold text-gray-900">{farmer.full_name}</p>
                  </div>
                )}
                {farmer.mobile && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-1">Mobile</label>
                    <a 
                      href={`tel:${farmer.mobile}`}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      title="Call mobile"
                    >
                      {farmer.mobile}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact Person */}
          {(farmer.ltd_name || farmer.contact_phone) && (
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Contact Person</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {farmer.ltd_name && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-1">First/Last Name</label>
                    <p className="text-sm font-semibold text-gray-900">{farmer.ltd_name}</p>
                  </div>
                )}
                {farmer.contact_phone && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-1">Mobile</label>
                    <a 
                      href={`tel:${farmer.contact_phone}`}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      title="Call mobile"
                    >
                      {farmer.contact_phone}
                    </a>
                  </div>
                )}
              </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Farm Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Farm Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {farmer.location_name && farmer.location_lat && farmer.location_lng && (
                  <InlineMapPreview
                    location={{
                      name: farmer.location_name,
                      lat: farmer.location_lat,
                      lng: farmer.location_lng
                    }}
                    onExpandClick={() => openMapViewer(farmer.location_name!, farmer.location_lat!, farmer.location_lng!)}
                  />
                )}
                {farmer.cadastral_codes && farmer.cadastral_codes.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-2">Cadastral Codes</label>
                    <div className="flex flex-wrap gap-2">
                      {farmer.cadastral_codes.map((c, i) => (
                        <span key={i} className="px-3 py-1 rounded-full border text-xs bg-gray-100 text-gray-800 font-medium">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Upload (KML/KMZ Files) */}
                {documents.filter(doc => doc.file_name.toLowerCase().endsWith('.kml') || doc.file_name.toLowerCase().endsWith('.kmz')).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-2">Upload (KML/KMZ Files)</label>
                    <div className="space-y-2">
                      {documents.filter(doc => doc.file_name.toLowerCase().endsWith('.kml') || doc.file_name.toLowerCase().endsWith('.kmz')).map((document) => (
                        <div key={document.id} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                          <MapPin className="h-5 w-5 text-gray-600" />
                          <div className="flex-1">
                            <button
                              onClick={() => {
                                const kmzKmlFiles = documents.filter(doc => 
                                  doc.file_name.toLowerCase().endsWith('.kml') || 
                                  doc.file_name.toLowerCase().endsWith('.kmz')
                                );
                                openFileViewer(document, kmzKmlFiles, 'Farm Overview');
                              }}
                              className="text-blue-600 hover:text-blue-800 underline font-medium text-sm cursor-pointer"
                              title="Click to view file"
                            >
                              {document.file_name}
                            </button>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <span>{formatFileSize(document.file_size_bytes)}</span>
                              <span>•</span>
                              <span>{new Date(document.created_at).toLocaleDateString()}</span>
                  </div>
                  </div>
                  </div>
                      ))}
                  </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Cost - Show total cost and calculation details */}
            {(typeof farmer.service_cost_total_eur === 'number' || farmer.service_cost_selections) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Service Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Total Cost */}
                    {typeof farmer.service_cost_total_eur === 'number' && (
                      <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-2">Total Service Cost</label>
                        <p className="text-2xl font-bold text-green-600">€{(farmer.service_cost_total_eur || 0).toLocaleString()}</p>
                      </div>
                    )}

                    {/* Calculation Details - Show to all users */}
                    {farmer.service_cost_selections && (
                      <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-3">Calculation Details</label>
                        <div className="bg-white rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(farmer.service_cost_selections).map(([key, value]) => {
                            // Format the field names to be more user-friendly
                            const fieldLabels: Record<string, string> = {
                              'crop': 'Crop',
                              'area': 'Area',
                              'reservoirs': 'Number of reservoirs',
                              'outermostDistance': 'Outermost distance',
                              'plantAges': 'Plant ages',
                              'varieties': 'Varieties',
                              'roadDistance': 'Distance from road'
                            };
                            
                            const label = fieldLabels[key] || key.replace(/_/g, ' ');
                            
                            return (
                              <div key={key} className="flex flex-col">
                                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</span>
                                <span className="text-sm font-semibold text-gray-900 mt-1">{String(value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Detailed Breakdown - Only show to admins */}
                    {profile?.role === 'admin' && farmer.service_cost_breakdown && Object.keys(farmer.service_cost_breakdown).length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide underline block mb-2">Cost Breakdown (Admin Only)</label>
                        <div className="bg-white rounded-lg p-3 space-y-2">
                          {Object.entries(farmer.service_cost_breakdown).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center text-sm">
                              <span className="capitalize font-medium text-gray-700">{key.replace(/_/g, ' ')}</span>
                              <span className="font-semibold text-gray-900">€{value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Last Yield */}
            {farmer.last_year_harvest_amount && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wheat className="h-5 w-5" />
                    Last Yield
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div>
                    <label className="text-sm font-medium text-gray-600">Last Yield Amount</label>
                    <p className="mt-1 text-lg font-semibold">{farmer.last_year_harvest_amount} Tone</p>
                    </div>
                </CardContent>
              </Card>
            )}

            {/* Comment about the farm */}
            {farmer.bank_comment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Comment about the farm
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{farmer.bank_comment}</p>
                </CardContent>
              </Card>
            )}

            {/* Historical soil Analyses */}
            {documents.filter(doc => doc.document_type === 'current_analysis').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Historical soil Analyses
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                  </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.filter(doc => doc.document_type === 'current_analysis').map((document) => (
                        <div key={document.id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                          {getFileIcon(document.file_mime)}
                          <div className="flex-1">
                            <button
                              onClick={() => {
                                const analysisFiles = documents.filter(doc => doc.document_type === 'current_analysis');
                                openFileViewer(document, analysisFiles, 'Historical soil Analyses');
                              }}
                              className="text-blue-600 hover:text-blue-800 underline font-medium text-sm cursor-pointer"
                              title="Click to view file"
                            >
                              {document.file_name}
                            </button>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <span>{formatFileSize(document.file_size_bytes)}</span>
                              <span>•</span>
                              <span>{new Date(document.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Other (Upload files) */}
            {documents.filter(doc => doc.document_type === 'other').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Other
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {documents.filter(doc => doc.document_type === 'other').map((document) => (
                      <div key={document.id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                        {getFileIcon(document.file_mime)}
                        <div className="flex-1">
                          <button
                            onClick={() => {
                              const otherFiles = documents.filter(doc => doc.document_type === 'other');
                              openFileViewer(document, otherFiles, 'Other');
                            }}
                            className="text-blue-600 hover:text-blue-800 underline font-medium text-sm cursor-pointer"
                            title="Click to view file"
                          >
                            {document.file_name}
                          </button>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span>{formatFileSize(document.file_size_bytes)}</span>
                            <span>•</span>
                            <span>{new Date(document.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              </CardContent>
            </Card>
            )}

            {/* Loan Details */}
            {loans.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Loan Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loans.map((loan, i) => (
                      <div key={i} className="border rounded-lg p-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-gray-600">Amount</label>
                            <p className="text-lg font-bold text-green-600">
                              {loan.amount.toLocaleString()} {loan.currency}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Currency</label>
                            <p className="text-sm">{loan.currency}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Start date</label>
                            <p className="text-sm">{new Date(loan.start_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">End date</label>
                            <p className="text-sm">{new Date(loan.end_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Issuance date</label>
                            <p className="text-sm">{new Date(loan.issuance_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Creation Date */}
            <div className="text-xs text-gray-500 text-center">
              Created on {new Date(farmer.created_at).toLocaleDateString()} at {new Date(farmer.created_at).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Farmer not found</p>
          </div>
        )}

          <div className="flex justify-end pt-6 border-t">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
            Close
            </button>
          </div>
        
        </div>
      </DialogContent>
    </Dialog>
      
      {/* File Viewer - Outside Dialog to avoid z-index issues */}
      <FileViewer
        isOpen={fileViewerOpen}
        onClose={handleFileViewerClose}
        files={fileViewerFiles}
        initialFileIndex={fileViewerInitialIndex}
        sectionName={fileViewerSectionName}
      />

      {/* Map Viewer - Outside Dialog to avoid z-index issues */}
      {mapLocation && (
        <MapViewer
          isOpen={mapViewerOpen}
          onClose={handleMapViewerClose}
          location={mapLocation}
        />
      )}
    </>
  );
};

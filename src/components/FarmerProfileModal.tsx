import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  Download,
  Eye,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FarmerDocument {
  id: string;
  document_type: 'irrigation_diagram' | 'current_analysis' | 'other';
  file_name: string;
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
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['farmer-documents', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_documents')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FarmerDocument[];
    },
    enabled: isOpen && !!farmerId,
  });

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

  const previewFile = async (document: FarmerDocument) => {
    try {
      const { data } = await supabase.storage
        .from('farmer-documents')
        .createSignedUrl(document.file_path, 3600);
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      toast({
        title: "Error opening file",
        description: "Could not open the file for preview",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {farmerName} - Profile Details
          </DialogTitle>
        </DialogHeader>

        {farmerLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : farmer ? (
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Type</label>
                  <div className="mt-1">
                    <Badge variant={farmer.type === 'person' ? 'default' : 'secondary'} className="px-2 py-0.5">
                      <span>{farmer.type === 'person' ? 'Person' : 'Company'}</span>
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">ID Number</label>
                  <p className="mt-1 text-sm">{farmer.id_number}</p>
                </div>
                {farmer.ltd_name && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">LTD Name</label>
                    <p className="mt-1 text-sm">{farmer.ltd_name}</p>
                  </div>
                )}
                {farmer.full_name && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Full Name</label>
                    <p className="mt-1 text-sm">{farmer.full_name}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {farmer.contact_phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Phone</label>
                    <p className="mt-1 text-sm">{farmer.contact_phone}</p>
                  </div>
                )}
                {farmer.mobile && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Mobile</label>
                    <p className="mt-1 text-sm">{farmer.mobile}</p>
                  </div>
                )}
                {farmer.contact_email && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="mt-1 text-sm">{farmer.contact_email}</p>
                  </div>
                )}
                {farmer.contact_address && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-600">Address</label>
                    <p className="mt-1 text-sm">{farmer.contact_address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agricultural Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wheat className="h-5 w-5" />
                  Agricultural Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {farmer.location_name && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Farm Location</label>
                    <p className="mt-1 text-sm">{farmer.location_name} {farmer.location_lat && farmer.location_lng ? `(${farmer.location_lat.toFixed(5)}, ${farmer.location_lng.toFixed(5)})` : ''}</p>
                  </div>
                )}
                {farmer.cadastral_codes && farmer.cadastral_codes.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-600">Cadastral Codes</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {farmer.cadastral_codes.map((c, i) => (
                        <span key={i} className="px-2 py-1 rounded border text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {farmer.area && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Area (hectares)</label>
                    <p className="mt-1 text-sm">{farmer.area}</p>
                  </div>
                )}
                {farmer.crop && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Crop</label>
                    <p className="mt-1 text-sm">{farmer.crop}</p>
                  </div>
                )}
                {farmer.variety && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Variety</label>
                    <p className="mt-1 text-sm">{farmer.variety}</p>
                  </div>
                )}
                {farmer.variety_cultivation_year && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cultivation Year</label>
                    <p className="mt-1 text-sm">{farmer.variety_cultivation_year}</p>
                  </div>
                )}
                {farmer.variety_cultivation_area && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cultivation Area (hectares)</label>
                    <p className="mt-1 text-sm">{farmer.variety_cultivation_area}</p>
                  </div>
                )}
                {farmer.irrigation_type && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Irrigation Type</label>
                    <p className="mt-1 text-sm">{farmer.irrigation_type}</p>
                  </div>
                )}
                {farmer.water_source && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Water Source</label>
                    <p className="mt-1 text-sm">{farmer.water_source}</p>
                  </div>
                )}
                {farmer.last_year_harvest_amount && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Last Year's Harvest (tons)</label>
                    <p className="mt-1 text-sm">{farmer.last_year_harvest_amount}</p>
                  </div>
                )}
                {farmer.irrigation_sectors_count && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Irrigation Sectors</label>
                    <p className="mt-1 text-sm">{farmer.irrigation_sectors_count}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Cost */}
            {(farmer.service_cost_total_eur || farmer.service_cost_tariff) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Service Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {farmer.service_cost_tariff && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Tariff</label>
                        <p className="mt-1 text-sm">{farmer.service_cost_tariff}</p>
                      </div>
                    )}
                    {typeof farmer.service_cost_total_eur === 'number' && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Total (EUR)</label>
                        <p className="mt-1 text-sm">€{(farmer.service_cost_total_eur || 0).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bank & Other Comments */}
            {(farmer.bank_comment || farmer.other_comment) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Comments
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {farmer.bank_comment && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Bank’s Comment</label>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{farmer.bank_comment}</p>
                    </div>
                  )}
                  {farmer.other_comment && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Other Comment</label>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{farmer.other_comment}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reservoir Information */}
            {farmer.has_reservoir && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5" />
                    Reservoir Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {farmer.reservoir_capacity && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Capacity (cubic meters)</label>
                      <p className="mt-1 text-sm">{farmer.reservoir_capacity}</p>
                    </div>
                  )}
                  {farmer.reservoir_amount && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Current Amount (cubic meters)</label>
                      <p className="mt-1 text-sm">{farmer.reservoir_amount}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Equipment */}
            {farmer.equipment_list && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Equipment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{farmer.equipment_list}</p>
                </CardContent>
              </Card>
            )}

            {/* Uploaded Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Uploaded Documents ({documents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                  </div>
                ) : documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((document) => (
                      <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getFileIcon(document.file_mime)}
                          <div>
                            <p className="font-medium text-sm">{document.file_name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Badge variant="outline" className="text-xs px-2 py-0.5">
                                <span>{document.document_type.replace('_', ' ')}</span>
                              </Badge>
                              <span>{formatFileSize(document.file_size_bytes)}</span>
                              <span>{new Date(document.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => previewFile(document)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(document)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No documents uploaded yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Loans */}
            {loans.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Loans ({loans.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {loans.map((l, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border rounded">
                        <div className="text-sm">Amount: {l.amount.toLocaleString()} {l.currency}</div>
                        <div className="text-xs text-gray-600">Start: {l.start_date} • End: {l.end_date} • Issued: {l.issuance_date}</div>
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

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

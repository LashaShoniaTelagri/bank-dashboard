// Orchard map types for farmer visualization

export interface OrchardMap {
  id: string;
  farmer_id: string;
  name: string;
  file_path: string;
  file_type: 'pdf' | 'image';
  mime_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
  notes?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrchardMapUpload {
  file: File;
  name: string;
  notes?: string;
  farmer_id: string;
}


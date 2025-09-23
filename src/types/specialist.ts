// Specialist role and data analysis types for TelAgri Monitoring
// Banking-grade type definitions for agricultural data analysis

export type DataType = 
  | 'photo'
  | 'analysis'
  | 'geospatial'
  | 'text'
  | 'document'
  | 'video'
  | 'audio';

export type AnalysisPhase = 
  | 'initial_assessment'
  | 'crop_analysis'
  | 'soil_analysis'
  | 'irrigation_analysis'
  | 'harvest_analysis'
  | 'financial_analysis'
  | 'compliance_review'
  | 'final_report';

export type AnalysisStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'requires_review'
  | 'cancelled';

export type LLMProvider = 
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure';

export type UserRole = 
  | 'admin'
  | 'bank_viewer'
  | 'specialist';

// Farmer data upload interface
export interface FarmerDataUpload {
  id: string;
  farmer_id: string;
  bank_id: string;
  uploaded_by: string;
  data_type: DataType;
  file_name: string;
  file_path: string;
  file_mime: string;
  file_size_bytes: number;
  metadata: Record<string, unknown>;
  description?: string;
  tags: string[];
  phase: AnalysisPhase;
  created_at: string;
  updated_at: string;
}

// Specialist assignment interface
export interface SpecialistAssignment {
  id: string;
  farmer_id: string;
  bank_id: string;
  specialist_id: string;
  phase: AnalysisPhase;
  assigned_by: string;
  assigned_at: string;
  status: AnalysisStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Analysis session interface
export interface AnalysisSession {
  id: string;
  farmer_id: string;
  bank_id: string;
  specialist_id: string;
  phase: AnalysisPhase;
  session_name: string;
  context_data: Record<string, unknown>;
  analysis_prompt: string;
  llm_response?: string;
  llm_model?: string;
  llm_usage?: Record<string, unknown>;
  status: AnalysisStatus;
  created_at: string;
  updated_at: string;
}

// Analysis attachment interface
export interface AnalysisAttachment {
  id: string;
  session_id: string;
  data_upload_id: string;
  created_at: string;
}

// Chat message interface
export interface ChatMessage {
  id: string;
  farmer_id: string;
  bank_id: string;
  sender_id: string;
  sender_role: UserRole;
  message: string;
  attachments: Record<string, unknown>[];
  session_id?: string;
  is_read: boolean;
  created_at: string;
}

// LLM API key interface
export interface LLMApiKey {
  id: string;
  user_id: string;
  provider: LLMProvider;
  key_name: string;
  encrypted_key: string;
  is_active: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

// Specialist dashboard data interface
export interface SpecialistDashboardData {
  assignment_id: string;
  farmer_id: string;
  phase: AnalysisPhase;
  assignment_status: AnalysisStatus;
  assigned_at: string;
  notes?: string;
  farmer_name: string;
  farmer_id_number: string;
  bank_name: string;
  data_uploads_count: number;
  photo_count: number;
  analysis_count: number;
  geospatial_count: number;
  text_count: number;
  analysis_sessions_count: number;
  last_analysis_at?: string;
}

// Specialist assignment with data interface
export interface SpecialistAssignmentWithData {
  assignment_id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_id_number: string;
  bank_name: string;
  phase: AnalysisPhase;
  status: AnalysisStatus;
  assigned_at: string;
  data_uploads_count: number;
  analysis_sessions_count: number;
  last_activity?: string;
}

// Data upload form interface
export interface DataUploadForm {
  farmer_id: string;
  data_type: DataType;
  file: File;
  description?: string;
  tags: string[];
  phase: AnalysisPhase;
}

// Specialist assignment form interface
export interface SpecialistAssignmentForm {
  farmer_id: string;
  specialist_id: string;
  phase: AnalysisPhase;
  notes?: string;
}

// Analysis session form interface
export interface AnalysisSessionForm {
  farmer_id: string;
  phase: AnalysisPhase;
  session_name: string;
  analysis_prompt: string;
  context_data: Record<string, unknown>;
  attachments: string[];
}

// LLM API key form interface
export interface LLMApiKeyForm {
  provider: LLMProvider;
  key_name: string;
  api_key: string;
}

// Chat message form interface
export interface ChatMessageForm {
  farmer_id: string;
  message: string;
  attachments?: File[];
  session_id?: string;
}

// Analysis result interface
export interface AnalysisResult {
  success: boolean;
  data?: {
    analysis: string;
    recommendations: string[];
    confidence_score: number;
    processing_time: number;
    model_used: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// File upload progress interface
export interface UploadProgress {
  file_name: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

// Phase configuration interface
export interface PhaseConfig {
  phase: AnalysisPhase;
  name: string;
  description: string;
  required_data_types: DataType[];
  estimated_duration: string;
  deliverables: string[];
}

// Specialist profile interface
export interface SpecialistProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  specialization: string[];
  experience_years: number;
  certifications: string[];
  languages: string[];
  availability: 'available' | 'busy' | 'unavailable';
  max_concurrent_assignments: number;
  current_assignments: number;
  created_at: string;
  updated_at: string;
}

// Constants for analysis phases
export const ANALYSIS_PHASES: Record<AnalysisPhase, PhaseConfig> = {
  initial_assessment: {
    phase: 'initial_assessment',
    name: 'Initial Assessment',
    description: 'Initial evaluation of farmer data and requirements',
    required_data_types: ['text', 'document'],
    estimated_duration: '2-3 days',
    deliverables: ['Assessment report', 'Data requirements']
  },
  crop_analysis: {
    phase: 'crop_analysis',
    name: 'Crop Analysis',
    description: 'Analysis of crop health, growth patterns, and yield predictions',
    required_data_types: ['photo', 'geospatial', 'analysis'],
    estimated_duration: '3-5 days',
    deliverables: ['Crop health report', 'Yield predictions', 'Recommendations']
  },
  soil_analysis: {
    phase: 'soil_analysis',
    name: 'Soil Analysis',
    description: 'Comprehensive soil health and composition analysis',
    required_data_types: ['analysis', 'geospatial', 'text'],
    estimated_duration: '4-6 days',
    deliverables: ['Soil health report', 'Fertilization recommendations', 'Soil maps']
  },
  irrigation_analysis: {
    phase: 'irrigation_analysis',
    name: 'Irrigation Analysis',
    description: 'Water management and irrigation system optimization',
    required_data_types: ['geospatial', 'analysis', 'photo'],
    estimated_duration: '3-4 days',
    deliverables: ['Irrigation plan', 'Water usage optimization', 'System recommendations']
  },
  harvest_analysis: {
    phase: 'harvest_analysis',
    name: 'Harvest Analysis',
    description: 'Harvest timing, quality, and yield analysis',
    required_data_types: ['photo', 'analysis', 'text'],
    estimated_duration: '2-3 days',
    deliverables: ['Harvest timing report', 'Quality assessment', 'Yield analysis']
  },
  financial_analysis: {
    phase: 'financial_analysis',
    name: 'Financial Analysis',
    description: 'Cost-benefit analysis and financial projections',
    required_data_types: ['text', 'document', 'analysis'],
    estimated_duration: '3-4 days',
    deliverables: ['Financial projections', 'Cost analysis', 'ROI calculations']
  },
  compliance_review: {
    phase: 'compliance_review',
    name: 'Compliance Review',
    description: 'Regulatory compliance and certification review',
    required_data_types: ['document', 'text'],
    estimated_duration: '2-3 days',
    deliverables: ['Compliance report', 'Certification status', 'Recommendations']
  },
  final_report: {
    phase: 'final_report',
    name: 'Final Report',
    description: 'Comprehensive final analysis and recommendations',
    required_data_types: ['text', 'document', 'analysis'],
    estimated_duration: '3-5 days',
    deliverables: ['Final report', 'Executive summary', 'Action plan']
  }
};

// Constants for data types
export const DATA_TYPES: Record<DataType, { name: string; description: string; maxSize: string }> = {
  photo: {
    name: 'Photo',
    description: 'Agricultural photos, crop images, field documentation',
    maxSize: '10MB'
  },
  analysis: {
    name: 'Analysis',
    description: 'Laboratory analysis results, soil tests, water quality reports',
    maxSize: '5MB'
  },
  geospatial: {
    name: 'Geospatial',
    description: 'GPS coordinates, satellite imagery, field boundaries',
    maxSize: '50MB'
  },
  text: {
    name: 'Text',
    description: 'Notes, observations, reports, documentation',
    maxSize: '1MB'
  },
  document: {
    name: 'Document',
    description: 'PDFs, certificates, contracts, official documents',
    maxSize: '20MB'
  },
  video: {
    name: 'Video',
    description: 'Field videos, drone footage, process documentation',
    maxSize: '100MB'
  },
  audio: {
    name: 'Audio',
    description: 'Voice notes, interviews, field recordings',
    maxSize: '10MB'
  }
};

// Constants for LLM providers
export const LLM_PROVIDERS: Record<LLMProvider, { name: string; description: string; models: string[] }> = {
  openai: {
    name: 'OpenAI',
    description: 'GPT models for text analysis and generation',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude models for advanced reasoning and analysis',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
  },
  google: {
    name: 'Google',
    description: 'Gemini models for multimodal analysis',
    models: ['gemini-pro', 'gemini-pro-vision']
  },
  azure: {
    name: 'Azure OpenAI',
    description: 'Azure-hosted OpenAI models for enterprise use',
    models: ['gpt-4', 'gpt-35-turbo']
  }
};

// Utility types for form validation
export type DataUploadValidation = {
  farmer_id: boolean;
  data_type: boolean;
  file: boolean;
  phase: boolean;
};

export type SpecialistAssignmentValidation = {
  farmer_id: boolean;
  specialist_id: boolean;
  phase: boolean;
};

export type AnalysisSessionValidation = {
  farmer_id: boolean;
  phase: boolean;
  session_name: boolean;
  analysis_prompt: boolean;
};

// Error types for specialist operations
export class SpecialistError extends Error {
  constructor(
    message: string,
    public code: string,
    public userFriendlyMessage: string,
    public severity: 'low' | 'medium' | 'high' | 'critical',
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SpecialistError';
  }
}

export class DataUploadError extends SpecialistError {
  constructor(message: string, public fileType: DataType) {
    super(
      message,
      'DATA_UPLOAD_ERROR',
      'Failed to upload data. Please check file format and try again.',
      'medium',
      { fileType }
    );
  }
}

export class AnalysisError extends SpecialistError {
  constructor(message: string, public phase: AnalysisPhase) {
    super(
      message,
      'ANALYSIS_ERROR',
      'Analysis failed. Please check your data and try again.',
      'high',
      { phase }
    );
  }
}

export class LLMError extends SpecialistError {
  constructor(message: string, public provider: LLMProvider) {
    super(
      message,
      'LLM_ERROR',
      'AI analysis failed. Please check your API key and try again.',
      'high',
      { provider }
    );
  }
}
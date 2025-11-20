// Specialist role and data analysis types for TelAgri Monitoring
// Banking-grade type definitions for agricultural data analysis

export type DataType = 
  | 'photo'
  | 'analysis'
  | 'maps'
  | 'climate'
  | 'text'
  | 'document'
  | 'video'
  | 'geospatial' // Legacy support - will be migrated to 'maps'
  | 'audio'; // Legacy support - removed from UI

// F-100 phases are now represented as numbers 1-12
export type F100Phase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type AnalysisStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'pending_review'
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
  phase: F100Phase;
  ai_description?: string;
  ai_description_generated_at?: string;
  iframe_urls?: Array<{ url: string; name: string; annotation?: string }>;
  created_at: string;
  updated_at: string;
}

export interface AIChatSession {
  id: string;
  farmer_id: string;
  specialist_id: string;
  assignment_id?: string | null;
  phase: F100Phase;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface AIChatMessage {
  id: string;
  session_id: string;
  sender_role: 'specialist' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIChatContextFile {
  id: string;
  message_id: string;
  data_upload_id: string;
  created_at: string;
}

// Specialist assignment interface
export interface SpecialistAssignment {
  id: string;
  farmer_id: string;
  bank_id: string;
  specialist_id: string;
  phase: F100Phase;
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
  phase: F100Phase;
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
  phase: F100Phase;
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
  farmer_id_number: string;
  crop: string;
  farmer_name?: string;
  phase: F100Phase;
  status: AnalysisStatus;
  assigned_at: string;
  data_uploads_count: number;
  analysis_sessions_count: number;
  last_activity?: string;
  f100_doc_url?: string;
}

// Data upload form interface
export interface DataUploadForm {
  farmer_id: string;
  data_type: DataType;
  file: File;
  description?: string;
  tags: string[];
  phase: F100Phase;
}

// Specialist assignment form interface
export interface SpecialistAssignmentForm {
  farmer_id: string;
  specialist_id: string;
  phase: F100Phase;
  notes?: string;
}

// Analysis session form interface
export interface AnalysisSessionForm {
  farmer_id: string;
  phase: F100Phase;
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

// F-100 phase utility functions
export const getPhaseLabel = (phase: F100Phase): string => `Phase ${phase}`;

// Status management utilities
export const getStatusLabel = (status: AnalysisStatus): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'pending_review':
      return 'Pending Review';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

export const getStatusColor = (status: AnalysisStatus): string => {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'pending_review':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getStatusIcon = (status: AnalysisStatus): string => {
  switch (status) {
    case 'pending':
      return 'Clock';
    case 'in_progress':
      return 'Play';
    case 'completed':
      return 'CheckCircle';
    case 'pending_review':
      return 'AlertCircle';
    case 'cancelled':
      return 'XCircle';
    default:
      return 'Clock';
  }
};

// Define allowed status transitions for specialists
export const getAllowedStatusTransitions = (currentStatus: AnalysisStatus): AnalysisStatus[] => {
  switch (currentStatus) {
    case 'pending':
      return ['in_progress', 'cancelled'];
    case 'in_progress':
      return ['completed', 'pending_review', 'pending', 'cancelled'];
    case 'completed':
      return ['pending_review']; // Can request review even after completion
    case 'pending_review':
      return ['in_progress', 'completed']; // Can go back to work or mark as final
    case 'cancelled':
      return ['pending']; // Can reactivate cancelled tasks
    default:
      return [];
  }
};

export const getPhaseDescription = (phase: F100Phase): string => {
  const descriptions: Record<F100Phase, string> = {
    1: 'Initial Assessment - Basic farm evaluation and data collection',
    2: 'Land Analysis - Soil composition and land use assessment', 
    3: 'Crop Planning - Crop selection and planting strategy',
    4: 'Resource Planning - Water, fertilizer, and equipment planning',
    5: 'Implementation - Planting and initial cultivation activities',
    6: 'Growth Monitoring - Crop development and health tracking',
    7: 'Mid-Season Review - Progress assessment and adjustments',
    8: 'Harvest Preparation - Pre-harvest planning and preparation',
    9: 'Harvest Execution - Harvesting activities and yield recording',
    10: 'Post-Harvest Processing - Storage, processing, and quality control',
    11: 'Financial Analysis - Cost analysis and revenue calculation',
    12: 'Final Report - Comprehensive season summary and recommendations'
  };
  return descriptions[phase];
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
  maps: {
    name: 'Maps',
    description: 'GPS coordinates, satellite imagery, field boundaries',
    maxSize: '50MB'
  },
  climate: {
    name: 'Climate',
    description: 'Weather, rainfall, temperature, and climate indicators',
    maxSize: '20MB'
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
  geospatial: {
    name: 'Maps',
    description: 'Legacy alias for maps data types',
    maxSize: '50MB'
  },
  audio: {
    name: 'Audio',
    description: 'Legacy audio uploads (no longer exposed in UI)',
    maxSize: '20MB'
  },
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
  constructor(message: string, public phase: F100Phase) {
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
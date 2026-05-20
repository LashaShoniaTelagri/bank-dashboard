// Types for farmer phase management system

export interface MonitoredIssue {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  description?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export interface FarmerPhase {
  id: string;
  farmer_id: string;
  phase_number: number;
  score: number | null;
  issue_date: string | null;
  notes: string | null;
  one_pager_summary?: string | null; // Rich text summary for One Pager
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface PhaseMonitoredData {
  id: string;
  farmer_id: string;
  phase_number: number;
  issue_id: string;
  status: 'good' | 'warning' | 'critical' | 'pending' | null;
  value: number | null;
  notes: string | null;
  description?: string | null; // Phase-specific description per farmer
  created_at: string;
  updated_at: string;
}

export interface PhaseWithData extends FarmerPhase {
  monitored_data: (PhaseMonitoredData & { issue: MonitoredIssue })[];
}

export interface ComparisonSelection {
  phaseNumber: number;
  issueId: string;
  issueName: string;
  phaseScore?: number | null;
}


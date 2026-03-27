import type { Database } from "@/integrations/supabase/types";

export type UnderwritingStatus = Database["public"]["Enums"]["underwriting_status"];

export type UnderwritingApplication = Database["public"]["Tables"]["underwriting_applications"]["Row"] & {
  shapefile_urls?: string[] | null;
};
export type UnderwritingApplicationInsert = Database["public"]["Tables"]["underwriting_applications"]["Insert"];

export type ApplicationScore = Database["public"]["Tables"]["application_scores"]["Row"];
export type ApplicationScoreInsert = Database["public"]["Tables"]["application_scores"]["Insert"];

export const CROP_TYPES = [
  { value: 'almond', label: 'Almond' },
  { value: 'apple', label: 'Apple' },
  { value: 'pear', label: 'Pear' },
  { value: 'corn', label: 'Corn' },
  { value: 'cotton', label: 'Cotton' },
] as const;

export interface CropType {
  id: string;
  value: string;
  label: string;
  is_active: boolean;
}

export interface CropRequest {
  id: string;
  crop_name: string;
  requested_by: string;
  bank_id: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<UnderwritingStatus, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  scored: 'Scored',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<UnderwritingStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  scored: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function formatAppNumber(id: string): string {
  return 'UW-' + id.replace(/-/g, '').substring(0, 8).toUpperCase();
}

export function generateStoragePath(appId: string): string {
  const firstChar = appId.replace(/-/g, '')[0];
  return `${firstChar}/${appId}.zip`;
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ACCEPTED_FILE_TYPES = ['.zip', '.shp', '.kml', '.kmz'];

export const SCORING_DEADLINE_HOURS = 48;

export function getScoringCountdown(submittedAt: string, hasScore: boolean): { label: string; isOverdue: boolean } {
  if (hasScore) return { label: '', isOverdue: false };
  const submitted = new Date(submittedAt).getTime();
  const deadline = submitted + SCORING_DEADLINE_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const remainingMs = deadline - now;

  if (remainingMs <= 0) {
    return { label: 'Pending', isOverdue: true };
  }

  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  return { label: `Scoring in ${remainingHours}h`, isOverdue: false };
}

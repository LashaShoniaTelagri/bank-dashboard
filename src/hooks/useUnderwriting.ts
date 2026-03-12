import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  UnderwritingApplication,
  UnderwritingApplicationInsert,
  ApplicationScore,
  ApplicationScoreInsert,
  UnderwritingStatus,
  CropType,
  CropRequest,
} from "@/types/underwriting";
import { generateStoragePath, formatAppNumber } from "@/types/underwriting";

export interface ApplicationFilters {
  status?: UnderwritingStatus | 'all';
  cropType?: string;
  bankId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface SpecialistAssignment {
  id: string;
  application_id: string;
  specialist_id: string;
  assigned_by: string;
  assigned_at: string;
  notes: string | null;
  specialist_email?: string;
}

export function useUnderwritingApplications(
  bankId?: string,
  filters?: ApplicationFilters,
  page = 0,
  pageSize = 50
) {
  return useQuery({
    queryKey: ['underwriting-applications', bankId, filters, page],
    queryFn: async () => {
      let query = supabase
        .from('underwriting_applications')
        .select('*', { count: 'exact' })
        .order('submitted_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (bankId) {
        query = query.eq('bank_id', bankId);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.bankId) {
        query = query.eq('bank_id', filters.bankId);
      }

      if (filters?.cropType) {
        query = query.eq('crop_type', filters.cropType);
      }

      if (filters?.dateFrom) {
        query = query.gte('submitted_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('submitted_at', filters.dateTo);
      }

      if (filters?.search) {
        query = query.ilike('id', `%${filters.search.replace('UW-', '').toLowerCase()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const apps = data as UnderwritingApplication[];
      const appIds = apps.map((a) => a.id);
      let scoresMap: Record<string, number> = {};
      if (appIds.length > 0) {
        const { data: scores } = await supabase
          .from('application_scores')
          .select('application_id, overall_score')
          .in('application_id', appIds)
          .eq('is_draft', false);
        if (scores) {
          for (const s of scores) {
            scoresMap[s.application_id] = Number(s.overall_score);
          }
        }
      }

      return { applications: apps, scores: scoresMap, total: count ?? 0 };
    },
    staleTime: 30 * 1000,
  });
}

export function useUnderwritingApplication(applicationId: string) {
  return useQuery({
    queryKey: ['underwriting-application', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('underwriting_applications')
        .select('*')
        .eq('id', applicationId)
        .single();
      if (error) throw error;
      return data as UnderwritingApplication;
    },
    enabled: !!applicationId,
  });
}

export function useApplicationScores(applicationId: string) {
  return useQuery({
    queryKey: ['application-scores', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('application_scores')
        .select('*')
        .eq('application_id', applicationId)
        .order('scored_at', { ascending: false });
      if (error) throw error;
      return data as ApplicationScore[];
    },
    enabled: !!applicationId,
  });
}

export function useSubmitApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bankId,
      cropType,
      notes,
      file,
    }: {
      bankId: string;
      cropType: string;
      notes?: string;
      file?: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const appId = crypto.randomUUID();
      let shapefilePath: string | null = null;

      if (file) {
        const storagePath = generateStoragePath(appId);
        const { error: uploadError } = await supabase.storage
          .from('underwriting-files')
          .upload(storagePath, file, {
            contentType: file.type || 'application/zip',
            upsert: false,
          });
        if (uploadError) throw uploadError;
        shapefilePath = storagePath;
      }

      const { data, error } = await supabase
        .from('underwriting_applications')
        .insert({
          id: appId,
          bank_id: bankId,
          submitted_by: user.id,
          crop_type: cropType,
          notes: notes || null,
          shapefile_path: shapefilePath,
        })
        .select()
        .single();

      if (error) throw error;
      return data as UnderwritingApplication;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-applications'] });

      // Fire-and-forget email notification to admins and specialists
      supabase.functions.invoke('notify-underwriting-submission', {
        body: {
          applicationId: data.id,
          bankId: data.bank_id,
          cropType: data.crop_type,
          appNumber: formatAppNumber(data.id),
        },
      }).catch((err) => {
        console.warn('Notification send failed (non-blocking):', err);
      });
    },
  });
}

export function useSubmitScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (score: ApplicationScoreInsert) => {
      // Check if a score already exists for this application
      const { data: existing } = await supabase
        .from('application_scores')
        .select('id')
        .eq('application_id', score.application_id)
        .limit(1)
        .maybeSingle();

      let data, error;
      if (existing?.id) {
        ({ data, error } = await supabase
          .from('application_scores')
          .update({ ...score, scored_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single());
      } else {
        ({ data, error } = await supabase
          .from('application_scores')
          .insert(score)
          .select()
          .single());
      }
      if (error) throw error;

      if (!score.is_draft) {
        await supabase
          .from('underwriting_applications')
          .update({ status: 'scored' as UnderwritingStatus })
          .eq('id', score.application_id);
      }

      return data as ApplicationScore;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['application-scores', variables.application_id] });
      queryClient.invalidateQueries({ queryKey: ['underwriting-applications'] });

      if (!variables.is_draft) {
        supabase.functions.invoke('notify-score-assigned', {
          body: {
            applicationId: variables.application_id,
            overallScore: variables.overall_score,
          },
        }).catch((err) => {
          console.warn('Score notification failed (non-blocking):', err);
        });
      }
    },
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      status,
    }: {
      applicationId: string;
      status: UnderwritingStatus;
    }) => {
      const { error } = await supabase
        .from('underwriting_applications')
        .update({ status })
        .eq('id', applicationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-applications'] });
    },
  });
}

// ---------- Specialist Assignment Hooks ----------

export function useAssignedSpecialists(applicationId: string) {
  return useQuery({
    queryKey: ['uw-assigned-specialists', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('underwriting_specialist_assignments')
        .select('*')
        .eq('application_id', applicationId)
        .order('assigned_at', { ascending: true });
      if (error) throw error;
      return data as SpecialistAssignment[];
    },
    enabled: !!applicationId,
  });
}

export function useAssignSpecialist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      specialistId,
      notes,
    }: {
      applicationId: string;
      specialistId: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('underwriting_specialist_assignments')
        .insert({
          application_id: applicationId,
          specialist_id: specialistId,
          assigned_by: user.id,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['uw-assigned-specialists', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['underwriting-applications'] });
    },
  });
}

export function useRemoveSpecialistAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, applicationId }: { assignmentId: string; applicationId: string }) => {
      const { error } = await supabase
        .from('underwriting_specialist_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['uw-assigned-specialists', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['underwriting-applications'] });
    },
  });
}

export function useListSpecialists(bankId?: string) {
  return useQuery({
    queryKey: ['specialists-list', bankId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_specialists', {
        p_bank_id: bankId ?? null,
      });
      if (error) throw error;
      return data as { user_id: string; email: string; bank_id: string }[];
    },
  });
}

export function useAdminApplicationsWithAssignments(
  filters?: ApplicationFilters,
  page = 0,
  pageSize = 50
) {
  return useQuery({
    queryKey: ['admin-uw-applications', filters, page],
    queryFn: async () => {
      let query = supabase
        .from('underwriting_applications')
        .select('*', { count: 'exact' })
        .order('submitted_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.bankId) {
        query = query.eq('bank_id', filters.bankId);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.cropType) {
        query = query.eq('crop_type', filters.cropType);
      }
      if (filters?.search) {
        query = query.ilike('id', `%${filters.search.replace('UW-', '').toLowerCase()}%`);
      }

      const { data: apps, error, count } = await query;
      if (error) throw error;

      const appIds = (apps || []).map((a: UnderwritingApplication) => a.id);
      let assignments: SpecialistAssignment[] = [];
      let scoresMap: Record<string, number> = {};
      if (appIds.length > 0) {
        const [assignData, scoresData] = await Promise.all([
          supabase
            .from('underwriting_specialist_assignments')
            .select('*')
            .in('application_id', appIds),
          supabase
            .from('application_scores')
            .select('application_id, overall_score')
            .in('application_id', appIds)
            .eq('is_draft', false),
        ]);
        assignments = (assignData.data || []) as SpecialistAssignment[];
        for (const s of (scoresData.data || [])) {
          scoresMap[s.application_id] = Number(s.overall_score);
        }
      }

      return {
        applications: apps as UnderwritingApplication[],
        assignments,
        scores: scoresMap,
        total: count ?? 0,
      };
    },
    staleTime: 30 * 1000,
  });
}

// ---------- Crop Type Hooks ----------

export function useActiveCropTypes() {
  return useQuery({
    queryKey: ['uw-crop-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('underwriting_crop_types')
        .select('*')
        .eq('is_active', true)
        .order('label');
      if (error) throw error;
      return data as CropType[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllCropTypes() {
  return useQuery({
    queryKey: ['uw-crop-types-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('underwriting_crop_types')
        .select('*')
        .order('label');
      if (error) throw error;
      return data as CropType[];
    },
  });
}

export function useAddCropType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ value, label }: { value: string; label: string }) => {
      const { data, error } = await supabase
        .from('underwriting_crop_types')
        .insert({ value, label, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data as CropType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uw-crop-types'] });
      queryClient.invalidateQueries({ queryKey: ['uw-crop-types-all'] });
    },
  });
}

export function useEditCropType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, label, value, is_active }: { id: string; label?: string; value?: string; is_active?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (label !== undefined) updates.label = label;
      if (value !== undefined) updates.value = value;
      if (is_active !== undefined) updates.is_active = is_active;

      const { error } = await supabase
        .from('underwriting_crop_types')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uw-crop-types'] });
      queryClient.invalidateQueries({ queryKey: ['uw-crop-types-all'] });
    },
  });
}

export function useDeleteCropType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('underwriting_crop_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uw-crop-types'] });
      queryClient.invalidateQueries({ queryKey: ['uw-crop-types-all'] });
    },
  });
}

export function useSubmitCropRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cropName, bankId }: { cropName: string; bankId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('underwriting_crop_requests')
        .insert({
          crop_name: cropName,
          requested_by: user.id,
          bank_id: bankId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CropRequest;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['uw-crop-requests'] });

      supabase.functions.invoke('notify-crop-request', {
        body: {
          cropName: data.crop_name,
          requestId: data.id,
        },
      }).catch((err) => {
        console.warn('Crop request notification failed (non-blocking):', err);
      });
    },
  });
}

export function useCropRequests(statusFilter?: string) {
  return useQuery({
    queryKey: ['uw-crop-requests', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('underwriting_crop_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CropRequest[];
    },
  });
}

export function useApproveCropRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, cropName }: { requestId: string; cropName: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const value = cropName.toLowerCase().replace(/\s+/g, '_');

      const { error: insertErr } = await supabase
        .from('underwriting_crop_types')
        .insert({ value, label: cropName, is_active: true });
      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from('underwriting_crop_requests')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uw-crop-requests'] });
      queryClient.invalidateQueries({ queryKey: ['uw-crop-types'] });
    },
  });
}

export function useRejectCropRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('underwriting_crop_requests')
        .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uw-crop-requests'] });
    },
  });
}

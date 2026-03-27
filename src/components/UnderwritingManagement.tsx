import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search, FileText, RefreshCw, Filter, UserPlus, Users,
  Sprout, Check, X, Plus, Pencil, Trash2, Eye, EyeOff,
} from "lucide-react";
import {
  useAdminApplicationsWithAssignments,
  useActiveCropTypes,
  useAllCropTypes,
  useAddCropType,
  useEditCropType,
  useDeleteCropType,
  useCropRequests,
  useApproveCropRequest,
  useRejectCropRequest,
  useDeleteApplication,
  type ApplicationFilters,
  type SpecialistAssignment,
} from "@/hooks/useUnderwriting";
import { UnderwritingAssignmentModal } from "@/components/UnderwritingAssignmentModal";
import { ScoringModal } from "@/components/ScoringModal";
import type { UnderwritingApplication, UnderwritingStatus, CropType } from "@/types/underwriting";
import { formatAppNumber, STATUS_LABELS, STATUS_COLORS, CROP_TYPES } from "@/types/underwriting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "scored", label: "Scored" },
  { value: "rejected", label: "Rejected" },
] as const;

type SubTab = 'applications' | 'crops' | 'crop-requests';

interface BankOption {
  id: string;
  name: string;
}

const VALID_TABS: SubTab[] = ['applications', 'crops', 'crop-requests'];

export const UnderwritingManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as SubTab | null;
  const subTab: SubTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'applications';

  const setSubTab = useCallback((tab: SubTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'applications') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // --- Application state ---
  const [filters, setFilters] = useState<ApplicationFilters>({
    status: "all",
    cropType: "",
    bankId: "",
    search: "",
  });
  const [page, setPage] = useState(0);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [assignApp, setAssignApp] = useState<UnderwritingApplication | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [scoringApp, setScoringApp] = useState<UnderwritingApplication | null>(null);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [deleteAppConfirmOpen, setDeleteAppConfirmOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<UnderwritingApplication | null>(null);

  // --- Crop management state ---
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<CropType | null>(null);
  const [cropFormLabel, setCropFormLabel] = useState("");
  const [cropFormValue, setCropFormValue] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cropToDelete, setCropToDelete] = useState<CropType | null>(null);

  // --- Data hooks ---
  const { data, isLoading, refetch } = useAdminApplicationsWithAssignments(filters, page);
  const { data: activeCrops } = useActiveCropTypes();
  const { data: allCrops, isLoading: loadingCrops, refetch: refetchCrops } = useAllCropTypes();
  const addCropMutation = useAddCropType();
  const editCropMutation = useEditCropType();
  const deleteCropMutation = useDeleteCropType();
  const { data: cropRequests, isLoading: loadingRequests, refetch: refetchRequests } = useCropRequests('pending');
  const approveMutation = useApproveCropRequest();
  const rejectMutation = useRejectCropRequest();
  const deleteApplicationMutation = useDeleteApplication();

  const cropOptions = useMemo(
    () => activeCrops && activeCrops.length > 0
      ? activeCrops.map((c) => ({ value: c.value, label: c.label }))
      : [...CROP_TYPES],
    [activeCrops]
  );

  const applications = data?.applications ?? [];
  const assignments = data?.assignments ?? [];
  const scoresMap = data?.scores ?? {};
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);
  const pendingRequestCount = cropRequests?.length ?? 0;

  useEffect(() => {
    const loadBanks = async () => {
      const { data } = await supabase.from('banks').select('id, name').order('name');
      if (data) setBanks(data);
    };
    loadBanks();
  }, []);

  // --- Application handlers ---
  const getAssignmentCount = useCallback(
    (appId: string) => assignments.filter((a: SpecialistAssignment) => a.application_id === appId).length,
    [assignments]
  );

  const handleAssign = useCallback((app: UnderwritingApplication, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignApp(app);
    setAssignOpen(true);
  }, []);

  const handleRowClick = useCallback((app: UnderwritingApplication) => {
    setScoringApp(app);
    setScoringOpen(true);
  }, []);

  const handleDeleteApp = async () => {
    if (!appToDelete) return;
    try {
      await deleteApplicationMutation.mutateAsync(appToDelete.id);
      toast({ title: "Application Deleted", description: `${formatAppNumber(appToDelete.id)} has been deleted.` });
    } catch (error: unknown) {
      toast({ title: "Delete Failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
    setDeleteAppConfirmOpen(false);
    setAppToDelete(null);
  };

  const getBankName = useCallback(
    (bankId: string) => banks.find((b) => b.id === bankId)?.name ?? bankId.slice(0, 8),
    [banks]
  );

  const getCropLabel = useCallback(
    (value: string) => cropOptions.find((c) => c.value === value)?.label || value,
    [cropOptions]
  );

  // --- Crop CRUD handlers ---
  const openAddCrop = () => {
    setEditingCrop(null);
    setCropFormLabel("");
    setCropFormValue("");
    setCropDialogOpen(true);
  };

  const openEditCrop = (crop: CropType) => {
    setEditingCrop(crop);
    setCropFormLabel(crop.label);
    setCropFormValue(crop.value);
    setCropDialogOpen(true);
  };

  const handleCropSubmit = async () => {
    const label = cropFormLabel.trim();
    if (!label) return;
    const value = cropFormValue.trim() || label.toLowerCase().replace(/\s+/g, '_');

    try {
      if (editingCrop) {
        await editCropMutation.mutateAsync({ id: editingCrop.id, label, value });
        toast({ title: "Crop Updated", description: `"${label}" has been updated.` });
      } else {
        await addCropMutation.mutateAsync({ value, label });
        toast({ title: "Crop Added", description: `"${label}" is now available for applications.` });
      }
      setCropDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (crop: CropType) => {
    try {
      await editCropMutation.mutateAsync({ id: crop.id, is_active: !crop.is_active });
      toast({
        title: crop.is_active ? "Crop Deactivated" : "Crop Activated",
        description: `"${crop.label}" is now ${crop.is_active ? "hidden from" : "visible in"} the crop list.`,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteCrop = async () => {
    if (!cropToDelete) return;
    try {
      await deleteCropMutation.mutateAsync({ id: cropToDelete.id });
      toast({ title: "Crop Deleted", description: `"${cropToDelete.label}" has been removed.` });
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
    setDeleteConfirmOpen(false);
    setCropToDelete(null);
  };

  // --- Crop request handlers ---
  const handleApprove = async (requestId: string, cropName: string) => {
    try {
      await approveMutation.mutateAsync({ requestId, cropName });
      toast({ title: "Crop Approved", description: `"${cropName}" is now available for underwriting applications.` });
      refetchCrops();
    } catch (error: any) {
      toast({ title: "Approval Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectMutation.mutateAsync({ requestId });
      toast({ title: "Request Rejected", description: "The crop request has been rejected." });
    } catch (error: any) {
      toast({ title: "Rejection Failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Underwriting</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage applications, crop types, and specialist assignments
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setSubTab('applications')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'applications'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Applications
        </button>
        <button
          onClick={() => setSubTab('crops')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'crops'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Crops
        </button>
        <button
          onClick={() => setSubTab('crop-requests')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            subTab === 'crop-requests'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Requests
          {pendingRequestCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">
              {pendingRequestCount}
            </Badge>
          )}
        </button>
      </div>

      {/* ==================== APPLICATIONS TAB ==================== */}
      {subTab === 'applications' && (
        <>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by application number..."
                    value={filters.search ?? ""}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, search: e.target.value }));
                      setPage(0);
                    }}
                    className="pl-9 bg-background"
                  />
                </div>

                <Select
                  value={filters.status ?? "all"}
                  onValueChange={(v) => {
                    setFilters((f) => ({ ...f, status: v as UnderwritingStatus | "all" }));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[160px] bg-background">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.bankId || "all"}
                  onValueChange={(v) => {
                    setFilters((f) => ({ ...f, bankId: v === "all" ? "" : v }));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="All Banks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Banks</SelectItem>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.cropType || "all"}
                  onValueChange={(v) => {
                    setFilters((f) => ({ ...f, cropType: v === "all" ? "" : v }));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[160px] bg-background">
                    <SelectValue placeholder="Crop Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Crops</SelectItem>
                    {cropOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetch()}
                  className="hover:bg-muted dark:hover:bg-muted/80"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} application{total !== 1 ? "s" : ""} found
            </p>
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
            )}
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-semibold">App Number</TableHead>
                    <TableHead className="font-semibold">Bank</TableHead>
                    <TableHead className="font-semibold">Crop</TableHead>
                    <TableHead className="font-semibold">Farm Status</TableHead>
                    <TableHead className="font-semibold">Score</TableHead>
                    <TableHead className="font-semibold">Submitted</TableHead>
                    <TableHead className="font-semibold">Specialists</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : applications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground font-medium">No underwriting applications found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {filters.status !== "all" || filters.search || filters.bankId
                            ? "Try adjusting your filters"
                            : "Applications will appear here once bank users submit them"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    applications.map((app) => {
                      const cropLabel = getCropLabel(app.crop_type);
                      const assignCount = getAssignmentCount(app.id);
                      const score = scoresMap[app.id];
                      const hasScore = score !== undefined;
                      return (
                        <TableRow
                          key={app.id}
                          className="cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors"
                          onClick={() => handleRowClick(app)}
                          tabIndex={0}
                          role="button"
                        >
                          <TableCell className="font-mono font-medium text-foreground">
                            {formatAppNumber(app.id)}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {getBankName(app.bank_id)}
                          </TableCell>
                          <TableCell className="text-foreground">{cropLabel}</TableCell>
                          <TableCell className="text-foreground">{app.farm_status}</TableCell>
                          <TableCell>
                            {hasScore ? (
                              <span className={`font-bold tabular-nums ${
                                score >= 7 ? 'text-green-600 dark:text-green-400'
                                  : score >= 4 ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {score}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(app.submitted_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {assignCount > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <Users className="h-3 w-3" />
                                {assignCount}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleAssign(app, e)}
                                className="hover:bg-muted dark:hover:bg-muted/80"
                              >
                                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                Assign
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAppToDelete(app);
                                  setDeleteAppConfirmOpen(true);
                                }}
                                className="h-8 w-8 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Delete application"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="hover:bg-muted dark:hover:bg-muted/80"
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNum = page < 3 ? i : page - 2 + i;
                if (pageNum >= totalPages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className={
                      pageNum === page
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted dark:hover:bg-muted/80"
                    }
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="hover:bg-muted dark:hover:bg-muted/80"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* ==================== CROPS TAB ==================== */}
      {subTab === 'crops' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {allCrops?.length ?? 0} crop type{(allCrops?.length ?? 0) !== 1 ? "s" : ""} configured
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetchCrops()}
                className="hover:bg-muted dark:hover:bg-muted/80"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={openAddCrop}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Crop
              </Button>
            </div>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-semibold">Label</TableHead>
                    <TableHead className="font-semibold">Value</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Added</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCrops ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      </TableRow>
                    ))
                  ) : !allCrops || allCrops.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <Sprout className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground font-medium">No crop types configured</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add your first crop type to get started
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    allCrops.map((crop) => (
                      <TableRow key={crop.id} className={!crop.is_active ? "opacity-60" : ""}>
                        <TableCell className="font-medium text-foreground">
                          {crop.label}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {crop.value}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            crop.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400'
                          }>
                            {crop.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(crop.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(crop)}
                              title={crop.is_active ? "Deactivate" : "Activate"}
                              className="h-8 w-8 hover:bg-muted dark:hover:bg-muted/80"
                            >
                              {crop.is_active
                                ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                : <Eye className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              }
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditCrop(crop)}
                              title="Edit"
                              className="h-8 w-8 hover:bg-muted dark:hover:bg-muted/80"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCropToDelete(crop);
                                setDeleteConfirmOpen(true);
                              }}
                              title="Delete"
                              className="h-8 w-8 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== CROP REQUESTS TAB ==================== */}
      {subTab === 'crop-requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pendingRequestCount} pending request{pendingRequestCount !== 1 ? "s" : ""}
            </p>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchRequests()}
              className="hover:bg-muted dark:hover:bg-muted/80"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-semibold">Crop Name</TableHead>
                    <TableHead className="font-semibold">Requested</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRequests ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      </TableRow>
                    ))
                  ) : !cropRequests || cropRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <Sprout className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground font-medium">No pending crop requests</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Requests from underwriters will appear here for review
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cropRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium text-foreground">
                          {req.crop_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            req.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : req.status === 'approved'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(req.id, req.crop_name)}
                                disabled={approveMutation.isPending}
                                className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(req.id)}
                                disabled={rejectMutation.isPending}
                                className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Add/Edit Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCrop ? "Edit Crop" : "Add Crop"}</DialogTitle>
            <DialogDescription>
              {editingCrop
                ? "Update the crop type details."
                : "Add a new crop type that will be available for underwriting applications."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Crop Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Sunflower"
                value={cropFormLabel}
                onChange={(e) => {
                  setCropFormLabel(e.target.value);
                  if (!editingCrop) {
                    setCropFormValue(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                  }
                }}
                className="bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                System Value
              </label>
              <Input
                placeholder="e.g. sunflower"
                value={cropFormValue}
                onChange={(e) => setCropFormValue(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                className="bg-background font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase identifier used internally. Auto-generated from name.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCropDialogOpen(false)}
                className="hover:bg-muted dark:hover:bg-muted/80"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCropSubmit}
                disabled={!cropFormLabel.trim() || addCropMutation.isPending || editCropMutation.isPending}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white"
              >
                {(addCropMutation.isPending || editCropMutation.isPending) ? "Saving..." : editingCrop ? "Update" : "Add Crop"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Crop Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{cropToDelete?.label}"</strong>? This will permanently remove it.
              Existing applications using this crop type will retain their value but it won't appear in the dropdown.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCrop}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Application Confirmation */}
      <AlertDialog open={deleteAppConfirmOpen} onOpenChange={setDeleteAppConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{appToDelete ? formatAppNumber(appToDelete.id) : ""}</strong>? This will permanently remove the application and all associated scores and assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteApp}
              disabled={deleteApplicationMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteApplicationMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assignment Modal */}
      <UnderwritingAssignmentModal
        application={assignApp}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />

      {/* Scoring / Detail Modal */}
      <ScoringModal
        application={scoringApp}
        open={scoringOpen}
        onOpenChange={setScoringOpen}
      />
    </div>
  );
};

import { useState, useMemo, useCallback } from "react";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { UnderwritingLayout } from "@/components/UnderwritingLayout";
import { ScoringModal } from "@/components/ScoringModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { Search, FileText, ChevronDown, Filter, RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import { useUnderwritingApplications, useActiveCropTypes } from "@/hooks/useUnderwriting";
import type { UnderwritingApplication, UnderwritingStatus } from "@/types/underwriting";
import {
  formatAppNumber,
  CROP_TYPES,
  getScoringCountdown,
} from "@/types/underwriting";

export const UnderwritingApplications = () => {
  const { profile } = useAuth();
  const userProfile = profile as UserProfile | null;

  const [filters, setFilters] = useState({
    cropType: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [page, setPage] = useState(0);
  const [selectedApp, setSelectedApp] = useState<UnderwritingApplication | null>(null);
  const [scoringOpen, setScoringOpen] = useState(false);

  const bankId = userProfile?.role === "admin" ? undefined : userProfile?.bank_id;

  const { data, isLoading, refetch } = useUnderwritingApplications(bankId, filters, page);
  const { data: dbCrops } = useActiveCropTypes();

  const cropOptions = dbCrops && dbCrops.length > 0
    ? dbCrops.map((c) => ({ value: c.value, label: c.label }))
    : [...CROP_TYPES];

  const applications = data?.applications ?? [];
  const scoresMap = data?.scores ?? {};
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  const handleRowClick = useCallback((app: UnderwritingApplication) => {
    setSelectedApp(app);
    setScoringOpen(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, app: UnderwritingApplication) => {
      if (e.key === "Enter") {
        handleRowClick(app);
      }
    },
    [handleRowClick]
  );

  return (
    <UnderwritingLayout title="Applications">
      <div className="space-y-4">
        {/* Filters */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by application number..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, search: e.target.value }));
                    setPage(0);
                  }}
                  className="pl-9 bg-background"
                />
              </div>

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

        {/* Results Summary */}
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

        {/* Table */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="font-semibold">App Number</TableHead>
                  <TableHead className="font-semibold">Crop</TableHead>
                  <TableHead className="font-semibold">Score</TableHead>
                  <TableHead className="font-semibold">Submitted</TableHead>
                  <TableHead className="font-semibold">File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    </TableRow>
                  ))
                ) : applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground font-medium">No applications found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {filters.search || filters.cropType
                          ? "Try adjusting your filters"
                          : "Submit your first application to get started"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => {
                    const cropLabel = cropOptions.find((c) => c.value === app.crop_type)?.label || app.crop_type;
                    const score = scoresMap[app.id];
                    const hasScore = score !== undefined;
                    const countdown = getScoringCountdown(app.submitted_at, hasScore);
                    const fileExt = app.shapefile_path?.split('.').pop()?.toLowerCase();
                    return (
                      <TableRow
                        key={app.id}
                        className="cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors"
                        onClick={() => handleRowClick(app)}
                        onKeyDown={(e) => handleKeyDown(e, app)}
                        tabIndex={0}
                        role="button"
                      >
                        <TableCell className="font-mono font-medium text-foreground">
                          {formatAppNumber(app.id)}
                        </TableCell>
                        <TableCell className="text-foreground">{cropLabel}</TableCell>
                        <TableCell>
                          {hasScore ? (
                            <span className={`font-bold tabular-nums ${
                              score >= 7 ? 'text-green-600 dark:text-green-400'
                                : score >= 4 ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {score}
                            </span>
                          ) : countdown.isOverdue ? (
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              Pending
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {countdown.label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(app.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {app.shapefile_path ? (
                            <Badge variant="outline" className="text-xs">
                              .{fileExt || 'zip'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Pagination */}
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
      </div>

      {/* Scoring Modal */}
      <ScoringModal
        application={selectedApp}
        open={scoringOpen}
        onOpenChange={setScoringOpen}
      />
    </UnderwritingLayout>
  );
};

export default UnderwritingApplications;

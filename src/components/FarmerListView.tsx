import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FarmersTable } from "./FarmersTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Wheat } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FarmerListViewProps {
  filters: {
    search: string;
    fromDate: string;
    toDate: string;
    bankId: string;
  };
  isAdmin: boolean;
  onAddFarmer?: () => void;
  onEditFarmer?: (farmerId: string) => void;
  onDeleteFarmer?: (farmerId: string) => void;
}

export const FarmerListView = ({ 
  filters, 
  isAdmin, 
  onAddFarmer,
  onEditFarmer,
  onDeleteFarmer 
}: FarmerListViewProps) => {
  // Fetch farmers with analytics data
  const { data: farmers = [], isLoading, error } = useQuery({
    queryKey: ['farmers-cards', filters],
    queryFn: async () => {
      let query = supabase
        .from('farmers')
        .select(`
          id,
          name,
          farmer_location,
          crop,
          area,
          registration_date,
          bank_id
        `);

      // Apply bank filter for bank users
      if (filters.bankId) {
        query = query.eq('bank_id', filters.bankId);
      }

      // Apply search filter
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,id_number.ilike.%${filters.search}%,crop.ilike.%${filters.search}%`);
      }

      // Apply date filters
      if (filters.fromDate) {
        query = query.gte('registration_date', filters.fromDate);
      }
      if (filters.toDate) {
        query = query.lte('registration_date', filters.toDate);
      }

      const { data: farmersData, error: farmersError } = await query;
      
      if (farmersError) throw farmersError;

      // Fetch additional analytics data for each farmer
      const enrichedFarmers = await Promise.all(
        (farmersData || []).map(async (farmer) => {
          // Get bank info (name and logo)
          const { data: bankData } = await supabase
            .from('banks')
            .select('name, logo_url')
            .eq('id', farmer.bank_id)
            .single();

          // Get loan data
          const { data: loans } = await supabase
            .from('farmer_loans')
            .select('amount, currency, start_date, end_date')
            .eq('farmer_id', farmer.id)
            .order('issuance_date', { ascending: false })
            .limit(1);

          // Get chart count for this specific farmer
          const { count: chartCount } = await supabase
            .from('chart_templates' as any)
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('farmer_id', farmer.id);

          // Get orchard map count
          const { count: mapCount } = await supabase
            .from('farmer_orchard_maps')
            .select('*', { count: 'exact', head: true })
            .eq('farmer_id', farmer.id)
            .eq('is_active', true);

          // Get One-pager summaries by phase
          const { data: phasesData } = await supabase
            .from('farmer_phases')
            .select('phase_number, one_pager_summary')
            .eq('farmer_id', farmer.id);
          
          const onePagerSummaries: Record<number, boolean> = {};
          if (phasesData) {
            phasesData.forEach((phase) => {
              onePagerSummaries[phase.phase_number] = !!(phase.one_pager_summary && phase.one_pager_summary.trim().length > 0);
            });
          }

          // Determine loan status
          let loanStatus: 'active' | 'pending' | 'defaulted' | undefined;
          if (loans && loans.length > 0) {
            const loan = loans[0];
            const today = new Date();
            const startDate = new Date(loan.start_date);
            const endDate = new Date(loan.end_date);
            
            if (today >= startDate && today <= endDate) {
              loanStatus = 'active';
            } else if (today < startDate) {
              loanStatus = 'pending';
            } else {
              loanStatus = 'defaulted';
            }
          }

          return {
            farmer_id: farmer.id,
            farmer_name: farmer.name,
            farmer_location: farmer.farmer_location,
            crop: farmer.crop,
            area: farmer.area,
            loan_amount: loans && loans.length > 0 ? loans[0].amount : undefined,
            loan_status: loanStatus,
            registration_date: farmer.registration_date,
            chart_count: chartCount || 0,
            map_count: mapCount || 0,
            bank_name: bankData?.name,
            bank_logo: bankData?.logo_url,
            onePagerSummaries: onePagerSummaries,
          };
        })
      );

      return enrichedFarmers;
    },
  });

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600 dark:text-red-400">
            Error loading farmers: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-2xl font-bold text-heading-primary">
              Farmers ({farmers.length})
            </CardTitle>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Add farmer button */}
              {isAdmin && onAddFarmer && (
                <Button 
                  onClick={() => onAddFarmer()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  type="button"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Farmer
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Farmers list */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : farmers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Wheat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No farmers found
              </h3>
              <p className="text-muted-foreground mb-4">
                {filters.search ? 'Try adjusting your search filters.' : 'Get started by adding your first farmer.'}
              </p>
              {isAdmin && onAddFarmer && (
                <Button onClick={onAddFarmer} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Farmer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <FarmersTable
          filters={filters}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};


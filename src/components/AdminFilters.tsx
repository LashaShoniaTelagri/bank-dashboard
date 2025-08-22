import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Bank {
  id: string;
  name: string;
}

interface AdminFiltersProps {
  filters: {
    search: string;
    bankId: string;
    fromDate: string;
    toDate: string;
  };
  onFiltersChange: (filters: AdminFiltersProps['filters']) => void;
}

export const AdminFilters = ({ filters, onFiltersChange }: AdminFiltersProps) => {
  const [banks, setBanks] = useState<Bank[]>([]);

  useEffect(() => {
    const fetchBanks = async () => {
      const { data } = await supabase.from('banks').select('id, name').order('name');
      setBanks(data || []);
    };
    fetchBanks();
  }, []);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? '' : value, // Convert "all" back to empty string for filtering logic
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Bank</label>
            <Select 
              value={filters.bankId === '' ? 'all' : filters.bankId} 
              onValueChange={(value) => updateFilter('bankId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Banks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Banks</SelectItem>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Search Name/ID</label>
            <Input
              placeholder="Search farmers..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">From Date</label>
            <Input
              type="date"
              value={filters.fromDate}
              onChange={(e) => updateFilter('fromDate', e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">To Date</label>
            <Input
              type="date"
              value={filters.toDate}
              onChange={(e) => updateFilter('toDate', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
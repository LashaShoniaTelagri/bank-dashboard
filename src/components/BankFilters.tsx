import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface BankFiltersProps {
  filters: {
    search: string;
    fromDate: string;
    toDate: string;
  };
  onFiltersChange: (filters: BankFiltersProps['filters']) => void;
}

export const BankFilters = ({ filters, onFiltersChange }: BankFiltersProps) => {
  const updateFilter = (key: keyof typeof filters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
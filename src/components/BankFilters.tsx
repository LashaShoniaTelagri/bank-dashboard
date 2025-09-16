import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";

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
            <label className="text-sm font-medium mb-2 block">Search Name/Identification Code</label>
            <Input
              placeholder="Search farmers..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">From Date</label>
            <DatePicker
              value={filters.fromDate}
              onChange={(date) => updateFilter('fromDate', date)}
              placeholder="Select start date"
              maxDate={filters.toDate ? new Date(filters.toDate) : undefined}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">To Date</label>
            <DatePicker
              value={filters.toDate}
              onChange={(date) => updateFilter('toDate', date)}
              placeholder="Select end date"
              minDate={filters.fromDate ? new Date(filters.fromDate) : undefined}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
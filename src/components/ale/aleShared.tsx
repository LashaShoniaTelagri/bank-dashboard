import { Badge } from "../ui/badge";
import { TableHead } from "../ui/table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// Flash highlight applied to a row right after it is edited/inserted.
// Cleared by the parent ~1.5s later. transition-all on the base class so
// the bg/ring transitions back to nothing when the flash is removed.
export const FLASH_CLS = "bg-yellow-200 dark:bg-yellow-500/40 ring-2 ring-yellow-500 transition-all duration-700";
export const NO_FLASH_CLS = "transition-all duration-700";

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Crop core metadata. Mirrors specs/modules/ale.md § ale_crops.
export type Crop = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  hemisphere: string;
  is_active: boolean;
  chill_biofix_month: number;
  chill_biofix_day: number;
  insufficient_chill_penalty: number;
  insufficient_chill_cutoff_month: number | null;
  insufficient_chill_cutoff_day: number | null;
};

export const monthDay = (month: number | null, day: number | null) => {
  if (month == null || day == null) return "—";
  const m = MONTH_LABELS[month - 1] ?? `month ${month}`;
  return `${m} ${day}`;
};

export const fmt = (n: number | null | undefined, decimals = 2) =>
  n == null ? "—" : Number(n).toFixed(decimals).replace(/\.?0+$/, "");

export const SortableHead = <K extends string>({
  column, label, sortKey, sortDir, onSort, align,
}: {
  column: K;
  label: string;
  sortKey: K | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: K) => void;
  align?: 'right';
}) => {
  const isActive = sortKey === column;
  const Indicator = isActive
    ? (sortDir === 'asc' ? ChevronUp : ChevronDown)
    : ChevronsUpDown;
  return (
    <TableHead
      onClick={() => onSort(column)}
      className={`cursor-pointer select-none hover:text-emerald-500 transition-colors ${align === 'right' ? 'text-right' : ''}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <Indicator className={`h-3 w-3 ${isActive ? 'opacity-100' : 'opacity-30'}`} />
      </span>
    </TableHead>
  );
};

export const SectionShell = ({
  icon: Icon, title, count, action, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-heading-primary">
        <Icon className="h-4 w-4" />
        {title}
        {count !== undefined && <Badge variant="outline" className="text-[10px]">{count}</Badge>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

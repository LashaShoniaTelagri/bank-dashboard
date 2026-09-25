import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { fmt } from "./aleShared";

// Schema-agnostic result renderer. Frost-risk has a bespoke ResultView; every
// other algorithm (heat-stress, insufficient-chill, future ones) renders its R
// output through here until (if ever) it earns a tailored view. The shape is
// driven entirely by the data: top-level keys become sections, and each value
// renders as a key/value grid (object), a table (array of objects), a badge row
// (array of scalars), or a scalar. The manifest is optional — only used for a
// nicer heading.

interface Manifest { title?: string }

export const GenericResultView = ({ algorithm, data, manifest }: {
  algorithm: string;
  data: unknown;
  manifest?: Manifest | null;
}) => {
  if (data == null || typeof data !== "object") return <Scalar value={data} />;
  const obj = data as Record<string, unknown>;
  if (typeof obj.error === "string") {
    return <p className="text-sm text-red-600 dark:text-red-400">Error: {obj.error}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-heading-primary">{manifest?.title ?? humanize(algorithm)}</span>
        <Badge variant="outline" className="text-[10px]">R result</Badge>
      </div>
      {Object.entries(obj).map(([key, value]) => (
        <Section key={key} title={humanize(key)}>
          <ValueView value={value} />
        </Section>
      ))}
    </div>
  );
};

const ValueView = ({ value }: { value: unknown }) => {
  if (!isComplex(value)) return <Scalar value={value} />;
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="text-xs text-body-secondary">—</p>;
    const allObjects = value.every((v) => isComplex(v) && !Array.isArray(v));
    return allObjects
      ? <ObjectTable rows={value as Record<string, unknown>[]} />
      : (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => <Badge key={i} variant="secondary" className="text-[10px]">{renderScalar(v)}</Badge>)}
        </div>
      );
  }
  return <KVGrid obj={value as Record<string, unknown>} />;
};

const ObjectTable = ({ rows }: { rows: Record<string, unknown>[] }) => {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return (
    <Table>
      <TableHeader>
        <TableRow>{cols.map((c) => <TableHead key={c}>{humanize(c)}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {cols.map((c) => <TableCell key={c} className="font-mono text-xs">{renderScalar(row[c])}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const KVGrid = ({ obj }: { obj: Record<string, unknown> }) => {
  const entries = Object.entries(obj);
  const scalars = entries.filter(([, v]) => !isComplex(v));
  const nested = entries.filter(([, v]) => isComplex(v));
  return (
    <div className="space-y-2">
      {scalars.length > 0 && (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {scalars.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2 rounded border border-border/50 bg-background px-2 py-1">
              <span className="text-[10px] uppercase tracking-wider text-body-secondary">{humanize(k)}</span>
              <span className="font-mono text-xs">{renderScalar(v)}</span>
            </div>
          ))}
        </div>
      )}
      {nested.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-body-secondary">{humanize(k)}</span>
          <ValueView value={v} />
        </div>
      ))}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-body-secondary">{title}</h4>
    {children}
  </section>
);

const Scalar = ({ value }: { value: unknown }) => <span className="font-mono text-sm">{renderScalar(value)}</span>;

const isComplex = (v: unknown): boolean => v != null && typeof v === "object";

const renderScalar = (v: unknown): string => {
  if (v == null) return "—";
  if (typeof v === "number") return fmt(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const humanize = (k: string) => k.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

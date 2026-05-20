import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useState } from 'react';

type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  created_at: string;
};

export const AuditLogTable: React.FC = () => {
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['audit-log', tableFilter],
    queryFn: async (): Promise<AuditLog[]> => {
      let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500);
      if (tableFilter) query = query.eq('table_name', tableFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as AuditLog[]) || [];
    }
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      row.action.toLowerCase().includes(q) ||
      row.table_name.toLowerCase().includes(q) ||
      (row.old_values && JSON.stringify(row.old_values).toLowerCase().includes(q)) ||
      (row.record_id && row.record_id.toLowerCase().includes(q))
    );
  }, [data, search]);

  return (
    <Card className="dark:bg-dark-card dark:border-dark-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Audit Log</span>
          <div className="flex items-center gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Search</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, table, values" className="h-8 w-64" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Table</Label>
              <Input value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} placeholder="e.g. specialist_assignments" className="h-8 w-64" />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading audit log...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Timestamp</TableHead>
                <TableHead className="w-32">Action</TableHead>
                <TableHead className="w-64">Table</TableHead>
                <TableHead className="w-80">Record</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm text-muted-foreground">{new Date(row.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm font-medium">{row.action}</TableCell>
                  <TableCell className="text-sm">{row.table_name}</TableCell>
                  <TableCell className="text-xs break-all">{row.record_id || '-'}</TableCell>
                  <TableCell className="text-xs whitespace-pre-wrap break-words">
                    {row.old_values ? JSON.stringify(row.old_values, null, 2) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};



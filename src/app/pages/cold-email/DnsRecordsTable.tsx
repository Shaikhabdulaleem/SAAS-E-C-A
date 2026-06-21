import { Copy } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

export interface DnsRecordRow {
  key: string;
  label: string;
  type: string;
  host: string;
  value: string;
  priority?: number | null;
  status: string;
  required: boolean;
  instructions: string;
}

function statusClass(status: string) {
  if (status === 'verified') return 'bg-emerald-50 text-emerald-700';
  if (status === 'error') return 'bg-red-50 text-red-700';
  return 'bg-muted text-muted-foreground';
}

function statusLabel(status: string) {
  if (status === 'verified') return 'Verified';
  if (status === 'error') return 'Error';
  return 'Not Set';
}

function copy(value: string) {
  if (!value) return;
  void navigator.clipboard.writeText(value);
}

export function DnsRecordsTable({ records }: { records: DnsRecordRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Record</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-left font-medium">Host</th>
            <th className="px-3 py-2 text-left font-medium">Value</th>
            <th className="px-3 py-2 text-left font-medium">Priority</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map(record => (
            <tr key={record.key} className="border-t border-border align-top">
              <td className="px-3 py-2">
                <p className="font-medium text-foreground">{record.label}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{record.instructions}</p>
              </td>
              <td className="px-3 py-2 font-mono text-foreground">{record.type}</td>
              <td className="px-3 py-2">
                {record.host ? (
                  <div className="flex items-center gap-1.5">
                    <code className="max-w-[220px] truncate rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">{record.host}</code>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copy(record.host)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Paste DKIM host</span>
                )}
              </td>
              <td className="px-3 py-2">
                {record.value ? (
                  <div className="flex items-center gap-1.5">
                    <code className="max-w-[340px] truncate rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">{record.value}</code>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copy(record.value)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Paste DKIM value from provider</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{record.priority ?? '-'}</td>
              <td className="px-3 py-2">
                <Badge variant="secondary" className={`text-[10px] h-5 ${statusClass(record.status)}`}>
                  {statusLabel(record.status)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

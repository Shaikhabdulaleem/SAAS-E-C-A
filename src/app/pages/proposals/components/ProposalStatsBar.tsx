import { Card, CardContent } from '../../../components/ui/card';

interface StatsBarProps {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  accepted: number;
  rejected: number;
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold ${color ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function ProposalStatsBar({ total, draft, sent, viewed, accepted, rejected }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Stat label="Total" value={total} />
      <Stat label="Draft" value={draft} color="text-gray-600" />
      <Stat label="Sent" value={sent} color="text-blue-600" />
      <Stat label="Viewed" value={viewed} color="text-amber-600" />
      <Stat label="Won" value={accepted} color="text-emerald-600" />
      <Stat label="Lost" value={rejected} color="text-red-600" />
    </div>
  );
}

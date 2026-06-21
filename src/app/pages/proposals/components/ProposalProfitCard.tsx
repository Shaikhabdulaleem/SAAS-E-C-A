import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

interface ProfitCardProps {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
}

export function ProposalProfitCard({ totalRevenue, totalCost, totalProfit, avgMargin }: ProfitCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Profit Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Revenue</span>
          <span className="font-semibold">${totalRevenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Cost (MCC)</span>
          <span className="font-semibold">${totalCost.toLocaleString()}</span>
        </div>
        <div className="border-t pt-2 flex justify-between text-sm">
          <span className="font-medium">Net Profit</span>
          <span className={`font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${totalProfit.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avg Margin</span>
          <span className={`font-semibold ${avgMargin >= 20 ? 'text-emerald-600' : avgMargin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
            {avgMargin}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

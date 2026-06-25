import { useState } from 'react';
import { Settings2, Palette, DollarSign, GitBranch } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { BrandSettings } from '../settings/BrandSettings';
import { ServicePricing } from '../settings/ServicePricing';
import { PipelineStages } from './PipelineStages';

export function CrmSettings() {
  const [tab, setTab] = useState('brand');

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10"><Settings2 className="h-4 w-4 text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold">CRM Settings</h1>
            <p className="text-sm text-muted-foreground">Configure branding, pricing, and pipeline stages.</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="brand" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Service Pricing
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            Pipeline Stages
          </TabsTrigger>
        </TabsList>
        <TabsContent value="brand" className="mt-4">
          <BrandSettings hideHeader />
        </TabsContent>
        <TabsContent value="pricing" className="mt-4">
          <ServicePricing hideHeader />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineStages />
        </TabsContent>
      </Tabs>
    </div>
  );
}

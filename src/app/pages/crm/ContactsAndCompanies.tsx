import { useState } from 'react';
import { Users, Building2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Contacts } from './Contacts';
import { Companies } from './Companies';

export function ContactsAndCompanies() {
  const [tab, setTab] = useState('people');

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage people and companies in your CRM</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="people" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            People
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Companies
          </TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="mt-4">
          <ContactsInner />
        </TabsContent>
        <TabsContent value="companies" className="mt-4">
          <CompaniesInner />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContactsInner() {
  return <Contacts hideHeader />;
}

function CompaniesInner() {
  return <Companies hideHeader />;
}

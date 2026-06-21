import { useParams, Link } from 'react-router';
import { useData } from '../../contexts/DataContext';
import { ArrowLeft, Globe, Phone, Users, Building2, Edit } from 'lucide-react';

export function CompanyDetail() {
  const { id } = useParams();
  const { companies, contacts, deals, activities, addContact, addDeal, addActivity, updateCompany } = useData();
  
  const company = companies.find(c => c.id === id);
  const companyContacts = contacts.filter(c => c.companyId === id);
  const companyDeals = deals.filter(d => d.companyId === id);
  const companyActivities = activities.filter(a => a.companyId === id);

  if (!company) {
    return <div>Company not found</div>;
  }

  const totalDealValue = companyDeals.reduce((sum, deal) => sum + deal.value, 0);
  const openDeals = companyDeals.filter(d => d.status === 'open');
  const wonDeals = companyDeals.filter(d => d.status === 'won');

  const sizeLabels = {
    '1-10': '1-10 employees',
    '11-50': '11-50 employees',
    '51-200': '51-200 employees',
    '201-1000': '201-1000 employees',
    '1000+': '1000+ employees',
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link to="/companies" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                  {company.name[0]}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{company.name}</h1>
                  {company.industry && (
                    <p className="text-gray-600">{company.industry}</p>
                  )}
                </div>
              </div>
              <button onClick={() => updateCompany(company.id, { tags: company.tags.includes('reviewed') ? company.tags : [...company.tags, 'reviewed'] })} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Edit className="h-4 w-4" />
                Mark Reviewed
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Company Information</h3>
                  <div className="space-y-3">
                    {company.website && (
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Website</p>
                          <a 
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {company.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      </div>
                    )}
                    {company.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <a href={`tel:${company.phone}`} className="text-blue-600 hover:underline">
                            {company.phone}
                          </a>
                        </div>
                      </div>
                    )}
                    {company.size && (
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Company Size</p>
                          <p className="text-gray-900">{sizeLabels[company.size]}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Details</h3>
                  <div className="space-y-3">
                    {company.domain && (
                      <div>
                        <p className="text-sm text-gray-500">Domain</p>
                        <p className="text-gray-900">{company.domain}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500">Assigned To</p>
                      <p className="text-gray-900">{company.assignedTo || 'Unassigned'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Created</p>
                      <p className="text-gray-900">{new Date(company.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {company.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {company.tags.map((tag) => (
                      <span 
                        key={tag}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Contacts ({companyContacts.length})
              </h2>
              <button onClick={() => addContact({
                firstName: 'New',
                lastName: 'Contact',
                email: `contact-${Date.now()}@${company.domain || 'example.com'}`,
                companyId: company.id,
                assignedTo: company.assignedTo,
                status: 'lead',
                source: 'manual',
                tags: [],
              })} className="text-sm text-blue-600 hover:text-blue-700">
                Add Contact
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {companyContacts.map((contact) => (
                <Link
                  key={contact.id}
                  to={`/contacts/${contact.id}`}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{contact.jobTitle || contact.email}</p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-400 capitalize">{contact.status}</span>
                </Link>
              ))}
              {companyContacts.length === 0 && (
                <p className="p-6 text-center text-gray-500">No contacts yet</p>
              )}
            </div>
          </div>

          {/* Deals */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Deals ({companyDeals.length})
              </h2>
              <button onClick={() => addDeal({
                title: `${company.name} - New Opportunity`,
                value: 0,
                currency: 'USD',
                stage: 'lead',
                companyId: company.id,
                assignedTo: company.assignedTo || '',
                status: 'open',
                probability: 10,
              })} className="text-sm text-blue-600 hover:text-blue-700">
                Create Deal
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {companyDeals.map((deal) => (
                <Link
                  key={deal.id}
                  to={`/deals/${deal.id}`}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{deal.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{deal.stage} · {deal.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${deal.value.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{deal.probability}% probability</p>
                  </div>
                </Link>
              ))}
              {companyDeals.length === 0 && (
                <p className="p-6 text-center text-gray-500">No deals yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Overview</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Total Deal Value</p>
                <p className="text-2xl font-semibold text-gray-900">${totalDealValue.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Open Deals</p>
                  <p className="text-xl font-semibold text-blue-600">{openDeals.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Won Deals</p>
                  <p className="text-xl font-semibold text-green-600">{wonDeals.length}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Contacts</p>
                <p className="text-xl font-semibold text-gray-900">{companyContacts.length}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => addContact({
                firstName: 'New',
                lastName: 'Contact',
                email: `contact-${Date.now()}@${company.domain || 'example.com'}`,
                companyId: company.id,
                assignedTo: company.assignedTo,
                status: 'lead',
                source: 'manual',
                tags: [],
              })} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Add Contact
              </button>
              <button onClick={() => addDeal({
                title: `${company.name} - New Opportunity`,
                value: 0,
                currency: 'USD',
                stage: 'lead',
                companyId: company.id,
                assignedTo: company.assignedTo || '',
                status: 'open',
                probability: 10,
              })} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Create Deal
              </button>
              <button onClick={() => addActivity({
                type: 'note',
                subject: `Logged activity for ${company.name}`,
                companyId: company.id,
                createdBy: 'Current User',
              })} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Log Activity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

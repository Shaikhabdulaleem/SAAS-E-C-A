import { useParams, Link } from 'react-router';
import { useData } from '../../contexts/DataContext';
import { ArrowLeft, Mail, Phone, Building2, Calendar, Tag, Edit } from 'lucide-react';

export function ContactDetail() {
  const { id } = useParams();
  const { contacts, companies, activities, deals, addActivity, addDeal, updateContact } = useData();
  
  const contact = contacts.find(c => c.id === id);
  const company = contact?.companyId ? companies.find(c => c.id === contact.companyId) : null;
  const contactActivities = activities.filter(a => a.contactId === id);
  const contactDeals = deals.filter(d => d.companyId === contact?.companyId);

  if (!contact) {
    return <div>Contact not found</div>;
  }

  const statusColors = {
    lead: 'bg-yellow-100 text-yellow-800',
    prospect: 'bg-blue-100 text-blue-800',
    customer: 'bg-green-100 text-green-800',
    churned: 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link to="/contacts" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-medium">
                  {contact.firstName[0]}{contact.lastName[0]}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {contact.firstName} {contact.lastName}
                  </h1>
                  <p className="text-gray-600">{contact.jobTitle || 'No title'}</p>
                </div>
              </div>
              <button onClick={() => updateContact(contact.id, { status: contact.status === 'customer' ? 'prospect' : 'customer' })} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Edit className="h-4 w-4" />
                Toggle Status
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                          {contact.email}
                        </a>
                      </div>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                    )}
                    {company && (
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Company</p>
                          <Link to={`/companies/${company.id}`} className="text-blue-600 hover:underline">
                            {company.name}
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[contact.status]}`}>
                        {contact.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Source</p>
                      <p className="text-gray-900 capitalize">{contact.source}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Assigned To</p>
                      <p className="text-gray-900">{contact.assignedTo || 'Unassigned'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Created</p>
                        <p className="text-gray-900">{new Date(contact.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {contact.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span 
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="mt-6 bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
            </div>
            <div className="p-6">
              {contactActivities.length > 0 ? (
                <div className="space-y-6">
                  {contactActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.subject}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(activity.createdAt).toLocaleString()} by {activity.createdBy}
                        </p>
                        {activity.body && (
                          <p className="text-gray-700 mt-2">{activity.body}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No activities yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Related Deals */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Related Deals</h2>
            </div>
            <div className="p-6">
              {contactDeals.length > 0 ? (
                <div className="space-y-3">
                  {contactDeals.map((deal) => (
                    <Link
                      key={deal.id}
                      to={`/deals/${deal.id}`}
                      className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <p className="font-medium text-gray-900">{deal.title}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        ${deal.value.toLocaleString()} · {deal.stage}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No related deals</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => addActivity({
                type: 'email_sent',
                subject: `Sent email to ${contact.firstName} ${contact.lastName}`,
                contactId: contact.id,
                companyId: contact.companyId,
                createdBy: 'Current User',
              })} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Send Email
              </button>
              <button onClick={() => addActivity({
                type: 'note',
                subject: `Logged activity for ${contact.firstName} ${contact.lastName}`,
                contactId: contact.id,
                companyId: contact.companyId,
                createdBy: 'Current User',
              })} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Log Activity
              </button>
              <button onClick={() => addDeal({
                title: `${contact.firstName} ${contact.lastName} - New Opportunity`,
                value: 0,
                currency: 'USD',
                stage: 'lead',
                companyId: contact.companyId,
                assignedTo: contact.assignedTo || '',
                status: 'open',
                probability: 10,
              })} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Create Deal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

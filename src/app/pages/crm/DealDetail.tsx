import { useParams, Link } from 'react-router';
import { useData } from '../../contexts/DataContext';
import { ArrowLeft, DollarSign, Calendar, TrendingUp, Edit } from 'lucide-react';

export function DealDetail() {
  const { id } = useParams();
  const { deals, companies, contacts, activities, updateDeal, addActivity } = useData();
  
  const deal = deals.find(d => d.id === id);
  const company = deal?.companyId ? companies.find(c => c.id === deal.companyId) : null;
  const companyContacts = company ? contacts.filter(c => c.companyId === company.id) : [];
  const dealActivities = activities.filter(a => a.dealId === id);

  if (!deal) {
    return <div>Deal not found</div>;
  }

  const statusColors = {
    open: 'bg-blue-100 text-blue-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
  };

  const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed'];
  const currentStageIndex = stages.indexOf(deal.stage);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link to="/deals" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Deals
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{deal.title}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[deal.status]}`}>
                    {deal.status}
                  </span>
                  <span className="text-sm text-gray-600 capitalize">{deal.stage}</span>
                </div>
              </div>
              <button onClick={() => updateDeal(deal.id, { probability: Math.min(deal.probability + 10, 100) })} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Edit className="h-4 w-4" />
                Increase Probability
              </button>
            </div>

            <div className="p-6">
              {/* Deal Value */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-4">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <span className="text-4xl font-semibold text-gray-900">
                    {deal.value.toLocaleString()}
                  </span>
                  <span className="text-gray-500">{deal.currency}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div>Probability: <span className="font-medium text-gray-900">{deal.probability}%</span></div>
                  {deal.expectedCloseDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Expected close: <span className="font-medium text-gray-900">
                        {new Date(deal.expectedCloseDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pipeline Progress */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Pipeline Stage</h3>
                <div className="flex items-center gap-2">
                  {stages.map((stage, index) => (
                    <div key={stage} className="flex-1">
                      <div className="relative">
                        <div className={`h-2 rounded-full ${
                          index <= currentStageIndex ? 'bg-blue-600' : 'bg-gray-200'
                        }`} />
                        {index < stages.length - 1 && (
                          <div className={`absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 ${
                            index < currentStageIndex ? 'bg-blue-600' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>
                      <p className={`text-xs mt-2 capitalize ${
                        index <= currentStageIndex ? 'text-blue-600 font-medium' : 'text-gray-500'
                      }`}>
                        {stage}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Deal Information</h3>
                  <div className="space-y-3">
                    {company && (
                      <div>
                        <p className="text-sm text-gray-500">Company</p>
                        <Link to={`/companies/${company.id}`} className="text-blue-600 hover:underline">
                          {company.name}
                        </Link>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500">Assigned To</p>
                      <p className="text-gray-900">{deal.assignedTo}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Created</p>
                      <p className="text-gray-900">{new Date(deal.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Financial Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Deal Value</p>
                      <p className="text-gray-900 font-medium">${deal.value.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Weighted Value</p>
                      <p className="text-gray-900 font-medium">
                        ${Math.round(deal.value * deal.probability / 100).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Currency</p>
                      <p className="text-gray-900">{deal.currency}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
            </div>
            <div className="p-6">
              {dealActivities.length > 0 ? (
                <div className="space-y-6">
                  {dealActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
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
          {/* Contacts */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Related Contacts</h2>
            </div>
            <div className="p-4">
              {companyContacts.length > 0 ? (
                <div className="space-y-3">
                  {companyContacts.map((contact) => (
                    <Link
                      key={contact.id}
                      to={`/contacts/${contact.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{contact.jobTitle}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No related contacts</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => updateDeal(deal.id, { status: 'won', stage: 'closed', probability: 100 })} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Mark as Won
              </button>
              <button onClick={() => {
                const nextStage = stages[Math.min(currentStageIndex + 1, stages.length - 1)];
                updateDeal(deal.id, { stage: nextStage });
              }} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Move Stage
              </button>
              <button onClick={() => addActivity({
                type: 'note',
                subject: `Logged activity for ${deal.title}`,
                dealId: deal.id,
                companyId: deal.companyId,
                createdBy: 'Current User',
              })} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Log Activity
              </button>
              <button onClick={() => updateDeal(deal.id, { status: 'lost' })} className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                Mark as Lost
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

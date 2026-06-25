import { useParams, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { apiRequest } from '../../lib/api';
import { ArrowLeft, Mail, Phone, Building2, Calendar, Tag, Edit, Send, Crosshair, Eye, MousePointerClick, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

interface EmailCampaignEntry {
  recipientId: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  recipientStatus: string;
}

interface ColdOutreachEntry {
  prospectId: string;
  listId: string;
  listName: string;
  validationStatus: string;
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    campaignStatus: string;
    status: string;
    lastSentAt: string | null;
    completedAt: string | null;
  }>;
}

interface EngagementData {
  emailCampaigns: EmailCampaignEntry[];
  coldOutreach: ColdOutreachEntry[];
  emailStats: { totalCampaigns: number; sent: number; opened: number; clicked: number; bounced: number };
  coldStats: { totalLists: number; totalCampaigns: number };
}

export function ContactDetail() {
  const { id } = useParams();
  const { contacts, companies, activities, deals, addActivity, addDeal, updateContact } = useData();
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [loadingEngagement, setLoadingEngagement] = useState(true);

  const contact = contacts.find(c => c.id === id);
  const company = contact?.companyId ? companies.find(c => c.id === contact.companyId) : null;
  const contactActivities = activities.filter(a => a.contactId === id);
  const contactDeals = deals.filter(d => d.companyId === contact?.companyId);

  useEffect(() => {
    if (!id) return;
    apiRequest<EngagementData>(`/contacts/${id}/engagement`)
      .then(setEngagement)
      .catch(() => setEngagement(null))
      .finally(() => setLoadingEngagement(false));
  }, [id]);

  if (!contact) {
    return <div>Contact not found</div>;
  }

  const statusColors: Record<string, string> = {
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
        <div className="lg:col-span-2 space-y-6">
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
                        <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
                      </div>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a>
                        </div>
                      </div>
                    )}
                    {company && (
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Company</p>
                          <Link to={`/companies/${company.id}`} className="text-blue-600 hover:underline">{company.name}</Link>
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[contact.status]}`}>{contact.status}</span>
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

              {(contact.interestedServices ?? []).length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Interested Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {contact.interestedServices.map((svc: string) => (
                      <span key={svc} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                        <Package className="h-3.5 w-3.5" />
                        {svc.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {contact.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        <Tag className="h-3 w-3" />{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Email Marketing Engagement */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-500" />
                Email Marketing
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEngagement ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : engagement && engagement.emailCampaigns.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 rounded-lg bg-blue-50">
                      <Send className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-blue-600">{engagement.emailStats.sent}</p>
                      <p className="text-xs text-muted-foreground">Sent</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-green-50">
                      <Eye className="h-4 w-4 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-green-600">{engagement.emailStats.opened}</p>
                      <p className="text-xs text-muted-foreground">Opened</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-violet-50">
                      <MousePointerClick className="h-4 w-4 text-violet-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-violet-600">{engagement.emailStats.clicked}</p>
                      <p className="text-xs text-muted-foreground">Clicked</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-red-600">{engagement.emailStats.bounced}</p>
                      <p className="text-xs text-muted-foreground">Bounced</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {engagement.emailCampaigns.map(c => (
                      <div key={c.recipientId} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <Link to={`/campaigns/${c.campaignId}`} className="text-sm font-medium hover:text-primary">{c.campaignName}</Link>
                            <p className="text-xs text-muted-foreground">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : 'Pending'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.openedAt && <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">Opened</Badge>}
                          {c.clickedAt && <Badge variant="secondary" className="text-xs bg-violet-50 text-violet-700">Clicked</Badge>}
                          {c.bouncedAt && <Badge variant="secondary" className="text-xs bg-red-50 text-red-700">Bounced</Badge>}
                          {!c.openedAt && !c.bouncedAt && c.sentAt && <Badge variant="secondary" className="text-xs">Delivered</Badge>}
                          {!c.sentAt && <Badge variant="outline" className="text-xs">Queued</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Not included in any email campaigns</p>
              )}
            </CardContent>
          </Card>

          {/* Cold Outreach Engagement */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-orange-500" />
                Cold Outreach
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEngagement ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : engagement && engagement.coldOutreach.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">In <strong className="text-foreground">{engagement.coldStats.totalLists}</strong> prospect list{engagement.coldStats.totalLists !== 1 ? 's' : ''}</span>
                    <span className="text-muted-foreground">Across <strong className="text-foreground">{engagement.coldStats.totalCampaigns}</strong> campaign{engagement.coldStats.totalCampaigns !== 1 ? 's' : ''}</span>
                  </div>
                  {engagement.coldOutreach.map(p => (
                    <div key={p.prospectId} className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{p.listName}</span>
                        </div>
                        <Badge variant={p.validationStatus === 'valid' ? 'secondary' : 'outline'} className="text-xs">
                          {p.validationStatus}
                        </Badge>
                      </div>
                      {p.campaigns.length > 0 && (
                        <div className="pl-6 space-y-1.5">
                          {p.campaigns.map(c => (
                            <div key={c.campaignId} className="flex items-center justify-between text-sm">
                              <Link to={`/cold-email/campaigns/${c.campaignId}`} className="text-muted-foreground hover:text-primary">{c.campaignName}</Link>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs capitalize">{c.status}</Badge>
                                {c.lastSentAt && <span className="text-xs text-muted-foreground">Last sent {new Date(c.lastSentAt).toLocaleDateString()}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Not in any cold outreach campaigns</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
            </div>
            <div className="p-6">
              {contactActivities.length > 0 ? (
                <div className="space-y-6">
                  {contactActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          activity.type.includes('auto') ? 'bg-amber-100' :
                          activity.type.includes('proposal') ? 'bg-violet-100' :
                          activity.type.includes('email') ? 'bg-indigo-100' : 'bg-blue-100'
                        }`}>
                          {activity.type.includes('auto') ? <CheckCircle className="h-5 w-5 text-amber-600" /> :
                           activity.type.includes('proposal') ? <Send className="h-5 w-5 text-violet-600" /> :
                           activity.type.includes('email') ? <Mail className="h-5 w-5 text-indigo-600" /> :
                           <Calendar className="h-5 w-5 text-blue-600" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.subject}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(activity.createdAt).toLocaleString()} by {activity.createdBy === 'system' ? 'Automation' : activity.createdBy}
                        </p>
                        {activity.body && <p className="text-gray-700 mt-2">{activity.body}</p>}
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
                    <Link key={deal.id} to={`/deals/${deal.id}`} className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <p className="font-medium text-gray-900">{deal.title}</p>
                      <p className="text-sm text-gray-500 mt-1">${deal.value.toLocaleString()} · {deal.stage}</p>
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
              <button onClick={() => addActivity({ type: 'email_sent', subject: `Sent email to ${contact.firstName} ${contact.lastName}`, contactId: contact.id, companyId: contact.companyId, createdBy: 'Current User' })} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Send Email</button>
              <button onClick={() => addActivity({ type: 'note', subject: `Logged activity for ${contact.firstName} ${contact.lastName}`, contactId: contact.id, companyId: contact.companyId, createdBy: 'Current User' })} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Log Activity</button>
              <button onClick={() => addDeal({ title: `${contact.firstName} ${contact.lastName} - New Opportunity`, value: 0, currency: 'USD', stage: 'lead', companyId: contact.companyId, assignedTo: contact.assignedTo || '', status: 'open', probability: 10 })} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Create Deal</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

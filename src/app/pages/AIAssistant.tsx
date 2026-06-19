import { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import {
  Send, Bot, User, Sparkles, TrendingUp, Users, DollarSign, Phone,
  PhoneCall, PhoneMissed, PhoneOff, Clock, Mic, MicOff, Volume2, VolumeX,
  ChevronRight, MessageSquare, Zap, Target, FileText, Play, Pause,
  CheckCircle2, AlertCircle, Lightbulb, BarChart2, Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Progress } from '../components/ui/progress';

interface CallInsight {
  type: 'positive' | 'warning' | 'action';
  text: string;
}

interface CallRecord {
  id: string;
  contact: string;
  company: string;
  initials: string;
  color: string;
  status: 'completed' | 'missed';
  outcome: 'won' | 'follow_up' | 'lost' | null;
  duration: string;
  date: string;
  sentiment: number;
  transcript: Array<{ speaker: 'rep' | 'contact'; text: string }>;
  aiInsights: CallInsight[];
  score: number;
}

const quickPrompts = [
  { icon: TrendingUp, text: 'Show my pipeline', category: 'analytics' },
  { icon: Users, text: 'How many contacts?', category: 'analytics' },
  { icon: DollarSign, text: 'Sales summary', category: 'analytics' },
  { icon: Sparkles, text: 'Write follow-up email', category: 'content' },
  { icon: Target, text: 'Best deals to close', category: 'coaching' },
  { icon: FileText, text: 'Draft a proposal', category: 'content' },
];

export function AIAssistant() {
  const { aiMessages, addAIMessage, deals, companies, contacts, campaigns, activities, addActivity, apiError } = useData();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState('assistant');
  const [loggedCalls, setLoggedCalls] = useState<CallRecord[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, isTyping]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isOnCall) {
      timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isOnCall]);

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const activityCalls: CallRecord[] = activities
    .filter(activity => activity.type === 'call')
    .map((activity, index) => ({
      id: activity.id,
      contact: activity.subject.replace(/^Logged call with\s*/i, '') || 'Logged Call',
      company: companies.find(company => company.id === activity.companyId)?.name ?? 'CRM Activity',
      initials: activity.subject.split(' ').slice(-2).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'LC',
      color: ['bg-indigo-500', 'bg-sky-500', 'bg-violet-500', 'bg-emerald-500'][index % 4],
      status: 'completed',
      outcome: 'follow_up',
      duration: '00:00',
      date: activity.createdAt,
      sentiment: 0,
      transcript: [],
      aiInsights: [
        { type: 'action', text: activity.body || 'Follow up and add call notes.' },
      ],
      score: 0,
    }));
  const calls = [...loggedCalls, ...activityCalls].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const activeCall: CallRecord = selectedCall ?? calls[0] ?? {
    id: 'empty',
    contact: 'No calls yet',
    company: 'Log a call to populate this panel',
    initials: 'NC',
    color: 'bg-muted',
    status: 'missed',
    outcome: null,
    duration: '00:00',
    date: new Date().toISOString(),
    sentiment: 0,
    transcript: [],
    aiInsights: [{ type: 'action', text: 'Use Log New Call to create the first call record.' }],
    score: 0,
  };
  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    addAIMessage({ role: 'user', content: userMessage });
    setIsTyping(true);
    window.setTimeout(() => setIsTyping(false), 1200);
  };

  const handleLogCall = () => {
    const contact = contacts[0];
    const newCall = {
      id: Date.now().toString(),
      contact: contact ? `${contact.firstName} ${contact.lastName}` : 'New Contact',
      company: contact?.companyId ? companies.find(company => company.id === contact.companyId)?.name ?? 'Manual Call' : 'Manual Call',
      initials: contact ? `${contact.firstName[0]}${contact.lastName[0]}` : 'NC',
      color: 'bg-indigo-500',
      status: 'completed' as const,
      outcome: 'follow_up' as const,
      duration: formatDuration(callDuration || 300),
      date: new Date().toISOString(),
      score: 78,
      sentiment: 78,
      transcript: [],
      aiInsights: [
        { type: 'action' as const, text: 'Follow up with a summary email' },
        { type: 'positive' as const, text: 'Call logged from the assistant workspace' },
      ],
    };
    setLoggedCalls(prev => [newCall, ...prev]);
    setSelectedCall(newCall);
    addActivity({
      type: 'call',
      subject: `Logged call with ${newCall.contact}`,
      body: 'Call created from AI Assistant',
      createdBy: 'Current User',
    });
  };

  const handleCoachingAction = (action: string) => {
    setActiveTab('assistant');
    addAIMessage({ role: 'user', content: action });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const outcomeConfig: Record<string, { label: string; className: string }> = {
    won: { label: 'Won', className: 'bg-emerald-50 text-emerald-700' },
    follow_up: { label: 'Follow-up', className: 'bg-sky-50 text-sky-700' },
    lost: { label: 'Lost', className: 'bg-red-50 text-red-700' },
  };

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);
  const isAfter = (value: string, date: Date) => new Date(value) >= date;
  const isBetween = (value: string, start: Date, end: Date) => {
    const itemDate = new Date(value);
    return itemDate >= start && itemDate < end;
  };

  const thisWeekCalls = calls.filter(call => isAfter(call.date, sevenDaysAgo));
  const lastWeekCalls = calls.filter(call => isBetween(call.date, fourteenDaysAgo, sevenDaysAgo));
  const avgSentiment = thisWeekCalls.length
    ? Math.round(thisWeekCalls.reduce((sum, call) => sum + (call.sentiment || call.score || 0), 0) / thisWeekCalls.length)
    : 0;
  const lastWeekAvgSentiment = lastWeekCalls.length
    ? Math.round(lastWeekCalls.reduce((sum, call) => sum + (call.sentiment || call.score || 0), 0) / lastWeekCalls.length)
    : 0;
  const followUpsSent = activities.filter(activity => activity.type.includes('email') && isAfter(activity.createdAt, sevenDaysAgo)).length;
  const lastWeekFollowUps = activities.filter(activity => activity.type.includes('email') && isBetween(activity.createdAt, fourteenDaysAgo, sevenDaysAgo)).length;
  const demosBooked = activities.filter(activity => activity.type === 'meeting' && isAfter(activity.createdAt, sevenDaysAgo)).length;
  const lastWeekDemos = activities.filter(activity => activity.type === 'meeting' && isBetween(activity.createdAt, fourteenDaysAgo, sevenDaysAgo)).length;
  const openDeals = deals.filter(deal => deal.status === 'open');

  const callMetrics = [
    { label: 'Calls Made', value: thisWeekCalls.length, prev: lastWeekCalls.length, max: Math.max(thisWeekCalls.length, lastWeekCalls.length, 1) },
    { label: 'Avg Sentiment', value: avgSentiment, prev: lastWeekAvgSentiment, max: 100, unit: '%' },
    { label: 'Follow-ups Sent', value: followUpsSent, prev: lastWeekFollowUps, max: Math.max(followUpsSent, lastWeekFollowUps, 1) },
    { label: 'Demos Booked', value: demosBooked, prev: lastWeekDemos, max: Math.max(demosBooked, lastWeekDemos, 1) },
  ];

  const coachingItems = deals
    .filter(deal => deal.status === 'open')
    .sort((a, b) => (b.value * b.probability) - (a.value * a.probability))
    .slice(0, 3)
    .map((deal) => ({
      priority: deal.probability >= 70 || deal.value >= 25000 ? 'high' : 'medium',
      title: deal.title,
      action: deal.stage === 'negotiation'
        ? 'Finalize pricing and send contract'
        : deal.stage === 'proposal'
          ? 'Send revised proposal with ROI breakdown'
          : 'Schedule next-step discovery call',
      reason: `${deal.stage} stage with ${deal.probability}% probability`,
      value: `$${deal.value.toLocaleString()}`,
    }));

  const tips = [
    openDeals.length > 0 ? `Focus on ${openDeals.length} open deals worth $${openDeals.reduce((sum, deal) => sum + deal.value, 0).toLocaleString()}.` : 'Create a new deal to start pipeline coaching.',
    contacts.filter(contact => contact.status === 'lead').length > 0 ? `Convert ${contacts.filter(contact => contact.status === 'lead').length} leads into qualified prospects.` : 'No new leads need qualification right now.',
    campaigns.some(campaign => campaign.status === 'sent') ? `Review engagement from ${campaigns.filter(campaign => campaign.status === 'sent').length} sent campaigns.` : 'Send or schedule a campaign to generate engagement signals.',
    followUpsSent > 0 ? `${followUpsSent} follow-up emails were logged this week.` : 'Log follow-up emails after calls to keep activity metrics current.',
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">AI Call Assistant</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-powered sales coaching, call analysis, and content generation</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            AI Online
          </Badge>
          <Button size="sm" onClick={() => setIsOnCall(!isOnCall)} className={isOnCall ? 'bg-red-600 hover:bg-red-700' : ''}>
            {isOnCall ? (
              <><PhoneOff className="h-3.5 w-3.5 mr-1.5" />End Call</>
            ) : (
              <><PhoneCall className="h-3.5 w-3.5 mr-1.5" />Start Call</>
            )}
          </Button>
        </div>
      </div>

      {/* Live Call Banner */}
      {isOnCall && (
        <Card className="border-red-200 bg-red-50 p-0">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-400 animate-ping" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Live Call in Progress</p>
                  <p className="text-xs text-red-600">Duration: {formatDuration(callDuration)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 ${isMuted ? 'border-red-300 bg-red-100 text-red-700' : 'border-red-200 text-red-700'}`}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-3.5 w-3.5 mr-1" /> : <Mic className="h-3.5 w-3.5 mr-1" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
                <Button size="sm" variant="destructive" className="h-8" onClick={() => setIsOnCall(false)}>
                  <PhoneOff className="h-3.5 w-3.5 mr-1" />
                  End
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9">
          <TabsTrigger value="assistant" className="text-xs gap-1.5">
            <Bot className="h-3.5 w-3.5" />AI Chat
          </TabsTrigger>
          <TabsTrigger value="calls" className="text-xs gap-1.5">
            <Phone className="h-3.5 w-3.5" />Call Log
          </TabsTrigger>
          <TabsTrigger value="coaching" className="text-xs gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />Coaching
          </TabsTrigger>
        </TabsList>

        {/* AI Chat Tab */}
        <TabsContent value="assistant" className="mt-4">
          <Card className="p-0 overflow-hidden" style={{ height: 'calc(100vh - 22rem)' }}>
            <div className="flex flex-col h-full">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {aiMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Sparkles className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="font-semibold text-foreground mb-1.5">AI Sales Assistant</h2>
                    <p className="text-sm text-muted-foreground max-w-sm mb-8">
                      Get instant pipeline insights, generate personalized emails, and receive AI coaching on your deals.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-xl w-full">
                      {quickPrompts.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => setInput(prompt.text)}
                          className="flex items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-all group"
                        >
                          <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                            <prompt.icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{prompt.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {aiMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          message.role === 'user' ? 'bg-primary' : 'bg-muted border border-border'
                        }`}>
                          {message.role === 'user'
                            ? <User className="h-4 w-4 text-white" />
                            : <Bot className="h-4 w-4 text-muted-foreground" />
                          }
                        </div>
                        <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-muted text-foreground rounded-tl-sm'
                          }`}>
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 mt-1 px-1">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="px-4 py-3 bg-muted rounded-2xl rounded-tl-sm">
                          <div className="flex gap-1.5 items-center h-4">
                            {[0, 150, 300].map(delay => (
                              <div key={delay} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border p-4">
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your pipeline, request content, or get coaching..."
                    className="flex-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none min-h-[44px] max-h-[100px]"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    size="icon"
                    className="h-11 w-11 rounded-xl shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Call Log Tab */}
        <TabsContent value="calls" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Call List */}
            <div className="lg:col-span-2 space-y-2">
              {calls.map((call) => (
                <Card
                  key={call.id}
                  className={`cursor-pointer transition-all p-0 hover:shadow-sm ${activeCall.id === call.id ? 'border-primary/40 shadow-sm' : ''}`}
                  onClick={() => setSelectedCall(call)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className={`h-9 w-9 shrink-0 ${call.color}`}>
                        <AvatarFallback className={`${call.color} text-white text-xs font-medium`}>
                          {call.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{call.contact}</p>
                          {call.outcome && (
                            <Badge variant="secondary" className={`text-[10px] h-4 px-1 ${outcomeConfig[call.outcome]?.className}`}>
                              {outcomeConfig[call.outcome]?.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{call.company}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end mb-0.5">
                          {call.status === 'missed' ? (
                            <PhoneMissed className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <Phone className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span className="text-xs text-muted-foreground">{call.duration}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60">
                          {new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    {call.score > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Call Score</span>
                          <span className="font-medium text-foreground">{call.score}/100</span>
                        </div>
                        <Progress value={call.score} className="h-1" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={handleLogCall}>
                <Plus className="h-3.5 w-3.5" />
                Log New Call
              </Button>
            </div>

            {/* Call Detail */}
            <Card className="lg:col-span-3 p-0 overflow-hidden">
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className={`h-10 w-10 ${activeCall.color}`}>
                    <AvatarFallback className={`${activeCall.color} text-white text-sm font-medium`}>
                      {activeCall.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-base">{activeCall.contact}</CardTitle>
                    <CardDescription>{activeCall.company} · {activeCall.duration}</CardDescription>
                  </div>
                  {activeCall.outcome && (
                    <Badge variant="secondary" className={outcomeConfig[activeCall.outcome]?.className}>
                      {outcomeConfig[activeCall.outcome]?.label}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 26rem)' }}>
                {activeCall.transcript.length > 0 ? (
                  <div className="p-4">
                    {/* Transcript */}
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Transcript</p>
                    <div className="space-y-3">
                      {activeCall.transcript.map((line, i) => (
                        <div key={i} className={`flex gap-2.5 ${line.speaker === 'rep' ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${
                            line.speaker === 'rep' ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border text-muted-foreground'
                          }`}>
                            {line.speaker === 'rep' ? 'Y' : activeCall.initials[0]}
                          </div>
                          <div className={`flex-1 max-w-[85%]`}>
                            <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                              line.speaker === 'rep'
                                ? 'bg-primary/10 text-foreground rounded-tr-sm'
                                : 'bg-muted text-foreground rounded-tl-sm'
                            }`}>
                              {line.text}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-4" />

                    {/* AI Insights */}
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">AI Insights</p>
                    <div className="space-y-2">
                      {activeCall.aiInsights.map((insight, i) => (
                        <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg ${
                          insight.type === 'positive' ? 'bg-emerald-50 border border-emerald-100' :
                          insight.type === 'warning' ? 'bg-amber-50 border border-amber-100' :
                          'bg-indigo-50 border border-indigo-100'
                        }`}>
                          {insight.type === 'positive' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : insight.type === 'warning' ? (
                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          ) : (
                            <Zap className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                          )}
                          <p className="text-xs text-foreground">{insight.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <PhoneMissed className="h-10 w-10 text-red-400/50 mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">Missed Call</p>
                    <p className="text-xs text-muted-foreground mb-4">No transcript available. Consider following up.</p>
                    {activeCall.aiInsights.map((insight, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg w-full mb-1.5">
                        <Zap className="h-3.5 w-3.5 shrink-0" />
                        {insight.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Coaching Tab */}
        <TabsContent value="coaching" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Deal Coaching */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50">
                    <Target className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Deal Coaching</CardTitle>
                    <CardDescription>AI recommendations for your pipeline</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {coachingItems.length > 0 ? coachingItems.map((item, i) => (
                  <div key={i} className={`p-3.5 rounded-xl border ${item.priority === 'high' ? 'border-indigo-200 bg-indigo-50/50' : 'border-border bg-muted/20'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-foreground">{item.title}</p>
                      <Badge variant="secondary" className={`text-[10px] ${item.priority === 'high' ? 'bg-indigo-100 text-indigo-700' : 'bg-muted text-muted-foreground'}`}>
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground mb-1">Action: {item.action}</p>
                    <p className="text-[11px] text-muted-foreground">{item.reason}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-xs font-semibold text-emerald-600">{item.value}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => handleCoachingAction(item.action)}>
                        Take action
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                    <p className="text-xs font-semibold text-foreground">No open deals yet</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Create a deal to generate coaching recommendations.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-violet-50">
                      <BarChart2 className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Call Performance</CardTitle>
                      <CardDescription>This week vs last week</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {callMetrics.map(metric => (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">{metric.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">{metric.value}{metric.unit || ''}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-emerald-50 text-emerald-700">
                            {metric.value - metric.prev >= 0 ? '+' : ''}{metric.value - metric.prev}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={(metric.value / metric.max) * 100} className="h-1.5" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50">
                      <Lightbulb className="h-4 w-4 text-amber-600" />
                    </div>
                    <CardTitle className="text-base">Today's Tips</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50/50 border border-amber-100">
                      <span className="text-sm shrink-0">💡</span>
                      <p className="text-xs text-foreground">{tip}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}






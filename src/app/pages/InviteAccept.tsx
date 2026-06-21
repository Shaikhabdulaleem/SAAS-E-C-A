import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { apiRequest } from '../lib/api';

interface InviteDetails {
  email: string;
  role: string;
  tenantName: string;
  expiresAt: string;
}

export function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    apiRequest<InviteDetails>(`/team/invites/${token}`)
      .then(data => {
        setInvite(data);
        setName(data.email.split('@')[0]);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Invite not found'))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    if (!token) return;
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/team/invites/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({ name, password }),
      });
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invite');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-0">
        <CardHeader>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            {complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <KeyRound className="h-5 w-5 text-primary" />}
          </div>
          <CardTitle>{complete ? 'Account Ready' : 'Accept Client Invite'}</CardTitle>
          <CardDescription>
            {complete ? 'Your client account has been activated.' : loading ? 'Loading invite...' : invite ? `Join ${invite.tenantName}` : 'Invite unavailable'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {complete ? (
            <Button asChild className="w-full">
              <Link to="/login">Go To Login</Link>
            </Button>
          ) : invite ? (
            <>
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{invite.email}</p>
                <p className="mt-2 text-xs text-muted-foreground">Invite expires {new Date(invite.expiresAt).toLocaleString()}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              <Button className="w-full" onClick={accept} disabled={saving || !name.trim() || !password || !confirm}>
                {saving ? 'Activating...' : 'Activate Account'}
              </Button>
            </>
          ) : !loading ? (
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back To Login</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

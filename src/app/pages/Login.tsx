import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Zap, ArrowRight, Users, TrendingUp, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-white" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-white" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold">NX</span>
            </div>
            <span className="text-white text-xl font-semibold">NexusHQ</span>
          </div>

          <h1 className="text-4xl font-semibold text-white leading-tight mb-4">
            Your complete<br />B2B sales platform
          </h1>
          <p className="text-white/70 text-lg">
            CRM, email marketing, and AI-powered insights — all in one place.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: Users, title: 'CRM & Pipeline', desc: 'Manage contacts, companies, and deals in one place' },
            { icon: Mail, title: 'Email Marketing', desc: 'Create and track campaigns with built-in analytics' },
            { icon: Zap, title: 'AI Call Assistant', desc: 'Get real-time coaching and post-call insights' },
          ].map((feat) => (
            <div key={feat.title} className="flex items-start gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-white/20 shrink-0">
                <feat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">{feat.title}</p>
                <p className="text-white/60 text-xs mt-0.5">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">NX</span>
            </div>
            <span className="text-foreground font-semibold">NexusHQ</span>
          </div>

          <div className="mb-8">
            <h2 className="text-foreground mb-1.5">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to your NexusHQ account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@nexushq.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                className={error ? 'border-destructive' : ''}
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className={`pr-10 ${error ? 'border-destructive' : ''}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Don't have an account?{' '}
            <button className="text-primary hover:underline font-medium">Contact sales</button>
          </p>
        </div>
      </div>
    </div>
  );
}

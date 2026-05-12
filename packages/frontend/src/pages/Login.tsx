import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, token } = await authService.login({ email, password });
      login(user, token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-app">
      <div className="w-full max-w-sm p-8 rounded-xl bg-bg-surface border border-border-subtle">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-md bg-accent-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <span className="text-[15px] font-semibold text-text-primary">{t('app.name')}</span>
        </div>

        <h1 className="text-lg font-semibold text-text-primary mb-1">{t('auth.loginTitle')}</h1>
        <p className="text-sm text-text-secondary mb-6">{t('auth.loginSubtitle', 'Sign in to your account')}</p>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-sm text-status-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            {t('auth.login')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-text-secondary">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-accent-primary hover:underline">
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}

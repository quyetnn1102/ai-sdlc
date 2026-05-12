import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function RegisterPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, token } = await authService.register({ name, email, password });
      login(user, token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-app">
      <div className="w-full max-w-sm p-8 rounded-xl bg-bg-surface border border-border-subtle">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-md bg-accent-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <span className="text-[15px] font-semibold text-text-primary">{t('app.name')}</span>
        </div>

        <h1 className="text-lg font-semibold text-text-primary mb-1">{t('auth.registerTitle')}</h1>
        <p className="text-sm text-text-secondary mb-6">{t('auth.registerSubtitle', 'Create your free account')}</p>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-sm text-status-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('auth.name')} type="text" value={name}
            onChange={(e) => setName(e.target.value)} placeholder="John Doe" required />
          <Input label={t('auth.email')} type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Input label={t('auth.password')} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
          <Button type="submit" className="w-full" loading={loading}>
            {t('auth.register')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-text-secondary">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-accent-primary hover:underline">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
}

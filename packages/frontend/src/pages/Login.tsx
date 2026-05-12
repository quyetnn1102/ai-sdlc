import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: implement login API call
    console.log('Login:', { email, password });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-app">
      <div className="w-full max-w-sm p-8 rounded-xl bg-bg-surface border border-border-subtle">
        <h1 className="text-lg font-semibold text-text-primary mb-6">
          {t('auth.loginTitle')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-strong"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-strong"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full h-9 rounded-[6px] bg-accent-primary text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            {t('auth.login')}
          </button>
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

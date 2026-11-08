import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../services/api';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');

  const { register } = useAuth();

  // Dynamic password strength scoring
  const calculateStrength = (pass) => {
    let score = 0;
    if (!pass) return { score: 0, label: 'Too short', color: 'bg-slate-700' };
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
      case 2:
        return { score: 25, label: 'Weak', color: 'bg-red-500' };
      case 3:
        return { score: 50, label: 'Fair', color: 'bg-amber-500' };
      case 4:
        return { score: 75, label: 'Good', color: 'bg-blue-500' };
      case 5:
        return { score: 100, label: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score: 0, label: 'Too short', color: 'bg-slate-700' };
    }
  };

  const strength = calculateStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the terms of service and privacy policy.');
      return;
    }

    try {
      setLoading(true);
      await register(name, email, password, termsAccepted);
      setRegisteredEmail(email);
    } catch (err) {
      setError(err.message || 'Registration failed. Please check the provided information.');
    } finally {
      setLoading(false);
    }
  };

  // If successfully registered, show clear email verification prompt
  if (registeredEmail) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
          <Card className="py-10 px-8 text-center border-slate-800 bg-slate-900/90 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
              Check your inbox
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              We dispatched an activation link to{' '}
              <span className="font-semibold text-slate-200">{registeredEmail}</span>.
              Please click the link to verify your email and activate your workspace.
            </p>

            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 text-xs text-slate-400 text-left mb-6 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Security Notice</span>
              </div>
              <p>The verification link will expire in 24 hours. If it does not appear in a few minutes, please check your spam folder.</p>
            </div>

            <div className="space-y-3">
              <Link to="/login" className="block w-full">
                <Button variant="primary" className="w-full justify-center">
                  Go to Sign in
                </Button>
              </Link>
              <Link
                to="/resend-verification"
                className="inline-block text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Didn't get the email? Resend verification link
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 right-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Mail<span className="text-indigo-400">Flow</span>
          </span>
        </Link>
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-white">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Card className="py-8 px-6 sm:px-10 border-slate-800 bg-slate-900/80 backdrop-blur-md">
          {error && (
            <div className="mb-6 rounded-lg bg-red-950/50 border border-red-500/40 p-4 text-sm text-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="flex-1">{error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              id="name"
              label="Full Name"
              type="text"
              placeholder="Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={User}
              required
              autoComplete="name"
            />

            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="alex@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              required
              autoComplete="email"
            />

            <div>
              <Input
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={Lock}
                required
                autoComplete="new-password"
                endIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-200 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              {/* Password strength indicator */}
              {password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Password strength</span>
                    <span className="font-semibold text-slate-300">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <Input
              id="confirmPassword"
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={Lock}
              required
              autoComplete="new-password"
            />

            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500/20"
                required
              />
              <label htmlFor="terms" className="ml-2.5 text-xs text-slate-400 leading-relaxed">
                I agree to the{' '}
                <a href="#terms" className="text-indigo-400 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="text-indigo-400 hover:underline">
                  Privacy Policy
                </a>
                .
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-2.5 shadow-md shadow-indigo-600/20"
              isLoading={loading}
            >
              Create Account
            </Button>
          </form>

          {/* Social registration divider */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-wider">
                  Or register with
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `${API_BASE_URL}/auth/oauth/google`;
                }}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-slate-800 rounded-lg shadow-sm bg-slate-950 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Google
              </button>

              <button
                type="button"
                onClick={() => setError('GitHub OAuth client ID is awaiting your configuration in .env')}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-slate-800 rounded-lg shadow-sm bg-slate-950 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                GitHub
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;


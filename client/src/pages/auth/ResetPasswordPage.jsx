import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { resetPassword } from '../../services/api';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Missing or invalid reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await resetPassword({ token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Mail<span className="text-indigo-400">Flow</span>
          </span>
        </Link>

        <Card className="py-8 px-6 sm:px-10 border-slate-800 bg-slate-900/90 shadow-2xl">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Password Updated
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your password has been securely reset. All active sessions have been invalidated for security. You can now log in.
              </p>
              <div className="pt-4">
                <Link to="/login" className="block w-full">
                  <Button variant="primary" className="w-full justify-center">
                    Sign in with new password
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Choose a new password
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Please enter your new password below (min 8 characters, 1 uppercase, 1 number).
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-lg bg-red-950/50 border border-red-500/40 p-4 text-sm text-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="flex-1">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  id="password"
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
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

                <Input
                  id="confirmPassword"
                  label="Confirm New Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={Lock}
                  required
                  autoComplete="new-password"
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center py-2.5"
                  isLoading={loading}
                >
                  Reset Password
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;


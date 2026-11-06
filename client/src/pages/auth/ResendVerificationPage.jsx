import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { resendVerificationEmail } from '../../services/api';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

export const ResendVerificationPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please provide your account email address.');
      return;
    }

    try {
      setLoading(true);
      await resendVerificationEmail({ email });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Unable to process request.');
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
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Link dispatched
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                If an unverified account exists for{' '}
                <span className="text-slate-200 font-medium">{email}</span>, a fresh verification email has been sent.
              </p>
              <div className="pt-4">
                <Link to="/login" className="block w-full">
                  <Button variant="primary" className="w-full justify-center">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Resend verification email
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Enter your registered email address and we will dispatch a new verification link.
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-lg bg-red-950/50 border border-red-500/40 p-4 text-sm text-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="flex-1">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  id="email"
                  label="Account Email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={Mail}
                  required
                  autoComplete="email"
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center py-2.5"
                  isLoading={loading}
                >
                  Send Verification Link
                </Button>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Back to sign in
                  </Link>
                </div>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResendVerificationPage;


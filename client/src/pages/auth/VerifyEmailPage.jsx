import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Mail, ArrowRight } from 'lucide-react';
import { verifyEmail } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Missing verification token in link.');
      return;
    }

    const performVerification = async () => {
      try {
        await verifyEmail({ token, email: email || undefined });
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err.message || 'Verification link is invalid or has expired.'
        );
      }
    };

    performVerification();
  }, [token, email]);

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

        <Card className="py-10 px-8 text-center border-slate-800 bg-slate-900/90 shadow-2xl">
          {status === 'verifying' && (
            <div className="py-6 flex flex-col items-center">
              <LoadingSpinner size="lg" />
              <h3 className="mt-4 text-lg font-semibold text-white">
                Verifying your email...
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Please wait while we validate your activation token.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                Email Verified!
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your email address has been successfully verified. Your primary MailFlow workspace is created and ready for campaigns.
              </p>
              <div className="pt-4">
                <Link to="/login" className="block w-full">
                  <Button variant="primary" className="w-full justify-center">
                    Sign in to your account <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                <XCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                Verification Failed
              </h3>
              <p className="text-sm text-red-300 leading-relaxed">
                {errorMessage}
              </p>
              <div className="pt-4 space-y-3">
                <Link to="/resend-verification" className="block w-full">
                  <Button variant="primary" className="w-full justify-center">
                    Request New Verification Email
                  </Button>
                </Link>
                <Link
                  to="/login"
                  className="inline-block text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Return to sign in
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmailPage;


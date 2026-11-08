import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

export const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthSession } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const err = searchParams.get('error');

    if (err) {
      setError(err);
      return;
    }

    if (!token) {
      setError('No authentication token received from provider.');
      return;
    }

    const completeAuth = async () => {
      try {
        await setAuthSession(token);
        navigate('/dashboard', { replace: true });
      } catch (e) {
        setError(e.message || 'Failed to complete authentication.');
      }
    };

    completeAuth();
  }, [searchParams, navigate, setAuthSession]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
          <Card className="py-8 px-6 sm:px-10 border-slate-800 bg-slate-900/80 backdrop-blur-md">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Authentication Failed</h2>
            <div className="mb-6 rounded-lg bg-red-950/50 border border-red-500/40 p-4 text-sm text-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => navigate('/login', { replace: true })}
            >
              Back to Sign in
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-300">Completing sign in with Google...</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;

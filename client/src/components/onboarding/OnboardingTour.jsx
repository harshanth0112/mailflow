import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { updateMyProfile } from '../../services/api';
import {
  Sparkles,
  LayoutDashboard,
  Users,
  Send,
  Calendar,
  BarChart2,
  Settings,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle,
  Zap,
  Mail,
  RefreshCw,
  Bot,
  FileText,
  ChevronRight,
} from 'lucide-react';

// --- Onboarding steps config ---
const USER_STEPS = [
  {
    id: 0,
    title: 'Welcome to MailFlow',
    icon: Sparkles,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    description:
      'You\'re all set up and ready to go. MailFlow is your all-in-one email marketing and campaign automation platform. Let\'s take a quick tour to help you get started.',
    highlight: null,
    action: null,
  },
  {
    id: 1,
    title: 'Your Dashboard',
    icon: LayoutDashboard,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    description:
      'The Dashboard is your central command center. See your campaign stats, contact counts, and recent activity at a glance. All data is sourced live from your workspace.',
    highlight: 'dashboard',
    action: { label: 'Go to Dashboard', path: '/dashboard' },
  },
  {
    id: 2,
    title: 'Connect an Email Account',
    icon: Mail,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    description:
      'Connect your Gmail or Outlook account to start sending campaigns. MailFlow uses secure OAuth and SMTP to send on your behalf — no password sharing required.',
    highlight: 'email-accounts',
    action: { label: 'View Email Settings', path: '/settings/email-accounts' },
  },
  {
    id: 3,
    title: 'Add or Import Contacts',
    icon: Users,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    description:
      'Build your audience by adding contacts individually or importing them from a CSV or Excel file. MailFlow automatically handles duplicate detection and validates email formats.',
    highlight: 'contacts',
    action: { label: 'Manage Contacts', path: '/contacts' },
  },
  {
    id: 4,
    title: 'Create an Email Campaign',
    icon: Send,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    description:
      'Design and compose your first campaign. Choose recipients from your contacts or groups, write your message, and preview it before sending. Use rich HTML or plain text.',
    highlight: 'campaigns',
    action: { label: 'Create Campaign', path: '/campaigns' },
  },
  {
    id: 5,
    title: 'Schedule Email Delivery',
    icon: Calendar,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
    description:
      'Don\'t have to send right now? Schedule your campaign for the perfect time. MailFlow uses a reliable background queue to ensure delivery at the exact moment you specify.',
    highlight: 'scheduled',
    action: { label: 'View Scheduled', path: '/scheduled' },
  },
  {
    id: 6,
    title: 'Templates & Auto Replies',
    icon: FileText,
    iconColor: 'text-teal-400',
    iconBg: 'bg-teal-500/10',
    description:
      'Save time with reusable email templates. Set up automatic reply rules to respond to incoming emails based on your conditions — perfect for welcome sequences and follow-ups.',
    highlight: 'templates',
    action: { label: 'View Templates', path: '/templates' },
  },
  {
    id: 7,
    title: 'Understand Analytics',
    icon: BarChart2,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
    description:
      'Track your campaign performance with real-time analytics. Monitor open rates, click rates, delivery outcomes, and engagement trends across all your sent campaigns.',
    highlight: 'analytics',
    action: { label: 'View Analytics', path: '/analytics' },
  },
  {
    id: 8,
    title: 'Your AI Assistant',
    icon: Bot,
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-500/10',
    description:
      'MailFlow includes a built-in AI assistant that can help you draft email copy, troubleshoot issues, and answer questions about the platform. Find it in the Help menu anytime.',
    highlight: 'ai-assistant',
    action: null,
  },
  {
    id: 9,
    title: 'Settings & Team',
    icon: Settings,
    iconColor: 'text-slate-400',
    iconBg: 'bg-slate-500/10',
    description:
      'Configure your workspace, manage team members, adjust sending limits, and control notification preferences from the Settings area. You\'re all set — let\'s build something great!',
    highlight: 'settings',
    action: { label: 'Open Settings', path: '/workspace/settings' },
  },
];

const ADMIN_STEPS = [
  {
    id: 0,
    title: 'Welcome, Administrator',
    icon: Zap,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    description:
      'You have full administrative access to MailFlow. As a Super Admin, you can manage workspace members, configure platform settings, and oversee all workspace operations.',
    highlight: null,
    action: null,
  },
  {
    id: 1,
    title: 'Team & Access Control',
    icon: Users,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    description:
      'Invite team members and assign roles — Campaign Managers, Admins, or standard Users. Each role has precisely scoped permissions enforced server-side. No privilege escalation is possible.',
    highlight: 'members',
    action: { label: 'Manage Team', path: '/workspace/members' },
  },
  {
    id: 2,
    title: 'Workspace Configuration',
    icon: Settings,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    description:
      'Configure sending defaults, daily limits, default sender identity, and timezone settings for your workspace. These defaults apply to all campaigns created by your team.',
    highlight: 'settings',
    action: { label: 'Workspace Settings', path: '/workspace/settings' },
  },
  {
    id: 3,
    title: 'Connect Email Accounts',
    icon: Mail,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    description:
      'Connect Gmail or Outlook accounts to power your team\'s campaigns. Credentials are stored encrypted and scoped to your workspace. Each account can be disconnected at any time.',
    highlight: 'email-accounts',
    action: { label: 'Email Accounts', path: '/settings/email-accounts' },
  },
  {
    id: 4,
    title: 'Platform Ready',
    icon: CheckCircle,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    description:
      'Your workspace is fully configured and ready. Invite your team, connect a sending account, and launch your first campaign. You have full visibility over all workspace activity.',
    highlight: null,
    action: { label: 'Open Dashboard', path: '/dashboard' },
  },
];

const TOTAL_STEPS_USER = USER_STEPS.length;
const TOTAL_STEPS_ADMIN = ADMIN_STEPS.length;

export const OnboardingTour = () => {
  const { user, updateUserProfile } = useAuth();
  const { isSuperAdmin, isAdmin } = useWorkspace();
  const navigate = useNavigate();

  const isAdminFlow = isSuperAdmin || isAdmin;
  const steps = isAdminFlow ? ADMIN_STEPS : USER_STEPS;
  const totalSteps = steps.length;

  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Determine whether to show onboarding on mount
  useEffect(() => {
    if (!user) return;
    const shouldShow =
      !user.onboardingCompleted &&
      !user.onboardingSkipped;

    if (shouldShow) {
      const savedStep = user.onboardingStep || 0;
      setCurrentStep(savedStep < totalSteps ? savedStep : 0);
      setVisible(true);
    }
  }, [user, totalSteps]);

  const persistProgress = useCallback(
    async (step, completed = false, skipped = false) => {
      setSaving(true);
      try {
        const res = await updateMyProfile({
          onboardingStep: step,
          onboardingCompleted: completed,
          onboardingSkipped: skipped,
        });
        if (res?.data) {
          updateUserProfile(res.data);
        }
      } catch (e) {
        console.error('Failed to persist onboarding progress:', e);
      } finally {
        setSaving(false);
      }
    },
    [updateUserProfile]
  );

  const handleNext = async () => {
    if (currentStep < totalSteps - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      await persistProgress(next);
    } else {
      await handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      persistProgress(prev);
    }
  };

  const handleSkip = async () => {
    setExiting(true);
    await persistProgress(currentStep, false, true);
    setVisible(false);
  };

  const handleComplete = async () => {
    setExiting(true);
    await persistProgress(totalSteps - 1, true, false);
    setVisible(false);
  };

  const handleStepAction = (action) => {
    if (action?.path) {
      navigate(action.path);
    }
  };

  if (!visible) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Tour Modal */}
      <div
        className={`relative z-10 w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl transition-all duration-300 ${
          exiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">
              {isAdminFlow ? 'Admin Onboarding' : 'Getting Started'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-xs text-indigo-400 font-semibold">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800"
            title="Skip onboarding"
            disabled={saving}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex flex-col items-center text-center">
            {/* Icon */}
            <div
              className={`w-16 h-16 rounded-2xl ${step.iconBg} border border-slate-700/60 flex items-center justify-center mb-5`}
            >
              <StepIcon className={`w-7 h-7 ${step.iconColor}`} />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-extrabold text-white mb-3 tracking-tight">
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-slate-300 text-base leading-relaxed mb-6 max-w-sm">
              {step.description}
            </p>

            {/* Optional action button */}
            {step.action && (
              <button
                onClick={() => handleStepAction(step.action)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition-colors mb-2"
              >
                <ChevronRight className="w-4 h-4 text-indigo-400" />
                {step.action.label}
              </button>
            )}
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentStep(idx);
                  persistProgress(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'w-6 bg-indigo-500'
                    : idx < currentStep
                    ? 'w-1.5 bg-indigo-500/40'
                    : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-mono uppercase tracking-wider underline underline-offset-2"
            disabled={saving}
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isLastStep ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Complete Tour
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;


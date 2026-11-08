import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ResendVerificationPage } from './pages/auth/ResendVerificationPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Dashboard
import { DashboardPage } from './pages/dashboard/DashboardPage';

// Workspace
import { WorkspaceMembersPage } from './pages/workspace/WorkspaceMembersPage';
import { WorkspaceSettingsPage } from './pages/workspace/WorkspaceSettingsPage';
import { EmailAccountsPage } from './pages/workspace/EmailAccountsPage';

// Application Modules (Phase stubs)
import { ContactsPage } from './pages/contacts/ContactsPage';
import { CampaignsPage } from './pages/campaigns/CampaignsPage';
import { ScheduledPage } from './pages/scheduled/ScheduledPage';
import { AutoReplyPage } from './pages/auto-reply/AutoReplyPage';
import { TemplatesPage } from './pages/templates/TemplatesPage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { ActivityPage } from './pages/activity/ActivityPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { HelpPage } from './pages/help/HelpPage';
import { AdminPage } from './pages/admin/AdminPage';

// Route Guards & Providers
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/RouteGuard';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            {/* Public Auth Pages (redirect to dashboard if logged in) */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/resend-verification" element={<ResendVerificationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* App Shell (handles both public + authenticated layouts) */}
            <Route path="/" element={<AppShell />}>
              {/* Public routes */}
              <Route index element={<HomePage />} />
              <Route path="architecture" element={<ArchitecturePage />} />

              {/* Protected Dashboard & App Routes */}
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Workspace Management */}
              <Route
                path="workspace/members"
                element={
                  <ProtectedRoute>
                    <WorkspaceMembersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="workspace/settings"
                element={
                  <ProtectedRoute>
                    <WorkspaceSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="workspace/email-accounts"
                element={
                  <ProtectedRoute>
                    <EmailAccountsPage />
                  </ProtectedRoute>
                }
              />

              {/* Application Modules */}
              <Route path="contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
              <Route path="campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
              <Route path="scheduled" element={<ProtectedRoute><ScheduledPage /></ProtectedRoute>} />
              <Route path="auto-reply" element={<ProtectedRoute><AutoReplyPage /></ProtectedRoute>} />
              <Route path="templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
              <Route path="analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
              <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

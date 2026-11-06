import React from 'react';
import { ComingSoonPage } from '../../components/common/ComingSoonPage';
import { Bell } from 'lucide-react';

export const NotificationsPage = () => (
  <ComingSoonPage
    icon={Bell}
    title="Notifications"
    description="In-app and email notifications for campaign completion, delivery failures, security events, and team activity — coming in Phase 11."
    phase="Phase 11"
    iconColor="text-yellow-400"
    iconBg="bg-yellow-500/10"
  />
);


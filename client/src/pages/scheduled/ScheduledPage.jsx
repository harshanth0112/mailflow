import React from 'react';
import { ComingSoonPage } from '../../components/common/ComingSoonPage';
import { Calendar } from 'lucide-react';

export const ScheduledPage = () => (
  <ComingSoonPage
    icon={Calendar}
    title="Scheduled Emails"
    description="View and manage your scheduled campaign queue. Powered by BullMQ + Redis for reliable delivery at precise times — coming in Phase 9."
    phase="Phase 9"
    iconColor="text-orange-400"
    iconBg="bg-orange-500/10"
  />
);


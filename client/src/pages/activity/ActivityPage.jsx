import React from 'react';
import { ComingSoonPage } from '../../components/common/ComingSoonPage';
import { Activity } from 'lucide-react';

export const ActivityPage = () => (
  <ComingSoonPage
    icon={Activity}
    title="Activity Logs"
    description="Comprehensive audit trail of workspace actions, campaign events, member changes, and system operations — coming in Phase 11."
    phase="Phase 11"
    iconColor="text-blue-400"
    iconBg="bg-blue-500/10"
  />
);


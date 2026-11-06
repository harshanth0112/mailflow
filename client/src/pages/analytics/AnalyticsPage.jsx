import React from 'react';
import { ComingSoonPage } from '../../components/common/ComingSoonPage';
import { BarChart2 } from 'lucide-react';

export const AnalyticsPage = () => (
  <ComingSoonPage
    icon={BarChart2}
    title="Campaign Analytics"
    description="Track open rates, click rates, delivery outcomes, bounce rates, and engagement trends across all campaigns. Powered by real event data — coming in Phase 11."
    phase="Phase 11"
    iconColor="text-cyan-400"
    iconBg="bg-cyan-500/10"
  />
);


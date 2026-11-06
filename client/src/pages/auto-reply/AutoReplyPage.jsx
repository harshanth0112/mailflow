import React from 'react';
import { ComingSoonPage } from '../../components/common/ComingSoonPage';
import { Reply } from 'lucide-react';

export const AutoReplyPage = () => (
  <ComingSoonPage
    icon={Reply}
    title="Auto Reply Rules"
    description="Configure automatic email reply rules for incoming messages from connected Gmail or Outlook accounts — coming in Phase 10."
    phase="Phase 10"
    iconColor="text-teal-400"
    iconBg="bg-teal-500/10"
  />
);


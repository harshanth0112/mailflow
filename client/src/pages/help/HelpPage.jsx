import React from 'react';
import { ComingSoonPage } from '../../components/common/ComingSoonPage';
import { HelpCircle } from 'lucide-react';

export const HelpPage = () => (
  <ComingSoonPage
    icon={HelpCircle}
    title="Help & AI Assistant"
    description="Get contextual help, troubleshoot issues, and use the AI assistant to draft email copy and answer MailFlow questions — coming in Phase 12."
    phase="Phase 12"
    iconColor="text-pink-400"
    iconBg="bg-pink-500/10"
  />
);


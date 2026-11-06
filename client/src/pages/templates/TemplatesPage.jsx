import React from 'react';
import { ComingSoonPage } from '../../components/common/ComingSoonPage';
import { FileText } from 'lucide-react';

export const TemplatesPage = () => (
  <ComingSoonPage
    icon={FileText}
    title="Email Templates"
    description="Create and manage reusable HTML email templates for campaigns and auto-replies. Rich editor with preview and variable substitution — coming in Phase 8."
    phase="Phase 8"
    iconColor="text-teal-400"
    iconBg="bg-teal-500/10"
  />
);


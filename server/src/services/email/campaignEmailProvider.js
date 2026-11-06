import { env } from '../../config/env.js';
import { emailProviderRegistry } from './EmailProviderRegistry.js';
import { sendlibertyProvider } from './SendlibertyProvider.js';

export const getCampaignEmailProvider = (senderAccount) => {
  if (env.CAMPAIGN_EMAIL_PROVIDER === 'sendliberty') {
    sendlibertyProvider.validateCampaignSender(senderAccount);
    return sendlibertyProvider;
  }
  return emailProviderRegistry.get(senderAccount.provider);
};

import { GmailProvider } from './GmailProvider.js';
import { OutlookProvider } from './OutlookProvider.js';

class EmailProviderRegistry {
  constructor() {
    this.providers = new Map();
    // Register available providers
    this.register(new GmailProvider());
    this.register(new OutlookProvider());
  }

  register(provider) {
    this.providers.set(provider.name, provider);
  }

  get(name) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Email provider '${name}' is not registered or supported.`);
    }
    return provider;
  }

  listSupported() {
    return Array.from(this.providers.keys());
  }
}

export const emailProviderRegistry = new EmailProviderRegistry();


import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { ChatMessage, CHAT_ROLES } from '../models/ChatMessage.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Fallback in-memory stores for local dev/test mode
export const devConversations = new Map();
export const devChatMessages = new Map();

const MAILFLOW_SYSTEM_PROMPT = `You are MailFlow AI, the intelligent built-in assistant for the MailFlow Email Campaign and Automation platform.
Your mission is to help users succeed with their email campaigns, automation workflows, and subscriber relations.

Your capabilities include:
1. Drafting compelling marketing and sales emails with personalized placeholders like {{firstName}}, {{company}}, {{jobTitle}}.
2. Brainstorming high-converting, spam-filter-safe subject lines and preview text.
3. Improving existing email content for tone, clarity, conciseness, and call-to-action effectiveness.
4. Explaining MailFlow features including workspace isolation, BullMQ campaign queues, auto-reply rules, and contact consent management.
5. Diagnosing email deliverability and troubleshooting common mailbox configuration issues.

Guidelines:
- Maintain a helpful, professional, and encouraging tone.
- Format responses using clean Markdown with bullet points and bold text where appropriate.
- When drafting emails, always include a suggested Subject Line and both HTML-ready copy and plain-text version.
- Never output malicious scripts or unescaped HTML injection.`;

/**
 * Built-in Intelligent Assistant Engine for offline/dev environments
 */
const generateLocalAssistantResponse = ({ prompt, history = [], actionType = 'general' }) => {
  const lower = prompt.toLowerCase();

  // Subject line generation
  if (actionType === 'subject_lines' || lower.includes('subject line') || lower.includes('subject lines')) {
    return `Here are 5 high-converting, spam-resilient subject line options tailored for your campaign:

1. **"Quick question about {{company}}'s strategy for this quarter"** *(Curiosity & Personalization)*
2. **"Unlock 30% higher engagement with your next product update"** *(Direct Value Proposition)*
3. **"Exclusive VIP Invitation: See what's coming next to {{company}}"** *(Urgency & Exclusivity)*
4. **"Simplified email automation for growing teams"** *(Clear & Benefit-Driven)*
5. **"{{firstName}}, here are your personalized recommendations"** *(High Relevance)*

💡 **Pro Tip:** Keep subject lines under 50 characters to ensure full readability on mobile devices!`;
  }

  // Email copy drafting
  if (actionType === 'draft_email' || lower.includes('draft') || lower.includes('write an email') || lower.includes('template')) {
    return `Here is a high-converting email draft designed for high engagement:

### **Subject Line:**
Exciting news for {{company}} — see our latest updates inside!

### **Preview Text:**
Discover how our new features help you save hours every week.

### **Email Body:**
Hi {{firstName}},

I hope your week is off to a great start at {{company}}!

We've just launched several powerful enhancements designed to streamline your daily workflow and boost your campaign deliverability:

- **Intelligent Audience Segmentation:** Target contacts based on tags, groups, and explicit opt-in consent.
- **Smart Auto-Reply Safeguards:** Automatically respond to inquiries with zero risk of duplicate email loops.
- **Real-Time Delivery Telemetry:** Track opens, clicks, and bounces with verified recipient audit trails.

Would you be open to a quick 5-minute overview this Thursday to see how this can benefit {{company}}?

[**Explore New Features Now**](https://mailflow.io/dashboard)

Best regards,  
The MailFlow Team

---
*Placeholder reference: {{firstName}} and {{company}} will automatically be replaced with your contact's actual details upon sending.*`;
  }

  // Tone transformation / improvement
  if (actionType === 'improve_tone' || lower.includes('tone') || lower.includes('rewrite') || lower.includes('improve')) {
    return `Here is your revised email copy optimized for professional warmth, clarity, and higher response rates:

### **Polished Version:**
Hi {{firstName}},

Thank you for being a valued part of our community at {{company}}.

I wanted to quickly check in and ensure you're getting the most out of our latest platform updates. If there is anything we can do to assist your team, please reply directly to this email or book a time that works best for you.

Looking forward to connecting!

Warm regards,  
The MailFlow Team

✨ **Key improvements made:**
- Softened demanding phrasing into an inviting call-to-action.
- Strengthened personalized relevance for {{company}}.
- Maintained concise, scannable paragraphs.`;
  }

  // MailFlow product help
  if (lower.includes('auto-reply') || lower.includes('auto reply')) {
    return `### **Configuring Automatic Replies in MailFlow**

MailFlow's Auto-Reply system allows connected Gmail and Outlook mailboxes to intelligently respond to incoming subscriber messages:

1. **Connect Mailbox:** Go to **Administration > Email Accounts** and authorize your Gmail or Outlook account via OAuth.
2. **Set Rules:** Navigate to **Work > Auto Reply** and click **New Rule**.
3. **Keyword Matching:** Choose matching types like *Contains*, *Exact*, *Starts With*, or *Regular Expression*.
4. **Safety Safeguards:**
   - **Loop Prevention:** Automatically ignores messages sent by your own mailbox or no-reply addresses.
   - **Cooldown:** Enforces sender cooldown periods to prevent rapid repeated responses.
   - **Deduplication:** Guarantees each incoming provider message ID is answered only once.`;
  }

  // Default general assistant response
  return `Hello! I am your **MailFlow AI Assistant**.

I can assist you with:
- ✍️ **Drafting Marketing & Sales Emails:** Tailored copy with personalized placeholders like \`{{firstName}}\` and \`{{company}}\`.
- 🎯 **High-Converting Subject Lines:** Brainstorming catchy, spam-safe subject lines for your campaigns.
- 🔄 **Tone Transformation:** Polishing your existing content to be professional, persuasive, or casual.
- ⚙️ **Platform Guidance:** Helping you configure campaigns, contact groups, scheduling, and auto-reply rules.

How can I help boost your email campaigns today?`;
};

export const aiService = {
  /**
   * Generates AI response using configured external LLM or intelligent local engine
   */
  async generateCompletion({ prompt, conversationHistory = [], actionType = 'general' }) {
    // 1. Check for Google Gemini API Key
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const contents = [
          { role: 'user', parts: [{ text: MAILFLOW_SYSTEM_PROMPT }] },
          ...conversationHistory.map((m) => ({
            role: m.role === CHAT_ROLES.USER ? 'user' : 'model',
            parts: [{ text: m.content }],
          })),
          { role: 'user', parts: [{ text: prompt }] },
        ];

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return reply;
        }
      } catch (err) {
        logger.warn('Gemini API call failed, falling back to local assistant engine.', {
          errorName: err.name,
        });
      }
    }

    // 2. Check for OpenAI-compatible API Key
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const messages = [
          { role: 'system', content: MAILFLOW_SYSTEM_PROMPT },
          ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: prompt },
        ];

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, messages, temperature: 0.7 }),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply) return reply;
        }
      } catch (err) {
        logger.warn('OpenAI API call failed, falling back to local assistant engine.', {
          errorName: err.name,
        });
      }
    }

    // 3. Fallback to built-in MailFlow Intelligent Assistant
    return generateLocalAssistantResponse({ prompt, history: conversationHistory, actionType });
  },

  /**
   * List conversations for user in workspace
   */
  async listConversations({ workspaceId, userId }) {
    if (mongoose.connection.readyState === 1) {
      return await Conversation.find({ workspaceId, userId }).sort({ updatedAt: -1 }).lean();
    } else {
      return Array.from(devConversations.values())
        .filter(
          (c) =>
            c.workspaceId.toString() === workspaceId.toString() &&
            c.userId.toString() === userId.toString()
        )
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
  },

  /**
   * Create new conversation
   */
  async createConversation({ workspaceId, userId, title = 'New Conversation' }) {
    if (mongoose.connection.readyState === 1) {
      const conv = await Conversation.create({ workspaceId, userId, title });
      return conv.toObject();
    } else {
      const id = new mongoose.Types.ObjectId().toString();
      const conv = {
        _id: id,
        workspaceId: workspaceId.toString(),
        userId: userId.toString(),
        title,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devConversations.set(id, conv);
      return conv;
    }
  },

  /**
   * Get conversation with its message history
   */
  async getConversationMessages({ workspaceId, userId, conversationId }) {
    if (mongoose.connection.readyState === 1) {
      const conv = await Conversation.findOne({ _id: conversationId, workspaceId, userId });
      if (!conv) throw new Error('Conversation not found or access denied');

      const messages = await ChatMessage.find({ conversationId, workspaceId }).sort({ createdAt: 1 }).lean();
      return { conversation: conv, messages };
    } else {
      const conv = devConversations.get(conversationId);
      if (
        !conv ||
        conv.workspaceId.toString() !== workspaceId.toString() ||
        conv.userId.toString() !== userId.toString()
      ) {
        throw new Error('Conversation not found or access denied');
      }

      const messages = Array.from(devChatMessages.values())
        .filter((m) => m.conversationId.toString() === conversationId.toString())
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      return { conversation: conv, messages };
    }
  },

  /**
   * Send a message and generate assistant response
   */
  async sendMessage({ workspaceId, userId, conversationId, prompt, actionType = 'general' }) {
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('Message content cannot be empty');
    }

    // Load conversation and existing history
    const { conversation, messages } = await this.getConversationMessages({
      workspaceId,
      userId,
      conversationId,
    });

    // Save user message
    let userMsg;
    if (mongoose.connection.readyState === 1) {
      userMsg = await ChatMessage.create({
        conversationId,
        workspaceId,
        userId,
        role: CHAT_ROLES.USER,
        content: prompt.trim(),
      });
    } else {
      const uId = new mongoose.Types.ObjectId().toString();
      userMsg = {
        _id: uId,
        conversationId,
        workspaceId: workspaceId.toString(),
        userId: userId.toString(),
        role: CHAT_ROLES.USER,
        content: prompt.trim(),
        createdAt: new Date(),
      };
      devChatMessages.set(uId, userMsg);
    }

    // Generate AI response
    const assistantReply = await this.generateCompletion({
      prompt: prompt.trim(),
      conversationHistory: messages,
      actionType,
    });

    // Save assistant response
    let assistantMsg;
    if (mongoose.connection.readyState === 1) {
      assistantMsg = await ChatMessage.create({
        conversationId,
        workspaceId,
        userId,
        role: CHAT_ROLES.ASSISTANT,
        content: assistantReply,
      });

      // Update conversation title if first message
      if (messages.length === 0) {
        const smartTitle = prompt.trim().slice(0, 40) + (prompt.trim().length > 40 ? '...' : '');
        await Conversation.updateOne(
          { _id: conversationId },
          { $set: { title: smartTitle, lastMessageAt: new Date() } }
        );
      } else {
        await Conversation.updateOne({ _id: conversationId }, { $set: { lastMessageAt: new Date() } });
      }
    } else {
      const aId = new mongoose.Types.ObjectId().toString();
      assistantMsg = {
        _id: aId,
        conversationId,
        workspaceId: workspaceId.toString(),
        userId: userId.toString(),
        role: CHAT_ROLES.ASSISTANT,
        content: assistantReply,
        createdAt: new Date(),
      };
      devChatMessages.set(aId, assistantMsg);

      if (messages.length === 0) {
        conversation.title = prompt.trim().slice(0, 40) + (prompt.trim().length > 40 ? '...' : '');
      }
      conversation.updatedAt = new Date();
    }

    return {
      userMessage: userMsg,
      assistantMessage: assistantMsg,
    };
  },

  /**
   * Delete conversation and related messages
   */
  async deleteConversation({ workspaceId, userId, conversationId }) {
    if (mongoose.connection.readyState === 1) {
      const conv = await Conversation.findOneAndDelete({ _id: conversationId, workspaceId, userId });
      if (!conv) throw new Error('Conversation not found');
      await ChatMessage.deleteMany({ conversationId });
      return { success: true };
    } else {
      devConversations.delete(conversationId);
      for (const [k, v] of devChatMessages.entries()) {
        if (v.conversationId === conversationId) {
          devChatMessages.delete(k);
        }
      }
      return { success: true };
    }
  },
};


import mongoose from 'mongoose';
import {
  AutomationRule,
  AUTOMATION_STATUS,
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_ACTION_TYPES,
} from '../models/AutomationRule.js';

// In-memory fallback map for offline/dev test mode
export const devAutomations = new Map();

export const automationService = {
  /**
   * List automations for a workspace
   */
  async listAutomations({ workspaceId, query = {} }) {
    const { page = 1, limit = 20, search = '', status } = query;
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };
      if (status) filter.status = status;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const [automations, total] = await Promise.all([
        AutomationRule.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AutomationRule.countDocuments(filter),
      ]);

      return {
        automations,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } else {
      let list = Array.from(devAutomations.values()).filter(
        (a) => a.workspaceId.toString() === workspaceId.toString()
      );

      if (status) list = list.filter((a) => a.status === status);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.description && a.description.toLowerCase().includes(q))
        );
      }

      return {
        automations: list.slice(skip, skip + limit),
        pagination: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit) || 1,
        },
      };
    }
  },

  /**
   * Get single automation rule by ID
   */
  async getAutomationById({ workspaceId, automationId }) {
    let automation;
    if (mongoose.connection.readyState === 1) {
      automation = await AutomationRule.findOne({ _id: automationId, workspaceId }).lean();
    } else {
      automation = devAutomations.get(automationId);
      if (automation && automation.workspaceId.toString() !== workspaceId.toString()) {
        automation = null;
      }
    }

    if (!automation) {
      throw new Error('Automation rule not found');
    }
    return automation;
  },

  /**
   * Create automation rule
   */
  async createAutomation({ workspaceId, userId, data }) {
    const record = {
      status: AUTOMATION_STATUS.ACTIVE,
      ...data,
      workspaceId,
      createdBy: userId,
      statistics: {
        totalExecuted: 0,
        successful: 0,
        failed: 0,
        lastExecutedAt: null,
      },
      executionHistory: [],
    };

    if (mongoose.connection.readyState === 1) {
      const automation = new AutomationRule(record);
      await automation.save();
      return automation.toObject();
    } else {
      const id = new mongoose.Types.ObjectId().toString();
      const automation = { _id: id, ...record, createdAt: new Date(), updatedAt: new Date() };
      devAutomations.set(id, automation);
      return automation;
    }
  },

  /**
   * Update automation rule
   */
  async updateAutomation({ workspaceId, automationId, data }) {
    if (mongoose.connection.readyState === 1) {
      const automation = await AutomationRule.findOneAndUpdate(
        { _id: automationId, workspaceId },
        { $set: data },
        { new: true, runValidators: true }
      ).lean();

      if (!automation) throw new Error('Automation rule not found');
      return automation;
    } else {
      const automation = devAutomations.get(automationId);
      if (!automation || automation.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Automation rule not found');
      }

      const updated = {
        ...automation,
        ...data,
        trigger: { ...automation.trigger, ...(data.trigger || {}) },
        action: { ...automation.action, ...(data.action || {}) },
        updatedAt: new Date(),
      };
      devAutomations.set(automationId, updated);
      return updated;
    }
  },

  /**
   * Delete automation rule
   */
  async deleteAutomation({ workspaceId, automationId }) {
    if (mongoose.connection.readyState === 1) {
      const result = await AutomationRule.findOneAndDelete({ _id: automationId, workspaceId });
      if (!result) throw new Error('Automation rule not found');
      return { success: true, message: 'Automation deleted successfully' };
    } else {
      const automation = devAutomations.get(automationId);
      if (!automation || automation.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Automation rule not found');
      }
      devAutomations.delete(automationId);
      return { success: true, message: 'Automation deleted successfully' };
    }
  },

  /**
   * Toggle status between ACTIVE and INACTIVE
   */
  async toggleStatus({ workspaceId, automationId }) {
    let automation;
    if (mongoose.connection.readyState === 1) {
      automation = await AutomationRule.findOne({ _id: automationId, workspaceId });
      if (!automation) throw new Error('Automation rule not found');
      automation.status =
        automation.status === AUTOMATION_STATUS.ACTIVE
          ? AUTOMATION_STATUS.INACTIVE
          : AUTOMATION_STATUS.ACTIVE;
      await automation.save();
      return automation.toObject();
    } else {
      automation = devAutomations.get(automationId);
      if (!automation || automation.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Automation rule not found');
      }
      automation.status =
        automation.status === AUTOMATION_STATUS.ACTIVE
          ? AUTOMATION_STATUS.INACTIVE
          : AUTOMATION_STATUS.ACTIVE;
      automation.updatedAt = new Date();
      devAutomations.set(automationId, automation);
      return automation;
    }
  },

  /**
   * Get execution logs for an automation rule
   */
  async getExecutionLogs({ workspaceId, automationId }) {
    const automation = await this.getAutomationById({ workspaceId, automationId });
    return automation.executionHistory || [];
  },
};


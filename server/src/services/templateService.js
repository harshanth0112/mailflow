import mongoose from 'mongoose';
import { EmailTemplate } from '../models/EmailTemplate.js';

export const devEmailTemplates = new Map();

const belongsToWorkspace = (template, workspaceId) =>
  template.workspaceId.toString() === workspaceId.toString();

export const templateService = {
  async list({ workspaceId, query }) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;
    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };
      if (search) {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.name = { $regex: escapedSearch, $options: 'i' };
      }
      const [templates, total] = await Promise.all([
        EmailTemplate.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
        EmailTemplate.countDocuments(filter),
      ]);
      return {
        templates,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
      };
    }

    let templates = Array.from(devEmailTemplates.values()).filter((item) =>
      belongsToWorkspace(item, workspaceId)
    );
    if (search) {
      const term = search.toLowerCase();
      templates = templates.filter((item) => item.name.toLowerCase().includes(term));
    }
    templates.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return {
      templates: templates.slice(skip, skip + limit),
      pagination: { total: templates.length, page, limit, totalPages: Math.ceil(templates.length / limit) || 1 },
    };
  },

  async create({ workspaceId, userId, data }) {
    const record = { ...data, workspaceId, createdBy: userId };
    if (mongoose.connection.readyState === 1) {
      const template = await EmailTemplate.create(record);
      return template.toObject();
    }
    const id = new mongoose.Types.ObjectId().toString();
    const template = { _id: id, ...record, createdAt: new Date(), updatedAt: new Date() };
    devEmailTemplates.set(id, template);
    return template;
  },

  async update({ workspaceId, templateId, data }) {
    if (mongoose.connection.readyState === 1) {
      const template = await EmailTemplate.findOneAndUpdate(
        { _id: templateId, workspaceId },
        { $set: data },
        { new: true, runValidators: true }
      ).lean();
      if (!template) throw new Error('Email template not found');
      return template;
    }
    const template = devEmailTemplates.get(templateId);
    if (!template || !belongsToWorkspace(template, workspaceId)) {
      throw new Error('Email template not found');
    }
    const updated = { ...template, ...data, updatedAt: new Date() };
    devEmailTemplates.set(templateId, updated);
    return updated;
  },

  async delete({ workspaceId, templateId }) {
    if (mongoose.connection.readyState === 1) {
      const template = await EmailTemplate.findOneAndDelete({ _id: templateId, workspaceId });
      if (!template) throw new Error('Email template not found');
      return;
    }
    const template = devEmailTemplates.get(templateId);
    if (!template || !belongsToWorkspace(template, workspaceId)) {
      throw new Error('Email template not found');
    }
    devEmailTemplates.delete(templateId);
  },
};

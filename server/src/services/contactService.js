import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { Contact, CONSENT_STATUS, CONTACT_STATUS, CONTACT_SOURCES } from '../models/Contact.js';
import { ContactGroup } from '../models/ContactGroup.js';
import { parseUploadedSpreadsheet, isValidEmail, sanitizeCell } from '../utils/spreadsheetUtils.js';

// In-memory fallback map for offline test/dev environments
export const devContacts = new Map();
export const devContactGroups = new Map();

export const contactService = {
  /**
   * List contacts with filtering, searching, sorting and pagination
   */
  async listContacts({ workspaceId, query }) {
    const {
      page = 1,
      limit = 20,
      search = '',
      status,
      consentStatus,
      tag,
      groupId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };

      if (status) filter.status = status;
      if (consentStatus) filter.consentStatus = consentStatus;
      if (tag) filter.tags = tag;
      if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
        filter.groups = groupId;
      }

      if (search && search.trim() !== '') {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { email: regex },
          { firstName: regex },
          { lastName: regex },
          { company: regex },
          { jobTitle: regex },
          { tags: regex },
        ];
      }

      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      const [contacts, total] = await Promise.all([
        Contact.find(filter)
          .populate('groups', 'name')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Contact.countDocuments(filter),
      ]);

      return {
        contacts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } else {
      // In-memory mock
      let list = Array.from(devContacts.values()).filter(
        (c) => c.workspaceId.toString() === workspaceId.toString()
      );

      if (status) list = list.filter((c) => c.status === status);
      if (consentStatus) list = list.filter((c) => c.consentStatus === consentStatus);
      if (tag) list = list.filter((c) => (c.tags || []).includes(tag));
      if (groupId) list = list.filter((c) => (c.groups || []).map(g => g.toString()).includes(groupId));

      if (search) {
        const s = search.toLowerCase();
        list = list.filter(
          (c) =>
            (c.email && c.email.toLowerCase().includes(s)) ||
            (c.firstName && c.firstName.toLowerCase().includes(s)) ||
            (c.lastName && c.lastName.toLowerCase().includes(s)) ||
            (c.company && c.company.toLowerCase().includes(s))
        );
      }

      list.sort((a, b) => {
        const valA = a[sortBy] || '';
        const valB = b[sortBy] || '';
        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });

      const total = list.length;
      const contacts = list.slice(skip, skip + limit);

      return {
        contacts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }
  },

  /**
   * Get contact count for dashboard
   */
  async getContactCount(workspaceId) {
    if (mongoose.connection.readyState === 1) {
      return await Contact.countDocuments({ workspaceId });
    }
    return Array.from(devContacts.values()).filter(
      (c) => c.workspaceId.toString() === workspaceId.toString()
    ).length;
  },

  /**
   * Create a single contact
   */
  async createContact({ workspaceId, userId, data }) {
    const normalizedEmail = data.email.trim().toLowerCase();

    if (mongoose.connection.readyState === 1) {
      // Check for duplicate within workspace
      const existing = await Contact.findOne({ workspaceId, email: normalizedEmail });
      if (existing) {
        throw new Error(`A contact with email "${normalizedEmail}" already exists in this workspace.`);
      }

      const contactData = {
        ...data,
        email: normalizedEmail,
        workspaceId,
        createdBy: userId,
        consentHistory: [
          {
            status: data.consentStatus || CONSENT_STATUS.PENDING,
            source: data.source || CONTACT_SOURCES.MANUAL,
            note: 'Initial contact creation',
            timestamp: new Date(),
          },
        ],
      };

      if (data.status === CONTACT_STATUS.SUBSCRIBED) {
        contactData.subscribedAt = new Date();
      }

      const contact = new Contact(contactData);
      await contact.save();
      return contact.populate('groups', 'name');
    } else {
      const existing = Array.from(devContacts.values()).find(
        (c) => c.workspaceId.toString() === workspaceId.toString() && c.email === normalizedEmail
      );
      if (existing) {
        throw new Error(`A contact with email "${normalizedEmail}" already exists in this workspace.`);
      }

      const id = new mongoose.Types.ObjectId().toString();
      const contact = {
        _id: id,
        ...data,
        email: normalizedEmail,
        workspaceId,
        createdBy: userId,
        subscribedAt: data.status === CONTACT_STATUS.SUBSCRIBED ? new Date() : null,
        unsubscribedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devContacts.set(id, contact);
      return contact;
    }
  },

  /**
   * Get contact by ID
   */
  async getContactById({ workspaceId, contactId }) {
    if (mongoose.connection.readyState === 1) {
      return await Contact.findOne({ _id: contactId, workspaceId }).populate('groups', 'name');
    }
    const c = devContacts.get(contactId);
    if (c && c.workspaceId.toString() === workspaceId.toString()) {
      return c;
    }
    return null;
  },

  /**
   * Update contact
   */
  async updateContact({ workspaceId, contactId, data }) {
    if (data.email) {
      data.email = data.email.trim().toLowerCase();
    }

    if (mongoose.connection.readyState === 1) {
      const contact = await Contact.findOne({ _id: contactId, workspaceId });
      if (!contact) {
        throw new Error('Contact not found in this workspace.');
      }

      if (data.email && data.email !== contact.email) {
        const existing = await Contact.findOne({ workspaceId, email: data.email });
        if (existing) {
          throw new Error(`A contact with email "${data.email}" already exists in this workspace.`);
        }
      }

      // Handle subscription status transitions
      if (data.status && data.status !== contact.status) {
        if (data.status === CONTACT_STATUS.UNSUBSCRIBED) {
          data.unsubscribedAt = new Date();
        } else if (data.status === CONTACT_STATUS.SUBSCRIBED) {
          data.subscribedAt = new Date();
          data.unsubscribedAt = null;
        }
      }

      // Handle consent status updates
      if (data.consentStatus && data.consentStatus !== contact.consentStatus) {
        contact.consentHistory.push({
          status: data.consentStatus,
          source: 'manual',
          note: 'Status updated via dashboard',
          timestamp: new Date(),
        });
      }

      Object.assign(contact, data);
      await contact.save();
      return contact.populate('groups', 'name');
    } else {
      const contact = devContacts.get(contactId);
      if (!contact || contact.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Contact not found in this workspace.');
      }
      Object.assign(contact, data, { updatedAt: new Date() });
      devContacts.set(contactId, contact);
      return contact;
    }
  },

  /**
   * Delete contact
   */
  async deleteContact({ workspaceId, contactId }) {
    if (mongoose.connection.readyState === 1) {
      const res = await Contact.findOneAndDelete({ _id: contactId, workspaceId });
      if (!res) throw new Error('Contact not found in this workspace.');
      return res;
    }
    const contact = devContacts.get(contactId);
    if (!contact || contact.workspaceId.toString() !== workspaceId.toString()) {
      throw new Error('Contact not found in this workspace.');
    }
    devContacts.delete(contactId);
    return contact;
  },

  /**
   * Unsubscribe a contact (explicit unsubscribe management)
   */
  async unsubscribeContact({ workspaceId, contactId, reason = 'Direct user request' }) {
    return this.updateContact({
      workspaceId,
      contactId,
      data: {
        status: CONTACT_STATUS.UNSUBSCRIBED,
        consentStatus: CONSENT_STATUS.OPTED_OUT,
      },
    });
  },

  /**
   * Group operations
   */
  async listGroups(workspaceId) {
    if (mongoose.connection.readyState === 1) {
      const groups = await ContactGroup.find({ workspaceId }).sort({ name: 1 }).lean();
      // Count contacts per group
      const groupsWithCounts = await Promise.all(
        groups.map(async (grp) => {
          const count = await Contact.countDocuments({ workspaceId, groups: grp._id });
          return { ...grp, contactCount: count };
        })
      );
      return groupsWithCounts;
    }
    return Array.from(devContactGroups.values()).filter(
      (g) => g.workspaceId.toString() === workspaceId.toString()
    );
  },

  async createGroup({ workspaceId, userId, data }) {
    const trimmedName = data.name.trim();

    if (mongoose.connection.readyState === 1) {
      const existing = await ContactGroup.findOne({
        workspaceId,
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });
      if (existing) {
        throw new Error(`Group with name "${data.name}" already exists in this workspace.`);
      }

      const group = new ContactGroup({
        workspaceId,
        createdBy: userId,
        name: trimmedName,
        description: data.description || '',
      });
      await group.save();
      return group;
    } else {
      const existing = Array.from(devContactGroups.values()).find(
        (g) =>
          g.workspaceId.toString() === workspaceId.toString() &&
          g.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (existing) {
        throw new Error(`Group with name "${data.name}" already exists in this workspace.`);
      }

      const id = new mongoose.Types.ObjectId().toString();
      const group = {
        _id: id,
        workspaceId,
        createdBy: userId,
        name: trimmedName,
        description: data.description || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devContactGroups.set(id, group);
      return group;
    }
  },

  async updateGroup({ workspaceId, groupId, data }) {
    if (mongoose.connection.readyState === 1) {
      const group = await ContactGroup.findOne({ _id: groupId, workspaceId });
      if (!group) throw new Error('Group not found in this workspace.');

      if (data.name && data.name.trim() !== group.name) {
        const existing = await ContactGroup.findOne({
          workspaceId,
          _id: { $ne: groupId },
          name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
        });
        if (existing) {
          throw new Error(`Group with name "${data.name}" already exists.`);
        }
        group.name = data.name.trim();
      }

      if (data.description !== undefined) {
        group.description = data.description;
      }

      await group.save();
      return group;
    } else {
      const group = devContactGroups.get(groupId);
      if (!group || group.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Group not found in this workspace.');
      }
      if (data.name) group.name = data.name.trim();
      if (data.description !== undefined) group.description = data.description;
      devContactGroups.set(groupId, group);
      return group;
    }
  },

  async deleteGroup({ workspaceId, groupId }) {
    if (mongoose.connection.readyState === 1) {
      const group = await ContactGroup.findOneAndDelete({ _id: groupId, workspaceId });
      if (!group) throw new Error('Group not found in this workspace.');

      // Pull group from all contacts in workspace to maintain referential integrity
      await Contact.updateMany(
        { workspaceId, groups: groupId },
        { $pull: { groups: groupId } }
      );

      return group;
    } else {
      const group = devContactGroups.get(groupId);
      if (!group || group.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Group not found in this workspace.');
      }
      devContactGroups.delete(groupId);
      return group;
    }
  },

  /**
   * Bulk assign/remove groups
   */
  async assignGroups({ workspaceId, contactIds, groupIds, action = 'add' }) {
    if (mongoose.connection.readyState === 1) {
      const updateOp = action === 'add'
        ? { $addToSet: { groups: { $each: groupIds } } }
        : { $pull: { groups: { $in: groupIds } } };

      const res = await Contact.updateMany(
        { workspaceId, _id: { $in: contactIds } },
        updateOp
      );
      return res;
    }
  },

  /**
   * Bulk manage tags
   */
  async manageTags({ workspaceId, contactIds, tags, action = 'add' }) {
    if (mongoose.connection.readyState === 1) {
      const updateOp = action === 'add'
        ? { $addToSet: { tags: { $each: tags } } }
        : { $pull: { tags: { $in: tags } } };

      const res = await Contact.updateMany(
        { workspaceId, _id: { $in: contactIds } },
        updateOp
      );
      return res;
    }
  },

  /**
   * Preview an uploaded CSV/Excel spreadsheet
   */
  async previewImport({ buffer, originalName }) {
    const rawRows = await parseUploadedSpreadsheet(buffer, originalName);
    if (!rawRows || rawRows.length === 0) {
      throw new Error('The uploaded file contains no data or could not be read.');
    }

    // Inspect columns from first 10 rows
    const columns = new Set();
    rawRows.slice(0, 10).forEach((row) => {
      Object.keys(row).forEach((col) => columns.add(col));
    });

    const headers = Array.from(columns);

    // Provide default intelligent field mapping suggestions
    const suggestedMapping = {};
    headers.forEach((h) => {
      const lower = h.toLowerCase().trim();
      if (lower.includes('email') || lower === 'mail') suggestedMapping[h] = 'email';
      else if (lower.includes('first') || lower === 'fname') suggestedMapping[h] = 'firstName';
      else if (lower.includes('last') || lower === 'lname') suggestedMapping[h] = 'lastName';
      else if (lower.includes('phone') || lower.includes('mobile')) suggestedMapping[h] = 'phone';
      else if (lower.includes('company') || lower.includes('org')) suggestedMapping[h] = 'company';
      else if (lower.includes('job') || lower.includes('title') || lower.includes('position')) suggestedMapping[h] = 'jobTitle';
      else if (lower.includes('tag')) suggestedMapping[h] = 'tags';
    });

    return {
      headers,
      suggestedMapping,
      totalRows: rawRows.length,
      sampleRows: rawRows.slice(0, 5),
    };
  },

  /**
   * Execute Contact Import from parsed rows with mapping
   */
  async executeImport({ workspaceId, userId, buffer, originalName, mapping = {}, defaultTags = [], defaultGroups = [], updateExisting = false }) {
    const rawRows = await parseUploadedSpreadsheet(buffer, originalName);

    const summary = {
      total: rawRows.length,
      imported: 0,
      updated: 0,
      skippedDuplicates: 0,
      invalid: 0,
      errors: [],
    };

    // Preload existing emails in workspace for fast duplicate detection
    let existingEmailMap = new Map();
    if (mongoose.connection.readyState === 1) {
      const existing = await Contact.find({ workspaceId }).select('_id email').lean();
      existing.forEach((c) => existingEmailMap.set(c.email, c._id));
    } else {
      Array.from(devContacts.values())
        .filter((c) => c.workspaceId.toString() === workspaceId.toString())
        .forEach((c) => existingEmailMap.set(c.email, c._id));
    }

    const seenInFile = new Set();
    const contactsToInsert = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // spreadsheet 1-indexed header + 1

      // Extract fields according to mapping
      let email = '';
      let firstName = '';
      let lastName = '';
      let phone = '';
      let company = '';
      let jobTitle = '';
      let tags = [...defaultTags];

      for (const [colName, targetField] of Object.entries(mapping)) {
        const val = row[colName];
        if (val === undefined || val === null) continue;
        const strVal = String(val).trim();

        if (targetField === 'email') email = strVal.toLowerCase();
        else if (targetField === 'firstName') firstName = strVal;
        else if (targetField === 'lastName') lastName = strVal;
        else if (targetField === 'phone') phone = strVal;
        else if (targetField === 'company') company = strVal;
        else if (targetField === 'jobTitle') jobTitle = strVal;
        else if (targetField === 'tags') {
          strVal.split(/[,;|]/).map((t) => t.trim()).filter(Boolean).forEach((t) => tags.push(t));
        }
      }

      // Validate email format
      if (!isValidEmail(email)) {
        summary.invalid++;
        summary.errors.push({ row: rowNum, error: `Invalid or missing email address: "${email}"` });
        continue;
      }

      // Check duplicates within the file itself
      if (seenInFile.has(email)) {
        summary.skippedDuplicates++;
        summary.errors.push({ row: rowNum, error: `Duplicate email within file: "${email}"` });
        continue;
      }
      seenInFile.add(email);

      // Check duplicate within the workspace
      if (existingEmailMap.has(email)) {
        if (updateExisting && mongoose.connection.readyState === 1) {
          const contactId = existingEmailMap.get(email);
          await Contact.updateOne(
            { _id: contactId, workspaceId },
            {
              $set: {
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                phone: phone || undefined,
                company: company || undefined,
                jobTitle: jobTitle || undefined,
              },
              $addToSet: {
                tags: { $each: tags },
                groups: { $each: defaultGroups },
              },
            }
          );
          summary.updated++;
        } else {
          summary.skippedDuplicates++;
          summary.errors.push({ row: rowNum, error: `Contact with email "${email}" already exists in workspace` });
        }
        continue;
      }

      // Note: Importing an email does NOT constitute verified consent.
      // We mark consentStatus as IMPORTED_UNCONFIRMED to enforce anti-spam compliance!
      contactsToInsert.push({
        workspaceId,
        createdBy: userId,
        email,
        firstName,
        lastName,
        phone,
        company,
        jobTitle,
        tags: Array.from(new Set(tags)),
        groups: defaultGroups,
        source: CONTACT_SOURCES.IMPORT,
        consentStatus: CONSENT_STATUS.IMPORTED_UNCONFIRMED,
        status: CONTACT_STATUS.SUBSCRIBED,
        subscribedAt: new Date(),
        consentHistory: [
          {
            status: CONSENT_STATUS.IMPORTED_UNCONFIRMED,
            source: 'import',
            note: `Imported from file: ${originalName}`,
            timestamp: new Date(),
          },
        ],
      });
    }

    if (contactsToInsert.length > 0) {
      if (mongoose.connection.readyState === 1) {
        await Contact.insertMany(contactsToInsert, { ordered: false });
      } else {
        contactsToInsert.forEach((c) => {
          const id = new mongoose.Types.ObjectId().toString();
          devContacts.set(id, { _id: id, ...c, createdAt: new Date(), updatedAt: new Date() });
        });
      }
      summary.imported = contactsToInsert.length;
    }

    return summary;
  },

  /**
   * Export contacts to CSV or Excel Buffer
   */
  async exportContacts({ workspaceId, format = 'csv', query = {} }) {
    let contacts = [];

    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };
      if (query.status) filter.status = query.status;
      if (query.consentStatus) filter.consentStatus = query.consentStatus;
      if (query.tag) filter.tags = query.tag;
      if (query.groupId) filter.groups = query.groupId;

      contacts = await Contact.find(filter)
        .populate('groups', 'name')
        .sort({ createdAt: -1 })
        .lean();
    } else {
      contacts = Array.from(devContacts.values()).filter(
        (c) => c.workspaceId.toString() === workspaceId.toString()
      );
    }

    // Format and sanitize rows to prevent spreadsheet formula injection attacks
    const exportRows = contacts.map((c) => ({
      'Email': sanitizeCell(c.email),
      'First Name': sanitizeCell(c.firstName || ''),
      'Last Name': sanitizeCell(c.lastName || ''),
      'Phone': sanitizeCell(c.phone || ''),
      'Company': sanitizeCell(c.company || ''),
      'Job Title': sanitizeCell(c.jobTitle || ''),
      'Tags': (c.tags || []).join('; '),
      'Groups': (c.groups || []).map((g) => g.name || g).join('; '),
      'Status': c.status,
      'Consent Status': c.consentStatus,
      'Created At': c.createdAt ? new Date(c.createdAt).toISOString() : '',
    }));

    // Build ExcelJS workbook (formula-safe, no xlsx prototype pollution risk)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contacts');

    if (exportRows.length > 0) {
      // Set columns from the first row's keys
      worksheet.columns = Object.keys(exportRows[0]).map((key) => ({
        header: key,
        key,
        width: Math.max(key.length + 2, 18),
      }));
      worksheet.addRows(exportRows);
      // Bold the header row
      worksheet.getRow(1).font = { bold: true };
    }

    if (format === 'xlsx') {
      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `contacts_export_${Date.now()}.xlsx`,
      };
    } else {
      // CSV export — build manually from exportRows to maintain sanitizeCell protection
      const headers = exportRows.length > 0 ? Object.keys(exportRows[0]) : [];
      const csvLines = [
        headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
        ...exportRows.map((row) =>
          headers.map((h) => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
        ),
      ];
      return {
        buffer: Buffer.from(csvLines.join('\r\n'), 'utf-8'),
        contentType: 'text/csv; charset=utf-8',
        filename: `contacts_export_${Date.now()}.csv`,
      };
    }
  },
};

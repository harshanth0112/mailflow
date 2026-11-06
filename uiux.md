# MAILFLOW — FINAL MASTER PRODUCT DEVELOPMENT PROMPT

## 1. Your Role

Act as a senior full-stack SaaS architect, product designer, UI/UX engineer, and experienced MERN-stack developer.

Your task is to build **MailFlow**, a complete, production-ready, multi-user email marketing and automation SaaS platform.

Do not treat this as a simple dashboard or static UI project. Build a cohesive, functional application with a premium user experience, secure backend, real database integration, reliable email workflows, and responsive layouts across all screen sizes.

Think like an experienced product team building a commercial SaaS product.

**Primary objective:** Deliver a polished, secure, scalable, fully responsive email marketing platform with an exceptional frontend and a reliable backend.

---

# 2. Product Vision

**Product name:** MailFlow

**Product category:** Email Marketing, Campaign Management, and Email Automation SaaS.

MailFlow helps users:

- Manage contacts and mailing lists.
- Connect their email accounts.
- Create and send email campaigns.
- Schedule email delivery.
- Automate email replies and workflows.
- Design reusable email templates.
- Track campaign performance.
- Analyze engagement and delivery metrics.
- Use an AI assistant for email-related tasks.
- Manage their entire email marketing workflow from one dashboard.

The platform must support multiple registered users, with each user's data securely isolated from other users.

---

# 3. Mandatory Development Rules

Before writing code:

1. Inspect the existing repository and understand its current architecture.
2. Read and follow the provided MailFlow project requirements document.
3. Review existing components, pages, APIs, database models, routes, and dependencies.
4. Identify what is already implemented and what is missing.
5. Preserve working functionality.
6. Avoid unnecessary rewrites or replacing existing architecture without a clear reason.
7. Create a practical implementation plan.
8. Implement the application incrementally.
9. Connect every functional interface to its actual backend functionality.
10. Test every major feature before considering it complete.

**Important:**

- Do not build a frontend-only prototype.
- Do not use fake buttons or non-functional controls.
- Do not display fabricated analytics, email delivery statuses, or campaign results.
- Do not hardcode data that should come from the database.
- Do not expose API keys, secrets, or sensitive configuration in frontend code.
- Do not compromise existing functionality to implement new features.
- Do not mark incomplete functionality as complete.

If a third-party integration requires credentials, implement its configuration and connection flow properly, and clearly communicate when credentials are required.

---

# 4. Technology Stack

Use the following technology stack unless the existing repository has a justified equivalent implementation.

### Frontend

- React
- Vite
- JavaScript or TypeScript, consistent with the existing project
- Tailwind CSS
- React Router
- Recharts for analytics
- Axios or an existing API client
- Lucide React icons
- A reusable component architecture

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT authentication
- bcrypt password hashing
- REST APIs
- Input validation and sanitization

### Email and Automation

- Nodemailer
- Gmail API or supported OAuth-based integration
- Microsoft Graph integration where applicable
- Redis
- BullMQ for background jobs and scheduled tasks

### AI

- Integrate an AI provider through secure backend APIs.
- Keep provider credentials on the server.
- Support contextual email assistance and content generation.

### Testing

- Vitest
- React Testing Library
- Playwright
- Backend API and integration tests

### Deployment

- Frontend: Vercel or equivalent
- Backend: Render or equivalent
- Database: MongoDB Atlas
- Redis: supported hosted Redis service

Keep configuration environment-based and deployment-ready.

---

# 5. Design System and Visual Direction

Create a premium, editorial-inspired visual identity for MailFlow.

The design should feel modern, sophisticated, calm, professional, and distinctive.

Avoid generic SaaS dashboard templates.

### Color palette

Use the following palette consistently:

| Purpose | Color |
|---|---|
| Main background | `#F7F6F2` |
| Primary surface | `#FFFFFF` |
| Primary text | `#191919` |
| Secondary text | `#77736D` |
| Accent red | `#EF493C` |
| Dark section | `#241A12` |
| Borders | `#E5E1D9` |
| Success | `#25845A` |
| Warning | `#D58A24` |
| Error | `#C9473D` |

Use the accent red selectively for important actions, highlights, and selected interface elements.

Do not overuse bright colors.

### Typography

Use:

- **Anton:** Large editorial display headings.
- **Inter:** Body text, interface labels, navigation, forms, and dashboard content.
- **Martian Mono:** Small technical labels, metadata, timestamps, and section indicators.

Typography must remain readable and responsive at every viewport.

### Design principles

- Generous whitespace.
- Strong visual hierarchy.
- Carefully controlled typography.
- Consistent spacing.
- Subtle borders.
- Refined shadows.
- Soft surface contrast.
- Clear interaction states.
- Consistent corner radii.
- Intentional motion and transitions.
- Accessible color contrast.

Use a consistent design token system rather than scattered CSS values.

---

# 6. Public Marketing Website

Create a visually memorable public landing page for MailFlow.

The landing page should communicate the product's value through an editorial, scroll-driven visual experience.

### Landing page structure

**Section 1 — Hero**

- MailFlow brand identity.
- Strong editorial headline.
- Short product description.
- Primary CTA: Get Started.
- Secondary CTA: Explore Features.
- Distinctive visual composition representing email communication and automation.

**Section 2 — Contact Management**

- Showcase contact organization.
- Demonstrate groups, segments, and list management.
- Use meaningful visual storytelling.

**Section 3 — Campaign Creation**

- Introduce the email campaign composer.
- Show reusable templates and campaign creation.
- Highlight the ease of designing professional emails.

**Section 4 — Automation**

- Explain scheduled campaigns and automated replies.
- Show a visual representation of an automation workflow.
- Emphasize efficiency and reliability.

**Section 5 — Analytics and Results**

- Present campaign analytics.
- Demonstrate engagement tracking and performance insights.
- Use a polished visual data presentation.

**Final CTA**

- Strong conversion-focused closing section.
- Get Started CTA.
- Login link.
- Footer with product links, documentation, privacy, and terms.

### Landing page motion direction

Use cinematic, scroll-driven storytelling inspired by premium editorial websites.

Where appropriate:

- Pinned scroll sections.
- Carefully choreographed transitions.
- Per-word heading reveals.
- Subtle parallax.
- Canvas-based illustrations.
- Progressive visual transformations.
- Smooth section transitions.

Keep motion purposeful and lightweight.

Do not let scroll choreography interfere with navigation, accessibility, mobile scrolling, or page performance.

On mobile, simplify or remove complex pinned animations where necessary.

Respect `prefers-reduced-motion`.

**Important:** The public landing page can use creative scroll storytelling. The actual application dashboard must prioritize usability and productivity rather than excessive animation.

---

# 7. Authentication and Account Management

Implement complete authentication functionality.

### Registration

- Name.
- Email.
- Password.
- Confirm password.
- Form validation.
- Password strength feedback.
- Terms acceptance.
- Email verification.

### Login

- Email and password.
- Remember-me option where appropriate.
- Forgot password.
- Clear error messages.
- Secure session handling.

### Additional authentication features

- Email verification.
- Password reset.
- JWT-based authentication.
- Secure logout.
- Protected application routes.
- Authentication state persistence.
- OAuth integration where supported.

Security requirements:

- Hash passwords with bcrypt.
- Validate all inputs.
- Apply authentication middleware.
- Protect sensitive endpoints.
- Avoid exposing passwords or tokens in logs.
- Use secure cookie settings where cookie-based authentication is implemented.
- Configure appropriate CORS and security headers.

---

# 8. New User Onboarding

Create a guided onboarding experience after registration.

The onboarding should introduce the platform without overwhelming new users.

Include:

- Welcome screen.
- User or business profile setup.
- Email provider connection.
- Contact import guidance.
- First campaign guidance.
- Dashboard introduction.
- Interactive tutorial.

Provide a way to skip optional steps and resume onboarding later.

Store onboarding progress for each user.

---

# 9. Main Application Dashboard

Create a premium dashboard with a clear information hierarchy.

### Dashboard layout

- Responsive sidebar.
- Top navigation.
- Main content area.
- User profile menu.
- Notifications.
- Search where relevant.
- Responsive mobile navigation.

### Dashboard overview

Display real database-backed information such as:

- Total contacts.
- Active campaigns.
- Emails sent.
- Delivery status.
- Open rate.
- Click rate.
- Recent activity.
- Upcoming scheduled campaigns.
- Campaign performance.

Use Recharts for appropriate visualizations.

Charts must use actual available data and display helpful empty states when there is insufficient data.

Do not invent metrics.

### Dashboard experience

- Clear navigation.
- Consistent cards.
- Useful filters.
- Meaningful loading states.
- Helpful empty states.
- Responsive charts.
- Actionable quick actions.

---

# 10. Contact Management

Build a complete contact management system.

### Features

- Create contacts.
- Edit contacts.
- Delete contacts.
- Search contacts.
- Filter contacts.
- Sort contacts.
- View contact details.
- Import contacts using CSV.
- Export contacts using CSV.
- Bulk actions.
- Contact groups.
- Contact tags.
- Segments.
- Duplicate detection.
- Contact activity history.
- Unsubscribe management.

### Contact data

Support relevant fields such as:

- Name.
- Email.
- Phone.
- Company.
- Tags.
- Groups.
- Custom fields.
- Subscription status.
- Creation date.

### Important requirements

- Validate email addresses.
- Handle duplicate records.
- Provide import previews and error reporting.
- Support pagination.
- Respect unsubscribe status.
- Prevent unauthorized contact access.

---

# 11. Email Account Integration

Allow users to connect supported email providers.

### Provider support

- Gmail.
- Microsoft Outlook / Microsoft 365.
- Other supported SMTP configurations where appropriate.

### Features

- Connect email account.
- OAuth authorization.
- Connection status.
- Account information.
- Reconnect expired authorization.
- Disconnect account.
- Test connection.
- Secure credential handling.

Never expose access tokens or refresh tokens to the frontend.

Use provider APIs and their current permission requirements.

Do not assume a personal Gmail SMTP account is unrestricted bulk-marketing infrastructure.

Respect provider sending limits, anti-abuse rules, consent requirements, and rate limits.

Clearly distinguish between an email account being connected and a campaign actually being sent.

---

# 12. Email Campaign Composer

Build a professional email campaign creation experience.

### Campaign setup

- Campaign name.
- Sender name.
- Sender email.
- Reply-to address.
- Subject line.
- Preview text.
- Recipient selection.
- Contact groups.
- Segments.

### Email editor

- Rich-text editing.
- HTML email support.
- Text formatting.
- Images.
- Links.
- Buttons.
- Layout sections.
- Reusable blocks.
- Email preview.
- Responsive email layout.

### Additional features

- Save as draft.
- Preview email.
- Send test email.
- Schedule campaign.
- Send campaign.
- Confirmation before sending.
- Validation before sending.

Provide desktop and mobile email previews.

Ensure generated HTML emails are compatible with common email clients as far as reasonably possible.

---

# 13. Campaign Management

Create a dedicated campaign management module.

### Campaign statuses

- Draft.
- Scheduled.
- Queued.
- Sending.
- Sent.
- Failed.
- Cancelled.

### Features

- Campaign list.
- Campaign details.
- Search and filtering.
- Duplicate campaign.
- Edit draft.
- Cancel scheduled campaign.
- View delivery results.
- View errors.
- View campaign activity.

Use real campaign states from the backend.

Do not show a campaign as sent until the sending process has actually completed successfully.

---

# 14. Campaign Scheduling and Background Jobs

Implement reliable background processing.

### Features

- Schedule campaigns.
- Select date and time.
- Respect user timezone.
- Queue campaign jobs.
- Process jobs using BullMQ.
- Track job progress.
- Retry eligible failures.
- Cancel pending jobs.
- Record sending results.

Use Redis for background job processing.

Ensure scheduled campaigns are not sent twice due to retries, server restarts, or duplicate job execution.

Implement appropriate idempotency and job-state handling.

Provide clear scheduling and delivery status in the frontend.

---

# 15. Automated Replies and Email Workflows

Create an automation module for email workflows.

### Features

- Create auto-reply rules.
- Define triggers.
- Configure conditions.
- Create response templates.
- Enable or disable rules.
- Edit and delete rules.
- View execution history.

Possible automation examples:

- Welcome email after a contact subscribes.
- Automatic response to an incoming message.
- Follow-up email after a defined interval.
- Campaign-related notifications.

Clearly distinguish implemented triggers from planned or unsupported triggers.

Avoid pretending that incoming email events are supported unless the relevant provider webhook, polling, or API integration has been implemented.

---

# 16. Email Templates

Build a reusable template management system.

### Features

- Template gallery.
- Create template.
- Edit template.
- Delete template.
- Duplicate template.
- Preview template.
- Save campaign as template.
- Use template in campaign.

Organize templates by useful categories.

Create polished default templates for:

- Welcome emails.
- Newsletters.
- Announcements.
- Promotions.
- Event invitations.
- Follow-ups.

Ensure templates render responsively in common email clients.

---

# 17. Analytics and Reporting

Build a dedicated analytics section.

### Metrics

Where supported by the connected provider or tracking implementation, display:

- Emails attempted.
- Emails accepted or delivered.
- Bounces.
- Opens.
- Clicks.
- Unsubscribes.
- Failed sends.
- Campaign performance.

### Analytics interface

- Date range selector.
- Campaign filters.
- Summary cards.
- Line charts.
- Bar charts.
- Performance comparisons.
- Campaign-level reports.
- Exportable reports where appropriate.

Use Recharts.

Clearly distinguish actual provider delivery data from tracked engagement data.

Explain tracking limitations when opens or clicks cannot be reliably measured.

Do not fabricate analytics or represent unavailable metrics as measured results.

---

# 18. AI Email Assistant

Build an AI-powered assistant for email-related tasks.

### Capabilities

- Generate email drafts.
- Improve existing email content.
- Suggest subject lines.
- Rewrite content in different tones.
- Generate campaign ideas.
- Suggest email templates.
- Summarize campaign analytics.
- Help users understand platform features.

### Interface

- Conversational chat interface.
- Clear message history.
- Loading states.
- Error handling.
- Copy response.
- Insert generated content into the composer.

The AI assistant must use secure backend API integration.

Never expose AI API credentials in the browser.

Provide useful error messages when the AI service is unavailable.

---

# 19. Notifications and Activity Logs

Implement a notification system.

### Notifications

- Campaign scheduled.
- Campaign completed.
- Campaign failed.
- Email account disconnected.
- Contact import completed.
- Automation errors.
- Important account notifications.

### Activity logs

Record relevant actions such as:

- Contact created.
- Contact updated.
- Campaign created.
- Campaign scheduled.
- Campaign sent.
- Template updated.
- Email account connected.

Display useful timestamps and relevant activity details.

Keep user activity private to the correct account.

---

# 20. Settings and Profile Management

Create a complete settings area.

### Profile settings

- Name.
- Profile information.
- Email.
- Password changes.
- Account preferences.

### Email settings

- Connected accounts.
- Sender identity.
- Default reply-to address.
- Email preferences.

### Application settings

- Timezone.
- Notification preferences.
- Theme preference where supported.
- Account management.

Provide clear validation and confirmation before destructive actions.

---

# 21. Admin Dashboard

Implement an admin area with role-based authorization.

### Admin capabilities

- View platform statistics.
- Manage users.
- View account status.
- Review platform activity.
- Manage appropriate administrative settings.
- Monitor campaign processing and system health.

Restrict admin functionality to authorized admin accounts.

Do not expose one user's private contact lists, email contents, or credentials to another user or an administrator without a properly defined and authorized operational requirement.

---

# 22. Database Design and Multi-User Isolation

Use MongoDB and Mongoose.

Create appropriate models for:

- User.
- Contact.
- ContactGroup.
- ContactSegment.
- EmailAccount.
- Campaign.
- EmailTemplate.
- AutomationRule.
- ScheduledJob or campaign job metadata.
- Notification.
- ActivityLog.
- EmailEvent.
- Subscription or plan data if required.

### Data isolation requirements

Every user-owned record must be associated with the correct user.

- Scope queries by authenticated user ID.
- Validate ownership before updating or deleting records.
- Prevent cross-user access through API parameters.
- Apply role-based access controls.
- Protect admin routes.
- Add appropriate database indexes.
- Handle duplicate records and concurrency.
- Use transactions where appropriate.

Treat multi-user isolation as a critical security requirement, not an optional enhancement.

---

# 23. API Architecture

Organize backend code into maintainable modules.

Recommended structure:

- Routes.
- Controllers.
- Models.
- Services.
- Middleware.
- Validators.
- Utilities.
- Background workers.
- Configuration.

Implement consistent API response formats.

Include:

- Authentication middleware.
- Authorization middleware.
- Validation middleware.
- Centralized error handling.
- Request logging.
- Rate limiting.
- Secure configuration.
- Pagination.
- Filtering.
- Search.

Keep business logic out of route files where possible.

Use appropriate HTTP status codes.

Document important API endpoints.

---

# 24. Responsive Design — Mandatory for Every Screen Size

**This is a strict requirement. The entire application must work properly on mobile, tablet, laptop, desktop, and large desktop screens.**

Do not design only for a desktop screenshot and then shrink the interface for mobile.

Build responsive layouts from the beginning.

### Required viewport ranges

| Device | Width |
|---|---|
| Small mobile | 320–359px |
| Standard mobile | 360–389px |
| Large mobile | 390–767px |
| Tablet | 768–1023px |
| Small laptop | 1024–1279px |
| Standard desktop | 1280–1439px |
| Large desktop | 1440–1919px |
| Ultra-wide | 1920px and above |

### Mandatory viewport testing

Test the actual application at these widths:

`320, 360, 375, 390, 414, 430, 768, 820, 1024, 1280, 1366, 1440, 1600, 1920px`

Also test:

- Portrait orientation.
- Landscape orientation.
- Different viewport heights.
- Browser zoom where practical.

### Mobile requirements

At mobile widths:

- Replace the desktop sidebar with an accessible mobile navigation pattern.
- Keep navigation usable with touch.
- Stack cards and content appropriately.
- Make tables responsive through deliberate layouts, horizontal scrolling, or mobile-specific presentations.
- Keep buttons and inputs appropriately sized.
- Prevent text clipping.
- Prevent horizontal page overflow.
- Make forms easy to complete.
- Ensure dialogs fit within the available viewport.
- Keep charts readable.
- Make the email composer usable.
- Keep important actions accessible.
- Ensure the landing page animations do not prevent normal scrolling.

### Tablet requirements

At tablet widths:

- Use an appropriately compact sidebar or navigation drawer.
- Reorganize dashboard grids.
- Keep charts and tables readable.
- Avoid excessive empty space.
- Ensure forms and dialogs fit comfortably.
- Maintain useful content density.

### Desktop requirements

At desktop widths:

- Use the available space effectively.
- Maintain a consistent content width.
- Provide a clear sidebar and top navigation.
- Use balanced dashboard grids.
- Avoid excessively wide text blocks.
- Ensure charts and tables are well proportioned.

### Large desktop requirements

At 1440px and above:

- Do not stretch content unnecessarily.
- Use appropriate maximum content widths.
- Maintain visual balance.
- Preserve readable typography.
- Keep dashboard components aligned.
- Use additional space intentionally.

### Responsive implementation standards

Use:

- CSS Grid.
- Flexbox.
- Fluid sizing.
- Responsive typography.
- Appropriate breakpoints.
- Container-based layouts where useful.
- Reusable responsive components.

Avoid:

- Fixed widths that break on smaller screens.
- Absolute positioning for primary page structure.
- Hardcoded desktop-only layouts.
- Text overflow.
- Overlapping controls.
- Tiny mobile buttons.
- Unnecessary horizontal scrolling.

Every major route must be checked independently.

---

# 25. Accessibility and Usability

Follow practical WCAG accessibility principles.

Include:

- Semantic HTML.
- Keyboard navigation.
- Visible focus states.
- Accessible form labels.
- Appropriate ARIA attributes.
- Accessible modal behavior.
- Sufficient color contrast.
- Screen-reader-friendly status messages.
- Reduced-motion support.
- Clear validation feedback.

Never rely on color alone to communicate a status.

Ensure important actions are usable without a mouse.

---

# 26. Loading, Empty, Error, and Success States

Every major feature must include complete UI states.

### Loading

- Skeleton loaders.
- Button loading states.
- Progress indicators where appropriate.

### Empty

- Helpful empty-state illustrations or icons.
- Clear explanations.
- Relevant next-step actions.

### Error

- Useful error messages.
- Retry options where appropriate.
- Field-level validation.
- No raw server stack traces.

### Success

- Confirmation messages.
- Updated data.
- Clear status changes.

The experience should remain polished even when a user has no contacts, campaigns, templates, or analytics.

---

# 27. Performance and Reliability

Optimize the application for real-world use.

### Frontend

- Lazy-load routes where appropriate.
- Avoid unnecessary re-renders.
- Optimize images and assets.
- Keep animations lightweight.
- Avoid excessive dependencies.
- Use efficient API requests.
- Handle slow network conditions.

### Backend

- Use database indexes.
- Implement pagination.
- Avoid unnecessary database queries.
- Validate requests.
- Apply rate limits.
- Handle background job failures.
- Implement reliable retries.
- Log errors appropriately.

### Email reliability

- Respect provider sending limits.
- Implement appropriate throttling.
- Track job state.
- Avoid duplicate sends.
- Handle invalid recipients.
- Track bounces and failures where supported.
- Respect unsubscribes and consent.
- Keep email sending separate from ordinary web request handling when appropriate.

---

# 28. Testing and Quality Assurance

Do not consider the project complete until the major workflows have been tested.

### Authentication tests

- Registration.
- Login.
- Logout.
- Email verification.
- Password reset.
- Protected routes.

### Contact tests

- Create.
- Update.
- Delete.
- Search.
- Import.
- Export.
- Groups.
- Segments.
- Unsubscribe.

### Campaign tests

- Create campaign.
- Edit campaign.
- Preview campaign.
- Send test email.
- Schedule campaign.
- Send campaign.
- Cancel scheduled campaign.
- Handle failed sending.

### Automation tests

- Create automation.
- Edit automation.
- Enable and disable.
- Trigger execution.
- Review execution history.

### Security tests

- Unauthorized API access.
- Cross-user data access.
- Invalid tokens.
- Invalid input.
- Role restrictions.
- Rate limiting.

### Responsive tests

Verify all major pages at the viewport widths listed in Section 24.

Specifically check:

- Landing page.
- Registration.
- Login.
- Onboarding.
- Dashboard.
- Contacts.
- Contact details.
- Email composer.
- Campaigns.
- Templates.
- Analytics.
- AI assistant.
- Settings.
- Admin dashboard.

### Visual QA

Check for:

- Horizontal overflow.
- Clipped text.
- Broken grids.
- Overlapping components.
- Misaligned elements.
- Inconsistent spacing.
- Unreadable charts.
- Broken navigation.
- Modal overflow.
- Incorrect sticky behavior.
- Unusable touch targets.

Fix identified issues rather than simply documenting them.

---

# 29. Implementation Order

Develop the product in manageable phases.

### Phase 1 — Repository Audit and Foundation

- Inspect repository.
- Review requirements.
- Establish architecture.
- Configure environment.
- Set up design tokens.
- Establish reusable components.
- Configure frontend and backend foundations.

### Phase 2 — Authentication and Onboarding

- Registration.
- Login.
- Verification.
- Password reset.
- Protected routes.
- User onboarding.

### Phase 3 — Dashboard and Navigation

- Application shell.
- Sidebar.
- Header.
- Dashboard overview.
- Responsive layouts.

### Phase 4 — Contacts

- Contact CRUD.
- Import/export.
- Groups.
- Segments.
- Search and filters.
- Unsubscribe.

### Phase 5 — Email Integration

- OAuth.
- Provider connection.
- Account management.
- Connection testing.

### Phase 6 — Email Composer and Templates

- Composer.
- Email preview.
- Templates.
- Reusable content.

### Phase 7 — Campaigns and Scheduling

- Campaign management.
- Sending workflow.
- Redis.
- BullMQ.
- Scheduling.
- Job status and retries.

### Phase 8 — Automation

- Auto replies.
- Automation rules.
- Triggers.
- Execution history.

### Phase 9 — Analytics and AI

- Analytics.
- Reporting.
- AI assistant.

### Phase 10 — Notifications and Admin

- Notifications.
- Activity logs.
- Settings.
- Admin dashboard.

### Phase 11 — Public Landing Page

- Editorial marketing design.
- Scroll-driven storytelling.
- Responsive adaptations.
- Conversion flows.

### Phase 12 — Final QA and Deployment

- Functional testing.
- Security testing.
- Responsive testing.
- Performance optimization.
- Production configuration.
- Deployment documentation.

Do not skip earlier phases just to build visually impressive later pages.

---

# 30. Definition of Done

A feature is complete only when:

1. Its frontend interface is implemented.
2. Its backend endpoint or service is implemented where required.
3. Its database integration works where required.
4. Authentication and authorization are enforced.
5. Validation and error handling are implemented.
6. Loading, empty, error, and success states are included.
7. Responsive behavior is verified.
8. Relevant tests pass.
9. Existing features remain functional.
10. Documentation is updated where necessary.

A button is not functional merely because it responds to a click.

A campaign is not sent merely because the interface displays a success notification.

A metric is not real merely because it appears on a chart.

---

# 31. Final Instructions to the AI Coding Agent

Work directly with the existing MailFlow repository.

Start by auditing the codebase and comparing it against the provided project requirements.

Then:

1. Explain the current implementation status.
2. Identify missing features and technical problems.
3. Present a phased implementation plan.
4. Begin implementing the highest-priority incomplete phase.
5. Work with the existing architecture wherever practical.
6. Connect frontend functionality to real backend services.
7. Test the implementation.
8. Fix issues before moving forward.
9. Keep the application responsive across all required screen sizes.
10. Provide a concise progress report after each major phase.

For every phase, report:

- What was implemented.
- Which files were created or modified.
- Which APIs and database models were added or changed.
- What functionality was tested.
- Which tests passed or failed.
- Any remaining limitations.
- The next recommended implementation step.

**Do not attempt to build every feature in one enormous, unverified code change.**

Prioritize correctness, security, maintainability, responsive design, and real functionality over speed.

## FINAL PRODUCT EXPECTATION

Deliver MailFlow as a polished, production-oriented SaaS platform that combines:

- A distinctive editorial marketing website.
- A professional and intuitive SaaS dashboard.
- Complete email marketing workflows.
- Reliable automation and campaign scheduling.
- Real analytics and reporting.
- Secure multi-user architecture.
- AI-powered email assistance.
- Responsive layouts across mobile, tablet, laptop, and desktop.
- Accessible and consistent interactions.
- Maintainable code and deployment-ready infrastructure.

**The final result should feel like a cohesive commercial SaaS product, not a collection of disconnected pages or a static UI prototype.**
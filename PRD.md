# Clearance: Product Requirements Document

**Phase:** 1 (Core workflow and UI/UX)
**Version:** 0.1
**Last updated:** 6 November 2026
**Team:** Jivesh Garg (AI and backend), Jaskirat Singh Khanna (backend and database), Gauransh Bhaba (frontend and UI/UX), Kanishq Tewatia (design and documentation)

---

## 1. Purpose

Clearance is a web platform that reviews brand content before it is published. Creators submit drafts, the system checks them against the brand's approved guidelines, facts and assets, and an agent fixes or routes each issue based on its risk.

This document covers **Phase 1 only**: the end-to-end workflow, the role-based screens and the visual design system. AI checks in this phase return **mock results** from seeded data, so the frontend and workflow can be built and tested before the real pipeline is connected.

## 2. Phase 1 Goals

1. A user can log in and land on the correct dashboard for their role.
2. An admin can set up a brand: guidelines, facts, terminology, assets and embargoed items.
3. A creator can submit content, confirm its intent and see the issues found.
4. Issues are shown with a risk level, an explanation and the source they are based on.
5. A creator can accept or reject each suggested fix in a side-by-side view.
6. Content moves through review and approval according to its risk level.
7. Every action is recorded in an activity log.
8. The whole interface follows the neo-brutalist design system in Section 9.

## 3. Out of Scope for Phase 1

- Real AI checks, RAG pipeline, transcription, OCR and logo matching (mocked)
- The autonomous agent's background actions (simulated with buttons in the demo)
- Email or Slack notifications (in-app only)
- Direct publishing to social platforms
- Insights dashboard analytics (placeholder screen only)
- Dark mode

---

## 4. User Roles and Permissions

| Role | Main purpose | Can see | Can do |
|---|---|---|---|
| **Admin** | Owns the brand setup | Everything | Manage users, edit brand knowledge, set autonomy levels, mark embargoes, answer agent questions |
| **Manager** | Approves day-to-day content | All submissions for their team, campaigns, activity log | Approve medium-risk issues, approve content, request changes, assign reviewers |
| **Authorised Reviewer** | Clears high-risk issues | Submissions routed to them | Approve or reject high-risk issues with a written reason |
| **Internal Creator** | Makes content for the brand | Own submissions, brand guidelines (read-only) | Submit content, confirm intent, accept or reject fixes, upload revisions |
| **External Creator** | Agency or influencer | Only their assigned campaign brief and own submissions | Same as Internal Creator, within their campaign |

**Rules**

- External creators never see embargoed items, the full fact base, other creators' work or internal comments.
- Only an Authorised Reviewer can clear a high-risk issue. A Manager cannot override this.
- Nobody can approve content that is on an embargo hold.
- Role checks are enforced in the database (row-level security), not only in the UI.

For the demo, the top bar includes a **role switcher** that swaps between five seeded accounts.

---

## 5. Core Workflow

### 5.1 Submission status flow

Every submission has exactly one status at a time.

| Status | Meaning | Moves to |
|---|---|---|
| **Draft** | Started but not submitted | Submitted |
| **Submitted** | Waiting for checks to start | Processing |
| **Processing** | Checks running | Intent Pending |
| **Intent Pending** | Waiting for the creator to confirm the intent summary | Checked |
| **Checked** | Issues found and sorted by risk | Needs Revision, In Review, Approved |
| **Needs Revision** | Creator must act on fixes or re-upload | Submitted (new version) |
| **In Review** | Waiting on a Manager or Reviewer | Approved, Needs Revision, Rejected |
| **On Hold** | Contains embargoed material | Submitted (after embargo date or edit) |
| **Approved** | Cleared for publishing | Final |
| **Rejected** | Will not be published | Final |

### 5.2 How risk decides the route

| Risk | Example issues | What happens |
|---|---|---|
| **Low** | Wrong product spelling, banned word, missing alt text, wrong hashtag | Fix applied automatically and logged. Creator is informed and can undo. |
| **Medium** | Tone mismatch, off-brand phrasing, wrong logo version, contradiction with another post | Fix is prepared. Manager approves with one click. |
| **High** | Health, legal or financial claims, missing ad disclosure, outdated price | Routed to an Authorised Reviewer. Only they can clear it. |
| **Blocker** | Embargoed product or confidential information | Submission goes On Hold. Cannot be approved until released or removed. |

A submission's overall route is decided by its highest-risk open issue.

### 5.3 Main flow, step by step

1. **Admin sets up the brand.** Uploads guidelines, adds approved facts, terminology, assets and embargoed items. Sets autonomy levels per risk.
2. **Creator submits content.** Uploads a file or pastes text, picks the channel (Instagram, YouTube, LinkedIn, Blog, Email) and the campaign.
3. **System processes it.** Status moves to Processing. In Phase 1 a short loading state returns seeded results.
4. **Creator confirms intent.** A card shows the detected goal, audience, key message and call to action. The creator confirms or edits each field.
5. **Issues are shown.** Grouped by risk. Each issue shows what was found, why it matters, the guideline or fact it is based on, and a suggested fix.
6. **Low-risk fixes are applied.** Shown in the side-by-side view as already applied, each with an undo option.
7. **Creator reviews remaining fixes.** Accepts or rejects each one. A rejected fix needs a short reason.
8. **Routing.** If medium-risk issues remain, the submission goes to a Manager. If high-risk issues remain, it goes to an Authorised Reviewer. If a blocker exists, it goes On Hold.
9. **Review.** The reviewer approves, requests changes with a comment, or rejects.
10. **Revision loop.** If changes are requested, the creator uploads a new version and the flow repeats from step 3. All versions are kept.
11. **Approval.** Status becomes Approved. The activity log records who approved and when.

### 5.4 Supporting flows

- **Embargo release.** When an embargo date passes, held submissions return to Submitted and the owner is notified. In Phase 1, the admin can trigger this manually from the embargo list.
- **Fact question.** When a claim cannot be matched to an approved fact, the admin receives a question card ("Is the student discount 20% or 25%?"). Their answer is saved as a new fact.
- **Cross-channel contradiction.** When two submissions in one campaign disagree on a fact, both show a linked issue pointing to each other.
- **Undo.** Any automatic action in the activity log can be undone by the Admin or the content owner.

---

## 6. Screens

### 6.1 Shared

| Screen | Contents |
|---|---|
| **Login** | Email and password. Demo accounts listed below the form. |
| **App shell** | Left sidebar with role-specific links. Top bar with brand name, role switcher, notification bell and user menu. |
| **Notifications panel** | Slide-in panel. Each item links to the submission or task it refers to. |
| **Activity log** | Table of every action: who or what did it, when, on which submission, the reason, and an undo button where allowed. Filterable by user, action type and date. |

### 6.2 Admin

| Screen | Contents |
|---|---|
| **Brand Setup** | Tabs for Guidelines, Facts, Terminology, Assets and Embargoes. |
| Guidelines tab | Upload PDF or DOCX, list of uploaded documents, and a "local-only" toggle per document. |
| Facts tab | Editable table: fact, value, source, valid until, status (active or expired). |
| Terminology tab | Two lists: approved terms (with correct spelling and casing) and banned terms (with suggested replacement). |
| Assets tab | Grid of logos and images, each tagged as approved or deprecated. |
| Embargoes tab | Table: item name, description, release date, held submissions count, "Release now" button. |
| **Users** | Table of users with role, team and campaign access. Invite and edit actions. |
| **Autonomy Settings** | One row per risk level with a three-step control: Auto-fix, Ask first, Recommend only. Defaults follow Section 5.2. |
| **Agent Questions** | List of open fact questions with an answer field. |

### 6.3 Creator (Internal and External)

| Screen | Contents |
|---|---|
| **My Submissions** | Card grid or table: title, channel, campaign, status badge, highest risk, last updated. Filter by status. |
| **New Submission** | Upload area or text box, title, channel picker, campaign picker, optional notes. Submit button. |
| **Intent Confirmation** | Four editable fields (goal, audience, key message, call to action) with Confirm button. |
| **Submission Detail** | The main working screen. See Section 6.6. |
| **Campaign Brief** (External only) | Read-only brief: required talking points, discount code, disclosure rules, do's and don'ts. |

### 6.4 Manager

| Screen | Contents |
|---|---|
| **Review Queue** | Submissions waiting on the manager, sorted by deadline. Shows creator, channel, open issues count and time waiting. |
| **Submission Detail** | Same as the creator's view, plus Approve, Request Changes, Reject and Assign Reviewer actions. |
| **Campaigns** | List of campaigns. Each campaign page shows all its submissions side by side and any cross-channel contradictions. |
| **Insights** | Placeholder in Phase 1. Shows static cards for "Most common issues" and "Unclear guidelines". |

### 6.5 Authorised Reviewer

| Screen | Contents |
|---|---|
| **High-Risk Queue** | Only issues routed to this reviewer, with deadline and countdown. |
| **Issue Decision** | The flagged content, the claim, the related fact or guideline, and Clear or Reject buttons. A written reason is required for both. |

### 6.6 Submission Detail layout

This is the most important screen and should get the most design attention.

- **Header:** title, channel, campaign, status badge, version selector, owner.
- **Left column (content):** the submission with issues highlighted inline. Text issues are underlined in the risk colour. Images show a numbered marker on the area. Video shows a timeline with issue markers at their timestamps.
- **Right column (issues panel):** issues grouped by risk, highest first. Each issue card shows:
  - Risk badge and issue type
  - What was found
  - Why it was flagged, in one or two sentences
  - Source chip linking to the guideline section or fact
  - Suggested fix
  - Accept and Reject buttons (or "Applied automatically" with Undo)
- **Diff toggle:** switches the left column to a side-by-side view of original and corrected content.
- **Bottom bar:** intent summary (collapsed), comment thread and version history.

---

## 7. Data Model (Phase 1)

| Entity | Key fields |
|---|---|
| **User** | id, name, email, role, team, campaign access |
| **Brand** | id, name, autonomy settings |
| **Guideline** | id, title, file, local-only flag, uploaded by, uploaded at |
| **Fact** | id, label, value, source, valid until, status |
| **Term** | id, term, type (approved or banned), replacement |
| **Asset** | id, name, file, status (approved or deprecated) |
| **Embargo** | id, name, description, release date |
| **Campaign** | id, name, brief, assigned creators |
| **Submission** | id, title, channel, campaign, owner, status, current version |
| **Version** | id, submission, number, content or file, created at |
| **Intent** | id, version, goal, audience, key message, call to action, confirmed |
| **Issue** | id, version, risk, type, location, finding, explanation, source reference, suggested fix, state (open, applied, accepted, rejected, cleared) |
| **Comment** | id, submission, author, text, internal flag, created at |
| **Activity** | id, actor (user or agent), action, target, reason, reversible, created at |
| **Notification** | id, user, message, link, read |

Seed data should include one fictional brand, five users (one per role), two campaigns and around eight submissions spread across every status.

---

## 8. UI/UX Principles

1. **Status is always visible.** Every submission shows its status and highest risk without opening it.
2. **Every flag explains itself.** No issue appears without a reason and a source.
3. **Humans decide the important things.** Automatic actions are labelled, logged and reversible.
4. **One primary action per screen.** The next step should be obvious.
5. **Role-appropriate views.** Users only see what they can act on.
6. **Colour never carries meaning alone.** Risk and status always pair colour with a text label and an icon.

---

## 9. Design System: Neo-Brutalism

### 9.1 Visual direction

Flat, bold and high-contrast. Thick black outlines, hard offset shadows with no blur, solid colour blocks, heavy type and visible structure. No gradients, glassmorphism or soft drop shadows. The style should feel confident and readable, with colour used to carry status and risk.

### 9.2 Colour

| Token | Hex | Use |
|---|---|---|
| Ink | #111111 | Text, borders, shadows |
| Paper | #FFFDF5 | Page background |
| Surface | #FFFFFF | Cards, inputs, panels |
| Primary | #FFD23F | Primary buttons, active nav item, highlights |
| Secondary | #4D96FF | Links, info states, selected tabs |
| Low risk | #7BE495 | Low-risk badges and markers |
| Medium risk | #FFB347 | Medium-risk badges and markers |
| High risk | #FF6B6B | High-risk badges and markers |
| Blocker | #C084FC | Embargo and On Hold states |
| Muted | #E8E4D8 | Disabled states, table stripes |

All text on coloured backgrounds uses Ink. Each pairing must meet WCAG AA contrast.

### 9.3 Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Display (page titles) | Archivo Black | 400 | 36 to 48 px |
| Headings | Space Grotesk | 700 | 20 to 28 px |
| Body | Space Grotesk | 400 to 500 | 15 to 16 px |
| Labels and buttons | Space Grotesk | 700, uppercase | 13 to 14 px |
| Metadata (IDs, timestamps, versions) | JetBrains Mono | 500 | 12 to 13 px |

### 9.4 Shape and depth

| Token | Value |
|---|---|
| Border | 3 px solid Ink (2 px for small elements like chips) |
| Corner radius | 0 px for cards and panels, 6 px for buttons and inputs |
| Shadow (default) | 4 px right, 4 px down, no blur, Ink |
| Shadow (large, for modals) | 8 px right, 8 px down, no blur, Ink |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48 px |

### 9.5 Interaction

- **Hover on buttons and clickable cards:** element shifts 2 px right and down while the shadow shrinks by the same amount, so it looks pressed halfway.
- **Active (pressed):** element shifts fully onto its shadow and the shadow disappears.
- **Focus:** 3 px Secondary outline with a 2 px gap. Always visible on keyboard focus.
- **Transitions:** 100 ms, no easing curves longer than that. Respect reduced-motion settings by removing movement.

### 9.6 Components

| Component | Notes |
|---|---|
| **Button** | Primary (yellow fill), Secondary (white fill), Danger (red fill). All with border and shadow. Uppercase label. |
| **Card** | White surface, border, default shadow, 16 to 24 px padding. |
| **Status badge** | Pill with border, colour fill, icon and uppercase label. One style per status in Section 5.1. |
| **Risk badge** | Square tag with risk colour, icon and label (LOW, MEDIUM, HIGH, BLOCKER). |
| **Source chip** | Small bordered chip with a document icon and the guideline section or fact name. Clicking opens it in a side panel. |
| **Issue card** | Card with a thick left edge in the risk colour. Layout follows Section 6.6. |
| **Input and select** | White fill, border, 6 px radius. Focus uses the focus style. Errors show a red border and a message below. |
| **Table** | Bordered header row in Primary. Alternate rows in Muted. |
| **Tabs** | Bordered blocks. The active tab is filled with Secondary. |
| **Toggle** | Rectangular track with border. On state filled with Low-risk green. |
| **Autonomy control** | Three-segment control: Auto-fix, Ask first, Recommend only. |
| **Diff view** | Two columns. Removed text with red highlight and strikethrough, added text with green highlight. |
| **Video timeline** | Horizontal bar with square markers in risk colours at issue timestamps. |
| **Modal** | Large shadow, Paper background behind a semi-opaque Ink overlay. |
| **Toast** | Bottom-right, bordered, coloured by type, auto-dismiss after 5 seconds. |
| **Empty state** | Large bold heading, one sentence of guidance, one primary action. |

### 9.7 Layout

- Sidebar width 240 px, with border on the right edge.
- Content area max width 1280 px, 32 px padding on desktop and 16 px on mobile.
- Submission Detail uses a 60/40 split on desktop and stacks on screens under 1024 px.
- The app must work at 360 px width without horizontal scrolling.

---

## 10. Accessibility

- WCAG AA contrast for all text and interactive elements.
- Full keyboard navigation, with a visible focus style on every interactive element.
- Risk and status use text and icons alongside colour.
- All images in the UI have alt text. Video markers have accessible labels with the timestamp.
- Form errors are announced to screen readers.
- Motion is removed when the user has reduced motion enabled.

---

## 11. Tech Stack (Phase 1)

| Layer | Choice |
|---|---|
| Frontend | Next.js with React and Tailwind CSS |
| Components | Custom components built to Section 9, no pre-styled UI library |
| Backend | FastAPI with mock endpoints returning seeded results |
| Database and auth | Supabase (Postgres, auth, storage, row-level security) |
| Hosting | Vercel for the frontend, Railway or Render for the backend |
| Design | Figma |

---

## 12. Acceptance Criteria

- [ ] Each of the five demo accounts lands on its own dashboard after login.
- [ ] An External Creator cannot reach embargoed items, the fact base or other creators' submissions, including by URL.
- [ ] A submission can move through every status in Section 5.1 using the UI.
- [ ] Every issue card shows risk, explanation, source and suggested fix.
- [ ] Accepting, rejecting and undoing a fix updates the diff view and the activity log.
- [ ] A submission with a high-risk issue cannot be approved by a Manager.
- [ ] A submission On Hold cannot be approved by anyone.
- [ ] Releasing an embargo moves held submissions back to Submitted and sends a notification.
- [ ] The interface follows the colour, type, border and shadow tokens in Section 9.
- [ ] All screens work at 360 px width and pass keyboard navigation checks.

---

## 13. Open Questions

1. Should managers be able to edit content directly, or only comment and request changes?
2. How long should reviewers get before escalation (default 24 hours)?
3. Do external creators see the reason behind every flag, or a simplified version?
4. Should the role switcher stay visible in the final demo, or only during development?
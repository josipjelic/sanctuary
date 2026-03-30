<!--
DOCUMENT METADATA
Owner: @documentation-writer
Update trigger: Any user-facing feature is added, changed, or removed
Update scope: Full document
Read by: End users and agents needing to understand user-facing flows.
-->

# Sanctuary — User Guide

> Last updated: 2026-03-31
> Version: 0.1.0 (pre-release — features documented as they ship)

---

## Getting Started

### Creating an Account

1. Open the Sanctuary app on your iOS or Android device (or web preview, if you use it).
2. Tap **Sign Up**.
3. Enter your email address and choose a password (minimum 8 characters).
4. Tap **Create Account**.

**Email confirmation depends on your environment:**

- **Production Supabase** (real beta / App Store builds): You may need to open the verification link in the email before you can sign in. If email confirmation is enabled in the project, follow the link from your inbox.
- **Local development** (developer machines): Email confirmation is often **disabled** so you can sign in immediately without opening a link.

If sign-in fails after sign-up, check with whoever runs the project whether confirmation is required for your build.

**What to expect**: After you are signed in, you land on **Capture** (Quick Capture). Your **Thoughts** inbox starts empty until you save your first thought.

#### Common Issues

**"Email already in use"**  
An account with this email already exists. Tap **Log In** instead, or use **Forgot password** on the sign-in screen to reset access.

---

### Logging In

1. Open Sanctuary.
2. Tap **Log In** (or you may be taken to sign-in automatically if you are logged out).
3. Enter your email and password.
4. Tap **Sign In**.

**Forgot your password?** On the sign-in screen, tap **Forgot password**, enter your email, and use the reset link Supabase sends (when configured).

---

## Features

### Quick Capture (Capture tab)

The home tab is where you record or type thoughts.

- **Voice**: Tap and hold the large microphone control to record. Release to stop; the app sends audio for transcription and assigns a **topic** automatically when processing finishes.
- **Text**: Type in the field and tap **Capture** to save. Topics are assigned automatically in the background.
- **Today’s captures**: A subtitle shows how many thoughts you captured today (when loaded).
- **Recent thoughts**: Use the row that links toward your inbox to jump to recent items.

Grant **microphone** permission when prompted, or enable it in the system Settings app for Sanctuary, or voice capture will not work.

---

### Thought Inbox (Thoughts tab)

- Lists your thoughts **newest first**, with a short preview and **topic** chips when assigned.
- **Pull down** to refresh (useful while transcription or topic assignment is still running).
- **Tap a thought** to open the detail screen.

---

### Thought Detail

Opens from the inbox when you tap a thought.

- Read the **full** thought text (not truncated).
- Tap **Edit** to change the main text, then **Save** or **Cancel** in the header.
- **Topics** appear as chips for context; they are assigned by the app (you cannot edit them on this screen yet).
- **Delete** removes the thought after you confirm. This cannot be undone.
- **Reminder** — if Sanctuary detected a time reference, a **Reminder** row appears below the timestamp. Tap it to open the same bottom sheet used elsewhere: review (**Approve** / **Dismiss**) if it is still pending, or **Save** / **Dismiss** to reschedule an already scheduled reminder.

**Not in the app yet** on this screen: longer journal notes (`body_extended`), automatic debounced saving, AI reflection prompts, and the full “Reflection Space” layout from the design spec. See the product backlog if you are tracking upcoming work.

---

### Library (Library tab)

Browse thoughts by **topic** (your personal topic list).

- Open a **folder**-style card to see thoughts that belong to that topic.
- Use **Manage lists** (or equivalent) to **add** a new topic to your catalog, or manage topics as implemented in your build.

An “all thoughts” filter and daily check-in history on this screen are **not** implemented yet.

---

### Reminders

When you capture a thought that mentions a future time — "call the dentist next Tuesday", "review the proposal in 3 hours", "dentist Wednesday at 3 pm" — Sanctuary quietly notices and queues it as a reminder for you to review. Nothing is scheduled without your approval.

#### Reviewing reminders

When one or more reminders are waiting for your decision, a pill appears at the top of the **Thoughts** tab:

> **🔔 2 reminders to review**

Tap it to open the Reminder sheet. Each item shows:

- The text snippet Sanctuary detected as a time reference
- A suggested date and time (tap to edit before approving)
- **Approve** and **Dismiss** buttons

**Approve** schedules a notification on your device and removes that row from the list so you can continue with any other pending reminders. **Dismiss** removes the reminder without scheduling anything.

Tap the **outline** bell on a thought card to open this **Reminders to review** sheet. Tap the **solid** bell to open the **Scheduled reminder** sheet for that thought (reschedule or dismiss) — not the review list, which only shows pending items.

When you open a reminder from the **thought detail** screen (reminder row under the timestamp), you get one bottom sheet for that thought: **Approve** switches it to **scheduled** mode in place so you can **Save** further changes or **Dismiss**.

#### Bell icons

A small bell icon appears on the right side of a thought's timestamp row when a reminder exists for it:

- **Outline bell** — reminder is waiting for your review
- **Solid bell** — reminder is approved and scheduled

#### After approval

Once you approve a reminder, your device will deliver a notification at the scheduled time (minus your chosen lead time — see below). The notification appears even if Sanctuary is closed, as long as you have granted notification permission.

If Sanctuary asks for notification permission when you first approve a reminder, tap **Allow**. Without permission, no notifications will fire. You can also enable this later in your device's Settings app under Sanctuary → Notifications.

#### Notification settings

From the **Capture** screen, tap the **gear** icon to open **Settings**, then scroll to the **Reminders** section.

- **Lead time** — how early to notify you before the reminder's scheduled time. Options: At the time, 15 minutes before (default), 30 minutes before, 1 hour before, In the morning.
- **Morning time** — shown when you choose "In the morning". Sets the time the notification fires on the morning of (or before) the reminder day. Default is 07:30.

---

### Daily Check-in

**Coming in a future release.** The database supports daily check-ins, but there is no check-in screen in the app yet.

---

## Settings and account

There is **no separate Settings tab**. From the **Capture** screen, tap the **gear** icon in the header to open **Settings**.

In that sheet you can:

- Choose **transcription language** (for voice — how the model is asked to interpret speech; options vary by build).
- Configure **Reminders** — set the notification lead time and morning digest time (see the Reminders section above).
- **Sign out** of Sanctuary.

**Changing your password** is not done inside this modal. Use **Forgot password** on the sign-in screen to receive a reset email when your Supabase project has reset emails configured.

---

## Troubleshooting

### Common Issues

| Issue | Likely Cause | What to Do |
|-------|-------------|------------|
| "Session expired" on open | Supabase session timed out | Sign in again |
| Voice recording not working | Microphone permission not granted | System Settings → Sanctuary → allow Microphone |
| Thought saved but no topic yet | Topic assignment runs after save | Wait a few seconds and pull to refresh on the inbox |
| Email never arrives after sign-up | Confirmation off in dev, or spam / wrong address | Check spam; ask your host whether confirmation is required |
| Reminder pill not appearing after capture | AI found no clear future time reference in the text | This is expected — try rephrasing with a specific date or time |
| Notification did not fire | Notification permission was denied, or notifications are off for Sanctuary | System Settings → Sanctuary → Notifications → Allow |
| Reminder suggests the wrong date or time | AI resolved a relative reference differently than you intended | Tap the suggested time in the Reminder sheet to edit it before approving |

### Getting Help

This is a friends-and-family beta. Reach out directly to Josip with any issues or feedback.

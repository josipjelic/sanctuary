

# Sanctuary — User Guide

> Last updated: 2026-04-12
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

### Setting Up Your Profile

Sanctuary can learn a little about how you think and feel — so the app's morning messages and reflections feel more personal to you. To do this, it asks you a handful of open-ended questions. There are no right or wrong answers.

**This is entirely optional.** You can use everything in Sanctuary without completing it.

#### How to start

Look for the **person icon** in the top-right corner of the Capture screen, next to the gear icon. A small dot on the icon means you haven't set up your profile yet. Tap it to begin.

You can tap the profile icon at any time — to start, to finish where you left off, or just to revisit the questions.

#### Answering the questions

You'll move through 5 questions one at a time. Each asks something open-ended about how you think, feel, or see the world. For each one you can:

- **Type** your answer in the text field below the question
- **Speak** your answer — tap the **mic button**, say what comes to mind, then tap it again to stop. Your words are transcribed automatically.

Tap **Continue** to move to the next question. Tap the back arrow to revisit a previous one.

After the 5 questions, Sanctuary offers 2 optional extras. Tap **Share more** to answer them, or **Skip to my sanctuary** to finish.

#### Building your profile

When you finish, Sanctuary takes a moment — usually just a second or two — to put your profile together. When it's ready, you'll see "Your sanctuary is ready."

Your reflections are private and never shared.

Once complete, the profile icon changes from an outline to a filled person icon.

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

### Morning Messages

A short, personal note that appears at the top of your Capture screen each morning. It's written for you based on your profile — the answers you gave during setup.

Morning messages require completing your profile. A new message is prepared for each day.

#### When they appear

The card appears on the Capture screen from your morning time (default: **07:30**) until **noon**. Sanctuary also sends a notification at your morning time to nudge you to open the app.

If the message takes a moment to load, a gentle shimmer shows it is on its way.

#### How to dismiss

Tap the **×** button in the top-right corner of the card. The message goes away for the rest of the day.

#### Changing your morning time

1. On the Capture screen, tap the **gear icon** to open Settings.
2. Under **Reminders**, tap **Reminder lead time** and select **In the morning**.
3. A **Morning time** row appears — tap it to choose your preferred time.

The notification and the message window both follow this setting.

#### Common Issues

**Morning message card not showing**  
The card only appears between your set morning time and noon. Outside that window, it won't show. If you've completed your profile and it still doesn't appear during morning hours, try closing and reopening the app.

**"Your morning message couldn't load"**  
This is usually a brief network issue. Tap **Try again** to reload it.

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

**Approve** schedules a notification on your device and removes that row from the list so you can continue with any other pending reminders. Right after approving from this list, Sanctuary may ask if you also want to **add the reminder to your phone or tablet’s calendar app** — that step is optional. **Dismiss** removes the reminder without scheduling anything.

Tap the **outline** bell on a thought card to open this **Reminders to review** sheet. Tap the **solid** bell to open the **Scheduled reminder** sheet for that thought (reschedule or dismiss) — not the review list, which only shows pending items.

When you open a reminder from the **thought detail** screen (reminder row under the timestamp), you get one bottom sheet for that thought: **Approve** switches it to **scheduled** mode in place so you can **Save** further changes or **Dismiss**. After you approve, you may be offered the same optional **add to calendar** step. While a reminder is scheduled, use **Add to calendar** in that sheet if you want a calendar event without going through approve again.

#### Bell icons

A small bell icon appears on the right side of a thought's timestamp row when a reminder exists for it:

- **Outline bell** — reminder is waiting for your review
- **Solid bell** — reminder is approved and scheduled

#### After approval

Once you approve a reminder, your device will deliver a notification at the scheduled time (minus your chosen lead time — see below). The notification appears even if Sanctuary is closed, as long as you have granted notification permission.

If Sanctuary asks for notification permission when you first approve a reminder, tap **Allow**. Without permission, no notifications will fire. You can also enable this later in your device's Settings app under Sanctuary → Notifications.

If you choose to add the reminder to your **calendar app**, the system may ask for calendar access — that is separate from notification permission. Your phone or tablet then opens its **calendar event editor** with the time and text already filled in; tap **Save** (or the equivalent) there to finish. On some Android devices, Sanctuary cannot tell whether you saved or cancelled — if the event is missing, use **Add to calendar** again. The event time matches the reminder’s scheduled time; your lead-time setting only affects the **notification**, not the calendar event.

#### Notification settings

From the **Capture** screen, tap the **gear** icon to open **Settings**, then scroll to the **Reminders** section.

- **Lead time** — how early to notify you before the reminder's scheduled time. Options: At the time, 15 minutes before (default), 30 minutes before, 1 hour before, In the morning.
- **Morning time** — shown when you choose "In the morning". Sets the time the notification fires on the morning of (or before) the reminder day. Default is 07:30.

---

### Journal (Journal tab)

A quiet space for guided daily reflection. Each session, Sanctuary asks you an open-ended question, then listens to your answer and asks a relevant follow-up based on what you shared. The conversation ends at a natural resting point. There are no right answers, no scores, and nothing to complete perfectly.

---

#### Starting a journal session

1. Tap the **Journal** tab (book icon, fourth in the bottom navigation).
2. Tap **Begin today's journal**.

The first question is always the same:

> *Take a moment to settle in. What's on your mind today — something that happened, a feeling, or just a thought that's been with you?*

Every session starts with this question so the experience feels consistent and familiar. You can take it in any direction — an event from your day, something you felt, or a thought that has been sitting with you.

---

#### Answering by voice

Voice is the main way to answer in Sanctuary.

1. Tap the large **mic button** in the centre of the screen. It turns red to show that recording has started.
2. Speak your answer at your own pace. Take as long as you need.
3. Tap the mic button again to finish. Sanctuary transcribes what you said and shows the text on screen.
4. If anything needs correcting, tap **Edit** to adjust your answer before moving on.

The header shows your progress through the session — for example, **2 / 3**.

#### Answering by typing

If you prefer to type, tap **Or type instead** below the mic button. A text field opens where you can write your answer directly.

Once you have an answer from voice, you can still tap **Edit** to switch to the text field and make changes.

#### Moving through the session

Tap **Next** to submit your answer and move to the following question. The button becomes active once your answer is long enough to work with.

From the second question onwards, a **Skip this question** link appears below the Next button. Use it if a question does not feel relevant — skipping is always fine.

Each session moves through up to three questions in total. After you answer the first, Sanctuary considers what you shared and asks a follow-up that fits. The session concludes naturally when the conversation has reached a good resting point — sometimes that is after two questions, sometimes three.

#### Saving your session

When you reach the last question, the **Next** button changes to **Save journal**. Tap it to save.

**What to expect**: A "Reflection saved" screen appears with a checkmark. It returns you to the Journal tab automatically after a few seconds. From there you can also tap **View your profile** to see what Sanctuary has learned about you so far (see [Your journal profile](#your-journal-profile) below).

#### Leaving partway through

Tap the **back arrow** (top left) at any point to leave the session. A sheet appears with two options:

- **Keep writing** — stays in the session
- **Leave for now** — exits and saves your progress

Your answers so far are saved automatically as you go. Nothing is lost if you leave.

---

#### Resuming an interrupted session

If you left a session unfinished within the last 24 hours, the Journal tab shows a card with when the session was started and a preview of your first answer.

- Tap **Continue** to pick up where you left off.
- Tap **Start fresh** to set aside the unfinished session and begin a new one from scratch.

If more than 24 hours have passed since you started the session, it will no longer be offered for resuming. Tap **Begin today's journal** to start fresh.

---

#### Past entries

Tap **Past entries** near the bottom of the Journal tab to see all your completed sessions.

Each entry shows:

- The date of the session
- A short preview of how you opened that session
- How many questions you answered

Past entries are read-only. They are there to look back on, not to edit.

---

#### Evening reminder

An optional daily notification that nudges you to journal each evening.

**To turn it on:**

1. From the **Capture** screen, tap the **gear icon** to open Settings.
2. Scroll to the **Journal** section.
3. Toggle **Evening reminder** on.

When you enable it, Sanctuary asks for notification permission if it has not been granted already. Tap **Allow** — without permission, the reminder cannot reach you. (You can also enable it later in your device's Settings app under Sanctuary → Notifications.)

**What the notification says:**

> *Your journal is waiting — take a moment for yourself.*

**To change the time:**

1. Make sure **Evening reminder** is turned on.
2. Tap **Reminder time** to open the time picker.
3. Choose your preferred time and confirm.

The default time is **9:00 PM**. The reminder fires daily at the time you set.

To turn the reminder off, toggle **Evening reminder** back to off.

---

#### Your journal profile

After each completed session, Sanctuary builds a short summary of what it has noticed about you from your journal sessions — the kinds of things you reflect on, the themes that come up, and how you tend to describe your experiences. This is your **journal profile**.

The profile helps Sanctuary ask more relevant follow-up questions in future sessions. It is never shown to you mid-session, so it has no influence on how you answer.

**Where to find it:**

- Open **Settings** (gear icon on the Capture screen), scroll to the **Journal** section, and tap **Your journal profile**.
- Or tap **View your profile** on the "Reflection saved" screen right after finishing a session.

The profile builds gradually over time. After your first session it will be short; it grows richer as you journal more. Pull down on the profile screen to refresh if you have just finished a session and want to see the latest version.

**Privacy:** Your journal profile is private. It is stored securely and used only to personalise your journal experience — it is never shared with anyone, and it does not affect any other part of Sanctuary.

---

### Daily Check-in

**Coming in a future release.** The database supports daily check-ins, but there is no check-in screen in the app yet.

---

## Settings and account

There is **no separate Settings tab**. From the **Capture** screen, tap the **gear** icon in the header to open **Settings**.

In that sheet you can:

- Choose **transcription language** (for voice — how the model is asked to interpret speech; options vary by build).
- Configure **Reminders** — set the notification lead time and morning digest time (see the Reminders section above).
- Configure **Journal** — turn the evening reminder on or off, set the reminder time, and view your journal profile (see the Journal section above).
- **Sign out** of Sanctuary.

**Changing your password** is not done inside this modal. Use **Forgot password** on the sign-in screen to receive a reset email when your Supabase project has reset emails configured.

---

## Troubleshooting

### Common Issues


| Issue                                                                      | Likely Cause                                                               | What to Do                                                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| "Session expired" on open                                                  | Supabase session timed out                                                 | Sign in again                                                                                   |
| Voice recording not working                                                | Microphone permission not granted                                          | System Settings → Sanctuary → allow Microphone                                                  |
| Thought saved but no topic yet                                             | Topic assignment runs after save                                           | Wait a few seconds and pull to refresh on the inbox                                             |
| Email never arrives after sign-up                                          | Confirmation off in dev, or spam / wrong address                           | Check spam; ask your host whether confirmation is required                                      |
| Reminder pill not appearing after capture                                  | AI found no clear future time reference in the text                        | This is expected — try rephrasing with a specific date or time                                  |
| Notification did not fire                                                  | Notification permission was denied, or notifications are off for Sanctuary | System Settings → Sanctuary → Notifications → Allow                                             |
| Reminder suggests the wrong date or time                                   | AI resolved a relative reference differently than you intended             | Tap the suggested time in the Reminder sheet to edit it before approving                        |
| Journal follow-up questions seem generic and don't reference past sessions | Your journal profile is empty — it builds over multiple sessions           | This is expected on first use. After a few sessions, questions will become more tailored to you |


### Getting Help

This is a friends-and-family beta. Reach out directly to Josip with any issues or feedback.
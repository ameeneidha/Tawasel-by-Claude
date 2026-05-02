# Tawasel Operator Guide

How to run WhatsApp, bookings, reminders, and leads from one workspace.

This guide is for business owners, managers, reception teams, and sales agents using Tawasel every day. It is not a technical manual. It is an operating playbook.

## 1. Go Live in 30 Minutes

Use this checklist to make your workspace usable today.

1. Log in to Tawasel.
2. Confirm your business name in Settings.
3. Connect your WhatsApp number from Channels.
4. Add your services.
5. Add staff and availability.
6. Copy your public booking link from Settings.
7. Create or sync WhatsApp templates.
8. Make one test booking using the public booking link.
9. Confirm the appointment appears in Appointments.
10. Confirm the WhatsApp confirmation message is received.
11. Open Inbox and reply to one test customer.

Expected result:
Your team can receive customer messages, create bookings, send confirmations, and manage appointments from Tawasel.

Best practice:
Start with a real service and a real staff member. Do not test only with demo names, because you want the workflow to feel like your real business from day one.

Common mistake:
Changing the business name does not change the booking link. The booking link uses a stable slug, so old Instagram bio and website links keep working.

## 2. Daily Inbox Workflow

Use this every morning and throughout the day.

1. Open Inbox.
2. Check unread conversations first.
3. Reply to urgent customers.
4. Assign conversations to the right team member.
5. Move leads to the correct CRM stage.
6. Add internal notes when needed.
7. Book appointments directly from the conversation when possible.
8. Mark conversations resolved when the customer is handled.
9. Check stale leads from the dashboard.

Expected result:
No customer message is missed, and every lead has a clear owner.

Best practice:
Keep conversations either clearly open or resolved. Do not leave old conversations open forever, because the dashboard will become noisy.

Common mistake:
Do not use personal phones for follow-up after a customer enters Tawasel. That breaks tracking, assignment, and reporting.

## 3. Booking Workflow

Tawasel supports public self-service booking and manual booking from inside the app.

### Public booking flow

1. Customer opens `/book/:slug`.
2. Customer selects service.
3. Customer selects staff or any available staff.
4. Customer selects date and time.
5. Customer enters name and WhatsApp number.
6. Tawasel creates or updates the contact.
7. Tawasel creates the appointment.
8. Tawasel sends a WhatsApp confirmation template if available.
9. The appointment appears in Appointments.
10. Reminder rules can later send reminders before the appointment.

### Manual booking flow

1. Open Appointments.
2. Click new appointment.
3. Select or create the contact.
4. Select service, staff, date, and time.
5. Save the appointment.
6. Confirm whether a WhatsApp confirmation was sent.
7. Check the appointment in list or calendar view.

Best practice:
After creating or changing booking settings, always make one real test booking from the public booking link.

What to test:
1. The customer can type name and phone number clearly.
2. Time slots are correct for UAE time.
3. The appointment appears in the calendar.
4. The WhatsApp confirmation message arrives.
5. The confirmation message variables are in the correct order.

Common mistake:
If confirmation does not arrive, check the WhatsApp template first. Public booking confirmation usually requires an approved Meta template.

## 4. Reminder Rules Workflow

Reminder rules reduce no-shows and keep customers aware of upcoming appointments.

Recommended starter setup:

1. 24 hours before appointment.
2. 2 hours before appointment.
3. 15 minutes before appointment.
4. Follow-up after visit.

### Template reminders

Use approved WhatsApp templates when:

1. The customer has not messaged you recently.
2. The reminder is outside the 24-hour WhatsApp customer service window.
3. You need reliable delivery for confirmations and reminders.

### Custom message reminders

Use custom plain text messages when:

1. You are testing simple reminder wording.
2. The customer recently messaged your WhatsApp number.
3. You want flexible text without Meta template approval.

Recommended custom reminder:

```text
Hi {{customer_name}}, this is a reminder for your appointment at {{business}} with {{staff}} on {{date}} at {{time}}. Reply here if you need to reschedule.
```

What to test:

1. Create an appointment 15 to 30 minutes in the future.
2. Add a reminder rule before the start time.
3. Wait for the scheduler window or restart if you are testing immediately.
4. Open the appointment reminder timeline.
5. Confirm the reminder status is scheduled, sent, or failed.
6. Confirm the customer received the WhatsApp message.

Common mistake:
A reminder can show as attempted in the app, but WhatsApp may reject it if the template parameters are wrong or if plain text is sent outside the 24-hour window.

## 5. WhatsApp Templates Best Practices

WhatsApp templates are approved message formats from Meta. They are required for many business-initiated messages.

Use templates for:

1. Booking confirmations.
2. Appointment reminders.
3. Follow-up messages.
4. Re-engagement messages.
5. Messages sent outside the 24-hour customer service window.

Good template rules:

1. Keep the wording clear and useful.
2. Do not start or end the template with a variable.
3. Use variables only where needed.
4. Keep the number of variables stable.
5. Use examples that look real when submitting to Meta.

Example confirmation template:

```text
Hi {{1}}, your appointment at {{2}} is confirmed for {{3}} with {{4}}. We look forward to seeing you.
```

Example reminder template:

```text
Hi {{1}}, reminder: your appointment at {{2}} with {{3}} is at {{4}}. Reply here if you need help.
```

Common mistake:
If Meta says the number of parameters does not match, the template expects a different number or order of variables than Tawasel sent. Sync templates and test again.

## 6. Contacts and CRM Workflow

Contacts can enter Tawasel from WhatsApp, Instagram, public booking, manual creation, or imports.

Daily contact workflow:

1. Open Contacts.
2. Check new contacts.
3. Merge duplicate same-number contacts.
4. Add missing names when possible.
5. Assign lead source.
6. Add contacts to lists if needed.
7. Move sales leads through CRM stages.

CRM stages should answer one question:
Where is this customer in our sales or booking process?

Suggested simple stages:

1. New Lead.
2. Contacted.
3. Qualified.
4. Booked.
5. Won.
6. Lost.

Best practice:
Keep CRM stages simple at first. Too many stages make the team slower.

Common mistake:
Do not create multiple contacts with the same phone number. If duplicates already exist, merge them instead of deleting history.

## 7. Instagram Inbox Setup Basics

Instagram setup depends on Meta requirements.

Before connecting:

1. The Instagram account must be Business or Creator.
2. The Instagram account must be linked to a Facebook Page.
3. The person connecting must manage that Facebook Page.
4. The Meta app must have the required permissions.
5. Webhooks must be subscribed correctly.

Expected result:
Instagram DMs appear in the same Inbox, and replies from Tawasel are sent back to Instagram.

Best practice:
For Meta App Review, record a real test video showing a DM arriving in Tawasel and a reply arriving back in Instagram.

Common mistake:
Adding someone as an app tester is not always enough. The Instagram account must also be connected correctly to the Facebook Page and accepted where Meta requires it.

## 8. Arabic and English Usage

Tawasel supports Arabic and English workflows.

Use Arabic when:

1. Your customers mainly speak Arabic.
2. Your staff operates in Arabic.
3. You are sending Arabic WhatsApp templates.
4. Your public booking link is shared with Arabic-speaking customers.

Use English when:

1. Your team prefers English.
2. Customers are mixed Arabic and English.
3. You are creating internal reports or sales workflows.

Best practice:
Create separate Arabic and English WhatsApp templates for important messages. Do not mix both languages inside one long template unless your customers expect bilingual messages.

## 9. Team Roles and Assignment

Use team roles to keep control of the workspace.

Suggested role usage:

1. Owner: billing, workspace control, sensitive settings.
2. Admin: team management and setup.
3. User: daily inbox, CRM, appointments, and customer replies.

Daily assignment workflow:

1. New message arrives.
2. Agent checks the conversation.
3. Conversation is assigned to the right person.
4. Agent replies or books appointment.
5. Internal note is added if context matters.
6. Conversation is resolved when done.

Best practice:
Every active conversation should have either a clear owner or a clear reason why it is unassigned.

Common mistake:
Do not share one login across the whole team. It makes accountability and reporting unreliable.

## 10. 30-Day Trial Success Checklist

The trial should prove business value, not just feature access.

### Day 1

1. Connect WhatsApp.
2. Add services.
3. Add staff.
4. Test public booking link.
5. Send one real reply from Inbox.

### Week 1

1. Add or import first contacts.
2. Create first booking.
3. Confirm WhatsApp confirmation works.
4. Create reminder rules.
5. Move leads through CRM stages.

### Week 2

1. Assign conversations to team members.
2. Use internal notes.
3. Check stale leads.
4. Merge duplicate contacts.
5. Review dashboard daily.

### Week 3

1. Test Instagram inbox if connected.
2. Improve WhatsApp templates.
3. Clean CRM stages.
4. Review no-shows and reminder performance.

### Week 4

1. Count total conversations handled.
2. Count bookings created.
3. Count customers recovered from stale leads.
4. Estimate no-shows reduced.
5. Decide whether Tawasel is worth continuing.

Success question:
Did Tawasel help you save time, capture leads, reduce missed messages, or increase bookings?

## 11. Common Problems and Fixes

### Confirmation message did not arrive

Check:

1. Is the WhatsApp number connected?
2. Is the confirmation template approved?
3. Does the template variable count match?
4. Does the customer phone number include the country code?

### Reminder says sent but customer did not receive it

Check:

1. Was it a template or plain text?
2. Was the customer outside the 24-hour window?
3. Was the template approved by Meta?
4. Did server logs show a Meta error?

### Booking link still has old name

This is normal if the slug was created before the name change. The link stays stable so old links keep working.

### Duplicate contacts appeared

Usually this happens when the same number exists in different formats. Use merge duplicate contacts and keep the contact with the best history.

### Instagram messages do not appear

Check:

1. Instagram account is Business or Creator.
2. Instagram account is linked to a Facebook Page.
3. Page permissions are approved.
4. Webhook subscription is active.
5. The sender is not the same business account.

## 12. Best Practice Operating Rhythm

Morning:
Check unread messages, stale leads, and today appointments.

Midday:
Assign open conversations and confirm reminder timeline for upcoming bookings.

Evening:
Resolve handled conversations, review missed leads, and prepare tomorrow appointments.

Weekly:
Review dashboard, CRM stages, duplicate contacts, templates, and reminder rules.

The goal is simple:
Every customer message should have an owner, every booking should have a confirmation, and every important appointment should have a reminder.

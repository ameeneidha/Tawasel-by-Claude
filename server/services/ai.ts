import prisma from "../../src/lib/prisma.js";
import {
  openai,
  FIXED_CHATBOT_MODEL,
  APPENDED_CHATBOT_SAFETY_INSTRUCTIONS,
  GPT_4_1_MINI_INPUT_COST_PER_1M,
  GPT_4_1_MINI_CACHED_INPUT_COST_PER_1M,
  GPT_4_1_MINI_OUTPUT_COST_PER_1M,
  WORKSPACE_PLAN_LIMITS,
  applyChannelFeatureFlagsToPlanLimits,
  getWorkspacePlanLimits,
} from "../config.js";

// ── AI Quota ──────────────────────────────────────────────────────

export async function getWorkspaceAiUsageThisMonth(workspaceId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return prisma.usageLog.count({
    where: {
      workspaceId,
      type: "AI_TOKEN",
      createdAt: { gte: startOfMonth },
    },
  });
}

export async function checkAiQuota(
  workspaceId: string | null | undefined
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (!workspaceId) {
    return { allowed: false, used: 0, limit: 0 };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });

  const limits = getWorkspacePlanLimits(workspace?.plan);
  const used = await getWorkspaceAiUsageThisMonth(workspaceId);

  return {
    allowed: used < limits.aiMessagesPerMonth,
    used,
    limit: limits.aiMessagesPerMonth,
  };
}

// ── Billing ────────────────────────────────────────────────────────

export const roundBillingAmount = (value: number) =>
  Number(value.toFixed(6));

export const getOpenAIUsageBreakdown = (usage: any) => {
  const promptTokens = Number(usage?.prompt_tokens || 0);
  const completionTokens = Number(usage?.completion_tokens || 0);
  const cachedPromptTokens = Number(
    usage?.prompt_tokens_details?.cached_tokens ||
      usage?.input_tokens_details?.cached_tokens ||
      0
  );
  const billablePromptTokens = Math.max(
    promptTokens - cachedPromptTokens,
    0
  );
  const totalTokens = Number(
    usage?.total_tokens || promptTokens + completionTokens
  );

  return {
    promptTokens,
    cachedPromptTokens,
    billablePromptTokens,
    completionTokens,
    totalTokens,
  };
};

export const calculateGpt41MiniCostUsd = (usage: any) => {
  const breakdown = getOpenAIUsageBreakdown(usage);

  const inputCost =
    (breakdown.billablePromptTokens / 1_000_000) *
    GPT_4_1_MINI_INPUT_COST_PER_1M;
  const cachedInputCost =
    (breakdown.cachedPromptTokens / 1_000_000) *
    GPT_4_1_MINI_CACHED_INPUT_COST_PER_1M;
  const outputCost =
    (breakdown.completionTokens / 1_000_000) * GPT_4_1_MINI_OUTPUT_COST_PER_1M;

  return {
    ...breakdown,
    inputCost,
    cachedInputCost,
    outputCost,
    totalCost: inputCost + cachedInputCost + outputCost,
  };
};

export async function recordAiUsage(
  workspaceId: string | null | undefined,
  description: string,
  usage: any,
  model = FIXED_CHATBOT_MODEL
) {
  if (!workspaceId) return null;

  const costBreakdown = calculateGpt41MiniCostUsd(usage);
  if (costBreakdown.totalTokens <= 0) return null;

  const roundedCost = roundBillingAmount(costBreakdown.totalCost);
  const ledgerDescription = `${description} (${model}) - ${costBreakdown.totalTokens} tokens`;

  await prisma.$transaction([
    prisma.usageLog.create({
      data: {
        workspaceId,
        type: "AI_TOKEN",
        quantity: costBreakdown.totalTokens,
        cost: roundedCost,
      },
    }),
    prisma.billingLedgerEntry.create({
      data: {
        workspaceId,
        amount: roundedCost,
        type: "DEBIT",
        description: ledgerDescription,
      },
    }),
  ]);

  return {
    ...costBreakdown,
    totalCost: roundedCost,
    description: ledgerDescription,
  };
}

// ── Appointment Booking Tools (OpenAI Function Calling) ──────────

// ── Escalation Tool ────────────────────────────────────────────────

const ESCALATION_TOOL = {
  type: "function",
  function: {
    name: "escalate_to_agent",
    description:
      "Escalate the conversation to a human agent. Call this when: (1) the customer explicitly asks to speak to a human/agent/person, (2) you cannot answer the customer's question after trying, (3) the customer is frustrated or upset, (4) the request requires human judgment (refunds, complaints, complex issues), (5) you've failed to help after 2-3 attempts.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Brief reason for escalation (e.g. 'Customer requested human agent', 'Cannot answer technical question', 'Customer is frustrated')",
        },
      },
      required: ["reason"],
    },
  },
};

const APPOINTMENT_TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "list_services",
      description:
        "List all available services the customer can book (e.g. haircut, consultation, massage). Call this when a customer asks what services are available or wants to book.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_staff",
      description:
        "List available staff members. Optionally filter by a specific service ID to show only staff who provide that service.",
      parameters: {
        type: "object",
        properties: {
          serviceId: {
            type: "string",
            description: "Optional service ID to filter staff by",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check available time slots for a specific staff member and service on a given date. Returns a list of bookable time slots.",
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string", description: "The service ID" },
          staffId: { type: "string", description: "The staff member ID" },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format",
          },
        },
        required: ["serviceId", "staffId", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Book an appointment for the customer. Only call this after confirming service, staff, date, and time slot with the customer.",
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string", description: "The service ID" },
          staffId: { type: "string", description: "The staff member ID" },
          startTime: {
            type: "string",
            description: "ISO 8601 datetime for the appointment start",
          },
          notes: {
            type: "string",
            description: "Optional notes from the customer",
          },
        },
        required: ["serviceId", "staffId", "startTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_appointments",
      description:
        "Look up the customer's own upcoming appointments. Call this when the customer asks things like 'do I have an appointment?', 'when is my appointment?', 'show my bookings'. Returns only the caller's own appointments — never another person's.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_my_appointment",
      description:
        "Reschedule one of the customer's own upcoming appointments to a new time. Always confirm the new time with the customer first. Only works on appointments belonging to this customer.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: {
            type: "string",
            description: "The appointment ID (from get_my_appointments)",
          },
          newStartTime: {
            type: "string",
            description: "New ISO 8601 datetime for the appointment start",
          },
        },
        required: ["appointmentId", "newStartTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_my_appointment",
      description:
        "Cancel one of the customer's own upcoming appointments. Always confirm with the customer before calling. Only works on appointments belonging to this customer.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: {
            type: "string",
            description: "The appointment ID (from get_my_appointments)",
          },
        },
        required: ["appointmentId"],
      },
    },
  },
];

async function executeAppointmentTool(
  toolName: string,
  args: any,
  workspaceId: string,
  contactId: string
): Promise<string> {
  try {
    if (toolName === "list_services") {
      const services = await prisma.service.findMany({
        where: { workspaceId, enabled: true },
        select: {
          id: true,
          name: true,
          description: true,
          durationMin: true,
          price: true,
          currency: true,
        },
      });
      if (services.length === 0)
        return JSON.stringify({
          message: "No services are currently available for booking.",
        });
      return JSON.stringify(services);
    }

    if (toolName === "list_staff") {
      const where: any = { workspaceId, enabled: true };
      if (args.serviceId) {
        where.staffServices = { some: { serviceId: args.serviceId } };
      }
      const staffMembers = await prisma.staffMember.findMany({
        where,
        select: { id: true, name: true },
      });
      // Also include staff with NO service assignments (generalists)
      if (args.serviceId) {
        const generalists = await prisma.staffMember.findMany({
          where: {
            workspaceId,
            enabled: true,
            staffServices: { none: {} },
          },
          select: { id: true, name: true },
        });
        const ids = new Set(staffMembers.map((s) => s.id));
        for (const g of generalists) {
          if (!ids.has(g.id)) staffMembers.push(g);
        }
      }
      if (staffMembers.length === 0)
        return JSON.stringify({
          message: "No staff members are currently available.",
        });
      return JSON.stringify(staffMembers);
    }

    if (toolName === "check_availability") {
      const { serviceId, staffId, date } = args;
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (!service)
        return JSON.stringify({ error: "Service not found" });

      const staffMember = await prisma.staffMember.findUnique({
        where: { id: staffId },
      });
      if (!staffMember)
        return JSON.stringify({ error: "Staff member not found" });

      // Parse working hours
      let workingHours: Record<string, any> = {};
      try {
        workingHours = JSON.parse(staffMember.workingHours || "{}");
      } catch {}

      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const targetDate = new Date(date + "T00:00:00");
      const dayKey = dayNames[targetDate.getDay()];
      const dayHours = workingHours[dayKey];

      if (!dayHours || !dayHours.start || !dayHours.end) {
        return JSON.stringify({
          message: `${staffMember.name} is not available on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}s.`,
          slots: [],
        });
      }

      // Get existing appointments for that day
      const dayStart = new Date(date + "T00:00:00");
      const dayEnd = new Date(date + "T23:59:59");
      const existing = await prisma.appointment.findMany({
        where: {
          staffId,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          startTime: { gte: dayStart },
          endTime: { lte: dayEnd },
        },
      });

      // Generate available slots
      const [startH, startM] = dayHours.start.split(":").map(Number);
      const [endH, endM] = dayHours.end.split(":").map(Number);
      const slots: string[] = [];
      const cursor = new Date(targetDate);
      cursor.setHours(startH, startM, 0, 0);
      const workEnd = new Date(targetDate);
      workEnd.setHours(endH, endM, 0, 0);

      while (cursor.getTime() + service.durationMin * 60000 <= workEnd.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(
          cursor.getTime() + service.durationMin * 60000
        );
        const overlaps = existing.some(
          (a) =>
            new Date(a.startTime).getTime() < slotEnd.getTime() &&
            new Date(a.endTime).getTime() > slotStart.getTime()
        );
        if (!overlaps) {
          slots.push(slotStart.toISOString());
        }
        cursor.setMinutes(cursor.getMinutes() + 30);
      }

      // Filter out past slots if date is today
      const now = new Date();
      const available = slots.filter((s) => new Date(s).getTime() > now.getTime());

      return JSON.stringify({
        staff: staffMember.name,
        service: service.name,
        date,
        slots: available.map((s) =>
          new Date(s).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        ),
        slotsISO: available,
        message:
          available.length === 0
            ? `No available slots on ${date} for ${staffMember.name}.`
            : `${available.length} slot(s) available.`,
      });
    }

    if (toolName === "book_appointment") {
      const { serviceId, staffId, startTime, notes } = args;

      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (!service)
        return JSON.stringify({ error: "Service not found" });

      const start = new Date(startTime);
      const end = new Date(start.getTime() + service.durationMin * 60000);

      // Check overlap
      const overlap = await prisma.appointment.findFirst({
        where: {
          staffId,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
      });
      if (overlap)
        return JSON.stringify({
          error:
            "That time slot is no longer available. Please choose another slot.",
        });

      // Check monthly limit
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { plan: true },
      });
      const limits = getWorkspacePlanLimits(workspace?.plan);
      const nowDate = new Date();
      const startOfMonth = new Date(
        nowDate.getFullYear(),
        nowDate.getMonth(),
        1
      );
      const monthCount = await prisma.appointment.count({
        where: { workspaceId, createdAt: { gte: startOfMonth } },
      });
      if (monthCount + 1 > limits.appointmentsPerMonth)
        return JSON.stringify({
          error:
            "Monthly appointment limit reached. Please contact the business directly.",
        });

      const appointment = await prisma.appointment.create({
        data: {
          workspaceId,
          contactId,
          serviceId,
          staffId,
          startTime: start,
          endTime: end,
          notes: notes || null,
          status: "CONFIRMED",
        },
        include: {
          service: { select: { name: true } },
          staff: { select: { name: true } },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          type: "APPOINTMENT_BOOKED",
          content: `AI booked: ${appointment.service.name} with ${appointment.staff.name} on ${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          contactId,
          workspaceId,
        },
      });

      return JSON.stringify({
        success: true,
        appointmentId: appointment.id,
        service: appointment.service.name,
        staff: appointment.staff.name,
        date: start.toLocaleDateString(),
        time: start.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        durationMin: service.durationMin,
        price: service.price,
        currency: service.currency,
        status: "CONFIRMED",
      });
    }

    if (toolName === "get_my_appointments") {
      // ⚠️ Security: scope strictly to this contact. contactId is derived server-side
      // from the conversation, never from LLM args — prevents enumeration / cross-user leaks.
      if (!contactId) return JSON.stringify({ error: "Contact not identified." });

      const now = new Date();
      const appts = await prisma.appointment.findMany({
        where: {
          workspaceId,
          contactId,
          status: { notIn: ["CANCELLED"] },
          endTime: { gte: now }, // upcoming only
        },
        orderBy: { startTime: "asc" },
        take: 5,
        select: {
          id: true,
          startTime: true,
          status: true,
          service: { select: { name: true, durationMin: true } },
          staff: { select: { name: true } },
        },
      });

      if (appts.length === 0) {
        return JSON.stringify({
          count: 0,
          message: "You don't have any upcoming appointments with us.",
        });
      }

      return JSON.stringify({
        count: appts.length,
        appointments: appts.map((a) => ({
          id: a.id,
          service: a.service.name,
          staff: a.staff.name,
          date: a.startTime.toLocaleDateString(),
          time: a.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
          durationMin: a.service.durationMin,
          status: a.status,
        })),
      });
    }

    if (toolName === "reschedule_my_appointment") {
      if (!contactId) return JSON.stringify({ error: "Contact not identified." });
      const { appointmentId, newStartTime } = args;

      // ⚠️ Ownership check: only allow reschedule if appt belongs to caller + workspace.
      const appt = await prisma.appointment.findFirst({
        where: { id: appointmentId, workspaceId, contactId },
        include: { service: true },
      });
      if (!appt) return JSON.stringify({ error: "Appointment not found or not yours." });
      if (appt.status === "CANCELLED" || appt.status === "COMPLETED") {
        return JSON.stringify({ error: `Cannot reschedule a ${appt.status.toLowerCase()} appointment.` });
      }

      const newStart = new Date(newStartTime);
      if (isNaN(newStart.getTime()) || newStart.getTime() < Date.now()) {
        return JSON.stringify({ error: "New time must be in the future." });
      }
      const newEnd = new Date(newStart.getTime() + appt.service.durationMin * 60000);

      // Conflict check against same staff
      const overlap = await prisma.appointment.findFirst({
        where: {
          staffId: appt.staffId,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          id: { not: appt.id },
          startTime: { lt: newEnd },
          endTime: { gt: newStart },
        },
      });
      if (overlap) {
        return JSON.stringify({ error: "That time slot is already taken. Please choose another." });
      }

      const updated = await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          startTime: newStart,
          endTime: newEnd,
          // Reset reminder flags so new reminders fire for the new time
          reminderSentAt: null,
          reminder1hSentAt: null,
        },
        include: { service: { select: { name: true } }, staff: { select: { name: true } } },
      });

      await prisma.activityLog.create({
        data: {
          type: "APPOINTMENT_RESCHEDULED",
          content: `Customer rescheduled via AI: ${updated.service.name} with ${updated.staff.name} → ${newStart.toLocaleString()}`,
          contactId,
          workspaceId,
        },
      });

      return JSON.stringify({
        success: true,
        appointmentId: updated.id,
        service: updated.service.name,
        staff: updated.staff.name,
        date: newStart.toLocaleDateString(),
        time: newStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
      });
    }

    if (toolName === "cancel_my_appointment") {
      if (!contactId) return JSON.stringify({ error: "Contact not identified." });
      const { appointmentId } = args;

      // ⚠️ Ownership check
      const appt = await prisma.appointment.findFirst({
        where: { id: appointmentId, workspaceId, contactId },
        include: { service: { select: { name: true } }, staff: { select: { name: true } } },
      });
      if (!appt) return JSON.stringify({ error: "Appointment not found or not yours." });
      if (appt.status === "CANCELLED") {
        return JSON.stringify({ error: "This appointment is already cancelled." });
      }
      if (appt.status === "COMPLETED") {
        return JSON.stringify({ error: "Cannot cancel a completed appointment." });
      }

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: "CANCELLED" },
      });

      await prisma.activityLog.create({
        data: {
          type: "APPOINTMENT_CANCELLED",
          content: `Customer cancelled via AI: ${appt.service.name} with ${appt.staff.name} on ${appt.startTime.toLocaleString()}`,
          contactId,
          workspaceId,
        },
      });

      return JSON.stringify({
        success: true,
        message: `Your ${appt.service.name} appointment on ${appt.startTime.toLocaleDateString()} at ${appt.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })} has been cancelled.`,
      });
    }

    return JSON.stringify({ error: "Unknown tool" });
  } catch (error: any) {
    console.error(`[AI Tool Error: ${toolName}]`, error);
    return JSON.stringify({ error: "Something went wrong. Please try again." });
  }
}

// ── Check if workspace has appointment services (to decide if tools should be enabled) ──

async function workspaceHasAppointmentServices(
  workspaceId: string
): Promise<boolean> {
  const count = await prisma.service.count({
    where: { workspaceId, enabled: true },
  });
  return count > 0;
}

// ── AI Functions ───────────────────────────────────────────────────

export interface AIResponseResult {
  text: string;
  escalated?: boolean;
  escalationReason?: string;
}

export async function getAIResponse(
  chatbot: any,
  message: string,
  context?: { workspaceId?: string; contactId?: string; conversationId?: string }
): Promise<AIResponseResult> {
  try {
    const quota = await checkAiQuota(chatbot.workspaceId);
    if (!quota.allowed) {
      console.warn(
        `AI quota exceeded for workspace ${chatbot.workspaceId}: ${quota.used}/${quota.limit}`
      );
      return { text: "", escalated: false };
    }

    if (!openai) return { text: "", escalated: false };

    const workspaceId = context?.workspaceId || chatbot.workspaceId;
    const contactId = context?.contactId || "";

    // Check if this workspace has appointment services → enable booking tools
    const hasServices = await workspaceHasAppointmentServices(workspaceId);

    // Build conversation history for context (last 10 messages)
    let conversationMessages: any[] = [];
    if (context?.conversationId) {
      const recent = await prisma.message.findMany({
        where: { conversationId: context.conversationId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          content: true,
          direction: true,
          senderType: true,
          type: true,
          transcription: true,
          transcriptionStatus: true,
        },
      });
      conversationMessages = recent.reverse().map((m) => ({
        role: m.direction === "INCOMING" ? "user" : "assistant",
        content:
          m.type === "AUDIO" && m.transcriptionStatus === "COMPLETED" && m.transcription?.trim()
            ? m.transcription.trim()
            : m.content,
      }));
    }

    const systemPrompt = [
      chatbot.instructions?.trim(),
      hasServices
        ? `# Appointment Booking & Self-Service
You can help customers with the full appointment lifecycle. Tools available:
1. list_services — show what can be booked
2. list_staff — show staff (optionally filtered by service)
3. check_availability — show open slots for a staff + service + date
4. book_appointment — create a new booking (confirm details first)
5. get_my_appointments — look up the customer's OWN upcoming appointments (use when they ask "do I have an appointment?", "when is my booking?", etc.)
6. reschedule_my_appointment — move the customer's OWN appointment to a new time (confirm first)
7. cancel_my_appointment — cancel the customer's OWN appointment (confirm first)

Rules:
- For booking: guide step by step (service → staff → date → time → confirm).
- For reschedule/cancel: always call get_my_appointments first to get the correct appointmentId, then confirm with the customer before calling reschedule/cancel.
- You can ONLY view/modify appointments belonging to THIS customer (their phone number). If they ask about someone else's appointment, politely decline.
- Keep appointment details brief and generic in responses — do not expose internal notes, IDs, or other customers' info.
- When showing times, use a friendly format (e.g., "10:00 AM", "2:30 PM").
- Today's date is ${new Date().toISOString().slice(0, 10)}.`
        : "",
      `# Escalation to Human Agent
You have the ability to escalate conversations to a human agent. Use the escalate_to_agent tool when:
- The customer explicitly asks to speak to a human, agent, representative, or person
- You cannot answer the customer's question after trying your best
- The customer seems frustrated, angry, or dissatisfied with your responses
- The request involves refunds, complaints, account issues, or other sensitive matters that require human judgment
- You've attempted to help 2-3 times but the customer is still not satisfied

When escalating, provide a brief reason. After escalating, send a polite message letting the customer know a team member will assist them shortly.`,
      APPENDED_CHATBOT_SAFETY_INSTRUCTIONS,
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationMessages,
      { role: "user", content: message },
    ];

    // Build tools array — always include escalation, optionally include appointment tools
    const allTools = [ESCALATION_TOOL, ...(hasServices ? APPOINTMENT_TOOLS : [])];

    // First API call
    const completionParams: any = {
      model: FIXED_CHATBOT_MODEL,
      messages,
      tools: allTools,
      tool_choice: "auto",
    };

    let completion = await openai.chat.completions.create(completionParams);
    let totalUsage = completion.usage;
    let responseMsg = completion.choices[0].message;

    // Tool calling loop (max 5 iterations to prevent runaway)
    let iterations = 0;
    let escalated = false;
    let escalationReason = "";

    while (responseMsg.tool_calls && responseMsg.tool_calls.length > 0 && iterations < 5) {
      iterations++;

      // Add assistant message with tool calls
      messages.push(responseMsg);

      // Execute each tool call
      for (const toolCall of responseMsg.tool_calls) {
        const tc = toolCall as any;
        const fnName = tc.function.name;
        const fnArgs = JSON.parse(tc.function.arguments || "{}");

        console.log(`[AI Tool Call] ${fnName}`, fnArgs);

        // Handle escalation tool
        if (fnName === "escalate_to_agent") {
          escalated = true;
          escalationReason = fnArgs.reason || "AI could not resolve the issue";
          console.log(`[AI Escalation] Reason: ${escalationReason}`);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              success: true,
              message: "Escalation successful. A human agent will be notified. Send a polite message to the customer letting them know.",
            }),
          });
          continue;
        }

        const result = await executeAppointmentTool(
          fnName,
          fnArgs,
          workspaceId,
          contactId
        );

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Call OpenAI again with tool results
      completion = await openai.chat.completions.create({
        model: FIXED_CHATBOT_MODEL,
        messages,
        tools: allTools,
        tool_choice: "auto",
      });

      // Accumulate token usage
      if (completion.usage && totalUsage) {
        totalUsage = {
          ...totalUsage,
          prompt_tokens: (totalUsage.prompt_tokens || 0) + (completion.usage.prompt_tokens || 0),
          completion_tokens: (totalUsage.completion_tokens || 0) + (completion.usage.completion_tokens || 0),
          total_tokens: (totalUsage.total_tokens || 0) + (completion.usage.total_tokens || 0),
        };
      }

      responseMsg = completion.choices[0].message;
    }

    await recordAiUsage(
      chatbot.workspaceId,
      `AI chatbot reply - ${chatbot.name}`,
      totalUsage
    );

    return {
      text: responseMsg.content || "",
      escalated,
      escalationReason,
    };
  } catch (error) {
    console.error("AI Response Error:", error);
  }
  return { text: "", escalated: false };
}

export async function generateAISummary(
  conversationHistory: { content: string; senderType: string }[],
  workspaceId?: string | null
) {
  const quota = await checkAiQuota(workspaceId);
  if (!quota.allowed) {
    return "";
  }

  const historyString = conversationHistory
    .map((msg) => `${msg.senderType}: ${msg.content}`)
    .join("\n");

  const prompt = `
    Summarize the following conversation history between a customer and a business in the UAE.
    Highlight the main intent, key issues, and any next steps for the agent.
    Keep it concise (max 3 sentences).

    Conversation History:
    ${historyString}
  `;

  try {
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: FIXED_CHATBOT_MODEL,
        messages: [{ role: "user", content: prompt }],
      });
      await recordAiUsage(
        workspaceId,
        "AI conversation summary",
        completion.usage
      );
      return completion.choices[0].message.content || "";
    }
  } catch (error) {
    console.error("AI Summary Error:", error);
  }

  return "";
}

function parseSuggestionPayload(payload: string) {
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (Array.isArray(parsed?.suggestions))
      return parsed.suggestions.map(String).filter(Boolean);
  } catch {
    const arrayMatch = payload.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        return [];
      }
    }
  }

  return [];
}

export async function generateAIReplySuggestions(
  conversationHistory: { content: string; senderType: string }[],
  workspaceId?: string | null
) {
  const quota = await checkAiQuota(workspaceId);
  if (!quota.allowed) {
    return [];
  }

  const historyString = conversationHistory
    .map((msg) => `${msg.senderType}: ${msg.content}`)
    .join("\n");

  const prompt = `
    You are an AI assistant helping a customer support agent.
    Based on the following conversation history, suggest 3 concise and professional reply options for the agent.
    The business is based in the UAE.

    Conversation History:
    ${historyString}

    Return only a JSON array of strings.
    Example: ["Sure, I can help with that.", "What is your order number?", "Our office is in Dubai."]
  `;

  try {
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: FIXED_CHATBOT_MODEL,
        messages: [{ role: "user", content: prompt }],
      });
      await recordAiUsage(
        workspaceId,
        "AI reply suggestions",
        completion.usage
      );

      const content = completion.choices[0].message.content || "";
      const parsed = parseSuggestionPayload(content);
      if (parsed.length) return parsed;
    }
  } catch (error) {
    console.error("AI Reply Suggestions Error:", error);
  }

  return [];
}

// ── Billing Summaries ──────────────────────────────────────────────

export async function getWorkspaceBillingSummary(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });

  const [ledger, usageLogs, aiMessagesUsedThisMonth] = await Promise.all([
    prisma.billingLedgerEntry.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.usageLog.findMany({
      where: {
        workspaceId,
        type: "AI_TOKEN",
      },
      orderBy: { createdAt: "desc" },
    }),
    getWorkspaceAiUsageThisMonth(workspaceId),
  ]);

  const limits = getWorkspacePlanLimits(workspace?.plan);

  const totalCredits = ledger
    .filter((entry) => entry.type === "CREDIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalDebits = ledger
    .filter((entry) => entry.type === "DEBIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const balance = totalCredits - totalDebits;
  const aiTokensUsed = usageLogs.reduce(
    (sum, entry) => sum + entry.quantity,
    0
  );
  const aiSpend = usageLogs.reduce((sum, entry) => sum + entry.cost, 0);

  return {
    balance: roundBillingAmount(balance),
    totalCredits: roundBillingAmount(totalCredits),
    totalDebits: roundBillingAmount(totalDebits),
    aiTokensUsed,
    aiSpend: roundBillingAmount(aiSpend),
    usageEvents: usageLogs.length,
    aiMessagesUsedThisMonth,
    aiMessagesLimit: limits.aiMessagesPerMonth,
    ledger,
    usageLogs,
  };
}

export const getPlanLimitSnapshot = (plan?: string | null) =>
  applyChannelFeatureFlagsToPlanLimits(
    WORKSPACE_PLAN_LIMITS[(plan || "").toUpperCase()] || {
      users: 1,
      whatsapp: 1,
      instagram: 1,
      chatbots: 1,
      contacts: 1000,
      broadcasts: 500,
      automations: 3,
      aiMessagesPerMonth: 1000,
      services: 5,
      staffMembers: 1,
      appointmentsPerMonth: 100,
    }
  );

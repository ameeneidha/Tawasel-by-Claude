import dotenv from "dotenv";
dotenv.config();

import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 0.2,
  });
}

import { Worker, Job } from "bullmq";
import prisma from "../src/lib/prisma.js";
import { redisConnection, WEBHOOK_QUEUE_NAME, SOCKET_EVENTS_CHANNEL } from "./lib/redis.js";
import { processMetaWebhook, WebhookContext } from "./services/webhookProcessor.js";
import IORedis from "ioredis";

// Dedicated publisher connection for socket-event relay
const publisher = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

const emitViaRedis = (room: string, event: string, data: any) => {
  publisher
    .publish(SOCKET_EVENTS_CHANNEL, JSON.stringify({ room, event, data }))
    .catch((err) => console.error("[worker] Redis publish failed:", err));
};

const ctx: WebhookContext = { emit: emitViaRedis };

const worker = new Worker(
  WEBHOOK_QUEUE_NAME,
  async (job: Job) => {
    const body = job.data?.body;
    if (!body) {
      console.warn(`[worker] Job ${job.id} has no body, skipping`);
      return;
    }
    try {
      await processMetaWebhook(body, ctx);
    } catch (error) {
      console.error(`[worker] Job ${job.id} failed:`, error);
      Sentry.captureException(error, { tags: { component: "webhook-worker", jobId: String(job.id) } });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.WEBHOOK_WORKER_CONCURRENCY || 10),
  }
);

worker.on("ready", () => {
  console.log(`[worker] Ready — listening on queue "${WEBHOOK_QUEUE_NAME}"`);
});

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed permanently:`, err?.message);
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, closing...`);
  try {
    await worker.close();
    await publisher.quit();
    await redisConnection.quit();
    await Sentry.close(2000);
    await prisma.$disconnect();
  } catch (e) {
    console.error("[worker] Shutdown error:", e);
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

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

import { Queue, Worker, Job } from "bullmq";
import prisma from "../src/lib/prisma.js";
import { redisConnection, WEBHOOK_QUEUE_NAME, SOCKET_EVENTS_CHANNEL, TRANSCRIBE_AUDIO_JOB_NAME } from "./lib/redis.js";
import { processMetaWebhook, WebhookContext } from "./services/webhookProcessor.js";
import { processAudioTranscription } from "./services/transcription.js";
import IORedis from "ioredis";

// Dedicated publisher connection for socket-event relay
const publisher = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

const queue = new Queue(WEBHOOK_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 5000 },
  },
});

const emitViaRedis = (room: string, event: string, data: any) => {
  publisher
    .publish(SOCKET_EVENTS_CHANNEL, JSON.stringify({ room, event, data }))
    .catch((err) => console.error("[worker] Redis publish failed:", err));
};

const ctx: WebhookContext = {
  emit: emitViaRedis,
  enqueueAudioTranscription: async (data) => {
    await queue.add(TRANSCRIBE_AUDIO_JOB_NAME, data);
  },
};

const worker = new Worker(
  WEBHOOK_QUEUE_NAME,
  async (job: Job) => {
    if (job.name === TRANSCRIBE_AUDIO_JOB_NAME) {
      try {
        await processAudioTranscription(job.data, ctx);
      } catch (error) {
        console.error(`[worker] Transcription job ${job.id} failed:`, error);
        Sentry.captureException(error, { tags: { component: "transcription-worker", jobId: String(job.id) } });
        throw error;
      }
      return;
    }

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
    await queue.close();
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

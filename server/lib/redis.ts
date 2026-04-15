import IORedis from "ioredis";

export const redisConnection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

export const WEBHOOK_QUEUE_NAME = "meta-webhooks";
export const SOCKET_EVENTS_CHANNEL = "socket-events";

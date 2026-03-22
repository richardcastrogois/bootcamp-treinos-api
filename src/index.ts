//backend/src/index.ts
import "dotenv/config";

import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

import { auth } from "./lib/auth.js";
import { env } from "./lib/env.js";
import { aiRoutes } from "./routes/ai.js";
import { bootstrapRoutes } from "./routes/bootstrap.js";
import { homeRoutes } from "./routes/home.js";
import { meRoutes } from "./routes/me.js";
import { mobileAuthRoutes } from "./routes/mobile-auth.js";
import { mobileBootstrapRoutes } from "./routes/mobile-bootstrap.js";
import { mobileHomeRoutes } from "./routes/mobile-home.js";
import { mobileOnboardingRoutes } from "./routes/mobile-onboarding.js";
import { mobileProfileRoutes } from "./routes/mobile-profile.js";
import { mobileStatsRoutes } from "./routes/mobile-stats.js";
import { mobileWorkoutPlanRoutes } from "./routes/mobile-workout-plans.js";
import { statsRoutes } from "./routes/stats.js";
import { workoutPlanRoutes } from "./routes/workout-plan.js";

const envToLogger = {
  development: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
  production: true,
  test: false,
} as const;

const isProduction = env.NODE_ENV === "production";

const allowedOrigins = new Set([
  env.WEB_APP_BASE_URL,
  ...env.TRUSTED_ORIGINS_LIST,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const app = Fastify({
  logger: envToLogger[env.NODE_ENV],
  bodyLimit: 1024 * 1024,
  disableRequestLogging: isProduction,
  requestIdHeader: "x-request-id",
  requestIdLogLabel: "requestId",
  genReqId: () => crypto.randomUUID(),
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.addHook("onRequest", async (request, reply) => {
  request.log.info(
    {
      method: request.method,
      url: request.url,
      ip: request.ip,
    },
    "request_started",
  );

  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  reply.header("Cross-Origin-Resource-Policy", "same-site");

  if (isProduction) {
    reply.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
});

app.addHook("onResponse", async (request, reply) => {
  request.log.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeInMs: reply.elapsedTime,
    },
    "request_completed",
  );
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      error: "Validation error",
      code: "VALIDATION_ERROR",
      details: error.validation,
    });
  }

  if (isResponseSerializationError(error)) {
    return reply.status(500).send({
      error: "Response serialization error",
      code: "RESPONSE_SERIALIZATION_ERROR",
    });
  }

  return reply.status(500).send({
    error: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  });
});

await app.register(fastifyRateLimit, {
  global: false,
  max: env.RATE_LIMIT_GLOBAL_MAX,
  timeWindow: env.RATE_LIMIT_GLOBAL_TIME_WINDOW,
  skipOnError: false,
  keyGenerator: (request) => {
    const forwardedFor = request.headers["x-forwarded-for"];

    if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
      return forwardedFor.split(",")[0]!.trim();
    }

    return request.ip;
  },
});

await app.register(fastifyCors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isLocalDevOrigin =
      !isProduction &&
      (origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:"));

    if (allowedOrigins.has(origin) || isLocalDevOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

if (!isProduction) {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Bootcamp Treinos API",
        description: "API para o bootcamp de treinos de FSC",
        version: "1.0.0",
      },
      servers: [
        {
          description: "API Base URL",
          url: env.API_BASE_URL,
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifyApiReference, {
    routePrefix: "/docs",
    configuration: {
      sources: [
        {
          title: "Bootcamp Treinos API",
          slug: "bootcamp-treinos-api",
          url: "/swagger.json",
        },
        {
          title: "Auth API",
          slug: "auth-api",
          url: "/api/auth/open-api/generate-schema",
        },
      ],
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/swagger.json",
    schema: {
      hide: true,
    },
    handler: async () => {
      return app.swagger();
    },
  });
}

await app.register(bootstrapRoutes, { prefix: "/bootstrap" });
await app.register(homeRoutes, { prefix: "/home" });
await app.register(meRoutes, { prefix: "/me" });
await app.register(statsRoutes, { prefix: "/stats" });
await app.register(workoutPlanRoutes, { prefix: "/workout-plans" });
await app.register(aiRoutes, { prefix: "/ai" });

await app.register(mobileAuthRoutes, { prefix: "/mobile-auth" });
await app.register(mobileBootstrapRoutes, { prefix: "/mobile/bootstrap" });
await app.register(mobileHomeRoutes, { prefix: "/mobile/home" });
await app.register(mobileProfileRoutes, { prefix: "/mobile/profile" });
await app.register(mobileStatsRoutes, { prefix: "/mobile/stats" });
await app.register(mobileOnboardingRoutes, { prefix: "/mobile/onboarding" });
await app.register(mobileWorkoutPlanRoutes, {
  prefix: "/mobile/workout-plans",
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  schema: {
    description: "Hello world",
    tags: ["Hello World"],
    response: {
      200: z.object({
        message: z.string(),
      }),
    },
  },
  handler: () => {
    return {
      message: "Hello world",
    };
  },
});

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  schema: {
    hide: true,
  },
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) {
          headers.append(key, Array.isArray(value) ? value.join(",") : value);
        }
      });

      const shouldSendBody =
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        request.body !== undefined;

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(shouldSendBody
          ? {
              body:
                typeof request.body === "string"
                  ? request.body
                  : JSON.stringify(request.body),
            }
          : {}),
      });

      const response = await auth.handler(req);

      reply.status(response.status);

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      if (!response.body) {
        return reply.send(null);
      }

      const responseText = await response.text();
      return reply.send(responseText);
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  },
});

try {
  await app.listen({
    host: "0.0.0.0",
    port: env.PORT,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

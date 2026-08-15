import cors from "cors";
import express from "express";
import { Resend } from "resend";
import { UAParser } from "ua-parser-js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const rateLimitStore = new Map();

function parseAllowedOrigins(value) {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function createOriginChecker(allowedOrigins) {
  return function originAllowed(origin) {
    if (!origin) {
      return true;
    }

    if (allowedOrigins.includes(origin)) {
      return true;
    }

    return isLocalOrigin(origin);
  };
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);

  return entry.count > RATE_LIMIT_MAX;
}

function validateContactPayload(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim() : "";

  if (!name) {
    return { error: "Name is required." };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { error: "Name is too long." };
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { error: "A valid email address is required." };
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    return { error: "Email is too long." };
  }

  if (!message) {
    return { error: "Message is required." };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: "Message is too long." };
  }

  return {
    data: {
      name,
      email,
      message,
      pageUrl,
    },
  };
}

function buildMetadataLine(req, pageUrl) {
  const parser = new UAParser(req.headers["user-agent"] || "");
  const browser = parser.getBrowser();
  const browserName = browser.name || "Unknown";
  const language = req.headers["accept-language"]?.split(",")[0]?.trim() || "unknown";
  const referrer = req.headers.referer || pageUrl || "unknown";

  return `Metadata: browser: ${browserName}, language: ${language}, page: ${referrer}`;
}

function buildEmailBody({ name, email, message }, metadataLine) {
  return `From: ${name} <${email}>\n\n${message}\n\n---\n${metadataLine}`;
}

function createResendSender({ apiKey, fromAddress }) {
  if (!apiKey) {
    return async function sendContactEmail() {
      throw new Error("Email service is not configured (missing RESEND_API_KEY).");
    };
  }

  const resend = new Resend(apiKey);

  return async function sendContactEmail(payload) {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: payload.to,
      replyTo: payload.replyTo,
      subject: payload.subject,
      text: payload.text,
    });

    if (error) {
      throw new Error(error.message || "Failed to send email.");
    }
  };
}

export function createApp(options = {}) {
  const allowedOrigins = parseAllowedOrigins(
    options.allowedOrigins ?? process.env.ALLOWED_ORIGINS
  );
  const contactTo = options.contactTo ?? process.env.CONTACT_TO ?? "mattiasnils@outlook.com";
  const contactFrom =
    options.contactFrom ?? process.env.CONTACT_FROM ?? "onboarding@resend.dev";
  const sendContactEmail =
    options.sendContactEmail ??
    createResendSender({
      apiKey: options.resendApiKey ?? process.env.RESEND_API_KEY,
      fromAddress: contactFrom,
    });

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "32kb" }));
  app.use(
    cors({
      origin(origin, callback) {
        if (createOriginChecker(allowedOrigins)(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const clientIp = getClientIp(req);

      if (isRateLimited(clientIp)) {
        res.status(429).json({ ok: false, error: "Too many requests. Please try again later." });
        return;
      }

      const validation = validateContactPayload(req.body);
      if (validation.error) {
        res.status(400).json({ ok: false, error: validation.error });
        return;
      }

      const { name, email, message, pageUrl } = validation.data;
      const metadataLine = buildMetadataLine(req, pageUrl);
      const text = buildEmailBody({ name, email, message }, metadataLine);

      await sendContactEmail({
        to: contactTo,
        replyTo: email,
        subject: `Portfolio contact from ${name}`,
        text,
      });

      res.json({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send message right now.";
      res.status(500).json({ ok: false, error: message });
    }
  });

  return app;
}

import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../app.js";

function createTestApp(sendContactEmail) {
  return createApp({
    allowedOrigins: "https://mattiasnils.github.io,http://localhost:3000",
    contactTo: "mattiasnils@outlook.com",
    contactFrom: "onboarding@resend.dev",
    sendContactEmail,
  });
}

test("POST /api/contact sends email with metadata appended", async () => {
  let captured = null;

  const app = createTestApp(async (payload) => {
    captured = payload;
  });

  const response = await request(app)
    .post("/api/contact")
    .set(
      "User-Agent",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    )
    .set("Accept-Language", "en-US,en;q=0.9")
    .set("Referer", "https://mattiasnils.github.io/portfolio/")
    .send({
      name: "Jane Doe",
      email: "jane@example.com",
      message: "Hello from the portfolio form.",
      pageUrl: "https://mattiasnils.github.io/portfolio/#about",
    });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
  assert.ok(captured);
  assert.equal(captured.to, "mattiasnils@outlook.com");
  assert.equal(captured.replyTo, "jane@example.com");
  assert.match(captured.subject, /Jane Doe/);
  assert.match(captured.text, /Hello from the portfolio form\./);
  assert.match(captured.text, /Metadata: browser: Safari, language: en-US, page:/);
});

test("POST /api/contact rejects missing fields", async () => {
  const app = createTestApp(async () => {});

  const response = await request(app)
    .post("/api/contact")
    .send({
      name: "",
      email: "jane@example.com",
      message: "Hello",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.match(response.body.error, /Name/i);
});

test("POST /api/contact rejects invalid email", async () => {
  const app = createTestApp(async () => {});

  const response = await request(app)
    .post("/api/contact")
    .send({
      name: "Jane Doe",
      email: "not-an-email",
      message: "Hello",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.match(response.body.error, /email/i);
});

test("POST /api/contact returns 500 when email send fails", async () => {
  const app = createTestApp(async () => {
    throw new Error("Resend unavailable");
  });

  const response = await request(app)
    .post("/api/contact")
    .send({
      name: "Jane Doe",
      email: "jane@example.com",
      message: "Hello",
    });

  assert.equal(response.status, 500);
  assert.equal(response.body.ok, false);
  assert.match(response.body.error, /Resend unavailable/);
});

test("GET /health returns ok", async () => {
  const app = createTestApp(async () => {});
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});

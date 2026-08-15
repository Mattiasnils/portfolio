import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3001);
const app = createApp(
  process.env.MOCK_SEND === "1"
    ? {
        sendContactEmail: async (payload) => {
          console.log("[mock send]", JSON.stringify(payload, null, 2));
        },
      }
    : {}
);

app.listen(port, () => {
  const mode = process.env.MOCK_SEND === "1" ? "mock" : "live";
  console.log(`Contact API listening on http://localhost:${port} (${mode})`);

  if (mode === "live" && !process.env.RESEND_API_KEY) {
    console.warn("WARNING: RESEND_API_KEY is not set. Contact emails will fail.");
  }
});

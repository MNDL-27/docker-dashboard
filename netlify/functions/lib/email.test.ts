import { describe, expect, it } from "vitest";

import { sendEmail } from "./email.mjs";

describe("email sender", () => {
  it("fails cleanly when resend key is missing", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail({
      to: "[email protected]",
      subject: "Test",
      text: "Hello",
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe("resend");
  });
});

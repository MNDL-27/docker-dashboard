import { describe, expect, it } from "vitest";

import { donorActivationTemplate, donorRenewalReminderTemplate } from "./donor-email-templates.mjs";

describe("email template retry rendering", () => {
  it("can rerender activation email consistently", () => {
    const tpl = donorActivationTemplate({
      orgName: "Retry Org",
      expiresAt: new Date().toISOString(),
      transactionId: "TXN-RETRY",
    });

    expect(tpl.subject).toMatch(/active/i);
    expect(tpl.html).toContain("Retry Org");
  });

  it("can rerender renewal email consistently", () => {
    const tpl = donorRenewalReminderTemplate({
      orgName: "Retry Org",
      expiresAt: new Date().toISOString(),
      daysLeft: 3,
      referenceToken: "DNR-AB12CD34",
    });

    expect(tpl.subject).toContain("3");
    expect(tpl.html).toContain("DNR-AB12CD34");
  });
});

import { describe, expect, it } from "vitest";

import {
  donorActivationTemplate,
  donorRenewalReminderTemplate,
  donorRevokedTemplate,
} from "./donor-email-templates.mjs";

describe("donor email templates", () => {
  it("builds activation template", () => {
    const tpl = donorActivationTemplate({ orgName: "Acme", expiresAt: new Date().toISOString(), transactionId: "TXN123" });
    expect(tpl.subject).toMatch(/active/i);
    expect(tpl.body).toContain("Acme");
    expect(tpl.html).toContain("Acme");
  });

  it("builds renewal reminder template", () => {
    const tpl = donorRenewalReminderTemplate({ orgName: "Acme", expiresAt: new Date().toISOString(), daysLeft: 3, referenceToken: "DNR-AB12CD34" });
    expect(tpl.subject).toContain("3");
    expect(tpl.body).toContain("DNR-AB12CD34");
    expect(tpl.html).toContain("DNR-AB12CD34");
  });

  it("builds revoked template", () => {
    const tpl = donorRevokedTemplate({ orgName: "Acme", expiresAt: new Date().toISOString(), reason: "expired" });
    expect(tpl.body).toContain("expired");
    expect(tpl.html).toContain("expired");
  });
});

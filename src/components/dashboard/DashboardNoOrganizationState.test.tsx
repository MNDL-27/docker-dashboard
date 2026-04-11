import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardNoOrganizationState } from "@/components/dashboard/DashboardNoOrganizationState";

describe("DashboardNoOrganizationState", () => {
  it("routes the primary CTA to onboarding", () => {
    render(
      <MemoryRouter>
        <DashboardNoOrganizationState />
      </MemoryRouter>,
    );

    const cta = screen.getByRole("link", { name: /start onboarding/i });
    expect(cta).toHaveAttribute("href", "/onboarding");
  });
});


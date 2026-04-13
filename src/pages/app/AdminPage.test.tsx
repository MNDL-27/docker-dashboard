import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminActionDialog } from "@/pages/app/AdminPage";

describe("AdminActionDialog", () => {
  it("requires typed confirmation and reason before enabling submit", () => {
    render(
      <AdminActionDialog
        open
        onOpenChange={vi.fn()}
        title="Hard disable user"
        description="Dangerous action"
        confirmLabel="Hard disable"
        confirmValue="user@example.com"
        requireTypedConfirm
        onConfirm={vi.fn(async () => undefined)}
      />,
    );

    const submit = screen.getByRole("button", { name: /hard disable/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type user@example.com to confirm/i), {
      target: { value: "user@example.com" },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Abuse case" },
    });
    expect(submit).not.toBeDisabled();
  });
});

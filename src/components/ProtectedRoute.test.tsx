import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { ProtectedRoute } from "./ProtectedRoute";

const mockUseAuth = vi.fn();

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to login when auth/me returns 401", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("token"),
    });

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn(),
    } as unknown as Response);

    render(
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route path="/app" element={<ProtectedRoute><div>APP</div></ProtectedRoute>} />
          <Route path="/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("LOGIN")).toBeInTheDocument();
    });
    expect(screen.queryByText("Unable to verify onboarding status right now.")).not.toBeInTheDocument();
  });

  it("renders onboarding error on non-401 auth bootstrap failures", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("token"),
    });

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn(),
    } as unknown as Response);

    render(
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route path="/app" element={<ProtectedRoute><div>APP</div></ProtectedRoute>} />
          <Route path="/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Unable to verify onboarding status right now.")).toBeInTheDocument();
    });
  });
});

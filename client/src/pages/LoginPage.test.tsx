import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, login: auth.login }),
}));

import LoginPage from "./LoginPage";

describe("LoginPage", () => {
  it("submits credentials and navigates home on success", async () => {
    auth.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText("Email or mobile"), "a@b.com");
    await user.type(screen.getByPlaceholderText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith("a@b.com", "secret123"));
  });

  it("shows an error when login fails", async () => {
    auth.login.mockRejectedValue(new Error("bad creds"));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText("Email or mobile"), "a@b.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Invalid login ID or password")).toBeInTheDocument();
  });
});
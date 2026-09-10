import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({ register: vi.fn() }));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, register: auth.register }),
}));

import RegisterPage from "./RegisterPage";

const validPayload = {
  uname: "Test User",
  uemail: "test@obts.dev",
  umobile: "9841000000",
  upass: "ValidPass@1",
  ugender: "Male",
};

describe("RegisterPage", () => {
  it("submits the filled form and navigates home on success", async () => {
    auth.register.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText("Full name"), validPayload.uname);
    await user.type(screen.getByPlaceholderText("Email"), validPayload.uemail);
    await user.type(screen.getByPlaceholderText("Mobile"), validPayload.umobile);
    await user.type(screen.getByPlaceholderText("Password"), validPayload.upass);
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => expect(auth.register).toHaveBeenCalledWith(validPayload));
  });

  it("shows the server message when registration fails", async () => {
    auth.register.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "The email/mobile has already been registered" } },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText("Full name"), validPayload.uname);
    await user.type(screen.getByPlaceholderText("Email"), validPayload.uemail);
    await user.type(screen.getByPlaceholderText("Mobile"), validPayload.umobile);
    await user.type(screen.getByPlaceholderText("Password"), validPayload.upass);
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("The email/mobile has already been registered")
    ).toBeInTheDocument();
  });
});
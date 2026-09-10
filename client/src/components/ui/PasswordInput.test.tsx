import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordInput from "./PasswordInput";

describe("PasswordInput", () => {
  it("renders a password input by default", () => {
    render(<PasswordInput placeholder="Password" value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText("Password") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggles visibility when the eye button is clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Password" value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText("Password") as HTMLInputElement;

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });
});
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("contact.send", () => {
  it("should send contact form email successfully", async () => {
    const mockContext: TrpcContext = {
      user: null,
      req: {} as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(mockContext);

    const result = await caller.contact.send({
      name: "Test User",
      email: "test@example.com",
      subject: "Test Subject",
      message: "This is a test message from vitest to verify email functionality.",
    });

    expect(result).toEqual({ success: true });
  });

  it("should fail with invalid email", async () => {
    const mockContext: TrpcContext = {
      user: null,
      req: {} as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(mockContext);

    await expect(
      caller.contact.send({
        name: "Test User",
        email: "invalid-email",
        subject: "Test Subject",
        message: "This is a test message.",
      })
    ).rejects.toThrow();
  });

  it("should fail with message too short", async () => {
    const mockContext: TrpcContext = {
      user: null,
      req: {} as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(mockContext);

    await expect(
      caller.contact.send({
        name: "Test User",
        email: "test@example.com",
        subject: "Test Subject",
        message: "Short",
      })
    ).rejects.toThrow();
  });
});

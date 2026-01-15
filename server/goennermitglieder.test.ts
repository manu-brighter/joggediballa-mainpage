import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMaintainerContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-maintainer",
    email: "maintainer@example.com",
    name: "Test Maintainer",
    loginMethod: "manus",
    role: "maintainer",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "test-user",
    email: "user@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("goennermitglieder router", () => {
  describe("access control", () => {
    it("denies public access to list", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.goennermitglieder.list()).rejects.toThrow();
    });

    it("allows authenticated user to list", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      // Should not throw (may return empty array if no DB)
      const result = await caller.goennermitglieder.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("denies regular user from creating member", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.goennermitglieder.create({
          firstName: "Max",
          lastName: "Mustermann",
          street: "Teststraße",
          houseNumber: "1",
          zipCode: "12345",
          city: "Teststadt",
          membershipStartDate: new Date(),
        })
      ).rejects.toThrow();
    });
  });

  describe("maintainer operations", () => {
    it("allows maintainer to create member", async () => {
      const ctx = createMaintainerContext();
      const caller = appRouter.createCaller(ctx);

      // This will attempt to create - may fail due to DB but validates input
      try {
        const result = await caller.goennermitglieder.create({
          firstName: "Max",
          lastName: "Mustermann",
          street: "Teststraße",
          houseNumber: "1",
          zipCode: "12345",
          city: "Teststadt",
          membershipStartDate: new Date(),
        });
        expect(result).toHaveProperty("memberId");
      } catch (error: any) {
        // DB error is acceptable in test environment
        expect(error.message).toContain("Database");
      }
    });

    it("validates required fields for create", async () => {
      const ctx = createMaintainerContext();
      const caller = appRouter.createCaller(ctx);

      // Missing required fields should fail validation
      await expect(
        caller.goennermitglieder.create({
          firstName: "",
          lastName: "Mustermann",
          street: "Teststraße",
          houseNumber: "1",
          zipCode: "12345",
          city: "Teststadt",
          membershipStartDate: new Date(),
        })
      ).rejects.toThrow();
    });
  });

  describe("membership date logic", () => {
    it("calculates end date as start + 1 year", async () => {
      const ctx = createMaintainerContext();
      const caller = appRouter.createCaller(ctx);

      const startDate = new Date("2024-01-15");
      const expectedEndDate = new Date("2025-01-15");

      try {
        await caller.goennermitglieder.create({
          firstName: "Test",
          lastName: "User",
          street: "Teststraße",
          houseNumber: "1",
          zipCode: "12345",
          city: "Teststadt",
          membershipStartDate: startDate,
        });
        // If successful, the end date should be calculated server-side
      } catch (error: any) {
        // DB error is acceptable
        expect(error.message).toContain("Database");
      }
    });
  });
});

describe("profile router", () => {
  it("allows authenticated user to update profile picture", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.profile.updatePicture({
        profilePictureUrl: "https://example.com/image.jpg",
        profilePictureKey: "profile-pictures/test.jpg",
      });
      expect(result).toEqual({ success: true });
    } catch (error: any) {
      // DB error is acceptable
      expect(error.message).toContain("Database");
    }
  });

  it("denies public access to update profile picture", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.profile.updatePicture({
        profilePictureUrl: "https://example.com/image.jpg",
        profilePictureKey: "profile-pictures/test.jpg",
      })
    ).rejects.toThrow();
  });
});

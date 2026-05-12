import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

// SMTP-dependent test — skipped in CI where no SMTP server is reachable.
// Locally with SMTP_* env vars set it runs against the real mail server.
const skipIntegration = !!process.env.CI;

describe('contact.send', () => {
  it.skipIf(skipIntegration)('should send contact form email successfully', async () => {
    const mockContext: TrpcContext = {
      user: null,
      req: {} as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(mockContext);

    const result = await caller.contact.send({
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Test Subject',
      message:
        'This is a test message from vitest to verify email functionality.',
    });

    expect(result).toEqual({ success: true });
  });

  it('should fail with invalid email', async () => {
    const mockContext: TrpcContext = {
      user: null,
      req: {} as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(mockContext);

    await expect(
      caller.contact.send({
        name: 'Test User',
        email: 'invalid-email',
        subject: 'Test Subject',
        message: 'This is a test message.',
      }),
    ).rejects.toThrow();
  });

  it('should fail with message too short', async () => {
    const mockContext: TrpcContext = {
      user: null,
      req: {} as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(mockContext);

    await expect(
      caller.contact.send({
        name: 'Test User',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Short',
      }),
    ).rejects.toThrow();
  });
});

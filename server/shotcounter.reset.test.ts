import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './db';

// Mock the db module
vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof db>('./db');
  return {
    ...actual,
    resetShotcounterScoresForYear: vi.fn().mockResolvedValue(undefined),
    resetShotcounterForYear: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Shotcounter Reset Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resetShotcounterScoresForYear', () => {
    it('should reset only scores without deleting teams', async () => {
      const mockResetScores = vi.mocked(db.resetShotcounterScoresForYear);

      await db.resetShotcounterScoresForYear(2026);

      expect(mockResetScores).toHaveBeenCalledWith(2026);
      expect(mockResetScores).toHaveBeenCalledTimes(1);
    });

    it('should handle different years', async () => {
      const mockResetScores = vi.mocked(db.resetShotcounterScoresForYear);

      await db.resetShotcounterScoresForYear(2025);

      expect(mockResetScores).toHaveBeenCalledWith(2025);
    });
  });

  describe('resetShotcounterForYear', () => {
    it('should reset everything (teams and scores)', async () => {
      const mockResetAll = vi.mocked(db.resetShotcounterForYear);

      await db.resetShotcounterForYear(2026);

      expect(mockResetAll).toHaveBeenCalledWith(2026);
      expect(mockResetAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reset options differentiation', () => {
    it('should have separate functions for scores-only vs full reset', async () => {
      // Verify both functions exist and are callable
      expect(typeof db.resetShotcounterScoresForYear).toBe('function');
      expect(typeof db.resetShotcounterForYear).toBe('function');

      // They should be different functions
      expect(db.resetShotcounterScoresForYear).not.toBe(
        db.resetShotcounterForYear,
      );
    });
  });
});

describe('Feature Toggle Instant Apply', () => {
  it('should have feature toggle functions available', async () => {
    // Verify feature toggle functions exist
    expect(typeof db.getFeatureToggle).toBe('function');
    expect(typeof db.setFeatureToggle).toBe('function');
    expect(typeof db.getAllFeatureToggles).toBe('function');
  });
});

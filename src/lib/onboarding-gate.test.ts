import { describe, expect, it } from 'vitest';
import { deriveNeedsOnboarding, normalizeOnboardingStatus } from './onboarding-gate';

describe('onboarding gate', () => {
  it('requires onboarding when org is not started', () => {
    expect(deriveNeedsOnboarding(true, 'not_started')).toBe(true);
  });

  it('does not require onboarding when skipped', () => {
    expect(deriveNeedsOnboarding(true, 'skipped')).toBe(false);
  });

  it('does not require onboarding when completed', () => {
    expect(deriveNeedsOnboarding(true, 'completed')).toBe(false);
  });

  it('requires onboarding when user has no orgs', () => {
    expect(deriveNeedsOnboarding(false, null)).toBe(true);
  });

  it('normalizes unknown statuses to null', () => {
    expect(normalizeOnboardingStatus('foo')).toBeNull();
    expect(normalizeOnboardingStatus(undefined)).toBeNull();
    expect(normalizeOnboardingStatus('completed')).toBe('completed');
  });
});

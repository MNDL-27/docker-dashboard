export type OnboardingStatus = 'not_started' | 'skipped' | 'completed' | null;

export function normalizeOnboardingStatus(value: unknown): OnboardingStatus {
  if (value === 'not_started' || value === 'skipped' || value === 'completed') {
    return value;
  }

  return null;
}

/**
 * Single source of truth for route gating behavior.
 *
 * Rules:
 * - No org yet -> onboarding required
 * - not_started -> onboarding required
 * - skipped/completed -> onboarding not required
 */
export function deriveNeedsOnboarding(hasOrgs: boolean, onboardingStatus: OnboardingStatus): boolean {
  if (!hasOrgs) return false;
  return onboardingStatus !== 'skipped' && onboardingStatus !== 'completed';
}

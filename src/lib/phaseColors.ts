/**
 * Consistent color scheme for phase scores across the entire application
 * Used in: FarmersTable, FarmerCard, PhaseCard, F100Modal
 */

export interface PhaseScoreColor {
  bg: string;
  text: string;
  border: string;
  badge: string;
}

/**
 * Get consistent colors for phase scores based on score value
 * @param score - The phase score (0-10)
 * @returns Object with consistent Tailwind classes for bg, text, border, and badge
 */
export const getPhaseScoreColors = (score: number | undefined | null): PhaseScoreColor => {
  if (score === undefined || score === null) {
    return {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700',
      badge: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    };
  }

  if (score >= 8) {
    // 8-10: Green
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-700',
      badge: 'bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300',
    };
  } else if (score >= 6) {
    // 6-7.9: Yellow
    return {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
      border: 'border-yellow-200 dark:border-yellow-700',
      badge: 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300',
    };
  } else {
    // 0-5.9: Red
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-700',
      badge: 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300',
    };
  }
};


import { memo } from 'react';

const VARIANTS = {
  1: { label: 'Easy', variant: 'easy' },
  2: { label: 'Medium', variant: 'medium' },
  3: { label: 'Hard', variant: 'hard' },
};

// Difficulty shown as a pill. Anything outside 1-3 renders as "Unrated"
// instead of silently falling back to the hardest level.
const DifficultyBadge = memo(function DifficultyBadge({ level }) {
  const entry = VARIANTS[Number(level)] || { label: 'Unrated', variant: 'unknown' };
  return <span className={`badge-diff badge-diff--${entry.variant}`}>{entry.label}</span>;
});

export default DifficultyBadge;

import { CapabilityCard } from './CapabilityCard.js';

type Standing = { teamName: string; totalPoints: number; rank: number };

export default function Leaderboard() {
  return (
    <CapabilityCard<Standing>
      title="Leaderboard"
      description="Compare team point totals."
      endpoint="/api/leaderboard"
      dataKey="leaderboard"
      emptyMessage="No leaderboard rankings yet."
      renderItem={(standing) => `${standing.rank}. ${standing.teamName} — ${standing.totalPoints} points`}
    />
  );
}

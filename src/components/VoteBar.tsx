// ─── 投票バー（リアルタイム更新） ───────────────────
import { motion } from 'framer-motion';
import type { Election, VoteStats } from '../types';

interface VoteBarProps {
  election: Election;
  stats: VoteStats;
  showCounts?: boolean;
}

export default function VoteBar({ election, stats, showCounts = true }: VoteBarProps) {
  const total = stats.votesA + stats.votesB;
  const pctA = total === 0 ? 50 : Math.round((stats.votesA / total) * 100);
  const pctB = 100 - pctA;

  return (
    <div className="w-full select-none">
      {/* ラベル行 */}
      <div className="flex justify-between items-center mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xl">{election.optionA.icon}</span>
          <span className="text-sm font-bold text-white/80">{election.optionA.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-white/80">{election.optionB.title}</span>
          <span className="text-xl">{election.optionB.icon}</span>
        </div>
      </div>

      {/* バー本体 */}
      <div className="relative w-full h-10 rounded-full overflow-hidden bg-gray-900 shadow-inner">
        {/* A側 */}
        <motion.div
          className="absolute left-0 top-0 h-full flex items-center justify-start pl-3"
          style={{ background: election.optionA.color }}
          initial={{ width: '50%' }}
          animate={{ width: `${pctA}%` }}
          transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
        >
          {showCounts && pctA > 15 && (
            <span className="text-white font-black text-sm drop-shadow">
              {pctA}%
            </span>
          )}
        </motion.div>

        {/* B側 */}
        <motion.div
          className="absolute right-0 top-0 h-full flex items-center justify-end pr-3"
          style={{ background: election.optionB.color }}
          initial={{ width: '50%' }}
          animate={{ width: `${pctB}%` }}
          transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
        >
          {showCounts && pctB > 15 && (
            <span className="text-white font-black text-sm drop-shadow">
              {pctB}%
            </span>
          )}
        </motion.div>

        {/* 中央仕切り線 */}
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-gray-900/70 -translate-x-1/2 z-10" />
      </div>

      {/* 票数表示 */}
      {showCounts && (
        <div className="flex justify-between mt-1.5 px-1">
          <span className="text-xs text-white/50">
            {stats.votesA}票 ({stats.totalVoters > 0 ? Math.round((stats.votesA / (stats.votesA + stats.votesB)) * 100) : 0}%)
          </span>
          <span className="text-xs text-white/40 text-center">
            計{stats.totalVoters}人が投票
          </span>
          <span className="text-xs text-white/50">
            ({stats.totalVoters > 0 ? Math.round((stats.votesB / (stats.votesA + stats.votesB)) * 100) : 0}%) {stats.votesB}票
          </span>
        </div>
      )}
    </div>
  );
}

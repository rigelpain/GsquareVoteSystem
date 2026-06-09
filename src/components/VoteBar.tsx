// ─── 投票バー（リアルタイム更新） ───────────────────
import { motion } from 'framer-motion';
import type { Election, VoteStats, ElectionOption } from '../types';

interface VoteBarProps {
  election: Election;
  stats: VoteStats;
  showCounts?: boolean;
  optionC?: ElectionOption;
  showVoterTotal?: boolean;
}

export default function VoteBar({ election, stats, showCounts = true, optionC, showVoterTotal = true }: VoteBarProps) {
  const total = stats.votesA + stats.votesB + stats.votesC;

  if (optionC) {
    // ─── 3択バー ───────────────────────────────
    const pctA = total === 0 ? 33.33 : (stats.votesA / total) * 100;
    const pctB = total === 0 ? 33.33 : (stats.votesB / total) * 100;
    const pctC = total === 0 ? 33.34 : 100 - pctA - pctB;
    const rA = Math.round(pctA);
    const rB = Math.round(pctB);
    const rC = 100 - rA - rB;

    return (
      <div className="w-full select-none">
        {/* ラベル行 — A と B のみ */}
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-sm font-bold text-white/80">{election.optionA.title}</span>
          <span className="text-sm font-bold text-white/80">{election.optionB.title}</span>
        </div>

        {/* バー本体 */}
        <div className="relative w-full h-10 rounded-full overflow-hidden bg-gray-900 shadow-inner flex">
          <motion.div
            className="h-full flex items-center justify-start pl-2 flex-shrink-0"
            style={{ background: election.optionA.color }}
            initial={{ width: '33.33%' }}
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {showCounts && rA > 12 && (
              <span className="text-white font-black text-sm drop-shadow">{rA}%</span>
            )}
          </motion.div>
          <motion.div
            className="h-full flex items-center justify-center flex-shrink-0"
            style={{ background: optionC.color }}
            initial={{ width: '33.34%' }}
            animate={{ width: `${pctC}%` }}
            transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {showCounts && rC > 12 && (
              <span className="text-white font-black text-sm drop-shadow">{rC}%</span>
            )}
          </motion.div>
          <motion.div
            className="h-full flex items-center justify-end pr-2 flex-shrink-0"
            style={{ background: election.optionB.color }}
            initial={{ width: '33.33%' }}
            animate={{ width: `${pctB}%` }}
            transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {showCounts && rB > 12 && (
              <span className="text-white font-black text-sm drop-shadow">{rB}%</span>
            )}
          </motion.div>
        </div>

        {/* どちらもいらない — バー下中央 */}
        <div className="flex items-center justify-center gap-1.5 mt-1 mb-0.5">
          <span className="text-white/45 text-xs">{optionC.title}</span>
          <span className="text-white/55 text-xs font-bold">{rC}%</span>
          {showCounts && <span className="text-white/35 text-xs">（{stats.votesC}票）</span>}
        </div>

        {/* 票数表示 — A と B のみ */}
        {showCounts && (
          <div className="flex justify-between mt-0.5 px-1">
            <span className="text-xs text-white/50">{stats.votesA}票</span>
            {showVoterTotal && <span className="text-xs text-white/40 text-center">計{stats.totalVoters}人</span>}
            <span className="text-xs text-white/50">{stats.votesB}票</span>
          </div>
        )}
      </div>
    );
  }

  // ─── 2択バー（互換）──────────────────────────
  const total2 = stats.votesA + stats.votesB;
  const pctA2 = total2 === 0 ? 50 : Math.round((stats.votesA / total2) * 100);
  const pctB2 = 100 - pctA2;

  return (
    <div className="w-full select-none">
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

      <div className="relative w-full h-10 rounded-full overflow-hidden bg-gray-900 shadow-inner">
        <motion.div
          className="absolute left-0 top-0 h-full flex items-center justify-start pl-3"
          style={{ background: election.optionA.color }}
          initial={{ width: '50%' }}
          animate={{ width: `${pctA2}%` }}
          transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
        >
          {showCounts && pctA2 > 15 && (
            <span className="text-white font-black text-sm drop-shadow">{pctA2}%</span>
          )}
        </motion.div>
        <motion.div
          className="absolute right-0 top-0 h-full flex items-center justify-end pr-3"
          style={{ background: election.optionB.color }}
          initial={{ width: '50%' }}
          animate={{ width: `${pctB2}%` }}
          transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
        >
          {showCounts && pctB2 > 15 && (
            <span className="text-white font-black text-sm drop-shadow">{pctB2}%</span>
          )}
        </motion.div>
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-gray-900/70 -translate-x-1/2 z-10" />
      </div>

      {showCounts && (
        <div className="flex justify-between mt-1.5 px-1">
          <span className="text-xs text-white/50">
            {stats.votesA}票 ({total2 > 0 ? Math.round((stats.votesA / total2) * 100) : 0}%)
          </span>
          <span className="text-xs text-white/40 text-center">計{stats.totalVoters}人が投票</span>
          <span className="text-xs text-white/50">
            ({total2 > 0 ? Math.round((stats.votesB / total2) * 100) : 0}%) {stats.votesB}票
          </span>
        </div>
      )}
    </div>
  );
}

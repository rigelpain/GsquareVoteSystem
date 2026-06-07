// =============================================
// SignagePage.tsx - サイネージ表示専用画面
// 縦型サイネージ（1m×0.6m）向け大画面表示
// URL: /signage
// =============================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getActiveElection, subscribeToVoteStats } from '../firebase/elections';
import { ensureAuth } from '../firebase/elections';
import { OptionIcon } from '../components/OptionIcon';
import { OPTION_C } from '../types';
import type { Election, VoteStats } from '../types';

// QRコードはqrcode.reactなどを使うが、
// 依存を増やさず URLベースのQRサービスを使う（Googleチャートは廃止のため別サービス）
function QRCodeImg({ url, size = 200 }: { url: string; size?: number }) {
  // api.qrserver.com を使用
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=1A1A2E&color=ffffff&format=png`;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="投票QRコード"
      className="rounded-xl border-4 border-white/20"
    />
  );
}

export default function SignagePage() {
  const [election, setElection] = useState<Election | null>(null);
  const [stats, setStats] = useState<VoteStats>({ votesA: 0, votesB: 0, votesC: 0, totalVoters: 0, comments: [] });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // 投票URL（本番ではFirebase HostingのURL）
  const voteUrl = import.meta.env.VITE_VOTE_URL ?? `${window.location.origin}/`;

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    (async () => {
      await ensureAuth();
      const el = await getActiveElection();
      if (!el) { setLoading(false); return; }
      setElection(el);
      unsubscribe = subscribeToVoteStats(el.id, setStats);
      setLoading(false);
    })();

    // コメントのティッカー更新
    const interval = setInterval(() => setTick((t) => t + 1), 5000);

    return () => {
      unsubscribe?.();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <p className="text-white/50 text-[10px]">読み込み中...</p>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <p className="text-white/50 text-[10px]">進行中の投票がありません</p>
      </div>
    );
  }

  const total = stats.votesA + stats.votesB + stats.votesC;
  const pctA = total === 0 ? 33 : Math.round((stats.votesA / total) * 100);
  const pctB = total === 0 ? 33 : Math.round((stats.votesB / total) * 100);
  const pctC = 100 - pctA - pctB;

  // コメントのローテーション
  const visibleComment = stats.comments.length > 0
    ? stats.comments[tick % stats.comments.length]
    : null;

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
    <div
      className="overflow-hidden flex flex-col"
      style={{
        aspectRatio: '1000 / 1315',
        width: 'min(100vw, calc(100vh * 1000 / 1315))',
        height: 'min(100vh, calc(100vw * 1315 / 1000))',
        background: 'linear-gradient(160deg, #0D1117 0%, #1A1A2E 40%, #0D1117 100%)',
        fontFamily: "'M PLUS Rounded 1c', sans-serif",
      }}
    >
      {/* ─── 上部：タイトルエリア ────────────────── */}
      <div className="flex-shrink-0 text-center px-8 pt-10 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-white/50 text-[9px] font-bold tracking-widest mb-2">
            みんなでつくるGスクエア
          </p>
          <h1 className="text-white font-black text-lg leading-tight">
            {election.title}
          </h1>
          <p className="text-white/60 text-[8px] mt-2">{election.description}</p>
        </motion.div>
      </div>

      {/* ─── 中央：2択 + 投票バー ────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        {/* 2択カード */}
        <div className="w-full flex gap-4">
          {[election.optionA, election.optionB].map((opt) => (
            <motion.div
              key={opt.id}
              className="flex-1 rounded-3xl p-5 text-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${opt.color}25, ${opt.accentColor}40)`,
                border: `3px solid ${opt.color}80`,
              }}
              animate={{ borderColor: [`${opt.color}80`, `${opt.color}cc`, `${opt.color}80`] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="mb-3" style={{ color: opt.lightColor }}>
                <OptionIcon name={opt.icon} size={60} />
              </div>
              <h2 className="font-black text-[10px] leading-tight" style={{ color: opt.lightColor }}>
                {opt.title}
              </h2>
              <p className="text-white/60 text-[7px] mt-2 leading-relaxed">
                {opt.description}
              </p>

              {/* 票数バッジ */}
              <div
                className="mt-4 inline-block px-4 py-1.5 rounded-full font-black text-white text-[9px]"
                style={{ background: opt.color }}
              >
                {opt.id === 'A' ? pctA : pctB}%
              </div>
            </motion.div>
          ))}
        </div>

        {/* 投票バー（3択） */}
        <div className="w-full">
          <div className="relative w-full h-12 rounded-full overflow-hidden bg-gray-900/60 flex">
            <motion.div
              className="h-full flex items-center pl-3 flex-shrink-0"
              style={{ background: election.optionA.color }}
              animate={{ width: `${pctA}%` }}
              transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {pctA > 10 && <span className="text-white font-black text-[7px] drop-shadow-lg">{pctA}%</span>}
            </motion.div>
            <motion.div
              className="h-full flex items-center justify-center flex-shrink-0"
              style={{ background: OPTION_C.color }}
              animate={{ width: `${pctC}%` }}
              transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {pctC > 10 && <span className="text-white font-black text-[7px] drop-shadow-lg">{pctC}%</span>}
            </motion.div>
            <motion.div
              className="h-full flex items-center pr-3 justify-end flex-shrink-0"
              style={{ background: election.optionB.color }}
              animate={{ width: `${pctB}%` }}
              transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {pctB > 10 && <span className="text-white font-black text-[7px] drop-shadow-lg">{pctB}%</span>}
            </motion.div>
          </div>
          <div className="text-center mt-2">
            <span className="text-white/50 text-[7px]">{stats.totalVoters}人が投票中</span>
          </div>
        </div>

        {/* コメントティッカー */}
        <AnimatePresence mode="wait">
          {visibleComment && (
            <motion.div
              key={`${tick}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full rounded-2xl px-5 py-4 bg-white/5 border border-white/10 min-h-16"
            >
              {(() => {
                const opt = visibleComment.choice === 'A' ? election.optionA
                  : visibleComment.choice === 'B' ? election.optionB
                  : OPTION_C;
                return (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <OptionIcon name={opt.icon} size={16} color={opt.lightColor} />
                      <span className="text-[6px] font-bold text-white/50">みんなの声</span>
                    </div>
                    <p className="text-white/80 text-[7px] leading-relaxed">
                      "{visibleComment.choice === 'C' && visibleComment.disagreeReason
                        ? visibleComment.disagreeReason
                        : visibleComment.agreeReason}"
                    </p>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── 下部：QRコード ────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-center gap-8 px-8 py-8">
        <div className="text-center">
          <QRCodeImg url={voteUrl} size={160} />
          <p className="text-white/50 text-[7px] mt-3">スキャンして投票 📱</p>
        </div>
        <div className="flex-1">
          <div className="text-center">
            <p className="text-white font-black text-xs leading-tight mb-2">
              ↑ QRコードを<br />スキャンして<br />投票しよう！
            </p>
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block mt-3"
            >
              <div
                className="px-6 py-3 rounded-full font-black text-white text-[10px]"
                style={{ background: 'linear-gradient(135deg, #00C4EE, #FF6B35)' }}
              >
                投票無料！
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ─── フッター ────────────────────────── */}
      <div className="flex-shrink-0 text-center pb-4">
        <p className="text-white/20 text-[6px]">函館コミュニティプラザ Gスクエア / みんなでつくるGスクエアプロジェクト</p>
      </div>
    </div>
    </div>
  );
}

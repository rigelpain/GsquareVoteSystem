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
      <div className="flex-shrink-0 text-center px-6 pt-4 pb-2">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-white/50 text-[9px] font-bold tracking-widest mb-1">
            みんなでつくるGスクエア
          </p>
          <h1 className="text-white font-black text-lg leading-tight">
            {election.title}
          </h1>
          <p className="text-white/60 text-[8px] mt-1">{election.description}</p>
        </motion.div>
      </div>

      {/* ─── 中央：2択 + 投票バー ────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-2 min-h-0">
        {/* A・B の2択（縦並び・VSバッジ付き／VotePage構成を継承） */}
        <div className="relative w-full flex flex-col gap-1.5">
          {[election.optionA, election.optionB].map((opt, i) => (
            <motion.div
              key={opt.id}
              className="w-full rounded-2xl p-2 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${opt.color}18, rgba(255,255,255,0.06))`,
                border: '1px solid rgba(255,255,255,0.22)',
              }}
            >
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at ${i === 0 ? '80%' : '20%'} 50%, ${opt.color}, transparent 70%)`,
                }}
              />
              <div className="relative flex items-center gap-2">
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${opt.color}33`, border: `1.5px solid ${opt.color}66`, color: opt.lightColor }}
                >
                  <OptionIcon name={opt.icon} size={20} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h2 className="font-black text-[9px] leading-tight" style={{ color: opt.lightColor }}>
                    {opt.title}
                  </h2>
                  <p className="text-white/60 text-[6px] mt-0.5 leading-snug line-clamp-2">
                    {opt.description}
                  </p>
                </div>
                {/* 得票率（投票画面の矢印アイコンの代わりに表示） */}
                <div
                  className="flex-shrink-0 px-2 py-0.5 rounded-full font-black text-white text-[9px]"
                  style={{ background: opt.color }}
                >
                  {opt.id === 'A' ? pctA : pctB}%
                </div>
              </div>
            </motion.div>
          ))}

          {/* VS バッジ */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="rounded-full w-6 h-6 flex items-center justify-center border border-white/30 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <span className="text-white/70 font-black text-[6px]">VS</span>
            </div>
          </div>
        </div>

        {/* または仕切り */}
        <div className="w-full flex items-center gap-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/35 text-[6px] font-bold tracking-widest">または</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* C: どちらもいらない */}
        <div
          className="w-full p-1.5 rounded-xl border relative overflow-hidden"
          style={{ background: 'rgba(107,114,128,0.10)', borderColor: 'rgba(107,114,128,0.35)', borderStyle: 'dashed' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(107,114,128,0.20)', border: '1px solid rgba(107,114,128,0.40)' }}
            >
              <OptionIcon name={OPTION_C.icon} size={14} color="rgba(255,255,255,0.5)" />
            </div>
            <h2 className="flex-1 min-w-0 text-left text-[8px] font-black text-white/60 leading-tight">
              {OPTION_C.title}
            </h2>
            <div className="flex-shrink-0 px-2 py-0.5 rounded-full font-black text-white/70 text-[8px]" style={{ background: OPTION_C.color }}>
              {pctC}%
            </div>
          </div>
        </div>

        {/* 投票バー（3択） */}
        <div className="w-full">
          <div className="relative w-full h-7 rounded-full overflow-hidden bg-gray-900/60 flex">
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
          <div className="text-center mt-1">
            <span className="text-white/50 text-[7px]">{stats.totalVoters}人が投票中</span>
            <span className="text-white/30 text-[6px] ml-2">📱 QRコードをスキャンして参加しよう！</span>
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
              className="w-full rounded-2xl px-3 py-2 bg-white/5 border border-white/10 min-h-10"
            >
              {(() => {
                const opt = visibleComment.choice === 'A' ? election.optionA
                  : visibleComment.choice === 'B' ? election.optionB
                  : OPTION_C;
                return (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <OptionIcon name={opt.icon} size={12} color={opt.lightColor} />
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
      <div className="flex-shrink-0 flex items-center justify-center gap-3 px-6 py-3">
        <div className="text-center">
          <QRCodeImg url={voteUrl} size={90} />
        </div>
        <div className="flex-1">
          <div className="text-center">
            <p className="text-white font-black text-[8px] leading-tight mb-1">
              ↑ QRコードをスキャンして投票しよう
            </p>
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block mt-1"
            >
              <div
                className="px-3 py-1.5 rounded-full font-black text-white text-[8px]"
                style={{ background: 'linear-gradient(135deg, #00C4EE, #FF6B35)' }}
              >
                投票はひとり1回のみできます
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ─── フッター ────────────────────────── */}
      <div className="flex-shrink-0 text-center pb-2">
        <p className="text-white/20 text-[6px]">函館コミュニティプラザ Gスクエア / みんなでつくるGスクエアプロジェクト</p>
      </div>
    </div>
    </div>
  );
}

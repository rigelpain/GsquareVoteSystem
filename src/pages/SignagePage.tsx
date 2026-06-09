// =============================================
// SignagePage.tsx - サイネージ表示専用画面
// 縦型サイネージ（1m×0.6m）向け大画面表示
// URL: /signage
// =============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getActiveElection, subscribeToVoteStats } from '../firebase/elections';
import { ensureAuth } from '../firebase/elections';
import { OptionIcon } from '../components/OptionIcon';
import BackgroundParticles from '../components/BackgroundParticles';
import SpikyToken from '../components/SpikyToken';
import { OPTION_C } from '../types';
import type { Election, ElectionOption, VoteStats } from '../types';

function QRCodeImg({ url, size = 200 }: { url: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1A1A2E&format=png`;
  return (
    <div className="bg-white rounded-2xl p-2 inline-block">
      <img src={src} width={size} height={size} alt="投票QRコード" />
    </div>
  );
}

function OptionCard({ opt, pct, glowSide }: { opt: ElectionOption; pct: number; glowSide: 'left' | 'right' }) {
  return (
    <motion.div
      className="flex-1 min-w-0 rounded-2xl px-1.5 py-3.5 text-center relative overflow-hidden flex flex-col items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${opt.color}25, ${opt.accentColor}40)`,
        border: `2px solid ${opt.color}80`,
      }}
      animate={{ borderColor: [`${opt.color}80`, `${opt.color}cc`, `${opt.color}80`] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle at ${glowSide === 'right' ? '80%' : '20%'} 50%, ${opt.color}, transparent 70%)` }}
      />
      <div className="relative flex flex-col items-center w-full">
        <div className="mb-1" style={{ color: opt.lightColor }}>
          <OptionIcon name={opt.icon} size={26} />
        </div>
        <h2 className="font-black text-[14px] leading-tight" style={{ color: opt.lightColor }}>
          {opt.title}
        </h2>
        <p className="text-white/60 text-[9px] mt-1 leading-snug line-clamp-2">
          {opt.description}
        </p>
        <div
          className="mt-1.5 inline-block px-3 py-1 rounded-full font-black text-white text-[15px]"
          style={{ background: opt.color }}
        >
          {pct}%
        </div>
      </div>
    </motion.div>
  );
}

function VsBadge() {
  return (
    <div className="flex items-center justify-center relative z-20 flex-shrink-0 -mx-3">
      <div className="rounded-full w-7 h-7 flex items-center justify-center border border-white/30 backdrop-blur-md shadow-lg" style={{ background: 'rgba(20,20,30,0.55)' }}>
        <span className="text-white/80 font-black text-[9px]">VS</span>
      </div>
    </div>
  );
}

const TICKER_SIZE = 5;

export default function SignagePage() {
  const [election, setElection] = useState<Election | null>(null);
  const [stats, setStats] = useState<VoteStats>({ votesA: 0, votesB: 0, votesC: 0, totalVoters: 0, comments: [] });
  const [loading, setLoading] = useState(true);

  // コメントスクローラー用ステート
  const [batchStart, setBatchStart] = useState(0);   // 現バッチの先頭インデックス
  const [scrolledOut, setScrolledOut] = useState(0); // 現バッチから何件スクロール済みか
  const [batchCycle, setBatchCycle] = useState(0);   // 全件一周したら加算（Presenceキー用）

  const voteUrl = import.meta.env.VITE_VOTE_URL ?? `${window.location.origin}/`;

  // データ読み込み
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
    return () => { unsubscribe?.(); };
  }, []);

  const allComments = useMemo(
    () => stats.comments.filter((c) => c.choice !== 'C' || !!c.disagreeReason),
    [stats.comments]
  );
  const commentCount = allComments.length;

  // バッチ内の実件数（末尾バッチは5未満の場合あり）
  const batchLen = Math.min(TICKER_SIZE, Math.max(0, commentCount - batchStart));
  // 現在表示中のコメント（古い順：上がいちばん古い）
  const visibleComments = allComments.slice(batchStart + scrolledOut, batchStart + batchLen);

  // 8秒ごとに最古（上端）を1件スクロールアウト
  // scrolledOut が batchLen に達したらタイマーを止める（batch-switch effect へ）
  useEffect(() => {
    if (commentCount === 0) return;
    if (scrolledOut >= batchLen) return;
    const id = setTimeout(() => setScrolledOut((v) => v + 1), 8000);
    return () => clearTimeout(id);
  }, [commentCount, batchStart, scrolledOut, batchLen]);

  // 全件スクロールアウト後 → 650ms 待って次バッチへ（exit アニメーション完了後に切替）
  useEffect(() => {
    if (commentCount === 0 || scrolledOut < batchLen || batchLen === 0) return;
    const id = setTimeout(() => {
      const nextStart = batchStart + TICKER_SIZE;
      if (nextStart >= commentCount) {
        // 全件一周 → 最初に戻りキーも刷新
        setBatchCycle((c) => c + 1);
        setBatchStart(0);
      } else {
        setBatchStart(nextStart);
      }
      setScrolledOut(0);
    }, 650);
    return () => clearTimeout(id);
  }, [scrolledOut, batchLen, batchStart, commentCount]);

  // コメント数が変わったら先頭からリセット
  const prevCommentCount = useRef(commentCount);
  useEffect(() => {
    if (prevCommentCount.current !== commentCount) {
      prevCommentCount.current = commentCount;
      setBatchStart(0);
      setScrolledOut(0);
    }
  }, [commentCount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <p className="text-white/50 text-[14px]">読み込み中...</p>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <p className="text-white/50 text-[14px]">進行中の投票がありません</p>
      </div>
    );
  }

  const total = stats.votesA + stats.votesB + stats.votesC;
  const pctA = total === 0 ? 33 : Math.round((stats.votesA / total) * 100);
  const pctB = total === 0 ? 33 : Math.round((stats.votesB / total) * 100);
  const pctC = 100 - pctA - pctB;

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
    <div
      className="relative overflow-hidden flex flex-col"
      style={{
        aspectRatio: '1000 / 1315',
        width: 'min(100vw, calc(100vh * 1000 / 1315))',
        height: 'min(100vh, calc(100vw * 1315 / 1000))',
        background: 'linear-gradient(160deg, #0D1117 0%, #1A1A2E 40%, #0D1117 100%)',
        fontFamily: "'M PLUS Rounded 1c', sans-serif",
      }}
    >
      <BackgroundParticles colorA={election.optionA.color} colorB={election.optionB.color} count={16} position="absolute" />

      {/* ─── 上部：タイトルエリア ────────────────── */}
      <div className="relative z-10 flex-shrink-0 text-center px-6 pt-1.5 pb-0">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-white/50 text-[9px] font-bold tracking-widest mb-0.5">
            みんなでつくるGスクエア
          </p>
          <h1 className="text-white font-black text-[17px] leading-tight">{election.title}</h1>
          <p className="text-white/60 text-[8px] mt-0.5 leading-snug">{election.description}</p>
          <p className="text-white/40 text-[8px] font-bold mt-0.5">投票期間：6/15 〜 7/15</p>
        </motion.div>
      </div>

      {/* ─── 中央：3択カード + 投票バー + みんなの声 ──────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 gap-0.5 min-h-0 overflow-hidden">

        {/* A vs C vs B カード */}
        <div className="w-full flex flex-row items-stretch gap-1">
          <OptionCard opt={election.optionA} pct={pctA} glowSide="right" />
          <VsBadge />
          <div
            className="flex-[0.67] min-w-0 px-1 py-1.5 rounded-xl text-center border flex flex-col items-center justify-center"
            style={{ background: 'rgba(107,114,128,0.10)', borderColor: 'rgba(107,114,128,0.35)', borderStyle: 'dashed' }}
          >
            <div className="mb-0.5">
              <OptionIcon name={OPTION_C.icon} size={16} color="rgba(255,255,255,0.5)" />
            </div>
            <h2 className="text-[9px] font-black text-white/60 leading-tight">{OPTION_C.title}</h2>
            <div className="mt-0.5 inline-block px-1.5 py-0.5 rounded-full font-black text-white/70 text-[8px]" style={{ background: OPTION_C.color }}>
              {pctC}%
            </div>
          </div>
          <VsBadge />
          <OptionCard opt={election.optionB} pct={pctB} glowSide="left" />
        </div>

        {/* 投票バー */}
        <div className="w-full mt-1">
          <div className="relative w-full h-5 rounded-full overflow-hidden bg-gray-900/60 flex">
            <motion.div
              className="h-full flex items-center pl-3 flex-shrink-0"
              style={{ background: election.optionA.color }}
              animate={{ width: `${pctA}%` }}
              transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {pctA > 10 && <span className="text-white font-black text-[10px] drop-shadow-lg">{pctA}%</span>}
            </motion.div>
            <motion.div
              className="h-full flex items-center justify-center flex-shrink-0"
              style={{ background: OPTION_C.color }}
              animate={{ width: `${pctC}%` }}
              transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {pctC > 10 && <span className="text-white font-black text-[10px] drop-shadow-lg">{pctC}%</span>}
            </motion.div>
            <motion.div
              className="h-full flex items-center pr-3 justify-end flex-shrink-0"
              style={{ background: election.optionB.color }}
              animate={{ width: `${pctB}%` }}
              transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {pctB > 10 && <span className="text-white font-black text-[10px] drop-shadow-lg">{pctB}%</span>}
            </motion.div>
          </div>
          <div className="text-center mt-1">
            <span className="text-white/60 font-bold text-[12px]">{stats.totalVoters}人が投票中</span>
          </div>
        </div>

        {/* みんなの声（最古が上から順に押し出され、0件になったら次バッチが下から浮き上がる） */}
        {commentCount > 0 && (
          <div className="w-full mt-0.5">
            <p className="text-[13px] font-bold text-white/60 mb-1">みんなの声</p>
            <div className="flex flex-col gap-1 overflow-hidden">
              <AnimatePresence mode="popLayout">
                {visibleComments.map((c) => {
                  const opt = c.choice === 'A' ? election.optionA : c.choice === 'B' ? election.optionB : OPTION_C;
                  const opposing = c.choice === 'A' ? election.optionB : c.choice === 'B' ? election.optionA : null;
                  return (
                    <motion.div
                      key={`${batchCycle}_${c.id}`}
                      layout
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -40, opacity: 0 }}
                      transition={{ duration: 0.45, ease: 'easeInOut' }}
                      className="rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5"
                      style={{ background: `${opt.color}26`, border: `1px solid ${opt.color}55` }}
                    >
                      <div className="flex items-center gap-1.5">
                        <OptionIcon name={opt.icon} size={13} color={opt.lightColor} />
                        <p className="text-white/90 text-[12px] leading-snug truncate flex-1 min-w-0">"{c.agreeReason}"</p>
                      </div>
                      {c.disagreeReason && (
                        <div className="flex items-center gap-1 pl-1">
                          {opposing && <OptionIcon name={opposing.icon} size={11} color={opposing.lightColor} />}
                          {opposing && <span className="text-white/50 text-[9px] font-bold flex-shrink-0">に反対</span>}
                          <SpikyToken color="#FF5C7A" size={11} />
                          <p className="text-white/55 text-[10px] leading-snug italic truncate flex-1 min-w-0">"{c.disagreeReason}"</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* ─── 下部：QRコード ────────────────────── */}
      <div className="relative z-10 flex-shrink-0 flex flex-col items-center justify-center gap-1 px-6 py-1.5">
        <QRCodeImg url={voteUrl} size={62} />
        <div className="text-center">
          {/* スケール変化ではなく光沢シマーアニメーション */}
          <div className="relative inline-block overflow-hidden rounded-full">
            <div
              className="px-3.5 py-1 rounded-full font-black text-white text-[12px]"
              style={{ background: 'linear-gradient(135deg, #00C4EE, #FF6B35)' }}
            >
              QRコードをスキャンして投票しよう
            </div>
            <motion.div
              className="absolute inset-0 pointer-events-none rounded-full"
              style={{
                background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)',
              }}
              animate={{ x: ['-120%', '180%'] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2.8, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </div>

      {/* ─── フッター ────────────────────────── */}
      <div className="relative z-10 flex-shrink-0 text-center pb-0.5">
        <p className="text-white/15 text-[6px]">函館コミュニティプラザ Gスクエア / みんなでつくるGスクエアプロジェクト</p>
      </div>
    </div>
    </div>
  );
}

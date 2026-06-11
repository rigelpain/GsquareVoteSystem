// =============================================
// SignagePage.tsx - サイネージ表示専用画面
// 縦型サイネージ（1m×0.6m）向け大画面表示
// URL: /signage
// =============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { getActiveElection, subscribeToVoteStats } from '../firebase/elections';
import { ensureAuth } from '../firebase/elections';
import { OptionIcon } from '../components/OptionIcon';
import BackgroundParticles from '../components/BackgroundParticles';
import SpikyToken from '../components/SpikyToken';
import { OPTION_C } from '../types';
import type { Election, ElectionOption, VoteStats } from '../types';

// ─── QRコード ───────────────────────────────
function QRCodeImg({ url, size = 200, compact = false }: { url: string; size?: number; compact?: boolean }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1A1A2E&format=png`;
  return (
    <div
      className={`inline-block ${compact ? 'p-1.5' : 'p-2'}`}
      style={{
        borderRadius: '10px',
        background: 'white',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <img src={src} width={size} height={size} alt="投票QRコード" style={{ borderRadius: '4px', display: 'block' }} />
    </div>
  );
}

// ─── カウントダウン＋QR統合ブロック ─────────
function CountdownCard({ endAt, isCompact, voteUrl }: { endAt?: Date; isCompact: boolean; voteUrl: string }) {
  const endDate = endAt ?? new Date('2026-07-15');
  const msLeft = endDate.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const qrSize = isCompact ? 56 : 72;

  return (
    <div
      className="flex flex-col items-center text-center"
      style={{
        padding: isCompact ? '10px 16px' : '14px 20px',
        borderRadius: '16px',
        background: 'rgba(0,196,238,0.07)',
        border: '1px solid rgba(0,196,238,0.30)',
        gap: isCompact ? '5px' : '7px',
      }}
    >
      {/* 投票期間 */}
      <p style={{ fontSize: '7px', color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.05em' }}>
        投票期間：6/15〜7/15
      </p>
      {/* 投票終了まで */}
      <div>
        <p style={{ fontSize: isCompact ? '9px' : '10px', color: 'rgba(255,255,255,0.55)', fontWeight: 700, lineHeight: 1.2 }}>
          投票終了まで
        </p>
        <p style={{ fontSize: isCompact ? '30px' : '38px', color: '#00C4EE', fontWeight: 900, lineHeight: 1 }}>
          {daysLeft}
          <span style={{ fontSize: isCompact ? '15px' : '19px', fontWeight: 900 }}>日</span>
        </p>
      </div>
      {/* QRコード */}
      <QRCodeImg url={voteUrl} size={qrSize} compact={isCompact} />
      {/* スキャンラベル */}
      <p style={{
        fontSize: isCompact ? '8px' : '9px',
        color: 'rgba(0,196,238,0.75)',
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}>
        QRコードをスキャンして投票
      </p>
    </div>
  );
}

// ─── 選択肢カード ────────────────────────────
function OptionCard({ opt, pct, glowSide, compact = false }: {
  opt: ElectionOption; pct: number; glowSide: 'left' | 'right'; compact?: boolean
}) {
  return (
    <motion.div
      className={`flex-1 min-w-0 rounded-2xl px-1.5 ${compact ? 'py-1.5' : 'py-3'} text-center relative overflow-hidden flex flex-col items-center justify-center`}
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
        <div className={compact ? 'mb-0.5' : 'mb-1'} style={{ color: opt.lightColor }}>
          <OptionIcon name={opt.icon} size={compact ? 14 : 20} />
        </div>
        <h2
          className={`font-black ${compact ? 'text-[11px]' : 'text-[14px]'} leading-tight`}
          style={{ color: opt.lightColor }}
        >
          {opt.title}
        </h2>
        {!compact && (
          <p className="text-white/60 text-[8px] mt-1 leading-snug line-clamp-2">
            {opt.description}
          </p>
        )}
        <div
          className={`${compact ? 'mt-0.5 px-1.5 py-0.5 text-[9px]' : 'mt-1.5 px-2.5 py-0.5 text-[12px]'} inline-block rounded-full font-black text-white`}
          style={{ background: opt.color }}
        >
          {pct}%
        </div>
      </div>
    </motion.div>
  );
}

// ─── VS バッジ ───────────────────────────────
function VsBadge() {
  return (
    <div className="flex items-center justify-center relative z-20 flex-shrink-0 -mx-2">
      <div className="rounded-full w-5 h-5 flex items-center justify-center border border-white/30 backdrop-blur-md shadow-lg" style={{ background: 'rgba(20,20,30,0.55)' }}>
        <span className="text-white/80 font-black text-[7px]">VS</span>
      </div>
    </div>
  );
}

// ─── メインページ ────────────────────────────
export default function SignagePage() {
  const isNarrow = window.innerWidth <= 390;
  const narrowScale = 0.75;
  // フォント・余白: 実際の viewport 高さで判断
  const isCompact = window.innerHeight < 600;
  // コメント件数: スケール後の実効高さで判断
  const effectiveHeight = isNarrow ? window.innerHeight / narrowScale : window.innerHeight;
  const TICKER_SIZE = effectiveHeight < 500 ? 2 : effectiveHeight < 600 ? 3 : 5;

  const [election, setElection] = useState<Election | null>(null);
  const [stats, setStats] = useState<VoteStats>({ votesA: 0, votesB: 0, votesC: 0, totalVoters: 0, comments: [] });
  const [loading, setLoading] = useState(true);

  const [windowTop, setWindowTop] = useState(0);
  const [cycle, setCycle] = useState(0);

  const commentListRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

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
    return () => { unsubscribe?.(); };
  }, []);

  const allComments = useMemo(
    () => stats.comments.filter((c) => c.choice !== 'C' || !!c.disagreeReason),
    [stats.comments]
  );
  const commentCount = allComments.length;

  const commentSlots = useMemo(
    () => Array.from({ length: TICKER_SIZE }, (_, i) => {
      const idx = windowTop + i;
      return idx < commentCount ? allComments[idx] : null;
    }),
    [windowTop, commentCount, allComments]
  );

  useEffect(() => {
    if (lockedHeight !== null) return;
    if (!commentListRef.current) return;
    const realCount = commentSlots.filter(Boolean).length;
    if (realCount === TICKER_SIZE) {
      const h = commentListRef.current.getBoundingClientRect().height;
      if (h > 0) setLockedHeight(h);
    }
  }, [commentSlots, lockedHeight]);

  useEffect(() => {
    if (commentCount === 0 || windowTop >= commentCount) return;
    const id = setTimeout(() => setWindowTop((v) => v + 1), 8000);
    return () => clearTimeout(id);
  }, [commentCount, windowTop]);

  useEffect(() => {
    if (commentCount === 0 || windowTop < commentCount) return;
    const id = setTimeout(() => {
      setCycle((c) => c + 1);
      setWindowTop(0);
    }, 650);
    return () => clearTimeout(id);
  }, [commentCount, windowTop]);

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
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#0D1117' }}>
      <div
        className="relative overflow-hidden flex flex-col"
        style={{
          width: isNarrow ? `${window.innerWidth / narrowScale}px` : '100%',
          height: isNarrow ? `${window.innerHeight / narrowScale}px` : '100%',
          transform: isNarrow ? `scale(${narrowScale})` : undefined,
          transformOrigin: isNarrow ? 'top left' : undefined,
          background: 'linear-gradient(160deg, #0D1117 0%, #1A1A2E 40%, #0D1117 100%)',
          fontFamily: "'M PLUS Rounded 1c', sans-serif",
        }}
      >
        <BackgroundParticles colorA={election.optionA.color} colorB={election.optionB.color} count={16} position="absolute" />

        {/* ─── ヘッダー ─────────────────────────── */}
        <div className={`relative z-10 flex-shrink-0 text-center px-6 ${isCompact ? 'pt-1 pb-0' : 'pt-1.5 pb-0'}`}>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-white/50 text-[8px] font-bold tracking-widest mb-0.5">
              みんなでつくるGスクエア
            </p>
            <h1 className={`text-white font-black ${isCompact ? 'text-[11px]' : 'text-[14px]'} leading-tight`}>
              {election.title}
            </h1>
            {!isCompact && (
              <p className="text-white/60 text-[7px] mt-0.5 leading-snug">{election.description}</p>
            )}
          </motion.div>
        </div>

        {/* ─── メイン（カード・バー・コメント・カウントダウン・QR） ── */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-evenly px-4 py-3 min-h-0 overflow-hidden">

          {/* 上グループ: カード + バー + コメント */}
          <div className="w-full flex flex-col gap-0.5 flex-shrink-0">

            {/* A vs C vs B カード */}
            <div className="w-full flex flex-row items-stretch gap-1">
              <OptionCard opt={election.optionA} pct={pctA} glowSide="right" compact={isCompact} />
              <VsBadge />
              <div
                className={`flex-[0.67] min-w-0 px-1 ${isCompact ? 'py-0.5' : 'py-1'} rounded-xl text-center border flex flex-col items-center justify-center`}
                style={{ background: 'rgba(107,114,128,0.10)', borderColor: 'rgba(107,114,128,0.35)', borderStyle: 'dashed' }}
              >
                <div className="mb-0.5">
                  <OptionIcon name={OPTION_C.icon} size={isCompact ? 10 : 13} color="rgba(255,255,255,0.5)" />
                </div>
                <h2 className={`${isCompact ? 'text-[7px]' : 'text-[8px]'} font-black text-white/60 leading-tight`}>{OPTION_C.title}</h2>
                <div
                  className={`mt-0.5 inline-block px-1 py-0 rounded-full font-black text-white/70 ${isCompact ? 'text-[6px]' : 'text-[7px]'}`}
                  style={{ background: OPTION_C.color }}
                >
                  {pctC}%
                </div>
              </div>
              <VsBadge />
              <OptionCard opt={election.optionB} pct={pctB} glowSide="left" compact={isCompact} />
            </div>

            {/* 投票バー */}
            <div className="w-full">
              <div className={`relative w-full ${isCompact ? 'h-4' : 'h-5'} rounded-full overflow-hidden bg-gray-900/60 flex`}>
                <motion.div
                  className="h-full flex items-center pl-3 flex-shrink-0"
                  style={{ background: election.optionA.color }}
                  animate={{ width: `${pctA}%` }}
                  transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  {pctA > 10 && <span className="text-white font-black text-[9px] drop-shadow-lg">{pctA}%</span>}
                </motion.div>
                <motion.div
                  className="h-full flex items-center justify-center flex-shrink-0"
                  style={{ background: OPTION_C.color }}
                  animate={{ width: `${pctC}%` }}
                  transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  {pctC > 10 && <span className="text-white font-black text-[9px] drop-shadow-lg">{pctC}%</span>}
                </motion.div>
                <motion.div
                  className="h-full flex items-center pr-3 justify-end flex-shrink-0"
                  style={{ background: election.optionB.color }}
                  animate={{ width: `${pctB}%` }}
                  transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  {pctB > 10 && <span className="text-white font-black text-[9px] drop-shadow-lg">{pctB}%</span>}
                </motion.div>
              </div>
              <div className="text-center mt-0.5">
                <span className={`text-white/60 font-bold ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                  {stats.totalVoters}人が投票中
                </span>
              </div>
            </div>

            {/* みんなの声 */}
            {commentCount > 0 && (
              <div className="w-full">
                <p className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} font-bold text-white/60 mb-0.5`}>みんなの声</p>
                <div
                  ref={commentListRef}
                  className="flex flex-col gap-1 overflow-hidden"
                  style={lockedHeight !== null ? { height: lockedHeight } : undefined}
                >
                  <AnimatePresence mode="popLayout">
                    {commentSlots.map((c, slotIndex) => {
                      if (!c) {
                        return (
                          <div
                            key={`spacer_${slotIndex}`}
                            className="rounded-lg px-2.5 py-1.5 pointer-events-none"
                            style={{ visibility: 'hidden' }}
                            aria-hidden="true"
                          >
                            <div className="flex items-center gap-1.5">
                              <div style={{ width: 11, height: 11 }} />
                              <p className="text-[10px] leading-snug">&nbsp;</p>
                            </div>
                          </div>
                        );
                      }
                      const opt = c.choice === 'A' ? election.optionA : c.choice === 'B' ? election.optionB : OPTION_C;
                      const opposing = c.choice === 'A' ? election.optionB : c.choice === 'B' ? election.optionA : null;
                      return (
                        <motion.div
                          key={`${cycle}_${c.id}`}
                          layout
                          initial={{ y: 40, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -40, opacity: 0 }}
                          transition={{ duration: 0.45, ease: 'easeInOut' }}
                          className="rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5"
                          style={{ background: `${opt.color}26`, border: `1px solid ${opt.color}55` }}
                        >
                          <div className="flex items-center gap-1.5">
                            <OptionIcon name={opt.icon} size={11} color={opt.lightColor} />
                            <p className="text-white/90 text-[10px] leading-snug truncate flex-1 min-w-0">{c.agreeReason}</p>
                          </div>
                          {c.disagreeReason && (
                            <div className="flex items-center gap-1 pl-1">
                              {opposing ? (
                                <>
                                  <OptionIcon name={opposing.icon} size={9} color={opposing.lightColor} />
                                  <span className="text-white/50 text-[8px] font-bold flex-shrink-0">に反対</span>
                                  <SpikyToken color="#FF5C7A" size={9} />
                                </>
                              ) : (
                                <>
                                  <MessageCircle size={9} color="rgba(255,255,255,0.45)" />
                                  <span className="text-white/50 text-[8px] font-bold flex-shrink-0">欲しいもの</span>
                                </>
                              )}
                              <p className="text-white/55 text-[9px] leading-snug italic truncate flex-1 min-w-0">{c.disagreeReason}</p>
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

          {/* 下グループ: カウントダウン＋QR統合ブロック */}
          <div className="flex justify-center flex-shrink-0">
            <CountdownCard endAt={election.endAt} isCompact={isCompact} voteUrl={voteUrl} />
          </div>
        </div>

        {/* ─── フッター ─────────────────────────── */}
        <div className="relative z-10 flex-shrink-0 text-center pb-0.5">
          <p className="text-white/15 text-[5px]">函館コミュニティプラザ Gスクエア / みんなでつくるGスクエアプロジェクト</p>
        </div>
      </div>
    </div>
  );
}

// =============================================
// AdminPage.tsx - 管理者画面
// パスワード保護 + 投票コメント閲覧 + リセット
// =============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getActiveElection, subscribeToVoteStats, resetVotes } from '../firebase/elections';
import { ensureAuth } from '../firebase/elections';
import type { Election, VoteStats } from '../types';

// 環境変数または固定パスワード（本番では環境変数へ）
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? 'gsquare2024';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [election, setElection] = useState<Election | null>(null);
  const [stats, setStats] = useState<VoteStats>({ votesA: 0, votesB: 0, totalVoters: 0, comments: [] });
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'A' | 'B'>('all');

  // 認証
  const handleLogin = () => {
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
      setPwError('');
    } else {
      setPwError('パスワードが違います');
    }
  };

  // 選挙データ取得
  useEffect(() => {
    if (!authed) return;
    let unsubscribe: (() => void) | null = null;

    setLoading(true);
    (async () => {
      await ensureAuth();
      const el = await getActiveElection();
      if (!el) { setLoading(false); return; }
      setElection(el);
      unsubscribe = subscribeToVoteStats(el.id, setStats);
      setLoading(false);
    })();

    return () => unsubscribe?.();
  }, [authed]);

  // リセット
  const handleReset = async () => {
    if (!election) return;
    setResetting(true);
    try {
      await resetVotes(election.id);
      setResetConfirm(false);
    } finally {
      setResetting(false);
    }
  };

  // ─── ログイン画面 ──────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center ink-bg px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xs"
        >
          <div className="splat-card bg-gray-800/80 p-8">
            <h1 className="text-white font-black text-xl mb-1 text-center">管理者ログイン</h1>
            <p className="text-white/40 text-sm text-center mb-6">Gスクエア投票管理</p>

            <div className="flex flex-col gap-4">
              <input
                type="password"
                className="splat-textarea"
                placeholder="パスワード"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
              <button
                onClick={handleLogin}
                className="splat-btn"
                style={{ background: '#00C4EE', borderBottomColor: '#006A8A' }}
              >
                ログイン
              </button>
            </div>

            <p className="text-white/20 text-xs text-center mt-6">
              ※スタッフ専用画面です
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── 管理画面 ──────────────────────────────────
  const filteredComments = stats.comments.filter((c) =>
    filter === 'all' ? true : c.choice === filter
  );

  return (
    <div className="min-h-screen ink-bg">
      {/* ヘッダー */}
      <header className="bg-gray-900/80 border-b border-white/10 px-5 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-sm">
        <h1 className="text-white font-black text-lg">📊 投票管理</h1>
        <button
          onClick={() => setAuthed(false)}
          className="text-white/40 text-sm hover:text-white/70 transition-colors"
        >
          ログアウト
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {loading ? (
          <p className="text-white/50 text-center py-10">読み込み中...</p>
        ) : !election ? (
          <p className="text-white/50 text-center py-10">進行中の投票がありません</p>
        ) : (
          <>
            {/* 統計カード */}
            <div className="splat-card bg-gray-800/60 p-5">
              <h2 className="text-white/60 text-xs font-bold mb-3 tracking-widest">
                現在の投票状況
              </h2>
              <p className="text-white font-black text-lg mb-4">{election.title}</p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-3xl font-black" style={{ color: election.optionA.color }}>
                    {stats.votesA}
                  </p>
                  <p className="text-white/50 text-xs mt-1">
                    {election.optionA.icon} {election.optionA.title}
                  </p>
                </div>
                <div className="text-center border-x border-white/10">
                  <p className="text-3xl font-black text-white">{stats.totalVoters}</p>
                  <p className="text-white/50 text-xs mt-1">投票者数</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black" style={{ color: election.optionB.color }}>
                    {stats.votesB}
                  </p>
                  <p className="text-white/50 text-xs mt-1">
                    {election.optionB.icon} {election.optionB.title}
                  </p>
                </div>
              </div>

              {/* バー */}
              {(() => {
                const total = stats.votesA + stats.votesB;
                const pctA = total === 0 ? 50 : Math.round((stats.votesA / total) * 100);
                const pctB = 100 - pctA;
                return (
                  <div className="relative w-full h-8 rounded-full overflow-hidden bg-gray-900">
                    <div
                      className="absolute left-0 top-0 h-full flex items-center pl-3 transition-all duration-700"
                      style={{ width: `${pctA}%`, background: election.optionA.color }}
                    >
                      {pctA > 10 && <span className="text-white text-xs font-black">{pctA}%</span>}
                    </div>
                    <div
                      className="absolute right-0 top-0 h-full flex items-center pr-3 transition-all duration-700"
                      style={{ width: `${pctB}%`, background: election.optionB.color }}
                    >
                      {pctB > 10 && <span className="text-white text-xs font-black">{pctB}%</span>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* リセットボタン */}
            <div className="splat-card bg-red-950/40 border-red-800/30 p-5">
              <h2 className="text-red-400 font-bold text-sm mb-2">⚠️ 危険操作</h2>
              {!resetConfirm ? (
                <button
                  onClick={() => setResetConfirm(true)}
                  className="splat-btn text-base px-6 py-3"
                  style={{ background: '#7f1d1d', borderBottomColor: '#450a0a' }}
                >
                  投票データをリセット
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-red-300 text-sm font-bold">
                    本当にリセットしますか？この操作は取り消せません。
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleReset}
                      disabled={resetting}
                      className="splat-btn text-sm px-5 py-2"
                      style={{ background: '#dc2626', borderBottomColor: '#991b1b' }}
                    >
                      {resetting ? 'リセット中...' : '確認・リセット実行'}
                    </button>
                    <button
                      onClick={() => setResetConfirm(false)}
                      className="splat-btn text-sm px-5 py-2"
                      style={{ background: '#374151', borderBottomColor: '#1f2937' }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* コメント一覧 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-bold">
                  💬 コメント一覧（{filteredComments.length}件）
                </h2>
                <div className="flex gap-2">
                  {(['all', 'A', 'B'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className="text-xs px-3 py-1.5 rounded-full font-bold transition-all"
                      style={{
                        background: filter === f
                          ? f === 'A' ? election.optionA.color
                          : f === 'B' ? election.optionB.color
                          : 'white'
                          : 'rgba(255,255,255,0.1)',
                        color: filter === f ? '#000' : 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {f === 'all' ? '全て' : f === 'A' ? `${election.optionA.icon}A` : `${election.optionB.icon}B`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {filteredComments.map((c) => {
                    const opt = c.choice === 'A' ? election.optionA : election.optionB;
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-xl p-4"
                        style={{
                          background: `${opt.color}15`,
                          border: `1px solid ${opt.color}33`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: opt.color, color: '#fff' }}
                          >
                            {opt.icon} {opt.title}
                          </span>
                          <span className="text-white/30 text-xs">
                            {c.createdAt.toLocaleDateString('ja-JP', {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-white/90 text-sm leading-relaxed">
                          ❤️ {c.agreeReason}
                        </p>
                        {c.disagreeReason && (
                          <p className="text-white/50 text-sm mt-1.5 leading-relaxed">
                            💬 {c.disagreeReason}
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {filteredComments.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-8">
                    コメントはまだありません
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================
// AdminPage.tsx - 管理者画面
// パスワード保護 + 投票コメント閲覧 + リセット
// =============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, MessageCircle, Heart, EyeOff, Eye, Users, Monitor } from 'lucide-react';
import {
  getActiveElection, subscribeToVoteStats, resetVotes, moderateVote,
  subscribeToAdminVotes, subscribeToSympathyCounts, subscribeToDeviceVisits,
} from '../firebase/elections';
import { ensureAuth } from '../firebase/elections';
import { OptionIcon } from '../components/OptionIcon';
import SpikyToken from '../components/SpikyToken';
import { OPTION_C } from '../types';
import type { Election, VoteStats, AdminVoteRecord, DeviceVisitRecord } from '../types';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? 'gsquare2024';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [election, setElection] = useState<Election | null>(null);
  const [stats, setStats] = useState<VoteStats>({ votesA: 0, votesB: 0, votesC: 0, totalVoters: 0, comments: [] });
  const [adminVotes, setAdminVotes] = useState<AdminVoteRecord[]>([]);
  const [sympathyCounts, setSympathyCounts] = useState<Record<string, number>>({});
  const [deviceVisits, setDeviceVisits] = useState<Record<string, DeviceVisitRecord>>({});
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [activeTab, setActiveTab] = useState<'comments' | 'devices'>('comments');

  const handleLogin = () => {
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
      setPwError('');
    } else {
      setPwError('パスワードが違います');
    }
  };

  useEffect(() => {
    if (!authed) return;
    let unsubStats: (() => void) | null = null;
    let unsubVotes: (() => void) | null = null;
    let unsubSympathy: (() => void) | null = null;
    let unsubVisits: (() => void) | null = null;

    setLoading(true);
    (async () => {
      await ensureAuth();
      const el = await getActiveElection();
      if (!el) { setLoading(false); return; }
      setElection(el);
      unsubStats = subscribeToVoteStats(el.id, setStats, { includeHidden: true });
      unsubVotes = subscribeToAdminVotes(el.id, setAdminVotes);
      unsubSympathy = subscribeToSympathyCounts(el.id, setSympathyCounts);
      unsubVisits = subscribeToDeviceVisits(el.id, setDeviceVisits);
      setLoading(false);
    })();

    return () => { unsubStats?.(); unsubVotes?.(); unsubSympathy?.(); unsubVisits?.(); };
  }, [authed]);

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
            <p className="text-white/20 text-xs text-center mt-6">※スタッフ専用画面です</p>
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
      <header className="bg-gray-900/80 border-b border-white/10 px-5 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-sm">
        <h1 className="text-white font-black text-lg flex items-center gap-2"><BarChart3 size={20} /> 投票管理</h1>
        <button
          onClick={() => setAuthed(false)}
          className="text-white/40 text-sm hover:text-white/70 transition-colors"
        >
          ログアウト
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
        {loading ? (
          <p className="text-white/50 text-center py-10">読み込み中...</p>
        ) : !election ? (
          <p className="text-white/50 text-center py-10">進行中の投票がありません</p>
        ) : (
          <>
            {/* 統計カード */}
            <div className="splat-card bg-gray-800/60 p-5">
              <h2 className="text-white/60 text-xs font-bold mb-3 tracking-widest">現在の投票状況</h2>
              <p className="text-white font-black text-lg mb-4">{election.title}</p>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-black" style={{ color: election.optionA.color }}>{stats.votesA}</p>
                  <p className="text-white/50 text-xs mt-1 flex items-center justify-center gap-1">
                    <OptionIcon name={election.optionA.icon} size={12} color={election.optionA.lightColor} /> A
                  </p>
                  <p className="text-white/30 text-xs truncate">{election.optionA.title}</p>
                </div>
                <div className="text-center border-x border-white/10">
                  <p className="text-2xl font-black" style={{ color: election.optionB.color }}>{stats.votesB}</p>
                  <p className="text-white/50 text-xs mt-1 flex items-center justify-center gap-1">
                    <OptionIcon name={election.optionB.icon} size={12} color={election.optionB.lightColor} /> B
                  </p>
                  <p className="text-white/30 text-xs truncate">{election.optionB.title}</p>
                </div>
                <div className="text-center border-r border-white/10">
                  <p className="text-2xl font-black" style={{ color: OPTION_C.color }}>{stats.votesC}</p>
                  <p className="text-white/50 text-xs mt-1 flex items-center justify-center gap-1">
                    <OptionIcon name={OPTION_C.icon} size={12} color={OPTION_C.lightColor} /> C
                  </p>
                  <p className="text-white/30 text-xs truncate">どちらも不要</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{stats.totalVoters}</p>
                  <p className="text-white/50 text-xs mt-1">投票者数</p>
                </div>
              </div>
              {(() => {
                const total = stats.votesA + stats.votesB + stats.votesC;
                const pctA = total === 0 ? 33.33 : (stats.votesA / total) * 100;
                const pctB = total === 0 ? 33.33 : (stats.votesB / total) * 100;
                const pctC = total === 0 ? 33.34 : 100 - pctA - pctB;
                const rA = Math.round(pctA), rB = Math.round(pctB), rC = 100 - rA - rB;
                return (
                  <div className="relative w-full h-8 rounded-full overflow-hidden bg-gray-900 flex">
                    <div className="h-full flex items-center pl-2 transition-all duration-700 flex-shrink-0" style={{ width: `${pctA}%`, background: election.optionA.color }}>
                      {rA > 10 && <span className="text-white text-xs font-black">{rA}%</span>}
                    </div>
                    <div className="h-full flex items-center justify-center transition-all duration-700 flex-shrink-0" style={{ width: `${pctC}%`, background: OPTION_C.color }}>
                      {rC > 10 && <span className="text-white text-xs font-black">{rC}%</span>}
                    </div>
                    <div className="h-full flex items-center pr-2 justify-end transition-all duration-700 flex-shrink-0" style={{ width: `${pctB}%`, background: election.optionB.color }}>
                      {rB > 10 && <span className="text-white text-xs font-black">{rB}%</span>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* リセット */}
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
                  <p className="text-red-300 text-sm font-bold">本当にリセットしますか？この操作は取り消せません。</p>
                  <div className="flex gap-3">
                    <button onClick={handleReset} disabled={resetting} className="splat-btn text-sm px-5 py-2" style={{ background: '#dc2626', borderBottomColor: '#991b1b' }}>
                      {resetting ? 'リセット中...' : '確認・リセット実行'}
                    </button>
                    <button onClick={() => setResetConfirm(false)} className="splat-btn text-sm px-5 py-2" style={{ background: '#374151', borderBottomColor: '#1f2937' }}>
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* タブ切り替え */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('comments')}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: activeTab === 'comments' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  color: activeTab === 'comments' ? 'white' : 'rgba(255,255,255,0.4)',
                }}
              >
                <MessageCircle size={14} /> コメント一覧
              </button>
              <button
                onClick={() => setActiveTab('devices')}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: activeTab === 'devices' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  color: activeTab === 'devices' ? 'white' : 'rgba(255,255,255,0.4)',
                }}
              >
                <Users size={14} /> 端末詳細
              </button>
            </div>

            {/* ─── コメント一覧タブ ─── */}
            {activeTab === 'comments' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <MessageCircle size={16} /> コメント一覧（{filteredComments.length}件）
                  </h2>
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'A', 'B', 'C'] as const).map((f) => {
                      const fColor = f === 'A' ? election.optionA.color
                        : f === 'B' ? election.optionB.color
                        : f === 'C' ? OPTION_C.color : '#fff';
                      const fIcon = f === 'A' ? election.optionA.icon
                        : f === 'B' ? election.optionB.icon : OPTION_C.icon;
                      return (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className="text-xs px-3 py-1.5 rounded-full font-bold transition-all"
                          style={{
                            background: filter === f ? fColor : 'rgba(255,255,255,0.1)',
                            color: filter === f ? (f === 'all' ? '#000' : '#fff') : 'rgba(255,255,255,0.6)',
                          }}
                        >
                          {f === 'all' ? '全て' : (
                            <span className="flex items-center gap-1">
                              <OptionIcon name={fIcon} size={12} /> {f}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {filteredComments.map((c) => {
                      const opt = c.choice === 'A' ? election.optionA
                        : c.choice === 'B' ? election.optionB : OPTION_C;
                      // A→反対はB、B→反対はA、C→反対なし
                      const opposing = c.choice === 'A' ? election.optionB
                        : c.choice === 'B' ? election.optionA : null;
                      const likeCount = sympathyCounts[c.id] ?? 0;
                      return (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="rounded-xl p-4"
                          style={{ background: `${opt.color}15`, border: `1px solid ${opt.color}33` }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {/* 投票案チップ */}
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                              style={{ background: opt.color, color: '#fff' }}
                            >
                              <OptionIcon name={opt.icon} size={12} /> {opt.title}
                            </span>
                            <span className="text-white/30 text-xs">
                              {c.createdAt.toLocaleDateString('ja-JP', {
                                month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            {/* いいね数 */}
                            <span className="flex items-center gap-1 ml-auto">
                              <Heart
                                size={12}
                                fill={likeCount > 0 ? '#FF2D78' : 'none'}
                                color={likeCount > 0 ? '#FF2D78' : 'rgba(255,255,255,0.25)'}
                              />
                              <span
                                className="text-xs font-bold"
                                style={{ color: likeCount > 0 ? '#FF6BA8' : 'rgba(255,255,255,0.25)' }}
                              >
                                {likeCount}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {c.choice === 'C' ? (
                                <>
                                  <p className="text-white/50 text-xs mb-1">どちらもいらない票</p>
                                  {c.disagreeReason ? (
                                    <p className="text-white/90 text-sm leading-relaxed flex items-start gap-1.5">
                                      <MessageCircle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                      <span><span className="text-yellow-400 font-bold">欲しいもの: </span>{c.disagreeReason}</span>
                                    </p>
                                  ) : (
                                    <p className="text-white/35 text-sm italic">欲しいもの未記入</p>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* 賛成コメント: 投票案アイコン */}
                                  <p className="text-white/90 text-sm leading-relaxed flex items-start gap-1.5">
                                    <OptionIcon name={opt.icon} size={14} color={opt.lightColor} className="flex-shrink-0 mt-0.5" />
                                    {c.agreeReason}
                                  </p>
                                  {/* 反対コメント: 反対案アイコン + "に反対" + トゲトゲ */}
                                  {c.disagreeReason && opposing && (
                                    <p className="text-white/60 text-sm mt-1.5 leading-relaxed flex items-center gap-1.5 flex-wrap">
                                      <OptionIcon name={opposing.icon} size={13} color={opposing.lightColor} className="flex-shrink-0" />
                                      <span className="text-white/40 text-xs font-bold flex-shrink-0">に反対</span>
                                      <SpikyToken color="#FF5C7A" size={13} />
                                      <span className="text-white/60">{c.disagreeReason}</span>
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => election && moderateVote(election.id, c.id, !c.hidden)}
                              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all"
                              style={{
                                background: c.hidden ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                                color: c.hidden ? '#f87171' : 'rgba(255,255,255,0.4)',
                              }}
                              title={c.hidden ? '再表示する' : '非表示にする'}
                            >
                              {c.hidden ? <><EyeOff size={12} /> 非表示中</> : <><Eye size={12} /> 表示中</>}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {filteredComments.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-8">コメントはまだありません</p>
                  )}
                </div>
              </div>
            )}

            {/* ─── 端末詳細タブ ─── */}
            {activeTab === 'devices' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Monitor size={16} className="text-white/60" />
                  <h2 className="text-white font-bold">端末詳細一覧（{adminVotes.length}件）</h2>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <table className="w-full text-xs text-white/80" style={{ minWidth: '1000px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        {['No.', '投票日時', '投票案', '年齢', '性別', '利用頻度', 'OS/端末', '画面', '賛成コメント', '反対/欲しいもの', '♥', '票重み', '再訪回数', '初回訪問', '直近訪問'].map((h) => (
                          <th key={h} className="text-left px-3 py-2.5 text-white/50 font-bold text-[11px] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {adminVotes.map((v, i) => {
                        const opt = v.choice === 'A' ? election.optionA
                          : v.choice === 'B' ? election.optionB : OPTION_C;
                        const likeCount = sympathyCounts[v.id] ?? 0;
                        const platform = v.deviceInfo?.platform ?? '—';
                        const screen = v.deviceInfo
                          ? `${v.deviceInfo.screenWidth}×${v.deviceInfo.screenHeight}`
                          : '—';
                        const visit = deviceVisits[v.deviceId];
                        return (
                          <tr
                            key={v.id}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                            className="hover:bg-white/5 transition-colors"
                          >
                            <td className="px-3 py-2 text-white/30 font-mono">{i + 1}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-white/60">
                              {v.createdAt.toLocaleDateString('ja-JP', {
                                month: 'numeric', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] text-white"
                                style={{ background: opt.color }}
                              >
                                <OptionIcon name={opt.icon} size={10} /> {v.choice}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-white/70">{v.demographic?.age ?? '—'}</td>
                            <td className="px-3 py-2 text-white/70 whitespace-nowrap">{v.demographic?.gender ?? '—'}</td>
                            <td className="px-3 py-2 text-white/70 whitespace-nowrap">{v.demographic?.usageFrequency ?? '—'}</td>
                            <td className="px-3 py-2 text-white/60 whitespace-nowrap">{platform}</td>
                            <td className="px-3 py-2 text-white/50 whitespace-nowrap font-mono">{screen}</td>
                            <td className="px-3 py-2 max-w-[160px]">
                              <p className="truncate text-white/80" title={v.agreeReason}>{v.agreeReason}</p>
                            </td>
                            <td className="px-3 py-2 max-w-[140px]">
                              {v.disagreeReason ? (
                                <p className="truncate text-white/55 italic" title={v.disagreeReason}>{v.disagreeReason}</p>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className="flex items-center gap-1" style={{ color: likeCount > 0 ? '#FF6BA8' : 'rgba(255,255,255,0.2)' }}>
                                <Heart size={11} fill={likeCount > 0 ? '#FF2D78' : 'none'} color={likeCount > 0 ? '#FF2D78' : 'rgba(255,255,255,0.2)'} />
                                {likeCount}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`font-black ${v.voteWeight === 2 ? 'text-yellow-400' : 'text-white/40'}`}>
                                {v.voteWeight}票
                              </span>
                            </td>
                            {/* 再訪データ */}
                            <td className="px-3 py-2 text-center">
                              {visit ? (
                                <span className={`font-black ${visit.visitCount > 1 ? 'text-[#00C4EE]' : 'text-white/40'}`}>
                                  {visit.visitCount}回
                                </span>
                              ) : <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-white/50">
                              {visit ? visit.firstVisitAt.toLocaleDateString('ja-JP', {
                                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              }) : '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-white/50">
                              {visit ? (
                                <span title={visit.visitTimestamps.map(t => t.toLocaleString('ja-JP')).join('\n')}>
                                  {visit.lastVisitAt.toLocaleDateString('ja-JP', {
                                    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {adminVotes.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-8">投票データがありません</p>
                  )}
                </div>
                <p className="text-white/20 text-xs text-center mt-3">
                  ※ 直近訪問列にカーソルを当てると全訪問日時が表示されます
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

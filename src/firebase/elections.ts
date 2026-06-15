// =============================================
// Firestore 選挙データ操作
// =============================================

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  Timestamp,
  arrayUnion,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './config';
import type { Election, VoteStats, ChoiceId, DemographicData, DeviceInfo, AdminVoteRecord, DeviceVisitRecord, SessionEnv, PhaseLogEntry, SessionRecord } from '../types';

// ─── 型変換ヘルパー ───────────────────────────
function toDate(ts: Timestamp | Date | null | undefined): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  return ts as Date;
}

// ─── 匿名認証 ───────────────────────────────
export async function ensureAuth(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

// ─── 現在のアクティブ選挙を取得 ─────────────
export async function getActiveElection(): Promise<Election | null> {
  try {
    const configRef = doc(db, 'config', 'currentElection');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) return null;

    const { electionId } = configSnap.data();
    if (!electionId) return null;

    const electionRef = doc(db, 'elections', electionId);
    const electionSnap = await getDoc(electionRef);
    if (!electionSnap.exists()) return null;

    const data = electionSnap.data();
    return {
      id: electionSnap.id,
      title: data.title,
      description: data.description,
      optionA: data.optionA,
      optionB: data.optionB,
      active: data.active,
      createdAt: toDate(data.createdAt),
      endAt: data.endAt ? toDate(data.endAt) : undefined,
    };
  } catch (e) {
    console.error('getActiveElection error:', e);
    return null;
  }
}

// ─── 票数カウンタを購読（一般画面用・全件購読しない） ──
// Cloud Functions が集計した /stats/counter を購読。read 1件で済む。
export function subscribeToVoteCounts(
  electionId: string,
  callback: (counts: { votesA: number; votesB: number; votesC: number; totalVoters: number }) => void
): Unsubscribe {
  const ref = doc(db, 'elections', electionId, 'stats', 'counter');
  return onSnapshot(ref, (snap) => {
    const v = snap.data();
    callback({
      votesA: v?.votesA ?? 0,
      votesB: v?.votesB ?? 0,
      votesC: v?.votesC ?? 0,
      totalVoters: v?.totalVoters ?? 0,
    });
  });
}

// ─── 最新コメントを購読（一般画面用・最大30件） ──
// orderBy(createdAt desc) + limit(30)。全件購読を避けて read を抑える。
// hidden はクライアントで除外（30件中の非表示分は表示されない＝許容）。
export function subscribeToRecentComments(
  electionId: string,
  callback: (comments: VoteStats['comments']) => void,
  max = 30
): Unsubscribe {
  const q = query(
    collection(db, 'elections', electionId, 'votes'),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  return onSnapshot(q, (snap) => {
    const comments: VoteStats['comments'] = [];
    snap.forEach((d) => {
      const v = d.data();
      if (v.hidden === true) return;
      comments.push({
        id: d.id,
        choice: v.choice,
        agreeReason: v.agreeReason,
        disagreeReason: v.disagreeReason,
        createdAt: toDate(v.createdAt),
        hidden: false,
      });
    });
    callback(comments);
  });
}

// ─── 投票状況をリアルタイムで監視（管理者専用・全件購読） ──
// コメントモデレーション・端末詳細に全件が要るため、管理画面でのみ使用する。
export function subscribeToVoteStats(
  electionId: string,
  callback: (stats: VoteStats) => void,
  options?: { includeHidden?: boolean }
): Unsubscribe {
  const votesRef = collection(db, 'elections', electionId, 'votes');

  return onSnapshot(votesRef, (snap) => {
    let votesA = 0;
    let votesB = 0;
    let votesC = 0;
    let totalVoters = 0;
    const comments: VoteStats['comments'] = [];

    snap.forEach((d) => {
      const v = d.data();
      totalVoters++;
      if (v.choice === 'A') {
        votesA += v.voteWeight ?? 1;
      } else if (v.choice === 'B') {
        votesB += v.voteWeight ?? 1;
      } else {
        votesC += v.voteWeight ?? 1;
      }
      comments.push({
        id: d.id,
        choice: v.choice,
        agreeReason: v.agreeReason,
        disagreeReason: v.disagreeReason,
        createdAt: toDate(v.createdAt),
        hidden: v.hidden === true,
      });
    });

    comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // hidden=true は一般画面から除外（管理者は includeHidden=true で全件取得）
    const visibleComments = options?.includeHidden
      ? comments
      : comments.filter(c => !c.hidden);

    callback({ votesA, votesB, votesC, totalVoters, comments: visibleComments });
  });
}

// ─── 投票を送信 ─────────────────────────────
export async function submitVote(params: {
  electionId: string;
  deviceId: string;
  choice: ChoiceId;
  agreeReason: string;
  disagreeReason?: string;
  demographic?: DemographicData;
  deviceInfo?: DeviceInfo;
  hidden?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { electionId, deviceId, choice, agreeReason, disagreeReason, demographic, deviceInfo, hidden } = params;
  const bonusVote = Boolean(disagreeReason && disagreeReason.trim().length > 0);
  const voteWeight: 1 | 2 = bonusVote ? 2 : 1;

  try {
    // 既投票チェック（Firestoreレベル）
    const existingRef = doc(db, 'elections', electionId, 'votes', deviceId);
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(existingRef);
      if (existing.exists()) {
        throw new Error('ALREADY_VOTED');
      }
      tx.set(existingRef, {
        electionId,
        deviceId,
        choice,
        agreeReason: agreeReason.trim(),
        disagreeReason: disagreeReason?.trim() || null,
        bonusVote,
        voteWeight,
        hidden: hidden === true,
        createdAt: serverTimestamp(),
        demographic: demographic ?? null,
        deviceInfo: deviceInfo ?? null,
      });
    });

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN_ERROR';
    if (msg === 'ALREADY_VOTED') {
      return { success: false, error: 'ALREADY_VOTED' };
    }
    console.error('submitVote error:', e);
    return { success: false, error: msg };
  }
}

// ─── 自由記述：その他要望 ────────────────────
export async function submitSuggestion(params: {
  electionId: string;
  deviceId: string;
  text: string;
}): Promise<void> {
  await addDoc(collection(db, 'elections', params.electionId, 'suggestions'), {
    deviceId: params.deviceId,
    text: params.text,
    createdAt: serverTimestamp(),
  });
}

// ─── 管理者：全投票データ購読（demographic/deviceInfo含む） ──
export function subscribeToAdminVotes(
  electionId: string,
  callback: (votes: AdminVoteRecord[]) => void
): Unsubscribe {
  const votesRef = collection(db, 'elections', electionId, 'votes');
  return onSnapshot(votesRef, (snap) => {
    const votes: AdminVoteRecord[] = snap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id,
        deviceId: v.deviceId,
        choice: v.choice,
        agreeReason: v.agreeReason,
        disagreeReason: v.disagreeReason ?? null,
        bonusVote: v.bonusVote ?? false,
        voteWeight: v.voteWeight ?? 1,
        createdAt: toDate(v.createdAt),
        hidden: v.hidden === true,
        demographic: v.demographic ?? null,
        deviceInfo: v.deviceInfo ?? null,
      };
    });
    votes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(votes);
  });
}

// ─── 管理者：いいね数集計購読 ────────────────────
export function subscribeToSympathyCounts(
  electionId: string,
  callback: (counts: Record<string, number>) => void
): Unsubscribe {
  const sympathiesRef = collection(db, 'elections', electionId, 'sympathies');
  return onSnapshot(sympathiesRef, (snap) => {
    const counts: Record<string, number> = {};
    snap.forEach((d) => {
      const voteId = d.data().voteId as string | undefined;
      if (voteId) counts[voteId] = (counts[voteId] ?? 0) + 1;
    });
    callback(counts);
  });
}

// ─── 管理者：コメント非表示トグル ──────────────
export async function moderateVote(
  electionId: string,
  voteId: string,
  hidden: boolean
): Promise<void> {
  await updateDoc(doc(db, 'elections', electionId, 'votes', voteId), { hidden });
}

// ─── 共感 ────────────────────────────────────
// sympathyId = {deviceId}_{voteId} で重複防止（create-onlyルール）
export async function addSympathy(params: {
  electionId: string;
  deviceId: string;
  voteId: string;
}): Promise<void> {
  const { electionId, deviceId, voteId } = params;
  const sympathyId = `${deviceId}_${voteId}`;
  await setDoc(doc(db, 'elections', electionId, 'sympathies', sympathyId), {
    deviceId,
    voteId,
    createdAt: serverTimestamp(),
  });
}

// ─── 再訪記録 ────────────────────────────────
// sessionStorage で同一セッション内の二重記録を防ぐ
export async function recordVisit(electionId: string, deviceId: string): Promise<void> {
  const sessionKey = `visit_recorded_${electionId}`;
  if (sessionStorage.getItem(sessionKey)) return;

  try {
    const visitRef = doc(db, 'elections', electionId, 'deviceVisits', deviceId);
    const visitSnap = await getDoc(visitRef);
    const now = Timestamp.fromMillis(Date.now());

    if (visitSnap.exists()) {
      await updateDoc(visitRef, {
        visitCount: increment(1),
        visitTimestamps: arrayUnion(now),
        lastVisitAt: serverTimestamp(),
      });
    } else {
      await setDoc(visitRef, {
        deviceId,
        visitCount: 1,
        visitTimestamps: [now],
        firstVisitAt: serverTimestamp(),
        lastVisitAt: serverTimestamp(),
      });
    }
    sessionStorage.setItem(sessionKey, '1');
  } catch (e) {
    console.error('recordVisit error:', e);
  }
}

// ─── セッション行動ログを記録（upsert） ────────
// sessionId = auth.uid（1端末1ドキュメント・最新セッションで上書き）。
// フェーズ遷移毎・離脱検知時に丸ごと上書きする軽量設計。
// onSnapshot接続中の書込なので sendBeacon/Functions 不要。取りこぼし（クラッシュ・電源断）は許容。
export async function upsertSession(
  electionId: string,
  deviceId: string,
  data: {
    env: SessionEnv;
    phaseLog: PhaseLogEntry[];
    lastPhase: string;
    completed: boolean;
    disconnectAt?: number | null;
  }
): Promise<void> {
  try {
    const ref = doc(db, 'elections', electionId, 'sessions', deviceId);
    await setDoc(
      ref,
      {
        deviceId,
        env: data.env,
        phaseLog: data.phaseLog,
        lastPhase: data.lastPhase,
        completed: data.completed,
        disconnectAt: data.disconnectAt ? Timestamp.fromMillis(data.disconnectAt) : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error('upsertSession error:', e);
  }
}

// ─── 管理者：セッションデータ購読 ────────────
export function subscribeToSessions(
  electionId: string,
  callback: (sessions: Record<string, SessionRecord>) => void
): Unsubscribe {
  const sessionsRef = collection(db, 'elections', electionId, 'sessions');
  return onSnapshot(sessionsRef, (snap) => {
    const sessions: Record<string, SessionRecord> = {};
    snap.forEach((d) => {
      const v = d.data();
      sessions[d.id] = {
        deviceId: d.id,
        env: v.env,
        phaseLog: (v.phaseLog ?? []) as PhaseLogEntry[],
        lastPhase: v.lastPhase,
        completed: v.completed === true,
        disconnectAt: v.disconnectAt ? toDate(v.disconnectAt) : null,
        updatedAt: toDate(v.updatedAt),
      };
    });
    callback(sessions);
  });
}

// ─── 管理者：再訪データ購読 ──────────────────
export function subscribeToDeviceVisits(
  electionId: string,
  callback: (visits: Record<string, DeviceVisitRecord>) => void
): Unsubscribe {
  const visitsRef = collection(db, 'elections', electionId, 'deviceVisits');
  return onSnapshot(visitsRef, (snap) => {
    const visits: Record<string, DeviceVisitRecord> = {};
    snap.forEach((d) => {
      const v = d.data();
      visits[d.id] = {
        deviceId: d.id,
        visitCount: v.visitCount ?? 1,
        visitTimestamps: ((v.visitTimestamps as Timestamp[]) ?? []).map((t) => toDate(t)),
        firstVisitAt: toDate(v.firstVisitAt),
        lastVisitAt: toDate(v.lastVisitAt),
      };
    });
    callback(visits);
  });
}

// ─── 管理者：投票リセット ────────────────────
// votes はルールで delete 禁止のため、Cloud Functions（admin SDK）経由で削除する。
// パスワードは Functions 側（process.env.ADMIN_PASSWORD）で再検証される。
export async function resetVotes(electionId: string, password: string): Promise<number> {
  const fn = httpsCallable<{ electionId: string; password: string }, { deleted: number }>(
    functions,
    'resetElectionVotes'
  );
  const res = await fn({ electionId, password });
  return res.data.deleted;
}

// ─── 管理者：初期データ投入（開発用） ────────
export async function seedElection(): Promise<void> {
  const electionData = {
    title: 'あなたの「あったらな〜」投票中！',
    description: '「こんなものGスクエアにあったらな〜」を募集中です',
    optionA: {
      id: 'A',
      title: 'ワイヤレス充電スポット',
      description: 'スマホを置くだけで充電できる<br>無線給電スポットを設置',
      icon: 'BatteryCharging',
      color: '#00C4EE',
      accentColor: '#006A8A',
      lightColor: '#B3EEFF',
    },
    optionB: {
      id: 'B',
      title: '電子レンジコーナー',
      description: '階下で買った冷凍食品をその場で温めて食べられる¥n電子レンジコーナーを設置',
      icon: 'Microwave',
      color: '#FF6B35',
      accentColor: '#B03A10',
      lightColor: '#FFD4C2',
    },
    active: true,
    createdAt: serverTimestamp(),
  };

  const electionRef = await addDoc(collection(db, 'elections'), electionData);

  await setDoc(doc(db, 'config', 'currentElection'), {
    electionId: electionRef.id,
  });

  console.log('Seeded election:', electionRef.id);
}

// ─── 管理者：既存選挙の色を新パレットに更新（開発用） ─
export async function updateElectionColors(): Promise<void> {
  const configRef = doc(db, 'config', 'currentElection');
  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) { console.error('No active election'); return; }
  const { electionId } = configSnap.data();

  await setDoc(doc(db, 'elections', electionId), {
    optionA: {
      id: 'A',
      title: 'ワイヤレス充電スポット',
      description: 'スマホを置くだけで充電できる無線給電スポットを設置！',
      icon: 'BatteryCharging',
      color: '#00C4EE',
      accentColor: '#006A8A',
      lightColor: '#B3EEFF',
    },
    optionB: {
      id: 'B',
      title: '電子レンジコーナー',
      description: '階下で買った冷凍食品をその場で温めて食べられる！',
      icon: 'Microwave',
      color: '#FF6B35',
      accentColor: '#B03A10',
      lightColor: '#FFD4C2',
    },
  }, { merge: true });

  console.log('Updated election colors for:', electionId);
}

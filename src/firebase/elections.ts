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
  getDocs,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './config';
import type { Election, VoteStats, ChoiceId, DemographicData, DeviceInfo } from '../types';

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

// ─── 投票状況をリアルタイムで監視 ───────────
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

// ─── 管理者：投票リセット ────────────────────
export async function resetVotes(electionId: string): Promise<void> {
  const votesRef = collection(db, 'elections', electionId, 'votes');
  const snap = await getDocs(votesRef);
  const promises = snap.docs.map((d) =>
    runTransaction(db, async (tx) => tx.delete(d.ref))
  );
  await Promise.all(promises);
}

// ─── 管理者：初期データ投入（開発用） ────────
export async function seedElection(): Promise<void> {
  const electionData = {
    title: 'Gスクエアに何を置く？',
    description: 'あなたの一票でGスクエアが変わる！欲しい設備に投票しよう。',
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

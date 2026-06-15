// =============================================
// Gスクエア投票アプリ Cloud Functions
// 票数集計をサーバー側で実行し、改ざん不可な集約カウンタを維持する。
// クライアントは votes 全件購読をやめ、このカウンタ1ドキュメントを購読する。
// =============================================

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

// 東京リージョン固定（レイテンシ・コスト）
const REGION = 'asia-northeast1';

const FIELD: Record<string, 'votesA' | 'votesB' | 'votesC'> = {
  A: 'votesA',
  B: 'votesB',
  C: 'votesC',
};

function counterRef(electionId: string) {
  return db.doc(`elections/${electionId}/stats/counter`);
}

// 票の重みを指定符号でカウンタに反映
async function applyVote(
  electionId: string,
  choice: string,
  voteWeight: number,
  sign: 1 | -1
): Promise<void> {
  const field = FIELD[choice];
  if (!field) return;
  await counterRef(electionId).set(
    {
      [field]: FieldValue.increment(sign * voteWeight),
      totalVoters: FieldValue.increment(sign),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// ─── 投票作成 → カウンタ加算 ──────────────────
export const onVoteCreated = onDocumentCreated(
  { document: 'elections/{eid}/votes/{vid}', region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const weight = typeof data.voteWeight === 'number' ? data.voteWeight : 1;
    await applyVote(event.params.eid, data.choice, weight, 1);
  }
);

// ─── 投票リセット（管理者専用・パスワード保護） ──
// votes はルールで delete 禁止のため、admin SDK 経由でのみ削除可能。
// 全票削除 + カウンタを0にリセットする（カウンタもこの関数が直接管理）。
export const resetElectionVotes = onCall({ region: REGION }, async (req) => {
  const electionId = req.data?.electionId as string | undefined;
  const password = req.data?.password as string | undefined;
  if (!electionId) {
    throw new HttpsError('invalid-argument', 'electionId is required');
  }
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    throw new HttpsError('permission-denied', 'invalid admin password');
  }

  // votes 全削除（バッチ・450件ごとにコミット）
  const snap = await db.collection(`elections/${electionId}/votes`).get();
  let batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++n % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();

  // カウンタを0リセット
  await counterRef(electionId).set(
    { votesA: 0, votesB: 0, votesC: 0, totalVoters: 0, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { deleted: snap.size };
});

// ─── カウンタ再計算（初期化・整合性回復用） ──
// デプロイ後に1回呼び出して既存の votes からカウンタを生成する。
export const recalcCounter = onCall({ region: REGION }, async (req) => {
  const electionId = req.data?.electionId as string | undefined;
  if (!electionId) {
    throw new HttpsError('invalid-argument', 'electionId is required');
  }

  const snap = await db.collection(`elections/${electionId}/votes`).get();
  let votesA = 0;
  let votesB = 0;
  let votesC = 0;
  let totalVoters = 0;

  snap.forEach((d) => {
    const v = d.data();
    const w = typeof v.voteWeight === 'number' ? v.voteWeight : 1;
    if (v.choice === 'A') votesA += w;
    else if (v.choice === 'B') votesB += w;
    else votesC += w;
    totalVoters += 1;
  });

  await counterRef(electionId).set(
    { votesA, votesB, votesC, totalVoters, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { votesA, votesB, votesC, totalVoters };
});

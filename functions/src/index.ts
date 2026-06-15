// =============================================
// Gスクエア投票アプリ Cloud Functions
// 票数集計をサーバー側で実行し、改ざん不可な集約カウンタを維持する。
// クライアントは votes 全件購読をやめ、このカウンタ1ドキュメントを購読する。
// =============================================

import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
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

// ─── 投票削除 → カウンタ減算（リセット対応） ──
export const onVoteDeleted = onDocumentDeleted(
  { document: 'elections/{eid}/votes/{vid}', region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const weight = typeof data.voteWeight === 'number' ? data.voteWeight : 1;
    await applyVote(event.params.eid, data.choice, weight, -1);
  }
);

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

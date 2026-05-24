# Gスクエア投票アプリ — Claude Code 引き継ぎドキュメント

## プロジェクト概要

函館市の公共施設「Gスクエア」における共創プロジェクト「みんなでつくるGスクエア」の投票アプリ。
管理者と利用者が一緒に施設をつくる活動の第一弾として、館内設備の投票を行う。

**第1回投票テーマ：ワイヤレス充電スポット vs 電子レンジ**

### 設計思想（重要）
「何もしてないけど都合いいものが降ってきた」感を避けるため、利用者が自ら考えて選ぶ体験を重視。
賛成理由を必ず書かせること、反対理由を書くと+1票になる仕掛けが、当事者意識とモラル形成につながる設計。

---

## 技術スタック

- **フロントエンド**: React 18 + Vite + TypeScript
- **スタイル**: Tailwind CSS 3 + Framer Motion（スプラトゥーンフェス風アニメーション）
- **バックエンド**: Firebase（Firestore + Anonymous Auth + Hosting）
- **フォント**: M PLUS Rounded 1c（Google Fonts）

---

## ディレクトリ構成

```
gsquare-vote/
├── src/
│   ├── types/index.ts          # 型定義（Election, Vote, VoteStats等）
│   ├── firebase/
│   │   ├── config.ts           # Firebase初期化（環境変数から）
│   │   └── elections.ts        # Firestore CRUD・リアルタイム購読
│   ├── contexts/
│   │   └── ElectionContext.tsx # 全体状態管理（フェーズ・投票データ）
│   ├── components/
│   │   ├── HeartToken.tsx      # ❤️ ハート型トークンSVG
│   │   ├── SpikyToken.tsx      # ✦ トゲトゲ→ハート変形トークンSVG
│   │   ├── VoteBar.tsx         # リアルタイム投票バー
│   │   └── BackgroundParticles.tsx  # 浮遊パーティクル背景
│   ├── pages/
│   │   ├── VotePage.tsx        # メイン投票画面（全フェーズ含む）
│   │   ├── SignagePage.tsx     # 縦型サイネージ専用（1m×0.6m）
│   │   └── AdminPage.tsx       # 管理者画面（PW保護・コメント閲覧・リセット）
│   ├── App.tsx                 # ルーティング（react-router-dom v6）
│   ├── main.tsx
│   └── index.css               # Tailwind + カスタムアニメーション
├── firestore.rules             # Firestoreセキュリティルール
├── firestore.indexes.json
├── firebase.json               # Firebase Hosting設定
├── tailwind.config.js
├── postcss.config.js
├── .env.example                # 環境変数テンプレート
└── SETUP.md                    # 詳細セットアップ手順

```

---

## 投票フェーズ（VotePhase型）

```
idle → confirming → submitting → animating → result
                                              ↑
already_voted ─────────────────────────────────
```

- `idle`: 2択カード表示
- `confirming`: 選択後、理由入力フォーム
- `submitting`: Firestore書き込み中
- `animating`: トークンアニメーション（ハート飛行・変形）
- `result`: 投票結果表示
- `already_voted`: localStorage検知で直接ここへ

---

## Firestoreデータモデル

```
/config/currentElection
  electionId: string   ← アクティブな選挙のID

/elections/{electionId}
  title, description, active, createdAt
  optionA: { id, title, description, icon, color, accentColor, lightColor }
  optionB: { id, title, description, icon, color, accentColor, lightColor }

/elections/{electionId}/votes/{voteId}   ← voteId == auth.uid（1デバイス1票保証）
  deviceId: string
  choice: "A" | "B"
  agreeReason: string        （必須・5文字以上）
  disagreeReason?: string    （任意・書くとvoteWeight=2）
  bonusVote: boolean
  voteWeight: 1 | 2
  createdAt: Timestamp
```

---

## 環境変数（.env.local に設定が必要）

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_ADMIN_PASSWORD   （管理者画面パスワード）
VITE_VOTE_URL         （サイネージのQR用URL）
```

---

## 現在の状況（引き継ぎ時点）

### 完了済み
- [x] 全ソースファイルの実装
- [x] Firebaseスキーマ・セキュリティルール設計
- [x] `npm install` 完了（325パッケージ）

### 次にやること

1. **Firebase プロジェクト作成** → `.env.local` に設定値を書く（SETUP.md参照）
2. **`npm audit fix`** で脆弱性を修正（`--force` 不要な範囲で）
3. **Firestore に初期データ投入** — Firebaseコンソールで手動 or `seedElection()` 関数（elections.tsの末尾）を開発者ツールから呼ぶ
4. **`npm run dev` でローカル動作確認**
5. **動作確認後のTODO**:
   - アニメーションの調整（特にトゲトゲ→ハート変形のタイミング）
   - サイネージ画面の実機確認（縦型1m×0.6m実寸）
   - 管理者パスワードを安全な値に変更
6. **`firebase deploy` で本番デプロイ**

---

## 主要な実装の決定事項（変更時は要注意）

- **重複投票防止**: Firestore側でvoteId=auth.uidのトランザクションで強制。localStorageはUXのクイック判定用
- **票数カウント**: votes subcollectionをonSnapshotで全件購読し、クライアント集計。Gスクエア規模（数百票）では十分
- **管理者認証**: クライアントサイドパスワード（VITE_ADMIN_PASSWORD）。Firestoreの書き込み権限はルールで別途保護
- **今後の選挙切り替え**: config/currentElectionのelectionIdを変えるだけで次の投票に切り替え可能。localStorageキーは`voted_{electionId}`なので自動リセット

---

## コマンド一覧

```bash
npm run dev      # 開発サーバー起動
npm run build    # ビルド
npm run preview  # ビルド確認

firebase deploy --only firestore   # ルール・インデックスのみデプロイ
firebase deploy --only hosting     # ホスティングのみデプロイ
firebase deploy                    # 全デプロイ
```

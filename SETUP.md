# Gスクエア投票アプリ セットアップ手順

## 必要なもの
- Node.js 18以上
- Firebase アカウント
- Firebase CLI (`npm install -g firebase-tools`)

---

## Step 1: Firebase プロジェクトを作成

1. https://console.firebase.google.com/ にアクセス
2. 「プロジェクトを追加」→ 名前を入力（例: gsquare-vote）
3. Googleアナリティクスは任意

### Firestore を有効化
- 左メニュー「Firestore Database」→「データベースを作成」
- ロケーション: `asia-northeast1`（東京）
- 本番モードで開始（ルールは後で設定）

### Authentication を有効化
- 左メニュー「Authentication」→「始める」
- 「匿名」を有効化

### Hosting を有効化
- 左メニュー「Hosting」→「始める」

---

## Step 2: ウェブアプリを登録

1. Firebaseコンソール → プロジェクト概要 → 「ウェブ」アイコンをクリック
2. アプリ名を入力（例: gsquare-vote-web）
3. 表示された設定値をコピー

---

## Step 3: 環境変数を設定

プロジェクトのルートで:

```bash
cp .env.example .env.local
```

`.env.local` を開き、Firebase の設定値を貼り付ける:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=gsquare-vote.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gsquare-vote
VITE_FIREBASE_STORAGE_BUCKET=gsquare-vote.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

VITE_ADMIN_PASSWORD=（スタッフで決めた安全なパスワード）
VITE_VOTE_URL=https://gsquare-vote.web.app
```

---

## Step 4: 依存パッケージをインストール

```bash
npm install
```

---

## Step 5: Firebase CLI にログイン・初期化

```bash
firebase login
firebase use --add   # プロジェクトを選択
```

---

## Step 6: Firestore ルールをデプロイ

```bash
firebase deploy --only firestore
```

---

## Step 7: 初期データを投入

ブラウザのコンソールから実行（開発用）:

```bash
npm run dev
```

開発サーバーが起動したらブラウザのコンソールで:
```javascript
// Viteの開発環境でのみ実行（本番前に必ず削除）
import { seedElection } from './src/firebase/elections';
seedElection();
```

または、Firebaseコンソール → Firestore → 手動でデータを作成:

```
コレクション: config
ドキュメントID: currentElection
フィールド: electionId (string) = "（elections コレクションのドキュメントID）"

コレクション: elections
（新規ドキュメントを作成 → IDをコピー → currentElectionに設定）
フィールド:
  title: "Gスクエアに何を置く？"
  description: "あなたの一票でGスクエアが変わる！欲しい設備に投票しよう。"
  active: true
  optionA: (map)
    id: "A"
    title: "ワイヤレス充電スポット"
    description: "スマホを置くだけで充電できる無線給電スポットを設置！"
    icon: "⚡"
    color: "#00C4EE"
    accentColor: "#006A8A"
    lightColor: "#B3EEFF"
  optionB: (map)
    id: "B"
    title: "電子レンジ"
    description: "階下で買った冷凍食品をその場で温めて食べられる！"
    icon: "🍱"
    color: "#FF6B35"
    accentColor: "#B03A10"
    lightColor: "#FFD4C2"
```

---

## Step 8: ローカルで動作確認

```bash
npm run dev
```

- 投票画面: http://localhost:5173/
- サイネージ: http://localhost:5173/signage
- 管理者: http://localhost:5173/admin

---

## Step 9: 本番デプロイ

```bash
npm run build
firebase deploy --only hosting
```

デプロイ完了後、表示されたURLをQRコードにしてサイネージに表示。

---

## URL 構成

| パス | 用途 |
|------|------|
| `/` | メイン投票画面（QRから飛ぶ先） |
| `/signage` | 縦型サイネージ専用表示 |
| `/admin` | 管理者画面（パスワード保護） |

---

## よくある問題

**「投票できない」**
→ Firestore ルールが正しく設定されているか確認。
→ Anonymous Auth が有効になっているか確認。

**「データが表示されない」**
→ `.env.local` の設定値が正しいか確認。
→ `config/currentElection` ドキュメントが存在するか確認。

**「サイネージのQRが表示されない」**
→ `VITE_VOTE_URL` が正しいURLを指しているか確認。
→ ネットワーク接続を確認（QRはapi.qrserver.comを使用）。

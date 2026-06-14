// =============================================
// Gスクエア投票アプリ 型定義
// =============================================

export type ChoiceId = 'A' | 'B' | 'C';

export interface ElectionOption {
  id: ChoiceId;
  title: string;
  description: string;
  icon: string;
  color: string;       // メインカラー (hex)
  accentColor: string; // アクセントカラー (hex)
  lightColor: string;  // 薄い色 (hex)
}

export interface Election {
  id: string;
  title: string;
  description: string;
  optionA: ElectionOption;
  optionB: ElectionOption;
  active: boolean;
  createdAt: Date;
  endAt?: Date;
}

export interface Vote {
  id?: string;
  electionId: string;
  deviceId: string;
  choice: ChoiceId;
  agreeReason: string;
  disagreeReason?: string;
  bonusVote: boolean;   // 反対理由を書いたかどうか
  voteWeight: 1 | 2;   // 1票 or 2票
  createdAt: Date;
}

export interface VoteStats {
  votesA: number;  // 重み付き合計
  votesB: number;  // 重み付き合計
  votesC: number;  // 重み付き合計（どちらもいらない）
  totalVoters: number; // 投票者数（人）
  comments: VoteComment[];
}

// 「どちらもいらない」固定オプション
export const OPTION_C: ElectionOption = {
  id: 'C',
  title: 'どちらもいらない',
  description: 'どっちも「う〜ん...」とピンとこない',
  icon: 'XCircle',
  color: '#6B7280',
  accentColor: '#374151',
  lightColor: '#E5E7EB',
};

export interface VoteComment {
  id: string;
  choice: ChoiceId;
  agreeReason: string;
  disagreeReason?: string;
  createdAt: Date;
  hidden?: boolean;
}

export interface DeviceVisitRecord {
  deviceId: string;
  visitCount: number;
  visitTimestamps: Date[];
  firstVisitAt: Date;
  lastVisitAt: Date;
}

export interface AdminVoteRecord {
  id: string;
  deviceId: string;
  choice: ChoiceId;
  agreeReason: string;
  disagreeReason?: string | null;
  bonusVote: boolean;
  voteWeight: 1 | 2;
  createdAt: Date;
  hidden: boolean;
  demographic?: DemographicData | null;
  deviceInfo?: DeviceInfo | null;
}

export interface DemographicData {
  age: string;
  gender: string;
  usageFrequency: string;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  language: string;
  ipAddress?: string;
}

// ─── セッション行動ログ（環境・滞在時間・離脱画面） ──
export interface SessionEnv {
  userAgent: string;
  platform: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  timezone: string;
  // Chromium系のみ取得可。OS/ブラウザの正確な種別
  uaData?: {
    platform?: string;
    mobile?: boolean;
    brands?: { brand: string; version: string }[];
  } | null;
}

export interface PhaseLogEntry {
  phase: VotePhase;
  enteredAt: number;   // epoch ms
  durationMs: number;  // この画面の滞在時間
}

export interface SessionRecord {
  deviceId: string;
  env: SessionEnv;
  phaseLog: PhaseLogEntry[];
  lastPhase: VotePhase;   // 最後にいた画面（= 離脱画面）
  completed: boolean;     // 投票完遂したか
  disconnectAt: Date | null; // 離脱（タブ非表示）を検知した時刻
  updatedAt: Date;
}

// 投票後のアニメーション状態
export type VotePhase =
  | 'idle'        // 未投票
  | 'selecting'   // 選択中
  | 'confirming'  // 理由入力中
  | 'submitting'  // 送信中
  | 'animating'   // アニメーション
  | 'result'      // 結果表示
  | 'already_voted'; // 投票済み

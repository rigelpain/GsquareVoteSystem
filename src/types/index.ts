// =============================================
// Gスクエア投票アプリ 型定義
// =============================================

export type ChoiceId = 'A' | 'B';

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
  totalVoters: number; // 投票者数（人）
  comments: VoteComment[];
}

export interface VoteComment {
  id: string;
  choice: ChoiceId;
  agreeReason: string;
  disagreeReason?: string;
  createdAt: Date;
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

// 投票後のアニメーション状態
export type VotePhase =
  | 'idle'        // 未投票
  | 'selecting'   // 選択中
  | 'confirming'  // 理由入力中
  | 'submitting'  // 送信中
  | 'animating'   // アニメーション
  | 'result'      // 結果表示
  | 'already_voted'; // 投票済み

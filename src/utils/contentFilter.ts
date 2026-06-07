// ─── コンテンツフィルター ─────────────────────────────
// 辞書・正規表現で個人情報・不適切語句を検知し hidden=true にする
// 人名は正規表現での特定不可のため、自己紹介パターンのみ検知

import ngWordsData from './ngWords.json';

const NG_WORDS: string[] = ngWordsData.ngWords;
const SCHOOL_NAMES: string[] = ngWordsData.schoolNames;

// ── 個人情報検出パターン ──────────────────────────
const PII_PATTERNS: { pattern: RegExp; label: string }[] = [
  // 携帯電話
  { pattern: /0[789]0[-\s・－]?\d{4}[-\s・－]?\d{4}/, label: '携帯電話番号' },
  // 固定電話（市外局番あり）
  { pattern: /0\d{1,4}[-\s・－]\d{2,4}[-\s・－]\d{4}/, label: '固定電話番号' },
  // フリーダイヤル
  { pattern: /0120[-\s・－]?\d{3}[-\s・－]?\d{3}/, label: 'フリーダイヤル' },
  // メールアドレス
  { pattern: /[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/, label: 'メールアドレス' },
  // 郵便番号
  { pattern: /〒\s?\d{3}[-－]\d{4}/, label: '郵便番号' },
  // 丁目・番地・号
  { pattern: /\d+丁目\d+番(地)?\d*号?/, label: '番地' },
  // 号室
  { pattern: /\d+号室/, label: '号室' },
  // URL
  { pattern: /https?:\/\/\S+/, label: 'URL' },
  { pattern: /www\.\S+\.[a-zA-Z]{2,}/, label: 'URL' },
];

// ── 自己紹介パターン（人名の直接検知の代替） ──────────
// 「私は〇〇です」「〇〇と申します」等のパターンを検知
const SELF_INTRO_PATTERNS: RegExp[] = [
  /私[はわ].{1,10}(です|だ|と申|といい)/,
  /[ぼ僕]は.{1,10}(です|だ|と申|といい)/,
  /自分[はわ].{1,10}(です|だ|と申|といい)/,
  /名前[はわ].{1,10}(です|だ)/,
  /氏名.{0,5}[：:].{1,20}/,
];

export interface ContentCheckResult {
  shouldHide: boolean;
  reasons: string[];
}

export function checkContent(texts: string[]): ContentCheckResult {
  const combined = texts.join(' ');
  const reasons: string[] = [];

  for (const word of NG_WORDS) {
    if (combined.includes(word)) {
      reasons.push(`不適切語句`);
      break;
    }
  }

  for (const school of SCHOOL_NAMES) {
    if (combined.includes(school)) {
      reasons.push(`学校名`);
      break;
    }
  }

  for (const { pattern, label } of PII_PATTERNS) {
    if (pattern.test(combined)) {
      reasons.push(label);
      break;
    }
  }

  for (const pattern of SELF_INTRO_PATTERNS) {
    if (pattern.test(combined)) {
      reasons.push('自己紹介パターン');
      break;
    }
  }

  return { shouldHide: reasons.length > 0, reasons };
}

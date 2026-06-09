import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lock, Smartphone, MessageCircle, Star, BarChart3,
  PartyPopper, Lightbulb, CheckCircle2, Loader2,
  BatteryCharging, Microwave, AlertCircle, ChevronRight, Heart, XCircle,
} from 'lucide-react';
import { useElection } from '../contexts/ElectionContext';
import VoteBar from '../components/VoteBar';
import BackgroundParticles from '../components/BackgroundParticles';
import HeartToken from '../components/HeartToken';
import { MorphingToken } from '../components/SpikyToken';
import { OptionIcon } from '../components/OptionIcon';
import { sanitizeText } from '../utils/sanitize';
import { collectDeviceInfo } from '../utils/deviceInfo';
import { submitSuggestion, addSympathy } from '../firebase/elections';
import { OPTION_C } from '../types';
import type { ChoiceId, ElectionOption } from '../types';

// ─── イントロ画面 ────────────────────────────────────
function IntroScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="min-h-screen ink-bg flex flex-col items-center justify-center px-6 py-10">
      <BackgroundParticles colorA="#00C4EE" colorB="#FF6B35" count={8} />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm text-center"
      >
        <div>
          <p className="text-white/60 text-sm font-bold tracking-widest mb-1">10周年に向けた大アップデートプロジェクト！</p>
          <h1 className="text-4xl font-black text-white leading-tight">
            みんなでつくる<br />Gスクエア
          </h1>
          <div className="mt-3 w-12 h-1 bg-[#00C4EE] mx-auto rounded-full" />
        </div>

        <p className="text-white/60 text-sm leading-relaxed">
          函館市の公共施設「Gスクエア」を<br />
          より良くつくり続けるために<br />
          あなたの気持ちを聞かせてください！
        </p>

        <div className="glass-panel w-full p-5">
          <p className="text-white font-black text-lg leading-snug mb-4">
            Gスクエアに<br />
            <span style={{ color: '#49deffff' }}>新しく置かれるなら</span><br />
            どっち！？
          </p>
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <BatteryCharging size={40} className="text-[#00C4EE]" />
              <span className="text-sm font-black text-white/80">ワイヤレス<br />充電スポット</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-black text-white/40">VS</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Microwave size={40} className="text-[#FF6B35]" />
              <span className="text-sm font-black text-white/80">電子レンジコーナー</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs font-bold">または</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="flex flex-col items-center gap-1 mt-3">
            <XCircle size={28} className="text-white/40" />
            <span className="text-xs font-black text-white/40">どちらもいらない</span>
          </div>
          <p className="text-white/40 text-xs mt-4 text-center tracking-wide">今回のテーマ ： あったらいいな</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          className="w-full splat-btn"
          style={{ background: '#00C4EE', borderBottomColor: '#006A8A' }}
        >
          投票に参加する →
        </motion.button>

        <p className="text-white/20 text-xs">※ 1端末1票・投票取り消し不可</p>
      </motion.div>
    </div>
  );
}

// ─── スライドトグル ───────────────────────────────────
function SegmentedToggle({ id, label, options, value, onChange, required }: {
  id: string; label: string;
  options: string[]; value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-white/50 text-xs font-bold tracking-wide">{label}</p>
        {required && !value && (
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(255,90,90,0.18)', color: '#ff9090', border: '1px solid rgba(255,90,90,0.35)' }}
          >必須</span>
        )}
        {required && value && (
          <span className="text-[#00C4EE] text-xs font-bold">✓</span>
        )}
      </div>
      <div
        className="grid rounded-xl p-1 relative transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.06)',
          gridTemplateColumns: `repeat(${options.length}, 1fr)`,
          border: required && !value ? '1px solid rgba(255,90,90,0.35)' : '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="relative py-2 text-xs font-bold z-10 rounded-lg transition-colors duration-150"
            style={{ color: value === opt ? 'white' : 'rgba(255,255,255,0.35)' }}
          >
            {value === opt && (
              <motion.div
                layoutId={`pill-${id}`}
                className="absolute inset-0 rounded-lg"
                style={{ background: '#00C4EE' }}
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 同意モーダル ─────────────────────────────────────
function ConsentModal({ onConsent, onBack }: { onConsent: () => void; onBack: () => void }) {
  const { setDemographicAndDevice } = useElection();
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [usageFrequency, setUsageFrequency] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const deviceInfoRef = useRef<Awaited<ReturnType<typeof collectDeviceInfo>> | null>(null);

  useEffect(() => {
    collectDeviceInfo().then(info => { deviceInfoRef.current = info; });
  }, []);

  const rules = [
    { icon: <Smartphone size={18} className="text-white/60 flex-shrink-0 mt-0.5" />, text: '1端末につき1票のみ投票できます' },
    { icon: <Lock size={18} className="text-white/60 flex-shrink-0 mt-0.5" />, text: '投票は取り消しできません' },
  ];

  const canSubmit = age && gender && usageFrequency && consentChecked && !loading;

  const handleConsent = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const dev = deviceInfoRef.current ?? await collectDeviceInfo();
    setDemographicAndDevice({ age: `${age}歳`, gender, usageFrequency }, dev);
    onConsent();
  };

  return (
    <div className="min-h-screen ink-bg flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
      <BackgroundParticles colorA="#00C4EE" colorB="#FF6B35" count={6} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm rounded-3xl p-6 border border-white/25 backdrop-blur-xl my-6"
        style={{ background: 'rgba(255,255,255,0.10)', boxShadow: '0 16px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)' }}
      >
        <h2 className="text-xl font-black text-white mb-1">参加のルール</h2>
        <p className="text-white/40 text-xs mb-4">投票前にご確認ください</p>

        <div className="flex flex-col gap-3 mb-5">
          {rules.map(({ text }, i) => (
            <div key={i} className="flex items-start gap-3">
              {rules[i].icon}
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-5 mb-5 p-4 rounded-2xl border border-white/15"
             style={{ background: 'rgba(255,255,255,0.06)' }}>
          <p className="text-white/60 text-xs font-bold tracking-wide -mb-2">
            年齢・性別・利用頻度を教えてください
          </p>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <p className="text-white/50 text-xs font-bold tracking-wide">年齢</p>
              {!age && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,90,90,0.18)', color: '#ff9090', border: '1px solid rgba(255,90,90,0.35)' }}
                >必須</span>
              )}
              {age && <span className="text-[#00C4EE] text-xs font-bold">✓</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                placeholder="25"
                value={age}
                onChange={e => setAge(e.target.value.replace(/[^0-9]/g, ''))}
                className="splat-textarea w-24 text-center text-xl font-black py-2 px-3"
                style={{
                  borderColor: !age ? 'rgba(255,90,90,0.35)' : undefined,
                  transition: 'border-color 0.2s',
                }}
              />
              <span className="text-white/60 text-sm font-bold">歳</span>
            </div>
          </div>

          <SegmentedToggle
            id="gender" label="性別"
            options={['男性', '女性', 'その他', '無回答']}
            value={gender} onChange={setGender}
            required
          />

          <SegmentedToggle
            id="freq" label="Gスクエアの利用頻度"
            options={['はじめて', 'ほぼ毎日', '週1以上', '月数回', '月1以下']}
            value={usageFrequency} onChange={setUsageFrequency}
            required
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={e => setConsentChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#00C4EE]"
          />
          <span className="text-white/55 text-xs leading-relaxed">
            収集した情報（年齢・性別・利用頻度・端末情報）は、Gスクエアの施設運営改善の目的にのみ使用し、それ以外での使用・第三者提供は行いません。
          </span>
        </label>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleConsent}
          disabled={!canSubmit}
          className="w-full splat-btn mb-3"
          style={{
            background: canSubmit ? '#00C4EE' : '#2a3a45',
            borderBottomColor: canSubmit ? '#006A8A' : '#1a2a30',
          }}
        >
          {loading ? '準備中...' : '同意して投票する'}
        </motion.button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-white/40 text-sm underline underline-offset-2 hover:text-white/70 transition-colors"
        >
          ← 戻る
        </button>
      </motion.div>
    </div>
  );
}

// ─── 選択画面 ─────────────────────────────────────────
function SelectionScreen() {
  const { election, selectChoice, stats } = useElection();
  if (!election) return null;

  const abOptions = [election.optionA, election.optionB];

  return (
    <motion.div
      key="selection"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto px-4"
    >
      <div className="text-center">
        <p className="text-white/60 text-sm font-bold tracking-widest mb-1">
          みんなでつくるGスクエア
        </p>
        <h1 className="text-2xl font-black text-white leading-tight">
          {election.title}
        </h1>
        <p className="text-white/70 text-sm mt-1">{election.description}</p>
      </div>

      <div className="w-full flex flex-col gap-3">
        {/* A・B の2択（VSバッジ付き） */}
        <div className="relative flex flex-col gap-3">
          {abOptions.map((opt, i) => (
            <motion.button
              key={opt.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => selectChoice(opt.id as ChoiceId)}
              className="splat-card w-full text-left p-5 cursor-pointer transition-all duration-200 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${opt.color}18, rgba(255,255,255,0.06))`,
                borderColor: `rgba(255,255,255,0.22)`,
              }}
            >
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at ${i === 0 ? '80%' : '20%'} 50%, ${opt.color}, transparent 70%)`,
                }}
              />
              <div className="relative flex items-center gap-4">
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: `${opt.color}33`, border: `2px solid ${opt.color}66`, color: opt.lightColor }}
                >
                  <OptionIcon name={opt.icon} size={36} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    className="text-xl font-black leading-tight"
                    style={{ color: opt.lightColor }}
                  >
                    {opt.title}
                  </h2>
                  <p className="text-white/70 text-sm mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
                <ChevronRight size={22} className="flex-shrink-0 text-white/40" />
              </div>
            </motion.button>
          ))}

          {/* VS バッジ */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="rounded-full w-10 h-10 flex items-center justify-center border border-white/30 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.12)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              <span className="text-white/70 font-black text-xs">VS</span>
            </div>
          </div>
        </div>

        {/* または仕切り */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/35 text-xs font-bold tracking-widest">または</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* C: どちらもいらない */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => selectChoice('C')}
          className="w-full text-left p-4 cursor-pointer transition-all duration-200 relative overflow-hidden rounded-2xl border"
          style={{
            background: 'rgba(107,114,128,0.10)',
            borderColor: 'rgba(107,114,128,0.35)',
            borderStyle: 'dashed',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(107,114,128,0.20)', border: '1px solid rgba(107,114,128,0.40)' }}
            >
              <XCircle size={28} className="text-white/50" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black text-white/60 leading-tight">
                {OPTION_C.title}
              </h2>
              <p className="text-white/35 text-xs mt-0.5 leading-relaxed">
                {OPTION_C.description}
              </p>
            </div>
            <ChevronRight size={18} className="flex-shrink-0 text-white/25" />
          </div>
        </motion.button>
      </div>

      {stats.totalVoters > 0 && (
        <div className="w-full opacity-70">
          <VoteBar election={election} stats={stats} showCounts optionC={OPTION_C} />
        </div>
      )}

      <p className="text-white/30 text-xs text-center">
        ※ 1端末1票です。投票は取り消せません。
      </p>
    </motion.div>
  );
}

// ─── 理由入力画面 ──────────────────────────────────────
function ConfirmScreen() {
  const { election, selectedChoice, submitVote, setPhase, phase } = useElection();
  const [agreeReason, setAgreeReason] = useState('');
  const [disagreeReason, setDisagreeReason] = useState('');
  const [showDisagree, setShowDisagree] = useState(false);
  const [wantReason, setWantReason] = useState('');
  const [errors, setErrors] = useState<{ agree?: string }>({});

  if (!election || !selectedChoice) return null;

  const isC = selectedChoice === 'C';
  const chosen = selectedChoice === 'A' ? election.optionA
    : selectedChoice === 'B' ? election.optionB
    : OPTION_C;
  const other = selectedChoice === 'A' ? election.optionB
    : selectedChoice === 'B' ? election.optionA
    : null;
  const isSubmitting = phase === 'submitting';

  const handleSubmit = async () => {
    if (isC) {
      const cleanWant = wantReason ? sanitizeText(wantReason) : undefined;
      await submitVote('どちらもいらない', cleanWant || undefined);
      return;
    }
    const cleanAgree = sanitizeText(agreeReason);
    if (!cleanAgree) {
      setErrors({ agree: '賛成する理由を入力してください' });
      return;
    }
    if (cleanAgree.length < 10) {
      setErrors({ agree: 'もう少し詳しく教えてください😣（10文字以上）' });
      return;
    }
    setErrors({});
    const cleanDisagree = disagreeReason ? sanitizeText(disagreeReason) : undefined;
    await submitVote(cleanAgree, cleanDisagree);
  };

  const bonusActive = isC
    ? wantReason.trim().length >= 3
    : showDisagree && disagreeReason.trim().length >= 3;

  return (
    <motion.div
      key="confirm"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex flex-col gap-5 w-full max-w-sm mx-auto px-4"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="inline-block"
        >
          <div
            className="rounded-2xl px-5 py-3 inline-flex items-center gap-3 mb-3 backdrop-blur-md"
            style={{ background: `${chosen.color}20`, border: `1px solid ${chosen.color}88`, boxShadow: `0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)` }}
          >
            <OptionIcon name={chosen.icon} size={32} color={chosen.lightColor} />
            <div className="text-left">
              <p className="text-xs font-bold text-white/60">あなたの選択</p>
              <p className="text-lg font-black" style={{ color: chosen.lightColor }}>
                {chosen.title}
              </p>
            </div>
          </div>
        </motion.div>
        <p className="text-white/60 text-sm">
          {isC ? '欲しいものがあれば教えてください！' : '理由を教えてください！'}
        </p>
      </div>

      {isC ? (
        /* ── C専用：欲しいもの入力（任意）──────── */
        <div>
          <label className="block text-white font-bold text-sm mb-2 flex items-center gap-2">
            <Lightbulb size={18} className="text-yellow-400" />
            <span>欲しいものがあれば教えてください</span>
            <span className="text-xs bg-yellow-400/20 px-2 py-0.5 rounded-full text-yellow-400">+1票 任意</span>
          </label>
          <textarea
            className="splat-textarea"
            rows={3}
            placeholder="例：コインロッカー、観光案内パンフレット、コンビニATM..."
            value={wantReason}
            onChange={(e) => setWantReason(e.target.value)}
            disabled={isSubmitting}
            maxLength={200}
          />
          <AnimatePresence>
            {bonusActive && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="mt-2 flex items-center gap-2 text-yellow-400"
              >
                <span className="text-lg">⭐</span>
                <span className="text-sm font-black">+1票ボーナス獲得！</span>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-white/30 text-xs mt-1 text-right">{wantReason.length}/200</p>
          <p className="text-white/30 text-xs mt-1">
            ※ 書かなくても1票として投票できます
          </p>
        </div>
      ) : (
        /* ── A/B：賛成理由（必須）+ 反対理由（任意）── */
        <>
          <div>
            <label className="block text-white font-bold text-sm mb-2 flex items-center gap-2">
              <HeartToken color={chosen.color} size={18} />
              <span>{chosen.title}に賛成する理由</span>
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/70">必須</span>
            </label>
            <textarea
              className="splat-textarea"
              rows={3}
              placeholder={`例：${chosen.id === 'A'
                ? 'スマホが切れそうなとき困るので、気軽に充電できると助かります'
                : 'お昼ごはんを持参しているのであたためられると嬉しいです'
              }`}
              value={agreeReason}
              onChange={(e) => {
                setAgreeReason(e.target.value);
                if (errors.agree) setErrors({});
              }}
              disabled={isSubmitting}
              maxLength={200}
            />
            {errors.agree && (
              <p className="text-red-400 text-xs mt-1">{errors.agree}</p>
            )}
            <p className="text-white/30 text-xs mt-1 text-right">{agreeReason.length}/200</p>
          </div>

          {other && (
            <div>
              <button
                type="button"
                onClick={() => setShowDisagree(!showDisagree)}
                disabled={isSubmitting}
                className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-200"
                style={{
                  background: showDisagree ? `${other.color}22` : 'rgba(255,255,255,0.05)',
                  border: `2px dashed ${showDisagree ? other.color + '88' : 'rgba(255,255,255,0.15)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle size={16} className="text-white/60" />
                  <div className="text-left">
                    <p className="text-white font-bold text-sm flex items-center gap-1">
                      <OptionIcon name={other.icon} size={16} color={other.lightColor} /> {other.title}への意見を書く
                    </p>
                    <p className="text-white/50 text-xs">
                      書くと <span className="text-yellow-400 font-black">+1票</span> ボーナス！（任意）
                    </p>
                  </div>
                </div>
                <motion.span
                  animate={{ rotate: showDisagree ? 90 : 0 }}
                  className="text-white/40 text-xl"
                >
                  ›
                </motion.span>
              </button>

              <AnimatePresence>
                {showDisagree && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3">
                      <textarea
                        className="splat-textarea"
                        rows={2}
                        placeholder={`例：${other.id === 'A'
                          ? '使い方のルール設定が難しそうで心配です'
                          : '衛生面や匂いの問題が出そうです'
                        }`}
                        value={disagreeReason}
                        onChange={(e) => setDisagreeReason(e.target.value)}
                        disabled={isSubmitting}
                        maxLength={200}
                      />
                      <AnimatePresence>
                        {bonusActive && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="mt-2 flex items-center gap-2 text-yellow-400"
                          >
                            <span className="text-lg">⭐</span>
                            <span className="text-sm font-black">+1票ボーナス獲得！</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={isSubmitting || (!isC && !agreeReason.trim())}
          className="splat-btn w-full"
          style={{
            background: chosen.color,
            borderBottomColor: chosen.accentColor,
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block"
              >
                ⟳
              </motion.span>
              送信中...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>投票する！</span>
              <span>{bonusActive ? '2票' : '1票'}</span>
              <HeartToken color="white" size={20} />
            </span>
          )}
        </motion.button>

        <button
          type="button"
          onClick={() => setPhase('idle')}
          disabled={isSubmitting}
          className="text-white/40 text-sm underline underline-offset-2 hover:text-white/70 transition-colors"
        >
          ← 選び直す
        </button>
      </div>
    </motion.div>
  );
}

// ─── 投票後アニメーション ──────────────────────────────
function AnimationScreen() {
  const { election, lastVote, stats, setPhase } = useElection();
  const [step, setStep] = useState<'token' | 'morph' | 'bar' | 'done'>('token');

  useEffect(() => {
    const t1 = setTimeout(() => setStep('morph'), 1200);
    const t2 = setTimeout(() => setStep('bar'), 2800);
    const t3 = setTimeout(() => setStep('done'), 4000);
    const t4 = setTimeout(() => setPhase('result'), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [setPhase]);

  if (!election || !lastVote) return null;
  const chosen = lastVote.choice === 'A' ? election.optionA
    : lastVote.choice === 'B' ? election.optionB
    : OPTION_C;

  return (
    <motion.div
      key="animation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen gap-8 px-4"
      style={{
        background: `radial-gradient(ellipse at center, ${chosen.color}33 0%, transparent 70%)`,
      }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        className="text-center"
      >
        <div className="mb-3" style={{ color: chosen.lightColor }}>
          <OptionIcon name={chosen.icon} size={56} />
        </div>
        <h2 className="text-2xl font-black text-white">投票ありがとう！</h2>
        {lastVote.bonusVote && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-2 inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/50 rounded-full px-4 py-1"
          >
            <Star size={14} className="text-yellow-400" />
            <span className="text-yellow-400 font-black text-sm">+1票ボーナス付き！ 計2票</span>
          </motion.div>
        )}
      </motion.div>

      <div className="relative flex items-center justify-center gap-8 h-24">
        <AnimatePresence>
          {(step === 'token' || step === 'morph' || step === 'bar') && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{
                scale: [0, 1.3, 1],
                x: step === 'bar' ? (lastVote.choice === 'A' ? -100 : lastVote.choice === 'B' ? 100 : 0) : 0,
                opacity: 1,
              }}
              transition={{
                scale: { duration: 0.5 },
                x: { duration: 0.6 },
              }}
            >
              <HeartToken color={chosen.color} size={56} />
            </motion.div>
          )}
        </AnimatePresence>

        {lastVote.bonusVote && (step === 'morph' || step === 'bar') && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{
              scale: 1,
              x: step === 'bar' ? (lastVote.choice === 'A' ? -60 : lastVote.choice === 'B' ? 60 : 0) : 0,
            }}
            transition={{ x: { duration: 0.6 } }}
          >
            <MorphingToken color="#ff4444" targetColor={chosen.color} size={48} />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {(step === 'bar' || step === 'done') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <VoteBar election={election} stats={stats} showCounts optionC={OPTION_C} />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setPhase('result')}
        className="text-white/30 text-xs underline"
      >
        スキップ →
      </button>
    </motion.div>
  );
}

// ─── 結果画面 ──────────────────────────────────────────
function ResultScreen() {
  const { election, stats, lastVote, deviceId } = useElection();
  const [suggestion, setSuggestion] = useState('');
  const [suggestionSubmitted, setSuggestionSubmitted] = useState(false);
  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [sympathized, setSympathized] = useState<Set<string>>(() => {
    if (!election) return new Set();
    const key = `sympathized_${election?.id}`;
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
  });

  if (!election) return null;

  const handleSympathy = async (voteId: string) => {
    if (!deviceId || sympathized.has(voteId)) return;
    const next = new Set(sympathized).add(voteId);
    setSympathized(next);
    localStorage.setItem(`sympathized_${election.id}`, JSON.stringify([...next]));
    try {
      await addSympathy({ electionId: election.id, deviceId, voteId });
    } catch {
      // Firestore create失敗（重複等）はUI状態はそのまま維持
    }
  };

  const handleSuggestion = async () => {
    const clean = sanitizeText(suggestion);
    if (!clean || !deviceId) return;
    setSuggestionSubmitting(true);
    setSuggestionError(false);
    try {
      await submitSuggestion({ electionId: election.id, deviceId, text: clean });
      setSuggestionSubmitted(true);
    } catch {
      setSuggestionError(true);
    }
    setSuggestionSubmitting(false);
  };

  const isAlreadyVoted = !lastVote;
  const total = stats.votesA + stats.votesB + stats.votesC;
  const maxVotes = Math.max(stats.votesA, stats.votesB, stats.votesC);
  const leaders: ElectionOption[] = total === 0 ? [] : [
    ...(stats.votesA === maxVotes ? [election.optionA] : []),
    ...(stats.votesB === maxVotes ? [election.optionB] : []),
    ...(stats.votesC === maxVotes ? [OPTION_C] : []),
  ];

  const commentsA = stats.comments.filter(c => c.choice === 'A');
  const commentsB = stats.comments.filter(c => c.choice === 'B');
  const commentsC = stats.comments.filter(c => c.choice === 'C');

  const renderABColumn = (comments: typeof stats.comments, opt: typeof election.optionA) => (
    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <OptionIcon name={opt.icon} size={13} color={opt.lightColor} />
        <span className="text-xs font-black truncate" style={{ color: opt.lightColor }}>
          {opt.title}
        </span>
        <span className="text-white/30 text-xs ml-auto flex-shrink-0">{comments.length}件</span>
      </div>
      <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
        {comments.length === 0 ? (
          <p className="text-white/20 text-xs text-center py-4">まだ意見なし</p>
        ) : comments.map((c) => {
          const done = sympathized.has(c.id);
          return (
            <div
              key={c.id}
              className="rounded-lg p-2 backdrop-blur-sm"
              style={{
                background: `${opt.color}0d`,
                border: `1px solid ${opt.color}30`,
              }}
            >
              <p className="text-white/80 text-xs leading-relaxed">{c.agreeReason}</p>
              {c.disagreeReason && (
                <p className="text-white/35 text-xs mt-1 italic leading-tight">↔ {c.disagreeReason}</p>
              )}
              <button
                onClick={() => handleSympathy(c.id)}
                disabled={done}
                className="mt-1.5 flex items-center gap-1 transition-opacity"
                style={{ opacity: done ? 1 : 0.45 }}
              >
                <Heart
                  size={12}
                  fill={done ? opt.color : 'none'}
                  color={done ? opt.color : 'rgba(255,255,255,0.5)'}
                />
                <span className="text-xs" style={{ color: done ? opt.lightColor : 'rgba(255,255,255,0.4)' }}>
                  {done ? 'ありがとう' : 'いいね'}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto px-4"
    >
      <div className="text-center">
        {isAlreadyVoted ? (
          <>
            <BarChart3 size={36} className="text-white/60 mb-2 mx-auto" />
            <h2 className="text-xl font-black text-white">現在の投票状況</h2>
            <p className="text-white/50 text-sm mt-1">すでに投票済みです</p>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="mb-2 flex justify-center"
            >
              <PartyPopper size={40} className="text-[#00C4EE]" />
            </motion.div>
            <h2 className="text-xl font-black text-white">投票完了</h2>
            <p className="text-white/60 text-sm mt-1">ありがとう！</p>
          </>
        )}
      </div>

      {leaders.length > 0 && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full rounded-2xl p-4 text-center"
          style={{
            background: leaders.length > 1
              ? 'rgba(255,255,255,0.06)'
              : `${leaders[0].color}15`,
            border: leaders.length > 1
              ? '1px solid rgba(255,255,255,0.25)'
              : `1px solid ${leaders[0].color}88`,
            backdropFilter: 'blur(12px)',
            boxShadow: `0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)`,
          }}
        >
          <p className="text-white/60 text-xs mb-2">
            {leaders.length > 1 ? '⚖️ 同票リード中' : '現在リード中'}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {leaders.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2">
                {i > 0 && <span className="text-white/30 text-sm">=</span>}
                <OptionIcon name={opt.icon} size={28} color={opt.lightColor} />
                <span className="text-lg font-black" style={{ color: opt.lightColor }}>
                  {opt.title}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="w-full">
        <VoteBar election={election} stats={stats} showCounts optionC={OPTION_C} />
      </div>

      {/* A / B コメント */}
      {(commentsA.length > 0 || commentsB.length > 0) && (
        <div className="w-full">
          <h3 className="text-white/60 text-sm font-bold mb-3 flex items-center gap-2">
            <MessageCircle size={14} /> みんなの声
          </h3>
          <div className="flex gap-3">
            {renderABColumn(commentsA, election.optionA)}
            <div className="w-px bg-white/10 self-stretch" />
            {renderABColumn(commentsB, election.optionB)}
          </div>
        </div>
      )}

      {/* C コメント（欲しいもの一覧） */}
      {commentsC.length > 0 && (
        <div className="w-full">
          <h3 className="text-white/60 text-sm font-bold mb-3 flex items-center gap-2">
            <Lightbulb size={14} className="text-yellow-400" />
            <span>「欲しいもの」の声 ({commentsC.length}件)</span>
          </h3>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {commentsC.map((c) => {
              const done = sympathized.has(c.id);
              const displayText = c.disagreeReason || c.agreeReason;
              if (!c.disagreeReason) return null;
              return (
                <div
                  key={c.id}
                  className="rounded-lg p-2.5 backdrop-blur-sm"
                  style={{
                    background: 'rgba(107,114,128,0.10)',
                    border: '1px solid rgba(107,114,128,0.25)',
                  }}
                >
                  <p className="text-white/75 text-xs leading-relaxed">{displayText}</p>
                  <button
                    onClick={() => handleSympathy(c.id)}
                    disabled={done}
                    className="mt-1.5 flex items-center gap-1 transition-opacity"
                    style={{ opacity: done ? 1 : 0.45 }}
                  >
                    <Heart
                      size={12}
                      fill={done ? '#6B7280' : 'none'}
                      color={done ? '#E5E7EB' : 'rgba(255,255,255,0.5)'}
                    />
                    <span className="text-xs" style={{ color: done ? '#E5E7EB' : 'rgba(255,255,255,0.4)' }}>
                      {done ? 'ありがとう' : 'いいね'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 自由記述：他に欲しいもの */}
      <div
        className="w-full rounded-2xl p-4 border border-white/10"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <h3 className="text-white/70 text-sm font-bold mb-0.5 flex items-center gap-2">
          <Lightbulb size={14} /> Gスクエアに「あったらいいな〜」なモノ・コトはありますか？
        </h3>
        <p className="text-white/35 text-xs mb-3">自由にご記入ください</p>

        {!suggestionSubmitted ? (
          <>
            <textarea
              className="splat-textarea"
              rows={2}
              placeholder="例：キッズスペース、テーブル拭き、他の階の情報..."
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
              disabled={suggestionSubmitting}
              maxLength={150}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-white/25 text-xs">{suggestion.length}/150</span>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSuggestion}
                disabled={!suggestion.trim() || suggestionSubmitting}
                className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: suggestion.trim() ? '#00C4EE' : 'rgba(255,255,255,0.08)',
                  color: suggestion.trim() ? 'white' : 'rgba(255,255,255,0.3)',
                }}
              >
                {suggestionSubmitting ? '送信中...' : '送る'}
              </motion.button>
            </div>
            {suggestionError && (
              <p className="text-red-400 text-xs text-center mt-1">送信に失敗しました。もう一度試してください。</p>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-2"
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 size={16} className="text-[#00C4EE]" />
              <p className="text-[#00C4EE] font-black text-sm">ありがとう！</p>
            </div>
            <p className="text-white/40 text-xs mt-0.5">ご意見を受け付けました</p>
          </motion.div>
        )}
      </div>

      <p className="text-white/20 text-xs text-center pb-4">
        みんなでつくるGスクエア 共創プロジェクト
      </p>
    </motion.div>
  );
}

// ─── メインVotePage ────────────────────────────────────
export default function VotePage() {
  const [appScreen, setAppScreen] = useState<'intro' | 'consent' | 'vote'>('intro');
  const { election, stats, phase, loading, error } = useElection();

  useEffect(() => {
    if (phase === 'already_voted' && appScreen !== 'vote') {
      setAppScreen('vote');
    }
  }, [phase]);

  if (appScreen === 'intro') {
    return <IntroScreen onNext={() => setAppScreen('consent')} />;
  }

  if (appScreen === 'consent') {
    return (
      <ConsentModal
        onConsent={() => setAppScreen('vote')}
        onBack={() => setAppScreen('intro')}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center ink-bg">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-center"
        >
          <Loader2 size={40} className="text-[#00C4EE] mb-4 mx-auto animate-spin" />
          <p className="text-white/60 font-bold">読み込み中...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !election) {
    return (
      <div className="min-h-screen flex items-center justify-center ink-bg px-4">
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="text-red-400 mb-4 mx-auto" />
          <p className="text-white font-bold text-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-white/60 underline text-sm"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const colorA = election?.optionA.color ?? '#00C4EE';
  const colorB = election?.optionB.color ?? '#FF6B35';

  return (
    <div className="min-h-screen relative ink-bg flex flex-col">
      <BackgroundParticles colorA={colorA} colorB={colorB} count={10} />

      <header className="relative z-10 flex items-center justify-between px-5 py-4 backdrop-blur-sm border-b border-white/8" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-sm tracking-wider">Gスクエア</span>
          <span className="text-white/30 text-xs">みんなでつくる</span>
        </div>
        {stats.totalVoters > 0 && (
          <div className="text-white/40 text-xs">
            {stats.totalVoters}人が投票中
          </div>
        )}
      </header>

      <main className="relative z-10 flex-1 flex flex-col justify-center py-6">
        <AnimatePresence mode="wait">
          {(phase === 'idle' || phase === 'selecting') && <SelectionScreen key="select" />}
          {phase === 'confirming' && <ConfirmScreen key="confirm" />}
          {phase === 'submitting' && <ConfirmScreen key="submitting" />}
          {phase === 'animating' && <AnimationScreen key="anim" />}
          {(phase === 'result' || phase === 'already_voted') && <ResultScreen key="result" />}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 pb-4 text-center">
        <p className="text-white/15 text-xs">10周年に向けた大アップデートプロジェクト！<br />みんなでつくるGスクエア</p>
      </footer>
    </div>
  );
}

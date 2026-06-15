// =============================================
// 選挙状態管理 Context
// =============================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { ensureAuth, getActiveElection, submitVote, subscribeToVoteCounts, subscribeToRecentComments, recordVisit, upsertSession } from '../firebase/elections';
import { collectSessionEnv } from '../utils/deviceInfo';
import { checkContent } from '../utils/contentFilter';
import type { Election, VoteStats, ChoiceId, VotePhase, DemographicData, DeviceInfo, PhaseLogEntry, SessionEnv } from '../types';

// ─── State型 ─────────────────────────────────
interface ElectionState {
  election: Election | null;
  stats: VoteStats;
  phase: VotePhase;
  selectedChoice: ChoiceId | null;
  deviceId: string | null;
  loading: boolean;
  error: string | null;
  // 送信結果（アニメーション用）
  lastVote: {
    choice: ChoiceId;
    bonusVote: boolean;
  } | null;
  demographicData: DemographicData | null;
  deviceInfo: DeviceInfo | null;
}

// ─── Actions型 ───────────────────────────────
interface ElectionActions {
  selectChoice: (choice: ChoiceId) => void;
  submitVote: (agreeReason: string, disagreeReason?: string) => Promise<void>;
  resetToIdle: () => void;
  setPhase: (phase: VotePhase) => void;
  setDemographicAndDevice: (d: DemographicData, dev: DeviceInfo) => void;
}

type ElectionContextValue = ElectionState & ElectionActions;

// ─── Context ─────────────────────────────────
const ElectionContext = createContext<ElectionContextValue | null>(null);

const INITIAL_STATS: VoteStats = {
  votesA: 0,
  votesB: 0,
  votesC: 0,
  totalVoters: 0,
  comments: [],
};

// ─── Provider ────────────────────────────────
export function ElectionProvider({ children }: { children: ReactNode }) {
  const [election, setElection] = useState<Election | null>(null);
  const [stats, setStats] = useState<VoteStats>(INITIAL_STATS);
  const [phase, setPhase] = useState<VotePhase>('idle');
  const [selectedChoice, setSelectedChoice] = useState<ChoiceId | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastVote, setLastVote] = useState<ElectionState['lastVote']>(null);
  const [demographicData, setDemographicData] = useState<DemographicData | null>(null);
  const [deviceInfo, setDeviceInfoState] = useState<DeviceInfo | null>(null);

  // ─── セッション行動ログ用 ref（再レンダー非依存） ──
  // 収集はイントロ画面では行わず、同意完了後にのみ開始する（trackingEnabled）。
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const sessionEnvRef = useRef<SessionEnv | null>(null);
  const phaseLogRef = useRef<PhaseLogEntry[]>([]);
  const phaseEnteredAtRef = useRef<number>(Date.now());
  const prevPhaseRef = useRef<VotePhase>('idle');

  // 初期化：匿名認証 + 選挙データ取得
  useEffect(() => {
    let unsubCounts: (() => void) | null = null;
    let unsubComments: (() => void) | null = null;

    (async () => {
      try {
        const uid = await ensureAuth();
        setDeviceId(uid);

        const activeElection = await getActiveElection();
        if (!activeElection) {
          setError('現在、進行中の投票がありません。');
          setLoading(false);
          return;
        }

        setElection(activeElection);

        // 訪問記録（セッション1回のみ Firestore に保存）
        recordVisit(activeElection.id, uid);

        // 投票済みチェック（localStorage）
        const votedKey = `voted_${activeElection.id}`;
        if (localStorage.getItem(votedKey)) {
          setPhase('already_voted');
        }

        // リアルタイム購読：票数はカウンタ1件、コメントは最新30件のみ（全件購読しない）
        unsubCounts = subscribeToVoteCounts(activeElection.id, (counts) =>
          setStats((prev) => ({ ...prev, ...counts }))
        );
        unsubComments = subscribeToRecentComments(activeElection.id, (comments) =>
          setStats((prev) => ({ ...prev, comments }))
        );
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError('データの読み込みに失敗しました。再読み込みしてください。');
        setLoading(false);
      }
    })();

    return () => { unsubCounts?.(); unsubComments?.(); };
  }, []);

  // ─── フェーズ遷移ごとに滞在時間を記録（接続中に直書込） ──
  useEffect(() => {
    if (!trackingEnabled || !election || !deviceId) return;
    const now = Date.now();

    // 直前フェーズの滞在時間を確定してログに積む
    if (prevPhaseRef.current !== phase) {
      phaseLogRef.current.push({
        phase: prevPhaseRef.current,
        enteredAt: phaseEnteredAtRef.current,
        durationMs: now - phaseEnteredAtRef.current,
      });
      phaseEnteredAtRef.current = now;
      prevPhaseRef.current = phase;
    }

    upsertSession(election.id, deviceId, {
      env: sessionEnvRef.current!,
      phaseLog: phaseLogRef.current,
      lastPhase: phase,
      completed: phase === 'animating' || phase === 'result',
    });
  }, [phase, election, deviceId, trackingEnabled]);

  // ─── 離脱検知（タブ非表示）：その時点の画面を記録 ──
  useEffect(() => {
    if (!trackingEnabled || !election || !deviceId) return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      const now = Date.now();
      const log = [
        ...phaseLogRef.current,
        {
          phase: prevPhaseRef.current,
          enteredAt: phaseEnteredAtRef.current,
          durationMs: now - phaseEnteredAtRef.current,
        },
      ];
      upsertSession(election.id, deviceId, {
        env: sessionEnvRef.current!,
        phaseLog: log,
        lastPhase: prevPhaseRef.current,
        completed: prevPhaseRef.current === 'animating' || prevPhaseRef.current === 'result',
        disconnectAt: now,
      });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [election, deviceId, trackingEnabled]);

  const selectChoice = useCallback((choice: ChoiceId) => {
    setSelectedChoice(choice);
    setPhase('confirming');
  }, []);

  const handleSubmitVote = useCallback(
    async (agreeReason: string, disagreeReason?: string) => {
      if (!election || !deviceId || !selectedChoice) return;

      setPhase('submitting');

      const texts = [agreeReason, disagreeReason ?? ''].filter(Boolean);
      const { shouldHide } = checkContent(texts);

      const result = await submitVote({
        electionId: election.id,
        deviceId,
        choice: selectedChoice,
        agreeReason,
        disagreeReason,
        demographic: demographicData ?? undefined,
        deviceInfo: deviceInfo ?? undefined,
        hidden: shouldHide,
      });

      if (result.success) {
        const bonusVote = Boolean(disagreeReason?.trim());
        setLastVote({ choice: selectedChoice, bonusVote });

        // localStorageにフラグ保存
        localStorage.setItem(`voted_${election.id}`, '1');

        setPhase('animating');
      } else if (result.error === 'ALREADY_VOTED') {
        localStorage.setItem(`voted_${election.id}`, '1');
        setPhase('already_voted');
      } else {
        setError('投票の送信に失敗しました。もう一度お試しください。');
        setPhase('confirming');
      }
    },
    [election, deviceId, selectedChoice]
  );

  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setSelectedChoice(null);
    setLastVote(null);
    setError(null);
  }, []);

  const setDemographicAndDevice = useCallback((d: DemographicData, dev: DeviceInfo) => {
    setDemographicData(d);
    setDeviceInfoState(dev);
    // 同意完了 → ここで初めて環境収集・行動ログ記録を開始する
    if (!sessionEnvRef.current) sessionEnvRef.current = collectSessionEnv();
    phaseEnteredAtRef.current = Date.now();
    prevPhaseRef.current = phase;
    setTrackingEnabled(true);
  }, [phase]);

  const value: ElectionContextValue = {
    election,
    stats,
    phase,
    selectedChoice,
    deviceId,
    loading,
    error,
    lastVote,
    demographicData,
    deviceInfo,
    selectChoice,
    submitVote: handleSubmitVote,
    resetToIdle,
    setPhase,
    setDemographicAndDevice,
  };

  return (
    <ElectionContext.Provider value={value}>
      {children}
    </ElectionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────
export function useElection(): ElectionContextValue {
  const ctx = useContext(ElectionContext);
  if (!ctx) throw new Error('useElection must be used within ElectionProvider');
  return ctx;
}

// =============================================
// 選挙状態管理 Context
// =============================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { ensureAuth, getActiveElection, submitVote, subscribeToVoteStats } from '../firebase/elections';
import { checkContent } from '../utils/contentFilter';
import type { Election, VoteStats, ChoiceId, VotePhase, DemographicData, DeviceInfo } from '../types';

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

  // 初期化：匿名認証 + 選挙データ取得
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

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

        // 投票済みチェック（localStorage）
        const votedKey = `voted_${activeElection.id}`;
        if (localStorage.getItem(votedKey)) {
          setPhase('already_voted');
        }

        // リアルタイム購読
        unsubscribe = subscribeToVoteStats(activeElection.id, setStats);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError('データの読み込みに失敗しました。再読み込みしてください。');
        setLoading(false);
      }
    })();

    return () => unsubscribe?.();
  }, []);

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
  }, []);

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

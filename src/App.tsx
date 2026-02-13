import React, { useMemo, useState } from 'react';
import { DeviceViewport } from './components/DeviceViewport';
import { useInterstitialAd, useJsonStorage } from './hooks';

interface TaskInput {
  text: string;
  createdAt: string;
}

interface StepItem {
  id: string;
  title: string;
  minutes: number;
  done: boolean;
}

interface DailyRun {
  date: string;
  input: TaskInput;
  steps: StepItem[];
}

interface StreakState {
  current: number;
  best: number;
  lastDoneDate?: string;
  lastRecoveryDate?: string;
}

interface CompletionLog {
  date: string;
  input: string;
  completedSteps: number;
  totalSteps: number;
}

type TaskCategory = 'writing' | 'communication' | 'study' | 'organize' | 'generic';

const STORAGE_KEYS = {
  dailyRun: 'taskslice.dailyRun',
  streak: 'taskslice.streak',
  weeklySummary: 'taskslice.weeklySummary',
} as const;

const AD_GROUP_ID = 'ait-ad-test-interstitial-id';

const DEFAULT_STREAK: StreakState = {
  current: 0,
  best: 0,
};

const STEP_MINUTES = [10, 15, 15, 10, 5];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function diffDays(fromKey: string, toKey: string): number {
  const from = fromDateKey(fromKey).getTime();
  const to = fromDateKey(toKey).getTime();
  return Math.floor((to - from) / 86400000);
}

function startOfWeek(date: Date): Date {
  const cloned = new Date(date);
  const day = cloned.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  cloned.setDate(cloned.getDate() + delta);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

function sanitizeToSingleSentence(raw: string): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return '';
  }
  const firstLine = compact.split('\n')[0] ?? '';
  const firstSentence = firstLine.split(/[.!?。！？]/)[0] ?? '';
  return firstSentence.trim().slice(0, 80);
}

function detectCategory(text: string): TaskCategory {
  const value = text.toLowerCase();
  if (/(자료|보고서|문서|발표|기획|작성|정리)/.test(value)) return 'writing';
  if (/(메일|메시지|전화|연락|답장|요청|미팅|회의)/.test(value)) return 'communication';
  if (/(공부|학습|복습|암기|읽기|시험|강의)/.test(value)) return 'study';
  if (/(청소|정리|분류|정돈|파일|폴더|집안일)/.test(value)) return 'organize';
  return 'generic';
}

function createStepId(index: number): string {
  return `${Date.now()}-${index}`;
}

function buildStepTitles(task: string, category: TaskCategory): string[] {
  const normalizedTask = task.replace(/[.?!]+$/g, '');
  if (category === 'writing') {
    return [
      `${normalizedTask}의 완료 기준을 1문장으로 정한다`,
      `${normalizedTask}에 필요한 자료 5개를 모은다`,
      `${normalizedTask} 초안(핵심 3포인트)을 만든다`,
      `${normalizedTask} 흐름과 오탈자를 점검한다`,
      `${normalizedTask} 최종본을 공유하고 기록한다`,
    ];
  }

  if (category === 'communication') {
    return [
      `${normalizedTask}의 목적과 원하는 결과를 정리한다`,
      `${normalizedTask}에 필요한 핵심 정보 3개를 확보한다`,
      `${normalizedTask} 메시지 초안을 짧게 작성한다`,
      `${normalizedTask} 톤과 누락 항목을 점검한다`,
      `${normalizedTask}를 전송하고 후속 할 일을 적는다`,
    ];
  }

  if (category === 'study') {
    return [
      `${normalizedTask}의 오늘 목표를 한 줄로 정의한다`,
      `${normalizedTask} 핵심 개념 3개를 먼저 읽는다`,
      `${normalizedTask} 문제 3개 또는 요약 5줄을 작성한다`,
      `${normalizedTask}에서 틀린 부분만 다시 확인한다`,
      `${normalizedTask} 복습 포인트를 기록하고 종료한다`,
    ];
  }

  if (category === 'organize') {
    return [
      `${normalizedTask}의 기준 영역을 먼저 정한다`,
      `${normalizedTask} 대상을 크게 3묶음으로 나눈다`,
      `${normalizedTask} 우선순위 묶음부터 처리한다`,
      `${normalizedTask} 결과를 빠르게 재배치한다`,
      `${normalizedTask} 유지 규칙 1개를 기록한다`,
    ];
  }

  return [
    `${normalizedTask}의 완료 기준을 한 줄로 정한다`,
    `${normalizedTask}에 필요한 재료를 빠르게 모은다`,
    `${normalizedTask} 첫 실행 버전을 만든다`,
    `${normalizedTask}를 검토하고 한 번 다듬는다`,
    `${normalizedTask}를 마무리하고 다음 행동을 남긴다`,
  ];
}

function decomposeToFiveSteps(text: string): StepItem[] {
  const cleanText = sanitizeToSingleSentence(text);
  const category = detectCategory(cleanText);
  const titles = buildStepTitles(cleanText, category);
  return titles.map((title, index) => ({
    id: createStepId(index),
    title,
    minutes: STEP_MINUTES[index] ?? 10,
    done: false,
  }));
}

function isAllDone(steps: StepItem[]): boolean {
  return steps.length > 0 && steps.every(step => step.done);
}

const App: React.FC = () => {
  const todayKey = toDateKey(new Date());

  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const {
    value: savedRun,
    save: saveRun,
    loading: runLoading,
  } = useJsonStorage<DailyRun | null>(STORAGE_KEYS.dailyRun, null);

  const {
    value: streak,
    save: saveStreak,
    loading: streakLoading,
  } = useJsonStorage<StreakState>(STORAGE_KEYS.streak, DEFAULT_STREAK);

  const {
    value: weeklyLogs,
    save: saveWeeklyLogs,
    loading: weeklyLoading,
  } = useJsonStorage<CompletionLog[]>(STORAGE_KEYS.weeklySummary, []);

  const { loading: adLoading, showAd } = useInterstitialAd(AD_GROUP_ID);

  const currentRun = useMemo(() => {
    if (!savedRun || savedRun.date !== todayKey) {
      return null;
    }
    return savedRun;
  }, [savedRun, todayKey]);

  const streakGap = streak.lastDoneDate ? diffDays(streak.lastDoneDate, todayKey) : null;
  const activeStreak = streakGap === null ? 0 : (streakGap <= 1 ? streak.current : 0);
  const isBrokenStreak = streakGap !== null && streakGap > 1;
  const canRecoverStreak = isBrokenStreak && streak.lastRecoveryDate !== todayKey;

  const weekStartKey = toDateKey(startOfWeek(new Date()));
  const thisWeekLogs = weeklyLogs.filter(log => diffDays(weekStartKey, log.date) >= 0);
  const thisWeekCompletionDays = thisWeekLogs.filter(log => log.completedSteps === log.totalSteps).length;
  const thisWeekAverage = thisWeekLogs.length === 0
    ? 0
    : Math.round(
      thisWeekLogs.reduce((acc, log) => acc + (log.completedSteps / log.totalSteps) * 100, 0) / thisWeekLogs.length,
    );

  const loading = runLoading || streakLoading || weeklyLoading;

  const handleCreatePlan = async () => {
    const singleSentence = sanitizeToSingleSentence(inputText);
    if (!singleSentence) {
      setError('한 줄로 할 일을 입력해 주세요.');
      return;
    }

    setError('');
    setNotice('');

    const nextRun: DailyRun = {
      date: todayKey,
      input: {
        text: singleSentence,
        createdAt: new Date().toISOString(),
      },
      steps: decomposeToFiveSteps(singleSentence),
    };

    await saveRun(nextRun);
    setInputText(singleSentence);
    setNotice('오늘 할 일을 5단계로 분해했어요.');
  };

  const markRunCompleted = async (run: DailyRun) => {
    const previous = streak;
    let nextCurrent = 1;

    if (previous.lastDoneDate) {
      const gap = diffDays(previous.lastDoneDate, todayKey);
      if (gap === 0) {
        nextCurrent = previous.current;
      } else if (gap === 1) {
        nextCurrent = Math.max(1, previous.current + 1);
      }
    }

    const nextStreak: StreakState = {
      ...previous,
      current: nextCurrent,
      best: Math.max(previous.best, nextCurrent),
      lastDoneDate: todayKey,
    };

    const trimmedLogs = weeklyLogs.filter(log => diffDays(log.date, todayKey) <= 30 && log.date !== todayKey);
    const nextLogs: CompletionLog[] = [
      ...trimmedLogs,
      {
        date: todayKey,
        input: run.input.text,
        completedSteps: run.steps.filter(step => step.done).length,
        totalSteps: run.steps.length,
      },
    ];

    await saveStreak(nextStreak);
    await saveWeeklyLogs(nextLogs);
    setNotice('오늘 플랜을 완료했어요. 스트릭이 갱신됐습니다.');
  };

  const handleToggleStep = async (stepId: string) => {
    if (!currentRun) {
      return;
    }

    const wasDone = isAllDone(currentRun.steps);
    const nextSteps = currentRun.steps.map(step => {
      if (step.id !== stepId) return step;
      return { ...step, done: !step.done };
    });

    const nextRun: DailyRun = {
      ...currentRun,
      steps: nextSteps,
    };

    await saveRun(nextRun);

    const nowDone = isAllDone(nextSteps);
    if (!wasDone && nowDone) {
      await markRunCompleted(nextRun);
    }
  };

  const handleRecoverStreak = () => {
    if (!canRecoverStreak) {
      return;
    }

    showAd({
      onDismiss: async () => {
        const restored = Math.max(1, streak.current);
        const nextState: StreakState = {
          ...streak,
          current: restored,
          best: Math.max(streak.best, restored),
          lastDoneDate: todayKey,
          lastRecoveryDate: todayKey,
        };
        await saveStreak(nextState);
        setNotice('스트릭 복구가 완료됐어요.');
      },
    });
  };

  const openWeeklyReport = () => {
    showAd({
      onDismiss: () => {
        setReportOpen(true);
      },
    });
  };

  const completionCount = currentRun?.steps.filter(step => step.done).length ?? 0;
  const totalSteps = currentRun?.steps.length ?? 0;
  const completionRate = totalSteps === 0 ? 0 : Math.round((completionCount / totalSteps) * 100);

  return (
    <>
      <DeviceViewport />
      <div className="min-h-screen font-gmarket text-slate-900">
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 px-5 py-3.5 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center justify-between">
            <h1 className="text-lg font-bold">한입업무</h1>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
              {activeStreak}일 연속
            </span>
          </div>
        </header>

        <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 pb-20 pt-20">
          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">오늘 할 일 (한 줄)</p>
            <p className="mt-1 text-xs text-slate-500">한 문장 입력 → 5단계 자동 분해 (단계당 최대 15분)</p>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="예) 다음주 팀 회의 자료 준비하기"
              rows={2}
              maxLength={120}
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
            {error ? <p className="mt-2 text-xs font-medium text-rose-500">{error}</p> : null}
            <button
              type="button"
              onClick={handleCreatePlan}
              disabled={loading}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="ri-sparkling-2-line" />
              5단계로 쪼개기
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">오늘 실행 플랜</p>
              <span className="text-xs font-semibold text-slate-500">{completionRate}% 완료</span>
            </div>
            {!currentRun ? (
              <p className="mt-4 text-sm text-slate-500">아직 분해된 플랜이 없어요. 한 줄 입력으로 시작해 보세요.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {currentRun.steps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => void handleToggleStep(step.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                      step.done
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex-1">
                      <span className={`block text-sm ${step.done ? 'text-emerald-900 line-through' : 'text-slate-800'}`}>
                        {step.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{step.minutes}분</span>
                    </span>
                    <i className={`text-lg ${step.done ? 'ri-checkbox-circle-fill text-emerald-500' : 'ri-checkbox-blank-circle-line text-slate-400'}`} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">부가 기능</p>
            <div className="mt-3 flex flex-col gap-3">
              <button
                type="button"
                onClick={openWeeklyReport}
                disabled={loading}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                <span className="inline-flex items-center gap-2">
                  주간 리포트 상세 보기
                  <span className="ad-badge">AD</span>
                </span>
                <i className="ri-arrow-right-s-line text-base text-slate-400" />
              </button>
              <p className="text-xs text-slate-500">광고 시청 후 주간 완료율과 기록 목록을 볼 수 있어요.</p>

              <button
                type="button"
                onClick={handleRecoverStreak}
                disabled={!canRecoverStreak || loading}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2">
                  스트릭 복구
                  <span className="ad-badge">AD</span>
                </span>
                <i className="ri-repeat-2-line text-base text-slate-400" />
              </button>
              <p className="text-xs text-slate-500">연속 기록이 끊겼을 때만 광고 시청으로 오늘 기준 복구할 수 있어요.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">요약</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 py-3">
                <p className="text-xs text-slate-500">현재 스트릭</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{activeStreak}</p>
              </div>
              <div className="rounded-xl bg-slate-50 py-3">
                <p className="text-xs text-slate-500">최고 기록</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{streak.best}</p>
              </div>
              <div className="rounded-xl bg-slate-50 py-3">
                <p className="text-xs text-slate-500">이번주 평균</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{thisWeekAverage}%</p>
              </div>
            </div>
          </section>

          {notice ? (
            <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
              {notice}
            </p>
          ) : null}
          {adLoading ? <p className="text-xs text-slate-400">광고를 준비 중이에요.</p> : null}
        </main>

        {reportOpen ? (
          <div className="fixed inset-0 z-[60] flex items-end bg-black/40 p-0">
            <div className="max-h-[78vh] w-full rounded-t-3xl bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">주간 리포트</h2>
                <button type="button" onClick={() => setReportOpen(false)} className="text-sm text-slate-500">
                  닫기
                </button>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-slate-700">이번주 완료 일수: <strong>{thisWeekCompletionDays}일</strong></p>
                <p className="mt-1 text-slate-700">평균 완료율: <strong>{thisWeekAverage}%</strong></p>
              </div>

              <div className="mt-3 flex max-h-[48vh] flex-col gap-2 overflow-y-auto pb-2">
                {thisWeekLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">이번주 기록이 아직 없어요.</p>
                ) : (
                  thisWeekLogs
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .map(log => (
                      <div key={log.date} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">{log.date}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{log.input}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {log.completedSteps}/{log.totalSteps} 단계 완료
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
};

export default App;

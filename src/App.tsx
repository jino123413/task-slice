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

type TaskCategory =
  | 'meeting'
  | 'presentation'
  | 'coding'
  | 'design'
  | 'content'
  | 'communication'
  | 'research'
  | 'study'
  | 'finance'
  | 'shopping'
  | 'travel'
  | 'health'
  | 'exercise'
  | 'household'
  | 'organize'
  | 'career'
  | 'admin'
  | 'review'
  | 'planning'
  | 'writing'
  | 'generic';

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  meeting: '회의',
  presentation: '발표',
  coding: '개발',
  design: '디자인',
  content: '콘텐츠',
  communication: '커뮤니케이션',
  research: '리서치',
  study: '학습',
  finance: '금융/정산',
  shopping: '구매/쇼핑',
  travel: '여행',
  health: '건강',
  exercise: '운동',
  household: '집안일',
  organize: '정리',
  career: '커리어',
  admin: '행정',
  review: '검토/QA',
  planning: '계획',
  writing: '작성',
  generic: '일반',
};

const CATEGORY_PATTERNS: Array<{ category: TaskCategory; pattern: RegExp }> = [
  { category: 'meeting', pattern: /(회의|미팅|아젠다|스탠드업|meeting|agenda|standup)/i },
  { category: 'presentation', pattern: /(발표|프레젠테이션|슬라이드|ppt|리허설|pitch|deck)/i },
  { category: 'coding', pattern: /(개발|코드|버그|배포|api|리팩터링|구현|fix|feature)/i },
  { category: 'design', pattern: /(디자인|ui|ux|figma|시안|와이어프레임|prototype)/i },
  { category: 'content', pattern: /(콘텐츠|블로그|릴스|영상|대본|편집|업로드|포스트)/i },
  { category: 'communication', pattern: /(메일|메시지|연락|답장|dm|follow.?up|회신)/i },
  { category: 'research', pattern: /(조사|리서치|분석|벤치마크|시장|자료조사|research)/i },
  { category: 'study', pattern: /(공부|학습|복습|강의|문제풀이|시험|lecture|course)/i },
  { category: 'finance', pattern: /(정산|예산|가계부|비용|세금|송금|청구|지출)/i },
  { category: 'shopping', pattern: /(쇼핑|구매|장바구니|주문|결제|구입)/i },
  { category: 'travel', pattern: /(여행|항공|숙소|일정|체크인|itinerary|trip)/i },
  { category: 'health', pattern: /(건강|병원|진료|검진|복약|수면|체중)/i },
  { category: 'exercise', pattern: /(운동|헬스|러닝|스트레칭|근력|workout|루틴)/i },
  { category: 'household', pattern: /(청소|빨래|집안일|정돈|분리수거|설거지)/i },
  { category: 'organize', pattern: /(정리|분류|아카이브|백업|파일 정리|폴더 정리)/i },
  { category: 'career', pattern: /(이력서|포트폴리오|면접|채용|지원서|커리어)/i },
  { category: 'admin', pattern: /(행정|등록|제출|증빙|승인|요청|계약)/i },
  { category: 'review', pattern: /(리뷰|검토|피드백|qa|품질|확인)/i },
  { category: 'planning', pattern: /(계획|플랜|로드맵|우선순위|일정|plan|roadmap|schedule)/i },
  { category: 'writing', pattern: /(작성|문서|보고서|기획안|초안|원고|제안서|draft|write)/i },
];

const CATEGORY_GUIDE_ITEMS: Array<{ category: TaskCategory; examples: string[] }> = [
  { category: 'meeting', examples: ['다음주 팀 회의 아젠다 정리하기', '고객 미팅 후속 메일 보내기'] },
  { category: 'presentation', examples: ['월간 보고 발표자료 만들기', '신규 제안 발표 리허설 하기'] },
  { category: 'coding', examples: ['로그인 버그 수정하기', '결제 API 에러 처리 구현하기'] },
  { category: 'design', examples: ['온보딩 화면 UI 시안 만들기', '앱 아이콘 후보 3안 정리하기'] },
  { category: 'content', examples: ['인스타 릴스 대본 작성하기', '블로그 글 발행 준비하기'] },
  { category: 'communication', examples: ['협업 요청 메일 보내기', '고객 문의 답변 템플릿 정리하기'] },
  { category: 'research', examples: ['경쟁 서비스 기능 조사하기', '유사 앱 리뷰 50개 분석하기'] },
  { category: 'study', examples: ['SQL 강의 2강 복습하기', '면접 질문 10개 답변 연습하기'] },
  { category: 'finance', examples: ['이번달 지출 정산하기', '자동이체 내역 점검하기'] },
  { category: 'shopping', examples: ['노트북 구매 비교하기', '주방용품 장바구니 정리하기'] },
  { category: 'travel', examples: ['부산 여행 일정 짜기', '항공권/숙소 예약 완료하기'] },
  { category: 'health', examples: ['건강검진 예약하기', '병원 진료 후 복약 일정 정리하기'] },
  { category: 'exercise', examples: ['오늘 하체 운동 루틴 수행하기', '주간 러닝 계획 세우기'] },
  { category: 'household', examples: ['주말 대청소 하기', '분리수거/빨래/정리 한 번에 끝내기'] },
  { category: 'organize', examples: ['다운로드 폴더 정리하기', '사진 백업 구조 재정리하기'] },
  { category: 'career', examples: ['이력서 최신화하기', '포트폴리오 프로젝트 설명 보완하기'] },
  { category: 'admin', examples: ['사업자 서류 제출하기', '계약서 검토 요청 올리기'] },
  { category: 'review', examples: ['QA 체크리스트 점검하기', '기획안 리뷰 코멘트 반영하기'] },
  { category: 'planning', examples: ['다음 분기 로드맵 초안 짜기', '이번주 우선순위 5개 확정하기'] },
  { category: 'writing', examples: ['주간 업무보고 작성하기', '제안서 초안 1차 완성하기'] },
  { category: 'generic', examples: ['해야 할 일을 한 줄로 입력해 분해하기', '막연한 할 일을 실행 단계로 바꾸기'] },
];

const CATEGORY_FOCUS: Record<TaskCategory, string> = {
  meeting: '회의 준비',
  presentation: '발표 준비',
  coding: '개발 작업',
  design: '디자인 작업',
  content: '콘텐츠 제작',
  communication: '커뮤니케이션',
  research: '리서치',
  study: '학습',
  finance: '정산',
  shopping: '구매',
  travel: '여행 준비',
  health: '건강 관리',
  exercise: '운동',
  household: '집안일',
  organize: '정리',
  career: '커리어 준비',
  admin: '행정 처리',
  review: '검토',
  planning: '계획',
  writing: '문서 작성',
  generic: '업무 실행',
};

const STORAGE_KEYS = {
  dailyRun: 'taskslice.dailyRun',
  streak: 'taskslice.streak',
  weeklySummary: 'taskslice.weeklySummary',
} as const;

const AD_GROUP_ID = 'ait-ad-test-interstitial-id';
const STEP_MINUTES = [10, 15, 15, 10, 5];

const DEFAULT_STREAK: StreakState = {
  current: 0,
  best: 0,
};

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
  if (!compact) return '';
  const firstSentence = compact.split(/[.!?]/)[0] ?? compact;
  return firstSentence.trim().slice(0, 80);
}

function detectCategory(text: string): TaskCategory {
  for (const rule of CATEGORY_PATTERNS) {
    if (rule.pattern.test(text)) {
      return rule.category;
    }
  }
  return 'generic';
}

function createStepId(index: number): string {
  return `${Date.now()}-${index}`;
}

function buildStepTitles(task: string, category: TaskCategory): string[] {
  const cleanTask = task.replace(/[.!?]+$/g, '');
  const focus = CATEGORY_FOCUS[category] ?? CATEGORY_FOCUS.generic;

  return [
    `${cleanTask}의 완료 기준을 한 문장으로 정하기`,
    `${focus}에 필요한 자료와 조건 빠르게 모으기`,
    `${cleanTask} 1차 실행본 만들기`,
    `${cleanTask} 결과 점검하고 보완하기`,
    `${cleanTask} 마무리 후 다음 액션 기록하기`,
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
  return steps.length > 0 && steps.every((step) => step.done);
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

const App: React.FC = () => {
  const todayKey = toDateKey(new Date());

  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

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
  const activeStreak = streakGap === null ? 0 : streakGap <= 1 ? streak.current : 0;
  const isBrokenStreak = streakGap !== null && streakGap > 1;
  const canRecoverStreak = isBrokenStreak && streak.lastRecoveryDate !== todayKey;

  const weekStartKey = toDateKey(startOfWeek(new Date()));
  const thisWeekLogs = weeklyLogs.filter((log) => diffDays(weekStartKey, log.date) >= 0);
  const thisWeekCompletionDays = thisWeekLogs.filter((log) => log.completedSteps === log.totalSteps).length;
  const thisWeekAverage =
    thisWeekLogs.length === 0
      ? 0
      : Math.round(
          thisWeekLogs.reduce((acc, log) => acc + (log.completedSteps / log.totalSteps) * 100, 0) /
            thisWeekLogs.length,
        );

  const weekDayEntries = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      return {
        key: toDateKey(day),
        label: WEEKDAY_LABELS[index] ?? '',
      };
    });
  }, [todayKey]);

  const weekReport = useMemo(() => {
    const logMap = new Map(thisWeekLogs.map((log) => [log.date, log]));
    const doneSteps = thisWeekLogs.reduce((acc, log) => acc + log.completedSteps, 0);
    const totalPlannedSteps = thisWeekLogs.reduce((acc, log) => acc + log.totalSteps, 0);
    const overallRate = totalPlannedSteps === 0 ? 0 : Math.round((doneSteps / totalPlannedSteps) * 100);

    const categoryCount: Partial<Record<TaskCategory, number>> = {};
    for (const log of thisWeekLogs) {
      const category = detectCategory(log.input);
      categoryCount[category] = (categoryCount[category] ?? 0) + 1;
    }

    let topCategory: TaskCategory | null = null;
    let topCategoryCount = 0;
    for (const key of Object.keys(categoryCount) as TaskCategory[]) {
      const count = categoryCount[key] ?? 0;
      if (count > topCategoryCount) {
        topCategory = key;
        topCategoryCount = count;
      }
    }

    let longestCompletedStreakInWeek = 0;
    let currentCompletedStreak = 0;
    const byDay = weekDayEntries.map((day) => {
      const log = logMap.get(day.key);
      const rate = log ? Math.round((log.completedSteps / log.totalSteps) * 100) : 0;
      const completedDay = !!log && log.completedSteps === log.totalSteps;

      if (completedDay) {
        currentCompletedStreak += 1;
      } else {
        currentCompletedStreak = 0;
      }
      if (currentCompletedStreak > longestCompletedStreakInWeek) {
        longestCompletedStreakInWeek = currentCompletedStreak;
      }

      return {
        ...day,
        rate,
        completedSteps: log?.completedSteps ?? 0,
        totalSteps: log?.totalSteps ?? 0,
      };
    });

    return {
      byDay,
      doneSteps,
      totalPlannedSteps,
      overallRate,
      topCategory,
      topCategoryCount,
      longestCompletedStreakInWeek,
    };
  }, [thisWeekLogs, weekDayEntries]);

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
    setNotice('한 줄 업무를 5단계 실행 플랜으로 만들었어요.');
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

    const trimmedLogs = weeklyLogs.filter((log) => diffDays(log.date, todayKey) <= 30 && log.date !== todayKey);
    const nextLogs: CompletionLog[] = [
      ...trimmedLogs,
      {
        date: todayKey,
        input: run.input.text,
        completedSteps: run.steps.filter((step) => step.done).length,
        totalSteps: run.steps.length,
      },
    ];

    await saveStreak(nextStreak);
    await saveWeeklyLogs(nextLogs);
    setNotice('오늘 플랜을 완료했어요. 연속 기록이 갱신되었습니다.');
  };

  const handleToggleStep = async (stepId: string) => {
    if (!currentRun) return;

    const wasDone = isAllDone(currentRun.steps);
    const nextSteps = currentRun.steps.map((step) => {
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
    if (!canRecoverStreak) return;

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
        setNotice('연속 기록 복구가 완료되었습니다.');
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

  const completionCount = currentRun?.steps.filter((step) => step.done).length ?? 0;
  const totalSteps = currentRun?.steps.length ?? 0;
  const completionRate = totalSteps === 0 ? 0 : Math.round((completionCount / totalSteps) * 100);
  const currentCategory = currentRun ? detectCategory(currentRun.input.text) : null;

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
            <p className="mt-1 text-xs text-slate-500">문장 하나를 입력하면 5단계로 자동 분해합니다. (단계당 최대 15분)</p>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
            >
              <i className="ri-information-line text-xs" />
              유형 가이드 보기
            </button>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="예) 다음주 발표 자료 준비하기"
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
              <span className="inline-flex items-center gap-2">
                {currentCategory ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    유형: {CATEGORY_LABELS[currentCategory]}
                  </span>
                ) : null}
                <span className="text-xs font-semibold text-slate-500">{completionRate}% 완료</span>
              </span>
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
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="flex-1">
                      <span className={`block text-sm ${step.done ? 'text-emerald-900 line-through' : 'text-slate-800'}`}>
                        {step.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{step.minutes}분</span>
                    </span>
                    <i
                      className={`text-lg ${
                        step.done ? 'ri-checkbox-circle-fill text-emerald-500' : 'ri-checkbox-blank-circle-line text-slate-400'
                      }`}
                    />
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
              <p className="text-xs text-slate-500">광고 시청 후 주간 완료율과 기록 목록을 확인할 수 있어요.</p>

              <button
                type="button"
                onClick={handleRecoverStreak}
                disabled={!canRecoverStreak || loading}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2">
                  연속 기록 복구
                  <span className="ad-badge">AD</span>
                </span>
                <i className="ri-repeat-2-line text-base text-slate-400" />
              </button>
              <p className="text-xs text-slate-500">연속 기록이 끊겼을 때 하루 1회 복구할 수 있어요.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">요약</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 py-3">
                <p className="text-xs text-slate-500">현재 연속 기록</p>
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
            <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">{notice}</p>
          ) : null}
          {adLoading ? <p className="text-xs text-slate-400">광고를 준비 중이에요.</p> : null}
        </main>

        {guideOpen ? (
          <div className="fixed inset-0 z-[61] flex items-end bg-black/40 p-0">
            <div className="max-h-[82vh] w-full rounded-t-3xl bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-bold">분해 유형 가이드</h2>
                <button type="button" onClick={() => setGuideOpen(false)} className="text-sm text-slate-500">
                  닫기
                </button>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                한 줄 입력 문장을 아래 유형으로 자동 분류합니다. 예시처럼 입력하면 분해 정확도가 좋아져요.
              </p>
              <div className="grid max-h-[62vh] grid-cols-1 gap-2 overflow-y-auto pr-1">
                {CATEGORY_GUIDE_ITEMS.map((item) => (
                  <div key={item.category} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">{CATEGORY_LABELS[item.category]}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.examples.join('  ·  ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {reportOpen ? (
          <div className="fixed inset-0 z-[60] flex items-end bg-black/40 p-0">
            <div className="max-h-[86vh] w-full rounded-t-3xl bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">주간 리포트</h2>
                <button type="button" onClick={() => setReportOpen(false)} className="text-sm text-slate-500">
                  닫기
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-500">이번주 완료 일수</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{thisWeekCompletionDays}일</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-500">이번주 평균 완료율</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{thisWeekAverage}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-500">총 단계 완료율</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {weekReport.doneSteps}/{weekReport.totalPlannedSteps} ({weekReport.overallRate}%)
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-500">최다 유형</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {weekReport.topCategory ? CATEGORY_LABELS[weekReport.topCategory] : '-'}
                    {weekReport.topCategoryCount > 0 ? ` (${weekReport.topCategoryCount}회)` : ''}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-500">주간 최장 완료 연속</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{weekReport.longestCompletedStreakInWeek}일</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-700">요일별 완료율</p>
                <div className="mt-2 flex flex-col gap-2">
                  {weekReport.byDay.map((day) => (
                    <div key={day.key}>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{day.label}</span>
                        <span>{day.rate}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${day.rate}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {day.completedSteps}/{day.totalSteps} 단계 완료
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex max-h-[32vh] flex-col gap-2 overflow-y-auto pb-2">
                {thisWeekLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">이번주 기록이 아직 없어요.</p>
                ) : (
                  thisWeekLogs
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .map((log) => (
                      <div key={log.date} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">{log.date}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {CATEGORY_LABELS[detectCategory(log.input)]}
                          </span>
                        </div>
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

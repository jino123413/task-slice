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
  { category: 'meeting', pattern: /(회의|미팅|회의록|아젠다|의제|스탠드업|agenda|standup|meeting)/i },
  { category: 'presentation', pattern: /(발표|프레젠테이션|ppt|슬라이드|리허설|데모|pitch)/i },
  { category: 'coding', pattern: /(코드|개발|구현|버그|리팩토링|디버깅|api|배포|테스트코드|feature|fix)/i },
  { category: 'design', pattern: /(디자인|시안|와이어프레임|ux|ui|figma|prototype|프로토타입)/i },
  { category: 'content', pattern: /(콘텐츠|영상|촬영|편집|업로드|썸네일|인스타|유튜브|블로그|게시물)/i },
  { category: 'communication', pattern: /(메일|메시지|연락|답장|통화|dm|카톡|요청 메일|follow.?up)/i },
  { category: 'research', pattern: /(조사|리서치|분석|벤치마크|시장조사|자료조사|탐색|research)/i },
  { category: 'study', pattern: /(공부|학습|복습|암기|강의|문제풀이|course|lecture|시험)/i },
  { category: 'finance', pattern: /(가계부|예산|비용|세금|정산|송금|납부|청구|환급|지출)/i },
  { category: 'shopping', pattern: /(쇼핑|구매|장보기|주문|결제|구입|cart)/i },
  { category: 'travel', pattern: /(여행|항공|숙소|여권|체크인|일정표|itinerary|trip)/i },
  { category: 'health', pattern: /(건강|병원|진료|약|식단|수면|체중|혈압|검진)/i },
  { category: 'exercise', pattern: /(운동|러닝|헬스|스트레칭|요가|근력|조깅|workout)/i },
  { category: 'household', pattern: /(청소|빨래|설거지|집안일|분리수거|정리수납)/i },
  { category: 'organize', pattern: /(파일 정리|폴더 정리|백업|아카이브|분류|정돈|정리)/i },
  { category: 'career', pattern: /(이력서|포트폴리오|면접|채용|지원서|커리어|networking)/i },
  { category: 'admin', pattern: /(행정|신청|등록|제출|증빙|결재|승인 요청|계약)/i },
  { category: 'review', pattern: /(검토|리뷰|피드백|점검|qa|품질확인|확인)/i },
  { category: 'planning', pattern: /(계획|플랜|로드맵|일정|우선순위|스케줄|plan|roadmap|schedule)/i },
  { category: 'writing', pattern: /(자료|보고서|문서|발표자료|기획서|작성|초안|원고|제안서|write|draft)/i },
];

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
  const normalizedTask = task.replace(/[.?!]+$/g, '');

  const templates: Record<TaskCategory, (t: string) => string[]> = {
    meeting: (t) => [
      `${t}의 회의 목적과 결정사항 3개를 먼저 적는다`,
      `${t} 참석자별 확인 질문을 정리한다`,
      `${t} 아젠다 초안을 5줄로 만든다`,
      `${t} 필요한 자료/링크를 회의 전에 묶는다`,
      `${t} 회의 후 액션아이템과 담당자를 기록한다`,
    ],
    presentation: (t) => [
      `${t}의 핵심 메시지를 한 문장으로 정한다`,
      `${t} 슬라이드 목차를 5개 이내로 쪼갠다`,
      `${t} 핵심 슬라이드 3장을 먼저 완성한다`,
      `${t} 발표 흐름과 시간 배분을 점검한다`,
      `${t} 리허설 후 수정 포인트를 반영한다`,
    ],
    coding: (t) => [
      `${t}의 완료 기준(동작 조건)을 1줄로 정의한다`,
      `${t} 관련 파일/함수를 먼저 찾는다`,
      `${t} 최소 변경으로 1차 구현한다`,
      `${t} 예외 케이스를 빠르게 점검한다`,
      `${t} 변경 요약과 다음 작업을 기록한다`,
    ],
    design: (t) => [
      `${t}의 목적 화면과 사용자 행동을 정리한다`,
      `${t} 레이아웃 스케치를 3안 만든다`,
      `${t} 1안을 선택해 핵심 컴포넌트를 배치한다`,
      `${t} 타이포/색상/간격 일관성을 점검한다`,
      `${t} 리뷰 포인트를 메모하고 공유한다`,
    ],
    content: (t) => [
      `${t}의 채널과 타깃을 한 줄로 정한다`,
      `${t} 훅 문장과 핵심 메시지 3개를 뽑는다`,
      `${t} 본문 또는 스크립트 초안을 작성한다`,
      `${t} 썸네일/제목/해시태그를 정리한다`,
      `${t} 게시 후 반응 체크 항목을 남긴다`,
    ],
    communication: (t) => [
      `${t}의 목적과 원하는 결과를 정리한다`,
      `${t}에 필요한 핵심 정보 3개를 확보한다`,
      `${t} 메시지 초안을 짧게 작성한다`,
      `${t} 톤과 누락 항목을 점검한다`,
      `${t}를 전송하고 후속 할 일을 적는다`,
    ],
    research: (t) => [
      `${t}의 조사 질문 3개를 먼저 정의한다`,
      `${t} 관련 소스 5개를 수집한다`,
      `${t} 핵심 근거를 표로 정리한다`,
      `${t} 인사이트와 리스크를 분리한다`,
      `${t} 결론과 다음 액션을 기록한다`,
    ],
    study: (t) => [
      `${t}의 오늘 목표를 한 줄로 정의한다`,
      `${t} 핵심 개념 3개를 먼저 읽는다`,
      `${t} 문제 3개 또는 요약 5줄을 작성한다`,
      `${t}에서 틀린 부분만 다시 확인한다`,
      `${t} 복습 포인트를 기록하고 종료한다`,
    ],
    finance: (t) => [
      `${t}의 총금액과 기준 기간을 정한다`,
      `${t} 수입/지출 항목을 구분해 적는다`,
      `${t} 필수 비용과 조정 가능 비용을 나눈다`,
      `${t} 정산/납부 일정과 알림일을 설정한다`,
      `${t} 오늘 바로 할 금융 액션 1개를 실행한다`,
    ],
    shopping: (t) => [
      `${t}의 구매 목적과 예산 상한을 정한다`,
      `${t} 후보 상품 3개를 비교한다`,
      `${t} 필수 스펙과 제외 조건을 체크한다`,
      `${t} 최종 1개를 선택하고 주문한다`,
      `${t} 배송/반품 확인 일정을 기록한다`,
    ],
    travel: (t) => [
      `${t}의 일정과 핵심 목적지를 정한다`,
      `${t} 이동/숙소/예산을 빠르게 채운다`,
      `${t} 준비물 체크리스트를 작성한다`,
      `${t} 예약/체크인 마감일을 확인한다`,
      `${t} 출발 전 최종 점검 항목을 저장한다`,
    ],
    health: (t) => [
      `${t}의 현재 상태와 목표를 기록한다`,
      `${t} 병원/약/식단 중 우선순위를 고른다`,
      `${t} 오늘 실행할 건강 행동 1개를 정한다`,
      `${t} 기록 항목(수면/체중/통증)을 체크한다`,
      `${t} 내일 이어갈 관리 계획을 남긴다`,
    ],
    exercise: (t) => [
      `${t}의 운동 목표와 시간대를 정한다`,
      `${t} 워밍업 루틴을 5분 구성한다`,
      `${t} 메인 운동 3세트를 실행한다`,
      `${t} 강도와 폼을 점검한다`,
      `${t} 쿨다운과 기록 입력을 마친다`,
    ],
    household: (t) => [
      `${t}의 대상 공간을 1곳으로 좁힌다`,
      `${t} 버릴 것/남길 것을 분리한다`,
      `${t} 우선 구역부터 15분 정리한다`,
      `${t} 생활 동선 기준으로 재배치한다`,
      `${t} 유지 규칙 1개를 기록한다`,
    ],
    organize: (t) => [
      `${t}의 정리 기준(이름/날짜/주제)을 정한다`,
      `${t} 대상 파일 또는 항목을 모은다`,
      `${t}를 3그룹으로 분류한다`,
      `${t} 불필요 항목을 삭제 또는 보관한다`,
      `${t} 이후 검색 규칙을 메모한다`,
    ],
    career: (t) => [
      `${t}의 목표 포지션을 한 줄로 정한다`,
      `${t} 핵심 경력 포인트 3개를 추린다`,
      `${t} 이력서/포트폴리오 초안을 갱신한다`,
      `${t} 지원/면접 준비 체크리스트를 만든다`,
      `${t} 다음 지원 일정 1개를 등록한다`,
    ],
    admin: (t) => [
      `${t} 제출 마감일과 필수 항목을 확인한다`,
      `${t} 필요한 서류를 모은다`,
      `${t} 신청서 초안을 작성한다`,
      `${t} 누락/오탈자를 최종 점검한다`,
      `${t} 제출 후 접수 상태를 기록한다`,
    ],
    review: (t) => [
      `${t}의 검토 기준을 3개 정한다`,
      `${t} 핵심 결과물을 처음부터 훑는다`,
      `${t} 오류/개선점 목록을 작성한다`,
      `${t} 우선순위 높은 수정부터 반영한다`,
      `${t} 최종 확인 후 종료한다`,
    ],
    planning: (t) => [
      `${t}의 목표와 완료 기준을 정한다`,
      `${t} 세부 작업을 5개 이내로 나눈다`,
      `${t} 우선순위와 순서를 확정한다`,
      `${t} 시간 블록을 배정한다`,
      `${t} 오늘 바로 시작할 1단계를 실행한다`,
    ],
    writing: (t) => [
      `${t}의 완료 기준을 1문장으로 정한다`,
      `${t}에 필요한 자료 5개를 모은다`,
      `${t} 초안(핵심 3포인트)을 만든다`,
      `${t} 흐름과 오탈자를 점검한다`,
      `${t} 최종본을 공유하고 기록한다`,
    ],
    generic: (t) => [
      `${t}의 완료 기준을 한 줄로 정한다`,
      `${t}에 필요한 재료를 빠르게 모은다`,
      `${t} 첫 실행 버전을 만든다`,
      `${t}를 검토하고 한 번 다듬는다`,
      `${t}를 마무리하고 다음 행동을 남긴다`,
    ],
  };

  return (templates[category] ?? templates.generic)(normalizedTask);
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
    setNotice('오늘 플랜을 완료했어요. 연속 기록이 갱신됐습니다.');
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
        setNotice('연속 기록 복구가 완료됐어요.');
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
                  연속 기록 복구
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

# 한입업무 분해 유형 확장 리서치 (2026-02-13)

## 목적
- 기존 5개 분해 유형을 20개로 확장해 입력 문장 매칭 정확도를 높인다.
- 실사용 패턴(개인 생산성, 팀 협업, 행정/생활 업무)을 반영한다.

## 유형 확장 결과 (20개)
1. 회의
2. 발표
3. 개발
4. 디자인
5. 콘텐츠
6. 커뮤니케이션
7. 리서치
8. 학습
9. 금융/정산
10. 구매/쇼핑
11. 여행
12. 건강
13. 운동
14. 집안일
15. 정리
16. 커리어
17. 행정
18. 검토/QA
19. 계획
20. 작성

## 웹 서치 근거 요약
- Todoist 템플릿/생산성 문서에서 `work, meeting, planning, study, personal, shopping` 등 실제 분류 패턴 확인.
- Asana 템플릿 허브에서 `engineering, design, marketing/content, operations/admin, project planning` 분류 확인.
- Microsoft To Do 가이드에서 `My Day, Planned, Important, Tasks` 기반 실행형 작업 관리 흐름 확인.
- GTD/Time Blocking/Pomodoro 같은 실행 프레임을 지원하기 위해 계획/실행/검토 단계를 분해 템플릿에 반영.

## 반영 파일
- `src/App.tsx`
  - `TaskCategory`를 20유형(+generic fallback)으로 확장
  - 키워드 기반 `CATEGORY_PATTERNS` 추가
  - 유형별 5단계 분해 템플릿 추가
  - 실행 화면에 `유형` 라벨 노출

## 참고 링크
- https://www.todoist.com/templates
- https://www.todoist.com/productivity-methods
- https://asana.com/templates
- https://support.microsoft.com/en-us/office/get-started-with-microsoft-to-do-31bfe5a1-5a02-4d6f-ae5f-49b6331b0f8f

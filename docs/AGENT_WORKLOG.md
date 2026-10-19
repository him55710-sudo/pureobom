# 에이전트 작업 기록 · Agent work log

공개 개발 기록의 시작일: 2026-10-16. 완료된 작업과 예정 작업을 구별한다. 이 기록은 재현할 수 있는 작업 사실이며 에이전트의 비공개 내부 추론 기록이 아니다. 모델 출력·도구 로그에 개인정보나 비밀이 있으면 공개하지 않는다.

## 2026-10-20 · AI 없는 예시 계산과 설명 첨부

- **문제·구현:** 실제 코드의 반환 동작을 잘못 설명했던 모델 실패에 대응해 사용자가 선택한 입력을 기존 bounded worker에서 계산하고 먼저 표시한다. 최신 파일/함수에 묶인 호스트 결과만 설명에 첨부한다. 선택한 AST 범위와 다른 동명 함수 계산, 반환 객체 변조·위조 입력·오래된 근거를 거절한다. [사용법·한도·전송 범위](EXPLANATION_OBSERVATIONS.md).
- **실제 코드:** 변경하지 않은 비공개 평가 복사본과 같은 설명 대상에서 선정 경계 사례 7개를 사용했다. 실제 Node 반환 6개가 새 제품 동작과 일치했고 예외 1개는 제품 확인 불가였다. 원본 해시·깨끗한 checkout을 확인했다. 원래 프로젝트 테스트나 연구 타당성 검증으로 세지 않는다.
- **모델 실패·정정:** 7B CPU 요청은 예시 첨부 전 180초 생성 timeout. 예시를 준비한 3B 요청은 preflight timeout으로 chat에 도달하지 않았다. 처음 3B에도 180초 생성 실패라고 설명했지만 요청 파일 부재와 서버 로그를 대조해 정정했다. 두 시도 모두 답변 품질을 평가하지 못했다. 기존 시간/출력 한도를 늘리거나 실패를 제외하지 않았다. 이 작업에서 실행한 전용 로컬 서버만 종료했고 다른 서버는 유지했다.
- **검증:** 핵심 부분 68개(새 8개), 웹/확장 빌드, 개발 native/새 production 설치 부분 각 3개·11파일 해시가 통과했다. 실제 worker/controller/Ollama HTTP client를 사용하고 응답만 고정했다. 브라우저 공개 fixture로 모델 연결 없는 계산·입력/함수 변경 시 결과 해제·한/영 표시·첨부 결과를 확인했다. 스크린샷은 공개 코드만 포함한다. [실행 기록](evidence/local-ai/explanation-observations.json).
- **한계·공개:** JS/TS 지원 구문과 읽어 둔 소스에 한정한다. 모델 의미 검증·전체 앱 정확성·성능 개선·모든 언어 완료는 남아 있다. 비공개 코드/입력/출력/원문 요청은 공개하지 않으며 안정판/Pages 배포와 구분한다.

## 2026-10-20 · 계산 경로의 파일별 원본 이동

- **수정:** 이전 단계에서 확인한 다른 파일 trace 이동 결함을 고쳤다. AST 기록에 파일 경로를 추가하고 화면에 파일/줄을 표시한다. 확장은 최신 계산의 원문/URI와 복제한 기록을 보관하고 식별자+항목 번호로만 이동한다. 원문 변경·오래된 결과·잘못된 항목은 거절하고 표시 생략에는 링크를 만들지 않는다. [설계·재현·한계](TRACE_NAVIGATION.md).
- **검증:** 핵심 부분 108개, 웹/확장 빌드가 통과했다. 실제 VS Code 개발 호스트와 별도 production 설치본에서 각각 새 검사 3개가 통과했다. 동일 basename의 다른 파일·조건/while/콜백/return 여섯 위치·응답 객체 변조·열지 않은 파일의 디스크 변경을 검증했다. 설치 파일 11개 해시를 확인했다. 부분 실행은 별도 보고서와 `trace-source-only` 범위를 쓰며 전체 검사 통과로 세지 않는다.
- **실패 보존:** 첫 핵심 실행은 새 테스트 괄호 오타로 한 suite가 컴파일 실패했고 다른 41개가 통과했다. 수정 후 위 부분 검사가 통과했다. 전체 native 첫 실행은 Go 경로 누락, 프로세스에만 Go/Java 경로를 보완한 두 번째는 C# reader version assertion에서 실패해 새 검사에 도달하지 않았다. 두 번째 실패의 원인을 timeout이라고 단정하지 않는다. 브라우저 harness 첫 실행은 기본 포트 사용 중으로 종료되어 trace 모드에도 자동 포트를 사용하도록 고쳤다. 브라우저 webview 연결 한 번은 timeout으로 실패했고 탭이 생성되지 않은 것을 확인한 뒤 자체 서버를 종료했다. 직접 UI 확인이나 스크린샷은 없다.
- **공개 범위:** [실행 기록·설치 해시](evidence/local-ai/trace-navigation.json)에 결과를 구분한다. 두 TSX 화면의 버튼 이름·비활성화·출처 없는 항목 처리와 기존 문맥 갱신에 따른 결과 해제를 React 체크리스트로 검토했다. API/모델 호출·비공개 코드 변경은 없고 모델 품질/최적화 과제는 남아 있다. 안정 릴리스/Pages는 교체하지 않았다.
- **긴 경로 후속:** 코드 검토에서 기존 줄 버튼의 `white-space: nowrap`이 긴 전체 경로에 맞지 않는 것을 확인했다. 별도 클래스에 너비 한도·줄바꿈을 적용한 `13752f4`는 확장 빌드를 통과했다. 앞선 로컬 native/패키지 결과는 `4544596`이며 후속 화면 스타일의 직접 확인 근거로 바꾸지 않는다.
- **최종 교차 검증:** `13752f4`의 [Windows·Ubuntu CI](evidence/local-ai/trace-navigation-ci.json)는 각 핵심 304개·개발 확장 61개·production 설치본 61개·설치 파일 11개 해시·패키지 검사에 성공했다. 두 job의 실제 로그에서 새 출처 이동 검사 3개와 수치/해시를 대조했다. 문서 후속 커밋의 CI로 소급하지 않으며 로컬 실패·UI 연결 실패는 유지한다.

## 2026-10-20 · 실제 대상 함수의 반복·배열 계산

- **목적과 구현:** 사용자 실제 코드에서 확인 불가였던 원래 대상 함수의 구문을 조사했다. `simulate.ts`에 부모 환경을 연결한 지역 변수, 제한된 while·대입·증감·비트 연산, AST 콜백과 배열 map/숫자 at을 연결했다. 원래 연산 예산 4,000·호출 깊이 32를 유지하고 경로 표시 생략을 명시한다. [지원 범위·설계·재현](BOUNDED_PREVIEW.md).
- **실제 코드 근거:** 변경하지 않은 평가용 비공개 파일의 원래 대상 함수가 실제 제품 worker에서 계산된다. 원래 프로젝트 assertion 3사례와 별도로 선정한 11사례가 Node와 일치했고, Node가 예외를 낸 1사례는 제품에서도 확인 불가였다. 소스 해시는 유지됐다. 기존 모델 설명 실패·과학적 타당성·속도 개선은 해결했다고 하지 않는다. 원문·식별자·상세 입력/결과는 로컬에만 보존했다.
- **실패 보존:** 첫 타입 검사에서 문자열 receiver에 Object.hasOwn의 object 타입을 요구해 실패해 표준 own-property 호출로 바꿨다. 첫 핵심 부분 검사는 116 pass/1 fail이었다. 400회 반복 예제가 기존 연산 예산을 넘긴 경우로, 예산 초과를 계속 검사하고 별도 220회 예제로 경로 생략 표시를 확인한다. 이후 부분 118개가 통과했다. 비공개 탐침은 예외를 예상한 입력에서 실제 Node가 반환해 첫 실행 실패했고, 실제 반환/예외를 기준으로 대조하도록 수정했다.
- **검증 구분:** 새로운 공개 검사 35개 중 23개는 고정 공개 JS를 독립 Node로 실행해 대조한다. 사용자 코드에는 eval/동적 import/호스트 함수 실행을 추가하지 않는다. 전체 로컬 첫 실행은 Java 검사 2개와 .NET 준비 hook의 제한 시간 실패로 **290 pass / 2 fail / 9 skip**이며 성공으로 바꾸지 않는다. 이후 개발/설치·교차 운영체제 결과는 [실행 기록](evidence/local-ai/iteration-preview.json)을 따른다. 브라우저 검증은 webview 연결 timeout 두 번으로 완료하지 못했고 해당 검증 서버는 종료했다.
- **개발 호스트:** 별도 실제 VS Code 실행은 새 반복 계산→준비한 값 전후 비교→한도 초과·소스 보존을 포함해 **58개 통과**했다. 웹/확장 빌드도 성공했다. 로컬 전체의 시간 초과 기록을 이 성공으로 덮지 않는다.
- **시간 초과 후속·남은 결함:** 실패한 Java/.NET 두 파일만 소스·시간 한도 변경 없이 재실행해 17개가 통과했다. 코드 검토에서 고급 계산 trace의 줄 버튼이 다른 호출 파일에도 현재 문서로 이동하는 미완료 항목을 확인했다(`extension/ui/main.tsx`의 `source(step.line)`). 이번 같은 파일의 계산 일치로 다른 파일 이동까지 검증하지 않는다.
- **공개 소스 검증:** 기능 커밋 `5242fcc`의 [Windows·Ubuntu CI](evidence/local-ai/iteration-preview-ci.json)가 각 핵심 301개, 개발/production 설치 각 58개·설치 파일 11개 해시·추출 도구 검사에 성공했다. 실제 로그에서 새 반복 계산 검사와 개수를 대조했다. PR #1 제목·설명을 최종 구현 범위로 갱신했다. 후속 문서 커밋과 테스트한 기능 커밋을 구분하며 안정 릴리스/Pages는 교체하지 않았다.

## 2026-10-20 · 계산 값 전달·숨김 상위 경로·실제 코드 대조

- **발견과 수정:** NaN/무한대/-0/undefined가 JSON 메시지와 반환 경로에서 다른 값으로 표시되는 오류를 수정했다. `previewValues.ts`의 제한 있는 값 인코딩을 simulate/compare 양방향에 연결하고 화면·trace·Markdown 표시를 통일했다. 한국어/영어 안내와 공개 UI 재현 fixture를 추가했다. [설계·수정 전 결과·화면·한계](evidence/local-ai/preview-values.md).
- **실제 사용자 코드:** 변경하지 않은 비공개 프로젝트의 지원 가능한 함수 하나에서 에이전트가 선정한 4개 입력을 직접 Node 계산과 제품 worker 결과로 대조해 일치를 확인했다. 원래 프로젝트 테스트가 아니며 소스 해시는 유지됐다. 원래 요청 대상 함수의 미지원 구문과 앞선 모델 설명 실패는 해결되지 않았다. 공개 자료에는 익명 요약만 넣었다.
- **회귀 중 발견:** 개발 호스트 2회가 기존 비교에서 실패했다. 숨김 상위 경로까지 검사하는 scan 오류를 프로젝트 내부 경로로 제한하고, 항상 숨김 루트에서 정상 파일 포함·내부 숨김 파일 제외를 검증한다. 그다음 실행은 기존 Python 테스트의 중간 편집이 undo로 복구되지 않아 실패했다. 해당 fixture의 편집기 포커스를 명시하고 즉시 원문 복구를 검증하도록 보강했다. 첫 실패 기록과 이후 실행을 분리한다.
- **증거 범위:** 핵심 전체 266개, 별도 값 전달 6개가 통과했다. 실제 VS Code 메시지 왕복, 개발/production 설치, 추출 패키지 결과는 [실행별 기록](evidence/local-ai/preview-values-verification.json)을 따른다. React 화면은 실제 worker를 사용하는 모의 VS Code 브라우저 harness에서 검증했다. API·모델 호출이나 임의 코드 실행을 추가하지 않았다. 전체 언어·원격 환경·성능 개선을 주장하지 않는다.
- **작업 격리:** 동시 작업 중인 기본 checkout을 덮어쓰지 않도록 별도 managed worktree와 `codex/preview-value-preservation` 브랜치를 사용했다. 안정판/Pages는 변경하지 않는다.
- **경계 후속:** 첫 제품 커밋 `eb82dec`를 공개한 뒤 문자열 노드를 디코더에서 두 번 세는 차이를 검토 중 발견했다. 인코더와 방문량을 통일하고 정확히 20,000노드 왕복·한 노드 초과 거절을 확인했다(값 전달 검사 6개 통과). 위 로컬 전체/설치 근거는 첫 커밋이며 후속 전체 CI와 구분한다.
- **최종 기능 검증·공개:** `66a6781`의 [Windows·Ubuntu CI](evidence/local-ai/preview-values-ci.json)가 모두 성공했다. 각 핵심 266개·개발/production 설치 각 57개·파일 11개 해시·추출 도구 성공을 실제 로그에서 대조했다. [검토용 PR #1](https://github.com/him55710-sudo/pureobom/pull/1)에 격리 브랜치를 연결했다. 기본 checkout의 동시 작업·안정판·Pages는 그대로이며, 실제 사용자 과제 전체 성공을 의미하지 않는다.

## 2026-10-20 · 선택 원문 구분·CPU 옵션·실제 설명 오류 보존

- **문제와 변경:** 이전 실제 설명 timeout과 인접 함수 혼동을 조사했다. `src/core/localAssistant.ts`에서 선택 함수와 앞뒤 원문을 구분하되 모든 문자를 보존한다. `extension/src/ollama.ts`, 호스트와 `LocalAssistant.tsx`에 요청별 CPU 옵션을 연결하고 잘못된 옵션을 거절한다. 기본은 Ollama 자동 선택이다. `truncate:false`, `shift:false`를 명시하며 기존 문맥·출력·시간 한도는 유지한다. [설계·공식 자료·실패 기록](evidence/local-ai/focused-context-cpu.md).
- **실제 과제:** 같은 변경하지 않은 비공개 사용자 파일과 같은 질문으로 CPU 전용 서버에서 세 번 생성했다. 3B 기존 입력은 선택 함수 인용이 없어 거절, 3B 선택 원문 구분은 인용 4개를 통과했으나 의미 검토 실패, 4B 명시적 CPU 요청은 인용 불일치와 의미 오류였다. 성공한 사용자 설명 과제로 세지 않는다. 공개 자료는 익명 요약이며 원문·원시 응답·상세 입력 결과는 로컬에 보존한다. 별도 평가 서버는 종료하고 다른 서버를 변경하지 않았다.
- **성능 해석:** 이전 GPU 부분 적재와 이번 CPU 완료를 관찰했지만 실행 시점·다른 작업·캐시가 달라 속도 향상률이나 timeout의 단일 원인을 주장하지 않는다. 문맥 예산을 줄여 성능을 높였다는 변경도 아니다. 4B의 실제 요청 플래그와 VRAM 0을 확인했다.
- **화면:** 실제 빌드 UI/worker와 공개 예제·제어된 모델 응답으로 한국어 CPU 선택·결과 표시→자동 선택 시 결과 제거→영어 전환과 새 결과를 확인했다. [한국어](evidence/local-ai/cpu-explanation-ko.jpg), [영어](evidence/local-ai/cpu-explanation-en.jpg). React 스킬 기준으로 레이블·요청 상태·결과 초기화·type-only import를 검토했다. CPU 표시를 실제 측정값으로 오인하지 않도록 요청값이라고 썼다.
- **검증:** 관련 단위 검사 22개, 전체 핵심 260개, 웹/확장 빌드, 실제 VS Code 개발/production 설치 각 55개, 설치 파일 11개 해시·추출 도구·패키지 검사를 통과했다. [원자료](evidence/local-ai/focused-context-cpu.json). 인증 제공자 대기와 종료 N-API 경고는 있었으며 suite 종료는 0이었다. 전체 검사에서 재측정한 합성 파서 기록은 로컬에 따로 보존하고 공개 benchmark 파일은 이전 값으로 복원했다. 교차 OS CI는 별도 확인한다. 제품 검사 성공을 실제 모델 정확성으로 합산하지 않는다. 안정판/Pages 0.6.0은 교체하지 않는다.

- **교차 운영체제 확인:** `954d6cf`를 명시적으로 `origin main`에 push했고 [Windows·Ubuntu Verify](https://github.com/him55710-sudo/pureobom/actions/runs/39308112923)가 모두 성공했다. 각 핵심 260개·개발/설치 각 55개·production 모드·파일 11개 해시와 추출 도구를 로그에서 대조했다. [CI 원자료](evidence/local-ai/focused-context-cpu-ci.json). 실제 비공개 모델의 설명 실패와 별개이며 안정판 배포는 하지 않았다.

## 2026-10-20 · 선택한 함수 설명과 실제 사용자 코드 후속 평가

- **구현:** `localAssistant.ts`의 설명 범위·프롬프트·인용 조건, 호스트의 함수 ID 해석, `ReadingView.tsx` → `LocalAssistant.tsx` 진입과 한국어/영어 선택기를 연결했다. 코드에 존재하는 검사와 호출자 전제를 구별하도록 요청한다. 선택 함수 안의 실제 인용이 최소 하나 있어야 하지만 설명 의미의 참·거짓을 판정하지 않는다. 전체 현재 파일과 기존 크기/시간 제한을 유지한다. [사용법](FOCUSED_EXPLANATIONS.md).
- **실제 프로젝트:** 이전 서식 과제와 같은 원문의 설명 부분을 두 로컬 모델로 요청했지만 각각 180초 시간 초과였다. 전송 전 모델 부재와 평가 도구의 모듈 해석 실패도 따로 보존했다. 분석기는 제품의 빌드 worker를 사용하도록 평가 도구만 수정했다. 변경하지 않은 함수에 평가자가 정한 경계 입력 7개를 실행했으나 모델 완성 응답이 없어 정확도 채점을 하지 않았다. 실제 소스·원시 요청·상세 결과는 비공개 로컬 자료로 남긴다. [공개 시도별 기록](evidence/local-ai/focused-explanation.md).
- **실제 편집기:** Windows VS Code 1.96.4 개발 호스트 **55개 흐름 통과**. 새 흐름은 잘못된/오래된 함수 ID·수정 작업의 함수 선택을 전송 전에 거절하고, 전체 파일 전송·선택 함수 인용·정확한 원문 이동·무변경·편집 후 무효화를 확인했다. 모델 응답은 제어된 HTTP fixture다. [원자료](evidence/local-ai/focused-explanation-development-integration.json).
- **화면과 용어:** 실제 확장 UI/worker와 공개 예제로 한국어/영어 함수 선택·결과 초기화·이름/줄 범위 표시를 조작했다. 접근성 이름을 별도 지정하고 긴 도움말을 설명으로 연결했다. 일반 숫자 합계를 결제 금액으로 단정하던 사전을 범용 표현으로 수정했다. [한국어](evidence/local-ai/focused-explanation-ko.jpg), [영어](evidence/local-ai/focused-explanation-en.jpg). 모의 편집기·제어된 답변이며 설치 VS Code 수동 UI나 모델 품질 검증으로 집계하지 않는다. React 스킬 기준으로 파생 선택값·문서 ID·안정된 키·접근성을 검토했다.
- **검사 실패도 보존:** 로컬 AI 핵심 14개는 통과했다. 첫 전체 실행은 SDK 경로 미설정 3개 suite와 Python/측정 timeout으로 231 pass / 4 fail / 24 skipped였다. SDK 경로를 설정하고 직렬 실행한 후속 결과는 **258 pass / 1 fail**이며 기존 Java 리터럴 사례의 30초 timeout이 남았다. 테스트나 제품의 제한을 늘리지 않았다. 개발/설치·빌드 결과는 [검증 기록](evidence/local-ai/focused-explanation-verification.json)에 실행별로 분리한다.
- **설치본:** 새 VSIX `5e087b7a…`의 production 모드·실제 파일 11개 해시와 같은 **55개 흐름 통과**를 확인했다. [설치 원자료](evidence/local-ai/focused-explanation-installed-integration.json). 웹·확장 빌드와 VSIX 패키징 성공. 개발/설치 검사를 별개 110개 기능으로 세지 않으며 수동 설치 UI·실제 모델 결과는 별도다.
- **패키지 검사:** 체크섬·소스 manifest·라이선스와 저장소 밖의 분석/Rust WASM·Python 측정·Python/Go/Java/C# 원문 도구 실행을 통과했다. 로컬 개발 패키지 검증이며 stable/Pages 게시가 아니다. 이번 전체 테스트가 다시 기록한 합성 benchmark 파일은 로컬에 보존하고 이전 공개 파일을 복원해 성능 개선 자료로 사용하지 않았다.
- **교차 OS CI:** 제품 커밋 `9758dac`를 명시적으로 `origin main`에 push했다. [Windows·Ubuntu Verify](https://github.com/him55710-sudo/pureobom/actions/runs/39304019563)의 각 로그에서 핵심 **259개**, 개발/production 설치 각 **55개**, 설치 파일 11개 해시와 추출 도구 실행 성공을 대조해 [원자료](evidence/local-ai/focused-explanation-ci.json)를 공개했다. 로컬 Java timeout의 원인을 확정하거나 실패를 소급 변경하지 않는다. 실제 모델 추론·외부 프로젝트 결과는 이 CI에 포함되지 않는다.
- **판정:** 원문 위치 검증 기능이 추가됐지만 실제 사용자 코드 설명의 의미 정확성은 미확인이다. 앞선 모델 없는 서식 적용·8→8→8 검사·복구를 모델 성공으로 바꾸지 않는다. 일반 수정 품질·실측 최적화·환경별 사용성은 계속 남아 있으며 안정 릴리스/Pages는 교체하지 않는다.

## 2026-10-20 · Rust 실제 프로젝트 검사·복구와 교차 OS CI

- **실제 코드:** [humantime 2.3.0 고정 커밋](evidence/local-ai/rust-source-project.md)의 원래 소스·단위/문서 테스트를 사용했다. Windows VS Code 개발 호스트에서 시간 상수 `3600 → 3601` 한 범위만 native diff·적용·저장하고, task로 원래 Cargo 검사를 실행했다. **42 pass → 34 pass / 8 fail → native undo·저장 후 42 pass**, 미저장 실행 차단·원본 바이트 해시·clean checkout을 확인했다. 고정 오류 검출 검사이며 실제 upstream 결함 발견·모델 품질·최적화 성공은 아니다.
- **환경과 실패:** 격리된 Rust 1.90.0 GNU 도구·LLVM component를 사용했다. 원본 검사 전 dlltool 경로, subprocess 오류, 없는 LLVM 별칭 가정, GNU 링커의 한글 경로 처리, PowerShell 플래그 목록 조립 실패를 [다섯 시도](evidence/local-ai/rust-source-project-setup.json)로 남겼다. LLVM의 dlltool driver 별칭과 포함된 rust-lld를 정확한 인자로 지정한 뒤 원본과 native 전후 흐름이 통과했다. 테스트·프로젝트 코드를 바꾸지 않았고 시스템 PATH·레지스트리를 변경하지 않았다.
- **재현과 공개:** `extension/test/rustSourceProject.ts`, `scripts/test-rust-source-project.mjs`, `scripts/run-humantime-tests.mjs`, [fixture 안내·Cargo.lock](../scripts/fixtures/humantime/README.md), MIT 고지·기계 판독 결과를 추가했다. 보고서의 로컬 경로를 치환하고 사용자 비공개 프로젝트 소스는 포함하지 않았다. 실제 원문 구조 174/328을 정확도 점수로 해석하지 않는다. 원래 일부 테스트는 난수를 사용하므로 실행 시간·실패 순서도 고정하지 않는다.
- **제품 CI:** 커밋 `7df2ee6`의 [Windows·Ubuntu Verify](https://github.com/him55710-sudo/pureobom/actions/runs/39296850732) 로그에서 각각 핵심 258개, 개발/production 설치 각 54개, 파일 11개 해시와 추출 Rust WASM 실행 성공을 대조했다. [CI 원자료](evidence/local-ai/rust-source-ci.json). 앞선 로컬 설치 실패를 성공으로 바꾸지 않으며, 외부 humantime 검사는 이 CI에 포함되지 않는다. 제품 소스 변경 없이 후속 harness TypeScript 검사도 통과했다.
- **남은 범위:** 실제 사용자 요청에서 모델의 설명·일반 수정 품질, 실측 성능 향상, 사용성, 다른 Rust SDK·원격/테마·버전 조합. stable/Pages 0.6.0 배포는 유지하며 0.7 개발 검증 기록을 공개한다.

## 2026-10-20 · 포함된 Rust 파서와 실제 편집기 경로

- **구현:** tree-sitter-rust 0.24.2 공식 WASM과 web-tree-sitter 0.27.1을 고정해 포함했다. 빌드에서 grammar SHA-256을 검증하고 MIT 고지를 패키지에 추가했다. worker가 현재 Rust 원문을 읽고 함수·impl/trait 본문·분기·패턴·guard·반복·반환·일부 식과 정확한 값 범위를 표시한다. API·모델·Rust SDK를 호출하지 않는다. [구현 범위](RUST_SOURCE.md).
- **수정 흐름:** 숫자 suffix·큰 정수를 문자열 그대로 보존하며 bool·일반 UTF-8/raw string의 범위 수정→후보 파싱→native Rust diff→명시적 적용→undo를 연결했다. 매크로·속성·char/byte/C 문자열은 직접 편집에서 제외한다. 로컬 AI 제안의 문법 오류 적용을 차단하지만 타입·소유권·매크로 의미 검사로 주장하지 않는다.
- **발견한 실패:** 첫 개발 호스트 실행에서 공통 자연어 요청 파서가 `u64`의 숫자 부분을 두 번째 값으로 오인해 변경안 준비가 실패했다. Rust 숫자 추출 경로와 한/영 회귀 검사를 추가한 뒤 같은 native 경로가 통과했다. UI 확인에서는 마지막 `match` 식이 statement wrapper 때문에 표시되지 않는 것을 발견해 세미콜론 유무와 실제 블록 위치를 반영했다. 넓은 매개변수·긴 정규 이름·출력 크기도 제한했다.
- **검증:** Rust 회귀 16개를 포함한 핵심 검사 258개, 웹/확장 빌드, Windows VS Code 1.96.4 개발/설치 흐름을 검사했다. 개발 호스트 54개 통과와 첫 설치본 54개를 구분해 공개한다. 첫 설치본은 마지막 식·입력 안내를 포함하지만 후속 출력·이름·매개변수 한도 보완 전이다. production 모드·실제 파일 11개 해시를 대조했다. 같은 흐름의 두 실행을 새로운 108개 기능으로 합산하지 않는다. [개발 기록](evidence/local-ai/rust-source-development-integration.json), [설치 기록](evidence/local-ai/rust-source-installed-integration.json).
- **패키지:** 저장소 밖에서 추출한 worker와 WASM만으로 Rust 파싱·UTF-16/CRLF 위치·큰 정수 수정·오류 구문·코드 삽입 거절을 확인했다. 공개 stable/Pages는 0.6.0이며 이번은 0.7 개발 소스와 로컬 검증 패키지다.
- **화면:** 실제 빌드 UI/worker와 모의 편집기로 한국어 분기·마지막 식, 영어 큰 정수 미리보기·적용 후 표시를 확인했다. 초기 UI 자동 입력에서 IME 문자가 붙어 파서가 거절한 입력은 정확한 DOM 입력으로 다시 확인했다. [한국어](evidence/local-ai/rust-source-reading-ko.jpg), [영어](evidence/local-ai/rust-source-review-en.jpg), [적용 후](evidence/local-ai/rust-source-applied-en.jpg). 이는 설치된 VS Code의 수동 UI 검증이나 실제 모델 품질 평가가 아니다.
- **설치 재실행 실패도 보존:** Rust 전에 기존 Go 분석 존재 assertion이 실패한 시도를 [별도 기록](evidence/local-ai/rust-source-installed-first-failure.json)으로 남겼다. 당시 notice가 출력되지 않아 원인은 확정하지 않았다. assertion에 상태 정보를 추가했고 검사 조건·production timeout은 유지했다. 후속 성공 기록과 합쳐 첫 시도도 통과한 것처럼 표시하지 않는다.
- **언어 서버 대기 개선:** 이후 설치 재실행의 기존 TypeScript 진단 timeout을 [별도 기록](evidence/local-ai/rust-source-installed-diagnostic-failure.json)했다. semantic server가 상위 저장소 의존성을 자동 가져오기 공급자로 읽고 이전 가상 문서를 처리하는 동안 실제 수정 요청이 대기했다. 테스트 프로필의 package.json 자동 가져오기 탐색·타입 자동 취득만 끄고 실제 오류 번호·메시지·원문 위치·60초 제한은 유지했다. 제품 설정·타입 검사기를 바꾸거나 오류를 건너뛰지 않았다.
- **마지막 로컬 설치 상태:** 후속 실행은 확장 호스트가 반복적으로 응답 지연을 보고한 뒤 [작은 JS 예제의 초기 worker timeout](evidence/local-ai/rust-source-installed-startup-failure.json)으로 실패했다. 원인을 단정하거나 제한 시간을 늘리지 않았다. 마지막 한도 보완본은 핵심 258개·추출 패키지 검사 통과, 전체 설치 suite는 아직 미확인이다. 앞선 설치 54개 성공과 분리하고 별도 Windows/Linux CI로 이어간다.
- **남은 작업:** 실제 외부 Rust 프로젝트의 원래 테스트 전후·복구, Linux 패키지 실행, 원격/다른 edition·SDK·환경 검증, 실제 사용자 프로젝트의 일반 모델 수정·설명 품질, 실측 최적화. 이번 합성 검사를 실제 유지보수 성공이나 스타·수요 검증으로 세지 않는다.

## 2026-10-20 · C# 외부 프로젝트 전후 테스트와 BOM 복구

- **실행:** 기존 GuardClauses 고정 checkout을 실제 VS Code 개발 호스트에서 읽고 원문 숫자 선택→native diff→명시적 적용→저장→원래 테스트→native undo→저장→재검사를 수행했다. **959 pass → 952 pass / 7 fail → 959 pass**, 미저장 실행 차단, 원본 바이트 해시·checkout clean을 확인했다. SDK 10.0.402/runtime 10.0.13에서 upstream net8.0 테스트를 Major roll-forward로 실행했다. [근거와 재현](evidence/local-ai/csharp-source-project.md).
- **첫 실패:** 평가 스크립트가 BOM을 포함한 디스크 문자열로 숫자 위치를 계산해 편집기 규칙과 한 글자 어긋났다. 테스트나 코드 적용 전에 `assert.ok(rule)`로 중단됐다. `extension/test/csharpSourceProject.ts`에서 문서 위치·후보 비교는 `doc.getText()`, 디스크 복구는 원본 Buffer로 분리했다. 후속 성공에서 14,045 디스크 문자/14,044 편집기 문자와 BOM 보존을 확인했다. 제품 파서 버그로 오인하지 않고 [첫 실패](evidence/local-ai/csharp-source-project-first-failure.json)를 보존했다.
- **변경·검증:** 검증 스크립트와 fixture 안내, 언어 지원 표, C# 문서, 공개 계획·이력·MIT 고지·원자료를 갱신했다. 확장 TypeScript 검사 통과. 일반 핵심/설치 suite의 이전 결과를 이번 스크립트 수정 후 재실행한 것으로 표시하지 않는다.
- **제품 CI:** 앞선 제품 커밋 `0a95520`의 Windows/Ubuntu 작업 로그에서 각각 핵심 242개, 개발/설치 각 51개, production 모드·파일 9개 해시와 추출된 C# helper를 포함한 도구 실행 성공을 확인했다. [원자료](evidence/local-ai/function-format-ci.json). 이 CI는 새 외부 harness의 BOM 수정을 포함하지 않는다. Linux D-Bus/SIGPIPE 및 인증 대기 진단을 기록하고 runner 성공과 구분했다.
- **한계:** 오류를 주입한 검출 검사이며 실제 upstream 결함이나 모델 의미 정확성·최적화·사용자 실험이 아니다. Rust 전용 읽기/수정과 실제 프로젝트, C# 다른 SDK·수동 UI 등은 남아 있다.
- **다음 Rust 구현의 사전 확인:** 공식 tree-sitter-rust 0.24.2 WASM의 공개 digest와 다운로드 파일을 대조하고 web-tree-sitter 0.27.1에서 6개 단독 입력을 파싱했다. Unicode/CRLF 원문 위치·BOM·raw string·오류 구문을 확인했고 매크로·타입은 의미 검증되지 않음을 확인했다. 별도 시험 설치가 작업 공간 lockfile에 넣은 임시 항목은 복원했다. 제품 dependency와 Rust 지원 상태는 유지하며 [구현 계획](RUST_SOURCE_PLAN.md)에 범위·검증 기준을 기록했다.

## 2026-10-20 · 실제 사용자 함수의 로컬 서식 정리·기존 테스트·복구

- **문제와 구현:** 실제 모델이 반복해서 요청 밖 중괄호를 추가한 서식 과제를 별도 로컬 경로로 다뤘다. `src/core/formatFunction.ts`가 구문 위치에 줄바꿈을 넣고 포함된 TypeScript 5.9.3 언어 서비스로 2칸 들여쓰기를 정리한다. 전체 문법·토큰·구문 구조·주석·범위 밖 원문을 비교하고, 128 KiB·깊이 200 제한을 둔다. 프로젝트 설정/플러그인·모델·사용자 코드를 실행하지 않는다. 함수 ID를 서버에서 원문과 대조하고 worker 안에서 처리한다.
- **제품 흐름:** `ReadingView.tsx`의 선택 함수 버튼 → `RuleWorkbench.tsx`의 한국어/영어 검토 → native diff → 명시적 적용을 연결했다. 확장 호스트도 미리보기 전 적용을 거절한다. 무변경 안내·문서 변경 시 무효화·자동 저장 없는 한 번의 undo를 확인했다. [사용 방법](FUNCTION_FORMATTING.md).
- **실제 사용자 프로젝트:** 별도 고정 checkout의 실제 JS 함수를 검토·적용했다. 원래 테스트 **8 통과 → 적용/저장 후 8 통과 → native undo/저장 후 8 통과**, 원문 해시 일치와 checkout clean을 확인했다. 결함을 주입하지 않았다. 이전 모델 실패는 그대로 보존하며 설명/입력 전제 부분과 최적화는 이 결과로 해결됐다고 하지 않는다. 구현한 에이전트의 검토이며 제3자 검증이 아니다. 비공개 상세 자료는 로컬에 보존한다.
- **검증:** 핵심 **242개**, 웹·확장 타입 검사/빌드, 실제 VS Code 개발 호스트 **51개** 흐름 통과. 실제 확장 UI/worker를 공개 예제로 조작해 한국어/영어 적용 차단·검토 후 활성화·적용 갱신·무변경 안내를 확인했다. UI harness의 편집기는 시뮬레이션이며 native 테스트와 구분했다. 첫 fixture의 테마 값 누락과 포트 충돌을 수정했다. `scripts/preview-function-format.mjs`로 재현 가능하다. React 체크리스트로 상태 파생, 비동기 결과의 문서/변경안 ID 대조, semantic button과 포커스를 검토했다. [근거 및 남은 범위](evidence/local-ai/function-format.md).
- **설치본 후속:** 별도 프로필에 설치한 0.7.0 VSIX의 production 모드·실제 파일 9개 해시를 확인하고 같은 **51개 흐름**을 통과했다. C# 런타임 포함도 확인했다. [설치 기록](evidence/local-ai/function-format-installed-integration.json). 개발/설치는 같은 검사이며 새로운 102개 기능으로 세지 않는다.
- **제약:** 설치본의 새 화면 수동 조작·모든 테마/화면·실제 사용자 수행은 미검증이다. 고정 2칸 서식이며 모든 JS/TS 문법·런타임 의미 보장도 아니다. 기존 안정판/Pages 0.6.0은 교체하지 않는다.

## 2026-10-20 · 사용자가 선택한 서식 변경 제한과 실제 적용 차단

- **구현:** `src/core/localAssistant.ts`에 명시적 `whitespace-only` 요청·지원 범위 검사·비교 결과 판정을 추가했다. `LocalAssistant.tsx`의 한국어/영어 선택 항목으로 JS/TS 계열 수정에서만 설정하며, `localAssistantController.ts`가 해당 요청의 제한을 제안에 고정한다. 코드·문자열·주석·구조가 달라지거나 비교 불가이면 native diff 검토 후에도 호스트가 적용을 거절한다. 일반 수정·최적화에는 제한을 몰래 적용하지 않는다.
- **실제 프로젝트 재검사:** 앞선 사용자 프로젝트의 동일 소스·요청·3B 모델에 제한을 켜고 실제 편집기에서 실행했다. 55.826초에 온 후보는 앞서 거절한 후보와 바이트가 같았다. 실제 호스트의 적용 거절과 원문 보존을 확인했다. 여전히 요청을 만족하는 수정은 아니며, 검토 거절 때문에 평가 harness도 실패로 종료했다. 실패를 성공 편집으로 바꾸지 않는다. 비공개 자료는 로컬에 보존한다.
- **검증:** 전체 핵심 **234개**, 웹·확장 타입 검사 및 빌드가 통과했다. [검증 기록](evidence/local-ai/whitespace-constraint.md)에 실제 VS Code 개발 호스트 **49개** 흐름, 제한 위반 차단·허용된 서식 변경의 적용/undo, 한국어/영어 실제 React 화면 조작을 구분해 기록했다. 화면과 통합 검사의 모델 답변은 controlled fixture이며 실제 모델 품질 평가와 별개다. 공개 `scripts/preview-local-assistant.mjs`로 화면 사례를 재현할 수 있다. 새 설치본·모든 테마/화면 크기·실제 사용자 사용성 검증은 미완료다.
- **검증 과정의 문제:** 브라우저 harness의 일부 밝은 테마 변수 누락으로 어두운 기본 배경이 섞여 대비가 낮았다. harness 테마를 보완한 뒤 다시 확인했으며 제품 색상 수정 성과로 세지 않는다. 자동 입력의 IME 잔여 문자와 label 선택기 실패는 실제 DOM 역할 기반 입력으로 다시 확인했다. API 로그·접근성 상태·JPEG 원본을 보존했다.
- **남은 작업:** 제한 위반을 막는 기능은 원하는 변경을 완성하는 기능과 다르다. 실제 요청의 수정 품질·설명 정확성, Rust/C# 후속 범위, 다른 환경 검증과 실측 최적화를 계속 수행해야 한다. 전체 목표는 진행 중이다.

## 2026-10-20 · 실제 수정 실패를 바탕으로 원문 비교 보강

- **실패를 남김:** 같은 실제 사용자 프로젝트·원문·요청·모델의 진단 반복은 기존 180초 제한에 도달했다. 편집 안내를 보강한 다음 응답은 문법·인용 검증을 통과했지만 요청 밖 중괄호 추가와 잘못된 들여쓰기로 검토에서 거절했다. 실제 native diff 생성까지만 확인했으며 적용·변경 후 검사·undo 성공으로 세지 않는다. 비공개 요청·응답·후보·거절 이유는 ignored 로컬 보고서에 보존했다.
- **요청 안내:** 서식 변경 요청과 요청 범위 밖 서식 보존을 구분하고, 편집 요약의 범위를 줄이며 변경 전후가 같은 항목을 만들지 않도록 명시했다. 원래 최초 거절의 응답은 없어 원인을 확정하지 않았고, 후속 제안도 요청을 만족하지 못했으므로 안내 개선을 모델 품질 해결로 주장하지 않는다.
- **제품 보강:** JS/TS/JSX/TSX 변경안에서 원본과 제안의 토큰 원문·구문 구조·주석 내용/위치·중괄호 수를 비교하여 검토 화면에 한국어/영어로 표시한다. 생성 중 경과 시간도 표시한다. 파싱할 수 없는 원문은 비교 미제공으로 표시하며 다른 언어에는 이 비교를 제공하지 않는다. 요청 의도·실행 결과 동일성 판정이나 자동 승인 기능은 아니다.
- **경계 사례 수정:** JSX 앞부분·공백만 있는 텍스트를 파서의 `getText()`로 읽으면 내용 공백이 잘릴 수 있어 원문 범위를 사용한다. 코드 토큰이 같을 때 주석의 상대 위치도 대조해 주석 이동을 공백 변경으로 표시하지 않는다. 실제 후보 재검사에서 앞쪽 코드 삽입만으로 뒤쪽 주석 내용까지 바뀌었다고 표시하는 오탐을 발견해 내용과 위치 비교를 분리했다. 문자열·템플릿·정규식·JSX·자동 세미콜론 삽입·주석·잘못된 문법을 검사했다.
- **검증:** 전체 핵심 **232개** 통과, 웹·확장 타입 검사와 번들 빌드 통과. [개발 호스트 통합 기록](evidence/local-ai/change-facts-development-integration.json)의 **47개** 흐름에는 모델이 서식 변경이라고 주장해도 실제 중괄호/구조 차이를 전달하고 원본은 바꾸지 않는 검사가 포함된다. 이 통합 검사의 모델 응답은 controlled HTTP fixture이며 실제 모델 품질 근거가 아니다. 저장된 실제 실패 후보는 별도로 빌드된 제품 worker에 다시 넣어 차이를 확인했다. 재검사는 새 모델 응답이 아니다.
- **남은 범위:** 실제 사용자 프로젝트에서 요청을 충족하는 AI 수정의 전체 흐름, 다른 언어 비교, 새 화면의 직접 조작·사용성·설치본 검증, 모델 설명 정확성·실측 최적화는 미완료다. 공개 안정판·브라우저 데모를 새 기능이 배포된 것으로 표시하지 않는다.

## 2026-10-20 · 사용자 실제 프로젝트 평가와 설명 문구 수정

- **사용자 요구 반영:** 고정 예제·의도적 오류 검사만으로 실사용을 판정하지 않고, 사용자가 직접 지정한 프로젝트의 기존 코드·기존 검사·실제 유지보수 과제를 평가하도록 [평가 절차](REAL_PROJECT_EVALUATION.md)를 추가했다. 기존 P0–P6를 축소하거나 대체하지 않는다.
- **실제 평가:** 지정 저장소의 GitHub 버전과 로컬 미커밋 작업을 구분하고 별도 고정 복사본에서 분석·기존 검사·실제 로컬 모델 요청을 실행했다. 비공개 저장소임을 API metadata로 확인했으므로 원문·자세한 평가 결과·재현 입력은 ignored 로컬 자료에만 보존한다. 이 공개 문서는 상세 비공개 증거를 대신하는 성공 인증이 아니다.
- **실패 보존:** 모델이 무변경 편집 항목을 반환해 기존 검증기가 적용을 거절했다. 이 사례는 수정 성공으로 집계하지 않는다. 실제 diff·적용·변경 후 검사·undo까지는 도달하지 못했으며, 결과를 좋게 보이게 하려고 오류를 삽입하거나 거절 규칙을 낮추지 않았다. 긴 파일의 설명 생략과 기계적인 수식 설명도 미완성으로 기록했다.
- **제품 수정:** `src/core/analyze.ts`에서 함수 값을 무조건 ‘나중에 실행’한다고 읽힐 수 있는 한국어/영어 표현을 고쳤다. 호출하는 코드가 실행 시점을 결정한다고 표시하여 동기 callback의 지연 실행을 암시하지 않는다. 실제 대상 소스의 새 설명도 대조했다.
- **검증:** 관련 기존 `tests/core.test.ts`, `tests/jsx.test.ts` **68개**와 확장 타입 검사·번들 빌드가 통과했다. 사용자 프로젝트의 검사 결과와 제품 회귀 검사 개수를 합산하지 않는다. 평가자는 Codex이며 독립 제3자나 비개발자 사용자 실험으로 부르지 않는다.
- **배포 소스 점검:** 이미 커밋된 확장 화면이 참조하는 `journey.css`가 추적되지 않아 저장소만으로 빌드할 수 없었다. 필요한 파일을 `7126a58`에 포함하고 해당 커밋의 파일만 별도 archive로 추출해 확장 타입 검사·번들 빌드를 확인했다. 진행 중인 다른 화면 수정까지 이 검증으로 완료 처리하지 않는다.
- **남은 작업:** 모델 실패 원인·요청 개선, 실제 유지보수 변경의 전체 적용 흐름, 도메인별 기존 검사, 사용자 직접 조작, 성능 측정. 비공개 코드 공개나 사용자 프로젝트 자동 배포를 하지 않았다. 전체 목표는 진행 중이다.

## 2026-10-17–20 · C# Roslyn 개발 증분과 검증 중 발견한 문제

- **구현:** 고정 `PureobomCSharpSource.cs`와 별도 프로세스 host, .NET SDK 설정, controller·로컬 AI 문법 검사·한국어/영어 값 편집을 연결했다. [C# 범위](CSHARP_SOURCE.md)에 파싱과 타입/프로젝트 검사의 차이, 조건부 컴파일·프로퍼티 등 미지원 범위를 명시했다. SDK runtime-only 환경을 구별한다.
- **결함 수정:** 첫 검사에서 Windows UTF-8 콘솔 설정과 자연어 숫자 접미사 보존 문제가 드러나 고쳤다. 입력을 컴파일·실행하지 않는 실제 module initializer/constructor/entry point 검사도 추가했다. SDK 10.0.402/runtime 10.0.13을 ignored 폴더에 공식 SHA-512 확인 후 준비했다.
- **핵심 검사:** 전체 **226개 통과**를 확인했다. 앞선 병렬 실행의 기존 Python 검사는 시간 제한 1건이 있었고, 다른 무거운 빌드와 겹치지 않게 `--maxWorkers=2`로 재실행했다. 이를 새 최적화 성과로 해석하지 않는다.
- **편집기 검사 중 문제:** 기존 TypeScript 진단 검사와 프로젝트 검사에서 native undo가 소스 편집기 대신 보존된 panel/terminal 초점으로 전달됐다. 로그의 원문 미복구를 확인하고 해당 테스트에서 소스를 명시적으로 focus한 뒤 undo하도록 보정했다. 원본 복구 assertion을 유지한다. 새 설치본·전체 CI·C# 수동 화면 결과는 별도 검증 전까지 성공으로 표기하지 않는다.
- **후속 개발 호스트 결과:** 위 초점 보정 후 Windows/VS Code 1.96.4에서 [46개 통합 흐름](evidence/local-ai/csharp-source-development-integration.json)이 통과했다. C# 실제 SDK 읽기·원문 위치·정확한 값 변경·native diff·적용·undo·SDK 실패/복구·AI fixture 문법 차단을 포함한다. 로컬 작업 트리의 개발 빌드이며 새 설치 VSIX·깨끗한 커밋의 CI 또는 실제 모델 정확성 근거와 구별한다.
- **외부 준비:** 고정 GuardClauses 원래 net8.0 테스트의 초기 기준선은 959개 통과했다. SDK 10/runtime roll-forward 환경이며 .NET 8 runtime 실행 인증이 아니다. 실제 값 변경→실패 검출→undo 흐름의 스크립트와 [재현 방법](../scripts/fixtures/guardclauses/README.md)을 작성했으나 아직 그 전체 실행 성공 근거는 없다. 사용자 요청으로 실제 사용자 프로젝트 평가를 우선했다.

## 2026-10-17 · SQL 설치 화면 검증과 언어 안내 보정

- **교차 운영체제:** 기능 커밋 `3b1aa4d93363b651a092055a0d84766b23534979`의 [Windows·Ubuntu CI](https://github.com/him55710-sudo/pureobom/actions/runs/38899949436)가 모두 성공했다. 로그에서 각 핵심 217개, 개발/설치 각 43개, production 모드·런타임 8개 해시와 추출 도구 5종 성공을 대조해 [CI 원자료](evidence/local-ai/sql-source-ci.json)로 보존했다. 외부 sqlc와 수동 UI를 이 수에 더하지 않는다.
- **실제 설치 화면:** [SQL 네이티브 기록](evidence/local-ai/sql-source-native.md)에서 방언 미선택→SQLite, 한국어/영어 구조 설명, L2 이동, 한국어 50000→70000 변경안·diff·적용·Ctrl+Z를 확인했다. 별도 복사본의 편집기 전체와 디스크 원문이 복구됐고 dirty=false다. 화면 밖 접근성 버튼 두 차례 실패, 좁은 편집기의 긴 줄, SQL 언어 서버 없는 진단 대기도 공개했다.
- **발견 후 수정:** `extension/ui/main.tsx`에서 한국어 Rules의 영어 제목과 SQL의 모호한 영어 `full table name`을 보정했다. 규칙 변경 diff의 현재 UI 언어를 RPC→controller로 전달해 제목의 설명도 같은 언어로 표시한다. 기존 호출의 기본 한국어는 유지하며 잘못된 RPC 언어 값은 거절한다. 위 수동 화면의 설치본과 이 후속 수정본은 다른 해시다.
- **수정본 검증:** 확장 타입 검사·번들 빌드 후 새 VSIX `1cd0c719…`의 [설치 통합 43개](evidence/local-ai/sql-source-localization-installed.json)가 통과했다. production 모드·런타임 8개 해시를 확인했고, 별도 [실제 VS Code 탭 제목 검사](evidence/local-ai/sql-source-localization-titles.json)에서 한국어 `숫자`/영어 `number` 설명과 원문 무변경을 확인했다. 제목 검사는 controller API 방식이며 수동 클릭 재검증으로 세지 않는다.
- **증거 자료 정정:** 앞선 Java 화면 5개의 실제 형식은 JPEG였는데 PNG 확장자와 잘못 읽은 크기를 기록했다. 원래 바이트·해시는 유지하고 `.jpg`, MIME와 실제 프레임 크기로 정정했다. SQL 화면도 실제 JPEG 형식으로 보존했다. 이 정정은 새 제품 검증 성공으로 세지 않는다.
- **남은 범위:** 전체 UI 지역화·접근성·브라우저 실제 SQL 가져오기·Rust/C#·다른 SQL 방언·모델 의미 정확성·실측 최적화는 계속 남는다. 공개 데모와 안정판은 0.6.0이며 목표 P0–P6를 완료로 바꾸지 않았다.

## 2026-10-16 · 명시적 SQLite 분석과 실제 sqlc 재생성·테스트 연결

- **범위:** P2/P3/P4/P6의 SQL 빈칸을 SQLite부터 보강했다. [사용법·한계](SQL_SOURCE.md), [외부 프로젝트](evidence/local-ai/sql-source-project.md), [재현 스크립트](../scripts/fixtures/sqlc/README.md). 모든 SQL 방언·모델 정확성·최적화·전체 목표 완료를 뜻하지 않는다. 공개 안정판과 Pages는 0.6.0이다.
- **구현:** `src/core/sqlSource.ts`에 MIT `sqlite3-parser@0.7.1`(SQLite 3.53.0 문법)을 포함했다. 전체 원문 파싱과 제한된 AST 구조, 한국어/영어 설명·위치·생략 안내를 제공한다. 128KiB·400 AST·12단계·300값·4096자 한도를 명시했다. 사용자 SQL이나 DB 연결은 실행하지 않는다.
- **방언 선택:** 기본은 미선택. 현재 SQL 문서에서 SQLite를 명시적으로 선택하며, 캐시 키와 worker 요청에 방언을 포함했다. VS Code는 문서별 WeakMap, 브라우저는 파일 metadata를 사용한다. 다른 문서에 자동 적용하지 않고 방언 변경 시 일반/AI 변경안을 무효화한다. 선택한 방언을 모델 지침과 제안 문법 검사에 전달한다.
- **수정:** 숫자 원문을 Number로 변환하지 않고 문자열 따옴표를 SQL 규칙으로 인코딩한다. 변경 후 전체 파싱과 동일 위치·종류 리터럴을 확인한다. 매개변수·식별자·NULL·blob·주석 사이 부호 등은 제외했다. 실제 Node 24.19.0/SQLite 3.53.3 엔진으로 SQL 문장을 담은 문자열 비실행과 큰 정수 보존을 확인했다.
- **발견한 문제:** 기본 파서가 `_` 숫자 구분자를 비활성화해 거절했으므로 명시적으로 켰다. CR을 `--` 주석 종료로 가정했던 테스트 입력은 SQLite 규칙에 맞게 수정했다. 외부 기록 검토에서 INSERT/DELETE 위치가 앞 주석을 가리킨 것을 발견해 파서의 토큰 위치로 보정하고 회귀 검사를 추가했다. DELETE의 WHERE도 적용 가능한 '조건이 참인 행이 대상'으로 설명을 고쳤다. LIMIT의 쉼표형과 OFFSET형을 같은 count/offset 의미로 표시한다.
- **검증:** 초기 전체 핵심 216개와 개발 호스트 43개 통과, 마지막 위치 보정 후 SQL 전용 9개 통과. [개발 기록](evidence/local-ai/sql-source-development-integration.json)은 위치 보정 전이다. [설치 기록](evidence/local-ai/sql-source-installed-integration.json)은 별도 production 실행·런타임 해시를 기록한다. 동일 43개 흐름을 두 배의 기능 수로 합산하지 않는다. AI 응답은 controlled HTTP fixture이며 새 모델 추론 사례가 아니다. 첫 SQL fixture가 한국어 요청에 영어 reason을 보내 거절됐고, 응답을 한국어로 수정했다. 제품의 언어 검증을 우회하지 않았다.
- **외부 연동:** sqlc 고정 커밋 `c69308b521a50f92fee48ae623702c5550c49d95`, 공식 sqlc 1.31.1로 현재 SQL을 Go로 재생성하고 기존 TestAuthors를 실행했다. 1 pass → `LIMIT 0`으로 1 fail → native undo·저장 후 1 pass. 미저장 검사 거절, 원본 SQL hash와 깨끗한 checkout 복구를 확인했다. 예제 테스트 한 개의 한계와 examples 모듈/sparse checkout 준비 실패를 공개했다. 생성된 Go 상수를 수동으로 바꾼 검사가 아니다.
- **패키지·화면:** 라이선스 고지를 포함하고 추출한 Worker에서 SQLite 파서 실행을 검사했다. 최종 위치 보정 후 새 VSIX `5e907fe1…`의 production 모드·런타임 8개 hash·43개 흐름도 통과했다. React 스킬의 UI 파서 분리·파생 상태·label/select·안정된 key·원문 escaping을 검토했다. 브라우저 가져오기 허용 목록에서 SQL이 빠져 있던 것도 발견해 파일 선택기/필터에 추가하고 실제 File→readFiles→분석 검사를 넣었다. 한국어/영어 정적 렌더링과 실제 편집기 통합은 확인했지만 SQL 화면의 수동 클릭·좁은 화면·접근성 검토는 아직 남았다.
- **남은 범위:** Rust/C#, 다른 SQL 방언·DB 스키마·전체 식 설명, 모델 의미 오류, 실측 최적화와 추가 환경 검증. 공개 상세 기획의 P0–P6를 완료 처리하지 않는다.

## 2026-10-16 · Java 파서·정확한 값 수정·실제 라이브러리 회귀 검사

최종 기능·CI 설정 소스 `3ecae6e35a31e3d0a87d17b4cf4ed5d9b1a0db7b`의 [Windows·Ubuntu CI](https://github.com/him55710-sudo/pureobom/actions/runs/38895781582)가 양쪽 모두 성공했다. 각 핵심 **208개**, 개발/설치 각 **41개**, production 모드·런타임 8개 해시·추출 도구 5종을 로그에서 대조하여 [원자료](evidence/local-ai/java-source-ci.json)로 보존했다. 외부 minimal-json과 수동 native UI는 별도 Windows 실행이며 같은 성공 수에 합치지 않는다.

- **공개 CI 준비 실패:** 기능 커밋 `368134a91b65ac055488b93199c8f20cba6d04df`의 [첫 Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38895575908)는 Windows JDK 설치에서 실패했다. `setup-java`가 `25.0.4.1`을 `25.0.4+1`로 해석했지만 Adoptium API의 실제 버전 표기는 `25.0.4+101.0.LTS`였다. 로컬 다운로드 metadata와 설치 로그의 available versions를 대조해 CI와 수동 demo workflow의 고정 버전 입력을 해당 API 표기로 수정했다. 이 실패는 제품 테스트 성공으로 집계하지 않는다.
- **목적·범위:** P2/P3/P4/P6의 Java 빈칸을 보강했다. [Java 사용법과 한계](JAVA_SOURCE.md), [외부 minimal-json 원자료](evidence/local-ai/java-source-project.md)를 공개한다. 전체 목표 완료, 모델 정확성 또는 최적화 성공으로 세지 않는다. 안정판과 Pages는 0.6.0 그대로다.
- **제품 구현:** `PureobomJavaSource.java`의 JDK 표준 `JavacTask.parse`, `javaSource.ts`의 별도 프로세스·고정 helper 캐시·한도/취소, controller·AI 제안 문법·KO/EN UI·JDK 설정을 연결했다. 사용자 소스는 컴파일/실행하지 않고 클래스·소스·annotation processor 검색을 배제했다. 타입·의존성·실행 결과 미검증을 명시한다.
- **원문 수정:** UTF-16 위치, 한글·emoji·CRLF/CR/LF, Java escape·큰 정수·진법·접미사 보존을 확인했다. 단일 값 교체 후 재파싱하며 문법이 맞아도 타입이 틀릴 수 있음을 검사한다. text block/문자/null/주석 숫자식/Unicode 토큰 경계 등은 직접 수정에서 제외한다.
- **실제 발견한 결함:** 첫 편집기 테스트에서 자연어 요청이 long의 `L`을 잘라 파싱 오류가 됐다. `ruleRequest.ts`에 Java 숫자 표기 보존을 추가하고 실제 파서와 편집기 회귀 검사로 확인했다. 미완성 초안의 validator setter도 생성자 주입으로 정리했다.
- **로컬 검증:** 수정 후 핵심 **208개**, 실제 개발 호스트 **41개**, 설치 VSIX **41개** 통과. [개발 기록](evidence/local-ai/java-source-development-integration.json), [설치 기록](evidence/local-ai/java-source-installed-integration.json). 같은 41개 흐름의 두 실행 방식이며 82개 기능으로 합산하지 않는다. AI HTTP 응답은 controlled fixture다. 설치본은 production 모드와 런타임 8개 해시를 대조했다. 이 로컬 설치본 hash `bb0aa7ec…`는 후속 README/자료 갱신 전 패키지다.
- **외부 프로젝트:** minimal-json commit `5518c876226ae07f8291d6b41209bc3c979f4a55`, Temurin 25.0.4.1+1, VS Code 1.96.4/Windows에서 452 pass → 고정 숫자 오류로 13 fail → native undo·저장 후 452 pass. 원본 SHA-256·깨끗한 checkout 복구, 미저장 검사 차단과 실제 task exit 0/1/0을 확인했다. upstream 라이브러리 테스트 전부를 실행했지만 Maven 전체 빌드·성능 모듈은 별개다.
- **외부 준비 실패:** 테스트 하위 패키지를 잘못 붙인 ClassNotFoundException을 고쳤다. 원래 Mockito로 최신 JDK에서 첫 기준선 447 pass/5 fail; 별도 테스트 JVM의 java.io 접근 호환 설정을 추가하여 452 pass. 두 실패와 원래 경고를 원자료에 보존했다. 사용자 제품 JVM은 이 호환 설정을 사용하지 않는다.
- **도구·재현:** Adoptium API의 Windows JDK ZIP SHA-256 `00c847d804f4a78e9f04f2683faf14fed898535b177b7fc704486cb0284e9283` 확인 후 ignored 폴더에 설치했다. 시스템 PATH/JAVA_HOME은 바꾸지 않았다. Google Java Format 1.37.0 공개 배포 hash를 확인하여 helper를 정리했다. 두 도구와 외부 jar는 배포물에 포함하지 않는다. CI에는 Temurin 25.0.4.1 준비를 추가하고, 패키지 검사는 추출 Java helper의 독립 실행을 추가했다.
- **수동 설치 화면:** [한국어/영어 설명·원문 이동·값 입력·Java diff·적용·undo](evidence/local-ai/java-source-native.md)를 실제 Windows 입력으로 확인했다. 시험용 버퍼의 임시 필드 추가도 undo하여 원본으로 복구했다. 원래 return 식의 리터럴은 직접 수정 목록에 없고, 영어 native diff 제목에 한국어가 남으며 좁은 분할 화면에서 긴 줄이 가려지는 제약을 기록했다.
- **남은 범위:** 영어 diff 제목 지역화·원문 수정 범위와 좁은 화면 개선, 다른 JDK/OS 외부 프로젝트, 전체 타입/의미 분석, Rust/C#/SQL 전용 도구·실제 사례, 모델의 의미 오류와 실측 최적화는 계속 남는다. 이 절의 로컬 결과를 교차 운영체제 결과로 주장하지 않는다.
- **패키지 독립 실행:** 최종 문서 포함 VSIX 1,364,260 bytes, SHA-256 `0d9906092814e399034f70fb129463939f5248cf39e86eff311e3e7521e4ad3c`. `release:check`가 분석 Worker·Python 측정·Python AST·Go AST·새 Java AST를 저장소 밖에서 실행하고 읽기/정확한 수정과 manifest/checksum을 확인했다. source/demo ZIP도 생성했다. 실제 UI 수동 조작은 이 자동 검사에 포함하지 않는다.

## 2026-10-16 · 실제 외부 HTML/CSS 프로젝트와 반복 검사 복구

공개 소스·검증 도구 커밋 `493cd04f1b635205201fd6d91ef3708f65a48650`를 `origin main`에 push했다. [Windows·Ubuntu Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38891611946)는 각각 핵심 **200개**, 개발/설치 각 **38개**, production 모드·런타임 7개 해시와 추출 도구 실행에 성공했다. [CI 원자료](evidence/local-ai/web-project-ci.json). 외부 Chrome의 54개 검사는 이 자동 검사에 포함되지 않으며 Windows에서 별도로 수행한 자료다. 이 후속 문서 커밋은 위 소스 커밋의 결과를 가리킨다.

- **대상과 목적:** [modern-normalize v3.0.1](evidence/local-ai/web-source-project.md), 소스 commit `3faa07fc91b8ffbe6243bc4f91e880a00185d0a2`에서 P2/P3/P4의 원문 읽기·값 수정·실제 브라우저 검사·undo를 연결했다. HTML은 읽기만, CSS는 고정된 의도적 오류를 적용했다. 모델/최적화 성공이나 전체 P0–P6 완료로 세지 않는다.
- **공개 구현:** `scripts/run-modern-normalize-tests.mjs`, `scripts/test-web-source-project.mjs`, `extension/test/webSourceProject.ts`, 외부 fixture의 pnpm 잠금 파일·재현 안내. 제품 런타임 의존성을 늘리지 않고 opt-in 검사로 분리했다. 전체 원자료·양언어 트리·정확한 범위·라이선스를 공개했다.
- **준비 실패:** 부모 workspace 때문에 첫 pnpm 명령은 외부 의존성을 설치하지 않았다. 명시적 외부 경로와 `--ignore-workspace --prod=false --ignore-scripts`로 557개 패키지를 설치했다. upstream 범위 버전의 최초 해석 결과를 잠금 파일에 보존했고 이후에는 frozen 설치로 재현한다. 7개 전이 패키지의 deprecation 경고가 있었다.
- **원본 결과:** 필터 없는 원본 Chrome 테스트 54개는 **47 pass·7 fail**. 8개는 assertion 없는 TODO다. 스타일 직렬화·접두어 속성·원본 기대값 차이를 숨기지 않았으며 원본 실패를 수정 후 회귀로 세지 않았다. Firefox/Safari/stylelint/test:all은 이번 사례에서 실행하지 않았다.
- **실행기 종료 결함:** 첫 독립 실행은 JSON exitCode 1에도 실제 프로세스 종료가 0이었다. TestCafe의 async-exit-hook 1.1.2가 beforeExit의 코드를 0으로 덮는 원인을 읽고, 정리·기록 후 명시적으로 종료하도록 adapter를 고쳤다. 실제 task와 JSON 종료 코드를 대조해 확인했다.
- **브라우저 반복 실행 결함:** 편집기 첫 시도와 다음 시도의 변경본에서 Chrome 연결 2분 제한으로 실패했다. 전용 임시 프로필을 재사용하면서 이전 Chrome이 남는 것을 확인했다. Electron crashpad pipe 상속 제거, 매 실행 별도 임시 경로, Windows에서 그 경로에 속한 Chrome만 종료하는 정리를 추가했다. 두 실패 보고서도 원자료에 보존했다.
- **최종 실제 흐름:** VS Code 1.96.4/Windows/Chrome 155에서 HTML 표시 81개, CSS 표시 51개·수정 가능 값 31개를 읽었다. `border-box→content-box`의 native diff·정확한 범위 적용·자동 저장 없음·미저장 검사 차단 후 **47 pass/7 fail → 45 pass/9 fail → undo 후 47 pass/7 fail**. 추가 실패는 box-sizing과 hr 높이다. 세 task 모두 exit 1이며 harness는 원래 실패 집합과 파일 해시 복구를 확인해 exit 0으로 끝났다.
- **복구·검증 범위:** CSS 원본 SHA-256 복구, 임시 tasks.json 제거, 기존 untracked pnpm 잠금만 남음을 확인했다. 최종 서버 8080과 해당 테스트 Chrome은 남지 않았다. 확장 TypeScript/번들 빌드, 새 스크립트 문법 검사를 통과했다. 외부 브라우저 실행은 Windows 한 조합이며 앞선 Windows·Ubuntu 제품 CI와 별도다.
- **패키지:** 소스 ZIP을 새 기록과 재현 도구까지 포함해 재생성했다. 첫 release:check는 현재 셸 PATH에 Go가 없어 기존 Go 패키지 검사에서 실패했다. 검증용 Go 1.27.2 경로를 해당 명령 환경에만 추가한 뒤 체크섬·manifest·라이선스와 추출 분석/Python 측정/Python AST/Go AST 실행을 모두 통과했다. VSIX는 기존 `88761109…`와 동일하며 제품 런타임을 변경한 배포가 아니다.
- **문서:** 상세 기획의 누적된 중복 상태 문단을 현재 기능·근거·남은 우선순위로 정리했다. 역사적 근거는 이 기록과 기존 자료에 보존했다. README 양언어·언어 지원 표·HTML/CSS 안내·프로젝트 검사 안내에 성공 범위와 남은 실패를 연결했다. 공개 안정판/Pages는 변경하지 않았다.

## 2026-10-16 · HTML/CSS 원문 파서와 값 수정

기능 소스 `20de7143a8dcacef6e5e535ae5bfa1dc6b73cf55`의 [Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38888312338)에서 Windows·Ubuntu가 모두 성공했다. 각 핵심 **200개/21파일**, 개발/설치 각 **38개**, production 모드·런타임 7개 해시, 추출한 분석/Python 측정/Python AST/Go AST 도구 실행 성공을 실제 로그에서 대조했다. [정규화한 CI 원자료](evidence/local-ai/web-source-ci.json). 후속 문서 커밋은 이 기능 커밋을 가리키며 안정 릴리스/Pages는 변경하지 않았다.

마지막 CSS 주석/식별자 수정 후 [최종 로컬 설치본](evidence/local-ai/web-source-final-installed-integration.json)에서도 **38개**가 통과했다. VSIX `8876110903dd7db930c982191383cca01e0ec7d1b4e2ec0930bc867e5dab1064`, production 모드·런타임 7개 해시를 확인했다. 최종 패키지는 1,353,584바이트이며 release:package/release:check의 체크섬·추출 Worker/도구 실행도 성공했다. 공개 기능 소스는 `20de7143a8dcacef6e5e535ae5bfa1dc6b73cf55`로 `origin main`에 push했다.

- **문제와 범위:** 실제 모델의 CSS 열 개수 설명 오류에 대응해 HTML 태그·속성·문구와 CSS 선택자·앳 규칙·선언 값을 원문에서 읽는 경로를 추가했다. 브라우저/VS Code 공통 Worker이며 API·모델·별도 언어 실행기가 필요 없다. 렌더링·접근성·캐스케이드·외부 웹 프로젝트의 동작 검증은 남아 있다.
- **구현:** `src/core/webSource.ts`, analyze/edit/assistantValidation/types, 공유 Story/InterfaceTree, 브라우저·확장 입력 안내와 untitled 확장자 매핑. parse5 8.0.1과 CSS Tree 3.2.1 및 전이 의존성의 라이선스를 패키지에 포함했다. 입력은 실행/렌더링하지 않고 URL도 가져오지 않는다. 요소/값 범위는 UTF-16 위치로 연결한다.
- **직접 수정:** 일반 HTML 텍스트와 일부 텍스트 속성은 엔티티/따옴표 인코딩, CSS는 값 하나의 파싱과 제한적인 속성 문법 검사 후 정확한 범위만 교체한다. script/style/특수 텍스트/SVG/MathML/template, 모호하게 합쳐진 텍스트, 값 내부 주석은 수정 제외다. CSS 우선순위·다른 선언·주변 공백은 유지한다. 반복 선언 식별자에 닫는 구분자를 넣어 짧은 위치가 긴 위치 이름과 겹치지 않도록 했다.
- **한도/오류:** 128 KiB, 표시 300개·12단계, 미리보기 240자, 수정 입력 4096자. HTML doctype 생략 외 파서 진단은 수정 차단, CSS는 오류 복구 콜백과 토큰 닫힘 검사를 결합한다. 파싱 성공을 문서 적합성·모든 속성값의 유효성이나 실제 화면의 정확성으로 표현하지 않는다.
- **발견/수정:** 초기 핵심 검사에서 CSS 값 위치가 주변 공백을 포함해 2개 실패했다. 실제 값 범위만 선택하도록 수정했다. 다음 검사에서 앳 규칙 표시의 끝 공백 기대값이 실패해 표시 제목을 정리했다. 실제 VS Code에서는 CSS Tree ESM의 `createRequire(import.meta.url)`이 묶인 CommonJS Worker에서 실패했다. 빌드에서 CSS Tree의 정적 require 엔트리를 선택해 데이터까지 번들했고 실제 개발 호스트 검사가 통과했다. 성공 결과만 골라 원인 없이 집계하지 않는다.
- **핵심/빌드:** HTML/CSS 15개를 포함한 핵심 **200개/21파일**, 웹/확장 빌드 통과. 마지막 검토에서 문자열 속 `/* … */`를 실제 주석으로 오인한 제한을 파서 주석 위치로 수정하고, 반복 선언 주소의 접두어 충돌 회귀를 추가했다. 해당 15개가 다시 통과했다. `docs/benchmark.json`은 기존 합성 회귀 측정이며 HTML/CSS 속도 개선 증거가 아니다.
- **실제 편집기/패키지:** [개발 38개](evidence/local-ai/web-source-development-integration.json), [설치 38개](evidence/local-ai/web-source-installed-integration.json) 통과. 원문 이동, native HTML/CSS diff, 정확한 값/엔티티 수정, 적용/재분석/undo, 사용한/오래된 변경안·CSS 선언 탈출 거절 확인. 설치본은 production 모드와 런타임 7개 해시를 대조했다. 같은 38개 흐름을 76개 제품 기능으로 세지 않는다. 저장소 밖으로 추출한 Worker에서 JSONC/HTML/CSS 파서를 실행하고 기존 Python 측정/Python AST/Go AST 도구도 확인했다.
- **실제 UI:** [설치 화면 기록](evidence/local-ai/web-source-native.md)의 한국어/영어 CSS 설명, 12px→18px diff·적용·Ctrl+Z, 영어 HTML 구조·속성·본문·script 수정 제외를 확인했다. 언어 팝업의 한 클릭 거절은 재관찰 후 키보드로 해결했다. 480px 패널의 표 가로 스크롤·중복 이름 표시도 기록한다. UI 설치본은 마지막 주석/이름 수정 전이며 후속 검증과 구분한다.
- **배포 범위/비용:** 기능과 기획·지원 표·예제를 공개 소스로 제공한다. 설치 UI에 쓴 VSIX는 1,353,438바이트로 이전 1,213,038바이트보다 증가했다. 새 파서 지원의 비용이며 최적화 성과로 표현하지 않는다. 안정판/Pages는 여전히 0.6.0이다. 전체 P0–P6 완료가 아니며 외부 HTML/CSS 프로젝트와 다른 언어 도구가 남는다.

외부 웹 프로젝트의 다음 검증을 위해 modern-normalize v3.0.1을 작업용 폴더에 clone하고 실제 commit `3faa07fc91b8ffbe6243bc4f91e880a00185d0a2`를 확인했다. 태그는 annotated tag이므로 tag object `a6a0a501…`와 소스 commit을 구분한다. 원본 Chrome/TestCafe 테스트와 CSS/HTML fixture를 읽었고 checkout은 깨끗하다. 이 준비 시점에는 의존성 설치나 브라우저 테스트 실행을 하지 않았고 통과 사례로 집계하지 않았다. 후속 실행 결과는 위 외부 프로젝트 항목에서 추적한다. 일부 upstream 테스트는 assertion 없는 TODO이므로 후속 실행 시 전체 pass 개수와 실질 검증 범위를 구별해야 한다.

## 2026-10-16 · Go 표준 파서·원문 수정·실제 UUID 프로젝트

공개 기능 커밋 `5b9e5f0f20b0d7fd4ac786db1cdd03b5104d225f`를 명시적으로 `origin main`에 push했다. [Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38884588820)의 Windows·Ubuntu가 모두 성공했다. 각 핵심 **185개**, 개발/설치 각 **36개**, production 모드·런타임 7개 해시, 저장소 밖에서 추출한 분석/Python 측정/Python AST/Go AST 도구의 실행 성공을 로그에서 대조했다. [CI 원자료](evidence/local-ai/go-source-ci.json). 이후 문서 커밋은 이 정확한 기능 커밋을 가리킨다. 기여 안내에 Python/Go 검사 전제를 명시하고 수동 데모 워크플로에도 같은 SDK 준비 단계를 추가했으며, Pages 배포나 새 안정 릴리스는 실행하지 않았다.

- **범위:** 모델 설명에서 Go의 오류 반환이 누락된 사례에 대응해 P2/P3/P4를 보강했다. [Go 읽기 안내](GO_SOURCE.md)의 로컬 데스크톱 기능이며 전체 언어·전체 계획 완료는 아니다. 유료 API·Ollama·모델이 필요 없는 경로지만 설치 Go SDK가 필요하다.
- **환경:** 공식 Go 1.27.2 Windows amd64 ZIP을 작업 폴더에만 내려받아 SHA-256 `1314008898bd40df77af4b014f777f08873dbdfbcd3d92308728ee03304fe04f`를 확인했다. 시스템 PATH는 바꾸지 않았다. 소스 [공식 다운로드](https://go.dev/dl/). CI에는 설치 단계 `actions/setup-go@v6`, 1.27.2와 cache false를 추가했다.
- **구현:** `extension/runtime/go_source.go`, `extension/src/goSource.ts`와 controller/activation/protocol. 표준 라이브러리만 쓰는 고정 helper를 사용자별 캐시에 빌드하고 원문을 stdin으로 전달한다. 사용자 코드·import·init·go:generate를 실행하지 않는다. 프로젝트 GOFLAGS/GOENV/GOWORK·툴체인 자동 다운로드·모듈 프록시·CGO를 사용하지 않는다. helper/SDK/플랫폼별 캐시, shell 없는 실행·취소·시간·입출력 한도를 적용했다.
- **설명과 수정:** 함수/메서드·여러 반환식·error 값·if/for 초기화·range·switch/type switch/select·defer·go·채널·제어 이동을 부분적으로 읽는다. 이름 하나에 대입한 문자열/숫자만 정확한 범위로 바꾸며 큰 숫자를 JS Number로 변환하지 않는다. 가려질 수 있는 true/false 이름·룬·복소수·식은 제외한다. UTF-8→UTF-16, emoji·한글·CRLF raw string·`//line`의 실제 위치를 검사했다. raw string의 AST End가 CR을 세지 않는 점과 바인딩 없는 range 표시를 수정했다.
- **화면:** 한국어/영어 파서 버전·문법 오류·없는 SDK/설정·첫 helper 준비 안내와 편집 범위 설명을 추가했다. 부분 구문 읽기를 실행 결과처럼 표현하지 않도록 제목을 고쳤다. React 스킬 기준으로 파생 상태·키·입력 레이블·비동기 상태와 UI/파서 분리를 점검했다.
- **핵심 검사:** 전체 **185개/20파일 통과**. Go 7개는 실제 도구 프로세스로 위치·원문 수정·분기/반환·비실행·환경 훅 무시·한도·실패·취소를 확인한다. 여러 VS Code 빌드와 동시 실행한 숫자형식 16개 이상의 순차 프로세스 검사가 테스트의 기본 5초 총시간을 넘어 한 번 실패했다. 그 사례만 총시간 20초로 바꾸고 재실행 **7개 통과**; 제품의 읽기당 5초 제한은 유지했다. `docs/benchmark.json`은 회귀 중 다시 기록한 합성 파서 측정이며 최적화 성과가 아니다.
- **실제 편집기와 발견한 결함:** Go 원문 읽기·줄 이동·큰 정수/문자열·native diff·적용·재분석·undo·오래된 변경안/없는 SDK 거절을 확인했다. 추가 AI fixture는 한국어 요청에 영어 reason을 넣어 처음 언어 검사에 거절됐다. fixture를 고친 다음에는 이름 없는 Go 문서의 AI diff가 `.txt`가 되는 제품 결함을 발견했다. 문서 언어로 확장자를 보충하도록 고쳐 실제 Go diff와 문법 오류 적용 차단을 확인했다. 실제 모델의 응답 품질 검사로 세지 않는다.
- **최종 로컬 통합:** [개발](evidence/local-ai/go-source-development-integration.json)과 [새 설치본](evidence/local-ai/go-source-installed-integration.json) 각각 **36개 통과**. 같은 36개 흐름을 두 환경에서 실행했으며 별개 기능 72개라고 세지 않는다. 설치본은 production 모드·VSIX `239e9ed5…`·런타임 7개 해시를 대조했다. 그 뒤 UI의 오래된 적용 알림 제거/표시 한도 문구 수정은 최종 CI에서 구분해 확인한다.
- **외부 프로젝트:** [Google UUID v1.6.0](evidence/local-ai/go-source-project.md), 정확한 커밋 `0f11ee6918f41a04c201eceeadf612a377bc7fbc`에서 `ParseBytes` 반복 초기값 0을 2로 바꾸는 고정 오류를 검토해 적용했다. **201 pass·1 skip → 200 pass·1 fail·1 skip → undo/저장 후 201 pass·1 skip**. 실패는 TestUUID이며 미저장 검사 차단·원본 SHA-256 복구·깨끗한 checkout을 확인했다. 원자료·양언어 설명·라이선스·재현 스크립트를 공개했다. upstream 수정이나 성능 개선 사례가 아니다.
- **패키지·화면:** VSIX에서 추출한 Go helper를 저장소 밖에서 빌드해 읽기와 정확한 큰 정수 수정을 실행했다. 기존 분석/Python 측정/Python AST helper와 manifest·체크섬 검사도 통과했다. [설치 UI 기록](evidence/local-ai/go-source-native.md)은 한국어/영어 설명, 50_000→70_000, Go diff·적용·undo·L9 이동을 실제 조작했다. 화면 밖 버튼 실패는 재관찰/스크롤 후 진행했으며 성공으로 세지 않는다. UI 검증에서 undo 후 적용 알림이 남아 context 변경 때 알림을 지우도록 후속 수정했다. 화면 설치본과 후속 통합본의 해시를 구분한다.
- **남은 범위:** Go 타입·범위·import 연결·실행 시뮬레이션·최적화 실측·원격 workspace·전체 구문은 검증하지 않았다. Rust/Java/C#/HTML/CSS/SQL의 추가 구조 읽기와 실제 프로젝트, 모델 의미 오류, 전체 P0–P6도 남아 있다. 안정 릴리스는 0.6.0이며 이번에는 0.7 개발 소스와 근거를 공개한다.

## 2026-10-16 · 의미 설명 비교와 두 번째 외부 프로젝트

- **목적:** P2의 분기/오류 누락·데이터 소비 동작 추측을 실제 모델로 확인하고, P4 외부 검증을 JavaScript까지 늘림.
- **설명 변경:** `src/core/localAssistant.ts`에서 설명/편집 지시 분리, 언어별 반환·예외·조건 경계·CSS 열·데이터와 실행 구분, JSON 스키마 설명, 원문 뒤 실제 동작 요청을 추가. 지시는 파서나 의미 정확성 보증이 아님. `8ea3bcd` 로컬 커밋에 소스와 초기 평가 자료가 저장된 것을 확인했다.
- **실제 비교:** 기존 실패 4개와 새로운 합성 예제 6개에 사전 검토 기준을 작성. 기준선 3B, 첫 수정 3B, 두 번째 수정 3B, 같은 수정 7B, Qwen3.5 4B의 한국어 **각 10회**를 실행. [50회 원자료와 검토](evidence/local-ai/semantic-review.md). 7B의 CSS 두 건은 원문 인용 검증 거절이며 다른 응답도 의미 오류가 남는다. 일부 분기 인용 개선을 전체 품질 향상으로 일반화하지 않음. 개발자가 예제를 보며 지시를 작성했으므로 숨겨진 평가 집합 아님.
- **평가 도구:** `scripts/evaluate-explanations.mjs`는 실행마다 새 폴더·고정 번들·프로토콜/전송 해시·모델 digest·응답을 기록하고 자동 재시도하지 않음. 3B 두 번째 실행의 1개+9개 구간은 해시/모델/언어와 중복 없는 10개 ID를 확인해 합침. 이전 거절 응답은 오류만 남았으므로 후속 루프백 중계기로 공개 예제의 최종 원문도 기록. 사고 과정은 기록하지 않고 제품 자동 로깅은 추가하지 않음.
- **모델 연결:** Qwen3.5 4B 약 3.3GB를 공식 배포에서 별도 검증 폴더에 설치. 로컬 GGUF·완성 기능·cloud 비활성 상태 확인. `extension/src/ollama.ts`는 서버가 false를 지원한다고 명시할 때만 `think:false`를 요청. 지원하지 않는/이름 기반 사고 수준을 임의 변경하지 않는 HTTP 회귀 검사 추가. 실제 Qwen3.5 요청에서도 해당 설정 확인. 모델 가중치는 공개 소스에 포함하지 않음.
- **외부 JS:** MIT clsx v2.1.1 고정 커밋에 실제 VS Code 프로젝트 검사 실행. 원본 32/32 → 의도적인 한 줄 오류에서 7/32 통과(exit 1) → native undo·저장 후 32/32 통과. 미저장 검사 거절, 원본 해시 복구·Git 깨끗함 확인. [원자료/재현/라이선스](evidence/local-ai/clsx-review.md). 모델 생성 코드나 최적화 성공 사례가 아님.
- **외부 준비 실패:** npm 명령 부재로 pnpm 사용. 부모 workspace 대신 외부 폴더 의존성을 설치하도록 `--ignore-workspace --ignore-scripts` 사용. Node 24.19.0에서는 구형 esm 로더가 테스트 시작 전에 실패; 소스·테스트는 바꾸지 않고 검증용 VS Code의 Node 20.18.1에서 동일 upstream 명령 실행. 실패 출력도 보존. 제품 Node 요구사항을 낮추지 않음.
- **검증 도구 보강:** clsx task 실행 전에 이전 결과 파일을 지워 시작 단계 실패가 오래된 개수로 오인되지 않게 함. 인수 개수도 확인. 실제 VS Code에서 같은 32→7→32 통과 개수와 원본 복구를 다시 확인하고 별도 원자료 보존.
- **검증:** 핵심 **162개/17파일**, 웹/확장 빌드 통과. 최신 VSIX `e7fd7810…`를 별도 프로필에 설치해 production 모드·번들 해시와 기존 **30개 실제 VS Code 흐름** 통과. [설치 원자료](evidence/local-ai/semantic-installed-integration.json). AI 통합 fixture와 실제 모델 50회는 별도. 파서 합성 benchmark 갱신을 제품 속도 개선으로 부르지 않음.
- **공개 CI:** `d045989`와 검증 도구 보강 `a184b68`을 `origin main`에 push. 후자의 [Windows·Ubuntu Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38872584322)가 모두 성공. 각 로그에서 핵심 **162개**, 개발 호스트 **30개**, 설치 VSIX **30개**, production 모드/5개 런타임 해시, 추출 Worker 2종 독립 실행을 확인. [정규화한 원자료](evidence/local-ai/semantic-ci.json). 두 30개는 같은 흐름을 배포 방식별로 실행한 것이며 실제 모델 정확도와 별개다.
- **영어 후속 비교:** 동일 Qwen3.5 4B·동일 10개 원문을 영어로 각 1회 요청. 9개 형식/원문 통과, Python 1개는 실제 8칸 들여쓰기를 4칸으로 인용해 거절. 거절 원문을 보존해 원인 확인. 영어 Go·trim 조건 설명은 일부 더 명확했지만 JSONC 재시도 소비 동작 추측은 남음. 한국어 50회와 영어 10회를 전체 언어 정확도로 환산하지 않음.
- **실제 수정 회귀:** 변경한 제품 프로토콜에서 qwen2.5-coder:3b의 Python·TypeScript·JSONC 숫자 수정 각 1회가 정확한 원문과 기대 파일 전체 텍스트에 일치. [원자료](evidence/local-ai/semantic-edit-regression.json). 적용/실행은 하지 않음. Python 요약은 변경 후 값과 모순되고, TypeScript의 경계·위험 설명과 JSONC의 원문/변경 후 시제도 부정확했으며 통화 단위 추측이 남음. 코드 일치를 설명 정확성으로 세지 않는다. 60회 설명과 별도의 3회 수정 기록이다.
- **개발 묶음:** 0.7 VSIX·소스 ZIP·브라우저 데모 ZIP 생성, 체크섬·소스 manifest·라이선스·패키지 파일 구성과 추출한 분석/Python 측정 Worker 실행 검사 통과. 문서의 로컬 링크 95개 확인. 공개 안정 릴리스 태그는 변경하지 않음.
- **남은 범위:** 세 모델 모두 JSONC 소비 코드를 추측했고 다른 언어에서도 오류가 남아 전체 P2 완료나 권장 모델 인증을 하지 않음. 외부 clsx는 Windows의 프로젝트 검사 연결 사례이며 생성 편집·성능·모든 런타임 검증은 아님. 파서로 확정한 키/값/구조 설명을 보강하는 것이 다음 제품 우선순위다. 안정 릴리스 0.6.0과 0.7 개발판을 구분한다.

## 기존 작업의 확인 가능한 기준선

| 커밋/버전 | Git 이력과 파일로 확인 가능한 작업 | 근거와 한계 |
| --- | --- | --- |
| `d415f8b` / 0.6.0 | 현재 파일 편집기 오류·경고 연결, 일부 TypeScript 오류 뜻풀이, 원문 이동과 오래된 보고 처리 | [검증 기록](RELEASE_VALIDATION.md), [16개 통합 검사 원자료](extension-integration-0.6.json). 외부 프로젝트 검증·일반 AI 편집 미포함 |
| `cb44d87` | 공개 배포·CI·사용자 관찰 상태 점검, 출시 자료와 게시자 인계 문서 | [당시 공개 점검](LAUNCH_READINESS.md). 수요 검증 완료가 아님 |
| `7603971` | 영문 README의 오래된 버전 표기와 오류 알림 범위 수정 | Git diff와 [CI](https://github.com/him55710-sudo/pureobom/actions/runs/38844251809). 제품 기능 변화 없음 |

더 오래된 작업은 [CHANGELOG](../CHANGELOG.md), Git 이력과 버전별 검증 자료로 추적한다. 보존되지 않은 과거 실행 내역을 완전한 기록인 것처럼 재구성하지 않는다.

## 2026-10-16 · 제품 완성 계획 재정렬

- 사용자 요청: 유료 API 없이 다언어 코드 이해·수정·최적화, 실제 프로젝트 연동 검증, 공개 기획과 작업 내역. 홍보보다 제품 우선. Ollama 활용 허용.
- 조사: 현재 코드·확장 프로토콜·문서·Git 상태와 실행 환경 확인. 기준 커밋 `7603971`, 작업 트리 깨끗함. 이 PC에서 Ollama 명령·기본 설치 경로·모델 폴더를 찾지 못함. Python 3.12와 Node 런타임 사용 가능. 설치된 Ollama 추론을 검증한 것으로 세지 않음.
- 문서 작업: `PRODUCT_COMPLETION.md`, `LANGUAGE_SUPPORT.md`, 이 작업 기록을 작성. 기존 수요/모집 대기는 새 개발 계획의 선행 조건에서 제외.
- 설계 자료: Ollama 공식 [Chat API](https://docs.ollama.com/api/chat), [모델 목록](https://docs.ollama.com/api/tags), [구조화 출력](https://docs.ollama.com/capabilities/structured-outputs), [로컬 전용 설정](https://docs.ollama.com/faq), [Windows 독립 실행 CLI](https://docs.ollama.com/windows). 공개 API·스키마를 활용하고 반환값은 별도 검증할 예정.
- 다음 작업: 루프백 전용 전송, 로컬 모델 확인, 정확한 인용/변경안 검증, VS Code 검토 UI, 실제 Ollama 실행. 아래 기록에 실제 결과가 추가되기 전까지 구현·검증 완료로 세지 않음.

## 2026-10-16 · 로컬 AI의 첫 구현과 실제 프로젝트 검증

- **공개 계획:** 앞 절의 상세 계획·언어 표·작업 기록을 `68f5c51`로 커밋하고 공개 저장소에 push했다.
- **실행 환경:** 공식 Ollama v0.40.5 독립 실행 ZIP의 SHA-256 `5134ce7e3bc8e94d0494721c799ec293b429450d0c52461b0ee3647dd3bb4bb7` 확인. 검증 폴더에서 `OLLAMA_NO_CLOUD=1`, 루프백 11435로 실행. 서버 `/api/status`의 `cloud.disabled:true` 확인. `qwen2.5-coder:3b` 모델 digest는 원자료에 기록. 모델·바이너리는 Git에 포함하지 않음.
- **엔진과 전송:** `src/core/localAssistant.ts`, `extension/src/ollama.ts`. 한국어/영어 구조화 요청, 로컬 전용 상태와 모델 확인, 고정 루프백·리디렉션 거절, 크기/시간 제한, 취소, 원문 인용/수정 범위 검증을 구현. 모델의 셸 명령·도구 호출은 실행하지 않음.
- **편집기 연결:** `localAssistantController.ts`, 기존 controller/protocol/extension과 `LocalAssistant.tsx`. 현재 파일 명시, 모델 선택, 설명/수정/최적화 제안, 정확한 인용 선택, native diff, 명시적 다중 범위 적용과 undo. 문서가 바뀌면 제안 폐기. 지원하지 않는 문서로 이동하면 이전 파일의 AI 제안을 지움. 로컬 AI 명령 추가.
- **문법 확인:** `assistantValidation.ts`, `pythonValidation.ts`. JS/TS와 JSON의 제안 파싱, Python `-I -S`의 고정 ast.parse 프로그램. 사용자 파일 실행 없이 검사하며 도구가 없거나 검사하지 않은 언어는 미검증 표시. 의미·타입·성능 검사로 부르지 않음.
- **자동 검증:** `pnpm test` **147개 통과**, `pnpm extension:build`, `pnpm build` 성공. 실제 VS Code 1.96.4 통합 검사 **19개 통과**. 새 AI 통합 3개는 제어된 로컬 HTTP 응답을 사용하므로 실제 추론 검증과 분리. Python 테스트 재현을 위해 CI에 Python 3.12 준비 단계 추가.
- **실제 추론:** Python 배송 예제 설명 22.3초, 수정 17.6초. 실제 모델 응답과 확인된 인용/수정 범위는 [원자료](evidence/local-ai/README.md)에 공개. 한 사례를 모든 언어의 성능·정확성으로 일반화하지 않음.
- **외부 프로젝트:** BSD 라이선스의 Pallets itsdangerous 2.2.0, 고정 커밋 `096c8d42545d3b68ea21a4f890fb2b2d8979c0bd`. 별도 복사본·Python 가상환경·VS Code 프로필에서 `want_bytes` 변경 제안 → 원문 선택 → diff → 실제 적용·저장 → 변경 전후 pytest **각 297개 통과** → native undo·저장 → 원본 해시 복구. 모델 출력은 실제 Ollama에서 받았으며 upstream에 변경하지 않음. 재현 스크립트 `scripts/test-local-project.mjs`와 테스트 진입점을 추가.
- **발견·수정:** 첫 외부 결과는 위치가 실제인 import를 인용했지만 변경 근거로 부적절했고 설명도 부정확했다. '인용이 존재함'만으로 충분하지 않아 각 변경과 인용의 겹침을 요구하는 검사를 추가. 보강 전/후 자료 모두 남김. 보강 후에도 모델이 중복 타입 검사를 제안하는 품질 한계가 남음.
- **최적화 측정 실패:** 검토한 특정 변경만 실행하는 `scripts/benchmark-local-proposal.py`로 결과/예외/객체 동일성 10개와 15회×10만 호출을 검사. 문자열 입력에서 후보가 약 24~38% 느렸고 바이트 입력도 이 측정에서 개선되지 않아 **미채택**. 원본 프로젝트 유지. 일반 사용자용 성능 측정 기능을 구현했다고 주장하지 않음.
- **화면 확인에서 수정:** 새 '로컬 AI' 탭이 좁은 패널 오른쪽에 숨는 것을 실제 VS Code 화면에서 발견해 탭 줄바꿈 적용. 하단의 '모든 설명은 구문 기반' 문구도 로컬 모델 경로를 구분하도록 수정. Python에서 미분석 항목을 '기능 0개'로 보여 주던 통계를 숨기고 요청 가능 상태로 표시.
- **출력 언어 실패:** 한국어 화면에서 실제 3B 모델이 영어로 답함. 한국어 기본 요청·응답 언어 지시를 보강하고 설명 문구에 한글이 전혀 없는 경우 거절하도록 수정. 회귀 검사 추가. 재실행 응답은 한국어였지만 파일 주석만 요약해 설명이 부족했으므로 품질 성공으로 세지 않음. 원자료 공개.
- **배포 묶음 검사:** 개발판 VSIX를 만들며 `out/real-project.cjs` 테스트 코드 포함을 발견해 제외하고, 허용된 런타임 번들 외 파일이 들어오면 배포 검사가 실패하도록 보강. 다시 만든 VSIX를 별도 프로필에 설치 성공. 소스/데모/VSIX의 체크섬·구성·라이선스 검사 통과. 아직 공개 릴리스로 게시하지 않음.
- **설치본 실제 조작:** 한국어 UI에서 로컬 연결 → 배송 기준 70000 요청 → 실제 모델 응답 17.7초 → Python 문법 확인 → native diff → 확인란 → 적용 → 디스크 원본 해시 유지 → Ctrl+Z → 영문 UI 전환. [화면과 상세 기록](evidence/local-ai/installed-ui.md). 설명의 부정확한 시제와 적용 중 상태 안내 문제도 기록했고, 후자는 갱신 중 문구로 수정·빌드 확인.
- **남은 범위:** 여러 언어의 실제 모델·파서 검증, 모델의 설명 정확성, 여러 파일 변경, 실제 프로젝트 검사/성능 측정을 사용자가 실행할 UI, 추가 운영체제·모델 조합, 설치본과 공개 CI 확인. 이 작업으로 전체 제품 완성을 선언하지 않음.

## 2026-10-16 · 언어별 실제 응답과 설정 파일 지원 보강 (진행 중)

- **공개 증분:** 로컬 AI 첫 구현과 증거를 `3710ea1`로 push. [해당 SHA의 Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38853005494)에서 Windows·Ubuntu 두 작업 성공 확인.
- **설명 누락 개선:** 기본 설명 요청을 파일 소개 대신 입력·조건·결과와 동작 코드 근거를 요구하도록 수정. Python 재실행에서 배송비 계산을 언급했지만 주요 조건 누락이 남아 있어 전체 정확성으로 세지 않음.
- **언어별 사례:** `examples/local-ai/`의 JS/TS/JSX/TSX, Go, Rust, Java, C#, HTML, CSS, SQL, JSON/JSONC와 기존 Python 예제, `cases.json`, `scripts/evaluate-local-languages.mjs` 추가. 실제 모델 응답과 예상 문자열을 비교하며 코드를 적용·실행하지 않음. Python의 `70_000`→`70000` 표기 차이 같은 의미상 허용 가능한 불일치도 원자료에 유지하고 별도 해석.
- **모델 비교 준비:** 공식 [qwen2.5-coder:7b](https://ollama.com/library/qwen2.5-coder:7b)를 같은 로컬 전용 서버에 다운로드. 다운로드 성공은 답변 품질 검증이 아님. 모델 파일은 공개 소스/VSIX에 포함하지 않음.
- **JSONC 구현:** `jsonData.ts`와 분석기·제안 검증·파일 선택·미저장 문서 확장자 연결을 수정. [Microsoft jsonc-parser](https://github.com/microsoft/node-jsonc-parser) 3.3.1을 고정 의존성으로 추가. AST의 구조만 읽으며 사용자 키를 JS 객체 속성으로 변환하지 않음. 부분 파싱 결과와 오류 목록을 구분하고, 주석·끝 쉼표·배열/스칼라·문자열 내부 URL·잘못된 표현을 검사. JSON은 기존의 엄격한 문법 유지.
- **발견한 배포 실패:** 단위 검사는 통과했지만 VS Code의 Worker가 `Cannot find module './impl/format'`으로 실패함. UMD 진입점의 간접 require가 번들에 남은 원인이므로 `build-extension.mjs`에서 ESM module 진입점을 선택하도록 수정. 통합 검사 실패 시 경로·상태·오류를 출력하도록 진단 개선. 이후 기존 TypeScript 진단 대기 제한에도 걸렸으며 성공으로 기록하지 않음; 재검증 예정.
- **문맥 예약:** 작은 파일에도 32768 문맥을 예약하던 전송을 입력 바이트+4096 출력+1024 형식 여유에 맞춰 8192/16384/32768 중 선택하도록 수정. 크기 제한을 넘기면 거절하며 입력을 자르지 않음. 아직 실제 속도 향상 수치를 주장하지 않음.
- **최종 자동 확인:** 핵심 검사 152개, 새 프로필의 실제 VS Code 통합 20개 통과. 미저장 JSONC의 주석·끝 쉼표·잘못된 편집·undo를 실제 Worker로 확인. 이전 프로필은 남은 Code 인스턴스와 충돌해 테스트 시작이 거절되기도 했으므로, `test-extension.mjs`가 매 실행 새 테스트 프로필을 만들도록 수정. 테스트 대기 시간을 늘려 실패를 숨기지 않음. [20개 검사 원자료](evidence/local-ai/vscode-jsonc-integration.json).
- **패키지 런타임 검사:** VSIX에 들어 있는 Worker를 임시 폴더로 꺼내 프로젝트 node_modules 경로 없이 실행해 JSONC 파싱을 확인. 파일 존재·체크섬 검사만으로 런타임 준비를 주장하지 않도록 `release:check`를 보강하고 CI에 묶음 생성·검사를 추가. 수정된 패키지 검사 성공.
- **28회 결과:** [원자료·의미 검토](evidence/local-ai/language-review.md). 수정 12건은 기대 문자열 일치, Python 1건은 동일 숫자 표기 차이, SQL 1건은 근거 불일치 거절. 설명 14건의 구조/원문 검증 통과와 의미 정확성을 구분했고 발견한 오류·누락을 기록.
- **7B CSS 비교:** 같은 파일을 실제 7B 모델에 요청. 3B가 잘못 설명한 3열과 화면 조건·간격을 올바르게 설명했으나 이 PC에서 109.7초 소요. 자동 문맥 16384가 요청과 서버 상태에서 확인됨. [원자료](evidence/local-ai/css-qwen-7b.json). 전체 모델 품질·속도 우열로 일반화하지 않음.
- **7B Python 비교:** 80.4초, 문맥 16384. 음수 ValueError·무료 배송 분기·기본 배송비 반환을 5개 원문 인용으로 설명. [원자료](evidence/local-ai/python-qwen-7b.json). 요약에서는 음수 예외가 생략돼 인용 설명까지 함께 검토해야 함.

## 2026-10-16 · 프로젝트 검사 명령을 제품에 연결

- **목적:** 모델이 적은 '확인할 항목'과 실제 프로젝트 테스트를 구별하고, 수정·저장 후 사용자가 실행 결과를 확인하도록 P4를 보강.
- **변경:** `extension/src/projectChecks.ts`, `extension/ui/ProjectChecks.tsx`, host 메시지·화면 상태 연결. 같은 프로젝트 폴더의 일회성 test/build process/shell 작업을 목록에서 선택하고 명령 검토 후 실행. 모델 응답은 실행 입력으로 사용하지 않음. 자동 저장 없음, 미저장 파일 차단, 실제 종료 코드·시각·파일 해시 기록, 관찰한 파일/설정 변경 시 오래된 결과 표시. 한 번에 한 작업, 명시적 취소와 10분 중단 요청. 실행할 때 선택한 명령의 fingerprint를 다시 비교. 환경 값은 host 안에서만 비교하며 출력·소스·환경을 자동 전송하지 않음.
- **범위:** 기존 task의 명령 하나만 새 실행으로 복사하며 dependsOn·runOn·감시 옵션은 실행하지 않음. 사용법과 파일 감시 제외·외부 환경·성능 측정 한계는 [PROJECT_CHECKS.md](PROJECT_CHECKS.md)에 명시. UI는 한국어·영어 모두 작성. React 스킬 기준으로 파생 상태·효과 정리·비동기 unmount/context 방어·레이블/상태 알림을 검토.
- **실제 외부 검사:** [itsdangerous 원자료](evidence/local-ai/itsdangerous-project-checks.json). 고정 커밋 2.2.0과 격리 Python 환경에서 새 기능으로 pytest 297개 통과. 검토한 고정 오류(`want_bytes`가 빈 bytes를 반환)를 편집기에 넣고 미저장 실행 차단 확인 → 저장 후 pytest `-x`가 5개 실행 중 1개 실패(exit 1) → native undo·저장 후 297개 통과. 최종 소스 해시와 Git 깨끗한 상태 확인. 모델 코드 실행이나 성공한 최적화 사례로 세지 않음.
- **검증 스크립트 실패:** 첫 외부 실행은 기준선 297개 통과 뒤 LF 문자열을 CRLF 파일에서 찾지 못해 중단. 원본은 보존됐으며 개행을 편집 범위에서 제외해 수정. task 내부 타입 등록 누락 경고도 실제 provider/schema 등록으로 해결.
- **실제 취소 버그:** `executeTask`의 반환 직후 취소하면 VS Code가 아직 프로세스를 등록하지 않아 'Task to terminate not found'가 발생하고 중단 대기에 남음. 실제 프로세스 시작 이벤트까지 취소 요청을 유지한 뒤 한 번만 terminate하도록 수정. 빠른 취소를 통합 검사에 유지.
- **TypeScript 검사 지연:** 실제 진단을 기다리는 기존 통합 검사가 세 번 25초 제한을 초과. 새 작업 폴더와 tsconfig 분리만으로 해결되지 않았음. 상세 tsserver 로그에서 앞선 가상 diff 문서들이 별도 inferred project로 열리고 프로젝트 갱신 요청이 지연되는 것을 확인. TSX diff를 `.ts`로 만들던 제품 오류를 고치고 해당 언어 식별자 검사를 추가. 테스트에서는 소유한 diff 탭을 닫고 실제 진단 대기를 60초로 변경. 시간 제한을 늘렸다는 사실과 원인을 함께 기록하며 성능 해결로 주장하지 않음.
- **재현:** `pnpm extension:build`, `pnpm extension:test`; 외부 Python 환경 준비 후 `node scripts/test-local-project.mjs --checks-only`. 일반 CI의 새 통합 검사는 자체 명령을 사용하고 실제 모델·외부 저장소는 요구하지 않음. 검증마다 작업 폴더와 사용자 프로필을 새로 생성.
- **추가 모델 응답:** [7B SQL 수정](evidence/local-ai/sql-qwen-7b.json)은 59.7초, 16384 문맥으로 정확한 인용과 기대 문자열 수정에 성공. SQL 실행·방언 호환성을 검증했다고 세지 않음.
- **남은 범위:** 모든 언어의 문법/타입 검사, 모델 설명의 의미 정확성, 사용자용 전후 성능 측정, 새 검사 UI의 설치본 조작·전체 실패 조합 검증. 이번 UI 자동화에서는 기존 개발 창이 최소화 상태이며 활성화 재시도도 실패해 새 화면 조작 성공을 주장하지 않음. 기존 로컬 AI 설치본 조작 기록은 앞선 버전의 별도 증거로 유지.
- **수정 후 통합 결과:** 2026-10-16 14:47 KST, 실제 VS Code **25개 통합 검사 통과**. TypeScript 실제 2322 진단, TSX diff 언어 보존, process/shell 종료, 빠른 취소 후 재실행, 미저장·중복 실행 거절, 다른 파일 변경으로 오래된 결과 표시, 백그라운드 제외, 변경된 명령 재검토를 확인. [원자료](evidence/local-ai/vscode-project-checks-integration.json). 로컬 빌드·타입 검사도 통과.
- **교차 운영체제 실패와 수정:** `75b1af2`의 [CI](https://github.com/him55710-sudo/pureobom/actions/runs/38857869088)는 Windows 성공·Ubuntu 실패. 실제 process 명령은 exit 0이었으나 결과가 오래된 것으로 표시됨. 무효화 이유를 기록한 `939f459`의 [재현](https://github.com/him55710-sudo/pureobom/actions/runs/38858101452)에서 `settings changed: terminal`을 확인. 모든 설정 이벤트를 변경으로 취급하던 코드를 실행 관련 설정의 실제 값 해시 비교로 변경. 작업 설정, 해당 OS의 환경·상속·locale, shell 작업의 프로필과 `${config:...}` 참조를 비교하며 값 자체는 출력하지 않음. 터미널 글꼴 변경은 결과를 무효화하지 않고 환경 변수 변경은 무효화하는 실제 검사를 추가.
- **Linux 셸 예제 수정:** `5f6de42`의 CI에서 Ubuntu의 첫 명령·설정 무효화·취소 검사는 통과했으나 shell 예제가 exit 2로 실패. 검증 예제의 `node -e process.exit(0)` 인수에 POSIX 셸의 괄호 해석을 막는 인용이 없었음. VS Code task의 명시적 `quoting: "strong"`을 사용해 수정. 제품은 셸 명령을 임의 변환하지 않고 사용자가 등록한 인용 설정을 보존한다. 실패 상태를 20초 뒤 시간 초과로만 보던 예제도 종료 직후 실제 상태를 확인하도록 개선.
- **최종 교차 운영체제 확인:** `a3e6f84`의 [Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38858730263)에서 **Windows·Ubuntu 모두 성공**. 각 작업 로그에서 핵심 152개, 실제 VS Code 통합 25개, 웹/확장 빌드와 패키지 Worker 검증 성공을 확인. [CI 증거](evidence/local-ai/project-checks-ci.json). 로컬 VSIX·소스 ZIP·데모 ZIP도 생성하고 체크섬·라이선스·번들 독립 실행 검사 통과. 안정 릴리스 0.6.0과 구별한 0.7 개발판이며 공개 릴리스 태그를 새로 만들지 않았다. P4 첫 실행 연결은 검증됐고 P2 의미 정확성·P5 성능 측정 UI·P6 설치 화면 조작 조합은 계속 남아 있다.

## 2026-10-16 · 사용자용 전후 측정 연결

- **목적:** P5의 전후 시간·메모리·출력·검사 근거를 사용자가 확인할 수 있도록 구현. 최적화 제안을 실행 속도 개선으로 가정하지 않는다.
- **실제 변경:** `src/core/benchmark.ts`, `extension/src/benchmarks.ts`, `benchmarkRunner.ts`, `extension/runtime/benchmark.py`, `extension/ui/Benchmarks.tsx`. 기존 등록 process 작업을 재확인한 뒤 준비 1회 + 별도 프로세스 7회 실행. 시간 중앙값·관측 범위·MAD, OS 최대 프로세스 메모리, 출력 SHA-256, 동일 파일의 실제 검사 기록을 로컬 보고서로 제공. 한국어/영어 화면·명령 검토·명시적 실행·취소·JSON 문서 연결. [측정 정의와 한계](BENCHMARKS.md).
- **호스트 제약:** 같은 명령/인수/환경 설정/측정 도구/파일 경로를 다시 확인. 미저장 파일·중복 실행 거절, 검사와 측정 사이 실행 예약 공유, 진행 중 파일 변경으로 취소, 전후 사이 다른 파일·설정 변경으로 기준선 무효화. 대상 파일은 전후 사이에 수정 가능하며 후보 측정 후 추가 수정은 오래된 결과 표시. 출력이나 환경이 다르면 개선률을 계산하지 않음. 셸/배치/백그라운드/입력 변수 및 task 선행 의존성 미지원. 프로젝트 코드의 일반 사용자 권한 실행이며 샌드박스가 아님.
- **실제 프로세스 검증:** Windows에서 기록용 7회 실행, 실제 메모리 수집, exit 7 실패, 4 MiB 출력 한도, 없는 Python 안내, 이미 취소한 요청, 실제 30초 제한 확인. 취소 검사는 손자 프로세스의 파일 heartbeat가 멈추는 것까지 확인. 핵심 테스트 **161개 통과**. Node/Python 단위 검증과 실제 VS Code 검증을 구분한다.
- **통합 검사 준비 실패와 수정:** 첫 전체 실행은 이전 테스트가 복원한 tasks.json을 VS Code가 다시 읽기 전에 다음 작업을 준비해 '설정 변경'으로 거절됨. fixture의 설정·작업 목록 복원 대기를 추가. 다음 단독 검사는 닫힌 TextEditor 참조를 재사용해 실패해 매 편집마다 열린 편집기를 다시 받도록 수정. 변경 감지·재검토 조건을 약화하지 않음. 수정 후 새 측정 전용 VS Code 통합 **5개 흐름 통과**: 기준선/검토 조건, 실제 7회 측정, 파일 저장·검사 근거, 출력 불일치, 빠른 취소·재시작, 다른 파일 변경, 오래된 준비와 실패한 명령.
- **외부 검증 준비 실패:** [최초 기록](evidence/local-ai/itsdangerous-command-benchmark-setup-failure.json). 확장 활성화 뒤 만든 tasks.json의 지연 watcher 이벤트가 이미 실행 중인 pytest를 오래된 결과로 표시했다. 검증용 파일을 VS Code 시작 전에 생성하도록 옮겼고, 제품은 관찰한 변경을 계속 무효화한다. 최초 실패와 후속 성공을 함께 공개.
- **외부 결과와 발견:** 고정 itsdangerous에서 이전에 검토한 qwen2.5-coder:3b 제안 한 건만 재현했다. 새로운 모델 명령을 실행하지 않음. [첫 측정](evidence/local-ai/itsdangerous-command-benchmark-before-memory-fix.json)은 전후 pytest 297개·복구 후 297개 통과, 실행 시간 중앙값 1310.05 → 1494.12 ms(약 14.1% 증가). 다만 Windows 가상환경 python.exe가 실제 인터프리터를 별도 프로세스로 띄우므로 약 4.5 MiB 메모리는 실행기 자체의 값이었다. 이를 실제 Python 작업의 메모리로 해석하면 안 된다.
- **메모리 표시 수정·재검증:** Windows Python 가상환경 실행기와 pyvenv.cfg를 식별하면 메모리 값을 제외하고 화면·보고서에 사유를 남기도록 수정. [Python 문서](https://docs.python.org/3.12/library/venv.html)와 [CPython 실행기](https://github.com/python/cpython/blob/main/PC/venvlauncher.c) 확인. [수정 후 실제 기록](evidence/local-ai/itsdangerous-command-benchmark.json): 전후·복구 후 각 **297개 통과**, 10개 고정 입력/예외/객체 동일성 확인 후 500만 문자열 호출, 전후 각 7회. 시간 중앙값 **1223.69 → 1482.34 ms(약 21.1% 증가)**, 범위 1204.94–1318.73 / 1372.27–1688.70 ms, 출력 일치. 해당 실행의 메모리는 확인 불가로 표시하며 0으로 세지 않음. 제안 미채택·원본 해시 복구·외부 Git 깨끗한 상태 확인. 전후 순차 실행·프로세스 시작 비용 포함이므로 앞선 함수 단위 교대 측정과 수치를 직접 비교하지 않음.
- **공개와 재현:** `scripts/measure-itsdangerous.py`, `node scripts/test-local-project.mjs --benchmark-only`. 원자료의 로컬 경로만 `<workspace>`로 정규화. 보고서에 개인정보·환경 변수 값·원시 성공 출력은 포함하지 않음. 실패와 메모리 해석 오류 자료는 삭제하지 않고 한계를 붙여 보존.
- **검토·남은 범위:** React 스킬 기준으로 폼 레이블, 비동기 unmount/context 방어, 상태 파생, 오류/진행 표시, KO/EN 문구를 검토. 다만 새 화면의 설치본 클릭·키보드·다양한 크기 실제 조작을 완료했다고 세지 않음. 임의 자식 트리 전체 메모리, 모든 언어 도구, 모델 의미 정확성, 외부 입력 고정·통계적 유의성은 보장하지 않음. 전체 P0–P6 완료 보고가 아니다.
- **전체 로컬 검증:** 2026-10-16 15:44 KST, 핵심 161개·실제 VS Code 통합 30개 통과. [통합 원자료](evidence/local-ai/vscode-benchmark-integration.json). 웹 빌드·확장 빌드·VSIX/ZIP 생성·체크섬/라이선스·독립 추출한 분석 Worker 및 Python 측정 Worker 실행 검사 통과. 0.7 개발판이며 공개 0.6.0 릴리스 태그를 교체하지 않았다.
- **교차 운영체제 확인:** `d819c49`를 공개 저장소에 push했고 [Verify 실행](https://github.com/him55710-sudo/pureobom/actions/runs/38863193178)의 Windows·Ubuntu 작업이 모두 성공했다. 각 로그에서 핵심 **161개**, 실제 VS Code 통합 **30개**, 추출한 분석 Worker와 Python 측정 Worker 실행 성공을 확인. [정규화한 CI 원자료](evidence/local-ai/benchmark-ci.json). 실제 모델·외부 프로젝트 자료는 별도이며 설치본의 새 UI 직접 조작까지 검증했다고 주장하지 않는다.

## 2026-10-16 · 새 VSIX 설치·언어 전환·입력 상태 검증

- **설치 검사 구현:** `scripts/test-extension.mjs --installed` / `pnpm extension:test:installed`. 매번 새로운 프로필과 확장 폴더에 VSIX를 CLI로 설치. 별도의 최소 테스트 드라이버만 개발 확장으로 실행하고, 제품은 설치 경로·버전·production 모드·실행 파일 5개의 SHA-256을 검증한다. 기존 실제 VS Code 30개 흐름을 설치본에서도 실행한다. CI의 Windows/Ubuntu에 추가했고 통합 JSON을 별도 artifact로 보존한다.
- **준비 실패:** `vscode.Extension`에 `extensionMode` 속성이 있다고 가정한 첫 빌드는 TS2339로 실패. 실제 활성화의 `ExtensionContext.extensionMode`를 반환하고 그 값을 검사하도록 고쳤다. 테스트 프로필에 확장 자동 갱신을 끄는 설정을 추가해 미등록 개발 게시자의 Marketplace 조회를 피한다. 사용자 프로필은 변경하지 않음.
- **UI 수정:** `LocalAssistant.tsx`, `main.tsx`. 안내를 선택 언어에 맞춰 표시하고 생성 결과의 언어를 보관. 언어 전환 시 진행 요청 취소, 늦은 결과 무시, 다른 언어의 이전 응답 숨김과 재요청 안내. HTML `lang` 동기화. 큰 파일/미지원 파일을 설명 가능·분석 완료로 오해하게 만드는 헤더 문구 수정. React 스킬 기준으로 파생 상태, 비동기 응답과 unmount, 효과 정리, 상태 안내와 레이블을 검토.
- **실제 설치 화면:** [상세 관찰](evidence/local-ai/installed-ui-states.md). 새 VSIX의 한국어/영어 연결 안내, 생성 중 언어 변경→취소→재요청, 완료된 다른 언어 응답 숨김, 29,402바이트 파일 요청 비활성화, 미지원 파일 전환 시 이전 결과 제거를 확인. 약 350px 패널에서 조작. 네이티브 메뉴/화면 밖 버튼의 입력 실패는 재관찰 후 키보드·스크롤로 해결했으며 제품 요청 성공으로 세지 않음.
- **실제 모델 품질:** 7B 영어 요청은 취소 검증에 사용. 3B 한국어 설명은 32.6초로 완료됐지만 상수 한 곳만 인용하고 음수 예외·기본 반환 분기·비교 코드가 빠짐. 코드에 명시되지 않은 원 단위도 붙임. UI 통과와 의미 정확성을 분리하고 후속 P2 개선 대상으로 기록. 영어 모델 설명의 품질이 검증됐다고 주장하지 않음.
- **로컬 검증:** 핵심 **161개**, 웹/확장 빌드 통과. 초기 설치본과 헤더 수정 후 설치본에서 각각 실제 VS Code **30개** 통과. 최종 [설치 통합 원자료](evidence/local-ai/installed-vsix-integration.json)는 VSIX `5912f6a3…`와 production 모드를 기록한다. 네이티브 화면의 VSIX `afad9ed1…`는 헤더 후속 문구 수정 전이며 동일 증거로 혼동하지 않는다. `docs/benchmark.json`은 이 회귀 검사 때 다시 측정된 합성 파서 기록이며 제품 전반의 속도 개선 증거가 아니다.
- **공개 상태:** 구현과 지원 표 수정이 로컬 커밋 `2941b8e`에 저장된 것을 확인했다. 이 기록과 원자료는 후속 커밋으로 함께 공개한다. 공개 안정 릴리스는 여전히 0.6.0, 이번 소스와 VSIX는 0.7 개발판이다. 전체 P0–P6 완료가 아니며 연결 실패/빈 모델 목록의 네이티브 화면, 추가 환경·언어 조합과 의미 품질 검토가 남는다.
- **추가 실패 상태 확인:** 별도 테스트 프로필만 미사용 포트 11436으로 바꿔 실제 연결 실패 안내와 재연결을 확인. 같은 포트에서 빈 모델 폴더의 실제 Ollama를 시작해 cloud 비활성화·빈 목록을 API로 확인하고, 네이티브 화면에서 영어 `No installed local text model found.`와 요청 비활성화 확인. 가짜 HTTP 응답이 아니다. 기존 모델 폴더는 변경하지 않았고 추가 서버의 실행 파일·포트 소유 PID를 대조한 뒤 종료, 테스트 프로필 포트를 복구했다. 앞 항목에 남아 있던 연결 실패/빈 목록 화면 확인은 이 후속 검증으로 해소했다.
- **교차 운영체제 설치 확인:** 구현과 기록을 공개 저장소의 `b1743a6`까지 push. [Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38866248270)의 Windows·Ubuntu 모두 성공. 각 로그에서 핵심 **161개**, 개발 호스트 **30개**, 별도 VSIX 설치본 **30개**와 production 모드/파일 해시, 패키지 Worker 2종 독립 실행을 확인. [정규화한 CI 원자료](evidence/local-ai/installed-ci.json). 두 번 실행한 30개는 같은 통합 흐름으로 별개의 60개 제품 기능이라고 세지 않는다. 네이티브 검증용 배송 파일의 최종 SHA-256도 공개 예제와 일치하고 11435 기존 모델 재연결 성공. 다음 우선순위는 P2의 분기·예외 누락과 언어별 근거 없는 해석 개선이다.

## 2026-10-16 · JSON/JSONC의 모델 없는 사실 읽기와 범위 수정

- **문제:** 여러 실제 모델에서 JSONC 키 이름을 근거로 재시도·활성화·요금 적용을 추측했다. 설정 파일 자체의 값과 소비 프로그램의 동작을 구분하는 P2/P3 경로를 보강했다. 모델 프롬프트의 개선이나 새 추론 성공 사례로 세지 않는다.
- **구현:** `src/core/jsonData.ts`, `analyze.ts`, `edit.ts`, `types.ts`. AST의 원문 범위로 키 경로·자료형·값·줄을 읽으며, 문자열·숫자·참거짓 하나를 같은 자료형으로 수정한다. 숫자를 Number로 변환하지 않아 큰 정수·긴 소수·음의 0·지수 표기를 보존한다. 그 밖의 주석·개행·키 순서·URL은 재직렬화하지 않는다. JSON은 엄격한 문법, JSONC는 주석·끝 쉼표 허용 규칙으로 검사한다.
- **모호한 입력:** 이스케이프를 해석한 같은 이름의 중복 키를 모두 표시하고 해당 범위·하위 값의 직접 수정을 막는다. `__proto__` 같은 이름은 객체 대입 없이 Map/AST에서 다룬다. null·전체 컨테이너 변경은 원문 편집으로 남긴다. 표시 300개·12단계, 값 미리보기 200자·경로 256자, 직접 수정 입력 4096자 제한. 전체 파싱이 스트리밍이나 무제한 입력 지원이 된 것은 아니다.
- **공통 화면:** `DataFacts.tsx`/CSS를 브라우저와 VS Code에 연결했다. 키/값 검색, 언어별 자료형·안내, 원문 이동과 직접 수정, 중복·생략 안내를 제공한다. 숫자 자동 증감 제안에서 JSON을 제외해 반올림을 피한다. 제한된 신뢰 모드에서는 값 수정만 막고 원문 읽기는 유지한다. React 스킬 기준으로 파생 검색 결과·Map 조회·조건 이전 hook·안정된 항목 ID·입력 레이블·상태 알림을 검토했다. 파서는 UI 번들에 가져오지 않는다.
- **핵심 검사:** 새 `tests/json-facts.test.ts`의 7개 사례는 정확한 원문 범위, 중복/이스케이프 키, prototype 이름, Unicode·CRLF·CR 개행, 정밀 숫자, 문자열 이스케이프, scalar/array/null, 잘못된 입력·오래된 변경·표시 제한을 확인한다. 전체 **169개/18파일 통과**. `docs/benchmark.json`은 회귀 검사에서 다시 기록된 합성 파서 측정으로, 제품 전체 최적화 성공을 뜻하지 않는다.
- **실제 편집기:** [개발 실행 원자료](evidence/local-ai/json-facts-development-integration.json)의 **31개 흐름 통과**. 새 JSONC 검사에서 한국어/영어 사실 문구, 원문 줄 이동, 모델 없는 `3000 → 9007199254740993` 변경안, native JSONC diff의 언어 보존, 명시적 적용·원문 보존·undo, 이미 사용한/파일이 바뀐 변경안 거절을 확인했다. 기존 AI 통합 사례는 제어된 HTTP fixture로 별도 유지한다.
- **브라우저 실제 조작:** 배송 체험의 package.json에서 문자열 `1.0.0 → 1.1.0`을 미리보기·적용·되돌리고, 영어 검색과 한국어 원문 이동을 확인했다. 390px 좁은 화면과 기본 폭의 [이미지·설명](JSON_DATA.md)을 보존했다. 개발 중 소스 변경으로 페이지가 새로 고쳐져 첫 적용 버튼을 찾지 못한 시도는 성공으로 세지 않고 새 화면에서 전체 흐름을 다시 확인했다.
- **발견한 UI 문제:** 한국어로 적용/undo 후 영어로 바꾸면 이전 한국어 알림이 남았다. 브라우저 알림을 언어별 문구로 저장하고 표시 시 언어를 선택하도록 수정했다. 새 화면에서 한국어 적용→영어 알림, 영어 undo→한국어 알림 전환을 확인했다. 프로젝트 이름과 원문 문자열은 번역 대상이 아니다. 브라우저 역사 시각의 기존 한국어 표기는 별도 남아 있으며 모든 UI 문자열을 완전 현지화했다고 주장하지 않는다.
- **검증·범위:** 웹·확장 빌드 통과. 후속 문구/알림 수정 후 JSON 핵심 11개 재확인. 새 기능은 공개 안정 0.6.0과 다른 0.7 개발판이다. 모델 설명 정확성, JSON 스키마·소비 코드·외부 프로젝트 의미 검증, 모든 언어·환경 지원은 여전히 남아 있다. 문서와 예제는 [JSON_DATA.md](JSON_DATA.md), 지원 표와 README에 연결했다.
- **새 설치본·패키지 확인:** 17:46 KST, [설치 VSIX 원자료](evidence/local-ai/json-facts-installed-integration.json)의 **31개 흐름 통과**. VSIX SHA-256 `2607c8e56093a8bba493286419fbfcd3611ce18b71438f823a46aa4efa5dd92e`, production 모드와 실행 파일 5개 해시 일치. `release:package` 및 `release:check`에서 체크섬·소스 manifest·데모 파일·라이선스와 독립 추출 분석/Python 측정 Worker 성공. 개발/설치의 동일 31개를 별개 기능 62개로 세지 않는다.
- **추가 네이티브 화면 시도:** 새 설치 확장 폴더와 별도 사용자 프로필·공개 retry.jsonc 복사본으로 창을 실행했지만 Windows 조작 도구에 대상 창이 나타나지 않았다. 반복 클릭이나 기존 사용자 창 변경 없이 중단했고, 프로필 경로·실행 파일·PID를 대조해 그 검증 프로세스 트리만 종료했다. 새 JSON 화면의 네이티브 클릭 성공으로 세지 않는다. 실제 설치 통합 31개와 브라우저 조작 기록은 별도로 유효하다.
- **교차 운영체제 공개 검증:** 기능 커밋 `2b0235e5e2948415533f51eccc9ce746dfe6f535`를 명시적으로 `origin main`에 push했다. [Verify 실행](https://github.com/him55710-sudo/pureobom/actions/runs/38876047129)의 Windows·Ubuntu가 모두 성공. 각 로그에서 핵심 **169개**, 개발 호스트 **31개**, 새 VSIX 설치본 **31개**, production 모드·런타임 파일 5개 해시·패키지 Worker 2종 검증 성공을 추출했다. [정규화한 CI 원자료](evidence/local-ai/json-facts-ci.json). 코드 기능과 모델 정확도는 구별하며, 공개 안정 릴리스 태그나 Pages 데모를 이번에 교체하지 않았다.

## 2026-10-16 · Python AST로 읽고 정확한 원문 값을 수정

- **문제와 범위:** Python 설명에서 모델이 음수 예외·배송 기준·기본 반환을 누락했던 결과에 대응해 P2/P3를 보강했다. 설치된 Python의 고정 AST helper를 사용하며 모델·Ollama·API 호출을 추가하지 않았다. VS Code 로컬 데스크톱의 현재 Python 문서만 분석하며 전체 계획 완료가 아니다.
- **구현:** `extension/runtime/python_source.py`, `extension/src/pythonSource.ts`, controller/activation/protocol. `-I -S`로 고정 도구를 실행하고 ast.parse 후 compile로 범위 오류를 확인하되 사용자 소스·import·데코레이터·기본값을 실행하지 않는다. 함수·클래스·분기·반복문 else·except/except\*·try else·finally·with·return·raise·yield 등을 부분적으로 읽는다. 호출의 의미·단위·성능을 추측하지 않는다. 버전, 미지원 구문, 생략·오류·없는 실행기·기한/취소를 표시한다.
- **위치와 수정:** AST의 UTF-8 열을 편집기의 UTF-16 위치로 변환한다. emoji·한글·LF/CRLF/CR와 정확한 큰 정수를 확인했다. 단일 이름 대입의 문자열·숫자·참거짓만 원문 한 범위에서 수정한다. 숫자는 JS Number로 변환하지 않으며 문자열은 inert Python 리터럴로 인코딩한다. 주석을 지울 수 있는 implicit string concatenation은 제외한다. 128KiB·5초·2MiB 응답, 400구문·12단계·100함수·300값·4096자 한도를 문서화했다.
- **화면·공유 코드:** `Story.tsx`, `storyReport.ts`에서 분기/예외/정리 순서를 공유하고 Python 버전·정적 분석 한계와 문법 오류를 표시한다. Python 함수 시뮬레이션은 비활성화한다. 문장 입력 파싱을 parser-free `ruleRequest.ts`로 옮겨 호스트에 TypeScript 파서를 새로 번들하지 않았다. React 스킬로 파생 상태·접근성·안정된 키·UI 파서 분리를 검토했다.
- **검사:** 새 `tests/python-source.test.ts` 9개를 포함한 핵심 **178개/19파일 통과**, 웹/확장 빌드 성공. 실제 VS Code `pythonSource.ts` 검사에서 숫자 수정→native diff→적용→재분석→undo, 파일 변경 후 제안 무효, 없는 실행기와 복구를 확인했다. 처음 전체 통합에서 기존 AI fixture가 Python 분석을 반드시 text로 기대해 실패했다. 실제 Python 버전과 원문 값/파서 식별자를 검증하도록 기대값을 갱신한 뒤 개발 통합 **33개 통과**. [개발 기록](evidence/local-ai/python-source-development-integration.json).
- **외부 프로젝트:** [itsdangerous 2.2.0](evidence/local-ai/python-source-project.md)의 `url_safe.py`를 AST로 읽고 `decompress = False` 한 값을 의도적으로 True로 바꿨다. 실제 VS Code task 검사 **297개 통과→38개 실패→undo·저장 후 297개 통과**, 미저장 실행 차단, 원본 해시 복구와 깨끗한 checkout 확인. 기존 모델 최적화 사례와 다른 고정 오류 검사이며 성능 개선으로 세지 않는다. 공개 재현 스크립트 `scripts/test-python-source-project.mjs`와 harness, 한국어/영어 설명·정확한 수정 범위·task 결과를 공개했다.
- **패키지·설치:** 새 Python helper를 VSIX에 포함하고 설치본 검증 해시 대상을 6개로 늘렸다. 초기 설치본은 production 모드에서 **33개 통과**. 저장소 밖으로 추출한 AST helper의 읽기·큰 정수 수정과 기존 분석/측정 Worker, 체크섬/manifest 검사를 통과했다. `docs/benchmark.json`은 전체 핵심 회귀 중 재측정한 합성 파서 기록이며 최적화 성과가 아니다.
- **실제 화면과 후속 수정:** [설치본 네이티브 기록](evidence/local-ai/python-source-native.md)에서 한국어/영어 예외·경계·기본 반환, `50_000 → 70_000` diff·적용·원문 선택·Ctrl+Z와 디스크 원본 보존 확인. 처음 잘못된 접근성 항목 입력과 선택기의 무효 set_value는 성공으로 세지 않고 재관찰 후 조작했다. 남아 있던 JS/TS 전용 하단 문구·맞지 않는 Python 요청 예시·비교 수정 안내·True/False 표기를 바로잡았다. 화면 자료와 수정 후 설치본은 서로 다른 해시로 보존한다.
- **한계:** 부분 구문 설명이며 Python 타입·import 지도·시뮬레이터·브라우저/원격 실행은 미제공이다. 다른 언어의 분석기·외부 연동, 모델 의미 정확성, 수요·전체 P0–P6 완료를 주장하지 않는다. 상세 범위·실행기 설정·재현은 [PYTHON_SOURCE.md](PYTHON_SOURCE.md), README와 지원 표에서 탐색 가능하다. 안정판은 0.6.0이며 0.7 개발 소스로 구분한다.
- **문구 수정 후 설치 확인:** [설치 통합 원자료](evidence/local-ai/python-source-installed-integration.json)의 VSIX `ffbbccf9559d928554ced29bdb15a3fd2aa6e464ef651405579cd79de2f38d48`에서 production 모드·런타임 6개 해시와 **33개 통과**. 후속 확장 README 설명 추가는 런타임 변경과 구분한다. 공개 전 최종 소스의 양쪽 운영체제 CI를 별도 확인한다.
- **교차 운영체제 공개 검증:** 기능·기록 커밋 `583c8059cd2f9a37a45eaf931d22a8aecedfe46a`를 명시적으로 `origin main`에 push했다. [Verify](https://github.com/him55710-sudo/pureobom/actions/runs/38880264124)의 Windows·Ubuntu 모두 성공. 각 핵심 **178개**, 개발/설치 각 **33개**, production 모드·런타임 6개 해시, 추출한 분석/Python 측정/Python AST 읽기·수정 도구 성공을 로그에서 대조해 [CI 원자료](evidence/local-ai/python-source-ci.json)로 보존했다. 네이티브 UI·실제 외부 프로젝트 결과와 합쳐 모델 정확도 점수로 쓰지 않는다. 후속 문서 커밋은 이 기능 커밋을 정확히 가리키며 안정 릴리스나 Pages는 교체하지 않았다.

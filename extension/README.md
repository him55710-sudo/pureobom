# 풀어봄 · VS Code 확장 기능

**SQLite 원문 / source:** SQL 파일에서 SQLite를 명시적으로 선택하면 일부 쿼리 구조와 숫자·문자열을 모델/API/DB 연결 없이 읽고 수정합니다. 실제 DB 실행·스키마·성능은 별도 검사해야 합니다. Other SQL dialects are not yet analyzed. [범위·검증 / Guide](https://github.com/him55710-sudo/pureobom/blob/main/docs/SQL_SOURCE.md).

**Pureobom — Read it. Change it. Check it.**

**HTML/CSS 원문 / source:** 0.7 개발판은 포함된 파서로 태그·문구·선택자·선언 값을 읽고 일부 값의 diff·적용·undo를 제공합니다. 모델/API/별도 언어 실행기가 필요 없습니다. 렌더링·스타일 우선순위·접근성은 실제 페이지에서 확인해야 합니다. [범위와 예제 / Guide](https://github.com/him55710-sudo/pureobom/blob/main/docs/HTML_CSS_SOURCE.md).

**0.7 개발판:** 선택형 Ollama 로컬 AI로 현재 파일 설명·여러 위치 수정·최적화 제안을 요청할 수 있습니다. 클라우드가 꺼진 로컬 서버만 사용하며, 원문 근거·변경 차이·미검증 항목을 확인한 뒤 적용합니다. Python 실제 프로젝트의 전후 테스트와 undo를 검증했습니다. 언어별 모델의 의미 정확성과 새 설치·사용 조합은 계속 검증 중입니다. [사용법과 증거](https://github.com/him55710-sudo/pureobom/blob/main/docs/LOCAL_AI.md).

Read JS/TS as source-linked stories in Korean or English, edit a rule, and compare up to 12 inputs before applying. Optional local AI proposes broader changes. In English VS Code, run **Pureobom: Try an example** or **Pureobom: Explain current file**; choose English in the panel.

**Python 원문 읽기 / Python source:** 0.7 개발판은 설치된 Python AST로 현재 파일의 일부 구문·분기·예외와 실제 값을 읽습니다. 사용자 코드를 실행하거나 가져오지 않으며 모델/API가 필요 없습니다. 문자열·숫자·참거짓 하나를 Python diff→적용→undo로 수정합니다. Python 타입 검사·연결 지도·시뮬레이션은 미제공입니다. Requires local desktop VS Code and Python; select a different interpreter with the user setting `pureobom.analysisPython`. [범위·설정·외부 검증 / Guide and evidence](https://github.com/him55710-sudo/pureobom/blob/main/docs/PYTHON_SOURCE.md).

**프로젝트 검사 / Project checks:** 0.7 개발판은 등록한 VS Code test/build 명령의 실행도 연결합니다. 명령을 검토하고 파일을 저장한 뒤 실행하며, 실제 종료 코드와 파일 변경 여부를 표시합니다. 로컬 AI 연결은 필요 없습니다. Runs an explicitly reviewed project command; an exit code is not a guarantee of correctness. [설정·범위 / Setup and limits](https://github.com/him55710-sudo/pureobom/blob/main/docs/PROJECT_CHECKS.md).

**전후 측정 / Before and after:** 같은 탭에서 반복 가능한 process 명령을 확인하고 변경 전후 각각 7회 시간·최대 메모리·출력 해시를 측정합니다. 로컬 Python 3가 필요합니다. 실제 검사 기록과 변동 범위를 함께 보며 JSON 보고서를 열 수 있습니다. No AI/API is needed; commands execute real project code with normal user privileges. [사용법·측정 한계 / Measurement guide](https://github.com/him55710-sudo/pureobom/blob/main/docs/BENCHMARKS.md).

코딩 문법이 낯설어도 **문장으로 읽고, 표에서 규칙을 바꾸고, 연결 지도로 구조를 확인하는** 로컬 시제품입니다. JavaScript·TypeScript·JSX·TSX 코드를 한국어와 영어로 설명합니다. JSON/JSONC는 모델 없이 실제 키 경로·자료형·값을 읽고 문자열·숫자·참거짓 값 하나의 미리보기·적용·undo를 제공합니다. 숫자 표기와 주석을 보존하고 중복 키 범위의 수정은 막습니다. 소비 프로그램의 동작은 추측하지 않습니다. [범위와 예제 / JSON data guide](https://github.com/him55710-sudo/pureobom/blob/main/docs/JSON_DATA.md).

**Go 원문 읽기 / Go source:** 설치된 Go SDK로 일부 구문·여러 반환값·defer와 정확한 문자열/숫자를 읽고 수정합니다. 첫 사용에 고정 표준 라이브러리 도구만 로컬에서 빌드하며 사용자 소스는 실행하지 않습니다. API 비용은 없지만 SDK 설치가 필요합니다. `pureobom.analysisGo`로 실행 파일을 지정합니다. Syntax only; types, ranges, dependencies, behavior and performance need separate project checks. [범위·설정·Google UUID 검증 / Guide and evidence](https://github.com/him55710-sudo/pureobom/blob/main/docs/GO_SOURCE.md).

**Java 원문 읽기 / Java source:** JDK 21+로 일부 구문·예외·자원 정리와 정확한 문자열/숫자/참거짓 값을 읽고 수정합니다. `pureobom.analysisJavaHome`에 JDK 폴더 절대 경로를 설정하거나 JAVA_HOME/PATH를 사용합니다. 사용자 코드는 컴파일·실행하지 않습니다. Local desktop only; parsing does not verify types, dependencies, behavior or performance. No model or paid API required. [범위·설정 / Guide](https://github.com/him55710-sudo/pureobom/blob/main/docs/JAVA_SOURCE.md).

## 시작하기

0.5에서는 **풀어봄: React 화면 문구 바꿔보기 / Pureobom: Edit React interface text** 명령도 제공합니다. 화면 요소·문구·조건·이벤트 속성을 펼쳐 읽고 문구를 선택해 실제 코드의 변경안을 만드세요. 화면을 실행하거나 최종 디자인을 재현하지는 않습니다.

1. VS Code 1.96 이상에서 확장 탭을 엽니다. (`Ctrl+Shift+X`)
2. 상단 `…` → **VSIX에서 설치… / Install from VSIX…** 를 선택하고 내려받거나 직접 빌드한 VSIX를 엽니다. 0.7 개발 소스를 빌드하면 `pureobom-0.7.0.vsix`가 생성되며, 공개 0.6.0에는 로컬 AI가 없습니다.
3. `.ts` 또는 `.js` 파일을 열고, `Ctrl+Shift+P` → **풀어봄: 현재 파일 설명 열기**를 실행합니다. 편집기 오른쪽 위 책 아이콘으로도 열 수 있습니다.
4. 처음이라면 왼쪽 풀어봄 아이콘 → **예제로 시작하기**를 누르세요.

기본 문법 분석에는 Node.js 별도 설치, API 키, 웹 서버가 필요하지 않습니다. 선택형 로컬 AI에는 설치한 Ollama와 로컬 모델이 필요하며, Python 변경안 문법 검사에는 로컬 Python이 필요합니다. 모델 없이 기존 기능을 사용할 수 있습니다. 로컬 AI 요청은 외부 호스트로 보내지 않습니다. 사용자가 실행한 프로젝트 검사 명령의 파일·네트워크 동작과 비용은 해당 프로젝트에 따라 달라집니다.

상단 **도움말·피드백 / Help & feedback**에서 설치 안내와 저장소를 열거나, 완료·막힘·미지원 경험을 남길 요약을 만들 수 있습니다. 작성한 내용과 버전·환경·언어만 미리 보고 복사합니다. 코드·파일명은 자동 첨부하지 않으며, GitHub에 공유하려면 직접 붙여 넣고 제출해야 합니다.

## 실제 사용 흐름

- **문장으로 읽기:** 함수가 받는 정보, 조건에 따른 분기, 반환·오류 처리 설명을 봅니다. `L숫자`를 누르면 실제 코드의 해당 줄로 이동합니다.
- **내 프로젝트 용어:** 설명 위에서 코드 이름을 선택하고 한국어·영어 뜻을 직접 지정합니다. 설명과 규칙 표, 문장 수정 요청에 반영됩니다. 코드 식별자는 바꾸지 않습니다. 용어는 현재 VS Code 작업 공간에 문서 URI와 선언별로 저장되며, 저장하지 않은 새 문서의 용어는 현재 세션에서만 유지됩니다. 속성·import·중첩 블록 선언은 아직 지정할 수 없습니다.
- **규칙 바꾸기:** `무료 배송 기준`을 선택하거나 `무료 배송 기준을 70000으로 변경`이라고 적습니다. 하나의 이름과 하나의 값만 지원합니다.
- **변경안 확인:** 값의 차이를 먼저 보고, **VS Code에서 차이 비교**로 원본 전체와 변경본을 비교합니다.
- **변경 전후 비교:** 아래 입력 표에서 최대 12개 사례를 확인합니다. 달라짐·같음·확인 불가를 구분하며, 추천 입력 외에 직접 중요한 사례를 넣을 수 있습니다. 비교 설명서는 새 Markdown 문서로 열리고 원하면 저장할 수 있습니다. 가져오지 않은 상대 경로 연결 파일이 있으면 연결 지도를 먼저 읽어 주세요.
- **편집기에 적용:** 열려 있는 문서에 변경이 반영됩니다. **Ctrl+Z**로 실행 취소하고 **Ctrl+S**로 저장합니다. 자동 저장 설정을 켠 VS Code에서는 설정에 따라 저장될 수 있습니다.
- **편집기 알림:** VS Code가 보고한 현재 파일의 오류·경고와 검사 도구의 원래 메시지를 확인합니다. TypeScript의 일부 오류에는 쉬운 한국어·영어 뜻풀이를 붙이며, 위치 버튼은 정확한 원문 범위를 선택합니다. 코드 변경 후 아직 갱신되지 않은 알림은 구분합니다. 알림이 없다고 검사 완료나 정상 동작을 뜻하지 않습니다.
- **검토할 부분:** 편집기 알림과 별도로 풀어봄의 문법 오류·일부 검토 패턴의 근거도 확인합니다.
- **연결 지도:** 작업 공간의 파일을 읽어 정적 상대 경로 import/export 관계를 표시합니다. 파일을 누르면 해당 코드와 설명이 열립니다. 새 파일·외부 파일 변경은 **작업 공간 연결 읽기**로 다시 읽으세요.
- **값을 넣어 확인:** `[50000]`처럼 함수 인자를 JSON 배열로 넣어 지원되는 순수 계산을 따라갑니다. 사용자 코드를 직접 실행하는 기능은 아닙니다.

저장 전 편집 내용도 설명에 반영됩니다. 변경안을 만든 뒤 문서가 바뀌거나 다른 파일로 전환하면 이전 변경안을 적용할 수 없습니다. VS Code의 밝은 테마·어두운 테마·대비 색상과 글꼴 설정을 사용합니다. 연결 그래프의 바탕은 밝은 색입니다.

## 현재 범위

기본 읽기는 **구문 분석과 용어 사전**을 사용합니다. 별도의 **로컬 AI** 탭은 사용자가 선택한 Ollama 모델의 추론을 사용합니다. 모델 없이 기존 읽기·규칙 수정도 사용할 수 있습니다. 모델 설명과 최적화 제안의 의미·품질은 별도 검토가 필요합니다.

| 항목 | 지원 범위 |
| --- | --- |
| 수정 | 기본 모드는 숫자·문자열·불리언 리터럴과 비교 연산자 한 곳. 로컬 AI는 현재 파일에서 최대 8개 정확한 범위 변경 제안. 다중 파일 리팩터링 미지원 |
| 검사 | 문법 파싱·검토 패턴, 현재 파일 알림, 사용자가 등록·검토한 실제 프로젝트 명령. 사전 타입 검사·보안 감사·전체 동작 보증은 제공하지 않음 |
| 모의 실행 | 한도 있는 while·지역 값 갱신·배열 map/숫자 at을 포함한 제한된 계산. 네트워크, DOM, 비동기, 외부 패키지, 객체 속성 쓰기, 다른 반복 구문 등 미지원 동작은 거부 |
| 연결 | 정적인 상대 경로 import/export. 별칭, require, 동적 import 미해석. 그래프 최대 40개 파일 |
| 크기 | 기존 읽기는 파일당 512KB, 최대 300개, 합계 8MB. 로컬 AI는 현재 파일 24KB와 합산 요청 예산을 별도 제한. 숨김·의존성·빌드 파일은 작업 공간 검색에서 제외 |
| 제한 모드 | 설명 열람 가능. 수정안 생성·적용은 신뢰한 작업 공간에서 가능 |
| 환경 | 데스크톱 VS Code의 Node 확장 호스트. vscode.dev·가상 작업 공간은 미지원. 원격 환경은 미검증 |

문법 검사를 통과해도 의도한 동작과 일치한다는 보장은 없습니다. 실제 기능·테스트 결과와 함께 확인하세요.

## 연구에서 가져온 설계

자연어와 직접 조작을 함께 제공하고, 설명을 원본 위치에 연결하며, 변경 전후를 확인하도록 설계했습니다. Consensus에서 확인한 연구는 연구 노트에 정리되어 있습니다. 해당 연구의 결과가 이 제품의 사용자 효과를 입증하는 것은 아닙니다.

- [Direct Manipulation and Natural Language Programming, Together at Last?](https://consensus.app/papers/direct-manipulation-and-natural-language-programming-ziegler-cao/9efe9ec848035295a07fb95e4cda830b/)
- [Beginners Struggle to Understand LLM-Generated Code](https://consensus.app/papers/i-would-have-written-my-code-differently-beginners-zi-li/5a84eb0eab1c5a3baf17cc92adcae33b/)
- [Bidirectional evaluation with direct manipulation](https://consensus.app/papers/bidirectional-evaluation-with-direct-manipulation-mayer-kunčak/aaade7dd902c5a7e8bc4db392404554e/)

소스와 상세 검증 기록은 함께 제공된 프로젝트의 `extension/`, `docs/` 폴더에 있습니다. 현재는 로컬 VSIX로 배포하며 Marketplace에는 게시하지 않았습니다.

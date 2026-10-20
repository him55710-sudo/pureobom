# 언어별 지원과 검증 · Language support

2026-10-20 기준. **0.7 개발 소스**의 범위이며 공개 0.6.0 설치본과 다르다. 모델이 해당 언어를 학습했다는 설명만으로 프로젝트 연동이나 정확성을 검증했다고 간주하지 않는다. [로컬 AI 사용법](LOCAL_AI.md).

JS/TS 계산 미리보기에는 [한도 있는 while·지역 변수 갱신·배열 콜백](BOUNDED_PREVIEW.md)을 추가했다. 비공개 실제 대상 함수의 원래 assertion 3사례와 별도 선정 11사례가 Node와 일치했지만, 모든 구문·입력·다른 언어의 모의 실행 지원이나 모델 설명 정확성을 뜻하지 않는다.

사용자용 [전후 측정](BENCHMARKS.md)은 언어 이름에 따른 내장 최적화기가 아니다. 기존 process 명령과 로컬 실행 도구를 사용하며 별도 Python 3 측정 도구가 필요하다. 전체 명령의 시간·OS 최대 메모리·출력 해시를 기록한다. 문법·의미·프로젝트 정확성은 아래 범위와 별도 검사 결과로 판단한다.

14개 언어 식별자에 대한 실제 3B 모델의 설명·수정 28회와 [의미 검토](evidence/local-ai/language-review.md)를 공개했다. 설명 형식이 통과해도 CSS·JSONC의 오류와 Python·Go의 누락 등이 있었다. 아래 '응답 기록'은 안정적인 설명 품질 인증이 아니다.

같은 10개 사례에서 프롬프트 수정 전후와 다른 로컬 모델을 비교하는 [후속 의미 검토](evidence/local-ai/semantic-review.md)도 공개한다. 실제 분기·예외의 인용은 일부 늘었지만 비교 경계·단위·JSONC 소비 동작에 대한 잘못된 설명이 남았다. 모델 형식 검사와 사람의 의미 검토를 별도로 기록한다.

| 언어 | 현재 문법 기반 읽기/수정 | Ollama 설명·수정 | 로컬 문법/타입 검사 | 실제 외부 프로젝트 | 최적화 측정 |
| --- | --- | --- | --- | --- | --- |
| JavaScript / TypeScript / JSX / TSX | 일부 구문 설명, 리터럴·비교 수정, JSX 문구 수정 | 각 형식의 합성 설명·수정 기록. JS/TS의 일부 주의점·확인 항목 오류 | 제안 파싱; VS Code 현재 파일 보고 연결. 전체 타입 검사 미제공 | clsx v2.1.1: 실제 검사 32개 통과→고정 오류 25개 실패→undo 후 32개 통과. Node 24의 구형 테스트 로더 실패는 별도 공개 | 등록 process 명령 측정 제공. 합성 Node 명령으로 연결 검증; clsx 최적화 측정은 아님 |
| Python | [설치 Python AST의 일부 구문·분기·예외 설명과 정확한 리터럴 수정](PYTHON_SOURCE.md). 로컬 VS Code만; 타입·import 지도·시뮬레이션 미제공 | 실제 배송 예제 설명·수정, 외부 프로젝트 변경·원문 선택·diff·적용·undo 검증 | 모델 제안은 격리 ast.parse; 새 직접 읽기/수정은 parse 후 컴파일로 범위 오류도 확인. 사용자 코드 비실행, 타입 검사 아님 | itsdangerous 2.2.0: 기존 모델 변경 전후 297개; 새 AST 값 수정은 원본 297개 통과→고정 오류 38개 실패→undo 후 297개 통과 | 등록 명령의 실제 전후 각 7회 측정. 제안이 느려 미채택; Windows venv 실행기 메모리는 비교 제외 |
| Go | [설치 Go 표준 AST의 일부 구문·여러 반환식·defer와 문자열/숫자 수정](GO_SOURCE.md). 로컬 VS Code만; import 지도·시뮬레이션 미제공 | 합성 모델 설명·수정 기록에는 오류 반환 누락이 남음. 새 파서 검증은 모델 품질과 별도 | 직접 수정/모델 제안의 Go 문법 파싱. 타입·범위·의존성·동작 검사 아님 | Google UUID v1.6.0: 201 pass·1 skip → 고정 오류로 TestUUID 실패 → undo 후 201 pass·1 skip. Go 1.27.2/Windows | 공통 process 측정 연결 제공, Go 최적화 측정은 미검증 |
| Rust | [포함된 WASM 파서의 일부 함수·분기·패턴 설명과 숫자/bool/UTF-8 문자열 수정](RUST_SOURCE.md). VS Code 개발판; 읽기·값 수정에 API·모델·Rust SDK 불필요 | 기존 합성 설명·수정 기록에는 코드에 없는 사업적 이유 추측. 새 파서 검증과 별도 | 직접 수정/모델 제안의 문법 파싱. rustc·타입·소유권·매크로·cfg·동작 검증 아님 | [humantime 2.3.0](evidence/local-ai/rust-source-project.md): 42 pass → 시간 상수 변경 후 8 fail → native undo 후 42 pass. Windows/Rust 1.90 GNU+LLVM, all-features. 의도적 오류 검출 | 공통 process 측정 연결 제공, Rust 최적화 미검증 |
| Java | [설치 JDK 파서의 일부 구문·분기·자원 정리와 정확한 리터럴 수정](JAVA_SOURCE.md). 로컬 VS Code만; 타입·import 지도·시뮬레이션 미제공 | 기존 합성 설명·수정 기록은 한 메서드 사례 한정. 새 파서 검사는 모델 품질과 별도 | 직접 수정/모델 제안의 JDK 문법 파싱. 타입·의존성·동작 검사 아님 | [minimal-json 고정 사례](evidence/local-ai/java-source-project.md), 기존 라이브러리 테스트·편집기 적용·undo. Maven 전체 빌드와 별도 | 공통 process 측정 연결 제공, Java 최적화 측정은 미검증 |
| C# | [설치 .NET SDK Roslyn의 일부 구문·분기·예외와 정확한 리터럴 수정](CSHARP_SOURCE.md). 로컬 VS Code만; 타입·프로젝트 의미 미검증 | 기존 합성 모델 기록과 새 문법 검사 경로는 별도. 모델 의미 정확성 미보장 | 직접 수정/모델 제안의 문법 파싱. 프로젝트 언어 버전·define·타입·의존성·동작 검사 아님 | [GuardClauses 고정 사례](evidence/local-ai/csharp-source-project.md): 959 pass → 고정 오류로 7 fail → undo 후 959 pass. SDK 10에서 net8.0 테스트를 Major roll-forward로 실행 | 공통 process 측정 연결 제공, C# 최적화 측정 미검증 |
| HTML / CSS | [포함된 파서로 태그·문구·속성·선택자·선언 값 읽기 및 일부 값 수정](HTML_CSS_SOURCE.md). 브라우저와 VS Code; 스크립트 비실행 | 기존 합성 설명·수정 기록의 CSS 열 개수 오류는 별도로 남음 | 원문 파싱·CSS 토큰 닫힘 검사. 직접 CSS 수정은 알려진 속성 문법도 일부 확인. 문서 적합성·렌더링·우선순위 검사 아님 | [modern-normalize v3.0.1](evidence/local-ai/web-source-project.md): HTML 읽기, CSS 값 수정→Chrome 전체 54개 중 실패 7→9→undo 후 7. 원본 실패·TODO 8개 보존. Windows/Chrome 한 조합 | 공통 process 측정 연결 제공. 브라우저 렌더링 성능 미검증 |
| SQL | [명시적으로 선택한 SQLite의 일부 구조·조건·정확한 숫자/문자열 수정](SQL_SOURCE.md). 포함된 파서, 브라우저·VS Code. 다른 방언 미제공 | 기존 모델 기록과 새 원문 파서 검증은 별도. 모델 의미 정확성 미보장 | SQLite 3.53.0 문법 파싱; 스키마·DB 결과 미검증. 미선택 방언은 미검증 | [sqlc SQLite 예제](evidence/local-ai/sql-source-project.md): 공식 재생성·원래 TestAuthors 1 pass → 고정 LIMIT 오류 1 fail → undo 후 1 pass. 전체 sqlc 검사 아님 | 공통 process 측정 연결 제공. DB 쿼리 성능 미검증 |
| JSON / JSONC | [모델 없는 키 경로·자료형·실제 값·원문 줄](JSON_DATA.md), 문자열·숫자·참거짓의 범위 수정. 숫자 표기·JSONC 주석·끝 쉼표 보존; 중복 키 수정 제한 | 각 형식의 합성 설명·수정 기록. JSONC의 실제 적용 방식에 잘못된 추측 | JSON 및 JSONC 제안 문법 검사. 데이터 의미·소비 프로그램 검증 아님 | 소비 프로그램은 미검증. 실제 VS Code의 모델 없는 데이터 수정·diff·undo 별도 확인 | 소비 프로그램의 등록 process 명령 측정 가능, 실제 소비 사례 미검증 |

설명 UI는 한국어와 영어다. 프로그래밍 언어 지원과 UI 언어 지원은 다른 항목이다. 기존 0.6.0의 검증은 [릴리스 기록](RELEASE_VALIDATION.md), 새 구현 순서는 [완성 계획](PRODUCT_COMPLETION.md), 실제 작업은 [작업 기록](AGENT_WORKLOG.md)을 따른다.

개발판의 [실제 프로젝트 검사](PROJECT_CHECKS.md)는 언어와 무관하게 사용자가 등록한 VS Code test/build 명령을 연결한다. 언어 도구·의존성이 설치돼 있어야 하며 풀어봄이 해당 언어의 검사기를 제공한다는 뜻은 아니다. 실제 외부 검증은 Python itsdangerous, [JavaScript clsx](evidence/local-ai/clsx-review.md), [Go Google UUID](evidence/local-ai/go-source-project.md), [HTML/CSS modern-normalize](evidence/local-ai/web-source-project.md)의 고정 사례다. 종료 코드와 파일 변경 관찰을 기록하며 최적화 효과를 판정하지 않는다.

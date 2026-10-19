# 계산 과정에서 원본 코드로 이동 · 0.7 개발판

다른 파일의 함수를 계산한 뒤 과정의 줄 버튼을 누르면 현재 문서의 같은 줄로 이동하던 오류를 수정한다. 각 계산 항목에 실제 AST 파일 경로와 1부터 시작하는 줄 번호를 붙이고, 확장과 브라우저 화면에 함께 표시한다. 표시 한도 때문에 생략한 항목에는 원본 링크를 붙이지 않는다.

확장은 가장 최근 계산의 파일/원문과 경로를 호스트 안에 보관한다. 화면은 계산 식별자와 항목 번호만 보내며 이동할 파일 경로를 지정하지 않는다. 호스트는 해당 기록의 URI를 열고 당시 원문과 현재 문서를 비교한 뒤 줄을 선택한다. 파일을 여는 동안 코드가 바뀌었는지도 다시 확인한다. 계산을 다시 하거나 현재 설명이 갱신되면 이전 링크는 사용할 수 없다. 읽지 않은 의존 파일의 디스크 변경은 편집기 변경 알림이 없어도 대상 원문 비교로 거절한다.

이는 코드 변경을 수행하지 않는 이동 기능이다. 모든 의존 파일의 외부 변경을 실시간 감시하거나, 프로젝트 실행의 정확성/성능을 증명하는 기능은 아니다. 링크가 오래됐다면 연결 지도를 다시 읽고 계산한다. 직접 화면 검증과 native 편집기 API 검증은 구분한다. 안정판/Pages 0.6.0은 이 개발 변경을 포함하지 않는다.

## 검증과 재현

`tests/trace-source.test.ts`는 import된 조건·while·콜백·return의 파일과 정확한 줄, 실패 중 남은 경로, 생략 항목, JSON 전달을 검사한다. `extension/test/traceSource.ts`는 같은 basename을 가진 두 파일을 실제 worker/controller로 계산하고 native 편집기에서 선택한 URI와 줄을 확인한다. 위조/이전 계산 식별자·범위를 벗어난 항목·반환 객체 변조·열지 않은 파일의 디스크 변경도 검사한다. 고정 공개 예제이며 비공개 사용자 코드나 모델 응답을 포함하지 않는다.

```sh
pnpm exec vitest run tests/trace-source.test.ts
pnpm extension:build
node scripts/test-extension.mjs --trace-source
pnpm extension:package
node scripts/test-extension.mjs --installed --trace-source
node scripts/preview-ui.mjs --trace
```

부분 native 실행은 `scope: trace-source-only`와 별도 결과 파일을 사용한다. 기본 `pnpm extension:test`와 설치본 전체 검사에도 같은 검사가 포함된다. 실행별 성공/실패·버전은 [검증 기록](evidence/local-ai/trace-navigation.json)을 따른다. 이전 [반복 계산 CI](evidence/local-ai/iteration-preview-ci.json)는 이 수정 전 소스의 근거다.

# 제한된 반복 계산 미리보기 · 0.7 개발판

실제 프로젝트에서 선택한 함수가 `while`, 지역 변수 갱신, 배열 `map`·`at` 때문에 확인 불가였던 문제를 보완한다. 코드를 실행기에 넘기는 대신 기존 AST 해석기로 지원 구문을 따라 계산한다. 유료 API나 모델, Node 실행기가 필요하지 않다. 공개 안정판·Pages 0.6.0의 기능과 구분한다.

## 동작

- `while`의 조건을 매번 다시 읽고, 지역 `let`·인수의 대입/복합 대입/증감과 비트 연산을 계산한다. `break`, `continue`, 조기 `return`을 가장 가까운 반복문/함수에 연결한다.
- 블록의 지역 이름은 바깥 이름과 구분하고, 콜백은 참조하는 바깥 지역 변수의 최신 값을 읽는다. `const` 대입, 초기화 전 참조, 전역 값 대입은 거절한다. 매 호출은 독립적인 환경을 사용한다.
- 배열 `map`은 해석할 수 있는 함수에 값·인덱스·배열을 전달하고 빈 자리를 보존한다. 함수는 내부 AST 참조이며 호스트 JavaScript 함수로 실행하지 않는다. 호출 대상과 배열을 인수보다 먼저 결정한다.
- 배열·문자열 `at`은 숫자 인덱스 또는 인수 생략을 지원한다. 숫자가 아닌 인덱스는 확인 불가다. 문자열은 JavaScript와 같은 UTF-16 코드 단위로 읽는다.
- 모듈의 상수/함수 값을 한 미리보기 안에서 재사용하여 같은 객체나 함수의 참조를 유지한다. 완전한 ES module 초기화·순환 import 의미 분석은 제공하지 않는다.
- 기존 **4,000회 연산 예산, 호출 깊이 32**를 반복문과 콜백이 공유한다. 끝나지 않는 반복이나 예산 초과는 계산 성공이 아니다. 4,000번의 반복을 보장한다는 뜻도 아니다. 반복 한 번에 여러 연산이 필요하다.
- 경로 표시는 200개 또는 누적 30,000자에 도달하면 추가 표시를 중단하고 생략 안내를 남긴다. 개별 긴 항목은 2,000자 뒤 표시 한도를 알린다. 반환 결과의 값 보존·크기 제한은 [기존 전달 형식](evidence/local-ai/preview-values.md)을 따른다.

`for`/`for…of`, 구조 분해·rest, 객체/배열 속성 쓰기, 임의 메서드, `this`/`arguments`, 함수가 포함된 최종 결과, 비동기·네트워크·DOM·외부 패키지·동적 코드 실행 등은 미지원이다. 실제 앱 실행이나 프로젝트 전체의 동작 검증을 대신하지 않는다. 일부 경로를 계산할 수 있어도 모든 입력이나 문법의 의미를 확인했다는 뜻은 아니다.

설계 기준은 [ECMAScript while](https://tc39.es/ecma262/2024/multipage/ecmascript-language-statements-and-declarations.html#sec-while-statement), [배열 map](https://tc39.es/ecma262/2024/multipage/indexed-collections.html#sec-array.prototype.map), [배열 at](https://tc39.es/ecma262/2024/multipage/indexed-collections.html#sec-array.prototype.at)이다. 표준 전체 구현을 주장하지 않고 공개된 고정 예제를 독립 Node 실행과 대조한다.

## 실제 프로젝트와 제품 검사를 구분하기

변경하지 않은 비공개 사용자 코드의 **원래 요청 대상 함수**를 실제 제품 worker로 확인했다. 그 프로젝트의 원래 assertion에서 가져온 입력/기대 결과 3개, 별도로 선정한 입력 11개를 Node 결과와 대조해 **14개 일치**를 확인했다. Node가 예외를 낸 입력 1개는 제품에서도 확인 불가였다. 원본 해시는 유지됐다. 3개 assertion 사례를 프로젝트의 원래 테스트 3개라고 바꾸어 부르지 않는다.

처음 만든 검증 도구는 한 선정 입력에서 Node가 예외를 던진다고 잘못 가정해 실패했다. 실제 Node의 반환을 기준으로 비교하도록 도구를 고쳤으며, 첫 실패와 후속 기록을 모두 로컬에 보존했다. 공개 자료에는 비공개 함수명·파일·입력·결과·소스를 넣지 않는다. 이전 설명/수정 모델의 실패, 과학적 타당성 및 최적화 성과는 이 계산 일치로 해결되지 않는다.

`tests/iteration-preview.test.ts`는 공개 fixture의 독립 Node 결과와 해석 결과/JSON 전달을 대조하고, 이름 가림·기본 인수·호출 순서·빈 배열 자리·부호 있는 비트 연산·예외/금지 기능·예산을 검사한다. Node로 실행하는 것은 저장소에 고정한 공개 검증 코드뿐이다. `extension/test/iterationPreview.ts`는 실제 controller/worker에서 계산→준비한 값 변경 전후 비교→예산 초과→소스 보존을 검사한다. 실행별 결과는 [증거 자료](evidence/local-ai/iteration-preview.json)에 남긴다.

로컬 부분 검사 118개와 실제 개발 호스트 58개는 통과했다. 전체 첫 실행은 Java 검사 2개/.NET 준비 시간 초과로 290 pass / 2 fail / 9 skip이며 통과로 재분류하지 않는다. 브라우저 UI 자동 연결은 두 번 timeout으로 완료하지 못했다. controller 검증과 화면 직접 확인을 혼동하지 않는다.

실패한 Java/.NET 두 파일만 소스·시간 한도 변경 없이 다시 실행한 결과는 17개 통과다. 첫 전체 실행과 별도 결과다. 후속 검토에서 확인한 미완료 항목도 있다. 확장 고급 계산의 다른 파일 호출 trace는 문구에 파일명이 있어도 줄 버튼이 현재 문서로 이동하므로, 파일별 이동 연결을 별도로 고쳐야 한다. 이번 실제 대상은 같은 파일 내부 계산이며 다른 파일의 trace 이동 검증으로 세지 않는다.

최종 기능 커밋 `5242fcc`의 [Windows·Ubuntu CI](https://github.com/him55710-sudo/pureobom/actions/runs/39316887882)는 각 **핵심 301개, 개발/production 설치 각 58개**, 설치 파일 11개 해시와 추출 도구 검사를 통과했다. [운영체제별 기록과 패키지 해시](evidence/local-ai/iteration-preview-ci.json). 로컬 시간 초과·브라우저 연결 실패와 다른 파일 이동의 남은 결함은 이 통과로 없어지지 않는다.

## 재현

위에서 기록한 다른 파일 trace 이동 결함은 후속 [계산 출처 이동](TRACE_NAVIGATION.md)에서 수정한다. 그 수정의 검증은 별도 기록이며 `5242fcc` 결과에 소급하지 않는다.

```sh
pnpm exec vitest run tests/iteration-preview.test.ts
pnpm extension:build
pnpm extension:test
pnpm extension:package
pnpm extension:test:installed
node scripts/preview-ui.mjs --iteration
```

UI 검증 서버는 실제 확장 화면/worker와 모의 편집기를 사용한다. 공개 예제를 읽고 고급 계산 입력 `[3]`으로 결과와 반복 진입 수를 확인한다. 비공개 실제 프로젝트 검증과 이 UI fixture는 다른 근거다.

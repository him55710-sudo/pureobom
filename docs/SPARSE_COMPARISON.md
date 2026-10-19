# 배열의 빈 자리도 변경으로 비교하기 · 0.7 개발판

코드를 바꾼 뒤 반환 배열의 모양이 달라져도 **같음**으로 표시하는 비교 엔진 결함을 수정했다. `[]`는 길이가 0이고 `[,]`는 길이가 1인 배열이지만 0번 자리가 존재하지 않는다. 두 값을 같은 결과로 취급하면 변경 영향 판단을 잘못 안내한다.

이 결함은 제품 코드 검토와 공개 예제로 재현했다. 사용자 비공개 프로젝트에서 발견한 결함이나 실제 모델의 최적화 성공 사례로 세지 않는다.

## 원인과 수정

`scenarios.ts`는 객체의 키 순서에 영향을 받지 않고 `NaN`, 무한대, `-0`, `undefined`를 구분하는 비교 표현을 만든다. 그러나 배열에는 `map(...).join(...)`을 사용했다. `map`이 없는 자리를 방문하지 않아 빈 배열과 한 자리 빈 배열이 모두 같은 표현이 됐다. 이 충돌은 중첩 배열·객체 안에서도 발생했다.

이제 배열의 길이만큼 각 위치가 **실제로 존재하는지** 확인하고, 없는 위치에는 값과 구별되는 표식을 넣는다. 실제 `undefined` 원소나 문자열과 혼동하지 않는다. 이는 비교 표현만 바꾸며 원본 데이터·화면의 특수값 전달 형식은 그대로 유지한다.

| 비교 대상 | 수정 전 | 수정 후 |
| --- | --- | --- |
| `[]` → `[,]` | 같음 — 오류 | 달라짐 |
| `[[]]` → `[[,]]` | 같음 — 오류 | 달라짐 |
| `{ a: [,] }` → `{ a: [] }` | 같음 — 오류 | 달라짐 |
| `[,]` → `[undefined]` | 달라짐 | 달라짐 |
| `[,1]` → `[1,,]` | 달라짐 | 달라짐 |
| `[,,]` → `[,]` | 달라짐 | 달라짐 |
| `[,1]` → `[,1]` | 같음 | 같음 |

## 검증

수정 전 공개 회귀 검사는 17개 중 14 pass/3 fail이었다. 실패 세 개 모두 달라진 배열을 같다고 표시했다. 수정 후 비교·값 전달·산술 기록의 핵심 부분 29개/3파일과 확장 빌드가 통과했다. 기존 값 보존과 한/영 Markdown 보고서가 사용하는 비교 상태를 유지한다.

[수정 전 실패와 로컬 검사 로그 해시](evidence/local-ai/sparse-comparison-verification.json)를 공개한다. 재현 예제는 제품 회귀 검사이며 실제 사용자 과제의 성공 수로 합산하지 않는다.

native 검사에는 실제 변경안 준비 → worker 비교 → VS Code 웹뷰 왕복 → 한/영 보고서 확인을 추가했다. 중첩 배열의 길이와 자리 부재, 변경 상태, 원문 미적용을 대조한다. 이 검사의 최종 Windows·Ubuntu 개발/설치본 결과는 별도 CI 근거를 따른다. 에이전트의 native API 검사이며 화면 버튼을 직접 클릭한 사용자 검증으로 세지 않는다.

기능 커밋 `25d0c27`의 [Windows·Ubuntu CI](https://github.com/him55710-sudo/pureobom/actions/runs/39339164282)는 각 핵심 **342개**, 실제 개발/production 설치 검사 각각 **68개**, 설치 파일 11개 해시·패키지 검사 7개를 통과했다. [운영체제별 실제 로그 근거](evidence/local-ai/sparse-comparison-ci.json)에 새 배열 비교 검사가 포함됐음을 대조했다. 안정판/Pages 배포와 구분한다.

```sh
pnpm exec vitest run tests/scenarios.test.ts tests/preview-values.test.ts tests/arithmetic-records.test.ts
pnpm extension:build
# Full development and installed integration suites:
pnpm extension:test
pnpm extension:package
pnpm extension:test:installed
```

변경 비교는 지원 구문의 **지정한 입력에서 반환한 값**에 한정한다. 앱의 부작용·전체 동작·성능이 같다는 증명이 아니다. 미지원·계산 실패를 통과로 표시하지 않으며 실제 프로젝트 테스트와 성능 측정은 별도로 수행한다. 모델 설명이나 실제 비공개 과제 결과를 이 회귀 검사 통과로 대체하지 않는다.

English: empty arrays and arrays with missing slots must not compare as unchanged. Preserve length and slot presence in the comparison representation, including nested arrays and objects. Seven public regression cases retain explicit undefined and positional distinctions. This fixes a product comparison defect; it does not establish native whole-application equivalence or successful model optimization.

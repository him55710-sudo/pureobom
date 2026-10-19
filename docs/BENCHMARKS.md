# 변경 전후 성능 측정 · Before/after measurements

0.7 개발 소스의 VS Code 기능이다. 공개 0.6.0 설치본과 브라우저 데모에는 없다. Ollama·API 키·Python 추가 패키지는 필요하지 않다. 로컬 Python 3와 측정할 프로젝트의 실행 도구가 필요하다. 반복 실행되는 명령 자체가 외부 유료 서비스를 부르면 그 비용까지 없애 주지는 않는다.

## 사용 흐름

1. 신뢰한 로컬 프로젝트에서 대상 파일을 열고 저장한다. **검사** 또는 **로컬 AI** 탭의 **실제 프로젝트 검사**에서 명령 목록을 읽는다.
2. 반복 가능한 작업을 선택한다. 측정은 `group: "test"` 또는 `"build"`의 일회성 **process** 작업만 받는다. 실행 파일과 인수, 작업 폴더를 **측정 명령 확인**에서 확인한다. 셸·배치 파일·백그라운드 작업·대화형 입력은 지원하지 않는다.
3. 명령의 반복 실행을 확인한 뒤 **변경 전 측정**을 누른다. 준비 1회와 기록용 7회를 별도 프로세스로 실행한다. 새 기준선은 이전 기록을 교체한다.
4. 코드를 검토해 수정하거나 로컬 AI의 diff를 확인해 적용한다. 먼저 저장하고 별도 테스트·빌드를 실행한다. **같은 측정 명령**을 다시 선택·확인하고 **변경 후 측정**을 누른다.
5. 시간·메모리·출력 일치·검사 기록을 함께 본다. **측정 기록을 JSON 문서로 열기**로 7회 원자료, 해시, 도구 환경을 확인하고 원하는 곳에 저장한다. 기록은 세션 메모리에만 있으며 자동 업로드되지 않는다. 보고서에는 경로와 명령 인수가 포함되므로 공유 전에 확인한다.

Python을 찾지 못하면 VS Code 설정 **Pureobom: Benchmark Python** (`pureobom.benchmarkPython`)에 Python 3 실행 파일의 전체 경로를 넣는다. 빈 값은 Windows의 `python`, Linux/macOS의 `python3`다. 작업 공간이 이 설정을 몰래 덮어쓰지 못하도록 application 범위를 사용한다.

예를 들어 프로젝트의 `scripts/benchmark.py`가 고정 입력·정답을 검증하고 반복 가능한 결과를 출력하도록 만든 뒤 등록한다. 이 스크립트는 프로젝트별로 작성·검토해야 하며 모델의 임의 명령을 실행하지 않는다.

```json
{
  "version": "2.0.0",
  "tasks": [{
    "label": "Repeatable benchmark",
    "type": "process",
    "command": "python",
    "args": ["scripts/benchmark.py"],
    "options": { "cwd": "${workspaceFolder}" },
    "group": "test",
    "problemMatcher": []
  }]
}
```

Node 프로젝트라면 실제 `node` 실행 파일과 스크립트 인수를 사용할 수 있다. Windows의 `npm.cmd`, `pnpm.cmd`, `*.bat`는 직접 측정하지 않는다. 다른 언어도 기존 실행 도구·네이티브 실행 파일을 등록할 수 있지만 개별 언어의 컴파일러 설치나 벤치마크 작성까지 자동화하지 않는다. `dependsOn`, `runOn`, 터미널 프로필, 확장 프로그램의 터미널 환경 주입은 실행하지 않는다. 준비가 필요한 경우 선택한 프로그램 안에서 명시적으로 처리한다.

실제 웹 화면처럼 프로세스 종료 시간만으로 판단하기 어려운 변경은 별도 동작 검사가 필요하다. [실제 Canvas 후보 평가](CANVAS_EVALUATION.md)는 픽셀 관찰과 동기 호출 시간 측정을 분리하고, 기본 설정의 불일치 때문에 호출 수가 줄어도 후보를 채택하지 않은 사례다. 해당 어댑터는 프로젝트별 실험이며 이 명령 측정 기능의 자동 브라우저 검사로 제공하지 않는다.

## 측정값이 뜻하는 것

Windows Python 가상환경의 `Scripts/python.exe`는 실제 인터프리터를 별도 프로세스로 띄우는 실행기다. [Python 설명](https://docs.python.org/3.12/library/venv.html), [CPython 실행기 소스](https://github.com/python/cpython/blob/main/PC/venvlauncher.c). 이 경로와 `pyvenv.cfg`가 확인되면 실행기 메모리를 비교에서 제외하고 이유를 표시한다. 다른 임의 실행기·자식 프로세스의 전체 메모리를 재구성하는 기능은 없다.

| 기록 | 해석 |
| --- | --- |
| 시간 | 프로세스 생성 직전부터 종료를 기다린 직후까지의 벽시계 시간. 런타임 시작·실제 명령·입출력을 포함한다. VS Code 터미널 생성이나 AI 추론 시간은 제외한다. 아주 짧은 함수의 성능은 명령 시작 비용에 가려질 수 있다. |
| 중앙값·min/max·MAD | 7회의 중앙값, 관측 범위, 중앙값 절대 편차. 신뢰구간이나 통계적 유의성을 주장하지 않는다. 화면은 중앙값과 범위, 보고서는 MAD와 원자료도 제공한다. |
| 메모리 | Windows `GetProcessMemoryInfo`의 `PeakWorkingSetSize`, Unix `wait4`의 `ru_maxrss`. OS가 보고한 명령 프로세스의 최대 사용량이다. 전체 앱의 모든 자식 메모리 합계나 함수별 할당량이 아니다. 수집 불가 표본이 있으면 메모리 비교를 생략한다. OS별 측정 정의도 같지 않다. |
| 표준 출력 | 각 실행의 SHA-256·바이트 수만 보존한다. 7회 출력이 일정하고 전후 동일한지 확인한다. 출력이 없으면 동작 동일성을 판단할 근거가 없으며, 같아도 전체 의미·상태·부작용의 동일성을 증명하지 못한다. |
| 표준 오류 | 바이트 수를 기록한다. 실패하면 제한된 마지막 오류를 로컬 화면에 표시한다. 성공한 명령의 stderr 본문은 보존하지 않는다. |
| 검사 근거 | 같은 파일 해시에서 실제 프로젝트 명령이 정상 종료했고 변경 감지가 없었던 기록을 첨부한다. 테스트 수나 모든 동작의 정확성을 추론하지 않는다. |

환경(OS·아키텍처·측정 Python 버전·메모리 방식)이 다르거나 출력이 일치하지 않으면 개선률을 계산하지 않는다. 원본 실행 파일 해시도 양쪽 기록에 남긴다. 컴파일한 프로그램 자체가 바뀌는 경우가 있으므로 실행 파일 해시 변화만으로 비교를 금지하지 않으며 화면에 표시한다. 명령·인수·환경 설정·측정 스크립트·대상 파일 경로가 바뀌면 새 기준선이 필요하다.

전후 순서는 기준선 7회 다음 후보 7회다. CPU 부하, 열, 캐시, 실행 순서가 결과에 영향을 줄 수 있다. 다른 입력과 순서에서도 재검증해야 한다. 느려지거나 메모리가 늘어난 결과를 숨기지 않으며 자동으로 '최적화 완료' 판정을 붙이지 않는다.

## 실행과 변경 감지

- 실행당 30초, 출력 스트림당 4 MiB, 측정 계획·응답 각각 64 KiB 한도. 취소·시간 초과·비정상 종료·출력 초과는 부분 결과를 성공으로 사용하지 않는다. 실제 프로젝트 검사와 측정은 동시에 실행할 수 없다.
- `shell: false`와 검토한 argv로 실행한다. 실제 코드의 파일 쓰기·네트워크·서비스 호출은 일어날 수 있다. 격리된 샌드박스가 아니므로 반복 가능한 명령과 입력을 사용해야 한다.
- Windows는 소유한 Python 작업의 프로세스 트리에 `taskkill /T /F`, Unix는 소유한 프로세스 그룹에 종료 신호를 보낸다. 취소와 30초 제한은 실제 프로세스 검사로 확인한다. 의도적으로 다른 그룹·서비스로 이탈한 프로세스까지 종료한다고 보장하지 않는다.
- 저장하지 않은 프로젝트 문서·untitled 문서가 있으면 실행을 거절한다. 측정 중 파일 변경은 취소하며, 전후 사이에는 대상 파일의 편집을 허용한다. 다른 관찰 대상 파일이나 실행 설정 변경은 기준선을 무효로 만든다. 후보 측정 후 대상 파일을 수정하면 후보 결과를 오래된 것으로 표시한다.
- 파일 감지는 VS Code watcher와 문서 변경 이벤트 범위다. [프로젝트 검사](PROJECT_CHECKS.md)와 같은 의존성·생성 디렉터리는 제외한다. 외부 입력, 네트워크, 무시한 폴더, 시스템 부하·라이브러리 변경을 완전히 고정한 실험은 아니다.
- 지원 변수는 `workspaceFolder`, `workspaceFolderBasename`, `file`, `fileDirname`, `fileBasename`, `fileBasenameNoExtension`, `fileExtname`, `relativeFile`, `pathSeparator`, `env:...`, 문자열/숫자/불리언 `config:...`다. `command:...`, `input:...`와 다른 변수는 거절한다. 호스트 환경에 터미널 env 및 process task env를 적용한다. `terminal.integrated.inheritEnv: false`는 지원하지 않는다.

## 재현과 구현

### English quick start

In the development VSIX, open a saved file in a trusted local workspace. In **Review** or **Local AI**, load project checks and select a repeatable `process` task with group `test` or `build`. Review the resolved arguments and folder, acknowledge eight executions, and record a baseline. Edit, save and run your correctness checks. Review the same measurement task again and record the candidate. Open the JSON report for all seven samples, output hashes and optional successful-check evidence. Set `pureobom.benchmarkPython` to a Python 3 executable if automatic discovery fails.

Each phase runs one warm-up and seven fresh processes. Time includes command startup and I/O. Memory is the OS peak for the command process, not the sum of an application tree; Windows Python venv launcher memory is excluded. Observed min/max ranges are not confidence intervals. Equal stdout is not semantic equivalence. Nonzero exit, cancellation, 30-second run limits, excess output or observed changes do not produce a successful partial result. Shell/batch/background tasks, interactive input and task dependencies are unsupported. There is no sandbox or API service. The command itself may write files or use paid services. Reports contain paths and arguments; review them before sharing.

`pnpm test`의 측정 검사는 로컬 Python 3가 필요하며 실제 30초 제한 검사 때문에 약 40초가 걸릴 수 있다. `pnpm extension:build` 다음 `pnpm extension:test`로 실제 VS Code 흐름을 확인한다. 별도 고정 itsdangerous 복사본·가상환경을 준비한 환경에서는 `node scripts/test-local-project.mjs --benchmark-only`로 이전에 검토한 모델 제안 한 건을 재측정할 수 있다. 새 모델 응답을 자동 실행하지 않는다. 자세한 결과와 실패는 [작업 기록](AGENT_WORKLOG.md)에 남긴다.

구현은 `src/core/benchmark.ts`, `extension/src/benchmarks.ts`, `benchmarkRunner.ts`, `extension/runtime/benchmark.py`, `extension/ui/Benchmarks.tsx`에 있다. [Python subprocess](https://docs.python.org/3/library/subprocess.html), [os.wait4](https://docs.python.org/3/library/os.html#os.wait4), [Windows 메모리 카운터](https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-process_memory_counters), [Node child_process](https://nodejs.org/api/child_process.html)를 참고했다.

# ccmsg

Claude Code 메시지 단위 사용량 분석 CLI

`~/.claude/projects/` 의 로컬 JSONL 파일을 파싱해 세션·메시지(turn)별 토큰/비용을 분석합니다.  
API 키나 로그인 없이 **완전히 로컬에서** 동작합니다.

---

## 설치

```bash
npm install -g ccmsg
```

설치 후 터미널 어디서든 `ccmsg` 명령어를 사용할 수 있습니다.

> Node.js 18+ 필요

### 업데이트

```bash
npm install -g ccmsg@latest
```

---

## 빠른 시작

```bash
ccmsg              # 오늘 세션 목록
ccmsg today        # 오늘 세션만
ccmsg top          # 비용 큰 메시지 TOP 20
ccmsg skills       # 스킬별 비용 집계
```

---

## 명령어

### `ccmsg` / `ccmsg sessions`

최근 세션 목록을 보여줍니다.

```bash
ccmsg                        # 최근 20개
ccmsg --all                  # 전체
ccmsg --since 7d             # 최근 7일
ccmsg --project my-app       # 특정 프로젝트
```

### `ccmsg today`

오늘 세션만 필터링합니다.

```bash
ccmsg today
```

### `ccmsg show <id>`

특정 세션의 메시지별 상세 내역을 봅니다.

```bash
ccmsg show 32b87704
```

각 메시지마다 입력/출력/캐시 토큰, API 호출 횟수, 사용된 툴, 호출된 스킬이 표시됩니다.

### `ccmsg top`

비용이 큰 메시지(turn) 순위를 보여줍니다. 어떤 작업이 토큰을 많이 소모했는지 파악할 때 유용합니다.

```bash
ccmsg top                    # 전체 TOP 20
ccmsg top today              # 오늘 TOP 20
ccmsg top --since 7d         # 최근 7일
ccmsg top --limit 50         # TOP 50
```

출력 예시:

```
  Top turns by cost (showing 20 of 1634)

      Cost  Project               Date      Time  API  Message
  ────────────────────────────────────────────────────────────
    $5.357  my-project            03-27  13:55   28  "그래 그렇게 해줘"
    $4.314  another-app           03-18  12:39   88  "[Request interrupted..."
    $3.817  another-app           04-02  19:36    9  "이 부분 다시 짜줘"

  Total:  $586.985  across 1634 turns
```

### `ccmsg skills`

oh-my-claudecode 스킬 사용량을 집계합니다. 어떤 스킬에 얼마나 비용이 발생했는지 확인할 수 있습니다.

```bash
ccmsg skills                 # 전체 기간
ccmsg skills today           # 오늘
ccmsg skills --since 7d      # 최근 7일
ccmsg skills --project my-app
```

출력 예시:

```
  Skills by cost (11 skills)

  Skill                       Uses      Input    Output      Cost
  ───────────────────────────────────────────────────────────────
  spec-pipeline                  2    360,523     1,446    $1.123
  review                         3         12       304    $0.688
  prd                            1    486,348     5,599    $0.548
  pr                             3    382,794       281    $0.391

  Total:  $5.416  across 16 skill invocations
```

---

## 옵션

| 옵션 | 설명 | 예시 |
|---|---|---|
| `--since <time>` | 기간 필터 | `1h`, `6h`, `1d`, `7d`, `30d` |
| `--project <name>` | 프로젝트 필터 | `--project my-app` |
| `--limit <n>` | 결과 개수 제한 (기본 20) | `--limit 50` |
| `--all` | 전체 출력 (limit 없음) | |
| `--json` | JSON 형식으로 출력 | |

---

## 표시 항목 설명

| 항목 | 설명 |
|---|---|
| `in` | 입력 토큰 수 |
| `cache+` | 캐시 생성 토큰 (비용 발생) |
| `cache↺` | 캐시 읽기 토큰 (훨씬 저렴) |
| `out` | 출력 토큰 수 |
| `API` | 해당 메시지에서 발생한 API 호출 수 (tool use 포함) |
| `skills` | 호출된 스킬 이름 |
| `tools` | 사용된 툴 목록 (Bash, Edit, Agent 등) |

---

## 로컬 빌드 (개발용)

```bash
git clone https://github.com/bong/ccmsg
cd ccmsg
pnpm install
pnpm build
pnpm link --global
```

---

## 요구사항

- Node.js 18+
- Claude Code (`~/.claude/projects/` 에 로그가 있어야 합니다)

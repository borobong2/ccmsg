# ccmsg

Claude Code 메세지 단위 사용량 분석 CLI

`~/.claude/projects/` 의 로컬 JSONL 파일을 파싱해 메세지(turn)별 토큰/비용을 분석합니다.  
별도 API 키나 로그인 없이 완전히 로컬에서 동작합니다.

## 설치

```bash
git clone https://github.com/yourname/ccmsg
cd ccmsg
pnpm install
pnpm build
pnpm link --global
```

설치 후 터미널 어디서든 `ccmsg` 명령어를 사용할 수 있습니다.

## 주요 사용법

### 스킬 사용량 확인

```bash
# 전체 기간 스킬별 비용/횟수 집계
ccmsg skills

# 최근 7일
ccmsg skills --since 7d

# 특정 프로젝트만
ccmsg skills --project sang-bong --since 30d
```

출력 예시:

```
  Skills by cost (11 skills)

  Skill                              Uses       Input    Output      Cost
  ────────────────────────────────────────────────────────────────────────
  skd-spec-pipeline                     2     360,523     1,446    $1.123
  skd-review                            3          12       304    $0.688
  prd                                   1     486,348     5,599    $0.548
  pr                                    3     382,794       281    $0.391

  Total:  $5.416  across 16 skill invocations
```

### 비싼 메세지 순위 확인

어떤 메세지가 토큰을 많이 썼는지 파악할 때 유용합니다.

```bash
# 전체에서 비용 큰 turn 상위 20개
ccmsg top

# 상위 50개
ccmsg top --limit 50

# 최근 7일
ccmsg top --since 7d
```

출력 예시:

```
  Top turns by cost (showing 15 of 1634)

      Cost  Project               Date      Time    API  Message
  ──────────────────────────────────────────────────────────────
    $5.357  cdl-1321              03-27  13:55    28  "그래 그렇게 해줘"
    $4.314  sokind-admin          03-18  12:39    88  "[Request interrupted..."
    $3.817  sokind-admin          04-02  19:36     9  "domain-nn-file 이식이 맞아..."

  Total:  $586.985  across 1634 turns
```

### 세션별 현황

```bash
# 최근 20개 세션 목록
ccmsg

# 오늘 세션만
ccmsg today

# 특정 세션의 메세지별 상세
ccmsg show <세션ID 앞 8자리>
```

### 필터 옵션

| 옵션 | 설명 | 예시 |
|---|---|---|
| `--since <time>` | 기간 필터 | `1h`, `6h`, `1d`, `7d`, `30d` |
| `--project <name>` | 프로젝트 필터 | `--project sang-bong` |
| `--limit <n>` | 결과 개수 | `--limit 50` |
| `--all` | 전체 출력 (limit 없음) | |
| `--json` | JSON 형식 출력 | |

## 표시 항목 설명

| 항목 | 설명 |
|---|---|
| `in` | 입력 토큰 |
| `cache+` | 캐시 생성 토큰 (비용 발생) |
| `cache↺` | 캐시 읽기 토큰 (저렴) |
| `out` | 출력 토큰 |
| `API calls` | 해당 메세지에서 발생한 API 호출 수 (tool use 포함) |
| `skills` | 호출된 스킬 이름 |
| `tools` | 사용된 툴 목록 (Bash, Edit, Agent 등) |

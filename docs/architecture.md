# OpenClaw Architecture
**A Reference Summary for Building a Simple Agent**

*Source: docs.openclaw.ai · February 2026*

---

## What OpenClaw Is

OpenClaw (formerly Clawdbot/Moltbot) is an open-source TypeScript CLI and WebSocket gateway server for running AI agents locally. It treats agents as **infrastructure problems, not prompt engineering problems** — sessions, memory, tool sandboxing, access control, and orchestration are all explicit engineering concerns.

> The model provides intelligence. OpenClaw provides the execution environment.

| Core Function | Description |
|---|---|
| Message Interception | Receives inputs from messaging platforms (Telegram, Slack, Discord, WhatsApp, etc.) |
| LLM Orchestration | Calls LLM APIs (Anthropic, OpenAI, local models via Ollama) with model failover |
| Tool Execution | Runs shell commands, file ops, browser automation in sandboxed environments |

---

## Core Architecture: Hub-and-Spoke

A single **Gateway** acts as the control plane between all inputs and the agent runtime:

```
Channel Adapters (WhatsApp, Telegram, Slack, CLI...)
        ↓
   Gateway (WebSocket — ws://127.0.0.1:18789)
        ↓
  Agent Runtime
        ↓
  LLM API + Tools
```

| Component | Role |
|---|---|
| **Gateway** | WebSocket server (control plane). Routes messages, manages sessions, dispatches to Agent Runtime. All clients connect here. |
| **Channel Adapter** | Standardises inbound messages from each platform into a common internal format before they reach the agent loop. |
| **Agent Runtime** | Runs the AI loop end-to-end: assembles context, calls the LLM, executes tool calls, persists state. |
| **Tools** | Shell, filesystem, browser (via CDP/Chromium), Canvas, cron, and custom skills. Each sandboxed. |
| **Memory / Workspace** | Markdown files on disk. Simple, portable, human-readable. No complex vector-only store. |

---

## The Agent Loop

Every incoming message goes through a strictly defined pipeline. No magic — just stages:

1. **Channel Adapter** — normalises the raw platform message into a standard internal object
2. **Lane Queue** — serialises execution (serial by default) to prevent race conditions
3. **System Prompt Builder** — assembles: system instructions + available tools/skills + relevant memories
4. **Session History Loader** — fetches prior turns from JSONL transcript to provide context
5. **Context Window Guard** — monitors token count; triggers summarisation or halts loop before overflow
6. **Model Resolver** — calls the LLM; if primary model/key fails or is rate-limited, switches to backup automatically
7. **Tool Executor** — runs any `tool_use` blocks returned by the LLM, within sandboxing rules
8. **State Persistence** — appends the full turn (user message + tool calls + response) to JSONL transcript

---

## Memory System

OpenClaw deliberately avoids complex memory architectures. Philosophy: **simple, explainable, portable files**.

### File Layout

Two tiers of Markdown live in the agent workspace:

- **`MEMORY.md`** — curated, durable facts the agent should always know (preferences, decisions, recurring patterns). The agent updates this explicitly.
- **`memory/YYYY-MM-DD.md`** — append-only daily session logs. The agent writes running notes here during conversations. These accumulate over time.

The Markdown files are **the source of truth**. The SQLite index is derived from them. Delete the index and it rebuilds; edit a file and the index updates on the next sync. You can `grep`, `git diff`, and edit memories in any text editor.

| Store | Purpose |
|---|---|
| **JSONL Transcripts** | Append-only audit log of every turn (user messages, tool calls, results). Used to rebuild session history for the next prompt. |
| **Markdown files** | Personality (`SOUL.md`), skills (`AGENTS.md`), long-term knowledge (`MEMORY.md`), and daily logs (`memory/YYYY-MM-DD.md`). Human-readable and version-controllable. |
| **SQLite index** | Derived index at `~/.openclaw/memory/{agentId}.sqlite`. Stores chunked embeddings and FTS5 tables for fast retrieval. The files are canonical; this is just a query layer. |
| **Smart Sync** | A file watcher auto-triggers re-indexing when memory files change, so new knowledge is immediately available on the next search. |

### Hybrid Search: Vector + BM25

Pure vector search fails on exact matches (error codes, function names, unique identifiers). Pure keyword search misses semantic synonyms. OpenClaw's default approach combines both:

**How it works:**

1. The query text is embedded and used to retrieve the top `N × candidateMultiplier` chunks by cosine similarity (via `sqlite-vec`).
2. Simultaneously, the query is tokenised and run through SQLite's FTS5 module using BM25 ranking — AND logic, so all tokens must match.
3. Both result sets are merged by **union** (not intersection) — a chunk scoring well on either side is included.
4. BM25 ranks are converted to a 0–1 score (`1 / (1 + rank)`) so they can be combined with cosine similarity scores on the same scale.
5. A weighted final score is computed: `finalScore = (vectorScore × 0.7) + (keywordScore × 0.3)`
6. **MMR (Maximal Marginal Relevance)** optionally re-ranks results to balance relevance with diversity, preventing five near-identical chunks from flooding the context.

```
finalScore = vectorWeight × vectorScore + textWeight × textScore
Default:     0.7            (cosine sim)   0.3            (BM25→score)
```

**Chunking:** ~400 tokens per chunk with 80-token overlap to preserve context across boundaries. Results returned as Markdown snippets with file path and line numbers.

**Graceful degradation:** If `sqlite-vec` is unavailable, falls back to JS cosine similarity. If FTS5 can't be created, runs vector-only. No hard failure either way.

**Optional enhancements (config):**

- **Temporal decay** — boost more recent memories (`halfLifeDays: 30` means a chunk's score halves every 30 days). Useful for daily-log-heavy setups.
- **Session indexing** — optionally index JSONL session transcripts as well as memory files, so past conversations are searchable.
- **QMD backend** — swap the built-in SQLite indexer for QMD (a local-first BM25 + vector + reranking sidecar) for higher-quality retrieval on large memory stores.

**Why SQLite rather than a dedicated vector DB?** Zero ops burden, no background processes, single portable file, trivial backups. The right choice for a single-user local-first agent — the complexity of a separate vector store isn't justified until you're at scale.

---

## Heartbeat: Proactive Scheduling

The heartbeat is what distinguishes OpenClaw from a reactive chatbot. The Gateway runs as a persistent background daemon and wakes the agent on a timer — **without any user prompt**.

### How It Works

On each tick, the agent runs a full agent loop turn with a fixed prompt:

```
Read HEARTBEAT.md if it exists. Follow it strictly.
Do not infer or repeat old tasks from prior chats.
If nothing needs attention, reply HEARTBEAT_OK.
```

If the agent responds `HEARTBEAT_OK`, the Gateway silently drops it — no notification spam. If it has something to say, it delivers the message to the configured target channel.

### Heartbeat vs Cron

| | Heartbeat | Cron |
|---|---|---|
| **Execution** | Runs a full LLM turn — the agent *decides* whether to act | Executes a command blindly on schedule |
| **Output** | Delivers a message only if warranted | Always runs regardless |
| **Context** | Has access to full session history and memory | Stateless |
| **Use for** | Proactive monitoring, check-ins, surfacing pending tasks | Fixed scheduled tasks (backups, reports) |

### Configuration

```json
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "every": "30m",
        "target": "last",
        "activeHours": { "start": "08:00", "end": "22:00" }
      }
    }
  }
}
```

- **`every`** — interval (default: 30m). Set to `0m` to disable.
- **`target`** — where to deliver alerts: `"last"` (last active channel), a specific channel, or `"none"` (run silently).
- **`activeHours`** — restrict heartbeats to a time window in the agent's local timezone. Ticks outside the window are skipped.
- **`includeReasoning`** — optionally deliver the model's reasoning chain alongside alerts (useful for transparency; avoid in group chats).
- **Duplicate suppression** — if the agent sends the same alert text within 24 hours, the duplicate is automatically suppressed.

### HEARTBEAT.md

An optional checklist file in the agent workspace. Example:

```markdown
- Check for unread high-priority emails
- Review any open GitHub PRs assigned to me
- Surface calendar conflicts for tomorrow
- If nothing urgent, reply HEARTBEAT_OK
```

If `HEARTBEAT.md` is missing, the agent still runs and decides autonomously whether anything in its context needs attention.

### Cost Consideration

Heartbeats run full agent turns, which consume tokens on every wake. At 30-minute intervals with a large context, this adds up. Most deployments use a cheaper or smaller model for heartbeat runs (configurable per-agent via `model` override) and reserve the frontier model for interactive sessions.

---

## Security Model

Shell access means security **cannot rely on the model behaving well**. OpenClaw uses hard engineering controls:

- **Allowlist Configuration** — every shell command must match a pre-approved pattern (`npm`, `git`, `ls`, etc.). Not on the list = blocked.
- **Structure-Based Blocking** — even allowed commands are parsed for dangerous patterns: redirections (`>`), pipe chains, etc.
- **Sandboxing** — tool execution runs in isolated environments. Opt-in per tool/channel.
- **Channel Access Controls** — DM allowlists/pairing control who can reach the agent. Groups use mention-gating.
- **Human Approval Gates** — irreversible actions (payments, deletions, external sends) should require explicit user approval.

> ⚠️ **Security note:** 26% of community skills analysed by Cisco contained at least one vulnerability. Audit all third-party skills before installing.

---

## Multi-Agent Routing

Multiple agent instances can run behind a single Gateway. Each agent gets its own isolated workspace with no cross-talk unless explicitly configured.

| Concept | Detail |
|---|---|
| **Agent definition** | JSON config entry with an `id` and `workspace` path. Per-agent model override is optional. |
| **Bindings** | Routing rules mapping inbound channel + sender to a specific agent. Most-specific binding wins; falls back to default agent. |
| **Isolation** | Each agent has separate auth, sessions, and memory. Personalities defined per-workspace via `SOUL.md`. |
| **Agent-to-agent** | Agents can share a blackboard (shared file/DB via a common tool skill) or message each other via explicit tool calls. |

---

## Key Design Principles Worth Stealing

### 1. The Loop is a Pipeline, Not Magic
Model the agent loop as explicit, ordered stages with single responsibilities. Makes failures traceable and the system testable.

### 2. Serial Execution by Default (Lane Queue)
Default to one message at a time. Add parallelism only where needed. Eliminates an entire class of race condition bugs around shared state.

### 3. Context Window as a First-Class Concern
Guard the token budget explicitly before every LLM call. Calculate usage, then trigger summarisation or truncation. Do not let the context silently overflow.

### 4. JSONL for State, Markdown for Memory
Append-only JSONL gives a full audit trail and is trivially portable. Markdown for personality and memory is human-readable and diffable. Avoid premature abstraction into databases.

### 5. Security via Hard Rules, Not Prompt Instructions
Allowlists and structural blocking in code. A system prompt saying "don't run `rm -rf`" is not a security boundary. Code is.

### 6. Model Failover at the Resolver
Wrap all LLM calls in a resolver that tracks key health and has a fallback list. Handle rate limits and transient failures without surfacing them to the agent loop logic.

---

## Minimal Agent Blueprint

The minimum viable version of this architecture:

```
1. Input layer       — receive message (CLI / webhook / messaging adapter)
2. Session loader    — load last N turns from JSONL transcript
3. Prompt builder    — merge system prompt + tools spec + memory + history
4. Token guard       — check total tokens; summarise history if over budget
5. LLM call          — call model API; retry with backoff on failure
6. Tool executor     — run any tool_use blocks; collect results
7. State persist     — append turn (user msg + tool calls + response) to JSONL
8. Output            — send response back to input layer
```

For a Felix-style personality agent (n8n-based), the critical additions over a plain chatbot are **steps 2, 4, and 7** — persistent session history with token budgeting.

---

## Suggested File Layout

```
~/.agent/
├── SOUL.md           # Agent personality, tone, instructions → loaded into system prompt
├── TOOLS.md          # Available tool descriptions → injected as tool specs
├── config.json       # Model choice, API keys, tool allowlists, channel config
├── sessions/
│   └── <session-id>.jsonl   # One file per conversation; append-only
└── memory/
    └── *.md          # Freeform long-term knowledge; queried via keyword or vector search
```

---

*Source material: docs.openclaw.ai, github.com/openclaw/openclaw, ppaolo.substack.com*
*OpenClaw is MIT licensed. Creator Peter Steinberger joined OpenAI in February 2026; project moving to an open-source foundation.*


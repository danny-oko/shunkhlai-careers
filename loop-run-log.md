# Loop Run Log — YOUR_PROJECT

Append one entry per run. Prune entries older than 30 days.

## Format

```json
{
  "run_id": "2026-06-09T08:15:00Z",
  "pattern": "daily-triage",
  "duration_s": 45,
  "items_found": 4,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 52000,
  "outcome": "report-only | fix-proposed | escalated | no-op"
}
```

## Recent Runs

<!-- Loop appends below this line -->

```json
{
  "run_id": "2026-09-10T00:00:00Z",
  "pattern": "daily-triage",
  "duration_s": 90,
  "items_found": 4,
  "actions_taken": 0,
  "escalations": 0,
  "tokens_estimate": 15000,
  "outcome": "report-only"
}
```
```json
{
  "run_id": "2026-09-10T19:30:00Z",
  "pattern": "daily-triage",
  "duration_s": 75,
  "items_found": 3,
  "actions_taken": 0,
  "escalations": 0,
  "tokens_estimate": 18000,
  "outcome": "report-only"
}
```

# Defect Density Verification — Q2 2026

**Period**: 2026-04-01 → 2026-07-01
**Source**: Jira API (live), pulled 2026-05-27

| Project | Name | All tickets | Bugs | Density | QA-reported bugs |
|---|---|---:|---:|---:|---:|
| DESK | Desktop | 526 | 139 | **26.43%** | 64 |
| CLI | Anaconda CLI | 261 | 43 | 16.48% | 30 |
| SIR | Sirius | 254 | 40 | 15.75% | 10 |
| TBP | Notebook | 13 | 2 | 15.38% | 2 |
| PDA | PDA | 238 | 29 | 12.18% | 0 |
| AIC | AI Core | 448 | 53 | 11.83% | 17 |
| BIG | BigBend | 206 | 22 | 10.68% | 7 |
| **CASH** | **Auth & Payments (Johnny Cashers)** | **235** | **20** | **8.51%** | **0** |
| INST | Installers | 86 | 6 | 6.98% | 2 |
| HUB | Hub / Telemetry | 218 | 14 | 6.42% | 9 |
| AQUA | Aqua | 105 | 6 | 5.71% | 1 |
| PA | Python Anywhere | 177 | 6 | 3.39% | 0 |
| PKG | Package Build - Core | 1597 | 8 | 0.50% | 6 |
| AIP | AI Platform | 25 | 0 | 0.00% | 0 |
| CBR | CBR | 1 | 0 | 0.00% | 0 (low vol) |
| CLOUD | Cloud | 0 | 0 | — | 0 (low vol) |
| SHP | Self-Hosted Platform | 0 | 0 | — | 0 (low vol) |

## How "density" is computed

```
density = bugs created in Q / all tickets created in Q × 100
```

JQL filters used:
- All tickets: `project = X AND created >= "2026-04-01" AND created < "2026-07-01"`
- Bugs: same + `AND issuetype = Bug`
- QA-reported bugs: same + `AND (reporter in membersOf("QA") OR creator in membersOf("QA"))`

## Questions for Aparna (CASH project)

- 235 tickets created in Q2, 20 of them bugs (8.51% density). Sound right?
- **0 of those 20 bugs are QA-reported** — did the QA team not own CASH testing in Q2,
  or are CASH bugs typically reported by engineering?
- If QA *was* testing CASH, the membership filter (`reporter in membersOf("QA")`) might be
  failing because the CASH bug reporters aren't in the QA Jira group.

## Data quality flags

- PKG has 1,597 tickets but only 8 bugs (0.50% density). Likely correct — PKG is a build
  pipeline with many automated tickets, low organic-bug volume.
- Three projects (CBR, CLOUD, SHP) have ≤1 ticket in Q2 — too low to draw conclusions.
- DESK leads at 26.43%, with 139 bugs. Needs follow-up: is this expected for a desktop
  client, or are bugs being mis-classified?

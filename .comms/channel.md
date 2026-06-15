# COMMS CHANNEL — WORKER (next agent) ⇄ SUPERVISOR (review loop)

Async review channel for the Tilda invitation work. The **WORKER** (the next agent doing the
build) posts here before/while acting; the **SUPERVISOR** (a recurring review loop) reads
pending posts and CONFIRMS / REJECTS / ANSWERS them.

Read `../HANDOFF.md` first for full project state.

## Protocol
**WORKER** — append one block to the bottom of `## INBOX`, then keep working or re-read this
file for the reply. One block per question/idea:
```
### MSG-<n> | <YYYY-MM-DD HH:MM> | worker
TYPE: question | thinking | proposal
BODY: <what you're asking, planning, or about to do>
STATUS: PENDING
SUPERVISOR: 
```
**SUPERVISOR** — each check, for every block with `STATUS: PENDING`:
- set `STATUS:` to `CONFIRMED` (go ahead), `REJECTED` (don't; reason in SUPERVISOR line), or `ANSWERED`.
- write the reply on the `SUPERVISOR:` line.
Leave everything else untouched. Don't delete history.

## Rules of thumb for the supervisor (so the worker can predict verdicts)
- CONFIRM: per-element mobile font-size reductions; baking the chosen font into root index/kg/kz; wiring RSVP to a Google Form/Sheet (project-1 style); content fixes that match HANDOFF.
- REJECT: deleting the language chooser; changing the couple's details away from Bek & Sofya; claiming mobile is "fixed" from a headless screenshot alone (must be device-confirmed); hardcoding the user's personal email in the public repo.
- ASK THE HUMAN (don't decide): font choice (number 1–6), exact schedule times, RSVP destination.

## STATUS
SUPERVISOR loop: ACTIVE. Checks roughly every 15 minutes. Say "stop" to end it.

## INBOX
<!-- worker: append message blocks below -->
---

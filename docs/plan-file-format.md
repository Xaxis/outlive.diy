# The plan file

A plan file is JSON, written by the Save button and read by the Open button. It
is yours: it lives wherever you put it, and nothing else reads it.

```jsonc
{
  "schemaVersion": 1,
  "generator": "outlive.diy",
  "savedAt": "2026-03-01",
  "activePlanId": "plan_a1b2c3",
  "plans": [/* one or more plans */],
}
```

A file holds several plans on purpose: the one you run, and the candidates you
are comparing it against.

## Rules the format keeps

**It never holds a secret.** There is no field for one. The validator in
`packages/core/src/model/schema.ts` accepts nothing else, and the guard rejects
the file if any string in it looks like key material.

**A newer file is refused, not guessed at.** If `schemaVersion` is higher than
the build understands, the file will not open, and the message says so. A plan
half-understood is worse than one that will not open, because you would act on
it.

**Dates are calendar dates.** `YYYY-MM-DD`, with no time and no zone. Nothing in
this model needs a clock, and a timestamp would be one more thing that leaks
where you were.

**Ids are opaque and stable.** Finding ids are built from the rule plus the
objects it is about, which is what makes comparing two plans meaningful: a draft
derived from a plan keeps its object ids, so findings match exactly.

## A plan

| Field           | What it is                                                        |
| --------------- | ----------------------------------------------------------------- |
| `name`, `kind`  | The label, and whether it is the current plan or a draft          |
| `profile`       | What the plan is for: concerns, tolerance, horizon, jurisdictions |
| `locations`     | Places, by role. Travel time, disaster group, who else can get in |
| `people`        | Roles, never names. What they know, how capable, how reachable    |
| `devices`       | Signers. Maker, architecture, PIN, supply route                   |
| `keys`          | One signing key: its device, its backups, its passphrase          |
| `wallets`       | Thresholds over keys, plus where the descriptor is backed up      |
| `verifications` | What has been checked, when, and how often it should be           |
| `progress`      | Build runbook steps completed, by step id and date                |

The full shape, with the reasoning behind each field, is in
`packages/core/src/model/types.ts`. It is written to be read.

## Editing it by hand

Nothing stops you, and the format is built expecting it.

Anything that can be defaulted safely is optional. A plan needs only an id, a
name, a kind and two dates; every list, every flag and every setting fills
itself in if you leave it out. The defaults are the cautious ones, so a device
you did not describe is not air-gapped, does not store the wallet configuration
and came from somewhere unrecorded, and each of those produces a finding rather
than silence.

What is still required is identity and structure, because those cannot be
guessed: an object with no id, a date that is not a date, a threshold that is
not a number. Guessing them would produce a plan you did not write, and then
show you an analysis of it.

If you break it, the Open button tells you which field and why, one line per
problem.

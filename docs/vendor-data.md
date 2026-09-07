# Vendor data

Device-specific facts are not in the engine, and the file that can hold them
ships empty.

## Why

A table of which signer has a secure element, which firmware fixed which
advisory and which model can run air-gapped is correct on the day it is written
and quietly wrong a year later. A planning tool that presents a stale fact with
the same confidence as its own structural reasoning is worse than one that
presents no facts at all, because the user cannot tell the two apart.

So: every analysis in this program runs identically with no vendor data loaded,
which is the default. Anything a loaded file says is shown as a dated claim from
that file, never as a conclusion this program reached.

## The format

```jsonc
{
  "version": 1,
  "asOf": "2026-03-01", // required; a file with no date cannot be trusted to be current
  "source": "My own notes, checked against vendor documentation",
  "vendors": [
    {
      "id": "vendor-one", // matched against a device's maker, case-insensitively
      "name": "Vendor One",
      "architecture": "Secure element A",
      "secureElement": true,
      "airGapCapable": true,
      "storesWalletConfig": false,
      "notes": "Free text, shown as-is",
      "advisories": [
        {
          "id": "VU-2025-01",
          "date": "2025-06-14",
          "summary": "One line, in your own words",
          "affects": "Which models and firmware, in your own words",
        },
      ],
    },
  ],
}
```

Every field except `id` and `name` is optional. The app shows the file's date
and how old it is wherever its claims appear.

`vendor-data.example.json` beside this file is a working one to copy. Every
line of it is a placeholder: replace the contents with your own research and put
the date you checked it in `asOf`, because that date is what the interface shows
beside every claim the file makes.

Load it under **Your plan file**. It is stored in the same browser storage as
the plan and is removed by the same erase button.

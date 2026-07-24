# Vendor import evidence

This directory owns durable, reviewed vendor-import receipts used by `release:check`.

Place a receipt at `vendor-import/<profile-id>-import.json` only after every interaction case has
been imported into the recorded product version. Do not generate a placeholder receipt or copy
local cache state into this directory. The required receipt schema and Canvas example are
documented in `../CANVAS_CLASSIC.md`.

# Store logos (curated, owner-only)

Since 2026-10-05 a Store Plan manager can also set the logo themselves on
their status page (automatic store logos, ADMIN_MANUAL section 16c.1). Those
live in the worker's KV, not here: the worker answers
`plued.app/assets/logos/*` from KV and passes every other request (the files
in this folder) on to GitHub Pages, so a hand-made file here keeps working.

Spec: docs/plans/2026-09-01-store-branding-spec.md.

- One file per store: `<slug>.png` — lowercase, digits, `_`, `-`, `.` only
  (the same shape as a produce `image_ref`; the app refuses anything else).
- 512x512 PNG, transparent background, the mark fitted inside a 448px safe
  box, run through pngquant (well under 100KB). Prefer a monogram/icon over
  a wide wordmark — the Home shelf shows it at ~36px.
- Rendered on a cream pill in both themes; no dark variant needed.
- Nothing here is user-uploaded: a trainer REQUESTS a logo from the builder,
  the owner produces the file, drops it here, pushes (auto-deploys), then
  sets the ref on the pack in the admin page (PATCH /api/packs/<id>/brand).
- Missing or unresolvable ref -> the app shows the PLUed placeholder + the
  store name. Nothing ever breaks offline.

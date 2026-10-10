# Store logos (curated, owner-only)

Since 2026-10-05 a Store Plan manager can also set the logo themselves on
their status page (automatic store logos, ADMIN_MANUAL section 16c.1). Those
live in the worker's KV, not here: the worker answers
`plued.app/assets/logos/*` from KV and passes every other request (the files
in this folder) on to GitHub Pages, so a hand-made file here keeps working.

Spec: docs/plans/2026-09-01-store-branding-spec.md.

- One file per store, `<slug>.png`: lowercase, digits, `_`, `-`, `.` only
  (the same shape as a produce `image_ref`; the app refuses anything else).
- 512x512 PNG, transparent background, the mark fitted inside a 448px safe
  box, run through pngquant (well under 100KB). Prefer a monogram/icon over
  a wide wordmark for this square file: the app shows it at ~36px beside
  the store's name. The wide wordmark goes in the wide file below.
- Rendered on a cream pill in both themes; no dark variant needed.
- **The wide logo (since 2026-10-08), optional, beside the square one:**
  `<slug>-wide.png` (same name rule, e.g. `fortinos.png` and
  `fortinos-wide.png`). PNG exactly 1200x400, transparent background, the
  mark inside a centered 1120x336 safe box (40 px clear left and right,
  32 px top and bottom), run through pngquant, at most 300 KB (the worker
  and the app refuse one over 400 KB). The app shows it across the store's
  card on Home, on a cream band in both themes. Use the store's own wide
  wordmark as it is: the whole mark with its tagline, no recoloring, no
  redrawing, never cropped. A pack can carry either picture without the
  other; an app or builder that does not know the wide one ignores it.
  Make one from a large render of the mark:
  `magick mark.png -trim +repage -resize 1120x336 -background none -gravity center -extent 1200x400 PNG32:raw.png`
  then `pngquant --strip --quality 80-100 --output <slug>-wide.png 256 raw.png`,
  look at it on cream (#FAF6EE), and run
  `node tool/verify/store_logo_check.mjs` (it checks every `*-wide.png` here).
- Set either ref on the pack in the admin page: **Set logo** has a field for
  each (the square `logo_ref`, the wide `logo_wide_ref`), and each can be
  cleared on its own.
- Nothing here is user-uploaded: a trainer REQUESTS a logo from the builder,
  the owner produces the file, drops it here, pushes (auto-deploys), then
  sets the ref on the pack in the admin page (PATCH /api/packs/<id>/brand).
- Missing or unresolvable ref -> the app shows the PLUed placeholder + the
  store name. Nothing ever breaks offline.

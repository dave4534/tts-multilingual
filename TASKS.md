# TTS Web App — Build Checklist

> Reference: `docs/superpowers/specs/2026-03-12-tts-web-app-prd.md`
> After completing each task, mark it `[x]` and add a one-line summary to `CHANGELOG.md`.

**Deployed URLs:**
- Frontend: `https://kolmemaybe.vercel.app/` *(update once Vercel project is created)*
- Backend API: `https://dave4534--tts-multilingual-api.modal.run`

---

## Phases 0–4: Complete

Phases 0 (Setup), 1 (Modal GPU Worker), 2 (Voice Clips), 3 (Backend API), and 4 (Frontend) are all done.
See `CHANGELOG.md` for the full history.

**One open item from Phase 3:**

- [ ] **3.20** Wire multi-section pipeline into `/convert` while preserving API contract; add end-to-end test for 15–20k word input

---

## Phase 5: Integration Testing

- [ ] **5.1** Test end-to-end: paste short text (~100 words) → select voice → convert → preview → download
- [ ] **5.2** Test end-to-end: upload .txt file → convert → download
- [ ] **5.3** Test end-to-end: upload .pdf file → convert → download
- [ ] **5.4** Test 20,000 word input: verify chunking, progress, and final output
- [ ] **5.5** Test all 6 voices produce distinct, quality output
- [ ] **5.6** Test error cases: oversized file, over word limit, scanned PDF, empty input, unsupported file type
- [ ] **5.7** Test mobile responsiveness on real devices or device emulator
- [ ] **5.8** Test cold start experience: Modal wake-up flow

---

## Phase 6: Deployment

- [ ] **6.1** Deploy Modal app to production (`modal deploy` — deploys both API and GPU workers)
- [ ] **6.2** Deploy React frontend to Vercel (set Modal API URL as environment variable)
- [ ] **6.3** Verify public URL works end-to-end
- [ ] **6.4** Test from a mobile device on the public URL
- [ ] **6.5** Verify Modal costs align with estimates after a few test conversions

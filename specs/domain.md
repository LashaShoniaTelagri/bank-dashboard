# Domain

## Roles

| Role (`profiles.role`) | Who | Sees |
|------------------------|-----|------|
| `admin` | TelAgri staff | Everything across all banks |
| `bank_viewer` | Bank employee | Only farmers/data for their bank; underwriting if granted |
| `specialist` | Agronomist (TelAgri staff or contractor) | Farmers explicitly assigned to them |

> **Note:** `specialist` role IS the agronomist role. Domain conversations call them "agronomists"; the codebase calls them "specialists". Same person, same enum value. Do not introduce a new `agronomist` role.

## Entities

### Bank
- One bank may have many bank viewers, many farmers, many underwriting applications.
- Bank viewers cannot see other banks.

### Farmer
- Belongs to one bank.
- Has many `farmer_phases` (one per F-100 phase 1–12).
- Has many `farmer_data_uploads` (analysis files, photos, maps, climate data, text notes).
- May have orchard maps stored separately.

### F-100 (12-phase agricultural assessment)
- `F100Phase = 1..12`. Phases are numeric, not enum.
- Each phase has its own data uploads, AI chat session(s), assignment, and report URL.
- Phases progress through statuses: `pending` → `in_progress` → `completed` / `pending_review` / `cancelled`.

### Specialist assignment
- One row in `specialist_assignments` per `(specialist, farmer, phase)`.
- Specialist sees only farmers/phases they're assigned to.
- Admin assigns and revokes.

### AI chat
- Per `(farmer, specialist, phase)`. `ai_chat_sessions` + `ai_chat_messages` (sender_role: `specialist | assistant`).
- Context files attach uploads to messages so the assistant can reference them.

### Underwriting (newer flow)
- `underwriting_applications`: bank submits crop type + shapefile + notes.
- `application_scores`: overall score 0–100, plus subscores (land suitability, crop viability, risk assessment, historical data). One final non-draft score per application; multiple drafts allowed.
- Specialists may be assigned to underwriting applications (see `20260304000004_underwriting_specialist_assignments.sql`).

### Crop catalogue
- `crop_types` is the admin-curated list. Used by underwriting + (future) ALE module.

## Workflows

### Farmer onboarding & monitoring (F-100)
1. Admin invites bank viewer → bank viewer creates farmer (RLS allows since `20250101120001`).
2. Admin assigns specialist to a farmer phase.
3. Specialist uploads data, runs AI chat, generates F-100 report PDF.
4. Bank viewer reads completed reports.

### Underwriting
1. Bank viewer submits application (shapefile + crop type + notes).
2. Specialist (if assigned) reviews; saves draft scores.
3. Specialist promotes one score to non-draft (final).
4. Bank viewer sees final score + status.

### Invitations & 2FA
- Admin invites by email → SendGrid email → invitation accepted via token → 2FA on first sensitive action.
- Trusted devices skip 2FA after first verification (see `20250101080001_add_trusted_devices.sql`).
- Password reset uses the same token-based flow (`20260122000001_add_password_reset_support.sql`).

### Impersonation
- Admin-only feature (`20251008000000_add_user_impersonation_system.sql`). For support/debugging.
- Audited via `audit_log`.

## Data types of farmer uploads

```ts
DataType = 'photo' | 'analysis' | 'maps' | 'climate' | 'text' | 'document' | 'video'
         | 'geospatial'  // legacy → 'maps'
         | 'audio'       // legacy, removed from UI
```

## Score model

Underwriting scores are 0–100 with one decimal (`NUMERIC(4,1)`). Higher = better suitability. See `20260311000000_simplify_scoring_to_single_score.sql` for current shape.

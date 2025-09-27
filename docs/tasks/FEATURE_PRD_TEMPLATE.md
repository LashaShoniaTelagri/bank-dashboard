## TelAgri PRD Template v2 - Build-Ready Specification

Use this template for every new feature or change. Keep it concise but precise. Replace all bracketed placeholders.

### 0. Meta
- Feature name: [name]
- Owner: [PM], Tech reviewer: [Eng]
- Links: [Jira/Confluence/Design]
- Target release: [date or sprint]

### 1. Business Context
- Problem: [1-2 lines]
- Goal: [1-2 lines]
- Success metrics (KPIs):
  - [metric, baseline → target]

Example - Farmer Registration:
- Problem: Section headers and grouping are confusing; banks struggle to complete registration smoothly.
- Goal: Split into two clear steps - Service Cost Calculation and Farmer Details - and simplify naming.
- KPIs:
  - Registration completion rate: 55% → 85%
  - Avg. time to complete: 12 min → 7 min
  - Support tickets about registration: -60%

### 2. Scope
- In scope: [bullets]
- Out of scope: [bullets]
- Assumptions: [bullets]

Example - Farmer Registration:
- In scope:
  - Two-step flow: Service Cost Calculation → Farmer Details
  - Location picker modal with Google Maps (search + draggable pin)
  - File uploads for Historical soil Analyses, Other, and KMZ/KML
  - Lightbox viewer for images, PDFs, Office docs; F-100 opens in lightbox
  - Inline map preview with click-through to lightbox map
- Out of scope:
  - Changing tariff names (keep hidden from end-users)
  - Non-Google map providers
- Assumptions:
  - Google Maps key available in Vite env: VITE_APP_GOOGLE_MAPS_API_KEY
  - Admin can select bank; bank_viewer is auto-assigned to their bank

### 3. Roles and Permissions (matrix)
Describe CRUD per role for each entity touched by this feature.

| Entity | Operation | admin | bank_viewer | Notes |
|---|---|---|---|---|
| [table] | Read | [Y/N] | [Y/N] | [row filter] |
| [table] | Write | [Y/N] | [Y/N] | [WITH CHECK] |

Example - Farmer Registration:
| Entity | Operation | admin | bank_viewer | Notes |
|---|---|---|---|---|
| farmers | Read | Y | Y | bank_viewer only own bank farmers
| farmers | Insert | Y | Y | bank_id: admin chooses; bank_viewer uses profile.bank_id
| farmer_documents | Read | Y | Y | filter by farmer.bank_id
| farmer_documents | Insert | Y | Y | WITH CHECK farmer_documents.bank_id = profile.bank_id
| f100 | Read | Y | Y | filter by farmer.bank_id

### 4. Domain Model Deltas
- New/changed tables and columns. Be explicit on types, nullability, defaults, constraints, and indexes.

| Table | Column | Type | Null | Default | Index | Description |
|---|---|---|---|---|---|---|
| [farmers] | [location_lat] | numeric(9,6) | no | - | idx_farmers_location | Latitude |

Example - Farmer Registration:
| Table | Column | Type | Null | Default | Index | Description |
|---|---|---|---|---|---|---|
| farmers | location_name | text | no | - | - | Geocoded place label
| farmers | location_lat | numeric(9,6) | no | - | idx_farmers_location | Latitude
| farmers | location_lng | numeric(9,6) | no | - | idx_farmers_location | Longitude
| farmers | service_cost_total_eur | numeric(12,2) | no | 0 | - | Calculated total
| farmers | service_cost_selections | jsonb | yes | - | - | Selected calculator options
| farmer_documents | created_by | uuid | no | auth.users(id) | - | Uploader user id

DDL draft (if helpful):
```sql
-- Example
ALTER TABLE farmers
ADD COLUMN location_lat numeric(9,6) NOT NULL,
ADD COLUMN location_lng numeric(9,6) NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farmers_location ON farmers (location_lat, location_lng);
```

Example DDL:
```sql
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS location_name text NOT NULL,
  ADD COLUMN IF NOT EXISTS location_lat numeric(9,6) NOT NULL,
  ADD COLUMN IF NOT EXISTS location_lng numeric(9,6) NOT NULL,
  ADD COLUMN IF NOT EXISTS service_cost_total_eur numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_cost_selections jsonb;

CREATE INDEX IF NOT EXISTS idx_farmers_location ON farmers (location_lat, location_lng);

ALTER TABLE public.farmer_documents
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
```

Storage layout (if any):
```
farmer-documents/
  farmer/{farmer_id}/{document_type}/{file_name}
```

### 5. API / Edge Functions
- Endpoints or functions added/modified. Include auth, inputs, outputs, errors, timeouts, and rate limits.

| Name | Type | Auth | Request | Response | Errors | Timeout | Rate limit |
|---|---|---|---|---|---|---|---|
| /functions/v1/send-2fa-code | Edge | service role | { email, role } | { success } | 400 validation | 5s | 3/10min/email |

Secrets used: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, [others].

Example - Farmer Registration (read/write via Supabase client):
- Tables used: farmers, farmer_loans, farmer_documents, storage.objects (bucket farmer-documents), f100
- Functions: none required; all operations use RLS-secured table access

### 6. UI / UX
- Screens and states: [wireframe links or brief description]
- States: loading, empty, success, error; button disabled logic
- Mobile specifics (min width 360px); accessibility (labels, focus, keyboard)
- Copy/text: [final copy]
- CSP needs: [third-party scripts/frames/objects]

Example - Farmer Registration:
- Two steps:
  1) Service Cost Calculation - 7 required fields; sticky bottom summary: "Service cost calculated" and total in EUR
  2) Farmer Details - sections: About Company, Farm Overview, Historical soil Analyses, Last Yield, Loan Details, Comment, Other
- Location input: opens modal with Google Map (Places Autocomplete, draggable pin); preserves zoom; Satellite view in add/edit; inline map preview in profile with click to lightbox
- Documents: show file names as blue underlined links; clicking opens lightbox; Office docs via Microsoft viewer; PDFs via object/iframe; images swipeable
- Company info cards: unified style with green left border; labels bold + underlined
- Modal behavior: header fixed; footer scrolls; Next/Register buttons disabled with loaders during mutations
- F-100: clicking table button opens FileViewer; shows loader while signed URL is generated

### 7. Validation Rules
- Field rules: formats, min/max, required
- Cross-field rules: [e.g., start_date ≤ end_date; issuance_date ≤ end_date]
- Time zone policy: [UTC on server, local on client]
- Number/currency formatting and rounding: [e.g., bankers rounding; format €1,750]

Example - Farmer Registration:
- Required (bank_viewer & admin): company_name, identification_code, company_email, director_full_name, director_mobile, contact_full_name, contact_mobile, location_name, location_lat, location_lng
- Bank selection: required only for admin; bank_viewer auto-assigned
- Loans: Start date ≤ End date; Issuance date ≤ End date; compact date format dd MMM yyyy
- Files: Historical soil Analyses allow pdf, doc, docx, xls, xlsx, jpg, jpeg, png; KMZ/KML supports multiple files (append, not replace)
- Calculator: all 7 fields must be chosen before proceeding; tariff type hidden from end users

### 8. Security and Compliance
- RLS policies (by table and operation). Provide exact USING and WITH CHECK logic.

| Table | Operation | Policy name | USING | WITH CHECK |
|---|---|---|---|---|
| farmer_documents | insert | .insert.bank_viewer | p.bank_id = farmer_documents.bank_id | p.bank_id = farmer_documents.bank_id |

- Audit events: [which operations are logged; payload]
- PII handling: [mask email in logs, redact phone]
- Rate limiting: [per function or endpoint]
- CSP: script-src [list], frame-src [list], object-src [list]

Example - Farmer Registration:
- storage.objects policies for bucket farmer-documents enforce path contains "farmer/{farmer_id}/" and bank match
- Audit: on register farmer, on upload document, on delete document; store user_id, ip, user_agent, section
- PII: mask emails in logs (xx**@), never log phone fully
- CSP additions: allow maps.googleapis.com, maps.gstatic.com scripts; frame/object from *.supabase.co and view.officeapps.live.com

### 9. Performance & Reliability
- SLA targets: [calc response < 200ms; map init < 2s on 4G]
- Pagination/virtualization: [table page size 25; virtual list > 200 rows]
- Offline/poor network behavior: [retry policy; backoff]

Example - Farmer Registration:
- Ensure service cost summary visible on 1366x768 (sticky bottom area with backdrop)
- Map: avoid unnecessary re-inits; preserve zoom; initialize within 2s on 4G
- FileViewer: minWidth 95vw, minHeight 85vh for docs; navigation arrows large and clickable

### 10. Telemetry
- Events and properties (names are final and stable):
  - event: farmer_registered { farmer_id, bank_id, has_docs }
  - event: loan_saved { farmer_id, count }
  - event: twofa_code_sent { email_hash, role }

Example - Farmer Registration (additional):
- event: file_viewer_opened { farmer_id, section, file_type }
- event: f100_opened_in_lightbox { farmer_id, report_month }
- event: location_selected { farmer_id, source: 'autocomplete'|'drag'|'click' }

### 11. Acceptance Criteria (Gherkin)
Provide 4–8 scenarios (happy + edge).

```gherkin
Scenario: User sees calculated service cost and proceeds
  Given I select crop "Blueberry" and all required fields
  When I click Next
  Then I see "Service cost calculated" and the Details step becomes active

Scenario: Loan date validation prevents invalid ranges
  Given Start date is 2025-09-17 and End date is 2025-09-15
  When I save loan
  Then I see "End date must be same or after Start date"

Scenario: Location picker does not close modal on suggestion click
  Given I open the Location picker
  When I type and click a Google Places suggestion
  Then the modal stays open and the map centers on the selected place

Scenario: Bank viewer is not asked to choose bank
  Given I am a bank_viewer
  When I register a farmer
  Then the bank is auto-assigned from my profile and no validation error appears

Scenario: Multiple KMZ/KML files append instead of replace
  Given I already selected one KMZ file
  When I select another KMZ file
  Then both files are listed and can be opened in the lightbox

Scenario: Files open in lightbox with clickable controls
  Given I click a PDF in Historical soil Analyses
  Then it opens in the FileViewer above the modal and Download/Open buttons are clickable
```

### 12. Rollout & Migration Plan
- Migrations required: [list of files]
- Order and backout strategy: [how to revert]
- Feature flag: [name if applicable]
- Environments: dev → staging → prod; data backfill plan if any

Example - Farmer Registration:
- Migrations:
  - 20250912090000_farmer_service_cost_and_loans.sql
  - 20250916120000_fix_farmer_documents_rls_policies.sql
  - 20250916130000_cleanup_duplicate_farmer_documents_policies.sql
  - 20250916140000_fix_farmer_documents_storage_policies.sql
  - 20250916150000_fix_farmer_documents_storage_path_format.sql
  - 20250916160000_add_created_by_to_farmer_documents.sql
- Backout: revert latest migration set; keep data columns nullable during transition
- CI: run supabase link + db push in deploy.yml migrate job

### 13. Definition of Ready (DoR)
- [ ] Roles/permissions matrix completed
- [ ] RLS deltas drafted
- [ ] Validation rules and TZ policy specified
- [ ] CSP impacts listed
- [ ] AC written (Gherkin)
- [ ] Telemetry events defined

### 14. Definition of Done (DoD)
- [ ] Migrations replay on clean DB (supabase db reset) without errors
- [ ] RLS policies verified with tests
- [ ] E2E happy path passes (login, create, view)
- [ ] Telemetry visible in dashboards
- [ ] Docs updated (this PRD linked)

### 15. Appendix
- CSP example used by TelAgri (CloudFront):
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://js.sentry-cdn.com https://maps.googleapis.com https://maps.gstatic.com;
frame-src https://*.supabase.co https://view.officeapps.live.com;
object-src https://*.supabase.co blob: data:
```
- RLS example pattern:
```sql
CREATE POLICY "farmer_documents.insert.bank_viewer"
ON public.farmer_documents FOR INSERT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.bank_id = farmer_documents.bank_id AND p.role = 'bank_viewer'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.bank_id = farmer_documents.bank_id AND p.role = 'bank_viewer'));
```



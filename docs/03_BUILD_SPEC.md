03 — BUILD SPECIFICATION
OfferAlert / working brand: SPORLAG
Purpose: Builder-ready product and technical scope  
Target: Denmark-first validation-ready v1
---
1. IMPLEMENTATION GOAL
Build a working web product that can prove the complete offer lifecycle:
```text
SOURCE
→ MESSAGE
→ EXTRACT
→ REVIEW
→ MATCH
→ OFFER VERSION
→ VERIFY
→ PUBLISH
→ COMMUNITY
→ HISTORY / INTELLIGENCE
```
The project is not complete when the screens exist.
The first meaningful build is complete when a real marketing newsletter can become a verified, traceable Offer Graph record and then appear correctly in the consumer experience.
---
2. REQUIRED PRODUCT AREAS
Public
Home
Explore Offers
Companies
Company Profile
Offer Detail
Evidence
Offer History / Version Diff
Market Pulse
Methodology / Recognition
About
Consumer account
Sign up / login
Dashboard / Mit overblik
Mine nyhedsbreve
Review Queue
Review Flow
Contributions
Contribution Points
Reputation
Impact
Missing-company suggestion
Ambassador / editorial
Review queue
Evidence comparison
AI correction
Verification
Moderation
Audit trail
Internal admin
Source Registry
Incoming messages
Extraction review
Companies
Campaigns
Offers
Offer Versions
Recognition
Translation/config
Publish control
B2B later
Watchlists
Competitor changes
Benchmarks
Alerts
Export
API
Do not overbuild B2B in current v1.
---
3. OFFER GRAPH DATA MODEL
Minimum entities:
```text
Company
NewsletterSource
Message
Campaign
Offer
OfferVersion
Evidence
AIObservation
HumanVerification
CommunityObservation
Recognition
User
UserNewsletterSelection
ContributorProfile
```
---
4. SUGGESTED ENTITY FIELDS
Company
```json
{
  "id": "company_123",
  "name": "Telmore",
  "slug": "telmore",
  "market": "DK",
  "status": "active",
  "created_at": "...",
  "updated_at": "..."
}
```
NewsletterSource
```json
{
  "id": "source_123",
  "company_id": "company_123",
  "name": "Telmore marketing newsletter",
  "market": "DK",
  "language": "da",
  "subscription_type": "direct_public_signup",
  "status": "active",
  "source_confidence": "direct_subscription"
}
```
Message
```json
{
  "id": "message_123",
  "source_id": "source_123",
  "received_at": "...",
  "subject_private": "...",
  "body_raw_private": "...",
  "body_normalized_private": "...",
  "state": "RECEIVED",
  "content_fingerprint": "..."
}
```
Campaign
```json
{
  "id": "campaign_123",
  "company_id": "company_123",
  "working_name": "September mobile promotion",
  "first_seen": "...",
  "last_seen": "..."
}
```
Offer
```json
{
  "id": "offer_123",
  "company_id": "company_123",
  "campaign_id": "campaign_123",
  "offer_type": "subscription_discount",
  "canonical_identity": "...",
  "first_seen": "...",
  "last_seen": "..."
}
```
OfferVersion
```json
{
  "id": "offer_version_004",
  "offer_id": "offer_123",
  "version": 4,
  "claim_original": "3 måneder til halv pris",
  "source_language": "da",
  "observed_at": "2026-09-15T10:42:00+02:00",
  "verification_status": "verified",
  "publication_status": "published",
  "changed_fields": ["normal_price"]
}
```
---
5. STRUCTURED OFFER SCHEMA
Identity
company
campaign
original language
source message
observed date
offer type
Claim
headline
supporting claim
Economics
advertised price
previous price
normal price
discount
advertised value
minimum purchase
deposit
Time
start date
expiry
introductory period
binding period
renewal
Eligibility
new customers
members
geography
age
selected products
Restrictions
exclusions
quantity limits
max benefit
wager / turnover requirement where applicable
fees
other conditions
---
6. PROVENANCE — REQUIRED
No derived field may exist without provenance.
Recommended field envelope:
```json
{
  "field": "normal_price",
  "value": {
    "amount": 299,
    "currency": "DKK",
    "period": "month"
  },
  "source_message_id": "message_123",
  "evidence_span": "Herefter 299 kr./md.",
  "evidence_locator": {
    "type": "text_span",
    "start": 1452,
    "end": 1473
  },
  "extractor_version": "extractor-0.1",
  "confidence": 0.96,
  "verification_status": "pending",
  "verified_by": null,
  "verified_at": null
}
```
If evidence cannot be traced, the fact should not be treated as verified.
---
7. MESSAGE STATE MACHINE
Normal lifecycle:
```text
RECEIVED
↓
PROCESSING
↓
EXTRACTED
↓
NEEDS_REVIEW
↓
VERIFIED
↓
PUBLISHED
```
Special states:
```text
NO_OFFER
DUPLICATE
LOW_CONFIDENCE
POSSIBLE_UPDATE
FAILED
ARCHIVED
```
Rules:
Verification does not automatically mean publication.
Publication must be an explicit state transition.
Failed extraction must not silently publish.
Duplicate detection must be reviewable.
Multiple offers per message must be supported.
---
8. SOURCE INGESTION
P0 source type: legitimate public company marketing newsletters subscribed to by platform-controlled addresses.
System should support:
source registry,
dedicated aliases,
message ingestion,
MIME / HTML normalization,
script stripping,
safe link capture,
source timestamp,
content fingerprinting,
source/company association.
Do not load remote scripts in Review Studio.
Raw source is private.
---
9. AI EXTRACTION
AI should output structured facts and evidence.
AI responsibilities:
detect whether message contains commercial offers,
detect multiple offers,
extract claims,
extract structured terms,
detect likely campaign / offer identity,
suggest same-offer match,
suggest changed fields,
suggest recognition candidate.
AI must not:
publish automatically,
call something illegal,
call something fraud/scam,
replace evidence with a generated summary.
---
10. HUMAN REVIEW STUDIO
Required split-screen interface.
Left:
original newsletter,
body,
headers needed for context,
links,
visible conditions,
footer.
Right:
extracted structured fields,
value,
confidence,
evidence,
verification status.
Interaction: click field → exact evidence is highlighted.
Per-field actions:
Confirm
Edit
Unknown
Offer-level actions:
Possible Duplicate
Possible Update
Merge
Split
Not an Offer
Human corrections must store AI prediction, human correction, evidence span, extractor version, reviewer ID and correction timestamp.
This becomes the Verified Offer Dataset.
---
11. SAME-OFFER MATCHING
Do not rely on one semantic similarity score.
Layered matching should consider:
company
campaign URLs / stable identifiers
normalized claim
offer type
commercial terms
temporal proximity
semantic similarity
reviewer override
Example response:
```json
{
  "candidate_offer_id": "offer_1741",
  "confidence": 0.87,
  "reason_codes": [
    "same_company",
    "same_offer_type",
    "claim_semantic_match",
    "same_intro_period"
  ],
  "changed_fields": ["normal_price"]
}
```
Track false merges aggressively.
---
12. CHANGE DETECTION
Compare verified Offer Versions.
Store:
```text
predecessor_version_id
successor_version_id
changed_fields
old_value
new_value
changed_at
evidence_ref
```
Example:
```text
NORMAL PRICE
v03 279 kr./md.
→
v04 299 kr./md.
```
This must become a first-class visual and intelligence object.
---
13. PUBLIC OFFER DETAIL
Required content:
company
campaign / offer identity
observed date
Offer Version
original claim
structured conditions
recognition
community signals
evidence
history
Recommended sections:
Overblik
Betingelser
Evidens
Community
Historik
Primary visual:
DET DER BLEV LOVET vs DET DER FAKTISK GÆLDER
---
14. COMPANY PROFILE
Required:
company name
observed offer count
community confirmation count
sample size
clarity dimensions
recent offers
recent changes
source/newsletter coverage
CTA “Jeg modtager deres nyhedsbrev”
Avoid a single dominant “trust score”.
---
15. CONSUMER NEWSLETTER SELECTION
Users select companies/newsletters they actually receive.
Required actions:
search companies,
select / deselect,
see pending campaigns,
suggest a missing company.
Missing company suggestions:
do not publish automatically,
moderation required,
deduplicate against existing company records.
---
16. COMMUNITY REVIEW FLOW
One question at a time.
Default question set:
Var det tydeligt, hvad tilbuddet kostede?
Var det tydeligt, hvor længe kampagnen gjaldt?
Var prisen efter introperioden tydelig?
Var væsentlige betingelser synlige?
Fungerede tilbuddet som beskrevet?
Response values:
```text
clear
partial
unclear
unknown
```
Outcome question may use:
```text
confirmed
not_confirmed
unknown
```
Review should be keyboard accessible.
Target completion time: ~20 seconds.
---
17. COMMUNITY AGGREGATION
Example public output:
```text
153 modtagere vurderede tilbuddet
129 kunne tydeligt finde prisen
118 kunne tydeligt finde perioden
104 fandt væsentlige betingelser tydelige
8 ved ikke
```
Do not expose misleading precision on tiny samples. Show sample size.
---
18. CONTRIBUTOR PROFILE
Keep three values separate:
```json
{
  "contribution_points": 1480,
  "reputation": 92,
  "impact_count": 2341
}
```
Points = activity.
Reputation = reliability.
Impact = downstream usefulness.
Badges / levels are optional tests, not core v1.
---
19. RECOGNITION ENGINE
Working status: `clearly_documented`
Display: Tydeligt dokumenteret
Dimensions:
```text
claim_clarity
price_clarity
condition_visibility
time_clarity
promise_consistency
```
Recognition should store Offer Version, method version, timestamp, evidence refs, human verification and sample size.
Do not allow purchase of status.
---
20. MARKET PULSE
Initial implementation may be editorial/manual.
Possible blocks:
clearest offers,
biggest improvements,
biggest clarity declines,
common patterns,
new brands,
changed since last month.
Methodology and sample size must be visible.
---
21. PUBLIC / PRIVATE DATA BOUNDARY
Private raw source
full raw newsletter
full subject
source delivery metadata
internal notes
raw extraction traces
Internal structured evidence
extracted fields
confidence
evidence spans
corrections
model version
Public projection
approved structured offer facts
selected evidence excerpts/references
history
community aggregate
recognition
B2B projection
Offer Graph-derived market intelligence
no unnecessary personal mailbox data
---
22. AUTH / ROLES
Suggested roles:
```text
consumer
ambassador
editor
admin
b2b_user
```
Authorization must be enforced server-side.
---
23. I18N
Use locale keys for all product UI.
Suggested structure:
```text
/locales
  da-DK.json
  en.json
```
Do not translate source evidence destructively.
Store original source text, original language and optional translation separately.
Enums should remain language-neutral.
---
24. REBRANDABILITY
No domain logic may depend on working name.
Central config:
```ts
brand = {
  name,
  logo,
  tagline,
  colors,
  recognitionName,
  publicUrl,
  emailSender
}
```
Changing from SPORLAG to another cleared brand should not require schema migration.
---
25. RECOMMENDED TECHNICAL SEPARATION
Conceptual services/stores:
```text
RAW SOURCE STORE
private source material

EVIDENCE STORE
extractions + evidence + corrections

OFFER GRAPH
canonical structured entities

PUBLIC DATA PROJECTION
consumer-safe published data

INTELLIGENCE PROJECTION
professional market views
```
A PostgreSQL-based implementation is suitable.
Supabase or equivalent is acceptable if permissions are correctly designed.
Object storage may be used for raw MIME/HTML if access control is strong.
---
26. API BOUNDARY — MINIMUM
Suggested routes:
```text
GET  /api/companies
GET  /api/companies/:id
POST /api/companies/suggestions

GET  /api/offers
GET  /api/offers/:id
GET  /api/offers/:id/versions
GET  /api/offers/:id/community-summary
GET  /api/offers/:id/recognition

GET  /api/users/me/newsletters
POST /api/users/me/newsletters/:newsletterId
DELETE /api/users/me/newsletters/:newsletterId

GET  /api/users/me/review-queue
POST /api/offers/:id/reviews
GET  /api/users/me/contribution-profile

GET  /api/internal/newsletter-sources
POST /api/internal/newsletter-sources

POST /api/internal/messages
GET  /api/internal/messages/:id

POST /api/internal/messages/:id/extract
GET  /api/internal/messages/:id/extractions

POST /api/internal/extractions/:id/verify
POST /api/internal/extractions/:id/correct

POST /api/internal/offers/match
POST /api/internal/offer-versions/:id/publish
```
---
27. SECURITY / PRIVACY IMPLEMENTATION
P0:
sanitize newsletter HTML,
never execute newsletter scripts,
protect raw content,
minimize stored headers,
explicit role checks,
audit editorial changes,
audit publication,
CSRF protection as applicable,
rate limits for community contributions,
duplicate protection,
moderation tools,
least-privilege access.
Do not expose internal message bodies through consumer APIs.
---
28. DESIGN IMPLEMENTATION REQUIREMENTS
Follow `02_DESIGN_BRAND.md`.
Critical requirements:
spacious editorial layouts,
Phosphor-style icons,
front/back/history metaphor,
restrained radius,
no star ratings,
no generic trust shield,
no AI sparkle branding,
no generic purple gradient,
no card spam,
reduced motion,
accessibility,
responsive mobile recomposition.
---
29. V1 ACCEPTANCE CRITERIA
A. Source ingestion
[ ] At least one real Danish public marketing newsletter source can be registered.
[ ] A message can be ingested safely.
[ ] Raw source remains private.
B. Extraction
[ ] A message can produce one or more candidate offers.
[ ] Each field includes evidence + confidence + extractor version.
[ ] Multiple offers per email are supported.
C. Human review
[ ] Reviewer can see source and extraction side by side.
[ ] Clicking a field highlights exact evidence.
[ ] Reviewer can confirm / edit / unknown.
[ ] Human correction is retained.
D. Matching / history
[ ] Candidate can match an existing Offer.
[ ] Reviewer can override incorrect match.
[ ] New Offer Version is created when material terms change.
[ ] Changed fields are stored.
[ ] History is visible publicly after publication.
E. Publication
[ ] Verification and publication are distinct.
[ ] Unverified facts cannot be published accidentally.
[ ] Public view contains only approved structured content.
F. Consumer product
[ ] Explore works.
[ ] Company page works.
[ ] Offer detail works.
[ ] Evidence works.
[ ] History works.
[ ] User can select newsletters.
[ ] Review queue works.
[ ] Review can be completed on mobile and desktop.
G. Community
[ ] Structured responses are stored.
[ ] Aggregate shows sample size.
[ ] No star rating.
[ ] Points / reputation / impact are separate.
H. Recognition
[ ] Recognition belongs to Offer Version.
[ ] Criteria can be opened.
[ ] Timestamp/version shown.
[ ] No legal certification implication.
I. i18n
[ ] All application UI uses locale keys.
[ ] da-DK works.
[ ] en architecture works.
[ ] Source text remains original.
J. Accessibility
[ ] keyboard usable
[ ] focus visible
[ ] AA contrast
[ ] reduced motion
[ ] mobile tap targets
[ ] semantic dialogs/forms
---
30. FIRST IMPLEMENTATION SEQUENCE
Recommended order:
```text
1. Database schema / Offer Graph
2. Source Registry
3. Message ingestion
4. Source sanitization
5. Extraction schema
6. Review Studio
7. Offer matching
8. Offer Version / diff engine
9. Publication projection
10. Public offer detail
11. Company pages / explore
12. User auth
13. Mine nyhedsbreve
14. Review queue
15. Community aggregate
16. Recognition
17. Market Pulse
18. Mobile / accessibility
19. 25-message deep dataset
20. 100-offer benchmark
```
---
31. LATER — DO NOT BLOCK V1
Do not delay v1 for:
Gmail integration
Outlook integration
browser extension
real-time alerts
full B2B dashboard
public API product
complex billing
international launch
advanced leaderboard
automated legal analysis
company-wide permanent scores
---
32. BUILDER PROMPT
If a build system asks for a single short instruction after these files are uploaded, use:
> Read `01_PROJECT_MASTER.md`, `02_DESIGN_BRAND.md`, and `03_BUILD_SPEC.md` as the project source of truth. Build the Denmark-first validation-ready v1 described there. Preserve the Offer Graph, provenance, privacy boundaries, front/back/history design grammar and community factual-review model. SPORLAG is only a working brand. Do not make Gmail/browser extension part of P0, do not create star ratings or automatic legal judgments, and do not simplify the product into a generic SaaS dashboard. Prioritize the end-to-end source → extraction → human review → offer matching → version history → publish → community flow.

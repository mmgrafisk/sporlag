01 — PROJECT MASTER
OfferAlert / working brand: SPORLAG
Handoff version: 2026-09-15  
Stage: Prototype / MVP / pre-revenue  
Primary market: Denmark  
Primary locale: da-DK  
Secondary locale: en  
Brand status: NOT LOCKED
---
START HERE — INSTRUCTIONS TO ANY NEW BUILDER / AI
Read these three files in order:
`01_PROJECT_MASTER.md`
`02_DESIGN_BRAND.md`
`03_BUILD_SPEC.md`
Treat them together as the current handoff source of truth.
Do not silently revive older decisions from legacy OfferAlert material if they conflict with this handoff.
The most important active overrides are:
Gmail/browser extension is LATER, not current P0.
Denmark is the first market.
The platform's primary early data engine is platform-owned legitimate newsletter subscriptions, not personal inbox access.
Community members verify concrete campaigns they themselves receive.
AI extracts and structures offers but does not make automatic legal judgments.
`SPORLAG` is a working brand candidate only, not the final cleared name.
`FairFlag` is not the masterbrand.
Positive recognition is currently represented by the neutral working label “Tydeligt dokumenteret”.
The long-term company is the Offer Graph / living commercial evidence platform, not an email extension.
If a builder must choose between “more features” and “stronger provenance / clearer offer history”, choose provenance and offer history.
---
1. NORTH STAR
Build a living map of commercial offers.
The platform documents:
what companies promise,
what the actual commercial conditions are,
the evidence behind each structured fact,
what consumers confirm,
and how offers change over time.
Consumers get factual signals before acting.
Clear and well-documented offers can receive positive recognition.
Unclear, conditional or problematic offers can be documented with evidence rather than labeled through broad company ratings.
Over time, the data becomes a historical Offer Graph that professionals can use for monitoring, benchmarking and intelligence.
Category definition
Living commercial evidence
A living, historical market map of what companies promise, what actually applies, and how commercial offers change over time.
Strategic framing
From ephemeral marketing to permanent market memory.
Marketing changes and disappears. The record should not.
---
2. WHAT THE PRODUCT IS
The product sits between four existing categories:
competitor / marketing intelligence,
offer / price comparison,
consumer review / trust,
advertising / compliance monitoring.
But it should not become a copy of any of them.
Its differentiation is the combination of:
versioned offer data,
evidence and provenance,
factual community confirmations,
positive offer-level recognition,
historical change tracking,
professional market intelligence.
The core unit is the concrete commercial offer / claim, not the company as a whole.
---
3. WHAT THE PRODUCT IS NOT
Do not turn it into:
a generic review site,
Trustpilot 2.0,
a coupon site,
a price-comparison clone,
a casino affiliate product,
a gambling optimization product,
a Gmail extension company,
an email archive,
a compliance certification company,
an automatic legal judge,
an “AI-powered” wrapper with no proprietary data asset.
The browser extension can become a later distribution channel.
Email is one data source.
AI is a means.
The Offer Graph is the strategic asset.
---
4. CURRENT STAGE
Prototype / MVP / pre-revenue
The project has already established the product thesis, early data model, community model, recognition model, visual direction, and a live interactive frontend preview.
Current live preview created during this project:
`https://sporlag-preview-0r41i6.v2.appdeploy.ai/`
Treat that preview as a UX reference, not as the definitive codebase or brand.
The next important proof is not “can we make more screens?”
It is:
> Can real marketing newsletters become verified, structured Offer Graph records with evidence, versions and useful consumer/community output?
---
5. ACTIVE PRODUCT DECISIONS
5.1 Denmark-first
Launch market is Denmark.
Primary locale: `da-DK`
Secondary locale: `en`
International architecture should be supported from the start, but international rollout is later.
5.2 Gmail is later
Do not make personal Gmail access a P0 dependency.
Do not design the core product around Chrome/Gmail.
The product must still make sense when data later comes from newsletters, websites, ads, SMS, apps, public price feeds, and other commercial touchpoints.
5.3 Primary early data supply
The platform itself legitimately subscribes to companies' public marketing newsletters using controlled platform addresses / aliases.
Example conceptual pattern:
```text
telmore@inbox.platform
mofibo@inbox.platform
brand-x@inbox.platform
```
Raw source content remains private/internal by default.
5.4 AI extraction + human verification
AI should extract structured fields and evidence spans.
Early versions use human/editorial verification for quality, edge cases and recognition.
AI corrections become evaluation data.
5.5 Community is core
Registered consumers choose companies/newsletters they themselves receive.
CTA wording should reflect this:
> “Jeg modtager Telmores nyhedsbrev”
Users get a personal review queue for concrete observed campaigns.
5.6 No star ratings
Community answers structured factual questions.
Example:
> Var prisen tydelig?
Answers:
Ja, tydeligt
Delvist
Nej, ikke tydeligt
Ved ikke
The system should aggregate concrete observations, not vague sentiment.
5.7 Positive recognition matters
The platform must show what works well, not only what is unclear.
Working recognition: Tydeligt dokumenteret
Recognition belongs first to a concrete Offer Version.
It must not imply legal certification, regulatory approval, or permanent company approval.
It cannot be bought.
5.8 B2C → B2B model
B2C should be free / low-friction and create coverage, distribution, structured community data, public discoverability and trust.
B2B later monetizes history, competitor monitoring, change detection, benchmarks, alerts, export and later API access.
Do not build a giant B2B dashboard before validating real professional demand.
The cheapest B2B experiment is a manual/semi-manual competitor-intelligence brief.
---
6. CORE PRODUCT MODEL
The canonical graph is:
```text
Company
  ↓
Newsletter / Source
  ↓
Message
  ↓
Campaign
  ↓
Offer
  ↓
Offer Version
  ↓
Evidence
  ↓
AI Observation
  ↓
Human Verification
  ↓
Community Observation
  ↓
Recognition
```
One email may contain multiple offers.
The same offer may appear in multiple emails with different subject lines.
A changed price, period, eligibility rule or condition may create a new Offer Version instead of a new Offer.
This distinction is central to the product's long-term value.
---
7. DATA ASSET / MOAT
Long-term defensibility should come from:
Offer IDs,
normalized claims,
structured conditions,
evidence and provenance,
first-seen / last-seen data,
Offer Version history,
same-offer matching,
change detection,
community observations,
verified corrections,
quality / reputation signals,
public distribution and indexing,
professional workflows built on top of the graph.
The extension itself is reproducible. The historical data asset is much harder to reproduce.
---
8. CONSUMER VALUE PROPOSITION
Consumer framing should be factual and calm.
Good direction:
> Se hele tilbuddet — ikke kun overskriften.
> Et tilbud er mere end claimet.
> Se hvad der blev lovet, hvad der faktisk gælder, og hvad der har ændret sig.
Avoid accusatory or legal framing.
---
9. COMMUNITY MODEL
The community is not mainly a complaint channel. Its job is to improve structured evidence.
A user's contribution may include factual confirmation of advertised price, normal price, intro period, binding period, visible conditions, fees, restrictions, minimum purchase, eligibility and whether the offer worked as described.
Review target
A normal campaign review should take approximately 20 seconds.
One question at a time.
Points, reputation and impact must be separate
Contribution Points — participation / useful work.
Reputation — historical reliability / agreement quality.
Impact — how many others potentially benefited from data the user helped verify.
Do not reward negativity. Do not reward volume alone. Do not create incentives for competitor abuse or mass reporting.
---
10. AMBASSADORS / QUALITY
Start with approximately 5–10 pilot ambassadors.
Their purpose:
review harder cases,
verify AI outputs,
correct extraction errors,
evaluate recognition candidates,
help define quality standards.
They are not the primary source of content.
---
11. RECOGNITION MODEL
Working recognition label: Tydeligt dokumenteret
Recognition dimensions:
Claim clarity
Price clarity
Condition visibility
Time clarity
Promise consistency
Always keep recognition explainable.
Show criteria, timestamp, Offer Version, evidence context and sample size when community data is involved.
If evidence is too weak:
> Ikke tilstrækkelig dokumentation
Do not hide uncertainty behind a score.
---
12. MARKET PULSE
Market Pulse / Markedspulsen is a monthly editorial data product.
It should feel like a publication, not a dashboard.
Potential sections:
Månedens tydeligste tilbud
Største forbedringer
Tilbud der krævede mest forklaring
Mest almindelige marketingmønstre
Gode eksempler
Nye virksomheder observeret
Ændret siden sidst
Category trends
Any ranking must expose methodology and sample size.
---
13. PRIVACY / LEGAL GUARDRAILS
Privacy is P0.
Private by default
raw newsletter content,
full subject line unless deliberately approved,
delivery metadata not necessary publicly,
internal extraction traces,
moderation notes,
unnecessary personal data.
Public / professional structured candidate data
company,
campaign / offer identity,
claim,
structured commercial terms,
timestamps,
approved evidence references,
version changes,
aggregated community observations,
recognition status and method.
Personal email data must never become the primary B2B raw material.
Do not automatically make legal judgments such as illegal, fraud, scam or deceptive.
Privacy Policy, Terms and professional privacy/legal review are required before broad launch.
---
14. BUSINESS MODEL
B2C
Free / low friction.
Primary job: distribution, coverage, data quality, community and public discoverability.
B2B
Recurring revenue later from monitoring, competitor intelligence, historical offers, change alerts, benchmarks, exports and API.
Previous price ideas are only hypotheses and must not be treated as validated pricing.
Funding priority
grants / non-dilutive,
relevant programs / accelerators,
investors after traction and B2B evidence,
loans / credit lines are not current priorities.
Do not distort the product to look AI-first for funding.
---
15. FIRST VALIDATION DATASETS
Dataset A
Approx. 25 newsletters/messages.
Goal: deep manual review, schema validation, identify missing fields and edge cases.
Dataset B
Approx. 100 offers.
Goal: extraction benchmark, field acceptance / correction rates.
Dataset C
Repeated campaigns and variants.
Goal: same-offer matching, false-merge rate, change detection.
Start with around 20 Danish brands with varied offer structures.
---
16. SUCCESS METRICS
Measure:
AI field acceptance rate,
AI field correction rate,
evidence quality,
same-offer precision,
false merge rate,
change detection precision,
review completion rate,
community agreement,
community contribution rate,
recognition comprehension,
public-page engagement,
evidence of professional willingness to pay.
Do not treat planning assumptions as validated benchmarks.
---
17. OPERATING PRINCIPLES
Distinguish:
FACT
EVIDENCE
ACTIVE DECISION
WORKING HYPOTHESIS
INFERENCE
UNKNOWN
Use decision labels:
GO
TEST
LATER
NO
NEED EVIDENCE
For major decisions: challenge the preferred answer, consider opportunity cost, choose the cheapest informative experiment, fit the current project stage, and change course when stronger evidence appears.
---
18. CURRENT PRIORITY ORDER
Offer Graph and provenance
newsletter ingestion
extraction schema
Review Studio
same-offer matching
Offer Version creation
change detection
public offer experience
community review loop
recognition methodology
mobile/accessibility
100-offer benchmark
ambassadors
Market Pulse
manual B2B intelligence pilot
---
19. OUT OF CURRENT V1 SCOPE / LATER
Gmail extension
Outlook integration
browser-extension-led core experience
large B2B dashboard
full API product
international rollout
advanced gamification
automated legal/compliance judgments
company-wide permanent trust score
large ambassador/community program
---
20. HANDOFF SUCCESS DEFINITION
A real v1 is ready for meaningful testing when this complete chain works:
```text
1. Company exists in Source Registry
2. Platform subscribes to its marketing newsletter
3. Message is received
4. One or more offers are detected
5. AI extracts structured facts + evidence
6. Reviewer confirms / edits / marks unknown
7. System matches against existing offers
8. Offer Version is created when needed
9. Changed fields are recorded
10. Verified version can be published
11. Public Offer page shows promise / conditions / evidence / history
12. Eligible users receive a review task
13. Community observations aggregate
14. Recognition can be suggested / verified
15. Offer Graph preserves the history
```
If a builder can demonstrate this on real Danish marketing newsletters, the project has moved from prototype to a real validation-ready product.

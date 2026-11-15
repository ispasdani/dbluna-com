# DBLuna business plan

Working draft · 15 November 2026

## Executive summary

DBLuna turns database structure into a searchable map that helps people understand an unfamiliar database and build reporting from it. The initial commercial opportunity is a specific handoff. A company with an underdocumented SQL Server database hires a Power BI consultant and needs to explain which sources to use, how to join them, and how to validate the numbers.

The company approves the metadata to share. DBLuna imports the schema, generates the underlying reference, and lets a business owner add the reporting question, what one row represents, business rules and expected totals. The consultant opens a searchable offline HTML file and follows the relationship graph and dictionary. Data access for building and validating the report is a separate decision.

Start by selling to Power BI consultancies that repeat this workflow. Validate that consultants reach their first reconciled metric faster and that the same buyer pays to use DBLuna on a second project. Use that evidence to decide whether to grow through consultant-led distribution, sell directly to database owners, or continue as a small profitable software business.

## Company and product status

| Known from the project | To establish |
| --- | --- |
| DBLuna is a database diagramming and documentation application with a DBML editor and SQL Server, PostgreSQL, CSV and BACPAC import paths. | Legal entity, jurisdiction, founders and roles, ownership, IP assignments and brand rights. |
| The repository implements searchable DBML Docs, schema-qualified references and Reporting Handoff with source selection, report requirements, relationship visualization and offline HTML. | Deployed feature availability and the full signed-in and cloud persistence test results. |
| The handoff includes declared joins, suppresses unselected endpoints, and lets authors opt into descriptions and view SQL. | Customer approval needs, usability with unfamiliar consultants, redaction needs and useful support boundaries. |
| BACPAC parsing was exercised on Microsoft's sample with 48 tables and 98 resolved foreign keys. | Coverage across customer SQL Server versions, object types, unusual identifiers and metadata quality. |
| Repo pricing defines Free, Pro at 10/month or 100/year, and Enterprise by quote. | Checkout currency, billing unit, tax handling, entitlements and subscriptions actually available. |

Product implementation references include [Reporting Handoff](../../components/documentation/reporting-handoff-dialog.tsx), the [HTML generator](../../lib/generator/reporting-handoff.ts), [pricing definitions](../../constants/pricing.tsx) and the [BACPAC manual test plan](../../release-1-0/bacpac-manual-test-plan.md).

## Customer and problem

**First buyer.** Owner or delivery lead at a small Power BI consultancy with multiple SQL Server engagements per year. They can adopt a repeatable intake process and bear the cost of delayed or fixed-fee discovery. Their technical lead is usually the champion and may control a modest tooling budget.

**First user.** A consultant inheriting an undocumented database. They need trusted join columns, table grain, date and filter rules, and a reconciliation example. A schema map shows declared relationships. The owner still needs to confirm the intended reporting interpretation, especially when relationships are inferred or application logic is undocumented. [Microsoft Power BI relationship guidance](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand)

**Co-user and approver.** The customer’s database owner or IT lead can approve objects and definitions for export. The business sponsor supplies metric definitions and accepts the first reconciliation. Buyers without a source owner or access to a suitable test dataset are weak initial prospects.

**Secondary buyer.** An internal IT or analytics manager standardizing onboarding for several analysts or suppliers. They may value versioned approvals, private publishing and refresh more than offline handoff, with a longer buying process.

### Cost to validate

Look for hours spent reverse-engineering relationships, finding a metric owner, rewriting a report after a grain mismatch, and waiting for a team member to answer. A baseline example with three hours of consultant discovery at an illustrative $100/hour is $300 in labor. Measure actual baseline and improved time before using any savings figure in marketing.

## Product and differentiation

1. **Import and map.** Start with a supported schema format or extract. Show coverage, unresolved references and declared relationships. Test import against a representative approved package.
2. **Explain the task.** Select the report's relevant tables and views. Add a business question, recommended starting source, grain, date rules, exclusions and a validation total.
3. **Review and distribute.** Preview the exact export. Decide whether descriptions or view SQL are appropriate. Send the generated HTML through an approved channel.
4. **Build and reconcile.** The recipient uses the scoped map and dictionary alongside an approved reporting dataset. They note unknowns and reconcile against the owner’s example.

The positioning hypothesis is a short path from database schema to a report-specific, reviewed artifact. The user value lies in narrowing the investigation and handing off business meaning. Parsing alone is replicable. Potential differentiation comes from import fidelity, reusable reporting briefs, workflow history and distribution through agencies. A long-term advantage would require repeated usage and proprietary workflow knowledge, with customer permission for any use of their materials.

## Market and competition

The market starts with repeat Power BI delivery firms working against SQL Server and adjacent environments. Expand horizontally only after repeat use is established. Potential adjacent workflows include new analyst onboarding, audit handoffs, migrations and report modernization.

### Bottom-up market calculation

Create a named account list from Microsoft’s partner directory, independent BI consultancies and referrals. Deduplicate by firm. On a random or stratified sample, qualify Power BI delivery, repeat SQL Server work, a reachable sponsor and ability to purchase. Record denominators and estimate the fit rate. [Microsoft partner discovery guide](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-faq-publisher-guide)

| Estimate | Method | Illustrative input and output |
| --- | --- | --- |
| Serviceable accounts | Listed firms × share meeting criteria | 2,000 listed firms × 25% = 500 accounts. Both inputs are unvalidated. |
| Annual revenue capacity of that list | Serviceable accounts × effective annual revenue per account | 500 × $480 = $240,000. This is an example segment, not a market estimate. |
| Obtainable revenue | Paying accounts attainable within a period × observed annual revenue per account | 50 active accounts × $480 = $24,000 exit ARR at that price. This is a capacity example. |

If the reachable list validates at only hundreds of accounts at low annual revenue per account, pursue a lean business or prove higher-value agency or internal-team packaging before circulating a venture-scale claim. Build a wider TAM from separately estimated segments and remove overlaps.

| Alternative | Buyer advantage | DBLuna sales implication |
| --- | --- | --- |
| dbdiagram and dbdocs | Established DBML workspace with hosted diagram and docs plans. | Test how much buyers pay for a report brief, curated sharing and an offline deliverable in one flow. [Pricing](https://dbdiagram.io/pricing) |
| Redgate SQL Doc | Focused automatic SQL Server documentation. | Evaluate output fidelity and author effort against the reporting handoff job. [SQL Doc](https://www.red-gate.com/products/sql-doc/) |
| SqlDBM | Collaborative enterprise modeling and documentation. | Focus on first-project activation and speed for lean delivery teams. [SqlDBM pricing](https://sqldbm.com/Pricing/) |
| SQL Server tooling, Power BI model view and shared docs | Familiar workflow with tools teams may already own. | Compare against the actual default stack in pilots. Model view is valuable once the semantic model exists. [Microsoft model relationships](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand) |

## Business and pricing model

Keep the existing Free → Pro path for schema work. Pro is the initial self-serve subscription anchor. Confirm that the current paid product and checkout operate as documented. Test consultancy packaging with a clearly scoped paid pilot and a separate recurring quote, with no production data handling implied.

| Offer | Proposed validation | Success signal |
| --- | --- | --- |
| Existing Pro | Observe how often someone upgrades to complete a handoff and returns after delivery. | A measurable share exports again in a later project or refresh cycle. |
| Paid pilot | Test $150 for one guided handoff, with two short review sessions and a synthetic or approved schema. | Actual payment and completion within an explicitly limited support scope. |
| Agency workspace | Test $49/month per workspace for multi-project workflows once entitlement and service scope are defined. | A consultancy chooses recurring use and can name its next engagement. |

These price points are experiment inputs in USD. A $49 experiment is not a listed plan and should be offered only with explicitly agreed scope. Keep setup revenue separate from recurring revenue and include onboarding time in unit economics. Enterprise terms and service claims require separately validated delivery capability.

## Distribution and customer lifecycle

- **Acquire.** Founder-led outreach to a qualified agency list. Show a three-minute example and invite a pilot on the next active engagement. Track contacts, replies, meetings, offers, invoices and reasons lost.
- **Activate.** The buyer imports a schema, selects sources and exports a reviewed handoff that a second person opens. The first meaningful milestone is a recipient identifying the correct source and joins without the author on the call.
- **Deliver and retain.** Measure time to first reconciliation, clarification requests, and export reuse within 60 days. Hold a short debrief and capture the next planned use before counting the pilot as a recurring opportunity.
- **Expand.** Offer saved briefs, schema revisions and agency reuse once repetition is proven. Inbound content should teach concrete join and metric pitfalls. Pursue partnerships only after repeatable delivery.

## Operating strategy and milestones

| Window | Deliverables | Decision gate |
| --- | --- | --- |
| Days 1–30 | Verify browser release, build synthetic demo, test outreach, run 10 discovery interviews and recruit three pilots. | Three teams have an imminent use case, an owner and an approval path. |
| Days 31–60 | Deliver up to five measured pilots. Offer a paid package. Record time, unknowns, outcomes and support effort. | At least two paid pilots and three completed blinded handoffs are evidence targets. Revisit positioning if missed. |
| Days 61–90 | Test repeat projects, publish any consented evidence, and measure support cost and import reliability. | Seek two repeat engagements and a repeatable acquisition motion before increasing spend. |
| Months 4–12 | Harden import and metadata review. Prioritize retention features from evidence. Build lightweight analytics and budget review. | Decide bootstrap versus fundraising based on paid repeat usage, margin and acquisition capacity. |

## Risks and mitigations

| Risk | Response and evidence |
| --- | --- |
| Need is episodic | Sell to consultancies with repeat clients. Track use by engagement as well as monthly activity. Consider a per-project model if renewal stays weak. |
| Schema is incomplete or misleading | Preserve declared facts, show unresolved references, and label human-confirmed rules. Stop pilots with unresolved critical joins until a database owner verifies them. |
| Customer metadata is sensitive | Minimize collected metadata, use synthetic demos, preview export content and verify handling with owners. Downloaded HTML can be copied and lacks remote revocation. |
| Basic product matches alternatives | Benchmark real handoffs against the customer's existing tooling, including time to reconcile and number of owner interruptions. |
| Pro pricing absorbs too much support | Measure hands-on minutes and direct costs per activated and paying account. Separate guided work from recurring SaaS. |
| Operational dependency | Document critical providers, backups, incident ownership and cloud restore tests. Avoid promising controls or SLAs before verification. |
| Key-person risk | Assign operational owners, document release and billing procedures, and maintain access and IP records outside personal accounts. |

## Financial plan and capital decision

The linked [financial model notes](financial-model-notes.md) describe a 36-month planning model based on buyer acquisition, churn, effective recurring revenue, direct cost and planned operating spend. Replace assumed opening cash, costs and subscriptions with bookkeeping. Review contribution margin, net operating cash, minimum cash and the capital needed for the next proof milestone.

Bootstrapping is the default planning case until the founder chooses a funding strategy. An investor ask should be tied to hiring and release milestones, with the amount derived from the downside cash gap and contingency. Do not commit to terms or valuation based on these drafts.

Planning structure draws on [Sequoia's business plan guide](https://articles.sequoiacap.com/writing-a-business-plan) and [SBA planning guidance](https://legacy.sba.gov/business-guide/plan-your-business/write-your-business-plan).

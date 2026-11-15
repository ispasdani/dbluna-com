# Go-to-market and operating plan

## First 90 days

| Period | Primary owner | Work to complete | Evidence |
| --- | --- | --- | --- |
| Week 1 | Founder and product lead | Confirm production entitlements and manual tests. Build a demo schema and approved HTML with two joins, a date rule and a reconciliation example. Create a contact list with role and qualification reason. | Test results, demo file and 30 named firms. |
| Weeks 2–4 | Founder | Run ten interviews split between consultancy leads and SQL Server owners. Ask about the last completed project. Record elapsed discovery, staff time, mistakes and workarounds. Obtain permission before collecting evidence. | Interview notes, frequency counts and qualified pilot list. |
| Weeks 5–8 | Founder and delivery lead | Run up to five pilots. Alternate delivery approaches where feasible. Establish the same task definition and measure the team’s existing workflow. Quote a paid pilot to qualified prospects. | Pilot scorecards and payment evidence. |
| Weeks 9–12 | Founder and product lead | Ask sponsors for the next project and renewal decision. Measure customer support cost. Select the smallest product change likely to improve repeat use. | Cohort outcomes, expansion evidence and updated cash forecast. |

Roles are assignments to make. One founder can hold several roles. Track who does the work and time spent.

## Discovery and pipeline

Qualification questions:

1. Tell me about your most recent Power BI delivery that depended on an unfamiliar SQL database.
2. How did you choose the starting table, joins, grain and dates? Who answered the questions, and how long did each step take?
3. Where did the totals disagree? Describe the time spent resolving it.
4. What did IT approve for the external builder to receive?
5. Show a sanitized example of the current handoff, if approved.
6. What would need to happen for a next-project trial, and who pays for it?

An account enters the pilot stage only after it has an active project, a sponsor, an approved schema, and a recipient. Use stages **targeted → engaged → qualified → quoted → started → delivered → paid → repeat**. Record stage dates, next action, amount, reason lost and original channel. Review pipeline weekly and isolate founder referrals from colder acquisition.

Initial channel experiments:

- **Founder outreach.** Contact 30 well-qualified firms in small batches. Personalize around their actual SQL Server reporting services. Success target is three qualified conversations. Track denominators and learning before increasing volume.
- **Technical content.** Publish one useful SQL Server-to-Power BI walkthrough with a synthetic handoff. Measure sample downloads and pilot requests. Track qualified meetings by referral source.
- **Partner.** Ask two consultants to use the same intake pack on a second engagement. Document whose contract and support obligations apply before considering a referral fee.

## Pilot delivery protocol

1. **Intake.** Record owner, recipient, intended report, timeline, baseline, support time and applicable sharing rules. Choose a disposable diagram and synthetic or approved schema. Define a reconciliation tolerance with the sponsor.
2. **Prepare.** Parse the schema, review unresolved links, scope chosen objects and capture grain, dates, filters and known total. Export only reviewed metadata. Deliver data access instructions separately through the sponsor’s approved mechanism.
3. **Blind task.** Ask the recipient to identify the primary source, list join key pairs and use the brief to reconcile one metric. Ask them to log blockers and time spent. Keep the author off the call until the first attempt is recorded.
4. **Review.** Compare metadata with SQL Server and the exported artifact. Record successful reconciliation, time to task, owner interruptions and any differences due to access or source quality.
5. **Close.** Capture commercial decision, next project, import or product defects and support cost. Request written approval before public case-study use.

## Scorecard and metric definitions

| Metric | Definition | Initial target |
| --- | --- | --- |
| Qualified pilot rate | Qualified pilot conversations ÷ eligible discovery meetings | Learn baseline by channel |
| Handoff completion | Pilots with approved HTML and recipient review ÷ started pilots | At least 3 completed pilots |
| Time to first reconciliation | Recipient working minutes from opening the handoff to approved first total | Compare matched tasks where possible and report median with sample size |
| Owner clarification requests | Distinct questions requiring the source or business owner before first reconciliation | Fewer per completed pilot than baseline |
| Paid pilot conversion | Collected pilot payments ÷ formal pilot offers | At least 2 paid pilots |
| Repeat use | Paid accounts with a second real project within 60 days ÷ accounts old enough to observe | At least 2 repeat engagements |
| Support cost | Founder or staff time × loaded hourly rate, plus direct delivery costs | Measure every pilot and separate one-time support from recurring costs |
| Import quality | Imports with correct critical relationships and fields ÷ reviewed imports | Record unsupported objects and all critical mismatches |

## Product and operating cadence

- **First priority.** Browser and cloud persistence tests, import fidelity, explicit coverage reporting, and blind handoff usability.
- **Next, if clients repeat.** Saved briefs, approval and revision history, clear disclosure preview, versioned import comparison and agency-level templates.
- **Later, if a buyer repeatedly asks and will fund it.** Enterprise identity, private hosted sharing with revocation and audit, and integrations with existing catalogs or data models.
- **Weekly.** Review pipeline, pilot support load, customer questions and serious defects. Choose one bottleneck and one owner.
- **Monthly.** Reconcile billing and cash, replace model assumptions from cohort data, review vendor spend, and revisit pricing and runway.
- **Quarterly.** Review releases, deletion and incident handling, contractual claims, data access and user permissions.

# DBLuna business proposition

## Customer-facing one-liner

**Give your Power BI developer a map of the database and the rules for getting the numbers right.**

DBLuna turns a SQL Server schema into an offline, searchable handoff your team can review and share. Give the developer a starting table or view, show the joins and explain the report rules in the same file.

## The problem in the buyer’s words

> We can hire someone to build the dashboard. We still need to explain where the data lives, which joins to use, and what the totals should mean.

This is illustrative wording. Replace with a customer-approved quote after interviews.

A developer can open a database and inspect table names, but that leaves questions about grain, alternate date roles, refunds, and which view represents the approved definition. These choices affect model filtering and results. [Microsoft Power BI star schema guidance](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)

## What we deliver

| Need | Handoff deliverable | Acceptance example |
| --- | --- | --- |
| Find a starting point | Report brief and curated source list | Developer identifies the owner-approved sales reporting view. |
| Understand joins | Schema-filtered graph and exact declared join pairs | Developer follows the two-column join and identifies where one row can multiply. |
| Understand fields | Searchable dictionary with approved descriptions and grain | Developer finds invoice date and explains why it drives the metric. |
| Validate the report | Business rules and reconciliation example | Developer reproduces one owner-approved total within tolerance on approved data. |
| Share with a contractor | Preview and portable HTML | Recipient opens the file without an account and can navigate it offline. |

## Small paid pilot offer

**For** a Power BI consultancy or IT lead with one active SQL Server reporting project. **Scope** one database schema, one business question, a focused group of tables or views, one working session to capture context, and a short review of the recipient's result. Target a five-business-day delivery window once inputs are available.

- The sponsor provides an approved schema, business owner, report question and expected reconciliation example.
- DBLuna helps generate the first draft and the sponsor approves the final content. The Power BI developer builds and validates the report under their own access arrangement.
- A proposed $150 pilot fee tests willingness to pay. Agree scope, time box, data handling, fee and refund terms before starting. The agency subscription is a separate, optional discussion.
- A pilot passes when the recipient identifies the starting source and joins from the artifact, completes one reconciliation or specifies the exact data they still need, and the sponsor can name a reuse case.

## Example briefing copy

**Monthly sales by customer and product.** Start with Sales.OrderLines. One row represents one order line. Use Sales.Orders to obtain the order date and customer. Exclude cancelled orders. Agree with Finance how to handle returns and whether to report net or gross amounts. Compare the last closed month to the Finance total using the same timezone and filters. These names and rules are synthetic examples.

## Buyer messages

- **Consultancy owner.** Standardize discovery across clients and show where reporting assumptions and validation totals came from.
- **IT manager.** Give external analysts a scoped reference that your team can inspect before sharing.
- **Consultant.** Open a linked map and dictionary and spend less of the first meeting tracing tables. Validate actual time saved during the pilot.

## Demo and CTA

Show a synthetic 5-table sales schema. Open the brief, follow a composite join, search for a date field, and open the exported file offline. End with **“Try this on one upcoming Power BI report.”**

Keep credential and production row access separate. A BACPAC itself can contain data, and the current importer sends schema XML for processing. The generated HTML and any reviewed view SQL still contain potentially confidential business metadata. [Microsoft SqlPackage export](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage-export)

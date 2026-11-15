# Financial model notes

The model is an illustrative 36-month operating forecast in USD. It uses a single case selector and one monthly build. Use 1 for downside, 2 for base, or 3 for upside. Blue cells are editable. It assumes zero starting paid accounts and a zero funding inflow until edited. Starting cash and all operating assumptions are placeholders.

- Qualified trials are eligible sales opportunities or product trials per month. The initial monthly volume increases by the monthly growth driver. Conversion produces expected new paid accounts.
- Retention is monthly logo churn applied to opening accounts. Fractional accounts express expected values.
- Subscription revenue uses average active accounts and effective net monthly ARPA. Exit MRR uses closing accounts. ARR is exit MRR × 12. Effective ARPA can incorporate a mix of Pro and hypothetical agency subscriptions.
- Variable service costs use average accounts. Payment fees use subscription revenue. Fixed operating costs represent cash payroll and nonpayroll spend, with a separate increment in month 13 to test a scale step.
- The seeded cases keep fixed costs constant so differences in cash reflect the commercial and direct-cost assumptions.
- Cash receipts are assumed to track recognized revenue. Add real annual prepayment timing, pilot services, taxes, collections, capital expenditure, liabilities and financing terms once known. This workbook is an operating and cash model.
- The cash floor compares closing cash with a configurable reserve. Closing cash may go negative to show a funding gap. Opening cash, founder compensation and planned hiring should come from actual cash records and budgets before any fundraising decision.
- Model outputs are projections under assumed inputs. Replace acquisition, conversion, churn, ARPA and support assumptions from measured pilots and billing, and rerun the downside scenario before committing spend.

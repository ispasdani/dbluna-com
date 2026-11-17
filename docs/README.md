# DBLuna: project documents

Development finished on 16 Nov 2026. Start with [final-state.md](final-state.md).

## Current

| File | What it is |
|---|---|
| [final-state.md](final-state.md) | What shipped, what was never checked by hand, what was never built, known issues, branches, timeline. |
| [decisions.md](decisions.md) | The decisions that shaped the product and why, with links to the detailed plans. |
| [convex/architecture.md](convex/architecture.md) | How data moves: local and cloud diagrams, auth and billing, the AI assistant, import. |
| [convex/schema.md](convex/schema.md) | All 11 Convex tables. |
| [convex/api.md](convex/api.md) | Every Convex function and API route, with the access check it runs. |
| [testing/bacpac-manual-test-plan.md](testing/bacpac-manual-test-plan.md) | Hands-on test of BACPAC import and the schema docs. The only manual test plan. |
| [business/](business/README.md) | Business plan, proposition, operating plan, investor brief and deck, financial model. Drafts, 15 Nov 2026. |
| [../README.md](../README.md) | Running the project, checks, folder layout, the access rule. |

Where these disagree: the code wins over everything, `decisions.md` wins over the archived plans, and `final-state.md` wins over the archived status notes.

## Archive

[archive/](archive/README.md) holds the plans and status notes written while building. They record intent and reasoning at the time; many describe work as "planned" that later shipped, or gaps that were later closed. Code comments still link to them for the reasoning behind a piece of code.

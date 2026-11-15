# BACPAC documentation manual test plan

## Setup

- Use a disposable diagram on a test deployment with the BACPAC changes and matching Convex schema. Sign in with an account that can open **DBML Docs**, sync diagrams, and save and restore versions. Use a second tab in the same browser profile for deep-link tests.
- Use Microsoft's Wide World Importers Standard BACPAC for the baseline. The copy used for parser verification is available locally if the ignored dependency directory is still present. [Local BACPAC](../node_modules/wwi-verification.bacpac) · [Microsoft sample setup](https://learn.microsoft.com/en-us/sql/samples/wide-world-importers-oltp-install-configure/)
- For the edge cases, use a small package from a database you can inspect. Include the same table name in two schemas, a composite FK, a filtered unique index with included columns, table and column descriptions, a computed column, and a view that references a table. Include an explicitly qualified `public` table if that schema exists in the fixture. Record the expected metadata from the source catalog before importing.

## Test cases

| ID | Steps | Expected result |
| --- | --- | --- |
| B01 Import | Open a fresh diagram. Choose **Import → BACPAC**, select the Microsoft sample, click **Parse schema**, then **Import to canvas**. | The preview reports 48 tables and 98 relationships and shows no unresolved FK warning. The canvas loads and contains one relationship per imported FK. |
| B02 Metadata fidelity | Import the edge-case package into a fresh diagram. Open **DBML Docs** and compare the table pages and relationship cards with the source catalog. | Schema names distinguish the duplicate short names. Column types, defaults and computed expressions, ordered key columns, FK actions, and index details match the catalog. Imported descriptions and authored notes have distinct labels when both exist. |
| B03 Search | Search a qualified table name, a phrase found only in a column description, an index name, and a fragment of a view query. Try schema and type filters together, clear them, and search for a nonexistent object. | Exact names rank ahead of text matches. Filters restrict results, member results identify their owning table, and unmatched queries show an empty state. |
| B04 Member navigation | Activate column and index results with the keyboard. Copy a member URL into the second signed-in tab. Repeat for a matching member on a same-named table in another schema. Use browser Back and Forward. | Each result focuses the correct member. Opening the URL restores the matching table and member. Back and Forward restore the preceding and following member selections. |
| B05 Dependencies | Search for an imported view and open it. Select a known table dependency, then use **Referenced by** to return to the view. | The view shows available SQL and descriptions. Both links go to the correct schema-qualified object. A dependency outside the import stays visible as plain text. |
| B06 Exports | In Docs choose **Export .md**. Export **JSON** from the diagram toolbar and import it into a fresh diagram. | Markdown includes qualified names, key and index details, descriptions, view SQL, and dependencies. JSON re-import restores the same metadata, and search still finds it. |
| B07 Cloud reload | Sync the test diagram, wait for the save indicator to settle, reload, and reopen Docs. | The diagram, object definitions, descriptions, indexes, and relationships match the original. |
| B08 Version restore | In **Version history**, choose **Save version**. Rename a table or change an authored note and wait for save. Restore the saved version and reload. | The original name or note returns. Imported metadata, dependencies, and search results remain available after refresh. |
| B09 Errors and legacy | Try a ZIP renamed to `.bacpac` without `model.xml`, then open a diagram saved before these changes. | The invalid file produces a readable error and leaves the diagram intact. The older diagram still opens, edits, and exports. |

## Record the run

Record the commit or deployment, browser, fixture, and Pass, Fail, or Blocked for each test ID. For failures, include the observed result and the smallest reproduction. Use sample data or redact sensitive schema details before sharing screenshots, exports, or URLs.

The parser checks against the Microsoft sample and the automated JSON regression have already passed. B01–B09 cover the application workflow. B02 needs a source catalog or independently recorded expected metadata, and B07–B08 need a cloud-enabled test account.

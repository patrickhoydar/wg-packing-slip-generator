# Feature PRD: TE Packing Logic Integration

## Feature Overview

Add TE-specific packing logic into the `inquired.strategy.ts` layer. This logic will intelligently group book quantities (parsed from product columns) into boxes of 12 without splitting product versions across boxes—except for four known exceptions.

## Customer
- **Customer Name:** TE (Teacher Editions)
- **Strategy File:** `inquired.strategy.ts`

## CSV Format (Input Data)

- **Each row = one delivery location**
- **Product columns (starting around column 10)** contain strings like `"3, No Sticker"` or `"26, Needs Sticker: 5"`
- Columns may be:
  - Empty (no books ordered)
  - Include quantity + optional sticker note

## Parsing Rules

- Extract quantity: take the first number before the comma (e.g. `26` from `"26, No Sticker"`)
- Ignore the sticker note for box logic (it’s only relevant downstream)

## Packing Rules

1. **Max 12 books per box**
2. **A single version must not span across multiple boxes**
3. **If a row has more than 12 of one version:**
   - Create multiple full boxes (e.g., 26 books → 2 boxes of 12, 1 box of 2)
4. **Do not apply this logic to 4 specific delivery rows (exceptions)**

## Exception Handling

- Skip packing logic for 4 delivery addresses.
- These will be handled manually and identified via their `District or School` field.
- IDs for these will be injected manually or filtered before strategy is applied.

## Acceptance Criteria

- [x] Quantities parsed and packed correctly from CSV
- [x] Each box contains up to 12 books of a single version
- [x] Each box gets a packing slip with a box number noted on the slip
- [x] No version spans multiple boxes
- [x] 4 delivery rows are excluded from the logic (rows 2-6 with header row being row 1)
- [x] Strategy is only used for `customer === 'TE'`

## Files to Modify

- `inquired.strategy.ts` – core packing logic
- `customers.controller.ts` – optional packing preview
- `customers.service.ts` – may house utility parsing/packing functions

## Test Data

Use 5–6 schools from the real CSV (excluding the 4 exception rows). Ensure coverage includes:
- Single titles with <12, =12, >12 counts
- Multiple titles on same row
- Titles with and without stickers

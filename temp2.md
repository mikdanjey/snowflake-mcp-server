## 3. Key Features

### 3.7 JSON Import & Export

**Goal:** Quickly prefill the Recipe Create/Edit form from a JSON file and export recipes back to JSON for backup/sharing/reuse.

#### Import (Form Prefill)

- **Entry points**
  - “Import JSON” button on **New Recipe** and **Edit Recipe** pages.
  - Optional drag-and-drop zone on the form.

- **Accepted format**
  - MIME: `application/json`
  - File size limit: **512 KB** (configurable)
  - Schema: `RecipeImportV1` (see **Data Contract** below)

- **Behavior**
  - Parse and validate JSON.
  - Prefill all form fields: `name`, `baseServings`, `imageUrl`, `notes`, `ingredients[]`.
  - Ingredient rows are fully regenerated from JSON.
  - If fields are missing, use sensible defaults:
    - `baseServings` → 1
    - `ingredients[]` → at least one empty row

  - **Units**: keep as-is; no automatic conversions.
  - **Image**: if `imageUrl` is provided, just set the value; no auto-upload.

- **Conflict handling**
  - **New Recipe** page: import simply fills the form (no server calls).
  - **Edit Recipe** page: prompt user to _Replace all fields_ vs _Merge ingredients_.
    - **Replace**: overwrite current form values.
    - **Merge**: keep existing rows; append imported rows that have non-duplicate `id`s; update rows when `id` matches.

- **Validation & UX**
  - Validate schema; show field-level errors.
  - Show result toast: “Imported successfully” or error description.
  - Never auto-submit after import; user must click **Create/Save**.

#### Export

- **Entry points**
  - “Export JSON” button on **Recipe Detail** and **Edit Recipe** pages (single-recipe export).
  - Optional “Export All” on listing page (bulk export of all recipes).

- **Format**
  - Single file per recipe for single-export (`RecipeExportV1`).
  - One array of recipes for bulk export (`RecipeExportV1[]`).

- **Naming**
  - Single: `recipe-<slug>-<id>.json` (e.g., `recipe-dindigul-thalappakatti-mutton-biryani-1.json`)
  - Bulk: `recipes-export-YYYYMMDD-HHMM.json`

- **Content**
  - Include exactly what’s needed to re-import without data loss.
  - Exclude server-managed metadata not in your model (e.g., timestamps if not used).

- **Security**
  - Client-only generation; no secrets included.
  - If `imageUrl` points to S3, it’s exported verbatim—no signed URLs.

---

## 4. Data Model (Add Data Contracts)

### 4.1 `RecipeImportV1` (used to prefill form)

- `version`: `"RecipeImportV1"` (string, required)
- `name`: string, required
- `baseServings`: number, required
- `imageUrl`: string (AWS S3 URL), optional
- `notes`: string, optional
- `ingredients`: (react-hook-form nested form of ingredient objects)
  - `id`: string (UUID or any unique string), optional; if absent, generate one on import
  - `name`: string, required
  - `qty`: number, required
  - `unit`: string, required

**Notes**

- `createdBy` is **static “Mani”** at display time; not part of import.
- Import must not call the server; it only fills the client form data.

### 4.2 `RecipeExportV1` (output of export)

- `version`: `"RecipeExportV1"` (string)
- `id`: number (if exporting an existing recipe), optional for draft
- `name`: string
- `baseServings`: number
- `imageUrl`: string (optional)
- `notes`: string (optional)
- `ingredients`: array of:
  - `id`: string
  - `name`: string
  - `qty`: number
  - `unit`: string

**Compatibility**

- `RecipeExportV1` must be accepted by the importer as `RecipeImportV1` (forward-compatible).

---

## 6. User Flow (Add Steps)

- **Create → Import JSON**: User clicks _Import JSON_ → selects file → form fills → user reviews → clicks _Create_.
- **Edit → Import JSON**: User clicks _Import JSON_ → selects file → choose _Replace_ or _Merge_ → review → _Save_.
- **Detail → Export JSON**: User clicks _Export JSON_ → download single recipe file.
- **List → Export All** (optional): User clicks _Export All_ → download all recipes as one JSON array.

---

## 7. Non-Functional Requirements (Additions)

- **Validation**
  - Strict JSON schema validation with human-readable errors.
  - Numeric parsing should be locale-safe (dot decimal).

- **Resilience**
  - Graceful failure on malformed JSON; never crash UI.

- **Performance**
  - Import should handle up to **200 ingredients** per recipe within the file size limit.

- **Versioning**
  - `version` field ensures future-proof upgrades; importer warns on unknown versions.

---

## 8. Future Enhancements (Optional) — Import/Export

- **CSV import/export** with a column mapper (name/qty/unit).
- **Template gallery**: prebuilt JSON templates users can import.
- **Partial export**: export just ingredients or shopping list (scaled).
- **Signed URL generation** for S3 on export (if ever needed).
- **Diff preview** during Edit import (visual compare before merge).

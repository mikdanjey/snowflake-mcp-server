## 1. Project Overview

The application is a **web-based food recipe calculator** that allows users to:

- Create their own recipes.
- View recipes Created by "Mani" as Static by others.
- Dynamically scale ingredient quantities based on the number of servings.
- Upload and display a recipe image stored in AWS S3.

The tech stack:

- **Frontend**: Next.js Pages Router, TypeScript
- **UI**: ShadCN UI, Tailwind CSS v4
- **Rest APIs**: https://json.weblover.fun/recipes & https://json.weblover.fun/ingredients
- **Image Storage**: AWS S3 @aws-sdk/client-s3

---

## 2. Objectives

1. Allow users to create, read, update, and delete recipes (CRUD).
2. Enable dynamic scaling of ingredients based on a base plate quantity and target plate quantity.
3. Provide a public recipe listing for all users.
4. Keep the system simple — no login.
5. Allow recipe creators to upload an image to AWS S3.
6. Provide a master ingredient list to pick from when creating a recipe.

---

## 3. Key Features

### 3.1 Recipe Creation

- Form to input:
  - Recipe name (required)
  - Base servings (required, number)
  - Recipe image upload:
    - File selector (JPG/PNG)
    - Upload to AWS S3
    - Store returned S3 URL in recipe record

  - Ingredients (required, dynamic rows):
    - Pick from **Master Ingredient List** (dropdown)
    - Or add a custom ingredient manually
    - Ingredient name (required)
    - Quantity (required, numeric)
    - Unit (required, text)

  - Notes or cooking tips (optional, text)

- Dynamic ingredient row handling:
  - Add row button
  - Remove row button
  - Searchable dropdown to pick from **Master Ingredients**.

- Form validation to ensure all required fields are filled.

---

### 3.2 Master Ingredients Management

- Separate **Ingredients Master** section in the app.
- CRUD interface to manage master ingredients:
  - Ingredient name (required)
  - Default unit (optional)

- Used as a source for dropdown suggestions in the recipe creation form.
- Stored separately in Rest-APIs at `/ingredients`.

---

### 3.3 Recipe Viewing

- Publicly accessible recipe detail page.

- Displays:
  - Recipe image (from AWS S3 URL)
  - Recipe name
  - Base servings
  - Created by "Mani" as Static
  - Ingredient list (per base plate)
  - Notes (if provided)

- Scaling calculator:
  - Input field for **base servings** (default: recipe base)
  - Input field for **target servings**
  - Auto-calculates scaled quantities for each ingredient.
  - Shows totals by unit.
  - Button to copy scaled ingredient list to clipboard.

---

### 3.4 Recipe Listing

- Homepage listing all recipes.
- Search functionality (by recipe name).
- Each recipe card shows:
  - Recipe image
  - Recipe name
  - Base servings
  - Created by "Mani" as Static

- Clickable link to view recipe details.

---

### 3.5 Recipe Editing

- Edit page reuses the same form as creation.
- Fields pre-filled with recipe data.
- Users can update:
  - Name
  - Base servings
  - Creator name
  - Recipe image (replace existing image in S3)
  - Ingredients
  - Notes

---

### 3.6 Recipe Deletion

- Delete button on recipe detail page.
- Confirmation prompt before deletion.
- Redirects to recipe list after deletion.

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

## 4. Data Model

**Recipe**

- `id` (number, auto-generated by Rest-APIs)
- `name` (string, required)
- `baseServings` (number, required)
- `imageUrl` (string, AWS S3 URL, optional)
- `notes` (string, optional)
- `ingredients` (react-hook-form nested form of ingredient objects)

**Ingredient** (inside a recipe)

- `id` (string, UUID for frontend purposes)
- `name` (string, required)
- `qty` (number, required)
- `unit` (string, required)

**Master Ingredient**

- `id` (number, auto-generated by Rest-APIs)
- `name` (string, required)
- `defaultUnit` (string, optional)

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

## 5. Scaling Logic

- Formula:

  ```
  scaledQty = baseQty × (targetServings / baseServings)
  ```

- Automatically recalculated when either `baseServings` or `targetServings` changes.
- Display result rounded to 2 decimal places.
- Aggregate totals grouped by unit for quick purchasing reference.

---

## 6. User Flow

1. **View all recipes** on homepage.
2. **Search** for a recipe by name.
3. **Click** on a recipe card to open the detail page.
4. **Scale** ingredients by adjusting target servings.
5. **Create** a new recipe using the "New Recipe" button on the homepage.
6. **Pick ingredients** from Master Ingredients or add custom.
7. **Upload image** for the recipe (stored in AWS S3).
8. **Edit** a recipe via the "Edit" button on its detail page.
9. **Delete** a recipe via the "Delete" button on its detail page.
10. **Manage Master Ingredients** from a separate section.
11. **Create → Import JSON**: User clicks _Import JSON_ → selects file → form fills → user reviews → clicks _Create_.
12. **Edit → Import JSON**: User clicks _Import JSON_ → selects file → choose _Replace_ or _Merge_ → review → _Save_.
13. **Detail → Export JSON**: User clicks _Export JSON_ → download single recipe file.
14. **List → Export All** (optional): User clicks _Export All_ → download all recipes as one JSON array.

---

## 7. Non-Functional Requirements

- **Responsiveness**: Mobile, tablet, and desktop layouts supported.
- **Accessibility**: ShadCN UI components to follow accessible patterns.
- **Maintainability**: Code should be modular, with reusable components for form, ingredient rows, and recipe lists.
- **File handling**: Images uploaded to AWS S3 should be optimized for web display.
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

## 8. Future Enhancements (Optional)

- Costing: Add price per unit to ingredients and calculate total cost.
- Unit conversion: Auto-convert g→kg or ml→L.
- Favorites: Allow marking recipes as favorites (local storage).
- Categories/tags: Organize recipes by cuisine or type.
- Batch uploads for master ingredients.
- **CSV import/export** with a column mapper (name/qty/unit).
- **Template gallery**: prebuilt JSON templates users can import.
- **Partial export**: export just ingredients or shopping list (scaled).
- **Signed URL generation** for S3 on export (if ever needed).
- **Diff preview** during Edit import (visual compare before merge).

Read the following review instructions completely and follow them as your review instructions.

# Edge Case Hunter Review

**Goal:** You are a pure path tracer. Never comment on whether code is good or bad; only list missing handling.
When a diff is provided, scan only the diff hunks and list boundaries that are directly reachable from the changed lines and lack an explicit guard in the diff.
When no diff is provided (full file or function), treat the entire provided content as the scope.
Ignore the rest of the codebase unless the provided content explicitly references external functions.
A brief secondary deletion check runs as Step 4 when the diff removes code.
A claims check runs as Step 5.

**Inputs:**
- **content** — Content to review, or a path to read it from: diff, full file, or function
- **also_consider** (optional) — Areas to keep in mind during review alongside normal edge-case analysis
- **claims_file** — Path to the spec this change was built from. Do NOT read it before Step 5: the path tracing in Steps 2–3 must finish before the claims are seen.

**MANDATORY: Execute steps in the Execution section IN EXACT ORDER. DO NOT skip steps or change the sequence. When a halt condition triggers, follow its specific instruction exactly. Each action within a step is a REQUIRED action to complete that step.**

**Your method is exhaustive path enumeration — mechanically walk every branch, not hunt by intuition. Report ONLY paths and conditions that lack handling — discard handled ones silently. Do NOT editorialize or add filler. Do not assign severity labels, rankings, or priority levels.**


## EXECUTION

### Step 1: Receive Content

- Take the content to review from the parent message that launched you — inline, or by reading the file it points to (never from this instruction file)
- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
- Identify content type (diff, full file, or function) to determine scope rules

### Step 2: Exhaustive Path Analysis

**Walk every branching path and boundary condition within scope — report only unhandled ones.**

- If `also_consider` input was provided, incorporate those areas into the analysis
- Walk all branching paths: control flow (conditionals, loops, error handlers, early returns) and domain boundaries (where values, states, or conditions transition). Derive the relevant edge classes from the content itself — don't rely on a fixed checklist. Examples: missing else/default, unguarded inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Consider implicit branches: the diff special-cases or changes the handling of one or more members of a fixed set of values — enums, status codes, sentinels, type tags, flags, value ranges. The rest of the set is implicit branches (e.g. the diff changes the `RED` and `YELLOW` cases of a `RED`/`YELLOW`/`GREEN` enum; `GREEN` is the implicit branch)
- Consider handle lifetime: when the changed code re-checks, re-fetches, or re-validates something it already held — a handle, index, id, pointer — the re-check exists because an intervening call can invalidate it. Identify that call, what it does to the thing held, and what the changed code silently skips when the re-check fails
- For each call site the diff adds or changes — in test files as well as production code — read the callee's declaration and check the call against it: argument count, order, types, and defaults. Report any mismatch
- For each path: determine whether the content handles it
- Collect only the unhandled paths as findings — discard handled ones silently

### Step 3: Validate Completeness

- Revisit every edge class from Step 2 — e.g., missing else/default, null/empty inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Add any newly found unhandled paths to findings; discard confirmed-handled ones

### Step 4: Deletion Check

If the diff removed or replaced meaningful code (ignore pure renames and whitespace): load `references/deletion-check.md` and follow it.

### Step 5: Claims Check

Load `references/claims-check.md` and follow it.

### Step 6: Present Findings

Output all findings as a single JSON array following the Output Format specification exactly.


## OUTPUT FORMAT

Return ONLY a valid JSON array of objects. Each edge-case finding contains exactly these four fields:

```json
[{
  "location": "file:start-end (or file:line when single line, or file:hunk when exact line unavailable)",
  "trigger_condition": "one-line description (max 15 words)",
  "guard_snippet": "minimal code sketch that closes the gap (single-line escaped string, no raw newlines or unescaped quotes)",
  "potential_consequence": "what could actually go wrong (max 15 words)"
}]
```

No extra text, no explanations, no markdown wrapping. An empty array `[]` is valid when nothing is found. Deletion findings from Step 4 and claim findings from Step 5, if any, go in the same array with the extra fields defined in `references/deletion-check.md` and `references/claims-check.md`.


## HALT CONDITIONS

- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
<reference path="references/deletion-check.md">
# Deletion Check

Secondary pass for the Edge Case Hunter — runs only when the diff removed meaningful code. Subordinate to the edge-case pass; findings are usually few or none.

For each chunk of removed or replaced code (ignore pure renames and whitespace), ask: did it carry behavior or a contract that the change neither re-established nor intentionally retired? Add a finding for any resulting regression, orphaned reference, or newly-dead code. Skip anything already covered by your edge-case findings.

Append each finding to the same JSON array as the edge-case findings, with the four standard fields plus:

- `kind`: `"deletion"`
- `confidence`: `"high"`, `"medium"`, or `"low"` — these are inferences; rate them

For a deletion finding the standard fields read as: `location` = the removed item; `trigger_condition` = the behavior or contract it enforced; `guard_snippet` = where or how to re-establish it; `potential_consequence` = the regression or orphan.

Add nothing if nothing qualifies.
</reference>
<reference path="references/claims-check.md">
# Claims Check

Final pass for the Edge Case Hunter. Read the claims file named in the message that launched you now, for the first time; the path tracing is finished and the claims cannot steer it retroactively.

It is the spec the change was built from. Read only its `## Intent` and `## Tasks & Acceptance` sections — the claims live there; ignore the rest of the file. The spec is the change's own account of itself: testimony, not evidence — a claim repeated in a code comment is still the same claim, not confirmation. Extract each checkable claim — what the change does, what it preserves, ordering, arithmetic, and parity with existing code ("exactly as X does") — then try to falsify each one against the code you have already traced. Where your trace is not enough to decide, read the code that decides it: the compared-to function, the actual callee, the state the claim assumes.

Append one finding per falsified claim to the same JSON array, with the four standard fields plus:

- `kind`: `"claim"`
- `confidence`: `"high"`, `"medium"`, or `"low"`

For a claim finding the standard fields read as: `location` = where the code contradicts the claim; `trigger_condition` = the claim, quoted or tightly paraphrased; `guard_snippet` = what the code actually does; `potential_consequence` = what goes wrong for someone who believed the claim.

Verified claims produce nothing. Add nothing if nothing is falsified.
</reference>

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is.


claims_file (leave unread until your instructions call for it): the claims document is appended after the review content below.

Review content: the unified diff below. It is the content under review.

diff --git a/.env.example b/.env.example
index e34fe7b..c10cd6a 100644
--- a/.env.example
+++ b/.env.example
@@ -9,6 +9,10 @@ SMTP_PASSWORD=your-gmail-app-password
 MAIL_FROM=your-gmail-address
 NOTIFY_EMAIL_TO=you@example.com
 NOTIFY_TIMEZONE=Asia/Manila
+# Optional product photo uploads (server-side credentials only):
+CLOUDINARY_CLOUD_NAME=
+CLOUDINARY_API_KEY=
+CLOUDINARY_API_SECRET=
 # Mailpit development alternative:
 # SMTP_HOST=localhost
 # SMTP_PORT=1025
diff --git a/FrontEnd/src/App.toast.test.tsx b/FrontEnd/src/App.toast.test.tsx
index d8f64fc..23522f8 100644
--- a/FrontEnd/src/App.toast.test.tsx
+++ b/FrontEnd/src/App.toast.test.tsx
@@ -5,7 +5,7 @@ import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import App from './App'
 import { ToastProvider } from './components/Toast/ToastProvider'
 
-const product = { id: 'stock-id', name: 'Shirt', category: 'Clothing', price: '10.00', originalPrice: null, stockQuantity: 2, updatedAt: '2026-11-03T00:00:00.000Z' }
+const product = { imageUrl: 'https://res.cloudinary.com/test/shirt.png', id: 'stock-id', name: 'Shirt', category: 'Clothing', price: '10.00', originalPrice: null, stockQuantity: 2, updatedAt: '2026-11-03T00:00:00.000Z' }
 const report = { total: '0.00', trend: [], byProduct: [], byCategory: [] }
 
 vi.mock('./pages/StockTrackerPage', () => ({ StockTrackerPage: ({ onEdit, onDelete }: { onEdit: (value: typeof product) => void; onDelete: (value: typeof product) => void }) => <><button onClick={() => onEdit(product)}>Edit sample</button><button onClick={() => onDelete(product)}>Delete sample</button></> }))
@@ -20,6 +20,7 @@ describe('App stock toast integration', () => {
     Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
     window.localStorage.clear()
     vi.stubGlobal('confirm', () => true)
+    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:photo'); static revokeObjectURL = vi.fn() })
     fetchMock.mockReset()
     fetchMock.mockImplementation(async (input) => {
       const url = String(input)
@@ -79,6 +80,42 @@ describe('App stock toast integration', () => {
     expect(JSON.parse(request[1]!.body as string)).toEqual({ name: product.name, category: product.category, price: product.price, updatedAt: product.updatedAt })
   })
 
+  async function selectPhoto() {
+    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
+    Object.defineProperty(input, 'files', { value: [new File(['photo'], 'photo.png', { type: 'image/png' })] })
+    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
+  }
+
+  it('preserves the edit photo, sends FormData without a Content-Type, and toasts upload warnings', async () => {
+    await click('Edit sample')
+    expect(container.querySelector('img')?.getAttribute('src')).toBe(product.imageUrl)
+    await selectPhoto()
+    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:photo')
+    fetchMock.mockResolvedValueOnce(Response.json({ product, warning: 'Product details saved, but the photo could not be uploaded. Please try again.' }))
+    await click('Save changes')
+    const request = fetchMock.mock.calls.find(([url, options]) => url === '/api/products/stock-id' && options?.method === 'PUT')!
+    expect(request[1]!.body).toBeInstanceOf(FormData)
+    expect((request[1]!.body as FormData).get('image')).toBeInstanceOf(File)
+    expect(request[1]!.headers).toEqual({})
+    expect(notificationText()).toContain('photo could not be uploaded')
+    expect(notificationText()).toContain('Stock updated.')
+    await click('Add new stock')
+    expect(container.querySelector('img')).toBeNull()
+  })
+
+  it('removes a photo with a JSON flag and resets a canceled preview', async () => {
+    await click('Edit sample')
+    await click('Remove photo')
+    await click('Save changes')
+    const request = fetchMock.mock.calls.find(([url, options]) => url === '/api/products/stock-id' && options?.method === 'PUT')!
+    expect(JSON.parse(request[1]!.body as string)).toMatchObject({ removeImage: true, updatedAt: product.updatedAt })
+    await click('Add new stock')
+    await selectPhoto()
+    await click('Cancel')
+    await click('Add new stock')
+    expect(container.querySelector('img')).toBeNull()
+  })
+
   it('toasts deletion only after the DELETE succeeds', async () => {
     await click('Delete sample')
     expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Delete Shirt?')
diff --git a/FrontEnd/src/App.tsx b/FrontEnd/src/App.tsx
index 396c234..b8acaa4 100644
--- a/FrontEnd/src/App.tsx
+++ b/FrontEnd/src/App.tsx
@@ -12,12 +12,14 @@ import { PurchaseHistoryPage } from './pages/PurchaseHistoryPage'
 import { SettingsPage } from './pages/SettingsPage'
 import { StockTrackerPage } from './pages/StockTrackerPage'
 import { ToastViewport, useToast } from './components/Toast/ToastProvider'
+import { ProductImage } from './components/ProductImage/ProductImage'
+import { ImageUpload } from './components/ImageUpload/ImageUpload'
 
 const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
 
 type View = 'email' | 'code' | 'signed-in'
 type WorkspaceView = 'dashboard' | 'buy' | 'stock' | 'history' | 'notes' | 'settings' | 'guide' | 'motivation' | 'camellia'
-type Product = { id: string; name: string; category: string; price: string; originalPrice: string | null; stockQuantity: number; active: boolean; archivedAt: string | null; deletedAt: string | null; updatedAt: string }
+type Product = { imageUrl?: string | null; id: string; name: string; category: string; price: string; originalPrice: string | null; stockQuantity: number; active: boolean; archivedAt: string | null; deletedAt: string | null; updatedAt: string }
 const dashboardPointSchema = z.object({ label: z.string(), amount: z.string() })
 const dashboardReportSchema = z.object({ total: z.string(), trend: z.array(z.object({ bucket: z.string(), amount: z.string() })), byProduct: z.array(dashboardPointSchema), byCategory: z.array(dashboardPointSchema) })
 const dashboardSchema = z.object({ currentMonth: dashboardReportSchema.extend({ from: z.string(), to: z.string() }), allTime: dashboardReportSchema, stock: z.object({ totalUnits: z.number().int().nonnegative(), productsCount: z.number().int().nonnegative(), productsInStock: z.number().int().nonnegative(), productsOutOfStock: z.number().int().nonnegative() }), purchases: z.object({ count: z.number().int().nonnegative(), quantity: z.number().int().nonnegative(), totalCost: z.string() }), totalEarnings: z.string(), profit: z.string() })
@@ -41,7 +43,7 @@ async function authApi(path: string, options?: RequestInit): Promise<Response> {
 async function productsApi(path = '', options?: RequestInit): Promise<Response> {
   return fetch(`/api/products${path}`, {
     ...options,
-    headers: { 'Content-Type': 'application/json', ...options?.headers },
+    headers: { ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options?.headers },
     credentials: 'include',
   })
 }
@@ -90,6 +92,8 @@ function App() {
   const [deductInitialStock, setDeductInitialStock] = useState<boolean | null>(null)
   const [initialOriginalPrice, setInitialOriginalPrice] = useState('')
   const [editing, setEditing] = useState<Product | null>(null)
+  const [imageFile, setImageFile] = useState<File | null>(null)
+  const [removeImage, setRemoveImage] = useState(false)
   const [fieldError, setFieldError] = useState('')
   const [dashboard, setDashboard] = useState<Dashboard | null>(null)
   const [dashboardLoading, setDashboardLoading] = useState(false)
@@ -262,6 +266,8 @@ function App() {
   }
 
   function resetProductForm() {
+    setImageFile(null)
+    setRemoveImage(false)
     setEditing(null)
     setProductName('')
     setBulkProductNames('')
@@ -323,21 +329,33 @@ function App() {
     setLoading(true)
     let createdCount = 0
     let deductionPending = false
+    function productBody(input: Record<string, unknown>): string | FormData {
+      if (!imageFile) return JSON.stringify(input)
+      const body = new FormData()
+      for (const [key, value] of Object.entries(input)) if (value !== undefined) body.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
+      body.append('image', imageFile)
+      return body
+    }
+    async function photoWarning(response: Response) {
+      const body = await response.json() as { warning?: string }
+      if (body.warning) toast.error(body.warning)
+    }
     try {
       if (!editing && bulkAddMode) {
-        const response = await productsApi('/bulk', { method: 'POST', body: JSON.stringify({ products: parsedProducts.filter((product): product is { success: true; data: z.infer<typeof productInputSchema> } => product.success).map((product) => ({ ...product.data, ...(deductInitialStock === true ? { originalPrice: initialOriginalPrice } : {}) })) }) })
+        const response = await productsApi('/bulk', { method: 'POST', body: productBody({ products: parsedProducts.filter((product): product is { success: true; data: z.infer<typeof productInputSchema> } => product.success).map((product) => ({ ...product.data, ...(deductInitialStock === true ? { originalPrice: initialOriginalPrice } : {}) })) }) })
         if (!response.ok) {
           const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
           setFieldError(body?.error?.message ?? 'Unable to save the stocks.')
           toast.error(body?.error?.message ?? 'Unable to save the stocks.')
           return
         }
+        await photoWarning(response)
         createdCount = names.length
       } else for (const parsedProduct of parsedProducts) {
         if (!parsedProduct.success) continue
         const response = await productsApi(editing ? `/${editing.id}` : '', {
           method: editing ? 'PUT' : 'POST',
-            body: JSON.stringify(editing ? { name: parsedProduct.data.name, category: parsedProduct.data.category, price: parsedProduct.data.price, updatedAt: editing.updatedAt } : { ...parsedProduct.data, ...(deductInitialStock === true ? { originalPrice: initialOriginalPrice } : {}) }),
+            body: productBody(editing ? { name: parsedProduct.data.name, category: parsedProduct.data.category, price: parsedProduct.data.price, updatedAt: editing.updatedAt, ...(removeImage ? { removeImage: true } : {}) } : { ...parsedProduct.data, ...(deductInitialStock === true ? { originalPrice: initialOriginalPrice } : {}) }),
         })
         if (!response.ok) {
           const body = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined
@@ -351,6 +369,7 @@ function App() {
           else setFieldError(body?.error?.message ?? 'Unable to save the stock.')
           return
         }
+        await photoWarning(response)
         createdCount += 1
       }
       if (!editing && deductInitialStock === true) await loadDashboard()
@@ -392,7 +411,9 @@ function App() {
     setArchiveConfirmationProduct(product)
   }
 
-  function editStock(product: { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }) {
+  function editStock(product: { imageUrl?: string | null; id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }) {
+    setImageFile(null)
+    setRemoveImage(false)
     setWorkspaceView('stock')
     setEditing({ ...product, originalPrice: null, active: true, archivedAt: null, deletedAt: null })
     setProductName(product.name)
@@ -494,6 +515,7 @@ function App() {
                     <button className={styles.modalClose} type="button" aria-label="Close stock dialog" onClick={() => setProductModalOpen(false)}>×</button>
                   </div>
                   <form className={styles.productForm} onSubmit={saveProduct} noValidate>
+                    <ImageUpload file={imageFile} existingUrl={editing?.imageUrl} removed={removeImage} disabled={loading} onChange={(file) => { setImageFile(file); setRemoveImage(false) }} onRemove={() => { setImageFile(null); setRemoveImage(true) }} />
                     <div className={styles.stockNameHeader}>
                       <label htmlFor={bulkAddMode ? 'bulk-stock-names' : 'stock-product-name'}>{bulkAddMode ? 'Stock names' : 'Stock name'}</label>
                       {!editing && <button className={`${styles.multipleStockButton} ${bulkAddMode ? styles.multipleStockButtonActive : ''}`} id="bulk-stock-mode" type="button" aria-pressed={bulkAddMode} onClick={() => { setBulkAddMode((enabled) => !enabled); setFieldError('') }}>{bulkAddMode ? 'Single' : 'Multiple'}</button>}
@@ -562,6 +584,7 @@ function App() {
         <section className={styles.stockErrorModal} data-archive-confirmation role="dialog" aria-modal="true" aria-labelledby="archive-confirmation-heading" aria-describedby="archive-confirmation-message">
           <div className={styles.modalHeader}><span className={styles.stockErrorLabel}>Delete stock</span></div>
           <h3 id="archive-confirmation-heading">Delete {archiveConfirmationProduct.name}?</h3>
+          <ProductImage src={archiveConfirmationProduct.imageUrl} name={archiveConfirmationProduct.name} />
           <p id="archive-confirmation-message">It will be removed from active stock and kept in your archived catalog.</p>
           <div className={styles.formActions}>
             <button ref={archiveCancelRef} aria-label="Cancel archive" className={styles.secondary} type="button" onClick={() => setArchiveConfirmationProduct(null)}>Cancel</button>
diff --git a/FrontEnd/src/pages/DashboardStockTable.tsx b/FrontEnd/src/pages/DashboardStockTable.tsx
index c3aee87..200ab04 100644
--- a/FrontEnd/src/pages/DashboardStockTable.tsx
+++ b/FrontEnd/src/pages/DashboardStockTable.tsx
@@ -3,9 +3,10 @@ import { z } from 'zod'
 import styles from '../App.module.css'
 import { useToast } from '../components/Toast/ToastProvider'
 import { StockStatusChip } from '../components/StockStatus/StockStatusChip'
+import { ProductImage } from '../components/ProductImage/ProductImage'
 
-export type DashboardStockProduct = { id: string; name: string; category: string; price: string; originalPrice: string | null; stockQuantity: number; updatedAt: string }
-const stockResponseSchema = z.object({ products: z.array(z.object({ id: z.uuid(), name: z.string(), category: z.string(), price: z.string(), originalPrice: z.string().nullable(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })
+export type DashboardStockProduct = { imageUrl?: string | null; id: string; name: string; category: string; price: string; originalPrice: string | null; stockQuantity: number; updatedAt: string }
+const stockResponseSchema = z.object({ products: z.array(z.object({ imageUrl: z.string().nullable().optional(), id: z.uuid(), name: z.string(), category: z.string(), price: z.string(), originalPrice: z.string().nullable(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })
 
 type Props = {
   refreshKey?: number
@@ -94,7 +95,7 @@ export function DashboardStockTable({ refreshKey = 0, onEdit, onDelete, onAddSto
           <caption className={styles.visuallyHidden}>Available stock and sales summary</caption>
           <thead><tr><th scope="col">Stock Name</th><th scope="col">Category</th><th scope="col">Stocks</th><th scope="col">Sold</th><th scope="col">Original Price</th><th scope="col">Updated Price</th><th scope="col">Edit</th></tr></thead>
           <tbody>{visibleProducts.map((product) => <tr key={product.id}>
-            <th scope="row"><span className={styles.stockTableName}>{product.name}</span></th>
+            <th scope="row"><ProductImage src={product.imageUrl} name={product.name} /><span className={styles.stockTableName}>{product.name}</span></th>
             <td data-label="Category">{product.category}</td>
             <td data-label="Stocks"><div className={styles.stockQuantityCell}><span>{product.stockQuantity}</span><StockStatusChip quantity={product.stockQuantity} /></div></td>
             <td data-label="Sold">{soldByProduct[product.id] ?? 0}</td>
diff --git a/FrontEnd/src/pages/PurchaseHistoryPage.tsx b/FrontEnd/src/pages/PurchaseHistoryPage.tsx
index ef1d343..a8426eb 100644
--- a/FrontEnd/src/pages/PurchaseHistoryPage.tsx
+++ b/FrontEnd/src/pages/PurchaseHistoryPage.tsx
@@ -2,8 +2,9 @@ import { useEffect, useRef, useState } from 'react'
 import { z } from 'zod'
 import styles from '../App.module.css'
 import { useToast } from '../components/Toast/ToastProvider'
+import { ProductImage } from '../components/ProductImage/ProductImage'
 
-const historySchema = z.object({ purchases: z.array(z.object({ id: z.string().uuid(), productId: z.string().uuid(), productName: z.string(), category: z.string(), quantity: z.number().int().positive(), totalCost: z.string(), purchasedAt: z.string() })) })
+const historySchema = z.object({ purchases: z.array(z.object({ imageUrl: z.string().nullable().optional(), id: z.string().uuid(), productId: z.string().uuid(), productName: z.string(), category: z.string(), quantity: z.number().int().positive(), totalCost: z.string(), purchasedAt: z.string() })) })
 
 type Props = { deletable?: boolean; onChanged?: () => Promise<void>; refreshKey?: number }
 
@@ -129,7 +130,7 @@ export function PurchaseHistoryPage({ deletable = true, onChanged, refreshKey =
         <button className={styles.danger} type="button" disabled={deletingId !== null || selectedIds.size === 0} onClick={() => void removeSelected()}>{deletingId === 'bulk' ? 'Deleting…' : 'Delete selected'}</button>
       </div>}
       <div className={styles.historyScrollArea}>
-        <ul className={styles.productList} aria-label="Purchase history">{visiblePurchases.map((purchase) => <li className={styles.productItem} key={purchase.id}>{deletable && <label className={styles.rowCheckbox}><input type="checkbox" checked={selectedIds.has(purchase.id)} onChange={() => toggleSelected(purchase.id)} aria-label={`Select ${purchase.productName} purchase`} /></label>}<div className={styles.productItemDetails}><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><div className={styles.itemActions}><strong>₱{purchase.totalCost}</strong>{deletable && <button className={styles.danger} type="button" disabled={deletingId !== null} onClick={() => void remove(purchase)}>{deletingId === purchase.id ? 'Deleting…' : 'Delete'}</button>}</div></li>)}</ul>
+        <ul className={styles.productList} aria-label="Purchase history">{visiblePurchases.map((purchase) => <li className={styles.productItem} key={purchase.id}>{deletable && <label className={styles.rowCheckbox}><input type="checkbox" checked={selectedIds.has(purchase.id)} onChange={() => toggleSelected(purchase.id)} aria-label={`Select ${purchase.productName} purchase`} /></label>}<ProductImage src={purchase.imageUrl} name={purchase.productName} /><div className={styles.productItemDetails}><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><div className={styles.itemActions}><strong>₱{purchase.totalCost}</strong>{deletable && <button className={styles.danger} type="button" disabled={deletingId !== null} onClick={() => void remove(purchase)}>{deletingId === purchase.id ? 'Deleting…' : 'Delete'}</button>}</div></li>)}</ul>
       </div>
       <nav className={styles.pagination} aria-label="Purchase history pagination">
         <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
diff --git a/FrontEnd/src/pages/SettingsPage.tsx b/FrontEnd/src/pages/SettingsPage.tsx
index b8048fe..2e842d4 100644
--- a/FrontEnd/src/pages/SettingsPage.tsx
+++ b/FrontEnd/src/pages/SettingsPage.tsx
@@ -3,8 +3,9 @@ import type { CSSProperties, FormEvent } from 'react'
 import styles from '../App.module.css'
 import { useToast } from '../components/Toast/ToastProvider'
 import { PurchaseHistoryPage } from './PurchaseHistoryPage'
+import { ProductImage } from '../components/ProductImage/ProductImage'
 
-type ArchivedProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; archivedAt: string | null; deletedAt: string | null }
+type ArchivedProduct = { imageUrl?: string | null; id: string; name: string; category: string; price: string; stockQuantity: number; archivedAt: string | null; deletedAt: string | null }
 type ColorTheme = 'default' | 'blue' | 'green' | 'purple' | 'orange'
 type SettingsSection = 'archive' | 'history' | 'settings' | 'color-theme'
 type ProfitAdjustment = { id: string; amount: string; note: string | null; createdAt: string; updatedAt: string }
@@ -390,7 +391,7 @@ export function SettingsPage({ onStockDeleted, onHistoryChanged, onProfitChanged
     </nav>
     {section === 'archive' && <section id="archive-panel" className={styles.settingsCard} aria-labelledby="archived-products-heading" role="tabpanel">
       <div><h2 id="archived-products-heading">Archived products</h2><p>Products removed from active stocks remain here with their historical details.</p></div>
-      {archivedProducts.length === 0 ? <p className={styles.empty}>No archived products.</p> : <><div className={styles.selectionToolbar}><label className={styles.selectAllLabel}><input type="checkbox" checked={archivedProducts.length > 0 && selectedArchivedProductIds.size === archivedProducts.length} onChange={toggleAllArchivedProducts} aria-label="Select all archived products" /> <span>Select all archived</span></label><span className={styles.selectionCount} aria-live="polite">{selectedArchivedProductIds.size} selected</span><button className={styles.danger} type="button" disabled={archiveLoading || selectedArchivedProductIds.size === 0} onClick={() => void permanentlyDeleteSelected()}>{archiveLoading ? 'Deleting…' : 'Delete selected permanently'}</button></div><div className={styles.stockTableScroll}><table className={styles.stockTable}><caption className={styles.visuallyHidden}>Archived products and recovery actions</caption><thead><tr><th scope="col" className={styles.selectionColumn}>Select</th><th scope="col">Stock Name</th><th scope="col">Stocks</th><th scope="col">Sold</th><th scope="col">Updated Price</th><th scope="col">Actions</th></tr></thead><tbody>{archivedProducts.map((product) => <tr key={product.id}><td data-label="Select" className={styles.selectionColumn}><input type="checkbox" checked={selectedArchivedProductIds.has(product.id)} onChange={() => toggleArchivedProduct(product.id)} aria-label={`Select archived product ${product.name}`} /></td><th scope="row"><span className={styles.stockTableName}>{product.name}</span><span className={styles.stockTableCategory}>{product.category}</span><span className={styles.archived}>{product.deletedAt ? `Deleted ${new Date(product.deletedAt).toLocaleDateString()}` : `Archived ${product.archivedAt ? new Date(product.archivedAt).toLocaleDateString() : ''}`}</span></th><td data-label="Stocks">{product.stockQuantity}</td><td data-label="Sold">—</td><td data-label="Updated Price">₱{product.price}</td><td data-label="Actions"><div className={styles.stockTableActions}><button className={styles.secondary} type="button" disabled={archiveLoading} onClick={() => void restore(product)}>Restore</button><button className={styles.danger} type="button" disabled={archiveLoading} onClick={() => void permanentlyDelete(product)}>Delete permanently</button></div></td></tr>)}</tbody></table></div></>}
+      {archivedProducts.length === 0 ? <p className={styles.empty}>No archived products.</p> : <><div className={styles.selectionToolbar}><label className={styles.selectAllLabel}><input type="checkbox" checked={archivedProducts.length > 0 && selectedArchivedProductIds.size === archivedProducts.length} onChange={toggleAllArchivedProducts} aria-label="Select all archived products" /> <span>Select all archived</span></label><span className={styles.selectionCount} aria-live="polite">{selectedArchivedProductIds.size} selected</span><button className={styles.danger} type="button" disabled={archiveLoading || selectedArchivedProductIds.size === 0} onClick={() => void permanentlyDeleteSelected()}>{archiveLoading ? 'Deleting…' : 'Delete selected permanently'}</button></div><div className={styles.stockTableScroll}><table className={styles.stockTable}><caption className={styles.visuallyHidden}>Archived products and recovery actions</caption><thead><tr><th scope="col" className={styles.selectionColumn}>Select</th><th scope="col">Stock Name</th><th scope="col">Stocks</th><th scope="col">Sold</th><th scope="col">Updated Price</th><th scope="col">Actions</th></tr></thead><tbody>{archivedProducts.map((product) => <tr key={product.id}><td data-label="Select" className={styles.selectionColumn}><input type="checkbox" checked={selectedArchivedProductIds.has(product.id)} onChange={() => toggleArchivedProduct(product.id)} aria-label={`Select archived product ${product.name}`} /></td><th scope="row"><ProductImage src={product.imageUrl} name={product.name} /><span className={styles.stockTableName}>{product.name}</span><span className={styles.stockTableCategory}>{product.category}</span><span className={styles.archived}>{product.deletedAt ? `Deleted ${new Date(product.deletedAt).toLocaleDateString()}` : `Archived ${product.archivedAt ? new Date(product.archivedAt).toLocaleDateString() : ''}`}</span></th><td data-label="Stocks">{product.stockQuantity}</td><td data-label="Sold">—</td><td data-label="Updated Price">₱{product.price}</td><td data-label="Actions"><div className={styles.stockTableActions}><button className={styles.secondary} type="button" disabled={archiveLoading} onClick={() => void restore(product)}>Restore</button><button className={styles.danger} type="button" disabled={archiveLoading} onClick={() => void permanentlyDelete(product)}>Delete permanently</button></div></td></tr>)}</tbody></table></div></>}
       {stockError && <p className={styles.error} role="alert">{stockError}</p>}
       {stockNotice && <p className={styles.notice} role="status">{stockNotice}</p>}
     </section>}
diff --git a/FrontEnd/src/pages/StockTrackerPage.tsx b/FrontEnd/src/pages/StockTrackerPage.tsx
index d97f0f3..f4ff858 100644
--- a/FrontEnd/src/pages/StockTrackerPage.tsx
+++ b/FrontEnd/src/pages/StockTrackerPage.tsx
@@ -4,13 +4,14 @@ import { z } from 'zod'
 import styles from '../App.module.css'
 import { useToast } from '../components/Toast/ToastProvider'
 import { StockStatusChip } from '../components/StockStatus/StockStatusChip'
+import { ProductImage } from '../components/ProductImage/ProductImage'
 
-export type StockProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }
-type PurchaseRecord = { id: string; productId: string; productName: string; category: string; quantity: number; totalCost: string; purchasedAt: string }
+export type StockProduct = { imageUrl?: string | null; id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }
+type PurchaseRecord = { imageUrl?: string | null; id: string; productId: string; productName: string; category: string; quantity: number; totalCost: string; purchasedAt: string }
 type CartItem = { product: StockProduct; quantity: number }
 
-const stockResponseSchema = z.object({ products: z.array(z.object({ id: z.string().uuid(), name: z.string(), category: z.string(), price: z.string(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })
-const purchaseResponseSchema = z.object({ purchases: z.array(z.object({ id: z.string().uuid(), productId: z.string().uuid(), productName: z.string(), category: z.string(), quantity: z.number().int().positive(), totalCost: z.string(), purchasedAt: z.string() })) })
+const stockResponseSchema = z.object({ products: z.array(z.object({ imageUrl: z.string().nullable().optional(), id: z.string().uuid(), name: z.string(), category: z.string(), price: z.string(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })
+const purchaseResponseSchema = z.object({ purchases: z.array(z.object({ imageUrl: z.string().nullable().optional(), id: z.string().uuid(), productId: z.string().uuid(), productName: z.string(), category: z.string(), quantity: z.number().int().positive(), totalCost: z.string(), purchasedAt: z.string() })) })
 const productIdSchema = z.string().uuid('Select a product.')
 const quantitySchema = z.coerce.number().int('Quantity must be a whole number.').positive('Quantity must be greater than zero.')
 const exactQuantitySchema = z.coerce.number().int('Quantity must be a whole number.').nonnegative('Quantity cannot be negative.')
@@ -275,7 +276,7 @@ export function StockTrackerPage({ mode, onChanged, refreshKey = 0, prefillProdu
           onClick={() => setProductMenuOpen((open) => !open)}
           onKeyDown={handleProductKeyDown}
         >
-          <span>{selectedProduct ? <><strong>{selectedProduct.name}</strong><small className={styles.pickerCategory}>{selectedProduct.category}</small></> : 'Select an active product'}</span>
+          <span>{selectedProduct ? <><ProductImage src={selectedProduct.imageUrl} name={selectedProduct.name} /><strong>{selectedProduct.name}</strong><small className={styles.pickerCategory}>{selectedProduct.category}</small></> : 'Select an active product'}</span>
           {selectedProduct && <span className={styles.pickerMeta}>Stock: {selectedProduct.stockQuantity} · Price: ₱{formatPrice(selectedProduct.price)}</span>}
           <span className={styles.pickerChevron} aria-hidden="true">⌄</span>
         </button>
@@ -294,7 +295,7 @@ export function StockTrackerPage({ mode, onChanged, refreshKey = 0, prefillProdu
           <ul id="stock-product-options" className={styles.productPickerOptions} role="listbox" aria-labelledby="stock-product-label">
           {pickerProducts.length === 0 ? <li className={styles.productPickerEmpty}>No products match “{productSearchQuery}”.</li> : pickerProducts.map((product) => <li key={product.id} role="option" aria-selected={product.id === productId}>
             <button className={styles.productPickerOption} type="button" onClick={() => chooseProduct(product)}>
-              <span><strong>{product.name}</strong><small className={styles.pickerCategory}>{product.category}</small></span>
+              <span><ProductImage src={product.imageUrl} name={product.name} /><strong>{product.name}</strong><small className={styles.pickerCategory}>{product.category}</small></span>
               <span className={styles.pickerMeta}>Stock: {product.stockQuantity} · Price: ₱{formatPrice(product.price)}</span>
             </button>
           </li>)}
@@ -319,6 +320,8 @@ export function StockTrackerPage({ mode, onChanged, refreshKey = 0, prefillProdu
           <span className={styles.stockErrorLabel}>Purchase not completed</span>
         </div>
         <h3 id="insufficient-stock-heading">Not enough stock</h3>
+        {selectedProduct && <ProductImage src={selectedProduct.imageUrl} name={selectedProduct.name} />}
+        {!selectedProduct && cart.map(({ product }) => <ProductImage key={product.id} src={product.imageUrl} name={product.name} />)}
         <p id="insufficient-stock-message">Review your available stock before trying again. Your entries were preserved.</p>
         <div className={styles.formActions}>
           <button autoFocus type="button" onClick={() => setInsufficientStockOpen(false)}>Okay</button>
@@ -330,6 +333,7 @@ export function StockTrackerPage({ mode, onChanged, refreshKey = 0, prefillProdu
       <section className={styles.stockErrorModal} role="dialog" aria-modal="true" aria-labelledby="quantity-deduction-heading">
         <div className={styles.modalHeader}><span className={styles.stockErrorLabel}>Quantity increased</span></div>
         <h3 id="quantity-deduction-heading">Deduct from Total Profit?</h3>
+        {selectedProduct && <ProductImage src={selectedProduct.imageUrl} name={selectedProduct.name} />}
         <p>The quantity increased by {(pendingQuantity ?? 0) - (selectedProduct?.stockQuantity ?? 0)}. Deduct the cost of the additional stock from total profit?</p>
         <div className={styles.deductionChoice}><span>Deduct from Total Profit?</span><label className={styles.checkboxLabel} htmlFor="quantity-deduction-yes"><input id="quantity-deduction-yes" name="quantity-deduction" type="radio" checked={quantityDeductionChoice === true} onChange={() => { setQuantityDeductionChoice(true); setFieldError('') }} /> Yes</label><label className={styles.checkboxLabel} htmlFor="quantity-deduction-no"><input id="quantity-deduction-no" name="quantity-deduction" type="radio" checked={quantityDeductionChoice === false} onChange={() => { setQuantityDeductionChoice(false); setQuantityOriginalPrice(''); setFieldError('') }} /> No</label></div>
         {quantityDeductionChoice === true && <><label htmlFor="quantity-original-price">Original price</label><input id="quantity-original-price" inputMode="decimal" placeholder="0.00" value={quantityOriginalPrice} onChange={(event) => { setQuantityOriginalPrice(event.target.value); setFieldError('') }} />{fieldError && <p className={styles.error} role="alert">{fieldError}</p>}</>}
@@ -344,13 +348,13 @@ export function StockTrackerPage({ mode, onChanged, refreshKey = 0, prefillProdu
     {mode === 'buy' ? <>
       {cart.length > 0 && <section className={styles.cart} aria-labelledby="cart-heading">
         <div className={styles.cartHeader}><div><h3 id="cart-heading">Cart</h3><p>{cart.length} product{cart.length === 1 ? '' : 's'} ready for checkout.</p></div><strong>₱{cart.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0).toFixed(2)}</strong></div>
-        <ul className={styles.cartList}>{cart.map((item) => <li className={styles.cartItem} key={item.product.id}><div><strong>{item.product.name}</strong><span>{item.product.category} · ₱{formatPrice(item.product.price)} each</span></div><div className={styles.cartItemControls}><label htmlFor={`cart-quantity-${item.product.id}`}>Qty</label><input id={`cart-quantity-${item.product.id}`} type="number" min="1" max={item.product.stockQuantity} value={item.quantity} onChange={(event) => { const nextQuantity = Number(event.target.value); if (Number.isInteger(nextQuantity) && nextQuantity > 0) setCart((current) => current.map((cartItem) => cartItem.product.id === item.product.id ? { ...cartItem, quantity: nextQuantity } : cartItem)) }} /><button className={styles.secondary} type="button" onClick={() => setCart((current) => current.filter((cartItem) => cartItem.product.id !== item.product.id))}>Remove</button></div></li>)}</ul>
+        <ul className={styles.cartList}>{cart.map((item) => <li className={styles.cartItem} key={item.product.id}><div><ProductImage src={item.product.imageUrl} name={item.product.name} /><strong>{item.product.name}</strong><span>{item.product.category} · ₱{formatPrice(item.product.price)} each</span></div><div className={styles.cartItemControls}><label htmlFor={`cart-quantity-${item.product.id}`}>Qty</label><input id={`cart-quantity-${item.product.id}`} type="number" min="1" max={item.product.stockQuantity} value={item.quantity} onChange={(event) => { const nextQuantity = Number(event.target.value); if (Number.isInteger(nextQuantity) && nextQuantity > 0) setCart((current) => current.map((cartItem) => cartItem.product.id === item.product.id ? { ...cartItem, quantity: nextQuantity } : cartItem)) }} /><button className={styles.secondary} type="button" onClick={() => setCart((current) => current.filter((cartItem) => cartItem.product.id !== item.product.id))}>Remove</button></div></li>)}</ul>
         <button type="button" disabled={checkoutLoading} onClick={() => void checkout()}>{checkoutLoading ? 'Checking out…' : 'Checkout'}</button>
       </section>}
       <div className={styles.stockSearch}><label className={styles.searchLabel} htmlFor="bought-product-search">Search Product</label><input id="bought-product-search" type="search" value={searchQuery} placeholder="Type a product name" onChange={(event) => { setSearchQuery(event.target.value); setPurchasePage(1) }} /></div>
       {purchaseLoading ? <p role="status">Loading bought history…</p> : purchases.length === 0 ? <p className={styles.empty}>No bought products recorded yet.</p> : filteredPurchases.length === 0 ? <p className={styles.empty}>No bought products match “{searchQuery}”.</p> : <>
         <div className={styles.historyScrollArea}>
-          <ul className={styles.productList} aria-label="Bought product history">{visiblePurchases.map((purchase) => <li className={styles.productItem} key={purchase.id}><div><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><strong>₱{purchase.totalCost}</strong></li>)}</ul>
+          <ul className={styles.productList} aria-label="Bought product history">{visiblePurchases.map((purchase) => <li className={styles.productItem} key={purchase.id}><div><ProductImage src={purchase.imageUrl} name={purchase.productName} /><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><strong>₱{purchase.totalCost}</strong></li>)}</ul>
         </div>
         <div className={styles.dashboardTablePagination}>
           <div className={styles.historyToolbar}>
@@ -370,7 +374,7 @@ export function StockTrackerPage({ mode, onChanged, refreshKey = 0, prefillProdu
     </> : loading && products.length === 0 ? <p role="status">Loading stock…</p> : products.length === 0 ? <p className={styles.empty}>No active products are available. Add a product first.</p> : <>
       <div className={styles.stockSearch}><label className={styles.searchLabel} htmlFor="stock-product-search">Search Product</label><input id="stock-product-search" type="search" value={searchQuery} placeholder="Type a product name" onChange={(event) => { setSearchQuery(event.target.value); setStockPage(1) }} /></div>
       {filteredProducts.length === 0 ? <p className={styles.empty}>No products match “{searchQuery}”.</p> : <><div className={styles.stockListScroll}>
-        <ul className={styles.productList} aria-label="Available stock">{visibleProducts.map((product) => <li className={styles.productItem} key={product.id}><div><strong>{product.name}</strong><span>{product.category}</span></div><div className={styles.stockProductDetails}><div className={styles.stockMeta}><span>Stock: {product.stockQuantity}</span><StockStatusChip quantity={product.stockQuantity} /><span>Price: ₱{formatPrice(product.price)}</span></div>{onEdit && onDelete && <div className={styles.itemActions}><button className={styles.secondary} type="button" onClick={() => onEdit(product)}>Edit</button><button className={styles.danger} type="button" onClick={() => onDelete(product)}>Delete</button></div>}</div></li>)}</ul>
+        <ul className={styles.productList} aria-label="Available stock">{visibleProducts.map((product) => <li className={styles.productItem} key={product.id}><div><ProductImage src={product.imageUrl} name={product.name} /><strong>{product.name}</strong><span>{product.category}</span></div><div className={styles.stockProductDetails}><div className={styles.stockMeta}><span>Stock: {product.stockQuantity}</span><StockStatusChip quantity={product.stockQuantity} /><span>Price: ₱{formatPrice(product.price)}</span></div>{onEdit && onDelete && <div className={styles.itemActions}><button className={styles.secondary} type="button" onClick={() => onEdit(product)}>Edit</button><button className={styles.danger} type="button" onClick={() => onDelete(product)}>Delete</button></div>}</div></li>)}</ul>
       </div>
       <div className={styles.dashboardTablePagination}>
         <div className={styles.historyToolbar}>
diff --git a/README.md b/README.md
index 017f090..2c3e286 100644
--- a/README.md
+++ b/README.md
@@ -1,5 +1,17 @@
 # Sales Tracker verification
 
+## Product photos and database rollout
+
+Product photos are optional. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` using your deployment secret manager (placeholders are in `.env.example`). Keep the API secret on the server; never use frontend/Vite variables. Missing configuration does not block startup or JSON-only saves, but photo upload requests receive 503.
+
+For a local development database, apply the checked-in migration with `npm run db:migrate`, then run `npm run db:generate`. For production, back up the database, run `npm run db:deploy` in your release process, generate the client with `npm run db:generate`, and build/restart with the updated application. Apply the migration before serving updated code. These commands mutate the selected database and must be run intentionally by the operator; automated feature verification does not run them.
+
+Uploads accept one JPEG, PNG, or WebP up to 3 MB, validate decoded bytes, and use Cloudinary folder `asimon/products` with automatic format/quality. Bulk saves use a shared selected photo but upload independently owned assets per product. Invalid files do not save details; configured remote upload failures save details, retain an existing photo, and return a visible warning.
+
+Purchases capture immutable photo URLs and internal asset IDs alongside existing name/category snapshots. The migration backfills only purchases whose product and tenant match. Removing/replacing a product photo does not alter history. Archive/restore and the 10-day recoverable delete preserve photo references. Permanent deletion, history deletion, replacement, failed saves, and retention purge perform best-effort cleanup after persistence: an asset is destroyed only when neither products nor purchases reference it, including archived/soft-deleted rows across all tenants. Cleanup failures are logged and do not reverse successful actions. Logs should be monitored for failed cleanup; there is no durable automatic orphan retry queue.
+
+The production image CSP permits only self/data/blob and `https://res.cloudinary.com`. Notification HTML includes escaped, trusted Cloudinary images; readable product details remain in HTML and plain text if images cannot load.
+
 ## Deterministic verification
 
 The default suite uses Vitest and mocked persistence, so it does not require PostgreSQL or Mailpit:
diff --git a/package-lock.json b/package-lock.json
index 2285e42..5a44f80 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -10,17 +10,21 @@
       "dependencies": {
         "@prisma/client": "6.19.3",
         "@types/cors": "^2.8.19",
+        "cloudinary": "^2.11.0",
         "cookie-parser": "1.4.7",
         "cors": "^2.8.6",
         "dotenv": "16.6.1",
         "express": "5.2.1",
         "helmet": "^8.3.0",
+        "multer": "^2.5.0",
         "nodemailer": "10.0.13",
+        "sharp": "^0.35.5",
         "zod": "4.6.5"
       },
       "devDependencies": {
         "@types/cookie-parser": "1.4.10",
         "@types/express": "5.0.5",
+        "@types/multer": "^2.3.0",
         "@types/node": "^24.13.3",
         "@types/nodemailer": "7.0.4",
         "concurrently": "9.2.1",
@@ -527,6 +531,16 @@
         "node": ">=20.19.0"
       }
     },
+    "node_modules/@emnapi/runtime": {
+      "version": "1.11.3",
+      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.3.tgz",
+      "integrity": "sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==",
+      "license": "MIT",
+      "optional": true,
+      "dependencies": {
+        "tslib": "^2.4.0"
+      }
+    },
     "node_modules/@esbuild/aix-ppc64": {
       "version": "0.25.12",
       "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.25.12.tgz",
@@ -987,6 +1001,554 @@
         }
       }
     },
+    "node_modules/@img/colour": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@img/colour/-/colour-1.1.0.tgz",
+      "integrity": "sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@img/sharp-darwin-arm64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.5.tgz",
+      "integrity": "sha512-QRUlFQ0WxvdWyqqG/WtI3iupfD5rBzmCHXSdPsY91sAtVtTo7Q4cb6zOccZ3gqEqkr0f1As1ehLqmEpDsRf+lg==",
+      "cpu": [
+        "arm64"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-darwin-arm64": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-darwin-x64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.5.tgz",
+      "integrity": "sha512-+BR255RhDlpygUpOc/Jdt1nT6DQ3XG/ERo5wbcdOf5Q320dKtPCKPLR1LJs9VGXRaMa8l1uUa0tkCNOXiAxZUw==",
+      "cpu": [
+        "x64"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-darwin-x64": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-freebsd-wasm32": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.5.tgz",
+      "integrity": "sha512-Y/z91nEZ4uIBX5X3nfTovjU9lHNKFYbL2lpHCLVNmXQK03VIZvXBBt0KxbPGp2SdGSF+2mQU4e+hQaWOt86iAw==",
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "freebsd"
+      ],
+      "dependencies": {
+        "@img/sharp-wasm32": "0.35.5"
+      },
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-darwin-arm64": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.4.tgz",
+      "integrity": "sha512-5R89nBYiRdUlSWJxPhO+GVtaXzXSxKnRu/xqMn3KTA3L9EB9Oy/P+Nn2f2vlhPuUdy/Zusb2DarbyTpGCfEDuw==",
+      "cpu": [
+        "arm64"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-darwin-x64": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.3.4.tgz",
+      "integrity": "sha512-iR2OKH80yi0U+dUplyh3/xdpFvps6YkCwsXenIJxqxR1v9o+xtKTGbS9H7cps+2Vxjc8B1j96p75NmTGjIhtpQ==",
+      "cpu": [
+        "x64"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-linux-arm": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm/-/sharp-libvips-linux-arm-1.3.4.tgz",
+      "integrity": "sha512-LmRtTsOHuvM2+wlO2Db37dx5MiZhB0FvSunciw48YjdOkZz9KAiRbm8ujeMOA1INqmei5NapFxYEK1D1ZSidmw==",
+      "cpu": [
+        "arm"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-linux-arm64": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.3.4.tgz",
+      "integrity": "sha512-Y3dgX/6lE2QhQb+Gxy0WZxfg9MEm/JBjamZpS2IklP7xIQoKN4hzAm7KcMVGtaVDt3neE9OKBC7vAfonA/Lr1A==",
+      "cpu": [
+        "arm64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-linux-ppc64": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-ppc64/-/sharp-libvips-linux-ppc64-1.3.4.tgz",
+      "integrity": "sha512-Le6boB8Tai0Nis+gIxIpKx68UDVVIqdR8Tin5Yf1z2LJJQLDJvCDRqRu+jC2qCoD+eIomonmOwB4smBRxfVpYQ==",
+      "cpu": [
+        "ppc64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-linux-riscv64": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-riscv64/-/sharp-libvips-linux-riscv64-1.3.4.tgz",
+      "integrity": "sha512-aHkkIEHPRdQEegJN20MLmGtxYD9R2wQr3Cwpddnu5+YKMt6Uzax7S9h5gpZTo8wyrGuZSlfQ63OevL5mTyOC7Q==",
+      "cpu": [
+        "riscv64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-linux-s390x": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-s390x/-/sharp-libvips-linux-s390x-1.3.4.tgz",
+      "integrity": "sha512-ra/mB6MikESDUO7Yg+Mi95bFBb9GsObURuhnOv3OqknjGe9sZrG8tCe9q0xSIGrtLgvgw0gKnFWcK4blSgQOuQ==",
+      "cpu": [
+        "s390x"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-linux-x64": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-x64/-/sharp-libvips-linux-x64-1.3.4.tgz",
+      "integrity": "sha512-GJ//SSXbnwSDes02umB3nDJLFcQzw8a18V8fyhqr6tV515tOEMdImjjxj1AoafMRz56F3PHgftnj1QEKSU1zkw==",
+      "cpu": [
+        "x64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-linuxmusl-arm64": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-arm64/-/sharp-libvips-linuxmusl-arm64-1.3.4.tgz",
+      "integrity": "sha512-hvulFwtjUcagsis6BBxHwGFwWoNZjgYmULGVrZcyfNbjA8hKILbRxGg15/7w5HDyXHXUos/j6baAWqnCyQ2DWA==",
+      "cpu": [
+        "arm64"
+      ],
+      "libc": [
+        "musl"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-libvips-linuxmusl-x64": {
+      "version": "1.3.4",
+      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-x64/-/sharp-libvips-linuxmusl-x64-1.3.4.tgz",
+      "integrity": "sha512-6zXKeE/p39I1AmA3cJG35eyBGNqNddLnUXjhwBnsGjFPWqf5VKkDBEqaEkPDoTEtkxwi2vv8Tcr2mDyP4So7Fg==",
+      "cpu": [
+        "x64"
+      ],
+      "libc": [
+        "musl"
+      ],
+      "license": "LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-linux-arm": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm/-/sharp-linux-arm-0.35.5.tgz",
+      "integrity": "sha512-LEaXK2WdXVK5ykcw0buWyPMsmLLL2vpHLD6yrNSW+JGEL3BZPA4tpKN6iaMc4AxTTAoaX/sU1rOL51lcIz48ZQ==",
+      "cpu": [
+        "arm"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-linux-arm": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-linux-arm64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm64/-/sharp-linux-arm64-0.35.5.tgz",
+      "integrity": "sha512-LYVx5JTsOM2CBzmxreh+nl64/3H6Xb09iSLknqH47z2T2DFFxDeFLP5y4dJwe6H7uGQlHPyEEtIqyo3DYsRwdQ==",
+      "cpu": [
+        "arm64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-linux-arm64": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-linux-ppc64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-linux-ppc64/-/sharp-linux-ppc64-0.35.5.tgz",
+      "integrity": "sha512-QVxAAq8evVRI9ia2vqgwrmWucn5Dfv+JdWzj75pD8omHLPSP7f8p20O8jxzjCcuCEQEOtYOZUmX1hkiZ0kdevA==",
+      "cpu": [
+        "ppc64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-linux-ppc64": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-linux-riscv64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-linux-riscv64/-/sharp-linux-riscv64-0.35.5.tgz",
+      "integrity": "sha512-LtdreXguaavKODPIfzJ4kffx7UNt1omwtK0rch4EBbbSTXPnxWmYSayXdLJw0fJzQ97kHt1gL/yh4tvU+nCyRQ==",
+      "cpu": [
+        "riscv64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-linux-riscv64": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-linux-s390x": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-linux-s390x/-/sharp-linux-s390x-0.35.5.tgz",
+      "integrity": "sha512-UZasTOFiYzotTsGOCu42BfUzP6Tu6Do/947iRm1RsLKvlllxwGcn4RN27LibGWceix4Y+Pmw3jsnTcCQIgWjqA==",
+      "cpu": [
+        "s390x"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-linux-s390x": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-linux-x64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-0.35.5.tgz",
+      "integrity": "sha512-SxFtLTeJInhAA9Q836kux2vZNeOBQEx658qvbboZScr0wIARym3IcGmW7KpVD5sbVg0Ojy+udFQdayYIZyoNog==",
+      "cpu": [
+        "x64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-linux-x64": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-linuxmusl-arm64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-arm64/-/sharp-linuxmusl-arm64-0.35.5.tgz",
+      "integrity": "sha512-9HbMclmI1zlNkFRs3z9/eBtDjfD0sGlrX1z6b1qwmiFY5ElDLh4BC0LPBdVp7z1DXFiKlIcznf+ZlsuZzLxQqg==",
+      "cpu": [
+        "arm64"
+      ],
+      "libc": [
+        "musl"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-linuxmusl-arm64": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-linuxmusl-x64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-x64/-/sharp-linuxmusl-x64-0.35.5.tgz",
+      "integrity": "sha512-4KOphqB035HrVdqLZfCgMzzERrQkkzOwRhl4OAkRO1YCldbaFjySXMaK534Mo0V+LndnlJk+sbUyLeU0ULyD1A==",
+      "cpu": [
+        "x64"
+      ],
+      "libc": [
+        "musl"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-libvips-linuxmusl-x64": "1.3.4"
+      }
+    },
+    "node_modules/@img/sharp-wasm32": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-wasm32/-/sharp-wasm32-0.35.5.tgz",
+      "integrity": "sha512-Ptsga1su4tQx+LLF1ECS9U6nz5kmrXKo6XVbtR48Ke3ZRxxgaWBu7IDtEe1quo8hiupwm6WFqxVlXaSf7IINGQ==",
+      "license": "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
+      "optional": true,
+      "dependencies": {
+        "@emnapi/runtime": "^1.11.3"
+      },
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-webcontainers-wasm32": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-webcontainers-wasm32/-/sharp-webcontainers-wasm32-0.35.5.tgz",
+      "integrity": "sha512-hfhF/FmoQyTUkA0bIKFOtw536BQSeBMe6BF6QyWlrPxT754+TFLaZ7sKKTfvvM0yJgKgaYTwnFCIZ/GuDw5SUA==",
+      "cpu": [
+        "wasm32"
+      ],
+      "license": "Apache-2.0",
+      "optional": true,
+      "dependencies": {
+        "@img/sharp-wasm32": "0.35.5"
+      },
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-win32-arm64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-win32-arm64/-/sharp-win32-arm64-0.35.5.tgz",
+      "integrity": "sha512-X4t7g+7ZA5DKblCBEXGjUqqemj4vczING/5viFwAL8h4N3qYeyjwdCvRLHi4EdOUI+2Z7UFlp1VM+p/AuEtm6Q==",
+      "cpu": [
+        "arm64"
+      ],
+      "license": "Apache-2.0 AND LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "win32"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-win32-ia32": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-win32-ia32/-/sharp-win32-ia32-0.35.5.tgz",
+      "integrity": "sha512-5Zm82LoBc43nhwNybZlG7Y1KO//Zhsn306fQl29ZOuStHLGTo3BWL83q3cznX0poxSAMuYL1On/BHBxkBeKr6A==",
+      "cpu": [
+        "ia32"
+      ],
+      "license": "Apache-2.0 AND LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "win32"
+      ],
+      "engines": {
+        "node": "^20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
+    "node_modules/@img/sharp-win32-x64": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/@img/sharp-win32-x64/-/sharp-win32-x64-0.35.5.tgz",
+      "integrity": "sha512-x76eH0vEiHlcMQu8Y8IenntaACtddpT6W0wmXtWrnKcnKI7ME5DdgqhAD6SEWOEl1v2zDvkZDhFA9KnURwpfqg==",
+      "cpu": [
+        "x64"
+      ],
+      "license": "Apache-2.0 AND LGPL-3.0-or-later",
+      "optional": true,
+      "os": [
+        "win32"
+      ],
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      }
+    },
     "node_modules/@jridgewell/sourcemap-codec": {
       "version": "1.6.0",
       "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.6.0.tgz",
@@ -1686,6 +2248,16 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/@types/multer": {
+      "version": "2.3.0",
+      "resolved": "https://registry.npmjs.org/@types/multer/-/multer-2.3.0.tgz",
+      "integrity": "sha512-i7STIm9V4K2MPH4ZYMtrZAwNxs3kglk2LgleaTuB9pUXgADBcQYQuYMd7+6xgTIxfoggIkFA/DkkvycdZpIARA==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@types/express": "*"
+      }
+    },
     "node_modules/@types/node": {
       "version": "24.13.3",
       "resolved": "https://registry.npmjs.org/@types/node/-/node-24.13.3.tgz",
@@ -2223,6 +2795,12 @@
         "url": "https://github.com/chalk/ansi-styles?sponsor=1"
       }
     },
+    "node_modules/append-field": {
+      "version": "1.0.0",
+      "resolved": "https://registry.npmjs.org/append-field/-/append-field-1.0.0.tgz",
+      "integrity": "sha512-klpgFSWLW1ZEs8svjfb7g4qWY0YS5imI82dTg+QahUvJ8YqAY0P10Uk8tTyh9ZGuYEZEMaeJYCF5BFuX552hsw==",
+      "license": "MIT"
+    },
     "node_modules/assertion-error": {
       "version": "2.0.1",
       "resolved": "https://registry.npmjs.org/assertion-error/-/assertion-error-2.0.1.tgz",
@@ -2287,6 +2865,17 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/busboy": {
+      "version": "1.6.0",
+      "resolved": "https://registry.npmjs.org/busboy/-/busboy-1.6.0.tgz",
+      "integrity": "sha512-8SFQbg/0hQ9xy3UNTB0YEnsNBbWfhf7RtnzpL7TkBiTBRfrQ9Fxcnz7VJsleJpyp6rVLvXiuORqjlHi5q+PYuA==",
+      "dependencies": {
+        "streamsearch": "^1.1.0"
+      },
+      "engines": {
+        "node": ">=10.16.0"
+      }
+    },
     "node_modules/bytes": {
       "version": "3.1.2",
       "resolved": "https://registry.npmjs.org/bytes/-/bytes-3.1.2.tgz",
@@ -2435,6 +3024,18 @@
         "node": ">=12"
       }
     },
+    "node_modules/cloudinary": {
+      "version": "2.11.0",
+      "resolved": "https://registry.npmjs.org/cloudinary/-/cloudinary-2.11.0.tgz",
+      "integrity": "sha512-o2pAkDDqrzPFE/mn9GCfFjBIGQmPs++Ts6rtkFl4vY528DNHiMovKWjH16HBjeGa9iwI7eAad24aWN2emT0aww==",
+      "license": "MIT",
+      "dependencies": {
+        "lodash": "^4.17.23"
+      },
+      "engines": {
+        "node": ">=9"
+      }
+    },
     "node_modules/color-convert": {
       "version": "2.0.1",
       "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
@@ -2649,6 +3250,15 @@
       "devOptional": true,
       "license": "MIT"
     },
+    "node_modules/detect-libc": {
+      "version": "2.1.2",
+      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
+      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
+      "license": "Apache-2.0",
+      "engines": {
+        "node": ">=8"
+      }
+    },
     "node_modules/dotenv": {
       "version": "16.6.1",
       "resolved": "https://registry.npmjs.org/dotenv/-/dotenv-16.6.1.tgz",
@@ -3292,6 +3902,12 @@
         }
       }
     },
+    "node_modules/lodash": {
+      "version": "4.18.1",
+      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.18.1.tgz",
+      "integrity": "sha512-dMInicTPVE8d1e5otfwmmjlxkZoUpiVLwyeTdUsi/Caj/gfzzblBcCE5sRHV/AsjuCmxWrte2TNGSYuCeCq+0Q==",
+      "license": "MIT"
+    },
     "node_modules/lru-cache": {
       "version": "11.5.3",
       "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-11.5.3.tgz",
@@ -3384,6 +4000,67 @@
       "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
       "license": "MIT"
     },
+    "node_modules/multer": {
+      "version": "2.5.0",
+      "resolved": "https://registry.npmjs.org/multer/-/multer-2.5.0.tgz",
+      "integrity": "sha512-BsqOzYGVq49JcW2IzoSAxeKYRevb+dGGPPWleOR8Lrlk4igwxu1/9pwSXlByhCb7MVZDrNJFC0IBP5/O5nLYRw==",
+      "license": "MIT",
+      "dependencies": {
+        "append-field": "^1.0.0",
+        "busboy": "^1.6.0",
+        "type-is": "^1.6.18"
+      },
+      "engines": {
+        "node": ">= 10.16.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/express"
+      }
+    },
+    "node_modules/multer/node_modules/media-typer": {
+      "version": "0.3.0",
+      "resolved": "https://registry.npmjs.org/media-typer/-/media-typer-0.3.0.tgz",
+      "integrity": "sha512-dq+qelQ9akHpcOl/gUVRTxVIOkAJ1wR3QAvb4RsVjS8oVoFjDGTc679wJYmUmknUF5HwMLOgb5O+a3KxfWapPQ==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 0.6"
+      }
+    },
+    "node_modules/multer/node_modules/mime-db": {
+      "version": "1.52.0",
+      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
+      "integrity": "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 0.6"
+      }
+    },
+    "node_modules/multer/node_modules/mime-types": {
+      "version": "2.1.35",
+      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz",
+      "integrity": "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==",
+      "license": "MIT",
+      "dependencies": {
+        "mime-db": "1.52.0"
+      },
+      "engines": {
+        "node": ">= 0.6"
+      }
+    },
+    "node_modules/multer/node_modules/type-is": {
+      "version": "1.6.18",
+      "resolved": "https://registry.npmjs.org/type-is/-/type-is-1.6.18.tgz",
+      "integrity": "sha512-TkRKr9sUTxEH8MdfuCSP7VizJyzRNMjj2J2do2Jr3Kym598JVdEksuzPQCnlFPW4ky9Q+iA+ma9BGm06XQBy8g==",
+      "license": "MIT",
+      "dependencies": {
+        "media-typer": "0.3.0",
+        "mime-types": "~2.1.24"
+      },
+      "engines": {
+        "node": ">= 0.6"
+      }
+    },
     "node_modules/nanoid": {
       "version": "3.3.19",
       "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.19.tgz",
@@ -3910,6 +4587,18 @@
         "node": ">=v12.22.7"
       }
     },
+    "node_modules/semver": {
+      "version": "7.8.6",
+      "resolved": "https://registry.npmjs.org/semver/-/semver-7.8.6.tgz",
+      "integrity": "sha512-9lpSSU4Mly3mrtruwLs1eLK6+gzbzqeBFwRNjIjE+9LuDpWdYctrQlQ3ej1Ilgi7gknpsTRnPoLP8DpCHqHIJw==",
+      "license": "ISC",
+      "bin": {
+        "semver": "bin/semver.js"
+      },
+      "engines": {
+        "node": ">=10"
+      }
+    },
     "node_modules/send": {
       "version": "1.2.1",
       "resolved": "https://registry.npmjs.org/send/-/send-1.2.1.tgz",
@@ -3961,6 +4650,55 @@
       "integrity": "sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==",
       "license": "ISC"
     },
+    "node_modules/sharp": {
+      "version": "0.35.5",
+      "resolved": "https://registry.npmjs.org/sharp/-/sharp-0.35.5.tgz",
+      "integrity": "sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "@img/colour": "^1.1.0",
+        "detect-libc": "^2.1.2",
+        "semver": "^7.8.5"
+      },
+      "engines": {
+        "node": ">=20.9.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/libvips"
+      },
+      "optionalDependencies": {
+        "@img/sharp-darwin-arm64": "0.35.5",
+        "@img/sharp-darwin-x64": "0.35.5",
+        "@img/sharp-freebsd-wasm32": "0.35.5",
+        "@img/sharp-libvips-darwin-arm64": "1.3.4",
+        "@img/sharp-libvips-darwin-x64": "1.3.4",
+        "@img/sharp-libvips-linux-arm": "1.3.4",
+        "@img/sharp-libvips-linux-arm64": "1.3.4",
+        "@img/sharp-libvips-linux-ppc64": "1.3.4",
+        "@img/sharp-libvips-linux-riscv64": "1.3.4",
+        "@img/sharp-libvips-linux-s390x": "1.3.4",
+        "@img/sharp-libvips-linux-x64": "1.3.4",
+        "@img/sharp-libvips-linuxmusl-arm64": "1.3.4",
+        "@img/sharp-libvips-linuxmusl-x64": "1.3.4",
+        "@img/sharp-linux-arm": "0.35.5",
+        "@img/sharp-linux-arm64": "0.35.5",
+        "@img/sharp-linux-ppc64": "0.35.5",
+        "@img/sharp-linux-riscv64": "0.35.5",
+        "@img/sharp-linux-s390x": "0.35.5",
+        "@img/sharp-linux-x64": "0.35.5",
+        "@img/sharp-linuxmusl-arm64": "0.35.5",
+        "@img/sharp-linuxmusl-x64": "0.35.5",
+        "@img/sharp-webcontainers-wasm32": "0.35.5",
+        "@img/sharp-win32-arm64": "0.35.5",
+        "@img/sharp-win32-ia32": "0.35.5",
+        "@img/sharp-win32-x64": "0.35.5"
+      },
+      "peerDependenciesMeta": {
+        "@types/node": {
+          "optional": true
+        }
+      }
+    },
     "node_modules/shell-quote": {
       "version": "1.8.3",
       "resolved": "https://registry.npmjs.org/shell-quote/-/shell-quote-1.8.3.tgz",
@@ -4086,6 +4824,14 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/streamsearch": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/streamsearch/-/streamsearch-1.1.0.tgz",
+      "integrity": "sha512-Mcc5wHehp9aXz1ax6bZUyY5afg9u2rv5cqQI3mRrYkGC8rW2hM02jWuwjtL++LS5qinSyhj2QfLyNsuc+VsExg==",
+      "engines": {
+        "node": ">=10.0.0"
+      }
+    },
     "node_modules/string-width": {
       "version": "4.2.3",
       "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
@@ -4250,7 +4996,7 @@
       "version": "2.8.1",
       "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
       "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
-      "dev": true,
+      "devOptional": true,
       "license": "0BSD"
     },
     "node_modules/tsx": {
diff --git a/package.json b/package.json
index 63cb66d..8e0b540 100644
--- a/package.json
+++ b/package.json
@@ -21,17 +21,21 @@
   "dependencies": {
     "@prisma/client": "6.19.3",
     "@types/cors": "^2.8.19",
+    "cloudinary": "^2.11.0",
     "cookie-parser": "1.4.7",
     "cors": "^2.8.6",
     "dotenv": "16.6.1",
     "express": "5.2.1",
     "helmet": "^8.3.0",
+    "multer": "^2.5.0",
     "nodemailer": "10.0.13",
+    "sharp": "^0.35.5",
     "zod": "4.6.5"
   },
   "devDependencies": {
     "@types/cookie-parser": "1.4.10",
     "@types/express": "5.0.5",
+    "@types/multer": "^2.3.0",
     "@types/node": "^24.13.3",
     "@types/nodemailer": "7.0.4",
     "concurrently": "9.2.1",
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index e7825f0..238c18d 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -38,6 +38,8 @@ model NotificationSettings {
 }
 
 model Product {
+  imageUrl String? @map("image_url")
+  imagePublicId String? @map("image_public_id")
   id         String    @id @default(uuid()) @db.Uuid
   userId     String    @map("user_id") @db.Uuid
   name       String    @db.VarChar(200)
@@ -61,6 +63,7 @@ model Product {
   @@index([userId, updatedAt])
   @@index([userId, deletedAt])
   @@map("products")
+  @@index([imagePublicId])
 }
 
 model AllowedEmail {
@@ -159,6 +162,8 @@ model Note {
 }
 
 model StockPurchase {
+  imageUrl String? @map("image_url")
+  imagePublicId String? @map("image_public_id")
   id                   String   @id @default(uuid()) @db.Uuid
   userId               String   @map("user_id") @db.Uuid
   productId            String   @map("product_id") @db.Uuid
@@ -175,4 +180,5 @@ model StockPurchase {
   @@index([userId, productId, purchasedAt])
   @@index([userId, deletedAt])
   @@map("stock_purchases")
+  @@index([imagePublicId])
 }
diff --git a/server/app.test.ts b/server/app.test.ts
index 7a92e80..0611e21 100644
--- a/server/app.test.ts
+++ b/server/app.test.ts
@@ -1,8 +1,30 @@
 import { describe, expect, it, vi } from 'vitest'
 import { app } from './app.js'
 import { dashboardRouter } from './modules/dashboard/routes.js'
+import { ImageError } from './infrastructure/images.js'
 
 describe('application routes', () => {
+  it('allows only the targeted Cloudinary external image origin in CSP', async () => {
+    const server = app.listen(0, '127.0.0.1')
+    await new Promise<void>((resolve) => server.once('listening', resolve))
+    try {
+      const { port } = server.address() as { port: number }
+      const response = await fetch(`http://127.0.0.1:${port}/healthz`)
+      const csp = response.headers.get('content-security-policy')!
+      const imagePolicy = csp.split(';').find((directive) => directive.startsWith('img-src'))
+      expect(imagePolicy).toBe("img-src 'self' data: blob: https://res.cloudinary.com")
+      expect(imagePolicy).not.toContain('*')
+    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
+  })
+
+  it.each([400, 413, 503])('returns clear photo errors with status %i', (code) => {
+    const handler = app.router.stack.find((layer) => layer.handle.length === 4)!.handle
+    const json = vi.fn()
+    const status = vi.fn(() => ({ json }))
+    handler(new ImageError(code, 'PHOTO_ERROR', 'Photo validation failed.'), {} as never, { status } as never, vi.fn())
+    expect(status).toHaveBeenCalledWith(code)
+    expect(json).toHaveBeenCalledWith({ error: { code: 'PHOTO_ERROR', message: 'Photo validation failed.' } })
+  })
   it('mounts the protected dashboard router at the client API path', () => {
     expect(app.router.stack.some((layer) => layer.handle === dashboardRouter)).toBe(true)
   })
diff --git a/server/app.ts b/server/app.ts
index 28f04df..3911138 100644
--- a/server/app.ts
+++ b/server/app.ts
@@ -4,6 +4,7 @@ import cookieParser from 'cookie-parser'
 import cors from 'cors'
 import express from 'express'
 import helmet from 'helmet'
+import { ImageError } from './infrastructure/images.js'
 import { config } from './infrastructure/config.js'
 import { logError } from './infrastructure/logger.js'
 import { authRouter } from './modules/auth/routes.js'
@@ -20,7 +21,7 @@ const app = express()
 
 app.disable('x-powered-by')
 app.set('trust proxy', config.NODE_ENV === 'production' ? 1 : 0)
-app.use(helmet())
+app.use(helmet({ contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'] } } }))
 app.use(cors({ origin: config.APP_ORIGIN, credentials: true }))
 app.use((req, res, next) => {
   req.requestId = req.get('x-request-id') || randomUUID()
@@ -52,6 +53,7 @@ app.use((_req, res) => {
 })
 
 app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
+  if (error instanceof ImageError) return res.status(error.status).json({ error: { code: error.code, message: error.message } })
   logError('request_failed', error, { requestId: req.requestId })
   if (res.headersSent) return next(error)
   res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
diff --git a/server/infrastructure/config.ts b/server/infrastructure/config.ts
index 2e702f0..1183c26 100644
--- a/server/infrastructure/config.ts
+++ b/server/infrastructure/config.ts
@@ -2,6 +2,9 @@ import 'dotenv/config'
 import { z } from 'zod'
 
 const configSchema = z.object({
+  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
+  CLOUDINARY_API_KEY: z.string().trim().optional(),
+  CLOUDINARY_API_SECRET: z.string().trim().optional(),
   NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
   PORT: z.coerce.number().int().positive().default(3000),
   APP_ORIGIN: z.string().url().default('http://localhost:5173'),
@@ -22,6 +25,9 @@ const configSchema = z.object({
 })
 
 export const config = configSchema.parse({
+  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
+  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
+  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
   NODE_ENV: process.env.NODE_ENV,
   PORT: process.env.PORT,
   APP_ORIGIN: process.env.APP_ORIGIN,
diff --git a/server/modules/notifications/service.test.ts b/server/modules/notifications/service.test.ts
index 7f97727..2033390 100644
--- a/server/modules/notifications/service.test.ts
+++ b/server/modules/notifications/service.test.ts
@@ -34,6 +34,21 @@ describe('stock notifications', () => {
     expect(message.html).toContain('<strong>Widget (Tools)</strong>')
   })
 
+  it('escapes trusted photo markup and preserves readable plain text', async () => {
+    await notifyStock('user-a', 'added', [{ name: 'A <shirt>', category: 'Clothes', imageUrl: 'https://res.cloudinary.com/test/image/upload/photo.png?a=1&b=2' }])
+    const message = mocks.sendMessage.mock.calls[0][0]
+    expect(message.html).toContain('<img src="https://res.cloudinary.com/')
+    expect(message.html).toContain('a=1&amp;b=2')
+    expect(message.html).toContain('alt="A &lt;shirt&gt;"')
+    expect(message.text).toContain('A <shirt> (Clothes)')
+  })
+
+  it.each(['https://res.cloudinary.com.evil.test/photo', 'http://res.cloudinary.com/photo', 'javascript:alert(1)', 'https://evil.test/photo'])('omits untrusted image URL %s', async (imageUrl) => {
+    await notifyStock('user-a', 'added', [{ name: 'Widget', category: 'Tools', imageUrl }])
+    expect(mocks.sendMessage.mock.calls[0][0].html).not.toContain('<img')
+    expect(mocks.sendMessage.mock.calls[0][0].text).toContain('Widget (Tools)')
+  })
+
   it('sends one summary message for bulk additions', async () => {
     await notifyStock('user-a', 'added', [
       { name: 'Widget', category: 'Tools', quantity: 2, price: '10.00' },
diff --git a/server/modules/notifications/service.ts b/server/modules/notifications/service.ts
index caec57c..db823a6 100644
--- a/server/modules/notifications/service.ts
+++ b/server/modules/notifications/service.ts
@@ -6,7 +6,7 @@ import { getDashboard } from '../dashboard/service.js'
 
 export type NotificationEvent = 'added' | 'deleted' | 'changed'
 export type NotificationChange = { label: string; before: string; after: string }
-export type NotificationItem = { name: string; category: string; quantity?: number; price?: string; costDeducted?: string; changes?: NotificationChange[] }
+export type NotificationItem = { imageUrl?: string | null; name: string; category: string; quantity?: number; price?: string; costDeducted?: string; changes?: NotificationChange[] }
 
 function money(value: string | undefined): string {
   return value ? `₱${value}` : ''
@@ -49,7 +49,12 @@ export async function notifyStock(userId: string, event: NotificationEvent, item
             ...(item.price === undefined ? [] : [`Price: ${money(item.price)}`]),
             ...(item.costDeducted === undefined ? [] : [`Initial cost deducted: ${money(item.costDeducted)}`]),
           ]
-      return `<li><strong>${escapeHtml(item.name)} (${escapeHtml(item.category)})</strong>${details.length ? `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>` : ''}</li>`
+      let photo = ''
+      try {
+        const url = new URL(item.imageUrl ?? '')
+        if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password && !url.port) photo = `<img src="${escapeHtml(url.href)}" alt="${escapeHtml(item.name)}" width="64" height="64" style="object-fit:cover;border-radius:8px" loading="lazy"> `
+      } catch { /* Missing/untrusted photos leave readable text intact. */ }
+      return `<li>${photo}<strong>${escapeHtml(item.name)} (${escapeHtml(item.category)})</strong>${details.length ? `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>` : ''}</li>`
     }).join('')
     const html = `<h2>${escapeHtml(title)}</h2><ul>${htmlItems}</ul><p>${escapeHtml(summary).replaceAll('\n', '<br>')}<br>Date/time: ${escapeHtml(now)}</p>`
     const subject = `${title}: ${items[0]?.name ?? 'multiple products'}${items[0]?.category ? ` (${items[0].category})` : ''} | Profit ${dashboard.profit} | ${dashboard.stock.totalUnits} units`
diff --git a/server/modules/products/data-access.test.ts b/server/modules/products/data-access.test.ts
index d6b8bba..960b689 100644
--- a/server/modules/products/data-access.test.ts
+++ b/server/modules/products/data-access.test.ts
@@ -12,7 +12,7 @@ function database() {
       update: vi.fn(),
       updateMany: vi.fn(),
     },
-    stockPurchase: { deleteMany: vi.fn(), updateMany: vi.fn() },
+    stockPurchase: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), updateMany: vi.fn() },
   }
   const db = {
     $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
@@ -79,10 +79,12 @@ describe('product data access', () => {
 
   it('permanently deletes an archived product and its dependent history in one transaction', async () => {
     const { db, tx } = database()
-    tx.product.findFirst.mockResolvedValueOnce({ id: 'product-id' })
+    tx.product.findFirst.mockResolvedValueOnce({ id: 'product-id', imagePublicId: 'current' })
+    tx.stockPurchase.findMany.mockResolvedValue([{ imagePublicId: 'old' }, { imagePublicId: 'older' }])
     tx.product.delete.mockResolvedValue({ id: 'product-id' })
 
-    await expect(permanentlyDeleteArchivedProduct(db as never, 'user-a', 'product-id')).resolves.toEqual({ kind: 'deleted', product: { id: 'product-id' } })
+    await expect(permanentlyDeleteArchivedProduct(db as never, 'user-a', 'product-id')).resolves.toMatchObject({ kind: 'deleted', product: { id: 'product-id' }, imageCandidates: ['current', 'old', 'older'] })
+    expect(tx.stockPurchase.findMany).toHaveBeenCalledWith({ where: { userId: 'user-a', productId: 'product-id' }, select: { imagePublicId: true } })
     expect(tx.expense.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-a', productId: 'product-id' } })
     expect(tx.stockPurchase.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-a', productId: 'product-id' } })
     expect(tx.product.delete).toHaveBeenCalledWith({ where: { id: 'product-id' } })
diff --git a/server/modules/products/data-access.ts b/server/modules/products/data-access.ts
index 825671d..905d038 100644
--- a/server/modules/products/data-access.ts
+++ b/server/modules/products/data-access.ts
@@ -1,5 +1,6 @@
 import type { Prisma, PrismaClient } from '@prisma/client'
 import { prisma } from '../../infrastructure/prisma.js'
+import type { ImageFields } from '../../infrastructure/images.js'
 
 export type Database = PrismaClient | Prisma.TransactionClient
 export const database = prisma
@@ -12,7 +13,7 @@ export function listProducts(db: Database, userId: string, status: ProductStatus
   })
 }
 
-export async function createProduct(db: PrismaClient, userId: string, input: { name: string; category: string; priceCents: number; originalPriceCents?: number; stockQuantity?: number; deductionCents?: number }) {
+export async function createProduct(db: PrismaClient, userId: string, input: { name: string; category: string; priceCents: number; originalPriceCents?: number; stockQuantity?: number; deductionCents?: number } & Partial<ImageFields>) {
   if (input.deductionCents === undefined) {
     const { deductionCents: _deductionCents, ...productInput } = input
     return db.product.create({ data: { userId, ...productInput } })
@@ -25,7 +26,7 @@ export async function createProduct(db: PrismaClient, userId: string, input: { n
   })
 }
 
-export async function createProducts(db: PrismaClient, userId: string, inputs: Array<{ name: string; category: string; priceCents: number; originalPriceCents?: number; stockQuantity?: number; deductionCents?: number }>) {
+export async function createProducts(db: PrismaClient, userId: string, inputs: Array<{ name: string; category: string; priceCents: number; originalPriceCents?: number; stockQuantity?: number; deductionCents?: number } & Partial<ImageFields>>) {
   return db.$transaction(async (tx) => {
     const products = []
     for (const input of inputs) {
@@ -40,16 +41,16 @@ export async function createProducts(db: PrismaClient, userId: string, inputs: A
   })
 }
 
-export async function updateProduct(db: PrismaClient, userId: string, id: string, input: { name: string; category: string; priceCents: number; updatedAt: Date }) {
+export async function updateProduct(db: PrismaClient, userId: string, id: string, input: { name: string; category: string; priceCents: number; updatedAt: Date } & Partial<ImageFields>) {
   return db.$transaction(async (tx) => {
-    const existing = await tx.product.findFirst({ where: { id, userId, active: true, deletedAt: null, updatedAt: input.updatedAt }, select: { name: true, category: true, priceCents: true } })
-    if (existing && existing.name === input.name && existing.category === input.category && existing.priceCents === input.priceCents) {
+    const existing = await tx.product.findFirst({ where: { id, userId, active: true, deletedAt: null, updatedAt: input.updatedAt }, select: { name: true, category: true, priceCents: true, imageUrl: true, imagePublicId: true } })
+    if (existing && existing.name === input.name && existing.category === input.category && existing.priceCents === input.priceCents && (input.imageUrl === undefined || existing.imageUrl === input.imageUrl)) {
       return { kind: 'unchanged' as const, product: await tx.product.findUniqueOrThrow({ where: { id } }) }
     }
     const updatedAt = new Date(Math.max(Date.now(), input.updatedAt.getTime() + 1))
     const changed = await tx.product.updateMany({
       where: { id, userId, active: true, deletedAt: null, updatedAt: input.updatedAt },
-      data: { name: input.name, category: input.category, priceCents: input.priceCents, updatedAt },
+      data: { name: input.name, category: input.category, priceCents: input.priceCents, updatedAt, ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl, imagePublicId: input.imagePublicId }) },
     })
     if (changed.count === 1) return { kind: 'updated' as const, previous: existing!, product: await tx.product.findUniqueOrThrow({ where: { id } }) }
 
@@ -77,16 +78,17 @@ export async function archiveProduct(db: PrismaClient, userId: string, id: strin
 
 export async function permanentlyDeleteArchivedProduct(db: PrismaClient, userId: string, id: string) {
   return db.$transaction(async (tx) => {
-    const product = await tx.product.findFirst({ where: { id, userId, active: false }, select: { id: true, name: true, category: true, stockQuantity: true } })
+    const product = await tx.product.findFirst({ where: { id, userId, active: false }, select: { id: true, name: true, category: true, stockQuantity: true, imageUrl: true, imagePublicId: true } })
     if (!product) {
       const current = await tx.product.findFirst({ where: { id, userId }, select: { active: true } })
       return current ? { kind: 'active' as const } : { kind: 'not-found' as const }
     }
 
+    const snapshots = await tx.stockPurchase.findMany({ where: { userId, productId: product.id }, select: { imagePublicId: true } })
     await tx.expense.deleteMany({ where: { userId, productId: product.id } })
     await tx.stockPurchase.deleteMany({ where: { userId, productId: product.id } })
     await tx.product.delete({ where: { id: product.id } })
-    return { kind: 'deleted' as const, product }
+    return { kind: 'deleted' as const, product, imageCandidates: [product.imagePublicId, ...snapshots.map((purchase) => purchase.imagePublicId)] }
   })
 }
 
diff --git a/server/modules/products/routes.test.ts b/server/modules/products/routes.test.ts
index 6e64961..c426c34 100644
--- a/server/modules/products/routes.test.ts
+++ b/server/modules/products/routes.test.ts
@@ -23,6 +23,7 @@ function response(): MockResponse {
 }
 
 async function invoke(method: 'get' | 'post' | 'put' | 'delete', path: string, req: Record<string, unknown>) {
+  req.headers ??= { 'content-type': 'application/json' }
   const layer = productsRouter.stack.find((candidate) => {
     const route = candidate.route as { path?: string; methods?: Record<string, boolean> } | undefined
     return route?.path === path && route.methods?.[method] === true
@@ -37,7 +38,11 @@ async function invoke(method: 'get' | 'post' | 'put' | 'delete', path: string, r
     const handler = handlers[index++]
     if (handler) await handler(req as never, res as never, next as never)
   }
-  await next()
+  await new Promise<void>((resolve, reject) => {
+    res.json.mockImplementation(() => resolve())
+    const original = next
+    void original().catch(reject)
+  })
   return res
 }
 
diff --git a/server/modules/products/routes.ts b/server/modules/products/routes.ts
index c690085..bab04d7 100644
--- a/server/modules/products/routes.ts
+++ b/server/modules/products/routes.ts
@@ -1,5 +1,6 @@
 import { Router } from 'express'
 import { z } from 'zod'
+import { productUpload, withProductPhotos } from '../../infrastructure/images.js'
 import { requireSameOrigin } from '../../middleware/origin.js'
 import { requireSession } from '../../middleware/session.js'
 import { archiveProduct, createProduct, createProducts, listProducts, permanentlyDeleteArchivedProduct, restoreArchivedProduct, updateProduct } from './service.js'
@@ -11,9 +12,10 @@ const productSchema = z.object({
   price: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) * 100 <= 2147483647),
 })
 const originalPriceSchema = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) * 100 <= 2147483647)
-const createProductSchema = productSchema.extend({ stockQuantity: z.number().int().nonnegative().max(1_000_000_000).default(0), originalPrice: originalPriceSchema.optional() })
+const stockQuantitySchema = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().nonnegative().max(1_000_000_000)).default(0)
+const createProductSchema = productSchema.extend({ stockQuantity: stockQuantitySchema, originalPrice: originalPriceSchema.optional() })
 const bulkCreateSchema = z.object({ products: z.array(createProductSchema).min(1).max(50) })
-const updateSchema = productSchema.extend({ updatedAt: z.string().datetime({ offset: true }) })
+const updateSchema = productSchema.extend({ updatedAt: z.string().datetime({ offset: true }), removeImage: z.union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')]).optional() })
 const listSchema = z.object({ status: z.enum(['active', 'archived']).default('active') })
 
 function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
@@ -40,22 +42,25 @@ productsRouter.get('/', requireSession, async (req, res, next) => {
   }
 })
 
-productsRouter.post('/', requireSession, requireSameOrigin, async (req, res, next) => {
+productsRouter.post('/', requireSession, requireSameOrigin, productUpload, async (req, res, next) => {
   try {
     const input = createProductSchema.parse(req.body)
-    const outcome = await createProduct(req.userId!, input)
+    const outcome = await withProductPhotos(req.file, 1, async ([photo], warning) => ({ ...await createProduct(req.userId!, { ...input, ...photo }), warning }))
     if (outcome.kind === 'duplicate') return res.status(409).json({ error: { code: 'DUPLICATE_PRODUCT', message: 'A product with that name already exists.' } })
-    res.status(201).json({ product: outcome.product })
+    res.status(201).json({ product: outcome.product, warning: outcome.warning })
   } catch (error) {
     if (error instanceof z.ZodError) return invalidInput(res)
     next(error)
   }
 })
 
-productsRouter.put('/:id', requireSession, requireSameOrigin, async (req, res, next) => {
+productsRouter.put('/:id', requireSession, requireSameOrigin, productUpload, async (req, res, next) => {
   try {
     const { id } = idSchema.parse(req.params)
-    sendOutcome(res, await updateProduct(req.userId!, id, updateSchema.parse(req.body)))
+    const input = updateSchema.parse(req.body)
+    const outcome = await withProductPhotos(req.file, 1, async ([photo], warning) => ({ ...await updateProduct(req.userId!, id, { ...input, ...photo, removeImage: req.file ? false : input.removeImage }), warning }))
+    if (outcome.kind === 'updated' || outcome.kind === 'unchanged') return res.json({ product: outcome.product, warning: outcome.warning })
+    sendOutcome(res, outcome)
   } catch (error) {
     if (error instanceof z.ZodError) return invalidInput(res)
     next(error)
@@ -98,11 +103,16 @@ productsRouter.post('/:id/restore', requireSession, requireSameOrigin, async (re
   }
 })
 
-productsRouter.post('/bulk', requireSession, requireSameOrigin, async (req, res, next) => {
+productsRouter.post('/bulk', requireSession, requireSameOrigin, productUpload, async (req, res, next) => {
   try {
-    const outcome = await createProducts(req.userId!, bulkCreateSchema.parse(req.body).products)
+    let body = req.body
+    if (req.is('multipart/form-data')) {
+      try { body = { products: JSON.parse(req.body.products) } } catch { return invalidInput(res) }
+    }
+    const inputs = bulkCreateSchema.parse(body).products
+    const outcome = await withProductPhotos(req.file, inputs.length, async (photos, warning) => ({ ...await createProducts(req.userId!, inputs.map((input, index) => ({ ...input, ...photos[index] }))), warning }))
     if (outcome.kind === 'duplicate') return res.status(409).json({ error: { code: 'DUPLICATE_PRODUCT', message: 'A product with that name already exists.' } })
-    res.status(201).json({ products: outcome.products })
+    res.status(201).json({ products: outcome.products, warning: outcome.warning })
   } catch (error) {
     if (error instanceof z.ZodError) return invalidInput(res)
     next(error)
diff --git a/server/modules/products/service.test.ts b/server/modules/products/service.test.ts
index 146c97f..e36a365 100644
--- a/server/modules/products/service.test.ts
+++ b/server/modules/products/service.test.ts
@@ -6,9 +6,12 @@ const mocks = vi.hoisted(() => ({
   listProducts: vi.fn(),
   restoreArchivedProduct: vi.fn(),
   updateProduct: vi.fn(),
+  cleanupImages: vi.fn().mockResolvedValue(undefined),
+  permanentlyDeleteArchivedProduct: vi.fn(),
 }))
 
 vi.mock('./data-access.js', () => ({
+  permanentlyDeleteArchivedProduct: mocks.permanentlyDeleteArchivedProduct,
   archiveProduct: mocks.archiveProduct,
   createProduct: mocks.createProduct,
   database: {},
@@ -16,12 +19,45 @@ vi.mock('./data-access.js', () => ({
   restoreArchivedProduct: mocks.restoreArchivedProduct,
   updateProduct: mocks.updateProduct,
 }))
+vi.mock('../../infrastructure/images.js', () => ({ cleanupImages: mocks.cleanupImages }))
+vi.mock('../notifications/service.js', () => ({ notifyStock: vi.fn().mockResolvedValue(undefined) }))
 
-import { archiveProduct, createProduct, listProducts, normalizeProductName, restoreArchivedProduct, updateProduct } from './service.js'
+import { archiveProduct, createProduct, listProducts, normalizeProductName, permanentlyDeleteArchivedProduct, restoreArchivedProduct, updateProduct } from './service.js'
 
 describe('product catalog service', () => {
   beforeEach(() => vi.clearAllMocks())
 
+  it('removes a photo, checks the previous reference after saving, and keeps IDs internal', async () => {
+    const previous = { name: 'widget', category: 'hardware', priceCents: 1000, imageUrl: 'https://res.cloudinary.com/test/old.png', imagePublicId: 'old' }
+    const product = { ...previous, id: 'p', userId: 'user-a', imageUrl: null, imagePublicId: null, active: true, updatedAt: new Date() }
+    mocks.updateProduct.mockResolvedValue({ kind: 'updated', previous, product })
+    const result = await updateProduct('user-a', 'p', { name: 'widget', category: 'hardware', price: '10.00', updatedAt: product.updatedAt.toISOString(), removeImage: true })
+    expect(mocks.updateProduct).toHaveBeenCalledWith({}, 'user-a', 'p', expect.objectContaining({ imageUrl: null, imagePublicId: null }))
+    expect(mocks.cleanupImages).toHaveBeenCalledWith(['old'])
+    expect(result).toMatchObject({ kind: 'updated', product: { imageUrl: null } })
+    if ('product' in result) expect(result.product).not.toHaveProperty('imagePublicId')
+  })
+
+  it('preserves the current photo when details are saved without an uploaded replacement', async () => {
+    const product = { id: 'p', name: 'widget', category: 'hardware', priceCents: 1000, imageUrl: 'https://res.cloudinary.com/test/old.png', imagePublicId: 'old', active: true, updatedAt: new Date() }
+    mocks.updateProduct.mockResolvedValue({ kind: 'unchanged', product })
+    const result = await updateProduct('user-a', 'p', { name: 'widget', category: 'hardware', price: '10.00', updatedAt: product.updatedAt.toISOString() })
+    expect(mocks.updateProduct.mock.calls[0][3]).not.toHaveProperty('imageUrl')
+    expect(result).toMatchObject({ product: { imageUrl: product.imageUrl } })
+    if ('product' in result) expect(result.product).not.toHaveProperty('imagePublicId')
+    expect(mocks.cleanupImages).not.toHaveBeenCalled()
+  })
+
+  it('cleans all permanent-delete candidates only after persistence succeeds', async () => {
+    mocks.permanentlyDeleteArchivedProduct.mockResolvedValue({ kind: 'deleted', product: { name: 'widget', category: 'hardware' }, imageCandidates: ['current', 'historic'] })
+    await permanentlyDeleteArchivedProduct('user-a', 'p')
+    expect(mocks.cleanupImages).toHaveBeenCalledWith(['current', 'historic'])
+    mocks.cleanupImages.mockClear()
+    mocks.permanentlyDeleteArchivedProduct.mockRejectedValue(new Error('rollback'))
+    await expect(permanentlyDeleteArchivedProduct('user-a', 'p')).rejects.toThrow('rollback')
+    expect(mocks.cleanupImages).not.toHaveBeenCalled()
+  })
+
   it('normalizes product names before persistence', async () => {
     mocks.createProduct.mockResolvedValue({ id: 'product-id', name: 'widget', category: 'hardware', active: true, archivedAt: null, updatedAt: new Date() })
 
@@ -66,7 +102,7 @@ describe('product catalog service', () => {
     const updatedAt = new Date('2026-09-30T12:00:00.000Z')
     mocks.restoreArchivedProduct.mockResolvedValue({ kind: 'restored', product: { id: 'product-id', name: 'widget', category: 'hardware', priceCents: 1250, stockQuantity: 3, active: true, archivedAt: null, deletedAt: null, updatedAt } })
 
-    await expect(restoreArchivedProduct('user-a', 'product-id')).resolves.toEqual({ kind: 'restored', product: { id: 'product-id', name: 'widget', category: 'hardware', price: '12.50', originalPrice: null, stockQuantity: 3, active: true, archivedAt: null, deletedAt: null, updatedAt: updatedAt.toISOString() } })
+    await expect(restoreArchivedProduct('user-a', 'product-id')).resolves.toEqual({ kind: 'restored', product: { imageUrl: null, id: 'product-id', name: 'widget', category: 'hardware', price: '12.50', originalPrice: null, stockQuantity: 3, active: true, archivedAt: null, deletedAt: null, updatedAt: updatedAt.toISOString() } })
     expect(mocks.restoreArchivedProduct).toHaveBeenCalledWith({}, 'user-a', 'product-id')
   })
 })
\ No newline at end of file
diff --git a/server/modules/products/service.ts b/server/modules/products/service.ts
index a4379d0..8fca1ee 100644
--- a/server/modules/products/service.ts
+++ b/server/modules/products/service.ts
@@ -1,4 +1,5 @@
 import type { Product } from '@prisma/client'
+import { cleanupImages, type ImageFields } from '../../infrastructure/images.js'
 import { notifyStock } from '../notifications/service.js'
 import {
   archiveProduct as archiveProductRecord,
@@ -13,6 +14,7 @@ import {
 } from './data-access.js'
 
 export type ProductResponse = {
+  imageUrl: string | null
   id: string
   name: string
   category: string
@@ -31,6 +33,7 @@ export function normalizeProductName(value: string): string {
 
 function toResponse(product: Product): ProductResponse {
   return {
+    imageUrl: product.imageUrl ?? null,
     id: product.id,
     name: product.name,
     category: product.category,
@@ -59,6 +62,7 @@ export function parsePrice(value: string): number {
 
 function notificationItem(product: ProductResponse) {
   return {
+    imageUrl: product.imageUrl,
     name: product.name,
     category: product.category,
     quantity: product.stockQuantity,
@@ -67,9 +71,10 @@ function notificationItem(product: ProductResponse) {
   }
 }
 
-export async function createProduct(userId: string, input: { name: string; category: string; price?: string; originalPrice?: string; stockQuantity?: number }) {
+export async function createProduct(userId: string, input: { name: string; category: string; price?: string; originalPrice?: string; stockQuantity?: number } & Partial<ImageFields>) {
   try {
     const createInput = {
+      ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl, imagePublicId: input.imagePublicId }),
       name: normalizeProductName(input.name),
       category: input.category.trim().toLowerCase(),
       priceCents: input.price === undefined ? 0 : parsePrice(input.price),
@@ -84,18 +89,22 @@ export async function createProduct(userId: string, input: { name: string; categ
   }
 }
 
-export async function updateProduct(userId: string, id: string, input: { name: string; category: string; price?: string; updatedAt: string }) {
+export async function updateProduct(userId: string, id: string, input: { name: string; category: string; price?: string; updatedAt: string; removeImage?: boolean } & Partial<ImageFields>) {
   try {
     const outcome = await updateProductRecord(database, userId, id, {
+      ...(input.removeImage ? { imageUrl: null, imagePublicId: null } : input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl, imagePublicId: input.imagePublicId }),
       name: normalizeProductName(input.name),
       category: input.category.trim().toLowerCase(),
       priceCents: input.price === undefined ? 0 : parsePrice(input.price),
       updatedAt: new Date(input.updatedAt),
     })
+    if (outcome.kind === 'unchanged') return { kind: outcome.kind, product: toResponse(outcome.product) }
     if (outcome.kind !== 'updated') return outcome
+    await cleanupImages([outcome.previous.imagePublicId])
     const product = toResponse(outcome.product)
     if (outcome.kind === 'updated') {
-      void notifyStock(userId, 'changed', [{ name: product.name, category: product.category, changes: [
+      void notifyStock(userId, 'changed', [{ name: product.name, category: product.category, imageUrl: product.imageUrl, changes: [
+        ...(outcome.previous.imageUrl !== outcome.product.imageUrl ? [{ label: 'Photo', before: outcome.previous.imageUrl ? 'Photo' : 'No photo', after: product.imageUrl ? 'Photo updated' : 'No photo' }] : []),
         ...(outcome.previous.name !== product.name ? [{ label: 'Name', before: outcome.previous.name, after: product.name }] : []),
         ...(outcome.previous.category !== product.category ? [{ label: 'Category', before: outcome.previous.category, after: product.category }] : []),
         ...(outcome.previous.priceCents !== outcome.product.priceCents ? [{ label: 'Price', before: (outcome.previous.priceCents / 100).toFixed(2), after: product.price }] : []),
@@ -112,13 +121,14 @@ export async function archiveProduct(userId: string, id: string, updatedAt: stri
   const outcome = await archiveProductRecord(database, userId, id, new Date(updatedAt))
   if (outcome.kind !== 'updated') return outcome
   const product = toResponse(outcome.product)
-  void notifyStock(userId, 'deleted', [{ name: product.name, category: product.category, quantity: product.stockQuantity }])
+  void notifyStock(userId, 'deleted', [{ name: product.name, category: product.category, quantity: product.stockQuantity, imageUrl: product.imageUrl }])
   return { ...outcome, product }
 }
 
 export async function permanentlyDeleteArchivedProduct(userId: string, id: string) {
   const outcome = await permanentlyDeleteArchivedProductRecord(database, userId, id)
-  if (outcome.kind === 'deleted') void notifyStock(userId, 'deleted', [{ name: outcome.product.name, category: outcome.product.category, quantity: outcome.product.stockQuantity }])
+  if (outcome.kind === 'deleted') await cleanupImages(outcome.imageCandidates)
+  if (outcome.kind === 'deleted') void notifyStock(userId, 'deleted', [{ name: outcome.product.name, category: outcome.product.category, quantity: outcome.product.stockQuantity, imageUrl: outcome.product.imageUrl }])
   return outcome
 }
 
@@ -127,9 +137,10 @@ export async function restoreArchivedProduct(userId: string, id: string) {
   return outcome.kind === 'restored' ? { ...outcome, product: toResponse(outcome.product) } : outcome
 }
 
-export async function createProducts(userId: string, inputs: Array<{ name: string; category: string; price?: string; originalPrice?: string; stockQuantity?: number }>) {
+export async function createProducts(userId: string, inputs: Array<{ name: string; category: string; price?: string; originalPrice?: string; stockQuantity?: number } & Partial<ImageFields>>) {
   try {
     const normalized = inputs.map((input) => ({
+      ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl, imagePublicId: input.imagePublicId }),
       name: normalizeProductName(input.name),
       category: input.category.trim().toLowerCase(),
       priceCents: input.price === undefined ? 0 : parsePrice(input.price),
diff --git a/server/modules/stock/data-access.test.ts b/server/modules/stock/data-access.test.ts
index 4ff66b6..90ce4aa 100644
--- a/server/modules/stock/data-access.test.ts
+++ b/server/modules/stock/data-access.test.ts
@@ -1,27 +1,78 @@
 import { describe, expect, it, vi } from 'vitest'
-import { adjustStock, createPurchase, deletePurchase, deleteStockData, getReportData, listPurchases, listStock, purgeExpiredDeletedStockData, setStockQuantity } from './data-access.js'
+import { adjustStock, createPurchase, createPurchases, deletePurchase, deleteStockData, getReportData, listPurchases, listStock, purgeExpiredDeletedStockData, setStockQuantity } from './data-access.js'
+const images = vi.hoisted(() => ({ cleanupImages: vi.fn().mockResolvedValue(undefined) }))
+vi.mock('../../infrastructure/images.js', () => images)
 
 function database() {
   const tx = {
     product: {
+      findMany: vi.fn().mockResolvedValue([]),
       findFirst: vi.fn(),
       findFirstOrThrow: vi.fn(),
       updateMany: vi.fn(),
       deleteMany: vi.fn(),
     },
-    stockPurchase: { create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
+    stockPurchase: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
     expense: { create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
   }
   const db = {
     $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
-    product: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
-    stockPurchase: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
-    expense: { deleteMany: vi.fn() },
+    product: { ...tx.product, findMany: vi.fn() },
+    stockPurchase: { ...tx.stockPurchase, findMany: vi.fn() },
+    expense: tx.expense,
   }
   return { db, tx }
 }
 
 describe('stock data access', () => {
+  it.each([false, true])('captures immutable photo snapshots in single/checkout flow (checkout=%s)', async (checkout) => {
+    const { db, tx } = database()
+    const product = { id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 625, stockQuantity: 5, imageUrl: 'https://res.cloudinary.com/test/old.png', imagePublicId: 'old-photo' }
+    tx.product.findFirst.mockResolvedValue(product)
+    tx.product.updateMany.mockResolvedValue({ count: 1 })
+    tx.stockPurchase.create.mockImplementation(async ({ data }) => ({ ...data, id: 'purchase-a' }))
+    const input = { productId: 'product-a', quantity: 2 }
+    if (checkout) await createPurchases(db as never, 'user-a', [input])
+    else await createPurchase(db as never, 'user-a', input)
+    product.imageUrl = 'https://res.cloudinary.com/test/replaced.png'
+    product.imagePublicId = 'replacement'
+    expect(tx.stockPurchase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageUrl: 'https://res.cloudinary.com/test/old.png', imagePublicId: 'old-photo' }), select: expect.objectContaining({ imageUrl: true }) }))
+    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ imagePublicId: 'old-photo' }) }))
+  })
+
+  it('collects purchase and product candidates before purge and cleans after commit', async () => {
+    images.cleanupImages.mockClear()
+    const { db, tx } = database()
+    tx.stockPurchase.findMany.mockResolvedValue([{ imagePublicId: 'history-photo' }])
+    tx.product.findMany.mockResolvedValue([{ imagePublicId: 'product-photo' }])
+    tx.expense.deleteMany.mockResolvedValue({ count: 0 })
+    tx.stockPurchase.deleteMany.mockResolvedValue({ count: 1 })
+    tx.product.deleteMany.mockResolvedValue({ count: 1 })
+    let committed = false
+    db.$transaction.mockImplementation(async (callback) => {
+      const result = await callback(tx)
+      expect(images.cleanupImages).not.toHaveBeenCalled()
+      committed = true
+      return result
+    })
+    images.cleanupImages.mockImplementationOnce(async () => { expect(committed).toBe(true) })
+    await purgeExpiredDeletedStockData(db as never)
+    expect(images.cleanupImages).toHaveBeenCalledWith(['history-photo', 'product-photo'])
+    expect(tx.stockPurchase.findMany.mock.invocationCallOrder[0]).toBeLessThan(tx.stockPurchase.deleteMany.mock.invocationCallOrder[0])
+  })
+
+  it('cleans the deleted tenant purchase snapshot after commit and never on rollback', async () => {
+    images.cleanupImages.mockClear()
+    const { db, tx } = database()
+    tx.stockPurchase.findFirst.mockResolvedValue({ imagePublicId: 'history-photo' })
+    tx.stockPurchase.deleteMany.mockResolvedValue({ count: 1 })
+    await deletePurchase(db as never, 'user-a', 'purchase-a')
+    expect(images.cleanupImages).toHaveBeenCalledWith(['history-photo'])
+    images.cleanupImages.mockClear()
+    tx.stockPurchase.deleteMany.mockRejectedValue(new Error('rollback'))
+    await expect(deletePurchase(db as never, 'user-a', 'purchase-a')).rejects.toThrow('rollback')
+    expect(images.cleanupImages).not.toHaveBeenCalled()
+  })
   it('lists only active stock and tenant-owned purchase history', async () => {
     const { db } = database()
 
@@ -50,7 +101,7 @@ describe('stock data access', () => {
     await expect(createPurchase(db as never, 'user-a', { productId: 'product-a', quantity: 2 })).resolves.toEqual({ kind: 'created', purchase: { id: 'purchase-a' } })
     expect(db.$transaction).toHaveBeenCalledOnce()
     expect(tx.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'product-a', userId: 'user-a', active: true, deletedAt: null } }))
-    expect(tx.product.updateMany).toHaveBeenCalledWith({ where: { id: 'product-a', userId: 'user-a', active: true, deletedAt: null, stockQuantity: { gte: 2 } }, data: { stockQuantity: { decrement: 2 } } })
+    expect(tx.product.updateMany).toHaveBeenCalledWith({ where: { id: 'product-a', userId: 'user-a', active: true, deletedAt: null, imagePublicId: null, stockQuantity: { gte: 2 } }, data: { stockQuantity: { decrement: 2 } } })
     expect(tx.stockPurchase.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'user-a', productId: 'product-a', productNameSnapshot: 'Widget', categorySnapshot: 'Hardware', quantity: 2, totalCostCents: 1250 } }))
   })
 
diff --git a/server/modules/stock/data-access.ts b/server/modules/stock/data-access.ts
index 1efceba..395bd1c 100644
--- a/server/modules/stock/data-access.ts
+++ b/server/modules/stock/data-access.ts
@@ -1,10 +1,12 @@
 import type { Prisma, PrismaClient } from '@prisma/client'
 import { prisma } from '../../infrastructure/prisma.js'
+import { cleanupImages } from '../../infrastructure/images.js'
 
 export type Database = PrismaClient | Prisma.TransactionClient
 export const database = prisma
 
 const productSelection = {
+  imageUrl: true,
   id: true,
   name: true,
   category: true,
@@ -15,6 +17,7 @@ const productSelection = {
 } satisfies Prisma.ProductSelect
 
 export const purchaseSelection = {
+  imageUrl: true,
   id: true,
   productId: true,
   productNameSnapshot: true,
@@ -62,16 +65,17 @@ export async function adjustStock(db: PrismaClient, userId: string, productId: s
 
 export async function createPurchase(db: PrismaClient, userId: string, input: { productId: string; quantity: number }) {
   return db.$transaction(async (tx) => {
-    const product = await tx.product.findFirst({ where: { id: input.productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true, priceCents: true } })
+    const product = await tx.product.findFirst({ where: { id: input.productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true, priceCents: true, imageUrl: true, imagePublicId: true } })
     if (!product) return { kind: 'product-not-found' as const }
     if ((product.priceCents ?? 0) <= 0) return { kind: 'product-price-missing' as const }
     const totalCostCents = product.priceCents * input.quantity
     if (!Number.isSafeInteger(totalCostCents) || totalCostCents > 2_147_483_647) return { kind: 'purchase-total-too-large' as const }
 
-    const changed = await tx.product.updateMany({ where: { id: product.id, userId, active: true, deletedAt: null, stockQuantity: { gte: input.quantity } }, data: { stockQuantity: { decrement: input.quantity } } })
+    // The row lock acquired by this write also protects the captured image reference.
+    const changed = await tx.product.updateMany({ where: { id: product.id, userId, active: true, deletedAt: null, imagePublicId: product.imagePublicId ?? null, stockQuantity: { gte: input.quantity } }, data: { stockQuantity: { decrement: input.quantity } } })
     if (changed.count !== 1) return { kind: 'insufficient-stock' as const }
 
-    const purchase = await tx.stockPurchase.create({ data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, quantity: input.quantity, totalCostCents }, select: purchaseSelection })
+    const purchase = await tx.stockPurchase.create({ data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, imageUrl: product.imageUrl, imagePublicId: product.imagePublicId, quantity: input.quantity, totalCostCents }, select: purchaseSelection })
     return { kind: 'created' as const, purchase }
   })
 }
@@ -89,18 +93,25 @@ export function getReportData(db: Database, userId: string) {
 
 const RETENTION_MS = 10 * 24 * 60 * 60 * 1000
 
-export async function purgeExpiredDeletedStockData(db: Database, userId?: string, now = new Date()) {
+export async function purgeExpiredDeletedStockData(db: PrismaClient, userId?: string, now = new Date()) {
   const expiresBefore = new Date(now.getTime() - RETENTION_MS)
   const where = { ...(userId ? { userId } : {}), deletedAt: { not: null, lt: expiresBefore } }
-  const expenses = await db.expense.deleteMany({ where })
-  const purchases = await db.stockPurchase.deleteMany({ where })
-  const products = await db.product.deleteMany({ where: { ...where, expenses: { none: {} }, stockPurchases: { none: {} } } })
-  return { expenses: expenses.count, purchases: purchases.count, products: products.count }
+  const result = await db.$transaction(async (tx) => {
+    const purchaseImages = await tx.stockPurchase.findMany({ where, select: { imagePublicId: true } })
+    const expenses = await tx.expense.deleteMany({ where })
+    const purchases = await tx.stockPurchase.deleteMany({ where })
+    const productWhere = { ...where, expenses: { none: {} }, stockPurchases: { none: {} } }
+    const productImages = await tx.product.findMany({ where: productWhere, select: { imagePublicId: true } })
+    const products = await tx.product.deleteMany({ where: productWhere })
+    return { expenses: expenses.count, purchases: purchases.count, products: products.count, images: [...purchaseImages, ...productImages].map((image) => image.imagePublicId) }
+  })
+  await cleanupImages(result.images)
+  return { expenses: result.expenses, purchases: result.purchases, products: result.products }
 }
 
 export async function deleteStockData(db: PrismaClient, userId: string) {
+  await purgeExpiredDeletedStockData(db, userId)
   return db.$transaction(async (tx) => {
-    await purgeExpiredDeletedStockData(tx, userId)
     const deletedAt = new Date()
     const products = await tx.product.updateMany({ where: { userId, deletedAt: null }, data: { active: false, deletedAt, updatedAt: deletedAt } })
     await tx.expense.updateMany({ where: { userId, deletedAt: null }, data: { deletedAt, updatedAt: deletedAt } })
@@ -109,14 +120,21 @@ export async function deleteStockData(db: PrismaClient, userId: string) {
   })
 }
 
-export function deletePurchase(db: Database, userId: string, purchaseId: string) {
-  return db.stockPurchase.deleteMany({ where: { id: purchaseId, userId, deletedAt: null } })
+export async function deletePurchase(db: PrismaClient, userId: string, purchaseId: string) {
+  const result = await db.$transaction(async (tx) => {
+    const where = { id: purchaseId, userId, deletedAt: null }
+    const purchase = await tx.stockPurchase.findFirst({ where, select: { imagePublicId: true } })
+    const deleted = await tx.stockPurchase.deleteMany({ where })
+    return { deleted, image: purchase?.imagePublicId }
+  })
+  await cleanupImages([result.image])
+  return result.deleted
 }
 
 export async function createPurchases(db: PrismaClient, userId: string, inputs: Array<{ productId: string; quantity: number }>) {
   try {
     return await db.$transaction(async (tx) => {
-      const products = await Promise.all(inputs.map((input) => tx.product.findFirst({ where: { id: input.productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true, priceCents: true, stockQuantity: true } })))
+      const products = await Promise.all(inputs.map((input) => tx.product.findFirst({ where: { id: input.productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true, priceCents: true, stockQuantity: true, imageUrl: true, imagePublicId: true } })))
       if (products.some((product) => !product)) return { kind: 'product-not-found' as const }
       const validProducts = products as Array<NonNullable<(typeof products)[number]>>
       if (validProducts.some((product) => (product.priceCents ?? 0) <= 0)) return { kind: 'product-price-missing' as const }
@@ -126,9 +144,9 @@ export async function createPurchases(db: PrismaClient, userId: string, inputs:
       const purchases = []
       for (const [index, product] of validProducts.entries()) {
         const input = inputs[index]!
-        const changed = await tx.product.updateMany({ where: { id: product.id, userId, active: true, deletedAt: null, stockQuantity: { gte: input.quantity } }, data: { stockQuantity: { decrement: input.quantity } } })
+        const changed = await tx.product.updateMany({ where: { id: product.id, userId, active: true, deletedAt: null, imagePublicId: product.imagePublicId ?? null, stockQuantity: { gte: input.quantity } }, data: { stockQuantity: { decrement: input.quantity } } })
         if (changed.count !== 1) throw new Error('insufficient-stock')
-        purchases.push(await tx.stockPurchase.create({ data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, quantity: input.quantity, totalCostCents: product.priceCents! * input.quantity }, select: purchaseSelection }))
+        purchases.push(await tx.stockPurchase.create({ data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, imageUrl: product.imageUrl, imagePublicId: product.imagePublicId, quantity: input.quantity, totalCostCents: product.priceCents! * input.quantity }, select: purchaseSelection }))
       }
       return { kind: 'created' as const, purchases }
     })
diff --git a/server/modules/stock/service.test.ts b/server/modules/stock/service.test.ts
index d0aebcf..6bd5be1 100644
--- a/server/modules/stock/service.test.ts
+++ b/server/modules/stock/service.test.ts
@@ -11,6 +11,7 @@ const mocks = vi.hoisted(() => ({
 }))
 
 vi.mock('./data-access.js', () => ({ ...mocks, database: {} }))
+vi.mock('../notifications/service.js', () => ({ notifyStock: vi.fn().mockResolvedValue(undefined) }))
 
 import { createPurchase, deletePurchase, deleteStockData, exportPurchasesCsv, exportStockCsv, listPurchases, listStock, monthRange, parseCost, replenishStock } from './service.js'
 
@@ -30,8 +31,8 @@ describe('stock service', () => {
     mocks.listStock.mockResolvedValue([product])
     mocks.listPurchases.mockResolvedValue([purchase])
 
-    await expect(listStock('user-a')).resolves.toEqual([{ id: 'product-id', name: 'widget', category: 'hardware', price: '6.25', originalPrice: null, stockQuantity: 4, updatedAt: '2026-10-02T00:00:00.000Z' }])
-    await expect(listPurchases('user-a')).resolves.toEqual([{ id: 'purchase-id', productId: 'product-id', productName: 'widget', category: 'hardware', quantity: 2, totalCost: '12.50', purchasedAt: '2026-10-02T00:00:00.000Z' }])
+    await expect(listStock('user-a')).resolves.toEqual([{ imageUrl: null, id: 'product-id', name: 'widget', category: 'hardware', price: '6.25', originalPrice: null, stockQuantity: 4, updatedAt: '2026-10-02T00:00:00.000Z' }])
+    await expect(listPurchases('user-a')).resolves.toEqual([{ imageUrl: null, id: 'purchase-id', productId: 'product-id', productName: 'widget', category: 'hardware', quantity: 2, totalCost: '12.50', purchasedAt: '2026-10-02T00:00:00.000Z' }])
     expect(mocks.listStock).toHaveBeenCalledWith({}, 'user-a')
     expect(mocks.listPurchases).toHaveBeenCalledWith({}, 'user-a')
   })
diff --git a/server/modules/stock/service.ts b/server/modules/stock/service.ts
index 9cbde35..ced5629 100644
--- a/server/modules/stock/service.ts
+++ b/server/modules/stock/service.ts
@@ -2,20 +2,20 @@ import type { Product, StockPurchase } from '@prisma/client'
 import { notifyStock } from '../notifications/service.js'
 import { adjustStock as adjustStockRecord, createPurchase as createPurchaseRecord, createPurchases as createPurchasesRecord, database, deletePurchase as deletePurchaseRecord, deleteStockData as deleteStockDataRecord, getReportData, listPurchases as listPurchaseRecords, listStock as listStockRecords, setStockQuantity as setStockQuantityRecord } from './data-access.js'
 
-export type StockProductResponse = { id: string; name: string; category: string; price: string; originalPrice: string | null; stockQuantity: number; updatedAt: string }
-export type PurchaseResponse = { id: string; productId: string; productName: string; category: string; quantity: number; totalCost: string; purchasedAt: string }
+export type StockProductResponse = { imageUrl: string | null; id: string; name: string; category: string; price: string; originalPrice: string | null; stockQuantity: number; updatedAt: string }
+export type PurchaseResponse = { imageUrl: string | null; id: string; productId: string; productName: string; category: string; quantity: number; totalCost: string; purchasedAt: string }
 export type ReportRange = { from: Date; to: Date }
 
 function centsToMoney(cents: number): string {
   return (cents / 100).toFixed(2)
 }
 
-function toProductResponse(product: Pick<Product, 'id' | 'name' | 'category' | 'priceCents' | 'originalPriceCents' | 'stockQuantity' | 'updatedAt'>): StockProductResponse {
-  return { id: product.id, name: product.name, category: product.category, price: ((product.priceCents ?? 0) / 100).toFixed(2), originalPrice: product.originalPriceCents == null ? null : (product.originalPriceCents / 100).toFixed(2), stockQuantity: product.stockQuantity, updatedAt: product.updatedAt.toISOString() }
+function toProductResponse(product: Pick<Product, 'imageUrl' | 'id' | 'name' | 'category' | 'priceCents' | 'originalPriceCents' | 'stockQuantity' | 'updatedAt'>): StockProductResponse {
+  return { imageUrl: product.imageUrl ?? null, id: product.id, name: product.name, category: product.category, price: ((product.priceCents ?? 0) / 100).toFixed(2), originalPrice: product.originalPriceCents == null ? null : (product.originalPriceCents / 100).toFixed(2), stockQuantity: product.stockQuantity, updatedAt: product.updatedAt.toISOString() }
 }
 
-function toPurchaseResponse(purchase: Pick<StockPurchase, 'id' | 'productId' | 'productNameSnapshot' | 'categorySnapshot' | 'quantity' | 'totalCostCents' | 'purchasedAt'>): PurchaseResponse {
-  return { id: purchase.id, productId: purchase.productId, productName: purchase.productNameSnapshot, category: purchase.categorySnapshot, quantity: purchase.quantity, totalCost: centsToMoney(purchase.totalCostCents), purchasedAt: purchase.purchasedAt.toISOString() }
+function toPurchaseResponse(purchase: Pick<StockPurchase, 'imageUrl' | 'id' | 'productId' | 'productNameSnapshot' | 'categorySnapshot' | 'quantity' | 'totalCostCents' | 'purchasedAt'>): PurchaseResponse {
+  return { imageUrl: purchase.imageUrl ?? null, id: purchase.id, productId: purchase.productId, productName: purchase.productNameSnapshot, category: purchase.categorySnapshot, quantity: purchase.quantity, totalCost: centsToMoney(purchase.totalCostCents), purchasedAt: purchase.purchasedAt.toISOString() }
 }
 
 export function parseCost(value: string): number {
@@ -35,7 +35,7 @@ export async function replenishStock(userId: string, productId: string, quantity
   const outcome = await adjustStockRecord(database, userId, productId, quantity, deductEarnings, deductEarnings && originalCost !== undefined ? parseCost(originalCost) : undefined)
   if (outcome.kind !== 'adjusted') return outcome
   const product = toProductResponse(outcome.product)
-  void notifyStock(userId, 'changed', [{ name: product.name, category: product.category, changes: [{ label: 'Quantity', before: String(outcome.previousQuantity), after: String(product.stockQuantity) }] }])
+  void notifyStock(userId, 'changed', [{ name: product.name, category: product.category, imageUrl: product.imageUrl, changes: [{ label: 'Quantity', before: String(outcome.previousQuantity), after: String(product.stockQuantity) }] }])
   return { kind: outcome.kind, product }
 }
 
@@ -99,6 +99,6 @@ export async function setStockQuantity(userId: string, productId: string, quanti
   const outcome = await setStockQuantityRecord(database, userId, productId, quantity, deductEarnings, deductEarnings && originalCost !== undefined ? parseCost(originalCost) : undefined)
   if (outcome.kind !== 'updated') return outcome
   const product = toProductResponse(outcome.product)
-  void notifyStock(userId, 'changed', [{ name: product.name, category: product.category, changes: [{ label: 'Quantity', before: String(outcome.previousQuantity), after: String(product.stockQuantity) }] }])
+  void notifyStock(userId, 'changed', [{ name: product.name, category: product.category, imageUrl: product.imageUrl, changes: [{ label: 'Quantity', before: String(outcome.previousQuantity), after: String(product.stockQuantity) }] }])
   return { kind: outcome.kind, product }
 }
\ No newline at end of file
diff --git a/FrontEnd/src/components/ImageUpload/ImageUpload.css b/FrontEnd/src/components/ImageUpload/ImageUpload.css
new file mode 100644
index 0000000..a031ea0
--- /dev/null
+++ b/FrontEnd/src/components/ImageUpload/ImageUpload.css
@@ -0,0 +1,5 @@
+.image-upload { display: grid; gap: 10px; border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 12px; padding: 14px; min-width: 0; }
+.image-upload > div { display: flex; align-items: center; gap: 8px; }
+.image-upload input { width: 100%; min-width: 0; }
+.image-upload p { margin: 0; font-size: .85rem; }
+.image-upload [role=alert] { color: #b91c1c; }
\ No newline at end of file
diff --git a/FrontEnd/src/components/ImageUpload/ImageUpload.test.tsx b/FrontEnd/src/components/ImageUpload/ImageUpload.test.tsx
new file mode 100644
index 0000000..ae19bd4
--- /dev/null
+++ b/FrontEnd/src/components/ImageUpload/ImageUpload.test.tsx
@@ -0,0 +1,78 @@
+// @vitest-environment jsdom
+import { act } from 'react'
+import { createRoot, type Root } from 'react-dom/client'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { ImageUpload, imageFileError } from './ImageUpload'
+import { ProductImage } from '../ProductImage/ProductImage'
+
+describe('product image controls', () => {
+  let container: HTMLDivElement
+  let root: Root
+  const create = vi.fn(() => 'blob:preview')
+  const revoke = vi.fn()
+  beforeEach(() => {
+    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
+    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
+    create.mockClear(); revoke.mockClear()
+    container = document.createElement('div'); document.body.append(container)
+    root = createRoot(container)
+  })
+  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
+
+  it('renders accessible placeholders for old/missing and broken photos, recovering on a new URL', async () => {
+    await act(async () => root.render(<ProductImage name="Shirt" />))
+    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('No photo for Shirt')
+    await act(async () => root.render(<ProductImage name="Shirt" src="https://res.cloudinary.com/test/broken.png" />))
+    await act(async () => container.querySelector('img')!.dispatchEvent(new Event('error')))
+    expect(container.querySelector('img')).toBeNull()
+    await act(async () => root.render(<ProductImage name="Shirt" src="https://res.cloudinary.com/test/new.png" />))
+    expect(container.querySelector('img')?.alt).toBe('Shirt photo')
+  })
+
+  it('validates size/type, accepts the exact size boundary and keeps the previous selection on invalid input', async () => {
+    const change = vi.fn()
+    await act(async () => root.render(<ImageUpload file={null} removed={false} onChange={change} onRemove={vi.fn()} />))
+    const input = container.querySelector('input')!
+    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['gif'], 'bad.gif', { type: 'image/gif' })] })
+    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
+    expect(change).not.toHaveBeenCalled()
+    expect(container.querySelector('[role="alert"]')?.textContent).toContain('JPEG, PNG, or WebP')
+    expect(imageFileError(new File([new Uint8Array(3 * 1024 * 1024)], 'ok.png', { type: 'image/png' }))).toBe('')
+    expect(imageFileError(new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))).toContain('3 MB')
+    const photo = new File(['png'], 'ok.png', { type: 'image/png' })
+    Object.defineProperty(input, 'files', { configurable: true, value: [photo] })
+    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
+    expect(change).toHaveBeenCalledWith(photo)
+    expect(input.value).toBe('')
+  })
+
+  it('previews files, removes photos and revokes object URLs on reset and unmount', async () => {
+    const remove = vi.fn()
+    const props = { removed: false, onChange: vi.fn(), onRemove: remove }
+    await act(async () => root.render(<ImageUpload {...props} file={new File(['a'], 'a.png', { type: 'image/png' })} />))
+    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:preview')
+    await act(async () => container.querySelector('button')!.click())
+    expect(remove).toHaveBeenCalledOnce()
+    await act(async () => root.render(<ImageUpload {...props} removed file={null} />))
+    expect(revoke).toHaveBeenCalledWith('blob:preview')
+    expect(container.querySelector('img')).toBeNull()
+    await act(async () => root.render(<ImageUpload {...props} file={new File(['b'], 'b.png', { type: 'image/png' })} />))
+    await act(async () => root.render(<div />))
+    expect(revoke).toHaveBeenCalledTimes(2)
+  })
+
+  it('supports drop selection and disallows multi-file drops', async () => {
+    const change = vi.fn()
+    await act(async () => root.render(<ImageUpload file={null} removed={false} onChange={change} onRemove={vi.fn()} />))
+    const photo = new File(['a'], 'a.png', { type: 'image/png' })
+    async function drop(files: File[]) {
+      const event = new Event('drop', { bubbles: true, cancelable: true })
+      Object.defineProperty(event, 'dataTransfer', { value: { files } })
+      await act(async () => container.querySelector('.image-upload')!.dispatchEvent(event))
+    }
+    await drop([photo, photo])
+    expect(change).not.toHaveBeenCalled()
+    await drop([photo])
+    expect(change).toHaveBeenCalledWith(photo)
+  })
+})
\ No newline at end of file
diff --git a/FrontEnd/src/components/ImageUpload/ImageUpload.tsx b/FrontEnd/src/components/ImageUpload/ImageUpload.tsx
new file mode 100644
index 0000000..d484a30
--- /dev/null
+++ b/FrontEnd/src/components/ImageUpload/ImageUpload.tsx
@@ -0,0 +1,35 @@
+import { useEffect, useId, useState } from 'react'
+import { ProductImage } from '../ProductImage/ProductImage'
+import './ImageUpload.css'
+
+export function imageFileError(file: File): string {
+  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG, or WebP photo.'
+  if (file.size > 3 * 1024 * 1024) return 'Photo must be 3 MB or smaller.'
+  return ''
+}
+
+export function ImageUpload({ file, existingUrl, removed, disabled, onChange, onRemove }: { file: File | null; existingUrl?: string | null; removed: boolean; disabled?: boolean; onChange: (file: File) => void; onRemove: () => void }) {
+  const id = useId()
+  const [preview, setPreview] = useState<string | null>(null)
+  const [error, setError] = useState('')
+  useEffect(() => {
+    if (!file) { setPreview(null); return }
+    const url = URL.createObjectURL(file)
+    setPreview(url)
+    return () => URL.revokeObjectURL(url)
+  }, [file])
+  function choose(candidate?: File) {
+    if (!candidate || disabled) return
+    const issue = imageFileError(candidate)
+    setError(issue)
+    if (!issue) onChange(candidate)
+  }
+  return <div className="image-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length !== 1) { setError('Choose one photo.'); return }; choose(event.dataTransfer.files[0]) }}>
+    <label htmlFor={id}>Product photo (optional)</label>
+    <div><ProductImage src={preview ?? (removed ? null : existingUrl)} name="Product preview" size={80} /><span>Choose or drop a JPEG, PNG, or WebP, up to 3 MB.</span></div>
+    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-describedby={`${id}-help`} onChange={(event) => { choose(event.target.files?.[0]); event.target.value = '' }} />
+    <p id={`${id}-help`}>The same photo is used for each stock in a multiple-stock save.</p>
+    {(file || (existingUrl && !removed)) && <button type="button" disabled={disabled} onClick={() => { setError(''); onRemove() }}>Remove photo</button>}
+    {error && <p role="alert">{error}</p>}
+  </div>
+}
\ No newline at end of file
diff --git a/FrontEnd/src/components/ProductImage/ProductImage.css b/FrontEnd/src/components/ProductImage/ProductImage.css
new file mode 100644
index 0000000..d490713
--- /dev/null
+++ b/FrontEnd/src/components/ProductImage/ProductImage.css
@@ -0,0 +1,3 @@
+.product-photo { display: inline-flex; vertical-align: middle; object-fit: cover; border-radius: 9px; flex-shrink: 0; max-width: 100%; margin-inline-end: 10px; }
+.product-photo-placeholder { align-items: center; justify-content: center; background: color-mix(in srgb, currentColor 8%, transparent); color: inherit; }
+.product-photo-placeholder svg { width: 55%; fill: none; stroke: currentColor; stroke-width: 1.4; }
\ No newline at end of file
diff --git a/FrontEnd/src/components/ProductImage/ProductImage.tsx b/FrontEnd/src/components/ProductImage/ProductImage.tsx
new file mode 100644
index 0000000..651ccfd
--- /dev/null
+++ b/FrontEnd/src/components/ProductImage/ProductImage.tsx
@@ -0,0 +1,9 @@
+import { useState } from 'react'
+import './ProductImage.css'
+
+export function ProductImage({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
+  const [failedSrc, setFailedSrc] = useState<string | null>(null)
+  return src && failedSrc !== src
+    ? <img className="product-photo" src={src} alt={`${name} photo`} width={size} height={size} loading="lazy" onError={() => setFailedSrc(src)} />
+    : <span className="product-photo product-photo-placeholder" role="img" aria-label={`No photo for ${name}`} style={{ width: size, height: size }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 5h18v14H3zM3 16l5-5 5 5 3-3 5 5M16 8h.01" /></svg></span>
+}
\ No newline at end of file
diff --git a/FrontEnd/src/pages/ProductPhotos.test.tsx b/FrontEnd/src/pages/ProductPhotos.test.tsx
new file mode 100644
index 0000000..b2ae9ae
--- /dev/null
+++ b/FrontEnd/src/pages/ProductPhotos.test.tsx
@@ -0,0 +1,66 @@
+// @vitest-environment jsdom
+import { act } from 'react'
+import { createRoot, type Root } from 'react-dom/client'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { ToastProvider } from '../components/Toast/ToastProvider'
+import { DashboardStockTable } from './DashboardStockTable'
+import { StockTrackerPage } from './StockTrackerPage'
+import { PurchaseHistoryPage } from './PurchaseHistoryPage'
+import { SettingsPage } from './SettingsPage'
+
+const product = { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Shirt', category: 'Clothes', price: '10.00', originalPrice: null, stockQuantity: 4, updatedAt: '2026-11-11T00:00:00.000Z', imageUrl: 'https://res.cloudinary.com/test/current.png' }
+const purchase = { id: '123e4567-e89b-12d3-a456-426614174001', productId: product.id, productName: 'Old Shirt', category: 'Old Clothes', quantity: 1, totalCost: '10.00', purchasedAt: product.updatedAt, imageUrl: 'https://res.cloudinary.com/test/snapshot.png' }
+
+describe('product photo page renderers', () => {
+  let container: HTMLDivElement
+  let root: Root
+  beforeEach(() => {
+    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
+    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('/purchases') ? { purchases: [purchase] } : { products: [product] })))
+    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
+  })
+  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
+  async function render(children: React.ReactNode) { await act(async () => root.render(<ToastProvider>{children}</ToastProvider>)) }
+  async function click(text: string) {
+    const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === text)!
+    expect(button).toBeDefined()
+    await act(async () => button.click())
+  }
+  function sources() { return [...container.querySelectorAll('img')].map((image) => image.getAttribute('src')) }
+
+  it('renders dashboard photos and preserves them in edit callbacks', async () => {
+    const edit = vi.fn()
+    await render(<DashboardStockTable onEdit={edit} onDelete={vi.fn()} onAddStock={vi.fn()} />)
+    expect(sources()).toContain(product.imageUrl)
+    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Shirt"]')!.click())
+    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: product.imageUrl }))
+  })
+  it('uses the purchase snapshot rather than the current product image in purchase history', async () => {
+    await render(<PurchaseHistoryPage />)
+    expect(sources()).toEqual([purchase.imageUrl])
+    expect(sources()).not.toContain(product.imageUrl)
+  })
+  it('renders current photos in picker/cart and snapshot photos in bought history', async () => {
+    await render(<StockTrackerPage mode="buy" onChanged={vi.fn()} />)
+    expect(sources()).toEqual([purchase.imageUrl])
+    await act(async () => container.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
+    expect(sources()).toContain(product.imageUrl)
+    await act(async () => container.querySelector<HTMLButtonElement>('[role="option"] button')!.click())
+    const form = container.querySelector('form')!
+    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
+    expect(container.querySelector('[aria-labelledby="cart-heading"] img')?.getAttribute('src')).toBe(product.imageUrl)
+    expect(container.querySelector('[aria-label="Bought product history"] img')?.getAttribute('src')).toBe(purchase.imageUrl)
+  })
+  it('renders available stock photos and keeps them through edit callbacks', async () => {
+    const edit = vi.fn()
+    await render(<StockTrackerPage mode="stock" onChanged={vi.fn()} onEdit={edit} onDelete={vi.fn()} />)
+    expect(container.querySelector('[aria-label="Available stock"] img')?.getAttribute('src')).toBe(product.imageUrl)
+    await click('Edit')
+    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: product.imageUrl }))
+  })
+  it('renders archived photos alongside recovery actions', async () => {
+    await render(<SettingsPage archivedProducts={[{ ...product, archivedAt: product.updatedAt, deletedAt: null }]} onStockDeleted={vi.fn()} onHistoryChanged={vi.fn()} onProfitChanged={vi.fn()} />)
+    expect(sources()).toEqual([product.imageUrl])
+    expect(container.textContent).toContain('Restore')
+  })
+})
\ No newline at end of file
diff --git a/_bmad-output/implementation-artifacts/spec-product-photo-upload.md b/_bmad-output/implementation-artifacts/spec-product-photo-upload.md
new file mode 100644
index 0000000..9e5838e
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-product-photo-upload.md
@@ -0,0 +1,89 @@
+---
+title: 'Cloudinary product photos with immutable purchase snapshots'
+type: 'feature'
+created: '2026-11-11'
+status: 'in-review'
+route: 'dispatch'
+baseline_commit: '0d164984675c639c6d0a4f35d580577e59fc4e27'
+review_loop_iteration: 0
+context: []
+---
+
+<frozen-after-approval reason="Approved plan and decisions from user on 2026-11-11">
+
+## Intent
+
+Add optional Cloudinary-backed product photos across product management, inventory, purchasing, history, archived products, and stock notification emails. Purchase images are immutable snapshots, like existing name/category snapshots.
+
+## Boundaries & Constraints
+
+Always preserve tenant isolation, session/same-origin checks, stale-write protection, atomic bulk behavior, existing calculations, and JSON compatibility. Upload JPEG/PNG/WebP only, maximum 3 MB, using memory multipart handling and Cloudinary folder `asimon/products` with optimized quality/format. Validate actual image bytes as well as declared type. No client-controlled Cloudinary public IDs or remote image URLs for persistence.
+
+Add nullable `imageUrl` and `imagePublicId` to both Product and StockPurchase in one migration. Copy both from Product when purchases are created (single and checkout). Backfill existing purchases from matching tenant-owned product images. History displays its own snapshot URL with placeholder fallback.
+
+Delete remote assets only if their public ID has zero references in BOTH Product and StockPurchase, including archived/soft-deleted records, across all tenants. Apply this after replacement/removal, failed saves of fresh uploads, permanent product deletion, purchase deletion, bulk flows, delete-all/clear history paths, and retention purge. Collect candidates before deleting rows and check references after committed persistence, outside database transactions. Cloudinary/check failures are logged and never undo or throw through successful product actions. Archive/restore and recoverable delete-all preserve images while references remain. No network calls inside database transactions.
+
+If replacement upload fails, retain old image, save product details successfully, and return a photo warning displayed in a toast. Failed create photo uploads similarly allow product creation. Missing Cloudinary configuration must not crash startup: requests attempting upload return explicit 503. Invalid/oversized files produce clear 400/413 errors without product mutation.
+
+CSP adds only `https://res.cloudinary.com` as external image origin, never a wildcard; preserve required self/data/blob sources for previews. NEVER read, search, print, or edit `.env` values. Only modify Cloudinary validation in config and placeholders in `.env.example`. Do not deploy, migrate a live database, commit, push, or perform live Cloudinary operations for verification.
+
+</frozen-after-approval>
+
+## Code Map
+
+- `prisma/schema.prisma`, `prisma/migrations/` — mapped SQL fields and timestamped migrations.
+- `server/infrastructure/config.ts`, `server/app.ts` — optional env config, Helmet CSP, JSON and error envelopes.
+- `server/modules/products/{routes,service,data-access}.ts` — JSON create/bulk/update, stale-write checks, archive/restore/permanent delete. Public responses must not expose public IDs.
+- `server/modules/stock/{routes,service,data-access}.ts`, `server/index.ts` — explicit stock/purchase selects, checkout snapshots, deletePurchase, recoverable deleteStockData, scheduled purge. Inspect all deletion entry points; frontend bulk calls existing single endpoints.
+- `FrontEnd/src/App.tsx` — product type, API wrapper currently forces JSON, shared add/edit/bulk modal, archive confirmation.
+- `FrontEnd/src/pages/{DashboardStockTable,StockTrackerPage,PurchaseHistoryPage,SettingsPage}.tsx` — independent types/Zod schemas; render product names in lists/tables, picker selection/options, cart, bought history, archived catalog; quantity/insufficient-stock dialogs.
+- `server/modules/notifications/service.ts` — escaped HTML rendering and optional image notification payloads. Product/stock services build event items.
+- `package.json`, `package-lock.json`, `.env.example`, `README.md` — dependencies and setup; `.env` exists and must not be read.
+
+## Tasks & Acceptance
+
+Execute sequentially in this order:
+
+- [x] `prisma/schema.prisma` and new migration — add both nullable image fields to both models, indexes supporting reference checks, tenant-safe backfill SQL.
+- [x] `server/infrastructure/config.ts` and new image/upload helper — optional config; Cloudinary and Multer dependencies/types; bounded memory/files/fields; clear unavailable and validation errors; optimized upload; best-effort reference-aware cleanup.
+- [x] Product and stock routes/services/data access — authenticated multipart create/update/bulk with shared bulk photo and independently owned uploaded assets (avoid premature cleanup); preserve JSON requests; remove-image flag; warning response; stale/duplicate/error cleanup; snapshot fields and all deletion/purge cleanup paths. Keep IDs internal.
+- [x] New `FrontEnd/src/components/ProductImage/` and `ImageUpload/` components/CSS — accessible responsive image with missing/broken placeholder; file selection/drop/preview/removal, validation and object URL cleanup.
+- [x] `App.tsx` and listed pages — FormData only when needed, do not set multipart Content-Type manually, add/edit/bulk image state, photo warnings toast, preserve images through edit callbacks, render photos wherever a product appears including picker/cart/history/archive and relevant dialogs. Snapshot schemas must retain own image URL, not join current product image.
+- [x] Notification service and event producers — escaped optional trusted Cloudinary images in HTML; plain-text messages remain readable; failed remote images do not affect messages.
+- [x] Focused backend/frontend tests plus `README.md`, `.env.example`, `server/app.ts` — document local/production migration commands and Cloudinary setup, targeted CSP. Test upload validation, missing config, replacement failure, removal, stale/duplicate rollback cleanup, immutable single/checkout snapshots, referenced/unreferenced assets, deletion/purge, UI fallback/preview/reset/toasts and renderers.
+
+Acceptance criteria:
+- Given no photo, when old products/history render, then placeholders work and existing functionality remains intact.
+- Given a valid photo, when creating/editing/bulk-adding, then optimized Cloudinary URL persists and appears in product screens and emails.
+- Given a purchase snapshot, when the product photo changes or is removed, then history remains unchanged and its referenced asset is retained.
+- Given an unused asset, when deletion/replacement/purge completes, then cleanup checks both tables and attempts remote deletion without making successful persistence fail.
+- Given absent Cloudinary config, when server starts, then startup succeeds; when upload is requested, then a clear 503 is returned.
+- Given Cloudinary upload failure with configured credentials, when saving details, then details save, old photo is retained and a warning toast explains the failure.
+
+## Implementation Notes
+
+User approved the findings/plan and supplied final snapshot/cleanup/config decisions before implementation. Do not execute live database migrations; supply deployment steps.
+
+## Spec Change Log
+
+## Review Triage Log
+
+## Verification
+
+- `npx prisma generate` — generated client updated without live database mutation.
+- `npm run typecheck` — successful server and frontend checks.
+- `npm run build` — successful production builds.
+- `npm test` — all deterministic Vitest tests pass; explicitly report opt-in skips.
+- Inspect diff and check editor diagnostics; independently review security, cleanup semantics, snapshot consistency, and verification coverage.
+
+### Execution evidence — 2026-11-11
+
+- Prisma client generation succeeded; no migration/deployment or live Cloudinary operation was performed. No `.env` values were inspected or modified.
+- `npm run typecheck` passed; `npm run build` passed for frontend and server (including a final typecheck).
+- Final `npm test`: **221 passed**, **1 skipped**, across 31 passing test files and one skipped test file. The skipped test is the opt-in Mailpit/PostgreSQL authentication flow, intentionally not enabled.
+- Editor diagnostics: no errors. `git diff --check`: passed (Git notes LF/CRLF normalization for `FrontEnd/src/App.tsx`).
+- Added real localhost multipart HTTP tests with mocked persistence/Cloudinary, decoded image validation, limits, same-origin/session checks, unavailable config, warning fallback, client-ID/URL rejection, stale/duplicate cleanup, single/checkout snapshot and cleanup-order tests, trusted email/CSP checks, component preview/fallback/reset tests, App FormData/warning tests, and page current/snapshot renderers.
+- Snapshot creation conditionally matches the captured asset ID while decrementing stock, preventing a concurrent photo replacement from publishing an already-unreferenced asset into history.
+- Independent review is **pending**: this runtime cannot launch the required context-free reviewer agents. Standalone review handoffs are prepared separately; do not treat the passing deterministic checks as a completed independent review.
+- Operator follow-up: apply the migration deliberately and configure server-side Cloudinary credentials as documented in [README.md](../../README.md). Live PostgreSQL migration/backfill, browser visual checks, and actual Cloudinary delivery/deletion remain unverified by design.
+- Environment risks observed during install: local Node `24.13.0` is below the project's declared `>=24.21.0`; npm reported 13 dependency vulnerabilities (3 moderate, 7 high, 3 critical). No unrelated dependency remediation was attempted. Cleanup is best-effort/logged with no durable orphan retry queue; shared bulk photos require independent remote uploads and may increase save latency.
\ No newline at end of file
diff --git a/prisma/migrations/20261111000000_product_photos/migration.sql b/prisma/migrations/20261111000000_product_photos/migration.sql
new file mode 100644
index 0000000..7ef8cf5
--- /dev/null
+++ b/prisma/migrations/20261111000000_product_photos/migration.sql
@@ -0,0 +1,8 @@
+ALTER TABLE "products" ADD COLUMN "image_url" TEXT, ADD COLUMN "image_public_id" TEXT;
+ALTER TABLE "stock_purchases" ADD COLUMN "image_url" TEXT, ADD COLUMN "image_public_id" TEXT;
+CREATE INDEX "products_image_public_id_idx" ON "products"("image_public_id");
+CREATE INDEX "stock_purchases_image_public_id_idx" ON "stock_purchases"("image_public_id");
+UPDATE "stock_purchases" AS purchase
+SET "image_url" = product."image_url", "image_public_id" = product."image_public_id"
+FROM "products" AS product
+WHERE purchase."product_id" = product."id" AND purchase."user_id" = product."user_id";
\ No newline at end of file
diff --git a/server/infrastructure/images.test.ts b/server/infrastructure/images.test.ts
new file mode 100644
index 0000000..09794af
--- /dev/null
+++ b/server/infrastructure/images.test.ts
@@ -0,0 +1,130 @@
+import { Writable } from 'node:stream'
+import express from 'express'
+import sharp from 'sharp'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+
+const mocks = vi.hoisted(() => ({
+  config: { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' },
+  upload: vi.fn(), destroy: vi.fn(), configure: vi.fn(), products: vi.fn(), purchases: vi.fn(), log: vi.fn(),
+}))
+vi.mock('./config.js', () => ({ config: mocks.config }))
+vi.mock('./prisma.js', () => ({ prisma: { product: { count: mocks.products }, stockPurchase: { count: mocks.purchases } } }))
+vi.mock('./logger.js', () => ({ logError: mocks.log }))
+vi.mock('cloudinary', () => ({ v2: { config: mocks.configure, uploader: { upload_stream: mocks.upload, destroy: mocks.destroy } } }))
+
+import { cleanupImages, ImageError, PHOTO_WARNING, productUpload, uploadImage, validateImage, withProductPhotos } from './images.js'
+
+async function file(format: 'png' | 'jpeg' | 'webp' = 'png') {
+  const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff00aa' } }).toFormat(format).toBuffer()
+  return { buffer, mimetype: `image/${format}`, size: buffer.length } as Express.Multer.File
+}
+
+describe('product image boundary', () => {
+  beforeEach(() => {
+    vi.clearAllMocks()
+    mocks.config.CLOUDINARY_API_SECRET = 'test-secret'
+    mocks.products.mockResolvedValue(0)
+    mocks.purchases.mockResolvedValue(0)
+    mocks.destroy.mockResolvedValue({ result: 'ok' })
+    let sequence = 0
+    mocks.upload.mockImplementation((_options, callback) => new Writable({ write(_chunk, _encoding, done) { done() }, final(done) {
+      sequence++
+      callback(null, { secure_url: `https://res.cloudinary.com/test/image/upload/${sequence}.png`, public_id: `asimon/products/${sequence}` })
+      done()
+    } }))
+  })
+  afterEach(() => vi.restoreAllMocks())
+
+  it.each(['jpeg', 'png', 'webp'] as const)('decodes valid %s bytes', async (format) => {
+    await expect(validateImage(await file(format))).resolves.toBeUndefined()
+  })
+  it('rejects spoofed MIME, corrupt bytes and truncated files before upload', async () => {
+    const png = await file()
+    for (const candidate of [{ ...png, mimetype: 'image/jpeg' }, { ...png, buffer: Buffer.from('not an image') }, { ...png, buffer: png.buffer.subarray(0, 40) }]) {
+      await expect(validateImage(candidate)).rejects.toMatchObject({ status: 400, code: 'INVALID_IMAGE' })
+    }
+    expect(mocks.upload).not.toHaveBeenCalled()
+  })
+  it('allows startup/JSON saves but returns explicit 503 for uploads without configuration', async () => {
+    mocks.config.CLOUDINARY_API_SECRET = ''
+    await expect(validateImage()).resolves.toBeUndefined()
+    await expect(validateImage(await file())).rejects.toMatchObject({ status: 503, code: 'PHOTO_UNAVAILABLE' })
+  })
+  it('enforces the actual byte-size limit even when called without multipart middleware', async () => {
+    await expect(validateImage({ buffer: Buffer.alloc(3 * 1024 * 1024 + 1), mimetype: 'image/png' } as Express.Multer.File)).rejects.toMatchObject({ status: 413 })
+    expect(mocks.upload).not.toHaveBeenCalled()
+  })
+  it('uses the server-owned folder and optimized image settings', async () => {
+    await expect(uploadImage(await file())).resolves.toMatchObject({ imagePublicId: 'asimon/products/1' })
+    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ folder: 'asimon/products', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] }), expect.any(Function))
+    expect(mocks.upload.mock.calls[0][0]).not.toHaveProperty('public_id')
+  })
+  it('keeps details save and returns a warning when a configured upload fails', async () => {
+    mocks.upload.mockImplementation(() => { throw new Error('offline') })
+    const save = vi.fn(async (photos, warning) => ({ photos, warning }))
+    await expect(withProductPhotos(await file(), 1, save)).resolves.toEqual({ photos: [undefined], warning: PHOTO_WARNING })
+    expect(save).toHaveBeenCalledOnce()
+    expect(mocks.log).toHaveBeenCalledWith('image_upload_failed', expect.any(Error))
+  })
+  it('gives each bulk product an independently owned image and cleans only after save', async () => {
+    await withProductPhotos(await file(), 2, async (photos) => {
+      expect(photos.map((photo) => photo?.imagePublicId)).toEqual(['asimon/products/1', 'asimon/products/2'])
+      expect(mocks.products).not.toHaveBeenCalled()
+      mocks.products.mockResolvedValue(1)
+    })
+    expect(mocks.destroy).not.toHaveBeenCalled()
+  })
+  it.each(['stale', 'duplicate', 'not-found'])('cleans fresh uploads after a %s save outcome', async (kind) => {
+    await withProductPhotos(await file(), 1, async () => ({ kind }))
+    expect(mocks.destroy).toHaveBeenCalledWith('asimon/products/1', { resource_type: 'image' })
+  })
+  it('cleans every fresh bulk upload after transactional persistence rejects', async () => {
+    await expect(withProductPhotos(await file(), 2, async () => { throw new Error('rollback') })).rejects.toThrow('rollback')
+    expect(mocks.destroy).toHaveBeenCalledTimes(2)
+  })
+  it.each([[1, 0], [0, 1], [1, 1]])('retains global product/purchase references (%i/%i), including hidden records', async (products, purchases) => {
+    mocks.products.mockResolvedValue(products)
+    mocks.purchases.mockResolvedValue(purchases)
+    await cleanupImages(['shared'])
+    expect(mocks.products).toHaveBeenCalledWith({ where: { imagePublicId: 'shared' } })
+    expect(mocks.purchases).toHaveBeenCalledWith({ where: { imagePublicId: 'shared' } })
+    expect(mocks.destroy).not.toHaveBeenCalled()
+  })
+  it('deduplicates unused assets and isolates both reference-check and destroy failures', async () => {
+    await cleanupImages([null, undefined, 'unused', 'unused'])
+    expect(mocks.destroy).toHaveBeenCalledTimes(1)
+    mocks.products.mockRejectedValueOnce(new Error('database offline'))
+    await expect(cleanupImages(['unknown'])).resolves.toBeUndefined()
+    expect(mocks.destroy).toHaveBeenCalledTimes(1)
+    mocks.destroy.mockRejectedValueOnce(new Error('remote offline'))
+    await expect(cleanupImages(['unused-again'])).resolves.toBeUndefined()
+    expect(mocks.log).toHaveBeenCalledTimes(2)
+  })
+
+  it('enforces multipart file type, 3 MB limit, and one-file bound before saving', async () => {
+    const app = express()
+    const save = vi.fn()
+    app.post('/', productUpload, (req, res) => { save(); res.json({ size: req.file?.size }) })
+    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
+      const imageError = error as ImageError
+      res.status(imageError.status ?? 500).json({ message: imageError.message })
+    })
+    const server = app.listen(0, '127.0.0.1')
+    await new Promise<void>((resolve) => server.once('listening', resolve))
+    const address = server.address() as { port: number }
+    try {
+      for (const [type, bytes, count, status] of [['image/gif', 10, 1, 400], ['image/png', 3 * 1024 * 1024 + 1, 1, 413], ['image/png', 10, 2, 400]] as const) {
+        const body = new FormData()
+        for (let index = 0; index < count; index++) body.append('image', new Blob([new Uint8Array(bytes)], { type }), 'photo')
+        const response = await fetch(`http://127.0.0.1:${address.port}/`, { method: 'POST', body })
+        expect(response.status).toBe(status)
+      }
+      expect(save).not.toHaveBeenCalled()
+      const body = new FormData()
+      const png = await file()
+      body.append('image', new Blob([new Uint8Array(png.buffer)], { type: 'image/png' }), 'photo.png')
+      expect((await fetch(`http://127.0.0.1:${address.port}/`, { method: 'POST', body })).status).toBe(200)
+      expect(save).toHaveBeenCalledOnce()
+    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
+  })
+})
\ No newline at end of file
diff --git a/server/infrastructure/images.ts b/server/infrastructure/images.ts
new file mode 100644
index 0000000..72bcc3a
--- /dev/null
+++ b/server/infrastructure/images.ts
@@ -0,0 +1,78 @@
+import multer from 'multer'
+import sharp from 'sharp'
+import { v2 as cloudinary } from 'cloudinary'
+import type { RequestHandler } from 'express'
+import { config } from './config.js'
+import { prisma } from './prisma.js'
+import { logError } from './logger.js'
+
+export type ImageFields = { imageUrl: string | null; imagePublicId: string | null }
+export class ImageError extends Error {
+  constructor(public status: number, public code: string, message: string) { super(message) }
+}
+const types = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' } as const
+const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 8, fieldSize: 64 * 1024, parts: 9 }, fileFilter: (_req, file, done) => {
+  if (!(file.mimetype in types)) return done(new ImageError(400, 'INVALID_IMAGE', 'Choose a JPEG, PNG, or WebP photo.'))
+  done(null, true)
+} }).single('image')
+export const productUpload: RequestHandler = (req, res, next) => parser(req, res, (error: unknown) => {
+  if (error instanceof multer.MulterError) return next(new ImageError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'INVALID_IMAGE', error.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 3 MB or smaller.' : 'Invalid photo upload.'))
+  if (error && !(error instanceof ImageError)) return next(new ImageError(400, 'INVALID_IMAGE', 'Invalid multipart photo upload.'))
+  return next(error)
+})
+
+export async function validateImage(file?: Express.Multer.File): Promise<void> {
+  if (!file) return
+  if (file.buffer.length > 3 * 1024 * 1024) throw new ImageError(413, 'INVALID_IMAGE', 'Photo must be 3 MB or smaller.')
+  try {
+    const image = sharp(file.buffer, { limitInputPixels: 40_000_000, animated: false })
+    const metadata = await image.metadata()
+    if (metadata.format !== types[file.mimetype as keyof typeof types]) throw new Error('type mismatch')
+    await image.stats() // Decode actual pixels, not just the supplied MIME type/header.
+  } catch { throw new ImageError(400, 'INVALID_IMAGE', 'Photo bytes must be a valid JPEG, PNG, or WebP matching its type.') }
+  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
+    throw new ImageError(503, 'PHOTO_UNAVAILABLE', 'Photo uploads are unavailable: Cloudinary is not configured.')
+  }
+}
+
+export async function uploadImage(file: Express.Multer.File): Promise<ImageFields> {
+  cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET })
+  return new Promise((resolve, reject) => {
+    const stream = cloudinary.uploader.upload_stream({ folder: 'asimon/products', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }], timeout: 30_000 }, (error, result) => {
+      if (error || !result) return reject(error ?? new Error('Missing upload result'))
+      resolve({ imageUrl: result.secure_url, imagePublicId: result.public_id })
+    })
+    stream.on('error', reject)
+    stream.end(file.buffer)
+  })
+}
+
+// Global reference checks deliberately include archived/deleted rows and all tenants.
+export async function cleanupImages(candidates: Array<string | null | undefined>): Promise<void> {
+  for (const publicId of new Set(candidates.filter((id): id is string => Boolean(id)))) {
+    try {
+      const [products, purchases] = await Promise.all([
+        prisma.product.count({ where: { imagePublicId: publicId } }),
+        prisma.stockPurchase.count({ where: { imagePublicId: publicId } }),
+      ])
+      if (products || purchases) continue
+      cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET })
+      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
+    } catch (error) { logError('image_cleanup_failed', error) }
+  }
+}
+
+export const PHOTO_WARNING = 'Product details saved, but the photo could not be uploaded. Please try again.'
+
+export async function withProductPhotos<T>(file: Express.Multer.File | undefined, count: number, save: (photos: Array<ImageFields | undefined>, warning?: string) => Promise<T>): Promise<T> {
+  await validateImage(file)
+  const photos: Array<ImageFields | undefined> = []
+  let warning: string | undefined
+  try {
+    for (let index = 0; index < count; index++) {
+      try { photos.push(file ? await uploadImage(file) : undefined) }
+      catch (error) { logError('image_upload_failed', error); warning = PHOTO_WARNING; photos.push(undefined) }
+    }
+    return await save(photos, warning)
+  } finally { await cleanupImages(photos.map((photo) => photo?.imagePublicId)) }
+}
\ No newline at end of file
diff --git a/server/modules/products/photos.test.ts b/server/modules/products/photos.test.ts
new file mode 100644
index 0000000..206f1ae
--- /dev/null
+++ b/server/modules/products/photos.test.ts
@@ -0,0 +1,118 @@
+import { Writable } from 'node:stream'
+import express from 'express'
+import sharp from 'sharp'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+
+const mocks = vi.hoisted(() => ({
+  config: { APP_ORIGIN: 'http://localhost:5173', CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test' },
+  createProduct: vi.fn(), createProducts: vi.fn(), updateProduct: vi.fn(), upload: vi.fn(), destroy: vi.fn(), count: vi.fn(),
+}))
+vi.mock('../../infrastructure/config.js', () => ({ config: mocks.config }))
+vi.mock('../../infrastructure/prisma.js', () => ({ prisma: { product: { count: mocks.count }, stockPurchase: { count: mocks.count } } }))
+vi.mock('../../infrastructure/logger.js', () => ({ logError: vi.fn() }))
+vi.mock('cloudinary', () => ({ v2: { config: vi.fn(), uploader: { upload_stream: mocks.upload, destroy: mocks.destroy } } }))
+vi.mock('./service.js', () => ({ ...mocks, listProducts: vi.fn(), archiveProduct: vi.fn(), permanentlyDeleteArchivedProduct: vi.fn(), restoreArchivedProduct: vi.fn() }))
+import { productsRouter } from './routes.js'
+import { ImageError, PHOTO_WARNING } from '../../infrastructure/images.js'
+
+describe('authenticated multipart product saves', () => {
+  let server: ReturnType<express.Express['listen']>
+  let base: string
+  beforeEach(async () => {
+    vi.clearAllMocks()
+    mocks.config.CLOUDINARY_API_SECRET = 'test'
+    mocks.count.mockResolvedValue(0)
+    mocks.destroy.mockResolvedValue({ result: 'ok' })
+    let sequence = 0
+    mocks.upload.mockImplementation((_options, callback) => new Writable({ write(_chunk, _encoding, done) { done() }, final(done) {
+      sequence++
+      callback(null, { secure_url: `https://res.cloudinary.com/test/${sequence}.png`, public_id: `test/${sequence}` })
+      done()
+    } }))
+    mocks.createProduct.mockImplementation(async (_user, input) => ({ kind: 'created', product: { name: input.name, imageUrl: input.imageUrl ?? null } }))
+    mocks.createProducts.mockImplementation(async (_user, inputs) => ({ kind: 'created', products: inputs.map((input: { name: string; imageUrl?: string }) => ({ name: input.name, imageUrl: input.imageUrl ?? null })) }))
+    mocks.updateProduct.mockImplementation(async (_user, _id, input) => ({ kind: 'updated', product: { name: input.name, imageUrl: input.imageUrl ?? 'https://res.cloudinary.com/test/old.png' } }))
+    const app = express()
+    app.use(express.json())
+    app.use((req, _res, next) => { if (req.get('x-test-session') === 'yes') req.userId = 'user-a'; next() })
+    app.use('/products', productsRouter)
+    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
+      const photoError = error as ImageError
+      res.status(photoError.status ?? 500).json({ error: { code: photoError.code, message: photoError.message } })
+    })
+    server = app.listen(0, '127.0.0.1')
+    await new Promise<void>((resolve) => server.once('listening', resolve))
+    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/products`
+  })
+  afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) })
+
+  async function body({ bulk = false, type = 'image/png', bytes, includeImage = true }: { bulk?: boolean; type?: string; bytes?: Uint8Array; includeImage?: boolean } = {}) {
+    const data = new FormData()
+    const details = { name: 'Widget', category: 'Tools', price: '10.00', stockQuantity: 2 }
+    if (bulk) data.append('products', JSON.stringify([details, { ...details, name: 'Cable' }]))
+    else for (const [key, value] of Object.entries(details)) data.append(key, String(value))
+    data.append('updatedAt', '2026-11-11T00:00:00.000Z')
+    if (includeImage) {
+      const png = bytes ?? new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer())
+      data.append('image', new Blob([png as BlobPart], { type }), 'photo.png')
+    }
+    return data
+  }
+  const headers = { origin: 'http://localhost:5173', 'x-test-session': 'yes' }
+  const id = '123e4567-e89b-12d3-a456-426614174000'
+
+  it('creates a photo product and saves a shared bulk photo with independently owned IDs', async () => {
+    expect((await fetch(base, { method: 'POST', headers, body: await body() })).status).toBe(201)
+    expect(mocks.createProduct).toHaveBeenCalledWith('user-a', expect.objectContaining({ imagePublicId: 'test/1', stockQuantity: 2 }))
+    const result = await fetch(`${base}/bulk`, { method: 'POST', headers, body: await body({ bulk: true }) })
+    expect(result.status).toBe(201)
+    expect(mocks.createProducts.mock.calls[0][1].map((input: { imagePublicId: string }) => input.imagePublicId)).toEqual(['test/2', 'test/3'])
+    expect(JSON.stringify(await result.json())).not.toContain('imagePublicId')
+  })
+  it.each(['POST', 'PUT'])('saves details with an old/no photo and warning after failed upload (%s)', async (method) => {
+    mocks.upload.mockImplementation(() => { throw new Error('offline') })
+    const result = await fetch(method === 'POST' ? base : `${base}/${id}`, { method, headers, body: await body() })
+    expect(result.status).toBe(method === 'POST' ? 201 : 200)
+    const response = await result.json()
+    expect(response.warning).toBe(PHOTO_WARNING)
+    expect(response.product.imageUrl).toBe(method === 'POST' ? null : 'https://res.cloudinary.com/test/old.png')
+    expect((method === 'POST' ? mocks.createProduct.mock.calls[0][1] : mocks.updateProduct.mock.calls[0][2])).not.toHaveProperty('imagePublicId')
+  })
+  it.each([[new Uint8Array([1, 2, 3]), 'image/png', 400], [new Uint8Array(3 * 1024 * 1024 + 1), 'image/png', 413], [new Uint8Array([1]), 'image/gif', 400]] as const)('rejects invalid/oversized files without product mutations', async (bytes, type, status) => {
+    const response = await fetch(base, { method: 'POST', headers, body: await body({ bytes, type }) })
+    expect(response.status).toBe(status)
+    expect(mocks.createProduct).not.toHaveBeenCalled()
+    expect(mocks.upload).not.toHaveBeenCalled()
+  })
+  it('returns 503 without configured credentials while JSON saves remain compatible', async () => {
+    mocks.config.CLOUDINARY_API_SECRET = ''
+    expect((await fetch(base, { method: 'POST', headers, body: await body() })).status).toBe(503)
+    expect(mocks.createProduct).not.toHaveBeenCalled()
+    const result = await fetch(base, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Widget', category: 'Tools', price: '10.00' }) })
+    expect(result.status).toBe(201)
+  })
+  it('ignores client-supplied URLs and public IDs and supports JSON image removal', async () => {
+    await fetch(base, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Widget', category: 'Tools', price: '10.00', imageUrl: 'https://evil.test/image', imagePublicId: 'other-tenant' }) })
+    expect(mocks.createProduct.mock.calls[0][1]).not.toHaveProperty('imageUrl')
+    await fetch(`${base}/${id}`, { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Widget', category: 'Tools', price: '10.00', updatedAt: '2026-11-11T00:00:00.000Z', removeImage: true }) })
+    expect(mocks.updateProduct.mock.calls[0][2]).toMatchObject({ removeImage: true })
+  })
+  it.each([null, true, false, '', 'not-a-number'])('rejects invalid stock quantity %s instead of coercing it', async (stockQuantity) => {
+    const response = await fetch(base, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Widget', category: 'Tools', price: '10.00', stockQuantity }) })
+    expect(response.status).toBe(400)
+    expect(mocks.createProduct).not.toHaveBeenCalled()
+  })
+  it('rejects missing session/foreign origin before upload or saving', async () => {
+    expect((await fetch(base, { method: 'POST', headers: { origin: headers.origin }, body: await body() })).status).toBe(401)
+    expect((await fetch(base, { method: 'POST', headers: { ...headers, origin: 'https://evil.test' }, body: await body() })).status).toBe(403)
+    expect(mocks.upload).not.toHaveBeenCalled()
+    expect(mocks.createProduct).not.toHaveBeenCalled()
+  })
+  it.each(['stale', 'duplicate'])('cleans an uploaded replacement after %s without returning product data', async (kind) => {
+    mocks.updateProduct.mockResolvedValue({ kind })
+    const response = await fetch(`${base}/${id}`, { method: 'PUT', headers, body: await body() })
+    expect(response.status).toBe(409)
+    expect(await response.json()).not.toHaveProperty('product')
+    expect(mocks.destroy).toHaveBeenCalledWith('test/1', { resource_type: 'image' })
+  })
+})
\ No newline at end of file


<claims_document>
---
title: 'Cloudinary product photos with immutable purchase snapshots'
type: 'feature'
created: '2026-11-11'
status: 'in-review'
route: 'dispatch'
baseline_commit: '0d164984675c639c6d0a4f35d580577e59fc4e27'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="Approved plan and decisions from user on 2026-11-11">

## Intent

Add optional Cloudinary-backed product photos across product management, inventory, purchasing, history, archived products, and stock notification emails. Purchase images are immutable snapshots, like existing name/category snapshots.

## Boundaries & Constraints

Always preserve tenant isolation, session/same-origin checks, stale-write protection, atomic bulk behavior, existing calculations, and JSON compatibility. Upload JPEG/PNG/WebP only, maximum 3 MB, using memory multipart handling and Cloudinary folder `asimon/products` with optimized quality/format. Validate actual image bytes as well as declared type. No client-controlled Cloudinary public IDs or remote image URLs for persistence.

Add nullable `imageUrl` and `imagePublicId` to both Product and StockPurchase in one migration. Copy both from Product when purchases are created (single and checkout). Backfill existing purchases from matching tenant-owned product images. History displays its own snapshot URL with placeholder fallback.

Delete remote assets only if their public ID has zero references in BOTH Product and StockPurchase, including archived/soft-deleted records, across all tenants. Apply this after replacement/removal, failed saves of fresh uploads, permanent product deletion, purchase deletion, bulk flows, delete-all/clear history paths, and retention purge. Collect candidates before deleting rows and check references after committed persistence, outside database transactions. Cloudinary/check failures are logged and never undo or throw through successful product actions. Archive/restore and recoverable delete-all preserve images while references remain. No network calls inside database transactions.

If replacement upload fails, retain old image, save product details successfully, and return a photo warning displayed in a toast. Failed create photo uploads similarly allow product creation. Missing Cloudinary configuration must not crash startup: requests attempting upload return explicit 503. Invalid/oversized files produce clear 400/413 errors without product mutation.

CSP adds only `https://res.cloudinary.com` as external image origin, never a wildcard; preserve required self/data/blob sources for previews. NEVER read, search, print, or edit `.env` values. Only modify Cloudinary validation in config and placeholders in `.env.example`. Do not deploy, migrate a live database, commit, push, or perform live Cloudinary operations for verification.

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma`, `prisma/migrations/` — mapped SQL fields and timestamped migrations.
- `server/infrastructure/config.ts`, `server/app.ts` — optional env config, Helmet CSP, JSON and error envelopes.
- `server/modules/products/{routes,service,data-access}.ts` — JSON create/bulk/update, stale-write checks, archive/restore/permanent delete. Public responses must not expose public IDs.
- `server/modules/stock/{routes,service,data-access}.ts`, `server/index.ts` — explicit stock/purchase selects, checkout snapshots, deletePurchase, recoverable deleteStockData, scheduled purge. Inspect all deletion entry points; frontend bulk calls existing single endpoints.
- `FrontEnd/src/App.tsx` — product type, API wrapper currently forces JSON, shared add/edit/bulk modal, archive confirmation.
- `FrontEnd/src/pages/{DashboardStockTable,StockTrackerPage,PurchaseHistoryPage,SettingsPage}.tsx` — independent types/Zod schemas; render product names in lists/tables, picker selection/options, cart, bought history, archived catalog; quantity/insufficient-stock dialogs.
- `server/modules/notifications/service.ts` — escaped HTML rendering and optional image notification payloads. Product/stock services build event items.
- `package.json`, `package-lock.json`, `.env.example`, `README.md` — dependencies and setup; `.env` exists and must not be read.

## Tasks & Acceptance

Execute sequentially in this order:

- [x] `prisma/schema.prisma` and new migration — add both nullable image fields to both models, indexes supporting reference checks, tenant-safe backfill SQL.
- [x] `server/infrastructure/config.ts` and new image/upload helper — optional config; Cloudinary and Multer dependencies/types; bounded memory/files/fields; clear unavailable and validation errors; optimized upload; best-effort reference-aware cleanup.
- [x] Product and stock routes/services/data access — authenticated multipart create/update/bulk with shared bulk photo and independently owned uploaded assets (avoid premature cleanup); preserve JSON requests; remove-image flag; warning response; stale/duplicate/error cleanup; snapshot fields and all deletion/purge cleanup paths. Keep IDs internal.
- [x] New `FrontEnd/src/components/ProductImage/` and `ImageUpload/` components/CSS — accessible responsive image with missing/broken placeholder; file selection/drop/preview/removal, validation and object URL cleanup.
- [x] `App.tsx` and listed pages — FormData only when needed, do not set multipart Content-Type manually, add/edit/bulk image state, photo warnings toast, preserve images through edit callbacks, render photos wherever a product appears including picker/cart/history/archive and relevant dialogs. Snapshot schemas must retain own image URL, not join current product image.
- [x] Notification service and event producers — escaped optional trusted Cloudinary images in HTML; plain-text messages remain readable; failed remote images do not affect messages.
- [x] Focused backend/frontend tests plus `README.md`, `.env.example`, `server/app.ts` — document local/production migration commands and Cloudinary setup, targeted CSP. Test upload validation, missing config, replacement failure, removal, stale/duplicate rollback cleanup, immutable single/checkout snapshots, referenced/unreferenced assets, deletion/purge, UI fallback/preview/reset/toasts and renderers.

Acceptance criteria:
- Given no photo, when old products/history render, then placeholders work and existing functionality remains intact.
- Given a valid photo, when creating/editing/bulk-adding, then optimized Cloudinary URL persists and appears in product screens and emails.
- Given a purchase snapshot, when the product photo changes or is removed, then history remains unchanged and its referenced asset is retained.
- Given an unused asset, when deletion/replacement/purge completes, then cleanup checks both tables and attempts remote deletion without making successful persistence fail.
- Given absent Cloudinary config, when server starts, then startup succeeds; when upload is requested, then a clear 503 is returned.
- Given Cloudinary upload failure with configured credentials, when saving details, then details save, old photo is retained and a warning toast explains the failure.

## Implementation Notes

User approved the findings/plan and supplied final snapshot/cleanup/config decisions before implementation. Do not execute live database migrations; supply deployment steps.

## Spec Change Log

## Review Triage Log

## Verification

- `npx prisma generate` — generated client updated without live database mutation.
- `npm run typecheck` — successful server and frontend checks.
- `npm run build` — successful production builds.
- `npm test` — all deterministic Vitest tests pass; explicitly report opt-in skips.
- Inspect diff and check editor diagnostics; independently review security, cleanup semantics, snapshot consistency, and verification coverage.

### Execution evidence — 2026-11-11

- Prisma client generation succeeded; no migration/deployment or live Cloudinary operation was performed. No `.env` values were inspected or modified.
- `npm run typecheck` passed; `npm run build` passed for frontend and server (including a final typecheck).
- Final `npm test`: **221 passed**, **1 skipped**, across 31 passing test files and one skipped test file. The skipped test is the opt-in Mailpit/PostgreSQL authentication flow, intentionally not enabled.
- Editor diagnostics: no errors. `git diff --check`: passed (Git notes LF/CRLF normalization for `FrontEnd/src/App.tsx`).
- Added real localhost multipart HTTP tests with mocked persistence/Cloudinary, decoded image validation, limits, same-origin/session checks, unavailable config, warning fallback, client-ID/URL rejection, stale/duplicate cleanup, single/checkout snapshot and cleanup-order tests, trusted email/CSP checks, component preview/fallback/reset tests, App FormData/warning tests, and page current/snapshot renderers.
- Snapshot creation conditionally matches the captured asset ID while decrementing stock, preventing a concurrent photo replacement from publishing an already-unreferenced asset into history.
- Independent review is **pending**: this runtime cannot launch the required context-free reviewer agents. Standalone review handoffs are prepared separately; do not treat the passing deterministic checks as a completed independent review.
- Operator follow-up: apply the migration deliberately and configure server-side Cloudinary credentials as documented in [README.md](../../README.md). Live PostgreSQL migration/backfill, browser visual checks, and actual Cloudinary delivery/deletion remain unverified by design.
- Environment risks observed during install: local Node `24.13.0` is below the project's declared `>=24.21.0`; npm reported 13 dependency vulnerabilities (3 moderate, 7 high, 3 critical). No unrelated dependency remediation was attempted. Cleanup is best-effort/logged with no durable orphan retry queue; shared bulk photos require independent remote uploads and may increase save latency.
</claims_document>

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. If the instruction file is unreadable, report that exact failure and stop. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

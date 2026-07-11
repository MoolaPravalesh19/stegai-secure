# StegoVault — Technologies & Architecture (In-Depth)

A complete reference of every technology used in this project, why it was chosen, and where it appears in the codebase.

---

## 1. Frontend Runtime

### 1.1 React 18
- **Purpose:** Component-based UI rendering with concurrent features.
- **Where used:** Every file under `src/components/`, `src/pages/`, `src/App.tsx`.
- **Leveraged:** Functional components, hooks (`useState`, `useEffect`, `useMemo`, `useCallback`), context.

### 1.2 TypeScript 5
- **Purpose:** Static typing and IDE support.
- **Where used:** All `.ts` / `.tsx` files. DB types auto-generated in `src/integrations/supabase/types.ts`.

### 1.3 Vite 5
- **Purpose:** Dev server + build tool (esbuild transforms, HMR).
- **Config:** `vite.config.ts` (port 8080).

### 1.4 React Router v6
- **Purpose:** Client-side routing.
- **Routes:** `/` (Index), `/auth`, `/admin`, `*` (NotFound). See `src/App.tsx`.

---

## 2. Styling & Design System

### 2.1 Tailwind CSS v3
- Utility-first styling. Config `tailwind.config.ts`; tokens in `src/index.css`.
- All colors/gradients/shadows are **semantic HSL tokens** — never hardcoded.

### 2.2 shadcn/ui + Radix UI
- Accessible headless primitives under `src/components/ui/*`.

### 2.3 lucide-react
- Icon set used across dashboard, admin, uploader.

### 2.4 Custom Visual Layer
- `CyberGrid` — animated cyber-grid background.
- `GlassCard` — glassmorphism container.
- Theme: dark corporate + blue tones.

---

## 3. State, Data & Forms

| Library | Use |
|---|---|
| `@tanstack/react-query` | Server-state caching for Supabase queries. |
| `react-hook-form` + `zod` | Form validation (Auth, metrics entry). |
| `sonner` / shadcn Toaster | Notifications (encode/decode results and raw backend errors). |

---

## 4. Backend — Lovable Cloud (Supabase)

### 4.1 PostgreSQL Tables
| Table | Purpose |
|---|---|
| `profiles` | User profile mirrored from `auth.users` via `handle_new_user()` trigger. |
| `user_roles` | RBAC in a **separate** table. Enum: `admin`, `moderator`, `user`. |
| `encryption_history` | Every encode/decode op (message, PSNR, SSIM, timing, URLs). FK → profiles. |
| `evaluation_metrics` | PSNR / MSE / SSIM / max-error records per user. FK → profiles. |

**Security:**
- RLS enabled on every table with explicit `GRANT`s to `authenticated` and `service_role`.
- `has_role(uuid, app_role)` — `SECURITY DEFINER` to avoid recursive RLS.
- Admin RPCs guarded by `has_role(auth.uid(),'admin')`.
- `set_user_id_from_auth()` `BEFORE INSERT` trigger auto-fills `user_id = auth.uid()`.

### 4.2 Authentication
- Email/password via Supabase Auth.
- `src/hooks/useAuth.ts` (session), `src/hooks/useAdmin.ts` (role), `src/pages/Auth.tsx` (UI).

### 4.3 Storage Buckets
| Bucket | Public | Purpose |
|---|---|---|
| `stego-images` | ✅ | Cover / stego images. |
| `onnx-models` | ✅ | HidingNet / RevealNet ONNX weights loaded in-browser. |

### 4.4 Edge Functions (Deno)
| Function | Job |
|---|---|
| `steganography-encode` | LSB / append-marker embed, optional XOR key, uploads to storage, logs to history, returns metrics + generated decode password. |
| `steganography-decode` | Parses BMP, tries LSB → new marker → legacy marker, XOR-decrypts, logs decode, returns recovered text and raw errors. |

Bearer-token auth validated inside each function using the service-role client.

---

## 5. AI / ML Inference

### 5.1 ONNX Runtime Web (v1.17.0)
- **Client-side** neural steganography (HidingNet + RevealNet).
- WASM backend, **single-threaded** (no COOP/COEP required).
- WASM binaries from CDN; model weights from `onnx-models` bucket.
- Tensor format: **NCHW**, floats normalized `[0,1]`.
- Code: `src/lib/onnxModel.ts`. Admin upload: `src/components/ModelUploader.tsx`.

### 5.2 Steganography Methods
| Method | Where |
|---|---|
| **LSB** (least significant bit) + optional XOR key | Edge functions (BMP pixels). |
| **Append-marker** (`<<STEGO_START>>` / `<<STEGO_END>>`) | Non-BMP fallback. |
| **Neural (HidingNet / RevealNet)** | Browser via ONNX Runtime Web. |

### 5.3 Quality Metrics
- **PSNR** — Peak Signal-to-Noise Ratio (imperceptibility).
- **SSIM** — Structural Similarity Index.
- **MSE / Max Error** — pixel diagnostics.
- Computed in `MetricsEvaluationSection.tsx`; persisted to `evaluation_metrics`.

---

## 6. Visualization

| Component | Tech | Purpose |
|---|---|---|
| `ImageHistogram` | Canvas 2D | Per-channel R/G/B histogram. |
| `ComparisonHistogram` | Canvas 2D | Cover vs stego overlay. |
| `ComparisonSlider` | React | Side-by-side reveal slider. |
| `MetricCard` | shadcn Card | KPI display (PSNR, SSIM, time). |

---

## 7. Utilities

| Utility | Purpose |
|---|---|
| `src/lib/csvExport.ts` | CSV export of history & metrics. |
| `src/lib/utils.ts` | `cn()` — clsx + tailwind-merge. |
| `src/hooks/use-toast.ts` | Toast dispatch. |
| `src/hooks/use-mobile.tsx` | Responsive viewport hook. |

---

## 8. Admin Panel (`src/pages/Admin.tsx`)
- Guarded by `useAdmin()` (`has_role`).
- Consumes RPCs: `admin_get_stats`, `admin_get_all_profiles`, `admin_get_all_history`, `admin_get_operations_over_time`, `admin_get_quality_over_time`, `admin_list_storage_files`, `admin_delete_user`.
- Charts operations & quality over 30 days.

---

## 9. Tooling

| Tool | Use |
|---|---|
| ESLint | Linting (`eslint.config.js`). |
| PostCSS + Autoprefixer | CSS pipeline. |
| Bun / npm | Package management. |
| Supabase CLI (via Lovable) | Migrations in `supabase/migrations/`. |

---

## 10. Security Posture
1. RLS on every table.
2. Roles in a separate table (prevents privilege escalation).
3. `SECURITY DEFINER` functions for role checks and admin ops.
4. Service-role key used only inside Edge Functions.
5. XOR keys / decode passwords generated **backend-side** per operation.
6. CORS configured in every Edge Function.

---

## 11. Data Flow

```
 User (React UI)
   │ upload image + message
   ▼
 Edge Function (steganography-encode)
   │ LSB / neural embed
   │ compute PSNR & SSIM
   │ upload stego → stego-images
   │ insert row → encryption_history
   ▼
 Response { stegoUrl, psnr, ssim, decodePassword, timingMs }
   ▼
 React renders MetricCards + ComparisonSlider + Histograms
```

Decode is the mirror path, returning raw recovered plaintext and surfacing any backend error verbatim.

---

*End of document.*

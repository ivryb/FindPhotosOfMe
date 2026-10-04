# Find Photos of Me - Project Conventions

## Code Style & Architecture

### General Principles

- Follow SOLID principles, especially Single Responsibility
- Keep files focused and modular - avoid large, multi-purpose files
- Use component-based architecture
- Use double quotes for strings, not single quotes

### TypeScript

- Always use TypeScript with proper types
- Import types from Convex generated files: `import type { Id } from '@FindPhotosOfMe/backend/convex/_generated/dataModel'`
- Use explicit return types for functions when helpful for clarity

## Nuxt 4 & Vue Patterns

### Component Structure

- Use `<script setup lang="ts">` syntax
- Import composables from `@/composables/`
- Import components from `@/components/`
- Use auto-imported Nuxt composables: `useRoute()`, `useRuntimeConfig()`, `navigateTo()`
- Almost all of the Vue/Nuxt constants and methods are auto-imported, no need to import `ref`, `computed`, `useFetch` etc.

### File Naming

- Components: PascalCase (e.g., `SearchForm.vue`, `Header.vue`)
- Pages: kebab-case (e.g., `search.vue`, `[subdomain].vue`)
- Composables: camelCase with `use` prefix (e.g., `useSubdomain.ts`)

## Convex Integration

### Query Patterns

### Authenticated admin rendering

The browser uses Better Auth through the same-origin `/api/auth/**` proxy. Sessions live in HttpOnly cookies; the server uses the session cookie to obtain a Convex JWT for each admin request. No JWT or session token is included in the Nuxt page payload.

Google still calls the existing Convex OAuth callback. Its one-time token returns through `/auth/callback`, which checks the initiating browser, exchanges the token, sets the app's cookies, and redirects to the requested local page. Localhost and production keep separate cookies and use the same Convex deployment. Existing localStorage sessions require signing in once after this change.

The two admin pages use `useFetch` for their initial owner-authorized data and `useLiveQuery` for subsequent updates. The live subscription starts once Convex confirms authentication and preserves the initial data while connecting. Admin and auth responses use `private, no-store`. Organizer upload endpoints still require bearer tokens from `getConvexAuthToken()`. Attendee selfie upload, search progress, and result downloads are public. New searches can be read by their request ID; existing private and Telegram searches retain their access checks. Download URLs are only issued for photos in that completed search.

Run `bun test apps/web/tests/auth.test.ts` from the repository root. This starts Nuxt on port 3212 against an isolated HTTP/WebSocket Convex fixture and checks auth cookies, callback redirects, unauthorized requests, and the initial HTML of both admin pages. It does not modify the shared deployment.

For browser verification, run `bun apps/web/tests/backend.ts`, then from `apps/web` run `TEST_BACKEND_URL=http://localhost:3211 bun x nuxt dev tests --port 3212 --dotenv /dev/null`. The fixture accepts any email code. Open both admin pages and POST a new title as plain text to `http://localhost:3211/__fixture/title` to check live updates without reloading. Verify logout and that `document.cookie` cannot read the session. Production Google and email delivery remain separate end-to-end checks.

**Client-side Queries:**

```typescript
// For reactive client-side data
const { data: searchRequest } = useConvexQuery(api.searchRequests.get, {
  id: requestId,
});
```

**Conditional Queries:**

```typescript
// When query args depend on runtime state, set up dynamically
const { data } = useConvexQuery(api.searchRequests.get, { id: requestId });
watch(
  data,
  (newData) => {
    // Handle updates
  },
  { immediate: true }
);
```

### Mutation Patterns

```typescript
import { useConvexMutation } from "convex-vue";

// Setup mutation
const { mutate: createSearchRequest } = useConvexMutation(
  api.searchRequests.create
);

// Call mutation
const requestId = await createSearchRequest({
  collectionId: props.collectionId,
});
```

### Convex Best Practices

- Always validate collection/resource existence before operations
- Use mutations for write operations, queries for reads
- Leverage Convex reactivity - data updates automatically
- Log Convex operations with IDs for debugging
- Use proper Convex types: `Id<"collections">`, `Id<"searchRequests">`

## Tailwind CSS & Theme Colors

### Theme Color Palette

Always use semantic theme colors, never hardcoded colors:

**Primary Colors:**

- `bg-primary` / `text-primary` - Red accent (hsl(0 100% 60%))
- `bg-primary-foreground` / `text-primary-foreground` - White on primary

**Secondary Colors:**

- `bg-secondary` / `text-secondary` - Yellow (hsl(60 100% 50%))
- `bg-accent` / `text-accent` - Blue (hsl(216 100% 50%))

**Status Colors:**

- `bg-chart-4` / `text-chart-4` - Green for success (hsl(120 100% 40%))
- `bg-chart-2` / `text-chart-2` - Yellow for processing/warning
- `bg-destructive` / `text-destructive` - Black/White for errors

**Neutral Colors:**

- `bg-background` / `text-foreground` - Main background/text
- `bg-card` / `text-card-foreground` - Card backgrounds
- `bg-muted` / `text-muted-foreground` - Muted/secondary content
- `border-border` - Default borders
- `bg-input` - Form inputs

**Opacity Modifiers:**

- Use `/10`, `/20`, `/80` for opacity (e.g., `bg-chart-4/10`, `bg-destructive/20`)

### Status Indicators

```typescript
// Example status color mapping
const statusColor = computed(() => {
  switch (status) {
    case "complete":
      return "bg-chart-4";
    case "processing":
      return "bg-chart-2";
    case "error":
      return "bg-destructive";
    default:
      return "bg-muted";
  }
});
```

## shadcn-vue Components

### Component Imports

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
```

### Usage Patterns

**Cards:**

```vue
<Card class="border-accent">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    <!-- Content -->
  </CardContent>
</Card>
```

**Buttons:**

```vue
<Button @click="handleClick" variant="outline" class="gap-2">
  <Icon :size="18" />
  Button Text
</Button>
```

Variants: `default`, `outline`, `ghost`, `destructive`, `secondary`

**Forms:**

```vue
<div class="space-y-2">
  <Label for="input-id">Label Text</Label>
  <Input
    id="input-id"
    v-model="value"
    type="text"
    :disabled="isDisabled"
  />
  <p class="text-sm text-muted-foreground">Helper text</p>
</div>
```

## Icons with lucide-vue-next

### Import & Usage

```typescript
import { Upload, Search, CheckCircle2, XCircle, Images } from "lucide-vue-next";
```

```vue
<Upload :size="24" class="text-primary" />
<Search :size="18" class="animate-pulse" />
```

### Common Icons

- `Upload` - File uploads
- `Search` - Search operations
- `CheckCircle2` - Success states
- `XCircle` - Error states
- `Images` / `ImageIcon` - Photo/image related
- `Loader2` - Loading states (with `animate-spin`)
- `AlertCircle` - Warnings

### Icon Best Practices

- Use consistent sizing: 16, 18, 20, 24
- Apply theme colors: `text-primary`, `text-accent`, `text-destructive`
- Add animations for loading/processing: `animate-pulse`, `animate-spin`

## API Integration

### Python Service Calls

```typescript
const config = useRuntimeConfig();
const apiUrl = config.public.apiURL;

const formData = new FormData();
formData.append("field_name", value);

const response = await fetch(`${apiUrl}/api/endpoint`, {
  method: "POST",
  body: formData,
});

if (!response.ok) {
  const errorData = await response
    .json()
    .catch(() => ({ detail: "Unknown error" }));
  throw new Error(errorData.detail || `HTTP ${response.status}`);
}
```

### Error Handling

- Always log errors with context: `console.error("Operation name:", err)`
- Display user-friendly error messages
- Update Convex status to "error" on failures
- Use try-catch-finally pattern for cleanup

## Responsive Design

### Breakpoints

- Mobile first approach
- Use Tailwind breakpoints: `md:`, `lg:`
- Grid layouts: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

### Spacing

- Use consistent spacing: `space-y-2`, `space-y-4`, `space-y-6`
- Gap for flex/grid: `gap-2`, `gap-4`
- Padding: `p-2`, `p-3`, `p-4`

## Subdomain Handling

```typescript
import { useSubdomain } from "@/composables/useSubdomain";

const subdomain = useSubdomain();

// Development: supports ?subdomain= query param
// Production: extracts from hostname
```

## Environment Variables

Access via `useRuntimeConfig()`:

- `config.public.origin` - nuxt instance url
- `config.public.apiURL` - Python service URL
- `config.public.convexUrl` - Convex deployment URL

## Visual Effects

### Hover States

```vue
<div class="hover:border-primary transition-colors group">
  <img class="group-hover:scale-105 transition-transform duration-300" />
</div>
```

## Real-time Updates

Leverage Convex reactivity for live updates:

- Search progress updates automatically
- Photos appear as they're found
- Collection status changes reflect immediately
- No manual polling needed

## Error Pages

```typescript
throw createError({
  statusCode: 404,
  statusMessage: "Resource not found",
});
```

## Logging Standards

Server-side (Python):

```python
print(f"[{get_time()}] Operation starting: {context}")
```

Client-side:

```typescript
console.log("Operation starting:", context);
console.error("Operation failed:", err);
```

Log state, IDs, and timing for debugging.

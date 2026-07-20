// ESM loader hook for the action-plan service tests. Resolves extensionless
// relative specifiers (TypeScript imports without ".ts") and redirects the
// db-client module to a local stub so the pure helpers can be exercised
// under Node strip-types without Vite's import.meta.env.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  // Redirect the real db client to the stub before resolution.
  if (specifier === './supabase' || specifier === '../lib/supabase') {
    const stubUrl = new URL('./dbClientStub.ts', import.meta.url).href;
    return { url: stubUrl, shortCircuit: true };
  }
  // For relative specifiers without an extension, append ".ts" so Node can
  // locate TypeScript files under strip-types.
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const lastSep = Math.max(specifier.lastIndexOf('/'), 0);
    const basename = specifier.slice(lastSep + 1);
    if (!basename.includes('.')) {
      return nextResolve(specifier + '.ts', context);
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  // Fallback: if a supabase path still reaches load, swap to the stub.
  if (url.endsWith('/src/lib/supabase') || url.endsWith('/src/lib/supabase.ts')) {
    const stubPath = fileURLToPath(new URL('./dbClientStub.ts', import.meta.url));
    return { format: 'module', source: readFileSync(stubPath, 'utf8'), shortCircuit: true };
  }
  return nextLoad(url, context);
}

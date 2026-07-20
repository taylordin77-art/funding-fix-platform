// Test-only stub for the db client so pure helpers in actionPlanService.ts
// can be exercised under Node strip-types without Vite's import.meta.env.
// Loaded only via scripts/action-plan-test-loader.mjs. Never imported by the app.
export const supabase = {
  auth: {
    getUser: async () => ({ data: { user: null } }),
  },
};

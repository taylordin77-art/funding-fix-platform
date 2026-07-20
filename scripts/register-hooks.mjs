// Registers the ESM loader hooks for action-plan service tests.
import { register } from 'node:module';
register('./action-plan-test-loader.mjs', import.meta.url);

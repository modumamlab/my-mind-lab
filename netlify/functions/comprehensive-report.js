// Canonical endpoint for the client-facing comprehensive psychological report.
// Rendering is delegated to the single shared report renderer.
import { handleIntegratedReport } from './report-renderer.js';

export const handler = handleIntegratedReport;

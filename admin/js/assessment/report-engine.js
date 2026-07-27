// Compatibility adapter: all report logic is now owned by modules/clinical/report-engine.js.
export {
  normalizeAssessmentResult,
  validateAssessmentResult,
  buildIndividualSections,
  buildIndividualReportData,
  createIndividual as generateIndividualReport,
  buildTestSummaries,
  buildCommonFindings,
  buildComprehensiveSections,
  buildComprehensiveReportData,
  createComprehensive as generateComprehensiveReport,
  createRequested as generateRequestedReports
} from "../modules/clinical/report-engine.js";

// Compatibility adapter: AI report generation is unified in the Clinical Report Engine.
import { generateAI } from "../modules/clinical/report-engine.js";

export const buildIndividualReport = (assessment) => generateAI("individual", assessment);
export const buildIntegratedReport = (assessments) => generateAI("integrated", assessments);
export const buildClinicalReport = (client) => generateAI("clinical", client);
export const generateReport = (type, payload) => generateAI(type, payload);

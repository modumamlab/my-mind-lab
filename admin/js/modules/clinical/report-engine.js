// MML Clinical Report Engine 4.0
// AI 생성과 보고서 데이터/저장을 하나의 진입점으로 통합합니다.

import {
  generateIndividualReport as requestIndividualAI,
  generateIntegratedReport as requestIntegratedAI,
  generateClinicalReport as requestClinicalAI,
  generateCounselorComment,
  qualityCheck
} from "../../ai/ai-service.js";

import {
  createIndividualReport,
  createComprehensiveReport
} from "../../assessment/report-service.js";

import { deepCopy } from "../../core/utils.js";

const cleanText = (value) => String(value ?? "")
  .replace(/\r\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const normalizeList = (value) => {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value === "string") {
    return value.split(/\n|•|■/).map(cleanText).filter(Boolean);
  }
  return [];
};


const getClinicalEngine = () => {
  if (typeof window === "undefined") return null;
  return window.MMLClinicalEngine || null;
};

const toEvidenceInput = ({ assessmentResults = [], synthesis = {} } = {}) => ({
  currentState: synthesis.currentMind || synthesis.currentState || synthesis.emotionalState || synthesis.emotion || "",
  stableTraits: synthesis.mindProfile || synthesis.stableTraits || "",
  relationshipPattern: synthesis.thinkingRelationship || synthesis.relationship || "",
  commonPatterns: synthesis.commonPatterns || synthesis.summary || "",
  differences: synthesis.differences || synthesis.crossTestDifferences || "",
  formulation: synthesis.stressDailyLife || synthesis.stress || synthesis.formulation || "",
  strengths: synthesis.strengths || "",
  vulnerabilities: synthesis.vulnerabilities || synthesis.concerns || "",
  recommendations: synthesis.professionalGuidance || synthesis.guidance || synthesis.recommendations || "",
  testEvidence: assessmentResults.map(item => {
    const normalized = normalizeAssessmentResult(item);
    return {
      testType: normalized.testName,
      testName: normalized.testName,
      validity: normalized.validity,
      coreFindings: [normalized.summary, normalized.profile, normalized.interpretation].filter(Boolean),
      strengths: normalized.strengths,
      concerns: normalized.concerns,
      vulnerabilities: normalized.concerns,
      recommendations: normalized.recommendations,
      confidence: normalized.validity ? "medium" : "low"
    };
  })
});

export function buildEnhancedClinicalContext({ assessmentResults = [], synthesis = {} } = {}) {
  const engine = getClinicalEngine();
  if (!engine?.buildClinicalReportContext) return null;
  return engine.buildClinicalReportContext(toEvidenceInput({ assessmentResults, synthesis }));
}

export function reviewAndSanitizeReport(report, options = {}) {
  const engine = getClinicalEngine();
  if (engine?.reviewAndSanitizeClinicalOutput) {
    return engine.reviewAndSanitizeClinicalOutput(report, options);
  }
  if (engine?.sanitizeClinicalOutput || engine?.reviewClinicalOutput) {
    const sanitized = engine.sanitizeClinicalOutput ? engine.sanitizeClinicalOutput(report) : deepCopy(report);
    const review = engine.reviewClinicalOutput
      ? engine.reviewClinicalOutput(sanitized, options)
      : { passed: true, score: 100, severity: "ok", summary: {} };
    return { report: sanitized, review };
  }
  return {
    report: deepCopy(report),
    review: { passed: true, score: 100, severity: "ok", summary: {}, skipped: true }
  };
}

function sectionContent(section = {}) {
  const points = Array.isArray(section.points)
    ? section.points.map(cleanText).filter(Boolean)
    : [];
  return [cleanText(section.summary), ...points.map(item => `• ${item}`), cleanText(section.caution)]
    .filter(Boolean)
    .join("\n");
}

function mergeEnhancedSections(baseSections = {}, context = null) {
  if (!context?.sections) return baseSections;
  const merged = deepCopy(baseSections);
  Object.entries(context.sections).forEach(([key, section]) => {
    if (!merged[key]) return;
    const enhanced = sectionContent(section);
    if (enhanced) merged[key].content = enhanced;
  });
  return merged;
}

const normalizeTests = (tests) => {
  const values = Array.isArray(tests)
    ? tests
    : typeof tests === "string"
      ? tests.split(/[,/|]/)
      : [];
  return [...new Set(values.map(cleanText).filter(Boolean))];
};

export function normalizeAssessmentResult(result = {}) {
  return {
    id: String(result.id || "").trim(),
    testName: cleanText(result.testName || result.name || result.test || ""),
    testCode: cleanText(result.testCode || result.code || ""),
    summary: cleanText(result.summary),
    interpretation: cleanText(result.interpretation),
    profile: cleanText(result.profile),
    validity: cleanText(result.validity),
    strengths: normalizeList(result.strengths),
    concerns: normalizeList(result.concerns),
    recommendations: normalizeList(result.recommendations),
    scales: Array.isArray(result.scales) ? deepCopy(result.scales) : [],
    rawData: deepCopy(result.rawData || result.data || {}),
    uploadedFileId: String(result.uploadedFileId || "").trim(),
    createdAt: result.createdAt || new Date().toISOString()
  };
}

export function validateAssessmentResult(result = {}) {
  const normalized = normalizeAssessmentResult(result);
  const errors = [];
  if (!normalized.testName) errors.push("검사명이 입력되지 않았습니다.");
  if (!normalized.summary && !normalized.interpretation && normalized.scales.length === 0) {
    errors.push("검사 결과 내용이 없습니다.");
  }
  return { valid: errors.length === 0, errors, result: normalized };
}

export function buildIndividualSections(assessmentResult = {}) {
  const result = normalizeAssessmentResult(assessmentResult);
  return {
    overview: {
      title: "검사 안내",
      content: cleanText(result.validity || `${result.testName} 검사 결과를 바탕으로 현재의 심리적 특성과 주요 경향을 정리하였습니다.`)
    },
    profile: { title: "주요 결과", content: cleanText(result.profile || result.summary) },
    interpretation: { title: "결과 해석", content: cleanText(result.interpretation || result.summary) },
    strengths: { title: "강점과 보호요인", content: result.strengths.map(item => `• ${item}`).join("\n") },
    guidance: { title: "회복을 위한 제언", content: result.recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n") }
  };
}

export function buildIndividualReportData({ reservationId = "", clientId = "", clientName = "", assessmentResult = {}, requestId = "" } = {}) {
  const validation = validateAssessmentResult(assessmentResult);
  if (!validation.valid) return { success: false, errors: validation.errors };
  const result = validation.result;
  return {
    success: true,
    data: {
      reservationId, clientId, clientName, requestId,
      type: "individual",
      testName: result.testName,
      tests: [result.testName],
      title: `${result.testName} 개별 심리검사 보고서`,
      sections: buildIndividualSections(result),
      content: { assessmentResult: deepCopy(result) },
      summary: result.summary,
      recommendation: result.recommendations.join("\n")
    }
  };
}

export function createIndividual(options = {}) {
  const built = buildIndividualReportData(options);
  if (!built.success) return built;
  const checked = reviewAndSanitizeReport(built.data, { mode: "client" });
  return {
    success: true,
    report: createIndividualReport(checked.report),
    quality: checked.review
  };
}

export function buildTestSummaries(assessmentResults = []) {
  return assessmentResults.map(normalizeAssessmentResult).filter(item => item.testName).map(item => ({
    testName: item.testName,
    summary: item.summary || item.interpretation || item.profile,
    validity: item.validity,
    strengths: deepCopy(item.strengths),
    concerns: deepCopy(item.concerns),
    recommendations: deepCopy(item.recommendations)
  }));
}

export function buildCommonFindings(assessmentResults = []) {
  const results = assessmentResults.map(normalizeAssessmentResult);
  return {
    strengths: [...new Set(results.flatMap(item => item.strengths))],
    concerns: [...new Set(results.flatMap(item => item.concerns))],
    recommendations: [...new Set(results.flatMap(item => item.recommendations))]
  };
}

export function buildComprehensiveSections({ assessmentResults = [], synthesis = {} } = {}) {
  const summaries = buildTestSummaries(assessmentResults);
  const commonFindings = buildCommonFindings(assessmentResults);
  return {
    sections: {
      currentMind: { number: 1, title: "현재 마음의 핵심 모습", content: cleanText(synthesis.currentMind || synthesis.summary) },
      mindProfile: { number: 2, title: "마음 프로파일", content: cleanText(synthesis.mindProfile || summaries.map(item => `■ ${item.testName}\n${item.summary || ""}`).join("\n\n")) },
      emotionalState: { number: 3, title: "정서와 심리상태", content: cleanText(synthesis.emotionalState || synthesis.emotion) },
      thinkingRelationship: { number: 4, title: "사고와 관계 방식", content: cleanText(synthesis.thinkingRelationship || synthesis.relationship) },
      stressDailyLife: { number: 5, title: "스트레스와 일상생활", content: cleanText(synthesis.stressDailyLife || synthesis.stress) },
      professionalGuidance: { number: 6, title: "전문가 제언 및 회복 방향", content: cleanText(synthesis.professionalGuidance || synthesis.guidance || commonFindings.recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")) }
    },
    summaries,
    commonFindings
  };
}

export function buildComprehensiveReportData({ reservationId = "", clientId = "", clientName = "", assessmentResults = [], synthesis = {}, requestId = "" } = {}) {
  const validResults = assessmentResults.map(validateAssessmentResult).filter(item => item.valid).map(item => item.result);
  if (!validResults.length) return { success: false, errors: ["종합보고서를 생성할 검사 결과가 없습니다."] };
  const built = buildComprehensiveSections({ assessmentResults: validResults, synthesis });
  const enhancedContext = buildEnhancedClinicalContext({ assessmentResults: validResults, synthesis });
  const sections = mergeEnhancedSections(built.sections, enhancedContext);
  return {
    success: true,
    data: {
      reservationId, clientId, clientName, requestId,
      type: "comprehensive",
      tests: normalizeTests(validResults.map(item => item.testName)),
      title: "심리검사 종합결과보고서",
      sections,
      content: {
        testSummaries: enhancedContext?.testSummaries || built.summaries,
        commonFindings: built.commonFindings,
        assessmentResults: deepCopy(validResults),
        clinicalMeta: enhancedContext?.reportMeta || null
      },
      summary: cleanText(synthesis.summary || synthesis.currentMind),
      recommendation: cleanText(synthesis.professionalGuidance || synthesis.guidance)
    }
  };
}

export function createComprehensive(options = {}) {
  const built = buildComprehensiveReportData(options);
  if (!built.success) return built;
  const checked = reviewAndSanitizeReport(built.data, {
    mode: "client",
    requiredPaths: [
      "sections.currentMind.content",
      "sections.mindProfile.content",
      "sections.emotionalState.content",
      "sections.thinkingRelationship.content",
      "sections.stressDailyLife.content",
      "sections.professionalGuidance.content"
    ]
  });
  return {
    success: true,
    report: createComprehensiveReport(checked.report),
    quality: checked.review
  };
}

export function createRequested({ reservationId = "", clientId = "", clientName = "", assessmentResults = [], individualTests = [], comprehensiveRequested = false, synthesis = {}, requestId = "" } = {}) {
  const reports = [];
  const errors = [];
  normalizeTests(individualTests).forEach(testName => {
    const result = assessmentResults.find(item => cleanText(item.testName || item.name || item.test) === testName);
    if (!result) return errors.push(`${testName} 검사 결과를 찾을 수 없습니다.`);
    const generated = createIndividual({ reservationId, clientId, clientName, assessmentResult: result, requestId });
    generated.success ? reports.push(generated.report) : errors.push(...(generated.errors || []));
  });
  if (comprehensiveRequested) {
    const generated = createComprehensive({ reservationId, clientId, clientName, assessmentResults, synthesis, requestId });
    generated.success ? reports.push(generated.report) : errors.push(...(generated.errors || []));
  }
  return { success: reports.length > 0, reports, errors };
}

export async function generateAI(type, payload) {
  let result;
  if (type === "individual") result = await requestIndividualAI(payload);
  else if (type === "integrated" || type === "comprehensive") result = await requestIntegratedAI(payload);
  else if (type === "clinical") result = await requestClinicalAI(payload);
  else return { success: false, message: "지원하지 않는 보고서입니다." };

  if (!result?.success) return result;
  const quality = await qualityCheck(result);
  const response = { success: true, report: result, quality };
  if (type === "integrated" || type === "comprehensive") {
    const comment = await generateCounselorComment(result);
    response.counselorComment = comment?.comment || "";
  }
  return response;
}

export function generate(type, payload = {}) {
  if (type === "individual") return createIndividual(payload);
  if (type === "integrated" || type === "comprehensive") return createComprehensive(payload);
  if (type === "requested") return createRequested(payload);
  return { success: false, message: "지원하지 않는 보고서입니다." };
}

// ES Module 보고서 엔진을 기존 관리자 코드에서도 사용할 수 있도록 전역 브리지 제공
const MMLClinicalReportEngineAPI = Object.freeze({
  buildEnhancedClinicalContext,
  reviewAndSanitizeReport,
  normalizeAssessmentResult,
  validateAssessmentResult,
  buildIndividualSections,
  buildIndividualReportData,
  createIndividual,
  buildTestSummaries,
  buildCommonFindings,
  buildComprehensiveSections,
  buildComprehensiveReportData,
  createComprehensive,
  createRequested,
  generateAI,
  generate
});

if (typeof window !== "undefined") {
  window.MMLClinicalModules = window.MMLClinicalModules || {};
  window.MMLClinicalModules.reportEngine = MMLClinicalReportEngineAPI;
  window.MMLClinicalReportEngine = MMLClinicalReportEngineAPI;
  try {
    window.dispatchEvent(new CustomEvent("mml:clinical-report-engine-ready", {
      detail: { version: "4.0", module: true }
    }));
  } catch (_) {}
}


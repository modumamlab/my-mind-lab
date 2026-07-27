// MML Case Concept Engine
// 기존 ai/case-engine의 사례개념화 로직을 Case 모듈로 이동합니다.
import { generateCaseConceptualization } from "../../ai/ai-service.js";

export function buildCaseInput(client = {}, chart = {}, sessions = [], assessments = [], reports = []) {
  return {
    client: {
      id: client.id || "",
      name: client.name || client.clientName || "",
      gender: client.gender || "",
      age: client.age || "",
      program: client.program || ""
    },
    chart,
    sessions,
    assessments,
    reports
  };
}

export function validateCaseInput(payload = {}) {
  const errors = [];
  if (!payload.client) errors.push("내담자 정보 없음");
  if (!payload.assessments?.length) errors.push("심리검사 없음");
  if (!payload.reports?.length) errors.push("보고서 없음");
  return { valid: errors.length === 0, errors };
}

export async function createCaseConcept(client, chart, sessions, assessments, reports) {
  const payload = buildCaseInput(client, chart, sessions, assessments, reports);
  const validation = validateCaseInput(payload);
  if (!validation.valid) return { success: false, message: validation.errors.join(", "), errors: validation.errors };
  const result = await generateCaseConceptualization(payload, chart, reports);
  if (!result?.success) return { success: false, message: result?.message || "AI 분석 실패" };
  return {
    success: true,
    concept: result.concept || "",
    hypothesis: result.hypothesis || "",
    strengths: result.strengths || "",
    risks: result.risks || "",
    treatmentGoals: result.treatmentGoals || "",
    intervention: result.intervention || "",
    prognosis: result.prognosis || ""
  };
}

export function buildCaseRecord(reservationId, aiResult = {}) {
  return {
    reservationId,
    createdAt: new Date().toISOString(),
    concept: aiResult.concept || "",
    hypothesis: aiResult.hypothesis || "",
    strengths: aiResult.strengths || "",
    risks: aiResult.risks || "",
    treatmentGoals: aiResult.treatmentGoals || "",
    intervention: aiResult.intervention || "",
    prognosis: aiResult.prognosis || ""
  };
}

export function summarizeCase(caseRecord = {}) {
  return [caseRecord.concept, caseRecord.hypothesis, caseRecord.treatmentGoals].filter(Boolean).join("\n\n");
}

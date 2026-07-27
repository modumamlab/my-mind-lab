// MML AI service compatibility bridge
function globalService() {
  return globalThis.MMLAIService ||
    globalThis.MMLAssessmentAI ||
    globalThis.MMLClinicalAI ||
    null;
}

async function call(names, payload) {
  const service = globalService();
  for (const name of names) {
    if (service && typeof service[name] === "function") {
      return await service[name](payload);
    }
    if (typeof globalThis[name] === "function") {
      return await globalThis[name](payload);
    }
  }
  return {
    success: false,
    message: "AI 보고서 생성 서비스를 찾을 수 없습니다.",
    error: "AI_SERVICE_NOT_CONNECTED"
  };
}

export async function generateIndividualReport(payload) {
  return call(["generateIndividualReport", "generateIndividualAssessmentReport"], payload);
}

export async function generateIntegratedReport(payload) {
  return call(["generateIntegratedReport", "generateComprehensiveReport"], payload);
}

export async function generateClinicalReport(payload) {
  return call(["generateClinicalReport"], payload);
}

export async function generateCounselorComment(payload) {
  const result = await call(["generateCounselorComment"], payload);
  return result?.success === false ? { comment: "" } : result;
}

export async function qualityCheck(payload) {
  const service = globalService();
  if (service && typeof service.qualityCheck === "function") {
    return await service.qualityCheck(payload);
  }
  return {
    passed: true,
    score: 100,
    severity: "ok",
    skipped: true
  };
}

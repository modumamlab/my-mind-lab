// ============================================
// AI 심리평가 보고서 생성
// ============================================

import {
    generateIndividualReport,
    generateComprehensiveReport
} from "./report-engine.js";

// ============================================
// AI 응답 정리
// ============================================

export function normalizeAiResponse(aiResult = {}) {

    return {

        summary:
            String(aiResult.summary || "").trim(),

        currentMind:
            String(aiResult.currentMind || "").trim(),

        profile:
            String(aiResult.profile || "").trim(),

        emotionalState:
            String(aiResult.emotionalState || "").trim(),

        thinkingRelationship:
            String(
                aiResult.thinkingRelationship || ""
            ).trim(),

        stressDailyLife:
            String(
                aiResult.stressDailyLife || ""
            ).trim(),

        professionalGuidance:
            String(
                aiResult.professionalGuidance || ""
            ).trim(),

        strengths:
            Array.isArray(aiResult.strengths)
                ? aiResult.strengths
                : [],

        concerns:
            Array.isArray(aiResult.concerns)
                ? aiResult.concerns
                : [],

        recommendations:
            Array.isArray(aiResult.recommendations)
                ? aiResult.recommendations
                : []

    };

}

// ============================================
// AI 개별보고서 생성
// ============================================

export function generateIndividualAIReport({

    reservation,

    assessmentResult,

    aiResult

}) {

    return generateIndividualReport({

        reservationId:
            reservation.id,

        clientId:
            reservation.clientId,

        clientName:
            reservation.name,

        assessmentResult,

        synthesis:
            normalizeAiResponse(aiResult)

    });

}

// ============================================
// AI 종합보고서 생성
// ============================================

export function generateComprehensiveAIReport({

    reservation,

    assessmentResults,

    aiResult

}) {

    return generateComprehensiveReport({

        reservationId:
            reservation.id,

        clientId:
            reservation.clientId,

        clientName:
            reservation.name,

        assessmentResults,

        synthesis:
            normalizeAiResponse(aiResult)

    });

}

// ============================================
// AI 결과 유효성 검사
// ============================================

export function validateAIResult(aiResult = {}) {

    const normalized =
        normalizeAiResponse(aiResult);

    const errors = [];

    if (!normalized.summary) {

        errors.push("AI 요약이 없습니다.");

    }

    if (!normalized.professionalGuidance) {

        errors.push("전문가 제언이 없습니다.");

    }

    return {

        valid:
            errors.length === 0,

        errors,

        result:
            normalized

    };

}
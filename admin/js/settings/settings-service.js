// ============================================
// Settings Service
// 환경설정 처리
// ============================================

import {
    getSettings,
    saveSettings,
    updateSettings,
    resetSettings
} from "./settings-store.js";

// ============================================
// 설정값 정리
// ============================================

function normalizeBoolean(value) {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        return value === "true";
    }

    return Boolean(value);
}

function normalizeNumber(
    value,
    fallback = 0,
    min = null,
    max = null
) {
    let number = Number(value);

    if (!Number.isFinite(number)) {
        number = fallback;
    }

    if (
        min !== null &&
        number < min
    ) {
        number = min;
    }

    if (
        max !== null &&
        number > max
    ) {
        number = max;
    }

    return number;
}

// ============================================
// 설정 검증
// ============================================

export function validateSettings(
    values = {}
) {
    const errors = [];

    const counselingMinutes =
        normalizeNumber(
            values.counselingMinutes,
            50
        );

    const reminderMinutes =
        normalizeNumber(
            values.reminderMinutes,
            1
        );

    const aiTemperature =
        normalizeNumber(
            values.aiTemperature,
            0.4
        );

    const aiMaxTokens =
        normalizeNumber(
            values.aiMaxTokens,
            8192
        );

    if (
        counselingMinutes < 10 ||
        counselingMinutes > 180
    ) {
        errors.push(
            "상담 시간은 10분 이상 180분 이하로 설정해야 합니다."
        );
    }

    if (
        reminderMinutes < 0 ||
        reminderMinutes >= counselingMinutes
    ) {
        errors.push(
            "종료 안내 시간은 상담 시간보다 짧아야 합니다."
        );
    }

    if (
        aiTemperature < 0 ||
        aiTemperature > 2
    ) {
        errors.push(
            "AI 온도값은 0 이상 2 이하로 설정해야 합니다."
        );
    }

    if (
        aiMaxTokens < 256 ||
        aiMaxTokens > 32768
    ) {
        errors.push(
            "AI 최대 토큰은 256 이상 32768 이하로 설정해야 합니다."
        );
    }

    return {
        valid:
            errors.length === 0,

        errors
    };
}

// ============================================
// 설정 정규화
// ============================================

export function normalizeSettings(
    values = {}
) {
    return {
        clinicName:
            String(
                values.clinicName || ""
            ).trim(),

        counselorName:
            String(
                values.counselorName || ""
            ).trim(),

        reportApproval:
            normalizeBoolean(
                values.reportApproval
            ),

        autoSave:
            normalizeBoolean(
                values.autoSave
            ),

        aiEnabled:
            normalizeBoolean(
                values.aiEnabled
            ),

        aiModel:
            String(
                values.aiModel ||
                "gemini-2.5-flash-lite"
            ).trim(),

        aiTemperature:
            normalizeNumber(
                values.aiTemperature,
                0.4,
                0,
                2
            ),

        aiMaxTokens:
            normalizeNumber(
                values.aiMaxTokens,
                8192,
                256,
                32768
            ),

        counselingMinutes:
            normalizeNumber(
                values.counselingMinutes,
                50,
                10,
                180
            ),

        reminderMinutes:
            normalizeNumber(
                values.reminderMinutes,
                1,
                0,
                179
            ),

        pdfPageSize:
            [
                "A4",
                "Letter"
            ].includes(
                values.pdfPageSize
            )
                ? values.pdfPageSize
                : "A4",

        theme:
            [
                "light",
                "dark",
                "system"
            ].includes(
                values.theme
            )
                ? values.theme
                : "light",

        version:
            String(
                values.version ||
                "1.0.0"
            ).trim()
    };
}

// ============================================
// 전체 설정 저장
// ============================================

export function applySettings(
    values = {}
) {
    const normalized =
        normalizeSettings(values);

    const validation =
        validateSettings(normalized);

    if (!validation.valid) {
        return {
            success: false,
            errors:
                validation.errors,
            message:
                validation.errors[0]
        };
    }

    const saved =
        saveSettings(normalized);

    return {
        success: true,
        settings:
            saved
    };
}

// ============================================
// 일부 설정 변경
// ============================================

export function changeSettings(
    values = {}
) {
    const current =
        getSettings();

    return applySettings({
        ...current,
        ...values
    });
}

// ============================================
// AI 설정 변경
// ============================================

export function updateAiSettings({
    enabled,
    model,
    temperature,
    maxTokens
} = {}) {
    return changeSettings({
        aiEnabled:
            enabled,

        aiModel:
            model,

        aiTemperature:
            temperature,

        aiMaxTokens:
            maxTokens
    });
}

// ============================================
// 보고서 설정 변경
// ============================================

export function updateReportSettings({
    approval,
    pdfPageSize
} = {}) {
    return changeSettings({
        reportApproval:
            approval,

        pdfPageSize
    });
}

// ============================================
// 상담 설정 변경
// ============================================

export function updateCounselingSettings({
    counselingMinutes,
    reminderMinutes,
    autoSave
} = {}) {
    return changeSettings({
        counselingMinutes,
        reminderMinutes,
        autoSave
    });
}

// ============================================
// 기관정보 변경
// ============================================

export function updateClinicSettings({
    clinicName,
    counselorName
} = {}) {
    return changeSettings({
        clinicName,
        counselorName
    });
}

// ============================================
// 테마 변경
// ============================================

export function updateTheme(
    theme
) {
    const result =
        changeSettings({
            theme
        });

    if (result.success) {
        applyTheme(
            result.settings.theme
        );
    }

    return result;
}

// ============================================
// 테마 적용
// ============================================

export function applyTheme(
    theme
) {
    const root =
        document.documentElement;

    root.dataset.theme =
        theme || "light";

    return theme;
}

// ============================================
// 현재 설정 적용
// ============================================

export function initializeSettings() {
    const settings =
        getSettings();

    applyTheme(
        settings.theme
    );

    return settings;
}

// ============================================
// 설정 초기화
// ============================================

export function restoreDefaultSettings() {
    const settings =
        resetSettings();

    applyTheme(
        settings.theme
    );

    return {
        success: true,
        settings
    };
}

// ============================================
// 설정 내보내기
// ============================================

export function exportSettings() {
    const settings =
        getSettings();

    return JSON.stringify(
        settings,
        null,
        2
    );
}

// ============================================
// 설정 가져오기
// ============================================

export function importSettings(
    jsonText
) {
    try {
        const values =
            JSON.parse(jsonText);

        return applySettings(
            values
        );
    } catch (error) {
        return {
            success: false,
            message:
                "설정 파일 형식이 올바르지 않습니다."
        };
    }
}
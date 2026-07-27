// ============================================
// 심리평가 보고서 업무 처리
// ============================================


// report-store.js는 index.html에서 먼저 로드되는 기존 전역 스크립트입니다.
// ES Module인 이 서비스에서는 window.MMLReportStore를 호환 어댑터로 사용합니다.
function requireReportStore() {
    const store = typeof window !== "undefined" ? window.MMLReportStore : null;
    if (!store) {
        throw new Error("MMLReportStore가 아직 로드되지 않았습니다.");
    }
    return store;
}

function getReports() {
    return requireReportStore().loadAll();
}

function getReport(id) {
    return requireReportStore().getById(id);
}

function addReport(report) {
    const store = requireReportStore();
    store.saveReport(report);
    return store.getById(report.id);
}

function updateReport(id, changes = {}) {
    requireReportStore().updateReport(id, changes);
    return true;
}

function removeReport(id) {
    requireReportStore().deleteReport(id);
    return true;
}

import {
    REPORT_STATUS,
    REPORT_TYPES
} from "../core/constants.js";

import {
    uuid,
    deepCopy
} from "../core/utils.js";

// ============================================
// 보고서 상태 정규화
// ============================================

export function normalizeReportStatus(status) {
    const value = String(status || "").trim();

    const aliases = {
        draft: "draft",
        임시저장: "draft",
        작성중: "draft",

        saved: "saved",
        저장완료: "saved",
        저장: "saved",

        pending: "pending",
        승인대기: "pending",
        검토대기: "pending",

        approved: "approved",
        승인완료: "approved",
        승인: "approved",

        rejected: "rejected",
        반려: "rejected"
    };

    return aliases[value] || value || "draft";
}

// ============================================
// 보고서 유형 정규화
// ============================================

export function normalizeReportType(type) {
    const value = String(type || "").trim();

    const aliases = {
        individual: "individual",
        개별보고서: "individual",
        개별심리검사보고서: "individual",
        "개별 심리검사 보고서": "individual",

        comprehensive: "comprehensive",
        종합보고서: "comprehensive",
        심리검사종합결과보고서: "comprehensive",
        "심리검사 종합결과보고서": "comprehensive"
    };

    return aliases[value] || value || "individual";
}

// ============================================
// 보고서 유형명
// ============================================

export function getReportTypeLabel(type) {
    const normalized = normalizeReportType(type);

    if (normalized === "comprehensive") {
        return "심리검사 종합결과보고서";
    }

    return "개별 심리검사 보고서";
}

// ============================================
// 보고서 상태명
// ============================================

export function getReportStatusLabel(status) {
    const normalized = normalizeReportStatus(status);

    const labels = {
        draft: "작성중",
        saved: "저장완료",
        pending: "승인대기",
        approved: "승인완료",
        rejected: "반려"
    };

    return labels[normalized] || normalized;
}

// ============================================
// 검사명 정리
// ============================================

function normalizeTests(tests) {
    if (Array.isArray(tests)) {
        return [...new Set(
            tests
                .map(test => String(test || "").trim())
                .filter(Boolean)
        )];
    }

    if (typeof tests === "string") {
        return [...new Set(
            tests
                .split(/[,/|]/)
                .map(test => test.trim())
                .filter(Boolean)
        )];
    }

    return [];
}

// ============================================
// 보고서 생성
// ============================================

export function createReport(data = {}) {
    const now = new Date().toISOString();
    const type = normalizeReportType(data.type);
    const tests = normalizeTests(data.tests);

    const report = {
        id: data.id || uuid(),

        reservationId:
            String(data.reservationId || "").trim(),

        clientId:
            String(data.clientId || "").trim(),

        clientName:
            String(data.clientName || "").trim(),

        type,

        typeLabel:
            getReportTypeLabel(type),

        testName:
            String(data.testName || "").trim(),

        tests,

        title:
            String(
                data.title ||
                getReportTypeLabel(type)
            ).trim(),

        status:
            normalizeReportStatus(
                data.status || "draft"
            ),

        sections:
            deepCopy(data.sections || {}),

        content:
            deepCopy(data.content || {}),

        summary:
            String(data.summary || ""),

        recommendation:
            String(data.recommendation || ""),

        requestId:
            String(data.requestId || "").trim(),

        requestedAt:
            data.requestedAt || null,

        savedAt:
            data.savedAt || null,

        submittedAt:
            data.submittedAt || null,

        approvedAt:
            data.approvedAt || null,

        approvedBy:
            String(data.approvedBy || "").trim(),

        rejectedAt:
            data.rejectedAt || null,

        rejectionReason:
            String(data.rejectionReason || ""),

        isVisibleToClient:
            Boolean(data.isVisibleToClient),

        createdAt:
            data.createdAt || now,

        updatedAt:
            data.updatedAt || now
    };

    return addReport(report);
}

// ============================================
// 개별 심리검사 보고서 생성
// ============================================

export function createIndividualReport(
    data = {}
) {
    const tests = normalizeTests(
        data.tests ||
        data.testName
    );

    return createReport({
        ...data,
        type: "individual",
        testName:
            data.testName ||
            tests[0] ||
            "",
        tests,
        title:
            data.title ||
            (
                tests[0]
                    ? `${tests[0]} 개별 심리검사 보고서`
                    : "개별 심리검사 보고서"
            )
    });
}

// ============================================
// 종합결과보고서 생성
// ============================================

export function createComprehensiveReport(
    data = {}
) {
    return createReport({
        ...data,
        type: "comprehensive",
        tests: normalizeTests(data.tests),
        title:
            data.title ||
            "심리검사 종합결과보고서"
    });
}

// ============================================
// 보고서 수정
// ============================================

export function editReport(id, changes = {}) {
    const current = getReport(id);

    if (!current) {
        return {
            success: false,
            message:
                "보고서를 찾을 수 없습니다."
        };
    }

    const nextData = {
        ...changes,
        updatedAt:
            new Date().toISOString()
    };

    if (changes.status) {
        nextData.status =
            normalizeReportStatus(
                changes.status
            );
    }

    if (changes.type) {
        nextData.type =
            normalizeReportType(
                changes.type
            );

        nextData.typeLabel =
            getReportTypeLabel(
                changes.type
            );
    }

    if (changes.tests !== undefined) {
        nextData.tests =
            normalizeTests(
                changes.tests
            );
    }

    if (changes.sections !== undefined) {
        nextData.sections =
            deepCopy(changes.sections);
    }

    if (changes.content !== undefined) {
        nextData.content =
            deepCopy(changes.content);
    }

    const success =
        updateReport(
            id,
            nextData
        );

    return {
        success,
        report:
            success
                ? getReport(id)
                : current
    };
}

// ============================================
// 보고서 저장
// ============================================

export function saveReport(
    id,
    changes = {}
) {
    const now =
        new Date().toISOString();

    return editReport(id, {
        ...changes,
        status: "saved",
        savedAt: now
    });
}

// ============================================
// 승인 요청
// ============================================

export function submitReportForApproval(id) {
    const report = getReport(id);

    if (!report) {
        return {
            success: false,
            message:
                "보고서를 찾을 수 없습니다."
        };
    }

    if (
        !report.sections &&
        !report.content &&
        !report.summary
    ) {
        return {
            success: false,
            message:
                "보고서 내용을 먼저 작성해 주세요."
        };
    }

    return editReport(id, {
        status: "pending",
        submittedAt:
            new Date().toISOString(),
        isVisibleToClient: false
    });
}

// ============================================
// 보고서 승인
// 승인된 보고서만 사용자에게 표시
// ============================================

export function approveReport(
    id,
    approvedBy = ""
) {
    const report = getReport(id);

    if (!report) {
        return {
            success: false,
            message:
                "보고서를 찾을 수 없습니다."
        };
    }

    const now =
        new Date().toISOString();

    return editReport(id, {
        status: "approved",
        approvedAt: now,
        approvedBy:
            String(approvedBy || "").trim(),
        rejectedAt: null,
        rejectionReason: "",
        isVisibleToClient: true
    });
}

// ============================================
// 보고서 승인 취소
// ============================================

export function revokeReportApproval(id) {
    const report = getReport(id);

    if (!report) {
        return {
            success: false,
            message:
                "보고서를 찾을 수 없습니다."
        };
    }

    return editReport(id, {
        status: "saved",
        approvedAt: null,
        approvedBy: "",
        isVisibleToClient: false
    });
}

// ============================================
// 보고서 반려
// ============================================

export function rejectReport(
    id,
    reason = ""
) {
    const report = getReport(id);

    if (!report) {
        return {
            success: false,
            message:
                "보고서를 찾을 수 없습니다."
        };
    }

    return editReport(id, {
        status: "rejected",
        rejectedAt:
            new Date().toISOString(),
        rejectionReason:
            String(reason || "").trim(),
        approvedAt: null,
        approvedBy: "",
        isVisibleToClient: false
    });
}

// ============================================
// 보고서 초안으로 되돌리기
// ============================================

export function moveReportToDraft(id) {
    return editReport(id, {
        status: "draft",
        submittedAt: null,
        approvedAt: null,
        approvedBy: "",
        rejectedAt: null,
        rejectionReason: "",
        isVisibleToClient: false
    });
}

// ============================================
// 보고서 복제
// ============================================

export function duplicateReport(id) {
    const report = getReport(id);

    if (!report) {
        return {
            success: false,
            message:
                "보고서를 찾을 수 없습니다."
        };
    }

    const copy = deepCopy(report);

    delete copy.id;

    copy.title =
        `${report.title || "보고서"} 복사본`;

    copy.status = "draft";
    copy.savedAt = null;
    copy.submittedAt = null;
    copy.approvedAt = null;
    copy.approvedBy = "";
    copy.rejectedAt = null;
    copy.rejectionReason = "";
    copy.isVisibleToClient = false;
    copy.createdAt =
        new Date().toISOString();
    copy.updatedAt =
        new Date().toISOString();

    return {
        success: true,
        report:
            createReport(copy)
    };
}

// ============================================
// 보고서 삭제
// ============================================

export function deleteReport(id) {
    const report = getReport(id);

    if (!report) {
        return {
            success: false,
            message:
                "보고서를 찾을 수 없습니다."
        };
    }

    removeReport(id);

    return {
        success: true,
        deletedReport: report
    };
}

// ============================================
// 예약별 보고서 조회
// ============================================

export function getReportsByReservation(
    reservationId
) {
    const target =
        String(reservationId || "").trim();

    return getReports().filter(
        report =>
            String(
                report.reservationId || ""
            ) === target
    );
}

// ============================================
// 내담자별 보고서 조회
// ============================================

export function getReportsByClient(clientId) {
    const target =
        String(clientId || "").trim();

    return getReports().filter(
        report =>
            String(
                report.clientId || ""
            ) === target
    );
}

// ============================================
// 사용자 열람 가능 보고서
// ============================================

export function getClientVisibleReports(
    clientId
) {
    return getReportsByClient(clientId)
        .filter(report =>
            normalizeReportStatus(
                report.status
            ) === "approved" &&
            report.isVisibleToClient === true
        );
}

// ============================================
// 중복 보고서 확인
// ============================================

export function findMatchingReport({
    reservationId = "",
    type = "",
    testName = ""
} = {}) {
    const normalizedType =
        normalizeReportType(type);

    return getReports().find(report => {
        const sameReservation =
            String(
                report.reservationId || ""
            ) ===
            String(reservationId || "");

        const sameType =
            normalizeReportType(
                report.type
            ) === normalizedType;

        if (
            normalizedType ===
            "individual"
        ) {
            return (
                sameReservation &&
                sameType &&
                String(
                    report.testName || ""
                ) ===
                String(testName || "")
            );
        }

        return (
            sameReservation &&
            sameType
        );
    });
}
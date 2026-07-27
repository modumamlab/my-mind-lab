// ============================================
// 심리평가센터 이벤트
// ============================================

import {
    saveReport,
    submitReportForApproval,
    approveReport,
    rejectReport,
    revokeReportApproval,
    moveReportToDraft,
    duplicateReport,
    deleteReport
} from "./report-service.js";

// ============================================
// 이벤트 등록
// ============================================

export function registerReportEvents(root = document) {

    // 저장
    root.querySelectorAll("[data-action='save-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                saveReport(button.dataset.id);

            });

        });

    // 승인 요청
    root.querySelectorAll("[data-action='submit-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                submitReportForApproval(
                    button.dataset.id
                );

            });

        });

    // 승인
    root.querySelectorAll("[data-action='approve-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                approveReport(
                    button.dataset.id
                );

            });

        });

    // 승인 취소
    root.querySelectorAll("[data-action='revoke-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                revokeReportApproval(
                    button.dataset.id
                );

            });

        });

    // 반려
    root.querySelectorAll("[data-action='reject-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                const reason = prompt(
                    "반려 사유를 입력하세요."
                );

                rejectReport(
                    button.dataset.id,
                    reason || ""
                );

            });

        });

    // 초안으로 되돌리기
    root.querySelectorAll("[data-action='draft-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                moveReportToDraft(
                    button.dataset.id
                );

            });

        });

    // 복사
    root.querySelectorAll("[data-action='duplicate-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                duplicateReport(
                    button.dataset.id
                );

            });

        });

    // 삭제
    root.querySelectorAll("[data-action='delete-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                if (!confirm("보고서를 삭제하시겠습니까?")) {

                    return;

                }

                deleteReport(
                    button.dataset.id
                );

            });

        });

    // 미리보기
    root.querySelectorAll("[data-action='preview-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                document.dispatchEvent(
                    new CustomEvent(
                        "report:preview",
                        {
                            detail: {
                                id: button.dataset.id
                            }
                        }
                    )
                );

            });

        });

    // 수정
    root.querySelectorAll("[data-action='edit-report']")
        .forEach(button => {

            button.addEventListener("click", () => {

                document.dispatchEvent(
                    new CustomEvent(
                        "report:edit",
                        {
                            detail: {
                                id: button.dataset.id
                            }
                        }
                    )
                );

            });

        });

}
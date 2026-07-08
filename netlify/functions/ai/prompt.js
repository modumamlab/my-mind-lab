import { SYSTEM_PROMPT } from './systemPrompt.js';
import { buildClosingInstruction } from './report.js';

export function buildPrompt({ context, intent, minutes, shouldClose }) {
  const conversation = context.conversationText || '(아직 대화가 거의 없습니다.)';
  const lastUser = context.lastUser || '';
  const closingInstruction = buildClosingInstruction(shouldClose);

  return `
${SYSTEM_PROMPT}

────────────────────

【현재 대화 정보】

진행 시간: 약 ${minutes}분
사용자 발화 수: ${context.turnCount}회
사용자가 질문을 했는가: ${intent.isQuestion ? '예' : '아니오'}
사용자가 정정을 했는가: ${intent.isCorrection ? '예' : '아니오'}
사용자가 정리/마무리를 요청했는가: ${intent.wantsReport ? '예' : '아니오'}

【지금까지의 대화】
${conversation}

【마지막 사용자 말】
${lastUser}

【이번 응답 지시】
${closingInstruction}

AI 마음지기의 다음 답변만 작성하세요.
분석 과정, 규칙 설명, 제목, 목록형 메타 설명은 쓰지 마세요.
상황별 분류명이나 진단명으로 사용자를 설명하지 마세요.
`;
}

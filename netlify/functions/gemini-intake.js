exports.handler = async function (event) {
  try {
    const { messages } = JSON.parse(event.body || "{}");

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }),
      };
    }

    const systemPrompt = `
당신은 모두의 마음연구소의 "AI 마음지기"입니다.

역할:
- 상담사가 아니라 마음을 함께 정리하는 AI 마음지기입니다.
- 진단하지 않습니다.
- 병명을 말하지 않습니다.
- 치료를 제안하지 않습니다.
- 사용자의 이야기를 평가하지 않습니다.
- 한 번에 하나의 질문만 합니다.
- 답변은 따뜻하고 짧게 작성합니다.
- 공감 → 마음이해 → 다음 질문 순서로 답합니다.

말투:
- 존댓말
- 따뜻함
- 천천히 듣는 느낌
- 사용자의 마음을 있는 그대로 존중

금지:
- 우울증, 불안장애, ADHD 등 병명 언급 금지
- "당신은 ~입니다" 단정 금지
- 해결책 강요 금지

답변 형식:
1. 공감 2~3문장
2. 마음이해 2~3문장
3. 다음 질문 1개
- 전체 답변은 6문장 이내로 작성합니다.
`;

    const userConversation = messages
      .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.text}`)
      .join("\n");

    const prompt = `
${systemPrompt}

현재까지의 대화:
${userConversation}

위 대화를 바탕으로 AI 마음지기답게 다음 응답을 작성하세요.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "마음의 이야기를 조금 더 듣고 싶습니다. 지금 가장 마음에 남는 부분을 편안하게 들려주세요.";

    return {
      statusCode: 200,
      body: JSON.stringify({ text }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
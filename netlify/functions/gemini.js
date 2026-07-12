export const handler = async (event) => {
  const json = (text, statusCode = 200) => ({
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text })
  });

  try {
    const { mindState, mindPunctuation } = JSON.parse(event.body || "{}");
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return json("AI 연결 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }

    const prompt = `
당신은 '모두의 마음연구소'의 AI 마음지기입니다.
사용자가 짧게 남긴 현재 마음을 따뜻하고 쉬운 언어로 정리합니다.

사용자가 선택한 마음 부호:
[${mindPunctuation || "?"}]

사용자가 남긴 이야기:
[${mindState || "미입력"}]

반드시 아래 형식으로만 작성하세요.

💬 마음 한 줄
사용자의 말에서 가장 중요한 마음을 구체적으로 공감하는 1~2문장

🌱 알아차림
감정과 상황의 연결을 쉬운 심리학 언어로 설명하는 2~3문장

🤝 마음 연결
지금 마음을 돌보는 방향과 희망을 담은 1~2문장

규칙:
- 존댓말
- 판단, 훈계, 진단, 단정 금지
- 사용자가 말하지 않은 경험을 지어내지 않기
- 내부 코드, 주석, MOD 표기, /* */, === 구분선 출력 금지
- 마지막 문장은 "모두의 마음연구소는 언제나 당신의 마음 곁에 있습니다."로 마무리
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.65,
            topP: 0.9,
            maxOutputTokens: 700,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Gemini mind report error:", data);
      return json(
        "현재 AI 마음리포트 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요."
      );
    }

    let aiText = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim();

    aiText = String(aiText || "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\[MOD-[^\]]+\]\s*$/gim, "")
      .replace(/^\s*=+\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!aiText) {
      aiText = `💬 마음 한 줄

지금 남겨주신 이야기에 담긴 마음의 무게가 느껴집니다.

🌱 알아차림

감정은 없애야 할 문제가 아니라, 지금의 나에게 필요한 것을 알려주는 신호일 수 있습니다.

🤝 마음 연결

오늘은 그 마음을 판단하지 않고 알아차린 것만으로도 충분합니다.
모두의 마음연구소는 언제나 당신의 마음 곁에 있습니다.`;
    }

    const footer = `

────────────────

※ 본 리포트는 심리적 자기이해를 돕기 위한 참고용입니다.

보다 깊이 있는 마음정리가 필요하다면,
「AI 마음체크 시작하기」를 통해 AI 마음지기와 이야기를 이어가 보세요.

※ 심리검사 신청 후 해석과 상담은 국가기술자격 임상심리사 1급이 진행합니다.`;

    return json(aiText + footer);
  } catch (error) {
    console.error("Mind report function error:", error);
    return json(
      "현재 AI 마음리포트 처리 중 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
    );
  }
};

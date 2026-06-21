exports.handler = async (event) => {
  try {
    const { mindState, mindPunctuation } = JSON.parse(event.body || "{}");

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          text: "GEMINI_API_KEY가 Netlify 환경변수에 설정되지 않았습니다."
        })
      };
    }

    const prompt = `
당신은 '모두의 마음연구소' 소속의 따뜻하고 통찰력 있는 시니어 심리상담사입니다.

사용자가 선택한 마음의 부호는 [${mindPunctuation || "?"}] 입니다.
사용자의 사연은 [${mindState || "미입력"}] 입니다.

아래 기준으로 답변해 주세요.
1. 현재 마음을 먼저 공감해 주세요.
2. 왜 이런 상태일 수 있는지 부드럽게 설명해 주세요.
3. 지금 해볼 수 있는 작은 행동을 제안해 주세요.
4. 필요하면 모두의 마음연구소 상담 예약을 안내해 주세요.

친근하고 따뜻한 존댓말로 3~4문장만 작성해 주세요.
빈 줄 없이 줄바꿈만 사용해 주세요.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          text:
            "Gemini API 오류: " +
            (data?.error?.message || JSON.stringify(data))
        })
      };
    }

    const aiText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      `현재 AI 사용량이 많아 마음리포트 연결이 원활하지 않습니다.
다만 남겨주신 내용을 보면 "${mindState || "현재 마음"}"와 관련된 고민이 느껴집니다.
아래 Kanana AI 마음리포트를 이용해 보시거나, 보다 전문적인 심리검사와 상담이 필요하시다면 상담 예약하기를 이용해 주세요.`;

    return {
      statusCode: 200,
      body: JSON.stringify({
        text: aiText
      })
    };
  } catch (error) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        text: "Function Error: " + error.message
      })
    };
  }
};

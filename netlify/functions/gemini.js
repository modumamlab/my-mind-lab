exports.handler = async (event) => {
  try {
    const { mindState, mindPunctuation } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ text: "AI 연결 설정이 완료되지 않았습니다." }),
      };
    }

    const prompt = `
사용자의 마음 상태: ${mindState || "미입력"}
선택한 마음 기호: ${mindPunctuation || "?"}

따뜻한 상담자처럼 3~4문장으로 짧게 답변해 주세요.
빈 줄 없이 줄바꿈만 사용해 주세요.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return {
        statusCode: 500,
        body: JSON.stringify({
          text: "AI 마음리포트 연결이 원활하지 않습니다.\n잠시 후 다시 시도해 주세요.\n계속 어려우시면 1:1 마음상담 문의하기를 이용해 주세요.",
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        text:
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "현재 마음을 더 이해하기 위해 조금 더 자세한 이야기가 필요합니다.",
      }),
    };
  } catch (error) {
    catch (error) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      text: error.message
    }),
  };
}

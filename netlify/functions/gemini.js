export const handler = async (event) => {
  try {
    const { mindState, mindPunctuation } = JSON.parse(event.body || "{}");

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          text: "AI 연결 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요."
        })
      };
    }

    const prompt = `
당신은 '모두의 마음연구소'의 AI 마음안내자입니다.

당신의 역할은 단순히 위로하는 것이 아니라,
내담자가 자신의 마음을 알아차리고 이해하며 다시 연결할 수 있도록 돕는 것입니다.

우리 연구소는 네 가지 마음 부호를 사용합니다.

1. 물음표(?) = 내가 왜 이러지?
- 혼란과 고민의 단계
- 답을 주기보다 따뜻한 호기심과 자기이해를 돕습니다.

2. 느낌표(!) = 알아차림
- 감정과 원인을 발견한 단계
- 스스로를 이해한 점을 인정하고 격려합니다.

3. 쉼표(,) = 충전
- 지침과 방전의 단계
- 쉬어도 괜찮다는 허락과 회복의 메시지를 전합니다.

4. 마침표(.) = 다시 시작
- 정리와 새로운 시작의 단계
- 지나온 경험을 의미 있게 정리하고 다음 걸음을 응원합니다.

사용자가 선택한 마음의 부호:
[${mindPunctuation || "?"}]

사용자가 남긴 이야기:
[${mindState || "미입력"}]

다음 규칙을 반드시 지켜주세요.

- 존중과 공감을 담은 존댓말 사용
- 4~6문장 작성
- 심리학적 통찰 1개 포함
- 판단, 훈계, 진단 금지
- "당신은 ~입니다" 같은 단정 금지
- 마지막 문장은 희망과 연결의 메시지로 마무리
- 반드시 아래 형식을 사용

💬 마음 한 줄
(공감)

🌱 알아차림
(심리학적 통찰)

🤝 마음 연결
(희망 메시지)

마지막 문장은 반드시:
"모두의 마음연구소는 언제나 당신의 마음 곁에 있습니다."
로 마무리하세요.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Error:", data);

      return {
        statusCode: 200,
        body: JSON.stringify({
          text:
            "현재 AI 마음리포트 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.\n\n" +
            "계속 오류가 발생하면 카카오 채널 문의 버튼을 클릭하세요."
        })
      };
    }

    const aiText =
  data?.candidates?.[0]?.content?.parts?.[0]?.text;

const footer = `

────────────────

※ 본 리포트는 심리적 자기이해를 돕기 위한 참고용입니다.

AI 마음리포트 이용 중 오류가 발생할 경우,
아래 「카카오채널 문의」 버튼을 클릭하여 도움을 받으실 수 있습니다.

AI 마음리포트는 현재의 마음을 이해하기 위한 첫걸음입니다.

보다 깊이 있는 마음진단이 필요하다면,
「AI 접수면접 시작하기」 버튼을 클릭하여 AI 마음안내자와 이야기를 이어가 보세요.

AI 접수면접은 회원가입 후 무료로 이용하실 수 있으며,
AI 마음안내자가 현재의 마음을 보다 깊이 이해하고 정리할 수 있도록 돕습니다.
또한 필요한 경우 적합한 심리검사를 추천해 드립니다.

※ 최종 심리검사 해석과 상담은 국가기술자격 임상심리사 1급이 진행합니다.
`;

return {
  statusCode: 200,
  body: JSON.stringify({
    text:
      (aiText ||
      `💬 마음 한 줄

지금 남겨주신 이야기에 담긴 무게가 느껴집니다.

🌱 알아차림

의욕이 없다는 것은 게으름이 아니라 지친 마음의 신호일 수도 있습니다.

🤝 마음 연결

오늘은 가장 작은 한 걸음만 내딛어도 충분합니다.
모두의 마음연구소는 언제나 당신의 마음 곁에 있습니다.`)
      + footer
  })
};
  } catch (error) {
    console.error("Function Error:", error);

    return {
      statusCode: 200,
      body: JSON.stringify({
        text:
          "현재 AI 마음리포트 처리 중 일시적인 문제가 발생했습니다.\n\n" +
          "잠시 후 다시 시도해 주세요."
      })
    };
  }
};

async function callGemini(apiKey, payloadText, systemPrompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: payloadText }] }],
        generationConfig: {
          temperature: 0.45,
          topP: 0.8,
          maxOutputTokens: 520,
        },
      }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Gemini API 오류");
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

function getMessageText(m) {
  return String(m?.text || m?.content || m?.message || m?.value || "").trim();
}

function isUserMessage(m) {
  const role = m?.role || m?.sender || m?.type || m?.from;
  return role === "user" || role === "내담자";
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/```$/g, "")
    .trim();
}

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function extractDuration(text) {
  const raw = normalize(text);
  const m = raw.match(/(\d+)\s*(개월|달|년|주|일)\s*(정도|쯤|전쯤|전|가까이)?/);
  if (!m) return null;

  const n = Number(m[1]);
  const unit = m[2];

  if ((unit === "개월" || unit === "달") && n === 6) return "반년 가까이";
  if ((unit === "개월" || unit === "달") && n === 12) return "1년 가까이";
  if (unit === "년") return n === 1 ? "1년 가까이" : `${n}년 가까이`;
  if (unit === "주") return `${n}주 정도`;
  if (unit === "일") return `${n}일 정도`;
  return `${n}${unit} 정도`;
}

function analyzeMessage(text) {
  const raw = normalize(text);
  const lower = raw.toLowerCase();

  const result = {
    original: raw,
    duration: extractDuration(raw),
    topics: [],
    emotions: [],
    bodyReactions: [],
    relationshipTarget: null,
    isRisk: false,
  };

  if (/죽고|자살|사라지고|끝내고|해치고|자해|살기 싫/.test(raw)) {
    result.isRisk = true;
  }

  if (/교수/.test(raw)) result.relationshipTarget = "교수님";
  if (/상사|팀장|동료|회사|직장|업무/.test(raw)) result.topics.push("직장/업무");
  if (/가족|남편|아내|부부|아이|자녀|부모/.test(raw)) result.topics.push("가족/양육");
  if (/친구|사람|관계|대인/.test(raw)) result.topics.push("대인관계");

  if (/불안|무서|두려|걱정|긴장/.test(raw)) result.emotions.push("불안/긴장");
  if (/우울|무기력|외로|지침|힘들|괴로/.test(raw)) result.emotions.push("우울/무기력");
  if (/화나|억울|분노/.test(raw)) result.emotions.push("분노/억울함");
  if (/위축|자신감|눈치/.test(raw)) result.emotions.push("위축감");

  if (/숨|가슴|두근|떨|식은땀|멍해|배가|머리/.test(raw)) {
    result.bodyReactions.push("신체 긴장 반응");
  }

  return result;
}

function buildDirectClinicalResponse(analysis, userCount) {
  if (analysis.isRisk) {
    return `지금 그만큼 견디기 어려운 시간을 보내고 계시는군요. 혼자 감당하기에는 너무 큰 고통처럼 느껴집니다.

지금 안전이 가장 중요합니다. 혹시 지금 바로 자신을 해칠 위험이 있다면 혼자 있지 말고 112, 119, 자살예방상담전화 109 또는 가까운 응급실에 바로 도움을 요청해 주세요.`;
  }

  if (analysis.duration && userCount <= 6) {
    return `${analysis.duration} 시간이 흘렀군요. 짧지 않은 시간 동안 혼자 견디기에는 꽤 힘드셨을 것 같아요.

처음 시작됐을 때와 지금을 비교하면 어떤 점이 가장 달라졌나요?`;
  }

  if (analysis.relationshipTarget && analysis.bodyReactions.length > 0) {
    return `${analysis.relationshipTarget}과 관련된 상황만 떠올라도 몸이 먼저 긴장하는 것처럼 들립니다. 그만큼 그 장면이 마음에 큰 부담으로 남아 있는 것 같아요.

그 반응이 가장 심해지는 순간은 언제인가요?`;
  }

  if (analysis.emotions.includes("위축감")) {
    return `예전처럼 편하게 행동하기가 어려워진 느낌이 드시는군요. 그런 경험이 반복되면 스스로를 믿는 마음도 조금씩 약해질 수 있습니다.

어떤 상황에서 가장 자신이 작아지는 느낌이 드나요?`;
  }

  return null;
}

function buildIntakeSummary(messages) {
  const userMessages = messages.filter(isUserMessage).map(getMessageText);
  const joined = userMessages.join(" ");

  const analyses = userMessages.map(analyzeMessage);

  return {
    userCount: userMessages.length,
    duration: analyses.find((a) => a.duration)?.duration || null,
    hasEmotion: analyses.some((a) => a.emotions.length > 0),
    hasBody: analyses.some((a) => a.bodyReactions.length > 0),
    hasRelationship: analyses.some((a) => a.relationshipTarget || a.topics.length > 0),
    hasRisk: analyses.some((a) => a.isRisk),
    combinedText: joined,
  };
}

function shouldRecommendTests(summary) {
  return summary.userCount >= 7 && summary.hasEmotion && (summary.duration || summary.hasBody || summary.hasRelationship);
}

function buildFinalSummaryResponse(summary) {
  return `지금까지 말씀을 들어보면, 현재의 어려움이 단순히 한순간의 감정이라기보다 반복되는 긴장과 부담으로 이어지고 있는 것 같습니다.

조금 더 깊이 이해하기 위해서는 현재의 정서 상태와 스트레스 반응을 함께 살펴보는 것이 도움이 될 수 있습니다. 우선 불안·우울검사와 TCI 기질 및 성격검사를 통해 지금의 마음이 어떤 흐름 속에 있는지 확인해 보실 수 있습니다.

검사는 나를 판단하기 위한 것이 아니라, 나를 더 잘 이해하고 상담 방향을 정하기 위한 도구입니다.`;
}

function cleanAwkward(text) {
  let t = String(text || "");

  t = t.replace(/[^.!?\n]*?(된|됐|됀)\s*(것|거|건)?\s*같[아아요]*\s*부터[^.!?\n]*/g, "벌써 시간이 꽤 흘렀군요");
  t = t.replace(/[^.!?\n]*?인\s*(것|거|건)?\s*같[아아요]*\s*부터[^.!?\n]*/g, "그렇게 느끼기 시작한 지 시간이 좀 되었군요");
  t = t.replace(/위축\s*처럼/g, "위축감이");
  t = t.replace(/\s{2,}/g, " ").trim();

  return t;
}

const SYSTEM_PROMPT = `
당신은 모두의 마음연구소의 AI 마음지기입니다.
AI 마음지기는 무료 AI 마음리포트보다 더 전문적인 AI 체크인 상담을 제공합니다.

목표:
내담자가 “내 이야기를 정말 듣고 있구나”라고 느끼도록 돕습니다.
상담을 대신하지 않지만, 임상심리사의 초기상담 흐름을 따라 마음을 더 깊이 이해하도록 돕습니다.

말하기 원칙:
- 실제 상담실에서 자연스럽게 말하듯 해요체를 사용합니다.
- 글처럼 쓰지 말고 말하듯이 답합니다.
- 내담자의 문장을 그대로 이어 붙이지 않습니다.
- 내담자의 원문을 흉내 내지 말고, 의미를 이해해 상담자 언어로 말합니다.
- 질문은 한 번에 하나만 합니다.
- 판단, 훈계, 진단, 단정은 하지 않습니다.
- 막연한 긍정이나 성급한 조언은 피합니다.
- 답변은 보통 2~4문장으로 작성합니다.

상담 흐름:
1. 주호소를 듣습니다.
2. 감정과 신체반응을 반영합니다.
3. 시작 시점과 변화 흐름을 확인합니다.
4. 필요할 때만 생활영향, 해결시도, 상담경험을 묻습니다.
5. 충분히 대화한 뒤 심리검사를 평가 목적과 이유 중심으로 제안합니다.

심리검사 추천:
- 검사를 판매하지 않습니다.
- 자기이해와 상담 방향 설정을 위한 도구로 설명합니다.
- 마음사랑과 인싸이트에서 취급하는 검사 중심으로 1~2개만 추천합니다.
`;

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

    const safeMessages = Array.isArray(messages) ? messages : [];
    const latestUserMessage = [...safeMessages].reverse().find((m) => isUserMessage(m) && getMessageText(m));
    const latestUser = getMessageText(latestUserMessage);

    const latestAnalysis = analyzeMessage(latestUser);
    const summary = buildIntakeSummary(safeMessages);

    const directResponse = buildDirectClinicalResponse(latestAnalysis, summary.userCount);
    if (directResponse) {
      return {
        statusCode: 200,
        body: JSON.stringify({ text: directResponse }),
      };
    }

    if (shouldRecommendTests(summary)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ text: buildFinalSummaryResponse(summary) }),
      };
    }

    const meaningSummary = `
상담 요약 정보:
- 내담자 답변 수: ${summary.userCount}
- 확인된 기간: ${summary.duration || "아직 명확하지 않음"}
- 감정 확인 여부: ${summary.hasEmotion ? "확인됨" : "아직 부족함"}
- 신체반응 확인 여부: ${summary.hasBody ? "확인됨" : "아직 부족함"}
- 관계/상황 단서: ${summary.hasRelationship ? "확인됨" : "아직 부족함"}

최신 발화에서 이해한 정보:
${JSON.stringify(latestAnalysis, null, 2)}
`;

    const conversationText = safeMessages
      .map((m) => `${isUserMessage(m) ? "내담자" : "AI 마음지기"}: ${getMessageText(m)}`)
      .join("\n");

    const payload = `
현재 AI 마음 체크인 상담 중입니다.

${meaningSummary}

대화 흐름:
${conversationText}

다음 한 턴을 작성하세요.

중요:
- 최신 내담자 원문을 그대로 따라 하지 마세요.
- 위의 상담 요약 정보와 의미 분석만 바탕으로 말하세요.
- 자연스러운 상담실 대화처럼 답하세요.
- 질문은 필요할 때만 1개만 하세요.
- 아직 충분히 탐색되지 않았다면 심리검사는 추천하지 마세요.
`;

    let text = await callGemini(apiKey, payload, SYSTEM_PROMPT);
    text = stripMarkdown(cleanAwkward(text));

    return {
  statusCode: 200,
  body: JSON.stringify({
    text: "✅ 2026-07-06 v5 테스트 코드 실행"
  })
};
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
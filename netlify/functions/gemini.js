exports.handler = async (event) => {
try {
const { mindState, mindPunctuation } = JSON.parse(event.body || "{}");

const apiKey = process.env.GEMINI_API_KEY;

const prompt = `
 당신은 '모두의 마음연구소' 소속의 따뜻하고 통찰력 있는 시니어 심리상담사입니다. 
                    질문한 내담자가 마주하고 있는 감정 단계에 따라 깊은 공감과 따뜻한 심리학적 통찰을 선사해야 합니다.
                    우리는 4가지 부호를 바탕으로 상담을 전개합니다:
                    1. 물음표(?): '내가왜이러지?' 단계. 마음이 보내는 혼란스러운 질문에 따뜻한 호기심을 유도합니다.
                    2. 느낌표(!): '알아차림' 단계. 자신이 겪는 감정의 기저 원인을 알아챌 수 있도록 격려합니다.
                    3. 쉼표(,): '충전' 단계. 모든 일을 멈추고 온전한 휴식을 누려도 되는 마음적 정당성을 부여합니다.
                    4. 마침표(.): '다시 시작' 단계. 과거의 번뇌를 매듭짓고 건강한 새로운 문장을 쓸 수 있도록 용기를 줍니다.

                    사용자가 선택한 현재 마음의 부호는 [${mindPunctuation}] 이며, 사용자의 사연은 [${mindState}] 입니다.
                    이 사연에 초점을 맞추어 위로를 전하되, '모두의 마음연구소'가 당신의 곁에 있음을 상기시켜주세요.
                    친근하고 따뜻한 격식체(존댓말)로 3~4문장 분량의 핵심 상담 코멘트를 작성해주십시오. 마크다운 스타일을 활용해 예쁘게 작성해 주면 더 좋습니다.
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

return {
  statusCode: 200,
  body: JSON.stringify({
    text:
data?.candidates?.[0]?.content?.parts?.[0]?.text ||
"현재 AI 사용량이 많아 연결이 원활하지 않습니다.\n\n지금 내 마음 상태가 궁금하다면 아래 1:1 마음상담 문의하기를 이용해 주세요.\n\n보다 전문적인 심리검사와 상담이 필요하시다면 상담 예약하기를 이용해 주세요."
  })
};
} catch (error) {
return {
statusCode: 500,
body: JSON.stringify({
text: error.message
})
};
}
};

import { buildContext } from './ai-checkin-v17/contextEngine.js';
import { analyzeIntent } from './ai-checkin-v17/intentEngine.js';
import { detectSafety, makeCrisisReply } from './ai-checkin-v17/safetyEngine.js';
import { buildCheckinPrompt } from './ai-checkin-v17/promptEngine.js';
import { postProcess } from './ai-checkin-v17/postProcess.js';

const PROMPT_VERSION = 'v23-stable-ai-dialogue';

const jsonResponse = (obj, statusCode = 200) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  },
  body: JSON.stringify(obj)
});

async function callGemini({ apiKey, prompt, intent, enoughForSummary }) {
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: intent.mode === 'answer_question' ? 0.45 : 0.62,
      topP: 0.9,
      topK: 32,
      maxOutputTokens: enoughForSummary ? 1100 : 520
    }
  };

  let lastError = null;
  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return { data, model };
      }
      lastError = { model, status: response.status, data };
      console.error('[MODUMAM v23] Gemini error', lastError);
    } catch (error) {
      lastError = { model, error: error.message };
      console.error('[MODUMAM v23] Gemini fetch error', lastError);
    }
  }
  const error = new Error('Gemini API call failed');
  error.detail = lastError;
  throw error;
}

export const handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({}, 200);
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  try {
    const body = JSON.parse(event.body || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const sessionStart = Number(body.sessionStart || Date.now());
    const minutes = Math.max(0, Math.round((Date.now() - sessionStart) / 60000));

    const context = buildContext(messages);
    const safety = detectSafety(context.allUserText);
    const intent = analyzeIntent(context);
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (safety.crisis) {
      return jsonResponse({
        text: makeCrisisReply(),
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        engine: { context: 'ON', intent: intent.mode, fallback: 'OFF', safety: 'CRISIS' }
      });
    }

    if (!apiKey) {
      return jsonResponse({
        error: 'GEMINI_API_KEY is missing',
        text: 'AI 마음지기 연결 설정이 아직 완료되지 않았습니다. Netlify 환경변수에서 GEMINI_API_KEY를 확인해 주세요.',
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        engine: { context: 'ON', intent: intent.mode, fallback: 'OFF', safety: 'OK' }
      }, 503);
    }

    const askedSummary = intent.wantsReport;
    const enoughForSummary = askedSummary || minutes >= 12 || context.turnCount >= 12;
    const prompt = buildCheckinPrompt({ context, intent, minutes, enoughForSummary });

    const { data, model } = await callGemini({ apiKey, prompt, intent, enoughForSummary });
    let text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n').trim();

    if (!text) {
      return jsonResponse({
        error: 'Gemini response is empty',
        text: 'AI 마음지기 응답이 비어 있어 답변을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        engine: { context: 'ON', intent: intent.mode, fallback: 'OFF', safety: 'OK', model }
      }, 502);
    }

    text = postProcess(text);

    return jsonResponse({
      text,
      isComplete: enoughForSummary || /제가\s*지금까지\s*이해한\s*마음/.test(text),
      promptVersion: PROMPT_VERSION,
      engine: { context: 'ON', intent: intent.mode, fallback: 'OFF', safety: 'OK', model, themes: intent.themes }
    });
  } catch (error) {
    console.error('[MODUMAM v23] handler error', error.detail || error);
    return jsonResponse({
      error: 'AI mindjigi handler error',
      text: 'AI 마음지기 연결 중 오류가 발생했습니다. 정해진 상담 문장으로 대신 답하지 않겠습니다. 잠시 후 다시 시도해 주세요.',
      isComplete: false,
      promptVersion: PROMPT_VERSION,
      engine: { context: 'ON', fallback: 'OFF', safety: 'UNKNOWN' }
    }, 500);
  }
};

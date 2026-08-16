const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

const STORE_NAME = 'modumam-reservations-v1';
const KEY = 'reservations';

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  },
  body: JSON.stringify(body)
});

const text = (v, n = 500) => String(v || '').trim().slice(0, n);
const normalizePhone = (v) => text(v, 40).replace(/[^0-9]/g, '');
const allowedProviders = new Set(['마음사랑', '인싸이트']);
const allowedTests = new Set(['TCI', 'JTCI', 'MMPI-2', 'MMPI-A', 'PAI', 'PAT-2', 'STS', 'K-CDI']);

function token() {
  return crypto.randomBytes(24).toString('hex');
}

function rows(v) {
  return (Array.isArray(v) ? v : []).filter(r => r && r.id !== undefined && r.id !== null);
}

function publicStatus(status) {
  const s = text(status, 40);
  if (['결과업로드', '분석완료', '보고서작성', '보고서승인', '완료'].includes(s)) {
    return s === '보고서승인' || s === '완료' ? '리포트승인' : '검사완료';
  }
  if (['검사진행', '검사진행중'].includes(s)) return '검사진행중';
  if (['검사안내발송', '예약승인'].includes(s)) return '검사안내발송';
  return '신청접수';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(204, {});

  // 기존 reservations-api.js와 동일한 Netlify Blobs 초기화 방식
  try {
    connectLambda?.(event);
  } catch (error) {
    console.error('[app-assessment-api] connectLambda failed', error);
  }

  let store;
  try {
    store = getStore(STORE_NAME);
  } catch (error) {
    console.error('[app-assessment-api] getStore failed', error);
    return response(503, {
      ok: false,
      error: '서버 저장소 연결에 실패했습니다.',
      detail: String(error?.message || error)
    });
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return response(400, { ok: false, error: '요청 형식이 올바르지 않습니다.' });
    }

    const name = text(body.name, 80);
    const email = text(body.email, 160).toLowerCase();
    const phone = normalizePhone(body.phone);
    const testId = text(body.testId, 40);
    const testName = text(body.testName, 120);
    const provider = text(body.provider, 40);
    const note = text(body.note, 1000);

    if (!name || !email || phone.length < 9 || !allowedTests.has(testId) || !allowedProviders.has(provider)) {
      return response(400, { ok: false, error: '필수 신청정보를 확인해 주세요.' });
    }

    const c = body.consents || {};
    if (!(c.privacy && c.sensitive && c.ai)) {
      return response(400, { ok: false, error: '필수 정보이용동의가 필요합니다.' });
    }

    const now = new Date();
    const id = `APP-${now.getTime()}-${crypto.randomBytes(3).toString('hex')}`;
    const accessToken = token();

    const reservation = {
      id,
      name,
      phone,
      email,
      type: '온라인 심리검사',
      date: now.toISOString().slice(0, 10),
      time: '',
      program: `개별 심리검사 (${testName})`,
      bookingProgram: '개별 심리검사',
      bookingCategory: 'individual-test',
      extraTests: [testId],
      selectedTests: [testId],
      provider,
      appApplicationId: id,
      appAccessToken: accessToken,
      applicationSource: 'modumam-app-v1',
      applicationForm: {
        email,
        concern: note,
        submittedAt: now.toISOString()
      },
      consentForm: {
        privacy: true,
        sensitive: true,
        aiAnalysis: true,
        expertLink: Boolean(c.expert),
        signedAt: now.toISOString(),
        documentVersion: '앱 검사신청 정보이용동의 v1'
      },
      status: '승인대기',
      createdAt: now.toISOString()
    };

    try {
      const current = rows(await store.get(KEY, { type: 'json' }).catch(() => null));
      const next = [
        reservation,
        ...current.filter(r => String(r.appApplicationId || '') !== id)
      ].slice(0, 3000);

      await store.setJSON(KEY, next);
    } catch (error) {
      console.error('[app-assessment-api] reservation write failed', error);
      return response(503, {
        ok: false,
        error: '검사 신청을 저장하지 못했습니다.',
        detail: String(error?.message || error)
      });
    }

    return response(201, {
      ok: true,
      application: {
        id,
        accessToken,
        status: '신청접수',
        createdAt: now.toISOString()
      }
    });
  }

  if (event.httpMethod === 'GET') {
    const id = text(event.queryStringParameters?.id, 100);
    const accessToken = text(event.queryStringParameters?.token, 100);

    if (!id || !accessToken) {
      return response(400, { ok: false, error: '신청 조회정보가 필요합니다.' });
    }

    try {
      const current = rows(await store.get(KEY, { type: 'json' }).catch(() => null));
      const row = current.find(
        r =>
          String(r.appApplicationId || '') === id &&
          String(r.appAccessToken || '') === accessToken
      );

      if (!row) {
        return response(404, { ok: false, error: '신청내역을 찾을 수 없습니다.' });
      }

      return response(200, {
        ok: true,
        application: {
          id,
          status: publicStatus(row.status),
          testUrl: text(row.testUrl || row.assessmentUrl, 1000),
          updatedAt: text(row.updatedAt || row.createdAt, 80)
        }
      });
    } catch (error) {
      console.error('[app-assessment-api] status read failed', error);
      return response(503, {
        ok: false,
        error: '신청상태를 불러오지 못했습니다.',
        detail: String(error?.message || error)
      });
    }
  }

  return response(405, { ok: false, error: '지원하지 않는 요청입니다.' });
};

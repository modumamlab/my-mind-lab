import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'modumam-admin-data-v37';
const RESERVATIONS_KEY = 'modumam_reservations';

const json = (statusCode, body) => ({
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

function publicStatus(status) {
  const s = text(status, 40);

  if (['결과업로드', '분석완료', '보고서작성', '보고서승인', '완료'].includes(s)) {
    return s === '보고서승인' || s === '완료' ? '리포트승인' : '검사완료';
  }

  if (['검사진행', '검사진행중'].includes(s)) return '검사진행중';
  if (['검사안내발송', '예약승인'].includes(s)) return '검사안내발송';

  return '신청접수';
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});

  let store;
  try {
    store = getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (error) {
    console.error('[app-assessment-api] getStore failed', error);
    return json(503, { ok: false, error: '서버 저장소 연결에 실패했습니다.' });
  }

  if (event.httpMethod === 'POST') {
    let body = {};

    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      console.error('[app-assessment-api] invalid JSON', error);
      return json(400, { ok: false, error: '요청 형식이 올바르지 않습니다.' });
    }

    const name = text(body.name, 80);
    const email = text(body.email, 160).toLowerCase();
    const phone = normalizePhone(body.phone);
    const testId = text(body.testId, 40);
    const testName = text(body.testName, 120);
    const provider = text(body.provider, 40);
    const note = text(body.note, 1000);

    if (
      !name ||
      !email ||
      phone.length < 9 ||
      !allowedTests.has(testId) ||
      !allowedProviders.has(provider)
    ) {
      return json(400, { ok: false, error: '필수 신청정보를 확인해 주세요.' });
    }

    const c = body.consents || {};
    if (!(c.privacy && c.sensitive && c.ai)) {
      return json(400, { ok: false, error: '필수 정보이용동의가 필요합니다.' });
    }

    const now = new Date();
    const id = `APP-${now.getTime()}-${crypto.randomBytes(3).toString('hex')}`;
    const accessToken = token();

    let record = null;
    try {
      record = await store.get(RESERVATIONS_KEY, { type: 'json', consistency: 'strong' });
    } catch (error) {
      console.error('[app-assessment-api] reservation read failed', error);
    }

    const rows = Array.isArray(record?.value) ? record.value : [];

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

    const next = [
      reservation,
      ...rows.filter((x) => String(x.appApplicationId || '') !== id)
    ];

    try {
      await store.setJSON(RESERVATIONS_KEY, {
        version: 'v38.0-app-assessment-api',
        value: next,
        meta: {
          action: '앱 심리검사 신청',
          actor: name,
          source: 'modumam-app-v1',
          at: now.toISOString()
        },
        updatedAt: now.toISOString()
      });
    } catch (error) {
      console.error('[app-assessment-api] reservation write failed', error);
      return json(503, { ok: false, error: '검사 신청을 저장하지 못했습니다.' });
    }

    return json(201, {
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
      return json(400, { ok: false, error: '신청 조회정보가 필요합니다.' });
    }

    let record;
    try {
      record = await store.get(RESERVATIONS_KEY, { type: 'json', consistency: 'strong' });
    } catch (error) {
      console.error('[app-assessment-api] status read failed', error);
      return json(503, { ok: false, error: '신청상태를 불러오지 못했습니다.' });
    }

    const rows = Array.isArray(record?.value) ? record.value : [];
    const row = rows.find(
      (x) =>
        String(x.appApplicationId || '') === id &&
        String(x.appAccessToken || '') === accessToken
    );

    if (!row) {
      return json(404, { ok: false, error: '신청내역을 찾을 수 없습니다.' });
    }

    return json(200, {
      ok: true,
      application: {
        id,
        status: publicStatus(row.status),
        testUrl: text(row.testUrl || row.assessmentUrl, 1000),
        updatedAt: text(record?.updatedAt || row.createdAt, 80)
      }
    });
  }

  return json(405, { ok: false, error: '지원하지 않는 요청입니다.' });
};

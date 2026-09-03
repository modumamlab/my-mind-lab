const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

const STORE_NAME = 'modumam-reservations-v1';
const KEY = 'reservations-v2';

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MML-Admin-Password',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  },
  body: JSON.stringify(body)
});

const text = (v, n = 500) => String(v || '').trim().slice(0, n);
const normalizePhone = (v) => text(v, 40).replace(/[^0-9]/g, '');
const allowedProviders = new Set(['마음사랑', '인싸이트']);
const allowedTests = new Set(['TCI', 'JTCI', 'MMPI-2', 'MMPI-A', 'PAI', 'PAT-2', 'STS', 'K-CDI']);
const TEST_PRICES = { 'TCI':20000, 'JTCI':20000, 'MMPI-2':25000, 'MMPI-A':25000, 'PAI':20000, 'PAT-2':15000, 'STS':15000, 'K-CDI':10000 };


function token() {
  return crypto.randomBytes(24).toString('hex');
}

function rows(v) {
  return (Array.isArray(v) ? v : []).filter(r => r && r.id !== undefined && r.id !== null);
}

function adminAuthorized(event) {
  const expected = String(process.env.MML_RESERVATION_ADMIN_PASSWORD || 'modumam2026');
  const supplied = String(
    event.headers?.['x-mml-admin-password'] ||
    event.headers?.['X-MML-Admin-Password'] ||
    ''
  );
  return supplied === expected;
}

function mergeRows(...lists) {
  const map = new Map();
  lists.flat().filter(Boolean).forEach((row) => {
    const key = String(row.id || `${row.name || ''}-${row.phone || ''}-${row.date || ''}-${row.time || ''}`);
    map.set(key, { ...(map.get(key) || {}), ...row });
  });
  return [...map.values()].sort((a, b) =>
    String(b.updatedAt || b.createdAt || b.id || '').localeCompare(
      String(a.updatedAt || a.createdAt || a.id || '')
    )
  );
}

function publicStatus(row) {
  const status = text(row?.status, 40);
  const reportApproved =
    row?.assessmentReportStatus === '승인 완료' ||
    Boolean(row?.assessmentReportApprovedAt) ||
    Boolean(row?.approvedIntegratedReportId) ||
    (Array.isArray(row?.approvedIndividualReportIds) && row.approvedIndividualReportIds.length > 0) ||
    row?.resultReportApproved === true;

  // 상담 단계는 관리자 진행상태를 그대로 우선 반영합니다.
  if (status === '종결') return '종결';
  if (status === '상담완료') return '상담 완료';
  if (status === '상담진행') return '상담 진행 중';
  if (status === '상담준비') return '상담 준비 중';

  // 상담 전 단계에서 승인된 보고서가 있으면 리포트 확인 상태를 우선합니다.
  if (reportApproved || ['보고서승인', '완료'].includes(status)) return '리포트승인';
  if (['결과업로드', '검사완료', '분석완료', '보고서작성'].includes(status)) return '결과 분석 중';
  if (['검사발송', '검사링크발송'].includes(status)) return '검사안내발송';
  if (['검사진행', '검사진행중'].includes(status)) return '검사진행중';
  if (['예약승인', '결제완료'].includes(status)) return '예약확정';
  return '신청접수';
}

function aiAccessPayload(row) {
  const enabled = row?.aiCounselingEnabled === true || row?.aiEnabled === true || row?.aiResultCounselingEnabled === true;
  const startedAt = text(row?.aiCounselingStartedAt, 80);
  const expiresAt = text(row?.aiCounselingExpiresAt, 80);
  const nowMs = Date.now();
  const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const expired = Boolean(startedAt && Number.isFinite(expiresMs) && nowMs >= expiresMs);
  const remainingMs = startedAt && Number.isFinite(expiresMs) ? Math.max(0, expiresMs - nowMs) : (enabled ? 60 * 60 * 1000 : 0);
  return {
    enabled,
    started: Boolean(startedAt),
    startedAt,
    expiresAt,
    expired,
    remainingMs,
    status: !enabled ? 'disabled' : expired ? 'expired' : startedAt ? 'active' : 'ready'
  };
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

  const isAdminRequest = String(event.queryStringParameters?.admin || '') === '1';

  // RC3.2: 운영 안전을 위해 예약 전체 삭제 API를 노출하지 않습니다.
  if (event.httpMethod === 'DELETE' && isAdminRequest) {
    return response(405, { ok: false, error: '예약 전체 삭제 API는 비활성화되었습니다.' });
  }

  if (event.httpMethod === 'GET' && isAdminRequest) {
    if (!adminAuthorized(event)) {
      return response(401, { ok: false, error: '관리자 인증이 필요합니다.' });
    }
    try {
      const current = rows(await store.get(KEY, { type: 'json' }).catch(() => null));
      return response(200, {
        ok: true,
        reservations: current,
        count: current.length
      });
    } catch (error) {
      console.error('[app-assessment-api] admin list failed', error);
      return response(503, {
        ok: false,
        error: '예약 서버 데이터를 불러오지 못했습니다.',
        detail: String(error?.message || error)
      });
    }
  }

  if (event.httpMethod === 'PATCH' && isAdminRequest) {
    if (!adminAuthorized(event)) {
      return response(401, { ok: false, error: '관리자 인증이 필요합니다.' });
    }
    let body = {};
    try { body = JSON.parse(event.body || '{}'); }
    catch (_) { return response(400, { ok:false, error:'요청 형식이 올바르지 않습니다.' }); }
    const reservation = body?.reservation && typeof body.reservation === 'object' ? body.reservation : null;
    const requestedId = text(reservation?.appApplicationId || reservation?.id || body?.id, 100);
    if (!reservation) return response(400, { ok:false, error:'수정할 앱 신청정보가 필요합니다.' });
    try {
      const current = rows(await store.get(KEY, { type:'json' }).catch(() => null));
      // 관리자 예약 기준본과 앱 신청 기준본의 id가 달라진 과거 데이터도 연결합니다.
      // id가 일치하지 않으면 이메일+전화번호, 전화번호+이름 순서로 동일 신청자를 찾습니다.
      const wantedPhone = normalizePhone(reservation.phone);
      const wantedEmail = text(reservation.email || reservation.userEmail, 160).toLowerCase();
      const wantedName = text(reservation.name || reservation.clientName, 80);
      // 관리자 예약행과 앱 신청행이 같은 Blob 안에 함께 존재할 수 있습니다.
      // 기존 코드는 관리자 예약 id가 먼저 일치하면 그 행을 다시 PATCH하여,
      // 실제 앱이 token으로 조회하는 신청행에는 clientReports가 들어가지 않는 문제가 있었습니다.
      // 반드시 appAccessToken을 가진 '앱 신청행'을 우선 대상으로 선택합니다.
      const isAppRow = r => Boolean(text(r?.appAccessToken, 120));
      let index = requestedId ? current.findIndex(r => isAppRow(r) && String(r.appApplicationId || r.id || '') === requestedId) : -1;
      if (index < 0 && wantedEmail && wantedPhone) {
        index = current.findIndex(r => isAppRow(r) && text(r.email || r.userEmail,160).toLowerCase() === wantedEmail && normalizePhone(r.phone) === wantedPhone);
      }
      if (index < 0 && wantedPhone && wantedName) {
        index = current.findIndex(r => isAppRow(r) && normalizePhone(r.phone) === wantedPhone && text(r.name || r.clientName,80) === wantedName);
      }
      if (index < 0) return response(404, { ok:false, error:'앱 신청내역을 찾을 수 없습니다.' });
      const existing = current[index];
      const canonicalAppId = text(existing.appApplicationId || existing.id, 100);
      const preservedToken = existing.appAccessToken || reservation.appAccessToken || '';
      // 앱 로그인 조회키(id/token)는 절대 관리자 예약 id로 덮어쓰지 않습니다.
      const nextRow = { ...existing, ...reservation, id:existing.id || canonicalAppId, appApplicationId:canonicalAppId, appAccessToken:preservedToken, updatedAt:new Date().toISOString() };
      current[index] = nextRow;
      await store.setJSON(KEY, current);
      return response(200, { ok:true, reservation:nextRow });
    } catch (error) {
      return response(503, { ok:false, error:'앱 신청정보 동기화에 실패했습니다.', detail:String(error?.message || error) });
    }
  }

  if (event.httpMethod === 'PUT' && isAdminRequest) {
    if (!adminAuthorized(event)) {
      return response(401, { ok: false, error: '관리자 인증이 필요합니다.' });
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return response(400, { ok: false, error: '요청 형식이 올바르지 않습니다.' });
    }

    try {
      // RC3.2: 관리자 PUT은 전체 기준본 교체입니다.
      const next = rows(Array.isArray(body.reservations) ? body.reservations : []).slice(0, 3000);
      await store.setJSON(KEY, next);

      return response(200, {
        ok: true,
        reservations: next,
        count: next.length
      });
    } catch (error) {
      console.error('[app-assessment-api] admin save failed', error);
      return response(503, {
        ok: false,
        error: '예약 서버 동기화에 실패했습니다.',
        detail: String(error?.message || error)
      });
    }
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); }
    catch (_) { return response(400, { ok:false, error:'요청 형식이 올바르지 않습니다.' }); }

    if (body?.action === 'ai-start') {
      const id = text(body.id, 100);
      const accessToken = text(body.token, 100);
      if (!id || !accessToken) return response(400, { ok:false, error:'AI 상담 시작정보가 필요합니다.' });
      try {
        const current = rows(await store.get(KEY, { type:'json' }).catch(() => null));
        const index = current.findIndex(r => String(r.appApplicationId || r.id || '') === id && String(r.appAccessToken || '') === accessToken);
        if (index < 0) return response(404, { ok:false, error:'신청내역을 찾을 수 없습니다.' });
        const row = current[index];
        const access = aiAccessPayload(row);
        if (!access.enabled) return response(403, { ok:false, error:'관리자가 AI 해석상담을 아직 활성화하지 않았습니다.', aiAccess:access });
        if (access.expired) return response(403, { ok:false, error:'AI 해석상담 60분 이용시간이 종료되었습니다.', aiAccess:access });
        if (!access.started) {
          const started = new Date();
          const expires = new Date(started.getTime() + 60 * 60 * 1000);
          current[index] = { ...row, aiCounselingStartedAt:started.toISOString(), aiCounselingExpiresAt:expires.toISOString(), aiResultCounselingStartedAt:started.toISOString(), updatedAt:started.toISOString() };
          await store.setJSON(KEY, current);
          return response(200, { ok:true, aiAccess:aiAccessPayload(current[index]) });
        }
        return response(200, { ok:true, aiAccess:access });
      } catch (error) {
        return response(503, { ok:false, error:'AI 상담을 시작하지 못했습니다.', detail:String(error?.message || error) });
      }
    }

    if (body?.applicationType === 'inquiry') {
      const name = cleanText(body?.name, 80);
      const phone = cleanText(body?.phone, 30);
      const email = cleanText(body?.email, 160);
      const category = cleanText(body?.category, 40) || '이용문의';
      const content = cleanText(body?.content, 2000);
      if (!name || !phone || !content) return response(400,{ok:false,error:'문의 필수 항목을 확인해 주세요.'});
      try {
        const inquiryStore = getStore({ name: 'modumam-inquiries-v1', consistency: 'strong' });
        const key='inquiries';
        const rows=(await inquiryStore.get(key,{type:'json'}).catch(()=>[])) || [];
        const inquiry={id:`INQ-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,phone,email,category,content,status:'접수',createdAt:new Date().toISOString()};
        await inquiryStore.setJSON(key,[inquiry,...(Array.isArray(rows)?rows:[])]);
        return response(201,{ok:true,inquiry:{id:inquiry.id,status:inquiry.status,createdAt:inquiry.createdAt}});
      } catch(error) {
        console.error('[app-assessment-api] inquiry create failed',error);
        return response(503,{ok:false,error:'문의 저장에 실패했습니다.',detail:String(error?.message||error)});
      }
    }
    const name = text(body.name, 80);
    const email = text(body.email, 160).toLowerCase();
    const phone = normalizePhone(body.phone);
    const testId = text(body.testId, 40);
    const testName = text(body.testName, 120);
    const provider = text(body.provider, 40);
    const note = text(body.chiefComplaint || body.note, 1000);
    const consultationMethod = text(body.consultationMethod, 20);
    const allowedConsultationMethods = new Set(['대면상담','비대면상담']);
    const preferredDate = text(body.preferredDate || body.date, 10);
    const preferredTime = text(body.preferredTime || body.time, 5);
    const allowedTimes = new Set(Array.from({length:17}, (_,i) => { const total=9*60+i*30; return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`; }));
    const seoulToday = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const applicationType = text(body.applicationType, 30);
    const isCounselingApplication = applicationType === 'counseling';

    if (isCounselingApplication) {
      if (!name || phone.length < 9 || note.length < 2 || !allowedConsultationMethods.has(consultationMethod) || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || preferredDate < seoulToday || !allowedTimes.has(preferredTime)) {
        return response(400, { ok: false, error: '마음상담 신청정보를 확인해 주세요.' });
      }

      const now = new Date();
      const id = `APP-${now.getTime()}-${crypto.randomBytes(3).toString('hex')}`;
      const accessToken = token();
      const counselingFee = consultationMethod === '대면상담' ? 50000 : 30000;
      const reservation = {
        id, name, phone, email, concern: note, chiefComplaint: note, type: consultationMethod, consultationMethod,
        counselingFee, testFee: 0, estimatedTotal: counselingFee,
        date: preferredDate, time: preferredTime, preferredDate, preferredTime,
        applicationDate: now.toISOString().slice(0, 10),
        program: '개인 마음상담', bookingProgram: '개인 마음상담', bookingCategory: 'counseling',
        extraTests: [], selectedTests: [], additionalTests: [],
        appApplicationId: id, appAccessToken: accessToken, applicationSource: 'modumam-app-v1', applicationType: 'counseling',
        applicationForm: { email, concern: note, chiefComplaint: note, submittedAt: now.toISOString(), consultationMethod, preferredDate, preferredTime },
        consentForm: { privacy: true, counseling: true, signedAt: now.toISOString(), documentVersion: '앱 마음상담 신청 v1' },
        status: '승인대기', createdAt: now.toISOString()
      };
      try {
        const current = rows(await store.get(KEY, { type: 'json' }).catch(() => null));
        const next = [reservation, ...current.filter(r => String(r.appApplicationId || '') !== id)].slice(0, 3000);
        await store.setJSON(KEY, next);
        return response(201, {
          ok: true,
          application: {
            id,
            accessToken,
            status: '신청접수',
            createdAt: now.toISOString(),
            preferredDate,
            preferredTime,
            consultationMethod,
            counselingFee,
            chiefComplaint: note
          }
        });
      } catch (error) {
        console.error('[app-assessment-api] counseling create failed', error);
        return response(503, {
          ok: false,
          error: '마음상담 신청 저장에 실패했습니다.',
          detail: String(error?.message || error)
        });
      }
    }

    if (!name || !email || phone.length < 9 || !allowedConsultationMethods.has(consultationMethod) || !allowedTests.has(testId) || !allowedProviders.has(provider) || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || preferredDate < seoulToday || !allowedTimes.has(preferredTime)) {
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
      type: consultationMethod,
      consultationMethod,
      counselingFee: consultationMethod === '대면상담' ? 50000 : 30000,
      testFee: TEST_PRICES[testId] || 0,
      estimatedTotal: (consultationMethod === '대면상담' ? 50000 : 30000) + (TEST_PRICES[testId] || 0),
      date: preferredDate,
      time: preferredTime,
      preferredDate,
      preferredTime,
      applicationDate: now.toISOString().slice(0, 10),
      program: `개별 심리검사 (${testName})`,
      bookingProgram: '개별 심리검사',
      bookingCategory: 'individual-test',
      assessmentTestCode: testId,
      testId,
      testName,
      clientTestId: text(body.clientTestId, 40),
      extraTests: [testId],
      selectedTests: [testId],
      provider,
      appApplicationId: id,
      appAccessToken: accessToken,
      applicationSource: 'modumam-app-v1',
      applicationForm: {
        email,
        concern: note,
        submittedAt: now.toISOString(),
        consultationMethod,
        preferredDate,
        preferredTime
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
        createdAt: now.toISOString(),
        preferredDate,
        preferredTime
      }
    });
  }

  if (event.httpMethod === 'GET' && String(event.queryStringParameters?.action || '') === 'ai-access') {
    const id = text(event.queryStringParameters?.id, 100);
    const accessToken = text(event.queryStringParameters?.token, 100);
    if (!id || !accessToken) return response(400, { ok:false, error:'AI 상담 이용정보가 필요합니다.' });
    try {
      const current = rows(await store.get(KEY, { type:'json' }).catch(() => null));
      const row = current.find(r => String(r.appApplicationId || r.id || '') === id && String(r.appAccessToken || '') === accessToken);
      if (!row) return response(404, { ok:false, error:'신청내역을 찾을 수 없습니다.' });
      return response(200, { ok:true, aiAccess:aiAccessPayload(row) });
    } catch (error) {
      return response(503, { ok:false, error:'AI 상담 이용상태를 확인하지 못했습니다.', detail:String(error?.message || error) });
    }
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
          status: publicStatus(row),
          testUrl: text(row.testUrl || row.assessmentUrl, 1000),
          updatedAt: text(row.updatedAt || row.createdAt, 80),
          preferredDate: text(row.preferredDate || row.date, 10),
          preferredTime: text(row.preferredTime || row.time, 5),
          clientReports: (() => {
            const list = Array.isArray(row.clientReports)
              ? row.clientReports.filter(report => report && report.approved === true)
              : [];
            if (list.length) return list;
            if (row.clientReport && row.clientReport.approved === true) return [row.clientReport];
            // RC3.19: 승인 상태와 payload 저장이 어긋난 기존/경계 케이스용 fallback.
            if (row.approvedClientReport && row.approvedClientReport.approved === true) return [row.approvedClientReport];
            return [];
          })()
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

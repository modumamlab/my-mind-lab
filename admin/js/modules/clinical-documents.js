console.info('[MML] CLINICAL-DOCUMENTS-MODULE-V27 loaded');

window.MMLCaseMaterialLoading=window.MMLCaseMaterialLoading||{};

function caseMaterialsForCase(caseId){
  return load('modumam_case_materials_' + caseId,[]);
}

function caseMaterialFileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
    reader.onerror=()=>reject(new Error('자료 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function uploadCaseMaterial(caseId,file){
  if(!file||window.MMLCaseMaterialLoading[caseId])return;
  const allowed=['application/pdf','image/png','image/jpeg','image/webp','text/plain'];
  const extension=String(file.name||'').split('.').pop().toLowerCase();
  const mimeType=file.type||({'txt':'text/plain','pdf':'application/pdf','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp'}[extension]||'');
  if(!allowed.includes(mimeType)){
    alert('PDF, PNG, JPG, WEBP 또는 TXT 파일만 업로드할 수 있습니다.');
    return;
  }
  if(file.size>4*1024*1024){
    alert('자료 파일은 4MB 이하로 올려 주세요.');
    return;
  }
  const c=buildCases().find(item=>item.caseId===caseId);
  if(!c)return;
  window.MMLCaseMaterialLoading[caseId]=true;
  render();
  try{
    const base64=await caseMaterialFileToBase64(file);
    const response=await fetch('/.netlify/functions/case-material-extract',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({caseId,clientName:c.res.name||'',fileName:file.name,mimeType,base64})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.material)throw new Error(data.error||'사례자료 분석에 실패했습니다.');
    const materials=caseMaterialsForCase(caseId);
    materials.unshift({
      id:`CASE-MATERIAL-${Date.now()}`,fileName:file.name,mimeType,size:file.size,
      ...data.material,model:data.model||'',extractedAt:new Date().toISOString()
    });
    save('modumam_case_materials_' + caseId,materials.slice(0,20));
    alert('사례자료가 분석되어 AI 사례개념화 근거에 추가되었습니다.');
  }catch(error){
    alert(error.message||'사례자료 업로드 중 오류가 발생했습니다.');
  }finally{
    window.MMLCaseMaterialLoading[caseId]=false;
    render();
  }
}

function deleteCaseMaterial(caseId,materialId){
  if(!confirm('이 사례자료를 삭제하시겠습니까?'))return;
  save('modumam_case_materials_' + caseId,caseMaterialsForCase(caseId).filter(item=>String(item.id)!==String(materialId)));
  render();
}

function saveCaseFormulation(caseId) {
  const existing=load("modumam_case_formulation_" + caseId,{});
  const theorySelect=document.getElementById("cf-theory-" + caseId);
  const customTheory=document.getElementById("cf-theory-custom-" + caseId)?.value?.trim() || "";
  const theoreticalOrientation=theorySelect?.value === "custom" ? customTheory : (theorySelect?.value || existing.theoreticalOrientation || "통합적 사례개념화");
  const data = {
    ...existing,
    theoreticalOrientation,
    customTheory:theorySelect?.value === "custom" ? customTheory : "",
    theoryPerspective: document.getElementById("cf-theory-perspective-" + caseId)?.value || "",
    complaint: document.getElementById("cf-complaint-" + caseId)?.value || "",
    currentProblem: document.getElementById("cf-current-" + caseId)?.value || "",
    trigger: document.getElementById("cf-trigger-" + caseId)?.value || "",
    maintaining: document.getElementById("cf-maintaining-" + caseId)?.value || "",
    coreBelief: document.getElementById("cf-core-belief-" + caseId)?.value || "",
    automaticThought: document.getElementById("cf-automatic-thought-" + caseId)?.value || "",
    emotionPattern: document.getElementById("cf-emotion-pattern-" + caseId)?.value || "",
    behaviorPattern: document.getElementById("cf-behavior-pattern-" + caseId)?.value || "",
    protective: document.getElementById("cf-protective-" + caseId)?.value || "",
    strength: document.getElementById("cf-strength-" + caseId)?.value || "",
    riskAssessment: document.getElementById("cf-risk-" + caseId)?.value || "",
    clinicalHypothesis: document.getElementById("cf-hypothesis-" + caseId)?.value || "",
    evidenceBasis: document.getElementById("cf-evidence-" + caseId)?.value || "",
    goal: document.getElementById("cf-goal-" + caseId)?.value || "",
    intervention: document.getElementById("cf-intervention-" + caseId)?.value || "",
    confirmedChanges: document.getElementById("cf-confirmed-changes-" + caseId)?.value || "",
    uncertainPoints: document.getElementById("cf-uncertain-" + caseId)?.value || "",
    nextFocus: document.getElementById("cf-next-focus-" + caseId)?.value || "",
    reviewedAt:new Date().toLocaleString('ko-KR')
  };
  save("modumam_case_formulation_" + caseId, data);
  alert("사례개념화가 저장되었습니다.");
  render();
}

function saveCaseSession(caseId) {
  const date = document.getElementById("session-date-" + caseId)?.value || new Date().toISOString().slice(0,10);
  const goal = document.getElementById("session-goal-" + caseId)?.value || "";
  const content = document.getElementById("session-content-" + caseId)?.value || "";
  const change = document.getElementById("session-change-" + caseId)?.value || "";
  const task = document.getElementById("session-task-" + caseId)?.value || "";
  const next = document.getElementById("session-next-" + caseId)?.value || "";

  if (!content.trim()) {
    alert("회기 내용을 입력해 주세요.");
    return;
  }

  const key = "modumam_case_sessions_" + caseId;
  const sessions = load(key, []);
  sessions.unshift({
    id: Date.now(),
    date,
    goal,
    content,
    change,
    task,
    next,
    createdAt: new Date().toLocaleString()
  });
  save(key, sessions);
  alert("회기기록이 저장되었습니다.");
  render();
}

function deleteCaseSession(caseId, sessionId) {
  if (!confirm("회기기록을 삭제하시겠습니까?")) return;
  const key = "modumam_case_sessions_" + caseId;
  save(key, load(key, []).filter(s => s.id !== sessionId));
  render();
}


/* =========================================================
   V31 운영관리 시스템
   - AI는 상담을 대신하지 않고 상담자가 회기를 준비하도록 돕습니다.
   - 마음 체크인, 검사, 회기기록, 사례개념화 초안을 바탕으로
     오늘 확인할 질문과 개입 아이디어를 구조화합니다.
========================================================= */
async function generateCounselingAid(caseId, mode='support') {
  const c = buildCases().find(item => item.caseId === caseId);
  if (!c || state.counselingAidLoading[caseId]) return;

  const activeReservation = counselingModeReservation();
  const journalId = String(caseId || '');
  const currentNote = {
    clientInfo: document.getElementById('journal-session-client-' + journalId)?.value || '',
    complaint: document.getElementById('journal-session-complaint-' + journalId)?.value || '',
    motivation: document.getElementById('journal-session-motivation-' + journalId)?.value || '',
    risk: document.getElementById('journal-session-risk-' + journalId)?.value || '',
    assessmentResults: document.getElementById('journal-session-assessment-' + journalId)?.value || '',
    goal: document.getElementById('journal-session-goal-' + journalId)?.value || document.getElementById('cm-theme')?.value || '',
    theme: document.getElementById('journal-session-goal-' + journalId)?.value || document.getElementById('cm-theme')?.value || '',
    emotion: document.getElementById('journal-session-emotion-' + journalId)?.value || document.getElementById('cm-emotion')?.value || '',
    content: document.getElementById('journal-session-content-' + journalId)?.value || document.getElementById('cm-content')?.value || '',
    intervention: document.getElementById('journal-session-intervention-' + journalId)?.value || '',
    result: document.getElementById('journal-session-result-' + journalId)?.value || '',
    change: document.getElementById('journal-session-change-' + journalId)?.value || document.getElementById('cm-change')?.value || '',
    next: document.getElementById('journal-session-next-' + journalId)?.value || document.getElementById('cm-next')?.value || ''
  };
  const f = c.formulation || {};
  const reviewedRecentSessions=(c.sessions||[]).filter(s=>s.reviewStatus==='상담자 검토 완료');
  const recentSessions = reviewedRecentSessions.slice(0, 5).map(s => ({
    date:s.date||'',
    sessionNumber:s.sessionNumber||'',
    reason:s.reason||'',
    goal:s.goal||s.theme||'',
    emotion:s.emotion||'',
    content:s.content||'',
    result:s.result||s.change||'',
    change:s.result||s.change||'',
    next:s.next||'',
    reviewStatus:s.reviewStatus||''
  }));
  const tests = (c.tests || []).map(shortTestName);
  const intakeSummary = c.intake ? [c.intake.summary,c.intake.concern,c.intake.report,c.intake.content].filter(Boolean).join('\n') : '';
  const reportSummary = (c.reports || []).map(r => [r.testType,r.summary,r.strength,r.caution,r.plan].filter(Boolean).join('\n')).join('\n\n');
  const uploadSummary = (c.uploads || []).map(u => `${u.testType||u.testName||'검사'}: ${u.summary||u.memo||'요약 미입력'}`).join('\n');
  const profileMemo = load('modumam_client_profile_'+clientKey(c.res.name,c.res.phone),{});

  // 상담일지 입력값을 AI 생성 전 한 번만 확정 저장합니다.
  // AI 요청 중 render()가 발생하더라도 빈 DOM 값이 기존 초안을 덮어쓰지 않도록 합니다.
  if(typeof captureCounselingJournalDraft==='function') captureCounselingJournalDraft(caseId);
  state.counselingAidLoading[caseId] = true;
  render();
  if(typeof restoreCounselingJournalDraft==='function') setTimeout(()=>restoreCounselingJournalDraft(caseId),0);
  try {
    const response = await fetch('/.netlify/functions/counseling-aid', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        mode,
        clientName:c.res.name,
        program:programBaseName(c.res.program),
        counselingMethod:c.res.type,
        tests,
        intakeSummary,
        uploadSummary,
        reportSummary,
        formulation:f,
        recentSessions,
        currentNote,
        profileMemo:profileMemo.memo||profileMemo.text||'',
        reservationStatus:normalizeStatus(activeReservation?.status||c.res.status)
      })
    });
    const data = await response.json().catch(()=>({}));
    if(!response.ok || !data.aid) throw new Error(data.error||'AI 상담도우미 생성 실패');
    const aid={...data.aid,source:data.sourceSummary||'',model:data.model||'',updatedAt:new Date().toLocaleString('ko-KR')};
    save('modumam_counseling_aid_'+caseId,aid);
    if(mode==='session_summary'){
      // 회기정리는 상담자가 입력한 주호소·동기·상담내용을 보존하고
      // 개입·결과·변화·다음 회기 계획만 자동 입력합니다.
      if(typeof restoreCounselingJournalDraft==='function') restoreCounselingJournalDraft(caseId);
      const put=(id,value)=>{const el=document.getElementById(id);if(!el||!value)return;el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
      put('journal-session-intervention-'+caseId,aid.intervention||'');
      put('journal-session-result-'+caseId,aid.sessionResult||'');
      put('journal-session-change-'+caseId,aid.clientChange||'');
      put('journal-session-next-'+caseId,aid.nextPlan||'');
      if(typeof captureCounselingJournalDraft==='function') captureCounselingJournalDraft(caseId);
    }
  } catch(error) {
    alert(error.message||'AI 상담도우미 생성 중 오류가 발생했습니다.');
  } finally {
    // 중요: 여기서 현재 DOM을 다시 capture하지 않습니다.
    // AI 처리 중 다시 그려진 화면은 아직 초안 복원이 끝나지 않았을 수 있어
    // 빈 값으로 주호소·상담내용을 덮어쓰는 문제가 생길 수 있습니다.
    state.counselingAidLoading[caseId]=false;
    render();
    if(typeof restoreCounselingJournalDraft==='function') setTimeout(()=>restoreCounselingJournalDraft(caseId),0);
  }
}


async function generateCounselingSessionSummary(caseId){
  const content=String(document.getElementById('journal-session-content-'+caseId)?.value||'').trim();
  if(!content){
    alert('먼저 상담내용을 입력해 주세요. 상담내용을 바탕으로 개입·결과·변화·다음 회기 계획을 정리합니다.');
    document.getElementById('journal-session-content-'+caseId)?.focus();
    return;
  }
  if(typeof captureCounselingJournalDraft==='function') captureCounselingJournalDraft(caseId);
  await generateCounselingAid(caseId,'session_summary');
}
window.generateCounselingSessionSummary=generateCounselingSessionSummary;

function saveCounselingAid(caseId) {
  const previous=load('modumam_counseling_aid_'+caseId,{});
  const aid = {
    ...previous,
    emotion: document.getElementById('aid-emotion-' + caseId)?.value || previous.emotion || '',
    focus: document.getElementById('aid-focus-' + caseId)?.value || '',
    questions: document.getElementById('aid-questions-' + caseId)?.value || '',
    intervention: document.getElementById('aid-intervention-' + caseId)?.value || '',
    sessionResult: document.getElementById('aid-result-' + caseId)?.value || previous.sessionResult || '',
    clientChange: document.getElementById('aid-change-' + caseId)?.value || previous.clientChange || '',
    strengths: document.getElementById('aid-strengths-' + caseId)?.value || previous.strengths || '',
    caution: document.getElementById('aid-caution-' + caseId)?.value || '',
    nextPlan: document.getElementById('aid-next-' + caseId)?.value || '',
    source: document.getElementById('aid-source-' + caseId)?.value || previous.source || '',
    updatedAt: new Date().toLocaleString('ko-KR')
  };
  save('modumam_counseling_aid_' + caseId, aid);
  if(typeof captureCounselingJournalDraft==='function') captureCounselingJournalDraft(caseId);
  alert('AI 상담도우미 메모가 저장되었습니다.');
  render();
  if(typeof restoreCounselingJournalDraft==='function') setTimeout(()=>restoreCounselingJournalDraft(caseId),0);
}

function copyCounselingAid(caseId) {
  const aid = load('modumam_counseling_aid_' + caseId, null);
  if (!aid) { alert('먼저 AI 상담도우미를 생성해 주세요.'); return; }
  copyText(`AI 상담도우미 2.0\n\n[현재 핵심 정서]\n${aid.emotion || ''}\n\n[오늘 상담 초점]\n${aid.focus || ''}\n\n[추천 질문]\n${aid.questions || ''}\n\n[권장 개입]\n${aid.intervention || ''}\n\n[상담결과]\n${aid.sessionResult || ''}\n\n[내담자의 변화]\n${aid.clientChange || ''}\n\n[강점·보호요인]\n${aid.strengths || ''}\n\n[주의할 점]\n${aid.caution || ''}\n\n[다음 회기 연결]\n${aid.nextPlan || ''}`);
}

async function generateCaseDraft(caseId) {
  const c = buildCases().find(item => item.caseId === caseId);
  if (!c || state.caseDraftLoading[caseId]) return;

  const matchingUploads = state.resultUploads.filter(u =>
    String(u.reservationId || "") === String(c.res.id) ||
    (String(u.clientName || u.name || "").trim() === String(c.res.name || "").trim() &&
     String(u.phone || "").replace(/\D/g, "") === String(c.res.phone || "").replace(/\D/g, ""))
  );
  const intakeSummary = c.intake ? [c.intake.summary, c.intake.concern, c.intake.report, c.intake.content].filter(Boolean).join("\n") : "";
  const reportSummary = c.reports.map(r => [r.testType, r.summary, r.strength, r.caution, r.plan].filter(Boolean).join("\n")).join("\n\n");
  const uploadSummary = matchingUploads.map(u => `${u.testType || u.testName || "검사"}: ${u.summary || u.memo || "요약 미입력"}`).join("\n");
  const caseMaterialSummary=caseMaterialsForCase(caseId).map(item=>
    `[${item.fileName||'사례자료'}]\n요약: ${item.summary||''}\n핵심사실: ${item.keyFacts||''}\n안전 관련: ${item.riskSignals||''}\n보호자원: ${item.protectiveResources||''}\n주의사항: ${item.cautions||''}`
  ).join('\n\n');
  const reviewedSessions=(c.sessions||[]).filter(s=>s.reviewStatus==='상담자 검토 완료');
  const unreviewedSessionCount=(c.sessions||[]).length-reviewedSessions.length;
  const sessionSummary = reviewedSessions.map(s =>
    `${s.date || ""} ${s.sessionNumber ? s.sessionNumber+"회기" : ""}\n`+
    `의뢰사유: ${s.reason || ""}\n`+
    `상담목표: ${s.goal || ""}\n`+
    `상담내용: ${s.content || ""}\n`+
    `상담결과: ${s.result || s.change || ""}\n`+
    `다음회기: ${s.next || ""}`
  ).join("\n\n");
  const existing = c.formulation || {};
  const theorySelect=document.getElementById('cf-theory-' + caseId);
  const customTheory=document.getElementById('cf-theory-custom-' + caseId)?.value?.trim() || '';
  const theoreticalOrientation=theorySelect?.value === 'custom' ? customTheory : (theorySelect?.value || existing.theoreticalOrientation || '통합적 사례개념화');

  if(theorySelect?.value === 'custom' && !theoreticalOrientation){
    alert('직접 적용할 사례개념화 이론을 입력해 주세요.');
    document.getElementById('cf-theory-custom-' + caseId)?.focus();
    return;
  }

  if((c.sessions||[]).length && !reviewedSessions.length){
    alert('저장된 회기기록은 있지만 상담자 검토가 완료된 기록이 없습니다.\n상담기록에서 내용을 검토한 뒤 “검토 완료”를 눌러 주세요.');
    return;
  }

  if(unreviewedSessionCount>0){
    const proceed=confirm(`검토 완료된 회기기록 ${reviewedSessions.length}건만 사례개념화에 반영됩니다.\n검토되지 않은 기록 ${unreviewedSessionCount}건은 제외됩니다.\n계속하시겠습니까?`);
    if(!proceed)return;
  }

  save("modumam_case_formulation_" + caseId, {...existing,theoreticalOrientation,customTheory:theorySelect?.value === 'custom' ? customTheory : ''});
  state.caseDraftLoading[caseId] = true;
  render();
  try {
    const response = await fetch('/.netlify/functions/case-conceptualization', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        caseId,
        clientName: c.res.name || '',
        program: programBaseName(c.res.program),
        counselingMethod: c.res.type || '',
        tests: c.tests,
        intakeSummary,
        uploadSummary,
        caseMaterialSummary,
        reportSummary,
        sessionSummary,
        adminMemo: c.res.adminMemo || '',
        theoreticalOrientation,
        existingFormulation: existing
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.formulation) throw new Error(data.error || 'AI 사례개념화 초안 생성에 실패했습니다.');
    const generatedFields=Object.fromEntries(Object.entries(data.formulation).filter(([,value])=>String(value||'').trim()));
    save("modumam_case_formulation_" + caseId, {
      ...existing,
      ...generatedFields,
      theoreticalOrientation:data.theoreticalOrientation || theoreticalOrientation,
      customTheory:theorySelect?.value === 'custom' ? customTheory : '',
      aiGeneratedAt:new Date().toISOString(),
      aiModel:data.model || '',
      promptVersion:data.promptVersion || ''
    });
    alert("AI 사례개념화 초안이 생성되었습니다. 반드시 임상심리사가 근거를 확인하고 수정해 주세요.");
  } catch (error) {
    alert(error.message || "AI 사례개념화 초안 생성 중 오류가 발생했습니다.");
  } finally {
    state.caseDraftLoading[caseId] = false;
    render();
  }
}

function toggleCaseTheoryInput(caseId){
  const select=document.getElementById('cf-theory-' + caseId);
  const customWrap=document.getElementById('cf-theory-custom-wrap-' + caseId);
  if(customWrap)customWrap.classList.toggle('hidden',select?.value !== 'custom');
}


// [MOD-20260716-SPRINT17-COUNSELING-PLAN]
// 검사별 분석·교차분석·사례개념화·회기기록을 통합해 상담자 검토용 상담계획 초안을 생성합니다.
function counselingPlanKey(caseId){return 'modumam_counseling_plan_'+caseId}
function counselingPlanForCase(caseId){return load(counselingPlanKey(caseId),{})}
function assessmentReservationForCase(c){return state.reservations.find(r=>String(r.id)===String(c?.res?.id))||c?.res||null}
window.generateCaseDraft=generateCaseDraft;
window.toggleCaseTheoryInput=toggleCaseTheoryInput;
window.uploadCaseMaterial=uploadCaseMaterial;
window.deleteCaseMaterial=deleteCaseMaterial;




function clinicalCaseReportKey(caseId){
  return `modumam_clinical_case_report_${caseId}`;
}

function clinicalCaseReportForCase(caseId){
  return load(clinicalCaseReportKey(caseId),{});
}

async function generateClinicalCaseReport(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);
  if(!c||state.clinicalCaseReportLoading[caseId])return;

  const reviewedSessions=(c.sessions||[]).filter(s=>s.reviewStatus==='상담자 검토 완료');
  if(!reviewedSessions.length){
    alert('AI 종합사례보고서를 만들려면 상담자 검토가 완료된 회기기록이 1건 이상 필요합니다.');
    return;
  }

  const formulation=load(`modumam_case_formulation_${caseId}`,{});
  const plan=counselingPlanForCase(caseId);
  const supervision=counselingSupervisionForCase(caseId);
  const recordQuality=counselingRecordQualityForCase(caseId);
  const existing=clinicalCaseReportForCase(caseId);

  state.clinicalCaseReportLoading[caseId]=true;
  render();

  try{
    const response=await fetch('/.netlify/functions/clinical-case-report',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        clientName:c.res.name||'내담자',
        program:programBaseName(c.res.program),
        counselingMethod:c.res.type||'',
        currentStatus:normalizeStatus(c.res.status),
        intake:c.intake||{},
        tests:c.tests||[],
        reports:(c.reports||[]).map(r=>({
          title:r.title,
          testType:r.testType,
          summary:r.summary,
          mindProfile:r.mindProfile,
          emotionState:r.emotionState,
          thinkingRelationship:r.thinkingRelationship,
          stressDaily:r.stressDaily,
          plan:r.plan
        })),
        formulation,
        counselingPlan:plan,
        supervision,
        recordQuality,
        sessions:reviewedSessions.map(s=>({
          date:s.date,
          sessionNumber:s.sessionNumber,
          reason:s.reason,
          goal:s.goal,
          content:s.content,
          result:s.result||s.change,
          task:s.task,
          next:s.next,
          reviewStatus:s.reviewStatus
        })),
        existingReport:existing
      })
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.report){
      throw new Error(data.error||'AI 종합사례보고서 생성에 실패했습니다.');
    }

    save(clinicalCaseReportKey(caseId),{
      ...data.report,
      generatedAt:new Date().toISOString(),
      model:data.model||'',
      promptVersion:data.promptVersion||'',
      reviewed:false
    });

    alert('AI 종합사례보고서 초안이 생성되었습니다. 상담자가 내용을 검토해 주세요.');
  }catch(error){
    console.error('[MML CLINICAL CASE REPORT]',error);
    alert(error?.message||'AI 종합사례보고서 생성 중 오류가 발생했습니다.');
  }finally{
    state.clinicalCaseReportLoading[caseId]=false;
    render();
  }
}
window.generateClinicalCaseReport=generateClinicalCaseReport;

function saveClinicalCaseReport(caseId){
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  const existing=clinicalCaseReportForCase(caseId);

  const report={
    ...existing,
    referralAndContext:value(`cr-context-${caseId}`),
    assessmentSummary:value(`cr-assessment-${caseId}`),
    caseFormulationSummary:value(`cr-formulation-${caseId}`),
    counselingGoals:value(`cr-goals-${caseId}`),
    counselingProcess:value(`cr-process-${caseId}`),
    interventionSummary:value(`cr-intervention-${caseId}`),
    changeAndOutcome:value(`cr-change-${caseId}`),
    riskAndSafety:value(`cr-risk-${caseId}`),
    strengthsAndResources:value(`cr-strengths-${caseId}`),
    currentClinicalView:value(`cr-current-${caseId}`),
    futurePlan:value(`cr-future-${caseId}`),
    limitations:value(`cr-limitations-${caseId}`),
    reviewed:true,
    reviewedAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };

  save(clinicalCaseReportKey(caseId),report);
  alert('AI 종합사례보고서 검토본을 저장했습니다.');
  render();
}
window.saveClinicalCaseReport=saveClinicalCaseReport;

function printClinicalCaseReport(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);
  const r=clinicalCaseReportForCase(caseId);

  if(!c||!r.generatedAt){
    alert('출력할 AI 종합사례보고서가 없습니다.');
    return;
  }

  const safe=value=>String(value??'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const nl=value=>safe(value).replace(/\n/g,'<br>');
  const row=(title,value)=>value?`<section><h2>${safe(title)}</h2><p>${nl(value)}</p></section>`:'';

  const popup=openPrintWindow('','_blank','width=960,height=900');
  if(!popup){
    alert('팝업이 차단되어 있습니다. 브라우저에서 팝업을 허용해 주세요.');
    return;
  }

  popup.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>AI 종합사례보고서</title>
<style>
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{margin:0;font-family:"Pretendard","Apple SD Gothic Neo",Arial,sans-serif;color:#0f172a}
.page{max-width:794px;margin:0 auto}
header{border-bottom:3px solid #1e3a8a;padding-bottom:18px;margin-bottom:20px}
.brand{font-size:11px;font-weight:900;letter-spacing:.08em;color:#1d4ed8}
h1{font-size:28px;margin:7px 0 4px}
.meta{font-size:12px;color:#64748b;line-height:1.7}
section{break-inside:avoid;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:12px}
section h2{font-size:14px;margin:0 0 9px;color:#1d4ed8}
section p{font-size:13px;line-height:1.8;margin:0}
.notice{margin-top:18px;border-top:1px solid #cbd5e1;padding-top:12px;font-size:10px;color:#64748b}
.no-print{position:fixed;right:18px;top:18px}
.no-print button{border:0;border-radius:10px;background:#1e3a8a;color:white;padding:10px 16px;font-weight:800}
@media print{.no-print{display:none}.page{max-width:none}}
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">PDF 저장 / 인쇄</button></div>
<div class="page">
<header>
<div class="brand">MODUMAM-LAB · CLINICAL CASE REPORT</div>
<h1>AI 종합사례보고서</h1>
<div class="meta">
내담자: ${safe(c.res.name||'내담자')} · 사례번호: ${safe(c.res.caseNumber||caseId)}<br>
프로그램: ${safe(programBaseName(c.res.program)||'')} · 작성일시: ${safe(new Date(r.generatedAt).toLocaleString('ko-KR'))}<br>
검토상태: ${r.reviewed?'상담자 검토 완료':'AI 초안'}
</div>
</header>
${row('1. 의뢰배경 및 상담 맥락',r.referralAndContext)}
${row('2. 심리평가 및 초기자료 요약',r.assessmentSummary)}
${row('3. 사례개념화 요약',r.caseFormulationSummary)}
${row('4. 상담목표',r.counselingGoals)}
${row('5. 상담 진행과정',r.counselingProcess)}
${row('6. 주요 개입과 임상적 판단',r.interventionSummary)}
${row('7. 변화 및 상담성과',r.changeAndOutcome)}
${row('8. 위험 및 안전관리',r.riskAndSafety)}
${row('9. 강점과 회복자원',r.strengthsAndResources)}
${row('10. 현재 임상적 이해',r.currentClinicalView)}
${row('11. 향후 계획 및 권고',r.futurePlan)}
${row('12. 자료의 한계와 추가 확인사항',r.limitations)}
<div class="notice">본 보고서는 제공된 심리평가 자료와 상담자 검토 완료 회기기록을 통합한 내부 임상 문서입니다. AI 초안은 반드시 상담자의 검토와 수정 후 사용해야 합니다.</div>
</div>
</body>
</html>`);
  popup.document.close();
  popup.focus();
}
window.printClinicalCaseReport=printClinicalCaseReport;

function counselingRecordQualityKey(caseId){
  return `modumam_counseling_record_quality_${caseId}`;
}

function counselingRecordQualityForCase(caseId){
  return load(counselingRecordQualityKey(caseId),{});
}

function qualityScoreTone(score){
  const value=Number(score||0);
  if(value>=85)return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if(value>=70)return 'text-indigo-700 bg-indigo-50 border-indigo-100';
  if(value>=55)return 'text-amber-700 bg-amber-50 border-amber-100';
  return 'text-rose-700 bg-rose-50 border-rose-100';
}

async function generateCounselingRecordQuality(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);
  if(!c||state.recordQualityLoading[caseId])return;

  const reviewedSessions=(c.sessions||[]).filter(s=>s.reviewStatus==='상담자 검토 완료');
  if(!reviewedSessions.length){
    alert('상담기록 품질검사를 위해 상담자 검토가 완료된 회기기록이 1건 이상 필요합니다.');
    return;
  }

  state.recordQualityLoading[caseId]=true;
  render();

  try{
    const response=await fetch('/.netlify/functions/counseling-record-quality',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        clientName:c.res.name||'내담자',
        program:programBaseName(c.res.program),
        sessions:reviewedSessions.map(s=>({
          date:s.date,
          sessionNumber:s.sessionNumber,
          reason:s.reason,
          goal:s.goal,
          content:s.content,
          result:s.result||s.change,
          task:s.task,
          next:s.next,
          reviewStatus:s.reviewStatus
        }))
      })
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.quality){
      throw new Error(data.error||'상담기록 품질검사에 실패했습니다.');
    }

    save(counselingRecordQualityKey(caseId),{
      ...data.quality,
      generatedAt:new Date().toISOString(),
      model:data.model||'',
      promptVersion:data.promptVersion||''
    });

    alert('상담기록 품질검사가 완료되었습니다.');
  }catch(error){
    console.error('[MML RECORD QUALITY]',error);
    alert(error?.message||'상담기록 품질검사 중 오류가 발생했습니다.');
  }finally{
    state.recordQualityLoading[caseId]=false;
    render();
  }
}
window.generateCounselingRecordQuality=generateCounselingRecordQuality;

function printCounselingRecordQuality(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);
  const q=counselingRecordQualityForCase(caseId);

  if(!c||!q.generatedAt){
    alert('출력할 상담기록 품질검사 결과가 없습니다.');
    return;
  }

  const safe=value=>String(value??'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const nl=value=>safe(value).replace(/\n/g,'<br>');
  const item=(title,score,feedback)=>`
    <section>
      <div class="score-row"><h2>${safe(title)}</h2><strong>${safe(score)}점</strong></div>
      <p>${nl(feedback)}</p>
    </section>`;

  const popup=openPrintWindow('','_blank','width=960,height=900');
  if(!popup){
    alert('팝업이 차단되어 있습니다. 브라우저에서 팝업을 허용해 주세요.');
    return;
  }

  popup.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>상담기록 품질검사</title>
<style>
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{margin:0;font-family:"Pretendard","Apple SD Gothic Neo",Arial,sans-serif;color:#0f172a}
.page{max-width:794px;margin:0 auto}
header{border-bottom:3px solid #0f766e;padding-bottom:18px;margin-bottom:20px}
.brand{font-size:11px;font-weight:900;letter-spacing:.08em;color:#0f766e}
h1{font-size:27px;margin:7px 0 4px}
.meta{font-size:12px;color:#64748b;line-height:1.7}
.total{margin:18px 0;border:1px solid #99f6e4;background:#f0fdfa;border-radius:16px;padding:18px}
.total strong{font-size:34px;color:#0f766e}
section{break-inside:avoid;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:12px}
.score-row{display:flex;justify-content:space-between;gap:16px}
section h2{font-size:14px;margin:0 0 9px;color:#0f766e}
section strong{font-size:14px}
section p{font-size:13px;line-height:1.8;margin:0}
.notice{margin-top:18px;border-top:1px solid #cbd5e1;padding-top:12px;font-size:10px;color:#64748b}
.no-print{position:fixed;right:18px;top:18px}
.no-print button{border:0;border-radius:10px;background:#0f766e;color:white;padding:10px 16px;font-weight:800}
@media print{.no-print{display:none}.page{max-width:none}}
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">PDF 저장 / 인쇄</button></div>
<div class="page">
<header>
<div class="brand">MODUMAM-LAB · COUNSELING RECORD QUALITY</div>
<h1>상담기록 품질검사</h1>
<div class="meta">
내담자: ${safe(c.res.name||'내담자')} · 사례번호: ${safe(c.res.caseNumber||caseId)}<br>
검사일시: ${safe(new Date(q.generatedAt).toLocaleString('ko-KR'))}
</div>
</header>
<div class="total"><div>종합점수</div><strong>${safe(q.totalScore)}점</strong><p>${nl(q.overallFeedback||'')}</p></div>
${item('기록 완성도',q.completenessScore,q.completenessFeedback)}
${item('목표 명확성',q.goalClarityScore,q.goalClarityFeedback)}
${item('상담과정 구체성',q.processSpecificityScore,q.processSpecificityFeedback)}
${item('개입 적절성 기록',q.interventionScore,q.interventionFeedback)}
${item('변화·결과 기록',q.outcomeScore,q.outcomeFeedback)}
${item('위험·안전 기록',q.riskScore,q.riskFeedback)}
${item('사실·해석 구분',q.factInferenceScore,q.factInferenceFeedback)}
${item('다음 회기 연결',q.continuityScore,q.continuityFeedback)}
<section><h2>우선 수정사항</h2><p>${nl(q.priorityImprovements||'')}</p></section>
<section><h2>잘 기록된 부분</h2><p>${nl(q.recordStrengths||'')}</p></section>
<div class="notice">이 점수는 기록의 문서 품질을 점검하기 위한 보조지표이며 상담자의 임상 역량이나 상담 효과를 평가하는 점수가 아닙니다.</div>
</div>
</body>
</html>`);
  popup.document.close();
  popup.focus();
}
window.printCounselingRecordQuality=printCounselingRecordQuality;

function counselingSupervisionKey(caseId){
  return `modumam_counseling_supervision_${caseId}`;
}

function counselingSupervisionForCase(caseId){
  return load(counselingSupervisionKey(caseId),{});
}

async function generateCounselingSupervision(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);
  if(!c||state.supervisionLoading[caseId])return;

  const reviewedSessions=(c.sessions||[]).filter(s=>s.reviewStatus==='상담자 검토 완료');
  if(!reviewedSessions.length){
    alert('AI 슈퍼비전을 위해 상담자 검토가 완료된 회기기록이 1건 이상 필요합니다.');
    return;
  }

  const formulation=load(`modumam_case_formulation_${caseId}`,{});
  const plan=counselingPlanForCase(caseId);
  const existing=counselingSupervisionForCase(caseId);

  state.supervisionLoading[caseId]=true;
  render();

  try{
    const response=await fetch('/.netlify/functions/counseling-supervision',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        clientName:c.res.name||'내담자',
        program:programBaseName(c.res.program),
        counselingMethod:c.res.type||'',
        currentStatus:normalizeStatus(c.res.status),
        formulation,
        counselingPlan:plan,
        sessions:reviewedSessions.map(s=>({
          date:s.date,
          sessionNumber:s.sessionNumber,
          reason:s.reason,
          goal:s.goal,
          content:s.content,
          result:s.result||s.change,
          next:s.next,
          reviewStatus:s.reviewStatus
        })),
        existingSupervision:existing
      })
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.supervision){
      throw new Error(data.error||'AI 슈퍼비전 생성에 실패했습니다.');
    }

    save(counselingSupervisionKey(caseId),{
      ...data.supervision,
      generatedAt:new Date().toISOString(),
      model:data.model||'',
      promptVersion:data.promptVersion||'',
      reviewed:false
    });

    alert('AI 슈퍼비전 초안이 생성되었습니다. 상담자가 내용을 검토해 주세요.');
  }catch(error){
    console.error('[MML SUPERVISION]',error);
    alert(error?.message||'AI 슈퍼비전 생성 중 오류가 발생했습니다.');
  }finally{
    state.supervisionLoading[caseId]=false;
    render();
  }
}
window.generateCounselingSupervision=generateCounselingSupervision;

function saveCounselingSupervision(caseId){
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  const existing=counselingSupervisionForCase(caseId);

  const supervision={
    ...existing,
    strengths:value(`sv-strengths-${caseId}`),
    missedPoints:value(`sv-missed-${caseId}`),
    interventionReview:value(`sv-intervention-${caseId}`),
    allianceReview:value(`sv-alliance-${caseId}`),
    riskEthics:value(`sv-risk-${caseId}`),
    countertransference:value(`sv-counter-${caseId}`),
    nextSessionSuggestions:value(`sv-next-${caseId}`),
    supervisorQuestions:value(`sv-questions-${caseId}`),
    documentationFeedback:value(`sv-documentation-${caseId}`),
    priorityActions:value(`sv-priority-${caseId}`),
    reviewed:true,
    reviewedAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };

  save(counselingSupervisionKey(caseId),supervision);
  alert('AI 슈퍼비전 검토본을 저장했습니다.');
  render();
}
window.saveCounselingSupervision=saveCounselingSupervision;

function printCounselingSupervision(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);
  const s=counselingSupervisionForCase(caseId);

  if(!c||!Object.values(s).some(Boolean)){
    alert('출력할 AI 슈퍼비전 내용이 없습니다.');
    return;
  }

  const safe=value=>String(value??'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const nl=value=>safe(value).replace(/\n/g,'<br>');
  const row=(title,value)=>value?`<section><h2>${safe(title)}</h2><p>${nl(value)}</p></section>`:'';

  const popup=openPrintWindow('','_blank','width=960,height=900');
  if(!popup){
    alert('팝업이 차단되어 있습니다. 브라우저에서 팝업을 허용해 주세요.');
    return;
  }

  popup.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>AI 상담 슈퍼비전</title>
<style>
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{margin:0;font-family:"Pretendard","Apple SD Gothic Neo",Arial,sans-serif;color:#0f172a}
.page{max-width:794px;margin:0 auto}
header{border-bottom:3px solid #312e81;padding-bottom:18px;margin-bottom:20px}
.brand{font-size:11px;font-weight:900;letter-spacing:.08em;color:#6d28d9}
h1{font-size:27px;margin:7px 0 4px}
.meta{font-size:12px;color:#64748b;line-height:1.7}
section{break-inside:avoid;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:12px}
section h2{font-size:14px;margin:0 0 9px;color:#5b21b6}
section p{font-size:13px;line-height:1.8;margin:0}
.notice{margin-top:18px;border-top:1px solid #cbd5e1;padding-top:12px;font-size:10px;color:#64748b}
.no-print{position:fixed;right:18px;top:18px}
.no-print button{border:0;border-radius:10px;background:#312e81;color:white;padding:10px 16px;font-weight:800}
@media print{.no-print{display:none}.page{max-width:none}}
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">PDF 저장 / 인쇄</button></div>
<div class="page">
<header>
<div class="brand">MODUMAM-LAB · CLINICAL SUPERVISION</div>
<h1>AI 상담 슈퍼비전</h1>
<div class="meta">
내담자: ${safe(c.res.name||'내담자')} · 사례번호: ${safe(c.res.caseNumber||caseId)}<br>
생성일시: ${safe(s.generatedAt?new Date(s.generatedAt).toLocaleString('ko-KR'):'')} · 검토상태: ${s.reviewed?'상담자 검토 완료':'AI 초안'}
</div>
</header>
${row('잘된 점과 강점',s.strengths)}
${row('놓쳤을 수 있는 부분',s.missedPoints)}
${row('개입 적절성 검토',s.interventionReview)}
${row('상담관계 및 반응 검토',s.allianceReview)}
${row('위험·윤리·안전 검토',s.riskEthics)}
${row('상담자 반응 및 역전이 점검',s.countertransference)}
${row('다음 회기 제안',s.nextSessionSuggestions)}
${row('슈퍼비전 질문',s.supervisorQuestions)}
${row('상담기록 피드백',s.documentationFeedback)}
${row('우선 실행사항',s.priorityActions)}
<div class="notice">본 자료는 상담자의 임상 판단을 지원하기 위한 내부 검토용 초안이며 전문적인 대면 슈퍼비전을 대신하지 않습니다.</div>
</div>
</body>
</html>`);
  popup.document.close();
  popup.focus();
}
window.printCounselingSupervision=printCounselingSupervision;

async function generateCounselingPlan(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);if(!c||state.counselingPlanLoading[caseId])return;
  const r=assessmentReservationForCase(c);if(!r)return;
  const analyses=analysesForReservation(r.id);
  const cross=state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id))||{};
  const formulation=load('modumam_case_formulation_'+caseId,{});
  const allSessions=load('modumam_case_sessions_'+caseId,[]);
  const sessions=allSessions.filter(x=>x.reviewStatus==='상담자 검토 완료');
  const reports=reservationReports(r);
  const hasSource=analyses.length||Object.values(cross).some(v=>typeof v==='string'&&v.trim())||Object.values(formulation).some(v=>typeof v==='string'&&v.trim())||sessions.length||reports.length;
  if(!hasSource){
    if(allSessions.length&&!sessions.length){
      alert('회기기록은 저장되어 있지만 검토 완료된 기록이 없습니다.\n상담기록에서 내용을 확인한 뒤 “검토 완료”를 눌러 주세요.');
    }else{
      alert('상담계획을 만들 자료가 없습니다. 검사별 분석, 교차분석, 사례개념화 또는 검토 완료된 회기기록을 먼저 준비해 주세요.');
    }
    return;
  }
  if(allSessions.length>sessions.length){
    const proceed=confirm(`검토 완료된 회기기록 ${sessions.length}건만 상담계획에 반영됩니다.\n검토되지 않은 기록 ${allSessions.length-sessions.length}건은 제외됩니다.\n계속하시겠습니까?`);
    if(!proceed)return;
  }
  state.counselingPlanLoading[caseId]=true;render();
  try{
    const response=await fetch('/.netlify/functions/counseling-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      caseId,clientName:r.name||'',program:programBaseName(r.program),counselingMethod:r.type||'',currentStatus:normalizeStatus(r.status),
      formulation,
      assessmentAnalyses:analyses.map(a=>({testType:a.testType,validity:a.validity,coreFindings:a.coreFindings,strengths:a.strengths,vulnerabilities:a.vulnerabilities,counselingQuestions:a.counselingQuestions,caseHypotheses:a.caseHypotheses,cautions:a.cautions,confidenceScore:a.confidenceScore,reviewed:a.reviewed,needsReview:a.needsReview})),
      crossAnalysis:cross,
      reports:reports.map(x=>({testType:x.testType,summary:x.summary,strength:x.strength,caution:x.caution,plan:x.plan,approvedForClient:x.approvedForClient})),
      sessions:sessions.map(x=>({
        date:x.date,
        sessionNumber:x.sessionNumber,
        reason:x.reason,
        goal:x.goal,
        content:x.content,
        result:x.result||x.change,
        change:x.result||x.change,
        task:x.task,
        next:x.next,
        reviewStatus:x.reviewStatus,
        reviewedAt:x.reviewedAt
      })),
      existingPlan:counselingPlanForCase(caseId)
    })});
    const data=await response.json().catch(()=>({}));if(!response.ok||!data.plan)throw new Error(data.error||'상담계획 초안을 생성하지 못했습니다.');
    save(counselingPlanKey(caseId),{...data.plan,model:data.model||'',generatedAt:new Date().toISOString(),reviewed:false});
    alert('상담계획 초안이 생성되었습니다. 상담자가 근거를 확인하고 수정해 주세요.');
  }catch(error){alert(error.message||'상담계획 생성 중 오류가 발생했습니다.');}
  finally{state.counselingPlanLoading[caseId]=false;render();}
}
function saveCounselingPlan(caseId){
  const value=id=>document.getElementById(id)?.value?.trim()||'';
  const plan={
    shortTermGoals:value(`cp-short-${caseId}`),midTermGoals:value(`cp-mid-${caseId}`),longTermGoals:value(`cp-long-${caseId}`),
    outcomeIndicators:value(`cp-outcomes-${caseId}`),treatmentRationale:value(`cp-rationale-${caseId}`),
    initialPhase:value(`cp-initial-${caseId}`),middlePhase:value(`cp-middle-${caseId}`),terminationPhase:value(`cp-term-${caseId}`),
    sessionRoadmap:value(`cp-roadmap-${caseId}`),recommendedInterventions:value(`cp-interventions-${caseId}`),
    interventionPrecautions:value(`cp-precautions-${caseId}`),monitoringPoints:value(`cp-monitor-${caseId}`),
    nextSessionQuestions:value(`cp-questions-${caseId}`),clientTasks:value(`cp-tasks-${caseId}`),
    collaborationPlan:value(`cp-collaboration-${caseId}`),reviewSchedule:value(`cp-review-schedule-${caseId}`),
    limitations:value(`cp-limit-${caseId}`),reviewed:true,reviewedAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  save(counselingPlanKey(caseId),{...counselingPlanForCase(caseId),...plan});alert('상담계획을 저장했습니다.');render();
}
function printCounselingPlan(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);const p=counselingPlanForCase(caseId);if(!c||!Object.values(p).some(v=>typeof v==='string'&&v.trim())){alert('저장된 상담계획이 없습니다.');return;}
  const w=openPrintWindow('','_blank');if(!w){alert('팝업 차단을 해제해 주세요.');return;}
  const row=(title,value)=>`<section><h2>${title}</h2><div>${esc(value||'미입력').replace(/\n/g,'<br>')}</div></section>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.res.name||'내담자')} 상담계획</title><style>body{font-family:Arial,'Noto Sans KR',sans-serif;max-width:900px;margin:40px auto;padding:0 28px;color:#1e293b;line-height:1.7}h1{font-size:26px;margin-bottom:4px}.meta{color:#64748b}section{border-top:1px solid #e2e8f0;padding:18px 0}h2{font-size:15px;color:#4f46e5;margin:0 0 8px}div{font-size:14px}.notice{background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;font-size:12px;color:#64748b}</style></head><body><h1>상담계획</h1><p class="meta">${esc(c.res.name||'')} · ${esc(programBaseName(c.res.program))} · ${esc(caseId)}</p><div class="notice">본 문서는 상담자 내부 검토용입니다. 내담자의 변화와 안전 상태에 따라 유연하게 수정합니다.</div>${row('단기 상담목표',p.shortTermGoals)}${row('중기 상담목표',p.midTermGoals)}${row('장기 상담목표',p.longTermGoals)}${row('성과 확인 지표',p.outcomeIndicators)}${row('상담 접근 선택 근거',p.treatmentRationale)}${row('초기 단계 계획',p.initialPhase)}${row('중기 단계 계획',p.middlePhase)}${row('종결·사후관리 계획',p.terminationPhase)}${row('회기별 로드맵',p.sessionRoadmap)}${row('권장 개입',p.recommendedInterventions)}${row('개입 시 주의사항',p.interventionPrecautions)}${row('위험·보호요인 모니터링',p.monitoringPoints)}${row('다음 회기 질문',p.nextSessionQuestions)}${row('내담자 실천과제',p.clientTasks)}${row('협력 및 자원연계 계획',p.collaborationPlan)}${row('계획 재검토 시점',p.reviewSchedule)}${row('한계와 유의사항',p.limitations)}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}
function printCaseFormulation(caseId) {
  const c = buildCases().find(item => item.caseId === caseId);
  if (!c) return;
  const f = load("modumam_case_formulation_" + caseId, {});
  if (!Object.values(f).some(v => typeof v === 'string' && v.trim())) { alert('저장된 사례개념화가 없습니다.'); return; }
  const w = openPrintWindow('', '_blank');
  if (!w) { alert('팝업 차단을 해제해 주세요.'); return; }
  const row = (title, value) => `<section><h2>${title}</h2><div>${esc(value || '미입력').replace(/\n/g,'<br>')}</div></section>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.res.name || '내담자')} 사례개념화</title><style>body{font-family:Arial,'Noto Sans KR',sans-serif;max-width:900px;margin:40px auto;padding:0 28px;color:#1e293b;line-height:1.7}h1{font-size:26px;margin-bottom:4px}p.meta{color:#64748b;margin-top:0}section{border-top:1px solid #e2e8f0;padding:18px 0}h2{font-size:15px;color:#047857;margin:0 0 8px}div{font-size:14px}.notice{background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;font-size:12px;color:#64748b}@media print{button{display:none}body{margin:0}}</style></head><body><h1>사례개념화</h1><p class="meta">${esc(c.res.name || '')} · ${esc(programBaseName(c.res.program))} · ${esc(c.caseId)} · ${esc(f.theoreticalOrientation||'통합적 사례개념화')}</p><div class="notice">본 문서는 상담자의 임상적 검토를 위한 내부 자료이며, AI 초안은 진단이나 확정적 판단을 대신하지 않습니다.</div>${row('선택 이론의 관점과 핵심기제',f.theoryPerspective)}${row('주호소',f.complaint)}${row('현재 문제 및 기능 영향',f.currentProblem)}${row('촉발요인',f.trigger)}${row('유지요인',f.maintaining)}${row('핵심 신념·자기이해',f.coreBelief)}${row('자동적 사고',f.automaticThought)}${row('정서 패턴',f.emotionPattern)}${row('행동·관계 패턴',f.behaviorPattern)}${row('보호요인',f.protective)}${row('강점 및 자원',f.strength)}${row('위험 및 안전평가',f.riskAssessment)}${row('임상적 가설',f.clinicalHypothesis)}${row('근거 연결',f.evidenceBasis)}${row('상담목표',f.goal)}${row('개입전략 및 상담계획',f.intervention)}${row('확인된 변화',f.confirmedChanges)}${row('추가 확인 필요',f.uncertainPoints)}${row('다음 회기 우선 초점',f.nextFocus)}<script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}



// [MOD-20260716-SPRINT12-TEST-INTERPRETATION]
// 대표님이 제공한 STS·PAT 하위척도 설명을 기준으로 AI 해석 초안을 생성합니다.
const TEST_INTERPRETATION_SCALES={
  STS:[
    {key:'activity',label:'활동성',meaning:'전반적인 에너지 수준과 움직임, 적극성의 정도'},
    {key:'cautiousness',label:'조심성',meaning:'새로운 사람과 환경에 접근할 때의 신중함'},
    {key:'positiveEmotion',label:'긍정정서',meaning:'기쁨·즐거움·만족 등 긍정적인 정서를 경험하고 표현하는 경향'},
    {key:'negativeEmotion',label:'부정정서',meaning:'걱정·불안·속상함·예민함 등 부정적인 정서를 경험하는 경향'},
    {key:'socialSensitivity',label:'사회적 민감성',meaning:'타인의 감정과 관계 신호에 관심을 보이고 반응하는 정도'},
    {key:'effortfulControl',label:'의도적 조절',meaning:'목표에 맞게 행동과 주의를 조절하고 기다리는 능력'}
  ],
  PAT:[
    {key:'supportExpression',label:'지지표현',meaning:'자녀에게 애정·격려·지지를 표현하는 정도'},
    {key:'rationalExplanation',label:'합리적 설명',meaning:'훈육 상황에서 자녀가 이해할 수 있도록 이유와 기준을 설명하는 정도'},
    {key:'achievementPressure',label:'성취압력',meaning:'자녀에게 높은 성취와 사회적 성공을 요구하는 정도'},
    {key:'interference',label:'간섭',meaning:'자녀의 자율성과 사생활에 개입하고 통제하는 정도'},
    {key:'punishment',label:'처벌',meaning:'신체적 체벌이나 심리적 위협을 훈육에 사용하는 정도'},
    {key:'monitoring',label:'감독',meaning:'자녀의 생활과 활동을 파악하고 관심을 기울이는 정도'},
    {key:'overExpectation',label:'과잉기대',meaning:'자녀의 능력이나 발달 수준보다 높은 기대를 갖는 정도'},
    {key:'inconsistency',label:'비일관성',meaning:'상황이나 기분에 따라 양육 기준과 반응이 달라지는 정도'}
  ]
};

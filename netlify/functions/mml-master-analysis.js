// MML CLINICAL REPORT ENGINE v6
// Evidence-first integrated formulation, contradiction handling, repetition control, and client-safe recommendations.
// Two-pass design: evidence-linked clinical synthesis -> audience-specific reports.
const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(obj)});
function valueText(v,depth=0){
  if(v===null||v===undefined)return '';
  if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return String(v);
  if(depth>3)return '';
  if(Array.isArray(v))return v.map(x=>valueText(x,depth+1)).filter(Boolean).join('\n');
  if(typeof v==='object')return Object.entries(v).map(([k,x])=>{const t=valueText(x,depth+1);return t?`${k}: ${t}`:''}).filter(Boolean).join('\n');
  return '';
}
const clean=(v,max=24000)=>valueText(v).trim().slice(0,max);

const TECHNICAL_FIELD_LABELS=/(?:^|[\s([{,;])(?:interpretationBasis|resultSummary|sourceSummary|coreFindings|dailyMeaning|helpfulDirections|clinicalNote|rawFacts|confidenceReason|confidenceScore|crossChecks|caseHypotheses|counselorReport|clientReport)\s*[:：=-]?\s*/gim;
function normalizeReportParagraph(value){
  return String(value||'')
    .replace(TECHNICAL_FIELD_LABELS,' ')
    .replace(/\b(?:undefined|null|NaN)\b/gi,'')
    .replace(/\r/g,'')
    .replace(/[ \t]+/g,' ')
    .replace(/\n[ \t]+/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}
function sentenceTokens(value){
  return new Set(normalizeReportParagraph(value)
    .toLowerCase()
    .replace(/[0-9]+(?:\.[0-9]+)?/g,'#')
    .replace(/[^0-9a-z가-힣]+/g,' ')
    .split(/\s+/)
    .filter(x=>x.length>1));
}
function sentenceSimilarity(a,b){
  const A=sentenceTokens(a), B=sentenceTokens(b);
  if(!A.size||!B.size)return 0;
  let inter=0;
  for(const x of A)if(B.has(x))inter++;
  return inter/Math.min(A.size,B.size);
}
function splitReportUnits(value){
  const text=normalizeReportParagraph(value);
  const units=[];
  for(const paragraph of text.split(/\n\s*\n/)){
    const p=paragraph.trim();
    if(!p)continue;
    // 검사 제목/번호 항목은 단독 단위로 보존합니다.
    if(/^\s*(?:[■●▪▶]|\d+[.)]|\[[^\]]+\])/.test(p)&&p.length<120){units.push(p);continue;}
    const sentences=p.split(/(?<=[.!?다요임됨함음])\s+(?=[가-힣A-Z0-9■●▪▶\[])/).map(x=>x.trim()).filter(Boolean);
    if(sentences.length>1)units.push(...sentences); else units.push(p);
  }
  return units;
}
function dedupeReportText(value,globalSeen=[],options={}){
  const kept=[];
  const local=[];
  const threshold=options.threshold||0.74;
  for(const unit of splitReportUnits(value)){
    const text=unit.trim();
    if(!text)continue;
    const isHeading=/^\s*(?:[■●▪▶]|\d+[.)]|\[[^\]]+\])/.test(text)&&text.length<120;
    const candidates=isHeading?local:[...globalSeen,...local];
    const duplicate=!isHeading&&text.length>=35&&candidates.some(prev=>{
      if(prev===text)return true;
      if(Math.min(prev.length,text.length)>=70&&sentenceSimilarity(prev,text)>=threshold)return true;
      return false;
    });
    if(duplicate)continue;
    kept.push(text);
    local.push(text);
    if(!isHeading&&text.length>=35)globalSeen.push(text);
  }
  return kept.join('\n\n').trim();
}
function prepareIntegratedSource(source){
  const out={};
  const seen=[];
  const structuredKeys=new Set([
    'normalizedEvidence','clinicalSynthesisBlueprint','caseConceptualization',
    'evidenceConfidence','conflictMap','clinicalReasoning','decisionTrace','revisionFeedback'
  ]);
  const compactStructured=(value,max=7000)=>{
    try{
      return JSON.parse(JSON.stringify(value,(key,item)=>{
        if(typeof item==='string')return clean(item,1800);
        return item;
      }).slice(0,max));
    }catch(_){
      return clean(JSON.stringify(value||{}),max);
    }
  };
  for(const [key,value] of Object.entries(source&&typeof source==='object'?source:{})){
    if(key==='sourceInventory'&&Array.isArray(value)){
      out[key]=value.map(row=>{
        const rowSeen=[];
        return {
          testType:normalizeReportParagraph(row?.testType||''),
          subjectRole:normalizeReportParagraph(row?.subjectRole||''),
          coreFindings:dedupeReportText(row?.coreFindings||'',rowSeen,{threshold:.78}),
          validity:dedupeReportText(row?.validity||'',rowSeen,{threshold:.8}),
          strengths:dedupeReportText(row?.strengths||'',rowSeen,{threshold:.76}),
          vulnerabilities:dedupeReportText(row?.vulnerabilities||'',rowSeen,{threshold:.76}),
          cautions:dedupeReportText(row?.cautions||'',rowSeen,{threshold:.8}),
          rawFacts:row?.rawFacts?compactStructured(row.rawFacts,4500):null
        };
      });
      continue;
    }
    if(structuredKeys.has(key)&&value&&typeof value==='object'){
      out[key]=compactStructured(value,key==='revisionFeedback'?5000:8000);
      continue;
    }
    if(value&&typeof value==='object'){
      out[key]=compactStructured(value,6000);
      continue;
    }
    out[key]=dedupeReportText(value,seen,{threshold:.72});
  }
  return out;
}
function sanitizeClientRewrite(report){
  const fields=['clientCoreMind','clientMindProfile','clientIndividualTests','clientEmotionState','clientThinkingRelationship','clientStressDaily','clientExpertRecovery','clientDisclaimer','tciTemperamentSummary','tciNS','tciHA','tciRD','tciPS','tciCharacterSummary','tciSD','tciCO','tciST','tciIntegrated','tciStrengths','tciCautions'];
  const out={};
  const globalSeen=[];
  const internal=/\b(?:interpretationBasis|resultSummary|sourceSummary|coreFindings|dailyMeaning|helpfulDirections|clinicalNote|rawFacts|confidenceReason|confidenceScore|crossChecks|caseHypotheses|counselorReport|clientReport)\b\s*[:：=-]?/i;
  const testLead=/^\s*(?:MMPI(?:-2|-A)?|TCI|JTCI|PAI|SCT|HTP|K-?CDI|STS|PAT|PHQ-9|GAD-7|회복탄력성)\b/i;
  const limits={
    clientCoreMind:6,
    clientMindProfile:10,
    clientIndividualTests:28,
    clientEmotionState:8,
    clientThinkingRelationship:8,
    clientStressDaily:8,
    clientExpertRecovery:10,
    clientDisclaimer:3
  };
  const thresholds={
    clientCoreMind:.77,
    clientMindProfile:.80,
    clientIndividualTests:.86,
    clientEmotionState:.80,
    clientThinkingRelationship:.80,
    clientStressDaily:.80,
    clientExpertRecovery:.82,
    clientDisclaimer:.88
  };
  for(const key of fields){
    // V5: 지나친 전역 중복 제거로 내용이 축약되는 문제를 막기 위해,
    // 각 영역 안에서는 충분한 설명을 보존하고 영역 간에는 높은 유사도만 제거합니다.
    const isTciField=key.startsWith('tci');
    let cleaned=dedupeReportText(report?.[key]||'',(key==='clientIndividualTests'||isTciField)?[]:globalSeen,{threshold:thresholds[key]||.80});
    const units=cleaned.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);
    const kept=[];
    for(let unit of units){
      if(internal.test(unit))continue;
      unit=unit.replace(internal,'').replace(/[ \t]+/g,' ').trim();
      if(!unit)continue;
      // 일반 영역에서 검사별 원문이 통째로 다시 붙는 경우만 차단합니다.
      // 문장 안에서 근거를 밝히기 위해 검사명을 사용하는 것은 허용합니다.
      if(key!=='clientIndividualTests'&&testLead.test(unit)&&unit.length>420)continue;
      kept.push(unit);
      if(kept.length>=limits[key])break;
    }
    out[key]=kept.join('\n\n').trim();
  }
  return out;
}

const TEST_ROLES={
  'TCI':'기질과 성격','JTCI':'기질과 성격','MMPI':'현재 심리상태와 성격기능','MMPI-2':'현재 심리상태와 성격기능','MMPI-A':'현재 심리상태와 성격기능','PAI':'현재 증상·대인관계·치료 고려사항','SCT':'자기개념·관계·가치와 반복 주제','HTP':'정서·자기상·관계에 대한 가설적 단서','K-CDI':'아동 발달수준과 영역별 발달','KCDI':'아동 발달수준과 영역별 발달','PAT':'부모 양육태도','STS':'아동 기질과 자기조절','PHQ-9':'우울 증상 선별','GAD-7':'불안 증상 선별','회복탄력성':'회복자원'
};
function normalize(s){return clean(s,120).toUpperCase().replace(/[^A-Z0-9가-힣-]/g,'');}
function roleOf(name){const n=normalize(name);for(const [k,v] of Object.entries(TEST_ROLES)){if(n.includes(normalize(k)))return v;}return '해당 검사가 측정하는 심리영역';}
function programConfig(program){const p=clean(program,180);if(p.includes('부모-자녀')||p.includes('부모자녀'))return{type:'parentChild',title:'부모-자녀 마음이음 종합보고서',purpose:'자녀의 발달, 기질, 양육태도와 부모-자녀 상호작용을 함께 이해'};if(p.includes('부부'))return{type:'couple',title:'부부 마음이음 종합보고서',purpose:'두 사람의 기질·성격과 관계 상호작용을 함께 이해'};if(p.includes('개인'))return{type:'personal',title:'개인 마음이음 종합보고서',purpose:'개인의 기질·성격, 현재 심리상태와 회복자원을 통합적으로 이해'};return{type:'individual',title:'심리검사 평가보고서',purpose:'실시한 심리검사 결과를 정확하게 이해'};}
function testMaterial(body){return (body.tests||[]).map((t,i)=>`[검사 ${i+1}]\n검사명: ${clean(t.testType,120)}\n대상: ${clean(t.subjectRole,80)||'미기재'}\n역할: ${roleOf(t.testType)}\n상담자 검토: ${t.reviewed?'완료':'미완료'}\n신뢰도: ${clean(t.confidenceScore,20)}\n원자료 요약: ${clean(t.sourceSummary,1800)}\n타당도·제한: ${clean(t.validity,1200)}\n핵심 결과: ${clean(t.coreFindings,3600)}\n강점·자원: ${clean(t.strengths,1800)}\n취약성·주의: ${clean(t.vulnerabilities,1800)}\n교차확인 근거: ${clean(t.crossChecks,1200)}\n해석상 주의: ${clean(t.cautions,1200)}`).join('\n\n');}
function crossMaterial(c){if(!c)return '교차분석 자료 없음';return `공통 특징: ${clean(c.commonPatterns,2400)}\n차이: ${clean(c.differences,1800)}\n상태-특성 구분: ${clean(c.stateTrait,1800)}\n위험·보호: ${clean(c.riskProtection,1800)}\n통합 이해: ${clean(c.caseIntegration,3000)}\n한계: ${clean(c.limitations,1200)}`;}

const PROFILE_SCHEMA={type:'OBJECT',properties:{
  validity:{type:'STRING'},testEvidence:{type:'ARRAY',items:{type:'OBJECT',properties:{test:{type:'STRING'},subject:{type:'STRING'},finding:{type:'STRING'},meaning:{type:'STRING'},caution:{type:'STRING'}},required:['test','subject','finding','meaning','caution']}},
  currentState:{type:'STRING'},stableTraits:{type:'STRING'},convergentThemes:{type:'ARRAY',items:{type:'OBJECT',properties:{theme:{type:'STRING'},evidence:{type:'STRING'},clinicalMeaning:{type:'STRING'}},required:['theme','evidence','clinicalMeaning']}},
  divergences:{type:'STRING'},formulation:{type:'OBJECT',properties:{predisposing:{type:'STRING'},precipitating:{type:'STRING'},perpetuating:{type:'STRING'},protective:{type:'STRING'},presentFunctioning:{type:'STRING'}},required:['predisposing','precipitating','perpetuating','protective','presentFunctioning']},
  strengths:{type:'STRING'},vulnerabilities:{type:'STRING'},riskAndLimits:{type:'STRING'},counselingPriorities:{type:'STRING'}
},required:['validity','testEvidence','currentState','stableTraits','convergentThemes','divergences','formulation','strengths','vulnerabilities','riskAndLimits','counselingPriorities']};


const CLIENT_REWRITE_SCHEMA={type:'OBJECT',properties:{
  clientCoreMind:{type:'STRING'},clientMindProfile:{type:'STRING'},clientIndividualTests:{type:'STRING'},clientEmotionState:{type:'STRING'},clientThinkingRelationship:{type:'STRING'},clientStressDaily:{type:'STRING'},clientExpertRecovery:{type:'STRING'},clientDisclaimer:{type:'STRING'},
  tciTemperamentSummary:{type:'STRING'},tciNS:{type:'STRING'},tciHA:{type:'STRING'},tciRD:{type:'STRING'},tciPS:{type:'STRING'},
  tciCharacterSummary:{type:'STRING'},tciSD:{type:'STRING'},tciCO:{type:'STRING'},tciST:{type:'STRING'},tciIntegrated:{type:'STRING'},
  tciStrengths:{type:'STRING'},tciCautions:{type:'STRING'},tciSuggestions:{type:'STRING'}
},required:['clientCoreMind','clientMindProfile','clientIndividualTests','clientEmotionState','clientThinkingRelationship','clientStressDaily','clientExpertRecovery','clientDisclaimer']};

const TCI_CLIENT_REWRITE_SCHEMA={type:'OBJECT',properties:{
  clientCoreMind:{type:'STRING'},clientMindProfile:{type:'STRING'},clientIndividualTests:{type:'STRING'},clientEmotionState:{type:'STRING'},clientThinkingRelationship:{type:'STRING'},clientStressDaily:{type:'STRING'},clientExpertRecovery:{type:'STRING'},clientDisclaimer:{type:'STRING'},
  tciTemperamentSummary:{type:'STRING'},tciNS:{type:'STRING'},tciHA:{type:'STRING'},tciRD:{type:'STRING'},tciPS:{type:'STRING'},
  tciCharacterSummary:{type:'STRING'},tciSD:{type:'STRING'},tciCO:{type:'STRING'},tciST:{type:'STRING'},tciIntegrated:{type:'STRING'},
  tciStrengths:{type:'STRING'},tciCautions:{type:'STRING'},
  tciRecommendations:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},basis:{type:'STRING'},action:{type:'STRING'}},required:['title','basis','action']}}
},required:['clientCoreMind','clientDisclaimer','tciTemperamentSummary','tciNS','tciHA','tciRD','tciPS','tciCharacterSummary','tciSD','tciCO','tciST','tciIntegrated','tciStrengths','tciCautions','tciRecommendations']};
function isTciOnlyRequest(body){
  const names=String(body?.testNames||body?.tests||'').split(/[,·]/).map(x=>x.trim()).filter(Boolean);
  return names.length===1 && /(^|\s)TCI(?:\s|$|기질)/i.test(names[0]) && !/JTCI/i.test(names[0]);
}


function tciLevelFromPercentile(value){
  const p=Number(value);
  if(!Number.isFinite(p)||p<0||p>100)return '';
  return p<=30?'낮음':p>=70?'높음':'보통';
}
function tciBandPosition(value){
  const p=Number(value);
  if(!Number.isFinite(p))return '';
  if(p<=30)return '낮은 범위';
  if(p>=70)return '높은 범위';
  if(p<=40)return '보통 범위의 하단';
  if(p>=60)return '보통 범위의 상단';
  return '보통 범위';
}
function tciScoresFromIntegratedSource(source){
  const inventory=Array.isArray(source?.sourceInventory)?source.sourceInventory:[];
  const tci=inventory.find(row=>/(^|\s)TCI(?:\s|$|기질)/i.test(String(row?.testType||''))&&!/JTCI/i.test(String(row?.testType||'')));
  const rows=Array.isArray(tci?.rawFacts?.tciScores)?tci.rawFacts.tciScores:[];
  const allowed=new Set(['NS','HA','RD','PS','SD','CO','ST']);
  return rows.map(row=>{
    const code=String(row?.code||'').toUpperCase();
    const percentile=Number(row?.percentile);
    if(!allowed.has(code)||!Number.isFinite(percentile)||percentile<0||percentile>100)return null;
    return {code,rawScore:Number(row?.rawScore),tScore:Number(row?.tScore),percentile,level:tciLevelFromPercentile(percentile),position:tciBandPosition(percentile)};
  }).filter(Boolean);
}
function enforceTciScaleLevels(report,source){
  const scores=tciScoresFromIntegratedSource(source);
  if(!scores.length)return report;
  const out={...report};
  const fields={NS:'tciNS',HA:'tciHA',RD:'tciRD',PS:'tciPS',SD:'tciSD',CO:'tciCO',ST:'tciST'};
  for(const row of scores){
    const key=fields[row.code];
    if(!key||!out[key])continue;
    let text=String(out[key]).trim();
    // AI가 임의로 만든 첫 점수/수준 문장은 제거하고 코드 판정을 기준 문장으로 고정합니다.
    const parts=text.split(/(?<=[.!?。])\s+/);
    if(parts.length&&/(?:백분위|점수|낮은?\s*수준|높은?\s*수준|보통\s*(?:수준|범위))/.test(parts[0]))parts.shift();
    text=parts.join(' ').trim();
    const prefix=`${row.code} 백분위는 ${row.percentile}로 ${row.position}에 해당합니다.`;
    out[key]=[prefix,text].filter(Boolean).join(' ');
  }
  return out;
}
function integratedRewritePrompt(body){
  const source=body.integratedReport||{};
  const tciScores=tciScoresFromIntegratedSource(source);
  const tciScoreGuide=tciScores.length?tciScores.map(row=>`${row.code}: 백분위 ${row.percentile} → ${row.level} (${row.position})`).join('\n'):'TCI 구조화 백분위 없음';
  return `당신은 임상심리사 1급 수준의 심리평가 보고서 작성자입니다. 아래 상담자용 AI 종합해석보고서를 유일한 근거로 사용하여, 내담자에게 실제로 제공할 수 있는 완성도 높은 심리검사 종합보고서를 새로 작성하십시오.

[프로그램]
${clean(body.program,180)}

[실시검사]
${clean(body.testNames||body.tests,1000)}

[상담자용 AI 종합해석보고서 근거]
${JSON.stringify(prepareIntegratedSource(source),null,2).slice(0,42000)}

[핵심 목표]
- 단순 요약이 아니라, 검사 결과를 한 사람의 심리적 흐름으로 재구성합니다.
- sourceInventory의 검사별 핵심결과를 실제 근거로 사용하고, normalizedEvidence·clinicalReasoning·decisionTrace의 근거 수준을 반영합니다.
- caseConceptualization은 현재 기능을 설명하는 중심 틀로 사용하고, conflictMap의 차이는 평소 특성·최근 상태·상황별 반응의 관계로 해석합니다.
- evidenceConfidence가 낮거나 validity에 제한이 있는 내용은 표현 강도를 낮추고 확정적으로 쓰지 않습니다.
- 각 영역에서 “무엇이 확인되었는지 → 어떤 상황에서 어떻게 나타날 수 있는지 → 생활과 관계에서 어떤 의미가 있는지 → 어떤 보호요인과 주의점이 있는지”를 연결합니다.
- 충분한 설명을 제공하되 같은 결론을 다른 영역에서 반복하지 않습니다.

[내부 작성 절차 — 출력하지 말 것]
1. 검사자료의 신뢰도와 해석 제한을 확인합니다.
2. 각 검사에서 실제로 확인된 핵심 근거를 추출합니다.
3. 두 검사 이상에서 함께 지지되는 공통 주제를 찾습니다.
4. 검사 간 차이가 있으면 상태-특성, 측정영역, 응답맥락의 차이로 이해합니다.
5. 현재 부담이 커지는 조건, 정서·사고·행동 반응, 유지요인, 일상 기능, 보호요인을 하나의 흐름으로 통합합니다.
6. 각 영역의 역할을 구분한 뒤 전문적이면서도 이해하기 쉬운 문장으로 새로 작성합니다.
7. 마지막에 영역 간 중복, 근거 없는 추정, 지나치게 짧은 설명을 점검하고 보완합니다.

[절대 규칙]
- 원자료에 없는 점수, 생활사, 사건, 진단, 위험요인을 만들지 않습니다.
- 결과가 불명확하면 추정하지 말고 해석의 제한을 밝힙니다.
- 내부 필드명(interpretationBasis, coreFindings, resultSummary 등)을 절대 출력하지 않습니다.
- 검사 결과 원문을 그대로 복사하거나 이어 붙이지 않습니다.
- 검사명을 반복적으로 나열하지 않습니다. 다만 중요한 해석 근거를 밝힐 때는 자연스럽게 사용합니다.
- 같은 핵심 의미를 다른 영역에서 다시 설명하지 않습니다.
- 보호요인과 취약요인을 함께 다루며, 한 특성이 상황에 따라 강점과 부담으로 달라질 수 있음을 설명합니다.
- SCT·HTP 등 투사적 자료는 가설적 단서로만 표현합니다.
- 전문적이되 내담자가 이해할 수 있는 쉬운 문장으로 씁니다.
- 진단 확정, 낙인, 홍보문, 감성적 위로, 열린 질문, AI 안내문을 넣지 않습니다.

[TCI 단독 보고서 점수 판정표 — 코드에서 확정된 값, 변경 금지]
${tciScoreGuide}
- 판정 기준은 백분위 0~30=낮음, 31~69=보통, 70~100=높음입니다.
- 위 판정은 AI가 재판정하거나 완화·강화할 수 없습니다. 특히 31~69를 낮음/높음으로 표현하지 않습니다.
- 31~40은 '보통 범위의 하단', 60~69는 '보통 범위의 상단'이라고 설명할 수 있으나 공식 수준은 반드시 '보통'입니다.
- 원점수나 T점수를 백분위처럼 사용하지 않습니다.

[TCI 단독 보고서 추가 규칙]
- 실시검사가 TCI 하나인 경우에만 tciTemperamentSummary, tciNS, tciHA, tciRD, tciPS, tciCharacterSummary, tciSD, tciCO, tciST, tciIntegrated, tciStrengths, tciCautions, tciRecommendations를 작성합니다. 다른 검사 조합이면 TCI 전용 필드는 비웁니다.
- 각 척도 해석은 sourceInventory의 TCI 실제 결과만 근거로 합니다. 원자료에 점수나 수준이 없으면 숫자나 높음/낮음을 추정하지 않습니다.
- tciTemperamentSummary는 NS·HA·RD·PS 개별 설명을 반복하지 말고, 네 척도의 조합이 만들어내는 전체 반응 스타일과 스트레스 대처 패턴만 3~4문장으로 통합합니다. 개별 척도 문장을 재사용하지 않습니다.
- tciNS/tciHA/tciRD/tciPS는 해당 척도의 실제 결과 → 상황에서 나타날 수 있는 방식 → 강점과 부담이 되는 조건 순으로 각각 3~5문장 작성합니다. 일반적인 척도 설명만 쓰지 않습니다.
- tciCharacterSummary는 SD·CO·ST 개별 설명을 반복하지 말고, 세 척도의 조합이 자기조절·관계·가치와 의미에서 만들어내는 전체 적응 방식을 3~4문장으로 통합합니다.
- tciSD/tciCO/tciST도 각 척도의 실제 결과에 근거해 3~5문장으로 작성합니다.
- tciIntegrated는 기질과 성격의 상호작용을 종합하여 현재의 적응 방식과 균형점을 설명합니다.
- tciStrengths는 실제 프로파일에서 확인되는 강점과 자원을 2~3개로 제한하고, 각 강점이 실제 생활에서 어떤 자원으로 활용될 수 있는지까지 연결합니다. 앞선 척도 설명을 반복하지 않습니다.
- tciCautions는 반드시 실제 프로파일의 특정 척도 또는 척도 조합에 근거합니다. 어떤 특성 조합이 어떤 상황에서 부담으로 나타날 수 있는지 2~3개 핵심 내용으로 구체화합니다. '검사 결과는 참고자료입니다', '패턴을 탐색합니다' 같은 보고서 안내 문구와 근거 없는 일반론은 금지합니다. 병리나 문제로 단정하지 않습니다.
- tciRecommendations는 정확히 3개의 객체 배열로 작성합니다. 각 객체는 title(짧고 구체적인 제목), basis(이 제안이 필요한 TCI 실제 점수/조합 근거 1~2문장), action(내담자가 실제로 해볼 수 있는 행동 1~2문장)만 포함합니다. 번호는 넣지 않습니다. 세 항목을 한 문자열로 합치지 않습니다. 모든 사람에게 통하는 수면·운동·휴식 같은 일반 조언은 금지합니다.

[주제별 재작성 원칙 — 가장 중요]
- 보고서의 어느 영역도 앞에서 생성한 문장을 잘라서 옮기거나, 문단을 분리하거나, 표현만 바꾸어 재사용하지 않습니다.
- 각 영역을 작성할 때마다 임상추론 프로파일과 sourceInventory로 다시 돌아가 그 영역에 해당하는 근거만 새로 선별합니다.
- 먼저 영역별로 사용할 근거를 내부적으로 배정한 뒤 문장을 새로 작성합니다. 하나의 근거를 여러 영역의 핵심 결론으로 중복 사용하지 않습니다.
- 같은 검사결과가 둘 이상의 영역과 관련될 때에는 한 영역을 '주 해석 영역'으로 정하고, 다른 영역에서는 꼭 필요한 연결 의미만 한 문장 이내로 사용합니다.
- 각 영역은 제목만 읽어도 무엇을 설명하는지 명확해야 하며, 다른 영역의 내용을 대신 설명하지 않습니다.
- 각 영역은 '핵심 결론 → 해당 주제의 검사 근거 → 그 주제 안에서의 심리적 의미 → 생활에서의 의미/조건' 순서로 하나의 완결된 해석을 만듭니다.
- 문장 수를 채우기 위해 일반론을 추가하지 않습니다. 근거가 부족하면 짧고 정확하게 작성합니다.
- 동일 결론을 여러 영역에서 반복하는 것을 금지합니다.
- 내담자용 종합보고서는 검사 설명서가 아니라 검사결과를 주제별로 재구성한 심리평가 해석이어야 합니다.

[영역별 근거 배정]
1. clientCoreMind — 현재 마음의 핵심 모습
   - 전체 결과에서 가장 설명력이 높은 핵심 심리 주제 2~3개만 선택하여 '이 사람을 전체적으로 어떻게 이해할 것인가'에 답합니다.
   - 뒤 섹션 내용을 나열하거나 요약하지 않습니다.
   - 현재 적응 수준, 중심 강점, 핵심 취약성이 서로 어떻게 작용하는지를 하나의 통합된 설명으로 새로 작성합니다.

2. clientMindProfile — 마음 프로파일
   - 정서 / 사고 / 관계 / 스트레스 / 자기조절 / 회복자원 6개 영역을 각각 1~2문장의 상위 요약으로 작성합니다.
   - 05 사고와 관계 방식, 06 스트레스와 일상생활에서 사용할 세부 해석을 여기서 반복하지 않습니다.
   - '사고 및 자기이해', '관계와 감정표현', '스트레스 반응', '일상생활에서의 의미' 같은 세부 소제목 표현을 마음 프로파일 본문에 쓰지 않습니다.
   - 각 영역은 핵심 특징 하나와 그 의미 하나만 간결하게 제시합니다.
   - 같은 검사 근거나 같은 문장을 05·06에 다시 사용할 수 있도록 장문으로 확장하지 않습니다.

3. clientIndividualTests — 개별검사 요약
   - 검사를 절대 합쳐 쓰지 않습니다. 실시한 각 검사명만 한 줄 소제목으로 구분합니다. 검사명 앞에 ■, ●, ▪, ▶ 같은 기호를 붙이지 않으며 [[MML_TEST:...]] 같은 내부 마커도 절대 출력하지 않습니다.
   - 각 검사마다 '검사명'을 한 줄 제목으로 먼저 쓰고, 다음 줄에 그 검사에서 실제 확인된 핵심 결과와 의미를 3~5문장으로 요약합니다. 검사별 내용을 절대 한 문단으로 합치지 않습니다.
   - MMPI-2 결과는 MMPI-2 자료만, TCI 결과는 TCI 자료만, PAI 결과는 PAI 자료만 사용합니다.
   - 다른 검사 결과를 해당 검사 결과인 것처럼 설명하지 않고, 검사 목적·일반론으로 분량을 채우지 않습니다.

4. clientEmotionState — 정서와 심리상태
   - 오직 현재 정서상태, 불안·우울·긴장·불편감, 감정 인식·표현·억제, 정서조절과 회복만 다룹니다.
   - 현재 상태를 직접 측정하는 검사 근거를 우선하고 성향 자료는 정서반응의 배경 설명에 필요한 경우만 제한적으로 사용합니다.
   - 관계 특성, 사고방식, 일반적인 생활 조언은 넣지 않습니다.
   - '현재 정서 상태의 결론 → 근거 → 감정을 처리하는 방식 → 부담이 커질 조건과 정서적 의미'의 흐름으로 작성합니다.

5. clientThinkingRelationship — 사고와 관계 방식
   - 정확히 두 주제로 처음부터 별도 작성합니다.
   - '사고 및 자기이해:'라는 소제목 다음에 판단, 계획, 예측 가능성 선호, 새로운 정보·경험에 대한 접근, 자기평가, 인지적 유연성 등 사고와 자기이해만 작성합니다.
   - '관계와 감정표현:'이라는 소제목 다음에 공감, 협력, 친밀감, 독립성, 자기주장, 욕구·감정표현, 경계설정, 갈등대처 등 대인관계만 작성합니다.
   - 한 문단을 둘로 나누거나 서로의 문장을 재사용하지 않습니다.

6. clientStressDaily — 스트레스와 일상생활
   - 정확히 두 주제로 처음부터 별도 작성합니다.
   - '스트레스 반응:'이라는 소제목 다음에 부담이 커지는 조건, 그때 나타날 수 있는 정서·인지·행동 반응, 대처 및 회복 양상만 작성합니다.
   - '일상생활에서의 의미:'라는 소제목 다음에 앞의 반응과 심리특성이 실제 적응, 업무·학업, 역할 수행, 변화 대응, 생활 유지에 어떤 의미가 있는지만 작성합니다.
   - 관계 특성이나 자기이해 내용을 다시 설명하지 않습니다.
   - 두 블록은 '스트레스 상황에서의 반응 → 생활 기능에서의 의미'로 연결합니다.

7. clientExpertRecovery — 전문가 제언 및 회복 방향
   - 앞의 결과를 다시 요약하지 않습니다.
   - 실제 검사결과에서 확인된 취약성·부담 조건과 보호요인을 근거로 3~4개의 우선순위 제언을 작성합니다.
   - 출력 형식은 반드시 “1. 구체적인 제언 제목: 제언 본문”, “2. 구체적인 제언 제목: 제언 본문”처럼 각 항목을 하나의 독립 항목으로 작성합니다.
   - 각 제언은 서로 다른 목표를 가지며 본문은 '왜 필요한가 → 구체적으로 무엇을 할 것인가 → 기대되는 변화' 순서로 씁니다.
   - 항목 번호는 1부터 연속으로 사용하며 문장 안에서 추가 번호를 사용하지 않습니다.
   - 특별한 어려움이 확인되지 않은 영역에는 억지로 문제나 치료과제를 만들지 않습니다.
   - 일반적인 조언은 개인 결과와 직접 연결되지 않으면 사용하지 않습니다.

8. clientDisclaimer — 보고서 안내
   - 2~3문장으로 검사결과의 범위와 해석 한계를 안내합니다.
   - 앞의 심리특성이나 제언을 다시 요약하지 않습니다.

${source?.revisionFeedback ? `

[이번 재작성에서 반드시 수정할 품질 이슈]
${JSON.stringify(source.revisionFeedback,null,2).slice(0,6000)}
` : ''}

[기호 사용 기준]
- 01~06 본문에는 ■, □, ●, ○, ▪, ▶, ◆ 같은 장식용 기호를 사용하지 않습니다.
- 03 개별검사 요약은 기호 대신 검사명 자체를 소제목으로 사용합니다.
- 05와 06은 소제목 뒤에 콜론(:)만 사용하며 대괄호 [ ]를 출력하지 않습니다.
- 07 전문가 제언에서만 1., 2., 3. 순번을 사용합니다. 화면에서는 01, 02, 03의 동일한 번호 배지로 표시되므로 제목 안에 별도의 번호나 기호를 넣지 않습니다.
- 문단 끝이나 문장 사이에 단독 기호를 절대 출력하지 않습니다.

[문체 기준]
- 모든 내담자 지칭은 반드시 '내담자님'으로 통일합니다. '당신', '귀하', '내담자'를 혼용하지 않습니다.
- 각 영역의 첫 문장은 제목에 직접 답하는 핵심 결론으로 시작합니다.
- 다음 문장들은 그 결론의 검사 근거 → 일상에서의 표현 → 심리적 의미 → 조건 또는 예외 순으로 자연스럽게 이어갑니다.
- 문단이 바뀌더라도 앞 문단과 의미가 이어져야 하며, 제목과 무관한 새로운 화제로 갑자기 전환하지 않습니다.
- 같은 결론을 다른 표현으로 반복하지 말고, 다음 문장은 반드시 새로운 근거·조건·생활 맥락을 더합니다.
- 결과 → 생활에서의 표현 → 임상적 의미 순서로 연결합니다.
- 단정 대신 ‘나타날 수 있습니다’, ‘가능성이 있습니다’, ‘함께 살펴볼 필요가 있습니다’를 적절히 사용합니다.
- 동일한 문장 시작을 반복하지 않습니다.
- ‘강점입니다’, ‘도움이 됩니다’, ‘중요합니다’로 끝나는 짧은 문장을 연속해서 쓰지 않습니다.
- 각 영역은 충분히 구체적이고 독립적으로 읽혀야 합니다.
- 최종 출력 전 01~07 전체를 비교하여 동일한 결론·예시·문장이 다른 영역에 반복되면 주 해석 영역 한 곳만 남기고 나머지는 해당 주제의 다른 근거로 다시 작성합니다.
- 각 문장이 바로 위 제목에 답하는지 확인하고, 제목을 바꾸어도 그대로 성립하는 일반적인 문장은 삭제하거나 해당 주제에 맞게 다시 씁니다.
- 전체 흐름은 01 전체 이해 → 02 영역별 프로파일 → 03 검사별 근거 → 04 정서 → 05 사고·관계 → 06 스트레스·생활 → 07 제언으로 점차 구체화되어야 합니다.

JSON만 반환하십시오.`;
}

const REPORT_FIELDS=['title','subtitle','evaluationOverview','testGuide','clinicalValidity','clinicalCurrentState','clinicalTrait','clinicalConvergence','clinicalDivergence','clinicalFormulation','clinicalProtectiveFactors','counselorCoreUnderstanding','counselorExplanation','evidenceSummary','counselorCaseFormulation5P','counselorRiskProtection','counselorCounselingFocus','counselorInitialQuestions','counselorInterventionGuide','counselorMonitoringPoints','professionalSummary','supervisorNote','clientCoreMind','clientMindProfile','clientIndividualTests','clientEmotionState','clientThinkingRelationship','clientStressDaily','clientExpertRecovery','clientSelfUnderstanding','clientTemperamentCharacter','clientCurrentMind','clientTestFindings','clientCommonPatterns','clientDifferences','clientFunctionalFormulation','clientStrengthGuide','clientRecoveryGuide','clientSupportGuide','clientProfessionalSummary','clientDisclaimer'];
const REPORT_SCHEMA={type:'OBJECT',properties:Object.fromEntries(REPORT_FIELDS.map(k=>[k,{type:'STRING'}])),required:REPORT_FIELDS};

function profilePrompt(body){const cfg=programConfig(body.program);return `당신은 임상심리사입니다. 아래 자료에서 보고서 문장을 쓰지 말고, 먼저 근거 중심 임상추론 프로파일을 작성하십시오.\n\n[프로그램]\n${clean(body.program)} / ${cfg.purpose}\n\n[핵심 원칙]\n- 실제 제공된 검사자료만 사용하고 점수·생활사·진단을 창작하지 않습니다.\n- 상태검사와 비교적 지속적인 특성을 구분합니다.\n- 검사를 나열하지 말고, 두 개 이상 검사에서 지지되는 주제를 근거와 함께 도출합니다.\n- 차이는 없애지 말고 측정영역·상태·대상·응답맥락의 차이로 설명합니다.\n- 부부는 두 사람을 분리한 뒤 관계 상호작용으로, 부모-자녀는 아동 발달·기질·양육태도를 분리한 뒤 적합성으로 통합합니다.\n- SCT·HTP는 가설적 자료이며 단정하지 않습니다.\n- 촉발요인은 실제 사건을 만들지 말고 '부담이 커지기 쉬운 조건' 수준으로 기술합니다.\n\n[검사자료]\n${testMaterial(body)}\n\n[교차분석]\n${crossMaterial(body.crossAnalysis)}\n\nJSON만 반환하십시오.`;}

function reportPrompt(body,profile){
  const cfg=programConfig(body.program);
  const names=(body.tests||[]).map(t=>clean(t.testType,100)).filter(Boolean);
  return `당신은 임상심리사 1급 수준의 전문 심리평가 보고서를 작성합니다. 아래 임상추론 프로파일을 유일한 근거로 상담자용 AI 종합해석보고서와 내담자용 심리검사 종합보고서를 동시에 작성하십시오.

[보고서 정보]
제목: ${cfg.title}
프로그램: ${clean(body.program)}
실시검사: ${names.join(', ')}
평가목적: ${cfg.purpose}

[임상추론 프로파일]
${JSON.stringify(profile,null,2)}

[내부 작성 절차 — 출력 금지]
1. 타당도와 해석 제한을 먼저 판단합니다.
2. 현재 상태와 비교적 지속적인 성향을 구분합니다.
3. 각 검사에서 사실로 확인된 근거를 추출합니다.
4. 두 검사 이상에서 수렴하는 핵심 주제를 도출합니다.
5. 불일치가 있으면 상태-특성, 측정영역, 대상, 응답맥락으로 설명합니다.
6. 보호요인과 취약요인을 분리한 뒤 상호작용을 검토합니다.
7. 부담이 커지는 조건→정서·사고·행동 반응→유지과정→현재 기능→회복자원으로 통합합니다.
8. 분석이 끝난 뒤 문장을 작성하고, 영역 간 중복을 제거합니다.

[근거와 안전 원칙]
- 제공된 자료에 없는 점수·사건·생활사·진단·위험을 창작하지 않습니다.
- 불명확한 결과는 추정하지 않고 '해석에 제한이 있음'으로 표시합니다.
- 모든 핵심 판단은 검사 근거와 연결합니다.
- SCT·HTP 등 투사적 자료는 가설적 단서로만 사용합니다.
- 진단 확정, 낙인, 과도한 위험 경고, 홍보문, 감성적 위로, 열린 질문을 내담자용 본문에 넣지 않습니다.
- 부부는 두 사람을 분리해 해석한 뒤 관계 상호작용으로 통합하고, 부모-자녀는 아동 발달·기질·양육태도를 분리한 뒤 적합성으로 통합합니다.

[통합 해석 원칙]
- 검사를 나열하지 말고 한 사람의 심리구조를 설명합니다.
- 'MMPI에서는..., TCI에서는...' 식의 반복을 피하고, 검사명은 근거를 밝힐 때만 자연스럽게 사용합니다.
- 같은 특성이 강점과 취약성으로 모두 작용할 수 있으면 상황 조건을 밝혀 균형 있게 설명합니다.
- 검사 간 차이는 '모순'으로 단정하지 말고 평소와 스트레스 상황의 차이, 측정영역의 차이, 응답맥락의 차이로 해석합니다.
- 결과 설명→생활에서의 표현→임상적 의미 순으로 연결합니다.

[중복 방지]
- 각 항목은 고유한 기능을 가집니다.
- 동일하거나 유사한 문장을 다른 항목에 복사하지 않습니다.
- 같은 핵심어를 사용할 때도 문장의 목적과 결론을 다르게 합니다.
- 한 항목에서 이미 설명한 검사결과는 다른 항목에서 재요약하지 말고 그 결과가 만드는 심리적 흐름이나 생활상의 의미로 확장합니다.

[내담자용 7개 고정 영역]
- clientCoreMind: 현재 마음의 핵심 모습. 평가 전체의 결론으로서 핵심 흐름, 현재 부담, 강점과 보호요인을 4~6문장으로 통합합니다.
- clientMindProfile: 마음 프로파일. 기질·성격·정서조절·자기인식·관계·스트레스 대처·회복자원을 균형 있게 설명합니다. 검사별 나열 금지.
- clientIndividualTests: 개별검사 요약. 실시한 각 검사명을 구분하고 실제 핵심 결과·의미·통합해석에 기여한 근거를 2~4문장씩 작성합니다. 검사 목적만 설명하지 않습니다.
- clientEmotionState: 정서와 심리상태. 감정 명칭을 나열하지 말고 부담이 커지는 조건, 정서반응, 조절방식, 현재 기능을 연결합니다.
- clientThinkingRelationship: 사고와 관계 방식. 판단·반추·자기평가·문제해결·의사소통·신뢰·갈등대처를 통합합니다.
- clientStressDaily: 스트레스와 일상생활. 부담 조건→반응→유지과정→일상 영향→회복자원의 흐름으로 씁니다.
- clientExpertRecovery: 전문가 제언 및 회복 방향. 강점 유지, 스트레스 시 주의점, 현실적인 회복전략, 전문적 도움이 필요한 상황을 3~5개 항목으로 제시하고 각각의 이유를 씁니다.
- clientDisclaimer: 검사 결과만으로 진단을 확정하지 않으며 실제 경험과 상담자의 종합 판단이 필요하다는 안내입니다.

[기존 내담자용 호환 필드]
- clientSelfUnderstanding: 검사 설명이 아니라 '나에 대한 이해'로 읽히는 5~6문장 통합 요약.
- clientTestFindings: 각 검사별 실제 결과와 의미. 내부 JSON 키와 영문 필드명 금지.
- clientCommonPatterns: 최소 두 검사에서 확인된 실제 근거를 제시한 뒤 공통 의미를 도출.
- clientDifferences: 실제 검사 간 차이를 먼저 밝히고 상태-특성·측정영역·응답맥락으로 설명.
- clientFunctionalFormulation: 부담 조건→반응→유지이유→기능영향→보호요인의 흐름.
- clientRecoveryGuide: 앞의 심리 흐름과 직접 연결된 3~4개의 회복 방향과 이유.
- clientProfessionalSummary: 앞 문단을 다시 요약하지 말고 이번 평가에서 가장 중요하게 이해할 한 가지 의미만 작성.

[상담자용 필드]
- counselorCoreUnderstanding: 상담자가 1분 안에 핵심을 파악할 수 있는 근거 중심 통합 요약.
- evidenceSummary: 해석→검사 근거→해석상 주의 순서.
- counselorCaseFormulation5P: Presenting, Predisposing, Precipitating, Perpetuating, Protective를 구분하고 근거 없는 사건을 만들지 않음.
- counselorCounselingFocus: 초기 우선순위 3개 안팎과 각 근거.
- counselorInitialQuestions: 가설 확인 질문 5~7개와 확인 목적.
- counselorInterventionGuide: 초기 1~4회기 방향, 보호요인 활용, 피해야 할 접근.
- counselorMonitoringPoints: 증상·기능·위험·회복자원 변화 중 실제 근거가 있는 항목만 제시.

JSON만 반환하십시오.`;
}
function localClinicalProfile(body){
  const tests=(body.tests||[]);
  const evidence=tests.map(t=>({
    test:clean(t.testType,120),subject:clean(t.subjectRole,80)||'미기재',
    finding:clean(t.coreFindings||t.sourceSummary,2200),
    meaning:clean(t.counselorReport||t.caseHypotheses||t.crossChecks,1600),
    caution:clean(t.cautions||t.validity,900)
  }));
  const join=(key,max=5000)=>tests.map(t=>clean(t[key],1400)).filter(Boolean).join('\n').slice(0,max);
  const cross=body.crossAnalysis||{};
  return {
    validity:join('validity',3200)||'모든 검사별 분석은 상담자 검토 완료 자료를 사용했습니다.',
    testEvidence:evidence,
    currentState:clean(cross.stateTrait,2400)||join('coreFindings',4200),
    stableTraits:join('strengths',2600),
    convergentThemes:[{theme:'검사 간 공통 주제',evidence:clean(cross.commonPatterns,2600)||join('crossChecks',2600),clinicalMeaning:clean(cross.caseIntegration,3000)||join('caseHypotheses',3000)}],
    divergences:clean(cross.differences,2200)||'검사별 측정영역과 응답맥락의 차이를 함께 고려해야 합니다.',
    formulation:{predisposing:join('caseHypotheses',1800),precipitating:'현재 부담이 커지기 쉬운 상황과 조건을 상담에서 확인합니다.',perpetuating:join('vulnerabilities',2200),protective:join('strengths',2200),presentFunctioning:clean(cross.caseIntegration,2800)||join('coreFindings',2800)},
    strengths:join('strengths',3000),vulnerabilities:join('vulnerabilities',3000),riskAndLimits:clean(cross.riskProtection,2200)||join('cautions',2200),counselingPriorities:join('counselingQuestions',2600)
  };
}
class GeminiRequestError extends Error{
  constructor(message,status=0,code='GEMINI_ERROR'){
    super(message);this.name='GeminiRequestError';this.status=Number(status||0);this.code=code;
    this.retryable=[429,500,502,503,504].includes(this.status)||code==='TIMEOUT'||code==='NETWORK';
  }
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function gemini(apiKey,model,prompt,schema){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    let r;
    try{
      r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,{
        method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.12,topP:0.8,maxOutputTokens:7800,responseMimeType:'application/json',responseSchema:schema,thinkingConfig:{thinkingBudget:0}}})
      });
    }catch(error){
      if(error?.name==='AbortError')throw new GeminiRequestError('AI 응답 시간이 초과되었습니다.',504,'TIMEOUT');
      throw new GeminiRequestError(error?.message||'AI 서버에 연결하지 못했습니다.',0,'NETWORK');
    }
    const raw=await r.text();let data={};try{data=JSON.parse(raw)}catch{}
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
    if(!r.ok)throw new GeminiRequestError(data?.error?.message||`Gemini HTTP ${r.status}`,r.status,'HTTP_ERROR');
    if(!text)throw new GeminiRequestError('AI가 빈 응답을 반환했습니다.',502,'EMPTY_RESPONSE');
    try{return JSON.parse(text)}catch{throw new GeminiRequestError('AI 응답 형식을 해석하지 못했습니다.',502,'INVALID_JSON')}
  }finally{clearTimeout(timer)}
}
async function callFast(apiKey,prompt,schema){
  const model=clean(process.env.GEMINI_REPORT_MODEL,100)||'gemini-2.5-flash';
  const retryDelays=[0,2000,5000];
  let lastError=null;
  for(let attempt=0;attempt<retryDelays.length;attempt++){
    if(retryDelays[attempt])await wait(retryDelays[attempt]);
    try{
      console.log(`[MML REPORT AI] attempt ${attempt+1}/${retryDelays.length} · ${model}`);
      const data=await gemini(apiKey,model,prompt,schema);
      if(attempt>0)console.log(`[MML REPORT AI] recovered on attempt ${attempt+1}`);
      return{data,model,attempts:attempt+1};
    }catch(error){
      lastError=error;
      console.warn(`[MML REPORT AI] attempt ${attempt+1} failed`,{status:error?.status||0,code:error?.code||'',message:error?.message||String(error)});
      if(!error?.retryable||attempt===retryDelays.length-1)break;
    }
  }
  throw lastError||new GeminiRequestError('AI 보고서 생성에 실패했습니다.',503,'RETRY_EXHAUSTED');
}
function fallbackReport(body,profile){
  const cfg=programConfig(body.program);const tests=body.tests||[];
  const each=tests.map(t=>`${clean(t.testType)}\n확인된 결과: ${clean(t.coreFindings||t.sourceSummary,1800)}\n의미: ${clean(t.clientReport||t.counselorReport||t.crossChecks,1200)}\n해석상 주의: ${clean(t.cautions||t.validity,700)}`).join('\n\n');
  const strengths=tests.map(t=>clean(t.strengths,900)).filter(Boolean).join('\n');
  const vul=tests.map(t=>clean(t.vulnerabilities,900)).filter(Boolean).join('\n');
  const common=clean(body.crossAnalysis?.commonPatterns,2200)||tests.map(t=>clean(t.crossChecks,900)).filter(Boolean).join('\n');
  const integration=clean(body.crossAnalysis?.caseIntegration,2600)||profile.formulation.presentFunctioning;
  const out={};for(const k of REPORT_FIELDS)out[k]='';
  Object.assign(out,{title:cfg.title,subtitle:'검사 결과를 삶의 맥락에서 이해하고 상담과 회복의 방향을 찾기 위한 심리평가보고서',evaluationOverview:`${clean(body.program)}에서 실시한 ${tests.map(t=>clean(t.testType,100)).join(', ')} 결과를 통합했습니다.`,testGuide:tests.map(t=>`${clean(t.testType)}: ${roleOf(t.testType)}`).join('\n'),clinicalValidity:profile.validity,clinicalCurrentState:profile.currentState,clinicalTrait:profile.stableTraits,clinicalConvergence:common,clinicalDivergence:profile.divergences,clinicalFormulation:integration,clinicalProtectiveFactors:strengths,counselorCoreUnderstanding:integration,counselorExplanation:integration,evidenceSummary:each,counselorCaseFormulation5P:`선행요인: ${profile.formulation.predisposing}\n촉발조건: ${profile.formulation.precipitating}\n유지요인: ${profile.formulation.perpetuating}\n보호요인: ${profile.formulation.protective}\n현재기능: ${profile.formulation.presentFunctioning}`,counselorRiskProtection:`취약성: ${vul}\n보호요인: ${strengths}`,counselorCounselingFocus:profile.counselingPriorities||vul,counselorInitialQuestions:tests.map(t=>clean(t.counselingQuestions,700)).filter(Boolean).join('\n'),counselorInterventionGuide:'초기에는 검사결과를 실제 경험과 연결하여 확인하고, 부담을 유지하는 반응과 활용 가능한 보호요인을 함께 다룹니다.',counselorMonitoringPoints:profile.riskAndLimits,professionalSummary:integration,supervisorNote:'AI 초안입니다. 상담자의 임상적 검토와 수정 후 사용합니다.',clientCoreMind:integration,clientMindProfile:[profile.stableTraits,strengths,common].filter(Boolean).join('\n'),clientIndividualTests:each,clientEmotionState:profile.currentState,clientThinkingRelationship:[profile.stableTraits,profile.divergences,common].filter(Boolean).join('\n'),clientStressDaily:[profile.formulation.precipitating,profile.formulation.perpetuating,profile.formulation.presentFunctioning].filter(Boolean).join('\n'),clientExpertRecovery:['부담이 커지는 상황과 반응의 흐름을 구체적으로 알아차리는 것이 도움이 됩니다.',strengths?'검사에서 확인된 강점과 보호요인을 실제 생활에서 의도적으로 활용하는 것이 필요합니다. '+strengths:'','변화는 한 번에 크게 시도하기보다 작은 목표를 정하고 점검하는 방식이 적절합니다.'].filter(Boolean).join('\n'),clientSelfUnderstanding:integration,clientTemperamentCharacter:profile.stableTraits,clientCurrentMind:profile.currentState,clientTestFindings:each,clientCommonPatterns:common,clientDifferences:profile.divergences,clientFunctionalFormulation:integration,clientStrengthGuide:strengths,clientRecoveryGuide:'현재 부담을 높이는 상황과 반복 반응을 알아차리고, 이미 확인된 강점과 보호요인을 실제 생활에서 활용하는 방향이 도움이 됩니다.',clientSupportGuide:strengths,clientProfessionalSummary:integration,clientDisclaimer:'이 보고서는 심리검사 결과를 바탕으로 현재의 상태와 경향을 이해하기 위한 참고자료입니다. 검사 결과만으로 진단을 확정하지 않으며, 실제 경험과 상담자의 종합적 판단을 함께 고려합니다.'});
  return out;
}
// MOD-20260720-INTEGRATED-REPORT-COMPLETE-SECTIONS
// 통합 결과보고서의 평가목적·대인관계·종합제언·상담자 종합의견이
// AI 응답 누락 또는 짧은 기본문구 때문에 비어 보이지 않도록 실제 검사 근거로 보완합니다.
function usable(v,max=2600){
  const text=clean(v,max);
  if(!text)return '';
  const placeholders=[
    '상담 면담을 통해 확인 필요',
    '상담에서 확인 필요',
    '추가 확인 필요',
    '현재 부담을 높이는 상황과 반복 반응을 알아차리고',
    '검사 결과에서 확인된 핵심 특징은 상담자 검토 자료를 기준으로 해석합니다'
  ];
  return placeholders.some(x=>text.includes(x))?'':text;
}
function joinUnique(parts,max=5200){
  const seen=new Set();
  return parts.map(x=>clean(x,1800)).filter(Boolean).filter(x=>{
    const key=x.replace(/\s+/g,' ').slice(0,160);
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).join('\n\n').slice(0,max);
}
function buildEvaluationOverview(body){
  const cfg=programConfig(body.program);
  const tests=(body.tests||[]).map(t=>clean(t.testType,120)).filter(Boolean);
  const roles=(body.tests||[]).map(t=>roleOf(t.testType)).filter(Boolean);
  const uniqueRoles=[...new Set(roles)];
  const testText=tests.length?tests.join(', '):'실시한 심리검사';
  const roleText=uniqueRoles.length?uniqueRoles.join(', '):'현재의 심리상태와 개인의 특성';
  return `본 평가는 ${cfg.purpose}하기 위해 실시되었습니다. ${testText} 결과를 함께 살펴보아 ${roleText}을 다각도로 이해하고, 여러 검사에서 일관되게 나타나는 특징과 검사별 차이를 종합하는 데 목적이 있습니다. 각 결과는 단독으로 진단을 확정하기보다 실제 생활에서의 경험과 상담자의 임상적 판단을 함께 고려하여 해석합니다.`;
}
function buildRelationshipStyle(body,profile){
  const tests=body.tests||[];
  const relationshipEvidence=tests.map(t=>{
    const name=clean(t.testType,120);
    const source=joinUnique([t.clientReport,t.counselorReport,t.coreFindings,t.crossChecks,t.sourceSummary],1800);
    if(!source)return '';
    const relLines=source.split(/\n|(?<=[.!?다요])\s+/).filter(line=>/관계|대인|타인|친밀|사회|의사소통|표현|갈등|협력|민감|거리|신뢰|의존|회피/.test(line));
    return relLines.length?`${name}에서는 ${relLines.slice(0,2).join(' ')}`:'';
  }).filter(Boolean);
  const cross=usable(body.crossAnalysis?.commonPatterns,1800)||usable(body.crossAnalysis?.caseIntegration,1800);
  const trait=usable(profile.stableTraits,1800);
  const state=usable(profile.currentState,1200);
  const evidence=joinUnique([...relationshipEvidence,cross,trait],3600);
  if(evidence)return `${evidence}\n\n이 결과는 관계능력의 좋고 나쁨을 뜻하기보다, 사람과 상황에 따라 가까워지는 속도, 감정을 표현하는 방식, 긴장이나 갈등에 대응하는 방식에서 나타날 수 있는 경향을 보여줍니다. 실제 대인관계에서 이러한 모습이 언제 두드러지는지는 상담 과정에서 생활 경험과 함께 확인하는 것이 적절합니다.`;
  return `제공된 검사자료만으로 특정한 대인관계 양상을 단정하기는 어렵습니다. 다만 현재의 정서적 부담과 비교적 지속적인 성격 특성이 관계에서의 긴장, 감정 표현, 거리 조절 방식에 영향을 줄 수 있으므로 실제 생활에서 편안한 관계와 부담스러운 관계가 어떻게 다른지 함께 살펴볼 필요가 있습니다.`;
}
function buildSuggestions(body,profile){
  const current=usable(profile.currentState,1600);
  const maintaining=usable(profile.formulation?.perpetuating,1600)||usable(profile.vulnerabilities,1600);
  const strengths=usable(profile.formulation?.protective,1600)||usable(profile.strengths,1600);
  const limits=usable(profile.riskAndLimits,1100);
  return joinUnique([
    current?`현재 나타나는 심리적 부담과 기능 변화를 구체적으로 구분해 살펴보는 것이 우선입니다. ${current}`:'',
    maintaining?`부담이 반복되거나 오래 이어지는 데 영향을 주는 반응을 알아차릴 필요가 있습니다. ${maintaining} 이러한 흐름을 상황·생각·감정·행동의 순서로 정리하면 조절 가능한 지점을 찾는 데 도움이 됩니다.`:'',
    strengths?`검사에서 확인된 강점과 보호요인은 회복 과정에서 실제 자원으로 활용할 수 있습니다. ${strengths} 이미 가능한 행동을 작게 반복하고 생활 리듬과 지지관계를 함께 유지하는 방식이 도움이 됩니다.`:'',
    limits?`검사 해석의 한계와 현재 확인이 필요한 부분은 다음과 같습니다. ${limits} 증상이 지속되거나 일상 기능의 저하가 커질 경우에는 전문적인 면담을 통해 현재 상태를 추가로 평가하는 것이 권장됩니다.`:''
  ],5200)||'검사 결과는 현재의 어려움을 이해하는 출발점으로 활용할 수 있습니다. 부담이 커지는 상황과 반복되는 반응을 구체적으로 확인하고, 이미 가지고 있는 강점과 주변의 지지자원을 실제 생활에서 활용하는 방향이 도움이 됩니다.';
}
function buildProfessionalSummary(body,profile){
  const tests=body.tests||[];
  const testEvidence=tests.map(t=>{
    const finding=usable(t.coreFindings||t.sourceSummary,1100);
    return finding?`${clean(t.testType,120)}에서는 ${finding}`:'';
  }).filter(Boolean);
  const convergence=usable(body.crossAnalysis?.commonPatterns,1700)||usable(profile.convergentThemes?.map(x=>`${x.theme}: ${x.clinicalMeaning}`).join('\n'),1700);
  const divergence=usable(body.crossAnalysis?.differences,1200)||usable(profile.divergences,1200);
  const functioning=usable(body.crossAnalysis?.caseIntegration,1700)||usable(profile.formulation?.presentFunctioning,1700)||usable(profile.currentState,1700);
  const protection=usable(profile.strengths,1200)||usable(profile.formulation?.protective,1200);
  return joinUnique([
    testEvidence.slice(0,3).join('\n'),
    convergence?`여러 검사에서 함께 확인되는 핵심 흐름은 다음과 같습니다. ${convergence}`:'',
    divergence?`검사 간 차이는 다음과 같이 해석할 수 있습니다. ${divergence}`:'',
    functioning?`종합하면 현재의 심리적 기능은 다음과 같이 이해됩니다. ${functioning}`:'',
    protection?`회복과 적응을 도울 수 있는 보호요인은 다음과 같습니다. ${protection}`:'',
    '이 의견은 제공된 검사자료를 근거로 작성한 초안이며, 상담자는 면담 내용과 실제 생활에서의 기능을 함께 확인한 뒤 최종 승인합니다.'
  ],6200);
}

function fill(report,body){
  const cfg=programConfig(body.program);
  const fallback=fallbackReport(body,localClinicalProfile(body));
  const out={};
  for(const k of REPORT_FIELDS){
    const ai=clean(report?.[k]);
    out[k]=ai||clean(fallback[k]);
  }
  out.title||=cfg.title;
  out.subtitle||='검사 결과를 삶의 맥락에서 이해하고 상담과 회복의 방향을 찾기 위한 심리평가보고서';
  out.evaluationOverview||=`${clean(body.program)}에서 실시한 ${(body.tests||[]).map(t=>clean(t.testType,100)).join(', ')} 결과를 통합했습니다.`;
  out.testGuide||=(body.tests||[]).map(t=>`${clean(t.testType)}: ${roleOf(t.testType)}`).join('\n');
  out.clientDisclaimer||='이 보고서는 심리검사 결과를 바탕으로 현재의 상태와 경향을 이해하기 위한 참고자료입니다. 검사 결과만으로 진단을 확정하지 않으며, 실제 경험과 상담자의 종합적 판단을 함께 고려합니다.';
  // MML-V18: 심리검사 종합보고서는 개별 심리보고서와 동일한 6개 영역을 사용합니다.
  out.clientCoreMind=clean(out.clientCoreMind)||out.clientSelfUnderstanding||out.professionalSummary;
  out.clientMindProfile=clean(out.clientMindProfile)||sentenceBlock([out.clientTemperamentCharacter,out.clientStrengthGuide,out.clientCommonPatterns]);
  out.clientIndividualTests=clean(out.clientIndividualTests)||out.clientTestFindings||out.evidenceSummary;
  out.clientEmotionState=clean(out.clientEmotionState)||out.clientCurrentMind||out.clinicalCurrentState;
  out.clientThinkingRelationship=clean(out.clientThinkingRelationship)||sentenceBlock([out.clientTemperamentCharacter,out.clientDifferences,out.clientCommonPatterns]);
  out.clientStressDaily=clean(out.clientStressDaily)||out.clientFunctionalFormulation||out.clinicalFormulation;
  out.clientExpertRecovery=clean(out.clientExpertRecovery)||sentenceBlock([out.clientRecoveryGuide,out.clientProfessionalSummary]);
  // 심리평가센터 화면과 이전 저장 자료가 함께 사용할 수 있는 표시용 호환 필드입니다.
  out.keyMessage=out.clientSelfUnderstanding||out.professionalSummary||out.counselorCoreUnderstanding;
  out.emotionalProfile=out.clinicalCurrentState||out.clientCurrentMind;
  out.thinkingStyle=out.clinicalTrait||out.clientTemperamentCharacter;
  out.relationshipStyle=out.clinicalConvergence||out.clientCommonPatterns;
  out.stressRecovery=out.clinicalFormulation||out.clientFunctionalFormulation;
  out.strengthsResources=out.clinicalProtectiveFactors||out.clientStrengthGuide;
  out.integratedUnderstanding=out.counselorCoreUnderstanding||out.clientFunctionalFormulation||out.professionalSummary;
  out.currentSignals=out.counselorRiskProtection||out.counselorMonitoringPoints||out.clientDifferences;
  out.psychologicalSuggestions=out.clientRecoveryGuide||out.counselorInterventionGuide||out.counselorCounselingFocus;
  out.disclaimer=out.clientDisclaimer;

  // MOD-20260720-INTEGRATED-REPORT-COMPLETE-SECTIONS
  // AI가 필드를 비우거나 기존 placeholder를 반환해도 보고서 주요 영역은 실제 검사자료로 채웁니다.
  if(!usable(out.evaluationOverview,2600)||clean(out.evaluationOverview).length<140)out.evaluationOverview=buildEvaluationOverview(body);
  if(!usable(out.relationshipStyle,4200)||clean(out.relationshipStyle).length<220)out.relationshipStyle=buildRelationshipStyle(body,localClinicalProfile(body));
  if(!usable(out.psychologicalSuggestions,5200)||clean(out.psychologicalSuggestions).length<320)out.psychologicalSuggestions=buildSuggestions(body,localClinicalProfile(body));
  if(!usable(out.professionalSummary,6200)||clean(out.professionalSummary).length<320)out.professionalSummary=buildProfessionalSummary(body,localClinicalProfile(body));

  // 저장 데이터와 화면 호환 필드도 최종 보완된 문안을 사용합니다.
  out.clientRecoveryGuide=out.psychologicalSuggestions;
  out.clientProfessionalSummary=out.professionalSummary;
  out.clientCommonPatterns=out.relationshipStyle||out.clientCommonPatterns;
  return out;
}

function sentenceBlock(parts,min=0){
  const text=parts.map(x=>clean(x,4000)).filter(Boolean).join('\n\n').trim();
  if(!text)return '';
  if(text.length>=min)return text;
  return text;
}

// MOD-20260720-INTEGRATED-SCORE-INTERPRETATION-RESTORE
// 통합 결과보고서의 '검사별 결과 해석'을 실제 검사점수와 결과해석으로 구성합니다.
function scoreFactText(value){
  if(value===null||value===undefined)return '';
  if(typeof value==='string'||typeof value==='number')return clean(value,500);
  if(Array.isArray(value))return value.map(scoreFactText).filter(Boolean).join(' / ');
  if(typeof value==='object'){
    const preferred=['scoreText','displayScore','score','tScore','percentile','rawScore','value','result','level','range'];
    const parts=[];
    for(const key of preferred){
      if(value[key]!==undefined&&value[key]!==null&&String(value[key]).trim())parts.push(`${key==='tScore'?'T점수':key==='percentile'?'백분위':key==='rawScore'?'원점수':key==='level'?'수준':key==='range'?'범위':''}${key==='score'||key==='value'||key==='result'||key==='scoreText'||key==='displayScore'?'':': '}${scoreFactText(value[key])}`.trim());
    }
    return [...new Set(parts)].join(' / ')||clean(valueText(value),500);
  }
  return '';
}
function factLabel(fact,index){
  if(!fact||typeof fact!=='object')return `결과 ${index+1}`;
  return clean(fact.scale||fact.scaleName||fact.name||fact.label||fact.code||fact.domain||fact.subscale||`결과 ${index+1}`,160);
}
function factInterpretation(fact,test,label){
  if(fact&&typeof fact==='object'){
    const direct=clean(fact.interpretation||fact.meaning||fact.description||fact.summary||fact.clinicalMeaning||fact.resultInterpretation,1400);
    if(direct)return direct;
  }
  const source=clean(test.coreFindings||test.sourceSummary||test.clientReport||test.counselorReport,6000);
  if(label&&source){
    const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const match=source.match(new RegExp(`[^.!?\n]*${escaped}[^.!?\n]*(?:[.!?]|$)`,'i'));
    if(match&&clean(match[0]).length>=12)return clean(match[0],1400);
  }
  return clean(test.coreFindings||test.sourceSummary||test.crossChecks,1400)||'해당 점수는 검사 전체 프로파일과 현재 생활 맥락을 함께 고려하여 해석해야 합니다.';
}
function normalizedScoreFacts(test){
  const raw=test?.rawFacts||{};
  const candidates=[];
  if(Array.isArray(raw.scoreFacts))candidates.push(...raw.scoreFacts);
  if(Array.isArray(raw.scores))candidates.push(...raw.scores);
  if(Array.isArray(test?.scoreFacts))candidates.push(...test.scoreFacts);
  if(!candidates.length&&raw&&typeof raw==='object'){
    for(const [key,value] of Object.entries(raw)){
      if(/score|점수|척도/i.test(key)&&Array.isArray(value))candidates.push(...value);
    }
  }
  return candidates.filter(Boolean).slice(0,24);
}
function scoreInterpretationSection(test,index){
  const name=clean(test.testType,120)||'심리검사';
  const facts=normalizedScoreFacts(test);
  const lines=[`[${index+1}. ${name}]`,`검사점수 | 결과해석`];
  if(facts.length){
    facts.forEach((fact,i)=>{
      const label=factLabel(fact,i);
      const score=scoreFactText(fact);
      const displayScore=score&&score!==label?`${label} ${score}`:label;
      lines.push(`${displayScore} | ${factInterpretation(fact,test,label)}`);
    });
  }else{
    const scoreText=clean(test.sourceSummary,900).match(/(?:T\s*점수|T\s*=|백분위|원점수|표준점수|척도)[^\n]{0,180}/gi)||[];
    if(scoreText.length){
      scoreText.slice(0,12).forEach(score=>lines.push(`${clean(score,220)} | ${factInterpretation(null,test,'')}`));
    }else{
      lines.push(`점수 원자료 확인 필요 | ${clean(test.coreFindings||test.sourceSummary,1800)||'업로드된 결과지에서 점수 정보가 구조화되지 않아 상담자 확인이 필요합니다.'}`);
    }
  }
  const summary=clean(test.coreFindings||test.crossChecks,1800);
  if(summary)lines.push(`핵심 요약 | ${summary}`);
  return lines.join('\n');
}
function buildScoreInterpretationGuide(tests){
  return (tests||[]).map(scoreInterpretationSection).join('\n\n');
}

function perTestSection(t){
  const name=clean(t.testType,120)||'심리검사';
  const role=roleOf(name);
  const finding=clean(t.coreFindings||t.sourceSummary,2200)||'검사 결과에서 확인된 핵심 특징은 상담자 검토 자료를 기준으로 해석합니다.';
  const meaning=clean(t.clientReport||t.counselorReport||t.crossChecks,1600)||`${role}을 중심으로 현재 경험과 지속적인 경향을 구분하여 이해할 필요가 있습니다.`;
  const strengths=clean(t.strengths,1000);
  const caution=clean(t.cautions||t.validity,900)||'검사 결과는 단독으로 진단을 확정하지 않으며 실제 생활경험과 상담자의 종합적 판단을 함께 고려합니다.';
  return `${name}\n확인된 결과: ${finding}\n의미: ${meaning}${strengths?`\n강점 및 자원: ${strengths}`:''}\n해석상 주의: ${caution}`;
}
function hasTestName(text,name){
  const hay=normalize(text);const n=normalize(name);
  if(!n)return true;
  const keys=[n,n.replace(/검사$/,''),n.slice(0,Math.min(n.length,4))].filter(x=>x.length>=3);
  return keys.some(k=>hay.includes(k));
}
function ensureCompleteReport(report,body,profile){
  const out={...report};
  const tests=body.tests||[];const cross=body.crossAnalysis||{};
  const allFindings=tests.map(perTestSection);
  const missing=tests.filter(t=>!hasTestName(out.clientTestFindings,t.testType));
  if(missing.length)out.clientTestFindings=[clean(out.clientTestFindings,12000),...missing.map(perTestSection)].filter(Boolean).join('\n\n');
  if(clean(out.clientTestFindings).length<700)out.clientTestFindings=allFindings.join('\n\n');

  const commonEvidence=clean(cross.commonPatterns,3000)||tests.map(t=>`[${clean(t.testType,120)}] ${clean(t.crossChecks||t.coreFindings,1000)}`).filter(Boolean).join('\n');
  if(clean(out.clientCommonPatterns).length<350){
    out.clientCommonPatterns=sentenceBlock([
      '앞에서 살펴본 검사 결과를 함께 놓고 보면, 서로 다른 검사에서도 반복해서 확인되는 특징이 있습니다.',
      commonEvidence,
      clean(cross.caseIntegration,2600)||profile.formulation.presentFunctioning,
      '이러한 공통 흐름은 현재의 어려움뿐 아니라 평소의 대처방식과 관계 경험을 함께 살펴볼 때 더 정확하게 이해할 수 있습니다.'
    ]);
  }
  if(clean(out.clientDifferences).length<320){
    const compared=tests.slice(0,3).map(t=>`[${clean(t.testType,120)}] ${clean(t.coreFindings||t.sourceSummary,900)}`).join('\n');
    out.clientDifferences=sentenceBlock([
      compared,
      clean(cross.differences,2200)||profile.divergences,
      clean(cross.stateTrait,1800)||'이 차이는 서로 모순되는 결과라기보다 현재의 심리상태와 비교적 지속적인 성향, 또는 검사마다 살펴보는 기능이 다르게 반영된 것으로 이해할 수 있습니다.',
      '따라서 어느 한 결과만 선택하기보다 실제 생활에서 두 모습이 언제, 어떤 상황에서 나타나는지 함께 살펴보는 것이 적절합니다.'
    ]);
  }
  if(clean(out.clientRecoveryGuide).length<450){
    out.clientRecoveryGuide=sentenceBlock([
      '첫째, 부담이 커지는 상황과 그때 나타나는 생각·감정·행동의 순서를 구체적으로 알아차리는 것이 필요합니다. 이는 막연한 불편감을 조절 가능한 경험으로 바꾸는 출발점이 됩니다.',
      `둘째, 검사에서 확인된 강점과 보호요인을 실제 생활에서 의도적으로 활용합니다. ${clean(profile.strengths,1800)||'이미 유지하고 있는 책임감, 관계자원, 자기조절 자원을 구체적인 행동으로 연결하는 것이 도움이 됩니다.'}`,
      `셋째, 반복적으로 부담을 유지하는 요인을 줄이는 연습이 필요합니다. ${clean(profile.formulation.perpetuating,1800)||'과도한 자기비판, 회피, 경계 설정의 어려움처럼 부담을 지속시키는 반응이 실제 생활에서 어떻게 나타나는지 확인합니다.'}`,
      '넷째, 변화는 한 번에 크게 시도하기보다 작은 목표를 정하고 실행 결과를 점검하는 방식이 적절합니다. 상담에서는 검사 결과를 실제 경험과 비교하며 개인에게 맞는 회복 전략을 조정합니다.'
    ]);
  }
  if(clean(out.counselorCounselingFocus).length<300){
    out.counselorCounselingFocus=sentenceBlock([
      `1. 초기 우선순위: 현재 기능과 정서적 부담을 구체적으로 확인합니다. 근거: ${clean(profile.currentState,1400)}`,
      `2. 유지요인 탐색: 반복되는 대처와 관계 패턴이 어려움을 어떻게 지속시키는지 점검합니다. 근거: ${clean(profile.formulation.perpetuating,1400)||clean(profile.vulnerabilities,1400)}`,
      `3. 보호요인 활용: 내담자가 이미 가지고 있는 강점과 환경적 자원을 실제 변화계획에 연결합니다. 근거: ${clean(profile.formulation.protective,1400)||clean(profile.strengths,1400)}`,
      '상담 초기에는 검사 해석을 단정적으로 전달하기보다 내담자의 실제 경험과 일치하는지 확인하고, 불일치하는 부분은 추가 가설로 남겨 두는 접근이 필요합니다.'
    ]);
  }
  if(clean(out.clientSelfUnderstanding).length<350){
    out.clientSelfUnderstanding=sentenceBlock([clean(out.clientSelfUnderstanding),profile.currentState,profile.stableTraits,clean(cross.caseIntegration,2200),profile.strengths]);
  }
  if(clean(out.clientFunctionalFormulation).length<700){
    out.clientFunctionalFormulation=sentenceBlock([
      `부담이 커지기 쉬운 조건: ${profile.formulation.precipitating}`,
      `이때 나타날 수 있는 반응: ${profile.currentState}`,
      `어려움을 유지할 수 있는 과정: ${profile.formulation.perpetuating}`,
      `현재 기능과 생활에서의 영향: ${profile.formulation.presentFunctioning}`,
      `회복을 돕는 보호요인: ${profile.formulation.protective}`,
      '이 흐름은 확정된 진단이 아니라 검사자료를 토대로 세운 임상적 가설이며, 상담 과정에서 실제 경험과 비교하여 수정·보완해야 합니다.'
    ]);
  }
  if(clean(out.counselorCoreUnderstanding).length<350)out.counselorCoreUnderstanding=sentenceBlock([profile.currentState,profile.stableTraits,clean(cross.caseIntegration,2400),profile.counselingPriorities]);
  if(clean(out.evidenceSummary).length<500)out.evidenceSummary=allFindings.join('\n\n');
  if(clean(out.counselorCaseFormulation5P).length<550){
    out.counselorCaseFormulation5P=`현재 호소 및 기능(Presenting): ${profile.formulation.presentFunctioning}\n\n선행요인(Predisposing): ${profile.formulation.predisposing}\n\n촉발요인(Precipitating): ${profile.formulation.precipitating}\n\n유지요인(Perpetuating): ${profile.formulation.perpetuating}\n\n보호요인(Protective): ${profile.formulation.protective}\n\n위 내용은 검사자료에 근거한 임상적 가설이며 면담과 경과 관찰을 통해 지속적으로 검증합니다.`;
  }
  return out;
}

function quality(report,body){
  const issues=[];
  const required={clientCoreMind:250,clientMindProfile:250,clientIndividualTests:500,clientEmotionState:250,clientThinkingRelationship:250,clientStressDaily:250,clientExpertRecovery:250,clientSelfUnderstanding:350,clientTestFindings:700,clientCommonPatterns:350,clientFunctionalFormulation:700,clientRecoveryGuide:450,counselorCoreUnderstanding:350,evidenceSummary:500,counselorCaseFormulation5P:550,counselorCounselingFocus:300};
  for(const[k,n]of Object.entries(required))if(clean(report[k]).length<n)issues.push(`${k} 내용 부족`);
  const names=(body.tests||[]).map(t=>normalize(t.testType)).filter(Boolean);
  const testText=normalize(report.clientTestFindings);
  for(const n of names){if(n.length>2&&!testText.includes(n.slice(0,Math.min(n.length,6))))issues.push(`검사별 결과 누락 가능: ${n}`)}
  const clientFields=['clientCoreMind','clientMindProfile','clientEmotionState','clientThinkingRelationship','clientStressDaily','clientExpertRecovery'];
  const normalized={};
  for(const key of clientFields){
    normalized[key]=clean(report[key],5000).replace(/\s+/g,' ').replace(/[.,!?·:;()\[\]{}"']/g,'').trim();
  }
  for(let i=0;i<clientFields.length;i++){
    for(let j=i+1;j<clientFields.length;j++){
      const a=normalized[clientFields[i]],b=normalized[clientFields[j]];
      if(a.length<80||b.length<80)continue;
      const shorter=a.length<=b.length?a:b;
      const longer=a.length>b.length?a:b;
      if(shorter.length>=120&&longer.includes(shorter.slice(0,120)))issues.push(`영역 간 문장 중복 가능: ${clientFields[i]} / ${clientFields[j]}`);
    }
  }
  const generic=(clean(report.clientExpertRecovery,5000).match(/휴식|스트레스 관리|긍정적|규칙적인 생활/g)||[]).length;
  if(generic>=4)issues.push('전문가 제언이 일반적 표현에 치우칠 가능성');
  return [...new Set(issues)];
}

export const handler=async(event)=>{if(event.httpMethod==='OPTIONS')return jsonResponse({},200);if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);try{const body=JSON.parse(event.body||'{}');if(!clean(body.clientName))return jsonResponse({error:'회원 정보가 없습니다.'},400);if(body.mode==='rewrite-client-from-integrated'){const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY||'';if(!apiKey)return jsonResponse({error:'AI 보고서 생성 환경변수가 설정되지 않았습니다.'},500);if(!body.integratedReport||!clean(body.integratedReport,30000))return jsonResponse({error:'재작성할 통합보고서 내용이 없습니다.'},400);const tciOnly=isTciOnlyRequest(body);const r=await callFast(apiKey,integratedRewritePrompt(body),tciOnly?TCI_CLIENT_REWRITE_SCHEMA:CLIENT_REWRITE_SCHEMA);let sanitized=sanitizeClientRewrite(r.data||{});if(tciOnly){sanitized=enforceTciScaleLevels(sanitized,body.integratedReport||{});const recs=Array.isArray(r.data?.tciRecommendations)?r.data.tciRecommendations:[];sanitized.tciRecommendations=recs.map(x=>({title:clean(x?.title,120),basis:clean(x?.basis,900),action:clean(x?.action,900)})).filter(x=>x.title&&x.basis&&x.action).slice(0,3);const requiredTci=['tciTemperamentSummary','tciNS','tciHA','tciRD','tciPS','tciCharacterSummary','tciSD','tciCO','tciST','tciIntegrated','tciStrengths','tciCautions'];const missing=requiredTci.filter(k=>!clean(sanitized[k]||'',12000));if(sanitized.tciRecommendations.length!==3)missing.push('tciRecommendations');if(missing.length)return jsonResponse({error:'TCI 전용 보고서 생성 결과가 불완전합니다.',missingFields:[...new Set(missing)]},502);}return jsonResponse({report:sanitized,model:r.model,promptVersion:tciOnly?'mml-client-tci-v3.0-structured-recommendations':'mml-client-composer-v7.0-topic-rewrite-whole-report',rewritten:true,needsReview:true});}if(!Array.isArray(body.tests)||!body.tests.length)return jsonResponse({error:'검사별 분석 자료가 없습니다.'},400);if(body.tests.some(t=>!t.reviewed))return jsonResponse({error:'모든 검사별 분석을 상담자가 검토 완료한 뒤 생성해 주세요.'},400);const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY||'';
  const profile=localClinicalProfile(body);
  let generated=null;let model='local-fallback';
  if(apiKey){try{const r=await callFast(apiKey,reportPrompt(body,profile),REPORT_SCHEMA);generated=r.data;model=r.model;}catch(aiError){console.warn('[MML fast fallback]',aiError?.message||aiError);}}
  const report=ensureCompleteReport(fill(generated||{},body),body,profile);
  // MOD-20260720-INTEGRATED-SCORE-INTERPRETATION-RESTORE: 빈 검사명 목록 대신 실제 점수·결과해석을 항상 표시합니다.
  report.testGuide=buildScoreInterpretationGuide(body.tests||[]);
  const issues=quality(report,body);
  // 내용이 부족하더라도 생성 자체를 중단하지 않고 상담자 검토 대상으로 저장합니다.
  const cfg=programConfig(body.program);
  const masterReport={
    schemaVersion:'MML-MASTER-REPORT-1.1',
    purpose:'심리평가센터에서 모든 심리검사 결과와 상담자 검토 내용을 취합하여 전자차트의 상담자용·내담자용 개별보고서 및 종합보고서를 생성하기 위한 단일 근거 데이터',
    subject:{clientName:clean(body.clientName,120),program:clean(body.program,180),programType:cfg.type,evaluationPurpose:cfg.purpose},
    sourceInventory:(body.tests||[]).map(t=>({testType:clean(t.testType,120),subjectRole:clean(t.subjectRole,80),role:roleOf(t.testType),reviewed:Boolean(t.reviewed),confidenceScore:clean(t.confidenceScore,20),sourceSummary:clean(t.sourceSummary,1800),validity:clean(t.validity,1200),coreFindings:clean(t.coreFindings,3600),strengths:clean(t.strengths,1800),vulnerabilities:clean(t.vulnerabilities,1800),crossChecks:clean(t.crossChecks,1200),cautions:clean(t.cautions,1200),rawFacts:t.rawFacts||null})),
    crossAnalysis:body.crossAnalysis||null,
    clinicalProfile:profile,
    reportGenerationData:{
      counselor:{coreUnderstanding:report.counselorCoreUnderstanding,evidenceSummary:report.evidenceSummary,caseFormulation5P:report.counselorCaseFormulation5P,riskProtection:report.counselorRiskProtection,counselingFocus:report.counselorCounselingFocus,initialQuestions:report.counselorInitialQuestions,interventionGuide:report.counselorInterventionGuide,monitoringPoints:report.counselorMonitoringPoints,professionalSummary:report.professionalSummary,supervisorNote:report.supervisorNote},
      client:{coreMind:report.clientCoreMind,mindProfile:report.clientMindProfile,individualTests:report.clientIndividualTests,emotionState:report.clientEmotionState,thinkingRelationship:report.clientThinkingRelationship,stressDaily:report.clientStressDaily,expertRecovery:report.clientExpertRecovery,selfUnderstanding:report.clientSelfUnderstanding,temperamentCharacter:report.clientTemperamentCharacter,currentMind:report.clientCurrentMind,testFindings:report.clientTestFindings,commonPatterns:report.clientCommonPatterns,differences:report.clientDifferences,functionalFormulation:report.clientFunctionalFormulation,strengthGuide:report.clientStrengthGuide,recoveryGuide:report.clientRecoveryGuide,supportGuide:report.clientSupportGuide,professionalSummary:report.clientProfessionalSummary,disclaimer:report.clientDisclaimer},
      shared:{title:report.title,subtitle:report.subtitle,evaluationOverview:report.evaluationOverview,testGuide:report.testGuide,clinicalValidity:report.clinicalValidity,clinicalCurrentState:report.clinicalCurrentState,clinicalTrait:report.clinicalTrait,clinicalConvergence:report.clinicalConvergence,clinicalDivergence:report.clinicalDivergence,clinicalFormulation:report.clinicalFormulation,clinicalProtectiveFactors:report.clinicalProtectiveFactors}
    },
    generationRules:{singleSourceOfTruth:true,diagnosisRequiresClinicalJudgment:true,projectiveTestsAreHypotheses:true,clientReportUsesPlainLanguage:true,counselorReportPreservesEvidence:true},
    quality:{qualityChecked:issues.length===0,qualityIssues:issues,needsCounselorReview:true}
  };
  return jsonResponse({report,masterReport,clinicalProfile:profile,model, promptVersion:'mml-master-report-v2.0-clinical-synthesis',qualityChecked:issues.length===0,needsReview:true,qualityIssues:issues});
}catch(e){
  console.error('[MML v5]',e);
  const temporary=Boolean(e?.retryable)||[429,500,502,503,504].includes(Number(e?.status||0));
  const status=temporary?503:500;
  const message=temporary
    ?'AI 서버가 일시적으로 혼잡합니다. 기존 보고서는 그대로 유지됩니다. 잠시 후 다시 생성해 주세요.'
    :`심리보고서 생성 중 오류가 발생했습니다. ${clean(e?.message,500)}`;
  return jsonResponse({error:message,temporary,code:e?.code||'REPORT_GENERATION_ERROR'},status)
}};

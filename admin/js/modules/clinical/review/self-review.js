(function(global){
'use strict';

const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};

const INTERNAL_KEY_PATTERN=/(^internal$|caseConceptualization|decisionTrace|normalizedEvidence|clinicalReasoning|reasoningEngine|evidenceIndex|confidenceScore|rawData|sourceTrace)/i;
const INTERNAL_TEXT_PATTERN=/(caseConceptualization|decisionTrace|normalizedEvidence|clinicalReasoning|confidenceScore|sourceTrace)/i;
const SCORE_PATTERN=/(?:T\s*점수|백분위|percentile|raw\s*score|원점수|척도\s*점수)\s*[:：]?\s*[-+]?\d+(?:\.\d+)?/i;
const DIAGNOSIS_CERTAINTY_PATTERN=/(?:확실히|명백히|틀림없이|반드시)\s*(?:[가-힣A-Za-z0-9-]+\s*)?(?:장애|질환|진단|병리)/i;
const CAUTIOUS_TERMS=/(가능성|경향|시사|추정|살펴볼|해석될 수|보일 수|나타날 수)/i;

function cleanText(value){
  return String(value??'')
    .replace(/\r\n/g,'\n')
    .replace(/[\t\u00a0]+/g,' ')
    .replace(/[ ]{2,}/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function normalizeText(value){
  return cleanText(value)
    .toLowerCase()
    .replace(/[“”‘’"'`]/g,'')
    .replace(/[\s\-–—_,.?!:;·•■◆▶▷()\[\]{}]/g,'');
}

function walk(value,path='$',result={texts:[],keys:[],empty:[]},seen=new WeakSet()){
  if(value===null||value===undefined) return result;
  if(typeof value==='string'){
    const text=cleanText(value);
    if(text) result.texts.push({path,text});
    else result.empty.push(path);
    return result;
  }
  if(typeof value!=='object') return result;
  if(seen.has(value)) return result;
  seen.add(value);
  if(Array.isArray(value)){
    value.forEach((item,index)=>walk(item,`${path}[${index}]`,result,seen));
    return result;
  }
  Object.entries(value).forEach(([key,item])=>{
    const next=`${path}.${key}`;
    result.keys.push({path:next,key});
    walk(item,next,result,seen);
  });
  return result;
}

function splitSentences(text){
  return cleanText(text)
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map(cleanText)
    .filter(sentence=>sentence.length>=12);
}

function similarity(a,b){
  const x=normalizeText(a);
  const y=normalizeText(b);
  if(!x||!y) return 0;
  if(x===y) return 1;
  if(x.length<18||y.length<18) return 0;
  const grams=(value)=>{
    const set=new Set();
    for(let index=0;index<value.length-2;index+=1) set.add(value.slice(index,index+3));
    return set;
  };
  const ax=grams(x); const by=grams(y);
  let intersection=0;
  ax.forEach(token=>{if(by.has(token)) intersection+=1;});
  const union=ax.size+by.size-intersection;
  return union?intersection/union:0;
}

function detectDuplicates(textEntries){
  const exact=[];
  const near=[];
  const sentenceEntries=[];
  textEntries.forEach(entry=>{
    splitSentences(entry.text).forEach((sentence,index)=>sentenceEntries.push({path:`${entry.path}#${index+1}`,sentence}));
  });
  const firstByNormalized=new Map();
  sentenceEntries.forEach(entry=>{
    const normalized=normalizeText(entry.sentence);
    if(normalized.length<12) return;
    if(firstByNormalized.has(normalized)) exact.push({first:firstByNormalized.get(normalized),duplicate:entry});
    else firstByNormalized.set(normalized,entry);
  });
  for(let i=0;i<sentenceEntries.length;i+=1){
    for(let j=i+1;j<sentenceEntries.length;j+=1){
      const a=sentenceEntries[i]; const b=sentenceEntries[j];
      if(normalizeText(a.sentence)===normalizeText(b.sentence)) continue;
      const score=similarity(a.sentence,b.sentence);
      if(score>=0.82) near.push({first:a,duplicate:b,similarity:Number(score.toFixed(3))});
      if(near.length>=30) break;
    }
    if(near.length>=30) break;
  }
  return {exact,near,sentenceCount:sentenceEntries.length};
}

function detectNumbering(textEntries){
  const issues=[];
  textEntries.forEach(entry=>{
    const numbers=entry.text.split('\n').map(line=>line.match(/^\s*(\d+)[.)]\s+/)).filter(Boolean).map(match=>Number(match[1]));
    if(numbers.length<2) return;
    for(let index=1;index<numbers.length;index+=1){
      if(numbers[index]!==numbers[index-1]+1){
        issues.push({path:entry.path,previous:numbers[index-1],current:numbers[index]});
        break;
      }
    }
  });
  return issues;
}

function detectLongParagraphs(textEntries,maxLength=520){
  const issues=[];
  textEntries.forEach(entry=>{
    entry.text.split(/\n\s*\n/).map(cleanText).filter(Boolean).forEach((paragraph,index)=>{
      if(paragraph.length>maxLength) issues.push({path:`${entry.path}#p${index+1}`,length:paragraph.length,preview:paragraph.slice(0,90)});
    });
  });
  return issues;
}

function reviewClinicalOutput(report,options={}){
  const mode=options.mode||report?.audience||report?.type||'client';
  const walked=walk(report);
  const duplicates=detectDuplicates(walked.texts);
  const internalKeyLeaks=walked.keys.filter(item=>INTERNAL_KEY_PATTERN.test(item.key));
  const internalTextLeaks=walked.texts.filter(item=>INTERNAL_TEXT_PATTERN.test(item.text));
  const rawScoreLeaks=mode==='clinician'?[]:walked.texts.filter(item=>SCORE_PATTERN.test(item.text));
  const certaintyIssues=walked.texts.filter(item=>DIAGNOSIS_CERTAINTY_PATTERN.test(item.text)&&!CAUTIOUS_TERMS.test(item.text));
  const numberingIssues=detectNumbering(walked.texts);
  const longParagraphs=detectLongParagraphs(walked.texts,Number(options.maxParagraphLength)||520);
  const emptyRequired=[];
  (options.requiredPaths||[]).forEach(path=>{
    const target=path.split('.').reduce((acc,key)=>acc&&acc[key],report);
    if(!cleanText(target?.content??target)) emptyRequired.push(path);
  });

  const criticalCount=internalKeyLeaks.length+internalTextLeaks.length+rawScoreLeaks.length+certaintyIssues.length+emptyRequired.length;
  const warningCount=duplicates.exact.length+duplicates.near.length+numberingIssues.length+longParagraphs.length;
  const passed=criticalCount===0 && (options.strict!==true || warningCount===0);

  return {
    schemaVersion:'mml-clinical-self-review-v2',
    generatedAt:new Date().toISOString(),
    passed,
    score:Math.max(0,100-criticalCount*15-warningCount*3),
    severity:criticalCount>0?'error':warningCount>0?'warning':'ok',
    summary:{criticalCount,warningCount,textCount:walked.texts.length,sentenceCount:duplicates.sentenceCount},
    counts:{
      exactDuplicate:duplicates.exact.length,
      nearDuplicate:duplicates.near.length,
      internalFieldLeak:internalKeyLeaks.length+internalTextLeaks.length,
      rawScoreLeak:rawScoreLeaks.length,
      unsupportedCertainty:certaintyIssues.length,
      numberingIssue:numberingIssues.length,
      longParagraph:longParagraphs.length,
      emptyRequired:emptyRequired.length
    },
    checks:{
      noExactDuplicate:duplicates.exact.length===0,
      noNearDuplicate:duplicates.near.length===0,
      noInternalFieldLeak:internalKeyLeaks.length===0&&internalTextLeaks.length===0,
      noRawScoreLeak:rawScoreLeaks.length===0,
      cautiousClinicalLanguage:certaintyIssues.length===0,
      sequentialNumbering:numberingIssues.length===0,
      readableParagraphLength:longParagraphs.length===0,
      requiredSectionsFilled:emptyRequired.length===0
    },
    issues:{
      exactDuplicates:duplicates.exact,
      nearDuplicates:duplicates.near,
      internalKeyLeaks,
      internalTextLeaks,
      rawScoreLeaks,
      certaintyIssues,
      numberingIssues,
      longParagraphs,
      emptyRequired
    }
  };
}

function sanitizeClinicalOutput(report){
  const clone=JSON.parse(JSON.stringify(report||{}));
  function sanitize(value){
    if(Array.isArray(value)) return value.map(sanitize);
    if(!value||typeof value!=='object') return typeof value==='string'?cleanText(value):value;
    Object.keys(value).forEach(key=>{
      if(INTERNAL_KEY_PATTERN.test(key)) delete value[key];
      else value[key]=sanitize(value[key]);
    });
    return value;
  }
  return sanitize(clone);
}

function reviewAndSanitizeClinicalOutput(report,options={}){
  const sanitized=sanitizeClinicalOutput(report);
  return {report:sanitized,review:reviewClinicalOutput(sanitized,options)};
}

modules.selfReview=Object.freeze({
  reviewClinicalOutput,
  sanitizeClinicalOutput,
  reviewAndSanitizeClinicalOutput
});
})(window);

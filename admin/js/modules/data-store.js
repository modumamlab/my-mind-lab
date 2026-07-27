console.info('[MML] DATA-STORE-MODULE-V37.3-NO-QUEUE loaded');

(function(global){
  'use strict';

  const CACHE = new Map();
  const BACKUP_PREFIX = 'modumam_backup__';
  const AUDIT_KEY = 'modumam_admin_audit_log';
  const MAX_AUDIT = 0;
  const MAX_BACKUPS_PER_KEY = 0;

  const CORE_KEYS = {
    reservations: 'modumam_reservations',
    intakes: 'modumam_intake_summaries',
    reports: 'modumam_reports',
    uploads: 'modumam_test_result_uploads',
    interpretations: 'modumam_test_interpretations',
    analyses: 'modumam_assessment_analyses',
    reportDrafts: 'modumam_assessment_report_drafts',
    crossAnalyses: 'modumam_assessment_cross_analyses',
    aiCounseling: 'modumam_ai_result_counseling_records',
    operatingSettings: 'modumam_operating_settings'
  };

  function clone(value){
    if(value === undefined) return undefined;
    try{return structuredClone(value)}catch(e){}
    try{return JSON.parse(JSON.stringify(value))}catch(e){return value}
  }

  function safeParse(text, fallback){
    if(text === null || text === undefined || text === '') return clone(fallback);
    try{return JSON.parse(text)}catch(error){
      console.warn('[MML DataStore] JSON 읽기 실패', error);
      return clone(fallback);
    }
  }

  function nowIso(){ return new Date().toISOString(); }

  function audit(){
    return false;
  }

  function backupIndexKey(key){ return `${BACKUP_PREFIX}${key}__index`; }
  function backupDataKey(key, id){ return `${BACKUP_PREFIX}${key}__${id}`; }

  function createBackup(){
    return null;
  }

  function listBackups(key){
    const index = safeParse(localStorage.getItem(backupIndexKey(key)), []);
    return index.map(item=>{
      const record = safeParse(localStorage.getItem(backupDataKey(key, item.id)), null);
      return record ? {id:record.id, key:record.key, createdAt:record.createdAt} : null;
    }).filter(Boolean);
  }

  function restoreBackup(key, backupId){
    const record = safeParse(localStorage.getItem(backupDataKey(key, backupId)), null);
    if(!record || record.key !== key) throw new Error('복원할 백업을 찾을 수 없습니다.');
    const currentRaw = localStorage.getItem(key);
    createBackup(key, currentRaw);
    localStorage.setItem(key, record.raw);
    CACHE.delete(key);
    audit('백업 복원', key, backupId);
    return safeParse(record.raw, null);
  }

  function normalizeId(value){ return String(value ?? '').trim(); }

  function duplicateValues(rows, getter){
    const seen = new Set();
    const duplicates = new Set();
    rows.forEach(row=>{
      const value = normalizeId(getter(row));
      if(!value) return;
      if(seen.has(value)) duplicates.add(value);
      seen.add(value);
    });
    return [...duplicates];
  }

  function validate(key, value){
    const errors = [];
    const warnings = [];

    if(key === CORE_KEYS.reservations){
      if(!Array.isArray(value)) errors.push('예약 데이터는 배열이어야 합니다.');
      else{
        const duplicateIds = duplicateValues(value, row=>row && row.id);
        const duplicateNumbers = duplicateValues(value, row=>row && (row.reservationNumber || row.reservationNo));
        if(duplicateIds.length) errors.push(`예약 ID 중복: ${duplicateIds.slice(0,5).join(', ')}`);
        if(duplicateNumbers.length) warnings.push(`예약번호 중복: ${duplicateNumbers.slice(0,5).join(', ')}`);
        value.forEach((row, index)=>{
          if(!row || typeof row !== 'object') errors.push(`${index+1}번째 예약 형식 오류`);
          else{
            if(!normalizeId(row.id)) warnings.push(`${index+1}번째 예약 ID 누락`);
            const date = row.date || row.counselingDate || row.reservationDate;
            if(date && Number.isNaN(Date.parse(String(date)))) warnings.push(`${index+1}번째 예약 날짜 확인 필요`);
          }
        });
      }
    }

    if(key === CORE_KEYS.reports){
      if(!Array.isArray(value)) errors.push('보고서 데이터는 배열이어야 합니다.');
      else{
        const duplicateIds = duplicateValues(value, row=>row && row.id);
        if(duplicateIds.length) errors.push(`보고서 ID 중복: ${duplicateIds.slice(0,5).join(', ')}`);
        value.forEach((row, index)=>{
          if(!row || typeof row !== 'object') errors.push(`${index+1}번째 보고서 형식 오류`);
          else if(row.approvedForClient === true && !normalizeId(row.id)){
            errors.push(`${index+1}번째 승인 보고서 ID 누락`);
          }
        });
      }
    }

    if([
      CORE_KEYS.intakes, CORE_KEYS.uploads, CORE_KEYS.interpretations,
      CORE_KEYS.analyses, CORE_KEYS.reportDrafts, CORE_KEYS.crossAnalyses,
      CORE_KEYS.aiCounseling
    ].includes(key) && !Array.isArray(value)){
      errors.push(`${key} 데이터는 배열이어야 합니다.`);
    }

    return {ok: errors.length === 0, errors, warnings};
  }

  function read(key, fallback=null, options={}){
    if(!options.fresh && CACHE.has(key)) return clone(CACHE.get(key));
    const value = safeParse(localStorage.getItem(key), fallback);
    CACHE.set(key, clone(value));
    return clone(value);
  }

  function write(key, value, options={}){
    const validation = validate(key, value);
    if(!validation.ok && options.allowInvalid !== true){
      const error = new Error(validation.errors.join('\n'));
      error.validation = validation;
      throw error;
    }

    const previousRaw = localStorage.getItem(key);
    const nextRaw = JSON.stringify(value);
    if(previousRaw === nextRaw){
      CACHE.set(key, clone(value));
      return clone(value);
    }

    const backupId = options.backup === false ? null : createBackup(key, previousRaw);
    localStorage.setItem(key, nextRaw);
    CACHE.set(key, clone(value));

    if(options.audit !== false){
      const detail = [
        options.detail || '',
        backupId ? `백업 ${backupId}` : '',
        validation.warnings.length ? `경고: ${validation.warnings.join(' / ')}` : ''
      ].filter(Boolean).join(' | ');
      audit(options.action || '저장', key, detail, options.meta || {});
    }
    if(global.MMLServerStore && options.server !== false){
      global.MMLServerStore.mirrorWrite(key,value,{
        action:options.action || '저장',
        actor:options.meta?.actor || '관리자',
        source:options.source || 'admin'
      });
    }
    if(global.MMLSync && options.sync !== false){
      global.MMLSync.publish('data:changed',{
        count:Array.isArray(value)?value.length:undefined,
        action:options.action || '저장'
      },{
        source:options.source || 'admin',
        scope:options.scope || 'shared',
        key,
        entityId:options.entityId || ''
      });
    }
    return clone(value);
  }

  function remove(key, options={}){
    const previousRaw = localStorage.getItem(key);
    if(previousRaw === null) return false;
    const backupId = options.backup === false ? null : createBackup(key, previousRaw);
    localStorage.removeItem(key);
    CACHE.delete(key);
    if(options.audit !== false) audit(options.action || '삭제', key, backupId ? `백업 ${backupId}` : '');
    if(global.MMLServerStore && options.server !== false){
      global.MMLServerStore.mirrorRemove(key,{
        action:options.action || '삭제',
        actor:options.meta?.actor || '관리자',
        source:options.source || 'admin'
      });
    }
    if(global.MMLSync && options.sync !== false){
      global.MMLSync.publish('data:removed',{},{
        source:options.source || 'admin',
        scope:options.scope || 'shared',
        key,
        entityId:options.entityId || ''
      });
    }
    return true;
  }

  function cleanupLegacyStorage(){
    try{
      localStorage.removeItem(AUDIT_KEY);
      localStorage.removeItem('modumam_reports_backup');
      localStorage.removeItem('modumam_server_sync_queue');
      localStorage.removeItem('modumam_server_sync_queue_v36');
      localStorage.removeItem('modumam_server_sync_queue_v37');
      const keys=[];
      for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
      keys.filter(key=>String(key||'').startsWith(BACKUP_PREFIX)).forEach(key=>localStorage.removeItem(key));
    }catch(error){console.warn('[MML DataStore] 구형 저장 데이터 정리 실패',error);}
  }

  function invalidate(key){
    if(key) CACHE.delete(key);
    else CACHE.clear();
  }

  function findById(key, id){
    const rows = read(key, []);
    return Array.isArray(rows) ? clone(rows.find(row=>normalizeId(row && row.id)===normalizeId(id)) || null) : null;
  }

  function upsertById(key, item, options={}){
    if(!item || !normalizeId(item.id)) throw new Error('저장할 항목의 ID가 필요합니다.');
    const rows = read(key, []);
    if(!Array.isArray(rows)) throw new Error(`${key} 저장소 형식이 배열이 아닙니다.`);
    const idx = rows.findIndex(row=>normalizeId(row && row.id)===normalizeId(item.id));
    const next = [...rows];
    if(idx >= 0) next[idx] = {...next[idx], ...clone(item)};
    else next.unshift(clone(item));
    write(key, next, {...options, action:options.action || (idx>=0?'항목 수정':'항목 추가')});
    return clone(item);
  }

  function removeById(key, id, options={}){
    const rows = read(key, []);
    if(!Array.isArray(rows)) return false;
    const next = rows.filter(row=>normalizeId(row && row.id)!==normalizeId(id));
    if(next.length === rows.length) return false;
    write(key, next, {...options, action:options.action || '항목 삭제'});
    return true;
  }

  function snapshot(keys=Object.values(CORE_KEYS)){
    const data = {};
    keys.forEach(key=>{ data[key] = read(key, null, {fresh:true}); });
    return {
      version:'v37',
      createdAt:nowIso(),
      data
    };
  }

  function validateAll(){
    const result = {};
    Object.values(CORE_KEYS).forEach(key=>{
      const fallback = key === CORE_KEYS.operatingSettings ? {} : [];
      result[key] = validate(key, read(key, fallback, {fresh:true}));
    });
    return result;
  }

  global.MMLDataStore = Object.freeze({
    version:'v30',
    keys:Object.freeze({...CORE_KEYS}),
    read,
    write,
    remove,
    invalidate,
    validate,
    validateAll,
    audit,
    listBackups,
    restoreBackup,
    findById,
    upsertById,
    removeById,
    snapshot,
    getReservation(id){return findById(CORE_KEYS.reservations,id)},
    saveReservation(item, options){return upsertById(CORE_KEYS.reservations,item,options)},
    getReport(id){return findById(CORE_KEYS.reports,id)},
    saveReport(item, options){return upsertById(CORE_KEYS.reports,item,options)}
  });
})(window);

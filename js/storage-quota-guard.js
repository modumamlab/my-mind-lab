console.info('[MML] STORAGE-QUOTA-GUARD-V2 loaded');
(function(global){
  'use strict';
  const PRESERVE=new Set([
    'modumam_reservations','modumam_intake_summaries','modumam_assessment_report_requests_v1',
    'modumam_assessment_report_requests_v1_ready','modumam_reports'
  ]);
  const DISPOSABLE=[
    'modumam_client_report_publications','modumam_server_sync_queue','modumam_server_sync_queue_v36','modumam_server_sync_queue_v37',
    'modumam_reports_backup','modumam_admin_audit_log','modumam_health_errors','modumam_health_metrics'
  ];
  const isQuota=e=>e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014);
  const bytes=v=>{try{return new Blob([String(v||'')]).size}catch(_){return String(v||'').length*2}};
  function removeBackups(){
    const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
    keys.filter(k=>String(k||'').startsWith('modumam_backup__')).forEach(k=>{try{localStorage.removeItem(k)}catch(_){}});
  }
  function compactPublications(){
    const key='modumam_client_report_publications';
    try{
      const rows=JSON.parse(localStorage.getItem(key)||'[]');
      const compact=(Array.isArray(rows)?rows:[]).slice(-200).map(r=>({
        id:r.id,reportId:r.reportId,reservationId:r.reservationId,clientId:r.clientId,
        clientName:r.clientName,clientPhone:r.clientPhone,reportType:r.reportType,testType:r.testType,
        title:r.title,status:r.status,visible:r.visible===true,approvedForClient:r.approvedForClient===true,
        approvedAt:r.approvedAt,updatedAt:r.updatedAt,version:r.version
      }));
      localStorage.removeItem(key);
      localStorage.setItem(key,JSON.stringify(compact));
    }catch(_){try{localStorage.removeItem(key)}catch(__){}}
  }
  function trimOversizedCaches(){
    const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
    keys.forEach(k=>{
      if(!k||PRESERVE.has(k))return;
      let value='';try{value=localStorage.getItem(k)||''}catch(_){return}
      if(bytes(value)<350000)return;
      if(/cache|queue|backup|audit|metric|error|publication|draft|preview|html/i.test(k)){
        try{localStorage.removeItem(k)}catch(_){}
      }
    });
  }
  function cleanup(){
    compactPublications();
    DISPOSABLE.slice(1).forEach(k=>{try{localStorage.removeItem(k)}catch(_){}});
    removeBackups();
    trimOversizedCaches();
  }
  const nativeSetItem=Storage.prototype.setItem;
  if(!Storage.prototype.__mmlQuotaGuardV2){
    Object.defineProperty(Storage.prototype,'__mmlQuotaGuardV2',{value:true});
    Storage.prototype.setItem=function(key,value){
      try{return nativeSetItem.call(this,key,value)}catch(error){
        if(!isQuota(error))throw error;
        cleanup();
        try{
          if(String(key)==='modumam_client_report_publications')this.removeItem(key);
          return nativeSetItem.call(this,key,value);
        }catch(second){
          console.error('[MML] 저장공간 부족으로 저장 실패',key,second);
          throw second;
        }
      }
    };
  }
  global.MMLStorageQuotaGuard={cleanup,isQuota,compactPublications};
  try{cleanup()}catch(_){}
})(window);

console.info('[MML] STORAGE-QUOTA-GUARD-V1 loaded');
(function(global){
  'use strict';
  const DISPOSABLE=[
    'modumam_client_report_publications',
    'modumam_server_sync_queue','modumam_server_sync_queue_v36','modumam_server_sync_queue_v37',
    'modumam_reports_backup','modumam_admin_audit_log','modumam_health_errors','modumam_health_metrics'
  ];
  const isQuota=e=>e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014);
  function removeBackups(){
    const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
    keys.filter(k=>String(k||'').startsWith('modumam_backup__')).forEach(k=>{try{localStorage.removeItem(k)}catch(_){}});
  }
  function compactPublications(){
    try{
      const rows=JSON.parse(localStorage.getItem('modumam_client_report_publications')||'[]');
      if(!Array.isArray(rows))return;
      const compact=rows.slice(-200).map(r=>({
        id:r.id,reportId:r.reportId,reservationId:r.reservationId,clientId:r.clientId,
        clientName:r.clientName,clientPhone:r.clientPhone,reportType:r.reportType,testType:r.testType,
        title:r.title,status:r.status,visible:r.visible===true,approvedForClient:r.approvedForClient===true,
        approvedAt:r.approvedAt,updatedAt:r.updatedAt,version:r.version
      }));
      localStorage.setItem('modumam_client_report_publications',JSON.stringify(compact));
    }catch(_){try{localStorage.removeItem('modumam_client_report_publications')}catch(__){}}
  }
  function cleanup(){
    compactPublications();
    DISPOSABLE.slice(1).forEach(k=>{try{localStorage.removeItem(k)}catch(_){}});
    removeBackups();
  }
  const nativeSetItem=Storage.prototype.setItem;
  if(!Storage.prototype.__mmlQuotaGuard){
    Object.defineProperty(Storage.prototype,'__mmlQuotaGuard',{value:true});
    Storage.prototype.setItem=function(key,value){
      try{return nativeSetItem.call(this,key,value)}catch(error){
        if(!isQuota(error))throw error;
        cleanup();
        try{return nativeSetItem.call(this,key,value)}catch(second){
          console.error('[MML] 저장공간 부족으로 저장 실패',key,second);
          throw second;
        }
      }
    };
  }
  global.MMLStorageQuotaGuard={cleanup,isQuota};
  setTimeout(cleanup,0);
})(window);

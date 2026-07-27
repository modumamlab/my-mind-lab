
let blobsModule=null;

function loadBlobs(){
  if(blobsModule) return blobsModule;
  try{
    blobsModule=require('@netlify/blobs');
    return blobsModule;
  }catch(error){
    const wrapped=new Error('SERVER_STORAGE_NOT_INSTALLED');
    wrapped.cause=error;
    throw wrapped;
  }
}

const STORE_NAME='modumam-admin-data-v37';
const ALLOWED_KEYS=new Set([
  'modumam_reservations',
  'modumam_intake_summaries',
  'modumam_reports',
  'modumam_test_result_uploads',
  'modumam_test_interpretations',
  'modumam_assessment_analyses',
  'modumam_assessment_report_drafts',
  'modumam_assessment_cross_analyses',
  'modumam_ai_result_counseling_records',
  'modumam_operating_settings'
]);

const response=(statusCode,body)=>({
  statusCode,
  headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, X-MML-API-Key',
    'Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS'
  },
  body:JSON.stringify(body)
});

function authorized(event){
  const required=process.env.MML_DATA_API_KEY;
  const context=String(process.env.CONTEXT||process.env.NETLIFY_DEV||'');
  if(!required && (context==='dev'||context==='true')) return true;
  if(!required) return false;
  const supplied=event.headers?.['x-mml-api-key']||event.headers?.['X-MML-API-Key']||'';
  return supplied===required;
}

function cleanMeta(meta){
  if(!meta||typeof meta!=='object') return {};
  return {
    action:String(meta.action||'').slice(0,100),
    actor:String(meta.actor||'admin').slice(0,100),
    source:String(meta.source||'admin').slice(0,100),
    at:new Date().toISOString()
  };
}

exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS') return response(204,{});

  if(event.httpMethod==='GET' && event.queryStringParameters?.action==='ping'){
    try{
      loadBlobs();
      return response(200,{
        ok:true,
        service:'modumam-data-api',
        version:'v37.2-safe-errors',
        storage:'available',
        authenticated:authorized(event)
      });
    }catch(error){
      return response(200,{
        ok:true,
        service:'modumam-data-api',
        version:'v37.2-safe-errors',
        storage:'disabled',
        reason:'@netlify/blobs is not installed',
        authenticated:false
      });
    }
  }

  let blobs;
  try{
    blobs=loadBlobs();
  }catch(error){
    return response(503,{
      ok:false,
      code:'SERVER_STORAGE_NOT_INSTALLED',
      error:'서버 저장 기능이 설치되어 있지 않습니다. 기존 로컬 저장 기능은 계속 사용할 수 있습니다.'
    });
  }

  if(!authorized(event)){
    return response(401,{
      ok:false,
      code:'UNAUTHORIZED',
      error:'서버 데이터 API 인증이 필요합니다.'
    });
  }

  try{blobs.connectLambda?.(event)}catch(error){}

  let store;
  try{
    store=blobs.getStore({name:STORE_NAME,consistency:'strong'});
  }catch(error){
    return response(503,{
      ok:false,
      code:'SERVER_STORAGE_UNAVAILABLE',
      error:'서버 저장소를 열지 못했습니다. 브라우저 로컬 저장은 계속 사용할 수 있습니다.',
      detail:String(error?.message||error)
    });
  }
  const method=event.httpMethod;

  if(method==='GET'){
    const key=String(event.queryStringParameters?.key||'');
    if(!ALLOWED_KEYS.has(key)){
      return response(400,{ok:false,code:'INVALID_KEY',error:'허용되지 않은 데이터 키입니다.'});
    }
    try{
      const record=await store.get(key,{type:'json'});
      if(record===null) return response(200,{ok:true,found:false,key});
      return response(200,{
        ok:true,
        found:true,
        key,
        value:record.value,
        meta:record.meta||{}
      });
    }catch(error){
      return response(503,{
        ok:false,
        code:'SERVER_READ_FAILED',
        error:'서버 데이터를 읽지 못했습니다.',
        detail:String(error?.message||error)
      });
    }
  }

  let body={};
  try{
    body=JSON.parse(event.body||'{}');
  }catch(error){
    return response(400,{ok:false,code:'INVALID_JSON',error:'요청 형식이 올바르지 않습니다.'});
  }

  const key=String(body.key||'');
  if(!ALLOWED_KEYS.has(key)){
    return response(400,{ok:false,code:'INVALID_KEY',error:'허용되지 않은 데이터 키입니다.'});
  }

  if(method==='PUT'){
    const record={
      version:'v37.2-safe-errors',
      value:body.value,
      meta:cleanMeta(body.meta),
      updatedAt:new Date().toISOString()
    };
    try{
      await store.setJSON(key,record);
      return response(200,{ok:true,key,updatedAt:record.updatedAt});
    }catch(error){
      return response(503,{
        ok:false,
        code:'SERVER_WRITE_FAILED',
        error:'서버 저장에 실패했습니다. 브라우저 로컬 저장은 유지됩니다.',
        detail:String(error?.message||error)
      });
    }
  }

  if(method==='DELETE'){
    try{
      await store.delete(key);
      return response(200,{ok:true,key,deleted:true});
    }catch(error){
      return response(503,{
        ok:false,
        code:'SERVER_DELETE_FAILED',
        error:'서버 삭제에 실패했습니다. 브라우저 로컬 상태는 유지됩니다.',
        detail:String(error?.message||error)
      });
    }
  }

  return response(405,{
    ok:false,
    code:'METHOD_NOT_ALLOWED',
    error:'지원하지 않는 요청입니다.'
  });
};

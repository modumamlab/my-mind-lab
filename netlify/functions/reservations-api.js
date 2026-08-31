const { getStore, connectLambda } = require('@netlify/blobs');
const STORE_NAME='modumam-reservations-v1';
const KEY='reservations-v2';
const response=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-MML-Admin-Password','Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS'},body:JSON.stringify(body)});
function adminAuthorized(event){const expected=String(process.env.MML_RESERVATION_ADMIN_PASSWORD||'modumam2026');const supplied=String(event.headers?.['x-mml-admin-password']||event.headers?.['X-MML-Admin-Password']||'');return supplied===expected;}
function rows(v){return (Array.isArray(v)?v:[]).filter(r=>r&&r.id!==undefined&&r.id!==null)}
function merge(...lists){const map=new Map();lists.flat().filter(Boolean).forEach(r=>{const k=String(r.id||`${r.name||''}-${r.phone||''}-${r.date||''}-${r.time||''}`);map.set(k,{...(map.get(k)||{}),...r})});return [...map.values()].sort((a,b)=>String(b.createdAt||b.id||'').localeCompare(String(a.createdAt||a.id||'')))}
exports.handler=async(event)=>{
 if(event.httpMethod==='OPTIONS')return response(204,{});
 try{connectLambda?.(event)}catch(_){}
 let store;try{store=getStore(STORE_NAME)}catch(e){return response(503,{ok:false,error:'예약 서버 저장소를 열지 못했습니다.',detail:String(e?.message||e)})}
 if(event.httpMethod==='DELETE'){
   return response(405,{ok:false,error:'예약 전체 삭제 API는 운영 안전을 위해 비활성화되었습니다. 개별 삭제 또는 관리자 저장을 사용해 주세요.'});
 }
 if(event.httpMethod==='GET'){
   if(!adminAuthorized(event))return response(401,{ok:false,error:'관리자 인증이 필요합니다.'});
   try{
     const current=rows(await store.get(KEY,{type:'json'}));
     return response(200,{ok:true,reservations:current,count:current.length});
   }catch(e){
     console.error('[reservations-api] GET failed',e);
     return response(503,{ok:false,error:'예약 서버 데이터를 불러오지 못했습니다.',detail:String(e?.message||e)});
   }
 }
 let body={};try{body=JSON.parse(event.body||'{}')}catch(_){return response(400,{ok:false,error:'요청 형식이 올바르지 않습니다.'})}
 if(event.httpMethod==='POST'){
   if(body.action==='lookup'){
     try{
       const phone=String(body.phone||'').replace(/\D/g,'');
       const ids=(Array.isArray(body.ids)?body.ids:[]).map(v=>String(v));
       if(!phone || !ids.length)return response(200,{ok:true,reservations:[],count:0});
       const current=rows(await store.get(KEY,{type:'json'}).catch(()=>null));
       const matched=current.filter(r=>{
         const rPhone=String(r?.phone||r?.applicationForm?.phone||'').replace(/\D/g,'');
         return rPhone===phone && ids.includes(String(r.id));
       });
       return response(200,{ok:true,reservations:matched,count:matched.length});
     }catch(e){
       console.error('[reservations-api] lookup failed',e);
       return response(503,{ok:false,error:'예약 상태를 확인하지 못했습니다.',detail:String(e?.message||e)});
     }
   }
   const r=body.reservation;
   if(!r||r.id===undefined||r.id===null)return response(400,{ok:false,error:'예약 정보가 없습니다.'});
   try{
     const current=rows(await store.get(KEY,{type:'json'}).catch(()=>null));
     // 기존 서버값 위에 들어온 동일 ID 예약을 덮어씁니다.
     const next=merge(current,[r]).slice(0,3000);
     await store.setJSON(KEY,next);
     return response(200,{ok:true,id:r.id,count:next.length});
   }catch(e){
     console.error('[reservations-api] POST failed',e);
     return response(503,{ok:false,error:'예약 서버 저장에 실패했습니다.',detail:String(e?.message||e)});
   }
 }
 if(event.httpMethod==='PATCH'){
   if(!adminAuthorized(event))return response(401,{ok:false,error:'관리자 인증이 필요합니다.'});
   const reservation=body.reservation;
   if(!reservation||reservation.id===undefined||reservation.id===null){
     return response(400,{ok:false,error:'변경할 예약 정보가 없습니다.'});
   }
   try{
     const current=rows(await store.get(KEY,{type:'json'}).catch(()=>null));
     const next=merge(current,[reservation]).slice(0,3000);
     await store.setJSON(KEY,next);
     const saved=next.find(r=>String(r.id)===String(reservation.id))||reservation;
     return response(200,{ok:true,reservation:saved,count:next.length});
   }catch(e){
     console.error('[reservations-api] PATCH failed',e);
     return response(503,{ok:false,error:'예약 상태 저장에 실패했습니다.',detail:String(e?.message||e)});
   }
 }
 if(event.httpMethod==='PUT'){
   if(!adminAuthorized(event))return response(401,{ok:false,error:'관리자 인증이 필요합니다.'});
   try{
     // RC3.2: 관리자 화면의 현재 목록이 서버의 전체 기준본입니다.
     // 병합하지 않고 정확히 교체해야 삭제된 예약이 다시 살아나지 않습니다.
     const next=rows(body.reservations).slice(0,3000);
     await store.setJSON(KEY,next);
     return response(200,{ok:true,count:next.length,reservations:next});
   }catch(e){
     console.error('[reservations-api] PUT failed',e);
     return response(503,{ok:false,error:'예약 서버 동기화에 실패했습니다.',detail:String(e?.message||e)});
   }
 }
 return response(405,{ok:false,error:'지원하지 않는 요청입니다.'});
};

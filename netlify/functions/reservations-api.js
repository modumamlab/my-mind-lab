const { getStore, connectLambda } = require('@netlify/blobs');
const STORE_NAME='modumam-reservations-v1';
const KEY='reservations';
const response=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-MML-Admin-Password','Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS'},body:JSON.stringify(body)});
function adminAuthorized(event){const expected=String(process.env.MML_RESERVATION_ADMIN_PASSWORD||'modumam2026');const supplied=String(event.headers?.['x-mml-admin-password']||event.headers?.['X-MML-Admin-Password']||'');return supplied===expected;}
function rows(v){return (Array.isArray(v)?v:[]).filter(r=>r&&r.id!==undefined&&r.id!==null)}
function merge(...lists){const map=new Map();lists.flat().filter(Boolean).forEach(r=>{const k=String(r.id||`${r.name||''}-${r.phone||''}-${r.date||''}-${r.time||''}`);map.set(k,{...(map.get(k)||{}),...r})});return [...map.values()].sort((a,b)=>Number(b.id||0)-Number(a.id||0))}
exports.handler=async(event)=>{
 if(event.httpMethod==='OPTIONS')return response(204,{});
 try{connectLambda?.(event)}catch(_){}
 let store;try{store=getStore({name:STORE_NAME,consistency:'strong'})}catch(e){return response(503,{ok:false,error:'예약 서버 저장소를 열지 못했습니다.',detail:String(e?.message||e)})}
 if(event.httpMethod==='GET'){if(!adminAuthorized(event))return response(401,{ok:false,error:'관리자 인증이 필요합니다.'});const current=rows(await store.get(KEY,{type:'json'}).catch(()=>null));return response(200,{ok:true,reservations:current,count:current.length})}
 let body={};try{body=JSON.parse(event.body||'{}')}catch(_){return response(400,{ok:false,error:'요청 형식이 올바르지 않습니다.'})}
 if(event.httpMethod==='POST'){const r=body.reservation;if(!r||r.id===undefined||r.id===null)return response(400,{ok:false,error:'예약 정보가 없습니다.'});const current=rows(await store.get(KEY,{type:'json'}).catch(()=>null));const next=merge([r],current).slice(0,3000);await store.setJSON(KEY,next);return response(200,{ok:true,id:r.id,count:next.length})}
 if(event.httpMethod==='PUT'){if(!adminAuthorized(event))return response(401,{ok:false,error:'관리자 인증이 필요합니다.'});const current=rows(await store.get(KEY,{type:'json'}).catch(()=>null));const next=merge(rows(body.reservations),current).slice(0,3000);await store.setJSON(KEY,next);return response(200,{ok:true,count:next.length,reservations:next})}
 return response(405,{ok:false,error:'지원하지 않는 요청입니다.'});
};
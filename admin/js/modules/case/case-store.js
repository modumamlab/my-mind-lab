(function(global){
'use strict';
const NS=global.MMLCaseModules=global.MMLCaseModules||{};
const STORAGE_KEY='modumam_cases_v1';
const INDEX_KEY='modumam_case_index_v1';
function parse(value,fallback){try{return value?JSON.parse(value):fallback}catch(e){return fallback}}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function now(){return new Date().toISOString()}
function readAll(){const rows=parse(localStorage.getItem(STORAGE_KEY),[]);return Array.isArray(rows)?rows:[]}
function writeAll(rows){const safe=Array.isArray(rows)?rows:[];localStorage.setItem(STORAGE_KEY,JSON.stringify(safe));localStorage.setItem(INDEX_KEY,JSON.stringify(safe.map(row=>({id:row.id,clientKey:row.clientKey,status:row.status,updatedAt:row.updatedAt}))));return clone(safe)}
function findById(id){return clone(readAll().find(row=>String(row.id)===String(id))||null)}
function findByClientKey(clientKey){return clone(readAll().filter(row=>row.clientKey===clientKey))}
function upsert(record){if(!record||!record.id)throw new Error('사례 ID가 필요합니다.');const rows=readAll();const idx=rows.findIndex(row=>String(row.id)===String(record.id));const previous=idx>=0?rows[idx]:null;const next={...(previous||{}),...clone(record),createdAt:previous?.createdAt||record.createdAt||now(),updatedAt:now()};if(idx>=0)rows[idx]=next;else rows.unshift(next);writeAll(rows);return clone(next)}
function remove(id){const rows=readAll();const next=rows.filter(row=>String(row.id)!==String(id));if(next.length===rows.length)return false;writeAll(next);return true}
function clear(){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(INDEX_KEY)}
NS.caseStore=Object.freeze({STORAGE_KEY,INDEX_KEY,readAll,writeAll,findById,findByClientKey,upsert,remove,clear});
})(window);

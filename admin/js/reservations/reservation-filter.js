import {normalizePhone, normalizeReservationStatus, reservationDateTime} from './reservation-utils.js';

export function filterReservations(rows,{query='',status='전체',method='전체'}={}){
  const keyword=String(query||'').trim().toLowerCase();
  const phoneKeyword=normalizePhone(keyword);
  return (Array.isArray(rows)?rows:[]).filter(row=>{
    const statusMatch=status==='전체'||normalizeReservationStatus(row?.status)===status;
    const methodMatch=method==='전체'||String(row?.type||'')===method;
    if(!statusMatch||!methodMatch)return false;
    if(!keyword)return true;
    const haystack=[row?.name,row?.phone,row?.program,row?.type,row?.reservationNumber,row?.caseNumber,reservationDateTime(row)]
      .map(value=>String(value||'').toLowerCase()).join(' ');
    return haystack.includes(keyword)||(phoneKeyword&&normalizePhone(row?.phone).includes(phoneKeyword));
  });
}

export function sortReservations(rows,direction='desc'){
  const factor=direction==='asc'?1:-1;
  return [...(Array.isArray(rows)?rows:[])].sort((a,b)=>factor*reservationDateTime(a).localeCompare(reservationDateTime(b)));
}

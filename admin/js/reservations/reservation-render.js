import {filterReservations, sortReservations} from './reservation-filter.js';
import {getReservations} from './reservation-store.js';
import {normalizeReservationStatus} from './reservation-utils.js';

export function reservationSummary(rows=getReservations()){
  const source=Array.isArray(rows)?rows:[];
  return source.reduce((summary,row)=>{
    const status=normalizeReservationStatus(row?.status);
    summary.total+=1;summary.byStatus[status]=(summary.byStatus[status]||0)+1;
    return summary;
  },{total:0,byStatus:{}});
}

export function selectReservationRows(options={}){
  return sortReservations(filterReservations(getReservations(),options),options.direction||'desc');
}

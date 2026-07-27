export const RESERVATION_STATUS = Object.freeze([
  '예약신청','예약승인','결제완료','검사발송','검사완료','결과업로드','상담준비','상담진행','상담완료','종결','예약취소'
]);

const STATUS_ALIASES=Object.freeze({
  승인대기:'예약신청',예약확정:'예약승인',결제대기:'예약승인',검사링크발송:'검사발송',
  검사진행:'검사발송',결과작성:'결과업로드',상담예정:'상담준비'
});

export function normalizeReservationStatus(value){
  const raw=String(value||'예약신청');
  return STATUS_ALIASES[raw]||raw;
}

export function reservationId(value){return String(value??'');}
export function sameReservationId(a,b){return reservationId(a)===reservationId(b);}
export function reservationDateTime(row){return `${row?.date||''} ${row?.time||''}`.trim();}
export function normalizePhone(value){return String(value||'').replace(/\D/g,'');}
export function cloneReservation(row){return row&&typeof row==='object'?{...row}:null;}

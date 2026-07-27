import {findReservation, getCounselingTimes} from './reservation-store.js';

function requireBridge(){
  const api=window.MMLAdminReservationsBridge;
  if(!api)throw new Error('예약관리 연결이 아직 준비되지 않았습니다.');
  return api;
}

export function updateReservation(id,patch){return requireBridge().updateReservation(id,patch);}
export function updateReservationDate(id,value){return requireBridge().updateCounselingDate(id,value);}
export function updateReservationTime(id,value){
  if(!getCounselingTimes().includes(String(value||'')))throw new Error('운영시간에 포함되지 않은 상담시간입니다.');
  return requireBridge().updateCounselingTime(id,value);
}
export function updateReservationMethod(id,value){return requireBridge().updateCounselingMethod(id,value);}
export function saveReservationChanges(id){return requireBridge().saveCurrentReservationChanges(id);}
export function runReservationNextAction(id){return requireBridge().runNextAction(id);}
export function moveReservationPrevious(id){return requireBridge().moveReservationToPreviousStage(id);}
export function removeReservation(id){return requireBridge().deleteReservation(id);}
export function removeClientByReservation(id){return requireBridge().deleteClientCompletelyByReservation(id);}
export function refreshReservations(showMessage=false){return requireBridge().refreshSharedOperatingData(Boolean(showMessage));}
export function openReservationManagement(){return requireBridge().setMenu('reservation');}
export {findReservation};

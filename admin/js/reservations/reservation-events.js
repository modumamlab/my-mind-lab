import {exposeReservationActions} from './reservation-actions.js';
import {isReservationBridgeReady} from './reservation-store.js';

let initialized=false;

export function initializeReservationModule(){
  if(initialized)return window.MMLReservationActions||null;
  if(!isReservationBridgeReady())return null;
  initialized=true;
  const actions=exposeReservationActions();
  window.dispatchEvent(new CustomEvent('mml:reservations-module-ready',{detail:{actions}}));
  console.info('[MML] reservations module connected');
  return actions;
}

if(!initializeReservationModule()){
  window.addEventListener('mml:reservations-bridge-ready',initializeReservationModule,{once:true});
}

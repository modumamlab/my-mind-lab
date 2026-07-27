import {sameReservationId} from './reservation-utils.js';

function bridge(){return window.MMLAdminReservationsBridge||null;}

export function getReservationState(){return bridge()?.getState?.()||null;}
export function getReservations(){return bridge()?.getReservations?.()||[];}
export function findReservation(id){return getReservations().find(row=>sameReservationId(row?.id,id))||null;}
export function getOperatingSettings(){return bridge()?.getOperatingSettings?.()||{};}
export function getCounselingTimes(){return bridge()?.getCounselingTimes?.()||[];}
export function isReservationBridgeReady(){return Boolean(bridge());}

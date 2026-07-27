import {
  moveReservationPrevious, openReservationManagement, refreshReservations, removeClientByReservation,
  removeReservation, runReservationNextAction, saveReservationChanges, updateReservation,
  updateReservationDate, updateReservationMethod, updateReservationTime
} from './reservation-service.js';

export const reservationActions=Object.freeze({
  open:openReservationManagement,refresh:refreshReservations,update:updateReservation,
  updateDate:updateReservationDate,updateTime:updateReservationTime,updateMethod:updateReservationMethod,
  saveChanges:saveReservationChanges,next:runReservationNextAction,previous:moveReservationPrevious,
  remove:removeReservation,removeClient:removeClientByReservation
});

export function exposeReservationActions(){window.MMLReservationActions=reservationActions;return reservationActions;}

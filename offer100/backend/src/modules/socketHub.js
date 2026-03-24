let ioInstance = null;

function setSocketIo(io) {
  ioInstance = io;
}

function emitRecruitmentUpdate(payload) {
  if (ioInstance) {
    ioInstance.emit('recruitment:update', payload);
  }
}

module.exports = {
  setSocketIo,
  emitRecruitmentUpdate
};

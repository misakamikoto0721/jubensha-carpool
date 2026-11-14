const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const handlers = {
  login: require('./handlers/login'),
  authStart: require('./handlers/authStart'),
  authFinish: require('./handlers/authFinish'),
  bindUid: require('./handlers/bindUid'),
  devLogin: require('./handlers/devLogin'),
  logout: require('./handlers/logout'),
  createSession: require('./handlers/createSession'),
  joinSession: require('./handlers/joinSession'),
  drawSession: require('./handlers/drawSession'),
  pullMember: require('./handlers/pullMember'),
  cancelJoin: require('./handlers/cancelJoin'),
  completeSession: require('./handlers/completeSession'),
  markAttendance: require('./handlers/markAttendance'),
  getSession: require('./handlers/getSession'),
  listSessions: require('./handlers/listSessions'),
  listPendingMarks: require('./handlers/listPendingMarks'),
  listPrivateChats: require('./handlers/listPrivateChats'),
  listPrivateMessages: require('./handlers/listPrivateMessages'),
  sendPrivateMessage: require('./handlers/sendPrivateMessage'),
  listSessionChats: require('./handlers/listSessionChats'),
  listSessionMessages: require('./handlers/listSessionMessages'),
  sendSessionMessage: require('./handlers/sendSessionMessage'),
  updateProfile: require('./handlers/updateProfile'),
  setRole: require('./handlers/setRole')
}

exports.main = async (event) => {
  const payload = event || {}
  const action = payload.action
  const handler = handlers[action]
  if (!handler) {
    return { ok: false, reason: 'unknown_action', message: '未知操作' }
  }
  try {
    return await handler(payload, cloud)
  } catch (err) {
    console.error('[api]', action, err)
    const detail = String((err && (err.errMsg || err.message)) || '').replace(/\s+/g, ' ').slice(0, 120)
    return {
      ok: false,
      reason: 'internal',
      message: detail || '服务暂时不可用，请稍后再试'
    }
  }
}

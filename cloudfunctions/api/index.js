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
  cancelJoin: require('./handlers/cancelJoin'),
  markAttendance: require('./handlers/markAttendance'),
  getSession: require('./handlers/getSession'),
  listSessions: require('./handlers/listSessions'),
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

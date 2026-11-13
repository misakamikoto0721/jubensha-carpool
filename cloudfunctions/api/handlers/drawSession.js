const domain = require('../domain')
const draw = require('../draw')
const present = require('../present')
const users = require('../users')

module.exports = async function drawSession(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const sessionId = String((event && event.sessionId) || '')
  if (!sessionId) return { ok: false, reason: 'not_found', message: '车次不存在' }

  let session
  try {
    const snap = await db.collection('sessions').doc(sessionId).get()
    session = snap.data
  } catch (err) {
    if (users.isMissingCollection(err)) {
      return { ok: false, reason: 'not_found', message: '车次不存在或已被删除' }
    }
    throw err
  }
  if (!session) return { ok: false, reason: 'not_found', message: '车次不存在或已被删除' }
  session._id = sessionId

  const decision = domain.decideDraw(session, now)
  if (!decision.ok) return decision
  const drawn = await draw.ensureDrawn(db, session, now)
  return {
    ok: true,
    alreadyDrawn: !!decision.alreadyDrawn,
    session: present.presentSession(drawn, '')
  }
}

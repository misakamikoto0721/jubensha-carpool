const crypto = require('crypto')
const domain = require('./domain')
const errors = require('./errors')

async function ensureDrawn(db, session, now) {
  if (!session || domain.sessionKind(session) !== 'weekly') return session
  const decision = domain.decideDraw(session, now)
  if (!decision.ok) return session
  if (decision.alreadyDrawn) {
    if (!session.signup_synced) await syncSignups(db, session)
    return session
  }

  const sessionId = session._id
  let drawnSession = session
  let didDraw = false
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.collection('sessions').doc(sessionId).get()
    const current = snap.data
    if (!current) errors.raise('not_found', '车次不存在')
    current._id = sessionId
    const again = domain.decideDraw(current, now)
    if (!again.ok || again.alreadyDrawn) {
      drawnSession = current
      return
    }
    const result = domain.drawWinners(
      current.applicant_uids || [],
      current.capacity,
      (span) => crypto.randomInt(span)
    )
    const next = {
      member_uids: result.selected,
      missed_uids: result.missed,
      applicant_uids: [],
      applicant_count: 0,
      joined_count: result.selected.length,
      draw_status: 'done',
      drawn_at: now,
      status: 'drawn',
      signup_synced: false
    }
    await transaction.collection('sessions').doc(sessionId).update({ data: next })
    drawnSession = Object.assign({}, current, next)
    didDraw = true
  })

  if (didDraw || (domain.decideDraw(drawnSession, now).alreadyDrawn && !drawnSession.signup_synced)) {
    await syncSignups(db, drawnSession)
  }
  return drawnSession
}

async function syncSignups(db, session) {
  const sessionId = session._id
  const selected = session.member_uids || []
  const missed = session.missed_uids || []
  for (let index = 0; index < selected.length; index += 1) {
    await writeDrawStatus(db, sessionId, selected[index], 'joined')
  }
  for (let index = 0; index < missed.length; index += 1) {
    await writeDrawStatus(db, sessionId, missed[index], 'missed')
  }
  await db.collection('sessions').doc(sessionId).update({ data: { signup_synced: true } })
  session.signup_synced = true
}

async function writeDrawStatus(db, sessionId, uid, status) {
  const ref = db.collection('signups').doc(domain.signupDocId(sessionId, uid))
  const existing = await readSignup(ref)
  if (!existing) {
    await ref.set({
      data: {
        session_id: sessionId,
        uid: uid,
        status: status,
        created_at: Date.now()
      }
    })
    return
  }
  if (existing.status === 'waiting' || existing.status === 'dropped') {
    await ref.update({ data: { status: status } })
  }
}

async function readSignup(ref) {
  try {
    const snap = await ref.get()
    return snap.data || null
  } catch (err) {
    const msg = String((err && (err.message || err.errMsg)) || '')
    if (msg.indexOf('does not exist') >= 0 || msg.indexOf('不存在') >= 0) return null
    throw err
  }
}

module.exports = {
  ensureDrawn: ensureDrawn
}

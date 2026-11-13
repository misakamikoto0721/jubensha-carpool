const test = require('node:test')
const assert = require('node:assert/strict')
const domain = require('../cloudfunctions/api/domain')

const config = { noShowThreshold: 2, banDays: 14 }
const future = Date.UTC(2026, 10, 20, 12, 0, 0)
const now = Date.UTC(2026, 10, 13, 7, 0, 0)

function session(overrides) {
  return Object.assign({
    status: 'open',
    joined_count: 1,
    capacity: 6,
    start_time: future,
    dm_uid: 'PB0001'
  }, overrides)
}

function player(overrides) {
  return Object.assign({
    uid: 'PB0002',
    role: 'player',
    credit_status: 'normal',
    ban_until: null,
    no_show_count: 0
  }, overrides)
}

test('accepts a normal student id and name', () => {
  const result = domain.validateProfile(' pb220001 ', ' 张三 ')
  assert.equal(result.ok, true)
  assert.equal(result.studentId, 'PB220001')
  assert.equal(result.name, '张三')
})

test('rejects a short student id', () => {
  const result = domain.validateProfile('ab', '张三')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'invalid_student_id')
})

test('rejects a session that starts too far ahead', () => {
  const result = domain.validateSessionInput({
    scriptName: '年轮',
    location: '西图研讨室',
    capacity: 6,
    startTime: now + 400 * domain.DAY_MS
  }, now)
  assert.equal(result.ok, false)
})

test('blocks a restricted player and a full or started car', () => {
  const banned = domain.decideJoin({
    user: player({ credit_status: 'restricted', ban_until: now + domain.DAY_MS }),
    session: session(),
    now: now
  })
  assert.equal(banned.reason, 'restricted')

  const full = domain.decideJoin({
    user: player(),
    session: session({ status: 'full', joined_count: 6, capacity: 6 }),
    now: now
  })
  assert.equal(full.reason, 'full')

  const started = domain.decideJoin({
    user: player(),
    session: session({ start_time: now }),
    now: now
  })
  assert.equal(started.reason, 'started')

  const open = domain.decideJoin({ user: player(), session: session(), now: now })
  assert.equal(open.ok, true)
})

test('the second no-show starts a 14 day ban and a later one extends it', () => {
  const first = domain.applyNoShow(player(), now, config)
  assert.equal(first.no_show_count, 1)
  assert.equal(first.credit_status, 'normal')

  const second = domain.applyNoShow(first, now, config)
  assert.equal(second.no_show_count, 2)
  assert.equal(second.credit_status, 'restricted')
  assert.equal(second.ban_until, now + 14 * domain.DAY_MS)

  const later = now + 20 * domain.DAY_MS
  const third = domain.applyNoShow(second, later, config)
  assert.equal(third.ban_until, later + 14 * domain.DAY_MS)
})

test('only the hosting DM or an admin can mark attendance', () => {
  const car = session()
  assert.equal(domain.canManageSession(player({ uid: 'PB0001', role: 'dm' }), car), true)
  assert.equal(domain.canManageSession(player({ uid: 'PB0009', role: 'dm' }), car), false)
  assert.equal(domain.canManageSession(player({ role: 'admin' }), car), true)
})

test('attendance must cover exactly the people on the car', () => {
  assert.equal(domain.sameMembers(['A', 'B'], ['B', 'A']), true)
  assert.equal(domain.sameMembers(['A'], ['A', 'B']), false)
})

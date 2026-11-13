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
  const startTime = now + 400 * domain.DAY_MS
  const result = domain.validateSessionInput({
    scriptName: '年轮',
    location: '西图研讨室',
    capacity: 6,
    kind: 'private',
    startTime: startTime,
    endTime: startTime + 4 * 60 * 60 * 1000
  }, now)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'invalid_time')
})

test('a car needs an end after the start and a kind of its own', () => {
  const startTime = future
  const endedEarly = domain.validateSessionInput({
    scriptName: '年轮',
    location: '西图研讨室',
    capacity: 6,
    kind: 'private',
    startTime: startTime,
    endTime: startTime
  }, now)
  assert.equal(endedEarly.reason, 'invalid_time')

  const noKind = domain.validateSessionInput({
    scriptName: '年轮',
    location: '西图研讨室',
    capacity: 6,
    startTime: startTime,
    endTime: startTime + 4 * 60 * 60 * 1000
  }, now)
  assert.equal(noKind.reason, 'invalid_kind')

  const weekly = domain.validateSessionInput({
    scriptName: '年轮',
    location: '西图研讨室',
    capacity: 6,
    kind: 'weekly',
    startTime: startTime,
    endTime: startTime + 4 * 60 * 60 * 1000,
    drawDeadline: startTime - 60 * 60 * 1000
  }, now)
  assert.equal(weekly.ok, true)
  assert.equal(weekly.kind, 'weekly')
  assert.equal(weekly.drawDeadline, startTime - 60 * 60 * 1000)

  const missingDeadline = domain.validateSessionInput({
    scriptName: '年轮',
    location: '西图研讨室',
    capacity: 6,
    kind: 'weekly',
    startTime: startTime,
    endTime: startTime + 4 * 60 * 60 * 1000
  }, now)
  assert.equal(missingDeadline.reason, 'invalid_time')
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
  assert.equal(open.placement, 'joined')
})

test('weekly draw picks a uniform sample once the deadline has passed', () => {
  const deadline = future - 60 * 60 * 1000
  const car = session({
    kind: 'weekly',
    draw_deadline: deadline,
    draw_status: 'pending',
    capacity: 2,
    applicant_uids: ['a', 'b', 'c', 'd']
  })
  assert.equal(domain.decideDraw(car, deadline - 1).reason, 'too_early')
  assert.equal(domain.decideJoin({ user: player(), session: car, now: deadline }).reason, 'draw_closed')
  assert.equal(domain.decideDraw(car, deadline).ok, true)

  const picks = [1, 0]
  const drawn = domain.drawWinners(car.applicant_uids, 2, () => picks.shift())
  assert.deepEqual(drawn.selected, ['b', 'a'])
  assert.deepEqual(drawn.missed, ['c', 'd'])

  const everyone = domain.drawWinners(['a', 'b'], 6, () => 0)
  assert.deepEqual(everyone.selected, ['a', 'b'])
  assert.deepEqual(everyone.missed, [])

  const done = session({ kind: 'weekly', draw_status: 'done', draw_deadline: deadline })
  assert.equal(domain.decideDraw(done, deadline).alreadyDrawn, true)
  assert.equal(domain.decideJoin({ user: player(), session: done, now: deadline - 1 }).reason, 'drawn')
  assert.equal(domain.decideDraw(session({ kind: 'private' }), deadline).reason, 'wrong_kind')
})

test('weekly signup ignores the headcount and private signup stops when full', () => {
  const weekly = domain.decideJoin({
    user: player(),
    session: session({ kind: 'weekly', joined_count: 6, capacity: 6 }),
    now: now
  })
  assert.equal(weekly.ok, true)
  assert.equal(weekly.placement, 'waiting')

  const privateFull = domain.decideJoin({
    user: player(),
    session: session({ kind: 'private', joined_count: 6, capacity: 6 }),
    now: now
  })
  assert.equal(privateFull.reason, 'full')
  assert.equal(domain.nextSeatStatus(session({ kind: 'weekly' }), 30), 'open')
  assert.equal(domain.nextSeatStatus(session({ kind: 'private', capacity: 6 }), 6), 'full')
})

test('only the hosting DM can pull someone onto a full private car', () => {
  const car = session({ kind: 'private', status: 'full', joined_count: 6, capacity: 6 })
  const dm = player({ uid: 'PB0001', role: 'dm' })
  const guest = player({ uid: 'PB0008' })
  assert.equal(domain.decidePullIn({
    actor: dm,
    target: guest,
    session: car,
    now: now,
    alreadyJoined: false
  }).ok, true)
  assert.equal(domain.decidePullIn({
    actor: player(),
    target: guest,
    session: car,
    now: now,
    alreadyJoined: false
  }).reason, 'forbidden')
  assert.equal(domain.decidePullIn({
    actor: dm,
    target: guest,
    session: session({ kind: 'weekly' }),
    now: now,
    alreadyJoined: false
  }).reason, 'wrong_kind')
  assert.equal(domain.decidePullIn({
    actor: dm,
    target: player({ credit_status: 'restricted', ban_until: now + domain.DAY_MS }),
    session: car,
    now: now,
    alreadyJoined: false
  }).reason, 'restricted')
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

test('a car leaves the board at start time and can still be marked', () => {
  const car = session({ status: 'open', start_time: future })
  assert.equal(domain.visibleOnBoard(car, now), true)
  assert.equal(domain.needsMark(car, now), false)
  assert.equal(domain.visibleOnBoard(car, future), false)
  assert.equal(domain.needsMark(car, future), true)
  assert.equal(domain.visibleOnBoard(session({ status: 'completed', start_time: future }), now), false)
  assert.equal(domain.needsMark(session({ status: 'drawn', start_time: future }), future), true)
})

test('only the hosting DM or an admin can mark attendance', () => {
  const car = session()
  assert.equal(domain.canManageSession(player({ uid: 'PB0001', role: 'dm' }), car), true)
  assert.equal(domain.canManageSession(player({ uid: 'PB0009', role: 'dm' }), car), false)
  assert.equal(domain.canManageSession(player({ role: 'admin' }), car), true)
})

test('only an admin can add or remove a DM', () => {
  const admin = player({ role: 'admin' })
  const member = player({ uid: 'PB0003', role: 'player' })
  assert.equal(domain.decideRoleChange(admin, member, 'dm').ok, true)
  assert.equal(domain.decideRoleChange(admin, member, 'player').role, 'player')
  assert.equal(domain.decideRoleChange(member, member, 'dm').reason, 'forbidden')
  assert.equal(domain.decideRoleChange(admin, player({ role: 'admin' }), 'dm').reason, 'forbidden')
  assert.equal(domain.decideRoleChange(admin, member, 'admin').reason, 'invalid_role')
})

test('attendance must cover exactly the people on the car', () => {
  assert.equal(domain.sameMembers(['A', 'B'], ['B', 'A']), true)
  assert.equal(domain.sameMembers(['A'], ['A', 'B']), false)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const devUser = require('../cloudfunctions/api/devUser')

test('dev account keeps id, student id, name and role', () => {
  const result = devUser.readAccount({
    enabled: true,
    account: {
      id: ' pb0001 ',
      studentId: 'pb0002',
      name: ' 测试甲 ',
      role: 'admin'
    }
  })
  assert.equal(result.ok, true)
  assert.equal(result.account.id, 'PB0001')
  assert.equal(result.account.studentId, 'PB0002')
  assert.equal(result.account.name, '测试甲')
  assert.equal(result.account.role, 'admin')
})

test('dev login stays closed when the config is disabled', () => {
  const result = devUser.readAccount({
    enabled: false,
    account: { id: 'PB0001', studentId: 'PB0001', name: '甲', role: 'player' }
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'dev_login_disabled')
})

test('each wechat keeps its own temp account after the first one is taken', () => {
  const first = devUser.assignDevLogin({
    openid: 'wx-a',
    configuredId: 'PB000001',
    identity: { openid: 'wx-a', uid: 'PB000001', bound_at: 1 },
    holders: [
      { openid: 'wx-a', uid: 'PB000001', bound_at: 1 },
      { openid: 'wx-b', uid: 'PB000001', bound_at: 2 }
    ]
  })
  const second = devUser.assignDevLogin({
    openid: 'wx-b',
    configuredId: 'PB000001',
    identity: { openid: 'wx-b', uid: 'PB000001', bound_at: 2 },
    holders: [
      { openid: 'wx-a', uid: 'PB000001', bound_at: 1 },
      { openid: 'wx-b', uid: 'PB000001', bound_at: 2 }
    ]
  })
  const again = devUser.assignDevLogin({
    openid: 'wx-b',
    configuredId: 'PB000001',
    identity: { openid: 'wx-b', uid: 'PB000002', bound_at: 3 },
    holders: [{ openid: 'wx-a', uid: 'PB000001', bound_at: 1 }]
  })
  assert.equal(first.action, 'configured')
  assert.equal(second.action, 'allocate')
  assert.deepEqual(again, { action: 'keep', uid: 'PB000002' })
  assert.deepEqual(devUser.guestAccount(2), {
    id: 'PB000002',
    studentId: 'PB000002',
    name: '测试2',
    role: 'player'
  })
})

test('dev account rejects an unknown role', () => {
  const result = devUser.readAccount({
    enabled: true,
    account: { id: 'PB0001', studentId: 'PB0001', name: '甲', role: 'owner' }
  })
  assert.equal(result.reason, 'invalid_role')
})

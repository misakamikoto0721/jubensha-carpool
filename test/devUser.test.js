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

test('dev account rejects an unknown role', () => {
  const result = devUser.readAccount({
    enabled: true,
    account: { id: 'PB0001', studentId: 'PB0001', name: '甲', role: 'owner' }
  })
  assert.equal(result.reason, 'invalid_role')
})

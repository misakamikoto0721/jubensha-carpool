const domain = require('../domain')
const users = require('../users')

module.exports = async function updateProfile(event, cloud) {
  const db = cloud.database()
  const now = Date.now()
  const source = event || {}
  const loaded = await users.requireUser(db, cloud, now)
  if (!loaded.ok) return loaded
  if (!loaded.user) return { ok: false, reason: 'unbound', message: '登录后才能改个人资料' }

  const patch = {}
  if (source.nickname !== undefined) {
    const nickname = domain.validateNickname(source.nickname)
    if (!nickname.ok) return nickname
    patch.nickname = nickname.nickname
  }
  if (source.avatarFileId !== undefined) {
    const avatar = domain.validateAvatarFileId(source.avatarFileId, loaded.user.uid)
    if (!avatar.ok) return avatar
    patch.avatar_file_id = avatar.avatarFileId
  }
  if (!Object.keys(patch).length) {
    return { ok: false, reason: 'empty_profile', message: '没有要保存的资料' }
  }

  await db.collection('users').doc(loaded.user._id).update({ data: patch })
  Object.assign(loaded.user, patch)
  return { ok: true, user: users.presentUser(loaded.user) }
}

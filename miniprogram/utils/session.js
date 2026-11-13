const api = require('./api')
const format = require('./format')

function loadMe() {
  return api.call('login', { provider: api.provider() }).then((result) => {
    const user = result.bound ? format.decorateUser(result.user) : null
    getApp().globalData.user = user
    return {
      bound: !!result.bound,
      user: user,
      auth: result.auth || { configured: false, mode: 'student_id' }
    }
  })
}

module.exports = {
  loadMe: loadMe
}

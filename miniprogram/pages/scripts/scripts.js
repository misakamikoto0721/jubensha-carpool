const api = require('../../utils/api')
const format = require('../../utils/format')

function groupScripts(sessions) {
  const groups = []
  const byName = {}
  sessions.forEach((session) => {
    const name = session.scriptName || '未命名剧本'
    if (!byName[name]) {
      byName[name] = { name: name, sessions: [] }
      groups.push(byName[name])
    }
    byName[name].sessions.push(session)
  })
  return groups.map((group) => Object.assign({}, group, {
    countText: group.sessions.length + ' 场'
  }))
}

Page({
  data: {
    loading: true,
    scripts: []
  },

  onShow() {
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  refresh() {
    this.setData({ loading: true })
    return api.call('listSessions')
      .then((result) => {
        const sessions = (result.sessions || []).map(format.decorateSession)
        this.setData({ loading: false, scripts: groupScripts(sessions) })
      })
      .catch((err) => {
        this.setData({ loading: false, scripts: [] })
        api.showError(err)
      })
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/session/detail/detail?id=' + id })
  }
})

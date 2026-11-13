# 剧本杀拼车

科大社团内部的微信小程序。DM 发车，分享到群里，成员上车，活动结束后标记到场或爽约。累计 2 次爽约，禁止报名 14 天。

身份来自科大统一身份认证。登录成功后，学工号写入云端用户记录。小程序不让用户自己填学号来注册。

当前阶段：统一认证的页面和接口已经留好，学校的 `client_id` / `client_secret` 还没下来，所以登录按钮会提示尚未配置。产品页面按「登录页 → 三个分页」来用，不要再改回手填学号的主流程。

后续 Agent 在审核代码或继续开发之前，必须先读 [Agent.md](Agent.md) 并遵守。

## 现在的页面

打开小程序先进 `pages/login/login`。正式按钮是「统一身份认证登录」，去接科大官方登录页，那个页面不由本项目绘制。统一认证接通前，同一页有「临时登录」，用 `devUser.js` 里的账号进入三个底栏。接通后删掉它。已经登录过的微信会直接进入底栏。

| 底栏 | 路径 | 作用 |
|---|---|---|
| 主页 | `pages/index/index` | 正在报名的车。DM 或管理员可以发车 |
| 剧本 | `pages/scripts/scripts` | 把这些车按剧本名归在一起 |
| 我的 | `pages/me/me` | 姓名、学号、身份、爽约次数。管理员可把别人加入 DM。登出回到登录页 |

发车 `pages/session/create/create` 和车次详情 `pages/session/detail/detail` 从底栏里打开，不占底栏。研讨室不在小程序里预约，详情页复制 `http://ic.lib.ustc.edu.cn/`。

## 账号存在哪

每次云函数调用都带当前微信的 openid。

- `auth_identities`：`openid → uid`。登出只删这条连接。
- `users`：一个人一条。`uid`、`student_id`、`name`、`role`（`player` / `dm` / `admin`）、`credit_status`、`ban_until`、`no_show_count`。
- `sessions`：一场车。`dm_uid`、`script_name`、`start_time`、`location`、`capacity`、`status`、`joined_count`、`member_uids`。
- `signups`：报名。文档 id 是 `车次 id_uid`。
- `oauth_states`：统一认证的一次性 state，10 分钟，用完即删。

`role` 写在每个用户自己的文档上。管理员用 `setRole` 把别人的 `role` 改成 `dm` 或 `player`。小程序里不能把别人设成管理员。第一位登录的人不会自动成为管理员。

## 接口

只有一个云函数 `api`。调用：

```text
wx.cloud.callFunction({ name: 'api', data: { action, ... } })
```

成功是 `{ ok: true, ... }`。失败是 `{ ok: false, reason, message }`。前端不直接读写数据库。

| action | 作用 |
|---|---|
| `login` | 用 openid 读当前用户。返回 `bound`、`user`、`auth.configured` |
| `authStart` | 未配置时返回 `configured: false`。已配置时返回科大授权地址和 `state` |
| `authFinish` | 校验 `code` + `state`，向科大换身份，写入 `users` 和 `auth_identities` |
| `logout` | 删除当前 openid 的连接。用户记录和爽约保留 |
| `listSessions` | 报名中和已满的车 |
| `getSession` | 一场车的详情、名单、当前用户能否上车 |
| `createSession` | DM 或管理员发车 |
| `joinSession` | 上车 |
| `cancelJoin` | 标记到场前取消上车 |
| `markAttendance` | 本场 DM 或管理员，把车上每个人标成到场或爽约 |
| `setRole` | 仅管理员。`role` 只能是 `dm` 或 `player` |

临时入口：`bindUid`（自己填学号，登录页不展示）、`devLogin`（登录页「临时登录」，读 `cloudfunctions/api/devUser.js`）。统一认证接通后删掉这两个 action、`devUser.js`、登录页上的临时按钮和对应测试。对外预览前把 `devUser.js` 的 `enabled` 改成 `false`。

统一认证环境变量只放在云函数上，不写进仓库：`USTC_CLIENT_ID`、`USTC_CLIENT_SECRET`、`USTC_REDIRECT_URI`。三个都有时才访问学校接口。

## 本地

1. 用微信开发者工具导入本目录。AppID 在 `project.config.json`。
2. 云环境 ID 在 `miniprogram/config.js` 的 `envId`，当前是 `dev-d4gncw2d79d2ea51f`。
3. 改页面后，在开发者工具里编译一次。没有单独的前端构建命令。
4. 改 `cloudfunctions/api` 后，要重新上传并部署云函数，模拟器才会调到新代码。
5. 数据库四个业务集合权限设为「所有用户不可读写」。云函数用管理端权限写入。

规则测试：

```text
node --test test/domain.test.js test/ustcAuth.test.js test/devUser.test.js
```

## 范围之外

不做支付、抽签、候补、剧本库、角色槽、评分、订阅消息，也不做另一套 QQ 小程序。微信小程序在 QQ 里打开即可。研讨室是外链，不是接口。

# Gobang
后端Node.js；WebSocket推送；已实现功能：联机对战，历史对局查看，最后落子的闪烁提示，落子提示
每次进入网站即可获得一个playerId（点击网页刷新后，playerId就会发生变更），然后点击举手匹配（匹配机制是：点击举手按钮的相邻两个玩家即第一个举手的和第二个举手的会进入对局），当两个玩家都准备好后，执黑玩家计时器开始计时即对局开始。当某玩家获胜后，即将该对局信息插入数据库。点击历史对局即可查看之前的对局信息，并进行复盘。

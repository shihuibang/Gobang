const express = require('express')
const mysql = require('mysql2')
const bodyParser = require('body-parser')
const app = express();
const port = 9000
const expressWs = require('express-ws')(app)
const room = []
const users = []
 


const wsClients = {}
app.wsClients = wsClients
app.use("/public",express.static('public'))


 chessGame = [
  {
    playerId:null,
    prepare:0,
    piece:null,
    pieces:[]
  },
  {
    playerId:null,
    prepare:0,
    piece:null,
    pieces:[]
  },
  {
    turn:0,
    start_time:null,
    end_time:null,
    backMove:0
  }

]

let ready = 0

function resetChessGame(){
  chessGame = [
    {
      playerId:null,
      prepare:0,
      piece:null,
      pieces:[]
    },
    {
      playerId:null,
      prepare:0,
      piece:null,
      pieces:[]
    },
    {
      turn:0,
      start_time:null,
      end_time:null
    }
  ]
}

gameRecord = {
  startTime:null,
  endTime:null,
  winner:null,
  blackStatus:null,
  whiteStatus:null,
  blackPlayerId:null,
  whitePlayerId:null
}

function isSamePos(a, b) {
  return a[0] === b[0] && a[1] === b[1]
}
function isWin(playerPieces, pos) {
  const [r, c] = pos                  // 新落子的位置, r: 行, c: 列
  const offset = [0, 1, 2, 3, 4]
  
  // 判定 → 方向是否五子连珠?
  for(let s = c - 4; s <= c; s++) {
      if (offset.every(i => playerPieces.find(p => isSamePos(p, [r, s + i])) )) {
          return offset.map(i => [r, s + i])
      }
  }

  // 判定 ↓ 方向是否五子连珠?
  for(let s = r - 4; s <= r; s++) {
      if (offset.every(i => playerPieces.find(p => isSamePos(p, [s + i, c])) )) {
          return offset.map(i => [s + i, c])
      }
  }

  // 判定 ↘ 斜方向是否五子连珠?
  for(let sr = r - 4, sc = c - 4; sr <= r && sc <= c; sr++, sc++) {
      if (offset.every(i => playerPieces.find(p => isSamePos(p, [sr + i, sc + i])) )) {
          return offset.map(i => [sr + i, sc + i])
      }
  }
  
  // 判定 ↗ 斜方向是否五子连珠?
  for(let sr = r + 4, sc = c - 4; sr >= r && sc <= c; sr--, sc++) {
      if (offset.every(i => playerPieces.find(p => isSamePos(p, [sr - i, sc + i])) )) {
          return offset.map(i => [sr - i, sc + i])
      }
  }

  // 若以上4个方向均未构成五子连珠, 则返回false
  return false
}
// 生成随机的用户ID
function generateUserId() {
  while(true){
    const randomNum = Math.floor(Math.random() * 10000)
    let id = `player${randomNum}`
    if(users.indexOf(id) === -1){
      users.push(id)
      const chessGameMessage = [id,room.length]
      console.log("chessGameMessage:",chessGameMessage)
      return chessGameMessage
    }

  }
}

// 返回数据库连接对象
function getConnection() {
  return mysql.createConnection({
    host: 'localhost',              // MySQL所在的主机
    port: 3306,                     // MySQL监听的端口, 默认3306. 若有必要,根据自己的情况修改
    user: 'root',                   // 数据库登录名. 若有必要,根据自己的情况修改
    password: 'root',               // 数据库登录密码. 若有必要,根据自己的情况修改
    database: 'gobang',      // 数据库名称
  });
}

// 根据playerId查询棋局信息
function getUserInfoById(userId) {
  return new Promise((resolve, reject) => {
    const conn = getConnection();		// 获得连接对象
    const sql = `SELECT * FROM game WHERE black_player_id = ${userId} OR white_player_id = ${userId}`;
    conn.query(sql,function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
    conn.end();
  });
}

function getGameRecords(playerId) {
  return new Promise((resolve, reject) => {
    const conn = getConnection();		// 获得连接对象
    conn.connect((err) => {
      if (err) {
        reject(err);
        return;
      }

      const sql = `SELECT * FROM game WHERE black_player_id = ? OR white_player_id = ?`;
      const values = [playerId, playerId];
  
      conn.query(sql, values, (error, results, fields) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
        conn.end(); // 在查询完成后关闭连接
      });

    });
  });
}

function insertGameRecord(gameRecord) {
  return new Promise((resolve, reject) => {
    const conn = getConnection()

    conn.connect((err) => {
      if (err) {
        reject(err);
        return;
      }

      const sql = `INSERT INTO game (start_time, end_time, black_player_id, white_player_id, winner, black_status, white_status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        gameRecord.startTime,
        gameRecord.endTime,
        gameRecord.blackPlayerId,
        gameRecord.whitePlayerId,
        gameRecord.winner,
        JSON.stringify(gameRecord.blackStatus),
        JSON.stringify(gameRecord.whiteStatus)
      ]

      conn.query(sql, values, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.insertId);
        }
        conn.end(); // 在查询完成后关闭连接
      });
    });
  });
}




app.ws('/ws/:wid',  (ws, req) => {
  console.log("req.params.wid:::"+req.params.wid)

  if(!wsClients[req.params.wid]) {
    wsClients[req.params.wid] = []
  }
  
  // 将连接记录在连接池中
  wsClients[req.params.wid].push(ws);
  console.log('-----------------------------');
  console.log('websocket connection counts:')
    Object.keys(wsClients).forEach(key => {
        console.log(key, ':', wsClients[key].length);
    })
    console.log('-----------------------------');
  ws.onclose = () => {
      // 连接关闭时，wsClients进行清理
      wsClients[req.params.wid] = wsClients[req.params.wid].filter((client) => {
          return client !== ws;
      });
      if(wsClients[req.params.wid].length === 0) {
          delete wsClients[req.params.wid];
      }
  }
});



// 处理默认请求的路由
app.get('/', (req, res) => {
  turn = 0
  const userId = generateUserId(); // 生成用户ID
  res.send(userId); // 返回用户ID作为响应
});

let t = Math.floor(Math.random() * 2); 

app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.post('/hand', (req, res) => {
  let userId = req.body.id
  let roomId = req.body.roomId
  console.log("roomid:",roomId)
  console.log("userId:",userId)

  let piece01;

  ready = 0

if(chessGame[0].playerId == null && chessGame[1].playerId == null){   //为了防止玩家多次点击举手按钮，出现自己和自己对局的情况
  if (t === 0) {
    piece01 = 0;
    t = 1;
  } else {
    piece01 = 1;
    t = 0;
  }
  //当玩家点击举手时，由服务器随机分配谁执黑谁执白，并将传来的玩家id加入到棋局chessGame中，
  chessGame[piece01].playerId = userId //根据玩家的执子情况确定添加位置
  chessGame[piece01].prepare = 1        //并将该玩家标识为已准备
}else{
  const k = t == 1 ? 0 : 1 
  console.log("Kkkkkkkkkkkkkkk",k)
  if(chessGame[k].playerId != userId){
    if (t === 0) {
      piece01 = 0;
      t = 1;
    } else {
      piece01 = 1;
      t = 0;
    }
    chessGame[piece01].playerId = userId //根据玩家的执子情况确定添加位置
    chessGame[piece01].prepare = 1        //并将该玩家标识为已准备
  }else{
    piece01 = k
  }
}
  if(chessGame[0].prepare == 1 && chessGame[1].prepare == 1){ //若棋局中的两玩家都已经准备好了
    room.push(chessGame)//两个玩家都准备好后将该对局加入一个房间
    ready = 1   //表示棋局可以开始
    const start_date = new Date();
    const start_local_date = start_date.toLocaleString();
    gameRecord.startTime = start_local_date
    temp = piece01 == 0 ? 1 : 0
    console.log("temp:",temp)
    const readyMessage = {
      from:chessGame[piece01].playerId,
      ready:ready,
      to:chessGame[temp].playerId
    }
    //向另一个玩家推送可以开始的信息
      // 向指定客户端推送readyMessage消息
if (wsClients[readyMessage.to]) {
  wsClients[readyMessage.to].forEach((client) => {
    client.send(JSON.stringify(readyMessage));
    console.log("已推送readyMessage");
  })
}

// 向发送消息的客户端推送相同的readyMessage消息
if (wsClients[readyMessage.from]) {
  wsClients[readyMessage.from].forEach((client) => {
    client.send(JSON.stringify(readyMessage));
    console.log("已推送readyMessage");
  })
}
      resetChessGame()//重置chessGame
  }
  const readyGo = [piece01,ready]
  res.json({ readyGo }); // 返回 JSON 响应
});

app.get('/gameRecords',async  (req, res) => {
  const playerId = req.query.playerId
  console.log("查询历史对局里面的playerId",playerId)
  let gameRecordsData = {}
  
  try {
      // 查询playerId用户的信息 
    gameRecordsData = await getGameRecords(playerId)
 

    // 向前端返回数据
    res.send(gameRecordsData);
  } catch (err) {
    // 向前端返回错误信息
    res.status(500).send(err.message);
  } 
});




let turn = 0; // 初始值为0
app.use(bodyParser.json())
app.post('/turn', (req, res) => {
  const packet = req.body
  
  room[packet.roomId][packet.curPlayer].pieces.push(packet.pos)//将玩家落子位置加入相应的数组
  let temp = parseInt(packet.turn)
  // console.log("req.body"+temp)
  if (temp === 1) {
    room[packet.roomId][2].turn = 0;
  } else {
    room[packet.roomId][2].turn = 1;
  }
  const turnMesage = {
    from:packet.from,
    turn:room[packet.roomId][2].turn,
    to:packet.rival,
    pos:packet.pos
  }
  
  wsClients[packet.rival].forEach((client) => {
    client.send(JSON.stringify(turnMesage));
    console.log("已推送turnMesage")
  });
  const line = isWin(room[packet.roomId][packet.curPlayer].pieces,packet.pos)
  if(line){
    console.log("已有玩家胜出：",packet.curPlayer,"连成的五子：",line)
    const end_date = new Date();
    const end_local_date = end_date.toLocaleString();
    gameRecord.endTime = end_local_date
    gameRecord.winner = packet.from
    gameRecord.blackPlayerId = room[packet.roomId][0].playerId
    gameRecord.whitePlayerId = room[packet.roomId][1].playerId
    gameRecord.whiteStatus = room[packet.roomId][1].pieces
    gameRecord.blackStatus = room[packet.roomId][0].pieces
    insertGameRecord(gameRecord)
    .then((insertId) => {
      console.log(`Inserted game record with ID ${insertId}`);
      res.sendStatus(200);
      gameRecord = {
        startTime:null,
        endTime:null,
        winner:null,
        blackStatus:null,
        whiteStatus:null,
        blackPlayerId:null,
        whitePlayerId:null
      }
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
    const winMessage = {
      isWin:1,
      winner:packet.curPlayer,
      line:line,
    }
    if(wsClients[packet.rival]){
      wsClients[packet.rival].forEach((client) => {
        client.send(JSON.stringify(winMessage))
        console.log("已向packet.rival",packet.rival,"推送获胜消息")
      })
    }
    //向两个玩家推送获胜的消息
    if(wsClients[packet.from]){
      wsClients[packet.from].forEach((client) =>{
        client.send(JSON.stringify(winMessage))
        console.log("已向packet.from",packet.from,"推送获胜消息")
      })
    }

  }else{
    res.json({turnn:room[packet.roomId][2].turn})
  }
  
})

app.get('/getTurn', (req, res) => {
  res.json({turn}); // 返回turn变量
})

app.get('/getRoomId', (req, res) => {
  res.json({roomLength:room.length}); // 返回turn变量
})

app.post('/backMove', (req, res) => {
  const packet = req.body
  backMoveMessage = {isBackMove:1}
  
  
  wsClients[packet.to].forEach((client) => {
    client.send(JSON.stringify(backMoveMessage));
    console.log("已推送backMoveMessage")
  });

})






function broadcast(msg) {
    expressWs.getWss().clients.forEach(ws => {
        ws.send(msg)
    })
}

app.listen(port, () => {
  console.log('服务器已启动');
});
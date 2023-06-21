/**
 * 根据用户鼠标点击/移动事件触发的位置, 返回对应的落子位置
 * 棋盘上的一个单元格划分为4个区域, 根据鼠标位置相对于单元格左上角的偏移量, 确定欲落子位置
 * @param i 单元格的行号
 * @param j 单元格的列号 
 * @param $event 鼠标事件对象, 其中包含了事件触发点相对于单元格左上角的偏移量
 * @returns 落子位置, 如 [3, 2]
 */
function getPosition(i, j, $event) {
    const { offsetX, offsetY } = $event
    const r = offsetY < 20 ? i : i + 1
    const c = offsetX < 20 ? j : j + 1
    return [r, c]
}

/**
 * 判定给定的两个位置数组 a 和 b, 是否同一个棋盘上的位置
 * @param a 存储位置信息的数组, 如 [3, 2] 
 * @param b 存储位置信息的数组, 如 [3, 2] 
 * @returns 
 */
function isSamePos(a, b) {
    return a[0] === b[0] && a[1] === b[1]
}

/**
 * 判定指定位置是否为空(可落子)
 * @param pieces 当前棋盘上所有棋子
 * @param pos 待判定的位置, 如: [3, 2]
 * @returns 该位置没有棋子则返回 true, 否则返回 false
 */
function isBlank(pieces, pos) {
    return ![...pieces[0], ...pieces[1]].find(p => isSamePos(p, pos))
}

/**
 * (辅助函数) 获得当前可落子的位置, 组成一个数组 droppablePositions 返回
 * 用于当前玩家超时时, 取得可落子的位置, 随机"强行"落一子
 * 详见 timeout() 方法中的代码
 * @param pieces 当前棋盘上所有棋子
 */
function getDroppablePositions(pieces) {
    const droppablePositions = []
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            if (isBlank(pieces, [r, c])) droppablePositions.push([r, c])
        }
    }
    return droppablePositions
}

/**
 * 判定某一玩落子后是否胜利
 * 本函数以玩家新落下的棋子的位置为中心, 使用"窗口滑动"方法检查窗口内特定方向上是否有连续5颗当前玩家的棋子
 * 外层 for 循环的循环变量 s/sr/sc 为"窗口"的起始位置
 * for 循环内部的 if 语句用于检查从窗口起始位置开始的连续5个位置上是否都有玩家的棋子
 * 若满足上述条件, 则返回构成五子连珠的五颗棋子的位置组成的数组, 否则继续其它方向上的判定
 * 若四个方向上均未形成五子连珠, 则返回false
 * (连机对战版中, 输赢判定过程应置于服务端)
 * @param playerPieces 该玩家已下的棋子组成的数组(非所有玩家), 如 [ [0, 1], [2, 3], ... ]
 * @param pos   该玩家新落子的位置, 如 [3, 4]
 * @return 若未胜利返回 false, 否则返回形成五子连珠的五颗棋子的位置, 如 [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]]
 */
function isWin(playerPieces, pos) {
    const [r, c] = pos                  // 新落子的位置, r: 行, c: 列
    const offset = [0, 1, 2, 3, 4]

    // 判定 → 方向是否五子连珠?
    for (let s = c - 4; s <= c; s++) {
        if (offset.every(i => playerPieces.find(p => isSamePos(p, [r, s + i])))) {
            return offset.map(i => [r, s + i])
        }
    }

    // 判定 ↓ 方向是否五子连珠?
    for (let s = r - 4; s <= r; s++) {
        if (offset.every(i => playerPieces.find(p => isSamePos(p, [s + i, c])))) {
            return offset.map(i => [s + i, c])
        }
    }

    // 判定 ↘ 斜方向是否五子连珠?
    for (let sr = r - 4, sc = c - 4; sr <= r && sc <= c; sr++, sc++) {
        if (offset.every(i => playerPieces.find(p => isSamePos(p, [sr + i, sc + i])))) {
            return offset.map(i => [sr + i, sc + i])
        }
    }

    // 判定 ↗ 斜方向是否五子连珠?
    for (let sr = r + 4, sc = c - 4; sr >= r && sc <= c; sr--, sc++) {
        if (offset.every(i => playerPieces.find(p => isSamePos(p, [sr - i, sc + i])))) {
            return offset.map(i => [sr - i, sc + i])
        }
    }

    // 若以上4个方向均未构成五子连珠, 则返回false
    return false
}

// 等待玩家落子的最长等待时间(秒), 此处设置为10秒(可自行修改)
// 后续的代码中添加了一个计时器, 若等待超时, 则随机在空白位置"强行"落子
const maxSeconds = 30

// 计时器
let timer = null

let getReady = 0

var down = new Audio("./resource/chessdown.wav");//落子音效
var bgm = new Audio("./resource/bgm.mp3");

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// 此华丽丽的分隔线之上:
// 1. 函数为辅助类的工具函数, 通常不放在 Vue 的 methods 中, 避免"污染" 以下创建 Vue 实例的代码, 以保持代码逻辑简洁
// 2. maxSeconds, timer 两个变量并不作"绑定"之用(非响应性的), 因此未置于 Vue 数据模型中
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
let playerId = null
let rival = null //对手id
let room = null
const ws = new WebSocket("ws://localhost:9000")
const handBtn = document.getElementById('hand-btn');
let turn = 0
var socket = null


var createSocket = function () {
    if (socket) {
        socket.close();
    }
    var url = 'ws://' + window.location.host + '/ws/' + `${playerId}`;
    console.log(url)
    socket = new WebSocket(url);
    socket.onopen = function () {
        console.log('connected to ' + url);
    }
    socket.onmessage = function (event) {
        var data = JSON.parse(event.data);

    }
    socket.onclose = function () {
        console.log('close connect to' + url);
    }
};







fetch('/', {
    method: 'GET',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
})
    .then(response => response.json()) // 解析 JSON 响应
    .then(data => {
        const [id, roomLength] = data;
        console.log('Received ID:', id);
        console.log('Received Room Length:', roomLength);
        playerId = id
        myApp.roomid = roomLength
    });

function onMessage() {
    socket.onmessage = (evt) => {
        const msg = evt.data
        const parse = JSON.parse(msg)
        console.log(parse)
        if (parse.ready) {
            getReady = parse.ready
            rival = parse.to == myApp.userId ? parse.from : parse.to   
            console.log("onMessage():getReady:", getReady)
            if (getReady == 1) {
                myApp.begin()
            }
        }
        if (parse.turn != null) {
            turn = parse.turn
            if (turn == myApp.curPlayer) {
                myApp.startTimer()
            }else{
                myApp.resetTimer()
            }
            
        }

        if (parse.pos) {
            k = myApp.curPlayer == 0 ? 1 : 0
            myApp.pose = parse.pos
            myApp.pieces[k].push(parse.pos)
            down.play()
        }

        if (parse.isWin) {
            myApp.win = parse.line
            myApp.winner = parse.winner
            myApp.gameOver()
        }


    }
}







// 创建Vue应用程序实例
const app = Vue.createApp({
    // 数据模型
    data() {
        return {
            pieces: [
                [],         // 黑方已下的棋子 
                []          // 白方已下的棋子
            ],
            curPlayer: null,   // 0 表示执黑, 1 表示执白
            // turn : 0,       // 当前轮到哪个玩家落子? 0 表示黑方, 1 表示白方
            userId: playerId,
            roomid: null,
            timeLeft: maxSeconds,   // 当前玩家剩余的落子时间(秒)
            winner: null,
            win: null,              // 若某方获胜则取值为五颗连珠的棋子的位置, 如 [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]] . 否则为null, 表示无人获胜
            showModal: false,        //是否显示模态框
            chessModal:false,
            gameRecords: {},          //查询得到的历史对局记录
            pose:[],
            gameStatu:[
                [],
                []
            ],
        }
    },
    computed: {
        // 计算属性, 将剩余的落子时间格式化为 00:00 的形式, 用于视图中呈现
        timer() {
            const m = Math.floor(this.timeLeft / 60)    // 分
            const s = Math.floor(this.timeLeft % 60)    // 秒
            return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0')
        }
    },
    methods: {
        showGameRecords() {
            this.showModal = true
            console.log(" this.showModal", this.showModal)
            fetch(`/gameRecords?playerId=${this.userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            })
                .then(response => response.json()) // 解析 JSON 响应
                .then(data => {
                    const formattedData = data.map(obj => {
                        const isoDateString = obj.start_time;
                        const date = new Date(isoDateString);
                        const year = date.getFullYear();
                        const month = date.getMonth() + 1;
                        const day = date.getDate();
                        const hour = date.getHours();
                        const minute = date.getMinutes();
                        const formattedDateString = `${year}-${month}-${day} ${hour}:${minute}`;

                        return {
                            ...obj,
                            start_time: formattedDateString
                        };
                    });
                    this.gameRecords = formattedData;
                    console.log("showGameRecords里的this.gameRecords", this.gameRecords)
                })
                .catch(error => {
                    console.log(error)
                    // 在这里处理错误
                });
        },

        closeModal() {
            this.showModal = false
        },
        showChessModal(record) {
            this.chessModal = true
            this.gameStatu[0] = record.black_status
            this.gameStatu[1] = record.white_status
        },
        closeChessModal() {
            this.chessModal = false
        },
        hand() {
            // bgm.play()
            this.userId = playerId

            const userIdValue = this.userId
            const roomIdValue = this.roomid
           
            const formData = new URLSearchParams();
            formData.append('id', userIdValue)
            formData.append('roomId', roomIdValue)
            fetch('/hand', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            })
                .then(response => response.json()) // 解析 JSON 响应
                .then(data => {
                    const [bOrW, dataReady] = data.readyGo
                    console.log('Received bOrW:', bOrW);
                    console.log('Received dataReady:', dataReady);

                    this.curPlayer = bOrW
                    getReady = dataReady
                    console.log("hand fetch of getReady:", getReady)
                    if (getReady == 1) {
                        this.begin()
                    }
                });
            console.log("hand of getReady:", getReady)
            createSocket()
            onMessage()
            //   this.begin()  //看是否可以开始游戏,问题：在这调用begin方法启动计时器，此时在begin方法中去取getReady的值并不等于1
        },
        begin() {
            console.log("begin of turn:", turn)
            console.log("begin of getReady:", getReady)
            if (getReady == 1) {
                console.log("begin-if of turn:", turn)
                if (turn == this.curPlayer) {
                    this.startTimer()
                } else {
                    this.resetTimer()
                }
            }
        },

        rotation(packet) {
            fetch('/turn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(packet)
            })
                .then(response => response.json())
                .then(data => {
                    turn = data.turn
                });
        },

        getTurn() {
            fetch('/getTurn', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            })
                .then(response => response.json()) // 解析 JSON 响应
                .then(data => {
                    turn = data.turn
                });
        },



        // 棋盘格子的 mousemove 事件回调函数
        // 当鼠标在棋盘格上移动时, 实时设置鼠标的形状
        // 若可落子则鼠标呈现为手指的形状, 否则为指针形状
        onMouseMove(i, j, $event) {
            const pos = getPosition(i, j, $event)   // 参见第 9 行 getPosition() 函数
            $event.target.style.cursor = this.canDrop(pos) ? 'pointer' : 'default'
        },
        // 棋盘格子的 click 事件回调函数
        // 在棋盘格子是点击时, 若可落子, 则在离点击位置最近的交叉点处落一子
        onCellClicked(i, j, $event) {
            const pos = getPosition(i, j, $event)
            if (!this.canDrop(pos)) return;
            this.addPiece(pos)
        },
        // 是否可在pos位置落子
        // 须同时满足3个条件方可落子: 没有任何一方获胜; 指定的位置为空(可落子); 轮到当前玩家落子
        canDrop(pos) {
            return !this.win && isBlank(this.pieces, pos) && (this.curPlayer === turn)
        },
        // 在棋盘上添加一颗棋子
        // 在下代码仅为单机游戏时演示游戏实现逻辑
        // 在联机对战模式中:
        // 此函数应将落子的消息发送到服务端, 并由服务端将消息转发(推送)给另一玩家
        // 同时, 还应将判定是否胜利的代码移植到服务端, 在服务端进行判定后, 将结果推送给两个玩家
        addPiece(pos) {
            // 在当前轮到的玩家棋子数组中添加一颗棋子, 由于视图层已做绑定, 因此将呈现新添加的这颗棋子
            this.pose = pos

            console.log("addpieces pose////////////", this.pose)
            this.pieces[turn].push(pos)
            down.play()
            // this.rotation() //每当落子，turn变量都要进行轮转
            const packet = {
                from: this.userId,
                curPlayer: this.curPlayer,
                turn: turn,
                pos: pos,
                rival: rival,
                roomId: this.roomid,
                pieces: this.pieces
            }
            this.rotation(packet)
            this.resetTimer()
        },
        // 此局游戏结束
        gameOver() {
            // this.win = line         // 将形成五子连珠的棋子位置更新到 this.win 中, 配合样式表和视图层的绑定, 让五子闪烁
            this.stopTimer()        // 停止计时
        },

        resetTimer() {
            clearInterval(timer)    // 停止计时器
            timer = null            // 计时器置null
            this.timeLeft = maxSeconds       // 剩余落子时间置0
        },
        // 停止计时
        stopTimer() {
            clearInterval(timer)    // 停止计时器
            timer = null            // 计时器置null
            this.timeLeft = 0       // 剩余落子时间置0
        },
        // 启动计时器
        // 计时器每秒触发一次: 令剩余落子时间减1秒. 
        // 同时, 若剩余落子时间为0(落子超时), 则强行随机落一子. 参见 197 行 timeOut() 方法
        startTimer() {
            timer = setInterval(() => {
                // console.log("可以开始了吗？？？？",getReady)
                // this.getTurn()
                this.timeLeft--
                if (this.timeLeft <= 0) this.timeOut()
            }, 1000)
        },
        restart() {
            turn = 0
            this.win = null
            this.pieces[0] = []
            this.pieces[1] = []
            this.curPlayer = null
            this.roomid = null
            fetch('/getRoomId', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            })
                .then(response => response.json()) 
                .then(data => {
                    this.roomid = data.roomLength
                    console.log("this.restart里的roomid", this.roomid)
                    this.timeLeft = maxSeconds
                    this.winner = null
                    this.hand()
                });

            // this.startTimer()
        },
        // 落子超时, 强行随机落一子
        timeOut() {
            // 取得可落子的位置(多个位置组成的数组), 参见 42 行 getDroppablePositions() 函数
            const droppablePosition = getDroppablePositions(this.pieces)

            // 若还有可落子的位置, 则随机取一位置落子
            // 否则, 停止计时
            if (droppablePosition.length) {
                const randomIdx = Math.floor(Math.random() * droppablePosition.length)
                this.addPiece(droppablePosition[randomIdx])
            } else {
                this.stopTimer()
            }
        },

        testTimer() {
            testTimer = setInterval(() => {
                console.log("可以开始了吗？？？？", getReady)
                if (getReady == 1)
                    console.log(this.curPlayer == turn ? (this.curPlayer == 0 ? "轮到黑子下" : "轮到白子下") : "")

            }, 1000)
        }
    },
    mounted() {
        this.testTimer()       // 页面加载就绪时即启动计时器
    }
})
const myApp = app.mount('#app')




/**
 * 以上为单机版演示程序, 若改为联机对战版, 则应做一些修改:
 * 1. 初始时, 进入游戏的玩家先"举手"表示自己准备就绪, 服务器端收到2个玩家的"举手"消息后, 下发"开局"消息给两个玩家的客户端程序, 游戏正式开始. 
 *    服务器端应随机取一个玩家为执黑玩家, 另一玩家执白. 下发"开局"消息时将此信息告知两个玩家的客户端程序, 在客户端程序中作记录(赋值 this.curPlayer)
 * 2. 服务器端充当"裁判"角色, 负责推送 记录当前棋局状态外, 将当前某一玩家的落子消息推送给另一玩家, 客户端程序收到此消息后更新 this.pieces
 * 3. 任意玩家落一子, 则服务器端收到消息后, 在服务器端进行判定, 若已五子连珠则记录胜负结果, 并将消息推送给两个玩家
 */

/**
 * 评分标准: 
 * 60:      读懂上述程序, 在页面中适当位置留下你的学号和姓名, 要求和谐, 美观!!!
 * 61 - 70: 仅实现单机版功能, 仅在以上代码的基础上做了界面上的美化, 或添加少量辅助功能(或效果). 例如: 可在棋盘边沿标上数字和字母, 同时在棋盘上标记"天元"等5个位置, 参见 https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fimg.alicdn.com%2Fi2%2F201003415%2FO1CN01ihZp3E1b67A292KCn_%21%21201003415.jpg&refer=http%3A%2F%2Fimg.alicdn.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1686600983&t=3d2666937e3770eb160722c4fe730813 
 * 70 - 80: 实现"联机对战", 实现服务器端功能, 并修改客户端代码协同服务端程序实现了上述 1, 2, 3 点需求
 * 80 - 90: 构建数据库, 存储各局联机对战的结果: 每局对战开始和结束时间, 胜负情况, 以及该局结束时的棋局状态. 同时修改上述程序, 呈现多局对战的结果. 若用户选择某局历史对战, 则在棋盘上呈现该局最后的棋局状态
 * 90 - 99: 完成前述90分要求的基础上自由发挥, 实现更多"创意"功能.  
 * 
 * 以上评分标准供参考, 若某项功能实现确有亮点, 可酌情加分.
 * 
 * 以下"创意"仅抛砖引玉: 
 * 1. 实现人机对战, 但"机"应多少有点"智能"
 * 2. 将程序封装为 移动端APP / 微信小程序 / 桌面端应用, 可参看教材 15 - 17 章内容
 */


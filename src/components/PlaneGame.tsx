'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * 玩家战机接口
 * 定义玩家战机的属性和状态
 */
interface Player {
  x: number          // X坐标
  y: number          // Y坐标
  width: number      // 战机宽度
  height: number     // 战机高度
  speed: number      // 移动速度
  health: number     // 当前生命值
  maxHealth: number  // 最大生命值
  bulletSize: number // 子弹大小倍数（影响伤害）
  fireRate: number   // 射击间隔（毫秒）
  bulletCount: number // 同时发射的子弹数量
  lastShot: number   // 上次射击时间戳
}

/**
 * 子弹接口
 * 定义子弹的属性
 */
interface Bullet {
  x: number      // X坐标
  y: number      // Y坐标
  width: number  // 子弹宽度
  height: number // 子弹高度
  speed: number  // 飞行速度
  damage: number // 伤害值
  size: number   // 大小倍数
}

/**
 * 敌机接口
 * 定义敌机的属性
 */
interface Enemy {
  x: number          // X坐标
  y: number          // Y坐标
  width: number      // 敌机宽度
  height: number     // 敌机高度
  speed: number      // 移动速度
  health: number     // 当前生命值
  maxHealth: number  // 最大生命值
  type: 'small' | 'medium' | 'large' // 敌机类型
}

/**
 * 增强道具接口
 * 定义玩家可收集的道具
 */
interface PowerUp {
  x: number      // X坐标
  y: number      // Y坐标
  width: number  // 道具宽度
  height: number // 道具高度
  speed: number  // 下落速度
  type: 'size' | 'rate' | 'count' // 道具类型
}

/**
 * 爆炸特效接口
 * 定义爆炸动画的属性
 */
interface Explosion {
  x: number        // 爆炸中心X坐标
  y: number        // 爆炸中心Y坐标
  radius: number   // 当前半径
  maxRadius: number // 最大半径
  opacity: number  // 透明度（0-1）
}

/**
 * 游戏状态类型
 * 定义游戏的四种状态
 */
type GameState = 'start' | 'playing' | 'paused' | 'gameover'

// 游戏画布常量
const CANVAS_WIDTH = 600   // 画布宽度
const CANVAS_HEIGHT = 800  // 画布高度

/**
 * 飞机大战主组件
 * 使用Canvas实现2D射击游戏
 */
export default function PlaneGame() {
  // Canvas引用
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 游戏状态管理
  const [gameState, setGameState] = useState<GameState>('start') // 当前游戏状态
  const [score, setScore] = useState(0)           // 当前分数
  const [highScore, setHighScore] = useState(0)   // 历史最高分
  const [health, setHealth] = useState(100)         // 玩家生命值
  const [isNewRecord, setIsNewRecord] = useState(false) // 是否新纪录

  // 游戏循环引用
  const gameLoopRef = useRef<number>()

  // 玩家战机对象（使用ref避免不必要的重渲染）
  const playerRef = useRef<Player>({
    x: CANVAS_WIDTH / 2 - 25,
    y: CANVAS_HEIGHT - 100,
    width: 50,
    height: 50,
    speed: 6,          // 战机移动速度
    health: 100,       // 初始生命值
    maxHealth: 100,     // 最大生命值
    bulletSize: 1,      // 初始子弹大小
    fireRate: 200,     // 射击间隔200ms
    bulletCount: 1,     // 初始单发子弹
    lastShot: 0
  })

  // 游戏对象集合（使用ref存储避免重渲染）
  const bulletsRef = useRef<Bullet[]>([])      // 子弹数组
  const enemiesRef = useRef<Enemy[]>([])      // 敌机数组
  const powerUpsRef = useRef<PowerUp[]>([])   // 道具数组
  const explosionsRef = useRef<Explosion[]>([]) // 爆炸特效数组

  // 键盘输入状态跟踪
  const keysRef = useRef<{ [key: string]: boolean }>({})

  /**
   * 从API获取历史最高分
   * 在游戏启动时调用
   */
  const fetchHighScore = useCallback(async () => {
    try {
      const response = await fetch('/api/highscore')
      const data = await response.json()
      if (data.success) {
        setHighScore(data.highScore)
      }
    } catch (error) {
      console.error('Error fetching high score:', error)
    }
  }, [])

  /**
   * 更新历史最高分
   * 游戏结束时调用，自动检查是否打破纪录
   */
  const updateHighScore = useCallback(async (newScore: number) => {
    try {
      const response = await fetch('/api/highscore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ score: newScore })
      })
      const data = await response.json()
      if (data.success) {
        setHighScore(data.highScore)
        setIsNewRecord(data.isNewRecord)
      }
    } catch (error) {
      console.error('Error updating high score:', error)
    }
  }, [])

  /**
   * 重置游戏状态
   * 在开始新游戏时初始化所有游戏对象
   */
  const resetGame = useCallback(() => {
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - 25,
      y: CANVAS_HEIGHT - 100,
      width: 50,
      height: 50,
      speed: 6,
      health: 100,
      maxHealth: 100,
      bulletSize: 1,
      fireRate: 200,
      bulletCount: 1,
      lastShot: 0
    }
    bulletsRef.current = []
    enemiesRef.current = []
    powerUpsRef.current = []
    explosionsRef.current = []
    setScore(0)
    setHealth(100)
    setIsNewRecord(false)
  }, [])

  /**
   * 开始游戏
   * 重置游戏状态并切换到playing状态
   */
  const startGame = () => {
    resetGame()
    setGameState('playing')
  }

  /**
   * 生成敌机
   * 随机生成三种类型的敌机，有不同的属性
   */
  const spawnEnemy = useCallback(() => {
    const type = Math.random()
    let enemy: Enemy

    if (type < 0.6) {
      // 小型敌机：60%概率，速度快，血量低，得分10
      enemy = {
        x: Math.random() * (CANVAS_WIDTH - 40),
        y: -40,
        width: 40,
        height: 40,
        speed: 2 + Math.random() * 1.5, // 速度范围 2-3.5
        health: 20,
        maxHealth: 20,
        type: 'small'
      }
    } else if (type < 0.9) {
      // 中型敌机：30%概率，速度中等，血量中等，得分25
      enemy = {
        x: Math.random() * (CANVAS_WIDTH - 60),
        y: -60,
        width: 60,
        height: 60,
        speed: 1.5 + Math.random() * 0.5, // 速度范围 1.5-2
        health: 40,
        maxHealth: 40,
        type: 'medium'
      }
    } else {
      // 大型敌机：10%概率，速度慢，血量高，得分50
      enemy = {
        x: Math.random() * (CANVAS_WIDTH - 80),
        y: -80,
        width: 80,
        height: 80,
        speed: 1, // 固定速度1
        health: 80,
        maxHealth: 80,
        type: 'large'
      }
    }

    enemiesRef.current.push(enemy)
  }, [])

  /**
   * 生成增强道具
   * 在敌机被摧毁时随机生成（30%概率）
   */
  const spawnPowerUp = useCallback((x: number, y: number) => {
    if (Math.random() > 0.3) return // 30% chance to spawn power-up

    const types: PowerUp['type'][] = ['size', 'rate', 'count']
    const type = types[Math.floor(Math.random() * types.length)]

    powerUpsRef.current.push({
      x: x - 20,
      y: y,
      width: 40,
      height: 40,
      speed: 2, // 道具下落速度
      type
    })
  }, [])

  /**
   * 发射子弹
   * 根据玩家的bulletSize和bulletCount属性发射子弹
   */
  const shootBullet = useCallback((timestamp: number) => {
    const player = playerRef.current
    // 检查射击冷却时间
    if (timestamp - player.lastShot < player.fireRate) return

    player.lastShot = timestamp

    // 计算子弹尺寸（受bulletSize影响）
    const bulletWidth = 6 * player.bulletSize
    const bulletHeight = 12 * player.bulletSize

    // 计算多发子弹的起始位置
    const totalWidth = player.bulletCount * bulletWidth
    const startX = player.x + player.width / 2 - totalWidth / 2 + bulletWidth / 2

    // 发射多发子弹
    for (let i = 0; i < player.bulletCount; i++) {
      bulletsRef.current.push({
        x: startX + i * bulletWidth * 1.5, // 子弹间距1.5倍宽度
        y: player.y,
        width: bulletWidth,
        height: bulletHeight,
        speed: 10, // 子弹飞行速度
        damage: 10 * player.bulletSize, // 伤害随子弹大小增加
        size: player.bulletSize
      })
    }
  }, [])

  /**
   * 游戏主更新循环
   * 处理所有游戏逻辑、渲染和碰撞检测
   */
  const updateGame = useCallback((timestamp: number) => {
    const player = playerRef.current
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清空画布并填充深蓝色背景
    ctx.fillStyle = '#0a1628'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // 绘制星空背景（50个移动的星星）
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 50; i++) {
      const x = (i * 123 + timestamp * 0.02) % CANVAS_WIDTH
      const y = (i * 456 + timestamp * 0.05) % CANVAS_HEIGHT
      ctx.fillRect(x, y, 2, 2)
    }

    // 只在游戏进行时更新游戏对象
    if (gameState !== 'playing') return

    // 更新玩家位置（基于键盘输入）
    if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) {
      player.x = Math.max(0, player.x - player.speed)
    }
    if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) {
      player.x = Math.min(CANVAS_WIDTH - player.width, player.x + player.speed)
    }
    if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) {
      player.y = Math.max(0, player.y - player.speed)
    }
    if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) {
      player.y = Math.min(CANVAS_HEIGHT - player.height, player.y + player.speed)
    }

    // 自动射击
    shootBullet(timestamp)

    // 更新子弹位置并绘制
    bulletsRef.current = bulletsRef.current.filter(bullet => {
      bullet.y -= bullet.speed // 子弹向上移动

      // 绘制绿色子弹
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)

      // 移除超出屏幕的子弹
      return bullet.y > -bullet.height
    })

    // 随机生成敌机（生成概率随分数增加）
    if (Math.random() < 0.012 + score * 0.00005) {
      spawnEnemy()
    }

    // 更新敌机位置和状态
    enemiesRef.current = enemiesRef.current.filter(enemy => {
      enemy.y += enemy.speed // 敌机向下移动

      // 根据敌机类型绘制渐变色三角形
      const gradient = ctx.createLinearGradient(enemy.x, enemy.y, enemy.x, enemy.y + enemy.height)
      if (enemy.type === 'small') {
        gradient.addColorStop(0, '#ff4444') // 红色
        gradient.addColorStop(1, '#aa0000')
      } else if (enemy.type === 'medium') {
        gradient.addColorStop(0, '#ff8800') // 橙色
        gradient.addColorStop(1, '#aa5500')
      } else {
        gradient.addColorStop(0, '#aa00ff') // 紫色
        gradient.addColorStop(1, '#5500aa')
      }

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.moveTo(enemy.x + enemy.width / 2, enemy.y)
      ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height)
      ctx.lineTo(enemy.x, enemy.y + enemy.height)
      ctx.closePath()
      ctx.fill()

      // 绘制敌机血条（灰色背景+颜色填充）
      const healthPercent = enemy.health / enemy.maxHealth
      ctx.fillStyle = '#333'
      ctx.fillRect(enemy.x, enemy.y - 10, enemy.width, 5)
      ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000'
      ctx.fillRect(enemy.x, enemy.y - 10, enemy.width * healthPercent, 5)

      // 检测敌机与玩家的碰撞（AABB碰撞检测）
      if (
        player.x < enemy.x + enemy.width &&
        player.x + player.width > enemy.x &&
        player.y < enemy.y + enemy.height &&
        player.y + player.height > enemy.y
      ) {
        // 玩家受到伤害
        player.health -= 20
        setHealth(player.health)
        // 创建爆炸特效
        explosionsRef.current.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          radius: 0,
          maxRadius: 50,
          opacity: 1
        })
        // 有概率掉落道具
        spawnPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2)
        return false // 移除敌机
      }

      // 移除超出屏幕的敌机
      return enemy.y < CANVAS_HEIGHT + enemy.height
    })

    // 更新道具位置和状态
    powerUpsRef.current = powerUpsRef.current.filter(powerUp => {
      powerUp.y += powerUp.speed // 道具下落

      // 绘制旋转的道具文字
      ctx.save()
      ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2)
      ctx.rotate(timestamp * 0.005) // 旋转动画

      if (powerUp.type === 'size') {
        ctx.fillStyle = '#00ffff' // 青色
        ctx.font = 'bold 24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('SIZE', 0, 0)
      } else if (powerUp.type === 'rate') {
        ctx.fillStyle = '#ff00ff' // 紫色
        ctx.font = 'bold 24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('RATE', 0, 0)
      } else {
        ctx.fillStyle = '#ffff00' // 黄色
        ctx.font = 'bold 24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('MULT', 0, 0)
      }

      ctx.restore()

      // 检测玩家拾取道具
      if (
        player.x < powerUp.x + powerUp.width &&
        player.x + player.width > powerUp.x &&
        player.y < powerUp.y + powerUp.height &&
        player.y + player.height > powerUp.y
      ) {
        // 应用道具效果
        if (powerUp.type === 'size') {
          player.bulletSize = Math.min(2, player.bulletSize + 0.3) // 增加子弹大小（最大2倍）
        } else if (powerUp.type === 'rate') {
          player.fireRate = Math.max(50, player.fireRate - 30) // 增加射速（最快50ms）
        } else if (powerUp.type === 'count') {
          player.bulletCount = Math.min(5, player.bulletCount + 1) // 增加子弹数量（最多5发）
        }
        return false // 移除道具
      }

      // 移除超出屏幕的道具
      return powerUp.y < CANVAS_HEIGHT + powerUp.height
    })

    // 检测子弹与敌机的碰撞
    bulletsRef.current = bulletsRef.current.filter(bullet => {
      let bulletHit = false

      enemiesRef.current = enemiesRef.current.filter(enemy => {
        // AABB碰撞检测
        if (
          bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.width > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + bullet.height > enemy.y
        ) {
          // 敌机受到伤害
          enemy.health -= bullet.damage
          bulletHit = true

          // 敌机被摧毁
          if (enemy.health <= 0) {
            // 创建爆炸特效
            explosionsRef.current.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height / 2,
              radius: 0,
              maxRadius: enemy.width,
              opacity: 1
            })
            // 有概率掉落道具
            spawnPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2)

            // 根据敌机类型加分
            const points = enemy.type === 'small' ? 10 : enemy.type === 'medium' ? 25 : 50
            setScore(prev => prev + points)
            return false // 移除敌机
          }
        }
        return true // 保留未死亡的敌机
      })

      return !bulletHit // 移除已击中的子弹
    })

    // 更新爆炸特效
    explosionsRef.current = explosionsRef.current.filter(explosion => {
      explosion.radius += 3 // 扩散效果
      explosion.opacity -= 0.03 // 逐渐消失

      // 绘制半透明黄色圆形爆炸
      ctx.beginPath()
      ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 200, 0, ${explosion.opacity})`
      ctx.fill()

      return explosion.opacity > 0 // 移除完全消失的爆炸
    })

    // 绘制玩家战机（渐变色三角形）
    const playerGradient = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.height)
    playerGradient.addColorStop(0, '#00aaff') // 亮蓝色
    playerGradient.addColorStop(1, '#0055aa') // 深蓝色

    ctx.fillStyle = playerGradient
    ctx.beginPath()
    ctx.moveTo(player.x + player.width / 2, player.y) // 顶点
    ctx.lineTo(player.x + player.width, player.y + player.height) // 右下角
    ctx.lineTo(player.x + player.width / 2, player.y + player.height - 15) // 底部凹槽
    ctx.lineTo(player.x, player.y + player.height) // 左下角
    ctx.closePath()
    ctx.fill()

    // 绘制玩家血条
    ctx.fillStyle = '#333'
    ctx.fillRect(player.x - 5, player.y - 15, player.width + 10, 8)
    ctx.fillStyle = health > 50 ? '#00ff00' : health > 25 ? '#ffff00' : '#ff0000'
    ctx.fillRect(player.x - 5, player.y - 15, (player.width + 10) * (health / 100), 8)

    // 检查游戏结束条件
    if (player.health <= 0) {
      setGameState('gameover')
      updateHighScore(score) // 保存最高分
    }
  }, [gameState, score, health, shootBullet, spawnEnemy, spawnPowerUp, updateHighScore])

  /**
   * 游戏循环
   * 使用requestAnimationFrame实现流畅的60FPS动画
   */
  const gameLoop = useCallback((timestamp: number) => {
    updateGame(timestamp)
    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }, [updateGame])

  // 初始化Canvas和游戏循环
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 设置Canvas尺寸
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    // 启动游戏循环
    gameLoopRef.current = requestAnimationFrame(gameLoop)

    // 清理函数：取消动画帧
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameLoop])

  // 组件加载时获取最高分
  useEffect(() => {
    fetchHighScore()
  }, [fetchHighScore])

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true
      // 防止方向键和空格键滚动页面
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <Card className="w-full max-w-2xl bg-slate-900/50 border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white">飞机大战</CardTitle>
          <CardDescription className="text-slate-400">
            使用 WASD 或方向键控制战机 | 自动发射子弹 | 收集道具增强能力
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {/* 游戏状态显示：分数、最高分、生命值 */}
          <div className="w-full flex justify-between items-center mb-2">
            <div className="text-white text-lg font-semibold">
              分数: <span className="text-yellow-400">{score}</span>
            </div>
            <div className="text-white text-lg font-semibold">
              最高分: <span className="text-purple-400">{highScore}</span>
            </div>
            <div className="text-white text-lg font-semibold">
              生命值: <span className={health > 50 ? 'text-green-400' : health > 25 ? 'text-yellow-400' : 'text-red-400'}>{health}%</span>
            </div>
          </div>

          {/* 游戏画布容器 */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="rounded-lg border-2 border-slate-600 shadow-2xl"
            />

            {/* 开始界面 */}
            {gameState === 'start' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
                <h2 className="text-4xl font-bold text-white mb-4">飞机大战</h2>
                <p className="text-slate-300 mb-2">使用 WASD 或方向键控制战机</p>
                <p className="text-slate-300 mb-2">自动发射子弹攻击敌机</p>
                <p className="text-slate-300 mb-2">收集道具增强战斗力</p>
                <p className="text-purple-400 text-xl font-semibold mb-6">
                  历史最高分: {highScore}
                </p>
                <Button onClick={startGame} className="text-lg px-8 py-6">
                  开始游戏
                </Button>
              </div>
            )}

            {/* 游戏结束界面 */}
            {gameState === 'gameover' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
                {/* 新纪录提示（带动画） */}
                {isNewRecord && (
                  <div className="text-yellow-300 text-3xl font-bold mb-4 animate-pulse">
                    🎉 新纪录！
                  </div>
                )}
                <h2 className="text-4xl font-bold text-red-500 mb-4">游戏结束</h2>
                <p className="text-white text-xl mb-2">最终得分</p>
                <p className="text-yellow-400 text-5xl font-bold mb-4">{score}</p>
                <p className="text-purple-400 text-lg mb-6">
                  历史最高分: {highScore}
                </p>
                <Button onClick={startGame} className="text-lg px-8 py-6">
                  再玩一次
                </Button>
              </div>
            )}
          </div>

          {/* 道具说明图例 */}
          {gameState === 'playing' && (
            <div className="w-full grid grid-cols-3 gap-2 text-center text-sm">
              <div className="text-cyan-400">SIZE - 子弹变大</div>
              <div className="text-fuchsia-400">RATE - 射速加快</div>
              <div className="text-yellow-400">MULT - 多发子弹</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

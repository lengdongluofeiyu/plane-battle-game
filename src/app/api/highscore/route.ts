import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/highscore
 * 获取历史最高分
 *
 * @returns JSON响应，包含success状态和最高分
 * 成功响应格式: { success: true, highScore: number }
 * 失败响应格式: { success: false, error: string }
 */
export async function GET() {
  try {
    // 从数据库查询分数最高的记录
    const highScore = await db.gameScore.findFirst({
      orderBy: {
        score: 'desc' // 按分数降序排列
      }
    })

    // 返回最高分（如果没有记录则返回0）
    return NextResponse.json({
      success: true,
      highScore: highScore?.score || 0
    })
  } catch (error) {
    console.error('Error fetching high score:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch high score' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/highscore
 * 更新历史最高分
 *
 * 请求体格式: { score: number }
 *
 * @returns JSON响应，包含success状态、最新最高分和是否新纪录
 * 成功响应格式: { success: true, highScore: number, isNewRecord: boolean }
 * 失败响应格式: { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 解析请求体获取分数
    const body = await request.json()
    const { score } = body

    // 验证分数数据
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid score' },
        { status: 400 }
      )
    }

    // 获取当前最高分
    const currentHighScore = await db.gameScore.findFirst({
      orderBy: {
        score: 'desc'
      }
    })

    // 判断是否需要更新最高分
    if (!currentHighScore || score > currentHighScore.score) {
      // 新分数更高，创建新的最高分记录
      const newHighScore = await db.gameScore.create({
        data: {
          score
        }
      })

      return NextResponse.json({
        success: true,
        highScore: newHighScore.score,
        isNewRecord: true // 标记为新纪录
      })
    }

    // 分数没有超过最高分
    return NextResponse.json({
      success: true,
      highScore: currentHighScore.score,
      isNewRecord: false // 标记为非新纪录
    })
  } catch (error) {
    console.error('Error updating high score:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update high score' },
      { status: 500 }
    )
  }
}

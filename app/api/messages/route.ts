import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

interface Message {
  id: string
  text: string
  timestamp: Date
  channel: string
  source: string
  type: "emergency" | "normal"
  deviceId?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const channel = searchParams.get("channel")
    const deviceId = searchParams.get("deviceId")

    const db = await getDatabase()

    // Build query
    const query: any = {}
    if (channel) {
      query.channel = channel
    }
    if (deviceId) {
      query.$or = [{ source: deviceId }, { channel: "broadcast" }, { channel: "mcr-to-engine" }, { type: "emergency" }]
    }

    const messages = await db.collection("messages").find(query).sort({ timestamp: -1 }).limit(limit).toArray()

    return NextResponse.json({
      success: true,
      messages: messages.reverse(), // Return in chronological order
      count: messages.length,
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch messages",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const messageData = await request.json()

    // Validate message
    if (!messageData.text || !messageData.source) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid message format - text and source required",
        },
        { status: 400 },
      )
    }

    const message: Message = {
      id: messageData.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: messageData.text.trim(),
      timestamp: new Date(messageData.timestamp || Date.now()),
      channel: messageData.channel || "broadcast",
      source: messageData.source,
      type: messageData.type || "normal",
      deviceId: messageData.deviceId,
    }

    const db = await getDatabase()
    await db.collection("messages").insertOne(message)

    // Keep only last 1000 messages to prevent database bloat
    const messageCount = await db.collection("messages").countDocuments()
    if (messageCount > 1000) {
      const oldMessages = await db
        .collection("messages")
        .find({})
        .sort({ timestamp: 1 })
        .limit(messageCount - 1000)
        .toArray()

      const oldIds = oldMessages.map((msg) => msg._id)
      await db.collection("messages").deleteMany({ _id: { $in: oldIds } })
    }

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error("Error saving message:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process message",
      },
      { status: 500 },
    )
  }
}

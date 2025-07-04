import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deviceId = params.id

    const db = await getDatabase()

    // Update device status to offline instead of deleting
    const result = await db.collection("devices").updateOne(
      { id: deviceId },
      {
        $set: {
          status: "offline",
          lastSeen: new Date(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Device not found",
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `Device ${deviceId} disconnected`,
    })
  } catch (error) {
    console.error("Error disconnecting device:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to disconnect device",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deviceId = params.id
    const updateData = await request.json()

    const db = await getDatabase()

    // Update device with heartbeat
    const result = await db.collection("devices").updateOne(
      { id: deviceId },
      {
        $set: {
          ...updateData,
          lastSeen: new Date(),
          status: "online",
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Device not found",
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `Device ${deviceId} updated`,
    })
  } catch (error) {
    console.error("Error updating device:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update device",
      },
      { status: 500 },
    )
  }
}

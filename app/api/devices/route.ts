import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

interface Device {
  id: string
  name: string
  type: "mcr" | "engine" | "remote" | "handheld"
  status: "online" | "offline"
  lastSeen: Date
  language?: string
}

export async function GET() {
  try {
    const db = await getDatabase()

    // Get all devices, prioritizing online ones
    const devices = await db.collection("devices").find({}).sort({ status: -1, lastSeen: -1 }).toArray()

    // Filter out devices that haven't been seen in the last 2 minutes
    const now = new Date()
    const activeDevices = devices.filter((device) => {
      const lastSeen = new Date(device.lastSeen)
      const timeDiff = now.getTime() - lastSeen.getTime()
      return timeDiff < 120000 // 2 minutes
    })

    return NextResponse.json({
      success: true,
      devices: activeDevices,
      total: activeDevices.length,
    })
  } catch (error) {
    console.error("Error fetching devices:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch devices",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const deviceData = await request.json()

    // Validate device
    if (!deviceData.id || !deviceData.name || !deviceData.type) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid device format - id, name, and type required",
        },
        { status: 400 },
      )
    }

    const device: Device = {
      id: deviceData.id,
      name: deviceData.name,
      type: deviceData.type,
      status: "online",
      lastSeen: new Date(),
      language: deviceData.language || "en-US",
    }

    const db = await getDatabase()
    await db.collection("devices").updateOne({ id: device.id }, { $set: device }, { upsert: true })

    return NextResponse.json({
      success: true,
      device,
    })
  } catch (error) {
    console.error("Error registering device:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to register device",
      },
      { status: 500 },
    )
  }
}

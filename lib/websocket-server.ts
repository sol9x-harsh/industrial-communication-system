import { Server as SocketIOServer } from "socket.io"
import type { Server as HTTPServer } from "http"
import { getDatabase } from "./mongodb"

interface ConnectedDevice {
  id: string
  name: string
  type: "mcr" | "engine" | "remote" | "handheld"
  status: "online" | "offline"
  socketId: string
  lastSeen: Date
  language?: string
}

interface Message {
  id: string
  text: string
  timestamp: Date
  channel: string
  source: string
  type: "emergency" | "normal"
  deviceId?: string
}

class WebSocketManager {
  private io: SocketIOServer | null = null
  private connectedDevices: Map<string, ConnectedDevice> = new Map()

  initialize(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    })

    this.io.on("connection", (socket) => {
      console.log("Client connected:", socket.id)

      // Handle device registration
      socket.on("register-device", async (deviceInfo: Omit<ConnectedDevice, "socketId" | "lastSeen">) => {
        try {
          const device: ConnectedDevice = {
            ...deviceInfo,
            socketId: socket.id,
            lastSeen: new Date(),
            status: "online",
          }

          // Store in memory
          this.connectedDevices.set(device.id, device)

          // Store in MongoDB
          const db = await getDatabase()
          await db.collection("devices").updateOne({ id: device.id }, { $set: device }, { upsert: true })

          // Join device-specific room
          socket.join(device.id)
          socket.join(device.type)

          // Notify all clients about new device
          this.io?.emit("device-connected", device)

          // Send current connected devices to the new client
          socket.emit("connected-devices", Array.from(this.connectedDevices.values()))

          console.log(`Device registered: ${device.id} (${device.type})`)
        } catch (error) {
          console.error("Error registering device:", error)
          socket.emit("error", "Failed to register device")
        }
      })

      // Handle message sending
      socket.on("send-message", async (messageData: Omit<Message, "id" | "timestamp">) => {
        try {
          const message: Message = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            ...messageData,
          }

          // Store in MongoDB
          const db = await getDatabase()
          await db.collection("messages").insertOne(message)

          // Broadcast message to all connected devices instantly
          this.io?.emit("new-message", message)

          // Special handling for emergency messages
          if (message.type === "emergency") {
            this.io?.emit("emergency-alert", message)
          }

          console.log(`Message sent from ${message.source}: ${message.text.substring(0, 50)}...`)
        } catch (error) {
          console.error("Error sending message:", error)
          socket.emit("error", "Failed to send message")
        }
      })

      // Handle device heartbeat
      socket.on("heartbeat", (deviceId: string) => {
        const device = this.connectedDevices.get(deviceId)
        if (device) {
          device.lastSeen = new Date()
          this.connectedDevices.set(deviceId, device)
        }
      })

      // Handle emergency stop
      socket.on("stop-emergency", async (deviceId: string) => {
        try {
          const message: Message = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: `Emergency alert stopped by ${deviceId}`,
            timestamp: new Date(),
            channel: "emergency-control",
            source: deviceId,
            type: "normal",
          }

          // Store in MongoDB
          const db = await getDatabase()
          await db.collection("messages").insertOne(message)

          // Broadcast emergency stop to all devices
          this.io?.emit("emergency-stopped", { deviceId, message })
        } catch (error) {
          console.error("Error stopping emergency:", error)
        }
      })

      // Handle disconnection
      socket.on("disconnect", async () => {
        try {
          // Find and remove disconnected device
          let disconnectedDevice: ConnectedDevice | null = null
          for (const [deviceId, device] of this.connectedDevices.entries()) {
            if (device.socketId === socket.id) {
              disconnectedDevice = device
              this.connectedDevices.delete(deviceId)
              break
            }
          }

          if (disconnectedDevice) {
            // Update in MongoDB
            const db = await getDatabase()
            await db
              .collection("devices")
              .updateOne({ id: disconnectedDevice.id }, { $set: { status: "offline", lastSeen: new Date() } })

            // Notify all clients about disconnection
            this.io?.emit("device-disconnected", disconnectedDevice.id)

            console.log(`Device disconnected: ${disconnectedDevice.id}`)
          }
        } catch (error) {
          console.error("Error handling disconnection:", error)
        }
      })
    })

    // Clean up inactive devices every 30 seconds
    setInterval(() => {
      this.cleanupInactiveDevices()
    }, 30000)

    console.log("WebSocket server initialized")
  }

  private async cleanupInactiveDevices() {
    const now = new Date()
    const inactiveThreshold = 60000 // 1 minute

    for (const [deviceId, device] of this.connectedDevices.entries()) {
      if (now.getTime() - device.lastSeen.getTime() > inactiveThreshold) {
        this.connectedDevices.delete(deviceId)

        try {
          // Update in MongoDB
          const db = await getDatabase()
          await db
            .collection("devices")
            .updateOne({ id: deviceId }, { $set: { status: "offline", lastSeen: new Date() } })

          // Notify all clients
          this.io?.emit("device-disconnected", deviceId)

          console.log(`Cleaned up inactive device: ${deviceId}`)
        } catch (error) {
          console.error("Error cleaning up device:", error)
        }
      }
    }
  }

  getConnectedDevices(): ConnectedDevice[] {
    return Array.from(this.connectedDevices.values())
  }

  getIO(): SocketIOServer | null {
    return this.io
  }
}

export const wsManager = new WebSocketManager()

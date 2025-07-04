"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, type Socket } from "socket.io-client"

interface Message {
  id: string
  text: string
  timestamp: string
  channel: string
  source: string
  type: "emergency" | "normal"
  deviceId?: string
}

interface ConnectedDevice {
  id: string
  name: string
  type: "mcr" | "engine" | "remote" | "handheld"
  status: "online" | "offline"
  lastSeen: string
  language?: string
}

interface UseWebSocketReturn {
  socket: Socket | null
  isConnected: boolean
  connectedDevices: ConnectedDevice[]
  messages: Message[]
  sendMessage: (message: Omit<Message, "id" | "timestamp">) => void
  registerDevice: (device: Omit<ConnectedDevice, "lastSeen" | "status">) => void
  emergencyAlert: Message | null
  clearEmergencyAlert: () => void
}

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [emergencyAlert, setEmergencyAlert] = useState<Message | null>(null)

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Initialize WebSocket connection
  useEffect(() => {
    const connectSocket = () => {
      console.log("🔌 Connecting to WebSocket...")

      // Use the same host but different port (3000 for WebSocket server)
      const wsUrl = typeof window !== 'undefined' 
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3000`
        : 'ws://localhost:3000';

      const socketInstance = io(wsUrl, {
        transports: ["websocket", "polling"],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      })

      socketInstance.on("connect", () => {
        console.log("✅ WebSocket connected:", socketInstance.id)
        setIsConnected(true)
        reconnectAttempts.current = 0

        // Re-register device if we have one
        if (deviceIdRef.current) {
          // Re-register after reconnection
          setTimeout(() => {
            if (deviceIdRef.current) {
              const deviceInfo = JSON.parse(localStorage.getItem("deviceInfo") || "{}")
              if (deviceInfo.id) {
                socketInstance.emit("register-device", deviceInfo)
              }
            }
          }, 1000)
        }
      })

      socketInstance.on("disconnect", (reason) => {
        console.log("🔌 WebSocket disconnected:", reason)
        setIsConnected(false)
      })

      socketInstance.on("connect_error", (error) => {
        console.error("❌ WebSocket connection error:", error)
        reconnectAttempts.current++

        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error("❌ Max reconnection attempts reached")
        }
      })

      socketInstance.on("connected-devices", (devices: ConnectedDevice[]) => {
        console.log("📱 Connected devices updated:", devices.length)
        setConnectedDevices(devices)
      })

      socketInstance.on("device-connected", (device: ConnectedDevice) => {
        console.log("📱 Device connected:", device.id)
        setConnectedDevices((prev) => {
          const filtered = prev.filter((d) => d.id !== device.id)
          return [...filtered, device]
        })
      })

      socketInstance.on("device-disconnected", (deviceId: string) => {
        console.log("📱 Device disconnected:", deviceId)
        setConnectedDevices((prev) => prev.filter((d) => d.id !== deviceId))
      })

      socketInstance.on("new-message", (message: Message) => {
        console.log("📨 New message received:", message.source)
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== message.id)
          return [...filtered, message].slice(-100) // Keep last 100 messages
        })
      })

      socketInstance.on("emergency-alert", (message: Message) => {
        console.log("🚨 Emergency alert received!")
        setEmergencyAlert(message)

        // Auto-clear emergency after 2 minutes
        setTimeout(() => {
          setEmergencyAlert(null)
        }, 120000)
      })

      socketInstance.on("emergency-stopped", ({ deviceId, message }: { deviceId: string; message: Message }) => {
        console.log("🛑 Emergency stopped by:", deviceId)
        setEmergencyAlert(null)
        setMessages((prev) => [...prev, message].slice(-100))
      })

      socketInstance.on("error", (error: string) => {
        console.error("❌ WebSocket error:", error)
      })

      setSocket(socketInstance)
      return socketInstance
    }

    const socketInstance = connectSocket()

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
      socketInstance.disconnect()
    }
  }, [])

  // Send message function
  const sendMessage = useCallback(
    (message: Omit<Message, "id" | "timestamp">) => {
      if (socket && isConnected) {
        console.log("📤 Sending message:", message.text.substring(0, 30) + "...")
        socket.emit("send-message", message)
      } else {
        console.warn("⚠️ Cannot send message: Socket not connected")
      }
    },
    [socket, isConnected],
  )

  // Register device function
  const registerDevice = useCallback(
    (device: Omit<ConnectedDevice, "lastSeen" | "status">) => {
      if (socket && isConnected) {
        console.log("📱 Registering device:", device.id)
        deviceIdRef.current = device.id

        // Store device info for reconnection
        localStorage.setItem("deviceInfo", JSON.stringify(device))

        socket.emit("register-device", device)

        // Start heartbeat
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current)
        }

        heartbeatRef.current = setInterval(() => {
          if (socket && isConnected && deviceIdRef.current) {
            socket.emit("heartbeat", deviceIdRef.current)
          }
        }, 30000) // Send heartbeat every 30 seconds
      } else {
        console.warn("⚠️ Cannot register device: Socket not connected")
      }
    },
    [socket, isConnected],
  )

  // Clear emergency alert
  const clearEmergencyAlert = useCallback(() => {
    if (socket && isConnected && deviceIdRef.current) {
      console.log("🛑 Stopping emergency alert")
      socket.emit("stop-emergency", deviceIdRef.current)
    }
    setEmergencyAlert(null)
  }, [socket, isConnected])

  return {
    socket,
    isConnected,
    connectedDevices,
    messages,
    sendMessage,
    registerDevice,
    emergencyAlert,
    clearEmergencyAlert,
  }
}

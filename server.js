require('dotenv').config({ path: '.env.local' });
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
let db = null;

// Connected devices storage
const connectedDevices = new Map();

async function connectToDatabase() {
  try {
    const client = new MongoClient(MONGODB_URI, {
      ssl: true,
      serverApi: '1',
    });
    await client.connect();
    db = client.db('industrial_comm_system');
    console.log('✅ Connected to MongoDB');

    // Create indexes for better performance
    await db.collection('messages').createIndex({ timestamp: -1 });
    await db.collection('messages').createIndex({ channel: 1 });
    await db.collection('devices').createIndex({ id: 1 }, { unique: true });

    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

app.prepare().then(async () => {
  // Connect to MongoDB first
  await connectToDatabase();

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handler(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Handle device registration
    socket.on('register-device', async (deviceInfo) => {
      try {
        const device = {
          ...deviceInfo,
          socketId: socket.id,
          lastSeen: new Date(),
          status: 'online',
        };

        // Store in memory for fast access
        connectedDevices.set(device.id, device);

        // Store in MongoDB
        await db
          .collection('devices')
          .updateOne({ id: device.id }, { $set: device }, { upsert: true });

        // Join device-specific room
        socket.join(device.id);
        socket.join(device.type);

        // Send current connected devices to new client
        socket.emit('connected-devices', Array.from(connectedDevices.values()));

        // Notify all clients about new device
        socket.broadcast.emit('device-connected', device);

        console.log(`✅ Device registered: ${device.id} (${device.type})`);
      } catch (error) {
        console.error('❌ Error registering device:', error);
        socket.emit('error', 'Failed to register device');
      }
    });

    // Handle message sending
    socket.on('send-message', async (messageData) => {
      try {
        const message = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date(),
          ...messageData,
        };

        // Store in MongoDB
        await db.collection('messages').insertOne(message);

        // Broadcast to all connected clients immediately
        io.emit('new-message', message);

        // Special handling for emergency messages
        if (message.type === 'emergency') {
          io.emit('emergency-alert', message);
        }

        console.log(
          `📨 Message from ${message.source}: ${message.text.substring(
            0,
            50
          )}...`
        );
      } catch (error) {
        console.error('❌ Error sending message:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Handle heartbeat
    socket.on('heartbeat', async (deviceId) => {
      const device = connectedDevices.get(deviceId);
      if (device) {
        device.lastSeen = new Date();
        connectedDevices.set(deviceId, device);

        // Update in MongoDB
        try {
          await db
            .collection('devices')
            .updateOne(
              { id: deviceId },
              { $set: { lastSeen: new Date(), status: 'online' } }
            );
        } catch (error) {
          console.error('❌ Error updating heartbeat:', error);
        }
      }
    });

    // Handle emergency stop
    socket.on('stop-emergency', async (deviceId) => {
      try {
        const message = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          text: `Emergency alert stopped by ${deviceId}`,
          timestamp: new Date(),
          channel: 'emergency-control',
          source: deviceId,
          type: 'normal',
        };

        await db.collection('messages').insertOne(message);
        io.emit('emergency-stopped', { deviceId, message });

        console.log(`🛑 Emergency stopped by ${deviceId}`);
      } catch (error) {
        console.error('❌ Error stopping emergency:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        // Find and remove disconnected device
        let disconnectedDevice = null;
        for (const [deviceId, device] of connectedDevices.entries()) {
          if (device.socketId === socket.id) {
            disconnectedDevice = device;
            connectedDevices.delete(deviceId);
            break;
          }
        }

        if (disconnectedDevice) {
          // Update in MongoDB
          await db
            .collection('devices')
            .updateOne(
              { id: disconnectedDevice.id },
              { $set: { status: 'offline', lastSeen: new Date() } }
            );

          // Notify all clients
          socket.broadcast.emit('device-disconnected', disconnectedDevice.id);

          console.log(`🔌 Device disconnected: ${disconnectedDevice.id}`);
        }
      } catch (error) {
        console.error('❌ Error handling disconnection:', error);
      }
    });
  });

  // Clean up inactive devices every 30 seconds
  setInterval(async () => {
    const now = new Date();
    const inactiveThreshold = 60000; // 1 minute

    for (const [deviceId, device] of connectedDevices.entries()) {
      if (now.getTime() - device.lastSeen.getTime() > inactiveThreshold) {
        connectedDevices.delete(deviceId);

        try {
          await db
            .collection('devices')
            .updateOne(
              { id: deviceId },
              { $set: { status: 'offline', lastSeen: new Date() } }
            );

          io.emit('device-disconnected', deviceId);
          console.log(`🧹 Cleaned up inactive device: ${deviceId}`);
        } catch (error) {
          console.error('❌ Error cleaning up device:', error);
        }
      }
    }
  }, 30000);

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🚀 Server ready on http://${hostname}:${port}`);
    console.log(`🔌 WebSocket server ready`);
    console.log(`📊 MongoDB connected and ready`);
  });
});

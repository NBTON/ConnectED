const { ChatMessage, Notification, Event, FileShare, UserPresence, User, GroupMember } = require('./models/db_schema')
const crypto = require('crypto-js')

// Store active users and their socket IDs
const activeUsers = new Map()
const typingUsers = new Map()

function initializeSocket(io) {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication error'))
      }

      // Verify user session/token (simplified - you might want to use JWT or session)
      const userId = socket.handshake.auth.userId
      if (!userId) {
        return next(new Error('User ID required'))
      }

      // Check if user exists
      const user = await User.findById(userId)
      if (!user) {
        return next(new Error('User not found'))
      }

      socket.userId = userId
      socket.username = user.username
      next()
    } catch (error) {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`User ${socket.username} connected with socket ${socket.id}`)

    // Update user presence
    updateUserPresence(socket.userId, 'online', socket.id)

    // Join user to their personal room for notifications
    socket.join(`user_${socket.userId}`)

    // Handle joining chat rooms
    socket.on('join_room', async (data) => {
      const { roomId, roomType } = data

      try {
        // Verify user has access to the room
        if (roomType === 'group') {
          const membership = await GroupMember.findOne({
            groupId: roomId,
            userId: socket.userId
          })
          if (!membership) {
            socket.emit('error', { message: 'Access denied to group' })
            return
          }
        }

        socket.join(roomId)
        socket.currentRoom = roomId

        // Update user presence with current room
        await UserPresence.findOneAndUpdate(
          { userId: socket.userId },
          { currentRoom: roomId },
          { upsert: true }
        )

        // Send recent messages
        const messages = await ChatMessage.find({ roomId })
          .populate('senderId', 'username profile.avatar')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean()

        socket.emit('room_history', messages.reverse())

        // Notify others in room
        socket.to(roomId).emit('user_joined', {
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date()
        })

      } catch (error) {
        socket.emit('error', { message: 'Failed to join room' })
      }
    })

    // Handle leaving chat rooms
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId)
      socket.currentRoom = null

      socket.to(roomId).emit('user_left', {
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date()
      })
    })

    // Handle chat messages
    socket.on('send_message', async (data) => {
      const { roomId, content, messageType = 'text', replyTo } = data

      try {
        // Encrypt message content if needed
        const encrypted = crypto.AES.encrypt(content, process.env.ENCRYPTION_KEY || 'default_key').toString()

        const message = new ChatMessage({
          roomId,
          roomType: roomId.startsWith('group_') ? 'group' : 'course',
          senderId: socket.userId,
          content: encrypted,
          messageType,
          encrypted: true,
          replyTo
        })

        await message.save()
        await message.populate('senderId', 'username profile.avatar')

        // Decrypt for sending back
        message.content = crypto.AES.decrypt(message.content, process.env.ENCRYPTION_KEY || 'default_key').toString(crypto.enc.Utf8)

        io.to(roomId).emit('new_message', message)

        // Create notification for other users in room
        const roomSockets = await io.in(roomId).fetchSockets()
        const recipientIds = roomSockets
          .filter(s => s.userId !== socket.userId)
          .map(s => s.userId)

        for (const recipientId of recipientIds) {
          const notification = new Notification({
            recipientId,
            type: 'message',
            title: `New message from ${socket.username}`,
            content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            data: { roomId, messageId: message._id },
            actionUrl: `/groups/${roomId.replace('group_', '')}`
          })
          await notification.save()

          io.to(`user_${recipientId}`).emit('notification', notification)
        }

      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Handle typing indicators
    socket.on('typing_start', (roomId) => {
      if (!typingUsers.has(roomId)) {
        typingUsers.set(roomId, new Set())
      }
      typingUsers.get(roomId).add(socket.userId)

      socket.to(roomId).emit('typing_users', {
        roomId,
        users: Array.from(typingUsers.get(roomId)).map(id => ({ id, username: getUsernameById(id) }))
      })
    })

    socket.on('typing_stop', (roomId) => {
      if (typingUsers.has(roomId)) {
        typingUsers.get(roomId).delete(socket.userId)

        socket.to(roomId).emit('typing_users', {
          roomId,
          users: Array.from(typingUsers.get(roomId)).map(id => ({ id, username: getUsernameById(id) }))
        })
      }
    })

    // Handle presence updates
    socket.on('update_presence', async (status) => {
      await updateUserPresence(socket.userId, status, socket.id)
      io.emit('presence_update', {
        userId: socket.userId,
        username: socket.username,
        status,
        timestamp: new Date()
      })
    })

    // Handle file sharing
    socket.on('share_file', async (data) => {
      const { roomId, fileData } = data

      try {
        const fileShare = new FileShare({
          ...fileData,
          roomId,
          roomType: roomId.startsWith('group_') ? 'group' : 'course',
          uploadedBy: socket.userId
        })

        await fileShare.save()

        io.to(roomId).emit('file_shared', fileShare)

      } catch (error) {
        socket.emit('error', { message: 'Failed to share file' })
      }
    })

    // Handle event creation/updates
    socket.on('create_event', async (eventData) => {
      try {
        const event = new Event({
          ...eventData,
          organizerId: socket.userId
        })

        await event.save()

        // Notify relevant users
        if (event.groupId) {
          io.to(`group_${event.groupId}`).emit('event_created', event)
        } else {
          io.emit('event_created', event)
        }

      } catch (error) {
        socket.emit('error', { message: 'Failed to create event' })
      }
    })

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.username} disconnected`)

      // Remove from typing users
      if (socket.currentRoom && typingUsers.has(socket.currentRoom)) {
        typingUsers.get(socket.currentRoom).delete(socket.userId)
      }

      // Update presence to offline
      await updateUserPresence(socket.userId, 'offline')

      // Notify others
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('user_left', {
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date()
        })
      }

      io.emit('presence_update', {
        userId: socket.userId,
        username: socket.username,
        status: 'offline',
        timestamp: new Date()
      })
    })
  })
}

async function updateUserPresence(userId, status, socketId = null) {
  try {
    await UserPresence.findOneAndUpdate(
      { userId },
      {
        status,
        lastSeen: new Date(),
        socketId
      },
      { upsert: true }
    )
  } catch (error) {
    console.error('Failed to update user presence:', error)
  }
}

function getUsernameById(userId) {
  // This is a simplified version - in production you'd cache this
  return activeUsers.get(userId) || 'Unknown User'
}

module.exports = { initializeSocket }
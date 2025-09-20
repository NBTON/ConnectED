class SocketManager {
  constructor() {
    this.socket = null
    this.currentRoom = null
    this.typingTimeout = null
    this.isConnected = false
  }

  connect(userId, token) {
    if (this.socket) {
      this.socket.disconnect()
    }

    this.socket = io({
      auth: {
        token: token,
        userId: userId
      }
    })

    this.setupEventListeners()
    return this.socket
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server')
      this.isConnected = true
      this.emit('socket_connected')
    })

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server')
      this.isConnected = false
      this.emit('socket_disconnected')
    })

    this.socket.on('new_message', (message) => {
      this.emit('new_message', message)
    })

    this.socket.on('user_joined', (data) => {
      this.emit('user_joined', data)
    })

    this.socket.on('user_left', (data) => {
      this.emit('user_left', data)
    })

    this.socket.on('typing_users', (data) => {
      this.emit('typing_users', data)
    })

    this.socket.on('notification', (notification) => {
      this.emit('notification', notification)
      this.showNotification(notification)
    })

    this.socket.on('presence_update', (data) => {
      this.emit('presence_update', data)
    })

    this.socket.on('file_shared', (file) => {
      this.emit('file_shared', file)
    })

    this.socket.on('event_created', (event) => {
      this.emit('event_created', event)
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
      this.emit('socket_error', error)
    })
  }

  joinRoom(roomId, roomType) {
    if (this.socket && this.isConnected) {
      this.currentRoom = roomId
      this.socket.emit('join_room', { roomId, roomType })
    }
  }

  leaveRoom(roomId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_room', roomId)
      this.currentRoom = null
    }
  }

  sendMessage(content, messageType = 'text', replyTo = null) {
    if (this.socket && this.isConnected && this.currentRoom) {
      this.socket.emit('send_message', {
        roomId: this.currentRoom,
        content,
        messageType,
        replyTo
      })
    }
  }

  startTyping() {
    if (this.socket && this.isConnected && this.currentRoom) {
      this.socket.emit('typing_start', this.currentRoom)

      // Clear existing timeout
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout)
      }

      // Stop typing after 3 seconds of inactivity
      this.typingTimeout = setTimeout(() => {
        this.stopTyping()
      }, 3000)
    }
  }

  stopTyping() {
    if (this.socket && this.isConnected && this.currentRoom) {
      this.socket.emit('typing_stop', this.currentRoom)
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout)
        this.typingTimeout = null
      }
    }
  }

  updatePresence(status) {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_presence', status)
    }
  }

  shareFile(fileData) {
    if (this.socket && this.isConnected && this.currentRoom) {
      this.socket.emit('share_file', {
        roomId: this.currentRoom,
        fileData
      })
    }
  }

  createEvent(eventData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('create_event', eventData)
    }
  }

  showNotification(notification) {
    // Create notification element
    const notificationEl = document.createElement('div')
    notificationEl.className = 'notification-toast'
    notificationEl.innerHTML = `
      <div class="notification-content">
        <h4>${notification.title}</h4>
        <p>${notification.content}</p>
      </div>
      <button class="notification-close">&times;</button>
    `

    // Add to page
    document.body.appendChild(notificationEl)

    // Add close functionality
    notificationEl.querySelector('.notification-close').addEventListener('click', () => {
      notificationEl.remove()
    })

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notificationEl.parentNode) {
        notificationEl.remove()
      }
    }, 5000)
  }

  // Event emitter functionality
  events = {}

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data))
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }
}

// Create global instance
const socketManager = new SocketManager()

// Make it globally available
window.SocketManager = SocketManager
window.socketManager = socketManager
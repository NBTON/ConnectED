const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const { ChatMessage, Notification, Event, FileShare, UserPresence } = require('../models/db_schema')
const { requireAuth } = require('../middleware/auth')

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

// Get chat messages for a room
router.get('/chat/:roomId/messages', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params
    const { page = 1, limit = 50 } = req.query

    const messages = await ChatMessage.find({ roomId })
      .populate('senderId', 'username profile.avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()

    const total = await ChatMessage.countDocuments({ roomId })

    res.json({
      messages: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// Get user notifications
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query

    const query = { recipientId: req.user.id }
    if (unreadOnly === 'true') {
      query.read = false
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()

    const total = await Notification.countDocuments(query)

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// Mark notification as read
router.put('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id },
      { read: true, readAt: new Date() },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    res.json(notification)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' })
  }
})

// Mark all notifications as read
router.put('/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user.id, read: false },
      { read: true, readAt: new Date() }
    )

    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' })
  }
})

// Upload file
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url: `/uploads/${req.file.filename}`
    }

    res.json(fileData)
  } catch (error) {
    res.status(500).json({ error: 'File upload failed' })
  }
})

// Get events
router.get('/events', requireAuth, async (req, res) => {
  try {
    const { start, end, groupId } = req.query

    const query = { organizerId: req.user.id }
    if (groupId) query.groupId = groupId
    if (start && end) {
      query.startTime = { $gte: new Date(start) }
      query.endTime = { $lte: new Date(end) }
    }

    const events = await Event.find(query)
      .populate('organizerId', 'username')
      .populate('groupId', 'name')
      .sort({ startTime: 1 })

    res.json(events)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

// Create event
router.post('/events', requireAuth, async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      organizerId: req.user.id
    }

    const event = new Event(eventData)
    await event.save()

    await event.populate('organizerId', 'username')
    await event.populate('groupId', 'name')

    res.status(201).json(event)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' })
  }
})

// Update event
router.put('/events/:id', requireAuth, async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizerId: req.user.id },
      req.body,
      { new: true }
    ).populate('organizerId', 'username').populate('groupId', 'name')

    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    res.json(event)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' })
  }
})

// Delete event
router.delete('/events/:id', requireAuth, async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({
      _id: req.params.id,
      organizerId: req.user.id
    })

    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    res.json({ message: 'Event deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' })
  }
})

// Get user presence
router.get('/presence', requireAuth, async (req, res) => {
  try {
    const presence = await UserPresence.find({})
      .populate('userId', 'username profile.avatar')
      .lean()

    res.json(presence)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch presence data' })
  }
})

// Get files for a room
router.get('/files/:roomId', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params
    const { page = 1, limit = 20 } = req.query

    const files = await FileShare.find({ roomId, isDeleted: false })
      .populate('uploadedBy', 'username profile.avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()

    const total = await FileShare.countDocuments({ roomId, isDeleted: false })

    res.json({
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' })
  }
})

module.exports = router
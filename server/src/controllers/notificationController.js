const { Notification } = require('../models');

const notificationController = {
  /**
   * GET /api/notifications
   * Query params:
   *   unread: 'true' | 'false' (optional)
   *   limit: number (default 20)
   * Returns: { success: true, data: [...], unread_count: N }
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.id || req.user._id;
      const { unread, limit } = req.query;

      const filter = { recipient_user_id: userId };
      if (unread === 'true') {
        filter.read_at = null;
      }

      const queryLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      const [notifications, unreadCount] = await Promise.all([
        Notification.find(filter)
          .sort({ created_at: -1 })
          .limit(queryLimit)
          .lean(),
        Notification.countDocuments({
          recipient_user_id: userId,
          read_at: null
        })
      ]);

      return res.json({
        success: true,
        data: notifications,
        unread_count: unreadCount
      });
    } catch (err) {
      console.error('Failed to get notifications:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications.'
      });
    }
  },

  /**
   * PATCH /api/notifications/:id/read
   * Mark a specific notification as read
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user.id || req.user._id;
      const notifId = req.params.id;

      const notification = await Notification.findOne({
        id: notifId,
        recipient_user_id: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found.'
        });
      }

      if (!notification.read_at) {
        notification.read_at = new Date();
        await notification.save();
      }

      return res.json({
        success: true,
        data: notification
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read.'
      });
    }
  },

  /**
   * POST /api/notifications/read-all
   * Mark all unread notifications for current user as read
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id || req.user._id;
      const now = new Date();

      const result = await Notification.updateMany(
        {
          recipient_user_id: userId,
          read_at: null
        },
        {
          $set: { read_at: now }
        }
      );

      return res.json({
        success: true,
        message: 'All notifications marked as read.',
        modified_count: result.modifiedCount || 0
      });
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read.'
      });
    }
  },

  /**
   * POST /api/notifications/mark-request-read
   * Mark notifications matching a specific request_id as read for current user
   */
  async markRequestAsRead(req, res) {
    try {
      const userId = req.user.id || req.user._id;
      const { request_id } = req.body;

      if (!request_id) {
        return res.status(400).json({
          success: false,
          message: 'request_id is required.'
        });
      }

      await Notification.updateMany(
        {
          recipient_user_id: userId,
          request_id,
          read_at: null
        },
        {
          $set: { read_at: new Date() }
        }
      );

      return res.json({
        success: true,
        message: 'Notifications for request marked as read.'
      });
    } catch (err) {
      console.error('Failed to mark request notifications as read:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notifications as read.'
      });
    }
  }
};

module.exports = notificationController;


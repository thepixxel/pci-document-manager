const express = require('express');
const router = express.Router();

// Importar controladores (estos serán creados posteriormente)
const {
  getNotifications,
  getNotification,
  createNotification,
  markAsRead,
  deleteNotification,
  sendEmailNotification,
  sendSlackNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getNotificationStats,
  testNotification,
} = require('../controllers/notifications');

// Importar middleware de autenticación (será creado posteriormente)
const { protect, authorize } = require('../middleware/auth');

// Rutas para gestión de notificaciones
router.route('/')
  .get(protect, getNotifications)
  .post(protect, authorize('admin', 'reviewer'), createNotification);

router.route('/:id')
  .get(protect, getNotification)
  .put(protect, markAsRead)
  .delete(protect, deleteNotification);

// Rutas para envío de notificaciones
router.post('/email', protect, authorize('admin', 'reviewer'), sendEmailNotification);
router.post('/slack', protect, authorize('admin', 'reviewer'), sendSlackNotification);

// Rutas para preferencias de notificaciones
router.route('/preferences')
  .get(protect, getUserNotificationPreferences)
  .put(protect, updateUserNotificationPreferences);

// Rutas para estadísticas y pruebas
router.get('/stats', protect, authorize('admin'), getNotificationStats);
router.post('/test', protect, authorize('admin'), testNotification);

module.exports = router;
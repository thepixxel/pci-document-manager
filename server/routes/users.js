const express = require('express');
const router = express.Router();

// Importar controladores (estos serán creados posteriormente)
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserDocuments,
  getUserActivity,
  changeUserRole,
  deactivateUser,
  activateUser,
} = require('../controllers/users');

// Importar middleware de autenticación (será creado posteriormente)
const { protect, authorize } = require('../middleware/auth');

// Rutas para gestión de usuarios (solo admin)
router.route('/')
  .get(protect, authorize('admin'), getUsers)
  .post(protect, authorize('admin'), createUser);

router.route('/:id')
  .get(protect, authorize('admin'), getUser)
  .put(protect, authorize('admin'), updateUser)
  .delete(protect, authorize('admin'), deleteUser);

// Rutas para documentos y actividad de usuarios
router.get('/:id/documents', protect, authorize('admin'), getUserDocuments);
router.get('/:id/activity', protect, authorize('admin'), getUserActivity);

// Rutas para gestión de roles y estado
router.put('/:id/role', protect, authorize('admin'), changeUserRole);
router.put('/:id/deactivate', protect, authorize('admin'), deactivateUser);
router.put('/:id/activate', protect, authorize('admin'), activateUser);

module.exports = router;
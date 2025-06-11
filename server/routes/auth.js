const express = require('express');
const router = express.Router();

// Importar controladores (estos serán creados posteriormente)
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateDetails,
} = require('../controllers/auth');

// Importar middleware de autenticación (será creado posteriormente)
const { protect, authorize } = require('../middleware/auth');

// Rutas de autenticación
router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.put('/updatepassword', protect, updatePassword);
router.put('/updatedetails', protect, updateDetails);

module.exports = router;
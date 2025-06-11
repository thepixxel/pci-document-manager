const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware para proteger rutas y verificar autenticación
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Verificar si hay token en los headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Obtener token del header
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Alternativamente, obtener token de las cookies
      token = req.cookies.token;
    }

    // Verificar que el token existe
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No está autorizado para acceder a este recurso',
      });
    }

    try {
      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Obtener usuario del token
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'El usuario no existe',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Su cuenta ha sido desactivada',
        });
      }

      // Añadir usuario a la solicitud
      req.user = user;

      // Actualizar fecha de último login
      user.lastLogin = Date.now();
      await user.save({ validateBeforeSave: false });

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado',
      });
    }
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    });
  }
};

/**
 * Middleware para autorizar roles específicos
 * @param {...string} roles - Roles permitidos
 * @returns {Function} - Middleware de Express
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No está autorizado para acceder a este recurso',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `El rol ${req.user.role} no está autorizado para acceder a este recurso`,
      });
    }

    next();
  };
};
const User = require('../models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * @desc    Registrar un nuevo usuario
 * @route   POST /api/auth/register
 * @access  Público
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado',
      });
    }

    // Crear usuario (el rol será 'user' por defecto a menos que se especifique)
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user',
    });

    // Enviar respuesta con token
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Error en registro de usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Iniciar sesión
 * @route   POST /api/auth/login
 * @access  Público
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar email y password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporcione email y contraseña',
      });
    }

    // Verificar si el usuario existe
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
      });
    }

    // Verificar si la cuenta está activa
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Su cuenta ha sido desactivada',
      });
    }

    // Verificar si la contraseña coincide
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
      });
    }

    // Enviar respuesta con token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Error en inicio de sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Cerrar sesión / limpiar cookie
 * @route   GET /api/auth/logout
 * @access  Privado
 */
exports.logout = async (req, res) => {
  try {
    // Eliminar cookie
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000), // Expira en 10 segundos
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Obtener usuario actual
 * @route   GET /api/auth/me
 * @access  Privado
 */
exports.getMe = async (req, res) => {
  try {
    // El usuario ya está en req.user desde el middleware protect
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario actual',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Olvidé mi contraseña
 * @route   POST /api/auth/forgotpassword
 * @access  Público
 */
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No hay usuario con ese email',
      });
    }

    // Obtener token de restablecimiento
    const resetToken = user.getResetPasswordToken();

    // Guardar el usuario con el token y la fecha de expiración
    await user.save({ validateBeforeSave: false });

    // Crear URL de restablecimiento
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/resetpassword/${resetToken}`;

    // Crear mensaje de email
    const message = `
      <p>Ha solicitado restablecer su contraseña. Por favor haga clic en el siguiente enlace para completar el proceso:</p>
      <p><a href="${resetUrl}" target="_blank">Restablecer Contraseña</a></p>
      <p>Este enlace es válido por 10 minutos.</p>
      <p>Si no solicitó restablecer su contraseña, por favor ignore este email.</p>
    `;

    try {
      // Enviar email (implementar servicio de email)
      // await sendEmail({
      //   email: user.email,
      //   subject: 'Restablecimiento de contraseña',
      //   message,
      // });

      // Por ahora, solo devolvemos el token y la URL (en producción no se haría esto)
      res.status(200).json({
        success: true,
        message: 'Email enviado',
        resetUrl,
        resetToken,
      });
    } catch (error) {
      console.error('Error al enviar email de restablecimiento:', error);

      // Limpiar token y expiración
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'No se pudo enviar el email',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  } catch (error) {
    console.error('Error en olvido de contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar solicitud de olvido de contraseña',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Restablecer contraseña
 * @route   PUT /api/auth/resetpassword/:resettoken
 * @access  Público
 */
exports.resetPassword = async (req, res) => {
  try {
    // Obtener token hasheado
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    // Buscar usuario con el token y que no haya expirado
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado',
      });
    }

    // Establecer nueva contraseña
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Enviar respuesta con token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al restablecer contraseña',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Actualizar contraseña
 * @route   PUT /api/auth/updatepassword
 * @access  Privado
 */
exports.updatePassword = async (req, res) => {
  try {
    // Obtener usuario con contraseña
    const user = await User.findById(req.user.id).select('+password');

    // Verificar contraseña actual
    const isMatch = await user.matchPassword(req.body.currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta',
      });
    }

    // Establecer nueva contraseña
    user.password = req.body.newPassword;
    await user.save();

    // Enviar respuesta con token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Error al actualizar contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar contraseña',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Actualizar detalles de usuario
 * @route   PUT /api/auth/updatedetails
 * @access  Privado
 */
exports.updateDetails = async (req, res) => {
  try {
    // Campos a actualizar
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
    };

    // Actualizar usuario
    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error al actualizar detalles de usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar detalles de usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Función auxiliar para enviar respuesta con token
 * @param {Object} user - Usuario
 * @param {number} statusCode - Código de estado HTTP
 * @param {Object} res - Objeto de respuesta Express
 */
const sendTokenResponse = (user, statusCode, res) => {
  // Crear token
  const token = user.getSignedJwtToken();

  // Opciones para cookie
  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  // Usar HTTPS en producción
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  // Enviar respuesta con cookie
  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
};
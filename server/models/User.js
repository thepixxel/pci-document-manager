const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Por favor ingrese un email válido',
      ],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
      select: false, // No incluir en las consultas por defecto
    },
    role: {
      type: String,
      enum: ['admin', 'reviewer', 'user'],
      default: 'user',
    },
    department: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    profileImage: {
      type: String,
    },
    notificationPreferences: {
      email: {
        enabled: {
          type: Boolean,
          default: true,
        },
        frequency: {
          type: String,
          enum: ['immediate', 'daily', 'weekly'],
          default: 'immediate',
        },
      },
      slack: {
        enabled: {
          type: Boolean,
          default: false,
        },
        slackUserId: {
          type: String,
        },
      },
    },
    assignedDocuments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Encriptar contraseña antes de guardar
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para verificar contraseña
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Método para generar token JWT
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    }
  );
};

// Método para generar token de restablecimiento de contraseña
UserSchema.methods.getResetPasswordToken = function () {
  // Generar token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token y establecer en resetPasswordToken
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Establecer expiración (10 minutos)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// Método para actualizar la fecha de último login
UserSchema.methods.updateLastLogin = function () {
  this.lastLogin = Date.now();
  return this.save();
};

// Índices para búsquedas eficientes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

module.exports = mongoose.model('User', UserSchema);
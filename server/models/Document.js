const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DocumentSchema = new Schema(
  {
    // Información del comercio
    merchantName: {
      type: String,
      required: [true, 'El nombre del comercio es obligatorio'],
      trim: true,
    },
    merchantId: {
      type: String,
      trim: true,
    },
    
    // Tipo de documento
    documentType: {
      type: String,
      required: [true, 'El tipo de documento es obligatorio'],
      enum: ['AOC', 'SAQ-A', 'SAQ-A-EP', 'SAQ-B', 'SAQ-B-IP', 'SAQ-C', 'SAQ-C-VT', 'SAQ-D', 'ASV', 'P2PE', 'OTRO'],
    },
    
    // Fechas
    issueDate: {
      type: Date,
      required: [true, 'La fecha de emisión es obligatoria'],
    },
    expirationDate: {
      type: Date,
      required: [true, 'La fecha de vencimiento es obligatoria'],
    },
    
    // Información PCI
    pciVersion: {
      type: String,
      required: [true, 'La versión de PCI es obligatoria'],
      trim: true,
    },
    complianceLevel: {
      type: String,
      enum: ['Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'No Aplica'],
      default: 'No Aplica',
    },
    
    // Evaluador
    evaluatorName: {
      type: String,
      trim: true,
    },
    evaluatorCompany: {
      type: String,
      trim: true,
    },
    
    // Estado del documento
    status: {
      type: String,
      enum: ['Válido', 'Por Vencer', 'Vencido', 'Inválido', 'Pendiente de Revisión'],
      default: 'Pendiente de Revisión',
    },
    
    // Información de firma
    isSigned: {
      type: Boolean,
      default: false,
    },
    signatureType: {
      type: String,
      enum: ['Digital', 'Física', 'No Aplica'],
      default: 'No Aplica',
    },
    
    // Información del archivo
    fileName: {
      type: String,
      required: [true, 'El nombre del archivo es obligatorio'],
    },
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'doc', 'otro'],
      default: 'pdf',
    },
    filePath: {
      type: String,
      required: [true, 'La ruta del archivo es obligatoria'],
    },
    fileSize: {
      type: Number,
    },
    
    // Información de almacenamiento externo
    storageType: {
      type: String,
      enum: ['local', 'google-drive', 'dropbox', 'sharepoint', 'otro'],
      default: 'local',
    },
    externalId: {
      type: String,
      trim: true,
    },
    externalUrl: {
      type: String,
      trim: true,
    },
    
    // Resultados de validación
    validationResults: {
      isValid: {
        type: Boolean,
        default: false,
      },
      validationDate: {
        type: Date,
      },
      validationMethod: {
        type: String,
        enum: ['Manual', 'Automática', 'No Validado'],
        default: 'No Validado',
      },
      validationNotes: {
        type: String,
      },
      extractedData: {
        type: Object,
      },
    },
    
    // Notificaciones
    notifications: [
      {
        type: {
          type: String,
          enum: ['Vencimiento', 'Recordatorio', 'Actualización', 'Otro'],
        },
        date: {
          type: Date,
        },
        method: {
          type: String,
          enum: ['Email', 'Slack', 'Otro'],
        },
        recipient: {
          type: String,
        },
        status: {
          type: String,
          enum: ['Enviado', 'Fallido', 'Pendiente'],
        },
        message: {
          type: String,
        },
      },
    ],
    
    // Campos para seguimiento
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    comments: [
      {
        text: {
          type: String,
          required: true,
        },
        createdBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas eficientes
DocumentSchema.index({ merchantName: 1 });
DocumentSchema.index({ documentType: 1 });
DocumentSchema.index({ expirationDate: 1 });
DocumentSchema.index({ status: 1 });

// Método para verificar si un documento está por vencer
DocumentSchema.methods.isAboutToExpire = function (daysThreshold = 30) {
  const today = new Date();
  const expirationDate = new Date(this.expirationDate);
  const timeDiff = expirationDate.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return daysDiff <= daysThreshold && daysDiff > 0;
};

// Método para verificar si un documento está vencido
DocumentSchema.methods.isExpired = function () {
  const today = new Date();
  const expirationDate = new Date(this.expirationDate);
  return today > expirationDate;
};

// Método para actualizar el estado del documento basado en la fecha de vencimiento
DocumentSchema.methods.updateStatus = function () {
  if (this.isExpired()) {
    this.status = 'Vencido';
  } else if (this.isAboutToExpire()) {
    this.status = 'Por Vencer';
  } else {
    this.status = 'Válido';
  }
  return this.save();
};

// Pre-save hook para actualizar el estado antes de guardar
DocumentSchema.pre('save', function (next) {
  if (this.expirationDate) {
    if (this.isExpired()) {
      this.status = 'Vencido';
    } else if (this.isAboutToExpire()) {
      this.status = 'Por Vencer';
    } else if (this.status === 'Pendiente de Revisión' && this.validationResults.isValid) {
      this.status = 'Válido';
    }
  }
  next();
});

module.exports = mongoose.model('Document', DocumentSchema);
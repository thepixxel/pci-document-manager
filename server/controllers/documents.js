const Document = require('../models/Document');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const documentProcessor = require('../services/documentProcessor');
const notificationService = require('../services/notificationService');

// Configurar almacenamiento para multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/documents';
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre de archivo único
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `document-${uniqueSuffix}${ext}`);
  },
});

// Filtrar tipos de archivos permitidos
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.docx', '.doc'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no soportado. Solo se permiten PDF y DOCX.'), false);
  }
};

// Inicializar multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * @desc    Obtener todos los documentos
 * @route   GET /api/documents
 * @access  Privado
 */
exports.getDocuments = async (req, res) => {
  try {
    // Construir query
    let query = {};
    
    // Filtrar por tipo de documento
    if (req.query.documentType) {
      query.documentType = req.query.documentType;
    }
    
    // Filtrar por estado
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filtrar por comercio
    if (req.query.merchantName) {
      query.merchantName = { $regex: req.query.merchantName, $options: 'i' };
    }
    
    // Filtrar por fechas
    if (req.query.fromDate && req.query.toDate) {
      query.expirationDate = {
        $gte: new Date(req.query.fromDate),
        $lte: new Date(req.query.toDate),
      };
    } else if (req.query.fromDate) {
      query.expirationDate = { $gte: new Date(req.query.fromDate) };
    } else if (req.query.toDate) {
      query.expirationDate = { $lte: new Date(req.query.toDate) };
    }
    
    // Filtrar por usuario asignado
    if (req.query.assignedTo) {
      query.assignedTo = req.query.assignedTo;
    }
    
    // Opciones de paginación
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Ejecutar query con paginación y populate
    const documents = await Document.find(query)
      .populate('assignedTo', 'name email')
      .skip(startIndex)
      .limit(limit)
      .sort({ expirationDate: 1 });
    
    // Obtener total de documentos para paginación
    const total = await Document.countDocuments(query);
    
    // Calcular páginas
    const pagination = {
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };
    
    res.status(200).json({
      success: true,
      pagination,
      data: documents,
    });
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documentos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Obtener un documento específico
 * @route   GET /api/documents/:id
 * @access  Privado
 */
exports.getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id).populate('assignedTo', 'name email');
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
      });
    }
    
    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Error al obtener documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Crear un nuevo documento
 * @route   POST /api/documents
 * @access  Privado
 */
exports.createDocument = async (req, res) => {
  try {
    // Añadir usuario que crea el documento
    req.body.createdBy = req.user.id;
    
    // Crear documento
    const document = await Document.create(req.body);
    
    res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Error al crear documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear documento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Actualizar un documento
 * @route   PUT /api/documents/:id
 * @access  Privado
 */
exports.updateDocument = async (req, res) => {
  try {
    let document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
      });
    }
    
    // Actualizar documento
    document = await Document.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    
    // Si se actualizó la fecha de vencimiento, actualizar el estado
    if (req.body.expirationDate) {
      await document.updateStatus();
    }
    
    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar documento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Eliminar un documento
 * @route   DELETE /api/documents/:id
 * @access  Privado (admin, reviewer)
 */
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
      });
    }
    
    // Eliminar archivo si existe
    if (document.filePath) {
      const fullPath = path.join(process.cwd(), document.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    
    // Eliminar documento
    await document.remove();
    
    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar documento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Subir archivo de documento
 * @route   POST /api/documents/:id/upload
 * @access  Privado
 */
exports.uploadDocumentFile = async (req, res) => {
  try {
    // Middleware de multer para subir un solo archivo
    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Por favor suba un archivo',
        });
      }
      
      // Buscar documento
      const document = await Document.findById(req.params.id);
      
      if (!document) {
        // Eliminar archivo subido si el documento no existe
        fs.unlinkSync(req.file.path);
        
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado',
        });
      }
      
      // Eliminar archivo anterior si existe
      if (document.filePath) {
        const fullPath = path.join(process.cwd(), document.filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      
      // Actualizar información del archivo en el documento
      document.fileName = req.file.originalname;
      document.filePath = req.file.path;
      document.fileSize = req.file.size;
      document.fileType = path.extname(req.file.originalname).substring(1);
      
      await document.save();
      
      res.status(200).json({
        success: true,
        data: {
          fileName: document.fileName,
          filePath: document.filePath,
          fileSize: document.fileSize,
          fileType: document.fileType,
        },
      });
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir archivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Procesar documento con IA
 * @route   POST /api/documents/:id/process
 * @access  Privado
 */
exports.processDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
      });
    }
    
    // Verificar que el documento tiene un archivo
    if (!document.filePath) {
      return res.status(400).json({
        success: false,
        message: 'El documento no tiene un archivo asociado',
      });
    }
    
    // Procesar documento con IA
    const processingResult = await documentProcessor.processDocument(
      document.filePath,
      document.fileType,
      document.documentType
    );
    
    // Actualizar documento con la información extraída
    document.merchantName = processingResult.extractedData.merchantName || document.merchantName;
    document.issueDate = processingResult.extractedData.issueDate || document.issueDate;
    document.expirationDate = processingResult.extractedData.expirationDate || document.expirationDate;
    document.pciVersion = processingResult.extractedData.pciVersion || document.pciVersion;
    document.complianceLevel = processingResult.extractedData.complianceLevel || document.complianceLevel;
    document.evaluatorName = processingResult.extractedData.evaluatorName || document.evaluatorName;
    document.evaluatorCompany = processingResult.extractedData.evaluatorCompany || document.evaluatorCompany;
    document.isSigned = processingResult.extractedData.isSigned === 'Sí' || processingResult.extractedData.isSigned === true;
    document.signatureType = processingResult.extractedData.signatureType || document.signatureType;
    document.merchantId = processingResult.extractedData.merchantId || document.merchantId;
    
    // Guardar resultados de validación
    document.validationResults = {
      isValid: processingResult.validationResults.isValid,
      validationDate: new Date(),
      validationMethod: 'Automática',
      validationNotes: processingResult.validationResults.errors.join(', '),
      extractedData: processingResult.extractedData,
    };
    
    // Actualizar estado del documento
    await document.updateStatus();
    
    res.status(200).json({
      success: true,
      data: {
        document,
        processingResult,
      },
    });
  } catch (error) {
    console.error('Error al procesar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar documento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Validar documento manualmente
 * @route   POST /api/documents/:id/validate
 * @access  Privado (admin, reviewer)
 */
exports.validateDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
      });
    }
    
    // Actualizar resultados de validación
    document.validationResults = {
      isValid: req.body.isValid,
      validationDate: new Date(),
      validationMethod: 'Manual',
      validationNotes: req.body.validationNotes || '',
      extractedData: document.validationResults?.extractedData || {},
    };
    
    // Actualizar estado del documento
    if (req.body.isValid) {
      document.status = document.isExpired() ? 'Vencido' : document.isAboutToExpire() ? 'Por Vencer' : 'Válido';
    } else {
      document.status = 'Inválido';
    }
    
    await document.save();
    
    // Enviar notificación si el documento es válido
    if (req.body.isValid) {
      await notificationService.sendDocumentNotification(
        document,
        'Actualización',
        { validationResult: 'Válido' }
      );
    }
    
    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Error al validar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar documento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Obtener documentos por vencer
 * @route   GET /api/documents/expiring
 * @access  Privado
 */
exports.getExpiringDocuments = async (req, res) => {
  try {
    const daysThreshold = parseInt(req.query.days) || 30;
    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + daysThreshold);
    
    // Buscar documentos que vencen en los próximos X días
    const documents = await Document.find({
      expirationDate: {
        $gte: today,
        $lte: thresholdDate,
      },
      status: { $ne: 'Vencido' },
    })
    .populate('assignedTo', 'name email')
    .sort({ expirationDate: 1 });
    
    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    console.error('Error al obtener documentos por vencer:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documentos por vencer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Obtener documentos por comercio
 * @route   GET /api/documents/merchant/:merchantId
 * @access  Privado
 */
exports.getDocumentsByMerchant = async (req, res) => {
  try {
    const documents = await Document.find({
      merchantId: req.params.merchantId,
    })
    .populate('assignedTo', 'name email')
    .sort({ expirationDate: 1 });
    
    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    console.error('Error al obtener documentos por comercio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documentos por comercio',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Obtener estadísticas de documentos
 * @route   GET /api/documents/stats
 * @access  Privado
 */
exports.getDocumentStats = async (req, res) => {
  try {
    // Obtener total de documentos
    const totalDocuments = await Document.countDocuments();
    
    // Obtener documentos por estado
    const validDocuments = await Document.countDocuments({ status: 'Válido' });
    const expiringDocuments = await Document.countDocuments({ status: 'Por Vencer' });
    const expiredDocuments = await Document.countDocuments({ status: 'Vencido' });
    const invalidDocuments = await Document.countDocuments({ status: 'Inválido' });
    const pendingDocuments = await Document.countDocuments({ status: 'Pendiente de Revisión' });
    
    // Obtener documentos por tipo
    const documentTypes = await Document.aggregate([
      {
        $group: {
          _id: '$documentType',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);
    
    // Obtener documentos que vencen en los próximos 30 días
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const upcomingExpirations = await Document.countDocuments({
      expirationDate: {
        $gte: today,
        $lte: thirtyDaysFromNow,
      },
      status: { $ne: 'Vencido' },
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalDocuments,
        byStatus: {
          valid: validDocuments,
          expiring: expiringDocuments,
          expired: expiredDocuments,
          invalid: invalidDocuments,
          pending: pendingDocuments,
        },
        byType: documentTypes,
        upcomingExpirations,
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de documentos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Añadir comentario a un documento
 * @route   POST /api/documents/:id/comments
 * @access  Privado
 */
exports.addDocumentComment = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
      });
    }
    
    // Añadir comentario
    document.comments.push({
      text: req.body.text,
      createdBy: req.user.id,
    });
    
    await document.save();
    
    // Obtener documento actualizado con comentarios populados
    const updatedDocument = await Document.findById(req.params.id)
      .populate('comments.createdBy', 'name email');
    
    res.status(200).json({
      success: true,
      data: updatedDocument,
    });
  } catch (error) {
    console.error('Error al añadir comentario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al añadir comentario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Asignar documento a un usuario
 * @route   PUT /api/documents/:id/assign
 * @access  Privado (admin)
 */
exports.assignDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
      });
    }
    
    // Verificar que el usuario existe
    const user = await User.findById(req.body.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    // Asignar documento
    document.assignedTo = req.body.userId;
    await document.save();
    
    // Obtener documento actualizado con usuario asignado populado
    const updatedDocument = await Document.findById(req.params.id)
      .populate('assignedTo', 'name email');
    
    // Enviar notificación al usuario asignado
    if (user.notificationPreferences.email.enabled) {
      // Implementar envío de notificación
    }
    
    res.status(200).json({
      success: true,
      data: updatedDocument,
    });
  } catch (error) {
    console.error('Error al asignar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar documento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
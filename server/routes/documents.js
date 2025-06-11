const express = require('express');
const router = express.Router();

// Importar controladores (estos serán creados posteriormente)
const {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  uploadDocumentFile,
  processDocument,
  validateDocument,
  getExpiringDocuments,
  getDocumentsByMerchant,
  getDocumentStats,
  addDocumentComment,
  assignDocument,
} = require('../controllers/documents');

// Importar middleware de autenticación (será creado posteriormente)
const { protect, authorize } = require('../middleware/auth');

// Rutas para estadísticas y reportes
router.get('/stats', protect, getDocumentStats);
router.get('/expiring', protect, getExpiringDocuments);

// Rutas para gestión de documentos
router.route('/')
  .get(protect, getDocuments)
  .post(protect, createDocument);

router.route('/:id')
  .get(protect, getDocument)
  .put(protect, updateDocument)
  .delete(protect, authorize('admin', 'reviewer'), deleteDocument);

// Rutas para carga y procesamiento de archivos
router.post('/:id/upload', protect, uploadDocumentFile);
router.post('/:id/process', protect, processDocument);
router.post('/:id/validate', protect, authorize('admin', 'reviewer'), validateDocument);

// Rutas para comentarios y asignación
router.post('/:id/comments', protect, addDocumentComment);
router.put('/:id/assign', protect, authorize('admin'), assignDocument);

// Rutas para búsqueda por comercio
router.get('/merchant/:merchantId', protect, getDocumentsByMerchant);

module.exports = router;
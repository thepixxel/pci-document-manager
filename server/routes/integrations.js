const express = require('express');
const router = express.Router();

// Importar controladores (estos serán creados posteriormente)
const {
  // Google Drive
  getGoogleAuthUrl,
  handleGoogleCallback,
  listGoogleDriveFiles,
  uploadToGoogleDrive,
  downloadFromGoogleDrive,
  
  // Dropbox
  getDropboxAuthUrl,
  handleDropboxCallback,
  listDropboxFiles,
  uploadToDropbox,
  downloadFromDropbox,
  
  // SharePoint
  getSharePointAuthUrl,
  handleSharePointCallback,
  listSharePointFiles,
  uploadToSharePoint,
  downloadFromSharePoint,
  
  // Estado de integración
  getIntegrationStatus,
  disconnectIntegration,
} = require('../controllers/integrations');

// Importar middleware de autenticación (será creado posteriormente)
const { protect, authorize } = require('../middleware/auth');

// Rutas para estado de integración
router.get('/status', protect, getIntegrationStatus);
router.delete('/:provider/disconnect', protect, disconnectIntegration);

// Rutas para Google Drive
router.get('/google/auth', protect, getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);
router.get('/google/files', protect, listGoogleDriveFiles);
router.post('/google/upload', protect, uploadToGoogleDrive);
router.get('/google/download/:fileId', protect, downloadFromGoogleDrive);

// Rutas para Dropbox
router.get('/dropbox/auth', protect, getDropboxAuthUrl);
router.get('/dropbox/callback', handleDropboxCallback);
router.get('/dropbox/files', protect, listDropboxFiles);
router.post('/dropbox/upload', protect, uploadToDropbox);
router.get('/dropbox/download/:fileId', protect, downloadFromDropbox);

// Rutas para SharePoint
router.get('/sharepoint/auth', protect, getSharePointAuthUrl);
router.get('/sharepoint/callback', handleSharePointCallback);
router.get('/sharepoint/files', protect, listSharePointFiles);
router.post('/sharepoint/upload', protect, uploadToSharePoint);
router.get('/sharepoint/download/:fileId', protect, downloadFromSharePoint);

module.exports = router;
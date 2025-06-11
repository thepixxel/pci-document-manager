const schedule = require('node-schedule');
const Document = require('../models/Document');
const User = require('../models/User');
const notificationService = require('./notificationService');

/**
 * Verifica documentos por vencer y envía notificaciones
 * @returns {Promise<Object>} - Resultado de la verificación
 */
const checkExpiringDocuments = async () => {
  try {
    console.log('Verificando documentos por vencer...');
    
    const daysThreshold = parseInt(process.env.NOTIFICATION_DAYS_BEFORE) || 30;
    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + daysThreshold);
    
    // Buscar documentos que vencen en los próximos X días
    const expiringDocuments = await Document.find({
      expirationDate: {
        $gte: today,
        $lte: thresholdDate,
      },
      status: { $ne: 'Vencido' },
    }).populate('assignedTo');
    
    console.log(`Se encontraron ${expiringDocuments.length} documentos por vencer`);
    
    const results = {
      total: expiringDocuments.length,
      notified: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };
    
    // Enviar notificaciones para cada documento
    for (const document of expiringDocuments) {
      try {
        const expirationDate = new Date(document.expirationDate);
        const timeDiff = expirationDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        // Verificar si ya se envió una notificación reciente para este documento
        const recentNotification = document.notifications.find(n => 
          n.type === 'Vencimiento' && 
          n.status === 'Enviado' && 
          (new Date().getTime() - new Date(n.date).getTime()) < (7 * 24 * 60 * 60 * 1000) // 7 días
        );
        
        if (!recentNotification) {
          console.log(`Enviando notificación para documento ${document._id} (${daysRemaining} días restantes)`);
          const notificationResult = await notificationService.sendDocumentNotification(
            document, 
            'Vencimiento', 
            { daysRemaining }
          );
          
          results.details.push({
            documentId: document._id,
            merchantName: document.merchantName,
            daysRemaining,
            notified: true,
            result: notificationResult,
          });
          
          results.notified++;
        } else {
          console.log(`Omitiendo notificación para documento ${document._id} (notificación reciente encontrada)`);
          results.details.push({
            documentId: document._id,
            merchantName: document.merchantName,
            daysRemaining,
            notified: false,
            reason: 'Notificación reciente',
          });
          
          results.skipped++;
        }
      } catch (error) {
        console.error(`Error al procesar documento ${document._id}:`, error);
        results.details.push({
          documentId: document._id,
          merchantName: document.merchantName,
          error: error.message,
        });
        
        results.errors++;
      }
    }
    
    console.log('Verificación de documentos por vencer completada');
    return results;
  } catch (error) {
    console.error('Error en la verificación de documentos por vencer:', error);
    throw error;
  }
};

/**
 * Actualiza el estado de todos los documentos
 * @returns {Promise<Object>} - Resultado de la actualización
 */
const updateDocumentStatuses = async () => {
  try {
    console.log('Actualizando estados de documentos...');
    
    const today = new Date();
    const results = {
      total: 0,
      updated: 0,
      errors: 0,
      details: [],
    };
    
    // Buscar todos los documentos activos
    const documents = await Document.find({
      status: { $in: ['Válido', 'Por Vencer', 'Pendiente de Revisión'] },
    });
    
    results.total = documents.length;
    
    // Actualizar estado de cada documento
    for (const document of documents) {
      try {
        const oldStatus = document.status;
        
        // Actualizar estado basado en fecha de vencimiento
        if (document.expirationDate) {
          const expirationDate = new Date(document.expirationDate);
          
          if (today > expirationDate) {
            document.status = 'Vencido';
          } else {
            const daysThreshold = parseInt(process.env.NOTIFICATION_DAYS_BEFORE) || 30;
            const timeDiff = expirationDate.getTime() - today.getTime();
            const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            if (daysRemaining <= daysThreshold) {
              document.status = 'Por Vencer';
            } else if (document.validationResults && document.validationResults.isValid) {
              document.status = 'Válido';
            }
          }
        }
        
        // Si el estado cambió, guardar el documento
        if (oldStatus !== document.status) {
          await document.save();
          
          results.details.push({
            documentId: document._id,
            merchantName: document.merchantName,
            oldStatus,
            newStatus: document.status,
          });
          
          results.updated++;
          
          // Si el documento pasó a estado "Vencido", enviar notificación
          if (document.status === 'Vencido' && oldStatus !== 'Vencido') {
            await notificationService.sendDocumentNotification(
              document,
              'Vencimiento',
              { daysRemaining: 0 }
            );
          }
        }
      } catch (error) {
        console.error(`Error al actualizar estado del documento ${document._id}:`, error);
        results.details.push({
          documentId: document._id,
          merchantName: document.merchantName,
          error: error.message,
        });
        
        results.errors++;
      }
    }
    
    console.log(`Actualización de estados completada: ${results.updated} documentos actualizados`);
    return results;
  } catch (error) {
    console.error('Error en la actualización de estados de documentos:', error);
    throw error;
  }
};

/**
 * Genera un informe semanal de documentos
 * @returns {Promise<Object>} - Resultado del informe
 */
const generateWeeklyReport = async () => {
  try {
    console.log('Generando informe semanal de documentos...');
    
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    // Obtener estadísticas de documentos
    const totalDocuments = await Document.countDocuments();
    const validDocuments = await Document.countDocuments({ status: 'Válido' });
    const expiringDocuments = await Document.countDocuments({ 
      status: 'Por Vencer',
      expirationDate: { $gte: today, $lte: thirtyDaysFromNow }
    });
    const expiredDocuments = await Document.countDocuments({ status: 'Vencido' });
    const pendingDocuments = await Document.countDocuments({ status: 'Pendiente de Revisión' });
    
    // Obtener documentos que vencen en los próximos 30 días
    const upcomingExpirations = await Document.find({
      expirationDate: { $gte: today, $lte: thirtyDaysFromNow }
    })
    .sort({ expirationDate: 1 })
    .select('merchantName documentType expirationDate status assignedTo')
    .populate('assignedTo', 'name email');
    
    const report = {
      generatedAt: today,
      statistics: {
        totalDocuments,
        validDocuments,
        expiringDocuments,
        expiredDocuments,
        pendingDocuments,
      },
      upcomingExpirations: upcomingExpirations.map(doc => ({
        id: doc._id,
        merchantName: doc.merchantName,
        documentType: doc.documentType,
        expirationDate: doc.expirationDate,
        status: doc.status,
        assignedTo: doc.assignedTo ? {
          id: doc.assignedTo._id,
          name: doc.assignedTo.name,
          email: doc.assignedTo.email,
        } : null,
      })),
    };
    
    // Enviar informe a administradores
    const adminUsers = await User.find({ 
      role: 'admin', 
      isActive: true,
      'notificationPreferences.email.enabled': true 
    });
    
    if (adminUsers.length > 0) {
      // Generar HTML del informe
      const reportHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #2c3e50;">Informe Semanal de Documentos PCI</h2>
          <p>Generado el: ${today.toLocaleDateString('es-ES')}</p>
          
          <h3 style="margin-top: 20px; color: #2c3e50;">Estadísticas</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
            <div style="flex: 1; min-width: 150px; background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${totalDocuments}</div>
              <div>Total Documentos</div>
            </div>
            <div style="flex: 1; min-width: 150px; background-color: #d4edda; padding: 15px; border-radius: 5px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #155724;">${validDocuments}</div>
              <div>Válidos</div>
            </div>
            <div style="flex: 1; min-width: 150px; background-color: #fff3cd; padding: 15px; border-radius: 5px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #856404;">${expiringDocuments}</div>
              <div>Por Vencer</div>
            </div>
            <div style="flex: 1; min-width: 150px; background-color: #f8d7da; padding: 15px; border-radius: 5px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #721c24;">${expiredDocuments}</div>
              <div>Vencidos</div>
            </div>
            <div style="flex: 1; min-width: 150px; background-color: #e2e3e5; padding: 15px; border-radius: 5px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #383d41;">${pendingDocuments}</div>
              <div>Pendientes</div>
            </div>
          </div>
          
          <h3 style="margin-top: 20px; color: #2c3e50;">Próximos Vencimientos (30 días)</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Comercio</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Tipo</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Vencimiento</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Estado</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Asignado a</th>
              </tr>
            </thead>
            <tbody>
              ${report.upcomingExpirations.map(doc => `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${doc.merchantName}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${doc.documentType}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${new Date(doc.expirationDate).toLocaleDateString('es-ES')}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${doc.status}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${doc.assignedTo ? doc.assignedTo.name : 'No asignado'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/documents" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 3px;">Ver todos los documentos</a>
          </p>
          
          <p style="margin-top: 20px; font-size: 12px; color: #777;">Este es un informe automático generado por el sistema de gestión de documentos PCI.</p>
        </div>
      `;
      
      // Enviar informe por email a cada administrador
      for (const admin of adminUsers) {
        await notificationService.sendEmail(
          admin.email,
          'Informe Semanal de Documentos PCI',
          reportHtml
        );
      }
    }
    
    console.log('Informe semanal generado y enviado');
    return report;
  } catch (error) {
    console.error('Error al generar informe semanal:', error);
    throw error;
  }
};

/**
 * Inicializa todas las tareas programadas
 */
const initScheduledJobs = () => {
  // Verificar documentos por vencer diariamente a las 9:00 AM
  schedule.scheduleJob('0 9 * * *', async () => {
    try {
      await checkExpiringDocuments();
    } catch (error) {
      console.error('Error en la tarea programada de verificación de documentos:', error);
    }
  });
  
  // Actualizar estados de documentos diariamente a las 1:00 AM
  schedule.scheduleJob('0 1 * * *', async () => {
    try {
      await updateDocumentStatuses();
    } catch (error) {
      console.error('Error en la tarea programada de actualización de estados:', error);
    }
  });
  
  // Generar informe semanal los lunes a las 8:00 AM
  schedule.scheduleJob('0 8 * * 1', async () => {
    try {
      await generateWeeklyReport();
    } catch (error) {
      console.error('Error en la tarea programada de generación de informe semanal:', error);
    }
  });
  
  console.log('Tareas programadas inicializadas');
};

/**
 * Ejecuta manualmente una tarea programada
 * @param {string} taskName - Nombre de la tarea a ejecutar
 * @returns {Promise<Object>} - Resultado de la ejecución
 */
const runScheduledTask = async (taskName) => {
  try {
    switch (taskName) {
      case 'checkExpiringDocuments':
        return await checkExpiringDocuments();
      case 'updateDocumentStatuses':
        return await updateDocumentStatuses();
      case 'generateWeeklyReport':
        return await generateWeeklyReport();
      default:
        throw new Error(`Tarea desconocida: ${taskName}`);
    }
  } catch (error) {
    console.error(`Error al ejecutar tarea ${taskName}:`, error);
    throw error;
  }
};

module.exports = {
  initScheduledJobs,
  runScheduledTask,
  checkExpiringDocuments,
  updateDocumentStatuses,
  generateWeeklyReport,
};
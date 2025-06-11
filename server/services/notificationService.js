const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const schedule = require('node-schedule');
const User = require('../models/User');
const Document = require('../models/Document');

// Configurar cliente de Slack
const slack = new WebClient(process.env.SLACK_TOKEN);

// Configurar transporte de email
const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Envía una notificación por email
 * @param {string} to - Dirección de email del destinatario
 * @param {string} subject - Asunto del email
 * @param {string} html - Contenido HTML del email
 * @returns {Promise<Object>} - Resultado del envío
 */
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Error al enviar email:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Envía una notificación a Slack
 * @param {string} channel - Canal o ID de usuario de Slack
 * @param {string} text - Texto del mensaje
 * @param {Array} blocks - Bloques de contenido enriquecido (opcional)
 * @returns {Promise<Object>} - Resultado del envío
 */
const sendSlackMessage = async (channel, text, blocks = []) => {
  try {
    const result = await slack.chat.postMessage({
      channel,
      text,
      blocks: blocks.length > 0 ? blocks : undefined,
    });

    return {
      success: true,
      ts: result.ts,
      channel: result.channel,
    };
  } catch (error) {
    console.error('Error al enviar mensaje a Slack:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Genera el contenido HTML para un email de notificación de vencimiento
 * @param {Object} document - Documento que está por vencer
 * @param {number} daysRemaining - Días restantes para el vencimiento
 * @returns {string} - Contenido HTML del email
 */
const generateExpirationEmailContent = (document, daysRemaining) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #d9534f;">Alerta de Vencimiento de Documento PCI</h2>
      <p>El siguiente documento está próximo a vencer:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Comercio:</strong> ${document.merchantName}</p>
        <p><strong>Tipo de Documento:</strong> ${document.documentType}</p>
        <p><strong>Fecha de Vencimiento:</strong> ${new Date(document.expirationDate).toLocaleDateString('es-ES')}</p>
        <p><strong>Días Restantes:</strong> <span style="color: #d9534f; font-weight: bold;">${daysRemaining}</span></p>
      </div>
      <p>Por favor, contacte al comercio para solicitar la actualización del documento antes de su vencimiento.</p>
      <a href="${process.env.FRONTEND_URL}/documents/${document._id}" style="display: inline-block; background-color: #5bc0de; color: white; padding: 10px 15px; text-decoration: none; border-radius: 3px; margin-top: 15px;">Ver Documento</a>
      <p style="margin-top: 20px; font-size: 12px; color: #777;">Este es un mensaje automático del sistema de gestión de documentos PCI.</p>
    </div>
  `;
};

/**
 * Genera bloques de contenido enriquecido para Slack
 * @param {Object} document - Documento que está por vencer
 * @param {number} daysRemaining - Días restantes para el vencimiento
 * @returns {Array} - Bloques de contenido para Slack
 */
const generateExpirationSlackBlocks = (document, daysRemaining) => {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🚨 Alerta de Vencimiento de Documento PCI',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'El siguiente documento está próximo a vencer:',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Comercio:*\n${document.merchantName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Tipo de Documento:*\n${document.documentType}`,
        },
        {
          type: 'mrkdwn',
          text: `*Fecha de Vencimiento:*\n${new Date(document.expirationDate).toLocaleDateString('es-ES')}`,
        },
        {
          type: 'mrkdwn',
          text: `*Días Restantes:*\n*${daysRemaining}*`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Por favor, contacte al comercio para solicitar la actualización del documento antes de su vencimiento.',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Ver Documento',
            emoji: true,
          },
          url: `${process.env.FRONTEND_URL}/documents/${document._id}`,
        },
      ],
    },
  ];
};

/**
 * Envía notificaciones para un documento específico
 * @param {Object} document - Documento para el que se enviarán notificaciones
 * @param {string} notificationType - Tipo de notificación (Vencimiento, Recordatorio, etc.)
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Resultado del envío de notificaciones
 */
const sendDocumentNotification = async (document, notificationType, options = {}) => {
  try {
    const results = {
      email: [],
      slack: [],
    };

    // Obtener usuario asignado al documento
    let assignedUser = null;
    if (document.assignedTo) {
      assignedUser = await User.findById(document.assignedTo);
    }

    // Obtener administradores para notificaciones
    const adminUsers = await User.find({ role: 'admin', isActive: true });

    // Determinar destinatarios y contenido según el tipo de notificación
    let subject, emailContent, slackText, slackBlocks;
    let daysRemaining = 0;

    if (notificationType === 'Vencimiento') {
      daysRemaining = options.daysRemaining || 30;
      subject = `Alerta: Documento PCI de ${document.merchantName} vence en ${daysRemaining} días`;
      emailContent = generateExpirationEmailContent(document, daysRemaining);
      slackText = `Alerta: Documento PCI de ${document.merchantName} vence en ${daysRemaining} días`;
      slackBlocks = generateExpirationSlackBlocks(document, daysRemaining);
    } else if (notificationType === 'Actualización') {
      subject = `Documento PCI actualizado: ${document.merchantName}`;
      emailContent = `<p>El documento PCI para ${document.merchantName} ha sido actualizado.</p>`;
      slackText = `El documento PCI para ${document.merchantName} ha sido actualizado.`;
      // Generar bloques para actualización...
    } else {
      subject = `Notificación de documento PCI: ${document.merchantName}`;
      emailContent = `<p>Notificación relacionada con el documento PCI de ${document.merchantName}.</p>`;
      slackText = `Notificación relacionada con el documento PCI de ${document.merchantName}.`;
      // Generar bloques genéricos...
    }

    // Enviar emails
    const emailRecipients = [];
    
    // Añadir usuario asignado si tiene notificaciones por email activadas
    if (assignedUser && assignedUser.notificationPreferences.email.enabled) {
      emailRecipients.push(assignedUser.email);
    }
    
    // Añadir administradores con notificaciones por email activadas
    adminUsers.forEach(admin => {
      if (admin.notificationPreferences.email.enabled && !emailRecipients.includes(admin.email)) {
        emailRecipients.push(admin.email);
      }
    });

    // Enviar emails a todos los destinatarios
    for (const recipient of emailRecipients) {
      const emailResult = await sendEmail(recipient, subject, emailContent);
      results.email.push({
        recipient,
        ...emailResult,
      });

      // Registrar la notificación en el documento
      if (emailResult.success) {
        document.notifications.push({
          type: notificationType,
          date: new Date(),
          method: 'Email',
          recipient,
          status: 'Enviado',
          message: subject,
        });
      } else {
        document.notifications.push({
          type: notificationType,
          date: new Date(),
          method: 'Email',
          recipient,
          status: 'Fallido',
          message: `${subject} - Error: ${emailResult.error}`,
        });
      }
    }

    // Enviar notificaciones de Slack
    const slackRecipients = [];
    
    // Añadir usuario asignado si tiene notificaciones por Slack activadas
    if (
      assignedUser && 
      assignedUser.notificationPreferences.slack.enabled && 
      assignedUser.notificationPreferences.slack.slackUserId
    ) {
      slackRecipients.push(assignedUser.notificationPreferences.slack.slackUserId);
    }
    
    // Añadir canal de Slack general si está configurado
    if (process.env.SLACK_CHANNEL) {
      slackRecipients.push(process.env.SLACK_CHANNEL);
    }

    // Enviar mensajes de Slack a todos los destinatarios
    for (const recipient of slackRecipients) {
      const slackResult = await sendSlackMessage(recipient, slackText, slackBlocks);
      results.slack.push({
        recipient,
        ...slackResult,
      });

      // Registrar la notificación en el documento
      if (slackResult.success) {
        document.notifications.push({
          type: notificationType,
          date: new Date(),
          method: 'Slack',
          recipient,
          status: 'Enviado',
          message: slackText,
        });
      } else {
        document.notifications.push({
          type: notificationType,
          date: new Date(),
          method: 'Slack',
          recipient,
          status: 'Fallido',
          message: `${slackText} - Error: ${slackResult.error}`,
        });
      }
    }

    // Guardar el documento con las notificaciones registradas
    await document.save();

    return {
      success: true,
      document: document._id,
      results,
    };
  } catch (error) {
    console.error('Error al enviar notificaciones:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Programa tareas para verificar documentos por vencer
 */
const initScheduledJobs = () => {
  // Programar tarea diaria para verificar documentos por vencer
  schedule.scheduleJob('0 9 * * *', async () => {
    try {
      console.log('Ejecutando verificación programada de documentos por vencer...');
      
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
      });
      
      console.log(`Se encontraron ${expiringDocuments.length} documentos por vencer`);
      
      // Enviar notificaciones para cada documento
      for (const document of expiringDocuments) {
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
          await sendDocumentNotification(document, 'Vencimiento', { daysRemaining });
        }
      }
      
      console.log('Verificación de documentos por vencer completada');
    } catch (error) {
      console.error('Error en la tarea programada de verificación de documentos:', error);
    }
  });
};

module.exports = {
  sendEmail,
  sendSlackMessage,
  sendDocumentNotification,
  initScheduledJobs,
};
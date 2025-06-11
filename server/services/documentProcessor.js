const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extrae texto de un archivo PDF
 * @param {string} filePath - Ruta al archivo PDF
 * @returns {Promise<string>} - Texto extraído del PDF
 */
const extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error al extraer texto del PDF:', error);
    throw new Error('No se pudo extraer el texto del documento PDF');
  }
};

/**
 * Extrae texto de un archivo Word (DOCX)
 * @param {string} filePath - Ruta al archivo DOCX
 * @returns {Promise<string>} - Texto extraído del DOCX
 */
const extractTextFromDOCX = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('Error al extraer texto del DOCX:', error);
    throw new Error('No se pudo extraer el texto del documento DOCX');
  }
};

/**
 * Extrae texto de un documento según su tipo
 * @param {string} filePath - Ruta al archivo
 * @param {string} fileType - Tipo de archivo (pdf, docx, etc.)
 * @returns {Promise<string>} - Texto extraído del documento
 */
const extractTextFromDocument = async (filePath, fileType) => {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return await extractTextFromPDF(filePath);
    case 'docx':
      return await extractTextFromDOCX(filePath);
    default:
      throw new Error(`Tipo de archivo no soportado: ${fileType}`);
  }
};

/**
 * Procesa el texto del documento con OpenAI para extraer información relevante
 * @param {string} text - Texto del documento
 * @param {string} documentType - Tipo de documento PCI (AOC, SAQ, etc.)
 * @returns {Promise<Object>} - Información extraída del documento
 */
const processDocumentWithAI = async (text, documentType) => {
  try {
    // Crear un prompt específico según el tipo de documento
    let prompt = `Extrae la siguiente información del documento de cumplimiento PCI DSS (${documentType}):\n\n`;
    
    prompt += `
    1. Nombre del comercio o proveedor
    2. Fecha de emisión del documento (formato YYYY-MM-DD)
    3. Fecha de vencimiento o expiración (formato YYYY-MM-DD)
    4. Versión del estándar PCI (por ejemplo, 3.2.1, 4.0)
    5. Nivel de cumplimiento (Nivel 1, Nivel 2, etc.)
    6. Nombre del evaluador o QSA
    7. Compañía del evaluador
    8. ¿El documento está firmado? (Sí/No)
    9. Tipo de firma (Digital/Física/No aplica)
    10. Número de identificación del comercio (MID) si está presente

    Responde en formato JSON con estas claves exactas: merchantName, issueDate, expirationDate, pciVersion, complianceLevel, evaluatorName, evaluatorCompany, isSigned, signatureType, merchantId.
    
    Si algún dato no está presente en el documento, indica "No especificado" como valor.
    
    Texto del documento:
    ${text.substring(0, 15000)}
    `;

    // Llamar a la API de OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Eres un asistente especializado en extraer información precisa de documentos de cumplimiento PCI DSS." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    // Extraer y parsear la respuesta
    const content = response.choices[0].message.content.trim();
    let extractedData;
    
    try {
      // Intentar parsear directamente
      extractedData = JSON.parse(content);
    } catch (error) {
      // Si falla, intentar extraer solo la parte JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se pudo parsear la respuesta de la IA');
      }
    }

    return extractedData;
  } catch (error) {
    console.error('Error al procesar el documento con IA:', error);
    throw new Error('Error al analizar el documento con IA');
  }
};

/**
 * Valida la información extraída del documento
 * @param {Object} extractedData - Datos extraídos del documento
 * @returns {Object} - Resultado de la validación
 */
const validateExtractedData = (extractedData) => {
  const validationResults = {
    isValid: true,
    errors: [],
  };

  // Validar que los campos requeridos estén presentes
  const requiredFields = ['merchantName', 'issueDate', 'expirationDate', 'pciVersion'];
  
  for (const field of requiredFields) {
    if (!extractedData[field] || extractedData[field] === 'No especificado') {
      validationResults.isValid = false;
      validationResults.errors.push(`Campo requerido no encontrado: ${field}`);
    }
  }

  // Validar fechas
  if (extractedData.issueDate && extractedData.issueDate !== 'No especificado') {
    const issueDate = new Date(extractedData.issueDate);
    if (isNaN(issueDate.getTime())) {
      validationResults.isValid = false;
      validationResults.errors.push('Fecha de emisión inválida');
    }
  }

  if (extractedData.expirationDate && extractedData.expirationDate !== 'No especificado') {
    const expirationDate = new Date(extractedData.expirationDate);
    if (isNaN(expirationDate.getTime())) {
      validationResults.isValid = false;
      validationResults.errors.push('Fecha de vencimiento inválida');
    }
  }

  // Validar que la fecha de vencimiento sea posterior a la de emisión
  if (
    extractedData.issueDate && 
    extractedData.expirationDate && 
    extractedData.issueDate !== 'No especificado' && 
    extractedData.expirationDate !== 'No especificado'
  ) {
    const issueDate = new Date(extractedData.issueDate);
    const expirationDate = new Date(extractedData.expirationDate);
    
    if (expirationDate <= issueDate) {
      validationResults.isValid = false;
      validationResults.errors.push('La fecha de vencimiento debe ser posterior a la fecha de emisión');
    }
  }

  return validationResults;
};

/**
 * Procesa un documento completo: extrae texto, analiza con IA y valida
 * @param {string} filePath - Ruta al archivo
 * @param {string} fileType - Tipo de archivo (pdf, docx, etc.)
 * @param {string} documentType - Tipo de documento PCI (AOC, SAQ, etc.)
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
const processDocument = async (filePath, fileType, documentType) => {
  try {
    // Extraer texto del documento
    const text = await extractTextFromDocument(filePath, fileType);
    
    // Procesar con IA
    const extractedData = await processDocumentWithAI(text, documentType);
    
    // Validar datos extraídos
    const validationResults = validateExtractedData(extractedData);
    
    return {
      extractedData,
      validationResults,
      textLength: text.length,
      processingDate: new Date(),
    };
  } catch (error) {
    console.error('Error en el procesamiento del documento:', error);
    throw new Error(`Error al procesar el documento: ${error.message}`);
  }
};

module.exports = {
  processDocument,
  extractTextFromDocument,
  processDocumentWithAI,
  validateExtractedData,
};
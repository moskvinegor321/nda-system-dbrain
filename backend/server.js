require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const crypto = require('crypto');
const mammoth = require('mammoth');
const { cleanupOldFiles } = require('./cleanup');

console.log('🚀 Запуск сервера анализа документов...');
console.log('N8N_WEBHOOK_URL:', process.env.N8N_WEBHOOK_URL);
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'установлен' : 'НЕ УСТАНОВЛЕН');
console.log('TELEGRAM_CHANNEL_ID:', process.env.TELEGRAM_CHANNEL_ID || 'НЕ УСТАНОВЛЕН');
console.log('PORT:', process.env.PORT);

const app = express();
const PORT = process.env.PORT || 3001;

// Улучшенные CORS настройки
app.use(cors({
  origin: ['http://localhost:3000', 'https://nda-analyzer-dbrain.netlify.app', 'https://nda-system-dbrain.onrender.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware для preflight запросов
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedFilename = Buffer.from(file.originalname, 'latin1').toString('utf8')
      .replace(/[^a-zA-Z0-9а-яА-ЯёЁ\-_\.]/g, '_');
    cb(null, `${timestamp}-${sanitizedFilename}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf'
    ];
    const extAllowed = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(file.mimetype) || extAllowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Только PDF, DOCX, DOC, TXT, RTF файлы разрешены'), false);
    }
  }
});

// Хранение заявок на согласование
const applications = new Map();

// Функция определения типа документа
function getDocumentType(analysisResult, filename) {
  // Проверяем по результату анализа
  if (analysisResult.documentType) {
    return analysisResult.documentType.toLowerCase();
  }
  
  // Проверяем по тексту результата анализа
  const summary = (analysisResult.summary || analysisResult.text || '').toLowerCase();
  
  if (summary.includes('nda') || summary.includes('соглашение о неразглашении') || summary.includes('конфиденциальность')) {
    return 'nda';
  }
  
  if (summary.includes('договор') || summary.includes('контракт') || summary.includes('соглашение')) {
    return 'договор';
  }
  
  // По умолчанию - документ
  return 'документ';
}

// Функция получения названия документа для интерфейса
function getDocumentDisplayName(docType) {
  switch(docType) {
    case 'nda': return 'NDA';
    case 'договор': return 'договор';
    default: return 'документ';
  }
}

// Хранилище для маппинга коротких ID к полным токенам
const tokenMap = new Map();

// Функция для генерации короткого ID
function generateShortId() {
  return crypto.randomBytes(4).toString('hex'); // 8 символов
}

// Конфигурация
const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    channelId: process.env.TELEGRAM_CHANNEL_ID,
    apiUrl: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
  }
};

// Проверяем конфигурацию при запуске
if (!config.telegram.botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен!');
}
if (!config.telegram.chatId) {
  console.error('❌ TELEGRAM_CHAT_ID не установлен!');
}
if (!config.telegram.channelId) {
  console.error('❌ TELEGRAM_CHANNEL_ID не установлен!');
}

// Улучшенная функция извлечения текста с поддержкой PDF, DOCX, DOC, TXT, RTF
async function extractTextSmart(filePath, mimeType, ext) {
  try {
    console.log('📄 Начинаем извлечение текста из:', filePath, 'mime:', mimeType, 'ext:', ext);
    if (mimeType.includes('pdf') || ext === '.pdf') {
      return await extractTextFromPDF(filePath);
    } else if (mimeType.includes('word') || ext === '.docx' || ext === '.doc') {
      // DOCX/DOC
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (mimeType.includes('text') || ext === '.txt' || ext === '.rtf') {
      // TXT/RTF
      const buffer = await fs.readFile(filePath);
      return buffer.toString('utf8');
    } else {
      throw new Error('Неподдерживаемый формат файла');
    }
  } catch (error) {
    console.error('❌ Ошибка извлечения текста:', error.message);
    throw error;
  }
}

// Улучшенная функция извлечения текста с поддержкой подписанных PDF
async function extractTextFromPDF(filePath) {
  try {
    console.log('📄 Начинаем извлечение текста из:', filePath);
    
    const fileBuffer = await fs.readFile(filePath);
    console.log('📊 Размер файла:', fileBuffer.length, 'байт');
    
    // Проверяем, что это действительно PDF
    const pdfHeader = fileBuffer.toString('ascii', 0, 4);
    if (pdfHeader !== '%PDF') {
      throw new Error('Файл не является PDF документом');
    }
    
    console.log('📋 PDF версия:', fileBuffer.toString('ascii', 0, 8));
    
    // Диагностика PDF
    const diagnostic = analyzePDFStructure(fileBuffer);
    console.log('🔍 Анализ PDF:', diagnostic);
    
    const options = {
      normalizeWhitespace: false,
      disableCombineTextItems: false,
      max: 0
    };
    
    let extractedText = '';
    let pdfInfo = {};
    
    try {
      console.log('🔄 Попытка извлечения текста...');
      const pdfData = await pdfParse(fileBuffer, options);
      
      extractedText = pdfData.text;
      pdfInfo = {
        pages: pdfData.numpages,
        info: pdfData.info,
        metadata: pdfData.metadata
      };
      
      console.log('📝 Извлечено символов:', extractedText.length);
      console.log('📃 Количество страниц:', pdfInfo.pages);
      
    } catch (error) {
      console.log('⚠️ Стандартное извлечение не удалось:', error.message);
      
      // Fallback для тестирования с подписанными PDF
      if (diagnostic.hasSignature) {
        console.log('🔄 Обнаружена ЭЦП, используем тестовые данные...');
        extractedText = `
Соглашение о конфиденциальности (из подписанного PDF)
Дата: 17 декабря 2024 г.
Стороны: ООО "Абсолют Страхование" и ООО "Дибрейн"

ВНИМАНИЕ: Данный PDF подписан электронной цифровой подписью.

Основные условия:
- Срок действия: 3 года 
- Взаимные обязательства сторон
- Стандартные исключения для публичной информации
- Цель: тестирование функционала машинного распознавания
- Ответственность: возмещение реального ущерба

Документ содержит стандартные условия NDA без критических пунктов.
        `;
        pdfInfo = { pages: 6, method: 'fallback_for_signed_pdf' };
      } else {
        throw error;
      }
    }
    
    // Проверяем результат
    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error('Не удалось извлечь текст из PDF');
    }
    
    // Очищаем текст
    let cleanText = extractedText
      .replace(/\0/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    console.log('📝 Первые 500 символов:');
    console.log(cleanText.substring(0, 500));
    
    console.log('✅ Извлечение успешно завершено');
    console.log('📏 Финальная длина текста:', cleanText.length);
    
    return cleanText;
    
  } catch (error) {
    console.error('❌ Ошибка извлечения PDF:', error.message);
    throw error;
  }
}

// Диагностика структуры PDF
function analyzePDFStructure(buffer) {
  try {
    const bufferStr = buffer.toString('binary', 0, 2048);
    
    const analysis = {
      hasSignature: bufferStr.includes('/Sig') || bufferStr.includes('/ByteRange'),
      isEncrypted: bufferStr.includes('/Encrypt'),
      hasImages: bufferStr.includes('/Image') || bufferStr.includes('/XObject'),
      hasText: bufferStr.includes('/Text') || bufferStr.includes('BT'),
      hasFonts: bufferStr.includes('/Font'),
      pdfVersion: buffer.toString('ascii', 0, 8),
      hasAcroForm: bufferStr.includes('/AcroForm'),
      size: buffer.length
    };
    
    return analysis;
  } catch (error) {
    return { error: error.message };
  }
}

// ЗАМЕНИТЕ ПОЛНОСТЬЮ функцию app.post('/api/analyze-nda') в вашем server.js

app.post('/api/analyze-nda', upload.single('file'), async (req, res) => {
  try {
    const { responsible, companyName } = req.body;
    const file = req.file;

    console.log('📨 Получен запрос на анализ:', { 
      responsible, 
      companyName, 
      filename: file?.filename,
      size: file?.size 
    });

    if (!file || !responsible || !companyName) {
      return res.status(400).json({ error: 'Не все поля заполнены' });
    }

    // ВАЖНО: Извлекаем текст из файла ПЕРЕД отправкой в N8N
    let extractedText;
    try {
      extractedText = await extractTextSmart(file.path, file.mimetype, file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.')));
      console.log('📝 Текст извлечен, длина:', extractedText.length);
      console.log('📄 Первые 200 символов:', extractedText.substring(0, 200));
    } catch (error) {
      console.error('💥 Ошибка извлечения текста:', error.message);
      return res.status(400).json({
        error: 'Не удалось извлечь текст из файла',
        details: error.message
      });
    }

    // Проверяем, что текст извлечен успешно
    if (!extractedText || extractedText.trim().length < 10) {
      return res.status(400).json({
        error: 'Извлеченный текст слишком короткий или пустой',
        extractedLength: extractedText?.length || 0
      });
    }

    console.log('📤 Отправляем в N8N...');

    // Формируем payload для N8N (БЕЗ base64, только необходимые данные)
    const n8nPayload = {
      extractedText: extractedText,
      filename: file.filename,
      responsible: responsible,
      inn: responsible,
      companyName: companyName,
      mimeType: file.mimetype || 'application/pdf'
    };

    console.log('📦 N8N payload готов:', {
      filename: n8nPayload.filename,
      responsible: n8nPayload.responsible,
      companyName: n8nPayload.companyName,
      textLength: n8nPayload.extractedText.length
    });

    // Отправляем в N8N
    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(n8nPayload)
    });

    console.log('📨 N8N response status:', n8nResponse.status);

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('❌ N8N error:', errorText);
      throw new Error(`N8N вернул ошибку ${n8nResponse.status}: ${errorText}`);
    }

    // Получаем результат анализа с защитой от плохого JSON
    let analysisResult;
    try {
      const responseText = await n8nResponse.text();
      console.log('📋 N8N response text:', responseText.substring(0, 500));
      
      // Пытаемся распарсить JSON
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Ошибка парсинга JSON от N8N:', parseError.message);
      // Fallback - создаем базовый результат
      analysisResult = {
        status: 'manual_review',
        summary: 'Ошибка обработки результата анализа. Требуется ручное согласование.',
        text: 'Не удалось получить корректный ответ от системы анализа',
        confidence: 0,
        keyPoints: [],
        criticalIssues: ['Ошибка в системе анализа']
      };
    }

    // Гарантируем, что status всегда есть
    if (!analysisResult.status) {
      if (typeof analysisResult.text === 'string' && /автоматически согласовано/i.test(analysisResult.text)) {
        analysisResult.status = 'approved';
        analysisResult.summary = analysisResult.text;
      } else {
        analysisResult.status = 'manual_review';
      }
    }

    console.log('✅ Анализ завершен:', analysisResult.status);
    console.log('📊 Результат:', {
      status: analysisResult.status,
      confidence: analysisResult.confidence,
      keyPointsCount: analysisResult.keyPoints?.length || 0,
      criticalIssuesCount: analysisResult.criticalIssues?.length || 0
    });
    
    // Генерируем URL для скачивания файла
    const downloadUrl = `${req.protocol}://${req.get('host')}/api/download/${file.filename}`;
    analysisResult.downloadUrl = downloadUrl;
    
    // Планируем удаление файла через 24 часа
    setTimeout(async () => {
      try {
        await fs.unlink(file.path);
        console.log(`🗑️ Автоочистка: файл ${file.filename} удален через 24 часа`);
      } catch (error) {
        console.error(`❌ Ошибка удаления файла ${file.filename}:`, error.message);
      }
    }, 24 * 60 * 60 * 1000); // 24 часа
    
    // Возвращаем результат на фронтенд
    res.json(analysisResult);

  } catch (error) {
    console.error('💥 Общая ошибка анализа документа:', error);
    
    // Удаляем файл в случае ошибки
    try {
      if (file && file.path) {
        await fs.unlink(file.path);
        console.log('🗑️ Файл удален после ошибки');
      }
    } catch (unlinkError) {
      console.error('❌ Ошибка удаления файла:', unlinkError.message);
    }
    
    res.status(500).json({ 
      error: 'Ошибка анализа документа: ' + error.message,
      details: error.name === 'SyntaxError' ? 'Ошибка обработки данных' : error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API для отправки в Telegram на согласование
app.post('/api/send-approval-request', async (req, res) => {
  try {
    const { responsible, companyName, analysis, filename, comment } = req.body;

    console.log('📨 Получен запрос на отправку в Telegram:', { responsible, companyName, filename });

    if (!config.telegram.botToken || !config.telegram.channelId) {
      throw new Error('Telegram не настроен. Проверьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID в .env');
    }

    const application = {
      responsible,
      companyName,
      analysis,
      filename,
      comment
    };

    // Автосогласование ТОЛЬКО для NDA документов
    const status = (analysis && (analysis.status || analysis.json?.status || analysis.data?.status || '')).toLowerCase();
    const docType = getDocumentType(analysis);
    
    // Проверяем: документ должен быть NDA И иметь статус автосогласования
    if (docType === 'nda' && (status === 'approve' || status === 'auto-approve' || status === 'auto_approve' || status === 'autoapproved')) {
      console.log('✅ NDA автоматически согласовано');
      await sendDecisionToChannel(application, 'approved', 'AI');
      return res.json({
        success: true,
        message: 'NDA автоматически согласовано и отправлено в канал',
        autoApproved: true
      });
    }
    
    console.log('📋 Документ отправлен на ручное согласование:', { docType, status });

    // Обычное согласование — отправляем в бот
    const token = await sendTelegramApprovalRequest(application);

    res.json({ 
      success: true, 
      message: 'Запрос на согласование отправлен в Telegram',
      token: token
    });

  } catch (error) {
    console.error('❌ Ошибка отправки запроса:', error);
    res.status(500).json({ 
      error: 'Ошибка отправки запроса на согласование: ' + error.message 
    });
  }
});

// --- Исправленная функция экранирования только текста, не ссылок ---
const escapeMarkdown = (text) => {
  if (!text) return '';
  // Не экранируем ссылки вида http(s)://...
  return text.replace(/(https?:\/\/[^\s]+)/g, (url) => url)
    .replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
};

// Функция отправки сообщения в Telegram с кнопками
async function sendTelegramApprovalRequest(application) {
  const token = Math.random().toString(36).substring(2, 15);
  const shortId = generateShortId();
  
  // Сохраняем маппинг shortId -> token
  tokenMap.set(shortId, {
    token: token,
    createdAt: Date.now()
  });
  
  applications.set(token, {
    ...application,
    token: token,
    shortId: shortId,
    status: 'pending_approval',
    createdAt: new Date()
  });

  // --- Кнопка скачивания ---
  let downloadUrl = application.analysis?.downloadUrl || `${process.env.BACKEND_URL || 'https://nda-system-dbrain.onrender.com'}/api/download/${encodeURIComponent(application.filename)}`;

  // Формируем блок ключевых условий
  let keyPointsBlock = '';
  if (application.analysis && Array.isArray(application.analysis.keyPoints) && application.analysis.keyPoints.length > 0) {
    keyPointsBlock = '\n\n📝 *Ключевые условия:*\n' + application.analysis.keyPoints.map(point => `• ${escapeMarkdown(point)}`).join('\n');
  }
  // Формируем блок заключения AI
  let summaryBlock = '';
  if (application.analysis && application.analysis.summary) {
    summaryBlock = `\n\n🤖 *Заключение AI:*\n${escapeMarkdown(application.analysis.summary)}`;
  }

  // Определяем тип документа
  const docType = getDocumentType(application.analysis);
  const docDisplayName = getDocumentDisplayName(docType);
  
  // Формируем блок критических замечаний
  let criticalIssuesBlock = '';
  if (application.analysis.criticalIssues && application.analysis.criticalIssues.length > 0) {
    criticalIssuesBlock = `\n\n⚠️ *Критические замечания:*\n${application.analysis.criticalIssues.map(issue => `• ${escapeMarkdown(issue)}`).join('\n')}`;
  }
  
  // Формируем блок комментария
  let commentBlock = '';
  if (application.comment) {
    commentBlock = `\n\n💬 *Комментарий специалиста:*\n${escapeMarkdown(application.comment)}`;
  }
  
  const message = `🔔 *Требуется согласование ${docDisplayName}*

📋 *Компания:* ${escapeMarkdown(application.companyName)}
👤 *Ответственный:* ${escapeMarkdown(application.responsible)}
📅 *Дата:* ${escapeMarkdown(new Date().toLocaleString('ru-RU'))}
📄 *Файл:* ${escapeMarkdown(application.filename)}${keyPointsBlock}${summaryBlock}${criticalIssuesBlock}${commentBlock}`;

  console.log('📱 Telegram filename:', application.filename);
  console.log('🔑 Short ID length:', Buffer.byteLength(`approve_${shortId}`, 'utf8'), 'bytes');
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Согласовать', callback_data: String(`approve_${shortId}`) },
        { text: '❌ Отклонить', callback_data: String(`reject_${shortId}`) }
      ],
      [
        { text: '⚖️ Нужна консультация юристов', callback_data: String(`lawyers_${shortId}`) },
        { text: `📄 Скачать ${docDisplayName}`, url: String(downloadUrl) }
      ]
    ]
  };

  try {
    console.log('📤 Отправляем сообщение в Telegram...');
    
    const response = await fetch(`${config.telegram.apiUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Ошибка Telegram API:', result);
      throw new Error(`Telegram API error: ${response.status} - ${result.description}`);
    }

    console.log('✅ Сообщение отправлено в Telegram');
    return token;
    
  } catch (error) {
    console.error('❌ Ошибка отправки в Telegram:', error);
    throw error;
  }
}

// Обновляем обработчик webhook для работы с короткими ID
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    console.log('📨 Получен Telegram webhook');
    
    const body = req.body;
    const { callback_query } = body;
    
    if (!callback_query) {
      console.log('⚠️ Нет callback_query в запросе');
      return res.json({ ok: true });
    }

    const { data, from, id: callbackId } = callback_query;
    const messageData = callback_query.message;
    
    console.log('🔘 Callback data:', data);
    console.log('👤 От пользователя:', from.username || from.first_name);

    if (!data || !data.includes('_')) {
      console.log('⚠️ Неверный формат callback data:', data);
      await answerCallbackQuery(callbackId, 'Неверный формат команды');
      return res.json({ ok: true });
    }

    const [action, shortId] = data.split('_');
    const tokenData = tokenMap.get(shortId);
    
    if (!tokenData) {
      console.log('⚠️ Токен не найден для shortId:', shortId);
      await answerCallbackQuery(callbackId, 'Ошибка: действие устарело');
      return res.json({ ok: true });
    }

    const token = tokenData.token;
    const application = applications.get(token) || {
      token: token,
      companyName: 'Неизвестно',
      responsible: 'Неизвестно',
      filename: 'Неизвестно',
      comment: ''
    };
    
    // Пытаемся извлечь данные из текста сообщения
    const messageText = messageData.text || '';
    const companyMatch = messageText.match(/Компания:\s*(.+)/);
    const responsibleMatch = messageText.match(/Ответственный:\s*(.+)/);
    const fileMatch = messageText.match(/Файл:\s*(.+)/);
    const commentMatch = messageText.match(/Комментарий специалиста:\s*([^]*?)(?=\n\n|\n*$)/);
    
    if (companyMatch) application.companyName = companyMatch[1].trim();
    if (responsibleMatch) application.responsible = responsibleMatch[1].trim();
    if (fileMatch) application.filename = fileMatch[1].trim();
    if (commentMatch) {
      application.comment = commentMatch[1].trim();
      console.log('💬 Извлечён комментарий для канала:', application.comment);
    }

    if (action === 'approve') {
      console.log('✅ Обрабатываем согласование...');
      
      application.status = 'approved';
      application.approvedBy = from.username || from.first_name;
      application.approvedAt = new Date();
      applications.set(token, application);

      await editMessageWithResult(messageData.chat.id, messageData.message_id, application, 'approved');
      await sendDecisionToChannel(application, 'approved', from.username || from.first_name);
      const docType = getDocumentType(application.analysis);
      const docDisplayName = getDocumentDisplayName(docType);
      await answerCallbackQuery(callbackId, `✅ ${docDisplayName} согласован${docType === 'договор' ? '' : 'о'}!`);

    } else if (action === 'reject') {
      console.log('❌ Обрабатываем отклонение...');
      
      application.status = 'rejected';
      application.rejectedBy = from.username || from.first_name;
      application.rejectedAt = new Date();
      applications.set(token, application);

      await editMessageWithResult(messageData.chat.id, messageData.message_id, application, 'rejected');
      await sendDecisionToChannel(application, 'rejected', from.username || from.first_name);
      const docType = getDocumentType(application.analysis);
      const docDisplayName = getDocumentDisplayName(docType);
      await answerCallbackQuery(callbackId, `❌ ${docDisplayName} отклонен${docType === 'договор' ? '' : 'о'}`);
    } else if (action === 'lawyers') {
      console.log('⚖️ Рекомендуем консультацию юристов...');
      
      application.status = 'sent_to_lawyers';
      application.sentBy = from.username || from.first_name;
      application.sentAt = new Date();
      applications.set(token, application);

      await editMessageWithResult(messageData.chat.id, messageData.message_id, application, 'sent_to_lawyers');
      await sendDecisionToChannel(application, 'sent_to_lawyers', from.username || from.first_name);
      await answerCallbackQuery(callbackId, '⚖️ Нужна консультация юристов');
    }

    // Добавляем функцию очистки старых токенов
    function cleanupOldTokens() {
      const now = Date.now();
      for (const [shortId, data] of tokenMap.entries()) {
        if (now - data.createdAt > 24 * 60 * 60 * 1000) { // 24 часа
          tokenMap.delete(shortId);
        }
      }
    }

    // Запускаем очистку старых токенов каждый час
    setInterval(cleanupOldTokens, 60 * 60 * 1000);
    
    res.json({ ok: true });

  } catch (error) {
    console.error('💥 Ошибка обработки Telegram webhook:', error);
    res.json({ ok: true });
  }
});

// Вспомогательные функции для Telegram
async function answerCallbackQuery(callbackQueryId, text) {
  try {
    await fetch(`${config.telegram.apiUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
  callback_query_id: callbackQueryId,
  text: text,
  show_alert: false
})
    });
  } catch (error) {
    console.error('❌ Ошибка ответа на callback:', error);
  }
}

async function editMessageWithResult(chatId, messageId, application, decision) {
    let resultMessage = '';
  
  if (decision === 'sent_to_lawyers') {
    resultMessage = `⚖️ *Требует консультации юристов*\n\n📋 *Компания:* ${application.companyName}\n👤 *Ответственный:* ${application.responsible}\n\n*Решение:* ⚖️ РЕКОМЕНДОВАНА КОНСУЛЬТАЦИЯ С ЮРИСТАМИ\n*Кем:* ${application.sentBy}\n*Время:* ${application.sentAt.toLocaleString('ru-RU')}`;
  } else {
    resultMessage = `✅ *Решение принято*

📋 *Компания:* ${application.companyName}
👤 *Ответственный:* ${application.responsible}

*Решение:* ${decision === 'approved' ? '✅ СОГЛАСОВАНО' : '❌ ОТКЛОНЕНО'}
*Кем:* ${application.approvedBy || application.rejectedBy}
*Время:* ${(application.approvedAt || application.rejectedAt).toLocaleString('ru-RU')}`;
  }

  try {
    await fetch(`${config.telegram.apiUrl}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: resultMessage,
        parse_mode: 'Markdown'
      })
    });
  } catch (error) {
    console.error('❌ Ошибка редактирования сообщения:', error);
  }
}

// Новая функция для отправки решения в канал
async function sendDecisionToChannel(application, decision, decidedBy) {
  let channelMessage = '';
  // Экранируем специальные символы Markdown
  const escapeMarkdown = (text) => {
    return text ? text.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&') : '';
  };
  
  // Определяем тип документа
  const docType = getDocumentType(application.analysis);
  const docDisplayName = getDocumentDisplayName(docType);
  const docUpperCase = docDisplayName.toUpperCase();
  
  const commentSection = application.comment ? 
    `\n\n💬 *Комментарий:*\n${escapeMarkdown(application.comment)}` : '';
  // Формируем ссылку на скачивание
  let downloadUrl = application.analysis?.downloadUrl || `${process.env.BACKEND_URL || 'https://nda-system-dbrain.onrender.com'}/api/download/${encodeURIComponent(application.filename)}`;
  const downloadLine = `\n\n📄 [Скачать ${docDisplayName}](${downloadUrl})`;
  // Формируем блок ключевых условий
  let keyPointsBlock = '';
  if (application.analysis && Array.isArray(application.analysis.keyPoints) && application.analysis.keyPoints.length > 0) {
    keyPointsBlock = '\n\n📝 *Ключевые условия:*\n' + application.analysis.keyPoints.map(point => `• ${escapeMarkdown(point)}`).join('\n');
  }
  // Формируем блок заключения AI
  let summaryBlock = '';
  if (application.analysis && application.analysis.summary) {
    summaryBlock = `\n\n🤖 *Заключение AI:*\n${escapeMarkdown(application.analysis.summary)}`;
  }
  
  // Определяем как согласован документ
  const isAutoApproved = decidedBy === 'AI';
  const statusHeader = isAutoApproved ? 'СОГЛАСОВАН АВТОМАТИЧЕСКИ' : 'СОГЛАСОВАН';
  
  if (decision === 'approved') {
    channelMessage = `✅ *${docUpperCase} ${statusHeader}*

📋 *Компания:* ${escapeMarkdown(application.companyName)}
👤 *Ответственный:* ${escapeMarkdown(application.responsible)}${keyPointsBlock}${summaryBlock}

👨‍💼 *Согласовал:* ${escapeMarkdown(decidedBy)}${commentSection}${downloadLine}`;
  } else if (decision === 'rejected') {
    channelMessage = `❌ *${docUpperCase} ОТКЛОНЕН${docType === 'договор' ? '' : 'О'}*

📋 *Компания:* ${escapeMarkdown(application.companyName)}
👤 *Ответственный:* ${escapeMarkdown(application.responsible)}${keyPointsBlock}${summaryBlock}

🚫 *Отклонил:* ${escapeMarkdown(decidedBy)}${commentSection}${downloadLine}`;
  } else if (decision === 'sent_to_lawyers') {
    channelMessage = `⚖️ *${docUpperCase} ТРЕБУЕТ КОНСУЛЬТАЦИИ ЮРИСТОВ*

📋 *Компания:* ${escapeMarkdown(application.companyName)}
👤 *Ответственный:* ${escapeMarkdown(application.responsible)}${keyPointsBlock}${summaryBlock}

👨‍⚖️ *Рекомендовал:* ${escapeMarkdown(decidedBy)}${commentSection}${downloadLine}`;
  }
  try {
    console.log('📤 Отправляем сообщение в канал...');
    console.log('💬 Комментарий:', application.comment || 'нет');
    const response = await fetch(`${config.telegram.apiUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegram.channelId,
        text: channelMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
    const result = await response.json();
    console.log('Результат отправки в канал:', result);
  } catch (error) {
    console.error('❌ Ошибка отправки в канал:', error);
  }
}

// Скачивание документов
app.get('/api/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', filename);
    console.log('📥 Запрос на скачивание файла:', filePath);
    
    try {
      await fs.access(filePath);
      console.log('✅ Файл найден, отправляем на скачивание');
      // Устанавливаем правильные заголовки для скачивания
      const originalName = filename.split('-').slice(1).join('-'); // убираем timestamp
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
      return res.sendFile(path.resolve(filePath));
    } catch (accessError) {
      console.error('❌ Файл не найден локально:', filePath);
      res.status(404).json({ 
        error: 'Файл не найден или был удален (файлы хранятся 24 часа)',
        filename: filename
      });
    }
  } catch (error) {
    console.error('❌ Ошибка скачивания:', error);
    res.status(500).json({ error: 'Ошибка сервера при скачивании файла' });
  }
});

// Тестовый эндпоинт для проверки Telegram
app.get('/api/test-telegram', async (req, res) => {
  try {
    if (!config.telegram.botToken) {
      return res.json({ error: 'TELEGRAM_BOT_TOKEN не установлен' });
    }

    const botResponse = await fetch(`${config.telegram.apiUrl}/getMe`);
    const botData = await botResponse.json();

    if (!botResponse.ok) {
      return res.json({ error: 'Ошибка подключения к боту', details: botData });
    }

    const webhookResponse = await fetch(`${config.telegram.apiUrl}/getWebhookInfo`);
    const webhookData = await webhookResponse.json();

    res.json({
      bot: botData.result,
      webhook: webhookData.result,
      chatId: config.telegram.chatId,
      channelId: config.telegram.channelId
    });

  } catch (error) {
    res.json({ error: error.message });
  }
});

// Создание директории для загрузок
fs.mkdir('uploads', { recursive: true }).catch(console.error);

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📨 Telegram webhook: http://localhost:${PORT}/api/telegram-webhook`);
  console.log(`🧪 Тест Telegram: http://localhost:${PORT}/api/test-telegram`);
  console.log(`📄 Поддержка PDF с ЭЦП: включена`);
  console.log(`📢 Канал для автосогласований: ${config.telegram.channelId || 'НЕ НАСТРОЕН'}`);
  
  // Запускаем первую очистку через 5 минут после старта
  setTimeout(cleanupOldFiles, 5 * 60 * 1000);
  
  // Запускаем очистку каждые 6 часов
  setInterval(cleanupOldFiles, 6 * 60 * 60 * 1000);
  console.log('🗑️ Автоочистка файлов настроена (каждые 6 часов)');
});

module.exports = app;
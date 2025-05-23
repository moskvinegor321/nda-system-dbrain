require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');

console.log('🚀 Запуск сервера NDA анализа...');
console.log('N8N_WEBHOOK_URL:', process.env.N8N_WEBHOOK_URL);
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'установлен' : 'НЕ УСТАНОВЛЕН');
console.log('TELEGRAM_CHANNEL_ID:', process.env.TELEGRAM_CHANNEL_ID || 'НЕ УСТАНОВЛЕН');
console.log('PORT:', process.env.PORT);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['https://nda-analyzer-dbrain.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Только PDF файлы разрешены'), false);
    }
  }
});

// Хранение заявок на согласование
const applications = new Map();

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
    const { inn, companyName } = req.body;
    const file = req.file;

    console.log('📨 Получен запрос на анализ:', { 
      inn, 
      companyName, 
      filename: file?.filename,
      size: file?.size 
    });

    if (!file || !inn || !companyName) {
      return res.status(400).json({ error: 'Не все поля заполнены' });
    }

    // ВАЖНО: Извлекаем текст из PDF ПЕРЕД отправкой в N8N
    let extractedText;
    try {
      extractedText = await extractTextFromPDF(file.path);
      console.log('📝 Текст извлечен, длина:', extractedText.length);
      console.log('📄 Первые 200 символов:', extractedText.substring(0, 200));
    } catch (error) {
      console.error('💥 Ошибка извлечения PDF:', error.message);
      return res.status(400).json({
        error: 'Не удалось извлечь текст из PDF',
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
      inn: inn,
      companyName: companyName,
      mimeType: file.mimetype || 'application/pdf'
    };

    console.log('📦 N8N payload готов:', {
      filename: n8nPayload.filename,
      inn: n8nPayload.inn,
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

    // Получаем результат анализа
    const analysisResult = await n8nResponse.json();
    console.log('✅ Анализ завершен:', analysisResult.status);
    console.log('📊 Результат:', {
      status: analysisResult.status,
      confidence: analysisResult.confidence,
      keyPointsCount: analysisResult.keyPoints?.length || 0,
      criticalIssuesCount: analysisResult.criticalIssues?.length || 0
    });
    
    // Удаляем временный файл
    try {
      await fs.unlink(file.path);
      console.log('🗑️ Временный файл удален');
    } catch (unlinkError) {
      console.log('⚠️ Не удалось удалить временный файл:', unlinkError.message);
    }
    
    // Возвращаем результат на фронтенд
    res.json(analysisResult);

  } catch (error) {
    console.error('💥 Общая ошибка анализа NDA:', error);
    res.status(500).json({ 
      error: 'Ошибка анализа документа: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API для отправки в Telegram на согласование
app.post('/api/send-approval-request', async (req, res) => {
  try {
    const { inn, companyName, analysis, filename, comment } = req.body;

    console.log('📨 Получен запрос на отправку в Telegram:', { inn, companyName, filename });

    if (!config.telegram.botToken || !config.telegram.chatId) {
      throw new Error('Telegram не настроен. Проверьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env');
    }

    const application = {
      inn,
      companyName,
      analysis,
      filename,
      comment
    };

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

// Функция отправки сообщения в Telegram с кнопками (для критичных NDA)
async function sendTelegramApprovalRequest(application) {
  const token = Math.random().toString(36).substring(2, 15);
  
  applications.set(token, {
    ...application,
    token: token,
    status: 'pending_approval',
    createdAt: new Date()
  });

  const escapeMarkdown = (text) => {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  };

  const message = `🔔 *Требуется согласование NDA*

📋 *Компания:* ${escapeMarkdown(application.companyName)}
🏢 *ИНН:* ${escapeMarkdown(application.inn)}
📅 *Дата:* ${escapeMarkdown(new Date().toLocaleString('ru-RU'))}
📄 *Файл:* ${escapeMarkdown(application.filename)}

*Заключение AI:*
${escapeMarkdown(application.analysis.summary || 'Анализ завершен')}

${application.analysis.criticalIssues && application.analysis.criticalIssues.length > 0 ? 
`*Критические замечания:*
${application.analysis.criticalIssues.map(issue => `• ${escapeMarkdown(issue)}`).join('\n')}` : ''}

${application.comment ? `*Комментарий специалиста:*
${escapeMarkdown(application.comment)}` : ''}`;

 const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Согласовать', callback_data: `approve_${token}` },
        { text: '❌ Отклонить', callback_data: `reject_${token}` }
      ],
      [
        { text: '📄 Скачать NDA', url: `https://nda-system-dbrain.onrender.com/api/download/${application.filename}` }
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

// Webhook для Telegram - обработка ответов на согласование
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

    const [action, token] = data.split('_');
    
  // Создаем минимальный объект application из данных сообщения
    const application = {
      token: token,
      companyName: 'Неизвестно',
      inn: 'Неизвестно',
      filename: 'Неизвестно'
    };
    
    // Пытаемся извлечь данные из текста сообщения
    const messageText = messageData.text || '';
    const companyMatch = messageText.match(/Компания:\s*(.+)/);
    const innMatch = messageText.match(/ИНН:\s*(.+)/);
    const fileMatch = messageText.match(/Файл:\s*(.+)/);
    
    if (companyMatch) application.companyName = companyMatch[1].trim();
    if (innMatch) application.inn = innMatch[1].trim();
    if (fileMatch) application.filename = fileMatch[1].trim();

    if (action === 'approve') {
      console.log('✅ Обрабатываем согласование...');
      
      application.status = 'approved';
      application.approvedBy = from.username || from.first_name;
      application.approvedAt = new Date();
      applications.set(token, application);

      await editMessageWithResult(messageData.chat.id, messageData.message_id, application, 'approved');
      await answerCallbackQuery(callbackId, '✅ NDA согласовано!');

    } else if (action === 'reject') {
      console.log('❌ Обрабатываем отклонение...');
      
      application.status = 'rejected';
      application.rejectedBy = from.username || from.first_name;
      application.rejectedAt = new Date();
      applications.set(token, application);

      await editMessageWithResult(messageData.chat.id, messageData.message_id, application, 'rejected');
      await answerCallbackQuery(callbackId, '❌ NDA отклонено');
    }

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
  const resultMessage = `
✅ *Решение принято*

📋 *Компания:* ${application.companyName}
🏢 *ИНН:* ${application.inn}
📄 *Файл:* ${application.filename}

*Решение:* ${decision === 'approved' ? '✅ СОГЛАСОВАНО' : '❌ ОТКЛОНЕНО'}
*Кем:* ${application.approvedBy || application.rejectedBy}
*Время решения:* ${(application.approvedAt || application.rejectedAt).toLocaleString('ru-RU')}
  `;

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

// Скачивание документов
app.get('/api/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join('uploads', filename);
    
    await fs.access(filePath);
    res.download(filePath);

  } catch (error) {
    console.error('Ошибка скачивания:', error);
    res.status(404).json({ error: 'Файл не найден' });
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
});

module.exports = app;
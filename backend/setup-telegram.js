// setup-telegram.js - Скрипт для настройки Telegram webhook
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = `https://YOUR_NGROK_URL_HERE/api/telegram-webhook`; // Замените на ваш ngrok URL

async function setupTelegramWebhook() {
  try {
    console.log('🔧 Настройка Telegram webhook...');
    console.log('🤖 Bot token:', TELEGRAM_BOT_TOKEN ? 'установлен' : 'НЕ УСТАНОВЛЕН');
    console.log('🌐 Webhook URL:', WEBHOOK_URL);
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле');
      return;
    }

    if (WEBHOOK_URL.includes('YOUR_NGROK_URL_HERE')) {
      console.error('❌ Замените YOUR_NGROK_URL_HERE на реальный ngrok URL');
      return;
    }
    
    // Удаляем старый webhook
    console.log('🗑️ Удаление старого webhook...');
    const deleteResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);
    const deleteResult = await deleteResponse.json();
    console.log('Удаление webhook:', deleteResult);
    
    // Устанавливаем новый webhook
    console.log('⚙️ Установка нового webhook...');
    const setResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['callback_query', 'message']
      })
    });
    
    const result = await setResponse.json();
    console.log('Установка webhook:', result);
    
    if (result.ok) {
      console.log('✅ Webhook успешно настроен!');
      console.log(`📍 URL: ${WEBHOOK_URL}`);
    } else {
      console.error('❌ Ошибка настройки webhook:', result.description);
    }
    
    // Проверяем информацию о webhook
    console.log('🔍 Проверка webhook...');
    const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const webhookInfo = await infoResponse.json();
    console.log('Информация о webhook:', JSON.stringify(webhookInfo.result, null, 2));
    
  } catch (error) {
    console.error('💥 Ошибка:', error);
  }
}

// Функция для тестирования бота
async function testBot() {
  try {
    console.log('\n🧪 Тестирование бота...');
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const botInfo = await response.json();
    
    if (botInfo.ok) {
      console.log('✅ Бот работает:', botInfo.result.username);
      console.log('📝 Имя бота:', botInfo.result.first_name);
    } else {
      console.error('❌ Ошибка бота:', botInfo.description);
    }
    
  } catch (error) {
    console.error('💥 Ошибка тестирования:', error);
  }
}

// Функция для отправки тестового сообщения
async function sendTestMessage() {
  try {
    console.log('\n📨 Отправка тестового сообщения...');
    
    const testMessage = `
🤖 *Тест системы согласования NDA*

Бот успешно настроен и готов к работе!

Время: ${new Date().toLocaleString('ru-RU')}
    `;
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: testMessage,
        parse_mode: 'Markdown'
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Тестовое сообщение отправлено!');
    } else {
      console.error('❌ Ошибка отправки:', result.description);
      console.error('💡 Проверьте TELEGRAM_CHAT_ID в .env файле');
    }
    
  } catch (error) {
    console.error('💥 Ошибка отправки тестового сообщения:', error);
  }
}

// Запускаем настройку
async function main() {
  console.log('🚀 Начинаем настройку Telegram...');
  
  if (!process.env.TELEGRAM_CHAT_ID) {
    console.error('❌ TELEGRAM_CHAT_ID не найден в .env файле');
    console.log('💡 Напишите боту в Telegram, чтобы получить chat_id');
    return;
  }
  
  await testBot();
  await setupTelegramWebhook();
  
  console.log('\n📋 Следующие шаги:');
  console.log('1. Запустите ngrok: npx ngrok http 3001');
  console.log('2. Скопируйте HTTPS URL из ngrok');
  console.log('3. Замените YOUR_NGROK_URL_HERE в этом файле');
  console.log('4. Запустите снова: node setup-telegram.js');
}

main();
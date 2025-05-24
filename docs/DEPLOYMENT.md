# Развертывание NDA System

## Требования

### Backend
- Node.js 18+
- npm или yarn
- Google Drive API credentials
- Telegram Bot Token

### Frontend
- Развертывается как статические файлы
- Поддерживает Netlify, Vercel, GitHub Pages

## Переменные окружения

Создайте файл `.env` в папке `backend/`:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_CHANNEL_ID=your_channel_id

# Google Drive
GOOGLE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# N8N Integration
N8N_WEBHOOK_URL=your_n8n_webhook_url

# Server
PORT=3001
NODE_ENV=production
```

## Локальное развертывание

### Backend
```bash
cd backend/
npm install
npm start
```

### Frontend
```bash
npm install
npm start
```

## Production развертывание

### Backend (Render/Railway/Heroku)
1. Создайте новый сервис
2. Подключите GitHub репозиторий
3. Установите переменные окружения
4. Загрузите Google Service Account JSON
5. Deploy

### Frontend (Netlify)
1. Подключите GitHub репозиторий
2. Build command: `npm run build`
3. Publish directory: `build`
4. Deploy

## Настройка Google Drive

1. Создайте проект в Google Cloud Console
2. Включите Google Drive API
3. Создайте Service Account
4. Скачайте JSON ключ
5. Поделитесь папкой с email Service Account

## Настройка Telegram Bot

1. Создайте бота через @BotFather
2. Получите токен
3. Добавьте бота в группу/канал
4. Получите chat_id и channel_id 
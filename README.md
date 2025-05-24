# NDA System 📄⚡

Автоматизированная система анализа и согласования соглашений о неразглашении (NDA) с интеграцией Telegram Bot и AI анализом.

## 🚀 Возможности

- **Интеллектуальный анализ** - AI анализ документов через N8N workflow
- **Поддержка форматов** - PDF, DOCX, DOC, TXT, RTF
- **Telegram интеграция** - Бот для согласования и уведомлений
- **Google Drive** - Облачное хранение документов
- **Автосогласование** - Автоматическое принятие решений для простых NDA
- **Красивый UI** - Современный интерфейс в стиле Notion

## 🏗️ Архитектура

```
Frontend (React) → Backend (Node.js) → Telegram Bot + Google Drive + N8N
```

- **Frontend**: React 19 + Tailwind CSS
- **Backend**: Node.js + Express
- **Storage**: Google Drive API
- **AI**: N8N Workflow Integration
- **Notifications**: Telegram Bot API

## 🚀 Быстрый старт

### Frontend
```bash
npm install
npm start
```

### Backend
```bash
cd backend/
npm install
npm start
```

### Environment Variables
Создайте `.env` в папке `backend/`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_CHANNEL_ID=your_channel_id
GOOGLE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
N8N_WEBHOOK_URL=your_n8n_webhook_url
PORT=3001
```

## 📖 Документация

- [Архитектура системы](docs/ARCHITECTURE.md)
- [Развертывание](docs/DEPLOYMENT.md)

## 🔄 Процесс работы

1. **Загрузка** - Пользователь загружает NDA документ
2. **Анализ** - AI анализирует содержимое и риски
3. **Решение** - Автоматическое согласование или отправка в Telegram
4. **Уведомление** - Результат публикуется в канал

## 🛠️ Технологии

**Frontend:**
- React 19
- Tailwind CSS
- Lucide Icons

**Backend:**
- Node.js + Express
- PDF-Parse, Mammoth
- Google Drive API
- Telegram Bot API

**External:**
- N8N (AI Workflow)
- Google Drive
- Telegram Bot

## 📁 Структура проекта

```
nda-system/
├── src/                 # Frontend React компоненты
├── public/              # Статические файлы
├── backend/             # Backend Node.js сервер
├── docs/                # Документация
├── config/              # Конфигурационные файлы
└── README.md
```

## 🌐 Развертывание

**Production URLs:**
- Frontend: https://nda-analyzer-dbrain.netlify.app
- Backend: https://nda-system-dbrain.onrender.com

## 📝 Лицензия

MIT License

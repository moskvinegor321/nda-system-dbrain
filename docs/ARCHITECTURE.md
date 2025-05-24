# Архитектура NDA System

## Обзор системы

NDA System - это автоматизированная система анализа и согласования соглашений о неразглашении (NDA) с интеграцией Telegram Bot для принятия решений.

## Архитектура

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (React)       │────│   (Node.js)     │────│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
│                      │                      │
│ • File Upload        │ • PDF Analysis      │ • Telegram Bot
│ • UI Components      │ • Text Extraction   │ • Google Drive
│ • Status Display     │ • API Endpoints     │ • N8N Workflow
│                      │ • File Storage      │
```

## Компоненты

### Frontend (React)
- **Технологии**: React 19, Tailwind CSS, Lucide Icons
- **Функции**:
  - Drag & Drop загрузка файлов
  - Поддержка PDF, DOCX, DOC, TXT, RTF
  - Пошаговый интерфейс согласования
  - Автоматическое и ручное согласование

### Backend (Node.js)
- **Технологии**: Express, Multer, PDF-Parse, Mammoth
- **Функции**:
  - Анализ документов с извлечением текста
  - Интеграция с Google Drive для хранения
  - Telegram Bot API для согласования
  - RESTful API для фронтенда

### Внешние сервисы
- **Telegram Bot**: Отправка запросов на согласование
- **Google Drive**: Облачное хранение документов
- **N8N**: Workflow автоматизация и AI анализ

## Процесс работы

1. **Загрузка документа** - пользователь загружает NDA файл
2. **Анализ текста** - извлечение и парсинг содержимого
3. **AI оценка** - анализ через N8N workflow
4. **Принятие решения** - автоматическое или через Telegram
5. **Уведомления** - результат публикуется в канал

## Структура проекта

```
nda-system/
├── src/                 # Frontend React компоненты
├── public/              # Статические файлы
├── backend/             # Backend Node.js сервер
├── docs/                # Документация
├── config/              # Конфигурационные файлы
└── README.md
``` 
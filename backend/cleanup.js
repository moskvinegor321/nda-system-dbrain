const fs = require('fs').promises;
const path = require('path');

// Функция очистки старых файлов
async function cleanupOldFiles() {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = await fs.readdir(uploadsDir);
    const now = Date.now();
    let cleaned = 0;

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      try {
        const stats = await fs.stat(filePath);
        const fileAge = now - stats.mtime.getTime();
        
        // Удаляем файлы старше 24 часов
        if (fileAge > 24 * 60 * 60 * 1000) {
          await fs.unlink(filePath);
          console.log(`🗑️ Удален старый файл: ${file}`);
          cleaned++;
        }
      } catch (error) {
        console.error(`❌ Ошибка проверки файла ${file}:`, error.message);
      }
    }

    console.log(`✅ Очистка завершена. Удалено файлов: ${cleaned}`);
  } catch (error) {
    console.error('❌ Ошибка очистки:', error.message);
  }
}

// Если запущен как отдельный скрипт
if (require.main === module) {
  cleanupOldFiles();
}

module.exports = { cleanupOldFiles }; 
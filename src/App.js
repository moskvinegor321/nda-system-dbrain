import React, { useState, useRef, useEffect } from 'react';
import { Upload, CheckCircle, AlertTriangle, FileText, Building, User } from 'lucide-react';

// API Configuration
const API_BASE_URL = 'https://nda-system-dbrain.onrender.com';

const NDAApprovalApp = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    file: null,
    responsible: '',
    companyName: '',
    comment: ''
  });
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropRef = useRef();
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
    const fileName = file ? file.name.toLowerCase() : '';
    const isAllowed = allowedExtensions.some(ext => fileName.endsWith(ext));
    if (file && !isAllowed) {
      setError('Пожалуйста, выберите PDF, DOCX, DOC, TXT или RTF файл');
      return;
    }
    setError(null);
    setFormData(prev => ({ ...prev, file }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  };

  const handleSubmitForAnalysis = async () => {
    if (!formData.file || !formData.responsible || !formData.companyName) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', formData.file);
      form.append('responsible', formData.responsible);
      form.append('companyName', formData.companyName);

      console.log('Отправляем файл на анализ:', formData.file.name);

      const response = await fetch(`${API_BASE_URL}/api/analyze-nda`, {
        method: 'POST',
        body: form
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      console.log('Результат анализа:', result);
      setAnalysisResult(result);
      setCurrentStep(2);

    } catch (error) {
      console.error('Ошибка анализа:', error);
      setError(`Ошибка анализа: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({ file: null, responsible: '', companyName: '', comment: '' });
    setAnalysisResult(null);
    setError(null);
  };

  // Drag & Drop: сброс dragActive при уходе мыши за пределы окна
  useEffect(() => {
    const handleWindowDragOver = (e) => {
      e.preventDefault();
    };
    const handleWindowDrop = (e) => {
      setDragActive(false);
    };
    const handleWindowDragLeave = (e) => {
      if (e.relatedTarget === null) {
        setDragActive(false);
      }
    };
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragleave', handleWindowDragLeave);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragleave', handleWindowDragLeave);
    };
  }, []);

  // Экран 1: Загрузка документа
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">NDA Analysis System</h1>
            <p className="mt-2 text-gray-600">Автоматический анализ и согласование документов</p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            
            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                  NDA документ
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    ref={dropRef}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`block w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer bg-gray-50 hover:bg-gray-100 ${dragActive ? 'border-blue-500 bg-blue-50' : ''}`}
                  >
                    <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p className="text-sm font-medium text-gray-700">
                      {formData.file ? formData.file.name : 'Нажмите или перетащите файл для выбора'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.file 
                        ? `${(formData.file.size / 1024 / 1024).toFixed(2)} MB`
                        : 'PDF, DOCX, DOC, TXT, RTF до 10 MB'}
                    </p>
                  </label>
                  {dragActive && (
                    <div className="absolute inset-0 z-10 bg-blue-100 bg-opacity-60 border-4 border-blue-500 rounded-lg flex items-center justify-center pointer-events-none transition-all">
                      <span className="text-blue-700 font-semibold text-lg">Отпустите файл для загрузки</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Responsible Person Field */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  Ответственный
                </label>
                <input
                  type="text"
                  value={formData.responsible}
                  onChange={(e) => setFormData(prev => ({ ...prev, responsible: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  placeholder="Введите ФИО ответственного"
                />
              </div>

              {/* Company Name Field */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                  <Building className="w-4 h-4 mr-2 text-gray-500" />
                  Название компании
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  placeholder="Введите название компании"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitForAnalysis}
                disabled={loading || !formData.file || !formData.responsible || !formData.companyName}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Анализируем документ...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Начать анализ
                  </>
                )}
              </button>

              {/* Info Section */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-start space-x-3 text-xs text-gray-500">
                  <div className="flex-1">
                    <p className="font-medium text-gray-600 mb-1">Поддерживаемые форматы:</p>
                    <p>PDF, DOCX, DOC, TXT, RTF до 10 MB</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-600 mb-1">Время анализа:</p>
                    <p>15-30 секунд</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Экран 2: Результат анализа
  if (currentStep === 2 && analysisResult) {
    // Универсальный способ получить статус (с учетом вложенности)
    const status = analysisResult.status || analysisResult.json?.status || analysisResult.data?.status || '';
    const isApproved = [
      'approve', 'auto-approve', 'approved',
      'auto_approve', 'autoapproved', 'success', 'ok'
    ].includes((status || '').toLowerCase());
    const isStatusKnown = !!status;

    // --- Функция отправки на согласование в Telegram ---
    const handleSendToTelegram = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/send-approval-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responsible: formData.responsible,
            companyName: formData.companyName,
            analysis: analysisResult,
            filename: formData.file?.name || '',
            comment: formData.comment || ''
          })
        });
        const result = await response.json();
        if (response.ok) {
          alert('Запрос на согласование отправлен в Telegram! Проверьте бота.');
          resetForm();
        } else {
          throw new Error(result.error || 'Ошибка отправки в Telegram');
        }
      } catch (error) {
        console.error('Ошибка отправки в Telegram:', error);
        alert('Ошибка: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    if (isApproved) {
      // --- Красивая форма для автоапрува ---
      const handleAutoApprove = () => {
        alert('✅ NDA автоматически согласовано!\n\nИнформация отправлена в Telegram канал для уведомления команды.');
        resetForm();
      };
      return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Header with Result */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                NDA автоматически согласовано
              </h2>
              <p className="text-gray-600">{analysisResult.summary}</p>
              {analysisResult.confidence && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    Уверенность AI: {Math.round(analysisResult.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Key Points */}
              {analysisResult.keyPoints && analysisResult.keyPoints.length > 0 && (
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span>
                    Ключевые условия
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Summary */}
              <div className="p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Заключение AI</h4>
                <div className="text-gray-700 whitespace-pre-line text-sm">
                  {analysisResult.summary}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6">
              <button
                onClick={handleAutoApprove}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-all font-medium flex items-center justify-center"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Подтвердить автоматическое согласование
              </button>
              <p className="text-sm text-gray-600 text-center mt-2">
                NDA соответствует всем требованиям и может быть согласовано автоматически
              </p>
            </div>

            {/* Process Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Следующие шаги
              </h4>
              <div className="space-y-1.5 text-sm text-gray-600">
                <p className="flex items-start">
                  <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 mt-1.5"></span>
                  Документ согласован автоматически на основе AI анализа
                </p>
                <p className="flex items-start">
                  <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 mt-1.5"></span>
                  Уведомление отправлено в Telegram канал команды
                </p>
                <p className="flex items-start">
                  <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 mt-1.5"></span>
                  Можно приступать к подписанию NDA
                </p>
              </div>
            </div>

            {/* Footer Info */}
            <div className="mt-6 text-center text-xs text-gray-500">
              <p>Компания: {formData.companyName} • Ответственный: {formData.responsible}</p>
            </div>
          </div>
        </div>
      );
    }
    // --- Форма ручного согласования для всех остальных статусов ---
    if (isStatusKnown) {
      return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Header with Result */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Требуется ручное согласование
              </h2>
              <p className="text-gray-600">{analysisResult.summary}</p>
              {analysisResult.confidence && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    Уверенность AI: {Math.round(analysisResult.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Key Points */}
              {analysisResult.keyPoints && analysisResult.keyPoints.length > 0 && (
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span>
                    Ключевые условия
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Summary */}
              <div className="p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Заключение AI</h4>
                <div className="text-gray-700 whitespace-pre-line text-sm">
                  {analysisResult.summary}
                </div>
              </div>
              {/* Комментарий для согласующего */}
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <label className="flex items-center text-sm font-semibold text-gray-900 mb-3">
                  <AlertTriangle className="w-4 h-4 mr-2 text-gray-500" />
                  Комментарий для согласующего
                </label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none"
                  placeholder="Опишите важные моменты или особые условия для согласующего лица..."
                  rows="3"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Этот комментарий будет отправлен вместе с документом в Telegram
                </p>
              </div>
              {/* Actions */}
              <div className="p-6">
                <button
                  onClick={handleSendToTelegram}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-all font-medium flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                      Отправляем...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 mr-2" />
                      Отправить на согласование в Telegram
                    </>
                  )}
                </button>
                <button
                  onClick={resetForm}
                  className="w-full mt-3 bg-white text-gray-700 py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all font-medium"
                >
                  Анализировать новый документ
                </button>
              </div>
            </div>
            {/* Footer Info */}
            <div className="mt-6 text-center text-xs text-gray-500">
              <p>Компания: {formData.companyName} • Ответственный: {formData.responsible}</p>
            </div>
          </div>
        </div>
      );
    }
    // --- Fallback: неизвестный статус ---
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow border border-gray-200 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Неизвестный статус анализа</h2>
          <p className="text-gray-600 mb-2">Статус: <span className="font-mono">{status || 'нет данных'}</span></p>
          <button onClick={resetForm} className="mt-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition">Вернуться к загрузке</button>
        </div>
      </div>
    );
  }

  return null;
};

export default NDAApprovalApp;

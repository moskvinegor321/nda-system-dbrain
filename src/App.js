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

  // Функция определения типа документа
  const getDocumentType = (analysisResult) => {
    if (analysisResult?.documentType) {
      return analysisResult.documentType.toLowerCase();
    }
    
    const summary = (analysisResult?.summary || analysisResult?.text || '').toLowerCase();
    
    if (summary.includes('nda') || summary.includes('соглашение о неразглашении') || summary.includes('конфиденциальность')) {
      return 'nda';
    }
    
    if (summary.includes('договор') || summary.includes('контракт') || summary.includes('соглашение')) {
      return 'договор';
    }
    
    return 'документ';
  };

  // Функция получения названия документа для интерфейса
  const getDocumentDisplayName = (docType) => {
    switch(docType) {
      case 'nda': return 'NDA';
      case 'договор': return 'договор';
      default: return 'документ';
    }
  };

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

      let result;
      try {
        const responseText = await response.text();
        console.log('Raw response:', responseText.substring(0, 200));
        
        if (responseText.trim()) {
          result = JSON.parse(responseText);
        } else {
          throw new Error('Пустой ответ от сервера');
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Ошибка обработки ответа сервера');
      }

      if (!response.ok) {
        throw new Error(result.error || result.details || `HTTP error! status: ${response.status}`);
      }

      console.log('Результат анализа:', result);
      setAnalysisResult(result);
      setCurrentStep(2);

    } catch (error) {
      console.error('Ошибка анализа:', error);
      if (error.message.includes('Failed to fetch')) {
        setError('Ошибка подключения к серверу. Проверьте интернет-соединение.');
      } else if (error.message.includes('CORS')) {
        setError('Ошибка CORS. Обратитесь к администратору.');
      } else {
        setError(`Ошибка анализа: ${error.message}`);
      }
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
            <h1 className="text-3xl font-bold text-gray-900">Document Analysis System</h1>
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
                  Документ для анализа
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
                  <div>
                    <p className="font-medium text-gray-600 mb-1">Поддерживаемые форматы:</p>
                    <p>PDF, DOCX, DOC, TXT, RTF до 10 MB</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-600 mb-1">Время анализа:</p>
                    <p>15-30 секунд</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-600 mb-1">Хранение файлов:</p>
                    <p>24 часа на сервере</p>
                  </div>
                </div>
                
                {/* Security Notice */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 rounded-full mr-2 flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-xs">🔒</span>
                    </div>
                    <div className="text-xs text-blue-700">
                      <p className="font-medium mb-1">Безопасность данных:</p>
                      <p>Загруженные документы автоматически удаляются через 24 часа. Анализ выполняется в защищенной среде с соблюдением конфиденциальности.</p>
                    </div>
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
    // Проверяем на ошибку обработки
    const isProcessingError = analysisResult.status === 'manual_review' && 
      (analysisResult.summary?.includes('Ошибка обработки') || 
       analysisResult.confidence === 0);
    
    // Универсальный способ получить статус (с учетом вложенности)
    const status = analysisResult.status || analysisResult.json?.status || analysisResult.data?.status || '';
    const isApproved = [
      'approve', 'auto-approve', 'approved',
      'auto_approve', 'autoapproved', 'success', 'ok'
    ].includes((status || '').toLowerCase());
    const isCritical = (status || '').toLowerCase() === 'critical';
    const isStatusKnown = !!status;
    const isNotNDA = !!analysisResult.notNDA;
    
    // Определяем тип документа
    const docType = getDocumentType(analysisResult);
    const docDisplayName = getDocumentDisplayName(docType);
    
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

    // --- Функция автоапрува с отправкой в Telegram ---
    const handleAutoApprove = async () => {
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
          alert(`✅ ${docDisplayName} автоматически согласован${docType === 'договор' ? '' : 'о'}!\n\nИнформация отправлена в Telegram канал для уведомления команды.`);
          resetForm();
        } else {
          throw new Error(result.error || 'Ошибка отправки в Telegram');
        }
      } catch (error) {
        console.error('Ошибка автоматического согласования:', error);
        alert('Ошибка: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    // Специальный экран для ошибок обработки
    if (isProcessingError) {
      return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Ошибка анализа документа
              </h2>
              <p className="text-gray-600">Не удалось обработать документ автоматически</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-amber-800 font-medium text-sm">Что произошло:</h3>
                    <p className="text-amber-700 text-sm mt-1">
                      Система анализа вернула некорректный результат. Это может быть связано с:
                    </p>
                    <ul className="text-amber-700 text-sm mt-2 space-y-1">
                      <li>• Сложной структурой документа</li>
                      <li>• Нестандартным форматом файла</li>
                      <li>• Временными проблемами с сервисом анализа</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-900 mb-3">
                    <AlertTriangle className="w-4 h-4 mr-2 text-gray-500" />
                    Комментарий для согласующего
                  </label>
                  <textarea
                    value={formData.comment}
                    onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none"
                    placeholder="Опишите документ и укажите особенности для ручного согласования..."
                    rows="3"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Рекомендуем описать тип документа и основные условия
                  </p>
                </div>

                <div className="space-y-3">
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
                        Отправить на ручное согласование
                      </>
                    )}
                  </button>
                  <button
                    onClick={resetForm}
                    className="w-full bg-white text-gray-700 py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all font-medium"
                  >
                    Попробовать снова с другим файлом
                  </button>
                </div>
              </div>
            </div>

            {/* File Storage Info */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <div className="inline-flex items-center justify-center w-5 h-5 bg-amber-100 rounded-full mr-2 flex-shrink-0 mt-0.5">
                  <span className="text-amber-600 text-xs">⏰</span>
                </div>
                <div className="text-xs text-amber-700">
                  <p className="font-medium">Важно:</p>
                  <p>Документ хранится на сервере 24 часа. После этого ссылка на скачивание перестанет работать из соображений безопасности.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              <p>Компания: {formData.companyName} • Ответственный: {formData.responsible}</p>
            </div>
          </div>
        </div>
      );
    }

    // Специальный экран для критических проблем в документе
    if (isCritical) {
      return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Обнаружены критические проблемы в документе
              </h2>
              <p className="text-gray-600">{analysisResult.summary}</p>
              {analysisResult.confidence && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    Уверенность AI: {Math.round(analysisResult.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Critical Issues */}
              {analysisResult.criticalIssues && analysisResult.criticalIssues.length > 0 && (
                <div className="p-6 border-b border-gray-200 bg-red-50">
                  <h3 className="text-sm font-semibold text-red-900 mb-4 flex items-center">
                    <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                    Критические проблемы
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.criticalIssues.map((issue, index) => (
                      <div key={index} className="flex items-start text-sm">
                        <AlertTriangle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-red-800 font-medium">{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                <div className="p-6 border-b border-gray-200 bg-blue-50">
                  <h3 className="text-sm font-semibold text-blue-900 mb-4 flex items-center">
                    <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                    Рекомендации по исправлению
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start text-sm">
                        <CheckCircle className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-blue-800">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Points if any */}
              {analysisResult.keyPoints && analysisResult.keyPoints.length > 0 && (
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full mr-2"></span>
                    Обнаруженные условия
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start text-sm">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 mt-2 flex-shrink-0"></span>
                        <span className="text-gray-700">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning message */}
              <div className="p-6 bg-yellow-50 border-l-4 border-yellow-400">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-yellow-800 font-medium text-sm">Внимание!</h3>
                    <p className="text-yellow-700 text-sm mt-1">
                      Документ содержит критические проблемы и не может быть согласован автоматически. 
                      Необходимо исправить указанные замечания или получить специальное разрешение.
                    </p>
                  </div>
                </div>
              </div>

              {/* Comment section */}
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <label className="flex items-center text-sm font-semibold text-gray-900 mb-3">
                  <AlertTriangle className="w-4 h-4 mr-2 text-gray-500" />
                  Комментарий для согласующего (обязательно)
                </label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none"
                  placeholder="Опишите причину отправки документа с критическими проблемами на согласование..."
                  rows="4"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Укажите обоснование почему документ нужно рассмотреть несмотря на критические проблемы
                </p>
              </div>

              {/* Actions */}
              <div className="p-6">
                <button
                  onClick={handleSendToTelegram}
                  disabled={loading || !formData.comment.trim()}
                  className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-all font-medium flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                      Отправляем...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Отправить на экспертное согласование
                    </>
                  )}
                </button>
                <button
                  onClick={resetForm}
                  className="w-full mt-3 bg-white text-gray-700 py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all font-medium"
                >
                  Загрузить исправленный документ
                </button>
              </div>
            </div>

            {/* File Storage Info */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <div className="inline-flex items-center justify-center w-5 h-5 bg-amber-100 rounded-full mr-2 flex-shrink-0 mt-0.5">
                  <span className="text-amber-600 text-xs">⏰</span>
                </div>
                <div className="text-xs text-amber-700">
                  <p className="font-medium">Важно:</p>
                  <p>Документ хранится на сервере 24 часа. После этого ссылка на скачивание перестанет работать из соображений безопасности.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              <p>Компания: {formData.companyName} • Ответственный: {formData.responsible}</p>
            </div>
          </div>
        </div>
      );
    }

    // Автосогласование показываем ТОЛЬКО для NDA
    if (isApproved && docType === 'nda') {
      // --- Красивая форма для автоапрува ---
      return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Header with Result */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {docDisplayName} автоматически согласован{docType === 'договор' ? '' : 'о'}
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
                {docDisplayName} соответствует всем требованиям и может быть согласован{docType === 'договор' ? '' : 'о'} автоматически
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
                  Можно приступать к подписанию {docDisplayName}
                </p>
              </div>
            </div>

            {/* File Storage Info */}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <div className="inline-flex items-center justify-center w-5 h-5 bg-green-100 rounded-full mr-2 flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs">⏰</span>
                </div>
                <div className="text-xs text-green-700">
                  <p className="font-medium">Информация:</p>
                  <p>Документ хранится на сервере 24 часа для возможности повторного скачивания. После этого файл автоматически удаляется.</p>
                </div>
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
    // --- Крутая форма ручного согласования для всех остальных статусов или если не NDA ---
    if (isStatusKnown || isNotNDA || analysisResult.summary) {
      return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Header with Result */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {isNotNDA ? `Требует экспертного согласования` : `Ручное согласование ${docDisplayName}`}
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">{analysisResult.summary || analysisResult.text || 'Анализ документа завершен'}</p>
              {analysisResult.confidence && (
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    Уверенность AI: {Math.round(analysisResult.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div className="mb-6">
              {isNotNDA ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full mr-4 flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-amber-800 font-semibold text-sm mb-1">Документ классифицирован как "{docDisplayName}"</h3>
                      <p className="text-amber-700 text-sm">
                        Документ не является стандартным NDA и требует экспертного анализа специалистами. 
                        Система не может автоматически оценить все условия и риски такого типа документов.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full mr-4 flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-blue-800 font-semibold text-sm mb-1">Требуется ручная проверка</h3>
                      <p className="text-blue-700 text-sm">
                        ИИ-анализ выявил условия, которые требуют внимания специалиста перед согласованием.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Key Points */}
              {analysisResult.keyPoints && analysisResult.keyPoints.length > 0 && (
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                  <h3 className="text-sm font-semibold text-green-900 mb-4 flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    Обнаруженные условия
                  </h3>
                  <div className="space-y-3">
                    {analysisResult.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full text-xs font-medium mr-3 flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span className="text-green-800 text-sm font-medium">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis Summary */}
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-2"></div>
                  Детальный анализ ИИ
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-gray-700 whitespace-pre-line text-sm leading-relaxed">
                    {analysisResult.summary}
                  </div>
                </div>
              </div>

              {/* Comment Section */}
              <div className="p-6 bg-gradient-to-r from-gray-50 to-blue-50">
                <label className="flex items-center text-sm font-semibold text-gray-900 mb-3">
                  <div className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 rounded-full mr-2">
                    <AlertTriangle className="w-3 h-3 text-blue-600" />
                  </div>
                  Комментарий для согласующего
                </label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                  className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none bg-white"
                  placeholder="Опишите важные моменты, особые условия или дополнительные требования для согласующего лица..."
                  rows="4"
                />
                <div className="flex items-start mt-3 text-xs text-blue-600">
                  <div className="inline-flex items-center justify-center w-4 h-4 bg-blue-100 rounded-full mr-2 flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-xs">ℹ</span>
                  </div>
                  <p>
                    Этот комментарий будет отправлен вместе с документом в Telegram. 
                    Укажите важные детали для принятия решения.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6">
                <button
                  onClick={handleSendToTelegram}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 px-6 rounded-lg transition-all font-medium flex items-center justify-center disabled:opacity-50 shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                      Отправляем на согласование...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 mr-2" />
                      Отправить на экспертное согласование
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

            {/* Process Info */}
            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                Следующие шаги
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-medium mr-3 flex-shrink-0">1</div>
                  <span>Документ отправляется на рассмотрение экспертам в Telegram</span>
                </div>
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-medium mr-3 flex-shrink-0">2</div>
                  <span>Эксперт анализирует условия и принимает решение</span>
                </div>
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-medium mr-3 flex-shrink-0">3</div>
                  <span>Результат согласования публикуется в корпоративном канале</span>
                </div>
              </div>
            </div>

            {/* File Storage Info */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <div className="inline-flex items-center justify-center w-5 h-5 bg-amber-100 rounded-full mr-2 flex-shrink-0 mt-0.5">
                  <span className="text-amber-600 text-xs">⏰</span>
                </div>
                <div className="text-xs text-amber-700">
                  <p className="font-medium">Важно:</p>
                  <p>Документ хранится на сервере 24 часа. После этого ссылка на скачивание перестанет работать из соображений безопасности.</p>
                </div>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="bg-white p-8 rounded-lg shadow border border-gray-200 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Анализ завершен</h2>
          <p className="text-gray-600 mb-4">{analysisResult.summary || analysisResult.text || 'Документ обработан, но статус неизвестен'}</p>
          <div className="text-sm text-gray-500 mb-4">
            <p>Статус: <span className="font-mono">{status || 'не определен'}</span></p>
            {analysisResult.documentType && (
              <p>Тип документа: <span className="font-mono">{analysisResult.documentType}</span></p>
            )}
          </div>
          <div className="space-y-2">
            <button 
              onClick={handleSendToTelegram} 
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Отправляем...' : 'Отправить на ручное согласование'}
            </button>
            <button 
              onClick={resetForm} 
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded hover:bg-gray-200 transition"
            >
              Загрузить новый документ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default NDAApprovalApp;

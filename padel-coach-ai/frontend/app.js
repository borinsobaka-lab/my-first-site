/**
 * Padel Coach AI - Main Application
 */

const API_BASE = '/api';

// State
let currentTaskId = null;
let pollInterval = null;
let currentVideoUrl = null;

// DOM Elements
const views = {
    analyze: document.getElementById('analyze-view'),
    progress: document.getElementById('progress-view'),
    results: document.getElementById('results-view'),
    history: document.getElementById('history-view'),
    error: document.getElementById('error-view')
};

const navBtns = document.querySelectorAll('.nav-btn');
const analyzeForm = document.getElementById('analyze-form');
const youtubeUrlInput = document.getElementById('youtube-url');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initForm();
    initButtons();

    // Check for task in URL
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('task');
    if (taskId) {
        currentTaskId = taskId;
        checkExistingTask(taskId);
    }
});

// Navigation
function initNavigation() {
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewName = btn.dataset.view;
            if (viewName === 'history') {
                loadHistory();
            }
            showView(viewName);
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function showView(viewName) {
    Object.values(views).forEach(view => view.classList.remove('active'));
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
}

// Form handling
function initForm() {
    analyzeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const url = youtubeUrlInput.value.trim();
        if (!url) return;

        // Validate URL format
        if (!isValidYouTubeUrl(url)) {
            showError('Неверный формат', 'Пожалуйста, вставьте корректную ссылку на YouTube');
            return;
        }

        currentVideoUrl = url;
        await startAnalysis(url);
    });
}

function isValidYouTubeUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
        /^https?:\/\/(www\.)?youtube\.com\/live\/[\w-]+/,
        /^https?:\/\/youtu\.be\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Buttons
function initButtons() {
    document.getElementById('cancel-btn').addEventListener('click', cancelAnalysis);
    document.getElementById('retry-btn').addEventListener('click', () => showView('analyze'));
    document.getElementById('new-analysis-btn').addEventListener('click', () => {
        youtubeUrlInput.value = '';
        showView('analyze');
    });
    document.getElementById('download-pdf-btn').addEventListener('click', downloadPDF);
}

// API Functions
async function startAnalysis(url) {
    setFormLoading(true);

    try {
        const response = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                youtube_url: url,
                player_count: 4
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Ошибка при запуске анализа');
        }

        currentTaskId = data.task_id;

        // Update URL with task ID
        window.history.pushState({}, '', `?task=${currentTaskId}`);

        // Show progress view and start polling
        showView('progress');
        startPolling();

    } catch (error) {
        showError('Ошибка', error.message);
    } finally {
        setFormLoading(false);
    }
}

function setFormLoading(loading) {
    const btn = analyzeForm.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    btn.disabled = loading;
    btnText.textContent = loading ? 'Запускаем...' : 'Анализировать матч';
    btnLoader.classList.toggle('hidden', !loading);
}

async function checkExistingTask(taskId) {
    try {
        const response = await fetch(`${API_BASE}/status/${taskId}`);
        const data = await response.json();

        if (data.status === 'completed') {
            await loadResult(taskId);
        } else if (data.status === 'processing' || data.status === 'queued') {
            showView('progress');
            startPolling();
        } else if (data.status === 'failed') {
            showError('Анализ не удался', data.error_message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Error checking task:', error);
        showView('analyze');
    }
}

function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }

    updateProgress(0, 'Запускаем анализ...');

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/status/${currentTaskId}`);
            const data = await response.json();

            if (data.status === 'completed') {
                stopPolling();
                await loadResult(currentTaskId);
            } else if (data.status === 'failed') {
                stopPolling();
                showError('Анализ не удался', data.error_message || 'Произошла ошибка при анализе видео');
            } else {
                updateProgress(data.progress, getStatusMessage(data.progress), data.eta_seconds);
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 3000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function getStatusMessage(progress) {
    if (progress < 20) return 'Загружаем видео...';
    if (progress < 40) return 'Идентифицируем игроков...';
    if (progress < 60) return 'Анализируем позиционирование...';
    if (progress < 80) return 'Оцениваем тактику и командную игру...';
    return 'Формируем персональные рекомендации...';
}

async function loadResult(taskId) {
    try {
        const response = await fetch(`${API_BASE}/result/${taskId}`);

        if (response.status === 202) {
            // Still processing
            showView('progress');
            startPolling();
            return;
        }

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка при загрузке результатов');
        }

        const data = await response.json();
        currentVideoUrl = data.youtube_url;
        renderResults(data.analysis);
        showView('results');

    } catch (error) {
        showError('Ошибка', error.message);
    }
}

function cancelAnalysis() {
    stopPolling();

    if (currentTaskId) {
        // Optional: call delete endpoint
        fetch(`${API_BASE}/analysis/${currentTaskId}`, { method: 'DELETE' })
            .catch(() => {});
    }

    currentTaskId = null;
    window.history.pushState({}, '', window.location.pathname);
    showView('analyze');
}

// History
async function loadHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '<p class="empty-state">Загрузка...</p>';

    try {
        const response = await fetch(`${API_BASE}/history`);
        const data = await response.json();

        if (data.items.length === 0) {
            historyList.innerHTML = '<p class="empty-state">История анализов пуста</p>';
            return;
        }

        historyList.innerHTML = data.items.map(item => `
            <div class="history-item" data-task-id="${item.task_id}">
                <div class="info">
                    <h4>${extractVideoTitle(item.youtube_url)}</h4>
                    <p>${formatDate(item.created_at)}</p>
                </div>
                <span class="status-badge ${item.status}">${getStatusText(item.status)}</span>
            </div>
        `).join('');

        // Add click handlers
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const taskId = item.dataset.taskId;
                const status = item.querySelector('.status-badge').classList;

                if (status.contains('completed')) {
                    currentTaskId = taskId;
                    window.history.pushState({}, '', `?task=${taskId}`);
                    loadResult(taskId);
                } else if (status.contains('processing')) {
                    currentTaskId = taskId;
                    window.history.pushState({}, '', `?task=${taskId}`);
                    showView('progress');
                    startPolling();
                }
            });
        });

    } catch (error) {
        historyList.innerHTML = '<p class="empty-state">Ошибка загрузки истории</p>';
    }
}

function extractVideoTitle(url) {
    // Extract video ID and show truncated URL
    const match = url.match(/(?:v=|\/)([\w-]{11})/);
    if (match) {
        return `YouTube: ${match[1]}`;
    }
    return url.substring(0, 50) + '...';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusText(status) {
    const texts = {
        completed: 'Готово',
        processing: 'В процессе',
        queued: 'В очереди',
        failed: 'Ошибка'
    };
    return texts[status] || status;
}

// Error handling
function showError(title, message) {
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    showView('error');
}

// PDF Download (placeholder)
function downloadPDF() {
    alert('Функция экспорта в PDF будет доступна в следующей версии');
}

// Export for components
window.PadelCoachAI = {
    currentVideoUrl: () => currentVideoUrl,
    showView,
    API_BASE
};

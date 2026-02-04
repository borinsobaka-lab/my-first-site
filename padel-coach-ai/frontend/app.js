/**
 * Padel Coach AI - Frontend Application
 */

const API_BASE = '';

// State
let currentTaskId = null;
let pollInterval = null;
let currentVideoUrl = null;

// DOM Elements
const loginView = document.getElementById('login-view');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// Views
const views = {
    analyze: document.getElementById('analyze-view'),
    progress: document.getElementById('progress-view'),
    results: document.getElementById('results-view'),
    history: document.getElementById('history-view'),
    error: document.getElementById('error-view'),
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Auth Functions
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/check`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.password_required || data.authenticated) {
            showMainApp();
        } else {
            showLoginView();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showLoginView();
    }
}

function showLoginView() {
    loginView.classList.remove('hidden');
    mainApp.classList.add('hidden');
}

function showMainApp() {
    loginView.classList.add('hidden');
    mainApp.classList.remove('hidden');
    showView('analyze');
    updateNavButtons('analyze');
}

async function login(password) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            showMainApp();
            return true;
        } else {
            const data = await response.json();
            showLoginError(data.detail || 'Неверный пароль');
            return false;
        }
    } catch (error) {
        showLoginError('Ошибка соединения');
        return false;
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    showLoginView();
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}

// View Management
function showView(viewName) {
    Object.values(views).forEach(view => {
        view.classList.add('hidden');
    });
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }
}

function updateNavButtons(activeView) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const view = btn.dataset.view;
        if (view === activeView) {
            btn.classList.add('bg-primary-100', 'text-primary-700');
            btn.classList.remove('text-gray-600');
        } else {
            btn.classList.remove('bg-primary-100', 'text-primary-700');
            btn.classList.add('text-gray-600');
        }
    });
}

// Event Listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        await login(password);
    });

    // Logout button
    logoutBtn.addEventListener('click', logout);

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (view) {
                showView(view);
                updateNavButtons(view);
                if (view === 'history') {
                    loadHistory();
                }
            }
        });
    });

    // Analyze form
    document.getElementById('analyze-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('youtube-url').value;
        await startAnalysis(url);
    });

    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', cancelAnalysis);

    // New analysis button
    document.getElementById('new-analysis-btn').addEventListener('click', () => {
        showView('analyze');
        updateNavButtons('analyze');
        document.getElementById('youtube-url').value = '';
    });

    // Retry button
    document.getElementById('retry-btn').addEventListener('click', () => {
        showView('analyze');
        updateNavButtons('analyze');
    });
}

// Analysis Functions
async function startAnalysis(youtubeUrl) {
    try {
        currentVideoUrl = youtubeUrl;

        const response = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ youtube_url: youtubeUrl, player_count: 4 })
        });

        if (response.status === 401) {
            showLoginView();
            return;
        }

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка запуска анализа');
        }

        const data = await response.json();
        currentTaskId = data.task_id;

        showView('progress');
        startPolling();

    } catch (error) {
        showError('Ошибка запуска анализа', error.message);
    }
}

function startPolling() {
    updateProgress(0, 'Запускаем анализ...');

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/status/${currentTaskId}`, {
                credentials: 'include'
            });

            if (response.status === 401) {
                stopPolling();
                showLoginView();
                return;
            }

            const data = await response.json();

            if (data.status === 'completed') {
                stopPolling();
                await loadResult();
            } else if (data.status === 'failed') {
                stopPolling();
                showError('Анализ не удался', data.error_message || 'Попробуйте ещё раз');
            } else {
                updateProgress(data.progress, getProgressMessage(data.progress));
                if (data.eta_seconds) {
                    document.getElementById('eta-text').textContent =
                        `Осталось примерно ${Math.ceil(data.eta_seconds / 60)} мин.`;
                }
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

function cancelAnalysis() {
    stopPolling();
    currentTaskId = null;
    showView('analyze');
    updateNavButtons('analyze');
}

function updateProgress(percent, message) {
    document.getElementById('progress-bar').style.width = `${percent}%`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    if (message) {
        document.getElementById('progress-status').textContent = message;
    }
}

function getProgressMessage(progress) {
    if (progress < 10) return 'Загружаем видео...';
    if (progress < 30) return 'Анализируем игроков...';
    if (progress < 50) return 'Оцениваем позиционирование...';
    if (progress < 70) return 'Анализируем тактику...';
    if (progress < 90) return 'Формируем рекомендации...';
    return 'Финальная обработка...';
}

async function loadResult() {
    try {
        const response = await fetch(`${API_BASE}/api/result/${currentTaskId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Не удалось загрузить результаты');
        }

        const data = await response.json();
        currentVideoUrl = data.youtube_url;
        renderResults(data.analysis);
        showView('results');

    } catch (error) {
        showError('Ошибка загрузки результатов', error.message);
    }
}

// Results Rendering
function renderResults(analysis) {
    renderMatchSummary(analysis.match_summary);
    renderPlayers(analysis.players);
    renderTeams(analysis.team_analysis);
    renderPatterns(analysis.patterns_observed);
}

function renderMatchSummary(summary) {
    const container = document.getElementById('summary-content');
    container.innerHTML = `
        <div class="bg-white/10 rounded-xl p-4">
            <p class="text-sm text-white/70 mb-1">Длительность</p>
            <p class="font-semibold">${summary.duration_analyzed}</p>
        </div>
        <div class="bg-white/10 rounded-xl p-4">
            <p class="text-sm text-white/70 mb-1">Преимущество</p>
            <p class="font-semibold">${summary.dominant_team}</p>
        </div>
        <div class="bg-white/10 rounded-xl p-4 md:col-span-1">
            <p class="text-sm text-white/70 mb-1">Характер матча</p>
            <p class="font-semibold text-sm">${summary.match_character}</p>
        </div>
    `;
}

function renderPlayers(players) {
    const tabsContainer = document.getElementById('player-tabs');
    const contentContainer = document.getElementById('player-content');

    tabsContainer.innerHTML = players.map((player, index) => `
        <button
            class="player-tab px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${index === 0 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
            data-player-index="${index}"
        >
            ${player.id}
            <span class="ml-1 text-xs opacity-70">К${player.team}</span>
        </button>
    `).join('');

    contentContainer.innerHTML = players.map((player, index) =>
        renderPlayerCard(player, index === 0)
    ).join('');

    // Tab click handlers
    tabsContainer.querySelectorAll('.player-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const playerIndex = parseInt(tab.dataset.playerIndex);

            tabsContainer.querySelectorAll('.player-tab').forEach((t, i) => {
                if (i === playerIndex) {
                    t.classList.add('bg-primary-600', 'text-white');
                    t.classList.remove('bg-white', 'text-gray-600');
                } else {
                    t.classList.remove('bg-primary-600', 'text-white');
                    t.classList.add('bg-white', 'text-gray-600');
                }
            });

            contentContainer.querySelectorAll('.player-card').forEach((card, i) => {
                card.classList.toggle('hidden', i !== playerIndex);
            });
        });
    });
}

function renderPlayerCard(player, isActive) {
    const scoreLabels = {
        positioning: 'Позиция',
        tactics: 'Тактика',
        teamwork: 'Команда',
        technique: 'Техника'
    };

    return `
        <div class="player-card ${isActive ? '' : 'hidden'}">
            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
                <div>
                    <h3 class="text-xl font-bold text-gray-900">${player.id}</h3>
                    <p class="text-gray-500">${player.description}</p>
                </div>
                <div class="flex items-center gap-4">
                    <div class="text-center px-6 py-3 bg-primary-50 rounded-xl">
                        <div class="text-3xl font-bold text-primary-600">${player.overall_score.toFixed(1)}</div>
                        <div class="text-xs text-primary-600/70">Общая оценка</div>
                    </div>
                </div>
            </div>

            <!-- Scores -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                ${Object.entries(player.scores).map(([key, value]) => `
                    <div class="text-center p-4 bg-gray-50 rounded-xl">
                        <div class="text-2xl font-bold text-gray-700">${value}</div>
                        <div class="text-xs text-gray-500">${scoreLabels[key]}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Strengths -->
            <div class="mb-8">
                <h4 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">+</span>
                    Сильные стороны
                </h4>
                <div class="space-y-3">
                    ${player.strengths.map(strength => `
                        <div class="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl">
                            <p class="font-medium text-gray-900">${strength.point}</p>
                            <p class="text-sm text-gray-600 mt-1">${strength.example_description}</p>
                            ${renderTimestamp(strength.example_timestamp)}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Improvements -->
            <div class="mb-8">
                <h4 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">!</span>
                    Области для улучшения
                </h4>
                <div class="space-y-4">
                    ${player.improvements.map(imp => `
                        <div class="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-xl">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="inline-block px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded">
                                    Приоритет ${imp.priority}
                                </span>
                                ${imp.frequency ? `<span class="inline-block px-2 py-1 bg-orange-200 text-orange-800 text-xs font-medium rounded">${imp.frequency}</span>` : ''}
                            </div>
                            <p class="font-medium text-gray-900">${imp.issue}</p>

                            ${imp.examples && imp.examples.length > 0 ? `
                                <div class="mt-3 space-y-2">
                                    <p class="text-xs font-semibold text-orange-700 uppercase">Примеры из матча (${imp.examples.length}):</p>
                                    ${imp.examples.map((ex, idx) => `
                                        <div class="flex items-start gap-2 p-2 bg-white/50 rounded-lg">
                                            <span class="text-xs text-orange-600 font-medium">${idx + 1}.</span>
                                            <div class="flex-1">
                                                <p class="text-sm text-gray-600">${ex.description}</p>
                                                ${renderTimestamp(ex.timestamp)}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <p class="text-sm text-gray-600 mt-1">${imp.example_description || ''}</p>
                                ${renderTimestamp(imp.example_timestamp)}
                            `}

                            <p class="text-sm text-gray-700 mt-3"><strong>Как исправить:</strong> ${imp.how_to_fix}</p>
                            ${imp.drill ? `
                                <div class="mt-3 p-3 bg-white rounded-lg border border-orange-200">
                                    <p class="font-medium text-orange-700 text-sm">Упражнение: ${imp.drill.name}</p>
                                    <p class="text-xs text-gray-500 mt-1">${imp.drill.duration}</p>
                                    <p class="text-sm text-gray-600 mt-1">${imp.drill.description}</p>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Key Moments -->
            <div class="mb-8">
                <h4 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">*</span>
                    Ключевые моменты
                </h4>
                <div class="space-y-2">
                    ${player.key_moments.map(moment => `
                        <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                            <span class="text-lg">${moment.type === 'positive' ? '✅' : moment.type === 'negative' ? '❌' : '💡'}</span>
                            <div class="flex-1">
                                <p class="text-sm text-gray-700">${moment.description}</p>
                                ${renderTimestamp(moment.timestamp)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Progress Focus -->
            <div class="p-6 bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl text-white text-center">
                <p class="text-sm opacity-90 mb-2">Фокус на ближайший месяц</p>
                <p class="font-semibold">${player.progress_focus}</p>
            </div>
        </div>
    `;
}

function renderTimestamp(timestamp) {
    if (!timestamp) return '';

    if (currentVideoUrl) {
        const parts = timestamp.split(':').map(Number);
        let seconds = 0;
        if (parts.length === 3) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            seconds = parts[0] * 60 + parts[1];
        }

        let url = currentVideoUrl;
        url += url.includes('?') ? `&t=${seconds}` : `?t=${seconds}`;

        return `<a href="${url}" target="_blank" class="inline-flex items-center gap-1 text-primary-600 text-sm font-medium mt-2 hover:underline">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            ${timestamp}
        </a>`;
    }

    return `<span class="text-sm text-gray-500 mt-2">${timestamp}</span>`;
}

function renderTeams(teams) {
    const container = document.getElementById('teams-content');
    container.innerHTML = `
        <div class="grid md:grid-cols-2 gap-6">
            ${teams.map(team => `
                <div class="p-6 bg-gray-50 rounded-xl">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="font-semibold text-gray-900">Команда ${team.team}</h4>
                        <span class="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                            Синергия: ${team.partnership_score}/9
                        </span>
                    </div>
                    <p class="text-sm text-gray-500 mb-4">${team.players.join(' + ')}</p>
                    <p class="text-sm text-gray-700 mb-4">${team.synergy_description}</p>
                    <div class="space-y-3">
                        <div class="p-3 bg-green-50 rounded-lg">
                            <p class="text-xs text-green-700 font-medium mb-1">Сильная сторона</p>
                            <p class="text-sm text-gray-700">${team.strength}</p>
                        </div>
                        <div class="p-3 bg-orange-50 rounded-lg">
                            <p class="text-xs text-orange-700 font-medium mb-1">Слабая сторона</p>
                            <p class="text-sm text-gray-700">${team.weakness}</p>
                        </div>
                        <div class="p-3 bg-blue-50 rounded-lg">
                            <p class="text-xs text-blue-700 font-medium mb-1">Рекомендация</p>
                            <p class="text-sm text-gray-700">${team.recommendation}</p>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPatterns(patterns) {
    const container = document.getElementById('patterns-content');

    if (!patterns || patterns.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Значимых паттернов не обнаружено</p>';
        return;
    }

    container.innerHTML = `
        <div class="space-y-4">
            ${patterns.map(pattern => `
                <div class="p-4 bg-gray-50 rounded-xl">
                    <div class="flex items-start justify-between gap-4 mb-3">
                        <h5 class="font-medium text-gray-900">${pattern.pattern}</h5>
                        <span class="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">${pattern.frequency}</span>
                    </div>
                    <p class="text-sm text-gray-500 mb-3">Затронутые игроки: ${pattern.affected_players.join(', ')}</p>
                    <div class="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                        <p class="text-sm text-gray-700"><strong>Решение:</strong> ${pattern.solution}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// History
async function loadHistory() {
    const listContainer = document.getElementById('history-list');
    const emptyState = document.getElementById('history-empty');

    try {
        const response = await fetch(`${API_BASE}/api/history`, {
            credentials: 'include'
        });

        if (response.status === 401) {
            showLoginView();
            return;
        }

        const data = await response.json();

        if (data.items.length === 0) {
            listContainer.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        listContainer.innerHTML = data.items.map(item => `
            <div class="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer" data-task-id="${item.task_id}">
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">${item.youtube_url}</p>
                        <p class="text-xs text-gray-500 mt-1">${new Date(item.created_at).toLocaleString('ru-RU')}</p>
                    </div>
                    <span class="ml-4 px-3 py-1 rounded-full text-xs font-medium ${getStatusClasses(item.status)}">
                        ${getStatusText(item.status)}
                    </span>
                </div>
            </div>
        `).join('');

        // Click handlers for history items
        listContainer.querySelectorAll('[data-task-id]').forEach(item => {
            item.addEventListener('click', async () => {
                const taskId = item.dataset.taskId;
                currentTaskId = taskId;
                try {
                    await loadResult();
                } catch (error) {
                    showError('Ошибка', 'Не удалось загрузить результаты');
                }
            });
        });

    } catch (error) {
        listContainer.innerHTML = '<p class="text-red-500 text-center py-4">Ошибка загрузки истории</p>';
    }
}

function getStatusClasses(status) {
    switch (status) {
        case 'completed': return 'bg-green-100 text-green-700';
        case 'processing':
        case 'queued': return 'bg-yellow-100 text-yellow-700';
        case 'failed': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'completed': return 'Готово';
        case 'processing': return 'Анализ...';
        case 'queued': return 'В очереди';
        case 'failed': return 'Ошибка';
        default: return status;
    }
}

// Error handling
function showError(title, message) {
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    showView('error');
}

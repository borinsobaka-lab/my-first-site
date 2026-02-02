/**
 * Results Component
 * Renders the analysis results
 */

function renderResults(analysis) {
    renderMatchSummary(analysis.match_summary);
    renderPlayers(analysis.players);
    renderTeams(analysis.team_analysis);
    renderPatterns(analysis.patterns_observed);
}

function renderMatchSummary(summary) {
    const container = document.querySelector('#match-summary .summary-content');
    container.innerHTML = `
        <div class="summary-item">
            <label>Длительность анализа</label>
            <span>${summary.duration_analyzed}</span>
        </div>
        <div class="summary-item">
            <label>Доминирующая команда</label>
            <span>${summary.dominant_team}</span>
        </div>
        <div class="summary-item" style="grid-column: 1 / -1;">
            <label>Характер матча</label>
            <span>${summary.match_character}</span>
        </div>
    `;
}

function renderPlayers(players) {
    const tabsContainer = document.getElementById('player-tabs');
    const contentContainer = document.getElementById('player-content');

    // Render tabs
    tabsContainer.innerHTML = players.map((player, index) => `
        <button class="player-tab ${index === 0 ? 'active' : ''}" data-player-index="${index}">
            ${player.id}
            <span class="team-badge">Команда ${player.team}</span>
        </button>
    `).join('');

    // Render player cards
    contentContainer.innerHTML = players.map((player, index) =>
        renderPlayerCard(player, index === 0)
    ).join('');

    // Add tab click handlers
    tabsContainer.querySelectorAll('.player-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const playerIndex = tab.dataset.playerIndex;

            // Update tabs
            tabsContainer.querySelectorAll('.player-tab').forEach(t =>
                t.classList.remove('active')
            );
            tab.classList.add('active');

            // Update cards
            contentContainer.querySelectorAll('.player-card').forEach((card, i) => {
                card.classList.toggle('active', i === parseInt(playerIndex));
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
        <div class="player-card ${isActive ? 'active' : ''}">
            <div class="player-header">
                <div class="player-info">
                    <h3>${player.id}</h3>
                    <p>${player.description}</p>
                </div>
                <div class="overall-score">
                    <div class="score">${player.overall_score.toFixed(1)}</div>
                    <div class="label">Общая оценка</div>
                </div>
            </div>

            <div class="scores-grid">
                ${Object.entries(player.scores).map(([key, value]) => `
                    <div class="score-item">
                        <div class="value">${value}</div>
                        <div class="label">${scoreLabels[key]}</div>
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h4><span class="icon">💪</span> Сильные стороны</h4>
                ${player.strengths.map(strength => `
                    <div class="item-card">
                        <h5>${strength.point}</h5>
                        <p>${strength.example_description}</p>
                        ${renderTimestamp(strength.example_timestamp)}
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h4><span class="icon">📈</span> Области для улучшения</h4>
                ${player.improvements.map(improvement => `
                    <div class="item-card improvement">
                        <span class="priority">Приоритет ${improvement.priority}</span>
                        <h5>${improvement.issue}</h5>
                        <p>${improvement.example_description}</p>
                        ${renderTimestamp(improvement.example_timestamp)}

                        <p><strong>Как исправить:</strong> ${improvement.how_to_fix}</p>

                        ${improvement.drill ? `
                            <div class="drill-box">
                                <h6>🏋️ Упражнение: ${improvement.drill.name}</h6>
                                <p><strong>Длительность:</strong> ${improvement.drill.duration}</p>
                                <p>${improvement.drill.description}</p>
                                <p><strong>Фокус:</strong> ${improvement.drill.focus}</p>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h4><span class="icon">🎬</span> Ключевые моменты</h4>
                ${player.key_moments.map(moment => `
                    <div class="key-moment">
                        <div class="type">${getMomentIcon(moment.type)}</div>
                        <div class="content">
                            ${renderTimestamp(moment.timestamp, true)}
                            <div class="description">${moment.description}</div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="progress-focus">
                <h4>🎯 Фокус на ближайший месяц</h4>
                <p>${player.progress_focus}</p>
            </div>
        </div>
    `;
}

function renderTimestamp(timestamp, inline = false) {
    if (!timestamp) return '';

    const videoUrl = window.PadelCoachAI?.currentVideoUrl();
    if (!videoUrl) {
        return inline
            ? `<span class="timestamp">${timestamp}</span>`
            : `<span class="timestamp-link">${timestamp}</span>`;
    }

    // Convert timestamp to seconds
    const parts = timestamp.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    }

    // Create YouTube link with timestamp
    let youtubeUrl = videoUrl;
    if (youtubeUrl.includes('?')) {
        youtubeUrl += `&t=${seconds}`;
    } else {
        youtubeUrl += `?t=${seconds}`;
    }

    return inline
        ? `<a href="${youtubeUrl}" target="_blank" class="timestamp">${timestamp}</a>`
        : `<a href="${youtubeUrl}" target="_blank" class="timestamp-link">⏱️ ${timestamp}</a>`;
}

function getMomentIcon(type) {
    const icons = {
        positive: '✅',
        negative: '❌',
        neutral: '💡'
    };
    return icons[type] || '📌';
}

function renderTeams(teams) {
    const container = document.getElementById('teams-content');
    container.innerHTML = teams.map(team => `
        <div class="team-card">
            <h4>Команда ${team.team}</h4>
            <p class="players">${team.players.join(' + ')}</p>
            <span class="partnership-score">Синергия: ${team.partnership_score}/9</span>

            <div class="team-detail">
                <label>Взаимодействие</label>
                <p>${team.synergy_description}</p>
            </div>

            <div class="team-detail">
                <label>Сильная сторона</label>
                <p>${team.strength}</p>
            </div>

            <div class="team-detail">
                <label>Слабая сторона</label>
                <p>${team.weakness}</p>
            </div>

            <div class="team-detail">
                <label>Рекомендация</label>
                <p>${team.recommendation}</p>
            </div>
        </div>
    `).join('');
}

function renderPatterns(patterns) {
    const container = document.getElementById('patterns-content');

    if (!patterns || patterns.length === 0) {
        container.innerHTML = '<p class="empty-state">Значимых паттернов не обнаружено</p>';
        return;
    }

    container.innerHTML = patterns.map(pattern => `
        <div class="pattern-card">
            <h5>${pattern.pattern}</h5>
            <span class="frequency">${pattern.frequency}</span>
            <p class="affected">Затронутые игроки: ${pattern.affected_players.join(', ')}</p>

            ${pattern.timestamps && pattern.timestamps.length > 0 ? `
                <p class="timestamps">
                    Моменты: ${pattern.timestamps.map(ts => renderTimestamp(ts, true)).join(', ')}
                </p>
            ` : ''}

            <div class="solution">
                <strong>Решение:</strong> ${pattern.solution}
            </div>
        </div>
    `).join('');
}

// Export
window.renderResults = renderResults;

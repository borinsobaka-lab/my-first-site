/**
 * Progress Component
 * Handles the progress view UI updates
 */

function updateProgress(progress, status, etaSeconds = null) {
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const progressStatus = document.getElementById('progress-status');
    const etaElement = document.getElementById('eta');

    // Update progress bar
    progressFill.style.width = `${progress}%`;
    progressPercent.textContent = `${progress}%`;

    // Update status text
    progressStatus.textContent = status;

    // Update ETA
    if (etaSeconds !== null && etaSeconds > 0) {
        const minutes = Math.ceil(etaSeconds / 60);
        etaElement.textContent = `Примерное время ожидания: ~${minutes} мин`;
    } else if (progress >= 100) {
        etaElement.textContent = 'Почти готово...';
    }
}

// Export
window.updateProgress = updateProgress;

/**
 * Module Viewer - Student Side
 * Displays module content with DRM protection for videos and PDFs
 */

let currentModule = null;
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let blobCleanup = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const authData = Auth.checkAuth();
    if (!authData) return;

    // Get module ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const moduleId = urlParams.get('moduleId');
    const courseId = urlParams.get('courseId');

    if (!moduleId) {
        showError('Module ID not provided');
        return;
    }

    // Set back button
    const backBtn = document.getElementById('backBtn');
    if (courseId) {
        backBtn.href = `student-dashboard.html?courseId=${courseId}`;
    } else {
        backBtn.href = 'student-dashboard.html';
    }

    // Load module
    await loadModule(moduleId, authData);
});

/**
 * Load module data
 */
async function loadModule(moduleId, authData) {
    try {
        const response = await fetch(`${Auth.apiBase}/modules/${moduleId}`, {
            headers: Auth.getHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load module');
        }

        const data = await response.json();
        currentModule = data.module || data;

        // Update header
        document.getElementById('moduleTitle').textContent = currentModule.title;

        const descElement = document.getElementById('moduleDescription');
        if (currentModule.description) {
            descElement.innerHTML = `<p style="color: #6c757d; margin-top: 12px;">${currentModule.description}</p>`;
        }

        // Set content type badge
        const badgeElement = document.getElementById('contentTypeBadge');
        let badgeClass = '';
        let badgeIcon = '';
        let badgeText = '';

        switch (currentModule.contentType) {
            case 'rich-content':
                badgeClass = 'badge-rich-content';
                badgeIcon = 'fa-edit';
                badgeText = 'Rich Content';
                break;
            case 'video':
                badgeClass = 'badge-video';
                badgeIcon = 'fa-video';
                badgeText = 'Video';
                break;
            case 'pdf':
                badgeClass = 'badge-pdf';
                badgeIcon = 'fa-file-pdf';
                badgeText = 'PDF Document';
                break;
        }

        badgeElement.className = `content-type-badge ${badgeClass}`;
        badgeElement.innerHTML = `<i class="fas ${badgeIcon}"></i> ${badgeText}`;

        // Render content based on type
        await renderContent(currentModule, authData);

    } catch (error) {
        console.error('Error loading module:', error);
        showError('Failed to load module. Please try again.');
    }
}

/**
 * Render module content based on type
 */
async function renderContent(module, authData) {
    const container = document.getElementById('contentContainer');

    if (module.contentType === 'rich-content') {
        // Display rich content HTML
        container.innerHTML = `<div class="rich-content">${module.content}</div>`;

        // Apply basic DRM protection (no right-click, no text selection)
        DRMProtection.disableRightClick(container);
        DRMProtection.preventTextSelection(container);
        DRMProtection.disableKeyboardShortcuts();

    } else if (module.contentType === 'video') {
        await renderVideo(module, authData, container);

    } else if (module.contentType === 'pdf') {
        await renderPDF(module, authData, container);
    }
}

/**
 * Render video with DRM protection
 */
async function renderVideo(module, authData, container) {
    container.innerHTML = `
        <div class="loading-message">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading video...</p>
        </div>
    `;

    try {
        // Fetch secure video file
        const { blobUrl, cleanup } = await DRMProtection.fetchSecureFile(module._id);
        blobCleanup = cleanup;

        // Create video player
        container.innerHTML = `
            <div class="video-player-container" id="videoPlayerContainer">
                <video id="videoPlayer" class="video-player" controls controlsList="nodownload" disablePictureInPicture>
                    <source src="${blobUrl}" type="${module.fileMetadata.mimeType}">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;

        const videoElement = document.getElementById('videoPlayer');
        const playerContainer = document.getElementById('videoPlayerContainer');

        // Apply DRM protection
        DRMProtection.disableRightClick(videoElement);
        DRMProtection.disableRightClick(playerContainer);
        DRMProtection.disableVideoDownload(videoElement);
        DRMProtection.disableKeyboardShortcuts();

        // Add watermark
        const username = authData.name || authData.email || 'Student';
        DRMProtection.addCornerWatermark(playerContainer, username);

        // Prevent download via any means
        videoElement.addEventListener('loadeddata', () => {
            videoElement.removeAttribute('download');
        });

    } catch (error) {
        console.error('Error loading video:', error);
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${error.message || 'Failed to load video'}</p>
            </div>
        `;
    }
}

/**
 * Render PDF with DRM protection using PDF.js
 */
async function renderPDF(module, authData, container) {
    container.innerHTML = `
        <div class="loading-message">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading PDF...</p>
        </div>
    `;

    try {
        // Set PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Fetch secure PDF file
        const { blobUrl, cleanup } = await DRMProtection.fetchSecureFile(module._id);
        blobCleanup = cleanup;

        // Load PDF
        const loadingTask = pdfjsLib.getDocument(blobUrl);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;

        // Create PDF viewer UI
        container.innerHTML = `
            <div class="pdf-viewer-container" id="pdfViewerContainer">
                <div class="pdf-controls">
                    <div>
                        <button id="prevPage" disabled>
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <button id="nextPage">
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <div>
                        <span>Page <span id="pageNum">1</span> of <span id="pageCount">${totalPages}</span></span>
                    </div>
                    <div>
                        <button id="zoomOut">
                            <i class="fas fa-search-minus"></i>
                        </button>
                        <button id="zoomIn">
                            <i class="fas fa-search-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="pdf-canvas-container" id="pdfCanvasContainer">
                    <canvas id="pdfCanvas" class="pdf-canvas"></canvas>
                </div>
            </div>
        `;

        // Render first page
        await renderPDFPage(1);

        // Apply DRM protection
        const pdfViewerContainer = document.getElementById('pdfViewerContainer');
        const pdfCanvasContainer = document.getElementById('pdfCanvasContainer');

        DRMProtection.disableRightClick(pdfViewerContainer);
        DRMProtection.preventTextSelection(pdfViewerContainer);
        DRMProtection.disableKeyboardShortcuts();

        // Add watermark
        const username = authData.name || authData.email || 'Student';
        DRMProtection.addWatermark(pdfCanvasContainer, username);

        // Setup controls
        document.getElementById('prevPage').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPDFPage(currentPage);
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPDFPage(currentPage);
            }
        });

        let scale = 1.5;
        document.getElementById('zoomIn').addEventListener('click', () => {
            scale += 0.2;
            renderPDFPage(currentPage, scale);
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            if (scale > 0.5) {
                scale -= 0.2;
                renderPDFPage(currentPage, scale);
            }
        });

    } catch (error) {
        console.error('Error loading PDF:', error);
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${error.message || 'Failed to load PDF'}</p>
            </div>
        `;
    }
}

/**
 * Render specific PDF page
 */
async function renderPDFPage(pageNumber, scale = 1.5) {
    const page = await pdfDoc.getPage(pageNumber);
    const canvas = document.getElementById('pdfCanvas');
    const context = canvas.getContext('2d');

    const viewport = page.getViewport({ scale });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext).promise;

    // Update page controls
    document.getElementById('pageNum').textContent = pageNumber;
    document.getElementById('prevPage').disabled = (pageNumber === 1);
    document.getElementById('nextPage').disabled = (pageNumber === totalPages);
}

/**
 * Show error message
 */
function showError(message) {
    const container = document.getElementById('contentContainer');
    container.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    if (blobCleanup) {
        blobCleanup();
    }
});

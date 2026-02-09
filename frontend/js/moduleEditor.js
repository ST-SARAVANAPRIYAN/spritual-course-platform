/**
 * Module Editor Logic
 * Handles module creation and editing with three content types:
 * 1. Rich Content (Quill editor)
 * 2. Video Upload
 * 3. PDF Upload
 */

let quillEditor = null;
let courseId = null;
let moduleId = null;
let selectedContentType = 'rich-content';
let uploadedFile = null;
let uploadedFileMetadata = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    const authData = Auth.checkAuth(['Staff', 'Admin']);
    if (!authData) return;

    // Parse URL Params
    const urlParams = new URLSearchParams(window.location.search);
    courseId = urlParams.get('courseId');
    moduleId = urlParams.get('moduleId');

    if (!courseId && !moduleId) {
        UI.error('Missing course information');
        setTimeout(() => window.location.href = 'staff-dashboard.html', 2000);
        return;
    }

    // Initialize Content Type Selector
    initializeContentTypeSelector();

    // Initialize Rich Content Editor
    initializeEditor();

    // Initialize File Uploads
    initializeFileUploads();

    // Set Back Link
    const backLink = document.getElementById('backLink');
    if (courseId) {
        backLink.href = `module-manager.html?courseId=${courseId}`;
    } else {
        backLink.href = 'staff-dashboard.html';
    }

    // Load Data if editing
    if (moduleId) {
        document.getElementById('pageTitle').textContent = 'Edit Module';
        await loadModuleData(moduleId);
    } else {
        document.getElementById('pageTitle').textContent = 'Add New Module';
    }

    // Customize UI for Staff
    if (authData.role === 'Staff') {
        document.getElementById('saveBtn').innerHTML = '<i class="fas fa-paper-plane"></i> Submit for Approval';
    }

    // Save Listener
    document.getElementById('saveBtn').addEventListener('click', saveModule);
});

/**
 * Initialize content type selector
 */
function initializeContentTypeSelector() {
    const options = document.querySelectorAll('.content-type-option');

    options.forEach(option => {
        option.addEventListener('click', () => {
            // Don't allow changing if editing existing module
            if (moduleId) {
                UI.error('Cannot change content type when editing existing module');
                return;
            }

            // Remove active from all
            options.forEach(opt => opt.classList.remove('active'));

            // Add active to clicked
            option.classList.add('active');

            // Update selected type
            selectedContentType = option.dataset.type;

            // Show/hide appropriate sections
            updateContentSections();
        });
    });
}

/**
 * Update visible content sections based on selected type
 */
function updateContentSections() {
    const sections = {
        'rich-content': document.getElementById('richContentSection'),
        'video': document.getElementById('videoSection'),
        'pdf': document.getElementById('pdfSection')
    };

    // Hide all sections
    Object.values(sections).forEach(section => section.classList.remove('active'));

    // Show selected section
    sections[selectedContentType].classList.add('active');
}

/**
 * Initialize Quill rich text editor
 */
function initializeEditor() {
    Quill.register('modules/blotFormatter', QuillBlotFormatter.default);

    quillEditor = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
            blotFormatter: {},
            toolbar: {
                container: [
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    [{ 'font': [] }],
                    [{ 'size': ['small', false, 'large', 'huge'] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'script': 'sub' }, { 'script': 'super' }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'indent': '-1' }, { 'indent': '+1' }],
                    [{ 'direction': 'rtl' }],
                    [{ 'align': [] }],
                    ['blockquote', 'code-block'],
                    ['link', 'image', 'video'],
                    ['clean']
                ],
                handlers: {
                    image: function () { selectLocalImage(); },
                    video: function () { selectLocalVideo(); }
                }
            }
        },
        placeholder: 'Compose your module content here...'
    });
}

/**
 * Image upload for Quill editor
 */
function selectLocalImage() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
        if (input.files[0]) await uploadContentFile(input.files[0], 'image');
    };
}

/**
 * Video embed for Quill editor
 */
function selectLocalVideo() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'video/*');
    input.click();
    input.onchange = async () => {
        if (input.files[0]) await uploadContentFile(input.files[0], 'video');
    };
}

/**
 * Upload content files for Quill editor (images/videos embedded in rich content)
 */
async function uploadContentFile(file, type) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/uploads/content`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });

        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        const range = quillEditor.getSelection(true);
        quillEditor.insertEmbed(range.index, type, data.url);
    } catch (err) {
        console.error('Upload error:', err);
        UI.error('Failed to upload file');
    } finally {
        UI.hideLoader();
    }
}

/**
 * Initialize file upload handlers for video and PDF
 */
function initializeFileUploads() {
    // Video Upload
    const videoZone = document.getElementById('videoUploadZone');
    const videoInput = document.getElementById('videoFileInput');

    videoZone.addEventListener('click', () => videoInput.click());
    videoInput.addEventListener('change', (e) => handleVideoUpload(e.target.files[0]));

    // Drag and drop for video
    videoZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        videoZone.classList.add('dragover');
    });
    videoZone.addEventListener('dragleave', () => {
        videoZone.classList.remove('dragover');
    });
    videoZone.addEventListener('drop', (e) => {
        e.preventDefault();
        videoZone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) {
            handleVideoUpload(e.dataTransfer.files[0]);
        }
    });

    // PDF Upload
    const pdfZone = document.getElementById('pdfUploadZone');
    const pdfInput = document.getElementById('pdfFileInput');

    pdfZone.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', (e) => handlePDFUpload(e.target.files[0]));

    // Drag and drop for PDF
    pdfZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        pdfZone.classList.add('dragover');
    });
    pdfZone.addEventListener('dragleave', () => {
        pdfZone.classList.remove('dragover');
    });
    pdfZone.addEventListener('drop', (e) => {
        e.preventDefault();
        pdfZone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) {
            handlePDFUpload(e.dataTransfer.files[0]);
        }
    });
}

/**
 * Handle video file upload
 */
async function handleVideoUpload(file) {
    if (!file) return;

    // Validation
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (!allowedTypes.includes(file.type)) {
        UI.error('Invalid file type. Only MP4, WebM, MOV, AVI, and MKV videos are allowed.');
        return;
    }

    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
        UI.error('File too large. Maximum size is 500MB.');
        return;
    }

    // Show progress
    const progressContainer = document.getElementById('videoProgressContainer');
    progressContainer.innerHTML = `
        <div class="upload-progress uploading">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fas fa-upload"></i> Uploading video...</span>
                <span id="videoProgressPercent">0%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" id="videoProgressBar" style="width: 0%"></div>
            </div>
            <div class="progress-info">
                <span id="videoProgressSize">-</span>
                <span id="videoProgressSpeed">-</span>
            </div>
        </div>
    `;

    // Validate courseId exists
    if (!courseId) {
        UI.error('Course ID is missing. Please refresh the page.');
        progressContainer.innerHTML = '';
        return;
    }

    const formData = new FormData();
    // IMPORTANT: Append courseId BEFORE file so it's available in req.body during multer processing
    formData.append('courseId', courseId);
    formData.append('video', file);

    try {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                document.getElementById('videoProgressBar').style.width = percentComplete + '%';
                document.getElementById('videoProgressPercent').textContent = Math.round(percentComplete) + '%';
                document.getElementById('videoProgressSize').textContent =
                    `${formatFileSize(e.loaded)} / ${formatFileSize(e.total)}`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                uploadedFile = response.fileUrl;
                uploadedFileMetadata = response.fileMetadata;

                progressContainer.innerHTML = `
                    <div class="upload-progress success">
                        <i class="fas fa-check-circle"></i> Upload complete!
                    </div>
                `;

                showVideoPreview(file, response);
                UI.success('Video uploaded successfully');
            } else {
                throw new Error('Upload failed');
            }
        });

        xhr.addEventListener('error', () => {
            throw new Error('Upload failed');
        });

        xhr.open('POST', `${Auth.apiBase}/uploads/video`);
        xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
        xhr.send(formData);

    } catch (err) {
        console.error('Upload error:', err);
        progressContainer.innerHTML = `
            <div class="upload-progress error">
                <i class="fas fa-exclamation-circle"></i> Upload failed. Please try again.
            </div>
        `;
        UI.error('Failed to upload video');
    }
}

/**
 * Handle PDF file upload
 */
async function handlePDFUpload(file) {
    if (!file) return;

    // Validation
    if (file.type !== 'application/pdf') {
        UI.error('Invalid file type. Only PDF files are allowed.');
        return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        UI.error('File too large. Maximum size is 50MB.');
        return;
    }

    // Show progress
    const progressContainer = document.getElementById('pdfProgressContainer');
    progressContainer.innerHTML = `
        <div class="upload-progress uploading">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fas fa-upload"></i> Uploading PDF...</span>
                <span id="pdfProgressPercent">0%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" id="pdfProgressBar" style="width: 0%"></div>
            </div>
            <div class="progress-info">
                <span id="pdfProgressSize">-</span>
            </div>
        </div>
    `;

    // Validate courseId exists
    if (!courseId) {
        UI.error('Course ID is missing. Please refresh the page.');
        progressContainer.innerHTML = '';
        return;
    }

    const formData = new FormData();
    // IMPORTANT: Append courseId BEFORE file so it's available in req.body during multer processing
    formData.append('courseId', courseId);
    formData.append('pdf', file);

    try {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                document.getElementById('pdfProgressBar').style.width = percentComplete + '%';
                document.getElementById('pdfProgressPercent').textContent = Math.round(percentComplete) + '%';
                document.getElementById('pdfProgressSize').textContent =
                    `${formatFileSize(e.loaded)} / ${formatFileSize(e.total)}`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                uploadedFile = response.fileUrl;
                uploadedFileMetadata = response.fileMetadata;

                progressContainer.innerHTML = `
                    <div class="upload-progress success">
                        <i class="fas fa-check-circle"></i> Upload complete!
                    </div>
                `;

                showPDFPreview(file, response);
                UI.success('PDF uploaded successfully');
            } else {
                throw new Error('Upload failed');
            }
        });

        xhr.addEventListener('error', () => {
            throw new Error('Upload failed');
        });

        xhr.open('POST', `${Auth.apiBase}/uploads/pdf`);
        xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
        xhr.send(formData);

    } catch (err) {
        console.error('Upload error:', err);
        progressContainer.innerHTML = `
            <div class="upload-progress error">
                <i class="fas fa-exclamation-circle"></i> Upload failed. Please try again.
            </div>
        `;
        UI.error('Failed to upload PDF');
    }
}

/**
 * Show video preview after upload
 */
function showVideoPreview(file, response) {
    const container = document.getElementById('videoPreviewContainer');
    const videoUrl = URL.createObjectURL(file);

    container.innerHTML = `
        <div class="file-preview">
            <div class="file-preview-header">
                <div class="file-preview-info">
                    <div class="file-preview-icon">
                        <i class="fas fa-video"></i>
                    </div>
                    <div class="file-preview-details">
                        <h4>${response.fileMetadata.originalName}</h4>
                        <p>${formatFileSize(response.fileMetadata.fileSize)}</p>
                    </div>
                </div>
                <button class="file-preview-remove" onclick="removeUploadedFile('video')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
            <video class="video-preview-player" controls>
                <source src="${videoUrl}" type="${file.type}">
                Your browser does not support the video tag.
            </video>
        </div>
    `;
}

/**
 * Show PDF preview after upload
 */
function showPDFPreview(file, response) {
    const container = document.getElementById('pdfPreviewContainer');

    container.innerHTML = `
        <div class="file-preview">
            <div class="file-preview-header">
                <div class="file-preview-info">
                    <div class="file-preview-icon">
                        <i class="fas fa-file-pdf" style="color: #dc3545;"></i>
                    </div>
                    <div class="file-preview-details">
                        <h4>${response.fileMetadata.originalName}</h4>
                        <p>${formatFileSize(response.fileMetadata.fileSize)}</p>
                    </div>
                </div>
                <button class="file-preview-remove" onclick="removeUploadedFile('pdf')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
            <div class="pdf-preview-container" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center; color: #6c757d;">
                    <i class="fas fa-file-pdf" style="font-size: 4rem; margin-bottom: 16px; color: #dc3545;"></i>
                    <p>PDF Preview: ${response.fileMetadata.originalName}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Remove uploaded file
 */
window.removeUploadedFile = function (type) {
    uploadedFile = null;
    uploadedFileMetadata = null;

    if (type === 'video') {
        document.getElementById('videoPreviewContainer').innerHTML = '';
        document.getElementById('videoProgressContainer').innerHTML = '';
        document.getElementById('videoFileInput').value = '';
    } else if (type === 'pdf') {
        document.getElementById('pdfPreviewContainer').innerHTML = '';
        document.getElementById('pdfProgressContainer').innerHTML = '';
        document.getElementById('pdfFileInput').value = '';
    }
};

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Load module data for editing
 */
async function loadModuleData(id) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/modules/${id}`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load module');

        const data = await res.json();
        const module = data.module || data;

        // Fill basic fields
        document.getElementById('moduleTitle').value = module.title;
        document.getElementById('moduleDescription').value = module.description || '';

        // Set content type
        selectedContentType = module.contentType || 'rich-content';

        // Update UI to show correct content type
        document.querySelectorAll('.content-type-option').forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.type === selectedContentType) {
                opt.classList.add('active');
            }
            // Disable all options when editing
            opt.classList.add('disabled');
        });

        updateContentSections();

        // Load content based on type
        if (selectedContentType === 'rich-content') {
            quillEditor.root.innerHTML = module.content || '';
        } else if (selectedContentType === 'video' && module.fileUrl) {
            uploadedFile = module.fileUrl;
            uploadedFileMetadata = module.fileMetadata;
            // Show existing file info
            document.getElementById('videoPreviewContainer').innerHTML = `
                <div class="file-preview">
                    <div class="file-preview-header">
                        <div class="file-preview-info">
                            <div class="file-preview-icon">
                                <i class="fas fa-video"></i>
                            </div>
                            <div class="file-preview-details">
                                <h4>${module.fileMetadata.originalName}</h4>
                                <p>${formatFileSize(module.fileMetadata.fileSize)}</p>
                            </div>
                        </div>
                    </div>
                    <p style="margin-top: 12px; color: #6c757d;">
                        <i class="fas fa-info-circle"></i> Existing video file. Upload a new one to replace it.
                    </p>
                </div>
            `;
        } else if (selectedContentType === 'pdf' && module.fileUrl) {
            uploadedFile = module.fileUrl;
            uploadedFileMetadata = module.fileMetadata;
            // Show existing file info
            document.getElementById('pdfPreviewContainer').innerHTML = `
                <div class="file-preview">
                    <div class="file-preview-header">
                        <div class="file-preview-info">
                            <div class="file-preview-icon">
                                <i class="fas fa-file-pdf" style="color: #dc3545;"></i>
                            </div>
                            <div class="file-preview-details">
                                <h4>${module.fileMetadata.originalName}</h4>
                                <p>${formatFileSize(module.fileMetadata.fileSize)}</p>
                            </div>
                        </div>
                    </div>
                    <p style="margin-top: 12px; color: #6c757d;">
                        <i class="fas fa-info-circle"></i> Existing PDF file. Upload a new one to replace it.
                    </p>
                </div>
            `;
        }

        // Update courseId if needed
        if (!courseId && module.courseId) {
            courseId = module.courseId;
            document.getElementById('backLink').href = `module-manager.html?courseId=${courseId}`;
        }

    } catch (err) {
        console.error('Load error:', err);
        UI.error('Error loading module');
    } finally {
        UI.hideLoader();
    }
}

/**
 * Save module
 */
async function saveModule() {
    const title = document.getElementById('moduleTitle').value.trim();
    const description = document.getElementById('moduleDescription').value.trim();

    // Validation
    if (!title) {
        UI.error('Module Title is required');
        return;
    }

    // Build payload based on content type
    const payload = {
        title,
        description,
        contentType: selectedContentType
    };

    if (selectedContentType === 'rich-content') {
        payload.content = quillEditor.root.innerHTML;
    } else if (selectedContentType === 'video' || selectedContentType === 'pdf') {
        if (!uploadedFile) {
            UI.error(`Please upload a ${selectedContentType === 'video' ? 'video' : 'PDF'} file`);
            return;
        }
        payload.fileUrl = uploadedFile;
        payload.fileMetadata = uploadedFileMetadata;
    }

    let url, method;

    if (moduleId) {
        url = `${Auth.apiBase}/modules/${moduleId}`;
        method = 'PUT';
    } else {
        url = `${Auth.apiBase}/courses/${courseId}/modules`;
        method = 'POST';
        payload.courseId = courseId;
    }

    try {
        UI.showLoader();
        const res = await fetch(url, {
            method: method,
            headers: {
                ...Auth.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Save failed');
        }

        UI.success('Module submitted for approval! It will be reviewed by an admin.');

        // Redirect back after short delay
        setTimeout(() => {
            window.location.href = `module-manager.html?courseId=${courseId}`;
        }, 1500);

    } catch (err) {
        console.error('Save error:', err);
        UI.error('Failed to save module: ' + err.message);
    } finally {
        UI.hideLoader();
    }
}

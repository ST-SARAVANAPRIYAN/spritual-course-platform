/**
 * Lesson Editor with EditorJS Integration
 * Handles creating and editing lessons with rich content
 */

import { EditorConfig } from './editorConfig.js';

// Global state
let editor = null;
let currentLesson = null;
let currentCourse = null;
let autoSaveTimer = null;
let hasUnsavedChanges = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify auth
    const authData = Auth.checkAuth(['Staff', 'Admin']);
    if (!authData) return;

    const { user } = authData;
    const isAdmin = user.role === 'Admin';

    // Show admin-only buttons
    if (isAdmin) {
        document.getElementById('publishBtn').style.display = 'inline-flex';
    }

    // 2. Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId');
    const lessonId = params.get('lessonId');

    if (!courseId) {
        UI.error('No course selected');
        window.location.href = 'staff-dashboard.html';
        return;
    }

    currentCourse = courseId;

    // 3. Load modules for this course
    await loadModules(courseId);

    // 4. If editing, load existing lesson
    if (lessonId) {
        await loadLesson(lessonId);
    } else {
        // Initialize empty editor for new lesson
        await initializeEditor();
    }

    // 5. Event listeners
    document.getElementById('saveDraftBtn').addEventListener('click', saveDraft);
    document.getElementById('submitBtn').addEventListener('click', submitForApproval);

    if (isAdmin) {
        document.getElementById('publishBtn').addEventListener('click', publishLesson);
    }

    // Auto-save every 30 seconds
    startAutoSave();

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

/**
 * Load modules for the course
 */
async function loadModules(courseId) {
    try {
        const res = await fetch(`${Auth.apiBase}/courses/${courseId}/modules?includeUnpublished=true`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load modules');

        const data = await res.json();
        const moduleSelect = document.getElementById('moduleSelect');

        if (data.modules.length === 0) {
            moduleSelect.innerHTML = '<option value="">No modules yet - create one in course settings</option>';
            moduleSelect.disabled = true;
            document.getElementById('saveDraftBtn').disabled = true;
            document.getElementById('submitBtn').disabled = true;
            return;
        }

        data.modules.forEach(module => {
            const option = document.createElement('option');
            option.value = module._id;
            option.textContent = `${module.order + 1}. ${module.title}`;
            moduleSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Failed to load modules:', err);
        UI.error('Failed to load modules: ' + err.message);
    }
}

/**
 * Load existing lesson for editing
 */
async function loadLesson(lessonId) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/lessons/${lessonId}?includeContent=true`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load lesson');

        currentLesson = await res.json();
        const lesson = currentLesson.lesson;

        // Set global for file uploads
        window.currentLessonId = lesson._id;

        // Update UI
        document.getElementById('pageTitle').textContent = 'Edit Lesson';
        document.getElementById('moduleSelect').value = lesson.moduleId._id || lesson.moduleId;
        document.getElementById('lessonTitle').value = lesson.title;
        document.getElementById('lessonDescription').value = lesson.description || '';
        document.getElementById('lessonDuration').value = lesson.duration || '';
        document.getElementById('previewDuration').value = lesson.previewDuration || '';
        document.getElementById('isFreePreview').checked = lesson.isFreePreview || false;

        // Update status badge
        updateStatusBadge(lesson.approvalStatus);

        // Show rejection notice if applicable
        if (lesson.approvalStatus === 'Rejected' && lesson.rejectionReason) {
            document.getElementById('rejectionNotice').style.display = 'block';
            document.getElementById('rejectionReason').textContent = lesson.rejectionReason;
        }

        // Initialize editor with existing content
        await initializeEditor(lesson.content);

    } catch (err) {
        console.error('Failed to load lesson:', err);
        UI.error('Failed to load lesson: ' + err.message);
        window.location.href = 'staff-dashboard.html';
    } finally {
        UI.hideLoader();
    }
}

/**
 * Initialize EditorJS
 */
async function initializeEditor(initialData = null) {
    try {
        document.getElementById('loadingOverlay').style.display = 'flex';

        const editorConfig = new EditorConfig('editorjs', {
            placeholder: 'Start creating your lesson content... Add text, images, videos, code blocks, and more!',
            autofocus: !currentLesson, // Auto-focus only for new lessons
            onChange: (data) => {
                hasUnsavedChanges = true;
                updateAutoSaveStatus('unsaved');
            }
        });

        editor = await editorConfig.init(initialData);
        console.log('✅ Editor initialized');

    } catch (err) {
        console.error('Editor initialization failed:', err);
        UI.error('Failed to initialize editor. Please refresh the page.');
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

/**
 * Save lesson as draft
 */
async function saveDraft() {
    try {
        UI.showLoader();

        const lessonData = await buildLessonData();

        if (currentLesson) {
            // Update existing
            const res = await fetch(`${Auth.apiBase}/lessons/${currentLesson.lesson._id}`, {
                method: 'PUT',
                headers: {
                    ...Auth.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(lessonData)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to update lesson');
            }

            const data = await res.json();
            currentLesson = { lesson: data.lesson };
            window.currentLessonId = data.lesson._id;

            UI.success('Draft saved successfully!');
        } else {
            // Create new
            const moduleId = document.getElementById('moduleSelect').value;
            lessonData.moduleId = moduleId;

            const res = await fetch(`${Auth.apiBase}/modules/${moduleId}/lessons`, {
                method: 'POST',
                headers: {
                    ...Auth.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(lessonData)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to create lesson');
            }

            const data = await res.json();
            currentLesson = { lesson: data.lesson };
            window.currentLessonId = data.lesson._id;

            // Update URL without reload
            const newUrl = `${window.location.pathname}?courseId=${currentCourse}&lessonId=${data.lesson._id}`;
            window.history.pushState({}, '', newUrl);

            document.getElementById('pageTitle').textContent = 'Edit Lesson';
            UI.success('Lesson created successfully!');
        }

        hasUnsavedChanges = false;
        updateAutoSaveStatus('saved');
        updateStatusBadge(currentLesson.lesson.approvalStatus);

    } catch (err) {
        console.error('Save failed:', err);
        UI.error('Failed to save lesson: ' + err.message);
    } finally {
        UI.hideLoader();
    }
}

/**
 * Submit lesson for approval
 */
async function submitForApproval() {
    try {
        // First save the lesson
        await saveDraft();

        if (!currentLesson) {
            UI.error('Please save the lesson first');
            return;
        }

        UI.showLoader();

        const res = await fetch(`${Auth.apiBase}/lessons/${currentLesson.lesson._id}/submit`, {
            method: 'PUT',
            headers: Auth.getHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to submit');
        }

        const data = await res.json();
        currentLesson.lesson = data.lesson;

        updateStatusBadge(data.lesson.approvalStatus);
        UI.success('Lesson submitted for approval! An admin will review it soon.');

    } catch (err) {
        console.error('Submit failed:', err);
        UI.error('Failed to submit: ' + err.message);
    } finally {
        UI.hideLoader();
    }
}

/**
 * Publish lesson (Admin only)
 */
async function publishLesson() {
    try {
        // First save the lesson
        await saveDraft();

        if (!currentLesson) {
            UI.error('Please save the lesson first');
            return;
        }

        UI.showLoader();

        const res = await fetch(`${Auth.apiBase}/lessons/${currentLesson.lesson._id}/approve`, {
            method: 'PUT',
            headers: {
                ...Auth.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                adminRemarks: 'Published directly by admin'
            })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to publish');
        }

        const data = await res.json();
        currentLesson.lesson = data.lesson;

        updateStatusBadge(data.lesson.approvalStatus);
        UI.success('Lesson published successfully!');

    } catch (err) {
        console.error('Publish failed:', err);
        UI.error('Failed to publish: ' + err.message);
    } finally {
        UI.hideLoader();
    }
}

/**
 * Build lesson data object from form and editor
 */
async function buildLessonData() {
    const content = await editor.save();

    // Validate
    if (!document.getElementById('lessonTitle').value.trim()) {
        throw new Error('Lesson title is required');
    }

    if (!content || !content.blocks || content.blocks.length === 0) {
        throw new Error('Lesson content cannot be empty');
    }

    return {
        title: document.getElementById('lessonTitle').value.trim(),
        description: document.getElementById('lessonDescription').value.trim(),
        content: content,
        duration: parseInt(document.getElementById('lessonDuration').value) || 0,
        previewDuration: parseInt(document.getElementById('previewDuration').value) || 0,
        isFreePreview: document.getElementById('isFreePreview').checked
    };
}

/**
 * Auto-save functionality
 */
function startAutoSave() {
    autoSaveTimer = setInterval(async () => {
        if (hasUnsavedChanges && currentLesson) {
            console.log('💾 Auto-saving...');
            updateAutoSaveStatus('saving');

            try {
                await saveDraft();
            } catch (err) {
                console.error('Auto-save failed:', err);
                updateAutoSaveStatus('error');
            }
        }
    }, 30000); // Every 30 seconds
}

/**
 * Update auto-save status indicator
 */
function updateAutoSaveStatus(status) {
    const indicator = document.getElementById('autoSaveStatus');

    switch (status) {
        case 'saving':
            indicator.textContent = 'Saving...';
            indicator.className = 'auto-save-indicator saving';
            break;
        case 'saved':
            indicator.textContent = 'All changes saved';
            indicator.className = 'auto-save-indicator saved';
            setTimeout(() => {
                indicator.textContent = '';
            }, 3000);
            break;
        case 'unsaved':
            indicator.textContent = 'Unsaved changes';
            indicator.className = 'auto-save-indicator';
            break;
        case 'error':
            indicator.textContent = 'Auto-save failed';
            indicator.className = 'auto-save-indicator';
            break;
    }
}

/**
 * Update status badge
 */
function updateStatusBadge(status) {
    const badge = document.getElementById('lessonStatus');
    badge.textContent = status;
    badge.className = `status-badge status-${status.toLowerCase()}`;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
});

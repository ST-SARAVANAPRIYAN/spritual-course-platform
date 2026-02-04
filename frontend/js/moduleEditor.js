/**
 * Module Editor Logic
 * Handles standalone module creation and editing
 */

let quillEditor = null;
let courseId = null;
let moduleId = null;

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

    // Initialize Editor
    initializeEditor();

    // Set Back Link
    const backLink = document.getElementById('backLink');
    if (courseId) {
        backLink.href = `module-manager.html?courseId=${courseId}`;
    } else {
        backLink.href = 'staff-dashboard.html'; // Fallback will be resolved after loading module
    }

    // Load Data
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

function selectLocalImage() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
        if (input.files[0]) await uploadContentFile(input.files[0], 'image');
    };
}

function selectLocalVideo() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'video/*');
    input.click();
    input.onchange = async () => {
        if (input.files[0]) await uploadContentFile(input.files[0], 'video');
    };
}

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

async function loadModuleData(id) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/modules/${id}`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load module');

        const data = await res.json();
        const module = data.module || data; // Handle wrapper if present

        document.getElementById('moduleTitle').value = module.title;
        document.getElementById('moduleDescription').value = module.description || '';
        quillEditor.root.innerHTML = module.content || '';

        // If we only had moduleId, ensure we know the courseId for navigation
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

async function saveModule() {
    const title = document.getElementById('moduleTitle').value.trim();
    const description = document.getElementById('moduleDescription').value.trim();
    const content = quillEditor.root.innerHTML;

    if (!title) {
        UI.error('Module Title is required');
        return;
    }

    const payload = { title, description, content };
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

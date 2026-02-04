/**
 * EditorJS Configuration for InnerSpark LMS
 * Configures EditorJS with Cloudinary integration
 */

class EditorConfig {
    constructor(holderId, options = {}) {
        this.holderId = holderId;
        this.options = options;
        this.editor = null;
    }

    /**
     * Initialize EditorJS with all tools
     */
    async init(initialData = null) {
        // Dynamically import EditorJS modules
        const EditorJS = (await import('https://cdn.jsdelivr.net/npm/@editorjs/editorjs@latest')).default;
        const Header = (await import('https://cdn.jsdelivr.net/npm/@editorjs/header@latest')).default;
        const List = (await import('https://cdn.jsdelivr.net/npm/@editorjs/list@latest')).default;
        const Checklist = (await import('https://cdn.jsdelivr.net/npm/@editorjs/checklist@latest')).default;
        const Quote = (await import('https://cdn.jsdelivr.net/npm/@editorjs/quote@latest')).default;
        const Code = (await import('https://cdn.jsdelivr.net/npm/@editorjs/code@latest')).default;
        const Embed = (await import('https://cdn.jsdelivr.net/npm/@editorjs/embed@latest')).default;
        const ImageTool = (await import('https://cdn.jsdelivr.net/npm/@editorjs/image@latest')).default;
        const AttachesTool = (await import('https://cdn.jsdelivr.net/npm/@editorjs/attaches@latest')).default;

        this.editor = new EditorJS({
            holder: this.holderId,

            tools: {
                header: {
                    class: Header,
                    config: {
                        placeholder: 'Enter a heading',
                        levels: [1, 2, 3, 4, 5, 6],
                        defaultLevel: 2
                    },
                    inlineToolbar: true
                },

                paragraph: {
                    inlineToolbar: true
                },

                list: {
                    class: List,
                    inlineToolbar: true,
                    config: {
                        defaultStyle: 'unordered'
                    }
                },

                checklist: {
                    class: Checklist,
                    inlineToolbar: true
                },

                quote: {
                    class: Quote,
                    inlineToolbar: true,
                    config: {
                        quotePlaceholder: 'Enter a quote',
                        captionPlaceholder: 'Quote\'s author'
                    }
                },

                code: {
                    class: Code,
                    config: {
                        placeholder: 'Enter code snippet'
                    }
                },

                embed: {
                    class: Embed,
                    config: {
                        services: {
                            youtube: true,
                            vimeo: true,
                            soundcloud: true,
                            coub: true,
                            imgur: true
                        }
                    },
                    inlineToolbar: false
                },

                image: {
                    class: ImageTool,
                    config: {
                        /**
                         * Custom uploader for Cloudinary
                         */
                        uploader: {
                            async uploadByFile(file) {
                                const formData = new FormData();
                                formData.append('image', file);

                                try {
                                    const res = await fetch(`${Auth.apiBase}/lessons/upload-image`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                                        },
                                        body: formData
                                    });

                                    if (!res.ok) {
                                        const error = await res.json();
                                        throw new Error(error.message || 'Upload failed');
                                    }

                                    const data = await res.json();

                                    return {
                                        success: 1,
                                        file: {
                                            url: data.file.url
                                        }
                                    };
                                } catch (err) {
                                    console.error('Image upload error:', err);
                                    UI.error('Failed to upload image: ' + err.message);
                                    return {
                                        success: 0,
                                        error: err.message
                                    };
                                }
                            },

                            async uploadByUrl(url) {
                                // Support direct URL embedding
                                return {
                                    success: 1,
                                    file: {
                                        url: url
                                    }
                                };
                            }
                        },

                        captionPlaceholder: 'Image caption (optional)',
                        buttonContent: 'Select an image',
                        types: 'image/*',
                        additionalRequestHeaders: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    }
                },

                attaches: {
                    class: AttachesTool,
                    config: {
                        uploader: {
                            async uploadByFile(file) {
                                const formData = new FormData();
                                formData.append('file', file);
                                formData.append('type', 'document');
                                formData.append('name', file.name);

                                // Need lesson ID - will be set by parent component
                                const lessonId = window.currentLessonId;
                                if (!lessonId) {
                                    throw new Error('No lesson context for file upload');
                                }

                                try {
                                    const res = await fetch(`${Auth.apiBase}/lessons/${lessonId}/attach-file`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                                        },
                                        body: formData
                                    });

                                    if (!res.ok) {
                                        const error = await res.json();
                                        throw new Error(error.message || 'Upload failed');
                                    }

                                    const data = await res.json();

                                    return {
                                        success: 1,
                                        file: {
                                            url: data.resource.url,
                                            size: data.resource.size,
                                            name: data.resource.name,
                                            extension: file.name.split('.').pop()
                                        }
                                    };
                                } catch (err) {
                                    console.error('File attach error:', err);
                                    UI.error('Failed to attach file: ' + err.message);
                                    return {
                                        success: 0,
                                        error: err.message
                                    };
                                }
                            }
                        },

                        buttonText: 'Select file to upload',
                        errorMessage: 'File upload failed'
                    }
                }
            },

            data: initialData || {
                time: Date.now(),
                blocks: [],
                version: '2.29.0'
            },

            placeholder: this.options.placeholder || 'Start writing your lesson content...',

            autofocus: this.options.autofocus !== undefined ? this.options.autofocus : true,

            minHeight: this.options.minHeight || 300,

            onReady: () => {
                console.log('✅ EditorJS is ready');
                if (this.options.onReady) {
                    this.options.onReady();
                }
            },

            onChange: async (api, event) => {
                if (this.options.onChange) {
                    const data = await this.save();
                    this.options.onChange(data, api, event);
                }
            }
        });

        await this.editor.isReady;
        return this.editor;
    }

    /**
     * Save editor content
     */
    async save() {
        if (!this.editor) {
            throw new Error('Editor not initialized');
        }

        try {
            const outputData = await this.editor.save();
            console.log('📝 Content saved:', outputData);
            return outputData;
        } catch (err) {
            console.error('Saving failed:', err);
            throw err;
        }
    }

    /**
     * Destroy editor instance
     */
    destroy() {
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }

    /**
     * Check if editor is ready
     */
    async isReady() {
        if (!this.editor) {
            return false;
        }
        await this.editor.isReady;
        return true;
    }
}

// Export for use in other modules
window.EditorConfig = EditorConfig;

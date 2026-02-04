/**
 * Content Renderer for EditorJS Blocks
 * Renders saved EditorJS content for student view
 */

class ContentRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container ${containerId} not found`);
        }
    }

    /**
     * Render EditorJS content to HTML
     */
    render(data) {
        if (!data || !data.blocks) {
            this.container.innerHTML = '<p class="empty-content">No content available</p>';
            return;
        }

        const html = data.blocks.map(block => this.renderBlock(block)).join('');
        this.container.innerHTML = html;

        // Initialize any interactive elements
        this.initializeInteractive();
    }

    /**
     * Render individual block based on type
     */
    renderBlock(block) {
        const renderers = {
            header: this.renderHeader,
            paragraph: this.renderParagraph,
            list: this.renderList,
            checklist: this.renderChecklist,
            quote: this.renderQuote,
            code: this.renderCode,
            embed: this.renderEmbed,
            image: this.renderImage,
            attaches: this.renderAttachment
        };

        const renderer = renderers[block.type] || this.renderUnsupported;
        return renderer.call(this, block.data);
    }

    renderHeader(data) {
        const level = data.level || 2;
        return `<h${level} class="content-header" id="${this.generateId(data.text)}">${data.text}</h${level}>`;
    }

    renderParagraph(data) {
        return `<p class="content-paragraph">${data.text}</p>`;
    }

    renderList(data) {
        const tag = data.style === 'ordered' ? 'ol' : 'ul';
        const items = data.items.map(item => `<li>${item}</li>`).join('');
        return `<${tag} class="content-list">${items}</${tag}>`;
    }

    renderChecklist(data) {
        const items = data.items.map(item => {
            const checked = item.checked ? 'checked' : '';
            const className = item.checked ? 'checked' : '';
            return `
                <div class="checklist-item ${className}">
                    <input type="checkbox" ${checked} disabled>
                    <span>${item.text}</span>
                </div>
            `;
        }).join('');
        return `<div class="content-checklist">${items}</div>`;
    }

    renderQuote(data) {
        const caption = data.caption ? `<cite>${data.caption}</cite>` : '';
        return `
            <blockquote class="content-quote">
                <p>${data.text}</p>
                ${caption}
            </blockquote>
        `;
    }

    renderCode(data) {
        const escapedCode = this.escapeHtml(data.code);
        return `
            <pre class="content-code"><code>${escapedCode}</code></pre>
        `;
    }

    renderEmbed(data) {
        const embedCode = this.createEmbed(data.service, data.source, data.embed);
        return `
            <div class="content-embed">
                ${embedCode}
                ${data.caption ? `<p class="embed-caption">${data.caption}</p>` : ''}
            </div>
        `;
    }

    renderImage(data) {
        return `
            <figure class="content-image">
                <img src="${data.file.url}" alt="${data.caption || ''}" loading="lazy">
                ${data.caption ? `<figcaption>${data.caption}</figcaption>` : ''}
            </figure>
        `;
    }

    renderAttachment(data) {
        const file = data.file;
        const extension = file.extension || 'file';
        const size = this.formatBytes(file.size);

        return `
            <div class="content-attachment">
                <i class="fas fa-file-${this.getFileIcon(extension)}"></i>
                <div class="attachment-info">
                    <div class="attachment-name">${file.name}</div>
                    <div class="attachment-meta">${extension.toUpperCase()} • ${size}</div>
                </div>
                <a href="${file.url}" target="_blank" class="attachment-download" download>
                    <i class="fas fa-download"></i> Download
                </a>
            </div>
        `;
    }

    renderUnsupported(data) {
        console.warn('Unsupported block type:', data);
        return `<div class="content-unsupported">Unsupported content type</div>`;
    }

    /**
     * Helper functions
     */

    createEmbed(service, source, embedCode) {
        // YouTube embed
        if (service === 'youtube') {
            const videoId = this.extractYouTubeId(source);
            return `
                <div class="video-wrapper">
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
            `;
        }

        // Vimeo embed
        if (service === 'vimeo') {
            const videoId = this.extractVimeoId(source);
            return `
                <div class="video-wrapper">
                    <iframe 
                        src="https://player.vimeo.com/video/${videoId}" 
                        frameborder="0" 
                        allow="autoplay; fullscreen; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
            `;
        }

        // Generic embed
        return embedCode || `<a href="${source}" target="_blank">${source}</a>`;
    }

    extractYouTubeId(url) {
        const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
        return match ? match[1] : '';
    }

    extractVimeoId(url) {
        const match = url.match(/vimeo\.com\/(\d+)/);
        return match ? match[1] : '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateId(text) {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    getFileIcon(extension) {
        const icons = {
            pdf: 'pdf',
            doc: 'word',
            docx: 'word',
            xls: 'excel',
            xlsx: 'excel',
            ppt: 'powerpoint',
            pptx: 'powerpoint',
            zip: 'archive',
            rar: 'archive',
            jpg: 'image',
            jpeg: 'image',
            png: 'image',
            gif: 'image',
            mp4: 'video',
            mp3: 'audio',
            txt: 'alt'
        };
        return icons[extension.toLowerCase()] || 'file';
    }

    initializeInteractive() {
        // Add syntax highlighting for code blocks if library available
        if (typeof Prism !== 'undefined') {
            this.container.querySelectorAll('pre code').forEach(block => {
                Prism.highlightElement(block);
            });
        }

        // Make embedded videos responsive
        this.container.querySelectorAll('.video-wrapper').forEach(wrapper => {
            const iframe = wrapper.querySelector('iframe');
            if (iframe) {
                wrapper.style.position = 'relative';
                wrapper.style.paddingBottom = '56.25%'; // 16:9 aspect ratio
                wrapper.style.height = '0';
                iframe.style.position = 'absolute';
                iframe.style.top = '0';
                iframe.style.left = '0';
                iframe.style.width = '100%';
                iframe.style.height = '100%';
            }
        });
    }
}

// Export for use
window.ContentRenderer = ContentRenderer;

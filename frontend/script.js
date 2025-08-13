// Configure API base URL based on environment
if (!window.API_BASE_URL) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.API_BASE_URL = isLocalhost ? 'http://localhost:8081/api' : '/api';
}

class MarkdownConverter {
    constructor() {
        this.markdownInput = document.getElementById('markdown-input');
        this.templateSelect = document.getElementById('template-select');
        this.convertBtn = document.getElementById('convert-btn');
        this.statusMessage = document.getElementById('status-message');
        this.btnText = document.querySelector('.btn-text');
        this.spinner = document.querySelector('.spinner');
        
        this.templateSelect.disabled = true;
        this.convertBtn.disabled = true;
        this.userTemplateFile = null;
        this.templates = [];
        this.backendReachable = false;
        
        this.init();
    }

    async init() {
        await this.loadTemplates();
        this.bindEvents();
        this.updateButtonState();
    }

    async loadTemplates() {
        try {
            const response = await fetch(`${window.API_BASE_URL}/templates`);
            if (!response.ok) {
                throw new Error('Fehler beim Laden der Templates');
            }
            
            const templates = await response.json();
            this.templates = templates;
            this.backendReachable = true;
            this.populateTemplateSelect(templates);
        } catch (error) {
            this.backendReachable = false;
            this.showStatus('Backend nicht erreichbar - Templates können nicht geladen werden', 'error');
            console.error('Fehler beim Laden der Templates:', error);
        }
    }

    populateTemplateSelect(templates) {
        if (templates.length === 0) {
            this.templateSelect.innerHTML = '<option value="">Keine Templates vorhanden</option>';
            this.templateSelect.disabled = true;
            this.convertBtn.disabled = true;
        } else {
            // Populate dropdown with available templates
            this.templateSelect.innerHTML = '';
            
            // Add standard templates
            templates.forEach(template => {
                const option = document.createElement('option');
                const templateId = template.filename.split('.')[0];
                option.value = templateId;
                option.textContent = template.description;
                this.templateSelect.appendChild(option);
            });
            
            // Add custom template upload option
            const customOption = document.createElement('option');
            customOption.value = '__load_from_disk__';
            customOption.textContent = 'Template von Festplatte laden...';
            this.templateSelect.appendChild(customOption);
            
            // Auto-select first template
            const firstTemplateId = templates[0].filename.split('.')[0];
            this.templateSelect.value = firstTemplateId;
            this.templateSelect.disabled = false;
        }
    }

    bindEvents() {
        this.markdownInput.addEventListener('input', () => this.updateButtonState());
        this.templateSelect.addEventListener('change', () => this.handleTemplateChange());
        this.convertBtn.addEventListener('click', () => this.handleConvert());
        
        // Keyboard shortcuts
        this.markdownInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (!this.convertBtn.disabled) {
                    this.handleConvert();
                }
            }
        });
    }

    async handleTemplateChange() {
        if (this.templateSelect.value === '__load_from_disk__') {
            await this.handleCustomTemplate();
        } else if (this.templateSelect.value === '__custom__') {
            // Custom template already loaded, no action needed
        } else {
            // Standard template selected - remove any custom template
            this.removeUserTemplateOption();
            this.userTemplateFile = null;
        }
        this.updateButtonState();
    }

    async handleCustomTemplate() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.docx,.doc';
        input.style.display = 'none';
        
        return new Promise((resolve) => {
            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (file) {
                    // Validate file size (25MB limit)
                    if (file.size > 26214400) {
                        this.showStatus('Datei ist zu groß. Maximum: 25MB', 'error');
                        this.resetToFirstTemplate();
                        resolve();
                        return;
                    }
                    
                    try {
                        await this.uploadUserTemplate(file);
                        this.userTemplateFile = file.name;
                        this.addUserTemplateOption(file.name);
                        this.showStatus('Template erfolgreich hochgeladen', 'success');
                    } catch (error) {
                        this.showStatus('Fehler beim Upload', 'error');
                        this.resetToFirstTemplate();
                    }
                } else {
                    // User cancelled file selection
                    this.resetToFirstTemplate();
                }
                resolve();
            };
            
            input.oncancel = () => {
                this.resetToFirstTemplate();
                resolve();
            };
            
            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
        });
    }

    resetToFirstTemplate() {
        if (this.templates.length > 0) {
            this.removeUserTemplateOption();
            const firstTemplateId = this.templates[0].filename.split('.')[0];
            this.templateSelect.value = firstTemplateId;
            this.userTemplateFile = null;
        }
    }

    addUserTemplateOption(filename) {
        // Remove any existing user template option
        this.removeUserTemplateOption();
        
        // Create new option with filename
        const userOption = document.createElement('option');
        userOption.value = '__custom__';
        userOption.textContent = filename;
        
        // Insert before the "load from disk" option
        const loadOption = this.templateSelect.querySelector('option[value="__load_from_disk__"]');
        this.templateSelect.insertBefore(userOption, loadOption);
        
        // Select the new custom template
        this.templateSelect.value = '__custom__';
    }

    removeUserTemplateOption() {
        const customOption = this.templateSelect.querySelector('option[value="__custom__"]');
        if (customOption) {
            customOption.remove();
        }
    }

    async uploadUserTemplate(file) {
        const formData = new FormData();
        formData.append('template', file);
        
        const response = await fetch(`${window.API_BASE_URL}/upload-template`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload fehlgeschlagen');
        }
        
        return await response.json();
    }

    updateButtonState() {
        const hasTemplate = this.templateSelect.value.length > 0 && !this.templateSelect.disabled;
        
        this.convertBtn.disabled = !(hasTemplate && this.backendReachable);
    }

    async handleConvert() {
        if (this.convertBtn.disabled) return;
        
        let markdown = this.markdownInput.value.trim();
        const templateId = this.templateSelect.value;
        
        // If no content, use markdownExample variable
        if (!markdown) {
            markdown = window.markdownExample || '';
        }
        
        if (!markdown || !templateId) {
            this.showStatus('Bitte gebe Markdown-Text ein und wähle ein Template aus.', 'error');
            return;
        }
        
        this.setLoadingState(true);
        this.hideStatus();
        
        try {
            // Prevent conversion with load option selected
            if (templateId === '__load_from_disk__') {
                this.showStatus('Bitte wähle ein Template aus.', 'error');
                this.setLoadingState(false);
                return;
            }
            
            // Validate custom template is uploaded
            if (templateId === '__custom__' && !this.userTemplateFile) {
                this.showStatus('Bitte lade zuerst ein eigenes Template hoch.', 'error');
                this.setLoadingState(false);
                return;
            }
            
            const response = await fetch(`${window.API_BASE_URL}/convert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    markdown: markdown,
                    template_id: templateId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Konvertierung fehlgeschlagen');
            }
            
            // Download generated file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Extract filename from Content-Disposition header
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'dokument.docx';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showStatus('Dokument erfolgreich erstellt und heruntergeladen!', 'success');
            
        } catch (error) {
            this.showStatus('Fehler bei der Konvertierung: ' + error.message, 'error');
            console.error('Konvertierungsfehler:', error);
        } finally {
            this.setLoadingState(false);
        }
    }

    setLoadingState(loading) {
        this.convertBtn.disabled = loading;
        
        if (loading) {
            this.btnText.style.display = 'none';
            this.spinner.style.display = 'block';
        } else {
            this.btnText.style.display = 'block';
            this.spinner.style.display = 'none';
            // Re-evaluate button state after loading completes
            setTimeout(() => this.updateButtonState(), 100);
        }
    }

    showStatus(message, type) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => this.hideStatus(), 5000);
        }
    }

    hideStatus() {
        this.statusMessage.style.display = 'none';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MarkdownConverter();
});
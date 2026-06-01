// ===================================
// Signature Pad Component
// ===================================

class SignaturePad {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with id "${canvasId}" not found`);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.hasSignature = false;
        this.options = {
            lineWidth: options.lineWidth || 2,
            lineColor: options.lineColor || '#000000',
            backgroundColor: options.backgroundColor || '#ffffff',
            ...options
        };

        this.init();
    }

    init() {
        // Set canvas size
        this.resizeCanvas();

        // Event listeners
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));

        // Resize handler
        window.addEventListener('resize', debounce(() => this.resizeCanvas(), 250));

        // Initial clear
        this.clear();
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Redraw if there was a signature
        if (this.hasSignature && this.imageData) {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = this.imageData;
        }
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    startDrawing(e) {
        e.preventDefault();
        this.isDrawing = true;
        const pos = this.getMousePos(e);

        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.ctx.lineWidth = this.options.lineWidth;
        this.ctx.strokeStyle = this.options.lineColor;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    draw(e) {
        if (!this.isDrawing) return;
        e.preventDefault();

        const pos = this.getMousePos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        this.hasSignature = true;

        // Update canvas class
        this.canvas.classList.add('signed');
    }

    stopDrawing(e) {
        if (!this.isDrawing) return;
        e.preventDefault();

        this.isDrawing = false;
        this.ctx.closePath();

        // Save current state
        if (this.hasSignature) {
            this.imageData = this.canvas.toDataURL();
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.isDrawing = true;
        const pos = this.getTouchPos(e);

        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.ctx.lineWidth = this.options.lineWidth;
        this.ctx.strokeStyle = this.options.lineColor;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    handleTouchMove(e) {
        if (!this.isDrawing) return;
        e.preventDefault();

        const pos = this.getTouchPos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        this.hasSignature = true;

        // Update canvas class
        this.canvas.classList.add('signed');
    }

    clear() {
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasSignature = false;
        this.imageData = null;
        this.canvas.classList.remove('signed');
    }

    isEmpty() {
        return !this.hasSignature;
    }

    toDataURL(type = 'image/png') {
        return this.canvas.toDataURL(type);
    }

    fromDataURL(dataURL) {
        const img = new Image();
        img.onload = () => {
            this.clear();
            this.ctx.drawImage(img, 0, 0);
            this.hasSignature = true;
            this.imageData = dataURL;
            this.canvas.classList.add('signed');
        };
        img.src = dataURL;
    }
}

/**
 * Create a signature pad with controls
 */
function createSignaturePadWithControls(containerId, label, canvasId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    container.innerHTML = `
        <div class="signature-container">
            <label class="signature-label">${label}</label>
            <canvas id="${canvasId}" class="signature-pad"></canvas>
            <div class="signature-actions">
                <button type="button" class="btn btn-sm btn-secondary" onclick="window.${canvasId}_pad.clear()">
                    Limpiar
                </button>
            </div>
        </div>
    `;

    // Create signature pad instance
    const pad = new SignaturePad(canvasId);

    // Store globally for easy access
    window[`${canvasId}_pad`] = pad;

    return pad;
}

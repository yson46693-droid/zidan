/**
 * مكتبة إنشاء الباركود الرقمي
 * تستخدم Canvas لرسم الباركود
 */

class BarcodeGenerator {
    constructor() {
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * إنشاء باركود رقمي
     * @param {string} data - البيانات المراد تحويلها لباركود
     * @param {number} width - عرض الباركود
     * @param {number} height - ارتفاع الباركود
     * @returns {string} - صورة الباركود كـ Base64
     */
    generateBarcode(data, width = 200, height = 80) {
        // إنشاء canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');

        // تنظيف الخلفية
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, width, height);

        // تحويل البيانات إلى أرقام
        const numericData = this.convertToNumeric(data);
        
        // رسم الباركود
        this.drawBarcode(numericData, width, height);

        // إضافة النص أسفل الباركود
        this.addText(data, width, height);

        // تحويل إلى Base64
        return this.canvas.toDataURL('image/png');
    }

    /**
     * تحويل البيانات إلى أرقام
     * @param {string} data - البيانات الأصلية
     * @returns {string} - البيانات الرقمية
     */
    convertToNumeric(data) {
        let numeric = '';
        for (let i = 0; i < data.length; i++) {
            const char = data.charAt(i);
            if (char >= '0' && char <= '9') {
                numeric += char;
            } else {
                // تحويل الحروف إلى أرقام
                numeric += (char.charCodeAt(0) % 10).toString();
            }
        }
        return numeric;
    }

    /**
     * رسم الباركود
     * @param {string} numericData - البيانات الرقمية
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     */
    drawBarcode(numericData, width, height) {
        const barWidth = width / (numericData.length * 2 + 2);
        let x = barWidth;

        // رسم الباركود
        for (let i = 0; i < numericData.length; i++) {
            const digit = parseInt(numericData.charAt(i));
            
            // رسم الشريط الأسود
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x, 10, barWidth, height - 30);
            
            x += barWidth;
            
            // رسم المساحة البيضاء
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(x, 10, barWidth, height - 30);
            
            x += barWidth;
        }

        // إضافة خطوط البداية والنهاية
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 10, barWidth, height - 30);
        this.ctx.fillRect(width - barWidth, 10, barWidth, height - 30);
    }

    /**
     * إضافة النص أسفل الباركود
     * @param {string} text - النص المراد إضافته
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     */
    addText(text, width, height) {
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, width / 2, height - 5);
    }

    /**
     * إنشاء QR Code بسيط
     * @param {string} data - البيانات
     * @param {number} size - الحجم
     * @returns {string} - صورة QR Code كـ Base64
     */
    generateQRCode(data, size = 100) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d');

        // تنظيف الخلفية
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, size, size);

        // رسم QR Code بسيط (نمط مربعات)
        const cellSize = size / 25;
        this.ctx.fillStyle = '#000000';

        // رسم النمط الأساسي
        for (let i = 0; i < 25; i++) {
            for (let j = 0; j < 25; j++) {
                // إنشاء نمط عشوائي مبني على البيانات
                const hash = this.simpleHash(data + i + j);
                if (hash % 3 === 0) {
                    this.ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
                }
            }
        }

        // إضافة مربعات الزاوية
        this.drawCornerSquares(cellSize);

        return this.canvas.toDataURL('image/png');
    }

    /**
     * رسم مربعات الزاوية للـ QR Code
     * @param {number} cellSize - حجم الخلية
     */
    drawCornerSquares(cellSize) {
        // المربع العلوي الأيسر
        this.ctx.fillRect(0, 0, cellSize * 7, cellSize * 7);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(cellSize, cellSize, cellSize * 5, cellSize * 5);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(cellSize * 2, cellSize * 2, cellSize * 3, cellSize * 3);

        // المربع العلوي الأيمن
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(18 * cellSize, 0, cellSize * 7, cellSize * 7);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(19 * cellSize, cellSize, cellSize * 5, cellSize * 5);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(20 * cellSize, cellSize * 2, cellSize * 3, cellSize * 3);

        // المربع السفلي الأيسر
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 18 * cellSize, cellSize * 7, cellSize * 7);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(cellSize, 19 * cellSize, cellSize * 5, cellSize * 5);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(cellSize * 2, 20 * cellSize, cellSize * 3, cellSize * 3);
    }

    /**
     * دالة hash بسيطة
     * @param {string} str - النص
     * @returns {number} - قيمة hash
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // تحويل إلى 32-bit integer
        }
        return Math.abs(hash);
    }
}

// إنشاء instance عام
window.barcodeGenerator = new BarcodeGenerator();

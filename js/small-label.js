/**
 * نظام الملصق الصغير للباركود
 * يحتوي على بيانات المشكلة وتاريخ التسليم
 */

class SmallLabelGenerator {
    constructor() {
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * إنشاء ملصق صغير محسن
     * @param {Object} repairData - بيانات عملية الصيانة
     * @param {number} width - عرض الملصق
     * @param {number} height - ارتفاع الملصق
     * @returns {string} - صورة الملصق كـ Base64
     */
    generateLabel(repairData, width = 472, height = 315) {
        // إنشاء canvas بدقة أعلى
        this.canvas = document.createElement('canvas');
        this.canvas.width = width * 2; // دقة مضاعفة
        this.canvas.height = height * 2;
        this.ctx = this.canvas.getContext('2d');
        
        // تحسين جودة الرسم
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // قياس العناصر بناءً على الدقة المضاعفة
        const scale = 2;
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        // تنظيف الخلفية
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, scaledWidth, scaledHeight);

        // رسم الحدود المحسنة
        this.drawEnhancedBorder(scaledWidth, scaledHeight);

        // رسم الباركود المحسن
        this.drawEnhancedBarcode(repairData.repair_number, scaledWidth, scale);

        // رسم البيانات المحسنة
        this.drawEnhancedData(repairData, scaledWidth, scaledHeight, scale);

        // تحويل إلى الحجم الأصلي مع الحفاظ على الجودة
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.drawImage(this.canvas, 0, 0, width, height);

        return finalCanvas.toDataURL('image/png', 1.0);
    }

    /**
     * رسم الحدود المحسنة
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     */
    drawEnhancedBorder(width, height) {
        // الحد الخارجي
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(2, 2, width - 4, height - 4);

        // خط فاصل محسن
        this.ctx.beginPath();
        this.ctx.moveTo(10, height * 0.45);
        this.ctx.lineTo(width - 10, height * 0.45);
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // خطوط زخرفية في الزوايا
        this.ctx.lineWidth = 1;
        const cornerSize = 15;
        
        // الزاوية العلوية اليسرى
        this.ctx.beginPath();
        this.ctx.moveTo(10, 10);
        this.ctx.lineTo(10 + cornerSize, 10);
        this.ctx.moveTo(10, 10);
        this.ctx.lineTo(10, 10 + cornerSize);
        this.ctx.stroke();
        
        // الزاوية العلوية اليمنى
        this.ctx.beginPath();
        this.ctx.moveTo(width - 10, 10);
        this.ctx.lineTo(width - 10 - cornerSize, 10);
        this.ctx.moveTo(width - 10, 10);
        this.ctx.lineTo(width - 10, 10 + cornerSize);
        this.ctx.stroke();
    }

    /**
     * رسم الحدود
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     */
    drawBorder(width, height) {
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(1, 1, width - 2, height - 2);

        // خط فاصل
        this.ctx.beginPath();
        this.ctx.moveTo(0, height * 0.4);
        this.ctx.lineTo(width, height * 0.4);
        this.ctx.stroke();
    }

    /**
     * رسم الباركود المحسن
     * @param {string} repairNumber - رقم العملية
     * @param {number} width - العرض
     * @param {number} scale - مقياس الرسم
     */
    drawEnhancedBarcode(repairNumber, width, scale) {
        const barcodeHeight = 50 * scale;
        const barcodeY = 15 * scale;
        const margin = 20 * scale;
        const availableWidth = width - (margin * 2);
        const barWidth = availableWidth / (repairNumber.length * 2 + 2);
        let x = margin + barWidth;

        // رسم الباركود مع تحسينات
        for (let i = 0; i < repairNumber.length; i++) {
            const digit = parseInt(repairNumber.charAt(i));
            
            // رسم الشريط الأسود مع حدود واضحة
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(Math.round(x), barcodeY, Math.round(barWidth), barcodeHeight);
            
            x += barWidth;
            
            // رسم المساحة البيضاء
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(Math.round(x), barcodeY, Math.round(barWidth), barcodeHeight);
            
            x += barWidth;
        }

        // إضافة خطوط البداية والنهاية المحسنة
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(margin, barcodeY, Math.round(barWidth * 1.5), barcodeHeight);
        this.ctx.fillRect(width - margin - Math.round(barWidth * 1.5), barcodeY, Math.round(barWidth * 1.5), barcodeHeight);

        // إضافة النص أسفل الباركود مع تحسينات
        this.ctx.fillStyle = '#000000';
        this.ctx.font = `bold ${12 * scale}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(repairNumber, width / 2, barcodeY + barcodeHeight + (8 * scale));
    }

    /**
     * رسم الباركود
     * @param {string} repairNumber - رقم العملية
     * @param {number} width - العرض
     */
    drawBarcode(repairNumber, width) {
        const barcodeHeight = 40;
        const barcodeY = 10;
        const barWidth = width / (repairNumber.length * 2 + 2);
        let x = barWidth;

        // رسم الباركود
        for (let i = 0; i < repairNumber.length; i++) {
            const digit = parseInt(repairNumber.charAt(i));
            
            // رسم الشريط الأسود
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x, barcodeY, barWidth, barcodeHeight);
            
            x += barWidth;
            
            // رسم المساحة البيضاء
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(x, barcodeY, barWidth, barcodeHeight);
            
            x += barWidth;
        }

        // إضافة خطوط البداية والنهاية
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, barcodeY, barWidth, barcodeHeight);
        this.ctx.fillRect(width - barWidth, barcodeY, barWidth, barcodeHeight);

        // إضافة النص أسفل الباركود
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(repairNumber, width / 2, barcodeY + barcodeHeight + 12);
    }

    /**
     * رسم البيانات المحسنة
     * @param {Object} repairData - بيانات العملية
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     * @param {number} scale - مقياس الرسم
     */
    drawEnhancedData(repairData, width, height, scale) {
        // ✅ تحسين: تقليل المسافة من الأعلى وإزالة المساحة البيضاء في الأسفل
        const barcodeBottom = (15 * scale) + (50 * scale) + (8 * scale) + (12 * scale); // نهاية الباركود + النص
        const startY = barcodeBottom + (8 * scale); // بداية البيانات بعد الباركود مباشرة
        const lineHeight = 20 * scale; // زيادة lineHeight للخطوط الأكبر
        const margin = 12 * scale; // تقليل الهامش
        const marginBottom = 10 * scale; // مسافة من الأسفل
        let currentY = startY;

        // تنسيق النص المحسن
        this.ctx.fillStyle = '#000000';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';

        // عنوان الملصق مع تحسينات - خط أكبر
        this.ctx.font = `bold ${14 * scale}px Arial`;
        this.ctx.fillText('ملصق الصيانة', width - margin, currentY);
        currentY += lineHeight + (3 * scale);

        // رقم العملية - خط أكبر
        this.ctx.font = `bold ${13 * scale}px Arial`;
        this.ctx.fillText(`رقم: ${repairData.repair_number}`, width - margin, currentY);
        currentY += lineHeight + (3 * scale);

        // بيانات العميل - خط أكبر
        this.ctx.font = `${12 * scale}px Arial`;
        const customerName = repairData.customer_name || 'غير محدد';
        if (customerName.length > 15) {
            this.ctx.fillText(`العميل: ${customerName.substring(0, 15)}...`, width - margin, currentY);
        } else {
            this.ctx.fillText(`العميل: ${customerName}`, width - margin, currentY);
        }
        currentY += lineHeight;
        
        if (repairData.customer_phone) {
            this.ctx.fillText(`الهاتف: ${repairData.customer_phone}`, width - margin, currentY);
            currentY += lineHeight;
        }

        // نوع الجهاز - مختصر - خط أكبر
        const deviceText = `${repairData.device_type || ''} ${repairData.device_model || ''}`.trim();
        if (deviceText) {
            const deviceDisplay = deviceText.length > 18 ? deviceText.substring(0, 18) + '...' : deviceText;
            this.ctx.fillText(`الجهاز: ${deviceDisplay}`, width - margin, currentY);
            currentY += lineHeight + (3 * scale);
        }

        // المشكلة مع تحسينات - خط أكبر
        this.ctx.font = `bold ${11 * scale}px Arial`;
        this.ctx.fillText('المشكلة:', width - margin, currentY);
        currentY += lineHeight;
        
        this.ctx.font = `${11 * scale}px Arial`;
        const maxTextWidth = width - (margin * 2);
        const problemText = this.wrapTextEnhanced(repairData.problem || 'غير محدد', maxTextWidth, `${11 * scale}px Arial`);
        let linesCount = 0;
        const maxLines = 3; // حد أقصى 3 أسطر
        problemText.forEach(line => {
            if (linesCount < maxLines) {
                // ✅ التحقق من المساحة المتاحة قبل الرسم
                if (currentY + lineHeight <= height * scale - marginBottom) {
                    this.ctx.fillText(line, width - margin, currentY);
                    currentY += lineHeight;
                    linesCount++;
                }
            }
        });

        currentY += (3 * scale);

        // تاريخ التسليم - خط أكبر
        // ✅ التحقق من المساحة المتاحة قبل الرسم
        if (currentY + (lineHeight * 2) <= height * scale - marginBottom) {
            this.ctx.font = `bold ${11 * scale}px Arial`;
            this.ctx.fillText('التسليم:', width - margin, currentY);
            currentY += lineHeight;
            
            const deliveryDate = repairData.delivery_date ? 
                new Date(repairData.delivery_date).toLocaleDateString('ar-EG') : 
                'لم يتم تحديده';
            this.ctx.font = `${11 * scale}px Arial`;
            this.ctx.fillText(deliveryDate, width - margin, currentY);
        }
    }

    /**
     * رسم البيانات
     * @param {Object} repairData - بيانات العملية
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     */
    drawData(repairData, width, height) {
        const startY = height * 0.4 + 10;
        const lineHeight = 15;
        let currentY = startY;

        // تنسيق النص
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'right';

        // عنوان الملصق
        this.ctx.fillText('ملصق عملية الصيانة', width - 10, currentY);
        currentY += lineHeight + 5;

        // بيانات المشكلة
        this.ctx.font = '10px Arial';
        this.ctx.fillText('المشكلة:', width - 10, currentY);
        currentY += lineHeight;
        
        // تقسيم النص إذا كان طويلاً
        const problemText = this.wrapText(repairData.problem, width - 20, '10px Arial');
        problemText.forEach(line => {
            this.ctx.fillText(line, width - 10, currentY);
            currentY += lineHeight;
        });

        currentY += 5;

        // تاريخ التسليم
        this.ctx.fillText('تاريخ التسليم:', width - 10, currentY);
        currentY += lineHeight;
        
        const deliveryDate = repairData.delivery_date ? 
            new Date(repairData.delivery_date).toLocaleDateString('ar-EG') : 
            'لم يتم تحديده';
        this.ctx.fillText(deliveryDate, width - 10, currentY);
        currentY += lineHeight + 5;

        // بيانات إضافية
        this.ctx.font = '9px Arial';
        this.ctx.fillText(`العميل: ${repairData.customer_name}`, width - 10, currentY);
        currentY += lineHeight;
        this.ctx.fillText(`الهاتف: ${repairData.customer_phone}`, width - 10, currentY);
    }

    /**
     * تقسيم النص المحسن لأسطر متعددة
     * @param {string} text - النص المراد تقسيمه
     * @param {number} maxWidth - العرض الأقصى
     * @param {string} font - خط النص
     * @returns {Array} - مصفوفة الأسطر
     */
    wrapTextEnhanced(text, maxWidth, font) {
        this.ctx.font = font;
        
        // تنظيف النص وإزالة المسافات الزائدة
        const cleanText = text.trim().replace(/\s+/g, ' ');
        
        // تقسيم النص إلى كلمات
        const words = cleanText.split(' ');
        const lines = [];
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + words[i] + ' ';
            const metrics = this.ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = words[i] + ' ';
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine.trim() !== '') {
            lines.push(currentLine.trim());
        }

        // تحديد الحد الأقصى للأسطر لتجنب التداخل
        const maxLines = 4;
        if (lines.length > maxLines) {
            const truncatedLines = lines.slice(0, maxLines - 1);
            const lastLine = lines[maxLines - 1];
            if (lastLine.length > 20) {
                truncatedLines.push(lastLine.substring(0, 17) + '...');
            } else {
                truncatedLines.push(lastLine);
            }
            return truncatedLines;
        }

        return lines;
    }

    /**
     * تقسيم النص لأسطر متعددة
     * @param {string} text - النص المراد تقسيمه
     * @param {number} maxWidth - العرض الأقصى
     * @param {string} font - خط النص
     * @returns {Array} - مصفوفة الأسطر
     */
    wrapText(text, maxWidth, font) {
        this.ctx.font = font;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + words[i] + ' ';
            const metrics = this.ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = words[i] + ' ';
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine.trim() !== '') {
            lines.push(currentLine.trim());
        }

        return lines;
    }

    /**
     * إنشاء ملصق متقدم محسن مع QR Code
     * @param {Object} repairData - بيانات العملية
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     * @returns {string} - صورة الملصق كـ Base64
     */
    generateAdvancedLabel(repairData, width = 472, height = 315) {
        // إنشاء canvas بدقة أعلى
        this.canvas = document.createElement('canvas');
        this.canvas.width = width * 2; // دقة مضاعفة
        this.canvas.height = height * 2;
        this.ctx = this.canvas.getContext('2d');
        
        // تحسين جودة الرسم
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // قياس العناصر بناءً على الدقة المضاعفة
        const scale = 2;
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        // تنظيف الخلفية
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, scaledWidth, scaledHeight);

        // رسم الحدود المحسنة
        this.drawEnhancedBorder(scaledWidth, scaledHeight);

        // رسم QR Code محسن
        this.drawEnhancedQRCode(repairData, scaledWidth, scaledHeight, scale);

        // رسم البيانات المحسنة
        this.drawEnhancedAdvancedData(repairData, scaledWidth, scaledHeight, scale);

        // تحويل إلى الحجم الأصلي مع الحفاظ على الجودة
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.drawImage(this.canvas, 0, 0, width, height);

        return finalCanvas.toDataURL('image/png', 1.0);
    }

    /**
     * رسم QR Code محسن
     * @param {Object} repairData - بيانات العملية
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     * @param {number} scale - مقياس الرسم
     */
    drawEnhancedQRCode(repairData, width, height, scale) {
        const qrSize = 120 * scale; // حجم QR Code مناسب للملصق 60x40mm
        const qrX = 15 * scale;
        const qrY = 15 * scale;

        // إنشاء QR Code محسن
        const cellSize = qrSize / 25;
        this.ctx.fillStyle = '#000000';

        // رسم النمط الأساسي مع تحسينات
        for (let i = 0; i < 25; i++) {
            for (let j = 0; j < 25; j++) {
                const hash = this.simpleHash(repairData.repair_number + i + j);
                if (hash % 3 === 0) {
                    this.ctx.fillRect(
                        Math.round(qrX + i * cellSize), 
                        Math.round(qrY + j * cellSize), 
                        Math.round(cellSize), 
                        Math.round(cellSize)
                    );
                }
            }
        }

        // إضافة مربعات الزاوية المحسنة
        this.drawEnhancedCornerSquares(qrX, qrY, cellSize);
    }

    /**
     * رسم QR Code
     * @param {Object} repairData - بيانات العملية
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     */
    drawQRCode(repairData, width, height) {
        const qrSize = 80;
        const qrX = 10;
        const qrY = 10;

        // إنشاء QR Code بسيط
        const cellSize = qrSize / 25;
        this.ctx.fillStyle = '#000000';

        // رسم النمط الأساسي
        for (let i = 0; i < 25; i++) {
            for (let j = 0; j < 25; j++) {
                const hash = this.simpleHash(repairData.repair_number + i + j);
                if (hash % 3 === 0) {
                    this.ctx.fillRect(qrX + i * cellSize, qrY + j * cellSize, cellSize, cellSize);
                }
            }
        }

        // إضافة مربعات الزاوية
        this.drawCornerSquares(qrX, qrY, cellSize);
    }

    /**
     * رسم مربعات الزاوية المحسنة للـ QR Code
     * @param {number} x - الموضع X
     * @param {number} y - الموضع Y
     * @param {number} cellSize - حجم الخلية
     */
    drawEnhancedCornerSquares(x, y, cellSize) {
        // المربع العلوي الأيسر
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(cellSize * 7), Math.round(cellSize * 7));
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(Math.round(x + cellSize), Math.round(y + cellSize), Math.round(cellSize * 5), Math.round(cellSize * 5));
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(Math.round(x + cellSize * 2), Math.round(y + cellSize * 2), Math.round(cellSize * 3), Math.round(cellSize * 3));

        // المربع العلوي الأيمن
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(Math.round(x + 18 * cellSize), Math.round(y), Math.round(cellSize * 7), Math.round(cellSize * 7));
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(Math.round(x + 19 * cellSize), Math.round(y + cellSize), Math.round(cellSize * 5), Math.round(cellSize * 5));
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(Math.round(x + 20 * cellSize), Math.round(y + cellSize * 2), Math.round(cellSize * 3), Math.round(cellSize * 3));

        // المربع السفلي الأيسر
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(Math.round(x), Math.round(y + 18 * cellSize), Math.round(cellSize * 7), Math.round(cellSize * 7));
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(Math.round(x + cellSize), Math.round(y + 19 * cellSize), Math.round(cellSize * 5), Math.round(cellSize * 5));
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(Math.round(x + cellSize * 2), Math.round(y + 20 * cellSize), Math.round(cellSize * 3), Math.round(cellSize * 3));
    }

    /**
     * رسم مربعات الزاوية للـ QR Code
     * @param {number} x - الموضع X
     * @param {number} y - الموضع Y
     * @param {number} cellSize - حجم الخلية
     */
    drawCornerSquares(x, y, cellSize) {
        // المربع العلوي الأيسر
        this.ctx.fillRect(x, y, cellSize * 7, cellSize * 7);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x + cellSize, y + cellSize, cellSize * 5, cellSize * 5);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + cellSize * 2, y + cellSize * 2, cellSize * 3, cellSize * 3);

        // المربع العلوي الأيمن
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + 18 * cellSize, y, cellSize * 7, cellSize * 7);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x + 19 * cellSize, y + cellSize, cellSize * 5, cellSize * 5);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + 20 * cellSize, y + cellSize * 2, cellSize * 3, cellSize * 3);

        // المربع السفلي الأيسر
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x, y + 18 * cellSize, cellSize * 7, cellSize * 7);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x + cellSize, y + 19 * cellSize, cellSize * 5, cellSize * 5);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + cellSize * 2, y + 20 * cellSize, cellSize * 3, cellSize * 3);
    }

    /**
     * رسم البيانات المتقدمة المحسنة
     * @param {Object} repairData - بيانات العملية
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     * @param {number} scale - مقياس الرسم
     */
    drawEnhancedAdvancedData(repairData, width, height, scale) {
        const startX = 145 * scale; // بداية النص بعد QR Code
        const startY = 10 * scale; // تقليل المسافة من الأعلى
        const lineHeight = 20 * scale; // زيادة lineHeight للخطوط الأكبر
        const margin = 12 * scale; // تقليل الهامش
        const marginBottom = 10 * scale; // مسافة من الأسفل
        let currentY = startY;

        // تنسيق النص المحسن
        this.ctx.fillStyle = '#000000';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';

        // عنوان الملصق مع تحسينات - خط أكبر
        this.ctx.font = `bold ${14 * scale}px Arial`;
        this.ctx.fillText('ملصق الصيانة', width - margin, currentY);
        currentY += lineHeight + (3 * scale);

        // رقم العملية - خط أكبر
        this.ctx.font = `bold ${13 * scale}px Arial`;
        this.ctx.fillText(`رقم: ${repairData.repair_number}`, width - margin, currentY);
        currentY += lineHeight + (3 * scale);

        // بيانات العميل - خط أكبر
        this.ctx.font = `${12 * scale}px Arial`;
        const customerName = repairData.customer_name || 'غير محدد';
        if (customerName.length > 15) {
            this.ctx.fillText(`العميل: ${customerName.substring(0, 15)}...`, width - margin, currentY);
        } else {
            this.ctx.fillText(`العميل: ${customerName}`, width - margin, currentY);
        }
        currentY += lineHeight;
        
        if (repairData.customer_phone) {
            this.ctx.fillText(`الهاتف: ${repairData.customer_phone}`, width - margin, currentY);
            currentY += lineHeight;
        }

        // نوع الجهاز - مختصر - خط أكبر
        const deviceText = `${repairData.device_type || ''} ${repairData.device_model || ''}`.trim();
        if (deviceText) {
            const deviceDisplay = deviceText.length > 18 ? deviceText.substring(0, 18) + '...' : deviceText;
            this.ctx.fillText(`الجهاز: ${deviceDisplay}`, width - margin, currentY);
            currentY += lineHeight + (3 * scale);
        }

        // المشكلة مع تحسينات - خط أكبر
        this.ctx.font = `bold ${11 * scale}px Arial`;
        this.ctx.fillText('المشكلة:', width - margin, currentY);
        currentY += lineHeight;
        
        this.ctx.font = `${11 * scale}px Arial`;
        const maxTextWidth = width - startX - margin;
        const problemText = this.wrapTextEnhanced(repairData.problem || 'غير محدد', maxTextWidth, `${11 * scale}px Arial`);
        let linesCount = 0;
        const maxLines = 3; // حد أقصى 3 أسطر
        problemText.forEach(line => {
            if (linesCount < maxLines) {
                // ✅ التحقق من المساحة المتاحة قبل الرسم
                if (currentY + lineHeight <= height * scale - marginBottom) {
                    this.ctx.fillText(line, width - margin, currentY);
                    currentY += lineHeight;
                    linesCount++;
                }
            }
        });

        currentY += (3 * scale);

        // تاريخ التسليم - خط أكبر
        // ✅ التحقق من المساحة المتاحة قبل الرسم
        if (currentY + (lineHeight * 2) <= height * scale - marginBottom) {
            this.ctx.font = `bold ${11 * scale}px Arial`;
            this.ctx.fillText('التسليم:', width - margin, currentY);
            currentY += lineHeight;
            
            const deliveryDate = repairData.delivery_date ? 
                new Date(repairData.delivery_date).toLocaleDateString('ar-EG') : 
                'غير محدد';
            this.ctx.font = `${11 * scale}px Arial`;
            this.ctx.fillText(deliveryDate, width - margin, currentY);
            
            // التكلفة - خط أكبر (إذا كان هناك مساحة)
            if (repairData.cost && currentY + lineHeight <= height * scale - marginBottom) {
                currentY += lineHeight + (3 * scale);
                this.ctx.font = `bold ${11 * scale}px Arial`;
                this.ctx.fillText(`التكلفة: ${repairData.cost} ج.م`, width - margin, currentY);
            }
        }
    }

    /**
     * رسم البيانات المتقدمة
     * @param {Object} repairData - بيانات العملية
     * @param {number} width - العرض
     * @param {number} height - الارتفاع
     */
    drawAdvancedData(repairData, width, height) {
        const startX = 100;
        const startY = 15;
        const lineHeight = 18;
        let currentY = startY;

        // تنسيق النص
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'right';

        // عنوان الملصق
        this.ctx.fillText('ملصق عملية الصيانة', width - 10, currentY);
        currentY += lineHeight + 5;

        // رقم العملية
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText(`رقم العملية: ${repairData.repair_number}`, width - 10, currentY);
        currentY += lineHeight;

        // بيانات العميل
        this.ctx.font = '10px Arial';
        this.ctx.fillText(`العميل: ${repairData.customer_name}`, width - 10, currentY);
        currentY += lineHeight;
        this.ctx.fillText(`الهاتف: ${repairData.customer_phone}`, width - 10, currentY);
        currentY += lineHeight;

        // نوع الجهاز
        this.ctx.fillText(`الجهاز: ${repairData.device_type} ${repairData.device_model || ''}`, width - 10, currentY);
        currentY += lineHeight;

        // المشكلة
        this.ctx.fillText('المشكلة:', width - 10, currentY);
        currentY += lineHeight;
        
        const problemText = this.wrapText(repairData.problem, width - startX - 10, '10px Arial');
        problemText.forEach(line => {
            this.ctx.fillText(line, width - 10, currentY);
            currentY += lineHeight;
        });

        currentY += 5;

        // تاريخ التسليم
        this.ctx.font = 'bold 11px Arial';
        this.ctx.fillText('تاريخ التسليم:', width - 10, currentY);
        currentY += lineHeight;
        
        const deliveryDate = repairData.delivery_date ? 
            new Date(repairData.delivery_date).toLocaleDateString('ar-EG') : 
            'لم يتم تحديده';
        this.ctx.fillText(deliveryDate, width - 10, currentY);
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
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

// إنشاء instance عام
window.smallLabelGenerator = new SmallLabelGenerator();

/**
 * سكريبت تلقائي لإنشاء أيقونات PWA من اللوجو PNG
 * يتم تشغيله تلقائياً عند تحميل الصفحة
 */

(function() {
    'use strict';
    
    const logoPath = 'vertopal.com_photo_5922357566287580087_y.png';
    const iconsDir = 'icons/';
    const requiredSizes = [72, 96, 128, 144, 152, 192, 384, 512];
    
    /**
     * دالة مساعدة لإصلاح المسار (يدعم المجلدات الفرعية)
     */
    function fixIconPath(path) {
        if (!path) return path;
        const basePath = window.BASE_PATH || '';
        // إذا كان المسار يبدأ بـ /، أضف basePath
        if (path.startsWith('/')) {
            return basePath + path;
        }
        // إذا كان المسار نسبي، أضف basePath إذا كان موجوداً
        if (basePath && !path.startsWith('http') && !path.startsWith('//')) {
            return basePath + '/' + path;
        }
        return path;
    }
    
    /**
     * إنشاء أيقونة واحدة من اللوجو
     */
    async function createIcon(size) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // خلفية بيضاء
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
                
                // حساب النسبة للحفاظ على الشكل
                const ratio = Math.min(size / img.width, size / img.height);
                const newWidth = img.width * ratio;
                const newHeight = img.height * ratio;
                
                // حساب الموضع للتوسيط
                const x = (size - newWidth) / 2;
                const y = (size - newHeight) / 2;
                
                // رسم الصورة
                ctx.drawImage(img, x, y, newWidth, newHeight);
                
                // تحويل إلى Blob
                canvas.toBlob((blob) => {
                    if (blob) {
                        // حفظ في IndexedDB أو localStorage
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const dataUrl = e.target.result;
                            
                            // حفظ في localStorage
                            const key = `icon_${size}x${size}`;
                            localStorage.setItem(key, dataUrl);
                            
                            // محاولة حفظ الملف مباشرة (إذا كان ذلك ممكناً)
                            try {
                                const link = document.createElement('a');
                                link.href = dataUrl;
                                link.download = `icon-${size}x${size}.png`;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                // لا نضغط على الرابط تلقائياً
                                document.body.removeChild(link);
                            } catch (e) {
                                console.warn('لا يمكن حفظ الملف تلقائياً:', e);
                            }
                            
                            resolve(dataUrl);
                        };
                        reader.readAsDataURL(blob);
                    } else {
                        reject(new Error('فشل تحويل canvas إلى blob'));
                    }
                }, 'image/png');
            };
            
            img.onerror = function() {
                reject(new Error(`فشل تحميل اللوجو: ${logoPath}`));
            };
            
            img.src = fixIconPath(logoPath);
        });
    }
    
    /**
     * التحقق من وجود الأيقونات وإنشاؤها إذا لم تكن موجودة
     */
    async function ensureIconsExist() {
        // انتظار تحميل BASE_PATH إذا كان موجوداً
        if (typeof window.BASE_PATH === 'undefined') {
            // انتظار قليلاً ثم إعادة المحاولة
            setTimeout(ensureIconsExist, 100);
            return;
        }
        
        const missingIcons = [];
        
        // التحقق من وجود الأيقونات
        for (const size of requiredSizes) {
            const iconPath = fixIconPath(`${iconsDir}icon-${size}x${size}.png`);
            try {
                const response = await fetch(iconPath, { method: 'HEAD' });
                if (!response.ok) {
                    missingIcons.push(size);
                }
            } catch (e) {
                missingIcons.push(size);
            }
        }
        
        // إذا كانت هناك أيقونات مفقودة، أنشئها
        if (missingIcons.length > 0) {
            console.log(`⚠️ الأيقونات المفقودة: ${missingIcons.join(', ')}`);
            console.log('💡 افتح create-icons.html لإنشاء الأيقونات يدوياً');
        } else {
            console.log('✅ جميع الأيقونات موجودة');
        }
    }
    
    // تشغيل عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureIconsExist);
    } else {
        ensureIconsExist();
    }
    
    // تصدير الدالة للاستخدام اليدوي
    window.generateIconsFromLogo = async function() {
        console.log('بدء إنشاء الأيقونات...');
        const results = [];
        
        for (const size of requiredSizes) {
            try {
                const dataUrl = await createIcon(size);
                results.push({ size, dataUrl, success: true });
                console.log(`✅ تم إنشاء أيقونة ${size}x${size}`);
            } catch (error) {
                results.push({ size, error: error.message, success: false });
                console.error(`❌ فشل إنشاء أيقونة ${size}x${size}:`, error);
            }
        }
        
        return results;
    };
})();

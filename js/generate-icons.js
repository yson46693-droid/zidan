/**
 * سكريبت JavaScript لتحويل اللوجو إلى أيقونات PNG بأحجام مختلفة
 * يمكن تشغيله من console المتصفح
 */

async function generateIconsFromLogo() {
    const logoPath = 'vertopal.com_photo_5922357566287580087_y.png';
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    
    console.log('بدء تحويل اللوجو إلى أيقونات...');
    
    // تحميل الصورة
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve, reject) => {
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const icons = [];
            
            sizes.forEach(size => {
                canvas.width = size;
                canvas.height = size;
                
                // تنظيف canvas بخلفية بيضاء
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
                
                // تحويل إلى Base64
                const dataUrl = canvas.toDataURL('image/png');
                icons.push({
                    size: size,
                    dataUrl: dataUrl,
                    filename: `icon-${size}x${size}.png`
                });
                
                console.log(`✅ تم إنشاء: icon-${size}x${size}.png`);
            });
            
            // عرض الأيقونات للتحميل
            console.log('\n📥 الأيقونات جاهزة! يمكنك تحميلها:');
            icons.forEach(icon => {
                console.log(`\n${icon.filename}:`);
                console.log(icon.dataUrl);
                
                // إنشاء رابط تحميل
                const link = document.createElement('a');
                link.download = icon.filename;
                link.href = icon.dataUrl;
                link.textContent = `تحميل ${icon.filename}`;
                link.style.display = 'block';
                link.style.margin = '5px 0';
                document.body.appendChild(link);
            });
            
            resolve(icons);
        };
        
        img.onerror = function() {
            reject(new Error('فشل تحميل اللوجو: ' + logoPath));
        };
        
        img.src = logoPath;
    });
}

// تشغيل تلقائي عند تحميل الصفحة (يمكن إزالته)
// window.addEventListener('load', () => {
//     console.log('لتحويل اللوجو إلى أيقونات، شغّل: generateIconsFromLogo()');
// });

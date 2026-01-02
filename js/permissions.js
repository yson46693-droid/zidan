// إدارة صلاحيات الموقع - طلب الصلاحيات عند أول فتح
// ✅ يطلب المايكروفون والكاميرا والملفات والنماذج المنبثقة عند أول فتح

/**
 * طلب صلاحية المايكروفون
 */
async function requestMicrophonePermission() {
    try {
        // التحقق من دعم Permissions API
        if (!navigator.permissions) {
            // إذا لم يكن متاحاً، محاولة طلب الصلاحية مباشرة
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    // إغلاق stream فوراً بعد الحصول على الصلاحية
                    stream.getTracks().forEach(track => track.stop());
                    console.log('✅ تم الحصول على صلاحية المايكروفون');
                    return true;
                } catch (error) {
                    console.warn('⚠️ فشل طلب صلاحية المايكروفون:', error);
                    return false;
                }
            }
            return false;
        }

        // استخدام Permissions API
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            
            if (permissionStatus.state === 'granted') {
                console.log('✅ صلاحية المايكروفون ممنوحة بالفعل');
                return true;
            }
            
            if (permissionStatus.state === 'denied') {
                console.warn('⚠️ صلاحية المايكروفون مرفوضة');
                return false;
            }
            
            // إذا كانت 'prompt'، طلب الصلاحية
            if (permissionStatus.state === 'prompt') {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    // إغلاق stream فوراً بعد الحصول على الصلاحية
                    stream.getTracks().forEach(track => track.stop());
                    console.log('✅ تم الحصول على صلاحية المايكروفون');
                    return true;
                } catch (error) {
                    console.warn('⚠️ فشل طلب صلاحية المايكروفون:', error);
                    return false;
                }
            }
        } catch (e) {
            // بعض المتصفحات لا تدعم 'microphone' في permissions.query
            // محاولة طلب الصلاحية مباشرة
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(track => track.stop());
                    console.log('✅ تم الحصول على صلاحية المايكروفون');
                    return true;
                } catch (error) {
                    console.warn('⚠️ فشل طلب صلاحية المايكروفون:', error);
                    return false;
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('❌ خطأ في طلب صلاحية المايكروفون:', error);
        return false;
    }
}

/**
 * طلب صلاحية الكاميرا
 */
async function requestCameraPermission() {
    try {
        // التحقق من دعم Permissions API
        if (!navigator.permissions) {
            // إذا لم يكن متاحاً، محاولة طلب الصلاحية مباشرة
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    // إغلاق stream فوراً بعد الحصول على الصلاحية
                    stream.getTracks().forEach(track => track.stop());
                    console.log('✅ تم الحصول على صلاحية الكاميرا');
                    return true;
                } catch (error) {
                    console.warn('⚠️ فشل طلب صلاحية الكاميرا:', error);
                    return false;
                }
            }
            return false;
        }

        // استخدام Permissions API
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'camera' });
            
            if (permissionStatus.state === 'granted') {
                console.log('✅ صلاحية الكاميرا ممنوحة بالفعل');
                return true;
            }
            
            if (permissionStatus.state === 'denied') {
                console.warn('⚠️ صلاحية الكاميرا مرفوضة');
                return false;
            }
            
            // إذا كانت 'prompt'، طلب الصلاحية
            if (permissionStatus.state === 'prompt') {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    // إغلاق stream فوراً بعد الحصول على الصلاحية
                    stream.getTracks().forEach(track => track.stop());
                    console.log('✅ تم الحصول على صلاحية الكاميرا');
                    return true;
                } catch (error) {
                    console.warn('⚠️ فشل طلب صلاحية الكاميرا:', error);
                    return false;
                }
            }
        } catch (e) {
            // بعض المتصفحات لا تدعم 'camera' في permissions.query
            // محاولة طلب الصلاحية مباشرة
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    stream.getTracks().forEach(track => track.stop());
                    console.log('✅ تم الحصول على صلاحية الكاميرا');
                    return true;
                } catch (error) {
                    console.warn('⚠️ فشل طلب صلاحية الكاميرا:', error);
                    return false;
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('❌ خطأ في طلب صلاحية الكاميرا:', error);
        return false;
    }
}

/**
 * طلب صلاحية الملفات (عن طريق فتح input file)
 * ملاحظة: لا يمكن طلب صلاحية الملفات مباشرة، لكن يمكن فتح input file
 * سيتم طلب الصلاحية عند أول استخدام فعلي للملفات
 */
async function requestFilePermission() {
    try {
        // حفظ علامة أننا حاولنا طلب الصلاحية
        // الصلاحية ستُطلب عند أول استخدام فعلي للملفات (في chat.js أو repairs.js)
        localStorage.setItem('filePermissionRequested', 'true');
        console.log('✅ تم حفظ علامة طلب صلاحية الملفات (ستُطلب عند أول استخدام)');
        return true;
    } catch (error) {
        console.error('❌ خطأ في طلب صلاحية الملفات:', error);
        return false;
    }
}

/**
 * التحقق من السماح بالنماذج المنبثقة
 * ملاحظة: لا يمكن طلب صلاحية popups مباشرة، لكن يمكن التحقق من السماح بها
 * سيتم التحقق عند أول استخدام فعلي للنماذج المنبثقة
 */
async function checkPopupPermission() {
    try {
        // حفظ علامة أننا حاولنا التحقق من الصلاحية
        // التحقق الفعلي سيحدث عند أول استخدام للنماذج المنبثقة
        localStorage.setItem('popupPermissionChecked', 'true');
        console.log('✅ تم حفظ علامة التحقق من صلاحية النماذج المنبثقة (سيتم التحقق عند أول استخدام)');
        return true;
    } catch (error) {
        console.error('❌ خطأ في التحقق من صلاحية النماذج المنبثقة:', error);
        return false;
    }
}

/**
 * طلب جميع الصلاحيات عند أول فتح للصفحة
 */
async function requestAllPermissions() {
    try {
        // التحقق من أننا لم نطلب الصلاحيات من قبل
        const permissionsRequested = localStorage.getItem('permissionsRequested');
        if (permissionsRequested === 'true') {
            console.log('⏸️ تم طلب الصلاحيات من قبل - تخطي');
            return;
        }
        
        console.log('🔐 بدء طلب الصلاحيات...');
        
        // طلب الصلاحيات بشكل متوازي (لكن مع تأخير بسيط لتجنب إزعاج المستخدم)
        const results = {
            microphone: false,
            camera: false,
            files: false,
            popups: false
        };
        
        // طلب صلاحية المايكروفون
        try {
            results.microphone = await requestMicrophonePermission();
        } catch (error) {
            console.error('❌ خطأ في طلب صلاحية المايكروفون:', error);
        }
        
        // تأخير بسيط قبل طلب الصلاحية التالية
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // طلب صلاحية الكاميرا
        try {
            results.camera = await requestCameraPermission();
        } catch (error) {
            console.error('❌ خطأ في طلب صلاحية الكاميرا:', error);
        }
        
        // تأخير بسيط قبل طلب الصلاحية التالية
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // طلب صلاحية الملفات
        try {
            results.files = await requestFilePermission();
        } catch (error) {
            console.error('❌ خطأ في طلب صلاحية الملفات:', error);
        }
        
        // تأخير بسيط قبل التحقق من النماذج المنبثقة
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // التحقق من صلاحية النماذج المنبثقة
        try {
            results.popups = await checkPopupPermission();
        } catch (error) {
            console.error('❌ خطأ في التحقق من صلاحية النماذج المنبثقة:', error);
        }
        
        // حفظ النتائج
        localStorage.setItem('permissionsRequested', 'true');
        localStorage.setItem('permissionsResults', JSON.stringify(results));
        
        console.log('✅ تم طلب جميع الصلاحيات:', results);
        
        return results;
    } catch (error) {
        console.error('❌ خطأ في طلب الصلاحيات:', error);
        return null;
    }
}

/**
 * طلب الصلاحيات عند تحميل الصفحة (بعد تفاعل المستخدم)
 */
function initPermissions() {
    // التحقق من أننا لم نطلب الصلاحيات من قبل
    const permissionsRequested = localStorage.getItem('permissionsRequested');
    if (permissionsRequested === 'true') {
        console.log('⏸️ تم طلب الصلاحيات من قبل - تخطي');
        return;
    }
    
    // انتظار تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // طلب الصلاحيات بعد تفاعل المستخدم الأول (click, touch, keydown)
            const requestPermissionsOnInteraction = async () => {
                // التحقق مرة أخرى قبل الطلب
                const alreadyRequested = localStorage.getItem('permissionsRequested');
                if (alreadyRequested === 'true') {
                    return;
                }
                
                // إزالة event listeners بعد أول تفاعل
                document.removeEventListener('click', requestPermissionsOnInteraction);
                document.removeEventListener('touchstart', requestPermissionsOnInteraction);
                document.removeEventListener('keydown', requestPermissionsOnInteraction);
                
                // طلب الصلاحيات
                await requestAllPermissions();
            };
            
            // إضافة event listeners للتفاعل الأول
            document.addEventListener('click', requestPermissionsOnInteraction, { once: true, passive: true });
            document.addEventListener('touchstart', requestPermissionsOnInteraction, { once: true, passive: true });
            document.addEventListener('keydown', requestPermissionsOnInteraction, { once: true, passive: true });
            
            // طلب الصلاحيات تلقائياً بعد 2 ثوان (إذا لم يكن هناك تفاعل)
            setTimeout(async () => {
                const alreadyRequested = localStorage.getItem('permissionsRequested');
                if (alreadyRequested !== 'true') {
                    console.log('⏰ طلب الصلاحيات تلقائياً بعد 2 ثوان');
                    await requestAllPermissions();
                }
            }, 2000);
        });
    } else {
        // إذا كانت الصفحة محملة بالفعل
        const requestPermissionsOnInteraction = async () => {
            const alreadyRequested = localStorage.getItem('permissionsRequested');
            if (alreadyRequested === 'true') {
                return;
            }
            
            document.removeEventListener('click', requestPermissionsOnInteraction);
            document.removeEventListener('touchstart', requestPermissionsOnInteraction);
            document.removeEventListener('keydown', requestPermissionsOnInteraction);
            
            await requestAllPermissions();
        };
        
        document.addEventListener('click', requestPermissionsOnInteraction, { once: true, passive: true });
        document.addEventListener('touchstart', requestPermissionsOnInteraction, { once: true, passive: true });
        document.addEventListener('keydown', requestPermissionsOnInteraction, { once: true, passive: true });
        
        setTimeout(async () => {
            const alreadyRequested = localStorage.getItem('permissionsRequested');
            if (alreadyRequested !== 'true') {
                console.log('⏰ طلب الصلاحيات تلقائياً بعد 2 ثوان');
                await requestAllPermissions();
            }
        }, 2000);
    }
}

// تصدير الدوال للاستخدام العام
if (typeof window !== 'undefined') {
    window.requestMicrophonePermission = requestMicrophonePermission;
    window.requestCameraPermission = requestCameraPermission;
    window.requestFilePermission = requestFilePermission;
    window.checkPopupPermission = checkPopupPermission;
    window.requestAllPermissions = requestAllPermissions;
}

// تهيئة طلب الصلاحيات عند تحميل الملف
initPermissions();

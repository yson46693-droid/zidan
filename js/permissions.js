// إدارة صلاحيات الموقع - طلب الصلاحيات عند الحاجة الفعلية فقط
// ✅ يطلب الصلاحيات فقط عند الاستخدام الفعلي (مايك/كاميرا) وليس عند فتح الموقع

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
 * تهيئة نظام الصلاحيات (بدون طلب الصلاحيات تلقائياً)
 * الصلاحيات سيتم طلبها فقط عند الحاجة الفعلية (عند استخدام المايك/الكاميرا)
 */
function initPermissions() {
    // التحقق من الصلاحيات المخزنة وتحديثها إذا لزم الأمر
    // بدون طلب أي صلاحيات - فقط التحقق من الحالة
    try {
        // التحقق من صلاحية المايكروفون (بدون طلب)
        checkMicrophonePermission().catch(() => {});
        
        // التحقق من صلاحية الكاميرا (بدون طلب)
        checkCameraPermission().catch(() => {});
    } catch (error) {
        // خطأ صامت - لا نريد إزعاج المستخدم
        console.log('⚠️ لا يمكن التحقق من الصلاحيات:', error);
    }
}

/**
 * التحقق من حالة صلاحية المايكروفون (بدون طلب الصلاحية)
 * @returns {Promise<'granted'|'denied'|'prompt'|null>} حالة الصلاحية
 */
async function checkMicrophonePermission() {
    try {
        // التحقق من localStorage أولاً (إذا كانت الصلاحية مخزنة)
        const storedPermission = localStorage.getItem('microphonePermission');
        if (storedPermission === 'granted') {
            // التحقق من الصلاحية الفعلية للتأكد من أنها لم تتغير
            if (navigator.permissions) {
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                    // إذا تغيرت الصلاحية، تحديث localStorage
                    if (permissionStatus.state !== storedPermission) {
                        localStorage.setItem('microphonePermission', permissionStatus.state);
                        return permissionStatus.state;
                    }
                    return 'granted';
                } catch (e) {
                    // إذا فشل التحقق من Permissions API، نثق في القيمة المخزنة
                    return 'granted';
                }
            }
            // إذا لم يكن Permissions API متاحاً، نثق في القيمة المخزنة
            return 'granted';
        }
        
        if (storedPermission === 'denied') {
            return 'denied';
        }
        
        // إذا لم تكن هناك قيمة مخزنة، التحقق من Permissions API
        if (!navigator.permissions) {
            return null; // لا يمكن التحقق
        }
        
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            // تخزين حالة الصلاحية
            localStorage.setItem('microphonePermission', permissionStatus.state);
            return permissionStatus.state;
        } catch (e) {
            // بعض المتصفحات لا تدعم 'microphone' في permissions.query
            return null;
        }
    } catch (error) {
        console.error('❌ خطأ في التحقق من صلاحية المايكروفون:', error);
        return null;
    }
}

/**
 * التحقق من حالة صلاحية الكاميرا (بدون طلب الصلاحية)
 * @returns {Promise<'granted'|'denied'|'prompt'|null>} حالة الصلاحية
 */
async function checkCameraPermission() {
    try {
        // التحقق من localStorage أولاً (إذا كانت الصلاحية مخزنة)
        const storedPermission = localStorage.getItem('cameraPermission');
        if (storedPermission === 'granted') {
            // التحقق من الصلاحية الفعلية للتأكد من أنها لم تتغير
            if (navigator.permissions) {
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'camera' });
                    // إذا تغيرت الصلاحية، تحديث localStorage
                    if (permissionStatus.state !== storedPermission) {
                        localStorage.setItem('cameraPermission', permissionStatus.state);
                        return permissionStatus.state;
                    }
                    return 'granted';
                } catch (e) {
                    // إذا فشل التحقق من Permissions API، نثق في القيمة المخزنة
                    return 'granted';
                }
            }
            // إذا لم يكن Permissions API متاحاً، نثق في القيمة المخزنة
            return 'granted';
        }
        
        if (storedPermission === 'denied') {
            return 'denied';
        }
        
        // إذا لم تكن هناك قيمة مخزنة، التحقق من Permissions API
        if (!navigator.permissions) {
            return null; // لا يمكن التحقق
        }
        
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'camera' });
            // تخزين حالة الصلاحية
            localStorage.setItem('cameraPermission', permissionStatus.state);
            return permissionStatus.state;
        } catch (e) {
            // بعض المتصفحات لا تدعم 'camera' في permissions.query
            return null;
        }
    } catch (error) {
        console.error('❌ خطأ في التحقق من صلاحية الكاميرا:', error);
        return null;
    }
}

/**
 * الحصول على stream من المايكروفون (مع التحقق من الصلاحية أولاً)
 * @param {Object} constraints - قيود getUserMedia
 * @returns {Promise<MediaStream|null>} stream أو null إذا فشل
 */
async function getMicrophoneStream(constraints = { audio: true }) {
    try {
        // التحقق من دعم getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('❌ getUserMedia غير مدعوم');
            return null;
        }
        
        // التحقق من حالة الصلاحية أولاً (بدون طلب الصلاحية)
        const permissionState = await checkMicrophonePermission();
        
        if (permissionState === 'granted') {
            // الصلاحية ممنوحة بالفعل - لن يظهر prompt
            console.log('✅ صلاحية المايكروفون ممنوحة - استخدام مباشر');
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                // تأكيد الحصول على الصلاحية وتخزينها
                localStorage.setItem('microphonePermission', 'granted');
                return stream;
            } catch (error) {
                // إذا فشل، قد تكون الصلاحية تم رفضها
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    localStorage.setItem('microphonePermission', 'denied');
                }
                throw error;
            }
        }
        
        if (permissionState === 'denied') {
            // الصلاحية مرفوضة
            console.warn('⚠️ صلاحية المايكروفون مرفوضة');
            return null;
        }
        
        // إذا كانت 'prompt' أو null، طلب الصلاحية (سيظهر prompt مرة واحدة فقط)
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            // بعد الحصول على الصلاحية بنجاح، تخزينها
            localStorage.setItem('microphonePermission', 'granted');
            return stream;
        } catch (error) {
            // إذا فشل، تخزين حالة الرفض
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                localStorage.setItem('microphonePermission', 'denied');
            }
            throw error;
        }
    } catch (error) {
        console.error('❌ خطأ في الحصول على stream المايكروفون:', error);
        return null;
    }
}

/**
 * الحصول على stream من الكاميرا (مع التحقق من الصلاحية أولاً)
 * @param {Object} constraints - قيود getUserMedia
 * @returns {Promise<MediaStream|null>} stream أو null إذا فشل
 */
async function getCameraStream(constraints = { video: true }) {
    try {
        // التحقق من دعم getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('❌ getUserMedia غير مدعوم');
            return null;
        }
        
        // التحقق من حالة الصلاحية أولاً (بدون طلب الصلاحية)
        const permissionState = await checkCameraPermission();
        
        if (permissionState === 'granted') {
            // الصلاحية ممنوحة بالفعل - لن يظهر prompt
            console.log('✅ صلاحية الكاميرا ممنوحة - استخدام مباشر');
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                // تأكيد الحصول على الصلاحية وتخزينها
                localStorage.setItem('cameraPermission', 'granted');
                return stream;
            } catch (error) {
                // إذا فشل، قد تكون الصلاحية تم رفضها
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    localStorage.setItem('cameraPermission', 'denied');
                }
                throw error;
            }
        }
        
        if (permissionState === 'denied') {
            // الصلاحية مرفوضة
            console.warn('⚠️ صلاحية الكاميرا مرفوضة');
            return null;
        }
        
        // إذا كانت 'prompt' أو null، طلب الصلاحية (سيظهر prompt مرة واحدة فقط)
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            // بعد الحصول على الصلاحية بنجاح، تخزينها
            localStorage.setItem('cameraPermission', 'granted');
            return stream;
        } catch (error) {
            // إذا فشل، تخزين حالة الرفض
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                localStorage.setItem('cameraPermission', 'denied');
            }
            throw error;
        }
    } catch (error) {
        console.error('❌ خطأ في الحصول على stream الكاميرا:', error);
        return null;
    }
}

/**
 * التحقق من صلاحية الإشعارات وطلبها إذا لزم الأمر
 * @returns {Promise<'granted'|'denied'|'default'>} حالة الصلاحية
 */
async function checkNotificationPermission() {
    try {
        if (!('Notification' in window)) {
            console.warn('⚠️ الإشعارات غير مدعومة في هذا المتصفح');
            return 'denied';
        }
        
        const permission = Notification.permission;
        
        if (permission === 'granted') {
            console.log('✅ صلاحية الإشعارات ممنوحة بالفعل');
            return 'granted';
        }
        
        if (permission === 'denied') {
            console.warn('⚠️ صلاحية الإشعارات مرفوضة');
            return 'denied';
        }
        
        // إذا كانت 'default'، طلب الصلاحية
        const result = await Notification.requestPermission();
        return result;
    } catch (error) {
        console.error('❌ خطأ في التحقق من صلاحية الإشعارات:', error);
        return 'denied';
    }
}

// تصدير الدوال للاستخدام العام
if (typeof window !== 'undefined') {
    window.requestMicrophonePermission = requestMicrophonePermission;
    window.requestCameraPermission = requestCameraPermission;
    window.requestFilePermission = requestFilePermission;
    window.checkPopupPermission = checkPopupPermission;
    window.requestAllPermissions = requestAllPermissions;
    
    // ✅ دوال مساعدة للتحقق من الصلاحيات قبل طلبها
    window.checkMicrophonePermission = checkMicrophonePermission;
    window.checkCameraPermission = checkCameraPermission;
    window.getMicrophoneStream = getMicrophoneStream;
    window.getCameraStream = getCameraStream;
    window.checkNotificationPermission = checkNotificationPermission;
}

// تهيئة نظام الصلاحيات (بدون طلب الصلاحيات تلقائياً)
// الصلاحيات سيتم طلبها فقط عند الحاجة الفعلية
initPermissions();

// صفحة تتبع الصيانة
// ✅ حماية من التحميل المكرر
if (typeof window.repairTrackingLoaded !== 'undefined') {
    console.warn('⚠️ repair-tracking.js تم تحميله مسبقاً - تخطي إعادة التحميل');
} else {
    window.repairTrackingLoaded = true;

// ✅ متغيرات القالب - سيتم ملؤها من API فقط
let repairTrackingData = {
    repairNumber: null,
    status: null,
    statusDescription: null,
    estimatedDeliveryDate: null,
    stages: []
};

// ✅ دالة لاستقبال البيانات من صفحة عمليات الصيانة
window.setRepairTrackingData = function(data) {
    try {
        if (!data || typeof data !== 'object') {
            console.error('❌ بيانات غير صحيحة:', data);
            return;
        }
        
        // ✅ تحديث البيانات بشكل كامل (استبدال وليس دمج)
        repairTrackingData = {
            repairNumber: data.repairNumber || data.repair_number || null,
            status: data.status || null,
            statusDescription: data.statusDescription || null,
            estimatedDeliveryDate: data.estimatedDeliveryDate || null,
            stages: (data.stages && Array.isArray(data.stages)) ? data.stages : [],
            createdAt: data.createdAt || null,
            repairId: data.repairId || null,
            repairDetails: data.repairDetails || null,
            technician: data.technician || null
        };
        
        // ✅ حفظ repair_id إذا كان موجوداً
        if (data.repairId) {
            currentRepairId = data.repairId;
            const repairIdInput = document.getElementById('repairId');
            if (repairIdInput) {
                repairIdInput.value = data.repairId;
            }
        }
        
        if (data.repair_number || data.repairNumber) {
            const repairNumberInput = document.getElementById('repairNumberInput');
            if (repairNumberInput) {
                repairNumberInput.value = data.repair_number || data.repairNumber;
            }
        }
        
        // ✅ تحديث العرض فقط إذا كانت البيانات موجودة
        if (repairTrackingData.repairNumber) {
            renderTrackingPage();
            console.log('✅ تم تحديث بيانات تتبع الصيانة:', repairTrackingData);
        } else {
            console.warn('⚠️ لا توجد بيانات صحيحة للعرض');
        }
    } catch (error) {
        console.error('❌ خطأ في تحديث بيانات تتبع الصيانة:', error);
    }
};

// ✅ دالة لتحويل التاريخ من YYYY-MM-DD إلى تنسيق عربي
function formatArabicDate(dateString) {
    try {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const months = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day} ${month} ${year}`;
    } catch (error) {
        console.error('خطأ في تحويل التاريخ:', error);
        return dateString;
    }
}

// ✅ دالة لتحديد حالة المرحلة
function getStageState(stage, currentStatus) {
    // استخدام البيانات الموجودة في stage مباشرة
    if (stage.completed) {
        return 'completed';
    } else if (stage.active) {
        return 'active';
    } else {
        return 'pending';
    }
}

// ✅ دالة لعرض شريط التقدم
function renderProgressTimeline() {
    try {
        const timeline = document.getElementById('progressTimeline');
        if (!timeline) {
            console.error('❌ العنصر progressTimeline غير موجود');
            return;
        }
        
        const currentStatus = repairTrackingData.status;
        const stages = repairTrackingData.stages || [];
        
        // ✅ حساب عرض الخط المكتمل
        let completedStagesCount = 0;
        let activeStageIndex = -1;
        
        stages.forEach((stage, index) => {
            if (stage.completed === true) {
                completedStagesCount++;
            }
            if (stage.active === true) {
                activeStageIndex = index;
            }
        });
        
        // ✅ حساب النسبة المئوية للخط المكتمل
        // إذا كانت هناك مرحلة نشطة، نضيف 50% من المسافة للمرحلة التالية
        let progressPercentage = 0;
        if (stages.length > 1) {
            if (activeStageIndex >= 0) {
                // المرحلة النشطة تعتبر مكتملة + نصف المسافة للمرحلة التالية
                progressPercentage = ((activeStageIndex + 0.5) / (stages.length - 1)) * 100;
            } else if (completedStagesCount > 0) {
                // إذا لم تكن هناك مرحلة نشطة، استخدم عدد المراحل المكتملة
                progressPercentage = (completedStagesCount / (stages.length - 1)) * 100;
            }
        }
        
        // ✅ تحديث عرض الخط المكتمل
        timeline.style.setProperty('--progress-width', `${Math.min(progressPercentage, 100)}%`);
        
        // بناء HTML للمراحل
        let timelineHTML = '';
        
        stages.forEach((stage, index) => {
            // ✅ استخدام البيانات مباشرة من stage (completed و active)
            const isCompleted = stage.completed === true;
            const isActive = stage.active === true;
            
            timelineHTML += `
                <div class="progress-stage">
                    <div class="stage-dot ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}"></div>
                    <div class="stage-info ${isActive ? 'active' : ''}">
                        <div class="stage-date">${stage.date ? formatArabicDate(stage.date) : ''}</div>
                        <div class="stage-name">${escapeHtml(stage.name)}</div>
                        <div class="stage-description">${escapeHtml(stage.description)}</div>
                    </div>
                </div>
            `;
        });
        
        timeline.innerHTML = timelineHTML;
    } catch (error) {
        console.error('❌ خطأ في عرض شريط التقدم:', error);
    }
}

// ✅ دالة لعرض تفاصيل العملية
function renderRepairDetails() {
    try {
        const detailsContent = document.getElementById('repairDetailsContent');
        if (!detailsContent || !repairTrackingData.repairDetails) return;
        
        const details = repairTrackingData.repairDetails;
        const currentStatus = repairTrackingData.status;
        
        const detailsHTML = `
            <div class="repair-detail-item">
                <span class="repair-detail-label">اسم العميل:</span>
                <span class="repair-detail-value">${escapeHtml(details.customer_name || 'غير محدد')}</span>
            </div>
            <div class="repair-detail-item">
                <span class="repair-detail-label">رقم الهاتف:</span>
                <span class="repair-detail-value">${escapeHtml(details.customer_phone || 'غير محدد')}</span>
            </div>
            <div class="repair-detail-item">
                <span class="repair-detail-label">نوع الجهاز:</span>
                <span class="repair-detail-value">${escapeHtml(details.device_type || 'غير محدد')}</span>
            </div>
            <div class="repair-detail-item">
                <span class="repair-detail-label">موديل الجهاز:</span>
                <span class="repair-detail-value">${escapeHtml(details.device_model || 'غير محدد')}</span>
            </div>
            <div class="repair-detail-item">
                <span class="repair-detail-label">الرقم التسلسلي:</span>
                <span class="repair-detail-value">${escapeHtml(details.serial_number || 'غير محدد')}</span>
            </div>
            <div class="repair-detail-item">
                <span class="repair-detail-label">العطل:</span>
                <span class="repair-detail-value">${escapeHtml(details.problem || 'غير محدد')}</span>
            </div>
            <div class="repair-detail-item">
                <span class="repair-detail-label">التكلفة:</span>
                <span class="repair-detail-value">${details.customer_price ? (parseFloat(details.customer_price) || 0).toFixed(2) + ' جنيه' : 'غير محدد'}</span>
            </div>
            <div class="repair-detail-item">
                <span class="repair-detail-label">الفرع:</span>
                <span class="repair-detail-value">${escapeHtml(details.branch_name || 'غير محدد')}</span>
            </div>
            ${details.created_at ? `
            <div class="repair-detail-item">
                <span class="repair-detail-label">تاريخ الإنشاء:</span>
                <span class="repair-detail-value">${formatArabicDate(details.created_at)}</span>
            </div>
            ` : ''}
            ${(currentStatus === 'awaiting_customer_approval' && details.inspection_report) ? `
            <div class="repair-detail-item" style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--border-color);">
                <span class="repair-detail-label" style="font-weight: 700; color: var(--primary-color); font-size: 1.1em; margin-bottom: 10px; display: block;">
                    <i class="bi bi-file-text"></i> تقرير الفحص
                </span>
                <div style="background: var(--light-bg); padding: 15px; border-radius: 8px; margin-top: 10px; white-space: pre-wrap; line-height: 1.6;">
                    ${escapeHtml(details.inspection_report)}
                </div>
            </div>
            ` : ''}
        `;
        
        detailsContent.innerHTML = detailsHTML;
    } catch (error) {
        console.error('❌ خطأ في عرض تفاصيل العملية:', error);
    }
}

// ✅ دالة لعرض بطاقة الفني
async function renderTechnicianCard() {
    try {
        const technicianSection = document.getElementById('technicianCardSection');
        if (!technicianSection) return;
        
        if (!repairTrackingData.technician || !repairTrackingData.technician.id) {
            console.warn('⚠️ [renderTechnicianCard] لا توجد بيانات فني - technician:', repairTrackingData.technician);
            technicianSection.style.display = 'none';
            return;
        }
        
        console.log('✅ [renderTechnicianCard] بيانات الفني موجودة:', repairTrackingData.technician);
        
        const technician = repairTrackingData.technician;
        const firstLetter = (technician.name || technician.username || 'ف').charAt(0);
        const avatarUrl = technician.avatar || null;
        
        // ✅ التحقق من role الفني - إذا كان "admin" (مالك) يعرض 5 نجوم دائماً
        const technicianName = (technician.name || technician.username || '').trim();
        // ✅ التحقق من role الفني - إذا كان "admin" (مالك)
        // إذا لم يكن role موجوداً، محاولة جلب البيانات من API
        let isMalik = technician.role === 'admin';
        
        // ✅ إذا لم يكن role موجوداً، محاولة جلب البيانات من technicians API
        if (!technician.role && technician.id) {
            try {
                if (typeof window.API !== 'undefined') {
                    const branchName = (repairTrackingData.repairDetails?.branch_name || '').trim();
                    const branchId = repairTrackingData.repairDetails?.branch_id || null;
                    const currentDate = new Date();
                    const currentMonth = currentDate.getMonth() + 1;
                    const currentYear = currentDate.getFullYear();
                    
                    const techniciansResult = await window.API.request(`technicians.php?branch_id=${encodeURIComponent(branchId || '')}&month=${currentMonth}&year=${currentYear}`, 'GET');
                    
                    if (techniciansResult && techniciansResult.success && Array.isArray(techniciansResult.data)) {
                        const technicianData = techniciansResult.data.find(t => t.id === technician.id);
                        if (technicianData) {
                            technician.role = technicianData.role || 'technician';
                            technician.username = technicianData.username || '';
                            technician.avatar = technicianData.avatar || technician.avatar || null;
                            isMalik = technician.role === 'admin';
                            
                            // ✅ تحديث الصورة إذا تم جلبها من API
                            if (technicianData.avatar && technicianAvatarEl) {
                                const avatarUrl = technicianData.avatar;
                                technicianAvatarEl.innerHTML = '';
                                const avatarImg = document.createElement('img');
                                avatarImg.src = avatarUrl;
                                avatarImg.alt = technician.name || technician.username || 'الفني المستلم';
                                avatarImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
                                avatarImg.onerror = function() {
                                    this.style.display = 'none';
                                    technicianAvatarEl.textContent = firstLetter;
                                    technicianAvatarEl.style.display = 'flex';
                                };
                                technicianAvatarEl.appendChild(avatarImg);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️ خطأ في جلب role الفني:', error);
            }
        }
        
        // ✅ التحقق من الفرع - يجب أن يكون الفرع الأول
        const branchName = (repairTrackingData.repairDetails?.branch_name || '').trim();
        const isFirstBranch = branchName === 'الهانوفيل' || 
                             branchName.toLowerCase().includes('هانوفيل') ||
                             branchName.toLowerCase().includes('hanovil') ||
                             branchName === 'الفرع الأول' ||
                             branchName.toLowerCase().includes('الفرع الاول');
        
        // ✅ إضافة console.log للتصحيح
        console.log('🔍 [Technician Rating] اسم الفني:', technicianName, '- role:', technician.role, '- isAdmin:', isMalik);
        console.log('🔍 [Technician Rating] اسم الفرع:', branchName, '- isFirstBranch:', isFirstBranch);
        
        // ✅ التحقق من أن الفني "admin" (مالك) والفرع هو الفرع الأول
        const shouldShowPremiumCard = isMalik && isFirstBranch;
        
        // عرض البطاقة بدون تقييم أولاً (لتحسين الأداء)
        const technicianNameEl = document.getElementById('technicianName');
        const technicianAvatarEl = document.getElementById('technicianAvatar');
        
        if (technicianNameEl) {
            // ✅ إذا كان الفني "مالك" والفرع هو الفرع الأول، إضافة label "فني الصيانة"
            if (shouldShowPremiumCard) {
                technicianNameEl.innerHTML = `
                    <span>${technician.name || technician.username || 'الفني المستلم'}</span>
                    <span class="technician-badge-premium" style="
                        display: inline-block;
                        margin-right: 10px;
                        padding: 4px 12px;
                        background: rgba(255, 255, 255, 0.9);
                        color: #8B4513;
                        border-radius: 20px;
                        font-size: 0.75em;
                        font-weight: 700;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                        border: 1px solid rgba(255, 215, 0, 0.5);
                    ">⭐ فني الصيانة</span>
                `;
            } else {
                technicianNameEl.textContent = technician.name || technician.username || 'الفني المستلم';
            }
        }
        
        if (technicianAvatarEl) {
            // ✅ عرض صورة الملف الشخصي إذا كانت موجودة، وإلا عرض الحرف الأول
            if (avatarUrl) {
                technicianAvatarEl.innerHTML = '';
                const avatarImg = document.createElement('img');
                avatarImg.src = avatarUrl;
                avatarImg.alt = technician.name || technician.username || 'الفني المستلم';
                avatarImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
                avatarImg.onerror = function() {
                    // إذا فشل تحميل الصورة، عرض الحرف الأول
                    this.style.display = 'none';
                    technicianAvatarEl.textContent = firstLetter;
                    technicianAvatarEl.style.display = 'flex';
                };
                technicianAvatarEl.appendChild(avatarImg);
            } else {
                technicianAvatarEl.textContent = firstLetter;
            }
        }
        
        technicianSection.style.display = 'block';
        
        // ✅ إضافة class "premium-gold" للبطاقة إذا كان الفني "admin" (مالك) والفرع هو الفرع الأول
        const technicianCard = technicianSection.querySelector('.technician-card-tracking');
        if (technicianCard) {
            if (shouldShowPremiumCard) {
                technicianCard.classList.add('premium-gold');
                    console.log('✨ [Technician Card] تم إضافة تصميم ذهبي مميز للفني "admin" (مالك) في الفرع الأول');
            } else {
                technicianCard.classList.remove('premium-gold');
            }
        }
        
        // ✅ إذا كان الفني "مالك"، عرض بياناته الكاملة
        if (isMalik) {
            console.log('✅ [renderTechnicianCard] الفني "مالك" - بدء عرض البيانات الكاملة');
            
            const technicianRatingDisplayEl = document.getElementById('technicianRatingDisplay');
            if (technicianRatingDisplayEl) {
                let starsHTML = '';
                for (let i = 1; i <= 5; i++) {
                    starsHTML += `<span class="star"><i class="bi bi-star-fill"></i></span>`;
                }
                technicianRatingDisplayEl.innerHTML = starsHTML;
                technicianRatingDisplayEl.style.cursor = 'pointer';
                technicianRatingDisplayEl.title = 'انقر لعرض تفاصيل التقييم';
                
                // ✅ إزالة event listeners السابقة
                const newEl = technicianRatingDisplayEl.cloneNode(true);
                technicianRatingDisplayEl.parentNode.replaceChild(newEl, technicianRatingDisplayEl);
                
                // ✅ إضافة event listener جديد - فتح modal التقييمات
                newEl.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.showTechnicianRatingsModal === 'function') {
                        window.showTechnicianRatingsModal(technician.id, technician.name || technician.username || 'الفني المستلم');
                    } else {
                        const message = shouldShowPremiumCard 
                            ? 'التقييم التراكمي للفني: 5 من 5 نجوم ⭐ (فني الصيانة - الفرع الأول)'
                            : 'التقييم التراكمي للفني: 5 من 5 نجوم ⭐';
                        showTrackingMessage(message, 'info');
                    }
                });
            }
            
            // ✅ إخفاء قسم البيانات الإضافية - عرض فقط اسم الفني والنجوم
            const additionalDataEl = document.getElementById('technicianAdditionalData');
            if (additionalDataEl) {
                additionalDataEl.style.display = 'none';
                console.log('✅ [renderTechnicianCard] تم إخفاء قسم البيانات الإضافية - عرض فقط اسم الفني والنجوم');
            }
            
            console.log('✅ [Technician Rating] تم عرض 5 نجوم للفني "مالك" مباشرة');
            return; // ✅ إيقاف التنفيذ هنا للفني "مالك"
        }
        
        // جلب التقييم التراكمي للفني (خلفية) - للفنيين الآخرين فقط
        loadTechnicianRating(technician.id).then(avgRating => {
            const technicianRatingDisplayEl = document.getElementById('technicianRatingDisplay');
            if (technicianRatingDisplayEl) {
                let starsHTML = '';
                // ✅ إذا كان الفني "مالك"، يعرض 5 نجوم دائماً بغض النظر عن التقييمات
                const rating = isMalik ? 5 : Math.round(avgRating || 0);
                console.log('⭐ [Technician Rating] التقييم المعروض:', rating, '- isMalik:', isMalik);
                for (let i = 1; i <= 5; i++) {
                    const isFilled = i <= rating;
                    starsHTML += `<span class="star ${isFilled ? '' : 'empty'}"><i class="bi bi-star${isFilled ? '-fill' : ''}"></i></span>`;
                }
                technicianRatingDisplayEl.innerHTML = starsHTML;
                
                // ✅ إضافة event listener لعرض رسالة توضيحية عند النقر
                technicianRatingDisplayEl.style.cursor = 'pointer';
                technicianRatingDisplayEl.title = 'انقر لعرض تفاصيل التقييم';
                
                // ✅ إزالة event listeners السابقة لتجنب التكرار
                const newEl = technicianRatingDisplayEl.cloneNode(true);
                technicianRatingDisplayEl.parentNode.replaceChild(newEl, technicianRatingDisplayEl);
                
                // ✅ إضافة event listener جديد
                newEl.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // ✅ إذا كان الفني "مالك"، يعرض رسالة خاصة
                    if (isMalik) {
                        const message = shouldShowPremiumCard 
                            ? 'التقييم التراكمي للفني: 5 من 5 نجوم ⭐ (فني الصيانة - الفرع الأول)'
                            : 'التقييم التراكمي للفني: 5 من 5 نجوم ⭐';
                        showTrackingMessage(message, 'info');
                    } else {
                        const ratingValue = avgRating || 0;
                        if (ratingValue > 0) {
                            showTrackingMessage(`التقييم التراكمي للفني: ${ratingValue.toFixed(1)} من 5 نجوم`, 'info');
                        } else {
                            showTrackingMessage('لا يوجد تقييمات للفني حتى الآن', 'info');
                        }
                    }
                });
            }
        }).catch(error => {
            console.warn('⚠️ لا يمكن جلب تقييم الفني:', error);
            const technicianRatingDisplayEl = document.getElementById('technicianRatingDisplay');
            if (technicianRatingDisplayEl) {
                // ✅ إذا كان الفني "مالك"، يعرض 5 نجوم حتى لو فشل جلب التقييم
                if (isMalik) {
                    let starsHTML = '';
                    for (let i = 1; i <= 5; i++) {
                        starsHTML += `<span class="star"><i class="bi bi-star-fill"></i></span>`;
                    }
                    technicianRatingDisplayEl.innerHTML = starsHTML;
                    technicianRatingDisplayEl.style.cursor = 'pointer';
                    technicianRatingDisplayEl.title = 'انقر لعرض تفاصيل التقييم';
                    
                    // ✅ إزالة event listeners السابقة
                    const newEl = technicianRatingDisplayEl.cloneNode(true);
                    technicianRatingDisplayEl.parentNode.replaceChild(newEl, technicianRatingDisplayEl);
                    
                    // ✅ إضافة event listener جديد
                    newEl.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const message = shouldShowPremiumCard 
                            ? 'التقييم التراكمي للفني: 5 من 5 نجوم ⭐ (فني الصيانة - الفرع الأول)'
                            : 'التقييم التراكمي للفني: 5 من 5 نجوم ⭐';
                        showTrackingMessage(message, 'info');
                    });
                } else {
                    // ✅ إظهار رسالة خطأ عند فشل جلب التقييم (للفنيين الآخرين)
                    technicianRatingDisplayEl.innerHTML = '<span style="color: var(--text-light); font-size: 0.9em;">لا يمكن جلب التقييم</span>';
                    technicianRatingDisplayEl.style.cursor = 'pointer';
                    technicianRatingDisplayEl.title = 'انقر لعرض تفاصيل الخطأ';
                    
                    // ✅ إزالة event listeners السابقة
                    const newEl = technicianRatingDisplayEl.cloneNode(true);
                    technicianRatingDisplayEl.parentNode.replaceChild(newEl, technicianRatingDisplayEl);
                    
                    // ✅ إضافة event listener جديد
                    newEl.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        showTrackingMessage('حدث خطأ أثناء جلب تقييم الفني', 'error');
                    });
                }
            }
        });
    } catch (error) {
        console.error('❌ خطأ في عرض بطاقة الفني:', error);
    }
}

// ✅ دالة لجلب التقييم التراكمي للفني
async function loadTechnicianRating(technicianId) {
    try {
        if (typeof window.API === 'undefined') return 0;
        
        // جلب التقييم التراكمي فقط (بدون detailed) - لا يتطلب auth
        const result = await window.API.request(`repair-ratings.php?technician_id=${encodeURIComponent(technicianId)}`, 'GET');
        if (result && result.success && result.data) {
            // إذا كان data object يحتوي على avg_rating (من API الجديد)
            if (result.data.avg_rating !== undefined) {
                return parseFloat(result.data.avg_rating || 0);
            }
            // إذا كان data array (للتوافق مع الكود القديم)
            if (Array.isArray(result.data) && result.data.length > 0) {
                const ratings = result.data.map(r => parseFloat(r.technician_rating || 0)).filter(r => r > 0);
                if (ratings.length > 0) {
                    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
                    return avg;
                }
            }
        }
        return 0;
    } catch (error) {
        console.warn('⚠️ خطأ في جلب تقييم الفني:', error);
        return 0;
    }
}

// ✅ دالة لجلب البيانات الكاملة للفني "مالك" (admin)
async function loadTechnicianFullData(technicianId, isMalik, shouldShowPremiumCard) {
    try {
        console.log('🔍 [loadTechnicianFullData] بدء جلب البيانات - technicianId:', technicianId, 'isMalik:', isMalik, 'shouldShowPremiumCard:', shouldShowPremiumCard);
        
        if (typeof window.API === 'undefined') {
            console.warn('⚠️ [loadTechnicianFullData] API غير متاح');
            return;
        }
        
        // إظهار قسم البيانات الإضافية
        const additionalDataEl = document.getElementById('technicianAdditionalData');
        if (additionalDataEl) {
            additionalDataEl.style.display = 'block';
            console.log('✅ [loadTechnicianFullData] تم إظهار قسم البيانات الإضافية');
        } else {
            console.error('❌ [loadTechnicianFullData] قسم البيانات الإضافية غير موجود');
        }
        
        // جلب بيانات الفني من API (من technicians.php)
        const branchName = (repairTrackingData.repairDetails?.branch_name || '').trim();
        const branchId = repairTrackingData.repairDetails?.branch_id || null;
        
        console.log('🔍 [loadTechnicianFullData] branchName:', branchName, 'branchId:', branchId);
        
        // محاولة جلب البيانات من technicians.php
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
            const lastDayOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
            
            // جلب بيانات الفني من technicians.php
            const apiUrl = `technicians.php?branch_id=${encodeURIComponent(branchId || '')}&month=${currentMonth}&year=${currentYear}`;
            console.log('🔍 [loadTechnicianFullData] جلب البيانات من:', apiUrl);
            
            const techniciansResult = await window.API.request(apiUrl, 'GET');
            
            console.log('📥 [loadTechnicianFullData] استجابة API:', techniciansResult);
            
            if (techniciansResult && techniciansResult.success && Array.isArray(techniciansResult.data)) {
                console.log('✅ [loadTechnicianFullData] تم جلب', techniciansResult.data.length, 'فني');
                const technicianData = techniciansResult.data.find(t => t.id === technicianId);
                
                console.log('🔍 [loadTechnicianFullData] بيانات الفني:', technicianData);
                
                if (technicianData) {
                    // عرض التقييم التراكمي
                    const displayRating = shouldShowPremiumCard ? 5 : Math.round(technicianData.avg_rating || 0);
                    const avgRating = shouldShowPremiumCard ? 5 : (technicianData.avg_rating || 0);
                    const totalRatings = technicianData.total_ratings || 0;
                    
                    let cumulativeStarsHTML = '';
                    for (let i = 1; i <= 5; i++) {
                        const isFilled = i <= displayRating;
                        cumulativeStarsHTML += `<span class="star ${isFilled ? '' : 'empty'}"><i class="bi bi-star${isFilled ? '-fill' : ''}"></i></span>`;
                    }
                    
                    const cumulativeRatingStarsEl = document.getElementById('cumulativeRatingStars');
                    const cumulativeRatingNumberEl = document.getElementById('cumulativeRatingNumber');
                    const cumulativeRatingCountEl = document.getElementById('cumulativeRatingCount');
                    
                    if (cumulativeRatingStarsEl) cumulativeRatingStarsEl.innerHTML = cumulativeStarsHTML;
                    if (cumulativeRatingNumberEl) cumulativeRatingNumberEl.textContent = avgRating.toFixed(1);
                    if (cumulativeRatingCountEl) {
                        if (shouldShowPremiumCard) {
                            cumulativeRatingCountEl.innerHTML = '<span style="color: #8B4513; font-weight: 600;">⭐ فني الصيانة - الفرع الأول</span>';
                        } else if (totalRatings > 0) {
                            cumulativeRatingCountEl.textContent = `من ${totalRatings} تقييم${totalRatings > 1 ? 'ات' : ''}`;
                        } else {
                            cumulativeRatingCountEl.innerHTML = '<span style="color: var(--text-light);">لا توجد تقييمات بعد</span>';
                        }
                    }
                    
                    // عرض التقييم الشهري
                    const displayMonthlyRating = shouldShowPremiumCard ? 5 : Math.round(technicianData.monthly_avg_rating || 0);
                    const monthlyAvgRating = shouldShowPremiumCard ? 5 : (technicianData.monthly_avg_rating || 0);
                    const monthlyRatings = technicianData.monthly_ratings || 0;
                    
                    let monthlyStarsHTML = '';
                    for (let i = 1; i <= 5; i++) {
                        const isFilled = i <= displayMonthlyRating;
                        monthlyStarsHTML += `<span class="star ${isFilled ? '' : 'empty'}"><i class="bi bi-star${isFilled ? '-fill' : ''}"></i></span>`;
                    }
                    
                    const monthlyRatingStarsEl = document.getElementById('monthlyRatingStars');
                    const monthlyRatingNumberEl = document.getElementById('monthlyRatingNumber');
                    const monthlyRatingCountEl = document.getElementById('monthlyRatingCount');
                    
                    if (monthlyRatingStarsEl) monthlyRatingStarsEl.innerHTML = monthlyStarsHTML;
                    if (monthlyRatingNumberEl) monthlyRatingNumberEl.textContent = monthlyAvgRating.toFixed(1);
                    if (monthlyRatingCountEl) {
                        if (shouldShowPremiumCard) {
                            monthlyRatingCountEl.innerHTML = '<span style="font-size: 0.85em; color: #8B4513; font-weight: 600;">⭐ فني الصيانة</span>';
                        } else if (monthlyRatings > 0) {
                            monthlyRatingCountEl.textContent = `من ${monthlyRatings} تقييم${monthlyRatings > 1 ? 'ات' : ''}`;
                        } else {
                            monthlyRatingCountEl.innerHTML = '<span style="color: var(--text-light);">لا توجد تقييمات هذا الشهر</span>';
                        }
                    }
                    
                    // عرض عدد العمليات المكتملة
                    const completedRepairs = technicianData.completed_repairs || 0;
                    const completedRepairsCountEl = document.getElementById('completedRepairsCount');
                    if (completedRepairsCountEl) completedRepairsCountEl.textContent = completedRepairs;
                    
                    // عرض عدد العمليات هذا الشهر
                    const monthlyRepairs = technicianData.monthly_repairs || 0;
                    const monthlyRepairsCountEl = document.getElementById('monthlyRepairsCount');
                    if (monthlyRepairsCountEl) monthlyRepairsCountEl.textContent = monthlyRepairs;
                    
                    // ✅ جعل البطاقة قابلة للنقر لفتح modal التقييمات
                    const technicianCard = document.getElementById('technicianCardTracking');
                    if (technicianCard) {
                        technicianCard.style.cursor = 'pointer';
                        technicianCard.onclick = function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (typeof window.showTechnicianRatingsModal === 'function') {
                                window.showTechnicianRatingsModal(technicianId, technicianData.name || technicianData.username || 'الفني المستلم');
                            }
                        };
                    }
                    
                    console.log('✅ [Technician Full Data] تم جلب وعرض البيانات الكاملة للفني "مالك"');
                    return;
                } else {
                    console.warn('⚠️ [loadTechnicianFullData] الفني غير موجود في النتائج');
                }
            } else {
                console.warn('⚠️ [loadTechnicianFullData] استجابة API غير صحيحة:', techniciansResult);
            }
        } catch (error) {
            console.error('❌ خطأ في جلب بيانات الفني الكاملة:', error);
        }
        
        // ✅ إذا فشل جلب البيانات، عرض القيم الافتراضية للفني "مالك"
        console.log('⚠️ [loadTechnicianFullData] فشل جلب البيانات - عرض القيم الافتراضية');
        displayDefaultTechnicianData(shouldShowPremiumCard);
    } catch (error) {
        console.error('❌ خطأ في جلب البيانات الكاملة للفني:', error);
        displayDefaultTechnicianData(shouldShowPremiumCard);
    }
}

// ✅ دالة لعرض البيانات الافتراضية للفني "مالك"
function displayDefaultTechnicianData(shouldShowPremiumCard) {
    try {
        console.log('🔧 [displayDefaultTechnicianData] عرض البيانات الافتراضية - shouldShowPremiumCard:', shouldShowPremiumCard);
        
        const displayRating = shouldShowPremiumCard ? 5 : 5;
        const avgRating = 5;
        
        let cumulativeStarsHTML = '';
        for (let i = 1; i <= 5; i++) {
            cumulativeStarsHTML += `<span class="star"><i class="bi bi-star-fill"></i></span>`;
        }
        
        const cumulativeRatingStarsEl = document.getElementById('cumulativeRatingStars');
        const cumulativeRatingNumberEl = document.getElementById('cumulativeRatingNumber');
        const cumulativeRatingCountEl = document.getElementById('cumulativeRatingCount');
        
        if (cumulativeRatingStarsEl) cumulativeRatingStarsEl.innerHTML = cumulativeStarsHTML;
        if (cumulativeRatingNumberEl) cumulativeRatingNumberEl.textContent = '5.0';
        if (cumulativeRatingCountEl) {
            if (shouldShowPremiumCard) {
                cumulativeRatingCountEl.innerHTML = '<span style="color: #8B4513; font-weight: 600;">⭐ فني الصيانة - الفرع الأول</span>';
            } else {
                cumulativeRatingCountEl.innerHTML = '<span style="color: #8B4513; font-weight: 600;">⭐ فني الصيانة</span>';
            }
        }
        
        // التقييم الشهري
        let monthlyStarsHTML = '';
        for (let i = 1; i <= 5; i++) {
            monthlyStarsHTML += `<span class="star"><i class="bi bi-star-fill"></i></span>`;
        }
        
        const monthlyRatingStarsEl = document.getElementById('monthlyRatingStars');
        const monthlyRatingNumberEl = document.getElementById('monthlyRatingNumber');
        const monthlyRatingCountEl = document.getElementById('monthlyRatingCount');
        
        if (monthlyRatingStarsEl) monthlyRatingStarsEl.innerHTML = monthlyStarsHTML;
        if (monthlyRatingNumberEl) monthlyRatingNumberEl.textContent = '5.0';
        if (monthlyRatingCountEl) {
            if (shouldShowPremiumCard) {
                monthlyRatingCountEl.innerHTML = '<span style="font-size: 0.85em; color: #8B4513; font-weight: 600;">⭐ فني الصيانة</span>';
            } else {
                monthlyRatingCountEl.innerHTML = '<span style="font-size: 0.85em; color: #8B4513; font-weight: 600;">⭐ فني الصيانة</span>';
            }
        }
        
        // عدد العمليات
        const completedRepairsCountEl = document.getElementById('completedRepairsCount');
        const monthlyRepairsCountEl = document.getElementById('monthlyRepairsCount');
        if (completedRepairsCountEl) completedRepairsCountEl.textContent = '0';
        if (monthlyRepairsCountEl) monthlyRepairsCountEl.textContent = '0';
        
        console.log('✅ [displayDefaultTechnicianData] تم عرض البيانات الافتراضية بنجاح');
    } catch (error) {
        console.error('❌ خطأ في عرض البيانات الافتراضية:', error);
    }
}

// ✅ دالة لعرض صفحة التتبع
async function renderTrackingPage() {
    try {
        // ✅ التحقق من وجود بيانات قبل العرض
        if (!repairTrackingData || !repairTrackingData.repairNumber) {
            console.warn('⚠️ [Repair Tracking] لا توجد بيانات للعرض');
            return;
        }
        
        // ✅ التحقق من انتهاء الصلاحية إذا كان هناك createdAt
        if (repairTrackingData.createdAt && !isViewExpired) {
            const expiryInfo = checkLinkExpiry(repairTrackingData.createdAt);
            isViewExpired = expiryInfo.expiredView;
            isLinkExpired = expiryInfo.expired;
            
            if (expiryInfo.expiredView) {
                showExpiredMessage(expiryInfo);
                const progressSection = document.querySelector('.progress-section');
                const ratingSection = document.getElementById('ratingSection');
                const ratingDisplay = document.getElementById('ratingDisplay');
                if (progressSection) progressSection.style.display = 'none';
                if (ratingSection) ratingSection.style.display = 'none';
                if (ratingDisplay) ratingDisplay.style.display = 'none';
                return;
            }
            
            if (expiryInfo.expired) {
                showExpiredMessage(expiryInfo);
                const ratingSection = document.getElementById('ratingSection');
                if (ratingSection) {
                    ratingSection.style.display = 'none';
                }
            }
        }
        
        // تحديث رقم الصيانة
        const repairNumberEl = document.getElementById('repairNumber');
        if (repairNumberEl && repairTrackingData.repairNumber) {
            repairNumberEl.textContent = `#${repairTrackingData.repairNumber}`;
        }
        
        // تحديث وصف الحالة
        const statusDescriptionEl = document.getElementById('statusDescription');
        if (statusDescriptionEl && repairTrackingData.statusDescription) {
            statusDescriptionEl.textContent = repairTrackingData.statusDescription;
        }
        
        // تحديث تاريخ التسليم المتوقع
        const estimatedDeliveryEl = document.getElementById('estimatedDeliveryDate');
        if (estimatedDeliveryEl) {
            if (repairTrackingData.estimatedDeliveryDate) {
                estimatedDeliveryEl.textContent = formatArabicDate(repairTrackingData.estimatedDeliveryDate);
            } else {
                estimatedDeliveryEl.textContent = 'لم يتم تحديد تاريخ';
            }
        }
        
        // ✅ عرض تفاصيل العملية
        renderRepairDetails();
        
        // ✅ عرض بطاقة الفني
        await renderTechnicianCard();
        
        // ✅ عرض أزرار الموافقة/الرفض إذا كانت الحالة "بانتظار موافقة العميل"
        renderCustomerApprovalButtons();
        
        // عرض شريط التقدم
        renderProgressTimeline();
    } catch (error) {
        console.error('❌ خطأ في عرض صفحة التتبع:', error);
        showError('حدث خطأ أثناء تحميل بيانات التتبع');
    }
}

// ✅ دالة مساعدة لجلب بيانات الصيانة من API
async function fetchRepairDataFromAPI(repairNumber) {
    try {
        if (typeof window.API === 'undefined') {
            console.warn('⚠️ API غير متاح');
            return null;
        }
        
        // البحث عن عملية الصيانة برقمها
        console.log('🔍 [Repair Tracking] جلب بيانات الصيانة برقم:', repairNumber);
        const result = await window.API.request(`repairs.php?repair_number=${encodeURIComponent(repairNumber)}`, 'GET');
        console.log('📥 [Repair Tracking] استجابة API:', result);
        
        // ✅ التحقق من الاستجابة
        if (!result) {
            console.error('❌ [Repair Tracking] لا توجد استجابة من API');
            return null;
        }
        
        if (!result.success) {
            console.error('❌ [Repair Tracking] فشل الطلب:', result.message || result.error, 'Status:', result.status);
            // إذا كان الخطأ 404، الصيانة غير موجودة
            if (result.status === 404) {
                console.warn('⚠️ [Repair Tracking] الصيانة غير موجودة في قاعدة البيانات');
            }
            return null;
        }
        
        if (!result.data) {
            console.warn('⚠️ [Repair Tracking] لا توجد بيانات في الاستجابة');
            return null;
        }
        
        // ✅ API يرجع object مباشرة عند البحث بـ repair_number
        // التحقق من أن البيانات موجودة وصحيحة
        if (!result.data || typeof result.data !== 'object') {
            console.warn('⚠️ [Repair Tracking] بيانات غير صحيحة من API');
            return null;
        }
        
        // ✅ استخدام البيانات مباشرة (API يرجع object واحد)
        const repair = result.data;
        
        // ✅ التحقق من أن repair_number موجود ومطابق
        if (!repair.repair_number) {
            console.warn('⚠️ [Repair Tracking] البيانات لا تحتوي على repair_number');
            return null;
        }
        
        // ✅ التحقق من تطابق رقم الصيانة (غير حساس لحالة الأحرف)
        const repairNum = (repair.repair_number || '').trim().toUpperCase();
        const searchNum = repairNumber.trim().toUpperCase();
        
        if (repairNum !== searchNum) {
            console.warn('⚠️ [Repair Tracking] رقم الصيانة غير مطابق:', {
                expected: searchNum,
                found: repairNum
            });
            return null;
        }
        
        console.log('✅ [Repair Tracking] تم العثور على الصيانة بنجاح:', repair.repair_number);
        
        // تحويل حالة الصيانة إلى حالة التتبع (استخدام الحالة مباشرة)
        const repairStatus = repair.status || 'received';
        
        // تحديد الحالة النهائية (delivered أو cancelled)
        const isCancelled = repairStatus === 'cancelled' || repairStatus === 'lost';
        const isDelivered = repairStatus === 'delivered';
        // ✅ finalStatus يجب أن يكون دائماً 'delivered' أو 'cancelled' للمرحلة الأخيرة
        // إذا لم تكن منتهية، لا نضيف مرحلة نهائية
        const finalStatus = isCancelled ? 'cancelled' : (isDelivered ? 'delivered' : null);
        
        // بناء بيانات المراحل
        const stages = [
            {
                id: 'received',
                name: 'تم الاستلام',
                description: 'تم استلام الجهاز و في انتظار الفحص و تقرير الفني.',
                date: repair.created_at ? repair.created_at.split('T')[0] : null,
                completed: false,
                active: false
            },
            {
                id: 'under_inspection',
                name: 'قيد الفحص',
                description: 'يتم الان فحص الجهاز لتحديد المشكلة.',
                date: null,
                completed: false,
                active: false
            },
            {
                id: 'awaiting_customer_approval',
                name: 'بانتظار موافقة العميل',
                description: 'بانتظار موافقتك على التكلفة المقترحة.',
                date: null,
                completed: false,
                active: false
            },
            {
                id: 'customer_approved',
                name: 'تم الحصول علي الموافقه',
                description: 'تم الحصول على موافقتك. سيتم البدء في إصلاح الجهاز.',
                date: null,
                completed: false,
                active: false
            },
            {
                id: 'in_progress',
                name: 'قيد الإصلاح',
                description: 'يتم الان إصلاح جهازك.',
                date: null,
                completed: false,
                active: false
            },
            {
                id: 'ready_for_delivery',
                name: 'جاهز للتسليم',
                description: 'تم إصلاح الجهاز و جاهز للاستلام.',
                date: null,
                completed: false,
                active: false
            }
        ];
        
        // ✅ إضافة المرحلة الأخيرة فقط إذا كانت العملية منتهية
        if (finalStatus) {
            stages.push({
                id: finalStatus,
                name: isCancelled ? 'عملية ملغية' : 'تم التسليم',
                description: isCancelled ? 'تم إلغاء العملية.' : 'تم تسليم الجهاز .',
                date: repair.delivery_date || (isDelivered ? new Date().toISOString().split('T')[0] : null),
                completed: false,
                active: false
            });
        }
        
        // تحديث حالة المراحل حسب حالة الصيانة
        const stageOrder = ['received', 'under_inspection', 'awaiting_customer_approval', 'customer_approved', 'in_progress', 'ready_for_delivery'];
        
        // العثور على الفهرس الحالي
        let currentIndex = -1;
        if (isDelivered || isCancelled) {
            // إذا كانت delivered أو cancelled، جميع المراحل السابقة مكتملة والمرحلة الأخيرة هي النهائية
            currentIndex = stageOrder.length; // بعد جميع المراحل
        } else {
            currentIndex = stageOrder.indexOf(repairStatus);
            // ✅ إذا لم يتم العثور على الحالة، افترض أنها 'received'
            if (currentIndex === -1) {
                console.warn('⚠️ حالة غير معروفة:', repairStatus, '- استخدام received كافتراضي');
                currentIndex = 0; // received هو الفهرس 0
            }
        }
        
        console.log('🔍 [Progress] حالة الصيانة:', repairStatus, '- currentIndex:', currentIndex);
        
        // ✅ تحديث حالة المراحل
        stages.forEach((stage, index) => {
            // ✅ المرحلة الأخيرة هي التي لها id = delivered أو cancelled أو lost
            const isLastStage = stage.id === 'delivered' || stage.id === 'cancelled' || stage.id === 'lost';
            const stageOrderIndex = stageOrder.indexOf(stage.id);
            
            if (isLastStage) {
                // ✅ المرحلة الأخيرة (delivered/cancelled)
                stage.completed = isDelivered || isCancelled;
                stage.active = false;
            } else if (stageOrderIndex === -1) {
                // المرحلة غير موجودة في stageOrder (يجب ألا يحدث)
                console.warn('⚠️ مرحلة غير معروفة:', stage.id);
                stage.completed = false;
                stage.active = false;
            } else if (stageOrderIndex < currentIndex) {
                // ✅ المراحل السابقة: مكتملة
                stage.completed = true;
                stage.active = false;
            } else if (stageOrderIndex === currentIndex) {
                // ✅ المرحلة الحالية: نشطة ومكتملة (لأنها تمت بالفعل)
                stage.completed = true;
                stage.active = true;
            } else {
                // ✅ المراحل المستقبلية: غير مكتملة
                stage.completed = false;
                stage.active = false;
            }
        });
        
        // ✅ إذا كانت المرحلة الأخيرة مكتملة، تأكد من أن جميع المراحل السابقة مكتملة
        // ملاحظة: هذا الكود يعمل فقط عندما تكون العملية منتهية (delivered/cancelled)
        const lastStage = stages[stages.length - 1];
        if (lastStage && lastStage.completed && (isDelivered || isCancelled)) {
            // فقط عندما تكون العملية منتهية، نجعل جميع المراحل السابقة مكتملة
            for (let i = 0; i < stages.length - 1; i++) {
                stages[i].completed = true;
                stages[i].active = false; // إلغاء active من جميع المراحل السابقة
            }
        }
        
        // ✅ إضافة console.log للتصحيح
        console.log('📊 [Progress] حالة المراحل بعد التحديث:');
        stages.forEach((stage, index) => {
            console.log(`  ${index + 1}. ${stage.name}: completed=${stage.completed}, active=${stage.active}`);
        });
        
        // بناء وصف الحالة
        const statusDescriptions = {
            'received': 'تم استلام الجهاز و في انتظار الفحص و تقرير الفني.',
            'under_inspection': 'يتم الان فحص الجهاز لتحديد المشكلة.',
            'awaiting_customer_approval': 'تم تحديد التكلفة المطلوبة للإصلاح. ننتظر موافقتك للمتابعة.',
            'customer_approved': 'تم الحصول على موافقتك. سيتم البدء في إصلاح الجهاز.',
            'in_progress': 'يتم الان إصلاح جهازك.',
            'ready_for_delivery': 'تم إصلاح الجهاز و جاهز للاستلام.',
            'delivered': 'تم تسليم الجهاز .',
            'cancelled': 'تم إلغاء العملية.',
            'lost': 'تم إلغاء العملية.'
        };
        
        // استخدام تاريخ التسليم المتوقع مباشرة من قاعدة البيانات
        let estimatedDate = repair.delivery_date || null;
        
        // ✅ إضافة تاريخ الإنشاء للتحقق من انتهاء الصلاحية
        const createdAt = repair.created_at || null;
        
        return {
            repairId: repair.id || null, // ✅ إضافة repair_id للتقييم
            repairNumber: repair.repair_number || repairNumber,
            status: repairStatus,
            statusDescription: statusDescriptions[repairStatus] || statusDescriptions['received'],
            estimatedDeliveryDate: estimatedDate,
            stages: stages,
            createdAt: createdAt, // ✅ إضافة تاريخ الإنشاء
            // ✅ إضافة تفاصيل العملية
            repairDetails: {
                customer_name: repair.customer_name || '',
                customer_phone: repair.customer_phone || '',
                device_type: repair.device_type || '',
                device_model: repair.device_model || '',
                serial_number: repair.serial_number || '',
                problem: repair.problem || '',
                customer_price: repair.customer_price || 0,
                branch_name: repair.branch_name || '',
                branch_id: repair.branch_id || null,
                created_at: repair.created_at || null,
                inspection_report: repair.inspection_report || null
            },
            // ✅ إضافة بيانات الفني (من JOIN في repairs.php)
            technician: repair.created_by ? {
                id: repair.created_by,
                name: repair.technician_name || 'فني غير معروف',
                username: repair.technician_username || '',
                role: repair.technician_role || 'technician',
                avatar: repair.technician_avatar || null
            } : null
        };
    } catch (error) {
        console.error('❌ خطأ في جلب بيانات الصيانة من API:', error);
        return null;
    }
}

// ✅ دالة للتحقق من انتهاء صلاحية الرابط
function checkLinkExpiry(createdAt) {
    if (!createdAt) return { expired: false, expiredView: false };
    
    try {
        const createdDate = new Date(createdAt);
        const now = new Date();
        const daysDiff = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        const monthsDiff = Math.floor(daysDiff / 30);
        
        // انتهاء الصلاحية بعد أسبوع (7 أيام)
        const expired = daysDiff > 7;
        
        // انتهاء فترة العرض بعد 3 أشهر (90 يوم)
        const expiredView = daysDiff > 90;
        
        return {
            expired: expired,
            expiredView: expiredView,
            daysSinceCreation: daysDiff,
            monthsSinceCreation: monthsDiff
        };
    } catch (error) {
        console.error('خطأ في التحقق من انتهاء الصلاحية:', error);
        return { expired: false, expiredView: false };
    }
}

// ✅ دالة لعرض رسالة انتهاء الصلاحية
function showExpiredMessage(expiryInfo) {
    try {
        const statusSection = document.querySelector('.status-section');
        if (!statusSection) return;
        
        // إنشاء div للرسالة
        let expiredDiv = document.getElementById('expiredMessage');
        if (!expiredDiv) {
            expiredDiv = document.createElement('div');
            expiredDiv.id = 'expiredMessage';
            expiredDiv.style.cssText = `
                background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                color: white;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                text-align: center;
                box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
            `;
            statusSection.insertBefore(expiredDiv, statusSection.firstChild);
        }
        
        if (expiryInfo.expiredView) {
            // بعد 3 أشهر
            expiredDiv.innerHTML = `
                <h3 style="margin: 0 0 10px 0; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    انتهت فترة العرض
                </h3>
                <p style="margin: 0; font-size: 0.95em;">
                    عذراً، انتهت فترة عرض هذه العملية (أكثر من 3 أشهر). لم يعد بإمكانك عرض بيانات العملية.
                </p>
            `;
            expiredDiv.style.display = 'block';
            expiredDiv.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        } else if (expiryInfo.expired) {
            // بعد أسبوع
            expiredDiv.innerHTML = `
                <h3 style="margin: 0 0 10px 0; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i class="bi bi-clock-history"></i>
                    انتهت صلاحية الرابط
                </h3>
                <p style="margin: 0; font-size: 0.95em;">
                    انتهت صلاحية الرابط (أكثر من أسبوع). يمكنك عرض بيانات العملية والتقييم فقط، لكن لا يمكنك تعديل التقييم.
                </p>
            `;
            expiredDiv.style.display = 'block';
        } else {
            expiredDiv.style.display = 'none';
        }
    } catch (error) {
        console.error('خطأ في عرض رسالة انتهاء الصلاحية:', error);
    }
}

// ✅ دالة لتحديث البيانات (تحدث البروجريس فقط)
async function refreshTracking() {
    try {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> جاري التحديث...';
        }
        
        // محاولة جلب البيانات من API إذا كان متاحاً
        const newData = await fetchRepairDataFromAPI(repairTrackingData.repairNumber);
        if (newData) {
            // تحديث البيانات فقط
            if (newData.repairNumber) repairTrackingData.repairNumber = newData.repairNumber;
            if (newData.status) repairTrackingData.status = newData.status;
            if (newData.statusDescription) repairTrackingData.statusDescription = newData.statusDescription;
            if (newData.estimatedDeliveryDate) repairTrackingData.estimatedDeliveryDate = newData.estimatedDeliveryDate;
            if (newData.stages && Array.isArray(newData.stages)) repairTrackingData.stages = newData.stages;
            
            // تحديث جميع الأقسام
            renderTrackingPage();
            
            console.log('✅ تم تحديث البيانات بنجاح');
            
            // إظهار رسالة النجاح
            showTrackingMessage('تم تحديث البيانات بنجاح', 'success');
        } else {
            // إذا فشل جلب البيانات من API، استخدام البيانات المحلية
            console.log('ℹ️ استخدام البيانات المحلية');
            showTrackingMessage('لم يتم العثور على تحديثات جديدة', 'info');
        }
        
        // استعادة زر التحديث
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> تحديث';
        }
    } catch (error) {
        console.error('❌ خطأ في تحديث البيانات:', error);
        
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> تحديث';
        }
        
        showTrackingMessage('حدث خطأ أثناء تحديث البيانات. يرجى المحاولة مرة أخرى.', 'error');
    }
}

// ✅ تم حذف دالة goToHome حسب الطلب

// ✅ دالة لإظهار شاشة التحميل
function showLoading() {
    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    } catch (error) {
        console.error('خطأ في إظهار شاشة التحميل:', error);
    }
}

// ✅ دالة لإخفاء شاشة التحميل
function hideLoading() {
    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    } catch (error) {
        console.error('خطأ في إخفاء شاشة التحميل:', error);
    }
}

// ✅ دالة لعرض رسالة خطأ
function showError(message) {
    try {
        if (typeof showMessage === 'function') {
            showMessage(message, 'error');
        } else {
            alert(message);
        }
    } catch (error) {
        console.error('خطأ في عرض رسالة الخطأ:', error);
    }
}

// ✅ دالة لـ escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ✅ دالة لعرض معلومات التصحيح
function showDebugInfo(repairNumber, apiData, apiError) {
    try {
        const container = document.querySelector('.repair-tracking-container');
        if (!container) return;
        
        let errorDetails = '';
        if (apiError) {
            errorDetails = `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="color: #856404; margin: 0 0 10px 0;">تفاصيل الخطأ:</h4>
                    <pre style="background: white; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px; margin: 0;">${JSON.stringify({
                        name: apiError?.name,
                        message: apiError?.message,
                        stack: apiError?.stack?.substring(0, 500)
                    }, null, 2)}</pre>
                </div>
            `;
        }
        
        if (apiData === null) {
            errorDetails += `
                <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="color: #721c24; margin: 0 0 10px 0;">النتيجة من API:</h4>
                    <p style="margin: 0; color: #721c24;">null - لم يتم العثور على الصيانة</p>
                </div>
            `;
        }
        
        container.innerHTML = `
            <div class="error-message-container" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 60vh;
                padding: 40px 20px;
                text-align: center;
            ">
                <div style="
                    background: var(--white);
                    border-radius: 15px;
                    padding: 40px;
                    box-shadow: var(--shadow);
                    max-width: 800px;
                    width: 100%;
                    text-align: right;
                ">
                    <div style="
                        font-size: 64px;
                        color: var(--warning-color);
                        margin-bottom: 20px;
                    ">
                        <i class="bi bi-bug"></i>
                    </div>
                    <h2 style="
                        color: var(--text-dark);
                        margin-bottom: 15px;
                        font-size: 24px;
                        font-weight: 700;
                    ">
                        وضع التصحيح - معلومات الخطأ
                    </h2>
                    <div style="
                        background: #e7f3ff;
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                        text-align: right;
                    ">
                        <h3 style="color: var(--primary-color); margin: 0 0 15px 0; font-size: 18px;">معلومات الطلب:</h3>
                        <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <p style="margin: 5px 0;"><strong>رقم العملية المطلوب:</strong> <code style="background: #f5f5f5; padding: 3px 8px; border-radius: 4px;">${escapeHtml(repairNumber)}</code></p>
                            <p style="margin: 5px 0;"><strong>URL الكامل:</strong> <code style="background: #f5f5f5; padding: 3px 8px; border-radius: 4px; font-size: 12px; word-break: break-all;">${escapeHtml(window.location.href)}</code></p>
                            <p style="margin: 5px 0;"><strong>API Endpoint:</strong> <code style="background: #f5f5f5; padding: 3px 8px; border-radius: 4px;">api/repairs.php?repair_number=${encodeURIComponent(repairNumber)}</code></p>
                        </div>
                        ${errorDetails}
                        <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin-top: 15px;">
                            <h4 style="color: #0c5460; margin: 0 0 10px 0;">خطوات التحقق:</h4>
                            <ol style="text-align: right; margin: 0; padding-right: 20px; color: #0c5460;">
                                <li>افتح Console في المتصفح (F12) لرؤية رسائل التتبع</li>
                                <li>تحقق من ملف logs/php_errors.log لرؤية أخطاء PHP</li>
                                <li>تحقق من أن رقم العملية موجود في قاعدة البيانات</li>
                                <li>تحقق من تطابق رقم العملية (بدون مسافات إضافية)</li>
                            </ol>
                        </div>
                    </div>
                    <button onclick="window.location.reload()" style="
                        background: var(--primary-color);
                        color: var(--white);
                        border: none;
                        padding: 12px 30px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-top: 20px;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='var(--secondary-color)'" onmouseout="this.style.background='var(--primary-color)'">
                        <i class="bi bi-arrow-clockwise"></i>
                        إعادة المحاولة
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('❌ خطأ في عرض معلومات التصحيح:', error);
    }
}

// ✅ دالة لعرض رسالة الخطأ وإعادة التوجيه
function showErrorAndRedirect(message, redirectUrl = 'https://www.facebook.com/share/1D594zC9zC/?mibextid=wwXIfr', description = null) {
    try {
        const container = document.querySelector('.repair-tracking-container');
        if (!container) return;
        
        // تحديد الوصف الافتراضي
        const defaultDescription = description || 'يجب الوصول إلى هذه الصفحة من خلال رابط صحيح يحتوي على رقم الصيانة.';
        
        container.innerHTML = `
            <div class="error-message-container" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 60vh;
                padding: 40px 20px;
                text-align: center;
            ">
                <div style="
                    background: var(--white);
                    border-radius: 15px;
                    padding: 40px;
                    box-shadow: var(--shadow);
                    max-width: 500px;
                    width: 100%;
                ">
                    <div style="
                        font-size: 64px;
                        color: var(--danger-color);
                        margin-bottom: 20px;
                    ">
                        <i class="bi bi-shield-exclamation"></i>
                    </div>
                    <h2 style="
                        color: var(--text-dark);
                        margin-bottom: 15px;
                        font-size: 24px;
                        font-weight: 700;
                    ">
                        ${escapeHtml(message)}
                    </h2>
                    <p style="
                        color: var(--text-light);
                        margin-bottom: 15px;
                        font-size: 16px;
                        line-height: 1.6;
                    ">
                        ${escapeHtml(defaultDescription)}
                    </p>
                    <p style="
                        color: var(--text-light);
                        margin-bottom: 25px;
                        font-size: 14px;
                        line-height: 1.6;
                    ">
                        سيتم إعادة التوجيه تلقائياً خلال <span id="countdown" style="
                            color: var(--primary-color);
                            font-weight: 700;
                            font-size: 18px;
                        ">5</span> ثانية...
                    </p>
                </div>
            </div>
        `;
        
        // ✅ عداد تنازلي وإعادة التوجيه
        let countdown = 5;
        const countdownElement = document.getElementById('countdown');
        
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdownElement) {
                countdownElement.textContent = countdown;
            }
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                // إعادة التوجيه
                window.location.href = redirectUrl;
            }
        }, 1000);
    } catch (error) {
        console.error('❌ خطأ في عرض رسالة الخطأ:', error);
        // إعادة التوجيه مباشرة في حالة الخطأ
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 5000);
    }
}

// ✅ تهيئة الصفحة عند التحميل - انتظار تحميل جميع الملفات
(async function initRepairTracking() {
    // ✅ الانتظار حتى يتم تحميل DOM و API
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    
    // ✅ الانتظار حتى يتم تحميل API
    let apiAttempts = 0;
    const maxApiAttempts = 100; // 10 ثواني
    while (typeof window.API === 'undefined' && apiAttempts < maxApiAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        apiAttempts++;
    }
    
    if (typeof window.API === 'undefined') {
        console.error('❌ [Repair Tracking] فشل تحميل API بعد', maxApiAttempts, 'محاولة');
        const container = document.querySelector('.repair-tracking-container');
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <h2 style="color: var(--danger-color);">خطأ في تحميل API</h2>
                    <p>لم يتم تحميل ملف js/api.js بشكل صحيح. يرجى التحقق من:</p>
                    <ul style="text-align: right; display: inline-block;">
                        <li>أن ملف js/api.js موجود</li>
                        <li>أن المسار صحيح</li>
                        <li>أن لا توجد أخطاء في Console</li>
                    </ul>
                </div>
            `;
        }
        return;
    }
    
    console.log('✅ [Repair Tracking] API محمل بنجاح');
    
    // ✅ إخفاء المحتوى حتى يتم جلب البيانات من API
    const container = document.querySelector('.repair-tracking-container');
    if (container) {
        container.style.display = 'none';
    }
    
    // ✅ إظهار loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    // ✅ الآن يمكن تنفيذ الكود الرئيسي
    try {
        // ✅ التحقق من وجود باراميتر repair_number في URL (إلزامي)
        const urlParams = new URLSearchParams(window.location.search);
        const repairNumber = urlParams.get('repair_number');
        const status = urlParams.get('status');
        
        // ✅ التحقق من وجود بيانات في localStorage
        const savedData = localStorage.getItem('repairTrackingData');
        
        // ✅ منع الوصول بدون باراميتر repair_number
        if (!repairNumber && !savedData) {
            console.warn('⚠️ محاولة وصول غير مصرح بها - لا يوجد repair_number في URL');
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            showErrorAndRedirect('الوصول غير مسموح', 'https://www.facebook.com/share/1D594zC9zC/?mibextid=wwXIfr', 'يجب الوصول إلى هذه الصفحة من خلال رابط صحيح يحتوي على رقم الصيانة.');
            return; // إيقاف تنفيذ باقي الكود
        }
        
        // ✅ إذا كان هناك repair_number في URL، جلب البيانات من API أولاً (الأولوية للAPI)
        if (repairNumber) {
            console.log('🔍 [Repair Tracking] بدء البحث عن الصيانة برقم:', repairNumber);
            repairTrackingData.repairNumber = repairNumber;
            
            // ✅ API يجب أن يكون محملاً بالفعل من initRepairTracking
            console.log('📦 [Repair Tracking] التحقق من API...');
            
            // محاولة جلب البيانات من API إذا كان متاحاً
            if (typeof window.API !== 'undefined' && typeof window.API.request === 'function') {
                console.log('✅ [Repair Tracking] API جاهز، بدء جلب البيانات...');
                try {
                    const apiData = await fetchRepairDataFromAPI(repairNumber);
                    console.log('📥 [Repair Tracking] البيانات المستلمة:', apiData ? 'موجودة' : 'غير موجودة');
                    if (apiData) {
                        window.setRepairTrackingData(apiData);
                        console.log('✅ تم تحميل البيانات من API');
                        
                        // ✅ إظهار المحتوى بعد جلب البيانات
                        if (container) {
                            container.style.display = 'block';
                        }
                        if (loadingOverlay) {
                            loadingOverlay.style.display = 'none';
                        }
                        
                        // ✅ التحقق من انتهاء الصلاحية
                        if (apiData.createdAt) {
                            const expiryInfo = checkLinkExpiry(apiData.createdAt);
                            
                            // ✅ حفظ حالة انتهاء الصلاحية
                            isViewExpired = expiryInfo.expiredView;
                            isLinkExpired = expiryInfo.expired;
                            
                            // إذا انتهت فترة العرض (3 أشهر)، إخفاء المحتوى
                            if (expiryInfo.expiredView) {
                                showExpiredMessage(expiryInfo);
                                // إخفاء المحتوى الرئيسي
                                const progressSection = document.querySelector('.progress-section');
                                const ratingSection = document.getElementById('ratingSection');
                                const ratingDisplay = document.getElementById('ratingDisplay');
                                if (progressSection) progressSection.style.display = 'none';
                                if (ratingSection) ratingSection.style.display = 'none';
                                if (ratingDisplay) ratingDisplay.style.display = 'none';
                                return; // التوقف هنا
                            }
                            
                            // إذا انتهت الصلاحية (أسبوع)، عرض الرسالة وتعطيل التقييم
                            if (expiryInfo.expired) {
                                showExpiredMessage(expiryInfo);
                                // تعطيل نموذج التقييم (إخفاؤه)
                                const ratingSection = document.getElementById('ratingSection');
                                if (ratingSection) {
                                    ratingSection.style.display = 'none';
                                }
                                // إظهار التقييم الموجود فقط (إذا كان موجوداً)
                                // سيتم التعامل معه في loadExistingRating
                            }
                        }
                    } else {
                        // ✅ وضع التصحيح: عرض معلومات الخطأ بدلاً من منع الوصول
                        console.warn('⚠️ [Repair Tracking] لم يتم العثور على عملية الصيانة في قاعدة البيانات:', repairNumber);
                        console.warn('⚠️ [Repair Tracking] apiData:', apiData);
                        
                        // ✅ عرض معلومات التصحيح على الصفحة
                        showDebugInfo(repairNumber, apiData, null);
                    }
                } catch (apiError) {
                    // ✅ وضع التصحيح: عرض معلومات الخطأ بدلاً من منع الوصول
                    console.error('❌ [Repair Tracking] خطأ في جلب البيانات من API:', apiError);
                    console.error('❌ [Repair Tracking] تفاصيل الخطأ:', {
                        name: apiError?.name,
                        message: apiError?.message,
                        stack: apiError?.stack
                    });
                    
                    // ✅ عرض معلومات التصحيح على الصفحة
                    showDebugInfo(repairNumber, null, apiError);
                }
            } else {
                // ✅ إذا لم يكن API متاحاً، عرض معلومات التصحيح
                console.error('❌ [Repair Tracking] API غير متاح!');
                console.error('❌ [Repair Tracking] typeof window.API:', typeof window.API);
                console.error('❌ [Repair Tracking] window.API:', window.API);
                
                showDebugInfo(repairNumber, null, {
                    name: 'APINotAvailable',
                    message: `API غير متاح - typeof window.API: ${typeof window.API}. تم الانتظار ${apiAttempts} محاولة.`,
                    stack: 'تأكد من أن ملف js/api.js موجود ويتم تحميله بشكل صحيح. تحقق من Console للأخطاء.'
                });
                return; // إيقاف تنفيذ باقي الكود
                }
            } else {
            // ✅ إذا لم يكن هناك رقم صيانة في URL، التحقق من localStorage
            if (savedData) {
                try {
                    const data = JSON.parse(savedData);
                    window.setRepairTrackingData(data);
                    localStorage.removeItem('repairTrackingData'); // حذف البيانات بعد الاستخدام
                    console.log('✅ تم تحميل البيانات من localStorage');
                    
                    // ✅ إظهار المحتوى بعد تحميل البيانات
                    if (container) {
                        container.style.display = 'block';
                    }
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'none';
                    }
                } catch (parseError) {
                    console.error('❌ خطأ في تحليل البيانات من localStorage:', parseError);
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                }
            } else {
                console.warn('⚠️ لا يوجد repair_number في URL ولا بيانات في localStorage');
                if (loadingOverlay) loadingOverlay.style.display = 'none';
            }
        }
        
        console.log('✅ تم تحميل صفحة تتبع الصيانة بنجاح');
    } catch (error) {
        console.error('❌ خطأ في تهيئة الصفحة:', error);
        showError('حدث خطأ أثناء تحميل الصفحة');
    }
})();

// ========== دوال التقييم ==========

let currentRepairId = null;
let existingRating = null;

// ✅ دالة لتعيين التقييم (RTL - أول نجمة من اليمين = نجمة واحدة)
window.setRating = function(type, rating) {
    try {
        const ratingContainer = document.getElementById(`${type}Rating`);
        const ratingValue = document.getElementById(`${type}RatingValue`);
        const ratingError = document.getElementById(`${type}RatingError`);
        
        if (!ratingContainer || !ratingValue) return;
        
        // تحديث النجوم (RTL - أول نجمة من اليمين = نجمة واحدة)
        const stars = ratingContainer.querySelectorAll('.star');
        // ✅ عكس الترتيب لأن النجوم مرتبة من 5 إلى 1 (من اليمين لليسار)
        const reversedStars = Array.from(stars).reverse();
        
        reversedStars.forEach((star, index) => {
            // index 0 = أول نجمة من اليمين = نجمة واحدة
            // index 1 = ثاني نجمة من اليمين = نجمتين
            // وهكذا...
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
        
        // تحديث القيمة المخفية
        ratingValue.value = rating;
        
        // إخفاء رسالة الخطأ
        if (ratingError) {
            ratingError.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ خطأ في تعيين التقييم:', error);
    }
};

// ✅ متغير لحفظ حالة انتهاء الصلاحية
let isLinkExpired = false;
let isViewExpired = false;

// ✅ دالة لعرض رسالة واضحة ومميزة - نسخة محسنة ومبسطة
function showTrackingMessage(message, type = 'success') {
    try {
        // ✅ استخدام showMessage من utils.js إذا كان متاحاً (أفضل)
        if (typeof window.showMessage === 'function') {
            window.showMessage(message, type);
            console.log(`📢 [Tracking Message] ${type.toUpperCase()}: ${message} (using showMessage from utils.js)`);
            return;
        }
        
        // ✅ محاولة استخدام showMessage من utils.js بعد انتظار قصير
        if (typeof showMessage === 'function') {
            showMessage(message, type);
            console.log(`📢 [Tracking Message] ${type.toUpperCase()}: ${message} (using showMessage)`);
            return;
        }
        
        // ✅ إزالة أي رسالة سابقة أولاً
        const existingMessages = document.querySelectorAll('.tracking-message');
        existingMessages.forEach(msg => {
            try {
                msg.remove();
            } catch (e) {
                console.warn('⚠️ خطأ في إزالة رسالة سابقة:', e);
            }
        });
        
        // ✅ التأكد من أن body موجود
        if (!document.body) {
            console.error('❌ document.body غير موجود - استخدام alert');
            alert(type === 'success' ? `✅ ${message}` : type === 'error' ? `❌ ${message}` : `ℹ️ ${message}`);
            return;
        }
        
        // إنشاء عنصر الرسالة
        const messageDiv = document.createElement('div');
        messageDiv.className = `tracking-message tracking-message-${type}`;
        
        // ✅ تحديد الألوان بشكل واضح
        const bgColor = type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3';
        
        // ✅ إنشاء محتوى الرسالة
        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        messageDiv.textContent = `${icon} ${message}`;
        
        // ✅ إضافة الأنماط بشكل بسيط وواضح - استخدام inline styles مباشرة
        messageDiv.setAttribute('style', `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            padding: 18px 30px !important;
            background: ${bgColor} !important;
            color: white !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
            z-index: 99999 !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            min-width: 250px !important;
            max-width: 90% !important;
            text-align: right !important;
            direction: rtl !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            animation: slideInRight 0.3s ease !important;
        `);
        
        // ✅ إضافة animation بسيطة
        if (!document.getElementById('tracking-message-styles')) {
            const style = document.createElement('style');
            style.id = 'tracking-message-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes slideOutRight {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // ✅ إضافة الرسالة إلى body
        document.body.appendChild(messageDiv);
        
        // ✅ التأكد من أن الرسالة مرئية - إضافة تحقق إضافي
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(messageDiv);
            const rect = messageDiv.getBoundingClientRect();
            console.log(`📢 [Tracking Message] ${type.toUpperCase()}: ${message}`);
            console.log('📍 [Tracking Message] تم إضافة الرسالة إلى DOM');
            console.log('📍 [Tracking Message] موقع الرسالة:', {
                top: rect.top,
                right: rect.right,
                width: rect.width,
                height: rect.height,
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                opacity: computedStyle.opacity,
                zIndex: computedStyle.zIndex
            });
            
            // ✅ إذا كانت الرسالة غير مرئية، إعادة محاولة
            if (rect.width === 0 || rect.height === 0 || computedStyle.display === 'none') {
                console.warn('⚠️ الرسالة غير مرئية - إعادة المحاولة');
                messageDiv.style.display = 'block';
                messageDiv.style.visibility = 'visible';
                messageDiv.style.opacity = '1';
            }
        }, 100);
        
        // ✅ إزالة الرسالة بعد 5 ثوان
        setTimeout(() => {
            if (messageDiv && messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (messageDiv && messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 300);
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ خطأ في عرض الرسالة:', error);
        // ✅ Fallback إلى alert
        try {
            const alertMessage = type === 'success' 
                ? `✅ ${message}` 
                : type === 'error' 
                ? `❌ ${message}` 
                : `ℹ️ ${message}`;
            alert(alertMessage);
        } catch (alertError) {
            console.error('❌ خطأ في alert:', alertError);
        }
    }
}

// ✅ دالة لإرسال التقييم
window.submitRating = async function(event) {
    event.preventDefault();
    
    // ✅ التحقق من انتهاء الصلاحية
    if (isLinkExpired || isViewExpired) {
        showTrackingMessage('انتهت صلاحية الرابط. لا يمكن تعديل التقييم.', 'error');
        return;
    }
    
    // ✅ التحقق من حالة الصيانة - يجب أن تكون delivered أو cancelled أو lost
    const currentStatus = repairTrackingData.status;
    const allowedStatuses = ['delivered', 'cancelled', 'lost'];
    
    if (!allowedStatuses.includes(currentStatus)) {
        const statusMessages = {
            'received': 'لا يمكن التقييم حالياً. العملية في مرحلة الاستلام.',
            'under_inspection': 'لا يمكن التقييم حالياً. العملية قيد الفحص.',
            'awaiting_customer_approval': 'لا يمكن التقييم حالياً. العملية في انتظار موافقتك.',
            'in_progress': 'لا يمكن التقييم حالياً. العملية قيد الإصلاح.',
            'ready_for_delivery': 'لا يمكن التقييم حالياً. العملية جاهزة للتسليم.'
        };
        
        const errorMessage = statusMessages[currentStatus] || 'لا يمكن التقييم حالياً. يجب أن تكون العملية منتهية (تم التسليم أو ملغاة) لتتمكن من التقييم.';
        showTrackingMessage(errorMessage, 'error');
        return;
    }
    
    try {
        const repairRating = parseInt(document.getElementById('repairRatingValue').value);
        const technicianRating = parseInt(document.getElementById('technicianRatingValue').value);
        const comment = document.getElementById('ratingComment').value.trim();
        
        // التحقق من التقييمات
        if (repairRating === 0) {
            document.getElementById('repairRatingError').style.display = 'block';
            return;
        }
        
        if (technicianRating === 0) {
            document.getElementById('technicianRatingError').style.display = 'block';
            return;
        }
        
        // إخفاء رسائل الخطأ
        document.getElementById('repairRatingError').style.display = 'none';
        document.getElementById('technicianRatingError').style.display = 'none';
        
        // إظهار شاشة التحميل
        showLoading();
        
        // تعطيل زر الإرسال
        const submitBtn = document.querySelector('.btn-submit-rating');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الإرسال...';
        }
        
        // إرسال التقييم إلى API
        let result = null;
        if (typeof window.API !== 'undefined') {
            try {
                result = await window.API.request('repair-ratings.php', 'POST', {
                    repair_id: currentRepairId,
                    repair_number: repairTrackingData.repairNumber,
                    repair_rating: repairRating,
                    technician_rating: technicianRating,
                    comment: comment
                });
            } catch (apiError) {
                console.error('❌ خطأ في إرسال التقييم:', apiError);
                result = { success: false, message: 'حدث خطأ أثناء إرسال التقييم' };
            }
        } else {
            // إذا لم يكن API متاحاً، حفظ في localStorage
            const ratingData = {
                repair_id: currentRepairId,
                repair_number: repairTrackingData.repairNumber,
                repair_rating: repairRating,
                technician_rating: technicianRating,
                comment: comment,
                created_at: new Date().toISOString()
            };
            localStorage.setItem(`repair_rating_${repairTrackingData.repairNumber}`, JSON.stringify(ratingData));
            result = { success: true, message: 'تم حفظ التقييم بنجاح' };
        }
        
        // إخفاء شاشة التحميل
        hideLoading();
        
        if (result && result.success) {
            // إظهار رسالة النجاح
            showTrackingMessage('شكراً لك! تم حفظ تقييمك بنجاح', 'success');
            
            // حفظ التقييم محلياً
            existingRating = {
                repair_rating: repairRating,
                technician_rating: technicianRating,
                comment: comment,
                created_at: new Date().toISOString()
            };
            
            // إخفاء نموذج التقييم وعرض التقييم الموجود
            hideRatingForm();
            showRatingDisplay();
        } else {
            // إظهار رسالة الخطأ
            const errorMsg = result?.message || 'حدث خطأ أثناء إرسال التقييم';
            showTrackingMessage(errorMsg, 'error');
            
            // استعادة زر الإرسال
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> إرسال التقييم';
            }
        }
    } catch (error) {
        console.error('❌ خطأ في إرسال التقييم:', error);
        hideLoading();
        
        showTrackingMessage('حدث خطأ أثناء إرسال التقييم. يرجى المحاولة مرة أخرى.', 'error');
        
        // استعادة زر الإرسال
        const submitBtn = document.querySelector('.btn-submit-rating');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> إرسال التقييم';
        }
    }
};

// ✅ دالة لتخطي التقييم
window.skipRating = function() {
    try {
        if (confirm('هل أنت متأكد من تخطي التقييم؟ يمكنك تقييم الخدمة لاحقاً.')) {
            hideRatingForm();
        }
    } catch (error) {
        console.error('❌ خطأ في تخطي التقييم:', error);
    }
};

// ✅ دالة لإظهار نموذج التقييم
function showRatingForm() {
    try {
        const ratingSection = document.getElementById('ratingSection');
        if (ratingSection) {
            ratingSection.style.display = 'block';
            
            // التمرير إلى نموذج التقييم
            setTimeout(() => {
                ratingSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    } catch (error) {
        console.error('❌ خطأ في إظهار نموذج التقييم:', error);
    }
}

// ✅ دالة لإخفاء نموذج التقييم
function hideRatingForm() {
    try {
        const ratingSection = document.getElementById('ratingSection');
        if (ratingSection) {
            ratingSection.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ خطأ في إخفاء نموذج التقييم:', error);
    }
}

// ✅ دالة لإظهار التقييم الموجود
function showRatingDisplay() {
    try {
        const ratingDisplay = document.getElementById('ratingDisplay');
        if (!ratingDisplay || !existingRating) return;
        
        // عرض تقييم الصيانة
        const repairRatingDisplay = document.getElementById('displayRepairRating');
        if (repairRatingDisplay) {
            repairRatingDisplay.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const star = document.createElement('span');
                star.className = 'star' + (i <= existingRating.repair_rating ? '' : ' empty');
                star.innerHTML = '<i class="bi bi-star"></i>';
                repairRatingDisplay.appendChild(star);
            }
        }
        
        // عرض تقييم الفني
        const technicianRatingDisplay = document.getElementById('displayTechnicianRating');
        if (technicianRatingDisplay) {
            technicianRatingDisplay.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const star = document.createElement('span');
                star.className = 'star' + (i <= existingRating.technician_rating ? '' : ' empty');
                star.innerHTML = '<i class="bi bi-star"></i>';
                technicianRatingDisplay.appendChild(star);
            }
        }
        
        // عرض التعليق
        const commentDisplay = document.getElementById('displayComment');
        const commentText = document.getElementById('displayCommentText');
        if (commentDisplay && commentText) {
            if (existingRating.comment && existingRating.comment.trim()) {
                commentText.textContent = existingRating.comment;
                commentDisplay.style.display = 'block';
            } else {
                commentDisplay.style.display = 'none';
            }
        }
        
        // عرض التاريخ
        const ratingDate = document.getElementById('displayRatingDate');
        if (ratingDate && existingRating.created_at) {
            ratingDate.textContent = formatArabicDate(existingRating.created_at);
        }
        
        ratingDisplay.style.display = 'block';
        
        // التمرير إلى التقييم
        setTimeout(() => {
            ratingDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
    } catch (error) {
        console.error('❌ خطأ في عرض التقييم:', error);
    }
}

// ✅ دالة للتحقق من وجود تقييم
async function checkExistingRating() {
    try {
        if (!currentRepairId && !repairTrackingData.repairNumber) return;
        
        // محاولة جلب التقييم من API
        if (typeof window.API !== 'undefined') {
            try {
                const result = await window.API.request(`repair-ratings.php?repair_number=${encodeURIComponent(repairTrackingData.repairNumber)}`, 'GET');
                if (result && result.success && result.data) {
                    existingRating = result.data;
                    return true;
                }
            } catch (apiError) {
                console.warn('⚠️ لا يمكن جلب التقييم من API:', apiError);
            }
        }
        
        // محاولة جلب التقييم من localStorage
        const savedRating = localStorage.getItem(`repair_rating_${repairTrackingData.repairNumber}`);
        if (savedRating) {
            try {
                existingRating = JSON.parse(savedRating);
                return true;
            } catch (parseError) {
                console.error('❌ خطأ في تحليل التقييم من localStorage:', parseError);
            }
        }
        
        return false;
    } catch (error) {
        console.error('❌ خطأ في التحقق من التقييم:', error);
        return false;
    }
}

// ✅ تحديث دالة renderTrackingPage لإظهار نموذج التقييم
const originalRenderTrackingPage = renderTrackingPage;
renderTrackingPage = async function() {
    try {
        // استدعاء الدالة الأصلية
        originalRenderTrackingPage();
        
        // ✅ التحقق من انتهاء الصلاحية - إذا انتهت لا نعرض نموذج التقييم
        if (isLinkExpired || isViewExpired) {
            // التحقق من وجود تقييم لإظهاره فقط (read-only)
            const hasRating = await checkExistingRating();
            if (hasRating) {
                showRatingDisplay();
            }
            hideRatingForm();
            return;
        }
        
        // التحقق من حالة الصيانة (delivered, cancelled, lost)
        const isDelivered = repairTrackingData.status === 'delivered' || 
                           repairTrackingData.status === 'cancelled' || 
                           repairTrackingData.status === 'lost';
        
        if (isDelivered) {
            // التحقق من وجود تقييم
            const hasRating = await checkExistingRating();
            
            if (hasRating) {
                // إظهار التقييم الموجود
                hideRatingForm();
                showRatingDisplay();
            } else {
                // إظهار نموذج التقييم (فقط إذا لم تنته الصلاحية)
                if (!isLinkExpired) {
                    showRatingForm();
                }
            }
        } else {
            // إخفاء نموذج التقييم إذا لم تكن الصيانة منتهية
            hideRatingForm();
            const ratingDisplay = document.getElementById('ratingDisplay');
            if (ratingDisplay) {
                ratingDisplay.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('❌ خطأ في عرض صفحة التتبع:', error);
    }
};

// ✅ تم دمج إضافة repair_id في دالة setRepairTrackingData الأصلية

// ✅ دالة لعرض أزرار الموافقة/الرفض
function renderCustomerApprovalButtons() {
    try {
        const approvalSection = document.getElementById('customerApprovalSection');
        if (!approvalSection) return;
        
        // عرض الأزرار فقط عندما تكون الحالة "بانتظار موافقة العميل"
        if (repairTrackingData.status === 'awaiting_customer_approval') {
            approvalSection.style.display = 'block';
        } else {
            approvalSection.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ خطأ في عرض أزرار الموافقة/الرفض:', error);
    }
}

// ✅ دالة للموافقة على عملية الصيانة
window.approveRepair = async function() {
    try {
        if (!repairTrackingData.repairNumber) {
            showTrackingMessage('رقم عملية الصيانة غير متوفر', 'error');
            return;
        }
        
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري المعالجة...';
        }
        
        const rejectBtn = document.getElementById('rejectBtn');
        if (rejectBtn) {
            rejectBtn.disabled = true;
        }
        
        // إرسال طلب الموافقة إلى API
        if (typeof window.API === 'undefined') {
            showTrackingMessage('API غير متاح', 'error');
            if (approveBtn) approveBtn.disabled = false;
            if (rejectBtn) rejectBtn.disabled = false;
            return;
        }
        
        const result = await window.API.request('repairs.php', 'POST', {
            action: 'approve',
            repair_number: repairTrackingData.repairNumber
        });
        
        if (result && result.success) {
            showTrackingMessage('تم الحصول على موافقتك بنجاح. سيتم البدء في إصلاح الجهاز قريباً.', 'success');
            
            // تحديث حالة العملية محلياً
            repairTrackingData.status = 'customer_approved';
            
            // إعادة تحميل البيانات من API
            setTimeout(async () => {
                const newData = await fetchRepairDataFromAPI(repairTrackingData.repairNumber);
                if (newData) {
                    window.setRepairTrackingData(newData);
                }
            }, 1000);
        } else {
            const errorMsg = result?.message || 'حدث خطأ أثناء معالجة الموافقة';
            showTrackingMessage(errorMsg, 'error');
            
            if (approveBtn) approveBtn.disabled = false;
            if (rejectBtn) rejectBtn.disabled = false;
            
            if (approveBtn) {
                approveBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> موافقة';
            }
        }
    } catch (error) {
        console.error('❌ خطأ في الموافقة على العملية:', error);
        showTrackingMessage('حدث خطأ أثناء معالجة الموافقة. يرجى المحاولة مرة أخرى.', 'error');
        
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        if (approveBtn) approveBtn.disabled = false;
        if (rejectBtn) rejectBtn.disabled = false;
        
        if (approveBtn) {
            approveBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> موافقة';
        }
    }
};

// ✅ دالة لرفض عملية الصيانة
window.rejectRepair = async function() {
    try {
        if (!repairTrackingData.repairNumber) {
            showTrackingMessage('رقم عملية الصيانة غير متوفر', 'error');
            return;
        }
        
        // تأكيد الرفض
        const confirmed = confirm('هل أنت متأكد من رفض التكلفة المقترحة؟ سيتم إلغاء العملية.');
        if (!confirmed) {
            return;
        }
        
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        
        if (rejectBtn) {
            rejectBtn.disabled = true;
            rejectBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري المعالجة...';
        }
        
        if (approveBtn) {
            approveBtn.disabled = true;
        }
        
        // إرسال طلب الرفض إلى API
        if (typeof window.API === 'undefined') {
            showTrackingMessage('API غير متاح', 'error');
            if (approveBtn) approveBtn.disabled = false;
            if (rejectBtn) rejectBtn.disabled = false;
            return;
        }
        
        const result = await window.API.request('repairs.php', 'POST', {
            action: 'reject',
            repair_number: repairTrackingData.repairNumber
        });
        
        if (result && result.success) {
            showTrackingMessage('تم إلغاء العملية بناءً على طلبك.', 'info');
            
            // تحديث حالة العملية محلياً
            repairTrackingData.status = 'cancelled';
            
            // إعادة تحميل البيانات من API
            setTimeout(async () => {
                const newData = await fetchRepairDataFromAPI(repairTrackingData.repairNumber);
                if (newData) {
                    window.setRepairTrackingData(newData);
                }
            }, 1000);
        } else {
            const errorMsg = result?.message || 'حدث خطأ أثناء معالجة الرفض';
            showTrackingMessage(errorMsg, 'error');
            
            if (approveBtn) approveBtn.disabled = false;
            if (rejectBtn) rejectBtn.disabled = false;
            
            if (rejectBtn) {
                rejectBtn.innerHTML = '<i class="bi bi-x-circle-fill"></i> رفض';
            }
        }
    } catch (error) {
        console.error('❌ خطأ في رفض العملية:', error);
        showTrackingMessage('حدث خطأ أثناء معالجة الرفض. يرجى المحاولة مرة أخرى.', 'error');
        
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        if (approveBtn) approveBtn.disabled = false;
        if (rejectBtn) rejectBtn.disabled = false;
        
        if (rejectBtn) {
            rejectBtn.innerHTML = '<i class="bi bi-x-circle-fill"></i> رفض';
        }
    }
};

// ✅ متغيرات pagination
let currentRatingsPage = 1;
const ratingsPerPage = 5;
let allRatings = [];

// ✅ دالة لعرض صفحة معينة من التقييمات
function renderRatingsPage(page, ratings) {
    try {
        const body = document.getElementById('technicianRatingsModalBody');
        if (!body) return;
        
        const totalPages = Math.ceil(ratings.length / ratingsPerPage);
        const startIndex = (page - 1) * ratingsPerPage;
        const endIndex = startIndex + ratingsPerPage;
        const pageRatings = ratings.slice(startIndex, endIndex);
        
        if (pageRatings.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <i class="bi bi-inbox" style="font-size: 4em; color: var(--text-light); margin-bottom: 20px; display: block;"></i>
                    <p style="color: var(--text-light); font-size: 1.1em; margin: 0;">لا توجد تقييمات بعد</p>
                </div>
            `;
            return;
        }
        
        // بناء HTML للجدول
        let ratingsHTML = `
            <div class="ratings-modal-content">
                <div class="ratings-summary">
                    <div class="ratings-summary-item">
                        <i class="bi bi-star-fill"></i>
                        <span class="ratings-summary-label">إجمالي التقييمات:</span>
                        <span class="ratings-summary-value">${ratings.length}</span>
                    </div>
                </div>
                
                <div class="ratings-table-wrapper">
                    <table class="ratings-table-improved">
                        <thead>
                            <tr>
                                <th>العميل</th>
                                <th>رقم العملية</th>
                                <th>تقييم الصيانة</th>
                                <th>تقييم الفني</th>
                                <th>رأي العميل</th>
                                <th>التاريخ</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        pageRatings.forEach((rating) => {
            const repairRating = parseInt(rating.repair_rating || 0);
            const technicianRating = parseInt(rating.technician_rating || 0);
            const comment = rating.comment || '';
            const repairNumber = rating.repair_number || '';
            const customerName = rating.customer_name || 'عميل';
            const createdAt = rating.created_at || '';
            
            // بناء النجوم لتقييم الصيانة (RTL)
            let repairStarsHTML = '';
            for (let i = 5; i >= 1; i--) {
                const isFilled = i <= repairRating;
                repairStarsHTML += `<span class="star ${isFilled ? '' : 'empty'}"><i class="bi bi-star${isFilled ? '-fill' : ''}"></i></span>`;
            }
            
            // بناء النجوم لتقييم الفني (RTL)
            let techStarsHTML = '';
            for (let i = 5; i >= 1; i--) {
                const isFilled = i <= technicianRating;
                techStarsHTML += `<span class="star ${isFilled ? '' : 'empty'}"><i class="bi bi-star${isFilled ? '-fill' : ''}"></i></span>`;
            }
            
            ratingsHTML += `
                <tr>
                    <td class="customer-name-cell">
                        <div class="customer-name">${escapeHtml(customerName)}</div>
                    </td>
                    <td class="repair-number-cell">
                        <span class="repair-number-badge">#${escapeHtml(repairNumber)}</span>
                    </td>
                    <td class="rating-cell">
                        <div class="rating-display-inline">
                            <div class="rating-stars-inline">${repairStarsHTML}</div>
                            <span class="rating-number-badge">${repairRating}/5</span>
                        </div>
                    </td>
                    <td class="rating-cell">
                        <div class="rating-display-inline">
                            <div class="rating-stars-inline">${techStarsHTML}</div>
                            <span class="rating-number-badge">${technicianRating}/5</span>
                        </div>
                    </td>
                    <td class="comment-cell">
                        ${comment ? `
                            <div class="comment-content" title="${escapeHtml(comment)}">
                                <i class="bi bi-chat-left-text"></i>
                                <span>${escapeHtml(comment.length > 40 ? comment.substring(0, 40) + '...' : comment)}</span>
                            </div>
                        ` : '<span class="no-comment">-</span>'}
                    </td>
                    <td class="date-cell">
                        ${createdAt ? `<span class="date-text"><i class="bi bi-calendar"></i> ${formatArabicDate(createdAt)}</span>` : '-'}
                    </td>
                </tr>
            `;
        });
        
        ratingsHTML += `
                        </tbody>
                    </table>
                </div>
        `;
        
        // إضافة pagination
        if (totalPages > 1) {
            ratingsHTML += `
                <div class="ratings-pagination">
                    <div class="pagination-info">
                        عرض ${startIndex + 1} - ${Math.min(endIndex, ratings.length)} من ${ratings.length}
                    </div>
                    <div class="pagination-buttons">
                        <button 
                            class="pagination-btn ${page === 1 ? 'disabled' : ''}" 
                            onclick="goToRatingsPage(${page - 1})"
                            ${page === 1 ? 'disabled' : ''}
                            title="الصفحة السابقة">
                            <i class="bi bi-chevron-right"></i>
                            السابق
                        </button>
            `;
            
            // عرض أرقام الصفحات
            const maxVisiblePages = 5;
            let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            if (startPage > 1) {
                ratingsHTML += `<button class="pagination-btn" onclick="goToRatingsPage(1)">1</button>`;
                if (startPage > 2) {
                    ratingsHTML += `<span class="pagination-ellipsis">...</span>`;
                }
            }
            
            for (let i = startPage; i <= endPage; i++) {
                ratingsHTML += `
                    <button 
                        class="pagination-btn ${i === page ? 'active' : ''}" 
                        onclick="goToRatingsPage(${i})">
                        ${i}
                    </button>
                `;
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    ratingsHTML += `<span class="pagination-ellipsis">...</span>`;
                }
                ratingsHTML += `<button class="pagination-btn" onclick="goToRatingsPage(${totalPages})">${totalPages}</button>`;
            }
            
            ratingsHTML += `
                        <button 
                            class="pagination-btn ${page === totalPages ? 'disabled' : ''}" 
                            onclick="goToRatingsPage(${page + 1})"
                            ${page === totalPages ? 'disabled' : ''}
                            title="الصفحة التالية">
                            التالي
                            <i class="bi bi-chevron-left"></i>
                        </button>
                    </div>
                </div>
            `;
        }
        
        ratingsHTML += `</div>`;
        body.innerHTML = ratingsHTML;
        
    } catch (error) {
        console.error('❌ خطأ في عرض صفحة التقييمات:', error);
    }
}

// ✅ دالة للانتقال إلى صفحة معينة
window.goToRatingsPage = function(page) {
    try {
        if (page < 1 || page > Math.ceil(allRatings.length / ratingsPerPage)) return;
        currentRatingsPage = page;
        renderRatingsPage(page, allRatings);
        
        // التمرير إلى أعلى الجدول
        const body = document.getElementById('technicianRatingsModalBody');
        if (body) {
            body.scrollTop = 0;
        }
    } catch (error) {
        console.error('❌ خطأ في الانتقال إلى صفحة:', error);
    }
};

// ✅ دالة لعرض modal تقييمات الفني
async function showTechnicianRatingsModal(technicianId, technicianName) {
    try {
        // إنشاء modal إذا لم يكن موجوداً
        let modal = document.getElementById('technicianRatingsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'technicianRatingsModal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.setAttribute('dir', 'rtl');
            modal.innerHTML = `
                <div class="modal-content ratings-modal-content-wrapper">
                    <div class="modal-header">
                        <h3 id="technicianRatingsModalTitle">
                            <i class="bi bi-star-fill"></i>
                            تقييمات وآراء العملاء
                        </h3>
                        <button onclick="closeTechnicianRatingsModal()" class="btn-close" title="إغلاق">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="modal-body" id="technicianRatingsModalBody">
                        <div style="text-align: center; padding: 40px 20px;">
                            <i class="bi bi-arrow-repeat" style="font-size: 2.5em; color: var(--primary-color); margin-bottom: 20px; display: block; animation: spin 1s linear infinite;"></i>
                            <p style="margin-top: 15px; color: var(--text-light); font-size: 1.05em;">جاري تحميل التقييمات...</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="closeTechnicianRatingsModal()" class="btn btn-primary">
                            <i class="bi bi-check-circle"></i>
                            إغلاق
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        const title = document.getElementById('technicianRatingsModalTitle');
        const body = document.getElementById('technicianRatingsModalBody');
        
        if (!title || !body) return;
        
        title.innerHTML = `<i class="bi bi-star-fill"></i> تقييمات وآراء العملاء - ${escapeHtml(technicianName)}`;
        
        // إعادة تعيين pagination
        currentRatingsPage = 1;
        allRatings = [];
        
        // إظهار حالة التحميل
        body.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <i class="bi bi-arrow-repeat" style="font-size: 2.5em; color: var(--primary-color); margin-bottom: 20px; display: block; animation: spin 1s linear infinite;"></i>
                <p style="margin-top: 15px; color: var(--text-light); font-size: 1.05em;">جاري تحميل التقييمات...</p>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // جلب التقييمات التفصيلية من API (مع detailed=true)
        try {
            if (typeof window.API === 'undefined') {
                throw new Error('API غير متاح');
            }
            
            const result = await window.API.request(`repair-ratings.php?technician_id=${encodeURIComponent(technicianId)}&detailed=true`, 'GET');
            
            if (!result || !result.success) {
                throw new Error(result?.message || 'فشل جلب التقييمات');
            }
            
            allRatings = result.data || [];
            
            if (allRatings.length === 0) {
                body.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px;">
                        <i class="bi bi-inbox" style="font-size: 4em; color: var(--text-light); margin-bottom: 20px; display: block;"></i>
                        <p style="color: var(--text-light); font-size: 1.1em; margin: 0;">لا توجد تقييمات بعد</p>
                    </div>
                `;
                return;
            }
            
            // عرض الصفحة الأولى
            renderRatingsPage(1, allRatings);
            
        } catch (error) {
            console.error('❌ خطأ في جلب التقييمات:', error);
            body.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <i class="bi bi-exclamation-triangle" style="font-size: 4em; color: var(--danger-color); margin-bottom: 20px; display: block;"></i>
                    <p style="color: var(--danger-color); font-size: 1.1em; margin: 0;">حدث خطأ أثناء جلب التقييمات</p>
                    <p style="color: var(--text-light); font-size: 0.9em; margin-top: 10px;">${escapeHtml(error.message || 'خطأ غير معروف')}</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('❌ خطأ في فتح modal التقييمات:', error);
        if (typeof showTrackingMessage === 'function') {
            showTrackingMessage('حدث خطأ في فتح نموذج التقييمات', 'error');
        }
    }
}

// ✅ دالة لإغلاق modal التقييمات
function closeTechnicianRatingsModal() {
    const modal = document.getElementById('technicianRatingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ✅ تصدير الدوال للاستخدام الخارجي
window.refreshTracking = refreshTracking;
window.renderTrackingPage = renderTrackingPage;
window.submitRating = window.submitRating;
window.setRating = window.setRating;
window.skipRating = window.skipRating;
window.approveRepair = window.approveRepair;
window.rejectRepair = window.rejectRepair;
window.showTechnicianRatingsModal = showTechnicianRatingsModal;
window.closeTechnicianRatingsModal = closeTechnicianRatingsModal;

} // ✅ نهاية حماية من التحميل المكرر

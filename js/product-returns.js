// Product Returns System JavaScript
// ✅ حماية من التحميل المكرر
if (typeof window.productReturnsLoaded !== 'undefined') {
    console.warn('⚠️ product-returns.js تم تحميله مسبقاً - تخطي إعادة التحميل');
} else {
    window.productReturnsLoaded = true;

// Global State
let currentInvoice = null;
let returnItems = {}; // { sale_item_id: { selected: bool, quantity: int, is_damaged: bool } }
let allReturns = [];
let normalReturns = [];
let damagedReturns = [];
let productReturnsScannerOpen = false; // استخدام اسم فريد لتجنب التعارض مع repairs.js

// Pagination State
let normalReturnsCurrentPage = 1;
let damagedReturnsCurrentPage = 1;
const productReturnsItemsPerPage = 5;

// Load Product Returns Section
function loadProductReturnsSection() {
    const section = document.getElementById('product-returns-section');
    if (!section) return;
    
    section.innerHTML = `
        <div class="section-header">
            <h2>
                <i class="bi bi-arrow-return-left"></i> استرجاع المنتجات
                <div style="display: inline-flex; gap: 8px; margin-right: 15px;">
                    <i class="bi bi-phone" style="font-size: 20px; color: var(--primary-color);"></i>
                    <i class="bi bi-tablet" style="font-size: 20px; color: var(--secondary-color);"></i>
                    <i class="bi bi-smartwatch" style="font-size: 20px; color: var(--primary-color);"></i>
                </div>
            </h2>
        </div>

        <div class="product-returns-container" style="padding: 20px; box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: hidden;">
            <!-- Search Section -->
            <div class="search-section" style="background: var(--white); padding: 30px; border-radius: 12px; box-shadow: var(--shadow); margin-bottom: 30px; box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: hidden;">
                <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap; width: 100%; box-sizing: border-box;">
                    <div style="flex: 1; display: flex; align-items: center; gap: 15px; min-width: 0; box-sizing: border-box;">
                        <div style="position: relative; flex-shrink: 0;">
                            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect fill='%23333' x='10' y='20' width='40' height='30' rx='3'/%3E%3Cline stroke='%23f44336' stroke-width='2' x1='25' y1='35' x2='35' y2='35'/%3E%3Cline stroke='%23333' stroke-width='2' x1='15' y1='15' x2='15' y2='20'/%3E%3Cline stroke='%23333' stroke-width='2' x1='45' y1='15' x2='45' y2='20'/%3E%3C/svg%3E" 
                                 alt="ماسح باركود" style="width: 60px; height: 60px; max-width: 100%; box-sizing: border-box;">
                            <div style="position: absolute; top: 40px; left: 20px; width: 20px; height: 2px; background: #f44336; animation: pulse 1s infinite;"></div>
                        </div>
                        <div style="flex: 1; min-width: 0; box-sizing: border-box; width: 100%;">
                            <p style="margin: 0 0 10px 0; color: var(--text-dark); font-size: 16px; font-weight: 500; word-wrap: break-word; overflow-wrap: break-word;">
                                امسح أو أدخل الرقم الموجود على الفاتورة
                            </p>
                            <div style="display: flex; gap: 10px; width: 100%; box-sizing: border-box; flex-wrap: wrap;">
                                <input type="text" 
                                       id="invoiceSearchInput" 
                                       placeholder="رقم الفاتورة"
                                       style="flex: 1 1 auto; min-width: 150px; max-width: 100%; padding: 12px 15px; border: 2px solid var(--border-color); border-radius: 8px; font-size: 16px; outline: none; transition: border-color 0.3s; box-sizing: border-box; width: 100%;"
                                       onkeypress="if(event.key === 'Enter') searchInvoiceByNumber()">
                                <button onclick="searchInvoiceByNumber()" 
                                        class="btn btn-primary"
                                        style="padding: 12px 25px; background: var(--primary-color); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 16px; box-sizing: border-box; white-space: nowrap; flex-shrink: 0;">
                                    <i class="bi bi-search"></i> بحث
                                </button>
                                <button onclick="openQRCodeScanner()" 
                                        class="btn btn-secondary qr-scanner-btn"
                                        style="padding: 12px 24px; background: linear-gradient(135deg, var(--secondary-color) 0%, var(--primary-color) 100%); color: var(--white); border: none; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(33, 150, 243, 0.3); transition: all 0.3s ease; display: flex; align-items: center; gap: 8px; position: relative; overflow: hidden; box-sizing: border-box; white-space: nowrap; flex-shrink: 0;">
                                    <i class="bi bi-qr-code-scan" style="font-size: 18px;"></i>
                                    <span>مسح QR Code</span>
                                    <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); transition: left 0.5s;"></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Invoice Details Card -->
            <div id="invoiceDetailsCard" style="display: none; background: var(--white); padding: 30px; border-radius: 12px; box-shadow: var(--shadow); margin-bottom: 30px; box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: hidden;">
                <div style="display: flex; align-items: start; gap: 30px; flex-wrap: wrap; width: 100%; box-sizing: border-box;">
                    <div style="flex: 1; min-width: 0; box-sizing: border-box; width: 100%; overflow-x: hidden;">
                        <div style="margin-bottom: 20px; width: 100%; box-sizing: border-box; overflow-x: hidden;">
                            <h3 style="margin: 0 0 10px 0; color: var(--text-dark); font-size: 18px; font-weight: 600; word-wrap: break-word; overflow-wrap: break-word; width: 100%;">
                                رقم الفاتورة : <span id="invoiceNumberDisplay"></span>
                            </h3>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; width: 100%; box-sizing: border-box; flex-wrap: wrap;">
                                <div style="width: 24px; height: 24px; background: var(--primary-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--white); font-size: 14px; flex-shrink: 0; box-sizing: border-box;">
                                    <i class="bi bi-check"></i>
                                </div>
                                <p style="margin: 0; color: var(--text-dark); font-size: 16px; word-wrap: break-word; overflow-wrap: break-word; flex: 1; min-width: 0;">
                                    اسم العميل : <strong id="customerNameDisplay"></strong>
                                </p>
                            </div>
                        </div>

                        <div id="invoiceItemsList" style="margin-top: 20px;">
                            <!-- Items will be inserted here -->
                        </div>

                        <div style="margin-top: 25px; display: flex; gap: 10px; flex-wrap: wrap; width: 100%; box-sizing: border-box;">
                            <button onclick="returnAllItems()" 
                                    class="btn btn-secondary"
                                    style="padding: 10px 20px; background: var(--secondary-color); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 14px; box-sizing: border-box; white-space: nowrap; flex-shrink: 0;">
                                <i class="bi bi-check-all"></i> إرجاع الكل
                            </button>
                            <button onclick="clearAllItems()" 
                                    class="btn btn-secondary"
                                    style="padding: 10px 20px; background: var(--text-light); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 14px; box-sizing: border-box; white-space: nowrap; flex-shrink: 0;">
                                <i class="bi bi-x-circle"></i> إلغاء الكل
                            </button>
                        </div>

                        <button onclick="showRefundAmountModal()" 
                                id="completeReturnBtn"
                                class="btn btn-success"
                                style="width: 100%; max-width: 100%; margin-top: 25px; padding: 15px; background: var(--success-color); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: 600; display: none; box-sizing: border-box; word-wrap: break-word; overflow-wrap: break-word;">
                            <i class="bi bi-check-circle"></i> إتمام عملية الاسترجاع
                        </button>
                    </div>
                    <div style="width: 100px; max-width: 100%; cursor: pointer; flex-shrink: 0; box-sizing: border-box;" onclick="showInvoiceDetailsModal()" title="انقر لعرض تفاصيل الفاتورة">
                        <img id="invoiceThumbnail" 
                             src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='130' viewBox='0 0 150 200'%3E%3Crect fill='white' stroke='%23333' stroke-width='2' x='10' y='10' width='130' height='180'/%3E%3Cline stroke='%23333' stroke-width='1' x1='20' y1='30' x2='130' y2='30'/%3E%3Cline stroke='%23333' stroke-width='1' x1='20' y1='50' x2='130' y2='50'/%3E%3Cline stroke='%23333' stroke-width='1' x1='20' y1='70' x2='130' y2='70'/%3E%3Ctext x='75' y='140' text-anchor='middle' font-family='Arial' font-size='14' fill='%23333'%3Eإيصال%3C/text%3E%3C/svg%3E" 
                             alt="إيصال" 
                             style="width: 100%; height: auto; opacity: 0.8; border: 2px solid var(--border-color); border-radius: 8px; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                             onmouseover="this.style.opacity='1'; this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';"
                             onmouseout="this.style.opacity='0.8'; this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
                        <div style="text-align: center; margin-top: 8px; font-size: 12px; color: var(--text-light);">
                            <i class="bi bi-zoom-in"></i> عرض التفاصيل
                        </div>
                    </div>
                </div>
            </div>

            <!-- Returns Tables Section -->
            <div id="returnsTablesSection" style="margin-top: 40px;">
                <h3 style="margin-bottom: 20px; color: var(--text-dark); font-size: 20px; font-weight: 600;">
                    <i class="bi bi-list-ul"></i> قائمة المرتجعات
                </h3>
                <div style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px;">
                    <!-- Normal Returns Table -->
                    <div style="background: var(--white); border-radius: 12px; box-shadow: var(--shadow); padding: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--success-color); font-size: 18px; font-weight: 600;">
                            <i class="bi bi-check-circle"></i> المرتجعات العادية
                        </h4>
                        <div style="overflow-x: auto; overflow-y: visible; width: 100%; -webkit-overflow-scrolling: touch; position: relative;">
                            <table class="data-table" style="width: 100%; min-width: 600px; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: var(--light-bg);">
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">رقم الاسترجاع</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">رقم الفاتورة</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">العميل</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody id="normalReturnsTableBody">
                                    <tr>
                                        <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">
                                            لا توجد مرتجعات عادية
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <!-- Pagination for Normal Returns -->
                        <div id="normalReturnsPagination" style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <!-- Pagination will be inserted here -->
                        </div>
                    </div>

                    <!-- Damaged Returns Table -->
                    <div style="background: var(--white); border-radius: 12px; box-shadow: var(--shadow); padding: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--danger-color); font-size: 18px; font-weight: 600;">
                            <i class="bi bi-exclamation-triangle"></i> المرتجعات التالفة
                        </h4>
                        <div style="overflow-x: auto; overflow-y: visible; width: 100%; -webkit-overflow-scrolling: touch; position: relative;">
                            <table class="data-table" style="width: 100%; min-width: 600px; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: var(--light-bg);">
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">رقم الاسترجاع</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">رقم الفاتورة</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">العميل</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody id="damagedReturnsTableBody">
                                    <tr>
                                        <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">
                                            لا توجد مرتجعات تالفة
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <!-- Pagination for Damaged Returns -->
                        <div id="damagedReturnsPagination" style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <!-- Pagination will be inserted here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            /* قواعد عامة لمنع خروج العناصر خارج الإطار */
            .product-returns-container,
            .product-returns-container * {
                box-sizing: border-box;
            }
            
            .product-returns-container {
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
            }
            
            .product-returns-container .search-section,
            .product-returns-container .search-section * {
                max-width: 100%;
                box-sizing: border-box;
            }
            
            .product-returns-container input,
            .product-returns-container button,
            .product-returns-container .btn {
                max-width: 100%;
                box-sizing: border-box;
            }
            
            .product-returns-container p,
            .product-returns-container h3,
            .product-returns-container h4,
            .product-returns-container span {
                word-wrap: break-word;
                overflow-wrap: break-word;
                max-width: 100%;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            @keyframes shimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            
            .qr-scanner-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4) !important;
            }
            
            .qr-scanner-btn:hover > div:last-child {
                animation: shimmer 1s infinite;
            }
            
            .qr-scanner-btn:active {
                transform: translateY(0);
            }
            
            /* Table scrollbar styling */
            .product-returns-container [style*="overflow-x: auto"]::-webkit-scrollbar {
                height: 8px;
            }
            
            .product-returns-container [style*="overflow-x: auto"]::-webkit-scrollbar-track {
                background: var(--light-bg);
                border-radius: 4px;
            }
            
            .product-returns-container [style*="overflow-x: auto"]::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 4px;
            }
            
            .product-returns-container [style*="overflow-x: auto"]::-webkit-scrollbar-thumb:hover {
                background: var(--text-light);
            }
            
            /* Pagination button styling */
            .pagination-btn {
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                background: var(--white);
                color: var(--text-dark);
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
                min-width: 40px;
                text-align: center;
            }
            
            .pagination-btn:hover:not(:disabled) {
                background: var(--primary-color);
                color: var(--white);
                border-color: var(--primary-color);
            }
            
            .pagination-btn.active {
                background: var(--primary-color);
                color: var(--white);
                border-color: var(--primary-color);
                font-weight: 600;
            }
            
            .pagination-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .pagination-info {
                color: var(--text-light);
                font-size: 14px;
                padding: 0 10px;
            }
            
            /* Invoice thumbnail styling */
            #invoiceThumbnail {
                cursor: pointer;
            }
            
            @media (max-width: 768px) {
                /* تقليل الـ padding الرئيسي */
                .product-returns-container {
                    padding: 10px !important;
                    padding-bottom: 30px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    overflow-x: hidden !important;
                }
                
                /* تقليل padding في قسم البحث */
                .product-returns-container .search-section {
                    padding: 15px !important;
                    margin-bottom: 15px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    overflow-x: hidden !important;
                }
                
                /* جعل العناصر عمودية */
                .product-returns-container .search-section > div {
                    flex-direction: column !important;
                    gap: 15px !important;
                }
                
                .product-returns-container .search-section > div > div {
                    flex-direction: column !important;
                    gap: 10px !important;
                    width: 100% !important;
                }
                
                /* تصغير الصورة */
                .product-returns-container .search-section img[alt="ماسح باركود"] {
                    width: 40px !important;
                    height: 40px !important;
                }
                
                /* جعل حقل الإدخال والأزرار أصغر */
                .product-returns-container .search-section p {
                    font-size: 14px !important;
                    margin-bottom: 8px !important;
                }
                
                .product-returns-container .search-section > div > div > div {
                    flex-direction: row !important;
                    gap: 6px !important;
                    flex-wrap: wrap !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                
                .product-returns-container .search-section input {
                    flex: 1 1 60% !important;
                    min-width: 150px !important;
                    max-width: 100% !important;
                    padding: 10px 12px !important;
                    font-size: 14px !important;
                    box-sizing: border-box !important;
                    width: auto !important;
                }
                
                .product-returns-container .search-section button {
                    flex: 0 0 auto !important;
                    padding: 8px 10px !important;
                    font-size: 12px !important;
                    justify-content: center !important;
                    min-height: 38px !important;
                    min-width: 60px !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    white-space: nowrap !important;
                }
                
                /* تصغير زر QR */
                .qr-scanner-btn {
                    padding: 8px 10px !important;
                    font-size: 12px !important;
                    min-height: 38px !important;
                    min-width: 60px !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    white-space: nowrap !important;
                }
                
                .qr-scanner-btn i {
                    font-size: 14px !important;
                }
                
                .qr-scanner-btn span {
                    font-size: 12px !important;
                    display: none !important;
                }
                
                /* بطاقة تفاصيل الفاتورة */
                #invoiceDetailsCard {
                    padding: 15px !important;
                    margin-bottom: 15px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    overflow-x: hidden !important;
                    box-sizing: border-box !important;
                }
                
                #invoiceDetailsCard > div {
                    flex-direction: column !important;
                    gap: 15px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                
                #invoiceDetailsCard > div > div:first-child {
                    min-width: auto !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    overflow-x: hidden !important;
                }
                
                #invoiceDetailsCard > div > div:last-child {
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                
                #invoiceItemsList {
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    overflow-x: hidden !important;
                }
                
                #invoiceItemsList > div {
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    overflow-x: hidden !important;
                }
                
                /* العنوان والنصوص */
                #invoiceDetailsCard h3 {
                    font-size: 16px !important;
                }
                
                #invoiceDetailsCard p {
                    font-size: 14px !important;
                }
                
                /* الأزرار داخل بطاقة الفاتورة */
                #invoiceDetailsCard button {
                    padding: 8px 15px !important;
                    font-size: 13px !important;
                }
                
                /* صورة الفاتورة المصغرة */
                #invoiceDetailsCard > div > div:last-child {
                    width: 70px !important;
                    margin: 0 auto;
                }
                
                /* قسم الجداول */
                #returnsTablesSection {
                    padding-bottom: 30px !important;
                    margin-top: 20px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    overflow-x: hidden !important;
                    box-sizing: border-box !important;
                }
                
                #returnsTablesSection > div {
                    grid-template-columns: 1fr !important;
                    gap: 15px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                
                #returnsTablesSection h3 {
                    font-size: 16px !important;
                    margin-bottom: 15px !important;
                }
                
                #returnsTablesSection h4 {
                    font-size: 15px !important;
                    margin-bottom: 12px !important;
                }
                
                #returnsTablesSection > div > div {
                    padding: 15px !important;
                }
                
                /* جعل الجداول responsive تماماً - تحويل إلى بطاقات */
                #returnsTablesSection > div > div > div[style*="overflow-x"] {
                    overflow-x: visible !important;
                }
                
                .data-table {
                    width: 100% !important;
                    min-width: 100% !important;
                    max-width: 100% !important;
                    display: block !important;
                    border: none !important;
                }
                
                .data-table thead {
                    display: none !important;
                }
                
                .data-table tbody {
                    display: block !important;
                    width: 100% !important;
                }
                
                .data-table tbody tr {
                    display: block !important;
                    width: 100% !important;
                    margin-bottom: 12px !important;
                    background: var(--white) !important;
                    border: 1px solid var(--border-color) !important;
                    border-radius: 8px !important;
                    padding: 12px !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
                }
                
                .data-table tbody td {
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    padding: 10px 0 !important;
                    border: none !important;
                    border-bottom: 1px solid var(--light-bg) !important;
                    text-align: right !important;
                    font-size: 13px !important;
                    width: 100% !important;
                }
                
                .data-table tbody td:last-child {
                    border-bottom: none !important;
                }
                
                .data-table tbody td::before {
                    content: attr(data-label) !important;
                    font-weight: 600 !important;
                    color: var(--text-dark) !important;
                    margin-left: 12px !important;
                    flex-shrink: 0 !important;
                }
                
                /* معالجة حالة "لا توجد مرتجعات" */
                .data-table tbody tr td[colspan] {
                    display: block !important;
                    text-align: center !important;
                    padding: 20px !important;
                    border-bottom: none !important;
                }
                
                .data-table tbody tr td[colspan]::before {
                    content: none !important;
                }
            }
            
            @media (max-width: 576px) {
                /* شاشات الهواتف المتوسطة */
                .product-returns-container .search-section > div > div > div {
                    gap: 5px !important;
                }
                
                .product-returns-container .search-section input {
                    flex: 1 1 55% !important;
                    min-width: 120px !important;
                    padding: 9px 10px !important;
                    font-size: 13px !important;
                }
                
                .product-returns-container .search-section button {
                    padding: 7px 9px !important;
                    font-size: 11px !important;
                    min-height: 36px !important;
                    min-width: 55px !important;
                }
                
                .qr-scanner-btn {
                    padding: 7px 9px !important;
                    font-size: 11px !important;
                    min-height: 36px !important;
                    min-width: 55px !important;
                }
                
                .qr-scanner-btn i {
                    font-size: 13px !important;
                }
                
                .qr-scanner-btn span {
                    font-size: 11px !important;
                    display: none !important;
                }
            }
            
            @media (min-width: 481px) and (max-width: 768px) {
                /* إظهار النص على الشاشات المتوسطة */
                .qr-scanner-btn span {
                    display: inline !important;
                }
            }
            
            @media (max-width: 480px) {
                /* شاشات صغيرة جداً */
                .product-returns-container {
                    padding: 8px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    overflow-x: hidden !important;
                }
                
                .product-returns-container .search-section {
                    padding: 12px !important;
                    margin-bottom: 12px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    overflow-x: hidden !important;
                }
                
                .product-returns-container .search-section p {
                    font-size: 13px !important;
                }
                
                .product-returns-container .search-section img[alt="ماسح باركود"] {
                    width: 35px !important;
                    height: 35px !important;
                }
                
                .product-returns-container .search-section > div > div > div {
                    gap: 4px !important;
                }
                
                .product-returns-container .search-section input {
                    flex: 1 1 50% !important;
                    min-width: 100px !important;
                    padding: 8px 9px !important;
                    font-size: 13px !important;
                }
                
                .product-returns-container .search-section button {
                    padding: 6px 8px !important;
                    font-size: 11px !important;
                    min-height: 34px !important;
                    min-width: 50px !important;
                }
                
                .product-returns-container .search-section button i {
                    font-size: 12px !important;
                }
                
                /* تصغير الأزرار أكثر على الشاشات الصغيرة جداً */
                .product-returns-container .search-section button:not(.qr-scanner-btn) {
                    padding: 6px 8px !important;
                }
                
                /* تصغير زر QR على الشاشات الصغيرة جداً */
                .qr-scanner-btn {
                    padding: 6px 8px !important;
                    font-size: 11px !important;
                    min-height: 34px !important;
                    min-width: 50px !important;
                }
                
                .qr-scanner-btn i {
                    font-size: 12px !important;
                }
                
                .qr-scanner-btn span {
                    display: none !important;
                }
                
                #invoiceDetailsCard {
                    padding: 12px !important;
                }
                
                #invoiceDetailsCard h3 {
                    font-size: 15px !important;
                }
                
                #invoiceDetailsCard p {
                    font-size: 13px !important;
                }
                
                #invoiceDetailsCard > div > div:last-child {
                    width: 60px !important;
                }
                
                #returnsTablesSection h3 {
                    font-size: 15px !important;
                }
                
                #returnsTablesSection h4 {
                    font-size: 14px !important;
                }
                
                #returnsTablesSection > div > div {
                    padding: 12px !important;
                }
                
                .data-table tbody td {
                    font-size: 12px !important;
                    padding: 6px 0 !important;
                }
                
                #normalReturnsTableBody tr,
                #damagedReturnsTableBody tr {
                    padding: 10px !important;
                    margin-bottom: 10px !important;
                }
                
                #normalReturnsTableBody td,
                #damagedReturnsTableBody td {
                    font-size: 12px !important;
                    padding: 6px 0 !important;
                }
            }
        </style>
    `;
    
    // Load returns list
    loadReturnsList();
}

// Search Invoice by Number
async function searchInvoiceByNumber() {
    const input = document.getElementById('invoiceSearchInput');
    if (!input) return;
    
    const saleNumber = input.value.trim();
    if (!saleNumber) {
        showMessage('الرجاء إدخال رقم الفاتورة', 'error');
        return;
    }
    
    try {
        const response = await API.request(`product-returns.php?sale_number=${encodeURIComponent(saleNumber)}`, 'GET');
        
        if (response.success && response.data) {
            currentInvoice = response.data;
            returnItems = {};
            displayInvoiceDetails(response.data);
        } else {
            showMessage(response.message || 'الفاتورة غير موجودة', 'error');
            hideInvoiceDetails();
        }
    } catch (error) {
        console.error('خطأ في البحث عن الفاتورة:', error);
        showMessage('حدث خطأ أثناء البحث عن الفاتورة', 'error');
    }
}

// Display Invoice Details
function displayInvoiceDetails(invoiceData) {
    const card = document.getElementById('invoiceDetailsCard');
    const invoiceNumberDisplay = document.getElementById('invoiceNumberDisplay');
    const customerNameDisplay = document.getElementById('customerNameDisplay');
    const itemsList = document.getElementById('invoiceItemsList');
    const completeBtn = document.getElementById('completeReturnBtn');
    
    if (!card || !invoiceNumberDisplay || !customerNameDisplay || !itemsList) return;
    
    invoiceNumberDisplay.textContent = invoiceData.sale_number || invoiceData.id;
    customerNameDisplay.textContent = invoiceData.customer_name || 'غير محدد';
    
    // Clear previous items
    itemsList.innerHTML = '';
    
    if (!invoiceData.items || invoiceData.items.length === 0) {
        itemsList.innerHTML = '<p style="color: var(--text-light);">لا توجد منتجات في هذه الفاتورة</p>';
        return;
    }
    
    // Display items
    invoiceData.items.forEach((item, index) => {
        const itemId = item.id;
        const originalQuantity = parseInt(item.quantity) || 0;
        const returnedQuantity = parseInt(item.returned_quantity) || 0;
        const availableQuantity = parseInt(item.available_quantity) || 0;
        const isFullyReturned = item.is_fully_returned || false;
        
        const itemDiv = document.createElement('div');
        const isDisabled = isFullyReturned || availableQuantity <= 0;
        const disabledStyle = isDisabled ? 'opacity: 0.5; background: #f5f5f5;' : '';
        
        itemDiv.style.cssText = `display: flex; align-items: center; gap: 15px; padding: 15px; margin-bottom: 10px; background: var(--light-bg); border-radius: 8px; border: 2px solid var(--border-color); ${disabledStyle} width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden; flex-wrap: wrap;`;
        
        let quantityInfo = `الكمية: ${originalQuantity}`;
        if (returnedQuantity > 0) {
            quantityInfo += ` | مرتجع: ${returnedQuantity}`;
            if (availableQuantity > 0) {
                quantityInfo += ` | متاح: ${availableQuantity}`;
            } else {
                quantityInfo += ` | <span style="color: var(--danger-color); font-weight: bold;">تم الإرجاع بالكامل</span>`;
            }
        }
        
        itemDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: hidden;">
                <div style="width: 24px; height: 24px; background: ${isDisabled ? 'var(--text-light)' : 'var(--success-color)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--white); font-size: 14px; flex-shrink: 0; box-sizing: border-box;">
                    <i class="bi ${isDisabled ? 'bi-x-circle' : 'bi-check'}"></i>
                </div>
                <div style="flex: 1; min-width: 0; box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: hidden;">
                    <p style="margin: 0; color: var(--text-dark); font-size: 16px; font-weight: 500; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
                        ${escapeHtml(item.item_name)}
                    </p>
                    <p style="margin: 5px 0 0 0; color: var(--text-light); font-size: 14px; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
                        ${quantityInfo} | السعر: ${formatCurrency(item.unit_price)}
                    </p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap; box-sizing: border-box; width: 100%; max-width: 100%;">
                <label style="display: flex; align-items: center; gap: 5px; ${isDisabled ? 'cursor: not-allowed;' : 'cursor: pointer;'} flex-shrink: 0; box-sizing: border-box;">
                    <input type="checkbox" 
                           id="returnItem_${itemId}"
                           onchange="toggleReturnItem('${itemId}', ${availableQuantity})"
                           ${isDisabled ? 'disabled' : ''}
                           style="width: 20px; height: 20px; cursor: ${isDisabled ? 'not-allowed' : 'pointer'}; box-sizing: border-box; flex-shrink: 0;">
                    <span style="font-size: 14px; color: ${isDisabled ? 'var(--text-light)' : 'var(--text-dark)'}; white-space: nowrap;">
                        ${isDisabled ? 'تم الإرجاع' : 'إرجاع'}
                    </span>
                </label>
                <label style="display: flex; align-items: center; gap: 5px; ${isDisabled ? 'cursor: not-allowed;' : 'cursor: pointer;'} flex-shrink: 0; box-sizing: border-box;">
                    <input type="checkbox" 
                           id="damagedItem_${itemId}"
                           onchange="toggleItemDamaged('${itemId}')"
                           ${isDisabled ? 'disabled' : ''}
                           style="width: 20px; height: 20px; cursor: ${isDisabled ? 'not-allowed' : 'pointer'}; box-sizing: border-box; flex-shrink: 0;">
                    <span style="font-size: 14px; color: ${isDisabled ? 'var(--text-light)' : 'var(--danger-color)'}; white-space: nowrap;">
                        تالف
                    </span>
                </label>
                <input type="number" 
                       id="quantityInput_${itemId}"
                       min="1" 
                       max="${availableQuantity}" 
                       value="${availableQuantity > 0 ? availableQuantity : 0}"
                       onchange="setReturnQuantity('${itemId}', ${availableQuantity})"
                       style="width: 80px; max-width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; text-align: center; box-sizing: border-box; flex-shrink: 0;"
                       ${isDisabled ? 'disabled' : 'disabled'}>
            </div>
        `;
        itemsList.appendChild(itemDiv);
    });
    
    card.style.display = 'block';
    completeBtn.style.display = 'none';
}

// Hide Invoice Details
function hideInvoiceDetails() {
    const card = document.getElementById('invoiceDetailsCard');
    if (card) {
        card.style.display = 'none';
    }
    currentInvoice = null;
    returnItems = {};
}

// Show Invoice Details Modal
function showInvoiceDetailsModal() {
    if (!currentInvoice) {
        showMessage('لا توجد فاتورة لعرضها', 'info');
        return;
    }
    
    // Remove existing modal if any
    const existingModal = document.getElementById('invoiceDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'invoiceDetailsModal';
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); padding: 20px; overflow-y: auto;';
    
    // Format currency
    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toFixed(2) + ' ج.م';
    };
    
    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ar-EG', { 
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Cairo'
            });
        } catch (e) {
            return dateString;
        }
    };
    
    // Build items HTML
    let itemsHTML = '';
    if (currentInvoice.items && currentInvoice.items.length > 0) {
        itemsHTML = currentInvoice.items.map((item, index) => {
            const itemTotal = parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 0);
            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; text-align: center;">${index + 1}</td>
                    <td style="padding: 12px; text-align: right;">${escapeHtml(item.item_name || 'غير محدد')}</td>
                    <td style="padding: 12px; text-align: center;">${item.quantity || 0}</td>
                    <td style="padding: 12px; text-align: left;">${formatCurrency(item.unit_price)}</td>
                    <td style="padding: 12px; text-align: left;">${formatCurrency(itemTotal)}</td>
                </tr>
            `;
        }).join('');
    } else {
        itemsHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد منتجات</td></tr>';
    }
    
    // Calculate totals
    const totalAmount = parseFloat(currentInvoice.total_amount || 0);
    const discount = parseFloat(currentInvoice.discount || 0);
    const tax = parseFloat(currentInvoice.tax || 0);
    const finalAmount = parseFloat(currentInvoice.final_amount || totalAmount);
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; width: 100%; background: var(--white); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: modalSlideIn 0.3s ease; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%); color: var(--white); padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: none; flex-shrink: 0;">
                <h2 style="margin: 0; font-size: 1.5em; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                    <i class="bi bi-receipt-cutoff" style="font-size: 1.3em;"></i> تفاصيل الفاتورة
                </h2>
                <button onclick="closeInvoiceDetailsModal()" class="btn-close" style="background: rgba(255,255,255,0.2); border: none; color: var(--white); font-size: 2em; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; line-height: 1;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='rotate(0deg)';">&times;</button>
            </div>
            <div class="modal-body" style="padding: 30px; overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0; -webkit-overflow-scrolling: touch;">
                <!-- Invoice Info -->
                <div style="background: var(--light-bg); padding: 20px; border-radius: 12px; margin-bottom: 25px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--text-light); font-size: 14px;">رقم الفاتورة</p>
                            <p style="margin: 0; color: var(--text-dark); font-size: 18px; font-weight: 600;">${escapeHtml(currentInvoice.sale_number || currentInvoice.id || '-')}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--text-light); font-size: 14px;">اسم العميل</p>
                            <p style="margin: 0; color: var(--text-dark); font-size: 18px; font-weight: 600;">${escapeHtml(currentInvoice.customer_name || 'غير محدد')}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; color: var(--text-light); font-size: 14px;">التاريخ</p>
                            <p style="margin: 0; color: var(--text-dark); font-size: 16px;">${formatDate(currentInvoice.created_at || currentInvoice.sale_date)}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Items Table -->
                <div style="margin-bottom: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: var(--text-dark); font-size: 18px; font-weight: 600;">
                        <i class="bi bi-list-ul"></i> المنتجات
                    </h3>
                    <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                        <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                            <thead>
                                <tr style="background: var(--light-bg);">
                                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--border-color); white-space: nowrap;">#</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color); white-space: nowrap;">المنتج</th>
                                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--border-color); white-space: nowrap;">الكمية</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color); white-space: nowrap;">سعر الوحدة</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color); white-space: nowrap;">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Totals -->
                <div style="background: var(--light-bg); padding: 20px; border-radius: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="color: var(--text-dark); font-weight: 600;">المجموع الفرعي:</span>
                        <span style="color: var(--text-dark); font-weight: 600;">${formatCurrency(totalAmount)}</span>
                    </div>
                    ${discount > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="color: var(--text-dark);">الخصم:</span>
                        <span style="color: var(--danger-color);">-${formatCurrency(discount)}</span>
                    </div>
                    ` : ''}
                    ${tax > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="color: var(--text-dark);">الضريبة:</span>
                        <span style="color: var(--text-dark);">${formatCurrency(tax)}</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; padding-top: 15px; border-top: 2px solid var(--border-color); margin-top: 10px;">
                        <span style="color: var(--primary-color); font-size: 20px; font-weight: 700;">المجموع الكلي:</span>
                        <span style="color: var(--primary-color); font-size: 20px; font-weight: 700;">${formatCurrency(finalAmount)}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px 30px; border-top: 1px solid var(--border-color); background: var(--light-bg); flex-shrink: 0;">
                <button onclick="closeInvoiceDetailsModal()" class="btn btn-secondary" style="background: var(--text-light); color: var(--white); border: none; padding: 12px 24px; font-weight: 600; border-radius: 10px; transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.background='#555'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 102, 102, 0.4)';" onmouseout="this.style.background='var(--text-light)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <i class="bi bi-x-circle"></i> إغلاق
                </button>
            </div>
        </div>
        <style>
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .modal-body::-webkit-scrollbar {
                width: 8px;
            }
            
            .modal-body::-webkit-scrollbar-track {
                background: var(--light-bg);
                border-radius: 4px;
            }
            
            .modal-body::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 4px;
            }
            
            .modal-body::-webkit-scrollbar-thumb:hover {
                background: var(--text-light);
            }
            
            .modal-body {
                scrollbar-width: thin;
                scrollbar-color: var(--border-color) var(--light-bg);
            }
            
            @media (max-width: 768px) {
                .modal-content {
                    max-width: 95% !important;
                    max-height: 95vh !important;
                    margin: 10px;
                }
                
                .modal-body {
                    padding: 20px !important;
                }
                
                .modal-header {
                    padding: 20px !important;
                }
                
                .modal-header h2 {
                    font-size: 1.2em !important;
                }
                
                .modal-footer {
                    padding: 15px 20px !important;
                    flex-wrap: wrap;
                }
            }
        </style>
    `;
    
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeInvoiceDetailsModal();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeInvoiceDetailsModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Close Invoice Details Modal
function closeInvoiceDetailsModal() {
    const modal = document.getElementById('invoiceDetailsModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Toggle Return Item
function toggleReturnItem(itemId, maxQuantity) {
    const checkbox = document.getElementById(`returnItem_${itemId}`);
    const quantityInput = document.getElementById(`quantityInput_${itemId}`);
    const damagedCheckbox = document.getElementById(`damagedItem_${itemId}`);
    const completeBtn = document.getElementById('completeReturnBtn');
    
    if (!checkbox || !quantityInput) return;
    
    if (checkbox.checked) {
        if (!returnItems[itemId]) {
            returnItems[itemId] = {
                selected: true,
                quantity: parseInt(quantityInput.value) || maxQuantity,
                is_damaged: damagedCheckbox ? damagedCheckbox.checked : false
            };
        } else {
            returnItems[itemId].selected = true;
        }
        quantityInput.disabled = false;
    } else {
        if (returnItems[itemId]) {
            returnItems[itemId].selected = false;
        }
        quantityInput.disabled = true;
        // Also uncheck damaged checkbox when return is unchecked
        if (damagedCheckbox) {
            damagedCheckbox.checked = false;
            if (returnItems[itemId]) {
                returnItems[itemId].is_damaged = false;
            }
        }
    }
    
    // Show/hide complete button
    const hasSelectedItems = Object.values(returnItems).some(item => item.selected);
    
    if (completeBtn) {
        completeBtn.style.display = hasSelectedItems ? 'block' : 'none';
    }
}

// Set Return Quantity
function setReturnQuantity(itemId, maxQuantity) {
    const quantityInput = document.getElementById(`quantityInput_${itemId}`);
    if (!quantityInput) return;
    
    let quantity = parseInt(quantityInput.value) || 1;
    if (quantity < 1) quantity = 1;
    if (quantity > maxQuantity) quantity = maxQuantity;
    quantityInput.value = quantity;
    
    if (returnItems[itemId]) {
        returnItems[itemId].quantity = quantity;
    }
}

// Toggle Item Damaged
function toggleItemDamaged(itemId) {
    const checkbox = document.getElementById(`damagedItem_${itemId}`);
    if (!checkbox) return;
    
    const quantityInput = document.getElementById(`quantityInput_${itemId}`);
    const returnCheckbox = document.getElementById(`returnItem_${itemId}`);
    const completeBtn = document.getElementById('completeReturnBtn');
    
    // Get max quantity from the invoice item
    let maxQuantity = 1;
    if (currentInvoice && currentInvoice.items) {
        const invoiceItem = currentInvoice.items.find(i => i.id === itemId);
        if (invoiceItem) {
            maxQuantity = parseInt(invoiceItem.available_quantity) || 1;
        }
    }
    
    if (returnItems[itemId]) {
        // Update existing item
        returnItems[itemId].is_damaged = checkbox.checked;
        returnItems[itemId].selected = true; // Ensure it's selected when marked as damaged
    } else {
        // Initialize if not exists - add to returnItems when marked as damaged
        returnItems[itemId] = {
            selected: true,
            quantity: quantityInput ? parseInt(quantityInput.value || maxQuantity) : maxQuantity,
            is_damaged: checkbox.checked
        };
        
        // Also check the return checkbox and enable quantity input
        if (returnCheckbox) {
            returnCheckbox.checked = true;
        }
        if (quantityInput) {
            quantityInput.disabled = false;
            if (!quantityInput.value || parseInt(quantityInput.value) < 1) {
                quantityInput.value = maxQuantity;
            }
            returnItems[itemId].quantity = parseInt(quantityInput.value);
        }
    }
    
    // Show/hide complete button
    const hasSelectedItems = Object.values(returnItems).some(item => item.selected);
    
    if (completeBtn) {
        completeBtn.style.display = hasSelectedItems ? 'block' : 'none';
    }
}

// Return All Items
function returnAllItems() {
    if (!currentInvoice || !currentInvoice.items) return;
    
    currentInvoice.items.forEach(item => {
        const checkbox = document.getElementById(`returnItem_${item.id}`);
        const quantityInput = document.getElementById(`quantityInput_${item.id}`);
        
        if (checkbox && quantityInput) {
            checkbox.checked = true;
            quantityInput.value = item.quantity;
            quantityInput.disabled = false;
            
            returnItems[item.id] = {
                selected: true,
                quantity: item.quantity,
                is_damaged: false
            };
        }
    });
    
    const completeBtn = document.getElementById('completeReturnBtn');
    
    if (completeBtn) {
        completeBtn.style.display = 'block';
    }
}

// Clear All Items
function clearAllItems() {
    if (!currentInvoice || !currentInvoice.items) return;
    
    currentInvoice.items.forEach(item => {
        const checkbox = document.getElementById(`returnItem_${item.id}`);
        const damagedCheckbox = document.getElementById(`damagedItem_${item.id}`);
        const quantityInput = document.getElementById(`quantityInput_${item.id}`);
        
        if (checkbox) checkbox.checked = false;
        if (damagedCheckbox) damagedCheckbox.checked = false;
        if (quantityInput) {
            quantityInput.value = item.quantity;
            quantityInput.disabled = true;
        }
        
        delete returnItems[item.id];
    });
    
    const completeBtn = document.getElementById('completeReturnBtn');
    
    if (completeBtn) {
        completeBtn.style.display = 'none';
    }
}

// Show Refund Amount Modal
function showRefundAmountModal() {
    if (!currentInvoice) {
        showMessage('لا توجد فاتورة محددة', 'error');
        return;
    }
    
    // Prepare return items
    const itemsToReturn = [];
    for (const [itemId, itemData] of Object.entries(returnItems)) {
        if (itemData.selected) {
            const saleItem = currentInvoice.items.find(i => i.id === itemId);
            if (saleItem) {
                itemsToReturn.push({
                    sale_item_id: itemId,
                    returned_quantity: itemData.quantity,
                    is_damaged: itemData.is_damaged ? 1 : 0
                });
            }
        }
    }
    
    if (itemsToReturn.length === 0) {
        showMessage('الرجاء تحديد منتج واحد على الأقل للإرجاع', 'error');
        return;
    }
    
    // Validate quantities
    for (const item of itemsToReturn) {
        const saleItem = currentInvoice.items.find(i => i.id === item.sale_item_id);
        if (saleItem && item.returned_quantity > saleItem.quantity) {
            showMessage(`الكمية المراد إرجاعها (${item.returned_quantity}) أكبر من الكمية المباعة (${saleItem.quantity})`, 'error');
            return;
        }
    }
    
    // حساب إجمالي المبلغ المرتجع
    let totalReturnAmount = 0;
    itemsToReturn.forEach(item => {
        const saleItem = currentInvoice.items.find(i => i.id === item.sale_item_id);
        if (saleItem) {
            const itemTotal = parseFloat(saleItem.unit_price || 0) * item.returned_quantity;
            totalReturnAmount += itemTotal;
        }
    });
    
    // إنشاء modal
    const modal = document.createElement('div');
    modal.id = 'refundAmountModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);';
    modal.innerHTML = `
        <div style="background: var(--white); border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.2); animation: modalSlideIn 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="margin: 0; color: var(--text-dark); font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                    <i class="bi bi-cash-coin" style="color: var(--primary-color); font-size: 24px;"></i>
                    المبلغ المدفوع للعميل
                </h3>
                <button onclick="closeRefundAmountModal()" style="background: transparent; border: none; font-size: 28px; color: var(--text-light); cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.3s;" onmouseover="this.style.background='var(--light-bg)'; this.style.color='var(--text-dark)';" onmouseout="this.style.background='transparent'; this.style.color='var(--text-light)';">&times;</button>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background: var(--light-bg); border-radius: 8px; border-right: 3px solid var(--primary-color);">
                <p style="margin: 0 0 8px 0; color: var(--text-light); font-size: 14px;">إجمالي المبلغ المرتجع:</p>
                <p style="margin: 0; color: var(--text-dark); font-size: 20px; font-weight: 700;">${totalReturnAmount.toFixed(2)} ج.م</p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <label for="refundAmountInputModal" style="display: block; margin-bottom: 10px; color: var(--text-dark); font-size: 16px; font-weight: 600;">
                    <i class="bi bi-cash-stack"></i> المبلغ المدفوع للعميل (ج.م)
                </label>
                <input type="number" 
                       id="refundAmountInputModal"
                       min="0" 
                       step="0.01"
                       value="${totalReturnAmount.toFixed(2)}"
                       placeholder="0.00"
                       style="width: 100%; padding: 15px; border: 2px solid var(--border-color); border-radius: 8px; font-size: 18px; box-sizing: border-box; transition: all 0.3s ease;"
                       onfocus="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 0 0 3px rgba(33, 150, 243, 0.1)';"
                       onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none';"
                       onkeypress="if(event.key === 'Enter') confirmRefundAmount();">
                <p style="margin: 8px 0 0 0; color: var(--text-light); font-size: 13px;">
                    <i class="bi bi-info-circle"></i> سيتم خصم هذا المبلغ من خزنة الفرع
                </p>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="closeRefundAmountModal()" 
                        style="padding: 12px 24px; background: var(--text-light); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.3s;"
                        onmouseover="this.style.background='#555'; this.style.transform='translateY(-2px)';"
                        onmouseout="this.style.background='var(--text-light)'; this.style.transform='translateY(0)';">
                    <i class="bi bi-x-circle"></i> إلغاء
                </button>
                <button onclick="confirmRefundAmount()" 
                        style="padding: 12px 24px; background: var(--success-color); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.3s; display: flex; align-items: center; gap: 8px;"
                        onmouseover="this.style.background='#45a049'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(76, 175, 80, 0.4)';"
                        onmouseout="this.style.background='var(--success-color)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <i class="bi bi-check-circle"></i> تأكيد
                </button>
            </div>
        </div>
        <style>
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
        </style>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on input
    setTimeout(() => {
        const input = document.getElementById('refundAmountInputModal');
        if (input) {
            input.focus();
            input.select();
        }
    }, 100);
}

// Close Refund Amount Modal
function closeRefundAmountModal() {
    const modal = document.getElementById('refundAmountModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Confirm Refund Amount and Complete Return
async function confirmRefundAmount() {
    const refundAmountInput = document.getElementById('refundAmountInputModal');
    const refundAmount = refundAmountInput ? parseFloat(refundAmountInput.value) || 0 : 0;
    
    if (refundAmount < 0) {
        showMessage('المبلغ المدفوع للعميل لا يمكن أن يكون سالباً', 'error');
        return;
    }
    
    // Close modal
    closeRefundAmountModal();
    
    // Complete return with refund amount
    await completeReturn(refundAmount);
}

// Complete Return
async function completeReturn(refundAmount = 0) {
    if (!currentInvoice) {
        showMessage('لا توجد فاتورة محددة', 'error');
        return;
    }
    
    // Prepare return items
    const itemsToReturn = [];
    for (const [itemId, itemData] of Object.entries(returnItems)) {
        if (itemData.selected) {
            const saleItem = currentInvoice.items.find(i => i.id === itemId);
            if (saleItem) {
                itemsToReturn.push({
                    sale_item_id: itemId,
                    returned_quantity: itemData.quantity,
                    is_damaged: itemData.is_damaged ? 1 : 0
                });
            }
        }
    }
    
    if (itemsToReturn.length === 0) {
        showMessage('الرجاء تحديد منتج واحد على الأقل للإرجاع', 'error');
        return;
    }
    
    // Validate quantities
    for (const item of itemsToReturn) {
        const saleItem = currentInvoice.items.find(i => i.id === item.sale_item_id);
        if (saleItem && item.returned_quantity > saleItem.quantity) {
            showMessage(`الكمية المراد إرجاعها (${item.returned_quantity}) أكبر من الكمية المباعة (${saleItem.quantity})`, 'error');
            return;
        }
    }
    
    try {
        const response = await API.request('product-returns.php', 'POST', {
            sale_number: currentInvoice.sale_number || currentInvoice.id,
            items: itemsToReturn,
            notes: '',
            refund_amount: refundAmount
        });
        
        if (response.success) {
            showMessage('تم إتمام عملية الاسترجاع بنجاح', 'success');
            
            // Reset form
            hideInvoiceDetails();
            const input = document.getElementById('invoiceSearchInput');
            if (input) input.value = '';
            
            // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
            // Reload returns list and reset pagination
            normalReturnsCurrentPage = 1;
            damagedReturnsCurrentPage = 1;
            await loadReturnsList(true); // forceRefresh = true
        } else {
            showMessage(response.message || 'حدث خطأ أثناء عملية الاسترجاع', 'error');
        }
    } catch (error) {
        console.error('خطأ في إتمام عملية الاسترجاع:', error);
        showMessage('حدث خطأ أثناء عملية الاسترجاع', 'error');
    }
}

// Load Returns List
async function loadReturnsList(forceRefresh = false) {
    try {
        // Load all returns (skip cache if forceRefresh)
        const options = forceRefresh ? { silent: false, skipCache: true } : { silent: true };
        const response = await API.request('product-returns.php', 'GET', null, options);
        
        if (response.success && response.data) {
            allReturns = response.data;
            
            // Separate normal and damaged returns
            normalReturns = [];
            damagedReturns = [];
            
            allReturns.forEach(returnItem => {
                const hasDamagedItems = returnItem.items && returnItem.items.some(item => item.is_damaged == 1);
                if (hasDamagedItems) {
                    damagedReturns.push(returnItem);
                } else {
                    normalReturns.push(returnItem);
                }
            });
            
            displayReturnsTables();
        }
    } catch (error) {
        console.error('خطأ في جلب قائمة المرتجعات:', error);
    }
}

// Display Returns Tables with Pagination
function displayReturnsTables() {
    // Reset to first page if current page is out of bounds
    const normalTotalPages = Math.max(1, Math.ceil(normalReturns.length / productReturnsItemsPerPage));
    const damagedTotalPages = Math.max(1, Math.ceil(damagedReturns.length / productReturnsItemsPerPage));
    
    if (normalReturnsCurrentPage > normalTotalPages) {
        normalReturnsCurrentPage = 1;
    }
    if (damagedReturnsCurrentPage > damagedTotalPages) {
        damagedReturnsCurrentPage = 1;
    }
    
    // Calculate pagination
    const normalStartIndex = (normalReturnsCurrentPage - 1) * productReturnsItemsPerPage;
    const normalEndIndex = normalStartIndex + productReturnsItemsPerPage;
    const normalPaginatedReturns = normalReturns.slice(normalStartIndex, normalEndIndex);
    
    const damagedStartIndex = (damagedReturnsCurrentPage - 1) * productReturnsItemsPerPage;
    const damagedEndIndex = damagedStartIndex + productReturnsItemsPerPage;
    const damagedPaginatedReturns = damagedReturns.slice(damagedStartIndex, damagedEndIndex);
    
    const normalTableBody = document.getElementById('normalReturnsTableBody');
    const damagedTableBody = document.getElementById('damagedReturnsTableBody');
    
    // Display normal returns
    if (normalTableBody) {
        if (normalReturns.length === 0) {
            normalTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">
                        لا توجد مرتجعات عادية
                    </td>
                </tr>
            `;
        } else {
            normalTableBody.innerHTML = normalPaginatedReturns.map(returnItem => {
                return `
                    <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s ease;" onmouseover="this.style.background='var(--light-bg)';" onmouseout="this.style.background='';">
                        <td style="padding: 12px; white-space: nowrap;">${escapeHtml(returnItem.return_number)}</td>
                        <td style="padding: 12px; white-space: nowrap;">${escapeHtml(returnItem.sale_number)}</td>
                        <td style="padding: 12px; white-space: nowrap;">${escapeHtml(returnItem.customer_name || 'غير محدد')}</td>
                        <td style="padding: 12px; white-space: nowrap;">${formatDate(returnItem.created_at)}</td>
                    </tr>
                `;
            }).join('');
        }
        
        // Update pagination for normal returns
        updatePagination('normal', normalReturnsCurrentPage, normalTotalPages, normalReturns.length);
    }
    
    // Display damaged returns
    if (damagedTableBody) {
        if (damagedReturns.length === 0) {
            damagedTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">
                        لا توجد مرتجعات تالفة
                    </td>
                </tr>
            `;
        } else {
            damagedTableBody.innerHTML = damagedPaginatedReturns.map(returnItem => {
                return `
                    <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s ease;" onmouseover="this.style.background='var(--light-bg)';" onmouseout="this.style.background='';">
                        <td data-label="رقم الاسترجاع" style="padding: 12px; white-space: nowrap;">${escapeHtml(returnItem.return_number)}</td>
                        <td data-label="رقم الفاتورة" style="padding: 12px; white-space: nowrap;">${escapeHtml(returnItem.sale_number)}</td>
                        <td data-label="العميل" style="padding: 12px; white-space: nowrap;">${escapeHtml(returnItem.customer_name || 'غير محدد')}</td>
                        <td data-label="التاريخ" style="padding: 12px; white-space: nowrap;">${formatDate(returnItem.created_at)}</td>
                    </tr>
                `;
            }).join('');
        }
        
        // Update pagination for damaged returns
        updatePagination('damaged', damagedReturnsCurrentPage, damagedTotalPages, damagedReturns.length);
    }
}

// Update Pagination Controls
function updatePagination(type, currentPage, totalPages, totalItems) {
    const paginationContainer = document.getElementById(`${type}ReturnsPagination`);
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                عرض ${totalItems} من ${totalItems} عملية
            </div>
        `;
        return;
    }
    
    const startItem = ((currentPage - 1) * productReturnsItemsPerPage) + 1;
    const endItem = Math.min(currentPage * productReturnsItemsPerPage, totalItems);
    
    let paginationHTML = `
        <button class="pagination-btn" onclick="changePage('${type}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="bi bi-chevron-right"></i>
        </button>
    `;
    
    // Show page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `
            <button class="pagination-btn" onclick="changePage('${type}', 1)">1</button>
            ${startPage > 2 ? '<span class="pagination-info">...</span>' : ''}
        `;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage('${type}', ${i})">
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        paginationHTML += `
            ${endPage < totalPages - 1 ? '<span class="pagination-info">...</span>' : ''}
            <button class="pagination-btn" onclick="changePage('${type}', ${totalPages})">${totalPages}</button>
        `;
    }
    
    paginationHTML += `
        <button class="pagination-btn" onclick="changePage('${type}', ${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="bi bi-chevron-left"></i>
        </button>
        <div class="pagination-info">
            عرض ${startItem}-${endItem} من ${totalItems} عملية
        </div>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

// Change Page
function changePage(type, page) {
    if (type === 'normal') {
        const totalPages = Math.max(1, Math.ceil(normalReturns.length / productReturnsItemsPerPage));
        if (page >= 1 && page <= totalPages) {
            normalReturnsCurrentPage = page;
            displayReturnsTables();
            
            // Scroll table into view
            const tableContainer = document.querySelector('#normalReturnsTableBody')?.closest('[style*="overflow-x"]');
            if (tableContainer) {
                tableContainer.scrollLeft = 0;
            }
        }
    } else if (type === 'damaged') {
        const totalPages = Math.max(1, Math.ceil(damagedReturns.length / productReturnsItemsPerPage));
        if (page >= 1 && page <= totalPages) {
            damagedReturnsCurrentPage = page;
            displayReturnsTables();
            
            // Scroll table into view
            const tableContainer = document.querySelector('#damagedReturnsTableBody')?.closest('[style*="overflow-x"]');
            if (tableContainer) {
                tableContainer.scrollLeft = 0;
            }
        }
    }
}

// Make changePage available globally
if (typeof window !== 'undefined') {
    window.changePage = changePage;
}

// Open QR Code Scanner (for invoice QR codes)
async function openQRCodeScanner() {
    if (productReturnsScannerOpen) {
        showMessage('قارئ QR Code مفتوح بالفعل', 'info');
        return;
    }
    
    const existingModal = document.getElementById('qrCodeScannerModal');
    if (existingModal) {
        showMessage('قارئ QR Code مفتوح بالفعل', 'info');
        return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showMessage('الكاميرا غير متوفرة في هذا المتصفح', 'error');
        return;
    }
    
    // Load html5-qrcode library
    if (typeof Html5Qrcode === 'undefined') {
        if (typeof window.loadHtml5Qrcode === 'function') {
            try {
                await window.loadHtml5Qrcode();
            } catch (error) {
                console.error('Error loading html5-qrcode:', error);
                showMessage('فشل تحميل مكتبة قراءة QR Code', 'error');
                return;
            }
        } else {
            showMessage('مكتبة قراءة QR Code غير متاحة', 'error');
            return;
        }
    }
    
    productReturnsScannerOpen = true;
    
    const scannerModal = document.createElement('div');
    scannerModal.id = 'qrCodeScannerModal';
    scannerModal.className = 'modal';
    scannerModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);';
    scannerModal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-width: 600px; width: 100%; max-height: 90vh; background: var(--white); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: modalSlideIn 0.3s ease; display: flex; flex-direction: column;">
            <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%); color: var(--white); padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: none; flex-shrink: 0;">
                <h2 style="margin: 0; font-size: 1.5em; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                    <i class="bi bi-qr-code-scan" style="font-size: 1.3em;"></i> قارئ QR Code للفواتير
                </h2>
                <button onclick="closeQRCodeScannerForReturns()" class="btn-close" style="background: rgba(255,255,255,0.2); border: none; color: var(--white); font-size: 2em; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; line-height: 1;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='rotate(0deg)';">&times;</button>
            </div>
            <div class="modal-body" style="padding: 30px; overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0; -webkit-overflow-scrolling: touch;">
                <div id="qr-scanner-container" style="text-align: center;">
                    <div id="qr-reader" style="width: 100%; min-height: 400px; border-radius: 15px; overflow: hidden; background: var(--light-bg); position: relative; box-shadow: inset 0 2px 10px rgba(0,0,0,0.1);">
                        <div id="scanner-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; text-align: center; color: var(--text-dark);">
                            <i class="bi bi-camera" style="font-size: 3em; color: var(--primary-color); margin-bottom: 15px; display: block; animation: pulse 2s infinite;"></i>
                            <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">جاري تحميل قارئ QR Code...</p>
                            <p style="font-size: 0.9em; color: var(--text-light); margin-top: 10px;">يرجى السماح بالوصول إلى الكاميرا</p>
                        </div>
                        <div id="scanner-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 250px; height: 250px; border: 3px solid var(--primary-color); border-radius: 20px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5), 0 0 30px rgba(33, 150, 243, 0.5);"></div>
                            <div style="position: absolute; top: calc(50% - 125px); left: calc(50% - 125px); width: 250px; height: 250px;">
                                <div style="position: absolute; top: 0; left: 0; width: 30px; height: 30px; border-top: 4px solid var(--primary-color); border-right: 4px solid var(--primary-color); border-radius: 5px 20px 0 0;"></div>
                                <div style="position: absolute; top: 0; right: 0; width: 30px; height: 30px; border-top: 4px solid var(--primary-color); border-left: 4px solid var(--primary-color); border-radius: 20px 5px 0 0;"></div>
                                <div style="position: absolute; bottom: 0; left: 0; width: 30px; height: 30px; border-bottom: 4px solid var(--primary-color); border-right: 4px solid var(--primary-color); border-radius: 0 0 20px 5px;"></div>
                                <div style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; border-bottom: 4px solid var(--primary-color); border-left: 4px solid var(--primary-color); border-radius: 0 0 5px 20px;"></div>
                            </div>
                        </div>
                    </div>
                    <div id="scanner-result" style="margin-top: 25px; display: none; animation: slideDown 0.4s ease;">
                        <div style="padding: 25px; border-radius: 15px; background: linear-gradient(135deg, var(--success-color) 0%, #66BB6A 100%); color: var(--white); border: none; box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4);">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                                <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <i class="bi bi-check-circle-fill" style="font-size: 2em;"></i>
                                </div>
                                <h4 style="margin: 0; font-size: 1.4em; font-weight: 700;">تم قراءة QR Code بنجاح!</h4>
                            </div>
                            <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 12px; margin-bottom: 20px; backdrop-filter: blur(10px);">
                                <p style="margin: 0 0 10px 0; font-size: 0.95em; opacity: 0.9; font-weight: 500;">رقم الفاتورة:</p>
                                <p id="scanned-invoice-number" style="margin: 0; font-size: 1.8em; font-weight: 700; letter-spacing: 2px; font-family: 'Courier New', monospace;"></p>
                                <div id="scanned-invoice-details" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3); display: none;">
                                    <p id="scanned-invoice-date" style="margin: 5px 0; font-size: 0.9em; opacity: 0.9;"></p>
                                    <p id="scanned-invoice-total" style="margin: 5px 0; font-size: 0.9em; opacity: 0.9;"></p>
                                </div>
                            </div>
                            <button onclick="useScannedInvoiceNumber()" class="btn btn-primary" style="background: var(--white); color: var(--success-color); border: 2px solid var(--white); padding: 14px 30px; font-weight: 700; border-radius: 10px; width: 100%; transition: all 0.3s ease; font-size: 1.1em; display: flex; align-items: center; justify-content: center; gap: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(255,255,255,0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                                <i class="bi bi-search"></i> البحث عن الفاتورة
                            </button>
                        </div>
                    </div>
                    <div id="scanner-error" style="margin-top: 25px; display: none; animation: slideDown 0.4s ease;">
                        <div style="padding: 25px; border-radius: 15px; background: linear-gradient(135deg, var(--danger-color) 0%, #e57373 100%); color: var(--white); border: none; box-shadow: 0 8px 25px rgba(244, 67, 54, 0.4);">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                                <i class="bi bi-exclamation-triangle-fill" style="font-size: 2em;"></i>
                                <h4 style="margin: 0; font-size: 1.3em; font-weight: 700;">خطأ في المسح</h4>
                            </div>
                            <p id="scanner-error-message" style="margin: 0; line-height: 1.8; opacity: 0.95;"></p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px 30px; border-top: 1px solid var(--border-color); background: var(--light-bg); flex-shrink: 0;">
                <button onclick="retryQRCodeScannerForReturns()" class="btn btn-warning" style="background: var(--warning-color); color: var(--white); border: none; padding: 12px 24px; font-weight: 600; border-radius: 10px; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255, 165, 0, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                </button>
                <button onclick="closeQRCodeScannerForReturns()" class="btn btn-secondary" style="background: var(--text-light); color: var(--white); border: none; padding: 12px 24px; font-weight: 600; border-radius: 10px; transition: all 0.3s ease;" onmouseover="this.style.background='#555'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 102, 102, 0.4)';" onmouseout="this.style.background='var(--text-light)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    إغلاق
                </button>
            </div>
        </div>
        <style>
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-15px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            #qr-reader video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 15px;
            }
            
            #qr-reader canvas {
                display: none;
            }
            
            /* Scrollbar styling for modal body */
            .modal-body::-webkit-scrollbar {
                width: 8px;
            }
            
            .modal-body::-webkit-scrollbar-track {
                background: var(--light-bg);
                border-radius: 4px;
            }
            
            .modal-body::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 4px;
            }
            
            .modal-body::-webkit-scrollbar-thumb:hover {
                background: var(--text-light);
            }
            
            /* Firefox scrollbar */
            .modal-body {
                scrollbar-width: thin;
                scrollbar-color: var(--border-color) var(--light-bg);
            }
            
            @media (max-width: 768px) {
                .modal-content {
                    max-width: 95% !important;
                    max-height: 95vh !important;
                    margin: 10px;
                }
                
                #qr-reader {
                    min-height: 300px !important;
                }
                
                #scanner-overlay > div:first-child {
                    width: 200px !important;
                    height: 200px !important;
                }
                
                #scanner-overlay > div:last-child {
                    width: 200px !important;
                    height: 200px !important;
                    top: calc(50% - 100px) !important;
                    left: calc(50% - 100px) !important;
                }
                
                .modal-body {
                    padding: 20px !important;
                }
                
                .modal-header {
                    padding: 20px !important;
                }
                
                .modal-footer {
                    padding: 15px 20px !important;
                    flex-wrap: wrap;
                }
            }
            
            @media (max-width: 480px) {
                .modal-content {
                    max-width: 100% !important;
                    max-height: 100vh !important;
                    margin: 0;
                    border-radius: 0;
                }
                
                .modal-header h2 {
                    font-size: 1.2em !important;
                }
            }
        </style>
    `;
    
    document.body.appendChild(scannerModal);
    
    // Add event listener to close button (backup in case onclick doesn't work)
    setTimeout(() => {
        const closeBtn = scannerModal.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeQRCodeScannerForReturns();
            });
        }
        
        // Also add listener to footer close button
        const footerCloseBtn = scannerModal.querySelector('.modal-footer .btn-secondary');
        if (footerCloseBtn && footerCloseBtn.textContent.includes('إغلاق')) {
            footerCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeQRCodeScannerForReturns();
            });
        }
        
        // Close on backdrop click (optional - can be enabled if needed)
        scannerModal.addEventListener('click', (e) => {
            if (e.target === scannerModal) {
                // Uncomment to enable close on backdrop click
                // closeQRCodeScannerForReturns();
            }
        });
        
        initializeQRCodeScannerForReturns();
    }, 300);
}

// Keep old function name for backward compatibility
function openBarcodeScanner() {
    openQRCodeScanner();
}

// Global variable to store QR code scanner instance
// ✅ استخدام window لتجنب إعادة التصريح عند إعادة تحميل الملف
if (typeof window.qrCodeScannerInstance === 'undefined') {
    window.qrCodeScannerInstance = null;
}
let qrCodeScannerInstance = window.qrCodeScannerInstance;

// Initialize QR Code Scanner for Returns
async function initializeQRCodeScannerForReturns() {
    const qrReader = document.getElementById('qr-reader');
    const loadingDiv = document.getElementById('scanner-loading');
    const errorDiv = document.getElementById('scanner-error');
    const resultDiv = document.getElementById('scanner-result');
    
    if (!qrReader) return;
    
    // Hide error and result initially
    if (errorDiv) errorDiv.style.display = 'none';
    if (resultDiv) resultDiv.style.display = 'none';
    
    // Check if Html5Qrcode is loaded
    if (typeof Html5Qrcode === 'undefined') {
        if (loadingDiv) {
            loadingDiv.innerHTML = '<i class="bi bi-exclamation-triangle" style="font-size: 3em; color: var(--danger-color); margin-bottom: 15px; display: block;"></i><p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">خطأ: مكتبة QR Code غير متاحة</p>';
        }
        return;
    }
    
    try {
        // Create scanner instance
        qrCodeScannerInstance = new Html5Qrcode("qr-reader");
        
        // Configuration for QR code scanning
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false
        };
        
        // Add supportedScanTypes if available (newer versions)
        if (typeof Html5QrcodeScanType !== 'undefined') {
            config.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
        }
        
        // ✅ التحقق من صلاحية الكاميرا قبل البدء (لتجنب طلب الصلاحية مرة أخرى)
        if (typeof window.checkCameraPermission === 'function') {
            const permissionState = await window.checkCameraPermission();
            if (permissionState === 'denied') {
                const loadingDiv = document.getElementById('scanner-loading');
                if (loadingDiv) {
                    loadingDiv.innerHTML = `
                        <i class="bi bi-exclamation-triangle" style="font-size: 3em; color: var(--danger-color); margin-bottom: 15px; display: block;"></i>
                        <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">تم رفض صلاحية الكاميرا</p>
                        <p style="font-size: 0.9em; color: var(--text-light); margin-top: 10px;">يرجى السماح بالوصول إلى الكاميرا في إعدادات المتصفح</p>
                    `;
                }
                return;
            }
        }
        
        // Start scanning
        await qrCodeScannerInstance.start(
            { facingMode: "environment" }, // Use back camera
            config,
            (decodedText, decodedResult) => {
                // Success callback
                handleQRCodeScanned(decodedText);
            },
            (errorMessage) => {
                // Error callback (ignore continuous errors while scanning)
                // Only show errors for actual failures, not during normal scanning
            }
        );
        
        // Hide loading indicator once scanner starts
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error initializing QR code scanner:', error);
        
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <i class="bi bi-exclamation-triangle" style="font-size: 3em; color: var(--danger-color); margin-bottom: 15px; display: block;"></i>
                <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">خطأ في بدء الكاميرا</p>
                <p style="font-size: 0.9em; color: var(--text-light); margin-top: 10px;">${error.message || 'يرجى التحقق من أذونات الكاميرا'}</p>
            `;
        }
        
        if (errorDiv) {
            const errorMessage = document.getElementById('scanner-error-message');
            if (errorMessage) {
                errorMessage.textContent = error.message || 'فشل في الوصول إلى الكاميرا. يرجى التحقق من الأذونات والمحاولة مرة أخرى.';
            }
            errorDiv.style.display = 'block';
        }
    }
}

// Handle scanned QR code
function handleQRCodeScanned(decodedText) {
    // Stop scanning immediately after successful scan
    if (qrCodeScannerInstance) {
        qrCodeScannerInstance.stop().then(() => {
            console.log('QR Code scanner stopped');
        }).catch((err) => {
            console.error('Error stopping scanner:', err);
        });
    }
    
    let invoiceNumber = null;
    let invoiceDate = null;
    let invoiceTotal = null;
    
    // Try to parse as JSON (invoice QR code format)
    try {
        const qrData = JSON.parse(decodedText);
        
        // Extract invoice number from JSON
        if (qrData.invoice_number) {
            invoiceNumber = qrData.invoice_number;
        } else if (qrData.invoice_id) {
            invoiceNumber = qrData.invoice_id;
        }
        
        // Extract additional info if available
        if (qrData.date) invoiceDate = qrData.date;
        if (qrData.total) invoiceTotal = qrData.total;
        
    } catch (e) {
        // If not JSON, treat as plain text (invoice number)
        invoiceNumber = decodedText.trim();
    }
    
    // If we still don't have an invoice number, use the decoded text
    if (!invoiceNumber) {
        invoiceNumber = decodedText.trim();
    }
    
    // Display result
    const resultDiv = document.getElementById('scanner-result');
    const invoiceNumberSpan = document.getElementById('scanned-invoice-number');
    const invoiceDetailsDiv = document.getElementById('scanned-invoice-details');
    const invoiceDateSpan = document.getElementById('scanned-invoice-date');
    const invoiceTotalSpan = document.getElementById('scanned-invoice-total');
    
    if (resultDiv && invoiceNumberSpan) {
        invoiceNumberSpan.textContent = invoiceNumber;
        
        // Show additional details if available
        if (invoiceDetailsDiv && (invoiceDate || invoiceTotal)) {
            if (invoiceDate && invoiceDateSpan) {
                invoiceDateSpan.textContent = `التاريخ: ${invoiceDate}`;
            }
            if (invoiceTotal && invoiceTotalSpan) {
                invoiceTotalSpan.textContent = `المجموع: ${parseFloat(invoiceTotal).toFixed(2)} ج.م`;
            }
            invoiceDetailsDiv.style.display = 'block';
        } else if (invoiceDetailsDiv) {
            invoiceDetailsDiv.style.display = 'none';
        }
        
        resultDiv.style.display = 'block';
        
        // Hide loading indicator
        const loadingDiv = document.getElementById('scanner-loading');
        if (loadingDiv) loadingDiv.style.display = 'none';
        
        // Play success sound (optional)
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUBAOUKbk8LlqIQUsg8/y1ok4CBlpu+7nm08QDE+n4/C1ZBwGOJHW8sx5LAUkd8fw3Y9AChRftOjrp1QUCkaf4PK+bCEFL4fR89OCMwYebsDv45lQEA5QpuTwuWohBSuDz/LWiTgIGWm77uebTxAMT6fj8LVkHAY4kdbyzHksBSR3x/Ddj0AKFF+06OunVBQKRp/g8r5sIQUvh9Hz04IzBh5uwO/jmVAQDlCm5PC5aiEFK4PP8taJOAgZabvu55tPEAxPp+PwtWQcBjiR1vLMeSwFJHfH8N2PQAoUX7To66dUFApGn+DyvmwhBS+H0fPTgjMGHm7A7+OZUA8=');
            audio.volume = 0.3;
            audio.play().catch(() => {}); // Ignore audio play errors
        } catch (e) {
            // Ignore audio errors
        }
        
        // البحث تلقائياً عن الفاتورة بعد مسح QR code
        // استخدام setTimeout لإعطاء فرصة لعرض النتيجة أولاً
        setTimeout(() => {
            try {
                // التحقق من وجود حقل البحث قبل الاستخدام
                const input = document.getElementById('invoiceSearchInput');
                if (input && invoiceNumber) {
                    input.value = invoiceNumber;
                    closeQRCodeScannerForReturns();
                    // البحث عن الفاتورة
                    if (typeof searchInvoiceByNumber === 'function') {
                        searchInvoiceByNumber();
                    }
                } else {
                    // إذا لم يكن الحقل موجوداً، استخدام الدالة القديمة
                    if (typeof useScannedInvoiceNumber === 'function') {
                        useScannedInvoiceNumber();
                    }
                }
            } catch (error) {
                console.error('Error in auto-search after QR scan:', error);
                // في حالة الخطأ، محاولة استخدام الدالة القديمة
                if (typeof useScannedInvoiceNumber === 'function') {
                    useScannedInvoiceNumber();
                }
            }
        }, 800); // انتظار 800ms لإعطاء فرصة لرؤية النتيجة
    }
}

// Close QR Code Scanner
function closeQRCodeScannerForReturns() {
    try {
        // Stop scanner if running
        if (qrCodeScannerInstance) {
            // Use a timeout to ensure we don't wait too long
            const stopPromise = qrCodeScannerInstance.stop().catch((err) => {
                console.error('Error stopping QR scanner:', err);
            });
            
            // Clear scanner after stopping
            stopPromise.finally(() => {
                try {
                    if (qrCodeScannerInstance) {
                        qrCodeScannerInstance.clear().catch(() => {
                            // Ignore clear errors
                        });
                    }
                } catch (e) {
                    // Ignore clear errors
                }
                qrCodeScannerInstance = null;
            });
            
            // Don't wait for promise, continue to close modal
            setTimeout(() => {
                qrCodeScannerInstance = null;
            }, 100);
        }
        
        // Remove modal immediately
        const modal = document.getElementById('qrCodeScannerModal');
        if (modal) {
            // Add fade out animation
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                modal.remove();
            }, 300);
        } else {
            // If modal not found by ID, try to find by class
            const modals = document.querySelectorAll('.modal');
            modals.forEach(m => {
                if (m.id === 'qrCodeScannerModal' || m.querySelector('#qr-reader')) {
                    m.style.opacity = '0';
                    m.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        m.remove();
                    }, 300);
                }
            });
        }
        
        // Reset state
        productReturnsScannerOpen = false;
        
        // Stop any video streams that might still be running
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                stream.getTracks().forEach(track => track.stop());
            }).catch(() => {
                // Ignore errors
            });
        }
        
    } catch (error) {
        console.error('Error in closeQRCodeScannerForReturns:', error);
        // Force close even if there's an error
        const modal = document.getElementById('qrCodeScannerModal');
        if (modal) {
            modal.remove();
        }
        productReturnsScannerOpen = false;
        qrCodeScannerInstance = null;
    }
}

// Retry QR Code Scanner
function retryQRCodeScannerForReturns() {
    closeQRCodeScannerForReturns();
    setTimeout(() => {
        openQRCodeScanner();
    }, 300);
}

// Use Scanned Invoice Number
function useScannedInvoiceNumber() {
    const invoiceNumberSpan = document.getElementById('scanned-invoice-number');
    if (invoiceNumberSpan) {
        const input = document.getElementById('invoiceSearchInput');
        if (input) {
            input.value = invoiceNumberSpan.textContent;
            closeQRCodeScannerForReturns();
            searchInvoiceByNumber();
        }
    }
}

// Keep old function names for backward compatibility
function closeBarcodeScannerForReturns() {
    closeQRCodeScannerForReturns();
}

function retryBarcodeScannerForReturns() {
    retryQRCodeScannerForReturns();
}

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.loadProductReturnsSection = loadProductReturnsSection;
    window.searchInvoiceByNumber = searchInvoiceByNumber;
    window.toggleReturnItem = toggleReturnItem;
    window.setReturnQuantity = setReturnQuantity;
    window.toggleItemDamaged = toggleItemDamaged;
    window.returnAllItems = returnAllItems;
    window.clearAllItems = clearAllItems;
    window.showRefundAmountModal = showRefundAmountModal;
    window.closeRefundAmountModal = closeRefundAmountModal;
    window.confirmRefundAmount = confirmRefundAmount;
    window.completeReturn = completeReturn;
    window.changePage = changePage;
    window.closeQRCodeScannerForReturns = closeQRCodeScannerForReturns;
    window.retryQRCodeScannerForReturns = retryQRCodeScannerForReturns;
    window.useScannedInvoiceNumber = useScannedInvoiceNumber;
    window.openQRCodeScanner = openQRCodeScanner;
    window.showInvoiceDetailsModal = showInvoiceDetailsModal;
    window.closeInvoiceDetailsModal = closeInvoiceDetailsModal;
    // Keep backward compatibility
    window.closeBarcodeScannerForReturns = closeBarcodeScannerForReturns;
    window.retryBarcodeScannerForReturns = retryBarcodeScannerForReturns;
    window.openBarcodeScanner = openBarcodeScanner;
}

// Helper Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    return parseFloat(amount || 0).toFixed(2) + ' ج.م';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', { 
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'Africa/Cairo'
        });
    } catch (e) {
        return dateString;
    }
}

} // ✅ نهاية حماية من التحميل المكرر

// نظام تخزين محلي باستخدام IndexedDB - لتسريع تحميل المنتجات والمخزون
// يدعم تخزين بيانات كبيرة (حتى GBs) مع أداء عالي

class IndexedDBCache {
    constructor() {
        this.dbName = 'pos_inventory_cache';
        this.dbVersion = 1;
        this.db = null;
        this.initPromise = null;
    }

    // تهيئة قاعدة البيانات
    async init() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // جدول المنتجات (POS)
                if (!db.objectStoreNames.contains('products')) {
                    const productsStore = db.createObjectStore('products', { keyPath: 'id' });
                    productsStore.createIndex('type', 'type', { unique: false });
                    productsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // جدول قطع الغيار
                if (!db.objectStoreNames.contains('spare_parts')) {
                    const sparePartsStore = db.createObjectStore('spare_parts', { keyPath: 'id' });
                    sparePartsStore.createIndex('brand', 'brand', { unique: false });
                    sparePartsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // جدول الإكسسوارات
                if (!db.objectStoreNames.contains('accessories')) {
                    const accessoriesStore = db.createObjectStore('accessories', { keyPath: 'id' });
                    accessoriesStore.createIndex('type', 'type', { unique: false });
                    accessoriesStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // جدول الهواتف
                if (!db.objectStoreNames.contains('phones')) {
                    const phonesStore = db.createObjectStore('phones', { keyPath: 'id' });
                    phonesStore.createIndex('brand', 'brand', { unique: false });
                    phonesStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // جدول metadata (للتأكد من صلاحية الكاش)
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
        
        return this.initPromise;
    }

    // حفظ المنتجات (POS)
    async saveProducts(products, timestamp = Date.now()) {
        try {
            await this.init();
            const tx = this.db.transaction('products', 'readwrite');
            const store = tx.objectStore('products');
            
            // حذف البيانات القديمة
            await store.clear();
            
            // حفظ المنتجات الجديدة مع timestamp
            const promises = products.map(product => {
                return store.put({ ...product, timestamp });
            });
            
            await Promise.all(promises);
            
            // حفظ metadata
            await this.saveMetadata('products_last_update', timestamp);
            
            return true;
        } catch (error) {
            console.error('خطأ في حفظ المنتجات في IndexedDB:', error);
            return false;
        }
    }

    // تحميل المنتجات (POS)
    async loadProducts(maxAge = 3600000) { // افتراضياً ساعة (3600000 ms)
        try {
            await this.init();
            const metadata = await this.getMetadata('products_last_update');
            
            // التحقق من صلاحية الكاش
            if (!metadata || (Date.now() - metadata.value) > maxAge) {
                return null; // الكاش منتهي الصلاحية
            }
            
            const tx = this.db.transaction('products', 'readonly');
            const store = tx.objectStore('products');
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const products = request.result.map(item => {
                        const { timestamp, ...product } = item;
                        return product;
                    });
                    resolve(products);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('خطأ في تحميل المنتجات من IndexedDB:', error);
            return null;
        }
    }

    // حفظ قطع الغيار
    async saveSpareParts(parts, timestamp = Date.now()) {
        try {
            await this.init();
            const tx = this.db.transaction('spare_parts', 'readwrite');
            const store = tx.objectStore('spare_parts');
            
            await store.clear();
            const promises = parts.map(part => {
                return store.put({ ...part, timestamp });
            });
            
            await Promise.all(promises);
            await this.saveMetadata('spare_parts_last_update', timestamp);
            
            return true;
        } catch (error) {
            console.error('خطأ في حفظ قطع الغيار في IndexedDB:', error);
            return false;
        }
    }

    // تحميل قطع الغيار
    async loadSpareParts(maxAge = 3600000) {
        try {
            await this.init();
            const metadata = await this.getMetadata('spare_parts_last_update');
            
            if (!metadata || (Date.now() - metadata.value) > maxAge) {
                return null;
            }
            
            const tx = this.db.transaction('spare_parts', 'readonly');
            const store = tx.objectStore('spare_parts');
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const parts = request.result.map(item => {
                        const { timestamp, ...part } = item;
                        return part;
                    });
                    resolve(parts);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('خطأ في تحميل قطع الغيار من IndexedDB:', error);
            return null;
        }
    }

    // حفظ الإكسسوارات
    async saveAccessories(accessories, timestamp = Date.now()) {
        try {
            await this.init();
            const tx = this.db.transaction('accessories', 'readwrite');
            const store = tx.objectStore('accessories');
            
            await store.clear();
            const promises = accessories.map(accessory => {
                return store.put({ ...accessory, timestamp });
            });
            
            await Promise.all(promises);
            await this.saveMetadata('accessories_last_update', timestamp);
            
            return true;
        } catch (error) {
            console.error('خطأ في حفظ الإكسسوارات في IndexedDB:', error);
            return false;
        }
    }

    // تحميل الإكسسوارات
    async loadAccessories(maxAge = 3600000) {
        try {
            await this.init();
            const metadata = await this.getMetadata('accessories_last_update');
            
            if (!metadata || (Date.now() - metadata.value) > maxAge) {
                return null;
            }
            
            const tx = this.db.transaction('accessories', 'readonly');
            const store = tx.objectStore('accessories');
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const accessories = request.result.map(item => {
                        const { timestamp, ...accessory } = item;
                        return accessory;
                    });
                    resolve(accessories);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('خطأ في تحميل الإكسسوارات من IndexedDB:', error);
            return null;
        }
    }

    // حفظ الهواتف
    async savePhones(phones, timestamp = Date.now()) {
        try {
            await this.init();
            const tx = this.db.transaction('phones', 'readwrite');
            const store = tx.objectStore('phones');
            
            await store.clear();
            const promises = phones.map(phone => {
                return store.put({ ...phone, timestamp });
            });
            
            await Promise.all(promises);
            await this.saveMetadata('phones_last_update', timestamp);
            
            return true;
        } catch (error) {
            console.error('خطأ في حفظ الهواتف في IndexedDB:', error);
            return false;
        }
    }

    // تحميل الهواتف
    async loadPhones(maxAge = 3600000) {
        try {
            await this.init();
            const metadata = await this.getMetadata('phones_last_update');
            
            if (!metadata || (Date.now() - metadata.value) > maxAge) {
                return null;
            }
            
            const tx = this.db.transaction('phones', 'readonly');
            const store = tx.objectStore('phones');
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const phones = request.result.map(item => {
                        const { timestamp, ...phone } = item;
                        return phone;
                    });
                    resolve(phones);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('خطأ في تحميل الهواتف من IndexedDB:', error);
            return null;
        }
    }

    // حفظ metadata
    async saveMetadata(key, value) {
        try {
            await this.init();
            const tx = this.db.transaction('metadata', 'readwrite');
            const store = tx.objectStore('metadata');
            await store.put({ key, value });
            return true;
        } catch (error) {
            console.error('خطأ في حفظ metadata:', error);
            return false;
        }
    }

    // تحميل metadata
    async getMetadata(key) {
        try {
            await this.init();
            const tx = this.db.transaction('metadata', 'readonly');
            const store = tx.objectStore('metadata');
            const request = store.get(key);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('خطأ في تحميل metadata:', error);
            return null;
        }
    }

    // مسح جميع البيانات
    async clear() {
        try {
            await this.init();
            const stores = ['products', 'spare_parts', 'accessories', 'phones', 'metadata'];
            const tx = this.db.transaction(stores, 'readwrite');
            
            const promises = stores.map(storeName => {
                return tx.objectStore(storeName).clear();
            });
            
            await Promise.all(promises);
            return true;
        } catch (error) {
            console.error('خطأ في مسح IndexedDB:', error);
            return false;
        }
    }

    // الحصول على حجم قاعدة البيانات
    async getSize() {
        try {
            if (!navigator.storage || !navigator.storage.estimate) {
                return null;
            }
            
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage || 0,
                available: estimate.quota || 0
            };
        } catch (error) {
            console.error('خطأ في حساب الحجم:', error);
            return null;
        }
    }
}

// إنشاء instance عام
const dbCache = new IndexedDBCache();

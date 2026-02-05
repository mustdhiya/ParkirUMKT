const ParkingSystem = (function() {
    const STORAGE_KEY = 'fst_parking_data';
    const HISTORY_KEY = 'fst_parking_history';
    const CONFIG_KEY = 'fst_parking_config';

    const DEFAULT_CONFIG = {
        maxCapacity: 100,
        reservedSpots: {
            DEKAN: 2,
            WAKIL_DEKAN: 3,
            DOSEN: 10
        },
        maxVehiclePerPerson: {
            MAHASISWA: 1,
            STAFF: 2,
            KANTIN: 1,
            TAMU: 1
        },
        maxDurationHours: {
            MAHASISWA: 12,
            STAFF: 24,
            TAMU: 8,
            KANTIN: 12
        },
        fees: {
            TAMU_UMUM: 2000
        }
    };

    function getStorage() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : { vehicles: [] };
    }

    function saveStorage(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        SyncSystem.triggerSync('storage_updated', data);
    }

    function getHistory() {
        const data = localStorage.getItem(HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    }

    function saveHistory(history) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function getConfig() {
        const data = localStorage.getItem(CONFIG_KEY);
        return data ? { ...DEFAULT_CONFIG, ...JSON.parse(data) } : DEFAULT_CONFIG;
    }

    function saveConfig(config) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    function parseBarcode(barcode) {
        barcode = barcode.trim().toUpperCase();

        if (barcode.startsWith('RFIDM')) {
            return {
                category: 'MAHASISWA',
                identifier: barcode.substring(5),
                raw: barcode
            };
        }

        if (barcode.startsWith('RFIDS')) {
            return {
                category: 'STAFF',
                identifier: barcode.substring(5),
                raw: barcode
            };
        }

        if (barcode.startsWith('KANTIN')) {
            return {
                category: 'KANTIN',
                identifier: barcode,
                raw: barcode
            };
        }

        if (barcode.startsWith('TAMU')) {
            return {
                category: 'TAMU',
                identifier: barcode,
                raw: barcode
            };
        }

        if (/^\d{13}$/.test(barcode)) {
            return {
                category: 'MAHASISWA',
                identifier: barcode,
                raw: barcode
            };
        }

        return {
            category: null,
            identifier: barcode,
            raw: barcode
        };
    }

    function generateUniqueId() {
        return 'PKR' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    function vehicleIn(category, identifier, plate, additionalData = {}) {
        const data = getStorage();

        const existingPlate = data.vehicles.find(v => v.plate === plate);
        if (existingPlate) {
            return {
                success: false,
                message: `Plat nomor ${plate} sudah terdaftar parkir`
            };
        }

        const validation = ValidationRules.validateVehicleIn(category, identifier);
        if (!validation.valid) {
            return {
                success: false,
                message: validation.message
            };
        }

        const capacityCheck = checkCapacity(category);
        if (!capacityCheck.allowed) {
            return {
                success: false,
                message: capacityCheck.message
            };
        }

        const vehicle = {
            id: generateUniqueId(),
            category: category,
            identifier: identifier,
            plate: plate,
            timeIn: new Date().toISOString(),
            gate: AuditSystem.currentGate || 'UNKNOWN',
            operator: AuditSystem.currentUser || 'SYSTEM',
            ...additionalData
        };

        data.vehicles.push(vehicle);
        saveStorage(data);

        const history = getHistory();
        history.push({
            ...vehicle,
            action: 'IN',
            timestamp: new Date().toISOString()
        });
        saveHistory(history);

        AuditSystem.log('VEHICLE_IN', {
            vehicleId: vehicle.id,
            plate: vehicle.plate,
            category: vehicle.category,
            identifier: vehicle.identifier
        });

        return {
            success: true,
            vehicle: vehicle
        };
    }

    function vehicleOut(plate) {
        const data = getStorage();
        const index = data.vehicles.findIndex(v => v.plate === plate);

        if (index === -1) {
            return {
                success: false,
                message: 'Kendaraan tidak ditemukan'
            };
        }

        const vehicle = data.vehicles[index];
        const duration = calculateDuration(vehicle.timeIn);
        const fee = calculateFee(vehicle);

        data.vehicles.splice(index, 1);
        saveStorage(data);

        const history = getHistory();
        history.push({
            ...vehicle,
            action: 'OUT',
            timeOut: new Date().toISOString(),
            duration: duration.minutes,
            fee: fee.amount,
            timestamp: new Date().toISOString(),
            operator: AuditSystem.currentUser || 'SYSTEM'
        });
        saveHistory(history);

        AuditSystem.log('VEHICLE_OUT', {
            vehicleId: vehicle.id,
            plate: vehicle.plate,
            duration: duration.minutes,
            fee: fee.amount
        });

        return {
            success: true,
            vehicle: vehicle,
            duration: duration,
            fee: fee
        };
    }

    function getParkedVehicles() {
        const data = getStorage();
        return data.vehicles.sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));
    }

    function getStatistics() {
        const data = getStorage();
        const config = getConfig();
        
        const stats = {
            total: data.vehicles.length,
            mahasiswa: 0,
            staff: 0,
            kantin: 0,
            tamu: 0,
            capacity: config.maxCapacity,
            occupancyRate: Math.round((data.vehicles.length / config.maxCapacity) * 100)
        };

        data.vehicles.forEach(v => {
            switch(v.category) {
                case 'MAHASISWA':
                    stats.mahasiswa++;
                    break;
                case 'STAFF':
                    stats.staff++;
                    break;
                case 'KANTIN':
                    stats.kantin++;
                    break;
                case 'TAMU':
                    stats.tamu++;
                    break;
            }
        });

        return stats;
    }

    function findVehicleByPlate(plate) {
        const data = getStorage();
        return data.vehicles.find(v => v.plate.toUpperCase() === plate.toUpperCase());
    }

    function findVehicleByIdentifier(identifier) {
        const data = getStorage();
        return data.vehicles.find(v => v.identifier === identifier);
    }

    function findAllVehiclesByIdentifier(identifier) {
        const data = getStorage();
        return data.vehicles.filter(v => v.identifier === identifier);
    }

    function findVehicleById(id) {
        const data = getStorage();
        return data.vehicles.find(v => v.id === id);
    }

    function getTodayHistory() {
        const history = getHistory();
        const today = new Date().toDateString();
        
        const todayRecords = history.filter(h => {
            const recordDate = new Date(h.timestamp).toDateString();
            return recordDate === today;
        });

        const inCount = todayRecords.filter(r => r.action === 'IN').length;
        const outCount = todayRecords.filter(r => r.action === 'OUT').length;

        const durations = todayRecords
            .filter(r => r.action === 'OUT' && r.duration)
            .map(r => r.duration);

        const avgDuration = durations.length > 0 
            ? Math.floor(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0;

        const totalFee = todayRecords
            .filter(r => r.action === 'OUT' && r.fee)
            .reduce((sum, r) => sum + r.fee, 0);

        return {
            in: inCount,
            out: outCount,
            avgDuration: avgDuration,
            totalFee: totalFee,
            currentParked: inCount - outCount
        };
    }

    function getHistoryByDateRange(startDate, endDate) {
        const history = getHistory();
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        const end = new Date(endDate).setHours(23, 59, 59, 999);

        return history.filter(h => {
            const timestamp = new Date(h.timestamp).getTime();
            return timestamp >= start && timestamp <= end;
        });
    }

    function calculateDuration(timeIn) {
        const now = new Date();
        const diff = now - new Date(timeIn);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        let text = '';
        if (days > 0) {
            text = `${days} hari ${hours % 24} jam`;
        } else if (hours > 0) {
            text = `${hours} jam ${minutes % 60} menit`;
        } else {
            text = `${minutes} menit`;
        }

        return {
            minutes: minutes,
            hours: hours,
            days: days,
            text: text
        };
    }

    function calculateFee(vehicle) {
        const config = getConfig();

        if (vehicle.category === 'STAFF') {
            return { amount: 0, text: 'GRATIS (Staff)' };
        }
        if (vehicle.category === 'MAHASISWA') {
            return { amount: 0, text: 'GRATIS (Mahasiswa)' };
        }
        if (vehicle.category === 'KANTIN') {
            return { amount: 0, text: 'GRATIS (Kantin)' };
        }
        if (vehicle.category === 'TAMU' && vehicle.tamuStatus === 'UNDANGAN') {
            return { amount: 0, text: 'GRATIS (Undangan)' };
        }

        const duration = calculateDuration(vehicle.timeIn);
        const hours = Math.ceil(duration.minutes / 60);
        const feePerHour = config.fees.TAMU_UMUM || 2000;
        const amount = hours * feePerHour;
        
        return {
            amount: amount,
            text: `Rp ${amount.toLocaleString('id-ID')}`
        };
    }

    function checkCapacity(category) {
        const stats = getStatistics();
        const config = getConfig();
        const reserved = config.reservedSpots[category] || 0;
        const available = config.maxCapacity - stats.total - reserved;

        if (available <= 0) {
            return {
                allowed: false,
                message: 'Parkiran penuh, tidak ada slot tersedia'
            };
        }

        if (stats.occupancyRate >= 90) {
            return {
                allowed: true,
                warning: `Parkiran hampir penuh (${stats.occupancyRate}%)`
            };
        }

        return { allowed: true };
    }

    function getOverstayVehicles() {
        const config = getConfig();
        const vehicles = getParkedVehicles();
        
        return vehicles.filter(v => {
            const duration = calculateDuration(v.timeIn);
            const maxHours = config.maxDurationHours[v.category] || 12;
            return duration.hours > maxHours;
        }).map(v => ({
            ...v,
            overstayHours: calculateDuration(v.timeIn).hours - (config.maxDurationHours[v.category] || 12)
        }));
    }

    function clearAllData() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(HISTORY_KEY);
        AuditSystem.log('SYSTEM_CLEAR', { action: 'All data cleared' });
    }

    function clearHistory() {
        localStorage.removeItem(HISTORY_KEY);
        AuditSystem.log('HISTORY_CLEAR', { action: 'History cleared' });
    }

    function exportData() {
        return {
            vehicles: getParkedVehicles(),
            history: getHistory(),
            config: getConfig(),
            statistics: getStatistics(),
            exportDate: new Date().toISOString()
        };
    }

    return {
        parseBarcode,
        vehicleIn,
        vehicleOut,
        getParkedVehicles,
        getStatistics,
        findVehicleByPlate,
        findVehicleByIdentifier,
        findAllVehiclesByIdentifier,
        findVehicleById,
        getTodayHistory,
        getHistoryByDateRange,
        calculateDuration,
        calculateFee,
        checkCapacity,
        getOverstayVehicles,
        getConfig,
        saveConfig,
        clearAllData,
        clearHistory,
        exportData,
        generateUniqueId
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParkingSystem;
}

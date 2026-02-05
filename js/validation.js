const ValidationRules = (function() {
    
    function validateVehicleIn(category, identifier) {
        if (!category || !identifier) {
            return {
                valid: false,
                message: 'Kategori dan identifier harus diisi'
            };
        }

        const categoryValidation = validateCategory(category);
        if (!categoryValidation.valid) {
            return categoryValidation;
        }

        const identifierValidation = validateIdentifier(category, identifier);
        if (!identifierValidation.valid) {
            return identifierValidation;
        }

        const duplicateCheck = checkDuplicateVehicle(category, identifier);
        if (!duplicateCheck.valid) {
            return duplicateCheck;
        }

        return { valid: true };
    }

    function validateCategory(category) {
        const validCategories = ['MAHASISWA', 'STAFF', 'KANTIN', 'TAMU'];
        
        if (!validCategories.includes(category)) {
            return {
                valid: false,
                message: `Kategori tidak valid. Harus salah satu dari: ${validCategories.join(', ')}`
            };
        }

        return { valid: true };
    }

    function validateIdentifier(category, identifier) {
        switch(category) {
            case 'MAHASISWA':
                return validateNIM(identifier);
            case 'STAFF':
                return validateStaffId(identifier);
            case 'KANTIN':
                return validateKantinCode(identifier);
            case 'TAMU':
                return validateTamuId(identifier);
            default:
                return { valid: true };
        }
    }

    function validateNIM(nim) {
        nim = nim.toString().trim();
        
        if (nim.length !== 13 && nim.length < 10) {
            return {
                valid: false,
                message: 'NIM harus 13 digit atau minimal 10 karakter'
            };
        }

        if (!/^\d+$/.test(nim)) {
            return {
                valid: false,
                message: 'NIM harus berupa angka'
            };
        }

        return { valid: true };
    }

    function validateStaffId(staffId) {
        staffId = staffId.toString().trim();
        
        if (staffId.length < 3) {
            return {
                valid: false,
                message: 'ID Staff minimal 3 karakter'
            };
        }

        return { valid: true };
    }

    function validateKantinCode(code) {
        code = code.toString().trim();
        
        if (code.length < 5) {
            return {
                valid: false,
                message: 'Kode Kantin minimal 5 karakter'
            };
        }

        return { valid: true };
    }

    function validateTamuId(tamuId) {
        if (!tamuId || tamuId.trim().length === 0) {
            return {
                valid: false,
                message: 'Nama atau ID tamu harus diisi'
            };
        }

        return { valid: true };
    }

    function validatePlate(plate) {
        plate = plate.toString().trim().toUpperCase();
        
        if (plate.length < 5) {
            return {
                valid: false,
                message: 'Plat nomor terlalu pendek'
            };
        }

        const platePattern = /^[A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{0,3}$/;
        if (!platePattern.test(plate)) {
            return {
                valid: false,
                message: 'Format plat nomor tidak valid. Contoh: KT 1234 AB'
            };
        }

        return { valid: true, plate: plate };
    }

    function checkDuplicateVehicle(category, identifier) {
        const config = ParkingSystem.getConfig();
        const existing = ParkingSystem.findAllVehiclesByIdentifier(identifier);
        const maxVehicles = config.maxVehiclePerPerson[category] || 1;

        if (existing.length >= maxVehicles) {
            const plates = existing.map(v => v.plate).join(', ');
            return {
                valid: false,
                message: `${category} dengan ID ${identifier} sudah memiliki ${existing.length} kendaraan parkir (${plates}). Maksimal: ${maxVehicles}`
            };
        }

        return { valid: true };
    }

    function checkOverstay(vehicle) {
        const config = ParkingSystem.getConfig();
        const duration = ParkingSystem.calculateDuration(vehicle.timeIn);
        const maxHours = config.maxDurationHours[vehicle.category] || 12;

        if (duration.hours > maxHours) {
            return {
                overstay: true,
                hours: duration.hours - maxHours,
                message: `Kendaraan sudah parkir ${duration.hours} jam (melebihi batas ${maxHours} jam)`
            };
        }

        return { overstay: false };
    }

    function validateTamuData(tamuStatus, bukti) {
        if (tamuStatus === 'UNDANGAN') {
            if (!bukti || bukti.trim().length === 0) {
                return {
                    valid: false,
                    message: 'Tamu undangan harus melampirkan nomor bukti undangan'
                };
            }
        }

        return { valid: true };
    }

    function sanitizeInput(input) {
        if (typeof input !== 'string') {
            input = String(input);
        }
        
        return input
            .trim()
            .replace(/[<>]/g, '')
            .substring(0, 100);
    }

    function validateBarcodeFormat(barcode) {
        const validPrefixes = ['RFIDM', 'RFIDS', 'KANTIN', 'TAMU'];
        const hasValidPrefix = validPrefixes.some(prefix => barcode.startsWith(prefix));
        const isNumeric13 = /^\d{13}$/.test(barcode);

        if (!hasValidPrefix && !isNumeric13) {
            return {
                valid: false,
                message: 'Format barcode tidak valid'
            };
        }

        return { valid: true };
    }

    function getValidationRules() {
        const config = ParkingSystem.getConfig();
        return {
            maxVehiclePerPerson: config.maxVehiclePerPerson,
            maxDurationHours: config.maxDurationHours,
            maxCapacity: config.maxCapacity
        };
    }

    return {
        validateVehicleIn,
        validateCategory,
        validateIdentifier,
        validateNIM,
        validateStaffId,
        validateKantinCode,
        validateTamuId,
        validatePlate,
        checkDuplicateVehicle,
        checkOverstay,
        validateTamuData,
        sanitizeInput,
        validateBarcodeFormat,
        getValidationRules
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationRules;
}

const PrinterSystem = (function() {
    
    function printTicket(vehicle) {
        const ticketHtml = generateTicketHtml(vehicle);
        openPrintWindow(ticketHtml);
        
        AuditSystem.log('TICKET_PRINTED', {
            vehicleId: vehicle.id,
            plate: vehicle.plate,
            category: vehicle.category
        });
    }

    function generateTicketHtml(vehicle) {
        const timeIn = new Date(vehicle.timeIn);
        const fee = ParkingSystem.calculateFee(vehicle);
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Karcis Parkir - ${vehicle.plate}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            padding: 10mm;
            background: white;
        }
        
        .ticket {
            border: 2px dashed #000;
            padding: 5mm;
            background: white;
        }
        
        .header {
            text-align: center;
            margin-bottom: 5mm;
            border-bottom: 2px solid #000;
            padding-bottom: 3mm;
        }
        
        .header h1 {
            font-size: 18pt;
            margin-bottom: 2mm;
        }
        
        .header h2 {
            font-size: 14pt;
            font-weight: normal;
        }
        
        .content {
            margin: 5mm 0;
        }
        
        .row {
            display: flex;
            justify-content: space-between;
            margin: 2mm 0;
            font-size: 11pt;
        }
        
        .label {
            font-weight: bold;
        }
        
        .value {
            text-align: right;
        }
        
        .barcode {
            text-align: center;
            margin: 5mm 0;
            padding: 3mm;
            background: #f0f0f0;
            border: 1px solid #ccc;
        }
        
        .barcode-value {
            font-size: 14pt;
            font-weight: bold;
            letter-spacing: 2px;
            font-family: 'Courier New', monospace;
        }
        
        .footer {
            text-align: center;
            margin-top: 5mm;
            padding-top: 3mm;
            border-top: 2px solid #000;
            font-size: 9pt;
        }
        
        .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 3mm;
            margin: 3mm 0;
            font-size: 9pt;
            text-align: center;
        }
        
        .category-badge {
            display: inline-block;
            padding: 2mm 4mm;
            background: #000;
            color: #fff;
            font-weight: bold;
            font-size: 10pt;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="ticket">
        <div class="header">
            <h1>UNIVERSITAS MUHAMMADIYAH</h1>
            <h2>KALIMANTAN TIMUR</h2>
            <p style="font-size: 10pt; margin-top: 2mm;">FAKULTAS SAINS DAN TEKNOLOGI</p>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin: 3mm 0;">
                <span class="category-badge">${vehicle.category}</span>
            </div>
            
            <div class="row">
                <span class="label">Plat Nomor:</span>
                <span class="value">${vehicle.plate}</span>
            </div>
            
            <div class="row">
                <span class="label">ID/NIM:</span>
                <span class="value">${vehicle.identifier}</span>
            </div>
            
            <div class="row">
                <span class="label">Masuk:</span>
                <span class="value">${timeIn.toLocaleDateString('id-ID')}</span>
            </div>
            
            <div class="row">
                <span class="label">Jam:</span>
                <span class="value">${timeIn.toLocaleTimeString('id-ID')}</span>
            </div>
            
            <div class="row">
                <span class="label">Gate:</span>
                <span class="value">${vehicle.gate || 'MAIN'}</span>
            </div>
            
            <div class="row">
                <span class="label">Operator:</span>
                <span class="value">${vehicle.operator || 'SYSTEM'}</span>
            </div>
        </div>
        
        <div class="barcode">
            <div class="barcode-value">${vehicle.id}</div>
            <p style="font-size: 8pt; margin-top: 2mm;">Scan barcode ini saat keluar</p>
        </div>
        
        ${fee.amount > 0 ? `
        <div class="warning">
            <strong>TAMU BERBAYAR</strong><br>
            Tarif: Rp 2.000/jam
        </div>
        ` : `
        <div class="row" style="background: #d4edda; padding: 2mm; font-weight: bold;">
            <span>Biaya:</span>
            <span>${fee.text}</span>
        </div>
        `}
        
        <div class="footer">
            <p><strong>SIMPAN KARCIS INI</strong></p>
            <p style="margin-top: 2mm; font-size: 8pt;">Tunjukkan saat keluar parkir</p>
            <p style="margin-top: 2mm; font-size: 8pt;">ID: ${vehicle.id}</p>
        </div>
    </div>
    
    <div class="no-print" style="text-align: center; margin-top: 10mm;">
        <button onclick="window.print()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer;">
            CETAK KARCIS
        </button>
        <button onclick="window.close()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer; margin-left: 5mm;">
            TUTUP
        </button>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
        
        window.onafterprint = function() {
            setTimeout(function() {
                window.close();
            }, 1000);
        };
    </script>
</body>
</html>
        `;
    }

    function printExitReceipt(vehicle, duration, fee) {
        const receiptHtml = generateExitReceiptHtml(vehicle, duration, fee);
        openPrintWindow(receiptHtml);
        
        AuditSystem.log('RECEIPT_PRINTED', {
            vehicleId: vehicle.id,
            plate: vehicle.plate,
            duration: duration.minutes,
            fee: fee.amount
        });
    }

    function generateExitReceiptHtml(vehicle, duration, fee) {
        const timeIn = new Date(vehicle.timeIn);
        const timeOut = new Date();
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bukti Keluar Parkir - ${vehicle.plate}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            padding: 10mm;
            background: white;
        }
        
        .receipt {
            border: 2px solid #000;
            padding: 5mm;
            background: white;
        }
        
        .header {
            text-align: center;
            margin-bottom: 5mm;
            border-bottom: 2px solid #000;
            padding-bottom: 3mm;
        }
        
        .header h1 {
            font-size: 18pt;
            margin-bottom: 2mm;
        }
        
        .header h2 {
            font-size: 14pt;
            font-weight: normal;
        }
        
        .content {
            margin: 5mm 0;
        }
        
        .row {
            display: flex;
            justify-content: space-between;
            margin: 2mm 0;
            font-size: 11pt;
        }
        
        .label {
            font-weight: bold;
        }
        
        .value {
            text-align: right;
        }
        
        .total {
            margin-top: 5mm;
            padding-top: 3mm;
            border-top: 2px dashed #000;
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
        }
        
        .footer {
            text-align: center;
            margin-top: 5mm;
            padding-top: 3mm;
            border-top: 2px solid #000;
            font-size: 9pt;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <h1>BUKTI PARKIR</h1>
            <h2>FST UMKT</h2>
        </div>
        
        <div class="content">
            <div class="row">
                <span class="label">Plat Nomor:</span>
                <span class="value">${vehicle.plate}</span>
            </div>
            
            <div class="row">
                <span class="label">Kategori:</span>
                <span class="value">${vehicle.category}</span>
            </div>
            
            <div class="row">
                <span class="label">Masuk:</span>
                <span class="value">${timeIn.toLocaleString('id-ID')}</span>
            </div>
            
            <div class="row">
                <span class="label">Keluar:</span>
                <span class="value">${timeOut.toLocaleString('id-ID')}</span>
            </div>
            
            <div class="row">
                <span class="label">Durasi:</span>
                <span class="value">${duration.text}</span>
            </div>
            
            <div class="total">
                <p>TOTAL BIAYA</p>
                <p style="font-size: 18pt; margin-top: 2mm;">${fee.text}</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>TERIMA KASIH</strong></p>
            <p style="margin-top: 2mm;">Hati-hati di jalan</p>
            <p style="margin-top: 3mm; font-size: 8pt;">${new Date().toLocaleString('id-ID')}</p>
        </div>
    </div>
    
    <div class="no-print" style="text-align: center; margin-top: 10mm;">
        <button onclick="window.print()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer;">
            CETAK BUKTI
        </button>
        <button onclick="window.close()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer; margin-left: 5mm;">
            TUTUP
        </button>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
        
        window.onafterprint = function() {
            setTimeout(function() {
                window.close();
            }, 1000);
        };
    </script>
</body>
</html>
        `;
    }

    function openPrintWindow(html) {
        const printWindow = window.open('', '_blank', 'width=400,height=700');
        
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        } else {
            alert('Pop-up diblokir. Aktifkan pop-up untuk cetak karcis.');
        }
    }

    function generateBarcode(text) {
        return text;
    }

    function testPrint() {
        const testVehicle = {
            id: 'TEST123456',
            plate: 'KT 1234 AB',
            category: 'TAMU',
            identifier: 'TAMU001',
            timeIn: new Date().toISOString(),
            gate: 'TEST GATE',
            operator: 'TEST OPERATOR'
        };
        
        printTicket(testVehicle);
    }

    return {
        printTicket,
        printExitReceipt,
        generateTicketHtml,
        generateExitReceiptHtml,
        testPrint
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrinterSystem;
}

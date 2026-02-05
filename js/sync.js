const SyncSystem = (function() {
    const SYNC_CHANNEL = 'fst_parking_sync';
    let syncCallbacks = {};
    let broadcastChannel = null;
    let storageListenerActive = false;

    function init() {
        if (typeof BroadcastChannel !== 'undefined') {
            initBroadcastChannel();
        } else {
            initStorageSync();
        }

        console.log('SyncSystem initialized');
    }

    function initBroadcastChannel() {
        try {
            broadcastChannel = new BroadcastChannel(SYNC_CHANNEL);
            
            broadcastChannel.onmessage = function(event) {
                handleSyncMessage(event.data);
            };

            console.log('Using BroadcastChannel for sync');
        } catch (e) {
            console.warn('BroadcastChannel not supported, falling back to storage events');
            initStorageSync();
        }
    }

    function initStorageSync() {
        if (storageListenerActive) return;

        window.addEventListener('storage', function(e) {
            if (e.key === 'fst_parking_data' || e.key === 'fst_parking_history') {
                triggerCallbacks('storage_updated', {
                    key: e.key,
                    oldValue: e.oldValue,
                    newValue: e.newValue
                });
            }
        });

        storageListenerActive = true;
        console.log('Using Storage Events for sync');
    }

    function triggerSync(event, data) {
        const message = {
            event: event,
            data: data,
            timestamp: new Date().toISOString(),
            sender: AuditSystem.sessionId || 'UNKNOWN'
        };

        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage(message);
            } catch (e) {
                console.error('Failed to broadcast message:', e);
            }
        }

        triggerCallbacks(event, data);
    }

    function handleSyncMessage(message) {
        if (message.sender === AuditSystem.sessionId) {
            return;
        }

        triggerCallbacks(message.event, message.data);
    }

    function triggerCallbacks(event, data) {
        if (syncCallbacks[event]) {
            syncCallbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error('Sync callback error:', e);
                }
            });
        }

        if (syncCallbacks['*']) {
            syncCallbacks['*'].forEach(callback => {
                try {
                    callback({ event: event, data: data });
                } catch (e) {
                    console.error('Global sync callback error:', e);
                }
            });
        }
    }

    function on(event, callback) {
        if (!syncCallbacks[event]) {
            syncCallbacks[event] = [];
        }
        syncCallbacks[event].push(callback);
    }

    function off(event, callback) {
        if (syncCallbacks[event]) {
            syncCallbacks[event] = syncCallbacks[event].filter(cb => cb !== callback);
        }
    }

    function onAny(callback) {
        on('*', callback);
    }

    function notifyVehicleIn(vehicle) {
        triggerSync('vehicle_in', vehicle);
    }

    function notifyVehicleOut(vehicle) {
        triggerSync('vehicle_out', vehicle);
    }

    function notifyUpdate(type, data) {
        triggerSync('update', { type: type, data: data });
    }

    function getSyncStatus() {
        return {
            method: broadcastChannel ? 'BroadcastChannel' : 'StorageEvents',
            active: true,
            callbacks: Object.keys(syncCallbacks).reduce((acc, key) => {
                acc[key] = syncCallbacks[key].length;
                return acc;
            }, {})
        };
    }

    function destroy() {
        if (broadcastChannel) {
            broadcastChannel.close();
            broadcastChannel = null;
        }
        
        syncCallbacks = {};
        
        console.log('SyncSystem destroyed');
    }

    init();

    return {
        triggerSync,
        on,
        off,
        onAny,
        notifyVehicleIn,
        notifyVehicleOut,
        notifyUpdate,
        getSyncStatus,
        destroy
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncSystem;
}

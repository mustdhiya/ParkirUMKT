const AuditSystem = (function() {
    const AUDIT_LOG_KEY = 'fst_audit_logs';
    const SESSION_KEY = 'fst_session';
    const MAX_LOGS = 10000;

    let currentUser = null;
    let currentGate = null;
    let sessionId = null;

    function init() {
        loadSession();
        if (!sessionId) {
            sessionId = generateSessionId();
        }
    }

    function generateSessionId() {
        return 'SESSION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    function login(username, gate, role = 'OPERATOR') {
        currentUser = username;
        currentGate = gate;
        sessionId = generateSessionId();

        const session = {
            user: username,
            gate: gate,
            role: role,
            sessionId: sessionId,
            loginTime: new Date().toISOString()
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(session));

        log('USER_LOGIN', {
            username: username,
            gate: gate,
            role: role,
            sessionId: sessionId
        });

        return { success: true, session: session };
    }

    function logout() {
        if (currentUser) {
            log('USER_LOGOUT', {
                username: currentUser,
                gate: currentGate,
                sessionId: sessionId,
                duration: getSessionDuration()
            });
        }

        currentUser = null;
        currentGate = null;
        sessionId = null;
        localStorage.removeItem(SESSION_KEY);

        return { success: true };
    }

    function loadSession() {
        const sessionData = localStorage.getItem(SESSION_KEY);
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                currentUser = session.user;
                currentGate = session.gate;
                sessionId = session.sessionId;
                return session;
            } catch (e) {
                console.error('Failed to load session:', e);
                return null;
            }
        }
        return null;
    }

    function getCurrentSession() {
        return {
            user: currentUser,
            gate: currentGate,
            sessionId: sessionId,
            isAuthenticated: currentUser !== null
        };
    }

    function getSessionDuration() {
        const sessionData = localStorage.getItem(SESSION_KEY);
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                const loginTime = new Date(session.loginTime);
                const now = new Date();
                const diff = now - loginTime;
                return Math.floor(diff / 60000);
            } catch (e) {
                return 0;
            }
        }
        return 0;
    }

    function log(action, data = {}) {
        const logs = getLogs();

        const logEntry = {
            id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            action: action,
            user: currentUser || 'ANONYMOUS',
            gate: currentGate || 'UNKNOWN',
            sessionId: sessionId || 'NO_SESSION',
            data: data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        logs.push(logEntry);

        if (logs.length > MAX_LOGS) {
            logs.splice(0, logs.length - MAX_LOGS);
        }

        saveLogs(logs);
        
        return logEntry;
    }

    function getLogs() {
        const data = localStorage.getItem(AUDIT_LOG_KEY);
        return data ? JSON.parse(data) : [];
    }

    function saveLogs(logs) {
        localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
    }

    function getLogsByDateRange(startDate, endDate) {
        const logs = getLogs();
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        const end = new Date(endDate).setHours(23, 59, 59, 999);

        return logs.filter(log => {
            const timestamp = new Date(log.timestamp).getTime();
            return timestamp >= start && timestamp <= end;
        });
    }

    function getLogsByUser(username) {
        const logs = getLogs();
        return logs.filter(log => log.user === username);
    }

    function getLogsByAction(action) {
        const logs = getLogs();
        return logs.filter(log => log.action === action);
    }

    function getLogsByGate(gate) {
        const logs = getLogs();
        return logs.filter(log => log.gate === gate);
    }

    function getTodayLogs() {
        const today = new Date();
        return getLogsByDateRange(today, today);
    }

    function getActivitySummary() {
        const logs = getLogs();
        const today = new Date().toDateString();
        
        const todayLogs = logs.filter(log => {
            return new Date(log.timestamp).toDateString() === today;
        });

        const actionCounts = {};
        const userCounts = {};
        const gateCounts = {};

        todayLogs.forEach(log => {
            actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
            userCounts[log.user] = (userCounts[log.user] || 0) + 1;
            gateCounts[log.gate] = (gateCounts[log.gate] || 0) + 1;
        });

        return {
            totalLogs: todayLogs.length,
            actionCounts: actionCounts,
            userCounts: userCounts,
            gateCounts: gateCounts,
            date: today
        };
    }

    function searchLogs(query) {
        const logs = getLogs();
        const searchTerm = query.toLowerCase();

        return logs.filter(log => {
            return (
                log.action.toLowerCase().includes(searchTerm) ||
                log.user.toLowerCase().includes(searchTerm) ||
                log.gate.toLowerCase().includes(searchTerm) ||
                JSON.stringify(log.data).toLowerCase().includes(searchTerm)
            );
        });
    }

    function exportLogs(startDate, endDate) {
        const logs = startDate && endDate 
            ? getLogsByDateRange(startDate, endDate)
            : getLogs();

        return {
            logs: logs,
            totalCount: logs.length,
            exportDate: new Date().toISOString(),
            dateRange: startDate && endDate ? { start: startDate, end: endDate } : null
        };
    }

    function clearOldLogs(daysToKeep = 30) {
        const logs = getLogs();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffTime = cutoffDate.getTime();

        const filteredLogs = logs.filter(log => {
            return new Date(log.timestamp).getTime() >= cutoffTime;
        });

        saveLogs(filteredLogs);

        log('LOGS_CLEANUP', {
            removedCount: logs.length - filteredLogs.length,
            daysKept: daysToKeep
        });

        return {
            removedCount: logs.length - filteredLogs.length,
            remainingCount: filteredLogs.length
        };
    }

    function clearAllLogs() {
        const logs = getLogs();
        const count = logs.length;
        
        localStorage.removeItem(AUDIT_LOG_KEY);
        
        log('LOGS_CLEAR_ALL', {
            clearedCount: count
        });

        return { clearedCount: count };
    }

    function getSystemStats() {
        const logs = getLogs();
        
        if (logs.length === 0) {
            return {
                totalLogs: 0,
                oldestLog: null,
                newestLog: null,
                uniqueUsers: 0,
                uniqueGates: 0
            };
        }

        const users = new Set(logs.map(log => log.user));
        const gates = new Set(logs.map(log => log.gate));

        return {
            totalLogs: logs.length,
            oldestLog: logs[0].timestamp,
            newestLog: logs[logs.length - 1].timestamp,
            uniqueUsers: users.size,
            uniqueGates: gates.size,
            storageSize: new Blob([JSON.stringify(logs)]).size
        };
    }

    init();

    return {
        login,
        logout,
        getCurrentSession,
        loadSession,
        log,
        getLogs,
        getLogsByDateRange,
        getLogsByUser,
        getLogsByAction,
        getLogsByGate,
        getTodayLogs,
        getActivitySummary,
        searchLogs,
        exportLogs,
        clearOldLogs,
        clearAllLogs,
        getSystemStats,
        get currentUser() { return currentUser; },
        get currentGate() { return currentGate; },
        get sessionId() { return sessionId; }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuditSystem;
}

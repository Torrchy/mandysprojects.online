// ============================================
// PWA — Register Service Worker
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('./service-worker.js')
            .then(function(registration) {
                console.log('🛸 Service Worker registered! Scope:', registration.scope);
            })
            .catch(function(error) {
                console.log('🛸 Service Worker registration failed:', error);
            });
    });
}

// ===== MISSION CONTROL v16.0 (Improved Detection) — app.js =====

var HIDDEN_TAGS = ['🔄 Internal Transfer', '💰 Savings'];
var AUTO_ESSENTIALS = ['🏠 Rent', '🏠 Bills', '🛒 Groceries', '🐾 Maya & Dobby', '💊 Health', '🚇 Transport', '📞 Phone'];

var CAT_COLORS = {
    '💰 Salary': '#22c55e', '🏠 Rent': '#8b5cf6', '🏠 Bills': '#7c3aed',
    '🏠 Home & Kitchen': '#a78bfa', '🛒 Groceries': '#22c55e',
    '☕ Coffee & Eating Out': '#f59e0b', '🍕 Takeaway': '#f97316',
    '🐾 Maya & Dobby': '#ec4899', '📚 Books': '#06b6d4',
    '💄 Self Care': '#f472b6', '💊 Health': '#ef4444',
    '💪 Gym & Fitness': '#10b981', '🛍️ Shopping': '#f97316',
    '💳 Buy Now Pay Later': '#fb923c', '💳 Credit Card Payment': '#94a3b8',
    '📱 Subscriptions': '#06b6d4', '🚇 Transport': '#3b82f6',
    '🎮 Entertainment': '#6366f1', '✏️ Art & Hobbies': '#a855f7',
    '📱 Tech & Gadgets': '#0ea5e9', '💊 Therapy': '#e11d48',
    '❤️ Charity': '#f43f5e', '📞 Phone': '#14b8a6',
    '🏦 Bank Fees': '#64748b', '🔄 Internal Transfer': '#475569',
    '💰 Savings': '#34d399', '📦 Other': '#64748b'
};

var ALL_CATEGORIES = [
    '💰 Salary', '🏠 Rent', '🏠 Bills', '🏠 Home & Kitchen',
    '🛒 Groceries', '☕ Coffee & Eating Out', '🍕 Takeaway',
    '🐾 Maya & Dobby', '📚 Books', '💄 Self Care', '💊 Health',
    '💪 Gym & Fitness', '🛍️ Shopping', '💳 Buy Now Pay Later',
    '💳 Credit Card Payment', '📱 Subscriptions', '🚇 Transport',
    '🎮 Entertainment', '✏️ Art & Hobbies', '📱 Tech & Gadgets',
    '💊 Therapy', '❤️ Charity', '📞 Phone', '🏦 Bank Fees',
    '🔄 Internal Transfer', '💰 Savings', '📦 Other'
];

// ---------- STATE ----------
var state = { 
    transactions: [], 
    budget: 1000, 
    balance: 0, 
    totalSavings: 0, 
    nextId: 1, 
    showHidden: false, 
    recurringBills: [],
    creditCards: [],
    availableBalance: 0
};
var editingTxId = null;
var csvData = null;
var notificationsEnabled = false;

// ---------- INIT ----------
function init() {
    console.log("🚀 Mission Control v16.0 launching...");
    loadState();
    bindEvents();
    try {
        var dateInput = document.getElementById('txDate');
        if (dateInput) dateInput.valueAsDate = new Date();
        populateCategorySelect();
        populateFilterCategories();
        renderAll();

        // Display current date in header
        var dateDisplay = document.getElementById('currentDate');
        if (dateDisplay) {
            var now = new Date();
            dateDisplay.textContent = now.toLocaleDateString('en-GB', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
            });
        }

        // Set up desktop notifications
        setupNotifications();

        // Check spending every 5 minutes
        setInterval(function() {
            checkSpendingAndNotify();
        }, 300000);

        console.log("✅ All systems go.");
    } catch (e) {
        console.error("Init error:", e);
    }
}

function saveState() { localStorage.setItem('missionControl', JSON.stringify(state)); }

function loadState() {
    try {
        var saved = localStorage.getItem('missionControl');
        if (saved) {
            var parsed = JSON.parse(saved);
            state = { 
                transactions: [], 
                budget: 1000, 
                balance: 0, 
                totalSavings: 0, 
                nextId: 1, 
                showHidden: false, 
                recurringBills: [],
                creditCards: [],
                availableBalance: 0
            };
            for (var key in parsed) { state[key] = parsed[key]; }
            state.transactions.forEach(function(tx) {
                if (tx.isEssential === undefined) {
                    tx.isEssential = AUTO_ESSENTIALS.indexOf(tx.category) !== -1;
                }
            });
        }
    } catch (e) { console.error("Load error:", e); }

    var b = document.getElementById('monthlyBudget');
    if (b) b.value = state.budget;
    var bl = document.getElementById('currentBalance');
    if (bl) bl.value = state.balance || '';
    var sv = document.getElementById('totalSavings');
    if (sv) sv.value = state.totalSavings || '';
    var av = document.getElementById('availableBalance');
    if (av) av.value = state.availableBalance || '';
}

// ============================================
// SMART NOTIFICATIONS
// ============================================

function setupNotifications() {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }

    if (Notification.permission === 'granted') {
        notificationsEnabled = true;
        console.log('🔔 Notifications already enabled');
        return;
    }

    if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(permission) {
            notificationsEnabled = (permission === 'granted');
            console.log('🔔 Notification permission:', permission);
        });
    }
}

function checkSpendingAndNotify() {
    if (!notificationsEnabled) return;
    if (!state.transactions || state.transactions.length === 0) return;

    var cycle = getPayCycleDates(0);
    var progress = Math.min(cycle.daysIntoCycle / 28, 1);

    var totalSpent = state.transactions
        .filter(function(t) { return t.type === 'expense' && !isHidden(t) && isInCycle(t.date, 0); })
        .reduce(function(sum, t) {
            return sum + Math.abs(parseFloat(t.amount));
        }, 0);

    var spentRatio = state.budget > 0 ? totalSpent / state.budget : 0;

    if (spentRatio > progress + 0.15) {
        var percentSpent = Math.round(spentRatio * 100);
        var percentCycle = Math.round(progress * 100);

        var notification = new Notification('⚠️ Mission Control', {
            body: "You're " + percentSpent + "% through your budget but only " +
                percentCycle + "% through your pay cycle. Ease up, commander.",
            tag: 'spending-warning',
            requireInteraction: false
        });

        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }

    if (spentRatio < progress - 0.1 && progress > 0.25) {
        new Notification('🛸 Mission Control', {
            body: "Nice. You're under budget. " +
                Math.round((progress - spentRatio) * 100) +
                "% ahead of schedule. Keep it up.",
            tag: 'spending-good',
            requireInteraction: false
        });
    }
}

// ============================================
// IMPROVED RECURRING PAYMENT DETECTION
// ============================================
// This function looks for payments that happen regularly with:
// - Similar merchant names (fuzzy matching)
// - Similar amounts (within £3 tolerance)
// - Regular intervals (weekly, fortnightly, monthly)

function normalizePayeeName(desc) {
    // Strip out common noise from merchant names
    return desc.toLowerCase()
        .replace(/\d{2}\/\d{2}\/\d{4}/g, '')  // Remove dates
        .replace(/\d{6,}/g, '')                 // Remove reference numbers (6+ digits)
        .replace(/\b(payment|pymt|pd|paid|to|from|ref|transaction|txn)\b/gi, '') // Remove common words
        .replace(/[^a-z0-9\s]/g, '')           // Remove special characters
        .replace(/\s+/g, ' ')                   // Collapse whitespace
        .trim()
        .substring(0, 30);                      // Take first 30 chars for matching
}

function detectDirectDebits(transactions) {
    var expenses = transactions.filter(function(t) {
        return t.type === 'expense';
    });

    // Group by normalized payee name
    var grouped = {};
    expenses.forEach(function(t) {
        var normalizedName = normalizePayeeName(t.desc);
        
        // Skip if name is too short to be meaningful
        if (normalizedName.length < 3) return;
        
        if (!grouped[normalizedName]) grouped[normalizedName] = [];
        grouped[normalizedName].push({
            date: new Date(t.date),
            dayOfMonth: new Date(t.date).getDate(),
            amount: Math.abs(parseFloat(t.amount)),
            originalDesc: t.desc,
            category: t.category
        });
    });

    var directDebits = [];

    Object.keys(grouped).forEach(function(normalizedName) {
        var entries = grouped[normalizedName];

        // Need at least 2 occurrences to spot a pattern
        if (entries.length < 2) return;

        // Sort oldest first
        entries.sort(function(a, b) { return a.date - b.date; });

        // Calculate average amount
        var avgAmount = entries.reduce(function(sum, e) {
            return sum + e.amount;
        }, 0) / entries.length;

        // Check if amounts are consistent (within £3 tolerance)
        var amountsConsistent = entries.every(function(e) {
            return Math.abs(e.amount - avgAmount) < 3;
        });

        if (!amountsConsistent) return;

        // Calculate gaps between consecutive payments
        var gaps = [];
        for (var i = 1; i < entries.length; i++) {
            var daysBetween = (entries[i].date - entries[i - 1].date) / (1000 * 60 * 60 * 24);
            gaps.push(daysBetween);
        }
        
        if (gaps.length === 0) return;
        
        var avgGap = gaps.reduce(function(sum, g) { return sum + g; }, 0) / gaps.length;

        // Determine frequency based on average gap
        var frequency = null;
        if (avgGap >= 24 && avgGap <= 37) frequency = 'monthly';       // 28-31 days ±3
        else if (avgGap >= 12 && avgGap <= 16) frequency = 'fortnightly'; // 14 days ±2
        else if (avgGap >= 5 && avgGap <= 9) frequency = 'weekly';        // 7 days ±2

        if (!frequency) return;

        // Find the most common day-of-month for monthly payments
        var mostFrequentDay = 1;
        if (frequency === 'monthly') {
            var dayCounts = {};
            entries.forEach(function(e) {
                var day = e.dayOfMonth;
                dayCounts[day] = (dayCounts[day] || 0) + 1;
            });

            var maxCount = 0;
            Object.keys(dayCounts).forEach(function(day) {
                if (dayCounts[day] > maxCount) {
                    maxCount = dayCounts[day];
                    mostFrequentDay = parseInt(day);
                }
            });

            // Verify that most payments fall within ±3 days of this day
            var nearTarget = entries.filter(function(e) {
                var diff = Math.abs(e.dayOfMonth - mostFrequentDay);
                // Handle month wraparound (e.g., 30th vs 2nd)
                if (diff > 15) diff = Math.abs(30 - diff);
                return diff <= 3;
            });

            // If less than 60% of payments are near the target day, skip it
            if (nearTarget.length / entries.length < 0.6) return;
        } else {
            // For weekly/fortnightly, just use the last payment's day
            mostFrequentDay = entries[entries.length - 1].dayOfMonth;
        }

        // Calculate next payment date
        var lastPayment = entries[entries.length - 1];
        var nextDate = new Date(lastPayment.date);
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        // Advance to next occurrence
        if (frequency === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
            // Handle month-end dates (e.g., Jan 31 → Feb 28)
            if (nextDate.getDate() !== lastPayment.dayOfMonth && lastPayment.dayOfMonth > 28) {
                nextDate.setDate(0); // Last day of previous month
            }
        } else if (frequency === 'fortnightly') {
            nextDate.setDate(nextDate.getDate() + 14);
        } else {
            nextDate.setDate(nextDate.getDate() + 7);
        }

        // If calculated date is in the past, advance until it's in the future
        var safety = 0;
        while (nextDate < today && safety < 100) {
            if (frequency === 'monthly') {
                nextDate.setMonth(nextDate.getMonth() + 1);
            } else if (frequency === 'fortnightly') {
                nextDate.setDate(nextDate.getDate() + 14);
            } else {
                nextDate.setDate(nextDate.getDate() + 7);
            }
            safety++;
        }

        directDebits.push({
            name: entries[0].originalDesc,  // Use the original merchant name
            category: entries[0].category,
            amount: avgAmount.toFixed(2),
            dayOfMonth: mostFrequentDay,
            frequency: frequency,
            occurrences: entries.length,
            lastPaid: lastPayment.date,
            nextDue: nextDate,
            annualCost: (avgAmount * (frequency === 'monthly' ? 12 :
                frequency === 'fortnightly' ? 26 : 52)).toFixed(2)
        });
    });

    // Sort by next due date — soonest first
    directDebits.sort(function(a, b) { return a.nextDue - b.nextDue; });

    return directDebits;
}

function renderDirectDebits() {
    var container = document.getElementById('directdebit-content');
    if (!container) return;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var cycle = getPayCycleDates(0);

    // Calculate when each bill is next due
    var billsWithDates = state.recurringBills.map(function(bill) {
        var nextDate = new Date(today);
        nextDate.setDate(bill.dayOfMonth);
        
        // If we've passed that day this month, move to next month
        if (nextDate < today) {
            nextDate.setMonth(nextDate.getMonth() + 1);
        }
        
        // Handle month-end dates
        if (nextDate.getDate() !== bill.dayOfMonth) {
            nextDate.setDate(0); // Last day of previous month
        }
        
        return {
            name: bill.name,
            category: bill.category,
            amount: parseFloat(bill.amount),
            dayOfMonth: bill.dayOfMonth,
            nextDue: nextDate,
            id: bill.id
        };
    });

    // Sort by next due date
    billsWithDates.sort(function(a, b) { return a.nextDue - b.nextDue; });

    if (billsWithDates.length === 0) {
        container.innerHTML = '<p style="opacity:0.5; text-align:center;">No recurring bills added yet.<br><span style="font-size:0.8em;">Click "Add Bill" to manually track your monthly payments.</span></p>' +
            '<button class="btn btn-primary" onclick="openAddBillModal()" style="margin:16px auto; display:block;">+ Add Bill</button>';
        return;
    }

    // Calculate totals
    var monthlyTotal = billsWithDates.reduce(function(sum, bill) {
        return sum + bill.amount;
    }, 0);

    var upcoming = billsWithDates.filter(function(bill) {
        return bill.nextDue >= today && bill.nextDue <= cycle.end;
    });

    var html = '';

    // Summary header with Add Bill button
    html += '<div style="display:flex; gap:8px; margin-bottom:16px; align-items:stretch;">';
    html += '  <div style="flex:1; text-align:center; padding:12px; background:rgba(168,85,247,0.15); border-radius:8px;">';
    html += '    <div style="font-size:0.7em; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Monthly Recurring</div>';
    html += '    <div style="font-size:1.4em; font-weight:bold;">£' + monthlyTotal.toFixed(2) + '</div>';
    html += '  </div>';
    html += '  <div style="flex:1; text-align:center; padding:12px; background:rgba(168,85,247,0.15); border-radius:8px;">';
    html += '    <div style="font-size:0.7em; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Coming This Cycle</div>';
    html += '    <div style="font-size:1.4em; font-weight:bold;">' + upcoming.length + ' payment' + (upcoming.length !== 1 ? 's' : '') + '</div>';
    html += '  </div>';
    html += '  <button class="btn btn-primary" onclick="openAddBillModal()" style="padding:12px 20px; white-space:nowrap;">+ Add Bill</button>';
    html += '</div>';

    // Upcoming this cycle
    if (upcoming.length > 0) {
        html += '<div style="font-size:0.75em; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">⏰ Due This Cycle</div>';

        upcoming.forEach(function(bill) {
            var daysUntil = Math.ceil((bill.nextDue - today) / (1000 * 60 * 60 * 24));
            var dateStr = bill.nextDue.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            var color = CAT_COLORS[bill.category] || '#64748b';

            var urgencyColor, urgencyLabel;
            if (daysUntil === 0) {
                urgencyColor = '#ef4444';
                urgencyLabel = 'TODAY';
            } else if (daysUntil === 1) {
                urgencyColor = '#f97316';
                urgencyLabel = 'TOMORROW';
            } else if (daysUntil <= 3) {
                urgencyColor = '#f59e0b';
                urgencyLabel = daysUntil + ' days';
            } else {
                urgencyColor = '#22c55e';
                urgencyLabel = daysUntil + ' days';
            }

            html += '<div class="bill-item" data-bill-id="' + bill.id + '">';
            html += '  <div style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; border-left:3px solid ' + urgencyColor + ';">';
            html += '    <div style="min-width:70px; text-align:center; margin-right:12px;">';
            html += '      <div style="font-size:0.7em; color:' + urgencyColor + '; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">' + urgencyLabel + '</div>';
            html += '      <div style="font-size:0.75em; opacity:0.5;">' + dateStr + '</div>';
            html += '    </div>';
            html += '    <div style="flex:1; min-width:0;">';
            html += '      <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(bill.name) + '</div>';
            html += '      <div style="font-size:0.75em; opacity:0.5;"><span style="color:' + color + ';">' + bill.category + '</span> · monthly</div>';
            html += '    </div>';
            html += '    <div style="font-weight:bold; font-size:1.1em; margin-left:8px;">£' + bill.amount.toFixed(2) + '</div>';
            html += '    <button class="bill-delete-btn" onclick="deleteRecurringBill(' + bill.id + ')" title="Delete">🗑️</button>';
            html += '  </div>';
            html += '</div>';
        });

        var upcomingTotal = upcoming.reduce(function(sum, bill) {
            return sum + bill.amount;
        }, 0);
        html += '<div style="text-align:right; font-size:0.8em; opacity:0.6; margin-top:4px; margin-bottom:20px;">Total upcoming: <strong>£' + upcomingTotal.toFixed(2) + '</strong></div>';
    }

    // All bills
    html += '<div style="font-size:0.75em; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; margin-top:16px;">📋 All Monthly Bills</div>';

    billsWithDates.forEach(function(bill) {
        var dateStr = bill.nextDue.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        var color = CAT_COLORS[bill.category] || '#64748b';
        var dayLabel = getOrdinal(bill.dayOfMonth);

        html += '<div class="bill-item" data-bill-id="' + bill.id + '">';
        html += '  <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.04);">';
        html += '    <div style="flex:1; min-width:0;">';
        html += '      <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(bill.name) + '</div>';
        html += '      <div style="font-size:0.7em; opacity:0.5;">';
        html += '        <span style="color:' + color + ';">' + bill.category + '</span>';
        html += '        · monthly · usually the ' + dayLabel;
        html += '      </div>';
        html += '    </div>';
        html += '    <div style="text-align:right; margin-left:12px; display:flex; align-items:center; gap:12px;">';
        html += '      <div>';
        html += '        <div style="font-weight:bold; font-size:0.95em;">£' + bill.amount.toFixed(2) + '</div>';
        html += '        <div style="font-size:0.65em; opacity:0.4;">£' + (bill.amount * 12).toFixed(2) + '/yr</div>';
        html += '      </div>';
        html += '      <button class="bill-delete-btn" onclick="deleteRecurringBill(' + bill.id + ')" title="Delete">🗑️</button>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

// Helper: turns 1 into "1st", 2 into "2nd", etc.
function getOrdinal(n) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================
// SPENDING HEATMAP
// ============================================

function getSpendingHeatmap(transactions) {
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    var heatmap = {};
    days.forEach(function(d) {
        heatmap[d] = { total: 0, count: 0 };
    });

    transactions
        .filter(function(t) { return t.type === 'expense' && !isHidden(t); })
        .forEach(function(t) {
            var date = new Date(t.date);
            var dayIndex = (date.getDay() + 6) % 7;
            var dayName = days[dayIndex];
            heatmap[dayName].total += Math.abs(parseFloat(t.amount));
            heatmap[dayName].count += 1;
        });

    var maxTotal = 0;
    days.forEach(function(d) {
        if (heatmap[d].total > maxTotal) maxTotal = heatmap[d].total;
    });

    return days.map(function(day) {
        var intensity = maxTotal > 0 ? heatmap[day].total / maxTotal : 0;
        return {
            day: day,
            total: heatmap[day].total.toFixed(2),
            avg: heatmap[day].count > 0
                ? (heatmap[day].total / heatmap[day].count).toFixed(2)
                : '0.00',
            intensity: intensity,
            count: heatmap[day].count
        };
    });
}

function renderHeatmap() {
    var container = document.getElementById('heatmap-content');
    if (!container) return;

    var filterPeriod = document.getElementById('filterPeriod');
    var period = filterPeriod ? filterPeriod.value : 'cycle_0';
    var txs = state.transactions.slice();
    if (period === 'cycle_0') txs = txs.filter(function(tx) { return isInCycle(tx.date, 0); });
    else if (period === 'cycle_-1') txs = txs.filter(function(tx) { return isInCycle(tx.date, -1); });

    var data = getSpendingHeatmap(txs);

    var hasData = data.some(function(d) { return d.count > 0; });
    if (!hasData) {
        container.innerHTML = '<p style="opacity:0.5; text-align:center;">No spending data yet</p>';
        return;
    }

    var worstDay = data.reduce(function(worst, current) {
        return parseFloat(current.total) > parseFloat(worst.total) ? current : worst;
    });

    var html = '<div style="display:flex; justify-content:space-between; gap:6px; margin-bottom:14px;">';

    data.forEach(function(d) {
        var alpha = 0.15 + (d.intensity * 0.85);
        var borderStyle = d.day === worstDay.day && worstDay.count > 0
            ? 'border: 2px solid rgba(168, 85, 247, 0.9);'
            : 'border: 1px solid rgba(255,255,255,0.05);';

        html += '<div style="flex:1; text-align:center;">';
        html += '  <div style="background:rgba(168, 85, 247, ' + alpha + '); ' +
            'border-radius:10px; padding:12px 4px; margin-bottom:6px; ' +
            borderStyle + '">';
        html += '    <div style="font-size:1.1em; font-weight:bold;">£' + d.total + '</div>';
        html += '    <div style="font-size:0.7em; opacity:0.7; margin-top:2px;">' + d.count + ' txns</div>';
        html += '    <div style="font-size:0.65em; opacity:0.5; margin-top:1px;">avg £' + d.avg + '</div>';
        html += '  </div>';
        html += '  <div style="font-size:0.85em; opacity:0.8; font-weight:500;">' + d.day + '</div>';
        html += '</div>';
    });

    html += '</div>';

    if (worstDay.count > 0) {
        html += '<div style="text-align:center; font-size:0.85em; opacity:0.7; margin-top:12px; padding:10px; background:rgba(168,85,247,0.1); border-radius:8px;">';
        html += '💸 You bleed the most cash on <strong>' + worstDay.day + 's</strong>';
        html += ' — £' + worstDay.total + ' total';
        html += '</div>';
    }

    container.innerHTML = html;
}

// ============================================
// FUTURE YOU PROJECTION
// ============================================

function projectBalance(transactions, currentBalance, daysToProject) {
    if (!daysToProject) daysToProject = 30;

    var expenses = transactions.filter(function(t) {
        return t.type === 'expense' && !isHidden(t);
    });

    if (expenses.length === 0) return null;

    var dates = expenses.map(function(t) { return new Date(t.date).getTime(); });
    var earliest = new Date(Math.min.apply(null, dates));
    var latest = new Date(Math.max.apply(null, dates));

    var totalDays = Math.max(1, (latest - earliest) / (1000 * 60 * 60 * 24));

    var totalSpent = expenses.reduce(function(sum, t) {
        return sum + Math.abs(parseFloat(t.amount));
    }, 0);
    var dailyRate = totalSpent / totalDays;

    var projection = [];
    var balance = currentBalance;
    var brokeDay = null;

    for (var i = 0; i <= daysToProject; i++) {
        var date = new Date();
        date.setDate(date.getDate() + i);

        if (balance <= 0 && !brokeDay) brokeDay = i;

        projection.push({
            date: date.toISOString().split('T')[0],
            dayLabel: i === 0 ? 'Today' : 'Day ' + i,
            balance: Math.max(0, balance).toFixed(2),
            danger: balance < currentBalance * 0.2
        });

        balance -= dailyRate;
    }

    return {
        projection: projection,
        dailyRate: dailyRate.toFixed(2),
        brokeDay: brokeDay,
        daysUntilBroke: brokeDay ? brokeDay + ' days' : 'You survive! 🎉'
    };
}

function renderProjection() {
    var container = document.getElementById('projection-content');
    if (!container) return;

    var cycleTxs = state.transactions.filter(function(t) {
        return isInCycle(t.date, 0) && !isHidden(t);
    });

    var expenses = cycleTxs.filter(function(t) { return t.type === 'expense'; });
    var totalSpent = expenses.reduce(function(sum, t) {
        return sum + Math.abs(parseFloat(t.amount));
    }, 0);
    var remaining = state.budget - totalSpent;

    if (remaining <= 0 || cycleTxs.length === 0) {
        container.innerHTML = '<p style="opacity:0.5; text-align:center;">Need transaction data to project</p>';
        return;
    }

    var cycle = getPayCycleDates(0);
    var daysLeft = Math.max(1, cycle.daysLeft);

    var result = projectBalance(cycleTxs, remaining, daysLeft);
    if (!result) {
        container.innerHTML = '<p style="opacity:0.5;">Not enough data</p>';
        return;
    }

    var html = '';

    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px;">';
    html += '  <div style="font-size:0.85em;"><span style="opacity:0.6;">Burn rate:</span> <strong>£' + result.dailyRate + '/day</strong></div>';
    html += '  <div style="font-size:0.85em;">';
    if (result.brokeDay) {
        html += '<span style="opacity:0.6;">Broke in:</span> <strong style="color:#ef4444;">' + result.daysUntilBroke + '</strong>';
    } else {
        html += '<strong style="color:#22c55e;">You make it to payday! 🎉</strong>';
    }
    html += '  </div>';
    html += '</div>';

    html += '<div style="display:flex; flex-direction:column; gap:3px;">';

    var maxBalance = parseFloat(result.projection[0].balance);

    result.projection.forEach(function(day, idx) {
        var barWidth = maxBalance > 0 ? (parseFloat(day.balance) / maxBalance) * 100 : 0;

        var colour;
        if (day.danger) colour = 'rgba(239, 68, 68, 0.8)';
        else if (barWidth < 50) colour = 'rgba(234, 179, 8, 0.7)';
        else colour = 'rgba(168, 85, 247, 0.7)';

        // Only show every other day after day 7 to reduce clutter
        if (idx > 7 && idx % 2 === 1) return;

        html += '<div style="display:flex; align-items:center; gap:8px; font-size:0.75em;">';
        html += '  <div style="width:55px; opacity:0.6; text-align:right; font-size:0.9em;">' + day.dayLabel + '</div>';
        html += '  <div style="flex:1; background:rgba(255,255,255,0.05); border-radius:4px; height:18px; overflow:hidden;">';
        html += '    <div style="width:' + barWidth + '%; height:100%; background:' + colour + '; border-radius:4px; transition: width 0.3s;"></div>';
        html += '  </div>';
        html += '  <div style="width:60px; font-size:0.95em; font-weight:500;">£' + day.balance + '</div>';
        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
}

// ---------- PAY CYCLE ----------
function getPayCycleDates(offset) {
    if (offset === undefined) offset = 0;
    var anchorPay = new Date(2026, 2, 5); // March 5th, 2026 (month is 0-indexed)
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var msPerCycle = 28 * 24 * 60 * 60 * 1000;
    var cycleStart = new Date(anchorPay);
    if (now >= anchorPay) {
        while (cycleStart.getTime() + msPerCycle <= now.getTime()) {
            cycleStart = new Date(cycleStart.getTime() + msPerCycle);
        }
    } else {
        while (cycleStart > now) {
            cycleStart = new Date(cycleStart.getTime() - msPerCycle);
        }
    }
    if (offset !== 0) {
        cycleStart = new Date(cycleStart.getTime() + (offset * msPerCycle));
    }
    var cycleEnd = new Date(cycleStart.getTime() + msPerCycle - 1);
    var daysIntoCycle = 28;
    var daysLeft = 0;
    if (offset === 0) {
        daysIntoCycle = Math.floor((now - cycleStart) / (24 * 60 * 60 * 1000)) + 1;
        daysLeft = 28 - daysIntoCycle;
    }
    return { start: cycleStart, end: cycleEnd, daysIntoCycle: daysIntoCycle, daysLeft: daysLeft };
}

function isInCycle(dateStr, offset) {
    if (offset === undefined) offset = 0;
    var cycle = getPayCycleDates(offset);
    var d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d >= cycle.start && d <= cycle.end;
}

function getActiveOffset() {
    var el = document.getElementById('filterPeriod');
    if (!el) return 0;
    if (el.value === 'cycle_-1') return -1;
    return 0;
}

function isAllTime() {
    var el = document.getElementById('filterPeriod');
    return el && el.value === 'all';
}

// ---------- DATA HELPERS ----------
function isHidden(tx) { return HIDDEN_TAGS.indexOf(tx.category) !== -1; }

function getCycleIncome(offset) {
    if (offset === undefined) offset = 0;
    return state.transactions.filter(function(tx) {
        return !isHidden(tx) && tx.type === 'income' && isInCycle(tx.date, offset);
    }).reduce(function(s, tx) { return s + tx.amount; }, 0);
}

function getCycleExpenses(offset) {
    if (offset === undefined) offset = 0;
    return state.transactions.filter(function(tx) {
        return !isHidden(tx) && tx.type === 'expense' && isInCycle(tx.date, offset);
    }).reduce(function(s, tx) { return s + tx.amount; }, 0);
}

function getAvailableCash(offset) {
    if (offset === undefined) offset = 0;
    return getCycleIncome(offset) - getCycleExpenses(offset);
}

// ---------- AUTO CATEGORIZE ----------
function autoCategory(description) {
    var d = description.toLowerCase();
    if (/mandy anne lutman.*plum/i.test(description)) return '🔄 Internal Transfer';
    if (/miss m a lutman sto/i.test(description)) return '🔄 Internal Transfer';
    if (/202682 03442446.*optional/i.test(description)) return '🔄 Internal Transfer';
    if (/plum fintech/i.test(description)) return '🔄 Internal Transfer';
    if (d.indexOf('moneybox') !== -1) return '💰 Savings';
    if (/plum\b.*ddr/i.test(description) && d.indexOf('fee') === -1) return '💰 Savings';
    if (/plum\b.*fee/i.test(description)) return '🏦 Bank Fees';
    if (d.indexOf('my jaja card') !== -1) return '💳 Credit Card Payment';
    if (d.indexOf('capital one') !== -1) return '💳 Credit Card Payment';
    if (d.indexOf('wescot') !== -1) return '💳 Credit Card Payment';
    if (d.indexOf('primark stores ltd') !== -1) return '💰 Salary';
    if (d.indexOf('trinity estates') !== -1) return '🏠 Rent';
    if (/basingstoke.*dean/i.test(description)) return '🏠 Bills';
    if (d.indexOf('council tax') !== -1) return '🏠 Bills';
    if (d.indexOf('british gas') !== -1 || d.indexOf('bg services') !== -1) return '🏠 Bills';
    if (d.indexOf('ovo energy') !== -1) return '🏠 Bills';
    if (d.indexOf('south east water') !== -1) return '🏠 Bills';
    if (d.indexOf('tv licens') !== -1) return '🏠 Bills';
    if (d.indexOf('sky digital') !== -1) return '📱 Subscriptions';
    if (d.indexOf('animal friends') !== -1) return '🐾 Maya & Dobby';
    if (d.indexOf('tails.com') !== -1) return '🐾 Maya & Dobby';
    if (d.indexOf('zooplus') !== -1) return '🐾 Maya & Dobby';
    if (d.indexOf('untamed') !== -1) return '🐾 Maya & Dobby';
    if (d.indexOf('anahi') !== -1) return '💊 Therapy';
    if (d.indexOf('gll better') !== -1) return '💪 Gym & Fitness';
    if (d.indexOf('unwfp') !== -1) return '❤️ Charity';
    if (d.indexOf('deliveroo') !== -1) return '🍕 Takeaway';
    if (d.indexOf('just eat') !== -1) return '🍕 Takeaway';
    if (d.indexOf('uber eats') !== -1) return '🍕 Takeaway';
    if (d.indexOf('pret a manger') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('cafe destino') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('caffe nero') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('muffin break') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('itsu') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('costa') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('starbucks') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('greggs') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('whittard') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('nandos') !== -1 || d.indexOf('mcdonalds') !== -1) return '☕ Coffee & Eating Out';
    if (d.indexOf('waterstones') !== -1) return '📚 Books';
    if (d.indexOf('skin + me') !== -1 || d.indexOf('skin+me') !== -1) return '💄 Self Care';
    if (d.indexOf('superdrug') !== -1) return '💄 Self Care';
    if (d.indexOf('boots') !== -1) return '💄 Self Care';
    if (d.indexOf('pharmacy') !== -1) return '💊 Health';
    if (d.indexOf('trainline') !== -1) return '🚇 Transport';
    if (d.indexOf('stagecoach') !== -1) return '🚇 Transport';
    if (d.indexOf('tfl') !== -1) return '🚇 Transport';
    if (d.indexOf('clearpay') !== -1) return '💳 Buy Now Pay Later';
    if (d.indexOf('klarna') !== -1) return '💳 Buy Now Pay Later';
    if (d.indexOf('netflix') !== -1) return '📱 Subscriptions';
    if (d.indexOf('spotify') !== -1) return '📱 Subscriptions';
    if (d.indexOf('disney') !== -1) return '📱 Subscriptions';
    if (d.indexOf('apple.com') !== -1) return '📱 Subscriptions';
    if (d.indexOf('microsoft') !== -1) return '📱 Subscriptions';
    if (d.indexOf('google youtube') !== -1) return '📱 Subscriptions';
    if (d.indexOf('google one') !== -1) return '📱 Subscriptions';
    if (d.indexOf('google cloud') !== -1) return '📱 Subscriptions';
    if (d.indexOf('google play') !== -1) return '📱 Subscriptions';
    if (d.indexOf('openai') !== -1) return '📱 Subscriptions';
    if (d.indexOf('anthropic') !== -1) return '📱 Subscriptions';
    if (d.indexOf('typingmind') !== -1) return '📱 Subscriptions';
    if (d.indexOf('discord') !== -1) return '📱 Subscriptions';
    if (d.indexOf('emma app') !== -1) return '📱 Subscriptions';
    if (d.indexOf('experian') !== -1) return '📱 Subscriptions';
    if (d.indexOf('amazon prime') !== -1) return '📱 Subscriptions';
    if (d.indexOf('lebara') !== -1) return '📞 Phone';
    if (d.indexOf('sainsbury') !== -1) return '🛒 Groceries';
    if (d.indexOf('tesco') !== -1) return '🛒 Groceries';
    if (d.indexOf('asda') !== -1) return '🛒 Groceries';
    if (d.indexOf('aldi') !== -1) return '🛒 Groceries';
    if (d.indexOf('lidl') !== -1) return '🛒 Groceries';
    if (d.indexOf('morrisons') !== -1) return '🛒 Groceries';
    if (d.indexOf('waitrose') !== -1) return '🛒 Groceries';
    if (d.indexOf('co-op') !== -1) return '🛒 Groceries';
    if (/marks.spencer/i.test(description)) return '🛒 Groceries';
    if (d.indexOf('national lottery') !== -1) return '🎮 Entertainment';
    if (d.indexOf('blue rewards fee') !== -1) return '🏦 Bank Fees';
    if (d.indexOf('dunelm') !== -1) return '🏠 Home & Kitchen';
    if (d.indexOf('robert dyas') !== -1) return '🏠 Home & Kitchen';
    if (d.indexOf('amazon') !== -1 || d.indexOf('amzn') !== -1) return '🛍️ Shopping';
    if (d.indexOf('argos') !== -1) return '🛍️ Shopping';
    if (/sports? ?direct/i.test(description)) return '🛍️ Shopping';
    if (/t ?k ?maxx/i.test(description)) return '🛍️ Shopping';
    if (d.indexOf('cotton on') !== -1) return '🛍️ Shopping';
    if (d.indexOf('paypal') !== -1) return '🛍️ Shopping';
    if (d.indexOf('asos') !== -1) return '🛍️ Shopping';
    return '📦 Other';
}

function guessType(amount, description) {
    var d = description.toLowerCase();
    if (d.indexOf('primark stores ltd') !== -1) return 'income';
    if (d.indexOf('plum fintech bgc') !== -1) return 'income';
    if (amount > 0) return 'income';
    return 'expense';
}

// ---------- CSV ----------
function parseCSVLine(line) {
    var res = []; var cur = ''; var inQ = false;
    for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
        else { cur += c; }
    }
    res.push(cur.trim());
    return res;
}

function parseDate(raw) {
    if (!raw) return null;
    var m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
        var y = parseInt(m[3]); if (y < 100) y += 2000;
        return y + '-' + String(parseInt(m[2])).padStart(2, '0') + '-' + String(parseInt(m[1])).padStart(2, '0');
    }
    var m2 = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return raw.substring(0, 10);
    var dd = new Date(raw);
    if (!isNaN(dd)) return dd.toISOString().slice(0, 10);
    return null;
}

function handleCsvUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    console.log("📁 CSV file:", file.name);
    var reader = new FileReader();
    reader.onload = function(event) {
        var text = event.target.result;
        var lines = text.split('\n').filter(function(l) { return l.trim(); });
        if (lines.length < 2) { alert('CSV looks empty.'); return; }
        csvData = lines.map(function(l) { return parseCSVLine(l); });
        var headers = csvData[0];
        console.log("Headers:", headers);
        document.getElementById('csvPreview').textContent = lines.slice(0, 6).join('\n');
        var mapDiv = document.getElementById('csvMapping');
        mapDiv.innerHTML = '';
        var fields = [
            { key: 'date', label: 'Date Column' },
            { key: 'description', label: 'Description Column' },
            { key: 'amount', label: 'Amount Column' }
        ];
        fields.forEach(function(f) {
            var selected = -1;
            headers.forEach(function(h, i) {
                var lh = h.toLowerCase();
                if (f.key === 'date' && lh.indexOf('date') !== -1) selected = i;
                if (f.key === 'description' && (lh.indexOf('desc') !== -1 || lh.indexOf('memo') !== -1 || lh.indexOf('narrative') !== -1)) selected = i;
                if (f.key === 'amount' && (lh.indexOf('amount') !== -1 || lh.indexOf('value') !== -1)) selected = i;
            });
            var options = '';
            headers.forEach(function(h, i) {
                options += '<option value="' + i + '"' + (i === selected ? ' selected' : '') + '>' + h + '</option>';
            });
            mapDiv.innerHTML += '<div class="form-group"><label>' + f.label + '</label><select class="form-input" data-field="' + f.key + '">' + options + '</select></div>';
        });
        document.getElementById('csvModal').classList.add('active');
    };
    reader.readAsText(file);
    e.target.value = '';
}

function importCsv() {
    if (!csvData || csvData.length < 2) { console.error("No CSV data"); return; }
    var selects = document.querySelectorAll('#csvMapping select');
    var map = {};
    selects.forEach(function(s) { map[s.getAttribute('data-field')] = parseInt(s.value); });
    console.log("Mapping:", map);
    var added = 0; var hidden = 0;
    for (var i = 1; i < csvData.length; i++) {
        var row = csvData[i];
        if (!row || row.length < 2) continue;
        var rawDate = row[map.date] || '';
        var desc = row[map.description] || '';
        var rawAmt = row[map.amount] || '0';
        if (!rawDate || !desc) continue;
        var date = parseDate(rawDate);
        if (!date) continue;
        rawAmt = rawAmt.replace(/[£$€,\s]/g, '');
        var num = parseFloat(rawAmt);
        if (isNaN(num)) continue;
        var amount = Math.abs(num);
        var type = guessType(num, desc);
        var category = autoCategory(desc);
        var isEssential = AUTO_ESSENTIALS.indexOf(category) !== -1;
        if (HIDDEN_TAGS.indexOf(category) !== -1) hidden++;
        var isDupe = state.transactions.some(function(t) {
            return t.date === date && t.desc === desc && Math.abs(t.amount - amount) < 0.01;
        });
        if (!isDupe) {
            state.transactions.push({ id: state.nextId++, desc: desc, amount: amount, type: type, category: category, date: date, isEssential: isEssential });
            added++;
        }
    }
    state.transactions.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    saveState(); renderAll(); populateFilterCategories();
    document.getElementById('csvModal').classList.remove('active');
    csvData = null;
    alert('🚀 Imported ' + added + ' transactions!\n🔄 ' + hidden + ' hidden.');

    checkSpendingAndNotify();
}

// ---------- RENDER ALL ----------
function renderAll() {
    try {
        renderAlertBanner();
        renderCycleBanner();
        renderInsights();
        renderBudgetProgress();
        renderHiddenSummary();
        renderTransactions();
        renderCategoryBars();
        renderAffordContext();
        renderSurvivalPanel();
        renderHeatmap();
        renderProjection();
        renderDirectDebits();
        renderCreditCards();
    } catch (e) { console.error("Render error:", e); }
}

// ---------- ALERT BANNER ----------
function renderAlertBanner() {
    var container = document.getElementById('alertBanner');
    if (!container) return;

    var available = state.availableBalance || 0;
    var cycle = getPayCycleDates(0);
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get upcoming bills this cycle
    var upcomingBills = state.recurringBills.map(function(bill) {
        var nextDate = new Date(today);
        nextDate.setDate(bill.dayOfMonth);
        if (nextDate < today) {
            nextDate.setMonth(nextDate.getMonth() + 1);
        }
        if (nextDate.getDate() !== bill.dayOfMonth) {
            nextDate.setDate(0);
        }
        return {
            amount: parseFloat(bill.amount),
            nextDue: nextDate
        };
    }).filter(function(bill) {
        return bill.nextDue >= today && bill.nextDue <= cycle.end;
    });

    var upcomingTotal = upcomingBills.reduce(function(sum, bill) {
        return sum + bill.amount;
    }, 0);

    var afterBills = available - upcomingTotal;

    var html = '';
    
    if (available === 0) {
        html = '<div style="display:flex; align-items:center; gap:12px;">';
        html += '  <span style="font-size:1.2rem;">💡</span>';
        html += '  <span>Set your available balance in Settings to see what you have left after upcoming bills.</span>';
        html += '</div>';
    } else if (upcomingBills.length === 0) {
        html = '<div style="display:flex; align-items:center; gap:12px;">';
        html += '  <span style="font-size:1.2rem;">✨</span>';
        html += '  <span>You have <strong>£' + available.toFixed(2) + '</strong> available · No bills due this cycle</span>';
        html += '</div>';
    } else {
        var icon = afterBills < 0 ? '⚠️' : afterBills < available * 0.2 ? '🔸' : '✅';
        var color = afterBills < 0 ? '#ef4444' : afterBills < available * 0.2 ? '#f59e0b' : '#22c55e';
        
        html = '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">';
        html += '  <span style="font-size:1.2rem;">' + icon + '</span>';
        html += '  <span>You have <strong>£' + available.toFixed(2) + '</strong> available</span>';
        html += '  <span style="opacity:0.6;">·</span>';
        html += '  <span><strong>' + upcomingBills.length + '</strong> bill' + (upcomingBills.length !== 1 ? 's' : '') + ' coming (£' + upcomingTotal.toFixed(2) + ')</span>';
        html += '  <span style="opacity:0.6;">·</span>';
        html += '  <span style="color:' + color + '; font-weight:600;">£' + afterBills.toFixed(2) + ' after bills</span>';
        html += '</div>';
    }

    container.innerHTML = html;
}

// ---------- RENDER ALL ----------
function renderCycleBanner() {
    var offset = getActiveOffset();
    var cycle = getPayCycleDates(offset);
    var income = getCycleIncome(offset);
    var expenses = getCycleExpenses(offset);
    var available = income - expenses;
    var dailyLeft = (offset === 0 && cycle.daysLeft > 0) ? available / cycle.daysLeft : 0;

    document.getElementById('cycleDay').textContent = offset === 0 ? cycle.daysIntoCycle : 28;
    var pct = offset === 0 ? cycle.daysIntoCycle / 28 : 1;
    var dashOff = (2 * Math.PI * 52) * (1 - pct);
    var ring = document.getElementById('cycleRingFill');
    if (ring) ring.style.strokeDashoffset = dashOff;

    var fmt = function(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
    document.getElementById('cycleDates').textContent = fmt(cycle.start) + ' → ' + fmt(cycle.end);
    var cdEl = document.getElementById('cycleCountdown');
    if (offset === 0) {
        cdEl.textContent = cycle.daysLeft === 0 ? '🎉 Payday today!' : cycle.daysLeft + ' days until payday';
    } else { cdEl.textContent = '📅 Past Cycle'; }

    document.getElementById('qsIncome').textContent = '£' + income.toFixed(2);
    document.getElementById('qsSpent').textContent = '£' + expenses.toFixed(2);
    var avEl = document.getElementById('qsAvailable');
    avEl.textContent = '£' + available.toFixed(2);
    avEl.className = 'cqs-value ' + (available >= 0 ? 'blue' : 'red');
    var dlEl = document.getElementById('qsDailyLeft');
    dlEl.textContent = offset === 0 ? '£' + dailyLeft.toFixed(2) : '—';
    dlEl.className = 'cqs-value ' + (dailyLeft >= 0 ? 'purple' : 'red');
    document.getElementById('qsSavings').textContent = '£' + (state.totalSavings || 0).toFixed(2);
}

// ---------- BUDGET ----------
function renderBudgetProgress() {
    var offset = getActiveOffset();
    var expenses = getCycleExpenses(offset);
    var budget = state.budget || 1000;
    var cycle = getPayCycleDates(offset);
    var pct = Math.min((expenses / budget) * 100, 100);
    var idealPct = offset === 0 ? (cycle.daysIntoCycle / 28) * 100 : 100;
    document.getElementById('budgetTotal').textContent = budget.toFixed(0);
    document.getElementById('budgetPctLabel').textContent = pct.toFixed(0) + '% used';
    var fill = document.getElementById('budgetProgressFill');
    if (fill) {
        fill.style.width = pct + '%';
        if (pct > 90) fill.style.background = 'linear-gradient(90deg, var(--accent-red), #f87171)';
        else if (pct > 70) fill.style.background = 'linear-gradient(90deg, var(--accent-amber), #fbbf24)';
        else fill.style.background = 'linear-gradient(90deg, var(--accent-purple), #c084fc)';
    }
    var marker = document.getElementById('budgetDayMarker');
    if (marker) marker.style.left = idealPct + '%';
    var note = document.getElementById('budgetProgressNote');
    if (note) {
        if (offset !== 0) { note.textContent = 'Past Cycle'; }
        else {
            var diff = pct - idealPct;
            if (diff > 15) note.textContent = '⚠️ ' + diff.toFixed(0) + '% ahead';
            else if (diff > 5) note.textContent = '↑ Slightly ahead';
            else if (diff < -10) note.textContent = '✨ Under budget!';
            else note.textContent = '● On track';
        }
    }
}

// ---------- INSIGHTS ----------
function renderInsights() {
    var offset = getActiveOffset();
    var cycle = getPayCycleDates(offset);
    var expenses = getCycleExpenses(offset);
    var income = getCycleIncome(offset);

    var vEl = document.getElementById('insightVelocity');
    if (vEl) {
        if (offset === 0 && cycle.daysIntoCycle > 0 && expenses > 0) {
            var projected = (expenses / cycle.daysIntoCycle) * 28;
            var cls = projected > income ? 'highlight-red' : 'highlight-green';
            vEl.innerHTML = '<span class="insight-emoji">📈</span><span class="insight-text">Projected: <span class="' + cls + '">£' + projected.toFixed(0) + '</span> this cycle.</span>';
        } else if (offset !== 0) {
            vEl.innerHTML = '<span class="insight-emoji">📉</span><span class="insight-text">Total spent: £' + expenses.toFixed(0) + '</span>';
        } else {
            vEl.innerHTML = '<span class="insight-emoji">📈</span><span class="insight-text">Not enough data yet.</span>';
        }
    }
    var sEl = document.getElementById('insightStreak');
    if (sEl) {
        var noSpend = getNoSpendDays(offset);
        sEl.innerHTML = '<span class="insight-emoji">🔥</span><span class="insight-text"><strong>' + noSpend + '</strong> no-spend days.</span>';
    }
    var fEl = document.getElementById('insightFunFact');
    if (fEl) {
        var top = getTopCategory(offset);
        if (top) {
            fEl.innerHTML = '<span class="insight-emoji">👑</span><span class="insight-text">Biggest drain: <strong>' + top.cat + '</strong> (£' + top.amount.toFixed(0) + ').</span>';
        } else {
            fEl.innerHTML = '<span class="insight-emoji">💡</span><span class="insight-text">Add data to see insights!</span>';
        }
    }
}

function getNoSpendDays(offset) {
    var cycle = getPayCycleDates(offset);
    var txs = state.transactions.filter(function(tx) { return !isHidden(tx) && tx.type === 'expense' && isInCycle(tx.date, offset); });
    var spendDates = {};
    txs.forEach(function(tx) { spendDates[tx.date] = true; });
    var count = 0;
    var d = new Date(cycle.start);
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var end = (offset === 0 && now < cycle.end) ? now : cycle.end;
    while (d <= end) {
        if (!spendDates[d.toISOString().slice(0, 10)]) count++;
        d.setDate(d.getDate() + 1);
    }
    return count;
}

function getTopCategory(offset) {
    var txs = state.transactions.filter(function(tx) { return !isHidden(tx) && tx.type === 'expense' && isInCycle(tx.date, offset); });
    if (txs.length === 0) return null;
    var totals = {};
    txs.forEach(function(tx) { totals[tx.category] = (totals[tx.category] || 0) + tx.amount; });
    var sorted = Object.entries(totals).sort(function(a, b) { return b[1] - a[1]; });
    return { cat: sorted[0][0], amount: sorted[0][1] };
}

// ---------- TRANSACTIONS ----------
function renderTransactions() {
    var list = document.getElementById('transactionList');
    if (!list) return;
    var filterCat = document.getElementById('filterCategory').value;
    var filterType = document.getElementById('filterType').value;
    var filterPeriod = document.getElementById('filterPeriod').value;
    var filterSearch = document.getElementById('filterSearch').value.toLowerCase();

    var txs = state.transactions.slice();
    if (!state.showHidden) txs = txs.filter(function(tx) { return !isHidden(tx); });
    if (filterPeriod === 'cycle_0') txs = txs.filter(function(tx) { return isInCycle(tx.date, 0); });
    else if (filterPeriod === 'cycle_-1') txs = txs.filter(function(tx) { return isInCycle(tx.date, -1); });
    if (filterCat !== 'all') txs = txs.filter(function(tx) { return tx.category === filterCat; });

    if (filterType === 'income') txs = txs.filter(function(tx) { return tx.type === 'income'; });
    else if (filterType === 'expense') txs = txs.filter(function(tx) { return tx.type === 'expense'; });
    else if (filterType === 'essential') txs = txs.filter(function(tx) { return tx.isEssential && tx.type === 'expense'; });
    else if (filterType === 'nonessential') txs = txs.filter(function(tx) { return !tx.isEssential && tx.type === 'expense'; });

    if (filterSearch) txs = txs.filter(function(tx) { return tx.desc.toLowerCase().indexOf(filterSearch) !== -1; });
    txs.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    var label = document.getElementById('chartPeriodLabel');
    if (label) {
        if (filterPeriod === 'cycle_0') label.textContent = 'This Pay Cycle';
        else if (filterPeriod === 'cycle_-1') label.textContent = 'Last Pay Cycle';
        else label.textContent = 'All Time';
    }

    if (txs.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">🚀</span><p>No transactions found.</p></div>';
        return;
    }

    var html = '';
    txs.forEach(function(tx) {
        var color = CAT_COLORS[tx.category] || '#64748b';
        var dateFmt = new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        var hiddenClass = isHidden(tx) ? 'tx-hidden' : '';
        var essItemClass = tx.isEssential ? 'is-essential' : '';
        var essClass = tx.isEssential ? 'active' : '';
        var sign = tx.type === 'income' ? '+' : '-';
        var essBadge = tx.isEssential ? '<span class="tx-essential-badge">🛡️ ESSENTIAL</span>' : '';

        html += '<div class="tx-item ' + hiddenClass + ' ' + essItemClass + '">' +
            '<div class="tx-details">' +
            '<div class="tx-desc">' + escapeHtml(tx.desc) + '</div>' +
            '<div class="tx-meta">' +
            '<span class="tx-cat-badge" onclick="openCatEdit(' + tx.id + ')" style="color: ' + color + '">' + tx.category + '</span>' +
            essBadge +
            '<span class="tx-date">' + dateFmt + '</span>' +
            '</div></div>' +
            '<span class="tx-amount ' + tx.type + '">' + sign + '£' + tx.amount.toFixed(2) + '</span>' +
            '<div class="tx-actions">' +
            '<button class="tx-btn tx-essential ' + essClass + '" onclick="toggleEssential(' + tx.id + ')" title="' + (tx.isEssential ? 'Remove Essential' : 'Mark Essential') + '">🛡️</button>' +
            '<button class="tx-btn tx-delete" onclick="deleteTransaction(' + tx.id + ')" title="Delete">🗑️</button>' +
            '</div></div>';
    });
    list.innerHTML = html;
}

// ---------- CATEGORY BARS ----------
function renderCategoryBars() {
    var container = document.getElementById('categoryBars');
    if (!container) return;
    var filterPeriod = document.getElementById('filterPeriod').value;
    var txs = state.transactions.filter(function(tx) { return !isHidden(tx) && tx.type === 'expense'; });
    if (filterPeriod === 'cycle_0') txs = txs.filter(function(tx) { return isInCycle(tx.date, 0); });
    else if (filterPeriod === 'cycle_-1') txs = txs.filter(function(tx) { return isInCycle(tx.date, -1); });
    if (txs.length === 0) { container.innerHTML = '<div class="empty-state-small">No expenses for this period</div>'; return; }
    var catTotals = {};
    txs.forEach(function(tx) { catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount; });
    var sorted = Object.entries(catTotals).sort(function(a, b) { return b[1] - a[1]; });
    var maxAmount = sorted[0][1];
    var totalSpent = sorted.reduce(function(sum, e) { return sum + e[1]; }, 0);
    var html = '';
    sorted.forEach(function(entry) {
        var cat = entry[0]; var amount = entry[1];
        var percent = (amount / maxAmount) * 100;
        var ofTotal = ((amount / totalSpent) * 100).toFixed(0);
        var color = CAT_COLORS[cat] || '#64748b';
        html += '<div class="cat-bar-item"><div class="cat-bar-header"><span class="cat-bar-name">' + cat + '</span><span class="cat-bar-amount">£' + amount.toFixed(2) + ' (' + ofTotal + '%)</span></div><div class="cat-bar-track"><div class="cat-bar-fill" style="width: ' + percent + '%; background: ' + color + ';"></div></div></div>';
    });
    container.innerHTML = html;
}

// ---------- SURVIVAL PANEL ----------
function renderSurvivalPanel() {
    var container = document.getElementById('survivalStats');
    if (!container) return;
    var offset = getActiveOffset();
    var txs = state.transactions.filter(function(tx) {
        return !isHidden(tx) && tx.type === 'expense' && isInCycle(tx.date, offset);
    });

    var essentialSpend = 0;
    var discretionarySpend = 0;
    var essCatTotals = {};

    txs.forEach(function(tx) {
        if (tx.isEssential) {
            essentialSpend += tx.amount;
            essCatTotals[tx.category] = (essCatTotals[tx.category] || 0) + tx.amount;
        } else {
            discretionarySpend += tx.amount;
        }
    });

    var totalSpend = essentialSpend + discretionarySpend;
    var income = getCycleIncome(offset);
    var potentialSavings = Math.max(income - essentialSpend, 0);

    if (totalSpend === 0) {
        container.innerHTML = '<div class="empty-state-small">No expense data for this period</div>';
        return;
    }

    var essPct = (essentialSpend / totalSpend) * 100;
    var discPct = (discretionarySpend / totalSpend) * 100;

    var essSorted = Object.entries(essCatTotals).sort(function(a, b) { return b[1] - a[1]; });
    var catListHtml = '';
    if (essSorted.length > 0) {
        catListHtml = '<div class="survival-cat-list">';
        catListHtml += '<div style="font-size: 0.7rem; color: #8888a0; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Essential Breakdown</div>';
        essSorted.forEach(function(entry) {
            catListHtml += '<div class="survival-cat-item"><span class="cat-name">' + entry[0] + '</span><span class="cat-amount">£' + entry[1].toFixed(2) + '</span></div>';
        });
        catListHtml += '</div>';
    }

    container.innerHTML =
        '<div class="survival-row main"><span>🛡️ Essential</span><span class="survival-val blue">£' + essentialSpend.toFixed(2) + '</span></div>' +
        '<div class="survival-bar-bg"><div class="survival-bar-fill essential" style="width: ' + essPct + '%"></div></div>' +
        '<div class="survival-row main" style="margin-top: 12px"><span>🎉 Discretionary</span><span class="survival-val red">£' + discretionarySpend.toFixed(2) + '</span></div>' +
        '<div class="survival-bar-bg"><div class="survival-bar-fill discretionary" style="width: ' + discPct + '%"></div></div>' +
        '<div class="survival-row total"><span>💰 Max Savings Potential</span><span class="survival-val green">£' + potentialSavings.toFixed(2) + '</span></div>' +
        '<div style="font-size: 0.7rem; color: #8888a0; margin-top: 2px; font-style: italic;">(Income £' + income.toFixed(0) + ' minus Essentials)</div>' +
        catListHtml;
}

// ---------- AFFORD ----------
function renderAffordContext() {
    var available = getAvailableCash(0);
    var cycle = getPayCycleDates(0);
    var ctx = document.getElementById('affordContext');
    if (ctx) ctx.innerHTML = 'Available: <strong>£' + available.toFixed(2) + '</strong> · ' + cycle.daysLeft + ' days left';
}

function checkAfford() {
    var item = document.getElementById('affordItem').value.trim() || 'that';
    var amount = parseFloat(document.getElementById('affordAmount').value);
    var resultDiv = document.getElementById('affordResult');
    if (!amount) { resultDiv.style.display = 'none'; return; }
    var available = getAvailableCash(0);
    var after = available - amount;
    resultDiv.style.display = 'block';
    if (amount > available) {
        resultDiv.className = 'afford-result no';
        resultDiv.innerHTML = '❌ Nope. <strong>' + escapeHtml(item) + '</strong> costs £' + amount.toFixed(2) + ' but you only have £' + available.toFixed(2) + '.';
    } else {
        resultDiv.className = 'afford-result yes';
        resultDiv.innerHTML = '✅ Yes! You\'ll still have £' + after.toFixed(2) + ' left.';
    }
}

// ---------- HIDDEN SUMMARY ----------
function renderHiddenSummary() {
    var count = state.transactions.filter(function(tx) { return isHidden(tx); }).length;
    var el = document.getElementById('hiddenSummary');
    if (el) {
        if (count > 0) {
            el.style.display = 'flex';
            document.getElementById('hiddenCount').textContent = count;
            document.getElementById('toggleHidden').textContent = state.showHidden ? 'Hide' : 'Show';
        } else { el.style.display = 'none'; }
    }
}

// ---------- CREDIT CARD MANAGEMENT ----------
function renderCreditCards() {
    var container = document.getElementById('creditCards-content');
    if (!container) return;

    if (state.creditCards.length === 0) {
        container.innerHTML = '<p style="opacity:0.5; text-align:center;">No credit cards added yet.<br><span style="font-size:0.8em;">Track what you owe across cards.</span></p>' +
            '<button class="btn btn-primary" onclick="openAddCardModal()" style="margin:16px auto; display:block;">+ Add Card</button>';
        return;
    }

    var totalOwed = state.creditCards.reduce(function(sum, card) {
        return sum + parseFloat(card.balance);
    }, 0);

    var html = '';

    // Header with total and add button
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">';
    html += '  <div style="text-align:center; padding:12px; background:rgba(239,68,68,0.15); border-radius:8px; flex:1;">';
    html += '    <div style="font-size:0.7em; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Total Owed</div>';
    html += '    <div style="font-size:1.4em; font-weight:bold; color:#ef4444;">£' + totalOwed.toFixed(2) + '</div>';
    html += '  </div>';
    html += '  <button class="btn btn-primary" onclick="openAddCardModal()" style="margin-left:12px;">+ Add Card</button>';
    html += '</div>';

    // Card list
    state.creditCards.forEach(function(card) {
        var barWidth = card.limit > 0 ? (card.balance / card.limit) * 100 : 0;
        var color = barWidth > 90 ? '#ef4444' : barWidth > 70 ? '#f59e0b' : '#22c55e';

        html += '<div style="padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px;">';
        html += '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
        html += '    <div style="font-weight:600;">' + escapeHtml(card.name) + '</div>';
        html += '    <div style="display:flex; align-items:center; gap:12px;">';
        html += '      <div style="text-align:right;">';
        html += '        <div style="font-weight:bold; color:#ef4444;">£' + card.balance.toFixed(2) + '</div>';
        if (card.limit > 0) {
            html += '        <div style="font-size:0.7em; opacity:0.5;">of £' + card.limit.toFixed(2) + '</div>';
        }
        html += '      </div>';
        html += '      <button class="tx-btn tx-delete" onclick="deleteCreditCard(' + card.id + ')" title="Delete" style="opacity:0.5;">🗑️</button>';
        html += '    </div>';
        html += '  </div>';
        
        if (card.limit > 0) {
            html += '  <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">';
            html += '    <div style="width:' + Math.min(barWidth, 100) + '%; height:100%; background:' + color + '; transition:width 0.3s;"></div>';
            html += '  </div>';
        }
        
        html += '</div>';
    });

    container.innerHTML = html;
}

function openAddCardModal() {
    document.getElementById('addCardModal').classList.add('active');
}

function addCreditCard() {
    var name = document.getElementById('cardName').value.trim();
    var balance = parseFloat(document.getElementById('cardBalance').value) || 0;
    var limit = parseFloat(document.getElementById('cardLimit').value) || 0;

    if (!name) {
        alert('Enter card name!');
        return;
    }

    var nextId = 1;
    if (state.creditCards.length > 0) {
        nextId = Math.max.apply(null, state.creditCards.map(function(c) { return c.id; })) + 1;
    }

    state.creditCards.push({
        id: nextId,
        name: name,
        balance: balance,
        limit: limit
    });

    saveState();
    renderCreditCards();
    document.getElementById('addCardModal').classList.remove('active');
    
    // Clear form
    document.getElementById('cardName').value = '';
    document.getElementById('cardBalance').value = '';
    document.getElementById('cardLimit').value = '';
}

function deleteCreditCard(id) {
    if (!confirm('Delete this credit card?')) return;
    state.creditCards = state.creditCards.filter(function(c) { return c.id !== id; });
    saveState();
    renderCreditCards();
}

// ---------- RECURRING BILLS MANAGEMENT ----------
function openAddBillModal() {
    document.getElementById('addBillModal').classList.add('active');
}

function addRecurringBill() {
    var name = document.getElementById('billName').value.trim();
    var amount = parseFloat(document.getElementById('billAmount').value);
    var dayOfMonth = parseInt(document.getElementById('billDay').value);
    var category = document.getElementById('billCategory').value;

    if (!name || !amount || !dayOfMonth) {
        alert('Fill in all fields!');
        return;
    }

    if (dayOfMonth < 1 || dayOfMonth > 31) {
        alert('Day must be between 1 and 31');
        return;
    }

    var nextId = 1;
    if (state.recurringBills.length > 0) {
        nextId = Math.max.apply(null, state.recurringBills.map(function(b) { return b.id; })) + 1;
    }

    state.recurringBills.push({
        id: nextId,
        name: name,
        amount: amount,
        dayOfMonth: dayOfMonth,
        category: category
    });

    saveState();
    renderDirectDebits();
    document.getElementById('addBillModal').classList.remove('active');
    
    // Clear form
    document.getElementById('billName').value = '';
    document.getElementById('billAmount').value = '';
    document.getElementById('billDay').value = '';
}

function deleteRecurringBill(id) {
    if (!confirm('Delete this recurring bill?')) return;
    state.recurringBills = state.recurringBills.filter(function(b) { return b.id !== id; });
    saveState();
    renderDirectDebits();
}

// ---------- ACTIONS ----------
function toggleEssential(id) {
    var tx = state.transactions.find(function(t) { return t.id === id; });
    if (tx) { tx.isEssential = !tx.isEssential; saveState(); renderAll(); }
}

function deleteTransaction(id) {
    state.transactions = state.transactions.filter(function(t) { return t.id !== id; });
    saveState(); renderAll();
}

function addTransaction() {
    var desc = document.getElementById('txDesc').value.trim();
    var amount = parseFloat(document.getElementById('txAmount').value);
    var type = document.getElementById('txType').value;
    var category = document.getElementById('txCategory').value;
    var date = document.getElementById('txDate').value;
    var isEssential = document.getElementById('txEssential').checked;
    if (!desc || !amount || !date) { alert('Fill in all fields!'); return; }
    state.transactions.push({ id: state.nextId++, desc: desc, amount: amount, type: type, category: category, date: date, isEssential: isEssential });
    saveState(); renderAll(); populateFilterCategories();
    document.getElementById('addModal').classList.remove('active');
}

function openCatEdit(id) {
    var tx = state.transactions.find(function(t) { return t.id === id; });
    if (!tx) return;
    editingTxId = id;
    document.getElementById('catEditDesc').textContent = '"' + tx.desc + '"';
    var html = '';
    ALL_CATEGORIES.forEach(function(cat) {
        var active = cat === tx.category ? 'active' : '';
        html += '<div class="cat-option ' + active + '" onclick="setCatForTx(\'' + cat.replace(/'/g, "\\'") + '\')">' + cat + '</div>';
    });
    document.getElementById('categoryGrid').innerHTML = html;
    document.getElementById('catModal').classList.add('active');
}

function setCatForTx(cat) {
    var tx = state.transactions.find(function(t) { return t.id === editingTxId; });
    if (tx) {
        tx.category = cat;
        if (cat === '💰 Salary') tx.type = 'income';
        if (AUTO_ESSENTIALS.indexOf(cat) !== -1) tx.isEssential = true;
        saveState(); renderAll(); populateFilterCategories();
    }
    document.getElementById('catModal').classList.remove('active');
}

function exportCSV() {
    var csv = '';
    
    // Header with timestamp
    csv += '# Mission Control Export - ' + new Date().toISOString().slice(0, 10) + '\n\n';
    
    // Summary section
    csv += '=== SUMMARY ===\n';
    csv += 'Available Balance,£' + (state.availableBalance || 0).toFixed(2) + '\n';
    csv += 'Bank Balance,£' + (state.balance || 0).toFixed(2) + '\n';
    csv += 'Total Savings,£' + (state.totalSavings || 0).toFixed(2) + '\n';
    csv += 'Monthly Budget,£' + (state.budget || 0).toFixed(2) + '\n\n';
    
    // Recurring Bills section
    csv += '=== RECURRING BILLS ===\n';
    csv += 'Name,Amount,Day of Month,Category,Annual Cost\n';
    if (state.recurringBills && state.recurringBills.length > 0) {
        state.recurringBills.forEach(function(bill) {
            csv += '"' + bill.name.replace(/"/g, '""') + '",' +
                bill.amount + ',' +
                bill.dayOfMonth + ',' +
                '"' + bill.category + '",' +
                (bill.amount * 12).toFixed(2) + '\n';
        });
        var totalBills = state.recurringBills.reduce(function(sum, bill) {
            return sum + parseFloat(bill.amount);
        }, 0);
        csv += ',,Total Monthly,,' + totalBills.toFixed(2) + '\n';
    } else {
        csv += 'No recurring bills tracked\n';
    }
    csv += '\n';
    
    // Credit Cards section
    csv += '=== CREDIT CARDS ===\n';
    csv += 'Card Name,Balance,Credit Limit,Utilization %\n';
    if (state.creditCards && state.creditCards.length > 0) {
        state.creditCards.forEach(function(card) {
            var utilization = card.limit > 0 ? ((card.balance / card.limit) * 100).toFixed(1) : 'N/A';
            csv += '"' + card.name.replace(/"/g, '""') + '",' +
                card.balance.toFixed(2) + ',' +
                card.limit.toFixed(2) + ',' +
                utilization + '\n';
        });
        var totalOwed = state.creditCards.reduce(function(sum, card) {
            return sum + parseFloat(card.balance);
        }, 0);
        csv += ',,Total Owed,' + totalOwed.toFixed(2) + '\n';
    } else {
        csv += 'No credit cards tracked\n';
    }
    csv += '\n';
    
    // Transactions section
    csv += '=== TRANSACTIONS ===\n';
    csv += 'Date,Description,Amount,Type,Category,Essential\n';
    if (state.transactions && state.transactions.length > 0) {
        state.transactions.forEach(function(tx) {
            csv += tx.date + ',' +
                '"' + tx.desc.replace(/"/g, '""') + '",' +
                tx.amount.toFixed(2) + ',' +
                tx.type + ',' +
                '"' + tx.category + '",' +
                (tx.isEssential ? 'Yes' : 'No') + '\n';
        });
    } else {
        csv += 'No transactions recorded\n';
    }
    
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'mission-control-full-export-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
}

// ---------- DROPDOWNS ----------
function populateCategorySelect() {
    var select = document.getElementById('txCategory');
    if (!select) return;
    select.innerHTML = '';
    ALL_CATEGORIES.forEach(function(c) {
        select.innerHTML += '<option value="' + c + '">' + c + '</option>';
    });
}

function populateFilterCategories() {
    var sel = document.getElementById('filterCategory');
    if (!sel) return;
    var cur = sel.value;
    var cats = []; var seen = {};
    state.transactions.forEach(function(t) {
        if (!isHidden(t) && !seen[t.category]) { seen[t.category] = true; cats.push(t.category); }
    });
    cats.sort();
    sel.innerHTML = '<option value="all">All Categories</option>';
    cats.forEach(function(c) {
        sel.innerHTML += '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' + c + '</option>';
    });
}

function escapeHtml(str) { var div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

// ---------- SAFE BIND ----------
function safeBind(id, event, func) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener(event, func); }
    else { console.warn('⚠️ Missing: ' + id); }
}

// ---------- BIND ----------
function bindEvents() {
    console.log("🔗 Binding...");
    safeBind('addTransactionBtn', 'click', function() { document.getElementById('addModal').classList.add('active'); });
    safeBind('closeModal', 'click', function() { document.getElementById('addModal').classList.remove('active'); });
    safeBind('addModal', 'click', function(e) { if (e.target === e.currentTarget) e.currentTarget.classList.remove('active'); });
    safeBind('saveTransactionBtn', 'click', addTransaction);
    safeBind('csvUploadBtn', 'click', function() { document.getElementById('csvFileInput').click(); });
    safeBind('csvFileInput', 'change', handleCsvUpload);
    safeBind('closeCsvModal', 'click', function() { document.getElementById('csvModal').classList.remove('active'); });
    safeBind('csvModal', 'click', function(e) { if (e.target === e.currentTarget) e.currentTarget.classList.remove('active'); });
    safeBind('importCsvBtn', 'click', function() { importCsv(); });
    safeBind('closeCatModal', 'click', function() { document.getElementById('catModal').classList.remove('active'); });
    safeBind('catModal', 'click', function(e) { if (e.target === e.currentTarget) e.currentTarget.classList.remove('active'); });
    safeBind('closeBillModal', 'click', function() { document.getElementById('addBillModal').classList.remove('active'); });
    safeBind('addBillModal', 'click', function(e) { if (e.target === e.currentTarget) e.currentTarget.classList.remove('active'); });
    safeBind('saveBillBtn', 'click', addRecurringBill);
    safeBind('filterCategory', 'change', function() { renderTransactions(); renderCategoryBars(); });
    safeBind('filterType', 'change', function() { renderTransactions(); renderCategoryBars(); });
    safeBind('filterPeriod', 'change', function() { renderAll(); });
    safeBind('filterSearch', 'input', function() { renderTransactions(); });
    safeBind('toggleHidden', 'click', function() { state.showHidden = !state.showHidden; saveState(); renderAll(); });
    safeBind('saveBudgetBtn', 'click', function() { state.budget = parseFloat(document.getElementById('monthlyBudget').value) || 1000; saveState(); renderAll(); });
    safeBind('saveBalanceBtn', 'click', function() { state.balance = parseFloat(document.getElementById('currentBalance').value) || 0; saveState(); renderAll(); });
    safeBind('saveSavingsBtn', 'click', function() { state.totalSavings = parseFloat(document.getElementById('totalSavings').value) || 0; saveState(); renderAll(); });
    safeBind('saveAvailableBtn', 'click', function() { state.availableBalance = parseFloat(document.getElementById('availableBalance').value) || 0; saveState(); renderAll(); });
    safeBind('closeCardModal', 'click', function() { document.getElementById('addCardModal').classList.remove('active'); });
    safeBind('addCardModal', 'click', function(e) { if (e.target === e.currentTarget) e.currentTarget.classList.remove('active'); });
    safeBind('saveCardBtn', 'click', addCreditCard);
    safeBind('affordCheckBtn', 'click', checkAfford);
    safeBind('affordAmount', 'keydown', function(e) { if (e.key === 'Enter') checkAfford(); });
    safeBind('clearAllBtn', 'click', function() { if (confirm('Delete ALL transactions?')) { state.transactions = []; state.nextId = 1; saveState(); renderAll(); populateFilterCategories(); } });
    safeBind('exportBtn', 'click', exportCSV);
    console.log("✅ Bound.");
}

// ---------- GO ----------
init();

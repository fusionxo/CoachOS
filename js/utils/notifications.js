// CoachOS Smart Notification & Device Push Reminder Engine
(function() {
    window.CoachOSNotifications = {
        isSupported() {
            return 'Notification' in window && 'serviceWorker' in navigator;
        },

        getPermission() {
            if (!('Notification' in window)) return 'unsupported';
            return Notification.permission;
        },

        async requestPermission() {
            if (!this.isSupported()) return false;
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    localStorage.setItem('coachos_notifications_enabled', 'true');
                    return true;
                }
                return false;
            } catch (e) {
                console.warn('Error requesting notification permission:', e);
                return false;
            }
        },

        isEnabled() {
            return this.getPermission() === 'granted' && localStorage.getItem('coachos_notifications_enabled') !== 'false';
        },

        async sendNotification(title, body, url = './#client-mobile') {
            if (!this.isEnabled()) return false;

            const options = {
                body: body,
                icon: 'icons/icon-192.svg',
                badge: 'icons/icon-192.svg',
                vibrate: [150, 50, 150],
                data: { url: url },
                tag: 'coachos-' + Date.now()
            };

            try {
                if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    if (reg && reg.showNotification) {
                        await reg.showNotification(title, options);
                        return true;
                    }
                }
                // Fallback to standard Notification
                if (window.Notification && Notification.permission === 'granted') {
                    const notif = new Notification(title, options);
                    notif.onclick = () => {
                        window.focus();
                        window.location.hash = url.replace('./#', '');
                    };
                    return true;
                }
            } catch (e) {
                console.warn('Could not dispatch device notification:', e);
            }
            return false;
        },

        // Send a test notification to verify device receipt
        async sendTestNotification() {
            const hasPermission = await this.requestPermission();
            if (!hasPermission) {
                return false;
            }
            return this.sendNotification(
                '⚡ CoachOS Notification Active',
                'Your device is connected! You will receive daily check-in, workout, and nutrition reminders.',
                './#client-mobile'
            );
        },

        // Evaluate smart daily reminders based on time of day and completed tasks
        async checkAndTriggerDailyReminders(client, todayCheckin, todayWorkout) {
            if (!this.isEnabled()) return;

            const todayStr = new Date().toISOString().split('T')[0];
            const currentHour = new Date().getHours();

            // Helper to prevent duplicate alerts within the same day
            const wasSentToday = (key) => {
                const record = localStorage.getItem(`coachos_notif_sent_${key}_${todayStr}`);
                return record === 'true';
            };
            const markSentToday = (key) => {
                localStorage.setItem(`coachos_notif_sent_${key}_${todayStr}`, 'true');
            };

            // 1. Morning Weigh-In Reminder (Between 6:00 AM and 12:00 PM)
            const hasWeightToday = todayCheckin && todayCheckin.weight !== null && todayCheckin.weight !== undefined && todayCheckin.weight !== '' && !isNaN(parseFloat(todayCheckin.weight));
            if (!hasWeightToday && currentHour >= 6 && currentHour < 12) {
                if (!wasSentToday('morning_weighin')) {
                    markSentToday('morning_weighin');
                    await this.sendNotification(
                        '☀️ Morning Weigh-In Reminder',
                        'Step on the scale and record your weight in CoachOS to track your weekly progress!',
                        './#client-mobile'
                    );
                    return;
                }
            }

            // 2. Scheduled Workout Reminder (Between 11:00 AM and 19:00 PM)
            if (todayWorkout && todayWorkout.status !== 'Completed') {
                if (!wasSentToday('workout_scheduled') && currentHour >= 11 && currentHour <= 20) {
                    markSentToday('workout_scheduled');
                    await this.sendNotification(
                        `🏋️ Scheduled Workout: ${todayWorkout.name}`,
                        `Your coach scheduled "${todayWorkout.name}" today. Tap to open and start logging sets!`,
                        `./#workout-logger/${todayWorkout.id}`
                    );
                    return;
                }
            }

            // 3. Evening Steps & Sleep Reminder (After 19:00 / 7:00 PM)
            const hasStepsToday = todayCheckin && todayCheckin.steps !== null && todayCheckin.steps !== undefined && todayCheckin.steps !== '' && parseInt(todayCheckin.steps) > 0;
            if (!hasStepsToday && currentHour >= 19) {
                if (!wasSentToday('evening_steps')) {
                    markSentToday('evening_steps');
                    await this.sendNotification(
                        '🌙 Evening Steps & Reflection',
                        'Don’t break your 7-day consistency streak! Enter today’s total steps and sleep.',
                        './#client-mobile'
                    );
                    return;
                }
            }
        }
    };
})();

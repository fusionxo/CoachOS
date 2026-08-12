// Controller for More Options screen on Mobile
window.init_more = function(params) {
    console.log('Displaying more options on mobile.');

    const notifBtn = document.getElementById('btn-more-notifications');
    if (notifBtn) {
        notifBtn.onclick = () => {
            showToast('Push notification preferences will be configurable once APNS/FCM keys are uploaded in settings.', 'info', 'Push Notifications');
        };
    }
};

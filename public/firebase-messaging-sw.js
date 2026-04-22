/* public/firebase-messaging-sw.js
   Must live at the root of your domain (/public in Vite projects).
   Handles FCM push messages when the app tab is closed or in the background.
*/

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Public-facing config — safe to embed in SW. Replace the placeholders
// with your real values on deploy, or inject at build time.
firebase.initializeApp({
  apiKey:            self.FIREBASE_API_KEY            || "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        self.FIREBASE_AUTH_DOMAIN        || "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  databaseURL:       self.FIREBASE_DATABASE_URL       || "REPLACE_WITH_YOUR_DATABASE_URL",
  projectId:         self.FIREBASE_PROJECT_ID         || "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     self.FIREBASE_STORAGE_BUCKET     || "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID|| "REPLACE_WITH_YOUR_SENDER_ID",
  appId:             self.FIREBASE_APP_ID             || "REPLACE_WITH_YOUR_APP_ID",
});

const messaging = firebase.messaging();

/* ── Background message handler ──
   Includes approve/deny/snooze/done actions depending on the push tag.
*/
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  const notifData = payload.data || {};
  const tag = notifData.tag || "wattshub-general";

  // Pick action buttons based on tag prefix.
  let actions = [];
  if (tag.startsWith("approval-")) {
    actions = [
      { action: "approve", title: "✓ Approve" },
      { action: "deny",    title: "✕ Deny"    },
    ];
  } else if (tag.startsWith("remind-")) {
    actions = [
      { action: "snooze15", title: "😴 Snooze 15m" },
      { action: "done",     title: "✓ On it"       },
    ];
  }

  self.registration.showNotification(title || "WattsHub", {
    body:    body || "",
    icon:    "/icon-192.png",
    badge:   "/badge-72.png",
    tag,
    renotify: true,
    data:    notifData,
    actions,
    vibrate: [200, 100, 200],
  });
});

/* ── Notification click handler ──
   Handles both the notification body click and any action button clicks.
   For snooze/done actions we pass the intent back to the app via URL.
*/
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.url || "/";

  if (event.action === "snooze15") {
    // The page will read ?wh_action=snooze15&tag=... on load and handle it.
    url = `/?wh_action=snooze15&tag=${encodeURIComponent(data.tag || "")}`;
  } else if (event.action === "done") {
    url = `/?wh_action=done&tag=${encodeURIComponent(data.tag || "")}`;
  } else if (event.action === "approve" || event.action === "deny") {
    url = `/?wh_action=${event.action}&tag=${encodeURIComponent(data.tag || "")}`;
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        // If app is already open, focus it and post the action.
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.postMessage({ whAction: event.action || null, tag: data.tag || null });
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

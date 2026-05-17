// โหลด Firebase SDK สำหรับ Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// 🌟 ใส่ค่า Config ของโรงเรียนบัวใหญ่ที่คุณครูพึ่งเจนมา
const firebaseConfig = {
  apiKey: "AIzaSyCkut_cRVN78by46Sco8reHIuo49CL8_Gc",
  authDomain: "bauyai-i-care-school.firebaseapp.com",
  projectId: "bauyai-i-care-school",
  storageBucket: "bauyai-i-care-school.firebasestorage.app",
  messagingSenderId: "4078337060",
  appId: "1:40783370690:web:fb329101fdc0fe909fde5b"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 🌟 ฟังก์ชันจัดการข้อความเมื่อแอปอยู่เบื้องหลัง (Background Message)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] ได้รับข้อความเบื้องหลัง: ', payload);

  // ตรวจสอบว่าเป็นคำสั่ง "ไร้เสียง (Silent Sync)" หรือไม่
  if (payload.data && payload.data.silentSync === 'true') {
    console.log('🔄 ระบบซิงค์ข้อมูลเงียบเปิดทำงาน กำลังสั่งให้หน้าเว็บหลักอัปเดตข้อมูล...');
    
    // ส่งสัญญาณไปบอกหน้าเว็บหลัก (ถ้าเปิดอยู่) ให้สั่งโหลดข้อมูลใหม่แบบไม่กวนผู้ใช้
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ action: 'RELOAD_STUDENT_DATA' });
      });
    });
    return; // จบการทำงาน ไม่ต้องแสดง Notification เด้งขึ้นมา
  }

  // 📢 หากไม่ใช่แบบไร้เสียง ให้เด้งหน้าต่างแจ้งเตือนตามปกติ (มีปุ่มอ่านแล้วตามไอเดียคุณครู)
  const notificationTitle = payload.data.title || 'ระบบดูแลช่วยเหลือผู้เรียน Buayai I-Care';
  const notificationOptions = {
    body: payload.data.body || 'มีการอัปเดตสถานะจากโรงเรียน',
    icon: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', // เปลี่ยนเป็น URL โลโก้โรงเรียนได้ครับ
    badge: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    tag: payload.data.msgId || 'general-alert', // ป้องกันข้อความซ้อนกัน
    requireInteraction: true, // ให้แจ้งเตือนค้างไว้จนกว่าจะกด
    data: {
      clickUrl: payload.data.clickUrl || '#',
      msgId: payload.data.msgId || ''
    },
    // 🌟 ใส่ปุ่ม Action "รับทราบ/อ่านแล้ว" ตามไอเดียอันยอดเยี่ยมของคุณครู
    actions: [
      { action: 'read_confirm', title: '✅ รับทราบ (อ่านแล้ว)' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 🌟 เมื่อผู้ใช้งานคลิกที่ตัว Notification หรือปุ่ม Action
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // ปิดหน้าต่างแจ้งเตือน

  let targetUrl = event.notification.data.clickUrl;
  const msgId = event.notification.data.msgId;

  // 1. ส่งสัญญาณกลับไปบอกหลังบ้าน (GAS) ว่าผู้ใช้คนนี้ "อ่านแล้ว"
  if (msgId) {
    // ⚠️ ใส่ลิงก์ Web App (Master API) ของคุณครูตรงนี้
    const API_URL = "https://script.google.com/macros/s/AKfycbziKXkyGcrMr-stjk-DOJdCY9PJSTGdcnJG88mUa-Gf8vLBdI1-1qLFU9FvSR13uFszvQ/exec";
    
    event.waitUntil(
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'markAsRead', msgId: msgId, timestamp: new Date().toISOString() })
      }).catch(err => console.log('ส่งสถานะอ่านแล้วล้มเหลว: ', err))
    );
  }

  // 2. จัดการเรื่องการเปิดหน้าเว็บขึ้นมาหลังจากกดอ่าน
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

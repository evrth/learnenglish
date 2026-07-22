// ==========================================
// pb.js - ListenUp PocketBase
// ==========================================

// Địa chỉ PocketBase
const pb = new PocketBase("http://127.0.0.1:8090");

// Không tự lưu phiên đăng nhập của PocketBase.
// Website sẽ tiếp tục dùng SESSION_KEY như hiện tại.
pb.autoCancellation(false);

// =============================
// Test kết nối
// =============================
async function pbPing() {
    try {
        const health = await pb.health.check();

        console.log("✅ PocketBase connected");
        console.log(health);

        return true;

    } catch (err) {

        console.error("❌ PocketBase offline");

        console.error(err);

        return false;
    }
}

// =============================
// Users Collection
// =============================

const USERS = "users";

const USER_DATA = "user_data";

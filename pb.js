// ==========================================
// pb.js - ListenUp PocketBase
// ==========================================

// Địa chỉ PocketBase
const pb = new PocketBase("http://127.0.0.1:8090");


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
// =============================
// Lấy user theo username
// =============================
async function dbGetAccount(username) {

    const list = await pb.collection(USERS).getFullList({

        filter: `username="${username}"`

    });

    if (list.length === 0) return null;

    return list[0];

}
// =============================
// Lấy user theo email
// =============================
async function dbGetAccountByEmail(email) {

    const list = await pb.collection(USERS).getFullList({

        filter: `email="${email}"`

    });

    if (list.length === 0) return null;

    return list[0];

}
// =============================
// Tạo tài khoản mới
// =============================
async function dbSaveAccount(username, passHash, email) {

    return await pb.collection(USERS).create({

        username: username,

        password: passHash,

        email: email

    });

}
// =============================
// Đọc dữ liệu người dùng
// =============================
async function dbGet(username, key, defaultValue) {

    try {

        const list = await pb.collection(USER_DATA).getFullList({

            filter: `username="${username}" && key="${key}"`

        });

        if (list.length === 0) {
            return defaultValue;
        }

        return list[0].value;

    } catch (err) {

        console.error("dbGet:", err);

        return defaultValue;

    }

}

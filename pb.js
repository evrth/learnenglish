// ==========================================
// pb.js - ListenUp PocketBase
// ==========================================
console.log("pb.js bắt đầu chạy");
// Địa chỉ PocketBase
const pb = new PocketBase("https://pocketbase-production-29d1.up.railway.app");


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
// =============================
// Ghi dữ liệu người dùng
// =============================
async function dbSet(username, key, value) {

    try {

        const list = await pb.collection(USER_DATA).getFullList({

            filter: `username="${username}" && key="${key}"`

        });

        if (list.length > 0) {

            await pb.collection(USER_DATA).update(list[0].id, {

                value: value

            });

        } else {

            await pb.collection(USER_DATA).create({

                username: username,

                key: key,

                value: value

            });

        }

    } catch (err) {

        console.error("dbSet:", err);

        throw err;

    }

}

const USER_DATA = "user_data";
// =============================
// Lấy user theo username
// =============================
async function dbGetAccount(username) {

    console.log("Đang tìm username:", username);

    const list = await pb.collection(USERS).getFullList({

        filter: `username="${username}"`

    });

    console.log("Kết quả PocketBase:", list);

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
        passwordConfirm: passHash,
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
console.log("PocketBase:", pb);

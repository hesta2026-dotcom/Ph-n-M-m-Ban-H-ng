# Hướng Dẫn Cài Đặt & Chạy POS System

## Yêu cầu
- Node.js v18+
- PostgreSQL v14+
- npm v9+

---

## Bước 1: Cài đặt PostgreSQL

1. Tải PostgreSQL tại: https://www.postgresql.org/download/windows/
2. Cài đặt với password mặc định: `password`
3. Tạo database tên `posdb`:
   ```sql
   CREATE DATABASE posdb;
   ```

---

## Bước 2: Cài đặt Backend

Mở terminal tại thư mục `backend`:

```bash
cd C:\Users\Hesta\pos-system\backend
npm install
npx prisma generate
npx prisma db push
node src/seed.js
```

Chạy backend:
```bash
npm run dev
```
Backend chạy tại: http://localhost:5000

---

## Bước 3: Cài đặt Frontend

Mở terminal mới tại thư mục `frontend`:

```bash
cd C:\Users\Hesta\pos-system\frontend
npm install
npm run dev
```

Frontend chạy tại: http://localhost:5173

---

## Tài khoản mặc định

| Email | Mật khẩu | Vai trò |
|-------|----------|---------|
| admin@pos.com | 123456 | Quản trị |
| staff@pos.com | 123456 | Nhân viên |

---

## Cấu trúc thư mục

```
pos-system/
├── backend/         ← Node.js + Express + Prisma
│   ├── prisma/      ← Schema database
│   ├── src/
│   │   ├── routes/  ← API endpoints
│   │   └── index.js ← Entry point
│   └── .env         ← Cấu hình database
└── frontend/        ← React + TypeScript + Vite
    └── src/
        ├── pages/   ← Các trang giao diện
        ├── stores/  ← State management
        └── services/← API calls
```

---

## Các tính năng

1. Dashboard - Tổng quan doanh thu
2. POS - Màn hình bán hàng
3. Sản phẩm - Quản lý 10.000+ SP
4. Kho hàng - Nhập kho, tồn kho
5. Khách hàng - Tích điểm, lịch sử
6. Nhà cung cấp
7. Thu chi - Dòng tiền
8. Công nợ - Khách hàng & NCC
9. Báo cáo - Doanh thu, top SP
10. Nhân viên - Phân quyền

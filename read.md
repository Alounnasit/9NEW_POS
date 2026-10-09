# 🛒 POS Grocery Store (ລະບົບຂາຍໜ້າຮ້ານ)

ລະບົບ POS (Point of Sale) ສຳລັບຮ້ານມິນິມາດ ຫຼື ຮ້ານຂາຍເຄື່ອງແຫ້ງຂະໜາດນ້ອຍ ທີ່ອອກແບບມາໃຫ້ໃຊ້ງານງ່າຍ, ປະຢັດຕົ້ນທຶນ 100% ໂດຍໃຊ້ **Google Sheets ເປັນຖານຂໍ້ມູນ (Database)** ແລະ **Google Apps Script ເປັນ Backend**.

## ✨ ຟັງຊັນຫຼັກ (Core Features)
- 📦 **ລະບົບຂາຍໜ້າຮ້ານ (POS):** ແບ່ງໜ້າຈໍຊ້າຍ-ຂວາ ໃຊ້ງານງ່າຍ, ສາມາດກົດເລືອກສິນຄ້າຕາມໝວດໝູ່ໄດ້.
- 📳 **ຮອງຮັບເຄື່ອງຍິງບາໂຄດ:** ສາມາດໃຊ້ເຄື່ອງສະແກນບາໂຄດຍິງເພື່ອເພີ່ມສິນຄ້າລົງກະຕ່າໄດ້ທັນທີ ພ້ອມສຽງແຈ້ງເຕືອນ (Beep).
- 💰 **ລະບົບສ່ວນຫຼຸດ (Discount):** ສາມາດປ້ອນສ່ວນຫຼຸດເປັນເງິນສົດກ່ອນການຊຳລະເງິນໄດ້.
- 📱 **ຮອງຮັບ PWA (Progressive Web App):** ສາມາດກົດຕິດຕັ້ງ (Install) ເປັນແອັບລົງໃນໜ້າຈໍຫຼັກຂອງມືຖື ຫຼື ຄອມພິວເຕີໄດ້.
- ☁️ **Serverless & Free:** ບໍ່ມີຄ່າໃຊ້ຈ່າຍໃນການເຊົ່າ Server ເພາະໃຊ້ Google ລະບົບນິເວດທັງໝົດ.
- 🔒 **ປ້ອງກັນຂໍ້ມູນຊ້ອນກັນ (Concurrency):** ໃຊ້ `LockService` ປ້ອງກັນການຕັດສະຕ໋ອກພາດເມື່ອມີພະນັກງານຂາຍພ້ອມກັນ.

## 🛠 ເທັກໂນໂລຢີທີ່ໃຊ້ (Tech Stack)
- **Frontend:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (CDN), FontAwesome, SweetAlert2.
- **Backend:** Google Apps Script (GAS) ໃຫ້ບໍລິການ REST API (doPost/doGet).
- **Database:** Google Sheets (`SpreadsheetApp`).
- **Hosting:** ສາມາດເອົາ Frontend ໄປ Host ຟຣີເທິງ GitHub Pages ໄດ້.

---

## 🚀 ວິທີການຕິດຕັ້ງ ແລະ ໃຊ້ງານ (Setup Guide)

### 1. ການກຽມຖານຂໍ້ມູນ (Google Sheets)
1. ສ້າງ Google Sheets ໃໝ່ ແລະ ສ້າງແຖບ (Tabs) ດັ່ງນີ້:
   - `Products`: ຄໍລຳ (id, barcode, name, category, cost, price, stock, image_url)
   - `Sales`: ຄໍລຳ (receipt_no, date, sub_total, discount, grand_total)
   - `Sale_Items`: ຄໍລຳ (receipt_no, product_id, qty, price, total)
   - `Categories`: ຄໍລຳ (id, name)
2. ກັອບປີ້ **Spreadsheet ID** ຈາກ URL ຂອງ Google Sheets ກຽມໄວ້.

### 2. ການຕັ້ງຄ່າ Backend (Google Apps Script)
1. ເປີດ Google Sheets ຂອງທ່ານ, ໄປທີ່ເມນູ **Extensions > Apps Script**.
2. ກັອບປີ້ໂຄດຈາກໄຟລ໌ `code.gs` ໄປວາງທັບໃນໜ້າ Apps Script.
3. ປ່ຽນຄ່າ `YOUR_SPREADSHEET_ID_HERE` ໃນໂຄດໃຫ້ເປັນ ID ທີ່ກັອບປີ້ມາຈາກຂໍ້ 1.
4. ກົດປຸ່ມ **Deploy > New deployment**.
5. ເລືອກປະເພດເປັນ **Web App**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. ກົດ **Deploy** (ອາດຈະຕ້ອງກົດອະນຸຍາດສິດ ຫຼື Authorize access ໃນຄັ້ງທຳອິດ).
7. ກັອບປີ້ **Web App URL** ທີ່ໄດ້ມາກຽມໄວ້.

### 3. ການຕັ້ງຄ່າ Frontend
1. ເປີດໄຟລ໌ `index.html` ດ້ວຍ Text Editor (ເຊັ່ນ VS Code).
2. ຊອກຫາແຖວ `const GAS_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';`
3. ປ່ຽນຄ່າເປັນ **Web App URL** ທີ່ກັອບປີ້ມາຈາກຂັ້ນຕອນ Backend.
4. ສາມາດອັບໂຫຼດໄຟລ໌ `index.html` ຂຶ້ນໄປ होस्टເທິງ GitHub Pages ເພື່ອໃຊ້ງານອອນລາຍໄດ້ທັນທີ!

---
*ພັດທະນາສຳລັບໂຄງການ POS ຮ້ານຂາຍເຄື່ອງແຫ້ງ / ມິນິມາດ*
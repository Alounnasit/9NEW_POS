/**
 * =========================================================================
 * 🛒 POS Grocery Store Backend - Google Apps Script (GAS)
 * =========================================================================
 * 
 * ຄູ່ມືການຕິດຕັ້ງ:
 * 1. ປ່ຽນ SPREADSHEET_ID ດ້ານລຸ່ມໃຫ້ເປັນ ID ຂອງ Google Sheets ຂອງທ່ານ (ຫຼື ປະຫວ່າງໄວ້ຫາກຕິດ Script ນີ້ກັບ Sheet ໂດຍກົງ)
 * 2. ກົດ Deploy > New deployment > Web App
 * 3. Execute as: Me (ອີເມວຂອງທ່ານ)
 * 4. Who has access: Anyone (ທຸກຄົນ)
 * 5. ກັອບປີ້ Web App URL ໄປໃສ່ໃນໜ້າຕັ້ງຄ່າຂອງ index.html
 */

// ໃສ່ Spreadsheet ID ຂອງທ່ານທີ່ນີ້ (ຖ້າ Run ແບບ Bound Script ໃຫ້ປະເປັນ '')
const SPREADSHEET_ID = '1BxrBiox3FQ8CVQJW9Y296d26lzPdZbMqeaX8x_OhWmY';

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== '') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Handle GET Requests (ດຶງຂໍ້ມູນສິນຄ້າ, ໝວດໝູ່, ທົດສອບເຊື່ອມຕໍ່)
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getProducts';
  
  try {
    if (action === 'ping') {
      return createJsonResponse({ status: 'success', message: 'POS Google Apps Script is active!' });
    }
    
    if (action === 'getProducts') {
      const products = getProductsList();
      return createJsonResponse({ status: 'success', data: products });
    }

    if (action === 'initDatabase') {
      setupDatabaseTabs();
      return createJsonResponse({ status: 'success', message: 'Database tabs and headers initialized successfully!' });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Handle POST Requests (ບັນທຶກການຂາຍ, ຕັດສະຕ໋ອກພ້ອມ Lock Concurrency)
 */
function doPost(e) {
  // Concurrency lock using LockService to prevent race conditions during checkout
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(15000); // Wait up to 15 seconds

  if (!hasLock) {
    return createJsonResponse({
      status: 'error',
      message: 'Server is currently busy. Please try again.'
    });
  }

  try {
    let postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = e.parameter;
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    const action = postData.action || 'recordSale';

    if (action === 'recordSale') {
      const sale = postData.sale;
      if (!sale) {
        throw new Error('Missing sale payload');
      }
      const result = recordSaleTransaction(sale);
      return createJsonResponse({ status: 'success', result: result });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * ດຶງລາຍການສິນຄ້າຈາກແຖບ Products
 */
function getProductsList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  if (!sheet) {
    setupDatabaseTabs();
    return [];
  }

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const items = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    items.push({
      id: String(row[0]),
      barcode: String(row[1]),
      name: String(row[2]),
      category: String(row[3]),
      cost: Number(row[4]) || 0,
      price: Number(row[5]) || 0,
      stock: Number(row[6]) || 0,
      image_url: String(row[7] || '')
    });
  }

  return items;
}

/**
 * ບັນທຶກການຂາຍ, ບັນທຶກແຕ່ລະລາຍການສິນຄ້າ ແລະ ຕັດສະຕ໋ອກ
 */
function recordSaleTransaction(sale) {
  const ss = getSpreadsheet();
  
  // 1. ບັນທຶກໃສ່ແຖບ Sales
  const salesSheet = ss.getSheetByName('Sales') || ss.insertSheet('Sales');
  if (salesSheet.getLastRow() === 0) {
    salesSheet.appendRow(['receipt_no', 'date', 'sub_total', 'discount', 'grand_total']);
  }
  salesSheet.appendRow([
    sale.receipt_no,
    sale.date || new Date().toISOString(),
    sale.sub_total || 0,
    sale.discount || 0,
    sale.grand_total || 0
  ]);

  // 2. ບັນທຶກໃສ່ແຖບ Sale_Items
  const itemsSheet = ss.getSheetByName('Sale_Items') || ss.insertSheet('Sale_Items');
  if (itemsSheet.getLastRow() === 0) {
    itemsSheet.appendRow(['receipt_no', 'product_id', 'qty', 'price', 'total']);
  }

  const itemsRows = [];
  if (sale.items && sale.items.length > 0) {
    for (let i = 0; i < sale.items.length; i++) {
      const it = sale.items[i];
      itemsRows.push([
        sale.receipt_no,
        it.product_id,
        it.qty,
        it.price,
        it.total
      ]);
    }
    itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, itemsRows.length, itemsRows[0].length).setValues(itemsRows);
  }

  // 3. ຕັດສະຕ໋ອກໃນແຖບ Products
  const prodSheet = ss.getSheetByName('Products');
  if (prodSheet && sale.items && sale.items.length > 0) {
    const data = prodSheet.getDataRange().getValues();
    // Headers: id, barcode, name, category, cost, price, stock, image_url
    for (let j = 0; j < sale.items.length; j++) {
      const saleItem = sale.items[j];
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(saleItem.product_id) || String(data[r][1]) === String(saleItem.barcode)) {
          const currentStock = Number(data[r][6]) || 0;
          const newStock = Math.max(0, currentStock - Number(saleItem.qty));
          prodSheet.getRange(r + 1, 7).setValue(newStock);
          break;
        }
      }
    }
  }

  return { success: true, receipt_no: sale.receipt_no };
}

/**
 * ສ້າງ Sheets ແລະ Headers ອັດຕະໂນມັດຫາກຍັງບໍ່ທັນມີ
 */
function setupDatabaseTabs() {
  const ss = getSpreadsheet();

  // Products
  let prodSheet = ss.getSheetByName('Products');
  if (!prodSheet) {
    prodSheet = ss.insertSheet('Products');
    prodSheet.appendRow(['id', 'barcode', 'name', 'category', 'cost', 'price', 'stock', 'image_url']);
    // Initial sample products
    prodSheet.appendRow(['P001', '8850123001', 'ນ້ຳດື່ມ ຫົວເສືອ 600ml', 'ເຄື່ອງດື່ມ', 3500, 5000, 50, '']);
    prodSheet.appendRow(['P002', '8850123002', 'ເບຍລາວ ກະປ໋ອງ 330ml', 'ເຄື່ອງດື່ມ', 11000, 14000, 40, '']);
    prodSheet.appendRow(['P003', '8850123003', 'ມີ່ ໄວໄວ ໝູສັບ', 'ອາຫານແຫ້ງ', 3000, 4500, 60, '']);
    prodSheet.appendRow(['P004', '8850123004', 'ເຂົ້າສານ ໜຽວໄກ່ນ້ອຍ (5kg)', 'ອາຫານແຫ້ງ', 75000, 90000, 15, '']);
  }

  // Sales
  let salesSheet = ss.getSheetByName('Sales');
  if (!salesSheet) {
    salesSheet = ss.insertSheet('Sales');
    salesSheet.appendRow(['receipt_no', 'date', 'sub_total', 'discount', 'grand_total']);
  }

  // Sale_Items
  let itemsSheet = ss.getSheetByName('Sale_Items');
  if (!itemsSheet) {
    itemsSheet = ss.insertSheet('Sale_Items');
    itemsSheet.appendRow(['receipt_no', 'product_id', 'qty', 'price', 'total']);
  }

  // Categories
  let catSheet = ss.getSheetByName('Categories');
  if (!catSheet) {
    catSheet = ss.insertSheet('Categories');
    catSheet.appendRow(['id', 'name']);
    catSheet.appendRow(['C001', 'ເຄື່ອງດື່ມ']);
    catSheet.appendRow(['C002', 'ອາຫານແຫ້ງ']);
    catSheet.appendRow(['C003', 'ອາຫານສົດ-ໄຂ່']);
    catSheet.appendRow(['C004', 'ຂອງໃຊ້ທົ່ວໄປ']);
    catSheet.appendRow(['C005', 'ຂະໜົມ-ຂອງກິນຫຼິ້ນ']);
  }
}

/**
 * JSON Response Formatter
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

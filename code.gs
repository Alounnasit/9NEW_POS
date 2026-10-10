/**
 * =========================================================================
 * 🛒 POS Grocery Store Backend - Google Apps Script (GAS)
 * =========================================================================
 * 
 * ຄູ່ມືການຕິດຕັ້ງ:
 * 1. ປ່ຽນ SPREADSHEET_ID ດ້ານລຸ່ມໃຫ້ເປັນ ID ຂອງ Google Sheets ຂອງທ່ານ
 * 2. ກົດ Deploy > New deployment > Web App
 * 3. Execute as: Me (ອີເມວຂອງທ່ານ)
 * 4. Who has access: Anyone (ທຸກຄົນ)
 * 5. ກັອບປີ້ Web App URL ໄປໃສ່ໃນໜ້າຕັ້ງຄ່າຂອງ index.html
 */

// ໃສ່ Spreadsheet ID ຂອງທ່ານທີ່ນີ້
const SPREADSHEET_ID = '1BxrBiox3FQ8CVQJW9Y296d26lzPdZbMqeaX8x_OhWmY';

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== '' && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      return SpreadsheetApp.getActiveSpreadsheet();
    }
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

    // Fallback GET action for saveProduct
    if (action === 'saveProduct' && e.parameter.product) {
      const prod = JSON.parse(e.parameter.product);
      const res = saveProductRecord(prod);
      return createJsonResponse({ status: 'success', result: res });
    }

    // Fallback GET action for deleteProduct
    if (action === 'deleteProduct' && e.parameter.id) {
      const res = deleteProductRecord(e.parameter.id);
      return createJsonResponse({ status: 'success', result: res });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Handle POST Requests (ບັນທຶກສິນຄ້າ, ລຶບສິນຄ້າ, ບັນທຶກການຂາຍ, ຕັດສະຕ໋ອກ)
 */
function doPost(e) {
  // Concurrency lock using LockService to prevent race conditions during checkout/save
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
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    const action = postData.action || 'recordSale';

    // 1. ບັນທຶກ ຫຼື ອັບເດດສິນຄ້າ (Add/Update Product)
    if (action === 'saveProduct') {
      const product = postData.product;
      if (!product) {
        throw new Error('Missing product payload in saveProduct');
      }
      const result = saveProductRecord(product);
      return createJsonResponse({ status: 'success', result: result });
    }

    // 2. ລຶບສິນຄ້າ (Delete Product)
    if (action === 'deleteProduct') {
      const productId = postData.id;
      if (!productId) {
        throw new Error('Missing product id in deleteProduct');
      }
      const result = deleteProductRecord(productId);
      return createJsonResponse({ status: 'success', result: result });
    }

    // 3. ບັນທຶກການຂາຍ & ຕັດສະຕ໋ອກ (Record Sale & Deduct Stock)
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
  let sheet = ss.getSheetByName('Products');
  if (!sheet) {
    setupDatabaseTabs();
    sheet = ss.getSheetByName('Products');
  }

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const items = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    // Ignore completely empty rows
    if (!row[0] && !row[1] && !row[2]) continue;

    items.push({
      id: String(row[0] || ''),
      barcode: String(row[1] || ''),
      name: String(row[2] || ''),
      category: String(row[3] || ''),
      cost: Number(row[4]) || 0,
      price: Number(row[5]) || 0,
      stock: Number(row[6]) || 0,
      image_url: String(row[7] || '')
    });
  }

  return items;
}

/**
 * ບັນທຶກ ຫຼື ອັບເດດສິນຄ້າລົງໃນແຖບ Products ຂອງ Google Sheets
 */
function saveProductRecord(product) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Products');
  if (!sheet) {
    setupDatabaseTabs();
    sheet = ss.getSheetByName('Products');
  }

  const data = sheet.getDataRange().getValues();
  // Columns: [id, barcode, name, category, cost, price, stock, image_url]
  let foundRow = -1;
  const prodId = String(product.id || '').trim();
  const prodBarcode = String(product.barcode || '').trim();

  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][0] || '').trim();
    const rowBarcode = String(data[i][1] || '').trim();
    if ((prodId && rowId === prodId) || (prodBarcode && rowBarcode === prodBarcode)) {
      foundRow = i + 1; // 1-indexed for Sheet API
      break;
    }
  }

  const rowValues = [
    prodId,
    prodBarcode,
    product.name || '',
    product.category || '',
    Number(product.cost) || 0,
    Number(product.price) || 0,
    Number(product.stock) || 0,
    product.image_url || ''
  ];

  if (foundRow > 0) {
    // ອັບເດດແຖວເກົ່າ
    sheet.getRange(foundRow, 1, 1, 8).setValues([rowValues]);
  } else {
    // ເພີ່ມແຖວໃໝ່
    sheet.appendRow(rowValues);
  }

  // ເພີ່ມໝວດໝູ່ໃໝ່ລົງແຖບ Categories ຫາກຍັງບໍ່ທັນມີ
  if (product.category) {
    const catSheet = ss.getSheetByName('Categories');
    if (catSheet) {
      const catData = catSheet.getDataRange().getValues();
      let catExists = false;
      for (let c = 1; c < catData.length; c++) {
        if (String(catData[c][1]).trim().toLowerCase() === String(product.category).trim().toLowerCase()) {
          catExists = true;
          break;
        }
      }
      if (!catExists) {
        catSheet.appendRow(['C' + String(catData.length).padStart(3, '0'), product.category]);
      }
    }
  }

  return { success: true, product: product, updated: foundRow > 0 };
}

/**
 * ລຶບສິນຄ້າອອກຈາກແຖບ Products
 */
function deleteProductRecord(productId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  if (!sheet) return { success: false, message: 'Products sheet not found' };

  const data = sheet.getDataRange().getValues();
  const targetId = String(productId || '').trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === targetId) {
      sheet.deleteRow(i + 1);
      return { success: true, id: targetId };
    }
  }
  return { success: false, message: 'Product not found in sheet' };
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
    prodSheet.appendRow(['P001', '8850123001', 'ນ້ຳດື່ມ ຫົວເສືອ 600ml', 'ເຄື່ອງດື່ມ', 3500, 5000, 50, 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=80']);
    prodSheet.appendRow(['P002', '8850123002', 'ເບຍລາວ ກະປ໋ອງ 330ml', 'ເຄື່ອງດື່ມ', 11000, 14000, 40, 'https://images.unsplash.com/photo-1608270546103-97992cbdd836?auto=format&fit=crop&w=400&q=80']);
    prodSheet.appendRow(['P003', '8850123003', 'ມີ່ ໄວໄວ ໝູສັບ', 'ອາຫານແຫ້ງ', 3000, 4500, 60, 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80']);
    prodSheet.appendRow(['P004', '8850123004', 'ເຂົ້າສານ ໜຽວໄກ່ນ້ອຍ (5kg)', 'ອາຫານແຫ້ງ', 75000, 90000, 15, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80']);
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

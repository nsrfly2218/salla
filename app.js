// إعدادات OAuth سلة - عدّل هذه القيم من لوحة Salla Partners
const SALLA_CLIENT_ID = "ee985964-8702-4618-a36f-4582b90268fe";
// ملاحظة: في بيئة الإنتاج لا يُفضّل وضع CLIENT_SECRET في الواجهة الأمامية
// بل يفضّل تنفيذ طلب /token من خادمك أنت ثم إعادة التوكن للواجهة.
const SALLA_CLIENT_SECRET = "c58c7ac54cfa88dbda1bdd15306bf66b";
const SALLA_REDIRECT_URI = "http://localhost:5500/index.html";
// اترك SALLA_SCOPES فارغًا أو عدّله فقط إذا كنت متأكدًا من القيم المدعومة من سلة
const SALLA_SCOPES = "";
const SALLA_AUTH_URL = "https://accounts.salla.sa/oauth2/auth";
const SALLA_TOKEN_URL = "https://accounts.salla.sa/oauth2/token";

// إعدادات عامة لواجهة Merchant API
const API_BASE = "https://api.salla.dev/admin/v2";

const accessTokenInput = document.getElementById("accessTokenInput");
const saveTokenBtn = document.getElementById("saveTokenBtn");
const loadOrdersBtn = document.getElementById("loadOrdersBtn");
const statusText = document.getElementById("statusText");
const ordersBody = document.getElementById("ordersBody");
const errorBox = document.getElementById("errorBox");
const searchOrderInput = document.getElementById("searchOrderInput");
const searchOrderBtn = document.getElementById("searchOrderBtn");
const loginWithSallaBtn = document.getElementById("loginWithSallaBtn");
const oauthStatusText = document.getElementById("oauthStatusText");
const orderDetailsSection = document.getElementById("orderDetailsSection");
const closeOrderDetailsBtn = document.getElementById("closeOrderDetailsBtn");
const orderMainDetails = document.getElementById("orderMainDetails");
const orderShippingDetails = document.getElementById("orderShippingDetails");
const orderItemsList = document.getElementById("orderItemsList");
const orderInvoicesList = document.getElementById("orderInvoicesList");
const paginationContainer = document.getElementById("paginationContainer");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const paginationInfo = document.getElementById("paginationInfo");
const pageInput = document.getElementById("pageInput");
const goToPageBtn = document.getElementById("goToPageBtn");

// لتخزين جميع الطلبات التي تم تحميلها
let allOrders = [];

// إعدادات Pagination للعرض
let currentPage = 1;
const itemsPerPage = 10; // عدد الطلبات المعروضة في كل صفحة

// تحميل التوكن المخزن (إن وجد)
const savedToken = localStorage.getItem("salla_access_token");
if (savedToken) {
  accessTokenInput.value = savedToken;
}

// معالجة إعادة التوجيه من سلة إن وُجد كود OAuth في الرابط
handleOAuthRedirectIfPresent();

// تحميل الطلبات تلقائيًا عند تحميل الصفحة إذا كان هناك token
if (savedToken) {
  // انتظار قليل لضمان تحميل جميع العناصر
  setTimeout(() => {
    loadOrdersBtn.click();
  }, 500);
}

// أحداث Pagination للعرض
prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderOrdersWithPagination();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(allOrders.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderOrdersWithPagination();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// الانتقال إلى صفحة معينة
goToPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(allOrders.length / itemsPerPage);
  const targetPage = parseInt(pageInput.value);

  if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
    currentPage = targetPage;
    renderOrdersWithPagination();
    window.scrollTo({ top: 0, behavior: "smooth" });
    pageInput.value = ""; // مسح الحقل بعد الانتقال
  } else {
    alert(`الرجاء إدخال رقم صفحة صحيح بين 1 و ${totalPages}`);
  }
});

// السماح بالانتقال عند الضغط على Enter في حقل الإدخال
pageInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    goToPageBtn.click();
  }
});

saveTokenBtn.addEventListener("click", () => {
  const token = accessTokenInput.value.trim();
  if (!token) {
    showError("الرجاء إدخال Access Token صالح قبل الحفظ.");
    return;
  }
  localStorage.setItem("salla_access_token", token);
  hideError();
  statusText.textContent = "تم حفظ التوكن في المتصفح.";
});

// زر تسجيل الدخول بسلة عبر OAuth 2.0
loginWithSallaBtn.addEventListener("click", () => {
  hideError();

  if (
    !SALLA_CLIENT_ID ||
    SALLA_CLIENT_ID === "PUT_YOUR_CLIENT_ID_HERE" ||
    !SALLA_REDIRECT_URI
  ) {
    showError(
      "الرجاء ضبط SALLA_CLIENT_ID و SALLA_CLIENT_SECRET و SALLA_REDIRECT_URI في ملف app.js، والتأكد من إضافتها في إعدادات التطبيق في Salla Partners."
    );
    return;
  }

  const state = Math.random().toString(36).slice(2);
  localStorage.setItem("salla_oauth_state", state);

  const url = new URL(SALLA_AUTH_URL);
  url.searchParams.set("client_id", SALLA_CLIENT_ID);
  url.searchParams.set("redirect_uri", SALLA_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  if (SALLA_SCOPES) {
    url.searchParams.set("scope", SALLA_SCOPES);
  }
  url.searchParams.set("state", state);

  window.location.href = url.toString();
});

loadOrdersBtn.addEventListener("click", async () => {
  hideError();
  statusText.textContent = "";
  const token = accessTokenInput.value.trim();

  if (!token) {
    showError(
      "الرجاء إدخال Access Token أولًا. يمكنك الحصول عليه من تطبيق سلة الخاص بك كما في وثائق OAuth."
    );
    return;
  }

  loadOrdersBtn.disabled = true;
  statusText.textContent = "جاري تحميل الطلبات...";

  try {
    // جلب جميع الطلبات بشكل متوازي (parallel) لتسريع العملية
    allOrders = [];
    const perPage = 100; // عدد الطلبات في كل صفحة

    // أولاً: جلب الصفحة الأولى لمعرفة إجمالي عدد الصفحات
    const firstResponse = await fetch(
      `${API_BASE}/orders?page=1&per_page=${perPage}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (!firstResponse.ok) {
      const text = await firstResponse.text();
      let errorMessage = `فشل جلب البيانات. الكود: ${firstResponse.status}`;

      if (firstResponse.status === 401) {
        errorMessage =
          'انتهت صلاحية Access Token أو أنه غير صالح. يرجى تسجيل الدخول مرة أخرى عبر زر "تسجيل الدخول بسلة (OAuth 2.0)" أو تحديث التوكن في حقل Access Token.';
        localStorage.removeItem("salla_access_token");
        accessTokenInput.value = "";
      } else {
        try {
          const errorData = JSON.parse(text);
          errorMessage += ` - ${
            errorData.error?.message || errorData.message || text
          }`;
        } catch {
          errorMessage += ` - ${text}`;
        }
      }

      throw new Error(errorMessage);
    }

    const firstData = await firstResponse.json();
    const firstPageOrders = firstData.data || firstData.orders || [];
    allOrders = allOrders.concat(firstPageOrders);

    const pagination = firstData.meta?.pagination || firstData.pagination || {};
    const totalPages = pagination.total_pages || pagination.last_page || null;
    const totalItems = pagination.total || pagination.total_items || null;

    statusText.textContent = `جاري تحميل الطلبات... (${allOrders.length} طلب حتى الآن)`;

    // إذا كان هناك totalPages، نجلب جميع الصفحات بشكل متوازي
    if (totalPages && totalPages > 1) {
      console.log(`بدء جلب ${totalPages} صفحة بشكل متوازي...`);

      // إنشاء مصفوفة من Promises لجلب جميع الصفحات
      const pagePromises = [];
      const batchSize = 10; // جلب 10 صفحات في كل مرة لتجنب Rate Limiting

      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(
          fetch(`${API_BASE}/orders?page=${page}&per_page=${perPage}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }).then(async (response) => {
            if (!response.ok) {
              console.warn(`فشل جلب الصفحة ${page}: ${response.status}`);
              return { page, orders: [] };
            }
            const data = await response.json();
            const orders = data.data || data.orders || [];
            return { page, orders };
          })
        );

        // معالجة كل batch من 10 صفحات
        if (pagePromises.length >= batchSize || page === totalPages) {
          const batchResults = await Promise.all(pagePromises);

          batchResults.forEach(({ page, orders }) => {
            if (orders.length > 0) {
              // تجنب التكرار
              const existingIds = new Set(
                allOrders.map((o) => o.id || o.reference_id)
              );
              const newOrders = orders.filter((o) => {
                const id = o.id || o.reference_id;
                return id && !existingIds.has(id);
              });
              allOrders = allOrders.concat(newOrders);
            }
          });

          statusText.textContent = `جاري تحميل الطلبات... (${allOrders.length} طلب حتى الآن) - صفحة ${page} من ${totalPages}`;
          pagePromises.length = 0; // إعادة تعيين المصفوفة
        }
      }
    }
    // إذا لم يكن هناك totalPages، نستمر في الجلب حتى لا توجد طلبات
    else {
      console.log("لا توجد معلومات pagination واضحة، جلب متسلسل...");
      let currentPage = 2;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await fetch(
          `${API_BASE}/orders?page=${currentPage}&per_page=${perPage}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          console.warn(`فشل جلب الصفحة ${currentPage}: ${response.status}`);
          hasMorePages = false;
          break;
        }

        const data = await response.json();
        const pageOrders = data.data || data.orders || [];

        if (pageOrders.length > 0) {
          const existingIds = new Set(
            allOrders.map((o) => o.id || o.reference_id)
          );
          const newOrders = pageOrders.filter((o) => {
            const id = o.id || o.reference_id;
            return id && !existingIds.has(id);
          });

          allOrders = allOrders.concat(newOrders);
          statusText.textContent = `جاري تحميل الطلبات... (${allOrders.length} طلب حتى الآن) - الصفحة ${currentPage}`;

          if (newOrders.length === 0) {
            hasMorePages = false;
            break;
          }

          currentPage++;
          if (currentPage > 10000) {
            console.warn("تم الوصول للحد الأقصى من الصفحات");
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }
      }
    }

    // عرض الطلبات مع pagination (10 طلبات في كل صفحة)
    currentPage = 1;
    renderOrdersWithPagination();

    if (!allOrders.length) {
      statusText.textContent = "لا توجد طلبات لعرضها حاليًا.";
    } else {
      statusText.textContent = `تم تحميل ${allOrders.length} طلبًا.`;
    }
  } catch (err) {
    console.error(err);
    showError(err.message || "حدث خطأ غير متوقع أثناء جلب الطلبات.");
    statusText.textContent = "";
  } finally {
    loadOrdersBtn.disabled = false;
  }
});

// البحث عن طلب برقم الطلب
searchOrderBtn.addEventListener("click", handleSearch);

searchOrderInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    handleSearch();
  }
});

function handleSearch() {
  hideError();
  const term = searchOrderInput.value.trim();

  if (!allOrders.length) {
    showError(
      'لم يتم تحميل الطلبات بعد. اضغط أولًا على زر "تحميل كل الطلبات".'
    );
    return;
  }

  if (!term) {
    // إرجاع كل الطلبات مع Pagination (10 طلبات في كل صفحة)
    currentPage = 1;
    renderOrdersWithPagination();
    statusText.textContent = `تم عرض جميع الطلبات (${allOrders.length}).`;
    return;
  }

  const filtered = allOrders.filter((order) => {
    // البحث برقم الطلب
    const id = order.reference_id || order.id || "";
    const matchesId = String(id).includes(term);

    // البحث برقم الجوال - تحسين شامل
    const customer = order.customer || order.customer_data || {};
    const receiver = order.receiver || {};

    // استخراج جميع أشكال رقم الجوال من جميع المصادر الممكنة
    let mobile =
      customer.mobile ||
      customer.phone ||
      customer.mobile_number ||
      order.customer_mobile ||
      receiver.phone ||
      receiver.mobile ||
      "";

    // استخراج مفتاح الدولة من جميع المصادر الممكنة
    let mobileKey =
      customer.mobile_code ||
      customer.mobile_country_code ||
      customer.phone_country_code ||
      customer.country_code ||
      customer.mobile_key ||
      receiver.mobile_code ||
      "";

    // تنظيف الأرقام (إزالة + والأحرف غير رقمية)
    const cleanMobile = String(mobile).replace(/^\+/, "").replace(/\D/g, "");
    const cleanMobileKey = String(mobileKey)
      .replace(/^\+/, "")
      .replace(/\D/g, "");
    const cleanSearchTerm = term.replace(/^\+/, "").replace(/\D/g, "");

    // البحث في جميع أشكال رقم الجوال بشكل شامل
    let matchesMobile = false;

    if (cleanMobile || cleanMobileKey) {
      // 1. البحث في الرقم الكامل (مفتاح الدولة + الرقم)
      if (cleanMobileKey && cleanMobile) {
        const fullMobile = `${cleanMobileKey}${cleanMobile}`;
        if (fullMobile.includes(cleanSearchTerm)) {
          matchesMobile = true;
        }
      }

      // 2. البحث في الرقم بدون مفتاح الدولة
      if (
        !matchesMobile &&
        cleanMobile &&
        cleanMobile.includes(cleanSearchTerm)
      ) {
        matchesMobile = true;
      }

      // 3. البحث في الرقم الأصلي قبل التنظيف (في حالة احتواء الرقم على مفتاح الدولة مدمج)
      if (!matchesMobile && mobile) {
        const originalClean = String(mobile)
          .replace(/^\+/, "")
          .replace(/\D/g, "");
        if (originalClean.includes(cleanSearchTerm)) {
          matchesMobile = true;
        }
      }

      // 4. البحث في receiver.phone إذا كان مختلفًا عن customer.mobile
      if (!matchesMobile && receiver.phone) {
        const receiverClean = String(receiver.phone)
          .replace(/^\+/, "")
          .replace(/\D/g, "");
        if (receiverClean.includes(cleanSearchTerm)) {
          matchesMobile = true;
        }
      }

      // 5. البحث الجزئي في آخر أرقام الرقم (إذا كان البحث 4 أرقام أو أكثر)
      if (!matchesMobile && cleanMobile && cleanSearchTerm.length >= 4) {
        // البحث في آخر 9 أرقام من الرقم
        const lastDigits = cleanMobile.slice(-Math.min(9, cleanMobile.length));
        if (lastDigits.includes(cleanSearchTerm)) {
          matchesMobile = true;
        }
      }

      // 6. البحث في مفتاح الدولة منفصل (إذا كان البحث قصيرًا)
      if (
        !matchesMobile &&
        cleanMobileKey &&
        cleanMobileKey.includes(cleanSearchTerm)
      ) {
        matchesMobile = true;
      }
    }

    return matchesId || matchesMobile;
  });

  // عند البحث، نعرض جميع النتائج بدون pagination
  renderOrders(filtered);
  paginationContainer.classList.add("hidden");

  if (!filtered.length) {
    statusText.textContent = `لا توجد طلبات مطابقة: ${term}`;
  } else {
    statusText.textContent = `تم العثور على ${filtered.length} طلب/طلبات مطابقة: ${term}`;
  }
}

// إغلاق قسم تفاصيل الطلب
if (closeOrderDetailsBtn && orderDetailsSection) {
  closeOrderDetailsBtn.addEventListener("click", () => {
    orderDetailsSection.classList.add("hidden");
    // التمرير لأعلى الصفحة عند إخفاء التفاصيل
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

async function handleOAuthRedirectIfPresent() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) return;

    const expectedState = localStorage.getItem("salla_oauth_state");
    if (expectedState && state && expectedState !== state) {
      showError("رمز الحالة (state) غير متطابق. يرجى إعادة المحاولة.");
      return;
    }

    oauthStatusText.textContent = "جاري إتمام تسجيل الدخول عبر سلة...";

    const body = new URLSearchParams();
    body.set("client_id", SALLA_CLIENT_ID);
    body.set("client_secret", SALLA_CLIENT_SECRET);
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", SALLA_REDIRECT_URI);

    const res = await fetch(SALLA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMessage = `فشل استبدال الكود بالتوكن. الكود: ${res.status}`;

      if (res.status === 401) {
        errorMessage =
          "انتهت صلاحية أو أن الكود غير صالح. يرجى إعادة تسجيل الدخول.";
      } else {
        try {
          const errorData = JSON.parse(text);
          errorMessage += ` - ${
            errorData.error?.message || errorData.message || text
          }`;
        } catch {
          errorMessage += ` - ${text}`;
        }
      }

      throw new Error(errorMessage);
    }

    const tokenData = await res.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("لم يتم استلام access_token من خدمة سلة.");
    }

    localStorage.setItem("salla_access_token", accessToken);
    accessTokenInput.value = accessToken;

    hideError();
    oauthStatusText.textContent = "تم تسجيل الدخول بنجاح.";
    statusText.textContent =
      "تم تحديث التوكن من سلة. يمكنك الآن تحميل الطلبات.";
  } catch (err) {
    console.error(err);
    showError(err.message || "فشل إتمام عملية تسجيل الدخول عبر سلة.");
    oauthStatusText.textContent = "";
  } finally {
    // إزالة code و state من الرابط حتى لا نكرر المعالجة
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
  }
}

// دالة لعرض الطلبات مع Pagination (10 طلبات في كل صفحة)
function renderOrdersWithPagination() {
  const totalPages = Math.ceil(allOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = allOrders.slice(startIndex, endIndex);

  renderOrders(currentOrders);

  // تحديث Pagination - إظهارها دائماً إذا كان هناك أكثر من 10 طلبات
  if (allOrders.length > itemsPerPage) {
    paginationContainer.classList.remove("hidden");
    paginationInfo.textContent = `صفحة ${currentPage} من ${totalPages} (إجمالي ${allOrders.length} طلب)`;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    // تحديث max value لحقل الإدخال
    pageInput.max = totalPages;
    pageInput.placeholder = `1-${totalPages}`;
  } else {
    paginationContainer.classList.add("hidden");
  }
}

function renderOrders(orders) {
  ordersBody.innerHTML = "";

  orders.forEach((order, index) => {
    const tr = document.createElement("tr");

    // اسم العميل في الجدول: نحاول من customer ثم receiver
    const customerObj = order.customer || {};
    const receiverObj = order.receiver || {};

    const customerName =
      customerObj.name ||
      [customerObj.first_name, customerObj.last_name]
        .filter(Boolean)
        .join(" ") ||
      order.customer_name ||
      receiverObj.name ||
      "غير متوفر";

    // استخراج رقم الجوال (نفس منطق fillOrderDetails)
    let mobile =
      customerObj.mobile ||
      customerObj.phone ||
      customerObj.mobile_number ||
      order.customer_mobile ||
      receiverObj.phone ||
      "";

    let mobileKey =
      customerObj.mobile_code ||
      customerObj.mobile_country_code ||
      customerObj.phone_country_code ||
      customerObj.country_code ||
      customerObj.mobile_key ||
      "";

    // إزالة + من mobileKey إذا كان موجودًا
    if (mobileKey) {
      mobileKey = String(mobileKey).replace(/^\+/, "");
    }

    let customerMobile = "غير متوفر";
    if (mobile) {
      // إزالة + من بداية mobile إذا كان موجودًا
      mobile = String(mobile).replace(/^\+/, "");

      if (mobileKey) {
        // إزالة mobileKey من بداية mobile إذا كان موجودًا لتجنب التكرار
        if (String(mobile).startsWith(mobileKey)) {
          customerMobile = mobile;
        } else {
          customerMobile = `${mobileKey}${mobile}`;
        }
      } else {
        customerMobile = mobile;
      }
    }

    // استخراج حالة الطلب مع التعامل مع الكائنات
    let status = "غير معروف";
    if (order.status) {
      if (typeof order.status === "object") {
        status =
          order.status.name ||
          order.status.label ||
          order.status.status ||
          "غير معروف";
      } else {
        status = order.status;
      }
    } else if (order.status_object) {
      if (typeof order.status_object === "object") {
        status =
          order.status_object.name || order.status_object.label || "غير معروف";
      } else {
        status = order.status_object;
      }
    }

    // تاريخ الطلب في الجدول: يدعم كون الحقل كائنًا
    let createdAt =
      order.created_at ||
      order.createdAt ||
      order.date ||
      (order.date && order.date.date) ||
      "";
    if (createdAt && typeof createdAt === "object") {
      createdAt =
        createdAt.date ||
        createdAt.datetime ||
        createdAt.formatted ||
        createdAt.human ||
        createdAt.value ||
        "";
    }
    const orderId = order.id || order.reference_id;

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${order.reference_id || order.id || "-"}</td>
      <td>${customerName}</td>
      <td>${customerMobile}</td>
      <td>${renderStatusBadge(status)}</td>
      <td>${createdAt}</td>
      <td>
        ${
          orderId
            ? `<button class="details-btn" data-order-id="${orderId}">عرض التفاصيل</button>`
            : "-"
        }
      </td>
    `;

    ordersBody.appendChild(tr);
  });

  // ربط أزرار التفاصيل
  const detailButtons = ordersBody.querySelectorAll(".details-btn");
  detailButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order-id");
      if (orderId) {
        openOrderDetails(orderId);
      }
    });
  });
}

async function openOrderDetails(orderId) {
  hideError();

  const token = accessTokenInput.value.trim();
  if (!token) {
    showError(
      "لا يوجد Access Token. يرجى تسجيل الدخول بسلة أو إدخال التوكن يدويًا."
    );
    return;
  }

  // إظهار قسم التفاصيل والتمرير إليه
  orderDetailsSection.classList.remove("hidden");
  orderMainDetails.innerHTML = "جاري تحميل تفاصيل الطلب...";
  orderShippingDetails.innerHTML = "";
  orderItemsList.innerHTML = "";
  orderInvoicesList.innerHTML = "";

  // التمرير إلى قسم التفاصيل
  setTimeout(() => {
    orderDetailsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  try {
    // جلب تفاصيل الطلب
    const res = await fetch(`${API_BASE}/orders/${orderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMessage = `فشل جلب تفاصيل الطلب. الكود: ${res.status}`;

      if (res.status === 401) {
        errorMessage =
          'انتهت صلاحية Access Token أو أنه غير صالح. يرجى تسجيل الدخول مرة أخرى عبر زر "تسجيل الدخول بسلة (OAuth 2.0)" أو تحديث التوكن في حقل Access Token.';
        // مسح التوكن القديم من localStorage
        localStorage.removeItem("salla_access_token");
        accessTokenInput.value = "";
      } else {
        try {
          const errorData = JSON.parse(text);
          errorMessage += ` - ${
            errorData.error?.message || errorData.message || text
          }`;
        } catch {
          errorMessage += ` - ${text}`;
        }
      }

      throw new Error(errorMessage);
    }

    const data = await res.json();
    const order = data.data || data.order || data;

    // جلب منتجات الطلب من endpoint منفصل (وفق مثال سلة: /orders/items)
    let orderItems = [];

    try {
      // نستخدم order_id كـ query param حسب مثال سلة
      const itemsRes = await fetch(
        `${API_BASE}/orders/items?order_id=${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        // مثال سلة: { status, success, data: [ ...items ] }
        orderItems = itemsData.data || itemsData.items || [];
      } else {
        const txt = await itemsRes.text();
        console.warn("فشل جلب منتجات الطلب، استجابة:", itemsRes.status, txt);
      }
    } catch (itemsErr) {
      console.warn("فشل جلب منتجات الطلب من /orders/items:", itemsErr);
    }

    // إضافة المنتجات إلى كائن الطلب إذا لم تكن موجودة
    if (orderItems.length > 0 && !order.items && !order.products) {
      order.items = orderItems;
    }

    await fillOrderDetails(order);
  } catch (err) {
    console.error(err);
    orderMainDetails.innerHTML = "";
    showError(err.message || "حدث خطأ أثناء جلب تفاصيل الطلب.");
  }
}

async function fillOrderDetails(order) {
  if (!order) return;

  // تفاصيل الطلب الرئيسية
  const customer = order.customer || order.customer_data || {};
  const receiver = order.receiver || {};

  // اسم العميل: نحاول أكثر من حقل محتمل ثم ن fallback إلى بيانات المستلم
  let customerName =
    customer.name ||
    customer.full_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    order.customer_name ||
    order.customer_full_name ||
    receiver.name ||
    "غير متوفر";

  // رقم الجوال مع محاولة إضافة مفتاح الدولة إن وُجد، مع fallback للمستلم
  let mobile =
    customer.mobile ||
    customer.phone ||
    customer.mobile_number ||
    order.customer_mobile ||
    receiver.phone ||
    "";

  let mobileKey =
    customer.mobile_code ||
    customer.mobile_country_code ||
    customer.phone_country_code ||
    customer.country_code ||
    customer.mobile_key ||
    "";

  // إزالة + من mobileKey إذا كان موجودًا
  if (mobileKey) {
    mobileKey = String(mobileKey).replace(/^\+/, "");
  }

  let customerMobile = "غير متوفر";
  if (mobile) {
    // إزالة + من بداية mobile إذا كان موجودًا
    mobile = String(mobile).replace(/^\+/, "");

    if (mobileKey) {
      // إزالة + من mobileKey إذا كان موجودًا
      mobileKey = String(mobileKey).replace(/^\+/, "");
      // إزالة mobileKey من بداية mobile إذا كان موجودًا لتجنب التكرار
      if (String(mobile).startsWith(mobileKey)) {
        customerMobile = mobile;
      } else {
        customerMobile = `${mobileKey}${mobile}`;
      }
    } else {
      customerMobile = mobile;
    }
  }

  // استخراج حالة الطلب مع التعامل مع الكائنات
  let status = "غير معروف";
  if (order.status) {
    if (typeof order.status === "object") {
      status =
        order.status.name ||
        order.status.label ||
        order.status.status ||
        "غير معروف";
    } else {
      status = order.status;
    }
  } else if (order.status_object) {
    if (typeof order.status_object === "object") {
      status =
        order.status_object.name || order.status_object.label || "غير معروف";
    } else {
      status = order.status_object;
    }
  }

  // تاريخ الطلب: دعم كون الحقل كائنًا أو نصًا
  let createdAt =
    order.created_at || order.createdAt || order.order_date || order.date || "";
  if (createdAt && typeof createdAt === "object") {
    createdAt =
      createdAt.date ||
      createdAt.datetime ||
      createdAt.formatted ||
      createdAt.human ||
      createdAt.value ||
      "";
  }

  const refId = order.reference_id || order.id || "-";

  orderMainDetails.innerHTML = `
    <div>
      <span class="label">حالة الطلب</span>
      <span class="value">${renderStatusBadge(status)}</span>
    </div>
    <div>
      <span class="label">اسم العميل</span>
      <span class="value">${customerName}</span>
    </div>
    <div>
      <span class="label">رقم جوال العميل</span>
      <span class="value">${customerMobile}</span>
    </div>
    <div>
      <span class="label">رقم الطلب</span>
      <span class="value">${refId}</span>
    </div>
    <div>
      <span class="label">تاريخ الطلب</span>
      <span class="value">${createdAt}</span>
    </div>
  `;

  // تفاصيل الشحن
  const shipping =
    order.shipping || order.shipping_address || order.delivery || {};

  const addressLines = [];
  if (shipping.country || shipping.country_name) {
    addressLines.push(shipping.country_name || shipping.country);
  }
  if (shipping.city || shipping.city_name) {
    addressLines.push(shipping.city_name || shipping.city);
  }
  if (shipping.address || shipping.street) {
    addressLines.push(shipping.address || shipping.street);
  }

  const address = addressLines.join(" - ") || "غير متوفر";

  const shippingName =
    shipping.name || shipping.receiver_name || customerName || "غير متوفر";

  const shippingMobile =
    shipping.mobile || shipping.phone || customerMobile || "غير متوفر";

  const shippingMethod =
    (order.shipping_company && order.shipping_company.name) ||
    order.shipping_method ||
    "غير متوفر";

  orderShippingDetails.innerHTML = `
    <div>
      <span class="label">اسم المستلم</span>
      <span class="value">${shippingName}</span>
    </div>
    <div>
      <span class="label">جوال المستلم</span>
      <span class="value">${shippingMobile}</span>
    </div>
    <div>
      <span class="label">عنوان الشحن</span>
      <span class="value">${address}</span>
    </div>
    <div>
      <span class="label">شركة/طريقة الشحن</span>
      <span class="value">${shippingMethod}</span>
    </div>
  `;

  // منتجات الطلب: دعم تراكيب مختلفة
  let items = [];
  if (Array.isArray(order.items)) {
    items = order.items;
  } else if (order.items && Array.isArray(order.items.data)) {
    items = order.items.data;
  } else if (Array.isArray(order.products)) {
    items = order.products;
  } else if (order.products && Array.isArray(order.products.data)) {
    items = order.products.data;
  } else if (Array.isArray(order.order_items)) {
    items = order.order_items;
  } else if (order.order_items && Array.isArray(order.order_items.data)) {
    items = order.order_items.data;
  }

  if (!items.length) {
    orderItemsList.innerHTML = "<p>لا توجد منتجات مسجلة لهذا الطلب.</p>";
  } else {
    // جلب بيانات المنتجات الكاملة لجلب الصور (إذا لزم الأمر)
    const itemsWithImages = await Promise.all(
      items.map(async (it) => {
        // إذا لم تكن هناك صورة وكان هناك product_id، نجلب بيانات المنتج الكاملة
        const hasImage =
          it.thumbnail ||
          it.main_image ||
          (Array.isArray(it.images) && it.images.length > 0) ||
          (it.product &&
            (it.product.thumbnail ||
              it.product.main_image ||
              (Array.isArray(it.product.images) &&
                it.product.images.length > 0)));

        if (!hasImage && (it.product_id || (it.product && it.product.id))) {
          const productId = it.product_id || (it.product && it.product.id);
          const token = accessTokenInput.value.trim();

          if (token && productId) {
            try {
              const productRes = await fetch(
                `${API_BASE}/products/${productId}`,
                {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                }
              );

              if (productRes.ok) {
                const productData = await productRes.json();
                const fullProduct =
                  productData.data || productData.product || productData;

                // إضافة بيانات المنتج الكاملة إلى العنصر
                if (!it.product) {
                  it.product = {};
                }
                it.product.thumbnail =
                  it.product.thumbnail || fullProduct.thumbnail;
                it.product.main_image =
                  it.product.main_image || fullProduct.main_image;
                it.product.images = it.product.images || fullProduct.images;
              }
            } catch (productErr) {
              console.warn(`فشل جلب بيانات المنتج ${productId}:`, productErr);
            }
          }
        }

        return it;
      })
    );

    const cards = itemsWithImages
      .map((it) => {
        // استخراج اسم المنتج
        const name =
          it.name ||
          (it.product && (it.product.name || it.product.title)) ||
          it.title ||
          (it.product_name && it.product_name) ||
          "منتج بدون اسم";

        // استخراج الكمية
        const qty =
          it.quantity || it.qty || it.qty_ordered || it.quantity_ordered || 1;

        // استخراج السعر - معالجة الكائنات (دعم بنية سلة الفعلية)
        let unitPrice = 0;
        let totalPrice = 0;
        if (it.amounts) {
          if (
            it.amounts.price_without_tax &&
            it.amounts.price_without_tax.amount
          ) {
            unitPrice = it.amounts.price_without_tax.amount;
          }
          if (it.amounts.total && it.amounts.total.amount) {
            totalPrice = it.amounts.total.amount;
            if (!unitPrice) {
              unitPrice = totalPrice / qty;
            }
          }
        }
        if (!unitPrice) {
          if (it.price) {
            unitPrice =
              typeof it.price === "object"
                ? it.price.amount || it.price.value || 0
                : it.price;
          } else if (it.unit_price) {
            unitPrice =
              typeof it.unit_price === "object"
                ? it.unit_price.amount || it.unit_price.value || 0
                : it.unit_price;
          } else if (it.total) {
            const totalValue =
              typeof it.total === "object"
                ? it.total.amount || it.total.value || 0
                : it.total;
            unitPrice = totalValue / qty;
          } else if (it.subtotal) {
            const subtotalValue =
              typeof it.subtotal === "object"
                ? it.subtotal.amount || it.subtotal.value || 0
                : it.subtotal;
            unitPrice = subtotalValue / qty;
          }
        }
        if (!totalPrice && unitPrice) {
          totalPrice = unitPrice * qty;
        }

        // استخراج العملة
        const currency =
          (it.currency &&
            (typeof it.currency === "string"
              ? it.currency
              : it.currency.code)) ||
          (it.amounts && it.amounts.total && it.amounts.total.currency) ||
          (it.amounts &&
            it.amounts.price_without_tax &&
            it.amounts.price_without_tax.currency) ||
          (it.price && it.price.currency) ||
          (it.total && it.total.currency) ||
          "";

        // SKU
        const sku = it.sku || "";

        // الوزن
        const weightLabel = it.weight_label || it.weight || "";

        // الخيارات (مثل الحجم)
        let optionsText = "";
        if (it.options && Array.isArray(it.options) && it.options.length > 0) {
          const optionsList = it.options
            .map((opt) => {
              const optName = opt.name || "";
              const optValue = opt.value ? opt.value.name || opt.value : "";
              return optValue ? `${optName}: ${optValue}` : "";
            })
            .filter(Boolean)
            .join(", ");
          if (optionsList) {
            optionsText = optionsList;
          }
        }

        // الصورة (إن وجدت) - دعم بنية سلة الكاملة
        let imageUrl = "";

        // محاولة 1: thumbnail (الصورة المصغرة)
        if (it.thumbnail) {
          imageUrl = it.thumbnail;
        } else if (it.product && it.product.thumbnail) {
          imageUrl = it.product.thumbnail;
        }

        // محاولة 2: main_image (الصورة الرئيسية)
        if (!imageUrl) {
          if (it.main_image) {
            imageUrl = it.main_image;
          } else if (it.product && it.product.main_image) {
            imageUrl = it.product.main_image;
          }
        }

        // محاولة 3: images array (مصفوفة الصور)
        if (!imageUrl) {
          if (Array.isArray(it.images) && it.images.length > 0) {
            const img = it.images[0];
            imageUrl =
              typeof img === "string"
                ? img
                : img.url || img.path || img.src || "";
          } else if (
            it.product &&
            Array.isArray(it.product.images) &&
            it.product.images.length > 0
          ) {
            const img = it.product.images[0];
            imageUrl =
              typeof img === "string"
                ? img
                : img.url || img.path || img.src || "";
          }
        }

        const imagePart = imageUrl
          ? `<img src="${imageUrl}" alt="${name}" class="product-image" />`
          : `<div class="product-image placeholder">${name
              .toString()
              .trim()
              .charAt(0)
              .toUpperCase()}</div>`;

        return `
          <div class="product-card">
            <div class="product-card-main">
              ${imagePart}
              <div class="product-info">
                <div class="product-title">${name}</div>
                ${
                  sku
                    ? `<div class="product-meta"><span class="label">SKU:</span> <span class="value">${sku}</span></div>`
                    : ""
                }
                ${
                  optionsText
                    ? `<div class="product-meta"><span class="label">الخيارات:</span> <span class="value">${optionsText}</span></div>`
                    : ""
                }
              </div>
            </div>
            <div class="product-card-details">
              <div>
                <span class="label">الكمية</span>
                <span class="value">${qty}</span>
              </div>
              <div>
                <span class="label">سعر الوحدة</span>
                <span class="value">${unitPrice} ${currency}</span>
              </div>
              <div>
                <span class="label">الإجمالي</span>
                <span class="value">${totalPrice} ${currency}</span>
              </div>
              ${
                weightLabel
                  ? `<div><span class="label">الوزن</span><span class="value">${weightLabel}</span></div>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");

    orderItemsList.innerHTML = `<div class="products-grid">${cards}</div>`;
  }

  // فواتير الطلب: دعم تراكيب مختلفة
  let invoices = [];
  if (Array.isArray(order.invoices)) {
    invoices = order.invoices;
  } else if (order.invoices && Array.isArray(order.invoices.data)) {
    invoices = order.invoices.data;
  } else if (Array.isArray(order.order_invoices)) {
    invoices = order.order_invoices;
  } else if (order.order_invoices && Array.isArray(order.order_invoices.data)) {
    invoices = order.order_invoices.data;
  }

  if (!invoices.length) {
    orderInvoicesList.innerHTML = "<p>لا توجد فواتير مسجلة لهذا الطلب.</p>";
  } else {
    const listInvoices = invoices
      .map((inv) => {
        const num = inv.number || inv.id || inv.invoice_number || "-";
        const total =
          inv.total ||
          (inv.amount && (inv.amount.total || inv.amount.value)) ||
          inv.grand_total ||
          0;
        let date = inv.created_at || inv.date || inv.issued_at || "";
        if (date && typeof date === "object") {
          date =
            date.date ||
            date.datetime ||
            date.formatted ||
            date.human ||
            date.value ||
            "";
        }
        return `<li>فاتورة رقم ${num} - المجموع: ${total} - التاريخ: ${date}</li>`;
      })
      .join("");

    orderInvoicesList.innerHTML = `<ul>${listInvoices}</ul>`;
  }
}

function renderStatusBadge(status) {
  const normalized = String(status).toLowerCase();
  let cls = "status-pending";

  if (normalized.includes("cancel") || normalized.includes("ملغي")) {
    cls = "status-cancelled";
  } else if (
    normalized.includes("complete") ||
    normalized.includes("delivered") ||
    normalized.includes("مكتمل")
  ) {
    cls = "status-completed";
  }

  return `<span class="badge ${cls}">${status}</span>`;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

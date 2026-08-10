import { apiRequest, extractResults } from "./client";

const CART_SESSION_KEY = "danajet-api-cart-session";
const CART_ID_KEY = "danajet-api-cart-id";

function createBrowserKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `cart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getGuestSessionKey() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(CART_SESSION_KEY);
  if (existing) return existing;
  const next = createBrowserKey();
  localStorage.setItem(CART_SESSION_KEY, next);
  return next;
}

function withSession(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}session_key=${encodeURIComponent(getGuestSessionKey())}`;
}

function getStoredCartId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CART_ID_KEY) || "";
}

function setStoredCartId(id) {
  if (typeof window === "undefined" || !id) return;
  localStorage.setItem(CART_ID_KEY, String(id));
}

function clearStoredCartId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_ID_KEY);
}

function clearStoredCartSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_ID_KEY);
  localStorage.removeItem(CART_SESSION_KEY);
}

function getCatalogItem(item) {
  return item.product_detail || item.course_detail || {};
}

export function normalizeCartItem(item) {
  const catalogItem = getCatalogItem(item);
  const metadata = catalogItem.metadata && typeof catalogItem.metadata === "object" ? catalogItem.metadata : {};
  const isCourse = item.item_type === "course";

  return {
    id: item.id,
    apiId: item.id,
    productId: item.product,
    courseId: item.course,
    item_type: item.item_type,
    slug: isCourse ? `courses/${catalogItem.slug || ""}` : catalogItem.slug || "",
    title: item.title || catalogItem.title || "Danajet item",
    subtitle: catalogItem.subtitle || catalogItem.summary || "",
    category_label: metadata.category_label || catalogItem.category_detail?.name || catalogItem.category || (isCourse ? "Danajet Academy" : "Danajet item"),
    author: catalogItem.author || "Danajet",
    price: Number(item.unit_price ?? catalogItem.price ?? 0),
    quantity: Number(item.quantity) || 1,
    currency: catalogItem.currency || metadata.currency || "USD",
    cover: metadata.cover || "orange",
    accent: metadata.accent || "#e3450b",
  };
}

export function getCartItemCount(cart) {
  return (cart?.items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

export async function getActiveCart({ create = false } = {}) {
  const guestSessionKey = getGuestSessionKey();
  const query = new URLSearchParams({ status: "active", session_key: guestSessionKey });
  const carts = extractResults(await apiRequest(`/api/carts/?${query.toString()}`));
  const activeCart = carts[0];

  if (activeCart) {
    setStoredCartId(activeCart.id);
    return activeCart;
  }

  if (!create) {
    clearStoredCartId();
    return null;
  }

  const created = await apiRequest("/api/carts/", {
    method: "POST",
    body: { session_key: guestSessionKey, currency: "USD", status: "active" },
  });
  setStoredCartId(created.id);
  return created;
}

export async function getCartDisplayItems() {
  const cart = await getActiveCart();
  return (cart?.items || []).map(normalizeCartItem);
}

export async function getCartCount() {
  const cart = await getActiveCart();
  return getCartItemCount(cart);
}

export async function addCartItem(item, quantity = 1) {
  const cart = await getActiveCart({ create: true });
  const isCourse = item.item_type === "course" || item.courseId || item.course_id || String(item.id).startsWith("course-");
  const payload = {
    item_type: isCourse ? "course" : "product",
    quantity: Math.max(1, Number(quantity) || 1),
  };

  if (isCourse) {
    payload.course = item.courseId || item.course_id || item.id;
  } else {
    payload.product = item.productId || item.product_id || item.id;
  }

  await apiRequest(withSession(`/api/carts/${cart.id}/items/`), {
    method: "POST",
    body: payload,
  });
  window.dispatchEvent(new Event("danajet-cart-updated"));
}

export async function updateCartItemQuantity(itemId, quantity) {
  const nextQuantity = Math.max(1, Number(quantity) || 1);
  await apiRequest(withSession(`/api/cart-items/${itemId}/`), {
    method: "PATCH",
    body: { quantity: nextQuantity },
  });
  window.dispatchEvent(new Event("danajet-cart-updated"));
}

export async function removeCartItem(itemId) {
  await apiRequest(withSession(`/api/cart-items/${itemId}/`), { method: "DELETE" });
  window.dispatchEvent(new Event("danajet-cart-updated"));
}

export async function clearBackendCart() {
  const cartId = getStoredCartId();
  const cart = cartId ? { id: cartId } : await getActiveCart();
  if (!cart?.id) return;
  await apiRequest(withSession(`/api/carts/${cart.id}/clear/`), { method: "POST" });
  window.dispatchEvent(new Event("danajet-cart-updated"));
}

export async function submitCheckout(details) {
  const cart = await getActiveCart();
  if (!cart?.id) {
    throw new Error("Your shopping bag is empty.");
  }

  const order = await apiRequest("/api/checkout/", {
    method: "POST",
    body: {
      cart: cart.id,
      cart_session_key: getGuestSessionKey(),
      ...details,
    },
  });
  clearStoredCartSession();
  return order;
}

export async function getOrders() {
  return extractResults(await apiRequest("/api/orders/?ordering=-created_at"));
}

export async function uploadOrderReceipt(orderNumber, email, file) {
  const formData = new FormData();
  formData.append("order_number", orderNumber);
  formData.append("email", email);
  formData.append("receipt", file);
  return apiRequest("/api/orders/attach-receipt/", { method: "POST", body: formData });
}

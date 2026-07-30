import { apiListAll, apiRequest, resolveMediaUrl } from "./client";

function metadataOf(item) {
  return item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
}

export function normalizeProduct(product) {
  const metadata = metadataOf(product);
  const rawGalleryImages = Array.isArray(product.gallery) ? product.gallery : [];
  const imageUrl = resolveMediaUrl(metadata.image_url || rawGalleryImages[0] || product.image || "");
  const galleryImages = [imageUrl, ...rawGalleryImages.map(resolveMediaUrl)]
    .filter(Boolean)
    .filter((image, index, images) => images.indexOf(image) === index);
  return {
    ...product,
    price: product.price ?? "0.00",
    compare_at_price: product.compare_at_price || metadata.compare_at_price || null,
    currency: metadata.currency || "USD",
    rating: Number(product.rating ?? metadata.rating ?? 5),
    review_count: Number(product.review_count || 0),
    badge: metadata.badge || null,
    cover: metadata.cover || "orange",
    accent: metadata.accent || "#e3450b",
    category_label: metadata.category_label || product.category_detail?.name || product.category || "Danajet item",
    filter_categories: metadata.filter_categories || [product.category_detail?.slug || product.category].filter(Boolean),
    imageUrl,
    galleryImages,
    is_featured: Boolean(product.featured || product.is_featured),
    description: product.summary || product.description || "",
    features: product.features || [],
  };
}

export function normalizeCourse(course) {
  const metadata = metadataOf(course);
  const rating = metadata.rating || "4.9";
  const rawCategoryIcon = metadata.category_icon || "";
  const categoryIcon = rawCategoryIcon && !/^[a-z0-9-]+$/i.test(rawCategoryIcon) ? rawCategoryIcon : "";
  return {
    ...course,
    courseTitle: course.title,
    courseSubtitle: course.subtitle || course.summary || course.category || "Danajet Academy",
    displayPrice: Number(course.price || 0),
    rating,
    videoSrc: resolveMediaUrl(course.video_url || metadata.intro_video_url || metadata.video_src || ""),
    thumbnailUrl: resolveMediaUrl(course.thumbnail_url || metadata.thumbnail_url || ""),
    compare_at_price: metadata.compare_at_price || "49.00",
    category: course.category_detail?.name || course.category || "Courses",
    categorySlug: course.category_detail?.slug || "",
    categoryIcon,
  };
}

export function normalizeShopCategory(category) {
  return {
    id: category.slug || category.id,
    label: category.name || category.label,
    slug: category.slug || category.id,
    description: category.description || "",
  };
}

export async function getProducts() {
  const data = await apiListAll("/api/products/?ordering=display_order");
  return data.map(normalizeProduct);
}

export async function getShopCategories() {
  const data = await apiListAll("/api/categories/?category_type=product&is_visible=true&ordering=display_order,name");
  return [{ id: "all", label: "Shop all" }, ...data.map(normalizeShopCategory)];
}

export async function getProduct(slug) {
  const data = await apiRequest(`/api/products/${slug}/`);
  return normalizeProduct(data);
}

export async function getCourses() {
  const data = await apiListAll("/api/courses/?ordering=display_order");
  return data.map(normalizeCourse);
}

export async function getCourse(slug) {
  const data = await apiRequest(`/api/courses/${slug}/`);
  return normalizeCourse(data);
}

export async function requestFreeResourceDownload(slug, { name = "", email }) {
  return apiRequest(`/api/courses/${slug}/request-download/`, {
    method: "POST",
    body: { name, email },
  });
}

import { apiRequest, extractResults, resolveMediaUrl } from "./client";
import { normalizeCourse, normalizeProduct } from "./shop";

function moneyValue(value) {
  return String(value || "0").replace(/[^0-9.]/g, "") || "0";
}

function slugify(value, fallback = "item") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || fallback;
}

function endpoint(path, lookup) {
  return lookup ? `${path}${lookup}/` : path;
}

async function listAll(path) {
  let nextPath = path;
  const results = [];
  while (nextPath) {
    const data = await apiRequest(nextPath);
    if (!data?.results) return extractResults(data);
    results.push(...data.results);
    if (!data.next) {
      nextPath = "";
    } else {
      const nextUrl = new URL(data.next);
      nextPath = `${nextUrl.pathname}${nextUrl.search}`;
    }
  }
  return results;
}

function settingGroupFromKey(key) {
  const knownGroups = [
    "about-page",
    "contact-footer",
    "request-form",
    "site",
    "collection",
  ];
  return knownGroups.find((group) => key === group || key.startsWith(`${group}-`)) || "site";
}

function resolveProductCategory(label, fallbackSlug = "") {
  const normalized = String(label || "").trim().toLowerCase();
  const defaults = {
    "shop all": { label: "Shop all", slug: "all" },
    "adult books": { label: "Adult Books", slug: "adult" },
    "children's book": { label: "Children's Book", slug: "childrens" },
    "childrens book": { label: "Children's Book", slug: "childrens" },
    "children's books": { label: "Children's Book", slug: "childrens" },
    "storytelling": { label: "Storytelling", slug: "storytelling" },
  };
  return defaults[normalized] || { label: label || "Shop all", slug: fallbackSlug || slugify(label, "all") };
}

function normalizeCategory(category) {
  return {
    ...category,
    id: category.slug || category.id,
    apiId: category.id,
    label: category.name,
    slug: category.slug,
    description: category.description || "",
    status: category.is_visible ? "Visible" : "Hidden",
  };
}

function mediaTypeFromFile(file) {
  if (file?.type?.startsWith("video/")) return "video";
  if (file?.type?.startsWith("image/")) return "image";
  return "document";
}

export async function uploadAdminMediaFile(file, usage) {
  if (!file) return null;
  const formData = new FormData();
  formData.append("title", file.name.replace(/\.[^.]+$/, "") || "Admin upload");
  formData.append("asset_type", mediaTypeFromFile(file));
  formData.append("usage", usage);
  formData.append("is_public", "true");
  formData.append("file", file);
  const uploaded = await apiRequest("/api/media-assets/", { method: "POST", body: formData });
  return normalizeAdminMedia(uploaded);
}

export function normalizeAdminProduct(product) {
  const normalized = normalizeProduct(product);
  const metadata = product.metadata || {};
  const imageUrl = resolveMediaUrl(metadata.image_url || product.gallery?.[0] || product.image || product.image_url || "");
  const galleryImages = [
    imageUrl,
    ...(Array.isArray(product.gallery) ? product.gallery.map(resolveMediaUrl) : []),
  ].filter(Boolean).filter((image, index, images) => images.indexOf(image) === index);
  const category = resolveProductCategory(metadata.category_label || normalized.category_label, product.category || normalized.category);
  return {
    ...normalized,
    apiId: product.id,
    id: product.slug || product.id,
    slug: product.slug,
    metadata,
    gallery: galleryImages,
    title: product.title || normalized.title || "",
    subtitle: product.subtitle || "",
    description: product.summary || product.subtitle || "",
    author: product.author || "Danajet BookLab",
    category: category.slug,
    category_label: category.label,
    price: normalized.price || `$${Number(product.price || 0).toFixed(2)}`,
    compareAtPrice: product.compare_at_price || "",
    inventory: Number(product.inventory || 0),
    sku: product.sku || "",
    is_featured: Boolean(product.featured || product.is_featured),
    featured: Boolean(product.featured || product.is_featured),
    published: product.is_published !== false,
    digital: Boolean(product.is_digital),
    amazonUrl: product.amazon_url || product.external_url || "",
    externalUrl: product.external_url || "",
    imageUrl,
    cover: metadata.cover || "",
    accent: metadata.accent || "",
    ageRange: product.age_range || "",
    format: product.format || "",
    featuresText: Array.isArray(product.features) ? product.features.join("\n") : "",
    galleryImages,
  };
}

export function normalizeAdminCourse(course) {
  const normalized = normalizeCourse(course);
  const metadata = course.metadata || {};
  return {
    ...normalized,
    apiId: course.id,
    id: course.slug || course.id,
    price: `$${Number(course.price || 0).toFixed(2)}`,
    embedUrl: resolveMediaUrl(course.embed_url || course.video_url || ""),
    introVideoUrl: resolveMediaUrl(course.video_url || metadata.intro_video_url || ""),
    thumbnailUrl: resolveMediaUrl(course.thumbnail_url || metadata.thumbnail_url || ""),
    accessUrl: course.access_url || "",
    fileType: metadata.file_type || "PDF",
    duration: course.duration || "",
    level: course.level || "",
    outcomesText: Array.isArray(course.outcomes) ? course.outcomes.join("\n") : "",
    resourcesText: Array.isArray(course.resources) ? course.resources.join("\n") : "",
    description: course.summary || "",
    status: course.status || "Draft",
  };
}

export function normalizeAdminPortfolio(project) {
  const rawImage = project.metadata?.image || project.images?.[0] || "03";
  const imageNumber = rawImage?.replace?.(/^page-/i, "").replace?.(/\.jpg$/i, "") || "03";
  return {
    ...project,
    apiId: project.id,
    id: project.slug || project.id,
    image: imageNumber,
    imageUrl: resolveMediaUrl(project.metadata?.image_url || project.images?.[0] || ""),
    mediaType: project.metadata?.media_type || "",
    status: project.is_published ? (project.featured ? "Featured" : "Visible") : "Draft",
    embedUrl: project.project_url || "",
    actionLabel: project.metadata?.action_label || "",
    description: project.summary || "",
  };
}

export function normalizeAdminReview(review) {
  return {
    ...review,
    apiId: review.id,
    id: review.slug || review.id,
    name: review.reviewer_name || review.title,
    role: review.reviewer_role || "",
    image: resolveMediaUrl(review.reviewer_image || review.metadata?.image || ""),
    ctaLabel: review.cta_label || "",
    ctaUrl: review.cta_url || "",
  };
}

export function normalizeAdminRequest(request) {
  return {
    ...request,
    id: request.id,
    name: request.name || "Client",
    service: request.service || request.project_type || "Project request",
    budget: request.budget || request.budget_range || "Not provided",
    stage: request.stage || request.project_stage || "New",
    status: request.status || "New",
    date: request.created_at ? new Date(request.created_at).toLocaleDateString() : "",
  };
}

export function normalizeAdminBrand(brand) {
  return {
    ...brand,
    apiId: brand.id,
    id: brand.slug || brand.id,
    name: brand.name || brand.title || "",
    copy: brand.summary || brand.metadata?.copy || "",
    code: brand.code || "",
    link: brand.href || brand.metadata?.link || "/request-project",
    status: brand.status || (brand.is_published ? "Visible" : "Hidden"),
  };
}

export function normalizeAdminMedia(asset) {
  return {
    ...asset,
    apiId: asset.id,
    id: asset.slug || asset.id,
    slug: asset.slug,
    title: asset.title,
    type: asset.asset_type || "image",
    path: resolveMediaUrl(asset.file_url || asset.external_url || ""),
    usage: asset.usage || "",
  };
}

export function normalizeAdminSetting(setting) {
  return {
    id: setting.key,
    ...setting,
  };
}

export async function listAdminProducts() {
  const data = extractResults(await apiRequest("/api/products/?ordering=display_order"));
  return data.map(normalizeAdminProduct);
}

export async function listAdminShopCategories() {
  const data = extractResults(await apiRequest("/api/categories/?category_type=product&ordering=display_order,name"));
  return data.map(normalizeCategory);
}

export async function saveAdminShopCategory(item) {
  const name = String(item.label || item.name || "New Category").trim();
  const payload = {
    name,
    slug: slugify(item.slug || name),
    category_type: "product",
    description: item.description || "",
    is_visible: item.status !== "Hidden",
  };
  const saved = await apiRequest(endpoint("/api/categories/", item.apiId ? item.slug || item.id : null), {
    method: item.apiId ? "PATCH" : "POST",
    body: payload,
  });
  return normalizeCategory(saved);
}

export async function deleteAdminShopCategory(item) {
  await apiRequest(endpoint("/api/categories/", item.slug || item.id), { method: "DELETE" });
}

export async function createAdminProduct(draft) {
  const product = await apiRequest("/api/products/", {
    method: "POST",
    body: productPayloadFromDraft(draft),
  });
  return normalizeAdminProduct(product);
}

function featuresFromText(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function productPayloadFromDraft(draft, existingProduct = null) {
  const field = (key) => String(draft[key] || "").trim();
  const title = field("title") || "New Book";
  const galleryImages = [
    field("imageUrl"),
    field("imageUrl2"),
    field("imageUrl3"),
    ...(Array.isArray(draft.galleryImages) ? draft.galleryImages : []),
  ].filter(Boolean).filter((image, index, images) => images.indexOf(image) === index).slice(0, 3);
  const imageUrl = galleryImages[0] || "";
  const category = resolveProductCategory(field("category_label"), field("category"));
  const payload = {
    title,
    slug: existingProduct ? undefined : slugify(title),
    subtitle: field("subtitle") || field("description"),
    summary: field("description") || field("subtitle"),
    category: category.slug,
    author: field("author") || "Danajet BookLab",
    sku: field("sku"),
    price: moneyValue(draft.price),
    compare_at_price: draft.compareAtPrice ? moneyValue(draft.compareAtPrice) : null,
    inventory: Number(draft.inventory) || 0,
    amazon_url: field("amazonUrl"),
    external_url: field("externalUrl"),
    age_range: field("ageRange"),
    format: field("format"),
    featured: Boolean(draft.featured),
    is_published: Boolean(draft.published),
    is_digital: Boolean(draft.digital),
    features: featuresFromText(draft.featuresText),
    gallery: galleryImages,
    metadata: {
      ...(existingProduct?.metadata || {}),
      category_label: category.label,
      filter_categories: category.slug === "all" ? [] : [category.slug],
      cover: field("cover") || "orange",
      accent: field("accent") || "#e3450b",
      image_url: imageUrl,
    },
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return payload;
}

export async function updateAdminProduct(product, patch) {
  const updated = await apiRequest(endpoint("/api/products/", product.slug || product.id), {
    method: "PATCH",
    body: patch,
  });
  return normalizeAdminProduct(updated);
}

export async function saveAdminProduct(draft, existingProduct) {
  const uploadedImages = [];
  for (const file of (draft.imageFiles || []).slice(0, 3)) {
    const uploaded = await uploadAdminMediaFile(file, "Product gallery");
    if (uploaded?.path) uploadedImages.push(uploaded.path);
  }
  const preparedDraft = {
    ...draft,
    galleryImages: uploadedImages.length
      ? [...uploadedImages, ...(draft.galleryImages || []).filter((image) => !uploadedImages.includes(image))].slice(0, 3)
      : draft.galleryImages,
    imageUrl: uploadedImages[0] || draft.imageUrl,
    imageUrl2: uploadedImages[1] || (uploadedImages.length ? "" : draft.imageUrl2),
    imageUrl3: uploadedImages[2] || (uploadedImages.length ? "" : draft.imageUrl3),
  };
  const saved = await apiRequest(endpoint("/api/products/", existingProduct?.slug || existingProduct?.id), {
    method: existingProduct ? "PATCH" : "POST",
    body: productPayloadFromDraft(preparedDraft, existingProduct),
  });
  return normalizeAdminProduct(saved);
}

export async function deleteAdminProduct(product) {
  await apiRequest(endpoint("/api/products/", product.slug || product.id), { method: "DELETE" });
}

export async function listAdminCourses() {
  const data = extractResults(await apiRequest("/api/courses/?ordering=display_order"));
  return data.map(normalizeAdminCourse);
}

export async function saveAdminCourse(draft, existingCourse) {
  const title = draft.title.trim() || "New Course";
  const thumbnail = draft.thumbnailFile ? await uploadAdminMediaFile(draft.thumbnailFile, "Course thumbnail") : null;
  const introVideo = draft.introVideoFile ? await uploadAdminMediaFile(draft.introVideoFile, "Course intro video") : null;
  const embedUrl = draft.embedUrl?.trim?.() || "";
  const manualIntroVideoUrl = draft.introVideoUrl?.trim?.() || "";
  const manualThumbnailUrl = draft.thumbnailUrl?.trim?.() || "";
  const accessUrl = draft.accessUrl?.trim?.() || "";
  const isFullUrl = (value) => /^https?:\/\//i.test(value || "");
  const payload = {
    title,
    slug: existingCourse ? undefined : slugify(title),
    category: draft.category,
    subtitle: draft.subtitle?.trim?.() || draft.description.trim(),
    summary: draft.description.trim(),
    price: moneyValue(draft.price),
    status: draft.status,
    embed_url: isFullUrl(embedUrl) ? embedUrl : "",
    video_url: isFullUrl(manualIntroVideoUrl) ? manualIntroVideoUrl : "",
    thumbnail_url: isFullUrl(manualThumbnailUrl) ? manualThumbnailUrl : "",
    access_url: isFullUrl(accessUrl) ? accessUrl : "",
    duration: draft.duration?.trim?.() || "",
    level: draft.level?.trim?.() || "",
    is_published: draft.status !== "Draft",
    outcomes: featuresFromText(draft.outcomesText),
    resources: featuresFromText(draft.resourcesText),
    metadata: {
      ...(existingCourse?.metadata || {}),
      embed_url: embedUrl,
      thumbnail_url: thumbnail?.path || manualThumbnailUrl || "",
      intro_video_url: introVideo?.path || manualIntroVideoUrl || embedUrl,
      file_type: draft.fileType?.trim?.() || "PDF",
    },
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

  const saved = await apiRequest(endpoint("/api/courses/", existingCourse?.slug || existingCourse?.id), {
    method: existingCourse ? "PATCH" : "POST",
    body: payload,
  });
  return normalizeAdminCourse(saved);
}

export async function deleteAdminCourse(course) {
  await apiRequest(endpoint("/api/courses/", course.slug || course.id), { method: "DELETE" });
}

export async function listAdminPortfolio() {
  const data = extractResults(await apiRequest("/api/portfolio/?ordering=display_order"));
  return data.map(normalizeAdminPortfolio);
}

export async function saveAdminPortfolio(draft, existingProject) {
  const title = draft.title.trim() || "New Portfolio Project";
  const uploaded = draft.imageFile ? await uploadAdminMediaFile(draft.imageFile, "Portfolio image") : null;
  const imageValue = uploaded?.path || draft.imageUrl?.trim?.() || draft.image.trim().replace(/^page-/i, "").replace(/\.jpg$/i, "") || "03";
  const isUploadedImage = /^https?:\/\//i.test(imageValue) || imageValue.startsWith("/") || imageValue.startsWith("media/") || imageValue.startsWith("uploads/");
  const imageAsset = isUploadedImage ? imageValue : `page-${imageValue}.jpg`;
  const payload = {
    title,
    slug: existingProject ? undefined : slugify(title),
    category: draft.category,
    client: draft.client.trim(),
    summary: draft.description.trim(),
    project_url: draft.embedUrl.trim(),
    featured: draft.status === "Featured",
    is_published: draft.status !== "Draft",
    images: [imageAsset],
    metadata: {
      ...(existingProject?.metadata || {}),
      image: imageValue,
      image_url: isUploadedImage ? imageValue : "",
      media_type: draft.mediaType || (/\.(mp4|webm|ogg|mov)(?:$|[?#])/i.test(imageValue) || draft.imageFile?.type?.startsWith("video/") ? "video" : "image"),
      action_label: draft.actionLabel?.trim?.() || "",
    },
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

  const saved = await apiRequest(endpoint("/api/portfolio/", existingProject?.slug || existingProject?.id), {
    method: existingProject ? "PATCH" : "POST",
    body: payload,
  });
  return normalizeAdminPortfolio(saved);
}

export async function deleteAdminPortfolio(project) {
  await apiRequest(endpoint("/api/portfolio/", project.slug || project.id), { method: "DELETE" });
}

export async function listAdminReviews() {
  const data = extractResults(await apiRequest("/api/reviews/?ordering=display_order"));
  return data.map(normalizeAdminReview);
}

export async function saveAdminReview(draft, existingReview) {
  const hasBackendReview = Boolean(existingReview?.apiId || existingReview?.slug);
  const name = draft.name.trim() || "New Reviewer";
  const headshot = draft.imageFile ? await uploadAdminMediaFile(draft.imageFile, "Reviewer headshot") : null;
  const image = headshot?.path || draft.image.trim();
  const payload = {
    title: `${name} review`,
    slug: hasBackendReview ? undefined : slugify(`${name} review`),
    reviewer_name: name,
    reviewer_role: draft.role.trim(),
    quote: draft.quote.trim() || "Draft testimonial text.",
    rating: Math.min(5, Math.max(1, Number(draft.rating) || 5)),
    service: draft.service,
    project: draft.project.trim(),
    cta_label: draft.ctaLabel.trim(),
    cta_url: draft.ctaUrl.trim(),
    is_published: true,
    metadata: { image },
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

  const saved = await apiRequest(endpoint("/api/reviews/", hasBackendReview ? existingReview.slug || existingReview.id : null), {
    method: hasBackendReview ? "PATCH" : "POST",
    body: payload,
  });
  return normalizeAdminReview(saved);
}

export async function deleteAdminReview(review) {
  if (!review?.apiId && !review?.slug) return;
  await apiRequest(endpoint("/api/reviews/", review.slug || review.id), { method: "DELETE" });
}

export async function listAdminRequests() {
  const data = extractResults(await apiRequest("/api/project-requests/?ordering=-created_at"));
  return data.map(normalizeAdminRequest);
}

export async function updateAdminRequestStatus(request, status) {
  const updated = await apiRequest(`/api/project-requests/${request.id}/`, {
    method: "PATCH",
    body: { status },
  });
  return normalizeAdminRequest(updated);
}

export function normalizeAdminOrder(order) {
  return {
    ...order,
    id: order.id,
    customerName: `${order.first_name || ""} ${order.last_name || ""}`.trim() || "Guest",
    date: order.created_at ? new Date(order.created_at).toLocaleDateString() : "",
    receiptUrl: resolveMediaUrl(order.receipt_url || ""),
  };
}

export async function listAdminOrders() {
  const data = extractResults(await apiRequest("/api/orders/?ordering=-created_at"));
  return data.map(normalizeAdminOrder);
}

export async function updateAdminOrder(order, fields) {
  const updated = await apiRequest(`/api/orders/${order.id}/`, {
    method: "PATCH",
    body: fields,
  });
  return normalizeAdminOrder(updated);
}

export function normalizeAdminContactMessage(message) {
  return {
    ...message,
    id: message.id,
    name: message.name || "Visitor",
    date: message.created_at ? new Date(message.created_at).toLocaleDateString() : "",
  };
}

export async function listAdminContactMessages() {
  const data = extractResults(await apiRequest("/api/contact-messages/?ordering=-created_at"));
  return data.map(normalizeAdminContactMessage);
}

export async function updateAdminContactMessageStatus(message, status) {
  const updated = await apiRequest(`/api/contact-messages/${message.id}/`, {
    method: "PATCH",
    body: { status },
  });
  return normalizeAdminContactMessage(updated);
}

export function normalizeAdminTransportSignup(entry) {
  return {
    ...entry,
    id: entry.id,
    date: entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "",
  };
}

export async function listAdminTransportWaitlist() {
  const data = extractResults(await apiRequest("/api/transport-waitlist/?ordering=-created_at"));
  return data.map(normalizeAdminTransportSignup);
}

export async function updateAdminTransportStatus(entry, status) {
  const updated = await apiRequest(`/api/transport-waitlist/${entry.id}/`, {
    method: "PATCH",
    body: { status },
  });
  return normalizeAdminTransportSignup(updated);
}

export async function listAdminBrands() {
  const data = extractResults(await apiRequest("/api/brands/?ordering=display_order,name"));
  return data.map(normalizeAdminBrand);
}

export async function saveAdminBrand(item, existingBrand) {
  const name = String(item.name || item.title || "New Brand").trim();
  const payload = {
    title: `Danajet-${name}`,
    slug: existingBrand ? undefined : slugify(name, "brand"),
    name,
    code: item.code || "",
    href: item.link || item.href || "/request-project",
    status: item.status || "Visible",
    summary: item.copy || item.summary || "",
    is_published: item.status !== "Hidden",
    metadata: {
      ...(existingBrand?.metadata || {}),
      copy: item.copy || "",
      link: item.link || item.href || "/request-project",
    },
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  const saved = await apiRequest(endpoint("/api/brands/", existingBrand?.slug || existingBrand?.id), {
    method: existingBrand ? "PATCH" : "POST",
    body: payload,
  });
  return normalizeAdminBrand(saved);
}

export async function deleteAdminBrand(brand) {
  await apiRequest(endpoint("/api/brands/", brand.slug || brand.id), { method: "DELETE" });
}

export async function listAdminMedia() {
  const data = extractResults(await apiRequest("/api/media-assets/?ordering=asset_type,title"));
  return data.map(normalizeAdminMedia);
}

export async function saveAdminMedia(item, existingAsset) {
  const payload = {
    title: item.title || "New Upload",
    slug: existingAsset ? undefined : slugify(item.title || "new-upload"),
    asset_type: String(item.type || "image").toLowerCase(),
    external_url: item.path || "",
    usage: item.usage || "",
    is_public: true,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  const saved = await apiRequest(endpoint("/api/media-assets/", existingAsset?.slug || existingAsset?.id), {
    method: existingAsset ? "PATCH" : "POST",
    body: payload,
  });
  return normalizeAdminMedia(saved);
}

export async function deleteAdminMedia(asset) {
  await apiRequest(endpoint("/api/media-assets/", asset.slug || asset.id), { method: "DELETE" });
}

export async function listAdminSettings() {
  const data = await listAll("/api/site-settings/?ordering=group,key");
  return data.map(normalizeAdminSetting);
}

export async function saveAdminSetting(key, value, label = key) {
  const isJsonValue = typeof value === "object" && value !== null;
  const body = {
    key,
    label,
    value: isJsonValue ? "" : String(value || ""),
    value_json: isJsonValue ? value : {},
    group: settingGroupFromKey(key),
    is_public: true,
  };
  const existing = extractResults(await apiRequest(`/api/site-settings/?search=${encodeURIComponent(key)}`))
    .find((setting) => setting.key === key);
  const path = existing ? `/api/site-settings/${key}/` : "/api/site-settings/";
  return normalizeAdminSetting(await apiRequest(path, { method: existing ? "PATCH" : "POST", body }));
}

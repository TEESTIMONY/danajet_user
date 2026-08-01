import { apiListAll, apiRequest, resolveMediaUrl } from "./client";

export function normalizeBlogPost(post) {
  return {
    ...post,
    excerpt: post.excerpt || post.summary || "",
    imageUrl: resolveMediaUrl(post.metadata?.image_url || post.image || ""),
    category: post.category_detail?.name || "Publishing & Creativity",
    readTime: post.read_time || "8 min read",
    publishedDate: post.published_at || post.created_at,
  };
}

export async function getBlogPosts() {
  const posts = await apiListAll("/api/blog-posts/?ordering=display_order,-published_at");
  return posts.map(normalizeBlogPost);
}

export async function getBlogPost(slug) {
  return normalizeBlogPost(await apiRequest(`/api/blog-posts/${slug}/`));
}

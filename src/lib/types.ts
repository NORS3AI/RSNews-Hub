export type Role = 'admin' | 'editor' | 'user';
export type UserStatus = 'active' | 'suspended' | 'banned';
export type ArticleStatus = 'draft' | 'published' | 'archived' | 'trashed';
export type PageStatus = 'draft' | 'published' | 'trashed';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover_image: string;
  category_id: number | null;
  author_id: number | null;
  status: ArticleStatus;
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleWithMeta extends Article {
  category_name: string | null;
  category_slug: string | null;
  author_name: string | null;
  tags: Tag[];
}

export interface Page {
  id: number;
  title: string;
  slug: string;
  body: string;
  status: PageStatus;
  created_at: string;
  updated_at: string;
}

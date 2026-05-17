export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  color: string;
  icon: string;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

import type { CollectionResponse } from '@navix/contracts';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  pageSize: number;
}

/** Resultado paginado genérico retornado pelos repositórios. */
export interface PagedResult<T> {
  items: T[];
  total: number;
}

/** Normaliza e limita os parâmetros de paginação (ver docs/api.md §8-9). */
export function normalizePage(page?: number, pageSize?: number): PageParams {
  const safePage = Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : 1;
  const rawSize =
    Number.isFinite(pageSize) && (pageSize as number) > 0
      ? Math.floor(pageSize as number)
      : DEFAULT_PAGE_SIZE;
  return { page: safePage, pageSize: Math.min(rawSize, MAX_PAGE_SIZE) };
}

/** Monta o envelope de coleção paginada com links de navegação. */
export function buildCollection<T>(
  items: T[],
  total: number,
  { page, pageSize }: PageParams,
  basePath: string,
): CollectionResponse<T> {
  const hasNext = page * pageSize < total;
  const build = (p: number): string => `${basePath}?page=${p}&pageSize=${pageSize}`;
  return {
    data: items,
    meta: { page, pageSize, total },
    links: {
      next: hasNext ? build(page + 1) : null,
      prev: page > 1 ? build(page - 1) : null,
    },
  };
}

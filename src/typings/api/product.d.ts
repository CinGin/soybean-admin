declare namespace Api {
  namespace Product {
    /** 产品列表项 */
    interface ProductItem {
      id: number;
      productName: string;
      productImage: string | null;
      productUrl: string | null;
      price: number | null;
      minOrder: string | null;
      supplierName: string;
      supplierUrl: string | null;
    }

    /** 搜索参数 */
    interface ProductSearchParams {
      productName?: string;
      minPrice?: number;
      maxPrice?: number;
      minOrder?: string;
      supplierName?: string;
      page: number;
      size: number;
      sortField: string;
      sortDir: string;
    }

    /** 分页响应 */
    interface ProductPageResult {
      content: ProductItem[];
      totalElements: number;
      totalPages: number;
      number: number;
      size: number;
    }
  }
}

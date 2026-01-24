import { Table, Relationship } from "@/store/useCanvasStore";

// Helper to create a UUID-like string for static template data
const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

export interface Template {
    id: string;
    name: string;
    description: string;
    tables: Table[];
    relationships: Relationship[];
}

export const ECOMMERCE_TEMPLATE: Template = {
    id: "ecommerce-v1",
    name: "E-commerce System",
    description: "A comprehensive schema for an online store including users, products, orders, payments, and reviews.",
    tables: [
        {
            id: "table-users",
            name: "users",
            x: 0,
            y: 0,
            color: "#e11d48", // rose
            columns: [
                { id: "col-users-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-users-email", name: "email", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-users-password", name: "password_hash", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-users-first", name: "first_name", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-users-last", name: "last_name", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-users-phone", name: "phone_number", type: "VARCHAR", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
                { id: "col-users-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-products",
            name: "products",
            x: 300,
            y: 0,
            color: "#ea580c", // orange
            columns: [
                { id: "col-products-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-products-catid", name: "category_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-products-name", name: "name", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-products-desc", name: "description", type: "TEXT", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
                { id: "col-products-price", name: "price", type: "DECIMAL", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-products-stock", name: "stock_quantity", type: "INT", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-products-sku", name: "sku", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-products-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-categories",
            name: "categories",
            x: 600,
            y: 0,
            color: "#d97706", // amber
            columns: [
                { id: "col-categories-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-categories-parent", name: "parent_id", type: "UUID", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
                { id: "col-categories-name", name: "name", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-categories-desc", name: "description", type: "TEXT", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-orders",
            name: "orders",
            x: 0,
            y: 400,
            color: "#16a34a", // green
            columns: [
                { id: "col-orders-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-orders-userid", name: "user_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-orders-status", name: "status", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-orders-total", name: "total_amount", type: "DECIMAL", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-orders-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-order-items",
            name: "order_items",
            x: 300,
            y: 400,
            color: "#16a34a", // green
            columns: [
                { id: "col-orderitems-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-orderitems-orderid", name: "order_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-orderitems-prodid", name: "product_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-orderitems-qty", name: "quantity", type: "INT", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-orderitems-price", name: "price_at_purchase", type: "DECIMAL", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-cart",
            name: "carts",
            x: 600,
            y: 400,
            color: "#0284c7", // sky
            columns: [
                { id: "col-cart-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-cart-userid", name: "user_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-cart-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-cart-items",
            name: "cart_items",
            x: 900,
            y: 400,
            color: "#0284c7", // sky
            columns: [
                { id: "col-cartitems-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-cartitems-cartid", name: "cart_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-cartitems-prodid", name: "product_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-cartitems-qty", name: "quantity", type: "INT", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-reviews",
            name: "reviews",
            x: 0,
            y: 700,
            color: "#4f46e5", // indigo
            columns: [
                { id: "col-reviews-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-reviews-prodid", name: "product_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-reviews-userid", name: "user_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-reviews-rating", name: "rating", type: "INT", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-reviews-comment", name: "comment", type: "TEXT", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
                { id: "col-reviews-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-addresses",
            name: "addresses",
            x: 300,
            y: 700,
            color: "#9333ea", // purple
            columns: [
                { id: "col-addresses-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-addresses-userid", name: "user_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-addresses-type", name: "type", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-addresses-street", name: "street", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-addresses-city", name: "city", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-addresses-zip", name: "zip_code", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-addresses-country", name: "country", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "table-payments",
            name: "payments",
            x: 600,
            y: 700,
            color: "#db2777", // pink
            columns: [
                { id: "col-payments-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "col-payments-orderid", name: "order_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-payments-amount", name: "amount", type: "DECIMAL", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-payments-method", name: "payment_method", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-payments-status", name: "status", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "col-payments-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
    ],
    relationships: [
        { id: "rel-prod-cat", name: "belongs_to", sourceTableId: "table-products", sourceColumnId: "col-products-catid", targetTableId: "table-categories", targetColumnId: "col-categories-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Set null" },
        { id: "rel-cat-parent", name: "parent_category", sourceTableId: "table-categories", sourceColumnId: "col-categories-parent", targetTableId: "table-categories", targetColumnId: "col-categories-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Set null" },
        { id: "rel-order-user", name: "placed_by", sourceTableId: "table-orders", sourceColumnId: "col-orders-userid", targetTableId: "table-users", targetColumnId: "col-users-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Restrict" },
        { id: "rel-item-order", name: "contains", sourceTableId: "table-order-items", sourceColumnId: "col-orderitems-orderid", targetTableId: "table-orders", targetColumnId: "col-orders-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "rel-item-prod", name: "references", sourceTableId: "table-order-items", sourceColumnId: "col-orderitems-prodid", targetTableId: "table-products", targetColumnId: "col-products-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Restrict" },
        { id: "rel-cart-user", name: "owns", sourceTableId: "table-cart", sourceColumnId: "col-cart-userid", targetTableId: "table-users", targetColumnId: "col-users-id", cardinality: "One to one", onUpdate: "No action", onDelete: "Cascade" },
        { id: "rel-cartitem-cart", name: "in_cart", sourceTableId: "table-cart-items", sourceColumnId: "col-cartitems-cartid", targetTableId: "table-cart", targetColumnId: "col-cart-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "rel-cartitem-prod", name: "cart_product", sourceTableId: "table-cart-items", sourceColumnId: "col-cartitems-prodid", targetTableId: "table-products", targetColumnId: "col-products-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Cascade" },
        { id: "rel-review-user", name: "reviewed_by", sourceTableId: "table-reviews", sourceColumnId: "col-reviews-userid", targetTableId: "table-users", targetColumnId: "col-users-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Cascade" },
        { id: "rel-review-prod", name: "reviews_product", sourceTableId: "table-reviews", sourceColumnId: "col-reviews-prodid", targetTableId: "table-products", targetColumnId: "col-products-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Cascade" },
        { id: "rel-address-user", name: "address_of", sourceTableId: "table-addresses", sourceColumnId: "col-addresses-userid", targetTableId: "table-users", targetColumnId: "col-users-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Cascade" },
        { id: "rel-payment-order", name: "pays_for", sourceTableId: "table-payments", sourceColumnId: "col-payments-orderid", targetTableId: "table-orders", targetColumnId: "col-orders-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Restrict" },
    ],
};

export const TEMPLATES = [ECOMMERCE_TEMPLATE];

import { Table, Relationship } from "@/store/useCanvasStore";

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

export const LMS_TEMPLATE: Template = {
    id: "lms-v1",
    name: "LMS System",
    description: "A learning management system for online courses, students, and progress tracking.",
    tables: [
        {
            id: "lms-users",
            name: "users",
            x: 0,
            y: 0,
            color: "#e11d48", // rose
            columns: [
                { id: "lms-users-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-users-email", name: "email", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-users-name", name: "full_name", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-users-role", name: "role", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false }, // 'student', 'instructor', 'admin'
                { id: "lms-users-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "lms-courses",
            name: "courses",
            x: 300,
            y: 0,
            color: "#ea580c", // orange
            columns: [
                { id: "lms-courses-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-courses-inst", name: "instructor_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-courses-title", name: "title", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-courses-desc", name: "description", type: "TEXT", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
                { id: "lms-courses-price", name: "price", type: "DECIMAL", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "lms-enrollments",
            name: "enrollments",
            x: 0,
            y: 300,
            color: "#0284c7", // sky
            columns: [
                { id: "lms-enroll-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-enroll-stud", name: "student_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-enroll-course", name: "course_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-enroll-date", name: "enrolled_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "lms-modules",
            name: "modules",
            x: 600,
            y: 0,
            color: "#d97706", // amber
            columns: [
                { id: "lms-modules-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-modules-course", name: "course_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-modules-title", name: "title", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-modules-seq", name: "sequence", type: "INT", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "lms-lessons",
            name: "lessons",
            x: 900,
            y: 0,
            color: "#16a34a", // green
            columns: [
                { id: "lms-lessons-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-lessons-mod", name: "module_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-lessons-title", name: "title", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-lessons-type", name: "content_type", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false }, // 'video', 'text', 'quiz'
            ],
        },
        {
            id: "lms-progress",
            name: "progress",
            x: 300,
            y: 300,
            color: "#9333ea", // purple
            columns: [
                { id: "lms-prog-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-prog-enroll", name: "enrollment_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-prog-less", name: "lesson_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-prog-comp", name: "is_completed", type: "BOOLEAN", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "lms-assignments",
            name: "assignments",
            x: 600,
            y: 300,
            color: "#db2777", // pink
            columns: [
                { id: "lms-assign-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-assign-course", name: "course_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-assign-title", name: "title", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-assign-due", name: "due_date", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "lms-subs",
            name: "submissions",
            x: 900,
            y: 300,
            color: "#4f46e5", // indigo
            columns: [
                { id: "lms-sub-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "lms-sub-assign", name: "assignment_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-sub-stud", name: "student_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "lms-sub-grade", name: "grade", type: "DECIMAL", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
            ],
        },
    ],
    relationships: [
        { id: "lms-rel-course-inst", name: "taught_by", sourceTableId: "lms-courses", sourceColumnId: "lms-courses-inst", targetTableId: "lms-users", targetColumnId: "lms-users-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Set null" },
        { id: "lms-rel-enroll-stud", name: "enrolled_student", sourceTableId: "lms-enrollments", sourceColumnId: "lms-enroll-stud", targetTableId: "lms-users", targetColumnId: "lms-users-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Cascade" },
        { id: "lms-rel-enroll-course", name: "enrolled_course", sourceTableId: "lms-enrollments", sourceColumnId: "lms-enroll-course", targetTableId: "lms-courses", targetColumnId: "lms-courses-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Cascade" },
        { id: "lms-rel-mod-course", name: "course_content", sourceTableId: "lms-modules", sourceColumnId: "lms-modules-course", targetTableId: "lms-courses", targetColumnId: "lms-courses-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "lms-rel-less-mod", name: "module_item", sourceTableId: "lms-lessons", sourceColumnId: "lms-lessons-mod", targetTableId: "lms-modules", targetColumnId: "lms-modules-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "lms-rel-prog-enroll", name: "student_progress", sourceTableId: "lms-progress", sourceColumnId: "lms-prog-enroll", targetTableId: "lms-enrollments", targetColumnId: "lms-enroll-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "lms-rel-prog-less", name: "lesson_progress", sourceTableId: "lms-progress", sourceColumnId: "lms-prog-less", targetTableId: "lms-lessons", targetColumnId: "lms-lessons-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "lms-rel-assign-course", name: "course_assignment", sourceTableId: "lms-assignments", sourceColumnId: "lms-assign-course", targetTableId: "lms-courses", targetColumnId: "lms-courses-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "lms-rel-sub-assign", name: "submission_for", sourceTableId: "lms-subs", sourceColumnId: "lms-sub-assign", targetTableId: "lms-assignments", targetColumnId: "lms-assign-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "lms-rel-sub-stud", name: "submitted_by", sourceTableId: "lms-subs", sourceColumnId: "lms-sub-stud", targetTableId: "lms-users", targetColumnId: "lms-users-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Cascade" },
    ]
};

export const SAAS_TEMPLATE: Template = {
    id: "saas-v1",
    name: "SaaS & Project Mgmt",
    description: "A multi-tenant architecture for project management with organizations, tasks, and subscriptions.",
    tables: [
        {
            id: "saas-orgs",
            name: "organizations",
            x: 0,
            y: 0,
            color: "#0f172a", // slate-900 (custom)
            columns: [
                { id: "saas-orgs-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-orgs-name", name: "name", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-orgs-domain", name: "domain_slug", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-orgs-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "saas-users",
            name: "users",
            x: 300,
            y: 0,
            color: "#e11d48", // rose
            columns: [
                { id: "saas-users-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-users-org", name: "organization_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-users-email", name: "email", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-users-pass", name: "password_hash", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-users-role", name: "role", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false }, // 'owner', 'member', 'guest'
            ],
        },
        {
            id: "saas-subs",
            name: "subscriptions",
            x: 0,
            y: 300,
            color: "#16a34a", // green
            columns: [
                { id: "saas-subs-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-subs-org", name: "organization_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-subs-plan", name: "plan", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false }, // 'free', 'pro', 'enterprise'
                { id: "saas-subs-status", name: "status", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-subs-end", name: "current_period_end", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "saas-projects",
            name: "projects",
            x: 600,
            y: 0,
            color: "#ea580c", // orange
            columns: [
                { id: "saas-proj-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-proj-org", name: "organization_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-proj-name", name: "name", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-proj-status", name: "status", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "saas-tasks",
            name: "tasks",
            x: 600,
            y: 300,
            color: "#0284c7", // sky
            columns: [
                { id: "saas-tasks-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-tasks-proj", name: "project_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-tasks-assign", name: "assignee_id", type: "UUID", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
                { id: "saas-tasks-title", name: "title", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-tasks-status", name: "status", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-tasks-prio", name: "priority", type: "INT", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-tasks-due", name: "due_date", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: false, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "saas-comments",
            name: "comments",
            x: 900,
            y: 300,
            color: "#4f46e5", // indigo
            columns: [
                { id: "saas-comm-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-comm-task", name: "task_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-comm-user", name: "user_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-comm-body", name: "body", type: "TEXT", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-comm-created", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "saas-tags",
            name: "tags",
            x: 900,
            y: 0,
            color: "#9333ea", // purple
            columns: [
                { id: "saas-tags-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-tags-org", name: "organization_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-tags-name", name: "name", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-tags-color", name: "color", type: "VARCHAR", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
        {
            id: "saas-tasktags",
            name: "task_tags",
            x: 750,
            y: 150,
            color: "#64748b", // slate-500
            columns: [
                { id: "saas-tt-id", name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true, isUnique: true, isAutoIncrement: false },
                { id: "saas-tt-task", name: "task_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
                { id: "saas-tt-tag", name: "tag_id", type: "UUID", isPrimaryKey: false, isNotNull: true, isUnique: false, isAutoIncrement: false },
            ],
        },
    ],
    relationships: [
        { id: "saas-rel-user-org", name: "member_of", sourceTableId: "saas-users", sourceColumnId: "saas-users-org", targetTableId: "saas-orgs", targetColumnId: "saas-orgs-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "saas-rel-sub-org", name: "subscription_for", sourceTableId: "saas-subs", sourceColumnId: "saas-subs-org", targetTableId: "saas-orgs", targetColumnId: "saas-orgs-id", cardinality: "One to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "saas-rel-proj-org", name: "project_owner", sourceTableId: "saas-projects", sourceColumnId: "saas-proj-org", targetTableId: "saas-orgs", targetColumnId: "saas-orgs-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "saas-rel-task-proj", name: "belongs_to_project", sourceTableId: "saas-tasks", sourceColumnId: "saas-tasks-proj", targetTableId: "saas-projects", targetColumnId: "saas-proj-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "saas-rel-task-assign", name: "assigned_to", sourceTableId: "saas-tasks", sourceColumnId: "saas-tasks-assign", targetTableId: "saas-users", targetColumnId: "saas-users-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Set null" },
        { id: "saas-rel-comm-task", name: "comment_on", sourceTableId: "saas-comments", sourceColumnId: "saas-comm-task", targetTableId: "saas-tasks", targetColumnId: "saas-tasks-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "saas-rel-comm-user", name: "comment_author", sourceTableId: "saas-comments", sourceColumnId: "saas-comm-user", targetTableId: "saas-users", targetColumnId: "saas-users-id", cardinality: "Many to one", onUpdate: "No action", onDelete: "Set null" },
        { id: "saas-rel-tag-org", name: "org_tag", sourceTableId: "saas-tags", sourceColumnId: "saas-tags-org", targetTableId: "saas-orgs", targetColumnId: "saas-orgs-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "saas-rel-tt-task", name: "tagged_task", sourceTableId: "saas-tasktags", sourceColumnId: "saas-tt-task", targetTableId: "saas-tasks", targetColumnId: "saas-tasks-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
        { id: "saas-rel-tt-tag", name: "tag_reference", sourceTableId: "saas-tasktags", sourceColumnId: "saas-tt-tag", targetTableId: "saas-tags", targetColumnId: "saas-tags-id", cardinality: "Many to one", onUpdate: "Cascade", onDelete: "Cascade" },
    ],
};

export const TEMPLATES = [ECOMMERCE_TEMPLATE, LMS_TEMPLATE, SAAS_TEMPLATE];

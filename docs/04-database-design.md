# Database Design

## Purpose

This document describes the MySQL database design for Golden Loom Myanmar.

## Entity Relationship Overview

```text
users
  ├─ carts
  │   └─ cart_items
  ├─ orders
  │   ├─ order_items
  │   ├─ payments
  │   └─ order_change_requests
  └─ customer_requests

categories
  └─ products
      └─ product_variants

pickup_slots
  └─ orders
```

## Main Tables

- users
- categories
- products
- product_variants
- carts
- cart_items
- pickup_slots
- orders
- order_items
- payments
- order_change_requests
- customer_requests

## User and Catalog Tables

### users

**Purpose:** Stores customer, staff, and admin account information.

| Column       | Data Type    | Rules                         | Description                                            |
| ------------ | ------------ | ----------------------------- | ------------------------------------------------------ |
| `id`         | INT          | Primary key, auto-increment   | Unique user ID                                         |
| `full_name`  | VARCHAR(100) | Required                      | User's full name                                       |
| `email`      | VARCHAR(255) | Required, unique              | Email used for login                                   |
| `password`   | VARCHAR(255) | Required                      | Hashed password; never plain text                      |
| `role`       | ENUM         | Required; default: `customer` | `customer`, `staff`, or `admin`                        |
| `phone`      | VARCHAR(20)  | Required                      | Contact number                                         |
| `is_active`  | BOOLEAN      | Default: true                 | Shows whether the account is allowed to use the system |
| `created_at` | TIMESTAMP    | Required                      | When the account was created                           |
| `updated_at` | TIMESTAMP    | Required                      | When the account was last updated                      |

### categories

**Purpose:** **Purpose:** Groups sweaters into product types, such as Pullovers, Hoodies, Cardigans, and Turtlenecks etc.

| Column        | Data Type    | Rules                       | Description                                        |
| ------------- | ------------ | --------------------------- | -------------------------------------------------- |
| `id`          | INT          | Primary key, auto-increment | Unique category ID                                 |
| `name`        | VARCHAR(100) | Required, unique            | Category name                                      |
| `slug`        | VARCHAR(120) | Required, unique            | URL-friendly category name                         |
| `description` | TEXT         | Optional                    | Short category description                         |
| `is_active`   | BOOLEAN      | Default: true               | Shows whether the category is visible to customers |
| `created_at`  | TIMESTAMP    | Required                    | When the category was created                      |
| `updated_at`  | TIMESTAMP    | Required                    | When the category was last updated                 |

### products

**Purpose:** Stores the general information for each sweater style.

| Column              | Data Type    | Rules                       | Description                                       |
| ------------------- | ------------ | --------------------------- | ------------------------------------------------- |
| `id`                | INT          | Primary key, auto-increment | Unique product ID                                 |
| `category_id`       | INT          | Required, foreign key       | Links the product to `categories.id`              |
| `name`              | VARCHAR(150) | Required                    | Product name                                      |
| `slug`              | VARCHAR(180) | Required, unique            | URL-friendly product name                         |
| `target_gender`     | ENUM         | Required                    | `women`, `men`, or `unisex`                       |
| `description`       | TEXT         | Required                    | Product description                               |
| `material`          | VARCHAR(100) | Optional                    | For example, wool blend or cotton knit            |
| `care_instructions` | TEXT         | Optional                    | Washing and care information                      |
| `main_image`        | VARCHAR(255) | Required                    | Main product-image filename or URL                |
| `is_active`         | BOOLEAN      | Default: true               | Shows whether the product is visible to customers |
| `created_at`        | TIMESTAMP    | Required                    | When the product was created                      |
| `updated_at`        | TIMESTAMP    | Required                    | When the product was last updated                 |

### product_variants

**Purpose:** Stores the purchasable color and size options for each product.

| Column               | Data Type     | Rules                       | Description                                |
| -------------------- | ------------- | --------------------------- | ------------------------------------------ |
| `id`                 | INT           | Primary key, auto-increment | Unique variant ID                          |
| `product_id`         | INT           | Required, foreign key       | Links the variant to `products.id`         |
| `sku`                | VARCHAR(100)  | Required, unique            | Internal code for this exact variant       |
| `color`              | VARCHAR(50)   | Required                    | Variant color                              |
| `size`               | VARCHAR(30)   | Required                    | `Free Size`, `S`, `M`, `L`, and so on      |
| `price`              | DECIMAL(10,2) | Required                    | Selling price in AED                       |
| `fulfillment_type`   | ENUM          | Required                    | `in_stock` or `preorder`                   |
| `stock_quantity`     | INT UNSIGNED  | Required; minimum: 0        | Number of locally available pieces         |
| `preorder_wait_days` | INT UNSIGNED  | Required for preorder only  | Expected waiting time, such as `14` days   |
| `variant_image`      | VARCHAR(255)  | Optional                    | Image specific to this color               |
| `is_active`          | BOOLEAN       | Default: true               | Shows whether this option can be purchased |
| `created_at`         | TIMESTAMP     | Required                    | When the variant was created               |
| `updated_at`         | TIMESTAMP     | Required                    | When the variant was last updated          |

## Cart and Order Tables

### carts

**Purpose:** Stores a customer's temporary shopping cart before checkout.

| Column       | Data Type | Rules                       | Description                             |
| ------------ | --------- | --------------------------- | --------------------------------------- |
| `id`         | INT       | Primary key, auto-increment | Unique cart ID                          |
| `user_id`    | INT       | Required, foreign key       | Links the cart to `users.id`            |
| `status`     | ENUM      | Required; default: `active` | `active`, `checked_out`, or `abandoned` |
| `created_at` | TIMESTAMP | Required                    | When the cart was created               |
| `updated_at` | TIMESTAMP | Required                    | When the cart was last updated          |

**Rule:** A customer may have only one active cart at a time. Older carts may remain as `checked_out` or `abandoned`.

### cart_items

**Purpose:** Stores the product variants and quantities that a customer adds to a cart.

| Column       | Data Type    | Rules                       | Description                             |
| ------------ | ------------ | --------------------------- | --------------------------------------- |
| `id`         | INT          | Primary key, auto-increment | Unique cart-item ID                     |
| `cart_id`    | INT          | Required, foreign key       | Links the item to `carts.id`            |
| `variant_id` | INT          | Required, foreign key       | Links the item to `product_variants.id` |
| `quantity`   | INT UNSIGNED | Required; minimum: 1        | Number of pieces the customer wants     |
| `created_at` | TIMESTAMP    | Required                    | When the item was added                 |
| `updated_at` | TIMESTAMP    | Required                    | When the quantity was last changed      |

**Rule:** The same variant may appear only once in one cart. Adding it again increases its quantity instead of creating a duplicate row.

### pickup_slots

**Purpose:** Stores the available dates and times when customers may collect in-stock orders.

| Column        | Data Type    | Rules                       | Description                                 |
| ------------- | ------------ | --------------------------- | ------------------------------------------- |
| `id`          | INT          | Primary key, auto-increment | Unique pickup-slot ID                       |
| `pickup_date` | DATE         | Required                    | Available collection date                   |
| `start_time`  | TIME         | Required                    | Start of the collection time                |
| `end_time`    | TIME         | Required                    | End of the collection time                  |
| `capacity`    | INT UNSIGNED | Required; minimum: 1        | Maximum customers allowed in the slot       |
| `is_active`   | BOOLEAN      | Default: true               | Shows whether customers can select the slot |
| `created_by`  | INT          | Required, foreign key       | Staff/admin user who created the slot       |
| `created_at`  | TIMESTAMP    | Required                    | When the slot was created                   |
| `updated_at`  | TIMESTAMP    | Required                    | When the slot was last updated              |

### orders

**Purpose:** Stores the main information, delivery details, totals, and statuses for each customer order.

| Column                  | Data Type     | Rules                           | Description                                                |
| ----------------------- | ------------- | ------------------------------- | ---------------------------------------------------------- |
| `id`                    | INT           | Primary key, auto-increment     | Unique order ID                                            |
| `order_number`          | VARCHAR(30)   | Required, unique                | Customer-friendly order number, such as `GLM-20260915-001` |
| `user_id`               | INT           | Required, foreign key           | Links the order to `users.id`                              |
| `fulfillment_type`      | ENUM          | Required                        | `in_stock` or `preorder`                                   |
| `order_status`          | ENUM          | Required                        | Order progress status                                      |
| `payment_status`        | ENUM          | Required                        | Payment progress status                                    |
| `subtotal`              | DECIMAL(10,2) | Required                        | Total of all order items before delivery fee               |
| `delivery_fee`          | DECIMAL(10,2) | Required; default: `0.00`       | Delivery charge saved at checkout                          |
| `total_amount`          | DECIMAL(10,2) | Required                        | Subtotal plus delivery fee                                 |
| `deposit_required`      | DECIMAL(10,2) | Required; default: `0.00`       | 20% preorder deposit; `0.00` for in-stock orders           |
| `recipient_name`        | VARCHAR(100)  | Required                        | Delivery or pickup recipient name                          |
| `recipient_phone`       | VARCHAR(20)   | Required                        | Delivery or pickup contact number                          |
| `delivery_method`       | ENUM          | Optional for preorder initially | `standard_delivery`, `express_delivery`, or `pickup`       |
| `delivery_address`      | TEXT          | Required for delivery only      | Customer delivery address                                  |
| `delivery_notes`        | TEXT          | Optional                        | Building, apartment, or delivery instructions              |
| `pickup_slot_id`        | INT           | Optional, foreign key           | Links to `pickup_slots.id` for pickup orders               |
| `tracking_number`       | VARCHAR(100)  | Optional                        | Added by staff when shipped                                |
| `customer_confirmed_at` | TIMESTAMP     | Optional                        | When the customer confirms a COD order                     |
| `created_at`            | TIMESTAMP     | Required                        | When the order was created                                 |
| `updated_at`            | TIMESTAMP     | Required                        | When the order was last updated                            |

**Allowed order statuses:**

- `awaiting_customer_confirmation`: COD order created; customer has not confirmed it yet.
- `awaiting_deposit`: Preorder created; deposit has not been submitted or confirmed.
- `confirmed`: Customer confirmation or preorder deposit is complete.
- `sourcing`: Preorder items are being sourced/imported from Myanmar.
- `ready_for_delivery`: Order is ready; customer may choose delivery or pickup.
- `out_for_delivery`: Order is currently being delivered.
- `delivered`: Customer received the order.
- `delivery_failed`: Delivery attempt was unsuccessful.
- `cancelled`: Order was cancelled.

**Allowed order payment statuses:**

- `cod_pending`: In-stock COD payment is waiting for collection.
- `deposit_pending`: Preorder deposit is needed.
- `deposit_submitted`: Customer submitted deposit proof.
- `deposit_confirmed`: Staff/admin confirmed the preorder deposit.
- `balance_pending`: Remaining order balance is still due.
- `fully_paid`: The full order amount has been paid.
- `refunded`: Money was refunded to the customer.

### order_items

**Purpose:** Stores each sweater variant purchased in an order and preserves its purchase-time details.

| Column               | Data Type     | Rules                       | Description                                 |
| -------------------- | ------------- | --------------------------- | ------------------------------------------- |
| `id`                 | INT           | Primary key, auto-increment | Unique order-item ID                        |
| `order_id`           | INT           | Required, foreign key       | Links the item to `orders.id`               |
| `product_id`         | INT           | Required, foreign key       | Links to the original `products.id`         |
| `variant_id`         | INT           | Required, foreign key       | Links to the original `product_variants.id` |
| `product_name`       | VARCHAR(150)  | Required                    | Product-name snapshot                       |
| `sku`                | VARCHAR(100)  | Required                    | Variant-SKU snapshot                        |
| `color`              | VARCHAR(50)   | Required                    | Color snapshot                              |
| `size`               | VARCHAR(30)   | Required                    | Size snapshot                               |
| `product_image`      | VARCHAR(255)  | Optional                    | Product-image snapshot                      |
| `unit_price`         | DECIMAL(10,2) | Required                    | Price of one item at checkout               |
| `quantity`           | INT UNSIGNED  | Required; minimum: 1        | Number of pieces ordered                    |
| `line_total`         | DECIMAL(10,2) | Calculated by system        | `unit_price × quantity`                     |
| `preorder_wait_days` | INT UNSIGNED  | Optional                    | Preorder waiting-time snapshot              |
| `created_at`         | TIMESTAMP     | Required                    | When the order item was created             |
| `updated_at`         | TIMESTAMP     | Required                    | When the order item was last updated        |

### payments

**Purpose:** Stores preorder deposits, remaining-balance payments, cash-on-delivery collection, and refunds.

| Column                  | Data Type     | Rules                       | Description                                           |
| ----------------------- | ------------- | --------------------------- | ----------------------------------------------------- |
| `id`                    | INT           | Primary key, auto-increment | Unique payment ID                                     |
| `order_id`              | INT           | Required, foreign key       | Links the payment to `orders.id`                      |
| `payment_type`          | ENUM          | Required                    | `deposit`, `balance`, `cash_on_delivery`, or `refund` |
| `payment_method`        | ENUM          | Required                    | `bank_transfer` or `cash`                             |
| `amount`                | DECIMAL(10,2) | Required                    | Payment or refund amount                              |
| `status`                | ENUM          | Required                    | Payment processing status                             |
| `proof_image`           | VARCHAR(255)  | Optional                    | Deposit-payment screenshot or receipt                 |
| `transaction_reference` | VARCHAR(100)  | Optional                    | Bank-transfer reference number                        |
| `confirmed_by`          | INT           | Optional, foreign key       | Staff/admin user who confirms the payment             |
| `confirmed_at`          | TIMESTAMP     | Optional                    | When staff/admin confirms the payment                 |
| `notes`                 | TEXT          | Optional                    | Rejection, refund, or staff notes                     |
| `created_at`            | TIMESTAMP     | Required                    | When the payment record was created                   |
| `updated_at`            | TIMESTAMP     | Required                    | When the payment record was last updated              |

**Allowed payment statuses:**

- `submitted`: Customer uploaded deposit proof; staff review is needed.
- `confirmed`: Staff/admin verified the payment.
- `rejected`: Staff/admin rejected the payment proof.
- `pending_collection`: Cash on delivery is waiting to be collected.
- `collected`: Cash on delivery was collected successfully.
- `refunded`: Money was returned to the customer.

### order_change_requests

**Purpose:** Stores customer requests to change a variant, cancel an order/item, or reschedule delivery.

| Column                 | Data Type     | Rules                        | Description                                                               |
| ---------------------- | ------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `id`                   | INT           | Primary key, auto-increment  | Unique request ID                                                         |
| `order_id`             | INT           | Required, foreign key        | Links the request to `orders.id`                                          |
| `order_item_id`        | INT           | Optional, foreign key        | Links to one `order_items.id` when one item is affected                   |
| `request_type`         | ENUM          | Required                     | `change_variant`, `cancel_order`, `cancel_item`, or `reschedule_delivery` |
| `requested_variant_id` | INT           | Optional, foreign key        | New variant requested for a color/size change                             |
| `reason`               | TEXT          | Required                     | Customer explanation                                                      |
| `status`               | ENUM          | Required; default: `pending` | Request-review status                                                     |
| `price_difference`     | DECIMAL(10,2) | Required; default: `0.00`    | Extra payment or price reduction after a variant change                   |
| `refund_amount`        | DECIMAL(10,2) | Required; default: `0.00`    | Refund approved by staff/admin                                            |
| `staff_note`           | TEXT          | Optional                     | Staff/admin response to the customer                                      |
| `handled_by`           | INT           | Optional, foreign key        | Staff/admin user who made the decision                                    |
| `handled_at`           | TIMESTAMP     | Optional                     | When the request was handled                                              |
| `created_at`           | TIMESTAMP     | Required                     | When the customer submitted the request                                   |
| `updated_at`           | TIMESTAMP     | Required                     | When the request was last updated                                         |

**Allowed request statuses:**

- `pending`: Waiting for staff/admin review.
- `approved`: Staff/admin accepted the request.
- `rejected`: Staff/admin declined the request.
- `completed`: The approved change, cancellation, or refund has been completed.

### customer_requests

**Purpose:** Stores customer product requests and general feedback for staff/admin review.

| Column            | Data Type    | Rules                       | Description                             |
| ----------------- | ------------ | --------------------------- | --------------------------------------- |
| `id`              | INT          | Primary key, auto-increment | Unique customer-request ID              |
| `user_id`         | INT          | Required, foreign key       | Links the request to `users.id`         |
| `request_type`    | ENUM         | Required                    | `product_request` or `general_feedback` |
| `subject`         | VARCHAR(150) | Required                    | Short request or feedback title         |
| `message`         | TEXT         | Required                    | Customer request or feedback details    |
| `preferred_color` | VARCHAR(50)  | Optional                    | Requested color                         |
| `preferred_size`  | VARCHAR(30)  | Optional                    | Requested size                          |
| `status`          | ENUM         | Required; default: `new`    | Request-review status                   |
| `staff_response`  | TEXT         | Optional                    | Staff/admin reply                       |
| `handled_by`      | INT          | Optional, foreign key       | Staff/admin user who handled it         |
| `handled_at`      | TIMESTAMP    | Optional                    | When the request was handled            |
| `created_at`      | TIMESTAMP    | Required                    | When the customer submitted the request |
| `updated_at`      | TIMESTAMP    | Required                    | When the request was last updated       |

**Allowed request statuses:**

- `new`: Newly submitted request.
- `reviewing`: Staff/admin is reviewing it.
- `planned`: The business plans to provide the requested item or improvement.
- `fulfilled`: The request has been completed.
- `rejected`: The request will not be completed.
